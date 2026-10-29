// Team state: resources, training queues, upgrades, stance and stats.
import { UNITS, UNIT_ORDER, ECONOMY, SPELL } from '../config.js';

export class Team {
  constructor(id, opts = {}) {
    this.id = id;
    this.dir = id === 0 ? 1 : -1;             // direction toward the enemy
    this.gold = opts.gold ?? ECONOMY.startGold;
    this.ink = opts.ink ?? ECONOMY.startInk;
    this.popCap = opts.popCap ?? ECONOMY.popCap;
    this.popCapMax = ECONOMY.popCapMax;
    this.popUpgrades = 0;
    this.stance = 'defend';
    this.allowed = new Set(opts.allowed ?? UNIT_ORDER);
    this.tiers = {};                           // type -> 0|1 (one upgrade tier)
    this.queues = {};                          // type -> { count, t }
    for (const t of UNIT_ORDER) { this.tiers[t] = 0; this.queues[t] = { count: 0, t: 0 }; }
    // permanent multipliers (Armory for the player, difficulty/level for the AI)
    this.mods = {
      hp: {}, dmg: {},                         // per type multipliers
      mine: opts.mine ?? 1,                    // mining yield
      trainSpeed: opts.trainSpeed ?? 1,
      spellDmg: opts.spellDmg ?? 1,
      allHp: opts.allHp ?? 1, allDmg: opts.allDmg ?? 1,
      speed: opts.speed ?? 1,
    };
    for (const t of UNIT_ORDER) { this.mods.hp[t] = 1; this.mods.dmg[t] = 1; }
    this.spellCd = 0;
    this.monument = null;
    this.skin = opts.skin ?? null;            // cosmetic (player only)
    this.stats = { trained: 0, lost: 0, kills: 0, gold: 0, ink: 0, damage: 0, spells: 0 };
    this.isAI = false;
  }

  pop(world) {
    let p = 0;
    for (const u of world.units) if (u.team === this.id && u.alive) p += UNITS[u.type].pop;
    for (const t of UNIT_ORDER) p += this.queues[t].count * UNITS[t].pop;
    return p;
  }

  canAfford(type) {
    const d = UNITS[type];
    return this.gold >= d.cost && this.ink >= d.ink;
  }

  // Returns '' on success or a short reason string.
  train(world, type) {
    if (!this.allowed.has(type)) return 'locked';
    const d = UNITS[type];
    if (this.queues[type].count >= 5) return 'queue full';
    if (this.gold < d.cost) return 'gold';
    if (this.ink < d.ink) return 'ink';
    if (this.pop(world) + d.pop > this.popCap) return 'pop';
    this.gold -= d.cost;
    this.ink -= d.ink;
    const q = this.queues[type];
    if (q.count === 0) q.t = 0;
    q.count++;
    return '';
  }

  cancel(type) {
    const q = this.queues[type];
    if (q.count <= 0) return;
    q.count--;
    if (q.count === 0) q.t = 0;
    this.gold += UNITS[type].cost;
    this.ink += UNITS[type].ink;
  }

  upgradeCost(type) { return UNITS[type].upgrade; }

  buyUpgrade(world, type) {
    if (this.tiers[type] >= 1) return 'maxed';
    if (!this.allowed.has(type)) return 'locked';
    const up = UNITS[type].upgrade;
    if (this.gold < up.cost) return 'gold';
    if (this.ink < up.ink) return 'ink';
    this.gold -= up.cost;
    this.ink -= up.ink;
    this.tiers[type] = 1;
    for (const u of world.units) if (u.team === this.id && u.type === type && u.alive) u.applyStats(world, true);
    world.emit('upgrade', { team: this.id, type });
    return '';
  }

  popUpgradeCost() { return ECONOMY.popUpgradeCost + this.popUpgrades * 75; }

  buyPop(world) {
    if (this.popCap >= this.popCapMax) return 'maxed';
    const c = this.popUpgradeCost();
    if (this.gold < c) return 'gold';
    this.gold -= c;
    this.popUpgrades++;
    this.popCap = Math.min(this.popCapMax, this.popCap + ECONOMY.popUpgradeStep);
    world.emit('upgrade', { team: this.id, type: 'pop' });
    return '';
  }

  canCast() { return this.spellCd <= 0 && this.ink >= SPELL.ink; }

  update(world, dt) {
    if (this.spellCd > 0) this.spellCd -= dt;
    for (const type of UNIT_ORDER) {
      const q = this.queues[type];
      if (q.count <= 0) continue;
      q.t += dt * this.mods.trainSpeed;
      if (q.t >= UNITS[type].time) {
        q.t = 0;
        q.count--;
        world.spawnUnit(type, this.id);
        this.stats.trained++;
      }
    }
  }
}
