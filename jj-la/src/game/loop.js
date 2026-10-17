// ================= LOOP =================
let dpr=1, cssW=0, cssH=0, scale=1, zoom=1, view={ox:0,oy:0,vx:0,vy:0,sc:1};
let SAL=0, SAB=0; function resize(){ SAL=$("sal").offsetWidth||0; SAB=$("sal").offsetHeight||0; dpr=Math.min(2,window.devicePixelRatio||1); cssW=innerWidth; cssH=innerHeight; cv.width=Math.round(cssW*dpr); cv.height=Math.round(cssH*dpr);
  const target=touch?745:930; scale=Math.max(cssW/target,cssH/(target*.6)); }
addEventListener("resize",resize); resize(); addEventListener("orientationchange",()=>setTimeout(resize,350)); if (window.visualViewport) visualViewport.addEventListener("resize",resize);
document.addEventListener("gesturestart",e=>e.preventDefault()); document.addEventListener("dblclick",e=>e.preventDefault(),{passive:false});
function scrollableUp(el){ for (let n=el;n&&n!==document.body&&n.nodeType===1;n=n.parentElement){ const cs=getComputedStyle(n); if (/(auto|scroll)/.test(cs.overflowY+cs.overflowX)&&(n.scrollHeight>n.clientHeight+1||n.scrollWidth>n.clientWidth+1)) return n; } return null; }
document.addEventListener("touchmove",e=>{ if (e.touches&&e.touches.length>1){ e.preventDefault(); return; } if (!scrollableUp(e.target)) e.preventDefault(); },{passive:false});
const cam={x:jj.x,y:jj.y-60};
function screenToWorld(x,y){ return {x:view.ox+x/view.sc,y:view.oy+y/view.sc}; }
function blockedAt(x,y,r,ignore){ if (x<r||y<r||x>WW-r||y>WH-r) return true; if (beyondShore(x,y,r)) return true; for (const s of solids) if (x+r>s.x&&x-r<s.x+s.w&&y+r>s.y&&y-r<s.y+s.h) return true; if (deepWater(x,y)||inWSolid(x,y)) return true;
  for (const v of vehicles) if (v!==ignore&&!v.gone&&!v.onRoof&&v.z<.15&&!v.sinking&&inVeh(v,x,y,r-2)) return true; return false; }
const zoneEl=document.getElementById("zone"), zN=zoneEl.querySelector("b"), zS=document.getElementById("zsub"); let zoneCur="", zoneT=0;
const CLOUDS=[...Array(8)].map(()=>({x:rnd()*WW,y:rnd()*WH,r:260+rnd()*320,v:14+rnd()*10}));
let last=performance.now(), started=false, OVL=null, respawnT=0;
function mkOverlay(){ const W2=Math.max(1,Math.round(cssW/2)), H=Math.max(1,Math.round(cssH/2)); const c=mk(W2,H,q=>{
  const hz=q.createLinearGradient(0,0,0,H); hz.addColorStop(0,"rgba(255,190,140,.10)"); hz.addColorStop(.4,"rgba(255,190,140,0)"); q.fillStyle=hz; q.fillRect(0,0,W2,H);
  const vg=q.createRadialGradient(W2/2,H/2,Math.min(W2,H)*.4,W2/2,H/2,Math.max(W2,H)*.78); vg.addColorStop(0,"rgba(0,0,0,0)"); vg.addColorStop(1,"rgba(25,10,35,.45)"); q.fillStyle=vg; q.fillRect(0,0,W2,H); }); return {c,w:cssW,h:cssH}; }
function respawnSlots(dt,ox,oy,Wv,Hv){ respawnT-=dt; if (respawnT>0) return; respawnT=2; const off=(x,y)=>x<ox-200||x>ox+Wv+200||y<oy-200||y>oy+Hv+200;
  for (const s of SLOTS){ const v=s.v; if (v&&!v.gone&&jj.veh!==v){ const moved=Math.hypot(v.x-s.x,v.y-s.y)>200||v.wreck||v.hp<v.t.hp*.5||(!v.driver&&s.driver&&Math.hypot(v.x-s.x,v.y-s.y)>0);
      if (moved&&off(v.x,v.y)&&off(s.x,s.y)&&(v.wreck?v.wreckT>20:true)){ v.gone=true; s.v=null; } }
    if (s.hold) continue;
    if ((!s.v||s.v.gone)&&off(s.x,s.y)&&!(jj.veh&&jj.veh.slot===s)){ if (s.v&&jj.veh===s.v) continue; s.v=addVeh(s.type,s.x,s.y,s.a,s.col,{driver:s.driver,slot:s,traffic:!!s.traffic}); } } }
function frame(now){ const dt=Math.min(.05,(now-last)/1000)*(WH_.open?.25:1); last=now; const t=now/1000; try{ pollPad(dt); }catch(e){}
  gameMin+=dt*.5;
  if (SHOPIN){ updateShopIn(dt); if (SHOPIN) drawShopIn(t); updateHudLive&&updateHudLive(); requestAnimationFrame(frame); return; }
  if (JAILIN){ updateJailIn(dt); if (JAILIN) drawJailIn(t); updateHudLive&&updateHudLive(); requestAnimationFrame(frame); return; }
  if (HOMEIN){ updateHomeIn(dt); if (HOMEIN) drawHomeIn(t); updateHudLive&&updateHudLive(); requestAnimationFrame(frame); return; }
  // --- on foot ---
  if (JACK&&!paused) updateJack(dt);
  if (ARRIVAL&&ARRIVAL.fly) updateFlyaway(dt);
  if (TUT&&!paused) updateTut(dt);
  if (jj.lock>0&&!JACK){ jj.lock-=dt; if (jj.lock<=0){ jj.lock=0; if (jj.pending){ const v=jj.pending; jj.pending=null; if (!v.wreck) getIn(v); } } }
  jj.swim=!jj.veh&&!jj.h&&inWater(jj.x,jj.y);
  if (jj.glide&&!jj.dead&&!paused) updateGlide(dt);
  else if (!jj.veh&&!jj.dead&&!jj.lock&&!paused){ let mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0), my=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0); let run=!!(keys.ShiftLeft||keys.ShiftRight);
    if (stick.id!==null){ const L=Math.hypot(stick.dx,stick.dy); if (L>8){ mx=stick.dx/L; my=stick.dy/L; run=L>70; } }
    { // Ausdauer: Sprinten kostet Kraft, leer = erst wieder laufen, wenn sie sich erholt hat
      if (jj.stam==null) jj.stam=1; const want=run&&!!(mx||my)&&!jj.swim&&started;
      if (want&&!jj.tired){ jj.stam-=dt/(6.5+skLv("fit")*.6); if (jj.stam<=0){ jj.stam=0; jj.tired=true; jjSay(L2("Puh … keine Luft mehr.","Phew … out of breath."),1.6); } } else jj.stam=Math.min(1,jj.stam+dt/(want?9:3.6));
      if (jj.tired&&jj.stam>.4) jj.tired=false; if (jj.tired) run=false;
      const sf=$("stFill"); if (sf&&Math.abs((sf._v||0)-jj.stam)>.01){ sf._v=jj.stam; sf.style.width=(jj.stam*100)+"%"; sf.parentElement.style.opacity=jj.stam<.985?"1":"0"; sf.parentElement.classList.toggle("tired",!!jj.tired); } }
    jj.moving=started&&!!(mx||my); jj.run=run;
    if (jj.moving){ const L=Math.hypot(mx,my); mx/=L; my/=L; if (AIM.on&&AIM.src==="key") AIM.ang=Math.atan2(my,mx); const sp=(jj.swim?(LK.dive?88:70):run?230*(1+skLv("fit")*.05):125)*dt*(W.cur==="rpg"?.85:1)*(jj.cashHeavy?Math.max(.52,1-jj.cashHeavy*.12):1), nx=jj.x+mx*sp, ny=jj.y+my*sp; if (run&&!jj.swim) skAdd("fit",sp);
      if (jj.roof){ const b=jj.roof; if (nx<b.x+3||nx>b.x+b.w-3||ny<b.y+3||ny>b.y+b.h-3) startGlide(mx,my); else { jj.x=nx; jj.y=ny; } }
      else { if (!blockedAt(nx,jj.y,9)) jj.x=nx; if (!blockedAt(jj.x,ny,9)) jj.y=ny; }
      if (W.swing<=0){ let d=Math.atan2(-mx,my)-jj.ang; d=Math.atan2(Math.sin(d),Math.cos(d)); jj.ang+=d*Math.min(1,dt*10); } jj.step+=dt*(jj.swim?8:run?19:13.5); } }
  else if (!JACK) jj.moving=false;
  jj.walkAmt=(jj.walkAmt||0)+((jj.moving?1:0)-(jj.walkAmt||0))*Math.min(1,dt*9);
  if (jj.veh){ jj.x=jj.veh.x; jj.y=jj.veh.y; }
  if (jj.say){ jj.say.t-=dt; if (jj.say.t<=0) jj.say=null; } barkT=Math.max(0,barkT-dt);
  if (FLY) updateFly(dt); if (RIDE) updateRide(dt);
  if (started&&!paused){ updateLake(dt); updateIsland(dt); updateWanted(dt); updateTanks(dt); updatePatrol(dt); updateWeapons(dt); updateVehicles(dt,t); updatePeds(dt); updateNpcs(dt,jj.x,jj.y); if (ESC&&!(MI&&MI.def.id==="m6")) updateEscape(dt); updateJail(dt); updateSharks(dt); updateHealth(dt,t); }
  else if (started&&CINE&&!DLG){ updateVehicles(dt,t); updateNpcs(dt,ARRIVAL?ARRIVAL.x:jj.x,ARRIVAL?Math.max(1250,ARRIVAL.y):jj.y); }
  if (started){ updateCine(dt); updateMissions(dt); updateRoom(dt); updateStealth(dt); }
  updParts(dt); for (let i=wakes.length-1;i>=0;i--){ wakes[i].life-=dt; if (wakes[i].life<=0) wakes.splice(i,1); }
  // --- camera ---
  const fv=jj.veh; const tz=FLY?1+FLY.h/360*.95+Math.min(1,Math.abs(FLY.v)/400)*.2:fv?(fv.t.kind==="heli"?1+fv.z*.3:1+Math.min(1,Math.abs(fv.v)/fv.t.max)*.32):1; zoom+=(tz-zoom)*Math.min(1,dt*1.6);
  const sc=scale/zoom; const lead=fv&&fv.t.kind!=="heli"?.35:fv?.25:0, lx=fv?(fv.t.kind==="heli"?fv.vx:Math.cos(fv.a)*fv.v)*lead:0, ly=fv?(fv.t.kind==="heli"?fv.vy:Math.sin(fv.a)*fv.v)*lead:0;
  const ctx_=ISLCAM?ISLCAM.x:CINE&&ARRIVAL?ARRIVAL.x:ESC&&ESC.cam?ESC.x:FLY?FLY.x+Math.cos(FLY.a)*FLY.v*.1:jj.x+lx, cty_=ISLCAM?ISLCAM.y:CINE&&ARRIVAL?ARRIVAL.y:ESC&&ESC.cam?ESC.y:FLY?FLY.y+Math.sin(FLY.a)*FLY.v*.1:jj.y+ly-40/sc; cam.x+=(ctx_-cam.x)*Math.min(1,dt*(CINE?2.5:FLY?7:4)); cam.y+=(cty_-cam.y)*Math.min(1,dt*(CINE?2.5:FLY?7:4));
  shake*=Math.pow(.02,dt); const shx=(rnd()-.5)*shake, shy=(rnd()-.5)*shake;
  const Wv=cssW/sc, Hv=cssH/sc; const SEA_M=FLY?900:260, vx=Math.max(Wv/2-SEA_M,Math.min(WW-Wv/2+SEA_M,cam.x))+shx, vy=Math.max(Hv/2-SEA_M,Math.min(WH-Hv/2+SEA_M,cam.y))+shy; const ox=vx-Wv/2, oy=vy-Hv/2; view={ox,oy,vx,vy,sc};
  if (started) respawnSlots(dt,ox,oy,Wv,Hv);
  ctx.setTransform(dpr*sc,0,0,dpr*sc,-ox*dpr*sc,-oy*dpr*sc);
  if (ox<0||oy<0||ox+Wv>LANDW||oy+Hv>WH){ ctx.fillStyle="#1d6390"; ctx.fillRect(ox,oy,Wv,Hv); if (oy+Hv>3300){ const sg=ctx.createLinearGradient(0,3300,0,WH0); sg.addColorStop(0,"#1d6390"); sg.addColorStop(1,"#0d4675"); ctx.fillStyle=sg; ctx.fillRect(ox,Math.max(oy,3300),Wv,Math.min(WH,oy+Hv)-Math.max(oy,3300)); } if (oy+Hv>WH){ ctx.fillStyle="#0d4675"; ctx.fillRect(ox,WH,Wv,oy+Hv-WH); }
    ctx.strokeStyle="rgba(230,250,255,.16)"; ctx.lineWidth=1.5; for (let i=0;i<60;i++){ const x=ox+((i*317+t*9)%Wv), y=oy+((i*191)%Hv); if (x>0&&x<WW&&y>0&&y<WH) continue; ctx.beginPath(); ctx.moveTo(x,y); ctx.quadraticCurveTo(x+7,y-3+Math.sin(t+i)*1.5,x+14,y); ctx.stroke(); } }
  if (oy+Hv>WH0){ const y0=Math.max(oy,WH0); ctx.fillStyle="#0d4675"; ctx.fillRect(ox,y0,Wv,oy+Hv-y0); }
  { const sx0=Math.max(0,ox), sy0=Math.max(0,oy), sx1=Math.min(LANDW,ox+Wv), sy1=Math.min(WH0,oy+Hv); if (sx1>sx0&&sy1>sy0) ctx.drawImage(ground,sx0*GS,sy0*GS,(sx1-sx0)*GS,(sy1-sy0)*GS,sx0,sy0,sx1-sx0,sy1-sy0); }
  { const sx0=Math.max(G2.x,ox), sy0=Math.max(G2.y,oy), sx1=Math.min(G2.x+G2.w,ox+Wv), sy1=Math.min(G2.y+G2.h,oy+Hv); if (sx1>sx0&&sy1>sy0) ctx.drawImage(ground2,(sx0-G2.x)*GS,(sy0-G2.y)*GS,(sx1-sx0)*GS,(sy1-sy0)*GS,sx0,sy0,sx1-sx0,sy1-sy0); }
  { const sx0=Math.max(G3.x,ox), sy0=Math.max(G3.y,oy), sx1=Math.min(G3.x+G3.w,ox+Wv), sy1=Math.min(G3.y+G3.h,oy+Hv); if (sx1>sx0&&sy1>sy0) ctx.drawImage(ground3,(sx0-G3.x)*GS,(sy0-G3.y)*GS,(sx1-sx0)*GS,(sy1-sy0)*GS,sx0,sy0,sx1-sx0,sy1-sy0); }
  const vis=(x,y,m)=>x>ox-m&&x<ox+Wv+m&&y>oy-m&&y<oy+Hv+m;
  // ocean shimmer + surf
  if (oy+Hv>WATER_Y-60){ ctx.strokeStyle="rgba(255,255,255,.55)"; ctx.lineWidth=2.2; for (let k=0;k<2;k++){ const ph=(t*.35+k*.5)%1; ctx.globalAlpha=Math.sin(ph*Math.PI)*.8; ctx.beginPath(); for (let x=Math.floor(ox/20)*20;x<=ox+Wv+20;x+=20){ const y=waterY(x)+4+ph*26+Math.sin(x*.03+t)*2; x===Math.floor(ox/20)*20?ctx.moveTo(x,y):ctx.lineTo(x,y); } ctx.stroke(); } ctx.globalAlpha=1;
    ctx.fillStyle="rgba(255,255,255,.22)"; for (let i=0;i<40;i++){ const x=ox+((i*397+t*12)%Wv), y=WATER_Y+60+((i*211)%Math.max(1,WH-WATER_Y-60)); if (y>oy&&y<oy+Hv&&y>waterY(x)+20&&!(y>3860&&islD(x,y)<20)){ const s=Math.sin(t*2+i)*.5+.5; ctx.globalAlpha=s*.6; ctx.fillRect(x,y,10+s*8,1.6); } } ctx.globalAlpha=1; }
  drawSea(ctx,vis,t);
  for (const w of wakes){ if (!vis(w.x,w.y,60)) continue; const f=w.life/1.6, r=(1-f)*30+6; ctx.strokeStyle=`rgba(255,255,255,${f*.5*w.s})`; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(w.x,w.y,r,w.a+Math.PI-.8,w.a+Math.PI+.8); ctx.stroke(); }
  for (const P of POOLS_ANIM) if (vis(P.x,P.y,200)){ ctx.save(); ctx.beginPath(); ctx.rect(P.x,P.y,P.w,P.h); ctx.clip(); ctx.strokeStyle="rgba(255,255,255,.35)"; ctx.lineWidth=1.4; for (let i=0;i<P.h/12;i++){ const yy=P.y+6+i*12+Math.sin(t*1.4+i)*3; ctx.beginPath(); for (let x=P.x;x<=P.x+P.w;x+=10){ const y=yy+Math.sin(x*.07+t*2+i)*2.2; x===P.x?ctx.moveTo(x,y):ctx.lineTo(x,y); } ctx.stroke(); } ctx.restore(); }
  if (vis(POOL.x,POOL.y,300)){ ctx.save(); ctx.beginPath(); ctx.rect(POOL.x,POOL.y,POOL.w,POOL.h); ctx.clip(); ctx.strokeStyle="rgba(255,255,255,.35)"; ctx.lineWidth=1.6;
    for (let i=0;i<9;i++){ const yy=POOL.y+8+i*12+Math.sin(t*1.4+i)*3; ctx.beginPath(); for (let x=POOL.x;x<=POOL.x+POOL.w;x+=10){ const y=yy+Math.sin(x*.07+t*2+i)*2.5; x===POOL.x?ctx.moveTo(x,y):ctx.lineTo(x,y); } ctx.stroke(); } ctx.restore(); }
  { const e=BLOCKS[4], fx=e.x+e.w/2, fy=e.y+e.h/2; if (vis(fx,fy,200)){ ctx.strokeStyle="rgba(255,255,255,.55)"; ctx.lineWidth=1.4; for (let i=0;i<3;i++){ const ph=(t*.6+i/3)%1; ctx.globalAlpha=1-ph; ctx.beginPath(); ctx.arc(fx,fy,8+ph*42,0,7); ctx.stroke(); } ctx.globalAlpha=1;
      ctx.fillStyle="#efe9dc"; ctx.beginPath(); ctx.arc(fx,fy,8,0,7); ctx.fill(); ctx.fillStyle="rgba(220,245,255,.9)"; for (let i=0;i<10;i++){ const a=i/10*6.283+t, r=5+((t*24+i*5)%14); ctx.beginPath(); ctx.arc(fx+Math.cos(a)*r,fy+Math.sin(a)*r,1.4,0,7); ctx.fill(); } } }
  // ground-level actors
  for (const v of vehicles) if (vis(v.x,v.y,120)&&!(v.t.kind==="heli"&&v.z>.02)) drawVehGround(ctx,v);
  for (const v of vehicles) if (v.t.kind==="heli"&&v.z>.02&&!v.onRoof&&vis(v.x,v.y,400)) drawVehGround(ctx,v);
  drawRoute(ctx); drawAirportLights(ctx,t,vis); drawIslandGround(ctx,t,vis); drawGolf(ctx,t); drawSpikes(ctx);
  drawDecals(ctx); drawStrip(ctx,t,vis); drawYard(ctx,t,vis); drawVillaRoom(ctx,t); drawRoom(ctx,t); drawStealth(ctx,t); drawEscape(ctx,vx,vy,false); drawArrival(ctx,vx,vy,false); drawPlanesGround(ctx,vis); drawFly(ctx,vx,vy,false);
  drawParts(ctx,0);
  drawNpcs(ctx,vis);
  for (const p of peds) if (vis(p.x,p.y,60)){ if (p.flip!=null||p.hop){ ctx.save(); ctx.translate(p.x,p.y-(p.hop||0)); ctx.rotate(p.flip||0); ctx.translate(-p.x,-p.y); drawPerson(ctx,p,p.look); ctx.restore(); } else drawPerson(ctx,p,p.look); if (p.sayT!=null?p.sayT>0:p.t<2.2) { ctx.font='700 11px "Barlow Semi Condensed",sans-serif'; ctx.textAlign="center"; ctx.fillStyle="#fff"; ctx.strokeStyle="rgba(18,16,22,.85)"; ctx.lineWidth=3; ctx.strokeText(p.say,p.x,p.y-22); ctx.fillText(p.say,p.x,p.y-22); } }
  drawLakeLife(ctx,vis); drawPickups(ctx,t); if (LK.dive) ctx.globalAlpha=.5; drawJJ(ctx); ctx.globalAlpha=1; drawAim(ctx,t); drawRockets(ctx); drawProjectiles(ctx); drawShells(ctx);
  for (const tr of trees) if (vis(tr.x,tr.y,140)) drawTree(ctx,tr,vx,vy);
  for (const p of palms) if (vis(p.x,p.y,140)) drawPalm(ctx,p,vx,vy,t);
  const bs=buildings.filter(b=>b.x<ox+Wv+500&&b.x+b.w>ox-500&&b.y<oy+Hv+500&&b.y+b.h>oy-500).sort((a,b)=>Math.hypot(b.x+b.w/2-vx,b.y+b.h/2-vy)-Math.hypot(a.x+a.w/2-vx,a.y+a.h/2-vy));
  for (const b of bs) drawBuilding(ctx,b,vx,vy);
  drawJailDoor(ctx,vx,vy,t); drawSign(ctx,vx,vy,vis);
  drawCranes(ctx,vx,vy,t); drawIslandAir(ctx,vx,vy,t,vis);
  drawJJAir(ctx,vx,vy); drawArrival(ctx,vx,vy,true); drawEscape(ctx,vx,vy,true); drawCopSpot(ctx); drawFly(ctx,vx,vy,true); drawPlaneTags(ctx,t);
  for (const r of TUNNELS) if (vis(r.x+50,r.y+85,300)){ const k=1+30/D, P=(x,y)=>[vx+(x-vx)*k,vy+(y-vy)*k], a1=P(r.x,r.y), a2=P(r.x+r.w,r.y), a3=P(r.x+r.w,r.y+r.h), a4=P(r.x,r.y+r.h);
    ctx.fillStyle="rgba(150,205,235,.28)"; ctx.beginPath(); ctx.moveTo(...a1); ctx.lineTo(...a2); ctx.lineTo(...a3); ctx.lineTo(...a4); ctx.closePath(); ctx.fill(); ctx.strokeStyle="rgba(255,255,255,.75)"; ctx.lineWidth=3; ctx.stroke();
    ctx.strokeStyle="rgba(255,255,255,.35)"; ctx.lineWidth=1.5; for (let y=r.y+17;y<r.y+r.h;y+=17){ const b1=P(r.x,y), b2=P(r.x+r.w,y); ctx.beginPath(); ctx.moveTo(...b1); ctx.lineTo(...b2); ctx.stroke(); }
    ctx.fillStyle="rgba(255,255,255,.18)"; const c1=P(r.x+8,r.y), c2=P(r.x+28,r.y), c3=P(r.x+28,r.y+r.h), c4=P(r.x+8,r.y+r.h); ctx.beginPath(); ctx.moveTo(...c1); ctx.lineTo(...c2); ctx.lineTo(...c3); ctx.lineTo(...c4); ctx.fill(); }
  drawParts(ctx,1); drawParts(ctx,2);
  drawRoomNight(ctx,t);
  if (INROOM){ ctx.fillStyle="#07060a"; ctx.beginPath(); ctx.rect(ox-20,oy-20,Wv+40,Hv+40); ctx.rect(VR.x,VR.y,VR.w,VR.h); ctx.fill("evenodd"); }
  for (const v of vehicles) if (v.t.kind==="heli"&&v.z>.02&&vis(v.x,v.y,500)) drawHeliAir(ctx,v,vx,vy);
  drawCopHeli(ctx,vx,vy); drawJets(ctx,vx,vy); drawRideSay(ctx);
  if (jj.say&&!jj.dead&&!CINE) drawSay(ctx,jj.x,jj.y-(jj.veh?(jj.veh.t.kind==="heli"?40+jj.veh.z*60:30):36)-(jj.h||0)*.2,jj.say.txt);
  for (const c of CLOUDS){ c.x+=c.v*dt; if (c.x-c.r>WW) c.x=-c.r; if (!vis(c.x,c.y,c.r)) continue; const gr=ctx.createRadialGradient(c.x,c.y,c.r*.2,c.x,c.y,c.r); gr.addColorStop(0,"rgba(30,20,60,.13)"); gr.addColorStop(1,"rgba(30,20,60,0)"); ctx.fillStyle=gr; ctx.fillRect(c.x-c.r,c.y-c.r,c.r*2,c.r*2); }
  if (vis(DOOR.x,DOOR.y,60)&&Math.hypot(jj.x-DOOR.x,jj.y-DOOR.y)>110){ const by=DOOR.y-4+Math.sin(t*3)*2; ctx.font='400 13px "Bebas Neue",Impact,sans-serif'; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillStyle="rgba(18,16,22,.8)"; rr(ctx,DOOR.x-34,by-9,68,18,9); ctx.fill(); ctx.fillStyle="#ffb347"; ctx.fillText("ZUHAUSE",DOOR.x,by+1); }
  if (clothesOpen()&&vis(CLO.x,CLO.y,80)){ const by=CLO.y-26+Math.sin(t*3)*3; ctx.fillStyle="rgba(18,16,22,.85)"; ctx.beginPath(); ctx.arc(CLO.x,by,13,0,7); ctx.fill(); ctx.font="14px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("👕",CLO.x,by+1); }
  if (armsOpen()&&vis(SHOP.x,SHOP.y,80)){ const by=SHOP.y-26+Math.sin(t*3)*3; ctx.fillStyle="rgba(18,16,22,.85)"; ctx.beginPath(); ctx.arc(SHOP.x,by,13,0,7); ctx.fill(); ctx.strokeStyle="#ff4a3d"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(SHOP.x,by,7,0,7); ctx.moveTo(SHOP.x-10,by); ctx.lineTo(SHOP.x+10,by); ctx.moveTo(SHOP.x,by-10); ctx.lineTo(SHOP.x,by+10); ctx.stroke(); }
  drawGpsWorld(ctx,vis,t); drawMissionWorld(ctx,vis,t);
  // private heli marker (world)
  if (priv&&!priv.gone&&priv.mode==="wait"&&jj.veh!==priv&&vis(priv.x,priv.y,0)){ const by=priv.y-40+Math.sin(t*4)*3; ctx.fillStyle="#d8b35a"; ctx.beginPath(); ctx.moveTo(priv.x,by+10); ctx.lineTo(priv.x-8,by); ctx.lineTo(priv.x+8,by); ctx.closePath(); ctx.fill(); }
  // --- screen space ---
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.globalCompositeOperation="soft-light"; const sk=ctx.createLinearGradient(0,0,cssW,cssH); sk.addColorStop(0,"rgba(255,170,80,.55)"); sk.addColorStop(.6,"rgba(255,140,110,.2)"); sk.addColorStop(1,"rgba(90,60,160,.45)"); ctx.fillStyle=sk; ctx.fillRect(0,0,cssW,cssH);
  ctx.globalCompositeOperation="source-over"; if (!OVL||OVL.w!==cssW||OVL.h!==cssH) OVL=mkOverlay(); ctx.drawImage(OVL.c,0,0,cssW,cssH);
  // off-screen arrow to the private heli
  if (priv&&!priv.gone&&jj.veh!==priv&&priv.mode!=="leave"){ const sx=(priv.x-ox)*sc, sy=(priv.y-oy)*sc; if (sx<0||sy<0||sx>cssW||sy>cssH){ const a=Math.atan2(sy-cssH/2,sx-cssW/2), m=46, ax=Math.max(m,Math.min(cssW-m,cssW/2+Math.cos(a)*cssW)), ay=Math.max(m,Math.min(cssH-m,cssH/2+Math.sin(a)*cssH));
      ctx.save(); ctx.translate(ax,ay); ctx.rotate(a); ctx.fillStyle="rgba(18,16,22,.8)"; ctx.beginPath(); ctx.arc(0,0,18,0,7); ctx.fill(); ctx.fillStyle="#d8b35a"; ctx.beginPath(); ctx.moveTo(12,0); ctx.lineTo(-6,-8); ctx.lineTo(-6,8); ctx.closePath(); ctx.fill(); ctx.restore(); } }
  drawGpsScreen(ctx,ox,oy,sc);
  if (jj.flash>0){ ctx.fillStyle=`rgba(200,20,20,${jj.flash*.5})`; ctx.fillRect(0,0,cssW,cssH); }
  if (jj.dead){ const f=Math.min(1,jj.deadT/1.2); ctx.globalCompositeOperation="saturation"; ctx.fillStyle=`rgba(128,128,128,${f})`; ctx.fillRect(0,0,cssW,cssH); ctx.globalCompositeOperation="source-over"; ctx.fillStyle=`rgba(60,0,0,${f*.35})`; ctx.fillRect(0,0,cssW,cssH);
    if (jj.deadT>.6){ const a=Math.min(1,(jj.deadT-.6)*2); ctx.globalAlpha=a; ctx.font=`400 ${Math.round(Math.min(cssW,cssH)*.2)}px "Bebas Neue",Impact,sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillStyle="rgba(0,0,0,.5)"; ctx.fillText("WASTED",cssW/2+4,cssH/2+5); ctx.fillStyle="#d9342b"; ctx.fillText("WASTED",cssW/2,cssH/2); ctx.globalAlpha=1; }
    if (jj.deadT>3.3){ ctx.fillStyle=`rgba(0,0,0,${Math.min(1,(jj.deadT-3.3)/.7)})`; ctx.fillRect(0,0,cssW,cssH); } }
  if (WANT.busted>0){ const f=Math.min(1,WANT.busted/1); ctx.fillStyle=`rgba(10,20,60,${f*.45})`; ctx.fillRect(0,0,cssW,cssH); if (WANT.busted>.5){ const a=Math.min(1,(WANT.busted-.5)*2); ctx.globalAlpha=a; ctx.font=`400 ${Math.round(Math.min(cssW,cssH)*.17)}px "Bebas Neue",Impact,sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillStyle="rgba(0,0,0,.5)"; ctx.fillText("VERHAFTET",cssW/2+4,cssH/2+5); ctx.fillStyle="#4a8cff"; ctx.fillText("VERHAFTET",cssW/2,cssH/2); ctx.globalAlpha=1; }
    if (WANT.busted>2.5){ ctx.fillStyle=`rgba(0,0,0,${Math.min(1,(WANT.busted-2.5)/.6)})`; ctx.fillRect(0,0,cssW,cssH); } }
  drawDiveTint(); renderWanted(); if (!CINEMA){ drawMini(ctx); drawStick(ctx); }
  if (started&&CURROOM&&CURROOM.zn&&zoneCur!==CURROOM.zn){ zoneCur=CURROOM.zn; zN.textContent=CURROOM.zn; zS.textContent=CURROOM.zs||""; zoneEl.classList.add("on"); zoneT=3; }
  if (started&&!CURROOM){ const z=ZONES.find(z=>jj.x>=z.r.x&&jj.x<z.r.x+z.r.w&&jj.y>=z.r.y&&jj.y<z.r.y+z.r.h); if (z&&z.n!==zoneCur){ zoneCur=z.n; zN.textContent=z.n; zS.textContent=z.s; zoneEl.classList.add("on"); zoneT=3; } }
  if (zoneT>0){ zoneT-=dt; if (zoneT<=0) zoneEl.classList.remove("on"); }
  if (toastT>0){ toastT-=dt; if (toastT<=0) $("toast").classList.remove("on"); }
  if (hudDirty) renderHud(); if (started) updateHudLive();
  if (eng&&AC){ const v=jj.veh; const target=v&&!v.wreck?(v.t.kind==="heli"?.05:.045):0; eng.gn.gain.setTargetAtTime(target,AC.currentTime,.1); if (v){ const f=v.t.kind==="heli"?38+Math.sin(t*28)*6+v.z*10:45+Math.abs(v.v)/v.t.max*110; eng.o.frequency.setTargetAtTime(f,AC.currentTime,.05); } }
  if (phoneOpen&&Math.floor(gameMin)!==Math.floor(gameMin-dt*.5)){ const el=document.querySelector(".lk .tm"); if (el) el.textContent=clockStr(); if (phoneView.screen==="gps"||phoneView.screen==="radio") renderPhone(); }
  updateRadio(); updateGps(); updateRoute(dt);
  if (mapOpen&&Math.floor(t*4)!==Math.floor((t-dt)*4)) drawBig();
  if (notifT>0){ notifT-=dt; if (notifT<=0) $("notif").classList.remove("on"); }
  requestAnimationFrame(frame); }
const MINI=mk(230,Math.round(230*WH/WW),q=>{ const s=230/WW; q.scale(s,s); q.drawImage(ground,ground.width-2,0,2,ground.height,LANDW-1,0,WW-LANDW+1,WH0); q.drawImage(ground,0,0,ground.width,ground.height,0,0,LANDW,WH0); q.fillStyle="#0d4675"; q.fillRect(0,WH0,WW,WH-WH0); q.drawImage(ground2,0,0,ground2.width,ground2.height,G2.x,G2.y,G2.w,G2.h); q.drawImage(ground3,0,0,ground3.width,ground3.height,G3.x,G3.y,G3.w,G3.h); q.fillStyle="#5d6b7a"; for (const b of buildings) q.fillRect(b.x,b.y,b.w,b.h); });
let MINI_R={x:0,y:0,w:0,h:0};
function drawMini(q){ const w=touch?(cssH<450?112:130):170, h=w*WH/WW, x=14+SAL, y=14; MINI_R={x:x-4,y:y-4,w:w+8,h:h+8}; q.fillStyle="rgba(18,16,22,.78)"; rr(q,x-4,y-4,w+8,h+8,10); q.fill(); q.drawImage(MINI,x,y,w,h);
  if (priv&&!priv.gone){ q.fillStyle="#d8b35a"; q.beginPath(); q.arc(x+priv.x/WW*w,y+priv.y/WH*h,3.5,0,7); q.fill(); }
  if (route){ q.strokeStyle="#ffd60a"; q.lineWidth=2; q.beginPath(); route.forEach(([rx,ry],i)=>i?q.lineTo(x+rx/WW*w,y+ry/WH*h):q.moveTo(x+rx/WW*w,y+ry/WH*h)); q.stroke(); }
  if (gps){ q.fillStyle="#ffd60a"; q.strokeStyle="#120f14"; q.lineWidth=1.5; q.beginPath(); q.arc(x+gps.x/WW*w,y+gps.y/WH*h,4,0,7); q.fill(); q.stroke(); }
  drawMissionMini(q,x,y,w,h); { const ot=y+h+12; if (ot!==drawMini.ot){ drawMini.ot=ot; $("obj").style.top=ot+"px"; $("obj").style.left=(x-4)+"px"; } fitObj(x-4,ot); }
  if (ricoOpen()){ const sx=x+RICO.x/WW*w, sy=y+RICO.y/WH*h; q.fillStyle="#ffb347"; q.strokeStyle="#fff"; q.lineWidth=1.2; q.beginPath(); q.arc(sx,sy,4.5,0,7); q.fill(); q.stroke(); }
  if (clothesOpen()){ const sx=x+CLO.x/WW*w, sy=y+CLO.y/WH*h; q.fillStyle="#ff5fb4"; q.strokeStyle="#fff"; q.lineWidth=1.2; q.beginPath(); q.arc(sx,sy,4.5,0,7); q.fill(); q.stroke(); }
  if (armsOpen()){ const sx=x+SHOP.x/WW*w, sy=y+SHOP.y/WH*h; q.fillStyle="#d8303a"; q.strokeStyle="#fff"; q.lineWidth=1.2; q.beginPath(); q.arc(sx,sy,4.5,0,7); q.fill(); q.stroke(); }
  q.fillStyle="#ffb347"; q.strokeStyle="#120f14"; q.lineWidth=2; const px=x+jj.x/WW*w, py=y+jj.y/WH*h; q.beginPath(); q.arc(px,py,4,0,7); q.fill(); q.stroke(); }
function stickBase(){ return {x:SAL+96,y:cssH-SAB-96}; }
function drawStick(q){ if (stick.id===null){ if (touch&&started&&!jj.dead){ const B=stickBase(), gx=B.x, gy=B.y; q.globalAlpha=.35; q.fillStyle="rgba(18,16,22,.5)"; q.beginPath(); q.arc(gx,gy,60,0,7); q.fill(); q.strokeStyle="#f6efe2"; q.lineWidth=2; q.stroke(); q.globalAlpha=.55; q.fillStyle="#f6efe2"; q.beginPath(); q.arc(gx,gy,22,0,7); q.fill(); q.globalAlpha=1; } return; } q.globalAlpha=.6; q.strokeStyle="#f6efe2"; q.lineWidth=2; q.beginPath(); q.arc(stick.ox,stick.oy,60,0,7); q.stroke(); const L=Math.min(60,Math.hypot(stick.dx,stick.dy)), a=Math.atan2(stick.dy,stick.dx);
  q.fillStyle="#ffb347"; q.beginPath(); q.arc(stick.ox+Math.cos(a)*L,stick.oy+Math.sin(a)*L,22,0,7); q.fill(); q.globalAlpha=1; }
// ---------- phone apps: GPS, radio, skills ----------
const ic=(d,c)=>`<svg viewBox="0 0 32 32">${d.replace(/@@/g,c||"#fff")}</svg>`;
const APPX=[{id:"contacts",n:"Kontakte",bg:"linear-gradient(180deg,#9aa4b2,#4b5563)",svg:ic('<circle cx="16" cy="12" r="5" fill="@@"/><path d="M6.5 26c0-5.2 4.3-8.6 9.5-8.6s9.5 3.4 9.5 8.6z" fill="@@"/>')},{id:"gps",n:"Karten",bg:"linear-gradient(180deg,#6fd0ff,#1f7ae0)",svg:ic('<path d="M16 4c-5 0-9 3.8-9 8.8C7 19 16 28 16 28s9-9 9-15.2C25 7.8 21 4 16 4z" fill="@@"/><circle cx="16" cy="12.6" r="3.4" fill="#1f7ae0"/>')},
  {id:"settings",n:"Einstellungen",bg:"linear-gradient(180deg,#a1a1a6,#5c5c62)",svg:ic('<circle cx="16" cy="16" r="9" fill="none" stroke="@@" stroke-width="3" stroke-dasharray="4 3"/><circle cx="16" cy="16" r="4" fill="@@"/>')},
  {id:"jobs",n:"Missionen",bg:"linear-gradient(180deg,#ff8a5c,#d1361e)",svg:ic('<circle cx="16" cy="16" r="10" fill="none" stroke="@@" stroke-width="2.5"/><circle cx="16" cy="16" r="5" fill="none" stroke="@@" stroke-width="2.5"/><circle cx="16" cy="16" r="1.8" fill="@@"/>')},
  {id:"skills",n:"Skills",bg:"linear-gradient(180deg,#b388ff,#6a35d8)",svg:ic('<path d="M6 22l6-6 4 4 9-10" stroke="@@" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 10h6v6" stroke="@@" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')},
  {id:"friends",n:"Freunde",bg:"linear-gradient(180deg,#5ee0d0,#14907e)",svg:ic('<circle cx="12" cy="11" r="4.2" fill="@@"/><path d="M4 25c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z" fill="@@"/><circle cx="22" cy="12" r="3.4" fill="@@" opacity=".8"/><path d="M19 18.2c4.8-.8 9 2.2 9 6.8h-6" fill="@@" opacity=".8"/>')}];
let gps=null;
const GPLACES=[{n:"Zuhause",i:"🏠",get x(){ return MS.done.mh?SALEDOOR.x:DOOR.x; },get y(){ return (MS.done.mh?SALEDOOR.y:DOOR.y)+30; }},{n:"LA ARMS · Waffenladen",i:"🎯",x:SHOP.x,y:SHOP.y-30},{n:"Rico's Autos · Autohändler",i:"🚗",x:RICO.x,y:RICO.y-20},{n:"DRIP STORE · Klamotten",i:"👕",x:CLO.x,y:CLO.y-20},{n:"Downtown · Park",i:"🏙️",x:BLOCKS[4].x+BLOCKS[4].w/2,y:BLOCKS[4].y+BLOCKS[4].h/2+60},{n:"Flughafen · Terminal",i:"✈️",x:1000+AX,y:1350},{n:"Mo's Heliport",i:"🚁",x:HELIPAD.x,y:HELIPAD.y+60},{n:"Venice Beach · Steg",i:"🏖️",x:970,y:3080},{n:"Palm Heights",i:"💎",x:3460,y:2530},{n:"Sunset Strip · Clubs",i:"🎉",x:1040,y:760},{n:"Hollywood Sign",i:"🎬",x:8420,y:1010},{n:"Lake Hollywood",i:"🏊",x:8372,y:1880},{n:"Santa Luna · Speedway",i:"🏁",x:3705,y:4235},{n:"Santa Luna · Luna Park",i:"🎢",x:5300,y:4235},{n:"Santa Luna · Golfclub",i:"⛳",x:5220,y:5335},{n:"Santa Luna · Leuchtturm",i:"🗼",x:4955,y:6020}];
// road grid + A* for the in-car route line
const RC=20, RCW=Math.ceil(WW/RC), RCH=Math.ceil(WH/RC), RG=new Uint8Array(RCW*RCH);
{ const inRoad=(x,y)=>roads.some(r=>x>=r.x-2&&x<=r.x+r.w+2&&y>=r.y-2&&y<=r.y+r.h+2);
  for (const r of roads){ if (r.w>=r.h){ const j=Math.floor((r.y+r.h/2)/RC), y=j*RC+RC/2; for (let i=Math.floor((r.x-200)/RC);i<=Math.floor((r.x+r.w+200)/RC);i++){ const x=i*RC+RC/2; if (i>=0&&i<RCW&&inRoad(x,r.y+r.h/2)) RG[j*RCW+i]=1; } }
    else { const i=Math.floor((r.x+r.w/2)/RC), x=i*RC+RC/2; for (let j=Math.floor((r.y-200)/RC);j<=Math.floor((r.y+r.h+200)/RC);j++){ const y=j*RC+RC/2; if (j>=0&&j<RCH&&inRoad(r.x+r.w/2,y)) RG[j*RCW+i]=1; } } }
  // join crossing centre lines that end one cell apart
  for (let j=1;j<RCH-1;j++) for (let i=1;i<RCW-1;i++){ const k=j*RCW+i; if (RG[k]) continue; const h=RG[k-1]&&RG[k+1], v=RG[k-RCW]&&RG[k+RCW]; if ((h||v)&&inRoad(i*RC+RC/2,j*RC+RC/2)) RG[k]=1; } }
function nearRoad(x,y){ const ci=Math.floor(x/RC), cj=Math.floor(y/RC); for (let r=0;r<80;r++) for (let dj=-r;dj<=r;dj++) for (let di=-r;di<=r;di++){ if (Math.max(Math.abs(di),Math.abs(dj))!==r) continue; const i=ci+di, j=cj+dj; if (i>=0&&j>=0&&i<RCW&&j<RCH&&RG[j*RCW+i]) return j*RCW+i; } return -1; }
function astar(a,b){ if (a<0||b<0) return null; const N=RCW*RCH, gs=new Float32Array(N).fill(1e9), from=new Int32Array(N).fill(-1), closed=new Uint8Array(N), heap=[]; const bx=b%RCW, by=(b/RCW)|0, h=k=>Math.abs(k%RCW-bx)+Math.abs(((k/RCW)|0)-by);
  const push=(k,f)=>{ heap.push([f,k]); let i=heap.length-1; while (i>0){ const p=(i-1)>>1; if (heap[p][0]<=heap[i][0]) break; [heap[p],heap[i]]=[heap[i],heap[p]]; i=p; } };
  const pop=()=>{ const top=heap[0], last=heap.pop(); if (heap.length){ heap[0]=last; let i=0; for (;;){ const l=i*2+1, r=l+1; let m=i; if (l<heap.length&&heap[l][0]<heap[m][0]) m=l; if (r<heap.length&&heap[r][0]<heap[m][0]) m=r; if (m===i) break; [heap[m],heap[i]]=[heap[i],heap[m]]; i=m; } } return top; };
  gs[a]=0; push(a,h(a)); while (heap.length){ const [,k]=pop(); if (closed[k]) continue; if (k===b) break; closed[k]=1; const x=k%RCW, y=(k/RCW)|0;
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+dx, ny=y+dy; if (nx<0||ny<0||nx>=RCW||ny>=RCH) continue; const n=ny*RCW+nx; if (!RG[n]||closed[n]) continue; const pk=from[k], turn=pk>=0&&((k-pk)!==(n-k))?6:0, g2=gs[k]+1+turn; if (g2<gs[n]){ gs[n]=g2; from[n]=k; push(n,g2+h(n)); } } }
  if (from[b]<0&&a!==b) return null; const pts=[]; for (let k=b;k>=0;k=from[k]){ pts.push([(k%RCW)*RC+RC/2,((k/RCW)|0)*RC+RC/2]); if (k===a) break; } pts.reverse();
  const out=[pts[0]]; for (let i=1;i<pts.length-1;i++){ const [ax,ay]=out[out.length-1], [cx,cy]=pts[i+1]; if (!(ax===cx||ay===cy)) out.push(pts[i]); } if (pts.length>1) out.push(pts[pts.length-1]); return out; }
let route=null, routeT=0;
function updateRoute(dt){ const v=jj.veh; if (!gps||!gps.user||!v||v.t.kind==="heli"||v.t.kind==="boat"){ route=null; return; } routeT-=dt; if (routeT>0) return; routeT=.6; route=astar(nearRoad(v.x,v.y),nearRoad(gps.x,gps.y)); if (route){ route.unshift([v.x,v.y]); route.push([gps.x,gps.y]); } }
function routeFromCar(){ const v=jj.veh; if (!v||!route||route.length<2) return route; const nx=v.x+Math.cos(v.a)*v.t.l*.5, ny=v.y+Math.sin(v.a)*v.t.l*.5; let best=1, bd=1e9, bp=null;
  for (let i=1;i<route.length;i++){ const [ax,ay]=route[i-1], [bx,by]=route[i], vx=bx-ax, vy=by-ay, L=vx*vx+vy*vy||1, k=Math.max(0,Math.min(1,((nx-ax)*vx+(ny-ay)*vy)/L)), px=ax+vx*k, py=ay+vy*k, d=Math.hypot(px-nx,py-ny); if (d<bd){ bd=d; best=i; bp=[px,py]; } }
  return [[nx,ny],bp,...route.slice(best)]; }
function drawRoute(q){ if (!route||route.length<2) return; const rt=routeFromCar(); q.save(); q.lineJoin="round"; q.lineCap="round"; const path=()=>{ q.beginPath(); q.moveTo(rt[0][0],rt[0][1]); for (let i=1;i<rt.length;i++) q.lineTo(rt[i][0],rt[i][1]); };
  path(); q.strokeStyle="rgba(30,20,40,.35)"; q.lineWidth=16; q.stroke(); path(); q.strokeStyle="rgba(255,214,10,.85)"; q.lineWidth=9; q.stroke(); path(); q.strokeStyle="rgba(255,250,200,.9)"; q.lineWidth=2; q.setLineDash([10,14]); q.lineDashOffset=-performance.now()/30; q.stroke(); q.restore(); }
function updateGps(){ if (gps&&!gps.next&&!gps.mission&&Math.hypot(gps.x-jj.x,gps.y-jj.y)<90){ toast("Ziel erreicht: "+gps.n); gps=null; } }
function drawGpsWorld(q,vis,t){ if (!gps||gps.next) return; if (vis(gps.x,gps.y,40)){ const by=gps.y-30+Math.sin(t*4)*4; q.fillStyle="rgba(255,214,10,.25)"; q.beginPath(); q.ellipse(gps.x,gps.y,26,12,0,0,7); q.fill(); q.fillStyle="#ffd60a"; q.strokeStyle="#120f14"; q.lineWidth=2; q.beginPath(); q.moveTo(gps.x,by+14); q.lineTo(gps.x-9,by); q.arc(gps.x,by-2,9,Math.PI*.9,Math.PI*.1); q.closePath(); q.fill(); q.stroke(); } }
// Ziel-Pfeil am Bildschirmrand: nie hinter/auf HUD-Elementen (Minimap, Buttons, Stick, Chips …)
let GPSR={t:0,r:[]};
function hudRects(){ const now=performance.now(); if (now-GPSR.t<400) return GPSR.r; GPSR.t=now; const out=[];
  for (const el of document.querySelectorAll('#hud *, #help, #obj, #wanted, #cash, #hpBox, #wpn, #phoneBtn, #radioChip, #lapChip, #zone, #veh, #bAct, #bBrake, #bJump, #bEnter, #stick, #tb, .tbtn, .chip')){ if (el.hidden||!el.offsetParent&&getComputedStyle(el).position!=="fixed") continue; const b=el.getBoundingClientRect(); if (b.width<4||b.height<4||b.width>cssW*.9&&b.height>cssH*.9) continue; const st=getComputedStyle(el); if (st.visibility==="hidden"||st.display==="none"||+st.opacity===0) continue; out.push([b.left,b.top,b.right,b.bottom]); }
  return GPSR.r=out; }
function gpsArrowPos(a){ const m=44, L=m, T=m+6, Rr=cssW-m, B=cssH-m-26, W=Rr-L, H=B-T, P=2*(W+H);
  const k=Math.min(Math.abs((W/2)/(Math.cos(a)||1e-6)),Math.abs((H/2)/(Math.sin(a)||1e-6))), cx=(L+Rr)/2+Math.cos(a)*k, cy=(T+B)/2+Math.sin(a)*k;
  const toP=(x,y)=>Math.abs(y-T)<1?x-L:Math.abs(x-Rr)<1?W+(y-T):Math.abs(y-B)<1?W+H+(Rr-x):2*W+H+(B-y);
  const at=s=>{ s=((s%P)+P)%P; if (s<W) return [L+s,T]; s-=W; if (s<H) return [Rr,T+s]; s-=H; if (s<W) return [Rr-s,B]; s-=W; return [L,B-s]; };
  const rs=hudRects(), free=(x,y)=>!rs.some(r=>x+24>r[0]&&x-24<r[2]&&y+42>r[1]&&y-24<r[3]);
  const s0=toP(Math.max(L,Math.min(Rr,cx)),Math.max(T,Math.min(B,cy)));
  for (let d=0;d<P/2;d+=8){ for (const sg of d?[1,-1]:[1]){ const p=at(s0+sg*d); if (free(p[0],p[1])) return p; } }
  return at(s0); }
function drawGpsScreen(q,ox,oy,sc){ if (!gps||CINEMA) return; const sx=(gps.x-ox)*sc, sy=(gps.y-oy)*sc; if (sx>0&&sy>0&&sx<cssW&&sy<cssH) return; const a=Math.atan2(sy-cssH/2,sx-cssW/2), [ax,ay]=gpsArrowPos(a);
  q.save(); q.translate(ax,ay); q.fillStyle="rgba(18,16,22,.85)"; q.beginPath(); q.arc(0,0,20,0,7); q.fill(); q.rotate(a); q.fillStyle="#ffd60a"; q.beginPath(); q.moveTo(13,0); q.lineTo(-6,-9); q.lineTo(-2,0); q.lineTo(-6,9); q.closePath(); q.fill(); q.restore();
  q.font='700 11px "Barlow Semi Condensed",sans-serif'; q.textAlign="center"; q.fillStyle="#ffd60a"; q.fillText(Math.round(Math.hypot(gps.x-jj.x,gps.y-jj.y)/10)+" m",ax,ay+33); }
// radio: small synthesized stations, play while driving
const STATIONS=[{n:"PACIFIC HOUSE",tag:"House",ico:"🌊",col:"#2ea8ff",bpm:122,root:41,sc:[0,2,4,5,7,9,11],swing:0},{n:"TALK 98.7",tag:"Big Ronnie & John",ico:"🎙️",col:"#ff8fd8",bpm:0,talk:true},{n:"AUS",tag:"Radio aus",ico:"⏻",col:"#3a3a3c",bpm:0}];
const TALK_IDX=STATIONS.findIndex(s=>s.talk); let radioFirst=false;
let radioIdx=0, radioStep=0, radioNext=0, radioBus=null, radioWasCar=false;
const SET={bgRadio:true,sfx:true,intro:true}; try{ Object.assign(SET,JSON.parse(localStorage.getItem("jjla-set")||"{}")); }catch(e){}
const saveSet=()=>{ try{ localStorage.setItem("jjla-set",JSON.stringify(SET)); }catch(e){} };
const midi=n=>440*Math.pow(2,(n-69)/12);
function djEnsure(){ try{ if (!DJ.a){ const src=()=>DJ.eps[DJ.i]+(LANG==="en"?"_en":"")+".mp3"; DJ.a=new Audio(src()); DJ.a.preload="auto"; DJ.a.volume=.9; DJ.a.onended=()=>{ DJ.i=(DJ.i+1)%DJ.eps.length; DJ.a.src=src(); DJ.a.play().catch(()=>{}); }; } }catch(e){} return DJ.a; }
function djUnlock(){ const a=djEnsure(); if (!a||DJ.unlocked) return; DJ.unlocked=true; const m=a.muted; a.muted=true; const p=a.play(); if (p&&p.then) p.then(()=>{ if (!(jj.veh&&STATIONS[radioIdx].talk)) a.pause(); a.muted=m; }).catch(()=>{ a.muted=m; DJ.unlocked=false; }); }
addEventListener("pointerdown",()=>djUnlock(),{capture:true}); addEventListener("keydown",()=>djUnlock(),{capture:true});
function setRadio(i){ radioIdx=(i+STATIONS.length)%STATIONS.length; if (STATIONS[radioIdx].talk){ const a=djEnsure(); if (a&&a.paused) a.play().catch(()=>{}); } radioStep=0; if (AC) radioNext=AC.currentTime+.05; if (jj.veh) toast("📻 "+STATIONS[radioIdx].n); }
function rnote(t,f,dur,type,vol,cut){ const o=AC.createOscillator(), g2=AC.createGain(), fl=AC.createBiquadFilter(); o.type=type; o.frequency.value=f; fl.type="lowpass"; fl.frequency.value=cut||2000; g2.gain.setValueAtTime(0,t); g2.gain.linearRampToValueAtTime(vol,t+.01); g2.gain.exponentialRampToValueAtTime(.001,t+dur); o.connect(fl); fl.connect(g2); g2.connect(radioBus); o.start(t); o.stop(t+dur+.05); }
function rdrum(t,kind){ if (kind==="k"){ const o=AC.createOscillator(), g2=AC.createGain(); o.frequency.setValueAtTime(140,t); o.frequency.exponentialRampToValueAtTime(42,t+.18); g2.gain.setValueAtTime(.9,t); g2.gain.exponentialRampToValueAtTime(.001,t+.3); o.connect(g2); g2.connect(radioBus); o.start(t); o.stop(t+.32); return; }
  if (!NB) NB=noiseBuf(); const src=AC.createBufferSource(), f=AC.createBiquadFilter(), g2=AC.createGain(); src.buffer=NB; f.type=kind==="h"?"highpass":"bandpass"; f.frequency.value=kind==="h"?7000:1800; g2.gain.setValueAtTime(kind==="h"?.18:.5,t); g2.gain.exponentialRampToValueAtTime(.001,t+(kind==="h"?.05:.16)); src.connect(f); f.connect(g2); g2.connect(radioBus); src.start(t,Math.random()*.5); src.stop(t+.2); }
const DJ={a:null,eps:["radio_hai"],i:0};
function updateDJ(){ const inCar=jj.veh&&!jj.veh.wreck&&started, talk=inCar&&STATIONS[radioIdx].talk;
  if (talk){ djEnsure(); if (DJ.a){ if (DJ.a.paused) DJ.a.play().catch(()=>{}); const tv=DLG||paused?.12:.9; DJ.a.volume+=(tv-DJ.a.volume)*.1; } }
  else if (DJ.a&&!DJ.a.paused) DJ.a.pause();
  const el=$("radioChip"); if (el){ const key=inCar?radioIdx:-1; if (el.dataset.k!==String(key)){ el.dataset.k=String(key); el.hidden=!inCar; if (inCar){ const st=STATIONS[radioIdx]; $("rIco").textContent=st.ico; $("rName").textContent=st.n; $("rTag").textContent=st.tag; el.style.setProperty("--c",st.col); el.classList.toggle("live",!!st.talk); } } } }
$("radioChip").addEventListener("pointerdown",e=>{ e.preventDefault(); e.stopPropagation(); if (jj.veh) setRadio(radioIdx+1); });
function updateRadio(){ updateDJ(); if (!AC) return; if (!radioBus){ radioBus=AC.createGain(); radioBus.gain.value=0; radioBus.connect(master); }
  const inCar=jj.veh&&!jj.veh.wreck, bg=!inCar&&SET.bgRadio&&started&&!SHOPIN, on=inCar?STATIONS[radioIdx].bpm>0:bg; if (inCar!==radioWasCar){ if (inCar&&!radioFirst){ radioFirst=true; radioIdx=0; } radioWasCar=inCar; radioStep=0; radioNext=AC.currentTime+.05; } radioBus.gain.setTargetAtTime(on?(inCar?.32:.06):0,AC.currentTime,.4); if (!on){ radioNext=AC.currentTime+.05; return; }
  const st=inCar?STATIONS[radioIdx]:STATIONS[0], s16=60/st.bpm/4; while (radioNext<AC.currentTime+.12){ const t=radioNext+(radioStep%2?st.swing*s16:0), i=radioStep%16, bar=Math.floor(radioStep/16)%4, prog=[0,3,4,2][bar];
    const deg=d=>st.root+st.sc[((d%st.sc.length)+st.sc.length)%st.sc.length]+12*Math.floor(d/st.sc.length);
    if (st.n==="HYPE FM"){ if (i===0||i===10) rdrum(t,"k"); if (i===4||i===12) rdrum(t,"s"); if (i%2===0) rdrum(t,"h"); if (i===0||i===7||i===10) rnote(t,midi(deg(prog)),.35,"sine",.5,400); if (i===0||i===8) for (const d of [0,2,4]) rnote(t,midi(deg(prog+d)+24),.5,"triangle",.06,1800); }
    else if (st.n==="NEON 88"){ if (i%4===0) rdrum(t,"k"); if (i===4||i===12) rdrum(t,"s"); if (i%2===1) rdrum(t,"h"); rnote(t,midi(deg(prog)-12+12*(i%2)),.12,"sawtooth",.12,700); if (i%4===0) for (const d of [0,2,4]) rnote(t,midi(deg(prog+d)+12),.7,"sawtooth",.035,1400); if ([0,3,6,10,13].includes(i)) rnote(t,midi(deg(prog+[4,2,5,4,7][[0,3,6,10,13].indexOf(i)])+24),.25,"square",.04,2600); }
    else { if (i%4===0) rdrum(t,"k"); if (i%4===2) rdrum(t,"h"); if (i===4||i===12) rdrum(t,"s"); if (i%4===2) rnote(t,midi(deg(prog)),.2,"square",.14,500); if (i===2||i===8||i===14) for (const d of [0,2,4,6]) rnote(t,midi(deg(prog+d)+12),.18,"triangle",.07,2200); }
    radioNext+=s16; radioStep++; } }
// skills: grow by doing
const SKN={fit:{n:"Fitness",i:"🏃",col:"#30d158",fx:"Schneller rennen"},drive:{n:"Fahren",i:"🏎️",col:"#ff9f0a",fx:"Höhere Höchstgeschwindigkeit"},shoot:{n:"Schießen",i:"🎯",col:"#ff453a",fx:"Weniger Streuung"},str:{n:"Stärke",i:"💪",col:"#bf5af2",fx:"Weniger Schläge nötig"}};
const SKXP={fit:0,drive:0,shoot:0,str:0}, SKSTEP={fit:4000,drive:60,shoot:30,str:20};
const skLv=k=>Math.min(5,Math.floor(SKXP[k]/SKSTEP[k])), skProg=k=>(SKXP[k]/SKSTEP[k])%1;
function skAdd(k,v){ const a=skLv(k); SKXP[k]+=v; if (skLv(k)>a) toast(SKN[k].n+" Level "+skLv(k)+"!"); }
