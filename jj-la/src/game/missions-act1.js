// ---------- the six missions ----------
const PARK={x:BLOCKS[4].x+BLOCKS[4].w/2,y:BLOCKS[4].y+BLOCKS[4].h/2+70};
const YGAR={x:1670,y:2872}, PSPOT={x:1670,y:2977,a:0,l:66,w:34}, PCAR={x:1584,y:1150,a:-Math.PI/2}, YACHT_DROP={x:2440,y:3470};
const VILLA=LOTS.find(L=>L.tennis)||LOTS[LOTS.length-1];
// ---------- arrival cinematic: plane lands, taxis to the gate ----------
let CINE=null, ARRIVAL=null;
// ---------- intro video ----------
const ISUBS=[[0,2.2,"cap","VENICE BEACH · 2018"],[1.4,3.9,"Donny","Ich hab was gesehen, JJ. Was ich nicht hätte sehen sollen."],[3.9,5.2,"JJ","Was denn?"],[5.6,9,"Donny","Bin gleich zurück."],[9.2,13,"cap","EIN SCHWARZER SUV. KEIN KENNZEICHEN."],[13.2,17,"Donny","Wenn mir was passiert – trau keinem."],[17.2,19.6,"JJ","Die Polizei glaubt, ich war's."],[19.6,22,"JJ","Ich musste verschwinden – und hoffen, dass sie den Fall lösen."],[22,23.6,"cap","8 JAHRE SPÄTER"],[23.6,26.2,"Yunus","JJ … ich hab was gefunden. Donny lebt."],[26.6,30.1,"JJ","Ich komme, Donny."]];
let introCb=null, isubCur=-1;
function showIntroVid(cb){ introCb=cb; paused=true; jj.hidden=true; const v=$("ivv"); $("ivid").hidden=false; isubCur=-1; $("isub").innerHTML=""; v.currentTime=0; v.muted=false;
  const p=v.play(); if (p&&p.catch) p.catch(()=>{ v.muted=true; $("isnd").hidden=false; v.play().catch(()=>endIntroVid()); }); }
function endIntroVid(){ if (!introCb) return; const cb=introCb; introCb=null; const v=$("ivv"); try{ v.pause(); }catch(e){} $("ivid").hidden=true; $("isnd").hidden=true; $("isub").innerHTML=""; cb(); }
$("ivv").addEventListener("timeupdate",()=>{ const t=$("ivv").currentTime; let k=-1; ISUBS.forEach((x,i)=>{ if (t>=x[0]&&t<x[1]) k=i; }); if (k===isubCur) return; isubCur=k;
  if (k<0){ $("isub").innerHTML=""; return; } const [a,b,w,txt]=ISUBS[k]; $("isub").innerHTML=w==="cap"?`<div class="cap">${txt}</div>`:`<div><b style="color:${SPK[w]||"#fff"}">${w.toUpperCase()}</b>${txt}</div>`; });
$("ivv").addEventListener("ended",endIntroVid); { const ss=$("ivv").querySelectorAll("source"); if (ss.length) ss[ss.length-1].addEventListener("error",endIntroVid); }
$("iskip").addEventListener("pointerup",e=>{ e.stopPropagation(); endIntroVid(); });
$("isnd").addEventListener("pointerup",e=>{ e.stopPropagation(); $("ivv").muted=false; $("isnd").hidden=true; });
const ARR_SUBS=[];
const ARR=(()=>{ const C=[[-40,450],[500,450],[1200,450],[2400,450]].map(([x,y])=>[x+AX,y]);   // gerade auf die Landebahn zu
  const pts=[]; for (let i=0;i<C.length-1;i++){ const p0=C[Math.max(0,i-1)], p1=C[i], p2=C[i+1], p3=C[Math.min(C.length-1,i+2)]; const n=Math.max(2,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/8));
    for (let k=0;k<n;k++){ const t=k/n, t2=t*t, t3=t2*t; pts.push([.5*(2*p1[0]+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),.5*(2*p1[1]+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)]); } }
  pts.push(C[C.length-1]); const L=[0]; for (let i=1;i<pts.length;i++) L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1])); return {pts,L,total:L[L.length-1],td:520}; })();
function arrAt(sv){ const {pts,L}=ARR; let i=1; while (i<L.length-1&&L[i]<sv) i++; const f=Math.max(0,Math.min(1,(sv-L[i-1])/((L[i]-L[i-1])||1))); return [pts[i-1][0]+(pts[i][0]-pts[i-1][0])*f,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*f]; }
function startArrival(cb){ ARRIVAL={x:AX-40,y:450,a:0,h:220,s:0}; CINE={t:0,cb,sub:-1}; jj.hidden=true; paused=true; }
function updateCine(dt){ if (!CINE) return; const P=ARRIVAL; CINE.t+=dt;   // Flieger fliegt übers Flughafengelände – JJ springt mit dem Gleitschirm ab
  P.s=Math.min(ARR.total,P.s+250*dt); const [x,y]=arrAt(P.s), [x2,y2]=arrAt(Math.min(ARR.total,P.s+30)); P.x=x; P.y=y; const ta=Math.atan2(y2-y,x2-x); if (Math.hypot(x2-x,y2-y)>1){ let dd=ta-P.a; dd=Math.atan2(Math.sin(dd),Math.cos(dd)); P.a+=dd*Math.min(1,dt*3.5); } P.h=220;
  if (!CINE.ready&&P.s>60){ CINE.ready=true; if (!touch) toast("Drück E – spring raus!"); document.body.classList.add("jumpcue"); hudDirty=true; }
  if (P.x>AX+1550) { CINE.ready=true; finishArrival(); } }
function updateFlyaway(dt){ const P=ARRIVAL; if (!P||!P.fly||CINE||P.gone) return; P.x+=Math.cos(P.a)*250*dt; P.y+=Math.sin(P.a)*250*dt; P.h=Math.min(320,P.h+25*dt); if (P.x>WW+500) P.gone=true; }
// ---------- Safe-Minispiel: Zeiger dreht, im grünen Feld drücken – 3 Zahlen
let HACK=null; const HARR=["↑","→","↓","←"];
function openHack(cb){ HACK={cb,round:0,i:0,seq:[],ok:0,t:0}; newHackRound(); paused=true; $("hack").hidden=false; hackLog(); }
function newHackRound(){ const n=[4,5,6][HACK.round]; HACK.seq=Array.from({length:n},()=>Math.floor(rnd()*4)); HACK.i=0; renderHack(); }
function renderHack(){ $("hackSeq").innerHTML=HACK.seq.map((k,j)=>`<b class="${j<HACK.i?"done":""}">${HARR[k]}</b>`).join(""); const tot=4+5+6, done=[0,4,9][HACK.round]+HACK.i; $("hackBar").style.width=Math.round(done/tot*100)+"%"; }
function hackLog(){ if (!HACK) return; const hex=()=>Array.from({length:6},()=>"0123456789ABCDEF"[Math.floor(Math.random()*16)]).join(""); const L=$("hackLog"); L.textContent=(L.textContent+"\n> "+["decrypt","bypass","inject","handshake","sha256"][Math.floor(Math.random()*5)]+" 0x"+hex()+" … ok").split("\n").slice(-3).join("\n"); setTimeout(hackLog,260); }
function hackKey(k){ if (!HACK) return; if (k===HACK.seq[HACK.i]){ HACK.i++; sfx("hit"); if (HACK.i>=HACK.seq.length){ HACK.round++; if (HACK.round>=3){ renderHack(); $("hackBar").style.width="100%"; const H=HACK; HACK=null; sfx("ping"); setTimeout(()=>{ $("hack").hidden=true; paused=!!(DLG||cardMode); H.cb(); },450); return; } setTimeout(()=>{ if (HACK) newHackRound(); },250); } renderHack(); }
  else { sfx("crash"); $("hack").classList.add("err"); setTimeout(()=>$("hack").classList.remove("err"),300); HACK.i=0; renderHack(); } }
$("hack").addEventListener("pointerup",e=>{ const b=e.target.closest("button[data-k]"); if (b){ e.preventDefault(); hackKey(+b.dataset.k); } });
addEventListener("keydown",e=>{ if (!HACK) return; const m={ArrowUp:0,KeyW:0,ArrowRight:1,KeyD:1,ArrowDown:2,KeyS:2,ArrowLeft:3,KeyA:3}; if (e.code in m&&!e.repeat){ e.preventDefault(); e.stopImmediatePropagation(); hackKey(m[e.code]); } },true);
let SAFE=null;
function safeZone(st,a){ const w=[.62,.46,.34][st]; let c=a; for (let i=0;i<20&&Math.abs(Math.atan2(Math.sin(c-a),Math.cos(c-a)))<1.6;i++) c=rnd()*6.283; return {c,w}; }
function openSafe(cb){ SAFE={cb,stage:0,a:-Math.PI/2,dir:1,flash:0,shake:0,ok:0,last:performance.now()}; SAFE.zone=safeZone(0,SAFE.a); paused=true; $("safe").hidden=false; safeLights(); requestAnimationFrame(safeLoop); }
function closeSafe(done){ const S=SAFE; SAFE=null; $("safe").hidden=true; paused=!!(DLG||cardMode); if (done&&S) S.cb(); }
function safeLights(){ document.querySelectorAll("#safe .lights i").forEach((el,i)=>el.classList.toggle("on",SAFE&&i<SAFE.stage)); }
function safeHit(){ const S=SAFE; if (!S) return; const d=Math.atan2(Math.sin(S.a-S.zone.c),Math.cos(S.a-S.zone.c));
  if (Math.abs(d)<S.zone.w/2){ S.stage++; S.ok=.25; sfx("reload"); safeLights(); if (S.stage>=3){ setTimeout(()=>closeSafe(true),380); return; } S.dir*=-1; S.zone=safeZone(S.stage,S.a); }
  else { S.flash=.35; S.shake=.3; sfx("hit"); S.stage=Math.max(0,S.stage-1); safeLights(); S.zone=safeZone(S.stage,S.a); } }
function safeLoop(now){ const S=SAFE; if (!S) return; const dt=Math.min(.05,(now-S.last)/1000); S.last=now; S.a+=S.dir*(2.3+S.stage*.7)*dt; S.flash=Math.max(0,S.flash-dt); S.shake=Math.max(0,S.shake-dt); S.ok=Math.max(0,S.ok-dt);
  const c=$("safeC"), q=c.getContext("2d"), W=c.width, R2=W/2; q.setTransform(1,0,0,1,0,0); q.clearRect(0,0,W,W); const sh=S.shake>0?(Math.random()-.5)*14:0; q.translate(R2+sh,R2);
  const bg=q.createRadialGradient(-40,-40,20,0,0,R2); bg.addColorStop(0,"#5a5f66"); bg.addColorStop(1,"#1d2024"); q.fillStyle=bg; q.beginPath(); q.arc(0,0,R2-6,0,7); q.fill(); q.strokeStyle="#8a9098"; q.lineWidth=6; q.stroke();
  q.strokeStyle="rgba(126,227,106,.9)"; q.lineWidth=34; q.beginPath(); q.arc(0,0,R2-46,S.zone.c-S.zone.w/2,S.zone.c+S.zone.w/2); q.stroke();
  q.strokeStyle="#c9ced4"; for (let i=0;i<60;i++){ const a=i/60*6.283, l=i%5?10:22; q.lineWidth=i%5?2:4; q.beginPath(); q.moveTo(Math.cos(a)*(R2-24),Math.sin(a)*(R2-24)); q.lineTo(Math.cos(a)*(R2-24-l),Math.sin(a)*(R2-24-l)); q.stroke(); }
  q.fillStyle="#e9edf0"; q.font='700 26px "Barlow Semi Condensed",sans-serif'; q.textAlign="center"; q.textBaseline="middle"; for (let i=0;i<10;i++){ const a=i/10*6.283-Math.PI/2; q.fillText(i*10,Math.cos(a)*(R2-92),Math.sin(a)*(R2-92)); }
  const kg=q.createRadialGradient(-20,-20,6,0,0,70); kg.addColorStop(0,"#9aa1a9"); kg.addColorStop(1,"#3a3f45"); q.fillStyle=kg; q.beginPath(); q.arc(0,0,64,0,7); q.fill();
  q.save(); q.rotate(S.a); q.fillStyle=S.flash>0?"#ff453a":S.ok>0?"#7ee36a":"#ffb347"; q.beginPath(); q.moveTo(R2-30,0); q.lineTo(40,-12); q.lineTo(40,12); q.closePath(); q.fill(); q.restore();
  q.fillStyle="#1d2024"; q.beginPath(); q.arc(0,0,16,0,7); q.fill();
  if (S.flash>0){ q.fillStyle=`rgba(255,69,58,${S.flash})`; q.beginPath(); q.arc(0,0,R2-6,0,7); q.fill(); }
  requestAnimationFrame(safeLoop); }
$("safeBtn").addEventListener("pointerdown",e=>{ e.preventDefault(); safeHit(); });
$("safeC").addEventListener("pointerdown",e=>{ e.preventDefault(); safeHit(); });
$("safeX").addEventListener("click",()=>closeSafe(false));
addEventListener("keydown",e=>{ if (SAFE&&["Space","Enter","KeyE"].includes(e.code)&&!e.repeat){ e.preventDefault(); e.stopImmediatePropagation(); safeHit(); } else if (SAFE&&e.code==="Escape") closeSafe(false); },true);
// ---------- Mini-Tutorial: erklärt einmal die Anzeigen oben
// ---------- Fahrt mit Onkel Bobby zu Luka (währenddessen läuft das Tutorial) ----------
let RIDE=null; const RIDE_TO={x:3980,y:3005};
function setupRide(){ if (RIDE||MS.done.m2) return; const car=EARLCAR; if (car.gone||car.wreck) return; car.noBoard=true; car.driver=false; car.v=0;
  leaver("Onkel Bobby",EARL.x,EARL.y,"Komm, steig ein.",car.x+24,car.y,{gone:true,wait:1.2}); RIDE={car,t:0,phase:"walk",say:"",sayT:0,done:false,step:0,earl:LEAVERS[LEAVERS.length-1]}; }
function boardRide(){ const R2=RIDE; if (!R2||R2.phase!=="wait") return false; const car=R2.car; if (Math.hypot(jj.x-car.x,jj.y-car.y)>75) return false;
  hideNotif(); closePhone(); getIn(car); car.chauffeur=true; car.driver=true; R2.phase="drive"; R2.say="Anschnallen. Ich fahr wie meine Oma – also schnell."; R2.sayT=4.5; jj.lock=99; gps=null; renderObj(); { const tw=()=>{ if (!RIDE||RIDE.done) return; if (Math.abs(RIDE.car.v||0)>70) startTut(); else setTimeout(tw,300); }; setTimeout(tw,1200); } return true; }
function startRide(){ setupRide(); }
const RIDE_WP=[[930,2470],[1010,2530],[1120,2530],[1155,2610],[1155,2955],[1230,3005],[3980,3005]];
function chauffeurDrive(v,dt){ const R2=RIDE; let wi=R2.wi||0; let [gx,gy]=RIDE_WP[Math.min(wi,RIDE_WP.length-1)]; if (wi<RIDE_WP.length-1&&Math.hypot(gx-v.x,gy-v.y)<55){ R2.wi=++wi; [gx,gy]=RIDE_WP[wi]; }
  const d=Math.hypot(RIDE_TO.x-v.x,RIDE_TO.y-v.y); let df=Math.atan2(gy-v.y,gx-v.x)-v.a; df=Math.atan2(Math.sin(df),Math.cos(df));
  let thr=1, steer=Math.max(-1,Math.min(1,df*2.8)), brake=false; const nxt=RIDE_WP[wi+1], dw=Math.hypot(gx-v.x,gy-v.y);
  if (Math.abs(df)>.35&&v.v>90) { thr=0; brake=v.v>140; } if (nxt&&dw<160&&v.v>110) thr=0; if (v.v>175) thr=0; if (wi===RIDE_WP.length-1&&d<300) thr=Math.min(thr,.3); if (wi===RIDE_WP.length-1&&d<120){ thr=0; brake=true; }
  R2.blk=Math.max(0,(R2.blk||0)-dt*.5); const careful=R2.blk<2.5;
  if (careful) for (const o of vehicles){ if (o===v||o.gone||o.z>.2) continue; const ox=o.x-v.x, oy=o.y-v.y, ahead=ox*Math.cos(v.a)+oy*Math.sin(v.a), side=Math.abs(-ox*Math.sin(v.a)+oy*Math.cos(v.a)); if (ahead>0&&ahead<90&&side<26){ thr=0; brake=true; } }
  if (careful) for (const n of npcs){ if (n.dead) continue; const ox=n.x-v.x, oy=n.y-v.y, ahead=ox*Math.cos(v.a)+oy*Math.sin(v.a), side=Math.abs(-ox*Math.sin(v.a)+oy*Math.cos(v.a)); if (ahead>0&&ahead<70&&side<22){ thr=0; brake=true; if (!R2.honk){ R2.honk=1; sfx("ping"); } } }
  if (brake&&Math.abs(v.v)<15&&d>140) R2.blk+=dt*1.5; else if (R2.blk>=2.5&&R2.blk<4) R2.blk=4.5;
  return {thr,steer,brake}; }
function updateRide(dt){ const R2=RIDE; if (!R2) return; const v=R2.car; R2.sayT-=dt;
  if (R2.phase!=="drive"&&(MS.done.m2||MI&&MI.def.id==="m2")){ v.driver=false; RIDE=null; renderObj(); return; }
  if (R2.phase==="walk"){ if (!LEAVERS.includes(R2.earl)||R2.earl.gone&&R2.earl.done){ R2.phase="wait"; v.driver=true; sfx("door"); gps={n:"Onkel Bobbys Auto",x:v.x,y:v.y}; routeT=0; renderObj(); } return; }
  if (R2.phase==="wait") return;
  R2.t+=dt;
  if (R2.done){ if (v.gone||offView(v.x,v.y,100)){ v.gone=true; RIDE=null; } else if (!v.ai){ v.chauffeur=false; } return; }
  if (jj.veh!==v){ R2.done=true; v.chauffeur=false; jj.lock=0; return; }
  jj.lock=99; if (R2.t>13&&R2.step===0){ R2.step=1; R2.say="Luka … der hat mit 12 schon Autos aufgemacht. Laut, dumm, loyal."; R2.sayT=4.5; }
  const d=Math.hypot(RIDE_TO.x-v.x,RIDE_TO.y-v.y);
  if (R2.t>30&&d>300){ v.x=RIDE_TO.x-260; v.y=RIDE_TO.y; v.a=0; v.v=120; R2.wi=RIDE_WP.length-1; }
  if (d<140&&Math.abs(v.v)<25&&!TUT){ R2.done=true; v.v=0; jj.lock=0; exitVeh(true); v.chauffeur=false; v.driver=true; R2.say="Da vorne ist Luka. Und JJ … mach keinen Scheiß."; R2.sayT=4; sfx("door"); renderObj(); hudDirty=true;
    setTimeout(()=>{ if (RIDE&&RIDE.car===v){ v.ai=false; v.v=0; v.leaveT=1; } },400); } }
function drawRideSay(q){ const R2=RIDE; if (!R2||R2.sayT<=0) return; drawSay(q,R2.car.x,R2.car.y-44,"Bobby: "+R2.say); }

const TUT_STEPS=[
  {el:"obj",t:"Mission",p:L2("Hier steht dein nächstes Ziel.","Your next goal is shown here."),d:2.6},
  {el:"hpBox",t:"Leben",p:L2("Dein Leben heilt langsam von selbst.","Your health slowly heals on its own."),d:2.6},
  {el:"wanted",t:"Fahndung",p:L2("Sterne zeigen, wie sehr dich die Polizei jagt.","Stars show how hard the police are hunting you."),d:2.8},
  {el:"cash",t:"Bargeld",p:L2("Dein Geld in der Tasche.","The cash in your pocket."),d:2.4},
  {el:"phoneBtn",t:"Handy",p:L2("Nachrichten, Karte und Apps.","Messages, map and apps."),d:2.6},
  {el:"help",t:"Steuerung",p:L2("So steuerst du JJ.","This is how you control JJ."),d:2.6}];
let TUT=null, tutTried=false, tutWait=0;
function startTut(){ try{ if (localStorage.getItem("jjla-tut3")) return; }catch(e){} if (TUT||!started||DLG||cardMode||CINE) return;
  TUT={i:0,t:0}; $("tut").hidden=false; showTut(); }
function updateTut(dt){ if (!TUT) return; TUT.t+=dt; const st=TUT_STEPS[TUT.i]; if (TUT.t>((st&&st.d)||3.4)){ nextTut(); } else if (TUT.i<TUT_STEPS.length&&Math.floor(TUT.t*4)!==Math.floor((TUT.t-dt)*4)) showTut(); }
function showTut(){ const st=TUT_STEPS[TUT.i], el=$(st.el); if (!el||el.hidden||!el.getBoundingClientRect().width){ return nextTut(); }
  const r=el.getBoundingClientRect(), pad=6, hl=$("tutHl"), tip=$("tutTip");
  hl.style.left=(r.left-pad)+"px"; hl.style.top=(r.top-pad)+"px"; hl.style.width=(r.width+pad*2)+"px"; hl.style.height=(r.height+pad*2)+"px";
  tip.innerHTML=`<small>${TUT.i+1} / ${TUT_STEPS.length}</small><b>${st.t}</b><p>${st.p}</p><i style="width:${Math.min(100,TUT.t/(st.d||3.4)*100)}%;height:2px;background:var(--sun);padding:0;margin-top:8px"></i>`;
  const tw=Math.min(300,innerWidth-32), left=Math.max(16,Math.min(innerWidth-tw-16,r.left+r.width/2-tw/2)); tip.style.left=left+"px"; tip.style.top=(r.bottom+16)+"px"; }
function nextTut(){ if (!TUT) return; TUT.i++; TUT.t=0; if (TUT.i<TUT_STEPS.length){ showTut(); return; }
  $("tut").hidden=true; TUT=null; try{ localStorage.setItem("jjla-tut3","1"); }catch(e){} }
$("tutTip").addEventListener("pointerdown",e=>{ e.preventDefault(); e.stopPropagation(); nextTut(); });
function finishArrival(){ if (!CINE||!CINE.ready) return; document.body.classList.remove("jumpcue"); const P=ARRIVAL, cb=CINE.cb; CINE=null; $("dlg").hidden=true; $("dlg").classList.remove("sub"); document.body.classList.remove("talk"); jj.hidden=false; paused=!!(DLG||cardMode); $("toast").classList.remove("on"); jj.x=P.x; jj.y=P.y+14; jj.h=P.h+110; jj.roof=null; jj.veh=null; jj.glide={vx:Math.cos(P.a)*150,vy:Math.sin(P.a)*150+60}; jj.ang=Math.atan2(-jj.glide.vx,jj.glide.vy); P.fly=true; sfx("swing"); cb&&cb(); setTimeout(()=>{ barkT=0; bark("arrive"); },700); }
function drawArrival(q,vx,vy,air){ const P=ARRIVAL; if (!P||P.gone) return; if (air!==(P.h>2)) return; const k=1+P.h/D, X=vx+(P.x-vx)*k, Y=vy+(P.y-vy)*k;
  if (!air){ q.save(); q.translate(P.x+26,P.y+12); q.rotate(P.a); q.globalAlpha=.4; planeShape(q,"rgba(25,15,40,.6)"); q.restore(); q.globalAlpha=1; }
  else { q.save(); q.translate(P.x+P.h*.45,P.y+P.h*.17); q.rotate(P.a); q.globalAlpha=.25; planeShape(q,"rgba(25,15,40,.6)"); q.restore(); q.globalAlpha=1; }
  q.save(); q.translate(X,Y); q.rotate(P.a); q.scale(k,k); planeShape(q,"#f6f6f3","#ffb347");
  if (!air&&((CINE&&CINE.exit)||P.stairs)){ const t=CINE&&CINE.exit?CINE.exit.t:9;
    // Klappe öffnet sich (vordere Tür, rechte Seite)
    const o=Math.min(1,t/.4); q.fillStyle="#1d2329"; q.fillRect(39,8.6,9,2.6); q.save(); q.translate(48,10.6); q.rotate(o*1.3); q.fillStyle="#eceff2"; q.fillRect(0,-1.2,9,2.4); q.strokeStyle="rgba(0,0,0,.35)"; q.lineWidth=.5; q.strokeRect(0,-1.2,9,2.4); q.restore();
    // Notrutsche bläst sich auf
    if (t>.4){ const g2=Math.min(1,(t-.4)/.6), len=48*(g2<1?g2*(1+Math.sin(g2*Math.PI)*.12):1), y0=11, y1=y0+len;
      q.fillStyle="rgba(25,15,40,.25)"; q.fillRect(41,y0+4,14,len); q.fillStyle="#f2b31f"; rr(q,37.5,y0,13,len,4); q.fill(); q.fillStyle="#ffd25a"; q.fillRect(41,y0+2,6,Math.max(0,len-4)); q.fillStyle="#d18f0f"; q.fillRect(37.5,y0,2,len); q.fillRect(48.5,y0,2,len);
      if (len>40){ q.fillStyle="#f2b31f"; q.beginPath(); q.ellipse(44,y1,9,4,0,0,7); q.fill(); } }
    // JJ rutscht runter: klein im Flugzeug, normal groß unten
    if (t>1&&CINE){ const u=Math.min(1,(t-1)/1.25), e2=u*u, yy=9+(60-9)*e2, sc=.38+.62*Math.min(1,(t-1)/1.3); const stand=t>2.25;
      q.save(); q.translate(44,stand?60+Math.min(1,(t-2.25)/.4)*6:yy); q.scale(sc,sc); q.translate(-44,-(stand?60+Math.min(1,(t-2.25)/.4)*6:yy));
      drawPerson(q,{x:44,y:stand?60+Math.min(1,(t-2.25)/.4)*6:yy,ang:0,moving:stand,run:false,step:t*10,walkAmt:stand?1:0},LOOK); q.restore(); } }
  q.restore(); }
MDEF.push({id:"m1",n:"Willkommen zurück",loc:{x:726+AX,y:930},cash:0,ruf:50,intro:"",
  start(m){ m.step=0; if (!m.retry&&!ARRIVAL){ const go=()=>startArrival(()=>this.start2(m)); go(); return; } this.start2(m); },
  start2(m){ const car=vehicles.filter(v=>v.type==="taxi"&&!v.gone)[0]||vehicles.filter(v=>v.t.kind==="car"&&!v.gone).sort((a,b)=>Math.hypot(a.x-jj.x,a.y-jj.y)-Math.hypot(b.x-jj.x,b.y-jj.y))[0]; m.d.car=car; m.mark=car?[car]:null; obj("Geh zum Taxi",car); },
  tick(m){ 
    if (m.step===0&&jj.veh&&jj.veh.t.kind==="car"){ m.step=1; m.mark=null; obj("Fahr zu Onkel Bobbys Haus (folge dem Pfeil)",{x:DOOR.x,y:DOOR.y+40}); }
    else if (m.step===0&&m.d.car&&!jj.veh){ m.mark=[m.d.car]; }
    if (m.step===1&&nearP(DOOR,260)){ m.step=2; obj("Steig aus und sprich mit Onkel Bobby",EARL); }
  },
  talkTaxi(m){ m.d.asked=true; talk([["Fahrer","Eastside? 250 Dollar. Im Voraus."],["JJ","Ich hab sieben Dollar. Und Rizz."],["Fahrer","Rizz zahlt keine Miete. Verpiss dich."]],()=>obj("Kein Geld? Zieh den Fahrer raus und klau das Taxi!",m.d.car)); },
  talkEarl(m){ m.step=3; setTimeout(()=>{ if (!CHATS.mama.msgs.length) crewMsg("mama",MAMA_TXT()); },22000); talk([["Onkel Bobby","JJ?! Junge, du siehst aus wie ausgekotzt. Rein mit dir, bevor die Nachbarn die Bullen rufen."],["JJ","Sh*t … hab dich auch vermisst, Onkel Bobby."],["Onkel Bobby","Couch ist deine. Kühlschrank ist meiner. Fass mein Bier an und du pennst im Garten."],["JJ","Yunus sagt, Donny lebt."],["Onkel Bobby","Yunus sagt auch, die Mondlandung war ein Filmset. … Aber pass auf dich auf. Trau keinem."],["Onkel Bobby",L2("Ach ja: Luka hat angerufen. Er sagt, die Cuervos – die Gang vom Steg – waren in der Nacht dabei, als Donny verschwand. Er wartet am Strand, ganz am anderen Ende.","Oh, and Luka called. He says the Cuervos – the pier gang – were there the night Donny vanished. He is waiting at the far end of the beach.")],["JJ","Luka?! Der lebt noch?"],["Onkel Bobby","Lauter als je zuvor. Komm, ich fahr dich. Zu Fuß bist du ja eh nicht zu gebrauchen."]],()=>completeMission()); },
  after(){ startRide(); }});
MDEF.push({id:"m2",n:"Der Schläger",loc:{x:4120,y:3110},giver:[["Luka",44,-4]],cash:500,ruf:60,unlock:["bat"],unlockTxt:"Luka ist in der Crew",intro:"Luka wartet am anderen Ende vom Strand. Die Cuervos ziehen dort Leute ab – aber erst kaufst du dir einen Baseballschläger.",
  start(m){ talk([["Luka","JJ! Mein Bruder! Acht Jahre, Digga – und du siehst immer noch scheiße aus!"],["JJ","Und du redest immer noch zu laut, Luka."],["Luka",L2("Die Cuervos vom Steg waren in der Nacht in Venice, als Donny verschwand. Die wissen was. Mit leeren Händen gehst du da nicht hin.","The Cuervos from the pier were in Venice the night Donny vanished. They know something. Do not go there empty-handed.")],["Luka","Wir klauen uns 'ne Karre und fahren zu LA ARMS. Du holst dir 'nen Baseballschläger."],["JJ","Mit welchem Geld, Genie?"],["Luka","Mit meinem. Hier, 150 Dollar. Den Schläger darfst du behalten."]],()=>{ setTimeout(()=>showContact("luka"),700); cash+=150; hudDirty=true; toast("+$150 von Luka"); UNLOCK.bat=true; const g=giverSpots(this)[0]; m.ally={n:"Luka",x:g.x,y:g.y,ang:0,step:0,moving:false,cd:1.4}; m.ride=true; m.step=W.own.bat?3:0; if (m.step===3) this.toFoes(m); }); },
  say(m,t,o){ if (m.d.ot!==t){ m.d.ot=t; obj(t,o); } },
  toFoes(m){ m.step=3; this.say(m,"Fahr mit Luka zum Steg – zu den Cuervos",{x:930,y:3150}); },
  tick(m,dt){ const a=m.ally; if (!a) return; const v=jj.veh, P=v||jj, FOES={x:930,y:3150};
    if (m.step===0){ if (a.inCar){ m.step=1; } else this.say(m,v&&v.t.kind==="car"&&!v.driver?"Halt an – Luka steigt ein":"Klau ein Auto – Luka fährt mit"); }
    if (m.step===1){ this.say(m,"Fahr mit Luka zu LA ARMS",{x:SHOP.x,y:SHOP.y-30}); if (Math.hypot(P.x-SHOP.x,P.y-SHOP.y)<260){ m.step=2; allySay(a,"Geh rein und hol dir den Schläger. Ich wart hier.",3); } }
    if (m.step===2){ this.say(m,v?"Steig aus und geh in LA ARMS":"Geh rein und kauf den Baseballschläger",{x:SHOP.x,y:SHOP.y-10});
      if (W.own.bat&&!SHOPIN&&!shopOpen&&!DLG){ talk([["Luka","Ein Baseballschläger. Old School. Steht dir."],["JJ","Danke, Bro. Ich zahl's dir zurück."],["Luka","Zahl's den Cuervos heim. Mit dem Schläger."]],()=>{ if (W.own.bat) setWeapon("bat"); this.toFoes(m); }); m.step=2.5; } }
    if (m.step===3&&!DLG&&Math.hypot(P.x-FOES.x,P.y-FOES.y)<480){ m.step=4; m.noBoard=true; for (const [x,y] of [[880,3150],[930,3190],[980,3140]]) spawnFoe(x,y,{sp:105,stay:true}); toast("Da sind sie!"); }
    if (m.step===4){ const al=aliveFoes(); this.say(m,"Verprügel die Cuervos ("+(3-al)+"/3)");
      if (al===0&&!m.d.end){ m.d.end=1; talk([["Luka","HAHA! Hast du den Dicken fliegen sehen?!"],["Luka","Der Schläger steht dir, Bruder."],["Luka",L2("Und der Dicke hat geredet: Ein Bulle beschützt die Cuervos – Officer Cole. Yunus kennt sich mit so Leuten aus.","And the fat one talked: a cop protects the Cuervos – Officer Cole. Yunus knows how to handle guys like that.")]],()=>completeMission()); } } },
  after(){ crewMsg("yunus",L2("Hier Yunus. Officer Cole hat einen Laptop im Streifenwagen – da steht drin, wer die Cuervos bezahlt. Treffen im Park, Downtown.","Yunus here. Officer Cole keeps a laptop in his cruiser – it says who pays the Cuervos. Meet me in the park, downtown.")); }});
function roadSpotAway(x,y,rmin,rmax){ for (let k=0;k<60;k++){ const a=rnd()*6.283, r=rmin+rnd()*(rmax-rmin), px=x+Math.cos(a)*r, py=y+Math.sin(a)*r; if (onRoad(px,py)&&offView(px,py,80)&&!blockedAt(px,py,22)) return {x:px,y:py,a:Math.atan2(y-py,x-px)}; } return null; }
MDEF.push({id:"m3",n:"Der Hacker",loc:{x:PARK.x,y:BLOCKS[4].y+BLOCKS[4].h-30},giver:[["Yunus",44,-4]],cash:800,ruf:70,unlock:["shotgun"],unlockTxt:"Yunus ist in der Crew · Schrotflinte bei LA ARMS",intro:"Yunus braucht den Laptop aus Coles Streifenwagen. Cole sitzt im EL DORADO am Sunset Strip. Klau den Wagen, häng die Cops ab und park ihn vor Yunus' Garage am Strand.",
  start(m){ for (const s of SLOTS) if (s.type==="police"){ s.hold=true; if (s.v&&jj.veh!==s.v&&offView(s.v.x,s.v.y,200)){ s.v.gone=true; s.v=null; } }
    { const car=addVeh("police",PCAR.x,PCAR.y,PCAR.a,"",{missionV:true,keep:true}); car.driver=false; m.vehs.push(car); m.d.car=car; }
    m.cleanup=()=>{ for (const s of SLOTS) if (s.type==="police") s.hold=false; };
    talk([["Yunus","Psst! Die hören überall mit. Auch die Tauben."],["Yunus","Officer Cole futtert gerade Steak im EL DORADO am Sunset Strip. Sein Streifenwagen steht auf dem Parkplatz."],["Yunus","Laptop drin. Klau die Karre, häng die Bullen ab – und park ordentlich vor meiner Garage."]],()=>{ const car=m.d.car; m.d.go=true; m.mark=[car]; obj("Klau Coles Streifenwagen am Sunset Strip",car); }); },
  chaser(m){ const p=roadSpotAway(jj.x,jj.y,620,900); if (!p) return; const v=spawnChaser("police",p.x,p.y,p.a); v.chase=true; m.d.spawned=(m.d.spawned||0)+1; m.d.lastSp=m.d.cT; },
  tick(m,dt){ const car=m.d.car; if (!car||!m.d.go) return; if (car.wreck||car.gone){ failMission("Der Streifenwagen wurde zerstört."); return; }
    if (m.step===0&&jj.veh===car){ m.step=1; m.mark=null; car.lights=true; m.d.cT=0; m.d.esc=0; this.chaser(m); this.chaser(m); toast("Die Cops sind hinter dir!"); bark("crash",1); }
    if (m.step===1){ m.d.cT+=dt; const ch=m.vehs.filter(v=>v.chase&&!v.wreck&&!v.gone);
      if (m.d.cT>12&&!m.d.third){ m.d.third=1; this.chaser(m); }
      if (ch.length<2&&m.d.cT-(m.d.lastSp||0)>6&&(m.d.spawned||0)<7) this.chaser(m);
      const far=ch.every(v=>Math.hypot(v.x-car.x,v.y-car.y)>650); m.d.esc=Math.max(0,Math.min(1,m.d.esc+(far&&jj.veh===car?dt/9:-dt/16)));
      const n=Math.round(m.d.esc*8); obj(jj.veh===car?"Häng die Cops ab  "+"▰".repeat(n)+"▱".repeat(8-n):"Zurück in den Streifenwagen!");
      if ((m.d.esc>=1&&m.d.cT>=30)||(m.d.cT>=48&&far)){ m.step=2; for (const v of ch){ v.ai=false; v.v*=.3; v.chase=false; } obj("Park den Streifenwagen vor Yunus' Garage",PSPOT); m.park=Object.assign({ok:false},PSPOT); toast("Abgehängt!"); } }
    if (m.step>=1&&m.step<3){ if (jj.veh!==car&&!m.d.warn){ m.d.warn=1; m.mark=[car]; } if (jj.veh===car){ m.d.warn=0; m.mark=null; } }
    if (m.step===2&&jj.veh===car){ const dx=car.x-PSPOT.x, dy=car.y-PSPOT.y, al=Math.abs(dx*Math.cos(PSPOT.a)+dy*Math.sin(PSPOT.a)), sd=Math.abs(-dx*Math.sin(PSPOT.a)+dy*Math.cos(PSPOT.a));
      const da=Math.abs(Math.atan2(Math.sin(2*(car.a-PSPOT.a)),Math.cos(2*(car.a-PSPOT.a))))/2, ok=al<20&&sd<10&&da<.32; m.park.ok=ok;
      if (ok&&Math.abs(car.v)<14){ m.d.snap=(m.d.snap||0)+dt; const ta=Math.abs(Math.atan2(Math.sin(car.a-PSPOT.a),Math.cos(car.a-PSPOT.a)))<Math.PI/2?PSPOT.a:PSPOT.a+Math.PI, k=Math.min(1,dt*8); car.v=0; car.x+=(PSPOT.x-car.x)*k; car.y+=(PSPOT.y-car.y)*k; car.a+=Math.atan2(Math.sin(ta-car.a),Math.cos(ta-car.a))*k;
        if (m.d.snap>.5){ m.step=3; m.park=null; car.lights=false; car.v=0; toast("Sauber geparkt!"); sfx("ping"); m.ally={n:"Yunus",x:YGAR.x,y:YGAR.y-6,ang:0,step:0,moving:false,cd:9,w:"none"}; m.ride=true; allySay(m.ally,"Perfekt eingeparkt. Respekt, JJ.",4); obj("Yunus steigt zu dir ein …"); } }
      else m.d.snap=0; }
    if (m.step===3){ const a=m.ally; if (jj.veh!==car) allySay(a,"Bleib im Wagen – ich brauch die Bordelektronik!",6);
      if (a.inCar&&!DLG&&!HACK){ m.step=4; talk([["Yunus","Okay. Ich knack die Firewall, du tippst die Codes ab."],["JJ","Ich? Ich hab acht Jahre keinen Computer angefasst."],["Yunus","Pfeiltasten, JJ. Pfeiltasten."]],()=>{ obj("Entschlüssel den Laptop"); openHack(()=>{ m.step=5; talk([["Yunus","Drin! Cole hat einen Namen eingekreist: SANTORO."],["Yunus",L2("Santoro lässt heute was am Hafen abholen. Paul war mit Donny bei den Marines – er beobachtet die Cuervos schon.","Santoro has something picked up at the harbor today. Paul served with Donny in the Marines – he is already watching the Cuervos.")],["Yunus","Und er weiß, dass du's warst. Bestell keine Pizza."]],()=>{ m.ride=false; if (a.inCar) exitRider(a); car.keep=false; completeMission(); }); }); }); } } },
  after(){ crewMsg("paul","Paul. Luka sagt, du bist gut. Hafen, beim Frachter. Komm allein."); }});
const DOCK={x:YACHT.x-YACHT.l/2-30,y:YACHT.y+6,a:0,l:56,w:30};
MDEF.push({id:"m4",n:"Die Probe",loc:{x:5262,y:3122},giver:[["Paul",44,-4]],cash:2000,ruf:80,unlock:["scar"],unlockTxt:"Paul ist in der Crew · SCAR bei LA ARMS",intro:"Paul, der Scharfschütze, wartet am Hafen. Er will sehen, was du draufhast: Heb das Versteck der Cuervos am Steg aus und bring ihm die Tasche auf seine Yacht.",
  start(m){ talk([["Paul","Luka sagt, du bist gut. Ich glaub Luka gar nichts."],["JJ","Klug von dir."],["Paul","Am Steg drüben am Strand bunkern Cuervos ihre Ware. Räum auf und bring mir die Tasche."],["Paul","Ich warte auf meiner Yacht. Nimm den Jetski am Steg."]],()=>{ m.d.paul=fig(m,"Paul",YACHT.x-56,YACHT.y-4,{w:"shotgun",face:{x:DOCK.x,y:DOCK.y}}); m.step=W.own.shotgun?1:0; if (m.step===0) obj("Kauf dir eine Schrotflinte bei LA ARMS",{x:SHOP.x,y:SHOP.y-30}); else this.goPier(m); }); },
  goPier(m){ m.step=1; for (const [x,y,wp] of [[930,3425,"pistol"],[1000,3440,null],[960,3455,"pistol"],[1020,3415,null],[968,3320,null]]) spawnFoe(x,y,{weapon:wp,sp:wp?95:110,look:GANG_LOOK}); obj("Schalte die Cuervos am Steg aus (0/5)",{x:970,y:3300}); },
  tick(m){ if (m.step===0&&W.own.shotgun){ this.goPier(m); }
    if (m.step===1){ const a=aliveFoes(); obj("Schalte die Cuervos am Steg aus ("+(5-a)+"/5)"); if (a===0){ m.step=2; m.bag={x:970,y:3445,taken:false}; obj("Schnapp dir die Tasche",m.bag); } }
    if (m.step===2&&!jj.veh&&nearP(m.bag,22)){ m.bag.taken=true; m.step=3; sfx("reload"); for (const [x,y] of [[860,3110],[1080,3105],[1160,3130]]) spawnFoe(x,y,{weapon:"pistol",sp:95}); toast("Verstärkung am Strand!"); m.d.inBoat=null; }
    if (m.step===3){ const v=jj.veh, inBoat=!!(v&&v.t.kind==="boat");
      if (inBoat!==m.d.inBoat){ m.d.inBoat=inBoat;
        if (inBoat){ obj("Bring die Tasche zu Paul – leg an der Yacht an",DOCK); m.park=Object.assign({ok:false},DOCK); m.mark=null; }
        else { let best=null, bd=1e9; for (const b of vehicles) if (b.t.kind==="boat"&&!b.gone&&!b.wreck&&!b.sinking){ const d=Math.hypot(b.x-jj.x,b.y-jj.y)+(b.type==="jetski"?0:5000); if (d<bd){ bd=d; best=b; } }
          m.d.ski=best; obj("Lauf zum Jetski am Steg",best||DOCK); m.mark=best?[best]:null; m.park=null; } }
      if (inBoat&&m.park){ const ok=Math.hypot(v.x-DOCK.x,v.y-DOCK.y)<30&&Math.abs(v.v)<45; m.park.ok=ok;
        if (ok&&!m.talk){ obj("Drück "+(touch?"REDEN":"E")+" – sprich mit Paul"); m.talk={ok:()=>!!(jj.veh&&jj.veh.t.kind==="boat"&&Math.hypot(jj.veh.x-DOCK.x,jj.veh.y-DOCK.y)<34),fn:()=>{ m.step=4; m.park=null; jj.veh.v=0; talk([["Paul","Saubere Arbeit. Ich hatte dich die ganze Zeit im Visier."],["JJ","Beruhigend. Glaub ich."],["Paul",L2("In der Tasche: Flugpläne von Mos Heli-Service. 14. Juni 2018 – die Nacht, in der Donny verschwand.","In the bag: flight logs from Mo's heli service. June 14, 2018 – the night Donny vanished.")],["JJ",L2("Dann reden wir mit Mo.","Then we talk to Mo.")],["Paul","Ich bin dabei. Für Donny."]],()=>completeMission()); }}; }
        else if (!ok&&m.talk){ m.talk=null; obj("Bring die Tasche zu Paul – leg an der Yacht an",DOCK); } } } },
  after(){ crewMsg("marco","Hier Mo, Heli-Pilot. Ich weiß was über Donny. Mein Heliport im Industriegebiet. Schnell!"); }});
MDEF.push({id:"m5",n:"Der Pilot",loc:{x:HELIPAD.x,y:HELIPAD.y+150},giver:[["Mo",44,-4]],cash:1500,ruf:80,unlock:["heli","pickup","gl"],unlockTxt:"Privat-Heli · Granatwerfer bei LA ARMS",intro:"Mo hat in der Nacht, als Donny verschwand, zwei Männer und einen Jungen geflogen. Die Cuervos wollen ihn zum Schweigen bringen.",
  start(m){ for (const s of SLOTS) if (s.type==="heli"){ s.hold=true; if (s.v&&jj.veh!==s.v){ s.v.gone=true; s.v=null; } }
    const h=addVeh("heli",HELIPAD.x,HELIPAD.y,0,"#15161a",{mission:true,missionV:true,keep:true}); h.t=Object.assign({},VT.heli,{n:"Mo's Heli",hp:260}); h.hp=260; h.noBoard=true; m.vehs.push(h); m.d.h=h;
    m.cleanup=()=>{ for (const s of SLOTS) if (s.type==="heli") s.hold=false; };
    talk([["Mo","Damals hab ich zwei Typen und einen Jungen mit Locken geflogen."],["JJ","Donny. Wohin?"],["Mo","Zeig ich dir. Erst halt die Cuervos vom Heli fern!"]],()=>{ this.wave(m,0); }); },
  wave(m,i){ m.d.wave=i; const pts=(i===0?[[-360,-200,"pistol"],[-260,200,null],[300,-220,null]]:[[380,110,"pistol"],[-380,180,"pistol"],[300,220,null],[-60,-250,null]]).map(([x,y,w])=>[x+HELIPAD.x,y+HELIPAD.y,w]);
    m.d.wf=pts.map(([x,y,wp],k)=>spawnFoe(x,y,{weapon:wp,sp:wp?95:115})); obj("Halt die Cuervos von Mo fern! Welle "+(i+1)+"/2"); },
  tick(m){ const h=m.d.h; if (!h) return; if ((h.wreck||h.gone)&&m.step<2){ failMission("Mo's Heli wurde zerstört."); return; }
    if (m.step===0&&aliveFoes(m.d.wf)===0&&m.d.wf&&m.d.wf.length){ if (m.d.wave===0){ m.d.wf=[]; setTimeout(()=>{ if (MI===m) this.wave(m,1); },1500); m.d.wave=-1; } else if (m.d.wave===1){ m.step=1; h.hp=h.t.hp; h.burn=0; h.noBoard=true; h.inv=true; h.crashing=false; talk([["Mo","Fast in die Hose gemacht. Steig ein."]],()=>{ m.d.brief=false; const g=giverSpots(this)[0]; obj("Mo steigt ein …",h);
          walkTo(m,"Mo",g.x,g.y,()=>h.x+Math.sin(h.a)*16,()=>h.y-Math.cos(h.a)*16,()=>{ h.noBoard=false; h.spin=true; sfx("door"); m.mark=[h]; obj("Steig zu Mo in den Heli",h); }); }); } }
    if (m.step===1&&jj.veh===h){ m.step=2; m.mark=null; const b=buildings.filter(b=>b.style==="crown").sort((a,b2)=>b2.H-a.H)[0]; m.d.tower=b;
      h.priv=true; h.auto=true; h.mode="fly"; h.tx=b.x+b.w/2; h.ty=b.y+b.h/2; h.tz=b.H/240; obj("Mo fliegt dich zum Ort von damals …"); }
    if (m.step===2&&!jj.veh&&jj.roof){ m.step=3; h.noBoard=true; talk([["Mo","Santoro Tower. Hier sind sie raus."],["Mo","Scheiße, Security! Spring mit dem Gleitschirm!"],["JJ","Mit dem WAS?! F*ck."]],()=>{ privLeave(h); obj("Spring vom Dach und lande im Park",PARK); }); }
    if (m.step===3&&!jj.glide&&!jj.h&&nearP(PARK,220)){ m.step=4; privLeave(h); h.keep=true; talk([["Mo","(am Handy) Du lebst? Geil. Ruf mich, wenn du 'nen Heli brauchst."],["Mo",L2("Und JJ: Der Junge hat noch gelebt, als sie ihn in den Tower gebracht haben. Luka hat einen Plan, wie wir Santoro wehtun.","And JJ: the kid was still alive when they took him into the tower. Luka has a plan to hurt Santoro.")]],()=>completeMission()); } },
  after(){ crewMsg("luka",L2("Crew ist komplett. Santoro feiert heute in Palm Heights – sein Geld liegt in der Villa. Wir nehmen es ihm weg. Komm nach Hause.","Crew is complete. Santoro is partying in Palm Heights tonight – his money is in the villa. We take it. Come home.")); }});
// ---------- Villa innen + Flucht-Jet ----------
const ROOMSOL=[R(VR.x,VR.y,VR.w,16),R(VR.x,VR.y+VR.h-16,350,16),R(VR.x+410,VR.y+VR.h-16,VR.w-410,16),R(VR.x,VR.y,16,VR.h),R(VR.x+VR.w-16,VR.y,16,VR.h),
  R(5610,3426,16,150),R(5626,3560,100,16),R(5070,3440,170,26),R(5300,3500,120,64),R(5440,3436,100,26),R(5070,3540,26,90),R(5470,3600,110,24)];
const RDOOR={x:5420,y:3650}, RSAFE={x:5776,y:3452};
function drawVillaRoom(q,t){ if (!INROOM) return; q.fillStyle="#e9e2d4"; q.fillRect(VR.x,VR.y,VR.w,VR.h); for (let y=VR.y;y<VR.y+VR.h;y+=40) for (let x=VR.x;x<VR.x+VR.w;x+=40){ q.fillStyle=((x+y)/40)%2?"#ded5c3":"#f1ebde"; q.fillRect(x,y,40,40); }
  q.fillStyle="#7a1d2a"; q.fillRect(5260,3590,200,60); q.fillStyle="#3a2c22"; q.fillRect(5626,3426,178,134);
  const ws=r=>{ q.fillStyle="#2a2228"; q.fillRect(r.x,r.y,r.w,r.h); q.fillStyle="#4a3f48"; q.fillRect(r.x,r.y,r.w,3); };
  ROOMSOL.slice(0,7).forEach(ws);
  q.fillStyle="#3b2a20"; q.fillRect(5070,3440,170,26); q.fillStyle="#c9a26a"; q.fillRect(5070,3440,170,5); for (let i=0;i<7;i++){ q.fillStyle=["#6fd08a","#c9302c","#ffd23f","#58d0ff"][i%4]; q.fillRect(5080+i*22,3448,6,12); }
  q.fillStyle="#5a3a24"; q.fillRect(5296,3496,128,72); q.fillStyle="#1e6b3c"; q.fillRect(5304,3504,112,56); q.fillStyle="#fff"; q.beginPath(); q.arc(5330,3530,3,0,7); q.fill(); q.fillStyle="#c9302c"; q.beginPath(); q.arc(5380,3520,3,0,7); q.arc(5390,3545,3,0,7); q.fill();
  q.fillStyle="#141418"; q.fillRect(5440,3436,100,26); const pu=.5+.5*Math.sin(t*8); q.fillStyle=`rgba(255,${80+pu*120},220,.9)`; q.fillRect(5450,3442,20,14); q.fillStyle=`rgba(80,${200-pu*80},255,.9)`; q.fillRect(5510,3442,20,14);
  q.fillStyle="#2e3a52"; q.fillRect(5070,3540,26,90); q.fillRect(5470,3600,110,24); q.fillStyle="#3d4c6a"; q.fillRect(5074,3544,18,82); q.fillRect(5474,3604,102,16);
  q.save(); q.globalCompositeOperation="lighter"; for (let i=0;i<5;i++){ const a=t*.7+i*1.3, x=5300+Math.cos(a)*180, y=3540+Math.sin(a*1.3)*80; const g=q.createRadialGradient(x,y,2,x,y,70); g.addColorStop(0,["rgba(255,60,200,.18)","rgba(60,200,255,.16)","rgba(255,210,60,.14)"][i%3]); g.addColorStop(1,"rgba(0,0,0,0)"); q.fillStyle=g; q.fillRect(x-70,y-70,140,140); } q.restore();
  drawBigSafe(q,RSAFE.x,RSAFE.y-12,!!(MI&&MI.def.id==="m6"&&MI.step>=7),t);
  q.fillStyle="rgba(255,255,255,.8)"; q.font='700 10px "Barlow Semi Condensed",sans-serif'; q.textAlign="center"; q.fillText("AUSGANG",RDOOR.x,VR.y+VR.h-22); }
const SAFECASH=[...Array(46)].map((_,i)=>{ const a=-Math.PI*.15-rnd()*Math.PI*.95, r=18+rnd()*rnd()*70; return {x:Math.cos(a)*r,y:30+Math.abs(Math.sin(a))*r*.55+rnd()*16,a:rnd()*3,st:rnd()<.35?1+Math.floor(rnd()*3):0}; });
function drawBigSafe(q,x,y,open,t){ q.save(); q.translate(x,y);
  q.fillStyle="rgba(0,0,0,.35)"; q.fillRect(-22,-16,52,44);
  const gr=q.createLinearGradient(-26,-22,26,22); gr.addColorStop(0,"#6b727c"); gr.addColorStop(.5,"#4a5058"); gr.addColorStop(1,"#30353c"); q.fillStyle=gr; rr(q,-26,-22,52,44,4); q.fill(); q.strokeStyle="#1d2026"; q.lineWidth=1.5; q.stroke();
  q.fillStyle="#2a2e34"; for (const [bx,by] of [[-22,-18],[18,-18],[-22,16],[18,16]]){ q.beginPath(); q.arc(bx+2,by+2,2,0,7); q.fill(); }
  if (!open){ q.fillStyle="#3a3f46"; rr(q,-20,-16,40,32,3); q.fill(); q.fillStyle="#9aa2ac"; q.beginPath(); q.arc(-4,0,9,0,7); q.fill(); q.fillStyle="#2a2e34"; q.beginPath(); q.arc(-4,0,6,0,7); q.fill(); q.strokeStyle="#d8d0c0"; q.lineWidth=1; for (let i=0;i<12;i++){ const a=i/12*6.283; q.beginPath(); q.moveTo(-4+Math.cos(a)*6,Math.sin(a)*6); q.lineTo(-4+Math.cos(a)*8.5,Math.sin(a)*8.5); q.stroke(); } q.fillStyle="#c9a24a"; q.fillRect(9,-7,4,14); q.fillRect(7,-2,8,4); }
  else { q.fillStyle="#15171b"; rr(q,-20,-16,40,32,3); q.fill(); for (let r=0;r<3;r++) for (let c=0;c<4;c++){ q.fillStyle=(r+c)%2?"#2f7d3a":"#3b9a49"; q.fillRect(-18+c*9,-14+r*10,8,8); q.fillStyle="rgba(255,255,255,.35)"; q.fillRect(-18+c*9,-11+r*10,8,1.5); }
    q.save(); q.translate(-26,-22); q.rotate(-1.2); q.fillStyle="#565c65"; rr(q,0,0,46,44,4); q.fill(); q.fillStyle="#9aa2ac"; q.beginPath(); q.arc(20,22,8,0,7); q.fill(); q.restore();
    if (!(MI&&MI.def.id==="m6")) for (const b of SAFECASH){ q.save(); q.translate(b.x,b.y); q.rotate(b.a); q.fillStyle="rgba(0,0,0,.2)"; q.fillRect(-6,-2,13,8); const n=b.st||1; for (let k=0;k<n;k++){ q.fillStyle=k%2?"#3fa04e":"#5cbf63"; q.fillRect(-7,-4-k*2,13,7); q.fillStyle="#2a6b33"; q.fillRect(-7,-4-k*2,13,1); q.fillStyle="#e8f2e0"; q.fillRect(-2,-3.2-k*2,3,5); } q.restore(); }
    q.globalCompositeOperation="lighter"; const s2=.5+.5*Math.sin(t*4); q.fillStyle=`rgba(255,240,170,${.12*s2})`; q.beginPath(); q.arc(0,10,60,0,7); q.fill(); }
  q.restore(); }
function enterVilla(m){ INROOM=true; Object.assign(VR,VILLA_VR); CURSOL=ROOMSOL.slice(); for (const r of ROOMSOL) solids.push(r); if (jj.veh) exitVeh(true); jj.x=RDOOR.x; jj.y=RDOOR.y-24; jj.ang=Math.PI; cam.x=jj.x; cam.y=jj.y; sfx("door");
  allyList(m).forEach((a,i)=>{ a.x=RDOOR.x-60+i*60; a.y=RDOOR.y-70; a.vx=a.vy=0; a._nav=null; a._slot=null; }); }
function exitVilla(m,to){ INROOM=false; CURSOL=[]; for (const r of ROOMSOL){ const i=solids.indexOf(r); if (i>=0) solids.splice(i,1); } jj.x=to.x; jj.y=to.y; jj.ang=0; cam.x=jj.x; cam.y=jj.y; sfx("door");
  allyList(m).forEach((a,i)=>{ a.x=to.x-40+i*40; a.y=to.y+30; a.vx=a.vy=0; a._nav=null; a._slot=null; }); }
let CINEMA=false; function setCinema(on){ CINEMA=!!on; document.body.classList.toggle("cinema",CINEMA); } function blackout(on){ $("blackout").classList.toggle("on",!!on); }
let ESC=null; const JETP={x:AX+980,y:722,a:0};
function drawEscape(q,vx,vy,air){ const P=ESC; if (!P||P.gone) return; if (air!==(P.h>2)) return; const k=1+P.h/D, X=vx+(P.x-vx)*k, Y=vy+(P.y-vy)*k, sc=.72;
  q.save(); q.translate(P.x+18+P.h*.45,P.y+8+P.h*.17); q.rotate(P.a); q.scale(sc,sc); q.globalAlpha=air?.22:.35; planeShape(q,"rgba(25,15,40,.6)"); q.restore(); q.globalAlpha=1;
  q.save(); q.translate(X,Y); q.rotate(P.a); q.scale(k*sc,k*sc); planeShape(q,"#f4f2ee","#1d2733"); q.fillStyle="#d8b35a"; q.fillRect(-40,-2,70,4); q.restore();
  if (!air&&P.phase==="wait"){ q.save(); q.translate(P.x+27,P.y+10); q.fillStyle="rgba(0,0,0,.25)"; q.fillRect(3,3,14,40); q.fillStyle="#e8e4dc"; q.fillRect(0,0,14,40); q.fillStyle="#9aa2ac"; for (let y=3;y<40;y+=5) q.fillRect(0,y,14,1.5); q.fillStyle="#5d636a"; q.fillRect(-1,0,1.5,40); q.fillRect(13.5,0,1.5,40); q.restore(); } }
function updateEscape(dt){ const P=ESC; if (!P||P.gone) return; P.t+=dt;
  if (P.phase==="land"){ P.x+=P.v*dt; if (P.h>0){ P.h=Math.max(0,P.h-85*dt); if (P.h===0){ sfx("hit"); shake=Math.max(shake,4); } } else P.v=Math.max(0,P.v-150*dt);
    if (P.v<=0){ P.phase="parked"; P.cam=false; setCinema(false); blackout(false); jj.hidden=false; jj.lock=0; jj.x=P.x-20; jj.y=P.y+130; jj.ang=0; cam.x=jj.x; cam.y=jj.y; jjSay(L2("Zurück in L.A. Erst mal zu Onkel Bobby.","Back in L.A. First stop: Uncle Bobby."),3.6); gps={n:L2("Onkel Bobby","Uncle Bobby"),x:DOOR.x+60,y:DOOR.y+46}; routeT=0; toast(L2("GPS: Onkel Bobby in Eastside","GPS: Uncle Bobby in Eastside")); } }
  if (P.phase==="parked"&&Math.hypot(jj.x-P.x,jj.y-P.y)>1600) ESC=null; if (P.phase==="roll"){ P.v=Math.min(520,P.v+120*dt); P.x+=Math.cos(P.a)*P.v*dt; P.y+=Math.sin(P.a)*P.v*dt; if (P.v>260) P.h=Math.min(360,P.h+(P.v-260)*.35*dt); if (!P.done&&(P.fix?(P.h>60&&P.x>P.fix.x&&offView(P.x,P.y,160)):(P.h>280&&P.x>JETP.x+2300))){ P.done=true; if (P.fix){ blackout(true); setTimeout(()=>P.cb&&P.cb(),1400); } else P.cb&&P.cb(); } if (P.x>WW+600) P.gone=true; }
  if (P.fix){ jj.x=P.fix.x; jj.y=P.fix.y; jj.lock=99; } else if (P.cam){ jj.x=P.x; jj.y=P.y; jj.lock=99; } }
MDEF.push({id:"m6",n:"Party in Palm Heights",loc:{x:DOOR.x+70,y:DOOR.y+40},giver:[["Luka",-78,16],["Yunus",0,-30],["Paul",78,16]],cash:10000,ruf:150,unlock:["rpg","alien"],unlockTxt:"Raketenwerfer & Alien-Blaster bei LA ARMS",intro:"Der erste große Coup: Ein reicher Typ feiert in seiner Villa in Palm Heights. Rein, aufräumen, Safe knacken – und dann fliegt Mo euch raus.",
  start(m){ const L=VILLA, b=L.b; m.d.gate={x:L.drive.x+L.drive.w/2,y:L.ly+L.lh+12}; m.d.door={x:b.x+b.w/2,y:b.y+b.h+16};
    talk([["Luka","Villa in Palm Heights. Party. Der Safe ist voll."],["Yunus","Ich hack das Tor, Paul hält draußen Wache. Wir gehen rein und räumen auf."],["Paul","Mo wartet danach mit dem Jet am Flughafen. Wir verschwinden aus L.A."],["JJ","Und am Ende brennt wieder irgendwas."]],()=>{
      m.d.brief=false; m.allies=giverSpots(this).map(g=>({n:g.n,x:g.x,y:g.y,ang:0,step:0,moving:false,cd:1,pro:true,w:g.n==="Paul"?"shotgun":"pistol"})); m.ride=true; m.step=0; }); },
  say(m,t,o){ if (m.d.ot!==t){ m.d.ot=t; obj(t,o); } },
  drop(m,x,y,v){ pickups.push({x,y,v,t:-1e9,loot:m}); },
  bring(m,x,y){ for (const a of m.allies) if (!a.inCar&&Math.hypot(a.x-x,a.y-y)>500){ const p=landNear(x+(rnd()-.5)*80,y+40); a.x=p.x; a.y=p.y; a._nav=null; } },
  tick(m,dt){ const d=m.d, L=VILLA, b=L.b, A=m.allies||[], v=jj.veh; updateEscape(dt);
    if (m.step===0){ const inN=A.filter(a=>a.inCar).length; this.say(m,v&&v.t.kind==="car"&&!v.driver?(inN<A.length?"Halt an – die Crew steigt ein ("+inN+"/"+A.length+")":"Fahr zur Villa in Palm Heights"):"Klau ein Auto – die Crew steigt mit ein",inN===A.length?d.gate:null); if (inN===A.length&&A.length){ m.step=1; obj("Fahr zur Villa in Palm Heights",d.gate); } }
    if (m.step<=1&&!v&&nearP(d.gate,260)&&A.length){ m.step=2; m.noBoard=true; this.bring(m,jj.x,jj.y);
      const yu=A.find(a=>a.n==="Yunus"), pa=A.find(a=>a.n==="Paul"); m.allies=A.filter(a=>a.n==="Luka");
      d.yun=fig(m,"Yunus",yu.x,yu.y,{tx:d.gate.x+36,ty:d.gate.y+6,face:d.gate,w:"pistol",arrive:()=>{ d.yun.bar=0; d.yun.lap=true; figSay(d.yun,"Firewall von 2009? Süß."); }});
      d.paul=fig(m,"Paul",pa.x,pa.y,{tx:d.gate.x-90,ty:d.gate.y+34,w:"shotgun",face:{x:b.x+b.w/2,y:b.y+b.h/2}}); obj("Gib Yunus Deckung – er hackt das Tor"); }
    if (m.step===1&&v&&nearP(d.gate,260)) this.say(m,"Steig aus – die Crew steigt mit aus",d.gate);
    if (m.step===2){ const y=d.yun; if (y&&y.bar>=0){ y.bar+=dt/7;
        if (y.bar>.35&&!d.early){ d.early=1; d.g0=[[b.x+40,b.y+b.h+30],[b.x+b.w-40,b.y+b.h+30]].map(([x,yy])=>spawnFoe(x,yy,{weapon:"pistol",look:GUARD_LOOK,sp:90,stay:true})); figSay(y,"Die haben uns gesehen – Deckung!"); }
        if (y.bar>=1){ y.bar=-1; y.lap=false; m.step=3; sfx("ping"); toast("Tor offen!"); const pts=[[b.x-30,b.y+40],[b.x+b.w+30,b.y+30],[b.x+40,b.y+b.h+40],[b.x+b.w-40,b.y+b.h+40],[b.x+b.w/2,b.y-60],[L.pool.x+L.pool.w/2,L.pool.y-30],[b.x-60,b.y+b.h+10],[b.x+b.w+60,b.y+b.h+10],[L.drive.x+20,L.ly+L.lh-60],[b.x+b.w/2+40,b.y-90]];
          d.g=pts.map(([x,yy])=>spawnFoe(x,yy,{weapon:"pistol",look:GUARD_LOOK,sp:90,stay:true})).concat(d.g0||[]); d.snipe=2; y.gone=true; m.allies.push({n:"Yunus",x:y.x,y:y.y,ang:y.ang,step:0,moving:false,cd:.5,pro:true,w:"pistol",say:"Tor offen. Jetzt wird's laut!",sayT:2.6}); } } }
    if (m.step===3){ const al=aliveFoes(d.g), n=d.g.length; this.say(m,"Schalte die Wachen vor der Villa aus ("+(n-al)+"/"+n+")");
      d.snipe-=dt; const P=d.paul; if (d.snipe<=0&&al>0&&P){ d.snipe=3.5; let t=null, bd=1e9; for (const g of d.g) if (!g.dead){ const dd=Math.hypot(g.x-P.x,g.y-P.y); if (dd<bd){ bd=dd; t=g; } }
        if (t){ const fa=Math.atan2(t.y-P.y,t.x-P.x); P.ang=Math.atan2(-Math.cos(fa),Math.sin(fa)); P.face=null; tracers.push({x1:P.x+Math.cos(fa)*16,y1:P.y+Math.sin(fa)*16,x2:t.x,y2:t.y,t:.12}); emit("flash",P.x+Math.cos(fa)*16,P.y+Math.sin(fa)*16,{size:40,life:.08,max:.08}); sfx("shot"); killNpc(t,Math.cos(fa)*200,Math.sin(fa)*200); if (rnd()<.5) figSay(P,["Einer weniger.","Mhm.","Sauber."][Math.floor(rnd()*3)]); } }
      if (al===0){ m.step=4; const P=d.paul; if (P&&!P.gone){ P.gone=true; m.allies.push({n:"Paul",x:P.x,y:P.y,ang:0,step:0,moving:false,cd:.6,pro:true,w:"shotgun",say:L2("Draußen ist sauber. Ich komm mit rein.","Outside is clear. I'm coming in."),sayT:2.6}); } obj(L2("Rein in die Villa – die ganze Crew kommt mit","Into the villa – the whole crew comes along"),d.door); } }
    if (m.step===4&&!v&&d.goIn){ m.step=5; enterVilla(m); d.gi=[[5150,3500],[5250,3610],[5360,3460],[5520,3520],[5560,3470],[5700,3620],[5760,3500],[5150,3630]].map(([x,yy])=>spawnFoe(x,yy,{weapon:"pistol",look:GUARD_LOOK,sp:85,stay:true})); toast("Drinnen!"); allySay(m.allies[0],"Party ist vorbei, Jungs!",3); this.cash=0; d.loot=0; d.lootN=0; for (const [x,yy] of [[5280,3480],[5440,3580],[5200,3600],[5600,3630]]) this.drop(m,x,yy,500); }
    if (m.step===5){ const al=aliveFoes(d.gi), n=d.gi.length; this.say(m,"Räum die Villa auf ("+(n-al)+"/"+n+")"); if (al===0){ m.step=6; obj("Knack den Safe im Büro",RSAFE); allySay(m.allies.find(a=>a.n==="Yunus")||m.allies[0],"Safe ist im Büro. Hör auf die Klicks, JJ.",3); } }
    if (m.step===6&&!SAFE&&!DLG&&nearP(RSAFE,40)&&!d.safeArmed){ d.safeArmed=1; openSafe(()=>{ m.step=7; sfx("reload"); for (let i=0;i<8;i++) this.drop(m,5660+(i%4)*34,3490+Math.floor(i/4)*36,1000); talk([["JJ","Holy sh*t. So viel Kohle."],["Luka",L2("Sammel alles ein, was rumliegt – dann RAUS! Verstärkung kommt!","Grab everything lying around – then OUT! Backup is coming!")]],()=>{}); }); }
    if (m.step===6&&d.safeArmed&&!SAFE&&!nearP(RSAFE,70)) d.safeArmed=0;
    if (m.step===7) this.say(m,L2("Sammle das Geld ein ($"+(d.loot||0).toLocaleString("de-DE")+" / $10.000) – dann raus","Grab the cash ($"+(d.loot||0).toLocaleString("en-US")+" / $10,000) – then get out"),RDOOR);
    if (m.step===7&&jj.y>RDOOR.y-6&&Math.abs(jj.x-RDOOR.x)<40){ if (!d.loot) toast(L2("Du gehst ohne Geld raus …","You leave without the money …")); else if (d.loot<10000) toast(L2("Nur $"+d.loot.toLocaleString("de-DE")+" erwischt.","Only got $"+d.loot.toLocaleString("en-US")+".")); m.step=8; for (let i=pickups.length-1;i>=0;i--) if (pickups[i].loot) pickups.splice(i,1); exitVilla(m,{x:d.door.x,y:d.door.y+30}); 
      m.noBoard=false; for (const [x,y,a] of [[b.x-260,L.ly+L.lh+60,0],[b.x+b.w+300,L.ly+L.lh+60,Math.PI],[b.x+b.w/2,L.ly+L.lh+420,-Math.PI/2]]){ const p=roadSpotAway(jj.x,jj.y,500,800)||{x,y,a}; const cv=spawnChaser("suv",p.x,p.y,p.a,"#111317"); cv.hunter=true; cv.gunner=true; }
      obj("Klau ein Auto – ab zum Flughafen, Mo wartet mit dem Jet!"); toast("Santoros Leute sind hinter euch!"); ESC={x:JETP.x,y:JETP.y,a:JETP.a,h:0,v:0,t:0,phase:"wait"}; d.marco=fig(m,"Mo",JETP.x+34,JETP.y+30,{face:{x:JETP.x,y:JETP.y+200}}); }
    if (m.step===8&&v){ m.step=9; obj("Fahr zum Flughafen – Mo wartet am Jet",{x:JETP.x+30,y:JETP.y+60}); }
    if (m.step===9&&!v&&nearP({x:JETP.x+30,y:JETP.y+30},340)){ m.step=10; this.bring(m,jj.x,jj.y); for (const vv of m.vehs) if (vv.ai){ vv.ai=false; vv.v*=.2; }
      figSay(d.marco,"Rein da, rein da! Die Triebwerke laufen!"); m.ride=false; const door={x:JETP.x+34,y:JETP.y+16}; let n=0;
      for (const a of m.allies){ if (a.inCar) exitRider(a); walkTo(m,a.n,a.x,a.y,door.x,door.y+40,()=>{ n++; }); } m.allies=[]; m.d.board=door; m.d.stairs={x:door.x,y:door.y+46}; obj(L2("Lauf zur Treppe am Jet","Walk to the jet stairs"),m.d.stairs); }
    if (m.step===10){ for (const w of m.walkers||[]) if (w.done) w.hide=true;
      if (!v&&nearP(m.d.stairs,44)){ if (!m.talk){ obj(L2("Drück E – steig die Treppe hoch","Press E – climb the stairs")); m.talk={ok:()=>!jj.veh&&nearP(m.d.stairs,50),lbl:L2("EINSTEIGEN","BOARD"),fn:()=>{ setCinema(true); m.step=10.5; m.d.climb=0; m.d.cx=jj.x; m.d.cy=jj.y; jj.lock=99; }}; } }
      else if (m.talk){ m.talk=null; obj(L2("Lauf zur Treppe am Jet","Walk to the jet stairs"),m.d.stairs); } }
    if (m.step===10.5){ d.climb+=dt; const k=Math.min(1,d.climb/1.1); jj.x=d.cx+(m.d.board.x-d.cx)*k; jj.y=d.cy+(m.d.board.y-d.cy)*k; jj.ang=Math.PI; jj.moving=true; jj.step+=dt*10; if (k>=1) m.step=10.9; }
    if (m.step===10.9){ m.step=11; d.marco.gone=true; jj.hidden=true; jj.lock=99; ESC.phase="roll"; ESC.cam=false; ESC.fix={x:JETP.x+620,y:JETP.y-10}; sfx("boom");
        ESC.cb=()=>{ talk([["Santoro","(am Telefon) Lange nicht gesehen, JJ. Das war mein Geld."],["JJ","Geliehen. Mit Zinsen zurück – irgendwann."],["Santoro","Hör auf, nach Donny zu fragen. Sonst endest du wie er."],["Luka","…hat er gerade aufgelegt? Cool. Wir sind REICH, Bruder!"]],()=>{
          ESC=null; jj.hidden=false; jj.lock=0; if (jj.veh) exitVeh(true); jj.x=DOOR.x; jj.y=DOOR.y+30; cam.x=jj.x; cam.y=jj.y; completeMission();
          setTimeout(()=>showCard({done:true,next:act2Intro},`<div class="mk">AKT 1 ABGESCHLOSSEN</div><h2>Ein Niemand</h2><p>Aus dem Niemand ist ein Name geworden. Die Crew taucht unter – aber Victor Santoro kennt jetzt JJs Gesicht. Und er weiß, was mit Donny passiert ist.<br><br><b>Weiter mit Akt 2: Die Spur.</b></p>`,"WEITER"),400); }); }; } }});


