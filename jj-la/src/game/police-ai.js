// ================= TAKTIK: Abtauchen, Waffen-/Outfit-Rad, Seil-Heli, Straßensperren, Luftangriffe =================
const SWAT_LOOK={skin:"#c99572",skinHi:"#ddb08c",shirt:"#16181c",shirtHi:"#33363d",pants:"#101114",shoe:"#0b0b0d",cap:"#0b0c0e"};
function swatify(c){ if (!c) return; c.look=SWAT_LOOK; c.tough=2; c.weapon="pistol"; c.cd=.5; c.sp=112; }
function starDown(why){ if (WANT.lv<=0) return; const nl=WANT.lv-1; sfx("ping");
  if (nl<=0){ clearWanted(true); toast(why+(LANG==="en"?" – the cops lost you!":" – die Cops haben deine Spur verloren!")); return; }
  WANT.heat=nl+.5; WANT.lv=nl; WANT.knowT=0; WANT.seenT=Math.max(WANT.seenT,4); WANT.wT=0; WANT.shown=-1; toast(why+" – ★ −1"); }
function trick(kind,why){ if (WANT.lv<=0||wantOff()) return; WANT.tr=WANT.tr||{}; const now=performance.now();
  if ((WANT.tr[kind]||0)>now){ toast(LANG==="en"?"They know that trick already – wait a bit":"Den Trick kennen die schon – warte etwas"); return; }
  if ((WANT.knowT||0)>0||copSees()){ toast(LANG==="en"?"They saw you do it!":"Die haben dich dabei gesehen!"); return; }
  WANT.tr[kind]=now+20000; starDown(why); }
// ---------- Outfits ----------
const OUTFITS=[{id:"std",n:"Standard",hat:"back",hc:"#141519",gl:null,sh:"#c8302a",shh:"#f25c48"},{id:"cap",n:"Cap",hat:"cap",hc:"#c8302a",gl:null,sh:"#f2f0ea",shh:"#ffffff"},{id:"bean",n:"Beanie",hat:"beanie",hc:"#7a7f88",gl:null,sh:"#1d1f24",shh:"#3a3d45"},{id:"sun",n:"Sonnenbrille",hat:null,hc:"#141519",gl:"sun",sh:"#2f5e8c",shh:"#4f86c0"},
  {id:"buck",n:"Bucket Hat",hat:"bucket",hc:"#cdb68a",gl:"sun",sh:"#3d6b45",shh:"#5e9468"},{id:"hood",n:"Kapuze",hat:"hood",hc:"#22242a",gl:null,sh:"#22242a",shh:"#3b3e47"},{id:"gold",n:"Goldbrille",hat:null,hc:"#141519",gl:"gold",sh:"#f2f0ea",shh:"#ffffff"},{id:"camo",n:"Tarnung",hat:"cap",hc:"#55623a",gl:"sun",sh:"#55623a",shh:"#76854f"}];
let OUTFIT=0; try{ OUTFIT=Math.max(0,OUTFITS.findIndex(o=>o.id===localStorage.getItem("jjla-outfit"))); }catch(e){}
const outfitLook=i=>{ const o=OUTFITS[i]; return Object.assign({},LOOK,{cap:o.hc,shirt:o.sh,shirtHi:o.shh,hat:o.hat,gl:o.gl,rig:i}); };
function applyOutfit(i){ OUTFIT=i; Object.assign(LOOK,outfitLook(i)); try{ localStorage.setItem("jjla-outfit",OUTFITS[i].id); }catch(e){} }
applyOutfit(OUTFIT);
function jjHead(q,L){ const hat=L.hat;
  if (hat==="cap"){ q.fillStyle=L.cap; q.beginPath(); q.arc(0,.2,5.5,0,7); q.fill(); rr(q,-3.8,3.4,7.6,4.2,1.8); q.fill(); q.fillStyle="rgba(255,255,255,.16)"; q.beginPath(); q.arc(-1.5,-.8,2.2,0,7); q.fill(); }
  else if (hat==="beanie"){ q.fillStyle=L.cap; q.beginPath(); q.arc(0,.4,5.9,0,7); q.fill(); q.strokeStyle="rgba(0,0,0,.25)"; q.lineWidth=.6; for (let x=-4;x<=4;x+=2){ q.beginPath(); q.moveTo(x,-4.6); q.lineTo(x,4.2); q.stroke(); } q.fillStyle="rgba(255,255,255,.2)"; q.fillRect(-5.3,2.6,10.6,1.6); q.fillStyle="#e8e4da"; q.beginPath(); q.arc(0,.4,1.7,0,7); q.fill(); }
  else if (hat==="bucket"){ q.fillStyle="rgba(0,0,0,.25)"; q.beginPath(); q.arc(.7,1.5,8.7,0,7); q.fill(); q.fillStyle=L.cap; q.beginPath(); q.arc(0,.8,8.3,0,7); q.fill(); q.fillStyle="rgba(255,255,255,.18)"; q.beginPath(); q.arc(0,.6,5,0,7); q.fill(); q.strokeStyle="rgba(0,0,0,.22)"; q.lineWidth=.7; q.beginPath(); q.arc(0,.8,5.2,0,7); q.stroke(); }
  else if (hat==="hood"){ q.fillStyle=L.cap; q.beginPath(); q.arc(0,-.2,6.8,Math.PI*.8,Math.PI*.2,false); q.lineTo(5.4,4.4); q.quadraticCurveTo(0,2.2,-5.4,4.4); q.closePath(); q.fill(); q.strokeStyle="rgba(255,255,255,.12)"; q.lineWidth=.8; q.beginPath(); q.arc(0,-.2,5.4,Math.PI*1.1,Math.PI*1.9); q.stroke(); }
  else { q.fillStyle="#15110f"; q.beginPath(); q.arc(0,.2,5.3,Math.PI*.92,Math.PI*.08,false); q.fill(); q.fillStyle="rgba(255,255,255,.08)"; q.beginPath(); q.arc(-1.4,-1.6,2,0,7); q.fill(); }
  if (L.gl==="sun"){ q.fillStyle="#0c0c10"; rr(q,-4.6,4.1,9.2,2.1,.8); q.fill(); q.fillStyle="rgba(120,180,255,.6)"; q.fillRect(-3.6,4.4,2.4,.7); q.fillRect(1.2,4.4,2.4,.7); }
  else if (L.gl==="gold"){ q.strokeStyle="#e8c34a"; q.lineWidth=.8; q.fillStyle="rgba(60,40,10,.8)"; q.beginPath(); q.ellipse(-2.1,4.8,1.9,1.3,0,0,7); q.ellipse(2.1,4.8,1.9,1.3,0,0,7); q.fill(); q.stroke(); } }
// ---------- Rad (wie GTA): Q halten = Waffen, C halten = Outfit, Waffen-Chip antippen ----------
const WH_={open:false,tab:"w",sel:-1,mode:"hold",items:[],qT:null,icons:{}};
function wheelIcon(k,tab){ const key=tab+k; if (WH_.icons[key]) return WH_.icons[key]; let c;
  if (tab==="w") c=WICON[k]; else c=mk(120,96,q=>{ const o=OUTFITS[k], sk=LOOK.skin; q.translate(60,0);
    q.fillStyle=o.sh; q.beginPath(); q.moveTo(-40,96); q.quadraticCurveTo(-40,62,-14,58); q.lineTo(14,58); q.quadraticCurveTo(40,62,40,96); q.closePath(); q.fill(); q.fillStyle=o.shh; q.fillRect(-6,58,12,38);
    if (o.hat==="hood"){ q.fillStyle=o.hc; q.beginPath(); q.ellipse(0,38,27,32,0,0,7); q.fill(); }
    q.fillStyle=sk; q.fillRect(-7,48,14,12); q.beginPath(); q.ellipse(0,36,19,22,0,0,7); q.fill();
    q.fillStyle="#1b1310"; q.fillRect(-9,34,5,4); q.fillRect(4,34,5,4); q.fillStyle="rgba(60,30,20,.6)"; q.fillRect(-5,47,10,2);
    if (o.gl){ q.fillStyle=o.gl==="gold"?"#d4a632":"#111"; rr(q,-16,30,13,9,3); q.fill(); rr(q,3,30,13,9,3); q.fill(); q.fillRect(-3,32,6,2); if (o.gl==="gold"){ q.fillStyle="#3a2a10"; q.fillRect(-14,32,9,5); q.fillRect(5,32,9,5); } }
    q.fillStyle=o.hc;
    if (o.hat==="cap"){ q.beginPath(); q.ellipse(0,22,20,13,0,Math.PI,0); q.fill(); q.fillRect(-20,20,40,5); q.beginPath(); q.ellipse(10,24,18,5,0,0,7); q.fill(); }
    else if (o.hat==="back"){ q.beginPath(); q.ellipse(0,22,20,13,0,Math.PI,0); q.fill(); q.fillRect(-20,20,40,5); q.fillStyle="rgba(255,255,255,.25)"; q.fillRect(-4,10,8,3); }
    else if (o.hat==="beanie"){ q.beginPath(); q.ellipse(0,24,21,17,0,Math.PI,0); q.fill(); q.fillRect(-21,22,42,8); q.fillStyle="rgba(255,255,255,.18)"; for (let x=-18;x<20;x+=6) q.fillRect(x,22,2,8); }
    else if (o.hat==="bucket"){ q.beginPath(); q.ellipse(0,22,17,13,0,Math.PI,0); q.fill(); q.beginPath(); q.ellipse(0,24,27,6,0,0,7); q.fill(); }
    else if (o.hat==="hood"){ q.beginPath(); q.ellipse(0,22,22,14,0,Math.PI,0); q.fill(); }
    else { q.fillStyle="#141519"; q.beginPath(); q.ellipse(0,20,18,9,0,Math.PI,0); q.fill(); } });
  if (typeof c==="string") return WH_.icons[key]=c; try{ return WH_.icons[key]=c.toDataURL(); }catch(e){ return ""; } }
function wheelItems(){ return WH_.tab==="w"?WLIST.filter(haveW).map(w=>({k:w,n:WNAME[w]})):OUTFITS.map((o,i)=>({k:i,n:o.n})).filter(x=>OWN_OUT.includes(OUTFITS[x.k].id)); }
function renderWheel(){ const ring=$("wring"), it=wheelItems(), n=it.length, R=ring.clientWidth/2-ring.clientWidth*.15; WH_.items=it; ring.innerHTML="";
  it.forEach((x,i)=>{ const a=-Math.PI/2+i/n*6.2832, b=document.createElement("button"), cur=WH_.tab==="w"?x.k===W.cur:x.k===OUTFIT; b.className="wi"+(cur?" cur":"")+(i===WH_.sel?" sel":""); b.style.left=`calc(50% + ${Math.cos(a)*R}px)`; b.style.top=`calc(50% + ${Math.sin(a)*R}px)`;
    b.innerHTML=`<img alt="" src="${wheelIcon(x.k,WH_.tab)}"><span>${x.n}</span>`; b.addEventListener("pointerenter",()=>{ WH_.sel=i; markWheel(); }); b.addEventListener("click",e=>{ e.stopPropagation(); if (performance.now()-WH_.openAt<450) return; WH_.sel=i; wheelPick(); }); ring.appendChild(b); });
  document.querySelectorAll("#wheel .wtabs button").forEach(b=>b.classList.toggle("on",b.dataset.t===WH_.tab)); markWheel(); }
function markWheel(){ const it=WH_.items, en=LANG==="en"; [...$("wring").children].forEach((b,i)=>b.classList.toggle("sel",i===WH_.sel)); const x=it[WH_.sel]||it.find(x=>WH_.tab==="w"?x.k===W.cur:x.k===OUTFIT);
  $("wmN").textContent=x?tr(x.n):""; $("wmS").textContent=WH_.tab==="o"?(WANT.lv>0?(en?"Unseen: new outfit = ★ −1":"Unbeobachtet: neues Outfit = ★ −1"):(en?"Change your look":"Look wechseln")):(en?"Choose weapon":"Waffe wählen"); }
function openWheel(mode,tab){ if (!started||jj.dead||DLG||cardMode||jj.veh||GOLF||CRIDE||CLIMB||WH_.open) return; WH_.open=true; WH_.openAt=performance.now(); WH_.mode=mode; WH_.tab=tab||"w"; WH_.sel=-1; $("wheel").hidden=false; renderWheel(); }
function closeWheel(){ WH_.open=false; $("wheel").hidden=true; }
function wheelTab(t){ WH_.tab=t; WH_.sel=-1; renderWheel(); }
function wheelAim(a){ const n=WH_.items.length; if (!n) return; let i=Math.round(((a+Math.PI/2)/6.2832)*n); i=((i%n)+n)%n; if (i!==WH_.sel){ WH_.sel=i; markWheel(); } }
function wheelPick(){ const x=WH_.items[WH_.sel]; closeWheel(); if (!x) return;
  if (WH_.tab==="w") setWeapon(x.k);
  else if (x.k!==OUTFIT){ if (jj.swim){ toast(LANG==="en"?"Not in the water":"Nicht im Wasser"); return; } applyOutfit(x.k); sfx("door"); WH_.icons={}; if (WANT.lv>0) trick("outfit",LANG==="en"?"New outfit":"Neues Outfit"); else toast("👕 "+tr(OUTFITS[x.k].n)); } }
function qDown(tab){ clearTimeout(WH_.qT); WH_.qTab=tab; WH_.qT=setTimeout(()=>{ WH_.qT=null; openWheel("hold",tab); },220); }
addEventListener("keyup",e=>{ if (e.code!=="KeyQ"&&e.code!=="KeyC") return; if (WH_.open&&WH_.mode==="hold"){ wheelPick(); return; } if (WH_.qT){ clearTimeout(WH_.qT); WH_.qT=null; if (e.code==="KeyQ") cycleWeapon(1); else openWheel("tap","o"); } });
addEventListener("keydown",e=>{ if (!WH_.open) return; const c=e.code; if (["Tab","KeyE","ArrowLeft","ArrowRight","KeyA","KeyD","Escape","Enter","Space"].includes(c)){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  if (c==="Tab"||c==="KeyE") wheelTab(WH_.tab==="w"?"o":"w"); if (c==="Escape") closeWheel(); if (c==="Enter"||c==="Space") wheelPick();
  if (c==="ArrowLeft"||c==="KeyA"||c==="ArrowRight"||c==="KeyD"){ const n=WH_.items.length; WH_.sel=((WH_.sel<0?0:WH_.sel)+(c==="ArrowLeft"||c==="KeyA"?-1:1)+n)%n; markWheel(); } } },true);
$("wheel").addEventListener("pointermove",e=>{ if (e.pointerType!=="mouse") return; const r=$("wring").getBoundingClientRect(), dx=e.clientX-(r.left+r.width/2), dy=e.clientY-(r.top+r.height/2); if (Math.hypot(dx,dy)>r.width*.18) wheelAim(Math.atan2(dy,dx)); });
$("wheel").addEventListener("click",e=>{ if (performance.now()-WH_.openAt<450) return; if (e.target.closest(".wtabs button")){ wheelTab(e.target.closest("button").dataset.t); return; } if (!e.target.closest(".wi")) closeWheel(); });
// ---------- Seil vom Polizei-Heli: Cops seilen sich ab, JJ kann hochklettern und den Heli klauen ----------
let CLIMB=null;
function heliRope(dt,h,T){ WANT.stillT=(!jj.veh&&!jj.moving&&!jj.dead)?(WANT.stillT||0)+dt:0; h.ropeCd=Math.max(0,(h.ropeCd||0)-dt);
  if (h.leave){ if (h.rope&&!CLIMB) h.rope=null; return false; }
  if (!h.rope&&WANT.lv>=3&&!jj.veh&&!jj.dead&&WANT.stillT>2&&h.ropeCd<=0&&Math.hypot(h.x-T.x,h.y-T.y)<360){ let px=0,py=0,ok=false; for (let k=0;k<10&&!ok;k++){ const a=rnd()*6.283; px=T.x+Math.cos(a)*120; py=T.y+Math.sin(a)*120; ok=npcFree(px,py); } if (!ok) return false;
    h.rope={x:px,y:py,t:0,n:WANT.lv>=5?3:2,sp:0}; toast(LANG==="en"?"🚁 Cops are rappelling down – climb the rope to steal the heli!":"🚁 Cops seilen sich ab – kletter das Seil hoch und klau den Heli!"); }
  const R_=h.rope; if (!R_) return false;
  const dx=R_.x-h.x, dy=R_.y-h.y, d=Math.hypot(dx,dy); if (d>3&&R_.t===0){ const sp=Math.min(d*2.2,320); h.x+=dx/d*sp*dt; h.y+=dy/d*sp*dt; if (d>3) return true; }
  h.x=R_.x; h.y=R_.y; if (CLIMB) return true; R_.t+=dt;
  if (R_.t>1&&R_.sp<R_.n&&(R_.t-1)/1.3>=R_.sp+1){ R_.sp++; const c=spawnCop(R_.x+(rnd()-.5)*24,R_.y+(rnd()-.5)*24); if (WANT.lv>=5) swatify(c); }
  if (R_.t>1+R_.n*1.3+8){ R_.up=(R_.up||0)+dt; if (R_.up>1){ h.rope=null; h.ropeCd=16; } }
  return true; }
function startClimb(){ const h=WANT.heli; if (!h||!h.rope) return; CLIMB={t:0,h}; jj.lock=99; jj.hidden=true; jj.x=h.rope.x; jj.y=h.rope.y; sfx("door"); }
function updateClimb(dt){ if (!CLIMB) return; const C=CLIMB, h=C.h; if (jj.dead||WANT.heli!==h){ CLIMB=null; jj.hidden=false; jj.lock=0; return; } C.t+=dt; jj.lock=99;
  if (C.t>=2.4){ CLIMB=null; jj.hidden=false; jj.lock=0; WANT.heli=null; WANT.heliCd=30; const v=addVeh("heli",h.x,h.y,h.a,"#1f3d7a",{z:1.2,spin:true}); getIn(v); hudDirty=true; shake=Math.max(shake,4);
    toast(LANG==="en"?"🚁 Police heli stolen! Pilot thrown out.":"🚁 Polizei-Heli geklaut! Pilot rausgeworfen."); crime(1,LANG==="en"?"Police heli stolen":"Polizei-Heli geklaut"); } }
function drawRope(q,vx,vy){ const h=WANT.heli; if (!h||!h.rope) return; const R_=h.rope, z=300, k=1+z/D, X=vx+(h.x-vx)*k, Y=vy+(h.y-vy)*k; let f=Math.min(1,R_.t); if (R_.up) f=Math.max(0,1-R_.up); if (CLIMB) f=1; if (f<=0) return;
  const at=u=>[X+(h.x-X)*u,Y+(h.y-Y)*u,1+(1-u)*z/D]; const [ex,ey]=at(f); q.strokeStyle="rgba(20,16,12,.9)"; q.lineWidth=2.2; q.beginPath(); q.moveTo(X,Y); q.lineTo(ex,ey); q.stroke();
  const person=(u,L,lbl)=>{ const [x,y,kk]=at(u); q.save(); q.translate(x,y); q.scale(kk,kk); drawPerson(q,{x:0,y:0,ang:0,moving:false},L); q.restore(); if (lbl) tag(q,x,y-24*kk,lbl); };
  if (R_.t>1&&R_.sp<R_.n&&!R_.up&&!CLIMB) person(((R_.t-1)%1.3)/1.3,WANT.lv>=5?SWAT_LOOK:COP_LOOK);
  if (CLIMB) person(1-Math.min(1,CLIMB.t/2.4),LOOK,"JJ");
  if (!CLIMB&&f>=1&&!jj.veh&&Math.hypot(jj.x-h.x,jj.y-h.y)<160){ q.strokeStyle="rgba(255,210,60,.8)"; q.lineWidth=2; q.setLineDash([5,5]); q.beginPath(); q.arc(h.x,h.y,22+Math.sin(performance.now()/200)*3,0,7); q.stroke(); q.setLineDash([]); } }
// ---------- 5★: Straßensperren + Nagelbänder ----------
const SPIKES=[];
function updateRoadblocks(dt){ WANT.rbT=(WANT.rbT==null?6:WANT.rbT)-dt;
  for (const s of SPIKES){ if (s.gone) continue; for (const v of vehicles){ if (v.gone||v.wreck||v.t.kind!=="car"||v.flat>0||v.type==="tank") continue; const dx=v.x-s.x, dy=v.y-s.y, ca=Math.cos(s.a), sa=Math.sin(s.a), u=dx*ca+dy*sa, w=-dx*sa+dy*ca;
      if (Math.abs(u)<s.w/2&&Math.abs(w)<12){ v.flat=12; if (v===jj.veh){ toast(LANG==="en"?"💥 Tires shredded!":"💥 Reifen platt!"); sfx("boom"); shake=Math.max(shake,5); } } } if (Math.hypot(s.x-jj.x,s.y-jj.y)>2600) s.gone=true; }
  for (let i=SPIKES.length-1;i>=0;i--) if (SPIKES[i].gone) SPIKES.splice(i,1);
  for (const v of vehicles) if (v.flat>0){ v.flat-=dt; const m=v.t.max*.4; if (v.v>m) v.v=Math.max(m,v.v-500*dt); if (v.v<-m) v.v=-m; }
  const T=jj.veh; if (WANT.lv<5||wantOff()||!T||T.t.kind!=="car"&&T.t.kind!=="moto"||WANT.rbT>0||Math.abs(T.v)<140) return; WANT.rbT=13;
  const ca=Math.cos(T.a), sa=Math.sin(T.a);
  for (const dist of [1150,1000,1350]){ const px=T.x+ca*dist, py=T.y+sa*dist, r=roads.find(r=>px>r.x&&px<r.x+r.w&&py>r.y&&py<r.y+r.h); if (!r||!offView(px,py,80)) continue; const hor=r.w>r.h; if (hor!==(Math.abs(ca)>Math.abs(sa))) continue;
    const cx=hor?px:r.x+r.w/2, cy=hor?r.y+r.h/2:py, half=(hor?r.h:r.w)/2, dx=hor?Math.sign(ca):0, dy=hor?0:Math.sign(sa);
    for (const sd of [-1,1]){ const ox=hor?0:sd*half*.5, oy=hor?sd*half*.5:0; addVeh("police",cx+ox,cy+oy,(hor?Math.PI/2:0)+sd*.25,"",{driver:false,cop:true,lights:true,crew:0}); }
    for (let k=0;k<(WANT.lv>=6?3:2);k++){ const c=spawnCop(cx+dx*46+(hor?0:(k-1)*30),cy+dy*46+(hor?(k-1)*30:0)); swatify(c); }
    SPIKES.push({x:cx-dx*170,y:cy-dy*170,a:hor?Math.PI/2:0,w:half*2-6}); toast(LANG==="en"?"🚧 Roadblock ahead!":"🚧 Straßensperre voraus!"); break; } }
function drawSpikes(q){ for (const s of SPIKES){ q.save(); q.translate(s.x,s.y); q.rotate(s.a); q.fillStyle="rgba(0,0,0,.35)"; q.fillRect(-s.w/2+2,-4,s.w,10); q.fillStyle="#2a2b2f"; q.fillRect(-s.w/2,-5,s.w,8); q.fillStyle="#c9ccd1"; for (let x=-s.w/2+3;x<s.w/2-3;x+=7){ q.beginPath(); q.moveTo(x,-5); q.lineTo(x+3.5,-10); q.lineTo(x+7,-5); q.fill(); q.beginPath(); q.moveTo(x,3); q.lineTo(x+3.5,8); q.lineTo(x+7,3); q.fill(); } q.restore(); } }
// ---------- 6★: Kampfjets fliegen Bombenteppiche ----------
const JETS=[], BOMBS=[], JETSRC={jet:true};
function updateJets(dt){ WANT.jetT=(WANT.jetT==null?6:WANT.jetT)-dt;
  if (WANT.lv>=6&&!wantOff()&&WANT.jetT<=0){ WANT.jetT=20; const T=jj.veh||jj, a=rnd()*6.283, lead=jj.veh?Math.min(400,Math.abs(jj.veh.v)*1.2):0, tx=T.x+(jj.veh?Math.cos(jj.veh.a)*lead:0), ty=T.y+(jj.veh?Math.sin(jj.veh.a)*lead:0);
    JETS.push({x:tx-Math.cos(a)*2400,y:ty-Math.sin(a)*2400,a,tx,ty,t:0,drop:0}); toast(LANG==="en"?"✈️ AIRSTRIKE – MOVE!":"✈️ LUFTANGRIFF – BEWEG DICH!"); sfx("ping"); }
  if (WANT.lv<6) WANT.jetT=Math.max(WANT.jetT,4);
  for (let i=JETS.length-1;i>=0;i--){ const J=JETS[i]; J.t+=dt; J.x+=Math.cos(J.a)*1150*dt; J.y+=Math.sin(J.a)*1150*dt; const d=(J.x-J.tx)*Math.cos(J.a)+(J.y-J.ty)*Math.sin(J.a);
    if (J.drop<6&&d>-330+J.drop*130){ BOMBS.push({x:J.x,y:J.y,t:.7,t0:.7}); J.drop++; } if (J.t>5) JETS.splice(i,1); }
  for (let i=BOMBS.length-1;i>=0;i--){ const b=BOMBS[i]; b.t-=dt; if (b.t<=0){ BOMBS.splice(i,1); explosion(b.x,b.y,.85,JETSRC); } } }
function drawJets(q,vx,vy){ for (const b of BOMBS){ const f=1-b.t/b.t0; q.strokeStyle=`rgba(255,59,48,${.4+f*.5})`; q.lineWidth=2; q.beginPath(); q.arc(b.x,b.y,40-f*24,0,7); q.stroke(); }
  for (const J of JETS){ const z=520, k=1+z/D, X=vx+(J.x-vx)*k, Y=vy+(J.y-vy)*k; q.save(); q.translate(J.x+z*.45,J.y+z*.17); q.rotate(J.a); q.fillStyle="rgba(25,15,40,.2)"; q.beginPath(); q.moveTo(34,0); q.lineTo(-24,-30); q.lineTo(-14,0); q.lineTo(-24,30); q.closePath(); q.fill(); q.restore();
    q.save(); q.translate(X,Y); q.scale(k,k); q.rotate(J.a); q.fillStyle="#5d6670"; q.beginPath(); q.moveTo(36,0); q.lineTo(-10,-6); q.lineTo(-22,-30); q.lineTo(-28,-30); q.lineTo(-20,-4); q.lineTo(-30,-4); q.lineTo(-36,-12); q.lineTo(-40,-12); q.lineTo(-36,0); q.lineTo(-40,12); q.lineTo(-36,12); q.lineTo(-30,4); q.lineTo(-20,4); q.lineTo(-28,30); q.lineTo(-22,30); q.lineTo(-10,6); q.closePath(); q.fill();
    q.fillStyle="#9fd3ff"; q.beginPath(); q.ellipse(18,0,7,2.6,0,0,7); q.fill(); q.fillStyle="rgba(255,170,60,.85)"; q.beginPath(); q.ellipse(-42,0,6+Math.random()*4,3,0,0,7); q.fill(); q.restore(); } }
function updateLake(dt){ LK.t+=dt; const sw=lakeSwim();
  if (!sw) LK.dive=false;
  if (LK.dive){ LK.air=Math.max(0,LK.air-dt/14); if (LK.air<=0&&rnd()<dt*2.5) hurt(6); } else LK.air=Math.min(1,LK.air+dt/3);
  // Hai bewacht den Koffer
  const S=LK.shark; S.bite=Math.max(0,S.bite-dt); const dJ=Math.hypot(jj.x-S.x,jj.y-S.y); const hunt=sw&&dJ<(LK.dive?300:200)&&!jj.dead;
  let tx,ty; if (hunt){ tx=jj.x; ty=jj.y; S.v=Math.min(105,S.v+dt*60); } else { S.ang+=dt*.35; tx=LK.chest.x+Math.cos(S.ang)*230; ty=LK.chest.y+Math.sin(S.ang)*150; S.v+=(60-S.v)*Math.min(1,dt); }
  let da=Math.atan2(ty-S.y,tx-S.x)-S.a; da=Math.atan2(Math.sin(da),Math.cos(da)); S.a+=da*Math.min(1,dt*2.2); const nx=S.x+Math.cos(S.a)*S.v*dt, ny=S.y+Math.sin(S.a)*S.v*dt; if (lakeR(nx,ny)<.9){ S.x=nx; S.y=ny; } else S.a+=dt*3;
  if (hunt&&dJ<34&&S.bite<=0){ S.bite=1.4; hurt(LK.dive?11:8); sfx("hit"); for (let k=0;k<8;k++) emit("debris",jj.x,jj.y,{vx:(rnd()-.5)*160,vy:(rnd()-.5)*160,size:2+rnd()*3,life:.5,max:.5,col:"#c41f2a"}); if (!LK.bitTold){ LK.bitTold=1; jjSay("WHAT THE HELL?! Ein Hai im See?!"); barkT=5; } }
  // Oktopus: versteckt sich, spritzt Tinte
  const O=LK.oct; O.t+=dt; O.ink=Math.max(0,O.ink-dt); const dO=Math.hypot(jj.x-O.x,jj.y-O.y);
  if (sw&&dO<70&&O.ink<=0){ O.ink=4; for (let k=0;k<22;k++) emit("dark",O.x,O.y,{vx:(rnd()-.5)*90,vy:(rnd()-.5)*90,size:14+rnd()*16,grow:30,life:2.2,max:2.2,a:.7}); const a=Math.atan2(O.y-jj.y,O.x-jj.x); O.tx=O.x+Math.cos(a)*120; O.ty=O.y+Math.sin(a)*120; if (!inLake(O.tx,O.ty)){ O.tx=O.hx; O.ty=O.hy; } if (!LK.octTold){ LK.octTold=1; jjSay("Yo … war das ein Oktopus?!"); barkT=4; } }
  if (O.tx!=null){ O.x+=(O.tx-O.x)*Math.min(1,dt*1.5); O.y+=(O.ty-O.y)*Math.min(1,dt*1.5); if (Math.hypot(O.tx-O.x,O.ty-O.y)<3){ O.tx=null; } } else if (dO>300){ O.x+=(O.hx-O.x)*dt*.2; O.y+=(O.hy-O.y)*dt*.2; }
  // Babyfische: Schwärme, fliehen vor JJ
  for (const s of LK.schools){ const d=Math.hypot(jj.x-s.x,jj.y-s.y); if (sw&&d<120){ const a=Math.atan2(s.y-jj.y,s.x-jj.x); s.a=a; s.sp=120; } else { s.a+=Math.sin(LK.t*.7+s.hx)*dt*.8; s.sp=28; if (Math.hypot(s.x-s.hx,s.y-s.hy)>140) s.a=Math.atan2(s.hy-s.y,s.hx-s.x); }
    const nx=s.x+Math.cos(s.a)*s.sp*dt, ny=s.y+Math.sin(s.a)*s.sp*dt; if (lakeR(nx,ny)<.92){ s.x=nx; s.y=ny; } else s.a+=2; }
  // Das Geheimnis
  const C=LK.chest; if (!C.taken&&LK.dive&&Math.hypot(jj.x-C.x,jj.y-C.y)<38){ C.taken=true; try{ localStorage.setItem("jjla-lakechest","1"); }catch(e){} cash+=2500; hudDirty=true; saveGame(); sfx("reload");
    talk([["JJ","Ein Koffer … wasserdicht. Wer versenkt so was im See?"],["JJ","2.500 Dollar. Und … ein Foto. Donny und ich am Pier, 2018."],["JJ","Auf der Rückseite: „Santoro Tower – 23. Stock“. Shit."]],()=>toast("+$2.500 · Geheimnis gefunden")); }
  const el=$("airHud"); if (LK.dive){ el.hidden=false; el.style.setProperty("--a",LK.air); } else el.hidden=true; }
function drawLakeLife(q,vis){ if (!vis(LAKE.x,LAKE.y,LAKE.rx+200)) return; const sub=LK.dive, t=LK.t;
  q.save(); q.beginPath(); for (let i=0;i<=72;i++){ const a=i/72*6.2832, b=lakeB(a); q.lineTo(LAKE.x+Math.cos(a)*LAKE.rx*b,LAKE.y+Math.sin(a)*LAKE.ry*b); } q.clip();
  // Lichtflecken an der Oberfläche
  q.globalAlpha=sub?.18:.28; q.strokeStyle="#bff4ff"; q.lineWidth=1.4; for (let i=0;i<46;i++){ const x=LAKE.x-LAKE.rx+((i*263+t*14)%(LAKE.rx*2)), y=LAKE.y-LAKE.ry+((i*151)%(LAKE.ry*2)); q.beginPath(); q.moveTo(x,y); q.quadraticCurveTo(x+9,y-3+Math.sin(t*1.6+i)*2,x+18,y); q.stroke(); }
  const al=sub?1:.42; q.globalAlpha=al;
  // Koffer
  const C=LK.chest; if (!C.taken){ q.fillStyle="#3b2a1a"; rr(q,C.x-16,C.y-11,32,22,3); q.fill(); q.fillStyle="#c9a24a"; q.fillRect(C.x-16,C.y-2,32,4); q.fillRect(C.x-3,C.y-11,6,22); if (sub){ q.globalAlpha=.5+.5*Math.sin(t*4); q.fillStyle="#ffe680"; q.beginPath(); q.arc(C.x+10,C.y-7,2.5,0,7); q.fill(); q.globalAlpha=al; } }
  // Schwärme
  for (const s of LK.schools) for (const f of s.f){ const x=s.x+f.ox+Math.sin(t*2+f.ph)*4, y=s.y+f.oy+Math.cos(t*2.3+f.ph)*4; q.save(); q.translate(x,y); q.rotate(s.a); q.fillStyle=f.ph<2?"#ffd23f":f.ph<4?"#ff9a3d":"#9ee7ff"; q.beginPath(); q.ellipse(0,0,4.2,1.9,0,0,7); q.fill(); q.beginPath(); q.moveTo(-3.5,0); q.lineTo(-6.5,-2); q.lineTo(-6.5,2); q.fill(); q.restore(); }
  // Oktopus
  { const O=LK.oct; q.save(); q.translate(O.x,O.y); q.fillStyle="#b04a8f"; q.strokeStyle="#b04a8f"; q.lineCap="round"; q.lineWidth=4; for (let i=0;i<8;i++){ const a=i/8*6.2832+.2; q.beginPath(); q.moveTo(0,0); for (let s=1;s<=5;s++){ const r=s*6, w=Math.sin(t*3+i+s*.8)*.35; q.lineTo(Math.cos(a+w)*r,Math.sin(a+w)*r); } q.stroke(); }
    q.beginPath(); q.ellipse(0,-3,12,14,0,0,7); q.fill(); q.fillStyle="#fff"; q.beginPath(); q.arc(-4,-4,2.6,0,7); q.arc(4,-4,2.6,0,7); q.fill(); q.fillStyle="#111"; q.beginPath(); q.arc(-4,-4,1.3,0,7); q.arc(4,-4,1.3,0,7); q.fill(); q.restore(); }
  // Hai
  { const S=LK.shark, sw=Math.sin(t*(S.v>80?9:4))*.25; q.save(); q.translate(S.x,S.y); q.rotate(S.a); q.fillStyle="#6f8796";
    q.beginPath(); q.moveTo(34,0); q.quadraticCurveTo(20,-11,-12,-7); q.lineTo(-24,-2); q.lineTo(-24,2); q.lineTo(-12,7); q.quadraticCurveTo(20,11,34,0); q.fill();
    q.save(); q.translate(-24,0); q.rotate(sw); q.beginPath(); q.moveTo(0,0); q.lineTo(-14,-11); q.lineTo(-9,0); q.lineTo(-14,11); q.closePath(); q.fill(); q.restore();
    q.beginPath(); q.moveTo(8,-8); q.lineTo(-6,-22); q.lineTo(-4,-7); q.fill(); q.beginPath(); q.moveTo(8,8); q.lineTo(-6,22); q.lineTo(-4,7); q.fill();
    q.fillStyle="#c9d6dd"; q.beginPath(); q.ellipse(14,0,14,3.5,0,0,7); q.fill(); q.fillStyle="#111"; q.beginPath(); q.arc(24,-4,1.5,0,7); q.arc(24,4,1.5,0,7); q.fill(); q.restore(); }
  q.restore(); q.globalAlpha=1;
  if (!sub){ const S=LK.shark; q.fillStyle="#4d6170"; q.save(); q.translate(S.x,S.y); q.rotate(S.a); q.beginPath(); q.moveTo(4,0); q.lineTo(-10,-2.5); q.lineTo(-10,2.5); q.fill(); q.strokeStyle="rgba(255,255,255,.55)"; q.lineWidth=1.2; q.beginPath(); q.arc(0,0,12+Math.sin(t*5)*2,2.4,3.9); q.stroke(); q.restore(); } }
function drawDiveTint(){ if (!LK.dive) return; ctx.save(); ctx.setTransform(dpr,0,0,dpr,0,0); const g2=ctx.createRadialGradient(cssW/2,cssH/2,Math.min(cssW,cssH)*.15,cssW/2,cssH/2,Math.max(cssW,cssH)*.7); g2.addColorStop(0,"rgba(20,110,150,.22)"); g2.addColorStop(1,"rgba(4,30,60,.72)"); ctx.fillStyle=g2; ctx.fillRect(0,0,cssW,cssH);
  ctx.globalAlpha=.25; ctx.fillStyle="#d8fbff"; for (let i=0;i<14;i++){ const x=(i*97+LK.t*12)%cssW, y=cssH-((LK.t*40+i*61)%cssH); ctx.beginPath(); ctx.arc(x,y,2+i%3,0,7); ctx.fill(); } ctx.restore(); }
// Hollywood-Zeichen (steht am Hang, leichte Parallaxe)
const SIGN={x0:7940,y:650,lw:104,txt:"HOLLYWOOD"};
for (let i=0;i<SIGN.txt.length;i++) solids.push(R(SIGN.x0+i*SIGN.lw-4,SIGN.y-16,56,22));
function drawSign(q,vx,vy,vis){ if (!vis(8400,SIGN.y,700)) return; const k=1+70/D;
  q.save(); q.font='400 118px "Bebas Neue",Impact,sans-serif'; q.textBaseline="alphabetic"; q.textAlign="left";
  for (let i=0;i<SIGN.txt.length;i++){ const bx=SIGN.x0+i*SIGN.lw, by=SIGN.y, ch=SIGN.txt[i]; q.fillStyle="rgba(30,20,10,.32)"; q.save(); q.translate(bx+22,by+10); q.transform(1,0,-.55,.35,0,0); q.fillText(ch,0,0); q.restore(); }
  for (let i=0;i<SIGN.txt.length;i++){ const bx=SIGN.x0+i*SIGN.lw, by=SIGN.y, ch=SIGN.txt[i], tx=(bx+26-vx)*(k-1), ty=(by-vy)*(k-1);
    q.strokeStyle="#5a4a3a"; q.lineWidth=3; q.beginPath(); q.moveTo(bx+8,by); q.lineTo(bx+8+tx*.6,by-30+ty*.6); q.moveTo(bx+44,by); q.lineTo(bx+44+tx*.6,by-30+ty*.6); q.stroke();
    q.save(); q.setTransform(q.getTransform().multiply(new DOMMatrix([1,0,-tx/86,1-ty/86,bx,by]))); q.fillStyle="#cfc8bb"; q.fillText(ch,3,0); q.fillStyle="#fbfaf6"; q.fillText(ch,0,-3); q.restore(); }
  q.restore(); }

// ================= POLIZEI / FAHNDUNG (1–5 Sterne) =================
const COP_LOOK={skin:"#c99572",skinHi:"#ddb08c",shirt:"#1f3d7a",shirtHi:"#3060b0",pants:"#141c2e",shoe:"#0b0b0d",cap:"#141c2e"};
const WANT={heat:0,lv:0,seenT:0,lx:0,ly:0,sx:0,sy:0,spT:0,wT:0,bustT:0,busted:0,heli:null,shown:-1,flash:false};
const WANT_CARS=[0,1,2,3,3,4,5], WANT_TANKS=[0,0,0,0,1,1,3];
function wantOff(){ return !started||!!CRIDE||!!GOLF||!!RIDE&&RIDE.phase==="drive"&&!RIDE.done||!!CINE||!!ESC||!!(typeof FLY!=="undefined"&&FLY)||jj.dead||WANT.busted>0||!!(MI&&MI.def.id==="m3"&&MI.step>=1&&MI.step<3); }
function copsNear(x,y,r){ for (const v of vehicles) if (v.type==="police"&&!v.wreck&&!v.gone&&(v.driver||v.cop)&&v!==jj.veh&&Math.hypot(v.x-x,v.y-y)<r) return true;
  for (const n of npcs) if (n.cop&&!n.dead&&Math.hypot(n.x-x,n.y-y)<r) return true; return false; }
function crime(amt,why){ if (wantOff()) return; const before=WANT.lv; WANT.heat=Math.min(6.99,WANT.heat+amt); WANT.knowT=Math.max(WANT.knowT||0,7); WANT.lv=Math.min(6,Math.floor(WANT.heat));
  if (WANT.lv>before){ WANT.seenT=0; WANT.lx=jj.x; WANT.ly=jj.y; WANT.spT=0; sfx("ping"); if (before===0){ toast(why?why+" – die Polizei sucht dich!":"Die Polizei sucht dich!"); bark("crash",1); }
    else if (WANT.lv===5) toast(LANG==="en"?"★★★★★ SWAT & roadblocks!":"★★★★★ SWAT & Straßensperren!"); else if (WANT.lv===6) toast(LANG==="en"?"★★★★★★ MILITARY – airstrikes!":"★★★★★★ MILITÄR – Luftangriffe!"); } }
let killBy=null;
// Passanten überfahren ruft keine Polizei. Zu Fuß getötet (Schläge/Waffen): die ersten zwei bleiben unbemerkt,
// ab dem dritten (innerhalb von 90 s) kommt die Polizei.
const CIVK={n:0,t:0};
function wantOnKill(n){ const kb=killBy; killBy=null; if (kb&&kb!==jj.veh) return; if (n.cop){ crime(1.5,"Polizist getötet"); return; } if (n.hostile||kb) return; if (Math.hypot(n.x-jj.x,n.y-jj.y)>=700) return;
  const now=performance.now(); if (now-CIVK.t>90000) CIVK.n=0; CIVK.t=now; CIVK.n++; if (CIVK.n===3) crime(1,"Mehrere Tote"); else if (CIVK.n>3) crime(.4,"Mehrere Tote"); }
function wantOnShot(){ if (!started) return; if (copsNear(jj.x,jj.y,450)) crime(1,"Schüsse auf Polizisten"); }
function wantOnJack(v){ if (v.missionV) return; if (v.type==="police"&&v.driver) crime(1,"Polizist angegriffen"); }
function clearWanted(silent){ WANT.heat=0; WANT.lv=0; WANT.seenT=0; WANT.bustT=0;
  for (const v of vehicles) if (v.cop){ v.ai=false; v.lights=false; v.leave=true; }
  for (const n of npcs) if (n.cop&&!n.dead){ n.hostile=false; n.leave=true; n.panic=0; }
  if (WANT.heli) WANT.heli.leave=true; if (!silent) toast("Abgehängt! Die Cops geben auf."); }
function spawnCopCar(){ const p=roadSpotAway(jj.x,jj.y,620,950); if (!p) return; const v=addVeh("police",p.x,p.y,p.a,"",{ai:true,driver:true,cop:true,crew:2,lights:true});
  if (WANT.lv>=4){ v.t=Object.assign({},VT.police,{max:VT.police.max*1.12,acc:VT.police.acc*1.15,hp:VT.police.hp*1.3}); v.hp=v.t.hp; } }
function spawnCop(x,y){ const n={x,y,ang:0,step:0,moving:false,run:false,look:COP_LOOK,hostile:true,cop:true,dead:false,deadT:0,cd:.8+rnd(),weapon:WANT.lv>=3?"pistol":null,range:20,sp:WANT.lv>=3?105:95,hits:0}; npcs.push(n); return n; }
function copSees(){ const T=jj.veh||jj; for (const v of vehicles) if (v.cop&&!v.wreck&&!v.gone&&!v.leave&&Math.hypot(v.x-T.x,v.y-T.y)<480) return true;
  for (const n of npcs) if (n.cop&&!n.dead&&!n.leave&&Math.hypot(n.x-T.x,n.y-T.y)<380&&losClear(n.x,n.y,T.x,T.y)) return true;
  const h=WANT.heli; if (h&&!h.leave&&Math.hypot(h.lx-T.x,h.ly-T.y)<130&&!(T===jj&&jj.roof)) return true; return false; }
function updateWanted(dt){ if (CURROOM) return; const T=jj.veh||jj;
  // aufräumen: abziehende / weit entfernte Cops verschwinden außer Sicht
  for (const v of vehicles) if (v.cop&&!v.gone&&(v.leave||v.wreck||Math.hypot(v.x-T.x,v.y-T.y)>2300)&&offView(v.x,v.y,120)&&v!==jj.veh){ if (v.leave||Math.hypot(v.x-T.x,v.y-T.y)>2300) v.gone=true; }
  for (let i=npcs.length-1;i>=0;i--){ const n=npcs[i]; if (n.cop&&(n.leave||n.dead&&n.deadT>20||Math.hypot(n.x-T.x,n.y-T.y)>1800)&&offView(n.x,n.y,80)) npcs.splice(i,1); }
  if (WANT.heli) updateCopHeli(dt);
  if (WANT.busted>0){ WANT.busted+=dt; if (WANT.busted>3.2) finishBust(); return; }
  if (WANT.lv<=0||wantOff()) { if (WANT.lv>0&&jj.dead) clearWanted(true); return; }
  // Sicht / Suche
  WANT.knowT=Math.max(0,(WANT.knowT||0)-dt);
  if (WANT.knowT>0||copSees()){ WANT.seenT=0; WANT.lx=T.x; WANT.ly=T.y; WANT.sx=T.x; WANT.sy=T.y; WANT.lastVeh=jj.veh||"foot"; }
  else { WANT.seenT+=dt; WANT.wT-=dt; if (WANT.seenT>4&&!WANT.tip){ WANT.tip=1; toast(LANG==="en"?"Tip: unseen, switch cars or outfit ("+(PAD.on?(PAD.ps?"↓ / L1":"↓ / LB"):"hold C")+") = ★ −1":"Tipp: Unbeobachtet Auto wechseln oder Outfit ändern ("+(PAD.on?"↓-Taste":"C halten")+") = ★ −1"); } if (WANT.seenT<4){ WANT.sx=WANT.lx; WANT.sy=WANT.ly; } else if (WANT.wT<=0){ WANT.wT=4; const a=rnd()*6.283, r=150+rnd()*350; WANT.sx=WANT.lx+Math.cos(a)*r; WANT.sy=WANT.ly+Math.sin(a)*r; }
    if (WANT.seenT>8+WANT.lv*3){ clearWanted(); return; } }
  // Verstärkung
  WANT.spT-=dt; const cars=vehicles.filter(v=>v.cop&&!v.gone&&!v.wreck&&!v.leave&&v.ai).length;
  if (WANT.spT<=0&&cars<WANT_CARS[WANT.lv]){ WANT.spT=WANT.lv>=4?2:3.2; spawnCopCar(); }
  { const tk=vehicles.filter(v=>v.type==="tank"&&!v.gone&&!v.wreck&&!v.leave).length; WANT.tkT=(WANT.tkT||0)-dt; if (WANT.tkT<=0&&tk<WANT_TANKS[WANT.lv]){ WANT.tkT=6; spawnTank(); if (!WANT.tankTold){ WANT.tankTold=1; toast("PANZER! Die meinen es ernst."); } } }
  for (const n of npcs) if (n.cop&&n.patrol&&!n.hostile&&!n.dead&&!n.leave&&Math.hypot(n.x-T.x,n.y-T.y)<800){ n.hostile=true; n.sp=95; n.cd=.8; }
  WANT.heliCd=Math.max(0,(WANT.heliCd||0)-dt); if (WANT.lv>=3&&!WANT.heli&&WANT.heliCd<=0) WANT.heli={x:T.x-900,y:T.y-500,a:0,rot:0,cd:2,leave:false,lx:T.x,ly:T.y};
  // festgefahrene Streifenwagen außer Sicht ersetzen
  for (const v of vehicles) if (v.cop&&v.ai&&!v.gone&&!v.wreck){ v.pT=(v.pT||0)+dt; if (v.pT>2.5){ v.pT=0; const dd=Math.hypot(v.x-T.x,v.y-T.y); if (v.pd!=null&&dd>v.pd-50&&dd>200) v.bad=(v.bad||0)+1; else v.bad=0; v.pd=dd; if (v.bad>=2&&offView(v.x,v.y,40)){ v.gone=true; WANT.spT=Math.min(WANT.spT,.5); } } }
  // Streifenwagen am Ziel: Cops steigen aus
  for (const v of vehicles) if (v.cop&&v.ai&&v.crew>0&&!v.wreck&&!jj.veh&&Math.hypot(v.x-jj.x,v.y-jj.y)<170&&Math.abs(v.v)<70){ const c=Math.cos(v.a), s=Math.sin(v.a);
    for (let k=0;k<v.crew;k++){ const sd=k?1:-1, px=v.x-s*sd*26, py=v.y+c*sd*26; spawnCop(npcFree(px,py)?px:v.x+c*30,npcFree(px,py)?py:v.y+s*30); } v.crew=0; v.ai=false; v.v*=.3; sfx("door"); }
  if (WANT.lv>=3) for (const n of npcs) if (n.cop&&!n.dead&&!n.weapon) n.weapon="pistol";
  // Festnahme: Cop direkt an JJ (zu Fuß)
  let close=false; if (!jj.veh&&!jj.h) for (const n of npcs) if (n.cop&&!n.dead&&!n.leave&&Math.hypot(n.x-jj.x,n.y-jj.y)<(jj.hp<30?60:30)){ close=true; break; }
  WANT.bustT=close?WANT.bustT+dt*(jj.moving?.6:1):Math.max(0,WANT.bustT-dt*1.5);
  if (WANT.bustT>1.5) startBust(); }
function startBust(){ WANT.busted=.01; WANT.bustT=0; jj.lock=4; jj.moving=false; sfx("door"); }
function finishBust(){ WANT.busted=0; const fee=Math.min(cash,Math.max(50,Math.round(cash*.1))); cash-=fee; clearWanted(true); for (const n of npcs) if (n.cop) n.leave=true;
  if (MI) failMission("Du wurdest verhaftet."); jj.lock=0; jj.hp=Math.max(jj.hp,60); jj.x=6935; jj.y=1560; jj.ang=0; cam.x=jj.x; cam.y=jj.y; hudDirty=true; saveGame();
  toast(fee?"Kaution bezahlt: −$"+fee:"Auf Bewährung raus. Benimm dich, JJ."); }
function updateCopHeli(dt){ const h=WANT.heli, T=jj.veh||jj; h.rot+=dt*30; if (heliRope(dt,h,T)){ h.lx+=(T.x-h.lx)*Math.min(1,dt*3); h.ly+=(T.y-h.ly)*Math.min(1,dt*3); return; }
  const tx=h.leave?T.x+3000:(WANT.seenT>0?WANT.sx:T.x)+Math.sin(performance.now()/1400)*60, ty=h.leave?T.y-2000:(WANT.seenT>0?WANT.sy:T.y)-30;
  const dx=tx-h.x, dy=ty-h.y, d=Math.hypot(dx,dy), sp=Math.min(d*1.2,h.leave?420:250); if (d>1){ h.x+=dx/d*sp*dt; h.y+=dy/d*sp*dt; } let da=Math.atan2(dy,dx)-h.a; da=Math.atan2(Math.sin(da),Math.cos(da)); if (d>40) h.a+=da*Math.min(1,dt*2);
  { const sx=WANT.seenT>0?WANT.sx:T.x, sy=WANT.seenT>0?WANT.sy:T.y, ex=sx-h.lx, ey=sy-h.ly, ed=Math.hypot(ex,ey), ms=(WANT.seenT>0?140:230)*dt, kk=ed>ms?ms/ed:1; if (Math.hypot(h.lx-h.x,h.ly-h.y)>320||ed>900){ h.lx=h.x; h.ly=h.y; } else { h.lx+=ex*kk; h.ly+=ey*kk; } }
  if (h.leave&&offView(h.x,h.y,300)){ WANT.heli=null; return; }
  if (!h.leave&&WANT.lv>=4&&WANT.seenT===0&&!jj.dead&&d<260){ h.cd-=dt; if (h.cd<=0){ h.cd=WANT.lv>=6?3.6:1.3+rnd()*.6; if (WANT.lv>=6){ const lx=T.x+(jj.veh?Math.cos(jj.veh.a)*jj.veh.v*.5:0), ly=T.y+(jj.veh?Math.sin(jj.veh.a)*jj.veh.v*.5:0); SHELLS.push({x:h.x,y:h.y,tx:lx+(rnd()-.5)*60,ty:ly+(rnd()-.5)*60,t:0,dur:.7,sx:h.x,sy:h.y,src:JETSRC}); sfx("boom"); return; } const hit=rnd()<.2, ex=T.x+(hit?0:(rnd()-.5)*50), ey=T.y+(hit?0:(rnd()-.5)*50); tracers.push({x1:h.x,y1:h.y,x2:ex,y2:ey,t:.07}); sfx("shot"); if (hit){ if (jj.veh) damageVeh(jj.veh,6); else hurt(6); } } } }
function drawCopSpot(q){ const h=WANT.heli; if (!h||h.leave) return; q.save(); q.globalCompositeOperation="lighter"; const g=q.createRadialGradient(h.lx,h.ly,8,h.lx,h.ly,110); g.addColorStop(0,"rgba(255,250,220,.32)"); g.addColorStop(.7,"rgba(255,250,220,.12)"); g.addColorStop(1,"rgba(255,250,220,0)"); q.fillStyle=g; q.beginPath(); q.arc(h.lx,h.ly,110,0,7); q.fill(); q.restore(); }
function drawCopHeli(q,vx,vy){ const h=WANT.heli; if (!h) return; drawRope(q,vx,vy); const z=300, k=1+z/D, X=vx+(h.x-vx)*k, Y=vy+(h.y-vy)*k;
  q.save(); q.translate(h.x+z*.45,h.y+z*.17); q.rotate(h.a); q.fillStyle="rgba(25,15,40,.22)"; q.beginPath(); q.ellipse(0,0,24,10,0,0,7); q.fill(); q.fillRect(-46,-2.5,26,5); q.restore();
  q.save(); q.translate(X,Y); q.scale(k,k); q.rotate(h.a);
  q.fillStyle="#141a2b"; q.fillRect(-46,-2.5,28,5); q.fillRect(-50,-9,6,18); q.beginPath(); q.ellipse(0,0,24,11,0,0,7); q.fill();
  q.fillStyle="#f2f2ee"; q.beginPath(); q.ellipse(-2,0,14,11,0,0,7); q.fill(); q.fillStyle="#1f3d7a"; q.fillRect(-12,-11,12,22);
  q.fillStyle="rgba(150,210,255,.85)"; q.beginPath(); q.ellipse(14,0,8,8,0,0,7); q.fill();
  const bl=Math.floor(performance.now()/180)%2; q.fillStyle=bl?"#ff3b30":"#3a7bff"; q.beginPath(); q.arc(-6,0,3,0,7); q.fill();
  q.strokeStyle="rgba(30,30,36,.55)"; q.lineWidth=3; for (let i=0;i<4;i++){ const a=h.rot+i*1.5708; q.beginPath(); q.moveTo(0,0); q.lineTo(Math.cos(a)*44,Math.sin(a)*44); q.stroke(); }
  q.fillStyle="rgba(30,30,36,.18)"; q.beginPath(); q.arc(0,0,44,0,7); q.fill(); q.restore(); }
// ---- Panzer (ab 4 Sternen) + Fußstreifen ----
const SHELLS=[];
function tankSprite(){ const l=72,w=40,S=2,pad=6; return mk((l+pad*2)*S,(w+pad*2)*S,q=>{ q.scale(S,S); q.translate(l/2+pad,w/2+pad); const L=l/2,Wd=w/2;
  q.fillStyle="#1d1f19"; rr(q,-L,-Wd,l,9,3); q.fill(); rr(q,-L,Wd-9,l,9,3); q.fill(); q.fillStyle="#3a3c33"; for (let x=-L+2;x<L-2;x+=5){ q.fillRect(x,-Wd+1,2.5,7); q.fillRect(x,Wd-8,2.5,7); }
  const gr=q.createLinearGradient(-L,-Wd,L*.4,Wd); gr.addColorStop(0,"#6f7d4a"); gr.addColorStop(.5,"#55623a"); gr.addColorStop(1,"#3a4428"); q.fillStyle=gr; rr(q,-L+3,-Wd+7,l-6,w-14,4); q.fill();
  q.fillStyle="rgba(0,0,0,.25)"; for (let x=-L+8;x<-L+24;x+=4) q.fillRect(x,-6,2,12); q.fillStyle="#2b3220"; q.fillRect(L-8,-8,4,16); q.fillStyle="#e9e4d2"; q.font="700 6px sans-serif"; q.fillText("LAPD",-4,-9); }); }
let TANKSPR=null;
function drawTankTop(q,v){ const a=(v.tur==null?v.a:v.tur)-v.a; q.save(); q.rotate(a); q.fillStyle="#2b3220"; q.fillRect(4,-2.6,40,5.2); q.fillStyle="#1d2216"; q.fillRect(40,-3.4,7,6.8);
  const g2=q.createRadialGradient(-3,-3,2,0,0,15); g2.addColorStop(0,"#76854f"); g2.addColorStop(1,"#3e4a2a"); q.fillStyle=g2; q.beginPath(); q.ellipse(0,0,15,13,0,0,7); q.fill(); q.fillStyle="#2f3622"; q.beginPath(); q.arc(-4,4,4,0,7); q.fill(); q.restore(); }
function spawnTank(){ const p=roadSpotAway(jj.x,jj.y,700,1000); if (!p) return; const v=addVeh("tank",p.x,p.y,p.a,"#55623a",{ai:true,driver:true,cop:true,crew:0,tur:p.a,cd:2.5}); }
function updateTanks(dt){ const T=jj.veh||jj;
  for (const v of vehicles){ if (v.type!=="tank"||v.gone||v.wreck) continue; const ta=Math.atan2(T.y-v.y,T.x-v.x); let d=ta-(v.tur==null?v.a:v.tur); d=Math.atan2(Math.sin(d),Math.cos(d)); v.tur=(v.tur==null?v.a:v.tur)+Math.max(-1.6*dt,Math.min(1.6*dt,d));
    v.cd-=dt; const dist=Math.hypot(T.x-v.x,T.y-v.y); if (WANT.lv>=4&&!jj.dead&&v.cd<=0&&dist<580&&Math.abs(d)<.12&&losClear(v.x,v.y,T.x,T.y)){ v.cd=3.2; const er=(rnd()-.5)*50, tx=T.x+(jj.veh?Math.cos(jj.veh.a)*jj.veh.v*.6:0)+er, ty=T.y+(jj.veh?Math.sin(jj.veh.a)*jj.veh.v*.6:0)+er;
      SHELLS.push({x:v.x+Math.cos(v.tur)*46,y:v.y+Math.sin(v.tur)*46,tx,ty,t:0,dur:Math.max(.25,dist/900),sx:v.x+Math.cos(v.tur)*46,sy:v.y+Math.sin(v.tur)*46,src:v}); sfx("boom"); shake=Math.max(shake,5); emit("flash",v.x+Math.cos(v.tur)*48,v.y+Math.sin(v.tur)*48,{size:70,life:.12,max:.12,grow:80}); } }
  for (let i=SHELLS.length-1;i>=0;i--){ const s=SHELLS[i]; s.t+=dt; const f=Math.min(1,s.t/s.dur); s.x=s.sx+(s.tx-s.sx)*f; s.y=s.sy+(s.ty-s.sy)*f; if (f>=1){ SHELLS.splice(i,1); explosion(s.tx,s.ty,.85,s.src); } } }
function drawShells(q){ for (const s of SHELLS){ q.strokeStyle="rgba(255,220,150,.6)"; q.lineWidth=2; q.beginPath(); q.moveTo(s.x,s.y); q.lineTo(s.x-(s.tx-s.sx)*.05,s.y-(s.ty-s.sy)*.05); q.stroke(); q.fillStyle="#222"; q.beginPath(); q.arc(s.x,s.y,3,0,7); q.fill(); } }
let patrolT=0;
function updatePatrol(dt){ return; patrolT-=dt; if (patrolT>0||!started||INROOM) return; patrolT=1.5; const P=jj.veh||jj;
  const n=npcs.filter(n=>n.cop&&n.patrol&&!n.dead&&!n.leave&&Math.hypot(n.x-P.x,n.y-P.y)<1400).length; if (n>=3) return;
  for (let tries=0;tries<20;tries++){ const a=rnd()*6.283, d=500+rnd()*500, x=P.x+Math.cos(a)*d, y=P.y+Math.sin(a)*d; const sn=nearestSW(x,y); if (sn.i<0||sn.d>260) continue; const px=sn.p.x, py=sn.p.y; if (noWalk(px,py)||!npcFree(px,py)||!offView(px,py,40)) continue;
    npcs.push({x:px,y:py,sw:sn.i,dir:1,tx:null,ang:rnd()*6.28,step:0,moving:true,run:false,look:COP_LOOK,sp:42,panic:0,dead:false,deadT:0,wob:rnd()*6,pause:rnd()*2,cop:true,patrol:true,cd:1,weapon:null,range:20,hits:0}); return; } }

function renderWanted(){ const el=$("wanted"); if (!el) return; const on=WANT.lv>0&&!jj.dead; const fl=on&&WANT.seenT>.4&&Math.floor(performance.now()/350)%2===0; const key=WANT.lv+"|"+fl; if (key===WANT.shown) return; WANT.shown=key; el.hidden=false; el.classList.toggle("hot",on); el.innerHTML=[1,2,3,4,5,6].map(i=>`<i class="${(i<=WANT.lv?(fl?"on dim":"on"):"")+(i===6?" six":"")}">★</i>`).join(""); }

function aliveFoes(list){ return (list||MI.foes).filter(n=>!n.dead).length; }
function spawnChaser(type,x,y,a,col){ const v=addVeh(type,x,y,a,col,{ai:true,driver:true,missionV:true}); if (type==="police") v.lights=true; if (MI) MI.vehs.push(v); return v; }
function cleanupMission(){ if (!MI) return; for (let i=pickups.length-1;i>=0;i--) if (pickups[i].loot) pickups.splice(i,1); sgReset(); if (MI.def.cleanup) try{ MI.def.cleanup(); }catch(e){} if (MI.def.act2){ if (CURROOM){ const d=CURROOM.outDoor; leaveRoomRaw(); if (d&&!jj.dead){ jj.x=d.x; jj.y=d.y+(d.dy||0); cam.x=jj.x; cam.y=jj.y; } } for (const k in ROOMS){ ROOMS[k].night=false; ROOMS[k].missionOnly=false; } jj.cashHeavy=0; } for (const n of MI.foes){ const i=npcs.indexOf(n); if (i>=0&&!n.dead) npcs.splice(i,1); }
  for (const v of MI.vehs){ if (jj.veh===v){ if (v.keep) continue; } v.ai=false; if (!v.keep) v.gone=!(jj.veh===v); } if (MI.cleanup) MI.cleanup(); if (gps&&gps.mission) gps=null; }
function startMission(def,retry){ if (MI) cleanupMission(); MI={def,step:0,t:0,foes:[],vehs:[],d:{},retry:!!retry}; startArmed=false; if (retry&&def.loc){ if (jj.veh) exitVeh(true); jj.h=0; jj.roof=null; jj.glide=null; jj.x=def.loc.x; jj.y=def.loc.y; cam.x=jj.x; cam.y=jj.y; }
  def.start(MI); renderObj(); hudDirty=true; }
// ---------- Crew verschwindet nicht: Spruch, stehen bleiben, langsam weggehen
const LEAVERS=[];
function leaver(n,x,y,say,tx,ty,o){ LEAVERS.push(Object.assign({n,x,y,ang:0,step:0,moving:false,say,sayT:3.2,wait:3.8,tx,ty,life:30},o||{})); }
const LEAVE={
  m1:()=>setupRide(),
  m2:(m)=>setupLukaRide(m),
  m3:(m)=>{ const a=m.ally; const x=a&&!a.inCar?a.x:PSPOT.x+10, y=a&&!a.inCar?a.y:PSPOT.y-26; leaver("Yunus",x,y,"Wir sehen uns später, Bro. Ich muss noch die Tauben hacken.",YGAR.x,YGAR.y-20,{gone:true,wait:4}); },
  m4:()=>leaver("Paul",YACHT.x-YACHT.l*.32,YACHT.y,"Wir sehen uns später. Für Donny.",YACHT.x-YACHT.l*.32,YACHT.y,{wait:9,life:12}),
  m6:()=>{} };
function updateLeavers(dt){ for (let i=LEAVERS.length-1;i>=0;i--){ const L=LEAVERS[i]; L.life-=dt; L.sayT-=dt; L.wait-=dt;
    const fx=jj.x-L.x, fy=jj.y-L.y; if (L.wait>0){ L.moving=false; L.ang=Math.atan2(-fx,fy); }
    else { const dx=L.tx-L.x, dy=L.ty-L.y, d=Math.hypot(dx,dy); if (d<6){ if (L.gone||L.life<0){ LEAVERS.splice(i,1); continue; } L.moving=false; }
      else { const sp=Math.min(d,55*dt); L.x+=dx/d*sp; L.y+=dy/d*sp; L.ang=Math.atan2(-dx/d,dy/d); L.moving=true; L.step+=dt*9; } }
    if (L.life<0&&Math.hypot(L.x-jj.x,L.y-jj.y)>700) LEAVERS.splice(i,1); } }
function completeMission(){ const def=MI.def; try{ LEAVE[def.id]&&LEAVE[def.id](MI); }catch(e){} cleanupMission(); MI=null; MS.done[def.id]=true; if (def.cash){ BANK+=def.cash; bankLog("Überweisung · "+def.n,def.cash); setTimeout(()=>pnote(`🏦 <b>+$${def.cash.toLocaleString("en-US")}</b> auf dein Konto`),2600); } MS.ruf+=def.ruf; for (const k of def.unlock||[]) UNLOCK[k]=true; saveGame(); hudDirty=true; sfx("ping");
  const unl=def.unlockTxt?`<div class="mu">Freigeschaltet: <b>${def.unlockTxt}</b></div>`:"";
  showDoneBanner(def); LEAD=null;
  const ct=CONTACT_OF[def.id]; if (ct) setTimeout(()=>showContact(ct),def.id==="m1"?900:3200);
  setTimeout(()=>{ if (def.after&&def.id!=="m1") def.after(); const nd=nextDef(), L=nd&&LEADS[nd.id]; if (L){ LEAD=nd.id; if (L.bark){ pnote(`💬 <b>${CHATS[L.from].n}</b> hat dir geschrieben`); if (!MI) setTimeout(()=>{ if (!MI&&!DLG) jjSay(L.bark,3.4); },900); } } renderObj(); },ct?6800:5200);
  renderObj(); }
let doneT=null, LEAD;
const LEADS={m2:{from:"earl",hint:"Luka wartet am anderen Ende vom Strand",bark:""},
  m3:{from:"yunus",hint:"Yunus wartet im Park in Downtown",bark:"Yunus weiß was über Donny … ab nach Downtown."},
  m4:{from:"paul",hint:"Paul wartet am Hafen beim Frachter",bark:"Paul, der Scharfschütze. Hafen also."},
  m5:{from:"marco",hint:"Mo wartet an seinem Heliport im Industriegebiet",bark:"Ein Pilot, der was über Donny weiß? Ab zum Heliport."},
  m6:{from:"luka",hint:"Die Crew wartet bei dir zuhause",bark:"Ein Plan von Luka. Was soll schon schiefgehen …"}};
function showDoneBanner(def){ const el=$("mdone"); el.innerHTML=`<span class="k">MISSION ERFÜLLT</span><b>${def.n}</b><span class="r">${def.cash?"+$"+def.cash.toLocaleString("en-US")+" · ":""}+${def.ruf} Ruf</span>${def.unlockTxt?`<span class="u">🔓 ${def.unlockTxt}</span>`:""}`;
  el.hidden=false; el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); clearTimeout(doneT); doneT=setTimeout(()=>{ el.classList.remove("on"); setTimeout(()=>{ el.hidden=true; },400); },4800); }
function failMission(reason){ if (!MI) return; const def=MI.def; cleanupMission(); MI=null; failedDef={def,reason}; renderObj(); hudDirty=true; }
function checkFail(){ if (failedDef&&!jj.dead&&!cardMode&&!DLG){ const f=failedDef; failedDef=null; showCard({retry:f.def},`<div class="mk fail">MISSION GESCHEITERT</div><h2>${f.def.n}</h2><p>${f.reason}</p>`,"NOCHMAL","ABBRECHEN"); } }
const nearP=(p,r)=>Math.hypot(jj.x-p.x,jj.y-p.y)<r;
function holdRing(m,key,p,r,secs,dt){ const inside=!jj.veh&&!jj.h&&nearP(p,r); const k="h_"+key; m.d[k]=Math.max(0,(m.d[k]||0)+(inside?dt:-dt*.5)); m.ring={x:p.x,y:p.y,r,f:Math.min(1,m.d[k]/secs),on:inside}; return m.d[k]>=secs; }
function crewMsg(id,text){ pushMsg(id,text,true); showNotif(id,text); }

// ---------- hostile AI (used by updateNpcs) ----------
function losClear(x1,y1,x2,y2){ const d=Math.hypot(x2-x1,y2-y1), n=Math.ceil(d/14); for (let i=1;i<n;i++){ const x=x1+(x2-x1)*i/n, y=y1+(y2-y1)*i/n; if (buildings.some(b=>x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h)) return false; } return true; }
function hostileAI(n,dt){ if (n.walkIn){ const dx=n.walkIn.x-n.x, dy=n.walkIn.y-n.y, dd=Math.hypot(dx,dy); if (dd<14||n.hits>0) n.walkIn=null; else { const st=Math.min(dd,150*dt), nx=n.x+dx/dd*st, ny=n.y+dy/dd*st; if (npcFree(nx,ny,8)){ n.x=nx; n.y=ny; n.wiS=0; } else if ((n.wiS=(n.wiS||0)+dt)>1.2) n.walkIn=null; n.ang=Math.atan2(-dx/dd,dy/dd); n.moving=true; n.run=true; n.step+=dt*16; return; } }
  n.cd-=dt; if (!npcFree(n.x,n.y,8)){ n.stuckIn=(n.stuckIn||0)+dt; if (n.stuckIn>.5){ [n.x,n.y]=freeSpot(n.x,n.y); n.stuckIn=0; } } else n.stuckIn=0; const T=n.target&&!n.target.gone&&!n.target.wreck?n.target:null; const tx=T?T.x:jj.x, ty=T?T.y:jj.y, d=Math.hypot(tx-n.x,ty-n.y);
  const canHitJJ=!T&&!jj.dead&&!jj.h; let mx=0,my=0; const a=Math.atan2(ty-n.y,tx-n.x);
  if (n.weapon==="pistol"){ if (d>240||!losClear(n.x,n.y,tx,ty)){ mx=Math.cos(a); my=Math.sin(a); } else if (d<110){ mx=-Math.cos(a)*.6+Math.cos(a+1.57)*.5; my=-Math.sin(a)*.6+Math.sin(a+1.57)*.5; }
    if (d<300&&n.cd<=0&&losClear(n.x,n.y,tx,ty)&&(T||canHitJJ||jj.veh)){ n.cd=1+rnd()*.6; const hit=rnd()<.7; const ex=tx+(hit?0:(rnd()-.5)*40), ey=ty+(hit?0:(rnd()-.5)*40);
      tracers.push({x1:n.x+Math.cos(a)*14,y1:n.y+Math.sin(a)*14,x2:ex,y2:ey,t:.07}); sfx("shot"); if (hit){ if (T) damageVeh(T,5); else if (jj.veh) damageVeh(jj.veh,3); else hurt(6); } } }
  else { if (d>26){ mx=Math.cos(a); my=Math.sin(a); } else if (d<20){ mx=-Math.cos(a)*.5; my=-Math.sin(a)*.5; } if (d<32&&n.cd<=0){ n.cd=.9; n.punchT=.28; n.side=-(n.side||1); sfx("hit"); if (T) damageVeh(T,3); else if (canHitJJ&&!jj.veh){ if (n.cop) jj.lock=Math.max(jj.lock,.3); else hurt(7); jj.x+=Math.cos(a)*6; jj.y+=Math.sin(a)*6; } } }
  const sp=n.sp*dt; let moved=false; if (mx||my){ const L=Math.hypot(mx,my); mx/=L; my/=L; const nx=n.x+mx*sp, ny=n.y+my*sp;
    n.dT=Math.max(0,(n.dT||0)-dt);
    if (n.dT<=0&&(npcFree(nx,ny)||!npcFree(n.x,n.y)&&npcFree(nx,ny,2))){ n.x=nx; n.y=ny; moved=true; }
    else { const sd=n.dSide||(n.dSide=rnd()<.5?1:-1); for (const s of [.5,1,1.5,2,2.5,-.5,-1,-1.5,-2,-2.5]){ const b=Math.atan2(my,mx)+s*sd, x2=n.x+Math.cos(b)*sp, y2=n.y+Math.sin(b)*sp; if (npcFree(x2,y2)){ n.x=x2; n.y=y2; moved=true; if (n.dT<=0) n.dT=.6; if (s<0) n.dSide=-sd; break; } } } }
  if ((mx||my)&&!moved){ n.blockT=(n.blockT||0)+dt; if (n.blockT>3){ n.blockT=0; const T2=n.target&&!n.target.gone?n.target:jj; [n.x,n.y]=freeSpot(n.x+(T2.x-n.x)*.35,n.y+(T2.y-n.y)*.35); } } else n.blockT=0;
  n.moving=moved; n.run=moved; n.step+=dt*14; if (n.punchT>0) n.punchT-=dt; let dd=Math.atan2(-Math.cos(a),Math.sin(a))-n.ang; dd=Math.atan2(Math.sin(dd),Math.cos(dd)); n.ang+=dd*Math.min(1,dt*10); }
// ---------- chaser cars ----------
// Crew-Wagen: fährt JJs Spur nach (Brotkrumen), hält Abstand, holt außer Sicht auf
function followDrive(v,dt){ const T=jj.veh||jj, tr=v.trail||(v.trail=[]), last=tr[tr.length-1];
  if (!last||Math.hypot(T.x-last[0],T.y-last[1])>40) tr.push([T.x,T.y]); if (tr.length>200) tr.shift();
  while (tr.length>1&&Math.hypot(tr[0][0]-v.x,tr[0][1]-v.y)<55) tr.shift();
  const d=Math.hypot(T.x-v.x,T.y-v.y), offV=(x,y)=>x<view.ox-150||x>view.ox+cssW/view.sc+150||y<view.oy-150||y>view.oy+cssH/view.sc+150;
  if (d>800&&offV(v.x,v.y)&&tr.length>3){ for (let i=tr.length-2;i>=0;i--){ const p=tr[i], q2=tr[i+1], an=Math.atan2(q2[1]-p[1],q2[0]-p[0]);
      if (offV(p[0],p[1])&&Math.hypot(p[0]-T.x,p[1]-T.y)>450){ if (!vehBlocked(v,p[0],p[1],an)){ v.x=p[0]; v.y=p[1]; v.a=an; v.v=Math.min(Math.abs(T.v||0),300); v.sx=v.sy=0; tr.splice(0,i+1); } break; } } }
  const g=tr[0]||[T.x,T.y]; let df=Math.atan2(g[1]-v.y,g[0]-v.x)-v.a; df=Math.atan2(Math.sin(df),Math.cos(df));
  let thr=d>260?1:d>170?.55:0, steer=Math.max(-1,Math.min(1,df*2.6)), brake=d<150;
  if (Math.abs(df)>1.4&&thr>0) thr=.4;
  if (Math.abs(v.v)<20&&thr>0) v.stuckT=(v.stuckT||0)+dt; else v.stuckT=0; if (v.stuckT>1.2){ v.rev=.8; v.stuckT=0; }
  if (v.rev>0){ v.rev-=dt; thr=-1; steer=-steer; brake=false; }
  return {thr,steer,brake}; }
function losFree(x1,y1,x2,y2){ const d=Math.hypot(x2-x1,y2-y1), n=Math.ceil(d/22); for (let i=1;i<n;i++){ const x=x1+(x2-x1)*i/n, y=y1+(y2-y1)*i/n; if (bAt(x,y,0)) return false; } return true; }
// Santoros Killer im Wagen: schießen aus dem Fenster, wenn sie freie Sicht haben
function gunnerFire(v,dt){ if (!v.gunner||v.wreck||v.burn>0||jj.dead||!v.driver) return; v.gunT=(v.gunT==null?1.2:v.gunT)-dt; if (v.gunT>0) return; const T=jj.veh||jj, d=Math.hypot(T.x-v.x,T.y-v.y); if (d>440||!losFree(v.x,v.y,T.x,T.y)){ v.gunT=.3; return; }
  v.burst=(v.burst||0)+1; v.gunT=v.burst%4?.16:1.1+rnd()*.6; const side=Math.sin(Math.atan2(T.y-v.y,T.x-v.x)-v.a)>0?1:-1, mx=v.x-Math.sin(v.a)*side*v.t.w*.55, my=v.y+Math.cos(v.a)*side*v.t.w*.55, fa=Math.atan2(T.y-my,T.x-mx)+(rnd()-.5)*.16;
  const hit=rnd()<(jj.veh?.34:.24)*(d<220?1.25:1), ex=hit?T.x+(rnd()-.5)*10:mx+Math.cos(fa)*d*1.1, ey=hit?T.y+(rnd()-.5)*10:my+Math.sin(fa)*d*1.1;
  tracers.push({x1:mx,y1:my,x2:ex,y2:ey,t:.07}); emit("flash",mx,my,{size:26,life:.05,max:.05}); sfx("shot");
  if (hit){ if (jj.veh) damageVeh(jj.veh,3,v); else hurt(5); for (let k=0;k<3;k++) emit("spark",ex,ey,{vx:(rnd()-.5)*200,vy:(rnd()-.5)*200,life:.2,max:.2}); } }
function aiDrive(v,dt){ const T=jj.veh||jj, srch=v.cop&&WANT.seenT>.5; let tx=srch?WANT.sx:T.x, ty=srch?WANT.sy:T.y; if (v.goal){ tx=v.goal.x; ty=v.goal.y; if (Math.hypot(tx-v.x,ty-v.y)<70){ v.onGoal&&v.onGoal(v); if (!v.goal) return {thr:0,steer:0,brake:true}; tx=v.goal.x; ty=v.goal.y; } } const d=Math.hypot(tx-v.x,ty-v.y); v.aiT=(v.aiT||0)-dt;
  if (v.aiT<=0){ v.aiT=1.1; v.route=astar(nearRoad(v.x,v.y),nearRoad(tx,ty)); }
  const direct=d<320&&losFree(v.x,v.y,tx,ty);
  if (direct&&!v.goal&&T.v&&T.a!=null){ const lead=Math.min(.6,d/500); tx+=Math.cos(T.a)*T.v*lead; ty+=Math.sin(T.a)*T.v*lead; }
  let gx=tx, gy=ty, turn=0; if (!direct&&v.route){ let i0=-1; for (let i=0;i<v.route.length;i++){ const [px,py]=v.route[i]; if (Math.hypot(px-v.x,py-v.y)>90){ i0=i; break; } }
      if (i0>=0){ gx=v.route[i0][0]; gy=v.route[i0][1]; const nx=v.route[Math.min(v.route.length-1,i0+2)]; const a1=Math.atan2(gy-v.y,gx-v.x), a2=Math.atan2(nx[1]-gy,nx[0]-gx); turn=Math.abs(Math.atan2(Math.sin(a2-a1),Math.cos(a2-a1))); } }
  let df=Math.atan2(gy-v.y,gx-v.x)-v.a; df=Math.atan2(Math.sin(df),Math.cos(df)); let thr=Math.abs(df)>1.3?.35:1, steer=Math.max(-1,Math.min(1,df*2.6)), brake=false;
  const sp=Math.abs(v.v); if ((Math.abs(df)>.55&&sp>230)||(turn>.9&&sp>260&&Math.hypot(gx-v.x,gy-v.y)<220)){ thr=0; brake=sp>200; }
  if (sp>60&&!v.rev){ const L=60+sp*.18, pr=a=>vehBlocked(v,v.x+Math.cos(a)*L,v.y+Math.sin(a)*L,a); if (pr(v.a)){ const l=pr(v.a-.6), r=pr(v.a+.6); steer=!l&&r?-1:l&&!r?1:(df<0?-1:1); if (l&&r){ thr=.2; brake=sp>140; } } }
  if (v.hunter&&!v.goal&&d>950&&offView(v.x,v.y,120)){ v.jumpT=(v.jumpT||0)+dt; if (v.jumpT>2.5){ v.jumpT=0; const p=roadSpotAway(T.x,T.y,520,760); if (p){ v.x=p.x; v.y=p.y; v.a=Math.atan2(T.y-p.y,T.x-p.x); v.v=180; v.sx=v.sy=0; v.route=null; v.aiT=0; } } }
  if (!jj.veh&&d<80&&!v.goal){ thr=0; brake=true; }
  if (Math.abs(v.v)<25&&thr>0) v.stuckT=(v.stuckT||0)+dt; else v.stuckT=0; if (v.stuckT>1){ v.rev=.9; v.stuckT=0; }
  if (v.rev>0){ v.rev-=dt; thr=-1; steer=-steer; }
  return {thr,steer,brake}; }

// ---------- world drawing ----------
const CREWLOOK={Luka:{hero:"luka",skin:"#c48a62",skinHi:"#d9a27c",shirt:"#1f5fd0",shirtHi:"#4f8fff",inner:"#f2f2f2",pants:"#1f2328",shoe:"#ffffff",hair:"#1a120c"},
  Yunus:{hero:"yunus",skin:"#b07a52",skinHi:"#c99470",shirt:"#5b34b0",shirtHi:"#8a62e6",inner:"#2a1f45",pants:"#2b2d33",shoe:"#e8e4dc",hair:"#0f0c0a"},
  Paul:{hero:"paul",skin:"#e8c09a",skinHi:"#f6d6b6",shirt:"#3f4b2f",shirtHi:"#5f6e46",inner:"#2a2f22",pants:"#26241e",shoe:"#3a2a20",hair:"#3b4330"},
  Mo:{hero:"marco",skin:"#d9a37c",skinHi:"#ecbd98",shirt:"#8a5a2b",shirtHi:"#b07a42",inner:"#efe4cf",pants:"#33302a",shoe:"#5a3a20",hair:"#2a1a10"},
  "Onkel Bobby":{hero:"earl",skin:"#6e4429",skinHi:"#8a5a3a",shirt:"#7c8f6a",shirtHi:"#9db08a",inner:"#e9e3d6",pants:"#4a3f33",shoe:"#2a2a2a",hair:"#d8d4cc"}};
function giverFree(x,y){ return npcFree(x,y,13)&&!palms.some(p=>Math.hypot(p.x-x,p.y-y)<74); }
function giverSpots(d){ if (d._gs) return d._gs; const g=d.giver||[]; const out=g.map(([n,dx,dy])=>{ let x=d.loc.x+dx, y=d.loc.y+dy;
    if (!giverFree(x,y)){ search: for (let r=12;r<220;r+=12) for (let k=0;k<16;k++){ const a=k/16*6.283, px=x+Math.cos(a)*r, py=y+Math.sin(a)*r; if (giverFree(px,py)){ x=px; y=py; break search; } } }
    return {n,x,y}; }); if (typeof vehicles!=="undefined"&&vehicles.length) d._gs=out; return out; }
function drawGivers(q,vis){ for (const L of LEAVERS) if (vis(L.x,L.y,60)){ drawPerson(q,L,CREWLOOK[L.n]||LOOKS[0]); tag(q,L.x,L.y-22,L.n.toUpperCase()); if (L.sayT>0) drawSay(q,L.x,L.y-32,L.say); }
  const list=[]; const d=nextDef();
  if (!MI&&d&&d.loc&&MS.done.m1) list.push(...giverSpots(d));
  if (MI&&MI.def.loc&&MI.def.giver&&MI.d.brief!==false){ const hide=new Set(); for (const a of allyList(MI)) hide.add(a.n); for (const f of (MI.figs||[])) hide.add(f.n); for (const w of (MI.walkers||[])) hide.add(w.n); const gs=giverSpots(MI.def).filter(g=>!hide.has(g.n)); if (!DLG&&!cardMode&&MI.t>1&&gs.every(g=>Math.hypot(g.x-jj.x,g.y-jj.y)>520)) MI.d.brief=false; else list.push(...gs); }
  if (MI&&MI.def.id==="m1"&&MI.step>=1) list.push({n:"Onkel Bobby",x:EARL.x,y:EARL.y});
  if (MI&&MI.figs) for (const f of MI.figs) if (!f.gone&&vis(f.x,f.y,60)){ drawPerson(q,f,CREWLOOK[f.n]||LOOKS[0],f.w?{weapon:f.w}:{}); tag(q,f.x,f.y-24,f.n.toUpperCase());
    if (f.bar>=0){ q.fillStyle="rgba(18,16,22,.85)"; rr(q,f.x-22,f.y-40,44,7,3); q.fill(); q.fillStyle="#7ee36a"; rr(q,f.x-21,f.y-39,42*Math.min(1,f.bar),5,2.5); q.fill(); if (f.lap){ q.fillStyle="#2b2f36"; q.fillRect(f.x+8,f.y+4,12,8); q.fillStyle="#58d0ff"; q.fillRect(f.x+9,f.y+5,10,5); } }
    if (f.sayT>0) drawSay(q,f.x,f.y-(f.bar>=0?44:32),f.say); }
  if (MI&&MI.walkers) for (const w of MI.walkers) if (!w.done&&!w.hide&&vis(w.x,w.y,40)){ drawPerson(q,w,CREWLOOK[w.n]||LOOKS[0]); tag(q,w.x,w.y-24,w.n.toUpperCase()); }
  for (const a of allyList(MI)){ if (a.inCar){ if (a.sayT>0&&a.car) drawSay(q,a.car.x,a.car.y-30,a.n+": "+a.say); continue; } if (vis(a.x,a.y,40)){ drawPerson(q,a,CREWLOOK[a.n]||LOOKS[0],{weapon:a.w||"pistol"}); tag(q,a.x,a.y-24,a.n.toUpperCase()); if (a.sayT>0) drawSay(q,a.x,a.y-34,a.say); } }
  for (const g of list){ if (!vis(g.x,g.y,40)) continue; const near=Math.hypot(jj.x-g.x,jj.y-g.y)<400, a=near?Math.atan2(jj.y-g.y,jj.x-g.x)-Math.PI/2:0;
    drawPerson(q,{x:g.x,y:g.y,ang:a,moving:false},CREWLOOK[g.n]||LOOKS[0]); tag(q,g.x,g.y-22,g.n.toUpperCase()); } }
function drawMissionWorld(q,vis,t){ if (typeof drawAct2World==="function") drawAct2World(q,vis,t); drawGivers(q,vis); if (!MI&&!cardMode){ const d=nextDef(); if (d&&d.loc&&MS.done.m1&&vis(d.loc.x,d.loc.y,60)){ const p=d.loc, pu=.5+Math.sin(t*3)*.5;
      const g0=(d.giver&&d.giver.length)?giverSpots(d)[0]:p, by=g0.y-44+Math.sin(t*3)*2.5;   // kleiner Punkt über dem Auftraggeber
      q.fillStyle="#ffd60a"; q.strokeStyle="#120f14"; q.lineWidth=2; q.beginPath(); q.arc(g0.x,by,5.5,0,7); q.fill(); q.stroke(); } }
  if (MI&&MI.park){ const P=MI.park, pu=.6+.4*Math.sin(performance.now()/180); q.save(); q.translate(P.x,P.y); q.rotate(P.a); q.setLineDash([7,5]); q.lineWidth=3; q.strokeStyle=P.ok?`rgba(126,227,106,${.7+.3*pu})`:`rgba(255,214,10,${.55+.35*pu})`; q.strokeRect(-P.l/2,-P.w/2,P.l,P.w); q.setLineDash([]); q.fillStyle=P.ok?"rgba(126,227,106,.18)":"rgba(255,214,10,.12)"; q.fillRect(-P.l/2,-P.w/2,P.l,P.w); q.fillStyle=P.ok?"#7ee36a":"#ffd60a"; q.font='400 20px "Bebas Neue",Impact,sans-serif'; q.textAlign="center"; q.textBaseline="middle"; q.rotate(-P.a); q.fillText("P",0,1); q.restore(); }
  if (MI&&MI.ring){ const R=MI.ring; q.strokeStyle="rgba(255,214,10,.35)"; q.lineWidth=5; q.beginPath(); q.arc(R.x,R.y,R.r,0,7); q.stroke(); q.strokeStyle="#ffd60a"; q.beginPath(); q.arc(R.x,R.y,R.r,-Math.PI/2,-Math.PI/2+R.f*6.283); q.stroke(); }
  if (MI&&MI.mark){ for (const m of MI.mark){ if (!vis(m.x,m.y,50)) continue; const by=m.y-26+Math.sin(t*4)*3; q.fillStyle="#ffd60a"; q.strokeStyle="#120f14"; q.lineWidth=2; q.beginPath(); q.moveTo(m.x,by+12); q.lineTo(m.x-8,by); q.lineTo(m.x+8,by); q.closePath(); q.fill(); q.stroke(); } }
  if (MI&&MI.bag&&!MI.bag.taken&&vis(MI.bag.x,MI.bag.y,30)){ const b=MI.bag; q.fillStyle="rgba(0,0,0,.3)"; q.fillRect(b.x-9,b.y-3,20,10); q.fillStyle="#6b4a2a"; rr(q,b.x-11,b.y-7,22,12,4); q.fill(); q.fillStyle="#3a2814"; q.fillRect(b.x-4,b.y-10,8,4); }
  for (const n of npcs) if (n.hostile&&!n.dead&&vis(n.x,n.y,40)){ q.fillStyle=n.cop?"#4a8cff":"#ff3b30"; q.beginPath(); q.moveTo(n.x,n.y-14); q.lineTo(n.x-5,n.y-21); q.lineTo(n.x+5,n.y-21); q.closePath(); q.fill(); } }
function missionPins(q,x,y,w,h,R){ const cur=nextDef(); MDEF.forEach((d,i)=>{ if (!d.loc||d!==cur||!MS.done.m1&&i>0||MI&&MI.def!==d) return; const px=x+d.loc.x/WW*w, py=y+d.loc.y/WH*h, done=MS.done[d.id], now=d===cur, run=MI&&MI.def===d;
    q.fillStyle=done?"#34c759":now?"#ffd60a":"rgba(140,140,150,.95)"; q.strokeStyle="#120f14"; q.lineWidth=R>6?2:1.5; q.beginPath(); q.arc(px,py,run?R+1.5:R,0,7); q.fill(); q.stroke();
    q.fillStyle="#120f14"; q.font=`700 ${Math.round(R*1.25)}px sans-serif`; q.textAlign="center"; q.textBaseline="middle"; q.fillText(done?"✓":String(i+1),px,py+.5);
    if (R>6){ q.font='700 11px "Barlow Semi Condensed",sans-serif'; q.lineWidth=3; q.strokeStyle="rgba(18,16,22,.85)"; const lbl=d.n; q.strokeText(lbl,px,py+R+10); q.fillStyle=done?"#bff5c8":now?"#ffd60a":"#c9c9cf"; q.fillText(lbl,px,py+R+10); } }); }
function drawMissionMini(q,x,y,w,h){ missionPins(q,x,y,w,h,5);
  for (const n of npcs) if (n.hostile&&!n.dead){ q.fillStyle=n.cop?"#4a8cff":"#ff3b30"; q.beginPath(); q.arc(x+n.x/WW*w,y+n.y/WH*h,2,0,7); q.fill(); }
  const bl=Math.floor(performance.now()/250)%2; for (const v of vehicles) if (v.cop&&!v.gone&&!v.wreck&&!v.leave){ q.fillStyle=bl?"#ff3b30":"#4a8cff"; q.beginPath(); q.arc(x+v.x/WW*w,y+v.y/WH*h,3,0,7); q.fill(); }
  if (WANT.heli&&!WANT.heli.leave){ q.fillStyle="#4a8cff"; q.beginPath(); q.arc(x+WANT.heli.x/WW*w,y+WANT.heli.y/WH*h,3.5,0,7); q.fill(); } }
// Crew-Mitglied kämpft mit: hält Abstand zum nächsten Gegner und schießt
// ---------- Wegfindung (A* auf 20-px-Raster) ----------
const walkable=(x,y)=>!inWater(x,y)&&!beyondShore(x,y,6)&&!npcSolid(x,y,11);
function walkLine(x0,y0,x1,y1){ const L=Math.hypot(x1-x0,y1-y0), n=Math.max(1,Math.ceil(L/12)); for (let k=1;k<=n;k++) if (!walkable(x0+(x1-x0)*k/n,y0+(y1-y0)*k/n)) return false; return true; }
function findPath(x0,y0,x1,y1){ if (walkLine(x0,y0,x1,y1)) return [{x:x1,y:y1}]; const C=20, mx=Math.min(x0,x1)-400, my=Math.min(y0,y1)-400, W2=Math.ceil((Math.max(x0,x1)+400-mx)/C), H2=Math.ceil((Math.max(y0,y1)+400-my)/C); if (W2*H2>60000) return null;
  const fr=new Int8Array(W2*H2).fill(-1), ok=(i,j)=>{ if (i<0||j<0||i>=W2||j>=H2) return false; const k=j*W2+i; if (fr[k]<0) fr[k]=walkable(mx+i*C+C/2,my+j*C+C/2)?1:0; return fr[k]===1; };
  const ci=x=>Math.floor((x-mx)/C), cj=y=>Math.floor((y-my)/C); let si=ci(x0), sj=cj(y0), gi=ci(x1), gj=cj(y1);
  const near=(i,j)=>{ if (ok(i,j)) return [i,j]; for (let r=1;r<6;r++) for (let a=-r;a<=r;a++) for (const [p,q] of [[i+a,j-r],[i+a,j+r],[i-r,j+a],[i+r,j+a]]) if (ok(p,q)) return [p,q]; return null; };
  const s0=near(si,sj), g0=near(gi,gj); if (!s0||!g0) return null; [si,sj]=s0; [gi,gj]=g0;
  const N=W2*H2, gs=new Float32Array(N).fill(1e9), from=new Int32Array(N).fill(-1), closed=new Uint8Array(N), heap=[]; const h=(i,j)=>Math.hypot(i-gi,j-gj);
  const push=(k,f)=>{ heap.push([f,k]); let c=heap.length-1; while (c>0){ const pa=(c-1)>>1; if (heap[pa][0]<=heap[c][0]) break; [heap[pa],heap[c]]=[heap[c],heap[pa]]; c=pa; } };
  const pop=()=>{ const top=heap[0], last=heap.pop(); if (heap.length){ heap[0]=last; let c=0; for(;;){ const l=2*c+1, r=l+1; let m=c; if (l<heap.length&&heap[l][0]<heap[m][0]) m=l; if (r<heap.length&&heap[r][0]<heap[m][0]) m=r; if (m===c) break; [heap[m],heap[c]]=[heap[c],heap[m]]; c=m; } } return top; };
  const sk=sj*W2+si, gk=gj*W2+gi; gs[sk]=0; push(sk,h(si,sj)); let found=false, it=0;
  while (heap.length&&it++<20000){ const [,k]=pop(); if (closed[k]) continue; closed[k]=1; if (k===gk){ found=true; break; } const i=k%W2, j=(k/W2)|0;
    for (const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){ const ni=i+di, nj=j+dj; if (!ok(ni,nj)) continue; if (di&&dj&&(!ok(i+di,j)||!ok(i,j+dj))) continue; const nk=nj*W2+ni, ng=gs[k]+(di&&dj?1.414:1); if (ng<gs[nk]){ gs[nk]=ng; from[nk]=k; push(nk,ng+h(ni,nj)); } } }
  if (!found) return null; const pts=[]; for (let k=gk;k!==-1&&k!==sk;k=from[k]) pts.push({x:mx+(k%W2)*C+C/2,y:my+((k/W2)|0)*C+C/2}); pts.reverse(); pts.push({x:x1,y:y1});
  const out=[]; let cx=x0, cy=y0, i=0; while (i<pts.length){ let j=pts.length-1; while (j>i&&!walkLine(cx,cy,pts[j].x,pts[j].y)) j--; out.push(pts[j]); cx=pts[j].x; cy=pts[j].y; i=j+1; } return out; }
// liefert die nächste Zwischenstation auf dem Weg zu (tx,ty); rechnet den Weg nur neu, wenn nötig
function navTo(o,tx,ty){ const T=o._nav; if (!T||Math.hypot(T.tx-tx,T.ty-ty)>60||T.t<=0||!T.path){ o._nav={tx,ty,t:1.2,path:walkLine(o.x,o.y,tx,ty)?[{x:tx,y:ty}]:(findPath(o.x,o.y,tx,ty)||[{x:tx,y:ty}])}; }
  const N=o._nav; while (N.path.length>1&&Math.hypot(N.path[0].x-o.x,N.path[0].y-o.y)<14) N.path.shift(); return N.path[0]; }
function navTick(dt){ for (const o of navUsers()) if (o._nav) o._nav.t-=dt; }
const navUsers=()=>[...allyList(MI),...((MI&&MI.figs)||[]),...((MI&&MI.walkers)||[])];
// ---------- Mitfahrer: Crew steigt erst ein, wenn JJ ein Auto hat, und erst aus, wenn JJ aussteigt ----------
const allyList=m=>m?(m.allies||(m.ally?[m.ally]:[])):[];
const SEATS=[[-.02,1],[-.3,-1],[-.3,1]];
function seatDoor(c,i,out){ const S=SEATS[i%3]; return vLocal(c,c.t.l*S[0],S[1]*(c.t.w/2+(out==null?11:out))); }
function exitRider(a){ const c=a.car; a.inCar=false; a.car=null; a.vx=a.vy=0; if (!c||c.wreck||c.gone){ const p=landNear(jj.x,jj.y); a.x=p.x; a.y=p.y; return; }
  const P=seatDoor(c,a.seat||0,2); if (blockedAt(P[0],P[1],6)){ const p=landNear(P[0],P[1]); a.x=p.x; a.y=p.y; } else { a.x=P[0]; a.y=P[1]; } a.hold=true; a.exitT=0; a.exitCar=c; c.door=1; c.doorSide=SEATS[(a.seat||0)%3][1]; c.doorClosing=false; sfx("door"); }
function updateRiders(m,dt){ const list=allyList(m), v=jj.veh, carOK=!!(v&&v.t.kind==="car"&&!v.wreck&&!JACK&&!v.driver&&jj.veh===v);
  for (const a of list) if (a.inCar&&(a.car.wreck||a.car.gone||jj.veh!==a.car&&!(a.stayIn&&!jj.veh))) exitRider(a);   // stayIn: wartet im Auto, solange JJ zu Fuß ist
  for (const a of list){ if (a.exitT==null) continue; const c=a.exitCar; a.exitT+=dt; const sd=SEATS[(a.seat||0)%3][1];
    if (a.exitT<.35&&c){ const nx=-Math.sin(c.a)*sd, ny=Math.cos(c.a)*sd, x=a.x+nx*60*dt, y=a.y+ny*60*dt; if (walkable(x,y)){ a.x=x; a.y=y; } a.moving=true; a.step+=dt*14; a.ang=Math.atan2(-nx,ny); } else if (c&&!c.doorClosing&&c.door>0) c.doorClosing=true;
    if (a.exitT>.5){ a.hold=false; a.exitT=null; } }
  if (m.noBoard){ for (const a of list) if (a.board){ a.board=null; a.hold=false; } return; }
  const used=new Set(list.filter(a=>a.inCar||a.board).map(a=>a.seat));
  for (const a of list){ if (a.inCar||a.exitT!=null) continue;
    if (a.board){ const c=a.board; if (!carOK||jj.veh!==c||Math.abs(c.v||0)>60){ a.board=null; a.hold=false; a.bt=0; if (c&&c.door>0) c.doorClosing=true; continue; }
      const P=seatDoor(c,a.seat), dx=P[0]-a.x, dy=P[1]-a.y, d=Math.hypot(dx,dy);
      if (d>5&&!a.bt){ const w=d>40?navTo(a,P[0],P[1]):{x:P[0],y:P[1]}, wx=w.x-a.x, wy=w.y-a.y, wd=Math.hypot(wx,wy)||1, sp=Math.min(wd,180*dt); a.x+=wx/wd*sp; a.y+=wy/wd*sp; a.moving=true; a.run=true; a.step+=dt*16; a.ang=Math.atan2(-wx/wd,wy/wd); continue; }
      a.moving=false; a.ang=Math.atan2(-(c.x-a.x),c.y-a.y); if (!a.bt) sfx("door"); a.bt=(a.bt||0)+dt; c.door=Math.min(1,a.bt/.3); c.doorSide=SEATS[a.seat%3][1]; c.doorClosing=false;
      if (a.bt>.3){ const S=vLocal(c,c.t.l*SEATS[a.seat%3][0],SEATS[a.seat%3][1]*c.t.w*.2); a.x+=(S[0]-a.x)*Math.min(1,dt*10); a.y+=(S[1]-a.y)*Math.min(1,dt*10); }
      if (a.bt>.6){ a.inCar=true; a.car=c; a.board=null; a.hold=false; a.bt=0; c.doorClosing=true; }
      continue; }
    if (carOK&&Math.abs(v.v||0)<60&&Math.hypot(a.x-v.x,a.y-v.y)<340){ let sI=0; while (used.has(sI)) sI++; if (sI>2) continue; used.add(sI); a.seat=sI; a.board=v; a.hold=true; a.bt=0; a._nav=null; } }
  if (v&&v.t.kind==="moto"&&list.some(a=>!a.inCar&&Math.hypot(a.x-v.x,a.y-v.y)<260)) allySay(list[0],"Mit 'nem Motorrad? Hol 'ne richtige Karre!",10);
}
function allySay(a,t,cd){ if ((a.sayCd||0)>0) return; a.say=t; a.sayT=2.6; a.sayCd=cd||7; }
function updateAlly(a,dt){ MI.lastAlly=a; if (a.sayT>0) a.sayT-=dt; if (a.sayCd>0) a.sayCd-=dt; if (a.inCar||a.hold){ a.vx=0; a.vy=0; return; } let T=null, td=1e9; for (const n of (MI.foes||[])) if (!n.dead){ const d=Math.hypot(n.x-a.x,n.y-a.y); if (d<td){ td=d; T=n; } }
  // JJs Bewegung schätzen (für eine flüssige Folge-Position)
  const src=jj.veh||jj, jp=a._jp||{x:src.x,y:src.y}, jvx=(src.x-jp.x)/Math.max(dt,1e-3), jvy=(src.y-jp.y)/Math.max(dt,1e-3); a._jp={x:src.x,y:src.y}; const js=Math.hypot(jvx,jvy);
  if (js>25){ a._dir={x:jvx/js,y:jvy/js}; } const dir=a._dir||{x:-Math.sin(jj.ang),y:Math.cos(jj.ang)};
  const tx=T?T.x:jj.x, ty=T?T.y:jj.y, d=Math.hypot(tx-a.x,ty-a.y);
  let dvx=0, dvy=0;
  if (T){ const ux=(tx-a.x)/(d||1), uy=(ty-a.y)/(d||1); if (d>170){ const w=walkLine(a.x,a.y,tx,ty)?{x:tx,y:ty}:navTo(a,tx,ty), wx=w.x-a.x, wy=w.y-a.y, wd=Math.hypot(wx,wy)||1; dvx=wx/wd*150; dvy=wy/wd*150; } else if (d<80){ dvx=-ux*120; dvy=-uy*120; } else { dvx=-uy*40; dvy=ux*40; } }
  else if (jj.veh&&jj.veh.t.kind!=="heli"){ const v=jj.veh, vs=Math.abs(v.v||0); if (d>90){ const w=navTo(a,tx,ty), wx=w.x-a.x, wy=w.y-a.y, wd=Math.hypot(wx,wy)||1, sp=Math.min(185,d*1.6); dvx=wx/wd*sp; dvy=wy/wd*sp; }
    if (vs>140&&d>200) allySay(a,"Ey! Wartet auf mich!"); else if (vs<20&&d>280){ a._wait=(a._wait||0)+dt; if (a._wait>2.5) allySay(a,"Worauf wartest du? Komm her!"); } else a._wait=0; }
  else { // Platz schräg hinter JJ – läuft nach dem Stehenbleiben noch weich aus
    if (js>25||!a._slot){ const px=-dir.y, py=dir.x, L=allyList(MI), i=Math.max(0,L.indexOf(a)), S=[[70,38],[70,-38],[125,0],[125,52]][i%4]; a._slot={x:jj.x-dir.x*S[0]+px*S[1],y:jj.y-dir.y*S[0]+py*S[1]}; }
    let gx=a._slot.x, gy=a._slot.y; if (!walkable(gx,gy)){ gx=jj.x; gy=jj.y; } const sd0=Math.hypot(gx-a.x,gy-a.y); if (sd0>70&&!walkLine(a.x,a.y,gx,gy)){ const w=navTo(a,gx,gy); gx=w.x; gy=w.y; }
    const sx=gx-a.x, sy=gy-a.y, sd=Math.hypot(sx,sy); if (sd>10){ const cap=sd>320?235:sd>180?185:150, sp=Math.min(cap,Math.max(sd0,sd)*1.7+js*.35); dvx=sx/sd*sp; dvy=sy/sd*sp; }
    // Abstand halten: nicht in JJ und nicht in den anderen Jungs stehen
    for (const o of allyList(MI)){ if (o===a||o.inCar) continue; const ox=a.x-o.x, oy=a.y-o.y, od=Math.hypot(ox,oy); if (od<46&&od>0.1){ const k=(46-od)*3.2; dvx+=ox/od*k; dvy+=oy/od*k; } }
    { const ox=a.x-jj.x, oy=a.y-jj.y, od=Math.hypot(ox,oy); if (od<40&&od>0.1){ const k=(40-od)*3.5; dvx+=ox/od*k; dvy+=oy/od*k; } } }
  const k=Math.min(1,dt*(T?7:5)); a.vx=(a.vx||0)+(dvx-(a.vx||0))*k; a.vy=(a.vy||0)+(dvy-(a.vy||0))*k;
  const vsp=Math.hypot(a.vx,a.vy); a.moving=false;
  if (vsp>8){ const base=Math.atan2(a.vy,a.vx); for (const off of [0,.5,-.5,1,-1,1.5,-1.5]){ const x=a.x+Math.cos(base+off)*vsp*dt, y=a.y+Math.sin(base+off)*vsp*dt; if (npcFree(x,y,10)){ a.x=x; a.y=y; break; } }
    a.moving=vsp>18; a.run=vsp>140; a.step+=dt*vsp/10; }
  const face=T||!a.moving?Math.atan2(-(tx-a.x),ty-a.y):Math.atan2(-a.vx,a.vy); let da=face-(a.ang||0); da=Math.atan2(Math.sin(da),Math.cos(da)); a.ang=(a.ang||0)+da*Math.min(1,dt*10);
  a.cd-=dt; if (T&&a.cd<=0&&d<(a.pro?390:330)&&(!INROOM||!CURSOL.some(r=>{ const mx=(a.x+T.x)/2, my=(a.y+T.y)/2; return mx>r.x&&mx<r.x+r.w&&my>r.y&&my<r.y+r.h; }))){ a.cd=(a.pro?.7:1.6)+rnd()*(a.pro?.5:.9); const hit=rnd()<(a.pro?.86:.6), ex=T.x+(hit?0:(rnd()-.5)*40), ey=T.y+(hit?0:(rnd()-.5)*40); const fa=Math.atan2(ey-a.y,ex-a.x);
    tracers.push({x1:a.x+Math.cos(fa)*16,y1:a.y+Math.sin(fa)*16,x2:ex,y2:ey,t:.12}); emit("flash",a.x+Math.cos(fa)*16,a.y+Math.sin(fa)*16,{size:34,life:.07,max:.07}); sfx("shot"); scareNpcs(a.x,a.y,400);
    if (hit){ T.hits=(T.hits||0)+1; if (T.hits>=(a.pro?2:3)) killBy=a, killNpc(T,Math.cos(fa)*220,Math.sin(fa)*220); else { T.x+=Math.cos(fa)*8; T.y+=Math.sin(fa)*8; } } } }
function walkTo(m,name,x,y,tx,ty,cb){ (m.walkers||(m.walkers=[])).push({n:name,x,y,tx,ty,ang:0,step:0,moving:true,done:false,cb}); }
function updateWalkers(m,dt){ for (const w of m.walkers||[]){ if (w.done) continue; const tx=typeof w.tx==="function"?w.tx():w.tx, ty=typeof w.ty==="function"?w.ty():w.ty, dx=tx-w.x, dy=ty-w.y, d=Math.hypot(dx,dy);
    if (d<5){ w.done=true; w.moving=false; w.cb&&w.cb(); continue; } const nw=d>30?navTo(w,tx,ty):{x:tx,y:ty}, nx=nw.x-w.x, ny=nw.y-w.y, nd=Math.hypot(nx,ny)||1, sp=Math.min(nd,150*dt); w.x+=nx/nd*sp; w.y+=ny/nd*sp; w.ang=Math.atan2(-nx/nd,ny/nd); w.step+=dt*15; } }
function fig(m,n,x,y,o){ const f=Object.assign({n,x,y,tx:x,ty:y,ang:0,step:0,moving:false,bar:-1,say:"",sayT:0,w:null,gone:false},o||{}); (m.figs||(m.figs=[])).push(f); return f; }
function figSay(f,t){ f.say=t; f.sayT=2.8; }
function updateFigs(m,dt){ for (const f of m.figs){ if (f.gone) continue; f.sayT-=dt; const dx=f.tx-f.x, dy=f.ty-f.y, d=Math.hypot(dx,dy);
    if (d>4){ const nw=d>30?navTo(f,f.tx,f.ty):{x:f.tx,y:f.ty}, nx=nw.x-f.x, ny=nw.y-f.y, nd=Math.hypot(nx,ny)||1, sp=Math.min(nd,(f.sp||150)*dt); f.x+=nx/nd*sp; f.y+=ny/nd*sp; f.ang=Math.atan2(-nx/nd,ny/nd); f.moving=true; f.step+=dt*15; }
    else { f.moving=false; if (f.arrive){ const cb=f.arrive; f.arrive=null; cb(); } if (f.face) f.ang=Math.atan2(-(f.face.x-f.x),f.face.y-f.y); } } }
function updateMissions(dt){ if (paused) return; updateLeavers(dt); if (MI&&MI.figs) updateFigs(MI,dt);
  if (MI){ MI.t+=dt; if (jj.dead){ failMission("Du bist gestorben."); return; } navTick(dt); for (const a of allyList(MI)) updateAlly(a,dt); if (MI.ride) updateRiders(MI,dt); if (MI.walkers) updateWalkers(MI,dt); MI.def.tick(MI,dt); return; }
  checkFail(); const d=nextDef(); if (LEAD===undefined&&d){ LEAD=d.id; renderObj(); } if (!d||!d.loc||!MS.done.m1||jj.dead||LEAD!==d.id){ if (gps&&gps.next) gps=null; return; }
  if (!gps||gps.next) gps={n:d.n,x:d.loc.x,y:d.loc.y,next:true};
}

