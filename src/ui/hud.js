// In-battle HUD: resources, minimap, train buttons (queue + cooldown rings),
// army commands, Ink Storm button and direct-control buttons.
import { UNITS, UNIT_ORDER, SPELL, TEAM_COLORS, DEPTH } from '../config.js';
import { drawShowcase } from '../render/stick.js';

export const ICONS = {
  defend: '<svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" fill="currentColor"/></svg>',
  attack: '<svg viewBox="0 0 24 24"><path d="M3 21l3-1 9-9-2-2-9 9zM14 4l6 6 1-6z" fill="currentColor"/><path d="M13 9l2 2" stroke="#000" stroke-width="2"/></svg>',
  garrison: '<svg viewBox="0 0 24 24"><path d="M3 21V8l3-2v3h3V5l3-2 3 2v4h3V6l3 2v13h-7v-5h-4v5z" fill="currentColor"/></svg>',
  pop: '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="9" cy="7" r="3.5" fill="#fff"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6z" fill="#fff"/><circle cx="17" cy="8" r="2.5" fill="#bbb"/><path d="M14 20c0-3 1.5-4.5 3-4.5S21 17 21 20z" fill="#bbb"/></svg>',
  ink: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2c4 6 7 9 7 13a7 7 0 0 1-14 0c0-4 3-7 7-13z" fill="#59d0ff" stroke="#000" stroke-width="1.5"/><circle cx="10" cy="14" r="2" fill="#fff"/></svg>',
};

export function portraitCanvas(type, colors, size = 64, hat = null) {
  const c = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = size * dpr; c.height = size * dpr;
  c.style.width = size + 'px'; c.style.height = size + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const big = type === 'colossus';
  const sc = big ? size / 66 : size / 62;
  drawShowcase(ctx, type, size * 0.5, size * 0.93, sc, colors, 0.4, { hat });
  return c;
}

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.upgradeMode = false;
    this.cache = {};
    this.build();
    document.getElementById('ui').appendChild(this.root);
    this.mmT = 0;
  }

  build() {
    const keys = ['1', '2', '3', '4', '5', '6', '7'];
    this.root.innerHTML = `
      <div class="topbar">
        <div class="tl">
          <button class="ibtn" id="pauseBtn" title="Pause (Esc)">❚❚</button>
          <div class="plank">
            <div class="res">
              <div class="chip" id="cGold"><i class="ico g"></i><span>0</span></div>
              <div class="chip" id="cInk"><i class="ico i"></i><span>0</span></div>
              <div class="chip" id="cPop">${ICONS.pop}<span>0/20</span></div>
            </div>
          </div>
          <div class="cmds">
            <button class="cmd" data-stance="garrison" title="Garrison (C)">${ICONS.garrison}<small>GARRISON</small></button>
            <button class="cmd" data-stance="defend" title="Defend (Z)">${ICONS.defend}<small>DEFEND</small></button>
            <button class="cmd atk" data-stance="attack" title="Attack (X)">${ICONS.attack}<small>ATTACK</small></button>
          </div>
        </div>
        <div class="mm">
          <div class="mhp"><i id="hpB" style="background:${TEAM_COLORS[0]}"></i></div>
          <canvas id="minimap"></canvas>
          <div class="mhp"><i id="hpR" style="background:${TEAM_COLORS[1]}"></i></div>
        </div>
      </div>
      <button class="pan l" data-pan="-1">◀</button>
      <button class="pan r" data-pan="1">▶</button>
      <div class="bottombar">
        ${UNIT_ORDER.map((t, i) => `<button class="tbtn" data-type="${t}"><span class="key">${keys[i]}</span><span class="cost"></span><span class="badge"></span><div class="ring"></div></button>`).join('')}
        <button class="tbtn" data-type="pop" style="display:none"><div class="lbl"></div></button>
        <button class="tbtn toggle" id="upgToggle" title="Upgrades (U)"><div class="lbl">⬆<br>UPG</div></button>
        <button class="ibtn" id="spell" title="Ink Storm (Q)"><svg viewBox="0 0 24 24"><path d="M13 2 5 13h6l-2 9 9-12h-6z" fill="#2a1600"/></svg><div class="ring"></div></button>
      </div>
      <div class="ctrlname ctrl"></div>
      <div class="joyhint ctrl">DRAG<br>TO MOVE</div>
      <div id="joy"><i></i></div>
      <button class="abtn ctrl" id="relBtn" title="Release (X)">✕</button>
      <button class="abtn ctrl" id="spcBtn" title="Special (K)"><span></span><div class="ring"></div></button>
      <button class="abtn ctrl" id="atkBtn" title="Attack (J / Space)">⚔</button>
      <div id="fps"></div>
    `;
    this.el = {
      gold: this.root.querySelector('#cGold span'), ink: this.root.querySelector('#cInk span'), pop: this.root.querySelector('#cPop span'),
      goldChip: this.root.querySelector('#cGold'), inkChip: this.root.querySelector('#cInk'), popChip: this.root.querySelector('#cPop'),
      hpB: this.root.querySelector('#hpB'), hpR: this.root.querySelector('#hpR'),
      mm: this.root.querySelector('#minimap'), spell: this.root.querySelector('#spell'),
      cmds: [...this.root.querySelectorAll('.cmd')], ctrlName: this.root.querySelector('.ctrlname'),
      joy: this.root.querySelector('#joy'), joyKnob: this.root.querySelector('#joy i'), joyHint: this.root.querySelector('.joyhint'),
      spc: this.root.querySelector('#spcBtn'), atk: this.root.querySelector('#atkBtn'), rel: this.root.querySelector('#relBtn'),
      upg: this.root.querySelector('#upgToggle'), fps: this.root.querySelector('#fps'),
    };
    this.tbtns = {};
    for (const b of this.root.querySelectorAll('.tbtn[data-type]')) this.tbtns[b.dataset.type] = b;
    this.bind();
  }

  bind() {
    const g = this.game;
    const tap = (el, fn) => el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); g.audio.unlock(); fn(e); });
    for (const [type, b] of Object.entries(this.tbtns)) {
      tap(b, () => {
        if (type === 'pop') return g.buyPop();
        if (this.upgradeMode) g.buyUpgrade(type); else g.trainUnit(type);
      });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); if (type !== 'pop') g.cancelUnit(type); });
    }
    tap(this.el.upg, () => this.setUpgradeMode(!this.upgradeMode));
    for (const c of this.el.cmds) tap(c, () => g.setStance(c.dataset.stance));
    tap(this.el.spell, () => g.armSpell());
    tap(this.root.querySelector('#pauseBtn'), () => g.pause());
    tap(this.el.rel, () => g.releaseControl());
    // attack / special are held buttons
    const hold = (el, down, up) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture?.(e.pointerId); el.classList.add('down'); down(); });
      const end = (e) => { el.classList.remove('down'); up(); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
    };
    hold(this.el.atk, () => { g.world.control.attack = true; }, () => { g.world.control.attack = false; });
    hold(this.el.spc, () => { g.world.control.special = true; g.world.control.specialPressed = true; }, () => { g.world.control.special = false; });
    // edge pan buttons
    for (const p of this.root.querySelectorAll('.pan')) {
      hold(p, () => { g.input.panDir = +p.dataset.pan; }, () => { g.input.panDir = 0; });
    }
    // minimap tap / drag
    const mm = this.el.mm;
    const mmMove = (e) => {
      const r = mm.getBoundingClientRect();
      const f = (e.clientX - r.left) / r.width;
      g.renderer.cam.follow = null;
      g.renderer.cam.tx = f * g.world.width - g.renderer.viewW / 2;
    };
    mm.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); mm.setPointerCapture?.(e.pointerId); mmMove(e); mm._drag = true; });
    mm.addEventListener('pointermove', (e) => { if (mm._drag) mmMove(e); });
    mm.addEventListener('pointerup', () => { mm._drag = false; });
  }

  setUpgradeMode(on) {
    this.upgradeMode = on;
    this.el.upg.classList.toggle('on', on);
    this.tbtns.pop.style.display = on ? '' : 'none';
    this.cache = {};
    this.refreshPortraits(true);
  }

  // called when a match starts
  setup(world, allowed) {
    this.world = world;
    this.allowed = allowed;
    this.cache = {};
    this.upgradeMode = false;
    this.el.upg.classList.remove('on');
    this.tbtns.pop.style.display = 'none';
    for (const [type, b] of Object.entries(this.tbtns)) {
      if (type === 'pop') continue;
      b.style.display = allowed.includes(type) ? '' : 'none';
    }
    this.refreshPortraits(true);
    const mm = this.el.mm;
    const r = mm.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    mm.width = Math.max(100, r.width * dpr); mm.height = Math.max(20, r.height * dpr);
    this.root.classList.remove('controlling');
  }

  refreshPortraits(force) {
    const colors = this.game.renderer.colors[0];
    for (const t of UNIT_ORDER) {
      const b = this.tbtns[t];
      const old = b.querySelector('canvas');
      if (old && !force) continue;
      if (old) old.remove();
      const c = portraitCanvas(t, colors, 64, this.game.renderer.hat);
      b.insertBefore(c, b.firstChild);
    }
  }

  show(on) { this.root.classList.toggle('show', on); }

  set(key, el, val, prop = 'textContent') {
    if (this.cache[key] === val) return;
    this.cache[key] = val;
    el[prop] = val;
  }

  setVar(key, el, val) {
    if (this.cache[key] === val) return;
    this.cache[key] = val;
    el.style.setProperty('--p', val);
  }

  flash(which) {
    const el = which === 'gold' ? this.el.goldChip : which === 'ink' ? this.el.inkChip : this.el.popChip;
    if (!el) return;
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  update(dt) {
    const w = this.world;
    if (!w) return;
    const team = w.teams[0];
    this.set('gold', this.el.gold, String(Math.floor(team.gold)));
    this.set('ink', this.el.ink, String(Math.floor(team.ink)));
    this.set('pop', this.el.pop, `${team.pop(w)}/${team.popCap}`);
    const b = w.teams[0].monument, r = w.teams[1].monument;
    this.set('hpB', this.el.hpB.style, `${Math.max(0, b.hp / b.maxHp) * 100}%`, 'width');
    this.set('hpR', this.el.hpR.style, r.invulnerable ? '100%' : `${Math.max(0, r.hp / r.maxHp) * 100}%`, 'width');

    // command buttons
    for (const c of this.el.cmds) {
      const on = team.stance === c.dataset.stance;
      if (this.cache['cmd' + c.dataset.stance] !== on) { this.cache['cmd' + c.dataset.stance] = on; c.classList.toggle('on', on); }
    }
    // train buttons
    for (const type of UNIT_ORDER) {
      const btn = this.tbtns[type];
      if (btn.style.display === 'none') continue;
      const d = UNITS[type];
      const q = team.queues[type];
      let costHtml, can, ringP = 0;
      if (this.upgradeMode) {
        const up = d.upgrade;
        const maxed = team.tiers[type] >= 1;
        costHtml = maxed ? '<span>✓ MAX</span>' : `<b>${up.cost}</b>${up.ink ? `<em>◆${up.ink}</em>` : ''}`;
        can = !maxed && team.gold >= up.cost && team.ink >= up.ink;
        btn.classList.toggle('maxed', maxed);
        btn.classList.add('up');
      } else {
        costHtml = `<b>${d.cost}</b>${d.ink ? `<em>◆${d.ink}</em>` : ''}`;
        can = team.canAfford(type) && team.pop(w) + d.pop <= team.popCap && q.count < 5;
        ringP = q.count > 0 ? 1 - q.t / d.time : 0;
        btn.classList.remove('up', 'maxed');
      }
      this.set('cost' + type, btn.querySelector('.cost'), costHtml, 'innerHTML');
      if (this.cache['can' + type] !== can) { this.cache['can' + type] = can; btn.classList.toggle('no', !can); }
      const badge = btn.querySelector('.badge');
      const cnt = this.upgradeMode ? 0 : q.count;
      if (this.cache['q' + type] !== cnt) {
        this.cache['q' + type] = cnt;
        badge.textContent = cnt; badge.classList.toggle('show', cnt > 0);
      }
      const rp = Math.round(ringP * 100) / 100;
      if (this.cache['ring' + type] !== rp) { this.cache['ring' + type] = rp; btn.style.setProperty('--p', rp); }
    }
    if (this.upgradeMode) {
      const pb = this.tbtns.pop;
      const maxed = team.popCap >= team.popCapMax;
      this.set('popbtn', pb.querySelector('.lbl'), maxed ? '👥<br>MAX' : `👥 +5<br><b style="color:#8a6400">${team.popUpgradeCost()}</b>`, 'innerHTML');
      pb.classList.toggle('no', maxed || team.gold < team.popUpgradeCost());
    }
    // spell
    const sp = this.el.spell;
    const cdp = team.spellCd > 0 ? team.spellCd / SPELL.cd : 0;
    const ready = team.canCast();
    this.setVar('spellp', sp, String(Math.round((cdp > 0 ? cdp : (team.ink < SPELL.ink ? 1 - team.ink / SPELL.ink : 0)) * 50) / 50));
    if (this.cache.spellReady !== ready) { this.cache.spellReady = ready; sp.classList.toggle('ready', ready); }
    const armed = this.game.input.spellArmed;
    if (this.cache.spellArmed !== armed) { this.cache.spellArmed = armed; sp.classList.toggle('armed', armed); }

    // direct control
    const cu = w.control.unit;
    const controlling = !!cu;
    if (this.cache.ctrl !== controlling) {
      this.cache.ctrl = controlling;
      this.root.classList.toggle('controlling', controlling);
    }
    if (cu) {
      this.set('cname', this.el.ctrlName, `CONTROLLING: ${UNITS[cu.type].name.toUpperCase()}  •  +50% DMG`);
      const ab = UNITS[cu.type].ability;
      this.set('spcname', this.el.spc.querySelector('span'), cu.type === 'shieldbearer' ? 'HOLD<br>BRACE' : ab.name.toUpperCase().replace(' ', '<br>'), 'innerHTML');
      const p = cu.abilityT > 0 ? cu.abilityT / ab.cd : 0;
      this.setVar('spcp', this.el.spc, String(Math.round(p * 50) / 50));
    }
    // minimap at ~15 fps
    this.mmT -= dt;
    if (this.mmT <= 0) { this.mmT = 0.066; this.drawMinimap(); }
    if (this.game.save.data.settings.fps) this.set('fps', this.el.fps, `${Math.round(this.game.loop.fps)} fps · ${w.units.length} units`);
    else this.set('fps', this.el.fps, '');
  }

  drawMinimap() {
    const w = this.world, c = this.el.mm, ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const k = W / w.width;
    // viewport
    const cam = this.game.renderer.cam;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.fillRect(cam.x * k, 1, this.game.renderer.viewW * k, H - 2);
    ctx.strokeRect(cam.x * k + 0.5, 1.5, this.game.renderer.viewW * k - 1, H - 3);
    // monuments
    for (const s of w.structures) {
      if (s.dead) continue;
      ctx.fillStyle = s.kind === 'statue' ? '#ffd34a' : TEAM_COLORS[s.team];
      const sz = s.kind === 'statue' ? 3 : 5;
      ctx.fillRect(s.x * k - sz, H * 0.2, sz * 2, H * 0.6);
    }
    for (const n of w.nodes) {
      ctx.fillStyle = n.kind === 'gold' ? '#ffcc33' : '#59d0ff';
      ctx.fillRect(n.x * k - 1, H - 5, 2, 3);
    }
    for (const u of w.units) {
      if (u.team === 1 && u.stealth) continue;
      ctx.fillStyle = u.controlled ? '#9ff' : TEAM_COLORS[u.team];
      const y = 3 + (u.z / DEPTH) * (H - 10);
      const s = u.type === 'colossus' ? 3 : u.type === 'digger' ? 1 : 1.6;
      ctx.fillRect(u.x * k - s, y, s * 2, s * 2 + 1);
    }
  }

  // floating joystick visuals
  showJoy(x, y) { const j = this.el.joy; j.style.left = x + 'px'; j.style.top = y + 'px'; j.classList.add('show'); this.el.joyHint.classList.add('hide'); }
  moveJoy(dx, dy) { this.el.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`; }
  hideJoy() { this.el.joy.classList.remove('show'); this.el.joyKnob.style.transform = ''; }
}
