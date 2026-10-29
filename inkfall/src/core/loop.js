// Fixed-timestep simulation with interpolated rendering.
// update(dt) always receives DT; render(alpha) gets the fraction toward the next step.
import { DT } from '../config.js';

export class Loop {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.acc = 0;
    this.last = 0;
    this.running = false;
    this.timeScale = 1;     // slow-mo / fast-forward
    this.hitStop = 0;       // seconds of frozen simulation (combat juice)
    this.fps = 60;
    this._fpsAcc = 0;
    this._fpsFrames = 0;
    this._raf = (t) => this.frame(t);
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    requestAnimationFrame(this._raf);
  }
  stop() { this.running = false; }
  freeze(sec) { this.hitStop = Math.max(this.hitStop, sec); }
  frame(now) {
    if (!this.running) return;
    let frameDt = (now - this.last) / 1000;
    this.last = now;
    if (frameDt > 0.25) frameDt = 0.25; // tab switch / hitch: don't spiral
    this._fpsAcc += frameDt; this._fpsFrames++;
    if (this._fpsAcc >= 0.5) { this.fps = this._fpsFrames / this._fpsAcc; this._fpsAcc = 0; this._fpsFrames = 0; }
    if (this.hitStop > 0) {
      this.hitStop -= frameDt;
    } else {
      this.acc += frameDt * this.timeScale;
      let steps = 0;
      while (this.acc >= DT && steps < 8) {
        this.update(DT);
        this.acc -= DT;
        steps++;
      }
      if (steps === 8) this.acc = 0;
    }
    this.render(this.acc / DT, frameDt);
    requestAnimationFrame(this._raf);
  }
}
