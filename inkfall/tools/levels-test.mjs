// Plays every campaign level (and Endless) headless with an AI on the player side.
// Catches runtime errors in level rules and gives a rough difficulty curve.
// Usage: node tools/levels-test.mjs [playerDifficulty]
import { World } from '../src/game/world.js';
import { AIController } from '../src/game/ai.js';
import { LEVELS, makeRules, endlessRules } from '../src/game/levels.js';
import { DT } from '../src/config.js';

const pd = process.argv[2] || 'hard';
function run(level, seedGames = 3) {
  let wins = 0, times = [];
  for (let g = 0; g < seedGames; g++) {
    const rules = makeRules(level);
    const w = new World({ width: level.id === 1 ? 2500 : 3000, biome: level.biome, rules,
      teams: [{ gold: level.startGold ?? 300, allowed: level.player }, { gold: level.enemyStartGold ?? 300, allowed: level.enemy, monumentHp: level.enemyMonument ?? 1 }] });
    for (let i = 0; i < 2; i++) { w.spawnUnit('digger', 0); w.spawnUnit('digger', 1); }
    w.ais.push(new AIController(w, 0, pd), new AIController(w, 1, level.difficulty, { favor: level.favor }));
    while (!w.over && w.time < 900) w.update(DT);
    if (w.winner === 0) { wins++; times.push(Math.round(w.time)); }
  }
  return { wins, times };
}
for (const l of LEVELS) {
  const t0 = Date.now();
  const r = run(l);
  console.log(`L${String(l.id).padStart(2)} ${l.name.padEnd(18)} [${l.twist.padEnd(18)}] vs ${l.difficulty.padEnd(6)}: player(${pd}) won ${r.wins}/3  times ${r.times.join(',')}  (${Date.now() - t0}ms)`);
}
// endless
for (let g = 0; g < 2; g++) {
  const w = new World({ width: 2300, biome: 'grassland', rules: endlessRules(), teams: [{}, { invulnerable: true }] });
  for (let i = 0; i < 2; i++) w.spawnUnit('digger', 0);
  w.ais.push(new AIController(w, 0, pd));
  while (!w.over && w.time < 1500) w.update(DT);
  console.log(`Endless: player(${pd}) reached wave ${w.waves?.wave} at ${Math.round(w.time)}s`);
}
