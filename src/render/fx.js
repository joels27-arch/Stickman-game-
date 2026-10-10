// Visual effects: pooled particles, ground decals, stuck arrows, flying weapons
// and verlet ragdolls. Implements the `world.fx` interface used by the sim.
import { DEPTH_SCALE, TEAM_COLORS, DT } from '../config.js';
import { Pool, TAU, clamp } from '../core/util.js';
import { computePose, solve, J, JOINT_COUNT, drawRagdoll, INK } from './stick.js';

const RAG_LINKS = [
  [J.head, J.neck], [J.neck, J.hip],
  [J.neck, J.lElbow], [J.lElbow, J.lHand], [J.neck, J.rElbow], [J.rElbow, J.rHand],
  [J.hip, J.lKnee], [J.lKnee, J.lFoot], [J.hip, J.rKnee], [J.rKnee, J.rFoot],
  // soft stiffeners keep the body from folding into a ball
  [J.head, J.hip], [J.lKnee, J.rKnee],
];
const WEAPON = {
  digger: { len: 18, color: '#9aa3ad', handle: '#7a4b25' },
  blade: { len: 20, color: '#d9e2ea', handle: '#3a2a1a' },
  bowman: { len: 24, color: '#7a4b25', handle: '#7a4b25' },
  shieldbearer: { len: 34, color: '#c9d2db', handle: '#7a4b25' },
  inkcaster: { len: 30, color: '#f4f1e8', handle: '#5b3a1e' },
  shadow: { len: 10, color: '#cfd8e0', handle: '#222' },
  colossus: { len: 24, color: '#8a8f96', handle: '#6b4a2b' },
};

export class FX {
  constructor(quality, settings) {
    this.q = quality;
    this.settings = settings;
    this.particles = new Pool(() => ({ active: false }), quality.particles);
    this.decals = new Pool(() => ({ active: false }), quality.decals);
    this.ragdolls = new Pool(() => ({
      active: false, x: new Float32Array(JOINT_COUNT), y: new Float32Array(JOINT_COUNT),
      ox: new Float32Array(JOINT_COUNT), oy: new Float32Array(JOINT_COUNT), len: new Float32Array(RAG_LINKS.length),
    }), quality.ragdolls);
    this.time = 0;
    this.world = null;
  }

  setQuality(q) {
    this.q = q;
    this.particles.max = q.particles; this.decals.max = q.decals; this.ragdolls.max = q.ragdolls;
  }

  clear() { this.particles.clear(); this.decals.clear(); this.ragdolls.clear(); }

  // ---------------------------------------------------------- particle spawning
  p(type, x, y, gy, vx, vy, life, size, color, extra) {
    const o = this.particles.acquire();
    o.type = type; o.x = o.px = x; o.y = o.py = y; o.gy = gy; o.vx = vx; o.vy = vy;
    o.life = o.max = life; o.size = size; o.color = color; o.rot = 0; o.vr = 0; o.grav = 600; o.unit = null;
    o.text = null; o.ox = 0; o.oy = 0; o.len = 0; o.kind = null;
    if (extra) Object.assign(o, extra);
    return o;
  }

  blobs(x, z, y, n, colors, speed = 160, dirX = 0) {
    const gy = z * DEPTH_SCALE;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4 + dirX * 0.6;
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.p('blob', x, y + gy, gy, Math.cos(a) * sp + dirX * speed * 0.5, Math.sin(a) * sp, 1.2,
        1.2 + Math.random() * 2.2, colors[i % colors.length]);
    }
  }

  sparks(x, z, y, color, n = 5) {
    const gy = z * DEPTH_SCALE;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = 80 + Math.random() * 160;
      this.p('spark', x, y + gy, gy, Math.cos(a) * sp, Math.sin(a) * sp - 60, 0.25 + Math.random() * 0.15, 1.2, color, { grav: 300 });
    }
  }

  puff(x, z, y, color, n = 8) {
    const gy = z * DEPTH_SCALE;
    for (let i = 0; i < n; i++) {
      this.p('smoke', x + (Math.random() - 0.5) * 14, y + gy + (Math.random() - 0.5) * 20, gy,
        (Math.random() - 0.5) * 40, -10 - Math.random() * 30, 0.7 + Math.random() * 0.4, 5 + Math.random() * 6, color, { grav: 0 });
    }
  }

  dust(x, z, n = 4, color = 'rgba(160,130,100,0.5)', size = 6) {
    const gy = z * DEPTH_SCALE;
    for (let i = 0; i < n; i++) {
      this.p('smoke', x + (Math.random() - 0.5) * 20, gy - 2, gy, (Math.random() - 0.5) * 60, -10 - Math.random() * 20,
        0.6 + Math.random() * 0.5, size + Math.random() * size, color, { grav: 0 });
    }
  }

  trail(u) {
    if (Math.random() < 0.6) this.p('ghost', u.x, u.z * DEPTH_SCALE - 24, 0, 0, 0, 0.18, 8, 'rgba(140,230,255,0.35)', { grav: 0 });
  }

  text(x, y, str, color, big = false) {
    if (this.particles.count() > this.q.particles * 0.9) return;
    this.p('text', x + (Math.random() - 0.5) * 8, y, 0, (Math.random() - 0.5) * 20, -70, 0.8, big ? 13 : 10, color, { grav: 120, text: str });
  }

  decal(x, z, r, color) {
    const d = this.decals.acquire();
    d.x = x; d.y = z * DEPTH_SCALE; d.r = r * (0.7 + Math.random() * 0.6); d.color = color; d.life = d.max = 9 + Math.random() * 4;
    d.seed = Math.random() * 10;
  }

  // ---------------------------------------------------------- world.fx interface
  hit(u, kind, dir, blocked, src) {
    const y = u.y - u.height * 0.55;
    if (blocked) {
      this.sparks(u.x + u.facing * 8 * u.scale, u.z, y, '#fff3b0', 6);
      return;
    }
    const team = TEAM_COLORS[u.team];
    const n = kind === 'smash' || kind === 'blast' ? 8 : 5;
    this.blobs(u.x, u.z, y, n, [INK, INK, team], kind === 'arrow' ? 110 : 170, dir);
    if (kind === 'slash' || kind === 'pierce') this.sparks(u.x, u.z, y, '#ffffff', 2);
    if (Math.random() < 0.5) this.decal(u.x + dir * 6, u.z, 5, INK);
  }

  ragdoll(u, dir, force, lift) {
    const r = this.ragdolls.acquire();
    const pose = computePose(u, this.time);
    const { JX, JY } = solve(pose);
    const s = u.scale, f = u.facing;
    const gy = u.z * DEPTH_SCALE;
    const fx = dir * force * (0.7 + Math.random() * 0.5) * DT / Math.sqrt(s);
    const fy = -(force * 0.45 + lift * 0.8) * DT / Math.sqrt(s);
    for (let i = 0; i < JOINT_COUNT; i++) {
      r.x[i] = u.x + JX[i] * f * s;
      r.y[i] = u.y + JY[i] * s + gy;
      // upper body gets more of the impulse so the figure topples over
      const k = i === J.head || i === J.neck ? 1.4 : i === J.hip ? 0.9 : 0.75 + Math.random() * 0.5;
      r.ox[i] = r.x[i] - fx * k - (Math.random() - 0.5) * 0.6;
      r.oy[i] = r.y[i] - fy * k;
    }
    for (let i = 0; i < RAG_LINKS.length; i++) {
      const [a, b] = RAG_LINKS[i];
      r.len[i] = Math.hypot(r.x[a] - r.x[b], r.y[a] - r.y[b]);
    }
    r.ground = gy; r.scale = s; r.life = 4.2; r.color = TEAM_COLORS[u.team]; r.z = u.z;
    // weapon flies off
    const w = WEAPON[u.type];
    if (w && Math.random() < 0.85) {
      this.p('weapon', r.x[J.rHand], r.y[J.rHand], gy, dir * (80 + Math.random() * 120), -150 - Math.random() * 150, 4.5, w.len * s, w.color,
        { vr: (Math.random() - 0.5) * 22 * dir, rot: Math.random() * TAU, kind: w.handle });
    }
    this.blobs(u.x, u.z, u.y - u.height * 0.5, 10, [INK, INK, TEAM_COLORS[u.team]], 200, dir);
    this.decal(u.x, u.z, 9 * s, INK);
    // arrows stuck in this unit drop off
    this.particles.forEach((o) => { if (o.type === 'stuck' && o.unit === u) { o.type = 'arrowfall'; o.vx = dir * 30; o.vy = -60; o.vr = 6; o.life = 1.5; o.max = 1.5; } });
  }

  explosion(x, z, r, kind, color, ring) {
    const gy = z * DEPTH_SCALE;
    const smash = kind === 'smash';
    this.p('flash', x, gy - (smash ? 4 : 10), gy, 0, 0, 0.16, r * (smash ? 0.6 : 0.55), smash ? 'rgba(255,240,200,0.8)' : 'rgba(255,255,255,0.75)', { grav: 0 });
    if (ring || !smash) this.p('ring', x, gy, gy, 0, 0, 0.4, r, smash ? 'rgba(90,70,50,0.7)' : color, { grav: 0 });
    if (smash) {
      this.dust(x, z, 10, 'rgba(120,100,80,0.55)', 9);
      for (let i = 0; i < 6; i++) this.p('debris', x + (Math.random() - 0.5) * r, gy - 2, gy, (Math.random() - 0.5) * 260, -120 - Math.random() * 220, 1.4, 2 + Math.random() * 2.5, '#6e5a46', { vr: (Math.random() - 0.5) * 20 });
      this.decal(x, z, r * 0.5, 'rgba(60,45,30,0.6)');
    } else {
      this.blobs(x, z, -6, 18, [INK, color, INK, '#000'], 260);
      this.puff(x, z, -12, 'rgba(20,20,30,0.5)', 6);
      this.decal(x, z, r * 0.45, INK);
      this.decal(x + 15, z, r * 0.25, color);
    }
  }

  chips(s, fromX, kind) {
    const side = Math.sign(fromX - s.x) || 1;
    const x = s.x + side * s.halfW * 0.8;
    const y = -s.height * (0.15 + Math.random() * 0.5) + s.z * DEPTH_SCALE;
    for (let i = 0; i < 3; i++) {
      this.p('debris', x, y, s.z * DEPTH_SCALE + 8, side * (40 + Math.random() * 100), -60 - Math.random() * 100, 1.2, 1.5 + Math.random() * 2,
        s.team === 0 ? '#9aa6b5' : '#5a4a4a', { vr: (Math.random() - 0.5) * 20 });
    }
    if (kind !== 'arrow') this.dust(x, s.z, 2, 'rgba(200,190,170,0.5)', 5);
  }

  collapse(s) {
    for (let i = 0; i < 40; i++) {
      this.p('debris', s.x + (Math.random() - 0.5) * s.halfW * 2.2, -Math.random() * s.height, 26,
        (Math.random() - 0.5) * 300, -100 - Math.random() * 300, 2.5, 3 + Math.random() * 6, s.team === 0 ? '#8d99a8' : '#4e3f3f', { vr: (Math.random() - 0.5) * 16 });
    }
    for (let i = 0; i < 18; i++) this.p('smoke', s.x + (Math.random() - 0.5) * 160, -Math.random() * 120, 0, (Math.random() - 0.5) * 80, -20 - Math.random() * 40, 2 + Math.random(), 14 + Math.random() * 16, 'rgba(120,110,100,0.45)', { grav: 0 });
  }

  arrowGround(p) {
    const ang = Math.atan2(p.vy, p.vx);
    this.p('stuck', p.x, p.z * DEPTH_SCALE + 1, 0, 0, 0, 3, 16, null, { rot: ang, grav: 0 });
    this.dust(p.x, p.z, 1, 'rgba(140,120,90,0.4)', 3);
  }

  arrowStick(p, u) {
    const ang = Math.atan2(p.vy, p.vx);
    this.p('stuck', p.x, p.y, 0, 0, 0, 2.5, 13, null, { rot: ang, grav: 0, unit: u, ox: (p.x - u.x) * u.facing, oy: p.y - u.y, facing0: u.facing });
  }

  arrowBlocked(p, u) {
    this.sparks(p.x, p.z, p.y, '#fff3b0', 4);
    this.p('arrowfall', p.x, p.y + p.z * DEPTH_SCALE, p.z * DEPTH_SCALE, -Math.sign(p.vx) * 60, -80, 1.2, 16, null, { rot: Math.atan2(p.vy, -p.vx), vr: 12 });
  }

  arrowStickStructure(p, s) {
    const ang = Math.atan2(p.vy, p.vx);
    this.p('stuck', p.x - Math.sign(p.vx) * 4, p.y + p.z * DEPTH_SCALE, 0, 0, 0, 3, 16, null, { rot: ang, grav: 0 });
  }

  // ---------------------------------------------------------- simulation
  update(dt) {
    this.time += dt;
    const items = this.particles.items;
    for (let i = 0; i < items.length; i++) {
      const o = items[i];
      if (!o.active) continue;
      o.life -= dt;
      if (o.life <= 0) { o.active = false; continue; }
      o.px = o.x; o.py = o.y;
      switch (o.type) {
        case 'blob':
          o.vy += o.grav * dt; o.x += o.vx * dt; o.y += o.vy * dt;
          if (o.y >= o.gy) {
            o.active = false;
            if (Math.random() < 0.35) { const d = this.decals.acquire(); d.x = o.x; d.y = o.gy; d.r = o.size * 1.4; d.color = o.color; d.life = d.max = 6; d.seed = Math.random() * 10; }
          }
          break;
        case 'debris': case 'weapon': case 'arrowfall':
          o.vy += 600 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt;
          if (o.y >= o.gy) {
            o.y = o.gy;
            if (Math.abs(o.vy) > 80) { o.vy *= -0.35; o.vx *= 0.6; o.vr *= 0.5; }
            else { o.vy = 0; o.vx *= 0.8; o.vr *= 0.7; }
          }
          break;
        case 'stuck':
          if (o.unit) {
            if (!o.unit.alive) { o.unit = null; o.active = false; break; }
            o.x = o.unit.x + o.ox * o.unit.facing;
            o.y = o.unit.y + o.oy + o.unit.z * DEPTH_SCALE;
          }
          break;
        case 'text':
          o.vy += o.grav * dt; o.x += o.vx * dt; o.y += o.vy * dt;
          break;
        default:
          o.vy += o.grav * dt; o.x += o.vx * dt; o.y += o.vy * dt;
      }
    }
    this.decals.forEach((d) => { d.life -= dt; if (d.life <= 0) d.active = false; });
    this.updateRagdolls(dt);
  }

  updateRagdolls(dt) {
    const g = 900 * dt * dt;
    this.ragdolls.forEach((r) => {
      r.life -= dt;
      if (r.life <= 0) { r.active = false; return; }
      for (let i = 0; i < JOINT_COUNT; i++) {
        const vx = (r.x[i] - r.ox[i]) * 0.995, vy = (r.y[i] - r.oy[i]) * 0.995;
        r.ox[i] = r.x[i]; r.oy[i] = r.y[i];
        r.x[i] += vx; r.y[i] += vy + g;
      }
      for (let it = 0; it < 4; it++) {
        for (let k = 0; k < RAG_LINKS.length; k++) {
          const [a, b] = RAG_LINKS[k];
          const dx = r.x[b] - r.x[a], dy = r.y[b] - r.y[a];
          const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
          const stiff = k >= 10 ? 0.15 : 0.5;
          const diff = ((d - r.len[k]) / d) * stiff;
          const mx = dx * diff, my = dy * diff;
          r.x[a] += mx; r.y[a] += my; r.x[b] -= mx; r.y[b] -= my;
        }
        const ground = r.ground;
        for (let i = 0; i < JOINT_COUNT; i++) {
          const rad = i === J.head ? 5 * r.scale : 1.5;
          if (r.y[i] > ground - rad) {
            r.y[i] = ground - rad;
            // ground friction
            r.ox[i] = r.x[i] - (r.x[i] - r.ox[i]) * 0.6;
            if (r.oy[i] < r.y[i]) r.oy[i] = r.y[i] + (r.y[i] - r.oy[i]) * 0.2;
          }
        }
      }
    });
  }

  // ---------------------------------------------------------- drawing
  drawDecals(ctx, x0, x1) {
    this.decals.forEach((d) => {
      if (d.x < x0 - 30 || d.x > x1 + 30) return;
      const a = clamp(d.life / d.max * 1.6, 0, 1) * 0.75;
      ctx.globalAlpha = a;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y + 1, d.r, d.r * 0.32, 0, 0, TAU);
      ctx.fill();
      // satellite droplets
      ctx.beginPath();
      ctx.ellipse(d.x + Math.sin(d.seed) * d.r * 1.3, d.y + 1.5, d.r * 0.3, d.r * 0.12, 0, 0, TAU);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  drawRagdolls(ctx, x0, x1) {
    this.ragdolls.forEach((r) => {
      if (r.x[J.hip] < x0 - 60 || r.x[J.hip] > x1 + 60) return;
      drawRagdoll(ctx, r, clamp(r.life, 0, 1));
    });
  }

  drawParticles(ctx, x0, x1, alpha) {
    const items = this.particles.items;
    for (let i = 0; i < items.length; i++) {
      const o = items[i];
      if (!o.active || o.x < x0 - 80 || o.x > x1 + 80) continue;
      const k = o.life / o.max;
      const x = o.px + (o.x - o.px) * alpha, y = o.py + (o.y - o.py) * alpha;
      switch (o.type) {
        case 'blob':
          ctx.fillStyle = o.color; ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(x, y, o.size, 0, TAU); ctx.fill();
          break;
        case 'spark':
          ctx.strokeStyle = o.color; ctx.globalAlpha = k; ctx.lineWidth = o.size;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - o.vx * 0.03, y - o.vy * 0.03); ctx.stroke();
          break;
        case 'smoke': case 'ghost':
          ctx.fillStyle = o.color; ctx.globalAlpha = k * 0.9;
          ctx.beginPath(); ctx.arc(x, y, o.size * (1.6 - k * 0.6), 0, TAU); ctx.fill();
          break;
        case 'flash':
          ctx.fillStyle = o.color; ctx.globalAlpha = k * k * 0.8;
          ctx.beginPath(); ctx.arc(x, y, o.size * (1.1 - k * 0.5), 0, TAU); ctx.fill();
          break;
        case 'ring':
          ctx.strokeStyle = o.color; ctx.globalAlpha = k; ctx.lineWidth = 3 * k + 1;
          ctx.beginPath(); ctx.ellipse(x, y, o.size * (1.2 - k * 0.9), o.size * 0.3 * (1.2 - k * 0.9), 0, 0, TAU); ctx.stroke();
          break;
        case 'debris':
          ctx.fillStyle = o.color; ctx.globalAlpha = Math.min(1, k * 3);
          ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot); ctx.fillRect(-o.size, -o.size * 0.7, o.size * 2, o.size * 1.4); ctx.restore();
          break;
        case 'weapon':
          ctx.globalAlpha = Math.min(1, k * 3);
          ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot);
          ctx.lineCap = 'round';
          ctx.strokeStyle = o.kind; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-o.size * 0.5, 0); ctx.lineTo(0, 0); ctx.stroke();
          ctx.strokeStyle = o.color; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(o.size * 0.5, 0); ctx.stroke();
          ctx.restore();
          break;
        case 'stuck': case 'arrowfall':
          ctx.globalAlpha = Math.min(1, k * 3);
          ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot);
          ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.moveTo(-o.size, 0); ctx.lineTo(o.type === 'stuck' && !o.unit ? -2 : 2, 0); ctx.stroke();
          ctx.strokeStyle = '#eee'; ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.moveTo(-o.size, 0); ctx.lineTo(-o.size + 4, 0); ctx.stroke();
          ctx.restore();
          break;
        case 'text':
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.font = `bold ${o.size}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
          ctx.strokeText(o.text, x, y);
          ctx.fillStyle = o.color; ctx.fillText(o.text, x, y);
          break;
      }
    }
    ctx.globalAlpha = 1;
  }
}
