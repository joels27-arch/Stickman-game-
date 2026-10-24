/**
 * The Brain Run room, through real WebSockets in workerd: create a lobby,
 * join it by code, start, race, and the room wiping itself when empty.
 */

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function open(room: string) {
  const res = await SELF.fetch(`https://game.test/ws/${room}`, {
    headers: { Upgrade: "websocket" },
  });
  expect(res.status).toBe(101);
  const ws = res.webSocket;
  if (!ws) throw new Error("no webSocket on the upgrade response");
  ws.accept();

  const frames: any[] = [];
  ws.addEventListener("message", (event: MessageEvent) => {
    const data = typeof event.data === "string" ? event.data : "";
    if (data === "__pong") return;
    try {
      frames.push(JSON.parse(data));
    } catch {
      frames.push(data);
    }
  });

  const next = async (pred: (f: any) => boolean, label: string) => {
    for (let i = 0; i < 200; i++) {
      const idx = frames.findIndex(pred);
      if (idx >= 0) return frames.splice(idx, 1)[0];
      await scheduler.wait(10);
    }
    throw new Error(`timed out waiting for ${label}; got ${JSON.stringify(frames)}`);
  };

  return {
    ws,
    frames,
    send: (msg: unknown) => ws.send(JSON.stringify(msg)),
    act: (action: unknown) => ws.send(JSON.stringify({ type: "action", action })),
    /** next state frame whose view satisfies pred */
    view: (pred: (v: any) => boolean, label: string) =>
      next((f) => f?.type === "state" && f.view && pred(f.view), label).then((f) => f.view),
    error: () => next((f) => f?.type === "error", "an error frame"),
  };
}

let seq = 0;
const code = () => `T${(seq++).toString(36).toUpperCase()}${Date.now().toString(36).slice(-3).toUpperCase()}`;

async function player(room: string, id: string, name: string, create: boolean) {
  const c = await open(room);
  c.send({ type: "join", playerId: id });
  c.act({ type: "hello", name, char: 0, create });
  return c;
}

describe("lane rush room", () => {
  it("creates a lobby and lets friends join with the code", async () => {
    const room = code();
    const a = await player(room, "alice", "Alice", true);
    const va = await a.view((v) => v.joined, "alice joined");
    expect(va.host).toBe("alice");
    expect(va.phase).toBe("lobby");

    const b = await player(room, "bob", "Bob", false);
    const vb = await b.view((v) => v.players.length === 2, "bob sees two");
    expect(vb.players.map((p: any) => p.name)).toEqual(["Alice", "Bob"]);
    expect(new Set(vb.players.map((p: any) => p.char)).size).toBe(2);
    // alice is told about bob too
    await a.view((v) => v.players.length === 2, "alice sees bob");
  });

  it("refuses a code nobody created", async () => {
    const c = await player(code(), "zed", "Zed", false);
    expect((await c.error()).error).toMatch(/No lobby/);
  });

  it("refuses a second creator on a taken code", async () => {
    const room = code();
    const a = await player(room, "a1", "A", true);
    await a.view((v) => v.joined, "a joined");
    const b = await player(room, "b1", "B", true);
    expect((await b.error()).error).toBe("code taken");
  });

  it("refuses a fifth runner", async () => {
    const room = code();
    const ps = [];
    for (let i = 0; i < 4; i++) {
      const p = await player(room, `r${i}`, `R${i}`, i === 0);
      await p.view((v) => v.joined, `r${i} joined`);
      ps.push(p);
    }
    const late = await player(room, "r4", "Late", false);
    expect((await late.error()).error).toMatch(/full/);
  });

  it("runs countdown → race → results with server time", async () => {
    const room = code();
    const a = await player(room, "h", "Host", true);
    await a.view((v) => v.joined, "host joined");
    const b = await player(room, "g", "Guest", false);
    await b.view((v) => v.players.length === 2, "guest joined");

    b.act({ type: "start" });
    expect((await b.error()).error).toMatch(/host/);

    b.act({ type: "ready", ready: true });
    await a.view((v) => v.players.find((p: any) => p.id === "g")?.ready, "guest ready");
    a.act({ type: "start" });
    const cd = await a.view((v) => v.phase === "countdown", "countdown");
    expect(cd.startAt).toBeGreaterThan(Date.now());

    // the room's alarm flips the phase when the countdown ends
    await scheduler.wait(cd.startAt - Date.now() + 100);
    await b.view((v) => v.phase === "race", "race started");

    a.act({ type: "pos", d: 9999, lane: 0, y: 0, act: "run" });
    const capped = await b.view(
      (v) => v.players.find((p: any) => p.id === "h")?.d > 0,
      "host progress",
    );
    // a runner can't be 9999 m in after ~0.1 s
    expect(capped.players.find((p: any) => p.id === "h").d).toBeLessThan(20);
    expect(capped.players.find((p: any) => p.id === "h").finish).toBeNull();
  }, 15_000);

  it("wipes the room when the last player leaves, freeing the code", async () => {
    const room = code();
    const a = await player(room, "solo", "Solo", true);
    await a.view((v) => v.joined, "solo joined");
    a.ws.close();
    await scheduler.wait(100);
    const b = await player(room, "next", "Next", false);
    expect((await b.error()).error).toMatch(/No lobby/);
  });
});
