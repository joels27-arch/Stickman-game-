// Unified input: keyboard + mouse, touch (floating joystick, Jump/Dive buttons,
// drag-to-look) and gamepads. Outputs a joystick vector in camera space, held
// buttons (with short latches so quick taps always reach the server) and
// accumulated camera deltas.

import { Btn } from '../../shared/constants';

export interface RawInput { x: number; y: number; btn: number }

const LATCH_TICKS_MS = 70;

export class InputManager {
  private keys = new Set<string>();
  private joyX = 0; private joyY = 0;
  private touchJump = false; private touchDive = false;
  private jumpLatchUntil = 0; private diveLatchUntil = 0;
  /** A press stays latched until a simulation tick has consumed it (see ack()). */
  private jumpPending = false; private divePending = false;
  private camDX = 0; private camDY = 0;
  private lastCamInput = 0;
  private dragging = false;
  private pointerRoles = new Map<number, { role: 'joy' | 'cam' | 'jump' | 'dive'; x: number; y: number; ox: number; oy: number }>();
  enabled = false;
  isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  sensitivity = 1;
  invertY = false;
  onPause: (() => void) | null = null;
  onAnyInput: (() => void) | null = null;
  // touch UI
  readonly touchRoot: HTMLDivElement;
  private joyBase: HTMLDivElement;
  private joyKnob: HTMLDivElement;
  private jumpBtn: HTMLDivElement;
  private diveBtn: HTMLDivElement;
  private gpPrevStart = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.touchRoot = document.createElement('div');
    this.touchRoot.className = 'touch-ui';
    this.touchRoot.innerHTML = `
      <div class="joy-zone"></div>
      <div class="joy-base"><div class="joy-knob"></div></div>
      <div class="tbtn tbtn-dive"><span>DIVE</span></div>
      <div class="tbtn tbtn-jump"><span>JUMP</span></div>`;
    this.joyBase = this.touchRoot.querySelector('.joy-base')!;
    this.joyKnob = this.touchRoot.querySelector('.joy-knob')!;
    this.jumpBtn = this.touchRoot.querySelector('.tbtn-jump')!;
    this.diveBtn = this.touchRoot.querySelector('.tbtn-dive')!;
    document.body.appendChild(this.touchRoot);
    this.setTouchVisible(false);

    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      if (e.code === 'Escape') { this.onPause?.(); return; }
      if (!this.enabled) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) {
        if (e.code === 'Space') { this.jumpLatchUntil = performance.now() + LATCH_TICKS_MS; this.jumpPending = true; }
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') { this.diveLatchUntil = performance.now() + LATCH_TICKS_MS; this.divePending = true; }
      }
      this.keys.add(e.code);
      this.onAnyInput?.();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.joyX = this.joyY = 0; this.touchJump = this.touchDive = false; });

    // Mouse: drag (or pointer lock) to look.
    canvas.addEventListener('mousedown', (e) => { if (this.enabled && !this.isTouchEvent(e)) { this.dragging = true; } });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.dragging || document.pointerLockElement === canvas) this.addCam(e.movementX, e.movementY, 0.0042);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch (pointer events; supports multitouch).
    const root = this.touchRoot;
    root.addEventListener('pointerdown', (e) => this.pDown(e));
    root.addEventListener('pointermove', (e) => this.pMove(e));
    root.addEventListener('pointerup', (e) => this.pUp(e));
    root.addEventListener('pointercancel', (e) => this.pUp(e));
    // Block iOS gestures/zoom while playing.
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => { if (this.enabled) e.preventDefault(); }, { passive: false });
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => { const now = Date.now(); if (this.enabled && now - lastTouchEnd < 350) e.preventDefault(); lastTouchEnd = now; }, { passive: false });
  }

  private isTouchEvent(e: MouseEvent) { return (e as PointerEvent).pointerType === 'touch'; }

  setTouchVisible(v: boolean) { this.touchRoot.style.display = v && this.isTouch ? 'block' : 'none'; }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) { this.keys.clear(); this.joyX = this.joyY = 0; this.touchJump = this.touchDive = false; this.pointerRoles.clear(); this.joyBase.classList.remove('on'); }
    this.setTouchVisible(on);
  }

  private pDown(e: PointerEvent) {
    if (!this.enabled) return;
    e.preventDefault();
    this.isTouch = true;
    const tgt = (e.target as HTMLElement).closest('.tbtn');
    const now = performance.now();
    if (tgt === this.jumpBtn) { this.pointerRoles.set(e.pointerId, { role: 'jump', x: e.clientX, y: e.clientY, ox: 0, oy: 0 }); this.touchJump = true; this.jumpPending = true; this.jumpLatchUntil = now + LATCH_TICKS_MS; this.jumpBtn.classList.add('on'); }
    else if (tgt === this.diveBtn) { this.pointerRoles.set(e.pointerId, { role: 'dive', x: e.clientX, y: e.clientY, ox: 0, oy: 0 }); this.touchDive = true; this.divePending = true; this.diveLatchUntil = now + LATCH_TICKS_MS; this.diveBtn.classList.add('on'); }
    else if (e.clientX < window.innerWidth * 0.45 && ![...this.pointerRoles.values()].some((r) => r.role === 'joy')) {
      // Floating joystick: the base appears under the thumb (kept away from the edges).
      const ox = Math.max(70, Math.min(window.innerWidth * 0.45, e.clientX));
      const oy = Math.max(70, Math.min(window.innerHeight - 70, e.clientY));
      this.pointerRoles.set(e.pointerId, { role: 'joy', x: e.clientX, y: e.clientY, ox, oy });
      this.joyBase.style.left = `${ox}px`; this.joyBase.style.top = `${oy}px`;
      this.joyBase.classList.add('on');
      this.updateJoy(e.clientX, e.clientY, ox, oy);
    } else {
      this.pointerRoles.set(e.pointerId, { role: 'cam', x: e.clientX, y: e.clientY, ox: 0, oy: 0 });
    }
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    this.onAnyInput?.();
  }

  private pMove(e: PointerEvent) {
    const r = this.pointerRoles.get(e.pointerId);
    if (!r) return;
    e.preventDefault();
    if (r.role === 'joy') this.updateJoy(e.clientX, e.clientY, r.ox, r.oy);
    else if (r.role === 'cam') this.addCam(e.clientX - r.x, e.clientY - r.y, 0.0068);
    r.x = e.clientX; r.y = e.clientY;
  }

  private pUp(e: PointerEvent) {
    const r = this.pointerRoles.get(e.pointerId);
    if (!r) return;
    this.pointerRoles.delete(e.pointerId);
    if (r.role === 'joy') { this.joyX = this.joyY = 0; this.joyBase.classList.remove('on'); this.joyKnob.style.transform = 'translate(-50%,-50%)'; }
    if (r.role === 'jump') { this.touchJump = false; this.jumpBtn.classList.remove('on'); }
    if (r.role === 'dive') { this.touchDive = false; this.diveBtn.classList.remove('on'); }
  }

  private updateJoy(x: number, y: number, ox: number, oy: number) {
    const R = 58;
    let dx = x - ox, dy = y - oy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    this.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    let jx = dx / R, jy = -dy / R;
    const m = Math.hypot(jx, jy);
    if (m < 0.14) { jx = 0; jy = 0; }
    else { const k = Math.min(1, (m - 0.14) / 0.76) / m; jx *= k; jy *= k; } // dead zone + full speed before the rim
    this.joyX = jx; this.joyY = jy;
  }

  private addCam(dx: number, dy: number, k: number) {
    this.camDX += dx * k * this.sensitivity;
    this.camDY += dy * k * this.sensitivity * (this.invertY ? -1 : 1);
    this.lastCamInput = performance.now();
  }

  /** Seconds since the player last moved the camera. */
  get camIdle() { return (performance.now() - this.lastCamInput) / 1000; }

  consumeCamera(): { dx: number; dy: number } {
    const r = { dx: this.camDX, dy: this.camDY };
    this.camDX = this.camDY = 0;
    return r;
  }

  sample(): RawInput {
    if (!this.enabled) return { x: 0, y: 0, btn: 0 };
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (x || y) { const l = Math.hypot(x, y); x /= l; y /= l; }
    else { x = this.joyX; y = this.joyY; }
    const now = performance.now();
    let btn = 0;
    if (k.has('Space') || this.touchJump || this.jumpPending || now < this.jumpLatchUntil) btn |= Btn.Jump;
    if (k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyE') || this.touchDive || this.divePending || now < this.diveLatchUntil) btn |= Btn.Dive;
    // Gamepad
    const pads = navigator.getGamepads?.() ?? [];
    for (const gp of pads) {
      if (!gp) continue;
      const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
      if (Math.hypot(ax, ay) > 0.18) { x = ax; y = -ay; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } }
      const rx = gp.axes[2] ?? 0, ry = gp.axes[3] ?? 0;
      if (Math.abs(rx) > 0.15 || Math.abs(ry) > 0.15) this.addCam(rx * 14, ry * 10, 0.0042);
      if (gp.buttons[0]?.pressed) btn |= Btn.Jump;
      if (gp.buttons[1]?.pressed || gp.buttons[2]?.pressed) btn |= Btn.Dive;
      const start = !!gp.buttons[9]?.pressed;
      if (start && !this.gpPrevStart) this.onPause?.();
      this.gpPrevStart = start;
      break;
    }
    return { x, y, btn };
  }

  /** The simulation advanced with the last sampled input: latched presses have been seen. */
  ack() { this.jumpPending = false; this.divePending = false; }

  requestLock() { if (!this.isTouch) this.canvas.requestPointerLock?.(); }
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
