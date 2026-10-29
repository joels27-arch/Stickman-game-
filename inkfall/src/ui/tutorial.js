// Level-1 tutorial: step-by-step prompts that advance on player actions.
export class Tutorial {
  constructor(game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.id = 'tut';
    document.getElementById('ui').appendChild(this.el);
    this.active = false;
    this.hl = null;
  }

  start() {
    const g = this.game;
    const w = () => g.world;
    const hud = () => g.hud.root;
    this.steps = [
      { text: 'Welcome, commander! Your <b>Diggers</b> mine gold on their own and carry it home. More diggers = more gold. <b>Train a Digger.</b>',
        target: () => hud().querySelector('[data-type="digger"]'), done: () => w().countType(0, 'digger') >= 3 },
      { text: 'Gold buys soldiers. <b>Blades</b> are fast swordsmen. <b>Train a Blade.</b>',
        target: () => hud().querySelector('[data-type="blade"]'), done: () => w().countType(0, 'blade') >= 1 },
      { text: '<b>Bowmen</b> fire arcing arrows from behind your front line. <b>Train a Bowman.</b>',
        target: () => hud().querySelector('[data-type="bowman"]'), done: () => w().countType(0, 'bowman') >= 1 },
      { text: 'Your army <b>DEFENDS</b> the monument by default. When you have a few soldiers, tap <b>ATTACK</b> to march on the enemy!',
        target: () => hud().querySelector('[data-stance="attack"]'), done: () => w().teams[0].stance === 'attack' },
      { text: 'Signature move: <b>tap any of your soldiers</b> to take <b>direct control</b> of it.',
        target: null, done: () => !!w().control.unit },
      { text: 'Drag on the <b>left side</b> to move (or WASD). Tap <b>⚔</b> to attack (Space) and the purple button for a <b>special ability</b> (K). Controlled units deal +50% damage!',
        target: () => hud().querySelector('#atkBtn'), done: (t) => t > 9 || !w().control.unit },
      { text: 'Tap <b>✕</b> (or the unit again) to hand it back to the AI. <b>GARRISON</b> pulls everyone behind the monument where Bowmen shoot from the wall. Now <b>destroy the enemy monument!</b>',
        target: () => hud().querySelector('#relBtn'), done: (t) => t > 9 },
    ];
    this.i = 0;
    this.t = 0;
    this.active = true;
    this.render();
  }

  render() {
    if (this.hl) { this.hl.classList.remove('hl'); this.hl = null; }
    const s = this.steps[this.i];
    if (!s) { this.stop(); return; }
    this.el.innerHTML = `<div class="step">Tutorial ${this.i + 1}/${this.steps.length}</div>${s.text}`;
    this.el.classList.add('show');
    const t = s.target?.();
    if (t) { t.classList.add('hl'); this.hl = t; }
  }

  update(dt) {
    if (!this.active) return;
    const s = this.steps[this.i];
    this.t += dt;
    // keep the highlight in sync (control buttons appear later)
    if (s.target && !this.hl) { const t = s.target(); if (t && t.offsetParent) { t.classList.add('hl'); this.hl = t; } }
    if (s.done(this.t)) {
      this.i++;
      this.t = 0;
      this.game.audio.play('upgrade');
      if (this.i >= 4) this.game.onTutorialProgress?.(this.i);
      this.render();
    }
  }

  stop(silent = false) {
    this.active = false;
    this.el.classList.remove('show');
    if (this.hl) { this.hl.classList.remove('hl'); this.hl = null; }
    if (!silent) this.game.onTutorialDone?.();
  }
}
