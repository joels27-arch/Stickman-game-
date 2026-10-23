// The authoritative game room. Transport-agnostic: the Node server, the
// Cloudflare Durable Object and the in-browser practice mode all drive this same
// class through `Conn` objects and `update()` calls.

import { BOT_NAMES, BotBrain } from '../shared/bot';
import { botCos, sanitizeCos, type Cosmetics } from '../shared/cosmetics';
import { Ev, MAX_PLAYERS, Mode, PROTOCOL_VERSION, SNAPSHOT_EVERY, TICK_RATE } from '../shared/constants';
import { getMap, hasMap, MAP_META } from '../shared/maps';
import { planRound, rankRace, rankSurvival, type RoundPlan } from '../shared/match';
import { rng } from '../shared/math';
import { type Input, NO_INPUT, PState, placeAtSpawn, shovePlayers, stepPlayer } from '../shared/player';
import {
  type ClientMsg, decodeInputs, encodePlayersBlock, encodeSnapshot, type LobbyPlayer, type Phase, type RankEntry,
  type Rewards, type RoomSettings, type RoundInfo, sanitizeName, SF_BOT, SF_GROUNDED, type ServerMsg, type SnapPlayer,
} from '../shared/protocol';
import { World } from '../shared/world';

export interface Conn { send(data: string | Uint8Array): void; close(code?: number, reason?: string): void }

export interface MatchSummary {
  rounds: number; qualified: number; final: boolean; won: boolean; place: number; players: number;
  dives: number; bounces: number; knocks: number; finishes: number; survived: number;
}

export interface RoomEnv {
  now(): number;
  randomHex(bytes: number): string;
  log?(msg: string): void;
  /** Persist rewards for a profile token; returns what was granted. */
  grantRewards?(token: string, s: MatchSummary): Promise<Rewards | null>;
  /** Load a profile (name, level, owned cosmetics) for a token. */
  loadProfile?(token: string): Promise<{ name: string; level: number; cos: Cosmetics } | null>;
  /** Called when lobby-visible info changes (public directory). */
  onChange?(room: Room): void;
}

export const INTRO_TICKS = 4 * TICK_RATE;
export const COUNTDOWN_TICKS = 3 * TICK_RATE;
export const ROUND_END_TICKS = 6 * TICK_RATE;
export const MATCH_END_TICKS = 11 * TICK_RATE;
const DISCONNECT_GRACE_TICKS = 20 * TICK_RATE;
const LOBBY_GRACE_MS = 15000;
const PUBLIC_WAIT_MS = 20000;
const HEARTBEAT_TIMEOUT_MS = 12000;

interface RPlayer {
  id: number; name: string; bot: boolean; conn: Conn | null; secret: string; token: string | null;
  cos: Cosmetics; level: number; ready: boolean; joinOrder: number;
  status: LobbyPlayer['status'];
  state: PState; slot: number; inRound: boolean;
  inputs: Map<number, Input>; lastInput: Input; lastAck: number; lastRecvTick: number; late: number;
  ev: number;
  disconnectedTick: number | null; disconnectedAt: number | null; lastSeen: number;
  finishTime: number | null; outTick: number | null; outY: number;
  brain: BotBrain | null;
  summary: MatchSummary; rewarded: boolean;
  msgBudget: number; lastEmote: number;
}

const newSummary = (): MatchSummary => ({ rounds: 0, qualified: 0, final: false, won: false, place: 0, players: 0, dives: 0, bounces: 0, knocks: 0, finishes: 0, survived: 0 });

export class Room {
  readonly players = new Map<number, RPlayer>();
  private conns = new Map<Conn, RPlayer | null>();
  phase: Phase = 'lobby';
  settings: RoomSettings;
  hostId = -1;
  tick = 0;
  private t0: number;
  private phaseEndTick = 0;
  world: World | null = null;
  round: RoundInfo | null = null;
  private plan: RoundPlan | null = null;
  private roundIdx = 0;
  private usedMaps: string[] = [];
  private seed = 1;
  private placeCounter = 0;
  private outOrder: number[] = [];
  private joinCounter = 0;
  private publicStartAt: number | null = null;
  private matchRanking: RankEntry[] = [];
  private finalists: number[] = [];
  emptySince: number | null;
  destroyed = false;
  stats = { ticks: 0, tickMs: 0, maxTickMs: 0, bytesOut: 0, msgsOut: 0, lateInputs: 0 };

  constructor(readonly code: string, readonly env: RoomEnv, isPublic = false) {
    this.t0 = env.now();
    this.emptySince = env.now();
    this.settings = { fillBots: isPublic ? 12 : 0, mode: 'tournament', map: 'rainbow', isPublic };
  }

  // ------------------------------------------------------------ connections

  get humanCount() { let n = 0; for (const p of this.players.values()) if (!p.bot) n++; return n; }
  get connectedHumans() { let n = 0; for (const p of this.players.values()) if (!p.bot && p.conn) n++; return n; }
  get joinable() { return !this.destroyed && this.humanCount < MAX_PLAYERS; }

  open(conn: Conn) { this.conns.set(conn, null); }

  close(conn: Conn) {
    const p = this.conns.get(conn);
    this.conns.delete(conn);
    if (!p || p.conn !== conn) return;
    p.conn = null;
    p.disconnectedAt = this.env.now();
    p.disconnectedTick = this.tick;
    this.reassignHost();
    this.broadcastRoom();
  }

  message(conn: Conn, data: string | Uint8Array) {
    const p = this.conns.get(conn) ?? null;
    if (typeof data !== 'string') {
      if (p) this.handleInputs(p, data);
      return;
    }
    if (data.length > 4096) return;
    let msg: ClientMsg;
    try { msg = JSON.parse(data); } catch { return; }
    if (!msg || typeof msg !== 'object' || typeof (msg as any).t !== 'string') return;
    if (p) {
      p.lastSeen = this.env.now();
      if (--p.msgBudget < 0) return; // rate limit
    }
    if (msg.t === 'hello') { this.hello(conn, msg); return; }
    if (!p) return;
    switch (msg.t) {
      case 'ping': this.send(p, { t: 'pong', c: Number(msg.c) || 0, s: this.tick }); break;
      case 'ready': if (this.phase === 'lobby') { p.ready = !!msg.on; this.broadcastRoom(); } break;
      case 'settings': this.applySettings(p, msg.s); break;
      case 'start': if (p.id === this.hostId && this.phase === 'lobby' && !this.settings.isPublic) this.startMatch(); break;
      case 'emote': {
        const e = Number(msg.e) | 0;
        if (e >= 0 && e < 8 && this.tick - p.lastEmote > TICK_RATE) { p.lastEmote = this.tick; this.broadcast({ t: 'emote', id: p.id, e }); }
        break;
      }
      case 'kick': {
        if (p.id !== this.hostId || this.settings.isPublic) break;
        const target = this.players.get(Number(msg.id));
        if (target && target !== p && !target.bot) {
          if (target.conn) { this.sendTo(target.conn, { t: 'error', code: 'kicked', msg: 'The host removed you from the room.' }); target.conn.close(4001, 'kicked'); }
          this.removePlayer(target);
        }
        break;
      }
      case 'leave': this.removePlayer(p); conn.close(1000, 'left'); break;
    }
  }

  private hello(conn: Conn, msg: Extract<ClientMsg, { t: 'hello' }>) {
    if (msg.v !== PROTOCOL_VERSION) {
      this.sendTo(conn, { t: 'error', code: 'bad_version', msg: 'The game was updated. Please reload the page.' });
      conn.close(4000, 'version');
      return;
    }
    if (this.conns.get(conn)) return; // already joined
    const now = this.env.now();
    // Resume an existing seat (page refresh / network drop).
    if (typeof msg.resume === 'string' && msg.resume.length >= 16) {
      for (const p of this.players.values()) {
        if (!p.bot && p.secret === msg.resume) {
          if (p.conn && p.conn !== conn) { this.sendTo(p.conn, { t: 'error', code: 'replaced', msg: 'You joined this room from another tab.' }); p.conn.close(4002, 'replaced'); this.conns.delete(p.conn); }
          p.conn = conn; p.disconnectedAt = null; p.disconnectedTick = null; p.lastSeen = now;
          this.conns.set(conn, p);
          this.sendTo(conn, { t: 'welcome', you: p.id, secret: p.secret, code: this.code, tick: this.tick, resumed: true });
          this.reassignHost();
          this.broadcastRoom();
          if (this.round && this.phase !== 'lobby' && this.phase !== 'matchEnd') this.sendTo(conn, { t: 'round', r: this.roundInfoNow() });
          return;
        }
      }
    }
    // Same profile already in the room: take over that seat instead of duplicating the player.
    const token = typeof msg.token === 'string' && /^[0-9a-f]{32,128}$/.test(msg.token) ? msg.token : null;
    if (token && !msg.guest) {
      for (const p of this.players.values()) {
        if (p.token === token && !p.bot) {
          if (p.conn) { this.sendTo(p.conn, { t: 'error', code: 'replaced', msg: 'You joined this room from another tab or device.' }); p.conn.close(4002, 'replaced'); this.conns.delete(p.conn); }
          p.conn = conn; p.disconnectedAt = null; p.disconnectedTick = null; p.lastSeen = now;
          this.conns.set(conn, p);
          this.sendTo(conn, { t: 'welcome', you: p.id, secret: p.secret, code: this.code, tick: this.tick, resumed: true });
          this.reassignHost();
          this.broadcastRoom();
          if (this.round && this.phase !== 'lobby' && this.phase !== 'matchEnd') this.sendTo(conn, { t: 'round', r: this.roundInfoNow() });
          return;
        }
      }
    }
    if (!this.joinable) {
      this.sendTo(conn, { t: 'error', code: 'room_full', msg: 'This room is full (30 players).' });
      conn.close(4003, 'full');
      return;
    }
    const id = this.freeId();
    if (id < 0) { this.sendTo(conn, { t: 'error', code: 'room_full', msg: 'This room is full.' }); conn.close(4003, 'full'); return; }
    const p: RPlayer = {
      id, name: sanitizeName(msg.name) || `Player ${id + 1}`, bot: false, conn, secret: this.env.randomHex(16), token: msg.guest ? null : token,
      cos: sanitizeCos(msg.cos), level: 1, ready: false, joinOrder: this.joinCounter++,
      status: this.phase === 'lobby' ? 'lobby' : 'spectator',
      state: new PState(), slot: 0, inRound: false,
      inputs: new Map(), lastInput: NO_INPUT, lastAck: 0, lastRecvTick: 0, late: 0, ev: 0,
      disconnectedTick: null, disconnectedAt: null, lastSeen: now,
      finishTime: null, outTick: null, outY: 0, brain: null, summary: newSummary(), rewarded: false,
      msgBudget: 60, lastEmote: -1000,
    };
    p.state.mode = Mode.Out;
    this.players.set(id, p);
    this.conns.set(conn, p);
    this.emptySince = null;
    if (this.publicStartAt === null && this.settings.isPublic && this.phase === 'lobby') this.publicStartAt = now + PUBLIC_WAIT_MS;
    this.sendTo(conn, { t: 'welcome', you: id, secret: p.secret, code: this.code, tick: this.tick, resumed: false });
    this.reassignHost();
    this.broadcastRoom();
    if (this.round && this.phase !== 'lobby' && this.phase !== 'matchEnd') this.sendTo(conn, { t: 'round', r: this.roundInfoNow() });
    // Server-side profile: authoritative name/level/cosmetics.
    if (p.token && this.env.loadProfile) {
      this.env.loadProfile(p.token).then((prof) => {
        if (!prof || !this.players.has(p.id)) return;
        p.name = sanitizeName(prof.name) || p.name; p.level = prof.level; p.cos = prof.cos;
        this.broadcastRoom();
      }).catch(() => {});
    }
    this.env.onChange?.(this);
  }

  private freeId(): number {
    for (let i = 0; i < 250; i++) if (!this.players.has(i)) return i;
    return -1;
  }

  private removePlayer(p: RPlayer) {
    if (p.conn) this.conns.set(p.conn, null);
    if (this.round && p.inRound && p.state.mode !== Mode.Out) this.eliminate(p, 'left');
    this.grant(p);
    this.players.delete(p.id);
    this.reassignHost();
    this.broadcastRoom();
    this.env.onChange?.(this);
  }

  private reassignHost() {
    const cur = this.players.get(this.hostId);
    if (cur && cur.conn && !cur.bot) return;
    let best: RPlayer | null = null;
    for (const p of this.players.values()) if (!p.bot && p.conn && (!best || p.joinOrder < best.joinOrder)) best = p;
    if (!best && cur && !cur.bot) return; // host briefly offline and nobody else: keep
    this.hostId = best ? best.id : -1;
  }

  private applySettings(p: RPlayer, s: Partial<RoomSettings> | undefined) {
    if (!s || p.id !== this.hostId || this.phase !== 'lobby' || this.settings.isPublic) return;
    if (typeof s.fillBots === 'number' && Number.isFinite(s.fillBots)) this.settings.fillBots = Math.max(0, Math.min(MAX_PLAYERS, Math.round(s.fillBots)));
    if (s.mode === 'tournament' || s.mode === 'single') this.settings.mode = s.mode;
    if (typeof s.map === 'string' && hasMap(s.map)) this.settings.map = s.map;
    this.broadcastRoom();
  }

  // ------------------------------------------------------------ match flow

  startMatch() {
    if (this.phase !== 'lobby') return;
    const humans = [...this.players.values()].filter((p) => !p.bot && p.conn);
    if (humans.length === 0) return;
    for (const p of [...this.players.values()]) if (p.bot) this.players.delete(p.id);
    this.seed = (parseInt(this.env.randomHex(4), 16) >>> 0) || 1;
    const r = rng(this.seed);
    const botsWanted = Math.max(0, Math.min(MAX_PLAYERS, this.settings.fillBots) - humans.length);
    const names = [...BOT_NAMES].sort(() => r() - 0.5);
    for (let i = 0; i < botsWanted; i++) {
      const id = this.freeId();
      if (id < 0) break;
      const bp: RPlayer = {
        id, name: names[i % names.length], bot: true, conn: null, secret: '', token: null, cos: botCos(r), level: 1 + Math.floor(r() * 20),
        ready: true, joinOrder: 1e6 + i, status: 'alive', state: new PState(), slot: 0, inRound: false,
        inputs: new Map(), lastInput: NO_INPUT, lastAck: 0, lastRecvTick: 0, late: 0, ev: 0,
        disconnectedTick: null, disconnectedAt: null, lastSeen: 0, finishTime: null, outTick: null, outY: 0,
        brain: new BotBrain((this.seed + id * 977) >>> 0), summary: newSummary(), rewarded: true, msgBudget: 0, lastEmote: 0,
      };
      this.players.set(id, bp);
    }
    for (const p of this.players.values()) {
      p.status = p.bot || p.conn ? 'alive' : 'spectator';
      p.summary = newSummary(); p.rewarded = p.bot;
      p.summary.players = 0;
    }
    const n = [...this.players.values()].filter((p) => p.status === 'alive').length;
    for (const p of this.players.values()) p.summary.players = n;
    this.roundIdx = 0;
    this.usedMaps = [];
    this.matchRanking = [];
    this.finalists = [];
    this.publicStartAt = null;
    this.startRound();
    this.env.onChange?.(this);
  }

  private aliveIds(): number[] { return [...this.players.values()].filter((p) => p.status === 'alive').map((p) => p.id); }

  private startRound() {
    const ids = this.aliveIds();
    if (ids.length === 0) { this.toLobby(); return; }
    const plan: RoundPlan = this.settings.mode === 'single'
      ? { map: this.settings.map, final: true, qualify: 1 }
      : planRound(ids.length, this.roundIdx, this.usedMaps, MAP_META, this.seed);
    if (ids.length === 1 && this.settings.mode === 'tournament' && this.roundIdx > 0) { this.endMatch(ids[0]); return; }
    this.plan = plan;
    this.usedMaps.push(plan.map);
    const map = getMap(plan.map);
    this.world = new World(map);
    // Shuffle spawn slots so the same player isn't always at the front.
    const r = rng((this.seed + this.roundIdx * 7) >>> 0);
    const order = [...ids].sort(() => r() - 0.5);
    order.forEach((id, slot) => {
      const p = this.players.get(id)!;
      p.slot = slot; p.inRound = true;
      placeAtSpawn(map, p.state, slot);
      p.inputs.clear(); p.lastInput = NO_INPUT; p.finishTime = null; p.outTick = null; p.ev = 0;
      p.brain?.resync(p.state, map);
      p.summary.rounds++;
      if (plan.final) p.summary.final = true;
    });
    for (const p of this.players.values()) if (!ids.includes(p.id)) { p.inRound = false; p.state.mode = Mode.Out; }
    this.placeCounter = 0;
    this.outOrder = [];
    const introTick = this.tick;
    const goTick = introTick + INTRO_TICKS + COUNTDOWN_TICKS;
    this.round = {
      index: this.roundIdx, map: plan.map, final: plan.final, qualify: Math.min(plan.qualify, ids.length),
      participants: ids, slots: ids.map((id) => this.players.get(id)!.slot), introTick, goTick, endTick: goTick + map.timeLimit * TICK_RATE, triggered: [],
    };
    if (plan.final) this.finalists = [...ids];
    this.phase = 'intro';
    this.broadcast({ t: 'round', r: this.round });
    this.broadcastRoom();
  }

  private roundInfoNow(): RoundInfo {
    const r = this.round!;
    return { ...r, triggered: [...(this.world?.triggered ?? new Map()).entries()] };
  }

  private relTick() { return this.tick - (this.round?.goTick ?? 0); }

  private eliminate(p: RPlayer, why: 'fell' | 'time' | 'left' | 'cut') {
    if (p.status !== 'alive') return;
    p.status = 'eliminated';
    p.outTick = this.tick;
    p.outY = p.state.y;
    p.state.mode = Mode.Out;
    this.outOrder.push(p.id);
    this.broadcast({ t: 'elim', id: p.id, place: 0, why });
  }

  private qualify(p: RPlayer) {
    if (p.status !== 'alive') return;
    p.status = 'qualified';
    this.placeCounter++;
    p.summary.finishes++;
    this.broadcast({ t: 'qual', id: p.id, place: this.placeCounter });
  }

  private simulate() {
    const world = this.world!, round = this.round!;
    const rel = this.relTick();
    const canMove = this.tick >= round.goTick;
    const map = world.map;
    const respawn = map.mode === 'race';
    const active: RPlayer[] = [];
    for (const id of round.participants) {
      const p = this.players.get(id);
      if (!p || p.status !== 'alive' || p.state.mode === Mode.Out) continue;
      active.push(p);
    }
    for (const p of active) {
      let inp: Input;
      if (p.bot) inp = p.brain!.think(p.state, world, rel);
      else if (!p.conn) inp = NO_INPUT;
      else {
        const got = p.inputs.get(this.tick);
        if (got) { p.lastInput = got; p.inputs.delete(this.tick); inp = got; }
        else inp = p.lastInput;
      }
      const ev = stepPlayer(p.state, inp, { world, tick: rel, slot: p.slot, canMove, respawn });
      p.lastAck = this.tick;
      if (ev) {
        p.ev |= ev;
        if (ev & Ev.Dive) p.summary.dives++;
        if (ev & Ev.Bounce) p.summary.bounces++;
        if (ev & Ev.Knock) p.summary.knocks++;
      }
      if (ev & Ev.Finish) {
        p.finishTime = this.tick - 1 + p.state.finishFrac;
      }
      if ((ev & Ev.FellOut) && !respawn) this.eliminate(p, 'fell');
      // Step-triggered tiles.
      if (p.state.grounded && p.state.groundId >= 0) {
        const b = world.bodies[p.state.groundId];
        if (b.def.trigger && !world.triggered.has(b.id)) {
          world.setTriggered(b.id, rel);
          this.broadcast({ t: 'tile', id: b.id, tick: rel });
        }
      }
    }
    // Finishers this tick, ordered by exact crossing time (simultaneous finishes are deterministic).
    const finishers = active.filter((p) => p.finishTime !== null && p.status === 'alive')
      .sort((a, b) => a.finishTime! - b.finishTime! || a.id - b.id);
    for (const p of finishers) {
      if (this.placeCounter < round.qualify) this.qualify(p);
      else this.eliminate(p, 'cut'); // crossed the line in the same tick the last spot was taken
    }
    // Respawning tiles.
    for (const [id, t0] of world.triggered) {
      const d = world.bodies[id].def.trigger!;
      if (d.respawn !== undefined && rel > t0 + (d.delay + 2.5 + d.respawn) * TICK_RATE) {
        world.setTriggered(id, undefined);
        this.broadcast({ t: 'tile', id, tick: null });
      }
    }
    // Player–player shoves (O(n²) is fine for 30).
    for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
      const r = shovePlayers(active[i].state, active[j].state);
      if (r === 2) active[j].ev |= Ev.Knock;
      else if (r === 1) active[i].ev |= Ev.Knock;
    }
    // Disconnected too long → out.
    for (const p of active) if (!p.bot && !p.conn && p.disconnectedTick !== null && this.tick - p.disconnectedTick > DISCONNECT_GRACE_TICKS) this.eliminate(p, 'left');
  }

  private checkRoundEnd(): boolean {
    const round = this.round!, map = this.world!.map;
    const parts = round.participants.map((id) => this.players.get(id)).filter((p): p is RPlayer => !!p);
    const alive = parts.filter((p) => p.status === 'alive');
    const qualified = parts.filter((p) => p.status === 'qualified');
    if (map.mode === 'race') {
      if (qualified.length >= round.qualify) return true;
      if (alive.length === 0) return true;
      // Everyone still running is a disconnected human: don't wait for them.
      if (alive.every((p) => !p.bot && !p.conn)) return true;
    } else {
      // Solo practice in a survival map: last until the timer (or until you fall).
      if (parts.length <= round.qualify) { if (alive.length === 0) return true; }
      else if (alive.length <= round.qualify) return true;
    }
    return this.tick >= round.endTick;
  }

  private endRound() {
    const round = this.round!, map = this.world!.map;
    const parts = round.participants.map((id) => this.players.get(id)).filter((p): p is RPlayer => !!p);
    let qualified: number[];
    let ranking: RankEntry[];
    if (map.mode === 'race') {
      const ranked = rankRace(parts.map((p) => ({ id: p.id, finishTime: p.status === 'qualified' ? p.finishTime : null, progress: p.state.cp * 1000 + p.state.z })), this.seed);
      const finishers = ranked.filter((r) => r.finishTime !== null).map((r) => r.id);
      qualified = finishers.slice(0, round.qualify);
      if (qualified.length === 0 && ranked.length) {
        // Nobody made it: the furthest runner goes through so the match always has a winner.
        const best = ranked.find((r) => this.players.get(r.id)?.status !== 'eliminated') ?? ranked[0];
        qualified = [best.id];
      }
      ranking = ranked.map((r, i) => ({ id: r.id, place: i + 1, result: qualified.includes(r.id) ? (round.final ? 'winner' : 'qualified') : 'eliminated', score: r.finishTime !== null ? (r.finishTime - round.goTick) / TICK_RATE : undefined }));
    } else {
      const ranked = rankSurvival(parts.map((p) => ({ id: p.id, outTick: p.status === 'alive' || p.status === 'qualified' ? null : p.outTick ?? 0, outY: p.outY })), this.seed);
      const aliveCount = parts.filter((p) => p.status === 'alive').length;
      const n = round.final ? 1 : Math.max(aliveCount, Math.min(round.qualify, ranked.length));
      qualified = ranked.slice(0, Math.max(1, Math.min(n, ranked.length))).map((r) => r.id);
      ranking = ranked.map((r, i) => ({ id: r.id, place: i + 1, result: qualified.includes(r.id) ? (round.final ? 'winner' : 'qualified') : 'eliminated', score: r.outTick !== null ? (r.outTick - round.goTick) / TICK_RATE : undefined }));
    }
    const eliminated = parts.map((p) => p.id).filter((id) => !qualified.includes(id));
    for (const id of qualified) {
      const p = this.players.get(id)!;
      p.status = 'alive';
      p.summary.qualified++;
      if (map.mode === 'survival') p.summary.survived++;
    }
    for (const id of eliminated) this.players.get(id)!.status = 'eliminated';
    // Overall standings: this round's eliminated players rank right below everyone still in.
    ranking.filter((r) => eliminated.includes(r.id)).forEach((r, k) => {
      const place = qualified.length + 1 + k;
      this.matchRanking.push({ id: r.id, place, result: 'eliminated' });
      const p = this.players.get(r.id);
      if (p) p.summary.place = place;
    });
    const next = !round.final && qualified.length > 1;
    this.broadcast({ t: 'roundEnd', qualified, eliminated, ranking, next });
    this.phase = 'roundEnd';
    this.phaseEndTick = this.tick + ROUND_END_TICKS;
    for (const p of this.players.values()) p.state.mode = Mode.Out;
    this.broadcastRoom();
  }

  private endMatch(winner: number | null) {
    this.phase = 'matchEnd';
    this.phaseEndTick = this.tick + MATCH_END_TICKS;
    if (winner !== null) {
      const w = this.players.get(winner);
      if (w) { w.summary.won = true; w.summary.place = 1; }
      this.matchRanking.push({ id: winner, place: 1, result: 'winner' });
    }
    this.matchRanking.sort((a, b) => a.place - b.place);
    this.broadcast({ t: 'matchEnd', winner, ranking: this.matchRanking });
    for (const p of this.players.values()) this.grant(p);
    this.broadcastRoom();
    this.env.onChange?.(this);
  }

  private grant(p: RPlayer) {
    if (p.rewarded || p.bot || !p.token || p.summary.rounds === 0) return;
    p.rewarded = true;
    const conn = p.conn;
    this.env.grantRewards?.(p.token, { ...p.summary }).then((r) => {
      if (r && conn && p.conn === conn) this.sendTo(conn, { t: 'rewards', r });
    }).catch((e) => this.env.log?.(`grant failed: ${e}`));
  }

  private toLobby() {
    this.phase = 'lobby';
    this.round = null; this.world = null; this.plan = null;
    for (const p of [...this.players.values()]) {
      if (p.bot) { this.players.delete(p.id); continue; }
      p.status = 'lobby'; p.ready = false; p.inRound = false; p.state.mode = Mode.Out;
    }
    if (this.settings.isPublic && this.connectedHumans > 0) this.publicStartAt = this.env.now() + PUBLIC_WAIT_MS;
    this.reassignHost();
    this.broadcastRoom();
    this.env.onChange?.(this);
  }

  // ------------------------------------------------------------ ticking

  /** Advance the simulation to the current wall-clock time. Call often (≥ 60 Hz is ideal). */
  update() {
    if (this.destroyed) return;
    const now = this.env.now();
    let target = Math.floor(((now - this.t0) * TICK_RATE) / 1000);
    if (target - this.tick > 10) { // we fell behind (host paused): skip ahead rather than spiral
      this.t0 = now - ((this.tick + 1) * 1000) / TICK_RATE;
      target = this.tick + 1;
    }
    while (this.tick < target) this.step();
    this.housekeeping(now);
  }

  private step() {
    const t0 = this.env.now();
    this.tick++;
    for (const p of this.players.values()) if (p.msgBudget < 60) p.msgBudget += 0.75;
    if (this.round && this.world && (this.phase === 'intro' || this.phase === 'countdown' || this.phase === 'play')) {
      if (this.phase === 'intro' && this.tick >= this.round.goTick - COUNTDOWN_TICKS) this.phase = 'countdown';
      if (this.phase === 'countdown' && this.tick >= this.round.goTick) this.phase = 'play';
      this.simulate();
      if (this.phase === 'play' && this.checkRoundEnd()) this.endRound();
      else if (this.tick % SNAPSHOT_EVERY === 0) this.sendSnapshots();
    } else if (this.phase === 'roundEnd' && this.tick >= this.phaseEndTick) {
      const alive = this.aliveIds();
      if (this.round?.final || alive.length <= 1 || this.settings.mode === 'single') this.endMatch(alive.length ? alive[0] : null);
      else { this.roundIdx++; this.startRound(); }
    } else if (this.phase === 'matchEnd' && this.tick >= this.phaseEndTick) {
      this.toLobby();
    }
    const dt = this.env.now() - t0;
    this.stats.ticks++; this.stats.tickMs += dt; if (dt > this.stats.maxTickMs) this.stats.maxTickMs = dt;
  }

  private housekeeping(now: number) {
    if (this.tick % 30 !== 0) return;
    for (const p of [...this.players.values()]) {
      if (p.bot) continue;
      // Heartbeat timeout: a socket that stopped talking is treated as disconnected.
      if (p.conn && now - p.lastSeen > HEARTBEAT_TIMEOUT_MS) { const c = p.conn; this.close(c); c.close(4004, 'timeout'); }
      if (!p.conn && p.disconnectedAt !== null && this.phase === 'lobby' && now - p.disconnectedAt > LOBBY_GRACE_MS) this.removePlayer(p);
      if (!p.conn && p.disconnectedAt !== null && now - p.disconnectedAt > 120000) this.removePlayer(p);
    }
    if (this.connectedHumans === 0) { if (this.emptySince === null) this.emptySince = now; }
    else this.emptySince = null;
    if (this.settings.isPublic && this.phase === 'lobby' && this.publicStartAt !== null) {
      if (this.connectedHumans === 0) this.publicStartAt = null;
      else if (now >= this.publicStartAt || this.humanCount >= MAX_PLAYERS) this.startMatch();
    }
    // Public lobbies broadcast a once-per-second countdown.
    if (this.settings.isPublic && this.phase === 'lobby' && this.tick % 60 === 0) this.broadcastRoom();
  }

  // ------------------------------------------------------------ networking

  private handleInputs(p: RPlayer, data: Uint8Array) {
    const d = decodeInputs(data);
    if (!d || p.bot) return;
    p.lastSeen = this.env.now();
    const { firstTick, inputs } = d;
    for (let k = 0; k < inputs.length; k++) {
      const t = firstTick + k;
      if (t <= this.tick) { p.late++; this.stats.lateInputs++; continue; }
      if (t > this.tick + 120) continue;
      if (p.inputs.size < 240) p.inputs.set(t, inputs[k]);
    }
    const last = firstTick + inputs.length - 1;
    if (last > p.lastRecvTick || last < this.tick - 600) p.lastRecvTick = last;
    // prune stale entries
    if (p.inputs.size > 200) for (const t of p.inputs.keys()) if (t <= this.tick) p.inputs.delete(t);
  }

  private sendSnapshots() {
    const round = this.round!;
    const list: SnapPlayer[] = [];
    for (const id of round.participants) {
      const p = this.players.get(id);
      if (!p || p.state.mode === Mode.Out) { if (p) p.ev = 0; continue; }
      const s = p.state;
      list.push({ id: p.id, mode: s.mode, flags: (s.grounded ? SF_GROUNDED : 0) | (p.bot ? SF_BOT : 0), ev: p.ev, x: s.x, y: s.y, z: s.z, yaw: s.yaw, ground: s.grounded ? s.groundId : -1 });
      p.ev = 0;
    }
    const block = encodePlayersBlock(list);
    for (const [conn, p] of this.conns) {
      if (!p) continue;
      const own = p.inRound ? p.state : null;
      const pkt = encodeSnapshot(this.tick, own ? p.lastAck : 0, p.lastRecvTick - this.tick, own, block);
      this.raw(conn, pkt);
    }
  }

  private lobbyPlayers(): LobbyPlayer[] {
    return [...this.players.values()].sort((a, b) => a.joinOrder - b.joinOrder).map((p) => ({
      id: p.id, name: p.name, cos: p.cos, ready: p.ready, bot: p.bot, connected: p.bot || !!p.conn, level: p.level, status: p.status,
    }));
  }

  broadcastRoom() {
    const startsIn = this.settings.isPublic && this.publicStartAt !== null && this.phase === 'lobby' ? Math.max(0, Math.ceil((this.publicStartAt - this.env.now()) / 1000)) : undefined;
    this.broadcast({ t: 'room', code: this.code, host: this.hostId, phase: this.phase, settings: this.settings, players: this.lobbyPlayers(), startsIn });
  }

  private broadcast(msg: ServerMsg) {
    const s = JSON.stringify(msg);
    for (const [conn, p] of this.conns) if (p) this.raw(conn, s);
  }
  private send(p: RPlayer, msg: ServerMsg) { if (p.conn) this.raw(p.conn, JSON.stringify(msg)); }
  private sendTo(conn: Conn, msg: ServerMsg) { this.raw(conn, JSON.stringify(msg)); }
  private raw(conn: Conn, data: string | Uint8Array) {
    try {
      conn.send(data);
      this.stats.bytesOut += typeof data === 'string' ? data.length : data.byteLength;
      this.stats.msgsOut++;
    } catch { /* socket already gone; close handler will clean up */ }
  }

  /** Public directory entry. */
  info() {
    return { code: this.code, players: this.humanCount, max: MAX_PLAYERS, phase: this.phase, isPublic: this.settings.isPublic, startsIn: this.publicStartAt ? Math.max(0, Math.ceil((this.publicStartAt - this.env.now()) / 1000)) : null };
  }

  destroy() {
    this.destroyed = true;
    for (const conn of this.conns.keys()) { try { conn.close(1001, 'room closed'); } catch { /* ignore */ } }
    this.conns.clear();
  }
}

