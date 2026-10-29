// Headless balance / smoke test: runs AI-vs-AI matches and unit matchups
// without a browser. Usage: node tools/sim.mjs [--quick]
import { World } from '../src/game/world.js';
import { AIController } from '../src/game/ai.js';
import { UNITS, DT } from '../src/config.js';

const quick = process.argv.includes('--quick');
const N = +(process.argv.find((a) => a.startsWith('--games='))?.slice(8) || 32);

function match(d0, d1, maxT = 900, allowed0 = undefined) {
  const w = new World({ width: 3000, teams: [{ allowed: allowed0 }, {}] });
  w.ais.push(new AIController(w, 0, d0), new AIController(w, 1, d1));
  let t = 0;
  while (!w.over && t < maxT) { w.update(DT); t += DT; }
  return { winner: w.winner, t: Math.round(t), s0: w.teams[0].stats, s1: w.teams[1].stats, units: w.units.length };
}

// equal-gold army fights in the middle of the field
function duel(a, b, budget = 1500) {
  const w = new World({ width: 3000 });
  const val = (t) => UNITS[t].cost + UNITS[t].ink * 25;
  const na = Math.max(1, Math.round(budget / val(a))), nb = Math.max(1, Math.round(budget / val(b)));
  for (let i = 0; i < na; i++) w.spawnUnit(a, 0, 1300 - (UNITS[a].melee ? 0 : 120) - i * 3);
  for (let i = 0; i < nb; i++) w.spawnUnit(b, 1, 1700 + (UNITS[b].melee ? 0 : 120) + i * 3);
  w.teams[0].stance = 'attack'; w.teams[1].stance = 'attack';
  let t = 0;
  while (t < 120) {
    w.update(DT); t += DT;
    const A = w.teamUnits[0].length, B = w.teamUnits[1].length;
    if (!A || !B) break;
  }
  const hpLeft = (team) => w.teamUnits[team].reduce((s, u) => s + u.hp / u.maxHp * val(u.type), 0);
  return { a: hpLeft(0) / (na * val(a)), b: hpLeft(1) / (nb * val(b)) };
}

const types = ['blade', 'bowman', 'shieldbearer', 'inkcaster', 'shadow', 'colossus'];
console.log('Matchups (value of army remaining, equal budget). row vs col:');
const table = {};
for (const a of types) {
  table[a] = {};
  for (const b of types) {
    if (a === b) { table[a][b] = '  -  '; continue; }
    const r = duel(a, b), r2 = duel(b, a);
    const v = ((r.a - r.b) + (r2.b - r2.a)) / 2;
    table[a][b] = (v >= 0 ? '+' : '') + v.toFixed(2);
  }
}
console.table(table);

const runs = quick ? [['normal', 'normal']] : [['easy', 'hard'], ['normal', 'normal'], ['hard', 'insane'], ['normal', 'easy']];
for (const [a, b] of runs) {
  const t0 = Date.now();
  const r = match(a, b);
  console.log(`${a} vs ${b}: winner=${r.winner} t=${r.t}s  blue trained ${r.s0.trained} kills ${r.s0.kills} gold ${Math.round(r.s0.gold)} | red trained ${r.s1.trained} kills ${r.s1.kills} gold ${Math.round(r.s1.gold)}  (${Date.now() - t0}ms)`);
}

// no single unit should dominate: a mono-type AI should lose to a mixed AI
if (!quick) {
  for (const diff of ['normal', 'hard']) {
    console.log(`\nMono-unit AI (blue) vs mixed AI (red), both ${diff}, ${N} games each:`);
    for (const type of types) {
      let wins = 0;
      for (let i = 0; i < N; i++) if (match(diff, diff, 900, ['digger', type]).winner === 0) wins++;
      console.log(`  only ${type.padEnd(13)} won ${wins}/${N}  (${Math.round(wins / N * 100)}%)`);
    }
  }
}
