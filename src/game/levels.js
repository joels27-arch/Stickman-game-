// Campaign: 12 levels over 4 chapters, each with a twist implemented as rules.
import { DEPTH } from '../config.js';
import { WaveDirector } from './ai.js';

export const CHAPTERS = [
  { id: 'grassland', name: 'The Green March', levels: [1, 2, 3] },
  { id: 'desert', name: 'Sands of Ash', levels: [4, 5, 6] },
  { id: 'snow', name: 'The White Silence', levels: [7, 8, 9] },
  { id: 'volcano', name: 'Heart of Inkfall', levels: [10, 11, 12] },
];

const BASIC = ['digger', 'blade', 'bowman'];
const T2 = [...BASIC, 'shieldbearer'];
const T3 = [...T2, 'inkcaster'];
const T4 = [...T3, 'shadow'];
const ALL = [...T4, 'colossus'];

export const LEVELS = [
  { id: 1, name: 'First Ink', biome: 'grassland', twist: 'Tutorial', desc: 'Learn to mine, train, command and take direct control.',
    difficulty: 'easy', player: BASIC, enemy: ['digger', 'blade'], enemyMonument: 0.5, tutorial: true, stars: { hp: 0.6, time: 360 } },
  { id: 2, name: "Archers' Ridge", biome: 'grassland', twist: 'Only Bowmen', desc: 'No swords allowed — hold the ridge with arrows alone.',
    difficulty: 'easy', player: ['digger', 'bowman'], enemy: ['digger', 'blade', 'bowman'], enemyMonument: 0.7, stars: { hp: 0.5, time: 420 } },
  { id: 3, name: 'Night Raid', biome: 'night', twist: 'Ambush', desc: 'The enemy strikes under the cover of darkness. Survive the first wave, then counter.',
    difficulty: 'normal', player: BASIC, enemy: ['digger', 'blade', 'bowman'], startGold: 450, ambush: ['blade', 'blade', 'blade', 'blade', 'bowman', 'bowman'], stars: { hp: 0.5, time: 480 }, reward: 'shieldbearer' },
  { id: 4, name: 'Dry Wells', biome: 'desert', twist: 'Limited Gold', desc: 'The mines run dry. Every nugget counts — spend wisely.',
    difficulty: 'normal', player: T2, enemy: T2, limitedGold: 1100, limitedInk: 30, startGold: 600, enemyStartGold: 600, stars: { hp: 0.5, time: 480 } },
  { id: 5, name: 'The Last Statue', biome: 'desert', twist: 'Protect the Statue', desc: 'An ancient statue stands before your monument. If it falls, you lose.',
    difficulty: 'normal', player: T2, enemy: T2, statue: true, stars: { hp: 0.6, time: 540 }, reward: 'inkcaster' },
  { id: 6, name: 'Sandstorm Siege', biome: 'desert', twist: 'Hold Out', desc: 'A massive host is coming. Hold for 4 minutes — or break them early.',
    difficulty: 'hard', player: T3, enemy: T3, survive: 240, enemyIncome: 1.25, stars: { hp: 0.5, time: 240 } },
  { id: 7, name: 'Frostbite', biome: 'snow', twist: 'Deep Snow', desc: 'Everyone moves slower in the snow. Their archers love it.',
    difficulty: 'normal', player: T3, enemy: T3, speedMul: 0.78, favor: { bowman: 1.2 }, stars: { hp: 0.5, time: 540 }, reward: 'shadow' },
  { id: 8, name: 'Shadow Pass', biome: 'snow', twist: 'Assassins', desc: 'Invisible killers stalk the pass. Keep your archers protected.',
    difficulty: 'hard', player: T4, enemy: ['digger', 'blade', 'shadow', 'shieldbearer'], favor: { shadow: 2.2 }, stars: { hp: 0.5, time: 540 } },
  { id: 9, name: 'The Long Night', biome: 'night', twist: 'Dark War', desc: 'A brutal battle in total darkness. Both armies start rich.',
    difficulty: 'hard', player: T4, enemy: T4, startGold: 800, enemyStartGold: 800, stars: { hp: 0.5, time: 600 } },
  { id: 10, name: 'Ember Road', biome: 'volcano', twist: 'Meteor Rain', desc: 'Burning rocks fall from the sky — on friend and foe alike.',
    difficulty: 'hard', player: T4, enemy: T4, meteors: true, stars: { hp: 0.5, time: 600 }, reward: 'colossus' },
  { id: 11, name: 'The Iron Giant', biome: 'volcano', twist: 'Boss Colossus', desc: 'A colossal champion leads the enemy. Bring it down.',
    difficulty: 'normal', player: ALL, enemy: T3, boss: true, stars: { hp: 0.5, time: 600 } },
  { id: 12, name: 'Inkfall', biome: 'volcano', twist: 'Final Battle', desc: 'The enemy empire throws everything at you. End this war.',
    difficulty: 'insane', player: ALL, enemy: ALL, enemyMonument: 1.4, meteors: true, stars: { hp: 0.4, time: 720 } },
];

export const UNLOCK_BY_LEVEL = { shieldbearer: 3, inkcaster: 5, shadow: 7, colossus: 10 };

// Build the World rule hooks for a level (or endless mode).
export function makeRules(level) {
  const rules = {};
  if (!level) return rules;
  if (level.speedMul) rules.speedMul = level.speedMul;
  if (level.limitedGold) { rules.limitedGold = level.limitedGold; rules.limitedInk = level.limitedInk; }
  if (level.enemyIncome) rules.incomeMul = [1, level.enemyIncome];
  let meteorT = 8, bossT = 25, ambushDone = false, startDone = false;
  rules.update = (w, dt) => {
    if (!startDone) {
      startDone = true;
      if (level.statue) {
        const m = w.teams[0].monument;
        const s = w.makeStructure('statue', 0, m.x + 520, 1800, 22, 110);
        s.z = DEPTH / 2;
      }
    }
    if (level.ambush && !ambushDone && w.time > 20) {
      ambushDone = true;
      for (const t of level.ambush) {
        const u = w.spawnUnit(t, 1, w.teams[1].monument.x - 500 - Math.random() * 200);
        u.forceAttack = true;
      }
      w.teams[1].stance = 'attack';
      w.emit('banner', { text: 'AMBUSH!', sub: 'Enemy raiders approach' });
    }
    if (level.meteors) {
      meteorT -= dt;
      if (meteorT <= 0) {
        meteorT = 5 + Math.random() * 5;
        const x = 450 + Math.random() * (w.width - 900);
        w.spawnProjectile({ kind: 'meteor', x: x - 200, y: -520, z: 4 + Math.random() * (DEPTH - 8), vx: 160, vy: 180, g: 520,
          team: -1, dmg: 60, aoe: 60, life: 6, tx: x + 20 });
        w.emit('sfx', { name: 'whoosh', x });
      }
    }
    if (level.boss) {
      bossT -= dt;
      if (bossT <= 0) {
        bossT = 160;
        const u = w.spawnUnit('colossus', 1);
        u.boss = true; u.applyStats(w, false); u.hp = u.maxHp;
        w.boss = u;
        w.emit('banner', { text: 'THE IRON GIANT', sub: 'A boss Colossus has entered the battle' });
        w.emit('sfx', { name: 'horn' });
      }
    }
  };
  rules.checkEnd = (w) => {
    if (level.survive && w.time >= level.survive) w.endGame(0);
  };
  return rules;
}

export function endlessRules() {
  let director = null;
  return {
    update: (w, dt) => {
      if (!director) director = w.waves = new WaveDirector(w);
      director.update(dt);
    },
  };
}

export function starsFor(level, world) {
  if (world.winner !== 0) return 0;
  let s = 1;
  const m = world.teams[0].monument;
  if (m.hp / m.maxHp >= level.stars.hp) s++;
  if (world.time <= level.stars.time) s++;
  return s;
}
