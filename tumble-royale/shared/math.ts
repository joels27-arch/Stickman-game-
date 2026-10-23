// Minimal allocation-light vector/matrix helpers shared by client and server.
// The server never imports three.js; everything physics-related uses these.

export interface V3 { x: number; y: number; z: number }

export const v3 = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });
export const vset = (o: V3, x: number, y: number, z: number): V3 => { o.x = x; o.y = y; o.z = z; return o; };
export const vcopy = (o: V3, a: V3): V3 => { o.x = a.x; o.y = a.y; o.z = a.z; return o; };
export const vadd = (o: V3, a: V3, b: V3): V3 => { o.x = a.x + b.x; o.y = a.y + b.y; o.z = a.z + b.z; return o; };
export const vsub = (o: V3, a: V3, b: V3): V3 => { o.x = a.x - b.x; o.y = a.y - b.y; o.z = a.z - b.z; return o; };
export const vscale = (o: V3, a: V3, s: number): V3 => { o.x = a.x * s; o.y = a.y * s; o.z = a.z * s; return o; };
export const vdot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const vlen = (a: V3) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
export const vdist = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Shortest signed angle from a to b. */
export const angleDiff = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
export const lerpAngle = (a: number, b: number, t: number) => a + angleDiff(a, b) * t;

/**
 * Row-major 3x3 rotation matrix stored in 9 numbers.
 * Columns are the body's local X, Y, Z axes expressed in world space.
 */
export type M3 = Float64Array;
export const m3 = (): M3 => { const m = new Float64Array(9); m[0] = m[4] = m[8] = 1; return m; };

/** Rotation from yaw (Y), pitch (X), roll (Z) applied as R = Ry * Rx * Rz. */
export function m3FromEuler(o: M3, yaw: number, pitch: number, roll: number): M3 {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  // Ry * Rx
  const a00 = cy, a01 = sy * sp, a02 = sy * cp;
  const a10 = 0, a11 = cp, a12 = -sp;
  const a20 = -sy, a21 = cy * sp, a22 = cy * cp;
  // * Rz
  o[0] = a00 * cr + a01 * sr; o[1] = -a00 * sr + a01 * cr; o[2] = a02;
  o[3] = a10 * cr + a11 * sr; o[4] = -a10 * sr + a11 * cr; o[5] = a12;
  o[6] = a20 * cr + a21 * sr; o[7] = -a20 * sr + a21 * cr; o[8] = a22;
  return o;
}

/** Rotation of `angle` about a unit axis. */
export function m3FromAxisAngle(o: M3, ax: number, ay: number, az: number, angle: number): M3 {
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  o[0] = t * ax * ax + c; o[1] = t * ax * ay - s * az; o[2] = t * ax * az + s * ay;
  o[3] = t * ax * ay + s * az; o[4] = t * ay * ay + c; o[5] = t * ay * az - s * ax;
  o[6] = t * ax * az - s * ay; o[7] = t * ay * az + s * ax; o[8] = t * az * az + c;
  return o;
}

export function m3Mul(o: M3, a: M3, b: M3): M3 {
  const r0 = a[0] * b[0] + a[1] * b[3] + a[2] * b[6];
  const r1 = a[0] * b[1] + a[1] * b[4] + a[2] * b[7];
  const r2 = a[0] * b[2] + a[1] * b[5] + a[2] * b[8];
  const r3 = a[3] * b[0] + a[4] * b[3] + a[5] * b[6];
  const r4 = a[3] * b[1] + a[4] * b[4] + a[5] * b[7];
  const r5 = a[3] * b[2] + a[4] * b[5] + a[5] * b[8];
  const r6 = a[6] * b[0] + a[7] * b[3] + a[8] * b[6];
  const r7 = a[6] * b[1] + a[7] * b[4] + a[8] * b[7];
  const r8 = a[6] * b[2] + a[7] * b[5] + a[8] * b[8];
  o[0] = r0; o[1] = r1; o[2] = r2; o[3] = r3; o[4] = r4; o[5] = r5; o[6] = r6; o[7] = r7; o[8] = r8;
  return o;
}

/** o = M * v */
export function m3Apply(o: V3, m: M3, v: V3): V3 {
  const x = m[0] * v.x + m[1] * v.y + m[2] * v.z;
  const y = m[3] * v.x + m[4] * v.y + m[5] * v.z;
  const z = m[6] * v.x + m[7] * v.y + m[8] * v.z;
  o.x = x; o.y = y; o.z = z; return o;
}
/** o = M^T * v (inverse rotation) */
export function m3ApplyT(o: V3, m: M3, v: V3): V3 {
  const x = m[0] * v.x + m[3] * v.y + m[6] * v.z;
  const y = m[1] * v.x + m[4] * v.y + m[7] * v.z;
  const z = m[2] * v.x + m[5] * v.y + m[8] * v.z;
  o.x = x; o.y = y; o.z = z; return o;
}

/** Deterministic PRNG (mulberry32). Same seed → same sequence on client and server. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap integer hash → [0,1). Used for per-object deterministic variation. */
export function hash01(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
