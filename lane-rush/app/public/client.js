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
} from "/logic.js";

// ── constants ───────────────────────────────────────────────────────────────

const RUNNERS = [
  { name: "Rex", color: "#ef4a3c", file: "c0" },
  { name: "Bolt", color: "#2f7df6", file: "c1" },
  { name: "Ivy", color: "#2fbf55", file: "c2" },
  { name: "Gizmo", color: "#f5b921", file: "c3" },
];
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

const screens = { home: $("#home"), lobby: $("#lobby"), results: $("#results") };
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
  return `/assets/p${i}.png`;
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
    create: net.creating || wasHost,
  });
  net.helloSent = true;
  net.awaitingHello = true;
}

function preferredChar() {
  const v = Number(local.getItem("lr:char"));
  return Number.isInteger(v) && v >= 0 && v < 4 ? v : 0;
}

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
      el("span", { class: "nm", text: p.name }),
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
    const card = el(
      "button",
      { class: `card${mine ? " mine" : ""}${owner && !mine ? " taken" : ""}`, type: "button" },
      el("img", { src: portrait(i), alt: "" }),
      el("b", { text: r.name, style: `color:${r.color}` }),
      el("small", { text: mine ? "You" : owner ? owner.name : "" }),
    );
    card.addEventListener("click", () => {
      if (owner && !mine) return toast(`${r.name} is taken by ${owner.name}`);
      if (!mine) {
        local.setItem("lr:char", String(i));
        act({ type: "pick", char: i });
      }
    });
    picker.append(card);
  });
  if (me) local.setItem("lr:char", String(me.char));

  const isHost = v.host === playerId;
  const n = v.players.filter((p) => !p.gone).length;
  $("#startBtn").style.display = isHost ? "" : "none";
  $("#waitHost").style.display = isHost ? "none" : "block";
  $("#startBtn").textContent = n >= 2 ? `Start race (${n}/4)` : "Start solo practice";
  $("#lobbyMsg").textContent = isHost && n < 2 ? "Share the code — friends can join until you press start." : "";
  world.setShowcase(me?.char ?? 0);
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

function renderResults(v) {
  const list = $("#podium");
  list.replaceChildren();
  const byId = new Map(v.players.map((p) => [p.id, p]));
  v.standings.forEach((id, i) => {
    const p = byId.get(id);
    if (!p) return;
    const medal = ["🥇", "🥈", "🥉", "4"][i] ?? String(i + 1);
    const detail = p.left
      ? "left the race"
      : p.finish !== null
        ? `${p.hits} bump${p.hits === 1 ? "" : "s"}`
        : `${Math.round(p.d)} m of ${TRACK_LEN} m`;
    list.append(
      el(
        "li",
        { class: p.id === playerId ? "me" : "" },
        el("span", { class: "pl", text: medal }),
        el("img", { src: portrait(p.char), alt: "" }),
        el("span", { class: "who", text: p.name }, el("small", { text: detail })),
        el("span", { class: "tm", text: p.finish !== null ? fmtTime(p.finish) : "DNF" }),
      ),
    );
  });
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

  scene.background = new THREE.Color("#8fd3ff");
  scene.fog = new THREE.Fog("#cdeeff", 55, 150);
  scene.add(new THREE.HemisphereLight("#e6f6ff", "#5fae3a", 1.35));
  const sun = new THREE.DirectionalLight("#fff4d6", 1.6);
  sun.position.set(-6, 14, 8);
  scene.add(sun);

  texLoader.load("/assets/sky.jpg", (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
  });

  // ground: grass everywhere, four lanes marked with chalk lines
  const grassTex = texLoader.load("/assets/grass.jpg");
  grassTex.colorSpace = THREE.SRGBColorSpace;
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.anisotropy = 4;
  const GROUND_LEN = TRACK_LEN + 260;
  const groundMat = new THREE.MeshLambertMaterial({ map: grassTex });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, GROUND_LEN), groundMat);
  grassTex.repeat.set(90 / 5, GROUND_LEN / 5);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -GROUND_LEN / 2 + 60;
  scene.add(ground);

  // a slightly lighter, mown track on top of the meadow
  const trackTex = texLoader.load("/assets/grass.jpg");
  trackTex.colorSpace = THREE.SRGBColorSpace;
  trackTex.wrapS = trackTex.wrapT = THREE.RepeatWrapping;
  trackTex.anisotropy = 4;
  trackTex.repeat.set((LANES * LANE_W + 1) / 3, GROUND_LEN / 3);
  const track = new THREE.Mesh(
    new THREE.PlaneGeometry(LANES * LANE_W + 1, GROUND_LEN),
    new THREE.MeshLambertMaterial({ map: trackTex, color: "#d9ffb8" }),
  );
  track.rotation.x = -Math.PI / 2;
  track.position.set(0, 0.01, ground.position.z);
  scene.add(track);

  const chalk = new THREE.MeshBasicMaterial({ color: "#ffffff", fog: true });
  for (let i = 0; i <= LANES; i++) {
    const w = i === 0 || i === LANES ? 0.16 : 0.09;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(w, GROUND_LEN), chalk);
    line.rotation.x = -Math.PI / 2;
    line.position.set((i - LANES / 2) * LANE_W, 0.02, ground.position.z);
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
    m.position.set(0, 0.03, -z);
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

  async function load(onProgress) {
    const jobs = [
      ...[0, 1, 2, 3].map((i) => loadChar(i).then((c) => (assets.chars[i] = c))),
      loadGLB("/assets/hurdle.glb").then((g) => (assets.props.hurdle = fitProp(g.scene, { width: 1.75, maxHeight: 0.75 }))),
      loadGLB("/assets/gate.glb").then((g) => (assets.props.gate = fitProp(g.scene, { width: 1.9, maxHeight: 2.15 }))),
      loadGLB("/assets/crate.glb").then((g) => (assets.props.crate = fitProp(g.scene, { width: 1.55 }))),
      loadGLB("/assets/tree.glb").then((g) => (assets.props.tree = fitProp(g.scene, { height: 4.2 }))),
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

  function buildScenery() {
    if (scenery || !assets.props.tree) return;
    scenery = new THREE.Group();
    let s = 12345;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let z = -40; z < TRACK_LEN + 120; z += 7 + r() * 6) {
      for (const side of [-1, 1]) {
        if (r() < 0.25) continue;
        const t = assets.props.tree.clone();
        const k = 0.8 + r() * 0.6;
        t.scale.multiplyScalar(k);
        t.rotation.y = r() * Math.PI * 2;
        t.position.set(side * (LANES * LANE_W * 0.5 + 3 + r() * 12), 0, -z);
        scenery.add(t);
        cullables.push({ obj: t, z, keep: true });
      }
    }
    scene.add(scenery);
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
      pad.position.set(laneX(b.lane), 0.035, -b.z);
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
    for (const c of cullables) c.obj.visible = c.z > d - VIEW_BEHIND && c.z < d + VIEW_AHEAD;
  }

  // ── lobby showcase: your runner idling in front of the camera ──
  let show = null;
  function showcase() {
    if (!ready) return;
    buildScenery();
  }
  function setShowcase(charIdx) {
    if (!ready) return;
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
  if (!world.ready) {
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
    r.runner = world.makeRunner(p.char, p.name, RUNNERS[p.char].color, false);
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

  if (game.pendingRace && world.ready && net.view && (net.view.phase === "countdown" || net.view.phase === "race")) {
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
