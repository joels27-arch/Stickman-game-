// Persistent progress (localStorage): gems, stars, armory, skins, settings.
import { UNIT_ORDER } from './config.js';

const KEY = 'inkfall.save.v1';

export const ARMORY = {
  training: { name: 'Combat Training', desc: '+8% HP & damage per level', max: 3, costs: [20, 40, 70] },
  startGold: { name: 'War Chest', desc: '+60 starting gold per level', max: 5, costs: [15, 25, 40, 60, 90] },
  monument: { name: 'Fortified Monument', desc: '+10% monument HP per level', max: 5, costs: [15, 25, 40, 60, 90] },
  mining: { name: 'Golden Picks', desc: '+8% mining yield per level', max: 3, costs: [30, 50, 80] },
  pop: { name: 'Barracks', desc: '+3 population cap per level', max: 3, costs: [30, 50, 80] },
  spell: { name: 'Storm Lore', desc: '+15% Ink Storm damage per level', max: 3, costs: [25, 45, 70] },
};
export const UNLOCK_COST = { shieldbearer: 40, inkcaster: 60, shadow: 60, colossus: 100 };

export const SKIN_COLORS = {
  classic: { name: 'Classic', main: '#2f7de1', dark: '#1a4f99', cost: 0 },
  azure: { name: 'Azure', main: '#29a8ff', dark: '#1a6ea8', cost: 25 },
  cobalt: { name: 'Cobalt', main: '#2346d8', dark: '#162c85', cost: 25 },
  teal: { name: 'Teal', main: '#14b8a6', dark: '#0d7a6e', cost: 30 },
  violet: { name: 'Violet', main: '#7c4dff', dark: '#4c2aa8', cost: 35 },
};
export const SKIN_HATS = {
  none: { name: 'No Hat', cost: 0 },
  bandana: { name: 'Bandana', cost: 20 },
  tophat: { name: 'Top Hat', cost: 30 },
  horns: { name: 'Horns', cost: 30 },
  crown: { name: 'Crown', cost: 50 },
  halo: { name: 'Halo', cost: 60 },
};

function defaults() {
  const training = {};
  for (const t of UNIT_ORDER) training[t] = 0;
  return {
    v: 1,
    gems: 0,
    stars: {},          // level id -> best stars
    cleared: {},        // level id -> true
    armory: { training, startGold: 0, monument: 0, mining: 0, pop: 0, spell: 0 },
    unlocked: { digger: true, blade: true, bowman: true, shieldbearer: false, inkcaster: false, shadow: false, colossus: false },
    skins: { owned: ['classic', 'none'], color: 'classic', hat: 'none' },
    settings: { sound: true, music: true, dmgNumbers: false, quality: 'auto', shake: true, fps: false },
    endlessBest: 0,
    tutorialDone: false,
    totals: { battles: 0, wins: 0, kills: 0 },
  };
}

function merge(base, over) {
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') merge(base[k], over[k]);
    else base[k] = over[k];
  }
  return base;
}

export const Save = {
  data: defaults(),
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = merge(defaults(), JSON.parse(raw));
    } catch (e) { this.data = defaults(); }
    return this.data;
  },
  write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* storage full / private mode */ }
  },
  reset() { this.data = defaults(); this.write(); },

  isUnlocked(type) { return !!this.data.unlocked[type]; },
  unlockedList() { return UNIT_ORDER.filter((t) => this.data.unlocked[t]); },

  spend(n) {
    if (this.data.gems < n) return false;
    this.data.gems -= n;
    this.write();
    return true;
  },

  // Team options for the player derived from Armory upgrades + skin.
  playerTeamOpts(extraGold = 0) {
    const a = this.data.armory;
    const opts = {
      gold: 300 + a.startGold * 60 + extraGold,
      monumentHp: 1 + a.monument * 0.1,
      mine: 1 + a.mining * 0.08,
      popCap: 20 + a.pop * 3,
      spellDmg: 1 + a.spell * 0.15,
    };
    return opts;
  },
  applyTraining(team) {
    const tr = this.data.armory.training;
    for (const t of UNIT_ORDER) {
      team.mods.hp[t] = 1 + (tr[t] || 0) * 0.08;
      team.mods.dmg[t] = 1 + (tr[t] || 0) * 0.08;
    }
  },
};
