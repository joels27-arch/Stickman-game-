// Rule-based enemy commander. Manages economy, counter-picks the opponent's
// army, switches stance between defend / attack / garrison and casts Ink Storm.
import { UNITS, UNIT_VALUE, COUNTERS, DIFFICULTY, UNIT_ORDER, SPELL } from '../config.js';

export class AIController {
  constructor(world, team, difficulty = 'normal', opts = {}) {
    this.world = world;
    this.team = team;
    this.difficulty = difficulty;
    this.p = DIFFICULTY[difficulty];
    this.thinkT = 1;
    this.passive = opts.passive ?? false;       // tutorial: barely acts
    this.maxArmy = opts.maxArmy ?? Infinity;
    this.favor = opts.favor ?? null;             // campaign flavour: { shadow: 2 } weights
    this.saving = null;
    this.lastStance = 'defend';
    this.attackHold = 0;
    this.rng = Math.random;
    const t = world.teams[team];
    t.isAI = true;
    t.gold += this.p.startGold;
  }

  update(dt) {
    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    this.thinkT = this.p.think * (0.8 + this.rng() * 0.4);
    if (this.passive) return this.passiveThink();
    this.economy();
    this.build();
    this.stance(dt + this.p.think);
    this.spells();
  }

  get me() { return this.world.teams[this.team]; }
  get foe() { return this.world.teams[1 - this.team]; }

  passiveThink() {
    const w = this.world, t = this.me;
    if (w.countType(this.team, 'digger') < 2) t.train(w, 'digger');
    const army = w.teamUnits[this.team].filter((u) => u.type !== 'digger').length;
    if (army < 2 && t.gold > 150) t.train(w, 'blade');
    t.stance = 'defend';
  }

  economy() {
    const w = this.world, t = this.me;
    const diggers = w.countType(this.team, 'digger');
    // ramp target diggers over the first minutes
    const target = Math.min(this.p.diggers, 3 + Math.floor(w.time / 25));
    if (diggers < target && t.allowed.has('digger')) {
      if (t.train(w, 'digger') === '') return;
    }
    // population upgrades when getting close to the cap
    const pop = t.pop(w);
    if (this.p.upgrades && pop >= t.popCap - 2 && t.gold > t.popUpgradeCost() + 100) t.buyPop(w);
    // unit tier upgrades with surplus gold
    if (this.p.upgrades && t.gold > 500) {
      const counts = UNIT_ORDER.map((type) => [type, w.countType(this.team, type)]).sort((a, b) => b[1] - a[1]);
      for (const [type, n] of counts) {
        if (n >= 3 && t.tiers[type] === 0 && t.allowed.has(type)) {
          if (t.buyUpgrade(w, type) === '') break;
        }
      }
    }
  }

  build() {
    const w = this.world, t = this.me;
    const armyCount = w.teamUnits[this.team].filter((u) => u.type !== 'digger').length;
    if (armyCount >= this.maxArmy) return;
    // don't over-queue
    let queued = 0;
    for (const type of UNIT_ORDER) if (type !== 'digger') queued += t.queues[type].count;
    if (queued >= 3) return;

    // score each unit type: base preference + counter-picking the foe's army
    const foeCounts = {};
    let foeTotal = 0;
    for (const u of w.teamUnits[1 - this.team]) {
      if (u.type === 'digger') continue;
      foeCounts[u.type] = (foeCounts[u.type] || 0) + UNIT_VALUE[u.type];
      foeTotal += UNIT_VALUE[u.type];
    }
    const scores = [];
    for (const type of UNIT_ORDER) {
      if (type === 'digger' || !t.allowed.has(type)) continue;
      let s = 1 + this.rng() * 0.6;
      if (foeTotal > 0) {
        let adv = 0, weak = 0;
        for (const ft in foeCounts) {
          adv += (COUNTERS[type]?.[ft] || 0) * foeCounts[ft];
          weak += (COUNTERS[ft]?.[type] || 0) * foeCounts[ft];
        }
        s += (0.6 + this.p.counter * 3) * (adv - weak) / foeTotal;
      }
      // keep a healthy mix: penalise types we already have many of
      s -= w.countType(this.team, type) * 0.1;
      // expensive units become attractive later in the game
      if (type === 'colossus') s += Math.min(1.5, w.time / 300) - 0.8;
      if (type === 'inkcaster' || type === 'shadow') s += Math.min(0.8, w.time / 240) - 0.3;
      if (this.favor?.[type]) s += this.favor[type];
      scores.push([type, s]);
    }
    scores.sort((a, b) => b[1] - a[1]);
    if (!scores.length) return;
    const underThreat = w.armyStrength(1 - this.team, t.monument.x, 700) > w.armyStrength(this.team, t.monument.x, 700) + 1;
    for (let i = 0; i < scores.length; i++) {
      const type = scores[i][0];
      const r = t.train(w, type);
      if (r === '') { this.saving = null; return; }
      if (r === 'pop') return;
      // smart AIs save up for a clearly better pick instead of spamming cheap units
      if (i === 0 && (r === 'gold' || r === 'ink') && !underThreat) {
        const d = UNITS[type];
        const gap = scores.length > 1 ? scores[0][1] - scores[1][1] : 1;
        const close = t.gold >= d.cost * 0.5 && (d.ink === 0 || t.ink >= d.ink * 0.5);
        if ((close || gap > 0.5) && this.rng() < 0.3 + this.p.counter * 0.65) { this.saving = type; return; }
      }
    }
  }

  stance(dt) {
    const w = this.world, t = this.me;
    const myM = t.monument;
    const mine = w.armyStrength(this.team);
    const theirs = w.armyStrength(1 - this.team);
    const threatNear = w.armyStrength(1 - this.team, myM.x, 650);
    const myNear = w.armyStrength(this.team, myM.x, 700);
    let stance = t.stance;

    if (threatNear > 0 && myNear < threatNear * 0.45 && myM.hp < myM.maxHp * 0.5 && this.p.counter >= 0.5) {
      stance = 'garrison';
    } else if (threatNear > 0.5 && stance !== 'attack') {
      stance = 'defend';
    } else {
      const armyCount = w.teamUnits[this.team].filter((u) => u.type !== 'digger').length;
      if (stance !== 'attack' && armyCount >= this.p.minArmy && mine > theirs * this.p.aggression) stance = 'attack';
      else if (stance === 'attack' && mine < theirs * 0.7) stance = 'defend';
      else if (stance === 'garrison' && threatNear < 0.5) stance = 'defend';
      // late game: don't turtle forever
      if (stance === 'defend' && w.time > 240 && mine > 12 && mine > theirs * 0.9) stance = 'attack';
    }
    if (stance === 'attack' && threatNear > mine * 0.8 && threatNear > 2) stance = 'defend';
    t.stance = stance;
  }

  spells() {
    const w = this.world, t = this.me;
    if (!this.p.spells || !t.canCast() || w.time < 90) return;
    // keep ink for units unless there's a juicy cluster
    let best = null, bestN = 0;
    for (const u of w.teamUnits[1 - this.team]) {
      if (u.garrisoned || u.stealth || u.type === 'digger') continue;
      let n = 0;
      for (const v of w.teamUnits[1 - this.team]) if (!v.garrisoned && Math.abs(v.x - u.x) < SPELL.radius) n += v.type === 'digger' ? 0.2 : 1;
      if (n > bestN) { bestN = n; best = u.x; }
    }
    const need = this.difficulty === 'insane' ? 4 : this.difficulty === 'hard' ? 5 : 6;
    if (best !== null && bestN >= need) w.castSpell(this.team, best);
  }
}

// Endless Defense wave director: spawns escalating waves for the red team.
export class WaveDirector {
  constructor(world) {
    this.world = world;
    this.wave = 0;
    this.breakT = 25;
    this.spawnQueue = [];
    this.spawnT = 0;
    this.active = false;
    world.teams[1].stance = 'attack';
  }

  composition(wave) {
    const budget = 110 + wave * 140 + Math.pow(wave, 1.7) * 35;
    const pool = ['blade', 'blade', 'bowman'];
    if (wave >= 3) pool.push('shieldbearer');
    if (wave >= 5) pool.push('inkcaster');
    if (wave >= 6) pool.push('shadow');
    if (wave >= 4) pool.push('bowman');
    const list = [];
    let left = budget;
    if (wave % 5 === 0) { list.push('colossus'); left -= UNITS.colossus.cost * 0.6; }
    let guard = 0;
    while (left > 60 && guard++ < 200) {
      const type = pool[Math.floor(Math.random() * pool.length)];
      const c = UNITS[type].cost + UNITS[type].ink * 20;
      if (c > left && left > 120) continue;
      list.push(type);
      left -= c;
    }
    return list;
  }

  update(dt) {
    const w = this.world;
    if (!this.active) {
      this.breakT -= dt;
      if (this.breakT <= 0) {
        this.wave++;
        this.active = true;
        this.spawnQueue = this.composition(this.wave);
        this.spawnT = 0;
        w.emit('wave', { wave: this.wave, count: this.spawnQueue.length });
        // enemies get tougher every wave
        const t = w.teams[1];
        t.mods.allHp = 1 + this.wave * 0.06;
        t.mods.allDmg = 1 + this.wave * 0.04;
        if (this.wave >= 8) for (const k of Object.keys(t.tiers)) t.tiers[k] = 1;
      }
      return;
    }
    if (this.spawnQueue.length) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        const type = this.spawnQueue.shift();
        const u = w.spawnUnit(type, 1);
        if (type === 'colossus' && this.wave % 10 === 0) { u.boss = true; u.applyStats(w, false); u.hp = u.maxHp; }
        this.spawnT = 0.7;
      }
      return;
    }
    const alive = w.teamUnits[1].length;
    if (alive === 0) {
      this.active = false;
      this.breakT = 10;
      const bonus = 100 + this.wave * 25;
      w.teams[0].gold += bonus;
      w.emit('waveClear', { wave: this.wave, bonus });
    }
  }
}
