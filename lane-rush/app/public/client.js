/**
 * BRAIN RUN — browser client.
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
import {
  buildCourse,
  TRACK_LEN,
  BASE_SPEED,
  BOOST_SPEED,
  LANES,
  COUNTRIES,
  MEDALS,
  MEDAL_WORTH,
  MIN_RACERS_FOR_MEDALS,
  POWERS,
  LIVES,
  SURVIVAL_LEN,
  SURVIVAL_BOOST,
  survivalSpeed,
  runSpeed,
  BANANA_BEHIND_M,
  CUP_POINTS,
  CUP_MODES,
  ROUND_KINDS,
  MAPS,
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
  PUNCH_RANGE_M,
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
const STARTERS = RUNNERS.length; // every 3D runner is free to play

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
  { id: "leo", name: "Sir Leo", color: "#4c8dff", rarity: "epic", via: "medals", price: { medal: "silver", count: 4 } },
  { id: "kai", name: "Kai", color: "#21c7d9", rarity: "epic", via: "medals", price: { medal: "silver", count: 6 } },
  { id: "zed", name: "Zed", color: "#7be3b0", rarity: "legendary", via: "medals", price: { medal: "gold", count: 3 } },
  { id: "aria", name: "Aria", color: "#e03cff", rarity: "legendary", via: "medals", price: { medal: "gold", count: 5 } },
];
const MEDAL_IMG = { gold: "/assets/medal_gold.png", silver: "/assets/medal_silver.png", bronze: "/assets/medal_bronze.png" };
const medalText = (medal, n) => `${n} ${medal} medal${n === 1 ? "" : "s"}`;
const flagOf = (code) => (code && code.length === 2 ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0))) : "");
const withFlag = (name, code) => (code ? `${flagOf(code)} ${name}` : name);
const countryName = (code) => (COUNTRIES.find(([c]) => c === code) || [])[1] || "";
const MODES = ["Solo", "Duo", "Trio", "Squad"];
const GAME_MODE_INFO = {
  survival: { label: "Survival", icon: "❤️", tag: "Main mode", text: "3 hearts each. Last runner standing wins. Alone it's an endless run." },
  chase: { label: "Brain Chase", icon: "🧠", tag: "Run for it", text: "A giant brain rolls after you and keeps speeding up. Caught = out." },
  coinrush: { label: "Coin Rush", icon: "🪙", tag: "90 seconds", text: "Most coins wins. Get hit and you spill coins for the others." },
  potato: { label: "Hot Potato", icon: "💣", tag: "Pass it on", text: "Bump into someone to pass the bomb. Hold it when it blows: lose a heart." },
  cup: { label: "Party Cup", icon: "🏆", tag: "3 rounds", text: `3 random modes on 3 maps. ${CUP_POINTS.join(" / ")} points per place.` },
  rushcup: { label: "Coin Rush Cup", icon: "🪙", tag: "Tournament", text: "3 Coin Rush rounds on 3 maps. Most points wins." },
  grandtour: { label: "Grand Tour", icon: "🌍", tag: "Tournament", text: "Every mode once: Survival, Brain Chase, Coin Rush and Hot Potato." },
};
const isCupMode = (m) => CUP_MODES.includes(m);
const KIND_LABEL = { survival: "Survival", chase: "Brain Chase", coinrush: "Coin Rush", potato: "Hot Potato", sprint: "Sprint" };
/** One line on how to win, shown during the countdown. */
const KIND_RULE = {
  survival: "3 hearts · last one standing wins",
  chase: "Don't let the brain catch you!",
  coinrush: "Grab the most coins in 90 s",
  potato: "Bump someone to pass the bomb!",
  sprint: "First to the finish line",
};
const MAP_INFO = {
  meadow: { label: "Meadow", text: "Trees, bushes and a picket fence" },
  farm: { label: "Farm", text: "Wheat fields, barns and windmills" },
  beach: { label: "Beach", text: "Boardwalk by the sea, palms and huts" },
};
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
  lightning: { label: "Lightning", hint: "Everyone ahead falls over" },
  banana: { label: "Banana", hint: "Throw it ahead or drop it behind you" },
  bowling: { label: "Bowling ball", hint: "Roll it ahead or back down a lane" },
  freeze: { label: "Freeze", hint: "Everyone else slows down" },
  glue: { label: "Glue puddle", hint: "Drop it behind you: sticky over 2 lanes" },
  fake: { label: "Fake box", hint: "Drop a trap box behind you" },
  boxing: { label: "Boxing glove", hint: "Punch the runner next to you a lane over" },
  brainwave: { label: "Brain Wave", hint: "Flips left and right for everyone ahead" },
  thunder: { label: "Thundercloud", hint: "Storms the leader: pass it on or get zapped" },
  swap: { label: "Mind Swap", hint: "Swap places with the runner ahead" },
};
const WAVE_S = 4; // brain wave: controls flipped this long
const GLUE_SLOW = 0.45; // speed factor while stuck in glue
const STAGGER_S = 0.7; // after a punch
const TOUCH = matchMedia("(pointer: coarse)").matches;
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
    try {
      rank.points();
      const old = this.medals();
      for (const k of MEDALS) gained += Math.max(0, (m[k] ?? 0) - old[k]) * MEDAL_PTS[k];
    } catch {
      gained = 0; // still starting up
    }
    local.setItem("lr:medals", JSON.stringify(m));
    if (gained) rank.add(gained);
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
    return i < STARTERS || this.owned().includes(i);
  },
  /**
   * How a price would be paid: medals of the asked type first; anything still
   * missing is covered by higher medals at their worth (gold 10, silver 5,
   * bronze 3), using the smallest ones first. null when you can't afford it.
   */
  plan(price) {
    const have = this.medals();
    const spend = { gold: 0, silver: 0, bronze: 0 };
    const own = Math.min(have[price.medal], price.count);
    spend[price.medal] = own;
    let missing = (price.count - own) * MEDAL_WORTH[price.medal];
    const higher = MEDALS.filter((m) => MEDAL_WORTH[m] > MEDAL_WORTH[price.medal]).sort((a, b) => MEDAL_WORTH[a] - MEDAL_WORTH[b]);
    for (const m of higher) {
      while (missing > 0 && have[m] - spend[m] > 0) {
        spend[m] += 1;
        missing -= MEDAL_WORTH[m];
      }
    }
    return missing > 0 ? null : spend;
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
  buy(item) {
    const spend = item.price && !this.has(item.id) ? this.plan(item.price) : null;
    if (!spend) return false;
    const m = this.medals();
    for (const k of MEDALS) m[k] -= spend[k];
    local.setItem("lr:owned", JSON.stringify([...this.owned(), item.id]));
    this.save(m);
    return true;
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
  const SAMPLES = ["tap", "coin", "unlock", "boom", "whoosh", "cheer", "slip", "thunder", "pack", "bonk"];
  const MUSIC = { menu: 0.3, race: 0.24 }; // loop volumes
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
    hit: () => sample("bonk", 0.8) || tone(140, 0.35, "sawtooth", 0.18, -90),
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
  $("#hud").classList.toggle("show", name === "race");
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
});
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
  $("#joinOpen").hidden = open;
  $("#joinRow").hidden = !open;
  if (open) setTimeout(() => codeInput.focus(), 30);
}
$("#joinOpen").addEventListener("click", () => openJoin(true));
$("#joinClose").addEventListener("click", () => openJoin(false));
const joinParam = new URLSearchParams(location.search).get("join");
if (joinParam) {
  codeInput.value = joinParam.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  $("#joinOpen").hidden = true;
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
  toast("The swipe guide shows on your next race");
});
renderCountryChips();

// ── cosmetics: trails, celebrations, emotes ──
const TRAIL_INFO = {
  sparkle: { name: "Sparkle", colors: ["#ffffff", "#fff2b0", "#ffd23f"], price: 300 },
  bubbles: { name: "Bubbles", colors: ["#9fe3ff", "#4fc3ff", "#ffffff"], price: 400 },
  fire: { name: "Fire", colors: ["#ff4d00", "#ff9f1c", "#ffe066"], price: 600 },
  rainbow: { name: "Rainbow", colors: ["#ff4d6d"], price: 800 },
  lightning: { name: "Lightning", colors: ["#7df9ff", "#ffffff", "#4f7dff"], price: 800 },
  gold: { name: "Golden", colors: ["#ffd23f", "#ffb300", "#fff2b0"], pass: "free" },
  neon: { name: "Neon", colors: ["#ff3df5", "#3dfcff", "#b6f72a"], pass: "gold" },
};
const CEL_INFO = {
  confetti: { name: "Confetti", icon: "🎊", price: 300 },
  hearts: { name: "Love", icon: "💖", price: 400 },
  goldrain: { name: "Golden rain", icon: "🌟", price: 500 },
  mega: { name: "Mega fireworks", icon: "🎆", pass: "gold" },
};
const EMOTE_PRICE = 200;
function equipped() {
  try {
    const e = JSON.parse(local.getItem("lr:equip") || "{}") || {};
    return { trail: TRAILS.includes(e.trail) && wallet.has(`trail:${e.trail}`) ? e.trail : "", cel: CEL_INFO[e.cel] && wallet.has(`cel:${e.cel}`) ? e.cel : "" };
  } catch {
    return { trail: "", cel: "" };
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
function openShop(tab = "chars") {
  shopReturn = game.mode === "lobby" ? "lobby" : game.mode === "results" ? "results" : "home";
  renderShop();
  shopTab(tab === "chars" ? true : tab === "packs" ? false : tab);
  showScreen("shop");
}
/** Shop tabs: true = characters, false = packs, "items" = trails, celebrations, emotes. */
function shopTab(which) {
  const tab = which === true ? "chars" : which === false ? "packs" : which;
  $("#tabChars").classList.toggle("on", tab === "chars");
  $("#tabPacks").classList.toggle("on", tab === "packs");
  $("#tabItems").classList.toggle("on", tab === "items");
  $("#shopGrid").hidden = tab !== "chars";
  $("#packView").hidden = tab !== "packs";
  $("#itemView").hidden = tab !== "items";
  if (tab === "packs") renderPacks();
  if (tab === "items") renderItems();
}
$("#tabChars").addEventListener("click", () => shopTab(true));
$("#tabPacks").addEventListener("click", () => shopTab(false));
$("#tabItems").addEventListener("click", () => shopTab("items"));
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
    el("h3", { class: "album-title", text: "Win celebrations" }),
    el("div", { class: "item-grid" }, ...Object.entries(CEL_INFO).map(([k, c]) => card(`cel:${k}`, "cel", c.name, el("i", { class: "big-emoji", text: c.icon }), c.price, c.pass))),
    el("h3", { class: "album-title", text: "Emotes" }),
    el("div", { class: "item-grid emotes" }, ...SHOP_EMOTES.map((e) => card(`emote:${e}`, null, e, el("i", { class: "big-emoji", text: e }), EMOTE_PRICE))),
  );
  renderWallet();
}
// ── the character catalog: every character, its rarity and how you get it ──

const RARITY_ORDER = ["common", "rare", "epic", "legendary"];
const STARTER_RARITY = ["common", "common", "common", "rare", "common", "rare", "rare", "epic"];
function allChars() {
  return [
    ...RUNNERS.map((r, i) => ({ id: `r${i}`, idx: i, name: r.name, tag: r.tag, rarity: STARTER_RARITY[i] ?? "common", via: "starter", img: portrait(i), hero: `/assets/full_${r.file}.webp`, playable: true })),
    ...COLLECTION.map((c) => ({ ...c, img: `/assets/sc_${c.id}.webp`, hero: `/assets/sc_${c.id}.webp` })),
    ...PACK_CHARS.map((c) => ({ ...c, via: "pack", img: `/assets/pk_${c.id}.webp`, hero: `/assets/pk_${c.id}.webp` })),
    { ...PASS_CHAR, rarity: "legendary", via: "pass", img: `/assets/pk_${PASS_CHAR.id}.webp`, hero: `/assets/pk_${PASS_CHAR.id}.webp` },
  ];
}
const ownsChar = (c) => c.via === "starter" || wallet.has(c.id);
const VIA_LABEL = { starter: "Free", coins: "Coins", medals: "Medals", pack: "Packs", pass: "Season Pass" };
const VIA_ICON = { starter: "✅", coins: "🪙", medals: "🏅", pack: "🎁", pass: "⭐" };
function howToGet(c) {
  if (c.via === "starter") return "A free runner. Race with it any time.";
  if (c.via === "coins") return `Buy it in the Shop for ${c.coins.toLocaleString()} coins.`;
  if (c.via === "medals") return `Medal exclusive: ${medalText(c.price.medal, c.price.count)}. Win medals by placing top 3 against real players, from the day 7 reward, packs and the Season Pass.`;
  if (c.via === "pack") return `Only in packs (${c.rarity}). Brain Pack: ${pct(PACK_ODDS.normal[c.rarity] / PACK_CHARS.filter((x) => x.rarity === c.rarity).length)} per item. Mega Pack last item: ${pct(PACK_ODDS.boosted[c.rarity] / PACK_CHARS.filter((x) => x.rarity === c.rarity).length)}.`;
  return "Season Pass exclusive: Gold track, level 30.";
}
function collectionCount() {
  const all = allChars();
  return { got: all.filter(ownsChar).length, all: all.length };
}
function renderCollPill() {
  const { got, all } = collectionCount();
  $("#collPillCount").textContent = `${got}/${all}`;
}

// a shop card for a coin or medal character
function shopCard(c) {
  const owned = wallet.has(c.id);
  const can = c.via === "coins" ? wallet.coins() >= c.coins : Boolean(wallet.plan(c.price));
  const price = owned
    ? el("span", { class: "owned-tag", text: "Owned ✓" })
    : c.via === "coins"
      ? el("span", { class: `sprice${can ? "" : " short"}` }, el("i", { class: "coin" }), el("b", { text: c.coins.toLocaleString() }))
      : el("span", { class: `sprice medal${can ? "" : " short"}` }, el("img", { src: MEDAL_IMG[c.price.medal], alt: "" }), el("b", { text: `×${c.price.count}` }));
  const card = el(
    "button",
    { class: `skin ${c.rarity}${owned ? " owned" : ""}`, type: "button" },
    el("span", { class: "rar", text: c.rarity }),
    el("img", { class: "pic", src: `/assets/sc_${c.id}.webp`, alt: "" }),
    el("b", { text: c.name }),
    price,
  );
  card.addEventListener("click", () => (owned ? inspectChar(allChars().find((x) => x.id === c.id)) : askBuy(c)));
  return card;
}
function renderShop() {
  const coinChars = COLLECTION.filter((c) => c.via === "coins");
  const medalChars = COLLECTION.filter((c) => c.via === "medals");
  const packLink = el("button", { class: "shop-link", type: "button" }, el("img", { src: "/assets/pack_brain.webp", alt: "" }), el("span", {}, el("b", { text: "Pack exclusives" }), el("small", { text: `${PACK_CHARS.length} characters you can only pull from packs` })), el("i", { text: "›" }));
  packLink.addEventListener("click", () => shopTab(false));
  const collLink = el("button", { class: "shop-link teal", type: "button" }, el("img", { src: "/assets/pk_brainz.webp", alt: "" }), el("span", {}, el("b", { text: "Your collection" }), el("small", { text: `${collectionCount().got} of ${collectionCount().all} characters` })), el("i", { text: "›" }));
  collLink.addEventListener("click", () => openCollection());
  // the Skins page is on the home screen: only link to it when the shop was opened from there
  collLink.hidden = shopReturn !== "home";
  $("#shopGrid").replaceChildren(
    el("h3", { class: "sec-title" }, el("span", { text: "🪙 Coin characters" }), el("small", { text: "Buy with coins" })),
    el("div", { class: "char-grid" }, ...coinChars.map(shopCard)),
    el("h3", { class: "sec-title medal" }, el("span", { text: "🏅 Medal exclusives" }), el("small", { text: "Medals only · win them against real players" })),
    el("div", { class: "char-grid" }, ...medalChars.map(shopCard)),
    packLink,
    collLink,
  );
  renderWallet();
}

// ── buying, with a confirmation and an unlock reveal ──
let buying = null;
const buyModal = $("#buyModal");
function askBuy(c) {
  buying = c;
  $("#buyTitle").textContent = "Unlock?";
  $("#buyPreview").replaceChildren(el("div", { class: `bp-card ${c.rarity}` }, el("span", { class: "rar", text: c.rarity }), el("img", { src: `/assets/sc_${c.id}.webp`, alt: "" }), el("b", { text: c.name })));
  const can = c.via === "coins" ? wallet.coins() >= c.coins : Boolean(wallet.plan(c.price));
  const spend = c.via === "medals" ? wallet.plan(c.price) : null;
  $("#buyPrice").replaceChildren(
    c.via === "coins"
      ? el("span", {}, el("i", { class: "coin" }), el("b", { text: c.coins.toLocaleString() }), el("small", { text: ` · you have ${wallet.coins().toLocaleString()}` }))
      : el("span", {}, el("img", { src: MEDAL_IMG[c.price.medal], alt: "" }), el("b", { text: medalText(c.price.medal, c.price.count) }), el("small", { text: spend ? ` · pays with ${MEDALS.filter((k) => spend[k]).map((k) => medalText(k, spend[k])).join(" + ")}` : "" })),
    ...(can ? [] : [el("em", { text: c.via === "coins" ? `You need ${(c.coins - wallet.coins()).toLocaleString()} more coins` : "Not enough medals yet" })]),
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
  const ok = c.via === "coins" ? wallet.buyWithCoins(c) : wallet.buy(c);
  if (!ok) return toast("Not enough to unlock that yet");
  stats.add("bought", 1);
  showUnlock({ kind: "char", char: { ...c, img: `/assets/sc_${c.id}.webp` } }, () => {
    if (screens.shop.classList.contains("show")) renderShop();
    if (onSkins()) renderCollection();
  });
  renderCollPill();
});

// ── the collection page ──
let collFilter = "all";
let collRarity = "";
const COLL_FILTERS = [
  ["all", "All"],
  ["owned", "Owned"],
  ["locked", "Locked"],
  ["starter", "Free"],
  ["coins", "🪙 Coins"],
  ["medals", "🏅 Medals"],
  ["pack", "🎁 Packs"],
  ["pass", "⭐ Pass"],
];
/** The collection lives on the home screen's Skins page. */
function openCollection() {
  showScreen("home");
  setHomePage(PAGE.skins);
}
function onSkins() {
  return screens.home.classList.contains("show") && homePage === PAGE.skins;
}
function renderCollection() {
  const all = allChars();
  const { got } = collectionCount();
  $("#collCount").textContent = `${got}/${all.length}`;
  $("#collBar").style.width = `${Math.round((got / all.length) * 100)}%`;
  $("#collPct").textContent = `${Math.round((got / all.length) * 100)}% collected`;
  const chip = (box, key, label, cur, set) => {
    const b = el("button", { class: `chip${cur === key ? " on" : ""}`, type: "button", text: label });
    b.addEventListener("click", () => {
      set(cur === key && box === "r" ? "" : key);
      renderCollection();
    });
    return b;
  };
  $("#collFilters").replaceChildren(...COLL_FILTERS.map(([k, l]) => chip("f", k, l, collFilter, (x) => (collFilter = x || "all"))));
  $("#collRarity").replaceChildren(...RARITY_ORDER.map((k) => chip("r", k, k, collRarity, (x) => (collRarity = x))));
  const shown = all.filter((c) => {
    const owned = ownsChar(c);
    if (collFilter === "owned" && !owned) return false;
    if (collFilter === "locked" && owned) return false;
    if (["starter", "coins", "medals", "pack", "pass"].includes(collFilter) && c.via !== collFilter) return false;
    if (collRarity && c.rarity !== collRarity) return false;
    return true;
  });
  const sel = preferredChar();
  $("#collGrid").replaceChildren(
    ...shown.map((c, n) => {
      const owned = ownsChar(c);
      const card = el(
        "button",
        { class: `ccard ${c.rarity}${owned ? " got" : " locked"}${c.playable && c.idx === sel ? " sel" : ""}`, type: "button", style: `--i:${n}` },
        el("span", { class: "rar", text: c.rarity }),
        el("img", { src: c.img, alt: "" }),
        el("b", { text: owned ? c.name : c.name }),
        el("small", { class: "via", text: owned ? (c.playable ? (c.idx === sel ? "★ Selected" : "Playable") : "Collected") : `${VIA_ICON[c.via]} ${VIA_LABEL[c.via]}` }),
        owned ? null : el("i", { class: "padlock", text: "🔒" }),
      );
      card.addEventListener("click", () => inspectChar(c));
      return card;
    }),
    ...(shown.length ? [] : [el("p", { class: "rempty", text: "Nothing here with these filters." })]),
  );
  renderWallet();
  renderCollPill();
}
$("#collPill").addEventListener("click", () => {
  sfx.unlock();
  openCollection();
});

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
      if (onSkins()) renderCollection();
    };
  } else if (owned) {
    btn.textContent = "In your collection ✓";
    btn.disabled = true;
  } else if (c.via === "coins" || c.via === "medals") {
    btn.textContent = c.via === "coins" ? `Unlock · ${c.coins.toLocaleString()} coins` : `Unlock · ${medalText(c.price.medal, c.price.count)}`;
    action = () => {
      charModal.hidden = true;
      askBuy(c);
    };
  } else if (c.via === "pack") {
    btn.textContent = "Open packs";
    action = () => {
      charModal.hidden = true;
      openShop();
      shopTab(false);
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
];
/** Chances per item slot. Normal slots, and the boosted last slot of a Mega Pack. */
const PACK_ODDS = {
  normal: { legendary: 0.005, epic: 0.03, rare: 0.08, gold: 0.02, silver: 0.06, bronze: 0.105 },
  boosted: { legendary: 0.03, epic: 0.15, rare: 0.4, gold: 0.12, silver: 0.3, bronze: 0 },
};
const PACKS = [
  { id: "brain", name: "Brain Pack", price: 600, slots: ["normal"], img: "/assets/pack_brain.webp", note: "1 item" },
  { id: "mega", name: "Mega Pack", price: 1800, slots: ["normal", "normal", "boosted"], img: "/assets/pack_mega.webp", note: "3 items · last one boosted" },
];
const pct = (x) => `${Math.round(x * 1000) / 10}%`;
function rollSlot(kind) {
  const o = PACK_ODDS[kind];
  let r = Math.random();
  for (const rarity of ["legendary", "epic", "rare"]) {
    if (r < o[rarity]) {
      const pool = PACK_CHARS.filter((c) => c.rarity === rarity);
      return { kind: "char", char: pool[Math.floor(Math.random() * pool.length)] };
    }
    r -= o[rarity];
  }
  for (const medal of ["gold", "silver", "bronze"]) {
    if (r < o[medal]) return { kind: "medal", medal };
    r -= o[medal];
  }
  return { kind: "coins", n: kind === "boosted" ? 600 : 150 + 25 * Math.floor(Math.random() * 13) };
}
function freePackLeft() {
  return !local.getItem("lr:freePack");
}
/** Pay, roll and credit everything right away (so closing the animation can't lose items). */
function buyPack(pack) {
  const free = pack.id === "brain" && freePackLeft();
  if (!free && wallet.coins() < pack.price) return null;
  if (free) local.setItem("lr:freePack", "1");
  else wallet.addCoins(-pack.price);
  return grantPack(pack);
}
/** Roll a pack's items and credit them (characters, medals, coins). */
function grantPack(pack) {
  const items = pack.slots.map(rollSlot);
  for (const it of items) {
    if (it.kind === "char") {
      if (wallet.has(it.char.id)) {
        it.dupe = true;
        wallet.addCoins(it.char.dupe);
      } else local.setItem("lr:owned", JSON.stringify([...wallet.owned(), it.char.id]));
    } else if (it.kind === "medal") {
      const m = wallet.medals();
      m[it.medal] += 1;
      wallet.save(m);
    } else wallet.addCoins(it.n);
  }
  stats.add("packs", 1);
  return items;
}
function renderPacks() {
  $("#packRow").replaceChildren(
    ...PACKS.map((pk) => {
      const free = pk.id === "brain" && freePackLeft();
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
  const owned = PACK_CHARS.filter((c) => wallet.has(c.id)).length;
  $("#albumCount").textContent = `${owned}/${PACK_CHARS.length}`;
  $("#packAlbum").replaceChildren(
    ...PACK_CHARS.map((c) => el(
      "div",
      { class: `acard ${c.rarity}${wallet.has(c.id) ? " got" : ""}` },
      el("span", { class: "rar", text: c.rarity }),
      el("img", { src: `/assets/pk_${c.id}.webp`, alt: "" }),
      el("b", { text: wallet.has(c.id) ? c.name : "???" }),
    )),
  );
  const n = PACK_ODDS.normal;
  $("#packOdds").textContent = `Odds per item: legendary ${pct(n.legendary)} · epic ${pct(n.epic)} · rare ${pct(n.rare)} · medal ${pct(n.gold + n.silver + n.bronze)} · coins ${pct(1 - Object.values(n).reduce((a, b) => a + b, 0))}. Mega Pack's last item: legendary 3% · epic 15% · rare 40%. Duplicates turn into coins. Pack characters are collectibles for now.`;
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
    $("#poCard").hidden = true;
    $("#poHint").hidden = true;
    $("#poSummary").replaceChildren(...po.items.map((it) => itemCard(it)));
    $("#poSummary").hidden = false;
    $("#poDone").hidden = false;
    return;
  }
  const it = po.items[po.i];
  const card = itemCard(it);
  card.classList.add("flip");
  $("#poCard").replaceChildren(card);
  $("#poCard").hidden = false;
  $("#poHint").textContent = po.i < po.items.length - 1 ? `Tap for the next one (${po.i + 1}/${po.items.length})` : "Tap to continue";
  if (it.kind === "char" && !it.dupe) {
    sfx.finish();
    coinRain(card, it.char.rarity === "legendary" ? 30 : 14);
  } else sfx.boost();
  po.busy = true;
  setTimeout(() => po && (po.busy = false), 450);
}
packOpen.addEventListener("click", (e) => {
  if (e.target.closest("#poDone")) return;
  packStep();
});
$("#poDone").addEventListener("click", () => {
  packOpen.hidden = true;
  const done = po?.onDone;
  po = null;
  renderCollPill();
  if (done) return done();
  renderPacks();
  renderShop();
  shopTab(false);
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
  if (!v) return;
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

  if (v.phase === "lobby") {
    if (game.solo && v.host === playerId) {
      // solo: skip the lobby and go straight into the run
      if (!game.soloStarting) {
        game.soloStarting = true;
        const sm = soloMode();
        const mode = sm === "endless" ? "survival" : sm;
        if (v.mode !== mode) act({ type: "mode", mode });
        act({ type: "start", bots: sm !== "endless" });
      }
      return;
    }
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

// Play solo: pick a runner, then a private room starts an endless survival run straight away
const soloModal = $("#soloModal");
function renderSoloPicker() {
  const cur = preferredChar();
  $("#soloPicker").replaceChildren(
    ...RUNNERS.map((r, i) => {
      const locked = !wallet.owns(i);
      const sub = locked
        ? el("small", { class: "lock" }, el("span", { text: "🔒" }), el("img", { src: MEDAL_IMG[r.price.medal], alt: "" }), el("span", { text: `×${r.price.count}` }))
        : el("small", { text: i === cur ? "Selected" : "" });
      const card = el(
        "button",
        { class: `card${i === cur ? " mine" : ""}${locked ? " locked" : ""}`, type: "button", style: `--team:${r.color}` },
        el("img", { src: portrait(i), alt: "" }),
        el("b", { text: r.name, style: `color:${r.color}` }),
        sub,
      );
      card.addEventListener("click", () => {
        if (locked) {
          soloModal.hidden = true;
          return openShop();
        }
        local.setItem("lr:char", String(i));
        world.setShowcase(i);
        renderSoloPicker();
      });
      return card;
    }),
  );
  renderSpotlight($("#soloSpot"), cur, {
    onPick: (i) => {
      local.setItem("lr:char", String(i));
      world.setShowcase(i);
      renderSoloPicker();
    },
  });
  // what to play: the endless run on your own, or any mode against 3 bots
  const pick = soloMode();
  $("#soloModes").replaceChildren(
    ...SOLO_MODES.map((m) => {
      const b = el("button", { class: `solo-mode${m.id === pick ? " on" : ""}`, type: "button", role: "radio", "aria-checked": String(m.id === pick) }, el("b", { text: `${m.icon} ${m.label}` }), el("small", { text: m.sub }));
      b.addEventListener("click", () => {
        local.setItem("lr:soloMode", m.id);
        renderSoloPicker();
      });
      return b;
    }),
  );
  const m = SOLO_MODES.find((x) => x.id === pick);
  $("#soloGo").replaceChildren(el("span", { class: "flagico", text: m.icon }), el("span", { text: pick === "endless" ? `Run as ${RUNNERS[cur].name}` : `Play ${m.label}` }), el("span", { class: "arrow", text: "→" }));
}
const SOLO_MODES = [
  { id: "endless", icon: "🏃", label: "Endless Run", sub: "Just you · beat your best" },
  { id: "survival", icon: "❤️", label: "Survival", sub: "vs 3 bots" },
  { id: "chase", icon: "🧠", label: "Brain Chase", sub: "vs 3 bots" },
  { id: "coinrush", icon: "🪙", label: "Coin Rush", sub: "vs 3 bots" },
  { id: "potato", icon: "💣", label: "Hot Potato", sub: "vs 3 bots" },
  { id: "cup", icon: "🏆", label: "Party Cup", sub: "3 rounds vs bots" },
  { id: "rushcup", icon: "🪙", label: "Coin Rush Cup", sub: "Tournament · 3 rounds" },
  { id: "grandtour", icon: "🌍", label: "Grand Tour", sub: "Tournament · every mode" },
];
function soloMode() {
  const m = local.getItem("lr:soloMode");
  return SOLO_MODES.some((x) => x.id === m) ? m : "endless";
}
$("#soloBtn").addEventListener("click", () => {
  sfx.unlock();
  if (!requireName()) return;
  renderSoloPicker();
  soloModal.hidden = false;
});
$("#soloClose").addEventListener("click", () => (soloModal.hidden = true));
soloModal.addEventListener("click", (e) => e.target === soloModal && (soloModal.hidden = true));
$("#soloGo").addEventListener("click", () => {
  soloModal.hidden = true;
  game.solo = true;
  game.soloStarting = false;
  connect(newCode(), true);
});
$("#createBtn").addEventListener("click", () => {
  sfx.unlock();
  if (!requireName()) return;
  game.solo = false;
  game.wantMode = null;
  connect(newCode(), true);
});
$("#joinBtn").addEventListener("click", () => {
  sfx.unlock();
  if (!requireName()) return;
  game.solo = false;
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
const PAGE = { compete: 0, skins: 1, play: 2, shop: 3 };
const PAGE_NAMES = Object.keys(PAGE);
let homePage = PAGE.play;
function setHomePage(i, animate = true) {
  homePage = Math.max(0, Math.min(PAGE_NAMES.length - 1, i));
  screens.home.dataset.page = PAGE_NAMES[homePage];
  homePages.classList.toggle("drag", !animate);
  homePages.style.transform = `translateX(${-homePage * 100}vw)`;
  for (const t of document.querySelectorAll(".htab")) {
    const on = Number(t.dataset.page) === homePage;
    t.classList.toggle("on", on);
    t.setAttribute("aria-selected", String(on));
  }
  if (homePage === PAGE.compete) renderCompete();
  if (homePage === PAGE.skins) renderCollection();
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
  { id: "rushcup", label: "Coin Rush Cup", img: "/assets/ui_c3.webp", tag: "Tournament · 3 rounds", text: "Three Coin Rush rounds on three maps. Most points wins.", prize: [300, 150, 75] },
  { id: "grandtour", label: "Grand Tour", img: "/assets/medal_gold.png", tag: "Tournament · 4 rounds", text: "Every mode once: Survival, Brain Chase, Coin Rush and Hot Potato.", prize: [500, 250, 120] },
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
  { pts: 45, coins: 700, medal: "bronze" },
  { pts: 70, coins: 1200, medal: "silver" },
  { pts: 90, coins: 2000, medal: "gold" },
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

function renderCompete() {
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
        el("span", { text: `${LEAGUE_MATCHES} matches over the weekend, any mode. Places score ${LEAGUE_PTS.join(" / ")} points.` }),
      ),
    ),
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
  const paid = tourneyPaid();
  const cards = TOURNEYS.map((t) =>
    el(
      "div",
      { class: `tcard t-${t.id}` },
      el(
        "div",
        { class: "tc-head" },
        el("img", { src: t.img, alt: "" }),
        el("div", {}, el("em", { text: t.tag }), el("b", { text: t.label }), el("span", { text: t.text })),
      ),
      el(
        "div",
        { class: "tc-prizes" },
        el("small", { text: "Daily prize" }),
        ...t.prize.map((c, i) => el("span", { class: `prz${paid[t.id]?.place === i + 1 ? " won" : ""}` }, el("b", { text: PLACE_SHORT[i] }), el("i", { class: "coin" }), String(c))),
      ),
      paid[t.id] ? el("p", { class: "tc-note", text: `Today: ${PLACE_SHORT[paid[t.id].place - 1]} place ✓ · finish higher to win the difference` }) : "",
      el(
        "div",
        { class: "tc-btns" },
        el("button", { class: "btn big go", type: "button", "data-mode": t.id, "data-with": "bots", text: "🤖 Vs bots" }),
        el("button", { class: "btn big blue", type: "button", "data-mode": t.id, "data-with": "friends", text: "👥 Host" }),
      ),
    ),
  );
  $("#tourneyList").replaceChildren(weekend, ...cards);
}
function playMode(mode, withWho) {
  sfx.unlock();
  if (soloBtn.disabled) return toast("Still loading the runners…");
  if (!requireName()) return;
  if (withWho === "bots") {
    local.setItem("lr:soloMode", mode);
    renderSoloPicker();
    soloModal.hidden = false;
    return;
  }
  game.solo = false;
  game.wantMode = mode;
  connect(newCode(), true);
}
$("#hpCompete").addEventListener("click", (e) => {
  const b = e.target.closest("[data-mode]");
  if (b) return playMode(b.dataset.mode, b.dataset.with);
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
  dot.hidden = !pass && !$("#questPill").classList.contains("has-claim");
}
renderCompete();

function leaveToHome(message = "") {
  game.mode = "home";
  game.locked = false;
  renderDaily();
  game.solo = false;
  world.clearRace();
  showScreen("home");
  $("#homeMsg").textContent = message;
  if (location.search) history.replaceState(null, "", location.pathname);
}

function leaveLobby() {
  act({ type: "leave" });
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

  const me = v.players.find((p) => p.id === playerId);
  const picker = $("#picker");
  picker.replaceChildren();
  RUNNERS.forEach((r, i) => {
    const owner = v.players.find((p) => p.char === i);
    const mine = owner?.id === playerId;
    const locked = !wallet.owns(i);
    const sub = locked
      ? el("small", { class: "lock" }, el("span", { text: "🔒" }), el("img", { src: MEDAL_IMG[r.price.medal], alt: "" }), el("span", { text: `×${r.price.count}` }))
      : el("small", { text: mine ? "You" : owner ? owner.name : "" });
    const card = el(
      "button",
      { class: `card${mine ? " mine" : ""}${owner && !mine ? " taken" : ""}${locked ? " locked" : ""}`, type: "button", style: `--team:${r.color}` },
      el("img", { src: portrait(i), alt: "" }),
      el("b", { text: r.name, style: `color:${r.color}` }),
      sub,
    );
    card.addEventListener("click", () => {
      if (locked) return openShop();
      if (owner && !mine) return toast(`${r.name} is taken by ${owner.name}`);
      if (!mine) {
        local.setItem("lr:char", String(i));
        act({ type: "pick", char: i });
      }
    });
    picker.append(card);
  });
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
  $("#luModeBox").hidden = !isHost;
  const modePick = $("#modePick");
  modePick.replaceChildren(
    ...Object.entries(GAME_MODE_INFO).map(([key, info]) => {
      const b = el(
        "button",
        { class: `mode-card${gm === key ? " on" : ""}`, type: "button" },
        el("em", { text: info.tag }),
        el("b", { text: `${info.icon} ${key === "survival" && n < 2 && !botsOn() ? "Endless run" : info.label}` }),
        el("span", { text: key === "survival" && n < 2 && !botsOn() ? "Alone: 3 hearts, see how far you get. With friends: last one standing." : info.text }),
      );
      b.disabled = !isHost;
      b.addEventListener("click", () => gm !== key && act({ type: "mode", mode: key }));
      return b;
    }),
  );
  const mp = v.map || "meadow";
  $("#mapPick").replaceChildren(
    ...MAPS.map((key) => {
      const info = MAP_INFO[key];
      const b = el(
        "button",
        { class: `map-card${mp === key ? " on" : ""}`, type: "button", style: `--pic:url(/assets/map_${key}.webp)` },
        el("b", { text: info.label }),
        el("span", { text: info.text }),
      );
      b.disabled = !isHost;
      b.addEventListener("click", () => mp !== key && act({ type: "map", map: key }));
      return b;
    }),
  );
  // start fetching the map's 3D props while everyone is still in the lobby
  for (const key of isCupMode(gm) ? MAPS : [mp]) world.ensureMap(key).catch(() => {});
  const what = isCupMode(gm) ? GAME_MODE_INFO[gm].label : gm === "survival" && n < 2 && !botsOn() ? "endless run" : GAME_MODE_INFO[gm].label;
  $("#lockBtn").replaceChildren(el("span", { class: "flagico", text: "✓" }), el("span", { text: `Lock in ${RUNNERS[me?.char ?? 0].name}` }), el("span", { class: "arrow", text: "→" }));
  renderLineup(v, { isHost, gm, mp, mode, what });
  // once you've locked in your runner, the lobby is the line-up
  if (game.mode === "lobby" && !screens.shop.classList.contains("show")) showScreen(game.locked ? "lineup" : "lobby");
  $("#lobbyCount").textContent = `${mode} · ${GAME_MODE_INFO[gm].label} · ${n}/4 players`;
  $("#readyCount").textContent = `👥 ${n}/4 players ready`;
  $("#lobbyMsg").textContent =
    isHost && n < 2 ? "Share the code with friends. Empty spots get bots (toggle below). Medals and rank points need 2+ real players." : "";
  world.setShowcase(me?.char ?? 0);
  if (world.ready) for (const p of v.players) world.ensureChar(p.char).catch(() => {});
  renderWallet();
}

$("#lockBtn").addEventListener("click", () => {
  sfx.unlock();
  game.locked = true;
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
  if (v.host === playerId) act({ type: "start", bots: botsOn() });
  else act({ type: "ready", ready: !me?.ready });
});

/**
 * The line-up: every runner on a pedestal (yours in the middle, lit blue)
 * with READY / NOT READY. Guests toggle Ready; the host's button becomes
 * Start once everybody else is ready.
 */
function renderLineup(v, { isHost, gm, mp, mode, what }) {
  $("#luCode").textContent = net.code;
  $("#luMode").textContent = isCupMode(gm) ? GAME_MODE_INFO[gm].label : gm === "survival" && v.players.length < 2 && !botsOn() ? "Endless run" : GAME_MODE_INFO[gm].label;
  $("#luMap").textContent = isCupMode(gm) ? "Meadow · Farm · Beach" : `${MAP_INFO[mp].label} · ${botsOn() && v.players.length < 4 ? "with bots" : mode}`;
  const qs = dailyChallenges();
  const qd = dailyState();
  $("#luDaily").textContent = `📋 Challenges ${qs.filter((q) => qd.done[q.id]).length}/${qs.length}`;
  const present = v.players.filter((p) => !p.gone);
  const order = [...v.players];
  // you stand in the middle, like a real lobby
  const mine = order.findIndex((p) => p.id === playerId);
  if (mine >= 0) {
    const [me] = order.splice(mine, 1);
    order.splice(Math.min(1, order.length), 0, me);
  }
  const stage = $("#luStage");
  const peds = order.map((p) => {
    const isMe = p.id === playerId;
    const ok = p.ready || p.id === v.host;
    const ped = el(
      "div",
      { class: `ped${isMe ? " me" : ""}`, style: `--team:${RUNNERS[p.char]?.color ?? "#666"}` },
      el(
        "div",
        { class: "tag" },
        el("b", { text: `${p.id === v.host ? "👑 " : ""}${withFlag(p.name, p.country)}` }),
        el("em", { class: "lgtag" }, el("img", { src: rankOf(p.rp ?? 0).img, alt: "" }), el("span", { text: rankOf(p.rp ?? 0).name })),
        el("span", { class: p.gone ? "no" : ok ? "ok" : "no", text: p.gone ? "Away" : p.id === v.host ? "Host" + (isMe ? " · You" : "") : ok ? "Ready" + (isMe ? " · You" : "") : "Not ready" + (isMe ? " · You" : "") }),
      ),
      el("img", { src: `/assets/full_${RUNNERS[p.char]?.file ?? "c0"}.webp`, alt: RUNNERS[p.char]?.name ?? "" }),
      el("div", { class: "disc" }),
    );
    ped.dataset.id = p.id;
    return ped;
  });
  for (let i = order.length; i < 4; i++) {
    peds.push(el("div", { class: "ped empty" }, el("div", { class: "ghost", text: botsOn() ? "🤖 Bot joins at the start" : `Waiting… code ${net.code}` }), el("div", { class: "disc" })));
  }
  stage.replaceChildren(...peds);

  const waiting = present.filter((p) => p.id !== v.host && !p.ready);
  const go = $("#luGo");
  const status = $("#luStatus");
  const meP = v.players.find((p) => p.id === playerId);
  go.classList.remove("waiting");
  if (isHost) {
    go.textContent = waiting.length ? "Waiting…" : `Start ${what} →`;
    go.classList.toggle("waiting", waiting.length > 0);
    status.textContent = waiting.length ? `Waiting for ${waiting.map((p) => p.name).join(", ")} to get ready` : present.length > 1 ? "Everyone's ready!" : "Start now, or share the code first";
  } else {
    go.textContent = meP?.ready ? "Cancel ready" : "Ready ✓";
    go.classList.toggle("waiting", Boolean(meP?.ready));
    status.textContent = meP?.ready ? (waiting.length ? `Waiting for ${waiting.map((p) => p.name).join(", ")}` : "Waiting for the host to start…") : "Press Ready when you're set";
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
  const text = `Race me in Brain Run! Code ${net.code} → ${url}`;
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title: "Brain Run", text, url });
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
            ? `${Math.round(p.d)} m · ${Math.max(0, LIVES - (p.booms ?? 0))} ❤️ left`
            : survival
        ? `${Math.round(p.d)} m · ${Math.max(0, LIVES - p.hits)} ❤️ left`
        : p.finish !== null
          ? `${p.hits} bump${p.hits === 1 ? "" : "s"}`
          : `${Math.round(p.d)} m of ${TRACK_LEN} m`;
    const extra = p.sc ? ` · ${p.sc} style${p.cb > 1 ? ` · best combo ${p.cb}` : ""}` : "";
    const time = survival
      ? p.outAt !== null
        ? `out ${fmtTime(p.outAt - v.startAt)}`
        : p.left
          ? "–"
          : "Survived"
      : p.finish !== null
        ? fmtTime(p.finish)
        : "DNF";
    const earn = rw?.medal
      ? el("span", { class: "earn" }, el("img", { src: MEDAL_IMG[rw.medal], alt: `${rw.medal} medal` }))
      : el("span", { class: "earn", text: "" });
    list.append(
      el(
        "li",
        { class: p.id === playerId ? "me" : "" },
        el("span", { class: `pl p${Math.min(i + 1, 4)}`, text: PLACE[i] ?? `${i + 1}th` }),
        el("img", { src: portrait(p.char), alt: "" }),
        el("span", { class: "who", text: withFlag(p.name, p.country) + (p.bot ? " 🤖" : "") + (p.id === playerId ? " (you)" : "") }, el("small", { text: detail + extra })),
        el("span", { class: "tm", text: time }),
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
      ? "Party Cup champion!"
      : `Party Cup: ${PLACE[myPlace - 1] ?? myPlace}`
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
  if (rpChange && v.standings.length >= 2 && (cupDone ? cup.table[0] === playerId : !cup && myPlace === 1)) setTimeout(() => sfx.cheer(), 300);
  const ptsBefore = rank.points();
  if (mine?.medal) {
    const fresh = wallet.claim(`${v.startAt}:${playerId}`, mine.medal);
    reward.append(el("img", { src: MEDAL_IMG[mine.medal], alt: "" }), el("span", { text: `+1 ${mine.medal} medal` }));
    if (fresh) sfx.boost();
  } else if (cup && !cupDone) {
    reward.append(el("span", { class: "nomedal", text: `+${CUP_POINTS[v.standings.indexOf(playerId)] ?? 0} points · medals are paid after round ${cup.races.length}` }));
  } else if (myPlace && v.players.filter((p) => !p.bot).length >= MIN_RACERS_FOR_MEDALS) {
    reward.append(el("span", {
      class: "nomedal",
      text: v.players.filter((p) => !p.bot).length < MIN_RACERS_FOR_MEDALS ? "Medals are won in races with 2 or more players" : "No medal this time. Top 3 win medals!",
    }));
  }
  if (rpChange) {
    reward.append(el("span", { class: "coinchip" }, el("img", { src: "/assets/ui_c2.webp", alt: "" }), el("b", { text: `+${rpChange.coins}` }), el("small", { text: rpChange.kos ? `incl. ${rpChange.kos} hit${rpChange.kos > 1 ? "s" : ""} ×10` : "coins" })));
    if (rpChange.xp) reward.append(el("span", { class: "xpchip", text: `+${rpChange.xp} XP` }));
    if (rpChange.prize) reward.append(el("span", { class: "xpchip prizechip", text: `🏆 Prize +${rpChange.prize}` }));
    if (rpChange.league) reward.append(el("span", { class: "xpchip leaguechip", text: `Weekend League +${rpChange.league.pts} pts · ${rpChange.league.matches}/${LEAGUE_MATCHES}` }));
    if (rpChange.botsOnly) reward.append(el("span", { class: "nomedal", text: "Medals (and league progress) need 2 real players" }));
    else reward.append(rankChip(rank.points() - ptsBefore));
  }
  renderWallet();

  const isHost = v.host === playerId;
  const hasNext = cup && !cupDone;
  $("#nextBtn").style.display = isHost && hasNext ? "" : "none";
  $("#againBtn").style.display = isHost && !hasNext && !game.solo ? "" : "none";
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
    el("h4", { text: done ? "🏆 Final Party Cup table" : `🏆 Party Cup · after round ${cup.race} of ${cup.races.length}` }),
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

// Brain Chase: a little rear-view mirror in the corner, so you can see it coming
const mirrorCam = new THREE.PerspectiveCamera(55, 1.5, 0.5, 400);
function renderMirror() {
  const on = renderer && game.mode === "race" && game.kind === "chase" && !me.out && me.runner;
  $("#mirrorFrame").hidden = !on;
  if (!on) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const mw = Math.round(Math.min(170, w * 0.38));
  const mh = Math.round(mw / 1.5);
  const x = w - mw - 12;
  const y = h - mh - Math.round(h * 0.2); // bottom-left origin in WebGL
  const p = me.runner.group.position;
  mirrorCam.position.set(p.x * 0.5, 3.2, p.z - 3);
  mirrorCam.lookAt(p.x * 0.3, 2.2, p.z + 30);
  renderer.setScissorTest(true);
  renderer.setScissor(x, y, mw, mh);
  renderer.setViewport(x, y, mw, mh);
  renderer.render(scene, mirrorCam);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);
  const f = $("#mirrorFrame");
  f.style.width = `${mw}px`;
  f.style.height = `${mh}px`;
  f.style.right = "12px";
  f.style.bottom = `${Math.round(h * 0.2)}px`;
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

  // Sky: the Higgsfield panorama wraps around the world on a far cylinder;
  // above it, a solid colour sampled from the panorama's top edge.
  scene.background = new THREE.Color("#1f78d1");
  scene.fog = new THREE.Fog("#bfe9f2", 60, 190);
  scene.add(new THREE.HemisphereLight("#e6f6ff", "#5fae3a", 1.35));
  const sun = new THREE.DirectionalLight("#fff4d6", 1.6);
  sun.position.set(-6, 14, 8);
  scene.add(sun);

  const skyGroup = new THREE.Group();
  scene.add(skyGroup);
  texLoader.load("/assets/sky_pano.jpg", (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(2, 1);
    const R = 300;
    const H = ((2 * Math.PI * R) / 2) * (t.image.height / t.image.width);
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(R, R, H, 64, 1, true),
      new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    cyl.position.y = H / 2 - 40;
    cyl.renderOrder = -1;
    skyGroup.add(cyl);
    try {
      const c = document.createElement("canvas");
      c.width = 16;
      c.height = 4;
      c.getContext("2d").drawImage(t.image, 0, 0, t.image.width, 8, 0, 0, 16, 4);
      const px = c.getContext("2d").getImageData(0, 0, 16, 4).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
      const n = px.length / 4;
      scene.background = new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
    } catch {
      /* keep the default top colour */
    }
  });

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
  const grassTex = texLoader.load("/assets/grass.jpg");
  grassTex.colorSpace = THREE.SRGBColorSpace;
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.anisotropy = 4;
  const GROUND_LEN = TRACK_LEN + 900;
  grassTex.repeat.set(700 / 6, GROUND_LEN / 6);
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
  for (let i = 0; i <= LANES; i++) {
    const w = i === 0 || i === LANES ? 0.16 : 0.09;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(w, TRACK_LEN + 200), chalk);
    line.rotation.x = -Math.PI / 2;
    line.position.set((i - LANES / 2) * LANE_W, 0.06, -TRACK_LEN / 2 - 40);
    trackGroup.add(line);
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
    grd.addColorStop(0, "rgba(0,0,0,0.45)");
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
    if (map === "meadow" || mapReady(map)) return Promise.resolve();
    if (!mapLoads.has(map)) {
      const P = assets.props;
      const jobs =
        map === "farm"
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
            else P.boardTile = P.boardTileNext;
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
  function fitProp(root, { width, height, maxHeight }) {
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    const holder = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(root);
    holder.add(inner);
    if (size.z > size.x * 1.15) inner.rotation.y = Math.PI / 2;
    holder.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(inner);
    const s2 = b2.getSize(new THREE.Vector3());
    const c2 = b2.getCenter(new THREE.Vector3());
    inner.position.set(-c2.x, -b2.min.y, -c2.z);
    const k = width ? width / s2.x : height / s2.y;
    holder.scale.setScalar(k);
    if (maxHeight && s2.y * k > maxHeight) holder.scale.y = maxHeight / s2.y;
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
  function fitTile(root) {
    const holder = fitProp(root, { width: TRACK_W });
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
      loadGLB("/assets/cow.glb").then((g) => (assets.props.crate1 = fitProp(g.scene, { width: 1.7, maxHeight: 1.9 }))),
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
    g.add(blobShadow(1.1));
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
    farm: { color: "#e9d68a", tex: true },
    beach: { color: "#f0dca4", tex: false },
  };
  function mapReady(map) {
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
    const look = MAP_GROUND[map];
    ground.material.color.set(look.color);
    ground.material.map = look.tex ? grassTex : null;
    ground.material.needsUpdate = true;
    if (!sharedBuilt) buildShared();
  }
  let sharedBuilt = false;

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
    const tile = map === "farm" ? P.farmTile : map === "beach" ? P.boardTile : P.ground;
    const step = tile.userData.length * 0.97;
    for (let z = -60; z < TRACK_LEN + 160; z += step) add(tile, 0, 0, z, 1, 0);
    flatTrack.visible = false;
    for (let z = -40; z < TRACK_LEN + 120; z += 2.9) {
      for (const side of [-1, 1]) add(P.fence, side * (TRACK_W / 2 - 0.1), 0, z, 1, Math.PI / 2);
    }
    const edge = TRACK_W / 2;

    if (map === "meadow") {
      // trees, bushes and rocks on the meadow
      const trees = [P.oak, P.pine, P.blossom];
      for (let z = -60; z < TRACK_LEN + 160; z += 5 + r() * 5) {
        for (const side of [-1, 1]) {
          const roll = r();
          const x = side * (edge + 2.5 + r() * 26);
          if (roll < 0.55) add(trees[Math.floor(r() * 3)], x, MEADOW_Y, z, 0.8 + r() * 0.5, r() * Math.PI * 2);
          else if (roll < 0.85) add(P.bush, side * (edge + 1.6 + r() * 10), MEADOW_Y, z, 0.7 + r() * 0.6, r() * Math.PI * 2);
          // a bush hugging the fence every few metres keeps the meadow edge lively
          if (r() < 0.45) add(P.bush, side * (edge + 1.0 + r() * 1.5), MEADOW_Y, z + r() * 4, 0.5 + r() * 0.4, r() * Math.PI * 2);
          else add(P.rocks, side * (edge + 2 + r() * 14), MEADOW_Y, z, 0.6 + r() * 0.8, r() * Math.PI * 2);
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
    skyGroup.position.z = camZ;
    clouds.position.z = camZ;
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
      const heart = { obj: spr, lane: h.lane, z: h.z, taken: false };
      hearts.push(heart);
      cullables.push({ obj: spr, z: h.z, box: heart });
    }
    for (const row of course.rows) {
      row.lanes.forEach((kind, lane) => {
        if (!kind) return;
        const look = row.looks?.[lane] ?? 0;
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
    return course;
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
  /** Your win celebration, over your runner. */
  function celebrate(kind, x, z) {
    const at = (ms, fn) => setTimeout(fn, ms);
    if (kind === "confetti") for (let i = 0; i < 5; i++) at(i * 220, () => spray(x, 3.2, z - 2, ["#ff4d6d", "#ffd23f", "#4cd964", "#4fa8ff", "#c27bff"], 90, { speed: 8, up: 4, life: 1.8, gravity: 5 }));
    else if (kind === "goldrain") for (let i = 0; i < 8; i++) at(i * 150, () => spray(x + (Math.random() - 0.5) * 3, 6, z - 2, ["#ffd23f", "#ffb300", "#fff2b0"], 50, { speed: 2, life: 2, gravity: 6, size: 0.45 }));
    else if (kind === "hearts") for (let i = 0; i < 4; i++) at(i * 260, () => spray(x, 2.6, z - 2, ["#ff4d8d", "#ff9fc4", "#ffffff"], 80, { speed: 6, up: 3, life: 1.5, gravity: 3, size: 0.5 }));
    else if (kind === "mega") {
      for (let i = 0; i < 4; i++) at(i * 300, () => fireworks(z - 10 - i * 4));
      at(200, () => spray(x, 3, z - 2, ["#ffd23f", "#c27bff", "#4fa8ff"], 150, { speed: 10, up: 5, life: 2 }));
    } else fireworks(z - 14);
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
  };
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
      if (m.kind === "bees") {
        for (const b of m.obj.children) {
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
  let coinList = [];
  let looseMeshes = new Map();
  const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.14, 24);
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc928, metalness: 0.2, roughness: 0.35, emissive: 0xb07a00, emissiveIntensity: 0.55 });
  const bigCoinMat = new THREE.MeshStandardMaterial({ color: 0xff9f1c, metalness: 0.2, roughness: 0.3, emissive: 0xc05000, emissiveIntensity: 0.6 });
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
  function loadModeProp(name, size) {
    if (assets.props[name] !== undefined) return Promise.resolve(assets.props[name]);
    assets.props[name] = null;
    return loadGLB(`/assets/${name}.glb`)
      .then((g) => (assets.props[name] = fitProp(g.scene, size)))
      .catch(() => (assets.props[name] = null));
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
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex("💣"), depthTest: false, transparent: true }));
      spr.scale.set(1.2, 1.2, 1);
      spr.renderOrder = 12;
      bombObj.add(spr);
      bombObj.visible = false;
      scene.add(bombObj);
      loadModeProp("bomb", { width: 0.95, maxHeight: 1.2 }).then((m) => {
        if (!m || !bombObj || modeKind !== "potato") return;
        bombObj.remove(spr);
        bombObj.add(sizeTo(m.clone(), 0.9));
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
    if (modeKind === "potato" && bombObj) {
      const at = v.bomb ? posOf(v.bomb.holder) : null;
      bombObj.visible = Boolean(at);
      if (at) {
        const k = performance.now() / 1000;
        const left = (v.bomb.until - sn) / 1000;
        const pulse = left < 3 ? 1 + Math.sin(k * 25) * 0.12 : 1 + Math.sin(k * 6) * 0.05;
        bombObj.position.set(at.x, at.y + CHAR_H + 0.9, at.z);
        bombObj.scale.setScalar(pulse);
        bombObj.rotation.y = k * 2;
      }
    }
  }
  function explode(x, z) {
    burst(x, 1.2, z, ["#ff9f1c", "#ff4d00", "#ffe066", "#333333"], 90);
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
    celebrate,
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

function enterRace(v) {
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
    $("#countdown").textContent = "Loading…";
    return;
  }
  game.pendingRace = false;
  game.mode = "race";
  game.round = v.round;
  game.soloStarting = false;
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
  game.introsShown = new Set();
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
    el("b", { text: v.cup ? `🏆 Round ${v.cup.race}/${v.cup.races.length} · ${info.icon} ${KIND_LABEL[game.kind]}` : `${info.icon} ${KIND_LABEL[game.kind] ?? ""}` }),
    el("small", { text: KIND_RULE[game.kind] ?? "" }),
  );
  setTimeout(() => game.round === v.round && tag.classList.add("small"), 7000);
  tag.classList.toggle("small", Boolean(v.cup)); // the cup's reel shows the mode instead
  world.setupMode(game.kind, race.course);
  world.setupMovers(race.course, v.seed, game.mapFailed ? "meadow" : map);
  if (v.cup && v.phase === "countdown") spinReveal(v.cup.race, game.kind);
  game.lastBlast = Math.max(0, ...(v.blasts || []).map((b) => b.id));
  game.coinGot = new Set();
  renderModeHud();
  const touch = matchMedia("(pointer: coarse)").matches;
  $("#swipeTut").hidden = !(touch && !local.getItem("lr:tutDone"));
  const hint = $("#controlsHint");
  // phones get the swipe card the first time; after that the HUD speaks for itself
  hint.textContent = touch ? "" : "↑ jump · ↓ slide · ← → lane · E use power-up · hold C to look back";
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
  // the last runner standing gets fireworks over their head (yours: your celebration)
  if (isSurvival()) {
    const top = v.standings?.[0];
    const z = top === playerId ? -me.d : -(remote.map.get(top)?.dispD ?? me.d);
    if (top === playerId && equipped().cel) world.celebrate(equipped().cel, laneX(me.x), z);
    else world.fireworks(z - 14);
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

// ── input ───────────────────────────────────────────────────────────────────

function canControl() {
  const v = net.view;
  return game.mode === "race" && v && serverNow() >= v.startAt && !me.finished && !me.out;
}

function input(kind) {
  if (!$("#swipeTut").hidden && kind !== "use") {
    $("#swipeTut").hidden = true;
    local.setItem("lr:tutDone", "1");
  }
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
  const lb = $("#lookBtn");
  const on = (e) => {
    e.preventDefault();
    game.lookBack = true;
  };
  const off = () => (game.lookBack = false);
  lb.addEventListener("pointerdown", on);
  lb.addEventListener("pointerup", off);
  lb.addEventListener("pointerleave", off);
  lb.addEventListener("pointercancel", off);
}

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
  if (me.staggerT > 0) base *= 0.6;
  if (net.view?.bomb?.holder === playerId) base *= 1.15; // catch someone and pass it on!
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
  for (const h of world.hearts) {
    if (h.taken || h.z < prevD - 0.8 || h.z > me.d + 0.8 || Math.abs(me.x - h.lane) > 0.6) continue;
    if (!heartsFromHits() || me.hits <= 0) continue; // full health: leave it
    h.taken = true;
    me.hits -= 1;
    renderHearts(false);
    sfx.pickup();
    banner("+1 ❤️", 900);
    world.burst(laneX(h.lane), 1.2, -h.z, ["#ff4d6d", "#ff9fb3", "#ffffff"], 60);
    sendPos(true);
  }
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
  me.hits += 1;
  game.lastHitD = me.d;
  me.combo = 0;
  renderCombo();
  if (heartsFromHits()) {
    renderHearts(true);
    if (me.hits >= LIVES) {
      knockOut();
      return;
    }
  }
  me.stumbleT = STUMBLE_S;
  me.invulnT = INVULN_S;
  me.boostT = 0;
  me.slideT = 0;
  me.vy = 0;
  shake = 0.4;
  if (kind === "banana") sfx.slip();
  else if (kind === "fake") sfx.boom();
  else sfx.hit();
  buzz(80);
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
  banner(hintText, 900);
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
  challenge("style", me.score);
  const pop = $("#stylePop");
  pop.replaceChildren(el("b", { text }), el("span", { text: `+${gained}` }));
  pop.classList.remove("show");
  void pop.offsetWidth;
  pop.classList.add("show");
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
  if (!prev || v.round !== prev.round) {
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
    feed({ freeze: `❄️ ${nameOf(z.by)} froze everyone`, brainwave: `🌀 ${nameOf(z.by)} sent a brain wave` }[z.kind] ?? `⚡ ${nameOf(z.by)} called lightning`);
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
    const card = [...document.querySelectorAll("#slots .rcard, #luStage .ped")].find((c) => c.dataset.id === id);
    if (card) {
      const b = el("span", { class: "emo", text: e });
      card.append(b);
      setTimeout(() => b.remove(), 2200);
    }
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
  if (!$("#questModal").hidden) $("#questReset").textContent = untilMidnight();
  if (!$("#streakModal").hidden && streakState().claimedToday) $("#streakClaim").textContent = `Next reward in ${untilMidnight()}`;
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
function missionRow({ icon, tier, tierClass, text, have, goal, reward, state, onClaim, extra }) {
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
      el("span", { class: "qtier", text: tier }),
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
  $("#questCount").textContent = `${n}/${qs.length}`;
  $("#dailyDot").hidden = ready === 0;
  $("#questSub").textContent = n === qs.length ? (ready ? "All done! Claim your rewards." : "All done! New missions tomorrow.") : `${n} of ${qs.length} done today`;
  $("#questReset").textContent = untilMidnight();
  $("#questList").replaceChildren(
    ...qs.map((q) =>
      missionRow({
        icon: STAT_ICON[q.stat],
        tier: q.tier,
        tierClass: q.tier,
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
const questModal = $("#questModal");
$("#questPill").addEventListener("click", () => {
  renderDaily();
  questTab(true);
  questModal.hidden = false;
});
$("#questClose").addEventListener("click", () => (questModal.hidden = true));
questModal.addEventListener("click", (e) => e.target === questModal && (questModal.hidden = true));
renderDaily();

// ── login streak: come back every day, day 7 pays big ──

const STREAK_REWARDS = [
  { coins: 50, img: "/assets/ui_c1.webp" },
  { coins: 75, img: "/assets/ui_c1.webp" },
  { coins: 100, img: "/assets/ui_c2.webp" },
  { coins: 150, img: "/assets/ui_c2.webp" },
  { coins: 200, img: "/assets/ui_c3.webp" },
  { coins: 300, img: "/assets/ui_c3.webp" },
  { coins: 750, medal: "gold", img: "/assets/ui_chest.webp" },
];
function streakState() {
  let s = {};
  try { s = JSON.parse(local.getItem("lr:streak") || "{}") || {}; } catch { /* fresh streak */ }
  const day = Number.isInteger(s.day) && s.day >= 1 && s.day <= 7 ? s.day : 0;
  const yesterday = dayKey(new Date(Date.now() - 864e5));
  const claimedToday = s.last === todayKey();
  // the day you'd claim next: keep going if you came yesterday, else back to day 1
  const next = claimedToday ? day : s.last === yesterday ? (day % 7) + 1 : 1;
  return { day, last: s.last, claimedToday, next, broken: !claimedToday && Boolean(s.last) && s.last !== yesterday };
}
function renderStreak() {
  const st = streakState();
  $("#streakDay").textContent = `Day ${st.next}`;
  $("#streakPill").querySelector(".dot").hidden = st.claimedToday;
  $("#streakPill").classList.toggle("ready", !st.claimedToday);
  $("#streakSub").textContent = st.claimedToday
    ? "See you tomorrow, keep it going!"
    : st.broken
      ? "Streak lost. Start again!"
      : "Every day pays more. Day 7 is the jackpot!";
  $("#streakCount").textContent = String(st.claimedToday ? st.day : st.next - 1);
  $("#streakGrid").replaceChildren(
    ...STREAK_REWARDS.map((r, i) => {
      const n = i + 1;
      const claimed = st.claimedToday ? n <= st.day : n < st.next;
      const today = n === st.next && !st.claimedToday;
      return el(
        "div",
        { class: `sday${claimed ? " claimed" : ""}${today ? " today" : ""}${n === 7 ? " jackpot" : ""}`, style: `--i:${i}` },
        el("small", { text: today ? "Today" : n === 7 ? "Day 7 · Jackpot" : `Day ${n}` }),
        el("div", { class: "sart" }, today ? el("i", { class: "rays" }) : null, el("img", { src: r.img, alt: "" })),
        el("b", { text: r.coins.toLocaleString() }),
        r.medal ? el("em", {}, el("img", { src: MEDAL_IMG.gold, alt: "" }), el("span", { text: "+ gold medal" })) : null,
        claimed ? el("span", { class: "tick", text: "✓" }) : null,
      );
    }),
  );
  const btn = $("#streakClaim");
  btn.disabled = st.claimedToday;
  btn.classList.toggle("off", st.claimedToday);
  btn.textContent = st.claimedToday ? `Next reward in ${untilMidnight()}` : `Claim ${STREAK_REWARDS[st.next - 1].coins.toLocaleString()} coins`;
}
function claimStreak() {
  const st = streakState();
  if (st.claimedToday) return;
  const r = STREAK_REWARDS[st.next - 1];
  local.setItem("lr:streak", JSON.stringify({ day: st.next, last: todayKey() }));
  stats.add("days", 1);
  passXp(50);
  wallet.addCoins(r.coins);
  if (r.medal) {
    const m = wallet.medals();
    m[r.medal] += 1;
    wallet.save(m);
  }
  sfx.finish();
  coinRain($("#streakGrid .sday.today") || $("#streakClaim"), st.next === 7 ? 36 : 16);
  toast(st.next === 7 ? `JACKPOT! +${r.coins} coins and a gold medal` : `Day ${st.next}: +${r.coins} coins`);
  renderStreak();
  setTimeout(() => ($("#streakModal").hidden = true), 1400);
}
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
const streakModal = $("#streakModal");
function openStreak() {
  renderStreak();
  streakModal.hidden = false;
}
$("#streakPill").addEventListener("click", openStreak);
$("#streakClose").addEventListener("click", () => (streakModal.hidden = true));
$("#streakClaim").addEventListener("click", claimStreak);
streakModal.addEventListener("click", (e) => e.target === streakModal && (streakModal.hidden = true));
renderStreak();
// ── ranking: leagues climbed with medal points ──

/** Leagues are climbed with medal points only: every medal you earn counts, spending them doesn't. */
const MEDAL_PTS = { gold: 3, silver: 2, bronze: 1 };
const LEAGUES = [
  { id: "bronze", name: "Bronze", min: 0, steps: [0, 3, 6] },
  { id: "silver", name: "Silver", min: 10, steps: [10, 15, 20] },
  { id: "gold", name: "Gold", min: 28, steps: [28, 36, 44] },
  { id: "platinum", name: "Platinum", min: 55, steps: [55, 66, 77] },
  { id: "diamond", name: "Diamond", min: 90, steps: [90, 105, 120] },
  { id: "master", name: "Brain Master", min: 140, steps: [140] },
];
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
  /** League points: 3 per gold, 2 per silver, 1 per bronze medal ever earned. */
  points() {
    const raw = local.getItem("lr:lp");
    if (raw === null) {
      // first run with medal leagues: count the medals you hold plus the ones spent on characters
      let pts = 0;
      const m = wallet.medals();
      for (const k of MEDALS) pts += m[k] * MEDAL_PTS[k];
      for (const c of COLLECTION) if (c.via === "medals" && wallet.has(c.id)) pts += c.price.count * MEDAL_PTS[c.price.medal];
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
  // Party Cup rounds pay double
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
        el("img", { class: "rface", src: portrait(f.char ?? 0), alt: "" }),
        el("span", { class: "rwho" }, el("b", { text: withFlag(f.name, f.country) + (f.me ? " (you)" : "") }), el("small", { text: fr.name })),
        el("img", { class: "rlg", src: fr.img, alt: "" }),
        el("b", { class: "rrp", text: f.rp.toLocaleString() }),
      );
    }),
    ...(rows.length < 2 ? [el("p", { class: "rempty", text: "Play with friends: everyone you race with shows up here, so you can compare ranks." })] : []),
  );
  $("#leagueList").replaceChildren(
    ...[...LEAGUES].reverse().map((l) => el(
      "div",
      { class: `lrow ${l.id}${l.id === r.league.id ? " me" : ""}` },
      el("img", { src: `/assets/lg_${l.id}.webp`, alt: "" }),
      el("span", { class: "rwho" }, el("b", { text: l.name }), el("small", { text: `from ${l.min.toLocaleString()} pts${l.steps.length > 1 ? " · I · II · III" : ""}` })),
      l.id === r.league.id ? el("span", { class: "you-tag", text: "You" }) : null,
    )),
    el("p", { class: "rhow", text: "Climb the leagues with medals only: every gold medal you earn is 3 points, silver 2, bronze 1. Spending medals never moves you down." }),
  );
}
function rankTab(friends) {
  $("#tabFriends").classList.toggle("on", friends);
  $("#tabLeagues").classList.toggle("on", !friends);
  $("#friendList").hidden = !friends;
  $("#leagueList").hidden = friends;
}
function openRank() {
  renderRank();
  rankTab(true);
  rankModal.hidden = false;
}
$("#rankBadgeBtn").addEventListener("click", openRank);
$("#leagueCard").addEventListener("click", openRank);
$("#tabFriends").addEventListener("click", () => rankTab(true));
$("#tabLeagues").addEventListener("click", () => rankTab(false));
$("#rankClose").addEventListener("click", () => (rankModal.hidden = true));
rankModal.addEventListener("click", (e) => e.target === rankModal && (rankModal.hidden = true));
renderRankPill();

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
  { id: "packs", stat: "packs", text: (n) => `Open ${n} pack${n > 1 ? "s" : ""}`, tiers: [1, 10, 50], coins: [100, 400, 1500], icon: "/assets/pack_brain.webp" },
  { id: "days", stat: "days", text: (n) => `Claim the daily reward ${n} times`, tiers: [3, 7, 30], coins: [100, 300, 1500], icon: "/assets/ui_chest.webp" },
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
  const any = ACHIEVEMENTS.some((a) => achState(a).ready);
  $("#tabAll .dot").hidden = !any;
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
  const trophies = ACHIEVEMENTS.some((a) => achState(a).ready);
  $("#careerDot").hidden = !career;
  $("#questPill").classList.toggle("has-claim", daily || career || trophies);
  renderStoreDot();
}
function renderAch() {
  $("#achList").replaceChildren(
    ...ACHIEVEMENTS.map((a) => {
      const st = achState(a);
      const pct = st.done ? 100 : Math.round((Math.min(st.have, st.goal) / st.goal) * 100);
      const stars = el("span", { class: "stars" }, ...a.tiers.map((_, i) => el("i", { class: i < st.tier ? "on" : "", text: "★" })));
      let right;
      if (st.done) right = el("div", { class: "qreward done-all" }, el("b", { text: "★★★" }));
      else if (st.ready) {
        right = el("button", { class: "aclaim", type: "button" }, el("img", { src: "/assets/ui_c1.webp", alt: "" }), el("b", { text: `+${a.coins[st.tier]}` }));
        right.addEventListener("click", () => {
          const c = achClaimed();
          c[a.id] = st.tier + 1;
          local.setItem("lr:ach", JSON.stringify(c));
          wallet.addCoins(a.coins[st.tier]);
          passXp(100);
          coinRain(right, 14);
          sfx.finish();
          toast(`+${a.coins[st.tier]} coins`);
          renderAch();
          renderAchDot();
        });
      } else right = el("div", { class: "qreward" }, el("img", { src: "/assets/ui_c1.webp", alt: "" }), el("b", { text: `+${a.coins[st.tier]}` }));
      return el(
        "div",
        { class: `quest ach t${st.tier}${st.ready ? " ready" : ""}${st.done ? " done" : ""}` },
        el("div", { class: "qicon" }, el("img", { src: a.icon, alt: "" })),
        el(
          "div",
          { class: "qmain" },
          stars,
          el("b", { text: a.text(st.goal) }),
          el("div", { class: "qbar" }, el("i", { style: `width:${pct}%` }), el("span", { text: st.done ? "Complete!" : `${Math.min(st.have, st.goal).toLocaleString()} / ${st.goal.toLocaleString()}` })),
        ),
        right,
      );
    }),
  );
}
/** Missions tabs: true = daily, "career", false = trophies. */
function questTab(which) {
  const tab = which === true ? "daily" : which === false ? "trophies" : which;
  $("#tabDaily").classList.toggle("on", tab === "daily");
  $("#tabCareer").classList.toggle("on", tab === "career");
  $("#tabAll").classList.toggle("on", tab === "trophies");
  $("#questList").hidden = tab !== "daily";
  $("#questHead").hidden = tab !== "daily";
  $("#careerList").hidden = tab !== "career";
  $("#achList").hidden = tab !== "trophies";
  if (tab === "trophies") renderAch();
  if (tab === "career") renderCareer();
}
$("#tabDaily").addEventListener("click", () => questTab(true));
$("#tabCareer").addEventListener("click", () => questTab("career"));
$("#tabAll").addEventListener("click", () => questTab(false));
renderAchDot();

// ── season pass: 30 levels, a free and a gold track, a new season every month ──

const PASS_LEVELS = 30;
const PASS_XP = 400; // per level
const GOLD_PASS_PRICE = 3000;
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
/** What each level gives. Free: coins, medals, packs, a trail. Gold: more of everything, exclusives, and the level-30 character. */
function passReward(level, track) {
  if (track === "free") {
    if (level === 30) return { item: "trail:gold", label: "Golden trail", icon: "✨" };
    if (level % 10 === 5) return { pack: "brain", label: "Brain Pack", img: "/assets/pack_brain.webp" };
    if (level % 4 === 0) return { medal: level >= 20 ? "silver" : "bronze", label: `${level >= 20 ? "Silver" : "Bronze"} medal`, img: MEDAL_IMG[level >= 20 ? "silver" : "bronze"] };
    return { coins: 50 + level * 10, label: `${50 + level * 10} coins`, img: "/assets/ui_c1.webp" };
  }
  if (level === 30) return { char: PASS_CHAR.id, label: PASS_CHAR.name, img: `/assets/pk_${PASS_CHAR.id}.webp` };
  if (level === 10) return { item: "trail:neon", label: "Neon trail", icon: "🌈" };
  if (level === 20) return { item: "cel:mega", label: "Mega fireworks", icon: "🎆" };
  if (level === 15 || level === 25) return { pack: "mega", label: "Mega Pack", img: "/assets/pack_mega.webp" };
  if (level % 5 === 0) return { medal: "gold", label: "Gold medal", img: MEDAL_IMG.gold };
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
  buy.replaceChildren(el("span", { text: "Unlock Gold Pass" }), el("i", { class: "coin" }), el("span", { text: GOLD_PASS_PRICE.toLocaleString() }));
  buy.disabled = wallet.coins() < GOLD_PASS_PRICE;
}
$("#passBuy").addEventListener("click", () => {
  const p = passState();
  if (p.hasGold || wallet.coins() < GOLD_PASS_PRICE) return;
  wallet.addCoins(-GOLD_PASS_PRICE);
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
    chest: { coins: 300, pack: "brain" },
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
    chest: { coins: 1000, medal: "gold" },
    missions: [
      { stat: "chaseBest", goal: 120, text: "Survive 2 minutes in Brain Chase", coins: 200, icon: "/assets/ui_watch.webp" },
      { stat: "cupWins", goal: 1, text: "Win a Party Cup", coins: 250, icon: "/assets/medal_gold.png" },
      { stat: "packs", goal: 3, text: "Open 3 packs", coins: 200, icon: "/assets/pack_brain.webp" },
      { stat: "rp", goal: 10, text: "Reach the Silver league", coins: 250, icon: "/assets/lg_silver.webp" },
    ],
  },
  {
    name: "Champion",
    chest: { coins: 2000, pack: "mega" },
    missions: [
      { stat: "winsAny", goal: 15, text: "Win 15 races", coins: 300, icon: "/assets/medal_gold.png" },
      { stat: "dist", goal: 25000, text: "Run 25 km in total", coins: 300, icon: "/assets/ui_shoe.webp" },
      { stat: "bestCombo", goal: 20, text: "Reach a 20 combo", coins: 300, icon: "/assets/ui_flame.webp" },
      { stat: "rp", goal: 28, text: "Reach the Gold league", coins: 400, icon: "/assets/lg_gold.webp" },
    ],
  },
  {
    name: "Legend",
    chest: { coins: 5000, medal: "gold", medals: 3 },
    missions: [
      { stat: "winsAny", goal: 50, text: "Win 50 races", coins: 500, icon: "/assets/medal_gold.png" },
      { stat: "bestDist", goal: 3000, text: "Run 3,000 m in one race", coins: 500, icon: "/assets/ui_shoe.webp" },
      { stat: "chars", goal: 12, text: "Collect 12 characters", coins: 500, icon: "/assets/pk_brainz.webp" },
      { stat: "rp", goal: 55, text: "Reach the Platinum league", coins: 600, icon: "/assets/lg_platinum.webp" },
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
  return [c.coins ? `${c.coins.toLocaleString()} coins` : "", c.pack ? (c.pack === "mega" ? "Mega Pack" : "Brain Pack") : "", c.medal ? `${c.medals ?? 1} gold medal${(c.medals ?? 1) > 1 ? "s" : ""}` : ""].filter(Boolean).join(" + ");
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
  questModal.hidden = true;
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
function renderCareer() {
  const st = careerState();
  const box = $("#careerList");
  const out = [];
  CAREER.forEach((ch, ci) => {
    const open = chapterOpen(ci, st);
    const done = ch.missions.filter((_, mi) => st.claimed[`${ci}:${mi}`]).length;
    const finished = Boolean(st.chests[ci]);
    const head = el(
      "div",
      { class: `chapter${open ? "" : " locked"}${finished ? " finished" : ""}` },
      el("span", { class: "ch-num", text: String(ci + 1) }),
      el("span", { class: "ch-name" }, el("b", { text: ch.name }), el("small", { text: finished ? "Complete ✓" : open ? `${done}/${ch.missions.length} missions` : `🔒 Finish chapter ${ci} to unlock` })),
      el("span", { class: "ch-chest" }, el("img", { src: "/assets/ui_chest.webp", alt: "" }), el("small", { text: chestLabel(ch.chest) })),
    );
    out.push(head);
    // finished chapters fold away; locked ones show what's coming (greyed out)
    if (finished) return;
    ch.missions.forEach((m, mi) => {
      const have = careerStat(m.stat);
      const claimed = st.claimed[`${ci}:${mi}`];
      out.push(
        missionRow({
          icon: m.icon,
          tier: `Chapter ${ci + 1}`,
          tierClass: ["easy", "easy", "medium", "medium", "hard", "hard"][ci],
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
    // only show the first locked chapter in full; later ones are just headers
    if (!open) out.splice(out.length - ch.missions.length, ci > 0 && !chapterOpen(ci - 1, st) ? ch.missions.length : 0);
  });
  box.replaceChildren(...out);
}

// first visit of the day: pop the reward open
setTimeout(() => {
  if (!streakState().claimedToday && game.mode === "home" && countryModal.hidden && nameModal.hidden) openStreak();
}, 900);

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
  const shown = game.kind === "survival" || game.kind === "potato";
  box.style.display = shown ? "" : "none";
  if (!shown) return;
  const lost = game.kind === "potato" ? net.view?.players.find((p) => p.id === playerId)?.booms ?? 0 : me.hits;
  const left = Math.max(0, LIVES - lost);
  box.replaceChildren(
    ...Array.from({ length: LIVES }, (_, i) => el("i", { class: i < left ? "" : `lost${pop && i === left ? " pop" : ""}`, text: "❤️" })),
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
  const aims = kind === "banana" || kind === "bowling";
  showPowerToast(kind, me.items.length > 1 || me.power ? "Saved for later" : TOUCH ? "Tap the power-up to use it" : aims ? "E ahead · Q behind · 1-4 picks a lane" : "Press E to use it");
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
    act({ type: "banana", kind, lane: me.lane, d: Math.round((me.d - BANANA_BEHIND_M) * 10) / 10 });
    sfx.lane();
    banner(kind === "glue" ? "🟢 GLUE DROPPED!" : "🎁 TRAP SET!", 800);
    renderPower();
    return;
  }
  if (kind === "swap" || kind === "thunder" || kind === "boxing") {
    const v = net.view;
    const others = (v?.players || []).filter((p) => p.id !== playerId && !p.left && p.outAt == null && p.finish == null);
    const posOf = (p) => remote.map.get(p.id)?.dispD ?? p.d;
    let target = null;
    if (kind === "boxing") {
      target = others.filter((p) => Math.abs(posOf(p) - me.d) < PUNCH_RANGE_M).sort((a, b) => Math.abs(posOf(a) - me.d) + Math.abs(a.lane - me.lane) - (Math.abs(posOf(b) - me.d) + Math.abs(b.lane - me.lane)))[0];
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

/** Party Cup: a slot-machine reel lands on this round's mode during the countdown. */
function spinReveal(round, kind) {
  const kinds = ["survival", "chase", "coinrush", "potato"];
  const reel = $("#spinReel");
  const cards = [];
  const loops = 5;
  for (let i = 0; i < loops; i++) for (const k of kinds) cards.push(k);
  cards.push(kind);
  reel.replaceChildren(...cards.map((k) => el("div", { class: `spin-card ${k}` }, el("b", { text: `${GAME_MODE_INFO[k].icon} ${KIND_LABEL[k]}` }), el("small", { text: KIND_RULE[k] }))));
  $("#spinTitle").textContent = `🏆 Party Cup · Round ${round} of 3`;
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
/** The first time an obstacle type shows up, say what to do just before you reach it. */
const INTRO_HINT = { hurdle: "⬆ JUMP over hurdles", gate: "⬇ SLIDE under gates", crate: "⬅ ➡ CHANGE LANE around crates", roller: "⬆ JUMP the rolling barrel (or dodge it)" };
function introHints() {
  const course = race.course;
  if (!course || !game.introsShown) return;
  for (const row of course.rows) {
    if (row.z < me.d) continue;
    if (row.z > me.d + me.speed * 1.6 + 6) break;
    if (row.intro && !game.introsShown.has(row.intro)) {
      game.introsShown.add(row.intro);
      if (stats.get("races") < 6 || row.intro === "roller") banner(INTRO_HINT[row.intro] ?? "", 1400);
    }
  }
}
function modeTick(prevD, v) {
  if (me.finished || me.out) return;
  introHints();
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
    for (const c of world.coins) if (taken.has(c.i) && !c.got) {
      c.got = true;
      c.obj.visible = false;
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
    const mineBomb = v.bomb?.holder === playerId;
    box.hidden = !mineBomb || me.out;
    box.className = "mode-hud bomb";
    const left = v.bomb ? (v.bomb.until - serverNow()) / 1000 : 0;
    setText(box, left < 3.5 ? `💣 ${Math.max(0, left).toFixed(1)} s · PASS IT!` : "💣 You have the bomb! Bump into someone!");
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
  const aims = held && (me.items[0] === "banana" || me.items[0] === "bowling");
  // bananas and bowling balls: two clear buttons, into the lane you're in
  $("#throwPad").classList.toggle("show", aims && TOUCH);
  if (aims) {
    $("#throwAhead small").textContent = me.items[0] === "bowling" ? "Roll ahead" : "Throw ahead";
    $("#throwBack small").textContent = me.items[0] === "bowling" ? "Roll back" : "Drop behind";
  }
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
$("#powerSlot").addEventListener("click", () => useItem());
for (const [id, dir] of [["#throwAhead", 1], ["#throwBack", -1]]) {
  $(id).addEventListener("click", (e) => {
    e.stopPropagation();
    buzz(15);
    useItem(me.lane, dir);
  });
}

function currentAct() {
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
    for (let i = 0; i < steps; i++) stepMe(dt / steps);
    if (game.mode === "race") sendPos(false);

    const zMe = -me.d;
    if (me.runner) {
      me.runner.group.position.set(laneX(me.x), me.y, zMe);
      if (equipped().trail && me.speed > 2 && !me.out) world.trail(equipped().trail, laneX(me.x), me.y, zMe);
      me.runner.group.visible = !(me.invulnT > 0 && me.stumbleT <= 0 && !me.power && Math.floor(now / 90) % 2 === 0);
      animateRunner(me.runner, currentAct(), me.speed, dt, me.power);
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
      const ra = !isSurvival() && p.finish !== null && r.dispD > TRACK_LEN - 1 ? "cheer" : p.gone && p.act !== "out" ? "idle" : p.act;
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
    // countdown: the camera swings round from in front of your runner to behind them
    const toGo = net.view ? (net.view.startAt - serverNow()) / 1000 : 0;
    if (toGo > 0.4 && game.mode === "race") {
      const k = Math.min(1, (toGo - 0.4) / 3); // 1 → 0 as the gun nears
      const ang = k * Math.PI;
      camPos.set(laneX(fx) + Math.sin(ang) * 5.6, 3.0 - k * 1.2, fz + Math.cos(ang) * 5.6);
    } else {
      camPos.lerp(back ? new THREE.Vector3(tx, 2.5 + fy * 0.6, fz - 4.2) : new THREE.Vector3(tx, 3.0 + fy * 0.75, fz + 5.6), Math.min(1, dt * (me.out ? 3 : back ? 10 : 6)));
    }
    camera.position.copy(camPos);
    if (shake > 0) {
      shake = Math.max(0, shake - dt);
      camera.position.x += (Math.random() - 0.5) * shake * 0.6;
      camera.position.y += (Math.random() - 0.5) * shake * 0.6;
    }
    if (toGo > 0.4 && game.mode === "race") camLook.set(laneX(fx), 1.0, fz - 2);
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
    if (label === "GO!") sfx.go();
    else if (/^[123]$/.test(label)) sfx.beep();
    lastCount = label;
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
    setText(hudEl.dist, `${Math.round(Math.min(me.d, game.len))} m${entries.length > 1 ? ` · ${alive} still running` : ""}`);
  } else {
    entries.sort((a, b) => {
      if (a.finish !== null && b.finish !== null) return a.finish - b.finish;
      if (a.finish !== null) return -1;
      if (b.finish !== null) return 1;
      return b.d - a.d;
    });
  }
  const place = entries.findIndex((e) => e.id === playerId) + 1 || 1;
  setHTML(hudEl.place, `${place}<sup>${ordinal(place)}</sup>`);

  if (!isSurvival()) {
    for (const dot of hudEl.dots.children) {
      const id = dot.getAttribute("data-id");
      const e = entries.find((x) => x.id === id);
      const d = e ? e.d : 0;
      const left = `${(clamp(d / TRACK_LEN, 0, 1) * 100).toFixed(1)}%`;
      if (dot.style.left !== left) dot.style.left = left;
      dot.style.display = e ? "" : "none";
    }
  }
}

// ── boot ────────────────────────────────────────────────────────────────────

const createBtn = $("#createBtn");
const joinBtn = $("#joinBtn");
const soloBtn = $("#soloBtn");
createBtn.disabled = joinBtn.disabled = soloBtn.disabled = true;
world
  .load((f) => ($("#loadHint").textContent = `Loading 3D runners… ${Math.round(f * 100)}%`))
  .then(() => {
    $("#loadHint").textContent = "";
    createBtn.disabled = joinBtn.disabled = soloBtn.disabled = false;
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
  window.__laneRush = { me, hit, grabBox, useItem, game, net, remote, world };
}

requestAnimationFrame(frame);
