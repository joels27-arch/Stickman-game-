/**
 * `Room` — one Lane Rush lobby, as a Durable Object. The room code IS the
 * room name (`/ws/<CODE>`), so one code = one lobby anywhere in the world.
 *
 * This is the TRUSTED half of the game: sockets, the clock, persistence. Every
 * game decision is made by `./logic.js`. Compared to the stock kernel:
 *   * there are no fixed "seats" — the lobby itself (logic state) decides who
 *     is in, so a player who leaves frees their spot;
 *   * the room stamps every action with the server time (`action.t`), which is
 *     what makes the countdown, finish times and the anti-cheat speed cap work
 *     while logic.js stays deterministic;
 *   * a closed connection becomes a system `drop` action, and timers
 *     (countdown → race → results, lobby clean-up) run as system `tick`s via
 *     the alarm, as scheduled by `logic.wakeAfter()`;
 *   * when the last connection closes the room wipes itself, so an old code
 *     never resurrects a stale lobby.
 *
 * ── WIRE PROTOCOL ────────────────────────────────────────────────────────
 *   in:  {type:"join", playerId} | {type:"action", action}
 *   out: {type:"state", status, seats, you, connected, view, result, meta, serverTime}
 *        {type:"error", error}
 *
 * ── HIBERNATION ─────────────────────────────────────────────────────────
 * Sockets are accepted with `ctx.acceptWebSocket`, so the room may be evicted
 * from memory while connections stay open. Never keep state in instance
 * fields; everything lives in `ctx.storage`, and a connection's id rides on
 * the socket (`serializeAttachment`).
 */

import { DurableObject } from "cloudflare:workers";

import type { Env } from "./env";
import * as logic from "./logic.js";
import { parseClientMessage } from "./protocol";

interface Game {
  status: "waiting" | "playing" | "over";
  state: unknown;
}

/** connId -> playerId. Persisted: the sockets outlive this object's memory. */
type Conns = Record<string, string>;

interface Out {
  to: string | string[];
  data: unknown;
}

type Dispatchable = Out[] | { out?: Out[]; wakeIn?: number | null } | void;

/** A brand-new room. A factory, never a shared constant (see git history). */
export function freshGame(): Game {
  return { status: "waiting", state: null };
}

export function resolveMeta(
  raw: unknown,
): { game: string; minPlayers: number; maxPlayers: number } {
  const meta = (raw ?? {}) as Record<string, unknown>;
  const players = Array.isArray(meta.players) ? (meta.players as unknown[]) : [];
  const seats = (value: unknown, fallback: number): number =>
    Number.isInteger(value) && (value as number) >= 1 ? (value as number) : fallback;

  const minPlayers = seats(meta.minPlayers, seats(players[0], 1));
  const maxPlayers = seats(meta.maxPlayers, seats(players[1], minPlayers));
  const named = [meta.game, meta.name, meta.title].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  return {
    game: named ?? "Game",
    minPlayers,
    maxPlayers: Math.max(minPlayers, maxPlayers),
  };
}

const META = resolveMeta(logic.meta);

const PING = "__ping";
const PONG = "__pong";

/** Player ids are client-chosen; keep them short and boring. */
const PLAYER_RE = /^[A-Za-z0-9_-]{1,40}$/;

const SYSTEM = "__system";

export class Room extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  // ── persistence ────────────────────────────────────────────────────────

  private async load(): Promise<{ game: Game; conns: Conns }> {
    const [game, conns] = await Promise.all([
      this.ctx.storage.get<Game>("game"),
      this.ctx.storage.get<Conns>("conns"),
    ]);
    return { game: game ?? freshGame(), conns: conns ?? {} };
  }

  private async save(game: Game, conns: Conns): Promise<void> {
    await this.ctx.storage.put({ game, conns });
  }

  // ── protocol helpers ───────────────────────────────────────────────────

  private broadcast(game: Game, conns: Conns): Out[] {
    const connected = Object.keys(conns).length;
    const serverTime = Date.now();
    const view0 = game.state as { players?: Record<string, unknown>; order?: string[] } | null;
    const seats = view0?.order ?? [];
    return Object.entries(conns).map(([connId, playerId]) => ({
      to: connId,
      data: {
        type: "state",
        status: game.status,
        seats,
        you: playerId,
        connected,
        view: game.state ? logic.viewFor(game.state, playerId) : null,
        result: null,
        meta: META,
        serverTime,
      },
    }));
  }

  private error(connId: string, error: string): Out[] {
    return [{ to: connId, data: { type: "error", error } }];
  }

  private schedule(game: Game): number | null {
    return game.state ? logic.wakeAfter(game.state) : null;
  }

  // ── connection lifecycle ───────────────────────────────────────────────

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected a websocket upgrade", { status: 426 });
    }
    const pair = new WebSocketPair();
    const server = pair[1]!;
    this.ctx.acceptWebSocket(server);
    const connId = crypto.randomUUID().slice(0, 8);
    server.serializeAttachment({ connId });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  private connIdOf(ws: WebSocket): string | undefined {
    const att = ws.deserializeAttachment() as { connId?: string } | null;
    return att?.connId;
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const connId = this.connIdOf(ws);
    if (!connId) return;
    try {
      await this.dispatch(await this.onMessage(connId, raw));
    } catch (err) {
      console.error("room message failed:", err instanceof Error ? err.stack : String(err));
      try {
        ws.send(JSON.stringify({ type: "error", error: "server error" }));
      } catch {
        /* socket already gone */
      }
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    const connId = this.connIdOf(ws);
    if (!connId) return;
    try {
      await this.dispatch(await this.onClose(connId));
    } catch (err) {
      console.error("room close failed:", err instanceof Error ? err.stack : String(err));
    }
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  override async alarm(): Promise<void> {
    try {
      await this.dispatch(await this.onWake());
    } catch (err) {
      console.error("room alarm failed:", err instanceof Error ? err.stack : String(err));
    }
  }

  // ── game semantics ─────────────────────────────────────────────────────

  private async onMessage(connId: string, raw: string | ArrayBuffer): Promise<Dispatchable> {
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) return this.error(connId, parsed.error);
    const msg = parsed.msg;

    const { game, conns } = await this.load();

    if (msg.type === "join") {
      if (!PLAYER_RE.test(msg.playerId)) return this.error(connId, "bad player id");
      conns[connId] = msg.playerId;
      if (!game.state) {
        game.state = logic.setup([]);
        game.status = "playing";
      }
      await this.save(game, conns);
      return this.broadcast(game, conns);
    }

    const playerId = conns[connId];
    if (!playerId) return this.error(connId, "join first");

    if (msg.type === "action") {
      if (!game.state) return this.error(connId, "join first");
      const action = msg.action as Record<string, unknown> | null;
      if (action === null || typeof action !== "object" || Array.isArray(action)) {
        return this.error(connId, "bad action");
      }
      // The server's clock, never the client's.
      const stamped = { ...action, t: Date.now() };
      const verdict = logic.validateAction(game.state, playerId, stamped);
      if (!verdict.ok) return this.error(connId, verdict.error ?? "invalid action");
      game.state = logic.applyAction(game.state, playerId, stamped);
      await this.save(game, conns);
      return { out: this.broadcast(game, conns), wakeIn: this.schedule(game) };
    }

    // "reset" is not part of this game; the host uses the "again" action.
    return this.error(connId, "unsupported");
  }

  private async onClose(connId: string): Promise<Dispatchable> {
    const { game, conns } = await this.load();
    const playerId = conns[connId];
    if (playerId === undefined) return;
    delete conns[connId];

    // Last one out: wipe the room so the code is free and nothing stale lingers.
    if (Object.keys(conns).length === 0) {
      await this.ctx.storage.deleteAll();
      return { out: [], wakeIn: null };
    }

    const stillHere = Object.values(conns).includes(playerId);
    if (!stillHere && game.state) {
      game.state = logic.applyAction(game.state, playerId, {
        type: "drop",
        t: Date.now(),
      });
    }
    await this.save(game, conns);
    return { out: this.broadcast(game, conns), wakeIn: this.schedule(game) };
  }

  private async onWake(): Promise<Dispatchable> {
    const { game, conns } = await this.load();
    if (!game.state || Object.keys(conns).length === 0) return { out: [], wakeIn: null };
    const before = JSON.stringify(game.state);
    game.state = logic.applyAction(game.state, SYSTEM, { type: "tick", t: Date.now() });
    const changed = JSON.stringify(game.state) !== before;
    if (changed) await this.save(game, conns);
    // Broadcast only on real changes (phase flips, evictions) — during a race
    // the players' own position updates already keep everyone in sync.
    return { out: changed ? this.broadcast(game, conns) : [], wakeIn: this.schedule(game) };
  }

  // ── fan-out ────────────────────────────────────────────────────────────

  private async dispatch(res: Dispatchable): Promise<void> {
    if (!res) return;
    const msgs = Array.isArray(res) ? res : (res.out ?? []);
    const wakeIn = Array.isArray(res) ? undefined : res.wakeIn;

    if (msgs.length) {
      const sockets = this.ctx.getWebSockets();
      const byId = new Map<string, WebSocket>();
      for (const s of sockets) {
        const id = this.connIdOf(s);
        if (id) byId.set(id, s);
      }
      for (const m of msgs) {
        if (!m) continue;
        const data = typeof m.data === "string" ? m.data : JSON.stringify(m.data);
        const targets =
          m.to === "*"
            ? sockets
            : Array.isArray(m.to)
              ? m.to.map((id) => byId.get(id)).filter((s): s is WebSocket => Boolean(s))
              : [byId.get(m.to)].filter((s): s is WebSocket => Boolean(s));
        for (const t of targets) {
          try {
            t.send(data);
          } catch {
            /* socket closed mid-fan-out; its close handler will clean up */
          }
        }
      }
    }

    if (wakeIn === null) {
      await this.ctx.storage.deleteAlarm();
    } else if (typeof wakeIn === "number") {
      // Earliest wins: a stream of position updates must not keep pushing a
      // pending tick into the future.
      const target = Date.now() + wakeIn;
      const pending = await this.ctx.storage.getAlarm();
      if (pending === null || pending > target) await this.ctx.storage.setAlarm(target);
    }
  }
}
