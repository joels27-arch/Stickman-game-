// All sound is synthesized with the Web Audio API — no audio files.
// SFX are short procedural voices; music is a lookahead drum/bass sequencer
// whose intensity follows the battle.

export class Audio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.noise = null;
    this.last = {};
    this.listenerX = 0;
    this.viewW = 800;
    this.music = { on: false, mode: 'menu', step: 0, next: 0, intensity: 0, timer: null };
  }

  // iOS requires creating/resuming the context inside a user gesture
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain(); this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate * 1;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applySettings();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  applySettings() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.settings.sound ? 0.8 : 0, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.settings.music ? 0.32 : 0, t, 0.1);
  }

  setListener(x, viewW) { this.listenerX = x; this.viewW = viewW; }

  // ------------------------------------------------------------ primitives
  env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  out(vol, pan) {
    const g = this.ctx.createGain();
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p); p.connect(this.sfxBus);
    } else g.connect(this.sfxBus);
    g.gain.value = vol;
    return g;
  }

  osc(type, f0, f1, t, dur, peak, dest, attack = 0.005) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    this.env(g, t, attack, peak, dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + attack + dur + 0.05);
  }

  noiseHit(t, dur, peak, dest, type = 'bandpass', freq = 1000, q = 1, freq1 = null) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freq1) f.frequency.exponentialRampToValueAtTime(freq1, t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, 0.003, peak, dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------ sfx
  play(name, x = null, quiet = false) {
    if (!this.ctx || !this.settings.sound) return;
    const now = this.ctx.currentTime;
    // rate limit identical sounds so big battles don't clip
    const lim = { pick: 0.07, hit: 0.035, slash: 0.035, bow: 0.05, arrowland: 0.06, thunk: 0.05, stonehit: 0.08, death: 0.06, block: 0.05 }[name] ?? 0.02;
    if (this.last[name] && now - this.last[name] < lim) return;
    this.last[name] = now;
    let vol = quiet ? 0.45 : 1, pan = 0;
    if (x !== null) {
      const dx = x - this.listenerX;
      const far = Math.abs(dx) / (this.viewW * 0.6);
      if (far > 2.2) return;
      vol *= Math.max(0.12, 1 - far * 0.45);
      pan = dx / (this.viewW * 0.7);
    }
    const o = this.out(vol, pan);
    const t = now + 0.001;
    const r = 0.92 + Math.random() * 0.16;
    switch (name) {
      case 'bow':
        this.osc('triangle', 520 * r, 180, t, 0.16, 0.35, o);
        this.noiseHit(t, 0.06, 0.15, o, 'highpass', 3000);
        break;
      case 'bowdraw':
        this.noiseHit(t, 0.18, 0.04, o, 'bandpass', 900 * r, 6, 1400);
        break;
      case 'slash': case 'hit':
        this.noiseHit(t, 0.09, 0.4, o, 'bandpass', 2400 * r, 1.5);
        this.osc('square', 1800 * r, 1300, t, 0.07, 0.07, o);
        this.osc('sine', 3200 * r, 2900, t, 0.12, 0.05, o);
        break;
      case 'clang': case 'block':
        this.osc('square', 1200 * r, 1150, t, 0.18, 0.08, o);
        this.osc('sine', 2600 * r, 2500, t, 0.25, 0.08, o);
        this.noiseHit(t, 0.05, 0.25, o, 'highpass', 4000);
        break;
      case 'pierce':
        this.noiseHit(t, 0.08, 0.35, o, 'bandpass', 1200 * r, 2);
        this.osc('sine', 220, 120, t, 0.08, 0.2, o);
        break;
      case 'thud':
        this.osc('sine', 140 * r, 60, t, 0.14, 0.45, o);
        this.noiseHit(t, 0.06, 0.2, o, 'lowpass', 900);
        break;
      case 'pick':
        this.osc('triangle', 1600 * r, 1500, t, 0.06, 0.18, o);
        this.osc('sine', 2400 * r, 2350, t, 0.1, 0.08, o);
        this.noiseHit(t, 0.03, 0.15, o, 'highpass', 3000);
        break;
      case 'explode':
        this.noiseHit(t, 0.7, 0.8, o, 'lowpass', 1800, 0.7, 120);
        this.osc('sine', 110, 35, t, 0.6, 0.8, o);
        break;
      case 'smash':
        this.osc('sine', 90, 30, t, 0.5, 0.9, o);
        this.noiseHit(t, 0.4, 0.6, o, 'lowpass', 600, 0.8, 80);
        break;
      case 'collapse':
        this.noiseHit(t, 2.5, 0.9, o, 'lowpass', 500, 0.6, 60);
        this.osc('sine', 60, 25, t, 2.5, 0.9, o, 0.05);
        break;
      case 'stonehit':
        this.noiseHit(t, 0.12, 0.35, o, 'bandpass', 500 * r, 1);
        this.osc('sine', 180, 90, t, 0.1, 0.25, o);
        break;
      case 'thunk':
        this.noiseHit(t, 0.05, 0.25, o, 'bandpass', 800, 2);
        break;
      case 'arrowland':
        this.noiseHit(t, 0.05, 0.12, o, 'bandpass', 600, 2);
        break;
      case 'death':
        this.osc('sawtooth', 300 * r, 90, t, 0.25, 0.12, o);
        this.noiseHit(t, 0.12, 0.2, o, 'lowpass', 1200);
        break;
      case 'dash': case 'whoosh':
        this.noiseHit(t, 0.18, name === 'dash' ? 0.45 : 0.18, o, 'bandpass', 600, 1.2, 3000);
        break;
      case 'vanish':
        this.noiseHit(t, 0.35, 0.3, o, 'bandpass', 3000, 3, 400);
        this.osc('sine', 900, 300, t, 0.3, 0.1, o);
        break;
      case 'backstab':
        this.noiseHit(t, 0.1, 0.5, o, 'bandpass', 3500, 2);
        this.osc('square', 2200, 1800, t, 0.12, 0.1, o);
        break;
      case 'channel':
        this.osc('sine', 220, 660, t, 0.9, 0.12, o, 0.2);
        this.osc('triangle', 330, 990, t, 0.9, 0.06, o, 0.2);
        break;
      case 'cast':
        this.noiseHit(t, 0.25, 0.3, o, 'bandpass', 1500, 1, 500);
        this.osc('sine', 880, 440, t, 0.25, 0.12, o);
        break;
      case 'spell':
        for (let i = 0; i < 4; i++) this.osc('triangle', 880 - i * 120, 300, t + i * 0.08, 0.4, 0.12, o);
        break;
      case 'click':
        this.osc('triangle', 900, 700, t, 0.05, 0.25, o);
        break;
      case 'deny':
        this.osc('square', 200, 150, t, 0.12, 0.12, o);
        break;
      case 'coin':
        this.osc('square', 1320, 1320, t, 0.06, 0.07, o);
        this.osc('square', 1760, 1760, t + 0.06, 0.12, 0.07, o);
        break;
      case 'train':
        this.osc('triangle', 440, 880, t, 0.12, 0.2, o);
        break;
      case 'control':
        this.osc('sine', 600, 1200, t, 0.18, 0.25, o);
        this.osc('triangle', 900, 1800, t + 0.05, 0.18, 0.12, o);
        break;
      case 'release':
        this.osc('sine', 1000, 500, t, 0.15, 0.2, o);
        break;
      case 'horn':
        this.osc('sawtooth', 147, 147, t, 1.0, 0.18, o, 0.08);
        this.osc('sawtooth', 220, 220, t, 1.0, 0.12, o, 0.08);
        break;
      case 'victory': {
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => this.osc('triangle', f, f, t + i * 0.14, 0.4, 0.25, o));
        this.osc('triangle', 1047, 1047, t + 0.6, 1.2, 0.2, o);
        break;
      }
      case 'defeat': {
        const notes = [392, 349, 311, 262];
        notes.forEach((f, i) => this.osc('sawtooth', f, f * 0.98, t + i * 0.25, 0.45, 0.12, o));
        break;
      }
      case 'upgrade':
        [660, 880, 1100].forEach((f, i) => this.osc('triangle', f, f, t + i * 0.07, 0.15, 0.18, o));
        break;
    }
  }

  // ------------------------------------------------------------ music
  startMusic(mode = 'battle') {
    this.music.mode = mode;
    if (!this.ctx) return;
    if (this.music.timer) return;
    this.music.next = this.ctx.currentTime + 0.1;
    this.music.step = 0;
    this.music.timer = setInterval(() => this.schedule(), 30);
  }
  stopMusic() { clearInterval(this.music.timer); this.music.timer = null; }
  setIntensity(v) { this.music.intensity += (Math.max(0, Math.min(1, v)) - this.music.intensity) * 0.05; }

  schedule() {
    if (!this.ctx || !this.settings.music) { if (this.ctx) this.music.next = this.ctx.currentTime + 0.1; return; }
    const m = this.music;
    const menu = m.mode === 'menu';
    const bpm = menu ? 84 : 96 + m.intensity * 30;
    const stepDur = 60 / bpm / 4;
    while (m.next < this.ctx.currentTime + 0.12) {
      this.musicStep(m.step, m.next, menu, m.intensity);
      m.next += stepDur;
      m.step = (m.step + 1) % 64;
    }
  }

  musicStep(step, t, menu, I) {
    const bus = this.musicBus;
    const s16 = step % 16;
    // war drums
    if (s16 === 0 || s16 === 10 || (!menu && s16 === 7 && I > 0.3)) this.drum(t, 70, 0.9);
    if (s16 === 4 || s16 === 12) this.drum(t, menu ? 110 : 130, 0.5);
    if (!menu && I > 0.15 && (s16 === 14 || s16 === 15)) this.drum(t, 160, 0.3);
    if (!menu && I > 0.55 && s16 % 2 === 1) this.noiseHit(t, 0.04, 0.05, bus, 'highpass', 6000);
    if (s16 === 4 || s16 === 12) this.noiseHit(t, 0.12, menu ? 0.06 : 0.12, bus, 'bandpass', 1800, 0.8);
    // bass ostinato (D minor pentatonic)
    const bassLine = [0, 0, 3, 0, 5, 0, 3, 2];
    if (step % 4 === 0) {
      const idx = (step / 4) % 8;
      const semis = bassLine[idx] + (Math.floor(step / 32) % 2 === 1 && idx > 5 ? -2 : 0);
      const f = 73.4 * Math.pow(2, semis / 12);
      this.osc('triangle', f, f, t, 0.35, menu ? 0.16 : 0.22, bus, 0.01);
    }
    // sparse melody on top when the fight heats up (or in the menu)
    const mel = [0, 3, 5, 7, 10, 7, 5, 3];
    if ((menu || I > 0.4) && step % 8 === 6 && Math.random() < 0.6) {
      const n = mel[Math.floor(Math.random() * mel.length)];
      const f = 293.7 * Math.pow(2, n / 12);
      this.osc(menu ? 'sine' : 'square', f, f, t, 0.3, menu ? 0.05 : 0.025, bus, 0.02);
    }
  }

  drum(t, f, v) {
    this.osc('sine', f * 1.8, f, t, 0.28, v * 0.6, this.musicBus, 0.002);
    this.noiseHit(t, 0.05, v * 0.15, this.musicBus, 'lowpass', 400);
  }
}
