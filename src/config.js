// INKFALL — game data: unit stats, difficulty, biomes, economy constants.
// Everything tunable lives here so balancing never touches logic code.

export const SIM_HZ = 60;
export const DT = 1 / SIM_HZ;
export const GRAVITY = 900;          // world units / s^2 (y grows downward)
export const DEPTH = 34;             // depth band units can stand in (z: 0..DEPTH)
export const DEPTH_SCALE = 0.9;      // how far z pushes a unit down on screen
export const VIEW_HEIGHT = 400;      // world units visible vertically
export const GROUND_FRAC = 0.68;     // ground line position (fraction of screen height)

export const TEAM_BLUE = 0;
export const TEAM_RED = 1;

export const TEAM_COLORS = ['#2f7de1', '#e03b3b'];
export const TEAM_DARK = ['#1a4f99', '#8f1f1f'];

export const UNIT_ORDER = ['digger', 'blade', 'bowman', 'shieldbearer', 'inkcaster', 'shadow', 'colossus'];

// cost: gold, ink: crystals, time: train seconds, pop: population slots
// range is measured edge-to-edge-ish in world units; cd = seconds between attacks
export const UNITS = {
  digger: {
    name: 'Digger', role: 'Worker — mines gold & ink',
    cost: 50, ink: 0, time: 2.5, pop: 1,
    hp: 60, dmg: 5, range: 20, cd: 1.1, speed: 58, scale: 1,
    aggro: 0, melee: true,
    upgrade: { name: 'Deep Picks', cost: 150, ink: 0, desc: '+40% mining yield', mine: 1.4, hp: 1.2 },
    ability: { name: 'Sprint', cd: 8 },
  },
  blade: {
    name: 'Blade', role: 'Fast melee swordsman',
    cost: 75, ink: 0, time: 3, pop: 1,
    hp: 110, dmg: 13, range: 22, cd: 0.8, speed: 88, scale: 1,
    aggro: 170, melee: true,
    upgrade: { name: 'Tempered Steel', cost: 200, ink: 0, desc: '+25% damage, +15% HP', dmg: 1.25, hp: 1.15 },
    ability: { name: 'Dash Slash', cd: 5 },
  },
  bowman: {
    name: 'Bowman', role: 'Ranged archer',
    cost: 120, ink: 0, time: 4, pop: 1,
    hp: 80, dmg: 17, range: 330, cd: 1.65, speed: 62, scale: 1,
    aggro: 380, melee: false,
    upgrade: { name: 'Longbows', cost: 250, ink: 0, desc: '+20% range & damage', dmg: 1.2, range: 1.2 },
    ability: { name: 'Volley', cd: 7 },
  },
  shieldbearer: {
    name: 'Shieldbearer', role: 'Tank — braces to block',
    cost: 160, ink: 0, time: 5, pop: 2,
    hp: 370, dmg: 16, range: 34, cd: 1.4, speed: 42, scale: 1.1,
    aggro: 160, melee: true,
    upgrade: { name: 'Tower Shields', cost: 250, ink: 2, desc: '+30% HP, stronger brace', hp: 1.3, brace: 0.25 },
    ability: { name: 'Brace', cd: 0.5 },
  },
  inkcaster: {
    name: 'Inkcaster', role: 'Mage — area ink blast',
    cost: 190, ink: 3, time: 7, pop: 2,
    hp: 90, dmg: 42, range: 270, cd: 4.2, speed: 46, scale: 1,
    aggro: 320, melee: false, channel: 1.3, aoe: 62,
    upgrade: { name: 'Black Tide', cost: 300, ink: 4, desc: '+30% blast radius, faster channel', aoe: 1.3, channel: 0.75 },
    ability: { name: 'Quick Blast', cd: 9 },
  },
  shadow: {
    name: 'Shadow', role: 'Stealth assassin',
    cost: 170, ink: 2, time: 6, pop: 2,
    hp: 95, dmg: 22, range: 20, cd: 0.9, speed: 98, scale: 0.95,
    aggro: 240, melee: true, backstab: 2.6,
    upgrade: { name: 'Ink Veil', cost: 250, ink: 3, desc: 'Faster restealth, +20% damage', dmg: 1.2, restealth: 0.6 },
    ability: { name: 'Vanish', cd: 10 },
  },
  colossus: {
    name: 'Colossus', role: 'Giant brute — smashes groups',
    cost: 480, ink: 8, time: 14, pop: 5,
    hp: 1250, dmg: 52, range: 54, cd: 2.6, speed: 30, scale: 2.6,
    aggro: 180, melee: true, aoe: 55, arrowVuln: 1.6,
    upgrade: { name: 'Iron Hide', cost: 450, ink: 6, desc: '+30% HP & damage', hp: 1.3, dmg: 1.3 },
    ability: { name: 'Ground Slam', cd: 8 },
  },
};

// Value used by AI for army strength estimates (roughly cost-normalised power).
export const UNIT_VALUE = { digger: 0.3, blade: 1, bowman: 1.4, shieldbearer: 2.1, inkcaster: 2.6, shadow: 2.0, colossus: 6.5 };

// counter[a][b] = how good unit a is against unit b (AI build selection)
export const COUNTERS = {
  blade:        { bowman: 1.2, inkcaster: 1.3, digger: 0.6, blade: 0.5, shadow: 0.6 },
  bowman:       { colossus: 1.2, blade: 0.6, inkcaster: 0.8, shieldbearer: 0.1 },
  shieldbearer: { blade: 1.2, bowman: 1.1, shadow: 0.9 },
  inkcaster:    { blade: 1.1, shieldbearer: 1.1, bowman: 0.8, digger: 0.4 },
  shadow:       { bowman: 1.3, inkcaster: 1.4, digger: 0.6 },
  colossus:     { blade: 1.2, shieldbearer: 1.0, shadow: 0.9 },
};

export const ECONOMY = {
  startGold: 300, startInk: 0,
  goldPerTrip: 18, inkPerTrip: 1,
  mineTimeGold: 2.0, mineTimeInk: 2.6,
  diggersPerGoldMine: 3, diggersPerInkNode: 2,
  popCap: 20, popCapMax: 60, popUpgradeStep: 5, popUpgradeCost: 150,
  passiveGold: 0,              // gold/s trickle (kept 0 — economy is diggers)
};

export const SPELL = { name: 'Ink Storm', ink: 6, cd: 50, dmg: 42, radius: 110, bombs: 6 };

export const MONUMENT = { hp: 5000, width: 110, height: 270 };

export const DIFFICULTY = {
  easy:   { label: 'Easy',   think: 2.6, income: 0.8,  diggers: 5,  aggression: 1.6,  counter: 0.15, spells: false, minArmy: 5, startGold: 0,   upgrades: false, accuracy: 0.7 },
  normal: { label: 'Normal', think: 1.6, income: 1.0,  diggers: 7,  aggression: 1.25, counter: 0.5,  spells: true,  minArmy: 4, startGold: 0,   upgrades: true,  accuracy: 0.85 },
  hard:   { label: 'Hard',   think: 1.0, income: 1.15, diggers: 9,  aggression: 1.05, counter: 0.8,  spells: true,  minArmy: 4, startGold: 100, upgrades: true,  accuracy: 0.95 },
  insane: { label: 'Insane', think: 0.6, income: 1.35, diggers: 10, aggression: 0.95, counter: 1.0,  spells: true,  minArmy: 3, startGold: 250, upgrades: true,  accuracy: 1.0 },
};

export const BIOMES = {
  grassland: { name: 'Grassland', image: 'bg_grassland', sky: ['#8ccfff', '#dff3ff'], hills: ['#9cc98a', '#6fae5c', '#4f8f45'], ground: '#6b9a3f', groundTop: '#8fc34d', dirt: '#7a5a3a', dirtDark: '#5d432b', speed: 1 },
  desert:    { name: 'Desert',    image: 'bg_desert',    sky: ['#ffc988', '#fff0cf'], hills: ['#e8c98a', '#d7aa62', '#c08a45'], ground: '#d6a85c', groundTop: '#ecc982', dirt: '#b98a4a', dirtDark: '#94693a', speed: 1 },
  snow:      { name: 'Snow',      image: 'bg_snow',      sky: ['#a9c6e8', '#eef6ff'], hills: ['#dfe9f5', '#c3d3e6', '#9fb3cc'], ground: '#e9f1fa', groundTop: '#ffffff', dirt: '#b7c6d8', dirtDark: '#8d9fb6', speed: 0.85 },
  volcano:   { name: 'Volcano',   image: 'bg_volcano',   sky: ['#4a1e1a', '#c4512a'], hills: ['#5b3a33', '#43281f', '#2e1a15'], ground: '#3a2a26', groundTop: '#5a3f37', dirt: '#2d201d', dirtDark: '#1d1412', speed: 1, embers: true },
  night:     { name: 'Night',     image: 'bg_night',     sky: ['#0b1430', '#2a3a6a'], hills: ['#26365e', '#1b2747', '#121a30'], ground: '#24365a', groundTop: '#35507a', dirt: '#1d2a44', dirtDark: '#131c30', speed: 1, night: true },
};

export const QUALITY = {
  high: { dprCap: 2, particles: 700, ragdolls: 40, decals: 140, parallax: 3, lightRes: 0.25 },
  low:  { dprCap: 1.25, particles: 260, ragdolls: 14, decals: 50, parallax: 1, lightRes: 0.18 },
};
