// ================= FLUGZEUGE (nach Akt 1 fliegbar) =================
let FLY=null; const PSC=1.2;
function planeSolids(p,home){ return home?[R(p.x-13,p.y-84,26,168),R(p.x-80,p.y-20,160,40),R(p.x-34,p.y+56,68,26)]:[R(p.x-30,p.y-30,60,60)]; }
function planeNear(){ if (jj.veh||jj.dead||jj.h||FLY) return null; let best=null,bd=125; for (const p of PLANES){ if (p.gone) continue; const d=Math.hypot(jj.x-p.x,jj.y-p.y); if (d<bd){ bd=d; best=p; } } return best; }
function planeLocked(){ toast(L2("🔒 Erst nach der Flugstunde mit Mo kannst du Flugzeuge fliegen.","🔒 You can fly planes after the flight lesson with Mo.")); sfx("ping"); }
function boardPlane(p){ if (!UNLOCK.plane&&!(MI&&MI.def.id==="mf")){ planeLocked(); return; } for (const r of p.sol){ const i=solids.indexOf(r); if (i>=0) solids.splice(i,1); }
  p.gone=true; FLY={p,x:p.x,y:p.y,a:p.a,v:0,h:0,t:0,hint:4}; jj.hidden=true; jj.lock=99; sfx("door"); showDest(false); closePhone();
  toast("✈ W Gas · A/D lenken · S bremsen/sinken · ab ~300 km/h hebst du ab"); }
function planeBail(){ const F=FLY; if (!F||F.h<40||!UNLOCK.plane||jj.dead) return; const p=F.p, ix=F.x+Math.cos(F.a)*F.v*1.4, iy=F.y+Math.sin(F.a)*F.v*1.4; FLY=null; jj.hidden=false; jj.lock=0; jj.veh=null;
  jj.x=F.x; jj.y=F.y; jj.h=F.h; jj.roof=null; jj.glide={vx:Math.cos(F.a)*150,vy:Math.sin(F.a)*150}; jj.ang=Math.atan2(-jj.glide.vx,jj.glide.vy); $("flyHud").hidden=true; sfx("swing"); toast(L2("🪂 Abgesprungen!","🪂 Bailed out!"));
  setTimeout(()=>{ explosion(ix,iy,1.6); p.x=p.hx; p.y=p.hy; p.a=p.ha; p.sol=planeSolids(p,true); p.gone=false; solids.push(...p.sol); },1500); hudDirty=true; }
function leavePlane(crash){ const F=FLY; if (!F) return; const p=F.p; FLY=null; jj.hidden=false; jj.lock=0;
  if (crash){ explosion(F.x,F.y,1.6); p.x=p.hx; p.y=p.hy; p.a=p.ha; p.sol=planeSolids(p,true); p.gone=false; solids.push(...p.sol); const q2=landNear(F.x,F.y); jj.x=q2.x; jj.y=q2.y; hurt(55); toast("Bruchlandung!"); }
  else { p.x=F.x; p.y=F.y; p.a=F.a; p.sol=planeSolids(p,false); p.gone=false; solids.push(...p.sol); const s=F.a+Math.PI/2, q2=landNear(F.x+Math.cos(s)*60,F.y+Math.sin(s)*60); jj.x=q2.x; jj.y=q2.y; sfx("door"); }
  cam.x=jj.x; cam.y=jj.y; $("flyHud").hidden=true; hudDirty=true; }
const onAirfield=(x,y)=>[AIR.runway,AIR.taxi,AIR.apron].some(r=>x>r.x-20&&x<r.x+r.w+20&&y>r.y-20&&y<r.y+r.h+20);
function updateFly(dt){ const F=FLY; if (!F) return; F.t+=dt; jj.lock=99; const inp=paused?{thr:0,steer:0}:driveInput({a:F.a,v:F.v}); const thr=inp.thr, st=inp.steer;
  if (F.h<=0){ if (thr>0) F.v+=150*thr*dt; else if (thr<0) F.v-=(F.v>0?320:60)*(-thr)*dt; F.v*=Math.pow(thr===0?.55:.97,dt); F.v=Math.max(-40,Math.min(430,F.v)); if (thr===0&&Math.abs(F.v)<5) F.v=0;
    F.a+=st*1.15*Math.min(1,Math.abs(F.v)/70)*Math.sign(F.v||1)*dt;
    if (F.v>300&&thr>0){ F.h=1; toast("Abgehoben!"); }
    const nx=F.x+Math.cos(F.a)*F.v*dt, ny=F.y+Math.sin(F.a)*F.v*dt; if (blockedAt(nx+Math.cos(F.a)*60,ny+Math.sin(F.a)*60,16)||inWater(nx,ny)){ if (Math.abs(F.v)>140) { leavePlane(true); return; } F.v=0; } else { F.x=nx; F.y=ny; } }
  else { F.v+=thr*130*dt; F.v=Math.max(210,Math.min(640,F.v)); F.a+=st*1.3*dt;
    if (thr<0||F.v<280) F.h-=(thr<0?75:40)*dt; else if (thr>0) F.h=Math.min(360,F.h+110*dt); else F.h=Math.min(360,F.h+20*dt);
    if (F.x<150||F.x>WW-150||F.y<150||F.y>WH-150){ const ta=Math.atan2(WH/2-F.y,WW/2-F.x); let d=ta-F.a; d=Math.atan2(Math.sin(d),Math.cos(d)); F.a+=Math.sign(d)*1.6*dt; if (F.hint<=0){ F.hint=6; toast("Zu weit draußen – kehr um!"); } }
    F.hint-=dt; F.x+=Math.cos(F.a)*F.v*dt; F.y+=Math.sin(F.a)*F.v*dt;
    if (F.h<=0){ F.h=0; if (onAirfield(F.x,F.y)&&F.v<=330&&!blockedAt(F.x,F.y,20)){ F.v=Math.min(F.v,260); toast("Gelandet. Sauber, Captain JJ!"); sfx("ping"); } else { leavePlane(true); return; } } }
  jj.x=F.x; jj.y=F.y; const el=$("flyHud"); el.hidden=false; el.textContent=`✈ ${Math.round(Math.abs(F.v)*.9)} km/h · Höhe ${Math.round(F.h*3)} m${F.h<=0&&Math.abs(F.v)<40?" · E aussteigen":""}`; }
function drawPlaneAt(q,x,y,a,col,s){ q.save(); q.translate(x,y); q.rotate(a); q.scale(s,s); planeShape(q,"#f6f6f3",col); q.restore(); }
function drawPlanesGround(q,vis){ for (const p of PLANES){ if (p.gone||!vis(p.x,p.y,180)) continue; q.save(); q.translate(p.x+22,p.y+12); q.rotate(p.a); q.scale(PSC,PSC); q.globalAlpha=.32; planeShape(q,"rgba(25,15,40,.9)"); q.restore(); q.globalAlpha=1; drawPlaneAt(q,p.x,p.y,p.a,p.c,PSC); } }
function drawFly(q,vx,vy,air){ const F=FLY; if (!F) return; if (air!==(F.h>2)) return; const k=1+F.h/D, X=vx+(F.x-vx)*k, Y=vy+(F.y-vy)*k;
  q.save(); q.translate(F.x+22+F.h*.45,F.y+12+F.h*.17); q.rotate(F.a); q.scale(PSC,PSC); q.globalAlpha=air?.22:.32; planeShape(q,"rgba(25,15,40,.9)"); q.restore(); q.globalAlpha=1;
  drawPlaneAt(q,X,Y,F.a,F.p.c,PSC*k); }
function drawPlaneTags(q,t){ if (FLY||jj.veh) return; for (const p of PLANES){ if (p.gone) continue; const d=Math.hypot(jj.x-p.x,jj.y-p.y); if (d>170) continue;
  const lk=!UNLOCK.plane, txt=lk?L2("✈ FLIEGEN · 🔒 FLUGSTUNDE","✈ FLY · 🔒 FLIGHT LESSON"):"✈ FLIEGEN · E", y=p.y-112+Math.sin(t*3+p.x)*2.5; q.font='400 15px "Bebas Neue",Impact,sans-serif'; q.textAlign="center"; q.textBaseline="middle";
  const w=q.measureText(txt).width+22; q.globalAlpha=Math.min(1,(170-d)/60); q.fillStyle="rgba(18,16,22,.86)"; rr(q,p.x-w/2,y-12,w,24,12); q.fill(); q.strokeStyle=lk?"rgba(255,255,255,.35)":"#ffd23f"; q.lineWidth=1.5; q.stroke(); q.fillStyle=lk?"#e8e2d6":"#ffd23f"; q.fillText(txt,p.x,y+1); q.globalAlpha=1; } }

// ================= LAKE HOLLYWOOD: schwimmen, tauchen, Hai, Oktopus, Babyfische, Geheimnis =================
const LK={t:0,shark:{x:8560,y:2470,a:0,v:60,bite:0,ang:0,mode:"patrol"},oct:{x:7905,y:2330,t:0,ink:0,hx:7905,hy:2330},chest:{x:8560,y:2560,taken:false},schools:[],air:1,dive:false,notice:0};
try{ LK.chest.taken=localStorage.getItem("jjla-lakechest")==="1"; }catch(e){}
for (const [cx,cy] of [[7980,2140],[8820,2170],[8900,2700],[7900,2650],[8380,2800]]){ const s={x:cx,y:cy,hx:cx,hy:cy,a:rnd()*6.28,f:[]}; for (let i=0;i<11;i++) s.f.push({ox:(rnd()-.5)*50,oy:(rnd()-.5)*50,ph:rnd()*6}); LK.schools.push(s); }
const inLakeDeep=(x,y)=>inLake(x,y)&&lakeR(x,y)<.86;
function lakeSwim(){ return !jj.veh&&!jj.dead&&jj.swim&&inLake(jj.x,jj.y); }
function toggleDive(){ if (!lakeSwim()){ LK.dive=false; return; } if (!LK.dive&&!inLakeDeep(jj.x,jj.y)){ toast("Hier ist es zu flach zum Tauchen"); return; } LK.dive=!LK.dive; sfx(LK.dive?"door":"ping"); if (LK.dive&&LK.notice<1){ LK.notice=1; toast("Abgetaucht! Behalte die Luft im Blick – E zum Auftauchen"); } }
// ================= SANTA LUNA: Luna Park, Leuchtturm, Speedway-Rundenzeit =================
const SPD={best:0,run:null,px:0};
try{ SPD.best=parseFloat(localStorage.getItem("jjla-lap"))||0; }catch(e){}
const fmtLap=s=>{ const m=Math.floor(s/60), r=s-m*60; return m+":"+(r<10?"0":"")+r.toFixed(2); };
function updateIsland(dt){ const C=CST, v=55+16*Math.sqrt(Math.max(0,C.zmax-C.P[C.i].z)); C.d+=v*dt; let gu=0; while (C.d>=C.P[C.i].l&&gu++<20){ C.d-=C.P[C.i].l; C.i=(C.i+1)%C.N; } updateCoasterRide(dt,v); updateGolf(dt); updateClimb(dt); updateRoadblocks(dt); updateJets(dt);
  const veh=jj.veh, el=$("lapChip"), en=LANG==="en"; if (!el) return;
  const ok=veh&&!veh.wreck&&(veh.t.kind==="car"||veh.t.kind==="moto");
  if (!ok){ SPD.run=null; if (!el.hidden) el.hidden=true; SPD.px=jj.x; return; }
  const x=veh.x, y=veh.y, onT=spwD(x,y)<SPW.w/2+50, yl=SPW.c1.y+SPW.r;
  const cross=(SPD.px<SPW.fx)!==(x<SPW.fx)&&Math.abs(SPD.px-x)<120&&Math.abs(y-yl)<SPW.w/2+30, ang=Math.atan2(y-SPW.c1.y,x-SPW.fx);
  if (SPD.run){ const L=SPD.run; L.t+=dt; let da=ang-L.a; da=Math.atan2(Math.sin(da),Math.cos(da)); L.acc+=da; L.a=ang;
    if (!onT){ L.off+=dt; if (L.off>2.5){ SPD.run=null; toast(en?"Lap cancelled – you left the track":"Runde abgebrochen – Strecke verlassen"); } } else L.off=0;
    if (SPD.run&&cross&&Math.abs(L.acc)>5.6){ const lt=L.t, rec=!SPD.best||lt<SPD.best; if (rec){ SPD.best=lt; try{ localStorage.setItem("jjla-lap",String(lt)); }catch(e){} }
      toast((rec?(en?"🏁 NEW RECORD! ":"🏁 NEUER REKORD! "):(en?"🏁 Lap: ":"🏁 Runde: "))+fmtLap(lt)); SPD.run={t:0,a:ang,acc:0,off:0,n:L.n+1}; } }
  else if (cross&&onT){ SPD.run={t:0,a:ang,acc:0,off:0,n:1}; toast(en?"🏁 Lap started – drive one full lap!":"🏁 Runde läuft – fahr eine volle Runde!"); }
  SPD.px=x;
  const near=SPD.run||(x>2500&&x<4900&&y>4190&&y<5860);
  if (near){ if (el.hidden) el.hidden=false; const txt=(SPD.run?(en?"LAP ":"RUNDE ")+SPD.run.n+" · "+fmtLap(SPD.run.t):(en?"🏁 Cross the finish line to start":"🏁 Über die Ziellinie fahren = Start"))+"   BEST "+(SPD.best?fmtLap(SPD.best):"–"); if (el.textContent!==txt) el.textContent=txt; } else if (!el.hidden) el.hidden=true; }
function drawAirportLights(q,t,vis){ const rw=AIR.runway; if (!vis(rw.x+rw.w/2,600,1300)) return; q.save(); q.globalCompositeOperation="lighter";
  const seq=(t*2.2)%10;   // "Rabbit": Blitzlicht läuft Richtung Schwelle
  for (const L of AIRL){ if (!vis(L.x,L.y,30)) continue; let a=L.k==="edge"?.14:L.k==="thr"||L.k==="end"?.26:L.k==="app"||L.k==="bar"?.14:.12, r=L.k==="thr"||L.k==="end"?6:5;
    if (L.k==="app"&&Math.floor(seq)===8-L.i){ a=.42; r=8; }
    const gr=q.createRadialGradient(L.x,L.y,0,L.x,L.y,r); gr.addColorStop(0,L.c); gr.addColorStop(1,"rgba(0,0,0,0)"); q.globalAlpha=a; q.fillStyle=gr; q.beginPath(); q.arc(L.x,L.y,r,0,7); q.fill(); }
  q.restore(); q.globalAlpha=1; }
function drawIslandGround(q,t,vis){ if (!vis(4950,5100,3300)) return;
  q.strokeStyle="rgba(255,255,255,.55)"; q.lineWidth=2.2; const N=SLCOAST.length;
  for (let k=0;k<2;k++){ const ph=(t*.35+k*.5)%1; q.globalAlpha=Math.sin(ph*Math.PI)*.75; q.beginPath(); let pen=false;
    for (let i=0;i<=N;i++){ const [x,y]=SLCOAST[i%N]; if (!vis(x,y,40)||onBridge(x,y-14)){ pen=false; continue; } const dx=x-4950, dy=y-5040, L=Math.hypot(dx,dy)||1, o=6+ph*22+Math.sin(i*.3+t)*2, px=x+dx/L*o, py=y+dy/L*o; if (pen) q.lineTo(px,py); else { q.moveTo(px,py); pen=true; } } q.stroke(); }
  q.globalAlpha=1;
  if (vis(CRS.x,CRS.y,200)){ const a0=t*.9; for (let i=0;i<16;i++){ const a=a0+i/16*6.2832, x=CRS.x+Math.cos(a)*74, y=CRS.y+Math.sin(a)*74, bob=Math.sin(t*3+i)*1.5; q.fillStyle=["#fff3e0","#ffd23f","#ff8fd8","#7fd3ff"][i%4]; q.save(); q.translate(x,y); q.rotate(a+1.57); rr(q,-4,-9+bob,8,18,3); q.fill(); q.restore(); } } }
function drawIslandAir(q,vx,vy,t,vis){ const P=(x,y,z)=>{ const k=1+z/D; return [vx+(x-vx)*k,vy+(y-vy)*k]; };
  const seg=(a,b,w,c)=>{ q.strokeStyle=c; q.lineWidth=w; q.beginPath(); q.moveTo(a[0],a[1]); q.lineTo(b[0],b[1]); q.stroke(); };
  if (vis(6790,4580,900)){ const C=CST, Pt=C.P; q.lineCap="round";
    for (let i=0;i<C.N;i+=4){ const p=Pt[i]; seg(P(p.x,p.y,0),P(p.x,p.y,p.z-3),4.5,"#6f777f"); seg(P(p.x,p.y,0),P(p.x,p.y,p.z-3),2,"#b7bec5"); }
    q.strokeStyle="rgba(25,15,40,.25)"; q.lineWidth=14; q.beginPath(); for (let i=0;i<=C.N;i++){ const p=Pt[i%C.N], a=P(p.x,p.y,p.z); i?q.lineTo(a[0],a[1]):q.moveTo(a[0],a[1]); } q.stroke(); for (const s of [-6,6]){ q.strokeStyle="#e8352f"; q.lineWidth=4; q.beginPath(); for (let i=0;i<=C.N;i++){ const p=Pt[i%C.N], a=P(p.x+p.nx*s,p.y+p.ny*s,p.z); i?q.lineTo(a[0],a[1]):q.moveTo(a[0],a[1]); } q.stroke(); }
    q.strokeStyle="#f2efe6"; q.lineWidth=2; for (let i=0;i<C.N;i+=2){ const p=Pt[i], a=P(p.x+p.nx*7,p.y+p.ny*7,p.z), b=P(p.x-p.nx*7,p.y-p.ny*7,p.z); q.beginPath(); q.moveTo(a[0],a[1]); q.lineTo(b[0],b[1]); q.stroke(); }
    for (let c=0;c<5;c++){ const i=(C.i-c*2+C.N*2)%C.N, p=Pt[i], n=Pt[(i+1)%C.N], a=P(p.x,p.y,p.z+5), b=P(n.x,n.y,n.z+5), ang=Math.atan2(b[1]-a[1],b[0]-a[0]), k=1+p.z/D;
      q.save(); q.translate(a[0],a[1]); q.rotate(ang); q.fillStyle=["#ffd23f","#2fa8ff","#2fd38a","#ff8fd8","#ff7a2f"][c]; rr(q,-10*k,-6*k,20*k,12*k,3); q.fill(); q.fillStyle="#2a2228"; for (const sx of [-4,4]){ q.beginPath(); q.arc(sx*k,0,2.4*k,0,7); q.fill(); } if (c===0&&CRIDE){ q.fillStyle="#6b4428"; q.beginPath(); q.arc(4*k,0,3.6*k,0,7); q.fill(); q.fillStyle="#141218"; q.beginPath(); q.arc(4*k,0,3.6*k,Math.PI*.6,Math.PI*1.4); q.fill(); q.fillStyle="#fff"; q.font="700 "+(9*k)+"px sans-serif"; q.textAlign="center"; q.save(); q.rotate(-ang); q.fillText("JJ",0,-12*k); q.restore(); } q.restore(); }
    q.lineCap="butt"; }
  if (vis(FW.x,FW.y,700)){ const H=FW.hz, Rr=FW.r, rot=t*.12;
    for (const dy of [-34,34]) for (const dx of [-115,115]) seg(P(FW.x+dx,FW.y+dy,0),P(FW.x,FW.y+dy*.25,H),5,"#c9ccd1");
    for (const dy of [-9,9]){ q.strokeStyle="#e9edf2"; q.lineWidth=3.5; q.beginPath(); for (let i=0;i<=48;i++){ const a=i/48*6.2832, pt=P(FW.x+Math.cos(a)*Rr,FW.y+dy,H+Math.sin(a)*Rr); i?q.lineTo(pt[0],pt[1]):q.moveTo(pt[0],pt[1]); } q.stroke();
      for (let i=0;i<FW.n;i++){ const a=rot+i/FW.n*6.2832; seg(P(FW.x,FW.y+dy,H),P(FW.x+Math.cos(a)*Rr,FW.y+dy,H+Math.sin(a)*Rr),1.4,"rgba(230,235,240,.8)"); } }
    for (let i=0;i<FW.n;i++){ const a=rot+i/FW.n*6.2832, x=FW.x+Math.cos(a)*Rr, z=H+Math.sin(a)*Rr, pt=P(x,FW.y,z-14), k=1+z/D; q.fillStyle=["#ff5f5f","#ffd23f","#2fa8ff","#2fd38a","#ff8fd8","#b27bff","#ff9f43"][i%7]; rr(q,pt[0]-9*k,pt[1]-7*k,18*k,14*k,4*k); q.fill(); q.fillStyle="rgba(255,255,255,.55)"; q.fillRect(pt[0]-6*k,pt[1]-4*k,12*k,4*k); }
    const hp=P(FW.x,FW.y,H); q.fillStyle="#7c838b"; q.beginPath(); q.arc(hp[0],hp[1],9,0,7); q.fill();
    for (let i=0;i<24;i++){ const a=i/24*6.2832+rot, on=((i+Math.floor(t*4))%3)===0, pt=P(FW.x+Math.cos(a)*Rr,FW.y-10,H+Math.sin(a)*Rr); q.fillStyle=on?"#fff3a0":"rgba(255,220,120,.35)"; q.beginPath(); q.arc(pt[0],pt[1],on?3:2,0,7); q.fill(); } }
  if (vis(CRS.x,CRS.y,300)){ const c=P(CRS.x,CRS.y,48), k=1+48/D, r=66*k, a0=t*.9; for (let i=0;i<12;i++){ q.fillStyle=i%2?"#e8352f":"#fff3e0"; q.beginPath(); q.moveTo(c[0],c[1]); q.arc(c[0],c[1],r,a0+i/12*6.2832,a0+(i+1)/12*6.2832); q.closePath(); q.fill(); } const tp=P(CRS.x,CRS.y,62); q.fillStyle="#ffd23f"; q.beginPath(); q.arc(tp[0],tp[1],8,0,7); q.fill(); }
  if (vis(DTW.x,DTW.y,600)){ const H=DTW.h, cy=(t%14)/14, z=cy<.55?40+cy/.55*(H-80):cy<.7?H-40:cy<.76?H-40-(cy-.7)/.06*(H-80):40, b=P(DTW.x,DTW.y,0), tp=P(DTW.x,DTW.y,H);
    seg(b,tp,14,"#9aa1a8"); seg(b,tp,4,"rgba(255,255,255,.35)"); const rp=P(DTW.x,DTW.y,z), k=1+z/D; q.fillStyle="#e8352f"; q.beginPath(); q.arc(rp[0],rp[1],24*k,0,7); q.fill(); q.fillStyle="#ffd23f"; for (let i=0;i<10;i++){ const a=i/10*6.2832; q.beginPath(); q.arc(rp[0]+Math.cos(a)*19*k,rp[1]+Math.sin(a)*19*k,3*k,0,7); q.fill(); }
    q.fillStyle=Math.sin(t*5)>0?"#ff3b30":"#5a1410"; q.beginPath(); q.arc(tp[0],tp[1],5,0,7); q.fill(); }
  if (vis(LH.x,LH.y,900)){ const bands=8; for (let i=0;i<bands;i++){ const z0=i/bands*LH.h, z1=(i+1)/bands*LH.h, r0=28-8*z0/LH.h, r1=28-8*z1/LH.h, a=P(LH.x,LH.y,z0), b=P(LH.x,LH.y,z1), dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy)||1, nx=-dy/L, ny=dx/L, ka=1+z0/D, kb=1+z1/D;
      q.fillStyle=i%2?"#e8352f":"#f4f1ea"; q.beginPath(); q.moveTo(a[0]+nx*r0*ka,a[1]+ny*r0*ka); q.lineTo(b[0]+nx*r1*kb,b[1]+ny*r1*kb); q.lineTo(b[0]-nx*r1*kb,b[1]-ny*r1*kb); q.lineTo(a[0]-nx*r0*ka,a[1]-ny*r0*ka); q.closePath(); q.fill(); q.beginPath(); q.arc(b[0],b[1],r1*kb,0,7); q.fill(); }
    const top=P(LH.x,LH.y,LH.h), kt=1+LH.h/D; q.fillStyle="#2a2d33"; q.beginPath(); q.arc(top[0],top[1],24*kt,0,7); q.fill(); q.fillStyle="#fff2a8"; q.beginPath(); q.arc(top[0],top[1],15*kt,0,7); q.fill();
    const rf=P(LH.x,LH.y,LH.h+22); q.fillStyle="#b3261e"; q.beginPath(); q.arc(rf[0],rf[1],12*kt,0,7); q.fill();
    q.save(); q.globalCompositeOperation="lighter"; const ba=t*.8; for (const s2 of [0,Math.PI]){ const a=ba+s2, L=760, sp=.13, g1=q.createRadialGradient(top[0],top[1],10,top[0],top[1],L); g1.addColorStop(0,"rgba(255,240,170,.32)"); g1.addColorStop(1,"rgba(255,240,170,0)"); q.fillStyle=g1; q.beginPath(); q.moveTo(top[0],top[1]); q.lineTo(top[0]+Math.cos(a-sp)*L,top[1]+Math.sin(a-sp)*L); q.lineTo(top[0]+Math.cos(a+sp)*L,top[1]+Math.sin(a+sp)*L); q.closePath(); q.fill(); } q.restore(); } }
// ---------- Achterbahn fahren ----------
let ISLCAM=null, CRIDE=null;
CST.st=CST.P.reduce((m,q,i)=>q.z<CST.P[m].z?i:m,0); { const q=CST.P[CST.st]; CST.sx=q.x+q.nx*48; CST.sy=q.y+q.ny*48; }
function startCoaster(){ if (!canPay(10)){ toast(LANG==="en"?"Not enough money ($10)":"Zu wenig Geld ($10)"); return; } pay(10); hudDirty=true;
  CRIDE={dist:0,t:0,said:0}; CST.i=CST.st; CST.d=0; jj.hidden=true; jj.lock=99; sfx("door"); toast(LANG==="en"?"🎢 Hold on tight!":"🎢 Festhalten!"); }
function updateCoasterRide(dt,v){ const R_=CRIDE; if (!R_) return; R_.t+=dt; R_.dist+=v*dt; jj.lock=99; jj.hidden=true; const p=CST.P[CST.i], n=CST.P[(CST.i+6)%CST.N];
  ISLCAM={x:p.x,y:p.y}; jj.x=p.x; jj.y=p.y; const slope=(n.z-p.z)/Math.max(1,Math.hypot(n.x-p.x,n.y-p.y));
  if (slope<-.35){ shake=Math.max(shake,3.5); if (R_.said<2&&R_.t>3){ R_.said=2; toast("JJ: WOOOOOOOO!"); } } else if (slope>.3&&p.z>120&&R_.said<1){ R_.said=1; toast(LANG==="en"?"JJ: Oh f*ck oh f*ck oh f*ck …":"JJ: Oh f*ck, oh f*ck, oh f*ck …"); }
  if (R_.dist>=CST.L){ CRIDE=null; ISLCAM=null; jj.hidden=false; jj.lock=0; jj.x=CST.sx; jj.y=CST.sy; cam.x=jj.x; cam.y=jj.y; jjSay(LANG==="en"?"Again! AGAIN!":"Nochmal! NOCHMAL!",2.5); } }
// ---------- Golf (3 Löcher, Par 9) ----------
const GH=[{tee:[5480,5330],cup:[6080,5250],par:3},{tee:[6250,5720],cup:[6880,5450],par:3},{tee:[6950,5720],cup:[7230,5200],par:3}];
const GFAIR=[[5750,5300,380,90,-.1],[6500,5560,420,100,.35],[7050,5330,260,80,-.6]], GSAND=[[6000,5330,40,22,.3],[6170,5190,34,18,.3],[6800,5520,46,24,.3],[7160,5280,30,18,.3],[6350,5650,40,20,.3]], GPOND=[6450,5280,120,60,.2];
const inEl=(x,y,e)=>{ const dx=x-e[0], dy=y-e[1], c=Math.cos(e[4]||0), s2=Math.sin(e[4]||0), u=(dx*c+dy*s2)/e[2], w=(-dx*s2+dy*c)/e[3]; return u*u+w*w<1; };
function golfSurf(x,y){ if (x<5040||x>7410||y<5120||y>5830) return "oob"; if (inEl(x,y,GPOND)) return "water"; if (GSAND.some(e=>inEl(x,y,e))) return "sand"; if (GH.some(h=>inEl(x,y,[h.cup[0],h.cup[1],70,55,0]))) return "green"; if (GFAIR.some(e=>inEl(x,y,e))) return "fair"; return "rough"; }
let GOLF=null, GOLF_BEST=0; try{ GOLF_BEST=parseInt(localStorage.getItem("jjla-golf"))||0; }catch(e){}
function startGolf(){ if (!canPay(25)){ toast(LANG==="en"?"Not enough money ($25)":"Zu wenig Geld ($25)"); return; } pay(25); hudDirty=true;
  GOLF={h:0,strokes:[0,0,0],ball:null,aim:0,pw:0,pdir:1,charge:false,rot:0,last:null,msg:0}; golfTee(); $("golfUI").hidden=false; sfx("door"); golfHud(); }
function golfTee(){ const H=GH[GOLF.h]; GOLF.ball={x:H.tee[0],y:H.tee[1],z:0,vx:0,vy:0,vz:0,mov:false}; GOLF.last={x:H.tee[0],y:H.tee[1]}; GOLF.aim=Math.atan2(H.cup[1]-H.tee[1],H.cup[0]-H.tee[0]); GOLF.pw=0; GOLF.charge=false; }
function golfHud(){ if (!GOLF) return; const en=LANG==="en", H=GH[GOLF.h], b=GOLF.ball, sf=b?golfSurf(b.x,b.y):"fair", d=b?Math.round(Math.hypot(H.cup[0]-b.x,H.cup[1]-b.y)/10):0, SN=en?{fair:"Fairway",rough:"Rough",sand:"Bunker",green:"Green",water:"Water",oob:"Out"}:{fair:"Fairway",rough:"Rough",sand:"Bunker",green:"Grün",water:"Wasser",oob:"Aus"};
  $("gH").textContent=(en?"HOLE ":"LOCH ")+(GOLF.h+1)+"/3"; $("gS").textContent="Par "+H.par+" · "+(en?"Stroke ":"Schlag ")+(GOLF.strokes[GOLF.h]+1)+" · "+SN[sf]+" · "+d+" m"; $("gHit").textContent=sf==="green"?(en?"PUTT":"PUTTEN"):(en?"SWING":"SCHLAGEN");
  $("gTip").innerHTML=PAD.on?(en?padGlyph("ls")+" aim · hold "+padGlyph("x")+", release to swing · "+padGlyph("o")+" quit":padGlyph("ls")+" zielen · "+padGlyph("x")+" halten, loslassen = Schlag · "+padGlyph("o")+" beenden"):(en?"←/→ aim · hold Space, release to swing · Esc quit":"←/→ zielen · Leertaste halten, loslassen = Schlag · Esc beenden"); }
function golfShoot(){ if (!GOLF) return; const G=GOLF, b=G.ball; if (b.mov||!G.charge) return; G.charge=false; const sf=golfSurf(b.x,b.y), put=sf==="green", pw=Math.max(.05,G.pw);
  const vmax=put?420:sf==="sand"?430:sf==="rough"?560:700, sp=vmax*pw, err=(sf==="rough"?.06:sf==="sand"?.09:.02)*(rnd()-.5)*(put?.3:1);
  b.vx=Math.cos(G.aim+err)*sp; b.vy=Math.sin(G.aim+err)*sp; b.vz=put?0:230*pw; b.mov=true; G.last={x:b.x,y:b.y}; G.strokes[G.h]++; G.pw=0; sfx("hit"); golfHud(); }
function golfEnd(quit){ const G=GOLF; if (!G) return; GOLF=null; ISLCAM=null; jj.lock=0; $("golfUI").hidden=true; if (quit){ toast(LANG==="en"?"Golf round abandoned":"Golfrunde abgebrochen"); return; }
  const tot=G.strokes.reduce((a,b)=>a+b,0), par=9, diff=tot-par, prize=Math.max(0,par-tot)*60+(G.ace?500:0); if (prize){ cash+=prize; hudDirty=true; }
  const rec=!GOLF_BEST||tot<GOLF_BEST; if (rec){ GOLF_BEST=tot; try{ localStorage.setItem("jjla-golf",String(tot)); }catch(e){} } saveGame();
  toast("⛳ "+tot+(LANG==="en"?" strokes (":" Schläge (")+(diff>0?"+":"")+(diff||"E")+")"+(prize?" · +$"+prize:"")+(rec?(LANG==="en"?" · NEW RECORD":" · NEUER REKORD"):"")); }
function updateGolf(dt){ const G=GOLF; if (!G) return; const b=G.ball, H=GH[G.h]; jj.lock=99; ISLCAM={x:b.x,y:b.y-20};
  const rot=G.rot+(PAD.on&&Math.abs(PAD.lx)>.2?PAD.lx:0); if (!b.mov&&rot) G.aim+=rot*1.5*dt;
  if (G.charge){ G.pw+=G.pdir*dt*.9; if (G.pw>=1){ G.pw=1; G.pdir=-1; } if (G.pw<=0){ G.pw=0; G.pdir=1; } } $("gP").style.width=(G.pw*100)+"%";
  if (!b.mov){ jj.x=b.x-Math.cos(G.aim)*14+Math.sin(G.aim)*12; jj.y=b.y-Math.sin(G.aim)*14-Math.cos(G.aim)*12; jj.ang=G.aim-Math.PI/2; }
  else { const st=Math.ceil(Math.hypot(b.vx,b.vy)*dt/6)||1, h=dt/st;
    for (let k=0;k<st;k++){ const nx=b.x+b.vx*h, ny=b.y+b.vy*h; const hit=solids.find(r=>nx>r.x&&nx<r.x+r.w&&ny>r.y&&ny<r.y+r.h);
      if (hit&&b.z<30){ const inX=b.x>hit.x&&b.x<hit.x+hit.w; if (inX) b.vy*=-.5; else b.vx*=-.5; } else { b.x=nx; b.y=ny; }
      if (b.z>0||b.vz>0){ b.z+=b.vz*h; b.vz-=600*h; if (b.z<=0){ b.z=0; const sf=golfSurf(b.x,b.y); if (sf==="water"){ b.vx=b.vy=b.vz=0; break; } b.vz=b.vz<-60?-b.vz*.25:0; const f=sf==="sand"?.15:sf==="rough"?.45:sf==="green"?.7:.6; b.vx*=f; b.vy*=f; } }
      else { const sf=golfSurf(b.x,b.y), dc=sf==="green"?260:sf==="fair"?420:sf==="sand"?2400:sf==="water"?9999:900, v=Math.hypot(b.vx,b.vy), nv=Math.max(0,v-dc*h); if (v>0){ b.vx*=nv/v; b.vy*=nv/v; } }
      const dh=Math.hypot(H.cup[0]-b.x,H.cup[1]-b.y), v=Math.hypot(b.vx,b.vy); if (b.z<2&&(dh<9&&v<330||dh<5&&v<520)){ b.x=H.cup[0]; b.y=H.cup[1]; b.vx=b.vy=b.vz=0; b.mov=false; b.in=true; break; } }
    const v=Math.hypot(b.vx,b.vy);
    if (b.in){ b.in=false; const n=G.strokes[G.h], d=n-H.par, en=LANG==="en", nm=n===1?(en?"HOLE IN ONE!!!":"HOLE IN ONE!!!"):d<=-2?"Eagle!":d===-1?"Birdie!":d===0?"Par.":d===1?"Bogey.":(en?"+"+d+" … oof.":"+"+d+" … autsch."); if (n===1) G.ace=true;
      sfx("ping"); toast("⛳ "+nm); jjSay(n===1?"WAS?! JAAAA!":d<0?(en?"Too easy.":"Zu einfach."):d>1?(en?"This game is rigged.":"Das Spiel ist manipuliert."):(en?"Solid.":"Solide."),2.2);
      if (G.h<2){ G.h++; setTimeout(()=>{ if (GOLF){ golfTee(); golfHud(); } },1600); b.mov=false; b.done=true; } else { b.mov=false; setTimeout(()=>golfEnd(false),1400); } return; }
    if (v<5&&b.z<=0&&b.vz<=0){ b.vx=b.vy=0; b.mov=false; const sf=golfSurf(b.x,b.y);
      if (sf==="water"||sf==="oob"){ G.strokes[G.h]++; b.x=G.last.x; b.y=G.last.y; toast(sf==="water"?(LANG==="en"?"💦 Water! +1 penalty":"💦 Wasser! +1 Strafschlag"):(LANG==="en"?"Out of bounds! +1 penalty":"Aus! +1 Strafschlag")); }
      if (G.strokes[G.h]>=8){ toast(LANG==="en"?"Picked up – max 8 strokes":"Aufgenommen – max. 8 Schläge"); if (G.h<2){ G.h++; golfTee(); } else { golfEnd(false); return; } }
      G.aim=Math.atan2(GH[G.h].cup[1]-b.y,GH[G.h].cup[0]-b.x); golfHud(); } } }
function drawGolf(q,t){ const G=GOLF; if (!G) return; const b=G.ball, H=GH[G.h];
  { const x=H.cup[0], y=H.cup[1], w=Math.sin(t*4)*3; q.strokeStyle="#f4f1ea"; q.lineWidth=2.5; q.beginPath(); q.moveTo(x,y); q.lineTo(x+20,y-46); q.stroke(); q.fillStyle="#ffd23f"; q.beginPath(); q.moveTo(x+20,y-46); q.lineTo(x+44+w,y-40); q.lineTo(x+18,y-30); q.fill(); }
  if (!b.mov&&!b.done){ const sf=golfSurf(b.x,b.y), put=sf==="green", pw=G.charge?G.pw:.75, L=put?40+pw*170:80+pw*420; q.save(); q.setLineDash([8,8]); q.strokeStyle="rgba(255,255,255,.85)"; q.lineWidth=2.5; q.beginPath(); q.moveTo(b.x,b.y); q.lineTo(b.x+Math.cos(G.aim)*L,b.y+Math.sin(G.aim)*L); q.stroke(); q.restore();
    q.strokeStyle="rgba(255,255,255,.6)"; q.lineWidth=2; q.beginPath(); q.arc(b.x+Math.cos(G.aim)*L,b.y+Math.sin(G.aim)*L,put?6:14,0,7); q.stroke(); }
  const zz=b.z*4; q.fillStyle="rgba(0,0,0,.3)"; q.beginPath(); q.arc(b.x+zz*.45,b.y+zz*.17,3.2,0,7); q.fill(); q.fillStyle="#fff"; q.beginPath(); q.arc(b.x,b.y-zz*.3,3.4+b.z*.05,0,7); q.fill(); q.strokeStyle="rgba(0,0,0,.25)"; q.lineWidth=1; q.stroke(); }
{ const down=()=>{ if (GOLF&&!GOLF.ball.mov&&!GOLF.ball.done&&!GOLF.charge){ GOLF.charge=true; GOLF.pw=0; GOLF.pdir=1; } }, up=()=>golfShoot();
  addEventListener("keydown",e=>{ if (!GOLF) return; const c=e.code; if (["Space","ArrowLeft","ArrowRight","KeyA","KeyD","Escape","KeyE","Enter","KeyW","KeyS","ArrowUp","ArrowDown"].includes(c)){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if ((c==="Space"||c==="Enter")&&!e.repeat) down(); if (c==="ArrowLeft"||c==="KeyA") GOLF.rot=-1; if (c==="ArrowRight"||c==="KeyD") GOLF.rot=1; if (c==="Escape") golfEnd(true); } },true);
  addEventListener("keyup",e=>{ if (!GOLF) return; const c=e.code; if (["Space","ArrowLeft","ArrowRight","KeyA","KeyD","Enter"].includes(c)){ e.stopPropagation(); e.stopImmediatePropagation(); if (c==="Space"||c==="Enter") up(); if ((c==="ArrowLeft"||c==="KeyA")&&GOLF.rot<0) GOLF.rot=0; if ((c==="ArrowRight"||c==="KeyD")&&GOLF.rot>0) GOLF.rot=0; } },true);
  const bind=(id,on,off)=>{ const el=document.getElementById(id); el.addEventListener("pointerdown",e=>{ e.preventDefault(); e.stopPropagation(); on(); }); if (off){ el.addEventListener("pointerup",off); el.addEventListener("pointercancel",off); el.addEventListener("pointerleave",off); } };
  bind("gHit",down,up); bind("gL",()=>{ if (GOLF) GOLF.rot=-1; },()=>{ if (GOLF) GOLF.rot=0; }); bind("gR",()=>{ if (GOLF) GOLF.rot=1; },()=>{ if (GOLF) GOLF.rot=0; }); bind("gQ",()=>golfEnd(true)); }
// ---------- Controller (Gamepad API: PlayStation, Xbox, MFi) ----------
const PAD={on:false,lx:0,ly:0,rx:0,ry:0,lt:0,rt:0,hb:false,prev:[],rum:0,idx:-1};
addEventListener("gamepadconnected",e=>{ if (!PAD_ENABLED) return; PAD.idx=e.gamepad.index; toast(LANG==="en"?"🎮 Controller connected":"🎮 Controller verbunden"); });
addEventListener("gamepaddisconnected",()=>{ PAD.on=false; PAD.idx=-1; stick.id===-7&&(stick.id=null,stick.dx=stick.dy=0); padUI(); });
const padKey=(code,down)=>dispatchEvent(new KeyboardEvent(down?"keydown":"keyup",{code,key:code,bubbles:true}));
function padGlyph(k){ const ps=PAD.ps, M=ps?{x:["✕","#8fb4ff"],o:["○","#ff6b6b"],sq:["□","#ff8fd8"],tri:["△","#2fd38a"]}:{x:["A","#2fd38a"],o:["B","#ff6b6b"],sq:["X","#4aa3ff"],tri:["Y","#ffd23f"]},
  S={l1:ps?"L1":"LB",r1:ps?"R1":"RB",l2:ps?"L2":"LT",r2:ps?"R2":"RT",opt:ps?"OPTIONS":"MENU",up:"↑",down:"↓",lr:"←→",ls:ps?"L-Stick":"L-Stick",rs:ps?"R-Stick":"R-Stick"};
  return M[k]?`<span class="pgl" style="color:${M[k][1]}">${M[k][0]}</span>`:`<span class="pgl pt">${S[k]||k}</span>`; }
const HELP0=$("help").innerHTML;
function padUI(){ document.body.classList.toggle("pad",PAD.on); const en=LANG==="en", G=padGlyph;
  $("help").innerHTML=PAD.on?(en?`${G("ls")} move · ${G("x")} sprint · ${G("r2")} / ${G("o")} attack · ${G("rs")} aim · ${G("tri")} enter/exit · ${G("l1")} hold = weapon wheel · ${G("down")} outfit · ${G("sq")} reload · ${G("up")} phone · ${G("opt")} map &nbsp;|&nbsp; 🚗 ${G("r2")} gas · ${G("l2")} brake · ${G("r1")} handbrake · ${G("l1")} radio`
    :`${G("ls")} laufen · ${G("x")} rennen · ${G("r2")} / ${G("o")} angreifen · ${G("rs")} zielen · ${G("tri")} ein-/aussteigen · ${G("l1")} halten = Waffenrad · ${G("down")} Outfit · ${G("sq")} nachladen · ${G("up")} Handy · ${G("opt")} Karte &nbsp;|&nbsp; 🚗 ${G("r2")} Gas · ${G("l2")} Bremse · ${G("r1")} Handbremse · ${G("l1")} Radio`):HELP0;
  const rk=document.querySelector("#radioChip kbd"); if (rk) rk.textContent=PAD.on?(PAD.ps?"L1":"LB"):"R"; if (GOLF) golfHud(); }
const PAD_ENABLED=false;   // Controller vorerst deaktiviert – Fokus: Handy
function pollPad(dt){ if (!PAD_ENABLED){ if (PAD.on){ PAD.on=false; padUI(); } return; } const gl=navigator.getGamepads?navigator.getGamepads():[]; let gp=null; for (const g of gl) if (g&&g.connected){ gp=g; break; }
  if (!gp){ if (PAD.on){ PAD.on=false; padUI(); } return; }
  const ps=/054c|dualsense|dualshock|playstation|wireless controller/i.test(gp.id); if (!PAD.on||PAD.ps!==ps){ PAD.on=true; PAD.ps=ps; padUI(); }
  const ax=gp.axes, B=gp.buttons.map(b=>b.pressed), V=gp.buttons.map(b=>b.value||0), dz=v=>Math.abs(v)<.16?0:v;
  PAD.lx=dz(ax[0]||0); PAD.ly=dz(ax[1]||0); PAD.rx=dz(ax[2]||0); PAD.ry=dz(ax[3]||0); PAD.lt=V[6]||0; PAD.rt=V[7]||0; PAD.hb=!!B[5];
  const pr=PAD.prev, edge=i=>B[i]&&!pr[i], rel=i=>!B[i]&&pr[i], tap=c=>{ padKey(c,true); padKey(c,false); }, hold=(i,c)=>{ if (edge(i)) padKey(c,true); if (rel(i)) padKey(c,false); };
  const done=()=>{ PAD.prev=B; if (shake>3&&PAD.rum<=0&&gp.vibrationActuator&&gp.vibrationActuator.playEffect){ PAD.rum=.12; try{ gp.vibrationActuator.playEffect("dual-rumble",{duration:90,strongMagnitude:Math.min(1,shake/14),weakMagnitude:Math.min(1,shake/9)}); }catch(e){} } PAD.rum-=dt; };
  // Laufen: linker Stick wie der Touch-Stick
  if (!jj.veh&&!GOLF&&!WH_.open&&(PAD.lx||PAD.ly)){ stick.id=-7; stick.dx=PAD.lx*(B[0]?80:58); stick.dy=PAD.ly*(B[0]?80:58); } else if (stick.id===-7){ stick.id=null; stick.dx=stick.dy=0; }
  const phone=typeof phoneOpen!=="undefined"&&phoneOpen;
  if (PICK){ if (edge(0)||edge(3)||edge(7)&&false) pickTap(); if (edge(1)) closePick(false); return done(); }
  if (!started||DLG||cardMode){ hold(0,"Enter"); if (edge(3)) tap("KeyE"); if (edge(1)) tap("Escape"); return done(); }
  if (GOLF){ const f=B[0]||PAD.rt>.5; if (f&&!PAD.gf) padKey("Space",true); if (!f&&PAD.gf) padKey("Space",false); PAD.gf=f; if (edge(1)) golfEnd(true); return done(); }
  if (WH_.open){ if (edge(5)||edge(14)||edge(15)) wheelTab(WH_.tab==="w"?"o":"w"); const big=Math.abs(PAD.rx)+Math.abs(PAD.ry)>.5, sx=big?PAD.rx:PAD.lx, sy=big?PAD.ry:PAD.ly; if (Math.hypot(sx,sy)>.55) wheelAim(Math.atan2(sy,sx));
    if (rel(4)) padKey("KeyQ",false); if (rel(13)) padKey("KeyC",false); if (edge(0)) wheelPick(); if (edge(1)) closeWheel(); return done(); }
  if (phone&&edge(1)) tap("Escape");
  if (edge(3)) tap("KeyE");                                                    // △ ein-/aussteigen, reden, Türen
  if (edge(9)||edge(8)) tap("KeyM");                                           // OPTIONS / Share = Karte
  if (edge(12)) tap("KeyP");                                                   // ↑ Handy
  if (jj.veh){ if (edge(4)||edge(15)) tap("KeyR"); if (edge(14)&&typeof setRadio==="function") setRadio(radioIdx-1+STATIONS.length);   // L1 / ←→ Radio
    if (edge(2)||edge(0)&&jj.veh.t.kind==="heli") tap("KeyG");                 // □ (Heli: abspringen)
    if (PAD.fireP){ padKey("Space",false); PAD.fireP=false; } return done(); }
  hold(0,"ShiftLeft");                                                         // ✕ rennen
  const fire=PAD.rt>.5||B[1], fp=PAD.fireP; PAD.fireP=fire;                    // R2 / ○ angreifen
  if (fire&&!fp) padKey("Space",true);
  if (AIM.on&&(PAD.rx||PAD.ry)) AIM.ang=Math.atan2(PAD.ry,PAD.rx);
  if (!fire&&fp){ if (AIM.on&&(PAD.rx||PAD.ry)) AIM.ang=Math.atan2(PAD.ry,PAD.rx); padKey("Space",false); }
  if (edge(2)) tap("KeyR");                                                    // □ nachladen
  hold(4,"KeyQ");                                                              // L1: tippen = nächste Waffe, halten = Waffenrad
  hold(13,"KeyC");                                                             // ↓: Outfit-Rad
  if (edge(15)) cycleWeapon(1); if (edge(14)) cycleWeapon(-1);
  return done(); }
