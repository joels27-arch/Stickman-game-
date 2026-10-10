// INKFALL — entry point. Owns the game state machine (loading → menu → playing
// → paused/result), wires the simulation to rendering, audio, input and UI.
import { QUALITY, UNITS, SPELL, DIFFICULTY } from './config.js';
import { Loop } from './core/loop.js';
import { World } from './game/world.js';
import { AIController } from './game/ai.js';
import { LEVELS, makeRules, endlessRules, starsFor } from './game/levels.js';
import { Renderer } from './render/renderer.js';
import { FX } from './render/fx.js';
import { Assets } from './assets.js';
import { Audio } from './audio.js';
import { Save, SKIN_COLORS } from './save.js';
import { Input } from './input.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { Tutorial } from './ui/tutorial.js';

const REASON = { gold: 'Not enough gold', ink: 'Not enough ink crystals', pop: 'Population cap reached — buy +POP in Upgrades', 'queue full': 'Queue is full', locked: 'Locked', maxed: 'Already upgraded' };

class Game {
  constructor() {
    this.save = Save;
    this.save.load();
    this.settings = this.save.data.settings;
    this.canvas = document.getElementById('game');
    this.audio = new Audio(this.settings);
    this.assets = new Assets();
    this.state = 'loading';
    this.world = null;
    this.cfg = null;
    this.fpsLow = 0;
  }

  async boot() {
    const bar = document.getElementById('loadbar');
    const txt = document.getElementById('loadtext');
    await this.assets.load((p) => { bar.style.width = `${Math.round(p * 100)}%`; });
    txt.textContent = 'Sharpening blades…';
    this.qualityName = this.resolveQuality();
    const q = QUALITY[this.qualityName];
    this.renderer = new Renderer(this.canvas, this.assets, this.settings, q);
    this.fx = new FX(q, this.settings);
    this.hud = new HUD(this);
    this.menus = new Menus(this);
    this.tutorial = new Tutorial(this);
    this.input = new Input(this, this.canvas);
    this.applySkin();
    this.loop = new Loop((dt) => this.update(dt), (a, fdt) => this.render(a, fdt));
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.onResize(), 250));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
      if (this.audio.ctx) { if (document.hidden) this.audio.ctx.suspend(); else this.audio.ctx.resume(); }
    });
    // rotating to portrait on a phone shows the rotate overlay — pause underneath it
    const portrait = window.matchMedia('(orientation: portrait) and (max-width: 900px)');
    portrait.addEventListener?.('change', (e) => { if (e.matches && this.state === 'playing') this.pause(); });
    // first touch anywhere unlocks audio (iOS)
    const unlock = () => { this.audio.unlock(); this.audio.startMusic(this.state === 'menu' ? 'menu' : 'battle'); };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchend', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    this.startDemo();
    document.getElementById('loading').classList.remove('show');
    this.menus.showMain();
    this.loop.start();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    window.inkfall = this; // handy for debugging / automated tests
  }

  resolveQuality() {
    const q = this.settings.quality;
    if (q === 'high' || q === 'low') return q;
    const cores = navigator.hardwareConcurrency || 4;
    return cores <= 2 ? 'low' : 'high';
  }

  applySettings() {
    this.audio.applySettings();
    const qn = this.resolveQuality();
    if (qn !== this.qualityName) {
      this.qualityName = qn;
      const q = QUALITY[qn];
      this.renderer.setQuality(q);
      this.fx.setQuality(q);
    }
  }

  applySkin() {
    const s = this.save.data.skins;
    const c = SKIN_COLORS[s.color] || SKIN_COLORS.classic;
    this.renderer.setSkin(c.main, c.dark, s.hat);
    this.hud?.refreshPortraits(true);
  }

  onResize() {
    this.renderer.resize();
    if (this.world && this.state !== 'menu') this.hud.setup(this.world, this.cfg?.playerAllowed || []);
  }

  // ------------------------------------------------------------ match setup
  newWorld(opts) {
    const w = new World(opts);
    this.fx.clear();
    w.fx = this.fx;
    this.fx.world = w;
    w.on((type, d) => this.onEvent(type, d));
    this.renderer.setBiome(opts.biome);
    this.renderer.cam.x = this.renderer.cam.tx = 0;
    this.renderer.cam.follow = null;
    this.renderer.spellTarget = null;
    for (let i = 0; i < 2; i++) {
      w.spawnUnit('digger', 0, w.teams[0].monument.x + 60 + i * 10);
      w.spawnUnit('digger', 1, w.teams[1].monument.x - 60 - i * 10);
    }
    return w;
  }

  startDemo() {
    this.state = 'menu';
    this.cfg = null;
    const w = this.newWorld({ width: 2200, biome: 'grassland', teams: [{ gold: 700 }, { gold: 700 }] });
    w.ais.push(new AIController(w, 0, 'normal'), new AIController(w, 1, 'normal'));
    for (const t of w.teams) { t.ink = 10; }
    this.world = w;
    this.demoCam = 600;
    this.hud.show(false);
    this.audio.music.mode = 'menu';
  }

  startLevel(id) {
    const l = LEVELS[id - 1];
    this.startMatch({
      mode: 'campaign', level: l, biome: l.biome, difficulty: l.difficulty, width: id === 1 ? 2500 : 3000,
      playerAllowed: l.player, enemyAllowed: l.enemy,
      playerGold: l.startGold, enemyGold: l.enemyStartGold, enemyMonument: l.enemyMonument,
      favor: l.favor, tutorial: !!l.tutorial,
    });
  }

  startSkirmish(o) {
    this.startMatch({ mode: 'skirmish', biome: o.biome, difficulty: o.difficulty, width: 3000, playerAllowed: this.save.unlockedList(), enemyAllowed: undefined });
  }

  startEndless(o) {
    this.startMatch({ mode: 'endless', biome: o.biome, difficulty: null, width: 2300, playerAllowed: this.save.unlockedList() });
  }

  startMatch(cfg) {
    this.cfg = cfg;
    this.menus.hideAll();
    // rules hold per-match state, so always build them fresh
    cfg.rules = cfg.mode === 'campaign' ? makeRules(cfg.level) : cfg.mode === 'endless' ? endlessRules() : {};
    const p = this.save.playerTeamOpts(0);
    if (cfg.playerGold) p.gold = cfg.playerGold + this.save.data.armory.startGold * 60;
    p.allowed = cfg.playerAllowed;
    const e = { gold: cfg.enemyGold ?? 300, allowed: cfg.enemyAllowed, monumentHp: cfg.enemyMonument ?? 1, invulnerable: cfg.mode === 'endless' };
    const w = this.newWorld({ width: cfg.width, biome: cfg.biome, mode: cfg.mode, rules: cfg.rules, teams: [p, e] });
    this.save.applyTraining(w.teams[0]);
    if (cfg.mode !== 'endless') {
      const ai = new AIController(w, 1, cfg.difficulty, { passive: cfg.tutorial, favor: cfg.favor });
      w.ais.push(ai);
      this.ai = ai;
    } else {
      w.teams[1].stance = 'attack';
      w.teams[1].allowed = new Set(['blade', 'bowman', 'shieldbearer', 'inkcaster', 'shadow', 'colossus']);
      // endless enemy needs no diggers
      for (const u of w.units) if (u.team === 1) u.alive = false;
      w.units = w.units.filter((u) => u.alive);
    }
    this.world = w;
    this.resultT = -1;
    this.state = 'playing';
    this.hud.show(true);
    this.hud.setup(w, cfg.playerAllowed);
    this.input.spellArmed = false;
    this.input.resetControl();
    this.audio.music.mode = 'battle';
    this.audio.startMusic('battle');
    const title = cfg.mode === 'campaign' ? `${cfg.level.id}. ${cfg.level.name}` : cfg.mode === 'endless' ? 'ENDLESS DEFENSE' : 'SKIRMISH';
    const sub = cfg.mode === 'campaign' ? cfg.level.twist : cfg.mode === 'skirmish' ? DIFFICULTY[cfg.difficulty].label : 'Survive the waves';
    this.menus.showBanner(title, sub, 2.4);
    if (cfg.tutorial) this.tutorial.start(); else if (this.tutorial.active) this.tutorial.stop(true);
    this.fpsLow = 0;
  }

  restart() { if (this.cfg) this.startMatch({ ...this.cfg }); }

  toMenu() {
    if (this.tutorial.active) this.tutorial.stop(true);
    this.menus.hideAll();
    this.startDemo();
    this.menus.showMain();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.resetControl();
    this.menus.showPause();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.menus.hide('pause');
    this.state = 'playing';
    this.loop.last = performance.now();
  }

  onTutorialProgress(i) { if (i >= 4 && this.ai) this.ai.passive = false; }
  onTutorialDone() { this.save.data.tutorialDone = true; this.save.write(); if (this.ai) this.ai.passive = false; }

  // ------------------------------------------------------------ player actions
  feedback(res) {
    this.audio.play('deny');
    this.menus.toast(REASON[res] || res);
    if (res === 'gold' || res === 'ink' || res === 'pop') this.hud.flash(res);
  }
  trainUnit(type) {
    if (this.state !== 'playing') return;
    const r = this.world.teams[0].train(this.world, type);
    if (r) this.feedback(r); else this.audio.play('click');
  }
  cancelUnit(type) { this.world.teams[0].cancel(type); }
  buyUpgrade(type) {
    const r = this.world.teams[0].buyUpgrade(this.world, type);
    if (r) this.feedback(r); else { this.audio.play('upgrade'); this.menus.toast(`${UNITS[type].upgrade.name}: ${UNITS[type].upgrade.desc}`, 2); }
  }
  buyPop() {
    const r = this.world.teams[0].buyPop(this.world);
    if (r) this.feedback(r); else { this.audio.play('upgrade'); this.menus.toast(`Population cap ${this.world.teams[0].popCap}`); }
  }
  setStance(s) {
    if (this.state !== 'playing') return;
    const t = this.world.teams[0];
    if (t.stance !== s) {
      t.stance = s;
      this.audio.play(s === 'attack' ? 'horn' : 'click');
      if (s === 'attack') this.renderer.cam.follow = null;
    }
  }
  armSpell() {
    const t = this.world.teams[0];
    if (!t.canCast()) {
      this.audio.play('deny');
      this.menus.toast(t.spellCd > 0 ? `Ink Storm recharging (${Math.ceil(t.spellCd)}s)` : `Ink Storm needs ${SPELL.ink} ink crystals`);
      return;
    }
    this.input.armSpell();
    if (this.input.spellArmed) this.menus.toast('Tap the battlefield to call down the Ink Storm', 2);
  }
  castSpell(x) { if (this.world.castSpell(0, x)) this.renderer.addShake(4); }
  takeControl(u) {
    this.world.setControl(u);
    this.renderer.cam.follow = u;
    this.audio.play('control');
  }
  releaseControl() {
    if (!this.world.control.unit) return;
    this.world.releaseControl();
    this.audio.play('release');
    this.input.resetControl();
  }
  cycleControl() {
    const w = this.world, r = this.renderer;
    const mid = r.cam.x + r.viewW / 2;
    const list = w.units.filter((u) => u.team === 0 && u.type !== 'digger' && !u.garrisoned).sort((a, b) => Math.abs(a.x - mid) - Math.abs(b.x - mid));
    if (!list.length) return;
    const cur = list.indexOf(w.control.unit);
    this.takeControl(list[(cur + 1) % list.length]);
  }

  // ------------------------------------------------------------ events from the sim
  onEvent(type, d) {
    const playing = this.state === 'playing';
    switch (type) {
      case 'sfx': this.audio.play(d.name, d.x ?? null, d.quiet); break;
      case 'shake': this.renderer.addShake(d); break;
      case 'hitstop': if (playing) this.loop.freeze(d); break;
      case 'hit':
        if (d.blocked) this.audio.play('block', d.unit.x, true);
        else if (d.kind === 'slash') this.audio.play('slash', d.unit.x);
        else if (d.kind === 'pierce') this.audio.play('pierce', d.unit.x);
        else if (d.kind === 'arrow') this.audio.play('thud', d.unit.x, true);
        if (this.settings.dmgNumbers && playing && d.amount >= 1) {
          const u = d.unit;
          this.fx.text(u.x, u.z * 0.9 - u.height - 6, String(Math.round(d.amount)), u.team === 0 ? '#ffb0a0' : d.src?.controlled ? '#8fe6ff' : '#fff6c0', d.src?.controlled);
        }
        break;
      case 'death': this.audio.play('death', d.unit.x, true); break;
      case 'structureDestroyed':
        this.fx.collapse(d.s);
        // show the collapse
        if (playing && d.s.kind === 'monument') { this.renderer.cam.follow = null; this.renderer.cam.tx = d.s.x - this.renderer.viewW / 2; }
        break;
      case 'deposit':
        if (playing && Math.random() < 0.5) this.audio.play('coin', d.unit.x, true);
        if (playing && this.settings.dmgNumbers) this.fx.text(d.unit.x, -50, `+${Math.round(d.amount)}`, d.kind === 'gold' ? '#ffd34a' : '#7fe0ff');
        break;
      case 'spawn': if (playing && d.unit.team === 0) this.audio.play('train', d.unit.x, true); break;
      case 'gameover':
        if (this.state === 'playing') this.resultT = 3.4;
        if (this.state === 'playing') {
          const win = d.winner === 0;
          this.menus.showBanner(this.cfg.mode === 'endless' ? 'MONUMENT FALLEN' : win ? 'VICTORY' : 'DEFEAT', '', 3);
          this.audio.play(win && this.cfg.mode !== 'endless' ? 'victory' : 'defeat');
          this.input.resetControl();
        }
        break;
      case 'wave': if (playing) { this.menus.showBanner(`WAVE ${d.wave}`, `${d.count} enemies incoming`, 2); this.audio.play('horn'); } break;
      case 'waveClear': if (playing) this.menus.toast(`Wave ${d.wave} cleared! +${d.bonus} gold`, 2.5); break;
      case 'banner': if (playing) this.menus.showBanner(d.text, d.sub, 2.5); break;
      case 'release': if (d.died && playing) { this.menus.toast('Your champion has fallen'); this.input.resetControl(); } break;
    }
  }

  // ------------------------------------------------------------ results & rewards
  finishMatch() {
    const w = this.world, cfg = this.cfg, s = this.save.data;
    const win = w.winner === 0;
    const t0 = w.teams[0];
    const r = {
      mode: cfg.mode, win, stars: 0, gems: 0,
      stats: { time: w.time, kills: t0.stats.kills, trained: t0.stats.trained, lost: t0.stats.lost, gold: t0.stats.gold, ink: t0.stats.ink, damage: t0.stats.damage, monument: Math.max(0, t0.monument.hp / t0.monument.maxHp) },
    };
    s.totals.battles++; if (win) s.totals.wins++; s.totals.kills += t0.stats.kills;
    if (cfg.mode === 'campaign') {
      const l = cfg.level;
      r.levelId = l.id; r.levelName = l.name;
      r.stars = starsFor(l, w);
      const prev = s.stars[l.id] || 0;
      if (win) {
        r.gems = s.cleared[l.id] ? 3 + Math.max(0, r.stars - prev) * 5 : 15 + r.stars * 5;
        s.cleared[l.id] = true;
        s.stars[l.id] = Math.max(prev, r.stars);
        if (l.reward && !s.unlocked[l.reward]) { s.unlocked[l.reward] = true; r.unlock = l.reward; }
      } else r.gems = 2;
    } else if (cfg.mode === 'skirmish') {
      r.gems = win ? { easy: 8, normal: 15, hard: 25, insane: 40 }[cfg.difficulty] : 3;
    } else {
      const wave = w.waves?.wave || 0;
      r.wave = wave;
      r.newBest = wave > s.endlessBest;
      r.gems = wave * 2 + (r.newBest ? 10 : 0);
      if (r.newBest) s.endlessBest = wave;
      r.best = s.endlessBest;
    }
    s.gems += r.gems;
    this.save.write();
    this.state = 'result';
    this.hud.show(false);
    if (this.tutorial.active) this.tutorial.stop(true);
    this.menus.showResult(r);
  }

  // ------------------------------------------------------------ loop
  update(dt) {
    const w = this.world;
    if (!w) return;
    if (this.state === 'playing' || this.state === 'menu' || this.state === 'result') {
      this.input.update(dt);
      w.update(dt);
      this.fx.update(dt);
    }
    if (this.state === 'playing') {
      this.tutorial.update(dt);
      if (this.resultT > 0) { this.resultT -= dt; if (this.resultT <= 0) this.finishMatch(); }
    } else if (this.state === 'menu') {
      if (w.over && w.endT > 4) this.startDemo();
      if (w.time > 420) this.startDemo();
    }
  }

  render(alpha, fdt) {
    const w = this.world;
    if (!w) return;
    const r = this.renderer;
    if (this.state === 'menu') {
      // demo camera drifts toward the action
      let sum = 0, n = 0;
      for (const u of w.units) if (u.type !== 'digger') { sum += u.x; n++; }
      const target = n ? sum / n - r.viewW * 0.62 : w.width / 2 - r.viewW / 2;
      r.cam.follow = null;
      r.cam.tx += (target - r.cam.tx) * Math.min(1, fdt * 0.6);
    }
    r.updateCamera(w, fdt);
    r.render(w, this.fx, this.state === 'paused' ? 1 : alpha, fdt);
    if (this.state === 'playing' || this.state === 'paused') this.hud.update(fdt);
    this.audio.setListener(r.cam.x + r.viewW / 2, r.viewW);
    // battle intensity drives the music
    let fighting = 0;
    for (const u of w.units) if (u.atkT >= 0 && u.type !== 'digger') fighting++;
    this.audio.setIntensity(this.state === 'playing' ? fighting / 12 : 0.2);
    // adaptive quality: drop to performance mode if we can't hold ~45 fps
    if (this.state === 'playing' && this.settings.quality === 'auto' && this.qualityName === 'high') {
      if (this.loop.fps < 42) this.fpsLow += fdt; else this.fpsLow = Math.max(0, this.fpsLow - fdt);
      if (this.fpsLow > 4) {
        this.qualityName = 'low';
        this.renderer.setQuality(QUALITY.low);
        this.fx.setQuality(QUALITY.low);
        this.menus.toast('Performance mode enabled');
      }
    }
  }
}

const game = new Game();
game.boot().catch((e) => {
  console.error(e);
  const t = document.getElementById('loadtext');
  if (t) t.textContent = 'Failed to start: ' + e.message;
});
