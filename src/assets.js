// Asset loading + runtime image processing.
// Tries optimized files (assets/game/*.webp) first, then the raw concept PNGs,
// and finally falls back to code-drawn art so the game always runs.
import { BIOMES } from './config.js';
import { cutoutMainSubject, detectGroundLine } from './imageproc.js';

const BIOME_QUADS = { desert: [0, 0], snow: [1, 0], volcano: [0, 1], night: [1, 1] };

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img.naturalWidth ? img : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadFirst(names) {
  for (const n of names) {
    const img = await loadImage(n);
    if (img) return img;
  }
  return null;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// ------------------------------------------------------------ background removal
// Flood-fills the light, low-saturation backdrop from the image border, feathers
// the edge and trims to the opaque bounding box.
export function removeLightBackground(img, maxH = 720) {
  const scale = Math.min(1, maxH / img.height);
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  // already transparent? just trim
  const cornerA = d[3];
  if (cornerA < 20) return trim(c, ctx, data);

  cutoutMainSubject(d, w, h);
  ctx.putImageData(data, 0, 0);
  return trim(c, ctx, data);
}

function trim(c, ctx, data) {
  const { width: w, height: h } = c;
  const d = data.data;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 <= x0 || y1 <= y0) return c;
  const out = makeCanvas(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// Pre-bake damage stages: progressively darker with cracks clipped to the shape.
export function bakeDamageStages(src, team) {
  const stages = [src];
  let seed = team === 0 ? 7 : 13;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const cracks = [];
  for (let s = 1; s <= 3; s++) {
    const c = makeCanvas(src.width, src.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(20,10,10,${0.12 * s})`;
    ctx.fillRect(0, 0, c.width, c.height);
    // add new cracks per stage, keep old ones
    for (let k = 0; k < 4; k++) {
      const x = c.width * (0.25 + rnd() * 0.5), y = c.height * (0.15 + rnd() * 0.6);
      const pts = [[x, y]];
      let a = rnd() * Math.PI * 2;
      for (let j = 0; j < 6; j++) {
        a += (rnd() - 0.5) * 1.4;
        const len = c.height * (0.03 + rnd() * 0.05);
        const [px, py] = pts[pts.length - 1];
        pts.push([px + Math.cos(a) * len, py + Math.sin(a) * len]);
      }
      cracks.push(pts);
    }
    ctx.strokeStyle = 'rgba(10,8,8,0.85)';
    ctx.lineWidth = Math.max(2, c.width / 120);
    ctx.lineJoin = 'round';
    for (const pts of cracks) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    stages.push(c);
  }
  return stages;
}

// Crop one quadrant of the 2x2 biome sheet (with a tiny inset to avoid seams).
function cropQuadrant(img, qx, qy) {
  const w = img.width / 2, h = img.height / 2;
  const inset = Math.round(Math.min(w, h) * 0.008);
  const c = makeCanvas(w - inset * 2, h - inset * 2);
  c.getContext('2d').drawImage(img, qx * w + inset, qy * h + inset, w - inset * 2, h - inset * 2, 0, 0, c.width, c.height);
  return c;
}

// Ground line of a background image (fraction of its height), measured on a
// downscaled copy for speed.
function groundLineOf(img) {
  const w = 240, h = Math.max(60, Math.round(240 * img.height / img.width));
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  return detectGroundLine(ctx.getImageData(0, 0, w, h).data, w, h);
}

// Average color of a horizontal band (used to blend the code-drawn ground).
function sampleBand(img, y0f, y1f) {
  const c = makeCanvas(32, 8);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, img.height * y0f, img.width, img.height * (y1f - y0f), 0, 0, 32, 8);
  const d = ctx.getImageData(0, 0, 32, 8).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4;
  return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
}

// ------------------------------------------------------------ procedural fallbacks
function proceduralBackground(biome) {
  const b = BIOMES[biome];
  const w = 1344, h = 576;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, b.sky[0]); g.addColorStop(0.75, b.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  let seed = biome.length * 99;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  if (b.night) {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 120; i++) { ctx.globalAlpha = 0.3 + rnd() * 0.7; ctx.fillRect(rnd() * w, rnd() * h * 0.6, 1.5, 1.5); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f4f1d0'; ctx.beginPath(); ctx.arc(w * 0.78, h * 0.2, 34, 0, Math.PI * 2); ctx.fill();
  } else if (biome === 'volcano') {
    ctx.fillStyle = 'rgba(40,20,20,0.35)';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(rnd() * w, h * (0.1 + rnd() * 0.3), 140, 30, 0, 0, Math.PI * 2); ctx.fill(); }
  } else {
    ctx.fillStyle = biome === 'desert' ? 'rgba(255,240,200,0.9)' : 'rgba(255,255,255,0.9)';
    if (biome === 'desert') { ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(w * 0.2, h * 0.2, 40, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 7; i++) {
      const cx = rnd() * w, cy = h * (0.08 + rnd() * 0.25);
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(cx + k * 22, cy + Math.sin(k) * 6, 18 + rnd() * 12, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // three hill / mountain bands
  const bands = [[0.42, 120, b.hills[0], biome === 'snow' || biome === 'volcano'], [0.6, 70, b.hills[1], false], [0.78, 40, b.hills[2], false]];
  for (const [base, amp, col, peaks] of bands) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, h);
    const f1 = 0.004 + rnd() * 0.004, f2 = 0.011 + rnd() * 0.01, ph = rnd() * 10;
    for (let x = 0; x <= w; x += 8) {
      let y = h * base - (Math.sin(x * f1 + ph) * 0.6 + Math.sin(x * f2 + ph * 2) * 0.4) * amp;
      if (peaks) y -= Math.abs(Math.sin(x * 0.012 + ph)) * amp * 0.8;
      ctx.lineTo(x, y);
    }
    // ensure horizontal tiling continuity by matching endpoints loosely
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    if (biome === 'volcano' && base > 0.5) {
      ctx.strokeStyle = 'rgba(255,110,30,0.6)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, h * (base + 0.08));
      for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h * (base + 0.08) + Math.sin(x * 0.03) * 6);
      ctx.stroke();
    }
  }
  if (biome === 'snow' || biome === 'night' || biome === 'grassland') {
    // pine / round trees on the near hills
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w, y = h * (0.7 + rnd() * 0.08);
      ctx.fillStyle = biome === 'snow' ? '#4d6b5c' : biome === 'night' ? '#0f1830' : '#3f7d3a';
      if (biome === 'grassland') { ctx.beginPath(); ctx.arc(x, y - 14, 12, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x - 1.5, y - 4, 3, 10); }
      else { ctx.beginPath(); ctx.moveTo(x, y - 34); ctx.lineTo(x - 11, y); ctx.lineTo(x + 11, y); ctx.fill(); }
    }
  }
  if (biome === 'desert') {
    ctx.fillStyle = '#c79a5a';
    for (let i = 0; i < 4; i++) { const x = rnd() * w; ctx.fillRect(x, h * 0.6, 14, -40 - rnd() * 30); ctx.fillRect(x + 30, h * 0.6, 14, -30 - rnd() * 20); ctx.fillRect(x - 4, h * 0.6 - 70, 52, 10); }
  }
  // flat ground strip at the bottom
  ctx.fillStyle = b.ground; ctx.fillRect(0, h * 0.88, w, h * 0.12);
  return c;
}

function proceduralMonument(team) {
  const w = 300, h = 420;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6; ctx.strokeStyle = '#141418';
  // stone steps
  ctx.fillStyle = team === 0 ? '#b9c3cf' : '#5a4b4b';
  for (let i = 0; i < 3; i++) { const sw = 260 - i * 40; ctx.fillRect((w - sw) / 2, h - 30 - i * 26, sw, 26); ctx.strokeRect((w - sw) / 2, h - 30 - i * 26, sw, 26); }
  if (team === 0) {
    // quill obelisk
    ctx.fillStyle = '#d6dde6';
    ctx.beginPath(); ctx.moveTo(110, h - 108); ctx.lineTo(190, h - 108); ctx.lineTo(176, 120); ctx.lineTo(150, 70); ctx.lineTo(124, 120); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#8a97a8'; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(150, 140 + i * 30); ctx.lineTo(128 + i * 1.5, 128 + i * 30); ctx.moveTo(150, 140 + i * 30); ctx.lineTo(172 - i * 1.5, 128 + i * 30); ctx.stroke(); }
    ctx.lineWidth = 6; ctx.strokeStyle = '#141418';
    // crystal
    ctx.fillStyle = '#3d8cff';
    ctx.beginPath(); ctx.moveTo(150, 8); ctx.quadraticCurveTo(186, 50, 150, 74); ctx.quadraticCurveTo(114, 50, 150, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#bfe0ff'; ctx.beginPath(); ctx.arc(142, 48, 7, 0, Math.PI * 2); ctx.fill();
    // banners
    for (const bx of [70, 230]) {
      ctx.fillStyle = '#5a3b22'; ctx.fillRect(bx - 3, h - 200, 6, 120);
      ctx.fillStyle = '#2f7de1'; ctx.beginPath(); ctx.moveTo(bx + 3, h - 196); ctx.lineTo(bx + (bx < 150 ? -34 : 34) * -1 + 3, h - 196); ctx.lineTo(bx + 3, h - 140); ctx.fill();
    }
  } else {
    // horned skull tower
    ctx.fillStyle = '#3d3434';
    ctx.beginPath(); ctx.moveTo(100, h - 108); ctx.lineTo(200, h - 108); ctx.lineTo(186, 150); ctx.lineTo(114, 150); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d9cfc0';
    ctx.beginPath(); ctx.arc(150, 120, 52, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillRect(122, 150, 56, 36); ctx.strokeRect(122, 150, 56, 36);
    // horns
    ctx.fillStyle = '#efe6d2';
    ctx.beginPath(); ctx.moveTo(108, 92); ctx.quadraticCurveTo(50, 70, 60, 10); ctx.quadraticCurveTo(80, 60, 120, 76); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(192, 92); ctx.quadraticCurveTo(250, 70, 240, 10); ctx.quadraticCurveTo(220, 60, 180, 76); ctx.closePath(); ctx.fill(); ctx.stroke();
    // eyes
    ctx.fillStyle = '#141418'; ctx.beginPath(); ctx.arc(128, 120, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff3b2f'; ctx.beginPath(); ctx.arc(172, 120, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd0c0'; ctx.beginPath(); ctx.arc(168, 116, 5, 0, Math.PI * 2); ctx.fill();
    // crack + teeth
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(150, 70); ctx.lineTo(140, 95); ctx.lineTo(152, 108); ctx.stroke();
    ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(130 + i * 13, 158); ctx.lineTo(130 + i * 13, 180); ctx.stroke(); }
    // braziers
    for (const bx of [62, 238]) {
      ctx.fillStyle = '#2a2222'; ctx.fillRect(bx - 4, h - 190, 8, 110);
      ctx.fillStyle = '#4a3a3a'; ctx.beginPath(); ctx.moveTo(bx - 16, h - 196); ctx.lineTo(bx + 16, h - 196); ctx.lineTo(bx + 8, h - 182); ctx.lineTo(bx - 8, h - 182); ctx.fill();
      ctx.fillStyle = '#ff8a1e'; ctx.beginPath(); ctx.moveTo(bx - 12, h - 196); ctx.quadraticCurveTo(bx, h - 240, bx + 12, h - 196); ctx.fill();
      ctx.fillStyle = '#ffd34a'; ctx.beginPath(); ctx.moveTo(bx - 6, h - 196); ctx.quadraticCurveTo(bx, h - 220, bx + 6, h - 196); ctx.fill();
    }
    // spikes + red banner
    ctx.fillStyle = '#e03b3b'; ctx.beginPath(); ctx.moveTo(110, 190); ctx.lineTo(190, 190); ctx.lineTo(180, 260); ctx.lineTo(150, 240); ctx.lineTo(120, 260); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  return c;
}

// ------------------------------------------------------------ public loader
export class Assets {
  constructor() {
    this.monuments = [null, null];       // arrays of damage-stage canvases
    this.monumentSource = ['code', 'code'];
    this.backgrounds = {};               // biome -> { img, groundColor, source }
    this.icon = null;
  }

  async load(onProgress = () => {}) {
    const tasks = [
      ['monument_blue', ['assets/game/monument_blue.webp', 'assets/game/monument_blue.png', 'assets/concept/monument_blue.png']],
      ['monument_red', ['assets/game/monument_red.webp', 'assets/game/monument_red.png', 'assets/concept/monument_red.png']],
      ['bg_grassland', ['assets/game/bg_grassland.webp', 'assets/concept/bg_grassland.png']],
      ['bg_desert', ['assets/game/bg_desert.webp']],
      ['bg_snow', ['assets/game/bg_snow.webp']],
      ['bg_volcano', ['assets/game/bg_volcano.webp']],
      ['bg_night', ['assets/game/bg_night.webp']],
      // the raw sheet is only needed when the optimized crops aren't there
      ['bg_biomes', ['assets/concept/bg_biomes.png']],
      ['icon', ['icons/icon-512.png']],
    ];
    // assets/game/manifest.json (written by `npm run assets`) lists the optimized
    // files that exist, so we never request missing ones.
    let built = null;
    try {
      const r = await fetch('assets/game/manifest.json', { cache: 'no-cache' });
      if (r.ok) built = new Set((await r.json()).files);
    } catch (e) { /* offline or file:// */ }
    const usable = (src) => !src.startsWith('assets/game/') || (built && built.has(src.slice(12)));
    const raw = {};
    let done = 0;
    const haveCrops = built && ['desert', 'snow', 'volcano', 'night'].every((b) => built.has(`bg_${b}.webp`));
    await Promise.all(tasks.map(async ([name, srcs]) => {
      raw[name] = name === 'bg_biomes' && haveCrops ? null : await loadFirst(srcs.filter(usable));
      done++;
      onProgress(done / (tasks.length + 2));
    }));
    await new Promise((r) => setTimeout(r, 0));

    // monuments
    for (const [team, key] of [[0, 'monument_blue'], [1, 'monument_red']]) {
      let base;
      if (raw[key]) {
        try { base = removeLightBackground(raw[key]); this.monumentSource[team] = 'image'; }
        catch (e) { base = null; }
      }
      if (!base) base = proceduralMonument(team);
      this.monuments[team] = bakeDamageStages(base, team);
    }
    onProgress((tasks.length + 1) / (tasks.length + 2));

    // backgrounds
    for (const biome of Object.keys(BIOMES)) {
      let img = raw['bg_' + biome], source = 'image';
      if (!img && BIOME_QUADS[biome] && raw.bg_biomes) {
        const [qx, qy] = BIOME_QUADS[biome];
        img = cropQuadrant(raw.bg_biomes, qx, qy);
      }
      if (!img) { img = proceduralBackground(biome); source = 'code'; }
      let groundColor = null, bottomColor = null, ground = 0.88;
      try {
        if (source === 'image') ground = groundLineOf(img);
        groundColor = sampleBand(img, ground + 0.01, Math.min(1, ground + 0.04));
        bottomColor = sampleBand(img, 0.97, 1);
      } catch (e) { /* tainted canvas on file:// */ }
      this.backgrounds[biome] = { img, groundColor, bottomColor, ground, source };
    }
    this.icon = raw.icon;
    onProgress(1);
    return this;
  }
}
