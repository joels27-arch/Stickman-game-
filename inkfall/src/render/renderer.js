// Canvas renderer: parallax backgrounds, ground, structures, units, projectiles,
// effects, night lighting and ambient weather. World space: ground at y=0,
// depth z pushes things down by z*DEPTH_SCALE.
import { VIEW_HEIGHT, GROUND_FRAC, DEPTH, DEPTH_SCALE, BIOMES, TEAM_COLORS, TEAM_DARK, MONUMENT } from '../config.js';
import { clamp, TAU, lerp } from '../core/util.js';
import { drawUnit, INK } from './stick.js';
import { makeCanvas } from '../assets.js';
import { SpriteCache } from './spritecache.js';

const PARALLAX = [
  { f: 0.06, y0: 0, y1: 1, fade0: 0, fade1: 0 },
  { f: 0.2, y0: 0.3, y1: 1, fade0: 0.3, fade1: 0.44 },
  { f: 0.42, y0: 0.6, y1: 1, fade0: 0.6, fade1: 0.7 },
];

function hash(n) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }

export class Renderer {
  constructor(canvas, assets, settings, quality) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.assets = assets;
    this.settings = settings;
    this.q = quality;
    this.cam = { x: 0, tx: 0, shake: 0, sx: 0, sy: 0, follow: null };
    this.layers = [];
    this.biome = null;
    this.time = 0;
    this.ambient = [];
    this.lightCanvas = null;
    this.glow = null;
    this.spellTarget = null;
    this.colors = [{ main: TEAM_COLORS[0], dark: TEAM_DARK[0] }, { main: TEAM_COLORS[1], dark: TEAM_DARK[1] }];
    this.hat = null;
    this.sprites = new SpriteCache();
    this.resize();
  }

  setSkin(color, dark, hat) {
    this.colors[0] = { main: color || TEAM_COLORS[0], dark: dark || TEAM_DARK[0] };
    this.hat = hat && hat !== 'none' ? hat : null;
    this.sprites.reset(this.sprites.ppu);
  }

  setQuality(q) { this.q = q; this.resize(); }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.q.dprCap);
    const w = window.innerWidth, h = window.innerHeight;
    this.dpr = dpr;
    this.W = w; this.H = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.s = clamp(h / VIEW_HEIGHT, 0.55, 3.2);
    this.groundY = Math.round(h * GROUND_FRAC);
    this.viewW = w / this.s;
    if (this.biome) this.buildLayers(this.biome);
    this.lightCanvas = makeCanvas(w * this.q.lightRes, h * this.q.lightRes);
    this.bench = null; this.bestMode = null; // re-benchmark unit drawing at the new resolution
    this.glow = this.makeGlow();
  }

  makeGlow() {
    const c = makeCanvas(64, 64);
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(0.5, 'rgba(0,0,0,0.75)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return c;
  }

  setBiome(biome) {
    this.biome = biome;
    this.buildLayers(biome);
    this.initAmbient(biome);
  }

  // Split the background image into horizontal bands rendered at different
  // parallax speeds; each band is pre-scaled and mirrored for seamless tiling.
  // Background image = scenery (above its ground line) split into horizontal
  // bands at different parallax speeds + its ground strip, which scrolls 1:1
  // with the battlefield so units stand on it. Bands are pre-scaled and mirrored
  // for seamless tiling.
  buildLayers(biome) {
    const bg = this.assets.backgrounds[biome];
    if (!bg) return;
    const img = bg.img;
    const dpr = this.dpr;
    const g = bg.ground || 0.88;
    const sceneH = img.height * g;
    const Ht = Math.ceil((this.groundY + 2) * dpr);
    const k = Ht / sceneH;
    const Tw = Math.ceil(img.width * k);
    const count = this.q.parallax >= 3 ? 3 : 1;
    const mirrored = (sy, sh, dh) => {
      const c = makeCanvas(Tw * 2, dh);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, sy, img.width, sh, 0, 0, Tw, dh);
      ctx.save(); ctx.translate(Tw * 2, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, sy, img.width, sh, 0, 0, Tw, dh); ctx.restore();
      return c;
    };
    this.layers = [];
    for (let i = 0; i < count; i++) {
      const L = count === 1 ? { f: 0.18, fade0: 0, fade1: 0 } : PARALLAX[i];
      const c = mirrored(0, sceneH, Ht);
      if (L.fade1 > 0) {
        const ctx = c.getContext('2d');
        ctx.globalCompositeOperation = 'destination-in';
        const gr = ctx.createLinearGradient(0, 0, 0, Ht);
        gr.addColorStop(0, 'rgba(0,0,0,0)');
        gr.addColorStop(L.fade0, 'rgba(0,0,0,0)');
        gr.addColorStop(L.fade1, 'rgba(0,0,0,1)');
        gr.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, c.width, Ht);
        ctx.globalCompositeOperation = 'source-over';
      }
      this.layers.push({ canvas: c, f: L.f, tw: Tw * 2, y: 0 });
    }
    // the image's own ground strip, only when it comes from real art
    this.imageGround = bg.source === 'image' && g < 0.95;
    if (this.imageGround) {
      const gh = Math.ceil(img.height * (1 - g) * k);
      this.layers.push({ canvas: mirrored(sceneH, img.height - sceneH, gh), f: 1, tw: Tw * 2, y: Math.floor(this.groundY * dpr) - 1, ground: true });
    }
    this.groundColor = bg.groundColor;
    this.bottomColor = bg.bottomColor;
  }

  initAmbient(biome) {
    this.ambient = [];
    const n = biome === 'snow' ? 70 : biome === 'volcano' ? 45 : biome === 'night' ? 22 : biome === 'desert' ? 18 : 14;
    for (let i = 0; i < n; i++) this.ambient.push({ x: Math.random(), y: Math.random(), v: 0.4 + Math.random() * 0.8, p: Math.random() * 10 });
  }

  // ------------------------------------------------------------ camera
  worldToScreenX(x) { return (x - this.cam.x) * this.s; }
  screenToWorld(sx, sy) { return { x: sx / this.s + this.cam.x, y: (sy - this.groundY) / this.s }; }

  updateCamera(world, dt) {
    const cam = this.cam;
    const maxX = Math.max(0, world.width - this.viewW);
    if (cam.follow && cam.follow.alive) cam.tx = cam.follow.x - this.viewW * 0.42;
    cam.tx = clamp(cam.tx, 0, maxX);
    cam.x = lerp(cam.x, cam.tx, 1 - Math.pow(0.0005, dt));
    cam.x = clamp(cam.x, 0, maxX);
    if (cam.shake > 0) {
      cam.shake = Math.max(0, cam.shake - dt * 30);
      const m = this.settings.shake === false ? 0 : cam.shake;
      cam.sx = (Math.random() - 0.5) * m; cam.sy = (Math.random() - 0.5) * m;
    } else { cam.sx = cam.sy = 0; }
  }

  addShake(n) { this.cam.shake = Math.min(22, Math.max(this.cam.shake, n)); }

  // ------------------------------------------------------------ main render
  render(world, fx, alpha, dt) {
    this.time += dt;
    const ctx = this.ctx, dpr = this.dpr, s = this.s;
    const W = this.W, H = this.H, gy = this.groundY;
    const biome = BIOMES[world.biome];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = biome.sky[0];
    ctx.fillRect(0, 0, W, H);
    this.drawGroundBand(ctx, W, H, gy, biome);
    if (!this.debugSkip?.bg) this.drawBackground(ctx, W, H, gy, dpr);

    // world transform
    const camX = this.cam.x + this.cam.sx / s;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, -camX * s * dpr, (gy + this.cam.sy) * dpr);
    const x0 = camX - 20, x1 = camX + this.viewW + 20;
    this.drawGroundDetails(ctx, x0, x1, world.biome);
    fx.drawDecals(ctx, x0, x1);
    for (const n of world.nodes) if (n.x > x0 - 60 && n.x < x1 + 60) this.drawNode(ctx, n);
    // garrisoned units hide behind their monument
    for (const u of world.units) if (u.garrisoned && u.x > x0 && u.x < x1) this.drawOneUnit(ctx, u, alpha, 0.55);
    for (const st of world.structures) if (st.x > x0 - 200 && st.x < x1 + 200) this.drawStructure(ctx, st, world);
    fx.drawRagdolls(ctx, x0, x1);
    // units sorted by depth
    const list = this._sorted || (this._sorted = []);
    list.length = 0;
    for (const u of world.units) if (!u.garrisoned && u.x > x0 - 60 && u.x < x1 + 60) list.push(u);
    list.sort((a, b) => a.z - b.z);
    if (this.debugSkip?.units) list.length = 0;
    this.drawShadows(ctx, list, alpha);
    // big battles: cached sprite frames; small ones: full vector for max smoothness
    if (this.unitMode(list.length, dt) === 'sprite') this.drawUnitsCached(ctx, list, alpha, camX);
    else for (const u of list) this.drawOneUnit(ctx, u, alpha, 1, true);
    this.drawProjectiles(ctx, world, alpha, x0, x1);
    if (!this.debugSkip?.fx) fx.drawParticles(ctx, x0, x1, alpha);
    this.drawBars(ctx, list, alpha);
    this.drawForeground(ctx, x0, x1, world.biome);
    if (this.spellTarget) this.drawSpellTarget(ctx, this.spellTarget);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (biome.night) this.drawNight(ctx, world, fx, camX);
    this.drawAmbient(ctx, world.biome, dt, W, H);
    // low-monument warning vignette
    const m = world.teams[0].monument;
    if (!world.over && m.hp < m.maxHp * 0.25) {
      const a = 0.18 + Math.sin(this.time * 5) * 0.08;
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.7);
      g.addColorStop(0, 'rgba(160,0,0,0)'); g.addColorStop(1, `rgba(160,0,0,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }

  drawBackground(ctx, W, H, gy, dpr) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const L of this.layers) {
      const off = -((this.cam.x * this.s * L.f * dpr) % L.tw);
      const sy = L.y + this.cam.sy * dpr * L.f;
      for (let x = off; x < W * dpr; x += L.tw) ctx.drawImage(L.canvas, Math.floor(x), sy);
    }
    ctx.restore();
  }

  drawGroundBand(ctx, W, H, gy, b) {
    if (this.imageGround) {
      // below the art's ground strip: continue with its own bottom colour
      const c = this.bottomColor || b.dirtDark;
      const g = ctx.createLinearGradient(0, gy, 0, H);
      g.addColorStop(0, c); g.addColorStop(1, b.dirtDark);
      ctx.fillStyle = g;
      ctx.fillRect(0, gy - 1, W, H - gy + 1);
      return;
    }
    const g = ctx.createLinearGradient(0, gy, 0, H);
    g.addColorStop(0, this.groundColor || b.ground);
    g.addColorStop(0.08, b.ground);
    g.addColorStop(0.35, b.dirt);
    g.addColorStop(1, b.dirtDark);
    ctx.fillStyle = g;
    ctx.fillRect(0, gy - 1, W, H - gy + 1);
    // lip along the top edge
    ctx.fillStyle = b.groundTop;
    ctx.fillRect(0, gy - 2, W, 3);
  }

  drawGroundDetails(ctx, x0, x1, biome) {
    if (this.imageGround) return; // the art already has its own ground texture
    const step = 26;
    const start = Math.floor(x0 / step) * step;
    for (let x = start; x < x1; x += step) {
      const h = hash(x), h2 = hash(x + 0.5);
      const z = h2 * (DEPTH + 30);
      const y = z * DEPTH_SCALE + 2;
      if (h < 0.35) {
        // stones / pebbles
        ctx.fillStyle = biome === 'snow' ? 'rgba(150,170,195,0.6)' : biome === 'volcano' ? 'rgba(20,12,10,0.7)' : 'rgba(70,55,40,0.45)';
        ctx.beginPath(); ctx.ellipse(x + h * 20, y, 2 + h2 * 3, 1.2 + h2 * 1.5, 0, 0, TAU); ctx.fill();
      } else if (h < 0.55 && biome === 'volcano') {
        ctx.strokeStyle = `rgba(255,${90 + Math.floor(h2 * 60)},20,${0.35 + Math.sin(this.time * 2 + x) * 0.2})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 6, y + 1.5); ctx.lineTo(x + 11, y - 0.5); ctx.stroke();
      }
    }
    // top grass/snow fringe along the ground line
    const tuft = biome === 'grassland' ? '#5f9a35' : biome === 'snow' ? '#ffffff' : biome === 'desert' ? '#c99a52' : biome === 'night' ? '#2f4a6a' : '#4b302a';
    ctx.strokeStyle = tuft; ctx.lineWidth = 1.2;
    ctx.beginPath();
    const s2 = 9;
    for (let x = Math.floor(x0 / s2) * s2; x < x1; x += s2) {
      const h = hash(x * 1.7);
      if (h < 0.5) continue;
      ctx.moveTo(x, 0); ctx.lineTo(x - 1.5, -3 - h * 4);
      ctx.moveTo(x + 2, 0); ctx.lineTo(x + 3, -2 - h * 3);
    }
    ctx.stroke();
  }

  drawForeground(ctx, x0, x1, biome) {
    if (this.imageGround) return;
    // dark silhouette tufts at the bottom edge for depth
    const y = DEPTH * DEPTH_SCALE + 22;
    const col = biome === 'snow' ? 'rgba(200,215,235,0.9)' : biome === 'volcano' ? 'rgba(15,8,6,0.9)' : biome === 'desert' ? 'rgba(150,105,55,0.9)' : biome === 'night' ? 'rgba(8,12,24,0.92)' : 'rgba(45,80,30,0.9)';
    ctx.fillStyle = col;
    const step = 34;
    for (let x = Math.floor(x0 / step) * step; x < x1 + step; x += step) {
      const h = hash(x * 3.1);
      if (h < 0.45) continue;
      // soft rounded clumps (grass / snow drifts / rocks depending on biome)
      const r = 6 + h * 6;
      ctx.beginPath();
      ctx.ellipse(x, y + 6, r * 1.6, r, 0, Math.PI, 0);
      ctx.ellipse(x + r * 1.2, y + 7, r, r * 0.7, 0, Math.PI, 0);
      ctx.fill();
    }
  }

  drawNode(ctx, n) {
    const y = n.z * DEPTH_SCALE + 2;
    const k = n.amount === Infinity ? 1 : clamp(n.amount / n.start, 0.25, 1);
    if (n.amount <= 0) {
      ctx.fillStyle = 'rgba(60,50,40,0.5)';
      ctx.beginPath(); ctx.ellipse(n.x, y, 16, 4, 0, 0, TAU); ctx.fill();
      return;
    }
    if (n.kind === 'gold') {
      ctx.fillStyle = '#5d5148';
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(n.x - 22 * k, y); ctx.lineTo(n.x - 15 * k, y - 15 * k); ctx.lineTo(n.x - 3, y - 22 * k);
      ctx.lineTo(n.x + 10 * k, y - 18 * k); ctx.lineTo(n.x + 21 * k, y - 6 * k); ctx.lineTo(n.x + 23 * k, y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7a6d62';
      ctx.beginPath(); ctx.moveTo(n.x - 12 * k, y - 12 * k); ctx.lineTo(n.x - 3, y - 19 * k); ctx.lineTo(n.x + 4, y - 10 * k); ctx.closePath(); ctx.fill();
      const tw = Math.sin(this.time * 3 + n.x) * 0.5 + 0.5;
      for (let i = 0; i < 5; i++) {
        const gx = n.x + (hash(n.x + i) - 0.5) * 30 * k, gy2 = y - 4 - hash(n.x + i * 3) * 14 * k;
        ctx.fillStyle = '#ffcf33';
        ctx.beginPath(); ctx.arc(gx, gy2, 2.4, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(255,255,220,${0.5 + tw * 0.5})`;
        ctx.beginPath(); ctx.arc(gx - 0.8, gy2 - 0.8, 0.9, 0, TAU); ctx.fill();
      }
    } else {
      const pulse = 0.6 + Math.sin(this.time * 2.5 + n.x) * 0.25;
      ctx.fillStyle = `rgba(80,200,255,${0.18 * pulse})`;
      ctx.beginPath(); ctx.ellipse(n.x, y - 10, 26, 18, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3c3a46';
      ctx.beginPath(); ctx.ellipse(n.x, y, 18, 5, 0, 0, TAU); ctx.fill();
      const crystals = [[-9, 18, -0.3], [0, 28, 0.05], [8, 20, 0.35], [-3, 12, -0.6], [12, 11, 0.7]];
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      for (const [dx, h, a] of crystals) {
        const hh = h * k;
        ctx.save(); ctx.translate(n.x + dx, y); ctx.rotate(a);
        ctx.fillStyle = '#2e8fd6';
        ctx.beginPath(); ctx.moveTo(-3.5, 0); ctx.lineTo(-3, -hh * 0.8); ctx.lineTo(0, -hh); ctx.lineTo(3, -hh * 0.8); ctx.lineTo(3.5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#9fe3ff';
        ctx.beginPath(); ctx.moveTo(-1.5, -2); ctx.lineTo(-1, -hh * 0.75); ctx.lineTo(0.5, -hh * 0.85); ctx.lineTo(0.5, -2); ctx.fill();
        ctx.restore();
      }
    }
  }

  drawStructure(ctx, st, world) {
    if (st.kind === 'statue') return this.drawStatue(ctx, st);
    const stages = this.assets.monuments[st.team];
    const ratio = st.hp / st.maxHp;
    const stage = st.dead ? 3 : ratio > 0.75 ? 0 : ratio > 0.5 ? 1 : ratio > 0.25 ? 2 : 3;
    const img = stages[stage];
    const h = MONUMENT.height;
    const w = h * img.width / img.height;
    const baseY = DEPTH * DEPTH_SCALE * 0.45;
    let ox = 0, rot = 0, sink = 0, alpha = 1;
    if (st.shake > 0) ox = Math.sin(this.time * 90) * st.shake * 10;
    if (st.dead) {
      const t = st.collapseT;
      sink = Math.min(h * 0.9, t * t * 55);
      rot = (st.team === 0 ? -1 : 1) * Math.min(0.25, t * 0.09);
      ox += Math.sin(this.time * 60) * Math.max(0, 3 - t) * 2;
      alpha = clamp(1.8 - t * 0.35, 0, 1);
      if (alpha <= 0) return;
    }
    ctx.save();
    // clip at the ground so the collapsing monument sinks into the earth
    if (st.dead) { ctx.beginPath(); ctx.rect(st.x - w, -h * 2, w * 2, h * 2 + baseY + 1); ctx.clip(); }
    ctx.globalAlpha = alpha;
    ctx.translate(st.x + ox, baseY + sink);
    ctx.rotate(rot);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.45, 8, 0, 0, TAU); ctx.fill();
    // invulnerable (endless mode portal) glow
    if (st.invulnerable) {
      ctx.fillStyle = `rgba(255,60,60,${0.12 + Math.sin(this.time * 3) * 0.05})`;
      ctx.beginPath(); ctx.ellipse(0, -h * 0.5, w * 0.6, h * 0.6, 0, 0, TAU); ctx.fill();
    }
    ctx.drawImage(img, -w / 2, -h, w, h);
    if (st.hitT > 0) {
      ctx.globalAlpha = st.hitT * 3;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(img, -w / 2, -h, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    // smoke from a badly damaged monument
    if (!st.dead && ratio < 0.5 && Math.random() < (0.5 - ratio) * 0.5) {
      world.fx?.p('smoke', st.x + (Math.random() - 0.5) * w * 0.5, baseY - h * (0.3 + Math.random() * 0.5), 0, 6, -25, 1.6, 6 + Math.random() * 6, 'rgba(60,55,55,0.35)', { grav: 0 });
    }
    if (st.dead && st.collapseT < 3 && Math.random() < 0.6) {
      world.fx?.dust(st.x + (Math.random() - 0.5) * w, DEPTH * 0.5, 2, 'rgba(140,125,110,0.55)', 12);
    }
  }

  drawStatue(ctx, st) {
    if (st.dead && st.collapseT > 2) return;
    const baseY = st.z * DEPTH_SCALE * 0.3;
    const sink = st.dead ? st.collapseT * st.collapseT * 30 : 0;
    ctx.save();
    ctx.translate(st.x + (st.shake > 0 ? Math.sin(this.time * 90) * 3 : 0), baseY + sink);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = '#c8c2b4';
    ctx.fillRect(-20, -22, 40, 22); ctx.strokeRect(-20, -22, 40, 22);
    ctx.fillRect(-14, -30, 28, 8); ctx.strokeRect(-14, -30, 28, 8);
    // stone hero holding a quill aloft
    ctx.strokeStyle = '#9b9486'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, -30); ctx.lineTo(0, -52); ctx.lineTo(6, -30);
    ctx.moveTo(0, -52); ctx.lineTo(0, -72);
    ctx.moveTo(0, -70); ctx.lineTo(12, -86); ctx.moveTo(0, -70); ctx.lineTo(-10, -60);
    ctx.stroke();
    ctx.fillStyle = '#9b9486'; ctx.beginPath(); ctx.arc(0, -80, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f4f1e8'; ctx.beginPath(); ctx.moveTo(12, -86); ctx.quadraticCurveTo(20, -100, 14, -110); ctx.quadraticCurveTo(10, -98, 12, -86); ctx.fill();
    ctx.restore();
    if (!st.dead) {
      const r = st.hp / st.maxHp, bw = 50;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(st.x - bw / 2 - 1, -127, bw + 2, 6);
      ctx.fillStyle = r > 0.3 ? '#ffd34a' : '#ff3030'; ctx.fillRect(st.x - bw / 2, -126, bw * r, 4);
    }
  }

  // Small fights use full vector drawing. For big ones we A/B test cached
  // sprites vs vector on this device once (GPU canvases favour sprites, some
  // CPU rasterizers favour vector) and keep the faster path.
  unitMode(count, dt) {
    if (this.debugSkip?.sprites) return 'vector';
    if (count <= 24) return 'vector';
    if (this.bestMode) return this.bestMode;
    const b = this.bench || (this.bench = { phase: 0, t: 0, n: 0, res: {} });
    const order = ['sprite', 'sprite', 'vector']; // first sprite pass = warm-up (frames get cached)
    const mode = order[b.phase];
    b.t += dt; b.n++;
    if (b.t >= (b.phase === 0 ? 0.6 : 1.2)) {
      if (b.phase > 0) b.res[mode] = b.n / b.t;
      b.phase++; b.t = 0; b.n = 0;
      if (b.phase >= order.length) this.bestMode = b.res.sprite >= b.res.vector * 0.97 ? 'sprite' : 'vector';
    }
    return mode;
  }

  drawShadows(ctx, list, alpha) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    for (const u of list) {
      if (u.stealth && u.team === 1) continue;
      const x = u.px + (u.x - u.px) * alpha;
      const gy = (u.pz + (u.z - u.pz) * alpha) * DEPTH_SCALE;
      const sh = clamp(1 + u.y / 120, 0.3, 1);
      const rx = 9 * u.scale * sh;
      ctx.moveTo(x + rx, gy + 1);
      ctx.ellipse(x, gy + 1, rx, 2.4 * u.scale * sh, 0, 0, TAU);
    }
    ctx.fill();
  }

  drawUnitsCached(ctx, list, alpha, camX) {
    const dpr = this.dpr, s = this.s;
    const a = dpr * s, e0 = -camX * s * dpr, f0 = (this.groundY + this.cam.sy) * dpr;
    const ppu = Math.min(2.6, a);
    if (Math.abs(this.sprites.ppu - ppu) > 0.01) this.sprites.reset(ppu);
    const k = a / ppu; // >1 only when the sprite resolution is capped
    this.sprites.frame++;
    for (const u of list) {
      if (u.controlled) {
        ctx.setTransform(a, 0, 0, a, e0, f0);
        this.drawOneUnit(ctx, u, alpha, 1, true);
        continue;
      }
      const x = u.px + (u.x - u.px) * alpha;
      const z = u.pz + (u.z - u.pz) * alpha;
      const y = u.py + (u.y - u.py) * alpha;
      const sp = this.sprites.get(u, this.time, this.colors[u.team], this.hat);
      ctx.globalAlpha = u.stealth ? (u.team === 0 ? 0.35 : 0.07) : 1;
      ctx.setTransform(u.facing * k, 0, 0, k, a * x + e0, a * (y + z * DEPTH_SCALE) + f0);
      ctx.drawImage(sp.page, sp.sx, sp.sy, sp.w, sp.h, -sp.ox, -sp.oy, sp.w, sp.h);
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(a, 0, 0, a, e0, f0);
    for (const u of list) if (u.boss) this.drawBossGlow(ctx, u, alpha);
  }

  drawBossGlow(ctx, u, alpha) {
    const x = u.px + (u.x - u.px) * alpha, gy = u.z * DEPTH_SCALE;
    ctx.fillStyle = `rgba(255,60,30,${0.15 + Math.sin(this.time * 4) * 0.08})`;
    ctx.beginPath(); ctx.ellipse(x, gy - u.height * 0.5, 30 * u.scale, u.height * 0.6, 0, 0, TAU); ctx.fill();
  }

  drawOneUnit(ctx, u, alpha, dim, noShadow = false) {
    const x = u.px + (u.x - u.px) * alpha;
    const z = u.pz + (u.z - u.pz) * alpha;
    const y = u.py + (u.y - u.py) * alpha;
    const gy = z * DEPTH_SCALE;
    if (dim === 1 && !noShadow) {
      const sh = clamp(1 + y / 120, 0.3, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(x, gy + 1, 9 * u.scale * sh, 2.4 * u.scale * sh, 0, 0, TAU); ctx.fill();
    }
    drawUnit(ctx, u, x, y + gy, this.time, this.colors[u.team], {
      ownTeam: u.team === 0, dim: dim < 1 ? dim : 0, hat: u.team === 0 ? this.hat : null,
    });
    if (u.boss && noShadow && this.q.parallax >= 3) this.drawBossGlow(ctx, u, alpha);
  }

  drawBars(ctx, list, alpha) {
    for (const u of list) {
      if (u.stealth && u.team === 1) continue;
      const showCtrl = u.controlled;
      if (u.hp >= u.maxHp && !showCtrl) continue;
      const x = u.px + (u.x - u.px) * alpha;
      const y = u.y + u.z * DEPTH_SCALE - u.height - (u.type === 'inkcaster' ? 24 : 12);
      const w = (showCtrl ? 26 : 16) * Math.min(1.6, u.scale);
      const r = clamp(u.hp / u.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - w / 2 - 0.5, y - 0.5, w + 1, 3.5);
      ctx.fillStyle = u.team === 0 ? (r > 0.35 ? '#5fd35f' : '#ffb020') : '#ff5050';
      ctx.fillRect(x - w / 2, y, w * r, 2.5);
      if (showCtrl) {
        // pulsing chevron above the controlled unit
        const bob = Math.sin(this.time * 6) * 2;
        ctx.fillStyle = '#8fe6ff';
        ctx.beginPath(); ctx.moveTo(x - 5, y - 9 + bob); ctx.lineTo(x + 5, y - 9 + bob); ctx.lineTo(x, y - 3 + bob); ctx.closePath(); ctx.fill();
      }
    }
  }

  drawProjectiles(ctx, world, alpha, x0, x1) {
    world.projectiles.forEach((p) => {
      if (p.delay > 0 || p.x < x0 - 50 || p.x > x1 + 50) return;
      const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha, z = p.pz + (p.z - p.pz) * alpha;
      const sy = y + z * DEPTH_SCALE;
      if (p.kind === 'arrow') {
        const ang = Math.atan2(p.vy, p.vx);
        ctx.save(); ctx.translate(x, sy); ctx.rotate(ang);
        ctx.strokeStyle = '#5b3a1e'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(1, 0); ctx.stroke();
        ctx.fillStyle = '#ccd'; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(0, -1.8); ctx.lineTo(0, 1.8); ctx.fill();
        ctx.strokeStyle = TEAM_COLORS[p.team]; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(-11, 0); ctx.stroke();
        ctx.restore();
      } else if (p.kind === 'orb') {
        ctx.fillStyle = TEAM_COLORS[p.team];
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(x - p.vx * 0.03, sy - p.vy * 0.03, 7, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(x, sy, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, sy, 3.5, 0, TAU); ctx.fill();
        if (Math.random() < 0.5) world.fx?.p('blob', x, sy, z * DEPTH_SCALE, (Math.random() - 0.5) * 30, 0, 0.5, 1.5, INK);
      } else if (p.kind === 'bomb' || p.kind === 'meteor') {
        const gy = z * DEPTH_SCALE;
        // landing shadow warns where it'll hit
        const land = p.tx ?? x;
        const k = clamp(1 + p.y / 500, 0.2, 1);
        ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.3 * k})`;
        ctx.beginPath(); ctx.ellipse(land, gy + 1, 14 * k + 4, 3.5 * k + 1, 0, 0, TAU); ctx.fill();
        const meteor = p.kind === 'meteor';
        ctx.fillStyle = meteor ? 'rgba(255,120,30,0.4)' : 'rgba(30,30,40,0.35)';
        ctx.beginPath(); ctx.arc(x - p.vx * 0.04, sy - p.vy * 0.04, meteor ? 10 : 7, 0, TAU); ctx.fill();
        ctx.fillStyle = meteor ? '#ff7a1a' : INK;
        ctx.beginPath(); ctx.arc(x, sy, meteor ? 8 : 6, 0, TAU); ctx.fill();
        ctx.fillStyle = meteor ? '#ffd34a' : TEAM_COLORS[p.team] || '#fff';
        ctx.beginPath(); ctx.arc(x - 2, sy - 2, meteor ? 3.5 : 2, 0, TAU); ctx.fill();
        if (meteor && Math.random() < 0.7) world.fx?.p('smoke', x, sy, 0, 0, -10, 0.6, 5, 'rgba(80,60,50,0.5)', { grav: 0 });
      }
    });
  }

  drawSpellTarget(ctx, t) {
    const r = 110;
    ctx.strokeStyle = `rgba(120,200,255,${0.6 + Math.sin(this.time * 8) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.ellipse(t.x, DEPTH * DEPTH_SCALE * 0.5, r, r * 0.22, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(80,160,255,0.12)'; ctx.fill();
  }

  drawNight(ctx, world, fx, camX) {
    const lc = this.lightCanvas;
    const l = lc.getContext('2d');
    const k = this.q.lightRes;
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, lc.width, lc.height);
    l.fillStyle = 'rgba(4,8,28,0.74)';
    l.fillRect(0, 0, lc.width, lc.height);
    l.globalCompositeOperation = 'destination-out';
    const s = this.s * k, gy = this.groundY * k;
    const light = (x, y, r) => {
      const sx = (x - camX) * s, sy = gy + y * s, rr = r * s;
      if (sx < -rr || sx > lc.width + rr) return;
      l.drawImage(this.glow, sx - rr, sy - rr, rr * 2, rr * 2);
    };
    for (const st of world.structures) if (!st.dead) light(st.x, -120, 190);
    for (const u of world.units) {
      if (u.team === 0) light(u.x, u.z * DEPTH_SCALE - 25 * u.scale, u.controlled ? 120 : 70 * Math.sqrt(u.scale));
      else if (!u.stealth) light(u.x, u.z * DEPTH_SCALE - 25, 26);
    }
    for (const n of world.nodes) if (n.kind === 'ink') light(n.x, n.z * DEPTH_SCALE - 10, 45);
    fx.particles.forEach((o) => { if (o.type === 'flash') light(o.x, o.y, o.size * 2.2); });
    world.projectiles.forEach((p) => { if (p.kind !== 'arrow' && p.delay <= 0) light(p.x, p.y + p.z * DEPTH_SCALE, 50); });
    ctx.drawImage(lc, 0, 0, this.W, this.H);
  }

  drawAmbient(ctx, biome, dt, W, H) {
    const t = this.time;
    for (const a of this.ambient) {
      let x, y;
      switch (biome) {
        case 'snow':
          a.y += dt * 0.06 * a.v; a.x += Math.sin(t + a.p) * dt * 0.01 - dt * 0.008;
          if (a.y > 1) { a.y = 0; a.x = Math.random(); }
          x = ((a.x % 1) + 1) % 1 * W; y = a.y * H;
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath(); ctx.arc(x, y, 1 + a.v * 1.4, 0, TAU); ctx.fill();
          break;
        case 'volcano':
          a.y -= dt * 0.05 * a.v; a.x += Math.sin(t * 2 + a.p) * dt * 0.01;
          if (a.y < 0) { a.y = 1; a.x = Math.random(); }
          x = ((a.x % 1) + 1) % 1 * W; y = a.y * H;
          ctx.fillStyle = `rgba(255,${120 + Math.floor(a.v * 80)},40,${0.5 + Math.sin(t * 6 + a.p) * 0.3})`;
          ctx.fillRect(x, y, 2, 2);
          break;
        case 'night':
          x = (a.x * W + Math.sin(t * 0.5 + a.p) * 30); y = H * (0.45 + a.y * 0.3) + Math.cos(t * 0.7 + a.p) * 15;
          ctx.fillStyle = `rgba(220,255,140,${Math.max(0, Math.sin(t * 2 + a.p * 3)) * 0.8})`;
          ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();
          break;
        case 'desert':
          a.x += dt * 0.07 * a.v;
          if (a.x > 1.1) { a.x = -0.1; a.y = Math.random(); }
          x = a.x * W; y = H * (0.5 + a.y * 0.35);
          ctx.strokeStyle = 'rgba(255,240,200,0.35)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 18 * a.v, y); ctx.stroke();
          break;
        default:
          a.x += dt * 0.03 * a.v; a.y += Math.sin(t + a.p) * dt * 0.02;
          if (a.x > 1.1) { a.x = -0.1; a.y = Math.random() * 0.6; }
          x = a.x * W; y = H * (0.2 + a.y * 0.5);
          ctx.fillStyle = 'rgba(110,170,70,0.7)';
          ctx.save(); ctx.translate(x, y); ctx.rotate(t * 2 + a.p);
          ctx.beginPath(); ctx.ellipse(0, 0, 3, 1.4, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
  }
}
