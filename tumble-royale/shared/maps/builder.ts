import { Surf } from '../constants';
import type {
  BodyDef, BotWaypoint, Checkpoint, DecorDef, DecorKind, MapDef, MotionDef, VisualDef, WindZone, Zone,
} from '../maptypes';
import type { V3 } from '../math';

export const V = (x: number, y: number, z: number): V3 => ({ x, y, z });
export const X = V(1, 0, 0), Y = V(0, 1, 0), Z = V(0, 0, 1);

type Opt = Partial<Omit<BodyDef, 'shape' | 'pos' | 'visual'>> & { visual?: Partial<VisualDef> };

/** Fluent helper for authoring maps in code. Heights are given as TOP surface y where that is natural. */
export class MapBuilder {
  bodies: BodyDef[] = [];
  decor: DecorDef[] = [];
  checkpoints: Checkpoint[] = [];
  wind: WindZone[] = [];
  bot: BotWaypoint[] = [];
  finish?: Zone;

  add(b: BodyDef): BodyDef { this.bodies.push(b); return b; }

  /** Axis-aligned (optionally yawed/pitched) box given its centre and full size. */
  box(c: V3, w: number, h: number, d: number, visual: VisualDef, o: Opt = {}): BodyDef {
    const { visual: vo, ...rest } = o;
    return this.add({ shape: { kind: 'box', hx: w / 2, hy: h / 2, hz: d / 2 }, pos: c, visual: { ...visual, ...vo }, ...rest });
  }

  /** Platform with its top surface at `top`. */
  plat(x: number, top: number, z: number, w: number, d: number, visual: VisualDef, o: Opt & { thick?: number } = {}): BodyDef {
    const th = o.thick ?? 1.2;
    const { thick, ...rest } = o;
    return this.box(V(x, top - th / 2, z), w, th, d, { round: 0.25, ...visual }, rest);
  }

  /** Round platform (vertical cylinder) with top at `top`. */
  disc(x: number, top: number, z: number, r: number, visual: VisualDef, o: Opt & { thick?: number } = {}): BodyDef {
    const th = o.thick ?? 1.2;
    const { thick, visual: vo, ...rest } = o;
    return this.add({ shape: { kind: 'cyl', r, hy: th / 2 }, pos: V(x, top - th / 2, z), visual: { ...visual, ...vo }, ...rest });
  }

  cyl(c: V3, r: number, h: number, visual: VisualDef, o: Opt = {}): BodyDef {
    const { visual: vo, ...rest } = o;
    return this.add({ shape: { kind: 'cyl', r, hy: h / 2 }, pos: c, visual: { ...visual, ...vo }, ...rest });
  }

  sphere(c: V3, r: number, visual: VisualDef, o: Opt = {}): BodyDef {
    const { visual: vo, ...rest } = o;
    return this.add({ shape: { kind: 'sphere', r }, pos: c, visual: { ...visual, ...vo }, ...rest });
  }

  /** Straight ramp between two top-surface points (along Z, optional x shift ignored). */
  ramp(x: number, z0: number, y0: number, z1: number, y1: number, w: number, visual: VisualDef, o: Opt & { thick?: number } = {}): BodyDef {
    const th = o.thick ?? 1;
    const dz = z1 - z0, dy = y1 - y0;
    const len = Math.hypot(dz, dy);
    const pitch = -Math.atan2(dy, dz);
    // Centre sits half a thickness below the midpoint of the top surface.
    const cy = (y0 + y1) / 2 - (th / 2) * Math.cos(pitch);
    const cz = (z0 + z1) / 2 - (th / 2) * Math.sin(pitch);
    const { thick, ...rest } = o;
    return this.box(V(x, cy, cz), w, th, len + 0.02, { round: 0.2, ...visual }, { rot: [0, pitch, 0], ...rest });
  }

  /** Swinging hammer hanging from `pivot`, swinging across the X axis (path runs along Z). */
  hammer(pivot: V3, length: number, amp: number, period: number, phase: number, color = 0xff4f6d) {
    const motion: MotionDef = { swing: { axis: Z, amp, period, phase } };
    this.box(pivot, 0.35, length, 0.35, { style: 'beam', color: 0x8a5a3c }, { offset: V(0, -length / 2, 0), motion });
    this.add({
      shape: { kind: 'cyl', r: 1.0, hy: 1.35 }, pos: pivot, offset: V(0, -length, 0), rot: [0, 0, Math.PI / 2],
      motion, knock: 1.1, visual: { style: 'hammer', color, color2: 0xffffff },
    });
    this.cyl(V(pivot.x, pivot.y + 0.3, pivot.z), 0.5, 0.8, { style: 'pillar', color: 0x4a4f63 });
  }

  /** Spinning sweeper bar around a post. `height` is the bar centre above `top`. */
  sweeper(x: number, top: number, z: number, length: number, speed: number, height = 0.6, phase = 0, opts: { arms?: number; color?: number } = {}) {
    const arms = opts.arms ?? 1;
    for (let a = 0; a < arms; a++) {
      this.box(V(x, top + height, z), length, 0.55, 0.55, { style: 'beam', color: opts.color ?? 0xffcf3d, color2: 0xe8433a }, {
        motion: { spin: { axis: Y, speed, phase: phase + (a * Math.PI) / arms } }, knock: 1,
      });
    }
    this.cyl(V(x, top + 0.8, z), 0.7, 1.6, { style: 'pillar', color: 0xe8433a });
  }

  bounce(x: number, top: number, z: number, r = 1.3, power = 17) {
    return this.disc(x, top + 0.25, z, r, { style: 'bounce', color: 0x39d98a }, { thick: 0.5, surf: Surf.Bounce, power });
  }

  boost(x: number, top: number, z: number, w = 3, d = 4, yaw = 0, power = 15) {
    return this.plat(x, top + 0.06, z, w, d, { style: 'boost', color: 0x2fd4ff }, { thick: 0.12, surf: Surf.Boost, power, rot: [yaw, 0, 0] });
  }

  /** Balls rolling along a polyline, one every `interval` seconds. */
  roller(pts: V3[], r: number, speed: number, interval: number, phase = 0, style: 'ball' | 'snowball' = 'ball', color = 0xff5aa0, knock = 1.2) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z);
    const count = Math.ceil(len / speed / interval) + 1;
    return this.add({
      shape: { kind: 'sphere', r }, pos: pts[0], path: { pts, speed, interval, count, phase }, knock,
      visual: { style, color },
    });
  }

  checkpoint(min: V3, max: V3, spawn: V3, yaw = 0) { this.checkpoints.push({ min, max, spawn, yaw }); }
  setFinish(min: V3, max: V3) { this.finish = { min, max }; }
  windZone(min: V3, max: V3, force: V3, cycle?: { on: number; off: number; phase: number }) { this.wind.push({ min, max, force, cycle }); }
  wp(x: number, y: number, z: number, f: Partial<Omit<BotWaypoint, 'p'>> = {}) { this.bot.push({ p: V(x, y, z), ...f }); }
  deco(kind: DecorKind, x: number, y: number, z: number, scale = 1, yaw = 0, color?: number) { this.decor.push({ kind, pos: V(x, y, z), scale, yaw, color }); }

  build(meta: Omit<MapDef, 'bodies' | 'decor' | 'checkpoints' | 'wind' | 'botPath' | 'finish'>): MapDef {
    return { ...meta, bodies: this.bodies, decor: this.decor, checkpoints: this.checkpoints, wind: this.wind, botPath: this.bot, finish: this.finish };
  }
}

// Shared palette
export const C = {
  red: 0xff4f5e, orange: 0xff9a3c, yellow: 0xffd23f, green: 0x5ad86a, teal: 0x2fd4c4, blue: 0x3f8cff,
  purple: 0x9a6bff, pink: 0xff6fb5, white: 0xf7f3ff, cream: 0xfff3d6, grey: 0x9aa3b8, dark: 0x3a3f58,
};
export const RAINBOW = [C.red, C.orange, C.yellow, C.green, C.blue, C.purple];
