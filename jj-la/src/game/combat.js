// ================= WEAPONS =================
const WLIST=["fist","bat","shotgun","scar","gl","rpg","alien"], WNAME={fist:"Fäuste",knuckles:"Schlagring",bat:"Baseballschläger",shotgun:"Schrotflinte",scar:"SCAR",gl:"Granatwerfer",rpg:"Raketenwerfer",alien:"Alien-Blaster"};
const W={cur:"fist",own:{fist:true},mag:{shotgun:0,scar:0,gl:0,rpg:0,alien:0},res:{shotgun:0,scar:0,gl:0,rpg:0,alien:0},cd:0,reload:0,swing:0,hitDone:true};
let cash=7;
const MAGSZ={shotgun:8,scar:30,gl:6,rpg:1,alien:12};
const haveW=w=>!!W.own[w];
function setWeapon(w){ if (!haveW(w)||jj.veh) return; W.cur=w; W.reload=0; hudDirty=true; }
function cycleWeapon(d){ let i=WLIST.indexOf(W.cur); for (let k=0;k<WLIST.length;k++){ i=(i+(d||1)+WLIST.length)%WLIST.length; if (haveW(WLIST[i])) break; } setWeapon(WLIST[i]); }

const tracers=[], rockets=[];
let aimOverride=null, mouseHeld=false, meleeHeld=false, mouseS=null, mouseT=-99;
const AIM={on:false,manual:false,ang:0,ox:0,oy:0,id:null,src:null};
const isGun=w=>w==="shotgun"||w==="rpg"||w==="scar"||w==="gl"||w==="alien";
function mouseAng(){ if (!mouseS) return null; const m=screenToWorld(mouseS.x,mouseS.y); return Math.atan2(m.y-jj.y,m.x-jj.x); }
function hitNpcAt(x,y,r){ for (const n of npcs) if (!n.dead&&Math.abs(n.x-x)<r&&Math.abs(n.y-y)<r&&Math.hypot(n.x-x,n.y-y)<r) return n; return null; }
function castRay(a,range){ const mx=jj.x+Math.cos(a)*26, my=jj.y+Math.sin(a)*26; let x=mx, y=my, hit=null; for (let d=0;d<range;d+=7){ x+=Math.cos(a)*7; y+=Math.sin(a)*7;
    if (buildings.some(b=>x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h)||(INROOM&&CURSOL.some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h))){ hit="wall"; break; } const n=hitNpcAt(x,y,10); if (n){ hit=n; break; } const v=vehicles.find(v=>!v.gone&&v.z<.5&&inVeh(v,x,y,0)); if (v){ hit=v; break; } } return {mx,my,x,y,hit}; }
function aimAngle(){ if (AIM.on&&AIM.src==="mouse"){ const a=mouseAng(); if (a!=null) return a; } if (AIM.on) return AIM.ang; if (!touch&&mouseS&&performance.now()/1000-mouseT<6) return mouseAng(); const aa=autoAim({rpg:720,gl:520,scar:430,alien:600}[W.cur]||320,.42); return aa!=null?aa:jj.ang+Math.PI/2; }
function drawAim(q,t){ if (jj.veh||jj.dead||!isGun(W.cur)||!AIM.on||jj.h>0) return; const a=aimAngle(); if (a==null) return; const range={rpg:720,gl:520,scar:430,alien:600}[W.cur]||330, r=castRay(a,range), strong=AIM.on||mouseHeld||(!touch&&mouseS);
  q.save(); q.lineCap="round"; if (W.cur==="shotgun"){ q.strokeStyle=`rgba(255,80,70,${strong?.18:.1})`; q.lineWidth=1; for (const s2 of [-.16,.16]){ q.beginPath(); q.moveTo(r.mx,r.my); q.lineTo(r.mx+Math.cos(a+s2)*range*.95,r.my+Math.sin(a+s2)*range*.95); q.stroke(); } }
  q.setLineDash([7,6]); q.lineDashOffset=-t*30; q.strokeStyle=`rgba(255,70,60,${strong?.85:.45})`; q.lineWidth=1.8; q.beginPath(); q.moveTo(r.mx,r.my); q.lineTo(r.x,r.y); q.stroke(); q.setLineDash([]);
  const tgt=r.hit&&r.hit!=="wall"; q.fillStyle=tgt?"#ff3b30":"rgba(255,70,60,.8)"; q.beginPath(); q.arc(r.x,r.y,tgt?3.5:2.5,0,7); q.fill();
  if (tgt){ q.strokeStyle="#ff3b30"; q.lineWidth=2; const rr3=11+Math.sin(t*8)*1.5; q.beginPath(); q.arc(r.x,r.y,rr3,0,7); q.stroke(); for (let i=0;i<4;i++){ const b=i*Math.PI/2; q.beginPath(); q.moveTo(r.x+Math.cos(b)*(rr3-4),r.y+Math.sin(b)*(rr3-4)); q.lineTo(r.x+Math.cos(b)*(rr3+5),r.y+Math.sin(b)*(rr3+5)); q.stroke(); } }
  q.restore(); }
function autoAim(range,cone){ const fa=jj.ang+Math.PI/2; let best=null, bs=1e9; for (const v of vehicles){ if (v.gone||v.z>.5) continue; const dx=v.x-jj.x, dy=v.y-jj.y, d=Math.hypot(dx,dy); if (d>range||d<4) continue; let da=Math.atan2(dy,dx)-fa; da=Math.abs(Math.atan2(Math.sin(da),Math.cos(da))); if (da<cone){ const sc=d*(1+da*2); if (sc<bs){ bs=sc; best=Math.atan2(dy,dx); } } } return best; }
function attack(forceAng){ if (SHOPIN||JAILIN||HOMEIN||jj.veh||jj.dead||jj.lock||W.cd>0||W.reload>0||jj.h>0||jj.swim) return; const w=W.cur; if (forceAng!=null) aimOverride=forceAng;
  if (aimOverride!=null){ jj.ang=aimOverride-Math.PI/2; aimOverride=null; }
  if (w==="fist"||w==="bat"||w==="knuckles"){ W.atkAt=performance.now(); W.side=-(W.side||1); W.swing=.28; W.hitDone=false; W.cd=w==="bat"?.42:w==="knuckles"?.3:.32; sfx("swing"); return; }
  if (W.mag[w]<=0){ startReload(); return; }
  const aa=forceAng!=null?forceAng:autoAim(w==="rpg"?720:320,.42); const fa=aa!=null?aa:jj.ang+Math.PI/2; jj.ang=fa-Math.PI/2;
  const mx=jj.x+Math.cos(fa)*26, my=jj.y+Math.sin(fa)*26; W.mag[w]--; hudDirty=true; if (w!=="rpg"&&w!=="gl"&&w!=="scar"){ for (let d=4;d<=30;d+=6){ const n=hitNpcAt(jj.x+Math.cos(fa)*d,jj.y+Math.sin(fa)*d,14); if (n){ killNpc(n,Math.cos(fa)*240,Math.sin(fa)*240); break; } } }
  emit("flash",mx,my,{size:w==="rpg"?70:46,life:.08,max:.08});
  if (w==="shotgun"){ sfx("shot"); shake=Math.max(shake,3); W.cd=.55; scareNpcs(jj.x,jj.y,600);
    for (let i=0;i<8;i++){ const a=fa+(rnd()-.5)*.32*(1-skLv("shoot")*.1); let x=mx, y=my, hit=null; for (let d=0;d<330;d+=7){ x+=Math.cos(a)*7; y+=Math.sin(a)*7; const b=buildings.find(b=>x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h); if (b){ hit="wall"; break; } const n=hitNpcAt(x,y,10); if (n){ hit=n; break; } const v=vehicles.find(v=>!v.gone&&v.z<.5&&inVeh(v,x,y,0)); if (v){ hit=v; break; } }
      tracers.push({x1:mx,y1:my,x2:x,y2:y,t:.07});
      if (hit&&hit!=="wall") skAdd("shoot",.2);
      if (hit&&hit.look){ killNpc(hit,Math.cos(a)*260,Math.sin(a)*260); }
      else if (hit&&hit!=="wall"){ damageVeh(hit,6); hit.sx+=Math.cos(a)*14; hit.sy+=Math.sin(a)*14; for (let k=0;k<3;k++) emit("spark",x,y,{vx:(rnd()-.5)*260,vy:(rnd()-.5)*260,life:.25,max:.25}); }
      else if (hit==="wall"){ emit("dust",x,y,{size:8,grow:30,life:.5,max:.5,a:.6}); } }
    emit("smoke",mx,my,{size:12,grow:40,life:.6,max:.6,a:.4}); if (W.mag.shotgun<=0) startReload(); }
  if (w==="scar"){ W.cd=.32; W.burst={n:2,t:.075,a:fa}; fireBullet(mx,my,fa,.05); }
  if (w==="gl"){ sfx("rocket"); W.cd=.75; shake=Math.max(shake,3); grenades.push({x:mx,y:my,vx:Math.cos(fa)*420,vy:Math.sin(fa)*420,h:4,vh:150,life:1.6,spin:0}); emit("smoke",mx,my,{size:16,grow:40,life:.6,max:.6,a:.5}); if (W.mag.gl<=0) startReload(); }
  if (w==="alien"){ sfx("swing"); W.cd=.38; shake=Math.max(shake,2); bolts.push({x:mx,y:my,vx:Math.cos(fa)*950,vy:Math.sin(fa)*950,a:fa,life:.7,hit:new Set()}); for (let k=0;k<6;k++) emit("spark",mx,my,{vx:Math.cos(fa+(rnd()-.5))*200,vy:Math.sin(fa+(rnd()-.5))*200,life:.25,max:.25,col:"#7dff6a"}); if (W.mag.alien<=0) startReload(); }
  if (w==="rpg"){ sfx("rocket"); W.cd=.9; shake=Math.max(shake,5); rockets.push({x:mx,y:my,vx:Math.cos(fa)*620,vy:Math.sin(fa)*620,a:fa,life:1.5,tr:0}); emit("smoke",jj.x-Math.cos(fa)*20,jj.y-Math.sin(fa)*20,{size:30,grow:60,life:.8,max:.8,a:.6}); if (W.mag.rpg<=0) startReload(); } }
const grenades=[], bolts=[];
function fireBullet(mx,my,fa,spread){ wantOnShot(); sfx("shot"); shake=Math.max(shake,1.6); scareNpcs(jj.x,jj.y,500); const a=fa+(rnd()-.5)*spread*(1-skLv("shoot")*.1); let x=mx, y=my, hit=null;
  if (!jj.veh){ for (let d=4;d<=30;d+=6){ const n=hitNpcAt(jj.x+Math.cos(a)*d,jj.y+Math.sin(a)*d,13); if (n){ hit=n; x=n.x; y=n.y; break; } } }
  if (!hit) for (let d=0;d<430;d+=7){ x+=Math.cos(a)*7; y+=Math.sin(a)*7; if (buildings.some(b=>x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h)||(INROOM&&CURSOL.some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h))){ hit="wall"; break; } const n=hitNpcAt(x,y,10); if (n){ hit=n; break; } const v=vehicles.find(v=>!v.gone&&v.z<.5&&inVeh(v,x,y,0)); if (v){ hit=v; break; } }
  tracers.push({x1:mx,y1:my,x2:x,y2:y,t:.06}); emit("flash",mx,my,{size:30,life:.05,max:.05});
  if (hit&&hit.look){ skAdd("shoot",.2); killNpc(hit,Math.cos(a)*220,Math.sin(a)*220); } else if (hit&&hit!=="wall"){ damageVeh(hit,8); for (let k=0;k<3;k++) emit("spark",x,y,{vx:(rnd()-.5)*240,vy:(rnd()-.5)*240,life:.2,max:.2}); } else if (hit==="wall") emit("dust",x,y,{size:6,grow:24,life:.4,max:.4,a:.6}); }
function updateProjectiles(dt){ if (W.burst&&W.burst.n>0){ W.burst.t-=dt; if (W.burst.t<=0){ if (W.mag.scar>0&&!jj.veh){ W.mag.scar--; hudDirty=true; const fa=W.burst.a; fireBullet(jj.x+Math.cos(fa)*26,jj.y+Math.sin(fa)*26,fa,.09); } W.burst.n--; W.burst.t=.075; if (W.burst.n<=0){ W.burst=null; if (W.mag.scar<=0) startReload(); } } }
  for (let i=grenades.length-1;i>=0;i--){ const g2=grenades[i]; g2.life-=dt; g2.spin+=dt*14; g2.vh-=420*dt; g2.h+=g2.vh*dt; if (g2.h<0){ g2.h=0; g2.vh=-g2.vh*.35; g2.vx*=.6; g2.vy*=.6; }
    const nx=g2.x+g2.vx*dt, ny=g2.y+g2.vy*dt; if (blockedAt(nx,ny,3)&&!inWater(nx,ny)){ g2.vx*=-.4; g2.vy*=-.4; } else { g2.x=nx; g2.y=ny; }
    if (g2.life<=0||(g2.h<10&&(hitNpcAt(g2.x,g2.y,12)&&hitNpcAt(g2.x,g2.y,12).hostile||vehicles.some(v=>!v.gone&&v.z<.5&&inVeh(v,g2.x,g2.y,2))))){ grenades.splice(i,1); if (inWater(g2.x,g2.y)){ sfx("boom"); for (let k=0;k<14;k++) emit("smoke",g2.x,g2.y,{vx:(rnd()-.5)*180,vy:(rnd()-.5)*180,size:16,grow:40,life:.8,max:.8,a:.7}); } else explosion(g2.x,g2.y,.85,null); } }
  for (let i=bolts.length-1;i>=0;i--){ const b=bolts[i]; b.life-=dt; let end=b.life<=0; for (let s2=0;s2<4&&!end;s2++){ b.x+=b.vx*dt/4; b.y+=b.vy*dt/4; if (buildings.some(B=>b.x>B.x&&b.x<B.x+B.w&&b.y>B.y&&b.y<B.y+B.h)||(INROOM&&CURSOL.some(r=>b.x>r.x&&b.x<r.x+r.w&&b.y>r.y&&b.y<r.y+r.h))){ end=true; break; }
      const n=hitNpcAt(b.x,b.y,12); if (n&&!b.hit.has(n)){ b.hit.add(n); killNpc(n,b.vx*.25,b.vy*.25); for (let k=0;k<12;k++) emit("spark",n.x,n.y,{vx:(rnd()-.5)*300,vy:(rnd()-.5)*300,life:.45,max:.45,col:"#7dff6a"}); }
      const v=vehicles.find(v=>!v.gone&&v.z<.5&&inVeh(v,b.x,b.y,2)); if (v&&!b.hit.has(v)){ b.hit.add(v); damageVeh(v,35); for (let k=0;k<8;k++) emit("spark",b.x,b.y,{vx:(rnd()-.5)*260,vy:(rnd()-.5)*260,life:.3,max:.3,col:"#9dff8a"}); } }
    if (end){ bolts.splice(i,1); for (let k=0;k<8;k++) emit("spark",b.x,b.y,{vx:(rnd()-.5)*200,vy:(rnd()-.5)*200,life:.3,max:.3,col:"#7dff6a"}); } } }
function drawProjectiles(q){ for (const g2 of grenades){ q.fillStyle="rgba(20,15,25,.35)"; q.beginPath(); q.ellipse(g2.x+3,g2.y+3,4,3,0,0,7); q.fill(); q.save(); q.translate(g2.x,g2.y-g2.h*.4); q.rotate(g2.spin); q.fillStyle="#3c4a2a"; q.beginPath(); q.ellipse(0,0,5,3.6,0,0,7); q.fill(); q.fillStyle="#c9a227"; q.fillRect(-1,-3.6,2,7.2); q.restore(); }
  q.save(); q.globalCompositeOperation="lighter"; for (const b of bolts){ q.strokeStyle="rgba(125,255,106,.35)"; q.lineWidth=9; q.lineCap="round"; q.beginPath(); q.moveTo(b.x-Math.cos(b.a)*26,b.y-Math.sin(b.a)*26); q.lineTo(b.x,b.y); q.stroke(); q.strokeStyle="#e9ffe0"; q.lineWidth=3; q.beginPath(); q.moveTo(b.x-Math.cos(b.a)*16,b.y-Math.sin(b.a)*16); q.lineTo(b.x,b.y); q.stroke(); } q.restore(); }
function startReload(){ const w=W.cur; if (!MAGSZ[w]||W.reload>0||W.mag[w]>=MAGSZ[w]) return; if (W.res[w]<=0){ toast("Keine Munition – kauf welche bei LA ARMS"); return; } W.reload={rpg:1.6,gl:1.5,scar:1.4,alien:1}[w]||1.2; sfx("reload"); hudDirty=true; }
function updateWeapons(dt){ W.cd=Math.max(0,W.cd-dt); updateProjectiles(dt);
  if (W.reload>0){ W.reload-=dt; if (W.reload<=0){ const w=W.cur, n=Math.min(MAGSZ[w]-W.mag[w],W.res[w]); W.mag[w]+=n; W.res[w]-=n; sfx("reload"); hudDirty=true; } }
  if (W.swing>0){ W.swing-=dt; if (!W.hitDone&&W.swing<.17){ W.hitDone=true; const fa=jj.ang+Math.PI/2, hx=jj.x+Math.cos(fa)*22, hy=jj.y+Math.sin(fa)*22;
      for (const v of vehicles){ if (v.gone||v.z>.3) continue; if (inVeh(v,hx,hy,14)){ const dmg=W.cur==="bat"?10:W.cur==="knuckles"?4:2; damageVeh(v,dmg); v.sx+=Math.cos(fa)*(W.cur==="bat"?30:8); v.sy+=Math.sin(fa)*(W.cur==="bat"?30:8); sfx("hit"); shake=Math.max(shake,W.cur==="bat"?4:1.5); for (let k=0;k<5;k++) emit("spark",hx,hy,{vx:(rnd()-.5)*240,vy:(rnd()-.5)*240,life:.25,max:.25}); if (W.cur==="bat"&&!v.wreck) for (let k=0;k<4;k++) emit("debris",hx,hy,{vx:(rnd()-.5)*160,vy:(rnd()-.5)*160,size:2+rnd()*2,life:.8,max:.8,col:"rgba(190,220,240,.9)"}); break; } }
      for (const p of peds) if (Math.hypot(p.x-hx,p.y-hy)<20){ p.stun=.8; p.say="Au!"; }
      for (const n of npcs) if (!n.dead&&Math.hypot(n.x-hx,n.y-hy)<26){ sfx("hit"); skAdd("str",1); for (let k=0;k<8;k++){ const a2=fa+(rnd()-.5)*1.6, sp2=60+rnd()*120; emit("debris",n.x,n.y,{vx:Math.cos(a2)*sp2,vy:Math.sin(a2)*sp2,size:1.5+rnd()*2.5,life:.5,max:.5,col:rnd()<.5?"#c41f2a":"#8e0f18"}); } decals.push({x:n.x+(rnd()-.5)*8,y:n.y+(rnd()-.5)*8,r:3+rnd()*2,track:true,t:0,al:1}); if ((W.cur==="bat"&&!n.tough)||(n.hits=(n.hits||0)+(W.cur==="bat"?3:1))>=(n.tough||0)+(W.cur==="knuckles"?2:Math.max(1,3-Math.floor(skLv("str")/3)))) { killNpc(n,Math.cos(fa)*200,Math.sin(fa)*200); if (n.hostile) bark("ko",.45); } else { n.panic=4; n.panicSp=95; n.from={x:jj.x,y:jj.y}; n.x+=Math.cos(fa)*10; n.y+=Math.sin(fa)*10; } break; } } }
  if (!jj.veh&&W.cd<=0){ if (mouseHeld&&!isGun(W.cur)) attack((()=>{ const a=mouseAng(); if (a!=null) jj.ang=a-Math.PI/2; return null; })()); else if ((keys.Space&&!isGun(W.cur))||meleeHeld) attack(); }
  if (AIM.on&&(jj.veh||jj.dead||!isGun(W.cur))) AIM.on=false;
  if (!jj.veh&&!jj.dead&&isGun(W.cur)&&AIM.on&&W.swing<=0){ const a=aimAngle(); if (a!=null) jj.ang=a-Math.PI/2; }
  for (let i=tracers.length-1;i>=0;i--){ tracers[i].t-=dt; if (tracers[i].t<=0) tracers.splice(i,1); }
  for (let i=rockets.length-1;i>=0;i--){ const r=rockets[i]; r.life-=dt; r.tr-=dt; if (r.tr<=0){ r.tr=.016; emit("smoke",r.x,r.y,{size:12,grow:46,life:1.1,max:1.1,a:.55}); emit("fire",r.x,r.y,{size:14,life:.12,max:.12}); }
    let boom=r.life<=0; for (let s=0;s<3&&!boom;s++){ r.x+=r.vx*dt/3; r.y+=r.vy*dt/3; if (buildings.some(b=>r.x>b.x&&r.x<b.x+b.w&&r.y>b.y&&r.y<b.y+b.h)) boom=true; else if (vehicles.some(v=>!v.gone&&v.z<.5&&inVeh(v,r.x,r.y,2))||hitNpcAt(r.x,r.y,11)) boom=true; else if (r.x<0||r.y<0||r.x>WW||r.y>WH) boom=true; }
    if (boom){ rockets.splice(i,1); if (inWater(r.x,r.y)){ for (let k=0;k<20;k++) emit("smoke",r.x,r.y,{vx:(rnd()-.5)*200,vy:(rnd()-.5)*200,size:20,grow:50,life:1,max:1,a:.8}); sfx("boom"); for (const v of vehicles) if (v.t.kind==="boat"&&Math.hypot(v.x-r.x,v.y-r.y)<110) damageVeh(v,160*(1-Math.hypot(v.x-r.x,v.y-r.y)/110)); } else explosion(r.x,r.y,1,null); } } }
function drawRockets(q){ for (const r of rockets){ q.save(); q.translate(r.x,r.y); q.rotate(r.a); q.fillStyle="#4a5232"; q.fillRect(-8,-2,14,4); q.fillStyle="#8a5a3a"; q.beginPath(); q.moveTo(6,-2.5); q.lineTo(12,0); q.lineTo(6,2.5); q.fill(); q.fillStyle="#2a2a2a"; q.fillRect(-9,-4,3,8); q.restore(); }
  for (const t of tracers){ q.strokeStyle=`rgba(255,230,160,${t.t/.07*.8})`; q.lineWidth=1.4; q.beginPath(); q.moveTo(t.x1,t.y1); q.lineTo(t.x2,t.y2); q.stroke(); } }

// ================= HEALTH / WASTED =================
function hurt(d){ if (jj.dead||d<=0||FLY) return; jj.hp-=d; if (d>=12&&jj.hp>0) bark("hurt",.6); jj.lastHurt=performance.now()/1000; jj.flash=.35; hudDirty=true; if (jj.hp<=0){ jj.hp=0; wasted(); } }
function wasted(){ if (jj.dead) return; clearWanted(true); if (jj.veh){ const v=jj.veh; jj.veh=null; const p=landNear(v.x,v.y); jj.x=p.x; jj.y=p.y; } jj.dead=true; jj.deadT=0; W.swing=0; showDest(false); closePhone(); hudDirty=true; }
function homeSpot(){ const H=MS.done.mh&&typeof SALEDOOR!=="undefined"?SALEDOOR:DOOR; return {x:H.x,y:H.y+30}; }
function respawn(){ setCinema(false); blackout(false); if (CURROOM) leaveRoomRaw(); sgReset(); npcBoot=30; jj.h=0; jj.roof=null; jj.glide=null; jj.dead=false; jj.hp=100; { const H=homeSpot(); jj.x=H.x; jj.y=H.y; } jj.ang=0; cam.x=jj.x; cam.y=jj.y; hudDirty=true; }
function updateHealth(dt,t){ if (jj.dead){ jj.deadT+=dt; if (jj.deadT>4) respawn(); return; } jj.flash=Math.max(0,jj.flash-dt);
  if (jj.hp<100&&t-jj.lastHurt>6){ jj.hp=Math.min(100,jj.hp+dt*4); hudDirty=true; }
  nearShop=false;
  for (let i=pickups.length-1;i>=0;i--){ const p=pickups[i]; p.t+=dt; if (p.t>90){ pickups.splice(i,1); continue; } if (!jj.dead&&!jj.h&&Math.hypot(p.x-jj.x,p.y-jj.y)<(jj.veh?38:26)){ cash+=p.v; if (p.loot&&MI===p.loot){ p.loot.d.loot=(p.loot.d.loot||0)+p.v; } floatTxt(p.x,p.y,"+$"+p.v,"#7ee36a"); sfx("reload"); pickups.splice(i,1); hudDirty=true; } }
  for (let i=floats.length-1;i>=0;i--){ floats[i].t+=dt; if (floats[i].t>1.2) floats.splice(i,1); }
  for (const v of vehicles) if ((v.burn>0||v.wreckT>0&&v.wreckT<5)&&!jj.veh&&!jj.h&&Math.hypot(v.x-jj.x,v.y-jj.y)<34) hurt(dt*14); }

// ================= DRAW VEHICLES =================
const SHADOW={}; function shadowSpr(v){ const k=v.type; if (SHADOW[k]) return SHADOW[k]; const t=v.t, S=2, pad=20, l=t.kind==="heli"?50:t.l, w=t.kind==="heli"?18:t.w;
  return SHADOW[k]=mk((l+pad*2)*S,(w+pad*2)*S,q=>{ q.scale(S,S); q.shadowColor="rgba(25,15,40,.55)"; q.shadowBlur=7*S; q.shadowOffsetX=1000*S; q.fillStyle="#000"; rr(q,pad-1000,pad,l,w,t.kind==="moto"?4:6); q.fill(); }); }
function drawVehGround(q,v){ if (v.onRoof) return; if (v.z>.02&&v.t.kind==="heli"){ const h=v.z*240, sx=v.x+h*.45, sy=v.y+h*.17; const sp=shadowSpr(v), sw=sp.width/2*1.4, sh=sp.height/2*1.4; q.save(); q.translate(sx,sy); q.rotate(v.a); q.globalAlpha=Math.max(0,.3*(1-v.z*.45)); q.drawImage(sp,-sw/2,-sh/2,sw,sh); q.globalAlpha=.1*(1-v.z*.5); q.fillStyle="#1a1024"; q.beginPath(); q.arc(0,0,58,0,7); q.fill(); q.restore(); q.globalAlpha=1;
    if (v.z<.6&&!inWater(v.x,v.y)) for (let i=0;i<2;i++) if (rnd()<.4){ const a=rnd()*6.28; emit("dust",v.x+Math.cos(a)*30,v.y+Math.sin(a)*30,{vx:Math.cos(a)*120,vy:Math.sin(a)*120,size:14,grow:40,life:.6,max:.6,a:.35*(1-v.z)}); } return; }
  if (v.t.kind==="heli"){ q.save(); q.translate(v.x+6,v.y+3); q.rotate(v.a); q.globalAlpha=.5; const sp=shadowSpr(v); q.drawImage(sp,-sp.width*.35,-sp.height*.35,sp.width*.7,sp.height*.7); q.restore(); q.globalAlpha=1; drawHeliAir(q,v,view.vx,view.vy); return; }
  const sp=shadowSpr(v), sw=sp.width/2, sh=sp.height/2, bob=v.t.kind==="boat"?Math.sin(performance.now()/400+v.x)*.04:0;
  q.save(); q.translate(v.x+5,v.y+2.5); q.rotate(v.a); if (v.sinking) q.globalAlpha=Math.max(0,1-v.sinking/3); q.drawImage(sp,-sw/2,-sh/2,sw,sh); q.restore(); q.globalAlpha=1;
  drawVehBody(q,v,bob); }
function drawVehBody(q,v,bob){ const S=2, sp=spr(v.type,v.col,false); q.save(); q.translate(v.x,v.y); q.rotate(v.a+bob); if (v.sinking){ q.globalAlpha=Math.max(0,1-v.sinking/3); q.scale(1-v.sinking*.1,1-v.sinking*.1); }
  const w=sp.width/S, h=sp.height/S; q.drawImage(v.wreck?spr(v.type,v.col,true):sp,-w/2,-h/2,w,h);
  if (!v.wreck&&v.hp<v.t.hp){ q.globalAlpha=Math.min(.5,(1-Math.max(0,v.hp)/v.t.hp)*.55); q.drawImage(spr(v.type,v.col,true),-w/2,-h/2,w,h); q.globalAlpha=1; }
  if (v.type==="tank"&&!v.wreck) drawTankTop(q,v);
  const me=jj.veh===v;
  if ((v.driver||me)&&v.t.kind==="car"&&v.type!=="tank"){ q.fillStyle=me?LOOK.cap:"#2a1e16"; q.beginPath(); q.arc(v.t.l*.02,-v.t.w*.18,3.6,0,7); q.fill(); }
  if (me&&(v.t.kind==="moto"||v.t.kind==="boat")){ const x=v.t.kind==="moto"?-2:-6; q.fillStyle=LOOK.shirt; q.beginPath(); q.ellipse(x,0,5,9,0,0,7); q.fill(); q.fillStyle=LOOK.skin; q.beginPath(); q.arc(x+5,-6,2.4,0,7); q.arc(x+5,6,2.4,0,7); q.fill(); q.fillStyle=LOOK.cap; q.beginPath(); q.arc(x+1,0,5,0,7); q.fill(); }
  if (v.driver&&!me&&rnd()<.03) emit("smoke",v.x-Math.cos(v.a)*v.t.l*.55,v.y-Math.sin(v.a)*v.t.l*.55,{size:6,grow:16,life:.8,max:.8,a:.3});
  if (v.door>0&&v.t.kind==="car"&&!v.wreck){ const sd=v.doorSide||-1, w=v.t.w/2, L=v.t.l*.34, hx=v.t.l*.16, op=v.door*1.15;
    q.fillStyle="rgba(8,8,12,.75)"; q.fillRect(hx-L,sd<0?-w:w-2.6,L,2.6);
    q.save(); q.translate(hx,sd*(w-1)); q.rotate(-sd*op); const c=v.col||"#1d2230";
    q.fillStyle="rgba(20,12,30,.35)"; q.fillRect(-L+2,-.5,L,4.6); q.fillStyle=shade(c,1.05); q.fillRect(-L,-2.3,L,4.6); q.fillStyle="rgba(140,175,205,.9)"; q.fillRect(-L*.8,-1.2,L*.55,2.4); q.strokeStyle="rgba(0,0,0,.55)"; q.lineWidth=.8; q.strokeRect(-L,-2.3,L,4.6); q.restore(); }
  if (v.lights){ const on=Math.floor(performance.now()/140)%2; q.globalCompositeOperation="lighter"; q.globalAlpha=.85; const s=34; q.drawImage(FX.flash,-s/2,(on?-1:1)*v.t.w*.2-s/2,s,s); q.fillStyle=on?"rgba(255,60,60,.9)":"rgba(70,120,255,.9)"; q.beginPath(); q.arc(0,(on?-1:1)*v.t.w*.2,5,0,7); q.fill(); q.globalCompositeOperation="source-over"; q.globalAlpha=1; }
  q.restore(); }
function drawHeliAir(q,v,vx,vy){ const h=v.z*240, k=1+h/D, x=vx+(v.x-vx)*k, y=vy+(v.y-vy)*k, S=2, sp=spr(v.type,v.col,v.wreck); q.save(); q.translate(x,y); q.rotate(v.a); q.scale(k*1.4,k*1.4); const w=sp.width/S, hh=sp.height/S; q.drawImage(sp,-w/2,-hh/2,w,hh);
  if (!v.wreck&&v.hp<v.t.hp){ q.globalAlpha=Math.min(.5,(1-Math.max(0,v.hp)/v.t.hp)*.55); q.drawImage(spr(v.type,v.col,true),-w/2,-hh/2,w,hh); q.globalAlpha=1; }
  if (!v.wreck){ const spin=v.rot; if (v.z>0||v.spin){ const rg=q.createRadialGradient(2,0,4,2,0,43); rg.addColorStop(0,"rgba(40,40,46,.05)"); rg.addColorStop(.85,"rgba(40,40,46,.22)"); rg.addColorStop(1,"rgba(40,40,46,0)"); q.fillStyle=rg; q.beginPath(); q.arc(2,0,43,0,7); q.fill(); }
    q.strokeStyle="rgba(26,26,30,.9)"; q.lineWidth=3.4; q.lineCap="round"; for (let i=0;i<4;i++){ const a=spin+i*Math.PI/2; q.beginPath(); q.moveTo(2,0); q.lineTo(2+Math.cos(a)*42,Math.sin(a)*42); q.stroke(); }
    q.fillStyle="#1f2024"; q.beginPath(); q.arc(2,0,3.6,0,7); q.fill(); q.strokeStyle="rgba(30,30,34,.7)"; q.lineWidth=1.4; const ta=spin*1.7; q.beginPath(); q.moveTo(-v.t.l/2-1+Math.cos(ta)*8,-4+Math.sin(ta)*2); q.lineTo(-v.t.l/2-1-Math.cos(ta)*8,-4-Math.sin(ta)*2); q.stroke(); }
  q.restore(); }

