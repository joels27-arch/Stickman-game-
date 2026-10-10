// Procedural skeletal stick figures: pose computation (forward kinematics),
// unit drawing with per-type accessories, and ragdoll drawing.
// Local frame: origin at the feet, y negative = up, facing +x.
import { TAU, clamp } from '../core/util.js';

const PI = Math.PI;
const THIGH = 11, SHIN = 11, TORSO = 16, UPPER = 9, FORE = 9, HEAD_R = 6;
export const INK = '#151518';

// Joint index layout shared with the ragdoll
export const J = { head: 0, neck: 1, hip: 2, lElbow: 3, lHand: 4, rElbow: 5, rHand: 6, lKnee: 7, lFoot: 8, rKnee: 9, rFoot: 10 };
export const JOINT_COUNT = 11;

const P = { lean: 0, head: 0, hipY: 0, lt: 0, ls: 0, rt: 0, rs: 0, lu: 0, lf: 0, ru: 0, rf: 0, wpn: 0, wpn2: 0, draw: 0 };
const JX = new Float32Array(JOINT_COUNT), JY = new Float32Array(JOINT_COUNT);

// keyframe helper: frames = [[t, v], ...] sorted by t
function key(f, frames) {
  if (f <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    if (f <= frames[i][0]) {
      const [t0, v0] = frames[i - 1], [t1, v1] = frames[i];
      const k = (f - t0) / (t1 - t0);
      const e = k * k * (3 - 2 * k);
      return v0 + (v1 - v0) * e;
    }
  }
  return frames[frames.length - 1][1];
}

function idle(t, p) {
  const b = Math.sin(t * 2.2);
  p.lean = 0.05 + b * 0.015; p.head = 0; p.hipY = b * 0.4;
  p.lt = -0.16; p.ls = -0.2; p.rt = 0.2; p.rs = 0.08;
  p.lu = -0.25 + b * 0.04; p.lf = 0.25; p.ru = 0.35 + b * 0.04; p.rf = 1.1;
  p.wpn = 1.35; p.wpn2 = 0.6; p.draw = 0;
}

function walk(ph, p, amp = 0.55, run = false) {
  const s = Math.sin(ph), c = Math.cos(ph);
  p.lean = run ? 0.32 : 0.12;
  p.hipY = -Math.abs(s) * (run ? 2.2 : 1.2);
  p.lt = s * amp; p.rt = -s * amp;
  p.ls = p.lt - Math.max(0, -c) * (run ? 1.3 : 0.9) - 0.1;
  p.rs = p.rt - Math.max(0, c) * (run ? 1.3 : 0.9) - 0.1;
  p.lu = -s * (run ? 0.9 : 0.5); p.lf = p.lu + (run ? 1.5 : 0.4);
  p.ru = 0.35 + s * (run ? 0.6 : 0.3); p.rf = p.ru + (run ? 1.4 : 0.8);
  p.head = 0; p.wpn = 1.2 + p.rf * 0.1; p.wpn2 = 0.6; p.draw = 0;
}

function overheadSwing(f, p, heavy) {
  // windup -> strike -> recover
  p.ru = key(f, [[0, 0.5], [0.45, PI * 0.95], [0.6, 1.5], [1, 0.5]]);
  p.rf = key(f, [[0, 1.2], [0.45, PI * 1.15], [0.6, 1.4], [1, 1.2]]);
  p.lu = key(f, [[0, -0.2], [0.45, -0.6], [0.6, 0.6], [1, -0.2]]);
  p.lf = p.lu + 0.5;
  p.lean = key(f, [[0, 0.05], [0.45, -0.12], [0.6, heavy ? 0.45 : 0.35], [1, 0.05]]);
  p.rt = key(f, [[0, 0.2], [0.5, 0.25], [0.6, 0.7], [1, 0.2]]);
  p.rs = p.rt - key(f, [[0, 0.1], [0.6, 0.6], [1, 0.1]]);
  p.lt = key(f, [[0, -0.16], [0.6, -0.5], [1, -0.16]]);
  p.ls = p.lt - 0.15;
  p.hipY = key(f, [[0, 0], [0.6, heavy ? 4 : 2.5], [1, 0]]);
  p.wpn = p.rf + 0.2;
}

export function computePose(u, t) {
  const p = P;
  const a = u.anim;
  const type = u.type;
  if (a === 'walk' || a === 'carry') walk(u.walkPhase, p, type === 'colossus' ? 0.4 : 0.55);
  else if (a === 'run' || a === 'dash') walk(u.walkPhase, p, 0.85, true);
  else idle(t + u.id, p);

  const f = u.atkT >= 0 && u.atkDur > 0 ? clamp(u.atkT / u.atkDur, 0, 1) : -1;

  switch (type) {
    case 'digger':
      if (a === 'mine' || (f >= 0 && u.atkKind === 'mine')) {
        const mf = f >= 0 ? f : (u.animT % 0.6) / 0.6;
        overheadSwing(mf, p, false);
      } else if (f >= 0) overheadSwing(f, p, false);
      if (a === 'carry' || u.carry > 0) { p.lu = PI * 0.85; p.lf = PI * 1.1; }
      p.wpn = p.rf + 0.1;
      break;
    case 'blade':
      if (f >= 0) overheadSwing(f, p, false);
      if (a === 'dash') { p.lean = 0.6; p.ru = 1.6; p.rf = 1.6; p.wpn = 1.6; p.lu = -1.2; p.lf = -0.8; }
      if (f < 0 && a !== 'dash') p.wpn = p.rf + 0.4;
      break;
    case 'bowman': {
      // front arm holds the bow forward; back arm draws the string
      const drawing = f >= 0 && u.atkKind !== 'mine';
      const aimUp = 0.15;
      if (drawing || a === 'idle') {
        p.ru = PI / 2 + aimUp; p.rf = PI / 2 + aimUp;
        p.lu = PI / 2 + aimUp - 0.05;
        const dr = drawing ? key(f, [[0, 0], [0.55, 1], [0.62, 0], [1, 0]]) : 0;
        p.lf = p.lu - dr * 2.9;
        p.draw = dr;
        if (!drawing) { p.ru = 0.9; p.rf = 1.2; p.lu = -0.2; p.lf = 0.3; }
        p.lean = drawing ? -0.05 : p.lean;
      }
      p.wpn = p.rf;
      break;
    }
    case 'shieldbearer': {
      // shield in front hand, spear in back hand
      p.ru = 1.05; p.rf = 1.55;
      if (f >= 0) {
        p.lu = key(f, [[0, 0.9], [0.45, 0.4], [0.6, 1.65], [1, 0.9]]);
        p.lf = p.lu + key(f, [[0, 0.5], [0.45, 0.9], [0.6, 0], [1, 0.5]]);
        p.lean = key(f, [[0, 0.1], [0.6, 0.35], [1, 0.1]]);
      } else { p.lu = 0.9; p.lf = 1.4; }
      if (u.braced || a === 'brace') {
        p.hipY = 5; p.lean = 0.35;
        p.rt = 0.95; p.rs = -0.05; p.lt = -0.55; p.ls = -1.0;
        p.ru = 1.25; p.rf = 1.45;
      }
      p.wpn = p.lf;
      break;
    }
    case 'inkcaster':
      if (a === 'cast' || u.castT >= 0) {
        const w = Math.sin(t * 9) * 0.08;
        p.ru = PI * 0.82 + w; p.rf = PI * 0.92 + w;
        p.lu = PI * 0.7 - w; p.lf = PI * 0.85;
        p.lean = -0.1;
      } else if (f >= 0) overheadSwing(f, p, false);
      p.wpn = PI; // staff stays upright
      break;
    case 'shadow':
      if (a !== 'walk' && a !== 'run') { p.hipY += 3; p.lean = 0.35; p.rt = 0.6; p.rs = -0.2; p.lt = -0.4; p.ls = -1.0; }
      if (f >= 0) {
        p.ru = key(f, [[0, 0.4], [0.4, -0.2], [0.55, 1.7], [1, 0.4]]);
        p.rf = p.ru + key(f, [[0, 1], [0.4, 1.4], [0.55, 0.05], [1, 1]]);
        p.lu = key(f, [[0, 0.2], [0.5, 0.3], [0.65, 1.5], [1, 0.2]]);
        p.lf = p.lu + 0.3;
        p.lean = key(f, [[0, 0.35], [0.55, 0.6], [1, 0.35]]);
      } else { p.ru = 0.6; p.rf = 1.8; p.lu = 0.1; p.lf = 1.2; }
      p.wpn = p.rf + 0.3; p.wpn2 = p.lf + 0.3;
      break;
    case 'colossus':
      if (f >= 0 && u.atkKind === 'slam') {
        p.ru = key(f, [[0, 0.5], [0.5, PI * 0.97], [0.6, 1.0], [1, 0.5]]);
        p.lu = key(f, [[0, -0.2], [0.5, PI * 0.9], [0.6, 0.9], [1, -0.2]]);
        p.rf = p.ru + 0.2; p.lf = p.lu + 0.2;
        p.lean = key(f, [[0, 0.05], [0.5, -0.25], [0.6, 0.55], [1, 0.05]]);
        p.hipY = key(f, [[0, 0], [0.5, -2], [0.6, 5], [1, 0]]);
      } else if (f >= 0) overheadSwing(f, p, true);
      else { p.ru = 0.45; p.rf = 0.7; }
      p.wpn = p.rf + 0.05;
      break;
  }
  if (a === 'air') {
    p.lu = PI * 0.7; p.lf = PI * 0.9; p.ru = PI * 0.6; p.rf = PI * 0.75;
    p.lt = -0.5; p.ls = -1.4; p.rt = 0.7; p.rs = -0.2; p.lean = -0.2;
  }
  return p;
}

// forward kinematics into JX/JY (local coords)
export function solve(p, scale = 1) {
  const hipX = 0, hipY = -(THIGH + SHIN) + p.hipY;
  JX[J.hip] = hipX; JY[J.hip] = hipY;
  const nx = hipX + Math.sin(p.lean) * TORSO, ny = hipY - Math.cos(p.lean) * TORSO;
  JX[J.neck] = nx; JY[J.neck] = ny;
  JX[J.head] = nx + Math.sin(p.lean + p.head) * (HEAD_R + 1); JY[J.head] = ny - Math.cos(p.lean + p.head) * (HEAD_R + 1);
  const sx = nx - Math.sin(p.lean) * 1.5, sy = ny + Math.cos(p.lean) * 1.5;
  limb(sx, sy, p.lu, UPPER, p.lf, FORE, J.lElbow, J.lHand);
  limb(sx, sy, p.ru, UPPER, p.rf, FORE, J.rElbow, J.rHand);
  limb(hipX, hipY, p.lt, THIGH, p.ls, SHIN, J.lKnee, J.lFoot);
  limb(hipX, hipY, p.rt, THIGH, p.rs, SHIN, J.rKnee, J.rFoot);
  // keep feet on the ground when standing
  const lowest = Math.max(JY[J.lFoot], JY[J.rFoot]);
  if (lowest < 0 && p !== null) {
    const d = -lowest;
    for (let i = 0; i < JOINT_COUNT; i++) JY[i] += d;
  }
  return { JX, JY };
}

function limb(x, y, a1, l1, a2, l2, i1, i2) {
  const ex = x + Math.sin(a1) * l1, ey = y + Math.cos(a1) * l1;
  JX[i1] = ex; JY[i1] = ey;
  JX[i2] = ex + Math.sin(a2) * l2; JY[i2] = ey + Math.cos(a2) * l2;
}

// ---------------------------------------------------------------- drawing
function seg(ctx, a, b) { ctx.moveTo(JX[a], JY[a]); ctx.lineTo(JX[b], JY[b]); }

function bodyPath(ctx) {
  ctx.beginPath();
  seg(ctx, J.hip, J.lKnee); seg(ctx, J.lKnee, J.lFoot);
  seg(ctx, J.neck, J.lElbow); seg(ctx, J.lElbow, J.lHand);
  seg(ctx, J.hip, J.neck);
  seg(ctx, J.hip, J.rKnee); seg(ctx, J.rKnee, J.rFoot);
  seg(ctx, J.neck, J.rElbow); seg(ctx, J.rElbow, J.rHand);
}

/**
 * Draw a unit-like object. `u` needs: type, team, anim, animT, walkPhase, atkT, atkDur,
 * atkKind, castT, braced, carry, id, scale, facing, hitFlash, controlled, stealth.
 */
export function drawUnit(ctx, u, x, y, t, colors, opts = {}) {
  const p = computePose(u, t);
  solve(p);
  const s = u.scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(u.facing * s, s);
  let alpha = 1;
  if (u.stealth) alpha = opts.ownTeam ? 0.35 : 0.07;
  if (opts.dim) alpha *= opts.dim;
  ctx.globalAlpha = alpha;
  const team = colors.main, dark = colors.dark;
  const lw = u.type === 'colossus' ? 3.6 : 3.1;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // behind-body accessories
  backAccessories(ctx, u, p, team, dark, t);

  // glow for controlled unit
  if (u.controlled) {
    bodyPath(ctx);
    ctx.strokeStyle = 'rgba(140,230,255,0.55)';
    ctx.lineWidth = lw + 5;
    ctx.stroke();
    ctx.beginPath(); ctx.arc(JX[J.head], JY[J.head], HEAD_R + 2.5, 0, TAU);
    ctx.fillStyle = 'rgba(140,230,255,0.55)'; ctx.fill();
  }
  const ink = u.hitFlash > 0 ? '#ff5544' : INK;
  bodyPath(ctx);
  ctx.strokeStyle = ink;
  ctx.lineWidth = lw;
  ctx.stroke();
  if (u.type === 'colossus') {
    // thicker torso + war paint stripes
    ctx.beginPath(); seg(ctx, J.hip, J.neck); ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = team; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const k = 0.3 + i * 0.2;
      const mx = JX[J.hip] + (JX[J.neck] - JX[J.hip]) * k, my = JY[J.hip] + (JY[J.neck] - JY[J.hip]) * k;
      ctx.moveTo(mx - 3, my - 1); ctx.lineTo(mx + 3, my + 1);
    }
    ctx.stroke();
  }
  // robe for inkcaster
  if (u.type === 'inkcaster') {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(JX[J.neck] - 2, JY[J.neck] + 2);
    ctx.lineTo(JX[J.neck] + 2.5, JY[J.neck] + 2);
    ctx.lineTo(JX[J.rKnee] + 5, JY[J.rKnee] + 3);
    ctx.lineTo(JX[J.lKnee] - 5, JY[J.lKnee] + 3);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.stroke();
  }
  // head
  ctx.fillStyle = ink;
  ctx.beginPath(); ctx.arc(JX[J.head], JY[J.head], HEAD_R, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(JX[J.head] + 2.6, JY[J.head] - 0.8, 1.15, 0, TAU); ctx.fill();

  frontAccessories(ctx, u, p, team, dark, t, ink);
  if (opts.hat) drawHat(ctx, opts.hat, JX[J.head], JY[J.head], team);
  if (u.tier && !opts.noTier) {
    // upgraded units get a small gold chevron on the chest
    ctx.strokeStyle = '#ffcc33'; ctx.lineWidth = 1.4;
    const mx = (JX[J.neck] + JX[J.hip]) / 2, my = (JY[J.neck] + JY[J.hip]) / 2 - 2;
    ctx.beginPath(); ctx.moveTo(mx - 2.5, my - 1.5); ctx.lineTo(mx, my + 1); ctx.lineTo(mx + 2.5, my - 1.5); ctx.stroke();
  }
  ctx.restore();
}

function backAccessories(ctx, u, p, team, dark, t) {
  const nx = JX[J.neck], ny = JY[J.neck];
  switch (u.type) {
    case 'blade': {
      // trailing scarf
      const moving = u.anim === 'walk' || u.anim === 'run' || u.anim === 'dash';
      const len = moving ? 18 : 11;
      ctx.strokeStyle = team; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(nx, ny + 1);
      for (let i = 1; i <= 4; i++) {
        const k = i / 4;
        ctx.lineTo(nx - k * len, ny + 1 + k * (moving ? 2 : 8) + Math.sin(t * 12 + i * 1.3) * (moving ? 2.2 : 1));
      }
      ctx.stroke();
      break;
    }
    case 'bowman': {
      // cloak + quiver
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.moveTo(nx - 1, ny - 1);
      ctx.quadraticCurveTo(nx - 9, ny + 8 + Math.sin(t * 5) * 1, nx - 7 + Math.sin(t * 6) * 1.5, ny + 16);
      ctx.lineTo(nx - 1, ny + 12); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.translate(nx - 3, ny + 5); ctx.rotate(-0.5);
      ctx.fillStyle = '#7a4b25'; ctx.fillRect(-2, -6, 4, 11);
      ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-1, -6); ctx.lineTo(-1.5, -9); ctx.moveTo(1, -6); ctx.lineTo(1.5, -9); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'digger':
      if (u.carry > 0 || u.anim === 'carry') {
        // sack over the shoulder
        const gold = u.carryKind !== 'ink';
        ctx.fillStyle = '#9b6b3a';
        ctx.beginPath(); ctx.arc(nx - 6, ny - 3, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = gold ? '#ffd34a' : '#6ee0ff';
        ctx.beginPath(); ctx.arc(nx - 5, ny - 8, 2.2, 0, TAU); ctx.arc(nx - 8, ny - 7, 1.8, 0, TAU); ctx.fill();
      }
      break;
    case 'colossus':
      break;
    case 'shadow': {
      // smoky ink trail when stealthed
      break;
    }
  }
}

function frontAccessories(ctx, u, p, team, dark, t, ink) {
  const hx = JX[J.head], hy = JY[J.head];
  const rhx = JX[J.rHand], rhy = JY[J.rHand], lhx = JX[J.lHand], lhy = JY[J.lHand];
  ctx.lineCap = 'round';
  switch (u.type) {
    case 'digger': {
      // helmet + lamp + headband
      ctx.fillStyle = '#e9b83a';
      ctx.beginPath(); ctx.arc(hx, hy - 1, HEAD_R + 0.8, PI, TAU); ctx.fill();
      ctx.fillStyle = team; ctx.fillRect(hx - HEAD_R - 0.5, hy - 1.5, HEAD_R * 2 + 1, 1.8);
      ctx.fillStyle = '#fff6a8'; ctx.beginPath(); ctx.arc(hx + HEAD_R - 0.5, hy - 4, 1.6, 0, TAU); ctx.fill();
      // pickaxe
      tool(ctx, rhx, rhy, p.wpn, (c) => {
        c.strokeStyle = '#7a4b25'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 3); c.lineTo(0, -15); c.stroke();
        c.strokeStyle = '#9aa3ad'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-7, -12); c.quadraticCurveTo(0, -17, 7, -12); c.stroke();
      });
      break;
    }
    case 'blade':
      headband(ctx, hx, hy, team);
      tool(ctx, rhx, rhy, p.wpn, (c) => {
        c.strokeStyle = '#3a2a1a'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(0, 2); c.lineTo(0, -2); c.stroke();
        c.strokeStyle = '#555'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-3, -2); c.lineTo(3, -2); c.stroke();
        c.strokeStyle = '#d9e2ea'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(0, -2); c.quadraticCurveTo(3, -10, 1, -19); c.stroke();
      });
      break;
    case 'bowman': {
      // hood
      ctx.fillStyle = team;
      ctx.beginPath();
      ctx.arc(hx - 0.5, hy - 0.5, HEAD_R + 1.4, PI * 0.95, PI * 2.15);
      ctx.lineTo(hx - HEAD_R - 3, hy + 3);
      ctx.closePath(); ctx.fill();
      // bow in front hand
      const bx = rhx, by = rhy;
      ctx.strokeStyle = '#7a4b25'; ctx.lineWidth = 1.9;
      ctx.beginPath(); ctx.moveTo(bx - 2, by - 13); ctx.quadraticCurveTo(bx + 7, by, bx - 2, by + 13); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,240,240,0.9)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(bx - 2, by - 13);
      if (p.draw > 0.05) ctx.lineTo(lhx, lhy); else ctx.lineTo(bx - 2, by);
      ctx.lineTo(bx - 2, by + 13); ctx.stroke();
      if (p.draw > 0.05) {
        ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(lhx, lhy); ctx.lineTo(bx + 5, by); ctx.stroke();
      }
      break;
    }
    case 'shieldbearer': {
      // plumed helmet
      ctx.fillStyle = '#8e98a3';
      ctx.beginPath(); ctx.arc(hx, hy - 0.5, HEAD_R + 1, PI, TAU); ctx.fill();
      ctx.fillRect(hx - HEAD_R - 1, hy - 1, 3, 4);
      ctx.strokeStyle = team; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(hx, hy - HEAD_R - 1); ctx.quadraticCurveTo(hx - 6, hy - HEAD_R - 6, hx - 10, hy - HEAD_R + 1); ctx.stroke();
      // spear in back hand
      tool(ctx, lhx, lhy, p.wpn, (c) => {
        c.strokeStyle = '#7a4b25'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 12); c.lineTo(0, -22); c.stroke();
        c.fillStyle = '#c9d2db'; c.beginPath(); c.moveTo(-2.4, -22); c.lineTo(0, -30); c.lineTo(2.4, -22); c.closePath(); c.fill();
      });
      // tower shield in front hand
      ctx.save(); ctx.translate(rhx + 2, rhy - 2); ctx.rotate(u.braced ? 0.05 : 0.12);
      ctx.fillStyle = '#e8e2d2'; roundRect(ctx, -3.5, -16, 9, 30, 2.5); ctx.fill();
      ctx.fillStyle = team; roundRect(ctx, -2.5, -15, 7, 28, 2); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 1.2; roundRect(ctx, -3.5, -16, 9, 30, 2.5); ctx.stroke();
      // ink-drop emblem
      ctx.fillStyle = '#f4f1e8';
      ctx.beginPath(); ctx.moveTo(1, -6); ctx.quadraticCurveTo(4, -1, 1, 2); ctx.quadraticCurveTo(-2, -1, 1, -6); ctx.fill();
      ctx.restore();
      break;
    }
    case 'inkcaster': {
      // tall pointed hat
      ctx.fillStyle = team;
      ctx.beginPath();
      ctx.moveTo(hx - 9, hy - 3); ctx.lineTo(hx + 9, hy - 3);
      ctx.lineTo(hx + 1.5, hy - 5); ctx.lineTo(hx - 5, hy - 22); ctx.lineTo(hx - 3, hy - 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd34a'; ctx.beginPath(); ctx.arc(hx - 1.5, hy - 9, 1.2, 0, TAU); ctx.fill();
      // quill staff
      ctx.strokeStyle = '#5b3a1e'; ctx.lineWidth = 1.9;
      ctx.beginPath(); ctx.moveTo(rhx, rhy + 12); ctx.lineTo(rhx, rhy - 16); ctx.stroke();
      ctx.fillStyle = '#f4f1e8';
      ctx.beginPath(); ctx.moveTo(rhx, rhy - 16); ctx.quadraticCurveTo(rhx + 6, rhy - 24, rhx + 1, rhy - 31); ctx.quadraticCurveTo(rhx - 3, rhy - 22, rhx, rhy - 16); ctx.fill();
      if (u.castT >= 0) {
        const k = clamp(u.castT / Math.max(0.3, u.channel || 1.3), 0, 1);
        const r = 2 + k * 6;
        ctx.fillStyle = team; ctx.globalAlpha *= 0.85;
        ctx.beginPath(); ctx.arc(rhx + 1, rhy - 36, r + Math.sin(t * 20) * 0.6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(rhx + 1, rhy - 36, r * 0.55, 0, TAU); ctx.fill();
        ctx.globalAlpha /= 0.85;
      }
      break;
    }
    case 'shadow': {
      // mask band over the eyes
      ctx.fillStyle = team; ctx.fillRect(hx - HEAD_R, hy - 2.2, HEAD_R * 2, 2.6);
      ctx.strokeStyle = team; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(hx - HEAD_R, hy - 1); ctx.lineTo(hx - HEAD_R - 5, hy + 1 + Math.sin(t * 9) * 1.5); ctx.stroke();
      const dagger = (c) => {
        c.strokeStyle = '#222'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 2); c.lineTo(0, -1); c.stroke();
        c.strokeStyle = '#cfd8e0'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, -1); c.lineTo(0, -9); c.stroke();
      };
      tool(ctx, rhx, rhy, p.wpn, dagger);
      tool(ctx, lhx, lhy, p.wpn2, dagger);
      break;
    }
    case 'colossus': {
      // shoulder plates
      ctx.fillStyle = '#7d8790';
      ctx.beginPath(); ctx.ellipse(JX[J.neck] + 1, JY[J.neck] + 2, 6, 3.5, 0.3, 0, TAU); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = team; ctx.fillRect(hx - 4, hy - 1, 8, 1.5);
      // stone club
      tool(ctx, rhx, rhy, p.wpn, (c) => {
        c.strokeStyle = '#6b4a2b'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(0, 3); c.lineTo(0, -10); c.stroke();
        c.fillStyle = '#8a8f96'; c.beginPath(); c.ellipse(0, -15, 4.8, 7, 0, 0, TAU); c.fill();
        c.strokeStyle = ink; c.lineWidth = 1; c.stroke();
        c.fillStyle = '#6c7178'; c.beginPath(); c.arc(-1.5, -17, 1.2, 0, TAU); c.arc(1.8, -13, 1, 0, TAU); c.fill();
      });
      break;
    }
  }
}

function headband(ctx, hx, hy, team) {
  ctx.fillStyle = team;
  ctx.fillRect(hx - HEAD_R, hy - 3.2, HEAD_R * 2, 2);
  ctx.strokeStyle = team; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(hx - HEAD_R, hy - 2.2); ctx.lineTo(hx - HEAD_R - 4, hy); ctx.stroke();
}

function tool(ctx, x, y, ang, draw) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(PI - ang); // ang uses the limb convention (0 = down)
  draw(ctx);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawHat(ctx, hat, hx, hy, team) {
  ctx.save();
  switch (hat) {
    case 'crown':
      ctx.fillStyle = '#ffcc33';
      ctx.beginPath(); ctx.moveTo(hx - 5, hy - 5); ctx.lineTo(hx - 5, hy - 11); ctx.lineTo(hx - 2.5, hy - 8); ctx.lineTo(hx, hy - 12);
      ctx.lineTo(hx + 2.5, hy - 8); ctx.lineTo(hx + 5, hy - 11); ctx.lineTo(hx + 5, hy - 5); ctx.closePath(); ctx.fill();
      break;
    case 'tophat':
      ctx.fillStyle = '#222'; ctx.fillRect(hx - 7, hy - 6.5, 14, 2); ctx.fillRect(hx - 4.5, hy - 15, 9, 9);
      ctx.fillStyle = team; ctx.fillRect(hx - 4.5, hy - 8.5, 9, 1.6);
      break;
    case 'bandana':
      ctx.fillStyle = '#d33'; ctx.beginPath(); ctx.arc(hx, hy - 1, HEAD_R + 0.6, PI, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx - 2, hy - 4, 0.8, 0, TAU); ctx.arc(hx + 2, hy - 5, 0.8, 0, TAU); ctx.fill();
      break;
    case 'horns':
      ctx.fillStyle = '#eee3c8';
      ctx.beginPath(); ctx.moveTo(hx - 4, hy - 4); ctx.quadraticCurveTo(hx - 11, hy - 8, hx - 9, hy - 14); ctx.quadraticCurveTo(hx - 7, hy - 8, hx - 2, hy - 6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hx + 4, hy - 4); ctx.quadraticCurveTo(hx + 11, hy - 8, hx + 9, hy - 14); ctx.quadraticCurveTo(hx + 7, hy - 8, hx + 2, hy - 6); ctx.fill();
      break;
    case 'halo':
      ctx.strokeStyle = '#ffe680'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(hx, hy - 11, 6, 1.8, 0, 0, TAU); ctx.stroke();
      break;
  }
  ctx.restore();
}

// Ragdoll: arrays of joint positions in world space (already projected)
export function drawRagdoll(ctx, r, alpha) {
  const x = r.x, y = r.y;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.1 * r.scale;
  ctx.beginPath();
  const L = (a, b) => { ctx.moveTo(x[a], y[a]); ctx.lineTo(x[b], y[b]); };
  L(J.hip, J.lKnee); L(J.lKnee, J.lFoot); L(J.hip, J.rKnee); L(J.rKnee, J.rFoot);
  L(J.hip, J.neck); L(J.neck, J.lElbow); L(J.lElbow, J.lHand); L(J.neck, J.rElbow); L(J.rElbow, J.rHand);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(x[J.head], y[J.head], HEAD_R * r.scale, 0, TAU); ctx.fill();
  if (r.color) {
    ctx.fillStyle = r.color;
    ctx.beginPath(); ctx.arc(x[J.head], y[J.head], HEAD_R * r.scale * 0.45, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Portrait / showcase helper: draw an idle unit of a type at (x,y)
const fake = { id: 0, anim: 'idle', animT: 0, walkPhase: 0, atkT: -1, atkDur: 0, atkKind: 'normal', castT: -1, braced: false, carry: 0, scale: 1, facing: 1, hitFlash: 0, controlled: false, stealth: false, tier: 0 };
export function drawShowcase(ctx, type, x, y, scale, colors, t = 0, opts = {}) {
  fake.type = type; fake.scale = scale; fake.anim = opts.anim || 'idle'; fake.animT = t; fake.walkPhase = t * 6;
  fake.atkT = opts.atk != null ? opts.atk : -1; fake.atkDur = 1; fake.atkKind = opts.atkKind || 'normal';
  fake.castT = opts.cast != null ? opts.cast : -1; fake.channel = 1; fake.braced = !!opts.braced; fake.facing = opts.facing || 1;
  fake.carry = opts.carry || 0; fake.carryKind = 'gold';
  drawUnit(ctx, fake, x, y, t, colors, { hat: opts.hat });
}
