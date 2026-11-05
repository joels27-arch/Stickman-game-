/* =====================================================================
   PackFX — pack-opening animation (from 5v5 Legacy)
   Framework-free, no assets needed (sounds are synthesized). Pair with packfx.css.
   Usage:  PackFX.open({ ...options })   — call it from a tap/click so audio can start.
   ===================================================================== */
(function(){
  'use strict';
  const PK_TAPS = 8;                         // taps needed to burst the pack
  const PKX = {el:null, tm:[], raf:0, parts:[], p:0, st:'', lt:0, fw:0, sw:0, lastTap:0, o:null, rar:'gold', ci:0, clues:[]};
  const BANNERS = {galaxy:['GALAXY WALKOUT','All-time great incoming'], diamond:['WALKOUT!','Diamond icon'], gold:['GOLD ICON','Here he comes']};
  const WALK_MS = {galaxy:2000, diamond:1700, gold:1400};   // banner time before the clues start
  const tierColor = r => r>=95?'#ff4fd8':r>=88?'#ffd23e':r>=82?'#c46bff':r>=75?'#dfe7f2':'#d38a55';
  const rnd = (a,b) => a + Math.random()*(b-a);
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* ---------- sound: tiny Web Audio synth (no files) ---------- */
  const SND = {ctx:null, master:null, noise:null};
  const CFG = {sound:true, vibrate:true};
  function audioInit(){
    if(SND.ctx || !CFG.sound) return;
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
    try{
      const c = new AC(); SND.ctx = c; SND.master = c.createGain(); SND.master.gain.value = .8; SND.master.connect(c.destination);
      const n = c.createBuffer(1, c.sampleRate*2, c.sampleRate), d = n.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i] = Math.random()*2-1; SND.noise = n;
    }catch(e){ SND.ctx = null }
    if(SND.ctx && SND.ctx.state === 'suspended') SND.ctx.resume();
  }
  const AX = () => SND.ctx && CFG.sound && SND.ctx.state !== 'closed' ? SND.ctx : null;
  function env(g,t,a,peak,dec){ g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(peak,t+a); g.gain.exponentialRampToValueAtTime(0.0001,t+a+dec) }
  function nz(dur,type,freq,q,peak,a,start){
    const c = AX(); if(!c) return;
    const t = c.currentTime+(start||0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = SND.noise; f.type = type; f.frequency.value = freq; f.Q.value = q||1; env(g,t,a||.005,peak,dur);
    s.connect(f).connect(g).connect(SND.master); s.start(t, Math.random()); s.stop(t+dur+.1);
  }
  function tone(type,f0,f1,dur,peak,start){
    const c = AX(); if(!c) return;
    const t = c.currentTime+(start||0), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0,t); if(f1) o.frequency.exponentialRampToValueAtTime(f1,t+dur);
    env(g,t,.005,peak,dur); o.connect(g).connect(SND.master); o.start(t); o.stop(t+dur+.05);
  }
  const SFX = {
    pack(){ [392,523,659,784,1046].forEach((f,i)=>tone('triangle',f,f*1.01,.25,.12,i*.11)); nz(1.2,'highpass',2000,.5,.12,.4,.4) },
    charge(p){ tone('triangle',220+p*700,260+p*760,.09,.07+p*.05); nz(.06,'bandpass',800+p*2000,2,.04+p*.06) },
    boom(){ tone('sine',90,32,.9,.6); nz(.6,'lowpass',260,1,.35) },
    thump(i){ tone('triangle',180+i*40,90,.3,.3); nz(.1,'bandpass',1200,1,.15); tone('square',440*(1+i*.25),440*(1+i*.25),.12,.04,.04) },
    tick(v){ tone('square',600+(v%10)*60,600+(v%10)*60,.035,.035) },
    reveal(){ [523,659,784,1046,1318].forEach((f,i)=>tone('square',f,f,.18,.06,i*.05)); nz(.9,'highpass',4000,.5,.1,.02,.1) },
    fw(){ nz(.08,'highpass',2000,.5,.12); nz(.7,'highpass',5000,.5,.07,.01,.08) },
    coin(){ [880,1320].forEach((f,i)=>tone('triangle',f,f,.12,.12,i*.07)) },
    crowd(){ nz(2.2,'bandpass',800,.5,.22,.25); nz(1.6,'lowpass',2400,.5,.12,.3) }
  };
  const buzz = p => { if(!CFG.vibrate) return; try{ navigator.vibrate && navigator.vibrate(p) }catch(e){} };

  /* ---------- helpers ---------- */
  const later = (ms,f) => PKX.tm.push(setTimeout(f,ms));
  function stage(html){ PKX.el.querySelector('.pkx-stage').innerHTML = html }
  function cols(){ const k = PKX.o.teamColor || PKX.col;
    return PKX.rar==='galaxy' ? ['#c77dff','#ffffff','#7fe7ff','#ff7ad9',k] : PKX.rar==='diamond' ? ['#7fe7ff','#ffffff','#41a8ff',k] : ['#ffd23e','#fff4b0','#ff9a2e',k] }
  // confetti (spark=false: rectangles thrown up with gravity) or sparks (spark=true: small dots)
  function burst(cx,cy,n,spark){ const c = cols(); if(spark) SFX.fw();
    for(let i=0;i<n;i++){ const a = Math.random()*Math.PI*2, v = spark?rnd(80,260):rnd(200,700);
      PKX.parts.push({x:cx, y:cy, vx:Math.cos(a)*v, vy:Math.sin(a)*v-(spark?0:250), g:spark?120:520, t:spark?rnd(.6,1.2):rnd(1.4,2.6), c:pick(c), sz:spark?rnd(1.5,3):rnd(6,12), r:Math.random()*6, vr:rnd(-12,12), spark}) } }
  function rain(n){ const c = cols();
    for(let i=0;i<n;i++) PKX.parts.push({x:Math.random()*innerWidth, y:-20-Math.random()*innerHeight*.6, vx:rnd(-40,40), vy:rnd(60,200), g:120, t:rnd(3,5), c:pick(c), sz:rnd(6,12), r:Math.random()*6, vr:rnd(-8,8)}) }
  function flash(quake,soft){ const f = PKX.el.querySelector('.pkx-flash');
    f.classList.remove('go'); f.classList.toggle('soft',!!soft); void f.offsetWidth; f.classList.add('go');
    if(quake){ PKX.el.classList.remove('quake'); void PKX.el.offsetWidth; PKX.el.classList.add('quake') } }

  /* ---------- open ---------- */
  function open(opts){
    close(); audioInit();
    const o = PKX.o = Object.assign({rarity:'gold', rating:null, clues:[], buttons:null}, opts||{});
    const rar = PKX.rar = BANNERS[o.rarity] ? o.rarity : 'gold';
    const col = PKX.col = o.color || (o.rating!=null ? tierColor(o.rating) : {gold:'#ffd23e',diamond:'#7fe7ff',galaxy:'#c77dff'}[rar]);
    const el = document.createElement('div');
    el.className = `pkx r-${rar} st-pack`; el.style.setProperty('--tc',col); el.style.setProperty('--lc',col);
    const face = o.packImage ? `class="pkx-h imgpk" style="--pi:url('${o.packImage}')"`
      : `class="pkx-h ${o.packDark?'dark':''} ${o.packCrown?'crown':''}" ${o.packGradient?`style="background:${o.packGradient}"`:''}`;
    const coarse = matchMedia('(pointer:coarse)').matches;
    el.innerHTML = `<div class="pkx-floor"></div><div class="pkx-lights"><i></i><i></i><i></i><i></i></div>
      <div class="pkx-pack" style="--s:0${o.packColor?`;--tc:${o.packColor}`:''}">
        <div ${face}>${o.packTop?`<em>${esc(o.packTop)}</em>`:''}<span class="pkx-num">${esc(o.packNumber??'')}</span><b>${esc(o.packTitle??'PACK')}</b>${o.packSubtitle?`<em>${esc(o.packSubtitle)}</em>`:''}</div>
        <div class="pkx-tear"><b></b></div><div class="pkx-swipe">👆</div></div>
      <div class="pkx-hint">${esc(o.hint || (coarse?'Tap fast to open!':'Click fast or press Space to open!'))}</div>
      <div class="pkx-stage"></div><canvas class="pkx-cv"></canvas><div class="pkx-flash"></div><button class="pkx-skip" type="button">Skip</button>`;
    document.body.appendChild(el); document.documentElement.classList.add('pk-on');
    Object.assign(PKX, {el, p:0, sw:0, lastTap:0, st:'pack', parts:[], fw:0, lt:performance.now()});
    SFX.pack();
    el.addEventListener('pointerdown', e => { if(e.target.closest('.pkx-skip,.pkx-btns')) return; if(PKX.st!=='pack') return; e.preventDefault(); audioInit(); tap(e.clientX,e.clientY) });
    el.addEventListener('click', e => { if(e.target.closest('.pkx-skip')){ e.stopPropagation(); skip() } else if(PKX.st==='clue') next() });
    const cv = el.querySelector('.pkx-cv'); PKX.fit = () => { cv.width = innerWidth; cv.height = innerHeight }; PKX.fit();
    PKX.raf = requestAnimationFrame(loop);
  }
  addEventListener('resize', () => { if(PKX.el && PKX.fit) PKX.fit() });
  document.addEventListener('keydown', e => { if(!PKX.el) return;
    if(e.code==='Space' || e.code==='Enter'){ e.preventDefault();
      if(PKX.st==='pack' && !e.repeat){ audioInit(); tap(innerWidth/2, innerHeight*.4) } else if(PKX.st==='clue') next() }
    if(e.code==='Escape') skip() }, true);

  /* ---------- frame loop: charge meter, shake, glow, particles ---------- */
  function loop(now){
    if(!PKX.el) return; PKX.raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, (now-PKX.lt)/1000); PKX.lt = now;
    if(PKX.st==='pack'){
      const before = PKX.p, pack = PKX.el.querySelector('.pkx-pack');
      if(PKX.sw<PK_TAPS && now-PKX.lastTap>450) PKX.sw = Math.max(0, PKX.sw-dt*2.2);   // charge drains if you stop tapping
      PKX.p += (PKX.sw/PK_TAPS - PKX.p) * Math.min(1, dt*12);
      pack.style.setProperty('--tw', (PKX.sw/PK_TAPS).toFixed(3));
      pack.style.setProperty('--s', (PKX.p*2.6).toFixed(2)); pack.classList.toggle('shake', PKX.p>.02);
      pack.style.setProperty('--p', PKX.p.toFixed(3));
      const glow = PKX.p<.45 ? 0 : (PKX.p-.45)/.55*(PKX.rar==='galaxy'?1.3:PKX.rar==='diamond'?1:.75);
      pack.style.setProperty('--glow', glow.toFixed(2));
      if(Math.floor(PKX.p*12)>Math.floor(before*12) && PKX.p>before) SFX.charge(PKX.p);
      if(PKX.sw>=PK_TAPS && PKX.p>.96) tear();
    }
    if(PKX.fw>0 && Math.random()<dt*PKX.fw) burst(rnd(.15,.85)*innerWidth, rnd(.1,.5)*innerHeight, 40, true);   // fireworks
    const cv = PKX.el.querySelector('.pkx-cv'), x = cv.getContext('2d'); x.clearRect(0,0,cv.width,cv.height);
    PKX.parts = PKX.parts.filter(q => (q.t-=dt) > 0);
    for(const q of PKX.parts){
      q.vy += q.g*dt; q.vx *= .99; q.x += q.vx*dt; q.y += q.vy*dt; q.r += q.vr*dt;
      x.globalAlpha = Math.min(1, q.t*2); x.fillStyle = q.c;
      if(q.spark){ x.beginPath(); x.arc(q.x,q.y,q.sz,0,7); x.fill() }
      else{ x.save(); x.translate(q.x,q.y); x.rotate(q.r); x.fillRect(-q.sz/2,-q.sz/4,q.sz,q.sz/2); x.restore() }
    }
    x.globalAlpha = 1;
  }

  /* ---------- one tap on the pack ---------- */
  function tap(x,y){
    if(PKX.st!=='pack' || PKX.sw>=PK_TAPS) return;
    PKX.sw = Math.min(PK_TAPS, Math.floor(PKX.sw)+1); PKX.lastTap = performance.now();
    const n = PKX.sw, pack = PKX.el.querySelector('.pkx-pack');
    pack.classList.remove('rip'); void pack.offsetWidth; pack.classList.add('rip'); pack.classList.add('started');
    SFX.charge(n/PK_TAPS); buzz(n<PK_TAPS?15:60);
    burst(x, y, 6+n*2, true);
    if(n===PK_TAPS-2) flash(false, true);
  }

  /* ---------- burst → banner → clues ---------- */
  function tear(){
    const el = PKX.el, rar = PKX.rar, o = PKX.o; PKX.st = 'tear';
    el.classList.add('torn'); el.querySelector('.pkx-pack').classList.remove('shake');
    SFX.boom(); buzz([30,40,70]); flash(true); burst(innerWidth/2, innerHeight*.45, 70, false);
    const walk = WALK_MS[rar];
    later(450, () => {
      el.classList.add('lit'); SFX.boom(); if(rar!=='gold') SFX.crowd();
      const ban = o.banner || BANNERS[rar];
      stage(`<div class="pkx-ban"><div>${esc(ban[0])}</div><small>${esc(ban[1]||'')}</small></div>`);
      if(rar==='galaxy'){ PKX.fw = 2.4; later(400, () => flash(true)) } else if(rar==='diamond') PKX.fw = .9;
    });
    PKX.clues = (o.clues||[]).map(c => () => c.jersey
      ? `<div class="pkx-clue"><div class="lb">${esc(c.label||'Classic jersey')}</div><div class="pkx-jer" style="--c1:${c.jersey.c1};--c2:${c.jersey.c2}">${esc(c.jersey.number)}</div></div>`
      : `<div class="pkx-clue"><div class="lb">${esc(c.label)}</div><div class="bg ${c.size||''}">${esc(c.value)}</div>${c.sub?`<div class="lb2">${esc(c.sub)}</div>`:''}</div>`);
    PKX.ci = 0; later(450+walk, () => { PKX.st = 'clue'; next() });
  }
  function next(){                                   // each clue shows 1150 ms; a tap skips ahead
    PKX.tm.forEach(clearTimeout); PKX.tm = [];
    if(PKX.ci < PKX.clues.length){ stage(PKX.clues[PKX.ci++]()); SFX.thump(PKX.ci); flash(false,true); later(1150, next); return }
    if(PKX.o.rating!=null) rating(); else card();
  }
  function rating(){                                 // OVR counts up from 70 and slows down near the end
    PKX.st = 'rate'; const end = PKX.o.rating; let v = Math.min(70, end-1);
    stage(`<div class="pkx-clue pkx-ovr"><div class="lb">${esc(PKX.o.ratingLabel||'Overall')}</div><div class="bg">${v}</div></div>`);
    const b = PKX.el.querySelector('.pkx-ovr .bg'), steps = end-v, per = Math.max(28, 900/steps);
    for(let i=1;i<=steps;i++) later(i*per*(1+i/steps*.8), () => { v++; b.textContent = v; SFX.tick(v); if(v===end){ b.classList.add('pop'); SFX.boom() } });
    later(steps*per*1.8+500, card);
  }
  function skip(){
    if(!PKX.el) return; if(PKX.st==='done'){ done(); return }
    PKX.tm.forEach(clearTimeout); PKX.tm = []; PKX.el.classList.add('torn','lit'); PKX.fw = PKX.rar==='galaxy' ? 1.2 : 0; card();
  }

  /* ---------- the reveal ---------- */
  function card(){
    const el = PKX.el, o = PKX.o; PKX.st = 'done'; el.classList.remove('st-pack'); el.classList.add('st-done');
    const btns = o.buttons || [{label:'Done', ghost:true}];
    stage(`<div class="pkx-cardw"><div class="rays"></div><div class="pkx-card">${o.cardHTML||''}</div>
      <div>${o.name?`<div class="pkx-nm">${esc(o.name)}</div>`:''}<div class="pkx-sub">${o.subtitle?`<div class="lbl">${esc(o.subtitle)}</div>`:''}${o.duplicate?`<div class="pkx-dup">${esc(o.duplicate)}</div>`:''}</div></div>
      ${o.note?`<div class="pkx-added">${esc(o.note)}</div>`:''}
      <div class="pkx-btns">${btns.map((b,i)=>`<button type="button" class="pkx-btn ${b.primary?'primary':''} ${b.ghost?'ghost':''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`);
    el.querySelectorAll('.pkx-btns [data-i]').forEach(bt => bt.addEventListener('click', e => { e.stopPropagation();
      const b = btns[+bt.dataset.i]; const keep = b.onClick && b.onClick() === false; if(!keep) done() }));
    SFX.reveal(); flash(PKX.rar!=='gold');
    burst(innerWidth/2, innerHeight*.4, PKX.rar==='galaxy'?160:110, false); rain(PKX.rar==='galaxy'?140:70);
    if(o.duplicate) later(1000, () => SFX.coin());
    if(PKX.rar==='galaxy') later(3500, () => { PKX.fw = .6 }); else later(2500, () => { PKX.fw = 0 });
  }
  function done(){ const cb = PKX.o && PKX.o.onDone; close(); if(cb) cb() }
  function close(){
    PKX.tm.forEach(clearTimeout); PKX.tm = []; cancelAnimationFrame(PKX.raf);
    if(PKX.el) PKX.el.remove(); PKX.el = null; PKX.st = ''; document.documentElement.classList.remove('pk-on');
  }

  window.PackFX = {open, close, skip, config:CFG, tierColor};
})();
