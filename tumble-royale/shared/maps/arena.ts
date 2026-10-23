import { MapBuilder, V, Y } from './builder';

/**
 * MAP 6 — FINAL ARENA (survival final, last one standing)
 * Three stacked layers of hexagonal tiles that drop shortly after anyone stands
 * on them. Players start on a hover pad that collapses a moment after GO, so
 * the top layer starts intact. Escalation: a sweeping beam appears on each
 * layer in turn (30 s / 45 s / 55 s), then the lava below starts rising
 * (from 55 s) and swallows the layers one by one — the round always ends with
 * a champion before the timer.
 */
export function finalArena() {
  const m = new MapBuilder();
  const R = 1.15;              // tile collision radius
  const D = R * 2;             // centre distance: circle packing leaves no gap a player fits through
  const RINGS = 6;             // 127 tiles per layer
  const layers = [
    { top: 0, color: 0xffc531, delay: 1.8 },
    { top: -8, color: 0xff5aa8, delay: 1.6 },
    { top: -16, color: 0x36c8ff, delay: 1.4 },
  ];
  const TH = 0.8;

  for (const L of layers) {
    for (let q = -RINGS; q <= RINGS; q++) {
      for (let r = -RINGS; r <= RINGS; r++) {
        if (Math.abs(q + r) > RINGS) continue;
        const x = D * (q + r / 2), z = D * (Math.sqrt(3) / 2) * r;
        const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
        // Outer ring a shade darker so the edge reads clearly.
        const color = ring === RINGS ? shade(L.color, 0.8) : L.color;
        m.disc(x, L.top, z, R, { style: 'tile', color }, { thick: TH, trigger: { delay: L.delay } });
      }
    }
  }

  // Hover start pad: everyone waits here, it collapses just after GO (so the
  // countdown never eats the top layer).
  m.disc(0, 1.3, 0, 6.3, { style: 'start', color: 0x7c5cff, color2: 0xb7a6ff }, { thick: 0.5, fallAt: 1.2 });
  m.checkpoint(V(-14, -2, -14), V(14, 6, 14), V(0, 0.2, -9), 0);

  // Escalating sweepers (no central post, so there is no permanent safe spot).
  const beam = (top: number, len: number, speed: number, from: number, phase: number, color: number) =>
    m.box(V(0, top + 0.6, 0), len, 0.5, 0.5, { style: 'beam', color, color2: 0x2a1d6e }, {
      motion: { spin: { axis: Y, speed, phase } }, knock: 1, activeFrom: from,
    });
  const span = D * RINGS * 2 + 1.5;
  beam(0, span, 0.7, 30, 0, 0xffe25c);
  beam(-8, span, -0.6, 45, 0, 0xff8fcd);
  beam(-8, span, -0.6, 45, Math.PI / 2, 0xff8fcd);
  beam(-16, span, 0.8, 55, Math.PI / 4, 0x6fd0ff);

  // Bot safe points: spread over every layer.
  for (const L of layers) {
    // Spread out (no centre point) so wandering bots keep moving instead of parking on a tile.
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + L.top * 0.1, rad = i % 2 ? 6 : 10.5;
      m.wp(Math.sin(a) * rad, L.top, Math.cos(a) * rad);
    }
  }

  // Championship decor around (and outside the intro camera's orbit): stands, towers,
  // confetti cannons and banners.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    m.deco('stands', Math.sin(a) * 30, -9, Math.cos(a) * 30, 1.2, a + Math.PI);
    m.deco('tower', Math.sin(a + 0.52) * 40, -10, Math.cos(a + 0.52) * 40, 2.2, 0, 0xffd23f);
    m.deco('confetti-cannon', Math.sin(a) * 17, -3, Math.cos(a) * 17, 1.2);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    m.deco('banner', Math.sin(a) * 44, 4, Math.cos(a) * 44, 2, a, 0xffc531);
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    m.deco('cloud', Math.sin(a) * (75 + (i % 3) * 15), 30 + (i % 4) * 6, Math.cos(a) * (75 + (i % 3) * 15), 3 + (i % 3));
  }

  return m.build({
    id: 'arena', name: 'Final Arena', subtitle: 'Last one standing wins the crown!', mode: 'survival', difficulty: 3,
    theme: {
      skyTop: 0x1a0b4a, skyBottom: 0xff8a5c, fog: 0x4a2470, fogNear: 60, fogFar: 230, sun: 0xffd2a0, sunIntensity: 2.4,
      ambient: 0xd8c8ff, hemiGround: 0x5a2a6a, floor: 'void', floorColor: 0x000000, floorY: -40, sunDir: V(0.6, 0.55, -0.4),
      particles: 'sparkles',
    },
    spawn: { center: V(0, 1.5, 3.2), yaw: 0, cols: 6, spacing: 1.6 },
    // Lava rises from 55 s: bottom layer gone ~77 s, middle ~95 s, top ~113 s.
    killY: { base: -26, rise: 0.45, delay: 55, max: 2 },
    bounds: { min: V(-40, -40, -40), max: V(40, 40, 40) },
    timeLimit: 120,
    camYaw: 0,
    music: 'final',
  });
}

function shade(hex: number, k: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * k));
  const b = Math.min(255, Math.round((hex & 255) * k));
  return (r << 16) | (g << 8) | b;
}
