// Tournament structure: how many qualify each round, which map is played,
// and deterministic ranking / tie-breaking.

import { hash01, rng } from './math';

export interface MapMeta { id: string; mode: 'race' | 'survival'; difficulty: number; finalOk: boolean; roundOk: boolean }

export interface RoundPlan { map: string; final: boolean; qualify: number }

/**
 * How many of `n` players qualify from a non-final round.
 * 30 → 20 → 12 → 6 → final, and it scales down for small lobbies:
 * 10 → 5 → final, 4 or fewer go straight to the final.
 */
export function qualifyCount(n: number): number {
  if (n <= 6) return 1; // final
  let q = n > 20 ? Math.round((n * 2) / 3) : n > 12 ? Math.round(n * 0.6) : Math.round(n * 0.5);
  return Math.max(2, Math.min(n - 1, q));
}

export const isFinalSize = (n: number) => n <= 6;

/** Projected number of rounds for a lobby of n players (for the UI). */
export function projectedRounds(n: number): number {
  let r = 1;
  while (!isFinalSize(n)) { n = qualifyCount(n); r++; }
  return r;
}

/**
 * Picks the next round. Early rounds favour gentle races, the middle mixes in
 * harder races and survival, and the final is a last-one-standing arena or a
 * crown race. Maps don't repeat within a match until the pool runs out.
 */
export function planRound(players: number, roundIndex: number, used: string[], maps: MapMeta[], seed: number): RoundPlan {
  const final = isFinalSize(players);
  const r = rng((seed ^ (roundIndex * 0x9e3779b1)) >>> 0);
  if (final) {
    const finals = maps.filter((m) => m.finalOk && !used.includes(m.id));
    let pool = finals.length ? finals : maps.filter((m) => m.finalOk);
    if (!pool.length) pool = maps;
    // The arena is the signature final; occasionally the survival map hosts it instead.
    const arena = pool.find((m) => m.id === 'arena');
    const pick = arena && (r() < 0.75 || pool.length === 1) ? arena : pool[Math.floor(r() * pool.length)];
    return { map: pick.id, final: true, qualify: 1 };
  }
  const candidates = maps.filter((m) => m.roundOk && !used.includes(m.id));
  let pool = candidates.length ? candidates : maps.filter((m) => m.roundOk);
  if (!pool.length) pool = maps;
  // Desired difficulty rises with the round number; survival rounds only once the field has thinned a bit.
  const want = Math.min(3, 1 + roundIndex);
  const scored = pool.map((m) => {
    let score = Math.abs(m.difficulty - want) + r() * 0.9;
    if (m.mode === 'survival' && roundIndex === 0) score += 1.5;
    return { m, score };
  }).sort((a, b) => a.score - b.score);
  return { map: scored[0].m.id, final: false, qualify: qualifyCount(players) };
}

/** Per-match deterministic tie-break key for a player id (lower wins). */
export const tieKey = (seed: number, id: number) => hash01((seed * 31 + id * 7919) | 0);

export interface RaceResult { id: number; finishTime: number | null; progress: number }
export interface SurvivalResult { id: number; outTick: number | null; outY: number }

/** Sort race results: finishers by exact sub-tick time, then non-finishers by progress. */
export function rankRace(rs: RaceResult[], seed: number): RaceResult[] {
  return [...rs].sort((a, b) => {
    if (a.finishTime !== null && b.finishTime !== null) return a.finishTime - b.finishTime || tieKey(seed, a.id) - tieKey(seed, b.id);
    if (a.finishTime !== null) return -1;
    if (b.finishTime !== null) return 1;
    return b.progress - a.progress || tieKey(seed, a.id) - tieKey(seed, b.id);
  });
}

/** Sort survival results: still alive first, then by later elimination, then higher fall point. */
export function rankSurvival(rs: SurvivalResult[], seed: number): SurvivalResult[] {
  return [...rs].sort((a, b) => {
    if (a.outTick === null && b.outTick === null) return tieKey(seed, a.id) - tieKey(seed, b.id);
    if (a.outTick === null) return -1;
    if (b.outTick === null) return 1;
    return b.outTick - a.outTick || b.outY - a.outY || tieKey(seed, a.id) - tieKey(seed, b.id);
  });
}
