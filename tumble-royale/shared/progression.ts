// Levels, rewards and challenges. Computed on the server only (the client just
// displays what the server returns).

import type { Cosmetics } from './cosmetics';

export interface Profile {
  id: string;
  name: string;
  level: number;
  xp: number;
  coins: number;
  owned: string[];
  equipped: Cosmetics;
  stats: {
    matches: number; wins: number; rounds: number; qualified: number; finals: number;
    bestPlace: number; dives: number; bounces: number; knocks: number; crowns: number;
  };
  challenges: { day: number; progress: Record<string, number>; done: string[] };
  created: number;
}

export interface MatchStats {
  rounds: number; qualified: number; final: boolean; won: boolean; place: number; players: number;
  dives: number; bounces: number; knocks: number; finishes: number; survived: number;
}

export const xpForLevel = (level: number) => 100 + (level - 1) * 30;

export interface ChallengeDef { id: string; text: string; goal: number; coins: number; measure: (m: MatchStats) => number }

export const CHALLENGES: ChallengeDef[] = [
  { id: 'play3', text: 'Play 3 matches', goal: 3, coins: 80, measure: () => 1 },
  { id: 'qual4', text: 'Qualify from 4 rounds', goal: 4, coins: 100, measure: (m) => m.qualified },
  { id: 'final1', text: 'Reach a final', goal: 1, coins: 120, measure: (m) => (m.final ? 1 : 0) },
  { id: 'win1', text: 'Win a match', goal: 1, coins: 250, measure: (m) => (m.won ? 1 : 0) },
  { id: 'dive30', text: 'Dive 30 times', goal: 30, coins: 70, measure: (m) => m.dives },
  { id: 'bounce10', text: 'Use 10 bounce pads or bumpers', goal: 10, coins: 70, measure: (m) => m.bounces },
  { id: 'survive2', text: 'Survive 2 survival rounds', goal: 2, coins: 110, measure: (m) => m.survived },
  { id: 'top3', text: 'Finish in the top 3', goal: 1, coins: 150, measure: (m) => (m.place > 0 && m.place <= 3 ? 1 : 0) },
  { id: 'rounds8', text: 'Play 8 rounds', goal: 8, coins: 90, measure: (m) => m.rounds },
];

/** Three challenges per UTC day, rotating deterministically. */
export function dailyChallenges(day: number): ChallengeDef[] {
  const out: ChallengeDef[] = [];
  for (let k = 0; out.length < 3 && k < 20; k++) {
    const c = CHALLENGES[(day * 3 + k * 4) % CHALLENGES.length];
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

export const dayIndex = (now: number) => Math.floor(now / 86400000);

export interface RewardResult { xp: number; coins: number; levelUp: boolean; level: number; challenges: string[] }

/** Applies a match result to a profile in place and returns what was granted. */
export function applyMatch(p: Profile, m: MatchStats, now: number): RewardResult {
  const rounds = Math.max(0, Math.min(10, m.rounds | 0));
  const qualified = Math.max(0, Math.min(rounds, m.qualified | 0));
  let xp = 20 + rounds * 10 + qualified * 25 + (m.final ? 30 : 0) + (m.won ? 150 : 0);
  let coins = 10 + rounds * 5 + qualified * 15 + (m.final ? 25 : 0) + (m.won ? 120 : 0);
  // Daily challenges.
  const day = dayIndex(now);
  if (p.challenges.day !== day) p.challenges = { day, progress: {}, done: [] };
  const completed: string[] = [];
  for (const c of dailyChallenges(day)) {
    if (p.challenges.done.includes(c.id)) continue;
    const v = (p.challenges.progress[c.id] ?? 0) + Math.max(0, Math.min(c.goal, c.measure({ ...m, rounds, qualified })));
    p.challenges.progress[c.id] = Math.min(c.goal, v);
    if (v >= c.goal) { p.challenges.done.push(c.id); coins += c.coins; completed.push(c.text); }
  }
  // Stats.
  const st = p.stats;
  st.matches++; st.rounds += rounds; st.qualified += qualified;
  if (m.final) st.finals++;
  if (m.won) { st.wins++; st.crowns++; }
  if (m.place > 0 && (st.bestPlace === 0 || m.place < st.bestPlace)) st.bestPlace = m.place;
  st.dives += Math.min(500, m.dives | 0); st.bounces += Math.min(500, m.bounces | 0); st.knocks += Math.min(500, m.knocks | 0);
  // XP and levels.
  let levelUp = false;
  p.xp += xp;
  while (p.xp >= xpForLevel(p.level)) { p.xp -= xpForLevel(p.level); p.level++; levelUp = true; coins += 50; }
  p.coins += coins;
  return { xp, coins, levelUp, level: p.level, challenges: completed };
}
