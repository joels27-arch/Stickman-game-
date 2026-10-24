/**
 * 4 FRIENDS — browser client.
 *
 *   net     WebSocket to /ws/<CODE>, join + hello, reconnect, clock sync
 *   ui      home / lobby / HUD / results screens (DOM)
 *   world   three.js scene: grass track, Higgsfield-generated 3D runners and
 *           obstacles, sky
 *   race    local runner physics (jump / slide / lane change / hits) and
 *           smoothed remote runners
 *
 * The server (src/logic.js, served here as /logic.js) is the referee. This
 * file never decides who won; it only runs its own runner and reports.
 */

import * as THREE from "three";
import { GLTFLoader } from "/vendor/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "/vendor/jsm/utils/SkeletonUtils.js";
import { THEMES } from "/themes.js";
import {
  buildCourse,
  TRACK_LEN,
  BASE_SPEED,
  BOOST_SPEED,
  LANES,
  COUNTRIES,
  MEDALS,
  MIN_RACERS_FOR_MEDALS,
  POWERS,
  LIVES,
  POTATO_FUSE_MS,
  SURVIVAL_LEN,
  SURVIVAL_BOOST,
  survivalSpeed,
  runSpeed,
  BANANA_BEHIND_M,
  CUP_POINTS,
  SLOW_PAD_MS,
  ROUND_OPTIONS,
  ROUND_KINDS,
  MAPS,
  MAP_MOVERS,
  EMOTES,
  BANANA_AHEAD_M,
  BOWL_SPEED,
  BOWL_RANGE_M,
  ROCKET_SPEED,
  SURVIVAL_ROCKET,
  powerOdds,
  pickPower,
  START_POWERS,
  ROLLER_SPEED,
  ROLLER_TRIGGER_M,
  glueLane2,
  PUNCH_REACH_M,
  CLOUD_MS,
  brainDistance,
  coinLines,
  COINRUSH_MS,
  isEndless,
  MOVER_KINDS,
  moverX,
  moverCovers,
  moversFor,
  SHOP_EMOTES,
  TRAILS,
} from "/logic.js";

// ── constants ───────────────────────────────────────────────────────────────

const RUNNERS = [
  { name: "Rex", color: "#ef4a3c", file: "c0", tag: "The Viking" },
  { name: "Bolt", color: "#2f7df6", file: "c1b", pic: "p1b", tag: "Lightning Kid" },
  { name: "Ivy", color: "#2fbf55", file: "c2", tag: "The Sprinter" },
  { name: "Gizmo", color: "#f5b921", file: "c3", tag: "Robo Racer" },
  { name: "Pip", color: "#e0703a", file: "c4", tag: "Pirate Captain" },
  { name: "Kiko", color: "#7c4dff", file: "c5", tag: "Shadow Ninja" },
  { name: "Dino", color: "#14b8a6", file: "c6", tag: "Rawr Runner" },
  { name: "Nova", color: "#8fa3bf", file: "c7", tag: "Space Cadet" },
];
const STARTERS = RUNNERS.length;
/** 3D runners you don't start with: Kiko is the Season Pass reward (free track, level 2). */
const KIKO = 5;
const PASS_RUNNERS = { [KIKO]: 2 };

/**
 * Collectible characters: bought in the shop with medals. They don't have 3D
 * models yet, so owning one shows it in your collection ("coming soon to the
 * track") but you can't race with it.
 */
/**
 * Shop characters. Each has exactly one way to unlock:
 *   coins  — bought with coins (price by rarity)
 *   medals — medal exclusives: only medals (higher medals can stand in for lower ones)
 * Pack-only characters live in PACK_CHARS, the Season Pass one in PASS_CHAR.
 * (Anything bought under the old prices stays owned.)
 */
const COLLECTION = [
  { id: "luna", name: "Luna", color: "#9b5cff", rarity: "common", via: "coins", coins: 800 },
  { id: "toto", name: "Toto", color: "#f2f2f2", rarity: "common", via: "coins", coins: 1200 },
  { id: "blaze", name: "Blaze", color: "#ff4b2b", rarity: "rare", via: "coins", coins: 1800 },
  { id: "zara", name: "Zara", color: "#ff6fb5", rarity: "rare", via: "coins", coins: 2400 },
  { id: "jax", name: "Jax", color: "#c98a3c", rarity: "rare", via: "coins", coins: 3000 },
  { id: "momo", name: "Momo", color: "#e9ecef", rarity: "epic", via: "coins", coins: 4500 },
  { id: "leo", name: "Sir Leo", color: "#4c8dff", rarity: "epic", via: "road", legacy: { medal: "silver", count: 4 } },
  { id: "kai", name: "Kai", color: "#21c7d9", rarity: "epic", via: "road", legacy: { medal: "silver", count: 6 } },
  { id: "zed", name: "Zed", color: "#7be3b0", rarity: "legendary", via: "road", legacy: { medal: "gold", count: 3 } },
  { id: "aria", name: "Aria", color: "#e03cff", rarity: "legendary", via: "road", legacy: { medal: "gold", count: 5 } },
  { id: "porky", name: "Porky", color: "#ff9ec4", rarity: "common", via: "coins", coins: 900 },
  { id: "foxy", name: "Flash Fox", color: "#ff7a1a", rarity: "rare", via: "coins", coins: 2200 },
  { id: "pandu", name: "Pandu", color: "#e8e8e8", rarity: "rare", via: "coins", coins: 2800 },
  { id: "sharky", name: "Sharky", color: "#3f8fe0", rarity: "epic", via: "coins", coins: 5000 },
  { id: "unitx", name: "Unit-X", color: "#9aa8bd", rarity: "epic", via: "road", legacy: { medal: "silver", count: 5 } },
  { id: "hoops", name: "Big Slam", color: "#ff8a00", rarity: "legendary", via: "road", legacy: { medal: "gold", count: 4 } },
  { id: "striker", name: "Siete", color: "#e02424", rarity: "legendary", via: "road", legacy: { medal: "gold", count: 6 } },
  // heroes and stars (pictures only)
  { id: "captainstar", name: "Captain Star", color: "#2f5ae0", rarity: "rare", via: "coins", coins: 3500 },
  { id: "webster", name: "Webster", color: "#1a6a78", rarity: "epic", via: "coins", coins: 5500 },
  { id: "gloop", name: "Gloop", color: "#3a1a5a", rarity: "epic", via: "coins", coins: 6000 },
  { id: "kingcrown", name: "King Crown", color: "#6a2ab0", rarity: "legendary", via: "coins", coins: 9000 },
  { id: "boulder", name: "The Boulder", color: "#7a5a3a", rarity: "legendary", via: "coins", coins: 9000 },
  { id: "thunderjack", name: "Thunderjack", color: "#b02a2a", rarity: "legendary", via: "coins", coins: 10000 },
];
const MEDAL_IMG = { gold: "/assets/medal_gold.png", silver: "/assets/medal_silver.png", bronze: "/assets/medal_bronze.png" };
const medalText = (medal, n) => `${n} ${medal} medal${n === 1 ? "" : "s"}`;
const flagOf = (code) => (code && code.length === 2 ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0))) : "");
const withFlag = (name, code) => (code ? `${flagOf(code)} ${name}` : name);
const countryName = (code) => (COUNTRIES.find(([c]) => c === code) || [])[1] || "";
const MODES = ["Solo", "Duo", "Trio", "Squad"];
const GAME_MODE_INFO = {
  survival: { label: "Survival", icon: "❤️", tag: "Main mode", text: "3 hearts. Last one standing wins." },
  chase: { label: "Brain Chase", icon: "🧠", tag: "Run for it", text: "Outrun the giant brain!" },
  coinrush: { label: "Coin Rush", icon: "🪙", tag: "90 seconds", text: "Most coins wins." },
  potato: { label: "Hot Potato", icon: "💣", tag: "Don't be last", text: "Last place holds the bomb!" },
  random: { label: "Random", icon: "🎲", tag: "Surprise", text: "A surprise mode each race." },
  grandtour: { label: "Grand Tour", icon: "🌍", tag: "Tournament", text: "One round of every mode." },
};
/**
 * What the host can put up for the top 3 of a match, paid out of the host's own
 * coins: the whole pot when the match starts, and the shares of places nobody
 * real took (bots, or fewer than 2 real players) come back after the last round.
 */
const PRIZE_INFO = {
  none: { label: "Just glory", icon: "🤝", pays: [] },
  coins: { label: "Small pot", icon: "🪙", pays: [150, 75, 40] },
  bigcoins: { label: "Big pot", icon: "💰", pays: [300, 150, 75] },
  huge: { label: "Huge pot", icon: "👑", pays: [600, 300, 150] },
};
const potOf = (prize) => (PRIZE_INFO[prize ?? "none"]?.pays ?? []).reduce((a, b) => a + b, 0);
/** "3 rounds", or the Grand Tour's fixed 4. */
function roundsOf(v) {
  return v.mode === "grandtour" ? ROUND_KINDS.length : v.rounds ?? 1;
}
function matchLabel(v, gm, endless) {
  const base = endless ? "Endless run" : GAME_MODE_INFO[gm].label;
  const r = roundsOf(v);
  return r > 1 && gm !== "grandtour" ? `${base} · ${r} rounds` : base;
}
const KIND_LABEL = { survival: "Survival", chase: "Brain Chase", coinrush: "Coin Rush", potato: "Hot Potato", sprint: "Sprint" };
/** One line on how to win, shown during the countdown. */
const KIND_RULE = {
  survival: "3 hearts · last one standing wins",
  chase: "Don't let the brain catch you!",
  coinrush: "Grab the most coins in 90 s",
  potato: "Last place holds the bomb. Overtake to lose it!",
  sprint: "First to the finish line",
};
const MAP_INFO = {
  meadow: { label: "Meadow", text: "Trees, bushes and a picket fence" },
  farm: { label: "Farm", text: "Wheat fields, barns and windmills" },
  beach: { label: "Beach", text: "Boardwalk by the sea, palms and huts" },
  city: { label: "City", text: "Down the main street between skyscrapers" },
  stadium: { label: "Stadium", text: "Across the pitch in front of the fans" },
  space: { label: "Space", text: "A neon walkway over the moon" },
  random: { label: "Random", text: "A different map every race" },
};
// the themed maps, built in code (public/themes.js)
const THEME = Object.fromEntries(THEMES.map((t) => [t.id, t]));
for (const t of THEMES) MAP_INFO[t.id] = { label: t.label, text: "", icon: t.icon };
const LANE_W = 2.0; // metres between lane centres
const CHAR_H = 1.55; // runner height in metres
const JUMP_V = 8.6;
const GRAVITY = 26;
const SLIDE_S = 0.75;
// hitting something: knocked over onto your back, then get back up
const FALL_S = 0.6;
const GETUP_S = 1.0;
const STUMBLE_S = FALL_S + GETUP_S;
const INVULN_S = STUMBLE_S + 0.9;
// [start, end] seconds cut from the Higgsfield clips (the rest is wind-up / standing still)
const FALL_CLIP = [0.15, 1.3];
const GETUP_CLIP = [1.9, 6.1];
// power-ups (seconds)
const POWER_S = { shield: 9, rocket: 3.2, ghost: 4.5 };
const FREEZE_S = 3; // how long a freeze slows you
const ROCKET_Y = 2.1;
const POWER_INFO = {
  shield: { label: "Shield", hint: "Blocks the next hit" },
  rocket: { label: "Rocket", hint: "Fly over everything" },
  ghost: { label: "Ghost", hint: "Run through obstacles" },
  lightning: { label: "Lightning", hint: "Everyone ahead trips and slows down" },
  banana: { label: "Banana", hint: "Throw it ahead or drop it behind you" },
  bowling: { label: "Bowling ball", hint: "Roll it ahead or back down a lane" },
  freeze: { label: "Freeze", hint: "Everyone else slows down" },
  glue: { label: "Glue puddle", hint: "Throw it ahead or drop it behind: sticky over 2 lanes" },
  fake: { label: "Fake box", hint: "Throw a trap box ahead or drop it behind" },
  boxing: { label: "Boxing glove", hint: "Punch the nearest runner (25 m) a lane over" },
  brainwave: { label: "Brain Wave", hint: "Flips left and right for everyone ahead" },
  thunder: { label: "Thundercloud", hint: "Storms the leader: pass it on or get zapped" },
  swap: { label: "Mind Swap", hint: "Swap places with the runner ahead" },
  mud: { label: "Mud Splash", hint: "Splats mud over the screens of everyone ahead" },
};
const WAVE_S = 4; // brain wave: controls flipped this long
const GLUE_SLOW = 0.45; // speed factor while stuck in glue
const STAGGER_S = 0.7; // after a punch
const THROWN = new Set(["banana", "bowling", "glue", "fake"]); // items you aim: ahead or behind, any lane
const POWER_TIPS = 3; // how many times a power-up is explained when you pick it up
// phones and tablets (iPads can report a fine pointer, so check for touch too)
const TOUCH = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0 || "ontouchstart" in window;
const BOOST_S = 1.6;
const LANE_SWITCH_SPEED = 9; // lanes per second
const SEND_MS = 100;
const VIEW_AHEAD = 120;
const VIEW_BEHIND = 20;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const laneX = (lane) => (lane - (LANES - 1) / 2) * LANE_W;
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ordinal = (n) => (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");

// ── persistent identity ─────────────────────────────────────────────────────

function store(kind) {
  try {
    const s = window[kind];
    const k = "__t";
    s.setItem(k, k);
    s.removeItem(k);
    return s;
  } catch {
    const mem = new Map();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  }
}
const local = store("localStorage");
const session = store("sessionStorage");

// ── wallet: medals and owned skins live on this device ─────────────────────
const wallet = {
  medals() {
    let m = {};
    try { m = JSON.parse(local.getItem("lr:medals") || "{}") || {}; } catch { /* fresh wallet */ }
    const out = {};
    for (const k of MEDALS) out[k] = Number.isInteger(m[k]) && m[k] > 0 ? m[k] : 0;
    return out;
  },
  save(m) {
    // every medal earned (never spent ones) moves you up the leagues
    let gained = 0;
    let goldWon = 0;
    try {
      rank.points();
      const old = this.medals();
      for (const k of MEDALS) gained += Math.max(0, (m[k] ?? 0) - old[k]) * MEDAL_PTS[k];
      goldWon = Math.max(0, (m.gold ?? 0) - old.gold);
      if (goldWon) goldEver(); // count the old wallet first
    } catch {
      gained = 0; // still starting up
    }
    local.setItem("lr:medals", JSON.stringify(m));
    if (gained) rank.add(gained);
    if (goldWon) local.setItem("lr:goldEver", String(goldEver() + goldWon));
    renderWallet();
  },
  owned() {
    try {
      const a = JSON.parse(local.getItem("lr:owned") || "[]");
      return Array.isArray(a) ? a.filter((i) => Number.isInteger(i) || typeof i === "string") : [];
    } catch {
      return [];
    }
  },
  owns(i) {
    return (i < STARTERS && !(i in PASS_RUNNERS)) || this.owned().includes(i);
  },
  coins() {
    const c = Number(local.getItem("lr:coins"));
    return Number.isFinite(c) && c > 0 ? Math.floor(c) : 0;
  },
  addCoins(n) {
    local.setItem("lr:coins", String(Math.max(0, this.coins() + n)));
    renderWallet();
  },
  buyWithCoins(item) {
    if (!item.coins || this.has(item.id) || this.coins() < item.coins) return false;
    local.setItem("lr:owned", JSON.stringify([...this.owned(), item.id]));
    this.addCoins(-item.coins);
    return true;
  },
  /** Collection characters are owned by id. */
  has(id) {
    return this.owned().includes(id);
  },
  /** Credit a race's medal once (keyed by the race), so reloads don't pay twice. */
  claim(key, medal) {
    let done = [];
    try { done = JSON.parse(local.getItem("lr:claimed") || "[]"); } catch { /* fresh list */ }
    if (!Array.isArray(done)) done = [];
    if (done.includes(key) || !MEDALS.includes(medal)) return false;
    done.push(key);
    local.setItem("lr:claimed", JSON.stringify(done.slice(-60)));
    const m = this.medals();
    m[medal] += 1;
    this.save(m);
    return true;
  },
};
function renderWallet() {
  const m = wallet.medals();
  const coins = wallet.coins().toLocaleString();
  for (const b of document.querySelectorAll(".coinCount")) b.textContent = coins;
  for (const box of document.querySelectorAll(".medal-chip")) {
    box.replaceChildren(...MEDALS.map((k) => el("span", { class: `mc ${k}`, title: `${k} medals` }, el("img", { src: MEDAL_IMG[k], alt: `${k} medals` }), el("b", { text: String(m[k]) }))));
  }
  for (const box of document.querySelectorAll(".wallet")) {
    const coinChip = el("span", { class: "chip", title: "coins" }, el("i", { class: "coin" }), el("b", { text: coins }));
    box.replaceChildren(coinChip, ...MEDALS.map((k) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.title = `${k} medals`;
      const img = document.createElement("img");
      img.src = MEDAL_IMG[k];
      img.alt = `${k} medals`;
      const b = document.createElement("b");
      b.textContent = String(m[k]);
      chip.append(img, b);
      return chip;
    }));
  }
}

function randomId(n, alphabet = "abcdefghijklmnopqrstuvwxyz0123456789") {
  const buf = new Uint32Array(n);
  crypto.getRandomValues(buf);
  return Array.from(buf, (v) => alphabet[v % alphabet.length]).join("");
}

// Per TAB, so two tabs on one computer are two players (and a reload keeps
// the same seat).
let playerId = session.getItem("lr:pid");
if (!playerId) {
  playerId = randomId(12);
  session.setItem("lr:pid", playerId);
}

// ── sound (tiny WebAudio synth, no files) ───────────────────────────────────

/** Player settings (sound, vibration, battery saver), saved on this device. */
function prefs() {
  try {
    return JSON.parse(local.getItem("lr:prefs") || "{}") || {};
  } catch {
    return {};
  }
}
function setPref(k, v) {
  local.setItem("lr:prefs", JSON.stringify({ ...prefs(), [k]: v }));
}
function buzz(pattern) {
  if (prefs().buzz !== false && navigator.vibrate) navigator.vibrate(pattern);
}

/**
 * Sound: recorded effects and two music loops (menu, race), with the old
 * synth blips as a fallback until the files have loaded (or if they can't).
 * Effects follow the Sound setting, music its own Music setting.
 */
const sfx = (() => {
  let ctx = null;
  let loading = false;
  const buffers = new Map();
  const SAMPLES = ["tap", "coin", "unlock", "boom", "whoosh", "cheer", "slip", "thunder", "pack", "bonk", "dizzy"];
  const MUSIC = { menu: 0.3, race1: 0.24, race2: 0.24, race3: 0.24 }; // loop volumes
  const RACE_TRACKS = ["race1", "race2", "race3"]; // a different one each race
  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    if (!loading) {
      loading = true;
      // effects first (small), then the music
      Promise.all(SAMPLES.map((n) => load(n, `/assets/sfx_${n}.mp3`))).then(() =>
        Promise.all(Object.keys(MUSIC).map((n) => load(`m:${n}`, `/assets/music_${n}.mp3`))).then(syncMusic),
      );
    }
    return ctx;
  };
  function load(name, url) {
    return fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(url))))
      .then((data) => new Promise((res, rej) => ctx.decodeAudioData(data, res, rej)))
      .then((buf) => buffers.set(name, buf))
      .catch(() => {}); // the synth fallback covers it
  }
  function tone(freq, dur, type = "square", vol = 0.12, slide = 0) {
    if (prefs().sound === false) return;
    const c = ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }
  /** Play a recorded effect; false if it isn't loaded (so the caller can fall back). */
  function sample(name, vol = 0.6, rate = 1) {
    if (prefs().sound === false) return true;
    const buf = buffers.get(name);
    if (!ctx || !buf) return false;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(ctx.destination);
    src.start();
    return true;
  }
  // music: one loop at a time, cross-faded
  let want = "menu";
  let lastRace = "";
  let playing = null;
  function syncMusic() {
    if (!ctx) return;
    const target = prefs().music !== false && !document.hidden ? want : null;
    if (playing?.name === target) return;
    const t = ctx.currentTime;
    if (playing) {
      const old = playing;
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + 0.6);
      old.src.stop(t + 0.65);
      playing = null;
    }
    const buf = target && buffers.get(`m:${target}`);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(MUSIC[target], t + 0.9);
    src.connect(gain).connect(ctx.destination);
    src.start(t);
    playing = { name: target, src, gain };
  }
  document.addEventListener("visibilitychange", syncMusic);
  // phones only allow sound after a touch: the first one anywhere wakes the audio
  window.addEventListener("pointerdown", () => ensure(), { once: true, capture: true });
  const finish = () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, "square", 0.1), i * 110));
  return {
    unlock: ensure,
    music(name) {
      if (name === "race") {
        // keep the track for the whole race; a new race draws a different one
        if (RACE_TRACKS.includes(want)) return;
        const pick = RACE_TRACKS.filter((n) => n !== lastRace);
        lastRace = pick[Math.floor(Math.random() * pick.length)];
        name = lastRace;
      }
      want = name;
      syncMusic();
    },
    syncMusic,
    tap: () => sample("tap", 0.45) || tone(700, 0.05, "triangle", 0.05),
    tab: () => sample("whoosh", 0.35, 1.15) || tone(500, 0.08, "triangle", 0.05, 300),
    beep: () => tone(520, 0.18, "square", 0.1),
    go: () => tone(880, 0.4, "square", 0.12),
    jump: () => tone(300, 0.2, "triangle", 0.15, 500),
    slide: () => tone(240, 0.22, "sawtooth", 0.05, -120),
    hit: () => sample("bonk", 0.9) || tone(140, 0.35, "sawtooth", 0.18, -90),
    dizzy: () => sample("dizzy", 0.55) || true,
    slip: () => sample("slip", 0.8) || tone(140, 0.35, "sawtooth", 0.18, -90),
    boom: () => sample("boom", 0.8) || tone(90, 0.6, "sawtooth", 0.2, -50),
    boost: () => sample("whoosh", 0.6) || tone(400, 0.35, "triangle", 0.14, 900),
    pickup: () => sample("coin", 0.5, 0.95 + Math.random() * 0.1) || [660, 880, 1175].forEach((f, i) => setTimeout(() => tone(f, 0.12, "triangle", 0.1), i * 60)),
    zap: () => {
      if (sample("thunder", 0.6)) return;
      tone(1400, 0.4, "sawtooth", 0.12, -1300);
      setTimeout(() => tone(90, 0.5, "square", 0.12, -40), 80);
    },
    pop: () => tone(900, 0.18, "sine", 0.16, -700),
    rocket: () => tone(120, 1.2, "sawtooth", 0.08, 500),
    roll: () => tone(70, 0.6, "triangle", 0.1, 20),
    lane: () => tone(660, 0.06, "triangle", 0.06),
    finish: () => sample("unlock", 0.6) || finish(),
    pack: () => sample("pack", 0.8) || finish(),
    cheer: () => sample("cheer", 0.6) || finish(),
  };
})();

document.addEventListener(
  "click",
  (e) => {
    const b = e.target.closest("button");
    if (b && !b.disabled && !b.closest("#hud") && !b.classList.contains("htab")) sfx.tap();
  },
  true,
);

// ── UI helpers ──────────────────────────────────────────────────────────────

const screens = { home: $("#home"), lobby: $("#lobby"), lineup: $("#lineup"), results: $("#results"), shop: $("#shop") };
function showScreen(name) {
  for (const [k, el] of Object.entries(screens)) el.classList.toggle("show", k === name);
  sfx.music(name === "race" ? "race" : "menu");
  if (name !== "race") $("#quitModal").hidden = true;
  $("#hud").classList.toggle("show", name === "race");
  if (name !== "race") $("#raceCurtain").hidden = true; // never left covering a menu
}

/** Write text/HTML only when it changed: no layout work on frames where nothing moved. */
const domCache = new WeakMap();
function setText(node, text) {
  if (node && domCache.get(node) !== text) {
    domCache.set(node, text);
    node.textContent = text;
  }
}
function setHTML(node, html) {
  if (node && domCache.get(node) !== html) {
    domCache.set(node, html);
    node.innerHTML = html;
  }
}

let toastTimer = 0;
function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

/** Higgsfield character-select portrait (upper body, posed) for runner i. */
function portrait(i) {
  return `/assets/pp${i}.webp`;
}

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const k of kids) if (k) n.append(k);
  return n;
}

// Home roster
/** A team-coloured runner card like the lobby's, used on the home screen. */
function runnerCard(i, num) {
  return el(
    "div",
    { class: "rcard", style: `--team:${RUNNERS[i].color}` },
    el("span", { class: "num", text: String(num) }),
    el("img", { class: "pic", src: portrait(i), alt: "" }),
    el("div", { class: "info" }, el("span", { class: "nm", text: RUNNERS[i].name })),
  );
}
for (let i = 0; i < 4; i++) $("#homeRoster").append(runnerCard(i, i + 1));

const nameInput = $("#nameInput");
const codeInput = $("#codeInput");
nameInput.value = local.getItem("lr:name") || "";
// the name is asked once, the first time the game opens; after that it lives in Settings
const nameModal = $("#nameModal");
function askName() {
  $("#firstName").value = /^Runner\d{3}$/.test(nameInput.value) ? "" : nameInput.value;
  $("#nameMsg").textContent = "";
  nameModal.hidden = false;
  setTimeout(() => $("#firstName").focus(), 60);
}
function saveName(n) {
  const name = String(n).trim().slice(0, 14);
  if (!name) return false;
  nameInput.value = name;
  local.setItem("lr:name", name);
  local.setItem("lr:named", "1");
  renderProfile(); // the card top left shows the new name right away
  return true;
}
$("#nameForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!saveName($("#firstName").value)) {
    $("#nameMsg").textContent = "Type a name first";
    return;
  }
  sfx.unlock();
  nameModal.hidden = true;
  if (!local.getItem("lr:tour")) setTimeout(startTour, 450); // first visit: the quick tour
});
// ── first-visit tour: a spotlight on each part of the app, skippable, ending on the endless run ──
const TOUR = [
  { sel: null, welcome: true, title: "Hey {name}, I'm Nia!", text: "Race your friends! Quick tour?" },
  { sel: "#roomRow", img: "/assets/tab_play.webp", title: "Play with friends", text: "Create a room or join a friend's." },
  { sel: "#soloBtn", img: "/assets/pw_rocket.png", title: "Versus bots", text: "Race bots in any mode." },
  { sel: ".stats-hero", open: "stats", img: "/assets/lg_bronze.webp", title: "Your profile", text: "Your stats and how you rank." },
  { sel: "#tourneyList", page: "compete", img: "/assets/tab_trophy.webp", title: "Tournaments", text: "Win coin prizes." },
  { sel: "#skinGrid .ccard", page: "skins", img: "/assets/tab_skins.webp", title: "Skins", text: "Pick who you race with." },
  { sel: "#trophyRoad", page: "missions", img: "/assets/tab_missions.webp", title: "Missions", text: "Missions and the Trophy Road." },
  { sel: "#packRow .pack-card", page: "shop", img: "/assets/tab_shop.webp", title: "Shop", text: "Packs and characters." },
  { sel: "#endlessBtn", img: "/assets/ui_flame.webp", title: "Your first run!", text: "One life. I'll teach you as you run!", last: true },
];
const TOUR_PERKS = [
  ["/assets/pw_rocket.png", "Wild power-ups"],
  ["/assets/medal_gold.png", "Win medals"],
  ["/assets/lg_gold.webp", "Climb leagues"],
];
const tourEl = $("#tour");
let tourAt = 0;
let tourWait = 0;
function startTour() {
  if (homePage !== PAGE.play) setHomePage(PAGE.play);
  tourAt = 0;
  tourEl.hidden = false;
  renderTour();
}
function renderTour() {
  const st = TOUR[tourAt];
  // show what the step talks about: its page, or your profile
  const page = PAGE[st.page ?? "play"];
  const opening = st.open === "stats" && statsModal.hidden;
  if (st.open === "stats") {
    if (opening) {
      renderStats();
      statsModal.hidden = false;
    }
  } else statsModal.hidden = true;
  if (homePage !== page || opening) {
    if (homePage !== page) setHomePage(page);
    // wait for the page to slide in before pointing at it
    $("#tourTip").style.visibility = "hidden";
    clearTimeout(tourWait);
    tourWait = setTimeout(() => {
      $("#tourTip").style.visibility = "";
      renderTour();
    }, 450);
    return;
  }
  const name = (local.getItem("lr:name") || "").trim();
  $("#tourTitle").textContent = st.title.replace("{name}", name || "there");
  $("#tourText").textContent = st.text;
  $("#tourCount").textContent = st.welcome ? "" : `${tourAt} / ${TOUR.length - 1}`;
  $("#tourNext").textContent = st.last ? "Run! →" : st.welcome ? "Show me around →" : "Next →";
  $("#tourBar").replaceChildren(...TOUR.slice(1).map((_, i) => el("i", { class: i + 1 < tourAt ? "done" : i + 1 === tourAt ? "on" : "" })));
  // Nia keeps one still pose for the whole tour
  const img = $("#tourImg");
  img.hidden = !st.img;
  if (st.img) img.src = st.img;
  $("#tourPerks").replaceChildren(...(st.welcome ? TOUR_PERKS.map(([src, t]) => el("span", {}, el("img", { src, alt: "" }), el("b", { text: t }))) : []));
  tourEl.classList.toggle("welcome", Boolean(st.welcome));
  tourEl.classList.toggle("last", Boolean(st.last));
  const hole = $("#tourHole");
  const tip = $("#tourTip");
  const point = $("#tourPoint");
  // replay the pop-in for every step
  tip.classList.remove("in");
  void tip.offsetWidth;
  tip.classList.add("in");
  const target = st.sel ? document.querySelector(st.sel) : null;
  const r = target?.getBoundingClientRect();
  if (!r || !r.width) {
    // no target: a dimmed screen with the card in the middle
    hole.style.cssText = "left:50%;top:45%;width:0;height:0";
    tip.style.cssText = "left:50%;top:52%;transform:translate(-50%,-50%)";
    point.hidden = true;
    return;
  }
  const pad = 6;
  hole.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
  // the card goes below the target if there's room, else above it; a bouncing arrow joins them
  const below = r.bottom + 230 < innerHeight;
  const w = Math.min(340, innerWidth - 24);
  const left = Math.max(12, Math.min(innerWidth - 12 - w, r.left + r.width / 2 - w / 2));
  tip.style.cssText = below ? `left:${left}px;top:${r.bottom + 40}px` : `left:${left}px;top:${r.top - 40}px;transform:translateY(-100%)`;
  point.hidden = false;
  point.className = `tour-point ${below ? "up" : "down"}`;
  point.style.cssText = `left:${r.left + r.width / 2}px;top:${below ? r.bottom + 8 : r.top - 36}px`;
}
function endTour(thenRun) {
  tourEl.hidden = true;
  clearTimeout(tourWait);
  statsModal.hidden = true;
  if (homePage !== PAGE.play) setHomePage(PAGE.play);
  local.setItem("lr:tour", "1");
  if (!thenRun) return;
  // straight into the run (it teaches the moves as you go), as soon as the runners have loaded
  const go = () => ($("#endlessBtn").disabled ? setTimeout(go, 300) : $("#endlessBtn").click());
  go();
}
$("#tourNext").addEventListener("click", () => {
  sfx.tap();
  if (TOUR[tourAt].last) return endTour(true);
  tourAt += 1;
  renderTour();
});
$("#tourSkip").addEventListener("click", () => endTour(false));
// on the last step the highlighted Endless run button itself starts the run
$("#tourHole").addEventListener("click", () => TOUR[tourAt].last && endTour(true));
addEventListener("resize", () => !tourEl.hidden && renderTour());
nameInput.addEventListener("change", () => {
  if (!saveName(nameInput.value)) nameInput.value = local.getItem("lr:name") || "";
  else toast("Name saved");
});
if (!local.getItem("lr:named")) {
  // players from before keep a name they typed themselves; only the random "Runner123" ones get asked
  if (nameInput.value.trim() && !/^Runner\d{3}$/.test(nameInput.value.trim())) local.setItem("lr:named", "1");
  else askName();
}
// Join room opens the code box inside the same card
function openJoin(open) {
  $("#roomRow").hidden = open;
  $("#joinRow").hidden = !open;
  if (open) setTimeout(() => codeInput.focus(), 30);
}
$("#joinOpen").addEventListener("click", () => openJoin(true));
$("#joinClose").addEventListener("click", () => openJoin(false));
const joinParam = new URLSearchParams(location.search).get("join");
if (joinParam) {
  codeInput.value = joinParam.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  $("#roomRow").hidden = true;
  $("#joinRow").hidden = false;
}
codeInput.addEventListener("input", () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
});

function myName() {
  const n = nameInput.value.trim().slice(0, 14);
  return n;
}

// ── net ─────────────────────────────────────────────────────────────────────

const net = {
  socket: null,
  code: null,
  creating: false,
  wantOpen: false,
  retry: 0,
  retryTimer: 0,
  view: null,
  offsets: [],
  offset: 0,
  helloSent: false,
  awaitingHello: false,
  lastMsgAt: 0,
};

function serverNow() {
  return Date.now() + net.offset;
}

function connect(code, creating) {
  disconnect();
  game.seen = null; // a new room: nothing seen yet
  game.quit = false;
  net.code = code;
  net.creating = creating;
  net.wantOpen = true;
  net.view = null;
  net.offsets = [];
  open();
}

function open() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/ws/${encodeURIComponent(net.code)}`);
  net.socket = ws;
  net.helloSent = false;
  ws.addEventListener("open", () => {
    if (ws !== net.socket) return;
    net.retry = 0;
    ws.send(JSON.stringify({ type: "join", playerId }));
    sendHello();
    $("#netWarn").classList.remove("show");
  });
  ws.addEventListener("message", (ev) => {
    if (ws !== net.socket || ev.data === "__pong") return;
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    net.lastMsgAt = performance.now();
    if (msg.type === "state") onState(msg);
    else if (msg.type === "error") onServerError(msg.error);
  });
  ws.addEventListener("close", () => {
    if (ws !== net.socket) return;
    net.socket = null;
    if (!net.wantOpen) return;
    $("#netWarn").classList.add("show");
    net.retry = Math.min(net.retry + 1, 5);
    net.retryTimer = setTimeout(open, 400 * 2 ** (net.retry - 1));
  });
}

function disconnect() {
  net.wantOpen = false;
  clearTimeout(net.retryTimer);
  if (net.socket) {
    const s = net.socket;
    net.socket = null;
    try {
      s.close();
    } catch {
      /* already closed */
    }
  }
  $("#netWarn").classList.remove("show");
}

function send(msg) {
  if (net.socket?.readyState === WebSocket.OPEN) net.socket.send(JSON.stringify(msg));
}
const act = (action) => send({ type: "action", action });

function sendHello() {
  const wasHost = net.view?.host === playerId;
  act({
    type: "hello",
    name: myName() || "Runner",
    char: preferredChar(),
    country: myCountry(),
    rp: rank.rp(),
    trail: equipped().trail,
    create: net.creating || wasHost,
  });
  net.helloSent = true;
  net.awaitingHello = true;
}

function preferredChar() {
  const v = Number(local.getItem("lr:char"));
  return Number.isInteger(v) && v >= 0 && v < RUNNERS.length && wallet.owns(v) ? v : 0;
}

function myCountry() {
  const c = local.getItem("lr:country") || "";
  return COUNTRIES.some(([code]) => code === c) ? c : "";
}

// country picker: a sheet of flag tiles (lobby chip + home settings)
const countryModal = $("#countryModal");
function setCountry(code) {
  local.setItem("lr:country", code);
  renderCountryChips();
  renderFlagGrid();
  if (net.view?.joined) act({ type: "country", country: code });
}
function renderCountryChips() {
  const c = myCountry();
  for (const chip of document.querySelectorAll(".country-chip")) {
    chip.replaceChildren(el("span", { class: "fl", text: c ? flagOf(c) : "🌍" }), el("span", { text: c ? countryName(c) : "Pick your country" }), el("span", { class: "car", text: "▾" }));
  }
}
function renderFlagGrid() {
  const q = $("#countrySearch").value.trim().toLowerCase();
  const cur = myCountry();
  const tiles = [["", "No country"], ...COUNTRIES]
    .filter(([code, name]) => !q || name.toLowerCase().includes(q) || code.toLowerCase() === q)
    .map(([code, name]) => {
      const b = el("button", { class: `flag-tile${code === cur ? " on" : ""}`, type: "button" }, el("span", { class: "fl", text: code ? flagOf(code) : "🌍" }), el("span", { class: "nm", text: name }));
      b.addEventListener("click", () => {
        setCountry(code);
        closeCountry();
      });
      return b;
    });
  $("#flagGrid").replaceChildren(...tiles);
}
function openCountry(title) {
  $("#countryTitle").textContent = title;
  $("#countrySearch").value = "";
  renderFlagGrid();
  countryModal.hidden = false;
}
function closeCountry() {
  countryModal.hidden = true;
}
$("#countrySearch").addEventListener("input", renderFlagGrid);
$("#countryClose").addEventListener("click", closeCountry);
countryModal.addEventListener("click", (e) => e.target === countryModal && closeCountry());
window.addEventListener("keydown", (e) => e.key === "Escape" && !countryModal.hidden && closeCountry());
for (const chip of document.querySelectorAll(".country-chip")) chip.addEventListener("click", () => openCountry("Country you cheer for"));
// settings sheet
const setModal = $("#setModal");
function renderSettings() {
  const p = prefs();
  $("#setSound").checked = p.sound !== false;
  $("#setMusic").checked = p.music !== false;
  $("#setBuzz").checked = p.buzz !== false;
  $("#setLow").checked = Boolean(p.low);
  $("#setCountryName").textContent = myCountry() ? `${flagOf(myCountry())} ${countryName(myCountry())}` : "Not set";
}
$("#settingsBtn").addEventListener("click", () => {
  renderSettings();
  setModal.hidden = false;
});
$("#setClose").addEventListener("click", () => (setModal.hidden = true));
setModal.addEventListener("click", (e) => e.target === setModal && (setModal.hidden = true));
$("#setSound").addEventListener("change", (e) => {
  setPref("sound", e.target.checked);
  if (e.target.checked) sfx.pickup();
});
$("#setMusic").addEventListener("change", (e) => {
  setPref("music", e.target.checked);
  sfx.unlock();
  sfx.syncMusic();
});
$("#setBuzz").addEventListener("change", (e) => {
  setPref("buzz", e.target.checked);
  buzz(40);
});
$("#setLow").addEventListener("change", (e) => {
  setPref("low", e.target.checked);
  applyQuality();
});
$("#setCountry").addEventListener("click", () => {
  setModal.hidden = true;
  openCountry("Country you cheer for");
});
$("#setTut").addEventListener("click", () => {
  local.setItem("lr:tutDone", "");
  local.removeItem("lr:endlessTut");
  toast("The tutorial plays on your next endless run");
});
renderCountryChips();

// ── cosmetics: trails and emotes ──
const TRAIL_INFO = {
  sparkle: { name: "Sparkle", colors: ["#ffffff", "#fff2b0", "#ffd23f"], price: 300 },
  bubbles: { name: "Bubbles", colors: ["#9fe3ff", "#4fc3ff", "#ffffff"], price: 400 },
  fire: { name: "Fire", colors: ["#ff4d00", "#ff9f1c", "#ffe066"], price: 600 },
  rainbow: { name: "Rainbow", colors: ["#ff4d6d"], price: 800 },
  lightning: { name: "Lightning", colors: ["#7df9ff", "#ffffff", "#4f7dff"], price: 800 },
  neon: { name: "Neon", colors: ["#ff3df5", "#3dfcff", "#b6f72a"], pass: "gold" },
};
const EMOTE_PRICE = 200;
const EMOTE_NAME = { "👑": "King", "🧠": "Big brain", "🤡": "Clown", "🥶": "Frozen", "💩": "Poop", "🫡": "Salute" };
function equipped() {
  try {
    const e = JSON.parse(local.getItem("lr:equip") || "{}") || {};
    return { trail: TRAILS.includes(e.trail) && wallet.has(`trail:${e.trail}`) ? e.trail : "" };
  } catch {
    return { trail: "" };
  }
}
function equip(slot, id) {
  const e = equipped();
  e[slot] = e[slot] === id ? "" : id;
  local.setItem("lr:equip", JSON.stringify(e));
}
function giveItem(id) {
  if (!wallet.has(id)) local.setItem("lr:owned", JSON.stringify([...wallet.owned(), id]));
}

// ── shop ───────────────────────────────────────────────────────────────────
let shopReturn = "home";
/** The shop body lives on the home Shop page; from the lobby or results it moves onto the shop screen. */
function mountShop(where) {
  const body = $("#shopBody");
  if (body.parentElement !== where) where.append(body);
}
function shopShown() {
  return screens.shop.classList.contains("show") || (screens.home.classList.contains("show") && homePage === PAGE.shop);
}
/** Open the shop, scrolled to a section: "chars", "packs" or "items". */
function openShop(tab = "chars") {
  if (game.mode === "home") {
    showScreen("home");
    setHomePage(PAGE.shop);
  } else {
    shopReturn = game.mode === "lobby" ? "lobby" : "results";
    mountShop($("#shopMount"));
    renderShop();
    showScreen("shop");
  }
  requestAnimationFrame(() => {
    const target = document.getElementById(`sec-${tab}`);
    const sc = target?.closest(".hp-scroll, .shop-mount");
    if (sc) sc.scrollTop += target.getBoundingClientRect().top - sc.getBoundingClientRect().top - 8;
  });
}
function renderItems() {
  const eq = equipped();
  const card = (id, slot, name, preview, price, pass) => {
    const owned = wallet.has(id);
    const key = id.split(":")[1];
    const on = slot && eq[slot] === key;
    let btn;
    if (owned) {
      btn = el("button", { class: `sbuy${on ? " on" : ""}`, type: "button", text: slot ? (on ? "Equipped ✓" : "Equip") : "Owned ✓" });
      btn.disabled = !slot;
      btn.addEventListener("click", () => {
        equip(slot, key);
        sfx.pop();
        renderItems();
        if (slot === "trail" && net.socket?.readyState === WebSocket.OPEN && net.view?.joined) sendHello();
      });
    } else if (pass) {
      btn = el("button", { class: "sbuy", type: "button", text: pass === "gold" ? "Gold Pass" : "Season Pass" });
      btn.disabled = true;
    } else {
      btn = el("button", { class: "sbuy", type: "button" }, el("i", { class: "coin" }), el("span", { text: price.toLocaleString() }));
      btn.disabled = wallet.coins() < price;
      btn.addEventListener("click", () => {
        if (wallet.coins() < price) return;
        wallet.addCoins(-price);
        giveItem(id);
        if (slot) equip(slot, key);
        sfx.finish();
        toast(`${name} unlocked!`);
        renderItems();
        renderEmoteRows();
      });
    }
    return el("div", { class: `icard${owned ? " owned" : ""}${on ? " on" : ""}` }, preview, el("b", { text: name }), btn);
  };
  const swatch = (k) => el("i", { class: `swatch t-${k}`, style: `--c1:${TRAIL_INFO[k].colors[0]};--c2:${TRAIL_INFO[k].colors[1] ?? TRAIL_INFO[k].colors[0]};--c3:${TRAIL_INFO[k].colors[2] ?? TRAIL_INFO[k].colors[0]}` });
  $("#itemView").replaceChildren(
    el("h3", { class: "album-title", text: "Running trails" }),
    el("div", { class: "item-grid" }, ...Object.entries(TRAIL_INFO).map(([k, t]) => card(`trail:${k}`, "trail", t.name, swatch(k), t.price, t.pass))),
    el("h3", { class: "album-title", text: "Emotes" }),
    el("div", { class: "item-grid emotes" }, ...SHOP_EMOTES.map((e) => card(`emote:${e}`, null, EMOTE_NAME[e] ?? "Emote", el("i", { class: "big-emoji", text: e }), EMOTE_PRICE))),
  );
  renderWallet();
}
// ── the character catalog: every character, its rarity and how you get it ──

const RARITY_ORDER = ["common", "rare", "epic", "legendary"];
const STARTER_RARITY = ["common", "common", "common", "rare", "common", "rare", "rare", "epic"];
function allChars() {
  return [
    ...RUNNERS.map((r, i) => ({ id: `r${i}`, idx: i, name: r.name, tag: r.tag, rarity: STARTER_RARITY[i] ?? "common", via: i in PASS_RUNNERS ? "pass" : "starter", img: portrait(i), hero: `/assets/lu_${r.file}.webp`, playable: true })),
    ...COLLECTION.map((c) => ({ ...c, img: `/assets/sc_${c.id}.webp`, hero: `/assets/sc_${c.id}.webp` })),
    ...PACK_CHARS.map((c) => ({ ...c, via: "pack", img: `/assets/pk_${c.id}.webp`, hero: `/assets/pk_${c.id}.webp` })),
    { ...PASS_CHAR, rarity: "legendary", via: "pass", img: `/assets/pk_${PASS_CHAR.id}.webp`, hero: `/assets/pk_${PASS_CHAR.id}.webp` },
    ...ROAD_CHARS.map((c) => ({ ...c, via: "road", img: `/assets/rd_${c.id}.webp`, hero: `/assets/rd_${c.id}.webp` })),
  ];
}
const ownsChar = (c) => (c.idx !== undefined ? wallet.owns(c.idx) : wallet.has(c.id));
const VIA_LABEL = { starter: "Free", coins: "Coins", pack: "Packs", pass: "Season Pass", road: "Trophy Road" };
const VIA_ICON = { starter: "✅", coins: "🪙", pack: "🎁", pass: "⭐", road: "🏆" };
function howToGet(c) {
  if (c.via === "starter") return "Free to play.";
  if (c.via === "coins") return `${c.coins.toLocaleString()} coins in the Shop.`;
  if (c.via === "pack") return "Only in Mega Packs.";
  if (c.idx in PASS_RUNNERS) return `Season Pass, level ${PASS_RUNNERS[c.idx]}.`;
  if (c.via === "road") return `Trophy Road, at ${ROAD.find((r) => r.char === c.id).pts.toLocaleString()} 🏆.`;
  return "Gold Pass, level 30.";
}
/** The short lock label on a runner card you can't race with yet. */
function lockLabel(i) {
  return i in PASS_RUNNERS ? `⭐ Pass Lv ${PASS_RUNNERS[i]}` : "Locked";
}
function collectionCount() {
  const all = allChars();
  return { got: all.filter(ownsChar).length, all: all.length };
}
function renderCollPill() {
  const { got, all } = collectionCount();
  $("#skinCount").textContent = `${got}/${all}`;
  $("#skinBar").style.width = `${Math.round((got / all) * 100)}%`;
  $("#skinPct").textContent = "";
}
/** A character card: the picture on its rarity colour, the name in big letters, a rarity tag; locked ones show a padlock (and the price, for shop characters). */
const RARITY_ICON = { common: "●", rare: "◆", epic: "✦", legendary: "★" };
function charCard(c, n, onClick) {
  const owned = ownsChar(c);
  const sel = c.playable && c.idx === preferredChar();
  const forCoins = !owned && c.via === "coins";
  const can = forCoins && wallet.coins() >= c.coins;
  const name = forCoins ? el("b", { class: `cname price${can ? "" : " short"}` }, el("i", { class: "coin" }), el("span", { text: c.coins.toLocaleString() })) : el("b", { class: "cname", text: c.name });
  const tag = owned
    ? el("span", { class: "crar" }, el("i", { text: RARITY_ICON[c.rarity] }), el("span", { text: sel ? "Selected" : c.rarity }))
    : el("span", { class: "crar lock" }, el("span", { text: forCoins ? "Locked" : c.idx in PASS_RUNNERS ? `Pass Lv ${PASS_RUNNERS[c.idx]}` : VIA_LABEL[c.via] }));
  const b = el(
    "button",
    { class: `ccard ${c.rarity}${owned ? " got" : " locked"}${sel ? " sel" : ""}`, type: "button", style: `--i:${n}`, "aria-label": c.name },
    el("span", { class: "cpic" }, el("img", { src: c.img, alt: "" }), owned ? null : el("i", { class: "padlock", text: "🔒" })),
    el("span", { class: "cfoot" }, name, tag),
  );
  b.addEventListener("click", () => onClick(c));
  return b;
}
const byRarity = (x, y) => RARITY_ORDER.indexOf(x.rarity) - RARITY_ORDER.indexOf(y.rarity);
const VIA_GROUP = { coins: "🪙 Buy with coins", pack: "🎁 From packs", pass: "⭐ Season Pass", road: "🏆 Trophy Road" };
/** Characters split by how you get them (in this order), each group sorted common → legendary; empty groups left out. */
function charGroups(list, order) {
  return order.map((via) => [via, list.filter((c) => c.via === via).sort(byRarity)]).filter(([, l]) => l.length);
}
/** Favourite skins (starred on the Skins page) come first. */
function favs() {
  try {
    const f = JSON.parse(local.getItem("lr:favs") || "[]");
    return Array.isArray(f) ? f : [];
  } catch {
    return [];
  }
}
function toggleFav(id) {
  const f = favs();
  local.setItem("lr:favs", JSON.stringify(f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
}
/** Skins: your runners first (favourites on top), then everything still to get, each from common to legendary. */
function renderSkins() {
  const all = allChars();
  const fav = favs();
  const mine = all.filter(ownsChar).sort((a, b) => Number(fav.includes(b.id)) - Number(fav.includes(a.id)) || byRarity(a, b));
  const rest = all.filter((c) => !ownsChar(c)).sort(byRarity);
  let n = 0;
  $("#skinGrid").replaceChildren(
    el("h3", { class: "coll-head", text: `Yours · ${mine.length}` }),
    ...mine.map((c) => {
      // a tap on one of your runners picks it straight away; the ⓘ shows its card
      const card = charCard(c, n++, c.playable ? selectRunner : inspectChar);
      if (c.playable) {
        const info = el("button", { class: "cinfo", type: "button", "aria-label": `About ${c.name}`, text: "i" });
        info.addEventListener("click", (e) => {
          e.stopPropagation();
          inspectChar(c);
        });
        card.append(info);
      }
      const on = fav.includes(c.id);
      const star = el("button", { class: `fav${on ? " on" : ""}`, type: "button", "aria-label": on ? "Remove from favourites" : "Add to favourites", text: on ? "★" : "☆" });
      star.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFav(c.id);
        renderSkins();
      });
      card.append(star);
      return card;
    }),
    ...(rest.length
      ? charGroups(rest, ["coins", "pack", "road", "pass"]).flatMap(([via, list]) => [el("h3", { class: "coll-head", text: `${VIA_GROUP[via]} · ${list.length}` }), ...list.map((c) => charCard(c, n++, inspectChar))])
      : [el("p", { class: "rempty", text: "You've collected every runner!" })]),
  );
  renderCollPill();
}

/**
 * The shop: packs, every character (yours first, then the ones still to get,
 * each from common to legendary) and items, all on one page.
 */
function renderShop() {
  // characters for sale: the coin ones you don't have yet (your collection is under Skins), from common to legendary
  const sale = allChars().filter((c) => c.via === "coins" && !ownsChar(c));
  $("#collCount").textContent = `${sale.length} for sale`;
  const buy = (x) => askBuy(COLLECTION.find((y) => y.id === x.id));
  let n = 0;
  $("#shopGrid").replaceChildren(
    ...charGroups(sale, ["coins"]).flatMap(([via, list]) => [el("h3", { class: "coll-head", text: VIA_GROUP[via] }), ...list.map((c) => charCard(c, n++, buy))]),
    ...(sale.length ? [] : [el("p", { class: "rempty", text: "You own every shop character!" })]),
  );
  renderPacks();
  renderItems();
  renderCollPill();
  renderWallet();
}

// ── buying, with a confirmation and an unlock reveal ──
let buying = null;
const buyModal = $("#buyModal");
function askBuy(c) {
  buying = c;
  $("#buyTitle").textContent = "Unlock?";
  $("#buyPreview").replaceChildren(el("div", { class: `bp-card ${c.rarity}` }, el("span", { class: "rar", text: c.rarity }), el("img", { src: `/assets/sc_${c.id}.webp`, alt: "" }), el("b", { text: c.name })));
  const can = wallet.coins() >= c.coins;
  $("#buyPrice").replaceChildren(
    el("span", {}, el("i", { class: "coin" }), el("b", { text: c.coins.toLocaleString() }), el("small", { text: ` · you have ${wallet.coins().toLocaleString()}` })),
    ...(can ? [] : [el("em", { text: `You need ${(c.coins - wallet.coins()).toLocaleString()} more coins` })]),
  );
  $("#buyOk").disabled = !can;
  $("#buyOk").textContent = can ? "Unlock" : "Can't afford yet";
  buyModal.hidden = false;
}
$("#buyCancel").addEventListener("click", () => {
  buying = null;
  buyModal.hidden = true;
});
buyModal.addEventListener("click", (e) => e.target === buyModal && $("#buyCancel").click());
$("#buyOk").addEventListener("click", () => {
  const c = buying;
  buying = null; // one purchase per confirmation, however fast you tap
  buyModal.hidden = true;
  if (!c || wallet.has(c.id)) return;
  const ok = wallet.buyWithCoins(c);
  if (!ok) return toast("Not enough to unlock that yet");
  stats.add("bought", 1);
  showUnlock({ kind: "char", char: { ...c, img: `/assets/sc_${c.id}.webp` } }, () => {
    if (shopShown()) renderShop();
    if (homePage === PAGE.skins) renderSkins();
  });
  renderCollPill();
});

/** Race with this runner from now on. */
function selectRunner(c) {
  if (c.idx === preferredChar()) return;
  local.setItem("lr:char", String(c.idx));
  world.setShowcase?.(c.idx);
  if (net.view?.phase === "lobby" && net.view.joined) act({ type: "pick", char: c.idx });
  sfx.pop();
  buzz(20);
  renderProfile();
  if (homePage === PAGE.skins) renderSkins();
  if (shopShown()) renderShop();
  const card = [...document.querySelectorAll("#skinGrid .ccard.sel")][0];
  card?.classList.add("picked");
}

// inspect one character: big picture, rarity, how to get it, and the one action that makes sense
const charModal = $("#charModal");
function inspectChar(c) {
  const owned = ownsChar(c);
  $("#charHero").replaceChildren(el("i", { class: `glow ${c.rarity}` }), el("img", { class: owned ? "" : "dark", src: c.hero, alt: "" }));
  $("#charName").textContent = c.name;
  $("#charTags").replaceChildren(el("span", { class: `tag ${c.rarity}`, text: c.rarity }), el("span", { class: "tag via", text: `${VIA_ICON[c.via]} ${VIA_LABEL[c.via]}` }), c.playable ? el("span", { class: "tag play", text: "🏃 Playable" }) : el("span", { class: "tag soon", text: "Collectible · playable soon" }));
  $("#charHow").textContent = owned ? (c.playable ? c.tag ?? "" : "In your collection. 3D racing version coming soon!") : howToGet(c);
  const btn = $("#charAct");
  btn.className = "gbtn";
  btn.disabled = false;
  let action = null;
  if (owned && c.playable) {
    const sel = preferredChar() === c.idx;
    btn.textContent = sel ? "Selected ✓" : "Select runner";
    btn.disabled = sel;
    action = () => {
      local.setItem("lr:char", String(c.idx));
      world.setShowcase?.(c.idx);
      if (net.view?.phase === "lobby" && net.view.joined) act({ type: "pick", char: c.idx });
      toast(`${c.name} selected`);
      charModal.hidden = true;
      if (shopShown()) renderShop();
      if (homePage === PAGE.skins) renderSkins();
    };
  } else if (owned) {
    btn.textContent = "In your collection ✓";
    btn.disabled = true;
  } else if (c.via === "road") {
    btn.textContent = "See the Trophy Road";
    action = () => {
      charModal.hidden = true;
      showScreen("home");
      setHomePage(PAGE.missions);
    };
  } else if (c.via === "coins") {
    btn.textContent = `Unlock · ${c.coins.toLocaleString()} coins`;
    action = () => {
      charModal.hidden = true;
      askBuy(c);
    };
  } else if (c.via === "pack") {
    btn.textContent = "Open packs";
    action = () => {
      charModal.hidden = true;
      openShop("packs");
    };
  } else {
    btn.textContent = "Go to the Season Pass";
    action = () => {
      charModal.hidden = true;
      showScreen("home");
      $("#passPill").click();
    };
  }
  btn.onclick = action;
  charModal.hidden = false;
}
$("#charClose").addEventListener("click", () => (charModal.hidden = true));
charModal.addEventListener("click", (e) => e.target === charModal && (charModal.hidden = true));

// ── packs: open them for pack-only characters, medals and coins ──

const PACK_CHARS = [
  { id: "brainz", name: "Prof. Brainz", rarity: "legendary", dupe: 1500 },
  { id: "frosty", name: "Frosty", rarity: "epic", dupe: 600 },
  { id: "ra", name: "Pharaoh Ra", rarity: "epic", dupe: 600 },
  { id: "fin", name: "Captain Fin", rarity: "rare", dupe: 300 },
  { id: "mo", name: "Mecha Mo", rarity: "rare", dupe: 300 },
  { id: "zorp", name: "Zorp", rarity: "rare", dupe: 300 },
  { id: "glorb", name: "Glorb", rarity: "epic", dupe: 600 },
  { id: "rapstar", name: "MC Gold", rarity: "epic", dupe: 600 },
  { id: "magic", name: "Diez", rarity: "legendary", dupe: 1500 },
  { id: "dancer", name: "Disco Dash", rarity: "legendary", dupe: 1500 },
];
/** Chances per item slot. Normal slots, and the boosted last slot of a Mega Pack. */
/** Character odds per item (the rest is coins). Packs never contain medals. */
const PACK_ODDS = {
  normal: { legendary: 0, epic: 0, rare: 0 }, // the first two items are coins: one character per pack, at most
  boosted: { legendary: 0.05, epic: 0.25, rare: 0.7 }, // the Mega Pack's last item: always a character
};
const NEWBIE_PACKS = 3; // your first packs: double character odds, and the very first one always has a new character
/** One pack type: 3 items, the last one always a character. */
const PACKS = [{ id: "mega", name: "Mega Pack", price: 1200, slots: ["normal", "normal", "boosted"], img: "/assets/pack_mega.webp", note: "Coins + 1 character" }];
const pct = (x) => `${Math.round(x * 1000) / 10}%`;
/** A character you don't own yet if that rarity has one left, else a duplicate. */
function packChar(rarity) {
  const pool = PACK_CHARS.filter((c) => c.rarity === rarity);
  const fresh = pool.filter((c) => !wallet.has(c.id));
  const from = fresh.length ? fresh : pool;
  return { kind: "char", char: from[Math.floor(Math.random() * from.length)] };
}
function rollSlot(kind, boost = 1) {
  const o = PACK_ODDS[kind];
  let r = Math.random();
  for (const rarity of ["legendary", "epic", "rare"]) {
    const p = o[rarity] * boost;
    if (r < p) return packChar(rarity);
    r -= p;
  }
  return { kind: "coins", n: kind === "boosted" ? 600 : 150 + 25 * Math.floor(Math.random() * 13) };
}
function freePackLeft() {
  return !local.getItem("lr:freePack");
}
/** Pay, roll and credit everything right away (so closing the animation can't lose items). */
function buyPack(pack) {
  const free = pack.id === "mega" && freePackLeft();
  if (!free && wallet.coins() < pack.price) return null;
  if (free) local.setItem("lr:freePack", "1");
  else wallet.addCoins(-pack.price);
  return grantPack(pack);
}
/** Roll a pack's items and credit them (characters, medals, coins). */
function grantPack(pack) {
  const opened = stats.get("packs");
  const boost = opened < NEWBIE_PACKS ? 2 : 1;
  const items = pack.slots.map((kind) => rollSlot(kind, boost));
  // the very first pack always has a character you don't have yet
  if (opened === 0 && !items.some((it) => it.kind === "char" && !wallet.has(it.char.id))) {
    const left = PACK_CHARS.filter((c) => !wallet.has(c.id) && c.rarity !== "legendary");
    if (left.length) items[0] = { kind: "char", char: left[Math.floor(Math.random() * left.length)] };
  }
  // one character per pack at most: the best one stays, any other becomes coins
  const chars = items.filter((it) => it.kind === "char").sort((a, b) => RARITY_ORDER.indexOf(b.char.rarity) - RARITY_ORDER.indexOf(a.char.rarity));
  for (const extra of chars.slice(1)) items[items.indexOf(extra)] = { kind: "coins", n: 300 };
  for (const it of items) {
    if (it.kind === "char") {
      if (wallet.has(it.char.id)) {
        it.dupe = true;
        wallet.addCoins(it.char.dupe);
      } else local.setItem("lr:owned", JSON.stringify([...wallet.owned(), it.char.id]));
    } else wallet.addCoins(it.n);
  }
  stats.add("packs", 1);
  return items;
}
function renderPacks() {
  $("#packRow").replaceChildren(
    ...PACKS.map((pk) => {
      const free = pk.id === "mega" && freePackLeft();
      const btn = el("button", { class: "sbuy", type: "button" }, ...(free ? [el("span", { text: "Free!" })] : [el("i", { class: "coin" }), el("span", { text: pk.price.toLocaleString() })]));
      btn.disabled = !free && wallet.coins() < pk.price;
      btn.addEventListener("click", () => {
        const items = buyPack(pk);
        if (items) openPackAnim(pk, items);
      });
      return el(
        "div",
        { class: `pack-card ${pk.id}` },
        free ? el("span", { class: "freetag", text: "1 free" }) : null,
        el("img", { class: "pack-img", src: pk.img, alt: "" }),
        el("b", { text: pk.name }),
        el("small", { text: pk.note }),
        btn,
      );
    }),
  );
  const b = PACK_ODDS.boosted;
  $("#packOdds").textContent = `Character odds: legendary ${pct(b.legendary)} · epic ${pct(b.epic)} · rare ${pct(b.rare)}`;
  renderWallet();
}

// the opening: shake → tap → flash → one card at a time
const packOpen = $("#packOpen");
let po = null;
function openPackAnim(pack, items) {
  po = { pack, items, i: -1, stage: "sealed" };
  $("#poPack").src = pack.img;
  $("#poPack").hidden = false;
  $("#poPack").className = "po-pack shake";
  $("#poCard").hidden = true;
  $("#poSummary").hidden = true;
  $("#poDone").hidden = true;
  $("#poHint").hidden = false;
  $("#poHint").textContent = "Tap to open!";
  packOpen.hidden = false;
  sfx.unlock();
}
function itemCard(it) {
  if (it.kind === "char") {
    return el(
      "div",
      { class: `pcard ${it.char.rarity}` },
      el("span", { class: "rar", text: it.char.rarity }),
      el("i", { class: "pglow" }),
      el("img", { src: it.char.img ?? `/assets/pk_${it.char.id}.webp`, alt: "" }),
      el("b", { text: it.char.name }),
      el("small", { text: it.dupe ? `Duplicate → +${it.char.dupe} coins` : it.unlocked ? "UNLOCKED!" : "NEW character!" }),
    );
  }
  if (it.kind === "medal") {
    return el("div", { class: `pcard medal ${it.medal}` }, el("span", { class: "rar", text: "medal" }), el("i", { class: "pglow" }), el("img", { src: MEDAL_IMG[it.medal], alt: "" }), el("b", { text: `${it.medal} medal` }), el("small", { text: "+1" }));
  }
  return el("div", { class: "pcard coins" }, el("span", { class: "rar", text: "coins" }), el("i", { class: "pglow" }), el("img", { src: it.n >= 400 ? "/assets/ui_c3.webp" : it.n >= 250 ? "/assets/ui_c2.webp" : "/assets/ui_c1.webp", alt: "" }), el("b", { text: `+${it.n} coins` }), el("small", { text: "" }));
}
function packStep() {
  if (!po) return;
  if (po.stage === "sealed") {
    po.stage = "cards";
    $("#poPack").className = "po-pack burst";
    packOpen.classList.remove("flash");
    void packOpen.offsetWidth;
    packOpen.classList.add("flash");
    sfx.pack();
    setTimeout(() => {
      $("#poPack").hidden = true;
      packStep();
    }, 520);
    return;
  }
  if (po.stage !== "cards" || po.busy) return;
  po.i += 1;
  if (po.i >= po.items.length) {
    po.stage = "done";
    delete packOpen.dataset.reveal;
    $("#poCard").hidden = true;
    $("#poHint").hidden = true;
    $("#poSummary").replaceChildren(...po.items.map((it) => itemCard(it)));
    $("#poSummary").hidden = false;
    $("#poDone").hidden = false;
    return;
  }
  const it = po.items[po.i];
  const card = itemCard(it);
  const fresh = it.kind === "char" && !it.dupe;
  delete packOpen.dataset.reveal;
  $("#poCard").hidden = false;
  $("#poHint").textContent = po.i < po.items.length - 1 ? `Tap for the next one (${po.i + 1}/${po.items.length})` : "Tap to continue";
  if (!fresh) {
    card.classList.add("flip");
    $("#poCard").replaceChildren(card);
    sfx.boost();
    po.busy = true;
    setTimeout(() => po && (po.busy = false), 450);
    return;
  }
  // a new character: the card back glows and shakes in its rarity colour, then bursts open
  const rarity = it.char.rarity;
  const back = el("div", { class: `pcard-back ${rarity}` }, el("b", { text: "?" }));
  $("#poCard").replaceChildren(back);
  $("#poHint").textContent = "";
  po.busy = true;
  sfx.pack();
  setTimeout(() => {
    if (!po) return;
    packOpen.dataset.reveal = rarity;
    packOpen.classList.remove("flash");
    void packOpen.offsetWidth;
    packOpen.classList.add("flash");
    card.classList.add("hero");
    card.append(el("em", { class: "pnew", text: "NEW!" }));
    $("#poCard").replaceChildren(card);
    confetti($("#poFx"), rarity === "legendary" ? 90 : rarity === "epic" ? 60 : 40, rarity);
    sfx.finish();
    if (rarity === "legendary") setTimeout(() => sfx.cheer(), 250);
    buzz([30, 40, 80]);
    $("#poHint").textContent = po.i < po.items.length - 1 ? `Tap for the next one (${po.i + 1}/${po.items.length})` : "Tap to continue";
    setTimeout(() => po && (po.busy = false), 700);
  }, 900);
}
packOpen.addEventListener("click", (e) => {
  if (e.target.closest("#poDone")) return;
  packStep();
});
/** Confetti bursting out from the middle of the screen, in a rarity's colours. */
function confetti(box, n, rarity) {
  const cols = { legendary: ["#ffd23f", "#fff2a8", "#ff9f1c", "#ffffff"], epic: ["#c27bff", "#ff7ad9", "#ffffff", "#7ab8ff"], rare: ["#4fc3ff", "#7cf2c8", "#ffffff"], common: ["#ffffff", "#b6f72a"] }[rarity] ?? ["#ffffff"];
  for (let i = 0; i < n; i++) {
    const c = el("i", { class: "conf", style: `background:${cols[i % cols.length]}` });
    box.append(c);
    const a = Math.random() * Math.PI * 2;
    const d = 140 + Math.random() * 260;
    c.animate(
      [
        { transform: "translate(-50%, -50%) rotate(0deg) scale(1)", opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 160}px)) rotate(${(Math.random() - 0.5) * 900}deg) scale(0.6)`, opacity: 0 },
      ],
      { duration: 1100 + Math.random() * 900, easing: "cubic-bezier(.15,.7,.3,1)", fill: "forwards" },
    ).onfinish = () => c.remove();
  }
}
$("#poDone").addEventListener("click", () => {
  packOpen.hidden = true;
  delete packOpen.dataset.reveal;
  const done = po?.onDone;
  po = null;
  renderCollPill();
  if (done) return done();
  renderShop();
});
/** A single card reveal (no pack): a purchase or a reward. */
function showUnlock(item, onDone) {
  po = { pack: null, items: [{ ...item, unlocked: true }], i: -1, stage: "cards", onDone };
  $("#poPack").hidden = true;
  $("#poCard").hidden = true;
  $("#poSummary").hidden = true;
  $("#poDone").hidden = true;
  $("#poHint").hidden = false;
  packOpen.hidden = false;
  packOpen.classList.remove("flash");
  void packOpen.offsetWidth;
  packOpen.classList.add("flash");
  packStep();
}

for (const b of document.querySelectorAll(".shopBtn")) b.addEventListener("click", () => openShop(b.dataset.tab || "chars"));
$("#shopBack").addEventListener("click", () => {
  mountShop($("#shopHome"));
  showScreen(shopReturn);
  if (shopReturn === "lobby" && net.view) renderLobby(net.view);
});
renderWallet();

setInterval(() => {
  if (net.socket?.readyState === WebSocket.OPEN) net.socket.send("__ping");
}, 25000);

function onServerError(error) {
  if (error === "code taken" && net.creating) {
    // Someone is already using this code: roll a new one.
    connect(newCode(), true);
    return;
  }
  const fatal = [
    "No lobby with that code",
    "That lobby is full (4/4)",
    "That race already started — wait for the next one",
    "Enter a name first",
  ];
  if (fatal.includes(error)) {
    disconnect();
    leaveToHome(error === "No lobby with that code" ? `No lobby “${net.code}” — check the code` : error);
    return;
  }
  if (error === "join first" && net.socket) {
    sendHello();
    return;
  }
  if (error === "box gone") return loseBox();
  if (error === "nobody close") return toast("Nobody close enough: get within 12 m of someone");
  if (error === "heart gone" || error === "full health" || error === "no hearts in this race") return;
  // someone (or a bot) got to the coin first: trust the server's count again
  if (error === "coin gone" || error === "bad coin") {
    game.coinsShown = net.view?.players.find((p) => p.id === playerId)?.coins ?? 0;
    return;
  }
  // the target moved before the item landed: give the item back
  if (["nobody ahead", "nobody there", "too far", "a cloud is already out"].includes(error)) {
    if (me.lastUsed && me.items.length < 2) me.items.unshift(me.lastUsed);
    me.lastUsed = "";
    renderPower();
    return toast(error === "a cloud is already out" ? "A storm is already out: kept your item" : "Missed! You kept your item");
  }
  if (["not racing", "race not over", "already started", "no banana", "no ball", "too soon"].includes(error)) return; // harmless races
  if (error.startsWith("Waiting for")) return toast(error);
  toast(error);
}

function onState(msg) {
  // clock: the best (largest) sample has the least network delay in it
  const sample = msg.serverTime - Date.now();
  net.offsets.push(sample);
  if (net.offsets.length > 30) net.offsets.shift();
  net.offset = Math.max(...net.offsets);

  const v = msg.view;
  if (!v || game.quit) return; // we left: the room's last updates mustn't pull us back in
  const prev = net.view;
  net.view = v;

  if (!v.joined) {
    // Connected but not (or no longer) in the lobby. Right after (re)joining
    // our hello is still in flight, so only a later "not joined" means we
    // really were dropped.
    if (!net.awaitingHello && prev?.joined) {
      disconnect();
      leaveToHome("You were away too long and left the lobby");
    }
    return;
  }
  net.awaitingHello = false;
  net.creating = false; // we are in; never "create" again on reconnect unless host
  for (const p of v.players) remote.ingest(p, v);
  announce(prev, v);
  applyWarpsAndPunches(v);

  if (v.phase === "lobby" && game.endless) {
    // endless run: set it up and go, the lobby never shows
    if (v.host === playerId && !game.endlessSent) {
      game.endlessSent = true;
      if (v.mode !== "survival") act({ type: "mode", mode: "survival" });
      // the tutorial run is on the meadow; after that any map. Load it all, then start
      const map = local.getItem("lr:endlessTut") ? MAPS[Math.floor(Math.random() * MAPS.length)] : "meadow";
      if (v.map !== map) act({ type: "map", map });
      showScreen("race");
      showCurtain(map);
      const ready = Promise.all([world.ensureMap(map), world.preloadMovers(map), world.ensureChar(preferredChar())]).catch(() => {});
      Promise.race([ready, new Promise((ok) => setTimeout(ok, 8000))]).then(() => act({ type: "start", bots: false, endless: true }));
    }
    return;
  }
  if (v.phase === "lobby") {
    // hosting from the Tournaments page: open the room in the mode picked there
    if (game.wantMode && v.host === playerId) {
      if (v.mode !== game.wantMode) act({ type: "mode", mode: game.wantMode });
      game.wantMode = null;
    }
    if (game.mode !== "lobby") enterLobby();
    renderLobby(v);
  } else if (v.phase === "countdown" || v.phase === "race") {
    if (game.mode !== "race" || game.round !== v.round) enterRace(v);
    else modeView(v);
  } else if (v.phase === "results") {
    if (game.mode === "race") finishRaceView(v);
    else if (game.mode === "results") renderResults(v);
    else if (game.mode !== "results-pending") showResults(v);
  }
}

function newCode() {
  return randomId(4, CODE_ALPHABET);
}

// ── home ────────────────────────────────────────────────────────────────────

function requireName() {
  const n = myName();
  if (!n || !local.getItem("lr:named")) {
    askName();
    return null;
  }
  local.setItem("lr:name", n);
  $("#homeMsg").textContent = "";
  return n;
}

/**
 * Character spotlight: your runner big in the middle on a glowing stage, the
 * previous and next runners greyed out at the sides, arrows to flip through.
 * `takenBy(i)` names whoever already has runner i (those are skipped).
 */
function renderSpotlight(box, cur, { takenBy = () => null, onPick }) {
  const n = RUNNERS.length;
  const free = (i) => !takenBy(i) || i === cur;
  const step = (dir) => {
    for (let k = 1; k < n; k++) {
      const i = (cur + dir * k + n * k) % n;
      if (free(i)) return i;
    }
    return cur;
  };
  const prev = (cur + n - 1) % n;
  const next = (cur + 1) % n;
  const r = RUNNERS[cur];
  const arrow = (dir, label) => {
    const b = el("button", { class: `spot-arrow ${dir < 0 ? "l" : "r"}`, type: "button", "aria-label": label, text: dir < 0 ? "‹" : "›" });
    b.addEventListener("click", () => onPick(step(dir)));
    return b;
  };
  const side = (i, cls) => {
    const img = el("img", { class: `spot-side ${cls}`, src: portrait(i), alt: "" });
    img.addEventListener("click", () => free(i) && onPick(i));
    return img;
  };
  box.style.setProperty("--team", r.color);
  box.replaceChildren(
    el("div", { class: "spot-floor" }),
    side(prev, "l"),
    side(next, "r"),
    el("img", { class: "spot-hero", src: portrait(cur), alt: r.name }),
    arrow(-1, "Previous runner"),
    arrow(1, "Next runner"),
    el("div", { class: "spot-name" }, el("b", { text: r.name }), el("span", { text: r.tag })),
    el("div", { class: "spot-dots" }, ...RUNNERS.map((_, i) => el("i", { class: i === cur ? "on" : takenBy(i) ? "taken" : "" }))),
  );
  // swipe on phones
  let sx = null;
  box.ontouchstart = (e) => (sx = e.touches[0].clientX);
  box.ontouchend = (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    sx = null;
    if (Math.abs(dx) > 40) onPick(step(dx < 0 ? 1 : -1));
  };
}

// Play solo: your own private room (no invite code) where you pick the mode, map and runner, with bots
function openSoloRoom(mode = null) {
  game.solo = true;
  game.endless = false;
  game.wantMode = mode;
  connect(newCode(), true);
}
/** Endless run: just you. No lobby, no bots: straight onto the track until your hearts run out. */
function startEndless() {
  game.solo = true;
  game.endless = true;
  game.endlessSent = false;
  game.wantMode = null;
  connect(newCode(), true);
}
function renderEndlessBest() {
  const best = stats.get("bestRun");
  $("#endlessBest").textContent = best ? `Your best: ${best.toLocaleString()} m` : "How far can you get?";
}
$("#endlessBtn").addEventListener("click", () => {
  sfx.unlock();
  if (!requireName()) return;
  startEndless();
});
$("#packOdds").addEventListener("click", (e) => e.currentTarget.classList.toggle("open")); // the pack odds: 2 lines, tap for all
$("#soloBtn").addEventListener("click", () => {
  sfx.unlock();
  if (!requireName()) return;
  openSoloRoom();
});
$("#createBtn").addEventListener("click", () => {
  sfx.unlock();
  if (!requireName()) return;
  game.solo = false;
  game.endless = false;
  game.wantMode = null;
  connect(newCode(), true);
});
$("#joinBtn").addEventListener("click", () => {
  sfx.unlock();
  if (!requireName()) return;
  game.solo = false;
  game.endless = false;
  const code = codeInput.value.trim().toUpperCase();
  if (code.length !== 4) {
    $("#homeMsg").textContent = "Room codes have 4 characters";
    codeInput.focus();
    return;
  }
  connect(code, false);
});
codeInput.addEventListener("keydown", (e) => e.key === "Enter" && $("#joinBtn").click());

// ── home: three pages · Tournaments | Play | Shop ──
const homePages = $("#homePages");
const PAGE = { compete: 0, skins: 1, play: 2, missions: 3, shop: 4 };
const PAGE_NAMES = Object.keys(PAGE);
let homePage = PAGE.play;
// ── the home picture on phones: the runners always stand in the free space between
// the logo and the play card, whatever widgets get added above or below them ──
const ART_RUNNERS = { top: 0.25, bottom: 0.63 }; // where the runners are in home_tall.jpg, as parts of its height
const ART_RATIO = 2115 / 1440; // home_tall.jpg height / width
function fitHomeArt() {
  const img = $(".home-art img");
  const art = $(".home-art");
  if (!img || !art) return;
  if (!matchMedia("(max-aspect-ratio: 1/1)").matches) {
    img.classList.remove("fit");
    img.style.cssText = "";
    return;
  }
  if (homePage !== PAGE.play) return; // keep it where it was; only the Play page decides
  const logo = $(".hp-play .home-logo");
  const dock = $(".hp-play .home-dock");
  const top0 = art.getBoundingClientRect().top;
  // offsetTop/Height ignore the logo's pop-in animation (a transform)
  const top = logo.getBoundingClientRect().top - (logo.getBoundingClientRect().height - logo.offsetHeight) / 2 + logo.offsetHeight - top0 + 4;
  const bottom = dock.getBoundingClientRect().top - top0 - 6;
  if (!dock.offsetHeight) return;
  // always full width (a squeezed picture looks bad): centred in the gap, but the
  // runners' feet never go below the top of the play card
  const W = art.clientWidth;
  const h = W * ART_RATIO;
  const y = Math.min((top + bottom) / 2 - (h * (ART_RUNNERS.top + ART_RUNNERS.bottom)) / 2, bottom - h * ART_RUNNERS.bottom);
  img.classList.add("fit");
  img.style.cssText = `width:${W}px;height:${h.toFixed(1)}px;left:0;top:${y.toFixed(1)}px`;
}
addEventListener("resize", fitHomeArt);
if ("ResizeObserver" in window) {
  const ro = new ResizeObserver(() => fitHomeArt());
  for (const sel of [".hp-play .home-dock", ".hp-play .home-logo"]) ro.observe($(sel));
}
$(".hp-play .home-logo").addEventListener("animationend", fitHomeArt);
$(".home-art img").addEventListener("load", fitHomeArt);

function setHomePage(i, animate = true) {
  homePage = Math.max(0, Math.min(PAGE_NAMES.length - 1, i));
  screens.home.dataset.page = PAGE_NAMES[homePage];
  if (homePage === PAGE.play) {
    renderProfile(); // your runner or name may have changed
    renderEndlessBest();
    requestAnimationFrame(fitHomeArt);
  }
  homePages.classList.toggle("drag", !animate);
  homePages.style.transform = `translateX(${-homePage * 100}vw)`;
  for (const t of document.querySelectorAll(".htab")) {
    const on = Number(t.dataset.page) === homePage;
    t.classList.toggle("on", on);
    t.setAttribute("aria-selected", String(on));
  }
  if (homePage === PAGE.compete) renderCompete();
  if (homePage === PAGE.missions) {
    renderDaily();
    renderCareer();
  }
  if (homePage === PAGE.skins) renderSkins();
  if (homePage === PAGE.shop) {
    mountShop($("#shopHome"));
    renderShop();
  }
}
for (const t of document.querySelectorAll(".htab")) {
  t.addEventListener("click", () => {
    sfx.unlock();
    if (Number(t.dataset.page) !== homePage) sfx.tab();
    setHomePage(Number(t.dataset.page));
  });
}
// swipe sideways between pages; vertical drags scroll the page as usual
{
  let x0 = 0;
  let y0 = 0;
  let dx = 0;
  let axis = "";
  homePages.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1 || e.target.closest("input")) return (axis = "none");
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      dx = 0;
      axis = "";
    },
    { passive: true },
  );
  homePages.addEventListener(
    "touchmove",
    (e) => {
      if (axis === "none") return;
      const mx = e.touches[0].clientX - x0;
      const my = e.touches[0].clientY - y0;
      if (!axis && Math.hypot(mx, my) > 10) axis = Math.abs(mx) > Math.abs(my) * 1.2 ? "x" : "none";
      if (axis !== "x") return;
      // resist at the outer edges
      dx = (homePage === 0 && mx > 0) || (homePage === PAGE_NAMES.length - 1 && mx < 0) ? mx * 0.25 : mx;
      homePages.classList.add("drag");
      homePages.style.transform = `translateX(calc(${-homePage * 100}vw + ${dx}px))`;
    },
    { passive: true },
  );
  const end = () => {
    if (axis === "x") {
      const to = homePage + (dx < -60 ? 1 : dx > 60 ? -1 : 0);
      if (to !== homePage && to >= 0 && to < PAGE_NAMES.length) sfx.tab();
      setHomePage(to);
    }
    axis = "";
  };
  homePages.addEventListener("touchend", end);
  homePages.addEventListener("touchcancel", end);
}

// Tournaments page: the Weekend League and two tournaments with daily prizes
const TOURNEYS = [
  { id: "grandtour", label: "Grand Tour", img: "/assets/medal_gold.png", tag: "Tournament · 4 rounds", text: "One round of every mode.", prize: [500, 250, 120] },
];
const PLACE_SHORT = ["1st", "2nd", "3rd", "4th"];
/** Prize coins already paid today, per tournament: the best finish each day pays once (a better finish later pays the difference). */
function tourneyPaid() {
  try {
    const t = JSON.parse(local.getItem("lr:tourney") || "{}");
    return t && t.day === dayKey() ? t : { day: dayKey() };
  } catch {
    return { day: dayKey() };
  }
}
function tourneyPrize(v) {
  const t = TOURNEYS.find((x) => x.id === v.mode);
  if (!t || !v.cup || v.cup.race < v.cup.races.length) return 0;
  const place = (v.cup.table ?? []).indexOf(playerId) + 1;
  const prize = t.prize[place - 1] ?? 0;
  const paid = tourneyPaid();
  const before = paid[t.id]?.coins ?? 0;
  if (prize <= before) return 0;
  paid[t.id] = { coins: prize, place };
  local.setItem("lr:tourney", JSON.stringify(paid));
  wallet.addCoins(prize - before);
  return prize - before;
}

// Weekend League: Friday 18:00 to Sunday midnight, 10 matches, points by place
const LEAGUE_MATCHES = 10;
const LEAGUE_PTS = [10, 6, 3, 1];
const LEAGUE_TIERS = [
  { pts: 20, coins: 300 },
  { pts: 45, coins: 900 },
  { pts: 70, coins: 1500 },
  { pts: 90, coins: 2500 },
];
function leagueWindow(now = new Date()) {
  const day = now.getDay();
  const open = (day === 5 && now.getHours() >= 18) || day === 6 || day === 0;
  const start = new Date(now);
  start.setHours(18, 0, 0, 0);
  start.setDate(start.getDate() - ((day + 2) % 7)); // back to Friday
  if (!open && start <= now) start.setDate(start.getDate() + 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 3);
  end.setHours(0, 0, 0, 0); // Monday 00:00
  return { open, start, end, id: dayKey(start) };
}
function leagueState() {
  let st = null;
  try {
    st = JSON.parse(local.getItem("lr:league") || "null");
  } catch {
    st = null;
  }
  if (!st || typeof st !== "object") st = { id: "", matches: 0, pts: 0, claimed: [] };
  const w = leagueWindow();
  if (w.open && st.id !== w.id) {
    // a new weekend: rewards left unclaimed last time are paid out first
    if (st.id) payLeague(st, true);
    st = { id: w.id, matches: 0, pts: 0, claimed: [] };
    local.setItem("lr:league", JSON.stringify(st));
  }
  return st;
}
function leagueReady(st) {
  return LEAGUE_TIERS.map((tier, i) => i).filter((i) => st.pts >= LEAGUE_TIERS[i].pts && !st.claimed.includes(i));
}
function payLeague(st, quiet = false) {
  const ready = leagueReady(st);
  let coins = 0;
  for (const i of ready) {
    coins += LEAGUE_TIERS[i].coins;
    if (LEAGUE_TIERS[i].medal) wallet.claim(`wl:${st.id}:${i}`, LEAGUE_TIERS[i].medal);
    st.claimed.push(i);
  }
  if (coins) wallet.addCoins(coins);
  local.setItem("lr:league", JSON.stringify(st));
  if (coins && quiet) toast(`Weekend League rewards: +${coins} coins`);
  return coins;
}
/** A race finished: count it as a league match while the weekend is live. */
function leagueMatch(n, place) {
  if (n < 2 || !leagueWindow().open) return null;
  const st = leagueState();
  if (st.matches >= LEAGUE_MATCHES) return null;
  const pts = LEAGUE_PTS[place - 1] ?? 0;
  st.matches += 1;
  st.pts += pts;
  local.setItem("lr:league", JSON.stringify(st));
  return { pts, matches: st.matches };
}
function untilText(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m}m`;
}

// ── Trophy Road (top of the Missions page): one road for everything you win in races.
// Every medal adds league points (gold 10, silver 5, bronze 3, off the podium 1), the
// leagues are stages along it, and coins, packs and exclusive characters wait on it ──

/** Characters only found on the Trophy Road (the others on it are in COLLECTION, via "road"). */
const ROAD_CHARS = [
  { id: "ace", name: "Ace", rarity: "epic" },
  { id: "titan", name: "Titan", rarity: "legendary" },
  { id: "aurum", name: "Aurum", rarity: "legendary" },
];
/** Each step: the league points it needs and what it gives. Every league starts with a character. */
const ROAD = [
  { pts: 10, coins: 200 },
  { pts: 20, pack: "mega" },
  { pts: 30, coins: 300 },
  { pts: 40, char: "leo" },
  { pts: 60, coins: 400 },
  { pts: 80, pack: "mega" },
  { pts: 110, char: "kai" },
  { pts: 140, coins: 600 },
  { pts: 170, pack: "mega" },
  { pts: 220, char: "unitx" },
  { pts: 260, coins: 1000 },
  { pts: 300, pack: "mega" },
  { pts: 360, char: "zed" },
  { pts: 420, coins: 1500 },
  { pts: 480, pack: "mega" },
  { pts: 560, char: "aria" },
  { pts: 700, coins: 2500 },
  { pts: 850, char: "ace" },
  { pts: 1000, pack: "mega" },
  { pts: 1300, char: "hoops" },
  { pts: 1600, coins: 4000 },
  { pts: 2000, char: "striker" },
  { pts: 2500, char: "titan" },
  { pts: 3500, coins: 6000 },
  { pts: 5000, pack: "mega" },
  { pts: 7500, coins: 10000 },
  { pts: 10000, char: "aurum" },
];
/** Coins instead, for a road character you already own (from the old medal shop). */
const ROAD_DUPE = { epic: 800, legendary: 1500 };
const roadChar = (id) => ROAD_CHARS.find((c) => c.id === id) ?? COLLECTION.find((c) => c.id === id);
function roadInfo(step) {
  if (step.coins) return { label: `${step.coins.toLocaleString()} coins`, img: step.coins >= 2500 ? "/assets/ui_c3.webp" : step.coins >= 1000 ? "/assets/ui_c2.webp" : "/assets/ui_c1.webp" };
  if (step.pack) return { label: "Mega Pack", img: `/assets/pack_${step.pack}.webp` };
  const c = roadChar(step.char);
  return { label: c.name, img: ROAD_CHARS.includes(c) ? `/assets/rd_${c.id}.webp` : `/assets/sc_${c.id}.webp`, rarity: c.rarity };
}
/** Gold medals won, ever (a stat: spending them never counted back). */
function goldEver() {
  const n = Number(local.getItem("lr:goldEver"));
  if (local.getItem("lr:goldEver") !== null && Number.isFinite(n)) return n;
  let start = wallet.medals().gold;
  for (const c of COLLECTION) if (c.legacy?.medal === "gold" && wallet.has(c.id)) start += c.legacy.count;
  local.setItem("lr:goldEver", String(start));
  return start;
}
const road = {
  claimed() {
    try {
      const a = JSON.parse(local.getItem("lr:troad") || "[]");
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  },
  ready() {
    const p = rank.points();
    const done = this.claimed();
    return ROAD.filter((r) => r.pts <= p && !done.includes(r.pts));
  },
};
function claimRoad(step, node) {
  if (rank.points() < step.pts || road.claimed().includes(step.pts)) return;
  local.setItem("lr:troad", JSON.stringify([...road.claimed(), step.pts]));
  const info = roadInfo(step);
  sfx.finish();
  if (step.coins) {
    wallet.addCoins(step.coins);
    coinRain(node, 14);
    toast(`Trophy Road: +${info.label}!`);
  } else if (step.pack) {
    const pk = PACKS.find((x) => x.id === step.pack);
    openPackAnim(pk, grantPack(pk));
  } else if (wallet.has(step.char)) {
    const n = ROAD_DUPE[info.rarity] ?? 800;
    wallet.addCoins(n);
    coinRain(node, 14);
    toast(`You already have ${info.label}: +${n.toLocaleString()} coins`);
  } else {
    giveItem(step.char);
    renderCollPill();
    showUnlock({ kind: "char", char: { name: info.label, rarity: info.rarity, img: info.img } });
  }
  renderTrophyRoad();
}
function renderTrophyRoad() {
  const box = $("#trophyRoad");
  if (!box) return;
  const p = rank.points();
  const r = rankOf(p);
  const done = road.claimed();
  const next = ROAD.find((x) => x.pts > p);
  // one long bar under the rewards: each node owns the stretch from halfway back to halfway on
  const fillOf = (lo, mid, hi) => (p <= lo ? 0 : p >= hi ? 1 : p <= mid ? (0.5 * (p - lo)) / (mid - lo) : 0.5 + (0.5 * (p - mid)) / (hi - mid));
  const bar = (f) => el("span", { class: "rbar" }, el("i", { style: `width:${Math.round(f * 100)}%` }), f > 0 && f < 1 ? el("b", { class: "rknob", style: `left:${Math.round(f * 100)}%` }) : null);
  const first = ROAD[0].pts;
  const start = el(
    "div",
    { class: "rnode rstart" },
    el("span", { class: "rleague" }),
    el("span", { class: "rbubble you" }, el("img", { src: myAvatar(), alt: "" })),
    bar(Math.min(1, p / (first / 2))),
    el("span", { class: "rpts" }),
  );
  const nodes = ROAD.map((step, i) => {
    const info = roadInfo(step);
    const got = done.includes(step.pts);
    const ready = step.pts <= p && !got;
    const league = LEAGUES.find((l) => l.min === step.pts); // a new league starts here
    const prev = i ? ROAD[i - 1].pts : 0;
    const nextPts = ROAD[i + 1]?.pts ?? step.pts * 2 - prev;
    const b = el(
      "button",
      { class: `rnode${got ? " got" : ""}${ready ? " ready" : ""}${step.pts > p ? " future" : ""}${step.char ? ` star ${info.rarity}` : ""}`, type: "button", "aria-label": info.label },
      el("span", { class: "rleague" }, league ? el("small", { text: league.name }) : null),
      el("span", { class: "rbubble" }, el("img", { src: info.img, alt: "" }), got ? el("i", { class: "tick", text: "✓" }) : null, ready ? el("em", { class: "rclaim", text: "Claim!" }) : null),
      bar(fillOf((prev + step.pts) / 2, step.pts, (step.pts + nextPts) / 2)),
      el("span", { class: "rpts", text: step.pts.toLocaleString() }),
    );
    b.addEventListener("click", (e) => {
      if (!ready) return; // anything but a reward to claim opens the whole road
      e.stopPropagation();
      claimRoad(step, b);
    });
    return b;
  });
  const track = el("div", { class: "road-track" }, start, ...nodes);
  box.replaceChildren(
    el(
      "div",
      { class: "road-head" },
      el("img", { src: r.img, alt: "" }),
      el("div", {}, el("b", { text: "Trophy Road" }), el("span", { text: next ? `${r.name} · ${next.pts - p} pts to ${roadInfo(next).label}` : `${r.name} · road complete. Legend!` })),
      el("em", { text: `${p.toLocaleString()} 🏆` }),
    ),
    track,
    el("span", { class: "road-all", text: "See the whole road ›" }),
  );
  // keep the next reward in view
  requestAnimationFrame(() => {
    const cur = track.querySelector(".rnode.ready") || track.querySelector(".rnode.future");
    if (cur) track.scrollLeft = cur.offsetLeft - track.clientWidth / 2 + cur.clientWidth / 2;
  });
  renderMissionDots(); // a reward waiting on the road lights the Missions tab
  if (!roadModal.hidden) renderRoadFull();
}
/** The whole Trophy Road, top to bottom: every reward, where each league starts, and where you are. */
const roadModal = $("#roadModal");
function renderRoadFull() {
  const p = rank.points();
  const done = road.claimed();
  const rows = [];
  let youShown = false;
  for (const step of ROAD) {
    const league = LEAGUES.find((l) => l.min === step.pts);
    if (!youShown && step.pts > p) {
      youShown = true;
      rows.push(el("div", { class: "rf-you" }, el("img", { src: myAvatar(), alt: "" }), el("b", { text: `You · ${p.toLocaleString()} 🏆` })));
    }
    if (league) rows.push(el("div", { class: `rf-league lg-${league.id}` }, el("img", { src: `/assets/lg_${league.id}.webp`, alt: "" }), el("b", { text: league.name })));
    const info = roadInfo(step);
    const got = done.includes(step.pts);
    const ready = step.pts <= p && !got;
    const btn = el("button", { class: `rf-btn${ready ? " ready" : ""}`, type: "button", text: got ? "✓" : ready ? "Claim!" : "🔒" });
    btn.disabled = !ready;
    btn.addEventListener("click", () => claimRoad(step, btn));
    rows.push(
      el(
        "div",
        { class: `rf-row${got ? " got" : ""}${ready ? " ready" : ""}${step.char ? ` star ${info.rarity}` : ""}` },
        el("span", { class: "rf-pts", text: `${step.pts.toLocaleString()} 🏆` }),
        el("span", { class: "rf-pic" }, el("img", { src: info.img, alt: "" })),
        el("b", { class: "rf-label", text: info.label }),
        btn,
      ),
    );
  }
  if (!youShown) rows.push(el("div", { class: "rf-you" }, el("img", { src: myAvatar(), alt: "" }), el("b", { text: `You · ${p.toLocaleString()} 🏆` })));
  const list = $("#roadFull");
  list.replaceChildren(...rows);
  requestAnimationFrame(() => {
    const you = list.querySelector(".rf-you");
    if (you) list.scrollTop = you.offsetTop - list.clientHeight / 2;
  });
}
function openRoad() {
  sfx.tap();
  renderRoadFull();
  roadModal.hidden = false;
}
$("#trophyRoad").addEventListener("click", openRoad);
$("#roadClose").addEventListener("click", () => (roadModal.hidden = true));
roadModal.addEventListener("click", (e) => e.target === roadModal && (roadModal.hidden = true));

/** Full Weekend League card (shown in the detail sheet). */
function weekendCard() {
  const w = leagueWindow();
  const st = leagueState();
  const mine = st.id === w.id;
  const ready = leagueReady(st);
  const full = mine && st.matches >= LEAGUE_MATCHES;
  const pct = (x) => Math.min(100, Math.round((x / 100) * 100));
  const weekend = el(
    "div",
    { class: `tcard t-weekend${w.open ? " live" : ""}` },
    el(
      "div",
      { class: "tc-head" },
      el("img", { src: "/assets/lg_master.webp", alt: "" }),
      el(
        "div",
        {},
        el("em", { class: "tc-status" }, w.open ? el("i", { class: "live-dot" }) : "", w.open ? `Live · ends in ${untilText(w.end - Date.now())}` : `Opens Friday 18:00 · in ${untilText(w.start - Date.now())}`),
        el("b", { text: "Weekend League" }),
        el("span", { class: "tc-prize" }, el("i", { class: "coin" }), `Up to ${LEAGUE_TIERS.reduce((a, t) => a + t.coins, 0).toLocaleString()}`),
      ),
    ),
    el("p", { class: "tc-desc", text: `${LEAGUE_MATCHES} matches, Friday to Sunday. Score points, unlock coins.` }),
    el(
      "div",
      { class: "wl-row" },
      el("span", { class: "wl-pips" }, ...Array.from({ length: LEAGUE_MATCHES }, (_, i) => el("i", { class: mine && i < st.matches ? "on" : "" }))),
      el("b", { text: `${mine ? st.pts : 0} pts` }),
    ),
    el(
      "div",
      { class: "wl-track" },
      el("span", { class: "wl-fill", style: `width:${pct(mine ? st.pts : 0)}%` }),
      ...LEAGUE_TIERS.map((tier, i) =>
        el(
          "span",
          { class: `wl-tier${mine && st.pts >= tier.pts ? " got" : ""}${st.claimed.includes(i) && mine ? " claimed" : ""}`, style: `left:${pct(tier.pts)}%` },
          el("img", { src: tier.medal ? MEDAL_IMG[tier.medal] : "/assets/ui_c1.webp", alt: "" }),
          el("small", { text: `${tier.pts}` }),
          el("em", { text: `${tier.coins}` }),
        ),
      ),
    ),
    el(
      "div",
      { class: "tc-btns" },
      ...(ready.length
        ? [el("button", { class: "btn big gold-btn", type: "button", "data-league": "claim", text: `🎁 Claim ${ready.reduce((a, i) => a + LEAGUE_TIERS[i].coins, 0)} coins` })]
        : !w.open
          ? [el("button", { class: "btn big ghost", type: "button", disabled: "", text: "🔒 Opens on Friday" })]
          : full
            ? [el("button", { class: "btn big ghost", type: "button", disabled: "", text: "✓ All matches played" })]
            : [
                el("button", { class: "btn big go", type: "button", "data-league": "bots", text: "▶ Play match" }),
                el("button", { class: "btn big blue", type: "button", "data-league": "host", text: "👥 Host" }),
              ]),
    ),
  );
  return weekend;
}
/** Full card for a tournament (shown in the detail sheet). */
function tourneyCard(t) {
  const paid = tourneyPaid();
  return el(
    "div",
    { class: `tcard t-${t.id}` },
    el(
      "div",
      { class: "tc-head" },
      el("img", { src: t.img, alt: "" }),
      el("div", {}, el("em", { text: t.tag }), el("b", { text: t.label }), el("span", { class: "tc-prize" }, el("i", { class: "coin" }), `Up to ${t.prize[0].toLocaleString()}`)),
    ),
    el("p", { class: "tc-desc", text: t.text }),
    el(
      "div",
      { class: "tc-prizes" },
      el("small", { text: "Daily prize" }),
      ...t.prize.map((c, i) => el("span", { class: `prz${paid[t.id]?.place === i + 1 ? " won" : ""}` }, el("b", { text: PLACE_SHORT[i] }), el("i", { class: "coin" }), String(c))),
    ),
    paid[t.id] ? el("p", { class: "tc-note", text: `Today: ${PLACE_SHORT[paid[t.id].place - 1]} ✓ · place higher for more` }) : "",
    el(
      "div",
      { class: "tc-btns" },
      el("button", { class: "btn big go", type: "button", "data-mode": t.id, "data-with": "bots", text: "🤖 Vs bots" }),
      el("button", { class: "btn big blue", type: "button", "data-mode": t.id, "data-with": "friends", text: "👥 Host" }),
    ),
  );
}
/** The Tournaments page: one simple row each; tap one for the rules, prizes and Play buttons. */
function renderCompete() {
  const w = leagueWindow();
  const st = leagueState();
  const ready = leagueReady(st).length > 0;
  const row = (id, img, name, status, prize, opts = {}) =>
    el(
      "button",
      { class: `trow${opts.live ? " live" : ""}${opts.ready ? " ready" : ""}`, type: "button", "data-open": id },
      el("img", { src: img, alt: "" }),
      el("span", { class: "tr-txt" }, el("b", { text: name }), el("small", {}, opts.live ? el("i", { class: "live-dot" }) : "", status)),
      opts.ready ? el("em", { class: "tr-claim", text: "🎁 Claim" }) : el("span", { class: "tr-prize" }, el("i", { class: "coin" }), prize),
      el("i", { class: "tr-go", text: "›" }),
    );
  $("#tourneyList").replaceChildren(
    row("weekend", "/assets/lg_master.webp", "Weekend League", w.open ? `Live · ends in ${untilText(w.end - Date.now())}` : `Opens Friday · in ${untilText(w.start - Date.now())}`, LEAGUE_TIERS.reduce((a, t) => a + t.coins, 0).toLocaleString(), { live: w.open, ready }),
    ...TOURNEYS.map((t) => row(t.id, t.img, t.label, t.tag, t.prize[0].toLocaleString())),
  );
  if (!tourneyModal.hidden) renderTourneySheet();
}
const tourneyModal = $("#tourneyModal");
let tourneyOpen = null;
function renderTourneySheet() {
  const t = TOURNEYS.find((x) => x.id === tourneyOpen);
  const card = tourneyOpen === "weekend" ? weekendCard() : t ? tourneyCard(t) : null;
  if (!card) return;
  card.classList.add("open"); // all the details show in the sheet
  $("#tourneyTitle").textContent = tourneyOpen === "weekend" ? "Weekend League" : t.label;
  $("#tourneyBody").replaceChildren(card);
}
function openTourney(id) {
  sfx.tap();
  tourneyOpen = id;
  renderTourneySheet();
  tourneyModal.hidden = false;
}
$("#tourneyClose").addEventListener("click", () => (tourneyModal.hidden = true));
tourneyModal.addEventListener("click", (e) => e.target === tourneyModal && (tourneyModal.hidden = true));
function playMode(mode, withWho) {
  sfx.unlock();
  if (soloBtn.disabled) return toast("Still loading the runners…");
  if (!requireName()) return;
  if (withWho === "bots") return openSoloRoom(mode);
  game.solo = false;
  game.endless = false;
  game.wantMode = mode;
  connect(newCode(), true);
}
$("#hpCompete").addEventListener("click", (e) => {
  const open = e.target.closest("[data-open]");
  if (open) openTourney(open.dataset.open);
});
$("#tourneyBody").addEventListener("click", (e) => {
  const b = e.target.closest("[data-mode]");
  if (b) {
    tourneyModal.hidden = true;
    return playMode(b.dataset.mode, b.dataset.with);
  }
  const lg = e.target.closest("[data-league]");
  if (!lg) return;
  if (lg.dataset.league === "claim") {
    const coins = payLeague(leagueState());
    if (coins) {
      coinRain(lg, 18);
      sfx.finish();
      toast(`Weekend League: +${coins} coins!`);
    }
    renderWallet();
    renderCompete();
    return;
  }
  // a league match is a random mode each time
  tourneyModal.hidden = true;
  playMode(ROUND_KINDS[Math.floor(Math.random() * ROUND_KINDS.length)], lg.dataset.league === "host" ? "friends" : "bots");
});
// keep the countdowns fresh while the page is open
setInterval(() => game.mode === "home" && homePage === PAGE.compete && renderCompete(), 30000);
/** Red dot on the Shop tab: a pass reward or a mission waiting to be claimed. */
function renderStoreDot() {
  const dot = document.querySelector(`.htab[data-page="${PAGE.shop}"] .dot`);
  if (!dot) return;
  let pass = false;
  try {
    pass = passClaimable() > 0;
  } catch {
    // still starting up
  }
  dot.hidden = !pass;
}
renderCompete();

function leaveToHome(message = "") {
  game.mode = "home";
  game.locked = false;
  renderDaily();
  game.solo = false;
  game.endless = false;
  renderEndlessBest();
  world.clearRace();
  showScreen("home");
  $("#homeMsg").textContent = message;
  if (location.search) history.replaceState(null, "", location.pathname);
}

// leaving mid-race: always possible, from the ✕ in the race HUD
const quitModal = $("#quitModal");
$("#quitBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  sfx.tap();
  $("#quitText").textContent = game.solo
    ? "Your run ends here and you won't get rewards for it."
    : "The race keeps going without you, and you won't get rewards for it.";
  quitModal.hidden = false;
});
$("#quitStay").addEventListener("click", () => (quitModal.hidden = true));
quitModal.addEventListener("click", (e) => e.target === quitModal && (quitModal.hidden = true));
$("#quitGo").addEventListener("click", () => {
  quitModal.hidden = true;
  leaveLobby();
});

function leaveLobby() {
  act({ type: "leave" });
  game.quit = true;
  // let the leave reach the server before closing
  setTimeout(disconnect, 150);
  leaveToHome("");
}

// ── lobby ───────────────────────────────────────────────────────────────────

function enterLobby() {
  game.mode = "lobby";
  world.clearRace();
  world.showcase();
  showScreen("lobby");
  $("#lobbyMsg").textContent = "";
  history.replaceState(null, "", `?join=${net.code}`);
}

function renderLobby(v) {
  rememberFriends(v);
  $("#lobby").classList.toggle("solo-room", Boolean(game.solo));
  $("#lobbyCode").textContent = net.code;
  $("#lobbyCodeStrip").textContent = net.code;
  const slots = $("#slots");
  slots.replaceChildren();
  for (let i = 0; i < 4; i++) {
    const p = v.players[i];
    if (!p) {
      slots.append(el("div", { class: "rcard empty" }, el("span", { class: "num", text: String(i + 1) }), el("span", { class: "nm", text: "Waiting for player…" })));
      continue;
    }
    const cty = p.country ? `${flagOf(p.country)} ${countryName(p.country)}` : "🌍 No country";
    const card = el(
      "div",
      { class: `rcard${p.gone ? " gone" : ""}`, style: `--team:${RUNNERS[p.char]?.color ?? "#666"}` },
      el("span", { class: "num", text: String(i + 1) }),
      el("img", { class: "pic", src: portrait(p.char), alt: "" }),
      el(
        "div",
        { class: "info" },
        el("span", { class: "nm", text: p.name }),
        el("span", { class: "cty", text: p.gone ? "Away…" : cty }),
      ),
    );
    card.dataset.id = p.id;
    if (p.id === v.host) card.append(el("span", { class: "crown", text: "👑" }));
    card.append(el("img", { class: "lg", src: rankOf(p.rp ?? 0).img, alt: rankOf(p.rp ?? 0).name, title: rankOf(p.rp ?? 0).name }));
    if (p.id === playerId) card.append(el("span", { class: "you", text: "YOU" }));
    slots.append(card);
  }
  paintEmotes();

  const me = v.players.find((p) => p.id === playerId);
  const picker = $("#picker");
  picker.replaceChildren();
  RUNNERS.forEach((r, i) => {
    const owner = v.players.find((p) => p.char === i);
    const mine = owner?.id === playerId;
    const locked = !wallet.owns(i);
    const sub = locked ? el("small", { class: "lock", text: `🔒 ${lockLabel(i)}` }) : el("small", { text: mine ? "You" : owner ? owner.name : "" });
    const card = el(
      "button",
      { class: `card${mine ? " mine" : ""}${owner && !mine ? " taken" : ""}${locked ? " locked" : ""}`, type: "button", style: `--team:${r.color}` },
      el("img", { src: portrait(i), alt: "" }),
      el("b", { text: r.name, style: `color:${r.color}` }),
      sub,
    );
    card.addEventListener("click", () => {
      if (locked) return inspectChar(allChars().find((c) => c.idx === i));
      if (owner && !mine) return toast(`${r.name} is taken by ${owner.name}`);
      if (!mine) {
        local.setItem("lr:char", String(i));
        act({ type: "pick", char: i });
      }
    });
    picker.append(card);
  });
  // 🎲 a random runner you own that nobody else has
  const dice = el("button", { class: "card random-card", type: "button" }, el("i", { class: "dice", text: "🎲" }), el("b", { text: "Random" }), el("small", { text: "Surprise me" }));
  dice.addEventListener("click", () => {
    const pool = RUNNERS.map((_, i) => i).filter((i) => wallet.owns(i) && i !== me?.char && !v.players.some((p) => p.char === i));
    if (!pool.length) return toast("No other free runner right now");
    const i = pool[Math.floor(Math.random() * pool.length)];
    local.setItem("lr:char", String(i));
    act({ type: "pick", char: i });
    toast(`🎲 ${RUNNERS[i].name}!`);
  });
  picker.append(dice);
  if (me) {
    renderSpotlight($("#lobbySpot"), me.char, {
      takenBy: (i) => v.players.find((p) => p.char === i && p.id !== playerId)?.name ?? null,
      onPick: (i) => {
        if (i === me.char) return;
        local.setItem("lr:char", String(i));
        act({ type: "pick", char: i });
      },
    });
    local.setItem("lr:char", String(me.char));
    // a runner you don't own (e.g. assigned when yours was taken) is swapped for a free starter
    if (!wallet.owns(me.char)) {
      const free = [0, 1, 2, 3].find((c) => !v.players.some((p) => p.char === c));
      if (free !== undefined) act({ type: "pick", char: free });
    }
    if ((me.country || "") !== myCountry()) act({ type: "country", country: myCountry() });
    renderCountryChips();
  }

  const isHost = v.host === playerId;
  const n = v.players.filter((p) => !p.gone).length;
  const mode = MODES[Math.max(0, Math.min(n, 4) - 1)];
  const gm = v.mode || "survival";
  // only the host chooses mode and map; invited friends just pick a runner
  $("#hostPicks").hidden = !isHost;
  const modePick = $("#modePick");
  modePick.replaceChildren(
    ...Object.entries(GAME_MODE_INFO).map(([key, info]) => {
      const b = el(
        "button",
        { class: `mode-card${gm === key ? " on" : ""}`, type: "button" },
        el("img", { class: "mode-ico", src: `/assets/mode_${key}.webp`, alt: "" }),
        el("em", { text: info.tag }),
        el("b", { text: key === "survival" && n < 2 && !botsOn() ? "Endless run" : info.label }),
        el("span", { text: key === "survival" && n < 2 && !botsOn() ? "Alone: how far can you get?" : info.text }),
      );
      b.disabled = !isHost;
      b.addEventListener("click", () => gm !== key && act({ type: "mode", mode: key }));
      return b;
    }),
  );
  const mp = v.map || "meadow";
  $("#mapPick").replaceChildren(
    ...["random", ...MAPS].map((key) => {
      const info = MAP_INFO[key];
      const style = key === "random" ? "" : `--pic:url(/assets/map_${key}.webp)`;
      const b = el(
        "button",
        { class: `map-card${mp === key ? " on" : ""}${key === "random" ? " random" : ""}`, type: "button", style },
        el("b", { text: info.label }),
        el("span", { text: info.text }),
      );
      b.disabled = !isHost;
      b.addEventListener("click", () => mp !== key && act({ type: "map", map: key }));
      return b;
    }),
  );
  // start fetching the map's 3D props while everyone is still in the lobby
  for (const key of mp === "random" ? MAPS : [mp]) {
    world.ensureMap(key).catch(() => {});
    world.preloadMovers(key).catch(() => {});
  }
  for (const p of v.players) world.ensureChar(p.char).catch(() => {});
  // rounds (the Grand Tour is always one of each mode) and the prize for the top 3
  const rounds = roundsOf(v);
  $("#roundPick").replaceChildren(
    ...ROUND_OPTIONS.map((r) => {
      const b = el("button", { class: `chip${rounds === r ? " on" : ""}`, type: "button", text: r === 1 ? "1 round" : `${r} rounds` });
      b.disabled = !isHost || gm === "grandtour";
      b.addEventListener("click", () => act({ type: "rounds", rounds: r }));
      return b;
    }),
    ...(gm === "grandtour" ? [el("span", { class: "chip on fixed", text: `${rounds} rounds · fixed` })] : []),
  );
  // how good the bots are: only when bots fill the empty spots
  const withBots = botsOn() && v.players.length < 4;
  $("#botLevelTitle").hidden = $("#botLevelPick").hidden = !withBots;
  if (withBots) {
    const lv = v.botLevel ?? "normal";
    $("#botLevelPick").replaceChildren(
      ...[["easy", "😊 Easy"], ["normal", "🙂 Normal"], ["hard", "😈 Hard"]].map(([key, label]) => {
        const b = el("button", { class: `chip${lv === key ? " on" : ""}`, type: "button", text: label });
        b.disabled = !isHost;
        b.addEventListener("click", () => lv !== key && act({ type: "botlevel", level: key }));
        return b;
      }),
    );
  }
  const prize = v.prize ?? "none";
  $("#prizePick").replaceChildren(
    ...Object.entries(PRIZE_INFO).map(([key, info]) => {
      const b = el("button", { class: `chip prize${prize === key ? " on" : ""}`, type: "button" }, el("b", { text: `${info.icon} ${info.label}` }), info.pays.length ? el("small", { text: info.pays.map((x, i) => `${["1st", "2nd", "3rd"][i]} ${x}`).join(" · ") }) : el("small", { text: "No prize" }));
      // the host pays the pot, so they can only pick one they can afford
      b.disabled = !isHost || (prize !== key && potOf(key) > wallet.coins());
      b.addEventListener("click", () => prize !== key && act({ type: "prize", prize: key }));
      return b;
    }),
  );
  $("#prizeNote").textContent =
    prize === "none" ? "" : isHost ? `You pay ${potOf(prize).toLocaleString()} coins. Bot places come back to you.` : `The host pays ${potOf(prize).toLocaleString()} coins for the top 3`;
  $("#lockBtn").replaceChildren(el("span", { class: "flagico", text: "✓" }), el("span", { text: `Lock in ${RUNNERS[me?.char ?? 0].name}` }), el("span", { class: "arrow", text: "→" }));
  renderLineup(v, { isHost, gm, mp });
  // once you've locked in your runner, the lobby is the line-up
  if (game.mode === "lobby" && !screens.shop.classList.contains("show")) showScreen(game.locked ? "lineup" : "lobby");
  $("#lobbyCount").textContent = `${mode} · ${GAME_MODE_INFO[gm].label} · ${n}/4 players`;
  $("#readyCount").textContent = `👥 ${n}/4 players ready`;
  $("#lobbyMsg").textContent =
    isHost && n < 2 ? "Share the code. Bots fill empty spots." : "";
  world.setShowcase(me?.char ?? 0);
  if (world.ready) for (const p of v.players) world.ensureChar(p.char).catch(() => {});
  renderWallet();
}

$("#lockBtn").addEventListener("click", () => {
  sfx.unlock();
  game.locked = true;
  // locking in your runner means you're ready; tap again on the line-up to cancel
  const me = net.view?.players.find((p) => p.id === playerId);
  if (me && net.view.host !== playerId && !me.ready) act({ type: "ready", ready: true });
  if (net.view) renderLobby(net.view);
});
$("#changeRunner").addEventListener("click", () => {
  game.locked = false;
  act({ type: "ready", ready: false });
  if (net.view) renderLobby(net.view);
});
$("#luLeave").addEventListener("click", leaveLobby);
$("#luCopy").addEventListener("click", () => $("#copyBtn").click());
$("#luGo").addEventListener("click", () => {
  sfx.unlock();
  const v = net.view;
  if (!v) return;
  const me = v.players.find((p) => p.id === playerId);
  if (v.host === playerId) {
    const pot = potOf(v.prize);
    if (pot > wallet.coins()) return toast(`You need ${pot.toLocaleString()} coins for this prize pot`);
    act({ type: "start", bots: botsOn() });
  } else act({ type: "ready", ready: !me?.ready });
});

/**
 * The line-up: every runner on a pedestal (yours in the middle, lit blue)
 * with READY / NOT READY. Guests toggle Ready; the host's button becomes
 * Start once everybody else is ready.
 */
/** What each runner shouts from the start blocks (picked per player, so it doesn't flicker). */
const TAUNTS = ["Too slow!", "You're toast!", "My win!", "Catch me!", "Eat my dust!", "Bring it!", "Let's go!", "Easy win!"];
const LU_KICKER = { survival: "Every runner for themself", chase: "Outrun the brain!", coinrush: "Grab the most coins", potato: "Don't be last!", grandtour: "One of every mode", random: "Surprise mode!" };
function renderLineup(v, { isHost, gm, mp }) {
  $("#lineup").classList.toggle("solo-room", Boolean(game.solo));
  $("#luCode").textContent = net.code;
  $("#luKicker").textContent = LU_KICKER[gm] ?? "";
  $("#luMode").textContent = matchLabel(v, gm, gm === "survival" && v.players.length < 2 && !botsOn());
  const pz = PRIZE_INFO[v.prize ?? "none"];
  $("#luMap").textContent = `${MAP_INFO[mp].label} map${pz.pays.length ? ` · ${pz.icon}` : ""}`;
  const present = v.players.filter((p) => !p.gone);
  // you always stand on block 1
  const order = [...v.players].sort((a, b) => Number(b.id === playerId) - Number(a.id === playerId));
  const hash = (id) => [...String(id)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const peds = order.map((p, i) => {
    const isMe = p.id === playerId;
    const ok = p.ready || p.id === v.host;
    const ped = el(
      "div",
      { class: `lx-ped p${i + 1}${isMe ? " me" : ""}${ok ? " ok" : ""}${p.gone ? " gone" : ""}` },
      isMe ? el("span", { class: "lx-you", text: "YOU" }) : el("span", { class: "lx-say", text: p.gone ? "Away…" : TAUNTS[hash(p.id) % TAUNTS.length] }),
      el("img", { class: "lx-char", src: `/assets/lu_${RUNNERS[p.char]?.file ?? "c0"}.webp`, alt: RUNNERS[p.char]?.name ?? "" }),
      el(
        "div",
        { class: "lx-block" },
        el("b", { text: String(i + 1) }),
        el("small", { text: `${p.id === v.host ? "👑 " : ""}${withFlag(p.name, p.country)}` }),
        ok ? el("i", { class: "lx-ok", text: "✓" }) : null,
      ),
    );
    ped.dataset.id = p.id;
    return ped;
  });
  for (let i = order.length; i < 4; i++) {
    peds.push(el("div", { class: `lx-ped p${i + 1} empty` }, el("span", { class: "lx-ghost", text: botsOn() ? "🤖" : "?" }), el("div", { class: "lx-block" }, el("b", { text: String(i + 1) }), el("small", { text: botsOn() ? "Bot" : "Waiting…" }))));
  }
  $("#luStage").replaceChildren(...peds);
  paintEmotes();

  const waiting = present.filter((p) => p.id !== v.host && !p.ready);
  const go = $("#luGo");
  const status = $("#luStatus");
  const meP = v.players.find((p) => p.id === playerId);
  go.classList.remove("waiting");
  if (isHost) {
    go.textContent = waiting.length ? "Waiting…" : "Start ▶";
    go.classList.toggle("waiting", waiting.length > 0);
    status.textContent = waiting.length ? `Waiting for ${waiting.map((p) => p.name).join(", ")}` : present.length > 1 ? "Everyone's ready!" : "";
  } else {
    go.textContent = meP?.ready ? "Cancel ready" : "Ready ✓";
    go.classList.toggle("waiting", Boolean(meP?.ready));
    status.textContent = meP?.ready ? (waiting.length ? `Waiting for ${waiting.map((p) => p.name).join(", ")}` : "Waiting for the host…") : "";
  }
}
$("#leaveBtn").addEventListener("click", leaveLobby);
$("#leave2Btn").addEventListener("click", leaveLobby);
$("#againBtn").addEventListener("click", () => act({ type: "again" }));
$("#rematchBtn").addEventListener("click", () => {
  sfx.unlock();
  act({ type: "rematch" });
});
function botsOn() {
  return local.getItem("lr:bots") !== "0";
}
$("#botToggle").checked = botsOn();
$("#botToggle").addEventListener("change", (e) => {
  local.setItem("lr:bots", e.target.checked ? "1" : "0");
  if (net.view) renderLobby(net.view);
});
$("#nextBtn").addEventListener("click", () => act({ type: "next" }));
$("#copyBtn").addEventListener("click", async () => {
  const url = `${location.origin}/?join=${net.code}`;
  const text = `Race me in 4 Friends! Code ${net.code} → ${url}`;
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title: "4 Friends", text, url });
    } else {
      await navigator.clipboard.writeText(url);
      $("#copyMsg").textContent = "Link copied!";
      setTimeout(() => ($("#copyMsg").textContent = ""), 2000);
    }
  } catch {
    $("#copyMsg").textContent = url;
  }
});

// ── results ─────────────────────────────────────────────────────────────────

function fmtTime(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

function showResults(v) {
  game.mode = "results";
  showScreen("results");
  renderResults(v);
}

const PLACE = ["1st", "2nd", "3rd", "4th"];

function renderResults(v) {
  const list = $("#podium");
  list.replaceChildren();
  const byId = new Map(v.players.map((p) => [p.id, p]));
  const rewards = v.rewards || {};
  v.standings.forEach((id, i) => {
    const p = byId.get(id);
    if (!p) return;
    const rw = rewards[id];
    const survival = v.kind === "survival";
    const detail = p.left
      ? "left the race"
      : v.kind === "coinrush"
        ? `🪙 ${p.coins ?? 0} coins · ${Math.round(p.d)} m`
        : v.kind === "chase"
          ? `${Math.round(p.d)} m · ${p.outAt != null ? "caught by the brain" : "escaped!"}`
          : v.kind === "potato"
            ? `${Math.round(p.d)} m · ${Math.max(0, livesNow() - (p.booms ?? 0))} ❤️ left`
            : survival
        ? `${Math.round(p.d)} m · ${Math.max(0, livesNow() - p.hits)} ❤️ left`
        : p.finish !== null
          ? `${p.hits} bump${p.hits === 1 ? "" : "s"}`
          : `${Math.round(p.d)} m of ${TRACK_LEN} m`;
    // the number that decides this mode (no more "DNF" for modes without a finish line)
    const outTime = p.outAt !== null ? fmtTime(p.outAt - v.startAt) : "";
    const time = p.left
      ? "Left"
      : v.kind === "coinrush"
        ? `🪙 ${p.coins ?? 0}`
        : v.kind === "chase"
          ? outTime ? `🧠 ${outTime}` : "Escaped!"
          : v.kind === "potato"
            ? outTime ? `💥 ${outTime}` : "Survived"
            : survival
              ? outTime ? `out ${outTime}` : "Survived"
              : p.finish !== null
                ? fmtTime(p.finish)
                : `${Math.round(p.d)} m`;
    // in a match of several rounds: the points this place scored
    const pts = v.cup ? el("small", { class: "rpts", text: `+${p.left ? 0 : CUP_POINTS[i] ?? 0} pts` }) : null;
    const earn = rw?.medal
      ? el("span", { class: "earn" }, el("img", { src: MEDAL_IMG[rw.medal], alt: `${rw.medal} medal` }))
      : el("span", { class: "earn", text: "" });
    list.append(
      el(
        "li",
        { class: p.id === playerId ? "me" : "" },
        el("span", { class: `pl p${Math.min(i + 1, 4)}`, text: PLACE[i] ?? `${i + 1}th` }),
        el("img", { src: portrait(p.char), alt: "" }),
        el("span", { class: "who", text: withFlag(p.name, p.country) + (p.bot ? " 🤖" : "") + (p.id === playerId ? " (you)" : "") }, el("small", { text: detail })),
        el("span", { class: "tm" }, time, pts),
        earn,
      ),
    );
  });

  // your place, and your coins (paid once per race)
  const cup = v.cup;
  const cupDone = cup && cup.race >= cup.races.length;
  const order = cupDone ? cup.table : v.standings;
  const myPlace = order.indexOf(playerId) + 1;
  const mine = rewards[playerId];
  const solo = v.players.length < 2;
  $("#resPlace").innerHTML = myPlace ? `${myPlace}<sup>${ordinal(myPlace)}</sup>` : "–";
  $("#resTitle").textContent = cupDone
    ? myPlace === 1
      ? "Match champion!"
      : `Match: ${PLACE[myPlace - 1] ?? myPlace}`
    : solo && v.kind === "survival"
      ? `You ran ${Math.round(v.players[0]?.d ?? 0)} m${Math.round(v.players[0]?.d ?? 0) >= personalBest() && (v.players[0]?.d ?? 0) > 50 ? " · new record!" : ` · best ${personalBest()} m`}`
      : myPlace === 1
        ? "You win!"
        : myPlace
          ? `You finished ${PLACE[myPlace - 1] ?? myPlace}`
          : "Race results";
  renderCup(v);
  const reward = $("#resReward");
  reward.replaceChildren();
  const rpChange = recordRace(v, v.standings.indexOf(playerId) + 1);
  // the host's prize for the top 3, once the whole match is over
  const roomPrize = rpChange && (!cup || cupDone) ? payRoomPrize(v, myPlace) : null;
  const potBack = rpChange && (!cup || cupDone) ? refundPot(v, order) : null;
  if (rpChange && v.standings.length >= 2 && (cupDone ? cup.table[0] === playerId : !cup && myPlace === 1)) setTimeout(() => sfx.cheer(), 300);
  const ptsBefore = rank.points();
  if (mine?.medal) {
    const fresh = wallet.claim(`${v.startAt}:${playerId}`, mine.medal);
    reward.append(el("img", { src: MEDAL_IMG[mine.medal], alt: "" }), el("span", { text: `+1 ${mine.medal} medal` }));
    if (fresh) sfx.boost();
  } else if (cup && !cupDone) {
    reward.append(el("span", { class: "nomedal", text: `+${CUP_POINTS[v.standings.indexOf(playerId)] ?? 0} points · medals are paid after round ${cup.races.length}` }));
  } else if (myPlace && v.players.filter((p) => !p.bot).length >= MIN_RACERS_FOR_MEDALS) {
    // no medal, but every place counts: off the podium is still +1 league point
    if (rpChange) rank.add(LAST_PLACE_PTS);
    reward.append(el("span", { class: "nomedal", text: "No medal this time. Top 3 win medals!" }));
  }
  if (rpChange) {
    reward.append(el("span", { class: "coinchip" }, el("img", { src: "/assets/ui_c2.webp", alt: "" }), el("b", { text: `+${rpChange.coins}` }), el("small", { text: rpChange.kos ? `incl. ${rpChange.kos} hit${rpChange.kos > 1 ? "s" : ""} ×10` : "coins" })));
    if (rpChange.xp) reward.append(el("span", { class: "xpchip", text: `+${rpChange.xp} XP` }));
    if (rpChange.prize) reward.append(el("span", { class: "xpchip prizechip", text: `🏆 Prize +${rpChange.prize}` }));
    if (roomPrize) reward.append(el("span", { class: "xpchip prizechip", text: roomPrize }));
    if (potBack) reward.append(el("span", { class: "xpchip prizechip", text: potBack }));
    if (rpChange.league) reward.append(el("span", { class: "xpchip leaguechip", text: `Weekend League +${rpChange.league.pts} pts · ${rpChange.league.matches}/${LEAGUE_MATCHES}` }));
    if (rpChange.botsOnly) reward.append(el("span", { class: "nomedal", text: "Medals (and league progress) need 2 real players" }));
    else reward.append(rankChip(rank.points() - ptsBefore));
  }
  renderWallet();

  const isHost = v.host === playerId;
  const hasNext = cup && !cupDone;
  $("#nextBtn").style.display = isHost && hasNext ? "" : "none";
  $("#againBtn").style.display = isHost && !hasNext && !game.endless ? "" : "none"; // an endless run has no lobby
  $("#waitHost2").style.display = !isHost && hasNext ? "block" : "none";
  // rematch: everyone votes, the room goes again when all real players are in
  const voters = v.players.filter((p) => !p.bot && !p.gone);
  const votes = (v.rematch || []).length;
  const voted = (v.rematch || []).includes(playerId);
  $("#rematchBtn").style.display = hasNext ? "none" : "";
  $("#rematchBtn").disabled = voted;
  $("#rematchBtn").classList.toggle("waiting", voted);
  $("#rematchTxt").textContent = voted
    ? `Waiting for the others… ${votes}/${voters.length}`
    : voters.length > 1
      ? `Rematch${votes ? ` (${votes}/${voters.length})` : ""}`
      : "Play again";
  if (hasNext) {
    $("#nextBtn").replaceChildren(
      el("span", { class: "flagico", text: "🏆" }),
      el("span", { text: `Round ${cup.race + 1}: ${KIND_LABEL[cup.races[cup.race]]}` }),
      el("span", { class: "arrow", text: "→" }),
    );
  }
}

/** Your share of the host's prize pot for your final place (top 3, with 2+ real players). Returns a label, or null. */
function payRoomPrize(v, place) {
  const x = (PRIZE_INFO[v.prize ?? "none"]?.pays ?? [])[place - 1];
  if (x === undefined || v.players.filter((p) => !p.bot).length < 2) return null;
  wallet.addCoins(x);
  return v.host === playerId ? `🏆 Your own prize back +${x}` : `🏆 Prize from ${nameOf(v.host)} +${x}`;
}
/** The host paid the whole pot when the match started: whatever nobody real won goes back to them. */
function chargePot(v) {
  const key = `${net.code}:${v.startAt}`;
  if (v.host !== playerId || !potOf(v.prize) || local.getItem("lr:potKey") === key) return;
  local.setItem("lr:potKey", key);
  wallet.addCoins(-potOf(v.prize));
  toast(`Prize pot: -${potOf(v.prize).toLocaleString()} coins`);
}
function refundPot(v, order) {
  if (v.host !== playerId || !potOf(v.prize)) return null;
  const pays = PRIZE_INFO[v.prize].pays;
  const real = v.players.filter((p) => !p.bot);
  const paid = real.length < 2 ? 0 : order.reduce((a, id, i) => a + (real.some((p) => p.id === id) ? pays[i] ?? 0 : 0), 0);
  const back = potOf(v.prize) - paid;
  if (back > 0) wallet.addCoins(back);
  return back > 0 ? `↩ ${back.toLocaleString()} coins of your pot back` : null;
}
function renderCup(v) {
  const box = $("#cupBox");
  const cup = v.cup;
  box.classList.toggle("show", Boolean(cup));
  box.replaceChildren();
  if (!cup) return;
  const done = cup.race >= cup.races.length;
  const byId = new Map(v.players.map((p) => [p.id, p]));
  const rows = cup.table.map((id, i) => {
    const p = byId.get(id);
    return el(
      "tr",
      { class: id === playerId ? "me" : "" },
      el("td", { text: PLACE[i] ?? `${i + 1}th` }),
      el("td", { text: p ? withFlag(p.name, p.country) : "?" }),
      el("td", { class: "pts", text: String(cup.points[id] ?? 0) }),
    );
  });
  box.append(
    el("h4", { text: done ? "🏆 Final table" : `🏆 After round ${cup.race} of ${cup.races.length}` }),
    el("table", {}, el("thead", {}, el("tr", {}, el("th", { text: "#" }), el("th", { text: "Runner" }), el("th", { text: "Points" }))), el("tbody", {}, ...rows)),
  );
}

// ── world (three.js) ────────────────────────────────────────────────────────

const canvas = $("#scene");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch {
  $("#loadHint").textContent = "Your browser can't show 3D (WebGL is off). Try Safari or Chrome.";
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, prefs().low ? 1 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
}

/**
 * Adaptive resolution: phones with very sharp screens (DPR 3) can't always
 * fill every pixel at 60 FPS. If frames run long for a couple of seconds we
 * step the render scale down (2 → 1.6 → 1.3 → 1); it never goes back up in a
 * session, so it can't oscillate.
 */
const QUALITY_STEPS = [2, 1.6, 1.3, 1];
function applyQuality() {
  if (!renderer) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, prefs().low ? 1 : QUALITY_STEPS[qualityIdx]));
  resize();
}
let qualityIdx = 0;
let slowFor = 0;
function adaptQuality(dt) {
  if (!renderer || game.mode !== "race" || !Number.isFinite(dt) || dt <= 0) return;
  slowFor = dt > 1 / 45 ? slowFor + dt : Math.max(0, slowFor - dt * 0.5);
  if (slowFor < 2.5 || qualityIdx >= QUALITY_STEPS.length - 1) return;
  slowFor = 0;
  qualityIdx += 1;
  const ratio = Math.min(window.devicePixelRatio || 1, QUALITY_STEPS[qualityIdx]);
  if (ratio < renderer.getPixelRatio()) {
    renderer.setPixelRatio(ratio);
    resize();
  }
}

// a round rear-view mirror in the top-right corner, always on in a race: you see who's coming without a button.
// The view behind is drawn small into a texture, then onto a disc over the corner.
const mirrorCam = new THREE.PerspectiveCamera(60, 1, 0.5, 300);
const mirrorRT = new THREE.WebGLRenderTarget(256, 256);
const mirrorScene = new THREE.Scene();
const mirrorOrtho = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
const mirrorDisc = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), new THREE.MeshBasicMaterial({ map: mirrorRT.texture }));
mirrorScene.add(mirrorDisc);
const mirrorSize = new THREE.Vector2();
let mirrorTick = 0;
function renderMirror() {
  const on = renderer && game.mode === "race" && !me.out && me.runner && !game.lookBack && serverNow() >= (net.view?.startAt ?? Infinity);
  const f = $("#mirrorFrame");
  if (f.hidden === Boolean(on)) f.hidden = !on;
  if (!on) return;
  renderer.getSize(mirrorSize);
  const w = mirrorSize.x;
  const h = mirrorSize.y;
  const rect = renderer.domElement.getBoundingClientRect();
  const sx = rect.width / w;
  const sy = rect.height / h;
  // the disc goes exactly inside the frame (placed by CSS under the pause button)
  const size = Math.round(Math.min(116, window.innerWidth * 0.3));
  const fr = f.getBoundingClientRect();
  const cx = (fr.left + fr.width / 2 - rect.left) / sx;
  const cy = h - (fr.top + fr.height / 2 - rect.top) / sy;
  // the view behind is redrawn every other frame (it's small, nobody notices)
  if ((mirrorTick = (mirrorTick + 1) % 2) === 0) {
    const p = me.runner.group.position;
    mirrorCam.position.set(p.x * 0.6, 2.6, p.z - 2.5);
    mirrorCam.lookAt(p.x * 0.3, 1.4, p.z + 18);
    renderer.setRenderTarget(mirrorRT);
    renderer.render(scene, mirrorCam);
    renderer.setRenderTarget(null);
  }
  mirrorOrtho.right = w;
  mirrorOrtho.top = h;
  mirrorOrtho.updateProjectionMatrix();
  mirrorDisc.position.set(cx, cy, 0);
  mirrorDisc.scale.setScalar(size / sx - 6 / sx);
  const auto = renderer.autoClear;
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(mirrorScene, mirrorOrtho);
  renderer.autoClear = auto;
  f.style.width = f.style.height = `${size}px`;
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer?.setSize(w, h, false);
  camera.aspect = w / h;
  // portrait phones: widen the view so all four lanes stay on screen
  camera.fov = w / h < 0.8 ? 78 : 62;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

const world = (() => {
  const loader = new GLTFLoader();
  const texLoader = new THREE.TextureLoader();
  const assets = { chars: [], props: {} };
  let ready = false;

  // Sky: a gradient dome with a soft sun, and two rings of far hills and
  // mountains fading into the haze. All of it follows the camera.
  const SKY = { top: "#1d78dc", mid: "#6fbcf3", horizon: "#e4f5fd" };
  scene.background = new THREE.Color(SKY.horizon);
  scene.fog = new THREE.Fog(SKY.horizon, 90, 300);
  const hemi = new THREE.HemisphereLight("#e6f6ff", "#5fae3a", 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff1cc", 2.1);
  sun.position.set(-6, 14, 8);
  scene.add(sun);

  const skyGroup = new THREE.Group();
  scene.add(skyGroup);
  let domeMat, sunGlow, farRing, nearRing, stars, moon;
  {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(380, 32, 16),
      (domeMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { top: { value: new THREE.Color(SKY.top) }, mid: { value: new THREE.Color(SKY.mid) }, horizon: { value: new THREE.Color(SKY.horizon) } },
        vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; varying vec3 vDir;
          void main() {
            float h = max(vDir.y, 0.0);
            vec3 c = mix(horizon, mid, smoothstep(0.0, 0.16, h));
            c = mix(c, top, smoothstep(0.16, 0.65, h));
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      })),
    );
    dome.renderOrder = -2;
    skyGroup.add(dome);
    // the sun: a warm glow up and to the right of the track
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,250,0.95)");
    grd.addColorStop(0.16, "rgba(255,250,215,0.8)");
    grd.addColorStop(0.35, "rgba(255,236,170,0.18)");
    grd.addColorStop(1, "rgba(255,230,160,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const sunTex = new THREE.CanvasTexture(c);
    sunTex.colorSpace = THREE.SRGBColorSpace;
    const glow = (sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false })));
    glow.scale.set(70, 70, 1);
    glow.position.set(150, 165, -300);
    glow.renderOrder = -1;
    skyGroup.add(glow);
    // far mountains (hazy blue) and nearer rolling hills (soft green), as rings round the world
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const ring = (radius, baseY, height, sharp, top, bottom) => {
      const n = 160;
      const p = [rnd() * 6.3, rnd() * 6.3, rnd() * 6.3, rnd() * 6.3];
      const pos = [];
      const col = [];
      const cTop = new THREE.Color(top);
      const cBot = new THREE.Color(bottom);
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        let h = 0.5 + 0.2 * Math.sin(3 * a + p[0]) + 0.15 * Math.sin(7 * a + p[1]) + 0.1 * Math.sin(13 * a + p[2]) + 0.05 * Math.sin(29 * a + p[3]);
        // mountains: a jagged range of many peaks, not one big lump
        if (sharp) h = 0.35 + 0.3 * Math.abs(Math.sin(9 * a + p[0])) + 0.2 * Math.abs(Math.sin(17 * a + p[1])) + 0.15 * Math.sin(5 * a + p[2]);
        const x = Math.sin(a) * radius;
        const z = Math.cos(a) * radius;
        pos.push(x, baseY, z, x, baseY + height * Math.max(0.12, h), z);
        col.push(cBot.r, cBot.g, cBot.b, cTop.r, cTop.g, cTop.b);
      }
      const idx = [];
      for (let i = 0; i < n; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, depthWrite: false, toneMapped: false }));
      m.renderOrder = -1;
      return m;
    };
    skyGroup.add((farRing = ring(340, -14, 52, true, "#97b6e6", SKY.horizon)));
    skyGroup.add((nearRing = ring(270, -10, 30, false, "#6cbf6a", "#cdebd8")));
    // night: stars on the dome and a moon (hidden by day)
    const sp = [];
    for (let i = 0; i < 700; i++) {
      const a = rnd() * Math.PI * 2;
      const y = 0.08 + rnd() * 0.92;
      const rr = Math.sqrt(1 - y * y);
      sp.push(Math.cos(a) * rr * 360, y * 360, Math.sin(a) * rr * 360);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: "#ffffff", size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false, toneMapped: false }));
    stars.renderOrder = -1;
    stars.visible = false;
    skyGroup.add(stars);
    const mc = document.createElement("canvas");
    mc.width = mc.height = 64;
    const mg = mc.getContext("2d");
    const mgr = mg.createRadialGradient(32, 32, 10, 32, 32, 32);
    mgr.addColorStop(0, "rgba(240,248,255,1)");
    mgr.addColorStop(0.45, "rgba(230,240,255,1)");
    mgr.addColorStop(0.55, "rgba(200,220,255,0.35)");
    mgr.addColorStop(1, "rgba(200,220,255,0)");
    mg.fillStyle = mgr;
    mg.fillRect(0, 0, 64, 64);
    const mt = new THREE.CanvasTexture(mc);
    mt.colorSpace = THREE.SRGBColorSpace;
    moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, fog: false, depthWrite: false, transparent: true, toneMapped: false }));
    moon.scale.set(46, 46, 1);
    moon.position.set(-110, 150, -300);
    moon.visible = false;
    skyGroup.add(moon);
  }
  /** Recolour a hill ring: its top edge and its foot (the horizon haze). */
  function tintRing(m, top, bottom) {
    const c = m.geometry.attributes.color;
    const t = new THREE.Color(top);
    const b = new THREE.Color(bottom);
    for (let i = 0; i < c.count; i++) (i % 2 ? t : b).toArray(c.array, i * 3);
    c.needsUpdate = true;
  }
  /** The day look (the meadow and the classic maps). */
  const DAY_LOOK = { sky: SKY, sun: "#fff3c4", fog: [SKY.horizon, 90, 300], light: { hemi: ["#e6f6ff", "#5fae3a", 1.1], sun: ["#fff1cc", 2.1] }, far: "#97b6e6", near: "#6cbf6a", nearFoot: "#cdebd8" };
  /** Sky, light and haze for a map's look (a theme from themes.js, or the day look). */
  function applyLook(look) {
    domeMat.uniforms.top.value.set(look.sky.top);
    domeMat.uniforms.mid.value.set(look.sky.mid);
    domeMat.uniforms.horizon.value.set(look.sky.horizon);
    scene.background = new THREE.Color(look.sky.horizon);
    scene.fog.color.set(look.fog[0]);
    scene.fog.near = look.fog[1];
    scene.fog.far = look.fog[2];
    hemi.color.set(look.light.hemi[0]);
    hemi.groundColor.set(look.light.hemi[1]);
    hemi.intensity = look.light.hemi[2];
    sun.color.set(look.light.sun[0]);
    sun.intensity = look.light.sun[1];
    sunGlow.visible = Boolean(look.sun);
    if (look.sun) sunGlow.material.color.set(look.sun);
    tintRing(farRing, look.far, look.sky.horizon);
    tintRing(nearRing, look.near, look.nearFoot ?? look.sky.horizon);
    stars.visible = moon.visible = Boolean(look.night);
  }

  // Meadow far below the raised turf track; the track itself is Higgsfield 3D
  // ground tiles (built once the models load, see buildScenery).
  const MEADOW_Y = -0.9;
  // Everything that lines the track lives in groups that hop forward in
  // SHIFT_STEP jumps in endless (survival) runs, so the meadow never ends.
  const SHIFT_STEP = 500;
  let shift = 0;
  const trackGroup = new THREE.Group();
  scene.add(trackGroup);
  const finishGroup = new THREE.Group();
  scene.add(finishGroup);
  const grassTex = texLoader.load("/assets/grass_hd.jpg");
  grassTex.colorSpace = THREE.SRGBColorSpace;
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.anisotropy = 4;
  const GROUND_LEN = TRACK_LEN + 900;
  // painted, tiling Higgsfield ground textures per map (loaded the first time a map is picked)
  const GROUND_TEX = { moon: ["moon_tile.jpg", 14], field: ["tex_field.jpg", 9], sand: ["tex_sand.jpg", 10], pave: ["tex_pave.jpg", 8] };
  const groundTexs = {};
  function groundTex(name) {
    if (!groundTexs[name]) {
      const [file, metres] = GROUND_TEX[name];
      const t = texLoader.load(`/assets/${file}`);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      t.repeat.set(700 / metres, GROUND_LEN / metres);
      groundTexs[name] = t;
    }
    return groundTexs[name];
  }
  grassTex.repeat.set(700 / 9, GROUND_LEN / 9);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, GROUND_LEN), new THREE.MeshLambertMaterial({ map: grassTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, MEADOW_Y, -TRACK_LEN / 2);
  trackGroup.add(ground);

  // flat stand-in for the track until the 3D tiles are loaded
  const TRACK_W = LANES * LANE_W + 1.6;
  const trackTex = texLoader.load("/assets/grass.jpg");
  trackTex.colorSpace = THREE.SRGBColorSpace;
  trackTex.wrapS = trackTex.wrapT = THREE.RepeatWrapping;
  trackTex.repeat.set(TRACK_W / 3, GROUND_LEN / 3);
  const flatTrack = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_W, GROUND_LEN), new THREE.MeshLambertMaterial({ map: trackTex, color: "#d9ffb8" }));
  flatTrack.rotation.x = -Math.PI / 2;
  flatTrack.position.set(0, 0, -TRACK_LEN / 2);
  trackGroup.add(flatTrack);

  const chalk = new THREE.MeshBasicMaterial({ color: "#ffffff", fog: true });
  const chalkLines = []; // hidden on maps whose track has its own markings
  for (let i = 0; i <= LANES; i++) {
    const w = i === 0 || i === LANES ? 0.16 : 0.09;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(w, TRACK_LEN + 200), chalk);
    line.rotation.x = -Math.PI / 2;
    line.position.set((i - LANES / 2) * LANE_W, 0.06, -TRACK_LEN / 2 - 40);
    trackGroup.add(line);
    chalkLines.push(line);
  }

  // start & finish lines
  function stripe(z, checker) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 32;
    const g = c.getContext("2d");
    if (checker) {
      for (let x = 0; x < 16; x++)
        for (let y = 0; y < 2; y++) {
          g.fillStyle = (x + y) % 2 ? "#111" : "#fff";
          g.fillRect(x * 16, y * 16, 16, 16);
        }
    } else {
      g.fillStyle = "#fff";
      g.fillRect(0, 0, 256, 32);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(LANES * LANE_W, checker ? 1.2 : 0.3),
      new THREE.MeshBasicMaterial({ map: t }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0.07, -z);
    (checker ? finishGroup : scene).add(m);
  }
  stripe(0, false);
  stripe(TRACK_LEN, true);

  // finish arch: two striped posts and a banner (stand-in until the Higgsfield gate loads)
  const fallbackArch = new THREE.Group();
  {
    const arch = fallbackArch;
    const postMat = new THREE.MeshLambertMaterial({ color: "#ff5a4e" });
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 5, 12), postMat);
      post.position.set(s * (LANES * LANE_W) / 2 + s * 0.6, 2.5, 0);
      arch.add(post);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshLambertMaterial({ color: "#ffcf3a" }));
      ball.position.set(post.position.x, 5.2, 0);
      arch.add(ball);
    }
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 160;
    const g = c.getContext("2d");
    g.fillStyle = "#ffcf3a";
    g.fillRect(0, 0, 1024, 160);
    g.fillStyle = "#23314d";
    g.fillRect(0, 0, 1024, 14);
    g.fillRect(0, 146, 1024, 14);
    g.font = "bold 108px 'Lilita One', 'Arial Black', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 10;
    g.strokeStyle = "#23314d";
    g.strokeText("FINISH", 512, 86);
    g.fillStyle = "#fff";
    g.fillText("FINISH", 512, 86);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(LANES * LANE_W + 1.4, 1.3),
      new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }),
    );
    banner.position.set(0, 4.3, 0);
    arch.add(banner);
    arch.position.z = -TRACK_LEN;
    finishGroup.add(arch);
  }

  // boost pad texture (code-drawn chevrons)
  const padTex = (() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#1fd1ff";
    g.fillRect(0, 0, 128, 256);
    g.fillStyle = "#fff";
    for (let i = 0; i < 3; i++) {
      const y = 40 + i * 70;
      g.beginPath();
      g.moveTo(14, y + 40);
      g.lineTo(64, y);
      g.lineTo(114, y + 40);
      g.lineTo(114, y + 62);
      g.lineTo(64, y + 22);
      g.lineTo(14, y + 62);
      g.closePath();
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  // blob shadow
  const shadowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grd.addColorStop(0, "rgba(0,0,0,0.6)");
    grd.addColorStop(0.55, "rgba(0,0,0,0.42)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
  function blobShadow(size) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), shadowMat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.04;
    return m;
  }

  // ── asset loading ──
  /**
   * The gates were modelled from slightly angled pictures, so they come out
   * turned a little. Turn them until they're thinnest front-to-back, i.e.
   * square across the track.
   */
  function squareUp(root) {
    const size = new THREE.Vector3();
    const depth = (deg) => {
      root.rotation.y = (deg * Math.PI) / 180;
      root.updateMatrixWorld(true);
      new THREE.Box3().setFromObject(root, true).getSize(size);
      return size.z / size.x;
    };
    let best = 0;
    for (let a = -50; a <= 50; a += 2) if (depth(a) < depth(best)) best = a;
    let fine = best;
    for (let a = best - 2; a <= best + 2; a += 0.25) if (depth(a) < depth(fine)) fine = a;
    root.rotation.y = (fine * Math.PI) / 180;
    root.updateMatrixWorld(true);
    return root;
  }

  /** Boost pad: flat on the track, its long side (the arrows) running down the lane. */
  const PAD_TURN = -Math.PI / 2; // turns the model so its chevrons point down the track (toward -z)
  function fitPad(root) {
    const holder = fitProp(root, { width: 2.4, maxHeight: 0.14 });
    holder.rotation.y = PAD_TURN;
    const g = new THREE.Group();
    g.add(holder);
    return g;
  }

  function ballStandIn() {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.375, 20, 14), new THREE.MeshPhongMaterial({ color: "#6b2fd6", shininess: 90 }));
    m.position.y = 0.375;
    const g = new THREE.Group();
    g.add(m);
    return g;
  }

  // bowling balls: computed from when and where they were rolled
  const ballMeshes = new Map();
  function syncBowls(list, nowMs) {
    const live = new Set();
    for (const b of list) {
      const age = (nowMs - b.at) / 1000;
      const dir = b.dir ?? -1;
      const d = b.d + dir * BOWL_SPEED * age;
      if (age < 0 || Math.abs(d - b.d) > BOWL_RANGE_M) continue;
      live.add(b.id);
      let m = ballMeshes.get(b.id);
      if (!m) {
        // spin around the ball's centre, not its base
        const ball = assets.props.bowlingBall.clone();
        ball.position.y = -0.375;
        m = new THREE.Group();
        m.add(ball);
        raceGroup.add(m);
        ballMeshes.set(b.id, m);
      }
      m.position.set(laneX(b.lane), 0.375, -d);
      m.rotation.x = (-dir * BOWL_SPEED * age) / 0.375; // rolling the way it's going
    }
    for (const [id, m] of ballMeshes) {
      if (live.has(id)) continue;
      raceGroup.remove(m);
      ballMeshes.delete(id);
    }
  }

  function bananaStandIn() {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 8, 16, Math.PI), new THREE.MeshLambertMaterial({ color: "#ffd21f" }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.1;
    const g = new THREE.Group();
    g.add(m);
    return g;
  }

  /** Farm and beach props load the first time someone picks that map. */
  const mapLoads = new Map();
  function ensureMap(map) {
    if (map === "meadow" || THEME[map] || mapReady(map)) return Promise.resolve();
    if (!mapLoads.has(map)) {
      const P = assets.props;
      const glb = (file, key, size) => loadGLB(`/assets/${file}.glb`).then((g) => (P[key] = fitProp(g.scene, size)));
      const stand = () =>
        loadGLB("/assets/st_stand.glb").then((g) => {
          // the stand's long side runs along the track
          P.stadiumStand = fitProp(g.scene, { width: 34 });
          P.stadiumStand.userData.len = 34;
        });
      const jobs =
        map === "city"
          ? [glb("ct_tower", "cityTower", { height: 30 }), glb("ct_shop", "cityShop", { height: 13 }), glb("ct_lamp", "cityLamp", { height: 5.2 }), glb("ct_taxi", "taxi", { width: 2.6 }), glb("ct_pigeon", "pigeon", { width: 1.0 }), loadGLB("/assets/ct_road.glb").then((g) => (P.cityTileNext = fitTile(g.scene, true)))]
          : map === "stadium"
          ? [stand(), glb("st_light", "stadiumLight", { height: 30 }), glb("st_ball", "football", { width: 0.8 }), glb("st_cam", "spidercam", { width: 1.1 }), loadGLB("/assets/st_pitch.glb").then((g) => (P.stadiumTileNext = fitTile(g.scene)))]
          : map === "space"
          ? [glb("sp_dome", "spaceDome", { height: 7 }), glb("sp_rocket", "spaceRocket", { height: 14 }), glb("sp_dish", "spaceDish", { height: 5 }), glb("sp_asteroid", "asteroid", { width: 0.9 }), glb("sp_ufo", "ufo", { width: 2.4 }), loadGLB("/assets/sp_walk.glb").then((g) => (P.spaceTileNext = fitTile(g.scene, true)))]
          : map === "farm"
          ? [
              loadGLB("/assets/barn.glb").then((g) => (P.barn = fitProp(g.scene, { height: 7.5 }))),
              loadGLB("/assets/windmill.glb").then((g) => (P.windmill = fitProp(g.scene, { height: 13 }))),
              loadGLB("/assets/wheat.glb").then((g) => (P.wheat = fitProp(g.scene, { width: 6.8, maxHeight: 1.8 }))),
              loadGLB("/assets/tractor.glb").then((g) => (P.tractor = fitProp(g.scene, { width: 3.6 }))),
              loadGLB("/assets/sunflowers.glb").then((g) => (P.sunflowers = fitProp(g.scene, { height: 2.4 }))),
              loadGLB("/assets/farm_tile.glb").then((g) => (P.farmTileNext = fitTile(g.scene))),
            ]
          : [
              loadGLB("/assets/palm.glb").then((g) => (P.palm = fitProp(g.scene, { height: 8 }))),
              loadGLB("/assets/hut.glb").then((g) => (P.hut = fitProp(g.scene, { height: 4.6 }))),
              loadGLB("/assets/lighthouse.glb").then((g) => (P.lighthouse = fitProp(g.scene, { height: 20 }))),
              loadGLB("/assets/umbrella.glb").then((g) => (P.umbrella = fitProp(g.scene, { width: 3.2 }))),
              loadGLB("/assets/board_tile.glb").then((g) => (P.boardTileNext = fitTile(g.scene))),
            ];
      // the tile goes in last, so mapReady() only says yes once every prop is there
      mapLoads.set(
        map,
        Promise.all(jobs)
          .then(() => {
            if (map === "farm") P.farmTile = P.farmTileNext;
            else if (map === "beach") P.boardTile = P.boardTileNext;
            else P[`${map}Tile`] = P[`${map}TileNext`];
          })
          .catch((err) => {
            mapLoads.delete(map);
            throw err;
          }),
      );
    }
    return mapLoads.get(map);
  }

  function loadGLB(url) {
    return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
  }

  /** Normalise a static prop: long side across the lane, centred, base on the ground. */
  function fitProp(root, { width, height, maxHeight, maxWidth, lengthwise }) {
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    const holder = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(root);
    holder.add(inner);
    // long props lie across the lane, unless `lengthwise` (then they face the runner)
    if (lengthwise ? size.x > size.z * 1.15 : size.z > size.x * 1.15) inner.rotation.y = Math.PI / 2;
    holder.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(inner);
    const s2 = b2.getSize(new THREE.Vector3());
    const c2 = b2.getCenter(new THREE.Vector3());
    inner.position.set(-c2.x, -b2.min.y, -c2.z);
    const k = width ? width / s2.x : height / s2.y;
    holder.scale.setScalar(k);
    if (maxHeight && s2.y * k > maxHeight) holder.scale.y = maxHeight / s2.y;
    if (maxWidth && s2.x * k > maxWidth) holder.scale.x = maxWidth / s2.x;
    holder.traverse((o) => {
      if (o.isMesh) {
        o.material.side = THREE.FrontSide;
        o.frustumCulled = true;
      }
    });
    return holder;
  }

  /**
   * The Higgsfield ground slab: scaled to the track's width, with its grassy
   * top (found by casting rays down onto it) at y = 0 so runners stand on it.
   */
  function fitTile(root, lengthwise = false) {
    const holder = fitProp(root, { width: TRACK_W, lengthwise });
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    const size = box.getSize(new THREE.Vector3());
    const ray = new THREE.Raycaster();
    const ys = [];
    for (const fx of [-0.3, -0.1, 0.1, 0.3]) {
      for (const fz of [-0.3, 0, 0.3]) {
        ray.set(new THREE.Vector3(fx * size.x, box.max.y + 1, fz * size.z), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObject(holder, true)[0];
        if (hit) ys.push(hit.point.y);
      }
    }
    ys.sort((a, b) => a - b);
    const top = ys.length ? ys[Math.floor(ys.length / 2)] : box.max.y;
    // Mow the lawn: grass tufts on the running surface read as obstacles, so
    // press every vertex above the turf (and inside the track) down onto it.
    const v = new THREE.Vector3();
    holder.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry = o.geometry.clone();
      const pos = o.geometry.attributes.position;
      const inv = o.matrixWorld.clone().invert();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        if (v.y > top + 0.03) {
          v.y = top + 0.03;
          v.applyMatrix4(inv);
          pos.setXYZ(i, v.x, v.y, v.z);
        }
      }
      pos.needsUpdate = true;
      o.geometry.computeVertexNormals();
    });
    const tile = new THREE.Group();
    holder.position.y = -top;
    tile.add(holder);
    tile.userData.length = size.z;
    return tile;
  }

  function stripRootMotion(clip) {
    for (const tr of clip.tracks) {
      if (!/Hips\.position$/.test(tr.name)) continue;
      const v = tr.values;
      for (let i = 3; i < v.length; i += 3) {
        v[i] = v[0];
        v[i + 2] = v[2];
      }
    }
    return clip;
  }

  function trimClip(clip, [from, to]) {
    const end = Math.min(to, clip.duration);
    if (from <= 0 && end >= clip.duration) return clip;
    for (const tr of clip.tracks) {
      tr.trim(from, end);
      tr.shift(-from);
    }
    clip.resetDuration();
    return clip;
  }

  async function loadChar(i) {
    const gltf = await loadGLB(`/assets/${RUNNERS[i].file}.glb`);
    const clips = {};
    for (const c of gltf.animations) {
      const n = c.name.toLowerCase();
      if (n.includes("getup") || n.includes("stand_up")) {
        clips.getup = trimClip(stripRootMotion(c), GETUP_CLIP);
        continue;
      }
      if (n.includes("fall")) {
        clips.fall = trimClip(stripRootMotion(c), FALL_CLIP);
        continue;
      }
      const key = n.includes("jump") && !n.includes("happy")
        ? "jump"
        : n.includes("slide")
          ? "slide"
          : n.includes("happy") || n.includes("cheer")
            ? "cheer"
            : n.includes("idle")
              ? "idle"
              : n.includes("run")
                ? "run"
                : c.name;
      clips[key] = stripRootMotion(c);
    }
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false;
        if (o.material) o.material.side = THREE.FrontSide;
      }
    });
    // Measure the POSED, skinned mesh (precise box): the bind-pose bounds of a
    // skinned mesh don't match what is drawn.
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const probe = clips.idle || clips.run;
    if (probe) {
      mixer.clipAction(probe).play();
      mixer.update(0);
    }
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gltf.scene, true);
    mixer.stopAllAction();
    mixer.uncacheRoot(gltf.scene);
    const h = box.max.y - box.min.y || 1;
    return { scene: gltf.scene, clips, scale: CHAR_H / h, footY: box.min.y };
  }

  // starters load up front; shop skins load the first time someone uses them
  const charLoads = new Map();
  function ensureChar(i) {
    if (!charLoads.has(i)) {
      charLoads.set(i, loadChar(i).then((c) => (assets.chars[i] = c)).catch((err) => {
        charLoads.delete(i);
        throw err;
      }));
    }
    return charLoads.get(i);
  }
  const hasChars = (list) => list.every((i) => assets.chars[i]);

  async function load(onProgress) {
    const jobs = [
      ...[0, 1, 2, 3].map((i) => ensureChar(i)),
      // obstacles: `${kind}${look}` (see LOOKS in logic.js)
      loadGLB("/assets/hurdle2.glb").then((g) => (assets.props.hurdle0 = fitProp(g.scene, { width: 1.75, maxHeight: 0.72 }))),
      loadGLB("/assets/hay.glb").then((g) => (assets.props.hurdle1 = fitProp(g.scene, { width: 1.7, maxHeight: 0.7 }))),
      loadGLB("/assets/gate2.glb").then((g) => (assets.props.gate0 = fitProp(g.scene, { width: 1.95, maxHeight: 2.2 }))),
      loadGLB("/assets/arch.glb").then((g) => (assets.props.gate1 = fitProp(g.scene, { width: 1.95, maxHeight: 2.2 }))),
      loadGLB("/assets/crates.glb").then((g) => (assets.props.crate0 = fitProp(g.scene, { width: 1.45, maxHeight: 2.6 }))),
      // the cow faces you and stands tall: far too big to jump, so you dodge it like the crates
      loadGLB("/assets/cow.glb").then((g) => (assets.props.crate1 = fitProp(g.scene, { height: 2.5, maxWidth: 1.8, lengthwise: true }))),
      loadGLB("/assets/tires.glb").then((g) => (assets.props.crate2 = fitProp(g.scene, { width: 1.4, maxHeight: 2.5 }))),
      loadGLB("/assets/barrel.glb").then((g) => (assets.props.roller0 = fitProp(g.scene, { width: 1.5, maxHeight: 1.0 }))),
      loadGLB("/assets/box.glb").then((g) => (assets.props.box = fitProp(g.scene, { width: 0.95 }))),
      // nice-to-haves: the game still runs with stand-ins if one of these fails
      loadGLB("/assets/banana.glb").then((g) => (assets.props.banana = fitProp(g.scene, { width: 1.0, maxHeight: 0.3 }))).catch(() => (assets.props.banana = bananaStandIn())),
      // gates are wide enough that their pillars stand outside the fences
      loadGLB("/assets/boost_pad.glb").then((g) => (assets.props.boostPad = fitPad(g.scene))).catch(() => {}),
      loadGLB("/assets/bowling_ball.glb").then((g) => (assets.props.bowlingBall = fitProp(g.scene, { width: 0.75 }))).catch(() => (assets.props.bowlingBall = ballStandIn())),
      loadGLB("/assets/gate_finish.glb").then((g) => (assets.props.finishGate = fitProp(squareUp(g.scene), { width: TRACK_W * 1.65, maxHeight: 8.5 }))).catch(() => {}),
      loadGLB("/assets/gate_start.glb").then((g) => (assets.props.startGate = fitProp(squareUp(g.scene), { width: TRACK_W * 1.65, maxHeight: 8 }))).catch(() => {}),
      loadGLB("/assets/ground.glb").then((g) => (assets.props.ground = fitTile(g.scene))),
      loadGLB("/assets/tree_oak.glb").then((g) => (assets.props.oak = fitProp(g.scene, { height: 6.5 }))),
      loadGLB("/assets/tree_pine.glb").then((g) => (assets.props.pine = fitProp(g.scene, { height: 6.2 }))),
      loadGLB("/assets/tree_blossom.glb").then((g) => (assets.props.blossom = fitProp(g.scene, { height: 5.4 }))),
      loadGLB("/assets/bush.glb").then((g) => (assets.props.bush = fitProp(g.scene, { width: 2.4 }))),
      loadGLB("/assets/rocks.glb").then((g) => (assets.props.rocks = fitProp(g.scene, { width: 2.2 }))),
      loadGLB("/assets/fence.glb").then((g) => (assets.props.fence = fitProp(g.scene, { width: 3.0, maxHeight: 0.9 }))),
      loadGLB("/assets/cloud.glb").then((g) => (assets.props.cloud = fitProp(g.scene, { width: 1 }))),
    ];
    let done = 0;
    await Promise.all(jobs.map((j) => j.then(() => onProgress?.(++done / jobs.length))));
    ready = true;
  }

  // ── character instances ──
  function makeRunner(charIdx, name, color, isMe) {
    const a = assets.chars[charIdx];
    const g = new THREE.Group();
    const body = SkeletonUtils.clone(a.scene);
    const pivot = new THREE.Group();
    pivot.add(body);
    body.position.y = -a.footY;
    pivot.scale.setScalar(a.scale);
    pivot.rotation.y = Math.PI; // models face +z; the race runs toward -z
    g.add(pivot);
    g.add(blobShadow(1.35));
    const mixer = new THREE.AnimationMixer(body);
    const actions = {};
    for (const [k, clip] of Object.entries(a.clips)) actions[k] = mixer.clipAction(clip);
    if (actions.jump) {
      actions.jump.setLoop(THREE.LoopOnce, 1);
      actions.jump.clampWhenFinished = true;
    }
    if (actions.slide) {
      actions.slide.setLoop(THREE.LoopOnce, 1);
      actions.slide.clampWhenFinished = true;
    }
    for (const k of ["fall", "getup"]) {
      if (!actions[k]) continue;
      actions[k].setLoop(THREE.LoopOnce, 1);
      actions[k].clampWhenFinished = true;
    }
    // power-up looks: a bubble, a rocket flame, a see-through ghost
    const fx = powerFx();
    g.add(fx.group);
    const mats = [];
    body.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      mats.push(o.material);
    });
    let pw = "";
    let current = null;
    const r = {
      group: g,
      pivot,
      mixer,
      fallT: 0,
      setPower(next) {
        if (next === pw) return;
        pw = next;
        fx.bubble.visible = next === "shield";
        fx.flame.visible = next === "rocket";
        for (const m of mats) {
          m.transparent = next === "ghost";
          m.opacity = next === "ghost" ? 0.38 : 1;
          m.depthWrite = next !== "ghost";
          m.needsUpdate = true; // transparency changes the shader
        }
      },
      fx,
      play(name, fade = 0.15, timeScale = 1, restart = false) {
        const next = actions[name] || actions.run || Object.values(actions)[0];
        if (!next) return;
        if (current === next) {
          next.timeScale = timeScale;
          if (restart) next.reset().play();
          return;
        }
        next.reset();
        next.timeScale = timeScale;
        next.enabled = true;
        next.setEffectiveWeight(1);
        next.fadeIn(fade).play();
        if (current) current.fadeOut(fade);
        current = next;
      },
      clipDuration: (n) => actions[n]?.getClip().duration ?? 1,
      tag: null,
    };
    if (!isMe) {
      const tag = nameTag(name, color);
      tag.position.y = CHAR_H + 0.3;
      g.add(tag);
      r.tag = tag;
    }
    r.play("idle", 0);
    return r;
  }

  function powerFx() {
    const group = new THREE.Group();
    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1, 28, 20),
      new THREE.MeshPhongMaterial({ color: "#5fd0ff", emissive: "#1d6fd8", emissiveIntensity: 0.35, transparent: true, opacity: 0.32, shininess: 120, depthWrite: false }),
    );
    bubble.scale.set(0.95, 1.05, 0.95);
    bubble.position.y = CHAR_H / 2;
    bubble.visible = false;
    const flame = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 14), new THREE.MeshBasicMaterial({ color: "#ff8a1f", transparent: true, opacity: 0.9 }));
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.7, 12), new THREE.MeshBasicMaterial({ color: "#fff27a" }));
    outer.rotation.x = inner.rotation.x = -Math.PI / 2; // tip points back along +z
    inner.position.z = -0.1;
    flame.add(outer, inner);
    flame.position.set(0, CHAR_H * 0.55, 0.65);
    flame.visible = false;
    group.add(bubble, flame);
    return { group, bubble, flame };
  }

  function nameTag(text, color) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 72;
    const g = c.getContext("2d");
    g.font = "italic 800 36px 'Barlow Condensed', 'Arial Narrow', sans-serif";
    const label = text.toUpperCase();
    const w = Math.min(244, g.measureText(label).width + 34);
    const x = (256 - w) / 2;
    g.fillStyle = "rgba(8,11,9,0.88)";
    g.beginPath();
    g.moveTo(x + 10, 10);
    g.lineTo(x + w, 10);
    g.lineTo(x + w - 10, 62);
    g.lineTo(x, 62);
    g.closePath();
    g.fill();
    g.fillStyle = color;
    g.fillRect(x + 2, 56, w - 12, 6);
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(label, 128, 34, 220);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
    s.scale.set(1.6, 0.45, 1);
    s.renderOrder = 10;
    return s;
  }

  // ── course objects ──
  const raceGroup = new THREE.Group();
  scene.add(raceGroup);
  let cullables = []; // {obj, z}
  let rollers = []; // {obj, lane, z0, z, startedAt}
  let boxes = []; // {obj, lane, z, taken}
  let hearts = []; // survival heart pickups
  const emojiTexCache = new Map();
  function emojiTex(e) {
    if (!emojiTexCache.has(e)) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d");
      g.font = "100px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(e, 64, 72);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      emojiTexCache.set(e, t);
    }
    return emojiTexCache.get(e);
  }
  /** A soft white dot that fades out to the edge: tint it for glows and flashes. */
  let glowTexture = null;
  function glowTex() {
    if (!glowTexture) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d");
      const grd = g.createRadialGradient(64, 64, 2, 64, 64, 64);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.3, "rgba(255,255,255,0.55)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
      glowTexture = new THREE.CanvasTexture(c);
    }
    return glowTexture;
  }
  const glowSprite = (color, scale) => {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
    spr.scale.setScalar(scale);
    spr.renderOrder = 11;
    return spr;
  };
  /** After a crash: three stars circle the runner's head until they're back up. */
  function dizzy(runner, secs) {
    if (runner.dizzy) runner.group.remove(runner.dizzy);
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const st = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex("⭐"), depthTest: false, transparent: true }));
      st.scale.set(0.4, 0.4, 1);
      st.renderOrder = 11;
      g.add(st);
    }
    g.position.y = CHAR_H + 0.2;
    runner.group.add(g);
    runner.dizzy = g;
    const t0 = performance.now();
    const step = () => {
      if (runner.dizzy !== g) return;
      const k = (performance.now() - t0) / 1000;
      if (k > secs) {
        runner.group.remove(g);
        runner.dizzy = null;
        return;
      }
      g.children.forEach((st, i) => {
        const ang = k * 7 + i * 2.094;
        st.position.set(Math.cos(ang) * 0.45, Math.sin(k * 9 + i) * 0.07, Math.sin(ang) * 0.45);
      });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  /** An emote floats up over a runner's head and fades. */
  function emoteBubble(runner, e) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(e), depthTest: false, transparent: true }));
    spr.scale.set(0.9, 0.9, 1);
    spr.position.y = CHAR_H + 0.9;
    spr.renderOrder = 11;
    runner.group.add(spr);
    const t0 = performance.now();
    const step = () => {
      const k = (performance.now() - t0) / 2200;
      if (k >= 1) return runner.group.remove(spr);
      spr.position.y = CHAR_H + 0.9 + k * 0.8;
      spr.material.opacity = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  // your best solo distance, as a glowing post beside the track
  const bestMarker = new THREE.Group();
  {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 10), new THREE.MeshBasicMaterial({ color: "#b6f72a" }));
    post.position.set(TRACK_W / 2 + 0.6, 3, 0);
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) }));
    label.scale.set(3.2, 0.8, 1);
    label.position.set(TRACK_W / 2 + 0.6, 6.4, 0);
    bestMarker.add(post, label);
    bestMarker.userData.canvas = c;
    bestMarker.userData.label = label;
    bestMarker.visible = false;
    scene.add(bestMarker);
  }
  function setBestMarker(d) {
    bestMarker.visible = d > 50;
    if (!bestMarker.visible) return;
    bestMarker.position.z = -d;
    const c = bestMarker.userData.canvas;
    const g = c.getContext("2d");
    g.clearRect(0, 0, 256, 64);
    g.fillStyle = "rgba(10,14,8,0.85)";
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = "#b6f72a";
    g.font = "italic 900 34px 'Barlow Condensed', 'Arial Narrow', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(`BEST ${Math.round(d)} M`, 128, 34);
    bestMarker.userData.label.material.map.needsUpdate = true;
  }
  let scenery = null;

  const clouds = new THREE.Group();
  scene.add(clouds);

  /**
   * One scenery set per map, built the first time it's needed. Each map has
   * its own 3D track tiles, roadside props and ground colour; the start and
   * finish gates and the clouds are shared.
   */
  const mapScenery = {}; // map -> { group, cull: [] }
  let sceneryCull = [];
  let activeMap = "";
  const MAP_GROUND = {
    meadow: { color: "#ffffff", tex: true },
    farm: { color: "#ffffff", tex: "field" },
    beach: { color: "#ffffff", tex: "sand" },
    city: { color: "#ffffff", tex: "pave" },
    stadium: { color: "#ffffff", tex: "field" },
    space: { color: "#ffffff", tex: "moon" },
  };
  function mapReady(map) {
    if (THEME[map]) return Boolean(assets.props.ground); // themed maps need nothing more to load
    if (BUILT_MAPS.has(map)) return Boolean(assets.props[`${map}Tile`]);
    if (map === "farm") return Boolean(assets.props.farmTile);
    if (map === "beach") return Boolean(assets.props.boardTile);
    return Boolean(assets.props.ground);
  }
  function buildScenery(map = "meadow") {
    if (!mapReady(map)) map = "meadow";
    if (!assets.props.ground) return;
    if (!mapScenery[map]) mapScenery[map] = buildMap(map);
    for (const [k, m] of Object.entries(mapScenery)) m.group.visible = k === map;
    scenery = mapScenery[map].group;
    scenery.position.z = -shift;
    sceneryCull = mapScenery[map].cull;
    activeMap = map;
    setSky(map);
    const theme = THEME[map];
    const look = MAP_GROUND[map] ?? { color: "#ffffff" };
    ground.material.color.set(look.color);
    ground.material.map = theme ? patternTex(theme.ground, 6, 700, GROUND_LEN) : typeof look.tex === "string" ? groundTex(look.tex) : look.tex ? grassTex : null;
    ground.material.needsUpdate = true;
    chalk.color.set(theme?.track.lines ?? "#ffffff");
    if (!sharedBuilt) buildShared();
  }
  let sharedBuilt = false;

  // ── city, stadium and space: Higgsfield 3D props, no cows or hay bales ──
  const BUILT_MAPS = new Set(["city", "stadium", "space"]);
  /**
   * Maps with their own painted sky (Higgsfield panoramas wrapped round the
   * world, loaded the first time the map is picked); the rest use the day sky.
   */
  const MAP_SKY = {
    space: { file: "space_pano.jpg", turn: 0.62, drop: 60, bg: "#0b0722", fog: "#1b1240", clouds: false },
    city: { file: "city_pano.jpg", turn: 0, drop: 46, bg: "#3f9ae6", fog: "#cfe6f5", clouds: true },
  };
  const mapSkies = {}; // map -> group
  function mapSkyGroup(map) {
    if (mapSkies[map]) return mapSkies[map];
    const g = new THREE.Group();
    scene.add(g);
    mapSkies[map] = g;
    const sky = MAP_SKY[map];
    texLoader.load(`/assets/${sky.file}`, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.set(2, 1);
      const R = 300;
      const H = ((2 * Math.PI * R) / 2) * (t.image.height / t.image.width);
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(R, R, H, 64, 1, true),
        new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false }),
      );
      cyl.position.y = H / 2 - sky.drop;
      cyl.rotation.y = Math.PI * sky.turn;
      cyl.renderOrder = -1;
      g.add(cyl);
    });
    return g;
  }
  /** Sky, fog and clouds per map. */
  function setSky(map) {
    const own = MAP_SKY[map];
    const theme = THEME[map];
    if (own) mapSkyGroup(map);
    for (const [k, g] of Object.entries(mapSkies)) g.visible = k === map;
    // a painted panorama for city and space; the dome, coloured per map, everywhere else
    applyLook(theme ?? DAY_LOOK);
    skyGroup.visible = !own;
    clouds.visible = own ? own.clouds : theme ? theme.clouds : true;
    if (own) {
      scene.background = new THREE.Color(own.bg);
      scene.fog.color.set(own.fog);
    }
    setWeather(theme?.fx ?? null);
  }

  // city, stadium and space: Higgsfield 3D props along the track, plus simple edges
  function buildCity(add, group, r, edge) {
    const P = assets.props;
    const barrier = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, 19.6), new THREE.MeshLambertMaterial({ color: "#d8dbe2" }));
    slab.position.y = 0.27;
    barrier.add(slab);
    for (let z = -40; z < TRACK_LEN + 140; z += 20) for (const side of [-1, 1]) add(barrier, side * (edge - 0.1), 0, z, 1, 0);
    for (let z = -50; z < TRACK_LEN + 160; z += 22) for (const side of [-1, 1]) add(P.cityLamp, side * (edge + 1.2), MEADOW_Y, z, 1, side > 0 ? Math.PI : 0);
    for (const side of [-1, 1]) {
      const face = side > 0 ? -Math.PI / 2 : Math.PI / 2; // fronts toward the street
      for (let z = -60; z < TRACK_LEN + 170; ) {
        const tall = r() < 0.45;
        add(tall ? P.cityTower : P.cityShop, side * (edge + (tall ? 12 : 8) + r() * 3), MEADOW_Y, z, 0.9 + r() * 0.25, face + (r() - 0.5) * 0.15);
        if (r() < 0.3) add(P.cityTower, side * (edge + 30 + r() * 10), MEADOW_Y, z + 6, 1.1 + r() * 0.4, face);
        z += tall ? 17 + r() * 5 : 14 + r() * 4;
      }
    }
  }

  function buildStadium(add, group, r, edge) {
    const P = assets.props;
    const adColors = ["#e63946", "#1d3557", "#ffb703", "#2a9d8f", "#8338ec"];
    const ads = adColors.map((c) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 7.8), new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.25 }));
      m.position.y = 0.45;
      g.add(m);
      return g;
    });
    let k = 0;
    for (let z = -40; z < TRACK_LEN + 140; z += 8) for (const side of [-1, 1]) add(ads[k++ % ads.length], side * (edge - 0.1), 0, z, 1, 0);
    // grandstands all the way along both sides, facing the pitch
    const len = P.stadiumStand.userData.len;
    for (let z = -60; z < TRACK_LEN + 180; z += len * 0.98) {
      add(P.stadiumStand, edge + 9, MEADOW_Y, z, 1, -Math.PI / 2);
      add(P.stadiumStand, -(edge + 9), MEADOW_Y, z, 1, Math.PI / 2);
    }
    for (let z = 30; z < TRACK_LEN + 160; z += 110) for (const side of [-1, 1]) add(P.stadiumLight, side * (edge + 26), MEADOW_Y, z, 1, side > 0 ? -Math.PI / 2 : Math.PI / 2);
  }

  function buildSpace(add, group, r, edge) {
    const P = assets.props;
    const railMat = new THREE.MeshBasicMaterial({ color: "#38f0ff" });
    const post = new THREE.MeshLambertMaterial({ color: "#4a5070" });
    const rail = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 9.9), railMat);
    bar.position.y = 0.75;
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 0.18), post);
    p1.position.set(0, 0.4, 4.9);
    rail.add(bar, p1);
    for (let z = -40; z < TRACK_LEN + 140; z += 10) for (const side of [-1, 1]) add(rail, side * (edge - 0.1), 0, z, 1, 0);
    for (let z = -60; z < TRACK_LEN + 170; z += 12 + r() * 10) {
      for (const side of [-1, 1]) {
        const roll = r();
        if (roll < 0.22) add(P.spaceDome, side * (edge + 10 + r() * 12), MEADOW_Y, z, 0.8 + r() * 0.5, r() * Math.PI * 2);
        else if (roll < 0.36) add(P.spaceRocket, side * (edge + 14 + r() * 16), MEADOW_Y, z, 0.8 + r() * 0.5, r() * Math.PI * 2);
        else if (roll < 0.56) add(P.spaceDish, side * (edge + 5 + r() * 6), MEADOW_Y, z, 0.8 + r() * 0.4, side > 0 ? -Math.PI / 2 : Math.PI / 2);
        else if (roll < 0.8) add(P.asteroid, side * (edge + 4 + r() * 22), MEADOW_Y, z, 1.5 + r() * 2.5, r() * Math.PI * 2);
      }
    }
  }

  /**
   * The meadow's track: a raised red running track (top at y = 0, the meadow
   * below) with white kerbs down both sides. One box each: cheap on phones.
   */
  function runningTrack(tex = null, sideColor = "#a8402f", kerbColor = "#f4f1e8") {
    const len = TRACK_LEN + 220;
    const g = new THREE.Group();
    if (!tex) {
      tex = texLoader.load("/assets/track_red.jpg");
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(TRACK_W / 3, len / 3);
    }
    tex.anisotropy = renderer?.capabilities.getMaxAnisotropy?.() ?? 4;
    const side = new THREE.MeshLambertMaterial({ color: sideColor });
    const top = new THREE.MeshLambertMaterial({ map: tex });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(TRACK_W, -MEADOW_Y, len), [side, side, top, side, side, side]);
    deck.position.set(0, MEADOW_Y / 2, -(len / 2 - 60));
    g.add(deck);
    const kerbMat = new THREE.MeshLambertMaterial({ color: kerbColor });
    for (const s of [-1, 1]) {
      const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.45, -MEADOW_Y + 0.12, len), kerbMat);
      kerb.position.set(s * (TRACK_W / 2 + 0.22), MEADOW_Y / 2 + 0.06, -(len / 2 - 60));
      g.add(kerb);
    }
    return g;
  }

  /** Height of the meadow's hills, `d` metres out from the track edge at distance `z`: flat near the fence, rolling further out. */
  function hillY(d, z, amp = 1) {
    const rise = THREE.MathUtils.smoothstep(d, 12, 70);
    return amp * rise * (7 + 4 * Math.sin(z * 0.021 + d * 0.05) + 2.5 * Math.sin(z * 0.063 - d * 0.11));
  }
  /** Grassy hills on both sides of the meadow track, one mesh per side. */
  function meadowHills(edge, tex = null, amp = 1) {
    const g = new THREE.Group();
    const len = TRACK_LEN + 400;
    const width = 130;
    if (!tex) {
      tex = grassTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(width / 9, len / 9);
    }
    const mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true });
    const light = new THREE.Color("#ffffff");
    const shade = new THREE.Color("#b9d6a6");
    for (const side of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(width, len, 26, Math.round(len / 5));
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      const col = [];
      for (let i = 0; i < pos.count; i++) {
        const d = pos.getX(i) + width / 2; // 0 at the track edge
        const z = -pos.getZ(i) + len / 2 - 120;
        const y = hillY(d, z, amp);
        pos.setXYZ(i, side * (edge + d), MEADOW_Y + y - 0.02, -z);
        // valleys a touch darker, so the hills read as hills
        const c = shade.clone().lerp(light, Math.min(1, 0.55 + y / (14 * Math.max(amp, 0.3))));
        col.push(c.r, c.g, c.b);
      }
      if (side < 0) geo.index.array.reverse(); // mirrored: keep the faces pointing up
      geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, mat));
    }
    return g;
  }
  /** Little flowers in the grass along both fences (one instanced mesh: cheap on phones). */
  function meadowFlowers(edge, r) {
    const colors = ["#ffffff", "#ffe14d", "#ff7ab8", "#ffffff", "#c58bff", "#ff9f43"].map((c) => new THREE.Color(c));
    const geo = new THREE.IcosahedronGeometry(0.11, 0);
    const n = Math.round(((TRACK_LEN + 220) / 0.55) * 2);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), n);
    mesh.frustumCulled = false; // spread along the whole track
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const at = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const z = -60 + (i >> 1) * 0.55 + r() * 0.5;
      at.set(side * (edge + 0.75 + r() * 3.2), MEADOW_Y + 0.08, -z);
      const k = 0.7 + r() * 0.7;
      sc.set(k, k * 0.6, k);
      mesh.setMatrixAt(i, m.compose(at, q, sc));
      mesh.setColorAt(i, colors[Math.floor(r() * colors.length)]);
    }
    return mesh;
  }

  // ── themed maps: everything built in code from a recipe in themes.js ──

  /** A seamless 256 px pattern for the ground or the track (cached per recipe). */
  const patternCache = new Map();
  function patternCanvas({ style, colors: C }) {
    const key = `${style}:${C.join(",")}`;
    if (patternCache.has(key)) return patternCache.get(key);
    const N = 256;
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const g = c.getContext("2d");
    let seed = 1234;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // draw something everywhere it shows when the tile repeats
    const wrapped = (fn) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
    const speckle = (n, cols, rmin, rmax, alpha = 1) => {
      for (let i = 0; i < n; i++) {
        const x = rnd() * N, y = rnd() * N, r = rmin + rnd() * (rmax - rmin);
        g.globalAlpha = alpha;
        g.fillStyle = cols[i % cols.length];
        wrapped(() => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
      }
      g.globalAlpha = 1;
    };
    g.fillStyle = C[0];
    g.fillRect(0, 0, N, N);
    if (style === "speckle") speckle(1600, [C[1], C[2] ?? C[1]], 0.6, 2.2);
    else if (style === "waves") {
      g.strokeStyle = C[1];
      g.lineWidth = 3;
      for (let y = 0; y < N; y += 16) { g.beginPath(); for (let x = 0; x <= N; x += 8) g.lineTo(x, y + Math.sin((x / N) * Math.PI * 4) * 4); g.stroke(); }
      speckle(500, [C[2] ?? C[1]], 0.5, 1.4, 0.8);
    } else if (style === "lava") {
      speckle(900, [C[2] ?? C[0]], 1, 3);
      g.shadowColor = C[1];
      g.shadowBlur = 8;
      speckle(70, [C[1]], 1.5, 4.5);
      g.shadowBlur = 0;
    } else if (style === "planks") {
      for (let y = 0; y < N; y += 32) {
        g.fillStyle = (y / 32) % 2 ? C[0] : C[1];
        g.fillRect(0, y, N, 32);
        g.fillStyle = C[2];
        g.fillRect(0, y, N, 3);
        for (let x = (y / 32) % 2 ? 40 : 110; x < N; x += 150) g.fillRect(x, y, 3, 32);
      }
      speckle(500, [C[2]], 0.5, 1.2, 0.35);
    } else if (style === "tiles") {
      for (let y = 0; y < N; y += 64) for (let x = 0; x < N; x += 64) { g.fillStyle = rnd() < 0.5 ? C[0] : C[1]; g.fillRect(x, y, 64, 64); }
      g.fillStyle = C[2];
      for (let k = 0; k < N; k += 64) { g.fillRect(k, 0, 4, N); g.fillRect(0, k, N, 4); }
      speckle(400, [C[2]], 0.5, 1.2, 0.3);
    } else if (style === "ice") {
      g.strokeStyle = C[1];
      g.globalAlpha = 0.7;
      for (let i = 0; i < 40; i++) { const x = rnd() * N, y = rnd() * N; g.lineWidth = 1 + rnd() * 2; wrapped(() => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30 + rnd() * 40, y + 10 - rnd() * 20); g.stroke(); }); }
      g.globalAlpha = 1;
      speckle(300, [C[2] ?? C[1]], 0.5, 1.3, 0.6);
    } else if (style === "grid") {
      g.strokeStyle = C[1];
      for (const [w, a] of [[9, 0.18], [3, 1]]) {
        g.lineWidth = w;
        g.globalAlpha = a;
        for (let k = 0; k <= N; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, N); g.moveTo(0, k); g.lineTo(N, k); g.stroke(); }
      }
      g.globalAlpha = 1;
    } else if (style === "bands") {
      for (let y = 0; y < N; y += 32) { g.fillStyle = (y / 32) % 2 ? C[1] : C[0]; g.fillRect(0, y, N, 32); }
    } else if (style === "rows") {
      for (let x = 0; x < N; x += 32) { g.fillStyle = (x / 32) % 2 ? C[1] : C[0]; g.fillRect(x, 0, 32, N); }
      speckle(500, [C[0], C[1]], 0.6, 1.6, 0.5);
    } else if (style === "rainbowrows") {
      for (let x = 0, i = 0; x < N; x += 16, i++) { g.fillStyle = C[i % C.length]; g.fillRect(x, 0, 16, N); }
      g.fillStyle = "#4a8a3a";
      for (let x = 12; x < N; x += 16) g.fillRect(x, 0, 4, N);
    } else if (style === "rainbow") {
      const w = N / C.length;
      C.forEach((col, i) => { g.fillStyle = col; g.fillRect(i * w, 0, w + 1, N); });
    } else if (style === "checker") {
      for (let y = 0; y < N; y += 64) for (let x = 0; x < N; x += 64) { g.fillStyle = (x + y) % 128 ? C[1] : C[0]; g.fillRect(x, y, 64, 64); }
    }
    patternCache.set(key, c);
    return c;
  }
  /** A texture of a pattern, `metres` per tile, for a surface `w` × `len` metres. */
  function patternTex(spec, metres, w, len) {
    const t = new THREE.CanvasTexture(patternCanvas(spec));
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    // the rainbow track: one band per lane, straight across
    t.repeat.set(spec.style === "rainbow" ? 1 : w / metres, len / metres);
    return t;
  }

  /** Lit windows, for buildings (the colour tints the walls). */
  const windowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = "#c8c8d0";
    g.fillRect(0, 0, 64, 64);
    for (let y = 6; y < 64; y += 14) for (let x = 6; x < 64; x += 14) { g.fillStyle = (x * 7 + y * 3) % 5 ? "#fff3b0" : "#3a3a4a"; g.fillRect(x, y, 8, 8); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 4);
    return t;
  })();

  /** Several shapes, each placed, as one geometry (positions and normals only). */
  function bake(...parts) {
    const pos = [];
    const nor = [];
    for (const [geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1] of parts) {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
      const g = (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(m);
      pos.push(...g.attributes.position.array);
      nor.push(...g.attributes.normal.array);
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    return out;
  }
  const Cyl = (rt, rb, h, n = 8) => new THREE.CylinderGeometry(rt, rb, h, n);
  const Cone = (r, h, n = 8) => new THREE.ConeGeometry(r, h, n);
  const Ball = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
  const Dome = (r) => new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const Box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
  const PI = Math.PI;
  /**
   * The scenery library: each kind is parts, each part a shape and which of the
   * recipe's colours paints it (leaf, trunk, c = main, accent; glow = always lit).
   * Shapes are about real size (metres); the recipe can scale them.
   */
  const PROP_PARTS = {
    tree: [[bake([Cyl(0.16, 0.24, 1.6, 7), 0, 0.8]), "trunk"], [bake([new THREE.IcosahedronGeometry(1.25, 1), 0, 2.5, 0, 0, 0, 0, 1, 0.95, 1]), "leaf"]],
    pine: [[bake([Cyl(0.14, 0.2, 1, 6), 0, 0.5]), "trunk"], [bake([Cone(1.15, 2.2), 0, 1.9], [Cone(0.8, 1.7), 0, 2.9]), "leaf"]],
    palm: [[bake([Cyl(0.13, 0.2, 4.4, 6), 0, 2.2, 0, 0, 0, 0.08]), "trunk"], [bake([Cone(2, 0.8, 8), 0.2, 4.6, 0, PI]), "leaf"]],
    acacia: [[bake([Cyl(0.14, 0.2, 2.4, 6), 0, 1.2]), "trunk"], [bake([Cyl(2.3, 1.6, 0.6, 9), 0, 2.7]), "leaf"]],
    cypress: [[bake([Ball(0.6, 8, 8), 0, 2.4, 0, 0, 0, 0, 1, 4, 1]), "c"]],
    cactus: [[bake([Cyl(0.32, 0.36, 2.6), 0, 1.3], [Cyl(0.17, 0.17, 0.8, 6), 0.5, 1.3, 0, 0, 0, PI / 2], [Cyl(0.17, 0.17, 0.9, 6), 0.85, 1.7], [Cyl(0.15, 0.15, 0.6, 6), -0.42, 0.9, 0, 0, 0, PI / 2], [Cyl(0.15, 0.15, 0.7, 6), -0.7, 1.2]), "c"]],
    rock: [[bake([new THREE.DodecahedronGeometry(0.9, 0), 0, 0.35, 0, 0, 0, 0, 1, 0.65, 1.1]), "c"]],
    spire: [[bake([Cyl(0.8, 1.8, 7, 7), 0, 3.5]), "c"]],
    fern: [[bake([new THREE.IcosahedronGeometry(0.8, 0), 0, 0.3, 0, 0, 0, 0, 1, 0.6, 1]), "c"]],
    deadtree: [[bake([Cyl(0.14, 0.28, 3.2, 6), 0, 1.6], [Cyl(0.06, 0.1, 1.4, 5), 0.45, 2.3, 0, 0, 0, -0.9], [Cyl(0.06, 0.1, 1.2, 5), -0.4, 2.7, 0, 0, 0, 1]), "c"]],
    mushroom: [[bake([Cyl(0.25, 0.35, 1.4), 0, 0.7]), "accent"], [bake([Dome(1.1), 0, 1.3, 0, 0, 0, 0, 1, 0.7, 1]), "c"]],
    crystal: [[bake([new THREE.OctahedronGeometry(0.6, 0), 0, 1.4, 0, 0, 0, 0, 1, 2.4, 1], [new THREE.OctahedronGeometry(0.4, 0), 0.6, 0.8, 0.2, 0, 0, 0.3, 1, 2, 1]), "c"]],
    lollipop: [[bake([Cyl(0.06, 0.06, 2.4, 6), 0, 1.2]), "accent"], [bake([Cyl(0.8, 0.8, 0.22, 20), 0, 2.8, 0, PI / 2]), "c"]],
    gumdrop: [[bake([Dome(0.75), 0, 0, 0, 0, 0, 0, 1, 1.2, 1]), "c"]],
    icecream: [[bake([Cone(0.55, 1.6, 10), 0, 0.8, 0, PI]), "accent"], [bake([Ball(0.62), 0, 1.75]), "c"]],
    iceberg: [[bake([new THREE.IcosahedronGeometry(1.3, 0), 0, 0.9, 0, 0, 0, 0, 1, 1.4, 1]), "c"]],
    snowman: [[bake([Ball(0.7), 0, 0.6], [Ball(0.5), 0, 1.55], [Ball(0.36), 0, 2.25]), "c"]],
    lamp: [[bake([Cyl(0.07, 0.09, 3.4, 6), 0, 1.7]), "c"], [bake([Ball(0.28, 8, 6), 0, 3.5]), "accent", true]],
    hut: [[bake([Cyl(1.1, 1.1, 1.5, 10), 0, 0.75]), "c"], [bake([Cone(1.6, 1.3, 10), 0, 2.15]), "accent"]],
    house: [[bake([Box(2.4, 1.8, 2.2), 0, 0.9]), "c"], [bake([Cone(2, 1.3, 4), 0, 2.45, 0, 0, PI / 4]), "accent"]],
    building: [[bake([Box(1, 1, 1), 0, 0.5]), "c", "windows"]],
    dome: [[bake([Dome(2.2)]), "c"], [bake([new THREE.TorusGeometry(1.75, 0.14, 6, 24), 0, 0.9, 0, PI / 2]), "accent", true]],
    coral: [[bake([Cone(0.35, 1.8, 6), 0, 0.9], [Cone(0.3, 1.3, 6), 0.5, 0.65, 0.2, 0, 0, -0.3], [Cone(0.28, 1.5, 6), -0.4, 0.75, -0.1, 0, 0, 0.25]), "c"]],
    seaweed: [[bake([Cone(0.18, 3, 5), 0, 1.5], [Cone(0.15, 2.4, 5), 0.3, 1.2, 0.1, 0, 0, 0.1], [Cone(0.14, 2, 5), -0.25, 1, -0.2, 0, 0, -0.12]), "c"]],
    bamboo: [[bake([Cyl(0.09, 0.09, 6, 6), 0, 3], [Cyl(0.08, 0.08, 5.4, 6), 0.4, 2.7, 0.2], [Cyl(0.09, 0.09, 6.4, 6), -0.3, 3.2, -0.3]), "c"]],
    windmill: [[bake([Cyl(0.9, 1.3, 5, 8), 0, 2.5]), "c"], [bake([Box(0.3, 5, 0.1), 0, 5, 1], [Box(5, 0.3, 0.1), 0, 5, 1]), "accent"]],
    grave: [[bake([Box(0.8, 1.1, 0.22), 0, 0.55], [Cyl(0.4, 0.4, 0.22, 10), 0, 1.1, 0, PI / 2]), "c"]],
    star: [[bake([new THREE.OctahedronGeometry(1, 0), 0, 0, 0, 0, 0, PI / 4, 1, 1, 0.35]), "c"]],
    puff: [[bake([Ball(1), 0, 0.6], [Ball(0.8), 1, 0.45, 0.2], [Ball(0.7), -0.9, 0.4, -0.1]), "c"]],
    balloon: [[bake([Ball(1.1, 12, 10), 0, 0, 0, 0, 0, 0, 1, 1.15, 1]), "c"], [bake([Cyl(0.02, 0.02, 3, 4), 0, -2.6]), "accent"]],
    island: [[bake([Cone(2.4, 3.2, 8), 0, -1.6, 0, PI]), "c"], [bake([Cyl(2.45, 2.45, 0.5, 10), 0, 0.25]), "accent"]],
    pyramid: [[bake([Cone(3, 3.2, 4), 0, 1.6, 0, 0, PI / 4]), "c"]],
    column: [[bake([Cyl(0.4, 0.45, 3.6, 10), 0, 1.8], [Box(1.1, 0.3, 1.1), 0, 3.75], [Box(1.1, 0.3, 1.1), 0, 0.15]), "c"]],
    barrel: [[bake([Cyl(0.45, 0.45, 1, 10), 0, 0.5]), "c"], [bake([Cyl(0.47, 0.47, 0.08, 10), 0, 0.2], [Cyl(0.47, 0.47, 0.08, 10), 0, 0.8]), "accent"]],
    pillar: [[bake([Box(0.5, 7, 0.5), 0, 3.5]), "c"]],
    block: [[bake([Box(1.4, 1.4, 1.4), 0, 0.7]), "c"]],
    torii: [[bake([Cyl(0.18, 0.2, 4, 8), -1.6, 2], [Cyl(0.18, 0.2, 4, 8), 1.6, 2], [Box(4.6, 0.32, 0.4), 0, 4.05], [Box(3.8, 0.22, 0.28), 0, 3.35]), "c"]],
    flag: [[bake([Cyl(0.04, 0.04, 3, 5), 0, 1.5]), "c"], [bake([Box(0.9, 0.6, 0.04), 0.45, 2.7]), "accent"]],
    giantflower: [[bake([Cyl(0.08, 0.1, 2.4, 5), 0, 1.2]), "accent"], [bake([Ball(0.65), 0, 2.5, 0, 0, 0, 0, 1, 0.5, 1]), "c"]],
    pumpkin: [[bake([Ball(0.8, 10, 8), 0, 0.55, 0, 0, 0, 0, 1, 0.7, 1]), "c"], [bake([Cyl(0.06, 0.08, 0.3, 5), 0, 1.15]), "accent"]],
  };
  /** Where a kind goes: [nearest, furthest] metres from the kerb, and how high it floats. */
  const PROP_PLACE = {
    building: { d: [9, 40] }, pyramid: { d: [18, 70] }, spire: { d: [10, 50] }, dome: { d: [8, 35] }, windmill: { d: [10, 40] },
    house: { d: [7, 30] }, hut: { d: [5, 25] }, torii: { d: [3, 5] }, column: { d: [3, 25] }, iceberg: { d: [4, 40] },
    island: { d: [10, 50], fly: [6, 14] }, balloon: { d: [4, 40], fly: [8, 18] }, star: { d: [4, 40], fly: [5, 14] },
  };
  /** Build a themed map's track and scenery into `group`. */
  function buildThemed(theme, group, r, edge) {
    const len = TRACK_LEN + 220;
    const tc = theme.track.colors;
    group.add(runningTrack(patternTex(theme.track, 3, TRACK_W, len), new THREE.Color(tc[2] ?? tc[0]).multiplyScalar(0.75), theme.track.kerb));
    group.add(meadowHills(edge, patternTex(theme.ground, 6, 130, TRACK_LEN + 400), theme.hills));
    // scatter the recipe's props, weighted, both sides
    const kinds = theme.props.map(([kind, w, colors, scale, glow]) => ({ kind, w, colors, scale: scale ?? [0.8, 1.3], glow: Boolean(glow), items: [] }));
    const total = kinds.reduce((a, k) => a + k.w, 0);
    const pick = () => {
      let x = r() * total;
      for (const k of kinds) if ((x -= k.w) < 0) return k;
      return kinds[0];
    };
    for (let z = -60; z < TRACK_LEN + 160; z += 3.5 + r() * 4) {
      for (const side of [-1, 1]) {
        if (r() < 0.12) continue;
        const k = pick();
        const place = PROP_PLACE[k.kind] ?? { d: [2.5, 30] };
        const d = place.d[0] + r() * (place.d[1] - place.d[0]);
        const s = k.scale[0] + r() * (k.scale[1] - k.scale[0]);
        const y = MEADOW_Y + hillY(d, z, theme.hills) + (place.fly ? place.fly[0] + r() * (place.fly[1] - place.fly[0]) : 0);
        // buildings get their own proportions
        const sc = k.kind === "building" ? [5 + r() * 5, (8 + r() * 26) * s, 5 + r() * 5] : [s, s, s];
        k.items.push({ x: side * (edge + d), y, z, rot: k.kind === "torii" ? 0 : r() * PI * 2, sc, pick: r() });
      }
    }
    // lamp posts along both kerbs when the recipe has lamps
    const lamp = kinds.find((k) => k.kind === "lamp");
    if (lamp) for (let z = -40; z < TRACK_LEN + 140; z += 18) for (const side of [-1, 1]) lamp.items.push({ x: side * (edge + 1.3), y: MEADOW_Y + 0.9, z, rot: 0, sc: [1, 1, 1], pick: r() });
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const sv = new THREE.Vector3();
    for (const k of kinds) {
      if (!k.items.length) continue;
      for (const [geo, key, special] of PROP_PARTS[k.kind]) {
        const cols = (k.colors[key] ?? k.colors.c ?? k.colors.leaf ?? ["#ffffff"]).map((c) => new THREE.Color(c));
        const lit = special === true || (k.glow && key !== "trunk");
        const mat =
          special === "windows"
            ? lit
              ? new THREE.MeshBasicMaterial({ map: windowTex })
              : new THREE.MeshLambertMaterial({ map: windowTex })
            : lit
              ? new THREE.MeshBasicMaterial({ toneMapped: false })
              : new THREE.MeshLambertMaterial();
        // the window texture needs UVs: the building is a plain box
        const g = special === "windows" ? new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0) : geo;
        const inst = new THREE.InstancedMesh(g, mat, k.items.length);
        inst.frustumCulled = false;
        k.items.forEach((it, i) => {
          inst.setMatrixAt(i, m.compose(v.set(it.x, it.y, -it.z), q.setFromEuler(e.set(0, it.rot, 0)), sv.set(...it.sc)));
          inst.setColorAt(i, cols[Math.floor(it.pick * cols.length) % cols.length]);
        });
        group.add(inst);
      }
    }
    // neon arches over the track
    if (theme.arches) {
      const zs = [];
      for (let z = 20; z < TRACK_LEN + 140; z += 45) zs.push(z);
      const arch = new THREE.InstancedMesh(new THREE.TorusGeometry(TRACK_W / 2 + 0.7, 0.16, 6, 28, PI), new THREE.MeshBasicMaterial({ toneMapped: false }), zs.length);
      arch.frustumCulled = false;
      zs.forEach((z, i) => {
        arch.setMatrixAt(i, m.compose(v.set(0, 0, -z), q.identity(), sv.set(1, 1, 1)));
        arch.setColorAt(i, new THREE.Color(theme.arches[i % theme.arches.length]));
      });
      group.add(arch);
    }
  }

  // ── weather: snow, petals, leaves, fireflies, embers, bubbles or dust round the camera ──
  const FX = {
    snow: { color: "#ffffff", size: 0.35, v: [0, -1.6, 0], sway: 0.6 },
    petals: { color: "#ffb8d4", size: 0.3, v: [0.6, -0.9, 0], sway: 1 },
    leaves: { color: "#f0902a", size: 0.38, v: [0.8, -1.1, 0], sway: 1.2 },
    fireflies: { color: "#d8ff7a", size: 0.28, v: [0, 0.1, 0], sway: 0.8, add: true },
    embers: { color: "#ff8a2a", size: 0.26, v: [0.2, 1.6, 0], sway: 0.5, add: true },
    bubbles: { color: "#bff0ff", size: 0.32, v: [0, 1.3, 0], sway: 0.5 },
    dust: { color: "#f0d8a8", size: 0.18, v: [1.4, 0.05, 0], sway: 0.3 },
  };
  const fxGroup = new THREE.Group();
  scene.add(fxGroup);
  let weather = null; // { points, spec, t }
  const FX_N = 380;
  function setWeather(kind) {
    if (weather) {
      fxGroup.remove(weather.points);
      weather.points.geometry.dispose();
      weather.points.material.dispose();
      weather = null;
    }
    const spec = FX[kind];
    if (!spec) return;
    const pos = new Float32Array(FX_N * 3);
    for (let i = 0; i < FX_N; i++) pos.set([(Math.random() - 0.5) * 50, Math.random() * 18, -Math.random() * 75 + 5], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ map: fxDot(), color: spec.color, size: spec.size, transparent: true, depthWrite: false, blending: spec.add ? THREE.AdditiveBlending : THREE.NormalBlending }));
    points.frustumCulled = false;
    fxGroup.add(points);
    weather = { points, spec, t: 0 };
  }
  let fxDotTex = null;
  function fxDot() {
    if (fxDotTex) return fxDotTex;
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(16, 16, 1, 16, 16, 16);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.5, "rgba(255,255,255,0.8)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    return (fxDotTex = new THREE.CanvasTexture(c));
  }
  function stepWeather(dt, camZ) {
    fxGroup.position.z = camZ;
    if (!weather) return;
    weather.t += dt;
    const { spec } = weather;
    const p = weather.points.geometry.attributes.position;
    const a = p.array;
    for (let i = 0; i < FX_N; i++) {
      const k = i * 3;
      a[k] += (spec.v[0] + Math.sin(weather.t * 1.3 + i) * spec.sway) * dt;
      a[k + 1] += (spec.v[1] + Math.cos(weather.t * 0.9 + i * 0.7) * spec.sway * 0.3) * dt;
      // wrap round the box the camera sits in
      if (a[k + 1] < 0) a[k + 1] += 18;
      else if (a[k + 1] > 18) a[k + 1] -= 18;
      if (a[k] > 25) a[k] -= 50;
      else if (a[k] < -25) a[k] += 50;
    }
    p.needsUpdate = true;
  }

  function buildMap(map) {
    const group = new THREE.Group();
    const cull = [];
    let s = 12345 + map.length * 7919;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const P = assets.props;
    const add = (proto, x, y, z, scale, rotY) => {
      const o = proto.clone();
      o.scale.multiplyScalar(scale);
      o.rotation.y = rotY;
      o.position.set(x, y, -z);
      group.add(o);
      cull.push({ obj: o, z, keep: true, wide: true });
      return o;
    };
    const built = BUILT_MAPS.has(map);
    const theme = THEME[map];
    if (map === "meadow") group.add(runningTrack());
    else if (!theme) {
      const tile = built ? P[`${map}Tile`] : map === "farm" ? P.farmTile : map === "beach" ? P.boardTile : P.ground;
      const step = tile.userData.length * 0.97;
      for (let z = -60; z < TRACK_LEN + 160; z += step) add(tile, 0, 0, z, 1, 0);
    }
    flatTrack.visible = false;
    // the built maps bring their own edges (barriers, ad boards, neon rails)
    if (!built && !theme) {
      for (let z = -40; z < TRACK_LEN + 120; z += 2.9) {
        // on the meadow the fence stands on the white kerb
        for (const side of [-1, 1]) map === "meadow" ? add(P.fence, side * (TRACK_W / 2 + 0.22), 0.12, z, 1, Math.PI / 2) : add(P.fence, side * (TRACK_W / 2 - 0.1), 0, z, 1, Math.PI / 2);
      }
    }
    const edge = TRACK_W / 2;
    if (map === "city") buildCity(add, group, r, edge);
    else if (map === "stadium") buildStadium(add, group, r, edge);
    else if (map === "space") buildSpace(add, group, r, edge);
    else if (theme) buildThemed(theme, group, r, edge);

    if (map === "meadow") {
      // rolling hills either side, a strip of flowers along the fence, then trees, bushes and the odd rock
      group.add(meadowHills(edge), meadowFlowers(edge, r));
      const trees = [P.oak, P.pine, P.blossom];
      for (let z = -60; z < TRACK_LEN + 160; z += 5 + r() * 5) {
        for (const side of [-1, 1]) {
          const roll = r();
          const x = side * (edge + 2.5 + r() * 26);
          if (roll < 0.55) add(trees[Math.floor(r() * 3)], x, MEADOW_Y + hillY(Math.abs(x) - edge, z), z, 0.8 + r() * 0.5, r() * Math.PI * 2);
          else if (roll < 0.85) add(P.bush, side * (edge + 1.6 + r() * 10), MEADOW_Y, z, 0.7 + r() * 0.6, r() * Math.PI * 2);
          // a bush hugging the fence every few metres keeps the meadow edge lively; rocks only now and then, further out
          const extra = r();
          if (extra < 0.55) add(P.bush, side * (edge + 1.0 + r() * 1.5), MEADOW_Y, z + r() * 4, 0.5 + r() * 0.4, r() * Math.PI * 2);
          else if (extra < 0.7) {
            const d = 8 + r() * 14;
            add(P.rocks, side * (edge + d), MEADOW_Y + hillY(d, z), z, 0.6 + r() * 0.6, r() * Math.PI * 2);
          }
        }
      }
    } else if (map === "farm") {
      // wheat right up to the fences, sunflowers along them, a farmyard further out
      // (big blocks, few of them: keeps the polygon count phone-friendly)
      for (let z = -60; z < TRACK_LEN + 160; z += 6.6) {
        for (const side of [-1, 1]) {
          for (let k = 0; k < 2; k++) add(P.wheat, side * (edge + 4.6 + k * 6.6), MEADOW_Y, z + r() * 0.6, 1.0 + r() * 0.1, Math.floor(r() * 4) * (Math.PI / 2));
          if (r() < 0.22) add(P.sunflowers, side * (edge + 1.0), MEADOW_Y, z + r() * 3, 0.8 + r() * 0.4, r() * Math.PI * 2);
        }
      }
      let side = 1;
      for (let z = -20; z < TRACK_LEN + 160; z += 34 + r() * 30) {
        side = -side;
        const roll = r();
        if (roll < 0.35) add(P.barn, side * (edge + 22 + r() * 12), MEADOW_Y, z, 1, side > 0 ? -Math.PI / 2 : Math.PI / 2);
        else if (roll < 0.6) add(P.windmill, side * (edge + 26 + r() * 18), MEADOW_Y, z, 1, r() * Math.PI * 2);
        else if (roll < 0.8) add(P.tractor, side * (edge + 16 + r() * 6), MEADOW_Y, z, 1, r() * Math.PI * 2);
        else add(P.oak, side * (edge + 18 + r() * 20), MEADOW_Y, z, 0.9 + r() * 0.4, r() * Math.PI * 2);
      }
    } else if (map === "beach") {
      // the sea on the left, the sand and its huts on the right
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(500, TRACK_LEN + 1200), new THREE.MeshPhongMaterial({ color: "#21b5e8", emissive: "#0b5d8a", emissiveIntensity: 0.25, shininess: 120, specular: "#ffffff" }));
      sea.rotation.x = -Math.PI / 2;
      sea.position.set(-edge - 26 - 250, MEADOW_Y + 0.15, -TRACK_LEN / 2);
      group.add(sea);
      const foam = new THREE.Mesh(new THREE.PlaneGeometry(2.2, TRACK_LEN + 1200), new THREE.MeshBasicMaterial({ color: "#eafcff", transparent: true, opacity: 0.85 }));
      foam.rotation.x = -Math.PI / 2;
      foam.position.set(-edge - 26, MEADOW_Y + 0.2, -TRACK_LEN / 2);
      group.add(foam);
      group.userData.sea = sea;
      for (let z = -60; z < TRACK_LEN + 160; z += 7 + r() * 7) {
        // left: palms by the rail, umbrellas on the sand
        if (r() < 0.7) add(P.palm, -(edge + 2 + r() * 4), MEADOW_Y, z, 0.85 + r() * 0.35, r() * Math.PI * 2);
        if (r() < 0.5) add(P.umbrella, -(edge + 9 + r() * 12), MEADOW_Y, z + r() * 3, 0.9 + r() * 0.2, r() * Math.PI * 2);
        // right: palms, huts in a row, the odd rock
        if (r() < 0.6) add(P.palm, edge + 2 + r() * 6, MEADOW_Y, z, 0.85 + r() * 0.35, r() * Math.PI * 2);
        if (r() < 0.35) add(P.hut, edge + 14 + r() * 8, MEADOW_Y, z, 1, -Math.PI / 2 + (r() - 0.5) * 0.4);
        else if (r() < 0.3) add(P.rocks, edge + 10 + r() * 20, MEADOW_Y, z, 0.6 + r() * 0.8, r() * Math.PI * 2);
      }
      // lighthouses out on the rocks
      for (let z = 80; z < TRACK_LEN + 160; z += 260) add(P.lighthouse, -(edge + 55 + r() * 20), MEADOW_Y, z, 1, r() * Math.PI * 2);
    }
    scene.add(group);
    return { group, cull };
  }

  function buildShared() {
    sharedBuilt = true;
    const P = assets.props;
    let s = 4242;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);

    // Higgsfield start and finish gates
    if (P.startGate) {
      const g = P.startGate.clone();
      g.position.set(0, 0, 0); // right on the start line
      scene.add(g);
    }
    if (P.finishGate) {
      const g = P.finishGate.clone();
      g.position.set(0, 0, -TRACK_LEN);
      finishGroup.add(g);
      fallbackArch.visible = false;
    }

    // 3D clouds drifting in the sky; the group follows the camera
    for (let i = 0; i < 16; i++) {
      const c = P.cloud.clone();
      c.scale.multiplyScalar(14 + r() * 22);
      c.position.set((r() - 0.5) * 320, 38 + r() * 40, -40 - r() * 230);
      c.rotation.y = (r() - 0.5) * 0.6;
      // unlit, so the clouds stay bright white instead of picking up grey shading
      c.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ map: o.material.map, color: "#ffffff", fog: false }); });
      c.userData.drift = 0.6 + r() * 1.2;
      clouds.add(c);
    }
  }

  // ── particles: box pickups, fireworks, confetti ──
  const particles = []; // {points, vel, life, max, gravity, drag}
  const dotTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.4, "rgba(255,255,255,0.8)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  })();
  function spray(x, y, z, colors, n, { speed = 6, life = 1, gravity = 9, size = 0.35, drag = 1.2, up = 0 } = {}) {
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      pos.set([x, y, z], i * 3);
      // random direction on a sphere
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const v = speed * (0.6 + Math.random() * 0.4);
      vel.set([r * Math.cos(a) * v, u * v + up, r * Math.sin(a) * v], i * 3);
      c.set(colors[i % colors.length]);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    particles.push({ points, vel, life, max: life, gravity, drag });
  }
  /** A pickup: a quick sparkle pop where the box was. */
  function burst(x, y, z, colors, n = 60) {
    spray(x, y, z, colors, n, { speed: 5, life: 0.7, gravity: 4, size: 0.28 });
  }
  const FW_COLORS = [["#ff4d6d", "#ffd84a"], ["#4dd2ff", "#ffffff"], ["#b6f72a", "#ffe14d"], ["#c77dff", "#ff7bd5"], ["#ff9f1c", "#ffffff"]];
  /** Fireworks over a spot on the track (z), plus a shower of confetti. */
  function fireworks(z) {
    for (let i = 0; i < 14; i++) {
      setTimeout(() => {
        const x = (Math.random() - 0.5) * 16;
        const y = 9 + Math.random() * 7;
        const zz = z - 2 - Math.random() * 10;
        spray(x, y, zz, FW_COLORS[i % FW_COLORS.length], 110, { speed: 9, life: 1.6, gravity: 3, size: 0.55, drag: 1.6 });
        sfx.pop();
      }, i * 260 + Math.random() * 120);
    }
    const confetti = ["#ff4d6d", "#ffd84a", "#4dd2ff", "#b6f72a", "#c77dff", "#ffffff"];
    for (const side of [-1, 1]) spray(side * 5.5, 6, z, confetti, 160, { speed: 6, life: 3, gravity: 3.5, size: 0.3, drag: 0.7, up: 4 });
  }
  function stepParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        scene.remove(p.points);
        p.points.geometry.dispose();
        p.points.material.dispose();
        particles.splice(i, 1);
        continue;
      }
      const pos = p.points.geometry.attributes.position;
      const a = pos.array;
      const k = Math.exp(-p.drag * dt);
      for (let j = 0; j < a.length; j += 3) {
        p.vel[j] *= k;
        p.vel[j + 2] *= k;
        p.vel[j + 1] = p.vel[j + 1] * k - p.gravity * dt;
        a[j] += p.vel[j] * dt;
        a[j + 1] += p.vel[j + 1] * dt;
        a[j + 2] += p.vel[j + 2] * dt;
      }
      pos.needsUpdate = true;
      p.points.material.opacity = Math.min(1, (p.life / p.max) * 2);
    }
  }

  function tick(camZ, dt) {
    stepParticles(dt);
    stepWeather(dt, camZ);
    skyGroup.position.z = camZ;
    clouds.position.z = camZ;
    for (const g of Object.values(mapSkies)) g.position.z = camZ;
    for (const c of clouds.children) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 170) c.position.x = -170;
    }
  }

  function buildCourseObjects(seed, len, boost = 0) {
    clearCourse();
    const course = buildCourse(seed, len, boost);
    rollers = [];
    boxes = [];
    hearts = [];
    for (const h of course.hearts || []) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex("❤️"), depthWrite: false }));
      spr.scale.set(1.1, 1.1, 1);
      spr.position.set(laneX(h.lane), 1.2, -h.z);
      raceGroup.add(spr);
      const heart = { obj: spr, lane: h.lane, z: h.z, idx: hearts.length, taken: false };
      hearts.push(heart);
      cullables.push({ obj: spr, z: h.z, box: heart });
    }
    for (const row of course.rows) {
      row.lanes.forEach((kind, lane) => {
        if (!kind) return;
        let look = row.looks?.[lane] ?? 0;
        // no cows or hay bales in the city, the stadium or space
        if (BUILT_MAPS.has(activeMap) && look === 1 && (kind === "crate" || kind === "hurdle")) look = 0;
        const proto = assets.props[`${kind}${look}`] || assets.props[`${kind}0`];
        const o = proto.clone();
        o.position.set(laneX(lane), 0, -row.z);
        if (kind === "crate") o.rotation.y = ((row.z * 7 + lane) % 3 - 1) * 0.12 + (look === 1 ? (lane < 2 ? 0.5 : -0.5) : 0);
        if (kind === "roller") {
          // the barrel rolls on a pivot at its centre
          const pivotY = 0.5;
          const holder = new THREE.Group();
          o.position.set(0, -pivotY, 0);
          holder.add(o);
          holder.position.set(laneX(lane), pivotY, -row.z);
          raceGroup.add(holder);
          rollers.push({ obj: holder, lane, z0: row.z, z: row.z, startedAt: null });
          return;
        }
        raceGroup.add(o);
        cullables.push({ obj: o, z: row.z });
      });
    }
    for (const b of course.boxes || []) {
      const o = assets.props.box.clone();
      const holder = new THREE.Group();
      o.position.y = -0.45;
      holder.add(o);
      holder.position.set(laneX(b.lane), 1.0, -b.z);
      raceGroup.add(holder);
      boxes.push({ obj: holder, lane: b.lane, z: b.z, taken: false, idx: boxes.length });
      cullables.push({ obj: holder, z: b.z, box: boxes[boxes.length - 1] });
    }
    for (const b of course.boosts) {
      let pad;
      if (assets.props.boostPad) {
        // Higgsfield 3D pad, arrows pointing down the track
        pad = assets.props.boostPad.clone();
        pad.position.set(laneX(b.lane), 0.02, -b.z);
      } else {
        pad = new THREE.Mesh(
          new THREE.PlaneGeometry(1.5, 2.6),
          new THREE.MeshBasicMaterial({ map: padTex, transparent: true, opacity: 0.95 }),
        );
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(laneX(b.lane), 0.075, -b.z);
      }
      raceGroup.add(pad);
      cullables.push({ obj: pad, z: b.z });
    }
    // red slow pads: the boost pad turned round (arrows pointing back) and painted red
    for (const b of course.slows ?? []) {
      let pad;
      if (assets.props.boostPad) {
        pad = assets.props.boostPad.clone();
        pad.traverse((o) => {
          if (o.isMesh) o.material = slowPadMat(o.material);
        });
        pad.rotation.y = Math.PI;
        pad.position.set(laneX(b.lane), 0.02, -b.z);
      } else {
        pad = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.6), new THREE.MeshBasicMaterial({ map: padTex, color: "#ff3b3b", transparent: true, opacity: 0.95 }));
        pad.rotation.set(-Math.PI / 2, 0, Math.PI);
        pad.position.set(laneX(b.lane), 0.075, -b.z);
      }
      raceGroup.add(pad);
      cullables.push({ obj: pad, z: b.z });
    }
    return course;
  }

  const slowMats = new Map();
  /** The boost pad's material, recoloured red for a slow pad (made once per source material). */
  function slowPadMat(m) {
    if (Array.isArray(m)) return m.map(slowPadMat);
    if (!slowMats.has(m)) {
      const c = m.clone();
      if (c.color) c.color.set("#ff4a3d");
      if (c.emissive) {
        c.emissive.set("#a01010");
        c.emissiveIntensity = 0.6;
      }
      slowMats.set(m, c);
    }
    return slowMats.get(m);
  }
  // thrown bananas: they drop out of the sky onto their lane, and vanish once someone slips
  const bananaMeshes = new Map(); // id -> {obj, born}
  function syncBananas(list, gone) {
    const live = new Set();
    const now = performance.now();
    for (const b of list) {
      if (gone.has(b.id)) continue;
      live.add(b.id);
      let m = bananaMeshes.get(b.id);
      if (!m) {
        let obj;
        if (b.kind === "glue") {
          // a sticky green puddle across two lanes
          obj = new THREE.Mesh(glueGeo, new THREE.MeshBasicMaterial({ color: 0x5ee05e, transparent: true, opacity: 0.85 }));
          obj.rotation.x = -Math.PI / 2;
          obj.scale.set((laneX(1) - laneX(0)) * 1.15, 1.7, 1);
          obj.position.set((laneX(b.lane) + laneX(glueLane2(b.lane))) / 2, 0.04, -b.d);
        } else if (b.kind === "fake" && assets.props.box) {
          // looks just like a real mystery box (a slightly redder glow gives it away to sharp eyes)
          obj = new THREE.Group();
          const o = assets.props.box.clone();
          o.position.y = -0.45;
          obj.add(o);
          obj.position.set(laneX(b.lane), 3, -b.d);
        } else {
          obj = assets.props.banana.clone();
          obj.position.set(laneX(b.lane), 3, -b.d);
        }
        raceGroup.add(obj);
        m = { obj, born: now, kind: b.kind };
        bananaMeshes.set(b.id, m);
      }
      const age = (now - m.born) / 1000;
      if (m.kind === "glue") {
        m.obj.material.opacity = 0.85 * Math.min(1, age * 4);
        continue;
      }
      const restY = m.kind === "fake" ? 1.0 : 0.02;
      m.obj.position.y = Math.max(restY, 3 * (1 - (age / 0.45) ** 2));
      m.obj.rotation.y = age < 0.45 || m.kind === "fake" ? age * (m.kind === "fake" ? 1.5 : 14) : m.obj.rotation.y;
    }
    for (const [id, m] of bananaMeshes) {
      if (live.has(id)) continue;
      raceGroup.remove(m.obj);
      bananaMeshes.delete(id);
    }
  }

  // ── cosmetic trails: one pooled particle cloud for every runner's trail ──
  const TRAIL_N = 900;
  const trailPos = new Float32Array(TRAIL_N * 3);
  const trailCol = new Float32Array(TRAIL_N * 3);
  const trailBase = new Float32Array(TRAIL_N * 3);
  const trailAge = new Float32Array(TRAIL_N).fill(9);
  let trailHead = 0;
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute("color", new THREE.BufferAttribute(trailCol, 3));
  const trailPts = new THREE.Points(trailGeo, new THREE.PointsMaterial({ size: 0.32, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  trailPts.frustumCulled = false;
  scene.add(trailPts);
  const trailColor = new THREE.Color();
  function trail(kind, x, y, z) {
    const info = TRAIL_INFO[kind];
    if (!info) return;
    for (let n = 0; n < 2; n++) {
      const i = trailHead;
      trailHead = (trailHead + 1) % TRAIL_N;
      const k = performance.now() / 1000;
      if (kind === "rainbow") trailColor.setHSL((k * 0.6 + n * 0.1) % 1, 1, 0.55);
      else trailColor.set(info.colors[Math.floor(Math.random() * info.colors.length)]);
      trailPos.set([x + (Math.random() - 0.5) * 0.5, y + 0.15 + Math.random() * 0.5, z + 0.3 + Math.random() * 0.3], i * 3);
      trailBase.set([trailColor.r, trailColor.g, trailColor.b], i * 3);
      trailAge[i] = 0;
    }
  }
  function stepTrails(dt) {
    for (let i = 0; i < TRAIL_N; i++) {
      if (trailAge[i] > 1) {
        trailCol[i * 3] = trailCol[i * 3 + 1] = trailCol[i * 3 + 2] = 0;
        continue;
      }
      trailAge[i] += dt / 0.7;
      const f = Math.max(0, 1 - trailAge[i]);
      trailCol[i * 3] = trailBase[i * 3] * f;
      trailCol[i * 3 + 1] = trailBase[i * 3 + 1] * f;
      trailCol[i * 3 + 2] = trailBase[i * 3 + 2] * f;
      trailPos[i * 3 + 1] += dt * 0.6;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;
  }
  // ── moving obstacles: they sweep across the lanes on the race clock ──
  let moverList = [];
  const MOVER_MODEL = {
    log: { file: "mlog", size: 1.7, emoji: "🪵", y: 0 },
    bees: { file: null, size: 1, emoji: "🐝", y: 1.5 },
    tractor: { file: "tractor", size: 2.6, emoji: "🚜", y: 0 },
    chicken: { file: "chicken", size: 0.85, emoji: "🐔", y: 0 },
    wave: { file: null, size: 1, emoji: "🌊", y: 0 },
    crab: { file: "crab", size: 0.85, emoji: "🦀", y: 0 },
    taxi: { file: "taxi", size: 2.6, emoji: "🚕", y: 0 },
    pigeons: { file: "pigeon", size: 1, emoji: "🐦", y: 1.45 },
    football: { file: "football", size: 0.8, emoji: "⚽", y: 0 },
    spidercam: { file: "spidercam", size: 1.1, emoji: "🎥", y: 1.45 },
    asteroid: { file: "asteroid", size: 0.9, emoji: "☄️", y: 0 },
    ufo: { file: "ufo", size: 2.4, emoji: "🛸", y: 2.6 },
  };
  // the UFO's tractor beam (the model comes from sp_ufo.glb)
  function ufoBeam() {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.0, 2.6, 20, 1, true), new THREE.MeshBasicMaterial({ color: "#7cf7c8", transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 1.3;
    return beam;
  }
  function emojiSprite(e, size) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(e), transparent: true }));
    spr.scale.set(size, size, 1);
    return spr;
  }
  // shared by every wave on the course (built once, never per race)
  const waveGeo = new THREE.CylinderGeometry(1.1, 1.1, LANE_W * 2.1, 24, 1, false, 0, Math.PI);
  const waveMat = new THREE.MeshStandardMaterial({ color: 0x2fa8ff, transparent: true, opacity: 0.78, roughness: 0.2 });
  const foamGeo = new THREE.BoxGeometry(LANE_W * 2.1, 0.22, 0.6);
  const foamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  const glueGeo = new THREE.CircleGeometry(1, 28);
  function makeWave() {
    const g = new THREE.Group();
    const water = new THREE.Mesh(waveGeo, waveMat);
    water.rotation.z = Math.PI / 2;
    water.rotation.y = Math.PI / 2;
    g.add(water);
    const foam = new THREE.Mesh(foamGeo, foamMat);
    foam.position.y = 1.12;
    g.add(foam);
    return g;
  }
  function makeBees() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const b = emojiSprite("🐝", 0.55);
      b.userData.k = i * 1.7;
      g.add(b);
    }
    return g;
  }
  function setupMovers(course, seed, map) {
    for (const m of moverList) raceGroup.remove(m.obj);
    moverList = moversFor(course, seed, map).map((m) => {
      const spec = MOVER_MODEL[m.kind];
      const holder = new THREE.Group();
      let body;
      if (m.kind === "wave") body = makeWave();
      else if (m.kind === "bees") body = makeBees();
      else {
        body = emojiSprite(spec.emoji, spec.size * 1.2);
        body.position.y = spec.size * 0.6;
        loadModeProp(spec.file, { width: spec.size, maxHeight: spec.size * 1.5 }).then((model) => {
          if (!model) return;
          holder.remove(body);
          const inner = sizeTo(model.clone(), spec.size);
          // the log lies along the track and rolls sideways
          if (m.kind === "log") inner.rotation.y = Math.PI / 2;
          holder.add(inner);
          holder.userData.model = inner;
          if (m.kind === "ufo") {
            const beam = ufoBeam();
            beam.position.y = -MOVER_MODEL.ufo.y + 1.3; // from the saucer down to the track
            holder.add(beam);
          }
        });
      }
      holder.add(body);
      holder.position.set(0, spec.y, -m.z);
      raceGroup.add(holder);
      const entry = { ...m, obj: holder };
      cullables.push({ obj: holder, z: m.z });
      return entry;
    });
  }
  function syncMovers(raceT) {
    const k = performance.now() / 1000;
    for (const m of moverList) {
      if (!m.obj.visible) continue;
      const x = moverX(m, raceT);
      const dir = Math.sign(moverX(m, raceT + 0.05) - x) || 1;
      m.obj.position.x = laneX(x);
      const model = m.obj.userData.model;
      if (m.kind === "log" && model) model.rotation.x = -x * 2.2; // rolls as it goes
      else if ((m.kind === "tractor" || m.kind === "chicken") && model) model.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (m.kind === "chicken" || m.kind === "crab") m.obj.position.y = Math.abs(Math.sin(k * 12 + m.z)) * 0.12;
      if (m.kind === "taxi" && model) model.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (m.kind === "ufo" && model) model.rotation.y = k * 2;
      if (m.kind === "asteroid" && model) model.rotation.y = k * 1.5;
      if (m.kind === "football") m.obj.position.y = Math.abs(Math.sin(k * 6 + m.z)) * 0.35;
      if (m.kind === "pigeons" || m.kind === "spidercam") m.obj.position.y = MOVER_MODEL[m.kind].y + Math.sin(k * 5 + m.z) * 0.12;
      if (m.kind === "bees") {
        for (const b of m.obj.children[0].children) {
          const q = k * 6 + b.userData.k;
          b.position.set(Math.sin(q) * 0.45, Math.cos(q * 1.3) * 0.25, Math.sin(q * 0.7) * 0.3);
        }
      }
      if (m.kind === "wave") m.obj.scale.y = 0.9 + Math.sin(k * 4 + m.z) * 0.1;
    }
  }

  // ── mode objects: the giant brain, coins, the bomb, explosions ──
  let modeKind = "";
  let brainObj = null;
  let bombObj = null;
  let bombHop = { holder: null, from: null, t0: 0 }; // the bomb hops over when it changes hands
  const blastFx = []; // flashes and shockwave rings from explosions
  let coinList = [];
  let looseMeshes = new Map();
  const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.14, 24);
  // the Higgsfield "4" coin on both faces, a gold rim round the edge
  const coinFace = texLoader.load("/assets/coin_face.jpg");
  coinFace.colorSpace = THREE.SRGBColorSpace;
  const coinRim = new THREE.MeshStandardMaterial({ color: 0xffc928, metalness: 0.2, roughness: 0.35, emissive: 0xb07a00, emissiveIntensity: 0.55 });
  const coinFaceMat = new THREE.MeshStandardMaterial({ map: coinFace, metalness: 0.1, roughness: 0.4, emissive: 0x6a4400, emissiveIntensity: 0.45 });
  const bigRim = new THREE.MeshStandardMaterial({ color: 0xff9f1c, metalness: 0.2, roughness: 0.3, emissive: 0xc05000, emissiveIntensity: 0.6 });
  const bigFaceMat = new THREE.MeshStandardMaterial({ map: coinFace, color: 0xffb46a, metalness: 0.1, roughness: 0.35, emissive: 0x8a3a00, emissiveIntensity: 0.5 });
  const coinMat = [coinRim, coinFaceMat, coinFaceMat];
  const bigCoinMat = [bigRim, bigFaceMat, bigFaceMat];
  function makeCoin(big) {
    const m = new THREE.Mesh(coinGeo, big ? bigCoinMat : coinMat);
    m.rotation.x = Math.PI / 2;
    const g = new THREE.Group();
    g.add(m);
    if (big) g.scale.setScalar(1.5);
    return g;
  }
  /** Scale an object so its biggest side is `size` metres, sitting on y = 0. */
  function sizeTo(obj, size) {
    const box = new THREE.Box3().setFromObject(obj);
    const v = box.getSize(new THREE.Vector3());
    const k = size / Math.max(v.x, v.y, v.z, 1e-3);
    obj.scale.multiplyScalar(k);
    const b2 = new THREE.Box3().setFromObject(obj);
    const c = b2.getCenter(new THREE.Vector3());
    obj.position.x -= c.x;
    obj.position.z -= c.z;
    obj.position.y -= b2.min.y;
    return obj;
  }
  const propLoads = {};
  function loadModeProp(name, size) {
    if (!propLoads[name]) {
      assets.props[name] = null;
      propLoads[name] = loadGLB(`/assets/${name}.glb`)
        .then((g) => (assets.props[name] = fitProp(g.scene, size)))
        .catch(() => (assets.props[name] = null));
    }
    return propLoads[name];
  }
  /** Download a map's moving obstacles ahead of time, so they never pop in as emoji. */
  function preloadMovers(map) {
    const base = MAP_MOVERS[map] ?? (MAPS.indexOf(map) > 5 ? "meadow" : map);
    const kinds = Object.keys(MOVER_KINDS).filter((k) => MOVER_KINDS[k].map === base && MOVER_MODEL[k].file);
    return Promise.all(kinds.map((k) => loadModeProp(MOVER_MODEL[k].file, { width: MOVER_MODEL[k].size, maxHeight: MOVER_MODEL[k].size * 1.5 })));
  }
  /** Get the GPU ready for the scene (shaders), so the first frames don't stutter. */
  function warmUp() {
    try {
      renderer?.compile(scene, camera);
    } catch {
      /* not supported: it compiles on first draw */
    }
  }
  function setupMode(kind, course) {
    modeKind = kind;
    if (brainObj) scene.remove(brainObj);
    if (bombObj) scene.remove(bombObj);
    brainObj = null;
    bombObj = null;
    coinList = [];
    looseMeshes = new Map();
    if (kind === "coinrush") {
      coinLines(course).forEach((c, i) => {
        const obj = makeCoin(c.v > 1);
        obj.position.set(laneX(c.lane), 1.3, -c.z);
        raceGroup.add(obj);
        const entry = { obj, z: c.z, lane: c.lane, v: c.v, i, got: false };
        coinList.push(entry);
        cullables.push({ obj, z: c.z, coin: entry });
      });
    }
    if (kind === "chase") {
      brainObj = new THREE.Group();
      const fallback = new THREE.Mesh(new THREE.SphereGeometry(2.6, 32, 24), new THREE.MeshStandardMaterial({ color: 0xff8fb8, roughness: 0.6 }));
      fallback.position.y = 2.6;
      brainObj.add(fallback);
      scene.add(brainObj);
      loadModeProp("brain", { width: 6.5, maxHeight: 6.5 }).then((m) => {
        if (!m || !brainObj || modeKind !== "chase") return;
        brainObj.remove(fallback);
        const inner = sizeTo(m.clone(), 5.6);
        inner.rotation.y = Math.PI; // face the runners it's chasing
        const roll = new THREE.Group();
        const box = new THREE.Box3().setFromObject(inner);
        const c = box.getCenter(new THREE.Vector3());
        inner.position.sub(c);
        roll.add(inner);
        roll.position.y = c.y;
        roll.name = "roll";
        brainObj.add(roll);
      });
    }
    if (kind === "potato") {
      bombObj = new THREE.Group();
      // a red glow behind it that grows as the fuse burns down, and a spark on the fuse
      const glow = glowSprite(0xff4a12, 1.8);
      glow.name = "glow";
      bombObj.add(glow);
      const body = new THREE.Group();
      body.name = "body";
      bombObj.add(body);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex("💣"), depthTest: false, transparent: true }));
      spr.scale.set(1.2, 1.2, 1);
      spr.renderOrder = 12;
      body.add(spr);
      const spark = glowSprite(0xffe066, 0.5);
      spark.name = "spark";
      spark.renderOrder = 13;
      spark.position.set(0.25, 0.62, 0);
      bombObj.add(spark);
      bombObj.visible = false;
      bombHop = { holder: null, from: null, t0: 0 };
      scene.add(bombObj);
      loadModeProp("bomb", { width: 0.95, maxHeight: 1.2 }).then((m) => {
        if (!m || !bombObj || modeKind !== "potato") return;
        body.remove(spr);
        // centre the model on the body so it spins in place right over the runner's head
        const bomb = sizeTo(m.clone(), 0.7);
        const box = new THREE.Box3().setFromObject(bomb);
        bomb.position.sub(box.getCenter(new THREE.Vector3()));
        body.add(bomb);
      });
    }
  }
  function syncMode(v, posOf, sn) {
    if (modeKind === "chase" && brainObj) {
      const bd = brainDistance(Math.max(0, (sn - v.startAt) / 1000));
      brainObj.position.set(0, 0, -bd);
      // bounding along, leaning in, jaws first
      const k = performance.now() / 1000;
      const hop = Math.abs(Math.sin(k * 5)) * 0.9;
      const body = brainObj.getObjectByName("roll") ?? brainObj.children[0];
      if (body) {
        body.position.y = (body.userData.y0 ??= body.position.y) + hop;
        body.rotation.x = -0.18 + Math.sin(k * 10) * 0.05;
        body.rotation.z = Math.sin(k * 5) * 0.08;
      }
    }
    if (modeKind === "coinrush") {
      const k = performance.now() / 1000;
      for (const c of coinList) {
        if (c.got || !c.obj.visible) continue;
        c.obj.rotation.y = k * 3 + c.z;
        c.obj.position.y = 1.3 + Math.sin(k * 4 + c.z) * 0.12;
      }
      const live = new Set();
      for (const l of v.loose || []) {
        live.add(l.id);
        if (looseMeshes.has(l.id)) continue;
        const g = new THREE.Group();
        for (let n = 0; n < Math.min(5, l.n); n++) {
          const c = makeCoin(false);
          c.position.set((n % 3 - 1) * 0.35, 0.25 + Math.floor(n / 3) * 0.3, (n % 2) * 0.3);
          g.add(c);
        }
        g.position.set(laneX(l.lane), 0.4, -l.d);
        raceGroup.add(g);
        looseMeshes.set(l.id, g);
      }
      for (const [id, g] of looseMeshes) {
        if (live.has(id)) {
          g.rotation.y += 0.05;
          continue;
        }
        raceGroup.remove(g);
        looseMeshes.delete(id);
      }
    }
    stepBlasts();
    if (modeKind === "potato" && bombObj) {
      const b = v.bomb;
      const at = b ? posOf(b.holder) : null;
      const wasShown = bombObj.visible;
      bombObj.visible = Boolean(at);
      if (at) {
        const now = performance.now();
        const k = now / 1000;
        if (b.holder !== bombHop.holder) bombHop = { holder: b.holder, from: wasShown ? bombObj.position.clone() : null, t0: now };
        // 0 when the fuse is fresh, 1 the moment it blows: everything speeds up and swells toward 1
        const danger = 1 - Math.min(1, Math.max(0, (b.until - sn) / POTATO_FUSE_MS));
        const rate = 5 + danger * danger * 30;
        const x = at.x;
        let y = at.y + CHAR_H + 0.55;
        let z = at.z;
        const hop = (now - bombHop.t0) / 380;
        if (bombHop.from && hop < 1) {
          const e = hop * hop * (3 - 2 * hop);
          bombObj.position.set(bombHop.from.x + (x - bombHop.from.x) * e, bombHop.from.y + (y - bombHop.from.y) * e + Math.sin(Math.PI * hop) * 2.4, bombHop.from.z + (z - bombHop.from.z) * e);
        } else bombObj.position.set(x, y + Math.sin(k * 4) * 0.06, z);
        const beat = Math.abs(Math.sin(k * rate));
        const body = bombObj.getObjectByName("body");
        body.scale.setScalar(1 + beat * (0.04 + danger * 0.22));
        body.rotation.z = Math.sin(k * rate * 1.3) * danger * 0.25;
        body.rotation.y = k * 1.5;
        const glow = bombObj.getObjectByName("glow");
        glow.scale.setScalar(1.4 + danger * 2.2 + beat * danger * 0.6);
        glow.material.opacity = 0.2 + danger * 0.7 * (0.4 + 0.6 * beat);
        const spark = bombObj.getObjectByName("spark");
        spark.scale.setScalar(0.3 + Math.random() * 0.35);
        spark.material.opacity = 0.6 + Math.random() * 0.4;
      }
    }
  }
  /** The bomb going off: a fireball, a white flash and a shockwave ring along the ground. */
  function explode(x, z) {
    burst(x, 1.2, z, ["#ff9f1c", "#ff4d00", "#ffe066", "#ffffff"], 150);
    burst(x, 1.6, z, ["#3a3a3a", "#555555", "#2a2a2a"], 50);
    const flash = glowSprite(0xffc070, 1);
    flash.position.set(x, 1.4, z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.12, z);
    scene.add(flash, ring);
    blastFx.push({ flash, ring, t0: performance.now() });
  }
  function stepBlasts() {
    const now = performance.now();
    for (let i = blastFx.length - 1; i >= 0; i--) {
      const f = blastFx[i];
      const k = (now - f.t0) / 650;
      if (k >= 1) {
        scene.remove(f.flash, f.ring);
        f.flash.material.dispose();
        f.ring.geometry.dispose();
        f.ring.material.dispose();
        blastFx.splice(i, 1);
        continue;
      }
      f.flash.scale.setScalar(2 + Math.sqrt(k) * 9);
      f.flash.material.opacity = 1 - k;
      f.ring.scale.setScalar(1 + k * 7);
      f.ring.material.opacity = 0.9 * (1 - k);
    }
  }

  // the thundercloud: a dark storm sprite hovering over whoever holds it
  let cloudSpr = null;
  function syncCloud(cloud, posOf) {
    const at = cloud ? posOf(cloud.holder) : null;
    if (!at) {
      if (cloudSpr) cloudSpr.visible = false;
      return;
    }
    if (!cloudSpr) {
      cloudSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex("⛈️"), depthTest: false, transparent: true }));
      cloudSpr.scale.set(1.6, 1.6, 1);
      cloudSpr.renderOrder = 12;
      scene.add(cloudSpr);
    }
    cloudSpr.visible = true;
    const k = performance.now() / 1000;
    cloudSpr.position.set(at.x, at.y + CHAR_H + 1.3 + Math.sin(k * 5) * 0.08, at.z);
    // flickers faster as the strike gets close
    const left = (cloud.until - serverNow()) / 1000;
    cloudSpr.material.opacity = left < 1.5 && Math.sin(k * 30) > 0 ? 0.55 : 1;
  }

  function clearCourse() {
    bananaMeshes.clear();
    ballMeshes.clear();
    for (const c of raceGroup.children.slice()) raceGroup.remove(c);
    cullables = cullables.filter((c) => c.keep);
    rollers = [];
    boxes = [];
    hearts = [];
  }

  /** Endless runs: no finish line, and the scenery follows you forward. */
  function setEndless(on) {
    finishGroup.visible = !on;
    endless = on;
    moveScenery(0);
  }
  let endless = false;
  function moveScenery(d) {
    shift = endless ? Math.max(0, Math.floor((d - 100) / SHIFT_STEP)) * SHIFT_STEP : 0;
    trackGroup.position.z = -shift;
    if (scenery) scenery.position.z = -shift;
  }

  function cull(d) {
    if (endless) moveScenery(d);
    for (const c of cullables) {
      const z = c.keep ? c.z + shift : c.z;
      c.obj.visible = z > d - VIEW_BEHIND && z < d + VIEW_AHEAD + (c.wide ? 60 : 0) && !c.box?.taken && !c.coin?.got;
    }
    for (const c of sceneryCull) {
      const z = c.z + shift;
      c.obj.visible = z > d - VIEW_BEHIND && z < d + VIEW_AHEAD + 60;
    }
    for (const r of rollers) r.obj.visible = r.z > d - VIEW_BEHIND && r.z < d + VIEW_AHEAD;
  }

  // barrels start rolling at you when you get close; boxes spin and bob
  function animateCourse(d, raceT, dt) {
    for (const r of rollers) {
      if (r.startedAt === null && raceT !== null && d >= r.z0 - ROLLER_TRIGGER_M) {
        r.startedAt = raceT;
        if (r.z0 - d < ROLLER_TRIGGER_M + 2) sfx.roll();
      }
      if (r.startedAt !== null) {
        r.z = r.z0 - ROLLER_SPEED * (raceT - r.startedAt);
        r.obj.position.z = -r.z;
        r.obj.rotation.x -= (ROLLER_SPEED / 0.5) * dt; // rolling toward +z
      }
    }
    const t = performance.now() / 1000;
    const gone = net.view?.taken;
    for (const b of boxes) {
      if (!b.taken && gone?.includes(b.idx)) b.taken = true; // somebody else got it
      if (b.taken) continue;
      b.obj.rotation.y = t * 1.6 + b.z;
      b.obj.position.y = 1.0 + Math.sin(t * 3 + b.z) * 0.12;
    }
  }

  // ── lobby showcase: your runner idling in front of the camera ──
  let show = null;
  function showcase() {
    if (!ready) return;
    buildScenery();
  }
  function setShowcase(charIdx) {
    if (!ready) return;
    if (!assets.chars[charIdx]) {
      ensureChar(charIdx).then(() => setShowcase(charIdx)).catch(() => {});
      return;
    }
    if (show && show.char === charIdx) return;
    if (show) scene.remove(show.r.group);
    const r = makeRunner(charIdx, "", "#fff", true);
    r.group.position.set(0, 0, -3);
    r.pivot.rotation.y = 0.35;
    r.play("idle", 0);
    scene.add(r.group);
    show = { char: charIdx, r };
  }
  function hideShowcase() {
    if (show) scene.remove(show.r.group);
    show = null;
  }

  return {
    load,
    get ready() {
      return ready;
    },
    makeRunner,
    buildCourseObjects,
    buildScenery,
    ensureMap,
    mapReady,
    preloadMovers,
    warmUp,
    get activeMap() {
      return activeMap;
    },
    cull,
    tick,
    setEndless,
    syncBananas,
    syncCloud,
    setupMode,
    syncMode,
    setupMovers,
    syncMovers,
    trail,
    stepTrails,
    get movers() {
      return moverList;
    },
    explode,
    get coins() {
      return coinList;
    },
    syncBowls,
    burst,
    fireworks,
    animateCourse,
    get rollers() {
      return rollers;
    },
    get boxes() {
      return boxes;
    },
    get hearts() {
      return hearts;
    },
    emoteBubble,
    dizzy,
    setBestMarker,
    ensureChar,
    hasChars,
    showcase,
    setShowcase,
    hideShowcase,
    get show() {
      return show;
    },
    clearRace() {
      clearCourse();
      race.clear();
    },
  };
})();

// ── race state ──────────────────────────────────────────────────────────────

const game = { mode: "home", round: -1, kind: "survival", len: TRACK_LEN };
// every mode now runs on the endless course; only Survival uses obstacle hearts
const isSurvival = () => isEndless(game.kind);
const heartsFromHits = () => game.kind === "survival";
/** Hearts this race (3, or 1 in an endless run), as the room says. */
const livesNow = () => net.view?.lives ?? LIVES;
const POWER_HITS = new Set(["zap", "banana", "bowling", "fake"]);
/** Hearts the room gave out: gone for everyone, and +1 heart for whoever got it (once). */
function healFromHearts() {
  for (const t of net.view?.heartsTaken || []) {
    const h = world.hearts[t.i];
    if (!h || h.taken) continue;
    h.taken = true;
    if (t.by !== playerId || game.healed?.has(t.i)) continue;
    game.healed.add(t.i);
    me.hits = Math.max(0, me.hits - 1);
    renderHearts(false);
    sfx.pickup();
    banner("+1 ❤️", 900);
    world.burst(laneX(h.lane), 1.2, -h.z, ["#ff4d6d", "#ff9fb3", "#ffffff"], 60);
    sendPos(true);
  }
}

const me = {
  d: 0,
  x: 0,
  lane: 0,
  y: 0,
  vy: 0,
  slideT: 0,
  stumbleT: 0,
  invulnT: 0,
  boostT: 0,
  items: [], // power-ups you're holding: [next, saved] (two at most)
  frozenT: 0, // slowed by someone's freeze
  score: 0, // style points: clean jumps, slides and close calls
  combo: 0,
  bestCombo: 0,
  laneAt: 0, // when you last changed lane (for close calls)
  power: "", // active timed power: shield | rocket | ghost
  powerT: 0,
  speed: 0,
  hits: 0,
  finished: false,
  out: false, // survival: no hearts left
  act: "idle",
  runner: null,
  lastZap: 0,
  lastSent: 0,
  sentAct: "",
};

const remote = {
  map: new Map(), // id -> {p, runner, dispD, dispX, dispY, lastD, lastAt, vel}
  ingest(p, v) {
    if (p.id === playerId) return;
    let r = this.map.get(p.id);
    const now = performance.now();
    if (!r) {
      r = { p, runner: null, dispD: p.d, dispX: laneX(p.lane), dispY: 0, lastD: p.d, lastAt: now, vel: 0 };
      this.map.set(p.id, r);
    }
    if (p.d !== r.lastD) {
      const dt = (now - r.lastAt) / 1000;
      if (dt > 0.02) r.vel = clamp((p.d - r.lastD) / dt, 0, 26);
      r.lastD = p.d;
      r.lastAt = now;
    }
    if (v.phase !== "race") r.vel = 0;
    r.p = p;
  },
  clear() {
    for (const r of this.map.values()) if (r.runner) scene.remove(r.runner.group);
    this.map.clear();
  },
};

const race = {
  course: null,
  clear() {
    if (me.runner) scene.remove(me.runner.group);
    me.runner = null;
    remote.clear();
    this.course = null;
    game.round = -1;
  },
};

/** A cover over the race until everything is loaded and the first frame is drawn. */
const curtain = $("#raceCurtain");
function showCurtain(map) {
  curtain.hidden = false;
  curtain.classList.remove("gone");
  const info = MAP_INFO[map];
  $("#curtainMap").textContent = info ? `${info.icon ?? "🏁"} ${info.label}` : "Get ready!";
}
function liftCurtain() {
  if (curtain.hidden || curtain.classList.contains("gone")) return;
  curtain.classList.add("gone");
  setTimeout(() => curtain.classList.contains("gone") && (curtain.hidden = true), 500);
}
function enterRace(v) {
  if (!v.cup || v.cup.race === 1) chargePot(v); // the host pays the prize pot as the match starts
  const needed = v.players.map((p) => p.char);
  const map = v.raceMap || "meadow";
  if (world.ready && !world.hasChars(needed)) for (const c of needed) world.ensureChar(c).catch(() => {});
  if (world.ready && !world.mapReady(map)) {
    world.ensureMap(map).catch(() => {
      game.mapFailed = true; // race on the meadow instead of waiting forever
      toast("Couldn't load that map, racing on the meadow");
    });
  }
  if (!world.ready || !world.hasChars(needed) || (!world.mapReady(map) && !game.mapFailed)) {
    // assets still loading — try again on the next state message / frame
    game.pendingRace = true;
    showScreen("race");
    showCurtain(map);
    return;
  }
  game.pendingRace = false;
  // the opening shot gets whatever is left of the countdown; the controls wait for the gun
  game.introLen = Math.max(0, (v.startAt - serverNow()) / 1000);
  $("#hud").classList.toggle("intro", game.introLen > 0.6);
  world.warmUp();
  requestAnimationFrame(() => requestAnimationFrame(liftCurtain));
  game.mode = "race";
  game.round = v.round;
  game.lookBack = false;
  game.soloRun = v.kind === "survival" && v.players.length === 1;
  game.bestBeaten = false;
  game.bananasThrown = 0;
  game.kos = 0;
  game.boxesGrabbed = 0;
  game.lastHitD = 0;
  world.setBestMarker(game.soloRun ? personalBest() : 0);
  renderCombo();
  $("#feed").replaceChildren();
  $("#emoteMenu").classList.remove("show");
  game.spectating = null;
  game.shownSpectate = undefined;
  $("#spectate").classList.remove("show");
  me.lastItem = "";
  slipped.clear();
  bowled.clear();
  ballRel.clear();
  game.cheered = new Set();
  game.kind = v.kind || "sprint";
  game.len = isSurvival() ? SURVIVAL_LEN : TRACK_LEN;
  world.hideShowcase();
  world.buildScenery(map);
  world.setEndless(isSurvival());
  remote.clear();
  race.course = world.buildCourseObjects(v.seed, game.len, v.courseBoost ?? 0);
  // hearts only exist in modes where you have hearts to win back
  if (v.kind !== "survival" || (v.lives ?? LIVES) < 2) for (const h of world.hearts) h.taken = true; // none in a one-life endless run
  game.healed = new Set();
  showScreen("race");

  const mine = v.players.find((p) => p.id === playerId);
  Object.assign(me, {
    d: mine?.d ?? 0,
    lane: mine?.slot ?? 0,
    y: 0,
    vy: 0,
    slideT: 0,
    stumbleT: 0,
    invulnT: 0,
    boostT: 0,
    // everyone starts each race holding a random power-up
    items: mine?.outAt != null || mine?.finish != null ? [] : [startingItem()],
    frozenT: 0,
    waveT: 0,
    glueT: 0,
    slowPadT: 0,
    staggerT: 0,
    warp: mine?.warp ?? 0,
    lastPunch: Math.max(0, ...(v.punches || []).map((x) => x.id)),
    score: 0,
    combo: 0,
    bestCombo: 0,
    laneAt: 0,
    power: "",
    powerT: 0,
    speed: 0,
    hits: mine?.hits ?? 0,
    finished: mine?.finish != null,
    out: mine?.outAt != null,
    act: "idle",
    lastSent: 0,
    sentAct: "",
    // zaps from before we (re)entered this race don't count
    lastZap: Math.max(0, ...(v.zaps || []).map((z) => z.id)),
  });
  renderPower();
  me.x = me.lane;
  if (me.runner) scene.remove(me.runner.group);
  me.runner = world.makeRunner(mine?.char ?? 0, mine?.name ?? "", RUNNERS[mine?.char ?? 0].color, true);
  scene.add(me.runner.group);

  for (const p of v.players) {
    if (p.id === playerId) continue;
    remote.ingest(p, v);
    const r = remote.map.get(p.id);
    r.runner = world.makeRunner(p.char, withFlag(p.name, p.country), RUNNERS[p.char].color, false);
    r.dispD = p.d;
    r.dispX = laneX(p.lane);
    scene.add(r.runner.group);
  }

  const dots = $("#dots");
  dots.replaceChildren();
  for (const p of v.players) {
    dots.append(el("div", { class: `dot${p.id === playerId ? " me" : ""}`, "data-id": p.id, style: `background:${RUNNERS[p.char].color}` }));
  }

  lastCount = null;
  game.spectating = null;
  $(".track-bar").classList.toggle("endless", isSurvival());
  renderHearts(false);
  const tag = $("#raceTag");
  const info = GAME_MODE_INFO[game.kind] ?? GAME_MODE_INFO.survival;
  tag.classList.add("show");
  tag.replaceChildren(
    el("b", { text: game.endless ? "♾️ Endless run" : v.cup ? `🏆 Round ${v.cup.race}/${v.cup.races.length} · ${info.icon} ${KIND_LABEL[game.kind]}` : `${info.icon} ${KIND_LABEL[game.kind] ?? ""}` }),
    el("small", { text: game.endless ? `One life · how far can you get?${stats.get("bestRun") ? ` Best: ${stats.get("bestRun").toLocaleString()} m` : ""}` : KIND_RULE[game.kind] ?? "" }),
  );
  setTimeout(() => game.round === v.round && tag.classList.remove("show"), 7000); // the mode is only shown at the start
  tag.classList.toggle("small", Boolean(v.cup)); // the cup's reel shows the mode instead
  world.setupMode(game.kind, race.course);
  world.setupMovers(race.course, v.seed, game.mapFailed ? "meadow" : map);
  if (v.cup && v.phase === "countdown" && (v.mode === "random" || v.mode === "grandtour")) spinReveal(v.cup.race, game.kind, v.cup.races.length);
  game.lastBlast = Math.max(0, ...(v.blasts || []).map((b) => b.id));
  game.coinGot = new Set();
  game.aliveShown = null;
  $("#aliveChip").hidden = true;
  renderModeHud();
  const touch = TOUCH;
  coachStart();
  const hint = $("#controlsHint");
  // the in-run coach teaches the moves; on a keyboard, a one-line reminder
  hint.textContent = touch ? "" : "↑ jump · ↓ slide · ← → lane · E use power-up · C to look back";
  hint.style.opacity = "1";
  setTimeout(() => (hint.style.opacity = "0"), 6000);
  $("#banner").classList.remove("show");
}

function finishRaceView(v) {
  // brief celebration in 3D, then the results card
  game.mode = "results-pending";
  saveBest();
  const won = v.standings?.[0] === playerId;
  banner(
    game.kind === "coinrush"
      ? won ? "MOST COINS!" : "TIME UP!"
      : isSurvival()
        ? me.out && !won ? "GAME OVER" : "LAST ONE STANDING!"
        : me.finished ? "FINISHED!" : "TIME UP!",
  );
  // the last runner standing gets fireworks over their head
  if (isSurvival()) {
    const top = v.standings?.[0];
    const z = top === playerId ? -me.d : -(remote.map.get(top)?.dispD ?? me.d);
    world.fireworks(z - 14);
  }
  setTimeout(() => {
    if (game.mode === "results-pending") showResults(net.view ?? v);
  }, 1600);
}

let bannerTimer = 0;
function banner(text, ms = 1400) {
  const b = $("#banner");
  b.textContent = text;
  b.classList.add("show");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove("show"), ms);
}

// ── first endless run: the tutorial happens in the run ──
// When something you haven't learned yet comes up in your lane, the game drops
// into slow motion and shows the move; make it and it speeds back up. Then a
// power-up tip, and you're on your own.
const COACH = {
  lane: { title: "Swipe left or right", text: "A crate! Change lanes to dodge it.", keys: "← → on the keyboard", g: "side" },
  jump: { title: "Swipe up to jump", text: "Jump over the hurdle!", keys: "↑ or Space on the keyboard", g: "up" },
  slide: { title: "Swipe down to slide", text: "Slide under the gate!", keys: "↓ on the keyboard", g: "down" },
  item: { title: "Tap to use it", text: "Tap the round button!", keys: "E on the keyboard", g: "tap" },
};
const COACH_MOVES = ["lane", "jump", "slide"];
const COACH_SLOW = 0; // the run waits until you make the move
const COACH_UNTIL_M = 1500; // after this, it stops teaching either way
const coach = { on: false, wait: null, row: null, done: new Set(), scale: 1, items: 0, shownAt: 0 };
function coachStart() {
  coach.on = Boolean(game.endless) && !local.getItem("lr:endlessTut");
  coach.done = new Set();
  coach.scale = 1;
  coachHide();
}
function coachShow(kind, dir = COACH[kind].g, row = null) {
  const c = COACH[kind];
  coach.wait = kind;
  coach.row = row;
  coach.items = me.items.length;
  coach.shownAt = performance.now();
  // Nia keeps one still pose in every lesson
  $("#coachTitle").textContent = c.title;
  $("#coachText").textContent = c.text;
  $("#coachKeys").textContent = TOUCH ? "" : c.keys;
  $("#coachGesture").className = `coach-gesture ${dir}`;
  const box = $("#coach");
  box.classList.toggle("item", kind === "item");
  box.hidden = false;
  sfx.tap();
}
function coachHide() {
  coach.wait = null;
  coach.row = null;
  $("#coach").hidden = true;
}
function coachEnd(learned) {
  coach.on = false;
  coachHide();
  if (!learned) return;
  local.setItem("lr:endlessTut", "1");
  local.setItem("lr:tutDone", "1");
}
function coachLearned(kind) {
  coach.done.add(kind);
  coachHide();
  sfx.pickup();
  banner(kind === "item" ? "NICE!" : "PERFECT!", 700);
  if (COACH_MOVES.every((k) => coach.done.has(k)) && coach.done.has("item")) {
    coachEnd(true);
    setTimeout(() => {
      banner("YOU'RE READY!", 1600);
      toast("One hit ends the run. How far can you get?");
    }, 800);
  }
}
/** Every frame: eases in and out of slow motion and spots the next thing to teach. Returns the time scale. */
function coachTick(dt) {
  if (!coach.on) return 1;
  if (me.out) {
    coachEnd(false); // didn't make it: it teaches again next run
    return 1;
  }
  const w = coach.wait;
  coach.scale += ((w && w !== "item" ? COACH_SLOW : 1) - coach.scale) * Math.min(1, dt * 12);
  if (me.d > COACH_UNTIL_M) {
    coachEnd(true);
    return 1;
  }
  if (w === "item" && (me.items.length < coach.items || performance.now() - coach.shownAt > 6000)) coachLearned("item");
  if (coach.wait || !canControl() || me.stumbleT > 0 || me.power === "rocket") return coach.scale;
  // holding a power-up (once you've learned a move): how to use it
  if (!coach.done.has("item") && me.items.length && coach.done.size > 0) {
    coachShow("item");
    return coach.scale;
  }
  const course = race.course;
  if (!course) return coach.scale;
  const reach = Math.max(7, me.speed * 0.75);
  for (const row of course.rows) {
    if (row.z <= me.d + 1.5 || row.z > me.d + reach) continue;
    const k = row.lanes[me.lane];
    const need = k === "hurdle" ? "jump" : k === "gate" ? "slide" : k === "crate" ? "lane" : null;
    if (!need || coach.done.has(need)) continue;
    let dir;
    if (need === "lane") {
      const free = [me.lane - 1, me.lane + 1].filter((l) => l >= 0 && l < LANES && !row.lanes[l]);
      dir = free.length === 1 ? (free[0] < me.lane ? "left" : "right") : "side";
    }
    coachShow(need, dir, row);
    break;
  }
  return coach.scale;
}
/** A move you just made: does it answer what the coach is showing? */
function coachInput(kind) {
  const w = coach.wait;
  if (!w || w === "item") return;
  if (w === "lane" && (kind === "left" || kind === "right")) {
    if (!coach.row?.lanes[me.lane]) coachLearned("lane"); // into a free lane
  } else if (w === kind) coachLearned(w);
}
$("#coachSkip").addEventListener("click", () => coachEnd(true));

// ── input ───────────────────────────────────────────────────────────────────

function canControl() {
  const v = net.view;
  return game.mode === "race" && v && serverNow() >= v.startAt && !me.finished && !me.out;
}

function input(kind) {
  if (me.out && game.mode === "race" && (kind === "left" || kind === "right")) return cycleSpectate(kind === "left" ? -1 : 1);
  if (!canControl()) return;
  if (me.stumbleT > 0) return; // knocked over — wait until you're back up
  if (kind === "left" || kind === "right") {
    // a brain wave flips your controls
    const dirIn = kind === "left" ? -1 : 1;
    const next = clamp(me.lane + (me.waveT > 0 ? -dirIn : dirIn), 0, LANES - 1);
    if (next !== me.lane) {
      me.lane = next;
      me.laneAt = performance.now();
      sfx.lane();
    }
  } else if (kind === "jump") {
    if (me.power === "rocket") return;
    if (me.y <= 0.001 && me.stumbleT <= 0) {
      me.vy = JUMP_V;
      me.y = 0.001;
      me.slideT = 0;
      sfx.jump();
    }
  } else if (kind === "slide") {
    if (me.power === "rocket") return;
    if (me.y > 0.001) {
      me.vy = Math.min(me.vy, -16); // fast-fall, then slide on landing
      me.slideT = SLIDE_S;
    } else if (me.stumbleT <= 0) {
      if (me.slideT > 0) me.slideKick = true; // sliding again: start the slide clip over
      me.slideT = SLIDE_S;
      sfx.slide();
    }
  }
  coachInput(kind);
}

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key;
  // a held key auto-repeats: one press = one move (holding ↓ used to keep
  // restarting the slide, leaving the runner frozen in a slide pose)
  if (e.repeat) {
    if (/^Arrow|^[wasdWASD ]$/.test(k)) e.preventDefault();
    return;
  }
  if (k === "ArrowLeft" || k === "a" || k === "A") input("left");
  else if (k === "ArrowRight" || k === "d" || k === "D") input("right");
  else if (k === "ArrowUp" || k === "w" || k === "W" || k === " ") input("jump");
  else if (k === "ArrowDown" || k === "s" || k === "S") input("slide");
  else if (k === "e" || k === "E" || k === "Enter") useItem(me.lane, 1);
  else if (k === "q" || k === "Q") useItem(me.lane, -1);
  else if (/^Digit[1-4]$/.test(e.code)) useItem(Number(e.code.slice(5)) - 1, e.shiftKey ? -1 : 1);
  else if (k === "c" || k === "C" || k === "b" || k === "B") game.lookBack = canControl() || game.mode === "race";
  else return;
  e.preventDefault();
});
window.addEventListener("keyup", (e) => {
  if ("cCbB".includes(e.key)) game.lookBack = false;
});
{
  let sx = 0;
  let sy = 0;
  let used = false;
  let tracking = false;
  const SWIPE = 28;
  canvas.addEventListener(
    "touchstart",
    (e) => {
      const t = e.changedTouches[0];
      sx = t.clientX;
      sy = t.clientY;
      used = false;
      tracking = true;
      sfx.unlock();
    },
    { passive: true },
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (!tracking || used) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
      used = true;
      if (Math.abs(dx) > Math.abs(dy)) input(dx < 0 ? "left" : "right");
      else input(dy < 0 ? "jump" : "slide");
    },
    { passive: true },
  );
  canvas.addEventListener(
    "touchend",
    () => {
      if (tracking && !used) input("jump"); // a plain tap jumps
      tracking = false;
    },
    { passive: true },
  );
  document.addEventListener("touchmove", (e) => game.mode === "race" && e.preventDefault(), { passive: false });
}

// ── simulation ──────────────────────────────────────────────────────────────

function stepMe(dt) {
  const v = net.view;
  const running = v && serverNow() >= v.startAt;

  // lane change (smooth)
  const dx = me.lane - me.x;
  const stepX = LANE_SWITCH_SPEED * dt;
  me.x = Math.abs(dx) <= stepX ? me.lane : me.x + Math.sign(dx) * stepX;

  // vertical (the rocket holds you up in the air)
  if (me.power === "rocket") {
    me.y += (ROCKET_Y - me.y) * Math.min(1, dt * 6);
    me.vy = 0;
  } else if (me.y > 0 || me.vy > 0) {
    me.vy -= GRAVITY * dt;
    me.y += me.vy * dt;
    if (me.y <= 0) {
      me.y = 0;
      me.vy = 0;
    }
  }
  me.slideT = Math.max(0, me.slideT - (me.y > 0 ? 0 : dt));
  me.stumbleT = Math.max(0, me.stumbleT - dt);
  me.invulnT = Math.max(0, me.invulnT - dt);
  me.boostT = Math.max(0, me.boostT - dt);
  me.frozenT = Math.max(0, me.frozenT - dt);
  me.waveT = Math.max(0, (me.waveT ?? 0) - dt);
  me.glueT = Math.max(0, (me.glueT ?? 0) - dt);
  me.slowPadT = Math.max(0, (me.slowPadT ?? 0) - dt);
  me.staggerT = Math.max(0, (me.staggerT ?? 0) - dt);
  if (me.power) {
    me.powerT = Math.max(0, me.powerT - dt);
    if (me.powerT <= 0) endPower();
  }

  if (!running) {
    me.speed = 0;
    return;
  }

  // speed
  // everyone speeds up the longer the round lasts (same clock for all)
  let base = runSpeed(game.kind, (serverNow() - v.startAt) / 1000);
  if (me.frozenT > 0) base *= 0.55;
  if (me.glueT > 0) base *= GLUE_SLOW;
  if (me.slowPadT > 0) base *= 0.55; // ran over a red slow pad
  if (me.staggerT > 0) base *= 0.6;
  if (net.view?.bomb?.holder === playerId) base *= 1.1; // a little push to get out of last
  const fast = base + (isSurvival() ? SURVIVAL_BOOST : BOOST_SPEED - BASE_SPEED);
  const rocket = isSurvival() ? base + SURVIVAL_ROCKET : ROCKET_SPEED;
  let target = me.power === "rocket" ? rocket : me.boostT > 0 ? fast : base;
  // sliding along the grass while falling, then stopped while getting up
  if (me.stumbleT > 0) target = me.stumbleT > GETUP_S ? 3 : 0;
  if (me.finished) target = me.d > TRACK_LEN + 14 ? 0 : 6;
  if (me.out) target = 0;
  const accel = me.stumbleT > 0 ? 30 : me.power === "rocket" ? 40 : 14;
  me.speed += clamp(target - me.speed, -accel * dt, accel * dt);
  const prevD = me.d;
  me.d += me.speed * dt;

  modeTick(prevD, v);
  if (!isSurvival() && !me.finished && me.d >= TRACK_LEN) {
    me.finished = true;
    sfx.finish();
    banner("FINISH!", 1800);
    world.fireworks(-TRACK_LEN);
    sendPos(true);
  }
  if (me.finished || me.out) return;

  // collisions (swept over this step's distance)
  const course = race.course;
  if (!course) return;
  const untouchable = me.power === "rocket" || me.power === "ghost";
  for (const row of course.rows) {
    if (untouchable) break;
    if (row.z < prevD - 0.6 || row.z > me.d + 0.6) continue;
    for (let lane = 0; lane < LANES; lane++) {
      const kind = row.lanes[lane];
      if (!kind || kind === "roller") continue;
      const half = kind === "crate" ? 0.58 : 0.62;
      if (Math.abs(me.x - lane) > half) continue;
      const clear =
        (kind === "hurdle" && me.y > 0.62) || (kind === "gate" && me.slideT > 0);
      if (!clear) hit(kind);
    }
  }
  // rolling barrels: wherever they are right now
  for (const r of world.rollers) {
    if (untouchable) break;
    if (r.hit || r.z < prevD - 0.7 || r.z > me.d + 0.7) continue;
    if (Math.abs(me.x - r.lane) > 0.62 || me.y > 0.8) continue;
    r.hit = true;
    hit("roller");
  }
  // style points for every row you get past without a scratch
  if (!untouchable && me.stumbleT <= 0) {
    for (const row of course.rows) {
      if (row.z <= prevD || row.z > me.d) continue;
      const lane = Math.round(me.x);
      const mine = row.lanes[lane];
      const beside = [row.lanes[lane - 1], row.lanes[lane + 1]].some((k) => k === "crate" || k === "roller");
      if (mine === "hurdle") style("NICE JUMP!", 10);
      else if (mine === "gate") style("NICE SLIDE!", 10);
      else if (!mine && beside && performance.now() - me.laneAt < 650) style("CLOSE CALL!", 25);
    }
  }
  // survival: hearts floating over the track give back a lost heart
  // (the room decides who gets it: the first one there; see healFromHearts)
  for (const h of world.hearts) {
    if (h.taken || h.asked || h.z < prevD - 0.8 || h.z > me.d + 0.8 || Math.abs(me.x - h.lane) > 0.6) continue;
    if (!heartsFromHits() || me.hits <= 0) continue; // full health: leave it for someone else
    h.asked = true;
    act({ type: "heart", i: h.idx });
  }
  healFromHearts();
  // mystery boxes
  for (const b of world.boxes) {
    if (b.taken || b.z < prevD - 0.8 || b.z > me.d + 0.8) continue;
    if (Math.abs(me.x - b.lane) > 0.6 || me.y > 2.4) continue;
    if (me.items.length + (me.power ? 1 : 0) >= 2) continue; // hands full: the box stays for someone else
    b.taken = true;
    act({ type: "take", box: b.idx });
    world.burst(laneX(b.lane), 1.0, -b.z, ["#b06bff", "#ff6bd5", "#6be3ff", "#ffffff", "#ffd84a"], 70);
    me.lastBox = { idx: b.idx, kind: grabBox() };
    game.boxesGrabbed = (game.boxesGrabbed ?? 0) + 1;
    stats.add("boxes", 1);
    challenge("boxes", game.boxesGrabbed);
  }
  // bowling balls rolling back down the track (not your own)
  const sn = serverNow();
  for (const b of net.view?.bowls || []) {
    if (b.by === playerId || bowled.has(b.id)) continue;
    const age = (sn - b.at) / 1000;
    const bd = b.d + (b.dir ?? -1) * BOWL_SPEED * age;
    if (age < 0 || Math.abs(bd - b.d) > BOWL_RANGE_M) continue;
    // swept: did the ball pass you since last frame (it's faster than you either way)?
    const rel = bd - me.d;
    const prev = ballRel.get(b.id);
    ballRel.set(b.id, rel);
    const passed = Math.abs(rel) < 0.9 || (prev !== undefined && Math.sign(prev) !== Math.sign(rel));
    if (untouchable || !passed || Math.abs(me.x - b.lane) > 0.6 || me.y > 0.8) continue;
    bowled.add(b.id);
    act({ type: "bowled", id: b.id });
    hit("bowling");
  }
  // bananas, glue and fake boxes on the track (yours too!)
  for (const b of net.view?.bananas || []) {
    if (b.kind === "glue") {
      // a sticky puddle 2 lanes wide and about 3 m long: slows you while you're in it
      const inLane = Math.abs(me.x - b.lane) < 0.6 || Math.abs(me.x - glueLane2(b.lane)) < 0.6;
      if (!inLane || me.y > 0.4 || me.power === "rocket" || Math.abs(b.d - me.d) > 1.6) continue;
      if (me.glueT <= 0) {
        banner("🟢 STUCK IN GLUE!", 700);
        sfx.pop();
        if (!slipped.has(b.id) && b.by !== playerId) act({ type: "slip", id: b.id });
        slipped.add(b.id);
      }
      me.glueT = 0.6;
      continue;
    }
    if (untouchable || slipped.has(b.id)) continue;
    if (b.d < prevD - 0.6 || b.d > me.d + 0.6) continue;
    if (Math.abs(me.x - b.lane) > 0.55 || me.y > (b.kind === "fake" ? 1.6 : 0.5)) continue;
    slipped.add(b.id);
    act({ type: "slip", id: b.id });
    if (b.kind === "fake") {
      banner("💥 FAKE BOX!", 900);
      flash();
    }
    hit(b.kind === "fake" ? "fake" : "banana");
  }
  for (const b of course.slows ?? []) {
    if (b.z < prevD - 1 || b.z > me.d + 1) continue;
    if (Math.abs(me.x - b.lane) < 0.5 && me.y < 0.5 && me.power !== "rocket" && (me.slowPadT ?? 0) <= 0) {
      me.slowPadT = SLOW_PAD_MS / 1000;
      me.boostT = 0;
      sfx.slip();
      buzz(40);
      banner("🐢 SLOWED!", 700);
    }
  }
  for (const b of course.boosts) {
    if (b.z < prevD - 1 || b.z > me.d + 1) continue;
    if (Math.abs(me.x - b.lane) < 0.5 && me.y < 0.5 && me.boostT < BOOST_S - 0.2) {
      me.boostT = BOOST_S;
      sfx.boost();
      banner("BOOST!", 700);
    }
  }
}

function hit(kind) {
  if (me.invulnT > 0 || me.stumbleT > 0) return;
  if (me.power === "shield") {
    endPower();
    me.invulnT = 0.8;
    sfx.pop();
    banner("SHIELD SAVED YOU!", 900);
    return;
  }
  if (me.power === "rocket" || me.power === "ghost") return;
  if (me.out) return;
  // power-ups trip you and slow you down, but only obstacles cost a heart
  const fromPower = POWER_HITS.has(kind);
  // the tutorial run can't be lost: bumps there cost no heart
  if (!(fromPower && heartsFromHits()) && !coach.on) me.hits += 1;
  game.lastHitD = me.d;
  me.combo = 0;
  renderCombo();
  if (heartsFromHits() && !fromPower) {
    renderHearts(true);
    if (me.hits >= livesNow()) {
      knockOut();
      return;
    }
  }
  me.stumbleT = STUMBLE_S;
  me.invulnT = INVULN_S;
  me.boostT = 0;
  me.slideT = 0;
  me.vy = 0;
  shake = 0.55;
  if (kind === "banana") sfx.slip();
  else if (kind === "fake") sfx.boom();
  else sfx.hit();
  setTimeout(() => sfx.dizzy(), 260);
  buzz([60, 40, 90]);
  // a burst of sparks where you hit, and a red flash round the screen edge
  world.burst(laneX(me.x), 1.1, -me.d - 0.9, ["#ffffff", "#ffd23f", "#ff7a1a"], 34);
  const hf = $("#hitFx");
  hf.classList.remove("on");
  void hf.offsetWidth;
  hf.classList.add("on");
  const hintText = {
    hurdle: "Jump! ↑",
    gate: "Slide! ↓",
    crate: "Dodge! ← →",
    roller: "Jump the barrel! ↑",
    zap: "ZAPPED! ⚡",
    banana: "Slipped on a banana! 🍌",
    bowling: "STRIKE! 🎳",
    fake: "It was a trap! 💥",
    log: "Jump the log! ↑",
    bees: "Slide under the bees! ↓",
    tractor: "Dodge the tractor! ← →",
    chicken: "Hop over the chicken! ↑",
    crab: "Jump the crab! ↑",
  }[kind] || "Ouch!";
  if (kind === "fake") banner(hintText, 900); // the rest is plain to see: no banner over the track
}

const slipped = new Set(); // banana ids you've already run onto
const bowled = new Set(); // bowling balls that already got you
const ballRel = new Map(); // ball id -> where it was relative to you last frame

// ── style points & combos ──

function style(text, points) {
  me.combo += 1;
  me.bestCombo = Math.max(me.bestCombo, me.combo);
  challenge("combo", me.combo);
  stats.max("bestCombo", me.combo);
  const mult = Math.min(5, 1 + Math.floor(me.combo / 4)); // x2 from 4 in a row, up to x5
  const gained = points * mult;
  me.score += gained;
  challenge("style", me.score); // counted for missions, never shown as "+10" pop-ups
  renderCombo();
}
function renderCombo() {
  const c = $("#combo");
  const mult = Math.min(5, 1 + Math.floor(me.combo / 4));
  c.classList.toggle("show", me.combo >= 2);
  c.textContent = `${me.combo} combo${mult > 1 ? ` · x${mult}` : ""} · ${me.score}`;
}

// ── announcer feed ──

function feed(text) {
  const list = $("#feed");
  const item = el("div", { class: "feed-item", text });
  list.prepend(item);
  while (list.children.length > 4) list.lastChild.remove();
  setTimeout(() => item.classList.add("gone"), 3600);
  setTimeout(() => item.remove(), 4200);
}
const nameOf = (id) => (id === playerId ? "You" : net.view?.players.find((p) => p.id === id)?.name ?? "Someone");

/** Turn what changed in the room into callouts (and emote bubbles). */
function announce(prev, v) {
  // (re)start the "already seen" lists on the first view of a room or a new round
  if (!prev || !game.seen || v.round !== prev.round) {
    game.seen = { bowls: new Set((v.bowls || []).map((b) => b.id)), bananas: new Set((v.bananas || []).map((b) => b.id)), emotes: new Set((v.emotes || []).map((e) => e.id)), zaps: new Set((v.zaps || []).map((z) => z.id)), hits: new Set((v.hits || []).map((h) => h.id)) };
    return;
  }
  const seen = game.seen;
  if (!seen) return;
  for (const e of v.emotes || []) {
    if (seen.emotes.has(e.id)) continue;
    seen.emotes.add(e.id);
    showEmote(e.by, e.e);
  }
  if (v.phase !== "race") return;
  for (const p of v.players) {
    const was = prev.players.find((q) => q.id === p.id);
    if (was && was.outAt == null && p.outAt != null) feed(`💥 ${p.id === playerId ? "You are" : `${p.name} is`} out!`);
    if (was && was.finish == null && p.finish != null) feed(`🏁 ${p.id === playerId ? "You" : p.name} crossed the line!`);
  }
  const fresh = (list, set) => (list || []).filter((x) => !set.has(x.id) && set.add(x.id));
  for (const z of fresh(v.zaps, seen.zaps)) {
    if (z.kind === "thunder") continue; // the hit line covers it
    feed({ freeze: `❄️ ${nameOf(z.by)} froze everyone`, brainwave: `🌀 ${nameOf(z.by)} sent a brain wave`, mud: `🟤 ${nameOf(z.by)} threw mud` }[z.kind] ?? `⚡ ${nameOf(z.by)} called lightning`);
  }
  for (const b of fresh(v.bowls, seen.bowls)) feed(`🎳 ${nameOf(b.by)} rolled a bowling ball ${b.dir > 0 ? "ahead" : "back"}`);
  for (const b of fresh(v.bananas, seen.bananas)) {
    // a fake box is a secret: no callout
    if (b.kind === "glue") feed(`🟢 ${nameOf(b.by)} spilled glue`);
    else if (b.kind !== "fake" || b.by === playerId) feed(b.kind === "fake" ? "🎁 You set a fake box" : `🍌 ${nameOf(b.by)} dropped a banana in lane ${b.lane + 1}`);
  }
  if (v.cloud && v.cloud.id !== seen.cloud) {
    seen.cloud = v.cloud.id;
    feed(`⛈️ ${nameOf(v.cloud.by)} put a storm on ${v.cloud.holder === playerId ? "you" : nameOf(v.cloud.holder)}!`);
  }
  for (const h of fresh(v.hits, seen.hits)) {
    const victim = h.victim === playerId ? "You" : nameOf(h.victim);
    const whose = h.by === playerId ? "your" : `${nameOf(h.by)}'s`;
    const by = h.by === playerId ? "You" : nameOf(h.by);
    feed(
      {
        banana: `🍌 ${victim} slipped on ${whose} banana!`,
        bowling: `🎳 ${victim} got bowled over by ${whose} ball!`,
        glue: `🟢 ${victim} got stuck in ${whose} glue!`,
        fake: `🎁 ${victim} opened ${whose} fake box!`,
        swap: `🔄 ${by} swapped places with ${h.victim === playerId ? "you" : nameOf(h.victim)}!`,
        thunder: `⛈️ ${victim} got struck by ${whose} thundercloud!`,
        boxing: `🥊 ${by} punched ${h.victim === playerId ? "you" : nameOf(h.victim)}!`,
      }[h.kind] ?? `${victim} got hit!`,
    );
    if (h.by === playerId && h.victim !== playerId && game.mode === "race") {
      style({ banana: "BANANA HIT!", bowling: "STRIKE!", fake: "GOTCHA!", thunder: "THUNDER!", boxing: "KNOCKOUT PUNCH!", glue: "STICKY!", swap: "MIND SWAP!" }[h.kind] ?? "HIT!", 50);
      game.kos = (game.kos ?? 0) + 1;
    }
  }
}

// ── emotes ──

function sendEmote(e) {
  if (!net.view?.joined) return;
  act({ type: "emote", e });
  $("#emoteMenu").classList.remove("show");
}
function showEmote(id, e) {
  if (game.mode === "race" || game.mode === "results-pending") {
    const r = id === playerId ? me.runner : remote.map.get(id)?.runner;
    if (r) world.emoteBubble(r, e);
    feed(`${e} ${nameOf(id)}`);
  } else {
    // remembered for a moment: the lobby redraws its cards on every update, and the emote has to survive that
    game.liveEmotes = { ...(game.liveEmotes ?? {}), [id]: { e, at: Date.now() } };
    paintEmotes();
  }
}
const EMOTE_SHOW_MS = 2200;
/** Put the emotes still floating back onto the (possibly redrawn) lobby cards. */
function paintEmotes() {
  const now = Date.now();
  for (const card of document.querySelectorAll("#slots .rcard, #luStage .lx-ped")) {
    const x = game.liveEmotes?.[card.dataset.id];
    const old = card.querySelector(".emo");
    if (!x || now - x.at > EMOTE_SHOW_MS) continue;
    if (old && old.textContent === x.e && old.dataset.at === String(x.at)) continue;
    old?.remove();
    const b = el("span", { class: "emo", text: x.e, style: `animation-delay:-${now - x.at}ms` });
    b.dataset.at = String(x.at);
    card.append(b);
  }
}
function renderEmoteRows() {
  const mine = [...EMOTES, ...SHOP_EMOTES.filter((e) => wallet.has(`emote:${e}`))];
  for (const box of document.querySelectorAll(".emote-row")) {
    box.replaceChildren(
      ...mine.map((e) => {
        const b = el("button", { type: "button", class: "emote-btn", text: e });
        b.addEventListener("click", () => sendEmote(e));
        return b;
      }),
    );
  }
}
renderEmoteRows();
$("#emoteToggle").addEventListener("click", () => $("#emoteMenu").classList.toggle("show"));

// ── daily challenges: three a day (easy, medium, hard), coins for each ──

const CHALLENGE_POOL = {
  easy: [
    { stat: "dist", goal: 300, text: "Run 300 m in one race" },
    { stat: "boxes", goal: 3, text: "Grab 3 mystery boxes in one race" },
    { stat: "bananas", goal: 1, text: "Throw a banana" },
    { stat: "combo", goal: 5, text: "Reach a 5 combo" },
    { stat: "nohit", goal: 150, text: "Run 150 m without getting hit" },
  ],
  medium: [
    { stat: "dist", goal: 700, text: "Run 700 m in one race" },
    { stat: "boxes", goal: 6, text: "Grab 6 mystery boxes in one race" },
    { stat: "bananas", goal: 3, text: "Throw 3 bananas in one race" },
    { stat: "combo", goal: 10, text: "Reach a 10 combo" },
    { stat: "survive", goal: 60, text: "Survive 60 seconds in Survival" },
    { stat: "nohit", goal: 350, text: "Run 350 m without getting hit" },
  ],
  hard: [
    { stat: "dist", goal: 1500, text: "Run 1500 m in one race" },
    { stat: "combo", goal: 18, text: "Reach an 18 combo" },
    { stat: "style", goal: 2500, text: "Score 2500 style points in one race" },
    { stat: "survive", goal: 120, text: "Survive 2 minutes in Survival" },
    { stat: "nohit", goal: 700, text: "Run 700 m without getting hit" },
    { stat: "boxes", goal: 10, text: "Grab 10 mystery boxes in one race" },
  ],
};
const CHALLENGE_COINS = { easy: 100, medium: 200, hard: 400 };
const STAT_ICON = {
  dist: "/assets/ui_shoe.webp",
  boxes: "/assets/ui_box.webp",
  bananas: "/assets/pw_banana.png",
  combo: "/assets/ui_flame.webp",
  nohit: "/assets/pw_shield.png",
  survive: "/assets/ui_watch.webp",
  style: "/assets/ui_star.webp",
};
/** "05:12:33" until local midnight, when the day's rewards reset. */
function untilMidnight() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const t = Math.max(0, Math.floor((end - now) / 1000));
  return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map((x) => String(x).padStart(2, "0")).join(":");
}
setInterval(() => {
  if (game.mode === "home" && homePage === PAGE.missions) $("#questReset").textContent = untilMidnight();
}, 1000);
function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
const todayKey = () => dayKey();
function dayHash(salt) {
  let h = 2166136261;
  for (const ch of todayKey() + salt) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}
/** Today's three challenges, the same for everyone on the same date. */
function dailyChallenges() {
  return ["easy", "medium", "hard"].map((tier) => {
    const pool = CHALLENGE_POOL[tier];
    const c = pool[dayHash(tier) % pool.length];
    return { ...c, tier, id: `${tier}:${c.stat}:${c.goal}`, coins: CHALLENGE_COINS[tier] };
  });
}
function dailyState() {
  const fresh = { day: todayKey(), best: {}, done: {}, claimed: {} };
  try {
    const s = JSON.parse(local.getItem("lr:daily2") || "{}");
    if (s.day !== todayKey() || !s.best || !s.done) return fresh;
    // before claiming existed, finished missions were paid straight away
    if (!s.claimed) s.claimed = { ...s.done };
    return s;
  } catch {
    return fresh;
  }
}
/** Report a stat (dist, boxes, bananas, combo, nohit, survive, style). */
function challenge(stat, value) {
  const st = dailyState();
  let changed = false;
  for (const q of dailyChallenges()) {
    if (q.stat !== stat || st.done[q.id] || value <= (st.best[q.id] ?? 0)) continue;
    st.best[q.id] = value;
    changed = true;
    if (value >= q.goal) {
      st.done[q.id] = true;
      banner("MISSION COMPLETE!", 1600);
      toast(`✅ ${q.text} · claim it in Missions`);
      sfx.finish();
    }
  }
  if (!changed) return;
  local.setItem("lr:daily2", JSON.stringify(st));
  renderDaily();
}
function claimDaily(q, btn) {
  const st = dailyState();
  if (!st.done[q.id] || st.claimed[q.id]) return;
  st.claimed[q.id] = true;
  local.setItem("lr:daily2", JSON.stringify(st));
  wallet.addCoins(q.coins);
  passXp(150);
  coinRain(btn, 14);
  sfx.finish();
  toast(`+${q.coins} coins · +150 XP`);
  renderDaily();
}
function missionRow({ icon, tierClass = "", text, have, goal, reward, state, onClaim, extra }) {
  // state: active | ready | claimed | locked
  const pct = Math.round((Math.min(have, goal) / goal) * 100);
  let right;
  if (state === "ready") {
    right = el("button", { class: "aclaim", type: "button" }, el("span", { text: "CLAIM" }), el("b", { text: reward }));
    right.addEventListener("click", () => onClaim(right));
  } else right = el("div", { class: "qreward" }, el("img", { src: "/assets/ui_c1.webp", alt: "" }), el("b", { text: reward }));
  return el(
    "div",
    { class: `quest ${tierClass}${state === "claimed" ? " done" : ""}${state === "ready" ? " ready" : ""}${state === "locked" ? " locked" : ""}` },
    el("div", { class: "qicon" }, el("img", { src: icon, alt: "" })),
    el(
      "div",
      { class: "qmain" },
      el("b", { text }),
      el("div", { class: "qbar" }, el("i", { style: `width:${state === "claimed" || state === "ready" ? 100 : pct}%` }), el("span", { text: state === "claimed" ? "Claimed ✓" : state === "ready" ? "Complete!" : state === "locked" ? "Locked" : `${Math.min(have, goal).toLocaleString()} / ${goal.toLocaleString()}` })),
      extra ?? null,
    ),
    right,
    state === "claimed" ? el("span", { class: "qstamp", text: "Done ✓" }) : null,
  );
}
function renderDaily() {
  const qs = dailyChallenges();
  const st = dailyState();
  const n = qs.filter((q) => st.done[q.id]).length;
  const ready = qs.filter((q) => st.done[q.id] && !st.claimed[q.id]).length;
  $("#dailyDot").hidden = ready === 0;
  $("#questSub").textContent = n === qs.length ? (ready ? "All done! Claim your rewards." : "All done! New missions tomorrow.") : `${n}/${qs.length} done`;
  $("#questReset").textContent = untilMidnight();
  $("#questList").replaceChildren(
    ...qs.map((q) =>
      missionRow({
        icon: STAT_ICON[q.stat],
        text: q.text,
        have: st.best[q.id] ?? 0,
        goal: q.goal,
        reward: `+${q.coins}`,
        state: st.claimed[q.id] ? "claimed" : st.done[q.id] ? "ready" : "active",
        onClaim: (btn) => claimDaily(q, btn),
      }),
    ),
  );
  renderMissionDots();
}
renderDaily();

/** Little coins flying from a tile up to the coin counter. */
function coinRain(from, n) {
  const a = from.getBoundingClientRect();
  const target = [...document.querySelectorAll(".coin-chip, .wallet .chip")].find((e) => e.offsetParent);
  const b = target ? target.getBoundingClientRect() : { left: innerWidth - 60, top: 20, width: 0, height: 0 };
  for (let i = 0; i < n; i++) {
    const c = el("i", { class: "coin fly-coin" });
    const x0 = a.left + a.width / 2 + (Math.random() - 0.5) * 40;
    const y0 = a.top + a.height / 2 + (Math.random() - 0.5) * 30;
    c.style.left = `${x0}px`;
    c.style.top = `${y0}px`;
    document.body.append(c);
    const dx = b.left + b.width / 2 - x0;
    const dy = b.top + b.height / 2 - y0;
    c.animate(
      [
        { transform: "translate(0,0) scale(0.4)", opacity: 0 },
        { transform: `translate(${(Math.random() - 0.5) * 80}px, ${-40 - Math.random() * 60}px) scale(1.2)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0.9 },
      ],
      { duration: 900 + i * 35, easing: "cubic-bezier(.3,.7,.4,1)", fill: "forwards" },
    ).onfinish = () => c.remove();
  }
}
// ── ranking: leagues climbed with medal points ──

/** Leagues are climbed with medal points: every medal you earn counts, spending them doesn't. Off the podium still gets 1. */
const MEDAL_PTS = { gold: 10, silver: 5, bronze: 3 };
const LAST_PLACE_PTS = 1;
const LEAGUES = [
  { id: "bronze", name: "Bronze", min: 0, steps: [0, 10, 20] },
  { id: "silver", name: "Silver", min: 40, steps: [40, 60, 80] },
  { id: "gold", name: "Gold", min: 110, steps: [110, 140, 170] },
  { id: "platinum", name: "Platinum", min: 220, steps: [220, 260, 300] },
  { id: "diamond", name: "Diamond", min: 360, steps: [360, 420, 480] },
  { id: "master", name: "Legend", min: 560, steps: [560] },
];
/** Points were 3 / 2 / 1 per medal before (leagues 4× smaller): scale old totals once. */
const LP_VERSION = "2";
const ROMAN = ["I", "II", "III"];
const RACE_COINS = [60, 40, 25, 15];
function rankOf(rp) {
  const lg = [...LEAGUES].reverse().find((l) => rp >= l.min) ?? LEAGUES[0];
  const div = lg.steps.filter((x) => rp >= x).length - 1;
  const all = LEAGUES.flatMap((l) => l.steps);
  const from = lg.steps[div];
  const next = all.find((x) => x > rp) ?? null;
  return {
    league: lg,
    div,
    from,
    next,
    img: `/assets/lg_${lg.id}.webp`,
    name: lg.steps.length > 1 ? `${lg.name} ${ROMAN[div]}` : lg.name,
  };
}
const rank = {
  /** League points: 10 per gold, 5 per silver, 3 per bronze medal ever earned. */
  points() {
    let raw = local.getItem("lr:lp");
    if (raw !== null && local.getItem("lr:lpv") !== LP_VERSION) {
      raw = String(Math.round((Number(raw) || 0) * 4));
      local.setItem("lr:lp", raw);
    }
    local.setItem("lr:lpv", LP_VERSION);
    if (raw === null) {
      // first run with medal leagues: count the medals you hold plus the ones spent on characters
      let pts = 0;
      const m = wallet.medals();
      for (const k of MEDALS) pts += m[k] * MEDAL_PTS[k];
      for (const c of COLLECTION) if (c.legacy && wallet.has(c.id)) pts += c.legacy.count * MEDAL_PTS[c.legacy.medal];
      local.setItem("lr:lp", String(pts));
      // friends' old rank points don't mean anything any more; they update the next time you race them
      const f = friendsList();
      for (const id of Object.keys(f)) f[id].rp = 0;
      local.setItem("lr:friends", JSON.stringify(f));
      return pts;
    }
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.min(99999, Math.floor(n)) : 0;
  },
  rp() {
    return this.points();
  },
  add(n) {
    const before = this.points();
    const after = before + n;
    local.setItem("lr:lp", String(after));
    renderRankPill();
    renderTrophyRoad();
    const a = rankOf(after);
    if (a.name !== rankOf(before).name) {
      setTimeout(() => {
        banner(`${a.name.toUpperCase()}!`, 2200);
        toast(`Promoted to ${a.name}!`);
        sfx.finish();
      }, 700);
    }
    return { delta: n, before, after };
  },
};

// ── lifetime stats (for all-time challenges) ──

const stats = {
  all() {
    try {
      const s = JSON.parse(local.getItem("lr:stats") || "{}");
      return s && typeof s === "object" ? s : {};
    } catch {
      return {};
    }
  },
  get(k) {
    return Number(this.all()[k]) || 0;
  },
  set(k, v) {
    const s = this.all();
    s[k] = v;
    local.setItem("lr:stats", JSON.stringify(s));
    renderAchDot();
  },
  add(k, n) {
    this.set(k, this.get(k) + n);
  },
  max(k, v) {
    if (v > this.get(k)) this.set(k, v);
  },
};
/** Count a finished race once: coins, XP, stats. Returns what it paid. */
/** Your record against each real friend you've raced: wins (you finished ahead) and losses. */
function headToHead() {
  try {
    const h = JSON.parse(local.getItem("lr:h2h") || "{}");
    return h && typeof h === "object" ? h : {};
  } catch {
    return {};
  }
}
function recordRace(v, place) {
  if (!place) return null;
  let done = [];
  try { done = JSON.parse(local.getItem("lr:counted") || "[]"); } catch { /* fresh */ }
  if (!Array.isArray(done)) done = [];
  const key = `${v.startAt}:${playerId}`;
  if (done.includes(key)) return null;
  done.push(key);
  local.setItem("lr:counted", JSON.stringify(done.slice(-60)));
  const n = v.standings.length;
  const mine = v.players.find((p) => p.id === playerId);
  const d = Math.round(mine?.d ?? 0);
  stats.add("races", 1);
  stats.add("dist", d);
  // "with friends" trophies only count races with at least two real people
  const real = v.players.filter((p) => !p.bot).length;
  if (real >= 2 && place === 1) stats.add("wins", 1);
  if (real >= 2 && place <= 3) stats.add("podiums", 1);
  if (n < 2 && v.kind === "survival") stats.max("bestRun", d);
  // the Stats page: places, per mode, and head-to-head against real friends
  if (n >= 2 && place <= 4) stats.add(`place${place}`, 1);
  stats.add(`mode_${v.kind}`, 1);
  if (real >= 2) {
    const h2h = headToHead();
    v.standings.forEach((id, i) => {
      const p = v.players.find((x) => x.id === id);
      if (!p || p.bot || id === playerId) return;
      const rec = h2h[id] ?? { name: p.name, char: p.char, w: 0, l: 0 };
      rec.name = p.name;
      rec.char = p.char;
      if (place - 1 < i) rec.w += 1;
      else rec.l += 1;
      h2h[id] = rec;
    });
    local.setItem("lr:h2h", JSON.stringify(h2h));
  }
  // coins for every race: by place against everyone (bots too), plus hits you landed
  const kos = game.kos ?? 0;
  stats.max("bestDist", d);
  if (place === 1 && n >= 2) stats.add("winsAny", 1);
  if (kos) stats.add("kos", kos);
  const modes = new Set(String(stats.all().modes ?? "").split(",").filter(Boolean));
  if (!modes.has(v.kind)) stats.set("modes", [...modes, v.kind].join(","));
  if (v.kind === "coinrush") stats.add("rushCoins", mine?.coins ?? 0);
  if (v.kind === "chase") stats.max("chaseBest", Math.round(((mine?.outAt ?? v.endAt ?? Date.now()) - v.startAt) / 1000));
  if (v.cup && v.cup.race >= v.cup.races.length && v.cup.table?.[0] === playerId) stats.add("cupWins", 1);
  // rounds of a multi-round match pay double
  const coins = ((n >= 2 ? RACE_COINS[place - 1] ?? 10 : Math.max(5, Math.min(60, Math.floor(d / 25)))) + 10 * kos) * (v.cup ? 2 : 1);
  wallet.addCoins(coins);
  const prize = tourneyPrize(v);
  const league = leagueMatch(n, place);
  const res = {};
  res.coins = coins;
  res.kos = kos;
  res.prize = prize;
  res.league = league;
  // season XP: everyone gets some for racing, more for a good place
  res.xp = passXp(n >= 2 ? 60 + ([60, 40, 20][place - 1] ?? 0) : 40 + Math.min(60, Math.floor(d / 50)));
  res.botsOnly = real < 2 && n >= 2;
  return res;
}
/** League progress after a race: the medal points it added, if any. */
function rankChip(gained) {
  const pts = rank.points();
  const r = rankOf(pts);
  return el(
    "span",
    { class: `rpchip${gained ? " up" : ""}` },
    el("img", { src: r.img, alt: "" }),
    el("b", { text: gained ? `+${gained} league pts` : r.name }),
    el("small", { text: r.next == null ? `${r.name} · top league` : `${r.name} · ${r.next - pts} pts to ${rankOf(r.next).name}` }),
  );
}
function renderRankPill() {
  const rp = rank.rp();
  const r = rankOf(rp);
  $("#rankPillImg").src = r.img;
  $("#rankBadgeBtn").title = `${r.name} · ${rp} league pts`;
  renderProfile();
  // the league card on the Tournaments page
  $("#leagueImg").src = r.img;
  $("#leagueName").textContent = r.name;
  $("#leagueBar").style.width = r.next == null ? "100%" : `${Math.round(((rp - r.from) / (r.next - r.from)) * 100)}%`;
  $("#leagueNext").textContent = r.next == null ? `${rp} pts · top league` : `${rp} pts · ${r.next - rp} more to ${rankOf(r.next).name}`;
}

// ── friends: everyone you've been in a room with, and their rank ──

function friendsList() {
  try {
    const f = JSON.parse(local.getItem("lr:friends") || "{}");
    return f && typeof f === "object" ? f : {};
  } catch {
    return {};
  }
}
function rememberFriends(v) {
  const f = friendsList();
  let changed = false;
  for (const p of v.players) {
    if (p.id === playerId || !p.name) continue;
    const old = f[p.id];
    if (old && old.rp === (p.rp ?? 0) && old.name === p.name && old.char === p.char) continue;
    f[p.id] = { name: p.name, char: p.char, rp: p.rp ?? 0, country: p.country || "", seen: Date.now() };
    changed = true;
  }
  if (!changed) return;
  // keep the 40 most recent
  const keep = Object.entries(f).sort((a, b) => b[1].seen - a[1].seen).slice(0, 40);
  local.setItem("lr:friends", JSON.stringify(Object.fromEntries(keep)));
}

const rankModal = $("#rankModal");
function renderRank() {
  const rp = rank.rp();
  const r = rankOf(rp);
  $("#rankBadge").src = r.img;
  $("#rankName").textContent = r.name;
  $("#rankRp").textContent = `${rp.toLocaleString()} league pts`;
  const pct = r.next === null ? 100 : Math.round(((rp - r.from) / (r.next - r.from)) * 100);
  $("#rankBar").style.width = `${pct}%`;
  $("#rankNext").textContent = r.next === null ? "Top league!" : `${rp} / ${r.next}`;
  const rows = [
    { id: playerId, name: myName() || "You", char: preferredChar(), rp, country: myCountry(), me: true },
    ...Object.entries(friendsList()).map(([id, f]) => ({ id, ...f })),
  ].sort((a, b) => b.rp - a.rp);
  $("#friendList").replaceChildren(
    ...rows.map((f, i) => {
      const fr = rankOf(f.rp);
      return el(
        "div",
        { class: `rrow${f.me ? " me" : ""}${i < 3 ? ` top${i + 1}` : ""}` },
        el("span", { class: "rpos", text: String(i + 1) }),
        el("img", { class: "rface", src: f.me ? myAvatar() : portrait(f.char ?? 0), alt: "" }),
        el("span", { class: "rwho" }, el("b", { text: withFlag(f.name, f.country) + (f.me ? " (you)" : "") }), el("small", { text: fr.name })),
        el("img", { class: "rlg", src: fr.img, alt: "" }),
        el("b", { class: "rrp", text: f.rp.toLocaleString() }),
      );
    }),
    ...(rows.length < 2 ? [el("p", { class: "rempty", text: "Race friends to see them here." })] : []),
  );
  $("#leagueList").replaceChildren(
    ...[...LEAGUES].reverse().map((l) => el(
      "div",
      { class: `lrow ${l.id}${l.id === r.league.id ? " me" : ""}` },
      el("img", { src: `/assets/lg_${l.id}.webp`, alt: "" }),
      el("span", { class: "rwho" }, el("b", { text: l.name }), el("small", { text: `from ${l.min.toLocaleString()} pts${l.steps.length > 1 ? " · I · II · III" : ""}` })),
      l.id === r.league.id ? el("span", { class: "you-tag", text: "You" }) : null,
    )),
    el(
      "div",
      { class: "rhow-pts" },
      ...[["gold", 10, "1st"], ["silver", 5, "2nd"], ["bronze", 3, "3rd"]].map(([m, pts, place]) => el("span", {}, el("img", { src: MEDAL_IMG[m], alt: "" }), el("b", { text: `+${pts}` }), el("small", { text: place }))),
    ),
    el("p", { class: "rhow", text: "Top 3 against real players wins medals." }),
  );
}
function rankTab(friends) {
  $("#tabFriends").classList.toggle("on", friends);
  $("#tabLeagues").classList.toggle("on", !friends);
  $("#friendList").hidden = !friends;
  $("#leagueList").hidden = friends;
}
// your league, medals and rewards all live on the Trophy Road
function openRank() {
  openRoad();
}
$("#rankBadgeBtn").addEventListener("click", openRank);
$("#leagueCard").addEventListener("click", openRank);
for (const chip of document.querySelectorAll(".medal-chip")) chip.addEventListener("click", openRank);
$("#profileCard").addEventListener("click", openStats);
// ── Stats page: places, records, modes, and how you stand among your friends ──
const statsModal = $("#statsModal");
const MODE_STAT = [["survival", "❤️ Survival"], ["chase", "🧠 Brain Chase"], ["coinrush", "🪙 Coin Rush"], ["potato", "💣 Hot Potato"]];
function openStats() {
  sfx.tap();
  renderStats();
  statsModal.hidden = false;
}
$("#statsClose").addEventListener("click", () => (statsModal.hidden = true));
$("#statsBody").addEventListener("click", (e) => {
  if (e.target.closest('[data-go="avatar"]')) return openAvatar();
  if (!e.target.closest('[data-go="rank"]')) return;
  statsModal.hidden = true;
  openRank();
});
statsModal.addEventListener("click", (e) => e.target === statsModal && (statsModal.hidden = true));
function renderStats() {
  const st = stats.all();
  const n = (k) => Number(st[k]) || 0;
  const rp = rank.rp();
  const r = rankOf(rp);
  const placed = n("place1") + n("place2") + n("place3") + n("place4");
  const tile = (icon, label, value, cls = "") => el("div", { class: `stile ${cls}` }, el("i", { text: icon }), el("b", { text: value }), el("small", { text: label }));
  const big = (img, label, value) => el("div", { class: "splace" }, el("img", { src: img, alt: "" }), el("b", { text: String(value) }), el("small", { text: label }));
  // friends: everyone you've raced, ranked by league points, with your head-to-head record
  const h2h = headToHead();
  const friends = Object.entries(friendsList()).map(([id, f]) => ({ id, ...f, rec: h2h[id] }));
  const table = [{ id: playerId, name: myName() || "You", char: preferredChar(), rp, me: true }, ...friends].sort((a, b) => (b.rp ?? 0) - (a.rp ?? 0));
  const myPos = table.findIndex((x) => x.me) + 1;
  $("#statsBody").replaceChildren(
    el(
      "div",
      { class: "stats-hero" },
      el("button", { class: "sh-av-btn", type: "button", "data-go": "avatar", "aria-label": "Change profile picture" }, el("img", { class: "sh-av", src: myAvatar(), alt: "" }), el("i", { text: "✏️" })),
      el("div", {}, el("b", { text: myName() || "Runner" }), el("span", {}, el("img", { src: r.img, alt: "" }), `${r.name} · ${rp.toLocaleString()} pts`)),
      el("button", { class: "btn small blue", type: "button", "data-go": "rank", text: "Rankings ›" }),
    ),
    el("h3", { class: "stats-h", text: "Places" }),
    el(
      "div",
      { class: "splaces" },
      big(MEDAL_IMG.gold, "1st", n("place1")),
      big(MEDAL_IMG.silver, "2nd", n("place2")),
      big(MEDAL_IMG.bronze, "3rd", n("place3")),
      el("div", { class: "splace rate" }, el("b", { text: placed ? `${Math.round((n("place1") / placed) * 100)}%` : "–" }), el("small", { text: "win rate" })),
    ),
    el("h3", { class: "stats-h", text: "Records" }),
    el(
      "div",
      { class: "sgrid" },
      tile("🏁", "races played", n("races").toLocaleString()),
      tile("♾️", "best endless run", `${n("bestRun").toLocaleString()} m`, "hot"),
      tile("📏", "longest race", `${n("bestDist").toLocaleString()} m`),
      tile("🦶", "run in total", `${(n("dist") / 1000).toFixed(1)} km`),
      tile("🥇", "gold medals ever", goldEver().toLocaleString()),
      tile("👥", "wins vs friends", n("wins").toLocaleString()),
      tile("🧠", "best Brain Chase", `${n("chaseBest")} s`),
      tile("🪙", "Coin Rush coins", n("rushCoins").toLocaleString()),
      tile("🥊", "hits landed", n("kos").toLocaleString()),
      tile("🔥", "best combo", n("bestCombo").toLocaleString()),
    ),
    el("h3", { class: "stats-h", text: "By mode" }),
    el("div", { class: "smodes" }, ...MODE_STAT.map(([k, label]) => el("div", { class: "smode" }, el("span", { text: label }), el("b", { text: `${n(`mode_${k}`)} races` })))),
    el("h3", { class: "stats-h", text: friends.length ? `Among your friends · you're #${myPos} of ${table.length}` : "Among your friends" }),
    friends.length
      ? el(
          "div",
          { class: "sfriends" },
          ...table.slice(0, 12).map((x, i) =>
            el(
              "div",
              { class: `sfriend${x.me ? " me" : ""}` },
              el("em", { text: `#${i + 1}` }),
              el("img", { src: x.me ? myAvatar() : portrait(x.char ?? 0), alt: "" }),
              el("span", {}, el("b", { text: x.me ? `${x.name} (you)` : x.name }), el("small", { text: `${rankOf(x.rp ?? 0).name} · ${(x.rp ?? 0).toLocaleString()} pts` })),
              x.me ? el("i", { text: "" }) : el("i", { class: "h2h", text: x.rec ? `${x.rec.w}–${x.rec.l}` : "–", title: "Your wins – losses against them" }),
            ),
          ),
        )
      : el("p", { class: "stats-empty", text: "Race friends to compare here." }),
  );
}
/** Top-left profile on the Play page: your runner, your name, your league. */
// ── profile picture: any character you own (by default, the runner you race with) ──
function myAvatarChar() {
  const id = local.getItem("lr:avatar");
  const c = id ? allChars().find((x) => x.id === id) : null;
  return c && ownsChar(c) ? c : null;
}
function myAvatar() {
  return myAvatarChar()?.img ?? portrait(preferredChar());
}
const avatarModal = $("#avatarModal");
function openAvatar() {
  sfx.tap();
  renderAvatarGrid();
  avatarModal.hidden = false;
}
function renderAvatarGrid() {
  const mine = myAvatarChar();
  const chars = allChars().sort((a, b) => Number(ownsChar(b)) - Number(ownsChar(a)));
  $("#avatarGrid").replaceChildren(
    el("button", { class: `av-tile auto${mine ? "" : " on"}`, type: "button", "data-av": "" }, el("img", { src: portrait(preferredChar()), alt: "" }), el("small", { text: "My runner" })),
    ...chars.map((c) => {
      const owned = ownsChar(c);
      return el(
        "button",
        { class: `av-tile ${c.rarity}${owned ? "" : " locked"}${mine?.id === c.id ? " on" : ""}`, type: "button", "data-av": c.id, "aria-label": owned ? c.name : `${c.name} (locked)` },
        el("img", { src: c.img, alt: "" }),
        el("small", { text: owned ? c.name : "🔒" }),
      );
    }),
  );
}
$("#avatarGrid").addEventListener("click", (e) => {
  const t = e.target.closest("[data-av]");
  if (!t) return;
  if (t.classList.contains("locked")) {
    toast("Unlock this character to use its picture");
    return;
  }
  const id = t.dataset.av;
  if (id) local.setItem("lr:avatar", id);
  else local.removeItem("lr:avatar");
  sfx.pop();
  renderAvatarGrid();
  renderProfile();
  if (!statsModal.hidden) renderStats();
});
$("#avatarClose").addEventListener("click", () => (avatarModal.hidden = true));
avatarModal.addEventListener("click", (e) => e.target === avatarModal && (avatarModal.hidden = true));

function renderProfile() {
  const r = rankOf(rank.rp());
  $("#profAvatar").src = myAvatar();
  $("#profName").textContent = local.getItem("lr:name") || "Runner";
  $("#profLeagueImg").src = r.img;
  $("#profLeague").textContent = r.name;
}
$("#tabFriends").addEventListener("click", () => rankTab(true));
$("#tabLeagues").addEventListener("click", () => rankTab(false));
$("#rankClose").addEventListener("click", () => (rankModal.hidden = true));
rankModal.addEventListener("click", (e) => e.target === rankModal && (rankModal.hidden = true));
renderRankPill();
renderTrophyRoad();

// ── all-time challenges: lifetime goals in three tiers ──

const ACHIEVEMENTS = [
  { id: "races", stat: "races", text: (n) => `Play ${n} races`, tiers: [10, 50, 200], coins: [100, 300, 1000], icon: "/assets/ui_star.webp" },
  { id: "wins", stat: "wins", text: (n) => `Win ${n} race${n > 1 ? "s" : ""} with friends`, tiers: [1, 10, 50], coins: [150, 500, 2000], icon: "/assets/medal_gold.png" },
  { id: "podiums", stat: "podiums", text: (n) => `Finish top 3 with friends ${n} times`, tiers: [5, 25, 100], coins: [100, 400, 1500], icon: "/assets/medal_silver.png" },
  { id: "dist", stat: "dist", text: (n) => `Run ${n / 1000} km in total`, tiers: [5000, 25000, 100000], coins: [100, 400, 1500], icon: "/assets/ui_shoe.webp" },
  { id: "bestRun", stat: "bestRun", text: (n) => `Run ${n.toLocaleString()} m in one endless run`, tiers: [1000, 2500, 5000], coins: [150, 500, 2000], icon: "/assets/ui_watch.webp" },
  { id: "bananas", stat: "bananas", text: (n) => `Throw ${n} bananas`, tiers: [10, 50, 200], coins: [100, 300, 1000], icon: "/assets/pw_banana.png" },
  { id: "boxes", stat: "boxes", text: (n) => `Grab ${n} mystery boxes`, tiers: [25, 100, 500], coins: [100, 300, 1000], icon: "/assets/ui_box.webp" },
  { id: "bestCombo", stat: "bestCombo", text: (n) => `Reach a ${n} combo`, tiers: [10, 20, 30], coins: [100, 400, 1500], icon: "/assets/ui_flame.webp" },
  { id: "packs", stat: "packs", text: (n) => `Open ${n} pack${n > 1 ? "s" : ""}`, tiers: [1, 10, 50], coins: [100, 400, 1500], icon: "/assets/pack_mega.webp" },
];
function achClaimed() {
  try {
    const a = JSON.parse(local.getItem("lr:ach") || "{}");
    return a && typeof a === "object" ? a : {};
  } catch {
    return {};
  }
}
/** Next tier for an achievement: index, goal, progress, ready to claim? */
function achState(a) {
  const tier = Math.min(Number(achClaimed()[a.id]) || 0, a.tiers.length);
  const have = stats.get(a.stat);
  const goal = a.tiers[tier] ?? a.tiers[a.tiers.length - 1];
  return { tier, have, goal, done: tier >= a.tiers.length, ready: tier < a.tiers.length && have >= goal };
}
function renderAchDot() {
  // trophies are no longer shown; only the mission dots are kept up to date
  renderMissionDots();
}
/** The red dot on Missions: anything ready to claim in any tab. */
function renderMissionDots() {
  let career = false;
  try {
    career = careerReady() > 0;
  } catch {
    return; // still starting up: the career table isn't defined yet
  }
  const daily = dailyChallenges().some((q) => dailyState().done[q.id] && !dailyState().claimed[q.id]);
  const gold = road.ready().length > 0;
  $("#careerDot").hidden = !career;
  const dot = document.querySelector(`.htab[data-page="${PAGE.missions}"] .dot`);
  if (dot) dot.hidden = !(daily || career || gold);
  $("#dailyDot").hidden = !daily;
  renderStoreDot();
}

renderAchDot();

// ── season pass: 30 levels, a free and a gold track, a new season every month ──

const PASS_LEVELS = 30;
const PASS_XP = 400; // per level
/** Shown price of the Gold Pass. Payments aren't wired up yet: tapping the button unlocks it. */
const GOLD_PASS_PRICE_TEXT = "$4.99";
const PASS_CHAR = { id: "brainstorm", name: "Captain Brainstorm" };
function seasonId(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}
function seasonName(d = new Date()) {
  return d.toLocaleString("en", { month: "long" });
}
function passState() {
  const fresh = { season: seasonId(), xp: 0, free: [], gold: [], hasGold: false };
  try {
    const p = JSON.parse(local.getItem("lr:pass") || "{}");
    return p && p.season === seasonId() ? { ...fresh, ...p } : fresh;
  } catch {
    return fresh;
  }
}
function savePass(p) {
  local.setItem("lr:pass", JSON.stringify(p));
  renderPassPill();
}
// Kiko moved to the Season Pass: anyone who already claimed that level this season gets him now
if (!local.getItem("lr:kikoMove")) {
  local.setItem("lr:kikoMove", "1");
  if (passState().free.includes(PASS_RUNNERS[KIKO])) giveItem(KIKO);
}
function passLevel(xp) {
  return Math.min(PASS_LEVELS, Math.floor(xp / PASS_XP) + 1);
}
/** Add season XP; announces a level-up. Returns the XP added. */
function passXp(n) {
  const p = passState();
  const before = passLevel(p.xp);
  p.xp += n;
  savePass(p);
  const after = passLevel(p.xp);
  if (after > before) setTimeout(() => toast(`⭐ Season Pass level ${after}! A reward is waiting`), 1200);
  return n;
}
/** What each level gives. Free: coins, packs, a trail. Gold: more of everything, exclusives, and the level-30 character. Never medals: those are only won in races. */
function passReward(level, track) {
  if (track === "free") {
    if (level === 1) return { pack: "mega", label: "Mega Pack", img: "/assets/pack_mega.webp" };
    if (level === PASS_RUNNERS[KIKO]) return { runner: KIKO, label: RUNNERS[KIKO].name, img: portrait(KIKO) };
    if (level === 30) return { coins: 800, label: "800 coins", img: "/assets/ui_c3.webp" };
    if (level % 10 === 5) return { pack: "mega", label: "Mega Pack", img: "/assets/pack_mega.webp" };
    if (level % 4 === 0) return { coins: 120 + level * 15, label: `${120 + level * 15} coins`, img: "/assets/ui_c2.webp" };
    return { coins: 50 + level * 10, label: `${50 + level * 10} coins`, img: "/assets/ui_c1.webp" };
  }
  if (level === 30) return { char: PASS_CHAR.id, label: PASS_CHAR.name, img: `/assets/pk_${PASS_CHAR.id}.webp` };
  if (level === 10) return { item: "trail:neon", label: "Neon trail", icon: "🌈" };
  if (level === 20) return { coins: 1000, label: "1,000 coins", img: "/assets/ui_c3.webp" };
  if (level === 15 || level === 25) return { pack: "mega", label: "Mega Pack", img: "/assets/pack_mega.webp" };
  if (level % 5 === 0) return { pack: "mega", label: "Mega Pack", img: "/assets/pack_mega.webp" };
  return { coins: 150 + level * 15, label: `${150 + level * 15} coins`, img: level > 15 ? "/assets/ui_c3.webp" : "/assets/ui_c2.webp" };
}
function passClaimable(p = passState()) {
  const lv = passLevel(p.xp);
  let n = 0;
  for (let l = 1; l <= lv; l++) {
    if (!p.free.includes(l)) n++;
    if (p.hasGold && !p.gold.includes(l)) n++;
  }
  return n;
}
function claimPass(level, track, tile) {
  const p = passState();
  if (level > passLevel(p.xp) || p[track].includes(level) || (track === "gold" && !p.hasGold)) return;
  const r = passReward(level, track);
  p[track] = [...p[track], level];
  savePass(p);
  if (r.coins) {
    wallet.addCoins(r.coins);
    coinRain(tile, 12);
  } else if (r.medal) {
    const m = wallet.medals();
    m[r.medal] += 1;
    wallet.save(m);
  } else if (r.item) {
    giveItem(r.item);
    renderEmoteRows();
  } else if (r.char) {
    giveItem(r.char);
    renderCollPill();
  } else if (r.runner !== undefined) {
    // Kiko again in a later season: you already have him, so it pays coins
    if (wallet.owns(r.runner)) {
      wallet.addCoins(500);
      coinRain(tile, 12);
      toast(`${r.label} is already yours: +500 coins`);
    } else {
      giveItem(r.runner);
      renderCollPill();
      passModal.hidden = true;
      showUnlock({ kind: "char", char: { name: r.label, rarity: STARTER_RARITY[r.runner], img: `/assets/lu_${RUNNERS[r.runner].file}.webp` } });
    }
  }
  else if (r.pack) {
    const pk = PACKS.find((x) => x.id === r.pack);
    passModal.hidden = true;
    openPackAnim(pk, grantPack(pk));
  }
  sfx.finish();
  toast(`${r.label}!`);
  renderPass();
}
const passModal = $("#passModal");
function renderPassPill() {
  const p = passState();
  const lv = passLevel(p.xp);
  $("#passPillLv").textContent = `Level ${lv}`;
  const into = lv >= PASS_LEVELS ? PASS_XP : p.xp - (lv - 1) * PASS_XP;
  $("#passPillBar").style.width = `${Math.round((into / PASS_XP) * 100)}%`;
  const n = passClaimable(p);
  $("#passPillSub").textContent = n ? `${n} reward${n > 1 ? "s" : ""} ready to claim!` : lv >= PASS_LEVELS ? "Max level reached" : `${into} / ${PASS_XP} XP to level ${lv + 1}`;
  $("#passPill .dot").hidden = n === 0;
  renderStoreDot();
}
function renderPass() {
  const p = passState();
  const lv = passLevel(p.xp);
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const days = Math.max(0, Math.ceil((end - now) / 864e5));
  $("#passSeason").textContent = `Season · ${seasonName()}`;
  $("#passEnds").textContent = `Ends in ${days} day${days === 1 ? "" : "s"}`;
  $("#passLv").textContent = String(lv);
  const into = lv >= PASS_LEVELS ? PASS_XP : p.xp - (lv - 1) * PASS_XP;
  $("#passBar").style.width = `${Math.round((into / PASS_XP) * 100)}%`;
  $("#passXp").textContent = lv >= PASS_LEVELS ? "Max level!" : `${into} / ${PASS_XP} XP`;
  const tile = (level, track) => {
    const r = passReward(level, track);
    const got = p[track].includes(level);
    const reached = level <= lv;
    const locked = track === "gold" && !p.hasGold;
    const ready = reached && !got && !locked;
    const t = el(
      "button",
      { class: `ptile ${track}${got ? " got" : ""}${ready ? " ready" : ""}${!reached ? " future" : ""}${locked ? " locked" : ""}${r.char ? " star" : ""}`, type: "button" },
      r.img ? el("img", { src: r.img, alt: "" }) : el("i", { class: "big-emoji", text: r.icon }),
      el("small", { text: r.label }),
      got ? el("span", { class: "tick", text: "✓" }) : locked ? el("span", { class: "lock", text: "🔒" }) : null,
    );
    t.disabled = !ready;
    t.addEventListener("click", () => claimPass(level, track, t));
    return t;
  };
  const cols = [];
  for (let l = 1; l <= PASS_LEVELS; l++) {
    cols.push(el("div", { class: `pcol${l === lv ? " now" : ""}` }, el("span", { class: "plv", text: String(l) }), tile(l, "free"), tile(l, "gold")));
  }
  const track = $("#passTrack");
  track.replaceChildren(...cols);
  // scroll so the current level is in view
  requestAnimationFrame(() => {
    const cur = track.querySelector(".pcol.now");
    if (cur) track.scrollLeft = cur.offsetLeft - track.clientWidth / 2 + cur.clientWidth / 2;
  });
  const buy = $("#passBuy");
  buy.hidden = p.hasGold;
  buy.replaceChildren(el("span", { text: "Unlock Gold Pass" }), el("b", { class: "real-price", text: GOLD_PASS_PRICE_TEXT }));
  buy.disabled = false;
}
$("#passBuy").addEventListener("click", () => {
  const p = passState();
  if (p.hasGold) return;
  p.hasGold = true;
  savePass(p);
  sfx.finish();
  coinRain($("#passBuy"), 20);
  toast("Gold Pass unlocked! Claim your gold rewards");
  renderPass();
});
$("#passPill").addEventListener("click", () => {
  renderPass();
  passModal.hidden = false;
});
$("#passClose").addEventListener("click", () => (passModal.hidden = true));
passModal.addEventListener("click", (e) => e.target === passModal && (passModal.hidden = true));
renderPassPill();
renderCollPill();

// ── career: six chapters of missions, each unlocked by finishing the one before ──

const CAREER = [
  {
    name: "Rookie",
    chest: { coins: 300, pack: "mega" },
    missions: [
      { stat: "races", goal: 3, text: "Play 3 races", coins: 50, icon: "/assets/ui_star.webp" },
      { stat: "dist", goal: 1000, text: "Run 1 km in total", coins: 50, icon: "/assets/ui_shoe.webp" },
      { stat: "boxes", goal: 5, text: "Grab 5 mystery boxes", coins: 50, icon: "/assets/ui_box.webp" },
      { stat: "used", goal: 5, text: "Use 5 power-ups", coins: 50, icon: "/assets/pw_banana.png" },
    ],
  },
  {
    name: "Runner",
    chest: { coins: 600 },
    missions: [
      { stat: "races", goal: 10, text: "Play 10 races", coins: 80, icon: "/assets/ui_star.webp" },
      { stat: "winsAny", goal: 1, text: "Win a race (bots count)", coins: 100, icon: "/assets/medal_gold.png" },
      { stat: "bestDist", goal: 800, text: "Run 800 m in one race", coins: 100, icon: "/assets/ui_shoe.webp" },
      { stat: "bestCombo", goal: 10, text: "Reach a 10 combo", coins: 100, icon: "/assets/ui_flame.webp" },
    ],
  },
  {
    name: "Contender",
    chest: { coins: 500, pack: "mega" },
    missions: [
      { stat: "modes", goal: 4, text: "Play all 4 modes (Survival, Chase, Coin Rush, Potato)", coins: 150, icon: "/assets/ui_chest.webp" },
      { stat: "winsAny", goal: 3, text: "Win 3 races", coins: 150, icon: "/assets/medal_gold.png" },
      { stat: "kos", goal: 10, text: "Hit opponents 10 times", coins: 150, icon: "/assets/pw_boxing.png" },
      { stat: "rushCoins", goal: 100, text: "Collect 100 coins in Coin Rush", coins: 150, icon: "/assets/ui_c2.webp" },
    ],
  },
  {
    name: "Pro",
    chest: { coins: 1000, pack: "mega" },
    missions: [
      { stat: "chaseBest", goal: 120, text: "Survive 2 minutes in Brain Chase", coins: 200, icon: "/assets/ui_watch.webp" },
      { stat: "cupWins", goal: 1, text: "Win a match of 3+ rounds", coins: 250, icon: "/assets/medal_gold.png" },
      { stat: "packs", goal: 3, text: "Open 3 packs", coins: 200, icon: "/assets/pack_mega.webp" },
      { stat: "rp", goal: 40, text: "Reach the Silver league", coins: 250, icon: "/assets/lg_silver.webp" },
    ],
  },
  {
    name: "Champion",
    chest: { coins: 2000, pack: "mega" },
    missions: [
      { stat: "winsAny", goal: 15, text: "Win 15 races", coins: 300, icon: "/assets/medal_gold.png" },
      { stat: "dist", goal: 25000, text: "Run 25 km in total", coins: 300, icon: "/assets/ui_shoe.webp" },
      { stat: "bestCombo", goal: 20, text: "Reach a 20 combo", coins: 300, icon: "/assets/ui_flame.webp" },
      { stat: "rp", goal: 110, text: "Reach the Gold league", coins: 400, icon: "/assets/lg_gold.webp" },
    ],
  },
  {
    name: "Legend",
    chest: { coins: 5000, pack: "mega" },
    missions: [
      { stat: "winsAny", goal: 50, text: "Win 50 races", coins: 500, icon: "/assets/medal_gold.png" },
      { stat: "bestDist", goal: 3000, text: "Run 3,000 m in one race", coins: 500, icon: "/assets/ui_shoe.webp" },
      { stat: "chars", goal: 12, text: "Collect 12 characters", coins: 500, icon: "/assets/pk_brainz.webp" },
      { stat: "rp", goal: 220, text: "Reach the Platinum league", coins: 600, icon: "/assets/lg_platinum.webp" },
    ],
  },
];
function careerStat(stat) {
  if (stat === "rp") return rank.rp();
  if (stat === "chars") return collectionCount().got;
  if (stat === "modes") return String(stats.all().modes ?? "").split(",").filter(Boolean).length;
  return stats.get(stat);
}
function careerState() {
  try {
    const c = JSON.parse(local.getItem("lr:career") || "{}");
    return { claimed: c.claimed ?? {}, chests: c.chests ?? {} };
  } catch {
    return { claimed: {}, chests: {} };
  }
}
/** Chapter n is open once every mission and the chest of chapter n-1 is claimed. */
function chapterOpen(n, st = careerState()) {
  return n === 0 || Boolean(st.chests[n - 1]);
}
function careerReady() {
  const st = careerState();
  let n = 0;
  CAREER.forEach((ch, ci) => {
    if (!chapterOpen(ci, st)) return;
    ch.missions.forEach((m, mi) => {
      if (!st.claimed[`${ci}:${mi}`] && careerStat(m.stat) >= m.goal) n++;
    });
    if (!st.chests[ci] && ch.missions.every((_, mi) => st.claimed[`${ci}:${mi}`])) n++;
  });
  return n;
}
function claimCareer(ci, mi, btn) {
  const st = careerState();
  const m = CAREER[ci].missions[mi];
  if (!chapterOpen(ci, st) || st.claimed[`${ci}:${mi}`] || careerStat(m.stat) < m.goal) return;
  st.claimed[`${ci}:${mi}`] = true;
  local.setItem("lr:career", JSON.stringify(st));
  wallet.addCoins(m.coins);
  passXp(100);
  coinRain(btn, 12);
  sfx.finish();
  toast(`+${m.coins} coins · +100 XP`);
  renderCareer();
  renderMissionDots();
}
function chestLabel(c) {
  return [c.coins ? `${c.coins.toLocaleString()} coins` : "", c.pack ? "Mega Pack" : "", c.medal ? `${c.medals ?? 1} ${c.medal} medal${(c.medals ?? 1) > 1 ? "s" : ""}` : ""].filter(Boolean).join(" + ");
}
function openChest(ci) {
  const st = careerState();
  const ch = CAREER[ci];
  if (st.chests[ci] || !ch.missions.every((_, mi) => st.claimed[`${ci}:${mi}`])) return;
  st.chests[ci] = true;
  local.setItem("lr:career", JSON.stringify(st));
  const c = ch.chest;
  if (c.coins) wallet.addCoins(c.coins);
  if (c.medal) {
    const m = wallet.medals();
    m[c.medal] += c.medals ?? 1;
    wallet.save(m);
  }
  passXp(300);
  const next = CAREER[ci + 1];
  const after = () => {
    toast(next ? `Chapter ${ci + 2} · ${next.name} unlocked!` : "You finished the career. Legend!");
    renderCareer();
    renderMissionDots();
  };
  if (c.pack) {
    const pk = PACKS.find((x) => x.id === c.pack);
    openPackAnim(pk, grantPack(pk));
    po.onDone = after;
  } else showUnlock({ kind: "coins", n: c.coins ?? 0 }, after);
}
/** Career: a road of chapter medallions; the chapter you're on opens up with its missions. */
function renderCareer() {
  const st = careerState();
  const box = $("#careerList");
  const out = [];
  const current = CAREER.findIndex((_, ci) => chapterOpen(ci, st) && !st.chests[ci]);
  $("#careerSub").textContent = current < 0 ? "Every chapter done. Legend!" : `Chapter ${current + 1} of ${CAREER.length} · ${CAREER[current].name}`;
  CAREER.forEach((ch, ci) => {
    const open = chapterOpen(ci, st);
    const done = ch.missions.filter((_, mi) => st.claimed[`${ci}:${mi}`]).length;
    const finished = Boolean(st.chests[ci]);
    const head = el(
      "div",
      { class: `chapter${open ? "" : " locked"}${finished ? " finished" : ""}${ci === current ? " current" : ""}` },
      el("span", { class: "ch-num", text: finished ? "✓" : open ? String(ci + 1) : "🔒" }),
      el(
        "span",
        { class: "ch-name" },
        el("b", { text: ch.name }),
        el("small", { text: finished ? "Complete" : open ? `${done}/${ch.missions.length} missions` : `Finish chapter ${ci} to unlock` }),
        open && !finished ? el("span", { class: "ch-bar" }, el("i", { style: `width:${Math.round((done / ch.missions.length) * 100)}%` })) : null,
      ),
      el("span", { class: "ch-chest" }, el("img", { src: "/assets/ui_chest.webp", alt: "" }), el("small", { text: chestLabel(ch.chest) })),
    );
    out.push(head);
    // only the chapter you're on shows its missions
    if (finished || ci !== current) return;
    ch.missions.forEach((m, mi) => {
      const have = careerStat(m.stat);
      const claimed = st.claimed[`${ci}:${mi}`];
      out.push(
        missionRow({
          icon: m.icon,
          text: m.text,
          have,
          goal: m.goal,
          reward: `+${m.coins}`,
          state: !open ? "locked" : claimed ? "claimed" : have >= m.goal ? "ready" : "active",
          onClaim: (btn) => claimCareer(ci, mi, btn),
        }),
      );
    });
    if (open && done === ch.missions.length) {
      const b = el("button", { class: "gbtn chest-btn", type: "button" }, el("img", { src: "/assets/ui_chest.webp", alt: "" }), el("span", { text: `Open chapter chest` }));
      b.addEventListener("click", () => openChest(ci));
      out.push(b);
    }
  });
  box.replaceChildren(...out);
}

// ── personal best (solo endless run) ──

function personalBest() {
  return Number(local.getItem("lr:best")) || 0;
}
function checkBest() {
  if (game.mode === "race" && !me.out && net.view && serverNow() > net.view.startAt) {
    challenge("dist", Math.floor(me.d));
    challenge("nohit", Math.floor(me.d - (game.lastHitD ?? 0)));
    if (isSurvival()) challenge("survive", Math.floor((serverNow() - net.view.startAt) / 1000));
  }
  if (!game.soloRun || game.bestBeaten) return;
  const best = personalBest();
  if (best > 50 && me.d > best) {
    game.bestBeaten = true;
    banner("NEW RECORD!", 1500);
    world.fireworks(-me.d - 18);
  }
}
function saveBest() {
  if (!game.soloRun) return;
  if (me.d > personalBest()) local.setItem("lr:best", String(Math.round(me.d)));
}

// ── spectating (out of hearts) ──

/** Runners you can watch: still in the race, leader first. */
function watchable() {
  return [...remote.map.values()].filter((r) => r.runner && !r.p.left && r.p.outAt == null).sort((a, b) => b.dispD - a.dispD);
}
/** Who the camera follows: your pick, or the leader if you haven't picked (or they're out). */
function spectateTarget() {
  const list = watchable();
  let t = list.find((r) => r.p.id === game.spectating) || list[0] || null;
  const id = t?.p.id ?? null;
  if (id !== game.shownSpectate || list.length !== game.shownCount) {
    game.shownSpectate = id;
    game.shownCount = list.length;
    game.spectating = id;
    renderSpectate(t, list.length);
  }
  return t;
}
function cycleSpectate(step) {
  const list = watchable();
  if (!list.length) return;
  const i = Math.max(0, list.findIndex((r) => r.p.id === game.spectating));
  game.spectating = list[(i + step + list.length) % list.length].p.id;
}
function renderSpectate(t, n) {
  const bar = $("#spectate");
  bar.classList.toggle("show", Boolean(me.out && t));
  if (!t) return;
  $("#spectateName").textContent = withFlag(t.p.name, t.p.country);
  $("#spectateCount").textContent = n > 1 ? `${n} still running` : "last one running";
}
$("#specPrev").addEventListener("click", () => cycleSpectate(-1));
$("#specNext").addEventListener("click", () => cycleSpectate(1));

// ── survival hearts ──

function renderHearts(pop) {
  const box = $("#hearts");
  // one life (the endless run) needs no hearts
  const shown = (game.kind === "survival" && livesNow() > 1) || game.kind === "potato";
  box.style.display = shown ? "" : "none";
  if (!shown) return;
  const lost = game.kind === "potato" ? net.view?.players.find((p) => p.id === playerId)?.booms ?? 0 : me.hits;
  const left = Math.max(0, livesNow() - lost);
  box.replaceChildren(
    ...Array.from({ length: livesNow() }, (_, i) => el("i", { class: i < left ? "" : `lost${pop && i === left ? " pop" : ""}`, text: "❤️" })),
  );
}

/** Third hit in survival: down for good, then watch whoever is still running. */
function knockOut(why = "") {
  me.out = true;
  saveBest();
  me.items = [];
  me.power = "";
  me.powerT = 0;
  me.boostT = 0;
  me.slideT = 0;
  me.vy = 0;
  renderPower();
  shake = 0.5;
  sfx.hit();
  buzz([80, 60, 120]);
  banner(why === "brain" ? "🧠 THE BRAIN GOT YOU!" : why === "bomb" ? "💥 KABOOM! OUT!" : "OUT!", 1600);
  sendPos(true);
  const hint = $("#controlsHint");
  const what = why === "brain" ? "Caught" : why === "bomb" ? "Blown up" : "No hearts left";
  hint.textContent = TOUCH ? `${what} · tap ◀ ▶ to watch someone else` : `${what} · ← → to watch someone else`;
  hint.style.opacity = "1";
  game.spectating = null;
  game.shownSpectate = undefined;
}

// ── power-ups ──

/** Leaders mostly get defence, the back of the pack gets the big stuff. */
/**
 * What a mystery box gives you: the odds table in logic.js (powerOdds),
 * using your rank among runners still in the race and your gap to the leader.
 */
function rollPower() {
  const v = net.view;
  const field = (v?.players || [])
    .filter((p) => !p.left && p.outAt == null && p.finish == null)
    .map((p) => (p.id === playerId ? me.d : remote.map.get(p.id)?.dispD ?? p.d));
  if (!field.length) field.push(me.d);
  const rank = 1 + field.filter((d) => d > me.d + 0.01).length;
  const gap = Math.max(...field) - me.d;
  const kind = pickPower(powerOdds({ rank, alive: field.length, gapToLeader: gap, last: me.lastItem }), Math.random());
  me.lastItem = kind;
  return kind;
}

/** A mystery box goes into your slots; nothing happens until you use it. */
function grabBox(kind = rollPower()) {
  sfx.pickup();
  me.items.push(kind);
  flyToSlot(kind);
  const aims = THROWN.has(kind);
  showPowerToast(kind, me.items.length > 1 || me.power ? "Saved for later" : TOUCH ? (aims ? "Pick a lane, then ahead or behind" : "Tap the power-up to use it") : aims ? "E ahead · Q behind · 1-4 picks a lane" : "Press E to use it");
  renderPower();
  return kind;
}

/** Someone else reached the box first: hand back what we optimistically took. */
function loseBox() {
  const lb = me.lastBox;
  me.lastBox = null;
  if (!lb) return;
  const i = me.items.lastIndexOf(lb.kind);
  if (i >= 0) me.items.splice(i, 1);
  toast("Someone grabbed that box first!");
  renderPower();
}

/** Use your next power-up. `lane`/`dir` only matter for the banana and the bowling ball. */
function useItem(lane = me.lane, dir = 1) {
  if (!me.items.length || !canControl() || me.stumbleT > 0) return;
  const kind = me.items.shift();
  stats.add("used", 1);
  if (kind === "banana") {
    game.bananasThrown = (game.bananasThrown ?? 0) + 1;
    stats.add("bananas", 1);
    challenge("bananas", game.bananasThrown);
    const d = dir > 0 ? me.d + BANANA_AHEAD_M : me.d - BANANA_BEHIND_M;
    act({ type: "banana", lane, d: Math.round(d * 10) / 10 });
    sfx.lane();
    renderPower();
    return;
  }
  if (kind === "glue" || kind === "fake") {
    const d = dir > 0 ? me.d + BANANA_AHEAD_M : me.d - BANANA_BEHIND_M;
    act({ type: "banana", kind, lane, d: Math.round(d * 10) / 10 });
    sfx.lane();
    banner(kind === "glue" ? (dir > 0 ? "🟢 GLUE THROWN!" : "🟢 GLUE DROPPED!") : "🎁 TRAP SET!", 800);
    renderPower();
    return;
  }
  if (kind === "swap" || kind === "thunder" || kind === "boxing") {
    const v = net.view;
    const others = (v?.players || []).filter((p) => p.id !== playerId && !p.left && p.outAt == null && p.finish == null);
    const posOf = (p) => remote.map.get(p.id)?.dispD ?? p.d;
    let target = null;
    if (kind === "boxing") {
      // the glove reaches the nearest runner within PUNCH_REACH_M, ahead or behind
      target = others.filter((p) => Math.abs(posOf(p) - me.d) < PUNCH_REACH_M).sort((a, b) => Math.abs(posOf(a) - me.d) + Math.abs(a.lane - me.lane) - (Math.abs(posOf(b) - me.d) + Math.abs(b.lane - me.lane)))[0];
      if (!target) {
        // nobody in reach: a swing at the air, so you're never stuck holding it
        banner("🥊 WHIFF! Nobody close", 900);
        sfx.lane();
        renderPower();
        return;
      }
    } else target = others.find((p) => posOf(p) > me.d);
    if (!target || (kind === "thunder" && v?.cloud)) {
      me.items.unshift(kind); // keep it for when it's useful
      toast(kind === "boxing" ? "Nobody close enough to punch" : kind === "thunder" && v?.cloud ? "A storm is already out" : "Nobody ahead of you");
      renderPower();
      return;
    }
    me.lastUsed = kind;
    if (kind === "boxing") {
      act({ type: "punch", target: target.id });
      banner("🥊 POW!", 700);
      sfx.hit();
    } else if (kind === "swap") {
      act({ type: "swap" });
      sfx.boost();
    } else {
      act({ type: "thunder" });
      sfx.zap();
      banner("⛈️ STORM ON THE LEADER!", 900);
    }
    renderPower();
    return;
  }
  if (kind === "bowling") {
    act({ type: "bowl", lane, d: Math.round(me.d * 10) / 10, dir });
    sfx.roll();
    banner(dir > 0 ? "🎳 BOWLED AHEAD!" : "🎳 BOWLED BACK!", 800);
    renderPower();
    return;
  }
  activatePower(kind);
}

/** The power-up icon flies from your runner into its slot. */
function flyToSlot(kind) {
  const slot = $(me.items.length > 1 || me.power ? "#savedSlot" : "#powerSlot");
  const img = el("img", { class: "fly-icon", src: `/assets/pw_${kind}.png`, alt: "" });
  document.body.append(img);
  const to = slot.getBoundingClientRect();
  const tx = to.width ? to.left + to.width / 2 : 60;
  const ty = to.height ? to.top + to.height / 2 : innerHeight - 90;
  img.style.left = `${innerWidth / 2}px`;
  img.style.top = `${innerHeight * 0.55}px`;
  requestAnimationFrame(() => {
    img.style.left = `${tx}px`;
    img.style.top = `${ty}px`;
    img.style.transform = "translate(-50%, -50%) scale(0.5)";
  });
  setTimeout(() => img.remove(), 700);
}

function activatePower(kind) {
  if (kind === "freeze") {
    act({ type: "zap", kind: "freeze" });
    sfx.zap();
    banner("❄️ FREEZE! ❄️", 900);
    renderPower();
    return;
  }
  if (kind === "brainwave") {
    act({ type: "zap", kind: "brainwave" });
    sfx.zap();
    banner("🌀 BRAIN WAVE!", 900);
    renderPower();
    return;
  }
  if (kind === "mud") {
    act({ type: "zap", kind: "mud" });
    sfx.pop();
    banner("🟤 MUD SPLASH!", 900);
    renderPower();
    return;
  }
  if (kind === "lightning") {
    act({ type: "zap", kind: "lightning" });
    sfx.zap();
    flash();
    banner("⚡ ZAP! ⚡", 900);
    renderPower();
    return;
  }
  me.power = kind;
  me.powerT = POWER_S[kind];
  if (kind === "rocket") {
    me.slideT = 0;
    sfx.rocket();
  }
  renderPower();
}

function endPower() {
  if (me.power === "rocket") {
    me.vy = 0; // drop back down; brief grace so you don't land in a crate
    me.invulnT = Math.max(me.invulnT, 0.7);
  }
  me.power = "";
  me.powerT = 0;
  renderPower();
}

/** Lightning from someone behind you trips you up (unless you're protected). */
function checkZaps() {
  const v = net.view;
  if (!v?.zaps || game.mode !== "race") return;
  for (const z of v.zaps) {
    if (z.id <= me.lastZap) continue;
    me.lastZap = z.id;
    if (z.by === playerId) continue;
    if (z.kind === "thunder") {
      if (z.target !== playerId || me.finished || me.out) continue;
      flash();
      sfx.zap();
      banner("⛈️ STRUCK BY THUNDER!", 1100);
      me.invulnT = 0;
      if (me.power === "shield") endPower();
      hit("zap");
      continue;
    }
    if (z.kind === "brainwave") {
      if (me.finished || me.out || me.d <= z.d) continue;
      if (me.power === "shield") {
        endPower();
        sfx.pop();
        banner("SHIELD BLOCKED THE BRAIN WAVE", 900);
        continue;
      }
      me.waveT = WAVE_S;
      sfx.zap();
      banner("🌀 BRAIN WAVE! LEFT IS RIGHT!", 1300);
      continue;
    }
    if (z.kind === "mud") {
      if (me.finished || me.out || me.d <= z.d) continue;
      if (me.power === "shield") {
        endPower();
        sfx.pop();
        banner("SHIELD BLOCKED THE MUD", 900);
        continue;
      }
      if (me.power === "rocket") continue;
      mudSplat();
      sfx.hit();
      continue;
    }
    if (z.kind === "freeze") {
      if (me.finished || me.out) continue;
      if (me.power === "shield") {
        endPower();
        sfx.pop();
        banner("SHIELD BLOCKED THE FREEZE", 900);
        continue;
      }
      me.frozenT = FREEZE_S;
      frost();
      banner("❄️ FROZEN! ❄️", 1000);
      continue;
    }
    flash();
    sfx.zap();
    if (me.finished || me.out || me.d <= z.d) continue;
    if (me.power === "rocket") continue;
    if (me.power === "ghost") endPower();
    me.invulnT = 0; // lightning gets through the after-hit blink
    hit("zap");
  }
}

/** Random / Grand Tour matches: a slot-machine reel lands on this round's mode during the countdown. */
function spinReveal(round, kind, total) {
  const kinds = ["survival", "chase", "coinrush", "potato"];
  const reel = $("#spinReel");
  const cards = [];
  const loops = 5;
  for (let i = 0; i < loops; i++) for (const k of kinds) cards.push(k);
  cards.push(kind);
  reel.replaceChildren(...cards.map((k) => el("div", { class: `spin-card ${k}` }, el("b", { text: `${GAME_MODE_INFO[k].icon} ${KIND_LABEL[k]}` }), el("small", { text: KIND_RULE[k] }))));
  $("#spinTitle").textContent = `🏆 Round ${round} of ${total}`;
  const box = $("#spinWheel");
  box.hidden = false;
  box.classList.remove("done");
  reel.style.transition = "none";
  reel.style.transform = "translateY(0)";
  void reel.offsetHeight;
  const h = reel.firstElementChild?.getBoundingClientRect().height || 80;
  reel.style.transition = "transform 2.2s cubic-bezier(0.12, 0.8, 0.2, 1)";
  reel.style.transform = `translateY(${-(cards.length - 1) * h}px)`;
  let ticks = 0;
  const tick = setInterval(() => {
    sfx.lane();
    if (++ticks > 12) clearInterval(tick);
  }, 160);
  setTimeout(() => {
    box.classList.add("done");
    sfx.boost();
  }, 2250);
  setTimeout(() => (box.hidden = true), 3300);
}

// ── modes on your screen: the brain, coins, the bomb ──

function myCoins() {
  const server = net.view?.players.find((p) => p.id === playerId)?.coins ?? 0;
  return Math.max(server, game.coinsShown ?? 0);
}
/** Per-frame: brain catch, coin pickups. */
function modeTick(prevD, v) {
  if (me.finished || me.out) return;
  const elapsed = (serverNow() - v.startAt) / 1000;
  // moving obstacles: jump the low ones, slide under the bees, dodge the rest
  if (me.power !== "rocket") {
    for (const m of world.movers) {
      if (m.z <= prevD || m.z > me.d || !moverCovers(m, me.x, elapsed)) continue;
      const info = MOVER_KINDS[m.kind];
      if (info.clear === "jump" && me.y > 0.6) {
        style("HOP!", 20);
        continue;
      }
      if (info.clear === "slide" && me.slideT > 0) {
        style("DUCKED!", 20);
        continue;
      }
      if (info.slows) {
        me.glueT = 1.2;
        banner("🌊 SPLASH!", 800);
        sfx.pop();
        continue;
      }
      hit(m.kind);
    }
  }
  if (game.kind === "chase" && elapsed > 0 && brainDistance(elapsed) >= me.d) {
    knockOut("brain");
    return;
  }
  if (game.kind === "coinrush") {
    for (const c of world.coins) {
      if (c.got || c.z < prevD - 0.8 || c.z > me.d + 0.8 || Math.abs(me.x - c.lane) > 0.6 || me.y > 2.2) continue;
      c.got = true;
      c.gotAt = performance.now();
      c.obj.visible = false;
      game.coinsShown = myCoins() + c.v;
      act({ type: "coin", i: c.i });
      sfx.pickup();
      if (c.v > 1) banner(`+${c.v} 🪙`, 600);
    }
    for (const c of v.loose || []) {
      if (game.coinGot.has(`l${c.id}`) || c.d < prevD - 1 || c.d > me.d + 1 || Math.abs(me.x - c.lane) > 0.7) continue;
      game.coinGot.add(`l${c.id}`);
      game.coinsShown = myCoins() + c.n;
      act({ type: "coin", loose: c.id });
      sfx.pickup();
      banner(`+${c.n} 🪙`, 600);
    }
  }
  renderModeHud();
}
/** New state from the room: knockouts it decided, bomb blasts, coins someone else took. */
function modeView(v) {
  const mine = v.players.find((p) => p.id === playerId);
  if (mine && mine.outAt != null && !me.out && game.mode === "race") knockOut(v.kind === "chase" ? "brain" : v.kind === "potato" ? "bomb" : "");
  // hot potato: tell me when the bomb lands on me, and when I've shaken it off
  if (v.kind === "potato" && game.mode === "race" && !me.out) {
    const h = v.bomb?.holder ?? null;
    if (h !== game.bombHolder) {
      if (h === playerId) {
        banner("💣 YOU'RE LAST!", 900);
        buzz(40);
        sfx.pop();
      } else if (game.bombHolder === playerId && h) banner("😅 BOMB GONE!", 800);
      game.bombHolder = h;
    }
  }
  for (const b of v.blasts || []) {
    if (b.id <= (game.lastBlast ?? 0)) continue;
    game.lastBlast = b.id;
    const at = b.holder === playerId ? -me.d : -(remote.map.get(b.holder)?.dispD ?? b.d);
    world.explode(laneX(b.lane), at);
    sfx.boom();
    if (b.holder === playerId) {
      shake = 0.6;
      buzz([60, 40, 160]);
      renderHearts(true);
      if (!me.out) {
        me.stumbleT = STUMBLE_S;
        banner("💥 KABOOM! −1 ❤️", 1200);
      }
    } else feed(`💥 The bomb blew up on ${nameOf(b.holder)}!`);
  }
  if (game.kind === "coinrush") {
    // coins someone else grabbed disappear for us too
    const taken = new Set(v.coinsTaken || []);
    const now = performance.now();
    for (const c of world.coins) {
      if (taken.has(c.i) && !c.got) {
        c.got = true;
        c.gotAt = now;
        c.obj.visible = false;
      } else if (!taken.has(c.i) && c.got && now - (c.gotAt ?? 0) > 2500) {
        // it came back (taken coins respawn after a few seconds)
        c.got = false;
        c.obj.visible = true;
      }
    }
    if (mine && (game.coinsShown ?? 0) > mine.coins + 12) game.coinsShown = mine.coins; // a pickup we lost the race for
  }
}
function renderModeHud() {
  const box = hudEl.mode ?? (hudEl.mode = $("#modeHud"));
  const v = net.view;
  if (!v || game.mode !== "race") {
    box.hidden = true;
    return;
  }
  if (game.kind === "chase") {
    const gap = me.d - brainDistance((serverNow() - v.startAt) / 1000);
    box.hidden = me.out;
    box.className = `mode-hud chase${gap < 15 ? " danger" : ""}`;
    setText(box, `🧠 ${Math.max(0, Math.round(gap))} m behind you`);
    $("#brainFx").classList.toggle("on", !me.out && gap < 15);
  } else if (game.kind === "coinrush") {
    box.hidden = false;
    box.className = "mode-hud coins";
    setText(box, `🪙 ${myCoins()}`);
  } else if (game.kind === "potato") {
    // everyone sees the fuse; the last runner sees it in red
    const mineBomb = v.bomb?.holder === playerId;
    box.hidden = !v.bomb || me.out;
    const left = v.bomb ? Math.max(0, (v.bomb.until - serverNow()) / 1000) : 0;
    box.className = `mode-hud bomb${mineBomb ? " mine" : ""}${left < 5 ? " hot" : ""}`;
    setText(box, mineBomb ? `💣 ${Math.ceil(left)}s · Overtake!` : `💣 ${Math.ceil(left)}s · ${nameOf(v.bomb?.holder)}`);
  } else box.hidden = true;
}

/** Mind swap moved us (our warp went up), or someone punched us. */
function applyWarpsAndPunches(v) {
  if (game.mode !== "race" || !v.players) return;
  const mine = v.players.find((p) => p.id === playerId);
  if (mine && (mine.warp ?? 0) > (me.warp ?? 0)) {
    const ahead = mine.d > me.d;
    me.warp = mine.warp;
    me.d = mine.d;
    flash();
    banner(ahead ? "🔄 SWAPPED AHEAD!" : "🔄 MIND SWAPPED!", 1100);
    sfx.boost();
  }
  for (const pu of v.punches || []) {
    if (pu.id <= (me.lastPunch ?? 0)) continue;
    me.lastPunch = pu.id;
    if (pu.target !== playerId || me.finished || me.out) continue;
    if (me.power === "shield") {
      endPower();
      sfx.pop();
      banner("SHIELD BLOCKED THE PUNCH", 900);
      continue;
    }
    me.lane = clamp(me.lane + pu.dir, 0, LANES - 1);
    me.staggerT = STAGGER_S;
    shake = 0.35;
    sfx.hit();
    buzz(60);
    banner("🥊 PUNCHED!", 800);
  }
}
/** "⛈️ 3.2 s: run into someone to pass it on!" while the storm is over you. */
function renderCloudHud() {
  const c = net.view?.cloud;
  const box = $("#cloudHud");
  const mine = c && c.holder === playerId && game.mode === "race";
  box.hidden = !mine;
  if (mine) setText(box, `⛈️ ${Math.max(0, (c.until - serverNow()) / 1000).toFixed(1)} s · bump into someone to pass it on!`);
}

/** Mud from someone behind you: big splats over your screen that slide off after a few seconds. */
function mudSplat() {
  const f = $("#mudFx");
  f.classList.remove("on");
  void f.offsetWidth;
  f.classList.add("on");
}

function frost() {
  const f = $("#frostFx");
  f.classList.remove("on");
  void f.offsetWidth;
  f.classList.add("on");
}

/** The power-up everyone starts with: one of the neutral ones, same odds for everybody. */
function startingItem() {
  const kind = START_POWERS[Math.floor(Math.random() * START_POWERS.length)];
  me.lastItem = kind;
  return kind;
}

function flash() {
  const f = $("#zapFlash");
  f.classList.remove("on");
  void f.offsetWidth;
  f.classList.add("on");
}

function showPowerToast(kind, how = "") {
  const t = $("#powerToast");
  // explain each power-up the first few times only, and never over the PASS button
  let seen = {};
  try { seen = JSON.parse(local.getItem("lr:tips") || "{}") || {}; } catch { /* fresh tips */ }
  if ((seen[kind] ?? 0) >= POWER_TIPS) return;
  seen[kind] = (seen[kind] ?? 0) + 1;
  local.setItem("lr:tips", JSON.stringify(seen));
  t.replaceChildren(
    el("img", { src: `/assets/pw_${kind}.png`, alt: "" }),
    el("div", {}, el("b", {}, POWER_INFO[kind].label), el("span", {}, POWER_INFO[kind].hint), how ? el("small", {}, how) : null),
  );
  t.classList.remove("show");
  void t.offsetWidth;
  t.classList.add("show");
}

/**
 * Two slots: the big one shows what's running (with its timer) or what you'll
 * use next; the small one is the power-up you're saving for later.
 */
function renderPower() {
  const slot = $("#powerSlot");
  const saved = $("#savedSlot");
  const main = me.power || me.items[0] || "";
  const next = me.power ? me.items[0] : me.items[1];
  const held = !me.power && Boolean(me.items[0]);
  const aims = held && THROWN.has(me.items[0]);
  // anything you can throw: swipe up on the button to throw it ahead, down to drop it behind
  $("#throwHint").classList.toggle("show", aims && TOUCH);
  slot.classList.toggle("aims", aims && TOUCH);
  slot.classList.toggle("held", held);
  saved.classList.toggle("show", Boolean(next));
  if (next) saved.querySelector("img").src = `/assets/pw_${next}.png`;
  if (!main) {
    slot.classList.remove("show");
    return;
  }
  slot.classList.add("show");
  slot.querySelector("img").src = `/assets/pw_${main}.png`;
  slot.querySelector("b").textContent = POWER_INFO[main].label;
  slot.querySelector(".use").textContent = held ? (TOUCH ? (aims ? "" : "Tap!") : aims ? "E ahead · Q behind" : "E to use") : "";
  if (held) {
    slot.querySelector(".bar i").style.width = "100%";
    slot.style.setProperty("--p", "1");
  }
}
// the item button: tap to use; for things you throw, swipe up = throw ahead, swipe down = drop behind
{
  const slot = $("#powerSlot");
  let y0 = null;
  slot.addEventListener("pointerdown", (e) => {
    y0 = e.clientY;
    slot.setPointerCapture?.(e.pointerId);
  });
  slot.addEventListener("pointerup", (e) => {
    if (y0 == null) return;
    const dy = e.clientY - y0;
    y0 = null;
    buzz(15);
    const throws = !me.power && THROWN.has(me.items[0]);
    if (throws && dy > 22) useItem(me.lane, -1);
    else if (throws) useItem(me.lane, 1);
    else useItem();
  });
  slot.addEventListener("pointercancel", () => (y0 = null));
}

function currentAct() {
  if (net.view && serverNow() < net.view.startAt - 900) return "cheer"; // waving on the line during the fly-past
  if (net.view && serverNow() < net.view.startAt) return "idle";
  if (me.out) return "out";
  if (me.finished && me.speed < 0.5) return "cheer";
  if (me.stumbleT > 0) return "stumble";
  if (me.power === "rocket") return "run";
  if (me.y > 0) return "jump";
  if (me.slideT > 0) return "slide";
  return "run";
}

function sendPos(force = false) {
  const now = performance.now();
  const a = currentAct();
  if (!force && now - me.lastSent < SEND_MS && a === me.sentAct && me.power === me.sentPw) return;
  me.lastSent = now;
  me.sentAct = a;
  me.sentPw = me.power;
  act({
    type: "pos",
    d: Math.round(Math.min(me.d, game.len) * 100) / 100,
    lane: me.lane,
    y: Math.round(me.y * 100) / 100,
    act: a,
    hits: me.hits,
    pw: me.power,
    v: Math.round(me.speed * 100) / 100,
    sc: me.score,
    cb: me.bestCombo,
    w: me.warp ?? 0,
  });
}

function animateRunner(r, a, speed, dt, pw = "") {
  if (!r) return;
  r.setPower(pw);
  if (pw === "rocket") r.fx.flame.scale.setScalar(0.85 + Math.random() * 0.35);
  if (pw === "shield") r.fx.bubble.rotation.y += dt * 1.5;
  // out of hearts: fall over and stay down
  if (a === "out") {
    r.play("fall", 0.06, r.clipDuration("fall") / FALL_S);
    r.pivot.rotation.set(0, Math.PI, 0);
    r.mixer.update(dt);
    return;
  }
  // hit something: fall over backwards, then get back up
  if (a === "stumble") {
    if (r.fallT === 0) world.dizzy(r, STUMBLE_S); // stars spin round the head while they're down
    r.fallT += dt;
    if (r.fallT < FALL_S) r.play("fall", 0.06, r.clipDuration("fall") / FALL_S);
    else r.play("getup", 0.2, r.clipDuration("getup") / GETUP_S);
    r.pivot.rotation.z = 0;
    r.mixer.update(dt);
    return;
  }
  r.fallT = 0;
  if (a === "jump") r.play("jump", 0.08, (r.clipDuration("jump") / 0.75) * 0.9);
  else if (a === "slide") {
    r.play("slide", 0.08, r.clipDuration("slide") / SLIDE_S, r === me.runner && me.slideKick);
    if (r === me.runner) me.slideKick = false;
  }
  else if (a === "cheer") r.play("cheer", 0.25);
  else if (a === "idle") r.play("idle", 0.25);
  else r.play("run", 0.12, clamp(speed / BASE_SPEED, 0.45, 1.45));
  // a little forward lean while flying the rocket
  r.pivot.rotation.x = pw === "rocket" ? 0.35 : 0;
  r.pivot.rotation.z = 0;
  r.mixer.update(dt);
}

// ── frame loop ──────────────────────────────────────────────────────────────

let shake = 0;
let lastCount = null;
let last = performance.now();
const camPos = new THREE.Vector3(0, 4, 8);
const camLook = new THREE.Vector3();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (game.pendingRace && world.ready && net.view && (net.view.phase === "countdown" || net.view.phase === "race") && world.hasChars(net.view.players.map((p) => p.char)) && world.mapReady(net.view.raceMap || "meadow")) {
    enterRace(net.view);
  }

  if (game.mode === "race" || game.mode === "results-pending") {
    // substeps keep fast runners from tunnelling through thin obstacles
    const steps = Math.ceil(dt / (1 / 120));
    const v = net.view;
    const raceT = v && serverNow() >= v.startAt ? (serverNow() - v.startAt) / 1000 : null;
    world.animateCourse(me.out ? Math.max(me.d, ...[...remote.map.values()].map((r) => r.dispD)) : me.d, raceT, dt);
    checkZaps();
    checkBest();
    const ts = coachTick(dt); // slow motion while the first-run tutorial shows a move
    for (let i = 0; i < steps; i++) stepMe((dt * ts) / steps);
    if (game.mode === "race") sendPos(false);

    const zMe = -me.d;
    if (me.runner) {
      me.runner.group.position.set(laneX(me.x), me.y, zMe);
      if (equipped().trail && me.speed > 2 && !me.out) world.trail(equipped().trail, laneX(me.x), me.y, zMe);
      me.runner.group.visible = !(me.invulnT > 0 && me.stumbleT <= 0 && !me.power && Math.floor(now / 90) % 2 === 0);
      animateRunner(me.runner, currentAct(), me.speed, dt * ts, me.power);
      if (me.power) {
        const f = me.powerT / POWER_S[me.power];
        $("#powerSlot .bar i").style.width = `${f * 100}%`;
        $("#powerSlot").style.setProperty("--p", f.toFixed(3));
      }
    }

    for (const r of remote.map.values()) {
      if (!r.runner) continue;
      const p = r.p;
      // Where they are right now: their last reported spot, moved on by their
      // reported speed for the time since the server got it. Without this,
      // everyone else trails a few metres behind on your screen (and you on theirs).
      const ahead = p.at ? clamp((serverNow() - p.at) / 1000, 0, 0.6) : Math.min((performance.now() - r.lastAt) / 1000, 0.5);
      const speed = p.at ? p.v ?? 0 : r.vel;
      const target = Math.min(game.len, p.act === "out" ? p.d : p.d + speed * ahead);
      // small differences are smoothed, big jumps (lag spikes) snap
      const gap = target - r.dispD;
      r.dispD = Math.abs(gap) > 6 ? target : r.dispD + gap * Math.min(1, dt * 14);
      r.dispX += (laneX(p.lane) - r.dispX) * Math.min(1, dt * 12);
      r.dispY += (p.y - r.dispY) * Math.min(1, dt * 18);
      r.runner.group.position.set(r.dispX, r.dispY, -r.dispD);
      if (r.p.trail && r.vel > 2 && !r.p.outAt) world.trail(r.p.trail, r.dispX, r.dispY, -r.dispD);
      r.runner.group.visible = !p.left;
      const waiting = net.view && serverNow() < net.view.startAt - 900; // the line-up before the gun
      const ra = waiting ? "cheer" : !isSurvival() && p.finish !== null && r.dispD > TRACK_LEN - 1 ? "cheer" : p.gone && p.act !== "out" ? "idle" : p.act;
      if (!isSurvival() && p.finish !== null && game.cheered && !game.cheered.has(p.id)) {
        game.cheered.add(p.id);
        world.fireworks(-TRACK_LEN);
      }
      animateRunner(r.runner, ra, r.vel || BASE_SPEED, dt, p.left || p.finish !== null ? "" : p.pw || "");
    }

    // camera: behind and above the player, looking down the track (once
    // you're out of a survival race, it follows the leader instead)
    let fx = me.x;
    let fy = me.y;
    let fz = zMe;
    let fd = me.d;
    if (me.out) {
      const watch = spectateTarget();
      if (watch) {
        fx = watch.dispX / LANE_W + (LANES - 1) / 2;
        fy = watch.dispY;
        fz = -watch.dispD;
        fd = watch.dispD;
      }
    }
    const tx = laneX(fx) * 0.75;
    const back = game.lookBack && !me.out;
    // countdown intro: a sweeping fly-past in front of the whole line-up (everyone
    // cheering), then a glide in behind your runner just before the gun
    const toGo = net.view ? (net.view.startAt - serverNow()) / 1000 : 0;
    // The opening shot: one slow, continuous move. It starts low in front of the
    // line-up, rises over the runners and settles exactly where the running camera
    // sits at the gun, so there is never a cut. It takes whatever countdown is left.
    const introLen = game.introLen ?? 0;
    const forced = game.introForce; // tests can hold the shot at any point (0 … 1)
    const intro = forced != null || (toGo > 0 && introLen > 0.6 && game.mode === "race");
    let introLook = null;
    if (intro) {
      const p = forced ?? 1 - Math.max(0, toGo) / introLen;
      const e = p * p * (3 - 2 * p);
      // round your runner: from in front of your face, past your side, to behind you
      // (kept between the start gate's posts)
      const px = laneX(fx);
      const side = px > 0 ? -1 : 1; // swing round on the open side
      const cx = (x) => clamp(x, -3.4, 3.4);
      introPath.points[0].set(cx(px + side * 1.6), 1.6, fz - 4.6);
      introPath.points[1].set(cx(px + side * 3.0), 2.2, fz - 2.2);
      introPath.points[2].set(cx(px + side * 3.0), 3.4, fz + 2.6);
      introPath.points[3].set(tx, 3.0, fz + 5.6);
      introPath.getPoint(e, camPos);
      // look at your runner, then turn to look down the track
      const k = THREE.MathUtils.smoothstep(p, 0.68, 1);
      introLook = new THREE.Vector3(px, 1.05, fz).lerp(new THREE.Vector3(tx * 0.8, 1.0, fz - 9), k);
    } else {
      camPos.lerp(back ? new THREE.Vector3(tx, 2.5 + fy * 0.6, fz - 4.2) : new THREE.Vector3(tx, 3.0 + fy * 0.75, fz + 5.6), Math.min(1, dt * (me.out ? 3 : back ? 10 : 6)));
    }
    camera.position.copy(camPos);
    if (shake > 0) {
      shake = Math.max(0, shake - dt);
      camera.position.x += (Math.random() - 0.5) * shake * 0.6;
      camera.position.y += (Math.random() - 0.5) * shake * 0.6;
    }
    if (intro) camLook.copy(introLook);
    else if (back) camLook.set(tx * 0.8, 1.0, fz + 12);
    else camLook.set(tx * 0.8, 1.0 + fy * 0.6, fz - 9);
    camera.lookAt(camLook);
    world.cull(back ? fd - 30 : fd);
    world.syncBananas(net.view?.bananas || [], slipped);
    world.syncCloud(net.view?.cloud, (id) => {
      const g = id === playerId ? me.runner?.group : remote.map.get(id)?.runner?.group;
      return g ? g.position : null;
    });
    renderCloudHud();
    if (net.view) world.syncMovers(Math.max(0, (serverNow() - net.view.startAt) / 1000));
    world.stepTrails(dt);
    if (net.view) world.syncMode(net.view, (id) => {
      const g = id === playerId ? me.runner?.group : remote.map.get(id)?.runner?.group;
      return g ? g.position : null;
    }, serverNow());
    world.syncBowls(net.view?.bowls || [], serverNow());
    // feel the speed: wider view and speed lines on a rocket or boost
    const zoom = me.power === "rocket" ? 80 : me.boostT > 0 ? 70 : 62;
    if (Math.abs(camera.fov - zoom) > 0.1) {
      camera.fov += (zoom - camera.fov) * Math.min(1, dt * 5);
      camera.updateProjectionMatrix();
    }
    $("#speedFx").classList.toggle("on", game.mode === "race" && (me.power === "rocket" || me.boostT > 0));
    updateHud();
  } else {
    // menus: slow fly-over of the meadow with your runner idling
    const t = now / 1000;
    camera.position.set(Math.sin(t * 0.15) * 1.2, 1.6, 1.4);
    camera.lookAt(0, 0.9, -3);
    const s = world.show;
    if (s) {
      s.r.pivot.rotation.y = 0.35 + Math.sin(t * 0.6) * 0.25;
      s.r.mixer.update(dt);
    }
    world.cull(0);
  }

  world.tick(camera.position.z, dt);
  renderer?.render(scene, camera);
  renderMirror();
  adaptQuality(dt);
}

const introPath = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], false, "centripetal");
const hudEl = { timer: $("#timer"), dist: $("#distText"), place: $("#place"), dots: $("#dots") };
function updateHud() {
  const v = net.view;
  if (!v) return;
  const sn = serverNow();

  // countdown 3-2-1-GO
  const cd = $("#countdown");
  const left = v.startAt - sn;
  let label = "";
  if (left > 3000) label = "Ready?";
  else if (left > 0) label = String(Math.ceil(left / 1000));
  else if (left > -700) label = "GO!";
  if (label !== lastCount) {
    cd.textContent = label;
    cd.classList.remove("pop");
    void cd.offsetWidth;
    if (label) cd.classList.add("pop");
    cd.dataset.n = label;
    if (label === "GO!") sfx.go();
    else if (/^[123]$/.test(label)) sfx.beep();
    lastCount = label;
  }
  // the controls fade in on the gun (checked every frame: a slow frame can skip the "GO!" moment)
  if (left <= 0) {
    const hud = hudEl.hud ?? (hudEl.hud = $("#hud"));
    if (hud.classList.contains("intro")) {
      hud.classList.remove("intro");
      hud.classList.add("reveal");
      setTimeout(() => hud.classList.remove("reveal"), 500);
    }
  }

  // timer
  const t = Math.max(0, sn - v.startAt);
  const remainingAfterFirst = v.firstFinishAt !== null ? Math.max(0, v.limitAt - sn) : null;
  setText(
    hudEl.timer,
    remainingAfterFirst !== null && !me.finished ? `⏱${Math.ceil(remainingAfterFirst / 1000)}` : (t / 1000).toFixed(1),
  );

  // places by live distance (finished runners first, by time)
  const entries = v.players
    .filter((p) => !p.left)
    .map((p) => {
      if (p.id === playerId) {
        return { id: p.id, d: Math.min(me.d, game.len), finish: p.finish ?? (me.finished ? 1e9 - 1 : null), outAt: me.out ? p.outAt ?? sn : null };
      }
      const r = remote.map.get(p.id);
      return { id: p.id, d: r ? r.dispD : p.d, finish: p.finish, outAt: p.outAt };
    });
  if (game.kind === "coinrush") {
    const coinsOf = (id) => (id === playerId ? myCoins() : net.view?.players.find((p) => p.id === id)?.coins ?? 0);
    entries.sort((a, b) => coinsOf(b.id) - coinsOf(a.id) || b.d - a.d);
    const left = Math.max(0, (v.startAt + COINRUSH_MS - sn) / 1000);
    setText(hudEl.dist, `🪙 ${myCoins()} · ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")} left`);
  } else if (isSurvival()) {
    // still running first (furthest ahead), then whoever lasted longest
    entries.sort((a, b) => (b.outAt ?? Infinity) - (a.outAt ?? Infinity) || b.d - a.d);
    const alive = entries.filter((e) => e.outAt === null).length;
    setText(hudEl.dist, `${Math.round(Math.min(me.d, game.len))} m`);
    // how many are still in it, big and clear; it pulses when someone drops out
    const chip = hudEl.alive ?? (hudEl.alive = $("#aliveChip"));
    chip.hidden = entries.length < 2;
    if (game.aliveShown !== alive) {
      if (game.aliveShown != null && alive < game.aliveShown) {
        chip.classList.remove("drop");
        void chip.offsetWidth;
        chip.classList.add("drop");
      }
      game.aliveShown = alive;
      chip.textContent = `🏃 ${alive}/${entries.length}`;
    }
  } else {
    entries.sort((a, b) => {
      if (a.finish !== null && b.finish !== null) return a.finish - b.finish;
      if (a.finish !== null) return -1;
      if (b.finish !== null) return 1;
      return b.d - a.d;
    });
  }
  const place = entries.findIndex((e) => e.id === playerId) + 1 || 1;
  setHTML(hudEl.place, `<b>${place}</b><sup>${ordinal(place)}</sup><sub>/${entries.length}</sub>`);
  // coloured by place, and it pops whenever you gain or lose one
  if (hudEl.place.dataset.p !== String(place)) {
    const before = Number(hudEl.place.dataset.p || 0);
    hudEl.place.dataset.p = String(place);
    hudEl.place.classList.remove("up", "down");
    void hudEl.place.offsetWidth;
    if (before) hudEl.place.classList.add(place < before ? "up" : "down");
  }
  hudEl.place.hidden = entries.length < 2; // an endless run has no places

  // the bar up the right side: finish at the top in a race; in survival the leader is at the top
  const bar = hudEl.bar ?? (hudEl.bar = $(".track-bar"));
  bar.hidden = entries.length < 2;
  const ds = entries.map((e) => e.d);
  const lo = isSurvival() ? Math.min(...ds) : 0;
  const span = isSurvival() ? Math.max(40, Math.max(...ds) - lo) : TRACK_LEN;
  for (const dot of hudEl.dots.children) {
    const id = dot.getAttribute("data-id");
    const e = entries.find((x) => x.id === id);
    const top = `${((1 - clamp(((e ? e.d : 0) - lo) / span, 0, 1)) * 100).toFixed(1)}%`;
    if (dot.style.top !== top) dot.style.top = top;
    dot.style.display = e && e.outAt == null ? "" : "none";
  }
}

// ── boot ────────────────────────────────────────────────────────────────────

// win celebrations were taken out of the game: whoever bought one gets its coins back, once
{
  const RETIRED = { "cel:confetti": 300, "cel:hearts": 400, "cel:goldrain": 500, "cel:mega": 1000 };
  const owned = wallet.owned();
  const back = owned.filter((id) => id in RETIRED);
  if (back.length) {
    local.setItem("lr:owned", JSON.stringify(owned.filter((id) => !(id in RETIRED))));
    wallet.addCoins(back.reduce((a, id) => a + RETIRED[id], 0));
  }
}
const createBtn = $("#createBtn");
const joinBtn = $("#joinBtn");
const soloBtn = $("#soloBtn");
const endlessBtn = $("#endlessBtn");
createBtn.disabled = joinBtn.disabled = soloBtn.disabled = endlessBtn.disabled = true;
renderEndlessBest();
world
  .load((f) => ($("#loadHint").textContent = `Loading 3D runners… ${Math.round(f * 100)}%`))
  .then(() => {
    $("#loadHint").textContent = "";
    createBtn.disabled = joinBtn.disabled = soloBtn.disabled = endlessBtn.disabled = false;
    world.buildScenery();
    world.setShowcase(preferredChar());
    if (net.view?.phase === "lobby") renderLobby(net.view);
  })
  .catch((err) => {
    console.error(err);
    $("#loadHint").textContent = "Couldn't load the 3D models — check your connection and reload.";
  });

// test hooks for the local dev server only (headless browser checks)
if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
  // test hooks (used by the automated play-tests)
  window.__laneRush = { me, hit, grabBox, useItem, game, net, remote, world, race, MOVER_KINDS, moverCovers, raceElapsed: () => (net.view ? (serverNow() - net.view.startAt) / 1000 : 0) };
}

requestAnimationFrame(frame);
