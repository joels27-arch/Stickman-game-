import {
  AIR_ACCEL, AIR_DECEL, Btn, COYOTE_TIME, DIVE_COOLDOWN, DIVE_HOP_AIR, DIVE_HOP_GROUND, DIVE_SPEED, DIVE_STEER,
  DIVE_TACKLE_SPEED, DT, Ev, FALL_MULT, GETUP_TIME, GRAVITY, GROUND_ACCEL, GROUND_DECEL, ICE_ACCEL, ICE_DECEL,
  ICE_SPEED, JUMP_BUFFER, JUMP_VEL, KNOCK_MAX_AIR, KNOCK_THRESHOLD, KNOCK_TIME, MAX_FALL, MAX_HSPEED, MAX_UP, Mode,
  OVERSPEED_DECEL, P_RADIUS, P_SPHERES, RECOVER_TIME, RESPAWN_TIME, RUN_SPEED, SHOVE_RADIUS, SLIDE_FRICTION,
  SLIDE_MAX_TIME, SLIDE_MIN_TIME, Surf, TURN_RATE,
} from './constants';
import type { MapDef, Zone } from './maptypes';
import { angleDiff, m3, m3Apply, m3ApplyT, type V3, v3 } from './math';
import { type Body, killHeight, sphereContact, type World } from './world';

/** Everything the movement simulation needs to continue from a tick. Serialised field-by-field. */
export class PState {
  x = 0; y = 0; z = 0;
  vx = 0; vy = 0; vz = 0;
  yaw = 0;
  mode = Mode.Normal; modeT = 0;
  grounded = 0; groundId = -1; groundSurf = 0;
  coyote = 0; jumpBuf = 0; diveCd = 0; prevBtn = 0;
  pvx = 0; pvy = 0; pvz = 0;
  boostT = 0; cp = 0; airT = 0;
  /** Fractional tick (within the step) at which the finish line was crossed. */
  finishFrac = 0;
}

export const STATE_FIELDS = [
  'x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'mode', 'modeT', 'grounded', 'groundId', 'groundSurf', 'coyote',
  'jumpBuf', 'diveCd', 'prevBtn', 'pvx', 'pvy', 'pvz', 'boostT', 'cp', 'airT', 'finishFrac',
] as const satisfies readonly (keyof PState)[];

export function copyState(o: PState, s: PState): PState {
  for (const k of STATE_FIELDS) (o as any)[k] = s[k];
  return o;
}

export interface Input { mx: number; mz: number; btn: number }
export const NO_INPUT: Input = { mx: 0, mz: 0, btn: 0 };

/** Inputs travel as int8; quantise before simulating so the client predicts with exactly what the server receives. */
export function quantizeInput(mx: number, mz: number, btn: number): Input {
  let l = Math.hypot(mx, mz);
  if (!Number.isFinite(l)) { mx = 0; mz = 0; l = 0; }
  if (l > 1) { mx /= l; mz /= l; }
  return { mx: Math.round(mx * 127) / 127, mz: Math.round(mz * 127) / 127, btn: btn & 3 };
}

export interface StepCtx {
  world: World;
  tick: number;
  /** Spawn slot, used to spread respawns. */
  slot: number;
  /** False during the countdown: players stand still. */
  canMove: boolean;
  /** Race: falling off respawns at the checkpoint. Survival: falling off takes you out. */
  respawn: boolean;
}

// Scratch, reused every call (the simulation is single-threaded).
const P0 = v3(), P1 = v3(), Pc = v3(), tv = v3(), tv2 = v3(), nrm = v3(), center = v3();
const R0 = m3(), R1 = m3();

/** Per-body pose cache keyed by tick so a step evaluates each nearby body once. */
function cachedPose(w: World, b: Body, tick: number) {
  if (b.cTick !== tick) { w.pose(b, tick, b.cP, b.cR); b.cTick = tick; }
}

/** Velocity of a body's material at world point p (finite difference over one tick). */
function pointVelocity(w: World, b: Body, tick: number, p: V3, out: V3): V3 {
  if (!b.moving) return out.x = out.y = out.z = 0, out;
  w.pose(b, tick - 1, P0, R0);
  w.pose(b, tick, P1, R1);
  tv.x = p.x - P1.x; tv.y = p.y - P1.y; tv.z = p.z - P1.z;
  m3ApplyT(tv2, R1, tv);         // local coords now
  m3Apply(tv, R0, tv2);          // where that material point was last tick
  out.x = (p.x - (P0.x + tv.x)) / DT;
  out.y = (p.y - (P0.y + tv.y)) / DT;
  out.z = (p.z - (P0.z + tv.z)) / DT;
  return out;
}

export function inZone(z: Zone, x: number, y: number, zz: number) {
  return x >= z.min.x && x <= z.max.x && y >= z.min.y && y <= z.max.y && zz >= z.min.z && zz <= z.max.z;
}

export function spawnPoint(map: MapDef, slot: number, out: V3): V3 {
  const s = map.spawn;
  const col = slot % s.cols, row = Math.floor(slot / s.cols);
  const lx = (col - (s.cols - 1) / 2) * s.spacing;
  const lz = -row * s.spacing;
  const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
  out.x = s.center.x + lx * c + lz * sn;
  out.z = s.center.z - lx * sn + lz * c;
  out.y = s.center.y;
  return out;
}

export function placeAtSpawn(map: MapDef, s: PState, slot: number) {
  const p = spawnPoint(map, slot, tv);
  Object.assign(s, new PState());
  s.x = p.x; s.y = p.y; s.z = p.z; s.yaw = map.spawn.yaw;
}

function respawnAt(map: MapDef, s: PState, slot: number) {
  const cp = map.checkpoints[s.cp] ?? null;
  const cpIdx = s.cp;
  if (!cp) { placeAtSpawn(map, s, slot); s.mode = Mode.Respawn; return; }
  const k = slot % 9;
  const lx = ((k % 3) - 1) * 1.3, lz = (Math.floor(k / 3) - 1) * 1.3;
  const c = Math.cos(cp.yaw), sn = Math.sin(cp.yaw);
  Object.assign(s, new PState());
  s.x = cp.spawn.x + lx * c + lz * sn;
  s.z = cp.spawn.z - lx * sn + lz * c;
  s.y = cp.spawn.y;
  s.yaw = cp.yaw;
  s.cp = cpIdx;
  s.mode = Mode.Respawn;
}

/** Move horizontal velocity toward the target with separate accel/decel and a gentle bleed for over-speed. */
function approach(s: PState, tx: number, tz: number, accel: number, decel: number, maxSpeed: number) {
  const sp = Math.hypot(s.vx, s.vz);
  if (sp > maxSpeed + 0.01 && tx * s.vx + tz * s.vz > 0) {
    // Moving faster than we could run (boost, knock, bounce): keep momentum, steer a little.
    const keep = Math.max(maxSpeed, sp - OVERSPEED_DECEL * DT);
    const dx = tx - s.vx * (maxSpeed / sp), dz = tz - s.vz * (maxSpeed / sp);
    s.vx += dx * Math.min(1, 3 * DT); s.vz += dz * Math.min(1, 3 * DT);
    const ns = Math.hypot(s.vx, s.vz) || 1;
    s.vx *= keep / ns; s.vz *= keep / ns;
    return;
  }
  const dx = tx - s.vx, dz = tz - s.vz;
  const dl = Math.hypot(dx, dz);
  if (dl < 1e-6) return;
  const into = tx * tx + tz * tz > 0.01;
  const a = (into ? accel : decel) * DT;
  if (dl <= a) { s.vx = tx; s.vz = tz; }
  else { s.vx += (dx / dl) * a; s.vz += (dz / dl) * a; }
}

function friction(s: PState, f: number) {
  const sp = Math.hypot(s.vx, s.vz);
  if (sp < 1e-6) return;
  const ns = Math.max(0, sp - f * DT);
  s.vx *= ns / sp; s.vz *= ns / sp;
}

function takeOff(s: PState) {
  // Inherit the platform's motion when leaving it so jumping off movers feels right.
  s.vx += s.pvx; s.vz += s.pvz;
  if (s.pvy > 0) s.vy += s.pvy;
  s.pvx = s.pvy = s.pvz = 0;
}

/**
 * Advance one player by one tick. Pure function of (world at tick, state, input):
 * the server runs it authoritatively and the client re-runs it for prediction.
 * Returns an Ev bitmask.
 */
export function stepPlayer(s: PState, inp: Input, ctx: StepCtx): number {
  const { world, tick } = ctx;
  const map = world.map;
  if (s.mode === Mode.Out) return 0;
  let ev = 0;
  const t = tick * DT;

  // 1. Ride the platform we stood on last tick.
  if (s.grounded && s.groundId >= 0) {
    const b = world.bodies[s.groundId];
    if (b.moving && world.isActive(b, tick)) {
      world.pose(b, tick - 1, P0, R0);
      world.pose(b, tick, P1, R1);
      tv.x = s.x - P0.x; tv.y = s.y - P0.y; tv.z = s.z - P0.z;
      m3ApplyT(tv2, R0, tv);
      m3Apply(tv, R1, tv2);
      const nx = P1.x + tv.x, ny = P1.y + tv.y, nz = P1.z + tv.z;
      s.pvx = (nx - s.x) / DT; s.pvy = (ny - s.y) / DT; s.pvz = (nz - s.z) / DT;
      s.x = nx; s.y = ny; s.z = nz;
      // Turn with spinning platforms (yaw of the body's local Z axis).
      const yaw0 = Math.atan2(R0[2], R0[8]), yaw1 = Math.atan2(R1[2], R1[8]);
      if (Math.abs(R1[5]) < 0.7) s.yaw += angleDiff(yaw0, yaw1);
    } else { s.pvx = s.pvy = s.pvz = 0; }
    if (b.surf === Surf.Conveyor) {
      const d = b.def.dir ?? { x: 0, y: 0, z: 1 };
      world.pose(b, tick, P1, R1);
      m3Apply(tv, R1, d);
      const pw = b.def.power ?? 3;
      s.x += tv.x * pw * DT; s.z += tv.z * pw * DT;
    }
  }

  // 2. Timers and input edges.
  s.modeT += DT;
  if (s.coyote > 0) s.coyote -= DT;
  if (s.jumpBuf > 0) s.jumpBuf -= DT;
  if (s.diveCd > 0) s.diveCd -= DT;
  if (s.boostT > 0) s.boostT -= DT;
  let mx = inp.mx, mz = inp.mz, btn = inp.btn;
  if (!ctx.canMove) { mx = 0; mz = 0; btn = 0; }
  const jumpPressed = (btn & Btn.Jump) !== 0 && (s.prevBtn & Btn.Jump) === 0;
  const divePressed = (btn & Btn.Dive) !== 0 && (s.prevBtn & Btn.Dive) === 0;
  s.prevBtn = btn;
  if (jumpPressed) s.jumpBuf = JUMP_BUFFER;
  const inLen = Math.hypot(mx, mz);
  const grounded = s.grounded === 1;
  const surf = grounded ? s.groundSurf : -1;

  // 3. Mode logic.
  switch (s.mode) {
    case Mode.Normal: {
      const ice = surf === Surf.Ice;
      const speed = ice ? ICE_SPEED : RUN_SPEED;
      const accel = grounded ? (ice ? ICE_ACCEL : GROUND_ACCEL) : AIR_ACCEL;
      const decel = grounded ? (ice ? ICE_DECEL : GROUND_DECEL) : AIR_DECEL;
      approach(s, mx * speed, mz * speed, accel, decel, speed);
      if (s.jumpBuf > 0 && (grounded || s.coyote > 0)) {
        s.vy = JUMP_VEL;
        if (grounded) takeOff(s);
        s.grounded = 0; s.groundId = -1; s.coyote = 0; s.jumpBuf = 0;
        ev |= Ev.Jump;
      } else if (divePressed && s.diveCd <= 0) {
        let dx: number, dz: number;
        if (inLen > 0.2) { dx = mx / inLen; dz = mz / inLen; }
        else { dx = Math.sin(s.yaw); dz = Math.cos(s.yaw); }
        const along = s.vx * dx + s.vz * dz;
        const hs = Math.max(DIVE_SPEED, along);
        s.vx = dx * hs; s.vz = dz * hs;
        if (grounded) { takeOff(s); s.vy = DIVE_HOP_GROUND; }
        else s.vy = Math.max(s.vy, DIVE_HOP_AIR);
        s.grounded = 0; s.groundId = -1; s.coyote = 0;
        s.mode = Mode.Dive; s.modeT = 0;
        s.yaw = Math.atan2(dx, dz);
        ev |= Ev.Dive;
      }
      break;
    }
    case Mode.Dive: {
      if (inLen > 0.2) {
        const cur = Math.atan2(s.vx, s.vz), want = Math.atan2(mx, mz);
        const d = Math.max(-DIVE_STEER * DT, Math.min(DIVE_STEER * DT, angleDiff(cur, want)));
        const c = Math.cos(d), sn = Math.sin(d);
        const vx = s.vx * c + s.vz * sn, vz = -s.vx * sn + s.vz * c;
        s.vx = vx; s.vz = vz;
      }
      if (grounded) { s.mode = Mode.Slide; s.modeT = 0; }
      break;
    }
    case Mode.Slide: {
      friction(s, surf === Surf.Ice ? 2 : SLIDE_FRICTION);
      if (s.modeT > SLIDE_MIN_TIME && s.jumpBuf > 0 && grounded) {
        s.mode = Mode.Normal; s.modeT = 0;
        s.vy = JUMP_VEL * 0.9; takeOff(s);
        s.grounded = 0; s.groundId = -1; s.jumpBuf = 0; s.diveCd = DIVE_COOLDOWN;
        ev |= Ev.Jump;
      } else if (s.modeT > SLIDE_MAX_TIME || (grounded && Math.hypot(s.vx, s.vz) < 1.2 && s.modeT > 0.1)) {
        s.mode = Mode.Getup; s.modeT = 0;
      }
      break;
    }
    case Mode.Getup:
      friction(s, 30);
      if (s.modeT > GETUP_TIME) { s.mode = Mode.Normal; s.modeT = 0; s.diveCd = DIVE_COOLDOWN; }
      break;
    case Mode.Knock:
      if (grounded) friction(s, surf === Surf.Ice ? 2 : 7);
      if ((s.modeT > KNOCK_TIME && grounded) || s.modeT > KNOCK_MAX_AIR) { s.mode = Mode.Recover; s.modeT = 0; }
      break;
    case Mode.Recover:
      friction(s, 30);
      if (s.modeT > RECOVER_TIME) { s.mode = Mode.Normal; s.modeT = 0; }
      break;
    case Mode.Respawn:
      s.vx = s.vz = 0; s.vy = Math.min(s.vy, 0);
      if (s.modeT > RESPAWN_TIME) { s.mode = Mode.Normal; s.modeT = 0; }
      break;
  }

  // 4. Gravity and wind.
  if (s.grounded && s.vy <= 0) s.vy = -2; // keep contact on slopes / descending movers
  else s.vy -= GRAVITY * (s.vy < 0 ? FALL_MULT : 1) * DT;
  for (const wz of map.wind) {
    if (!inZone(wz, s.x, s.y + 0.8, s.z)) continue;
    if (wz.cycle) {
      const per = wz.cycle.on + wz.cycle.off;
      const u = (((t + wz.cycle.phase) % per) + per) % per;
      if (u >= wz.cycle.on) continue;
    }
    const k = s.grounded ? 1 : 1.4;
    s.vx += wz.force.x * k * DT; s.vy += wz.force.y * DT; s.vz += wz.force.z * k * DT;
  }

  // 5. Integrate with collision, sub-stepping fast motion.
  const vyBefore = s.vy;
  const ridingId = s.grounded ? s.groundId : -1;
  const sp = Math.abs(s.vx) + Math.abs(s.vy) + Math.abs(s.vz);
  const n = Math.min(4, Math.max(1, Math.ceil((sp * DT) / 0.22)));
  const sub = 1 / n;
  let gId = -1, gNy = 0, gSurf = 0, gY = -Infinity;
  const px0 = s.x, py0 = s.y, pz0 = s.z;
  const near = world.query(s.x, s.y, s.z).slice();
  for (let k = 0; k < n; k++) {
    s.x += s.vx * DT * sub; s.y += s.vy * DT * sub; s.z += s.vz * DT * sub;
    for (let iter = 0; iter < 3; iter++) {
      let hit = false;
      for (const b of near) {
        if (!world.isActive(b, tick)) continue;
        cachedPose(world, b, tick);
        const BP = b.cP, BR = b.cR;
        for (let si = 0; si < 3; si++) {
          center.x = s.x; center.y = s.y + P_SPHERES[si]; center.z = s.z;
          const depth = sphereContact(b, BP, BR, center, P_RADIUS, nrm);
          if (depth <= 0) continue;
          hit = true;
          // Moving obstacles never shove a player down (into or through the floor): push sideways instead.
          if (nrm.y < 0 && b.moving) {
            const hl = Math.hypot(nrm.x, nrm.z);
            if (hl > 1e-3) { nrm.x /= hl; nrm.z /= hl; } else { nrm.x = 1; nrm.z = 0; }
            nrm.y = 0;
          }
          const push = Math.min(depth, 0.7);
          s.x += nrm.x * push; s.y += nrm.y * push; s.z += nrm.z * push;
          // Velocity response relative to the body's surface motion.
          let bvx = 0, bvy = 0, bvz = 0;
          if (b.moving && b.id !== ridingId) {
            Pc.x = center.x + nrm.x * push - nrm.x * P_RADIUS; Pc.y = center.y + nrm.y * push - nrm.y * P_RADIUS; Pc.z = center.z + nrm.z * push - nrm.z * P_RADIUS;
            pointVelocity(world, b, tick, Pc, tv);
            bvx = tv.x; bvy = tv.y; bvz = tv.z;
          }
          const bn = bvx * nrm.x + bvy * nrm.y + bvz * nrm.z;
          const vn = s.vx * nrm.x + s.vy * nrm.y + s.vz * nrm.z;
          if (vn < bn) {
            s.vx += nrm.x * (bn - vn); s.vy += nrm.y * (bn - vn); s.vz += nrm.z * (bn - vn);
          }
          if (nrm.y > 0.6 && si === 0) {
            // Prefer the most upward-facing contact; on ties prefer the higher surface (ice sheet on a floor).
            const cy = center.y - nrm.y * P_RADIUS;
            if (nrm.y > gNy + 0.05 || (nrm.y > gNy - 0.05 && cy > gY)) { gNy = nrm.y; gId = b.id; gSurf = b.surf; gY = cy; }
          } else if (nrm.y < -0.6 && s.vy > 0) {
            s.vy = 0; // bonk head
          }
          // Knockdown by fast obstacles.
          if (b.knock > 0 && bn - vn > KNOCK_THRESHOLD && s.mode !== Mode.Respawn) {
            const hl = Math.hypot(nrm.x, nrm.z) || 1;
            const hx = nrm.x / hl, hz = nrm.z / hl;
            const launch = Math.min(16, (bn * 1.25 + 3) * b.knock);
            s.vx = hx * launch + bvx * 0.3; s.vz = hz * launch + bvz * 0.3;
            s.vy = Math.max(s.vy, 4 + 2.5 * b.knock);
            if (s.mode !== Mode.Knock) ev |= Ev.Knock;
            s.mode = Mode.Knock; s.modeT = 0;
            s.grounded = 0;
          }
          if (b.surf === Surf.Bumper && Math.abs(nrm.y) < 0.6 && s.mode !== Mode.Respawn) {
            const hl = Math.hypot(nrm.x, nrm.z) || 1;
            const pw = b.def.power ?? 11;
            s.vx = (nrm.x / hl) * pw; s.vz = (nrm.z / hl) * pw; s.vy = Math.max(s.vy, 4.5);
            if (s.mode !== Mode.Knock) ev |= Ev.Bounce;
            s.mode = Mode.Knock; s.modeT = KNOCK_TIME * 0.55;
          }
        }
      }
      if (!hit) break;
    }
  }

  // 6. Ground state and surfaces.
  const wasGrounded = s.grounded === 1;
  if (gId >= 0 && s.vy <= 0.5 + (wasGrounded ? 3 : 0)) {
    s.grounded = 1; s.groundId = gId; s.groundSurf = gSurf; s.coyote = COYOTE_TIME;
    if (!wasGrounded) {
      ev |= Ev.Land;
      if (vyBefore < -17) ev |= Ev.BigLand;
      s.airT = 0;
      if (s.mode === Mode.Dive) { s.mode = Mode.Slide; s.modeT = 0; }
    }
    const b = world.bodies[gId];
    if (b.surf === Surf.Bounce) {
      s.vy = b.def.power ?? 17;
      s.grounded = 0; s.groundId = -1; takeOff(s);
      if (s.mode === Mode.Slide || s.mode === Mode.Getup) { s.mode = Mode.Normal; s.modeT = 0; }
      ev |= Ev.Bounce;
    } else if (b.surf === Surf.Boost) {
      world.pose(b, tick, P1, R1);
      m3Apply(tv, R1, b.def.dir ?? { x: 0, y: 0, z: 1 });
      const pw = b.def.power ?? 15;
      const along = s.vx * tv.x + s.vz * tv.z;
      if (along < pw) { s.vx += tv.x * (pw - along); s.vz += tv.z * (pw - along); }
      if (s.boostT <= 0) ev |= Ev.Boost;
      s.boostT = 0.5;
    }
  } else {
    if (wasGrounded && s.vy <= 0) takeOff(s);
    else if (wasGrounded) s.pvx = s.pvy = s.pvz = 0;
    s.grounded = 0; s.groundId = -1;
    s.airT += DT;
  }

  // 7. Clamp to sane speeds (anti-explosion).
  const hs = Math.hypot(s.vx, s.vz);
  if (hs > MAX_HSPEED) { s.vx *= MAX_HSPEED / hs; s.vz *= MAX_HSPEED / hs; }
  if (s.vy < -MAX_FALL) s.vy = -MAX_FALL;
  if (s.vy > MAX_UP) s.vy = MAX_UP;
  if (!Number.isFinite(s.x + s.y + s.z + s.vx + s.vy + s.vz)) { respawnAt(map, s, ctx.slot); return ev | Ev.FellOut | Ev.Respawned; }

  // 8. Facing.
  if (s.mode === Mode.Normal && inLen > 0.1) {
    const want = Math.atan2(mx, mz);
    const d = angleDiff(s.yaw, want);
    const mxTurn = TURN_RATE * DT;
    s.yaw += Math.max(-mxTurn, Math.min(mxTurn, d));
  } else if ((s.mode === Mode.Dive || s.mode === Mode.Slide) && hs > 1) {
    s.yaw = Math.atan2(s.vx, s.vz);
  }
  if (s.yaw > Math.PI) s.yaw -= Math.PI * 2;
  else if (s.yaw < -Math.PI) s.yaw += Math.PI * 2;

  // 9. Falling off, checkpoints, finish.
  const b = map.bounds;
  if (s.y < killHeight(map, t) || s.x < b.min.x || s.x > b.max.x || s.z < b.min.z || s.z > b.max.z || s.y < b.min.y) {
    ev |= Ev.FellOut;
    if (ctx.respawn) { respawnAt(map, s, ctx.slot); ev |= Ev.Respawned; }
    else { s.mode = Mode.Out; s.modeT = 0; }
    return ev;
  }
  for (let i = s.cp + 1; i < map.checkpoints.length; i++) {
    if (inZone(map.checkpoints[i], s.x, s.y + 0.5, s.z)) { s.cp = i; ev |= Ev.Checkpoint; }
  }
  if (map.finish && inZone(map.finish, s.x, s.y + 0.5, s.z)) {
    s.finishFrac = segmentEnterFraction(map.finish, px0, py0 + 0.5, pz0, s.x, s.y + 0.5, s.z);
    s.mode = Mode.Out; s.modeT = 0;
    ev |= Ev.Finish;
  }
  return ev;
}

/** Fraction (0..1) along the segment a→b at which it enters the box (for sub-tick finish ordering). */
export function segmentEnterFraction(z: Zone, ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  let tmin = 0;
  const a = [ax, ay, az], d = [bx - ax, by - ay, bz - az];
  const lo = [z.min.x, z.min.y, z.min.z], hi = [z.max.x, z.max.y, z.max.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) continue;
    let t1 = (lo[i] - a[i]) / d[i], t2 = (hi[i] - a[i]) / d[i];
    if (t1 > t2) { const k = t1; t1 = t2; t2 = k; }
    if (t1 > tmin) tmin = t1;
  }
  return Math.max(0, Math.min(1, tmin));
}

/**
 * Server-side shove between two players: separate overlapping capsules and
 * let a diving player bowl the other over. Returns true if b was tackled.
 */
export function shovePlayers(a: PState, b: PState): number {
  if (a.mode === Mode.Out || b.mode === Mode.Out || a.mode === Mode.Respawn || b.mode === Mode.Respawn) return 0;
  const dy = a.y - b.y;
  if (dy > 1.4 || dy < -1.4) return 0;
  const dx = b.x - a.x, dz = b.z - a.z;
  const d2 = dx * dx + dz * dz;
  if (d2 >= SHOVE_RADIUS * SHOVE_RADIUS) return 0;
  const d = Math.sqrt(d2) || 1e-3;
  const nx = d2 > 1e-8 ? dx / d : 1, nz = d2 > 1e-8 ? dz / d : 0;
  const overlap = SHOVE_RADIUS - d;
  // Standing on someone's head: let the upper one sit on top instead of shoving sideways.
  if (Math.abs(dy) > 1.0) {
    const top = dy > 0 ? a : b;
    if (top.vy < 0) { top.vy = 0; top.y += 0.02; top.grounded = 1; top.groundId = -1; top.coyote = COYOTE_TIME; }
    return 0;
  }
  a.x -= nx * overlap * 0.5; a.z -= nz * overlap * 0.5;
  b.x += nx * overlap * 0.5; b.z += nz * overlap * 0.5;
  // Exchange a little momentum along the normal.
  const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
  let result = 0;
  if (rel > 0) {
    const imp = rel * 0.5;
    a.vx -= nx * imp; a.vz -= nz * imp;
    b.vx += nx * imp; b.vz += nz * imp;
    const tackle = (p: PState, q: PState, sx: number) => {
      if (p.mode === Mode.Dive && rel > DIVE_TACKLE_SPEED && q.mode !== Mode.Knock) {
        q.mode = Mode.Knock; q.modeT = 0.25; q.vy = 4.5; q.grounded = 0;
        q.vx = nx * sx * 7; q.vz = nz * sx * 7;
        return true;
      }
      return false;
    };
    if (tackle(a, b, 1)) result = 2;
    else if (tackle(b, a, -1)) result = 1;
  }
  return result;
}
