/**
 * LANE RUSH — browser client.
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
} from "/logic.js";

// ── constants ───────────────────────────────────────────────────────────────

const RUNNERS = [
  { name: "Rex", color: "#ef4a3c", file: "c0" },
  { name: "Bolt", color: "#2f7df6", file: "c1b", pic: "p1b" },
  { name: "Ivy", color: "#2fbf55", file: "c2" },
  { name: "Gizmo", color: "#f5b921", file: "c3" },
  // shop skins
  { name: "Pip", color: "#e0703a", file: "c4", price: { medal: "bronze", count: 6 } },
  { name: "Kiko", color: "#7c4dff", file: "c5", price: { medal: "silver", count: 4 } },
  { name: "Dino", color: "#14b8a6", file: "c6", price: { medal: "gold", count: 3 } },
  { name: "Nova", color: "#8fa3bf", file: "c7", price: { medal: "gold", count: 6 } },
];
const STARTERS = 4;
const MEDAL_IMG = { gold: "/assets/medal_gold.png", silver: "/assets/medal_silver.png", bronze: "/assets/medal_bronze.png" };
const medalText = (medal, n) => `${n} ${medal} medal${n === 1 ? "" : "s"}`;
const flagOf = (code) => (code && code.length === 2 ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0))) : "");
const withFlag = (name, code) => (code ? `${flagOf(code)} ${name}` : name);
const LANE_W = 2.0; // metres between lane centres
const CHAR_H = 1.55; // runner height in metres
const JUMP_V = 8.6;
const GRAVITY = 26;
const SLIDE_S = 0.75;
const STUMBLE_S = 0.8;
const INVULN_S = 1.4;
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
      return Array.isArray(a) ? a.filter((i) => Number.isInteger(i)) : [];
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
  buy(i) {
    const price = RUNNERS[i]?.price;
    const spend = price && !this.owns(i) ? this.plan(price) : null;
    if (!spend) return false;
    const m = this.medals();
    for (const k of MEDALS) m[k] -= spend[k];
    local.setItem("lr:owned", JSON.stringify([...this.owned(), i]));
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
    lane: () => tone(660, 0.06, "triangle", 0.06),
    finish: () => {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, "square", 0.1), i * 110));
    },
  };
})();

// ── UI helpers ──────────────────────────────────────────────────────────────

const screens = { home: $("#home"), lobby: $("#lobby"), results: $("#results"), shop: $("#shop") };
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

function portrait(i) {
  return `/assets/${RUNNERS[i]?.pic ?? `p${i}`}.png`;
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
for (let i = 0; i < 4; i++) $("#homeRoster").append(el("img", { src: portrait(i), alt: RUNNERS[i].name }));

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

// country pickers (home + lobby)
for (const sel of document.querySelectorAll(".countrySel")) {
  sel.append(el("option", { value: "", text: "🌍 No country" }));
  for (const [code, name] of COUNTRIES) sel.append(el("option", { value: code, text: `${flagOf(code)} ${name}` }));
  sel.value = myCountry();
  sel.addEventListener("change", () => {
    local.setItem("lr:country", sel.value);
    for (const other of document.querySelectorAll(".countrySel")) other.value = sel.value;
    if (net.view?.joined) act({ type: "country", country: sel.value });
  });
}

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
  RUNNERS.forEach((r, i) => {
    if (i < STARTERS) return;
    const owned = wallet.owns(i);
    const spend = owned ? null : wallet.plan(r.price);
    const btn = el("button", { class: `btn ${owned ? "blue" : "go"}`, type: "button" });
    btn.textContent = owned ? "Owned ✓" : spend ? "Buy" : "Not enough medals";
    btn.disabled = owned || !spend;
    btn.addEventListener("click", () => {
      if (wallet.buy(i)) {
        sfx.finish();
        toast(`${r.name} unlocked! Pick them in the lobby.`);
        local.setItem("lr:char", String(i));
        if (net.view?.joined && net.view.phase === "lobby") act({ type: "pick", char: i });
        renderShop();
      }
    });
    const price = el("div", { class: "price" }, el("img", { src: MEDAL_IMG[r.price.medal], alt: "" }), el("span", { text: medalText(r.price.medal, r.price.count) }));
    const paysWith = spend && (spend.gold || spend.silver || (spend.bronze && r.price.medal !== "bronze"))
      ? MEDALS.filter((k) => spend[k]).map((k) => medalText(k, spend[k])).join(" + ")
      : "";
    const note = el("small", { class: "pays", text: owned ? "" : paysWith && paysWith !== medalText(r.price.medal, r.price.count) ? `Pays with ${paysWith}` : "" });
    grid.append(el("div", { class: `skin${owned ? " owned" : ""}` }, el("img", { class: "pic", src: portrait(i), alt: "" }), el("b", { text: r.name, style: `color:${r.color}` }), price, note, btn));
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
  if (["not racing", "race not over", "already started"].includes(error)) return; // harmless races
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

  if (v.phase === "lobby") {
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

$("#createBtn").addEventListener("click", () => {
  sfx.unlock();
  if (!requireName()) return;
  connect(newCode(), true);
});
$("#joinBtn").addEventListener("click", () => {
  sfx.unlock();
  if (!requireName()) return;
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
  const slots = $("#slots");
  slots.replaceChildren();
  for (let i = 0; i < 4; i++) {
    const p = v.players[i];
    if (!p) {
      slots.append(el("div", { class: "slot empty" }, el("span", { class: "nm", text: "Waiting…" })));
      continue;
    }
    const s = el(
      "div",
      { class: `slot${p.gone ? " gone" : ""}`, style: `background:${RUNNERS[p.char].color}33` },
      el("img", { src: portrait(p.char), alt: "" }),
      el("span", { class: "nm", text: withFlag(p.name, p.country) }),
    );
    if (p.id === v.host) s.append(el("span", { class: "crown", text: "👑" }));
    if (p.id === playerId) s.append(el("span", { class: "you", text: "YOU" }));
    slots.append(s);
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
      { class: `card${mine ? " mine" : ""}${owner && !mine ? " taken" : ""}${locked ? " locked" : ""}`, type: "button" },
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
    local.setItem("lr:char", String(me.char));
    // a runner you don't own (e.g. assigned when yours was taken) is swapped for a free starter
    if (!wallet.owns(me.char)) {
      const free = [0, 1, 2, 3].find((c) => !v.players.some((p) => p.char === c));
      if (free !== undefined) act({ type: "pick", char: free });
    }
    if ((me.country || "") !== myCountry()) act({ type: "country", country: myCountry() });
  }

  const isHost = v.host === playerId;
  const n = v.players.filter((p) => !p.gone).length;
  $("#startBtn").style.display = isHost ? "" : "none";
  $("#waitHost").style.display = isHost ? "none" : "block";
  $("#startBtn").textContent = n >= 2 ? `Start race (${n}/4)` : "Start solo practice";
  $("#lobbyMsg").textContent = isHost && n < 2 ? "Share the code — friends can join until you press start." : "";
  world.setShowcase(me?.char ?? 0);
  if (world.ready) for (const p of v.players) world.ensureChar(p.char).catch(() => {});
  renderWallet();
}

$("#startBtn").addEventListener("click", () => {
  sfx.unlock();
  act({ type: "start" });
});
$("#leaveBtn").addEventListener("click", leaveLobby);
$("#leave2Btn").addEventListener("click", leaveLobby);
$("#againBtn").addEventListener("click", () => act({ type: "again" }));
$("#copyBtn").addEventListener("click", async () => {
  const url = `${location.origin}/?join=${net.code}`;
  const text = `Race me in Lane Rush! Code ${net.code} → ${url}`;
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title: "Lane Rush", text, url });
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
    const detail = p.left
      ? "left the race"
      : p.finish !== null
        ? `${p.hits} bump${p.hits === 1 ? "" : "s"}`
        : `${Math.round(p.d)} m of ${TRACK_LEN} m`;
    const earn = rw?.medal
      ? el("span", { class: "earn" }, el("img", { src: MEDAL_IMG[rw.medal], alt: `${rw.medal} medal` }))
      : el("span", { class: "earn", text: "" });
    list.append(
      el(
        "li",
        { class: p.id === playerId ? "me" : "" },
        el("span", { class: `pl p${Math.min(i + 1, 4)}`, text: PLACE[i] ?? `${i + 1}th` }),
        el("img", { src: portrait(p.char), alt: "" }),
        el("span", { class: "who", text: withFlag(p.name, p.country) + (p.id === playerId ? " (you)" : "") }, el("small", { text: detail })),
        el("span", { class: "tm", text: p.finish !== null ? fmtTime(p.finish) : "DNF" }),
        earn,
      ),
    );
  });

  // your place, and your coins (paid once per race)
  const myPlace = v.standings.indexOf(playerId) + 1;
  const mine = rewards[playerId];
  $("#resPlace").innerHTML = myPlace ? `${myPlace}<sup>${ordinal(myPlace)}</sup>` : "–";
  $("#resTitle").textContent = myPlace === 1 ? "You win!" : myPlace ? `You finished ${PLACE[myPlace - 1] ?? myPlace}` : "Race results";
  const reward = $("#resReward");
  reward.replaceChildren();
  if (mine?.medal) {
    const fresh = wallet.claim(`${v.startAt}:${playerId}`, mine.medal);
    reward.append(el("img", { src: MEDAL_IMG[mine.medal], alt: "" }), el("span", { text: `+1 ${mine.medal} medal` }));
    if (fresh) sfx.boost();
  } else if (myPlace) {
    reward.append(el("span", {
      class: "nomedal",
      text: v.standings.length < MIN_RACERS_FOR_MEDALS ? "Medals are won in races with 2 or more players" : "No medal this time. Top 3 win medals!",
    }));
  }
  renderWallet();

  const isHost = v.host === playerId;
  $("#againBtn").style.display = isHost ? "" : "none";
  $("#waitHost2").style.display = isHost ? "none" : "block";
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
  const grassTex = texLoader.load("/assets/grass.jpg");
  grassTex.colorSpace = THREE.SRGBColorSpace;
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.anisotropy = 4;
  const GROUND_LEN = TRACK_LEN + 900;
  grassTex.repeat.set(700 / 6, GROUND_LEN / 6);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, GROUND_LEN), new THREE.MeshLambertMaterial({ map: grassTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, MEADOW_Y, -TRACK_LEN / 2);
  scene.add(ground);

  // flat stand-in for the track until the 3D tiles are loaded
  const TRACK_W = LANES * LANE_W + 1.6;
  const trackTex = texLoader.load("/assets/grass.jpg");
  trackTex.colorSpace = THREE.SRGBColorSpace;
  trackTex.wrapS = trackTex.wrapT = THREE.RepeatWrapping;
  trackTex.repeat.set(TRACK_W / 3, GROUND_LEN / 3);
  const flatTrack = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_W, GROUND_LEN), new THREE.MeshLambertMaterial({ map: trackTex, color: "#d9ffb8" }));
  flatTrack.rotation.x = -Math.PI / 2;
  flatTrack.position.set(0, 0, -TRACK_LEN / 2);
  scene.add(flatTrack);

  const chalk = new THREE.MeshBasicMaterial({ color: "#ffffff", fog: true });
  for (let i = 0; i <= LANES; i++) {
    const w = i === 0 || i === LANES ? 0.16 : 0.09;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(w, TRACK_LEN + 200), chalk);
    line.rotation.x = -Math.PI / 2;
    line.position.set((i - LANES / 2) * LANE_W, 0.06, -TRACK_LEN / 2 - 40);
    scene.add(line);
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
    scene.add(m);
  }
  stripe(0, false);
  stripe(TRACK_LEN, true);

  // finish arch: two striped posts and a banner
  {
    const arch = new THREE.Group();
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
    scene.add(arch);
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

  async function loadChar(i) {
    const gltf = await loadGLB(`/assets/${RUNNERS[i].file}.glb`);
    const clips = {};
    for (const c of gltf.animations) {
      const n = c.name.toLowerCase();
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
      loadGLB("/assets/hurdle.glb").then((g) => (assets.props.hurdle = fitProp(g.scene, { width: 1.75, maxHeight: 0.75 }))),
      loadGLB("/assets/gate.glb").then((g) => (assets.props.gate = fitProp(g.scene, { width: 1.9, maxHeight: 2.15 }))),
      loadGLB("/assets/crate.glb").then((g) => (assets.props.crate = fitProp(g.scene, { width: 1.55 }))),
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
    let current = null;
    const r = {
      group: g,
      pivot,
      mixer,
      play(name, fade = 0.15, timeScale = 1) {
        const next = actions[name] || actions.run || Object.values(actions)[0];
        if (!next) return;
        if (current === next) {
          next.timeScale = timeScale;
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

  function nameTag(text, color) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 72;
    const g = c.getContext("2d");
    g.font = "900 38px Nunito, 'Arial Rounded MT Bold', sans-serif";
    const w = Math.min(240, g.measureText(text).width + 36);
    g.fillStyle = color;
    g.strokeStyle = "#23314d";
    g.lineWidth = 6;
    const x = (256 - w) / 2;
    g.beginPath();
    g.roundRect ? g.roundRect(x, 8, w, 54, 18) : g.rect(x, 8, w, 54);
    g.fill();
    g.stroke();
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 128, 37, 220);
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
  let scenery = null;

  const clouds = new THREE.Group();
  scene.add(clouds);

  function buildScenery() {
    if (scenery || !assets.props.ground) return;
    scenery = new THREE.Group();
    let s = 12345;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const P = assets.props;
    const add = (proto, x, y, z, scale, rotY) => {
      const o = proto.clone();
      o.scale.multiplyScalar(scale);
      o.rotation.y = rotY;
      o.position.set(x, y, -z);
      scenery.add(o);
      cullables.push({ obj: o, z, keep: true, wide: true });
      return o;
    };

    // raised turf track made of 3D ground tiles
    const step = P.ground.userData.length * 0.97;
    for (let z = -60; z < TRACK_LEN + 160; z += step) add(P.ground, 0, 0, z, 1, 0);
    flatTrack.visible = false;

    // picket fences along both edges
    for (let z = -40; z < TRACK_LEN + 120; z += 2.9) {
      for (const side of [-1, 1]) add(P.fence, side * (TRACK_W / 2 - 0.1), 0, z, 1, Math.PI / 2);
    }

    // trees, bushes and rocks on the meadow
    const trees = [P.oak, P.pine, P.blossom];
    for (let z = -60; z < TRACK_LEN + 160; z += 5 + r() * 5) {
      for (const side of [-1, 1]) {
        const roll = r();
        const x = side * (TRACK_W / 2 + 2.5 + r() * 26);
        if (roll < 0.55) add(trees[Math.floor(r() * 3)], x, MEADOW_Y, z, 0.8 + r() * 0.5, r() * Math.PI * 2);
        else if (roll < 0.85) add(P.bush, side * (TRACK_W / 2 + 1.6 + r() * 10), MEADOW_Y, z, 0.7 + r() * 0.6, r() * Math.PI * 2);
        // a bush hugging the fence every few metres keeps the meadow edge lively
        if (r() < 0.45) add(P.bush, side * (TRACK_W / 2 + 1.0 + r() * 1.5), MEADOW_Y, z + r() * 4, 0.5 + r() * 0.4, r() * Math.PI * 2);
        else add(P.rocks, side * (TRACK_W / 2 + 2 + r() * 14), MEADOW_Y, z, 0.6 + r() * 0.8, r() * Math.PI * 2);
      }
    }
    scene.add(scenery);

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

  function tick(camZ, dt) {
    skyGroup.position.z = camZ;
    clouds.position.z = camZ;
    for (const c of clouds.children) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 170) c.position.x = -170;
    }
  }

  function buildCourseObjects(seed) {
    clearCourse();
    const course = buildCourse(seed);
    for (const row of course.rows) {
      row.lanes.forEach((kind, lane) => {
        if (!kind) return;
        const proto = assets.props[kind];
        const o = proto.clone();
        o.position.set(laneX(lane), 0, -row.z);
        if (kind === "crate") o.rotation.y = ((row.z * 7 + lane) % 3 - 1) * 0.12;
        raceGroup.add(o);
        cullables.push({ obj: o, z: row.z });
      });
    }
    for (const b of course.boosts) {
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 2.6),
        new THREE.MeshBasicMaterial({ map: padTex, transparent: true, opacity: 0.95 }),
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(laneX(b.lane), 0.075, -b.z);
      raceGroup.add(pad);
      cullables.push({ obj: pad, z: b.z });
    }
    return course;
  }

  function clearCourse() {
    for (const c of raceGroup.children.slice()) raceGroup.remove(c);
    cullables = cullables.filter((c) => c.keep);
  }

  function cull(d) {
    for (const c of cullables) c.obj.visible = c.z > d - VIEW_BEHIND && c.z < d + VIEW_AHEAD + (c.wide ? 60 : 0);
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
    cull,
    tick,
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

const game = { mode: "home", round: -1 };

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
  speed: 0,
  hits: 0,
  finished: false,
  act: "idle",
  runner: null,
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
      if (dt > 0.02) r.vel = clamp((p.d - r.lastD) / dt, 0, BOOST_SPEED + 2);
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
  if (world.ready && !world.hasChars(needed)) for (const c of needed) world.ensureChar(c).catch(() => {});
  if (!world.ready || !world.hasChars(needed)) {
    // assets still loading — try again on the next state message / frame
    game.pendingRace = true;
    showScreen("race");
    $("#countdown").textContent = "Loading…";
    return;
  }
  game.pendingRace = false;
  game.mode = "race";
  game.round = v.round;
  world.hideShowcase();
  world.buildScenery();
  remote.clear();
  race.course = world.buildCourseObjects(v.seed);
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
    speed: 0,
    hits: mine?.hits ?? 0,
    finished: mine?.finish != null,
    act: "idle",
    lastSent: 0,
    sentAct: "",
  });
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
  const touch = matchMedia("(pointer: coarse)").matches;
  const hint = $("#controlsHint");
  hint.textContent = touch
    ? "Swipe ↑ jump · ↓ slide · ← → switch lane"
    : "↑ / Space jump · ↓ slide · ← → switch lane";
  hint.style.opacity = "1";
  setTimeout(() => (hint.style.opacity = "0"), 6000);
  $("#banner").classList.remove("show");
}

function finishRaceView(v) {
  // brief celebration in 3D, then the results card
  game.mode = "results-pending";
  banner(me.finished ? "FINISHED!" : "TIME UP!");
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
  return game.mode === "race" && v && serverNow() >= v.startAt && !me.finished;
}

function input(kind) {
  if (!canControl()) return;
  if (kind === "left" || kind === "right") {
    const next = clamp(me.lane + (kind === "left" ? -1 : 1), 0, LANES - 1);
    if (next !== me.lane) {
      me.lane = next;
      sfx.lane();
    }
  } else if (kind === "jump") {
    if (me.y <= 0.001 && me.stumbleT <= 0) {
      me.vy = JUMP_V;
      me.y = 0.001;
      me.slideT = 0;
      sfx.jump();
    }
  } else if (kind === "slide") {
    if (me.y > 0.001) {
      me.vy = Math.min(me.vy, -16); // fast-fall, then slide on landing
      me.slideT = SLIDE_S;
    } else if (me.stumbleT <= 0) {
      me.slideT = SLIDE_S;
      sfx.slide();
    }
  }
}

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key;
  if (k === "ArrowLeft" || k === "a" || k === "A") input("left");
  else if (k === "ArrowRight" || k === "d" || k === "D") input("right");
  else if (k === "ArrowUp" || k === "w" || k === "W" || k === " ") input("jump");
  else if (k === "ArrowDown" || k === "s" || k === "S") input("slide");
  else return;
  e.preventDefault();
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

  // vertical
  if (me.y > 0 || me.vy > 0) {
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

  if (!running) {
    me.speed = 0;
    return;
  }

  // speed
  let target = me.boostT > 0 ? BOOST_SPEED : BASE_SPEED;
  if (me.stumbleT > 0) target = 3.5;
  if (me.finished) target = me.d > TRACK_LEN + 14 ? 0 : 6;
  const accel = me.stumbleT > 0 ? 40 : 14;
  me.speed += clamp(target - me.speed, -accel * dt, accel * dt);
  const prevD = me.d;
  me.d += me.speed * dt;

  if (!me.finished && me.d >= TRACK_LEN) {
    me.finished = true;
    sfx.finish();
    banner("FINISH!", 1800);
    sendPos(true);
  }
  if (me.finished) return;

  // collisions (swept over this step's distance)
  const course = race.course;
  if (!course) return;
  for (const row of course.rows) {
    if (row.z < prevD - 0.6 || row.z > me.d + 0.6) continue;
    for (let lane = 0; lane < LANES; lane++) {
      const kind = row.lanes[lane];
      if (!kind) continue;
      const half = kind === "crate" ? 0.58 : 0.62;
      if (Math.abs(me.x - lane) > half) continue;
      const clear =
        (kind === "hurdle" && me.y > 0.62) || (kind === "gate" && me.slideT > 0);
      if (!clear) hit(kind);
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
  if (me.invulnT > 0) return;
  me.hits += 1;
  me.stumbleT = STUMBLE_S;
  me.invulnT = INVULN_S;
  me.boostT = 0;
  me.slideT = 0;
  shake = 0.35;
  sfx.hit();
  if (navigator.vibrate) navigator.vibrate(60);
  const hintText = kind === "hurdle" ? "Jump! ↑" : kind === "gate" ? "Slide! ↓" : "Dodge! ← →";
  banner(hintText, 800);
}

function currentAct() {
  if (net.view && serverNow() < net.view.startAt) return "idle";
  if (me.finished && me.speed < 0.5) return "cheer";
  if (me.stumbleT > 0) return "stumble";
  if (me.y > 0) return "jump";
  if (me.slideT > 0) return "slide";
  return "run";
}

function sendPos(force = false) {
  const now = performance.now();
  const a = currentAct();
  if (!force && now - me.lastSent < SEND_MS && a === me.sentAct) return;
  me.lastSent = now;
  me.sentAct = a;
  act({
    type: "pos",
    d: Math.round(Math.min(me.d, TRACK_LEN) * 100) / 100,
    lane: me.lane,
    y: Math.round(me.y * 100) / 100,
    act: a,
    hits: me.hits,
  });
}

function animateRunner(r, a, speed, dt) {
  if (!r) return;
  if (a === "jump") r.play("jump", 0.08, (r.clipDuration("jump") / 0.75) * 0.9);
  else if (a === "slide") r.play("slide", 0.08, r.clipDuration("slide") / SLIDE_S);
  else if (a === "cheer") r.play("cheer", 0.25);
  else if (a === "idle") r.play("idle", 0.25);
  else r.play("run", 0.12, clamp(speed / BASE_SPEED, 0.45, 1.45));
  // stumble: a quick wobble on top of whatever is playing
  r.pivot.rotation.z = a === "stumble" ? Math.sin(performance.now() / 45) * 0.35 : 0;
  r.pivot.rotation.x = a === "stumble" ? 0.25 : 0;
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

  if (game.pendingRace && world.ready && net.view && (net.view.phase === "countdown" || net.view.phase === "race") && world.hasChars(net.view.players.map((p) => p.char))) {
    enterRace(net.view);
  }

  if (game.mode === "race" || game.mode === "results-pending") {
    // substeps keep fast runners from tunnelling through thin obstacles
    const steps = Math.ceil(dt / (1 / 120));
    for (let i = 0; i < steps; i++) stepMe(dt / steps);
    if (game.mode === "race") sendPos(false);

    const zMe = -me.d;
    if (me.runner) {
      me.runner.group.position.set(laneX(me.x), me.y, zMe);
      me.runner.group.visible = !(me.invulnT > 0 && me.stumbleT <= 0 && Math.floor(now / 90) % 2 === 0);
      animateRunner(me.runner, currentAct(), me.speed, dt);
    }

    for (const r of remote.map.values()) {
      if (!r.runner) continue;
      const p = r.p;
      const age = (performance.now() - r.lastAt) / 1000;
      const target = Math.min(TRACK_LEN, r.lastD + r.vel * Math.min(age, 0.5));
      r.dispD += (target - r.dispD) * Math.min(1, dt * 8);
      r.dispX += (laneX(p.lane) - r.dispX) * Math.min(1, dt * 12);
      r.dispY += (p.y - r.dispY) * Math.min(1, dt * 18);
      r.runner.group.position.set(r.dispX, r.dispY, -r.dispD);
      r.runner.group.visible = !p.left;
      const ra = p.finish !== null && r.dispD > TRACK_LEN - 1 ? "cheer" : p.gone ? "idle" : p.act;
      animateRunner(r.runner, ra, r.vel || BASE_SPEED, dt);
    }

    // camera: behind and above the player, looking down the track
    const tx = laneX(me.x) * 0.75;
    camPos.lerp(new THREE.Vector3(tx, 3.0 + me.y * 0.35, zMe + 5.6), Math.min(1, dt * 6));
    camera.position.copy(camPos);
    if (shake > 0) {
      shake = Math.max(0, shake - dt);
      camera.position.x += (Math.random() - 0.5) * shake * 0.6;
      camera.position.y += (Math.random() - 0.5) * shake * 0.6;
    }
    camLook.set(tx * 0.8, 1.0, zMe - 9);
    camera.lookAt(camLook);
    world.cull(me.d);
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
      if (p.id === playerId) return { id: p.id, d: Math.min(me.d, TRACK_LEN), finish: p.finish ?? (me.finished ? 1e9 - 1 : null) };
      const r = remote.map.get(p.id);
      return { id: p.id, d: r ? r.dispD : p.d, finish: p.finish };
    });
  entries.sort((a, b) => {
    if (a.finish !== null && b.finish !== null) return a.finish - b.finish;
    if (a.finish !== null) return -1;
    if (b.finish !== null) return 1;
    return b.d - a.d;
  });
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
createBtn.disabled = joinBtn.disabled = true;
world
  .load((f) => ($("#loadHint").textContent = `Loading 3D runners… ${Math.round(f * 100)}%`))
  .then(() => {
    $("#loadHint").textContent = "";
    createBtn.disabled = joinBtn.disabled = false;
    world.buildScenery();
    world.setShowcase(preferredChar());
    if (net.view?.phase === "lobby") renderLobby(net.view);
  })
  .catch((err) => {
    console.error(err);
    $("#loadHint").textContent = "Couldn't load the 3D models — check your connection and reload.";
  });

requestAnimationFrame(frame);
