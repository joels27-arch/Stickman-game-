import { describe, expect, it } from 'vitest';
import { Btn, DT, Mode, Surf } from '../shared/constants';
import { MapBuilder, V } from '../shared/maps/builder';
import { getMap, MAP_IDS } from '../shared/maps';
import { PState, type Input, placeAtSpawn, quantizeInput, stepPlayer, shovePlayers, copyState } from '../shared/player';
import { World } from '../shared/world';
import type { MapDef } from '../shared/maptypes';

function testMap(extra?: (m: MapBuilder) => void): MapDef {
  const m = new MapBuilder();
  m.plat(0, 0, 0, 40, 40, { style: 'platform' });
  m.checkpoint(V(-20, -1, -20), V(20, 5, 20), V(0, 0.1, 0), 0);
  extra?.(m);
  return m.build({
    id: 'test', name: 'Test', subtitle: '', mode: 'race', difficulty: 1,
    theme: { skyTop: 0, skyBottom: 0, fog: 0, fogNear: 1, fogFar: 2, sun: 0, sunIntensity: 1, ambient: 0, hemiGround: 0, floor: 'void', floorColor: 0, floorY: -10, sunDir: V(0, 1, 0) },
    spawn: { center: V(0, 0.1, 0), yaw: 0, cols: 6, spacing: 1.6 },
    killY: { base: -8 }, bounds: { min: V(-100, -30, -100), max: V(100, 100, 300) }, timeLimit: 100, camYaw: 0, music: 'race',
  });
}

function sim(world: World, s: PState, inputs: (tick: number) => Input, ticks: number, start = 0, respawn = true) {
  let ev = 0;
  for (let t = start; t < start + ticks; t++) ev |= stepPlayer(s, inputs(t), { world, tick: t, slot: 0, canMove: true, respawn });
  return ev;
}

describe('character controller', () => {
  it('stands on the floor without sinking or jittering', () => {
    const w = new World(testMap());
    const s = new PState(); s.y = 0.5;
    sim(w, s, () => ({ mx: 0, mz: 0, btn: 0 }), 120);
    expect(s.grounded).toBe(1);
    expect(Math.abs(s.y)).toBeLessThan(0.02);
    const y0 = s.y;
    sim(w, s, () => ({ mx: 0, mz: 0, btn: 0 }), 60, 120);
    expect(Math.abs(s.y - y0)).toBeLessThan(1e-6);
  });

  it('runs at full speed quickly and stops quickly', () => {
    const w = new World(testMap());
    const s = new PState();
    sim(w, s, () => ({ mx: 0, mz: 1, btn: 0 }), 12);
    expect(s.vz).toBeGreaterThan(6.5);
    sim(w, s, () => ({ mx: 0, mz: 1, btn: 0 }), 60, 12);
    expect(s.vz).toBeCloseTo(7.2, 1);
    sim(w, s, () => ({ mx: 0, mz: 0, btn: 0 }), 12, 72);
    expect(Math.hypot(s.vx, s.vz)).toBeLessThan(0.1);
  });

  it('jumps about 1.8 m high and lands', () => {
    const w = new World(testMap());
    const s = new PState();
    sim(w, s, () => ({ mx: 0, mz: 0, btn: 0 }), 5);
    let maxY = 0, ev = 0;
    for (let t = 5; t < 90; t++) {
      ev |= stepPlayer(s, { mx: 0, mz: 0, btn: t < 10 ? Btn.Jump : 0 }, { world: w, tick: t, slot: 0, canMove: true, respawn: true });
      maxY = Math.max(maxY, s.y);
    }
    expect(maxY).toBeGreaterThan(1.6);
    expect(maxY).toBeLessThan(2.0);
    expect(s.grounded).toBe(1);
  });

  it('dives forward farther than a jump, slides and gets up', () => {
    const w = new World(testMap());
    const s = new PState();
    sim(w, s, () => ({ mx: 0, mz: 1, btn: 0 }), 30);
    const z0 = s.z;
    let sawSlide = false;
    for (let t = 30; t < 120; t++) {
      stepPlayer(s, { mx: 0, mz: 1, btn: t >= 31 && t < 34 ? Btn.Dive : 0 }, { world: w, tick: t, slot: 0, canMove: true, respawn: true });
      if (s.mode === Mode.Slide) sawSlide = true;
    }
    expect(sawSlide).toBe(true);
    expect(s.mode).toBe(Mode.Normal);
    expect(s.z - z0).toBeGreaterThan(8);
  });

  it('cannot fall through the floor from a great height', () => {
    const w = new World(testMap());
    const s = new PState(); s.y = 40;
    sim(w, s, () => ({ mx: 0, mz: 0, btn: 0 }), 240);
    expect(s.grounded).toBe(1);
    expect(s.y).toBeGreaterThan(-0.05);
  });

  it('is stopped by walls even at dive speed', () => {
    const w = new World(testMap((m) => m.box(V(0, 2, 6), 10, 4, 0.4, { style: 'wall' })));
    const s = new PState();
    sim(w, s, (t) => ({ mx: 0, mz: 1, btn: t % 40 === 5 ? Btn.Dive : 0 }), 200);
    expect(s.z).toBeLessThan(6 - 0.2);
  });

  it('rides a moving platform and gets carried', () => {
    const w = new World(testMap((m) => {
      m.plat(30, 2, 0, 4, 4, { style: 'platform' }, { motion: { move: { delta: V(0, 0, 10), period: 6 } } });
    }));
    const s = new PState(); s.x = 30; s.y = 2.3; s.z = 0;
    sim(w, s, () => ({ mx: 0, mz: 0, btn: 0 }), 180); // half a period: platform moves 10 m
    expect(s.grounded).toBe(1);
    expect(s.z).toBeGreaterThan(9);
    expect(s.y).toBeGreaterThan(1.9);
  });

  it('gets knocked down by a swinging hammer', () => {
    const map = getMap('rainbow');
    const w = new World(map);
    const s = new PState();
    let knocked = false;
    // Stand in the path of the first hammer for a few seconds.
    s.x = 0; s.y = 0.1; s.z = 56;
    for (let t = 0; t < 400 && !knocked; t++) {
      stepPlayer(s, { mx: 0, mz: 0, btn: 0 }, { world: w, tick: t, slot: 0, canMove: true, respawn: true });
      if (s.mode === Mode.Knock) knocked = true;
    }
    expect(knocked).toBe(true);
  });

  it('bounce pads launch the player', () => {
    const w = new World(testMap((m) => m.bounce(0, 0, 3, 1.3, 17)));
    const s = new PState();
    let maxY = 0;
    for (let t = 0; t < 120; t++) {
      stepPlayer(s, { mx: 0, mz: t < 25 ? 1 : 0, btn: 0 }, { world: w, tick: t, slot: 0, canMove: true, respawn: true });
      maxY = Math.max(maxY, s.y);
    }
    expect(maxY).toBeGreaterThan(4);
  });

  it('ice is slippery', () => {
    const w = new World(testMap((m) => m.plat(0, 0.02, 0, 40, 40, { style: 'ice' }, { surf: Surf.Ice, thick: 0.3 })));
    const s = new PState();
    sim(w, s, () => ({ mx: 0, mz: 1, btn: 0 }), 90);
    sim(w, s, () => ({ mx: 0, mz: 0, btn: 0 }), 30, 90);
    expect(s.vz).toBeGreaterThan(4); // still sliding after half a second
  });

  it('respawns at the checkpoint after falling off', () => {
    const w = new World(testMap());
    const s = new PState(); s.x = 30; s.y = 1; // off the platform
    const ev = sim(w, s, () => ({ mx: 0, mz: 0, btn: 0 }), 120);
    expect(ev & 64).toBeTruthy();
    expect(Math.hypot(s.x, s.z)).toBeLessThan(3);
  });

  it('is deterministic: replaying the same inputs gives the identical state', () => {
    const map = getMap('rainbow');
    const run = () => {
      const w = new World(map);
      const s = new PState(); placeAtSpawn(map, s, 3);
      for (let t = 0; t < 1200; t++) {
        const a = Math.sin(t * 0.01) * 0.5;
        const inp = quantizeInput(Math.sin(a) * 0.6, Math.cos(a), (t % 50 < 3 ? Btn.Jump : 0) | (t % 170 === 20 ? Btn.Dive : 0));
        stepPlayer(s, inp, { world: w, tick: t, slot: 3, canMove: true, respawn: true });
      }
      return s;
    };
    const a = run(), b = run();
    expect(copyState(new PState(), a)).toEqual(copyState(new PState(), b));
  });

  it('players shove each other apart', () => {
    const a = new PState(), b = new PState();
    b.x = 0.3;
    shovePlayers(a, b);
    expect(b.x - a.x).toBeGreaterThan(0.79);
  });
});

describe('maps', () => {
  for (const id of MAP_IDS) {
    it(`${id}: every spawn slot stands on solid ground`, () => {
      const map = getMap(id);
      for (let slot = 0; slot < 30; slot++) {
        const w = new World(map);
        const s = new PState(); placeAtSpawn(map, s, slot);
        for (let t = -180; t < -60; t++) stepPlayer(s, { mx: 0, mz: 0, btn: 0 }, { world: w, tick: t, slot, canMove: false, respawn: map.mode === 'race' });
        expect(s.mode, `slot ${slot}`).not.toBe(Mode.Out);
        expect(s.grounded, `slot ${slot} grounded`).toBe(1);
      }
    });
    it(`${id}: checkpoints respawn onto solid ground`, () => {
      const map = getMap(id);
      for (let cp = 0; cp < map.checkpoints.length; cp++) {
        for (let slot = 0; slot < 9; slot++) {
          const w = new World(map);
          const s = new PState();
          const c = map.checkpoints[cp];
          s.x = c.spawn.x; s.y = c.spawn.y; s.z = c.spawn.z; s.cp = cp;
          // force a fall-out → respawn at this checkpoint
          s.y = -100;
          stepPlayer(s, { mx: 0, mz: 0, btn: 0 }, { world: w, tick: 0, slot, canMove: true, respawn: true });
          for (let t = 1; t < 90; t++) stepPlayer(s, { mx: 0, mz: 0, btn: 0 }, { world: w, tick: t, slot, canMove: true, respawn: true });
          expect(s.grounded, `cp ${cp} slot ${slot}`).toBe(1);
          expect(s.cp).toBe(cp);
        }
      }
    });
  }
});

export const _dt = DT;
