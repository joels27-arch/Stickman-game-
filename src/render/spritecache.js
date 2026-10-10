// Atlas cache of pre-rendered stick-figure animation frames.
// Large battles draw each unit with a single drawImage instead of ~15 vector
// path operations. Frames are quantized (e.g. 14 walk frames) and rendered
// lazily at device-pixel resolution into small per-frame canvases (drawing
// from one huge, frequently-updated atlas forces costly snapshot copies),
// with an LRU pixel budget.
import { drawUnit } from './stick.js';
import { makeCanvas } from '../assets.js';

const TAU = Math.PI * 2;
// local-space bounds per type (unscaled world units; origin at the feet)
const BOX = {
  default: [-32, -78, 40, 6],
  digger: [-30, -78, 38, 6],
  bowman: [-26, -66, 30, 6],
  shieldbearer: [-26, -76, 54, 6],
  inkcaster: [-26, -106, 30, 6],
  shadow: [-26, -60, 34, 6],
  colossus: [-36, -98, 50, 6],
};

export class SpriteCache {
  constructor(budgetPx = 9e6) {
    this.map = new Map();         // insertion order doubles as LRU order
    this.ppu = 0;
    this.frame = 0;
    this.proxy = { id: 0 };
    this.resets = 0;
    this.evictions = 0;
    this.px = 0;
    this.budget = budgetPx;       // ~36 MB of RGBA
    this.pool = [];
  }

  get size() { return this.map.size; }

  reset(ppu) {
    this.ppu = ppu;
    for (const e of this.map.values()) this.pool.push(e.page);
    this.map.clear();
    this.px = 0;
    this.resets++;
  }

  evict() {
    // drop the least recently used ~10% so eviction work is batched
    let n = Math.max(8, Math.floor(this.map.size * 0.1));
    for (const [k, e] of this.map) {
      this.map.delete(k);
      this.px -= e.w * e.h;
      if (this.pool.length < 64) this.pool.push(e.page);
      this.evictions++;
      if (--n <= 0) break;
    }
  }

  canvasFor(w, h) {
    // reuse a pooled canvas when possible (avoids GC churn on iOS)
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const c = this.pool[i];
      if (c.width >= w && c.height >= h && c.width * c.height < w * h * 1.6) {
        this.pool.splice(i, 1);
        c.getContext('2d').clearRect(0, 0, c.width, c.height);
        return c;
      }
    }
    return makeCanvas(w, h);
  }

  // Build the quantized proxy + key for a unit. Returns the key string.
  quantize(u, t, hat) {
    const p = this.proxy;
    p.type = u.type; p.scale = u.scale; p.facing = 1; p.tier = u.tier; p.boss = u.boss;
    p.hitFlash = 0; p.controlled = false; p.stealth = false;
    p.carry = u.carry > 0 ? 1 : 0; p.carryKind = u.carryKind; p.braced = u.braced;
    p.anim = u.anim; p.atkKind = u.atkKind; p.channel = u.channel;
    // breathing / cloth time bucket (6 per breath cycle)
    const ib = Math.floor((((t + u.id) * 2.2) % TAU) / TAU * 6);
    const tq = (ib + 0.5) / 6 * TAU / 2.2;
    p.animT = tq; p.walkPhase = 0; p.atkT = -1; p.atkDur = 1; p.castT = -1;
    let k = `${u.type}${u.team}${u.tier || 0}${u.boss ? 'B' : ''}${u.braced ? 1 : 0}${p.carry ? u.carryKind : ''}${u.team === 0 && hat ? hat : ''}|${u.anim}|`;
    let phaseT = tq;
    if (u.atkT >= 0 && u.atkDur > 0) {
      const b = Math.min(9, Math.floor(u.atkT / u.atkDur * 10));
      p.atkT = (b + 0.5) / 10; p.atkDur = 1;
      k += `a${u.atkKind}${b}`;
    } else if (u.anim === 'walk' || u.anim === 'run' || u.anim === 'carry' || u.anim === 'dash') {
      const b = Math.floor((((u.walkPhase % TAU) + TAU) % TAU) / TAU * 14);
      p.walkPhase = (b + 0.5) / 14 * TAU;
      phaseT = b * 0.07;
      k += `w${b}`;
    } else if (u.anim === 'mine') {
      const b = Math.floor((u.animT % 0.6) / 0.6 * 10);
      p.animT = (b + 0.5) / 10 * 0.6;
      k += `m${b}`;
    } else if (u.castT >= 0) {
      const ch = Math.max(0.3, u.channel || 1.3);
      const b = Math.min(3, Math.floor(u.castT / ch * 4));
      p.castT = (b + 0.5) / 4 * ch;
      k += `c${b}${ib % 3}`;
    } else {
      k += `i${ib}`;
    }
    p.t = phaseT;
    return k;
  }

  // Returns a sprite entry {page, w, h, ox, oy} for the unit's current frame.
  get(u, t, colors, hat) {
    const key = this.quantize(u, t, hat);
    let e = this.map.get(key);
    if (e) {
      if (e.f !== this.frame) { e.f = this.frame; this.map.delete(key); this.map.set(key, e); }
      return e;
    }
    const box = BOX[u.type] || BOX.default;
    const k = this.ppu * u.scale;
    const w = Math.ceil((box[2] - box[0]) * k) + 2, h = Math.ceil((box[3] - box[1]) * k) + 2;
    if (this.px + w * h > this.budget) this.evict();
    const c = this.canvasFor(w, h);
    const ox = -box[0] * k + 1, oy = -box[1] * k + 1;
    const ctx = c.getContext('2d');
    ctx.setTransform(this.ppu, 0, 0, this.ppu, ox, oy);
    const p = this.proxy;
    drawUnit(ctx, p, 0, 0, p.t, colors, { hat: u.team === 0 ? hat : null });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    e = { page: c, sx: 0, sy: 0, w, h, ox, oy, f: this.frame };
    this.map.set(key, e);
    this.px += w * h;
    return e;
  }
}
