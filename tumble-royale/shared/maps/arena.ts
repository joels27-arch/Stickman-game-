import { MapBuilder, V } from './builder';

/** STUB — replaced by the real map. */
export function finalArena() {
  const m = new MapBuilder();
  m.plat(0, 0, 0, 30, 30, { style: 'platform', color: 0xffd23f });
  m.checkpoint(V(-15, -1, -15), V(15, 6, 15), V(0, 0.2, 0), 0);
  m.wp(0, 0, 8); m.wp(0, 0, 13); m.wp(5, 0, 0); m.wp(-5, 0, 0);
  return m.build({
    id: 'arena', name: 'arena', subtitle: '', mode: 'survival', difficulty: 2,
    theme: { skyTop: 0x3f8cff, skyBottom: 0xbfe6ff, fog: 0xbfe6ff, fogNear: 70, fogFar: 260, sun: 0xffffff, sunIntensity: 2.5, ambient: 0xffffff, hemiGround: 0x9ad0ff, floor: 'water', floorColor: 0x2fb5ff, floorY: -4, sunDir: V(-0.5, 1, -0.35) },
    spawn: { center: V(0, 0.2, 0), yaw: 0, cols: 6, spacing: 1.6 },
    killY: { base: -6 }, bounds: { min: V(-60, -20, -60), max: V(60, 60, 60) }, timeLimit: 60, camYaw: 0,
    music: 'final',
  });
}
