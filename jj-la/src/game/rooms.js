// ================= AKT 2: Infrastruktur (Räume, Schleichen, Verfolgung) =================
Object.assign(SPK,{Rico:"#ffb347",Enzo:"#c9a27c",Dario:"#9ca3af",Wachmann:"#93c5fd",Funk:"#7ee36a",Whitmore:"#e5e7eb"});
Object.assign(CREWLOOK,{Rico:Object.assign({},LOOKS[0],{rig:17}),Enzo:Object.assign({},LOOKS[0],{rig:12}),Dario:Object.assign({},LOOKS[0],{rig:15}),Brooks:Object.assign({},GUARD_LOOK,{rig:8})});
// ---------- Innenräume: jeder Raum ist eine eigene kleine Welt (liegt im Meer außerhalb der Insel, außen schwarz) ----------
let CURROOM=null, CURSOL=[];
const ROOMS={};
function defRoom(o){ ROOMS[o.id]=o; o.sol=(o.sol||[]).map(s=>R(o.r.x+s[0],o.r.y+s[1],s[2],s[3])); o.gates=o.gates||{}; for (const k in o.gates){ const g=o.gates[k]; g.r=R(o.r.x+g.l[0],o.r.y+g.l[1],g.l[2],g.l[3]); g.open=!!g.open; } o.actors=[]; return o; }
const RW=(o,x,y)=>({x:o.r.x+x,y:o.r.y+y});
function setGate(o,k,open){ const g=o.gates[k]; if (!g||g.open===open) return; g.open=open; if (CURROOM===o){ if (open){ const i=solids.indexOf(g.r); if (i>=0) solids.splice(i,1); const j=CURSOL.indexOf(g.r); if (j>=0) CURSOL.splice(j,1); } else { solids.push(g.r); CURSOL.push(g.r); } } }
function roomArt(o){ if (o.img) return o.img; const S=1.5; o.img=mk(o.r.w*S,o.r.h*S,q=>{ q.scale(S,S); o.paint(q,o.r.w,o.r.h); }); return o.img; }
function roomTeleportAllies(m,x,y){ allyList(m).forEach((a,i)=>{ if (a.inCar) exitRider(a); a.x=x-36+i*36; a.y=y+(i%2?16:-10); a.vx=a.vy=0; a._nav=null; a._slot=null; a.board=null; a.hold=false; }); }
function enterRoom(id,sp){ const o=ROOMS[id]; if (!o) return; if (CURROOM) leaveRoomRaw(); if (jj.veh) exitVeh(true); roomArt(o);
  CURROOM=o; INROOM=true; Object.assign(VR,o.r); CURSOL=o.sol.slice(); for (const k in o.gates) if (!o.gates[k].open) CURSOL.push(o.gates[k].r); for (const s of CURSOL) solids.push(s);
  { const f=freeNear(o.r.x+sp.x,o.r.y+sp.y); jj.x=f.x; jj.y=f.y; } jj.ang=sp.a||0; jj.lock=0; jj.h=0; jj.roof=null; jj.glide=null; jj.swim=false; cam.x=jj.x; cam.y=jj.y; sfx("door"); o.armT=.8;
  if (MI) roomTeleportAllies(MI,jj.x,jj.y-(sp.a===Math.PI?-30:30)); if (o.onEnter) o.onEnter(); hudDirty=true; }
function leaveRoomRaw(){ for (const s of CURSOL){ const i=solids.indexOf(s); if (i>=0) solids.splice(i,1); } CURSOL=[]; const o=CURROOM; CURROOM=null; INROOM=false; if (o&&o.onLeave) o.onLeave(); }
function freeNear(x,y){ if (!blockedAt(x,y,10)) return {x,y}; for (let r=8;r<=140;r+=6) for (let k=0;k<16;k++){ const a=k/16*6.283, px=x+Math.cos(a)*r, py=y+Math.sin(a)*r; if (!blockedAt(px,py,10)) return {x:px,y:py}; } return {x,y}; }
function exitRoom(to,ang){ leaveRoomRaw(); const f=freeNear(to.x,to.y); jj.x=f.x; jj.y=f.y; jj.ang=ang||0; cam.x=jj.x; cam.y=jj.y; jj.lock=0; sfx("door"); if (MI) roomTeleportAllies(MI,to.x,to.y+28); hudDirty=true; }
function inZone(o,z){ return jj.x>o.r.x+z[0]&&jj.x<o.r.x+z[0]+z[2]&&jj.y>o.r.y+z[1]&&jj.y<o.r.y+z[1]+z[3]; }
function updateRoom(dt){ const o=CURROOM; if (!o||paused) return; o.armT=Math.max(0,(o.armT||0)-dt); updateRoomActors(o,dt); if (o.tick) o.tick(dt);
  if (o.armT<=0&&!jj.dead) for (const e of o.exits||[]){ if (inZone(o,e.z)&&(!e.ok||e.ok())){ e.go(); break; } } }
function drawRoom(q,t){ const o=CURROOM; if (!o) return; q.drawImage(roomArt(o),o.r.x,o.r.y,o.r.w,o.r.h);
  for (const k in o.gates){ const g=o.gates[k]; if (g.draw) g.draw(q,g,t); else if (!g.open){ q.fillStyle="#2b2f36"; q.fillRect(g.r.x,g.r.y,g.r.w,g.r.h); q.fillStyle="#8a929c"; for (let x=g.r.x+4;x<g.r.x+g.r.w;x+=9) q.fillRect(x,g.r.y,3,g.r.h); } }
  if (o.draw) o.draw(q,t); drawRoomActors(q,o,t); }
// Raum-Statisten (Kunden, Kassierer, Besucher): laufen zwischen Punkten, gehen in Deckung bei Gefahr
function roomActor(o,n,look,x,y,pts,opt){ const a=Object.assign({n,look,x:o.r.x+x,y:o.r.y+y,ang:0,step:0,moving:false,pts:(pts||[]).map(p=>({x:o.r.x+p[0],y:o.r.y+p[1]})),pi:0,wait:rnd()*3,sp:42,down:false},opt||{}); o.actors.push(a); return a; }
function updateRoomActors(o,dt){ for (const a of o.actors){ if (a.gone||a.dead) continue; if (a.sayT>0) a.sayT-=dt; if (a.down){ a.moving=false; continue; }
    if (a.face&&!a.pts.length){ a.ang=Math.atan2(-(a.face.x-a.x),a.face.y-a.y); continue; }
    if (!a.pts.length) continue; if (a.wait>0){ a.wait-=dt; a.moving=false; continue; } const p=a.pts[a.pi], dx=p.x-a.x, dy=p.y-a.y, d=Math.hypot(dx,dy);
    if (d<5){ a.pi=(a.pi+1)%a.pts.length; a.wait=1+rnd()*3; continue; } const sp=Math.min(d,a.sp*dt), nx=a.x+dx/d*sp, ny=a.y+dy/d*sp; if (!npcSolid(nx,ny,9)){ a.x=nx; a.y=ny; } else { a.pi=(a.pi+1)%a.pts.length; } a.ang=Math.atan2(-dx/d,dy/d); a.moving=true; a.step+=dt*9; } }
function drawRoomActors(q,o,t){ for (const a of o.actors){ if (a.gone) continue; if (a.down){ q.save(); q.translate(a.x,a.y); q.scale(.92,.92); q.translate(-a.x,-a.y); drawPerson(q,Object.assign({},a,{moving:false}),a.look); q.restore(); q.fillStyle="rgba(255,255,255,.85)"; q.font="11px sans-serif"; q.textAlign="center"; q.fillText("🙇",a.x,a.y-18); }
    else drawPerson(q,a,a.look,a.w?{weapon:a.w}:{}); if (a.sayT>0) drawSay(q,a.x,a.y-30,a.say); } }
function roomPanic(o,from){ for (const a of o.actors) if (!a.staff&&!a.gone){ a.down=true; } }
// Raum-Grafik-Helfer
const RGX={
  marble(q,x,y,w,h,c1,c2,s){ s=s||60; for (let yy=y;yy<y+h;yy+=s) for (let xx=x;xx<x+w;xx+=s){ q.fillStyle=((xx-x)/s+(yy-y)/s)%2?c1:c2; q.fillRect(xx,yy,Math.min(s,x+w-xx),Math.min(s,y+h-yy)); }
    q.strokeStyle="rgba(120,110,100,.18)"; q.lineWidth=1; for (let i=0;i<w*h/9000;i++){ const px=x+rnd()*w, py=y+rnd()*h; q.beginPath(); q.moveTo(px,py); q.bezierCurveTo(px+20+rnd()*30,py+rnd()*20-10,px+40,py+rnd()*30-15,px+60+rnd()*40,py+rnd()*20-10); q.stroke(); }
    q.strokeStyle="rgba(0,0,0,.06)"; for (let xx=x;xx<=x+w;xx+=s){ q.beginPath(); q.moveTo(xx,y); q.lineTo(xx,y+h); q.stroke(); } for (let yy=y;yy<=y+h;yy+=s){ q.beginPath(); q.moveTo(x,yy); q.lineTo(x+w,yy); q.stroke(); } },
  wood(q,x,y,w,h,c){ q.fillStyle=c||"#8a5a34"; q.fillRect(x,y,w,h); for (let yy=y;yy<y+h;yy+=12){ q.fillStyle=`rgba(${rnd()<.5?"0,0,0":"255,230,200"},${.04+rnd()*.06})`; q.fillRect(x,yy,w,12); q.fillStyle="rgba(0,0,0,.12)"; q.fillRect(x,yy,w,1); for (let xx=x+((yy/12)%2)*40;xx<x+w;xx+=80) q.fillRect(xx,yy,1,12); } },
  tiles(q,x,y,w,h,c1,c2,s){ s=s||24; for (let yy=y;yy<y+h;yy+=s) for (let xx=x;xx<x+w;xx+=s){ q.fillStyle=((xx-x)/s+(yy-y)/s)%2?c1:c2; q.fillRect(xx,yy,s,s); } },
  carpet(q,x,y,w,h,c,b){ q.fillStyle=c; q.fillRect(x,y,w,h); q.strokeStyle=b||"#d8b35a"; q.lineWidth=3; q.strokeRect(x+6,y+6,w-12,h-12); q.lineWidth=1; q.strokeRect(x+12,y+12,w-24,h-24); },
  wall(q,r,c){ q.fillStyle="rgba(0,0,0,.25)"; q.fillRect(r[0]+4,r[1]+4,r[2],r[3]); q.fillStyle=c||"#3a3540"; q.fillRect(r[0],r[1],r[2],r[3]); q.fillStyle="rgba(255,255,255,.14)"; q.fillRect(r[0],r[1],r[2],Math.min(3,r[3])); },
  box(q,r,c,top){ q.fillStyle="rgba(0,0,0,.28)"; q.fillRect(r[0]+5,r[1]+5,r[2],r[3]); q.fillStyle=c; q.fillRect(r[0],r[1],r[2],r[3]); q.fillStyle=top||"rgba(255,255,255,.16)"; q.fillRect(r[0],r[1],r[2],3); q.fillStyle="rgba(0,0,0,.18)"; q.fillRect(r[0],r[1]+r[3]-3,r[2],3); },
  plant(q,x,y,s){ s=s||1; q.fillStyle="rgba(0,0,0,.25)"; q.beginPath(); q.ellipse(x+4,y+4,16*s,14*s,0,0,7); q.fill(); q.fillStyle="#6b4a2a"; q.beginPath(); q.arc(x,y,13*s,0,7); q.fill(); for (let i=0;i<9;i++){ const a=i/9*6.283; q.fillStyle=i%2?"#2f7d3a":"#3f9a49"; q.beginPath(); q.ellipse(x+Math.cos(a)*9*s,y+Math.sin(a)*9*s,9*s,4.5*s,a,0,7); q.fill(); } },
  label(q,x,y,txt,col,size){ q.font=`400 ${size||14}px "Bebas Neue",Impact,sans-serif`; q.textAlign="center"; q.textBaseline="middle"; q.fillStyle=col||"rgba(255,255,255,.75)"; q.fillText(txt,x,y); },
  painting(q,x,y,w,h,seed){ q.fillStyle="#c9a24a"; q.fillRect(x-4,y-4,w+8,h+8); q.fillStyle="#2a2228"; q.fillRect(x,y,w,h); const cols=["#e45b3c","#f2c14e","#3c8dbc","#5fb36b","#b05bd6","#f2f0ea"]; for (let i=0;i<7;i++){ q.fillStyle=cols[(seed*7+i*3)%cols.length]; q.globalAlpha=.85; q.beginPath(); q.arc(x+((seed*37+i*53)%100)/100*w,y+((seed*17+i*29)%100)/100*h,(w+h)*.09*(1+(i%3)*.4),0,7); q.fill(); } q.globalAlpha=1; } };
// Licht/Nacht über dem Raum (Taschenlampen der Wachen werden hell ausgespart)
function drawRoomNight(q,t){ const o=CURROOM; if (!o||!o.night) return; q.save(); q.fillStyle="rgba(6,10,26,.52)"; q.fillRect(o.r.x,o.r.y,o.r.w,o.r.h); q.globalCompositeOperation="lighter";
  for (const g of SG.guards){ if (g.down||g.gone) continue; const fa=g.ang+Math.PI/2, gr=q.createRadialGradient(g.x,g.y,10,g.x,g.y,g.range); gr.addColorStop(0,"rgba(255,240,190,.32)"); gr.addColorStop(1,"rgba(255,240,190,0)"); q.fillStyle=gr; q.beginPath(); q.moveTo(g.x,g.y); q.arc(g.x,g.y,g.range,fa-g.fov,fa+g.fov); q.closePath(); q.fill(); }
  const jg=q.createRadialGradient(jj.x,jj.y,4,jj.x,jj.y,90); jg.addColorStop(0,"rgba(120,140,200,.22)"); jg.addColorStop(1,"rgba(120,140,200,0)"); q.fillStyle=jg; q.fillRect(jj.x-90,jj.y-90,180,180); q.restore(); }
// ---------- Schleichen: Wachen mit Sichtkegel, Kameras, Laser ----------
const SG={on:false,guards:[],cams:[],lasers:[],alarm:false,onDetect:null,t:0};
function sgReset(){ SG.on=false; SG.guards=[]; SG.cams=[]; SG.lasers=[]; SG.alarm=false; SG.onDetect=null; }
function sgStart(onDetect){ sgReset(); SG.on=true; SG.onDetect=onDetect; }
function sgGuard(o,x,y,path,opt){ const g=Object.assign({x:o.r.x+x,y:o.r.y+y,ang:0,path:(path||[]).map(p=>({x:o.r.x+p[0],y:o.r.y+p[1],w:p[2]||1.5})),pi:0,wait:1,sp:52,range:210,fov:.55,alert:0,look:GUARD_LOOK,down:false,step:0,moving:false},opt||{}); SG.guards.push(g); return g; }
function sgCam(o,x,y,a0,amp,opt){ const c=Object.assign({x:o.r.x+x,y:o.r.y+y,a0,amp,spd:.6,range:230,fov:.38,off:false,alert:0,a:a0},opt||{}); SG.cams.push(c); return c; }
function sgLaser(o,x1,y1,x2,y2,opt){ const l=Object.assign({x1:o.r.x+x1,y1:o.r.y+y1,x2:o.r.x+x2,y2:o.r.y+y2,per:3,duty:.55,ph:rnd()*3,off:false,dx:0,dy:0,amp:0,spd:1,on:true},opt||{}); l.bx1=l.x1; l.by1=l.y1; l.bx2=l.x2; l.by2=l.y2; SG.lasers.push(l); return l; }
function losRoom(x1,y1,x2,y2){ const d=Math.hypot(x2-x1,y2-y1), n=Math.ceil(d/10); for (let i=1;i<n;i++){ const x=x1+(x2-x1)*i/n, y=y1+(y2-y1)*i/n; for (const s of CURSOL) if (s.h>2&&s.w>2&&x>s.x&&x<s.x+s.w&&y>s.y&&y<s.y+s.h&&!s.low) return false; } return true; }
function sees(ox,oy,dirA,range,fov){ const dx=jj.x-ox, dy=jj.y-oy, d=Math.hypot(dx,dy); if (d>range||jj.dead) return 0; let da=Math.atan2(dy,dx)-dirA; da=Math.atan2(Math.sin(da),Math.cos(da)); if (Math.abs(da)>fov) return 0; if (!losRoom(ox,oy,jj.x,jj.y)) return 0; return d<range*.45?2.6:1.3; }
function sgDetect(src){ if (SG.alarm) return; SG.alarm=true; sfx("ping"); shake=Math.max(shake,4); toast(L2("🚨 Entdeckt!","🚨 Spotted!")); if (src) src.alert=1; if (SG.onDetect) SG.onDetect(src); }
function guardsToFoes(list){ const out=[]; for (const g of (list||SG.guards)){ if (g.down||g.gone) continue; g.gone=true; out.push(spawnFoe(g.x,g.y,{weapon:"pistol",look:g.look||GUARD_LOOK,sp:90,stay:true})); } return out; }
function updateStealth(dt){ if (!SG.on||paused) return; SG.t+=dt; const run=jj.moving&&jj.run;
  for (const g of SG.guards){ if (g.down||g.gone) continue;
    let seeing=0; const fa=g.ang+Math.PI/2; seeing=SG.alarm?0:sees(g.x,g.y,fa,g.range,g.fov);
    if (!seeing&&!SG.alarm&&run&&Math.hypot(jj.x-g.x,jj.y-g.y)<140&&losRoom(g.x,g.y,jj.x,jj.y)){ g.heard=1.2; }
    if (g.heard>0){ g.heard-=dt; const ta=Math.atan2(-(jj.x-g.x),jj.y-g.y); let d=ta-g.ang; d=Math.atan2(Math.sin(d),Math.cos(d)); g.ang+=d*Math.min(1,dt*4); g.moving=false; }
    else if (g.path.length){ if (g.wait>0){ g.wait-=dt; g.moving=false; } else { const p=g.path[g.pi], dx=p.x-g.x, dy=p.y-g.y, d=Math.hypot(dx,dy);
        if (d<4){ g.pi=(g.pi+1)%g.path.length; g.wait=p.w; } else { const sp=Math.min(d,g.sp*dt); g.x+=dx/d*sp; g.y+=dy/d*sp; const ta=Math.atan2(-dx/d,dy/d); let da=ta-g.ang; da=Math.atan2(Math.sin(da),Math.cos(da)); g.ang+=da*Math.min(1,dt*6); g.moving=true; g.step+=dt*9; } } }
    else if (g.look0!=null){ g.ang=g.look0+Math.sin(SG.t*.5+g.x)*.9; }
    if (seeing) g.alert=Math.min(1,g.alert+dt*seeing*(run?1.5:1)); else g.alert=Math.max(0,g.alert-dt*.35);
    if (g.alert>=1) sgDetect(g); }
  for (const c of SG.cams){ if (c.off) continue; c.a=c.a0+Math.sin(SG.t*c.spd)*c.amp; const s=SG.alarm?0:sees(c.x,c.y,c.a,c.range,c.fov); if (s) c.alert=Math.min(1,c.alert+dt*s*.9); else c.alert=Math.max(0,c.alert-dt*.5); if (c.alert>=1) sgDetect(c); }
  for (const l of SG.lasers){ if (l.off){ l.on=false; continue; } if (l.amp){ const o=Math.sin(SG.t*l.spd+l.ph)*l.amp; l.x1=l.bx1+l.dx*o; l.y1=l.by1+l.dy*o; l.x2=l.bx2+l.dx*o; l.y2=l.by2+l.dy*o; }
    l.on=l.per?(((SG.t+l.ph)%l.per)<l.per*l.duty):true; if (!l.on||SG.alarm) continue; const vx=l.x2-l.x1, vy=l.y2-l.y1, L=vx*vx+vy*vy, k=Math.max(0,Math.min(1,((jj.x-l.x1)*vx+(jj.y-l.y1)*vy)/L)); if (Math.hypot(l.x1+vx*k-jj.x,l.y1+vy*k-jj.y)<7) sgDetect(l); } }
function knockTarget(){ if (!SG.on||SG.alarm||jj.veh) return null; for (const g of SG.guards){ if (g.down||g.gone) continue; const d=Math.hypot(jj.x-g.x,jj.y-g.y); if (d>34) continue; const fa=g.ang+Math.PI/2; let da=Math.atan2(jj.y-g.y,jj.x-g.x)-fa; da=Math.atan2(Math.sin(da),Math.cos(da)); if (Math.abs(da)>1.7) return g; } return null; }
function knockOut(g){ g.down=true; g.moving=false; W.atkAt=performance.now(); W.side=1; W.swing=.28; sfx("hit"); shake=Math.max(shake,2); toast(L2("Wache ausgeschaltet","Guard knocked out")); }
function drawStealth(q,t){ if (!SG.on) return;
  for (const c of SG.cams){ q.save(); if (!c.off){ const col=c.alert>.05?`rgba(255,${Math.round(200-c.alert*170)},60,${.18+c.alert*.25})`:"rgba(255,80,80,.14)"; q.fillStyle=col; q.beginPath(); q.moveTo(c.x,c.y); q.arc(c.x,c.y,c.range,c.a-c.fov,c.a+c.fov); q.closePath(); q.fill(); }
    q.translate(c.x,c.y); q.rotate(c.a); q.fillStyle="#22252b"; q.fillRect(-6,-6,16,12); q.fillStyle="#5a606a"; q.fillRect(6,-4,8,8); q.fillStyle=c.off?"#555":(Math.floor(t*2)%2?"#ff3b30":"#7a1d1d"); q.beginPath(); q.arc(-2,0,2.4,0,7); q.fill(); q.restore(); }
  for (const l of SG.lasers){ if (!l.on) { q.strokeStyle="rgba(255,60,60,.12)"; q.lineWidth=1; q.setLineDash([3,6]); q.beginPath(); q.moveTo(l.x1,l.y1); q.lineTo(l.x2,l.y2); q.stroke(); q.setLineDash([]); continue; }
    q.save(); q.globalCompositeOperation="lighter"; q.strokeStyle="rgba(255,40,40,.35)"; q.lineWidth=6; q.beginPath(); q.moveTo(l.x1,l.y1); q.lineTo(l.x2,l.y2); q.stroke(); q.strokeStyle="#ff4a4a"; q.lineWidth=1.6; q.stroke(); q.restore();
    q.fillStyle="#2b2f36"; q.fillRect(l.x1-4,l.y1-4,8,8); q.fillRect(l.x2-4,l.y2-4,8,8); }
  for (const g of SG.guards){ if (g.gone) continue; const fa=g.ang+Math.PI/2;
    if (!g.down&&!SG.alarm){ const a=g.alert, col=a>.05?`rgba(255,${Math.round(220-a*190)},60,${.16+a*.3})`:"rgba(255,235,140,.13)"; q.fillStyle=col; q.beginPath(); q.moveTo(g.x,g.y); q.arc(g.x,g.y,g.range,fa-g.fov,fa+g.fov); q.closePath(); q.fill(); }
    if (g.down){ q.save(); q.translate(g.x,g.y); q.rotate(1.4); q.translate(-g.x,-g.y); drawPerson(q,Object.assign({},g,{moving:false}),g.look); q.restore(); q.fillStyle="#fff"; q.font="11px sans-serif"; q.textAlign="center"; q.fillText("💤",g.x+10,g.y-16); continue; }
    drawPerson(q,g,g.look,{weapon:"pistol"});
    if (g.alert>.08&&!SG.alarm){ q.fillStyle="rgba(18,16,22,.85)"; rr(q,g.x-16,g.y-34,32,6,3); q.fill(); q.fillStyle=g.alert>.7?"#ff3b30":"#ffd60a"; rr(q,g.x-15,g.y-33,30*g.alert,4,2); q.fill(); q.font='700 14px "Barlow Semi Condensed",sans-serif'; q.textAlign="center"; q.fillText(g.alert>.7?"!":"?",g.x,g.y-42); } } }
// ---------- Verfolgung: Fluchtwagen fährt eine Route ab ----------
function fleeRoute(v,pts,loop){ v.route=null; v.goalPts=pts.map(p=>({x:p[0],y:p[1]})); v.gi=0; v.goal=v.goalPts[0]; v.onGoal=vv=>{ vv.gi++; if (vv.gi>=vv.goalPts.length){ if (!loop){ vv.goal=null; vv.ai=false; return; } vv.gi=0; } vv.goal=vv.goalPts[vv.gi]; vv.aiT=0; }; }

// ================= Innenwelten: Central Bank, Tresor, Brooks' Haus, Whitmore-Villa, Museum =================
const BANKDOOR={x:BANKB.x+BANKB.w/2,y:BANKB.y+BANKB.h+16}, MUSDOOR={x:MUSB.x+MUSB.w/2,y:MUSB.y-16}, MUSBACK={x:MUSB.x+MUSB.w-60,y:MUSB.y+MUSB.h+16};
const BROOKSH=buildings.find(b=>b.style==="house"&&b.x===290&&b.y===2700)||buildings.filter(b=>b.style==="house")[1];
const BROOKSWIN={x:BROOKSH.x+28,y:BROOKSH.y-14};
const WLOT=LOTS[0], WDOOR={x:WLOT.b.x+WLOT.b.w-30,y:WLOT.b.y-14};
const BANK_OPEN=()=>!(MI&&MI.def.id==="m14"&&MI.step<1);
// ---------- CENTRAL RBANK · Schalterhalle ----------
const RBANK=defRoom({id:"bank",zn:"CENTRAL BANK",zs:"Schalterhalle",r:{x:150,y:3900,w:1400,h:900},
  sol:[[0,0,1400,20],[0,0,20,900],[1380,0,20,900],[0,880,640,20],[760,880,640,20],
    [20,200,1080,36],[1160,200,220,36],[280,20,20,120],[1120,20,20,120],
    [362,402,36,36],[362,642,36,36],[1002,402,36,36],[1002,642,36,36],
    [70,560,150,28],[70,680,150,28],[1350,430,30,46],[1350,520,30,46],[620,560,160,40],[24,834,36,36],[1340,834,36,36],[60,40,150,50],[1180,40,180,40]],
  gates:{staff:{l:[1100,200,60,36]},stairs:{l:[630,96,140,12]}},
  paint(q,w,h){ RGX.marble(q,0,0,w,h,"#efe9dd","#e4dccb",60); RGX.marble(q,20,20,w-40,180,"#d9d1c0","#cfc6b3",40);
    RGX.carpet(q,640,236,120,644,"#7a1d2a","#d8b35a"); q.fillStyle="#d8b35a"; q.beginPath(); q.arc(700,760,62,0,7); q.fill(); q.fillStyle="#1d2733"; q.beginPath(); q.arc(700,760,56,0,7); q.fill(); RGX.label(q,700,750,"CENTRAL","#d8b35a",22); RGX.label(q,700,772,"BANK · EST. 1921","#d8b35a",12);
    for (const r of this.solRaw.walls) RGX.wall(q,r,"#4a3f36");
    // Schalter mit Glas
    RGX.box(q,[20,200,1080,36],"#6b4a2e","#c9a26a"); RGX.box(q,[1160,200,220,36],"#6b4a2e","#c9a26a"); for (let i=0;i<6;i++){ const x=360+i*140; q.fillStyle="rgba(170,215,240,.55)"; q.fillRect(x-40,203,80,8); q.fillStyle="#d8b35a"; q.fillRect(x-2,200,4,36); RGX.label(q,x,226,["1","2","3","4","5","6"][i],"#f3e6c8",12); }
    for (const [x,y] of [[380,420],[380,660],[1020,420],[1020,660]]){ q.fillStyle="rgba(0,0,0,.25)"; q.beginPath(); q.arc(x+5,y+5,21,0,7); q.fill(); q.fillStyle="#f4efe4"; q.beginPath(); q.arc(x,y,21,0,7); q.fill(); q.strokeStyle="rgba(0,0,0,.12)"; q.lineWidth=2; for (let k=0;k<8;k++){ const a=k/8*6.283; q.beginPath(); q.moveTo(x+Math.cos(a)*8,y+Math.sin(a)*8); q.lineTo(x+Math.cos(a)*20,y+Math.sin(a)*20); q.stroke(); } q.fillStyle="#d8d0c0"; q.beginPath(); q.arc(x,y,9,0,7); q.fill(); }
    for (const y of [560,680]){ RGX.box(q,[70,y,150,28],"#3d2a1e","#7a5a40"); }
    for (const y of [430,520]){ RGX.box(q,[1350,y,30,46],"#2b2f36","#5a606a"); q.fillStyle="#58d0ff"; q.fillRect(1354,y+10,10,16); RGX.label(q,1334,y+23,"ATM","#2b2f36",11); }
    RGX.box(q,[620,560,160,40],"#6b4a2e","#c9a26a"); RGX.label(q,700,580,"INFO","#f3e6c8",13);
    RGX.plant(q,42,852); RGX.plant(q,1358,852);
    // Büro Direktor + Sicherheitsraum + Treppe
    RGX.wood(q,24,24,256,176,"#7a5232"); RGX.box(q,[60,40,150,50],"#4a2e1a","#8a5a34"); RGX.label(q,150,140,"DIREKTOR","rgba(255,255,255,.35)",16);
    RGX.tiles(q,1140,24,236,176,"#2a2e36","#30353e",20); RGX.box(q,[1180,40,180,40],"#1b1e24","#3a404a"); for (let i=0;i<6;i++){ q.fillStyle=i%2?"#58d0ff":"#7ee36a"; q.globalAlpha=.7; q.fillRect(1186+i*29,46,24,16); } q.globalAlpha=1; RGX.label(q,1260,140,"SICHERHEIT","rgba(255,255,255,.35)",16);
    q.fillStyle="#3a3540"; q.fillRect(640,24,120,72); for (let i=0;i<7;i++){ q.fillStyle=`rgba(255,255,255,${.06+i*.03})`; q.fillRect(642,26+i*10,116,8); } RGX.label(q,700,112,"TRESOR ↓","#d8b35a",14);
    RGX.label(q,700,860,"AUSGANG ↓","rgba(40,30,20,.6)",14); },
  exits:[{z:[640,872,120,30],ok:()=>!(MI&&MI.def.id==="m14"&&MI.step>=3&&MI.step<9),go:()=>exitRoom({x:BANKDOOR.x,y:BANKDOOR.y+20},0)},
    {z:[650,26,100,40],ok:()=>RBANK.gates.stairs.open,go:()=>enterRoom("vault",{x:550,y:120,a:0})}],
  onEnter(){ if (!(MI&&MI.def.id==="m14")) bankPopulate(); },
  tick(dt){ if (MI&&MI.def.id==="m14") return; // freies Herumlaufen: wer schießt, löst Alarm aus
    if (this.alarm&&!this.alarmFoes){ this.alarmFoes=1; roomPanic(this); const gs=this.actors.filter(a=>a.guard&&!a.gone); for (const g of gs){ g.gone=true; spawnFoe(g.x,g.y,{weapon:"pistol",look:GUARD_LOOK,sp:90,stay:true}); } crime(2.6,L2("Banküberfall","Bank robbery")); toast(L2("🚨 Alarm in der Bank!","🚨 Bank alarm!")); } }});
RBANK.solRaw={walls:[[0,0,1400,20],[0,0,20,900],[1380,0,20,900],[0,880,640,20],[760,880,640,20],[280,20,20,120],[1120,20,20,120]]};
function bankPopulate(){ const o=RBANK; o.actors.length=0; o.alarm=false; o.alarmFoes=0; const L=i=>Object.assign({},LOOKS[i%LOOKS.length],{rig:RIG_CIV[i%RIG_CIV.length]});
  for (let i=0;i<5;i++) roomActor(o,"Kassierer",L(i+3),360+i*140,150,null,{face:{x:o.r.x+360+i*140,y:o.r.y+400},staff:true});
  for (const [x,y] of [[560,820],[840,820]]) roomActor(o,"Wache",GUARD_LOOK,x,y,null,{face:{x:o.r.x+700,y:o.r.y+400},guard:true,staff:true,w:"pistol"});
  const pts=[[360,280],[640,280],[920,280],[1240,450],[1240,560],[160,500],[700,500],[300,760],[1100,760]];
  for (let i=0;i<7;i++){ const p=[]; for (let k=0;k<4;k++) p.push(pts[(i*2+k*3)%pts.length]); roomActor(o,"Kunde",L(i),p[0][0],p[0][1],p,{sp:34+rnd()*14}); } }
// ---------- Tresor-Etage ----------
const VAULT=defRoom({id:"vault",zn:"CENTRAL BANK",zs:"Tresor",r:{x:150,y:4900,w:1100,h:720},
  sol:[[0,0,1100,20],[0,0,20,720],[1080,0,20,720],[0,700,1100,20],[20,400,410,30],[670,400,410,30],[200,540,120,70],[780,540,120,70],[40,440,40,240],[1020,440,40,240],[470,20,30,90],[600,20,30,90],[60,140,60,200],[980,140,60,200]],
  gates:{door:{l:[430,392,240,46],draw(q,g,t){ const cx=g.r.x+120, cy=g.r.y+23, o=VAULT.doorOpen||0; q.save(); q.translate(g.r.x+(o>0?0:0),cy); if (o>0){ q.translate(0,0); q.rotate(-o*1.45); } q.fillStyle="rgba(0,0,0,.35)"; q.fillRect(4,-20,240,50); const gr=q.createLinearGradient(0,-23,0,23); gr.addColorStop(0,"#b9c0c8"); gr.addColorStop(.5,"#8a929c"); gr.addColorStop(1,"#5d636c"); q.fillStyle=gr; q.fillRect(0,-23,240,46); q.fillStyle="#4a5058"; q.beginPath(); q.arc(120,0,20,0,7); q.fill(); q.strokeStyle="#c9d0d8"; q.lineWidth=4; for (let k=0;k<6;k++){ const a=k/6*6.283+t*.0; q.beginPath(); q.moveTo(120,0); q.lineTo(120+Math.cos(a)*30,Math.sin(a)*30); q.stroke(); } q.fillStyle="#d8b35a"; for (let k=0;k<8;k++) q.fillRect(14+k*28,-21,6,42); q.restore(); }}},
  paint(q,w,h){ RGX.tiles(q,0,0,w,h,"#5d6168","#565a61",40); RGX.tiles(q,20,430,w-40,270,"#2e3138","#33363d",30);
    for (const r of [[0,0,1100,20],[0,0,20,720],[1080,0,20,720],[0,700,1100,20],[20,400,410,30],[670,400,410,30],[470,20,30,90],[600,20,30,90]]) RGX.wall(q,r,"#2b2a30");
    q.fillStyle="#3a3540"; q.fillRect(500,20,100,90); for (let i=0;i<8;i++){ q.fillStyle=`rgba(255,255,255,${.25-i*.025})`; q.fillRect(502,22+i*11,96,8); } RGX.label(q,550,130,"↑ HALLE","#d8b35a",14);
    for (const x of [60,980]){ RGX.box(q,[x,140,60,200],"#7d848d","#b9c0c8"); for (let yy=148;yy<336;yy+=18) for (let xx=x+4;xx<x+58;xx+=18){ q.fillStyle="#9aa2ac"; q.fillRect(xx,yy,15,15); q.fillStyle="#2b2f36"; q.fillRect(xx+6,yy+6,3,3); } }
    for (const x of [40,1020]){ RGX.box(q,[x,440,40,240],"#7d848d","#b9c0c8"); for (let yy=446;yy<676;yy+=14) for (let xx=x+3;xx<x+38;xx+=12){ q.fillStyle="#9aa2ac"; q.fillRect(xx,yy,10,11); } }
    q.fillStyle="#ffd60a"; q.fillRect(43,550,34,14); RGX.label(q,60,557,"77","#1b1520",11);
    for (const x of [200,780]){ RGX.box(q,[x,540,120,70],"#4a3a20","#6b5a30"); for (let r=0;r<4;r++) for (let c=0;c<5;c++){ q.fillStyle=(r+c)%2?"#e8c34a":"#d1a73a"; q.fillRect(x+6+c*22,546+r*15,20,12); } }
    for (const [x,y] of [[460,560],[640,560],[550,650]]){ RGX.box(q,[x-22,y-14,44,28],"#2f6b3a","#5fa86a"); for (let k=0;k<3;k++){ q.fillStyle="#7ee36a"; q.fillRect(x-18+k*13,y-10,10,20); } }
    RGX.label(q,550,300,"CENTRAL BANK · TRESOR","rgba(216,179,90,.45)",22); },
  exits:[{z:[505,22,90,36],go:()=>enterRoom("bank",{x:700,y:130,a:0})}],
  draw(q,t){ } });
// ---------- Brooks' Haus (Wachmann) ----------
const BHOUSE=defRoom({id:"bhouse",zn:"HAUS BROOKS",zs:"Eastside",r:{x:1320,y:4930,w:520,h:420},
  sol:[[0,0,520,20],[0,0,20,420],[500,0,20,420],[0,400,60,20],[120,400,400,20],[260,20,16,150],[260,235,16,165],[20,250,100,16],[190,250,70,16],[276,216,104,16],[440,216,60,16],
    [40,300,30,90],[205,320,14,60],[24,24,200,24],[80,90,90,56],[380,40,110,78],[290,30,30,90],[420,330,76,56]],
  paint(q,w,h){ RGX.wood(q,0,0,w,h,"#8d6440"); RGX.tiles(q,20,20,240,230,"#e9e4da","#dcd5c8",22); RGX.tiles(q,276,232,224,168,"#cfe0e6","#c2d4da",18); RGX.carpet(q,80,280,150,100,"#3d5a7a","#9ab7d3");
    for (const r of [[0,0,520,20],[0,0,20,420],[500,0,20,420],[0,400,60,20],[120,400,400,20],[260,20,16,150],[260,235,16,165],[20,250,100,16],[190,250,70,16],[276,216,104,16],[440,216,60,16]]) RGX.wall(q,r,"#e8e0d0");
    q.fillStyle="rgba(150,200,230,.6)"; q.fillRect(60,404,60,12); RGX.box(q,[40,300,30,90],"#5a3e2a","#8a6040"); RGX.box(q,[205,320,14,60],"#1b1e24","#3a3d45"); RGX.box(q,[24,24,200,24],"#d8d0c0","#fff"); RGX.box(q,[80,90,90,56],"#7a5232","#a87a4a");
    RGX.box(q,[380,40,110,78],"#e9e4da","#ffffff"); q.fillStyle="#3d6b9a"; q.fillRect(384,70,102,44); RGX.box(q,[290,30,30,90],"#5a3e2a","#7a5a40"); RGX.box(q,[420,330,76,56],"#f4f6f8","#ffffff"); RGX.painting(q,470,120,26,40,3); RGX.label(q,90,428,"","#000"); } ,
  exits:[{z:[60,392,60,26],ok:()=>!(MI&&MI.def.id==="m8"&&MI.step<4),go:()=>exitRoom({x:BROOKSWIN.x,y:BROOKSWIN.y-22},Math.PI)}],
  draw(q,t){ const D=BHOUSE.dog; if (!D) return; const run=jj.moving&&jj.run;
    if (!D.awake){ // Hörradius: groß = nicht rennen, klein = gar nicht nah ran
      q.save(); q.setLineDash([6,6]); q.lineWidth=1.5; q.strokeStyle=run?"rgba(255,160,40,.85)":"rgba(255,214,10,.35)"; q.beginPath(); q.arc(D.x,D.y,220,0,7); q.stroke(); q.setLineDash([]);
      q.fillStyle="rgba(255,59,48,.12)"; q.beginPath(); q.arc(D.x,D.y,70,0,7); q.fill(); q.strokeStyle="rgba(255,59,48,.6)"; q.lineWidth=2; q.stroke(); q.restore();
      const nz=Math.min(1,(D.noise||0)/1.6); if (nz>.02){ q.fillStyle="rgba(18,16,22,.85)"; rr(q,D.x-22,D.y-44,44,7,3); q.fill(); q.fillStyle=nz>.65?"#ff3b30":"#ffd60a"; rr(q,D.x-21,D.y-43,42*nz,5,2.5); q.fill(); } }
    q.save(); q.translate(D.x,D.y); q.rotate(D.a+Math.PI/2); const br=D.awake?1+Math.sin(t*16)*.03:1+Math.sin(t*2)*.04;
    q.fillStyle="rgba(0,0,0,.28)"; q.beginPath(); q.ellipse(4,4,11,19,0,0,7); q.fill();
    const wag=D.awake?Math.sin(t*18)*.7:Math.sin(t*1.5)*.15; q.save(); q.translate(0,-17); q.rotate(wag); q.strokeStyle="#a8732f"; q.lineWidth=4.5; q.lineCap="round"; q.beginPath(); q.moveTo(0,0); q.quadraticCurveTo(3,-8,0,-14); q.stroke(); q.restore();
    if (!D.awake){ q.fillStyle="#8a5a24"; for (const [px,py] of [[-8,10],[8,10],[-7,-10],[7,-10]]){ q.beginPath(); q.ellipse(px,py,3,4,0,0,7); q.fill(); } }
    else { const st=Math.sin(t*14)*3; q.fillStyle="#8a5a24"; for (const [px,py,sg] of [[-8,9,1],[8,9,-1],[-7,-9,-1],[7,-9,1]]){ q.beginPath(); q.ellipse(px,py+st*sg,3,4.5,0,0,7); q.fill(); } }
    const fur=q.createLinearGradient(-10,0,10,0); fur.addColorStop(0,"#b47a34"); fur.addColorStop(.5,"#d9a356"); fur.addColorStop(1,"#a96f2c"); q.fillStyle=fur; q.beginPath(); q.ellipse(0,0,10*br,17,0,0,7); q.fill();
    q.fillStyle="rgba(255,240,210,.35)"; q.beginPath(); q.ellipse(0,-2,4,10,0,0,7); q.fill();
    q.fillStyle="#c8302a"; q.fillRect(-6,11,12,3); q.fillStyle="#ffd60a"; q.beginPath(); q.arc(0,14.5,1.6,0,7); q.fill();
    q.fillStyle="#d9a356"; q.beginPath(); q.ellipse(0,19,7.5,7,0,0,7); q.fill(); q.fillStyle="#c78f45"; q.beginPath(); q.ellipse(0,26,4.2,4.8,0,0,7); q.fill(); q.fillStyle="#2a1a10"; q.beginPath(); q.arc(0,30,2,0,7); q.fill();
    q.fillStyle="#8a5520"; for (const sd of [-1,1]){ q.beginPath(); q.ellipse(sd*7,17,3,6,sd*.5,0,7); q.fill(); }
    if (D.awake){ q.fillStyle="#1b1012"; q.beginPath(); q.arc(-3,22,1.3,0,7); q.arc(3,22,1.3,0,7); q.fill(); } else { q.strokeStyle="#3a2414"; q.lineWidth=1; q.beginPath(); q.moveTo(-4.5,22); q.lineTo(-1.5,22); q.moveTo(1.5,22); q.lineTo(4.5,22); q.stroke(); }
    q.restore();
    if (!D.awake){ q.fillStyle="rgba(255,255,255,.85)"; q.font='700 12px "Barlow Semi Condensed",sans-serif'; q.textAlign="center"; q.fillText("z",D.x+12,D.y-18-Math.sin(t*2)*3); q.fillText("Z",D.x+20,D.y-28-Math.sin(t*2+1)*3); }
    else if (Math.floor(t*4)%2) drawSay(q,D.x,D.y-30,L2("WUFF! WUFF!","WOOF! WOOF!")); }});
// ---------- Whitmore-Villa (Bankdirektor) ----------
const WVILLA=defRoom({id:"wvilla",zn:"VILLA WHITMORE",zs:"Palm Heights",r:{x:8200,y:3950,w:960,h:600},
  sol:[[0,0,960,20],[0,0,20,600],[940,0,20,600],[0,580,820,20],[900,580,60,20],[300,20,16,130],[300,210,16,90],[300,370,16,210],[20,260,120,16],[200,260,100,16],[700,20,16,130],[700,210,16,370],[316,230,150,16],[540,230,160,16],
    [80,90,120,50],[24,24,260,20],[400,410,160,26],[400,520,160,26],[560,290,90,56],[100,400,120,50],[780,60,120,100],[380,80,30,30],[600,80,30,30],[740,500,120,40]],
  paint(q,w,h){ RGX.marble(q,0,0,w,h,"#f2eee6","#e8e2d6",50); RGX.wood(q,20,20,280,240,"#6b4428"); RGX.tiles(q,20,276,280,304,"#e9eef2","#dde4ea",24); RGX.wood(q,716,20,224,560,"#8a6040"); RGX.carpet(q,380,300,300,260,"#2e4a3a","#d8b35a");
    for (const r of [[0,0,960,20],[0,0,20,600],[940,0,20,600],[0,580,820,20],[900,580,60,20],[300,20,16,130],[300,210,16,90],[300,370,16,210],[20,260,120,16],[200,260,100,16],[700,20,16,130],[700,210,16,370],[316,230,150,16],[540,230,160,16]]) RGX.wall(q,r,"#3a3036");
    RGX.box(q,[80,90,120,50],"#3d2414","#7a5232"); q.fillStyle="#d8b35a"; q.fillRect(130,100,20,12); RGX.box(q,[24,24,260,20],"#4a2e1a","#7a5232"); for (let i=0;i<26;i++){ q.fillStyle=["#c9302c","#2f5e8c","#d8b35a","#3d6b45"][i%4]; q.fillRect(28+i*10,26,7,15); }
    RGX.box(q,[400,410,160,26],"#e9e4da","#fff"); RGX.box(q,[400,520,160,26],"#e9e4da","#fff"); RGX.box(q,[560,290,90,56],"#111","#333"); q.fillStyle="#fff"; for (let i=0;i<8;i++) q.fillRect(562+i*11,330,8,14);
    RGX.box(q,[100,400,120,50],"#e9e4da","#fff"); RGX.box(q,[780,60,120,100],"#f4efe4","#fff"); q.fillStyle="#7a1d2a"; q.fillRect(784,96,112,60); RGX.box(q,[740,500,120,40],"#5a3e2a","#8a6040");
    for (const x of [380,600]){ RGX.box(q,[x,80,30,30],"#d8d0c0","#fff"); q.fillStyle="#c9a24a"; q.beginPath(); q.arc(x+15,95,9,0,7); q.fill(); } RGX.painting(q,330,30,60,40,1); RGX.painting(q,620,30,60,40,4); RGX.painting(q,880,250,40,60,2);
    RGX.plant(q,40,560); RGX.plant(q,680,560); RGX.label(q,160,240,"ARBEITSZIMMER","rgba(255,255,255,.3)",14); q.fillStyle="rgba(150,210,240,.5)"; q.fillRect(820,584,80,12); },
  exits:[{z:[820,574,80,26],ok:()=>!(MI&&MI.def.id==="m10"&&MI.step<4),go:()=>exitRoom({x:WDOOR.x,y:WDOOR.y-14},Math.PI)}]});
// ---------- L.A. Museum of Art ----------
const MUSEUM=defRoom({id:"museum",zn:"L.A. MUSEUM OF ART",zs:"Hollywood Hills",r:{x:150,y:5700,w:1600,h:700},
  sol:[[0,0,1600,20],[0,0,20,700],[1580,0,20,700],[0,680,760,20],[840,680,610,20],[1530,680,70,20],[500,20,16,250],[500,330,16,350],[1100,20,16,250],[1100,330,16,350],[516,220,220,16],[864,220,220,16],
    [700,380,200,140],[1200,150,40,40],[1400,150,40,40],[1200,420,40,40],[1400,420,40,40],[150,300,160,26],[150,480,160,26],[780,90,40,40]],
  paint(q,w,h){ RGX.marble(q,0,0,w,h,"#ece6da","#e2dbcc",50); RGX.wood(q,20,20,480,660,"#a07850"); RGX.wood(q,1116,20,464,660,"#a07850"); RGX.marble(q,516,20,568,200,"#e8e0f0","#ddd4e8",40);
    for (const r of [[0,0,1600,20],[0,0,20,700],[1580,0,20,700],[0,680,760,20],[840,680,610,20],[1530,680,70,20],[500,20,16,250],[500,330,16,350],[1100,20,16,250],[1100,330,16,350],[516,220,220,16],[864,220,220,16]]) RGX.wall(q,r,"#e9e2d4");
    for (let i=0;i<6;i++){ RGX.painting(q,40+i*76,24,60,44,i+1); RGX.painting(q,40+i*76,636,60,40,i+7); } for (let i=0;i<5;i++){ RGX.painting(q,1140+i*88,24,66,44,i+3); RGX.painting(q,1140+i*88,636,66,40,i+9); }
    RGX.box(q,[150,300,160,26],"#5a3e2a","#8a6040"); RGX.box(q,[150,480,160,26],"#5a3e2a","#8a6040");
    for (const [x,y] of [[1200,150],[1400,150],[1200,420],[1400,420]]){ RGX.box(q,[x,y,40,40],"#f4efe4","#fff"); q.fillStyle="#9aa2ac"; q.beginPath(); q.ellipse(x+20,y+20,12,16,0,0,7); q.fill(); q.fillStyle="#c9d0d8"; q.beginPath(); q.arc(x+20,y+12,7,0,7); q.fill(); }
    // Dino-Skelett hinter Absperrung
    q.strokeStyle="#c9302c"; q.lineWidth=3; q.strokeRect(700,380,200,140); q.strokeStyle="#f4efe4"; q.lineWidth=5; q.beginPath(); q.moveTo(720,450); q.quadraticCurveTo(780,400,880,430); q.stroke(); q.lineWidth=2; for (let i=0;i<10;i++){ const x=740+i*14; q.beginPath(); q.moveTo(x,440-i*2); q.lineTo(x-4,420-i*2); q.moveTo(x,440-i*2); q.lineTo(x-4,465-i); q.stroke(); } q.beginPath(); q.arc(886,432,10,0,7); q.stroke();
    RGX.label(q,800,540,"T-REX · 66 MIO. JAHRE","rgba(60,50,40,.6)",13);
    q.fillStyle="rgba(255,255,255,.4)"; q.beginPath(); q.arc(800,110,70,0,7); q.fill(); RGX.box(q,[780,90,40,40],"#2b2f36","#5a606a"); RGX.label(q,800,170,"STERN VON MALIBU","rgba(60,50,80,.6)",14);
    RGX.label(q,800,660,"EINGANG ↓","rgba(60,50,40,.55)",14); RGX.label(q,1490,660,"↓ PERSONAL","rgba(60,50,40,.55)",13); RGX.label(q,260,250,"MODERNE","rgba(60,50,40,.45)",18); RGX.label(q,1340,300,"SKULPTUREN","rgba(60,50,40,.45)",18); },
  exits:[{z:[760,672,80,26],ok:()=>!(MI&&MI.def.id==="m11"),go:()=>exitRoom({x:MUSDOOR.x,y:MUSDOOR.y-14},Math.PI)},
    {z:[1450,672,80,26],ok:()=>!(MI&&MI.def.id==="m11"&&MI.step<6),go:()=>exitRoom({x:MUSBACK.x,y:MUSBACK.y+14},0)}],
  onEnter(){ if (!(MI&&MI.def.id==="m11")) musPopulate(); else this.actors.length=0; },
  draw(q,t){ const tk=MUSEUM.taken; const x=this.r.x+800, y=this.r.y+104; q.save(); q.fillStyle="rgba(190,230,255,.35)"; q.fillRect(x-14,y-14,28,28); q.strokeStyle="rgba(255,255,255,.8)"; q.lineWidth=1.5; q.strokeRect(x-14,y-14,28,28);
    if (!tk){ q.globalCompositeOperation="lighter"; const s=.6+.4*Math.sin(t*5); q.fillStyle=`rgba(200,240,255,${.5*s})`; q.beginPath(); q.arc(x,y,10,0,7); q.fill(); q.globalCompositeOperation="source-over"; q.fillStyle="#e8fbff"; q.beginPath(); q.moveTo(x,y-7); q.lineTo(x+6,y); q.lineTo(x,y+7); q.lineTo(x-6,y); q.closePath(); q.fill(); } q.restore(); },
  tick(dt){ if (MI&&MI.def.id==="m11") return; if (this.alarm&&!this.alarmFoes){ this.alarmFoes=1; roomPanic(this); crime(1.5,L2("Randale im Museum","Museum riot")); } }});
function musPopulate(){ const o=MUSEUM; o.actors.length=0; const L=i=>Object.assign({},LOOKS[i%LOOKS.length],{rig:RIG_CIV[(i+3)%RIG_CIV.length]});
  const pts=[[120,120],[400,140],[260,400],[420,560],[650,600],[960,600],[800,300],[1250,300],[1480,560],[1300,100],[1500,300]];
  for (let i=0;i<8;i++){ const p=[]; for (let k=0;k<4;k++) p.push(pts[(i*3+k*4)%pts.length]); roomActor(o,"Besucher",L(i),p[0][0],p[0][1],p,{sp:28+rnd()*10}); }
  roomActor(o,"Wache",GUARD_LOOK,800,640,null,{face:{x:o.r.x+800,y:o.r.y+300},guard:true,staff:true,w:"pistol"}); }
RBANK.outDoor={x:BANKDOOR.x,y:BANKDOOR.y,dy:24}; VAULT.outDoor=RBANK.outDoor; BHOUSE.outDoor={x:BROOKSWIN.x,y:BROOKSWIN.y,dy:20}; WVILLA.outDoor={x:WDOOR.x,y:WDOOR.y,dy:20}; MUSEUM.outDoor={x:MUSBACK.x,y:MUSBACK.y,dy:20};
// Schüsse in Bank/Museum außerhalb einer Mission → Alarm
const _scare=scareNpcs; scareNpcs=function(x,y,r){ _scare(x,y,r); const o=CURROOM; if (o&&(o===RBANK||o===MUSEUM)&&!(MI&&(MI.def.id==="m11"||MI.def.id==="m13"||MI.def.id==="m14"))) o.alarm=true; if (o&&MI&&MI.def.id==="m13") MI.d.shot=true; };


