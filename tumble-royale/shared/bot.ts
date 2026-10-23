// Server-side bot driver. Bots are ordinary simulated players that produce
// Input values — they run through exactly the same movement code as humans and
// are always flagged as bots in the lobby and snapshots.

import { Btn, DT, Mode } from './constants';
import type { MapDef } from './maptypes';
import { m3, rng, v3 } from './math';
import type { Input, PState } from './player';
import { sphereContact, type World } from './world';

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
  private wanderX = 0; private wanderZ = 0;
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
      // Survival: drift between safe points, preferring ones with ground under them.
      if (--this.retarget <= 0 || !groundAt(world, this.wanderX, s.y + 0.5, this.wanderZ, tick + 30)) {
        this.retarget = 60 + Math.floor(this.r() * 120);
        const pts = map.botPath;
        let best = -1, bestScore = -Infinity;
        for (let k = 0; k < 6; k++) {
          const i = Math.floor(this.r() * pts.length);
          const p = pts[i].p;
          if (!groundAt(world, p.x, p.y + 0.5, p.z, tick + 60)) continue;
          const score = p.y * 2 - Math.hypot(p.x - s.x, p.z - s.z) * 0.15 + this.r();
          if (score > bestScore) { bestScore = score; best = i; }
        }
        if (best >= 0) { this.wanderX = pts[best].p.x + (this.r() - 0.5) * 2; this.wanderZ = pts[best].p.z + (this.r() - 0.5) * 2; }
      }
      tx = this.wanderX; tz = this.wanderZ; ty = s.y;
    }

    let dx = tx - s.x, dz = tz - s.z;
    let d = Math.hypot(dx, dz) || 1;
    let mx = dx / d, mz = dz / d;
    if (map.mode === 'survival' && d < 0.8) { mx *= 0.2; mz *= 0.2; }

    // Gap ahead? jump (if moving and grounded).
    if (s.grounded && Math.hypot(s.vx, s.vz) > 3) {
      const ax = s.x + mx * 1.3, az = s.z + mz * 1.3;
      if (!groundAt(world, ax, s.y + 0.4, az, tick)) {
        if (map.mode === 'race' && this.r() < 0.8 + this.skill * 0.2) wantJump = true;
        else if (map.mode === 'survival') { mx = -mx; mz = -mz; }
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
    // Dive across gaps at the top of a jump now and then; mostly harmless chaos otherwise.
    if (!s.grounded && s.vy < 1 && s.vy > -2 && s.mode === Mode.Normal && this.r() < 0.04 + this.skill * 0.05) {
      if (!groundAt(world, s.x + mx * 1.5, s.y, s.z + mz * 1.5, tick, 4)) { btn |= Btn.Dive; this.hold = 4; this.holdBtn = Btn.Dive; }
    }
    if (s.grounded && this.r() < 0.002) { btn |= Btn.Dive; this.hold = 3; this.holdBtn = Btn.Dive; }
    return { mx: Math.round(mx * 127) / 127, mz: Math.round(mz * 127) / 127, btn };
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

