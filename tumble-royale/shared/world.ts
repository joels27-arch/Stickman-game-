import { DT, P_HEIGHT, Surf } from './constants';
import type { BodyDef, MapDef, ShapeDef } from './maptypes';
import {
  m3, m3Apply, m3ApplyT, m3FromAxisAngle, m3FromEuler, m3Mul, type M3, type V3, v3, vlen,
} from './math';

/** Runtime body: a BodyDef plus derived data (path clone index, bounds). */
export interface Body {
  id: number;
  def: BodyDef;
  shape: ShapeDef;
  surf: Surf;
  knock: number;
  moving: boolean;
  /** Index of this clone along def.path (path bodies only). */
  clone: number;
  pathLen: number;
  pathCum: number[];
  baseRot: M3;
  /** Static AABB covering the whole motion range, padded by the player size. */
  min: V3; max: V3;
  /** Bounding radius of the shape around its centre. */
  extent: number;
  /** Pose cache (see player.ts); cTick = NaN invalidates. */
  cTick: number; cP: V3; cR: M3;
}

const FALL_ACCEL = 22;
const FALL_DURATION = 2.5;
const GRID = 8;

const tmpM = m3();
const tmpM2 = m3();
const tmpV = v3();

export function shapeExtent(s: ShapeDef): number {
  if (s.kind === 'box') return Math.hypot(s.hx, s.hy, s.hz);
  if (s.kind === 'cyl') return Math.hypot(s.r, s.hy);
  return s.r;
}

/** killY(t) for maps with rising hazards. */
export function killHeight(map: MapDef, t: number): number {
  const k = map.killY;
  if (!k.rise) return k.base;
  const y = k.base + k.rise * Math.max(0, t - (k.delay ?? 0));
  return Math.min(k.max ?? Infinity, y);
}

export class World {
  readonly bodies: Body[] = [];
  private grid = new Map<number, Body[]>();
  /** bodyId → tick at which a player first stood on a trigger body (server authoritative). */
  readonly triggered = new Map<number, number>();

  setTriggered(id: number, tick: number | undefined) {
    if (tick === undefined) this.triggered.delete(id); else this.triggered.set(id, tick);
    const b = this.bodies[id];
    if (b) b.cTick = NaN;
  }

  constructor(readonly map: MapDef) {
    for (const def of map.bodies) {
      const count = def.path ? def.path.count : 1;
      for (let c = 0; c < count; c++) this.addBody(def, c);
    }
    for (const b of this.bodies) this.insert(b);
  }

  private addBody(def: BodyDef, clone: number) {
    const baseRot = m3();
    if (def.rot) m3FromEuler(baseRot, def.rot[0], def.rot[1], def.rot[2]);
    const pathCum: number[] = [0];
    let pathLen = 0;
    if (def.path) {
      for (let i = 1; i < def.path.pts.length; i++) {
        const a = def.path.pts[i - 1], b = def.path.pts[i];
        pathLen += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
        pathCum.push(pathLen);
      }
    }
    const m = def.motion;
    const body: Body = {
      id: this.bodies.length, def, shape: def.shape, surf: def.surf ?? Surf.Normal, knock: def.knock ?? 0,
      moving: !!(m?.spin || m?.swing || m?.move || def.path || def.fallAt !== undefined || def.trigger || def.cycle),
      clone, pathLen, pathCum, baseRot, min: v3(), max: v3(), extent: shapeExtent(def.shape),
      cTick: NaN, cP: v3(), cR: m3(),
    };
    this.computeBounds(body);
    this.bodies.push(body);
  }

  private computeBounds(b: Body) {
    const d = b.def;
    const pad = b.extent + P_HEIGHT + 0.2;
    let reach = 0;
    if (d.offset && (d.motion?.spin || d.motion?.swing)) reach = vlen(d.offset);
    const pts: V3[] = [];
    if (d.path) pts.push(...d.path.pts);
    else {
      const c = { x: d.pos.x, y: d.pos.y, z: d.pos.z };
      if (d.offset && !(d.motion?.spin || d.motion?.swing)) {
        c.x += d.offset.x; c.y += d.offset.y; c.z += d.offset.z;
      }
      pts.push(c);
      if (d.motion?.move) {
        const dl = d.motion.move.delta;
        pts.push({ x: c.x + dl.x, y: c.y + dl.y, z: c.z + dl.z });
      }
    }
    const min = b.min, max = b.max;
    min.x = min.y = min.z = Infinity; max.x = max.y = max.z = -Infinity;
    for (const p of pts) {
      min.x = Math.min(min.x, p.x - pad - reach); max.x = Math.max(max.x, p.x + pad + reach);
      min.y = Math.min(min.y, p.y - pad - reach); max.y = Math.max(max.y, p.y + pad + reach);
      min.z = Math.min(min.z, p.z - pad - reach); max.z = Math.max(max.z, p.z + pad + reach);
    }
    if (d.fallAt !== undefined || d.trigger) min.y -= 0.5 * FALL_ACCEL * FALL_DURATION * FALL_DURATION;
  }

  private insert(b: Body) {
    const x0 = Math.floor(b.min.x / GRID), x1 = Math.floor(b.max.x / GRID);
    const z0 = Math.floor(b.min.z / GRID), z1 = Math.floor(b.max.z / GRID);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const k = cellKey(x, z);
      let list = this.grid.get(k);
      if (!list) this.grid.set(k, (list = []));
      list.push(b);
    }
  }

  /** Bodies whose motion range can touch a player standing at (x, y, z). */
  query(x: number, y: number, z: number): Body[] {
    const list = this.grid.get(cellKey(Math.floor(x / GRID), Math.floor(z / GRID)));
    if (!list) return EMPTY;
    const out = queryBuf;
    out.length = 0;
    for (const b of list) {
      if (y < b.min.y - P_HEIGHT || y > b.max.y || x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z) continue;
      out.push(b);
    }
    return out;
  }

  /** Is the body solid at this tick (cycles, triggered drops, scheduled collapses, path clones off the path). */
  isActive(b: Body, tick: number): boolean {
    const d = b.def;
    const t = tick * DT;
    if (d.cycle) {
      const c = d.cycle, per = c.on + c.off;
      const u = (((t + c.phase) % per) + per) % per;
      if (u >= c.on) return false;
    }
    if (d.fallAt !== undefined && t > d.fallAt + FALL_DURATION) return false;
    if (d.trigger) {
      const tt = this.triggered.get(b.id);
      if (tt !== undefined && t > tt * DT + d.trigger.delay + FALL_DURATION) return false;
    }
    if (d.path) {
      const s = this.pathDistance(b, t);
      if (s < 0 || s > b.pathLen) return false;
    }
    return true;
  }

  /** Distance travelled along the path by this clone (negative or > length = off path). */
  pathDistance(b: Body, t: number): number {
    const p = b.def.path!;
    const cycleTime = p.interval * p.count;
    const u = ((((t + (p.phase ?? 0)) + b.clone * p.interval) % cycleTime) + cycleTime) % cycleTime;
    return u * p.speed;
  }

  /** Seconds since this trigger/scheduled body started falling, or -1 if it has not. */
  fallTime(b: Body, t: number): number {
    const d = b.def;
    if (d.fallAt !== undefined && t > d.fallAt) return t - d.fallAt;
    if (d.trigger) {
      const tt = this.triggered.get(b.id);
      if (tt !== undefined) {
        const start = tt * DT + d.trigger.delay;
        if (t > start) return t - start;
      }
    }
    return -1;
  }

  /** Writes the body's centre and rotation at a (possibly fractional) tick. */
  pose(b: Body, tick: number, P: V3, R: M3): void {
    const d = b.def;
    const t = tick * DT;
    if (d.path) {
      const s = Math.max(0, Math.min(b.pathLen, this.pathDistance(b, t)));
      const pts = d.path.pts, cum = b.pathCum;
      let i = 1;
      while (i < pts.length - 1 && cum[i] < s) i++;
      const seg = cum[i] - cum[i - 1] || 1;
      const f = (s - cum[i - 1]) / seg;
      const a = pts[i - 1], c = pts[i];
      P.x = a.x + (c.x - a.x) * f; P.y = a.y + (c.y - a.y) * f; P.z = a.z + (c.z - a.z) * f;
      // Rolling rotation (visual): about the axis perpendicular to travel.
      const dx = c.x - a.x, dz = c.z - a.z, dl = Math.hypot(dx, dz) || 1;
      const r = b.shape.kind === 'sphere' ? b.shape.r : 1;
      m3FromAxisAngle(R, dz / dl, 0, -dx / dl, s / r);
      return;
    }
    const m = d.motion;
    let rotated = false;
    if (m?.spin) {
      const a = m.spin.axis;
      m3FromAxisAngle(tmpM, a.x, a.y, a.z, m.spin.speed * t + (m.spin.phase ?? 0));
      rotated = true;
    }
    if (m?.swing) {
      const s = m.swing, a = s.axis;
      const ang = s.amp * Math.sin(Math.PI * 2 * (t / s.period + (s.phase ?? 0)));
      if (rotated) { m3FromAxisAngle(tmpM2, a.x, a.y, a.z, ang); m3Mul(tmpM, tmpM, tmpM2); }
      else m3FromAxisAngle(tmpM, a.x, a.y, a.z, ang);
      rotated = true;
    }
    if (rotated) {
      m3Mul(R, tmpM, b.baseRot);
      if (d.offset) { m3Apply(tmpV, tmpM, d.offset); P.x = d.pos.x + tmpV.x; P.y = d.pos.y + tmpV.y; P.z = d.pos.z + tmpV.z; }
      else { P.x = d.pos.x; P.y = d.pos.y; P.z = d.pos.z; }
    } else {
      R.set(b.baseRot);
      P.x = d.pos.x + (d.offset?.x ?? 0); P.y = d.pos.y + (d.offset?.y ?? 0); P.z = d.pos.z + (d.offset?.z ?? 0);
    }
    if (m?.move) {
      const mv = m.move;
      const f = moveEase(t / mv.period + (mv.phase ?? 0), mv.hold ?? 0);
      P.x += mv.delta.x * f; P.y += mv.delta.y * f; P.z += mv.delta.z * f;
    }
    const ft = this.fallTime(b, t);
    if (ft > 0) P.y -= 0.5 * FALL_ACCEL * ft * ft;
  }
}

/** 0→1→0 over one period with optional dwell at each end. */
export function moveEase(u: number, hold: number): number {
  u = ((u % 1) + 1) % 1;
  if (hold <= 0) return 0.5 - 0.5 * Math.cos(u * Math.PI * 2);
  const travel = 0.5 - hold;
  if (u < hold / 2) return 0;
  if (u < hold / 2 + travel) return 0.5 - 0.5 * Math.cos(((u - hold / 2) / travel) * Math.PI);
  if (u < hold * 1.5 + travel) return 1;
  if (u < hold * 1.5 + travel * 2) return 0.5 + 0.5 * Math.cos(((u - hold * 1.5 - travel) / travel) * Math.PI);
  return 0;
}

const cellKey = (x: number, z: number) => (x + 4096) * 8192 + (z + 4096);
const EMPTY: Body[] = [];
const queryBuf: Body[] = [];

/**
 * Closest-point contact between a sphere (world centre c, radius r) and a posed body.
 * Returns penetration depth (> 0 when overlapping) and writes the world-space push-out normal.
 */
const lc = v3();
export function sphereContact(b: Body, P: V3, R: M3, c: V3, r: number, nOut: V3): number {
  lc.x = c.x - P.x; lc.y = c.y - P.y; lc.z = c.z - P.z;
  const s = b.shape;
  if (s.kind === 'sphere') {
    const d = Math.hypot(lc.x, lc.y, lc.z);
    const depth = s.r + r - d;
    if (depth <= 0) return 0;
    if (d < 1e-6) { nOut.x = 0; nOut.y = 1; nOut.z = 0; }
    else { nOut.x = lc.x / d; nOut.y = lc.y / d; nOut.z = lc.z / d; }
    return depth;
  }
  m3ApplyT(lc, R, lc); // into body-local space
  let nx = 0, ny = 0, nz = 0, depth = 0;
  if (s.kind === 'box') {
    const qx = lc.x < -s.hx ? -s.hx : lc.x > s.hx ? s.hx : lc.x;
    const qy = lc.y < -s.hy ? -s.hy : lc.y > s.hy ? s.hy : lc.y;
    const qz = lc.z < -s.hz ? -s.hz : lc.z > s.hz ? s.hz : lc.z;
    const dx = lc.x - qx, dy = lc.y - qy, dz = lc.z - qz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > 1e-10) {
      if (d2 >= r * r) return 0;
      const d = Math.sqrt(d2);
      nx = dx / d; ny = dy / d; nz = dz / d; depth = r - d;
    } else {
      // Centre inside the box: push out through the nearest face.
      const px = s.hx - Math.abs(lc.x), py = s.hy - Math.abs(lc.y), pz = s.hz - Math.abs(lc.z);
      if (py <= px && py <= pz) { ny = lc.y >= 0 ? 1 : -1; depth = py + r; }
      else if (px <= pz) { nx = lc.x >= 0 ? 1 : -1; depth = px + r; }
      else { nz = lc.z >= 0 ? 1 : -1; depth = pz + r; }
    }
  } else {
    const rl = Math.hypot(lc.x, lc.z);
    const qy = lc.y < -s.hy ? -s.hy : lc.y > s.hy ? s.hy : lc.y;
    let qx = lc.x, qz = lc.z;
    if (rl > s.r) { qx = (lc.x / rl) * s.r; qz = (lc.z / rl) * s.r; }
    const dx = lc.x - qx, dy = lc.y - qy, dz = lc.z - qz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > 1e-10) {
      if (d2 >= r * r) return 0;
      const d = Math.sqrt(d2);
      nx = dx / d; ny = dy / d; nz = dz / d; depth = r - d;
    } else {
      const pr = s.r - rl, py = s.hy - Math.abs(lc.y);
      if (py <= pr || rl < 1e-6) { ny = lc.y >= 0 ? 1 : -1; depth = py + r; }
      else { nx = lc.x / rl; nz = lc.z / rl; depth = pr + r; }
    }
  }
  // back to world space
  tmpV.x = nx; tmpV.y = ny; tmpV.z = nz;
  m3Apply(nOut, R, tmpV);
  return depth;
}

/** Ray vs body (for the camera and bot probes). Returns hit distance or Infinity. Box/cyl/sphere via slab/approx tests. */
export function rayBody(b: Body, P: V3, R: M3, o: V3, dir: V3, maxDist: number, pad = 0): number {
  const s = b.shape;
  lc.x = o.x - P.x; lc.y = o.y - P.y; lc.z = o.z - P.z;
  if (s.kind === 'sphere') {
    const rr = s.r + pad;
    const bq = lc.x * dir.x + lc.y * dir.y + lc.z * dir.z;
    const cq = lc.x * lc.x + lc.y * lc.y + lc.z * lc.z - rr * rr;
    const disc = bq * bq - cq;
    if (disc < 0) return Infinity;
    const tt = -bq - Math.sqrt(disc);
    return tt >= 0 && tt <= maxDist ? tt : cq < 0 ? 0 : Infinity;
  }
  m3ApplyT(lc, R, lc);
  const ld = rd; m3ApplyT(ld, R, dir);
  let hx: number, hy: number, hz: number;
  if (s.kind === 'box') { hx = s.hx + pad; hy = s.hy + pad; hz = s.hz + pad; }
  else { hx = s.r + pad; hy = s.hy + pad; hz = s.r + pad; } // cylinder approximated by its box
  let tmin = 0, tmax = maxDist;
  const o3 = [lc.x, lc.y, lc.z], d3 = [ld.x, ld.y, ld.z], h3 = [hx, hy, hz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d3[i]) < 1e-9) { if (o3[i] < -h3[i] || o3[i] > h3[i]) return Infinity; continue; }
    let t1 = (-h3[i] - o3[i]) / d3[i], t2 = (h3[i] - o3[i]) / d3[i];
    if (t1 > t2) { const k = t1; t1 = t2; t2 = k; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}
const rd = v3();
