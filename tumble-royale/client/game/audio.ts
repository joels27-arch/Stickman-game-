// All sound is synthesised with WebAudio: playful SFX and a small sequencer
// that plays procedural music tracks. Nothing to download; starts after the
// first user gesture (mobile autoplay rules).

type Track = 'menu' | 'lobby' | 'race' | 'survival' | 'final' | 'victory' | null;

interface Song {
  bpm: number;
  chords: number[][];      // semitone offsets from root per bar (triads)
  root: number;            // MIDI note
  lead: number[];          // per-16th scale-degree pattern, -1 = rest (indexes into chord tones + octave)
  bass: number[];          // per-16th: 1 = root, 2 = fifth, 0 = rest
  drums: string;           // per-16th: k = kick, s = snare, h = hat, x = kick+hat, o = open hat, . = rest
  leadWave: OscillatorType;
  swing?: number;
  bars?: number;
}

const SONGS: Record<Exclude<Track, null>, Song> = {
  menu: {
    bpm: 112, root: 60, leadWave: 'triangle',
    chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]],
    lead: [0, -1, 2, -1, 1, -1, 2, 3, -1, 2, -1, 1, 0, -1, -1, -1],
    bass: [1, 0, 0, 0, 2, 0, 1, 0, 1, 0, 0, 0, 2, 0, 0, 0],
    drums: 'k.h.s.h.k.hks.h.',
  },
  lobby: {
    bpm: 104, root: 62, leadWave: 'sine',
    chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [-5, -1, 2]],
    lead: [2, -1, -1, 1, -1, -1, 0, -1, 1, -1, 2, -1, 3, -1, -1, -1],
    bass: [1, 0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 1, 0, 0, 2, 0],
    drums: 'k...s..hk.k.s...',
  },
  race: {
    bpm: 148, root: 64, leadWave: 'square',
    chords: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]],
    lead: [0, 1, 2, 1, 3, -1, 2, -1, 0, 1, 2, 3, 4, 3, 2, 1],
    bass: [1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 2, 0],
    drums: 'xhshkhshxhshkhsh',
  },
  survival: {
    bpm: 136, root: 57, leadWave: 'sawtooth',
    chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]],
    lead: [0, -1, 0, 2, -1, 1, -1, 0, 3, -1, 2, -1, 1, -1, 0, -1],
    bass: [1, 1, 0, 1, 2, 0, 1, 0, 1, 1, 0, 1, 2, 0, 2, 0],
    drums: 'xhsxkhshxhsxkhso',
  },
  final: {
    bpm: 156, root: 55, leadWave: 'square',
    chords: [[0, 3, 7], [-4, 0, 3], [-5, -1, 2], [-2, 2, 5]],
    lead: [0, 2, 1, 3, 2, 4, 3, 2, 0, 2, 1, 3, 4, -1, 4, -1],
    bass: [1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2],
    drums: 'xhsxxhshxhsxxsss',
  },
  victory: {
    bpm: 128, root: 60, leadWave: 'triangle',
    chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]],
    lead: [0, 1, 2, 3, 4, -1, 3, -1, 4, -1, 5, -1, 4, -1, -1, -1],
    bass: [1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 1, 1, 0],
    drums: 'k.s.k.s.kks.k.ss',
  },
};

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private noise!: AudioBuffer;
  private track: Track = null;
  private wantTrack: Track = null;
  private step = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  musicVol = 0.6;
  sfxVol = 0.8;
  private last = new Map<string, number>();

  /** Must be called from a user gesture at least once. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9;
      this.music = this.ctx.createGain(); this.sfx = this.ctx.createGain();
      this.music.connect(this.master); this.sfx.connect(this.master); this.master.connect(comp); comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      if (this.wantTrack) this.play(this.wantTrack);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setVolumes(music: number, sfx: number) { this.musicVol = music; this.sfxVol = sfx; this.applyVolumes(); }
  private applyVolumes() { if (!this.ctx) return; this.music.gain.value = this.musicVol * 0.32; this.sfx.gain.value = this.sfxVol * 0.9; }

  // ------------------------------------------------------------ music

  // Recorded loops (generated for the game) with the procedural sequencer as fallback.
  private buffers = new Map<string, AudioBuffer | 'loading' | 'failed'>();
  private src: { node: AudioBufferSourceNode; gain: GainNode; file: string } | null = null;
  private static FILES: Partial<Record<Exclude<Track, null>, { file: string; rate: number }>> = {
    menu: { file: 'lobby', rate: 1 }, lobby: { file: 'lobby', rate: 1 }, race: { file: 'race', rate: 1 },
    survival: { file: 'race', rate: 0.94 }, final: { file: 'final', rate: 1 },
  };

  private load(file: string) {
    if (!this.ctx || this.buffers.has(file)) return;
    this.buffers.set(file, 'loading');
    fetch(`/music/${file}.m4a`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
      .then((b) => this.ctx!.decodeAudioData(b))
      .then((buf) => { this.buffers.set(file, buf); if (this.track && Audio.FILES[this.track]?.file === file) { const t = this.track; this.track = null; this.play(t); } })
      .catch(() => this.buffers.set(file, 'failed'));
  }

  private stopFile(fade = 0.6) {
    if (!this.src || !this.ctx) return;
    const { node, gain } = this.src;
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + fade);
    try { node.stop(now + fade + 0.05); } catch { /* ignore */ }
    this.src = null;
  }

  play(track: Track) {
    this.wantTrack = track;
    if (!this.ctx || track === this.track) return;
    const f = track ? Audio.FILES[track] : undefined;
    if (f) {
      for (const x of new Set(Object.values(Audio.FILES).map((v) => v!.file))) this.load(x);
      const buf = this.buffers.get(f.file);
      if (buf instanceof AudioBuffer) {
        this.track = track;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (this.src?.file === f.file) { this.src.node.playbackRate.value = f.rate; return; }
        this.stopFile();
        const node = this.ctx.createBufferSource();
        node.buffer = buf; node.loop = true; node.playbackRate.value = f.rate;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(3.0, this.ctx.currentTime + 0.8);
        node.connect(gain); gain.connect(this.music);
        node.start();
        this.src = { node, gain, file: f.file };
        return;
      }
      if (buf === 'loading' || buf === undefined) { this.track = track; this.stopFile(); this.startSequencer(track); return; }
    }
    this.stopFile();
    this.startSequencer(track);
  }

  private startSequencer(track: Track) {
    if (!this.ctx) return;
    this.track = track;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.12;
    if (this.timer) clearInterval(this.timer);
    if (!track) return;
    // Quick fade-in on track change.
    const g = this.music.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setValueAtTime(0.0001, this.ctx.currentTime);
    g.linearRampToValueAtTime(this.musicVol * 0.32, this.ctx.currentTime + 0.6);
    this.timer = setInterval(() => this.schedule(), 25);
  }

  private schedule() {
    if (!this.ctx || !this.track) return;
    const song = SONGS[this.track];
    const spb = 60 / song.bpm / 4; // seconds per 16th
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(song, this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step++;
      if (this.track === 'victory' && this.step >= 16 * 8) { this.play('lobby'); return; }
    }
  }

  private playStep(s: Song, step: number, t: number, spb: number) {
    const bar = Math.floor(step / 16) % s.chords.length;
    const i = step % 16;
    const chord = s.chords[bar];
    const variation = Math.floor(step / 64) % 2; // every 4 bars, vary the lead
    // drums
    const dch = s.drums[i];
    if (dch === 'k' || dch === 'x') this.kick(t);
    if (dch === 's') this.snare(t);
    if (dch === 'h' || dch === 'x') this.hat(t, 0.04);
    if (dch === 'o') this.hat(t, 0.16);
    // bass
    const b = s.bass[i];
    if (b) this.note(midi(s.root - 24 + chord[0] + (b === 2 ? 7 : 0)), t, spb * 1.8, 'triangle', 0.5, 900);
    // pad on bar start
    if (i === 0) for (const n of chord) this.note(midi(s.root + n), t, spb * 15, 'sawtooth', 0.045, 1400, 0.3);
    // lead
    let li = s.lead[(i + variation * 4) % 16];
    if (li >= 0) {
      const tones = [chord[0], chord[1], chord[2], chord[0] + 12, chord[1] + 12, chord[2] + 12];
      if (variation && i % 8 === 6) li = (li + 1) % tones.length;
      this.note(midi(s.root + 12 + tones[li % tones.length]), t, spb * 0.9, s.leadWave, s.leadWave === 'square' ? 0.07 : 0.12, 3200);
    }
  }

  private note(freq: number, t: number, dur: number, type: OscillatorType, vol: number, cutoff: number, attack = 0.005) {
    const c = this.ctx!;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.music);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private kick(t: number) {
    const c = this.ctx!;
    const o = c.createOscillator(); const g = c.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.25);
  }
  private snare(t: number) { this.noiseHit(t, 0.16, 1800, 'bandpass', 0.42, this.music); }
  private hat(t: number, d: number) { this.noiseHit(t, d, 7000, 'highpass', 0.18, this.music); }

  private noiseHit(t: number, dur: number, freq: number, type: BiquadFilterType, vol: number, dest: AudioNode) {
    const c = this.ctx!;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------ sfx

  private ok(name: string, minGap = 0.04): boolean {
    if (!this.ctx || this.ctx.state !== 'running') return false;
    const now = this.ctx.currentTime;
    if ((this.last.get(name) ?? -1) > now - minGap) return false;
    this.last.set(name, now);
    return true;
  }

  private tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, t = 0, dest?: AudioNode) {
    const c = this.ctx!;
    const st = c.currentTime + t;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, st); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), st + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, st); g.gain.exponentialRampToValueAtTime(0.001, st + dur);
    o.connect(g); g.connect(dest ?? this.sfx); o.start(st); o.stop(st + dur + 0.02);
  }

  /** Volume scaled by distance for other players' sounds. */
  sfxAt(name: 'jump' | 'dive' | 'knock' | 'bounce' | 'land', dist: number) {
    if (dist > 28) return;
    const v = Math.max(0.12, 1 - dist / 28) * 0.55;
    this[name](v);
  }

  jump(v = 1) { if (this.ok('jump', 0.05)) { this.tone(320, 720, 0.16, 'sine', 0.28 * v); this.tone(640, 1100, 0.08, 'triangle', 0.08 * v); } }
  dive(v = 1) { if (this.ok('dive')) { this.noiseHit(this.ctx!.currentTime, 0.25, 900, 'bandpass', 0.35 * v, this.sfx); this.tone(500, 220, 0.2, 'triangle', 0.12 * v); } }
  land(v = 1) { if (this.ok('land', 0.08)) { this.tone(160, 70, 0.1, 'sine', 0.3 * v); } }
  bigLand(v = 1) { if (this.ok('bigland', 0.1)) { this.tone(120, 40, 0.22, 'sine', 0.5 * v); this.noiseHit(this.ctx!.currentTime, 0.12, 400, 'lowpass', 0.25 * v, this.sfx); } }
  bounce(v = 1) {
    if (!this.ok('bounce', 0.08)) return;
    const c = this.ctx!, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.25);
    const lfo = c.createOscillator(); lfo.frequency.value = 28; const lg = c.createGain(); lg.gain.value = 60; lfo.connect(lg); lg.connect(o.frequency);
    const g = c.createGain(); g.gain.setValueAtTime(0.32 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g); g.connect(this.sfx); o.start(t); lfo.start(t); o.stop(t + 0.36); lfo.stop(t + 0.36);
  }
  knock(v = 1) { if (this.ok('knock', 0.08)) { this.tone(900, 160, 0.22, 'square', 0.12 * v); this.noiseHit(this.ctx!.currentTime, 0.1, 1200, 'bandpass', 0.4 * v, this.sfx); this.tone(1800, 1700, 0.3, 'sine', 0.06 * v, 0.05); } }
  boost() { if (this.ok('boost', 0.2)) { this.tone(300, 1400, 0.3, 'sawtooth', 0.08); this.noiseHit(this.ctx!.currentTime, 0.3, 3000, 'highpass', 0.15, this.sfx); } }
  splash() { if (this.ok('splash', 0.2)) this.noiseHit(this.ctx!.currentTime, 0.5, 1200, 'lowpass', 0.5, this.sfx); }
  respawn() { if (this.ok('respawn', 0.2)) [523, 659, 784].forEach((f, i) => this.tone(f, f * 1.01, 0.12, 'triangle', 0.12, i * 0.06)); }
  checkpoint() { if (this.ok('cp', 0.3)) [784, 1047].forEach((f, i) => this.tone(f, f, 0.15, 'triangle', 0.15, i * 0.08)); }
  click() { if (this.ok('click', 0.03)) this.tone(900, 1300, 0.05, 'triangle', 0.18); }
  hover() { if (this.ok('hover', 0.05)) this.tone(1300, 1500, 0.03, 'sine', 0.05); }
  coin() { if (this.ok('coin', 0.06)) { this.tone(988, 988, 0.08, 'square', 0.07); this.tone(1319, 1319, 0.25, 'square', 0.07, 0.08); } }
  countdown(n: number) { if (this.ok('cd' + n, 0.5)) this.tone(n > 0 ? 660 : 1320, n > 0 ? 660 : 1320, n > 0 ? 0.18 : 0.5, 'square', 0.14); if (n === 0 && this.ctx) [523, 659, 784, 1047].forEach((f) => this.tone(f, f, 0.6, 'triangle', 0.08)); }
  qualified() { if (this.ok('qual', 1)) [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, f, 0.22, 'triangle', 0.18, i * 0.07)); }
  eliminated() { if (this.ok('elim', 1)) [392, 370, 349, 262].forEach((f, i) => this.tone(f, f * 0.97, i === 3 ? 0.7 : 0.3, 'sawtooth', 0.1, i * 0.28)); }
  whoosh() { if (this.ok('whoosh', 0.2)) this.noiseHit(this.ctx!.currentTime, 0.4, 2000, 'bandpass', 0.25, this.sfx); }
  fanfare() { if (this.ok('fanfare', 2)) [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45], [784, 0.7], [1047, 0.85]].forEach(([f, d]) => this.tone(f, f, 0.35, 'square', 0.1, d)); }
  tileCrack() { if (this.ok('tile', 0.05)) this.noiseHit(this.ctx!.currentTime, 0.12, 2500, 'bandpass', 0.2, this.sfx); }
}

export const audio = new Audio();
