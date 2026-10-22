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
 *   sprint     — 700 m to the finish line; fastest time wins
 *   tournament — three races in a row (CUP_RACES); placings score CUP_POINTS
 *                and the most points after the last race wins
 * `state.mode` is what the host picked; `state.kind` is the race being run.
 */
export const GAME_MODES = ["survival", "sprint", "tournament"];
/** A tournament is three races; each placing scores points, most points wins. */
export const CUP_RACES = ["survival", "sprint", "survival"];
export const CUP_POINTS = [10, 5, 3, 1];
export const LIVES = 3;
export const SURVIVAL_LEN = 9000; // metres of course generated; nobody lasts this long
export const SURVIVAL_LIMIT_MS = 10 * 60 * 1000;
export const SURVIVAL_MAX_SPEED = 19; // the ramp tops out here…
export const SURVIVAL_BOOST = 5; // …and a boost adds this on top
/** Running speed (m/s) in survival after `s` seconds: starts like sprint, then ramps. */
export function survivalSpeed(s) {
  return Math.min(SURVIVAL_MAX_SPEED, BASE_SPEED + Math.max(0, s) * 0.1);
}

/**
 * Power-ups come out of mystery boxes on the course. The client rolls which
 * one you get.
 *   shield    — the next hit (obstacle or zap) just pops the bubble
 *   rocket    — fly over everything at boost speed for a few seconds
 *   ghost     — run straight through obstacles for a few seconds
 *   lightning — everyone ahead of you falls over (unless shielded)
 *   banana    — thrown forward into a lane you pick; whoever runs onto it slips
 * You hold one power-up at a time and use it when you want (boxes are
 * ignored while you hold or use one). Zaps and bananas go through the server.
 */
export const POWERS = ["shield", "rocket", "ghost", "lightning", "banana"];
export const BANANA_AHEAD_M = 28; // a thrown banana lands this far in front of you
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
  ["NG", "Nigeria"], ["EG", "Egypt"],
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
const SPEED_CAP = BOOST_SPEED + 1.5;
const SURVIVAL_SPEED_CAP = SURVIVAL_MAX_SPEED + SURVIVAL_BOOST + 1.5;
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
function speedAtDistance(d) {
  return Math.min(SURVIVAL_MAX_SPEED, Math.sqrt(BASE_SPEED * BASE_SPEED + 0.2 * d));
}

/**
 * Obstacle patterns. Each returns one or more rows (lanes left→right) and is
 * only offered once the run is hard enough (`from`, 0..1). Every row keeps at
 * least one lane that can be passed (empty, or a hurdle/gate you can clear),
 * so there is always a way through.
 *   H hurdle → jump · G gate → slide · C crate → change lane · R barrel → jump/dodge
 */
const PATTERNS = {
  // one obstacle in an otherwise open row: learn the moves
  single: { from: 0, weight: (k) => 3 * (1 - k) + 0.3, rows: (r) => [placeOne(r, r() < 0.5 ? "hurdle" : "gate")] },
  // a full wall of the same thing: jump it or slide under it
  hurdleWall: { from: 0, weight: () => 1.1, rows: () => [["hurdle", "hurdle", "hurdle", "hurdle"]] },
  gateWall: { from: 0, weight: () => 1.1, rows: () => [["gate", "gate", "gate", "gate"]] },
  // two blocks, the open side has something to jump or duck
  split: {
    from: 0,
    weight: () => 2,
    rows: (r) => {
      const lanes = [0, 1, 2, 3].map(() => pickFrom(r, [null, "hurdle", "gate"]));
      for (const i of shuffled(r).slice(0, 2)) lanes[i] = "crate";
      return [lanes];
    },
  },
  // every lane has a hurdle or a gate: read the row and pick jump or slide
  mixedWall: {
    from: 0.15,
    weight: (k) => 0.5 + 1.5 * k,
    rows: (r) => {
      const lanes = [0, 1, 2, 3].map(() => (r() < 0.5 ? "hurdle" : "gate"));
      if (lanes.every((x) => x === lanes[0])) lanes[Math.floor(r() * 4)] = lanes[0] === "hurdle" ? "gate" : "hurdle";
      return [lanes];
    },
  },
  // barrels roll at you; the lanes next to them are free
  barrels: {
    from: 0,
    weight: (k) => 0.8 + 0.6 * k,
    lead: 16, // the barrel needs open track in front of it to roll on
    tail: 10,
    rows: (r) => {
      const lanes = [null, null, null, null];
      const a = Math.floor(r() * 4);
      lanes[a] = "roller";
      if (r() < 0.5) lanes[(a + 2) % 4] = "roller";
      return [lanes];
    },
  },
  // slalom: three blocks per row and the gap moves one lane each row
  slalom: {
    from: 0.3,
    weight: (k) => 1.6 * k,
    rows: (r) => {
      let open = Math.floor(r() * 4);
      const dir = open === 0 ? 1 : open === 3 ? -1 : r() < 0.5 ? -1 : 1;
      const out = [];
      const n = 2 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const lanes = ["crate", "crate", "crate", "crate"];
        lanes[open] = null;
        out.push(lanes);
        const next = open + dir;
        open = next < 0 || next > 3 ? open - dir : next;
      }
      return out;
    },
  },
  // jump, then slide straight away
  combo: {
    from: 0.4,
    weight: (k) => k,
    rows: (r) => (r() < 0.5 ? [["hurdle", "hurdle", "hurdle", "hurdle"], ["gate", "gate", "gate", "gate"]] : [["gate", "gate", "gate", "gate"], ["hurdle", "hurdle", "hurdle", "hurdle"]]),
  },
  // a breather: no obstacles, a mystery box and a boost pad
  breather: { from: 0.1, weight: () => 0.6, rows: () => [], rest: true },
};

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
 * The course for a seed: a run of obstacle patterns, boost pads and mystery
 * boxes. Difficulty grows with distance (easy patterns fade out, slaloms and
 * combos come in), and the space between rows is a reaction-time budget at
 * the speed you'll be running there, so rows never come faster than you can
 * react. The same pattern never comes twice in a row. `looks[lane]` picks the
 * visual variant of each obstacle; it never changes how it's cleared.
 */
export function buildCourse(seed, len = TRACK_LEN) {
  const r = rng(seed);
  // looks and boxes use their own stream, so they don't reshuffle the layout
  const r2 = rng((seed ^ 0x9e3779b9) >>> 0);
  const endless = len > TRACK_LEN;
  const rows = [];
  const boosts = [];
  const boxes = [];
  let z = 45;
  let last = "";
  let sinceBox = 0;
  const addBox = (bz) => {
    const first = Math.floor(r2() * 4);
    boxes.push({ z: Math.round(bz * 10) / 10, lane: first });
    if (r2() < 0.45) boxes.push({ z: Math.round(bz * 10) / 10, lane: (first + 1 + Math.floor(r2() * 3)) % 4 });
    sinceBox = 0;
  };
  while (z < len - 40) {
    // 0 → 1 over the first 1.6 km (a sprint stays in the gentle half)
    const k = Math.min(1, z / 1600);
    const speed = endless ? speedAtDistance(z) : BASE_SPEED;
    // seconds you get between rows: 1.3 s at the start, down to 0.9 s
    const step = speed * (1.3 - 0.4 * k);

    const names = Object.keys(PATTERNS).filter((n) => n !== last && k >= PATTERNS[n].from && !(n === "barrels" && z < 90));
    let total = 0;
    for (const n of names) total += PATTERNS[n].weight(k);
    let roll = r() * total;
    let name = names[names.length - 1];
    for (const n of names) {
      roll -= PATTERNS[n].weight(k);
      if (roll <= 0) {
        name = n;
        break;
      }
    }
    const pat = PATTERNS[name];
    last = name;

    if (pat.rest) {
      addBox(z + step * 0.3);
      boosts.push({ z: Math.round((z + step * 0.8) * 10) / 10, lane: Math.floor(r() * 4) });
      z += step * 1.6;
      continue;
    }
    z += pat.lead ?? 0;
    const out = pat.rows(r);
    out.forEach((lanes, i) => {
      if (z >= len - 40) return;
      const looks = lanes.map((kind) => (kind ? Math.floor(r2() * LOOKS[kind]) : 0));
      rows.push({ z: Math.round(z * 10) / 10, lanes, looks });
      if (i < out.length - 1) z += step;
    });
    // room to land and line up for the next pattern (more slack early on)
    const gap = step * (1.15 + r() * 0.5 * (1 - k)) + (pat.tail ?? 0);
    sinceBox += 1;
    if (r() < 0.3) boosts.push({ z: Math.round((z + gap / 2) * 10) / 10, lane: Math.floor(r() * 4) });
    else if (z > 60 && (sinceBox >= 4 || r2() < 0.22)) addBox(z + gap * 0.55);
    z += gap;
  }
  return { rows, boosts, boxes, len };
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

function freshRunner(p) {
  return { ...p, d: 0, lane: p.slot, y: 0, act: "idle", pw: "", finish: null, hits: 0, outAt: null, zapAt: null, bananaAt: null, left: false };
}

function pickHost(state) {
  const h = state.players[state.host];
  if (h && !h.gone) return;
  const next = present(state)[0];
  if (next) state.host = next;
  else if (!h) state.host = ids(state)[0] ?? null;
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
  if (state.kind === "survival") {
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
  if (state.kind === "survival") {
    const alive = racing.filter((id) => {
      const p = state.players[id];
      return p.outAt === null && !p.gone;
    });
    // with friends: last one standing wins; alone: run until your hearts run out
    const over = racing.length >= 2 ? alive.length <= 1 : alive.length === 0;
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

function startRace(state, t) {
  // evict anyone who dropped out before the gun
  for (const id of ids(state)) if (state.players[id].gone) removePlayer(state, id);
  state.round += 1;
  state.seed = ((Math.floor(t) % 2147483647) ^ Math.imul(state.round, 2654435761)) >>> 0;
  state.kind = state.cup ? CUP_RACES[state.cup.race - 1] : state.mode;
  state.phase = "countdown";
  state.startAt = t + COUNTDOWN_MS;
  state.endAt = 0;
  state.firstFinishAt = null;
  state.zaps = [];
  state.bananas = [];
  for (const id of ids(state)) state.players[id] = freshRunner(state.players[id]);
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
    case "start": {
      if (state.phase !== "lobby") return { ok: false, error: "already started" };
      if (state.host !== playerId) return { ok: false, error: "Only the host can start" };
      if (present(state).length < 1) return { ok: false, error: "nobody to race" };
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
      return { ok: true };
    }
    case "zap": {
      if (!me) return { ok: false, error: "join first" };
      if (state.phase !== "race") return { ok: false, error: "not racing" };
      if (me.finish !== null || me.left || me.outAt !== null) return { ok: false, error: "not racing" };
      const t = num(action.t) ? action.t : state.now;
      if (me.zapAt !== null && t - me.zapAt < ZAP_COOLDOWN_MS) return { ok: false, error: "too soon" };
      return { ok: true };
    }
    case "banana": {
      if (!me) return { ok: false, error: "join first" };
      if (state.phase !== "race" || me.finish !== null || me.left || me.outAt !== null) return { ok: false, error: "not racing" };
      if (!intIn(action.lane, 0, LANES - 1) || !num(action.d)) return { ok: false, error: "bad banana" };
      if (action.d < me.d - POS_SLACK_M || action.d > me.d + BANANA_AHEAD_M + 2 * POS_SLACK_M) return { ok: false, error: "bad banana" };
      const t = num(action.t) ? action.t : state.now;
      if (me.bananaAt !== null && t - me.bananaAt < BANANA_COOLDOWN_MS) return { ok: false, error: "too soon" };
      return { ok: true };
    }
    case "slip": {
      if (!me) return { ok: false, error: "join first" };
      if (!(state.bananas ?? []).some((b) => b.id === action.id)) return { ok: false, error: "no banana" };
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
      if (!state.cup || state.cup.race >= CUP_RACES.length) return { ok: false, error: "no next race" };
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
          slot,
          gone: false,
          goneAt: null,
        });
        state.order.push(playerId);
      }
      pickHost(state);
      break;
    }
    case "pick":
      me.char = action.char;
      break;
    case "country":
      me.country = cleanCountry(action.country);
      break;
    case "mode":
      state.mode = action.mode;
      break;
    case "start":
      state.cup = state.mode === "tournament" ? { race: 1, points: {} } : null;
      startRace(state, t);
      break;
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
      const survival = state.kind === "survival";
      if (survival && me.outAt !== null) {
        me.lane = action.lane;
        break;
      }
      const cap = survival ? SURVIVAL_SPEED_CAP : SPEED_CAP;
      const maxD = (cap * elapsed) / 1000 + POS_SLACK_M;
      me.d = Math.max(me.d, Math.min(action.d, maxD, survival ? SURVIVAL_LEN : TRACK_LEN));
      me.lane = action.lane;
      me.y = Math.max(0, Math.min(action.y, 5));
      me.act = action.act;
      if (action.hits !== undefined) me.hits = action.hits;
      if (action.pw !== undefined) me.pw = action.pw;
      if (survival) {
        if (me.hits >= LIVES) {
          me.outAt = t;
          me.act = "out";
          me.pw = "";
        }
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
      state.zaps = [...(state.zaps ?? []), { id: state.zapSeq, by: playerId, d: me.d, at: t }].slice(-6);
      break;
    }
    case "banana": {
      me.bananaAt = t;
      state.bananaSeq = (state.bananaSeq ?? 0) + 1;
      state.bananas = [...(state.bananas ?? []), { id: state.bananaSeq, by: playerId, lane: action.lane, d: Math.round(action.d * 10) / 10, at: t }].slice(-16);
      break;
    }
    case "slip":
      // someone ran onto it: it's gone for everyone
      state.bananas = state.bananas.filter((b) => b.id !== action.id);
      break;
    case "again": {
      for (const id of ids(state)) if (state.players[id].gone) removePlayer(state, id);
      state.phase = "lobby";
      state.cup = null;
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
    if (state.cup.race < CUP_RACES.length) return {};
    const table = cupStandings(state);
    const paying = table.length >= MIN_RACERS_FOR_MEDALS;
    const out = {};
    table.forEach((id, i) => {
      out[id] = { place: i + 1, medal: paying && !state.players[id].left ? MEDALS[i] ?? null : null };
    });
    return out;
  }
  const order = standings(state);
  const paying = order.length >= MIN_RACERS_FOR_MEDALS;
  const out = {};
  order.forEach((id, i) => {
    const p = state.players[id];
    const done = state.kind === "survival" ? true : p.finish !== null;
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
    cup: state.cup
      ? {
          race: state.cup.race,
          races: CUP_RACES,
          points: state.cup.points,
          table: cupStandings(state),
        }
      : null,
    lives: LIVES,
    limitAt:
      state.kind === "survival"
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
        slot: p.slot,
        d: Math.round(p.d * 100) / 100,
        lane: p.lane,
        y: Math.round(p.y * 100) / 100,
        act: p.act,
        pw: p.pw || "",
        finish: p.finish,
        hits: p.hits,
        outAt: p.outAt ?? null,
        gone: p.gone,
        left: p.left,
      };
    }),
    standings: standings(state),
    rewards: rewards(state),
    zaps: state.zaps ?? [],
    bananas: state.bananas ?? [],
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
