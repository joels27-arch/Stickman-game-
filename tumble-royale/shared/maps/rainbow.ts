import { Surf } from '../constants';
import { C, MapBuilder, RAINBOW, V } from './builder';

/**
 * MAP 1 — RAINBOW RUSH (race, easy → medium)
 * Runway with boost pads → sliding platforms over water → hammer bridge →
 * twin stepping-stone routes (safe left, risky right with a boost) → ball slope
 * with a gutter → final sprint under a sweeper.
 */
export function rainbowRush() {
  const m = new MapBuilder();
  const stripe = (i: number) => ({ style: 'stripe' as const, color: RAINBOW[i % 6], color2: 0xffffff });

  // Start
  m.plat(0, 0, -2, 18, 16, { style: 'start', color: 0x7c5cff, color2: 0xb7a6ff }, { thick: 2 });
  m.checkpoint(V(-9, -1, -10), V(9, 6, 6), V(0, 0.2, 0), 0);
  m.deco('arch', 0, 0, 5.5, 1.2, 0, C.pink);

  // Runway (z 6..30)
  m.plat(0, 0, 18, 14, 24, stripe(0), { thick: 1.6 });
  m.boost(-3.2, 0, 13, 3, 4);
  m.boost(3.2, 0, 22, 3, 4);
  m.cyl(V(-5, 0.9, 25), 0.9, 1.8, { style: 'bumper', color: C.pink }, { surf: Surf.Bumper, power: 10 });
  m.cyl(V(4.5, 0.9, 9), 0.9, 1.8, { style: 'bumper', color: C.yellow }, { surf: Surf.Bumper, power: 10 });
  m.cyl(V(0, 0.9, 27.5), 0.9, 1.8, { style: 'bumper', color: C.teal }, { surf: Surf.Bumper, power: 10 });

  // Sliding platforms (rows at z 34 and 40)
  for (let i = 0; i < 3; i++) {
    m.plat(-9 + i * 6, 0, 34, 4, 4, stripe(i + 1), { motion: { move: { delta: V(6, 0, 0), period: 4.2, phase: i * 0.33, hold: 0.1 } } });
  }
  for (let i = 0; i < 2; i++) {
    m.plat(7 - i * 9, 0, 40, 5, 4, stripe(i + 4), { motion: { move: { delta: V(-7, 0, 0), period: 5, phase: i * 0.5, hold: 0.1 } } });
  }

  // Landing + checkpoint 1
  m.plat(0, 0, 47, 14, 6, { style: 'platform', color: C.cream });
  m.checkpoint(V(-7, -1, 44), V(7, 6, 50), V(0, 0.2, 47), 0);

  // Hammer bridge (z 50..86)
  m.plat(0, 0, 68, 9, 36, { style: 'stripe', color: C.blue, color2: 0xffffff }, { thick: 1.4 });
  const hz = [56, 64, 72, 80];
  hz.forEach((z, i) => {
    m.hammer(V(0, 6.6, z), 5.6, 1.0, 3.2, i * 0.27, RAINBOW[i]);
    m.box(V(-5.2, 3.3, z), 0.5, 6.6, 0.5, { style: 'pillar', color: 0x4a4f63 });
    m.box(V(5.2, 3.3, z), 0.5, 6.6, 0.5, { style: 'pillar', color: 0x4a4f63 });
    m.box(V(0, 6.9, z), 11, 0.5, 0.6, { style: 'beam', color: 0x4a4f63 });
  });

  // Checkpoint 2
  m.plat(0, 0, 89, 14, 6, { style: 'platform', color: C.cream });
  m.checkpoint(V(-7, -1, 86), V(7, 6, 92), V(0, 0.2, 89), 0);

  // Stepping stones: safe left route, risky right route ending on a boost.
  const left = [[96, 0.2], [101.2, 0.9], [106.4, 0.4], [111.6, 1.2]];
  left.forEach(([z, y], i) => m.disc(-4, y, z, 1.9, { style: 'platform', color: RAINBOW[i] }));
  m.disc(4.2, 0.4, 97.5, 1.5, { style: 'platform', color: C.red });
  m.disc(4.2, 1.0, 104.8, 1.5, { style: 'platform', color: C.orange });
  m.disc(4.2, 1.2, 112, 1.5, { style: 'platform', color: C.yellow });

  // Checkpoint 3 (z 116..124, top 1)
  m.plat(0, 1, 120, 14, 8, { style: 'platform', color: C.cream });
  m.boost(4.2, 1, 118.5, 3, 3);
  m.checkpoint(V(-7, 0, 116), V(7, 7, 124), V(0, 1.2, 120), 0);

  // Ball slope (gutter z 124..126, ramp z 126 → 160 rising 1 → 8)
  m.ramp(0, 126, 1, 160, 8, 14, { style: 'stripe', color: C.purple, color2: 0xd9c9ff });
  m.box(V(-7.4, 5.2, 143), 0.6, 2.6, 36, { style: 'wall', color: 0xffffff }, { rot: [0, -Math.atan2(7, 34), 0] });
  m.box(V(7.4, 5.2, 143), 0.6, 2.6, 36, { style: 'wall', color: 0xffffff }, { rot: [0, -Math.atan2(7, 34), 0] });
  const lanes = [-4.2, 0, 4.2];
  lanes.forEach((x, i) => {
    const r = 1.3;
    m.roller([V(x, 13, 161.5), V(x, 8 + r, 161.5), V(x, 1 + r, 126.2), V(x, -14, 125)], r, 9, 2.6, i * 0.85, 'ball', RAINBOW[(i * 2) % 6], 1.25);
    m.deco('tower', x, 13, 161.5, 0.8, 0, RAINBOW[(i * 2) % 6]);
  });

  // Top + checkpoint 4 (z 160..172, top 8)
  m.plat(0, 8, 166, 16, 12, { style: 'platform', color: C.cream }, { thick: 2 });
  m.checkpoint(V(-8, 7, 163), V(8, 14, 172), V(0, 8.2, 168), 0);

  // Final sprint (z 172..206) with a low sweeper and bumpers
  m.plat(0, 8, 189, 14, 34, { style: 'checker', color: C.yellow, color2: 0xffffff }, { thick: 1.6 });
  m.boost(-3, 8, 176, 3, 4);
  m.boost(3, 8, 176, 3, 4);
  m.sweeper(0, 8, 186, 13, 1.5, 0.55);
  m.cyl(V(-4, 8.9, 193), 0.9, 1.8, { style: 'bumper', color: C.pink }, { surf: Surf.Bumper, power: 10 });
  m.cyl(V(4, 8.9, 193), 0.9, 1.8, { style: 'bumper', color: C.teal }, { surf: Surf.Bumper, power: 10 });
  m.setFinish(V(-7, 7, 198), V(7, 14, 206));
  m.deco('arch', 0, 8, 198, 1.3, 0, C.yellow);

  // Bot route
  m.wp(0, 0, 10); m.wp(0, 0, 29.4, { jump: true }); m.wp(0, 0, 34.6); m.wp(0, 0, 36.2, { jump: true });
  m.wp(0, 0, 40); m.wp(0, 0, 42.2, { jump: true }); m.wp(0, 0, 48);
  m.wp(0, 0, 84); m.wp(-3.5, 0, 92.6, { jump: true }); m.wp(-4, 0.2, 96.5, { jump: true, r: 0.9 });
  m.wp(-4, 0.9, 101.6, { jump: true, r: 0.9 }); m.wp(-4, 0.4, 106.8, { jump: true, r: 0.9 }); m.wp(-4, 1.2, 112.2, { jump: true, r: 0.9 });
  m.wp(2.1, 1, 120); m.wp(2.1, 1, 123.4, { jump: true, r: 1.2 }); m.wp(2.1, 4, 140, { r: 1.5 }); m.wp(2.1, 8, 161, { r: 1.5 }); m.wp(0, 8, 166); m.wp(0, 8, 182); m.wp(0, 8, 200);

  // Decoration
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const z = -4 + i * 15;
    m.deco('island', side * (20 + (i % 3) * 4), -4 + (i % 4), z, 1 + (i % 3) * 0.3);
    m.deco('tree', side * (20 + (i % 3) * 4), -1 + (i % 4), z + 2, 1 + (i % 2) * 0.3);
    m.deco('balloon', side * (12 + (i % 4) * 3), 6 + (i % 5) * 2, z + 6, 1, 0, RAINBOW[i % 6]);
  }
  for (let i = 0; i < 18; i++) m.deco('cloud', ((i * 37) % 120) - 60, 18 + (i % 5) * 4, -30 + i * 14, 2 + (i % 3));
  for (let z = 8; z < 200; z += 12) { m.deco('flag', -7.5, z < 125 ? 0 : 8, z, 1, 0, RAINBOW[(z / 12) % 6 | 0]); }

  return m.build({
    id: 'rainbow', name: 'Rainbow Rush', subtitle: 'Race to the finish!', mode: 'race', difficulty: 1,
    theme: {
      skyTop: 0x3f8cff, skyBottom: 0xbfe6ff, fog: 0xbfe6ff, fogNear: 70, fogFar: 260, sun: 0xfff2dc, sunIntensity: 2.6,
      ambient: 0xffffff, hemiGround: 0x9ad0ff, floor: 'water', floorColor: 0x2fb5ff, floorY: -4, sunDir: V(-0.5, 1, -0.35),
      particles: 'petals',
    },
    spawn: { center: V(0, 0.2, 1), yaw: 0, cols: 6, spacing: 1.6 },
    killY: { base: -6 },
    bounds: { min: V(-45, -20, -25), max: V(45, 60, 240) },
    timeLimit: 150,
    camYaw: 0,
    music: 'race',
  });
}

