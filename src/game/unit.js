// Unit simulation: AI behaviour per type, direct control, attacks and abilities.
// Pure logic — rendering reads anim/animT/atk* fields to pose the stick figure.
import { UNITS, DEPTH, GRAVITY, ECONOMY } from '../config.js';
import { clamp, sign } from '../core/util.js';

let NEXT_ID = 1;

const ATTACK_ANIM = { digger: 0.5, blade: 0.42, bowman: 0.75, shieldbearer: 0.6, inkcaster: 0.5, shadow: 0.32, colossus: 1.1 };
const ARROW_G = 600;

export class Unit {
  constructor(world, type, team, x, z) {
    this.id = NEXT_ID++;
    this.type = type;
    this.def = UNITS[type];
    this.team = team;
    this.x = this.px = x;
    this.z = this.pz = z;
    this.y = this.py = 0;           // vertical offset (negative = airborne)
    this.vx = 0; this.vy = 0;
    this.facing = world.teams[team].dir;
    this.alive = true;
    this.anim = 'idle'; this.animT = 0;
    this.walkPhase = Math.random() * 6;
    this.atkT = -1; this.atkDur = 0; this.atkHit = false; this.atkTarget = null; this.atkKind = 'normal';
    this.cdT = 0;
    this.abilityT = 0;              // ability cooldown remaining
    this.target = null;
    this.thinkT = Math.random() * 0.2;
    this.controlled = false;
    this.garrisoned = false;
    this.hitFlash = 0;
    this.stunT = 0;
    this.slotX = x; this.slotZ = z;
    this.jitter = (Math.random() - 0.5) * 30;
    // type specific
    this.carry = 0; this.carryKind = 'gold'; this.node = null; this.mineT = 0; this.mining = false;
    this.braced = false; this.braceHold = false;
    this.stealth = type === 'shadow'; this.revealT = 0; this.nextBackstab = type === 'shadow';
    this.castT = -1; this.castX = 0; this.castZ = 0; this.quickCast = false;
    this.sprintT = 0; this.dashT = 0; this.dashHit = null;
    this.boss = false;
    this.lastHitDir = this.facing;
    this.killer = null;
    this.applyStats(world, false);
    this.hp = this.maxHp;
  }

  applyStats(world, keepRatio) {
    const d = this.def, team = world.teams[this.team], tier = team.tiers[this.type], up = d.upgrade;
    const ratio = keepRatio ? this.hp / this.maxHp : 1;
    let hp = d.hp * team.mods.hp[this.type] * team.mods.allHp;
    let dmg = d.dmg * team.mods.dmg[this.type] * team.mods.allDmg;
    let range = d.range, aoe = d.aoe || 0, channel = d.channel || 0, mine = 1, brace = 0.55, restealth = 2.5;
    if (tier) {
      hp *= up.hp || 1; dmg *= up.dmg || 1; range *= up.range || 1; aoe *= up.aoe || 1;
      channel *= up.channel || 1; mine = up.mine || 1; if (up.brace) brace = up.brace;
      if (up.restealth) restealth *= up.restealth;
    }
    if (this.boss) { hp *= 3.5; dmg *= 1.35; }
    this.tier = tier;
    this.maxHp = hp; this.dmg = dmg; this.range = range; this.aoe = aoe;
    this.channel = channel; this.mineMul = mine; this.braceMul = brace; this.restealth = restealth;
    this.speed = d.speed * team.mods.speed * (world.rules.speedMul || 1);
    this.scale = d.scale * (this.boss ? 1.35 : 1);
    this.height = 48 * this.scale;
    this.halfW = 6 * this.scale;
    if (keepRatio) this.hp = this.maxHp * ratio;
  }

  get ranged() { return !this.def.melee; }
  get airborne() { return this.y < -0.5 || this.vy < 0; }
  get visibleToEnemy() { return !this.stealth; }

  setAnim(a) { if (this.anim !== a) { this.anim = a; this.animT = 0; } }

  moveToward(world, tx, tz, dt, speedMul = 1) {
    const dx = tx - this.x;
    const sp = this.speed * speedMul * (this.sprintT > 0 ? 1.8 : 1) * (this.controlled ? 1.15 : 1);
    if (Math.abs(dx) > 2) {
      const step = Math.min(Math.abs(dx), sp * dt);
      this.x += sign(dx) * step;
      this.facing = sign(dx);
      this.walkPhase += step * 0.11 / this.scale;
      this.setAnim(this.sprintT > 0 || sp > 80 ? 'run' : 'walk');
    } else {
      this.setAnim(this.carry > 0 && this.type === 'digger' ? 'idle' : 'idle');
    }
    if (tz !== undefined) {
      const dz = tz - this.z;
      if (Math.abs(dz) > 0.5) this.z += sign(dz) * Math.min(Math.abs(dz), 30 * dt);
    }
    return Math.abs(dx) <= 2;
  }

  distTo(t) {
    if (t.isStructure) return Math.max(0, Math.abs(this.x - t.x) - t.halfW);
    return Math.max(0, Math.abs(this.x - t.x) - t.halfW * 0.5);
  }

  // ---------------- main update ----------------
  update(world, dt) {
    this.px = this.x; this.pz = this.z; this.py = this.y;
    this.animT += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.cdT > 0) this.cdT -= dt;
    if (this.abilityT > 0) this.abilityT -= dt;
    if (this.sprintT > 0) this.sprintT -= dt;
    if (this.stunT > 0) this.stunT -= dt;
    if (this.type === 'shadow') this.updateStealth(world, dt);

    // knockback / airborne physics
    if (this.y < 0 || this.vy !== 0 || this.vx !== 0) {
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      this.x += this.vx * dt;
      if (this.y >= 0) { this.y = 0; this.vy = 0; this.vx *= 0.5; if (Math.abs(this.vx) < 5) this.vx = 0; }
      if (this.y < -1) { this.setAnim('air'); this.clampX(world); return; }
    }
    if (this.dashT > 0) { this.updateDash(world, dt); this.clampX(world); return; }
    if (this.stunT > 0) { this.setAnim('idle'); return; }

    // ongoing attack animation
    if (this.atkT >= 0) {
      this.atkT += dt;
      if (!this.atkHit && this.atkT >= this.atkDur * 0.55) { this.atkHit = true; this.resolveAttack(world); }
      if (this.atkT >= this.atkDur) this.atkT = -1;
      else { this.clampX(world); return; }
    }
    // inkcaster channel
    if (this.castT >= 0) {
      this.castT += dt;
      this.setAnim('cast');
      const ch = this.quickCast ? 0.3 : this.channel * (this.controlled ? 0.6 : 1);
      if (this.castT >= ch) { this.castT = -1; this.releaseOrb(world); }
      return;
    }

    if (this.controlled) this.updateControlled(world, dt);
    else if (this.garrisoned) this.updateGarrisoned(world, dt);
    else if (this.type === 'digger') this.updateDigger(world, dt);
    else this.updateSoldier(world, dt);
    this.clampX(world);
  }

  clampX(world) {
    const lo = world.teams[0].monument.x - 140, hi = world.teams[1].monument.x + 140;
    this.x = clamp(this.x, lo, hi);
    this.z = clamp(this.z, 0, DEPTH);
  }

  updateStealth(world, dt) {
    if (this.revealT > 0) {
      this.revealT -= dt;
      if (this.revealT <= 0) { this.stealth = true; this.nextBackstab = true; world.emit('stealth', { unit: this }); }
    }
  }
  reveal(t) { if (this.type !== 'shadow') return; this.stealth = false; this.revealT = Math.max(this.revealT, t); }

  // ---------------- direct control ----------------
  updateControlled(world, dt) {
    const c = world.control;
    const mx = c.moveX, mz = c.moveZ;
    if (this.type === 'shieldbearer') this.braced = c.special;
    if (this.braced) {
      this.setAnim('brace');
      if (Math.abs(mx) > 0.3) this.facing = sign(mx);
    } else if (Math.abs(mx) > 0.15 || Math.abs(mz) > 0.15) {
      const sp = this.speed * 1.15 * (this.sprintT > 0 ? 1.8 : 1);
      this.x += mx * sp * dt;
      this.z += mz * 40 * dt;
      if (Math.abs(mx) > 0.15) this.facing = sign(mx);
      this.walkPhase += Math.abs(mx * sp * dt) * 0.11 / this.scale + Math.abs(mz) * 0.05;
      this.setAnim(sp * Math.abs(mx) > 80 ? 'run' : 'walk');
    } else this.setAnim(this.type === 'digger' && this.carry ? 'idle' : 'idle');

    if (c.attack && this.cdT <= 0) this.controlAttack(world);
    if (c.specialPressed && this.type !== 'shieldbearer') { c.specialPressed = false; this.useAbility(world); }
    // diggers under control still deposit/mine by proximity
    if (this.type === 'digger') {
      const team = world.teams[this.team];
      if (this.carry > 0 && Math.abs(this.x - (team.monument.x + team.dir * 60)) < 40) this.deposit(world);
    }
  }

  controlAttack(world) {
    const t = world.findTarget(this, this.ranged ? this.range : this.range + 30, { facingOnly: true });
    if (this.type === 'digger') {
      const node = world.nodes.find((n) => n.team === this.team && Math.abs(n.x - this.x) < 30 && n.amount > 0);
      if (node && !t) { this.startAttack(world, null, 'mine'); this.node = node; return; }
    }
    if (this.type === 'inkcaster') {
      const tx = t ? t.x : this.x + this.facing * this.range * 0.8;
      this.beginCast(world, tx, t ? (t.z ?? this.z) : this.z, false);
      this.cdT = this.def.cd * 0.6;
      return;
    }
    if (this.type === 'shadow') this.reveal(this.restealth);
    this.startAttack(world, t, 'normal');
  }

  // ---------------- abilities ----------------
  useAbility(world, aiTarget) {
    if (this.abilityT > 0) return false;
    const d = this.def.ability;
    switch (this.type) {
      case 'digger':
        this.sprintT = 3; break;
      case 'blade':
        this.dashT = 0.22; this.dashHit = new Set(); this.setAnim('dash');
        world.emit('sfx', { name: 'dash', x: this.x }); break;
      case 'bowman': {
        const t = aiTarget || world.findTarget(this, this.range * 1.1, { facingOnly: true });
        const tx = t ? t.x : this.x + this.facing * this.range * 0.7;
        const tz = t ? (t.z ?? this.z) : this.z;
        for (let i = 0; i < 5; i++) this.fireArrow(world, tx + (i - 2) * 22, tz, -18, 0.85, i * 0.06);
        this.startAttack(world, null, 'volley');
        break;
      }
      case 'shieldbearer':
        this.braced = !this.braced; break;
      case 'inkcaster': {
        const t = aiTarget || world.findTarget(this, this.range, { facingOnly: true });
        const tx = t ? t.x : this.x + this.facing * this.range * 0.7;
        this.beginCast(world, tx, t ? (t.z ?? this.z) : this.z, true);
        break;
      }
      case 'shadow':
        this.stealth = true; this.revealT = 0; this.nextBackstab = true; this.sprintT = 2;
        world.fx?.puff(this.x, this.z, -24, '#111', 14);
        world.emit('sfx', { name: 'vanish', x: this.x }); break;
      case 'colossus':
        this.startAttack(world, null, 'slam'); break;
    }
    this.abilityT = d.cd;
    return true;
  }

  updateDash(world, dt) {
    this.dashT -= dt;
    const sp = 520;
    this.x += this.facing * sp * dt;
    this.setAnim('dash');
    world.fx?.trail(this);
    for (const e of world.enemiesOf(this.team)) {
      if (!e.alive || e.garrisoned || this.dashHit.has(e)) continue;
      if (Math.abs(e.x - this.x) < 18 + e.halfW && Math.abs(e.z - this.z) < 16) {
        this.dashHit.add(e);
        world.damage(e, this.dmg * 1.6 * this.dmgMul(), this, { kind: 'slash', knock: 120 });
      }
    }
    if (this.dashT <= 0) { this.dashT = 0; this.setAnim('idle'); }
  }

  dmgMul() { return this.controlled ? 1.5 : 1; }

  // ---------------- attacks ----------------
  startAttack(world, target, kind) {
    this.atkTarget = target;
    this.atkKind = kind;
    this.atkT = 0;
    this.atkHit = false;
    let dur = ATTACK_ANIM[this.type];
    if (kind === 'slam') dur = 1.2;
    if (kind === 'mine') dur = 0.55;
    if (kind === 'volley') dur = 0.5;
    this.atkDur = Math.min(dur, Math.max(0.25, this.def.cd * 0.9));
    if (kind === 'slam' || kind === 'volley') this.atkDur = dur;
    if (kind === 'normal') this.cdT = this.def.cd * (this.braced ? 1.4 : 1);
    if (target) this.facing = sign(target.x - this.x) || this.facing;
    this.setAnim(kind === 'mine' ? 'mine' : 'attack');
    if (this.type === 'bowman' && kind === 'normal') world.emit('sfx', { name: 'bowdraw', x: this.x });
  }

  resolveAttack(world) {
    const kind = this.atkKind;
    const t = this.atkTarget;
    if (kind === 'volley') return;
    if (kind === 'mine') {
      world.emit('sfx', { name: 'pick', x: this.x });
      world.fx?.sparks(this.x + this.facing * 16, this.z, -4, '#ffd34a', 4);
      if (this.node && this.node.amount > 0 && this.controlled) {
        this.carry = Math.min(this.carry + this.yieldFor(world, this.node) * 0.5, this.yieldFor(world, this.node));
        this.carryKind = this.node.kind;
      }
      return;
    }
    if (this.type === 'bowman') {
      if (t && (t.alive || t.isStructure) && !(t.dead)) {
        const tz = t.isStructure ? this.z : t.z;
        this.fireArrow(world, t.x, tz, t.isStructure ? -90 : -this.targetChest(t), world.accuracyFor(this.team, this.controlled), 0, t);
      } else if (this.controlled) {
        this.fireArrow(world, this.x + this.facing * this.range * 0.75, this.z, -10, 1, 0, null);
      }
      return;
    }
    if (kind === 'slam' || this.type === 'colossus') {
      const big = kind === 'slam';
      const cx = this.x + this.facing * (big ? 30 : 40) * this.scale / 2.6;
      world.blast(cx, this.z, big ? 115 : this.aoe, this.dmg * (big ? 1.25 : 1) * this.dmgMul(), this.team, this, {
        knock: big ? 240 : 120, lift: big ? 300 : 150, structureMul: 0.8, kind: 'smash', ring: true,
      });
      world.shake(big ? 12 : 7);
      if (this.controlled || big) world.hitStop(0.07);
      world.emit('sfx', { name: 'smash', x: this.x });
      return;
    }
    // single-target melee with small cleave
    let dmg = this.dmg * this.dmgMul();
    if (this.type === 'shadow' && this.nextBackstab) {
      dmg *= this.def.backstab; this.nextBackstab = false; this.reveal(this.restealth);
      world.emit('sfx', { name: 'backstab', x: this.x });
    }
    const reach = this.range + 10;
    let hits = 0;
    const maxHits = this.controlled ? 3 : this.type === 'shieldbearer' ? 2 : 1; // spears pierce
    if (t && (t.isStructure ? !t.dead : t.alive) && this.distTo(t) <= reach + 4) {
      world.damage(t, dmg, this, { kind: this.type === 'shieldbearer' ? 'pierce' : 'slash', knock: this.controlled ? 90 : 40 });
      hits++;
    }
    if (hits < maxHits) {
      for (const e of world.enemiesOf(this.team)) {
        if (hits >= maxHits) break;
        if (e === t || !e.alive || e.garrisoned || (e.stealth && !this.controlled)) continue;
        const dx = (e.x - this.x) * this.facing;
        if (dx > -4 && dx < reach + e.halfW && Math.abs(e.z - this.z) < 18) {
          world.damage(e, dmg * (hits === 0 ? 1 : 0.6), this, { kind: 'slash', knock: this.controlled ? 90 : 40 });
          hits++;
        }
      }
      if (hits === 0 && this.controlled) {
        const s = world.enemyStructureNear(this, reach);
        if (s) { world.damage(s, dmg, this, { kind: 'slash' }); hits++; }
      }
    }
    if (hits === 0) world.emit('sfx', { name: 'whoosh', x: this.x });
  }

  targetChest(t) { return t.height * 0.55; }

  fireArrow(world, tx, tz, ty, accuracy, delay, target = null) {
    const ox = this.x + this.facing * 8 * this.scale;
    const oy = this.garrisoned ? -world.teams[this.team].monument.height * 0.7 : -36 * this.scale;
    const ex = this.garrisoned ? world.teams[this.team].monument.x : ox;
    let dx = tx - ex;
    if (target && !target.isStructure && target.vx === 0) {
      // lead moving targets
      const t0 = clamp(Math.abs(dx) / 330, 0.45, 1.25);
      dx += (target.x - target.px) * 60 * t0 * 0.8;
    }
    const spread = (1 - accuracy) * 70;
    dx += (Math.random() - 0.5) * spread;
    const T = clamp(Math.abs(dx) / 330, 0.45, 1.25);
    const vx = dx / T;
    const vy = (ty - oy - 0.5 * ARROW_G * T * T) / T;
    const vz = (tz - this.z) / T;
    world.spawnProjectile({
      kind: 'arrow', x: ex, y: oy, z: this.z, vx, vy, vz, g: ARROW_G, team: this.team,
      dmg: this.dmg * this.dmgMul(), owner: this, delay, life: 4,
    });
    if (!delay) world.emit('sfx', { name: 'bow', x: this.x });
  }

  beginCast(world, tx, tz, quick) {
    this.castT = 0; this.castX = tx; this.castZ = tz; this.quickCast = quick;
    if (tx !== this.x) this.facing = sign(tx - this.x);
    this.setAnim('cast');
    world.emit('sfx', { name: 'channel', x: this.x });
  }

  releaseOrb(world) {
    // re-aim at a living target near the cast point (enemies move while channeling)
    const tx = this.castX, tz = this.castZ;
    const ox = this.x + this.facing * 10, oy = -62;
    const dx = tx - ox;
    const T = clamp(Math.abs(dx) / 300, 0.4, 1.0);
    const g = 420;
    world.spawnProjectile({
      kind: 'orb', x: ox, y: oy, z: this.z, vx: dx / T, vy: (-10 - oy - 0.5 * g * T * T) / T, vz: (tz - this.z) / T,
      g, team: this.team, dmg: this.dmg * this.dmgMul() * (this.quickCast ? 0.8 : 1), owner: this,
      aoe: this.aoe * (this.quickCast ? 0.85 : 1), life: 3,
    });
    world.emit('sfx', { name: 'cast', x: this.x });
    this.setAnim('idle');
  }

  // ---------------- AI: diggers ----------------
  yieldFor(world, node) {
    const team = world.teams[this.team];
    const base = node.kind === 'gold' ? ECONOMY.goldPerTrip : ECONOMY.inkPerTrip;
    return base * team.mods.mine * this.mineMul;
  }

  deposit(world) {
    const team = world.teams[this.team];
    if (this.carryKind === 'gold') { team.gold += this.carry; team.stats.gold += this.carry; }
    else { team.ink += this.carry; team.stats.ink += this.carry; }
    if (this.team === 0) world.emit('deposit', { unit: this, kind: this.carryKind, amount: this.carry });
    this.carry = 0;
  }

  updateDigger(world, dt) {
    const team = world.teams[this.team];
    if (team.stance === 'garrison') { this.releaseNode(); if (this.carry > 0) this.deposit(world); return this.goGarrison(world, dt); }
    const depositX = team.monument.x + team.dir * 60;
    if (this.carry > 0) {
      this.releaseNode();
      this.setAnim('carry');
      if (this.moveToward(world, depositX, this.slotZ, dt)) this.deposit(world);
      else this.setAnim('carry');
      return;
    }
    if (!this.node || this.node.amount <= 0) {
      this.releaseNode();
      this.node = world.pickNode(this);
      if (!this.node) { this.setAnim('idle'); return; }
      this.node.assigned++;
    }
    const n = this.node;
    const standX = n.x - team.dir * 14 + ((this.id % 3) - 1) * 6;
    if (!this.mining) {
      if (this.moveToward(world, standX, n.z + ((this.id % 4) * 5 - 7), dt)) {
        if (n.mining < n.capacity) { this.mining = true; n.mining++; this.mineT = 0; }
        else this.setAnim('idle');
      }
      return;
    }
    this.facing = sign(n.x - this.x) || this.facing;
    this.mineT += dt;
    if (this.anim !== 'mine') this.setAnim('mine');
    const swing = 0.6;
    if (Math.floor(this.mineT / swing) !== Math.floor((this.mineT - dt) / swing)) {
      world.emit('sfx', { name: 'pick', x: this.x, quiet: true });
      world.fx?.sparks(n.x, this.z, -6, n.kind === 'gold' ? '#ffd34a' : '#7fd6ff', 3);
    }
    const need = n.kind === 'gold' ? ECONOMY.mineTimeGold : ECONOMY.mineTimeInk;
    if (this.mineT >= need) {
      const amt = this.yieldFor(world, n);
      const taken = Math.min(amt, n.amount);
      if (n.amount !== Infinity) n.amount -= taken;
      this.carry = taken * world.incomeMul(this.team);
      this.carryKind = n.kind;
      this.mining = false;
      n.mining--;
    }
  }

  releaseNode() {
    if (this.mining && this.node) { this.node.mining--; this.mining = false; }
    if (this.node) { this.node.assigned--; this.node = null; }
  }

  // ---------------- AI: soldiers ----------------
  goGarrison(world, dt) {
    const team = world.teams[this.team];
    const gx = team.monument.x - team.dir * (40 + (this.id % 7) * 9);
    if (this.moveToward(world, gx, (this.id % 5) * 6, dt, 1.2)) {
      this.garrisoned = true;
      this.braced = false;
      this.setAnim('idle');
    }
  }

  updateGarrisoned(world, dt) {
    const team = world.teams[this.team];
    if (team.stance !== 'garrison') { this.garrisoned = false; return; }
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.04 * dt);
    this.setAnim('idle');
    if (this.type === 'bowman' && this.cdT <= 0) {
      const m = team.monument;
      const t = world.findTargetFrom(this.team, m.x, this.range + 80);
      if (t) {
        this.facing = team.dir;
        this.cdT = this.def.cd * 1.1;
        this.fireArrow(world, t.x, t.z ?? this.z, t.isStructure ? -90 : -this.targetChest(t), world.accuracyFor(this.team, false), 0, t);
      }
    }
  }

  updateSoldier(world, dt) {
    const team = world.teams[this.team];
    const stance = this.forceAttack ? 'attack' : team.stance;
    if (stance === 'garrison') return this.goGarrison(world, dt);
    this.braced = this.braceHold;

    // retarget periodically
    this.thinkT -= dt;
    if (this.thinkT <= 0 || (this.target && (this.target.isStructure ? this.target.dead : !this.target.alive || this.target.garrisoned))) {
      this.thinkT = 0.2 + Math.random() * 0.1;
      const aggro = this.def.aggro + (this.ranged ? this.range * 0.1 : 0);
      this.target = world.findTarget(this, aggro, { prefer: this.type === 'shadow' ? 'ranged' : null });
      if (this.target && stance === 'defend') {
        // leash: don't chase too far from the defensive line
        const lineX = world.defendLine(this.team);
        // ...but always answer ranged units that are shooting into our lines
        const reach = this.target.isStructure || this.target.def.melee ? 0 : this.target.range + 30;
        if ((this.target.x - lineX) * team.dir > 260 + reach) this.target = null;
      }
    }
    const t = this.target;
    if (t) {
      const d = this.distTo(t);
      const range = this.range;
      if (d <= range) {
        this.facing = sign(t.x - this.x) || this.facing;
        if (this.type === 'shieldbearer') {
          // brace when facing ranged pressure or holding a line
          this.braced = this.braceHold || stance === 'defend' || !t.isStructure || world.rangedThreat(this);
        }
        if (this.cdT <= 0) {
          if (this.type === 'inkcaster') {
            const c = world.clusterNear(this.team, t.x, 90);
            this.beginCast(world, c.x, t.z ?? this.z, false);
            this.cdT = this.def.cd;
          } else this.startAttack(world, t, 'normal');
          this.aiAbility(world, t);
        } else this.setAnim(this.braced ? 'brace' : 'idle');
        // spread out along depth a bit
        if (!t.isStructure && Math.abs(t.z - this.z) > 10) this.z += sign(t.z - this.z) * 15 * dt;
        return;
      }
      // approach — ranged units won't walk ahead of their front line when attacking
      let goal = t.x - sign(t.x - this.x) * (range * 0.85 + (t.isStructure ? t.halfW : 0));
      if (this.ranged) goal = this.capByFront(world, goal);
      this.braced = false;
      this.aiAbility(world, t);
      if (this.dashT > 0) return;
      this.moveToward(world, goal, t.isStructure ? this.slotZ : t.z, dt);
      return;
    }
    // no target: formation movement
    this.braced = this.braceHold && this.type === 'shieldbearer';
    if (stance === 'attack') {
      const em = world.teams[1 - this.team].monument;
      let goal = em.x - team.dir * (em.halfW + this.range * 0.8);
      if (this.ranged) goal = this.capByFront(world, goal);
      this.moveToward(world, goal + this.jitter * 0.3, this.slotZ, dt);
    } else {
      if (this.moveToward(world, this.slotX, this.slotZ, dt)) {
        this.facing = team.dir;
        if (this.type === 'shieldbearer' && stance === 'defend') { this.braced = true; this.setAnim('brace'); }
      }
    }
  }

  capByFront(world, goal) {
    const team = world.teams[this.team];
    const front = world.frontX[this.team];
    if (front === null) return goal;
    const cap = front - team.dir * 45;
    return team.dir > 0 ? Math.min(goal, cap) : Math.max(goal, cap);
  }

  aiAbility(world, t) {
    const skill = world.aiSkill(this.team);
    if (this.abilityT > 0 || skill < 0.5 || t.isStructure) return;
    if (Math.random() > skill * 0.02) return; // occasional, not spammy
    const d = Math.abs(t.x - this.x);
    switch (this.type) {
      case 'blade': if (d > 50 && d < 120) { this.facing = sign(t.x - this.x); this.useAbility(world); } break;
      case 'colossus': if (world.countEnemiesNear(this.team, this.x, 110) >= 3) this.useAbility(world); break;
      case 'bowman': if (world.countEnemiesNear(this.team, t.x, 70) >= 4) this.useAbility(world, t); break;
      case 'inkcaster': if (world.countEnemiesNear(this.team, t.x, 70) >= 3 && this.castT < 0) this.useAbility(world, t); break;
      case 'shadow': if (this.hp < this.maxHp * 0.4 && !this.stealth) this.useAbility(world); break;
    }
  }
}
