/**
 * LANE RUSH — the rules. Pure functions over JSON state.
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

export const meta = { game: "Lane Rush", minPlayers: 1, maxPlayers: 4 };

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
 * Coins for a finishing place: 1st a gold coin, 2nd silver, 3rd and 4th
 * bronze. Runners who didn't finish still get a little something; runners
 * who left get nothing.
 */
export const REWARDS = [
  { coin: "gold", coins: 50 },
  { coin: "silver", coins: 30 },
  { coin: "bronze", coins: 20 },
  { coin: "bronze", coins: 10 },
];
export const DNF_REWARD = { coin: "bronze", coins: 5 };

/** Fastest anyone can legitimately be, plus slack for network jitter. */
const SPEED_CAP = BOOST_SPEED + 1.5;
const POS_SLACK_M = 6;
const ACTS = ["run", "jump", "slide", "stumble", "idle"];

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

/**
 * The course for a seed: rows of obstacles across the four lanes, plus boost
 * pads. Obstacle kinds:
 *   hurdle — low fence: JUMP over it
 *   gate   — high beam: SLIDE / DUCK under it
 *   crate  — tall crate stack: change LANE around it
 * Every row leaves at least two lanes free of crates.
 */
export function buildCourse(seed) {
  const r = rng(seed);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const rows = [];
  const boosts = [];
  let z = 45;
  while (z < TRACK_LEN - 40) {
    const roll = r();
    let lanes;
    if (roll < 0.2) {
      lanes = ["hurdle", "hurdle", "hurdle", "hurdle"];
    } else if (roll < 0.38) {
      lanes = ["gate", "gate", "gate", "gate"];
    } else if (roll < 0.7) {
      lanes = [null, null, null, null].map(() => pick([null, null, "hurdle", "gate"]));
      const crates = 1 + Math.floor(r() * 2);
      // Fisher–Yates, not sort(): sort order with a random comparator differs
      // between browser engines, and every client must build the same course.
      const order = [0, 1, 2, 3];
      for (let i = 3; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      for (let i = 0; i < crates; i++) lanes[order[i]] = "crate";
    } else {
      let crates = 0;
      lanes = [0, 1, 2, 3].map(() => {
        const k = pick(["hurdle", "gate", "crate", null]);
        if (k === "crate" && crates >= 2) return "hurdle";
        if (k === "crate") crates++;
        return k;
      });
      if (lanes.every((k) => k === null)) lanes[Math.floor(r() * 4)] = "hurdle";
    }
    rows.push({ z: Math.round(z * 10) / 10, lanes });
    const gap = 15 + r() * 9;
    if (r() < 0.4) {
      boosts.push({ z: Math.round((z + gap / 2) * 10) / 10, lane: Math.floor(r() * 4) });
    }
    z += gap;
  }
  return { rows, boosts, len: TRACK_LEN };
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
  return { ...p, d: 0, lane: p.slot, y: 0, act: "idle", finish: null, hits: 0, left: false };
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
  const stillRunning = racing.filter((id) => {
    const p = state.players[id];
    return p.finish === null && !p.gone;
  });
  const timeUp = t >= state.startAt + RACE_LIMIT_MS;
  const graceUp = state.firstFinishAt !== null && t >= state.firstFinishAt + AFTER_FIRST_MS;
  if (stillRunning.length === 0 || timeUp || graceUp) {
    state.phase = "results";
    state.endAt = t;
  }
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
      return { ok: true };
    }
    case "again": {
      if (state.phase !== "results") return { ok: false, error: "race not over" };
      if (state.host !== playerId) return { ok: false, error: "Only the host can restart" };
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
    case "start": {
      // evict anyone who dropped out of the lobby before the gun
      for (const id of ids(state)) if (state.players[id].gone) removePlayer(state, id);
      state.round += 1;
      state.seed = ((Math.floor(t) % 2147483647) ^ Math.imul(state.round, 2654435761)) >>> 0;
      state.phase = "countdown";
      state.startAt = t + COUNTDOWN_MS;
      state.endAt = 0;
      state.firstFinishAt = null;
      for (const id of ids(state)) state.players[id] = freshRunner(state.players[id]);
      break;
    }
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
      const maxD = (SPEED_CAP * elapsed) / 1000 + POS_SLACK_M;
      me.d = Math.max(me.d, Math.min(action.d, maxD, TRACK_LEN));
      me.lane = action.lane;
      me.y = Math.max(0, Math.min(action.y, 5));
      me.act = action.act;
      if (action.hits !== undefined) me.hits = action.hits;
      if (me.d >= TRACK_LEN) {
        me.finish = Math.max(1, Math.round(elapsed));
        me.act = "idle";
        if (state.firstFinishAt === null) state.firstFinishAt = t;
      }
      maybeEnd(state, t);
      break;
    }
    case "again": {
      for (const id of ids(state)) if (state.players[id].gone) removePlayer(state, id);
      state.phase = "lobby";
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

/** Coins each runner earned this race, keyed by player id (results only). */
export function rewards(state) {
  if (state.phase !== "results") return {};
  const out = {};
  standings(state).forEach((id, i) => {
    const p = state.players[id];
    if (p.left) return;
    const r = p.finish !== null ? REWARDS[i] ?? DNF_REWARD : DNF_REWARD;
    out[id] = { place: i + 1, coin: r.coin, coins: r.coins };
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
    limitAt:
      state.firstFinishAt !== null
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
        finish: p.finish,
        hits: p.hits,
        gone: p.gone,
        left: p.left,
      };
    }),
    standings: standings(state),
    rewards: rewards(state),
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
