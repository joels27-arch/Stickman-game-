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
  CUP_RACES,
  CUP_POINTS,
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
const COLLECTION = [
  { id: "luna", name: "Luna", color: "#9b5cff", price: { medal: "bronze", count: 5 } },
  { id: "toto", name: "Toto", color: "#f2f2f2", price: { medal: "bronze", count: 8 } },
  { id: "blaze", name: "Blaze", color: "#ff4b2b", price: { medal: "silver", count: 3 } },
  { id: "zara", name: "Zara", color: "#ff6fb5", price: { medal: "silver", count: 4 } },
  { id: "jax", name: "Jax", color: "#c98a3c", price: { medal: "silver", count: 6 } },
  { id: "leo", name: "Sir Leo", color: "#4c8dff", price: { medal: "gold", count: 2 } },
  { id: "kai", name: "Kai", color: "#21c7d9", price: { medal: "gold", count: 3 } },
  { id: "momo", name: "Momo", color: "#e9ecef", price: { medal: "gold", count: 4 } },
  { id: "zed", name: "Zed", color: "#7be3b0", price: { medal: "gold", count: 5 } },
  { id: "aria", name: "Aria", color: "#e03cff", price: { medal: "gold", count: 8 } },
];
const MEDAL_IMG = { gold: "/assets/medal_gold.png", silver: "/assets/medal_silver.png", bronze: "/assets/medal_bronze.png" };
const medalText = (medal, n) => `${n} ${medal} medal${n === 1 ? "" : "s"}`;
const flagOf = (code) => (code && code.length === 2 ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0))) : "");
const withFlag = (name, code) => (code ? `${flagOf(code)} ${name}` : name);
const countryName = (code) => (COUNTRIES.find(([c]) => c === code) || [])[1] || "";
const MODES = ["Solo", "Duo", "Trio", "Squad"];
const GAME_MODE_INFO = {
  survival: { label: "Survival", icon: "❤️", tag: "Main mode", text: "3 hearts each. Last runner standing wins. Alone it's an endless run." },
  sprint: { label: "Sprint", icon: "🏁", tag: "1 minute", text: "700 m to the finish line. Fastest time wins." },
  tournament: { label: "Tournament", icon: "🏆", tag: "3 races", text: `Survival, Sprint, Survival. ${CUP_POINTS.slice(0, 3).join(" / ")} points per place. Most points wins.` },
};
const KIND_LABEL = { survival: "Survival", sprint: "Sprint" };
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
};
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
    local.setItem("lr:medals", JSON.stringify(m));
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
  for (const box of document.querySelectorAll(".wallet")) {
    box.replaceChildren(...MEDALS.map((k) => {
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

const sfx = (() => {
  let ctx = null;
  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  function tone(freq, dur, type = "square", vol = 0.12, slide = 0) {
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
  return {
    unlock: ensure,
    beep: () => tone(520, 0.18, "square", 0.1),
    go: () => tone(880, 0.4, "square", 0.12),
    jump: () => tone(300, 0.2, "triangle", 0.15, 500),
    slide: () => tone(240, 0.22, "sawtooth", 0.05, -120),
    hit: () => tone(140, 0.35, "sawtooth", 0.18, -90),
    boost: () => tone(400, 0.35, "triangle", 0.14, 900),
    pickup: () => {
      [660, 880, 1175].forEach((f, i) => setTimeout(() => tone(f, 0.12, "triangle", 0.1), i * 60));
    },
    zap: () => {
      tone(1400, 0.4, "sawtooth", 0.12, -1300);
      setTimeout(() => tone(90, 0.5, "square", 0.12, -40), 80);
    },
    pop: () => tone(900, 0.18, "sine", 0.16, -700),
    rocket: () => tone(120, 1.2, "sawtooth", 0.08, 500),
    roll: () => tone(70, 0.6, "triangle", 0.1, 20),
    lane: () => tone(660, 0.06, "triangle", 0.06),
    finish: () => {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, "square", 0.1), i * 110));
    },
  };
})();

// ── UI helpers ──────────────────────────────────────────────────────────────

const screens = { home: $("#home"), lobby: $("#lobby"), lineup: $("#lineup"), results: $("#results"), shop: $("#shop") };
function showScreen(name) {
  for (const [k, el] of Object.entries(screens)) el.classList.toggle("show", k === name);
  $("#hud").classList.toggle("show", name === "race");
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
const joinParam = new URLSearchParams(location.search).get("join");
if (joinParam) codeInput.value = joinParam.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
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
$("#settingsBtn").addEventListener("click", () => openCountry("Settings · your country"));
renderCountryChips();

// ── shop ───────────────────────────────────────────────────────────────────
let shopReturn = "home";
function openShop() {
  shopReturn = game.mode === "lobby" ? "lobby" : game.mode === "results" ? "results" : "home";
  renderShop();
  showScreen("shop");
}
function renderShop() {
  const grid = $("#shopGrid");
  grid.replaceChildren();
  COLLECTION.forEach((r) => {
    const owned = wallet.has(r.id);
    const spend = owned ? null : wallet.plan(r.price);
    const btn = el("button", { class: `btn ${owned ? "blue" : "go"}`, type: "button" });
    btn.textContent = owned ? "Owned ✓" : spend ? "Buy" : "Not enough medals";
    btn.disabled = owned || !spend;
    btn.addEventListener("click", () => {
      if (wallet.buy(r)) {
        sfx.finish();
        toast(`${r.name} is in your collection! Racing with them is coming soon.`);
        renderShop();
      }
    });
    const price = el("div", { class: "price" }, el("img", { src: MEDAL_IMG[r.price.medal], alt: "" }), el("span", { text: medalText(r.price.medal, r.price.count) }));
    const paysWith = spend && (spend.gold || spend.silver || (spend.bronze && r.price.medal !== "bronze"))
      ? MEDALS.filter((k) => spend[k]).map((k) => medalText(k, spend[k])).join(" + ")
      : "";
    const note = el("small", { class: "pays", text: owned ? "" : paysWith && paysWith !== medalText(r.price.medal, r.price.count) ? `Pays with ${paysWith}` : "" });
    grid.append(
      el(
        "div",
        { class: `skin${owned ? " owned" : ""}` },
        el("span", { class: "soon", text: "Coming soon" }),
        el("img", { class: "pic", src: `/assets/sc_${r.id}.webp`, alt: "" }),
        el("b", { text: r.name, style: `color:${r.color}` }),
        price,
        note,
        btn,
      ),
    );
  });
  renderWallet();
}
for (const b of document.querySelectorAll(".shopBtn")) b.addEventListener("click", openShop);
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

  if (v.phase === "lobby") {
    if (game.solo && v.host === playerId) {
      // solo: skip the lobby and go straight into the run
      if (!game.soloStarting) {
        game.soloStarting = true;
        if (v.mode !== "survival") act({ type: "mode", mode: "survival" });
        act({ type: "start" });
      }
      return;
    }
    if (game.mode !== "lobby") enterLobby();
    renderLobby(v);
  } else if (v.phase === "countdown" || v.phase === "race") {
    if (game.mode !== "race" || game.round !== v.round) enterRace(v);
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
  if (!n) {
    $("#homeMsg").textContent = "Type your name first";
    nameInput.focus();
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
  $("#soloGo").replaceChildren(el("span", { class: "flagico", text: "❤️" }), el("span", { text: `Run as ${RUNNERS[cur].name}` }), el("span", { class: "arrow", text: "→" }));
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
  connect(newCode(), true);
});
$("#joinBtn").addEventListener("click", () => {
  sfx.unlock();
  if (!requireName()) return;
  game.solo = false;
  const code = codeInput.value.trim().toUpperCase();
  if (code.length !== 4) {
    $("#homeMsg").textContent = "Lobby codes have 4 characters";
    codeInput.focus();
    return;
  }
  connect(code, false);
});
codeInput.addEventListener("keydown", (e) => e.key === "Enter" && $("#joinBtn").click());
nameInput.addEventListener("keydown", (e) => e.key === "Enter" && (codeInput.value.length === 4 ? $("#joinBtn") : $("#createBtn")).click());

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
  const modePick = $("#modePick");
  modePick.replaceChildren(
    ...Object.entries(GAME_MODE_INFO).map(([key, info]) => {
      const b = el(
        "button",
        { class: `mode-card${gm === key ? " on" : ""}`, type: "button" },
        el("em", { text: info.tag }),
        el("b", { text: `${info.icon} ${key === "survival" && n < 2 ? "Endless run" : info.label}` }),
        el("span", { text: key === "survival" && n < 2 ? "Alone: 3 hearts, see how far you get. With friends: last one standing." : info.text }),
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
  for (const key of gm === "tournament" ? MAPS : [mp]) world.ensureMap(key).catch(() => {});
  const what = gm === "tournament" ? "tournament" : gm === "survival" && n < 2 ? "endless run" : `${GAME_MODE_INFO[gm].label} race`;
  $("#lockBtn").replaceChildren(el("span", { class: "flagico", text: "✓" }), el("span", { text: `Lock in ${RUNNERS[me?.char ?? 0].name}` }), el("span", { class: "arrow", text: "→" }));
  renderLineup(v, { isHost, gm, mp, mode, what });
  // once you've locked in your runner, the lobby is the line-up
  if (game.mode === "lobby" && !screens.shop.classList.contains("show")) showScreen(game.locked ? "lineup" : "lobby");
  $("#lobbyCount").textContent = `${mode} · ${GAME_MODE_INFO[gm].label} · ${n}/4 players`;
  $("#readyCount").textContent = `👥 ${n}/4 players ready`;
  $("#lobbyMsg").textContent =
    isHost && n < 2 ? "Play alone for practice, or share the code: duo, trio or a full squad of 4. Medals need 2+ players." : "";
  world.setShowcase(me?.char ?? 0);
  if (world.ready) for (const p of v.players) world.ensureChar(p.char).catch(() => {});
  renderWallet();
}

$("#lockBtn").addEventListener("click", () => {
  sfx.unlock();
  game.locked = true;
  act({ type: "ready", ready: true });
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
  if (v.host === playerId) act({ type: "start" });
  else act({ type: "ready", ready: !me?.ready });
});

/**
 * The line-up: every runner on a pedestal (yours in the middle, lit blue)
 * with READY / NOT READY. Guests toggle Ready; the host's button becomes
 * Start once everybody else is ready.
 */
function renderLineup(v, { isHost, gm, mp, mode, what }) {
  $("#luCode").textContent = net.code;
  $("#luMode").textContent = gm === "tournament" ? "Tournament" : gm === "survival" && v.players.length < 2 ? "Endless run" : GAME_MODE_INFO[gm].label;
  $("#luMap").textContent = gm === "tournament" ? "Meadow · Farm · Beach" : `${MAP_INFO[mp].label} · ${mode}`;
  const ch = dailyChallenge();
  $("#luDaily").textContent = `⭐ Daily: ${ch.text}`;
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
        el("span", { class: p.gone ? "no" : ok ? "ok" : "no", text: p.gone ? "Away" : p.id === v.host ? "Host" + (isMe ? " · You" : "") : ok ? "Ready" + (isMe ? " · You" : "") : "Not ready" + (isMe ? " · You" : "") }),
      ),
      el("img", { src: `/assets/full_${RUNNERS[p.char]?.file ?? "c0"}.webp`, alt: RUNNERS[p.char]?.name ?? "" }),
      el("div", { class: "disc" }),
    );
    ped.dataset.id = p.id;
    return ped;
  });
  for (let i = order.length; i < 4; i++) {
    peds.push(el("div", { class: "ped empty" }, el("div", { class: "ghost", text: `Waiting… code ${net.code}` }), el("div", { class: "disc" })));
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
    go.textContent = meP?.ready ? "Not ready" : "Ready ✓";
    go.classList.toggle("waiting", Boolean(meP?.ready));
    status.textContent = meP?.ready ? (waiting.length ? `Waiting for ${waiting.map((p) => p.name).join(", ")}` : "Waiting for the host to start…") : "Press Ready when you're set";
  }
}
$("#leaveBtn").addEventListener("click", leaveLobby);
$("#leave2Btn").addEventListener("click", leaveLobby);
$("#againBtn").addEventListener("click", () => act({ type: "again" }));
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
        el("span", { class: "who", text: withFlag(p.name, p.country) + (p.id === playerId ? " (you)" : "") }, el("small", { text: detail + extra })),
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
      ? "Tournament champion!"
      : `Tournament: ${PLACE[myPlace - 1] ?? myPlace}`
    : solo && v.kind === "survival"
      ? `You ran ${Math.round(v.players[0]?.d ?? 0)} m${Math.round(v.players[0]?.d ?? 0) >= personalBest() ? " · new record!" : ` · best ${personalBest()} m`}`
      : myPlace === 1
        ? "You win!"
        : myPlace
          ? `You finished ${PLACE[myPlace - 1] ?? myPlace}`
          : "Race results";
  renderCup(v);
  const reward = $("#resReward");
  reward.replaceChildren();
  if (mine?.medal) {
    const fresh = wallet.claim(`${v.startAt}:${playerId}`, mine.medal);
    reward.append(el("img", { src: MEDAL_IMG[mine.medal], alt: "" }), el("span", { text: `+1 ${mine.medal} medal` }));
    if (fresh) sfx.boost();
  } else if (cup && !cupDone) {
    reward.append(el("span", { class: "nomedal", text: `+${CUP_POINTS[v.standings.indexOf(playerId)] ?? 0} points · medals are paid after race ${cup.races.length}` }));
  } else if (myPlace) {
    reward.append(el("span", {
      class: "nomedal",
      text: v.standings.length < MIN_RACERS_FOR_MEDALS ? "Medals are won in races with 2 or more players" : "No medal this time. Top 3 win medals!",
    }));
  }
  renderWallet();

  const isHost = v.host === playerId;
  const hasNext = cup && !cupDone;
  $("#nextBtn").style.display = isHost && hasNext ? "" : "none";
  $("#againBtn").style.display = isHost && !hasNext ? "" : "none";
  $("#waitHost2").style.display = isHost ? "none" : "block";
  if (hasNext) {
    $("#nextBtn").replaceChildren(
      el("span", { class: "flagico", text: "🏆" }),
      el("span", { text: `Race ${cup.race + 1}: ${KIND_LABEL[cup.races[cup.race]]}` }),
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
    el("h4", { text: done ? "🏆 Final tournament table" : `🏆 Tournament · after race ${cup.race} of ${cup.races.length}` }),
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
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

  function buildCourseObjects(seed, len) {
    clearCourse();
    const course = buildCourse(seed, len);
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
        const obj = assets.props.banana.clone();
        obj.position.set(laneX(b.lane), 3, -b.d);
        raceGroup.add(obj);
        m = { obj, born: now };
        bananaMeshes.set(b.id, m);
      }
      const age = (now - m.born) / 1000;
      m.obj.position.y = Math.max(0.02, 3 * (1 - (age / 0.45) ** 2));
      m.obj.rotation.y = age < 0.45 ? age * 14 : m.obj.rotation.y;
    }
    for (const [id, m] of bananaMeshes) {
      if (live.has(id)) continue;
      raceGroup.remove(m.obj);
      bananaMeshes.delete(id);
    }
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
      c.obj.visible = z > d - VIEW_BEHIND && z < d + VIEW_AHEAD + (c.wide ? 60 : 0) && !c.box?.taken;
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
const isSurvival = () => game.kind === "survival";

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
  game.soloRun = isSurvival() && v.players.length === 1;
  game.bestBeaten = false;
  game.bananasThrown = 0;
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
  race.course = world.buildCourseObjects(v.seed, game.len);
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
  tag.classList.toggle("show", Boolean(v.cup));
  if (v.cup) tag.textContent = `🏆 Race ${v.cup.race}/${v.cup.races.length} · ${KIND_LABEL[game.kind]} · ${MAP_INFO[map].label}`;
  const touch = matchMedia("(pointer: coarse)").matches;
  const hint = $("#controlsHint");
  hint.textContent = touch
    ? "Swipe ↑ jump · ↓ slide · ← → lane · tap a power-up to use it"
    : "↑ jump · ↓ slide · ← → lane · E use power-up · hold C to look back";
  hint.style.opacity = "1";
  setTimeout(() => (hint.style.opacity = "0"), 6000);
  $("#banner").classList.remove("show");
}

function finishRaceView(v) {
  // brief celebration in 3D, then the results card
  game.mode = "results-pending";
  saveBest();
  banner(isSurvival() ? (me.out ? "GAME OVER" : "LAST ONE STANDING!") : me.finished ? "FINISHED!" : "TIME UP!");
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
    const next = clamp(me.lane + (kind === "left" ? -1 : 1), 0, LANES - 1);
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
    if (!isSurvival() || me.hits <= 0) continue; // full health: leave it
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
    challenge("boxes6", game.boxesGrabbed);
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
  // bananas on the track (yours too!)
  for (const b of net.view?.bananas || []) {
    if (untouchable || slipped.has(b.id)) continue;
    if (b.d < prevD - 0.6 || b.d > me.d + 0.6) continue;
    if (Math.abs(me.x - b.lane) > 0.55 || me.y > 0.5) continue;
    slipped.add(b.id);
    act({ type: "slip", id: b.id });
    hit("banana");
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
  if (isSurvival()) {
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
  sfx.hit();
  if (navigator.vibrate) navigator.vibrate(80);
  const hintText = {
    hurdle: "Jump! ↑",
    gate: "Slide! ↓",
    crate: "Dodge! ← →",
    roller: "Jump the barrel! ↑",
    zap: "ZAPPED! ⚡",
    banana: "Slipped on a banana! 🍌",
    bowling: "STRIKE! 🎳",
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
  challenge("combo12", me.combo);
  const mult = Math.min(5, 1 + Math.floor(me.combo / 4)); // x2 from 4 in a row, up to x5
  const gained = points * mult;
  me.score += gained;
  challenge("style1500", me.score);
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
  for (const z of fresh(v.zaps, seen.zaps)) feed(z.kind === "freeze" ? `❄️ ${nameOf(z.by)} froze everyone` : `⚡ ${nameOf(z.by)} called lightning`);
  for (const b of fresh(v.bowls, seen.bowls)) feed(`🎳 ${nameOf(b.by)} rolled a bowling ball ${b.dir > 0 ? "ahead" : "back"}`);
  for (const b of fresh(v.bananas, seen.bananas)) feed(`🍌 ${nameOf(b.by)} dropped a banana in lane ${b.lane + 1}`);
  for (const h of fresh(v.hits, seen.hits)) {
    const victim = h.victim === playerId ? "You" : nameOf(h.victim);
    const whose = h.by === playerId ? "your" : `${nameOf(h.by)}'s`;
    feed(h.kind === "banana" ? `🍌 ${victim} slipped on ${whose} banana!` : `🎳 ${victim} got bowled over by ${whose} ball!`);
    if (h.by === playerId && h.victim !== playerId && game.mode === "race") style(h.kind === "banana" ? "BANANA HIT!" : "STRIKE!", 50);
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
for (const box of document.querySelectorAll(".emote-row")) {
  for (const e of EMOTES) {
    const b = el("button", { type: "button", class: "emote-btn", text: e });
    b.addEventListener("click", () => sendEmote(e));
    box.append(b);
  }
}
$("#emoteToggle").addEventListener("click", () => $("#emoteMenu").classList.toggle("show"));

// ── daily challenge: one goal per day, a medal for finishing it ──

const CHALLENGES = [
  { id: "dist800", text: "Run 800 m in one endless run", goal: 800, reward: "silver" },
  { id: "bananas3", text: "Throw 3 bananas in one race", goal: 3, reward: "bronze" },
  { id: "combo12", text: "Reach a 12 combo", goal: 12, reward: "silver" },
  { id: "survive90", text: "Survive 90 seconds in Survival", goal: 90, reward: "silver" },
  { id: "style1500", text: "Score 1500 style points in one race", goal: 1500, reward: "gold" },
  { id: "boxes6", text: "Grab 6 mystery boxes in one race", goal: 6, reward: "bronze" },
  { id: "nohit400", text: "Run 400 m without getting hit", goal: 400, reward: "silver" },
];
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function dailyChallenge() {
  const key = todayKey();
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CHALLENGES[h % CHALLENGES.length];
}
function dailyState() {
  try {
    const s = JSON.parse(local.getItem("lr:daily") || "{}");
    return s.day === todayKey() ? s : { day: todayKey(), best: 0, done: false };
  } catch {
    return { day: todayKey(), best: 0, done: false };
  }
}
/** Report progress on today's challenge (only the matching id counts). */
function challenge(id, value) {
  const ch = dailyChallenge();
  if (ch.id !== id) return;
  const st = dailyState();
  if (st.done || value <= st.best) return;
  st.best = value;
  if (value >= ch.goal) {
    st.done = true;
    const m = wallet.medals();
    m[ch.reward] += 1;
    wallet.save(m);
    banner("CHALLENGE DONE!", 1600);
    toast(`Daily challenge complete: +1 ${ch.reward} medal`);
    sfx.finish();
  }
  local.setItem("lr:daily", JSON.stringify(st));
  renderDaily();
}
function renderDaily() {
  const ch = dailyChallenge();
  const st = dailyState();
  const box = $("#daily");
  box.classList.toggle("done", st.done);
  box.replaceChildren(
    el("span", { class: "tag", text: "Daily challenge" }),
    el("b", { text: ch.text }),
    el("small", {}, el("img", { src: MEDAL_IMG[ch.reward], alt: "" }), el("span", { text: st.done ? "Done ✓ come back tomorrow" : `${Math.min(st.best, ch.goal)} / ${ch.goal} · reward: 1 ${ch.reward} medal` })),
  );
}
renderDaily();

// ── personal best (solo endless run) ──

function personalBest() {
  return Number(local.getItem("lr:best")) || 0;
}
function checkBest() {
  if (game.mode === "race" && !me.out && net.view && serverNow() > net.view.startAt) {
    if (game.soloRun) challenge("dist800", Math.floor(me.d));
    challenge("nohit400", Math.floor(me.d - (game.lastHitD ?? 0)));
    if (isSurvival()) challenge("survive90", Math.floor((serverNow() - net.view.startAt) / 1000));
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
  box.style.display = isSurvival() ? "" : "none";
  if (!isSurvival()) return;
  const left = Math.max(0, LIVES - me.hits);
  box.replaceChildren(
    ...Array.from({ length: LIVES }, (_, i) => el("i", { class: i < left ? "" : `lost${pop && i === left ? " pop" : ""}`, text: "❤️" })),
  );
}

/** Third hit in survival: down for good, then watch whoever is still running. */
function knockOut() {
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
  if (navigator.vibrate) navigator.vibrate([80, 60, 120]);
  banner("OUT!", 1600);
  sendPos(true);
  const hint = $("#controlsHint");
  hint.textContent = TOUCH ? "No hearts left · tap ◀ ▶ to watch someone else" : "No hearts left · ← → to watch someone else";
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
  if (kind === "banana") {
    game.bananasThrown = (game.bananasThrown ?? 0) + 1;
    challenge("bananas3", game.bananasThrown);
    const d = dir > 0 ? me.d + BANANA_AHEAD_M : me.d - BANANA_BEHIND_M;
    act({ type: "banana", lane, d: Math.round(d * 10) / 10 });
    sfx.lane();
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
  $("#throwLanes").classList.toggle("show", aims);
  if (aims) $("#throwLanes").dataset.kind = me.items[0];
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
  slot.querySelector(".use").textContent = held ? (TOUCH ? "Tap to use" : aims ? "E ahead · Q behind" : "E to use") : "";
  if (held) slot.querySelector(".bar i").style.width = "100%";
}
$("#powerSlot").addEventListener("click", () => useItem());
for (const b of document.querySelectorAll("#throwLanes button")) {
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    useItem(Number(b.dataset.lane), Number(b.dataset.dir));
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
      me.runner.group.visible = !(me.invulnT > 0 && me.stumbleT <= 0 && !me.power && Math.floor(now / 90) % 2 === 0);
      animateRunner(me.runner, currentAct(), me.speed, dt, me.power);
      if (me.power) $("#powerSlot .bar i").style.width = `${(me.powerT / POWER_S[me.power]) * 100}%`;
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
}

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
  $("#timer").textContent =
    remainingAfterFirst !== null && !me.finished
      ? `⏱${Math.ceil(remainingAfterFirst / 1000)}`
      : (t / 1000).toFixed(1);

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
  if (isSurvival()) {
    // still running first (furthest ahead), then whoever lasted longest
    entries.sort((a, b) => (b.outAt ?? Infinity) - (a.outAt ?? Infinity) || b.d - a.d);
    const alive = entries.filter((e) => e.outAt === null).length;
    $("#distText").textContent = `${Math.round(Math.min(me.d, game.len))} m${entries.length > 1 ? ` · ${alive} still running` : ""}`;
  } else {
    entries.sort((a, b) => {
      if (a.finish !== null && b.finish !== null) return a.finish - b.finish;
      if (a.finish !== null) return -1;
      if (b.finish !== null) return 1;
      return b.d - a.d;
    });
  }
  const place = entries.findIndex((e) => e.id === playerId) + 1 || 1;
  $("#place").innerHTML = `${place}<sup>${ordinal(place)}</sup>`;

  for (const dot of $("#dots").children) {
    const id = dot.getAttribute("data-id");
    const e = entries.find((x) => x.id === id);
    const d = e ? e.d : 0;
    dot.style.left = `${clamp(d / TRACK_LEN, 0, 1) * 100}%`;
    dot.style.display = e ? "" : "none";
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
  window.__laneRush = { me, hit, grabBox, game, net };
}

requestAnimationFrame(frame);
