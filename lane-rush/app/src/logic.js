/**
 * BRAIN RUN — the rules. Pure functions over JSON state.
 *
 * How the race works:
 *   - One player creates a lobby (the room code), up to three more join with
 *     the code. The host presses START.
 *   - Everyone runs the SAME seeded course (see buildCourse) on a four-lane
 *     grass track. Each client simulates its own runner (jump / slide / lane
 *     change, obstacle hits) for instant controls, and streams its progress.
 *   - The server is the referee: it owns the clock (the room injects `t`, the
 *     server time, into every action), caps how far anyone can possibly have
 *     run, records finish times, and ends the race.
 *
 * Time never comes from Date.now() here: the room passes it in as `action.t`,
 * so these functions stay deterministic.
 *
 * This file is also served to the browser as /logic.js (see scripts/build.mjs),
 * so the client builds the exact same course from the same seed and uses the
 * same constants for its physics.
 */

export const meta = { game: "Brain Run", minPlayers: 1, maxPlayers: 4 };

// ── shared tuning (client physics reads these too) ──────────────────────────

export const TRACK_LEN = 700; // metres
export const LANES = 4;
export const MAX_RUNNERS = 4;
export const BASE_SPEED = 12; // m/s
export const BOOST_SPEED = 18; // m/s while a boost pad is active
export const ROCKET_SPEED = 25; // m/s riding a rocket in a sprint (about double running)
export const COUNTDOWN_MS = 3500;
export const RACE_LIMIT_MS = 90000; // hard cap on a race
export const AFTER_FIRST_MS = 15000; // stragglers get this long after the winner
export const LOBBY_GRACE_MS = 10000; // a dropped lobby player keeps their spot this long
export const CHARACTERS = 8; // 4 starters + 4 shop skins

/**
 * Ways to play (the lobby host picks one):
 *   survival   — the main game: an endless run that keeps getting faster;
 *                everyone has 3 hearts, each hit costs one, and the last
 *                runner still going wins (alone: run as far as you can)
 *   chase      — Brain Chase: a giant brain rolls after everyone and keeps
 *                speeding up; caught = out, last one running wins
 *   coinrush   — Coin Rush: 90 s, most coins wins; a hit spills your coins
 *   potato     — Hot Potato: a bomb on a random fuse, passed on by bumping
 *                into someone; it costs whoever holds it a heart (3 = out)
 *   cup        — Party Cup: three different rounds of the above, in a random
 *                order; placings score CUP_POINTS, most points wins
 *   grandtour  — Grand Tour tournament: every round kind once, in a random order
 * Empty spots are filled with bots. (The old 700 m "sprint" race still runs
 * if a kind is "sprint", but no mode starts one any more.)
 * `state.mode` is what the host picked; `state.kind` is the race being run.
 * The host can also pick "random" as the mode or the map: it's drawn when each race starts.
 */
export const GAME_MODES = ["survival", "chase", "coinrush", "potato", "grandtour", "random"];
/** Modes played over several rounds with a points table. */
export const CUP_MODES = ["grandtour"];
/** How many rounds the host can pick for a match (the Grand Tour is always one of each mode). */
export const ROUND_OPTIONS = [1, 3, 5];
/** What the host can put up for 1st / 2nd / 3rd (paid with 2+ real players). */
export const PRIZES = ["none", "coins", "bigcoins", "pack"];
/** The modes a single round can be (a Party Cup is three of these). All run on the endless course. */
export const ROUND_KINDS = ["survival", "chase", "coinrush", "potato"];
export const isEndless = (kind) => kind !== "sprint";
/**
 * Brain Chase: a giant brain rolls after everyone, starting this far behind
 * the start line, at 9 m/s and +0.14 m/s every second (it overtakes the
 * runners' own speed-up after a minute or so). Caught = out.
 */
export const CHASE_GAP_M = 35;
export function brainDistance(s) {
  const t = Math.max(0, s);
  const tCap = (36 - 9) / 0.14; // top speed reached
  if (t <= tCap) return -CHASE_GAP_M + 9 * t + 0.07 * t * t;
  return -CHASE_GAP_M + 9 * tCap + 0.07 * tCap * tCap + 36 * (t - tCap);
}
/** Coin Rush: 90 seconds, most coins wins; a hit spills some of yours for others to grab. */
export const COINRUSH_MS = 90000;
export const COIN_SPILL = 5;
/** Coin Rush: a coin someone took comes back this long after, so nobody runs dry. */
export const COIN_RESPAWN_MS = 5000;
export const LOOSE_MS = 15000;
/** Hot Potato: the bomb blows after a random fuse; pass it by bumping into someone. */
export const POTATO_FIRST_MS = 3000;
export const POTATO_NEXT_MS = 2500;
export const BOMB_PASS_M = 1.8;
/** Hot Potato: the holder can also throw the bomb to the nearest runner this close (any lane, ahead or behind). */
export const BOMB_THROW_M = 12;
/** Quick reactions anyone can show above their runner. */
export const EMOTES = ["👋", "😂", "🔥", "😱", "😎", "💪"];
/** Emotes you can buy in the shop (anyone may send them; the shop decides who sees the button). */
export const SHOP_EMOTES = ["👑", "🧠", "🤡", "🥶", "💩", "🫡"];
/** Running trails (cosmetic): everyone in the race sees yours. "" = none. */
export const TRAILS = ["", "sparkle", "bubbles", "fire", "rainbow", "lightning", "gold", "neon"];
export const EMOTE_COOLDOWN_MS = 1200;
/** In survival a heart floats over the track every so often: grab it to win back a lost heart. */
export const HEART_EVERY_M = 420;

/** Where you race. The host picks one; a Party Cup visits them in turn. */
export const MAPS = ["meadow", "farm", "beach", "city", "stadium", "space"];
/** A Party Cup is three rounds; each placing scores points, most points wins. */
export const CUP_ROUND_BOOST_M = 350;
export const CUP_POINTS = [10, 5, 3, 1];
/** Rank points are reported by each player's device (shown to friends in the lobby). */
export const MAX_RP = 999999;
export const LIVES = 3;
export const SURVIVAL_LEN = 9000; // metres of course generated; nobody lasts this long
export const SURVIVAL_LIMIT_MS = 10 * 60 * 1000;
export const SURVIVAL_MAX_SPEED = 24; // the ramp tops out here (after ~3 minutes)…
export const SURVIVAL_BOOST = 5; // …and a boost adds this on top
export const SURVIVAL_ROCKET = 10; // a rocket adds this on top of your running speed
/**
 * The longer a round goes, the faster everybody runs.
 *   survival: +0.1 m/s every second for 70 s (12 → 19), then +0.04 m/s per
 *             second up to 24 m/s (around the 3-minute mark)
 *   sprint:   +0.06 m/s every second, up to 16 m/s at the finish
 */
export const SPRINT_MAX_SPEED = 16;
export function survivalSpeed(s) {
  const t = Math.max(0, s);
  return Math.min(SURVIVAL_MAX_SPEED, BASE_SPEED + 0.1 * Math.min(t, 70) + 0.04 * Math.max(0, t - 70));
}
export function sprintSpeed(s) {
  return Math.min(SPRINT_MAX_SPEED, BASE_SPEED + 0.06 * Math.max(0, s));
}
export function runSpeed(kind, s) {
  return isEndless(kind) ? survivalSpeed(s) : sprintSpeed(s);
}

/**
 * Power-ups come out of mystery boxes on the course. The client rolls which
 * one you get.
 *   shield    — the next hit (obstacle or zap) just pops the bubble
 *   rocket    — fly over everything at boost speed for a few seconds
 *   ghost     — run straight through obstacles for a few seconds
 *   lightning — everyone ahead of you falls over (unless shielded); power-ups trip and slow, they never cost a heart
 *   banana    — thrown ahead or dropped behind, into a lane you pick; whoever
 *               runs onto it slips
 *   bowling   — rolled ahead or back down a lane you pick; knocks over whoever
 *               it reaches in that lane (jump it!)
 *   freeze    — everyone else runs slowly for a few seconds (unless shielded)
 * You hold one power-up at a time and use it when you want (boxes are
 * ignored while you hold or use one). Zaps and bananas go through the server.
 */
export const POWERS = ["shield", "rocket", "lightning", "banana", "bowling", "freeze", "glue", "fake", "boxing", "brainwave", "thunder", "swap"];

/**
 * Mystery-box odds, in percent. Each item has a chance for the leader and a
 * chance for the runner in last place; everyone in between is blended by
 * their `standing` (0 = leading … 1 = last). Leaders get mostly defence,
 * runners at the back get the big catch-up items. Each column adds up to 100.
 *
 *              leader  last
 *   shield       25      5
 *   banana       25      5
 *   bowling      15      5    (rolls back: needs someone behind you)
 *   glue         15      0    (dropped behind you)
 *   fake         15      5    (a fake mystery box, dropped behind you)
 *   boxing        5      5    (punches whoever is right next to you)
 *   freeze        0     15
 *   rocket        0     20
 *   lightning     0     10    (hits runners ahead: needs someone ahead)
 *   brainwave     0     10    (flips controls of everyone ahead)
 *   thunder       0     10    (a storm cloud on the leader; pass it on by touching)
 *   swap          0     10    (swap places with the runner ahead; back half only)
 *
 * Alone there's nobody to attack, so it's shield 35 · rocket 35 · banana 30.
 */
const ODDS = {
  shield: [25, 5],
  banana: [25, 5],
  bowling: [15, 5],
  glue: [15, 0],
  fake: [15, 5],
  boxing: [5, 5],
  freeze: [0, 15],
  rocket: [0, 20],
  lightning: [0, 10],
  brainwave: [0, 10],
  thunder: [0, 10],
  swap: [0, 10],
};
const SOLO_ODDS = { shield: 35, rocket: 35, banana: 30 };
/** How far behind the leader (metres) counts as "as far back as it gets". */
const GAP_FULL_M = 80;

/**
 * Your standing for the odds, 0 (leading) … 1 (last). Half comes from your
 * rank among the runners still in the race (knocked-out runners don't
 * count), half from how far behind the leader you are, so a close second
 * gets leader-ish items and someone 80 m back gets the full catch-up set.
 */
export function standingFor(rank, alive, gapToLeader) {
  if (alive <= 1 || rank <= 1) return 0;
  const byRank = (rank - 1) / (alive - 1);
  const byGap = Math.min(1, Math.max(0, gapToLeader) / GAP_FULL_M);
  return 0.5 * byRank + 0.5 * byGap;
}

/**
 * Percent chance of each power-up for a runner at `rank` (1 = leading) of
 * `alive` runners, `gapToLeader` metres behind the first. `last` is the item
 * you got last time: you never get the same one twice in a row. Items that
 * would be useless right now (lightning in 1st, bowling in last) are left
 * out, and the rest scaled back up to 100.
 */
export function powerOdds({ rank, alive, gapToLeader = 0, last = "" }) {
  let w;
  if (alive <= 1) {
    w = { ...SOLO_ODDS };
  } else {
    const t = standingFor(rank, alive, gapToLeader);
    w = {};
    for (const [k, [lead, back]] of Object.entries(ODDS)) w[k] = lead + (back - lead) * t;
    if (rank <= 1) w.lightning = w.brainwave = w.thunder = w.swap = 0;
    if (t < 0.5) w.swap = 0;
    if (rank >= alive) w.bowling = w.glue = w.fake = 0;
  }
  if (last && w[last] !== undefined) w[last] = 0;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  const out = {};
  for (const k of POWERS) out[k] = total > 0 ? ((w[k] ?? 0) * 100) / total : 0;
  return out;
}

/** Turn odds into an item with a random number in [0, 1). */
export function pickPower(odds, roll) {
  let left = roll * 100;
  for (const k of POWERS) {
    if (odds[k] <= 0) continue;
    left -= odds[k];
    if (left < 0) return k;
  }
  return POWERS.filter((k) => odds[k] > 0).pop() ?? "shield";
}

/** The power-up everyone starts a race with: defensive or neutral, same odds for all. */
export const START_POWERS = ["shield", "banana", "fake"];
/** Powers relayed to everyone through the server as a "zap" (an area effect). */
export const ZAP_KINDS = ["lightning", "freeze", "brainwave"];
/** Things dropped on the track: a banana trips you, glue slows you (2 lanes, stays a while), a fake box trips you. */
export const DROP_KINDS = ["banana", "glue", "fake"];
export const GLUE_MS = 8000; // a glue puddle stays this long
export const CLOUD_MS = 5000; // a thundercloud strikes after this long…
export const CLOUD_PASS_M = 1.8; // …unless its holder runs into someone (this close, same lane)
export const PUNCH_RANGE_M = 10;
/** How far a player's boxing glove reaches (bots only swing at PUNCH_RANGE_M). */
export const PUNCH_REACH_M = 25;
export const BOWL_SPEED = 30; // m/s the ball rolls (faster than anyone runs, either way)
export const BOWL_RANGE_M = 90; // …and how far before it's gone
export const BANANA_AHEAD_M = 28; // a thrown banana lands this far in front of you…
export const BANANA_BEHIND_M = 5; // …or a dropped one this far behind
export const BANANA_COOLDOWN_MS = 1200;
export const ZAP_COOLDOWN_MS = 3000;
export const ROLLER_SPEED = 6; // m/s a barrel rolls toward you once it's triggered
export const ROLLER_TRIGGER_M = 34; // a barrel starts rolling when you're this close
/** How many visual variants each obstacle kind has (same collision rules). */
export const LOOKS = { hurdle: 2, gate: 2, crate: 3, roller: 1 };

/** Countries a runner can cheer for (ISO 3166 alpha-2 + English name). */
export const COUNTRIES = [
  ["US", "United States"], ["GB", "United Kingdom"], ["DE", "Germany"], ["FR", "France"],
  ["IT", "Italy"], ["ES", "Spain"], ["PT", "Portugal"], ["NL", "Netherlands"],
  ["BE", "Belgium"], ["CH", "Switzerland"], ["AT", "Austria"], ["SE", "Sweden"],
  ["NO", "Norway"], ["DK", "Denmark"], ["PL", "Poland"], ["TR", "Türkiye"],
  ["GR", "Greece"], ["UA", "Ukraine"], ["BR", "Brazil"], ["AR", "Argentina"],
  ["MX", "Mexico"], ["CA", "Canada"], ["JP", "Japan"], ["KR", "South Korea"],
  ["CN", "China"], ["IN", "India"], ["AU", "Australia"], ["ZA", "South Africa"],
  ["NG", "Nigeria"], ["EG", "Egypt"], ["IR", "Iran"], ["CO", "Colombia"],
  ["PE", "Peru"],
];
const COUNTRY_CODES = new Set(COUNTRIES.map(([c]) => c));

/**
 * Medals for the podium: 1st gold, 2nd silver, 3rd bronze. 4th place, runners
 * who didn't finish and runners who left get nothing. Medals are only handed
 * out when at least two people raced, so solo practice can't farm them.
 * `worth` is what a medal counts for when paying in the shop.
 */
export const MEDALS = ["gold", "silver", "bronze"];
export const MEDAL_WORTH = { gold: 10, silver: 5, bronze: 3 };
export const MIN_RACERS_FOR_MEDALS = 2;

/** Fastest anyone can legitimately be, plus slack for network jitter. */
const SPEED_CAP = ROCKET_SPEED + 1.5;
const SURVIVAL_SPEED_CAP = SURVIVAL_MAX_SPEED + SURVIVAL_ROCKET + 1.5;
const POS_SLACK_M = 6;
const ACTS = ["run", "jump", "slide", "stumble", "idle", "out"];
const POWER_STATES = ["", "shield", "rocket", "ghost"];

// ── course ──────────────────────────────────────────────────────────────────

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Expected running speed (m/s) at distance `d` of a survival run (v² = v0² + 2ad, capped). */
export function speedAtDistance(kind, d) {
  const x = Math.max(0, d);
  if (!isEndless(kind)) return Math.min(SPRINT_MAX_SPEED, Math.sqrt(BASE_SPEED * BASE_SPEED + 0.12 * x));
  // the same ramp as survivalSpeed, by distance: v² = v0² + 2·a·d per phase
  const D1 = 12 * 70 + 0.05 * 70 * 70; // metres run in the first 70 s
  if (x <= D1) return Math.sqrt(BASE_SPEED * BASE_SPEED + 0.2 * x);
  return Math.min(SURVIVAL_MAX_SPEED, Math.sqrt(19 * 19 + 0.08 * (x - D1)));
}

/**
 * Obstacle patterns. Each returns one or more rows (lanes left→right). Every
 * row keeps at least one lane you can get through (empty, or a hurdle/gate
 * you can clear), and the difficulty manager below checks that you can
 * actually *reach* it in time from wherever the previous row left you.
 *   H hurdle → jump · G gate → slide · C crate → change lane · R barrel → jump/dodge
 */
const PATTERNS = {
  // one obstacle in an otherwise open row: learn the moves one at a time
  hurdleOne: { rows: (r) => [placeOne(r, "hurdle")] },
  gateOne: { rows: (r) => [placeOne(r, "gate")] },
  crateOne: { rows: (r) => [placeOne(r, "crate")] },
  // a full wall of the same thing: jump it or slide under it
  hurdleWall: { rows: () => [["hurdle", "hurdle", "hurdle", "hurdle"]] },
  gateWall: { rows: () => [["gate", "gate", "gate", "gate"]] },
  // two crates; the other lanes are open or hold something to jump or duck
  split: {
    rows: (r) => {
      const lanes = [0, 1, 2, 3].map(() => pickFrom(r, [null, "hurdle", "gate"]));
      for (const i of shuffled(r).slice(0, 2)) lanes[i] = "crate";
      return [lanes];
    },
  },
  // every lane has a hurdle or a gate: read the row and pick jump or slide
  mixedWall: {
    rows: (r) => {
      const lanes = [0, 1, 2, 3].map(() => (r() < 0.5 ? "hurdle" : "gate"));
      if (lanes.every((x) => x === lanes[0])) lanes[Math.floor(r() * 4)] = lanes[0] === "hurdle" ? "gate" : "hurdle";
      return [lanes];
    },
  },
  // barrels roll at you; the lanes next to them are free
  barrels: { lead: 16, tail: 10, rows: (r) => [placeOne(r, "roller")] },
  barrels2: {
    lead: 16,
    tail: 10,
    rows: (r) => {
      const lanes = [null, null, null, null];
      const a = Math.floor(r() * 4);
      lanes[a] = "roller";
      lanes[(a + 2) % 4] = "roller";
      return [lanes];
    },
  },
  // three crates and a gate in the gap: get over there and duck
  tunnel: {
    rows: (r) => {
      const lanes = ["crate", "crate", "crate", "crate"];
      lanes[Math.floor(r() * 4)] = "gate";
      return [lanes];
    },
  },
  // slalom: three crates per row and the gap moves one lane each row
  slalom2: { rows: (r) => slalom(r, 2) },
  slalom3: { rows: (r) => slalom(r, 3) },
  // jump, then slide straight away (or the other way round)
  combo: {
    rows: (r) => (r() < 0.5 ? [["hurdle", "hurdle", "hurdle", "hurdle"], ["gate", "gate", "gate", "gate"]] : [["gate", "gate", "gate", "gate"], ["hurdle", "hurdle", "hurdle", "hurdle"]]),
  },
  // a slalom where every gap also needs a jump or a slide
  zigzag: {
    rows: (r) => slalom(r, 3).map((lanes, i) => lanes.map((k) => (k === null ? (i % 2 ? "gate" : "hurdle") : k))),
  },
};
function slalom(r, n) {
  let open = Math.floor(r() * 4);
  const dir = open === 0 ? 1 : open === 3 ? -1 : r() < 0.5 ? -1 : 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const lanes = ["crate", "crate", "crate", "crate"];
    lanes[open] = null;
    out.push(lanes);
    const next = open + dir;
    open = next < 0 || next > 3 ? open - dir : next;
  }
  return out;
}

/**
 * The difficulty manager: the run is split into stages by distance. Each
 * stage has its own pattern mix and a reaction budget (seconds between rows
 * at the speed you'll be going there). New mechanics arrive one at a time:
 * the first time an obstacle type shows up it gets extra room and is marked
 * `intro` so the game can tell you what to do. Breathers (a box and a boost
 * pad, no obstacles) give you a moment between the hard parts.
 *   Warm-up       0 m    single hurdles, then gates, then walls, then a crate
 *   Getting going 250 m  crates with things to jump/duck, the first barrels
 *   In the zone   700 m  mixed walls, tunnels, two-row slaloms
 *   Pro           1.4 km three-row slaloms, jump-then-slide combos, barrel pairs
 *   Master        2.4 km zigzags, everything, tightest (but always fair) timing
 */
export const STAGES = [
  { name: "Warm-up", from: 0, react: 1.7, mix: { hurdleOne: 4, gateOne: 3, hurdleWall: 1.5, gateWall: 1.5, crateOne: 2 } },
  { name: "Getting going", from: 250, react: 1.4, mix: { hurdleOne: 1, gateOne: 1, crateOne: 1, hurdleWall: 1, gateWall: 1, split: 2.5, barrels: 1.2, breather: 0.7 } },
  { name: "In the zone", from: 700, react: 1.2, mix: { split: 2, mixedWall: 1.6, barrels: 1, tunnel: 1.2, slalom2: 1.5, hurdleWall: 0.5, gateWall: 0.5, breather: 0.55 } },
  { name: "Pro", from: 1400, react: 1.05, mix: { split: 1.2, mixedWall: 1.5, tunnel: 1, slalom2: 1, slalom3: 1.3, combo: 1.2, barrels2: 1, breather: 0.45 } },
  { name: "Master", from: 2400, react: 0.92, mix: { mixedWall: 1.3, tunnel: 1, slalom3: 1.5, combo: 1.3, zigzag: 1.2, barrels2: 1, split: 1, breather: 0.35 } },
];
/** In the warm-up, each first-time pattern waits until here (so they come one at a time). */
const FIRST_AT = { hurdleOne: 0, gateOne: 90, hurdleWall: 150, gateWall: 190, crateOne: 220 };
export function stageAt(z) {
  let st = STAGES[0];
  for (const x of STAGES) if (z >= x.from) st = x;
  return st;
}

/**
 * Fairness check between two rows. To clear a row you must be in a lane with
 * nothing (run), a hurdle (jump) or a gate (slide); crates and barrels need
 * another lane. Getting from lane a (done with `act`) to lane b in time needs:
 * a moment to react + lane changes + finishing the jump/slide you were in +
 * starting the next jump/slide early enough.
 */
export const REACT_S = 0.3;
export const LANE_S = 0.12; // seconds per lane change
const RECOVER_S = { run: 0, jump: 0.33, slide: 0.38 };
const LEAD_S = { run: 0, jump: 0.25, slide: 0.12 };
const actFor = (k) => (k === null ? "run" : k === "hurdle" ? "jump" : k === "gate" ? "slide" : null);
export function needSeconds(fromLane, fromAct, toLane, toAct) {
  return REACT_S + Math.abs(fromLane - toLane) * LANE_S + RECOVER_S[fromAct] + LEAD_S[toAct];
}
/** The worst case over the lanes you might be in: the time needed to reach a way through `row`. */
function worstNeed(reach, row) {
  let worst = 0;
  for (const [a, actA] of reach) {
    let best = Infinity;
    row.lanes.forEach((k, b) => {
      const actB = actFor(k);
      if (actB) best = Math.min(best, needSeconds(a, actA, b, actB));
    });
    worst = Math.max(worst, best);
  }
  return worst;
}
/** Lanes (and what you did there) you can be in after clearing `row`, given `dt` seconds from `reach`. */
function nextReach(reach, row, dt) {
  const out = new Map();
  row.lanes.forEach((k, b) => {
    const actB = actFor(k);
    if (!actB) return;
    for (const [a, actA] of reach) if (needSeconds(a, actA, b, actB) <= dt + 1e-6) out.set(b, actB);
  });
  return out;
}
/**
 * Check a whole course: from every lane you could be in at one row, there is
 * a way through the next row you can reach in time. Returns the problems
 * (empty = fair). Used by the tests; the generator applies the same rule as it
 * builds, widening a gap whenever a pattern would be too tight.
 */
export function checkCourse(course, kind = "survival") {
  const problems = [];
  let reach = new Map([[0, "run"], [1, "run"], [2, "run"], [3, "run"]]);
  let prevZ = 0;
  for (const row of course.rows) {
    if (!row.lanes.some((k) => actFor(k))) problems.push({ z: row.z, why: "no way through" });
    const dt = (row.z - prevZ) / speedAtDistance(kind, prevZ);
    const need = worstNeed(reach, row);
    if (need > dt + 1e-6) problems.push({ z: row.z, why: `needs ${need.toFixed(2)} s, has ${dt.toFixed(2)} s` });
    reach = nextReach(reach, row, Math.max(dt, need));
    prevZ = row.z;
  }
  return problems;
}

function pickFrom(r, arr) {
  return arr[Math.floor(r() * arr.length)];
}
// Fisher–Yates, not sort(): sort order with a random comparator differs
// between browser engines, and every client must build the same course.
function shuffled(r) {
  const order = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
function placeOne(r, kind) {
  const lanes = [null, null, null, null];
  lanes[Math.floor(r() * 4)] = kind;
  return lanes;
}

/**
 * The course for a seed: patterns picked by the difficulty manager (see
 * STAGES), boost pads, mystery boxes and (endless runs) heart pickups.
 * `boost` (metres) starts the difficulty further along: later Party Cup rounds
 * open harder. Rows are spaced by the stage's reaction budget at the speed
 * you'll be running there, and then widened if the fairness check needs it.
 * The same pattern never comes twice in a row. `looks[lane]` picks the
 * visual variant of each obstacle; it never changes how it's cleared.
 */
export function buildCourse(seed, len = TRACK_LEN, boost = 0) {
  const r = rng(seed);
  // looks and boxes use their own stream, so they don't reshuffle the layout
  const r2 = rng((seed ^ 0x9e3779b9) >>> 0);
  const endless = len > TRACK_LEN;
  const kind = endless ? "survival" : "sprint";
  const rows = [];
  const boosts = [];
  const boxes = [];
  const hearts = [];
  const seen = new Set();
  const taught = new Set();
  let lastHeart = 0;
  let z = 45;
  let last = "";
  let sinceBox = 0;
  let sinceRest = 0;
  let reach = new Map([[0, "run"], [1, "run"], [2, "run"], [3, "run"]]);
  let prevZ = 0;
  const addBox = (bz) => {
    const first = Math.floor(r2() * 4);
    boxes.push({ z: Math.round(bz * 10) / 10, lane: first });
    if (r2() < 0.45) boxes.push({ z: Math.round(bz * 10) / 10, lane: (first + 1 + Math.floor(r2() * 3)) % 4 });
    sinceBox = 0;
  };
  while (z < len - 40) {
    const dz = z + boost; // difficulty distance
    const stage = stageAt(dz);
    const speed = speedAtDistance(kind, z);
    const step = speed * stage.react;

    // the stage's mix, minus last pattern, minus warm-up patterns not due yet
    // barrels only once crates have been taught (you learn to change lanes first)
    const due = Object.entries(stage.mix).filter(([n]) => !(dz < 250 && FIRST_AT[n] !== undefined && dz < FIRST_AT[n]) && !(n.startsWith("barrels") && !seen.has("crate")));
    const fresh = due.filter(([n]) => n !== last);
    const mix = fresh.length ? fresh : due;
    // after a long hard stretch, force a breather
    const forceRest = endless && sinceRest >= 9 && stage.mix.breather;
    // the warm-up teaches in order: each lesson comes as soon as it's due
    const lesson = dz < 400 ? Object.keys(FIRST_AT).find((n) => !taught.has(n) && FIRST_AT[n] <= dz) : null;
    let name = forceRest ? "breather" : lesson ?? mix[mix.length - 1][0];
    if (lesson) taught.add(lesson);
    if (!forceRest && !lesson) {
      let total = 0;
      for (const [, w] of mix) total += w;
      let roll = r() * total;
      for (const [n, w] of mix) {
        roll -= w;
        if (roll <= 0) {
          name = n;
          break;
        }
      }
    }
    last = name;

    if (name === "breather") {
      addBox(z + step * 0.3);
      boosts.push({ z: Math.round((z + step * 0.8) * 10) / 10, lane: Math.floor(r() * 4) });
      z += step * 1.6;
      sinceRest = 0;
      continue;
    }
    sinceRest += 1;
    const pat = PATTERNS[name];
    z += pat.lead ?? 0;
    const out = pat.rows(r);
    let stop = false;
    out.forEach((lanes, i) => {
      if (stop || z >= len - 40) return (stop = true);
      const looks = lanes.map((k) => (k ? Math.floor(r2() * LOOKS[k]) : 0));
      const row = { z: 0, lanes, looks };
      // a first-ever obstacle type gets room and a hint
      const fresh = lanes.find((k) => k && !seen.has(k));
      if (fresh) {
        seen.add(fresh);
        row.intro = fresh;
        if (rows.length) z += step * 0.6;
      }
      // fairness: widen the gap if this row can't be reached from every lane you might be in
      const need = worstNeed(reach, row) * speedAtDistance(kind, prevZ);
      if (z - prevZ < need) z = prevZ + need + 0.5;
      row.z = Math.round(z * 10) / 10;
      reach = nextReach(reach, row, (row.z - prevZ) / speedAtDistance(kind, prevZ));
      prevZ = row.z;
      rows.push(row);
      if (i < out.length - 1) z += step;
    });
    if (stop) break;
    // room to land and line up for the next pattern (more slack early on)
    const k = Math.min(1, dz / 2400);
    const gap = step * (1.15 + r() * 0.5 * (1 - k)) + (pat.tail ?? 0);
    sinceBox += 1;
    if (endless && z - lastHeart > HEART_EVERY_M) {
      hearts.push({ z: Math.round((z + gap * 0.45) * 10) / 10, lane: Math.floor(r2() * 4) });
      lastHeart = z;
    }
    if (r() < 0.3) boosts.push({ z: Math.round((z + gap / 2) * 10) / 10, lane: Math.floor(r() * 4) });
    else if (z > 60 && (sinceBox >= 4 || r2() < 0.22)) addBox(z + gap * 0.55);
    z += gap;
  }
  return { rows, boosts, boxes, hearts, len };
}

// ── moving obstacles: each map has two, sweeping across the lanes ──────────

/**
 * A mover sits at distance `z` and slides back and forth across the four
 * lanes on the shared race clock (seconds since the gun): x = 3 · tri(t /
 * period + phase), in lane units. It covers `half` lanes either side of x.
 * How you get past it:
 *   jump  — low enough to hop over (log, chicken, crab, football, asteroid)
 *   slide — flies at head height (bees, pigeons, spidercam)
 *   dodge — only by being in another lane (tractor, wave, taxi, UFO beam)
 * A wave doesn't knock you down, it slows you.
 */
export const MOVER_KINDS = {
  log: { map: "meadow", half: 0.55, period: 3.4, clear: "jump" },
  bees: { map: "meadow", half: 0.5, period: 2.6, clear: "slide" },
  tractor: { map: "farm", half: 0.75, period: 4.6, clear: "dodge" },
  chicken: { map: "farm", half: 0.35, period: 1.9, clear: "jump" },
  wave: { map: "beach", half: 1.0, period: 5.2, clear: "dodge", slows: true },
  crab: { map: "beach", half: 0.4, period: 2.3, clear: "jump" },
  taxi: { map: "city", half: 0.75, period: 4.4, clear: "dodge" },
  pigeons: { map: "city", half: 0.5, period: 2.4, clear: "slide" },
  football: { map: "stadium", half: 0.4, period: 2.0, clear: "jump" },
  spidercam: { map: "stadium", half: 0.5, period: 3.0, clear: "slide" },
  asteroid: { map: "space", half: 0.45, period: 2.6, clear: "jump" },
  ufo: { map: "space", half: 0.6, period: 4.8, clear: "dodge" },
};
const tri = (u) => 1 - Math.abs(2 * (u - Math.floor(u)) - 1);
/** Where mover `m` is (0..3, lane units) `t` seconds into the race. */
export function moverX(m, t) {
  return 3 * tri(t / MOVER_KINDS[m.kind].period + m.phase);
}
/** Does mover `m` cover `lane` (can be fractional) at race time `t`? */
export function moverCovers(m, lane, t) {
  return Math.abs(moverX(m, t) - lane) < MOVER_KINDS[m.kind].half + 0.35;
}
/** The course's moving obstacles for a map: one every ~150 m (from 150 m on), in a wide gap between rows. */
export function moversFor(course, seed, map) {
  const kinds = Object.keys(MOVER_KINDS).filter((k) => MOVER_KINDS[k].map === (map ?? "meadow"));
  if (!kinds.length) return [];
  const r = rng((seed ^ 0x5bd1e995) >>> 0);
  const out = [];
  let next = 150 + r() * 60;
  const rows = course.rows;
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (a.z < next || b.z - a.z < 12) continue;
    out.push({ z: Math.round(((a.z + b.z) / 2) * 10) / 10, kind: kinds[Math.floor(r() * kinds.length)], phase: Math.round(r() * 100) / 100 });
    next = a.z + 120 + r() * 90;
  }
  return out;
}

// ── helpers ─────────────────────────────────────────────────────────────────

const clone = (s) => JSON.parse(JSON.stringify(s));
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const num = (v) => typeof v === "number" && Number.isFinite(v);
const intIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

function cleanCountry(raw) {
  return typeof raw === "string" && COUNTRY_CODES.has(raw) ? raw : "";
}

function cleanName(raw) {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 14);
}

function ids(state) {
  return state.order.filter((id) => state.players[id]);
}

function present(state) {
  return ids(state).filter((id) => !state.players[id].gone);
}

function humans(state) {
  return ids(state).filter((id) => !state.players[id].bot);
}

function freshRunner(p) {
  return { ...p, d: 0, lane: p.slot, y: 0, act: "idle", pw: "", finish: null, hits: 0, outAt: null, zapAt: null, bananaAt: null, emoteAt: null, sc: 0, cb: 0, left: false, item: "", warp: 0, coins: 0, booms: 0 };
}

function pickHost(state) {
  const h = state.players[state.host];
  if (h && !h.gone) return;
  const next = present(state).find((id) => !state.players[id].bot);
  if (next) state.host = next;
  else if (!h) state.host = humans(state)[0] ?? null;
}

function removePlayer(state, id) {
  delete state.players[id];
  state.order = state.order.filter((x) => x !== id);
  // keep slots dense so lane = slot stays 0..3
  ids(state).forEach((pid, i) => (state.players[pid].slot = i));
  pickHost(state);
}

/** finished (by time) → still running (by distance) → left the race */
export function standings(state) {
  if (state.kind === "coinrush") {
    // most coins, then furthest
    return ids(state)
      .map((id) => state.players[id])
      .sort((a, b) => (a.left !== b.left ? (a.left ? 1 : -1) : (b.coins ?? 0) - (a.coins ?? 0) || b.d - a.d))
      .map((p) => p.id);
  }
  if (isEndless(state.kind)) {
    // still running (furthest first) → knocked out (last one out first) → left
    return ids(state)
      .map((id) => state.players[id])
      .sort((a, b) => {
        if (a.left !== b.left) return a.left ? 1 : -1;
        const ao = a.outAt ?? Infinity;
        const bo = b.outAt ?? Infinity;
        if (ao !== bo) return bo - ao;
        return b.d - a.d;
      })
      .map((p) => p.id);
  }
  return ids(state)
    .map((id) => state.players[id])
    .sort((a, b) => {
      if (a.left !== b.left) return a.left ? 1 : -1;
      if (a.finish !== null && b.finish !== null) return a.finish - b.finish;
      if (a.finish !== null) return -1;
      if (b.finish !== null) return 1;
      return b.d - a.d;
    })
    .map((p) => p.id);
}

function maybeEnd(state, t) {
  if (state.phase !== "race") return;
  const racing = ids(state).filter((id) => !state.players[id].left);
  if (state.kind === "coinrush") {
    const anyHuman = racing.some((id) => !state.players[id].bot && !state.players[id].gone);
    if (t >= state.startAt + COINRUSH_MS || !anyHuman) endRace(state, t);
    return;
  }
  if (isEndless(state.kind)) {
    const alive = racing.filter((id) => {
      const p = state.players[id];
      return p.outAt === null && !p.gone;
    });
    // with friends: last one standing wins; alone: run until your hearts run out;
    // and once every real player is out there's nobody left to watch the bots
    const humanAlive = alive.some((id) => !state.players[id].bot);
    const over = (racing.length >= 2 ? alive.length <= 1 : alive.length === 0) || !humanAlive;
    if (over || t >= state.startAt + SURVIVAL_LIMIT_MS) endRace(state, t);
    return;
  }
  const stillRunning = racing.filter((id) => {
    const p = state.players[id];
    return p.finish === null && !p.gone;
  });
  const timeUp = t >= state.startAt + RACE_LIMIT_MS;
  const graceUp = state.firstFinishAt !== null && t >= state.firstFinishAt + AFTER_FIRST_MS;
  if (stillRunning.length === 0 || timeUp || graceUp) endRace(state, t);
}

function endRace(state, t) {
  state.phase = "results";
  state.endAt = t;
  if (state.cup) {
    standings(state).forEach((id, i) => {
      const p = state.players[id];
      state.cup.points[id] = (state.cup.points[id] ?? 0) + (p.left ? 0 : CUP_POINTS[i] ?? 0);
    });
    state.cup.places = state.cup.places ?? {};
    standings(state).forEach((id, i) => {
      state.cup.places[id] = [...(state.cup.places[id] ?? []), i + 1];
    });
  }
}

/** Tournament table: most points first; ties go to whoever placed better in the latest race. */
export function cupStandings(state) {
  if (!state.cup) return [];
  const last = standings(state);
  return ids(state)
    .slice()
    .sort((a, b) => (state.cup.points[b] ?? 0) - (state.cup.points[a] ?? 0) || last.indexOf(a) - last.indexOf(b));
}

/** Who hit whom with what, for the callouts ("Bob slipped on Alice's banana"). */
function addHit(state, kind, by, victim, t) {
  state.hitSeq = (state.hitSeq ?? 0) + 1;
  state.hitLog = [...(state.hitLog ?? []), { id: state.hitSeq, kind, by, victim, at: t }].slice(-8);
}

function startRace(state, t) {
  // evict anyone who dropped out before the gun
  for (const id of ids(state)) if (state.players[id].gone) removePlayer(state, id);
  state.round += 1;
  state.seed = ((Math.floor(t) % 2147483647) ^ Math.imul(state.round, 2654435761)) >>> 0;
  // "random" mode or map: drawn now, from the race's seed
  const pick = rng((state.seed + 7919) >>> 0);
  const baseMap = state.map === "random" ? Math.floor(pick() * MAPS.length) : Math.max(0, MAPS.indexOf(state.map ?? "meadow"));
  state.kind = state.cup ? state.cup.races[state.cup.race - 1] : state.mode === "random" ? ROUND_KINDS[Math.floor(pick() * ROUND_KINDS.length)] : state.mode;
  // later Party Cup rounds open further into the difficulty curve
  state.courseBoost = state.cup ? (state.cup.race - 1) * CUP_ROUND_BOOST_M : 0;
  state.raceMap = MAPS[baseMap]; // a random map is drawn again every round
  state.phase = "countdown";
  state.startAt = t + COUNTDOWN_MS;
  state.endAt = 0;
  state.firstFinishAt = null;
  state.zaps = [];
  state.bananas = [];
  state.bowls = [];
  state.taken = [];
  state.heartsTaken = [];
  state.hitLog = [];
  state.rematch = [];
  state.cloud = null;
  state.punches = [];
  state.coinsTaken = [];
  state.coinsAt = {};
  state.loose = [];
  state.bomb = null;
  state.blasts = [];
  state.nextBombAt = state.kind === "potato" ? state.startAt + POTATO_FIRST_MS : null;
  for (const id of ids(state)) state.players[id] = freshRunner(state.players[id]);
}

// ── the modes: brain chase, coin rush, hot potato, party cup ───────────────

function knockOut(p, t) {
  if (p.outAt !== null) return;
  p.outAt = t;
  p.act = "out";
  p.pw = "";
}
/**
 * The rounds of a match, decided when it starts. The Grand Tour is every kind
 * once; any other mode over several rounds repeats that mode (Random draws a
 * different kind each round where it can). A one-round match isn't a cup.
 */
function newCup(mode, t, rounds = 1) {
  if (!CUP_MODES.includes(mode) && rounds <= 1) return null;
  const r = rng(Math.floor(t) % 2147483647);
  const shuffled = () => {
    const pool = [...ROUND_KINDS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  };
  if (mode === "grandtour") return { race: 1, points: {}, races: shuffled() };
  if (mode === "random") {
    const races = [];
    while (races.length < rounds) {
      const next = shuffled().filter((k, i) => i > 0 || k !== races[races.length - 1]);
      races.push(...next);
    }
    return { race: 1, points: {}, races: races.slice(0, rounds) };
  }
  return { race: 1, points: {}, races: Array(rounds).fill(mode) };
}
/** Coin Rush: lines of coins in the gaps between obstacle rows, in a lane that's open on both sides. */
const coinCache = new Map();
export function coinLines(course) {
  const out = [];
  const rows = course.rows;
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    const gap = b.z - a.z;
    if (gap < 7) continue;
    // a lane that's clear ahead, behind nothing taller than a hurdle (so you can see the coins coming)
    const clear = [0, 1, 2, 3].filter((l) => !a.lanes[l] && !b.lanes[l]);
    const lanes = clear.length ? clear : [0, 1, 2, 3].filter((l) => !b.lanes[l] && a.lanes[l] === "hurdle");
    if (!lanes.length) continue;
    const lane = lanes[Math.floor(((a.z * 7.31) % 1) * lanes.length)] ?? lanes[0];
    const n = gap > 16 ? 5 : 3;
    const start = a.z + (gap - (n - 1) * 2) / 2;
    for (let k = 0; k < n; k++) out.push({ z: Math.round((start + k * 2) * 10) / 10, lane, v: k === Math.floor(n / 2) && i % 7 === 3 ? 5 : 1 });
  }
  return out;
}
function coinsFor(state) {
  const key = state.seed;
  if (!coinCache.has(key)) {
    if (coinCache.size > 6) coinCache.delete(coinCache.keys().next().value);
    coinCache.set(key, coinLines(courseFor(state)));
  }
  return coinCache.get(key);
}
function spillCoins(state, p, t) {
  const n = Math.min(p.coins ?? 0, COIN_SPILL);
  if (!n) return;
  p.coins -= n;
  state.looseSeq = (state.looseSeq ?? 0) + 1;
  state.loose = [...(state.loose ?? []), { id: state.looseSeq, d: Math.round((p.d + 3) * 10) / 10, lane: p.lane, n, at: t }].slice(-20);
}
function giveBomb(state, t, exclude = null) {
  const alive = ids(state).map((x) => state.players[x]).filter((p) => racingNow(p) && p.id !== exclude);
  const pool = alive.length ? alive : ids(state).map((x) => state.players[x]).filter((p) => racingNow(p));
  if (!pool.length) return;
  const r = rng((Math.floor(t) ^ state.seed) >>> 0);
  const holder = pool[Math.floor(r() * pool.length)];
  state.bombSeq = (state.bombSeq ?? 0) + 1;
  state.bomb = { id: state.bombSeq, holder: holder.id, prev: null, at: t, until: t + 10000 + Math.floor(r() * 6000), passAt: t };
}
/** The nearest runner the bomb can be thrown to, or null. */
function bombTarget(state, holder, t) {
  const b = state.bomb;
  let best = null;
  for (const id of ids(state)) {
    const p = state.players[id];
    if (p.id === holder.id || !racingNow(p)) continue;
    if (p.id === b.prev && t - b.passAt < 1500) continue; // no straight hand-back
    const gap = Math.abs(p.d - holder.d);
    if (gap <= BOMB_THROW_M && (!best || gap < Math.abs(best.d - holder.d))) best = p;
  }
  return best;
}
function passBomb(state, to, t) {
  const b = state.bomb;
  b.prev = b.holder;
  b.holder = to.id;
  b.passAt = t;
}
function takeCoin(state, i, t) {
  state.coinsTaken = [...(state.coinsTaken ?? []), i];
  state.coinsAt = { ...(state.coinsAt ?? {}), [i]: t };
}
function stepMode(state, t) {
  const elapsedS = (t - state.startAt) / 1000;
  if (state.kind === "chase") {
    const brain = brainDistance(elapsedS);
    for (const id of ids(state)) {
      const p = state.players[id];
      if (p.left || p.outAt !== null) continue;
      if (p.d <= brain) knockOut(p, t);
    }
  }
  if (state.kind === "coinrush") {
    state.loose = (state.loose ?? []).filter((c) => t - c.at < LOOSE_MS);
    // taken coins come back after a while
    const at = state.coinsAt ?? {};
    if ((state.coinsTaken ?? []).some((i) => t - (at[i] ?? 0) >= COIN_RESPAWN_MS)) {
      state.coinsTaken = state.coinsTaken.filter((i) => t - (at[i] ?? 0) < COIN_RESPAWN_MS);
      state.coinsAt = Object.fromEntries(state.coinsTaken.map((i) => [i, at[i]]));
    }
  }
  if (state.kind === "potato") {
    const b = state.bomb;
    if (!b) {
      if (state.nextBombAt !== null && t >= state.nextBombAt) giveBomb(state, t);
      return;
    }
    const holder = state.players[b.holder];
    if (!racingNow(holder)) {
      // the holder left or got knocked out some other way: hand it to someone else
      giveBomb(state, t, b.holder);
      return;
    }
    if (t >= b.until) {
      holder.booms = (holder.booms ?? 0) + 1;
      state.blastSeq = (state.blastSeq ?? 0) + 1;
      state.blasts = [...(state.blasts ?? []), { id: state.blastSeq, holder: holder.id, d: holder.d, lane: holder.lane, at: t }].slice(-6);
      if (holder.booms >= LIVES) knockOut(holder, t);
      else {
        holder.stunUntil = t + 1600;
        if (holder.bot) holder.act = "stumble";
      }
      state.bomb = null;
      state.nextBombAt = t + POTATO_NEXT_MS;
      return;
    }
    if (t - b.passAt < 700) return;
    // bots throw it on when someone is close (not instantly, so you can get away)
    if (holder.bot && t - b.passAt > 1500) {
      const to = bombTarget(state, holder, t);
      if (to && rng((Math.floor(t / 250) ^ state.seed) >>> 0)() < 0.2) return passBomb(state, to, t);
    }
    const near = ids(state)
      .map((x) => state.players[x])
      .find((p) => p.id !== holder.id && racingNow(p) && p.lane === holder.lane && Math.abs(p.d - holder.d) < BOMB_PASS_M && !(p.id === b.prev && t - b.passAt < 1500));
    if (near) {
      b.prev = holder.id;
      b.holder = near.id;
      b.passAt = t;
    }
  }
}

// ── the trickier power-ups: mind swap, thundercloud, boxing glove ───────────

function racingNow(p) {
  return p && !p.left && p.outAt === null && p.finish === null && !p.gone;
}
/** Everyone still racing who is ahead of `id`, nearest first. */
function aheadOf(state, id) {
  const me = state.players[id];
  return ids(state)
    .map((x) => state.players[x])
    .filter((p) => p.id !== id && racingNow(p) && p.d > me.d)
    .sort((a, b) => a.d - b.d);
}
/** Swap distances with the runner just ahead; both bump their warp so stale positions are ignored. */
function doSwap(state, id, t) {
  const me = state.players[id];
  const other = aheadOf(state, id)[0];
  if (!other) return;
  const d = me.d;
  me.d = other.d;
  other.d = d;
  me.warp = (me.warp ?? 0) + 1;
  other.warp = (other.warp ?? 0) + 1;
  me.at = t;
  other.at = t;
  addHit(state, "swap", id, other.id, t);
}
/** A storm cloud over the leader; it strikes after CLOUD_MS unless passed on by touching someone. */
function startCloud(state, id, t) {
  const lead = ids(state)
    .map((x) => state.players[x])
    .filter((p) => p.id !== id && racingNow(p))
    .sort((a, b) => b.d - a.d)[0];
  if (!lead) return;
  state.cloudSeq = (state.cloudSeq ?? 0) + 1;
  state.cloud = { id: state.cloudSeq, by: id, holder: lead.id, prev: null, at: t, until: t + CLOUD_MS, passAt: t };
}
function stepCloud(state, t) {
  const c = state.cloud;
  if (!c) return;
  const holder = state.players[c.holder];
  if (!racingNow(holder)) {
    state.cloud = null;
    return;
  }
  if (t >= c.until) {
    state.cloud = null;
    addHit(state, "thunder", c.by, holder.id, t);
    if (holder.bot) botHit(state, holder, t, true);
    else {
      // the holder's own screen applies the strike (like a zap aimed at one runner)
      state.zapSeq = (state.zapSeq ?? 0) + 1;
      state.zaps = [...(state.zaps ?? []), { id: state.zapSeq, by: c.by, d: holder.d, at: t, kind: "thunder", target: holder.id }].slice(-6);
    }
    return;
  }
  if (t - c.passAt < 700) return;
  // touching someone in your lane passes it on (not straight back to who gave it to you)
  const near = ids(state)
    .map((x) => state.players[x])
    .find((p) => p.id !== holder.id && racingNow(p) && p.lane === holder.lane && Math.abs(p.d - holder.d) < CLOUD_PASS_M && !(p.id === c.prev && t - c.passAt < 1500));
  if (near) {
    c.prev = holder.id;
    c.holder = near.id;
    c.passAt = t;
  }
}
/** Knock someone a lane away from you; they stagger for a moment. */
function doPunch(state, id, targetId, t) {
  const me = state.players[id];
  const target = state.players[targetId];
  let dir = target.lane > me.lane ? 1 : target.lane < me.lane ? -1 : target.lane >= LANES - 1 ? -1 : 1;
  if (target.lane + dir < 0 || target.lane + dir > LANES - 1) dir = -dir;
  state.punchSeq = (state.punchSeq ?? 0) + 1;
  state.punches = [...(state.punches ?? []), { id: state.punchSeq, by: id, target: targetId, dir, at: t }].slice(-6);
  addHit(state, "boxing", id, targetId, t);
  if (target.bot && (target.shieldUntil ?? 0) <= t) {
    target.lane = Math.max(0, Math.min(LANES - 1, target.lane + dir));
    target.slowUntil = t + 900;
  }
}

// ── bots: fill empty spots, run the same course, make mistakes ─────────────

export const BOT_NAMES = ["Turbo Tim", "Zippy", "Bolt Bot", "Speedy Sam", "Rocket Rita", "Dash", "Nitro Nia", "Flash Fred", "Sprinty", "Max Speed"];
const BOT_ITEMS = ["banana", "lightning", "rocket", "shield", "freeze", "glue", "fake", "brainwave", "thunder", "swap", "boxing"];
const STUN_MS = 1600; // fall + get up, like a real runner
const courses = new Map();
const moverCache = new Map();
function moversOf(state) {
  const key = `${state.seed}:${state.raceMap}`;
  if (!moverCache.has(key)) {
    if (moverCache.size > 6) moverCache.delete(moverCache.keys().next().value);
    moverCache.set(key, moversFor(courseFor(state), state.seed, state.raceMap));
  }
  return moverCache.get(key);
}
function courseFor(state) {
  const len = isEndless(state.kind) ? SURVIVAL_LEN : TRACK_LEN;
  const key = `${state.seed}:${len}:${state.courseBoost ?? 0}`;
  if (!courses.has(key)) {
    if (courses.size > 6) courses.delete(courses.keys().next().value);
    courses.set(key, buildCourse(state.seed, len, state.courseBoost ?? 0));
  }
  return courses.get(key);
}
/** A stable 0..1 roll for (seed, bot, thing): the same race replays the same way. */
function roll(seed, a, b) {
  let h = (seed ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(Math.round(b * 10) + 7, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function fillBots(state) {
  const used = new Set(ids(state).map((id) => state.players[id].char));
  const real = humans(state).map((id) => state.players[id]);
  const avgRp = real.length ? real.reduce((a, p) => a + (p.rp ?? 0), 0) / real.length : 0;
  let n = 0;
  while (ids(state).length < MAX_RUNNERS) {
    const id = `bot${n + 1}`;
    n += 1;
    if (state.players[id]) continue;
    const char = [0, 1, 2, 3, 4, 5, 6, 7].find((c) => !used.has(c)) ?? 0;
    used.add(char);
    const r = roll(state.seed + state.round, n, 3);
    const slot = ids(state).length;
    state.players[id] = freshRunner({
      id,
      name: freeName(state, Math.floor(roll(state.seed ^ (state.now & 0xffff), n, 9) * BOT_NAMES.length)),
      char,
      country: "",
      rp: Math.max(0, Math.round(avgRp + (r - 0.5) * 300)),
      slot,
      gone: false,
      goneAt: null,
      ready: true,
      bot: true,
      // better bots for better players
      skill: Math.min(0.98, 0.94 + Math.min(0.025, avgRp / 100000) + r * 0.02),
    });
    state.order.push(id);
  }
}

/** The second lane a glue puddle covers. */
export function glueLane2(lane) {
  return lane >= LANES - 1 ? lane - 1 : lane + 1;
}

function freeName(state, start) {
  const taken = new Set(ids(state).map((id) => state.players[id].name));
  for (let k = 0; k < BOT_NAMES.length; k++) {
    const name = BOT_NAMES[(start + k) % BOT_NAMES.length];
    if (!taken.has(name)) return name;
  }
  return "Bot";
}

/** An obstacle (or, with `power`, someone's power-up) trips a bot. Power-ups never cost a heart. */
function botHit(state, p, t, power = false) {
  if ((p.shieldUntil ?? 0) > t) {
    p.shieldUntil = 0;
    p.pw = "";
    return;
  }
  if (!(power && state.kind === "survival")) p.hits += 1;
  p.stunUntil = t + STUN_MS;
  p.act = "stumble";
  p.y = 0;
  if (state.kind === "coinrush") spillCoins(state, p, t);
  if (state.kind === "survival" && p.hits >= LIVES) knockOut(p, t);
}

function stepBots(state, t) {
  if (t < state.startAt) return;
  const course = courseFor(state);
  const survival = isEndless(state.kind);
  const len = survival ? SURVIVAL_LEN : TRACK_LEN;
  const elapsedS = (t - state.startAt) / 1000;
  const runners = ids(state).map((id) => state.players[id]);
  ids(state).forEach((id, bi) => {
    const p = state.players[id];
    if (!p.bot || p.left || p.outAt !== null || p.finish !== null) return;
    const last = Math.max(state.startAt, p.at ?? state.startAt);
    const dt = Math.min(1, Math.max(0, (t - last) / 1000));
    // zaps from anyone else since the last step
    for (const z of state.zaps ?? []) {
      if (z.id <= (p.lastZap ?? 0)) continue;
      p.lastZap = z.id;
      if (z.by === id) continue;
      if (z.kind === "freeze") p.slowUntil = t + 3000;
      else if (z.kind === "brainwave") {
        // a confused bot wobbles into a random lane and slows down
        if (p.d > z.d) {
          p.slowUntil = t + 1500;
          p.lane = Math.max(0, Math.min(LANES - 1, p.lane + (roll(state.seed, bi, z.id) < 0.5 ? -1 : 1)));
        }
      } else if (z.kind === "lightning" && p.d > z.d && (p.rocketUntil ?? 0) <= t) botHit(state, p, t, true);
    }
    if (p.outAt !== null) return;
    let v = 0;
    if ((p.stunUntil ?? 0) > t) {
      p.act = "stumble";
    } else {
      v = runSpeed(state.kind, elapsedS) * (0.97 + roll(state.seed, bi, 1) * 0.03);
      if ((p.rocketUntil ?? 0) > t) v += survival ? SURVIVAL_ROCKET : ROCKET_SPEED - BASE_SPEED;
      if ((p.slowUntil ?? 0) > t) v *= 0.55;
      if (state.bomb?.holder === id) v *= 1.15; // the bomb holder runs a little faster, to catch someone
      if (p.act === "stumble") p.act = "run";
    }
    const d0 = p.d;
    const d1 = Math.min(len, d0 + v * dt);
    // gets a little sloppier as the course speeds up
    const sharp = (p.skill ?? 0.95) - 0.05 * Math.min(1, elapsedS / 150);
    const rocketing = (p.rocketUntil ?? 0) > t;
    let act = (p.stunUntil ?? 0) > t ? "stumble" : "run";
    let y = 0;
    // look ahead: line up for what's coming
    for (const row of course.rows) {
      if (row.z <= d0) continue;
      if (row.z > d0 + v * 0.7 + 4) break;
      const kind = row.lanes[p.lane];
      if (!kind || rocketing) continue;
      const dodge = roll(state.seed, bi, row.z) < sharp;
      if (!dodge) continue;
      if (kind === "crate" || kind === "roller") {
        const free = [0, 1, 2, 3].filter((l) => !row.lanes[l]).sort((a, b) => Math.abs(a - p.lane) - Math.abs(b - p.lane));
        if (free.length) p.lane = free[0];
      } else if (row.z - d0 < v * 0.35 + 1.5) {
        if (kind === "hurdle") {
          act = "jump";
          y = 1.1;
        } else if (kind === "gate") act = "slide";
      }
    }
    // what we actually ran through
    if (!rocketing) {
      for (const row of course.rows) {
        if (row.z <= d0) continue;
        if (row.z > d1) break;
        const kind = row.lanes[p.lane];
        if (!kind) continue;
        const cleared = (kind === "hurdle" || kind === "gate") && roll(state.seed, bi, row.z) < sharp;
        if (!cleared) {
          botHit(state, p, t);
          break;
        }
      }
    }
    if (state.kind === "coinrush" && (p.stunUntil ?? 0) <= t) {
      // drift toward the next coins ahead (if the lane next to us is clear right now)
      const taken = new Set(state.coinsTaken ?? []);
      const next = coinsFor(state).find((c, i) => c.z > d1 + 2 && c.z < d1 + 30 && !taken.has(i));
      if (next && next.lane !== p.lane && roll(state.seed, bi, t / 400) < 0.6) {
        const to = p.lane + Math.sign(next.lane - p.lane);
        const blocked = course.rows.some((row) => row.z > d1 && row.z < d1 + 8 && row.lanes[to]);
        if (!blocked) p.lane = to;
      }
    }
    if (state.kind === "coinrush") {
      coinsFor(state).forEach((c, i) => {
        if (c.z <= d0 || c.z > d1 || c.lane !== p.lane || (state.coinsTaken ?? []).includes(i)) return;
        takeCoin(state, i, t);
        p.coins = (p.coins ?? 0) + c.v;
      });
      for (const c of state.loose ?? []) {
        if (c.d <= d0 - 1 || c.d > d1 + 1 || c.lane !== p.lane) continue;
        state.loose = state.loose.filter((x) => x.id !== c.id);
        p.coins = (p.coins ?? 0) + c.n;
      }
    }
    if (state.bomb?.holder === id && (p.stunUntil ?? 0) <= t) {
      // steer toward the nearest runner ahead to hand the bomb over
      const target = runners.filter((o) => o.id !== id && racingNow(o) && o.d > p.d && o.d - p.d < 25).sort((a, b) => a.d - b.d)[0];
      if (target && target.lane !== p.lane && roll(state.seed, bi, t / 700) < 0.5) p.lane += Math.sign(target.lane - p.lane);
    }
    // moving obstacles: time the jump/slide, or be in another lane when it passes
    if (!rocketing) {
      for (const m of moversOf(state)) {
        if (m.z <= d0 || m.z > d1) continue;
        // race time (s) when the bot reaches it
        const at = (last - state.startAt) / 1000 + (m.z - d0) / Math.max(1, v);
        if (!moverCovers(m, p.lane, at)) continue;
        if (roll(state.seed, bi, m.z + 0.7) < sharp) continue;
        if (MOVER_KINDS[m.kind].slows) p.slowUntil = Math.max(p.slowUntil ?? 0, t + 1500);
        else botHit(state, p, t);
      }
    }
    // mystery boxes (first come, first served), bananas, bowling balls
    course.boxes.forEach((b, i) => {
      if (b.z <= d0 || b.z > d1 || b.lane !== p.lane || p.item || (state.taken ?? []).includes(i)) return;
      state.taken = [...(state.taken ?? []), i];
      p.item = BOT_ITEMS[Math.floor(roll(state.seed, bi, b.z + 0.3) * BOT_ITEMS.length)];
      p.itemAt = t;
    });
    for (const b of state.bananas ?? []) {
      if (b.d <= d0 - 0.5 || b.d > d1 + 0.5) continue;
      if (b.kind === "glue") {
        // glue covers its lane and the next one
        if (p.lane === b.lane || p.lane === glueLane2(b.lane)) p.slowUntil = Math.max(p.slowUntil ?? 0, t + 1500);
        continue;
      }
      if (b.by === id || b.lane !== p.lane) continue;
      state.bananas = state.bananas.filter((x) => x.id !== b.id);
      addHit(state, b.kind ?? "banana", b.by, id, t);
      botHit(state, p, t, true);
      break;
    }
    for (const b of state.bowls ?? []) {
      if (b.by === id || b.lane !== p.lane || (p.bowled ?? []).includes(b.id)) continue;
      const at = b.d + (b.dir * BOWL_SPEED * (t - b.at)) / 1000;
      if (Math.abs(at - d1) > 3 || Math.abs(t - b.at) > (BOWL_RANGE_M / BOWL_SPEED) * 1000) continue;
      p.bowled = [...(p.bowled ?? []), b.id].slice(-8);
      addHit(state, "bowling", b.by, id, t);
      botHit(state, p, t, true);
    }
    // use the item after a moment's thought
    if (p.item && t - (p.itemAt ?? 0) > 1500 + roll(state.seed, bi, t / 1000) * 2500 && (p.stunUntil ?? 0) <= t) {
      const ahead = runners.filter((o) => o.id !== id && !o.left && o.outAt === null && o.d > p.d);
      if (p.item === "banana" || p.item === "glue" || p.item === "fake") {
        // throw it into the lane of someone just ahead, or drop it behind
        const mark = ahead.filter((o) => o.d - d1 > BANANA_AHEAD_M - 12 && o.d - d1 < BANANA_AHEAD_M + 8).sort((a, b) => a.d - b.d)[0];
        state.bananaSeq = (state.bananaSeq ?? 0) + 1;
        const drop = mark ? { lane: mark.lane, d: d1 + BANANA_AHEAD_M } : { lane: p.lane, d: d1 - BANANA_BEHIND_M };
        state.bananas = [...(state.bananas ?? []), { id: state.bananaSeq, by: id, lane: drop.lane, d: Math.round(drop.d * 10) / 10, at: t, kind: p.item }].slice(-16);
        p.item = "";
      } else if (p.item === "swap" || p.item === "thunder") {
        if (ahead.length && !(p.item === "thunder" && state.cloud)) {
          p.d = d1;
          if (p.item === "swap") doSwap(state, id, t);
          else startCloud(state, id, t);
          p.item = "";
          p.at = t;
          return;
        }
      } else if (p.item === "boxing") {
        const near = runners.find((o) => o.id !== id && racingNow(o) && Math.abs(o.d - d1) < PUNCH_RANGE_M && Math.abs(o.lane - p.lane) <= 1);
        if (near) {
          doPunch(state, id, near.id, t);
          p.item = "";
        }
      } else if (p.item === "lightning" || p.item === "freeze" || p.item === "brainwave") {
        if (ahead.length) {
          state.zapSeq = (state.zapSeq ?? 0) + 1;
          state.zaps = [...(state.zaps ?? []), { id: state.zapSeq, by: id, d: d1, at: t, kind: p.item }].slice(-6);
          p.lastZap = state.zapSeq;
          p.item = "";
        }
      } else if (p.item === "rocket") {
        p.rocketUntil = t + 3000;
        p.pw = "rocket";
        p.item = "";
      } else if (p.item === "shield") {
        p.shieldUntil = t + 8000;
        p.pw = "shield";
        p.item = "";
      }
    }
    if (p.pw === "rocket" && (p.rocketUntil ?? 0) <= t) p.pw = "";
    if (p.pw === "shield" && (p.shieldUntil ?? 0) <= t) p.pw = "";
    p.d = d1;
    p.v = v;
    p.at = t;
    if (p.outAt === null) {
      p.act = (p.stunUntil ?? 0) > t ? "stumble" : act;
      p.y = p.act === "jump" ? y : 0;
    }
    if (!survival && p.d >= TRACK_LEN && p.finish === null) {
      p.finish = Math.max(1, Math.round(t - state.startAt));
      p.act = "idle";
      p.pw = "";
      if (state.firstFinishAt === null) state.firstFinishAt = t;
    }
  });
}

// ── the contract ────────────────────────────────────────────────────────────

export function setup() {
  return {
    phase: "lobby",
    round: 0,
    seed: 1,
    host: null,
    now: 0,
    players: {},
    order: [],
    startAt: 0,
    endAt: 0,
    firstFinishAt: null,
    mode: "survival",
    kind: "survival",
    map: "meadow",
    raceMap: "meadow",
    cup: null,
    zaps: [],
    zapSeq: 0,
    bananas: [],
    bananaSeq: 0,
  };
}

export function validateAction(state, playerId, action) {
  if (!isObj(action) || typeof action.type !== "string") return { ok: false, error: "bad action" };
  const me = state.players[playerId];
  const count = ids(state).length;

  switch (action.type) {
    case "hello": {
      if (!cleanName(action.name)) return { ok: false, error: "Enter a name first" };
      if (!intIn(action.char, 0, CHARACTERS - 1)) return { ok: false, error: "bad character" };
      if (action.rp !== undefined && !intIn(action.rp, 0, MAX_RP)) return { ok: false, error: "bad rank" };
      if (action.trail !== undefined && !TRAILS.includes(action.trail)) return { ok: false, error: "bad trail" };
      if (action.country !== undefined && action.country !== "" && !COUNTRY_CODES.has(action.country)) {
        return { ok: false, error: "bad country" };
      }
      if (me) return { ok: true };
      if (action.create && count > 0) return { ok: false, error: "code taken" };
      if (!action.create && count === 0) return { ok: false, error: "No lobby with that code" };
      if (state.phase !== "lobby") return { ok: false, error: "That race already started — wait for the next one" };
      if (count >= MAX_RUNNERS) return { ok: false, error: "That lobby is full (4/4)" };
      return { ok: true };
    }
    case "pick": {
      if (!me) return { ok: false, error: "join first" };
      if (state.phase !== "lobby") return { ok: false, error: "can only change runner in the lobby" };
      if (!intIn(action.char, 0, CHARACTERS - 1)) return { ok: false, error: "bad character" };
      const taken = ids(state).some((id) => id !== playerId && state.players[id].char === action.char);
      if (taken) return { ok: false, error: "That runner is taken" };
      return { ok: true };
    }
    case "country": {
      if (!me) return { ok: false, error: "join first" };
      if (action.country !== "" && !COUNTRY_CODES.has(action.country)) return { ok: false, error: "bad country" };
      return { ok: true };
    }
    case "mode": {
      if (state.phase !== "lobby") return { ok: false, error: "can only change mode in the lobby" };
      if (state.host !== playerId) return { ok: false, error: "Only the host can pick the mode" };
      if (!GAME_MODES.includes(action.mode)) return { ok: false, error: "bad mode" };
      return { ok: true };
    }
    case "map": {
      if (state.phase !== "lobby") return { ok: false, error: "can only change map in the lobby" };
      if (state.host !== playerId) return { ok: false, error: "Only the host can pick the map" };
      if (!MAPS.includes(action.map) && action.map !== "random") return { ok: false, error: "bad map" };
      return { ok: true };
    }
    case "rounds":
    case "prize": {
      if (state.phase !== "lobby") return { ok: false, error: "only in the lobby" };
      if (state.host !== playerId) return { ok: false, error: "Only the host can change that" };
      if (action.type === "rounds" && !ROUND_OPTIONS.includes(action.rounds)) return { ok: false, error: "bad rounds" };
      if (action.type === "prize" && !PRIZES.includes(action.prize)) return { ok: false, error: "bad prize" };
      return { ok: true };
    }
    case "ready": {
      if (!me) return { ok: false, error: "join first" };
      if (state.phase !== "lobby") return { ok: false, error: "not in the lobby" };
      if (typeof action.ready !== "boolean") return { ok: false, error: "bad ready" };
      return { ok: true };
    }
    case "start": {
      if (state.phase !== "lobby") return { ok: false, error: "already started" };
      if (action.bots !== undefined && typeof action.bots !== "boolean") return { ok: false, error: "bad bots" };
      if (state.host !== playerId) return { ok: false, error: "Only the host can start" };
      if (present(state).length < 1) return { ok: false, error: "nobody to race" };
      // everyone else has to have locked in their runner
      const waiting = present(state).filter((id) => id !== playerId && !state.players[id].ready);
      if (waiting.length) return { ok: false, error: `Waiting for ${waiting.map((id) => state.players[id].name).join(", ")} to get ready` };
      return { ok: true };
    }
    case "pos": {
      if (!me) return { ok: false, error: "join first" };
      if (state.phase !== "race" && state.phase !== "countdown") return { ok: false, error: "not racing" };
      if (!num(action.d) || !num(action.y)) return { ok: false, error: "bad position" };
      if (!intIn(action.lane, 0, LANES - 1)) return { ok: false, error: "bad lane" };
      if (!ACTS.includes(action.act)) return { ok: false, error: "bad act" };
      if (action.hits !== undefined && !intIn(action.hits, 0, 999)) return { ok: false, error: "bad hits" };
      if (action.pw !== undefined && !POWER_STATES.includes(action.pw)) return { ok: false, error: "bad power" };
      if (action.v !== undefined && !(num(action.v) && action.v >= 0 && action.v <= 60)) return { ok: false, error: "bad speed" };
      if (action.sc !== undefined && !intIn(action.sc, 0, 10_000_000)) return { ok: false, error: "bad score" };
      if (action.cb !== undefined && !intIn(action.cb, 0, 9999)) return { ok: false, error: "bad combo" };
      if (action.w !== undefined && !intIn(action.w, 0, 9999)) return { ok: false, error: "bad warp" };
      return { ok: true };
    }
    case "zap": {
      if (!me) return { ok: false, error: "join first" };
      if (state.phase !== "race") return { ok: false, error: "not racing" };
      if (me.finish !== null || me.left || me.outAt !== null) return { ok: false, error: "not racing" };
      const t = num(action.t) ? action.t : state.now;
      if (me.zapAt !== null && t - me.zapAt < ZAP_COOLDOWN_MS) return { ok: false, error: "too soon" };
      if (action.kind !== undefined && !ZAP_KINDS.includes(action.kind)) return { ok: false, error: "bad zap" };
      return { ok: true };
    }
    case "bowl": {
      if (!me) return { ok: false, error: "join first" };
      if (state.phase !== "race" || me.finish !== null || me.left || me.outAt !== null) return { ok: false, error: "not racing" };
      if (!intIn(action.lane, 0, LANES - 1) || !num(action.d)) return { ok: false, error: "bad bowl" };
      if (Math.abs(action.d - me.d) > 2 * POS_SLACK_M) return { ok: false, error: "bad bowl" };
      if (action.dir !== 1 && action.dir !== -1) return { ok: false, error: "bad bowl" };
      const t = num(action.t) ? action.t : state.now;
      if (me.bananaAt !== null && t - me.bananaAt < BANANA_COOLDOWN_MS) return { ok: false, error: "too soon" };
      return { ok: true };
    }
    case "banana": {
      if (!me) return { ok: false, error: "join first" };
      if (state.phase !== "race" || me.finish !== null || me.left || me.outAt !== null) return { ok: false, error: "not racing" };
      if (!intIn(action.lane, 0, LANES - 1) || !num(action.d)) return { ok: false, error: "bad banana" };
      if (action.kind !== undefined && !DROP_KINDS.includes(action.kind)) return { ok: false, error: "bad banana" };
      if (action.d < me.d - BANANA_BEHIND_M - 2 * POS_SLACK_M || action.d > me.d + BANANA_AHEAD_M + 2 * POS_SLACK_M) return { ok: false, error: "bad banana" };
      const t = num(action.t) ? action.t : state.now;
      if (me.bananaAt !== null && t - me.bananaAt < BANANA_COOLDOWN_MS) return { ok: false, error: "too soon" };
      return { ok: true };
    }
    case "swap":
    case "thunder": {
      if (!me) return { ok: false, error: "join first" };
      if (state.phase !== "race" || me.finish !== null || me.left || me.outAt !== null) return { ok: false, error: "not racing" };
      if (action.type === "thunder" && state.cloud) return { ok: false, error: "a cloud is already out" };
      if (!aheadOf(state, playerId).length) return { ok: false, error: "nobody ahead" };
      return { ok: true };
    }
    case "punch": {
      if (!me) return { ok: false, error: "join first" };
      if (state.phase !== "race" || me.finish !== null || me.left || me.outAt !== null) return { ok: false, error: "not racing" };
      const target = state.players[action.target];
      if (!target || action.target === playerId || target.left || target.outAt !== null || target.finish !== null) return { ok: false, error: "nobody there" };
      if (Math.abs(target.d - me.d) > PUNCH_REACH_M + POS_SLACK_M) return { ok: false, error: "too far" };
      return { ok: true };
    }
    case "pass": {
      if (!me) return { ok: false, error: "join first" };
      if (state.phase !== "race" || state.kind !== "potato" || state.bomb?.holder !== playerId) return { ok: false, error: "no bomb" };
      const t = num(action.t) ? action.t : state.now;
      if (t - state.bomb.passAt < 700) return { ok: false, error: "too soon" };
      if (!bombTarget(state, me, t)) return { ok: false, error: "nobody close" };
      return { ok: true };
    }
    case "emote": {
      if (!me) return { ok: false, error: "join first" };
      if (!EMOTES.includes(action.e) && !SHOP_EMOTES.includes(action.e)) return { ok: false, error: "bad emote" };
      const t = num(action.t) ? action.t : state.now;
      if (me.emoteAt != null && t - me.emoteAt < EMOTE_COOLDOWN_MS) return { ok: false, error: "too soon" };
      return { ok: true };
    }
    case "bowled": {
      if (!me) return { ok: false, error: "join first" };
      if (!(state.bowls ?? []).some((b) => b.id === action.id && b.by !== playerId)) return { ok: false, error: "no ball" };
      if ((state.hitLog ?? []).some((h) => h.kind === "bowling" && h.victim === playerId && h.ref === action.id)) return { ok: false, error: "no ball" };
      return { ok: true };
    }
    case "coin": {
      if (!me) return { ok: false, error: "join first" };
      if (state.phase !== "race" || state.kind !== "coinrush" || me.outAt !== null) return { ok: false, error: "not racing" };
      if (action.loose !== undefined) {
        if (!(state.loose ?? []).some((c) => c.id === action.loose)) return { ok: false, error: "coin gone" };
        return { ok: true };
      }
      if (!intIn(action.i, 0, 99999)) return { ok: false, error: "bad coin" };
      if ((state.coinsTaken ?? []).includes(action.i)) return { ok: false, error: "coin gone" };
      const c = coinsFor(state)[action.i];
      if (!c || Math.abs(c.z - me.d) > 2 * POS_SLACK_M + 4) return { ok: false, error: "bad coin" };
      return { ok: true };
    }
    case "heart": {
      // survival hearts: one per pickup, first come first served, only if you've lost one
      if (!me) return { ok: false, error: "join first" };
      if (state.phase !== "race" || state.kind !== "survival") return { ok: false, error: "no hearts in this race" };
      if (!intIn(action.i, 0, 999)) return { ok: false, error: "bad heart" };
      if ((state.heartsTaken ?? []).some((h) => h.i === action.i)) return { ok: false, error: "heart gone" };
      if (!((me.hits ?? 0) > 0)) return { ok: false, error: "full health" };
      return { ok: true };
    }
    case "take": {
      if (!me) return { ok: false, error: "join first" };
      if (state.phase !== "race") return { ok: false, error: "not racing" };
      if (!intIn(action.box, 0, 9999)) return { ok: false, error: "bad box" };
      if ((state.taken ?? []).includes(action.box)) return { ok: false, error: "box gone" };
      return { ok: true };
    }
    case "slip": {
      if (!me) return { ok: false, error: "join first" };
      if (!(state.bananas ?? []).some((b) => b.id === action.id)) return { ok: false, error: "no banana" };
      return { ok: true };
    }
    case "rematch": {
      if (!me || me.bot) return { ok: false, error: "join first" };
      if (state.phase !== "results") return { ok: false, error: "race not over" };
      if (state.cup && state.cup.race < state.cup.races.length) return { ok: false, error: "the cup isn't over" };
      return { ok: true };
    }
    case "again": {
      if (state.phase !== "results") return { ok: false, error: "race not over" };
      if (state.host !== playerId) return { ok: false, error: "Only the host can restart" };
      return { ok: true };
    }
    case "next": {
      if (state.phase !== "results") return { ok: false, error: "race not over" };
      if (state.host !== playerId) return { ok: false, error: "Only the host can start the next race" };
      if (!state.cup || state.cup.race >= state.cup.races.length) return { ok: false, error: "no next race" };
      return { ok: true };
    }
    case "leave":
      return me ? { ok: true } : { ok: false, error: "not in this lobby" };
    default:
      // "tick" and "drop" are system actions issued by the room, never by clients.
      return { ok: false, error: "unknown action" };
  }
}

export function applyAction(state0, playerId, action) {
  const state = clone(state0);
  const t = num(action.t) ? action.t : state.now;
  state.now = Math.max(state.now, t);
  const me = state.players[playerId];

  switch (action.type) {
    case "hello": {
      if (me) {
        me.gone = false;
        me.goneAt = null;
        if (state.phase === "lobby") me.name = cleanName(action.name);
        if (action.country !== undefined) me.country = cleanCountry(action.country);
        if (action.rp !== undefined) me.rp = action.rp;
        if (action.trail !== undefined) me.trail = action.trail;
      } else {
        const used = new Set(ids(state).map((id) => state.players[id].char));
        let char = action.char;
        if (used.has(char)) char = [0, 1, 2, 3, 4, 5, 6, 7].find((c) => !used.has(c)) ?? 0;
        const slot = ids(state).length;
        state.players[playerId] = freshRunner({
          id: playerId,
          name: cleanName(action.name),
          char,
          country: cleanCountry(action.country),
          rp: action.rp ?? 0,
          trail: action.trail ?? "",
          slot,
          gone: false,
          goneAt: null,
          ready: false,
        });
        state.order.push(playerId);
      }
      pickHost(state);
      break;
    }
    case "pick":
      me.char = action.char;
      me.ready = false; // picked a new runner: lock in again
      break;
    case "ready":
      me.ready = action.ready;
      break;
    case "country":
      me.country = cleanCountry(action.country);
      break;
    case "mode":
      state.mode = action.mode;
      break;
    case "map":
      state.map = action.map;
      break;
    case "rounds":
      state.rounds = action.rounds;
      break;
    case "prize":
      state.prize = action.prize;
      break;
    case "start":
      state.cup = newCup(state.mode, t, state.rounds ?? 1);
      state.botFill = action.bots !== false;
      if (state.botFill) fillBots(state);
      startRace(state, t);
      break;
    case "rematch": {
      state.rematch = [...new Set([...(state.rematch ?? []), playerId])];
      const voters = present(state).filter((id) => !state.players[id].bot);
      if (voters.every((id) => state.rematch.includes(id))) {
        state.cup = newCup(state.mode, t, state.rounds ?? 1);
        startRace(state, t);
      }
      break;
    }
    case "next":
      state.cup.race += 1;
      startRace(state, t);
      break;
    case "pos": {
      // The gun may have gone before the room's tick got here.
      if (state.phase === "countdown" && t >= state.startAt) {
        state.phase = "race";
        for (const id of ids(state)) state.players[id].act = "run";
      }
      if (state.phase !== "race" || me.finish !== null || me.left) {
        me.lane = action.lane;
        break;
      }
      const elapsed = Math.max(0, t - state.startAt);
      const survival = isEndless(state.kind);
      if (survival && me.outAt !== null) {
        me.lane = action.lane;
        break;
      }
      const cap = survival ? SURVIVAL_SPEED_CAP : SPEED_CAP;
      const maxD = (cap * elapsed) / 1000 + POS_SLACK_M;
      // after a mind swap, positions from before the swap are stale
      if ((action.w ?? 0) === (me.warp ?? 0)) me.d = Math.max(me.d, Math.min(action.d, maxD, survival ? SURVIVAL_LEN : TRACK_LEN));
      me.lane = action.lane;
      me.y = Math.max(0, Math.min(action.y, 5));
      me.act = action.act;
      if (action.hits !== undefined) {
        // Coin Rush: every new hit spills some of your coins on the track
        if (state.kind === "coinrush" && action.hits > me.hits) spillCoins(state, me, t);
        me.hits = action.hits;
      }
      if (action.pw !== undefined) me.pw = action.pw;
      // when this position was true, and how fast they were going: lets every
      // screen place this runner where they are *now*, not where they were
      me.v = action.v ?? 0;
      me.at = t;
      if (action.sc !== undefined) me.sc = action.sc;
      if (action.cb !== undefined) me.cb = Math.max(me.cb ?? 0, action.cb);
      if (survival) {
        if (state.kind === "survival" && me.hits >= LIVES) knockOut(me, t);
        if (state.kind === "chase" && me.d <= brainDistance(elapsed / 1000)) knockOut(me, t);
        maybeEnd(state, t);
        break;
      }
      if (me.d >= TRACK_LEN) {
        me.finish = Math.max(1, Math.round(elapsed));
        me.act = "idle";
        me.pw = "";
        if (state.firstFinishAt === null) state.firstFinishAt = t;
      }
      maybeEnd(state, t);
      break;
    }
    case "zap": {
      // everyone ahead of the zapper (at this moment) gets tripped; clients
      // apply it to themselves when they see a zap they haven't seen yet
      me.zapAt = t;
      state.zapSeq = (state.zapSeq ?? 0) + 1;
      state.zaps = [...(state.zaps ?? []), { id: state.zapSeq, by: playerId, d: me.d, at: t, kind: action.kind ?? "lightning" }].slice(-6);
      break;
    }
    case "banana": {
      me.bananaAt = t;
      state.bananaSeq = (state.bananaSeq ?? 0) + 1;
      state.bananas = [...(state.bananas ?? []), { id: state.bananaSeq, by: playerId, lane: action.lane, d: Math.round(action.d * 10) / 10, at: t, kind: action.kind ?? "banana" }].slice(-16);
      break;
    }
    case "swap":
      doSwap(state, playerId, t);
      break;
    case "thunder":
      startCloud(state, playerId, t);
      break;
    case "punch":
      doPunch(state, playerId, action.target, t);
      break;
    case "bowl": {
      // a ball rolling from `d` at BOWL_SPEED in `dir` (+1 ahead, -1 back); every client checks it against its own runner
      me.bananaAt = t;
      state.bowlSeq = (state.bowlSeq ?? 0) + 1;
      state.bowls = [...(state.bowls ?? []), { id: state.bowlSeq, by: playerId, lane: action.lane, d: Math.round(action.d * 10) / 10, dir: action.dir, at: t }].slice(-8);
      break;
    }
    case "emote":
      me.emoteAt = t;
      state.emoteSeq = (state.emoteSeq ?? 0) + 1;
      state.emotes = [...(state.emotes ?? []), { id: state.emoteSeq, by: playerId, e: action.e, at: t }].slice(-8);
      break;
    case "coin":
      if (action.loose !== undefined) {
        const c = state.loose.find((x) => x.id === action.loose);
        state.loose = state.loose.filter((x) => x.id !== action.loose);
        me.coins = (me.coins ?? 0) + (c?.n ?? 1);
      } else {
        takeCoin(state, action.i, t);
        me.coins = (me.coins ?? 0) + (coinsFor(state)[action.i]?.v ?? 1);
      }
      break;
    case "pass":
      passBomb(state, bombTarget(state, me, t), t);
      break;
    case "heart":
      state.heartsTaken = [...(state.heartsTaken ?? []), { i: action.i, by: playerId }];
      me.hits = Math.max(0, (me.hits ?? 0) - 1);
      break;
    case "take":
      // mystery boxes are first come, first served
      state.taken = [...(state.taken ?? []), action.box];
      break;
    case "slip": {
      // someone ran onto it: it's gone for everyone, and its thrower gets the credit
      const banana = state.bananas.find((b) => b.id === action.id);
      // glue isn't used up: it slows everyone who runs through it
      if (banana?.kind !== "glue") state.bananas = state.bananas.filter((b) => b.id !== action.id);
      if (banana) addHit(state, banana.kind ?? "banana", banana.by, playerId, t);
      break;
    }
    case "bowled": {
      const ball = (state.bowls ?? []).find((b) => b.id === action.id);
      if (ball) addHit(state, "bowling", ball.by, playerId, t);
      break;
    }
    case "again": {
      for (const id of ids(state)) if (state.players[id].gone || state.players[id].bot) removePlayer(state, id);
      state.phase = "lobby";
      state.cup = null;
      for (const id of ids(state)) state.players[id].ready = false;
      for (const id of ids(state)) state.players[id] = freshRunner(state.players[id]);
      state.firstFinishAt = null;
      break;
    }
    case "leave": {
      if (state.phase === "lobby" || state.phase === "results") removePlayer(state, playerId);
      else {
        me.left = true;
        me.gone = true;
        me.goneAt = t;
        pickHost(state);
        maybeEnd(state, t);
      }
      break;
    }
    case "drop": {
      // system: this player's last connection closed
      if (me) {
        me.gone = true;
        me.goneAt = t;
        pickHost(state);
        maybeEnd(state, t);
      }
      break;
    }
    case "tick": {
      if (state.phase === "countdown" && t >= state.startAt) {
        state.phase = "race";
        for (const id of ids(state)) state.players[id].act = "run";
      }
      if (state.phase === "race") {
        stepBots(state, t);
        stepCloud(state, t);
        stepMode(state, t);
        state.bananas = (state.bananas ?? []).filter((b) => b.kind !== "glue" || t - b.at < GLUE_MS);
      }
      maybeEnd(state, t);
      if (state.phase === "lobby" || state.phase === "results") {
        for (const id of ids(state)) {
          const p = state.players[id];
          if (p.gone && t - (p.goneAt ?? 0) >= LOBBY_GRACE_MS) removePlayer(state, id);
        }
      }
      break;
    }
    default:
      break;
  }
  return state;
}

/** The room keeps "playing" forever; lobby → race → results cycles inside state. */
export function isGameOver() {
  return { over: false };
}

/** Place and medal (or null) for each runner in this race, keyed by player id. */
export function rewards(state) {
  if (state.phase !== "results") return {};
  if (state.cup) {
    // tournaments pay medals once, for the final table
    if (state.cup.race < state.cup.races.length) return {};
    const table = cupStandings(state);
    const paying = humans(state).length >= MIN_RACERS_FOR_MEDALS;
    const out = {};
    table.forEach((id, i) => {
      out[id] = { place: i + 1, medal: paying && !state.players[id].left ? MEDALS[i] ?? null : null };
    });
    return out;
  }
  const order = standings(state);
  const paying = humans(state).length >= MIN_RACERS_FOR_MEDALS;
  const out = {};
  order.forEach((id, i) => {
    const p = state.players[id];
    const done = isEndless(state.kind) ? true : p.finish !== null;
    const medal = paying && !p.left && done ? MEDALS[i] ?? null : null;
    out[id] = { place: i + 1, medal };
  });
  return out;
}

export function viewFor(state, playerId) {
  return {
    phase: state.phase,
    you: playerId,
    joined: Boolean(state.players[playerId]),
    host: state.host,
    round: state.round,
    seed: state.seed,
    startAt: state.startAt,
    endAt: state.endAt,
    firstFinishAt: state.firstFinishAt,
    mode: state.mode ?? "survival",
    kind: state.kind ?? "survival",
    map: state.map ?? "meadow",
    rounds: state.rounds ?? 1,
    prize: state.prize ?? "none",
    raceMap: state.raceMap ?? state.map ?? "meadow",
    courseBoost: state.courseBoost ?? 0,
    cup: state.cup
      ? {
          race: state.cup.race,
          races: state.cup.races,
          points: state.cup.points,
          table: cupStandings(state),
        }
      : null,
    lives: LIVES,
    limitAt:
      state.kind === "coinrush"
        ? state.startAt + COINRUSH_MS
        : isEndless(state.kind)
        ? state.startAt + SURVIVAL_LIMIT_MS
        : state.firstFinishAt !== null
        ? Math.min(state.startAt + RACE_LIMIT_MS, state.firstFinishAt + AFTER_FIRST_MS)
        : state.startAt + RACE_LIMIT_MS,
    now: state.now,
    players: ids(state).map((id) => {
      const p = state.players[id];
      return {
        id: p.id,
        name: p.name,
        char: p.char,
        country: p.country || "",
        rp: p.rp ?? 0,
        bot: Boolean(p.bot),
        trail: p.trail ?? "",
        warp: p.warp ?? 0,
        coins: p.coins ?? 0,
        booms: p.booms ?? 0,
        slot: p.slot,
        d: Math.round(p.d * 100) / 100,
        lane: p.lane,
        y: Math.round(p.y * 100) / 100,
        act: p.act,
        pw: p.pw || "",
        v: Math.round((p.v ?? 0) * 100) / 100,
        sc: p.sc ?? 0,
        cb: p.cb ?? 0,
        at: p.at ?? 0,
        finish: p.finish,
        hits: p.hits,
        ready: Boolean(p.ready),
        outAt: p.outAt ?? null,
        gone: p.gone,
        left: p.left,
      };
    }),
    standings: standings(state),
    rewards: rewards(state),
    zaps: state.zaps ?? [],
    bananas: state.bananas ?? [],
    bowls: state.bowls ?? [],
    taken: state.taken ?? [],
    heartsTaken: state.heartsTaken ?? [],
    emotes: state.emotes ?? [],
    hits: state.hitLog ?? [],
    rematch: state.rematch ?? [],
    cloud: state.cloud ?? null,
    coinsTaken: state.coinsTaken ?? [],
    loose: state.loose ?? [],
    bomb: state.bomb ?? null,
    blasts: state.blasts ?? [],
    punches: state.punches ?? [],
    botFill: state.botFill !== false,
  };
}

/**
 * When the room should wake up next on its own (ms), or null. Not part of the
 * six-function contract; the room uses it to drive countdowns, race end and
 * lobby clean-up.
 */
export function wakeAfter(state) {
  if (state.phase === "countdown") return Math.max(20, state.startAt - state.now);
  if (state.phase === "race") return 250;
  const pending = ids(state).some((id) => state.players[id].gone);
  return pending ? 1000 : null;
}
