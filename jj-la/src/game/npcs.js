// ================= NPCs (pedestrians) =================
const npcs=[], decals=[], pickups=[], floats=[];
function floatTxt(x,y,txt,col){ floats.push({x,y,txt,col,t:0}); }
function drawPickups(q,t){ for (const p of pickups){ const b=Math.sin(t*4+p.x)*2, pulse=.5+Math.sin(t*5+p.y)*.5; q.save(); q.translate(p.x,p.y);
    q.fillStyle=`rgba(126,227,106,${.18+pulse*.18})`; q.beginPath(); q.arc(0,0,16+pulse*3,0,7); q.fill();
    q.translate(0,b); q.rotate(.25); q.fillStyle="rgba(20,40,10,.35)"; q.fillRect(-9,0,20,12);
    for (let i=0;i<3;i++){ q.fillStyle=i===2?"#7dd65f":i?"#5fbf4a":"#3f8f34"; q.fillRect(-10+i*1.2,-6-i*2.2,19,10); q.strokeStyle="rgba(20,60,15,.6)"; q.lineWidth=.8; q.strokeRect(-10+i*1.2,-6-i*2.2,19,10); }
    q.fillStyle="#eaffdc"; q.font="700 8px sans-serif"; q.textAlign="center"; q.textBaseline="middle"; q.fillText("$",-.4,-6.4); q.restore();
    if (Math.sin(t*3+p.x*.1)>.92){ q.fillStyle="#fff"; q.beginPath(); q.arc(p.x+6,p.y-10,1.6,0,7); q.fill(); } }
  for (const f of floats){ q.globalAlpha=1-f.t/1.2; q.font='400 18px "Bebas Neue",Impact,sans-serif'; q.textAlign="center"; q.lineWidth=3; q.strokeStyle="rgba(10,10,10,.7)"; q.strokeText(f.txt,f.x,f.y-20-f.t*30); q.fillStyle=f.col; q.fillText(f.txt,f.x,f.y-20-f.t*30); } q.globalAlpha=1; } let npcBoot=30;
const NPC_LOOKS=[...LOOKS,{skin:"#8d5a3b",skinHi:"#a8714f",shirt:"#7b4fc2",shirtHi:"#9d74e0",pants:"#2a2a30",shoe:"#ddd",hair:"#111"},{skin:"#f3d2b3",skinHi:"#ffe4cc",shirt:"#e8e4d8",shirtHi:"#ffffff",pants:"#4a6a8a",shoe:"#7a4a2a",hair:"#e0c070"},{skin:"#6e4530",skinHi:"#8a5a40",shirt:"#d9473a",shirtHi:"#f06a5a",pants:"#e6e0d0",shoe:"#222",hair:"#1a1a1a"},{skin:"#d9a882",skinHi:"#ebc09c",shirt:"#2b2b30",shirtHi:"#45454c",pants:"#2b2b30",shoe:"#fff",hair:"#5a3a20"},{skin:"#e8bf98",skinHi:"#f7d4b0",shirt:"#ff8fb0",shirtHi:"#ffb0c8",pants:"#f2f2ee",shoe:"#e8a0b0",hair:"#2a1a10"}];
// walkable strips: sidewalks along every road, plus plaza paths and the beach
const STRIPS=[]; for (const r of roads){ if (r.w>r.h){ STRIPS.push({x0:r.x,x1:r.x+r.w,y0:r.y-22,y1:r.y-6,h:true},{x0:r.x,x1:r.x+r.w,y0:r.y+r.h+6,y1:r.y+r.h+22,h:true}); } else { STRIPS.push({x0:r.x-22,x1:r.x-6,y0:r.y,y1:r.y+r.h,h:false},{x0:r.x+r.w+6,x1:r.x+r.w+22,y0:r.y,y1:r.y+r.h,h:false}); } }
STRIPS.push({x0:150,x1:2050,y0:3110,y1:3190,h:true});
{ const e=BLOCKS[4]; STRIPS.push({x0:e.x,x1:e.x+e.w,y0:e.y+e.h/2-10,y1:e.y+e.h/2+10,h:true},{x0:e.x+e.w/2-10,x1:e.x+e.w/2+10,y0:e.y,y1:e.y+e.h,h:false}); }
const npcSolid=(x,y,r=12)=>{ for (const s of solids) if (x+r>s.x&&x-r<s.x+s.w&&y+r>s.y&&y-r<s.y+s.h) return true; return false; };
const npcVeh=(x,y,r=16)=>{ for (const v of vehicles){ if (v.gone||v.z>.15||v.t.kind==="boat"||Math.abs(v.v||0)>25) continue; if (Math.abs(v.x-x)<70&&Math.abs(v.y-y)<70&&inVeh(v,x,y,r)) return true; } return false; };
const npcFree=(x,y,r)=>!inWater(x,y)&&!beyondShore(x,y,8)&&x>10&&y>10&&x<WW-10&&y<WH-10&&!npcSolid(x,y,r==null?15:r)&&!npcVeh(x,y,r==null?16:r);
const npcCrowd=(n,x,y)=>{ for (const m of npcs){ if (m===n||m.dead) continue; const dx=x-m.x, dy=y-m.y; if (dx*dx+dy*dy<196&&(x-n.x)*dx+(y-n.y)*dy<0) return true; } return false; };
const onRoad=(x,y)=>roads.some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h);
const noWalk=(x,y)=>x>AX&&y<1180;   // Flugfeld: keine Passanten (Terminal-Vorplatz erlaubt)
const npcLineFree=(x0,y0,x1,y1)=>{ const L=Math.hypot(x1-x0,y1-y0), n=Math.max(1,Math.ceil(L/18)); for (let k=1;k<=n;k++){ const x=x0+(x1-x0)*k/n, y=y0+(y1-y0)*k/n; if (!npcFree(x,y)) return false; } return true; };
// ---------- Passanten laufen auf den Gehwegen, folgen der Straße und überqueren sie ----------
const SWL=STRIPS.map((s,i)=>({h:s.h,c:s.h?(s.y0+s.y1)/2:(s.x0+s.x1)/2,a:s.h?s.x0:s.y0,b:s.h?s.x1:s.y1,pair:i<roads.length*2?(i^1):-1}));
const swPt=(L,t)=>L.h?{x:t,y:L.c}:{x:L.c,y:t};
function nearestSW(x,y){ let best=-1,bd=1e9,bp=null; SWL.forEach((L,i)=>{ const t=Math.max(L.a,Math.min(L.b,L.h?x:y)), p=swPt(L,t), d=Math.hypot(p.x-x,p.y-y); if (d<bd){ bd=d; best=i; bp=p; } }); return {i:best,d:bd,p:bp}; }
function npcPickSW(n){ let L=SWL[n.sw]; if (!L) return false; if (n.next!=null){ n.sw=n.next; n.next=null; L=SWL[n.sw]; n.dir=rnd()<.5?1:-1; }
  if (n.dir==null) n.dir=rnd()<.5?1:-1; const cur=L.h?n.x:n.y, off=Math.abs((L.h?n.y:n.x)-L.c);
  if (off>26){ const t=Math.max(L.a,Math.min(L.b,cur)), p=swPt(L,t); n.tx=p.x; n.ty=p.y; n.tt=8; return true; }
  if (rnd()<.1&&L.pair>=0){ const P=SWL[L.pair], t=Math.max(P.a+10,Math.min(P.b-10,cur)), p=swPt(P,t); if (npcFree(p.x,p.y)){ n.sw=L.pair; n.tx=p.x; n.ty=p.y; n.tt=10; n.crossing=true; return true; } }
  n.crossing=false; let nt=cur+n.dir*(90+rnd()*220);
  // Querstraße auf dem Weg? manchmal abbiegen
  let hit=null; SWL.forEach((M,i)=>{ if (M.h===L.h) return; const along=M.c; if ((along-cur)*n.dir>8&&(along-nt)*n.dir<0&&L.c>M.a-30&&L.c<M.b+30){ if (!hit||Math.abs(along-cur)<Math.abs(hit.along-cur)) hit={i,along}; } });
  if (hit&&rnd()<.4){ const p=swPt(L,hit.along); n.tx=p.x; n.ty=p.y; n.tt=10; n.next=hit.i; return true; }
  if (nt<=L.a+4||nt>=L.b-4){ nt=Math.max(L.a+4,Math.min(L.b-4,nt)); if (Math.abs(cur-nt)<12){ const end=swPt(L,cur); const cs=[]; SWL.forEach((M,i)=>{ if (M.h!==L.h&&Math.abs((M.h?end.y:end.x)-M.c)<50){ const tt=M.h?end.x:end.y; if (tt>M.a-30&&tt<M.b+30) cs.push(i); } });
      if (cs.length&&rnd()<.75){ const i=cs[Math.floor(rnd()*cs.length)], M=SWL[i], t=Math.max(M.a,Math.min(M.b,M.h?end.x:end.y)), p=swPt(M,t); n.sw=i; n.dir=(t-M.a)<(M.b-t)?1:-1; n.tx=p.x; n.ty=p.y; n.tt=8; return true; }
      n.dir*=-1; nt=cur+n.dir*120; } }
  const p=swPt(L,Math.max(L.a,Math.min(L.b,nt))); n.tx=p.x; n.ty=p.y; n.tt=12; return true; }
function npcPick(n){ if (n.sw!=null) return npcPickSW(n); for (let t=0;t<14;t++){ const a=rnd()*6.283, d=70+rnd()*260, x=n.x+Math.cos(a)*d, y=n.y+Math.sin(a)*d; if ((onRoad(x,y)&&rnd()<.85)||noWalk(x,y)) continue; if (npcFree(x,y)&&npcLineFree(n.x,n.y,x,y)){ n.tx=x; n.ty=y; n.tt=7+rnd()*6; return true; } } n.tx=null; n.pause=.5+rnd(); return false; }
function spawnNpc(cx,cy,near){ for (let tries=0;tries<24;tries++){ const a=rnd()*6.283, d=(near?120:430)+rnd()*(near?650:520), x=cx+Math.cos(a)*d, y=cy+Math.sin(a)*d;
    const sn=nearestSW(x,y); if (sn.i<0||sn.d>260) continue; const px=sn.p.x, py=sn.p.y; if (npcKeepOut(px,py,300)) continue; if (px<20||py<20||px>WW-20||py>WH-20||noWalk(px,py)||!npcFree(px,py)||(started&&!offView(px,py,30))) continue; if (npcs.some(o=>!o.dead&&Math.hypot(o.x-px,o.y-py)<110)) continue;
    const n={x:px,y:py,sw:sn.i,dir:rnd()<.5?1:-1,tx:null,ang:rnd()*6.28,step:rnd()*6,moving:true,run:false,look:NPC_LOOKS[Math.floor(rnd()*NPC_LOOKS.length)],sp:36+rnd()*24,panic:0,dead:false,deadT:0,wob:rnd()*6,pause:rnd()*2}; npcs.push(n); return; } }
function killNpc(n,vx,vy){ if (n.dead) return; wantOnKill(n); n.dead=true; n.deadT=0; n.ang=Math.atan2(vy,vx)+(rnd()-.5); n.x+=vx*.04; n.y+=vy*.04; sfx("hit");
  const sp=Math.hypot(vx,vy); decals.push({x:n.x,y:n.y,r:14+Math.min(16,sp*.03),a:rnd()*6.28,seed:Math.floor(rnd()*1e6),t:0});
  for (let i=0;i<16;i++){ const a=Math.atan2(vy,vx)+(rnd()-.5)*2.2, s=60+rnd()*sp*.6; emit("debris",n.x,n.y,{vx:Math.cos(a)*s,vy:Math.sin(a)*s,size:2+rnd()*3,life:.6,max:.6,col:rnd()<.5?"#c41f2a":"#8e0f18"}); }
  if (jj.veh) jj.veh.redTrack=1.6;
  if (n.dropCash) pickups.push({x:n.x+(rnd()-.5)*20,y:n.y+(rnd()-.5)*20,v:n.dropCash,t:0});
  for (const o of npcs) if (!o.dead&&!o.hostile&&!o.cop&&Math.hypot(o.x-n.x,o.y-n.y)<260){ o.panic=6; o.from={x:n.x,y:n.y}; } }
function scareNpcs(x,y,r){ for (const o of npcs) if (!o.dead&&!o.hostile&&!o.cop&&Math.hypot(o.x-x,o.y-y)<r){ o.panic=6; o.from={x,y}; } }
function npcKeepOut(x,y,r){ if (!(MI&&MI.def.id==="m1"&&MI.step===0)) return null; const c=MI.d.car; if (c&&!c.gone&&Math.hypot(x-c.x,y-c.y)<r) return c; if (ARRIVAL&&Math.hypot(x-ARRIVAL.x,y-ARRIVAL.y)<r) return ARRIVAL; return null; }
function updateNpcs(dt,cx,cy){
  let alive=0; for (const n of npcs) if (!n.dead&&!n.hostile) alive++;
  if (started&&alive<10&&!INROOM) spawnNpc(cx,cy,npcBoot>0); if (npcBoot>0) npcBoot--;
  for (let i=npcs.length-1;i>=0;i--){ const n=npcs[i];
    if (n.sayT>0&&!n.bouncer) n.sayT-=dt;
    if (!n.hostile&&!n.cop&&!n.dead){ const k=npcKeepOut(n.x,n.y,260); if (k){ const a=Math.atan2(n.y-k.y,n.x-k.x), nx=n.x+Math.cos(a)*55*dt, ny=n.y+Math.sin(a)*55*dt; if (npcFree(nx,ny)){ n.x=nx; n.y=ny; n.ang=Math.atan2(-Math.cos(a),Math.sin(a)); n.moving=true; n.step+=dt*9; } else if (offView(n.x,n.y,40)) n.dead=true, n.deadT=99; continue; } }
    if (n.dead){ n.deadT+=dt; if (n.deadT>25||Math.hypot(n.x-cx,n.y-cy)>2200) npcs.splice(i,1); continue; }
    if (!n.hostile&&Math.hypot(n.x-cx,n.y-cy)>1700){ npcs.splice(i,1); continue; }
    // vehicles hitting pedestrians
    for (const v of vehicles){ if (v.gone||v.z>.15||v.sinking) continue; const spd=Math.abs(v.v)+Math.hypot(v.sx,v.sy); if (!inVeh(v,n.x,n.y,7)) continue;
      if (spd>30&&!v.chauffeur){ killBy=v; killNpc(n,Math.cos(v.a)*v.v+v.sx,Math.sin(v.a)*v.v+v.sy); killBy=null; break; } else { const [lx,ly]=local(v,n.x,n.y), s=ly>=0?1:-1; n.x+=-Math.sin(v.a)*s*60*dt; n.y+=Math.cos(v.a)*s*60*dt; if (!n.hostile&&!(n.panic>0)&&!n.bouncer){ const ex=n.x-Math.sin(v.a)*s*90, ey=n.y+Math.cos(v.a)*s*90; if (npcFree(ex,ey)){ n.tx=ex; n.ty=ey; n.tt=2.5; n.off=0; } } } }
    if (n.dead) continue;
    for (const m of npcs){ if (m===n||m.dead) continue; const dx=n.x-m.x, dy=n.y-m.y, d2=dx*dx+dy*dy; if (d2<324&&d2>0.01){ const d=Math.sqrt(d2), k=(18-d)*Math.min(1,dt*6), nx2=n.x+dx/d*k, ny2=n.y+dy/d*k; if (npcFree(nx2,ny2)){ n.x=nx2; n.y=ny2; } } else if (d2<=0.01){ n.x+=(rnd()-.5)*4; } }
    if (n.bouncer&&bouncerAI(n,dt)) continue;
    if (n.hostile){ if (!paused) hostileAI(n,dt); continue; }
    let mx,my;
    if (n.panic>0){ n.panic-=dt; if (n.panic<=0) n.panicSp=0; const a=Math.atan2(n.y-n.from.y,n.x-n.from.x)+Math.sin(n.wob+n.panic*3)*.4; mx=Math.cos(a); my=Math.sin(a); n.run=(n.panicSp||150)>100; }
    else { n.run=false; if (n.pause>0){ n.pause-=dt; n.moving=false; continue; }
      if (n.tx==null||Math.hypot(n.tx-n.x,n.ty-n.y)<14||(n.tt-=dt)<0){ if (!npcPick(n)) { n.moving=false; continue; } if (rnd()<.35){ n.pause=.8+rnd()*2.5; n.moving=false; continue; } }
      mx=n.tx-n.x; my=n.ty-n.y; }
    n.chkT=(n.chkT||0)+dt; if (n.chkT>.9){ const st=n.cx0!=null&&Math.hypot(n.x-n.cx0,n.y-n.cy0)<12; n.cx0=n.x; n.cy0=n.y; n.chkT=0; if (!st) n.stuckN=0; if (st&&!(n.panic>0)){ n.stuckN=(n.stuckN||0)+1; if (n.dir) n.dir*=-1; if (n.stuckN>=2) n.sw=null; n.tx=null; n.off=0; n.pause=.5+rnd()*.8; n.moving=false; continue; } }
    const sp=(n.panic>0?(n.panicSp||150):n.sp)*dt, base=Math.atan2(my,mx); let moved=false, ua=base;
    if (!npcFree(n.x,n.y)){ for (let r=4;r<=40&&!moved;r+=6) for (let k=0;k<8;k++){ const b=k/8*6.283, x=n.x+Math.cos(b)*r, y=n.y+Math.sin(b)*r; if (npcFree(x,y)){ n.x=x; n.y=y; moved=true; break; } } }
    else { if ((n.offT-=dt)<0) n.off=0; for (const off of (n.off?[n.off,0,.5,-.5,1,-1,1.5,-1.5]:[0,.5,-.5,1,-1,1.5,-1.5])){ const b=base+off, x=n.x+Math.cos(b)*sp, y=n.y+Math.sin(b)*sp; if (npcFree(x,y)&&!npcCrowd(n,x,y)){ n.x=x; n.y=y; moved=true; ua=b; if (off&&off!==n.off){ n.off=off; n.offT=.7; } break; } } }
    if (!moved&&!n.run){ n.tx=null; n.pause=.3+rnd()*.6; n.moving=false; continue; }
    mx=Math.cos(ua); my=Math.sin(ua);
    n.moving=true; let d=Math.atan2(-mx,my)-n.ang; d=Math.atan2(Math.sin(d),Math.cos(d)); n.ang+=d*Math.min(1,dt*(n.run?10:5)); n.step+=dt*(n.run?16:9); }
  for (let i=decals.length-1;i>=0;i--){ decals[i].t+=dt; if (decals[i].t>45) decals.splice(i,1); }
  const v=jj.veh; if (v&&v.redTrack>0&&v.t.kind!=="boat"&&v.t.kind!=="heli"){ v.redTrack-=dt; if (Math.abs(v.v)>20) for (const s of [-1,1]){ const x=v.x-Math.cos(v.a)*v.t.l*.3-Math.sin(v.a)*v.t.w*.36*s, y=v.y-Math.sin(v.a)*v.t.l*.3+Math.cos(v.a)*v.t.w*.36*s; decals.push({x,y,r:2.6,track:true,t:0,al:Math.min(1,v.redTrack)}); } } }
function drawDecals(q){ for (const d of decals){ const f=d.t<40?1:1-(d.t-40)/5;
    if (d.track){ q.fillStyle=`rgba(150,14,22,${.55*d.al*f})`; q.beginPath(); q.arc(d.x,d.y,d.r,0,7); q.fill(); continue; }
    let sd=d.seed; const r2=()=>(sd=(sd*16807)%2147483647)/2147483647; q.save(); q.translate(d.x,d.y); q.rotate(d.a); q.globalAlpha=.9*f;
    q.fillStyle="#7d0d16"; q.beginPath(); q.ellipse(0,0,d.r*1.15,d.r*.8,0,0,7); q.fill(); q.fillStyle="#b3141f";
    for (let i=0;i<9;i++){ const a=r2()*6.28, rr2=d.r*(.3+r2()*.9), s=d.r*(.15+r2()*.3); q.beginPath(); q.arc(Math.cos(a)*rr2,Math.sin(a)*rr2*.8,s,0,7); q.fill(); }
    q.fillStyle="#d01e2b"; q.beginPath(); q.ellipse(-d.r*.1,-d.r*.1,d.r*.6,d.r*.4,0,0,7); q.fill(); q.restore(); } q.globalAlpha=1; }
function drawNpcs(q,vis){ for (const n of npcs){ if (!vis(n.x,n.y,40)) continue;
    if (n.dead){ q.save(); q.translate(n.x,n.y); q.rotate(1.4); q.scale(1,.75); q.translate(-n.x,-n.y); q.globalAlpha=n.deadT>22?1-(n.deadT-22)/3:1; drawPerson(q,{x:n.x,y:n.y,ang:n.ang,moving:false},n.look); q.restore(); q.globalAlpha=1; }
    else { if (n.bouncer){ q.save(); q.translate(n.x,n.y); q.scale(1.22,1.22); q.translate(-n.x,-n.y); } drawPerson(q,n,n.look,n.weapon?{weapon:n.weapon}:n.hostile&&!n.idle?{punch:n.punchT>0?1-n.punchT/.28:0,side:n.side||1}:undefined); if (n.bouncer) q.restore(); if (n.say&&n.sayT>0) drawSay(q,n.x,n.y-38,n.say); } } }

// ================= OCEAN LIFE =================
const SHARKS=[...Array(4)].map((_,i)=>({x:600+i*1000,y:3560,a:0,tx:0,ty:0,bite:0,t:rnd()*10}));
const nearBridge=(x,y)=>y>2950&&y<4150&&BRIDGES.some(r=>x>r.x-160&&x<r.x+r.w+160);
const seaZone=x=>BRIDGES.filter(r=>x>r.x+r.w/2).length;   // Wasserbecken zwischen den Brücken – Haie bleiben in ihrem
function deepPoint(z){ for (let k=0;k<40;k++){ const x=150+rnd()*(WW-300), y=waterY(x)+SHALLOW+60+rnd()*(WH0-waterY(x)-SHALLOW-100); if (!inWSolid(x,y)&&!onIsland(x,y)&&!nearBridge(x,y)&&(z==null||seaZone(x)===z)) return {x,y}; } return z==null?{x:2000,y:3600}:{x:[1500,4900,8200][z]||2000,y:3600}; }
for (const S of SHARKS){ const p=deepPoint(); S.x=p.x; S.y=p.y; S.z=seaZone(p.x); const q=deepPoint(S.z); S.tx=q.x; S.ty=q.y; }
function updateSharks(dt){ for (const S of SHARKS){ S.t+=dt; S.bite=Math.max(0,S.bite-dt); const prey=jj.swim&&!jj.dead&&Math.hypot(jj.x-S.x,jj.y-S.y)<320&&jj.y>waterY(jj.x)+30;
    let tx=S.tx, ty=S.ty, sp=70; if (prey){ tx=jj.x; ty=jj.y; sp=150; } else if (Math.hypot(tx-S.x,ty-S.y)<40){ const q=deepPoint(S.z); S.tx=q.x; S.ty=q.y; } if (prey&&seaZone(jj.x)!==S.z) { tx=S.tx; ty=S.ty; sp=70; }
    const a=Math.atan2(ty-S.y,tx-S.x)+Math.sin(S.t*1.3)*.25; let d=a-S.a; d=Math.atan2(Math.sin(d),Math.cos(d)); S.a+=d*Math.min(1,dt*2.2);
    const nx=S.x+Math.cos(S.a)*sp*dt, ny=S.y+Math.sin(S.a)*sp*dt; if (ny>waterY(nx)+50&&ny<WH0-20&&nx>20&&nx<WW-20&&!inWSolid(nx,ny)&&!onIsland(nx,ny)&&!nearBridge(nx,ny)&&seaZone(nx)===S.z){ S.x=nx; S.y=ny; } else { S.a+=Math.PI*.6; }
    if (prey&&S.bite<=0&&Math.hypot(jj.x-S.x,jj.y-S.y)<26){ S.bite=1.3; hurt(22); shake=Math.max(shake,6); sfx("hit"); for (let k=0;k<16;k++){ const a2=rnd()*6.28, s2=40+rnd()*120; emit("debris",jj.x,jj.y,{vx:Math.cos(a2)*s2,vy:Math.sin(a2)*s2,size:2+rnd()*3,life:.6,max:.6,col:rnd()<.5?"#c41f2a":"#8e0f18"}); } toast("Hai!"); } } }
function drawSea(q,vis,t){
  for (const S of SHARKS){ if (!vis(S.x,S.y,70)) continue; const sw=Math.sin(S.t*5)*(S.bite>0?.5:.25); q.save(); q.translate(S.x,S.y); q.rotate(S.a);
    // wake
    q.strokeStyle="rgba(255,255,255,.45)"; q.lineWidth=1.3; q.beginPath(); q.moveTo(30,-3); q.quadraticCurveTo(10,-12,-14,-17); q.moveTo(30,3); q.quadraticCurveTo(10,12,-14,17); q.stroke();
    q.globalAlpha=.78;
    const body=(c)=>{ q.fillStyle=c; q.beginPath(); q.moveTo(36,0); q.bezierCurveTo(30,-7,14,-10,0,-9.5); q.bezierCurveTo(-14,-8,-24,-4,-30,-1.6); q.lineTo(-30,1.6); q.bezierCurveTo(-24,4,-14,8,0,9.5); q.bezierCurveTo(14,10,30,7,36,0); q.closePath(); q.fill(); };
    // pectoral fins
    q.fillStyle="#3c4a58"; for (const sd of [-1,1]){ q.beginPath(); q.moveTo(10,sd*7); q.quadraticCurveTo(0,sd*20,-8,sd*24); q.quadraticCurveTo(-2,sd*13,-2,sd*7); q.closePath(); q.fill(); }
    // tail (sways)
    q.save(); q.translate(-29,0); q.rotate(sw); q.fillStyle="#3c4a58"; q.beginPath(); q.moveTo(2,-1.6); q.lineTo(-6,-2.5); q.quadraticCurveTo(-12,-8,-17,-15); q.quadraticCurveTo(-13,-4,-14,0); q.quadraticCurveTo(-13,5,-15,11); q.quadraticCurveTo(-10,5,-6,2.5); q.lineTo(2,1.6); q.closePath(); q.fill(); q.restore();
    const g=q.createLinearGradient(0,-10,0,10); g.addColorStop(0,"#56687a"); g.addColorStop(.5,"#6f8396"); g.addColorStop(1,"#4a5a6b"); body(g);
    q.fillStyle="rgba(230,238,244,.35)"; q.beginPath(); q.ellipse(14,0,14,3.2,0,0,7); q.fill();
    q.fillStyle="#1c242c"; q.beginPath(); q.arc(26,-4.6,1.3,0,7); q.arc(26,4.6,1.3,0,7); q.fill();
    q.strokeStyle="rgba(20,28,36,.6)"; q.lineWidth=.7; for (const k of [0,2.6,5.2]){ q.beginPath(); q.moveTo(19-k,-7.6); q.lineTo(17.5-k,-5.2); q.moveTo(19-k,7.6); q.lineTo(17.5-k,5.2); q.stroke(); }
    if (S.bite>0){ q.fillStyle="#7a1d22"; q.beginPath(); q.ellipse(33,0,3.4,4.4,0,0,7); q.fill(); q.fillStyle="#fff"; for (let k=-3;k<=3;k+=1.5){ q.fillRect(31.5,k-.3,1.4,.6); } }
    q.globalAlpha=1;
    // dorsal fin above water
    q.fillStyle="rgba(10,25,40,.35)"; q.beginPath(); q.moveTo(7,3); q.lineTo(-6,3); q.lineTo(-11,9); q.closePath(); q.fill();
    q.fillStyle="#2c3640"; q.beginPath(); q.moveTo(8,0); q.quadraticCurveTo(-2,-2.6,-12,-1.2); q.lineTo(-7,0); q.lineTo(-12,1.2); q.quadraticCurveTo(-2,2.6,8,0); q.closePath(); q.fill();
    q.strokeStyle="rgba(255,255,255,.7)"; q.lineWidth=1; q.beginPath(); q.arc(4,0,5.5,-1.2,1.2); q.stroke();
    q.restore(); }
  const bob=(x)=>Math.sin(t*1.6+x*.01)*1.5;
  if (vis(YACHT.x,YACHT.y,260)){ const Y=YACHT, L=Y.l, H=Y.w, b2=bob(Y.x)*.6; q.save(); q.translate(Y.x,Y.y+b2);
    // Schatten + leichtes Kielwasser am Heck
    q.fillStyle="rgba(8,28,48,.32)"; q.beginPath(); q.ellipse(12,10,L*.56,H*.62,0,0,7); q.fill();
    q.strokeStyle="rgba(255,255,255,.35)"; q.lineWidth=2; for (let i=0;i<3;i++){ const o=(t*20+i*14)%42; q.globalAlpha=1-o/42; q.beginPath(); q.ellipse(-L/2-6-o,0,4+o*.3,H*.42+o*.25,0,-1.2,1.2,true); q.stroke(); } q.globalAlpha=1;
    // Rumpf: schlanker Bug, dunkler Streifen
    const hull=(e)=>{ q.beginPath(); q.moveTo(-L/2+e,-H/2+e); q.lineTo(L*.18,-H/2+e); q.bezierCurveTo(L*.4,-H/2+e,L*.5-e,-H*.16,L/2+8-e*1.6,0); q.bezierCurveTo(L*.5-e,H*.16,L*.4,H/2-e,L*.18,H/2-e); q.lineTo(-L/2+e,H/2-e); q.quadraticCurveTo(-L/2-4+e,0,-L/2+e,-H/2+e); q.closePath(); };
    hull(0); q.fillStyle="#1e2b3a"; q.fill();
    hull(2.5); const hg=q.createLinearGradient(0,-H/2,0,H/2); hg.addColorStop(0,"#ffffff"); hg.addColorStop(.6,"#eef1f4"); hg.addColorStop(1,"#c9d1d8"); q.fillStyle=hg; q.fill();
    // Teakdeck
    hull(7); q.fillStyle="#c49a6c"; q.fill(); q.save(); hull(7); q.clip(); q.strokeStyle="rgba(90,60,30,.35)"; q.lineWidth=.8; for (let y=-H/2;y<H/2;y+=4){ q.beginPath(); q.moveTo(-L/2,y); q.lineTo(L/2,y); q.stroke(); } q.restore();
    hull(6.5); q.strokeStyle="rgba(230,236,242,.9)"; q.lineWidth=1; q.stroke();   // Reling
    // Badeplattform + Pool + Liegen am Heck
    q.fillStyle="#a8825a"; rr(q,-L/2-7,-H/2+9,9,H-18,2); q.fill();
    q.fillStyle="#3fc4e0"; rr(q,-L/2+12,-11,26,22,5); q.fill(); q.strokeStyle="#e9eef2"; q.lineWidth=2; q.stroke(); q.fillStyle="rgba(255,255,255,.35)"; q.fillRect(-L/2+15,-8,10,3);
    for (const yy of [-H/2+9,H/2-15]) for (const xx of [-L/2+44,-L/2+58]){ q.fillStyle="#f6f3ea"; rr(q,xx,yy,11,6,2); q.fill(); }
    // Aufbau: untere Ebene mit getönten Fenstern, obere Ebene (Flybridge)
    q.fillStyle="#f7f8fa"; rr(q,-L*.2,-H/2+8,L*.48,H-16,10); q.fill(); q.strokeStyle="#c3ccd4"; q.lineWidth=1; q.stroke();
    q.fillStyle="#18222d"; rr(q,-L*.17,-H/2+11,L*.43,H-22,8); q.fill();
    q.fillStyle="#fbfcfd"; rr(q,-L*.15,-H/2+14,L*.38,H-28,7); q.fill();
    q.fillStyle="#18222d"; rr(q,L*.12,-H/2+15,L*.08,H-30,4); q.fill(); q.fillStyle="rgba(150,200,240,.45)"; q.fillRect(L*.13,-H/2+16,L*.02,H-32);
    q.strokeStyle="#9aa6b2"; q.lineWidth=3; q.beginPath(); q.moveTo(-L*.06,-H/2+15); q.lineTo(-L*.06,H/2-15); q.stroke();   // Radarbogen
    q.fillStyle="#e6ebef"; q.beginPath(); q.arc(-L*.06,0,5,0,7); q.fill(); q.strokeStyle="#9aa6b2"; q.lineWidth=1; q.stroke();
    // Sonnenliege vorne
    q.fillStyle="#efe6d2"; rr(q,L*.27,-H*.22,L*.1,H*.44,6); q.fill(); q.strokeStyle="rgba(120,100,70,.4)"; q.lineWidth=1; q.beginPath(); q.moveTo(L*.32,-H*.22); q.lineTo(L*.32,H*.22); q.stroke();
    q.fillStyle="#7d8791"; q.beginPath(); q.arc(L*.43,-4,2,0,7); q.arc(L*.43,4,2,0,7); q.fill();
    q.restore(); }
  if (vis(SHIP.x,SHIP.y,420)){ const S=SHIP, L=S.l, H=S.w; q.save(); q.translate(S.x,S.y+bob(S.x)*.3);   // Frachter am Kai
    q.fillStyle="rgba(8,28,48,.35)"; q.beginPath(); q.ellipse(14,10,L*.53,H*.6,0,0,7); q.fill();
    const hull=(e)=>{ q.beginPath(); q.moveTo(-L/2+e,-H/2+e); q.lineTo(L*.36,-H/2+e); q.quadraticCurveTo(L/2-e,-H*.3,L/2+10-e*2,0); q.quadraticCurveTo(L/2-e,H*.3,L*.36,H/2-e); q.lineTo(-L/2+e,H/2-e); q.closePath(); };
    hull(0); q.fillStyle="#8f2a22"; q.fill(); hull(4); q.fillStyle="#1f2d3d"; q.fill(); hull(8); q.fillStyle="#5a6168"; q.fill();
    const cc=["#b8392d","#2e6da4","#e07a22","#2f9a58","#c9a21a","#7d868c","#1f7f8c"]; let n=0;
    for (let x=-L/2+110;x<L*.34;x+=46) for (let y=-H/2+12;y<H/2-12;y+=17){ n++; const col=cc[(n*5+Math.floor(x))%cc.length]; q.fillStyle=col; q.fillRect(x,y,42,14); q.fillStyle="rgba(0,0,0,.18)"; for (let xx=x+3;xx<x+40;xx+=5) q.fillRect(xx,y+2,1.4,10); q.fillStyle="rgba(255,255,255,.15)"; q.fillRect(x,y,42,2); }
    q.fillStyle="#f2f2ef"; rr(q,-L/2+18,-H/2+10,74,H-20,6); q.fill(); q.fillStyle="#1d2733"; q.fillRect(-L/2+80,-H/2+14,8,H-28); q.fillStyle="#e2e2de"; rr(q,-L/2+30,-H/2+20,40,H-40,5); q.fill();
    q.fillStyle="#2b2f36"; rr(q,-L/2+36,-8,16,16,3); q.fill(); q.fillStyle="#c23b2f"; q.fillRect(-L/2+36,-8,16,4);
    q.fillStyle="#f2f2ef"; q.font='400 18px "Bebas Neue",Impact,sans-serif'; q.textAlign="center"; q.textBaseline="middle"; q.save(); q.translate(L*.4,0); q.rotate(Math.PI/2); q.fillText("PACIFIC STAR",0,0); q.restore();
    q.restore(); }
  for (const B of SAILS){ if (!vis(B.x,B.y,120)) continue; q.save(); q.translate(B.x,B.y+bob(B.x)); q.rotate(B.a+Math.sin(t*.7+B.x)*.04); q.fillStyle="rgba(10,30,50,.3)"; q.beginPath(); q.ellipse(6,6,40,13,0,0,7); q.fill();
    q.fillStyle="#f8f8f4"; q.beginPath(); q.moveTo(-36,-11); q.lineTo(18,-11); q.quadraticCurveTo(40,0,18,11); q.lineTo(-36,11); q.closePath(); q.fill(); q.strokeStyle="#5a6470"; q.lineWidth=1.2; q.stroke(); q.fillStyle="#b78a5a"; rr(q,-30,-6,24,12,3); q.fill();
    q.fillStyle="#3a3f46"; q.beginPath(); q.arc(4,0,2.4,0,7); q.fill(); q.fillStyle=B.c; q.globalAlpha=.9; q.beginPath(); q.moveTo(4,0); q.lineTo(-30,-4); q.quadraticCurveTo(-10,22,4,0); q.fill(); q.globalAlpha=1; q.strokeStyle="#3a3f46"; q.lineWidth=1.6; q.beginPath(); q.moveTo(4,0); q.lineTo(-30,-4); q.stroke(); q.restore(); }
  if (vis(RAFT.x,RAFT.y,120)){ const r=RAFT, b2=bob(r.x); q.save(); q.translate(r.x,r.y+b2); q.fillStyle="rgba(10,30,50,.3)"; q.fillRect(-r.w/2+5,-r.h/2+6,r.w,r.h); q.fillStyle="#a47b52"; q.fillRect(-r.w/2,-r.h/2,r.w,r.h); q.fillStyle="rgba(60,35,15,.3)"; for (let y=-r.h/2;y<r.h/2;y+=7) q.fillRect(-r.w/2,y+6,r.w,1);
    q.fillStyle="#ff7aa8"; q.beginPath(); q.arc(14,4,11,0,7); q.fill(); q.fillStyle="#a47b52"; q.beginPath(); q.arc(14,4,5,0,7); q.fill(); q.fillStyle="#ff7aa8"; q.beginPath(); q.ellipse(22,-6,3,7,.5,0,7); q.fill(); q.fillStyle="#ffcf3f"; q.beginPath(); q.arc(24,-12,2,0,7); q.fill();
    q.fillStyle="#f6c344"; rr(q,-28,-14,22,9,3); q.fill(); q.fillStyle="#2a9df4"; rr(q,-28,-2,22,9,3); q.fill(); q.restore(); } }
