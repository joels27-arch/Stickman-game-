/**
 * Lane Rush rules, driven directly (no sockets): lobby capacity and codes,
 * host-only start, the anti-cheat distance cap, finishing order, and lobby
 * clean-up after a disconnect.
 */

import { describe, expect, it } from "vitest";

import * as L from "../src/logic.js";

type S = any;
const T0 = 1_700_000_000_000;

function act(s: S, who: string, action: Record<string, unknown>): S {
  const v = L.validateAction(s, who, action);
  if (!v.ok) throw new Error(`${who} ${String(action.type)}: ${v.error}`);
  return L.applyAction(s, who, action);
}
function reject(s: S, who: string, action: Record<string, unknown>): string {
  const v = L.validateAction(s, who, action);
  if (v.ok) throw new Error(`expected ${String(action.type)} to be rejected`);
  return v.error ?? "";
}
function lobbyOf(n: number): S {
  let s: S = L.setup([]);
  const names = ["Ann", "Bob", "Cy", "Di"];
  for (let i = 0; i < n; i++) {
    s = act(s, `p${i}`, { type: "hello", name: names[i], char: 0, create: i === 0, t: T0 + i });
  }
  return s;
}

describe("lobby", () => {
  it("needs an existing lobby to join, and a free code to create", () => {
    const empty = L.setup([]);
    expect(reject(empty, "x", { type: "hello", name: "X", char: 0, create: false })).toMatch(/No lobby/);
    const one = lobbyOf(1);
    expect(reject(one, "x", { type: "hello", name: "X", char: 0, create: true })).toBe("code taken");
  });

  it("holds at most four runners, each with a different character", () => {
    const s = lobbyOf(4);
    const view: S = L.viewFor(s, "p0");
    expect(view.players.map((p: S) => p.char).sort()).toEqual([0, 1, 2, 3]);
    expect(reject(s, "p4", { type: "hello", name: "Ed", char: 0, create: false, t: T0 })).toMatch(/full/);
  });

  it("only lets the host start", () => {
    const s = lobbyOf(2);
    expect(reject(s, "p1", { type: "start", t: T0 })).toMatch(/host/);
    const started = act(s, "p0", { type: "start", t: T0 + 10 });
    expect(started.phase).toBe("countdown");
    expect(started.startAt).toBe(T0 + 10 + L.COUNTDOWN_MS);
    expect(reject(started, "p3", { type: "hello", name: "Late", char: 0, create: false, t: T0 })).toMatch(/started/);
  });

  it("hands the crown on when the host drops, and evicts after the grace period", () => {
    let s = lobbyOf(3);
    s = L.applyAction(s, "p0", { type: "drop", t: T0 + 100 });
    expect(s.host).toBe("p1");
    expect(L.wakeAfter(s)).toBe(1000);
    s = L.applyAction(s, "__system", { type: "tick", t: T0 + 100 + L.LOBBY_GRACE_MS });
    expect(Object.keys(s.players)).toEqual(["p1", "p2"]);
    expect(s.players.p1.slot).toBe(0);
  });

  it("lets a dropped player come back within the grace period", () => {
    let s = lobbyOf(2);
    s = L.applyAction(s, "p1", { type: "drop", t: T0 + 100 });
    s = act(s, "p1", { type: "hello", name: "Bob", char: 1, create: false, t: T0 + 2000 });
    s = L.applyAction(s, "__system", { type: "tick", t: T0 + 100 + L.LOBBY_GRACE_MS });
    expect(Object.keys(s.players)).toEqual(["p0", "p1"]);
  });
});

describe("race", () => {
  function racing(n = 2): S {
    let s = act(lobbyOf(n), "p0", { type: "start", t: T0 });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
    expect(s.phase).toBe("race");
    return s;
  }
  const pos = (d: number, t: number) => ({ type: "pos", d, lane: 0, y: 0, act: "run", t });

  it("caps distance to what is physically possible and never goes backwards", () => {
    let s = racing();
    s = act(s, "p0", pos(500, s.startAt + 1000));
    expect(s.players.p0.d).toBeLessThan(30);
    s = act(s, "p0", pos(5, s.startAt + 1500));
    expect(s.players.p0.d).toBeGreaterThan(5);
  });

  it("starts the race on the first position after the gun even before the tick", () => {
    let s = act(lobbyOf(1), "p0", { type: "start", t: T0 });
    s = act(s, "p0", pos(3, s.startAt + 300));
    expect(s.phase).toBe("race");
    expect(s.players.p0.d).toBe(3);
  });

  it("records finish order and ends when everyone is home", () => {
    let s = racing(2);
    s = act(s, "p1", pos(L.TRACK_LEN, s.startAt + 50_000));
    expect(s.players.p1.finish).toBe(50_000);
    expect(s.phase).toBe("race");
    s = act(s, "p0", pos(L.TRACK_LEN, s.startAt + 52_000));
    expect(s.phase).toBe("results");
    expect(L.standings(s)).toEqual(["p1", "p0"]);
  });

  it("ends for stragglers after the post-win grace", () => {
    let s = racing(2);
    s = act(s, "p1", pos(L.TRACK_LEN, s.startAt + 50_000));
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt + 50_000 + L.AFTER_FIRST_MS });
    expect(s.phase).toBe("results");
  });

  it("rejects malformed positions", () => {
    const s = racing();
    expect(reject(s, "p0", { type: "pos", d: "far", lane: 0, y: 0, act: "run" })).toBeTruthy();
    expect(reject(s, "p0", { type: "pos", d: 1, lane: 7, y: 0, act: "run" })).toBeTruthy();
    expect(reject(s, "p0", { type: "pos", d: 1, lane: 0, y: 0, act: "fly" })).toBeTruthy();
    expect(reject(s, "p0", { type: "tick" })).toBeTruthy();
    expect(reject(s, "p0", { type: "drop" })).toBeTruthy();
  });

  it("goes back to the same lobby for a rematch", () => {
    let s = racing(2);
    s = act(s, "p0", pos(L.TRACK_LEN, s.startAt + 50_000));
    s = act(s, "p1", pos(L.TRACK_LEN, s.startAt + 51_000));
    expect(reject(s, "p1", { type: "again" })).toMatch(/host/);
    s = act(s, "p0", { type: "again", t: s.startAt + 60_000 });
    expect(s.phase).toBe("lobby");
    expect(s.players.p1.d).toBe(0);
    expect(s.players.p1.finish).toBeNull();
  });
});

describe("course", () => {
  it("is deterministic and always leaves a lane without crates", () => {
    expect(L.buildCourse(42)).toEqual(L.buildCourse(42));
    for (let seed = 0; seed < 300; seed++) {
      for (const row of L.buildCourse(seed * 7919).rows) {
        expect(row.lanes.filter((k) => k === "crate").length).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe("medals and countries", () => {
  const pos = (d: number, t: number) => ({ type: "pos", d, lane: 0, y: 0, act: "run", t });

  it("gives gold, silver and bronze to the podium and nothing to 4th", () => {
    let s: S = act(lobbyOf(4), "p0", { type: "start", t: T0 });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
    s = act(s, "p2", pos(L.TRACK_LEN, s.startAt + 50_000));
    s = act(s, "p0", pos(L.TRACK_LEN, s.startAt + 51_000));
    s = act(s, "p3", pos(L.TRACK_LEN, s.startAt + 52_000));
    s = act(s, "p1", pos(L.TRACK_LEN, s.startAt + 53_000));
    expect(s.phase).toBe("results");
    const r = (L.viewFor(s, "p0") as S).rewards;
    expect(r.p2).toEqual({ place: 1, medal: "gold" });
    expect(r.p0).toEqual({ place: 2, medal: "silver" });
    expect(r.p3).toEqual({ place: 3, medal: "bronze" });
    expect(r.p1).toEqual({ place: 4, medal: null });
  });

  it("gives no medal for not finishing, or for racing alone", () => {
    let s: S = act(lobbyOf(2), "p0", { type: "start", t: T0 });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
    s = act(s, "p1", pos(L.TRACK_LEN, s.startAt + 50_000));
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt + 50_000 + L.AFTER_FIRST_MS });
    const r = (L.viewFor(s, "p0") as S).rewards;
    expect(r.p1.medal).toBe("gold");
    expect(r.p0).toEqual({ place: 2, medal: null });

    let solo: S = act(lobbyOf(1), "p0", { type: "start", t: T0 });
    solo = act(solo, "p0", pos(L.TRACK_LEN, solo.startAt + 50_000));
    expect((L.viewFor(solo, "p0") as S).rewards.p0).toEqual({ place: 1, medal: null });
  });

  it("keeps a valid country and rejects made-up ones", () => {
    let s: S = L.setup([]);
    s = act(s, "a", { type: "hello", name: "Ann", char: 5, country: "DE", create: true, t: T0 });
    expect((L.viewFor(s, "a") as S).players[0]).toMatchObject({ char: 5, country: "DE" });
    expect(reject(s, "a", { type: "country", country: "XX" })).toBe("bad country");
    s = act(s, "a", { type: "country", country: "BR", t: T0 });
    expect(s.players.a.country).toBe("BR");
  });
});
