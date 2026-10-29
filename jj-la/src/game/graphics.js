// ================= SPRITES =================
function frondSprite(variant){ return mk(170,170,q=>{ q.translate(85,85); const n=11+variant;
  for (let pass=0;pass<2;pass++) for (let i=0;i<n;i++){ const a=i/n*Math.PI*2+variant*.4+(pass?.15:0), L=(pass?62:76)+(i%3)*4;
    q.save(); q.rotate(a); const gr=q.createLinearGradient(0,0,L,0); gr.addColorStop(0,pass?"#3f8a35":"#24561f"); gr.addColorStop(.6,pass?"#6db04a":"#3b7a2c"); gr.addColorStop(1,pass?"#9fcf63":"#4d8a36"); q.fillStyle=gr;
    q.beginPath(); q.moveTo(0,0); q.quadraticCurveTo(L*.5,-L*.22,L,-L*.06); q.quadraticCurveTo(L*.5,L*.1,0,0); q.fill();
    q.strokeStyle=pass?"rgba(220,240,160,.35)":"rgba(10,30,10,.5)"; q.lineWidth=1; for (let s=.18;s<.95;s+=.08){ const x=L*s, y=-L*.14*Math.sin(s*Math.PI)+(-L*.06*s); q.beginPath(); q.moveTo(x,y); q.lineTo(x+6,y-7); q.moveTo(x,y); q.lineTo(x+6,y+5); q.stroke(); }
    q.restore(); }
  const gr=q.createRadialGradient(-3,-3,1,0,0,9); gr.addColorStop(0,"#a57a48"); gr.addColorStop(1,"#5a3c22"); q.fillStyle=gr; q.beginPath(); q.arc(0,0,8,0,7); q.fill(); }); }
const FRONDS=[frondSprite(0),frondSprite(1),frondSprite(2)];
// gemalte Fahrzeuge + Palmen (Higgsfield)
const VEHM={"sedan":[0,0,230,122],"sports":[232,0,230,125],"suv":[464,0,230,111],"pickup":[696,0,230,118],"taxi":[0,127,230,107],"police":[232,127,230,109],"racer":[464,127,230,118],"moto":[696,127,170,90],"earlmoto":[0,247,170,94],"boat":[172,247,230,96],"jetski":[404,247,170,84],"heli":[576,247,230,88],"palm0":[808,247,162,170],"palm1":[0,419,152,170],"palm2":[154,419,158,170]}, VTINT={sedan:1,sports:1,suv:1,pickup:1,racer:1};
if (window.ASSETS&&ASSETS.veh) for (let i=0;i<3;i++){ const r=VEHM["palm"+i]; FRONDS[i]=mk(170,170,q=>q.drawImage(ASSETS.veh,r[0],r[1],r[2],r[3],(170-r[2])/2,(170-r[3])/2,r[2],r[3])); }
function paintedCar(type,col,wreck){ const t=VT[type], S=2, l=t.l, w=t.w, pad=type==="heli"?40:6, r=VEHM[type];
  return mk((l+pad*2)*S,(w+pad*2)*S,q=>{ q.scale(S,S); q.translate(l/2+pad,w/2+pad);
    const keep=type==="moto"||type==="earlmoto"||type==="jetski"||type==="boat"||type==="heli", L=keep?l*(type==="heli"?1.15:1.1):l*1.06, Wd=keep?L*r[3]/r[2]:w*1.12;
    const c=mk(Math.ceil(L*S),Math.ceil(Wd*S),z=>{ const W2=L*S, H2=Wd*S; z.drawImage(ASSETS.veh,r[0],r[1],r[2],r[3],0,0,W2,H2);
      if (VTINT[type]&&col){ z.globalCompositeOperation="multiply"; z.fillStyle=col; z.fillRect(0,0,W2,H2); z.globalCompositeOperation="destination-in"; z.drawImage(ASSETS.veh,r[0],r[1],r[2],r[3],0,0,W2,H2); }
      if (wreck){ z.globalCompositeOperation="source-atop"; z.fillStyle="rgba(22,18,16,.8)"; z.fillRect(0,0,W2,H2); } });
    q.drawImage(c,-L/2,-Wd/2,L,Wd); }); }
function canopySprite(kind,v){ return mk(140,140,q=>{ q.translate(70,70); const base=kind==="jacaranda"?["#5e3f8f","#8b6cc7","#c3a9f0"]:["#2c5a24","#4d8a37","#8bc25a"];
  const blobs=[]; for (let i=0;i<14+v*2;i++){ const a=rnd()*6.28, r=rnd()*34; blobs.push([Math.cos(a)*r,Math.sin(a)*r,16+rnd()*14]); }
  for (const [x,y,s] of blobs){ q.fillStyle=base[0]; q.beginPath(); q.arc(x+4,y+4,s,0,7); q.fill(); }
  for (const [x,y,s] of blobs){ const gr=q.createRadialGradient(x-s*.45,y-s*.45,1,x,y,s); gr.addColorStop(0,base[2]); gr.addColorStop(.55,base[1]); gr.addColorStop(1,base[0]); q.fillStyle=gr; q.beginPath(); q.arc(x,y,s,0,7); q.fill(); }
  if (kind==="jacaranda") for (let i=0;i<60;i++){ q.fillStyle="rgba(230,210,255,.7)"; q.fillRect(rnd()*90-45,rnd()*90-45,2,2); } }); }
const CANOPY={oak:[0,1,2,3].map(v=>canopySprite("oak",v)),jacaranda:[0,1,2,3].map(v=>canopySprite("jacaranda",v))};

// ================= BUILDING TEXTURES (cached) =================
function facade(b,len){ const floors=Math.max(1,Math.round(b.H/26)), fh=b.style==="house"?40:14, H=Math.max(20,floors*fh), W=Math.max(8,len);
  return mk(W,H,q=>{ const s=b.style, c=b.col;
    if (s==="glass"||s==="crown"){ const gr=q.createLinearGradient(0,0,W*.3,H); gr.addColorStop(0,mix(c,"#cfe6f5",.55)); gr.addColorStop(.45,shade(c,1.05)); gr.addColorStop(1,shade(c,.62)); q.fillStyle=gr; q.fillRect(0,0,W,H);
      q.fillStyle="rgba(255,240,210,.18)"; q.beginPath(); q.moveTo(W*.15,0); q.lineTo(W*.32,0); q.lineTo(W*.12,H); q.lineTo(W*-.05,H); q.fill();
      q.fillStyle="rgba(255,255,255,.08)"; q.beginPath(); q.moveTo(W*.55,0); q.lineTo(W*.6,0); q.lineTo(W*.45,H); q.lineTo(W*.4,H); q.fill();
      q.strokeStyle="rgba(15,30,50,.45)"; q.lineWidth=1; for (let x=s==="crown"?6:10;x<W;x+=s==="crown"?12:16){ q.beginPath(); q.moveTo(x+.5,0); q.lineTo(x+.5,H); q.stroke(); }
      q.fillStyle="rgba(210,230,245,.22)"; for (let y=fh;y<H;y+=fh) q.fillRect(0,y,W,1.5);
      if (s==="crown"){ q.fillStyle="rgba(20,30,40,.35)"; for (let x=0;x<W;x+=24) q.fillRect(x,0,3,H); } }
    else if (s==="stone"){ q.fillStyle=c; q.fillRect(0,0,W,H); for (let y=0;y<H;y+=fh) for (let x=6;x<W-6;x+=14){ q.fillStyle="#24313d"; q.fillRect(x,y+3,8,8); q.fillStyle="rgba(170,200,225,.35)"; q.fillRect(x,y+3,8,3); q.fillStyle="rgba(255,240,220,.25)"; q.fillRect(x-1,y+11,10,1.5); }
      q.fillStyle="rgba(0,0,0,.08)"; for (let x=0;x<W;x+=28) q.fillRect(x,0,3,H); q.fillStyle=shade(c,.8); q.fillRect(0,0,W,5); }
    else if (s==="warehouse"){ q.fillStyle=shade(c,.86); q.fillRect(0,0,W,H); q.fillStyle="rgba(0,0,0,.12)"; for (let x=0;x<W;x+=5) q.fillRect(x,0,2,H); q.fillStyle="rgba(255,255,255,.08)"; for (let x=2;x<W;x+=5) q.fillRect(x,0,1,H);
      for (let x=20;x+44<W;x+=96){ q.fillStyle="#5f6468"; q.fillRect(x,H*.25,44,H*.75); q.fillStyle="rgba(0,0,0,.25)"; for (let y=H*.25;y<H;y+=4) q.fillRect(x,y,44,1); q.fillStyle="#e8c34a"; q.fillRect(x-3,H*.25-3,50,3); }
      q.fillStyle=shade(c,.6); q.fillRect(0,0,W,4); }
    else if (s==="slab"){ q.fillStyle=c; q.fillRect(0,0,W,H); for (let y=0;y<H;y+=fh){ const gr=q.createLinearGradient(0,y+3,0,y+11); gr.addColorStop(0,"#5b7186"); gr.addColorStop(1,"#22303c"); q.fillStyle=gr; q.fillRect(0,y+4,W,7); q.fillStyle="rgba(255,255,255,.12)"; q.fillRect(0,y+11,W,1); }
      q.fillStyle="rgba(0,0,0,.18)"; for (let x=0;x<W;x+=40) q.fillRect(x,0,2,H); }
    else if (s==="terminal"&&b.tunnels&&len===b.w){ const gr=q.createLinearGradient(0,0,0,H); gr.addColorStop(0,"#9bc7e0"); gr.addColorStop(1,"#3f6f92"); q.fillStyle=gr; q.fillRect(0,0,W,H); q.strokeStyle="rgba(255,255,255,.45)"; for (let x=0;x<W;x+=18){ q.beginPath(); q.moveTo(x+.5,0); q.lineTo(x+.5,H); q.stroke(); } q.fillStyle="#efeae0"; q.fillRect(0,0,W,6);
      for (const tx of b.tunnels){ q.fillStyle="#d9d4ca"; q.fillRect(tx-6,0,112,H); q.fillStyle="#141218"; q.beginPath(); q.moveTo(tx,H); q.lineTo(tx,H*.42); q.quadraticCurveTo(tx+50,H*.05,tx+100,H*.42); q.lineTo(tx+100,H); q.closePath(); q.fill(); q.fillStyle="#ffcf3f"; q.fillRect(tx+40,H*.18,20,3); } }
    else if (s==="terminal"){ const gr=q.createLinearGradient(0,0,0,H); gr.addColorStop(0,"#9bc7e0"); gr.addColorStop(1,"#3f6f92"); q.fillStyle=gr; q.fillRect(0,0,W,H); q.strokeStyle="rgba(255,255,255,.45)"; for (let x=0;x<W;x+=18){ q.beginPath(); q.moveTo(x+.5,0); q.lineTo(x+.5,H); q.stroke(); } q.fillStyle="#efeae0"; q.fillRect(0,0,W,6); }
    else if (s==="ctower"){ q.fillStyle="#cfd5da"; q.fillRect(0,0,W,H); q.fillStyle="#2f5f86"; q.fillRect(0,0,W,16); q.fillStyle="rgba(255,255,255,.4)"; q.fillRect(0,2,W,3); q.fillStyle="rgba(0,0,0,.08)"; for (let x=0;x<W;x+=10) q.fillRect(x,16,1,H); }
    else if (s==="villa"){ q.fillStyle=c; q.fillRect(0,0,W,H); q.fillStyle="#b9552f"; q.fillRect(0,0,W,4); q.fillStyle="rgba(0,0,0,.06)"; for (let y=6;y<H;y+=4) q.fillRect(0,y,W,1);
      for (let x=10;x<W-14;x+=24){ q.fillStyle="#f8f2e6"; q.beginPath(); q.moveTo(x-2,H*.9); q.lineTo(x-2,H*.42); q.arc(x+6,H*.42,8,Math.PI,0); q.lineTo(x+14,H*.9); q.closePath(); q.fill(); q.fillStyle="#26394d"; q.beginPath(); q.moveTo(x,H*.86); q.lineTo(x,H*.44); q.arc(x+6,H*.44,6,Math.PI,0); q.lineTo(x+12,H*.86); q.closePath(); q.fill(); q.fillStyle="rgba(180,215,240,.35)"; q.fillRect(x,H*.44,12,3); } }
    else if (s==="modern"){ q.fillStyle=c; q.fillRect(0,0,W,H); const gr=q.createLinearGradient(0,0,W*.4,H); gr.addColorStop(0,"#9cc7df"); gr.addColorStop(1,"#29485e"); q.fillStyle=gr; q.fillRect(6,H*.18,W-12,H*.3); q.fillRect(W*.25,H*.6,W*.7,H*.32);
      q.fillStyle="rgba(255,255,255,.5)"; for (let x=6;x<W-6;x+=22) q.fillRect(x,H*.18,1.4,H*.3); for (let x=W*.25;x<W*.95;x+=22) q.fillRect(x,H*.6,1.4,H*.32); q.fillStyle="#d9d8d2"; q.fillRect(0,H*.5,W,3); }
    else if (s==="shop"){ q.fillStyle=c; q.fillRect(0,0,W,H); q.fillStyle="#b3232b"; q.fillRect(0,0,W,H*.32); q.fillStyle="#f3efe6"; q.font='700 '+Math.max(7,Math.round(H*.24))+'px sans-serif'; q.textAlign="center"; q.textBaseline="middle"; for (let x=W*.25;x<W;x+=W*.5) q.fillText("LA ARMS",x,H*.17);
      q.fillStyle="#1d2733"; for (let x=8;x<W-8;x+=26){ q.fillRect(x,H*.42,18,H*.5); q.fillStyle="rgba(170,200,230,.35)"; q.fillRect(x,H*.42,18,H*.12); q.fillStyle="#1d2733"; } }
    else if (s==="venue"){ q.fillStyle=shade(c,.9); q.fillRect(0,0,W,H); q.fillStyle=b.neon; q.fillRect(0,1,W,3); q.globalAlpha=.3; q.fillRect(0,0,W,9); q.globalAlpha=1;
      for (let x=10;x<W-16;x+=30){ q.fillStyle="#141018"; q.fillRect(x,H*.38,18,H*.5); q.fillStyle=b.neon; q.globalAlpha=.28; q.fillRect(x,H*.38,18,H*.14); q.globalAlpha=1; } }
    else if (s==="truck"){ q.fillStyle=c; q.fillRect(0,0,W,H); q.fillStyle="rgba(255,255,255,.85)"; q.fillRect(0,0,W,2); if (W>60){ q.fillStyle="#1b1c21"; q.fillRect(W*.2,H*.3,W*.5,H*.4); for (let x=W*.18;x<W*.72;x+=8){ q.fillStyle=(Math.floor(x/8)%2)?"#ffffff":shade(c,.7); q.fillRect(x,H*.1,8,H*.2); } q.fillStyle="#fff"; q.font='700 '+Math.max(6,Math.round(H*.28))+'px sans-serif'; q.textAlign="center"; q.textBaseline="middle"; q.fillText(b.sign,W/2,H*.86,W*.9); }
      q.fillStyle="#1a1a1c"; for (const x of [W*.18,W*.8]){ q.beginPath(); q.arc(x,H,H*.22,Math.PI,0); q.fill(); } }
    else if (s==="pwall"){ q.fillStyle="#a9a49a"; q.fillRect(0,0,W,H); q.fillStyle="rgba(0,0,0,.12)"; for (let x=0;x<W;x+=30) q.fillRect(x,0,2,H); q.fillStyle="rgba(70,60,50,.18)"; for (let x=8;x<W;x+=47) q.fillRect(x,H*.2,3,H*.7); q.fillStyle="#7e7a72"; q.fillRect(0,0,W,4); }
    else if (s==="pgate"){ q.fillStyle="#3a3f46"; q.fillRect(0,0,W,H); q.fillStyle="#5c636c"; for (let x=4;x<W;x+=9) q.fillRect(x,0,3,H); q.fillStyle="#e8c34a"; q.fillRect(0,0,W,4); if (W>60){ q.fillStyle="#141518"; q.fillRect(W*.15,H*.25,W*.7,H*.3); q.fillStyle="#e8c34a"; q.font='400 '+Math.round(H*.26)+'px "Bebas Neue",Impact,sans-serif'; q.textAlign="center"; q.textBaseline="middle"; q.fillText("COUNTY JAIL",W/2,H*.41,W*.66); } }
    else if (s==="gtower"){ q.fillStyle="#8f8a80"; q.fillRect(0,0,W,H); q.fillStyle="#1d2733"; q.fillRect(0,4,W,H*.14); q.fillStyle="rgba(160,200,230,.35)"; q.fillRect(0,4,W,H*.05); q.fillStyle="rgba(0,0,0,.12)"; for (let x=0;x<W;x+=8) q.fillRect(x,H*.2,1,H); }
    else if (s==="prison"){ q.fillStyle=c; q.fillRect(0,0,W,H); for (let y=6;y<H-6;y+=fh) for (let x=8;x<W-8;x+=16){ q.fillStyle="#2a2f36"; q.fillRect(x,y+3,4,9); } q.fillStyle="rgba(0,0,0,.1)"; for (let x=0;x<W;x+=48) q.fillRect(x,0,3,H); q.fillStyle=shade(c,.75); q.fillRect(0,0,W,5); }
    else if (s==="house"){ q.fillStyle=c; q.fillRect(0,0,W,H); q.fillStyle="rgba(0,0,0,.05)"; for (let y=0;y<H;y+=5) q.fillRect(0,y,W,1);
      const win=(x,w)=>{ q.fillStyle="#f6f2ea"; q.fillRect(x-2,H*.25-2,w+4,H*.45+4); q.fillStyle="#2e4357"; q.fillRect(x,H*.25,w,H*.45); q.fillStyle="rgba(180,215,240,.4)"; q.fillRect(x,H*.25,w,H*.15); q.fillStyle="#f6f2ea"; q.fillRect(x+w/2-1,H*.25,2,H*.45); };
      win(W*.12,W*.16); win(W*.72,W*.16); if (b.front){ q.fillStyle="#5a3a24"; q.fillRect(W/2-11,H*.12,22,H*.88); q.fillStyle="#d8b46a"; q.fillRect(W/2+6,H*.55,3,3); } }
    // weathering + soft ground bounce at the base
    const ao=q.createLinearGradient(0,H*.75,0,H); ao.addColorStop(0,"rgba(0,0,0,0)"); ao.addColorStop(1,"rgba(20,10,20,.35)"); q.fillStyle=ao; q.fillRect(0,0,W,H); }); }
function venueIcon(q,k,x,y,r,col){ q.save(); q.translate(x,y);
  if (k==="disco"){ const gr=q.createRadialGradient(-r*.3,-r*.3,1,0,0,r); gr.addColorStop(0,"#ffffff"); gr.addColorStop(1,"#8a8f99"); q.fillStyle=gr; q.beginPath(); q.arc(0,0,r,0,7); q.fill(); q.strokeStyle="rgba(40,40,60,.45)"; q.lineWidth=1; for (let i=-r;i<=r;i+=r/3){ q.beginPath(); q.moveTo(i,-r); q.lineTo(i,r); q.moveTo(-r,i); q.lineTo(r,i); q.stroke(); } q.fillStyle=col; q.beginPath(); q.arc(r*.5,-r*.5,r*.18,0,7); q.fill(); }
  else if (k==="film"){ q.fillStyle="#2a2a30"; q.beginPath(); q.arc(0,0,r,0,7); q.fill(); q.fillStyle="#d8d8d8"; for (let i=0;i<5;i++){ const a=i/5*6.283; q.beginPath(); q.arc(Math.cos(a)*r*.55,Math.sin(a)*r*.55,r*.2,0,7); q.fill(); } q.fillStyle=col; q.beginPath(); q.arc(0,0,r*.15,0,7); q.fill(); }
  else if (k==="flamingo"){ q.fillStyle="#ff6fb0"; q.beginPath(); q.ellipse(0,r*.25,r*.7,r*.45,-.3,0,7); q.fill(); q.strokeStyle="#ff6fb0"; q.lineWidth=r*.18; q.lineCap="round"; q.beginPath(); q.moveTo(r*.45,0); q.quadraticCurveTo(r*.9,-r*.9,r*.2,-r*.9); q.stroke(); q.fillStyle="#222"; q.beginPath(); q.arc(r*.15,-r*.85,r*.12,0,7); q.fill(); q.strokeStyle="#e0558f"; q.lineWidth=r*.08; q.beginPath(); q.moveTo(-r*.1,r*.6); q.lineTo(-r*.1,r*1.1); q.stroke(); }
  else if (k==="burger"){ q.fillStyle="#d9a04a"; q.beginPath(); q.ellipse(0,-r*.25,r,r*.55,0,Math.PI,0); q.fill(); q.fillStyle="#5aa83a"; q.fillRect(-r,-r*.25,r*2,r*.2); q.fillStyle="#6b3a22"; q.fillRect(-r*.95,-r*.05,r*1.9,r*.3); q.fillStyle="#d9a04a"; rr(q,-r,r*.25,r*2,r*.35,r*.15); q.fill(); }
  else if (k==="pizza"){ q.fillStyle="#f2c14e"; q.beginPath(); q.moveTo(0,r); q.lineTo(-r*.8,-r*.7); q.quadraticCurveTo(0,-r*1.1,r*.8,-r*.7); q.closePath(); q.fill(); q.fillStyle="#c0392b"; for (const [a,b2] of [[-.25,-.4],[.25,-.35],[0,.1]]){ q.beginPath(); q.arc(a*r,b2*r,r*.16,0,7); q.fill(); } }
  else if (k==="sushi"){ q.fillStyle="#1d2a1d"; q.beginPath(); q.arc(0,0,r,0,7); q.fill(); q.fillStyle="#f6f2ea"; q.beginPath(); q.arc(0,0,r*.75,0,7); q.fill(); q.fillStyle="#ff7a4a"; q.beginPath(); q.arc(0,0,r*.38,0,7); q.fill(); }
  else if (k==="fork"){ q.strokeStyle="#e8e2d0"; q.lineWidth=r*.16; q.lineCap="round"; q.beginPath(); q.moveTo(-r*.35,-r); q.lineTo(-r*.35,r); q.moveTo(r*.35,-r); q.quadraticCurveTo(r*.7,-r*.2,r*.35,0); q.lineTo(r*.35,r); q.stroke(); }
  else { q.fillStyle=col; q.beginPath(); for (let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, rr2=i%2?r*.45:r; q.lineTo(Math.cos(a)*rr2,Math.sin(a)*rr2); } q.closePath(); q.fill(); }
  q.restore(); }
function roofTex(b){ const S=1.4; return mk(b.w*S,b.h*S,(q)=>{ q.scale(S,S); const w=b.w,h=b.h,c=b.col, s=b.style;
  const box=(x,y,bw,bh,col,hgt)=>{ q.fillStyle="rgba(20,10,30,.35)"; q.fillRect(x+hgt*.6,y+hgt*.4,bw,bh); q.fillStyle=col; q.fillRect(x,y,bw,bh); q.fillStyle="rgba(255,255,255,.25)"; q.fillRect(x,y,bw,2); q.fillStyle="rgba(0,0,0,.2)"; q.fillRect(x,y+bh-2,bw,2); };
  const parapet=(col,ins)=>{ q.fillStyle=col; q.fillRect(0,0,w,h); q.fillStyle=shade(b.col,1.18); q.fillRect(0,0,w,ins); q.fillRect(0,0,ins,h); q.fillStyle=shade(b.col,.72); q.fillRect(0,h-ins,w,ins); q.fillRect(w-ins,0,ins,h);
    const sh=q.createLinearGradient(ins,ins,ins+12,ins+12); q.fillStyle="rgba(0,0,0,.18)"; q.fillRect(ins,ins,w-ins*2,7); q.fillRect(ins,ins,7,h-ins*2); };
  if (s==="house"){ const top="#7a6656", bot="#5a4a3e"; q.fillStyle=top; q.fillRect(0,0,w,h/2); q.fillStyle=bot; q.fillRect(0,h/2,w,h/2);
    for (let y=4;y<h;y+=6) for (let x=(y/6%2)*7;x<w;x+=14){ q.fillStyle=`rgba(0,0,0,${.05+rnd()*.08})`; q.fillRect(x,y,13,5); }
    const pw=w*.28, px=w/2-pw/2; q.fillStyle="#6c5a4b"; q.fillRect(px,h/2,pw/2,h/2); q.fillStyle="#4c3f35"; q.fillRect(px+pw/2,h/2,pw/2,h/2);
    q.fillStyle="#3a302a"; q.fillRect(0,h/2-2,w,4); q.fillRect(w/2-2,h/2,4,h/2); q.fillStyle="#f3ebdc"; q.fillRect(0,h-4,w,4); q.fillRect(0,0,w,3);
    const sh=q.createLinearGradient(0,0,w,0); sh.addColorStop(0,"rgba(255,220,160,.12)"); sh.addColorStop(1,"rgba(0,0,0,.12)"); q.fillStyle=sh; q.fillRect(0,0,w,h);
    box(w*.72,h*.12,18,14,"#9a9a98",8); q.fillStyle="#2f3a46"; q.fillRect(w*.2,h*.1,30,22); q.fillStyle="rgba(120,170,220,.5)"; for (let i=0;i<3;i++) q.fillRect(w*.2+2+i*10,h*.1+2,8,18); return; }
  if (s==="warehouse"){ const c=b.col, hz=w>=h; q.fillStyle=c; q.fillRect(0,0,w,h);
    q.fillStyle="rgba(0,0,0,.14)"; if (hz) for (let x=0;x<w;x+=6) q.fillRect(x,0,2,h); else for (let y=0;y<h;y+=6) q.fillRect(0,y,w,2);
    q.fillStyle="rgba(255,255,255,.1)"; if (hz) for (let x=3;x<w;x+=6) q.fillRect(x,0,1,h); else for (let y=3;y<h;y+=6) q.fillRect(0,y,w,1);
    q.fillStyle=shade(c,.7); if (hz) q.fillRect(0,h/2-3,w,6); else q.fillRect(w/2-3,0,6,h);
    q.fillStyle="rgba(190,225,245,.6)"; for (let i=1;i<5;i++){ if (hz){ q.fillRect(w*i/5-12,h*.18,24,h*.16); q.fillRect(w*i/5-12,h*.66,24,h*.16); } else { q.fillRect(w*.18,h*i/5-12,w*.16,24); q.fillRect(w*.66,h*i/5-12,w*.16,24); } }
    if (b.id%2) box(w*.1,h*.1,22,16,"#9a9c9e",8); else { q.fillStyle="rgba(120,60,30,.25)"; for (let i=0;i<8;i++){ q.beginPath(); q.arc(w*((i*.37)%1),h*((i*.61)%1),10+i*2,0,7); q.fill(); } }
    q.strokeStyle=shade(c,.55); q.lineWidth=3; q.strokeRect(1.5,1.5,w-3,h-3); return; }
  if (s==="villa"){ const cx=w/2, cy=h/2, rl=Math.max(0,(w-h)/2); const face=(pts,col)=>{ q.fillStyle=col; q.beginPath(); pts.forEach(([x,y],i)=>i?q.lineTo(x,y):q.moveTo(x,y)); q.closePath(); q.fill(); };
    const PAL=[["#d8754a","#a5502e","#c4643a","#93452a","#7a3418"],["#7d8a96","#56616c","#6c7884","#4b5560","#38414a"],["#c7b08a","#9a8462","#b49d77","#8a7553","#6e5c40"],["#6e7f63","#4d5c45","#5f6f55","#43503c","#33402e"]][b.id%4];
    face([[0,0],[w,0],[cx+rl,cy],[cx-rl,cy]],PAL[0]); face([[0,h],[w,h],[cx+rl,cy],[cx-rl,cy]],PAL[1]); face([[0,0],[0,h],[cx-rl,cy]],PAL[2]); face([[w,0],[w,h],[cx+rl,cy]],PAL[3]);
    q.save(); q.beginPath(); q.rect(0,0,w,h); q.clip(); q.strokeStyle="rgba(70,25,10,.28)"; q.lineWidth=1; for (let y=4;y<h;y+=5){ q.beginPath(); q.moveTo(0,y); q.lineTo(w,y); q.stroke(); } for (let x=3;x<w;x+=7){ q.strokeStyle="rgba(255,200,160,.12)"; q.beginPath(); q.moveTo(x,0); q.lineTo(x,h); q.stroke(); } q.restore();
    q.strokeStyle=PAL[4]; q.lineWidth=2.4; q.beginPath(); q.moveTo(0,0); q.lineTo(cx-rl,cy); q.lineTo(cx+rl,cy); q.lineTo(w,0); q.moveTo(0,h); q.lineTo(cx-rl,cy); q.moveTo(cx+rl,cy); q.lineTo(w,h); q.stroke(); q.strokeStyle="#f2e6d0"; q.lineWidth=3; q.strokeRect(1.5,1.5,w-3,h-3);
    q.fillStyle="#e8dcc6"; q.fillRect(w*.72,h*.18,14,14); q.fillStyle="#3a2a20"; q.fillRect(w*.72+3,h*.18+3,8,8); return; }
  if (b.lux){ parapet("#f4f2ec",5); q.fillStyle="#e9e6de"; q.fillRect(5,5,w-10,h-10);
    q.fillStyle="rgba(0,0,0,.22)"; q.fillRect(w*.04+6,h*.08+6,w*.52,h*.56); q.fillStyle="#fbfaf6"; q.fillRect(w*.04,h*.08,w*.52,h*.56); q.fillStyle="#d8d4ca"; q.fillRect(w*.04,h*.08,w*.52,3); q.fillRect(w*.04,h*.64-3,w*.52,3);
    const gl=q.createLinearGradient(0,h*.14,0,h*.58); gl.addColorStop(0,"#9fd2ea"); gl.addColorStop(1,"#2a4f6e"); q.fillStyle=gl; q.fillRect(w*.09,h*.16,w*.42,h*.13); q.strokeStyle="rgba(255,255,255,.5)"; q.lineWidth=1; for (let x=w*.09;x<w*.51;x+=w*.042){ q.beginPath(); q.moveTo(x,h*.16); q.lineTo(x,h*.29); q.stroke(); }
    box(w*.12,h*.38,w*.12,h*.18,"#cfcac0",5); box(w*.32,h*.4,w*.08,h*.12,"#c4bfb4",4);
    const dk=R(w*.6,h*.1,w*.35,h*.8); q.fillStyle="#a8774a"; q.fillRect(dk.x,dk.y,dk.w,dk.h); q.strokeStyle="rgba(60,35,15,.35)"; q.lineWidth=1; for (let x=dk.x;x<dk.x+dk.w;x+=5){ q.beginPath(); q.moveTo(x,dk.y); q.lineTo(x,dk.y+dk.h); q.stroke(); }
    const jg=q.createLinearGradient(0,dk.y+8,0,dk.y+dk.h*.45); jg.addColorStop(0,"#8ff0f8"); jg.addColorStop(1,"#1f9fcc"); q.fillStyle="#f6f4ee"; q.fillRect(dk.x+6,dk.y+6,dk.w-12,dk.h*.42); q.fillStyle=jg; q.fillRect(dk.x+10,dk.y+10,dk.w-20,dk.h*.42-8);
    for (let i=0;i<2;i++){ const lx=dk.x+10+i*(dk.w*.42), ly=dk.y+dk.h*.6; q.fillStyle="#fafafa"; q.fillRect(lx,ly,dk.w*.32,dk.h*.24); q.fillStyle="#1d1d22"; q.fillRect(lx,ly,dk.w*.32,dk.h*.06); }
    q.fillStyle="#2b2b30"; q.beginPath(); q.arc(dk.x+dk.w*.5,dk.y+dk.h*.92,Math.min(w,h)*.05,0,7); q.fill();
    q.strokeStyle="#c9a24a"; q.lineWidth=2; q.strokeRect(3,3,w-6,h-6);
    q.fillStyle="#3c5a2c"; for (let x=w*.06;x<w*.56;x+=w*.05){ q.beginPath(); q.arc(x,h*.78,Math.min(w,h)*.035,0,7); q.fill(); } q.fillStyle="rgba(150,200,100,.45)"; for (let x=w*.06;x<w*.56;x+=w*.05){ q.beginPath(); q.arc(x-1,h*.77,Math.min(w,h)*.014,0,7); q.fill(); }
    return; }
  if (s==="modern"&&b.id%3===1){ parapet("#e4e2dc",4); q.fillStyle="#d9d6ce"; q.fillRect(5,5,w-10,h-10);
    for (let y=h*.12;y<h*.62;y+=h*.17) for (let x=w*.08;x<w*.9-22;x+=26){ q.fillStyle="#1d2c4a"; q.fillRect(x,y,24,h*.14); q.strokeStyle="rgba(140,180,230,.5)"; q.lineWidth=.6; for (let k=1;k<4;k++){ q.beginPath(); q.moveTo(x+k*6,y); q.lineTo(x+k*6,y+h*.14); q.stroke(); } }
    const pg=q.createLinearGradient(0,h*.7,0,h*.9); pg.addColorStop(0,"#9fe3f2"); pg.addColorStop(1,"#3b98c9"); q.fillStyle=pg; q.fillRect(w*.1,h*.72,w*.45,h*.16); box(w*.72,h*.72,18,12,"#c9ccd0",6); return; }
  if (s==="modern"&&b.id%3===2){ parapet("#3a3d42",4); q.fillStyle="#5e7d46"; q.fillRect(6,6,w-12,h-12);
    for (let i=0;i<w*h/60;i++){ q.fillStyle=["#4f6d3a","#6f9050","#86a85e"][i%3]; q.beginPath(); q.arc(8+((i*37)%(w-16)),8+((i*53)%(h-16)),2+(i%4),0,7); q.fill(); }
    q.fillStyle="#b88a5a"; q.fillRect(w*.55,h*.15,w*.35,h*.3); q.fillStyle="#2f3a46"; q.fillRect(w*.12,h*.62,w*.3,h*.24); q.fillStyle="rgba(140,190,240,.4)"; q.fillRect(w*.12+3,h*.62+3,w*.3-6,6); return; }
  if (s==="modern"){ parapet("#ecebe6",4); const dk=R(w*.08,h*.12,w*.42,h*.5); q.fillStyle="#a87a4e"; q.fillRect(dk.x,dk.y,dk.w,dk.h); q.strokeStyle="rgba(60,35,15,.3)"; q.lineWidth=1; for (let x=dk.x;x<dk.x+dk.w;x+=5){ q.beginPath(); q.moveTo(x,dk.y); q.lineTo(x,dk.y+dk.h); q.stroke(); }
    const pg=q.createLinearGradient(dk.x,dk.y,dk.x+dk.w,dk.y+dk.h); pg.addColorStop(0,"#8ee6f4"); pg.addColorStop(1,"#2690c8"); q.fillStyle=pg; q.fillRect(dk.x+6,dk.y+6,dk.w*.55,dk.h-12);
    q.fillStyle="#1f2f4a"; for (let i=0;i<3;i++) for (let j=0;j<2;j++){ q.fillRect(w*.6+i*16,h*.16+j*20,14,18); q.fillStyle="rgba(120,170,230,.45)"; q.fillRect(w*.6+i*16+1,h*.16+j*20+1,12,6); q.fillStyle="#1f2f4a"; }
    const sg=q.createLinearGradient(0,h*.7,0,h*.9); sg.addColorStop(0,"#bfe4f4"); sg.addColorStop(1,"#5c9fc4"); q.fillStyle=sg; q.fillRect(w*.58,h*.7,w*.3,h*.16); box(w*.12,h*.72,18,12,"#c9ccd0",6); return; }
  if (s==="shop"){ parapet("#d8c6a6",5); for (let i=0;i<w*h/14;i++){ q.fillStyle=`rgba(0,0,0,${.03+rnd()*.05})`; q.fillRect(5+rnd()*(w-10),5+rnd()*(h-10),1.5,1.5); }
    q.fillStyle="rgba(20,10,30,.35)"; q.fillRect(w*.12+5,h*.22+5,w*.76,h*.42); q.fillStyle="#1b1c21"; rr(q,w*.12,h*.22,w*.76,h*.42,4); q.fill(); q.fillStyle="#d8303a"; q.font='400 '+Math.round(h*.24)+'px "Bebas Neue",Impact,sans-serif'; q.textAlign="center"; q.textBaseline="middle"; q.fillText("LA ARMS",w*.6,h*.44,w*.5);
    q.strokeStyle="#f3efe6"; q.lineWidth=2; const cx=w*.22, cy=h*.43, r=h*.12; q.beginPath(); q.arc(cx,cy,r,0,7); q.moveTo(cx-r-3,cy); q.lineTo(cx+r+3,cy); q.moveTo(cx,cy-r-3); q.lineTo(cx,cy+r+3); q.stroke(); box(w*.7,h*.72,24,16,"#b9bcbf",8); return; }
  if (s==="venue"){ parapet(shade(c,.85),5); for (let i=0;i<w*h/16;i++){ q.fillStyle=`rgba(${rnd()<.5?"0,0,0":"255,255,255"},${.04+rnd()*.05})`; q.fillRect(5+rnd()*(w-10),5+rnd()*(h-10),1.5,1.5); }
    const bw=w*.8, bh=Math.min(h*.36,46), bx=(w-bw)/2, by=b.face==="s"?h-bh-12:12; q.fillStyle="rgba(10,6,14,.45)"; q.fillRect(bx+4,by+4,bw,bh); q.fillStyle="#141018"; rr(q,bx,by,bw,bh,5); q.fill();
    q.save(); q.shadowColor=b.neon; q.shadowBlur=10; q.fillStyle=b.neon; q.font='400 '+Math.round(bh*.72)+'px "Bebas Neue",Impact,sans-serif'; q.textAlign="center"; q.textBaseline="middle"; q.fillText(b.sign,w/2,by+bh/2+1,bw*.9); q.restore();
    q.strokeStyle=b.neon; q.globalAlpha=.6; q.lineWidth=1.5; rr(q,bx+3,by+3,bw-6,bh-6,4); q.stroke(); q.globalAlpha=1;
    const iy=b.face==="s"?by-h*.24:by+bh+h*.24; venueIcon(q,b.icon,w*.28,Math.max(16,Math.min(h-16,iy)),Math.min(w,h)*.13,b.neon); box(w*.68,Math.max(8,Math.min(h-24,iy-8)),22,16,"#9a9c9e",8); return; }
  if (s==="truck"){ q.fillStyle="#f2f2ee"; rr(q,0,0,w,h,6); q.fill(); q.fillStyle=c; const hz=w>=h; if (hz){ q.fillRect(0,h*.72,w,h*.28); } else q.fillRect(w*.72,0,w*.28,h);
    q.fillStyle="#c9ccd0"; q.fillRect(hz?w*.55:w*.2,hz?h*.18:h*.55,18,14); q.fillStyle="#2a2d33"; if (hz) q.fillRect(w*.86,4,w*.12,h-8); else q.fillRect(4,h*.86,w-8,h*.12); return; }
  if (s==="pwall"){ q.fillStyle="#b9b4aa"; q.fillRect(0,0,w,h); q.fillStyle="rgba(0,0,0,.15)"; if (w>h) for (let x=0;x<w;x+=30) q.fillRect(x,0,2,h); else for (let y=0;y<h;y+=30) q.fillRect(0,y,w,2);
    q.strokeStyle="#5a5e64"; q.lineWidth=1.2; if (w>h) for (let x=4;x<w;x+=8){ q.beginPath(); q.arc(x,h/2,3.5,0,7); q.stroke(); } else for (let y=4;y<h;y+=8){ q.beginPath(); q.arc(w/2,y,3.5,0,7); q.stroke(); } return; }
  if (s==="pgate"){ q.fillStyle="#3a3f46"; q.fillRect(0,0,w,h); q.fillStyle="#e8c34a"; for (let y=0;y<h;y+=16) q.fillRect(0,y,w,6); return; }
  if (s==="gtower"){ q.fillStyle="#3b3f45"; q.fillRect(0,0,w,h); q.fillStyle="#6c7076"; q.fillRect(4,4,w-8,h-8); q.fillStyle="#2a2d32"; q.beginPath(); q.arc(w/2,h/2,9,0,7); q.fill(); q.fillStyle="#f5f0c8"; q.beginPath(); q.arc(w/2,h/2,5,0,7); q.fill(); return; }
  if (s==="prison"){ parapet("#a9a397",6); q.fillStyle="#8f8a80"; q.fillRect(8,8,w-16,h-16); for (let y=24;y<h-24;y+=34) for (let x=24;x<w-30;x+=40){ q.fillStyle="#2f3a46"; q.fillRect(x,y,26,16); q.fillStyle="rgba(150,190,220,.35)"; q.fillRect(x+2,y+2,22,5); }
    q.fillStyle="rgba(255,255,255,.75)"; q.font='400 '+Math.round(w*.13)+'px "Bebas Neue",Impact,sans-serif'; q.textAlign="center"; q.textBaseline="middle"; q.save(); q.translate(w/2,h/2); if (h>w) q.rotate(-Math.PI/2); q.fillText("LA COUNTY JAIL",0,0,(h>w?h:w)*.8); q.restore(); box(w*.7,h*.08,22,16,"#9a9c9e",8); return; }
  if (s==="terminal"){ parapet("#ece7de",6); const gr=q.createLinearGradient(0,0,0,h); gr.addColorStop(0,"#a6cfe6"); gr.addColorStop(1,"#5b8db1"); q.fillStyle=gr; for (let x=26;x<w-26;x+=62) q.fillRect(x,24,42,h-48);
    q.fillStyle="rgba(255,255,255,.4)"; for (let x=26;x<w-26;x+=62) q.fillRect(x,24,42,4);
    if (w>500){ q.fillStyle="rgba(18,24,32,.82)"; rr(q,w/2-230,h/2-28,460,56,8); q.fill(); q.fillStyle="#ffb347"; q.font='400 46px "Bebas Neue",Impact,sans-serif'; q.textAlign="center"; q.textBaseline="middle"; q.fillText("LA INTERNATIONAL",w/2,h/2+2); } return; }
  if (s==="ctower"){ q.fillStyle="#cdd3d8"; q.fillRect(0,0,w,h); const gr=q.createRadialGradient(w*.4,h*.4,2,w/2,h/2,w*.45); gr.addColorStop(0,"#7fb2d6"); gr.addColorStop(1,"#1f4a6e"); q.fillStyle=gr; q.beginPath(); q.arc(w/2,h/2,w*.44,0,7); q.fill();
    q.fillStyle="#e3e8ec"; q.beginPath(); q.arc(w/2,h/2,w*.22,0,7); q.fill(); q.strokeStyle="#9aa3ab"; q.lineWidth=2; q.beginPath(); q.moveTo(w/2,h/2); q.lineTo(w/2,h*.1); q.stroke(); q.fillStyle="#ff5b4a"; q.beginPath(); q.arc(w/2,h*.1,3,0,7); q.fill(); return; }
  parapet(s==="glass"?shade(c,1.1):s==="slab"?"#9d9a94":shade(c,1.02),5);
  // gravel texture
  for (let i=0;i<w*h/14;i++){ q.fillStyle=`rgba(${rnd()<.5?"0,0,0":"255,255,255"},${.04+rnd()*.05})`; q.fillRect(5+rnd()*(w-10),5+rnd()*(h-10),1.5,1.5); }
  if (s==="crown"){ const L1=q.createLinearGradient(0,0,w,h); L1.addColorStop(0,shade(c,1.35)); L1.addColorStop(1,shade(c,.95)); q.fillStyle="rgba(20,10,30,.3)"; q.fillRect(w*.18+6,h*.18+6,w*.64,h*.64); q.fillStyle=L1; q.fillRect(w*.18,h*.18,w*.64,h*.64);
    q.fillStyle="rgba(20,10,30,.3)"; q.fillRect(w*.3+5,h*.3+5,w*.4,h*.4); q.fillStyle=shade(c,1.45); q.fillRect(w*.3,h*.3,w*.4,h*.4);
    const r=Math.min(w,h)*.15; q.fillStyle="#2a2d33"; q.beginPath(); q.arc(w/2,h/2,r,0,7); q.fill(); q.strokeStyle="#ffcf3f"; q.lineWidth=2.5; q.beginPath(); q.arc(w/2,h/2,r-4,0,7); q.stroke();
    q.fillStyle="#ffcf3f"; q.font='400 '+Math.round(r*1.1)+'px "Bebas Neue",Impact,sans-serif'; q.textAlign="center"; q.textBaseline="middle"; q.fillText("H",w/2,h/2+1);
    for (const [x,y] of [[w*.2,h*.2],[w*.8,h*.2],[w*.2,h*.8],[w*.8,h*.8]]){ q.fillStyle="#ff5b4a"; q.beginPath(); q.arc(x,y,2.5,0,7); q.fill(); } return; }
  // mechanical: AC units, vents, a water tank, maybe solar
  const n=2+Math.floor(rnd()*3); for (let i=0;i<n;i++){ const bw=22+rnd()*26, bh=16+rnd()*20, x=12+rnd()*(w-bw-24), y=12+rnd()*(h-bh-24); box(x,y,bw,bh,"#b9bcbf",10);
    q.fillStyle="#7d8288"; for (let k=4;k<bw-4;k+=5) q.fillRect(x+k,y+4,2,bh-8); q.fillStyle="#3a3e44"; q.beginPath(); q.arc(x+bw*.7,y+bh*.5,Math.min(bw,bh)*.28,0,7); q.fill(); }
  if (s==="stone"||rnd()<.5){ const x=w*.7,y=h*.65,r=13; q.fillStyle="rgba(20,10,30,.35)"; q.beginPath(); q.arc(x+8,y+6,r,0,7); q.fill(); const gr=q.createRadialGradient(x-4,y-4,2,x,y,r); gr.addColorStop(0,"#b08a5e"); gr.addColorStop(1,"#5c4228"); q.fillStyle=gr; q.beginPath(); q.arc(x,y,r,0,7); q.fill(); q.strokeStyle="#3a2a1a"; q.lineWidth=1.5; q.stroke(); }
  if (s==="glass"){ const sx=w*.12, sy=h*.62, cols=Math.floor(w*.4/16); for (let i=0;i<cols;i++){ q.fillStyle="#1f2f4a"; q.fillRect(sx+i*16,sy,14,24); q.fillStyle="rgba(120,170,230,.45)"; q.fillRect(sx+i*16+1,sy+1,12,8); } }
  if (s==="slab"){ q.strokeStyle="rgba(0,0,0,.15)"; q.lineWidth=1; for (let x=10;x<w-10;x+=30){ q.beginPath(); q.moveTo(x,6); q.lineTo(x,h-6); q.stroke(); } } }); }
function roofLabel(b,txt,col){ const q=b.roofC.getContext("2d"); q.save(); q.scale(1.4,1.4); q.fillStyle="rgba(0,0,0,.18)"; q.beginPath(); q.arc(b.w/2,b.h/2,Math.min(b.w,b.h)*.22,0,7); q.fill(); q.fillStyle=col; q.beginPath(); q.arc(b.w/2,b.h/2-3,Math.min(b.w,b.h)*.2,0,7); q.fill(); q.fillStyle="rgba(255,255,255,.35)"; q.beginPath(); q.arc(b.w/2-8,b.h/2-12,Math.min(b.w,b.h)*.07,0,7); q.fill(); q.font='400 '+Math.round(b.w*.085)+'px "Bebas Neue",Impact,sans-serif'; q.textAlign="center"; q.textBaseline="middle"; q.fillStyle="rgba(40,30,20,.75)"; q.fillText(txt,b.w/2,b.h-22); q.restore(); }
for (const b of buildings){ b.front=b.style==="house"; b.texH=facade(b,b.w); b.texV=facade(Object.assign({},b,{front:false}),b.h); b.roofC=roofTex(b); }
roofLabel(BANKB,"CENTRAL BANK","#cdb995"); roofLabel(MUSB,"MUSEUM OF ART","#ddd3c1");

// ================= PEOPLE =================
const jj={h:0,roof:null,glide:null,swim:false,x:DOOR.x,y:DOOR.y+30,ang:0,step:0,moving:false,run:false,hp:100,veh:null,lock:0,dead:false,deadT:0,lastHurt:-99,flash:0,cashHeavy:0};
const LOOK={hero:"jj",skin:"#7a4b2e",skinHi:"#9c6743",shirt:"#c8302a",shirtHi:"#f25c48",inner:"#17181c",pants:"#26324a",shoe:"#f4f4f0",cap:"#141519"};
const LOOKS=[{skin:"#e2b48e",skinHi:"#f3cba7",shirt:"#3b6fb6",shirtHi:"#6596da",pants:"#3a3f4a",shoe:"#2a2a2a",hair:"#3a2a1c"},
  {skin:"#9a6446",skinHi:"#b77d5c",shirt:"#f0eee8",shirtHi:"#ffffff",pants:"#2c3f5c",shoe:"#e8e4dc",hair:"#141414"},
  {skin:"#f0c9a4",skinHi:"#ffdcbc",shirt:"#2f9e7a",shirtHi:"#4fc39c",pants:"#55463a",shoe:"#3a2a20",hair:"#c9a04a"},
  {skin:"#c48a62",skinHi:"#d9a27c",shirt:"#f2b234",shirtHi:"#ffd067",pants:"#1f2328",shoe:"#ffffff",hair:"#2a1a10"}];
function drawWeaponInHand(q,w,swing){
  if (w==="knuckles"){ for (const sx of [-11,11]){ q.fillStyle="#c9ccd2"; q.fillRect(sx-3.4,1.2,6.8,2.2); q.fillStyle="#7d828a"; for (let k=0;k<4;k++) q.fillRect(sx-3.2+k*1.7,1.6,.8,1.4); } }
  if (w==="pistol"){ q.fillStyle="#1d1d22"; q.fillRect(3,10,3.2,11); q.fillStyle="#3a3a42"; q.fillRect(3,10,1.2,11); }
  if (w==="bat"){ q.save(); q.translate(8,3); q.rotate(swing>0?(-1.3+(1-swing/.28)*2.6):-2.6); q.lineCap="round";
    q.strokeStyle="#3a2414"; q.lineWidth=3.2; q.beginPath(); q.moveTo(0,0); q.lineTo(0,6); q.stroke();
    const gr=q.createLinearGradient(-3,0,3,0); gr.addColorStop(0,"#e8c48c"); gr.addColorStop(1,"#a8783f"); q.strokeStyle=gr; q.lineWidth=4.6; q.beginPath(); q.moveTo(0,6); q.lineTo(0,24); q.stroke(); q.restore(); }
  if (w==="shotgun"){ q.fillStyle="#7a4a28"; rr(q,1.5,2,4,9,1.5); q.fill(); q.fillStyle="#26262a"; q.fillRect(2.3,10,2.6,16); q.fillStyle="#4a4a50"; q.fillRect(2.3,10,1,16); q.fillStyle="#5a3a20"; q.fillRect(1.8,15,3.6,4); }
  if (w==="scar"){ q.fillStyle="#c2a878"; rr(q,1.5,1,4.4,10,1.5); q.fill(); q.fillStyle="#2a2a2e"; q.fillRect(2.4,9,2.8,19); q.fillStyle="#c2a878"; q.fillRect(1.8,11,4,7); q.fillStyle="#1a1a1e"; q.fillRect(5.4,12,3,5); }
  if (w==="gl"){ q.fillStyle="#3c4a2a"; rr(q,1,2,5,9,1.5); q.fill(); q.fillStyle="#2a3020"; q.fillRect(1.5,10,6,16); q.fillStyle="#5a6a3e"; q.beginPath(); q.arc(4.5,16,4.2,0,7); q.fill(); q.fillStyle="#1a1e14"; q.beginPath(); q.arc(4.5,26,3,0,7); q.fill(); }
  if (w==="alien"){ q.fillStyle="#3a3f4a"; rr(q,1.5,2,4.5,8,2); q.fill(); const gr=q.createLinearGradient(0,10,0,26); gr.addColorStop(0,"#c9d2dc"); gr.addColorStop(1,"#7c8794"); q.fillStyle=gr; rr(q,1.2,9,6,16,3); q.fill(); q.save(); q.globalCompositeOperation="lighter"; q.fillStyle="rgba(125,255,106,.85)"; q.beginPath(); q.arc(4.2,25,2.4,0,7); q.fill(); q.fillRect(3.6,12,1.4,10); q.restore(); }
  if (w==="rpg"){ q.fillStyle="#3a4128"; q.fillRect(4,-12,6,34); const gr=q.createLinearGradient(4,0,10,0); gr.addColorStop(0,"#7c8a52"); gr.addColorStop(1,"#4b5532"); q.fillStyle=gr; q.fillRect(4.5,-12,5,34); q.fillStyle="#22261a"; q.fillRect(3.5,-13,7,3); q.fillRect(3.5,19,7,3);
    if (W.mag.rpg>0){ q.fillStyle="#8a5a3a"; q.beginPath(); q.moveTo(4.5,22); q.lineTo(9.5,22); q.lineTo(7,29); q.closePath(); q.fill(); } } }
function heroTorso(q,L){ const h=L.hero; q.lineCap="round";
  // shoulder seams + shading
  q.strokeStyle="rgba(0,0,0,.22)"; q.lineWidth=.8; q.beginPath(); q.arc(-11,0,5,-1,1); q.stroke(); q.beginPath(); q.arc(11,0,5,Math.PI-1,Math.PI+1); q.stroke();
  q.fillStyle="rgba(0,0,0,.16)"; q.beginPath(); q.ellipse(0,-3.5,9,3,0,0,7); q.fill();
  if (h!=="paul"&&h!=="earl"){ // open jacket showing inner shirt
    q.fillStyle=L.inner; q.beginPath(); q.moveTo(-4,6.6); q.lineTo(-1.2,1); q.lineTo(1.2,1); q.lineTo(4,6.6); q.closePath(); q.fill();
    q.strokeStyle="rgba(0,0,0,.35)"; q.lineWidth=.7; q.beginPath(); q.moveTo(-4,6.6); q.lineTo(-1.2,1); q.moveTo(4,6.6); q.lineTo(1.2,1); q.stroke(); }
  if (h==="jj"){ q.strokeStyle="#ffd34d"; q.lineWidth=1.1; q.beginPath(); q.arc(0,2.4,4.6,.35,Math.PI-.35); q.stroke(); q.fillStyle="#ffd34d"; q.beginPath(); q.arc(0,7,1.2,0,7); q.fill();
    q.fillStyle="#f4f4f0"; q.fillRect(-10.5,-1.2,3,.9); q.fillRect(7.5,-1.2,3,.9); }
  if (h==="luka"){ q.strokeStyle="#fff"; q.lineWidth=1; for (const sd of [-1,1]){ q.beginPath(); q.moveTo(sd*3.5,-5.4); q.lineTo(sd*10.4,-1.6); q.stroke(); } q.strokeStyle="#ffd60a"; q.lineWidth=.6; for (const sd of [-1,1]){ q.beginPath(); q.moveTo(sd*3.5,-4.3); q.lineTo(sd*10.4,-.5); q.stroke(); } }
  if (h==="yunus"){ q.fillStyle=L.inner; q.beginPath(); q.ellipse(0,-4.6,6,3.2,0,0,7); q.fill(); q.strokeStyle="rgba(255,255,255,.75)"; q.lineWidth=.6; q.beginPath(); q.moveTo(-1.5,1.5); q.lineTo(-1.8,5.5); q.moveTo(1.5,1.5); q.lineTo(1.8,5.5); q.stroke();
    q.fillStyle="#1c1c22"; rr(q,-7,-7.6,14,3.4,1.4); q.fill(); q.fillStyle="#34d399"; q.fillRect(-1,-7,2,1.2); }
  if (h==="paul"){ q.fillStyle=L.inner; rr(q,-7.5,-4.5,15,10,3); q.fill(); q.fillStyle="#56643f"; for (const x of [-6,-2,2]) { rr(q,x,1.6,3.4,3.6,.8); q.fill(); }
    q.save(); q.rotate(-.45); q.fillStyle="#1c1d1f"; q.fillRect(-12,-6.8,24,2.2); q.fillStyle="#3a2a1c"; q.fillRect(-12,-7.2,6,3); q.fillStyle="#2d2f33"; q.fillRect(1,-7.6,4,1.2); q.restore(); }
  if (h==="marco"){ q.fillStyle=L.inner; q.beginPath(); q.ellipse(0,-.5,7.2,4.4,0,Math.PI,0,false); q.fill(); q.fillStyle="#d8b35a"; q.fillRect(-9.5,-.9,3.2,1.4); q.fillRect(6.3,-.9,3.2,1.4); q.fillStyle="#2b2b2b"; q.fillRect(-6.5,2.2,2.4,1.4); }
  if (h==="earl"){ q.fillStyle=L.inner; q.beginPath(); q.moveTo(-2,6.8); q.lineTo(0,1.5); q.lineTo(2,6.8); q.closePath(); q.fill(); q.fillStyle="#3a2e22"; for (const y of [3.5,5.5]){ q.beginPath(); q.arc(-2.6,y,.6,0,7); q.arc(2.6,y,.6,0,7); q.fill(); } } }
function heroHead(q,L){ const h=L.hero;
  if (h==="jj"&&L.hat!=="back"){ jjHead(q,L); } else if (h==="jj"){ q.fillStyle=L.cap; q.beginPath(); q.arc(0,.8,5.5,0,7); q.fill(); rr(q,-3.6,-5.8,7.2,3.6,1.6); q.fill(); q.fillStyle="rgba(255,255,255,.14)"; q.beginPath(); q.arc(-1.5,-.2,2.4,0,7); q.fill();
    q.fillStyle="#ffd34d"; q.beginPath(); q.arc(0,3.2,1,0,7); q.fill(); q.fillStyle=L.skin; q.fillRect(-2.2,5.6,4.4,.8); }
  else if (h==="luka"){ q.fillStyle=L.hair; q.beginPath(); q.arc(0,.2,5.5,Math.PI*.85,Math.PI*.15,false); q.fill(); q.strokeStyle="rgba(255,255,255,.18)"; q.lineWidth=.5; for (const x of [-2.5,0,2.5]){ q.beginPath(); q.moveTo(x,2.5); q.lineTo(x*.8,-4.5); q.stroke(); }
    q.fillStyle="#0c0c10"; rr(q,-4.6,4.4,9.2,1.9,.8); q.fill(); q.fillStyle="rgba(120,180,255,.6)"; q.fillRect(-3.6,4.7,2.4,.7); q.fillRect(1.2,4.7,2.4,.7); }
  else if (h==="yunus"){ q.fillStyle=L.hair; q.beginPath(); q.arc(0,.6,5.2,Math.PI*.8,Math.PI*.2,false); q.fill(); q.strokeStyle="#16161b"; q.lineWidth=1.4; q.beginPath(); q.moveTo(-5.8,1.4); q.quadraticCurveTo(0,-1.6,5.8,1.4); q.stroke();
    q.fillStyle="#16161b"; rr(q,-7.2,-.6,2.4,4,1); q.fill(); rr(q,4.8,-.6,2.4,4,1); q.fill(); q.fillStyle="#34d399"; q.fillRect(-6.8,.6,1.2,1.4); q.fillRect(5.6,.6,1.2,1.4); }
  else if (h==="paul"){ q.fillStyle=L.hair; q.beginPath(); q.arc(0,.6,5.6,Math.PI*.95,Math.PI*.05,false); q.fill(); q.fillStyle="#2f3626"; q.fillRect(-5.6,.2,11.2,1.8); q.strokeStyle="rgba(0,0,0,.25)"; q.lineWidth=.5; for (let x=-4;x<=4;x+=2){ q.beginPath(); q.moveTo(x,-4); q.lineTo(x,0); q.stroke(); }
    q.fillStyle="#8a6a4a"; q.beginPath(); q.ellipse(0,5.4,2.6,1.2,0,0,7); q.fill(); }
  else if (h==="marco"){ q.fillStyle=L.hair; q.beginPath(); q.arc(0,.2,5.4,Math.PI*.9,Math.PI*.1,false); q.fill(); q.strokeStyle="#2a2a2e"; q.lineWidth=1.2; q.beginPath(); q.arc(0,1,5.9,Math.PI*1.05,Math.PI*1.95); q.stroke();
    q.fillStyle="#2a2a2e"; q.beginPath(); q.arc(-6,1.2,1.6,0,7); q.arc(6,1.2,1.6,0,7); q.fill(); q.strokeStyle="#d8b35a"; q.lineWidth=.7; q.fillStyle="rgba(40,30,10,.85)"; q.beginPath(); q.ellipse(-2,5,1.9,1.2,0,0,7); q.ellipse(2,5,1.9,1.2,0,0,7); q.fill(); q.stroke(); }
  else if (h==="earl"){ q.strokeStyle=L.hair; q.lineWidth=1.8; q.beginPath(); q.arc(0,1,4.6,Math.PI*.75,Math.PI*.25,false); q.stroke(); q.fillStyle="rgba(255,255,255,.18)"; q.beginPath(); q.arc(-1,-.5,2,0,7); q.fill();
    q.strokeStyle="#c9c2b4"; q.lineWidth=.6; q.beginPath(); q.arc(-1.8,5,1.3,0,7); q.moveTo(3.1,5); q.arc(1.8,5,1.3,0,7); q.stroke(); q.fillStyle=L.hair; q.fillRect(-2.4,5.9,4.8,.9); } }
// ================= FIGUREN: gemalte Cutout-Sprites (Higgsfield) mit animiertem Rig =================
const RIGM=[{"t":[2,2,124,121],"a":[130,2,45,178],"l":[179,2,40,181],"sh":[0,123,25]},{"t":[258,2,124,66],"a":[386,2,43,178],"l":[433,2,40,181],"sh":[0,123,34]},{"t":[514,2,124,62],"a":[642,2,45,177],"l":[691,2,40,181],"sh":[0,123,27]},{"t":[770,2,124,105],"a":[898,2,45,177],"l":[947,2,40,180],"sh":[0,123,24]},{"t":[1026,2,124,62],"a":[1154,2,44,174],"l":[1202,2,40,178],"sh":[0,123,28]},{"t":[2,226,124,62],"a":[130,226,45,178],"l":[179,226,40,181],"sh":[0,123,27]},{"t":[258,226,124,61],"a":[386,226,45,178],"l":[435,226,40,181],"sh":[0,123,26]},{"t":[514,226,124,66],"a":[642,226,45,178],"l":[691,226,42,182],"sh":[0,123,34]},{"t":[770,226,124,72],"a":[898,226,45,178],"l":[947,226,40,182],"sh":[0,123,28]},{"t":[1026,226,124,78],"a":[1154,226,44,174],"l":[1202,226,42,177],"sh":[0,123,26]},{"t":[2,450,124,73],"a":[130,450,43,181],"l":[177,450,43,184],"sh":[0,123,31]},{"t":[258,450,124,60],"a":[386,450,42,175],"l":[432,450,40,178],"sh":[0,123,26]},{"t":[514,450,124,63],"a":[642,450,42,171],"l":[688,450,40,177],"sh":[0,123,30]},{"t":[770,450,124,60],"a":[898,450,45,178],"l":[947,450,40,181],"sh":[0,123,25]},{"t":[1026,450,124,89],"a":[1154,450,45,183],"l":[1203,450,50,186],"sh":[0,123,43]},{"t":[2,674,124,59],"a":[130,674,45,177],"l":[179,674,40,181],"sh":[0,123,26]},{"t":[258,674,124,77],"a":[386,674,37,185],"l":[427,674,42,188],"sh":[0,123,33]},{"t":[514,674,124,65],"a":[642,674,45,178],"l":[691,674,40,181],"sh":[0,123,34]},{"t":[770,674,124,55],"a":[898,674,41,174],"l":[943,674,40,177],"sh":[0,123,24]},{"t":[1026,674,124,130],"a":[1154,674,45,179],"l":[1203,674,40,181],"sh":[0,123,40]},{"t":[2,898,124,62],"a":[130,898,45,178],"l":[179,898,40,181],"sh":[0,123,28]},{"t":[258,898,124,60],"a":[386,898,45,178],"l":[435,898,40,181],"sh":[0,123,26]},{"t":[514,898,124,60],"a":[642,898,44,174],"l":[690,898,41,178],"sh":[0,123,26]},{"t":[770,898,124,62],"a":[898,898,45,176],"l":[947,898,40,180],"sh":[0,123,26]},{"t":[1026,898,124,62],"a":[1154,898,45,177],"l":[1203,898,40,181],"sh":[0,123,26]}];
const RIGIMG=ASSETS.chars||new Image(); let RIGOK=!!ASSETS.chars; if (!RIGOK){ RIGIMG.onload=()=>{ RIGOK=true; }; RIGIMG.src="chars.webp"; }
const RIG_FWD={0:1,3:1,19:1}, RIG_CIV=[10,11,12,13,14,15,16,17,18,19], RIG_HERO={luka:20,yunus:21,paul:22,marco:23,earl:24};
function rigFor(L){ if (L.rig!=null) return L.rig; if (L.hero==="jj") return OUTFIT; if (L.hero) return RIG_HERO[L.hero]; if (L===COP_LOOK) return 8; if (typeof SWAT_LOOK!=="undefined"&&L===SWAT_LOOK) return 9;
  if (typeof GANG_LOOK!=="undefined"&&L===GANG_LOOK) return 13; if (typeof GUARD_LOOK!=="undefined"&&L===GUARD_LOOK) return 15; if (typeof BOUNCER_LOOK!=="undefined"&&L===BOUNCER_LOOK) return 9;
  if (L._rig==null){ let h=7; for (const c of (L.shirt||"")+(L.skin||"")+(L.hair||"")+(L.pants||"")) h=(h*31+c.charCodeAt(0))|0; L._rig=RIG_CIV[Math.abs(h)%RIG_CIV.length]; } return L._rig; }
// ein Körperteil: Bild-Ausschnitt r=[x,y,w,h]; Ansatzpunkt (Schulter/Hüfte) bei (ax,ay), zeigt in Richtung ang, sichtbare Länge len (Weltpixel), Breite w
function rigPart(q,r,ax,ay,ang,len,w,frac){ const f=frac||1, sh=r[3]*f; q.save(); q.translate(ax,ay); q.rotate(ang-Math.PI/2); q.drawImage(RIGIMG,r[0],r[1]+r[3]-sh,r[2],sh,-w/2,-len*.02,w,len); q.restore(); }
function drawRig(q,p,L,o,ri){ const M=RIGM[ri], k=24/124, tw=M.t[2]*k, th=M.t[3]*k, gun=o.weapon==="shotgun"||o.weapon==="rpg"||o.weapon==="pistol"||o.weapon==="scar"||o.weapon==="gl"||o.weapon==="alien";
  const tgt=p.walkAmt!=null?p.walkAmt:(p.moving?1:0); p._wa=p._wa==null?tgt:p._wa+(tgt-p._wa)*.18; const wa=p._wa, ph=p.step||0, amp=wa*(p.run?.85:.6), sw=Math.sin(ph), flip=false;
  const aw=M.a[2]*k*.9, lw=M.l[2]*k*.95, sy=(M.sh[2]-M.t[3]/2)*k*(flip?-1:1), sx=tw/2-2.6;
  // Beine: nur Unterschenkel + Schuh schauen beim Schritt unter dem Körper hervor
  for (const sd of [-1,1]){ const s=sd*sw*amp, foot=s*(p.run?14:10); const len=Math.max(4,Math.abs(foot)+7); rigPart(q,M.l,sd*4.2,-foot*.05,foot>=0?Math.PI/2:-Math.PI/2,len,lw,Math.min(1,.38+Math.abs(s)*.4)); }
  const armsFront=gun||o.punch!=null&&o.punch>0;
  const arms=()=>{ for (const sd of [-1,1]){ const ax=sd*sx, ay=sy*.35;
      if (gun){ const hx=sd<0?-3:5, hy=sd<0?10:13, dx=hx-ax, dy=hy-ay, d=Math.hypot(dx,dy); rigPart(q,M.a,ax,ay,Math.atan2(dy,dx),d+3,aw,1); continue; }
      if (o.punch!=null&&o.punch>0&&sd===(o.side||1)){ const ext=Math.sin(Math.min(1,o.punch)*Math.PI), hy=4+ext*15, hx=sd*(4-ext*2), dx=hx-ax, dy=hy-ay; rigPart(q,M.a,ax,ay,Math.atan2(dy,dx),Math.hypot(dx,dy)+3,aw,1); continue; }
      const s=-sd*sw*amp, hand=s*(p.run?10:7); const len=Math.max(5,Math.abs(hand)+6); rigPart(q,M.a,ax+sd*.6,ay,hand>=0?Math.PI/2+sd*.12:-Math.PI/2-sd*.12,len,aw,Math.min(1,.42+Math.abs(s)*.45)); } };
  if (!armsFront) arms();
  q.save(); q.rotate(sw*.02*amp+(flip?Math.PI:0)); q.drawImage(RIGIMG,M.t[0],M.t[1],M.t[2],M.t[3],-tw/2,-th/2,tw,th); q.restore();
  if (armsFront) arms();
  if (o.weapon&&o.weapon!=="knuckles") drawWeaponInHand(q,o.weapon,o.swing||0); }
function drawPerson(q,p,L,o){ o=o||{}; q.save(); q.translate(p.x,p.y);
  q.fillStyle="rgba(30,15,40,.32)"; q.beginPath(); q.ellipse(6,5,12,8,.4,0,7); q.fill();
  if (RIGOK&&!o.oldRig){ const ri=rigFor(L); if (ri!=null&&RIGM[ri]){ q.rotate(p.ang); if (L.hero&&L.hero!=="jj") q.scale(1.08,1.08); drawRig(q,p,L,o,ri); q.restore(); return; } }
  q.rotate(p.ang); if (L.hero) q.scale(1.2,1.2); const gun=o.weapon==="shotgun"||o.weapon==="rpg"||o.weapon==="pistol"||o.weapon==="scar"||o.weapon==="gl"||o.weapon==="alien";
  let sw=p.moving?Math.sin(p.step)*(p.run?7:5):0;
  if (L.hero){ const wa=p.walkAmt==null?(p.moving?1:0):p.walkAmt, ph=p.step||0; sw=Math.sin(ph)*(p.run?8.5:6.5)*wa; const bob=Math.abs(Math.cos(ph))*wa;
    q.scale(1+bob*.025,1-bob*.015);
    for (const sd of [-1,1]){ const fy=(sd<0?sw:-sw)*1.45+1, x=sd<0?-6.4:1.4, lift=Math.max(0,Math.cos(ph)*sd)*wa, y0=Math.min(0,fy), y1=Math.max(0,fy);
      q.fillStyle=L.pants; rr(q,x+.3,y0-2.4,4.4,y1-y0+4.8,2); q.fill(); q.fillStyle="rgba(0,0,0,.2)"; q.fillRect(x+.3,y0-1.6,1.1,y1-y0+3.2);
      q.fillStyle="rgba(0,0,0,.35)"; rr(q,x-.3,fy-3.2,5.6,7.6,2.4); q.fill();
      q.fillStyle=L.shoe; rr(q,x-.1-lift*.3,fy-3.6-lift*.4,5.2+lift*.6,7.2+lift*.8,2.2); q.fill(); q.fillStyle="rgba(255,255,255,.35)"; q.fillRect(x+1,fy-2.6,3,1); }
    q.save(); q.rotate(-sw*.018); }
  else { q.fillStyle=L.shoe; rr(q,-6.5,-1+sw,5,7,2); q.fill(); rr(q,1.5,-1-sw,5,7,2); q.fill();
  q.fillStyle=L.pants; q.fillRect(-6,-4+sw*.5,5,6); q.fillRect(1,-4-sw*.5,5,6); }
  if (gun){ q.fillStyle=L.shirt; q.beginPath(); q.ellipse(-8,4,3.2,5,.5,0,7); q.ellipse(8,4,3.2,5,-.3,0,7); q.fill(); q.fillStyle=L.skin; q.beginPath(); q.arc(-3,10,2.8,0,7); q.arc(5,13,2.8,0,7); q.fill(); }
  else if (o.punch!=null){ const pr=o.punch, ext=pr>0?Math.sin(Math.min(1,pr)*Math.PI):0, side=o.side||1;
    for (const sd of [-1,1]){ const act=sd===side?ext:0, fx=sd*5.5-sd*act*3.5, fy=8+act*13, shx=sd*9, shy=1;
      q.strokeStyle=L.shirt; q.lineWidth=5.5; q.lineCap="round"; q.beginPath(); q.moveTo(shx,shy); q.quadraticCurveTo(sd*10,fy*.55,fx,fy-2); q.stroke();
      q.fillStyle=L.skin; q.beginPath(); q.arc(fx,fy,3.4+act*.5,0,7); q.fill(); q.fillStyle="rgba(0,0,0,.18)"; q.beginPath(); q.arc(fx+sd*.8,fy+.8,1.6,0,7); q.fill();
      if (o.knuckles){ q.fillStyle="#d4d7dc"; q.fillRect(fx-3.2,fy+1.6,6.4,1.8); }
      if (act>.85){ q.strokeStyle="rgba(255,255,255,.7)"; q.lineWidth=1.2; for (const a2 of [-.6,0,.6]){ q.beginPath(); q.moveTo(fx+Math.sin(a2)*6,fy+Math.cos(a2)*6); q.lineTo(fx+Math.sin(a2)*9,fy+Math.cos(a2)*9); q.stroke(); } } } }
  else for (const [x,s] of [[-11,-sw],[11,sw]]){ const hx=L.hero?x-Math.sign(x)*Math.abs(s)*.08:x, hy=L.hero?1+s*1.05:1+s; q.fillStyle=L.shirt; q.beginPath(); q.ellipse(x*.85,hy*.45,3.2,4.5+(L.hero?Math.abs(s)*.25:0),0,0,7); q.fill(); q.fillStyle=L.skin; q.beginPath(); q.arc(hx,hy,3,0,7); q.fill(); }
  if (L.hero){ q.fillStyle="rgba(14,12,18,.85)"; q.beginPath(); q.ellipse(0,0,12.1,8.1,0,0,7); q.fill(); }
  const gr=q.createLinearGradient(-10,-6,10,6); gr.addColorStop(0,L.shirtHi); gr.addColorStop(1,L.shirt); q.fillStyle=gr; q.beginPath(); q.ellipse(0,0,11,7,0,0,7); q.fill();
  if (L.hero) heroTorso(q,L);
  if (o.weapon&&o.weapon!=="knuckles") drawWeaponInHand(q,o.weapon,o.swing||0);
  if (L.hero){ q.restore(); q.fillStyle="rgba(14,12,18,.85)"; q.beginPath(); q.arc(0,1,6.5,0,7); q.fill(); }
  const hg=q.createRadialGradient(-1.5,-.5,1,0,1,6); hg.addColorStop(0,L.skinHi); hg.addColorStop(1,L.skin); q.fillStyle=hg; q.beginPath(); q.arc(0,1,5.6,0,7); q.fill();
  if (L.hero) heroHead(q,L);
  else if (L.cap){ q.fillStyle=L.cap; q.beginPath(); q.arc(0,.2,5.5,Math.PI*.95,Math.PI*.05,false); q.fill(); rr(q,-3.5,1,7,5,2); q.fill(); q.fillStyle="rgba(255,255,255,.18)"; q.fillRect(-2,-3,4,1.5); }
  else { q.fillStyle=L.hair; q.beginPath(); q.arc(0,-.4,5.4,Math.PI*.9,Math.PI*.1,false); q.fill(); }
  q.restore(); }
function tag(q,x,y,txt){ q.font='700 10px "Barlow Semi Condensed",sans-serif'; q.textAlign="center"; q.textBaseline="middle"; const w=q.measureText(txt).width+12; q.fillStyle="rgba(18,16,22,.8)"; rr(q,x-w/2,y-7,w,14,4); q.fill(); q.fillStyle="#ffb347"; q.fillText(txt,x,y+.5); }
function bailOut(){ if (FLY){ planeBail(); return; } const v=jj.veh; if (!v||v.t.kind!=="heli"||v.z<=.15||v.onRoof||jj.dead) return; if (v.priv&&v.auto){ toast("Mo fliegt gerade"); return; } const h=v.z*240; showDest(false);
  jj.veh=null; jj.x=v.x; jj.y=v.y; jj.h=h; jj.roof=null; const sp=Math.hypot(v.vx,v.vy), a=sp>20?Math.atan2(v.vy,v.vx):v.a; jj.glide={vx:Math.cos(a)*Math.max(120,sp*.5),vy:Math.sin(a)*Math.max(120,sp*.5)}; jj.ang=Math.atan2(-jj.glide.vx,jj.glide.vy);
  v.spin=true; v.landing=false; if (v.priv&&v.auto){ privLeave(v); } else { v.crashing=true; v.vx=v.vx||Math.cos(v.a)*120; v.vy=v.vy||Math.sin(v.a)*120; if (v.priv) priv=null; } sfx("swing"); toast("Abgesprungen!"); hudDirty=true; }
function startGlide(mx,my){ if (!jj.roof) return; const L=Math.hypot(mx,my)||1, b=jj.roof; for (let i=0;i<80&&jj.x>=b.x-2&&jj.x<=b.x+b.w+2&&jj.y>=b.y-2&&jj.y<=b.y+b.h+2;i++){ jj.x+=mx/L*2; jj.y+=my/L*2; } jj.glide={vx:mx/L*160,vy:my/L*160}; jj.roof=null; sfx("swing"); }
function edgeDist(){ const b=jj.roof; return b?Math.min(jj.x-b.x,b.x+b.w-jj.x,jj.y-b.y,b.y+b.h-jj.y):99; }
function updateGlide(dt){ const G=jj.glide; let mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0), my=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0);
  if (stick.id!==null){ const L=Math.hypot(stick.dx,stick.dy); if (L>8){ mx=stick.dx/L; my=stick.dy/L; } }
  if (G.hd==null){ G.hd=Math.atan2(G.vy,G.vx); G.bank=0; }
  let tvx, tvy; if (mx||my){ const L=Math.hypot(mx,my); tvx=mx/L*170; tvy=my/L*170; } else { tvx=Math.cos(G.hd)*50; tvy=Math.sin(G.hd)*50; }   // wie Laufen: Richtung = Eingabe
  G.vx+=(tvx-G.vx)*Math.min(1,dt*7); G.vy+=(tvy-G.vy)*Math.min(1,dt*7);
  if (Math.hypot(G.vx,G.vy)>8){ let d=Math.atan2(G.vy,G.vx)-G.hd; d=Math.atan2(Math.sin(d),Math.cos(d)); G.hd+=d*Math.min(1,dt*9); G.bank+=(Math.max(-1,Math.min(1,d*2))-G.bank)*Math.min(1,dt*5); }
  const nx=Math.max(20,Math.min(WW-20,jj.x+G.vx*dt)), ny=Math.max(20,Math.min(WH-20,jj.y+G.vy*dt)); const hb=bAt(nx,ny,0);
  if (hb&&hb.H>jj.h-2){ G.vx*=-.3; G.vy*=-.3; } else { jj.x=nx; jj.y=ny; }
  jj.h-=70*dt; jj.ang=Math.atan2(-G.vx,G.vy); jj.moving=false;
  const under=bAt(jj.x,jj.y,3), landH=under?under.H:0;
  if (jj.h<=landH){ jj.glide=null; if (under){ jj.h=under.H; jj.roof=under; } else { jj.h=0; jj.roof=null; if (blockedAt(jj.x,jj.y,9)){ const p=landNear(jj.x,jj.y); jj.x=p.x; jj.y=p.y; } } sfx("door"); } }
// Gleitschirm „Sunset Boulevard“ – Mitte im Ursprung, Vorderkante = -y
function drawGlider(q,t,rot){ const sh=()=>{ q.beginPath(); q.moveTo(-44,4); q.bezierCurveTo(-32,-18,32,-18,44,4); q.lineTo(41,11); q.bezierCurveTo(28,-4,-28,-4,-41,11); q.closePath(); };
  const g=q.createLinearGradient(-44,0,44,0); g.addColorStop(0,"#ff9a3c"); g.addColorStop(.45,"#ff4f7a"); g.addColorStop(1,"#7b3fe4"); q.fillStyle=g; sh(); q.fill();
  q.save(); sh(); q.clip(); q.fillStyle="#ffe08a"; q.beginPath(); q.arc(0,9,8,Math.PI,0); q.fill();
  q.fillStyle="rgba(30,10,40,.8)"; for (const [px,s2] of [[-30,1],[-21,.8],[22,.9],[31,1.05]]){ q.fillRect(px-.4,-5,1,13); for (let k=0;k<5;k++){ q.save(); q.translate(px,-5); q.rotate(-1.2+k*.6); q.beginPath(); q.ellipse(3*s2,0,3.2*s2,.9,0,0,7); q.fill(); q.restore(); } }
  q.strokeStyle="rgba(255,255,255,.2)"; q.lineWidth=.35; for (let x=-42;x<=42;x+=5.5){ q.beginPath(); q.moveTo(x,-14); q.lineTo(x,12); q.stroke(); }
  q.fillStyle="rgba(255,255,255,.22)"; q.beginPath(); q.moveTo(-34,-3); q.bezierCurveTo(-20,-13,20,-13,34,-3); q.lineTo(32,-1); q.bezierCurveTo(18,-10,-18,-10,-32,-1); q.closePath(); q.fill(); q.restore();
  { const txt="LOS ANGELES", mid=x=>((4-16.5*(1-(x/44)**2))+(11-11.25*(1-Math.min(1,(x/41)**2))))/2, flip=Math.cos(rot||0)<0;   // Schrift folgt der Wölbung
    q.font='400 7.5px "Bebas Neue",Impact,sans-serif'; q.textAlign="center"; q.textBaseline="middle"; q.lineWidth=1.8; q.strokeStyle="#1b0f24"; q.fillStyle="#fff";
    const ws=[...txt].map(c=>q.measureText(c).width+.6), tot=ws.reduce((a,b)=>a+b,0); let x=-tot/2;
    const pos=ws.map(w=>{ const cx=x+w/2; x+=w; return cx; }); const chars=[...txt];
    for (let i=0;i<chars.length;i++){ const cx=flip?-pos[i]:pos[i], cy=mid(cx), sl=Math.atan2(mid(cx+1)-mid(cx-1),2); q.save(); q.translate(cx,cy); q.rotate(sl+(flip?Math.PI:0)); q.strokeText(chars[i],0,0); q.fillText(chars[i],0,0); q.restore(); } }
  q.strokeStyle="#2a1236"; q.lineWidth=.8; sh(); q.stroke(); }
function drawJJAir(q,vx,vy){ if (jj.veh||jj.h<=0||jj.dead) return; const k=1+jj.h/D, X=vx+(jj.x-vx)*k, Y=vy+(jj.y-vy)*k; q.save(); q.translate(X,Y); q.scale(k,k); q.translate(-jj.x,-jj.y);
  drawPerson(q,jj,LOOK,{weapon:null}); q.restore();
  const G=jj.glide; if (G){ const t=performance.now()/1000, hd=G.hd!=null?G.hd:Math.atan2(G.vy,G.vx), bank=G.bank||0, hc=jj.h+70, kc=1+hc/D;
    const cxw=jj.x+Math.cos(hd)*15, cyw=jj.y+Math.sin(hd)*15, Xc=vx+(cxw-vx)*kc, Yc=vy+(cyw-vy)*kc, rot=hd+Math.PI/2+Math.sin(t*1.2)*.025, sc=kc*1.18, sx=1-Math.abs(bank)*.14;
    const pt=(lx,ly)=>{ const c=Math.cos(rot), s2=Math.sin(rot); lx*=sc*sx; ly*=sc; return [Xc+c*lx-s2*ly, Yc+s2*lx+c*ly]; };
    q.strokeStyle="rgba(35,25,30,.55)"; q.lineWidth=.7; for (const lx of [-40,-28,-14,14,28,40]){ const [ax,ay]=pt(lx,6+Math.abs(lx)*.05); q.beginPath(); q.moveTo(ax,ay); q.lineTo(X+(lx<0?-2:2)*k,Y); q.stroke(); }
    q.save(); q.translate(Xc,Yc); q.rotate(rot+bank*.12); q.scale(sc*sx,sc); drawGlider(q,t,rot); q.restore(); }
  tag(q,X,Y-24*k,"JJ"); }
function drawJJ(q){ if (jj.veh||jj.hidden) return; if (jj.h>0&&!jj.dead){ if (jj.glide){ const G=jj.glide, hd=G.hd!=null?G.hd:Math.atan2(G.vy,G.vx), hh=jj.h+70, sx=jj.x+hh*.45, sy=jj.y+hh*.17; q.fillStyle="rgba(30,15,40,.22)"; q.beginPath(); q.ellipse(sx,sy,46,12,hd+Math.PI/2,0,7); q.fill(); q.fillStyle="rgba(30,15,40,.25)"; q.beginPath(); q.ellipse(jj.x+jj.h*.45,jj.y+jj.h*.17,7,5,0,0,7); q.fill(); } return; }
  if (jj.swim&&!jj.dead){ const t=performance.now()/1000; q.save(); q.translate(jj.x,jj.y); for (let i=0;i<2;i++){ const ph=(t*.8+i*.5)%1; q.strokeStyle=`rgba(255,255,255,${.6*(1-ph)})`; q.lineWidth=1.5; q.beginPath(); q.ellipse(0,0,10+ph*16,7+ph*11,0,0,7); q.stroke(); }
    q.rotate(jj.ang); const sw=Math.sin(t*6)*5; q.fillStyle=LOOK.skin; q.beginPath(); q.arc(-9,2+sw,3,0,7); q.arc(9,2-sw,3,0,7); q.fill(); q.fillStyle="rgba(226,69,58,.55)"; q.beginPath(); q.ellipse(0,-2,9,5,0,0,7); q.fill();
    q.fillStyle=LOOK.skin; q.beginPath(); q.arc(0,1,5.4,0,7); q.fill(); q.fillStyle=LOOK.cap; q.beginPath(); q.arc(0,.2,5.3,Math.PI*.95,Math.PI*.05,false); q.fill(); q.restore(); tag(q,jj.x,jj.y-22,"JJ"); return; }
  if (jj.dead){ q.save(); q.translate(jj.x,jj.y); q.fillStyle="rgba(110,10,14,.55)"; q.beginPath(); q.ellipse(4,4,14,9,.5,0,7); q.fill(); q.rotate(1.3); q.scale(1,.8); q.translate(-jj.x,-jj.y); drawPerson(q,{x:jj.x,y:jj.y,ang:jj.ang,moving:false},LOOK); q.restore(); return; }
  drawPerson(q,jj,LOOK,(W.cur==="fist"||W.cur==="knuckles")&&performance.now()-(W.atkAt||-1e9)<1400?{punch:W.swing>0?1-W.swing/.28:0,side:W.side||1,knuckles:W.cur==="knuckles"}:W.cur==="fist"||W.cur==="knuckles"?{}:{weapon:W.cur,swing:W.swing}); tag(q,jj.x,jj.y-24,"JJ"); }

// ================= DRAW: buildings lifted toward the camera, textured walls =================
const FACE_LIGHT=[.82,1.0,1.08,.62];   // north, south(front), west, east
function wallQuad(q,a,c,ta,tc,tex,f,b){ const bands=8, tw=tex.width, th=tex.height;
  for (let i=0;i<bands;i++){ const t0=i/bands, t1=(i+1)/bands;
    const P=(t,u)=>[a[0]+(c[0]-a[0])*u+((ta[0]+(tc[0]-ta[0])*u)-(a[0]+(c[0]-a[0])*u))*t, a[1]+(c[1]-a[1])*u+((ta[1]+(tc[1]-ta[1])*u)-(a[1]+(c[1]-a[1])*u))*t];
    const p00=P(t0,0), p01=P(t0,1), p10=P(t1+.004,0); const sy=th*(1-t1), sh=th/bands+.6;
    q.save(); q.transform(p01[0]-p00[0],p01[1]-p00[1],p10[0]-p00[0],p10[1]-p00[1],p00[0],p00[1]); q.drawImage(tex,0,Math.max(0,sy),tw,Math.min(sh,th-Math.max(0,sy)),0,0,1,1); q.restore(); }
  // light by orientation
  q.fillStyle=f>=1?`rgba(255,220,170,${(f-1)*1.4})`:`rgba(25,15,45,${(1-f)*.9})`; q.beginPath(); q.moveTo(a[0],a[1]); q.lineTo(c[0],c[1]); q.lineTo(tc[0],tc[1]); q.lineTo(ta[0],ta[1]); q.closePath(); q.fill();
  q.strokeStyle="rgba(0,0,0,.25)"; q.lineWidth=1; q.stroke(); }
function drawCranes(q,vx,vy,t){ for (const c of CRANES){ if (Math.abs(c.x-vx)>1400||Math.abs(3200-vy)>1200) continue; const H=170, k=1+H/D, L=(x,y)=>[vx+(x-vx)*k,vy+(y-vy)*k];
    q.lineCap="round";
    for (const dx of [-28,28]) for (const y of [3096,3164]){ const [tx,ty]=L(c.x+dx,y); q.strokeStyle="#c8541f"; q.lineWidth=6; q.beginPath(); q.moveTo(c.x+dx,y); q.lineTo(tx,ty); q.stroke(); q.strokeStyle="rgba(255,255,255,.25)"; q.lineWidth=1.5; q.beginPath(); q.moveTo(c.x+dx-1,y); q.lineTo(tx-1,ty); q.stroke(); }
    const P=(x,y)=>L(x,y);
    q.fillStyle="#e2662a"; for (const y of [3096,3164]){ const a=P(c.x-34,y-5), b=P(c.x+34,y+5); q.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]); }
    const b0=P(c.x-9,3030), b1=P(c.x+9,3375); q.fillStyle="#e2662a"; q.fillRect(b0[0],b0[1],b1[0]-b0[0],b1[1]-b0[1]);
    q.strokeStyle="rgba(90,30,10,.7)"; q.lineWidth=1.2; for (let y=3030;y<3375;y+=14){ const a=P(c.x-9,y), b=P(c.x+9,y+14); q.beginPath(); q.moveTo(a[0],a[1]); q.lineTo(b[0],b[1]); q.stroke(); }
    const ty0=3200+Math.sin(t*.4+c.x)*90, tr=P(c.x-12,ty0-10), tr2=P(c.x+12,ty0+10); q.fillStyle="#2b2f36"; q.fillRect(tr[0],tr[1],tr2[0]-tr[0],tr2[1]-tr[1]);
    const hb=P(c.x-20,3110), hb2=P(c.x+20,3150); q.fillStyle="#f1f1ee"; q.fillRect(hb[0],hb[1],hb2[0]-hb[0],hb2[1]-hb[1]); q.fillStyle="#1d2733"; q.fillRect(hb[0]+4,hb[1]+4,hb2[0]-hb[0]-8,8); } }
function drawBuilding(q,b,vx,vy){ const k=1+b.H/D, X=vx+(b.x-vx)*k, Y=vy+(b.y-vy)*k, Wd=b.w*k, Ht=b.h*k;
  const A=[b.x,b.y], B=[b.x+b.w,b.y], C=[b.x+b.w,b.y+b.h], Dd=[b.x,b.y+b.h], tA=[X,Y], tB=[X+Wd,Y], tC=[X+Wd,Y+Ht], tD=[X,Y+Ht];
  if (Y>b.y) wallQuad(q,B,A,tB,tA,b.texH,FACE_LIGHT[0],b);           // north wall (seen when camera is south-of... above)
  if (Y+Ht<b.y+b.h) wallQuad(q,Dd,C,tD,tC,b.texH,FACE_LIGHT[1],b);   // south wall
  if (X>b.x) wallQuad(q,A,Dd,tA,tD,b.texV,FACE_LIGHT[2],b);          // west wall
  if (X+Wd<b.x+b.w) wallQuad(q,C,B,tC,tB,b.texV,FACE_LIGHT[3],b);    // east wall
  q.drawImage(b.roofC,X,Y,Wd,Ht);
  // warm sun kiss on the roof
  const sg=q.createLinearGradient(X,Y,X+Wd,Y+Ht); sg.addColorStop(0,"rgba(255,200,130,.10)"); sg.addColorStop(1,"rgba(40,20,60,.10)"); q.fillStyle=sg; q.fillRect(X,Y,Wd,Ht); }
function drawPalm(q,p,vx,vy,t){ const Hh=86*p.s, k=1+Hh/D, sway=Math.sin(t*1.1+p.ph)*2, tx=vx+(p.x-vx)*k+sway, ty=vy+(p.y-vy)*k;
  const dx=tx-p.x, dy=ty-p.y, L=Math.hypot(dx,dy)||1, nx=-dy/L, ny=dx/L, w0=5*p.s, w1=3*p.s;
  q.fillStyle="#6e5133"; q.beginPath(); q.moveTo(p.x+nx*w0,p.y+ny*w0); q.quadraticCurveTo(p.x+dx*.5+nx*w1*1.2+dx*.02,p.y+dy*.5+ny*w1,tx+nx*w1,ty+ny*w1); q.lineTo(tx-nx*w1,ty-ny*w1); q.quadraticCurveTo(p.x+dx*.5-nx*w1,p.y+dy*.5-ny*w1,p.x-nx*w0,p.y-ny*w0); q.closePath(); q.fill();
  q.strokeStyle="rgba(255,220,170,.25)"; q.lineWidth=1.4; q.beginPath(); q.moveTo(p.x+nx*w0*.6,p.y+ny*w0*.6); q.lineTo(tx+nx*w1*.6,ty+ny*w1*.6); q.stroke();
  q.strokeStyle="rgba(40,25,10,.45)"; q.lineWidth=1; for (let i=1;i<9;i++){ const f=i/9, x=p.x+dx*f, y=p.y+dy*f, w=w0+(w1-w0)*f; q.beginPath(); q.moveTo(x+nx*w,y+ny*w); q.lineTo(x-nx*w,y-ny*w); q.stroke(); }
  const s=108*p.s*k; q.save(); q.translate(tx,ty); q.rotate(Math.sin(t*.8+p.ph)*.03); q.drawImage(FRONDS[p.v],-s/2,-s/2,s,s); q.restore(); }
function drawTree(q,tr,vx,vy){ const Hh=44*tr.s, k=1+Hh/D, tx=vx+(tr.x-vx)*k, ty=vy+(tr.y-vy)*k; q.strokeStyle="#5a4028"; q.lineWidth=6*tr.s; q.lineCap="round"; q.beginPath(); q.moveTo(tr.x,tr.y); q.lineTo(tx,ty); q.stroke();
  const s=100*tr.s*k; q.drawImage(CANOPY[tr.kind][tr.v],tx-s/2,ty-s/2,s,s); }

// ================= UNLOCKS (missions will flip these later) =================
// Car/moto/boat stealing is always allowed. Weapons, heli and the private pickup are gated here.
const UNLOCK={bat:false,shotgun:false,scar:false,gl:false,rpg:false,alien:false,heli:false,pickup:false};

// ================= FX SPRITES =================
const puff=(c0,c1)=>mk(64,64,q=>{ const gr=q.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,c0); gr.addColorStop(.55,c1); gr.addColorStop(1,"rgba(0,0,0,0)"); q.fillStyle=gr; q.fillRect(0,0,64,64); });
const FX={smoke:puff("rgba(235,232,228,.9)","rgba(200,196,192,.45)"),dark:puff("rgba(40,36,36,.95)","rgba(30,28,28,.5)"),fire:puff("rgba(255,244,190,1)","rgba(255,120,30,.7)"),flash:puff("rgba(255,250,225,1)","rgba(255,170,60,.55)"),dust:puff("rgba(214,196,160,.8)","rgba(190,170,130,.35)")};
const SCORCH=mk(160,160,q=>{ const gr=q.createRadialGradient(80,80,6,80,80,78); gr.addColorStop(0,"rgba(16,12,10,.85)"); gr.addColorStop(.5,"rgba(26,20,16,.55)"); gr.addColorStop(1,"rgba(30,24,20,0)"); q.fillStyle=gr; q.fillRect(0,0,160,160);
  q.strokeStyle="rgba(10,8,6,.5)"; q.lineWidth=2; for (let i=0;i<14;i++){ const a=rnd()*6.28; q.beginPath(); q.moveTo(80,80); q.lineTo(80+Math.cos(a)*(40+rnd()*36),80+Math.sin(a)*(40+rnd()*36)); q.stroke(); } });
const parts=[];
function emit(type,x,y,o){ if (parts.length>520) parts.shift(); parts.push(Object.assign({type,x,y,vx:0,vy:0,life:1,max:1,size:20,grow:1,rot:rnd()*6,vr:0,z:0},o)); }
function updParts(dt){ for (let i=parts.length-1;i>=0;i--){ const p=parts[i]; p.life-=dt; if (p.life<=0){ parts.splice(i,1); continue; }
  p.x+=p.vx*dt; p.y+=p.vy*dt; const f=p.type==="debris"||p.type==="spark"?Math.pow(.12,dt):Math.pow(.4,dt); p.vx*=f; p.vy*=f; p.size+=p.grow*dt; p.rot+=p.vr*dt;
  if (p.type==="smoke"||p.type==="dark"){ p.vx+=14*dt; p.vy-=10*dt; } } }
function drawParts(q,layer){ for (const p of parts){ const t=p.life/p.max;
  if (layer===0&&(p.type==="debris"||p.type==="spark")){ if (p.type==="spark"){ q.strokeStyle=`rgba(255,${190+Math.round(60*t)},120,${t})`; q.lineWidth=1.6; q.beginPath(); q.moveTo(p.x,p.y); q.lineTo(p.x-p.vx*.03,p.y-p.vy*.03); q.stroke(); }
      else { q.save(); q.translate(p.x,p.y); q.rotate(p.rot); q.fillStyle=p.col||"#2a2522"; q.globalAlpha=Math.min(1,t*3); q.fillRect(-p.size/2,-p.size/2,p.size,p.size*.6); q.restore(); q.globalAlpha=1; } continue; }
  if (layer===1&&(p.type==="smoke"||p.type==="dark"||p.type==="dust")){ q.globalAlpha=(p.a||.7)*Math.min(1,t*1.6)*Math.min(1,(1-t)*6+.2); const s=p.size; q.drawImage(FX[p.type],p.x-s/2,p.y-s/2,s,s); }
  if (layer===2&&(p.type==="fire"||p.type==="flash")){ q.globalCompositeOperation="lighter"; q.globalAlpha=Math.min(1,t*1.4)*(p.a||1); const s=p.size; q.drawImage(FX[p.type],p.x-s/2,p.y-s/2,s,s); q.globalCompositeOperation="source-over"; } }
  q.globalAlpha=1; }
let shake=0;

// ================= SOUND =================
let AC=null, master=null, eng=null;
function resumeAudio(){ if (AC&&AC.state!=="running"&&AC.state!=="closed") try{ AC.resume().catch(()=>{}); }catch(e){} }
for (const ev of ["pointerdown","touchend","keydown"]) addEventListener(ev,resumeAudio,{capture:true,passive:true});
document.addEventListener("visibilitychange",()=>{ if (!document.hidden) resumeAudio(); });
function initAudio(){ if (AC) return; try{ if (navigator.audioSession) navigator.audioSession.type="playback"; }catch(e){} try{ AC=new (window.AudioContext||window.webkitAudioContext)(); master=AC.createGain(); master.gain.value=.55; master.connect(AC.destination);
  const o=AC.createOscillator(), f=AC.createBiquadFilter(), gn=AC.createGain(); o.type="sawtooth"; o.frequency.value=50; f.type="lowpass"; f.frequency.value=420; gn.gain.value=0; o.connect(f); f.connect(gn); gn.connect(master); o.start(); eng={o,f,gn}; }catch(e){ AC=null; } }
function noiseBuf(){ const b=AC.createBuffer(1,AC.sampleRate*1.2,AC.sampleRate), d=b.getChannelData(0); for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return b; }
let NB=null;
function sfx(kind){ if (!AC||(typeof SET!=="undefined"&&SET.sfx===false)) return; if (!NB) NB=noiseBuf(); const t=AC.currentTime, src=AC.createBufferSource(), f=AC.createBiquadFilter(), gn=AC.createGain(); src.buffer=NB; src.connect(f); f.connect(gn); gn.connect(master);
  const env=(a,d,v)=>{ gn.gain.setValueAtTime(0,t); gn.gain.linearRampToValueAtTime(v,t+a); gn.gain.exponentialRampToValueAtTime(.001,t+a+d); src.start(t); src.stop(t+a+d+.05); };
  if (kind==="shot"){ f.type="lowpass"; f.frequency.setValueAtTime(3000,t); f.frequency.exponentialRampToValueAtTime(300,t+.25); env(.002,.3,.9); }
  else if (kind==="boom"){ f.type="lowpass"; f.frequency.setValueAtTime(900,t); f.frequency.exponentialRampToValueAtTime(60,t+1.1); env(.01,1.3,1.2); }
  else if (kind==="rocket"){ f.type="bandpass"; f.frequency.value=900; env(.02,.6,.5); }
  else if (kind==="hit"){ f.type="lowpass"; f.frequency.value=700; env(.002,.12,.7); }
  else if (kind==="swing"){ f.type="bandpass"; f.frequency.setValueAtTime(600,t); f.frequency.linearRampToValueAtTime(2000,t+.15); env(.04,.12,.25); }
  else if (kind==="crash"){ f.type="lowpass"; f.frequency.value=1400; env(.002,.35,.8); }
  else if (kind==="door"){ f.type="lowpass"; f.frequency.value=500; env(.002,.08,.6); }
  else if (kind==="reload"){ f.type="highpass"; f.frequency.value=2500; env(.002,.05,.4); }
  else if (kind==="ping"){ const o=AC.createOscillator(), g2=AC.createGain(); o.frequency.setValueAtTime(880,t); o.frequency.setValueAtTime(1320,t+.09); g2.gain.setValueAtTime(.12,t); g2.gain.exponentialRampToValueAtTime(.001,t+.3); o.connect(g2); g2.connect(master); o.start(t); o.stop(t+.32); } }

