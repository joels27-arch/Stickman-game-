import { Surf } from '../constants';
import { C, MapBuilder, RAINBOW, V, X, Y, Z } from './builder';

/**
 * MAP 2 — SPINNING MADNESS (race, medium)
 * Sliding barriers → giant turntable under a sweeper → spinning logs over the
 * water → narrow bridges under windmill blades (or a risky bounce-pad shortcut
 * down the middle) → twin counter-rotating discs with riding bumpers → a final
 * gauntlet of sliding walls to the finish.
 */
export function spinningMadness() {
  const m = new MapBuilder();
  const candy = (c: number) => ({ style: 'stripe' as const, color: c, color2: 0xffffff });
  const spin = (speed: number, phase = 0) => ({ spin: { axis: Y, speed, phase } });

  // ---- Start (z -10..6)
  m.plat(0, 0, -2, 18, 16, { style: 'start', color: 0x9a6bff, color2: 0xd2c2ff }, { thick: 2 });
  m.checkpoint(V(-9, -1, -10), V(9, 6, 6), V(0, 0.2, 0), 0);
  m.deco('arch', 0, 0, 5.5, 1.2, 0, C.purple);

  // ---- Runway with sliding barriers (z 6..24)
  m.plat(0, 0, 15, 14, 18, candy(C.pink), { thick: 1.6 });
  m.box(V(-5, 1, 11), 4, 2, 0.6, { style: 'wall', color: C.yellow, color2: 0xffb52e }, { motion: { move: { delta: V(10, 0, 0), period: 4.4, hold: 0.12 } } });
  m.box(V(5, 1, 18), 4, 2, 0.6, { style: 'wall', color: C.teal, color2: 0x1fa89c }, { motion: { move: { delta: V(-10, 0, 0), period: 4.4, phase: 0.3, hold: 0.12 } } });
  m.boost(0, 0, 21.5, 3, 3);

  // ---- Giant turntable with a sweeper (disc r 11, z 25..47)
  m.disc(0, 0, 36, 11, { style: 'checker', color: 0xff6fb5, color2: 0xffffff }, { motion: spin(0.32), thick: 1.4 });
  m.sweeper(0, 0, 36, 20.5, -0.9, 0.6, 0, { color: 0xffd23f });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    // bumpers riding the turntable
    m.cyl(V(0, 0.8, 36), 0.8, 1.6, { style: 'bumper', color: RAINBOW[i * 2] }, { offset: V(Math.cos(a) * 6.5, 0, Math.sin(a) * 6.5), motion: spin(0.32), surf: Surf.Bumper, power: 9 });
  }

  // ---- Checkpoint 1 (z 47..55)
  m.plat(0, 0, 51, 14, 8, { style: 'platform', color: C.cream });
  m.checkpoint(V(-7, -1, 47), V(7, 6, 55), V(0, 0.2, 51.5), 0);

  // ---- Spinning logs over the water (z 55..79.5): three lanes of rolling logs along the course;
  // the spin carries you sideways, so counter-steer and hop from log to log.
  const lanes = [-4.2, 0, 4.2];
  const logZ = [61, 73];
  const logColors = [0xff8a3d, 0xb36bff, 0x3fb7ff];
  lanes.forEach((x, li) => logZ.forEach((z, k) => {
    m.add({
      shape: { kind: 'cyl', r: 1.0, hy: 4.5 }, pos: V(x, -0.3, z), rot: [0, Math.PI / 2, 0],
      motion: { spin: { axis: Z, speed: (li + k) % 2 ? 1.5 : -1.5 } }, visual: { style: 'log', color: logColors[li] },
    });
    for (const e of [-1, 1]) m.cyl(V(x, -0.3, z + e * 4.7), 0.55, 0.3, { style: 'pillar', color: 0x5a3f8f }, { rot: [0, Math.PI / 2, 0] });
  }));

  // ---- Checkpoint 2 (z 79.5..88.5)
  m.plat(0, 0, 84, 14, 9, { style: 'platform', color: C.cream });
  m.checkpoint(V(-7, -1, 79.5), V(7, 6, 88.5), V(0, 0.2, 84), 0);

  // ---- Narrow bridges under windmill blades (z 88.5..118), bounce shortcut down the middle
  for (const bx of [-4.2, 4.2]) {
    m.plat(bx, 0, 103.25, 1.8, 29.5, candy(bx < 0 ? C.blue : C.green), { thick: 0.8 });
    [95, 104, 113].forEach((z, i) => {
      const hub = V(bx, 2.95, z);
      m.box(hub, 0.5, 6.1, 0.5, { style: 'beam', color: 0xffffff, color2: bx < 0 ? C.blue : C.green }, { motion: { spin: { axis: Z, speed: bx < 0 ? 1.5 : -1.5, phase: i * 1.1 + (bx < 0 ? 0 : 0.6) } }, knock: 0.9 });
      m.cyl(V(bx, 2.95, z - 0.45), 0.45, 0.4, { style: 'pillar', color: 0x5a3f8f }, { rot: [0, Math.PI / 2, 0] });
      const ox = bx + Math.sign(bx) * 2.6;
      m.box(V(ox, -0.5, z - 0.9), 0.6, 7, 0.6, { style: 'pillar', color: 0x5a3f8f });
      m.box(V((bx + ox) / 2, 2.95, z - 0.9), Math.abs(ox - bx), 0.4, 0.4, { style: 'pillar', color: 0x5a3f8f });
    });
  }
  // risky middle: bounce pads on floating pods
  [[92, 15.5], [100.5, 15.5], [108.8, 17.5]].forEach(([z, pw]) => { m.disc(0, 0, z, 1.6, { style: 'platform', color: C.yellow }, { thick: 0.8 }); m.bounce(0, 0, z, 1.25, pw); });

  // ---- Checkpoint 3 (z 118..128)
  m.plat(0, 0, 121.75, 14, 12.5, { style: 'platform', color: C.cream });
  m.checkpoint(V(-7, -1, 116), V(7, 6, 128), V(0, 0.2, 123), 0);

  // ---- Twin counter-rotating discs (A: z 129..145, B: z 146..162)
  m.disc(0, 0, 137, 8, { style: 'checker', color: 0x3fb7ff, color2: 0xffffff }, { motion: spin(0.45), thick: 1.4 });
  m.sweeper(0, 0, 137, 15, -0.95, 0.6, 0, { arms: 2, color: 0xff6fb5 });
  m.disc(0, 0, 154, 8, { style: 'checker', color: 0x9a6bff, color2: 0xffffff }, { motion: spin(-0.45), thick: 1.4 });
  m.sweeper(0, 0, 154, 15, 1.1, 0.6, 1, { color: 0x2fd4c4 });

  // ---- Checkpoint 4 (z 163..171)
  m.plat(0, 0, 167, 14, 8, { style: 'platform', color: C.cream });
  m.checkpoint(V(-7, -1, 163), V(7, 6, 171), V(0, 0.2, 167.5), 0);

  // ---- Final gauntlet of sliding walls (z 171..210)
  m.plat(0, 0, 190.5, 14, 39, { style: 'checker', color: C.yellow, color2: 0xffffff }, { thick: 1.6 });
  [[178, 0], [186, 0.5], [194, 0.25]].forEach(([z, ph], i) => {
    m.box(V(-4.5, 1, z), 5, 2, 0.7, { style: 'wall', color: RAINBOW[i], color2: 0xffffff }, { motion: { move: { delta: V(4.5, 0, 0), period: 3.2, phase: ph, hold: 0.15 } } });
    m.box(V(4.5, 1, z), 5, 2, 0.7, { style: 'wall', color: RAINBOW[i + 3], color2: 0xffffff }, { motion: { move: { delta: V(-4.5, 0, 0), period: 3.2, phase: ph, hold: 0.15 } } });
  });
  m.boost(-3, 0, 174, 3, 3); m.boost(3, 0, 174, 3, 3);
  m.setFinish(V(-7, -1, 202), V(7, 8, 210));
  m.deco('arch', 0, 0, 202, 1.3, 0, C.pink);

  // ---- Bot route
  m.wp(0, 0, 8); m.wp(0, 0, 23.5); m.wp(3, 0, 30); m.wp(3, 0, 43); m.wp(0, 0, 51);
  m.wp(0, 0, 54.7, { jump: true, r: 0.9 });
  m.wp(0, 0.7, 58); m.wp(0, 0.7, 65.3, { jump: true, r: 0.9 }); m.wp(0, 0.7, 69.5); m.wp(0, 0.7, 77.2, { jump: true, r: 0.9 });
  m.wp(0, 0, 83); m.wp(-4.2, 0, 89.5, { r: 0.7 }); m.wp(-4.2, 0, 117.5, { r: 0.9 });
  m.wp(0, 0, 123); m.wp(0, 0, 127.6, { jump: true, r: 1 }); m.wp(3, 0, 134); m.wp(0, 0, 144.4, { jump: true, r: 1 });
  m.wp(3, 0, 150); m.wp(3, 0, 158); m.wp(0, 0, 162.2, { jump: true, r: 1 }); m.wp(0, 0, 168);
  m.wp(0, 0, 186); m.wp(0, 0, 206);

  // ---- Decoration
  for (let i = 0; i < 15; i++) {
    const side = i % 2 ? 1 : -1;
    const z = -6 + i * 15;
    m.deco('island', side * (21 + (i % 3) * 5), -4 + (i % 3), z, 1 + (i % 3) * 0.25);
    m.deco(i % 3 ? 'mushroom' : 'tree', side * (21 + (i % 3) * 5), -1 + (i % 3), z + 1.5, 1.2 + (i % 2) * 0.4);
    m.deco('crystal', side * (24 + (i % 3) * 5), -1.5 + (i % 3), z - 2, 1.3);
    m.deco('balloon', side * (11 + (i % 4) * 3), 6 + (i % 5) * 2, z + 5, 1, 0, RAINBOW[(i + 2) % 6]);
  }
  for (let i = 0; i < 20; i++) m.deco('cloud', ((i * 41) % 140) - 70, 20 + (i % 5) * 4, -30 + i * 13, 2 + (i % 3));
  for (let z = 8; z < 205; z += 14) { if (z > 86 && z < 120) continue; m.deco('flag', -7.6, 0, z, 1, 0, RAINBOW[(z / 14) % 6 | 0]); m.deco('flag', 7.6, 0, z + 7, 1, 0, RAINBOW[((z / 14) + 3) % 6 | 0]); }
  m.deco('stands', -14, -0.5, 190, 1, Math.PI / 2);
  m.deco('stands', 14, -0.5, 190, 1, -Math.PI / 2);

  return m.build({
    id: 'spinning', name: 'Spinning Madness', subtitle: 'Keep your balance!', mode: 'race', difficulty: 2,
    theme: {
      skyTop: 0x4a2fc0, skyBottom: 0xffb3e6, fog: 0xe8c8ff, fogNear: 60, fogFar: 240, sun: 0xfff0f6, sunIntensity: 2.5,
      ambient: 0xffffff, hemiGround: 0xc9a6ff, floor: 'water', floorColor: 0x8a5cff, floorY: -4, sunDir: V(0.45, 1, -0.4),
      particles: 'sparkles',
    },
    spawn: { center: V(0, 0.2, 1), yaw: 0, cols: 6, spacing: 1.6 },
    killY: { base: -6 },
    bounds: { min: V(-50, -20, -25), max: V(50, 60, 240) },
    timeLimit: 150,
    camYaw: 0,
    music: 'race',
  });
}
