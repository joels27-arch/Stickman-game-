/**
 * Brain Run rules, driven directly (no sockets): lobby capacity and codes,
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

/** The old 700 m race (survival is the default mode now). */
function sprint(s: S): S {
  return act(s, "p0", { type: "mode", mode: "sprint" });
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
    let s = act(sprint(lobbyOf(n)), "p0", { type: "start", t: T0 });
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
    let s = act(sprint(lobbyOf(1)), "p0", { type: "start", t: T0 });
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
  it("is deterministic and every row has a way through", () => {
    expect(L.buildCourse(42)).toEqual(L.buildCourse(42));
    for (let seed = 0; seed < 300; seed++) {
      for (const len of [L.TRACK_LEN, 3000]) {
        for (const row of L.buildCourse(seed * 7919, len).rows) {
          // a lane that is empty, or holds something you can jump or slide
          expect(row.lanes.some((k) => k === null || k === "hurdle" || k === "gate")).toBe(true);
        }
      }
    }
  });

  it("gives you time to react: rows are spaced by speed, and get tighter later on", () => {
    for (let seed = 0; seed < 100; seed++) {
      const c = L.buildCourse(seed * 31337, 4000);
      for (let i = 1; i < c.rows.length; i++) {
        const gap = c.rows[i]!.z - c.rows[i - 1]!.z;
        const v = Math.min(L.SURVIVAL_MAX_SPEED, Math.sqrt(L.BASE_SPEED ** 2 + 0.2 * c.rows[i - 1]!.z));
        expect(gap / v).toBeGreaterThanOrEqual(0.85);
      }
      // harder patterns only show up further in
      const early = c.rows.filter((r) => r.z < 400);
      expect(early.some((r) => r.lanes.filter((k) => k === "crate").length === 3)).toBe(false);
    }
    const late = L.buildCourse(7, 4000).rows.filter((r) => r.z > 2000);
    expect(late.some((r) => r.lanes.filter((k) => k === "crate").length === 3)).toBe(true);
  });
});

describe("obstacles and power-ups", () => {
  it("gives every obstacle a valid look and keeps barrels and boxes on the track", () => {
    let rollers = 0;
    let boxes = 0;
    for (let seed = 0; seed < 200; seed++) {
      const c = L.buildCourse(seed * 104729);
      for (const row of c.rows) {
        row.lanes.forEach((k, i) => {
          if (!k) return;
          expect(row.looks[i]).toBeGreaterThanOrEqual(0);
          expect(row.looks[i]).toBeLessThan(L.LOOKS[k] ?? 0);
        });
        // a barrel row always leaves at least two lanes open
        if (row.lanes.includes("roller")) {
          rollers++;
          expect(row.lanes.filter((k) => k === null).length).toBeGreaterThanOrEqual(2);
        }
      }
      for (const b of c.boxes) {
        boxes++;
        expect(b.lane).toBeGreaterThanOrEqual(0);
        expect(b.lane).toBeLessThan(L.LANES);
        expect(b.z).toBeLessThan(L.TRACK_LEN);
      }
    }
    expect(rollers).toBeGreaterThan(60);
    expect(boxes).toBeGreaterThan(300);
  });

  function racing(n = 2): S {
    let s = act(sprint(lobbyOf(n)), "p0", { type: "start", t: T0 });
    return L.applyAction(s, "__system", { type: "tick", t: s.startAt });
  }

  it("relays a lightning zap with the zapper's distance, at most once per cooldown", () => {
    let s = racing(3);
    s = act(s, "p1", { type: "pos", d: 40, lane: 1, y: 0, act: "run", t: s.startAt + 5000 });
    s = act(s, "p1", { type: "zap", t: s.startAt + 5100 });
    const view = L.viewFor(s, "p0") as any;
    expect(view.zaps).toEqual([{ id: 1, by: "p1", d: 40, at: s.startAt + 5100 }]);
    expect(reject(s, "p1", { type: "zap", t: s.startAt + 6000 })).toMatch(/soon/);
    s = act(s, "p1", { type: "zap", t: s.startAt + 5100 + L.ZAP_COOLDOWN_MS });
    expect(s.zaps.map((z: any) => z.id)).toEqual([1, 2]);
  });

  it("only zaps during the race, and a new race forgets old zaps", () => {
    const lobby = lobbyOf(2);
    expect(reject(lobby, "p0", { type: "zap" })).toBeTruthy();
    let s = racing(2);
    s = act(s, "p0", { type: "zap", t: s.startAt + 1000 });
    s = act(s, "p0", { type: "pos", d: L.TRACK_LEN, lane: 0, y: 0, act: "run", t: s.startAt + 50_000 });
    expect(reject(s, "p0", { type: "zap", t: s.startAt + 50_100 })).toBeTruthy();
    s = act(s, "p1", { type: "pos", d: L.TRACK_LEN, lane: 0, y: 0, act: "run", t: s.startAt + 51_000 });
    s = act(s, "p0", { type: "again", t: s.startAt + 60_000 });
    s = act(s, "p0", { type: "start", t: s.startAt + 61_000 });
    expect(s.zaps).toEqual([]);
  });

  it("shares which power a runner has on and rejects made-up ones", () => {
    let s = racing(2);
    s = act(s, "p0", { type: "pos", d: 10, lane: 0, y: 2, act: "run", pw: "rocket", t: s.startAt + 1000 });
    expect((L.viewFor(s, "p1") as any).players[0].pw).toBe("rocket");
    expect(reject(s, "p0", { type: "pos", d: 11, lane: 0, y: 0, act: "run", pw: "laser" })).toMatch(/power/);
  });
});

describe("medals and countries", () => {
  const pos = (d: number, t: number) => ({ type: "pos", d, lane: 0, y: 0, act: "run", t });

  it("gives gold, silver and bronze to the podium and nothing to 4th", () => {
    let s: S = act(sprint(lobbyOf(4)), "p0", { type: "start", t: T0 });
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
    let s: S = act(sprint(lobbyOf(2)), "p0", { type: "start", t: T0 });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
    s = act(s, "p1", pos(L.TRACK_LEN, s.startAt + 50_000));
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt + 50_000 + L.AFTER_FIRST_MS });
    const r = (L.viewFor(s, "p0") as S).rewards;
    expect(r.p1.medal).toBe("gold");
    expect(r.p0).toEqual({ place: 2, medal: null });

    let solo: S = act(sprint(lobbyOf(1)), "p0", { type: "start", t: T0 });
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

describe("survival (3 hearts)", () => {
  const pos = (d: number, t: number, hits = 0) => ({ type: "pos", d, lane: 0, y: 0, act: "run", hits, t });
  function survival(n: number): S {
    let s = act(lobbyOf(n), "p0", { type: "start", t: T0 });
    expect(s.kind).toBe("survival");
    return L.applyAction(s, "__system", { type: "tick", t: s.startAt });
  }

  it("is the default and has no finish line", () => {
    let s = survival(2);
    s = act(s, "p0", pos(800, s.startAt + 60_000));
    expect(s.players.p0.d).toBe(800);
    expect(s.players.p0.finish).toBeNull();
    expect(s.phase).toBe("race");
  });

  it("knocks you out on the third hit and ends when one runner is left", () => {
    let s = survival(3);
    s = act(s, "p1", pos(100, s.startAt + 10_000, 2));
    expect(s.players.p1.outAt).toBeNull();
    s = act(s, "p1", pos(110, s.startAt + 11_000, 3));
    expect(s.players.p1.outAt).toBe(s.startAt + 11_000);
    expect(s.phase).toBe("race");
    s = act(s, "p2", pos(300, s.startAt + 25_000, 3));
    expect(s.phase).toBe("results");
    // last one standing wins, then whoever lasted longer
    expect(L.standings(s)).toEqual(["p0", "p2", "p1"]);
    const r = L.rewards(s) as any;
    expect(r.p0.medal).toBe("gold");
    expect(r.p2.medal).toBe("silver");
    expect(r.p1.medal).toBe("bronze");
  });

  it("runs alone until your hearts are gone (endless run)", () => {
    let s = survival(1);
    s = act(s, "p0", pos(900, s.startAt + 60_000, 2));
    expect(s.phase).toBe("race");
    s = act(s, "p0", pos(950, s.startAt + 63_000, 3));
    expect(s.phase).toBe("results");
    expect((L.rewards(s) as any).p0.medal).toBeNull();
  });

  it("ignores positions once you're out and lets nobody else pick the mode", () => {
    let s = survival(2);
    expect(reject(lobbyOf(2), "p1", { type: "mode", mode: "sprint" })).toMatch(/host/);
    expect(reject(lobbyOf(2), "p0", { type: "mode", mode: "marathon" })).toBeTruthy();
    s = act(s, "p0", pos(50, s.startAt + 5000, 3));
    expect(s.phase).toBe("results");
  });
});

describe("tournament", () => {
  const pos = (d: number, t: number, hits = 0) => ({ type: "pos", d, lane: 0, y: 0, act: "run", hits, t });

  it("runs three races, adds up points, and pays medals only for the final table", () => {
    let s = act(lobbyOf(3), "p0", { type: "mode", mode: "tournament" });
    s = act(s, "p0", { type: "start", t: T0 });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
    // race 1 (survival): p2 wins, p0 second, p1 out first
    expect(s.kind).toBe(L.CUP_RACES[0]);
    s = act(s, "p1", pos(40, s.startAt + 5000, 3));
    s = act(s, "p0", pos(90, s.startAt + 9000, 3));
    expect(s.phase).toBe("results");
    expect(s.cup.points).toEqual({ p2: 10, p0: 5, p1: 3 });
    expect(L.rewards(s)).toEqual({});
    expect(reject(s, "p1", { type: "next" })).toMatch(/host/);

    // race 2 (sprint): p0, p1, p2
    s = act(s, "p0", { type: "next", t: s.endAt + 5000 });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
    expect(s.kind).toBe(L.CUP_RACES[1]);
    s = act(s, "p0", pos(L.TRACK_LEN, s.startAt + 50_000));
    s = act(s, "p1", pos(L.TRACK_LEN, s.startAt + 51_000));
    s = act(s, "p2", pos(L.TRACK_LEN, s.startAt + 52_000));
    expect(s.cup.points).toEqual({ p2: 13, p0: 15, p1: 8 });

    // race 3 (survival): p1 wins
    s = act(s, "p0", { type: "next", t: s.endAt + 5000 });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
    s = act(s, "p2", pos(40, s.startAt + 5000, 3));
    s = act(s, "p0", pos(60, s.startAt + 6000, 3));
    expect(s.cup.points).toEqual({ p2: 16, p0: 20, p1: 18 });
    expect(L.cupStandings(s)).toEqual(["p0", "p1", "p2"]);
    expect(reject(s, "p0", { type: "next" })).toBeTruthy();
    const r = L.rewards(s) as any;
    expect([r.p0.medal, r.p1.medal, r.p2.medal]).toEqual(["gold", "silver", "bronze"]);
    const view = L.viewFor(s, "p1") as any;
    expect(view.cup.race).toBe(3);
    expect(view.cup.table).toEqual(["p0", "p1", "p2"]);

    // back to the lobby clears the cup
    s = act(s, "p0", { type: "again", t: s.endAt + 5000 });
    expect(s.cup).toBeNull();
    expect(s.mode).toBe("tournament");
  });
});

describe("bananas", () => {
  function racing(n = 2): S {
    let s = act(lobbyOf(n), "p0", { type: "start", t: T0 });
    return L.applyAction(s, "__system", { type: "tick", t: s.startAt });
  }

  it("lands a thrown banana ahead of you and removes it when someone slips", () => {
    let s = racing();
    s = act(s, "p0", { type: "pos", d: 50, lane: 1, y: 0, act: "run", t: s.startAt + 5000 });
    s = act(s, "p0", { type: "banana", lane: 3, d: 50 + L.BANANA_AHEAD_M, t: s.startAt + 5100 });
    expect((L.viewFor(s, "p1") as any).bananas).toEqual([{ id: 1, by: "p0", lane: 3, d: 78, at: s.startAt + 5100 }]);
    expect(reject(s, "p0", { type: "banana", lane: 2, d: 78, t: s.startAt + 5500 })).toMatch(/soon/);
    s = act(s, "p1", { type: "slip", id: 1 });
    expect(s.bananas).toEqual([]);
    expect(reject(s, "p1", { type: "slip", id: 1 })).toBeTruthy();
  });

  it("won't throw a banana miles down the track or into a lane that doesn't exist", () => {
    let s = racing();
    s = act(s, "p0", { type: "pos", d: 50, lane: 1, y: 0, act: "run", t: s.startAt + 5000 });
    expect(reject(s, "p0", { type: "banana", lane: 1, d: 400, t: s.startAt + 5100 })).toBeTruthy();
    expect(reject(s, "p0", { type: "banana", lane: 9, d: 70, t: s.startAt + 5100 })).toBeTruthy();
  });
});
