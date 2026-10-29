// Menu screens built from DOM: main menu, campaign map, skirmish / endless setup,
// Armory (permanent upgrades, unlocks, skins), settings, pause and results.
import { UNITS, UNIT_ORDER, BIOMES, DIFFICULTY } from '../config.js';
import { LEVELS, CHAPTERS, UNLOCK_BY_LEVEL } from '../game/levels.js';
import { ARMORY, UNLOCK_COST, SKIN_COLORS, SKIN_HATS } from '../save.js';
import { portraitCanvas } from './hud.js';
import { drawShowcase } from '../render/stick.js';

const $ = (sel, root = document) => root.querySelector(sel);
const gem = '<i class="gem"></i>';
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// level node positions inside each chapter column (percent)
const NODE_POS = [[22, 72], [52, 48], [80, 26]];

export class Menus {
  constructor(game) {
    this.game = game;
    this.ui = document.getElementById('ui');
    this.screens = {};
    for (const id of ['menu', 'map', 'setup', 'armory', 'settings', 'pause', 'result', 'levelinfo']) {
      const el = document.createElement('div');
      el.id = id;
      el.className = id === 'menu' || id === 'map' ? 'screen' : 'overlay';
      this.ui.appendChild(el);
      this.screens[id] = el;
    }
    this.banner = document.createElement('div'); this.banner.id = 'banner';
    this.toastEl = document.createElement('div'); this.toastEl.id = 'toast';
    this.ui.append(this.banner, this.toastEl);
    // delegate clicks: elements with data-act
    this.ui.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      this.game.audio.unlock();
      this.game.audio.play('click');
      this.act(t.dataset.act, t.dataset, t);
    });
    this.skirmish = { difficulty: 'normal', biome: 'grassland' };
    this.endless = { biome: 'grassland' };
    this.armoryTab = 'upgrades';
    this.settingsBack = 'menu';
  }

  get save() { return this.game.save; }

  hideAll() { for (const el of Object.values(this.screens)) el.classList.remove('show'); }
  show(id) { this.screens[id].classList.add('show'); }
  hide(id) { this.screens[id].classList.remove('show'); }

  act(a, d) {
    const g = this.game;
    switch (a) {
      case 'campaign': this.showMap(); break;
      case 'skirmish': this.showSetup('skirmish'); break;
      case 'endless': this.showSetup('endless'); break;
      case 'armory': this.showArmory(); break;
      case 'settings': this.showSettings(d.back || 'menu'); break;
      case 'back': this.showMain(); break;
      case 'close': this.hide(d.target); if (d.target === 'settings' && this.settingsBack === 'pause') this.show('pause'); break;
      case 'level': this.showLevelInfo(+d.id); break;
      case 'play-level': this.hideAll(); g.startLevel(+d.id); break;
      case 'diff': this.skirmish.difficulty = d.v; this.showSetup('skirmish'); break;
      case 'biome': this[d.mode].biome = d.v; this.showSetup(d.mode); break;
      case 'start-skirmish': this.hideAll(); g.startSkirmish(this.skirmish); break;
      case 'start-endless': this.hideAll(); g.startEndless(this.endless); break;
      case 'tab': this.armoryTab = d.v; this.showArmory(); break;
      case 'buy': this.buy(d); break;
      case 'toggle': this.save.data.settings[d.k] = !this.save.data.settings[d.k]; this.save.write(); g.applySettings(); this.showSettings(this.settingsBack); break;
      case 'quality': this.save.data.settings.quality = d.v; this.save.write(); g.applySettings(); this.showSettings(this.settingsBack); break;
      case 'reset':
        if (d.confirm === '1') { this.save.reset(); g.applySettings(); this.toast('Progress reset'); this.showSettings(this.settingsBack); }
        else { const b = this.screens.settings.querySelector('[data-act="reset"]'); b.dataset.confirm = '1'; b.textContent = 'Tap again to confirm'; }
        break;
      case 'resume': g.resume(); break;
      case 'restart': this.hideAll(); g.restart(); break;
      case 'quit': this.hideAll(); g.toMenu(); break;
      case 'next': this.hideAll(); g.startLevel(+d.id); break;
      case 'pause-settings': this.hide('pause'); this.showSettings('pause'); break;
    }
  }

  // ------------------------------------------------------------ main menu
  showMain() {
    this.hideAll();
    const s = this.save.data;
    this.screens.menu.innerHTML = `
      <div class="col">
        <div class="logo">INK<span>FALL</span></div>
        <div class="tag">Stick-figure war. Draw your army. Break their monument.</div>
        <button class="btn blue" data-act="campaign">⚔ Campaign</button>
        <button class="btn" data-act="skirmish">⚑ Skirmish</button>
        <button class="btn" data-act="endless">∞ Endless Defense${s.endlessBest ? ` <small style="opacity:.6">· best wave ${s.endlessBest}</small>` : ''}</button>
        <button class="btn gold" data-act="armory">⬆ Armory</button>
        <button class="btn" data-act="settings" data-back="menu">⚙ Settings</button>
      </div>
      <div class="gems"><span class="gemchip">${gem} ${s.gems}</span></div>`;
    this.show('menu');
  }

  // ------------------------------------------------------------ campaign map
  levelUnlocked(id) { return id === 1 || !!this.save.data.cleared[id - 1]; }

  showMap() {
    this.hideAll();
    const s = this.save.data;
    const total = Object.values(s.stars).reduce((a, b) => a + b, 0);
    const next = LEVELS.find((l) => !s.cleared[l.id])?.id;
    this.screens.map.innerHTML = `
      <div class="head">
        <button class="btn small" data-act="back">◀ Back</button>
        <div class="logo small">CAMPAIGN</div>
        <span class="gemchip">★ ${total}/36 &nbsp; ${gem} ${s.gems}</span>
      </div>
      <div class="world">
        ${CHAPTERS.map((ch, ci) => {
          const locked = !this.levelUnlocked(ch.levels[0]);
          return `<div class="chapter ${ch.id} ${locked ? 'locked' : ''}">
            <div class="cname">${ci + 1}. ${ch.name}</div>
            ${ch.levels.map((id, i) => {
              const l = LEVELS[id - 1];
              const st = s.stars[id] || 0;
              const un = this.levelUnlocked(id);
              // snake: odd chapters climb, even chapters descend
              const [x, y0] = NODE_POS[i];
              const y = ci % 2 ? 100 - y0 : y0;
              return `<button class="lvl ${l.biome === 'night' ? 'night' : ''} ${un ? '' : 'locked'} ${id === next ? 'next' : ''}" style="left:${x}%;top:${y}%" ${un ? `data-act="level" data-id="${id}"` : ''}>
                ${id}<span class="st">${un ? '★'.repeat(st) + '☆'.repeat(3 - st) : ''}</span></button>`;
            }).join('')}
          </div>`;
        }).join('')}
        <canvas class="paths" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></canvas>
      </div>`;
    this.show('map');
    requestAnimationFrame(() => this.drawPaths());
  }

  drawPaths() {
    const world = $('.world', this.screens.map);
    const cv = $('.paths', this.screens.map);
    if (!world || !cv) return;
    const r = world.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    const pts = [...world.querySelectorAll('.lvl')].map((b) => { const q = b.getBoundingClientRect(); return [q.left + q.width / 2 - r.left, q.top + q.height / 2 - r.top]; });
    ctx.strokeStyle = 'rgba(20,20,20,0.55)'; ctx.lineWidth = 4; ctx.setLineDash([2, 9]); ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else { const [px, py] = pts[i - 1]; ctx.quadraticCurveTo((px + x) / 2 + (y - py) * 0.25, (py + y) / 2 - (x - px) * 0.15, x, y); } });
    ctx.stroke();
  }

  showLevelInfo(id) {
    const l = LEVELS[id - 1];
    const st = this.save.data.stars[id] || 0;
    const el = this.screens.levelinfo;
    const colors = this.game.renderer.colors[0];
    const reward = l.reward && !this.save.data.unlocked[l.reward] ? `<div><b>Reward:</b> unlocks the <b>${UNITS[l.reward].name}</b></div>` : '';
    el.innerHTML = `<div class="panel levelinfo">
      <div style="display:flex;justify-content:space-between;align-items:center"><h2>${id}. ${l.name}</h2><span class="twist">${l.twist}</span></div>
      <div>${l.desc}</div>
      <div><b>Battlefield:</b> ${BIOMES[l.biome].name} &nbsp;·&nbsp; <b>Enemy:</b> ${DIFFICULTY[l.difficulty].label}</div>
      <div class="units"></div>
      <div style="font-size:13px"><b>Stars:</b> ★ Win &nbsp; ★ Monument ≥ ${Math.round(l.stars.hp * 100)}% &nbsp; ★ Win in ${fmtTime(l.stars.time)} &nbsp; <span style="color:#b8860b">(best ${'★'.repeat(st) || '—'})</span></div>
      ${reward}
      <div class="row"><button class="btn" data-act="close" data-target="levelinfo">Cancel</button><button class="btn blue" data-act="play-level" data-id="${id}">⚔ Fight</button></div>
    </div>`;
    const units = $('.units', el);
    for (const t of l.player) { const c = portraitCanvas(t, colors, 44); c.className = 'portrait'; c.title = UNITS[t].name; units.appendChild(c); }
    this.show('levelinfo');
  }

  // ------------------------------------------------------------ skirmish / endless
  showSetup(mode) {
    const el = this.screens.setup;
    const opt = mode === 'skirmish' ? this.skirmish : this.endless;
    const units = this.save.unlockedList().map((t) => UNITS[t].name).join(', ');
    el.innerHTML = `<div class="panel setup">
      <h2>${mode === 'skirmish' ? '⚑ Skirmish' : '∞ Endless Defense'}</h2>
      ${mode === 'skirmish' ? `<div><h3>Difficulty</h3><div class="opts">${Object.entries(DIFFICULTY).map(([k, v]) => `<button class="opt ${opt.difficulty === k ? 'on' : ''}" data-act="diff" data-v="${k}">${v.label}</button>`).join('')}</div></div>` :
        `<div>Survive escalating waves. Every 5th wave brings a Colossus. Best: <b>wave ${this.save.data.endlessBest || 0}</b></div>`}
      <div><h3>Battlefield</h3><div class="opts">${Object.entries(BIOMES).map(([k, v]) => `<button class="opt ${opt.biome === k ? 'on' : ''}" data-act="biome" data-mode="${mode}" data-v="${k}">${v.name}</button>`).join('')}</div></div>
      <div class="muted">Your units: ${units}. Unlock more in the Campaign or the Armory.</div>
      <div class="row-btns"><button class="btn" data-act="close" data-target="setup">Cancel</button><button class="btn blue" data-act="start-${mode}">Start</button></div>
    </div>`;
    this.show('setup');
  }

  // ------------------------------------------------------------ armory
  showArmory() {
    const s = this.save.data;
    const el = this.screens.armory;
    const tab = this.armoryTab;
    el.innerHTML = `<div class="panel armory">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <h2 style="margin:0">⬆ Armory</h2>
        <div class="tabs">${[['upgrades', 'Upgrades'], ['units', 'Units'], ['skins', 'Skins']].map(([k, n]) => `<button class="opt ${tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${n}</button>`).join('')}</div>
        <span class="gemchip">${gem} ${s.gems}</span>
        <button class="btn small" data-act="close" data-target="armory">✕</button>
      </div>
      <div class="cards"></div>
    </div>`;
    const cards = $('.cards', el);
    const colors = this.game.renderer.colors[0];
    const bar = (lv, max) => `<div class="lvlbar">${Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div>`;
    const buyBtn = (cost, data, owned = false) => owned ? '<button class="btn small" disabled>Owned</button>' :
      cost == null ? '<button class="btn small" disabled>Max</button>' :
      `<button class="btn small ${s.gems >= cost ? 'gold' : ''}" ${data}>${gem} ${cost}</button>`;
    if (tab === 'upgrades') {
      for (const [k, it] of Object.entries(ARMORY)) {
        if (k === 'training') continue;
        const lv = s.armory[k];
        cards.insertAdjacentHTML('beforeend', `<div class="card"><h3>${it.name}</h3><div class="desc">${it.desc}</div>${bar(lv, it.max)}
          <div class="row" style="justify-content:space-between"><span>Lv ${lv}/${it.max}</span>${buyBtn(lv < it.max ? it.costs[lv] : null, `data-act="buy" data-kind="armory" data-k="${k}"`)}</div></div>`);
      }
      for (const t of UNIT_ORDER) {
        const it = ARMORY.training;
        const lv = s.armory.training[t];
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<div class="row"><span class="pc"></span><div><h3>${UNITS[t].name} Training</h3><div class="desc">${it.desc}</div></div></div>${bar(lv, it.max)}
          <div class="row" style="justify-content:space-between"><span>Lv ${lv}/${it.max}</span>${buyBtn(lv < it.max ? it.costs[lv] : null, `data-act="buy" data-kind="training" data-k="${t}"`)}</div>`;
        $('.pc', card).replaceWith(portraitCanvas(t, colors, 44));
        cards.appendChild(card);
      }
    } else if (tab === 'units') {
      for (const t of UNIT_ORDER) {
        const d = UNITS[t];
        const owned = s.unlocked[t];
        const card = document.createElement('div');
        card.className = 'card';
        const lvl = UNLOCK_BY_LEVEL[t];
        card.innerHTML = `<div class="row"><span class="pc"></span><div><h3>${d.name}</h3><div class="desc">${d.role}</div></div></div>
          <div class="desc">HP ${d.hp} · DMG ${d.dmg} · Range ${d.range} · ${d.cost}g${d.ink ? ` + ${d.ink}◆` : ''} · Pop ${d.pop}</div>
          <div class="desc">Upgrade: <b>${d.upgrade.name}</b> — ${d.upgrade.desc}. Ability: <b>${d.ability.name}</b></div>
          <div class="row" style="justify-content:space-between"><span class="desc">${owned ? 'Unlocked' : lvl ? `Free after campaign level ${lvl}` : ''}</span>${owned ? buyBtn(0, '', true) : buyBtn(UNLOCK_COST[t], `data-act="buy" data-kind="unlock" data-k="${t}"`)}</div>`;
        $('.pc', card).replaceWith(portraitCanvas(t, colors, 54));
        cards.appendChild(card);
      }
    } else {
      for (const [k, c] of Object.entries(SKIN_COLORS)) {
        const owned = s.skins.owned.includes(k);
        const on = s.skins.color === k;
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<div class="row"><span class="pc"></span><div><h3><span class="swatch" style="background:${c.main}"></span> ${c.name}</h3><div class="desc">Army color</div></div></div>
          <div class="row" style="justify-content:flex-end">${owned ? `<button class="btn small ${on ? 'blue' : ''}" data-act="buy" data-kind="color" data-k="${k}">${on ? 'Equipped' : 'Equip'}</button>` : buyBtn(c.cost, `data-act="buy" data-kind="color" data-k="${k}"`)}</div>`;
        $('.pc', card).replaceWith(portraitCanvas('blade', { main: c.main, dark: c.dark }, 54, s.skins.hat));
        cards.appendChild(card);
      }
      for (const [k, h] of Object.entries(SKIN_HATS)) {
        const owned = s.skins.owned.includes(k);
        const on = s.skins.hat === k;
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<div class="row"><span class="pc"></span><div><h3>${h.name}</h3><div class="desc">Hat for your whole army</div></div></div>
          <div class="row" style="justify-content:flex-end">${owned ? `<button class="btn small ${on ? 'blue' : ''}" data-act="buy" data-kind="hat" data-k="${k}">${on ? 'Equipped' : 'Equip'}</button>` : buyBtn(h.cost, `data-act="buy" data-kind="hat" data-k="${k}"`)}</div>`;
        $('.pc', card).replaceWith(portraitCanvas('blade', colors, 54, k === 'none' ? null : k));
        cards.appendChild(card);
      }
    }
    this.show('armory');
  }

  buy(d) {
    const s = this.save.data, g = this.game;
    const fail = () => { g.audio.play('deny'); this.toast('Not enough gems'); };
    if (d.kind === 'armory') {
      const it = ARMORY[d.k], lv = s.armory[d.k];
      if (lv >= it.max) return;
      if (!this.save.spend(it.costs[lv])) return fail();
      s.armory[d.k]++;
    } else if (d.kind === 'training') {
      const it = ARMORY.training, lv = s.armory.training[d.k];
      if (lv >= it.max) return;
      if (!this.save.spend(it.costs[lv])) return fail();
      s.armory.training[d.k]++;
    } else if (d.kind === 'unlock') {
      if (!this.save.spend(UNLOCK_COST[d.k])) return fail();
      s.unlocked[d.k] = true;
    } else if (d.kind === 'color' || d.kind === 'hat') {
      const table = d.kind === 'color' ? SKIN_COLORS : SKIN_HATS;
      if (!s.skins.owned.includes(d.k)) {
        if (!this.save.spend(table[d.k].cost)) return fail();
        s.skins.owned.push(d.k);
      }
      s.skins[d.kind] = d.k;
      g.applySkin();
    }
    g.audio.play('upgrade');
    this.save.write();
    this.showArmory();
  }

  // ------------------------------------------------------------ settings
  showSettings(back = 'menu') {
    this.settingsBack = back;
    const st = this.save.data.settings;
    const tg = (k, label) => `<div class="toggle"><span>${label}</span><button class="opt ${st[k] ? 'on' : ''}" data-act="toggle" data-k="${k}">${st[k] ? 'ON' : 'OFF'}</button></div>`;
    this.screens.settings.innerHTML = `<div class="panel setup">
      <h2>⚙ Settings</h2>
      ${tg('sound', 'Sound effects')}
      ${tg('music', 'Music')}
      ${tg('dmgNumbers', 'Damage numbers')}
      ${tg('shake', 'Screen shake')}
      ${tg('fps', 'Show FPS')}
      <div class="toggle"><span>Graphics quality</span><div class="opts">${['auto', 'high', 'low'].map((q) => `<button class="opt ${st.quality === q ? 'on' : ''}" data-act="quality" data-v="${q}">${q.toUpperCase()}</button>`).join('')}</div></div>
      <div class="muted">Controls: tap a soldier to control it · drag left side to move · ⚔ attack · ★ special. Keyboard: 1–7 train, Shift+# upgrade, Z/X/C defend/attack/garrison, Q Ink Storm, Tab control, WASD + J/K, Esc release/pause.</div>
      <div class="row-btns">
        ${back === 'menu' ? '<button class="btn red small" data-act="reset">Reset progress</button>' : ''}
        <button class="btn blue" data-act="close" data-target="settings">Done</button>
      </div>
    </div>`;
    this.show('settings');
  }

  // ------------------------------------------------------------ pause / result
  showPause() {
    this.screens.pause.innerHTML = `<div class="panel pause">
      <h2>Paused</h2>
      <button class="btn blue" data-act="resume">▶ Resume</button>
      <button class="btn" data-act="restart">↻ Restart</button>
      <button class="btn" data-act="pause-settings">⚙ Settings</button>
      <button class="btn red" data-act="quit">✕ Quit to menu</button>
    </div>`;
    this.show('pause');
  }

  showResult(r) {
    const el = this.screens.result;
    const st = r.stats;
    const stars = r.mode === 'campaign' ? `<div class="stars">${[0, 1, 2].map((i) => i < r.stars ? `<span class="on" style="animation-delay:${0.3 + i * 0.25}s">★</span>` : '<span>★</span>').join('')}</div>` : '';
    const title = r.mode === 'endless' ? `WAVE ${r.wave}` : r.win ? 'VICTORY' : 'DEFEAT';
    const sub = r.mode === 'endless' ? (r.newBest ? 'New best wave!' : `Best: wave ${r.best}`) : r.levelName || '';
    const nextId = r.mode === 'campaign' && r.win && r.levelId < 12 ? r.levelId + 1 : null;
    el.innerHTML = `<div class="panel result">
      <div class="big ${r.win || r.mode === 'endless' ? 'win' : 'lose'}">${title}</div>
      <div style="font-weight:800">${sub}</div>
      ${stars}
      <div class="statgrid">
        <div class="stat"><b>${fmtTime(st.time)}</b><span>Time</span></div>
        <div class="stat"><b>${st.kills}</b><span>Kills</span></div>
        <div class="stat"><b>${st.trained}</b><span>Trained</span></div>
        <div class="stat"><b>${st.lost}</b><span>Lost</span></div>
        <div class="stat"><b>${Math.round(st.gold)}</b><span>Gold mined</span></div>
        <div class="stat"><b>${Math.round(st.ink)}</b><span>Ink mined</span></div>
        <div class="stat"><b>${Math.round(st.damage)}</b><span>Damage</span></div>
        <div class="stat"><b>${Math.round(st.monument * 100)}%</b><span>Monument</span></div>
      </div>
      <div style="font-weight:900;font-size:18px">+${r.gems} ${gem} gems ${r.unlock ? `&nbsp;·&nbsp; 🔓 ${UNITS[r.unlock].name} unlocked!` : ''}</div>
      <div class="row-btns">
        <button class="btn" data-act="quit">Menu</button>
        <button class="btn" data-act="restart">↻ Retry</button>
        ${nextId ? `<button class="btn blue" data-act="next" data-id="${nextId}">Next ▶</button>` : ''}
        ${r.mode === 'campaign' && !nextId ? '<button class="btn blue" data-act="campaign">Map</button>' : ''}
      </div>
    </div>`;
    this.show('result');
  }

  showBanner(text, sub = '', dur = 2.2) {
    this.banner.innerHTML = `<div class="t">${text}</div>${sub ? `<div class="s">${sub}</div>` : ''}`;
    this.banner.classList.add('show');
    clearTimeout(this._bt);
    this._bt = setTimeout(() => this.banner.classList.remove('show'), dur * 1000);
  }

  toast(msg, dur = 1.4) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => this.toastEl.classList.remove('show'), dur * 1000);
  }
}

export { drawShowcase };
