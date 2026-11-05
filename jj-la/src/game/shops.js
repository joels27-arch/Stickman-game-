// ---------- gun shop ----------
let shopOpen=false, shopArmed=true, nearShop=false;
function armsOpen(){ return !!(MS.done.m2||MI&&MI.def.id==="m2"&&MI.step>=1); }
function clothesOpen(){ return armsOpen(); }
function ricoOpen(){ return !!(MS.done.m8||MI&&(MI.def.id==="m10"||MI.def.id==="m12")); }
const SHOPITEMS_=[{id:"bat",n:"Baseballschläger",d:"Nahkampf. Ein Schlag reicht.",p:150,icon:"bat",lock:"bat"},
  {id:"shotgun",n:"Schrotflinte",d:"8 Schuss, breite Streuung.",p:800,icon:"shotgun",lock:"shotgun",ammo:{n:16,p:120,l:"Patronen"},start:16},
  {id:"scar",n:"SCAR",d:"Sturmgewehr. Feuert 3er-Salven, große Reichweite.",p:1600,icon:"scar",lock:"scar",ammo:{n:60,p:150,l:"Schuss"},start:60},
  {id:"gl",n:"Granatwerfer",d:"Granaten im Bogen – sprengen alles in der Nähe.",p:3000,icon:"gl",lock:"gl",ammo:{n:6,p:350,l:"Granaten"},start:6},
  {id:"rpg",n:"Raketenwerfer",d:"Sprengt Autos und Helis.",p:2500,icon:"rpg",lock:"rpg",ammo:{n:2,p:400,l:"Raketen"},start:2},
  {id:"alien",n:"Alien-Blaster",d:"Grüner Energiestrahl. Geht durch mehrere Gegner.",p:5000,icon:"alien",lock:"alien",ammo:{n:12,p:300,l:"Energiezellen"},start:12}];
const SHOPITEMS=SHOPITEMS_.slice().sort((a,b)=>a.p-b.p);
function openShop(){ shopOpen=true; shopArmed=false; closePhone(); $("shop").hidden=false; renderShop(); sfx("door"); }
function closeShop(){ shopOpen=false; $("shop").hidden=true; }
function renderShop(){ $("sCash").textContent="Bar $"+cash.toLocaleString("en-US")+" · Karte $"+BANK.toLocaleString("en-US");
  $("sGrid").innerHTML=SHOPITEMS.map(it=>{ const owned=W.own[it.id], locked=!owned&&!UNLOCK[it.lock];
    const lbl=owned?"GEKAUFT":locked?"GESPERRT":!canPay(it.p)?"ZU TEUER":"KAUFEN";
    const am=it.ammo&&owned?`<div class="row2 amr"><span class="pr">Munition: ${W.mag[it.id]+W.res[it.id]} ${it.ammo.l}</span><button data-ammo="${it.id}" ${!canPay(it.ammo.p)?"disabled":""}>+${it.ammo.n} · $${it.ammo.p}</button></div>`:"";
    return `<div class="sit"><img src="${WICON[it.icon]}" alt=""><b>${it.n}</b><small>${locked?"Wird in einer Mission freigeschaltet.":it.d}</small><div class="row2"><span class="pr">$${it.p.toLocaleString("en-US")}</span><button data-buy="${it.id}" ${owned||locked||!canPay(it.p)?"disabled":""}>${lbl}</button></div>${am}</div>`; }).join(""); }
$("sGrid").addEventListener("click",e=>{ const ba=e.target.closest("button[data-ammo]"); if (ba){ const it=SHOPITEMS.find(i=>i.id===ba.dataset.ammo); if (!it||!canPay(it.ammo.p)) return; pay(it.ammo.p); W.res[it.id]+=it.ammo.n; sfx("reload"); hudDirty=true; saveGame(); renderShop(); return; }
  const b=e.target.closest("button[data-buy]"); if (!b) return; const it=SHOPITEMS.find(i=>i.id===b.dataset.buy); if (!it||!canPay(it.p)||W.own[it.id]||!UNLOCK[it.lock]) return; pay(it.p); sfx("reload"); W.own[it.id]=true;
  if (MAGSZ[it.id]){ W.mag[it.id]=MAGSZ[it.id]; W.res[it.id]+=it.start||0; } setWeapon(it.id); hudDirty=true; saveGame(); renderShop(); });
$("sClose").addEventListener("click",closeShop); $("shop").addEventListener("pointerdown",e=>{ if (e.target===$("shop")) closeShop(); });


// ================= Schloss knacken: geparkte Autos sind abgeschlossen =================
let PICK=null;
function needsPick(v){ if (!v||v.driver||v.unlocked||v.mine||v.t.kind!=="car"||v.chauffeur||v.noBoard) return false; if (MI&&MI.d&&Object.values(MI.d).includes(v)) return false; if (RIDE&&RIDE.car===v) return false; return true; }
function pickHint(){ const en=LANG==="en"; return PAD.on?(en?padGlyph("x")+" when the pin is in the green · "+padGlyph("o")+" cancel":padGlyph("x")+" drücken, wenn der Stift im Grünen ist · "+padGlyph("o")+" abbrechen"):touch?(en?"Tap when the pin is in the green":"Tippen, wenn der Stift im Grünen ist"):(en?"Space / E when the pin is in the green · Esc cancel":"Leertaste / E, wenn der Stift im Grünen ist · Esc abbrechen"); }
function pickZone(){ const w=PICK.n===0?.22:PICK.n===1?.17:.13; PICK.zw=w; PICK.z0=.08+rnd()*(.84-w); $("pkZone").style.left=(PICK.z0*100)+"%"; $("pkZone").style.width=(w*100)+"%"; }
function pickPins(){ $("pkPins").innerHTML=[0,1,2].map(i=>`<i class="${i<PICK.n?"ok":""}"></i>`).join(""); }
function openPick(v){ if (!v.mgType) v.mgType=["lock","wire","glass","hack","slim"][Math.floor(rnd()*5)]; if (v.mgType!=="lock"){ openMG(v,v.mgType); return; } PICK={v,n:0,x:0,dir:1,sp:.75,miss:0,last:performance.now(),done:false}; $("pick").hidden=false; $("pkHint").innerHTML=pickHint(); pickPins(); pickZone(); sfx("door"); requestAnimationFrame(pickLoop); }
function closePick(ok){ if (!PICK) return; const v=PICK.v; PICK=null; $("pick").hidden=true; $("mg").hidden=true; $("mgCtl").innerHTML=""; if (ok){ v.unlocked=true; toast(LANG==="en"?"🔓 Unlocked":"🔓 Geknackt"); skAdd&&skAdd("drive",.5); } }
function pickLoop(now){ if (!PICK) return; const dt=Math.min(.05,(now-PICK.last)/1000); PICK.last=now; if (!paused){ PICK.x+=PICK.dir*PICK.sp*dt; if (PICK.x>1){ PICK.x=1; PICK.dir=-1; } if (PICK.x<0){ PICK.x=0; PICK.dir=1; } }
  $("pkNeedle").style.left=(PICK.x*100)+"%"; requestAnimationFrame(pickLoop); }
function pickTap(){ if (!PICK||PICK.done) return; const P=PICK; if (P.mg){ if (P.mg==="slim") P.down=true; else mgTap(null); return; }
  if (P.x>=P.z0-.01&&P.x<=P.z0+P.zw+.01){ P.n++; sfx("reload"); pickPins(); if (P.n>=3){ P.done=true; setTimeout(()=>closePick(true),180); return; } P.sp*=1.3; pickZone(); }
  else { P.miss++; sfx("hit"); const b=$("pkBar"); b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake");
    if (P.miss>=2){ P.done=true; const v=P.v; v.alarmT=6; toast(LANG==="en"?"🚨 Car alarm! Try again":"🚨 Alarmanlage! Nochmal versuchen"); crime(.6,LANG==="en"?"Car alarm":"Autoalarm"); sfx("crash"); setTimeout(()=>{ if (PICK&&PICK.v===v){ PICK.n=0; PICK.miss=0; PICK.sp=.75; PICK.done=false; pickPins(); pickZone(); } },700); } } }
$("pick").addEventListener("pointerdown",e=>{ e.preventDefault(); e.stopPropagation(); if (e.target.id==="pkX"){ closePick(false); return; } pickTap(); });
addEventListener("keydown",e=>{ if (!PICK) return; if (["Space","Enter","KeyE"].includes(e.code)){ e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) pickTap(); } else if (e.code==="Escape"){ e.preventDefault(); e.stopImmediatePropagation(); closePick(false); } },true);
// ---- weitere Autoklau-Minigames (zufällig pro geparktem Auto) ----
const MGC=()=>$("mgC"), MGW=360, MGH=170;
function mgAlarm(){ const P=PICK; if (!P) return; const v=P.v; v.alarmT=6; toast(LANG==="en"?"🚨 Car alarm!":"🚨 Alarmanlage!"); crime(.6,LANG==="en"?"Car alarm":"Autoalarm"); sfx("crash"); }
function mgWin(msg){ const P=PICK; if (!P||P.done) return; P.done=true; sfx("reload"); if (msg) toast(msg); setTimeout(()=>closePick(true),260); }
function openMG(v,type){ const en=LANG==="en"; PICK={v,mg:type,t:0,last:performance.now(),done:false,miss:0}; const P=PICK; $("mg").hidden=false; $("mgCtl").innerHTML="";
  const T={wire:["KURZSCHLIESSEN","HOTWIRE"],glass:["SCHEIBE EINSCHLAGEN","SMASH THE WINDOW"],hack:["FUNKSCHLÜSSEL HACKEN","HACK THE KEY FOB"],slim:["SLIM JIM","SLIM JIM"]}[type];
  const H={wire:["Tippe ein Kabel links, dann die gleiche Farbe rechts – bevor der Alarm losgeht","Tap a wire on the left, then the same colour on the right – before the alarm"],glass:["Tippe, wenn der Ring genau auf dem grünen Kreis ist","Tap when the ring is exactly on the green circle"],hack:["Schieb die Regler, bis deine Welle über dem Signal liegt","Move the sliders until your wave matches the signal"],slim:["Halte gedrückt und lass im grünen Bereich los","Hold and release in the green zone"]}[type];
  $("mgT").textContent=en?T[1]:T[0]; $("mgH").textContent=en?H[1]:H[0];
  if (type==="wire"){ const cols=["#e23b3b","#2f8cff","#ffd23f","#3fbf5a"], R=[0,1,2,3].sort(()=>rnd()-.5); P.L=cols.map((c,i)=>({c,y:28+i*38})); P.R=R.map((k,i)=>({c:cols[k],y:28+i*38})); P.sel=-1; P.done4=[]; P.time=9; }
  if (type==="glass"){ P.r=110; P.dir=-1; P.sp=95; }
  if (type==="hack"){ P.tf=.25+rnd()*.5; P.ta=.3+rnd()*.5; P.f=rnd()<.5?.05:.95; P.a=rnd()<.5?.05:.95; P.hold=0;
    $("mgCtl").innerHTML=`<label>${en?"FREQUENCY":"FREQUENZ"}<input id="mgF" type="range" min="0" max="1000" value="${P.f*1000|0}"></label><label>${en?"STRENGTH":"STÄRKE"}<input id="mgA" type="range" min="0" max="1000" value="${P.a*1000|0}"></label>`;
    $("mgF").addEventListener("input",e=>{ if (PICK) PICK.f=e.target.value/1000; }); $("mgA").addEventListener("input",e=>{ if (PICK) PICK.a=e.target.value/1000; }); }
  if (type==="slim"){ P.dep=0; P.down=false; P.z0=.45+rnd()*.3; P.zw=.14; }
  sfx("door"); requestAnimationFrame(mgLoop); }
function mgLoop(now){ const P=PICK; if (!P||!P.mg) return; const dt=Math.min(.05,(now-P.last)/1000); P.last=now; if (!paused&&!P.done){ P.t+=dt;
    if (P.mg==="wire"){ P.time-=dt; if (P.time<=0){ mgAlarm(); P.time=9; P.done4=[]; P.sel=-1; } }
    if (P.mg==="glass"){ P.r+=P.dir*P.sp*dt; if (P.r<10){ P.r=10; P.dir=1; } if (P.r>110){ P.r=110; P.dir=-1; } }
    if (P.mg==="hack"){ const m=1-Math.min(1,(Math.abs(P.f-P.tf)+Math.abs(P.a-P.ta))*1.6); P.match=m; if (m>.9){ P.hold+=dt; if (P.hold>.8) mgWin(LANG==="en"?"📡 Signal cloned":"📡 Signal geklont"); } else P.hold=Math.max(0,P.hold-dt); }
    if (P.mg==="slim"){ if (P.down){ P.dep+=dt*.55; if (P.dep>1){ P.dep=0; P.down=false; P.miss++; sfx("hit"); if (P.miss>=2){ mgAlarm(); P.miss=0; } } } } }
  mgDraw(); requestAnimationFrame(mgLoop); }
function mgDraw(){ const P=PICK, c=MGC(), q=c.getContext("2d"); q.setTransform(c.width/MGW,0,0,c.height/MGH,0,0); q.clearRect(0,0,MGW,MGH); q.lineCap="round";
  const txt=(t,x,y,col,sz)=>{ q.fillStyle=col; q.font=`700 ${sz||12}px "Barlow Semi Condensed",sans-serif`; q.textAlign="center"; q.textBaseline="middle"; q.fillText(t,x,y); };
  if (P.mg==="wire"){ q.fillStyle="#1d1c22"; rr(q,40,8,280,154,12); q.fill();
    for (const k of P.done4){ const a=P.L[k], b=P.R.find(r=>r.c===a.c); q.strokeStyle=a.c; q.lineWidth=7; q.beginPath(); q.moveTo(70,a.y); q.bezierCurveTo(180,a.y,180,b.y,290,b.y); q.stroke(); }
    P.L.forEach((n,i)=>{ q.fillStyle=n.c; q.beginPath(); q.arc(70,n.y,i===P.sel?12:9,0,7); q.fill(); if (i===P.sel){ q.strokeStyle="#fff"; q.lineWidth=2; q.stroke(); } q.fillRect(50,n.y-3,20,6); });
    P.R.forEach(n=>{ q.fillStyle=n.c; q.beginPath(); q.arc(290,n.y,9,0,7); q.fill(); q.fillRect(290,n.y-3,20,6); });
    q.fillStyle="#2a2730"; q.fillRect(8,10,10,150); const f=Math.max(0,P.time/9); q.fillStyle=f<.35?"#ff5a3d":"#ffb347"; q.fillRect(8,10+150*(1-f),10,150*f); }
  if (P.mg==="glass"){ q.fillStyle="#2e4357"; rr(q,60,10,240,150,26); q.fill(); q.fillStyle="rgba(140,190,230,.35)"; rr(q,72,20,216,130,20); q.fill();
    q.strokeStyle="#7ee36a"; q.lineWidth=6; q.beginPath(); q.arc(180,85,34,0,7); q.stroke(); q.strokeStyle="#ffb347"; q.lineWidth=4; q.setLineDash([8,6]); q.beginPath(); q.arc(180,85,P.r,0,7); q.stroke(); q.setLineDash([]); txt("👊",180,86,"#fff",24); }
  if (P.mg==="hack"){ q.fillStyle="#0c1a14"; rr(q,10,8,340,154,10); q.fill(); const wave=(f,a,col,w)=>{ q.strokeStyle=col; q.lineWidth=w; q.beginPath(); for (let x=0;x<=320;x+=4){ const y=85+Math.sin(x*(.02+f*.09)+P.t*3)*(10+a*55); x?q.lineTo(20+x,y):q.moveTo(20,y); } q.stroke(); };
    wave(P.tf,P.ta,"#3fbf5a",4); wave(P.f,P.a,"#ffb347",2.5); txt(Math.round((P.match||0)*100)+" %",320,24,(P.match||0)>.9?"#7ee36a":"#cbbfa8",16); }
  if (P.mg==="slim"){ q.fillStyle="#8a1f24"; rr(q,90,6,180,158,14); q.fill(); q.fillStyle="#2e4357"; rr(q,100,14,160,56,10); q.fill(); q.fillStyle="#5a1418"; q.fillRect(100,76,160,82);
    const Y=y=>76+y*80; q.fillStyle="rgba(126,227,106,.3)"; q.fillRect(150,Y(P.z0),80,P.zw*80); q.strokeStyle="#7ee36a"; q.lineWidth=1.5; q.strokeRect(150,Y(P.z0),80,P.zw*80);
    q.fillStyle="#c9c4b8"; q.fillRect(118,Y(P.z0+P.zw/2)-2,100,4); q.fillStyle="#d8dbe0"; q.fillRect(196,20,8,Y(P.dep)-20); q.fillRect(188,Y(P.dep)-4,16,6);
    txt(PICK.down?(LANG==="en"?"RELEASE IN GREEN":"IM GRÜNEN LOSLASSEN"):(LANG==="en"?"HOLD":"HALTEN"),50,85,"#ffb347",13); } }
function mgTap(e){ const P=PICK; if (!P||!P.mg||P.done) return; let x=180, y=85; if (e){ const r=MGC().getBoundingClientRect(); x=(e.clientX-r.left)/r.width*MGW; y=(e.clientY-r.top)/r.height*MGH; }
  if (P.mg==="wire"){ if (x<130){ let bi=-1, bd=30; P.L.forEach((n,i)=>{ const d=Math.abs(n.y-y); if (d<bd&&!P.done4.includes(i)){ bd=d; bi=i; } }); if (bi>=0){ P.sel=bi; sfx("swing"); } }
    else if (x>230&&P.sel>=0){ let bj=null, bd=30; for (const n of P.R){ const d=Math.abs(n.y-y); if (d<bd){ bd=d; bj=n; } } if (bj){ if (bj.c===P.L[P.sel].c){ P.done4.push(P.sel); P.sel=-1; sfx("ping"); if (P.done4.length>=4) mgWin(LANG==="en"?"⚡ Engine running":"⚡ Motor läuft"); } else { P.time-=1.5; P.sel=-1; sfx("hit"); for (let k=0;k<4;k++) emit("spark",jj.x,jj.y,{vx:(rnd()-.5)*160,vy:(rnd()-.5)*160,life:.25,max:.25}); } } } }
  if (P.mg==="glass"){ const ok=Math.abs(P.r-34)<9; if (ok) mgWin(LANG==="en"?"🤫 Quietly in":"🤫 Leise drin"); else { mgAlarm(); mgWin(LANG==="en"?"💥 Glass shattered – loud!":"💥 Scheibe kaputt – laut!"); } } }
function mgDown(e){ const P=PICK; if (!P||!P.mg) return; if (P.mg==="slim"){ if (!P.done){ P.down=true; P.dep=Math.max(P.dep,0); } return; } if (P.mg!=="hack") mgTap(e); }
function mgUp(){ const P=PICK; if (!P||P.mg!=="slim"||!P.down||P.done) return; P.down=false; if (P.dep>=P.z0&&P.dep<=P.z0+P.zw) mgWin(LANG==="en"?"🔓 Lock rod grabbed":"🔓 Verriegelung gegriffen"); else { P.miss++; sfx("hit"); P.dep=0; if (P.miss>=2){ mgAlarm(); P.miss=0; } } }
$("mg").addEventListener("pointerdown",e=>{ if (e.target.closest("#mgCtl")) return; e.preventDefault(); e.stopPropagation(); if (e.target.id==="mgX"){ closePick(false); return; } mgDown(e); });
addEventListener("pointerup",mgUp); addEventListener("pointercancel",mgUp);
addEventListener("keydown",e=>{ if (PICK&&PICK.mg==="slim"&&(e.code==="Space"||e.code==="KeyE")&&!e.repeat){ PICK.down=true; } },true);
addEventListener("keyup",e=>{ if (PICK&&PICK.mg==="slim"&&(e.code==="Space"||e.code==="KeyE")) mgUp(); });
// ================= RICO'S: Klamotten & Autos kaufen =================
const OWN_OUT=["std"], OWN_CARS=[];
const OUT_PRICE={std:0,cap:150,bean:200,sun:350,buck:500,hood:450,gold:1500,camo:900};
const RICO_CARS=[{id:"moto",type:"moto",col:"#c8302a",p:3000,d:"Wendig, schnell, passt durch jede Lücke."},{id:"sedan",type:"sedan",col:"#2f5e8c",p:4500,d:"Unauffällig. Perfekt, wenn die Cops suchen."},{id:"pickup",type:"pickup",col:"#3d4a3a",p:6500,d:"Robust. Steckt Rammstöße gut weg."},{id:"suv",type:"suv",col:"#141519",p:9000,d:"Schwer und stabil. Viel HP."},{id:"sports",type:"sports",col:"#ffd23f",p:18000,d:"Hängt fast alles ab."},{id:"racer",type:"racer",col:"#ff5a1f",p:35000,d:"Rennwagen. Das Schnellste auf vier Rädern."}];
let ricoTab="o", ricoIcons={};
function ricoSpot(i,home){ if (home) return {x:10400+(i%3)*55,y:948,a:0}; return {x:i%2?GARAGE.x+GARAGE.w-42:GARAGE.x+42,y:2672,a:0}; }
function spawnOwnedCar(c,i,home){ const r=RICO_CARS.find(x=>x.id===c.id); if (!r) return null; let sp=ricoSpot(i,home); for (let k=0;k<2;k++){ const q=ricoSpot(i+k,home); if (!vehicles.some(v=>!v.gone&&Math.hypot(v.x-q.x,v.y-q.y)<45)){ sp=q; break; } } const v=addVeh(r.type,sp.x,sp.y,sp.a,c.col||r.col,{keep:true,mine:true}); return v; }
function ricoIcon(k){ if (ricoIcons[k]!=null) return ricoIcons[k]; let url=""; try{
    if (k[0]==="c"){ const r=RICO_CARS.find(x=>x.id===k.slice(1)); const sp=carSprite(r.type,r.col); const c=document.createElement("canvas"); c.width=sp.height; c.height=sp.width; const q=c.getContext("2d"); q.translate(c.width/2,c.height/2); q.rotate(-Math.PI/2); q.drawImage(sp,-sp.width/2,-sp.height/2); url=c.toDataURL(); }
    else url=wheelIcon(+k.slice(1),"o")||""; }catch(e){ url=""; } return ricoIcons[k]=url; }
function openRico(k){ ricoTab=k==="c"?"c":"o"; const sh=$("ricoShop"); sh.querySelector(".rtabs").style.display="none"; sh.querySelector(".shd b").textContent=ricoTab==="c"?"RICO'S AUTOS":"DRIP STORE"; sh.querySelector(".shd span").textContent=ricoTab==="c"?L2("Autohändler","Car dealer"):L2("Klamotten & Looks","Clothes & looks"); closePhone(); sh.hidden=false; renderRico(); sfx("door"); paused=true; }
function closeRico(){ $("ricoShop").hidden=true; paused=false; }
function renderRico(){ $("rCash").textContent="$"+(cash+BANK).toLocaleString("en-US"); document.querySelectorAll("#ricoShop .rtabs button").forEach(b=>b.classList.toggle("on",b.dataset.rt===ricoTab));
  const card=(img,emo,n,d,price,btn,dis,cls,data)=>`<div class="sit">${img?`<img src="${img}" alt="">`:`<div style="font-size:34px;text-align:center">${emo}</div>`}<b>${n}</b><small>${d}</small><div class="row2"><span class="pr">${price}</span><button ${data} class="${cls||""}" ${dis?"disabled":""}>${btn}</button></div></div>`;
  if (ricoTab==="o") $("rGrid").innerHTML=OUTFITS.map((o,i)=>{ const own=OWN_OUT.includes(o.id), cur=OUTFIT===i, pr=OUT_PRICE[o.id]||300;
      return card(ricoIcon("o"+i),"👕",tr(o.n),own?(cur?"Trägst du gerade.":"Gehört dir. Auch über das Outfit-Rad wählbar."):"Neuer Look – hilft auch, die Cops abzuschütteln.",own?"✓":"$"+pr.toLocaleString("en-US"),own?(cur?"AN":"ANZIEHEN"):canPay(pr)?"KAUFEN":"ZU TEUER",cur||(!own&&!canPay(pr)),own?"eq":"",`data-ro="${i}"`); }).join("");
  else if (!MS.done.m12&&!(MI&&MI.def.id==="m12"&&MI.step>=4)) $("rGrid").innerHTML=`<div class="sit" style="grid-column:1/-1"><b>${L2("🔒 Noch keine Autos","🔒 No cars yet")}</b><small>${L2("Rico verkauft dir erst Autos, wenn ihr die Fluchtwagen besorgt habt.","Rico sells you cars once you have secured the getaway cars.")}</small></div>`;
  else $("rGrid").innerHTML=RICO_CARS.map(r=>{ const n=OWN_CARS.filter(c=>c.id===r.id).length;
      return card(ricoIcon("c"+r.id),"🚗",tr(VT[r.type].n),r.d+(n?` <b style="color:#7ee36a">· Besitzt du (${n})</b>`:""),"$"+r.p.toLocaleString("en-US"),canPay(r.p)?"KAUFEN":"ZU TEUER",!canPay(r.p),"",`data-rc="${r.id}"`); }).join(""); }
$("ricoShop").addEventListener("click",e=>{ const t=e.target.closest("button"); if (e.target===$("ricoShop")||t&&t.id==="rClose"){ closeRico(); return; } if (!t) return;
  if (t.dataset.rt){ ricoTab=t.dataset.rt; renderRico(); return; }
  if (t.dataset.ro!=null){ const i=+t.dataset.ro, o=OUTFITS[i], pr=OUT_PRICE[o.id]||300; if (!OWN_OUT.includes(o.id)){ if (!canPay(pr)) return; pay(pr); OWN_OUT.push(o.id); toast("👕 "+tr(o.n)+(LANG==="en"?" bought":" gekauft")); } if (MI&&i!==OUTFIT) MI.d.dressed=true; applyOutfit(i); WH_.icons={}; if (WANT.lv>0) trick("outfit",LANG==="en"?"New outfit":"Neues Outfit"); sfx("door"); saveGame(); renderRico(); return; }
  if (t.dataset.rc){ const r=RICO_CARS.find(x=>x.id===t.dataset.rc); if (!r||!canPay(r.p)) return; pay(r.p); if (MI) MI.d.carBought=true; const c={id:r.id,col:r.col}; OWN_CARS.push(c); if (OWN_CARS.length>6) OWN_CARS.shift(); spawnOwnedCar(c,OWN_CARS.length-1); sfx("reload"); saveGame(); renderRico();
    toast(LANG==="en"?"🚗 "+tr(VT[r.type].n)+" is parked out front at Rico's":"🚗 "+tr(VT[r.type].n)+" steht vor Rico's bereit"); } });
// ---------- Sunset Strip: Neon, Lichterketten ----------
function drawStrip(q,t,vis){ if (!vis(1000,1000,1400)) return; q.save(); q.globalCompositeOperation="lighter";
  for (const b of VENUES){ const cx=b.x+b.w/2, cy=b.face==="s"?b.y+b.h+18:b.y-18; if (!vis(cx,cy,200)) continue; const pu=.75+.25*Math.sin(t*3+b.id);
    const gr=q.createRadialGradient(cx,cy,4,cx,cy,b.w*.55); gr.addColorStop(0,b.neon); gr.addColorStop(1,"rgba(0,0,0,0)"); q.globalAlpha=.22*pu; q.fillStyle=gr; q.beginPath(); q.ellipse(cx,cy,b.w*.55,40,0,0,7); q.fill();
    if (b.marquee){ q.globalAlpha=1; const x0=b.x+20, x1=b.x+b.w-20, yy=b.y+b.h+8; for (let x=x0,i=0;x<=x1;x+=10,i++){ const on=(i+Math.floor(t*8))%3===0; q.fillStyle=on?"#fff3b0":"rgba(255,210,63,.35)"; q.beginPath(); q.arc(x,yy,on?2.6:1.8,0,7); q.fill(); } } }
  if (vis(PLAZA.x+PLAZA.w/2,PLAZA.y+PLAZA.h/2,400)){ const cols=["#ff5a5a","#ffd23f","#39ff88","#39c5ff","#ff7ad9"]; q.globalAlpha=1;
    for (const y of [PLAZA.y+120,PLAZA.y+230,PLAZA.y+340]){ q.strokeStyle="rgba(40,30,30,.0)"; for (let x=PLAZA.x+10,i=0;x<PLAZA.x+PLAZA.w-10;x+=16,i++){ const sag=Math.sin((x-PLAZA.x)/(PLAZA.w)*Math.PI*3)*6; const on=.6+.4*Math.sin(t*2+i); q.fillStyle=cols[i%5]; q.globalAlpha=on; q.beginPath(); q.arc(x,y+sag,2.2,0,7); q.fill(); } } }
  q.restore(); }
// ---------- Gefängnis: Türsteher + Hintertür ----------
const BOUNCER_LOOK={skin:"#5b3a28",skinHi:"#7a5038",shirt:"#121216",shirtHi:"#2b2b33",pants:"#0f0f12",shoe:"#0a0a0c",cap:"#0f0f12"};
const JAIL={b:[],open:false,seen:false}; let jailArmed=true;
function updateJail(dt){ const d=Math.hypot(jj.x-JDOOR.x,jj.y-JDOOR.y);
  if (!JAIL.b.length&&d<1100){ JAIL.b=[[7206,694,"Privatweg, Kumpel. Dreh um."],[7206,764,"Noch ein Schritt und du schläfst hier."]].map(([x,y,l])=>{ const n={x,y,ang:0,step:0,moving:false,run:false,look:BOUNCER_LOOK,hostile:true,dead:false,deadT:0,cd:.6,weapon:null,range:20,sp:118,hits:0,bouncer:true,idle:true,tough:2,home:{x,y},line:l,say:"",sayT:0}; npcs.push(n); return n; }); }
  if (JAIL.b.length&&d>1600&&JAIL.b.every(n=>n.dead||!npcs.includes(n))){ for (const n of JAIL.b){ const i=npcs.indexOf(n); if (i>=0) npcs.splice(i,1); } JAIL.b=[]; }
  const was=JAIL.open; JAIL.open=JAIL.b.length>0&&JAIL.b.every(n=>n.dead); if (JAIL.open&&!was){ sfx("door"); bark&&bark("ko",1); } }
function bouncerAI(n,dt){ if (n.sayT>0) n.sayT-=dt; if (paused) return true; const dj=Math.hypot(jj.x-n.x,jj.y-n.y), dh=Math.hypot(jj.x-n.home.x,jj.y-n.home.y);
  if (n.idle){ n.moving=false; if (dj<260&&!jj.veh) n.ang=Math.atan2(-(jj.x-n.x),jj.y-n.y);
    if (dj<140&&!n.warned&&!jj.veh&&!jj.dead){ n.warned=true; n.say=n.line; n.sayT=2.6; } if (dj>240) n.warned=false;
    if (n.hits>0){ for (const b of JAIL.b) if (!b.dead&&b.idle){ b.idle=false; if (b!==n){ b.say="Jetzt bist du fällig!"; b.sayT=2; } } }
    return n.idle; }
  if (jj.dead||jj.veh||dh>460){ const dx=n.home.x-n.x, dy=n.home.y-n.y, L=Math.hypot(dx,dy); if (L<8){ n.idle=true; n.hits=0; n.ang=0; n.moving=false; return true; }
    const sp=n.sp*dt; n.x+=dx/L*sp; n.y+=dy/L*sp; n.moving=true; n.step+=dt*12; n.ang=Math.atan2(-dx,dy); return true; }
  return false; }
function drawJailDoor(q,vx,vy,t){ if (Math.abs(JDOOR.x-vx)>1200||Math.abs(JDOOR.y-vy)>900) return; const P=(x,y,h)=>{ const k=1+h/D; return [vx+(x-vx)*k,vy+(y-vy)*k]; };
  const x=7160, y0=702, y1=742, h=34; if (vx>x-4){ const a=P(x,y0,0), b2=P(x,y1,0), c=P(x,y1,h), d=P(x,y0,h); q.fillStyle=JAIL.open?"#0d0d10":"#3a3f46"; q.beginPath(); q.moveTo(...a); q.lineTo(...b2); q.lineTo(...c); q.lineTo(...d); q.closePath(); q.fill(); q.strokeStyle="#1b1d21"; q.lineWidth=2; q.stroke(); }
  const L=P(x+3,(y0+y1)/2,h+6), pu=.7+.3*Math.sin(t*5); q.save(); q.globalCompositeOperation="lighter"; const col=JAIL.open?"80,255,140":"255,70,60"; const gr=q.createRadialGradient(L[0],L[1],1,L[0],L[1],26); gr.addColorStop(0,`rgba(${col},${.9*pu})`); gr.addColorStop(1,`rgba(${col},0)`); q.fillStyle=gr; q.beginPath(); q.arc(L[0],L[1],26,0,7); q.fill(); q.restore();
  if (JAIL.open&&Math.hypot(jj.x-JDOOR.x,jj.y-JDOOR.y)<160){ q.fillStyle=`rgba(255,214,10,${.45+.35*Math.sin(t*4)})`; q.beginPath(); q.arc(JDOOR.x,JDOOR.y,10,0,7); q.fill(); } }
// Tür → Gefängnishof (kein Zellenblock): JJ steht innen an der Mauer, raus geht's am selben Punkt
const JYIN={x:7116,y:748}; L2("RAUS","OUT");
function enterJailYard(){ jj.x=JYIN.x-14; jj.y=JYIN.y+6; jj.ang=Math.PI/2; cam.x=jj.x; cam.y=jj.y; sfx("door"); hudDirty=true; }
function leaveJailYard(){ jj.x=JDOOR.x+24; jj.y=JDOOR.y; jj.ang=-Math.PI/2; cam.x=jj.x; cam.y=jj.y; sfx("door"); hudDirty=true; }
// ---------- Häftlinge im Hof ----------
const YARD=[ {k:"ball",cx:6875,cy:865,r:46,ph:0},{k:"ball",cx:6875,cy:865,r:46,ph:2.1},{k:"ball",cx:6875,cy:865,r:46,ph:4.2},
  {k:"sit",x:7045,y:794,a:0},{k:"sit",x:7080,y:874,a:0},{k:"sit",x:7050,y:954,a:0},{k:"lap",ph:0},{k:"lap",ph:3},{k:"lean",x:6712,y:1000,a:-Math.PI/2},{k:"lean",x:6712,y:1040,a:-Math.PI/2},{k:"lift",x:6950,y:1050,a:Math.PI}];
function drawYard(q,t,vis){ if (!vis(6920,900,500)) return; YARD.forEach((p,i)=>{ const L=INMATE_LOOK[i%3]; let x,y,a,mv=false,st=0;
    if (p.k==="ball"){ const w=t*.9+p.ph; x=p.cx+Math.cos(w)*p.r*1.6; y=p.cy+Math.sin(w*1.3)*p.r; const nx=p.cx+Math.cos(w+.05)*p.r*1.6, ny=p.cy+Math.sin((w+.05)*1.3)*p.r; a=Math.atan2(-(nx-x),ny-y); mv=true; st=t*10+i; }
    else if (p.k==="lap"){ const P=JYARD, per=2*(P.w+P.h), d=((t*38+p.ph*200)%per+per)%per; if (d<P.w){ x=P.x+d; y=P.y; a=-Math.PI/2; } else if (d<P.w+P.h){ x=P.x+P.w; y=P.y+d-P.w; a=0; } else if (d<2*P.w+P.h){ x=P.x+P.w-(d-P.w-P.h); y=P.y+P.h; a=Math.PI/2; } else { x=P.x; y=P.y+P.h-(d-2*P.w-P.h); a=Math.PI; } mv=true; st=t*9+i; }
    else { x=p.x; y=p.y; a=p.a+(p.k==="sit"?Math.sin(t*.6+i)*.3:0); }
    drawPerson(q,{x,y,ang:a,moving:mv,step:st},L); if (p.k==="lift"){ const up=Math.abs(Math.sin(t*2)); q.fillStyle="#2a2a2e"; q.fillRect(x-14,y-4-up*3,28,3); q.beginPath(); q.arc(x-14,y-3-up*3,4,0,7); q.arc(x+14,y-3-up*3,4,0,7); q.fill(); } });
  const bw=t*.9; q.fillStyle="#e8742a"; q.beginPath(); q.arc(6875+Math.cos(bw*2.2)*60,865+Math.sin(bw*1.7)*36,4,0,7); q.fill(); }
// ---------- JJs Zuhause (Onkel Bobbys Haus) innen ----------
const PHOTO=new Image(); PHOTO.src="photo_donny.jpg";
let HOMEIN=null, homeArmed=false; const HI={W:540,H:330,door:270};
const HOBST=[{x:12,y:12,w:150,h:34,k:"counter"},{x:20,y:60,w:36,h:44,k:"fridge"},{x:196,y:200,w:150,h:40,k:"couch"},{x:226,y:120,w:90,h:46,k:"table"},{x:360,y:12,w:12,h:180,k:"wall"},{x:392,y:24,w:84,h:120,k:"bed"},{x:480,y:24,w:40,h:30,k:"night"},{x:96,y:228,w:52,h:48,k:"chair"}];
function enterHomeIn(){ homeArmed=false; HOMEIN={x:HI.door,y:HI.H-40,ang:Math.PI,step:0,moving:false,walkAmt:0,t:0,say:"",sayT:0,earlSay:"",earlT:0,used:{}}; closePhone(); sfx("door"); $("zone").style.visibility="hidden"; }
function leaveHomeIn(){ HOMEIN=null; $("zone").style.visibility=""; jj.x=DOOR.x; jj.y=DOOR.y+24; jj.ang=0; cam.x=jj.x; cam.y=jj.y; sfx("door"); }
function homeFree(x,y){ if (x<24||x>HI.W-24||y<56) return false; if (y>HI.H-18&&Math.abs(x-HI.door)>24) return false; for (const o of HOBST) if (x+10>o.x&&x-10<o.x+o.w&&y+10>o.y&&y-10<o.y+o.h) return false; return true; }
function updateHomeIn(dt){ const P=HOMEIN; P.t+=dt; if (P.sayT>0) P.sayT-=dt; if (P.earlT>0) P.earlT-=dt;
  let mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0), my=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0);
  if (stick.id!==null){ const L=Math.hypot(stick.dx,stick.dy); if (L>8){ mx=stick.dx/L; my=stick.dy/L; } }
  P.moving=!!(mx||my);
  if (P.moving){ const L=Math.hypot(mx,my); mx/=L; my/=L; const sp=125*dt, nx=P.x+mx*sp, ny=P.y+my*sp; if (homeFree(nx,P.y)) P.x=nx; if (homeFree(P.x,ny)||ny>HI.H-18&&Math.abs(P.x-HI.door)<24) P.y=ny;
    let d=Math.atan2(-mx,my)-P.ang; d=Math.atan2(Math.sin(d),Math.cos(d)); P.ang+=d*Math.min(1,dt*14); P.step+=dt*13.5; }
  P.walkAmt+=((P.moving?1:0)-P.walkAmt)*Math.min(1,dt*9);
  if (P.y>HI.H+6){ leaveHomeIn(); return; }
  const near=(x,y,r)=>Math.hypot(P.x-x,P.y-y)<r;
  if (near(56,124,34)&&!P.used.fridge){ P.used.fridge=1; jj.hp=100; hudDirty=true; P.say="Kalte Pizza und ein Bier. Leben voll."; P.sayT=2.6; sfx("ping"); }
  if (near(434,166,34)&&!P.used.bed){ P.used.bed=1; saveGame(); P.say="Kurz hinlegen … Spiel gespeichert."; P.sayT=2.6; toast("Spiel gespeichert"); }
  if (near(196,62,40)&&!P.used.photo){ P.used.photo=1; P.photoT=5; P.say="Ich und Donny. Venice, vor acht Jahren. Ich find dich, Kleiner."; P.sayT=4.5; } if (P.used.photo&&!near(196,62,70)){ P.used.photo=0; P.photoT=Math.min(P.photoT||0,.4); } if (P.photoT>0) P.photoT-=dt;
  if (MS.done.m1&&near(122,206,70)&&P.earlT<=-4){ const L=["Schuhe aus, Junge!","Kühlschrank ist für Notfälle. Und du bist ein Notfall.","Mach keinen Ärger, JJ.","Donny hätte gewollt, dass du isst."]; P.earlSay=L[Math.floor(P.t)%L.length]; P.earlT=2.8; }
  if (P.earlT>-4&&P.earlT<=0) P.earlT-=dt; }
function drawHomeIn(t){ const P=HOMEIN, q=ctx; const k=Math.min(cssW/(HI.W+30),cssH/(HI.H+30)), ox=(cssW-HI.W*k)/2, oy=(cssH-HI.H*k)/2+8, W2=HI.W, H2=HI.H;
  q.setTransform(dpr,0,0,dpr,0,0); q.fillStyle="#0a0807"; q.fillRect(0,0,cssW,cssH); q.setTransform(dpr*k,0,0,dpr*k,dpr*ox,dpr*oy);
  for (let x=0;x<W2;x+=18){ q.fillStyle=(x/18)%2?"#8a6444":"#94704e"; q.fillRect(x,0,18,H2); } q.fillStyle="rgba(0,0,0,.08)"; for (let y=0;y<H2;y+=60) q.fillRect(0,y,W2,1);
  q.fillStyle="#cfc6b4"; q.fillRect(0,0,180,H2); for (let y=0;y<H2;y+=20) for (let x=0;x<180;x+=20){ q.fillStyle=((x+y)/20)%2?"#d8d0bf":"#c7bea9"; q.fillRect(x,y,20,Math.min(20,H2-y)); }
  const lg=q.createRadialGradient(W2*.45,H2*.45,30,W2*.45,H2*.45,360); lg.addColorStop(0,"rgba(255,220,160,.12)"); lg.addColorStop(1,"rgba(0,0,0,.4)"); q.fillStyle=lg; q.fillRect(0,0,W2,H2);
  q.fillStyle="#8a2f2a"; q.fillRect(190,108,170,150); q.strokeStyle="#d8b46a"; q.lineWidth=3; q.strokeRect(198,116,154,134);
  q.fillStyle="#e9e1cf"; q.fillRect(0,0,W2,10); q.fillRect(0,0,10,H2); q.fillRect(W2-10,0,10,H2); q.fillRect(0,H2-10,HI.door-30,10); q.fillRect(HI.door+30,H2-10,W2,10);
  for (const o of HOBST){ if (o.k==="counter"){ q.fillStyle="#6b5a4a"; q.fillRect(o.x,o.y,o.w,o.h); q.fillStyle="#e4ded2"; q.fillRect(o.x,o.y,o.w,8); q.fillStyle="#9fb3c2"; q.fillRect(o.x+90,o.y+12,34,16); q.fillStyle="#2a2a2e"; for (const cx of [o.x+24,o.x+50]){ q.beginPath(); q.arc(cx,o.y+20,7,0,7); q.fill(); } }
    else if (o.k==="fridge"){ q.fillStyle="#e9edf0"; q.fillRect(o.x,o.y,o.w,o.h); q.fillStyle="#b9c2c9"; q.fillRect(o.x+o.w-6,o.y+6,3,14); q.fillStyle="#ffcf3f"; q.fillRect(o.x+6,o.y+8,8,6); q.fillStyle="#ff6a8e"; q.fillRect(o.x+8,o.y+20,6,6); }
    else if (o.k==="couch"){ q.fillStyle="#3b5a7a"; q.fillRect(o.x,o.y,o.w,o.h); q.fillStyle="#4c6e93"; q.fillRect(o.x+6,o.y+4,o.w-12,o.h-16); q.fillStyle="#2c4560"; q.fillRect(o.x,o.y+o.h-10,o.w,10); }
    else if (o.k==="table"){ q.fillStyle="#5a3e28"; q.fillRect(o.x,o.y,o.w,o.h); q.fillStyle="#6e4c33"; q.fillRect(o.x+3,o.y+3,o.w-6,o.h-6); q.fillStyle="#c9302c"; q.fillRect(o.x+16,o.y+14,10,14); q.fillStyle="#f4ecd8"; q.fillRect(o.x+52,o.y+12,22,16); }
    else if (o.k==="wall"){ q.fillStyle="#e9e1cf"; q.fillRect(o.x,o.y,o.w,o.h); }
    else if (o.k==="bed"){ q.fillStyle="#4a3424"; q.fillRect(o.x-4,o.y-4,o.w+8,o.h+8); q.fillStyle="#e8e4da"; q.fillRect(o.x,o.y,o.w,o.h); q.fillStyle="#f6f2ea"; q.fillRect(o.x+8,o.y+6,o.w-16,22); q.fillStyle="#2f6f8f"; q.fillRect(o.x,o.y+44,o.w,o.h-44); q.fillStyle="#3c84a8"; for (let y=o.y+50;y<o.y+o.h;y+=12) q.fillRect(o.x,y,o.w,3); }
    else if (o.k==="night"){ q.fillStyle="#6b4a30"; q.fillRect(o.x,o.y,o.w,o.h); q.fillStyle="#ffe7a0"; q.beginPath(); q.arc(o.x+20,o.y+15,7,0,7); q.fill(); }
    else if (o.k==="chair"){ q.fillStyle="#6b3a2a"; q.fillRect(o.x,o.y,o.w,o.h); q.fillStyle="#7e4a36"; q.fillRect(o.x+6,o.y+6,o.w-12,o.h-14); } }
  // TV an der Wand + Foto
  q.fillStyle="#141418"; q.fillRect(232,12,84,12); const tv=.5+.5*Math.sin(t*7)*Math.sin(t*3.1); q.fillStyle=`rgba(${120+tv*80},${160+tv*60},255,.9)`; q.fillRect(236,14,76,8); q.fillStyle=`rgba(140,190,255,${.08+tv*.06})`; q.beginPath(); q.moveTo(236,24); q.lineTo(316,24); q.lineTo(346,110); q.lineTo(206,110); q.closePath(); q.fill();
  q.fillStyle="rgba(0,0,0,.35)"; q.fillRect(179,13,40,40); q.fillStyle="#3a2516"; q.fillRect(176,10,40,40); q.fillStyle="#f3efe6"; q.fillRect(179,13,34,34); if (PHOTO.complete&&PHOTO.naturalWidth) q.drawImage(PHOTO,181,15,30,30); else { q.fillStyle="#d89a5a"; q.fillRect(181,15,30,30); } if (!P.used.photo){ q.strokeStyle=`rgba(255,214,10,${.35+.35*Math.sin(t*4)})`; q.lineWidth=2; q.strokeRect(173,7,46,46); }
  q.fillStyle="#5a4a36"; q.fillRect(HI.door-26,H2-12,52,10);
  if (MS.done.m1) drawPerson(q,{x:122,y:250,ang:Math.PI+Math.sin(t*.4)*.2,moving:false},CREWLOOK["Onkel Bobby"]);
  drawPerson(q,{x:P.x,y:P.y,ang:P.ang,moving:P.moving,step:P.step,walkAmt:P.walkAmt},LOOK,W.cur==="fist"?{}:{weapon:W.cur});
  q.fillStyle="rgba(255,255,255,.75)"; q.font='700 9px "Barlow Semi Condensed",sans-serif'; q.textAlign="center"; q.textBaseline="middle"; q.fillText("AUSGANG ↓",HI.door,H2-24);
  if (P.sayT>0) drawSay(q,P.x,P.y-30,P.say); if (P.earlT>0) drawSay(q,122,220,"Bobby: "+P.earlSay);
  q.setTransform(dpr,0,0,dpr,0,0);
  if (P.photoT>0&&PHOTO.complete&&PHOTO.naturalWidth){ const a=Math.min(1,P.photoT/.4,(5-P.photoT)/.3), S=Math.min(cssW*.42,cssH*.62), cx=cssW/2, cy=cssH/2-10; q.save(); q.globalAlpha=Math.max(0,a); q.fillStyle="rgba(6,4,3,.55)"; q.fillRect(0,0,cssW,cssH); q.translate(cx,cy); q.rotate(-.05); q.shadowColor="rgba(0,0,0,.6)"; q.shadowBlur=24; q.fillStyle="#f4efe4"; q.fillRect(-S/2-12,-S/2-12,S+24,S+60); q.shadowBlur=0; q.drawImage(PHOTO,-S/2,-S/2,S,S); q.fillStyle="rgba(255,190,120,.08)"; q.fillRect(-S/2,-S/2,S,S); q.fillStyle="#1a2a6a"; q.font=`${Math.round(S*.075)}px "Permanent Marker",cursive`; q.textAlign="center"; q.textBaseline="middle"; q.fillText("Ich & Donny · Venice 2018",0,S/2+24); q.restore(); } }
// ---------- Gefängnis innen ----------
let JAILIN=null; const JI={W:520,H:300,cy:104,door:260};
const INMATE_LOOK=[{skin:"#7a4b2e",skinHi:"#9c6743",shirt:"#e8742a",shirtHi:"#ff9a4a",pants:"#d8661f",shoe:"#2a2a2a",cap:"#1b1410"},{skin:"#e0b08a",skinHi:"#f2c7a3",shirt:"#e8742a",shirtHi:"#ff9a4a",pants:"#d8661f",shoe:"#2a2a2a",cap:"#6b4a2a"},{skin:"#a8714f",skinHi:"#c48a66",shirt:"#e8742a",shirtHi:"#ff9a4a",pants:"#d8661f",shoe:"#2a2a2a",cap:"#2a2a2a"}];
const WARDEN_LOOK={skin:"#d9a37c",skinHi:"#ecbd98",shirt:"#3b4a63",shirtHi:"#566a8a",pants:"#20283a",shoe:"#111",cap:"#20283a"};
const INMATE_LINES=["Ey, neuer Fisch! Hast du Kippen?","Ich bin unschuldig! … Okay, bei DER Sache nicht.","Bring mir 'nen Burger von Burger Bros, dann reden wir.","Psst. Der Wärter schläft seit 2019.","Ich kenn dich! Du bist doch … nee, doch nicht.","Sag meiner Mutter, ich bin auf Geschäftsreise."];
function enterJailIn(){ jailArmed=false; JAILIN={x:JI.door,y:JI.H-62,ang:Math.PI,step:0,moving:false,walkAmt:0,t:0,cells:INMATE_LINES.map((l,i)=>({x:52+i*84,line:l,say:"",sayT:0,ph:i*1.3}))}; closePhone(); sfx("door"); $("zone").style.visibility="hidden"; if (!JAIL.seen){ JAIL.seen=true; toast("Geheimweg gefunden!"); } }
function leaveJailIn(){ JAILIN=null; $("zone").style.visibility=""; jj.x=JDOOR.x+24; jj.y=JDOOR.y; jj.ang=-Math.PI/2; cam.x=jj.x; cam.y=jj.y; sfx("door"); }
function updateJailIn(dt){ const P=JAILIN; P.t+=dt;
  let mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0), my=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0);
  if (stick.id!==null){ const L=Math.hypot(stick.dx,stick.dy); if (L>8){ mx=stick.dx/L; my=stick.dy/L; } }
  my=-my; P.moving=!!(mx||my);
  if (P.moving){ const L=Math.hypot(mx,my); mx/=L; my/=L; const sp=120*dt; P.x=Math.max(30,Math.min(JI.W-30,P.x+mx*sp)); const atDoor=Math.abs(P.x-JI.door)<24; P.y=Math.max(JI.cy+18,Math.min(atDoor?JI.H+10:JI.H-30,P.y+my*sp));
    let d=Math.atan2(-mx,my)-P.ang; d=Math.atan2(Math.sin(d),Math.cos(d)); P.ang+=d*Math.min(1,dt*14); P.step+=dt*13.5; }
  P.walkAmt+=((P.moving?1:0)-P.walkAmt)*Math.min(1,dt*9);
  for (const c of P.cells){ if (c.sayT>0) c.sayT-=dt; else if (c.sayT>-1.5) c.sayT-=dt; if (Math.abs(P.x-c.x)<38&&P.y<JI.cy+70&&c.sayT<=-1.5){ c.say=c.line; c.sayT=3; } if (c.sayT<=0) c.sayT=Math.max(-9,c.sayT-dt); }
  if (P.y>JI.H-4) leaveJailIn(); }
function drawJailIn(t){ const P=JAILIN, q=ctx; const k=Math.min(cssW/(JI.W+30),cssH/(JI.H+30)), ox=(cssW-JI.W*k)/2, oy=(cssH-JI.H*k)/2+8;
  q.setTransform(dpr,0,0,dpr,0,0); q.fillStyle="#060608"; q.fillRect(0,0,cssW,cssH);
  q.setTransform(dpr*k,0,0,dpr*k,dpr*ox,dpr*oy); const W2=JI.W, H2=JI.H; q.transform(1,0,0,-1,0,H2); const upr=(x,y,fn)=>{ q.save(); q.translate(x,y); q.scale(1,-1); fn(); q.restore(); };
  for (let y=0;y<H2;y+=24) for (let x=0;x<W2;x+=24){ q.fillStyle=((x+y)/24)%2?"#4a4c4f":"#525457"; q.fillRect(x,y,24,24); }
  const fl=q.createRadialGradient(W2/2,H2*.6,30,W2/2,H2*.6,320); fl.addColorStop(0,"rgba(255,240,200,.10)"); fl.addColorStop(1,"rgba(0,0,0,.55)"); q.fillStyle=fl; q.fillRect(0,0,W2,H2);
  // Zellen
  q.fillStyle="#2c2e31"; q.fillRect(0,0,W2,JI.cy-8); for (const c of P.cells){ q.fillStyle="#3a3c40"; q.fillRect(c.x-38,6,76,JI.cy-20); q.fillStyle="#cfcac0"; q.fillRect(c.x-30,10,24,40); q.fillStyle="#e9e4da"; q.fillRect(c.x-30,10,24,10); q.fillStyle="#9aa0a6"; q.fillRect(c.x+16,12,14,14); }
  for (let i=0;i<=P.cells.length;i++){ q.fillStyle="#18191b"; q.fillRect(10+i*84-4,0,8,JI.cy-6); }
  P.cells.forEach((c,i)=>{ const L=INMATE_LOOK[i%3], bob=Math.sin(t*1.5+c.ph)*6; drawPerson(q,{x:c.x+bob,y:JI.cy-40,ang:Math.PI+Math.sin(t*.7+c.ph)*.5,moving:false},L); });
  q.fillStyle="#141517"; q.fillRect(0,JI.cy-10,W2,6); for (let x=4;x<W2;x+=9){ q.fillStyle="#6b7077"; q.fillRect(x,JI.cy-14,3,14); }
  // Wärter schläft am Tisch
  q.fillStyle="#5a4632"; q.fillRect(W2-120,H2-90,70,34); drawPerson(q,{x:W2-85,y:H2-50,ang:Math.PI,moving:false},WARDEN_LOOK); upr(W2-60,H2-42,()=>{ q.fillStyle="rgba(255,255,255,.8)"; q.font='700 11px sans-serif'; q.fillText("Zzz"+".".repeat(1+Math.floor(t*2)%3),0,0); });
  // Wände + Tür
  q.fillStyle="#1d1e20"; q.fillRect(0,0,10,H2); q.fillRect(W2-10,0,10,H2); q.fillRect(0,H2-10,JI.door-30,10); q.fillRect(JI.door+30,H2-10,W2,10);
  q.fillStyle="#3a3f46"; q.fillRect(JI.door-26,H2-24,52,14); upr(JI.door,H2-17,()=>{ q.fillStyle="rgba(255,255,255,.75)"; q.font='700 9px "Barlow Semi Condensed",sans-serif'; q.textAlign="center"; q.textBaseline="middle"; q.fillText("AUSGANG ↑",0,0); });
  q.save(); q.shadowColor="#ff3b30"; q.shadowBlur=10; upr(W2/2,H2-40,()=>{ q.fillStyle="#ff6b5e"; q.font='400 18px "Bebas Neue",Impact,sans-serif'; q.textAlign="center"; q.textBaseline="middle"; q.fillText("ZELLENBLOCK C",0,0); }); q.restore();
  drawPerson(q,{x:P.x,y:P.y,ang:P.ang,moving:P.moving,step:P.step,walkAmt:P.walkAmt},LOOK,W.cur==="fist"?{}:{weapon:W.cur});
  for (const c of P.cells) if (c.sayT>0) upr(c.x,JI.cy-18,()=>drawSay(q,0,0,c.say));
  q.setTransform(dpr,0,0,dpr,0,0); }
// ---------- LA ARMS interior ----------
let SHOPIN=null, shopDoorArmed=true; const SI={W:440,H:300,cy:112,door:220};
const SISPOT={x:SI.W/2,y:SI.cy+40}; L2("KAUFEN","BUY");   // Kaufpunkt vor dem Verkäufer: hinstellen + Knopf/E
function onShopSpot(){ return !!SHOPIN&&!shopOpen&&Math.hypot(SHOPIN.x-SISPOT.x,SHOPIN.y-SISPOT.y)<22; }
const SIIMG={}; function siImg(k){ if (!SIIMG[k]){ const im=new Image(); im.src=WICON[k]; SIIMG[k]=im; } return SIIMG[k]; }
const KEEPER={skin:"#d9a37c",skinHi:"#ecbd98",shirt:"#4a3b2a",shirtHi:"#6b563d",pants:"#2a2620",shoe:"#1d1a16",cap:"#7a1d22"};
function enterShopIn(){ shopDoorArmed=false; SHOPIN={x:SI.door,y:SI.H-62,ang:Math.PI,step:0,moving:false,walkAmt:0,counterArmed:true,t:0}; closePhone(); sfx("door"); $("zone").style.visibility="hidden"; }
function leaveShopIn(){ SHOPIN=null; $("zone").style.visibility=""; closeShop(); jj.x=SHOP.x; jj.y=SHOP.y-30; jj.ang=Math.PI; cam.x=jj.x; cam.y=jj.y; sfx("door"); }
function updateShopIn(dt){ const P=SHOPIN; P.t+=dt; if (shopOpen){ P.moving=false; P.walkAmt=0; return; }
  let mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0), my=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0);
  if (stick.id!==null){ const L=Math.hypot(stick.dx,stick.dy); if (L>8){ mx=stick.dx/L; my=stick.dy/L; } }
  my=-my;   // Raum ist gespiegelt dargestellt: Tür oben, Theke unten
  P.moving=!!(mx||my);
  if (P.moving){ const L=Math.hypot(mx,my); mx/=L; my/=L; const sp=120*dt; P.x=Math.max(34,Math.min(SI.W-34,P.x+mx*sp)); const atDoor=Math.abs(P.x-SI.door)<24; P.y=Math.max(SI.cy+16,Math.min(atDoor?SI.H+10:SI.H-30,P.y+my*sp));
    let d=Math.atan2(-mx,my)-P.ang; d=Math.atan2(Math.sin(d),Math.cos(d)); P.ang+=d*Math.min(1,dt*14); P.step+=dt*13.5; }
  P.walkAmt+=((P.moving?1:0)-P.walkAmt)*Math.min(1,dt*9);
  if (P.y>SI.H-4){ leaveShopIn(); return; }
}
function drawShopIn(t){ const P=SHOPIN, q=ctx; const k=Math.min(cssW/(SI.W+30),cssH/(SI.H+30)), ox=(cssW-SI.W*k)/2, oy=(cssH-SI.H*k)/2+8;
  q.setTransform(dpr,0,0,dpr,0,0); q.fillStyle="#08070a"; q.fillRect(0,0,cssW,cssH);
  q.setTransform(dpr*k,0,0,dpr*k,dpr*ox,dpr*oy); const W2=SI.W, H2=SI.H; q.transform(1,0,0,-1,0,H2); const upr=(x,y,fn)=>{ q.save(); q.translate(x,y); q.scale(1,-1); fn(); q.restore(); };
  // floor
  for (let y=0;y<H2;y+=20) for (let x=0;x<W2;x+=20){ q.fillStyle=((x+y)/20)%2?"#2a2522":"#332d29"; q.fillRect(x,y,20,20); }
  const fl=q.createRadialGradient(W2/2,H2*.55,40,W2/2,H2*.55,300); fl.addColorStop(0,"rgba(255,220,160,.10)"); fl.addColorStop(1,"rgba(0,0,0,.45)"); q.fillStyle=fl; q.fillRect(0,0,W2,H2);
  // walls
  q.fillStyle="#3a2420"; q.fillRect(0,0,W2,58); for (let y=0;y<58;y+=8) for (let x=(y/8)%2?0:12;x<W2;x+=24){ q.fillStyle="rgba(0,0,0,.18)"; q.fillRect(x,y,23,1); q.fillRect(x,y,1,8); }
  q.fillStyle="#1d1412"; q.fillRect(0,0,14,H2); q.fillRect(W2-14,0,14,H2); q.fillRect(0,H2-10,SI.door-30,10); q.fillRect(SI.door+30,H2-10,W2,10);
  // pegboard with weapons
  q.fillStyle="#c9b48a"; q.fillRect(60,8,W2-120,44); q.fillStyle="rgba(0,0,0,.25)"; for (let y=13;y<50;y+=7) for (let x=66;x<W2-62;x+=7) q.fillRect(x,y,1.2,1.2);
  ["bat","shotgun","rpg","shotgun","bat"].forEach((w,i)=>{ const im=siImg(w); if (im.complete) upr(72+i*62,24,()=>q.drawImage(im,0,-12,58,24)); });
  // neon sign
  q.save(); q.shadowColor="#ff3b4a"; q.shadowBlur=12; q.fillStyle="#ff6b74"; q.font='400 20px "Bebas Neue",Impact,sans-serif'; q.textAlign="center"; q.textBaseline="middle"; upr(W2/2,48,()=>q.fillText("LA ARMS",0,0)); q.restore();
  // shopkeeper
  drawPerson(q,{x:W2/2,y:SI.cy-22,ang:Math.atan2(P.y-(SI.cy-22),P.x-W2/2)-Math.PI/2,moving:false},KEEPER);
  // counter
  q.fillStyle="#1a1416"; q.fillRect(W2/2-160,SI.cy-6,320,22); const cg=q.createLinearGradient(0,SI.cy-6,0,SI.cy+16); cg.addColorStop(0,"rgba(170,220,255,.45)"); cg.addColorStop(1,"rgba(80,120,160,.25)"); q.fillStyle=cg; q.fillRect(W2/2-156,SI.cy-3,312,16);
  ["shotgun","bat","rpg"].forEach((w,i)=>{ const im=siImg(w); if (im.complete){ q.globalAlpha=.8; upr(W2/2-140+i*100,SI.cy+5,()=>q.drawImage(im,0,-6,60,12)); q.globalAlpha=1; } });
  q.fillStyle="#d8303a"; q.fillRect(W2/2-160,SI.cy+16,320,3);
  // shelves left/right
  for (const sx of [22,W2-46]) for (let y=80;y<H2-40;y+=34){ q.fillStyle="#4a3a2c"; q.fillRect(sx,y,24,26); q.fillStyle="#6b8a3a"; q.fillRect(sx+3,y+3,8,9); q.fillStyle="#8a6a2a"; q.fillRect(sx+13,y+3,8,9); q.fillStyle="#3a4a6a"; q.fillRect(sx+3,y+14,18,9); }
  // door + mat
  q.fillStyle="#5a4a36"; q.fillRect(SI.door-26,H2-24,52,16); q.fillStyle="rgba(255,255,255,.7)"; q.font='700 9px "Barlow Semi Condensed",sans-serif'; q.textAlign="center"; q.textBaseline="middle"; upr(SI.door,H2-16,()=>q.fillText("AUSGANG ↑",0,0));
  // counter hint
  if (!shopOpen){ const pu=.5+Math.sin(t*4)*.5, on=onShopSpot(); q.fillStyle=on?"rgba(255,214,10,.38)":"rgba(255,214,10,.14)"; q.beginPath(); q.arc(SISPOT.x,SISPOT.y,18,0,7); q.fill();
    q.strokeStyle=`rgba(255,214,10,${.45+pu*.45})`; q.lineWidth=2; q.setLineDash([5,4]); q.stroke(); q.setLineDash([]);
    q.fillStyle="#ffd60a"; q.font='700 10px "Barlow Semi Condensed",sans-serif'; q.textAlign="center"; q.textBaseline="middle"; upr(SISPOT.x,SISPOT.y+30,()=>q.fillText("KAUFEN",0,0)); }
  drawPerson(q,{x:P.x,y:P.y,ang:P.ang,moving:P.moving,step:P.step,walkAmt:P.walkAmt},LOOK,W.cur==="fist"?{}:{weapon:W.cur});
  q.setTransform(dpr,0,0,dpr,0,0); }
// ---------- big map ----------
let BIG=null, mapOpen=false;
function buildBig(){ const W2=2400, H2=Math.round(W2*WH/WW); return mk(W2,H2,q=>{ const k=W2/WW; q.imageSmoothingQuality="high"; q.drawImage(ground,ground.width-2,0,2,ground.height,LANDW*k-1,0,(WW-LANDW)*k+1,WH0*k); q.drawImage(ground,0,0,ground.width,ground.height,0,0,LANDW*k,WH0*k); q.fillStyle="#0d4675"; q.fillRect(0,WH0*k,W2,H2-WH0*k); q.drawImage(ground2,0,0,ground2.width,ground2.height,G2.x*k,G2.y*k,G2.w*k,G2.h*k); q.drawImage(ground3,0,0,ground3.width,ground3.height,G3.x*k,G3.y*k,G3.w*k,G3.h*k); q.fillStyle="rgba(10,8,14,.18)"; q.fillRect(0,0,W2,H2);
  for (const b of buildings){ q.fillStyle="rgba(20,16,26,.35)"; q.fillRect((b.x+6)*k,(b.y+6)*k,b.w*k,b.h*k); q.drawImage(b.roofC,b.x*k,b.y*k,b.w*k,b.h*k); q.strokeStyle="rgba(0,0,0,.35)"; q.lineWidth=1; q.strokeRect(b.x*k,b.y*k,b.w*k,b.h*k); }
  q.textAlign="center"; q.textBaseline="middle"; q.font='400 56px "Bebas Neue",Impact,sans-serif';
  for (const [t,x,y] of [["FLUGHAFEN",1000+AX,560],["SUNSET STRIP",1000,560],["HAFEN",5600,2300],["DOWNTOWN",3150,1240],["ZUHAUSE",1000,2690],["PALM HEIGHTS",3300,2300],["VENICE BEACH",700,3460],["SANTA LUNA",4950,3860]]){ q.lineWidth=5; q.strokeStyle="rgba(18,16,22,.75)"; q.strokeText(t,x*k,y*k); q.fillStyle="#f6efe2"; q.fillText(t,x*k,y*k); } }); }
function openMap(){ if (jj.dead) return; if (!BIG) BIG=buildBig(); closePhone(); mapOpen=true; $("bigmap").hidden=false; drawBig(); }
function closeMap(){ mapOpen=false; $("bigmap").hidden=true; }
function toggleMap(){ mapOpen?closeMap():openMap(); }
const MZ={z:1,cx:WW/2,cy:WH/2};
function mzClamp(){ MZ.z=Math.max(1,Math.min(5,MZ.z)); const hw=WW/MZ.z/2, hh=WH/MZ.z/2; MZ.cx=Math.max(hw,Math.min(WW-hw,MZ.cx)); MZ.cy=Math.max(hh,Math.min(WH-hh,MZ.cy)); }
function mapToWorld(c,cx,cy){ const r=c.getBoundingClientRect(), vw=WW/MZ.z, vh=WH/MZ.z; return {x:MZ.cx-vw/2+(cx-r.left)/r.width*vw, y:MZ.cy-vh/2+(cy-r.top)/r.height*vh}; }
function drawBig(){ const c=$("mapc"), availW=cssW-24, availH=cssH-90, sc2=Math.min(availW/WW,availH/WH), w=Math.round(WW*sc2), h=Math.round(WH*sc2), d=Math.min(2,window.devicePixelRatio||1);
  if (c.width!==w*d){ c.style.width=w+"px"; c.style.height=h+"px"; c.width=w*d; c.height=h*d; } const q=c.getContext("2d"); q.setTransform(d,0,0,d,0,0); mzClamp();
  const vw=WW/MZ.z, vh=WH/MZ.z, sx0=MZ.cx-vw/2, sy0=MZ.cy-vh/2, kb=BIG.width/WW; q.imageSmoothingQuality="high"; q.drawImage(BIG,sx0*kb,sy0*kb,vw*kb,vh*kb,0,0,w,h);
  const k=w/vw, t=performance.now()/1000; q.save(); q.translate(-sx0*k,-sy0*k);
  if (gps){ q.fillStyle="#ffd60a"; q.strokeStyle="#120f14"; q.lineWidth=2; q.beginPath(); q.arc(gps.x*k,gps.y*k,7,0,7); q.fill(); q.stroke(); }
  if (ricoOpen()){ const sx=RICO.x*k, sy=RICO.y*k; q.fillStyle="#ffb347"; q.strokeStyle="#fff"; q.lineWidth=2; q.beginPath(); q.arc(sx,sy,10,0,7); q.fill(); q.stroke(); q.font='700 11px "Barlow Semi Condensed",sans-serif'; q.textAlign="center"; q.lineWidth=3; q.strokeStyle="rgba(18,16,22,.8)"; q.strokeText("🚗 RICO'S AUTOS",sx,sy+20); q.fillStyle="#fff"; q.fillText("🚗 RICO'S AUTOS",sx,sy+20); }
  if (clothesOpen()){ const sx=CLO.x*k, sy=CLO.y*k; q.fillStyle="#ff5fb4"; q.strokeStyle="#fff"; q.lineWidth=2; q.beginPath(); q.arc(sx,sy,10,0,7); q.fill(); q.stroke(); q.font='700 11px "Barlow Semi Condensed",sans-serif'; q.textAlign="center"; q.lineWidth=3; q.strokeStyle="rgba(18,16,22,.8)"; q.strokeText("👕 DRIP STORE",sx,sy+20); q.fillStyle="#fff"; q.fillText("👕 DRIP STORE",sx,sy+20); }
  if (MS.done.mh){ const sx=SALEDOOR.x*k, sy=SALEDOOR.y*k; q.fillStyle="#7ee36a"; q.strokeStyle="#fff"; q.lineWidth=2; q.beginPath(); q.arc(sx,sy,10,0,7); q.fill(); q.stroke(); q.font='700 11px "Barlow Semi Condensed",sans-serif'; q.textAlign="center"; q.lineWidth=3; q.strokeStyle="rgba(18,16,22,.8)"; q.strokeText("🏠 JJ",sx,sy+20); q.fillStyle="#fff"; q.fillText("🏠 JJ",sx,sy+20); }
  if (armsOpen()){ const sx=SHOP.x*k, sy=SHOP.y*k; q.fillStyle="#d8303a"; q.strokeStyle="#fff"; q.lineWidth=2; q.beginPath(); q.arc(sx,sy,10,0,7); q.fill(); q.stroke(); q.beginPath(); q.arc(sx,sy,4,0,7); q.moveTo(sx-7,sy); q.lineTo(sx+7,sy); q.moveTo(sx,sy-7); q.lineTo(sx,sy+7); q.lineWidth=1.5; q.stroke(); q.font='700 11px "Barlow Semi Condensed",sans-serif'; q.textAlign="center"; q.lineWidth=3; q.strokeStyle="rgba(18,16,22,.8)"; q.strokeText("🎯 LA ARMS",sx,sy+20); q.fillStyle="#fff"; q.fillText("🎯 LA ARMS",sx,sy+20); }
  missionPins(q,0,0,WW*k,WH*k,9);
  const px=jj.x*k, py=jj.y*k; q.fillStyle="rgba(255,179,71,.25)"; q.beginPath(); q.arc(px,py,10+Math.sin(t*4)*3,0,7); q.fill(); q.save(); q.translate(px,py); q.rotate(jj.veh?jj.veh.a+Math.PI/2:jj.ang+Math.PI); q.fillStyle="#ffb347"; q.strokeStyle="#120f14"; q.lineWidth=1.6; q.beginPath(); q.moveTo(0,-8); q.lineTo(6,6); q.lineTo(0,3); q.lineTo(-6,6); q.closePath(); q.fill(); q.stroke(); q.restore(); q.restore();
  $("mzLbl").textContent=MZ.z.toFixed(1).replace(".0","")+"×"; }
{ const c=$("mapc"), P=new Map(); let moved=false, pinch=null;
  c.addEventListener("pointerdown",e=>{ e.preventDefault(); e.stopPropagation(); c.setPointerCapture(e.pointerId); P.set(e.pointerId,{x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY}); moved=P.size>1; if (P.size===2){ const [a,b]=[...P.values()]; pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:MZ.z}; } });
  c.addEventListener("pointermove",e=>{ const p=P.get(e.pointerId); if (!p) return; const r=c.getBoundingClientRect(), dx=e.clientX-p.x, dy=e.clientY-p.y; p.x=e.clientX; p.y=e.clientY;
    if (P.size===2&&pinch){ const [a,b]=[...P.values()], dd=Math.hypot(a.x-b.x,a.y-b.y), m=mapToWorld(c,(a.x+b.x)/2,(a.y+b.y)/2); MZ.z=pinch.z*dd/Math.max(10,pinch.d); mzClamp(); const m2=mapToWorld(c,(a.x+b.x)/2,(a.y+b.y)/2); MZ.cx+=m.x-m2.x; MZ.cy+=m.y-m2.y; drawBig(); return; }
    if (Math.hypot(e.clientX-p.x0,e.clientY-p.y0)>8) moved=true; if (moved){ MZ.cx-=dx/r.width*WW/MZ.z; MZ.cy-=dy/r.height*WH/MZ.z; drawBig(); } });
  const up=e=>{ const p=P.get(e.pointerId); P.delete(e.pointerId); if (P.size<2) pinch=null; if (!p) return; if (!moved&&P.size===0){ const w=mapToWorld(c,e.clientX,e.clientY); gps={n:"Markierung",x:w.x,y:w.y,user:true}; routeT=0; sfx("ping"); drawBig(); } if (P.size===0) moved=false; };
  c.addEventListener("pointerup",up); c.addEventListener("pointercancel",up);
  c.addEventListener("wheel",e=>{ e.preventDefault(); const m=mapToWorld(c,e.clientX,e.clientY); MZ.z*=e.deltaY<0?1.2:1/1.2; mzClamp(); const m2=mapToWorld(c,e.clientX,e.clientY); MZ.cx+=m.x-m2.x; MZ.cy+=m.y-m2.y; drawBig(); },{passive:false});
  const zb=(f)=>{ MZ.z*=f; mzClamp(); drawBig(); }; $("mzIn").addEventListener("pointerdown",e=>{ e.stopPropagation(); zb(1.5); }); $("mzOut").addEventListener("pointerdown",e=>{ e.stopPropagation(); zb(1/1.5); });
  $("mzMe").addEventListener("pointerdown",e=>{ e.stopPropagation(); MZ.cx=jj.x; MZ.cy=jj.y; if (MZ.z<2) MZ.z=2.5; drawBig(); }); }
$("bigmap").addEventListener("pointerdown",e=>{ e.preventDefault(); if (e.target.closest(".leg,.mz,#mapc")) return; closeMap(); });
document.getElementById("load").hidden=true;
document.getElementById("go").addEventListener("click",()=>{ initAudio(); document.getElementById("title").classList.add("off"); started=true; document.body.classList.add("play"); setTimeout(()=>{ document.getElementById("title").hidden=true; },800);
  syncBadge(); hudDirty=true;
  if (!MS.done.m1){ jj.x=MDEF[0].loc.x; jj.y=MDEF[0].loc.y; jj.hidden=true; cam.x=AX; cam.y=450; startMission(MDEF[0]); } else { if (!MS.done.m2) setupRide(); else { const H=homeSpot(); jj.x=H.x; jj.y=H.y; jj.ang=0; cam.x=jj.x; cam.y=jj.y; } renderObj(); } });
if (loadGame()&&MS.done.m1){ $("go").textContent="WEITER"; $("newg").hidden=false; }
if (OUTFITS[OUTFIT]&&!OWN_OUT.includes(OUTFITS[OUTFIT].id)) OWN_OUT.push(OUTFITS[OUTFIT].id); if (MS.done.m1&&!CHATS.mama.msgs.length) CHATS.mama.msgs.push({text:MAMA_TXT(),me:false,time:"16:02"}); if (MS.done.m12) OWN_CARS.slice(-3).forEach((c,i)=>spawnOwnedCar(c,i,!!MS.done.mh));
$("newg").addEventListener("click",()=>{ resetGame(); location.reload(); });
document.querySelectorAll("#langSel button").forEach(b=>{ b.classList.toggle("on",b.dataset.l===LANG); b.addEventListener("click",e=>{ e.stopPropagation(); if (b.dataset.l!==LANG) setLang(b.dataset.l); }); });
const OPTS=[["bgRadio","Radio im Hintergrund","Leise House-Musik, auch zu Fuß"],["sfx","Soundeffekte","Schüsse, Motoren, Treffer …"],["intro","Intro-Video","Beim neuen Spiel abspielen"]];
function renderOpts(){ $("olist").innerHTML=OPTS.map(([k,n,d])=>`<div class="orow"><div><b>${n}</b><span>${d}</span></div><button class="tg${SET[k]?" on":""}" data-opt="${k}" aria-label="${n}"></button></div>`).join(""); }
$("optb").addEventListener("click",e=>{ e.stopPropagation(); renderOpts(); $("opts").hidden=false; });
$("olist").addEventListener("click",e=>{ const b=e.target.closest("[data-opt]"); if (!b) return; SET[b.dataset.opt]=!SET[b.dataset.opt]; saveSet(); renderOpts(); });
$("oclose").addEventListener("click",e=>{ e.stopPropagation(); $("opts").hidden=true; });
$("opts").addEventListener("click",e=>{ if (e.target.id==="opts") $("opts").hidden=true; });
addEventListener("keydown",e=>{ if (!started&&(e.code==="Enter"||e.code==="Space")){ if (!$("opts").hidden){ $("opts").hidden=true; return; } document.getElementById("go").click(); } });
requestAnimationFrame(frame);
