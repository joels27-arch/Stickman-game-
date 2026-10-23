import type { MapDef } from '../maptypes';
import type { MapMeta } from '../match';
import { finalArena } from './arena';
import { iceChaos } from './ice';
import { lavaPanic } from './lava';
import { rainbowRush } from './rainbow';
import { skyFall } from './skyfall';
import { spinningMadness } from './spinning';

const builders: Record<string, () => MapDef> = {
  rainbow: rainbowRush,
  spinning: spinningMadness,
  skyfall: skyFall,
  ice: iceChaos,
  lava: lavaPanic,
  arena: finalArena,
};

const cache = new Map<string, MapDef>();

export function getMap(id: string): MapDef {
  let m = cache.get(id);
  if (!m) {
    const b = builders[id];
    if (!b) throw new Error(`unknown map ${id}`);
    m = b();
    cache.set(id, m);
  }
  return m;
}

export const MAP_IDS = Object.keys(builders);

/** Which maps can appear as regular rounds and which can host the final. */
export const MAP_META: MapMeta[] = MAP_IDS.map((id) => {
  const m = getMap(id);
  return {
    id, mode: m.mode, difficulty: m.difficulty,
    finalOk: id === 'arena' || id === 'lava',
    roundOk: id !== 'arena',
  };
});

export const hasMap = (id: string) => id in builders;
