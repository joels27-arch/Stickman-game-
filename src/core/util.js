// Small math + RNG helpers shared by simulation and rendering.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v < 0 ? -1 : 1);
export const smooth = (t) => t * t * (3 - 2 * t);
export const TAU = Math.PI * 2;

// Seedable PRNG (mulberry32) so headless balance sims are reproducible.
export function makeRng(seed = 1234567) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (a, b) => a + rng() * (b - a);
  rng.int = (a, b) => Math.floor(a + rng() * (b - a + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  return rng;
}

// Fixed-size object pool: acquire() reuses dead objects, never allocates past max.
export class Pool {
  constructor(factory, max) {
    this.items = [];
    this.factory = factory;
    this.max = max;
    this.cursor = 0;
  }
  acquire() {
    const items = this.items;
    if (items.length < this.max) {
      const o = this.factory();
      items.push(o);
      o.active = true;
      return o;
    }
    // reuse a dead slot, else recycle the oldest (round-robin)
    for (let i = 0; i < items.length; i++) {
      const idx = (this.cursor + i) % items.length;
      if (!items[idx].active) {
        this.cursor = (idx + 1) % items.length;
        items[idx].active = true;
        return items[idx];
      }
    }
    const o = items[this.cursor];
    this.cursor = (this.cursor + 1) % items.length;
    o.active = true;
    return o;
  }
  forEach(fn) {
    const items = this.items;
    for (let i = 0; i < items.length; i++) if (items[i].active) fn(items[i]);
  }
  count() {
    let n = 0;
    for (const o of this.items) if (o.active) n++;
    return n;
  }
  clear() {
    for (const o of this.items) o.active = false;
  }
}
