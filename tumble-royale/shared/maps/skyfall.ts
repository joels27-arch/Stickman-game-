import { MapBuilder, V, X } from './builder';

/**
 * MAP 3 — SKY FALL (race, medium → hard), high above the clouds.
 * Cloud hops → three blinking bridges (two always solid) → elevators up a cliff
 * (or a risky side cloud with a jump pad) → gusty wind bridge with a gap →
 * jump pads to a higher tier → drifting cloud steps → crumbling tile road
 * (or a narrow boosted beam shortcut) → finish.
 */
export function skyFall() {
  const m = new MapBuilder();
  const pastel = [0xff9ad5, 0x8fe3ff, 0xfff08a, 0xb9a2ff, 0x9df5c0, 0xffc49a];
  const cloud = { style: 'cloud' as const, round: 0.75 };
  // (cloud platforms are white; pastel landings and a bluish cloud sea keep them readable)

  // ---------------------------------------------------------------- start (top 0)
  m.plat(0, 0, -2, 18, 16, { style: 'start', color: 0x5aa8ff, color2: 0xbfe2ff }, { thick: 2.4 });
  m.checkpoint(V(-9, -1, -10), V(9, 6, 6), V(0, 0.2, 0), 0);
  m.deco('arch', 0, 0, 5.5, 1.2, 0, 0x5aa8ff);

  // ---------------------------------------------------------------- A: cloud hops (z 6..41)
  m.plat(0, 0, 10, 12, 8, { style: 'stripe', color: 0x5ab8ff, color2: 0xffffff }, { thick: 1.6 });
  // Left lane: static clouds climbing gently.
  [[17, 0.4], [22.5, 0.9], [28, 1.4]].forEach(([z, y]) => m.plat(-3.5, y, z, 5, 4, cloud, { thick: 1.6 }));
  // Right lane: drifting clouds (slightly faster line, a bit trickier).
  [[17.5, 0.5, 0], [23, 1.0, 0.35], [28.5, 1.4, 0.7]].forEach(([z, y, ph]) =>
    m.plat(3.6, y, z, 4, 4, cloud, { thick: 1.6, motion: { move: { delta: V(2.4, 0, 0), period: 4, phase: ph } } }));
  m.boost(-3.5, 1.4, 28, 2.4, 2.6);

  m.plat(0, 1.5, 36.5, 14, 9, { style: 'platform', color: pastel[0] });
  m.checkpoint(V(-7, 0, 32), V(7, 7, 41), V(0, 1.7, 37), 0);

  // ---------------------------------------------------------------- B: blinking bridges (z 43..73, top 1.5)
  // Two wide lanes that blink (off 2 s of every 6, never both at once), and a narrow
  // always-solid beam between them: safe but you need to keep a steady line.
  [-4.4, 4.4].forEach((x, l) => {
    for (let k = 0; k < 3; k++) {
      m.plat(x, 1.5, 48 + k * 10, 3.2, 9.8, { style: 'platform', color: pastel[(l * 2 + 1) % 6] }, {
        thick: 0.8, cycle: { on: 4, off: 2, phase: l * 3 + k * 0.6, warn: 1 },
      });
    }
  });
  m.plat(0, 1.5, 58, 1.4, 30, { style: 'beam', color: 0xffffff, color2: 0x8fe3ff }, { thick: 0.6 });
  m.plat(0, 1.5, 79, 14, 8, { style: 'platform', color: pastel[3] });
  m.checkpoint(V(-7, 0, 75), V(7, 7, 83), V(0, 1.7, 79), 0);

  // ---------------------------------------------------------------- C: elevators up a cliff (z 86..103)
  [-5, 0, 5].forEach((x, i) => {
    m.plat(x, 1.5, 88, 4, 4, { style: 'stripe', color: 0x7c5cff, color2: 0xc9b8ff }, {
      thick: 0.8, motion: { move: { delta: V(0, 6, 0), period: 6, phase: i / 3, hold: 0.22 } },
    });
  });
  // Cliff with the upper ledge (top 7.5); thick so nobody walks under it.
  m.plat(0, 7.5, 97, 22, 12, { style: 'platform', color: pastel[1], round: 0.3 }, { thick: 7 });
  // Risky shortcut: a tiny cloud off to the right with a big jump pad straight onto the ledge.
  m.plat(9.3, 1.5, 88, 3.2, 3.2, cloud, { thick: 1.2 });
  m.bounce(9.3, 1.5, 88, 1.2, 21);
  m.checkpoint(V(-11, 6.5, 91), V(11, 13, 103), V(0, 7.7, 98), 0);

  // ---------------------------------------------------------------- D: gusty wind bridge (z 105..133, top 7.5)
  m.plat(0, 7.5, 111.5, 5, 13, { style: 'stripe', color: 0xffb3e0, color2: 0xffffff }, { thick: 0.9 });
  m.plat(0, 7.5, 126.75, 5, 12.5, { style: 'stripe', color: 0xffb3e0, color2: 0xffffff }, { thick: 0.9 });
  // Alternating gusts: right, pause, left, pause.
  m.windZone(V(-14, 6, 104), V(14, 15, 134), V(14, 0, 0), { on: 2.4, off: 3.6, phase: 0 });
  m.windZone(V(-14, 6, 104), V(14, 15, 134), V(-14, 0, 0), { on: 2.4, off: 3.6, phase: 3 });
  for (const z of [110, 126]) {
    for (const s of [-1, 1]) {
      const x = s * 11;
      m.cyl(V(x, 3.5, z), 0.5, 7, { style: 'pillar', color: 0xe9e4ff });
      m.cyl(V(x, 9.5, z), 1.9, 0.9, { style: 'fan', color: 0x9aa4ff }, { rot: [0, 0, Math.PI / 2] });
      m.box(V(x - s * 0.55, 9.5, z), 0.25, 3.4, 0.5, { style: 'beam', color: 0xffffff, color2: 0x7c5cff }, {
        motion: { spin: { axis: X, speed: s * 9 } },
      });
    }
  }
  m.plat(0, 7.5, 139.5, 14, 11, { style: 'platform', color: pastel[2] });
  m.checkpoint(V(-7, 6.5, 134), V(7, 13, 140), V(0, 7.7, 137), 0);

  // ---------------------------------------------------------------- E: jump pads to the next tier (top 12)
  [-4, 0, 4].forEach((x) => m.bounce(x, 7.5, 142.2, 1.3, 18));
  m.plat(0, 12, 150, 14, 10, { style: 'platform', color: pastel[4] }, { thick: 4 });
  // Drifting cloud steps (z 157..179), climbing to 15.
  [[159, 12.5, 0], [165, 13.3, 0.3], [171, 14.1, 0.6], [177, 14.9, 0.15]].forEach(([z, y, ph], i) => {
    m.plat(-2.2, y, z, 5.6, 4.4, { style: 'platform', color: pastel[(i + 2) % 6], round: 0.65 }, { thick: 1.4, motion: { move: { delta: V(4.4, 0, 0), period: 5.5, phase: ph, hold: 0.12 } } });
  });
  m.plat(0, 15.5, 186, 14, 12, { style: 'platform', color: pastel[5] }, { thick: 2 });
  m.checkpoint(V(-7, 14.5, 180), V(7, 21, 192), V(0, 15.7, 185), 0);

  // ---------------------------------------------------------------- F: crumbling sky road (z 194..221)
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 4; c++) {
      m.plat(-4.5 + c * 3, 15.5, 195.5 + r * 3, 2.8, 2.8, { style: 'tile', color: pastel[(r + c) % 6] }, {
        thick: 0.7, trigger: { delay: 0.9, respawn: 3 },
      });
    }
  }
  // Shortcut: a narrow beam with boost pads — fast, but one wobble and you're gone.
  m.plat(8.4, 15.5, 207, 1.3, 30, { style: 'beam', color: 0xffd23f, color2: 0xff7a1a }, { thick: 0.6 });
  m.boost(8.4, 15.5, 199, 1.3, 3, 0, 13);
  m.boost(8.4, 15.5, 211, 1.3, 3, 0, 13);

  // Finish (z 222..238)
  m.plat(0, 15.5, 230, 20, 16, { style: 'checker', color: 0xffd23f, color2: 0xffffff }, { thick: 2 });
  m.setFinish(V(-10, 14.5, 226), V(10, 22, 238));
  m.deco('arch', 0, 15.5, 226, 1.35, 0, 0xffb300);
  m.deco('confetti-cannon', -8, 15.5, 234, 1.2);
  m.deco('confetti-cannon', 8, 15.5, 234, 1.2);

  // ---------------------------------------------------------------- bots
  m.wp(-3.5, 0, 8, { r: 1.5 }); m.wp(-3.5, 0, 13.3, { jump: true, r: 1 });
  m.wp(-3.5, 0.4, 17, { r: 1.2 }); m.wp(-3.5, 0.4, 18.6, { jump: true, r: 1 });
  m.wp(-3.5, 0.9, 22.5, { r: 1.2 }); m.wp(-3.5, 0.9, 24.1, { jump: true, r: 1 });
  m.wp(-3.5, 1.4, 28, { r: 1.2 }); m.wp(-3.5, 1.4, 29.6, { jump: true, r: 1 });
  m.wp(0, 1.5, 36);
  m.wp(0, 1.5, 40.5, { jump: true, r: 0.6 }); m.wp(0, 1.5, 48, { r: 0.6 }); m.wp(0, 1.5, 58, { r: 0.6 }); m.wp(0, 1.5, 72.6, { jump: true, r: 0.6 });
  m.wp(4, 1.5, 79, { r: 1.5 });
  m.wp(6.6, 1.5, 82.6, { jump: true, r: 0.8 }); m.wp(9.3, 1.5, 88, { r: 0.8 });
  m.wp(4, 7.5, 97, { r: 2 });
  m.wp(0, 7.5, 104.2, { jump: true, r: 1 });
  for (const z of [106, 108, 110, 112, 114, 116]) m.wp(0, 7.5, z, { r: 0.5 });
  m.wp(0, 7.5, 117.6, { jump: true, r: 0.9 });
  for (const z of [121.5, 123.5, 125.5, 127.5, 129.5, 131]) m.wp(0, 7.5, z, { r: 0.5 });
  m.wp(0, 7.5, 132.6, { jump: true, r: 1 });
  m.wp(0, 7.5, 138, { r: 1 }); m.wp(0, 7.5, 142.2, { r: 0.8 }); m.wp(0, 12, 150, { r: 1.5 });
  m.wp(0, 12, 154.6, { jump: true, r: 1 }); m.wp(0, 12.5, 159, { r: 1.2 }); m.wp(0, 12.5, 160.6, { jump: true, r: 1 });
  m.wp(0, 13.3, 165, { r: 1.2 }); m.wp(0, 13.3, 166.6, { jump: true, r: 1 });
  m.wp(0, 14.1, 171, { r: 1.2 }); m.wp(0, 14.1, 172.6, { jump: true, r: 1 });
  m.wp(0, 14.9, 177, { r: 1.2 }); m.wp(0, 14.9, 178.6, { jump: true, r: 1 });
  m.wp(0, 15.5, 186); m.wp(0, 15.5, 191.6, { jump: true, r: 1 });
  m.wp(0, 15.5, 205); m.wp(0, 15.5, 232);

  // ---------------------------------------------------------------- decoration
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1;
    const z = -6 + i * 16;
    const y = -6 + i * 1.2 + (i % 3) * 2;
    m.deco('island', side * (24 + (i % 3) * 5), y, z, 0.9 + (i % 3) * 0.3);
    if (i % 2 === 0) m.deco('tree', side * (24 + (i % 3) * 5), y + 0.3, z + 1.5, 0.9);
    else m.deco('crystal', side * (24 + (i % 3) * 5) - side * 1.5, y + 0.3, z, 1.2);
    m.deco('balloon', side * (13 + (i % 4) * 3), 8 + i * 0.8 + (i % 3) * 2, z + 7, 1, 0, pastel[i % 6]);
  }
  for (let i = 0; i < 30; i++) {
    const x = ((i * 53) % 140) - 70;
    const side = Math.abs(x) < 30 ? Math.sign(x || 1) * (30 + (i % 3) * 4) : x;
    m.deco('cloud', side, -13 + (i % 6) * 3.5, -30 + i * 9.5, 2.2 + (i % 4) * 0.8);
  }
  for (let i = 0; i < 10; i++) m.deco('cloud', ((i * 37) % 120) - 60, 30 + (i % 4) * 5, -20 + i * 28, 3 + (i % 3));
  [[-12, -4, 40], [13, -2, 70], [-15, 2, 120], [16, 6, 165], [-14, 8, 210]].forEach(([x, y, z], i) => m.deco('tower', x, y, z, 1.4 + (i % 2) * 0.4));
  const flags: [number, number, number][] = [[-6.6, 1.5, 33], [6.6, 1.5, 33], [-6.6, 1.5, 76], [6.6, 1.5, 76], [-10.5, 7.5, 92], [10.5, 7.5, 92],
    [-6.6, 7.5, 135], [6.6, 7.5, 135], [-6.6, 12, 146], [6.6, 12, 146], [-6.6, 15.5, 181], [6.6, 15.5, 181], [-9.5, 15.5, 223], [9.5, 15.5, 223]];
  flags.forEach(([x, y, z], i) => m.deco('flag', x, y, z, 1, 0, pastel[i % 6]));

  return m.build({
    id: 'skyfall', name: 'Sky Fall', subtitle: 'Race above the clouds!', mode: 'race', difficulty: 3,
    theme: {
      skyTop: 0x2f7bff, skyBottom: 0xffeccc, fog: 0xe4e9ff, fogNear: 90, fogFar: 330, sun: 0xfff0c8, sunIntensity: 2.8,
      ambient: 0xffffff, hemiGround: 0xffe3b0, floor: 'clouds', floorColor: 0xc9d4ff, floorY: -18, sunDir: V(0.45, 0.85, -0.4),
      particles: 'sparkles',
    },
    spawn: { center: V(0, 0.2, 1), yaw: 0, cols: 6, spacing: 1.6 },
    killY: { base: -10 },
    bounds: { min: V(-45, -25, -25), max: V(45, 70, 250) },
    timeLimit: 150,
    camYaw: 0,
    music: 'race',
  });
}

