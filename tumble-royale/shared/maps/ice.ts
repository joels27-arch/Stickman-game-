import { Surf } from '../constants';
import { C, MapBuilder, V } from './builder';

/**
 * MAP 5 — ICE CHAOS (race, medium)
 * Ice rink with sliding ice blocks → snowball slope (gutter at the bottom) →
 * long downhill ice slide into a jump → twin cracking-ice bridges under snow
 * cannon fire → icy finale field with pushers and a last cannon → finish.
 */
export function iceChaos() {
  const m = new MapBuilder();
  const SNOW = 0xeef4ff, ICE = 0x5ec4ff, DEEP = 0x3f8cff;
  const snow = (o: { color?: number } = {}) => ({ style: 'checker' as const, color: o.color ?? 0xa9d8ff, color2: SNOW });
  const ice = { style: 'ice' as const, color: ICE };

  // ---- Start (z -10..6)
  m.plat(0, 0, -2, 18, 16, { style: 'start', color: 0x5aa8ff, color2: 0xd8ecff }, { thick: 2 });
  m.checkpoint(V(-9, -1, -10), V(9, 6, 6), V(0, 0.2, 0), 0);
  m.deco('arch', 0, 0, 5.5, 1.2, 0, 0x5aa8ff);
  m.deco('snowman', -7.5, 0, -7, 0.9);
  m.deco('snowman', 7.5, 0, -7, 0.9);

  // ---- Ice rink with sliding ice blocks (z 6..30)
  m.plat(0, 0, 18, 14, 24, ice, { thick: 1.6, surf: Surf.Ice });
  const blocks: [number, number, number][] = [[12, 3.4, 0], [19, 4.0, 0.45], [25.5, 3.0, 0.2]];
  for (const [z, period, phase] of blocks) {
    m.box(V(-5, 0.9, z), 3, 1.8, 2, { style: 'wall', color: DEEP, color2: 0x8fd0ff }, {
      motion: { move: { delta: V(10, 0, 0), period, phase, hold: 0.15 } }, knock: 0.6,
    });
  }

  // ---- Checkpoint 1 (z 30..36)
  m.plat(0, 0, 33, 16, 6, snow());
  m.checkpoint(V(-8, -1, 30), V(8, 6, 36), V(0, 0.2, 33), 0);

  // ---- Snowball slope: gutter z 36..38, ramp z 38 → 70 rising 0 → 6
  m.ramp(0, 38, 0, 70, 6, 14, { style: 'stripe', color: 0x8cc6ff, color2: 0xffffff });
  const slopeYaw = -Math.atan2(6, 32);
  m.box(V(-7.4, 4.0, 54), 0.6, 2.6, 33, { style: 'wall', color: 0xffffff, color2: 0xd6ebff }, { rot: [0, slopeYaw, 0] });
  m.box(V(7.4, 4.0, 54), 0.6, 2.6, 33, { style: 'wall', color: 0xffffff, color2: 0xd6ebff }, { rot: [0, slopeYaw, 0] });
  [-4.2, 0, 4.2].forEach((x, i) => {
    const r = 1.2;
    m.roller([V(x, 11, 71.5), V(x, 6 + r, 71.5), V(x, 0 + r, 38.2), V(x, -14, 37)], r, 9, 2.8, i * 0.9, 'snowball', 0xffffff, 1.15);
    m.deco('tower', x, 11, 71.5, 0.75, 0, [C.pink, C.blue, C.purple][i]);
  });

  // ---- Top + checkpoint 2 (z 70..80, top 6)
  m.plat(0, 6, 75, 16, 10, snow(), { thick: 2 });
  m.checkpoint(V(-8, 5, 72.5), V(8, 12, 80), V(0, 6.2, 77), 0);
  m.deco('snowman', -6.5, 6, 78, 0.8);

  // ---- Downhill ice slide (z 80 → 110, y 6 → 0) into a 4 m jump
  m.ramp(0, 80, 6, 110, 0, 10, { style: 'ice', color: ICE }, { surf: Surf.Ice });
  m.box(V(-5.3, 3.6, 95), 0.5, 1.6, 30.5, { style: 'wall', color: 0xffffff, color2: 0xd6ebff }, { rot: [0, Math.atan2(6, 30), 0] });
  m.box(V(5.3, 3.6, 95), 0.5, 1.6, 30.5, { style: 'wall', color: 0xffffff, color2: 0xd6ebff }, { rot: [0, Math.atan2(6, 30), 0] });
  m.boost(0, 0.05, 107.5, 3, 3, 0, 13);

  // ---- Landing + checkpoint 3 (z 114..122)
  m.plat(0, 0, 118, 16, 8, snow());
  m.checkpoint(V(-8, -1, 114), V(8, 6, 122), V(0, 0.2, 118.5), 0);
  m.deco('flag', -7.5, 0, 115, 1, 0, C.blue);
  m.deco('flag', 7.5, 0, 115, 1, 0, C.pink);

  // ---- Twin frozen bridges of cracking ice (z 122..152) under snow cannon fire
  for (const x of [-3.6, 3.6]) {
    for (let k = 0; k < 10; k++) {
      m.plat(x, 0, 123.5 + k * 3, 2.6, 2.9, { style: 'ice', color: k % 2 ? ICE : 0x9fe3ff }, {
        thick: 0.8, surf: Surf.Ice, trigger: { delay: 0.9, respawn: 3 },
      });
    }
  }
  // Center pillar of safe snow between the bridges halfway.
  m.disc(0, 0, 137, 1.4, { style: 'platform', color: C.pink });
  const cannon = (z: number, fromLeft: boolean, phase: number) => {
    const s = fromLeft ? -1 : 1;
    m.roller([V(s * 14, 1.1, z), V(-s * 14, 1.1, z), V(-s * 20, -12, z)], 0.75, 12, 3.1, phase, 'snowball', 0xffffff, 0.9);
    m.cyl(V(s * 15, 1.1, z), 0.85, 2.2, { style: 'cannon' }, { rot: [0, 0, Math.PI / 2] });
    m.box(V(s * 15, -1.5, z), 2.4, 3.6, 2.4, { style: 'platform', color: 0xdbe8f7 });
  };
  cannon(129, true, 0);
  cannon(137.5, false, 1.4);
  cannon(146, true, 0.7);

  // ---- Checkpoint 4 (z 152..160)
  m.plat(0, 0, 156, 16, 8, snow());
  m.checkpoint(V(-8, -1, 152), V(8, 6, 160), V(0, 0.2, 156.5), 0);

  // ---- Icy finale field (z 160..196) with pushing ice blocks and bumpers
  m.plat(0, 0, 178, 16, 36, { style: 'ice', color: 0x6ccaff }, { thick: 1.6, surf: Surf.Ice });
  m.box(V(-5.5, 1, 167), 4, 2, 2, { style: 'wall', color: DEEP, color2: 0x8fd0ff }, { motion: { move: { delta: V(11, 0, 0), period: 4.2, phase: 0, hold: 0.12 } }, knock: 0.6 });
  m.box(V(5.5, 1, 174), 4, 2, 2, { style: 'wall', color: DEEP, color2: 0x8fd0ff }, { motion: { move: { delta: V(-11, 0, 0), period: 3.6, phase: 0.3, hold: 0.12 } }, knock: 0.6 });
  m.box(V(-5.5, 1, 181), 4, 2, 2, { style: 'wall', color: DEEP, color2: 0x8fd0ff }, { motion: { move: { delta: V(11, 0, 0), period: 3.9, phase: 0.6, hold: 0.12 } }, knock: 0.6 });
  m.cyl(V(-3.5, 0.9, 188), 0.9, 1.8, { style: 'bumper', color: C.pink }, { surf: Surf.Bumper, power: 10 });
  m.cyl(V(3.5, 0.9, 188), 0.9, 1.8, { style: 'bumper', color: C.teal }, { surf: Surf.Bumper, power: 10 });
  m.cyl(V(0, 0.9, 191), 0.9, 1.8, { style: 'bumper', color: C.blue }, { surf: Surf.Bumper, power: 10 });
  cannon(185, false, 0.4);

  // ---- Finish (snow, z 196..206)
  m.plat(0, 0, 201, 16, 10, { style: 'checker', color: 0x5aa8ff, color2: 0xffffff });
  m.setFinish(V(-8, -1, 198), V(8, 7, 206));
  m.deco('arch', 0, 0, 198, 1.3, 0, 0xff6fb5);
  m.deco('snowman', -7, 0, 204, 1);
  m.deco('snowman', 7, 0, 204, 1);

  // ---- Bot route
  m.wp(0, 0, 9); m.wp(0, 0, 29); m.wp(2.1, 0, 34); m.wp(2.1, 0, 35.6, { jump: true, r: 1.2 });
  m.wp(2.1, 3, 54, { r: 1.5 }); m.wp(2.1, 6, 71, { r: 1.5 }); m.wp(0, 6, 79);
  m.wp(0, 3, 95, { r: 1.5 }); m.wp(0, 0.6, 109.3, { jump: true, r: 1.4 }); m.wp(0, 0, 117);
  m.wp(-3.6, 0, 121, { r: 0.9 }); m.wp(-3.6, 0, 137, { r: 0.9 }); m.wp(-3.6, 0, 151, { r: 0.9 });
  m.wp(0, 0, 156); m.wp(0, 0, 160); m.wp(1.5, 0, 185); m.wp(0, 0, 196); m.wp(0, 0, 202);

  // ---- Decoration: icebergs in the water, pine islands, snowmen, flags
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const z = -6 + i * 16;
    m.deco('iceberg', side * (22 + (i % 3) * 5), -4, z, 1 + (i % 3) * 0.4, i);
    m.deco('island', -side * (24 + (i % 4) * 3), -4.5 + (i % 3), z + 7, 0.9 + (i % 2) * 0.3);
    m.deco('pine', -side * (24 + (i % 4) * 3), -1.6 + (i % 3), z + 7, 1 + (i % 3) * 0.25);
    m.deco('pine', -side * (26 + (i % 4) * 3), -1.6 + (i % 3), z + 9, 0.8);
  }
  for (let i = 0; i < 16; i++) m.deco('cloud', ((i * 41) % 130) - 65, 20 + (i % 5) * 4, -30 + i * 16, 2 + (i % 3));
  for (let z = 10; z < 200; z += 14) {
    if (z > 36 && z < 80) continue;
    if (z > 122 && z < 152) continue;
    m.deco('flag', 7.8, 0, z, 1, 0, z % 28 ? C.blue : C.white);
  }
  m.deco('rock', -9, 0, 33, 0.7); m.deco('rock', 9, 0, 156, 0.7);

  return m.build({
    id: 'ice', name: 'Ice Chaos', subtitle: 'Slip, slide and stay on your feet!', mode: 'race', difficulty: 2,
    theme: {
      skyTop: 0x6fa8ff, skyBottom: 0xffe0f0, fog: 0xe6efff, fogNear: 60, fogFar: 240, sun: 0xfff4ea, sunIntensity: 2.4,
      ambient: 0xf2f6ff, hemiGround: 0xbfe0ff, floor: 'water', floorColor: 0x7fd3ff, floorY: -4, sunDir: V(0.45, 1, -0.4),
      particles: 'snow',
    },
    spawn: { center: V(0, 0.2, 1), yaw: 0, cols: 6, spacing: 1.6 },
    killY: { base: -6 },
    bounds: { min: V(-45, -20, -25), max: V(45, 60, 240) },
    timeLimit: 150,
    camYaw: 0,
    music: 'race',
  });
}
