/**
 * The Worker entry — everything that is not a static file lands here.
 *
 * Its whole job is routing a WebSocket upgrade to the right room. Static files
 * (`dist/client`) are served by the platform BEFORE this runs.
 *
 * The `Room` re-export is required: a Durable Object class must be exported from
 * the Worker's entry module or the class does not ship and the deploy fails.
 */

import type { Env } from "./env";
import { Room } from "./room";

export { Room };

/** `/ws` and `/ws/<room>` — the only server-side route a game has by default. */
const WS_PREFIX = "/ws";

/** Room names come from the URL: keep them short and boring. */
const ROOM_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DEFAULT_ROOM = "main";

// ── cloud save ─────────────────────────────────────────────────────────────
// A player's progress, stored under their save code. The code is the key (12 letters/digits, about
// 60 bits: not guessable); the storage name is its SHA-256, so the code itself is never stored.
// One Durable Object per save ("save:<hash>"; room names can't contain ":", so they never mix).
//   POST /api/save {code?, data}  -> {code, at}   (no code: a new one is made)
//   GET  /api/save?code=XXXX      -> {data, at}   (404 if there's no save)
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I mix-ups
const CODE_RE = /^[A-HJ-NP-Z2-9]{12}$/;
const SAVE_MAX = 200_000; // bytes of progress (it's ~10 KB in practice)

function cleanCode(raw: unknown): string | null {
  const c = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return CODE_RE.test(c) ? c : null;
}

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

async function saveStub(env: Env, code: string): Promise<DurableObjectStub> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("lane-rush-save:" + code));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return env.ROOMS.get(env.ROOMS.idFromName("save:" + hex));
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function handleSave(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method === "GET") {
    const code = cleanCode(url.searchParams.get("code"));
    if (!code) return json({ error: "That code isn't right" }, 400);
    const res = await (await saveStub(env, code)).fetch("https://save/__save/get");
    const save = (await res.json()) as { data: string; at: number } | null;
    return save ? json(save) : json({ error: "No save with that code" }, 404);
  }
  if (request.method === "POST") {
    const text = await request.text();
    if (text.length > SAVE_MAX + 200) return json({ error: "too big" }, 413);
    let body: { code?: unknown; data?: unknown };
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "bad request" }, 400);
    }
    if (typeof body.data !== "string" || body.data.length > SAVE_MAX) return json({ error: "bad save" }, 400);
    const code = body.code == null ? newCode() : cleanCode(body.code);
    if (!code) return json({ error: "That code isn't right" }, 400);
    const res = await (await saveStub(env, code)).fetch("https://save/__save/put", { method: "POST", body: JSON.stringify({ data: body.data }) });
    const { at } = (await res.json()) as { at: number };
    return json({ code, at });
  }
  return json({ error: "method not allowed" }, 405);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/save") {
      try {
        return await handleSave(request, env, url);
      } catch (err) {
        console.error("save failed:", err instanceof Error ? err.stack : String(err));
        return json({ error: "server error" }, 500);
      }
    }

    if (url.pathname === WS_PREFIX || url.pathname.startsWith(WS_PREFIX + "/")) {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("expected a websocket upgrade", { status: 426 });
      }
      const raw = url.pathname.slice(WS_PREFIX.length).replace(/^\/+/, "");
      const room = raw === "" ? DEFAULT_ROOM : raw;
      if (!ROOM_RE.test(room)) {
        return new Response("invalid room name", { status: 400 });
      }
      // One DO instance per room name: same code anywhere = same lobby.
      const id = env.ROOMS.idFromName(room);
      return env.ROOMS.get(id).fetch(request);
    }

    if (request.method === "GET" && request.headers.get("Accept")?.includes("text/html")) {
      return env.ASSETS.fetch(new Request(new URL("/", url), request));
    }
    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
