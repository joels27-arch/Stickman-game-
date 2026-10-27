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
  // everyone but the host has locked in their runner
  for (let i = 1; i < n; i++) s = act(s, `p${i}`, { type: "ready", ready: true, t: T0 + 10 + i });
  return s;
}

/** The old 700 m race (survival is the default mode now). */
function sprint(s: S): S {
  // no mode starts a sprint any more, but the finish-line race still works
  return { ...s, mode: "sprint" };
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
    expect(reject(s, "p1", { type: "start", bots: false, t: T0 })).toMatch(/host/);
    const started = act(s, "p0", { type: "start", bots: false, t: T0 + 10 });
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
    let s = act(sprint(lobbyOf(n)), "p0", { type: "start", bots: false, t: T0 });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
    expect(s.phase).toBe("race");
    return s;
  }
  const pos = (d: number, t: number) => ({ type: "pos", d, lane: 0, y: 0, act: "run", t });

  it("caps distance to what is physically possible and never goes backwards", () => {
    let s = racing();
    s = act(s, "p0", pos(500, s.startAt + 1000));
    expect(s.players.p0.d).toBeLessThan(40);
    s = act(s, "p0", pos(5, s.startAt + 1500));
    expect(s.players.p0.d).toBeGreaterThan(5);
  });

  it("starts the race on the first position after the gun even before the tick", () => {
    let s = act(sprint(lobbyOf(1)), "p0", { type: "start", bots: false, t: T0 });
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

  it("accepts the cheer pose (waving on the line, after the finish)", () => {
    const s = racing();
    expect(L.validateAction(s, "p0", { type: "pos", d: 0, lane: 0, y: 0, act: "cheer" }).ok).toBe(true);
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
        const v = L.speedAtDistance("survival", c.rows[i - 1]!.z);
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

describe("difficulty manager", () => {
  it("never leaves a long empty stretch, not even at the start", () => {
    for (let seed = 0; seed < 200; seed++) {
      const c = L.buildCourse(seed * 7919, L.SURVIVAL_LEN);
      // a bus (its ramp, front and end) is something to deal with too, not empty track
      const z = [...c.rows.map((r) => r.z), ...c.buses.flatMap((b) => [b.z0 - L.RAMP_LEN, b.z0, b.z1])].sort((a, b) => a - b).filter((x) => x < 2000);
      expect(z[0]).toBeLessThanOrEqual(L.MAX_EMPTY_M);
      for (let i = 1; i < z.length; i++) expect(z[i]! - z[i - 1]!).toBeLessThanOrEqual(L.MAX_EMPTY_M + 12); // + a fairness widening at most
      expect(z.filter((x) => x < 800).length).toBeGreaterThanOrEqual(28);
    }
  });

  it("buses: most with a ramp up to the roof, never beside an obstacle row, the floor follows them", () => {
    let n = 0;
    let ramps0 = 0;
    for (let seed = 0; seed < 60; seed++) {
      const c = L.buildCourse(seed * 104729, L.SURVIVAL_LEN);
      for (const b of c.buses) {
        n++;
        expect(b.z1 - b.z0).toBeCloseTo(L.BUS_LEN);
        expect(c.rows.some((r) => r.z > b.z0 - L.RAMP_LEN - 1 && r.z < b.z1 + 1)).toBe(false);
        expect(L.floorAt(c, b.lane, b.z0 - L.RAMP_LEN)).toBe(0);
        if (b.ramp) expect(L.floorAt(c, b.lane, b.z0 - L.RAMP_LEN / 2)).toBeCloseTo(L.BUS_H / 2);
        else {
          ramps0++;
          expect(L.floorAt(c, b.lane, b.z0 - 0.1)).toBe(0);
          expect(L.busFront(c, b.lane, b.z0 - 3, b.z0 + 1)).toBe(b);
        }
        expect(L.floorAt(c, b.lane, (b.z0 + b.z1) / 2)).toBe(L.BUS_H);
        expect(L.floorAt(c, b.lane, b.z1 + 0.5)).toBe(0);
        expect(L.busAt(c, b.lane, b.z0 + 2)).toBe(true);
      }
      expect(c.buses.every((b) => b.z0 > 250)).toBe(true);
      // never every lane: there's always a road lane to stay on
      for (const b of c.buses) expect(c.buses.filter((o) => o.z0 === b.z0).length).toBeLessThan(L.LANES);
    }
    expect(n).toBeGreaterThan(30);
    expect(ramps0).toBeGreaterThan(5);
    expect(ramps0).toBeLessThan(n / 2);
  });

  it("every course is fair: from any lane you could be in, the next way through is reachable in time", () => {
    for (let seed = 0; seed < 400; seed++) {
      for (const len of [L.TRACK_LEN, L.SURVIVAL_LEN]) {
        expect(L.checkCourse(L.buildCourse(seed * 7919, len), len > L.TRACK_LEN ? "survival" : "sprint")).toEqual([]);
      }
      expect(L.checkCourse(L.buildCourse(seed, L.SURVIVAL_LEN, 700))).toEqual([]);
    }
  });

  it("teaches one mechanic at a time: hurdles, then gates, then crates, then barrels, each flagged once", () => {
    for (let seed = 0; seed < 50; seed++) {
      const c = L.buildCourse(seed * 13, L.SURVIVAL_LEN);
      const intros = c.rows.filter((r) => r.intro).map((r) => r.intro);
      expect(intros.slice(0, 3)).toEqual(["hurdle", "gate", "crate"]);
      expect(new Set(intros).size).toBe(intros.length);
      // the first 120 m only ask one thing per row
      for (const r of c.rows.filter((x) => x.z < 120)) expect(r.lanes.filter(Boolean).length).toBe(1);
    }
  });

  it("gets harder by stage: more obstacles per row and tighter rows later on", () => {
    let early = 0;
    let late = 0;
    let earlyRows = 0;
    let lateRows = 0;
    for (let seed = 0; seed < 60; seed++) {
      const c = L.buildCourse(seed * 101, L.SURVIVAL_LEN);
      for (const r of c.rows) {
        const n = r.lanes.filter((k) => k && k !== "hurdle" && k !== "gate").length;
        if (r.z < 600) (early += n), earlyRows++;
        else if (r.z > 1500 && r.z < 3500) (late += n), lateRows++;
      }
    }
    expect(late / lateRows).toBeGreaterThan((early / earlyRows) * 2);
    expect(L.stageAt(0).react).toBeGreaterThan(L.stageAt(3000).react);
    expect(L.STAGES.map((s) => s.from)).toEqual([...L.STAGES.map((s) => s.from)].sort((a, b) => a - b));
  });

  it("starts later rounds of a match further along the curve", () => {
    const plain = L.buildCourse(9, L.SURVIVAL_LEN);
    const boosted = L.buildCourse(9, L.SURVIVAL_LEN, 700);
    const crates = (c: any) => c.rows.filter((r: any) => r.z < 400).reduce((a: number, r: any) => a + r.lanes.filter((k: any) => k === "crate").length, 0);
    expect(crates(boosted)).toBeGreaterThan(crates(plain));
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
    let s = act(sprint(lobbyOf(n)), "p0", { type: "start", bots: false, t: T0 });
    return L.applyAction(s, "__system", { type: "tick", t: s.startAt });
  }

  it("relays a lightning zap with the zapper's distance, at most once per cooldown", () => {
    let s = racing(3);
    s = act(s, "p1", { type: "pos", d: 40, lane: 1, y: 0, act: "run", t: s.startAt + 5000 });
    s = act(s, "p1", { type: "zap", t: s.startAt + 5100 });
    const view = L.viewFor(s, "p0") as any;
    expect(view.zaps).toEqual([{ id: 1, by: "p1", d: 40, at: s.startAt + 5100, kind: "lightning" }]);
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
    s = act(s, "p1", { type: "ready", ready: true, t: s.startAt + 60_500 });
    s = act(s, "p0", { type: "start", bots: false, t: s.startAt + 61_000 });
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
    let s: S = act(sprint(lobbyOf(4)), "p0", { type: "start", bots: false, t: T0 });
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
    let s: S = act(sprint(lobbyOf(2)), "p0", { type: "start", bots: false, t: T0 });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
    s = act(s, "p1", pos(L.TRACK_LEN, s.startAt + 50_000));
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt + 50_000 + L.AFTER_FIRST_MS });
    const r = (L.viewFor(s, "p0") as S).rewards;
    expect(r.p1.medal).toBe("gold");
    expect(r.p0).toEqual({ place: 2, medal: null });

    let solo: S = act(sprint(lobbyOf(1)), "p0", { type: "start", bots: false, t: T0 });
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
    let s = act(lobbyOf(n), "p0", { type: "start", bots: false, t: T0 });
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
    expect(reject(lobbyOf(2), "p1", { type: "mode", mode: "chase" })).toMatch(/host/);
    expect(act(lobbyOf(2), "p0", { type: "mode", mode: "sprint" }).mode).toBe("sprint"); // Classic Race is back
    expect(reject(lobbyOf(2), "p0", { type: "mode", mode: "marathon" })).toBeTruthy();
    s = act(s, "p0", pos(50, s.startAt + 5000, 3));
    expect(s.phase).toBe("results");
  });
});

describe("matches over several rounds", () => {
  const pos = (d: number, t: number, hits = 0) => ({ type: "pos", d, lane: 0, y: 0, act: "run", hits, t });

  it("lets the host pick 1, 3, 5 or 10 rounds and a prize", () => {
    let s = act(lobbyOf(2), "p0", { type: "rounds", rounds: 5 });
    s = act(s, "p0", { type: "prize", prize: "huge" });
    expect((L.viewFor(s, "p1") as S).rounds).toBe(5);
    expect((L.viewFor(s, "p1") as S).prize).toBe("huge");
    expect(reject(s, "p1", { type: "rounds", rounds: 3 })).toMatch(/host/);
    expect(reject(s, "p0", { type: "rounds", rounds: 4 })).toMatch(/bad/);
    expect(reject(s, "p0", { type: "prize", prize: "car" })).toMatch(/bad/);
    expect(reject(s, "p0", { type: "mode", mode: "cup" })).toBeTruthy(); // Party Cup is now Random × 3
  });

  it("one round is a plain race; more rounds repeat the mode", () => {
    let s = act(lobbyOf(2), "p0", { type: "mode", mode: "chase" });
    expect(act(s, "p0", { type: "start", bots: false, t: T0 }).cup).toBeNull();
    s = act(s, "p0", { type: "rounds", rounds: 3 });
    s = act(s, "p0", { type: "start", bots: false, t: T0 });
    expect(s.cup.races).toEqual(["chase", "chase", "chase"]);
  });

  it("Random over several rounds draws a different mode each round", () => {
    let s = act(lobbyOf(2), "p0", { type: "mode", mode: "random" });
    s = act(s, "p0", { type: "rounds", rounds: 5 });
    s = act(s, "p0", { type: "start", bots: false, t: T0 });
    expect(s.cup.races).toHaveLength(5);
    expect(s.cup.races.every((k: string) => L.PARTY_KINDS.includes(k))).toBe(true);
    expect(new Set(s.cup.races.slice(0, 4)).size).toBe(4);
    for (let i = 1; i < 5; i++) expect(s.cup.races[i]).not.toBe(s.cup.races[i - 1]);
    expect(s.kind).toBe(s.cup.races[0]);
  });

  it("adds up points over three rounds and pays medals only for the final table", () => {
    let s = act(lobbyOf(3), "p0", { type: "rounds", rounds: 3 });
    s = act(s, "p0", { type: "start", bots: false, t: T0 });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
    // round 1: p2 wins, p0 second, p1 out first
    s = act(s, "p1", pos(40, s.startAt + 5000, 3));
    s = act(s, "p0", pos(90, s.startAt + 9000, 3));
    expect(s.phase).toBe("results");
    expect(s.cup.points).toEqual({ p2: 10, p0: 5, p1: 3 });
    expect(L.rewards(s)).toEqual({});
    expect(reject(s, "p1", { type: "next" })).toMatch(/host/);
    expect(reject(s, "p0", { type: "rematch" })).toMatch(/cup/);

    // round 2: p0 wins
    s = act(s, "p0", { type: "next", t: s.endAt + 5000 });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
    s = act(s, "p2", pos(40, s.startAt + 5000, 3));
    s = act(s, "p1", pos(60, s.startAt + 6000, 3));
    expect(s.cup.points).toEqual({ p2: 13, p0: 15, p1: 8 });

    // round 3: p1 wins
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

    // back to the lobby clears the match; the settings stay
    s = act(s, "p0", { type: "again", t: s.endAt + 5000 });
    expect(s.cup).toBeNull();
    expect(s.rounds).toBe(3);
  });
});

describe("fair start", () => {
  it("bots speed up from the line like a player, no head start", () => {
    let s = act(lobbyOf(1), "p0", { type: "start", bots: true, t: T0 });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt + 300 });
    const bots = Object.values(s.players).filter((p: any) => p.bot) as any[];
    expect(bots.length).toBe(3);
    // a player accelerating at 14 m/s² covers 0.63 m in 0.3 s
    for (const b of bots) expect(b.d).toBeLessThanOrEqual(0.64);
  });
});

describe("bot level", () => {
  it("the host picks easy / normal / hard; easy bots are slower and clumsier than hard ones", () => {
    expect(reject(lobbyOf(2), "p1", { type: "botlevel", level: "hard" })).toMatch(/host/);
    expect(reject(lobbyOf(1), "p0", { type: "botlevel", level: "insane" })).toBeTruthy();
    const run = (level: string) => {
      let s = act(lobbyOf(1), "p0", { type: "botlevel", level });
      expect((L.viewFor(s, "p0") as any).botLevel).toBe(level);
      s = act(s, "p0", { type: "start", bots: true, t: T0 });
      for (let t = 0; t <= 30_000; t += 250) s = L.applyAction(s, "__system", { type: "tick", t: s.startAt + t });
      const bots = Object.values(s.players).filter((p: any) => p.bot) as any[];
      return { d: bots.reduce((a, b) => a + b.d, 0) / bots.length, skill: Math.max(...bots.map((b) => b.skill)) };
    };
    const easy = run("easy");
    const hard = run("hard");
    expect(easy.skill).toBeLessThan(hard.skill);
    expect(easy.d).toBeLessThan(hard.d);
  });
});

describe("endless run", () => {
  it("is solo without bots and ends on the first hit", () => {
    expect(reject(lobbyOf(2), "p0", { type: "start", bots: false, endless: true })).toMatch(/solo/);
    expect(reject(lobbyOf(1), "p0", { type: "start", bots: true, endless: true })).toMatch(/solo/);
    let s = act(lobbyOf(1), "p0", { type: "start", bots: false, endless: true, t: T0 });
    expect((L.viewFor(s, "p0") as any).lives).toBe(1);
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
    s = act(s, "p0", { type: "pos", d: 120, lane: 0, y: 0, act: "run", hits: 1, t: s.startAt + 9000 });
    expect(s.players.p0.outAt).toBe(s.startAt + 9000);
    expect(s.phase).toBe("results");
    // a normal race still has 3 hearts
    expect((L.viewFor(act(lobbyOf(1), "p0", { type: "start", bots: false, t: T0 }), "p0") as any).lives).toBe(3);
  });
});

describe("power-ups never cost a heart", () => {
  it("lightning trips the bots ahead in survival but leaves their hearts alone", () => {
    let s = act(lobbyOf(1), "p0", { type: "start", bots: true, t: T0 });
    expect(s.kind).toBe("survival");
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt + 2000 });
    const bots = Object.keys(s.players).filter((id) => s.players[id].bot);
    const before = Object.fromEntries(bots.map((id) => [id, s.players[id].hits]));
    s = act(s, "p0", { type: "zap", t: s.startAt + 2000 });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt + 2050 });
    const tripped = bots.filter((id) => s.players[id].stunUntil >= s.startAt + 2050);
    expect(tripped.length).toBeGreaterThan(0);
    for (const id of tripped) expect(s.players[id].hits).toBe(before[id]);
  });
});

describe("survival hearts", () => {
  const racing = (kind = "survival"): S => {
    let s = act(lobbyOf(2), "p0", { type: "mode", mode: kind });
    s = act(s, "p0", { type: "start", bots: false, t: T0 });
    return L.applyAction(s, "__system", { type: "tick", t: s.startAt }) as S;
  };
  it("go to the first runner who lost a heart, and are gone for everyone", () => {
    let s = racing();
    expect(reject(s, "p0", { type: "heart", i: 0 })).toMatch(/full/);
    s = act(s, "p0", { type: "pos", d: 10, lane: 0, y: 0, act: "run", hits: 1, t: s.startAt + 2000 });
    s = act(s, "p1", { type: "pos", d: 10, lane: 0, y: 0, act: "run", hits: 1, t: s.startAt + 2000 });
    s = act(s, "p0", { type: "heart", i: 0 });
    expect(s.players.p0.hits).toBe(0);
    expect((L.viewFor(s, "p1") as S).heartsTaken).toEqual([{ i: 0, by: "p0" }]);
    expect(reject(s, "p1", { type: "heart", i: 0 })).toMatch(/gone/);
  });
  it("don't exist outside survival", () => {
    let s = racing("coinrush");
    s = act(s, "p0", { type: "pos", d: 10, lane: 0, y: 0, act: "run", hits: 1, t: s.startAt + 2000 });
    expect(reject(s, "p0", { type: "heart", i: 0 })).toMatch(/no hearts/);
  });
});

describe("random mode and map", () => {
  it("draws a real mode and map when the race starts", () => {
    const kinds = new Set<string>();
    const maps = new Set<string>();
    for (let i = 0; i < 40; i++) {
      let s = act(lobbyOf(2), "p0", { type: "mode", mode: "random" });
      s = act(s, "p0", { type: "map", map: "random" });
      s = act(s, "p0", { type: "start", bots: true, t: T0 + i * 7919 });
      expect(L.PARTY_KINDS).toContain(s.kind);
      expect(L.MAPS).toContain(s.raceMap);
      expect(s.mode).toBe("random");
      expect(s.cup).toBeNull();
      kinds.add(s.kind);
      maps.add(s.raceMap);
    }
    expect(kinds.size).toBeGreaterThan(1);
    expect(maps.size).toBeGreaterThan(1);
  });
  it("Party over 10 rounds plays every mode, the Classic Race too", () => {
    let s = act(lobbyOf(2), "p0", { type: "mode", mode: "random" });
    s = act(s, "p0", { type: "rounds", rounds: 10 });
    s = act(s, "p0", { type: "start", bots: true, t: T0 });
    expect(s.cup.races).toHaveLength(10);
    expect(new Set(s.cup.races)).toEqual(new Set(L.PARTY_KINDS));
  });
  it("starting lanes are dealt at random each race", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const s = act(lobbyOf(1), "p0", { type: "start", bots: true, t: T0 + i * 7777 });
      const lanes = Object.values(s.players).map((p: any) => p.lane);
      expect([...lanes].sort()).toEqual([0, 1, 2, 3]);
      seen.add(s.players.p0.lane);
    }
    expect(seen.size).toBeGreaterThan(2);
  });
  it("bots get random runners, not the same ones every race", () => {
    const sets = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const s = act(lobbyOf(1), "p0", { type: "start", bots: true, t: T0 + i * 7777 });
      const bots = Object.values(s.players).filter((p: any) => p.bot).map((p: any) => p.char);
      expect(new Set(bots).size).toBe(bots.length); // never two the same
      expect(bots.every((c: number) => c >= 0 && c < L.CHARACTERS)).toBe(true);
      sets.add(bots.join(","));
    }
    expect(sets.size).toBeGreaterThan(5);
  });
  it("Party: the host can switch modes off (at least 2 stay on)", () => {
    let s = act(lobbyOf(2), "p0", { type: "mode", mode: "random" });
    s = act(s, "p0", { type: "party", kinds: ["survival", "sprint"] });
    expect((L.viewFor(s, "p1") as S).party).toEqual(["survival", "sprint"]);
    s = act(s, "p0", { type: "rounds", rounds: 10 });
    s = act(s, "p0", { type: "start", bots: true, t: T0 });
    expect(new Set(s.cup.races)).toEqual(new Set(["survival", "sprint"]));
    expect(reject(lobbyOf(2), "p0", { type: "party", kinds: ["survival"] })).toMatch(/2 modes/);
    expect(reject(lobbyOf(2), "p0", { type: "party", kinds: ["survival", "potato"] })).toMatch(/bad/);
    expect(reject(lobbyOf(2), "p1", { type: "party", kinds: ["survival", "chase"] })).toMatch(/host/);
  });
  it("the host can tick several maps: each race is one of those", () => {
    const pick = ["farm", "space", "candy"];
    expect(reject(lobbyOf(2), "p0", { type: "maps", maps: pick })).toMatch(/rounds/); // 1 round: 1 map
    let s = act(lobbyOf(2), "p0", { type: "rounds", rounds: 10 });
    s = act(s, "p0", { type: "maps", maps: pick });
    expect((L.viewFor(s, "p1") as S).maps).toEqual(pick);
    s = act(s, "p0", { type: "start", bots: true, t: T0 });
    const seen = [s.raceMap];
    for (let r = 2; r <= 10; r++) {
      s.cup.race = r - 1;
      s.phase = "results";
      s = act(s, "p0", { type: "next", t: T0 + r * 100000 });
      expect(s.raceMap).not.toBe(seen[seen.length - 1]);
      seen.push(s.raceMap);
    }
    expect(seen.every((m) => pick.includes(m))).toBe(true);
    // one ticked map is just that map
    s = act(lobbyOf(2), "p0", { type: "maps", maps: ["beach"] });
    expect(s.map).toBe("beach");
    expect(s.maps).toBeNull();
    expect(reject(act(lobbyOf(2), "p0", { type: "rounds", rounds: 3 }), "p0", { type: "maps", maps: ["beach", "moon"] })).toMatch(/bad/);
    // fewer rounds: the extra maps drop off
    let t = act(lobbyOf(2), "p0", { type: "rounds", rounds: 5 });
    t = act(t, "p0", { type: "maps", maps: ["beach", "farm", "city", "space", "candy"] });
    t = act(t, "p0", { type: "rounds", rounds: 3 });
    expect(t.maps).toEqual(["beach", "farm", "city"]);
    t = act(t, "p0", { type: "rounds", rounds: 1 });
    expect([t.map, t.maps]).toEqual(["beach", null]);
    expect(reject(lobbyOf(2), "p0", { type: "maps", maps: [] })).toMatch(/bad/);
    expect(reject(lobbyOf(2), "p1", { type: "maps", maps: ["beach"] })).toMatch(/host/);
  });
  it("only the host picks, and only real choices", () => {
    expect(reject(lobbyOf(2), "p1", { type: "map", map: "random" })).toMatch(/host/);
    expect(reject(lobbyOf(2), "p0", { type: "map", map: "moon" })).toBeTruthy();
  });
});

describe("tournaments", () => {
  it("the Coin Rush Cup is gone", () => {
    expect(reject(lobbyOf(2), "p0", { type: "mode", mode: "rushcup" })).toBeTruthy();
  });

  it("Grand Tour plays every mode once, with harder courses each round", () => {
    let s = act(lobbyOf(2), "p0", { type: "mode", mode: "grandtour" });
    s = act(s, "p0", { type: "start", bots: true, t: T0 });
    expect([...s.cup.races].sort()).toEqual([...L.PARTY_KINDS].sort());
    const boosts = [s.courseBoost];
    for (let r = 2; r <= L.PARTY_KINDS.length; r++) {
      s = { ...s, phase: "results", endAt: s.startAt + 1000 };
      s = act(s, "p0", { type: "next", t: s.endAt + 5000 });
      expect(s.kind).toBe(s.cup.races[r - 1]);
      boosts.push(s.courseBoost);
    }
    expect(boosts).toEqual([0, 350, 700, 1050]);
    s = { ...s, phase: "results", endAt: s.startAt + 1000 };
    expect(reject(s, "p0", { type: "next" })).toBeTruthy();
  });

  it("plain modes are not cups", () => {
    let s = act(lobbyOf(2), "p0", { type: "mode", mode: "coinrush" });
    s = act(s, "p0", { type: "start", bots: true, t: T0 });
    expect(s.cup).toBeNull();
  });
});

describe("bananas", () => {
  function racing(n = 2): S {
    let s = act(lobbyOf(n), "p0", { type: "start", bots: false, t: T0 });
    return L.applyAction(s, "__system", { type: "tick", t: s.startAt });
  }

  it("lands a thrown banana ahead of you and removes it when someone slips", () => {
    let s = racing();
    s = act(s, "p0", { type: "pos", d: 50, lane: 1, y: 0, act: "run", t: s.startAt + 5000 });
    s = act(s, "p0", { type: "banana", lane: 3, d: 50 + L.BANANA_AHEAD_M, t: s.startAt + 5100 });
    expect((L.viewFor(s, "p1") as any).bananas).toEqual([{ id: 1, by: "p0", lane: 3, d: 78, at: s.startAt + 5100, kind: "banana" }]);
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

describe("bowling and freeze", () => {
  function racing(n = 2): S {
    let s = act(lobbyOf(n), "p0", { type: "start", bots: false, t: T0 });
    return L.applyAction(s, "__system", { type: "tick", t: s.startAt });
  }

  it("rolls a bowling ball back from where you are", () => {
    let s = racing();
    s = act(s, "p0", { type: "pos", d: 120, lane: 2, y: 0, act: "run", t: s.startAt + 9000 });
    s = act(s, "p0", { type: "bowl", lane: 0, d: 120, dir: -1, t: s.startAt + 9100 });
    expect((L.viewFor(s, "p1") as any).bowls).toEqual([{ id: 1, by: "p0", lane: 0, d: 120, dir: -1, at: s.startAt + 9100 }]);
    expect(reject(s, "p0", { type: "bowl", lane: 0, d: 120, dir: 1, t: s.startAt + 9300 })).toMatch(/soon/);
    expect(reject(s, "p1", { type: "bowl", lane: 1, d: 500, dir: 1, t: s.startAt + 9300 })).toBeTruthy();
    expect(reject(s, "p1", { type: "bowl", lane: 1, d: 0, dir: 2, t: s.startAt + 9300 })).toBeTruthy();
  });

  it("relays freeze as its own kind of zap", () => {
    let s = racing();
    s = act(s, "p1", { type: "zap", kind: "freeze", t: s.startAt + 4000 });
    expect(s.zaps[0].kind).toBe("freeze");
    expect(reject(s, "p0", { type: "zap", kind: "nuke", t: s.startAt + 4000 })).toBeTruthy();
  });
});

describe("keeping screens in sync", () => {
  it("tells everyone when a position was true and how fast that runner was going", () => {
    let s = act(lobbyOf(2), "p0", { type: "start", bots: false, t: T0 });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
    s = act(s, "p1", { type: "pos", d: 36, lane: 1, y: 0, act: "run", v: 12, t: s.startAt + 3000 });
    const p1 = (L.viewFor(s, "p0") as any).players.find((p: any) => p.id === "p1");
    expect(p1).toMatchObject({ d: 36, v: 12, at: s.startAt + 3000 });
    expect(reject(s, "p1", { type: "pos", d: 37, lane: 1, y: 0, act: "run", v: 900 })).toMatch(/speed/);
  });
});

describe("power-up odds", () => {
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

  it("always adds up to 100%", () => {
    for (let alive = 1; alive <= 4; alive++) {
      for (let rank = 1; rank <= alive; rank++) {
        for (const gap of [0, 20, 80, 300]) {
          for (const last of ["", ...L.POWERS]) expect(sum(L.powerOdds({ rank, alive, gapToLeader: gap, last }))).toBeCloseTo(100, 6);
        }
      }
    }
  });

  it("gives the leader defence and the last runner the catch-up items", () => {
    const lead = L.powerOdds({ rank: 1, alive: 4, gapToLeader: 0 });
    const last = L.powerOdds({ rank: 4, alive: 4, gapToLeader: 120 });
    expect(lead.lightning).toBe(0);
    // Mario Kart style: the leader can still draw a rocket, about 1 in 100
    expect(lead.rocket).toBeGreaterThan(0.5);
    expect(lead.rocket).toBeLessThan(1.5);
    expect(lead.shield! + lead.banana!).toBeGreaterThan(45);
    expect(lead.swap! + lead.thunder! + lead.brainwave! + lead.mud!).toBe(0);
    expect(last.rocket).toBe(30);
    expect(last.rocket! + last.lightning! + last.freeze! + last.brainwave! + last.thunder! + last.swap!).toBeGreaterThan(80);
    // the better the item, the more it favours the back of the field
    const mid = L.powerOdds({ rank: 2, alive: 4, gapToLeader: 20 });
    expect(lead.rocket).toBeLessThan(mid.rocket!);
    expect(mid.rocket).toBeLessThan(last.rocket!);
  });

  it("treats a close second more like a leader than someone far behind", () => {
    const close = L.powerOdds({ rank: 2, alive: 3, gapToLeader: 2 });
    const far = L.powerOdds({ rank: 2, alive: 3, gapToLeader: 100 });
    expect(close.rocket).toBeLessThan(far.rocket!);
    expect(close.shield).toBeGreaterThan(far.shield!);
  });

  it("only counts runners still in the race, and never repeats your last item", () => {
    // 2 of 4 knocked out: 2nd of the 2 left is last place, and gets last-place odds
    const back = L.powerOdds({ rank: 2, alive: 2, gapToLeader: 80 });
    expect(back.rocket).toBe(30);
    expect(L.powerOdds({ rank: 1, alive: 3, last: "shield" }).shield).toBe(0);
    const solo = L.powerOdds({ rank: 1, alive: 1 });
    expect([solo.lightning, solo.bowling, solo.freeze]).toEqual([0, 0, 0]);
  });

  it("picks items in proportion to the odds", () => {
    const odds = L.powerOdds({ rank: 3, alive: 4, gapToLeader: 40 });
    const counts: Record<string, number> = {};
    for (let i = 0; i < 10000; i++) {
      const k = L.pickPower(odds, (i + 0.5) / 10000);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    for (const k of L.POWERS) expect((counts[k] ?? 0) / 100).toBeCloseTo(odds[k]!, 0);
  });
});

describe("rounds get faster, boxes are first come first served", () => {
  it("speeds everybody up the longer the round lasts", () => {
    expect(L.survivalSpeed(0)).toBe(L.BASE_SPEED);
    expect(L.survivalSpeed(70)).toBeCloseTo(19);
    expect(L.survivalSpeed(130)).toBeCloseTo(21.4);
    expect(L.survivalSpeed(600)).toBe(L.SURVIVAL_MAX_SPEED);
    expect(L.sprintSpeed(0)).toBe(L.BASE_SPEED);
    expect(L.sprintSpeed(30)).toBeCloseTo(13.8);
    expect(L.sprintSpeed(120)).toBe(L.SPRINT_MAX_SPEED);
    // the course is spaced for the speed you'll actually be running there
    expect(L.speedAtDistance("survival", 1085)).toBeCloseTo(19);
    expect(L.speedAtDistance("survival", 50000)).toBe(L.SURVIVAL_MAX_SPEED);
  });

  it("gives a mystery box to whoever reaches it first", () => {
    let s = act(lobbyOf(2), "p0", { type: "start", bots: false, t: T0 });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
    s = act(s, "p1", { type: "take", box: 3 });
    expect((L.viewFor(s, "p0") as any).taken).toEqual([3]);
    expect(reject(s, "p0", { type: "take", box: 3 })).toMatch(/gone/);
  });

  it("knows Iran, Colombia, Peru and India", () => {
    const codes = L.COUNTRIES.map(([c]) => c);
    for (const c of ["IR", "CO", "PE", "IN"]) expect(codes).toContain(c);
  });
});

describe("maps", () => {
  it("lets the host pick the map, and a match stays on it", () => {
    let s = act(lobbyOf(2), "p0", { type: "map", map: "farm" });
    expect(reject(s, "p1", { type: "map", map: "beach" })).toMatch(/host/);
    expect(reject(s, "p0", { type: "map", map: "moon" })).toBeTruthy();
    let r = act(s, "p0", { type: "start", bots: false, t: T0 });
    expect((L.viewFor(r, "p1") as any).raceMap).toBe("farm");
    s = act(s, "p0", { type: "rounds", rounds: 3 });
    s = act(s, "p0", { type: "start", bots: false, t: T0 });
    const seen = [s.raceMap];
    for (let race = 2; race <= 3; race++) {
      s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
      s = act(s, "p1", { type: "pos", d: 10, lane: 1, y: 0, act: "run", hits: 3, t: s.startAt + 1000 });
      s = act(s, "p0", { type: "next", t: s.endAt + 1000 });
      seen.push(s.raceMap);
    }
    expect(seen).toEqual(["farm", "farm", "farm"]);
  });
});

describe("extras: emotes, scores, heart pickups", () => {
  it("relays emotes with a short cooldown, even in the lobby", () => {
    let s = act(lobbyOf(2), "p1", { type: "emote", e: "🔥", t: T0 + 100 });
    expect((L.viewFor(s, "p0") as any).emotes).toEqual([{ id: 1, by: "p1", e: "🔥", at: T0 + 100 }]);
    expect(reject(s, "p1", { type: "emote", e: "😂", t: T0 + 500 })).toMatch(/soon/);
    expect(reject(s, "p0", { type: "emote", e: "🍔", t: T0 + 500 })).toBeTruthy();
  });

  it("keeps everyone's style score and best combo for the results", () => {
    let s = act(lobbyOf(2), "p0", { type: "start", bots: false, t: T0 });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
    s = act(s, "p0", { type: "pos", d: 20, lane: 0, y: 0, act: "run", sc: 340, cb: 7, t: s.startAt + 2000 });
    s = act(s, "p0", { type: "pos", d: 30, lane: 0, y: 0, act: "run", sc: 360, cb: 2, t: s.startAt + 2500 });
    const me = (L.viewFor(s, "p1") as any).players.find((p: any) => p.id === "p0");
    expect([me.sc, me.cb]).toEqual([360, 7]);
  });

  it("puts heart pickups only on survival courses, every few hundred metres", () => {
    expect(L.buildCourse(5).hearts).toEqual([]);
    const h = L.buildCourse(5, 4000).hearts;
    expect(h.length).toBeGreaterThan(5);
    for (let i = 1; i < h.length; i++) expect(h[i]!.z - h[i - 1]!.z).toBeGreaterThan(L.HEART_EVERY_M - 50);
  });
});

describe("hit credit", () => {
  it("credits the thrower when someone slips on their banana or gets bowled", () => {
    let s = act(lobbyOf(2), "p0", { type: "start", bots: false, t: T0 });
    s = L.applyAction(s, "__system", { type: "tick", t: s.startAt });
    s = act(s, "p0", { type: "pos", d: 40, lane: 1, y: 0, act: "run", t: s.startAt + 4000 });
    s = act(s, "p0", { type: "banana", lane: 1, d: 68, t: s.startAt + 4100 });
    s = act(s, "p1", { type: "slip", id: 1, t: s.startAt + 9000 });
    s = act(s, "p0", { type: "bowl", lane: 2, d: 40, dir: -1, t: s.startAt + 9500 });
    s = act(s, "p1", { type: "bowled", id: 1, t: s.startAt + 9800 });
    expect(reject(s, "p0", { type: "bowled", id: 1 })).toBeTruthy(); // can't bowl yourself
    const hits = (L.viewFor(s, "p1") as any).hits.map((h: any) => [h.kind, h.by, h.victim]);
    expect(hits).toEqual([["banana", "p0", "p1"], ["bowling", "p0", "p1"]]);
  });
});

describe("ready check", () => {
  it("lets the host start only once everyone else is ready, and a new pick un-readies you", () => {
    let s: S = L.setup([]);
    s = act(s, "p0", { type: "hello", name: "Ann", char: 0, create: true, t: T0 });
    s = act(s, "p1", { type: "hello", name: "Bob", char: 1, t: T0 + 1 });
    expect(reject(s, "p0", { type: "start", bots: false, t: T0 + 2 })).toMatch(/Waiting for Bob/);
    s = act(s, "p1", { type: "ready", ready: true, t: T0 + 3 });
    expect((L.viewFor(s, "p0") as any).players[1].ready).toBe(true);
    s = act(s, "p1", { type: "pick", char: 2, t: T0 + 4 });
    expect(s.players.p1.ready).toBe(false);
    s = act(s, "p1", { type: "ready", ready: true, t: T0 + 5 });
    s = act(s, "p0", { type: "start", bots: false, t: T0 + 6 });
    expect(s.phase).toBe("countdown");
  });

  it("shows each runner's rank points to the lobby and rejects bad ones", () => {
    let s: S = L.setup([]);
    s = act(s, "p0", { type: "hello", name: "Ann", char: 0, create: true, rp: 420, t: T0 });
    s = act(s, "p1", { type: "hello", name: "Bob", char: 1, create: false, t: T0 + 1 });
    const v = L.viewFor(s, "p1") as any;
    expect(v.players.find((p: any) => p.id === "p0").rp).toBe(420);
    expect(v.players.find((p: any) => p.id === "p1").rp).toBe(0);
    expect(reject(s, "p2", { type: "hello", name: "Cy", char: 2, create: false, rp: -5 })).toBe("bad rank");
  });

});

describe("bots", () => {
  function race(s: S, until: (s: S) => boolean, maxMs = 400000): S {
    let t = s.startAt;
    let hd = 0;
    while (!until(s) && t < s.startAt + maxMs) {
      t += 250;
      s = L.applyAction(s, "SYS", { type: "tick", t });
      hd += L.runSpeed(s.kind, (t - s.startAt) / 1000) * 0.25;
      if (s.phase === "race") s = act(s, "p0", { type: "pos", d: hd, lane: 0, y: 0, act: "run", hits: 0, t });
      // a second real player trips out early, so the race ends on the bots
      if (s.phase === "race" && s.players.p1 && s.players.p1.outAt === null) s = act(s, "p1", { type: "pos", d: 1, lane: 1, y: 0, act: "run", hits: 3, t });
    }
    return s;
  }

  it("fill the empty spots when the host starts, and never become host", () => {
    let s = lobbyOf(2);
    s = act(s, "p0", { type: "start", t: T0 + 50 });
    const v = L.viewFor(s, "p0") as any;
    expect(v.players).toHaveLength(4);
    expect(v.players.filter((p: any) => p.bot)).toHaveLength(2);
    expect(new Set(v.players.map((p: any) => p.char)).size).toBe(4);
    expect(new Set(v.players.map((p: any) => p.name)).size).toBe(4);
    s = act(s, "p0", { type: "leave", t: T0 + 60 });
    expect(s.players[s.host].bot).toBeFalsy();
  });

  it("stay out when asked (solo endless run)", () => {
    let s = lobbyOf(1);
    s = act(s, "p0", { type: "start", bots: false, t: T0 + 50 });
    expect((L.viewFor(s, "p0") as any).players).toHaveLength(1);
  });

  it("run the course, pick up boxes, make mistakes and get knocked out", () => {
    let s = lobbyOf(1);
    s = act(s, "p0", { type: "start", t: T0 + 50 });
    s = race(s, (x) => x.phase === "results");
    expect(s.phase).toBe("results");
    const bots = Object.values(s.players).filter((p: any) => p.bot) as any[];
    expect(bots.every((b) => b.d > 100)).toBe(true);
    expect(bots.every((b) => b.outAt !== null && b.hits >= L.LIVES)).toBe(true);
    expect((s.taken ?? []).length).toBeGreaterThan(0);
  });

  it("pay no medals in a game with only one real player", () => {
    let s = lobbyOf(1);
    s = act(s, "p0", { type: "start", t: T0 + 50 });
    s = race(s, (x) => x.phase === "results");
    const r = (L.viewFor(s, "p0") as any).rewards as any;
    expect(Object.values(r).every((x: any) => x.medal === null)).toBe(true);
  });

  it("finish a sprint", () => {
    let s = lobbyOf(1);
    s = sprint(s);
    s = act(s, "p0", { type: "start", t: T0 + 50 });
    s = race(s, (x) => x.phase === "results");
    const bots = Object.values(s.players).filter((p: any) => p.bot) as any[];
    expect(bots.every((b) => b.finish !== null)).toBe(true);
  });

  it("rematch: everyone votes, the same room (bots too) goes again", () => {
    let s = lobbyOf(2);
    s = act(s, "p0", { type: "start", t: T0 + 50 });
    s = race(s, (x) => x.phase === "results");
    expect(s.phase).toBe("results");
    const round = s.round;
    s = act(s, "p0", { type: "rematch", t: s.now + 10 });
    expect(s.phase).toBe("results");
    expect((L.viewFor(s, "p1") as any).rematch).toEqual(["p0"]);
    expect(reject(s, "bot1", { type: "rematch" })).toBe("join first");
    s = act(s, "p1", { type: "rematch", t: s.now + 20 });
    expect(s.phase).toBe("countdown");
    expect(s.round).toBe(round + 1);
    expect(Object.values(s.players).filter((p: any) => p.bot)).toHaveLength(2);
  });

  it("leave when the host goes back to the lobby", () => {
    let s = lobbyOf(2);
    s = act(s, "p0", { type: "start", t: T0 + 50 });
    s = race(s, (x) => x.phase === "results");
    s = act(s, "p0", { type: "again", t: s.now + 10 });
    expect(Object.values(s.players).some((p: any) => p.bot)).toBe(false);
  });
});

describe("new power-ups", () => {
  function racing(n: number): S {
    let s = lobbyOf(n);
    s = act(s, "p0", { type: "start", bots: false, t: T0 + 50 });
    return L.applyAction(s, "SYS", { type: "tick", t: s.startAt + 10 });
  }
  const at = (s: S, ms: number) => s.startAt + ms;

  it("mind swap trades places with the runner just ahead, and old positions stop counting", () => {
    let s = racing(3);
    s = act(s, "p0", { type: "pos", d: 40, lane: 0, y: 0, act: "run", t: at(s, 5000) });
    s = act(s, "p1", { type: "pos", d: 60, lane: 1, y: 0, act: "run", t: at(s, 5000) });
    s = act(s, "p2", { type: "pos", d: 50, lane: 2, y: 0, act: "run", t: at(s, 5000) });
    s = act(s, "p0", { type: "swap", t: at(s, 5100) });
    expect(s.players.p0.d).toBe(50);
    expect(s.players.p2.d).toBe(40);
    // p2's phone hasn't seen the swap yet: its stale 55 m must not undo it
    s = act(s, "p2", { type: "pos", d: 55, lane: 2, y: 0, act: "run", t: at(s, 5150) });
    expect(s.players.p2.d).toBe(40);
    s = act(s, "p2", { type: "pos", d: 41, lane: 2, y: 0, act: "run", w: 1, t: at(s, 5200) });
    expect(s.players.p2.d).toBe(41);
    expect(reject(s, "p1", { type: "swap" })).toBe("nobody ahead");
  });

  it("a thundercloud sits on the leader, passes on contact, and strikes after 5 s", () => {
    let s = racing(3);
    s = act(s, "p0", { type: "pos", d: 20, lane: 0, y: 0, act: "run", t: at(s, 3000) });
    s = act(s, "p1", { type: "pos", d: 50, lane: 1, y: 0, act: "run", t: at(s, 3000) });
    s = act(s, "p2", { type: "pos", d: 49, lane: 1, y: 0, act: "run", t: at(s, 3000) });
    s = act(s, "p0", { type: "thunder", t: at(s, 3100) });
    expect(s.cloud.holder).toBe("p1");
    s = L.applyAction(s, "SYS", { type: "tick", t: at(s, 4000) });
    expect(s.cloud.holder).toBe("p2");
    s = act(s, "p2", { type: "pos", d: 70, lane: 3, y: 0, act: "run", t: at(s, 5000) });
    s = L.applyAction(s, "SYS", { type: "tick", t: at(s, 8200) });
    expect(s.cloud).toBeNull();
    expect(s.zaps.at(-1)).toMatchObject({ kind: "thunder", target: "p2", by: "p0" });
  });

  it("glue covers two lanes, slows instead of tripping, and dries up", () => {
    let s = racing(2);
    s = act(s, "p0", { type: "pos", d: 30, lane: 3, y: 0, act: "run", t: at(s, 3000) });
    s = act(s, "p0", { type: "banana", kind: "glue", lane: 3, d: 25, t: at(s, 3100) });
    expect(L.glueLane2(3)).toBe(2);
    s = act(s, "p1", { type: "slip", id: 1, t: at(s, 3500) });
    expect(s.bananas).toHaveLength(1); // still there for the next runner
    s = L.applyAction(s, "SYS", { type: "tick", t: at(s, 3100 + L.GLUE_MS + 10) });
    expect(s.bananas).toHaveLength(0);
  });

  it("the boxing glove shoves a nearby runner a lane over", () => {
    let s = racing(2);
    s = act(s, "p0", { type: "pos", d: 30, lane: 1, y: 0, act: "run", t: at(s, 3000) });
    s = act(s, "p1", { type: "pos", d: 33, lane: 2, y: 0, act: "run", t: at(s, 3000) });
    s = act(s, "p0", { type: "punch", target: "p1", t: at(s, 3100) });
    expect(s.punches.at(-1)).toMatchObject({ by: "p0", target: "p1", dir: 1 });
    s = act(s, "p1", { type: "pos", d: 80, lane: 2, y: 0, act: "run", t: at(s, 6000) });
    expect(reject(s, "p0", { type: "punch", target: "p1" })).toBe("too far");
  });
});

describe("new modes", () => {
  function start(mode: string, n = 2): S {
    let s = act(lobbyOf(n), "p0", { type: "mode", mode });
    s = act(s, "p0", { type: "start", bots: false, t: T0 });
    return L.applyAction(s, "SYS", { type: "tick", t: s.startAt + 5 });
  }
  const at = (s: S, ms: number) => s.startAt + ms;
  const pos = (d: number, t: number, extra: Record<string, unknown> = {}) => ({ type: "pos", d, lane: 0, y: 0, act: "run", hits: 0, t, ...extra });

  it("brain chase: the brain speeds up and catches whoever falls behind", () => {
    expect(L.brainDistance(0)).toBe(-L.CHASE_GAP_M);
    expect(L.brainDistance(60)).toBeGreaterThan(L.brainDistance(30) * 2);
    let s = start("chase");
    // p0 keeps up, p1 dawdles
    s = act(s, "p0", pos(200, at(s, 15000)));
    s = act(s, "p1", pos(60, at(s, 15000)));
    s = L.applyAction(s, "SYS", { type: "tick", t: at(s, 16000) });
    expect(L.brainDistance(16)).toBeGreaterThan(60);
    expect(s.players.p1.outAt).not.toBeNull();
    expect(s.players.p0.outAt).toBeNull();
    expect(s.phase).toBe("results");
    expect(L.standings(s)[0]).toBe("p0");
  });

  it("coin rush: coins sit in open lanes, are first come first served, and hits spill them", () => {
    let s = start("coinrush");
    const coins = L.coinLines(L.buildCourse(s.seed, L.SURVIVAL_LEN));
    expect(coins.length).toBeGreaterThan(50);
    const c0 = coins[0]!;
    s = act(s, "p0", pos(c0.z, at(s, 6000)));
    s = act(s, "p0", { type: "coin", i: 0, t: at(s, 6000) });
    expect(reject(s, "p1", { type: "coin", i: 0 })).toBe("coin gone");
    for (let i = 1; i < 6; i++) {
      s = act(s, "p0", pos(coins[i]!.z, at(s, 6000 + i * 200)));
      s = act(s, "p0", { type: "coin", i, t: at(s, 6000 + i * 200) });
    }
    const had = s.players.p0.coins;
    expect(had).toBeGreaterThanOrEqual(6);
    s = act(s, "p0", pos(coins[5]!.z + 5, at(s, 8000), { hits: 1 }));
    expect(s.players.p0.coins).toBe(had - L.COIN_SPILL);
    expect(s.loose).toHaveLength(1);
    s = act(s, "p1", { type: "coin", loose: s.loose[0].id, t: at(s, 8100) });
    expect(s.players.p1.coins).toBe(L.COIN_SPILL);
    // most coins wins when the clock runs out
    s = L.applyAction(s, "SYS", { type: "tick", t: at(s, L.COINRUSH_MS + 10) });
    expect(s.phase).toBe("results");
    expect(L.standings(s)[0]).toBe("p1");
  });

  it("coin rush: taken coins come back after a while", () => {
    let s = start("coinrush");
    const coins = L.coinLines(L.buildCourse(s.seed, L.SURVIVAL_LEN));
    s = act(s, "p0", pos(coins[0]!.z, at(s, 3000), { lane: coins[0]!.lane }));
    s = act(s, "p0", { type: "coin", i: 0, t: at(s, 3000) });
    expect(s.coinsTaken).toContain(0);
    s = L.applyAction(s, "SYS", { type: "tick", t: at(s, 3000 + L.COIN_RESPAWN_MS - 100) });
    expect(s.coinsTaken).toContain(0);
    s = L.applyAction(s, "SYS", { type: "tick", t: at(s, 3000 + L.COIN_RESPAWN_MS + 50) });
    expect(s.coinsTaken).not.toContain(0);
  });

});

describe("moving obstacles", () => {
  it("each map gets its own two movers, spaced out in the wide gaps", () => {
    const course = L.buildCourse(7, L.SURVIVAL_LEN);
    for (const map of L.MAPS) {
      const ms = L.moversFor(course, 7, map);
      expect(ms.length).toBeGreaterThan(20);
      expect(new Set(ms.map((m) => m.kind)).size).toBe(2);
      // themed maps borrow a classic map's movers
      const base = L.MAP_MOVERS[map] ?? (L.MAPS.indexOf(map) < 6 ? map : "meadow");
      expect(ms.every((m) => L.MOVER_KINDS[m.kind]!.map === base)).toBe(true);
      expect(ms[0]!.z).toBeGreaterThan(140);
      for (let i = 1; i < ms.length; i++) expect(ms[i]!.z - ms[i - 1]!.z).toBeGreaterThan(100);
    }
  });

  it("has a recipe for every themed map, with the same movers", async () => {
    const { THEMES } = await import("../public/themes.js");
    expect(L.MAPS.slice(6)).toEqual(THEMES.map((t: { id: string }) => t.id));
    expect(L.MAPS.length).toBe(19);
    for (const t of THEMES as { id: string; movers?: string }[]) expect(L.MAP_MOVERS[t.id]).toBe(t.movers);
  });

  it("sweep across all four lanes and back on the shared clock", () => {
    const m = { kind: "tractor", z: 200, phase: 0 };
    const p = L.MOVER_KINDS.tractor!.period;
    expect(L.moverX(m, 0)).toBeCloseTo(0);
    expect(L.moverX(m, p / 2)).toBeCloseTo(3);
    expect(L.moverX(m, p)).toBeCloseTo(0);
    expect(L.moverCovers(m, 0, 0)).toBe(true);
    expect(L.moverCovers(m, 3, 0)).toBe(false);
  });
});
