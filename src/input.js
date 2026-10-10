// Touch / mouse / keyboard input for the battlefield canvas.
// Left side while controlling a unit = floating joystick; elsewhere drag pans
// the camera and a tap selects a unit (direct control) or targets Ink Storm.
import { DEPTH_SCALE, UNIT_ORDER } from './config.js';

const JOY_R = 50;

export class Input {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.panDir = 0;
    this.spellArmed = false;
    this.keys = new Set();
    this.joyId = null;
    this.joyOrigin = null;
    this.drag = null;
    this.vel = 0;
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e, true));
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.wheel(e); }, { passive: false });
    window.addEventListener('keydown', (e) => this.keydown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.resetControl(); });
    // block iOS pinch-zoom / double-tap zoom
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get playing() { return this.game.state === 'playing'; }
  get world() { return this.game.world; }

  resetControl() {
    const c = this.world?.control;
    if (c) { c.moveX = c.moveZ = 0; c.attack = false; c.special = false; }
    this.joyId = null;
    this.game.hud?.hideJoy();
  }

  down(e) {
    this.game.audio.unlock();
    if (!this.playing) return;
    e.preventDefault();
    const W = window.innerWidth;
    const ctrl = this.world.control.unit;
    if (ctrl && e.clientX < W * 0.45 && this.joyId === null && e.pointerType !== 'mouse') {
      this.joyId = e.pointerId;
      this.joyOrigin = { x: e.clientX, y: e.clientY };
      this.game.hud.showJoy(e.clientX, e.clientY);
      return;
    }
    if (this.drag) return;
    this.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, t0: performance.now(), moved: false, lastT: performance.now() };
    this.vel = 0;
  }

  move(e) {
    if (e.pointerType === 'mouse') this.lastMouseX = e.clientX;
    if (!this.playing) return;
    if (e.pointerId === this.joyId) {
      e.preventDefault();
      let dx = e.clientX - this.joyOrigin.x, dy = e.clientY - this.joyOrigin.y;
      const d = Math.hypot(dx, dy);
      if (d > JOY_R) {
        // drag the joystick base along so it never feels "stuck"
        const k = (d - JOY_R) / d;
        this.joyOrigin.x += dx * k; this.joyOrigin.y += dy * k;
        dx = e.clientX - this.joyOrigin.x; dy = e.clientY - this.joyOrigin.y;
        this.game.hud.showJoy(this.joyOrigin.x, this.joyOrigin.y);
      }
      const c = this.world.control;
      c.moveX = Math.abs(dx) < 6 ? 0 : dx / JOY_R;
      c.moveZ = Math.abs(dy) < 8 ? 0 : dy / JOY_R;
      this.game.hud.moveJoy(dx, dy);
      return;
    }
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 9) d.moved = true;
    if (d.moved) {
      const r = this.game.renderer;
      if (!this.world.control.unit) {
        r.cam.follow = null;
        r.cam.tx -= dx / r.s;
        r.cam.x -= dx / r.s; // immediate response
        const now = performance.now();
        const dt = Math.max(1, now - d.lastT);
        this.vel = this.vel * 0.6 + (-dx / r.s / dt * 1000) * 0.4;
        d.lastT = now;
      }
    }
    d.x = e.clientX;
  }

  up(e, cancel = false) {
    if (e.pointerId === this.joyId) {
      this.joyId = null;
      const c = this.world?.control;
      if (c) { c.moveX = 0; c.moveZ = 0; }
      this.game.hud.hideJoy();
      return;
    }
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    this.drag = null;
    if (!this.playing || cancel) return;
    if (!d.moved && performance.now() - d.t0 < 450) this.tap(e.clientX, e.clientY);
    else if (performance.now() - d.lastT > 80) this.vel = 0;
  }

  wheel(e) {
    if (!this.playing) return;
    const r = this.game.renderer;
    r.cam.follow = null;
    r.cam.tx += (e.deltaX || e.deltaY) / r.s;
  }

  tap(sx, sy) {
    const g = this.game, r = g.renderer, w = this.world;
    const p = r.screenToWorld(sx, sy);
    if (this.spellArmed) {
      this.spellArmed = false;
      r.spellTarget = null;
      g.castSpell(p.x);
      return;
    }
    // pick the nearest friendly unit under the finger (generous radius)
    let best = null, bd = Infinity;
    for (const u of w.units) {
      if (u.team !== 0 || !u.alive || u.garrisoned) continue;
      const cx = u.x, cy = u.z * DEPTH_SCALE + u.y - u.height * 0.5;
      const dx = (p.x - cx) / (u.halfW + 16 / r.s * 1.2 + 8);
      const dy = (p.y - cy) / (u.height * 0.6 + 12);
      const d = dx * dx + dy * dy;
      if (d < 1 && d < bd) { bd = d; best = u; }
    }
    if (best) {
      if (best === w.control.unit) g.releaseControl();
      else g.takeControl(best);
    }
  }

  armSpell() {
    this.spellArmed = !this.spellArmed;
    const r = this.game.renderer;
    r.spellTarget = this.spellArmed ? { x: r.cam.x + r.viewW / 2 } : null;
  }

  keydown(e) {
    const g = this.game;
    if (e.repeat && !['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(e.code)) return;
    g.audio.unlock();
    if (g.state !== 'playing') {
      if (e.code === 'Escape' && g.state === 'paused') g.resume();
      return;
    }
    this.keys.add(e.code);
    const c = this.world.control;
    switch (e.code) {
      case 'Escape': if (c.unit) g.releaseControl(); else g.pause(); break;
      case 'KeyP': g.pause(); break;
      case 'KeyZ': g.setStance('defend'); break;
      case 'KeyX': g.setStance('attack'); break;
      case 'KeyC': g.setStance('garrison'); break;
      case 'KeyQ': g.armSpell(); break;
      case 'KeyU': g.hud.setUpgradeMode(!g.hud.upgradeMode); break;
      case 'Space': case 'KeyJ': if (c.unit) { c.attack = true; e.preventDefault(); } break;
      case 'KeyK': case 'KeyL': if (c.unit) { c.special = true; c.specialPressed = true; } break;
      case 'Tab': e.preventDefault(); g.cycleControl(); break;
      default:
        if (e.code.startsWith('Digit')) {
          const i = +e.code.slice(5) - 1;
          const type = UNIT_ORDER[i];
          if (type) { if (e.shiftKey || g.hud.upgradeMode) g.buyUpgrade(type); else g.trainUnit(type); }
        }
    }
  }

  update(dt) {
    const g = this.game, w = this.world, r = g.renderer;
    if (!w) return;
    const k = this.keys;
    const c = w.control;
    if (c.unit) {
      if (this.joyId === null) {
        const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
        const kz = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
        if (kx || kz || this._kbMove) { c.moveX = kx; c.moveZ = kz; this._kbMove = !!(kx || kz); }
      }
      if (!k.has('Space') && !k.has('KeyJ') && this._kbAtk) c.attack = false;
      this._kbAtk = k.has('Space') || k.has('KeyJ');
      if (!k.has('KeyK') && !k.has('KeyL') && this._kbSpc) c.special = false;
      this._kbSpc = k.has('KeyK') || k.has('KeyL');
      r.cam.follow = c.unit;
    } else {
      let pan = this.panDir;
      if (k.has('KeyD') || k.has('ArrowRight')) pan += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) pan -= 1;
      if (pan) { r.cam.follow = null; r.cam.tx += pan * 700 * dt; this.vel = 0; }
      else if (!this.drag && Math.abs(this.vel) > 5) {
        r.cam.tx += this.vel * dt;
        this.vel *= Math.pow(0.04, dt);
      }
    }
    if (this.spellArmed && r.spellTarget) {
      // follow the mouse when available, otherwise the screen centre
      r.spellTarget.x = this.lastMouseX != null ? r.screenToWorld(this.lastMouseX, 0).x : r.cam.x + r.viewW / 2;
    }
  }
}
