import type { VisualDef } from '../maptypes';
import { C, MapBuilder, V, Y } from './builder';

/**
 * MAP 4 — LAVA PANIC (survival, medium)
 * A volcanic arena laid out on six spokes around a central start disc.
 * The lava starts rising at 8 s and keeps climbing, so players have to work
 * their way up: start disc (0 m) → ring rocks (0.8 m) → mid decks (3.6 m) →
 * rim towers (6.6 m) → the Crown Peak (9.4 m), the only spot the lava never
 * reaches. Ramps join the levels on the even spokes; on the odd spokes, blue
 * rock rafts carry riders diagonally up to lonely towers. Rocks collapse on a
 * schedule, sweepers switch on as the round goes on, and the peak gets its own
 * sweeper at the very end, so a final always produces a last one standing.
 *
 * Lava timeline (killY): start disc floods ≈45 s, ring ≈51 s, mid decks ≈71 s,
 * rim towers ≈94 s, then it stops at 7.8 m (below the peak) at ≈102 s.
 */
export function lavaPanic() {
  const m = new MapBuilder();
  const deg = (d: number) => (d * Math.PI) / 180;
  const at = (r: number, a: number, y: number) => V(r * Math.sin(a), y, r * Math.cos(a));
  const spoke = (k: number) => deg(k * 60);

  const ROCK: VisualDef = { style: 'lava-rock', color: 0x6e4a40, color2: 0xff7a1a };
  const CRACKED: VisualDef = { style: 'lava-rock', color: 0x8a3226, color2: 0xffb13c };
  const RAMP: VisualDef = { style: 'stripe', color: 0xffa93c, color2: 0xfff1d6 };
  const MID: VisualDef = { style: 'checker', color: 0xff8a3c, color2: 0xffe0b0 };
  const HIGH: VisualDef = { style: 'platform', color: 0xffd23f };
  const RAFT: VisualDef = { style: 'stripe', color: 0x3fb7ff, color2: 0xffffff };
  const SUPPORT: VisualDef = { style: 'lava-rock', color: 0x4a2c2a, color2: 0xff5a1a, noShadow: true };
  const FLOOR_Y = -7;

  /** Ramp along spoke angle `a` from (r0, y0) to (r1, y1) — tops given. */
  const ramp = (a: number, r0: number, y0: number, r1: number, y1: number, w: number) => {
    const th = 1;
    const dr = r1 - r0, dy = y1 - y0;
    const len = Math.hypot(dr, dy);
    const pitch = -Math.atan2(dy, dr);
    const rc = (r0 + r1) / 2 - (th / 2) * Math.sin(pitch);
    const yc = (y0 + y1) / 2 - (th / 2) * Math.cos(pitch);
    m.box(at(rc, a, yc), w, th, len + 0.05, RAMP, { rot: [a, pitch, 0], visual: { round: 0.2 } });
  };
  /** Volcanic column holding a platform up out of the lava. */
  const support = (x: number, z: number, r: number, bottomOfPlatform: number) => {
    const h = bottomOfPlatform - FLOOR_Y + 1;
    m.cyl(V(x, FLOOR_Y - 1 + h / 2, z), r, h, SUPPORT);
  };
  /** Spinning sweeper bar (+ post) on a platform; optional late activation. */
  const sweeper = (x: number, top: number, z: number, length: number, speed: number, activeFrom?: number, phase = 0, height = 0.6, knock = 1.05) => {
    m.box(V(x, top + height, z), length, 0.55, 0.55, { style: 'beam', color: C.yellow, color2: 0xe8433a }, {
      motion: { spin: { axis: Y, speed, phase } }, knock, activeFrom,
    });
    m.cyl(V(x, top + 0.8 + (height - 0.6), z), 0.6, 1.6 + (height - 0.6) * 2, { style: 'pillar', color: 0xe8433a }, { activeFrom });
  };
  /** Knee-high rail (0.7 m) between two points on a platform top: forgiving edges, easy to hop. */
  const RAIL: VisualDef = { style: 'wall', color: 0xffe0b0, color2: 0xff9a3c, round: 0.15 };
  const rail = (x0: number, z0: number, x1: number, z1: number, top: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    m.box(V((x0 + x1) / 2, top + 0.35, (z0 + z1) / 2), 0.4, 0.7, len, RAIL, { rot: [Math.atan2(x1 - x0, z1 - z0), 0, 0] });
  };

  // ---------------------------------------------------------------- start disc (top 0)
  m.disc(0, 0, 0, 7, { style: 'start', color: 0xff7a2f, color2: 0xffc35c }, { thick: 1.4 });
  support(0, 0, 4.5, -1.4);
  m.checkpoint(V(-7.5, -1, -7.5), V(7.5, 6, 7.5), V(0, 0.2, 0), 0);
  // Rails around the start disc, open where the six bridges leave.
  for (let k = 0; k < 6; k++) {
    for (let j = 0; j < 2; j++) {
      const a0 = deg(k * 60 + 15 + j * 15), a1 = deg(k * 60 + 30 + j * 15);
      const p0 = at(6.75, a0, 0), p1 = at(6.75, a1, 0);
      rail(p0.x, p0.z, p1.x, p1.z, 0);
    }
  }
  // A sweeper rises out of the start disc once everyone has had time to leave.
  sweeper(0, 0, 0, 13.4, 0.75, 20, 0, 0.6, 0.6); // gentle nudge: it herds players outward rather than flinging them

  // ---------------------------------------------------------------- the six spokes
  const RING_R = 11.5, RING_RAD = 3.2, RING_TOP = 0.8;
  const MID_R = 21, MID_TOP = 3.6;
  const HIGH_R = 31.2, HIGH_TOP = 6.6;
  const ringFall: Record<number, number> = { 1: 30, 3: 36, 5: 42 };
  const highOddFall: Record<number, number | undefined> = { 1: 78, 3: 84, 5: undefined };

  for (let k = 0; k < 6; k++) {
    const a = spoke(k);
    // Bridge ramp: start disc → ring rock.
    ramp(a, 6.4, 0, 8.6, RING_TOP, 3);
    // Ring rock (odd ones crack and drop on a schedule).
    const rp = at(RING_R, a, 0);
    const fall = ringFall[k];
    m.disc(rp.x, RING_TOP, rp.z, RING_RAD, fall !== undefined ? CRACKED : ROCK, { thick: 1.4, fallAt: fall });
    if (fall === undefined) support(rp.x, rp.z, 2.2, RING_TOP - 1.4);

    if (k % 2 === 0) {
      // Even spokes: ramp → mid deck → ramp → rim tower.
      ramp(a, 12.2, RING_TOP, 17.05, MID_TOP + 0.02, 3);
      const mp = at(MID_R, a, 0);
      const midFall = k === 4 ? 62 : undefined;
      m.plat(mp.x, MID_TOP, mp.z, 8, 8, MID, { rot: [a, 0, 0], thick: 1.4, fallAt: midFall });
      if (midFall === undefined) support(mp.x, mp.z, 2.8, MID_TOP - 1.4);
      for (const side of [-1, 1]) {
        // rails along both long sides of the deck (perpendicular offset 3.75 m), leaving the ramp ends open
        const ox = Math.cos(a) * side * 3.75, oz = -Math.sin(a) * side * 3.75;
        const q0 = at(MID_R - 3.2, a, 0), q1 = at(MID_R + 3.2, a, 0);
        rail(q0.x + ox, q0.z + oz, q1.x + ox, q1.z + oz, MID_TOP);
      }
      ramp(a, 23.1, MID_TOP, 28.25, HIGH_TOP + 0.02, 2.6);
      const hp = at(HIGH_R, a, 0);
      const highFall = k === 2 ? 88 : undefined;
      m.plat(hp.x, HIGH_TOP, hp.z, 6, 6, HIGH, { rot: [a, 0, 0], thick: 1.4, fallAt: highFall });
      if (highFall === undefined) support(hp.x, hp.z, 2.2, HIGH_TOP - 1.4);
    } else {
      // Odd spokes: a rock raft shuttles diagonally up to a lonely tower (hop on, hop off).
      const r0 = 17.3, r1 = 25.3;
      const p0 = at(r0, a, 0), p1 = at(r1, a, 0);
      m.plat(p0.x, 2.0, p0.z, 4, 4, RAFT, {
        rot: [a, 0, 0], thick: 0.9,
        motion: { move: { delta: V(p1.x - p0.x, 3.4, p1.z - p0.z), period: 9, phase: k * 0.17, hold: 0.18 } },
      });
      const hp = at(29.6, a, 0);
      const hf = highOddFall[k];
      m.plat(hp.x, HIGH_TOP, hp.z, 5, 5, hf !== undefined ? CRACKED : HIGH, { rot: [a, 0, 0], thick: 1.4, fallAt: hf });
      if (hf === undefined) support(hp.x, hp.z, 1.8, HIGH_TOP - 1.4);
    }
  }

  // Hazards on the mid decks: one from the start, one switches on later.
  { const p = at(MID_R, spoke(2), 0); sweeper(p.x, MID_TOP, p.z, 7.4, 1.5, undefined, 0.4); }
  { const p = at(MID_R, spoke(4), 0); sweeper(p.x, MID_TOP, p.z, 7.4, -1.8, 40); }
  // Escalation on the rim: the north tower grows a sweeper late in the round.
  { const p = at(HIGH_R, spoke(0), 0); sweeper(p.x, HIGH_TOP, p.z, 5.6, 1.7, 60, 1.1); }

  // ---------------------------------------------------------------- Crown Peak (top 9.4), north
  ramp(0, 32.3, HIGH_TOP, 37.3, 9.42, 2.6);
  m.disc(0, 9.4, 40.4, 3.3, { style: 'checker', color: C.yellow, color2: 0xffffff }, { thick: 1.4 });
  support(0, 40.4, 2.4, 8.0);
  // The last word: a sweeper on the peak so a final always ends with one champion.
  sweeper(0, 9.4, 40.4, 6.2, 1.6, 96);
  sweeper(0, 9.4, 40.4, 6.2, -1.15, 104, 1.6, 1.25);

  // ---------------------------------------------------------------- bot standing points
  m.wp(0, 0, 0); m.wp(3, 0, -3); m.wp(-3, 0, 3); m.wp(4, 0, 2); m.wp(-4, 0, -2);
  for (let k = 0; k < 6; k++) {
    const a = spoke(k);
    const rp = at(RING_R, a, 0); m.wp(rp.x, RING_TOP, rp.z);
    if (k % 2 === 0) {
      const mp = at(MID_R, a, 0); m.wp(mp.x, MID_TOP, mp.z);
      const mq = at(MID_R + 2, a + 0.12, 0); m.wp(mq.x, MID_TOP, mq.z);
      const hp = at(HIGH_R, a, 0); m.wp(hp.x, HIGH_TOP, hp.z);
    } else {
      const hp = at(29.6, a, 0); m.wp(hp.x, HIGH_TOP, hp.z);
    }
  }
  m.wp(0, 9.4, 40.4); m.wp(1.2, 9.4, 39.4); m.wp(-1.2, 9.4, 41.2);

  // ---------------------------------------------------------------- decoration
  m.deco('volcano', -62, FLOOR_Y, 64, 1.6);
  m.deco('volcano', 74, FLOOR_Y, 28, 1.2);
  m.deco('volcano', 10, FLOOR_Y, -92, 2.2);
  m.deco('volcano', -80, FLOOR_Y, -40, 1.3);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + 0.13;
    const r = 46 + (i % 4) * 5;
    m.deco('rock', r * Math.sin(a), FLOOR_Y + 0.5, r * Math.cos(a), 1.6 + (i % 3) * 0.9, a);
    if (i % 3 === 0) m.deco('crystal', (r + 3) * Math.sin(a + 0.08), FLOOR_Y + 1.5, (r + 3) * Math.cos(a + 0.08), 1.4 + (i % 2));
  }
  // Glowing crystals on the solid supports at the rim.
  for (const k of [0, 2, 4]) {
    const p = at(HIGH_R + 3.6, spoke(k) + 0.35, 0);
    m.deco('crystal', p.x, HIGH_TOP - 4, p.z, 1.2);
  }

  return m.build({
    id: 'lava', name: 'Lava Panic', subtitle: 'The floor is lava. Climb!', mode: 'survival', difficulty: 2,
    theme: {
      skyTop: 0x1f0710, skyBottom: 0xff6a2a, fog: 0x6a2414, fogNear: 45, fogFar: 210, sun: 0xffb070, sunIntensity: 2.3,
      ambient: 0xffd2b0, hemiGround: 0xff5a1a, floor: 'lava', floorColor: 0xff5a1a, floorY: FLOOR_Y, sunDir: V(0.35, 1, 0.45),
      particles: 'embers',
    },
    spawn: { center: V(0, 0.2, 3.2), yaw: 0, cols: 6, spacing: 1.6 },
    killY: { base: -5, rise: 0.136, delay: 8.2, max: 7.8 },
    bounds: { min: V(-58, -20, -58), max: V(58, 60, 58) },
    timeLimit: 115,
    camYaw: 0,
    music: 'survival',
  });
}
