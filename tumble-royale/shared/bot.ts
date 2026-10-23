// Server-side bot driver. Bots are ordinary simulated players that produce
// Input values — they run through exactly the same movement code as humans and
// are always flagged as bots in the lobby and snapshots.

import { Btn, DT, Mode } from './constants';
import type { MapDef } from './maptypes';
import { m3, rng, v3 } from './math';
import type { Input, PState } from './player';
import { killHeight, sphereContact, type World } from './world';

const P = v3(), N = v3(), C = v3();
const R = m3();

/** Is there something solid to stand on near (x, y, z)? */
export function groundAt(world: World, x: number, y: number, z: number, tick: number, depth = 2.5): boolean {
  for (let dy = 0.2; dy <= depth; dy += 0.55) {
    C.x = x; C.y = y - dy; C.z = z;
    for (const b of world.query(x, y - dy, z)) {
      if (!world.isActive(b, tick)) continue;
      world.pose(b, tick, P, R);
      if (sphereContact(b, P, R, C, 0.35, N) > 0) return true;
    }
  }
  return false;
}

const STEPS: [number, number][] = [[1.3, 3], [2.6, 2.5], [4.0, 2], [5.5, 1.5], [7.5, 1], [10, 0.7]];

/** Body id of the solid surface just below (x, y, z), or -1. */
export function surfaceAt(world: World, x: number, y: number, z: number, tick: number): number {
  C.x = x; C.y = y - 0.35; C.z = z;
  for (const b of world.query(x, y - 0.35, z)) {
    if (!world.isActive(b, tick)) continue;
    world.pose(b, tick, P, R);
    if (sphereContact(b, P, R, C, 0.3, N) > 0) return b.id;
  }
  return -1;
}

export class BotBrain {
  private r: () => number;
  private wp = 0;
  private lateral = 0;
  private hold = 0;
  private holdBtn = 0;
  private wait = 0;
  private stuckT = 0;
  private lastX = 0; private lastZ = 0;
  private retarget = 0;
  private wanderX = 0; private wanderZ = 0; private wanderY = -1e9;
  private dodge = 0; private dodgeT = 0;
  readonly skill: number;

  constructor(seed: number, skill?: number) {
    this.r = rng(seed);
    this.skill = skill ?? 0.55 + this.r() * 0.4;
    this.lateral = (this.r() - 0.5) * 3;
  }

  think(s: PState, world: World, tick: number): Input {
    const map = world.map;
    if (s.mode === Mode.Out) return { mx: 0, mz: 0, btn: 0 };
    if (map.mode === 'survival' && (this.tiles ??= world.bodies.some((b) => !!b.def.trigger))) return this.thinkTiles(s, world, tick);
    if (s.mode === Mode.Respawn) { this.resync(s, map); return { mx: 0, mz: 0, btn: 0 }; }
    let btn = 0;
    if (this.hold > 0) { this.hold--; btn = this.holdBtn; }
    if (this.wait > 0) { this.wait--; return { mx: 0, mz: 0, btn }; }

    let tx: number, tz: number, ty: number;
    let wantJump = false;
    if (map.mode === 'race') {
      const path = map.botPath;
      if (this.wp >= path.length) this.wp = path.length - 1;
      const w = path[this.wp];
      const rad = w.r ?? 2.2;
      tx = w.p.x + (w.r !== undefined ? 0 : this.lateral); tz = w.p.z; ty = w.p.y;
      if (this.dodgeT > 0) { this.dodgeT--; tx = s.x + this.dodge * 3; }
      const dx = tx - s.x, dz = tz - s.z;
      const d = Math.hypot(dx, dz);
      if (w.jump && d < 1.6 + this.r() * 0.4 && s.grounded) wantJump = true;
      if ((d < rad && Math.abs(s.y - ty) < 3) || s.z > tz + 1.5) {
        if (w.jump && s.grounded && d < 2.5) wantJump = true;
        this.wp = Math.min(path.length - 1, this.wp + 1);
        if (this.r() < 0.35) this.lateral = (this.r() - 0.5) * 3;
      }
    } else {
      // Survival: walk to a nearby standing point that will still be safe for a while
      // (ground under it now and in a few seconds, comfortably above any rising hazard).
      const safeAbove = killHeight(map, (tick + 15 * 60) * DT) + 1.2;
      const valid = this.wanderY > -1e8 && this.wanderY > killHeight(map, (tick + 6 * 60) * DT) + 0.6 &&
        groundAt(world, this.wanderX, this.wanderY + 0.5, this.wanderZ, tick + 30);
      if (--this.retarget <= 0 || !valid) {
        this.retarget = 90 + Math.floor(this.r() * 150);
        const pts = map.botPath;
        let best = -1, bestScore = -Infinity;
        for (let k = 0; k < 10; k++) {
          const i = Math.floor(this.r() * pts.length);
          const p = pts[i].p;
          if (!groundAt(world, p.x, p.y + 0.5, p.z, tick + 90)) continue;
          const dist = Math.hypot(p.x - s.x, p.z - s.z);
          const climb = p.y - s.y;
          let score = -dist * 0.12 + this.r() * 1.5;
          if (p.y < safeAbove) score -= 8 + (safeAbove - p.y);     // will be flooded soon
          if (climb > 2.5 && dist < 4) score -= 3;                   // straight up a wall: not reachable directly
          if (score > bestScore) { bestScore = score; best = i; }
        }
        if (best >= 0) {
          const p = pts[best].p;
          this.wanderX = p.x + (this.r() - 0.5) * 1.6; this.wanderZ = p.z + (this.r() - 0.5) * 1.6; this.wanderY = p.y;
        } else if (this.wanderY < -1e8) { this.wanderX = s.x; this.wanderZ = s.z; this.wanderY = s.y; }
      }
      tx = this.wanderX; tz = this.wanderZ; ty = this.wanderY;
    }

    let dx = tx - s.x, dz = tz - s.z;
    let d = Math.hypot(dx, dz) || 1;
    let mx = dx / d, mz = dz / d;
    if (map.mode === 'survival' && d < 1.2) { mx *= 0.25; mz *= 0.25; }

    // Gap ahead?
    if (map.mode === 'race') {
      if (s.grounded && Math.hypot(s.vx, s.vz) > 3) {
        const ax = s.x + mx * 1.3, az = s.z + mz * 1.3;
        if (!groundAt(world, ax, s.y + 0.4, az, tick) && this.r() < 0.8 + this.skill * 0.2) wantJump = true;
      }
    } else if (s.grounded) {
      // Survival: look ahead along the current velocity and the intended direction.
      const sp = Math.hypot(s.vx, s.vz);
      const look = 0.9 + sp * 0.12;
      const ax = s.x + mx * look, az = s.z + mz * look;
      if (!groundAt(world, ax, s.y + 0.4, az, tick + 10, 3)) {
        // A platform across a short gap (raft, next tile) and the target is over there: hop.
        const far = groundAt(world, s.x + mx * 3.2, ty + 0.5, s.z + mz * 3.2, tick + 25, 2.5) && d > 2.5 && ty - s.y < 1.6;
        if (far && this.r() < 0.6 + this.skill * 0.4) wantJump = true;
        else { mx = -s.vx * 0.3; mz = -s.vz * 0.3; this.retarget = Math.min(this.retarget, 20); } // brake at the edge
      }
    }

    // Hazards: look a fraction of a second ahead at knock-down obstacles.
    if ((tick + (this.lateral * 10 | 0)) % 4 === 0 && this.r() < this.skill) {
      const look = 10 + Math.floor(this.r() * 14);
      for (const b of world.query(s.x, s.y, s.z)) {
        if (!b.knock || !world.isActive(b, tick + look)) continue;
        world.pose(b, tick + look, P, R);
        const hx = P.x - (s.x + s.vx * look * DT), hz = P.z - (s.z + s.vz * look * DT);
        const hd = Math.hypot(hx, hz) - b.extent * 0.6;
        if (hd > (b.def.path ? 3.5 : 1.6)) continue;
        const rel = P.y - s.y;
        if (b.def.path && b.shape.kind === 'sphere') {
          // Rolling ball coming: sidestep away from its line.
          const side = s.x - P.x >= 0 ? 1 : -1;
          if (this.dodgeT <= 0) { this.dodge = side; this.dodgeT = 25; }
          continue;
        }
        if (rel < 1.1 && rel > -0.5 && s.grounded) wantJump = true;          // low sweeper: hop
        else if (rel >= 1.1 && rel < 3 && this.r() < 0.5) this.wait = 6 + Math.floor(this.r() * 12); // head height: hesitate
      }
    }

    // Stuck: hop and pick a new line.
    if (tick % 60 === 0) {
      const moved = Math.hypot(s.x - this.lastX, s.z - this.lastZ);
      this.lastX = s.x; this.lastZ = s.z;
      if (moved < 0.6 && map.mode === 'race') { this.stuckT++; if (this.stuckT > 1) { wantJump = true; this.lateral = (this.r() - 0.5) * 4; } }
      else this.stuckT = 0;
    }

    // Skill noise.
    const noise = (1 - this.skill) * 0.5;
    mx += (this.r() - 0.5) * noise; mz += (this.r() - 0.5) * noise;
    const l = Math.hypot(mx, mz) || 1;
    mx /= l; mz /= l;

    if (wantJump && this.hold <= 0 && (this.r() < 0.7 + this.skill * 0.3)) { btn |= Btn.Jump; this.hold = 6; this.holdBtn = Btn.Jump; }
    // Races: dive across gaps at the top of a jump now and then, plus a little harmless chaos.
    if (map.mode === 'race') {
      if (!s.grounded && s.vy < 1 && s.vy > -2 && s.mode === Mode.Normal && this.r() < 0.04 + this.skill * 0.05) {
        if (!groundAt(world, s.x + mx * 1.5, s.y, s.z + mz * 1.5, tick, 4)) { btn |= Btn.Dive; this.hold = 4; this.holdBtn = Btn.Dive; }
      }
      if (s.grounded && this.r() < 0.002) { btn |= Btn.Dive; this.hold = 3; this.holdBtn = Btn.Dive; }
    }
    return { mx: Math.round(mx * 127) / 127, mz: Math.round(mz * 127) / 127, btn };
  }

  private tiles: boolean | undefined;
  private dir = 0;
  private cx = 0; private cz = 0; private rim = 0;

  /**
   * Tile arenas (tiles drop after being stepped on): keep moving across fresh tiles.
   * Scores 12 headings by what lies under the next few steps, keeps momentum, avoids the rim.
   */
  private thinkTiles(s: PState, world: World, tick: number): Input {
    if (s.mode === Mode.Respawn) return { mx: 0, mz: 0, btn: 0 };
    if (!this.rim) {
      const pts = world.map.botPath;
      for (const w of pts) { this.cx += w.p.x / pts.length; this.cz += w.p.z / pts.length; }
      for (const w of pts) this.rim = Math.max(this.rim, Math.hypot(w.p.x - this.cx, w.p.z - this.cz));
      this.rim = Math.max(4, this.rim * 0.9);
      this.dir = this.r() * Math.PI * 2;
    }
    let btn = 0;
    if (this.hold > 0) { this.hold--; btn = this.holdBtn; }
    let best = this.dir, bestScore = -Infinity;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + (this.r() - 0.5) * 0.2;
      const sx = Math.sin(a), sz = Math.cos(a);
      let sc = 0;
      for (const [d, w] of STEPS) {
        const id = surfaceAt(world, s.x + sx * d, s.y + 0.3, s.z + sz * d, tick);
        if (id < 0) sc -= (d < 3 ? 4 : 1.5) * w;
        else if (world.triggered.has(id)) sc -= (d < 3 ? 2.5 : 1) * w;
        else sc += 1.5 * w;
      }
      sc += Math.cos(a - this.dir) * 2.0;
      const rr = Math.hypot(s.x + sx * 3 - this.cx, s.z + sz * 3 - this.cz);
      if (rr > this.rim) sc -= (rr - this.rim) * 1.5;
      sc += (this.r() - 0.5) * (1.2 - this.skill);
      if (sc > bestScore) { bestScore = sc; best = a; }
    }
    this.dir = best;
    const sx = Math.sin(best), sz = Math.cos(best);
    if (s.grounded && this.hold <= 0) {
      // Jump to bridge onto fresh tiles or over a low sweeper; running uses up tiles slowest.
      const near = surfaceAt(world, s.x + sx * 1.3, s.y + 0.3, s.z + sz * 1.3, tick);
      const far = surfaceAt(world, s.x + sx * 3.5, s.y + 0.3, s.z + sz * 3.5, tick);
      let jump = near < 0 && far >= 0 && !world.triggered.has(far) && this.r() < 0.5 + this.skill * 0.4;
      for (const b of world.query(s.x, s.y, s.z)) {
        if (!b.knock || !world.isActive(b, tick + 12)) continue;
        world.pose(b, tick + 12, P, R);
        if (P.y - s.y < 1.1 && P.y - s.y > -0.4) {
          const ax = R[0], az = R[6];
          const px = s.x - P.x, pz = s.z - P.z;
          const along = px * ax + pz * az, perp = Math.abs(px * az - pz * ax);
          if (perp < 1.4 && Math.abs(along) < b.extent && this.r() < this.skill) jump = true;
        }
      }
      if (jump) { btn |= Btn.Jump; this.hold = 5; this.holdBtn = Btn.Jump; }
    }
    // Walk briskly rather than sprint: sprinting burns through tiles twice as fast.
    const pace = 0.62 + this.r() * 0.15;
    return { mx: Math.round(sx * pace * 127) / 127, mz: Math.round(sz * pace * 127) / 127, btn };
  }

  /** After a respawn, continue from the first waypoint ahead of where we are. */
  resync(s: PState, map: MapDef) {
    const path = map.botPath;
    let i = 0;
    while (i < path.length - 1 && path[i].p.z < s.z - 0.5) i++;
    this.wp = i;
  }
}

export const BOT_NAMES = [
  'Bumble', 'Wobbles', 'Jellybean', 'Noodle', 'Pudding', 'Sprinkles', 'Waffles', 'Biscuit', 'Gizmo', 'Pickles',
  'Marshmallow', 'Doodle', 'Taco', 'Muffin', 'Pebble', 'Squishy', 'Bloop', 'Zippy', 'Tofu', 'Nugget', 'Boing',
  'Chonk', 'Fizz', 'Gumdrop', 'Kiwi', 'Mochi', 'Pip', 'Ziggy', 'Wiggle', 'Dumpling',
];

