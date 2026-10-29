// The battlefield simulation: units, structures, resource nodes, projectiles.
// Has no DOM dependency so it can run headless for AI/balance tests.
import { UNITS, UNIT_VALUE, DEPTH, MONUMENT, SPELL, DIFFICULTY, TEAM_COLORS } from '../config.js';
import { clamp, sign, Pool } from '../core/util.js';
import { Unit } from './unit.js';
import { Team } from './team.js';

const FRONT_TYPES = { shieldbearer: 0, colossus: 1, blade: 2, shadow: 3, digger: 9 };
const BACK_TYPES = { bowman: 0, inkcaster: 1 };

export class World {
  constructor(opts = {}) {
    this.width = opts.width ?? 3000;
    this.biome = opts.biome ?? 'grassland';
    this.mode = opts.mode ?? 'skirmish';
    this.rules = opts.rules ?? {};
    this.time = 0;
    this.over = false;
    this.winner = -1;
    this.endT = 0;
    this.listeners = [];
    this.fx = null;
    this.units = [];
    this.teamUnits = [[], []];
    this.frontX = [null, null];
    this.ais = [];
    this.difficulty = opts.difficulty ?? 'normal';
    this.control = { unit: null, moveX: 0, moveZ: 0, attack: false, special: false, specialPressed: false };
    this.projectiles = new Pool(() => ({ active: false }), 400);
    this.slotT = 0;

    const t0 = opts.teams?.[0] ?? {}, t1 = opts.teams?.[1] ?? {};
    this.teams = [new Team(0, t0), new Team(1, t1)];
    this.structures = [];
    const mHp = [MONUMENT.hp * (t0.monumentHp ?? 1), MONUMENT.hp * (t1.monumentHp ?? 1)];
    const mx = [170, this.width - 170];
    for (let i = 0; i < 2; i++) {
      const m = this.makeStructure('monument', i, mx[i], mHp[i], MONUMENT.width / 2, MONUMENT.height);
      this.teams[i].monument = m;
    }
    if (opts.teams?.[1]?.invulnerable) this.teams[1].monument.invulnerable = true;

    // resource nodes near each base
    this.nodes = [];
    const goldAmt = this.rules.limitedGold ?? Infinity;
    const inkAmt = this.rules.limitedInk ?? Infinity;
    for (let i = 0; i < 2; i++) {
      const dir = this.teams[i].dir, x = mx[i];
      this.nodes.push(this.makeNode('gold', i, x + dir * 150, 6, 3, goldAmt));
      this.nodes.push(this.makeNode('gold', i, x + dir * 235, 24, 3, goldAmt));
      this.nodes.push(this.makeNode('ink', i, x + dir * 330, 12, 2, inkAmt));
    }
  }

  makeStructure(kind, team, x, hp, halfW, height) {
    const s = { isStructure: true, kind, team, x, z: DEPTH / 2, hp, maxHp: hp, halfW, height, dead: false, alive: true,
      shake: 0, invulnerable: false, collapseT: 0, hitT: 0 };
    this.structures.push(s);
    return s;
  }

  makeNode(kind, team, x, z, capacity, amount) {
    return { kind, team, x, z, capacity, amount, start: amount, assigned: 0, mining: 0 };
  }

  // ---------------- events ----------------
  on(fn) { this.listeners.push(fn); }
  emit(type, data) { for (const fn of this.listeners) fn(type, data); }
  shake(n) { this.emit('shake', n); }
  hitStop(t) { this.emit('hitstop', t); }

  // ---------------- spawning ----------------
  spawnUnit(type, teamId, x, z) {
    const team = this.teams[teamId];
    const sx = x ?? team.monument.x + team.dir * 50;
    const sz = z ?? 4 + Math.random() * (DEPTH - 8);
    const u = new Unit(this, type, teamId, sx, sz);
    this.units.push(u);
    this.emit('spawn', { unit: u });
    return u;
  }

  spawnProjectile(o) {
    const p = this.projectiles.acquire();
    p.kind = o.kind; p.x = p.px = o.x; p.y = p.py = o.y; p.z = p.pz = o.z;
    p.vx = o.vx; p.vy = o.vy; p.vz = o.vz || 0; p.g = o.g ?? 600;
    p.team = o.team; p.dmg = o.dmg; p.owner = o.owner || null;
    p.delay = o.delay || 0; p.life = o.life ?? 4; p.aoe = o.aoe || 0;
    p.tx = o.tx ?? null; p.age = 0;
    return p;
  }

  // ---------------- queries ----------------
  enemiesOf(team) { return this.teamUnits[1 - team]; }
  alliesOf(team) { return this.teamUnits[team]; }

  findTarget(unit, range, opts = {}) {
    let best = null, bestScore = Infinity;
    const enemies = this.teamUnits[1 - unit.team];
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive || e.garrisoned) continue;
      const dx = e.x - unit.x;
      const ad = Math.abs(dx);
      if (e.stealth && ad > 34 && !(unit.controlled && ad < 60)) continue;
      if (ad > range + e.halfW) continue;
      if (opts.facingOnly && dx * unit.facing < -10) continue;
      let score = ad + Math.abs(e.z - unit.z) * 0.5;
      if (opts.prefer === 'ranged' && !e.def.melee) score -= 140;
      if (opts.prefer === 'ranged' && e.type === 'digger') score -= 40;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    for (const s of this.structures) {
      if (s.team === unit.team || s.dead) continue;
      const d = Math.max(0, Math.abs(s.x - unit.x) - s.halfW);
      if (d > range) continue;
      if (opts.facingOnly && (s.x - unit.x) * unit.facing < -s.halfW) continue;
      const score = d + 30; // prefer units over buildings at equal distance
      if (score < bestScore) { bestScore = score; best = s; }
    }
    return best;
  }

  findTargetFrom(team, x, range) {
    let best = null, bd = Infinity;
    for (const e of this.teamUnits[1 - team]) {
      if (!e.alive || e.garrisoned || e.stealth) continue;
      const d = Math.abs(e.x - x);
      if (d < range && d < bd) { bd = d; best = e; }
    }
    return best;
  }

  enemyStructureNear(unit, reach) {
    for (const s of this.structures) {
      if (s.team === unit.team || s.dead) continue;
      const d = (s.x - unit.x) * unit.facing;
      if (d > -s.halfW && d - s.halfW < reach) return s;
    }
    return null;
  }

  countEnemiesNear(team, x, r) {
    let n = 0;
    for (const e of this.teamUnits[1 - team]) if (e.alive && !e.garrisoned && Math.abs(e.x - x) < r) n++;
    return n;
  }

  // densest enemy position within r of x (for AoE aiming)
  clusterNear(team, x, r) {
    const enemies = this.teamUnits[1 - team];
    let bestX = x, bestN = 0;
    for (const a of enemies) {
      if (!a.alive || a.garrisoned || a.stealth || Math.abs(a.x - x) > r) continue;
      let n = 0;
      for (const b of enemies) if (b.alive && !b.garrisoned && Math.abs(b.x - a.x) < 45) n++;
      if (n > bestN) { bestN = n; bestX = a.x; }
    }
    return { x: bestX, count: bestN };
  }

  rangedThreat(unit) {
    for (const e of this.teamUnits[1 - unit.team]) {
      if (!e.alive || e.def.melee || e.garrisoned) continue;
      if (Math.abs(e.x - unit.x) < e.range + 40) return true;
    }
    return false;
  }

  defendLine(team) {
    const t = this.teams[team];
    const statue = this.structures.find((s) => s.kind === 'statue' && s.team === team && !s.dead);
    if (statue) return statue.x + t.dir * 60;
    return t.monument.x + t.dir * 250;
  }

  pickNode(digger) {
    let best = null, bs = Infinity;
    for (const n of this.nodes) {
      if (n.team !== digger.team || n.amount <= 0) continue;
      const s = n.assigned / n.capacity + (n.kind === 'ink' ? 0.25 : 0);
      if (s < bs) { bs = s; best = n; }
    }
    return best;
  }

  aiSkill(team) {
    const ai = this.ais.find((a) => a.team === team);
    if (!ai) return 0.6;
    return DIFFICULTY[ai.difficulty]?.counter ?? 0.5;
  }
  accuracyFor(team, controlled) {
    if (controlled) return 0.98;
    const ai = this.ais.find((a) => a.team === team);
    return ai ? DIFFICULTY[ai.difficulty].accuracy : 0.9;
  }
  incomeMul(team) {
    const ai = this.ais.find((a) => a.team === team);
    const base = ai ? DIFFICULTY[ai.difficulty].income : 1;
    return base * (this.rules.incomeMul?.[team] ?? 1);
  }

  // ---------------- combat ----------------
  damage(t, amount, src, opts = {}) {
    if (this.over && t.isStructure) return;
    const srcTeam = src ? src.team : opts.team ?? -1;
    if (t.isStructure) {
      if (t.dead || t.invulnerable) return;
      t.hp -= amount;
      t.shake = 0.3; t.hitT = 0.12;
      if (srcTeam >= 0 && srcTeam !== t.team) this.teams[srcTeam].stats.damage += amount;
      this.fx?.chips(t, src ? src.x : t.x, opts.kind);
      this.emit('sfx', { name: opts.kind === 'arrow' ? 'thunk' : 'stonehit', x: t.x, quiet: true });
      this.emit('structureHit', { s: t, amount });
      if (t.hp <= 0) { t.hp = 0; this.destroyStructure(t); }
      return;
    }
    if (!t.alive || t.garrisoned || t.dashT > 0) return;
    let a = amount;
    const fromDir = src ? (sign(t.x - src.x) || 1) : (opts.dir || -t.facing);
    let blocked = false;
    if (t.braced && src && sign(src.x - t.x) === t.facing) {
      a *= opts.kind === 'blast' ? 1 : opts.kind === 'smash' ? 0.8 : t.braceMul;
      blocked = true;
    }
    if (t.controlled) a *= 0.75;
    if (opts.kind === 'arrow' && t.def.arrowVuln) a *= t.def.arrowVuln;
    if (opts.spell && t.type === 'digger') a *= SPELL.workerMul; // workers duck for cover
    t.hp -= a;
    t.hitFlash = 0.1;
    t.lastHitDir = fromDir;
    if (t.type === 'shadow') t.reveal(1.2);
    if (t.type === 'digger' && t.mining && src && !src.isStructure) { /* keep mining — they're stubborn */ }
    if (opts.knock && !blocked && t.type !== 'colossus') {
      const k = opts.knock / t.scale;
      t.vx = fromDir * k;
      if (opts.lift) { t.vy = -opts.lift / (t.scale * t.scale); t.y = Math.min(t.y, -1); t.atkT = -1; t.castT = -1; }
    } else if (opts.knock && t.type === 'colossus' && opts.lift) {
      t.vx = fromDir * opts.knock * 0.15;
    }
    if (srcTeam >= 0) this.teams[srcTeam].stats.damage += a;
    this.fx?.hit(t, opts.kind || 'slash', fromDir, blocked, src);
    this.emit('hit', { unit: t, amount: a, kind: opts.kind, blocked, src });
    if (src && src.controlled) { this.hitStop(opts.kind === 'arrow' ? 0.03 : 0.055); this.shake(3); }
    if (t.hp <= 0) this.kill(t, src, fromDir, opts);
  }

  kill(u, src, dir, opts = {}) {
    if (!u.alive) return;
    u.alive = false;
    u.hp = 0;
    u.releaseNode?.();
    u.killer = src;
    this.teams[u.team].stats.lost++;
    const killerTeam = src && src.team !== undefined ? src.team : opts.team;
    if (killerTeam !== undefined && killerTeam >= 0 && killerTeam !== u.team) this.teams[killerTeam].stats.kills++;
    const force = 120 + (opts.knock || 0) * 1.2 + (opts.lift || 0) * 0.6;
    this.fx?.ragdoll(u, dir, force, opts.lift || 0);
    this.emit('death', { unit: u, src });
    if (u.controlled) this.releaseControl(true);
    this.rules.onDeath?.(this, u, src);
  }

  blast(x, z, r, dmg, team, src, opts = {}) {
    const hitUnit = (u) => {
      if (!u.alive || u.garrisoned) return;
      const dx = Math.abs(u.x - x), dz = Math.abs(u.z - z);
      if (dx > r + u.halfW || dz > r * 0.6 + 12) return;
      const f = 1 - 0.5 * Math.min(1, dx / r);
      this.damage(u, dmg * f, src, { kind: opts.kind || 'blast', knock: (opts.knock || 0) * f, lift: (opts.lift || 0) * f, team, dir: sign(u.x - x), spell: opts.spell });
    };
    if (team === -1) { for (const u of this.units) hitUnit(u); }
    else { const list = this.teamUnits[1 - team].slice(); for (const u of list) hitUnit(u); }
    for (const s of this.structures) {
      if (s.dead || (team !== -1 && s.team === team)) continue;
      if (Math.abs(s.x - x) < r + s.halfW) this.damage(s, dmg * (opts.structureMul ?? 0.6), src, { kind: 'blast', team });
    }
    this.fx?.explosion(x, z, r, opts.kind === 'smash' ? 'smash' : 'ink', team >= 0 ? TEAM_COLORS[team] : '#ff6a1a', opts.ring);
    if (opts.kind !== 'smash') { this.emit('sfx', { name: 'explode', x }); this.shake(opts.shake ?? 5); }
  }

  destroyStructure(s) {
    s.dead = true; s.alive = false; s.collapseT = 0;
    this.emit('structureDestroyed', { s });
    this.emit('sfx', { name: 'collapse', x: s.x });
    this.shake(18);
    if (s.kind === 'monument' && !this.over) this.endGame(1 - s.team);
    if (s.kind === 'statue' && !this.over) this.endGame(1 - s.team);
  }

  endGame(winner) {
    if (this.over) return;
    this.over = true;
    this.winner = winner;
    this.endT = 0;
    if (this.control.unit) this.releaseControl();
    this.emit('gameover', { winner });
  }

  castSpell(teamId, x) {
    const team = this.teams[teamId];
    if (!team.canCast()) return false;
    team.ink -= SPELL.ink;
    team.spellCd = SPELL.cd;
    team.stats.spells++;
    for (let i = 0; i < SPELL.bombs; i++) {
      const bx = x + (Math.random() - 0.5) * SPELL.radius * 2;
      this.spawnProjectile({ kind: 'bomb', x: bx - 40, y: -460 - Math.random() * 80, z: 4 + Math.random() * (DEPTH - 8), vx: 60, vy: 260,
        g: 500, team: teamId, dmg: SPELL.dmg * team.mods.spellDmg, aoe: 52, delay: i * 0.14, life: 5, tx: bx });
    }
    this.emit('spell', { team: teamId, x });
    this.emit('sfx', { name: 'spell', x });
    return true;
  }

  // ---------------- direct control ----------------
  setControl(unit) {
    if (!unit || unit.team !== 0 || !unit.alive) return;
    if (this.control.unit) this.releaseControl();
    unit.controlled = true;
    unit.garrisoned = false;
    unit.braceHold = false;
    if (unit.type === 'digger') { unit.releaseNode(); unit.mining = false; }
    unit.target = null;
    this.control.unit = unit;
    this.emit('control', { unit });
  }
  releaseControl(died = false) {
    const u = this.control.unit;
    if (!u) return;
    u.controlled = false;
    u.braced = false;
    this.control.unit = null;
    this.control.moveX = this.control.moveZ = 0;
    this.control.attack = this.control.special = false;
    this.emit('release', { unit: u, died });
  }

  // ---------------- update ----------------
  update(dt) {
    this.time += dt;
    if (this.over) this.endT += dt;
    // rebuild per-team lists
    const tu0 = this.teamUnits[0], tu1 = this.teamUnits[1];
    tu0.length = 0; tu1.length = 0;
    for (const u of this.units) if (u.alive) (u.team === 0 ? tu0 : tu1).push(u);
    this.updateFormation(dt);

    if (!this.over) {
      for (const t of this.teams) t.update(this, dt);
      for (const ai of this.ais) ai.update(dt);
      this.rules.update?.(this, dt);
    }
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (u.alive) u.update(this, dt);
    }
    this.updateProjectiles(dt);
    // compact dead units
    let w = 0;
    for (let i = 0; i < this.units.length; i++) { const u = this.units[i]; if (u.alive) this.units[w++] = u; }
    this.units.length = w;
    for (const s of this.structures) {
      if (s.shake > 0) s.shake -= dt;
      if (s.hitT > 0) s.hitT -= dt;
      if (s.dead) s.collapseT += dt;
    }
    if (!this.over) this.rules.checkEnd?.(this);
  }

  updateFormation(dt) {
    for (let ti = 0; ti < 2; ti++) {
      const team = this.teams[ti], dir = team.dir;
      const list = this.teamUnits[ti];
      // front line = most advanced melee soldier (ranged hang back behind it)
      let front = null;
      for (const u of list) {
        if (!u.def.melee || u.type === 'digger' || u.garrisoned || u.stealth) continue;
        if (front === null || (u.x - front) * dir > 0) front = u.x;
      }
      this.frontX[ti] = front;
    }
    this.slotT -= dt;
    if (this.slotT > 0) return;
    this.slotT = 0.3;
    for (let ti = 0; ti < 2; ti++) {
      const team = this.teams[ti], dir = team.dir;
      const line = this.defendLine(ti);
      const fronts = [], backs = [];
      for (const u of this.teamUnits[ti]) {
        if (u.type === 'digger') { u.slotZ = 4 + (u.id % 6) * 5; continue; }
        if (u.type in BACK_TYPES) backs.push(u); else fronts.push(u);
      }
      fronts.sort((a, b) => (FRONT_TYPES[a.type] - FRONT_TYPES[b.type]) || a.id - b.id);
      backs.sort((a, b) => (BACK_TYPES[a.type] - BACK_TYPES[b.type]) || a.id - b.id);
      const rowW = 4;
      fronts.forEach((u, i) => {
        const row = Math.floor(i / rowW), col = i % rowW;
        u.slotX = line - dir * row * 24 - dir * (u.type === 'colossus' ? -10 : 0);
        u.slotZ = 3 + col * ((DEPTH - 6) / (rowW - 1));
      });
      backs.forEach((u, i) => {
        const row = Math.floor(i / rowW), col = i % rowW;
        u.slotX = line - dir * (75 + row * 24);
        u.slotZ = 3 + col * ((DEPTH - 6) / (rowW - 1)) + (row % 2) * 4;
      });
    }
  }

  updateProjectiles(dt) {
    const items = this.projectiles.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.px = p.x; p.py = p.y; p.pz = p.z;
      p.age += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z = clamp(p.z + p.vz * dt, 0, DEPTH);
      p.life -= dt;
      if (p.life <= 0 || p.x < -200 || p.x > this.width + 200) { p.active = false; continue; }
      if (p.kind === 'arrow') this.arrowCollide(p);
      else if (p.kind === 'orb') this.orbCollide(p);
      if (p.active && p.y >= 0) {
        p.y = 0;
        if (p.kind === 'arrow') { this.fx?.arrowGround(p); this.emit('sfx', { name: 'arrowland', x: p.x, quiet: true }); }
        else if (p.kind === 'orb') this.blast(p.x, p.z, p.aoe, p.dmg, p.team, p.owner, { kind: 'blast', knock: 90, lift: 160, structureMul: 0.6 });
        else if (p.kind === 'bomb') this.blast(p.x, p.z, p.aoe, p.dmg, p.team, null, { kind: 'blast', knock: 110, lift: 200, structureMul: 0.3, shake: 6, spell: true });
        else if (p.kind === 'meteor') this.blast(p.x, p.z, p.aoe, p.dmg, -1, null, { kind: 'blast', knock: 130, lift: 220, structureMul: 0.2, shake: 8 });
        p.active = false;
      }
    }
  }

  arrowCollide(p) {
    const enemies = this.teamUnits[1 - p.team];
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive || e.garrisoned || e.stealth) continue;
      if (Math.abs(e.x - p.x) > e.halfW + 3) continue;
      if (Math.abs(e.z - p.z) > 14) continue;
      if (p.y < e.y - e.height || p.y > e.y + 2) continue;
      // braced shield blocks frontal arrows entirely
      if (e.braced && sign(p.vx) === -e.facing && Math.random() < 0.8) {
        this.fx?.arrowBlocked(p, e);
        this.emit('sfx', { name: 'block', x: e.x, quiet: true });
        p.active = false;
        return;
      }
      this.fx?.arrowStick(p, e);
      this.damage(e, p.dmg, p.owner && p.owner.alive ? p.owner : { team: p.team, x: p.x - sign(p.vx) * 10, controlled: p.owner?.controlled }, { kind: 'arrow', knock: 30 });
      p.active = false;
      return;
    }
    for (const s of this.structures) {
      if (s.dead || s.team === p.team) continue;
      if (Math.abs(p.x - s.x) < s.halfW * 0.8 && p.y > -s.height * 0.95) {
        this.fx?.arrowStickStructure(p, s);
        this.damage(s, p.dmg, p.owner, { kind: 'arrow' });
        p.active = false;
        return;
      }
    }
  }

  orbCollide(p) {
    const enemies = this.teamUnits[1 - p.team];
    for (const e of enemies) {
      if (!e.alive || e.garrisoned) continue;
      if (Math.abs(e.x - p.x) < e.halfW + 6 && p.y > e.y - e.height && Math.abs(e.z - p.z) < 16) {
        this.blast(p.x, p.z, p.aoe, p.dmg, p.team, p.owner, { kind: 'blast', knock: 90, lift: 160 });
        p.active = false; return;
      }
    }
    for (const s of this.structures) {
      if (s.dead || s.team === p.team) continue;
      if (Math.abs(p.x - s.x) < s.halfW && p.y > -s.height) {
        this.blast(p.x, p.z, p.aoe, p.dmg, p.team, p.owner, { kind: 'blast', structureMul: 0.6 });
        p.active = false; return;
      }
    }
  }

  // ---------------- helpers for UI / AI ----------------
  armyStrength(team, nearX = null, radius = Infinity) {
    let s = 0;
    for (const u of this.teamUnits[team]) {
      if (u.type === 'digger') continue;
      if (nearX !== null && Math.abs(u.x - nearX) > radius) continue;
      s += (UNIT_VALUE[u.type] || 1) * (0.4 + 0.6 * u.hp / u.maxHp);
    }
    return s;
  }
  countType(team, type) {
    let n = 0;
    for (const u of this.teamUnits[team]) if (u.type === type) n++;
    return n + this.teams[team].queues[type].count;
  }
}
