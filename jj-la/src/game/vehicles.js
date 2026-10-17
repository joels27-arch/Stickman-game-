// ================= VEHICLES =================
const VT={
  taxi:{n:"Taxi",l:55,w:25,max:330,acc:250,turn:2.6,hp:180,kind:"car"},
  sedan:{n:"Limousine",l:55,w:25,max:330,acc:250,turn:2.6,hp:180,kind:"car"},
  sports:{n:"Sportwagen",l:55,w:25,max:450,acc:390,turn:2.9,hp:160,kind:"car"},
  suv:{n:"SUV",l:61,w:28,max:300,acc:220,turn:2.3,hp:260,kind:"car"},
  pickup:{n:"Pickup",l:63,w:28,max:310,acc:230,turn:2.3,hp:240,kind:"car"},
  police:{n:"Streifenwagen",l:57,w:26,max:410,acc:340,turn:2.8,hp:230,kind:"car"},
  tank:{n:"Panzer",l:72,w:40,max:210,acc:150,turn:1.5,hp:1500,kind:"car"},
  earlmoto:{n:"Bobbys alte Maschine",l:33,w:11,max:330,acc:310,turn:3.3,hp:100,kind:"moto"},
  moto:{n:"Motorrad",l:33,w:11,max:310,acc:300,turn:3.5,hp:100,kind:"moto"},
  jetski:{n:"Jetski",l:32,w:13,max:360,acc:340,turn:3.4,hp:100,kind:"boat"},
  boat:{n:"Speedboot",l:66,w:24,max:370,acc:260,turn:2.1,hp:190,kind:"boat"},
  racer:{n:"Rennwagen",l:52,w:24,max:560,acc:470,turn:3.1,hp:150,kind:"car"},
  heli:{n:"Helikopter",l:74,w:18,max:440,acc:520,turn:3,hp:280,kind:"heli"}};
function carSprite(type,col,wreck){ if (window.ASSETS&&ASSETS.veh&&VEHM[type]) return paintedCar(type,col,wreck); if (type==="tank"){ const c=tankSprite(); if (wreck){ const q=c.getContext("2d"); q.globalCompositeOperation="source-atop"; q.fillStyle="rgba(20,18,16,.75)"; q.fillRect(0,0,c.width,c.height); } return c; } const t=VT[type], S=2, l=t.l, w=t.w, pad=type==="heli"?40:6;
  return mk((l+pad*2)*S,(w+pad*2+(type==="heli"?0:0))*S,q=>{ q.scale(S,S); q.translate(l/2+pad,w/2+pad); const L=l/2, Wd=w/2;
    const body=(c)=>{ const gr=q.createLinearGradient(-L,-Wd,L*.4,Wd); gr.addColorStop(0,shade(c,1.3)); gr.addColorStop(.45,c); gr.addColorStop(1,shade(c,.62)); return gr; };
    const glass=()=>{ const gr=q.createLinearGradient(-L,-Wd,L,Wd); gr.addColorStop(0,"#5d7890"); gr.addColorStop(.5,"#1c2836"); gr.addColorStop(1,"#0e151d"); return gr; };
    if (t.kind==="car"){
      const cab=type==="sports"?[-.24,.12]:type==="pickup"?[-.02,.34]:type==="suv"?[-.34,.22]:[-.26,.2];
      q.fillStyle="rgba(0,0,0,.35)"; rr(q,-L-.5,-Wd-.5,l+1,w+1,6); q.fill();
      q.fillStyle=body(type==="police"?"#17191d":col); rr(q,-L,-Wd,l,w,type==="sports"?7:5); q.fill();
      if (type==="police"){ q.fillStyle=body("#f1f0ec"); q.fillRect(-L*.55,-Wd+.5,L*1.15,w-1); }
      // mirrors
      q.fillStyle=type==="police"?"#17191d":shade(col,.8); q.fillRect(L*(cab[1]*2)-2,-Wd-2,3,2.5); q.fillRect(L*(cab[1]*2)-2,Wd-.5,3,2.5);
      // glasshouse
      const x0=L*cab[0]*2, x1=L*cab[1]*2; q.fillStyle=glass(); rr(q,x0,-Wd+2.2,x1-x0,w-4.4,3); q.fill();
      if (type!=="pickup"){ q.fillStyle=type==="police"?"#f4f3ef":body(col); const r0=x0+(type==="sports"?3:5), r1=x1-(type==="sports"?5:7); rr(q,r0,-Wd+3.2,r1-r0,w-6.4,2); q.fill(); }
      else { q.fillStyle=body(col); rr(q,x0+3,-Wd+3,x1-x0-8,w-6,2); q.fill(); q.fillStyle="#24272c"; q.fillRect(-L+2,-Wd+2.5,L*.9,w-5); q.strokeStyle="rgba(255,255,255,.12)"; q.lineWidth=1; for (let x=-L+5;x<-L+L*.9;x+=4){ q.beginPath(); q.moveTo(x,-Wd+3); q.lineTo(x,Wd-3); q.stroke(); } }
      q.fillStyle="rgba(255,255,255,.35)"; q.beginPath(); q.moveTo(x1-1,-Wd+3); q.lineTo(x1-3.5,-Wd+3); q.lineTo(x1-6,Wd-6); q.lineTo(x1-3.5,Wd-6); q.fill();
      if (type==="taxi"){ q.fillStyle="#1a1a1c"; for (let i=0;i<8;i++) q.fillRect(-L+6+i*5,(i%2?-1:1)*(Wd-2.2)-1,2.5,2); q.fillStyle="#f8f8f2"; q.fillRect(-3,-4,7,8); q.fillStyle="#1a1a1c"; q.font="700 3.2px sans-serif"; q.textAlign="center"; q.textBaseline="middle"; q.save(); q.translate(.5,0); q.rotate(Math.PI/2); q.fillText("TAXI",0,0); q.restore(); }
      if (type==="sports"){ q.fillStyle="rgba(255,255,255,.75)"; q.fillRect(-L,-2.4,l,1.6); q.fillRect(-L,.8,l,1.6); q.fillStyle="#1a1a1c"; q.fillRect(-L+.5,-Wd+1,2.5,w-2); }
      if (type==="suv"){ q.strokeStyle="rgba(30,30,30,.6)"; q.lineWidth=1; q.beginPath(); q.moveTo(x0+5,-Wd+4.5); q.lineTo(x1-7,-Wd+4.5); q.moveTo(x0+5,Wd-4.5); q.lineTo(x1-7,Wd-4.5); q.stroke(); }
      if (type==="police"){ q.fillStyle="#1d2026"; q.fillRect(-1.5,-Wd+3.6,4,w-7.2); q.fillStyle="#e23b3b"; q.fillRect(-1,-Wd+4,3,(w-8)/2); q.fillStyle="#2f6be2"; q.fillRect(-1,0,3,(w-8)/2); q.fillStyle="#17191d"; q.font='700 5px sans-serif'; q.textAlign="center"; q.textBaseline="middle"; q.save(); q.translate(-L*.32,0); q.rotate(Math.PI/2); q.fillText("07",0,0); q.restore(); }
      // hood crease + lights
      q.strokeStyle="rgba(0,0,0,.18)"; q.lineWidth=.8; q.beginPath(); q.moveTo(x1+3,0); q.lineTo(L-2,0); q.stroke();
      q.fillStyle="#fff6cf"; q.fillRect(L-2.2,-Wd+1.5,2,3.5); q.fillRect(L-2.2,Wd-5,2,3.5); q.fillStyle="#c8241f"; q.fillRect(-L,-Wd+1.5,1.8,3.5); q.fillRect(-L,Wd-5,1.8,3.5); }
    else if (t.kind==="moto"){
      q.fillStyle="#141416"; rr(q,-L,-2.2,8,4.4,2); q.fill(); rr(q,L-7,-1.8,7,3.6,1.8); q.fill();
      q.fillStyle=body(col); q.beginPath(); q.ellipse(2,0,7,3.6,0,0,7); q.fill(); q.fillStyle="#1d1d20"; rr(q,-8,-2.6,9,5.2,2.4); q.fill();
      q.strokeStyle="#2a2a2e"; q.lineWidth=1.4; q.beginPath(); q.moveTo(8,-6); q.lineTo(8,6); q.stroke(); q.fillStyle="#111"; q.fillRect(7,-7,2.2,2.5); q.fillRect(7,4.5,2.2,2.5);
      q.fillStyle="#fff6cf"; q.beginPath(); q.arc(L-1,0,1.6,0,7); q.fill(); q.fillStyle="#b5b8bd"; q.fillRect(-L+2,2.4,9,1.4); }
    else if (type==="jetski"){ q.fillStyle="rgba(0,0,0,.3)"; q.beginPath(); q.moveTo(-L,-Wd); q.lineTo(L*.4,-Wd); q.quadraticCurveTo(L+1,0,L*.4,Wd); q.lineTo(-L,Wd); q.closePath(); q.fill();
      q.fillStyle=body("#f4f4f0"); q.beginPath(); q.moveTo(-L,-Wd+.6); q.lineTo(L*.35,-Wd+.6); q.quadraticCurveTo(L,0,L*.35,Wd-.6); q.lineTo(-L,Wd-.6); q.closePath(); q.fill();
      q.fillStyle=col; q.beginPath(); q.moveTo(L*.05,-Wd+.6); q.lineTo(L*.35,-Wd+.6); q.quadraticCurveTo(L,0,L*.35,Wd-.6); q.lineTo(L*.05,Wd-.6); q.closePath(); q.fill();
      q.fillStyle="#1d1d20"; rr(q,-L+3,-2.6,L*.9,5.2,2.4); q.fill(); q.strokeStyle="#2a2a2e"; q.lineWidth=1.4; q.beginPath(); q.moveTo(L*.2,-5); q.lineTo(L*.2,5); q.stroke(); q.fillStyle="#111"; q.fillRect(-L-1,-2,2,4); }
    else if (t.kind==="boat"){
      q.fillStyle="rgba(0,0,0,.3)"; q.beginPath(); q.moveTo(-L,-Wd); q.lineTo(L*.35,-Wd); q.quadraticCurveTo(L,-Wd*.5,L+1,0); q.quadraticCurveTo(L,Wd*.5,L*.35,Wd); q.lineTo(-L,Wd); q.closePath(); q.fill();
      const hull=()=>{ q.beginPath(); q.moveTo(-L,-Wd+.5); q.lineTo(L*.35,-Wd+.5); q.quadraticCurveTo(L-1,-Wd*.5,L,0); q.quadraticCurveTo(L-1,Wd*.5,L*.35,Wd-.5); q.lineTo(-L,Wd-.5); q.closePath(); };
      hull(); q.fillStyle=body("#f4f4f0"); q.fill(); q.save(); hull(); q.clip(); q.fillStyle=col; q.fillRect(-L,-Wd,l,2.2); q.fillRect(-L,Wd-2.2,l,2.2);
      q.fillStyle="#b78a5a"; q.beginPath(); q.moveTo(-L+3,-Wd+3.5); q.lineTo(L*.25,-Wd+3.5); q.quadraticCurveTo(L*.75,-Wd*.3,L*.78,0); q.quadraticCurveTo(L*.75,Wd*.3,L*.25,Wd-3.5); q.lineTo(-L+3,Wd-3.5); q.closePath(); q.fill();
      q.strokeStyle="rgba(80,50,20,.35)"; q.lineWidth=.6; for (let y=-Wd+5;y<Wd-3;y+=2.4){ q.beginPath(); q.moveTo(-L+3,y); q.lineTo(L*.7,y); q.stroke(); } q.restore();
      q.fillStyle=glass(); q.beginPath(); q.moveTo(2,-Wd+3); q.quadraticCurveTo(9,0,2,Wd-3); q.lineTo(-1,Wd-3); q.quadraticCurveTo(6,0,-1,-Wd+3); q.closePath(); q.fill();
      q.fillStyle="#f0eee8"; rr(q,-10,-6,7,5,1.5); q.fill(); rr(q,-10,1,7,5,1.5); q.fill(); q.fillStyle="#2a2c30"; rr(q,-L-5,-4,7,8,1.5); q.fill(); q.fillStyle="#55585e"; q.fillRect(-L-4,-1,4,2); }
    else if (t.kind==="heli"){
      q.strokeStyle="#2b2e33"; q.lineWidth=1.6; q.beginPath(); q.moveTo(-8,-10); q.lineTo(20,-10); q.moveTo(-8,10); q.lineTo(20,10); q.stroke(); q.lineWidth=1; q.beginPath(); q.moveTo(-2,-10); q.lineTo(-1,-6); q.moveTo(14,-10); q.lineTo(13,-6); q.moveTo(-2,10); q.lineTo(-1,6); q.moveTo(14,10); q.lineTo(13,6); q.stroke();
      q.fillStyle=body(col); q.beginPath(); q.moveTo(-14,-3); q.lineTo(-L,-1.4); q.lineTo(-L,1.4); q.lineTo(-14,3); q.closePath(); q.fill();
      q.fillStyle=shade(col,.8); q.beginPath(); q.moveTo(-L+2,0); q.lineTo(-L-2,-8); q.lineTo(-L+4,-8); q.lineTo(-L+8,0); q.closePath(); q.fill(); q.fillStyle="#2a2c30"; q.fillRect(-L-3,1,10,1.6);
      q.fillStyle=body(col); q.beginPath(); q.ellipse(4,0,20,8.6,0,0,7); q.fill(); if (col==="#15161a"){ q.strokeStyle="rgba(216,179,90,.8)"; q.lineWidth=.8; q.stroke(); } q.fillStyle=glass(); q.beginPath(); q.ellipse(14,0,10,7,0,-1.5,1.5); q.fill();
      q.fillStyle="rgba(255,255,255,.35)"; q.beginPath(); q.ellipse(16,-3,4,1.6,-.3,0,7); q.fill();
      if (type==="heli"&&col==="#15161a"){ q.fillStyle="#d8b35a"; q.fillRect(-14,-1,26,2); q.font='700 6px sans-serif'; q.textAlign="center"; q.textBaseline="middle"; q.fillText("JJ",-3,-5); }
      q.fillStyle="#3a3c42"; q.beginPath(); q.arc(2,0,3.2,0,7); q.fill(); }
    if (wreck){ q.globalCompositeOperation="source-atop"; q.fillStyle="rgba(28,22,18,.86)"; q.fillRect(-L-pad,-Wd-pad,l+pad*2,w+pad*2); for (let i=0;i<10;i++){ q.fillStyle=`rgba(${rnd()<.5?"90,50,25":"0,0,0"},.5)`; q.beginPath(); q.arc(-L+rnd()*l,-Wd+rnd()*w,1+rnd()*3,0,7); q.fill(); } q.globalCompositeOperation="source-over"; } }); }
const SPR={}; const spr=(type,col,wreck)=>{ const k=type+col+(wreck?"w":""); return SPR[k]||(SPR[k]=carSprite(type,col,wreck)); };
const vehicles=[], SLOTS=[];
function addVeh(type,x,y,a,col,o){ const t=VT[type]; const v=Object.assign({type,t,x,y,a,col,v:0,sx:0,sy:0,hp:t.hp,burn:0,wreck:false,wreckT:0,z:0,driver:false,lights:false,rot:0,rotV:0,vx:0,vy:0,sinking:0},o||{}); vehicles.push(v); return v; }
function slotT(type,x,y,a,col){ slot(type,x,y,a,col,true); const s=SLOTS[SLOTS.length-1]; s.traffic=true; s.v.traffic=true; }
function slot(type,x,y,a,col,driver){ const s={type,x,y,a,col,driver}; SLOTS.push(s); s.v=addVeh(type,x,y,a,col,{driver,slot:s}); }
const E=0, S_=Math.PI/2, Wt=Math.PI, N=-Math.PI/2;

slot("sedan",320,2498,E,"#d8d8d4",true); slot("sports",1560,2564,Wt,"#f2b31f",false); slot("pickup",1820,2498,E,"#5b7f9a",false);
slot("sedan",640,1658,E,"#2f5e8c",false); slot("sedan",2620,1762,Wt,"#8a1f24",true); slot("sports",3720,1658,E,"#e8e6e0",false); slot("suv",1480,1762,Wt,"#3d4a38",true);
slot("sedan",2818,520,S_,"#b9bcc0",true); slotT("police",3418,1220,N,""); slotT("police",2218,760,S_,""); slotT("police",5400,1762,Wt,""); slotT("police",3600,2498,E,""); slot("moto",2960,1000,E,"#20242a",false);
slot("sports",3600,318,E,"#c22b3a",false); slot("sedan",4018,1300,N,"#e7e1d2",true);
slot("taxi",760+AX,1318,Wt,"#f6c21c",true);
const EARLCAR=addVeh("sedan",930,2300,Math.PI/2,"#6b4a32",{noBoard:true,keep:true}); EARLCAR.t=Object.assign({},VT.sedan,{n:"Bobbys alter Buick",max:300,hp:400}); EARLCAR.hp=400; slot("earlmoto",916,2392,Math.PI/2,"#b0582a",false); slot("suv",1240+AX,1384,Wt,"#e9e9e6",false); slot("sedan",500,1318,E,"#6a8fb0",true); slot("pickup",1400,784,Wt,"#8a5a2a",false);
slot("sedan",1731+AX,1129,E,"#4a4f57",false); slot("pickup",1810+AX,1163,Wt,"#9b2f25",false); slot("sedan",1731+AX,1197,E,"#2a6a52",false); slot("pickup",5300,2498,E,"#c9c4b8",true); slot("suv",6000,1762,Wt,"#2a2d33",true);
slot("moto",700,2978,E,"#1f6fb2",false); slot("sedan",1500,3032,Wt,"#e66f5a",true);
slot("sedan",1600,2330,N,"#c94f3a",false);   // Parkplatz am Diner
// mehr Verkehr: zusätzliche fahrende Autos auf allen Hauptstraßen
[["sedan",1900,1658,E],["taxi",3200,1658,E],["pickup",5200,1658,E],["suv",900,1762,Wt],["sedan",4600,1762,Wt],["sports",6800,1762,Wt],["sedan",2600,2498,E],["taxi",4000,2498,E],["suv",6300,2498,E],["sedan",3300,2564,Wt],["pickup",5700,2564,Wt],["sedan",2500,2978,E],["sports",6000,2978,E],["suv",4200,3032,Wt],["sedan",2818,1100,S_],["taxi",4018,800,N],["sedan",4658,2200,S_],["pickup",5652,2400,N]].forEach(([t,x,y,a],i)=>slotT(t,x,y,a,t==="taxi"?"#f6c21c":["#d8d8d4","#2f5e8c","#8a1f24","#3d4a38","#c9c4b8","#1c1d22","#6a8fb0","#e66f5a"][i%8],true));
slot("jetski",1110,waterY(1110)+30,S_,"#f2b31f",false);
// Santa Luna: Rennwagen in der Boxengasse + Verkehr auf der Insel und den Brücken
for (const [ty,x,y,c] of [["racer",3420,5640,"#e8352f"],["racer",3620,5640,"#1f6fff"],["racer",3820,5640,"#ffd23f"]]) slot(ty,x,y,Wt,c,false);
[["taxi",3600,4098,E],["suv",6200,4164,Wt],["sedan",4000,5878,E],["pickup",6500,5944,Wt],["sports",2418,5000,S_],["sedan",7458,4700,N],["taxi",2818,3500,S_],["suv",7082,3700,N],["sedan",5600,4998,E]].forEach(([t,x,y,a],i)=>slotT(t,x,y,a,t==="taxi"?"#f6c21c":["#d8d8d4","#2f5e8c","#8a1f24","#3d4a38","#c9c4b8","#1c1d22","#6a8fb0","#e66f5a"][(i+3)%8],true));   // genau ein Jetski, direkt neben dem Steg
slot("heli",HELIPAD.x,HELIPAD.y,E,"#2c5f8f",false);
LOTS.forEach((L,i)=>{ const d=L.drive; if (i%2===0) slot(["sports","suv","sports"][i%3],d.x+d.w/2,L.top?d.y+50:d.y+d.h-50,L.top?S_:N,["#e8e6e0","#15171b","#c22b3a","#f2b31f","#2e5c8a"][i%5],false); });
const vSin=v=>Math.sin(v.a), vCos=v=>Math.cos(v.a);
function local(v,x,y){ const dx=x-v.x, dy=y-v.y, c=vCos(v), s=vSin(v); return [dx*c+dy*s,-dx*s+dy*c]; }
function inVeh(v,x,y,m){ const [lx,ly]=local(v,x,y); const hl=v.t.kind==="heli"?34:v.t.l/2, hw=v.t.kind==="heli"?14:v.t.w/2; return Math.abs(lx)<hl+m&&Math.abs(ly)<hw+m; }
function solidAt(x,y){ for (const s of solids) if (x>s.x&&x<s.x+s.w&&y>s.y&&y<s.y+s.h) return s; return null; }
function vehBlocked(v,x,y,a){ const c=Math.cos(a), s=Math.sin(a), hl=v.t.l/2, hw=v.t.w/2, k=v.t.kind;
  for (const fx of [-1,-.33,.33,1]) for (const fy of [-1,1]){ const px=x+c*hl*fx-s*hw*fy, py=y+s*hl*fx+c*hw*fy;
    if (px<4||py<4||px>WW-4||py>WH-4||beyondShore(px,py,0)) return "edge";
    if (k==="boat"){ if (!inWater(px,py)) return "land"; if (onPierR(px,py)||inWSolid(px,py)) return "pier"; }
    else { if (inWater(px,py)) return "water"; if (solidAt(px,py)) return "solid"; } }
  return null; }
function unstick(v){ for (let r=4;r<=60;r+=4) for (let k=0;k<12;k++){ const a=k/12*6.283, x=v.x+Math.cos(a)*r, y=v.y+Math.sin(a)*r; if (!vehBlocked(v,x,y,v.a)){ v.x=x; v.y=y; return; } } }
const onPierR=(x,y)=>PIERS.some(r=>x>r.x-2&&x<r.x+r.w+2&&y>r.y-2&&y<r.y+r.h+2);
function damageVeh(v,d,src){ if (v.wreck||d<=0||v.inv) return; if (v.type==="tank"&&d<40) d*=.12; if (v.priv&&v.auto&&jj.veh!==v&&!v.selfFlown) return; v.hp-=d; if (v===jj.veh) hudDirty=true;
  if (v.hp<=0&&!v.burn){ v.burn=v.t.kind==="moto"?2:3.4; if (v===jj.veh) toast(v.t.kind==="heli"?"Der Heli stürzt ab!":"Raus! Es brennt!"); }
  if (v.hp<-60&&!v.wreck) explodeVeh(v); }
function explodeVeh(v){ if (v.wreck) return; v.wreck=true; v.burn=0; v.v=0; v.hp=0; v.wreckT=0; explosion(v.x,v.y,1,v);
  if (jj.veh===v){ const k=v; exitVeh(true); hurt(200); }
  if (v.t.kind==="boat") v.sinking=.001; }
function explosion(x,y,pow,src){ sfx("boom"); shake=Math.max(shake,16*pow); for (const n of npcs) if (!n.dead&&Math.hypot(n.x-x,n.y-y)<120*pow){ if (src&&(src.cop||src.jet)) killBy=src; killNpc(n,(n.x-x)*4,(n.y-y)*4); } scareNpcs(x,y,500);
  emit("flash",x,y,{size:260*pow,life:.28,max:.28,grow:200});
  for (let i=0;i<16;i++){ const a=rnd()*6.28, sp=40+rnd()*160; emit("fire",x+Math.cos(a)*10,y+Math.sin(a)*10,{vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,size:40+rnd()*40,grow:30,life:.5+rnd()*.5,max:1}); }
  for (let i=0;i<18;i++){ const a=rnd()*6.28, sp=30+rnd()*120; emit("dark",x,y,{vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,size:40+rnd()*40,grow:60,life:2+rnd()*2,max:4,a:.75}); }
  for (let i=0;i<26;i++){ const a=rnd()*6.28, sp=200+rnd()*420; emit("spark",x,y,{vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.4+rnd()*.4,max:.8}); }
  for (let i=0;i<12;i++){ const a=rnd()*6.28, sp=120+rnd()*260; emit("debris",x,y,{vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,size:3+rnd()*5,life:1.4,max:1.4,vr:(rnd()-.5)*20,col:rnd()<.5?"#2a2522":src?shade(src.col||"#888888",.6):"#5a5048"}); }
  if (!inWater(x,y)){ g.save(); g.globalAlpha=.85; g.drawImage(SCORCH,x-60*pow,y-60*pow,120*pow,120*pow); g.restore(); }
  const R=130*pow;
  for (const v of vehicles){ if (v===src||v.z>.3) continue; const d=Math.hypot(v.x-x,v.y-y); if (d<R){ const f=1-d/R; damageVeh(v,170*f*pow,null); const a=Math.atan2(v.y-y,v.x-x); v.sx+=Math.cos(a)*260*f; v.sy+=Math.sin(a)*260*f; v.rotV+=(rnd()-.5)*6*f; } }
  if (!jj.veh&&!jj.dead&&!jj.h){ const d=Math.hypot(jj.x-x,jj.y-y); if (d<R*.85) hurt(95*(1-d/(R*.85))*pow); } }
// ---------- fließender Verkehr: Autos folgen ihrer Spur, biegen an Kreuzungen ab ----------
const HD=[[1,0],[0,1],[-1,0],[0,-1]];
const roadOri=(x,y,hor)=>{ for (const r of roads) if ((r.w>r.h)===hor&&x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h) return r; return null; };
function laneOf(r,h){ return h===0?r.y+r.h*.72:h===2?r.y+r.h*.28:h===1?r.x+r.w*.28:r.x+r.w*.72; }
function trafficDrive(v,dt){ if (v.head==null){ const a=((v.a%6.2832)+6.2832)%6.2832; v.head=Math.round(a/1.5708)%4; }
  const [dx,dy]=HD[v.head], hor=dx!==0; let r=roadOri(v.x,v.y,hor)||roadOri(v.x+dx*40,v.y+dy*40,hor);
  // Kreuzung voraus? abbiegen entscheiden
  const fx=v.x+dx*46, fy=v.y+dy*46, cr=roadOri(fx,fy,!hor);
  if (cr&&v.lastX!==cr){ v.lastX=cr; const opts=[]; for (const turn of [1,3]){ const nh=(v.head+turn)%4, [nx,ny]=HD[nh], cx=cr.x+cr.w/2*(hor?1:0)+(hor?0:cr.w/2), cy=cr.y+(hor?cr.h/2:0)+(hor?0:cr.h/2); const px=(hor?fx:cr.x+cr.w/2)+nx*160, py=(hor?cr.y+cr.h/2:fy)+ny*160; if (onRoad(px,py)) opts.push(nh); }
    const straight=onRoad(v.x+dx*200,v.y+dy*200); if (opts.length&&(rnd()<.4||!straight)) v.head=opts[Math.floor(rnd()*opts.length)]; }
  if (!onRoad(v.x+dx*110,v.y+dy*110)&&!cr){ v.uT=(v.uT||0)+dt; if (v.uT>.2){ v.head=(v.head+2)%4; v.uT=0; v.lastX=null; } }
  const [hx,hy]=HD[v.head], H2=hx!==0, rr2=roadOri(v.x+hx*60,v.y+hy*60,H2)||roadOri(v.x,v.y,H2)||r;
  let gx=v.x+hx*80, gy=v.y+hy*80; if (rr2){ if (H2) gy=laneOf(rr2,v.head); else gx=laneOf(rr2,v.head); }
  let df=Math.atan2(gy-v.y,gx-v.x)-v.a; df=Math.atan2(Math.sin(df),Math.cos(df)); let thr=Math.abs(df)>.5?.35:.8, steer=Math.max(-1,Math.min(1,df*2.4)), brake=false;
  if (v.v>(Math.abs(df)>.4?70:150)) thr=0;
  const ca=Math.cos(v.a), sa=Math.sin(v.a), block=(x,y,w)=>{ const ox=x-v.x, oy=y-v.y, ah=ox*ca+oy*sa, sd=Math.abs(-ox*sa+oy*ca); return ah>0&&ah<80&&sd<w; };
  for (const o of vehicles){ if (o===v||o.gone||o.z>.2) continue; if (block(o.x,o.y,24)){ thr=0; brake=true; break; } }
  if (!brake&&!jj.veh&&block(jj.x,jj.y,20)) { thr=0; brake=true; }
  if (!brake) for (const n of npcs){ if (!n.dead&&block(n.x,n.y,18)){ thr=0; brake=true; break; } }
  if (brake){ v.waitT=(v.waitT||0)+dt; if (v.waitT>4&&v.waitT<4.1) sfx("ping"); } else v.waitT=0;
  if (Math.abs(v.v)<10&&thr>0) v.stuckT=(v.stuckT||0)+dt; else v.stuckT=0; if (v.stuckT>1.5){ v.rev=.8; v.stuckT=0; } if (v.rev>0){ v.rev-=dt; thr=-.7; steer=-steer; brake=false; }
  return {thr,steer,brake}; }
function updateVehicles(dt,t){
  for (const v of vehicles){ const k=v.t.kind, me=jj.veh===v;
    if (v.doorClosing&&v.door>0){ v.door-=dt*4.5; if (v.door<=0){ v.door=0; v.doorClosing=false; sfx("door"); } }
    if (v.sinking){ v.sinking+=dt; v.v*=.96; if (v.sinking>3) v.gone=true; continue; }
    if (v.wreck){ v.wreckT+=dt; if (v.wreckT<10&&rnd()<dt*8) emit("dark",v.x+(rnd()-.5)*20,v.y+(rnd()-.5)*10,{size:20,grow:40,life:2.5,max:2.5,a:.6}); if (v.wreckT<5&&rnd()<dt*10) emit("fire",v.x+(rnd()-.5)*16,v.y+(rnd()-.5)*8,{size:18+rnd()*14,grow:10,life:.5,max:.5,vy:-20}); }
    // damage FX
    if (!v.wreck){ const hpF=v.hp/v.t.hp, fx=v.x+Math.cos(v.a)*v.t.l*.32, fy=v.y+Math.sin(v.a)*v.t.l*.32;
      if (hpF<.5&&rnd()<dt*(hpF<.25?14:6)) emit(hpF<.25?"dark":"smoke",fx,fy,{size:10,grow:34,life:1.6,max:1.6,a:hpF<.25?.65:.45,vx:-Math.cos(v.a)*v.v*.3,vy:-Math.sin(v.a)*v.v*.3}); }
    if (v.burn>0&&!v.wreck){ v.burn-=dt; if (rnd()<dt*22) emit("fire",v.x+Math.cos(v.a)*v.t.l*.3+(rnd()-.5)*8,v.y+Math.sin(v.a)*v.t.l*.3+(rnd()-.5)*8,{size:16+rnd()*16,grow:14,life:.45,max:.45,vy:-26}); if (v.burn<=0) explodeVeh(v); }
    if (v.wreck) { v.v*=Math.pow(.05,dt); }
    // heli flight
    if (k==="heli"){ updateHeli(v,dt,me); continue; }
    let thr=0, steer=0, brake=false;
    if (v.traffic&&v.driver&&!me&&!v.ai&&!v.chauffeur&&!v.wreck&&!(v.burn>0)&&!(JACK&&JACK.v===v)){ const inp=trafficDrive(v,dt); thr=inp.thr; steer=inp.steer; brake=inp.brake; }
    else if (v.chauffeur&&!v.wreck){ const inp=chauffeurDrive(v,dt); thr=inp.thr; steer=inp.steer; brake=inp.brake; }
    else if (me&&!jj.lock&&!v.wreck&&!(v.burn>0&&v.hp<-30)){ const inp=driveInput(v); thr=inp.thr; steer=inp.steer; brake=inp.brake; }
    else if (v.ai&&!me&&!v.wreck&&!(v.burn>0)){ const inp=v.follow?followDrive(v,dt):aiDrive(v,dt); if (v.gunner) gunnerFire(v,dt); thr=inp.thr; steer=inp.steer; brake=inp.brake; v.hitCd=Math.max(0,(v.hitCd||0)-dt); if (!v.follow&&!jj.veh&&!jj.h&&!jj.dead&&v.hitCd<=0&&Math.abs(v.v)>60&&inVeh(v,jj.x,jj.y,8)){ v.hitCd=1; hurt(28); const a=v.a+Math.PI/2; jj.x+=Math.cos(a)*18; jj.y+=Math.sin(a)*18; sfx("crash"); } }
    const t2=v.t; if (thr>0) v.v+=t2.acc*thr*dt*(v.v<0?2.2:1); else if (thr<0) v.v+=t2.acc*thr*dt*(v.v>0?2.4:.55);
    if (brake) v.v*=Math.pow(.08,dt); const drag=thr===0?(k==="boat"?.55:.42):.86; v.v*=Math.pow(drag,dt); if (thr===0&&Math.abs(v.v)<6) v.v=0;
    const vmax=t2.max*(me?1+skLv("drive")*.04:1); v.v=Math.max(-t2.max*.35,Math.min(vmax,v.v)); if (me&&Math.abs(v.v)>t2.max*.6) skAdd("drive",dt);
    const oa=v.a; const sf=Math.min(1,Math.abs(v.v)/110)*Math.sign(v.v); v.a+=steer*t2.turn*sf*dt*(k==="boat"?.85:1); v.a+=v.rotV*dt; v.rotV*=Math.pow(.05,dt);
    v.sx*=Math.pow(.02,dt); v.sy*=Math.pow(.02,dt);
    const nx=v.x+(Math.cos(v.a)*v.v+v.sx)*dt, ny=v.y+(Math.sin(v.a)*v.v+v.sy)*dt;
    if (Math.abs(v.v)>1||Math.abs(v.sx)+Math.abs(v.sy)>1){ const hit=vehBlocked(v,nx,ny,v.a);
      if (!hit){ v.x=nx; v.y=ny; }
      else { const imp=Math.abs(v.v)+Math.hypot(v.sx,v.sy); if (imp>70){ damageVeh(v,(imp-70)*.13); if (me&&imp>200) bark("crash",.5); if (me){ shake=Math.max(shake,Math.min(10,imp/40)); sfx("crash"); } for (let i=0;i<6;i++) emit("spark",v.x+Math.cos(v.a)*t2.l*.5*Math.sign(v.v),v.y+Math.sin(v.a)*t2.l*.5*Math.sign(v.v),{vx:(rnd()-.5)*300,vy:(rnd()-.5)*300,life:.3,max:.3}); }
        if (me&&k==="moto"&&imp>230){ v.v*=-.2; exitVeh(true); hurt(22); toast("Abgeworfen!"); }
        if (!vehBlocked(v,nx,v.y,v.a)) v.x=nx; else if (!vehBlocked(v,v.x,ny,v.a)) v.y=ny; v.v*=-.25; v.sx*=-.3; v.sy*=-.3;
        if (vehBlocked(v,v.x,v.y,v.a)){ if (!vehBlocked(v,v.x,v.y,oa)) v.a=oa; else unstick(v); } } }
    else if (me&&vehBlocked(v,v.x,v.y,v.a)){ if (!vehBlocked(v,v.x,v.y,oa)) v.a=oa; else unstick(v); }
    if (k==="boat"&&Math.abs(v.v)>40&&rnd()<dt*30){ const bx=v.x-Math.cos(v.a)*t2.l*.5, by=v.y-Math.sin(v.a)*t2.l*.5; wakes.push({x:bx,y:by,a:v.a,life:1.6,s:Math.abs(v.v)/t2.max}); }
    if (Math.abs(v.v)>20&&me&&k!=="boat"&&Math.abs(steer)>.6&&Math.abs(v.v)>t2.max*.6&&rnd()<dt*20){ skid(v); }
  }
  // vehicle-vehicle bumps
  for (let i=0;i<vehicles.length;i++){ const a=vehicles[i]; if (a.z>.2||a.gone||a.onRoof) continue; for (let j=i+1;j<vehicles.length;j++){ const b=vehicles[j]; if (b.z>.2||b.gone||b.onRoof) continue;
    const dx=b.x-a.x, dy=b.y-a.y, rr2=(a.t.l+b.t.l)*.5; if (Math.abs(dx)>rr2||Math.abs(dy)>rr2) continue;
    let hit=false; for (const fa of [-.3,.3]) for (const fb of [-.3,.3]){ const ax=a.x+Math.cos(a.a)*a.t.l*fa, ay=a.y+Math.sin(a.a)*a.t.l*fa, bx=b.x+Math.cos(b.a)*b.t.l*fb, by=b.y+Math.sin(b.a)*b.t.l*fb, d=Math.hypot(bx-ax,by-ay), m=a.t.w*.55+b.t.w*.55;
      if (d<m&&!hit){ hit=true; const nx=(bx-ax)/(d||1), ny=(by-ay)/(d||1), va=[Math.cos(a.a)*a.v+a.sx,Math.sin(a.a)*a.v+a.sy], vb=[Math.cos(b.a)*b.v+b.sx,Math.sin(b.a)*b.v+b.sy], rel=(va[0]-vb[0])*nx+(va[1]-vb[1])*ny;
        const push=(m-d)*.5+1, okA=!vehBlocked(a,a.x-nx*push,a.y-ny*push,a.a), okB=!vehBlocked(b,b.x+nx*push,b.y+ny*push,b.a), pa=okA?(okB?push:push*2):0, pb=okB?(okA?push:push*2):0; if (okA&&!vehBlocked(a,a.x-nx*pa,a.y-ny*pa,a.a)){ a.x-=nx*pa; a.y-=ny*pa; } if (okB&&!vehBlocked(b,b.x+nx*pb,b.y+ny*pb,b.a)){ b.x+=nx*pb; b.y+=ny*pb; }
        if (rel>0){ const ma=a.t.hp, mb=b.t.hp, j2=rel*1.2; b.sx+=nx*j2*ma/(ma+mb); b.sy+=ny*j2*ma/(ma+mb); const na=Math.abs(Math.cos(a.a)*nx+Math.sin(a.a)*ny), nb=Math.abs(Math.cos(b.a)*nx+Math.sin(b.a)*ny), now=performance.now(); if (!(a.hitAt>now-300)){ a.v*=1-.45*na; a.hitAt=now; } if (!(b.hitAt>now-300)){ b.v*=1-.4*nb; b.hitAt=now; } for (const [c1,c2] of [[a,b],[b,a]]) if (c1.cop&&c2===jj.veh&&!(c1.rev>0)){ c1.rev=.55; c1.stuckT=0; } a.sx-=nx*j2*mb/(ma+mb)*.5; a.sy-=ny*j2*mb/(ma+mb)*.5; b.rotV+=(rnd()-.5)*rel*.02;
          if (rel>60){ damageVeh(a,(rel-60)*(a===jj.veh&&b.hunter?.3:1)*.1); damageVeh(b,(rel-60)*.12*(b===jj.veh&&a.hunter?.3:1)); if (jj.veh===a||jj.veh===b){ sfx("crash"); shake=Math.max(shake,Math.min(9,rel/45)); } for (let k2=0;k2<5;k2++) emit("spark",(ax+bx)/2,(ay+by)/2,{vx:(rnd()-.5)*320,vy:(rnd()-.5)*320,life:.3,max:.3}); } } } } } }
  for (let i=vehicles.length-1;i>=0;i--) if (vehicles[i].gone) vehicles.splice(i,1);
}
const skids=[]; function skid(v){ for (const s of [-1,1]){ const x=v.x-Math.cos(v.a)*v.t.l*.35-Math.sin(v.a)*v.t.w*.38*s, y=v.y-Math.sin(v.a)*v.t.l*.35+Math.cos(v.a)*v.t.w*.38*s; g.fillStyle="rgba(20,20,22,.22)"; g.beginPath(); g.arc(x,y,2.4,0,7); g.fill(); } }
const wakes=[];
function driveInput(v){ let thr=0, steer=0, brake=!!keys.Space; if (PAD.on&&(PAD.rt>.06||PAD.lt>.06||Math.abs(PAD.lx)>.12)){ thr=PAD.rt-PAD.lt; steer=Math.abs(PAD.lx)>.12?PAD.lx:0; return {thr,steer,brake:brake||PAD.hb}; }
  if (stick.id!==null){ const L=Math.hypot(stick.dx,stick.dy); if (L>10){ const ta=Math.atan2(stick.dy,stick.dx); let d=ta-v.a; d=Math.atan2(Math.sin(d),Math.cos(d)); const mag=Math.min(1,L/60);
      if (Math.abs(d)>2.3&&v.v<80){ thr=-mag; d=Math.atan2(Math.sin(d+Math.PI),Math.cos(d+Math.PI)); steer=Math.max(-1,Math.min(1,-d*2.2)); }
      else { thr=mag*(Math.abs(d)>1.6?.35:1); steer=Math.max(-1,Math.min(1,d*2.4)); } } }
  else { thr=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0); steer=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0); }
  if (touchBrake) brake=true; return {thr,steer,brake}; }
// ---------- helicopters (stealable + JJ's private pickup) ----------
let priv=null;   // the private heli object (a vehicle) while it is in play
function freeSpot(x,y,r){ for (let rad=0;rad<700;rad+=30) for (let i=0;i<Math.max(1,rad/12);i++){ const a=i/Math.max(1,rad/12)*6.283+rad*.1, px=x+Math.cos(a)*rad, py=y+Math.sin(a)*rad; if (spotOK(px,py,r)) return {x:px,y:py}; } return null; }
function spotOK(x,y,r){ if (x<r||y<r||x>WW-r||y>WH-r) return false; for (let a=0;a<6.28;a+=.785) for (const f of [0,.5,1]){ const px=x+Math.cos(a)*r*f, py=y+Math.sin(a)*r*f; if (solidAt(px,py)||inWater(px,py)) return false; }
  for (const v of vehicles) if (v.z<.3&&!v.priv&&Math.hypot(v.x-x,v.y-y)<r+v.t.l*.5) return false; return true; }
function bAt(x,y,m){ for (const b of buildings) if (x>b.x+m&&x<b.x+b.w-m&&y>b.y+m&&y<b.y+b.h-m) return b; return null; }
function heliCruise(v){ let H=0; for (const b of buildings) if (v.x>b.x-60&&v.x<b.x+b.w+60&&v.y>b.y-60&&v.y<b.y+b.h+60) H=Math.max(H,b.H); return Math.max(1,(H+80)/240); }
const towardZ=(v,tz,rate)=>{ v.z+=Math.max(-rate,Math.min(rate,tz-v.z)); };
function updateHeli(v,dt,me){ v.rot+=dt*(v.z>0||me||v.spin?42:0); if (v.wreck){ v.z=0; return; }
  if ((v.inv||v.priv&&!v.selfFlown)&&!v.crashing&&v.hp<=0){ v.hp=1; v.burn=0; }
  if ((v.hp<=0||v.crashing)&&v.z>0){ v.z-=dt*.5; v.a+=dt*(v.crashing?3.5:5); v.vx*=Math.pow(.6,dt); v.vy*=Math.pow(.6,dt); v.x=Math.max(20,Math.min(WW-20,v.x+v.vx*dt)); v.y=Math.max(20,Math.min(WH-20,v.y+v.vy*dt));
    if (rnd()<dt*25) emit("dark",v.x,v.y,{size:16,grow:50,life:1.6,max:1.6,a:.6}); const rb=bAt(v.x,v.y,0), floor=rb?rb.H/240:0;
    if (v.z<=floor){ v.z=floor; v.onRoof=rb; v.crashing=false; explodeVeh(v); } return; }
  if (v.priv&&!me) { updatePrivAuto(v,dt); return; }
  if (v.priv&&v.auto){ updatePrivAuto(v,dt); return; }
  if (me) v.selfFlown=true;
  if (!me){ if (v.landing){ towardZ(v,v.landZ||0,dt*.6); } v.vx*=Math.pow(.2,dt); v.vy*=Math.pow(.2,dt); return; }
  if (v.landing){ v.vx*=Math.pow(.05,dt); v.vy*=Math.pow(.05,dt); towardZ(v,v.landZ||0,dt*.55); if (Math.abs(v.z-(v.landZ||0))<.002){ v.z=v.landZ||0; v.landing=false; v.spin=true; v.onRoof=v.landZ>0?v.roofB:null; exitVeh(); } return; }
  towardZ(v,heliCruise(v),dt*.55); if (v.onRoof&&v.z>v.onRoof.H/240+.05) v.onRoof=null;
  let mx=0,my=0; if (stick.id!==null){ const L=Math.hypot(stick.dx,stick.dy); if (L>10){ mx=stick.dx/Math.max(60,L); my=stick.dy/Math.max(60,L); } }
  else { mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0); my=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0); const L=Math.hypot(mx,my); if (L>1){ mx/=L; my/=L; } }
  const lift=v.z>.4?1:.2; v.vx+=mx*v.t.acc*dt*lift; v.vy+=my*v.t.acc*dt*lift; v.vx*=Math.pow(.45,dt); v.vy*=Math.pow(.45,dt); const sp=Math.hypot(v.vx,v.vy); if (sp>v.t.max){ v.vx*=v.t.max/sp; v.vy*=v.t.max/sp; }
  v.x=Math.max(40,Math.min(WW-40,v.x+v.vx*dt)); v.y=Math.max(40,Math.min(WH-40,v.y+v.vy*dt)); v.v=sp;
  if (sp>30){ let d=Math.atan2(v.vy,v.vx)-v.a; d=Math.atan2(Math.sin(d),Math.cos(d)); v.a+=d*Math.min(1,dt*2.6); } }
const DEST=[{n:"Zuhause",x:1000,y:2260},{n:"Downtown",x:BLOCKS[4].x+BLOCKS[4].w*.5,y:BLOCKS[4].y+BLOCKS[4].h*.5+90},{n:"Flughafen",x:1500+AX,y:960},{n:"Heliport",x:HELIPAD.x,y:HELIPAD.y},{n:"Strand",x:560,y:3150},{n:"Palm Heights",x:3460,y:2440}];
function callHeli(){ if (!UNLOCK.pickup) { toast("Noch nicht freigeschaltet"); return; } if (priv&&!priv.gone&&!priv.wreck){ toast(priv.mode==="leave"?"Der Heli ist gerade unterwegs":"Dein Heli ist schon unterwegs"); return; }
  if (jj.veh&&jj.veh.t.kind==="heli"){ toast("Du sitzt schon im Heli"); return; }
  let spot=null, tz=0; if (jj.roof){ const b=jj.roof; for (const [ox,oy] of [[70,0],[-70,0],[0,60],[0,-60],[50,40],[-50,-40]]){ const x=jj.x+ox, y=jj.y+oy; if (x>b.x+34&&x<b.x+b.w-34&&y>b.y+30&&y<b.y+b.h-30){ spot={x,y}; break; } } if (!spot) spot={x:b.x+b.w/2,y:b.y+b.h/2}; tz=b.H/240; }
  else spot=freeSpot(jj.x+120,jj.y+70,62); if (!spot){ toast("Hier kann der Heli nicht landen"); return; }
  const ex=jj.x<WW/2?-200:WW+200, ey=Math.max(100,Math.min(WH-100,jj.y-600));
  priv=addVeh("heli",ex,ey,Math.atan2(spot.y-ey,spot.x-ex),"#15161a",{priv:true,z:1,auto:true,mode:"in",tx:spot.x,ty:spot.y,tz});
  priv.t=Object.assign({},VT.heli,{n:"Privat-Heli"}); toast("Privat-Heli ist unterwegs"); pushMsg("marco","Bin unterwegs! Wink mal, damit ich dich nicht plattmache.",true); }
function updatePrivAuto(v,dt){ const toT=()=>Math.hypot(v.tx-v.x,v.ty-v.y);
  if (v.mode==="in"||v.mode==="fly"||v.mode==="leave"){ towardZ(v,Math.max(heliCruise(v),(v.tz||0)+.3),dt*.5); v.onRoof=null; const d=toT(), a=Math.atan2(v.ty-v.y,v.tx-v.x), sp=Math.min(430,40+d*1.4);
    v.vx+=(Math.cos(a)*sp-v.vx)*Math.min(1,dt*2.5); v.vy+=(Math.sin(a)*sp-v.vy)*Math.min(1,dt*2.5); v.x+=v.vx*dt; v.y+=v.vy*dt; v.v=Math.hypot(v.vx,v.vy);
    let dd=a-v.a; dd=Math.atan2(Math.sin(dd),Math.cos(dd)); if (d>40) v.a+=dd*Math.min(1,dt*3);
    if (v.mode==="leave"){ if (v.x<-150||v.x>WW+150||v.y<-150||v.y>WH+150){ v.gone=true; priv=null; } return; }
    if (d<14){ v.mode=v.mode==="in"?"land":"drop"; } return; }
  v.vx*=Math.pow(.02,dt); v.vy*=Math.pow(.02,dt); v.x+=v.vx*dt; v.y+=v.vy*dt;
  if (v.mode==="land"||v.mode==="drop"){ const tz=v.tz||0; towardZ(v,tz,dt*.55); if (Math.abs(v.z-tz)<.002){ v.z=tz; v.onRoof=tz>0?bAt(v.x,v.y,0):null; if (v.mode==="drop"){ v.auto=false; exitVeh(); v.mode="wait"; v.wait=4; } else { v.mode="wait"; v.wait=9999; toast("Dein Heli ist gelandet"); } } return; }
  if (v.mode==="wait"){ v.spin=true; if (jj.veh!==v){ v.wait-=dt; if (v.wait<=0) privLeave(v); } } }
function privLeave(v){ v.mode="leave"; v.auto=true; const ex=v.x<WW/2?-300:WW+300; v.tx=ex; v.ty=v.y-300; }
function boardPriv(v){ v.auto=true; v.mode="choose"; showDest(true); }
function chooseDest(i){ showDest(false); const v=jj.veh; if (!v||!v.priv) return;
  if (i<0){ v.auto=false; v.mode="self"; toast("Du fliegst selbst. Aussteigen = landen."); return; }
  const d=DEST[i], spot=freeSpot(d.x,d.y,62)||d; v.tx=spot.x; v.ty=spot.y; v.tz=0; v.mode="fly"; toast("Flug nach "+d.n); }

// ---------- entering / exiting ----------
const peds=[];
// JJ redet: kurze Sprüche als Sprechblase über ihm (nicht im HUD)
const BARKS={ arrive:["Acht Jahre weg – und L.A. stinkt noch immer nach Koks und Nutten."],
  jack:["Raus da, f*ck, ich hab's eilig!","Sorry – Familien-Notfall!","Ich bring ihn zurück. Wahrscheinlich nicht.","Aussteigen, Kollege. Sh*t happens.","Danke fürs Vorwärmen.","Du fährst eh scheiße."],
  free:["Schlüssel steckt. Danke, L.A.","Riecht nach Pommes. Passt.","Keiner guckt? Keiner guckt."],
  ko:["Gute Nacht, Arschloch.","Das war für Donny.","Hättest mal Yoga gemacht.","Bleib liegen, Champ.","F*ck yeah.","Sh*t, mein Knöchel. Egal."],
  hurt:["F*ck!","Sh*t, sh*t, sh*t!","Scheiße!","Aah – f*ck!","Alter, was soll die Scheiße?!"],
  crash:["F*ck!","Sh*t – die Karre!","Wer hat die Wand da hingestellt?!","Ups. Scheiße."] };
let barkT=0;
function jjSay(txt,dur){ jj.say={txt,t:dur||Math.min(4.5,1.6+txt.length*.045)}; }
function bark(k,ch){ if (barkT>0||rnd()>(ch==null?1:ch)) return; const a=BARKS[k]; jjSay(a[Math.floor(rnd()*a.length)]); barkT=6; }
function drawSay(q,x,y,txt){ txt=tr(txt); q.font='600 11px "Barlow Semi Condensed",sans-serif'; const w=Math.min(230,q.measureText(txt).width+14), lines=[]; let cur="";
  for (const word of txt.split(" ")){ const t2=cur?cur+" "+word:word; if (q.measureText(t2).width>w-14&&cur){ lines.push(cur); cur=word; } else cur=t2; } lines.push(cur);
  const bw=Math.max(...lines.map(l=>q.measureText(l).width))+14, bh=lines.length*13+8, bx=x-bw/2, by=y-bh-8;
  q.fillStyle="rgba(250,246,238,.96)"; rr(q,bx,by,bw,bh,6); q.fill(); q.beginPath(); q.moveTo(x-5,by+bh); q.lineTo(x,by+bh+6); q.lineTo(x+5,by+bh); q.fill();
  q.fillStyle="#1b1720"; q.textAlign="center"; q.textBaseline="top"; lines.forEach((l,i)=>q.fillText(l,x,by+5+i*13)); }
function nearestVehicle(){ let best=null, bd=1e9; for (const v of vehicles){ if (v.wreck||v.gone||v.sinking||v.noBoard) continue; if (v.onRoof?Math.abs(v.onRoof.H-jj.h)>20:(v.z>.15||jj.h>0)) continue; if (v.priv&&v.mode!=="wait") continue; if (v.burn>0) continue;
    const [lx,ly]=local(v,jj.x,jj.y), hl=v.t.kind==="heli"?34:v.t.l/2, hw=v.t.kind==="heli"?14:v.t.w/2, d=Math.hypot(Math.max(0,Math.abs(lx)-hl),Math.max(0,Math.abs(ly)-hw)); if (d<(v.t.kind==="boat"?42:30)&&d<bd){ bd=d; best=v; } }
  if (best&&best.type==="tank") return null; if (best&&best.t.kind==="heli"&&!best.priv&&!best.mission&&!UNLOCK.heli) return null; return best; }
function talkTarget(){ if (MI&&MI.talk&&!jj.dead&&!paused&&started&&!DLG&&MI.talk.ok()) return {k:"mtalk"}; if (jj.veh||jj.dead||jj.h||jj.glide||paused||!started) return null; const near=(x,y,r)=>Math.hypot(jj.x-x,jj.y-y)<(r||60);
  if (MI&&MI.def.id==="m1"){ const c=MI.d.car; if (MI.step===0&&!MI.d.asked&&c&&c.driver&&!c.gone&&near(c.x,c.y,70)) return {k:"taxi"}; if (MI.step===2&&near(EARL.x,EARL.y)) return {k:"earl"}; return null; }
  if (!MI&&MS.done.m1){ const d=nextDef(); if (d&&d.giver) for (const g of giverSpots(d)) if (near(g.x,g.y)) return {k:"giver",d,n:g.n}; }
  return null; }
function doTalk(t){ if (t.k==="mtalk"){ const f=MI.talk.fn; MI.talk=null; f(); return; } if (t.k==="taxi") MI.def.talkTaxi(MI); else if (t.k==="earl") MI.def.talkEarl(MI); else if (t.k==="giver"){ gps=null; startMission(t.d); } }
// Türen: erst E drücken, dann reingehen
function doorTarget(){ if (jj.veh||jj.dead||jj.h||jj.glide||paused||!started) return null; const d=(p,yo)=>Math.hypot(jj.x-p.x,jj.y-(p.y+(yo||0)));
  const hot=WANT.lv>0, cool=()=>toast("Erst die Cops abhängen!");
  { const kg=knockTarget(); if (kg) return {lbl:L2("AUSSCHALTEN","TAKE DOWN"),fn:()=>knockOut(kg)}; }
  if (MI&&MI.def.door){ const r=MI.def.door(MI,d); if (r) return r; }
  if (CURROOM===RBANK){ for (const yy of [453,543]) if (Math.hypot(jj.x-(RBANK.r.x+1330),jj.y-(RBANK.r.y+yy))<34) return {lbl:L2("GELDAUTOMAT","ATM"),fn:()=>{ openPhone(); phoneView.screen="bank"; renderPhone(); }}; }
  if (!CURROOM&&d(BANKDOOR)<40&&BANK_OPEN()) return {lbl:L2("BANK BETRETEN","ENTER BANK"),fn:hot?cool:()=>enterRoom("bank",{x:700,y:840,a:Math.PI})};
  if (!CURROOM&&d(MUSDOOR)<40&&!(MI&&MI.def.id==="m11")) return {lbl:L2("MUSEUM BETRETEN","ENTER MUSEUM"),fn:hot?cool:()=>enterRoom("museum",{x:800,y:640,a:Math.PI})};
  if (d(SHOP)<36&&armsOpen()) return {lbl:"LADEN BETRETEN",fn:hot?cool:enterShopIn};
  if (d(RICO)<44&&ricoOpen()) return {lbl:"RICO'S BETRETEN",fn:hot?cool:()=>openRico("c")};
  if (d(CLO)<40&&clothesOpen()) return {lbl:L2("DRIP STORE BETRETEN","ENTER DRIP STORE"),fn:hot?cool:()=>openRico("o")};
  if (d(DOOR,-4)<34&&!(MI&&MI.def.id==="m1"&&MI.step<2)) return {lbl:"HAUS BETRETEN",fn:hot?cool:enterHomeIn};
  if (JAIL.open&&d(JDOOR)<36) return {lbl:"REINGEHEN",fn:enterJailIn};
  { const h=WANT.heli; if (h&&h.rope&&h.rope.t>1&&!h.rope.up&&!CLIMB&&Math.hypot(jj.x-h.rope.x,jj.y-h.rope.y)<46) return {lbl:"SEIL HOCHKLETTERN",fn:startClimb}; }
  if (!CRIDE&&!GOLF&&Math.hypot(jj.x-CST.sx,jj.y-CST.sy)<70) return {lbl:"ACHTERBAHN FAHREN · $10",fn:hot?cool:startCoaster};
  if (!CRIDE&&!GOLF&&(Math.hypot(jj.x-5220,jj.y-5325)<60||Math.hypot(jj.x-GH[0].tee[0],jj.y-GH[0].tee[1])<60)) return {lbl:"GOLF SPIELEN · $25",fn:hot?cool:startGolf};
  { const pn=planeNear(); if (pn) return UNLOCK.plane?{lbl:"FLUGZEUG FLIEGEN",fn:()=>boardPlane(pn)}:{lbl:"🔒 FLIEGEN",fn:planeLocked}; }
  if (MI&&MI.def.id==="m6"&&MI.step===4&&MI.d.door&&d(MI.d.door)<46) return {lbl:"VILLA BETRETEN",fn:()=>{ MI.d.goIn=true; }};
  return null; }
function enterExit(){ if (CRIDE||GOLF) return; if (SHOPIN){ if (onShopSpot()) openShop(); return; } if (!jj.veh&&boardRide()) return; if (!FLY&&!jj.veh&&lakeSwim()){ toggleDive(); return; } if (FLY){ if (FLY.h<=0&&Math.abs(FLY.v)<40) leavePlane(false); else toast("Erst landen und anhalten!"); return; } if (CINE){ if (CINE.ready) finishArrival(); return; } if (jj.dead||jj.lock||jj.glide) return; { const tt=talkTarget(); if (tt){ doTalk(tt); return; } } { const dg=doorTarget(); if (dg){ dg.fn(); return; } }  if (!jj.veh&&nearShop){ openShop(); return; } if (jj.veh){ const v=jj.veh;
    if (v.t.kind==="heli"&&v.z>0&&!v.onRoof){ if (v.priv&&v.auto) { toast("Mo fliegt gerade"); return; } const rb=bAt(v.x,v.y,24);
      if (rb){ v.landZ=rb.H/240; v.roofB=rb; v.landing=true; toast("Landen auf dem Dach …"); } else if (spotOK(v.x,v.y,40)){ v.landZ=0; v.roofB=null; v.landing=true; toast("Landen …"); } else toast("Hier kannst du nicht landen"); return; }
    exitVeh(); return; }
  const v=nearestVehicle(); if (!v) return; if (v.type==="earlmoto"&&MS.done.m6){ jjSay(L2("Die gehört Onkel Bobby. Ich brauch was Eigenes.","That one is Uncle Bobby's. I need my own."),2.6); return; }
  if (v.t.kind==="car"||(v.t.kind==="moto"&&v.driver)){ startJack(v); return; }
  getIn(v); }
// ---------- Auto klauen: hinlaufen → Tür auf → Fahrer packen & rauswerfen → einsteigen → Tür zu
let JACK=null;
const vLocal=(v,lx,ly)=>{ const c=Math.cos(v.a), s=Math.sin(v.a); return [v.x+c*lx-s*ly, v.y+s*lx+c*ly]; };
function startJack(v){ wantOnJack(v); const w=v.t.w/2, l=v.t.l; let side=-1;            // Fahrerseite = lokal -y
  const st=vLocal(v,-l*.02,side*(w+11)); if (blockedAt(st[0],st[1],7)){ const o=vLocal(v,-l*.02,(w+11)); if (!blockedAt(o[0],o[1],7)) side=1; }
  JACK={v,side,ph:"walk",t:0,door:v.t.kind==="car",drv:v.driver,ped:null}; jj.lock=99; v.v*=.2; }
function endJack(){ JACK=null; jj.lock=0; }
function updateJack(dt){ const J=JACK, v=J.v; if (!v||v.wreck||v.gone||jj.dead){ if (J.ped) J.ped.ctl=false; endJack(); return; } J.t+=dt;
  const w=v.t.w/2, l=v.t.l, sd=J.side, stand=vLocal(v,-l*.02,sd*(w+11)), face=()=>{ const fx=v.x-jj.x, fy=v.y-jj.y, L=Math.hypot(fx,fy)||1; jj.ang=Math.atan2(-fx/L,fy/L); };
  if (J.ph==="walk"){ const dx=stand[0]-jj.x, dy=stand[1]-jj.y, d=Math.hypot(dx,dy);
    if (d<3||J.t>.8){ if (d<40) { jj.x=stand[0]; jj.y=stand[1]; } jj.moving=false; face(); if (J.door&&!J.drv&&needsPick(v)){ J.ph="pick"; J.t=0; openPick(v); return; } J.ph=J.door?"open":(J.drv?"grab":"enter"); J.t=0; if (J.door) sfx("door"); return; }
    const sp=Math.min(d,200*dt); jj.x+=dx/d*sp; jj.y+=dy/d*sp; jj.moving=true; jj.run=true; jj.step+=dt*19; jj.ang=Math.atan2(-dx/d,dy/d); return; }
  if (J.ph==="pick"){ face(); jj.moving=false; if (!PICK){ if (v.unlocked){ J.ph="open"; J.t=0; sfx("door"); } else { if (J.ped) J.ped.ctl=false; endJack(); } } return; }
  if (J.ph==="open"){ v.door=Math.min(1,J.t/.3); v.doorSide=sd; v.doorClosing=false; if (J.t>=.3){ J.ph=J.drv?"grab":"enter"; J.t=0; } return; }
  if (J.ph==="grab"){                                     // Fahrer am Kragen packen und aus dem Sitz ziehen
    if (!J.ped){ v.driver=false; const L=LOOKS[Math.floor(rnd()*LOOKS.length)], seat=vLocal(v,l*.02,sd*w*.2);
      J.ped={x:seat[0],y:seat[1],ang:v.a+Math.PI/2*(sd<0?1:-1),step:0,moving:false,run:true,look:L,t:0,stun:0,ctl:true,flip:null,say:v.type==="taxi"?"Das ist MEIN Taxi!!":["Mein Auto, du Penner!","Ich ruf die Bullen, Arschloch!","Verdammte Scheiße, nicht schon wieder!","Das ist ein Leasingwagen!!","Lass los, du Wichser!"][Math.floor(rnd()*5)],sayT:1.9,jackBark:true};
      peds.push(J.ped); W.atkAt=performance.now(); W.side=1; W.swing=.28; sfx("swing"); }
    const k=Math.min(1,J.t/.42), a=vLocal(v,l*.02,sd*w*.2), b=vLocal(v,l*.02,sd*(w+4)), e=k*k*(3-2*k);
    J.ped.x=a[0]+(b[0]-a[0])*e; J.ped.y=a[1]+(b[1]-a[1])*e; J.ped.ang=Math.atan2(-(jj.x-J.ped.x),jj.y-J.ped.y);
    const back=vLocal(v,-l*.02,sd*(w+11+k*6)); jj.x=back[0]; jj.y=back[1]; face();
    if (J.t>=.42){ J.ph="throw"; J.t=0; const p=J.ped, out=vLocal(v,-l*.16,sd*(w+44)); p.fx0=p.x; p.fy0=p.y; p.fx1=out[0]; p.fy1=out[1]; if (blockedAt(p.fx1,p.fy1,8)){ const q2=landNear(p.fx1,p.fy1); p.fx1=q2.x; p.fy1=q2.y; }
      W.atkAt=performance.now(); W.side=-1; W.swing=.28; sfx("hit"); shake=Math.max(shake,3); } return; }
  if (J.ph==="throw"){                                    // rauswerfen: Bogen, Drehung, landet auf dem Boden
    const p=J.ped, k=Math.min(1,J.t/.45); p.x=p.fx0+(p.fx1-p.fx0)*k; p.y=p.fy0+(p.fy1-p.fy0)*k; p.hop=Math.sin(k*Math.PI)*14; p.flip=k*1.45*(sd<0?-1:1);
    if (J.t>=.45){ p.hop=0; p.down=1.1; p.ctl=false; p.jacked=1; p.t=0; sfx("crash"); J.ph="enter"; J.t=0; } return; }
  if (J.ph==="enter"){ const seat=vLocal(v,l*.02,sd*w*.2), k=Math.min(1,J.t/.28); jj.x=stand[0]+(seat[0]-stand[0])*k; jj.y=stand[1]+(seat[1]-stand[1])*k; jj.moving=false;
    if (J.t>=.28){ endJack(); getIn(v); if (v.door>0) v.doorClosing=true; if (!J.drv) bark("free",.35); } } }
function getIn(v){ v.unlocked=true; if (WANT.lv>0&&WANT.lastVeh&&v!==WANT.lastVeh&&v.type!=="police"&&v.t.kind!=="heli") trick("car",LANG==="en"?"Switched cars":"Auto gewechselt"); if (v.type==="earlmoto"){ jjSay("Oh … die gehört Onkel Bobby. Da pass ich lieber drauf auf."); barkT=6; } jj.h=0; jj.roof=null; jj.glide=null; jj.veh=v; v.v=v.v||0; sfx("door"); if (v.type==="police") v.lights=true; if (v.t.kind==="heli"){ v.spin=true; v.landing=false; v.vx=0; v.vy=0; if (v.priv&&v.mode==="wait") boardPriv(v); } hudDirty=true; }
function exitVeh(force){ const v=jj.veh; if (!v) return; const c=Math.cos(v.a), s=Math.sin(v.a), off=v.t.w/2+14;
  const cands=[[s*off,-c*off],[-s*off,c*off],[-c*(v.t.l/2+14),-s*(v.t.l/2+14)],[c*(v.t.l/2+14),s*(v.t.l/2+14)]];
  let ok=null; if (v.onRoof){ const b=v.onRoof; for (const [dx,dy] of [...cands,[s*40,-c*40],[-s*40,c*40]]){ const x=v.x+dx, y=v.y+dy; if (x>b.x+8&&x<b.x+b.w-8&&y>b.y+8&&y<b.y+b.h-8){ ok=[x,y]; break; } } if (!ok) ok=[b.x+12,b.y+12]; jj.h=b.H; jj.roof=b; }
  else { jj.h=0; jj.roof=null; for (const [dx,dy] of cands){ const x=v.x+dx, y=v.y+dy; if (!blockedAt(x,y,9,v)){ ok=[x,y]; break; } } }
  if (!ok){ if (!force&&v.t.kind!=="boat"){ toast("Kein Platz zum Aussteigen"); return; } const p=landNear(v.x,v.y); ok=[p.x,p.y]; }
  jj.veh=null; jj.x=ok[0]; jj.y=ok[1]; jj.ang=v.a-Math.PI/2; v.lights=false; sfx("door"); showDest(false);
  if (v.t.kind==="heli"){ v.spin=v.z>0; if (v.priv&&v.mode==="self"){ v.mode="wait"; v.wait=5; } }
  hudDirty=true; }
function landNear(x,y){ for (let r=20;r<900;r+=16) for (let a=0;a<6.28;a+=.3){ const px=x+Math.cos(a)*r, py=y+Math.sin(a)*r; if (!blockedAt(px,py,9)) return {x:px,y:py}; } return {x:DOOR.x,y:DOOR.y+30}; }
function startCling(p,car){ p.cling=car; p.clT=0; p.la=car.a; p.lv=car.v; p.say="MEIN TAXI!!"; p.sayT=2.4; p.jackBark=false; p.ctl=false; p.down=0; p.flip=null; p.stun=0; }
function updateCling(p,dt){ const car=p.cling; p.clT+=dt; const a=car.a, back=car.t.l/2+8, wob=Math.sin(p.clT*9)*4;
  p.x=car.x-Math.cos(a)*back-Math.sin(a)*wob; p.y=car.y-Math.sin(a)*back+Math.cos(a)*wob; p.ang=Math.atan2(-Math.cos(a),Math.sin(a)); p.moving=Math.abs(car.v)>20; p.step+=dt*(8+Math.abs(car.v)*.06);
  if (Math.abs(car.v)>60&&rnd()<dt*14) emit("dust",p.x,p.y,{size:8,grow:22,life:.5,max:.5,a:.35});
  if (p.clT>2.6&&!p.l2){ p.l2=1; p.say="Ich hab noch DREI Raten offen!!"; p.sayT=2.4; } if (p.clT>5.6&&!p.l3){ p.l3=1; p.say="Halt an, du Bastard!"; p.sayT=2.2; }
  let da=a-p.la; da=Math.atan2(Math.sin(da),Math.cos(da)); const turn=Math.abs(da)/Math.max(dt,1e-3), brake=(p.lv-car.v)/Math.max(dt,1e-3); p.la=a; p.lv=car.v;
  if ((Math.abs(car.v)>80&&turn>1.5&&p.clT>1)||(brake>500&&p.clT>.8)||p.clT>10||jj.veh!==car||car.wreck){ p.cling=null; const sd=da>=0?-1:1, sp=Math.max(80,Math.abs(car.v)*.55);
    p.vx=-Math.cos(a)*sp*.4+(-Math.sin(a))*sd*sp; p.vy=-Math.sin(a)*sp*.4+Math.cos(a)*sd*sp; p.down=1.7; p.flip=1.4*sd; p.t=0; sfx("hit"); p.say=""; p.sayT=0; p.after=1;
    if (jj.veh===car) setTimeout(()=>{ jjSay("Sorry, Bro! Ich bring's zurück … vielleicht.",3); barkT=4; },500); } }
function updatePeds(dt){ for (let i=peds.length-1;i>=0;i--){ const p=peds[i]; if (p.sayT>0){ p.sayT-=dt; if (p.sayT<=0&&p.jackBark){ p.jackBark=false; barkT=0; bark("jack"); } } if (p.cling){ updateCling(p,dt); continue; } if (p.ctl) continue; p.t+=dt;
    if (p.down>0){ p.down-=dt; p.moving=false; if (p.vx){ const nx=p.x+p.vx*dt, ny=p.y+p.vy*dt; if (!blockedAt(nx,ny,8)){ p.x=nx; p.y=ny; } p.vx*=Math.pow(.08,dt); p.vy*=Math.pow(.08,dt); p.flip+=(p.flip>0?1:-1)*dt*5*Math.min(1,Math.hypot(p.vx,p.vy)/80); if (p.down<=0&&p.after){ p.after=0; p.vx=0; p.vy=0; p.say="Fick dich, Rizz-Boy! 🖕"; p.sayT=3; } } if (p.down<=0){ p.flip=null; p.t=0; p.stun=.15; if (p.jacked){ const sn=nearestSW(p.x,p.y); npcs.push({x:p.x,y:p.y,sw:sn.i>=0&&sn.d<200?sn.i:null,dir:1,tx:null,ang:p.ang,step:0,moving:false,run:true,look:p.look,sp:60,panic:5,from:{x:jj.x,y:jj.y},dead:false,deadT:0,wob:0,pause:.6,say:p.say,sayT:Math.max(1.6,p.sayT||0)}); peds.splice(i,1); } } continue; }
    if (p.stun>0){ p.stun-=dt; p.moving=false; continue; }
    const a=Math.atan2(p.y-jj.y,p.x-jj.x)+Math.sin(p.t*2)*.3, sp=160*dt; const nx=p.x+Math.cos(a)*sp, ny=p.y+Math.sin(a)*sp;
    if (!blockedAt(nx,p.y,8)) p.x=nx; if (!blockedAt(p.x,ny,8)) p.y=ny; p.ang=a-Math.PI/2; p.moving=true; p.step+=dt*16; if (p.t>6) peds.splice(i,1); } }

