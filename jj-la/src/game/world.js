"use strict";
// ================= WORLD LAYOUT =================
const WW=10900, LANDW=9400, CITYW=7400, WH0=3700, WH=6500, D=900, AX=4540;
// Bodenbild: Festland (0..WH0) + zweites Bild nur um die Insel Santa Luna (G2), Rest = offenes Meer
const G2={x:1900,y:WH0,w:6200,h:WH-WH0};
const R=(x,y,w,h)=>({x,y,w,h});
// Villa-Innenraum: liegt versteckt im Meer und wird nur während des Coups benutzt
let INROOM=false; const VR={x:5040,y:3410,w:780,h:260}, VILLA_VR={x:5040,y:3410,w:780,h:260};
const inVR=(x,y)=>INROOM&&x>VR.x&&x<VR.x+VR.w&&y>VR.y&&y<VR.y+VR.h;
// Küstenlinie ringsum (links, oben, rechts) – dahinter nur Wasser
const SHL=y=>78+12*Math.sin(y*.006)+7*Math.sin(y*.017+1), SHT=x=>92+12*Math.sin(x*.005+2)+7*Math.sin(x*.013), SHR=y=>LANDW-50-8*Math.sin(y*.007+.5);
const NEI={cx:10180,cy:1010,rx:520,ry:540}, NEBR=R(9270,948,470,124), G3={x:9200,y:0,w:1700,h:1900};
const neR=a=>1+.06*Math.sin(3*a+.7)+.04*Math.sin(5*a+1.9)+.03*Math.sin(8*a);
const onNEIsle=(x,y,m=0)=>{ const dx=(x-NEI.cx)/NEI.rx, dy=(y-NEI.cy)/NEI.ry, a=Math.atan2(dy,dx); return Math.hypot(dx,dy)<neR(a)-m; };
const onNEBridge=(x,y)=>x>NEBR.x&&x<NEBR.x+NEBR.w&&y>NEBR.y&&y<NEBR.y+NEBR.h;
const onNE=(x,y)=>onNEIsle(x,y,.02)||onNEBridge(x,y);
const beyondShore=(x,y,r)=>x-r<SHL(y)||y-r<SHT(x)||(x+r>SHR(y)&&!onNE(x,y));
const roads=[], walks=[], solids=[], buildings=[], palms=[], trees=[];
roads.push(R(0,1640,LANDW,140));            // the avenue
roads.push(R(1850+AX,1300,110,340));     // airport access
roads.push(R(1850,700,110,940));         // Westside avenue
roads.push(R(300+AX,1300,1660,100));     // terminal curb road
roads.push(R(150,1300,1700,100)); roads.push(R(150,700,1700,100)); roads.push(R(900,800,110,500));   // Westside streets
roads.push(R(1100,1780,110,700));        // residential connector
roads.push(R(150,2480,1900,100));        // JJ's street
roads.push(R(1100,2580,110,380));        // down to the beach
roads.push(R(150,2960,1900,90));         // Ocean Front
roads.push(R(2050,2960,CITYW-2050,90));     // Ocean Front east (Palm Heights + Hafen)
roads.push(R(2050,2480,CITYW-2050,100));
roads.push(R(8370,1060,100,580)); roads.push(R(8160,960,520,100));   // Zufahrt Hollywood-Sign (Aussichtspunkt)    // Palm Drive (continues to the harbour)
roads.push(R(6880,1290,110,350));       // Zufahrt Gefängnis
roads.push(R(4640,1780,110,1180)); roads.push(R(5560,1780,110,1180));   // harbour avenues
roads.push(R(2800,1780,110,1180)); roads.push(R(4000,1780,110,1180));   // Palm Heights avenues
const DX=[2200,2800,3400,4000], DY=[300,900];
for (const x of DX) roads.push(R(x,300,110,1340));
for (const y of DY) roads.push(R(2200,y,1910,110));
// Santa Luna: Ringstraße, Mittelachse, Querstraße + zwei Brücken vom Festland
const SLR={top:R(2400,4080,5150,110),bot:R(2400,5860,5150,110),left:R(2400,4080,110,1890),right:R(7440,4080,110,1890),mid:R(4900,4190,110,1670),east:R(5010,4980,2430,110)};
for (const k in SLR) roads.push(SLR[k]);
roads.push(R(2800,3050,110,1030)); roads.push(R(7000,3050,110,1030));
for (const r of roads){ if (r.x<120){ r.w-=120-r.x; r.x=120; } if (r.x+r.w>LANDW-70) r.w=LANDW-70-r.x; }
// Nordost-Insel "Bel Air Key": Straße von den Hills über die Brücke zur Villa
const NEROADS=[R(8680,960,620,100),R(9290,960,380,100),R(9670,960,860,100)]; roads.push(...NEROADS);
for (const r of roads) walks.push(R(r.x-26,r.y-26,r.w+52,r.h+52));
var BANKB=null, MUSB=null; const BLOCKS=[]; for (let i=0;i<3;i++) for (let j=0;j<2;j++){ const x0=DX[i]+136, x1=DX[i+1]-26, y0=DY[j]+136, y1=j?1614:DY[1]-26; BLOCKS.push(R(x0,y0,x1-x0,y1-y0)); }
let bid=0;
function tower(x,y,w,h,H,style,col){ const b={id:bid++,x,y,w,h,H,style,col}; buildings.push(b); solids.push(R(x,y,w,h)); return b; }
{ const [a,b,c,d,e,f]=BLOCKS;
  tower(a.x+18,a.y+18,250,200,520,"crown","#5d7fa3"); tower(a.x+300,a.y+30,150,170,300,"stone","#c7a27c"); tower(a.x+40,a.y+260,190,190,240,"slab","#9a9a98"); tower(a.x+260,a.y+250,190,210,380,"glass","#3f6d8f");
  tower(b.x+30,b.y+20,180,330,600,"glass","#2f5f86"); tower(b.x+250,b.y+40,190,170,340,"stone","#d4b48c"); tower(b.x+250,b.y+250,200,200,450,"crown","#6d7f8f");
  tower(c.x+20,c.y+30,210,200,420,"slab","#8b939c"); tower(c.x+270,c.y+20,170,420,300,"glass","#4b84a8");
  BANKB=tower(d.x+20,d.y+30,398,330,96,"stone","#e9dfcf");
  tower(f.x+30,f.y+30,220,220,500,"crown","#4f6f8c"); tower(f.x+290,f.y+60,150,150,260,"glass","#5a8fb2"); tower(f.x+60,f.y+330,380,120,140,"slab","#958f86");
  e.plaza=true; }
MUSB=tower(7900,1110,440,280,64,"stone","#f1eadc");
var NEVILLA=Object.assign(tower(9990,700,330,206,58,"modern","#f6f5f1"),{lux:true}), NEGARAGE=tower(10370,768,170,136,30,"slab","#d9d5cc");
const NEPOOL=R(10040,548,230,96); solids.push(NEPOOL);
const AIR={runway:R(120+AX,380,1760,140),taxi:R(200+AX,690,1600,60),apron:R(300+AX,750,1400,330)};
// Flughafen-Befeuerung: Randfeuer weiß, Schwelle grün, Ende rot, Anflug-Lichter, Rollweg grün/blau
const AIRL=[]; { const rw=AIR.runway;
  for (let x=rw.x+170;x<=rw.x+rw.w-170;x+=120) for (const y of [rw.y-8,rw.y+rw.h+8]){ if (y>rw.y&&[400,1000,1600].some(x0=>Math.abs(x-(x0+AX))<50)) continue; AIRL.push({x,y,c:"#fff4d6",k:"edge"}); } }
const TUNNELS=[R(640+AX,1080,100,170),R(1310+AX,1080,100,170)];
tower(350+AX,1080,290,170,46,"terminal","#e9e4da"); tower(740+AX,1080,570,170,46,"terminal","#e9e4da"); tower(1410+AX,1080,240,170,46,"terminal","#e9e4da");
for (const t of TUNNELS) roads.push(R(t.x,1080,t.w,220));
tower(1740+AX,880,70,70,190,"ctower","#d9dde0");
// ---------- Sunset Strip (Clubs, Kino, Restaurants, Foodtrucks)
const VENUES=[];
function venue(x,y,w,h,H,col,sign,neon,icon,face,o){ const b=tower(x,y,w,h,H,"venue",col); Object.assign(b,{sign,neon,icon,face},o||{}); VENUES.push(b); return b; }
venue(200,410,300,240,70,"#2a2433","CLUB NEON","#ff2bd6","disco","s",{carpet:true});
venue(560,380,300,270,80,"#5a1d24","CINEMA ROYAL","#ffd23f","film","s",{marquee:true});
venue(920,420,250,230,60,"#231a3a","VELVET","#9a6bff","disco","s",{carpet:true});
venue(1230,470,200,180,40,"#e8dcc6","LUIGI'S","#2fd38a","pizza","s");
venue(1490,450,240,200,44,"#f2c14e","BURGER BROS","#ff7a1f","burger","s");
venue(210,870,330,220,56,"#2b1a2a","PINK FLAMINGO","#ff4fa3","flamingo","n",{carpet:true});
venue(610,880,220,170,40,"#efe7da","SAKURA SUSHI","#ff3b4a","sushi","n");
venue(1510,880,270,200,50,"#3b2a1f","EL DORADO","#ffb347","fork","n");
venue(220,1452,150,130,34,"#24161f","DRIP STORE","#ff5fb4","star","n");
venue(420,1452,160,130,30,"#d9d2c4","LIQUOR","#ff3b4a","star","n");
venue(640,1452,160,130,32,"#c9a77a","SLICE","#ffd23f","pizza","n");
venue(1080,1440,300,150,110,"#3d4f6a","HOTEL SUNSET","#ff8fd8","star","n");
venue(1460,1456,200,124,30,"#1a2340","ARCADE","#39ff88","star","n");
const PLAZA=R(1070,850,400,410), TRUCKS=[];
for (const [x,y,w,h,col,sign] of [[1100,890,120,50,"#ff5a36","TACO LOCO"],[1100,1000,120,50,"#3aa0ff","KOREAN BBQ"],[1300,930,52,120,"#ffd23f","CHURROS"]]){ const t=tower(x,y,w,h,26,"truck",col); t.sign=sign; TRUCKS.push(t); }
const PTABLES=[]; for (const [x,y] of [[1130,1110],[1220,1110],[1130,1185],[1220,1185],[1390,1110],[1390,1185]]){ PTABLES.push({x,y}); solids.push(R(x-16,y-9,32,18)); }
// ---------- Gefängnis (LA County Jail) zwischen Downtown und Flughafen
const JAILR=R(6680,420,480,860), JDOOR={x:7180,y:722}, JYARD=R(6730,760,380,280);
tower(6680,420,480,18,46,"pwall","#a9a49a"); tower(6680,1262,200,18,46,"pwall","#a9a49a"); tower(6990,1262,170,18,46,"pwall","#a9a49a");
tower(6680,438,18,824,46,"pwall","#a9a49a"); tower(7142,438,18,824,46,"pwall","#a9a49a");
tower(6880,1256,110,30,40,"pgate","#4a4f55");
for (const [x,y] of [[6664,404],[7126,404],[6664,1246],[7126,1246]]) tower(x,y,48,48,130,"gtower","#8f8a80");
tower(6740,490,360,220,96,"prison","#bdb7aa"); tower(6740,1080,170,140,56,"slab","#9aa3ab"); tower(6960,1090,140,120,40,"slab","#a7aeb5");
// Harbour / industry (south-east)
{ const H=[[4800,1840,330,190],[5200,1860,290,160],[5760,1840,360,210],[6200,1880,260,170],[4800,2120,280,250],[5160,2140,320,230],[5760,2130,300,240],[6150,2120,320,250],[4820,2620,360,250],[5250,2640,240,230],[5760,2620,340,260],[6180,2640,300,230]];
  H.forEach(([x,y,w,h],i)=>(i===8||i===10)?0:tower(x,y,w,h,60+(i%3)*25,"warehouse",["#7f93ab","#9b5a3c","#d8d5ce","#5f7d6a","#b8a07a"][i%5])); }
const PLANES=[{x:860+AX,y:900,a:-Math.PI/2,c:"#c0392b"}];
for (const p of PLANES){ p.hx=p.x; p.hy=p.y; p.ha=p.a; p.sol=[R(p.x-13,p.y-84,26,168),R(p.x-80,p.y-20,160,40),R(p.x-34,p.y+56,68,26)]; solids.push(...p.sol); }
// ---------- Hafen: Containerlager, Kai, Kräne, Frachter
const QUAY_Y=3180, CYARDS=[R(4820,2620,360,250),R(5760,2620,340,260)], CONTS=[];
{ const hsh=i=>((Math.sin(i*12.9898+4.1)*43758.5453)%1+1)%1, cols=["#b8392d","#2e6da4","#e07a22","#2f9a58","#7d868c","#7a4b9a","#c9a21a","#1f7f8c"]; let k=0;
  const row=(x0,y0,x1)=>{ for (let x=x0;x+70<=x1;x+=74){ k++; if (hsh(k)<.13) continue; CONTS.push({x,y:y0,w:70,h:26,c:cols[Math.floor(hsh(k*3.7)*cols.length)],st:1+Math.floor(hsh(k*7.3)*3)}); solids.push(R(x,y0,70,26)); } };
  for (const Y of CYARDS) for (let y=Y.y+14;y+26<=Y.y+Y.h-12;y+=42) row(Y.x+12,y,Y.x+Y.w-10);
  for (const y of [3070,3112]) row(5800,y,6460); }
const CRANES=[{x:5120},{x:5420}], SHIP={x:5330,y:3262,l:660,w:92};
for (const c of CRANES) for (const dx of [-32,24]) for (const y of [3092,3160]) solids.push(R(c.x+dx,y,8,8));
// ---------- Nachbarschaft rund um Onkel Bobbys Haus
const NBR1=tower(230,2170,170,130,30,"house","#e3d3bd"), NBR2=tower(290,2700,180,130,30,"house","#d9e4ea");
const YGARB=tower(1610,2752,150,104,34,"slab","#8f979f"), GARAGE=tower(660,2700,230,140,38,"slab","#b9b2a6"), DINER=tower(1300,2250,210,120,34,"slab","#e9c9a0"), LAUNDRY=tower(1330,2700,190,120,32,"slab","#cfdbe3");
const HOUSE=tower(620,2140,250,190,32,"house","#ecdcc0");
const SHOPB=tower(1535,1904,130,96,30,"shop","#e9d6b8"); const SHOP={x:1600,y:1886}; const CLO={x:295,y:1434}; const RICO={x:GARAGE.x+GARAGE.w/2,y:GARAGE.y-14};
const DOOR={x:HOUSE.x+HOUSE.w/2,y:HOUSE.y+HOUSE.h+14};
const EARL={x:DOOR.x+66,y:DOOR.y+42};   // neben dem Weg, nicht vor dem Schild
const POOL=R(650,1890,190,110); solids.push(POOL);
// Palm Heights: mansion lots (top row faces south onto Palm Drive, bottom row faces north)
const LOTS=[], RICHPOOLS=[], POOLS_ANIM=[];
{ const cols=[[2150,2774,2],[2936,3974,3],[4136,4560,1]];
  for (const [x0,x1,n] of cols){ const lw=(x1-x0)/n; for (let i=0;i<n;i++){ const lx=x0+i*lw;
    for (const top of [true,false]){ const ly=top?1806:2606, lh=top?648:328, hw=Math.min(230,lw-90), hh=top?160:130, hx=lx+(lw-hw)/2, hy=top?ly+lh-280:ly+86;
      const style=(LOTS.length%2)?"modern":"villa", col=style==="villa"?["#efe2c8","#f3e6d3","#ead8bc"][LOTS.length%3]:"#f4f4f1";
      const b=tower(hx,hy,hw,hh,top?54:44,style,col); const pw=Math.min(150,hw-40), ph=top?70:46, pool=top?R(hx+(hw-pw)/2,hy-120,pw,ph):R(hx+(hw-pw)/2,hy+hh+40,pw,ph);
      solids.push(pool); RICHPOOLS.push(pool); LOTS.push({lx,ly,lw,lh,top,b,pool,drive:top?R(hx+hw-60,hy+hh,46,ly+lh-(hy+hh)):R(hx+hw-60,ly,46,hy-ly),tennis:top&&n===1}); } } } }
const WATER_Y=3250, waterY0=x=>WATER_Y+16*Math.sin(x*.0037)+9*Math.sin(x*.0113+1.3), waterY=x=>x<4560?waterY0(x):x<=4660?waterY0(x)+(QUAY_Y-waterY0(x))*(x-4560)/100:x<=CITYW?QUAY_Y:x<CITYW+160?QUAY_Y+(waterY0(x)-QUAY_Y)*(x-CITYW)/160:waterY0(x);
const LAKE={x:8380,y:2420,rx:760,ry:440}, lakeB=a=>1+.07*Math.sin(3*a+1)+.05*Math.sin(5*a+2.2)+.03*Math.sin(8*a);
const lakeR=(x,y)=>{ const dx=(x-LAKE.x)/LAKE.rx, dy=(y-LAKE.y)/LAKE.ry; return Math.hypot(dx,dy)/lakeB(Math.atan2(dy,dx)); }, inLake=(x,y)=>x>7500&&y>1900&&lakeR(x,y)<1;
const SIGNY=650; const HILL={x:8380,y:720,rx:1020,ry:660}, hillH=(x,y)=>{ const d=Math.hypot((x-HILL.x)/HILL.rx,(y-HILL.y)/HILL.ry); return d>=1?0:Math.pow(Math.cos(d*Math.PI/2),1.5)*.6; };
const PIERS=[R(940,3040,60,420),R(900,3400,140,70),R(8350,1905,44,150)];
const onPier=(x,y)=>PIERS.some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h);
const ISLANDS=[{x:3900,y:3535,r:95}], SHALLOW=140;
const onIsland=(x,y)=>ISLANDS.some(i=>Math.hypot(x-i.x,y-i.y)<i.r);
// ================= SANTA LUNA (Insel im Süden) =================
const SL={x0:2150,x1:7750,y0:3940,y1:6130,r:420,cape:{x:4955,y:6230,r:150}};
const islD=(x,y)=>{ const cx=(SL.x0+SL.x1)/2, cy=(SL.y0+SL.y1)/2, hx=(SL.x1-SL.x0)/2-SL.r, hy=(SL.y1-SL.y0)/2-SL.r, qx=Math.abs(x-cx)-hx, qy=Math.abs(y-cy)-hy;
  const a=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-SL.r, b=Math.hypot(x-SL.cape.x,y-SL.cape.y)-SL.cape.r, k=160, h=Math.max(k-Math.abs(a-b),0)/k;
  return Math.min(a,b)-h*h*k/4+13*Math.sin(x*.0061+y*.002)+9*Math.sin(y*.0093+x*.004+1.7)+5*Math.sin(x*.023+2); };
const SLCOAST=[];
const onBigIsland=(x,y)=>y>3860&&x>2000&&x<7900&&islD(x,y)<0;
const BRIDGES=[R(2800,3050,110,1040),R(7000,3050,110,1040)];
const onBridge=(x,y)=>y>3050&&y<4090&&BRIDGES.some(r=>x>r.x-30&&x<r.x+r.w+30);
for (const b of BRIDGES) solids.push(R(b.x-36,3160,6,880),R(b.x+b.w+30,3160,6,880));   // Geländer
// Speedway: Stadion-Oval (Mittellinie = Abstand zur Strecke zwischen zwei Kurvenmittelpunkten)
const SPW={c1:{x:3120,y:5030},c2:{x:4290,y:5030},r:470,w:130,fx:3705};
const spwD=(x,y)=>{ const cx=Math.max(SPW.c1.x,Math.min(SPW.c2.x,x)); return Math.abs(Math.hypot(x-cx,y-SPW.c1.y)-SPW.r); };
// Luna Park
const FW={x:5450,y:4690,hz:215,r:178,n:14}, CRS={x:5850,y:4560,r:78}, DTW={x:6075,y:4400,h:330}, LH={x:4955,y:6215,h:250};
const CST=(()=>{ const N=200, P=[]; for (let i=0;i<N;i++){ const s=i/N*6.2832; P.push({x:6790+520*Math.cos(s)+60*Math.cos(3*s),y:4580+220*Math.sin(s)+45*Math.sin(2*s),z:34+60*(1+Math.sin(2*s+.6))+95*Math.pow(Math.max(0,Math.sin(s-1.2)),3)}); }
  let L=0; for (let i=0;i<N;i++){ const a=P[i], b=P[(i+1)%N], c=P[(i+N-1)%N]; a.l=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z); L+=a.l; const tx=b.x-c.x, ty=b.y-c.y, tl=Math.hypot(tx,ty)||1; a.nx=-ty/tl; a.ny=tx/tl; }
  return {P,N,L,zmax:Math.max(...P.map(p=>p.z)),i:0,d:0}; })();
solids.push(R(FW.x-130,FW.y-42,260,84),R(CRS.x-70,CRS.y-70,140,140),R(DTW.x-18,DTW.y-18,36,36),R(LH.x-26,LH.y-26,52,52));
const inWater=(x,y)=>(y>waterY(x)||inLake(x,y))&&!onPier(x,y)&&!onIsland(x,y)&&!inVR(x,y)&&!onBridge(x,y)&&!onBigIsland(x,y);
const deepWater=(x,y)=>inWater(x,y)&&y>waterY(x)+SHALLOW;
const YACHT={x:2620,y:3505,l:200,w:56}, SAILS=[{x:1760,y:3470,a:.3,c:"#e84a5f"},{x:3330,y:3430,a:-.5,c:"#2a9df4"}], RAFT={x:1230,y:3500,w:74,h:54};
const WSOLID=[R(SHIP.x-SHIP.l/2-10,SHIP.y-SHIP.w/2,SHIP.l+40,SHIP.w),R(YACHT.x-YACHT.l/2,YACHT.y-YACHT.w/2,YACHT.l,YACHT.w),R(RAFT.x-RAFT.w/2,RAFT.y-RAFT.h/2,RAFT.w,RAFT.h),...SAILS.map(b=>R(b.x-38,b.y-20,76,40))];
const inWSolid=(x,y)=>WSOLID.some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h);
const HELIPAD={x:6880,y:2150};
venue(7070,1890,210,120,30,"#24313f","MO'S HELI","#58d0ff","star","s");
// Bel Air Key: kleines Wohngebiet mit Restaurants
const NEHOOD=[tower(9950,1110,120,96,30,"villa","#efe2c8"),tower(10110,1110,120,96,34,"modern","#f4f4f1"),tower(10270,1110,120,96,30,"villa","#f3e6d3"),tower(9930,1300,130,100,32,"modern","#f4f4f1"),tower(10130,1320,130,100,30,"villa","#ead8bc"),
  venue(9760,1110,150,100,30,"#1f3b4d","OCEAN GRILL","#58d0ff","fork","n"),venue(10430,1110,140,96,28,"#efe7da","SUSHI KEY","#ff3b4a","sushi","n")];
const palm=(x,y,s)=>palms.push({x,y,s:s||1,ph:Math.random()*6,v:palms.length%3});
const tree=(x,y,s,kind)=>trees.push({x,y,s:s||1,kind:kind||"oak",v:trees.length%4});
const vCross=(x,y0,y1)=>roads.some(r=>r.h>r.w&&r.y<y1&&r.y+r.h>y0&&x>r.x-40&&x<r.x+r.w+40);
for (let x=80;x<LANDW;x+=150){ if (!vCross(x,1600,1660)) palm(x,1608,1); if (!vCross(x+75,1760,1830)) palm(x+75,1812,.95); }
for (let x=200;x<2000;x+=170) palm(x,2448,.9);
for (let x=230;x<2000;x+=170) palm(x,2612,.9);
for (const x of [430,700,1000,1300,1580]) palm(x+AX,1442,1);
for (let x=210;x<2000;x+=170){ if (Math.abs(x-1155)>90) palm(x,2928,.9); if (x<880||x>1060) palm(x+60,3096,1); }
for (const [x,y,s2] of [[9720,880,1],[9760,1270,.9],[9880,1440,1],[10060,1480,.9],[10300,1470,.95],[10480,1290,.9],[10640,880,1],[9860,600,.9],[10440,600,.95],[9960,580,.85],[10360,580,.9],[10620,1150,.9]]) palm(x,y,s2);
palm(3880,3515,1); palm(3930,3555,.85); for (let x=4700;x<CITYW-60;x+=150) palm(x,3096,1);
for (let x=2140;x<4560;x+=150){ const nearV=[2800,4000].some(d=>x>d-40&&x<d+150); if (!nearV){ palm(x,2448,1.05); palm(x+60,2612,1.05); palm(x+30,2928,.95); } palm(x+75,3096,1); }
for (let y=1840;y<2950;y+=140){ if (Math.abs(y-2530)<90) continue; for (const vx of [2800,4000]){ palm(vx-16,y,1); palm(vx+126,y+70,1); } }
palm(HOUSE.x-30,HOUSE.y+40,1.05); palm(HOUSE.x+HOUSE.w+40,HOUSE.y+20,.95); palm(POOL.x-26,POOL.y+30,.9);
{ const e=BLOCKS[4]; for (const [fx,fy] of [[.15,.18],[.85,.18],[.15,.82],[.85,.82]]) palm(e.x+e.w*fx,e.y+e.h*fy,1.05);
  for (const [fx,fy] of [[.32,.3],[.68,.3],[.32,.7],[.68,.7]]) tree(e.x+e.w*fx,e.y+e.h*fy,1.1,"jacaranda"); }
for (const [x,y,s,k] of [[420,2050,1.1,"oak"],[1010,2120,1,"jacaranda"],[300,2300,1.2,"oak"],[1400,2060,1,"oak"],[1650,2200,1.15,"jacaranda"],[1480,2350,.9,"oak"],[380,2780,1.1,"oak"],[900,2800,1,"jacaranda"],[1500,2760,1.1,"oak"],[1800,2050,1,"oak"]]) tree(x,y,s,k);
// Santa Luna: Gebäude + Palmen; keine Palmen auf den Brückenköpfen
venue(3250,4280,900,100,60,"#2b2f3a","SPEEDWAY","#ff3b30","star","s");
tower(3240,5690,900,100,34,"warehouse","#9aa3ad");
venue(5060,4240,230,120,46,"#3a1f4a","LUNA PARK","#ff5fd2","star","s");
venue(6000,4830,120,90,26,"#e8dcc6","TACOS","#2fd38a","fork","n");
venue(6160,4830,120,90,26,"#7a1f24","BURGER","#ffd23f","burger","n");
venue(5080,5150,280,150,44,"#e9e4da","COUNTRY CLUB","#2fd38a","star","s");
for (let i=palms.length-1;i>=0;i--){ const q=palms[i]; if (BRIDGES.some(b=>q.x>b.x-60&&q.x<b.x+b.w+60&&q.y>3000)) palms.splice(i,1); }
for (let x=2460;x<7520;x+=170){ if (BRIDGES.some(b=>x>b.x-120&&x<b.x+b.w+120)) continue; palm(x,4022,.95+((x/170)%3)*.05); if (Math.abs(x-4955)>140) palm(x+60,6046,1); }
for (const [x,y,sz] of [[2570,4300,1],[2570,4460,.95],[2570,5640,1],[2570,5790,.9],[4840,4300,1],[4840,5790,1],[5100,4420,1],[5100,4600,.95],[5100,4780,1],[7360,4280,1],[7380,4900,.95],[5480,5180,1],[5620,5200,.9],[7340,5180,1],[7340,5780,1],[6200,5800,.95],[5800,5420,1.05],[6640,5150,1],[5320,4860,.9],[6450,4900,1]]) palm(x,y,sz);
for (let i=palms.length-1;i>=0;i--){ const p=palms[i]; if (LOTS.some(L=>p.x>L.drive.x-30&&p.x<L.drive.x+L.drive.w+30&&p.y>L.ly-40&&p.y<L.ly+L.lh+40&&Math.abs(p.y-(L.top?L.ly+L.lh:L.ly))<60)) palms.splice(i,1); }
// Palmen: Stamm liegt unter der Krone verdeckt → keine Kollision (sonst unsichtbare Wände)
trees.length=0;
const ZONES=[{n:"BEL AIR KEY",s:L2("Inselviertel · Strand & Villen","Island quarter · beach & villas"),r:R(9290,440,1450,1180)},{n:"SPEEDWAY",s:"Santa Luna · Rundenzeit fahren",r:R(2510,4190,2390,1670)},{n:"LUNA PARK",s:"Santa Luna · Freizeitpark",r:R(5010,4190,2430,790)},{n:"GOLFCLUB",s:"Santa Luna · Country Club",r:R(5010,5090,2430,770)},{n:"LEUCHTTURM",s:"Santa Luna · Kap",r:R(4700,5975,520,420)},{n:"SANTA LUNA",s:"Die Insel",r:R(2000,3880,5900,2520)},{n:"BRÜCKE",s:"Nach Santa Luna",r:R(2740,3260,230,620)},{n:"BRÜCKE",s:"Nach Santa Luna",r:R(6940,3260,230,620)},{n:"VILLA",s:"Palm Heights · Party",r:R(VR.x,VR.y,VR.w,VR.h)},{n:"LAKE HOLLYWOOD",s:"Badesee · E zum Tauchen",r:R(7440,1820,1880,1160)},{n:"HOLLYWOOD HILLS",s:"Mount Lee",r:R(7420,60,1930,1520)},{n:"GEFÄNGNIS",s:"LA County Jail",r:R(6560,300,840,1330)},{n:"STRAND",s:"Venice Beach",r:R(0,3040,4560,WH0-3040)},{n:"ZUHAUSE",s:"Eastside",r:R(0,1780,2100,WH0-1780)},{n:"SUNSET STRIP",s:"Clubs & Nachtleben",r:R(0,0,2100,1780)},{n:"FLUGHAFEN",s:"LA International",r:R(AX,0,WW-AX,1780)},{n:"DOWNTOWN",s:"Los Angeles",r:R(2100,0,AX-2100,1780)},{n:"HAFEN",s:"Industriegebiet",r:R(4560,1780,WW-4560,WH0-1780)},{n:"PALM HEIGHTS",s:"Nur für Reiche",r:R(2100,1780,2520,WH0-1780)}];

// ================= HELPERS =================
const touch=matchMedia("(pointer: coarse)").matches;
let seed=11; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
for (let i=0;i<70;i++){ const a=i/70*6.2832+rnd()*.05, b=lakeB(a)*(1.18+rnd()*.22), x=LAKE.x+Math.cos(a)*LAKE.rx*b, y=LAKE.y+Math.sin(a)*LAKE.ry*b; if (x>7480&&x<9280&&y>1850&&y<2960&&!(x>8300&&x<8460&&y<2000)) tree(x,y,.8+rnd()*.5,i%3?"oak":"jacaranda"); }
for (let i=0;i<40;i++){ const a=rnd()*6.2832, r=.3+rnd()*.85, x=HILL.x+Math.cos(a)*HILL.rx*r, y=HILL.y+Math.sin(a)*HILL.ry*r; if (y<1500&&Math.abs(y-SIGNY)>70&&!(x>8150&&x<8700&&y>930)) tree(x,y,.6+rnd()*.4,"oak"); }

function mk(w,h,f){ const c=document.createElement("canvas"); c.width=Math.max(1,Math.round(w)); c.height=Math.max(1,Math.round(h)); const q=c.getContext("2d"); if (f) f(q,c); return c; }
const hexRGB=h=>{ const n=parseInt(h.slice(1),16); return [n>>16,n>>8&255,n&255]; };
const shade=(hex,f)=>{ const [r,g,b]=hexRGB(hex), m=v=>Math.max(0,Math.min(255,Math.round(v*f))); return `rgb(${m(r)},${m(g)},${m(b)})`; };
const mix=(a,b,t)=>{ const A=hexRGB(a), B=hexRGB(b); return `rgb(${A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(",")})`; };
function rr(q,x,y,w,h,r){ q.beginPath(); q.moveTo(x+r,y); q.arcTo(x+w,y,x+w,y+h,r); q.arcTo(x+w,y+h,x,y+h,r); q.arcTo(x,y+h,x,y,r); q.arcTo(x,y,x+w,y,r); q.closePath(); }
// value noise
const PERM=new Uint8Array(512); { const p=[...Array(256).keys()]; for (let i=255;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [p[i],p[j]]=[p[j],p[i]]; } for (let i=0;i<512;i++) PERM[i]=p[i&255]; }
const VAL=new Float32Array(256).map(()=>rnd());
const sm=t=>t*t*(3-2*t);
function vnoise(x,y){ const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi, a=xi&255, b=yi&255;
  const v00=VAL[PERM[a+PERM[b]]], v10=VAL[PERM[a+1+PERM[b]]], v01=VAL[PERM[a+PERM[b+1]]], v11=VAL[PERM[a+1+PERM[b+1]]], u=sm(xf), v=sm(yf);
  return (v00*(1-u)+v10*u)*(1-v)+(v01*(1-u)+v11*u)*v; }
const fbm=(x,y,o)=>{ let s=0,a=.5,f=1; for (let i=0;i<o;i++){ s+=vnoise(x*f,y*f)*a; f*=2.03; a*=.5; } return s; };
// grain tile used as an overlay everywhere
const GRAIN=mk(256,256,q=>{ const id=q.createImageData(256,256); for (let i=0;i<id.data.length;i+=4){ const v=110+rnd()*36+(rnd()<.04?40:0); id.data[i]=id.data[i+1]=id.data[i+2]=v; id.data[i+3]=255; } q.putImageData(id,0,0); });

// ================= GROUND =================
const GS=touch?.62:1;
// keine Palmen direkt vor JJs Eingang und Einfahrt, keine Palmen auf dem Kai
for (let i=palms.length-1;i>=0;i--){ const q=palms[i]; if (q.x>4540&&q.y>3040) palms.splice(i,1); }
for (let i=palms.length-1;i>=0;i--){ const q=palms[i]; if (q.y>2420&&q.y<2480&&q.x>DOOR.x-60&&q.x<HOUSE.x+HOUSE.w+90) palms.splice(i,1); }
for (let i=palms.length-1;i>=0;i--){ const q=palms[i]; if (beyondShore(q.x,q.y,40)) palms.splice(i,1); }
// entfernte Palmen dürfen keine unsichtbaren Wände hinterlassen
for (const B of [BANKB,MUSB]){ for (let i=palms.length-1;i>=0;i--){ const q=palms[i]; if (q.x>B.x-30&&q.x<B.x+B.w+30&&q.y>B.y-30&&q.y<B.y+B.h+60) palms.splice(i,1); } for (let i=trees.length-1;i>=0;i--){ const q=trees[i]; if (q.x>B.x-40&&q.x<B.x+B.w+40&&q.y>B.y-40&&q.y<B.y+B.h+60) trees.splice(i,1); } }
for (let i=solids.length-1;i>=0;i--) if (solids[i].palm&&!palms.includes(solids[i].palm)) solids.splice(i,1);
const ground=mk(LANDW*GS,WH0*GS), ground2=mk(G2.w*GS,G2.h*GS);
const g=(()=>{ const a=ground.getContext("2d"), b=ground2.getContext("2d"); a.scale(GS,GS); b.scale(GS,GS); b.translate(-G2.x,-G2.y); const one=new Set(["createLinearGradient","createRadialGradient","createPattern","createImageData","measureText","getImageData","isPointInPath","getLineDash"]);
  return new Proxy(a,{ get(t,k){ const v=a[k]; if (typeof v!=="function") return v; if (one.has(k)) return v.bind(a); return (...q)=>{ b[k](...q); return v.apply(a,q); }; }, set(t,k,v){ a[k]=v; b[k]=v; return true; } }); })();
const grainPat=g.createPattern(GRAIN,"repeat");
// gemalte Bodentexturen (Higgsfield): Rasen, Asphalt, Sand, Gehwegplatten
const TEXM={"grass":[0,0,256,256],"asph":[256,0,256,256],"sand":[0,256,256,256],"pave":[256,256,256,256]}, TEXP={};
if (window.ASSETS&&ASSETS.tex) for (const k in TEXM){ const r=TEXM[k], c=mk(r[2],r[3],q=>q.drawImage(ASSETS.tex,r[0],r[1],r[2],r[3],0,0,r[2],r[3])), pt=g.createPattern(c,"repeat"), sc=k==="pave"?104/256:k==="grass"?1.2:k==="sand"?1.4:1.1; try{ pt.setTransform(new DOMMatrix([sc,0,0,sc,0,0])); }catch(e){} TEXP[k]=pt; }
const TEXC=c=>c==="#3a3d43"&&TEXP.asph||c==="#e2ce9e"&&TEXP.sand||c==="#d3cab8"&&TEXP.pave||c;
const rect=(r,c)=>{ g.fillStyle=TEXC(c); g.fillRect(r.x,r.y,r.w,r.h); };
function grain(r,a,mode){ g.save(); g.globalCompositeOperation=mode||"overlay"; g.globalAlpha=a; g.fillStyle=grainPat; g.fillRect(r.x,r.y,r.w,r.h); g.restore(); }
function blotches(r,n,col,rmin,rmax,a){ g.save(); g.globalAlpha=a; for (let i=0;i<n;i++){ const x=r.x+rnd()*r.w, y=r.y+rnd()*r.h, s=rmin+rnd()*(rmax-rmin); const gr=g.createRadialGradient(x,y,0,x,y,s); gr.addColorStop(0,col); gr.addColorStop(1,"rgba(0,0,0,0)"); g.fillStyle=gr; g.fillRect(x-s,y-s,s*2,s*2); } g.restore(); }
// 1) terrain: shaded relief everywhere (flat-ish in town, real hills in the south-east)
{ const C=8, cw=Math.ceil(LANDW/C), ch=Math.ceil(WH0/C), hm=new Float32Array(cw*ch);
  for (let j=0;j<ch;j++) for (let i=0;i<cw;i++){ const x=i*C, y=j*C; const hill=hillH(x,y); const edge=Math.max(0,Math.min(1,(y-3550)/150))+Math.max(0,Math.min(1,(80-y)/80));
    hm[j*cw+i]=fbm(x/700,y/700,5)*(.15+hill*2.4+edge)+hill*fbm(x/260+9,y/260,4)*.9; }
  const img=new ImageData(cw,ch), d=img.data, L=[-.62,-.48,.62];
  for (let j=0;j<ch;j++) for (let i=0;i<cw;i++){ const k=j*cw+i, h=hm[k], dx=(hm[j*cw+Math.min(cw-1,i+1)]-hm[j*cw+Math.max(0,i-1)])*14, dy=(hm[Math.min(ch-1,j+1)*cw+i]-hm[Math.max(0,j-1)*cw+i])*14;
    const n=[-dx,-dy,1], nl=Math.hypot(...n), lit=Math.max(0,(n[0]*L[0]+n[1]*L[1]+n[2]*L[2])/nl), sh=.55+lit*.62;
    const t=Math.min(1,h*.9); let r=176+(201-176)*t, gg=162+(176-162)*t, b=110+(116-110)*t; const ol=fbm(i/9+3,j/9,3); if (ol>.52){ const m=(ol-.52)*2.4; r+=(-60)*m; gg+=(-30)*m; b+=(-45)*m; }
    d[k*4]=Math.min(255,r*sh); d[k*4+1]=Math.min(255,gg*sh); d[k*4+2]=Math.min(255,b*sh); d[k*4+3]=255; }
  const tc=mk(cw,ch); tc.getContext("2d").putImageData(img,0,0); g.imageSmoothingEnabled=true; g.drawImage(tc,0,0,LANDW,WH0); grain(R(0,0,LANDW,WH0),.35);
}
// 2) lawns
function lawn(r,base,stripes){ rect(r,base); if (TEXP.grass){ g.save(); g.fillStyle=TEXP.grass; g.globalAlpha=.92; g.fillRect(r.x,r.y,r.w,r.h); g.globalCompositeOperation="color"; g.globalAlpha=.45; g.fillStyle=base; g.fillRect(r.x,r.y,r.w,r.h); g.restore(); } blotches(r,r.w*r.h/9000,"rgba(40,80,20,.5)",20,60,.22); blotches(r,r.w*r.h/12000,"rgba(190,200,110,.5)",20,50,.25);
  if (stripes){ g.save(); g.beginPath(); g.rect(r.x,r.y,r.w,r.h); g.clip(); for (let x=r.x;x<r.x+r.w;x+=40){ g.fillStyle=(Math.floor((x-r.x)/40)%2)?"rgba(255,255,255,.05)":"rgba(0,0,0,.035)"; g.fillRect(x,r.y,40,r.h); } g.restore(); }
  grain(r,.45); }
// weiche, unregelmäßige Ränder statt harter Rechteckkanten (Rasen → Sand/Strand)
function softLawn(r,base,stripes){ const [cr,cg,cb]=hexRGB(base), A=a=>`rgba(${cr},${cg},${cb},${a})`;
  softPoly([[r.x+6,r.y+6],[r.x+r.w-6,r.y+6],[r.x+r.w-6,r.y+r.h-6],[r.x+6,r.y+r.h-6]],A(.75),34);
  const pts=[], J=()=>(rnd()-.5)*22, st=26;
  for (let x=r.x;x<r.x+r.w;x+=st) pts.push([x,r.y+J()]); for (let y=r.y;y<r.y+r.h;y+=st) pts.push([r.x+r.w+J(),y]);
  for (let x=r.x+r.w;x>r.x;x-=st) pts.push([x,r.y+r.h+J()]); for (let y=r.y+r.h;y>r.y;y-=st) pts.push([r.x+J(),y]);
  g.save(); g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.closePath(); g.clip(); lawn(R(r.x-20,r.y-20,r.w+40,r.h+40),base,stripes); g.restore();
  const tuft=(x,y)=>{ const k=.75+rnd()*.4; g.fillStyle=`rgba(${Math.round(cr*k)},${Math.round(cg*k)},${Math.round(cb*k)},${.35+rnd()*.4})`; g.beginPath(); g.arc(x,y,2.5+rnd()*5,0,7); g.fill(); };
  for (let x=r.x;x<r.x+r.w;x+=7){ tuft(x,r.y+(rnd()-.6)*26); tuft(x,r.y+r.h+(rnd()-.4)*26); } for (let y=r.y;y<r.y+r.h;y+=7){ tuft(r.x+(rnd()-.6)*26,y); tuft(r.x+r.w+(rnd()-.4)*26,y); } }
// weich ausgeblendete Wiese (organischer Übergang ins Sand-/Strandgelände)
function featherLawn(r,base,F,dens){ const S=.5, cw=Math.ceil(r.w*S), ch=Math.ceil(r.h*S), [cr,cg,cb]=hexRGB(base);
  const c=mk(cw,ch,q=>{ q.fillStyle=base; q.fillRect(0,0,cw,ch); const blot=(n,col,r0,r1,a)=>{ q.globalAlpha=a; for (let i=0;i<n;i++){ const x=rnd()*cw, y=rnd()*ch, s2=(r0+rnd()*(r1-r0))*S, gr=q.createRadialGradient(x,y,0,x,y,s2); gr.addColorStop(0,col); gr.addColorStop(1,"rgba(0,0,0,0)"); q.fillStyle=gr; q.fillRect(x-s2,y-s2,s2*2,s2*2); } q.globalAlpha=1; };
    blot(r.w*r.h/(dens||7000),`rgba(${cr*.62|0},${cg*.78|0},${cb*.55|0},.7)`,20,70,.35); blot(r.w*r.h/(dens||9000),`rgba(${Math.min(255,cr*1.18)|0},${Math.min(255,cg*1.1)|0},${cb*.9|0},.6)`,20,60,.3);
    const M=4, mw=Math.ceil(cw/M), mh=Math.ceil(ch/M), m=mk(mw,mh), mq=m.getContext("2d"), id=mq.createImageData(mw,mh);
    for (let j=0;j<mh;j++) for (let i=0;i<mw;i++){ const x=r.x+i*M/S, y=r.y+j*M/S; let d=Math.min(x-r.x,r.x+r.w-x,y-r.y,r.y+r.h-y)+(fbm(x/170,y/170,3)-.5)*F*.9; let t=Math.max(0,Math.min(1,d/F)); t=t*t*(3-2*t); id.data[(j*mw+i)*4+3]=Math.round(t*255); }
    mq.putImageData(id,0,0); q.globalCompositeOperation="destination-in"; q.imageSmoothingEnabled=true; q.drawImage(m,0,0,cw,ch); });
  g.imageSmoothingEnabled=true; g.drawImage(c,r.x,r.y,r.w,r.h); }
softLawn(R(150,1810,1960,1100),"#7cad4c"); lawn(R(560,1850,380,600),"#6aa748",true);
// Hollywood Hills: Buschland am Hang + Wanderweg
{ g.save(); g.beginPath(); g.ellipse(HILL.x,HILL.y,HILL.rx,HILL.ry,0,0,7); g.clip(); blotches(R(HILL.x-HILL.rx,HILL.y-HILL.ry,HILL.rx*2,HILL.ry*2),1300,"rgba(62,92,40,.95)",8,28,.32); blotches(R(HILL.x-HILL.rx,HILL.y-HILL.ry,HILL.rx*2,HILL.ry*2),500,"rgba(150,130,80,.8)",14,40,.18); g.restore();
  g.strokeStyle="rgba(120,95,60,.14)"; g.lineWidth=1.2; for (let r=.25;r<1;r+=.15){ g.beginPath(); g.ellipse(HILL.x,HILL.y+30,HILL.rx*r,HILL.ry*r,0,0,7); g.stroke(); }
  g.lineCap="round"; g.strokeStyle="#c8b088"; g.lineWidth=12; g.beginPath(); g.moveTo(8680,1010); g.bezierCurveTo(9000,880,8650,760,8860,640); g.bezierCurveTo(9050,520,8700,380,8420,330); g.stroke(); g.strokeStyle="rgba(255,240,210,.35)"; g.lineWidth=3; g.setLineDash([6,10]); g.stroke(); g.setLineDash([]); }
// Lake Hollywood: Wiese, Sandufer, Wasser nach Tiefe
softLawn(R(7440,1820,1880,1160),"#7fae52");
{ const path=(sc)=>{ g.beginPath(); for (let i=0;i<=120;i++){ const a=i/120*6.2832, b=lakeB(a)*sc; g.lineTo(LAKE.x+Math.cos(a)*LAKE.rx*b,LAKE.y+Math.sin(a)*LAKE.ry*b); } g.closePath(); };
  path(1.07); g.fillStyle="#d8c693"; g.fill(); path(1.03); g.fillStyle="#bfae7c"; g.fill();
  path(1); const wg=g.createRadialGradient(LAKE.x+60,LAKE.y+40,30,LAKE.x,LAKE.y,LAKE.rx); wg.addColorStop(0,"#0b4a74"); wg.addColorStop(.55,"#1b74a0"); wg.addColorStop(.85,"#2f9fbf"); wg.addColorStop(1,"#5cc6cf"); g.fillStyle=wg; g.save(); g.scale(1,1); g.fill(); g.restore();
  g.save(); path(1); g.clip(); blotches(R(LAKE.x-LAKE.rx,LAKE.y-LAKE.ry,LAKE.rx*2,LAKE.ry*2),90,"rgba(5,30,60,.8)",30,90,.16); blotches(R(LAKE.x-LAKE.rx,LAKE.y-LAKE.ry,LAKE.rx*2,LAKE.ry*2),60,"rgba(150,230,240,.7)",20,60,.1);
    path(.86); g.strokeStyle="rgba(255,255,255,.12)"; g.lineWidth=3; g.stroke(); g.restore();
  path(1); g.strokeStyle="rgba(255,255,255,.55)"; g.lineWidth=2.5; g.stroke();
  for (let i=0;i<260;i++){ const a=rnd()*6.2832, b=lakeB(a)*(1.0+rnd()*.05), x=LAKE.x+Math.cos(a)*LAKE.rx*b, y=LAKE.y+Math.sin(a)*LAKE.ry*b; g.strokeStyle=`rgba(${60+rnd()*40|0},${110+rnd()*40|0},40,.8)`; g.lineWidth=1.6; g.beginPath(); g.moveTo(x,y); g.lineTo(x+(rnd()-.5)*6,y-8-rnd()*8); g.stroke(); } }
lawn(R(60,250,1920,1060),"#7fae52",false); featherLawn(R(AX-160,130,2280,1330),"#b6ac70",300,9000); featherLawn(R(AX-20,190,2040,1170),"#9cae5f",230); featherLawn(R(60+AX,250,1920,1060),"#86ab58",150); grain(R(AX-160,130,2280,1330),.4); softLawn(R(4760,1810,CITYW-4800,1100),"#9a9688",false);
// 2a) Palm Heights estates
softLawn(R(2110,1790,2490,1200),"#79b24c");
for (const L of LOTS){ const r=R(L.lx+8,L.ly+8,L.lw-16,L.lh-16); lawn(r,"#6fb246",true);
  g.fillStyle="#2f6a2a"; for (let x=r.x;x<r.x+r.w;x+=11) for (const y of [r.y,r.y+r.h]){ if (Math.abs(x-(L.drive.x+L.drive.w/2))<30&&((L.top&&y>r.y)||(!L.top&&y===r.y))) continue; g.beginPath(); g.arc(x,y,7,0,7); g.fill(); }
  for (let y=r.y;y<r.y+r.h;y+=11) for (const x of [r.x,r.x+r.w]){ g.beginPath(); g.arc(x,y,7,0,7); g.fill(); }
  g.fillStyle="rgba(150,210,110,.35)"; for (let x=r.x;x<r.x+r.w;x+=11) for (const y of [r.y,r.y+r.h]){ g.beginPath(); g.arc(x-2,y-2,3,0,7); g.fill(); }
  const d=L.drive; rect(d,"#d9cdb6"); for (let y=d.y;y<d.y+d.h;y+=12) for (let x=d.x;x<d.x+d.w;x+=12){ g.fillStyle=rnd()<.5?"rgba(0,0,0,.05)":"rgba(255,255,255,.06)"; g.fillRect(x,y,11,11); } grain(d,.25);
  const b=L.b, ap=L.top?R(b.x-14,b.y+b.h,b.w+28,26):R(b.x-14,b.y-26,b.w+28,26); rect(ap,"#e3d8c4"); grain(ap,.2);
  if (b.style==="villa"){ const fx=b.x+b.w*.35, fy=L.top?b.y+b.h+60:b.y-60; g.fillStyle="#d8cdb8"; g.beginPath(); g.arc(fx,fy,28,0,7); g.fill(); const wg=g.createRadialGradient(fx-6,fy-6,3,fx,fy,22); wg.addColorStop(0,"#8fe0f0"); wg.addColorStop(1,"#2a86b8"); g.fillStyle=wg; g.beginPath(); g.arc(fx,fy,21,0,7); g.fill(); g.fillStyle="#efe9dc"; g.beginPath(); g.arc(fx,fy,6,0,7); g.fill(); }
  const P=L.pool, deck=R(P.x-22,P.y-22,P.w+44,P.h+44); rect(deck,b.style==="villa"?"#e8d9bf":"#a7835c"); if (b.style!=="villa") for (let x=deck.x;x<deck.x+deck.w;x+=8) rect(R(x,deck.y,1,deck.h),"rgba(60,35,15,.25)"); grain(deck,.2);
  const pg=g.createLinearGradient(P.x,P.y,P.x+P.w,P.y+P.h); pg.addColorStop(0,"#7fe2f2"); pg.addColorStop(1,"#1f86c0"); g.fillStyle=pg; g.fillRect(P.x,P.y,P.w,P.h); g.fillStyle="rgba(0,40,80,.25)"; g.fillRect(P.x,P.y,P.w,6); g.fillRect(P.x,P.y,6,P.h);
  for (let k=0;k<3;k++){ const lx2=P.x+10+k*22, ly2=L.top?P.y-18:P.y+P.h+6; rect(R(lx2,ly2,14,12),"#f6f4ef"); rect(R(lx2,ly2,14,4),["#e84a5f","#2a9df4","#f6c344"][k]); }
  if (L.tennis){ const t=R(L.lx+30,L.ly+30,L.lw-60,150); rect(t,"#3f8f5c"); const c2=R(t.x+20,t.y+15,t.w-40,t.h-30); rect(c2,"#2f6fa8"); g.strokeStyle="#f4f4f0"; g.lineWidth=2; g.strokeRect(c2.x,c2.y,c2.w,c2.h); g.beginPath(); g.moveTo(c2.x+c2.w/2,c2.y-4); g.lineTo(c2.x+c2.w/2,c2.y+c2.h+4); g.moveTo(c2.x,c2.y+c2.h/2); g.lineTo(c2.x+c2.w,c2.y+c2.h/2); g.stroke(); } }
for (const P of RICHPOOLS) POOLS_ANIM.push(P);
// 2b) beach, ocean, pier
{ const tg=g.createLinearGradient(0,2992,0,3040); tg.addColorStop(0,"rgba(226,206,158,0)"); tg.addColorStop(1,"rgba(226,206,158,1)"); g.fillStyle=tg; g.fillRect(0,2992,LANDW,48);
  rect(R(0,3040,LANDW,WH-3040),"#e2ce9e"); 
  const sand=R(0,3000,LANDW,340); blotches(sand,160,"rgba(170,140,90,.6)",14,50,.25); blotches(sand,120,"rgba(255,245,220,.7)",14,40,.25); grain(sand,.4);
  for (let i=0;i<500;i++){ g.fillStyle="rgba(120,95,60,.18)"; g.beginPath(); g.ellipse(rnd()*2100,3060+rnd()*150,2,3,rnd()*3,0,7); g.fill(); }
  const shore=(off)=>{ g.beginPath(); g.moveTo(0,WH); for (let x=0;x<=LANDW;x+=20) g.lineTo(x,waterY(x)+off); g.lineTo(LANDW,WH); g.closePath(); };
  shore(-34); g.fillStyle="rgba(150,120,80,.35)"; g.fill();
  shore(0); const wg=g.createLinearGradient(0,WATER_Y-30,0,WH0); wg.addColorStop(0,"#69c9cf"); wg.addColorStop(.12,"#2f9fb8"); wg.addColorStop(.45,"#1b6f9b"); wg.addColorStop(1,"#0d4675"); g.fillStyle=wg; g.fill();
  g.save(); shore(0); g.clip(); blotches(R(0,WATER_Y,LANDW,WH0-WATER_Y),120,"rgba(5,30,60,.8)",30,90,.18); blotches(R(0,WATER_Y,LANDW,WH0-WATER_Y),80,"rgba(150,230,240,.7)",20,60,.12);
    g.strokeStyle="rgba(220,250,255,.18)"; g.lineWidth=1.5; for (let i=0;i<900;i++){ const x=rnd()*LANDW, y=WATER_Y+20+rnd()*(WH0-WATER_Y); g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+8,y-3,x+16,y); g.stroke(); } g.restore();
  for (let x=2150;x<LANDW;x+=26){ const y=waterY(x)-6+rnd()*14, s=6+rnd()*14; g.fillStyle="rgba(30,20,15,.3)"; g.beginPath(); g.ellipse(x+4,y+4,s,s*.7,0,0,7); g.fill(); const gr=g.createRadialGradient(x-s*.3,y-s*.3,1,x,y,s); gr.addColorStop(0,"#9a8a78"); gr.addColorStop(1,"#4e4339"); g.fillStyle=gr; g.beginPath(); g.ellipse(x,y,s,s*.7,0,0,7); g.fill(); }
  // island
  for (const I of ISLANDS){ softPoly([[I.x-I.r+14,I.y],[I.x,I.y-I.r+14],[I.x+I.r+14,I.y],[I.x,I.y+I.r+18]],"rgba(10,40,70,.35)",20);
    g.fillStyle="rgba(150,225,235,.55)"; g.beginPath(); g.arc(I.x,I.y,I.r+16,0,7); g.fill(); g.fillStyle="#cdb98a"; g.beginPath(); g.arc(I.x,I.y,I.r+4,0,7); g.fill();
    const ig=g.createRadialGradient(I.x-20,I.y-20,8,I.x,I.y,I.r); ig.addColorStop(0,"#f2e2b4"); ig.addColorStop(1,"#dcc790"); g.fillStyle=ig; g.beginPath(); g.arc(I.x,I.y,I.r-2,0,7); g.fill(); grain(R(I.x-I.r,I.y-I.r,I.r*2,I.r*2),.25); }
  // pier
  for (const r of PIERS) softPoly([[r.x+10,r.y+10],[r.x+r.w+16,r.y+10],[r.x+r.w+16,r.y+r.h+8],[r.x+10,r.y+r.h+8]],"rgba(10,30,50,.5)",8);
  for (const r of PIERS){ rect(r,"#a47b52"); for (let y=r.y;y<r.y+r.h;y+=8){ g.fillStyle=`rgba(${rnd()<.5?"60,35,15":"255,230,190"},${.06+rnd()*.08})`; g.fillRect(r.x,y,r.w,7); g.fillStyle="rgba(50,30,15,.35)"; g.fillRect(r.x,y+7,r.w,1); } grain(r,.3);
    g.fillStyle="#5d4026"; g.fillRect(r.x,r.y,r.w,3); g.fillRect(r.x,r.y,3,r.h); g.fillRect(r.x+r.w-3,r.y,3,r.h); g.fillRect(r.x,r.y+r.h-3,r.w,3); }
  g.fillStyle="#3b2a1a"; for (let y=3060;y<3460;y+=40) for (const x of [938,996]) g.fillRect(x,y,6,6);
  // Mo's heliport (industrial lot east)
  { const r=R(HELIPAD.x-170,HELIPAD.y-150,340,300); rect(r,"#4a4d52"); grain(r,.5); g.strokeStyle="#e8c34a"; g.lineWidth=3; g.setLineDash([14,10]); g.strokeRect(r.x+8,r.y+8,r.w-16,r.h-16); g.setLineDash([]); }
  g.fillStyle="#3a3d43"; g.beginPath(); g.arc(HELIPAD.x,HELIPAD.y,52,0,7); g.fill(); g.strokeStyle="#f3f1ea"; g.lineWidth=4; g.beginPath(); g.arc(HELIPAD.x,HELIPAD.y,44,0,7); g.stroke();
  g.fillStyle="#f3f1ea"; g.font='400 54px "Bebas Neue",Impact,sans-serif'; g.textAlign="center"; g.textBaseline="middle"; g.fillText("H",HELIPAD.x,HELIPAD.y+3); }
// 2b') Übergang ins offene Meer: unten weich in die Tiefsee-Farbe (darunter liegt nur noch das Inselbild)
{ g.save(); g.beginPath(); g.rect(0,3560,LANDW,WH0-3560); for (const I of ISLANDS){ g.moveTo(I.x+I.r+20,I.y); g.arc(I.x,I.y,I.r+20,0,6.2832); } g.clip("evenodd"); const fg=g.createLinearGradient(0,3560,0,WH0); fg.addColorStop(0,"rgba(13,70,117,0)"); fg.addColorStop(1,"rgba(13,70,117,1)"); g.fillStyle=fg; g.fillRect(0,3560,LANDW,WH0-3560); g.restore(); }
// 2c) Santa Luna: Flachwasser-Ring, Sandstrand, Rasen, Felsen
{ const S=3, M=280, x0=SL.x0-M, y0=SL.y0-M, w=SL.x1-SL.x0+M*2, h=SL.cape.y+SL.cape.r+M-y0, cw=Math.ceil(w/S), ch=Math.ceil(h/S), img=new ImageData(cw,ch), dd=img.data;
  const SH=[110,205,208], MB=[35,134,173], SA=[226,206,158], WS=[196,172,124], GA=[104,160,70], GB=[86,140,58];
  for (let j=0;j<ch;j++) for (let i=0;i<cw;i++){ const x=x0+i*S, y=y0+j*S, d=islD(x,y); if (d>M-10) continue; const k=(j*cw+i)*4, n=(Math.sin(x*.21+y*.13)+Math.sin(x*.05-y*.09))*3; let c, al=255;
    if (d>70){ c=MB; al=255*Math.pow(1-(d-70)/(M-80),1.6)*.85; }
    else if (d>0){ const f=d/70; c=SH.map((v,q)=>v+(MB[q]-v)*f); al=255*(.95-f*.1); }
    else if (d>-12) c=WS;
    else if (d>-130) c=SA;
    else { const f=Math.min(1,(-d-130)/50), m=Math.sin(x*.004)+Math.sin(y*.005+2)>0?GA:GB; c=SA.map((v,q)=>v+(m[q]-v)*f); }
    dd[k]=c[0]+n; dd[k+1]=c[1]+n; dd[k+2]=c[2]+n; dd[k+3]=al; }
  const cv=mk(cw,ch); cv.getContext("2d").putImageData(img,0,0); g.imageSmoothingEnabled=true; g.drawImage(cv,x0,y0,w,h);
  // Wellen im offenen Meer rund um die Insel
  g.save(); g.strokeStyle="rgba(220,250,255,.13)"; g.lineWidth=1.5; for (let i=0;i<700;i++){ const x=G2.x+rnd()*G2.w, y=G2.y+40+rnd()*(G2.h-40); if (islD(x,y)<30) continue; g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+8,y-3,x+16,y); g.stroke(); } g.restore();
  // Rasen-Textur + Felsen an der Küste (Strahlen von der Inselmitte bis zur Küste)
  blotches(R(SL.x0+160,SL.y0+160,SL.x1-SL.x0-320,SL.y1-SL.y0-320),220,"rgba(40,80,20,.5)",20,70,.2); blotches(R(SL.x0+160,SL.y0+160,SL.x1-SL.x0-320,SL.y1-SL.y0-320),160,"rgba(190,200,110,.5)",20,60,.2);
  for (let i=0;i<500;i++){ g.fillStyle="rgba(120,95,60,.18)"; const x=SL.x0+rnd()*(SL.x1-SL.x0), y=SL.y0+rnd()*(SL.y1-SL.y0+260), d=islD(x,y); if (d<-120||d>-14) continue; g.beginPath(); g.ellipse(x,y,2,3,rnd()*3,0,7); g.fill(); }
  const cx=4950, cy=5040; SLCOAST.length=0;
  for (let i=0;i<720;i++){ const a=i/720*6.2832, ca=Math.cos(a), sa=Math.sin(a); let r=300; while (r<3400&&islD(cx+ca*r,cy+sa*r)<0) r+=4; const x=cx+ca*r, y=cy+sa*r; SLCOAST.push([x,y]);
    if (Math.sin(a*6+1)>.35||Math.hypot(x-SL.cape.x,y-SL.cape.y)<260){ const s2=5+rnd()*9, rx=x-ca*(4+rnd()*8), ry=y-sa*(4+rnd()*8); g.fillStyle="rgba(30,20,15,.3)"; g.beginPath(); g.ellipse(rx+3,ry+3,s2,s2*.75,0,0,7); g.fill(); const gr=g.createRadialGradient(rx-s2*.3,ry-s2*.3,1,rx,ry,s2); gr.addColorStop(0,"#a09484"); gr.addColorStop(1,"#55493e"); g.fillStyle=gr; g.beginPath(); g.ellipse(rx,ry,s2,s2*.75,rnd()*3,0,7); g.fill(); } }
  // Sonnenschirme + Handtücher am Nordstrand
  for (let x=2500;x<7450;x+=230){ if (BRIDGES.some(b=>x>b.x-150&&x<b.x+b.w+150)) continue; const y=3995+rnd()*20, cols=["#ff5f5f","#ffd23f","#2fa8ff","#2fd38a","#ff8fd8"], c=cols[Math.floor(rnd()*5)];
    g.fillStyle=cols[Math.floor(rnd()*5)]; g.save(); g.translate(x+26,y+8); g.rotate(rnd()-.5); g.fillRect(-9,-15,18,30); g.restore();
    g.fillStyle="rgba(40,30,20,.25)"; g.beginPath(); g.arc(x+8,y+6,20,0,7); g.fill(); for (let q=0;q<8;q++){ g.fillStyle=q%2?c:"#fff6e6"; g.beginPath(); g.moveTo(x,y); g.arc(x,y,19,q/8*6.2832,(q+1)/8*6.2832); g.closePath(); g.fill(); } }
  // Kap: Felsplateau + Weg zum Leuchtturm
  g.fillStyle="#8f877a"; g.beginPath(); g.arc(LH.x,LH.y,58,0,7); g.fill(); g.fillStyle="#b9b1a2"; g.beginPath(); g.arc(LH.x,LH.y,46,0,7); g.fill(); grain(R(LH.x-60,LH.y-60,120,120),.4);
  rect(R(LH.x-28,5996,56,LH.y-5996-40),"#c9bfa8"); grain(R(LH.x-28,5996,56,LH.y-5996-40),.3); }
// 3) downtown pavement: large stone pavers with tonal variation
{ const r=R(2140,250,2050,1420); rect(r,"#c4bcac"); for (let y=r.y;y<r.y+r.h;y+=32) for (let x=r.x;x<r.x+r.w;x+=48){ const v=rnd(); g.fillStyle=v<.33?"rgba(0,0,0,.035)":v<.66?"rgba(255,255,255,.04)":"rgba(120,100,70,.04)"; g.fillRect(x,y,48,32); }
  g.strokeStyle="rgba(60,50,40,.12)"; g.lineWidth=1; for (let y=r.y;y<r.y+r.h;y+=32){ g.beginPath(); g.moveTo(r.x,y+.5); g.lineTo(r.x+r.w,y+.5); g.stroke(); } for (let x=r.x;x<r.x+r.w;x+=48){ g.beginPath(); g.moveTo(x+.5,r.y); g.lineTo(x+.5,r.y+r.h); g.stroke(); } grain(r,.3);
  const e=BLOCKS[4]; lawn(e,"#77a64e",true); g.strokeStyle="#ddd5c4"; g.lineWidth=28; g.beginPath(); g.moveTo(e.x,e.y+e.h/2); g.lineTo(e.x+e.w,e.y+e.h/2); g.moveTo(e.x+e.w/2,e.y); g.lineTo(e.x+e.w/2,e.y+e.h); g.stroke();
  g.fillStyle="#ddd5c4"; g.beginPath(); g.arc(e.x+e.w/2,e.y+e.h/2,78,0,7); g.fill(); g.fillStyle="#b8ae9a"; g.beginPath(); g.arc(e.x+e.w/2,e.y+e.h/2,58,0,7); g.fill();
  const wg=g.createRadialGradient(e.x+e.w/2-12,e.y+e.h/2-12,6,e.x+e.w/2,e.y+e.h/2,54); wg.addColorStop(0,"#7fd6ef"); wg.addColorStop(1,"#2a7fb3"); g.fillStyle=wg; g.beginPath(); g.arc(e.x+e.w/2,e.y+e.h/2,52,0,7); g.fill(); }
// 3b) Sunset Strip: dunkles Pflaster statt Rasen
{ const r=R(140,320,1720,1310); rect(r,"#6a6470"); for (let y=r.y;y<r.y+r.h;y+=30) for (let x=r.x;x<r.x+r.w;x+=30){ const v=rnd(); g.fillStyle=v<.33?"rgba(0,0,0,.06)":v<.66?"rgba(255,255,255,.04)":"rgba(120,60,140,.05)"; g.fillRect(x,y,30,30); }
  g.strokeStyle="rgba(20,10,30,.18)"; g.lineWidth=1; for (let y=r.y;y<r.y+r.h;y+=30){ g.beginPath(); g.moveTo(r.x,y+.5); g.lineTo(r.x+r.w,y+.5); g.stroke(); } for (let x=r.x;x<r.x+r.w;x+=30){ g.beginPath(); g.moveTo(x+.5,r.y); g.lineTo(x+.5,r.y+r.h); g.stroke(); } grain(r,.35); }
// 3c) Gefängnis: Hof, Zufahrt, Geheimweg
{ const y=R(JAILR.x,JAILR.y,JAILR.w,JAILR.h); rect(y,"#a4a097"); grain(y,.45); blotches(y,30,"rgba(0,0,0,.8)",8,26,.12);
  const ct=R(6760,780,230,170); rect(ct,"#8a6a52"); g.strokeStyle="rgba(255,255,255,.8)"; g.lineWidth=2; g.strokeRect(ct.x+6,ct.y+6,ct.w-12,ct.h-12); g.beginPath(); g.moveTo(ct.x+ct.w/2,ct.y+6); g.lineTo(ct.x+ct.w/2,ct.y+ct.h-6); g.stroke(); g.beginPath(); g.arc(ct.x+ct.w/2,ct.y+ct.h/2,20,0,7); g.stroke();
  for (const [hx,hy] of [[ct.x+14,ct.y+ct.h/2],[ct.x+ct.w-14,ct.y+ct.h/2]]){ g.fillStyle="#d8d4cc"; g.fillRect(hx-3,hy-12,6,24); g.strokeStyle="#ff6a2a"; g.lineWidth=2; g.beginPath(); g.arc(hx+(hx<ct.x+50?8:-8),hy,6,0,7); g.stroke(); }
  for (const [bx,by] of [[7030,800],[7030,880],[7030,960]]){ g.fillStyle="#7a6a58"; g.fillRect(bx,by,70,12); g.fillStyle="#5a4c3e"; g.fillRect(bx,by+10,70,3); }
  const pth=R(7172,660,56,960); rect(pth,"#a2865c"); grain(pth,.5); blotches(pth,40,"rgba(60,40,20,.9)",4,12,.25);
  for (let yy=1600;yy>700;yy-=26){ g.fillStyle="rgba(60,40,25,.35)"; g.beginPath(); g.ellipse(7192+((yy/26)%2)*12,yy,3,5,0,0,7); g.fill(); }
  rect(R(7160,672,84,96),"#9a7e56"); grain(R(7160,672,84,96),.5); }
// 4) sidewalks + curbs, then asphalt
for (const w of walks){ rect(w,"#d3cab8"); }
for (const w of walks){ g.strokeStyle="rgba(70,60,45,.13)"; g.lineWidth=1; for (let x=w.x;x<w.x+w.w;x+=26){ g.beginPath(); g.moveTo(x+.5,w.y); g.lineTo(x+.5,w.y+w.h); g.stroke(); } for (let y=w.y;y<w.y+w.h;y+=26){ g.beginPath(); g.moveTo(w.x,y+.5); g.lineTo(w.x+w.w,y+.5); g.stroke(); } }
for (const w of walks) grain(w,.25);
for (const r of roads){ rect(R(r.x-4,r.y-4,r.w+8,r.h+8),"#e4dccb"); }           // curb tops
for (const r of roads){ rect(r,"#3a3d43"); }
for (const r of roads){ grain(r,.4);
  // wheel tracks + gutters
  g.fillStyle="rgba(0,0,0,.18)"; if (r.w>r.h){ g.fillRect(r.x,r.y,r.w,5); g.fillRect(r.x,r.y+r.h-5,r.w,5); } else { g.fillRect(r.x,r.y,5,r.h); g.fillRect(r.x+r.w-5,r.y,5,r.h); }
  }
function hLine(r,col,dash,w){ g.strokeStyle=col; g.lineWidth=w||3; g.setLineDash(dash||[]); g.beginPath(); g.moveTo(r.x,r.y+r.h/2); g.lineTo(r.x+r.w,r.y+r.h/2); g.stroke(); g.setLineDash([]); }
function vLine(r,col,dash,w){ g.strokeStyle=col; g.lineWidth=w||3; g.setLineDash(dash||[]); g.beginPath(); g.moveTo(r.x+r.w/2,r.y); g.lineTo(r.x+r.w/2,r.y+r.h); g.stroke(); g.setLineDash([]); }
for (const r of roads) (r.w>r.h?hLine:vLine)(r,"rgba(240,240,232,.6)",[24,22]);   // schlicht: nur eine gestrichelte Mittellinie
// intersections: clean the dashes, add crosswalks + stop bars
function zebra(x,y,horiz,n){ g.fillStyle="rgba(246,244,236,.92)"; for (let i=0;i<(n||7);i++){ if (horiz) g.fillRect(x+i*15,y,8,34); else g.fillRect(x,y+i*15,34,8); } }
for (const x of DX) for (const y of [...DY,1640]){ const hh=y===1640?140:110; g.fillStyle=TEXC("#3a3d43"); g.fillRect(x,y,110,hh); grain(R(x,y,110,hh),.4); }   // Kreuzungen ohne Zebrastreifen
// 5) airport
{ const rw=AIR.runway;
  // gepflegtes Flugfeld: gemähter Rasen mit Streifen + Zaun
  // Umgebung: trockener Rasen statt Sand, damit das Flugfeld nicht hart auf Sand trifft
  // Flughafengelände wie in GTA: Beton und Asphalt statt Rasen
  const slabs=(Q,c,sz,va)=>{ rect(Q,c); for (let y=Q.y;y<Q.y+Q.h;y+=sz) for (let x=Q.x;x<Q.x+Q.w;x+=sz){ const k=rnd(); g.fillStyle=k<.5?`rgba(0,0,0,${va*rnd()})`:`rgba(255,255,255,${va*.7*rnd()})`; g.fillRect(x,y,Math.min(sz,Q.x+Q.w-x),Math.min(sz,Q.y+Q.h-y)); }
    g.fillStyle="rgba(0,0,0,.12)"; for (let x=Q.x;x<=Q.x+Q.w;x+=sz) g.fillRect(x,Q.y,1.2,Q.h); for (let y=Q.y;y<=Q.y+Q.h;y+=sz) g.fillRect(Q.x,y,Q.w,1.2); };
  { const O=R(AX-150,110,2140,970); slabs(O,"#a9a497",80,.06); grain(O,.35); blotches(O,26,"rgba(60,55,50,.8)",10,40,.08); const fg=g.createLinearGradient(O.x,0,O.x+180,0); fg.addColorStop(0,"rgba(186,164,112,1)"); fg.addColorStop(1,"rgba(186,164,112,0)"); g.fillStyle=fg; g.fillRect(O.x,O.y,180,O.h); }
  { const F=R(AX+30,250,2000,830); slabs(F,"#9c9a95",60,.07); grain(F,.45); blotches(F,60,"rgba(30,28,30,.85)",6,26,.1); g.strokeStyle="rgba(232,195,74,.55)"; g.lineWidth=2; g.strokeRect(F.x+14,F.y+14,F.w-28,F.h-28);
    // Maschendrahtzaun mit Pfosten (Schatten nach Südosten), Tor zum Terminal
    const fence=(x0,y0,x1,y1)=>{ g.strokeStyle="rgba(20,18,26,.22)"; g.lineWidth=4; g.beginPath(); g.moveTo(x0+5,y0+3); g.lineTo(x1+5,y1+3); g.stroke(); g.strokeStyle="#9aa0a6"; g.lineWidth=2.2; g.beginPath(); g.moveTo(x0,y0); g.lineTo(x1,y1); g.stroke(); g.strokeStyle="rgba(255,255,255,.35)"; g.lineWidth=.8; g.beginPath(); g.moveTo(x0,y0-1); g.lineTo(x1,y1-1); g.stroke();
      const L=Math.hypot(x1-x0,y1-y0); for (let d=0;d<=L;d+=34){ const x=x0+(x1-x0)*d/L, y=y0+(y1-y0)*d/L; g.fillStyle="rgba(20,18,26,.3)"; g.fillRect(x+1,y+1,6,4); g.fillStyle="#5d636a"; g.fillRect(x-2,y-2,4,4); } };
    fence(F.x,F.y,F.x+F.w,F.y); fence(F.x,F.y,F.x,F.y+F.h); fence(F.x+F.w,F.y,F.x+F.w,F.y+F.h); }
  // Schultern + Asphalt
  rect(R(rw.x-30,rw.y-16,rw.w+60,rw.h+32),"#5b5e62"); grain(R(rw.x-30,rw.y-16,rw.w+60,rw.h+32),.4);
  rect(rw,"#2f3236"); if (TEXP.asph){ g.save(); g.globalAlpha=.85; g.fillStyle=TEXP.asph; g.fillRect(rw.x,rw.y,rw.w,rw.h); g.restore(); } grain(rw,.5);
  // Blast Pads mit gelben Winkeln an beiden Enden
  for (const [x0,dir] of [[rw.x,1],[rw.x+rw.w-110,-1]]){ rect(R(x0,rw.y,110,rw.h),"#3a3d42"); g.strokeStyle="#e8c34a"; g.lineWidth=5; for (let k=0;k<4;k++){ const xc=x0+(dir>0?18+k*26:110-18-k*26); g.beginPath(); g.moveTo(xc-dir*16,rw.y+14); g.lineTo(xc+dir*6,rw.y+rw.h/2); g.lineTo(xc-dir*16,rw.y+rw.h-14); g.stroke(); } } for (let x=rw.x;x<rw.x+rw.w;x+=60){ g.fillStyle=rnd()<.5?"rgba(255,255,255,.025)":"rgba(0,0,0,.05)"; g.fillRect(x,rw.y,60,rw.h); }
  g.fillStyle="rgba(245,245,240,.92)"; g.fillRect(rw.x+110,rw.y+8,rw.w-220,3); g.fillRect(rw.x+110,rw.y+rw.h-11,rw.w-220,3); g.fillRect(rw.x+110,rw.y+8,5,rw.h-16); g.fillRect(rw.x+rw.w-115,rw.y+8,5,rw.h-16);
  for (let x=rw.x+420;x<rw.x+rw.w-440;x+=90) g.fillRect(x,rw.y+rw.h/2-3,50,6); for (const xx of [rw.x+124,rw.x+rw.w-164]) for (let k=0;k<8;k++) g.fillRect(xx,rw.y+18+k*14,40,8);
  for (const xx of [rw.x+320,rw.x+rw.w-380]) for (const yy of [rw.y+26,rw.y+rw.h-44]) g.fillRect(xx,yy,60,18);
  g.font='400 64px "Bebas Neue",Impact,sans-serif'; g.textAlign="center"; g.textBaseline="middle"; g.save(); g.translate(rw.x+230,rw.y+rw.h/2); g.rotate(Math.PI/2); g.fillText("07",0,0); g.restore(); g.save(); g.translate(rw.x+rw.w-230,rw.y+rw.h/2); g.rotate(-Math.PI/2); g.fillText("25",0,0); g.restore();
  const tw=AIR.taxi; rect(tw,"#3b3e43"); grain(tw,.5); for (const x0 of [400,1000,1600]){ const x=x0+AX; rect(R(x-30,rw.y+rw.h,60,tw.y-rw.y-rw.h),"#3b3e43"); }
  hLine(tw,"#e8c34a",null,3); g.strokeStyle="#e8c34a"; g.lineWidth=3; for (const x0 of [400,1000,1600]){ const x=x0+AX; g.beginPath(); g.moveTo(x,rw.y+rw.h+22); g.lineTo(x,tw.y+tw.h/2-1.5); g.stroke(); }
  for (const L of AIRL) { g.fillStyle="#24272c"; g.beginPath(); g.arc(L.x,L.y,L.big?4.5:3.2,0,7); g.fill(); g.fillStyle=L.c; g.globalAlpha=.9; g.beginPath(); g.arc(L.x,L.y,L.big?2.4:1.7,0,7); g.fill(); g.globalAlpha=1; }   // Lampen-Fassungen
  const ap=AIR.apron; rect(ap,"#aca99f"); for (let y=ap.y;y<ap.y+ap.h;y+=60) for (let x=ap.x;x<ap.x+ap.w;x+=60){ g.fillStyle=`rgba(${rnd()<.5?"0,0,0":"255,255,255"},${.02+rnd()*.04})`; g.fillRect(x,y,60,60); }
  g.strokeStyle="rgba(0,0,0,.14)"; g.lineWidth=1.5; for (let x=ap.x;x<=ap.x+ap.w;x+=60){ g.beginPath(); g.moveTo(x,ap.y); g.lineTo(x,ap.y+ap.h); g.stroke(); } for (let y=ap.y;y<=ap.y+ap.h;y+=60){ g.beginPath(); g.moveTo(ap.x,y); g.lineTo(ap.x+ap.w,y); g.stroke(); }
  grain(ap,.35); blotches(ap,30,"rgba(0,0,0,.7)",8,24,.12);
  g.strokeStyle="#e8c34a"; g.lineWidth=3; for (const p of PLANES){ g.beginPath(); g.moveTo(p.x,tw.y+30); g.lineTo(p.x,ap.y+ap.h-10); g.stroke(); g.fillStyle="rgba(232,195,74,.9)"; g.fillRect(p.x-30,ap.y+ap.h-30,60,4); }
  rect(R(260+AX,1250,1440,50),"#d3cab8"); grain(R(260+AX,1250,1440,50),.25);
  const pk=R(1700+AX,1080,140,210); rect(pk,"#45484e"); grain(pk,.5); g.fillStyle="rgba(240,240,232,.75)"; for (let y=pk.y+10;y<pk.y+pk.h;y+=34){ g.fillRect(pk.x+6,y,50,2); g.fillRect(pk.x+84,y,50,2); } }
// 5b) Central Bank Vorplatz + Museum-Plaza
const sign2=(x,y,txt,bg,fg)=>{ g.font='400 15px "Bebas Neue",Impact,sans-serif'; const w=g.measureText(txt).width+18; g.fillStyle="rgba(0,0,0,.25)"; rr(g,x-w/2+2,y-9,w,20,5); g.fill(); g.fillStyle=bg; rr(g,x-w/2,y-11,w,20,5); g.fill(); g.fillStyle=fg; g.textAlign="center"; g.textBaseline="middle"; g.fillText(txt,x,y); };
{ const B=BANKB, P=R(B.x-20,B.y+B.h,B.w+40,1614-(B.y+B.h)); rect(P,"#e6e0d4"); for (let x=P.x;x<P.x+P.w;x+=40) rect(R(x,P.y,1,P.h),"rgba(0,0,0,.06)"); for (let y=P.y;y<P.y+P.h;y+=40) rect(R(P.x,y,P.w,1),"rgba(0,0,0,.06)");
  for (let i=0;i<4;i++) rect(R(B.x+60-i*8,B.y+B.h+i*9,B.w-120+i*16,9),i%2?"#d8d0c0":"#efe9dd");
  for (const x of [B.x+70,B.x+B.w-70]){ g.fillStyle="#9aa2ac"; g.beginPath(); g.arc(x,P.y+120,5,0,7); g.fill(); g.fillStyle="#1f3d7a"; g.fillRect(x+4,P.y+96,30,18); g.fillStyle="#fff"; g.fillRect(x+4,P.y+103,30,4); }
  sign2(B.x+B.w/2,P.y+150,"CENTRAL BANK","#1d2733","#d8b35a"); }
{ const M=MUSB, P=R(M.x-40,M.y-60,M.w+80,M.h+130); rect(P,"#e9e3d6"); grain(P,.2); rect(R(M.x+M.w/2-40,960,80,P.y-960+4),"#ddd5c4"); for (let i=0;i<3;i++) rect(R(M.x+80-i*8,M.y-14-i*8,M.w-160+i*16,8),i%2?"#d8d0c0":"#f3eee4");
  sign2(M.x+M.w/2,M.y-42,"L.A. MUSEUM OF ART","#2b2433","#e8c34a"); }
// 6) JJ's lot
{ const H=HOUSE; const walk=R(DOOR.x-16,H.y+H.h,32,2480-26-(H.y+H.h)); rect(walk,"#e0d8c8"); for (let y=walk.y;y<walk.y+walk.h;y+=24) rect(R(walk.x,y,walk.w,1),"rgba(0,0,0,.12)"); grain(walk,.25);
  rect(R(DOOR.x-50,H.y+H.h,100,20),"#d6cdbb"); rect(R(DOOR.x-50,H.y+H.h+18,100,2),"rgba(0,0,0,.15)");
  const dw=R(H.x+H.w+18,H.y+40,64,2480-26-(H.y+40)); rect(dw,"#cfc7b6"); for (let y=dw.y+20;y<dw.y+dw.h;y+=56) rect(R(dw.x,y,dw.w,1.5),"rgba(0,0,0,.12)"); grain(dw,.3); blotches(dw,4,"rgba(0,0,0,.8)",8,16,.15);
  // flower beds + hedges
  for (const [x0,x1] of [[H.x+6,DOOR.x-54],[DOOR.x+54,H.x+H.w-6]]){ rect(R(x0,H.y+H.h+2,x1-x0,16),"#6b4f35"); for (let x=x0+6;x<x1;x+=12){ g.fillStyle="#3d7a33"; g.beginPath(); g.arc(x,H.y+H.h+10,6,0,7); g.fill(); g.fillStyle=["#ff6a8e","#ffd24a","#ffffff","#c58cff"][Math.floor(rnd()*4)]; g.beginPath(); g.arc(x+rnd()*4-2,H.y+H.h+8,2,0,7); g.fill(); } }
  g.fillStyle="#3c6e2f"; for (let y=1856;y<2452;y+=12){ g.beginPath(); g.arc(566,y,9,0,7); g.fill(); }
  // pool deck + pool
  const deck=R(POOL.x-24,POOL.y-24,POOL.w+48,POOL.h+48); rect(deck,"#e6dfd0"); for (let x=deck.x;x<deck.x+deck.w;x+=24) rect(R(x,deck.y,1,deck.h),"rgba(0,0,0,.08)"); grain(deck,.2);
  const pg=g.createLinearGradient(POOL.x,POOL.y,POOL.x+POOL.w,POOL.y+POOL.h); pg.addColorStop(0,"#73dbef"); pg.addColorStop(1,"#2a8cc2"); g.fillStyle=pg; g.fillRect(POOL.x,POOL.y,POOL.w,POOL.h);
  g.fillStyle="rgba(0,40,80,.25)"; g.fillRect(POOL.x,POOL.y,POOL.w,8); g.fillRect(POOL.x,POOL.y,8,POOL.h);
  for (const [x,y] of [[POOL.x+POOL.w+6,POOL.y+10],[POOL.x+POOL.w+6,POOL.y+50]]){ rect(R(x,y,14,30),"#f4f4f2"); rect(R(x,y,14,8),"#3a8fd8"); }
  g.strokeStyle="#6d5a44"; g.lineWidth=3; g.strokeRect(560,1850,380,604);
  // mailbox
  rect(R(DOOR.x+30,2440,10,14),"#2b2f36"); rect(R(DOOR.x+28,2436,14,6),"#c23b2f"); }
// 6b) Nachbarschaft: Wege, Einfahrten, Schilder, Parkplatz
{ const path=(x,y0,y1,w)=>{ const r2=R(x-w/2,Math.min(y0,y1),w,Math.abs(y1-y0)); rect(r2,"#e0d8c8"); grain(r2,.25); };
  const sign=(x,y,txt,bg,fg)=>{ g.font='400 15px "Bebas Neue",Impact,sans-serif'; const w=g.measureText(txt).width+18; g.fillStyle="rgba(0,0,0,.25)"; rr(g,x-w/2+2,y-9,w,20,5); g.fill(); g.fillStyle=bg; rr(g,x-w/2,y-11,w,20,5); g.fill(); g.fillStyle=fg; g.textAlign="center"; g.textBaseline="middle"; g.fillText(txt,x,y); };
  path(NBR1.x+NBR1.w/2,NBR1.y+NBR1.h,2454,22); path(NBR2.x+NBR2.w/2,2606,NBR2.y,22);
  const ap=R(GARAGE.x,2606,GARAGE.w,GARAGE.y-2606); rect(ap,"#bdb6a8"); grain(ap,.35); blotches(ap,5,"rgba(0,0,0,.8)",6,14,.15);
  for (let i=0;i<3;i++){ rect(R(GARAGE.x+12+i*72,GARAGE.y-6,62,6),"#5d6268"); for (let y=GARAGE.y-6;y<GARAGE.y;y+=2) rect(R(GARAGE.x+12+i*72,y,62,1),"rgba(0,0,0,.25)"); }
  sign(GARAGE.x+GARAGE.w/2,2630,"RICO'S AUTOS","#2b2f36","#ffb347");
  { const dw=R(1645,2856,50,104); rect(dw,"#bdb6a8"); grain(dw,.35); rect(R(1648,YGARB.y+YGARB.h-6,44,6),"#5d6268"); sign(1724,2884,"YUNUS' GARAGE","#1d2733","#58d0ff"); }
  path(DINER.x+DINER.w/2,DINER.y+DINER.h,2454,26); const pk=R(1520,2240,170,170); rect(pk,"#45484e"); grain(pk,.4); g.fillStyle="rgba(240,240,232,.75)"; for (let y=pk.y+8;y<pk.y+pk.h;y+=38) g.fillRect(pk.x+8,y,60,2);
  g.fillStyle="#d8303a"; rr(g,DINER.x+10,DINER.y+DINER.h-2,DINER.w-20,10,3); g.fill(); g.fillStyle="#fff"; for (let x=DINER.x+16;x<DINER.x+DINER.w-16;x+=16) g.fillRect(x,DINER.y+DINER.h,8,6);
  sign(DINER.x+DINER.w/2,DINER.y+DINER.h+22,"TACOS EL REY","#d8303a","#fff4dc");
  path(LAUNDRY.x+LAUNDRY.w/2,2606,LAUNDRY.y,24); sign(LAUNDRY.x+LAUNDRY.w/2,2630,"WASCHSALON 24/7","#2a9df4","#ffffff");
  for (const [x,y] of [[NBR1.x+20,NBR1.y+NBR1.h+18],[NBR2.x+NBR2.w-24,NBR2.y-18]]){ g.fillStyle="#3d7a33"; g.beginPath(); g.arc(x,y,9,0,7); g.fill(); g.fillStyle="#ff6a8e"; g.beginPath(); g.arc(x+2,y-2,2.5,0,7); g.fill(); } }
// 6c) Hafen: Kai, Kranschienen, Container
{ const qa=R(4560,3050,CITYW-4560,QUAY_Y-3050); rect(qa,"#a7a39a"); grain(qa,.45); g.strokeStyle="rgba(0,0,0,.12)"; g.lineWidth=1; for (let x=qa.x;x<qa.x+qa.w;x+=64){ g.beginPath(); g.moveTo(x,qa.y); g.lineTo(x,QUAY_Y); g.stroke(); }
  g.fillStyle="#e8c34a"; g.fillRect(4560,QUAY_Y-16,CITYW-4560,3); rect(R(4560,QUAY_Y-4,CITYW-4560,9),"#3e3f40");
  for (let x=4600;x<CITYW;x+=110){ g.fillStyle="#26282b"; g.beginPath(); g.arc(x,QUAY_Y-9,4.5,0,7); g.fill(); g.fillStyle="#555"; g.beginPath(); g.arc(x-1,QUAY_Y-10,1.6,0,7); g.fill(); }
  for (let x=4650;x<CITYW;x+=150){ g.fillStyle="#141516"; rr(g,x,QUAY_Y+3,22,7,3); g.fill(); }
  g.strokeStyle="#6b6f74"; g.lineWidth=2; for (const y of [3094,3166]){ g.beginPath(); g.moveTo(4900,y); g.lineTo(5700,y); g.stroke(); }
  for (const c of CONTS){ const lift=c.st*3; g.fillStyle="rgba(20,15,25,.32)"; g.fillRect(c.x+3+lift,c.y+3+lift*.6,c.w,c.h);
    for (let l=0;l<c.st;l++){ const ox=-l*2.2, oy=-l*2.2, top=l===c.st-1; g.fillStyle=top?c.c:shade(c.c,.7); g.fillRect(c.x+ox,c.y+oy,c.w,c.h);
      if (top){ g.fillStyle="rgba(0,0,0,.16)"; for (let x=c.x+ox+3;x<c.x+ox+c.w-3;x+=5) g.fillRect(x,c.y+oy+2,1.6,c.h-4); g.fillStyle="rgba(255,255,255,.18)"; g.fillRect(c.x+ox,c.y+oy,c.w,2); g.fillStyle="rgba(0,0,0,.3)"; g.fillRect(c.x+ox+c.w-4,c.y+oy,4,c.h); } } }
  for (const c of CRANES){ const H=170, sx=H*.45, sy=H*.17; g.fillStyle="rgba(25,15,40,.22)"; g.fillRect(c.x-8+sx,3040+sy,16,330); g.fillRect(c.x-36+sx,3088+sy,72,10); g.fillRect(c.x-36+sx,3160+sy,72,10); } }
// 6a) terminal passages: polished floor
for (const r of TUNNELS){ rect(r,"#cfcac0"); for (let y=r.y;y<r.y+r.h;y+=20) for (let x=r.x;x<r.x+r.w;x+=20){ g.fillStyle=((x+y)/20)%2?"rgba(0,0,0,.05)":"rgba(255,255,255,.08)"; g.fillRect(x,y,20,20); } g.fillStyle="#ffcf3f"; for (let y=r.y+10;y<r.y+r.h;y+=40) g.fillRect(r.x+r.w/2-2,y,4,18); }
// 6b) gun shop forecourt
{ const pth=R(1572,1806,56,98); rect(pth,"#d9d0bf"); for (let y=pth.y;y<pth.y+pth.h;y+=14) rect(R(pth.x,y,pth.w,1),"rgba(0,0,0,.1)"); grain(pth,.25);
  g.fillStyle="#b3232b"; g.beginPath(); g.ellipse(SHOP.x,SHOP.y+8,38,11,0,0,7); g.fill(); g.fillStyle="#f3efe6"; g.font='400 13px "Bebas Neue",Impact,sans-serif'; g.textAlign="center"; g.textBaseline="middle"; g.fillText("LA ARMS",SHOP.x,SHOP.y+9); }
// 6d) Sunset Strip Deko: Walk of Fame, Parkplätze, Foodtruck-Platz, rote Teppiche
{ const star=(x,y,r,c)=>{ g.fillStyle=c; g.beginPath(); for (let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, rr2=i%2?r*.45:r; g.lineTo(x+Math.cos(a)*rr2,y+Math.sin(a)*rr2); } g.closePath(); g.fill(); };
  for (let x=180;x<1830;x+=64) for (const y of [687,813]){ if (x>870&&x<1040&&y>800) continue; rect(R(x-13,y-11,26,22),"#2a2228"); star(x,y,9,"#f08aa8"); g.fillStyle="#e8c34a"; g.beginPath(); g.arc(x,y,2.4,0,7); g.fill(); }
  const lot=(r)=>{ rect(r,"#3b3d42"); grain(r,.4); g.fillStyle="rgba(240,240,232,.75)"; for (let x=r.x+8;x<r.x+r.w-10;x+=44) g.fillRect(x,r.y+6,2,r.h*.42); for (let x=r.x+8;x<r.x+r.w-10;x+=44) g.fillRect(x,r.y+r.h*.56,2,r.h*.42); };
  lot(R(210,1120,620,140)); lot(R(1510,1110,270,150));
  const P=PLAZA; rect(P,"#b9846a"); for (let y=P.y;y<P.y+P.h;y+=16) for (let x=P.x+((y/16)%2)*12;x<P.x+P.w;x+=24){ g.fillStyle=rnd()<.5?"rgba(0,0,0,.07)":"rgba(255,255,255,.06)"; g.fillRect(x,y,23,15); } grain(P,.35);
  for (const t of PTABLES){ g.fillStyle="#6b4a2e"; g.fillRect(t.x-16,t.y-9,32,18); g.fillStyle="#8a6340"; g.fillRect(t.x-16,t.y-9,32,3); g.fillStyle="#4a3220"; g.fillRect(t.x-18,t.y-14,36,4); g.fillRect(t.x-18,t.y+10,36,4); }
  for (const v of VENUES){ if (!v.carpet) continue; const cx=v.x+v.w/2, top=v.face==="n", y0=top?826:v.y+v.h, y1=top?v.y:674; rect(R(cx-14,Math.min(y0,y1),28,Math.abs(y1-y0)),"#b3121f"); g.fillStyle="rgba(0,0,0,.15)"; g.fillRect(cx-14,Math.min(y0,y1),3,Math.abs(y1-y0));
    for (const sx of [-24,24]) for (let yy=Math.min(y0,y1)+6;yy<Math.max(y0,y1);yy+=22){ g.fillStyle="#e8c34a"; g.beginPath(); g.arc(cx+sx,yy,3,0,7); g.fill(); } }
  for (let yy=780;yy<1600;yy+=34) for (const bx of [7166,7236]){ g.fillStyle="#2f5a26"; g.beginPath(); g.arc(bx+(rnd()-.5)*6,yy,12+rnd()*5,0,7); g.fill(); g.fillStyle="rgba(140,190,90,.35)"; g.beginPath(); g.arc(bx-3,yy-4,5,0,7); g.fill(); }
  for (const bx of [7180,7216]){ g.fillStyle="#3a6a2e"; g.beginPath(); g.arc(bx,1588,15,0,7); g.fill(); } }
// 6e) Küste ringsum: Wasser hinter einer Steinböschung (Farbe nach Abstand zum Ufer)
{ const depth=(x,y)=>Math.max(SHL(y)-x,SHT(x)-y,x-SHR(y));
  const C0=[94,192,200], C1=[35,134,173], C2=[29,99,144], col=d=>{ const a=Math.min(1,d/26), b2=Math.max(0,Math.min(1,(d-26)/40)); return a<1?C0.map((v,i)=>v+(C1[i]-v)*a):C1.map((v,i)=>v+(C2[i]-v)*b2); };
  const paint=(x0,y0,w,h)=>{ const S=2, cw=Math.ceil(w/S), ch=Math.ceil(h/S), img=new ImageData(cw,ch), dd=img.data;
    for (let j=0;j<ch;j++) for (let i=0;i<cw;i++){ const x=x0+i*S, y=y0+j*S, d=depth(x,y); if (d<=0||y>waterY(x)-4) continue; const e=Math.max(0,Math.min(x,y,LANDW-x)), tt=d/(d+e+.001), c=tt<.4?C0.map((v,q)=>v+(C1[q]-v)*(tt/.4)):C1.map((v,q)=>v+(C2[q]-v)*Math.min(1,(tt-.4)/.5)), k=(j*cw+i)*4, n=(Math.sin(x*.21+y*.13)+Math.sin(x*.05-y*.09))*3; dd[k]=c[0]+n; dd[k+1]=c[1]+n; dd[k+2]=c[2]+n; dd[k+3]=255; }
    const c=mk(cw,ch); c.getContext("2d").putImageData(img,0,0); g.imageSmoothingEnabled=true; g.drawImage(c,x0,y0,w,h); };
  paint(0,0,112,WH); paint(LANDW-76,0,76,WH); paint(0,0,LANDW,128);
  // offenes Meer an den Rändern weich in die Randfarbe überblenden
  const seaEdge=(x0,w)=>{ const S=2, y0=2950, h=WH-y0, cw=Math.ceil(w/S), ch=Math.ceil(h/S), img=new ImageData(cw,ch), dd=img.data, CB=[13,70,117];
    for (let j=0;j<ch;j++) for (let i=0;i<cw;i++){ const x=x0+i*S, y=y0+j*S; if (y<=waterY(x)-4) continue; const e=Math.min(x,LANDW-x), a=Math.pow(Math.max(0,1-e/240),1.4); if (a<=0) continue; const ty=Math.max(0,Math.min(1,(y-3300)/(WH0-3300))), k=(j*cw+i)*4; for (let q=0;q<3;q++) dd[k+q]=C2[q]+(CB[q]-C2[q])*ty; dd[k+3]=a*255; }
    const c=mk(cw,ch); c.getContext("2d").putImageData(img,0,0); g.drawImage(c,x0,y0,w,h); };
  seaEdge(0,240); seaEdge(LANDW-240,240);
  g.save(); g.globalAlpha=.22; g.strokeStyle="#e9f6f4"; g.lineWidth=1.4; for (let i=0;i<300;i++){ const x=rnd()*LANDW, y=rnd()*WH; if (depth(x,y)<16||y>waterY(x)-10) continue; g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+6,y-3,x+12,y); g.stroke(); } g.restore();
  const rock=(x,y)=>{ if (y>waterY(x)-6) return; const s2=5+rnd()*8; g.fillStyle="rgba(30,20,15,.3)"; g.beginPath(); g.ellipse(x+3,y+3,s2,s2*.75,0,0,7); g.fill(); const gr=g.createRadialGradient(x-s2*.3,y-s2*.3,1,x,y,s2); gr.addColorStop(0,"#a09484"); gr.addColorStop(1,"#55493e"); g.fillStyle=gr; g.beginPath(); g.ellipse(x,y,s2,s2*.75,rnd()*3,0,7); g.fill(); };
  // heller Sandstreifen hinter den Steinen, damit Land weich zur Küste ausläuft
  { const C="226,206,158"; for (let x=0;x<LANDW;x+=6){ const y0=SHT(x), gr=g.createLinearGradient(0,y0,0,y0+70); gr.addColorStop(0,`rgba(${C},.75)`); gr.addColorStop(1,`rgba(${C},0)`); g.fillStyle=gr; g.fillRect(x,y0,6,70); }
    for (let y=0;y<3000;y+=6){ const x0=SHL(y), gl=g.createLinearGradient(x0,0,x0+70,0); gl.addColorStop(0,`rgba(${C},.75)`); gl.addColorStop(1,`rgba(${C},0)`); g.fillStyle=gl; g.fillRect(x0,y,70,6);
      const x1=SHR(y), gr2=g.createLinearGradient(x1,0,x1-70,0); gr2.addColorStop(0,`rgba(${C},.75)`); gr2.addColorStop(1,`rgba(${C},0)`); g.fillStyle=gr2; g.fillRect(x1-70,y,70,6); } }
  for (let y=0;y<3020;y+=13) rock(SHL(y)+(rnd()-.5)*8,y); for (let x=0;x<LANDW;x+=13) rock(x,SHT(x)+(rnd()-.5)*8); for (let y=0;y<3020;y+=13) rock(SHR(y)+(rnd()-.5)*8,y); }
// 6g) Bel Air Key: Nordost-Insel mit Brücke und JJs Villa (eigener Bodencanvas ground3)
const ground3=mk(G3.w*GS,G3.h*GS,q=>{ q.scale(GS,GS); q.translate(-G3.x,-G3.y); const X=G3.x, Y=G3.y, W=G3.w, H=G3.h, ri=Math.random;
  const sg=q.createLinearGradient(X,0,X+W,0); sg.addColorStop(0,"#1d6390"); sg.addColorStop(1,"#185783"); q.fillStyle=sg; q.fillRect(X,Y,W,H);
  q.drawImage(ground,9200*GS,0,200*GS,H*GS,9200,0,200,H);
  const isle=k=>{ q.beginPath(); for (let i=0;i<=96;i++){ const a=i/96*Math.PI*2, r=neR(a)*k; const px=NEI.cx+NEI.rx*r*Math.cos(a), py=NEI.cy+NEI.ry*r*Math.sin(a); i?q.lineTo(px,py):q.moveTo(px,py); } q.closePath(); };
  // flaches Wasser, Brandung, Strand
  q.save(); q.filter="blur(18px)"; isle(1.2); q.fillStyle="#2f8fb0"; q.fill(); isle(1.11); q.fillStyle="#5ec0c8"; q.fill(); q.restore();
  isle(1.06); q.fillStyle="#e2ce9e"; q.fill(); if (TEXP.sand){ q.save(); q.globalAlpha=.6; q.fillStyle=TEXP.sand; q.fill(); q.restore(); }
  q.save(); q.strokeStyle="rgba(255,255,255,.55)"; q.lineWidth=3; isle(1.075); q.stroke(); q.restore();
  isle(.985); q.fillStyle="#5f9a42"; q.fill(); if (TEXP.grass){ q.save(); q.clip(); q.globalAlpha=.9; q.fillStyle=TEXP.grass; q.fillRect(X,Y,W,H); q.globalCompositeOperation="color"; q.globalAlpha=.4; q.fillStyle="#5f9a42"; q.fillRect(X,Y,W,H); q.restore(); }
  q.save(); isle(.985); q.clip(); for (let i=0;i<14;i++){ q.fillStyle=i%2?"rgba(255,255,255,.035)":"rgba(0,0,0,.03)"; q.fillRect(9660+i*76,0,38,H); } q.restore();
  // Brücke
  const B=NEBR; q.fillStyle="rgba(5,25,45,.4)"; q.fillRect(B.x+20,B.y+14,B.w-20,B.h+10);
  for (let x=B.x+50;x<B.x+B.w-20;x+=90){ q.fillStyle="#7d7a73"; q.fillRect(x,B.y-8,14,B.h+16); }
  q.fillStyle="#bdb8ad"; q.fillRect(B.x,B.y-10,B.w,B.h+20); q.fillStyle="#3a3d43"; q.fillRect(B.x,B.y,B.w,B.h); if (TEXP.asph){ q.save(); q.globalAlpha=.85; q.fillStyle=TEXP.asph; q.fillRect(B.x,B.y,B.w,B.h); q.restore(); }
  q.fillStyle="#e9e4d8"; q.fillRect(B.x,B.y-12,B.w,4); q.fillRect(B.x,B.y+B.h+8,B.w,4); for (let x=B.x;x<B.x+B.w;x+=24){ q.fillRect(x,B.y-12,3,10); q.fillRect(x,B.y+B.h+2,3,10); }
  q.fillStyle="#f2c230"; q.fillRect(B.x,B.y+B.h/2-3,B.w,2); q.fillRect(B.x,B.y+B.h/2+1,B.w,2);
  // Inselstraße mit Gehweg und Wendekreis
  const road=(x,y,w,h)=>{ q.fillStyle="#d3cab8"; q.fillRect(x,y-14,w,h+28); q.fillStyle="#3a3d43"; q.fillRect(x,y,w,h); if (TEXP.asph){ q.save(); q.globalAlpha=.85; q.fillStyle=TEXP.asph; q.fillRect(x,y,w,h); q.restore(); } };
  road(9640,960,890,100); q.fillStyle="#d3cab8"; q.beginPath(); q.arc(10560,1010,90,0,7); q.fill(); q.fillStyle="#3a3d43"; q.beginPath(); q.arc(10560,1010,76,0,7); q.fill(); q.fillStyle="#5f9a42"; q.beginPath(); q.arc(10560,1010,26,0,7); q.fill(); q.fillStyle="#7a6a50"; q.beginPath(); q.arc(10560,1010,9,0,7); q.fill();
  q.fillStyle="rgba(255,255,255,.75)"; for (let x=9660;x<10480;x+=46) q.fillRect(x,1008,24,3);
  // Grundstück: Mauer, Tor, Einfahrt, Terrasse, Pool
  const LOT={x:9930,y:500,w:640,h:446}; q.save(); isle(.955); q.clip(); q.fillStyle="#cfc8b8"; q.fillRect(LOT.x-6,LOT.y-6,LOT.w+12,LOT.h+12); q.fillStyle="#4f8a3a"; q.fillRect(LOT.x,LOT.y,LOT.w,LOT.h); if (TEXP.grass){ q.save(); q.globalAlpha=.7; q.fillStyle=TEXP.grass; q.fillRect(LOT.x,LOT.y,LOT.w,LOT.h); q.restore(); }
  for (let i=0;i<8;i++){ q.fillStyle=i%2?"rgba(255,255,255,.05)":"rgba(0,0,0,.04)"; q.fillRect(LOT.x+i*80,LOT.y,40,LOT.h); }
  q.fillStyle="#e6e0d2"; q.fillRect(9970,680,370,246); q.fillStyle="#d8d0bf"; for (let x=9970;x<10340;x+=28) q.fillRect(x,680,1,246); for (let y=680;y<926;y+=28) q.fillRect(9970,y,370,1);
  q.fillStyle="#efe9dc"; q.fillRect(10010,530,290,150); q.fillStyle="#d6cdb9"; for (let x=10010;x<10300;x+=22) q.fillRect(x,530,1,150);
  const P=NEPOOL; q.fillStyle="#f7f4ec"; q.fillRect(P.x-8,P.y-8,P.w+16,P.h+16); const pg=q.createLinearGradient(P.x,P.y,P.x,P.y+P.h); pg.addColorStop(0,"#7fe0ee"); pg.addColorStop(1,"#1fa3c9"); q.fillStyle=pg; q.fillRect(P.x,P.y,P.w,P.h);
  q.save(); q.globalAlpha=.35; q.strokeStyle="#fff"; q.lineWidth=1.5; for (let i=0;i<26;i++){ const x=P.x+10+ri()*(P.w-30), y=P.y+8+ri()*(P.h-16); q.beginPath(); q.moveTo(x,y); q.quadraticCurveTo(x+7,y-3,x+14,y); q.stroke(); } q.restore();
  q.fillStyle="#1d8db3"; q.fillRect(P.x+P.w-46,P.y+P.h-10,40,4);
  for (let i=0;i<4;i++){ const lx=10050+i*56, ly=664; q.fillStyle="rgba(0,0,0,.18)"; q.fillRect(lx+3,ly-8,36,14); q.fillStyle="#fafafa"; q.fillRect(lx,ly-11,36,13); q.fillStyle="#e85d3a"; q.fillRect(lx+26,ly-11,10,13); }
  q.fillStyle="#9a9488"; q.fillRect(10360,904,190,56); q.fillStyle="#b5ae9f"; for (let x=10360;x<10550;x+=19) q.fillRect(x,904,1,56);
  q.fillStyle="#cfc8b8"; q.fillRect(10120,926,70,34);
  q.fillStyle="#2d2f33"; q.fillRect(10356,940,198,6); q.fillStyle="#c9a24a"; for (let x=10360;x<10552;x+=14) q.fillRect(x,936,3,14);
  for (let x=LOT.x+10;x<LOT.x+LOT.w-10;x+=26){ if (x>10110&&x<10200) continue; if (x>10350&&x<10556) continue; q.fillStyle="#2f5a26"; q.beginPath(); q.arc(x,LOT.y+LOT.h-8,11,0,7); q.fill(); q.fillStyle="rgba(140,190,90,.35)"; q.beginPath(); q.arc(x-3,LOT.y+LOT.h-12,4,0,7); q.fill(); }
  for (let y=LOT.y+12;y<LOT.y+LOT.h-20;y+=26) for (const x of [LOT.x+10,LOT.x+LOT.w-10]){ q.fillStyle="#2f5a26"; q.beginPath(); q.arc(x,y,11,0,7); q.fill(); }
  q.restore();
  q.fillStyle="#2a2a2a"; q.font='700 20px "Bebas Neue",Impact,sans-serif'; q.textAlign="center"; q.textBaseline="middle"; q.fillStyle="#c9a24a"; q.fillText("BEL AIR KEY",9480,1090);
  // Wohngebiet: Grundstücke, Einfahrten, Hecken, Restaurant-Terrassen
  for (const b of NEHOOD){ const rest=b.style==="venue", L={x:b.x-18,y:b.y-30,w:b.w+36,h:b.h+60};
    q.fillStyle=rest?"#d9d0bf":"#4f8a3a"; q.fillRect(L.x,L.y,L.w,L.h); if (!rest&&TEXP.grass){ q.save(); q.globalAlpha=.6; q.fillStyle=TEXP.grass; q.fillRect(L.x,L.y,L.w,L.h); q.restore(); }
    if (rest){ q.fillStyle="#c8bea9"; for (let x=L.x;x<L.x+L.w;x+=18) q.fillRect(x,L.y,1,L.h);
      for (let i=0;i<2;i++){ const tx=L.x+20+i*(L.w-40), ty=L.y+L.h-14; q.fillStyle="rgba(0,0,0,.18)"; q.beginPath(); q.arc(tx+3,ty+3,11,0,7); q.fill(); q.fillStyle=i?b.neon:"#f2efe6"; q.beginPath(); q.arc(tx,ty,11,0,7); q.fill(); q.fillStyle="rgba(255,255,255,.5)"; q.beginPath(); q.arc(tx-3,ty-3,4,0,7); q.fill(); } }
    else { q.fillStyle="#2f5a26"; for (let x=L.x+6;x<L.x+L.w-4;x+=14){ q.beginPath(); q.arc(x,L.y+L.h-5,6,0,7); q.fill(); } q.fillStyle="#cfc8b8"; const dx=b.x+b.w-34; if (b.y<1200){ q.fillRect(dx,1074,30,b.y-1074); q.fillRect(b.x+20,1074,14,b.y-1074); } else { q.fillRect(b.x+b.w/2-7,b.y-30,14,30); }
      if (b.id%2){ q.fillStyle="#f7f4ec"; q.fillRect(b.x+b.w+2,b.y+18,14,50); q.fillStyle="#36b7d6"; q.fillRect(b.x+b.w+4,b.y+20,10,46); } } }
  { const P2=R(9900,1250,500,14); q.fillStyle="#cfc8b8"; q.fillRect(P2.x,P2.y,P2.w,P2.h); q.fillStyle="#b9b19f"; for (let x=P2.x;x<P2.x+P2.w;x+=16) q.fillRect(x,P2.y,1,P2.h); q.fillRect(9920,1074,14,190); }
  { const sp=(pts,col,blur)=>{ q.save(); q.shadowColor=col; q.shadowBlur=blur; q.shadowOffsetX=40000*GS; q.fillStyle="#000"; q.beginPath(); pts.forEach(([x,y],i)=>i?q.lineTo(x-40000,y):q.moveTo(x-40000,y)); q.closePath(); q.fill(); q.restore(); };
    for (const b of [NEVILLA,NEGARAGE,...NEHOOD]){ const L=b.H*.62, dx=L, dy=L*.38; sp([[b.x+b.w,b.y],[b.x+b.w+dx,b.y+dy],[b.x+b.w+dx,b.y+b.h+dy],[b.x+dx,b.y+b.h+dy],[b.x,b.y+b.h],[b.x,b.y]],"rgba(35,22,55,.42)",Math.min(28,6+b.H*.04)); sp([[b.x-6,b.y-6],[b.x+b.w+6,b.y-6],[b.x+b.w+6,b.y+b.h+6],[b.x-6,b.y+b.h+6]],"rgba(20,12,30,.45)",14); }
    for (const p of palms) if (p.x>9500) sp([[p.x+18*p.s,p.y-4],[p.x+70*p.s,p.y+14*p.s],[p.x+64*p.s,p.y+34*p.s],[p.x+16*p.s,p.y+6]],"rgba(35,22,55,.32)",10); }
  // Felsen am Ufer, Steg
  for (let i=0;i<70;i++){ const a=ri()*Math.PI*2, r=neR(a)*1.05, px=NEI.cx+NEI.rx*r*Math.cos(a), py=NEI.cy+NEI.ry*r*Math.sin(a); if (Math.abs(py-1010)<70&&px<NEI.cx) continue; const s2=5+ri()*7; const gr=q.createRadialGradient(px-2,py-2,1,px,py,s2); gr.addColorStop(0,"#a09484"); gr.addColorStop(1,"#55493e"); q.fillStyle=gr; q.beginPath(); q.ellipse(px,py,s2,s2*.75,ri()*3,0,7); q.fill(); }
});
// 6f) Santa Luna: Brücken, Kreuzungen, Speedway, Luna Park, Golfplatz
{ for (const b of BRIDGES){ const y0=3058, y1=b.y+b.h-12, xL=b.x-30, xR=b.x+b.w+30, ys=Math.max(y0,waterY(b.x+55)-8);
    g.fillStyle="rgba(5,25,45,.38)"; g.fillRect(xL+30,ys+16,xR-xL,y1-ys-30);
    for (let y=3330;y<y1-70;y+=170){ g.fillStyle="rgba(5,25,45,.42)"; g.fillRect(xL+34,y+12,xR-xL+8,24); g.fillStyle="#8d8a84"; g.fillRect(xL-10,y,xR-xL+20,22); g.fillStyle="rgba(255,255,255,.2)"; g.fillRect(xL-10,y,xR-xL+20,3); }
    rect(R(xL,y0,xR-xL,y1-y0),"#cfc7b6"); rect(R(b.x,y0,b.w,y1-y0),"#3a3d43"); grain(R(xL,y0,xR-xL,y1-y0),.35);
    g.fillStyle="rgba(0,0,0,.18)"; g.fillRect(b.x,y0,5,y1-y0); g.fillRect(b.x+b.w-5,y0,5,y1-y0);
    g.fillStyle="rgba(246,244,236,.85)"; g.fillRect(b.x+9,y0,3,y1-y0); g.fillRect(b.x+b.w-12,y0,3,y1-y0);
    vLine(R(b.x,y0,b.w,y1-y0),"rgba(240,200,60,.85)",[24,22]);
    g.fillStyle="#6f7378"; g.fillRect(xL-6,3160,6,y1-3160); g.fillRect(xR,3160,6,y1-3160); g.fillStyle="rgba(255,255,255,.35)"; g.fillRect(xL-6,3160,2,y1-3160); g.fillRect(xR,3160,2,y1-3160);
    for (let y=3200;y<y1;y+=130){ for (const x of [xL-8,xR-2]){ g.fillStyle="#2c2f33"; g.fillRect(x,y,10,10); g.fillStyle="rgba(255,226,150,.9)"; g.beginPath(); g.arc(x+5,y+5,3,0,7); g.fill(); } } }
  for (const [x,y,w,h] of [[2400,4080,110,110],[7440,4080,110,110],[4900,4080,110,110],[2800,4080,110,110],[7000,4080,110,110],[2400,5860,110,110],[7440,5860,110,110],[4900,5860,110,110],[4900,4980,110,110],[7440,4980,110,110],[2800,2960,110,90],[7000,2960,110,90]]){ g.fillStyle=TEXC("#3a3d43"); g.fillRect(x,y,w,h); grain(R(x,y,w,h),.4); }
  // Speedway
  const stad=(rad)=>{ g.beginPath(); g.arc(SPW.c2.x,SPW.c2.y,rad,-Math.PI/2,Math.PI/2); g.lineTo(SPW.c1.x,SPW.c1.y+rad); g.arc(SPW.c1.x,SPW.c1.y,rad,Math.PI/2,Math.PI*1.5); g.closePath(); };
  stad(SPW.r+SPW.w/2+46); g.fillStyle="#cdbb94"; g.fill(); stad(SPW.r+SPW.w/2+12); g.fillStyle="#7aa85a"; g.fill();
  stad(SPW.r+SPW.w/2); g.fillStyle=TEXP.asph||"#34363b"; g.fill(); stad(SPW.r-SPW.w/2); g.fillStyle="#6aa748"; g.fill();
  g.save(); stad(SPW.r-SPW.w/2); g.clip(); for (let x=SPW.c1.x-SPW.r;x<SPW.c2.x+SPW.r;x+=60){ g.fillStyle=(Math.floor(x/60)%2)?"rgba(255,255,255,.05)":"rgba(0,0,0,.04)"; g.fillRect(x,SPW.c1.y-SPW.r,60,SPW.r*2); } g.restore();
  g.save(); g.lineWidth=8; g.setLineDash([22,22]); for (const [rad,c] of [[SPW.r+SPW.w/2-4,"#e8352f"],[SPW.r-SPW.w/2+4,"#e8352f"]]){ stad(rad); g.strokeStyle="#f4f1ea"; g.setLineDash([]); g.stroke(); g.setLineDash([22,22]); g.strokeStyle=c; g.stroke(); } g.restore();
  g.save(); g.lineWidth=2; g.strokeStyle="rgba(255,255,255,.35)"; g.setLineDash([30,30]); stad(SPW.r); g.stroke(); g.restore();
  grain(R(SPW.c1.x-SPW.r-120,SPW.c1.y-SPW.r-120,SPW.c2.x-SPW.c1.x+SPW.r*2+240,SPW.r*2+240),.25);
  { const x=SPW.fx, ya=SPW.c1.y+SPW.r-SPW.w/2, sq=10; for (let j=0;j<SPW.w/sq;j++) for (let i=0;i<2;i++){ g.fillStyle=(i+j)%2?"#111":"#f6f4ee"; g.fillRect(x-sq+i*sq,ya+j*sq,sq,sq); }
    g.strokeStyle="rgba(246,244,238,.8)"; g.lineWidth=2; for (let k=0;k<3;k++) for (const off of [28,84]){ g.strokeRect(x-60-k*70,ya+off-20,40,30); } }
  g.save(); g.translate((SPW.c1.x+SPW.c2.x)/2,SPW.c1.y); g.fillStyle="rgba(255,255,255,.55)"; g.font='400 150px "Bebas Neue",Impact,sans-serif'; g.textAlign="center"; g.textBaseline="middle"; g.fillText("SANTA LUNA",0,-40); g.font='400 70px "Bebas Neue",Impact,sans-serif'; g.fillStyle="rgba(232,53,47,.75)"; g.fillText("SPEEDWAY",0,70); g.restore();
  for (const x of [2860,4560]){ const r=R(x,4216,100,360); rect(r,"#46494f"); grain(r,.4); }
  { const r=R(3240,5590,900,100); rect(r,"#46494f"); grain(r,.4); g.strokeStyle="rgba(246,244,238,.7)"; g.lineWidth=2; for (let x=3260;x<4130;x+=100) g.strokeRect(x,5602,70,40); }
  // Luna Park: Plaza, Wege, Beete, Fundamente
  { const P=R(5040,4216,2374,738); rect(P,"#cfa98a");
    // Pflaster: versetzte Klinker in warmen Tönen
    for (let y=P.y,row=0;y<P.y+P.h;y+=12,row++) for (let x=P.x-(row%2)*12;x<P.x+P.w;x+=24){ g.fillStyle=["#d3ae8e","#ccA383","#d8b796","#c79c7d"][(Math.floor(x/24)*7+row*3)%4]; g.fillRect(Math.max(P.x,x)+1,y+1,Math.min(22,P.x+P.w-x-1),10); }
    grain(P,.25);
    const pathC="#efe3cc", edge="#b8875f", path=(pts,w)=>{ g.lineCap="round"; g.lineJoin="round"; g.strokeStyle=edge; g.lineWidth=w+8; g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.stroke(); g.strokeStyle=pathC; g.lineWidth=w; g.stroke(); g.setLineDash([2,16]); g.strokeStyle="rgba(180,140,100,.5)"; g.lineWidth=w*.8; g.stroke(); g.setLineDash([]); };
    path([[5175,4380],[5175,4520],[5450,4600]],70); path([[5175,4520],[5850,4470],[6075,4400]],64); path([[5850,4470],[5850,4700],[6080,4800],[6240,4840]],60); path([[6075,4400],[6300,4300],[7300,4290]],56); path([[5450,4600],[5460,4860],[6000,4880]],56);
    // Fahrgeschäft-Plätze mit Farbringen
    const plaza=(x,y,r,c1,c2)=>{ g.fillStyle=edge; g.beginPath(); g.arc(x,y,r+8,0,7); g.fill(); for (let i=0;i<24;i++){ g.fillStyle=i%2?c1:c2; g.beginPath(); g.moveTo(x,y); g.arc(x,y,r,i/24*6.283,(i+1)/24*6.283); g.closePath(); g.fill(); } g.fillStyle=pathC; g.beginPath(); g.arc(x,y,r*.72,0,7); g.fill(); };
    plaza(CRS.x,CRS.y,112,"#e8352f","#fff3e0"); plaza(DTW.x,DTW.y,70,"#7b4bd6","#d9c8ff");
    // Rasen mit Beeten und Hecken
    const bed=(x,y,w,h)=>{ g.fillStyle="#3f6e2c"; rr(g,x-6,y-6,w+12,h+12,22); g.fill(); g.fillStyle="#6aa748"; rr(g,x,y,w,h,18); g.fill(); if (TEXP.grass){ g.save(); g.globalAlpha=.55; g.fillStyle=TEXP.grass; rr(g,x,y,w,h,18); g.fill(); g.restore(); }
      for (let i=0;i<w*h/260;i++){ const fx=x+12+rnd()*(w-24), fy=y+12+rnd()*(h-24); g.fillStyle=["#ff5f8f","#ffd23f","#ffffff","#ff8f3f","#b27bff"][i%5]; g.beginPath(); g.arc(fx,fy,2.4,0,7); g.fill(); } };
    for (const [x,y,w,h] of [[5300,4390,240,110],[5660,4760,240,110],[6420,4470,700,220],[5560,4250,220,80]]) bed(x,y,w,h);
    // Brunnen am Eingang
    { const fx=5175, fy=4470; g.fillStyle="#9a8f80"; g.beginPath(); g.arc(fx,fy,46,0,7); g.fill(); const wg=g.createRadialGradient(fx,fy,4,fx,fy,40); wg.addColorStop(0,"#bff3ff"); wg.addColorStop(1,"#2a9fd0"); g.fillStyle=wg; g.beginPath(); g.arc(fx,fy,38,0,7); g.fill(); g.fillStyle="#e8e2d6"; g.beginPath(); g.arc(fx,fy,10,0,7); g.fill(); g.strokeStyle="rgba(255,255,255,.6)"; g.lineWidth=1.5; for (const r of [18,28]){ g.beginPath(); g.arc(fx,fy,r,0,7); g.stroke(); } }
    // Buden mit gestreiften Markisen, Bänke, Laternen
    const stall=(x,y,c)=>{ g.fillStyle="rgba(30,20,30,.25)"; g.fillRect(x+4,y+4,46,34); for (let i=0;i<6;i++){ g.fillStyle=i%2?"#fff6e6":c; g.fillRect(x+i*8,y,8,34); } g.fillStyle="rgba(0,0,0,.12)"; g.fillRect(x,y+28,48,6); };
    [[5560,4520,"#e8352f"],[5620,4520,"#2fa8ff"],[5990,4520,"#ffd23f"],[6150,4640,"#2fd38a"],[5980,4700,"#ff5fd2"],[6300,4370,"#ff7a2f"],[5300,4560,"#2fa8ff"],[6560,4330,"#e8352f"]].forEach(([x,y,c])=>stall(x,y,c));
    g.fillStyle="#b5ab98"; rr(g,FW.x-140,FW.y-50,280,100,10); g.fill(); g.fillStyle="#9b917e"; g.beginPath(); g.arc(CRS.x,CRS.y,96,0,7); g.fill(); g.fillStyle="#c7bca6"; g.beginPath(); g.arc(DTW.x,DTW.y,44,0,7); g.fill();
    // Achterbahn: Schatten der Schienen + Stützen-Fundamente
    g.save(); g.strokeStyle="rgba(25,15,40,.2)"; g.lineWidth=9; g.beginPath(); CST.P.forEach((q,i)=>{ const x=q.x+q.z*.45, y=q.y+q.z*.17; i?g.lineTo(x,y):g.moveTo(x,y); }); g.closePath(); g.stroke(); g.restore();
    g.fillStyle="#8a8478"; CST.P.forEach((q,i)=>{ if (i%5===0){ g.fillRect(q.x-4,q.y-4,8,8); } });
    { const st=CST.P.reduce((m,q,i)=>q.z<CST.P[m].z?i:m,0), q=CST.P[st]; g.fillStyle="#6b5a48"; g.save(); g.translate(q.x,q.y); g.rotate(Math.atan2(q.nx,-q.ny)); g.fillRect(-60,-22,120,44); g.restore(); } }
  // Golfplatz
  { const G=R(5036,5116,2378,718); lawn(G,"#5f9a46",false);
    for (const [x,y,rx,ry,a] of [[5750,5300,380,90,-.1],[6500,5560,420,100,.35],[7050,5330,260,80,-.6]]){ g.fillStyle="#7fbf58"; g.beginPath(); g.ellipse(x,y,rx,ry,a,0,7); g.fill(); }
    g.save(); g.globalAlpha=.08; for (let i=0;i<14;i++){ g.fillStyle=i%2?"#fff":"#000"; g.fillRect(5036+i*170,5116,85,718); } g.restore();
    for (const [x,y] of [[6080,5250],[6880,5450],[7230,5200]]){ g.fillStyle="#9bd86e"; g.beginPath(); g.ellipse(x,y,70,55,0,0,7); g.fill(); g.fillStyle="#1a1a1a"; g.beginPath(); g.arc(x,y,3,0,7); g.fill(); g.strokeStyle="rgba(30,20,10,.35)"; g.lineWidth=2; g.beginPath(); g.moveTo(x,y); g.lineTo(x+18,y+8); g.stroke(); g.strokeStyle="#f4f1ea"; g.beginPath(); g.moveTo(x,y); g.lineTo(x,y-26); g.stroke(); g.fillStyle="#e8352f"; g.beginPath(); g.moveTo(x,y-26); g.lineTo(x+16,y-21); g.lineTo(x,y-16); g.fill(); }
    for (const [x,y,rx,ry] of [[6000,5330,40,22],[6170,5190,34,18],[6800,5520,46,24],[7160,5280,30,18],[6350,5650,40,20]]){ g.fillStyle="#e9dbaa"; g.beginPath(); g.ellipse(x,y,rx,ry,.3,0,7); g.fill(); g.strokeStyle="rgba(120,100,60,.35)"; g.lineWidth=2; g.stroke(); }
    g.fillStyle="#2f8fb8"; g.beginPath(); g.ellipse(6450,5280,120,60,.2,0,7); g.fill(); g.strokeStyle="rgba(200,240,250,.6)"; g.lineWidth=3; g.stroke();
    for (const [x,y] of [[5480,5330],[6250,5720],[6950,5720]]){ g.fillStyle="#cde8b0"; g.fillRect(x-22,y-14,44,28); }
    g.strokeStyle="#d9cfb4"; g.lineWidth=12; g.lineCap="round"; g.beginPath(); g.moveTo(5360,5230); g.bezierCurveTo(5700,5480,6200,5420,6400,5780); g.moveTo(6400,5780); g.bezierCurveTo(6700,5650,7000,5600,7300,5760); g.stroke(); g.lineCap="butt"; } }
// 7) parked planes (scenery, with real shadows)
function planeShape(q,body,tail){
  // silhouette: fuselage, swept wings, tailplane (nose points to +x)
  const fus=()=>{ q.beginPath(); q.moveTo(70,0); q.bezierCurveTo(68,-7,60,-10.5,48,-10.5); q.lineTo(-48,-9.5); q.quadraticCurveTo(-62,-8,-70,-2); q.lineTo(-70,2); q.quadraticCurveTo(-62,8,-48,9.5); q.lineTo(48,10.5); q.bezierCurveTo(60,10.5,68,7,70,0); q.closePath(); };
  const wing=s=>{ q.beginPath(); q.moveTo(18,s*9); q.lineTo(-20,s*66); q.lineTo(-31,s*67); q.lineTo(-27,s*60); q.lineTo(-16,s*9); q.closePath(); };
  const stab=s=>{ q.beginPath(); q.moveTo(-48,s*7); q.lineTo(-63,s*27); q.lineTo(-70,s*27); q.lineTo(-66,s*6); q.closePath(); };
  if (!tail){ q.fillStyle=body; fus(); q.fill(); wing(-1); q.fill(); wing(1); q.fill(); stab(-1); q.fill(); stab(1); q.fill(); return; }
  // wings with light falloff
  for (const s of [-1,1]){ const wg=q.createLinearGradient(0,s*9,0,s*66); wg.addColorStop(0,"#eef0f2"); wg.addColorStop(1,"#c9ced4"); q.fillStyle=wg; wing(s); q.fill(); q.strokeStyle="rgba(40,50,60,.35)"; q.lineWidth=.8; q.stroke();
    q.strokeStyle="rgba(90,100,110,.35)"; q.lineWidth=.7; for (const f of [.35,.6,.82]){ q.beginPath(); q.moveTo(-16+(-27+16)*f*.2-f*6,s*(9+51*f)); q.lineTo(-16-11*f-4,s*(9+51*f)); q.stroke(); }
    q.fillStyle=tail; q.beginPath(); q.moveTo(-20,s*66); q.lineTo(-31,s*67); q.lineTo(-36,s*71.5); q.lineTo(-25,s*70); q.closePath(); q.fill();   // Winglet
    q.fillStyle="rgba(255,255,255,.35)"; q.beginPath(); q.moveTo(14,s*11); q.lineTo(-18,s*58); q.lineTo(-16,s*58); q.lineTo(16,s*11); q.fill();   // Vorderkanten-Glanz
    q.fillStyle=s<0?"#ff3b30":"#34c759"; q.beginPath(); q.arc(-30,s*69,1.8,0,7); q.fill();
    // engine nacelle
    const ey=s*29; const eg=q.createLinearGradient(0,ey-5,0,ey+5); eg.addColorStop(0,"#9aa3ad"); eg.addColorStop(.5,"#e6e9ec"); eg.addColorStop(1,"#6f7882"); q.fillStyle=eg; q.beginPath(); q.ellipse(8,ey,13,5,0,0,7); q.fill(); q.strokeStyle="rgba(30,35,40,.5)"; q.lineWidth=.8; q.stroke();
    q.fillStyle="#2a2f36"; q.beginPath(); q.ellipse(20,ey,2,4.2,0,0,7); q.fill(); q.fillStyle="#c7ccd2"; q.beginPath(); q.arc(20.4,ey,1.2,0,7); q.fill(); q.fillStyle=tail; q.fillRect(-3,ey-1,6,2); }
  for (const s of [-1,1]){ const sg=q.createLinearGradient(0,s*6,0,s*27); sg.addColorStop(0,"#eef0f2"); sg.addColorStop(1,"#c9ced4"); q.fillStyle=sg; stab(s); q.fill(); q.strokeStyle="rgba(40,50,60,.35)"; q.lineWidth=.8; q.stroke(); }
  // fuselage, rounded shading
  const fg=q.createLinearGradient(0,-10.5,0,10.5); fg.addColorStop(0,"#ffffff"); fg.addColorStop(.45,"#f4f5f6"); fg.addColorStop(1,"#bfc5cc"); q.fillStyle=fg; fus(); q.fill(); q.strokeStyle="rgba(40,50,60,.45)"; q.lineWidth=.9; q.stroke();
  q.save(); fus(); q.clip();
  q.fillStyle=tail; q.fillRect(-70,-2.2,118,4.4); q.fillStyle="rgba(255,255,255,.55)"; q.fillRect(-60,-6,100,1.4);
  q.fillStyle=tail; q.beginPath(); q.moveTo(-70,-10); q.lineTo(-44,-10); q.lineTo(-56,10); q.lineTo(-70,10); q.closePath(); q.fill();
  q.restore();
  // vertical fin seen from above + cockpit + windows
  q.fillStyle=tail; q.beginPath(); q.moveTo(-40,-1.6); q.lineTo(-69,-1.2); q.lineTo(-69,1.2); q.lineTo(-40,1.6); q.closePath(); q.fill(); q.fillStyle="rgba(255,255,255,.4)"; q.fillRect(-66,-.5,24,1);
  { const ng=q.createLinearGradient(56,0,70,0); ng.addColorStop(0,"rgba(120,130,140,0)"); ng.addColorStop(1,"rgba(120,130,140,.55)"); q.fillStyle=ng; q.beginPath(); q.moveTo(56,-10); q.bezierCurveTo(64,-9,68,-6,70,0); q.bezierCurveTo(68,6,64,9,56,10); q.closePath(); q.fill(); }   // Radom
  q.fillStyle="rgba(0,0,0,.12)"; q.beginPath(); q.ellipse(-2,0,22,10,0,0,7); q.fill();   // Flügelwurzel
  q.fillStyle="#fff"; q.beginPath(); q.arc(-60,0,3.2,0,7); q.fill(); q.fillStyle=tail; q.beginPath(); q.arc(-60,0,1.8,0,7); q.fill();   // Logo am Leitwerk
  q.fillStyle="#1d2733"; q.beginPath(); q.moveTo(64,-4.5); q.quadraticCurveTo(67,0,64,4.5); q.lineTo(60,3.6); q.quadraticCurveTo(62,0,60,-3.6); q.closePath(); q.fill(); q.fillStyle="rgba(150,200,240,.6)"; q.fillRect(61.5,-3,1.2,2);
  q.fillStyle="#2a3644"; for (let x=-38;x<54;x+=4.2){ q.fillRect(x,-8.6,1.8,1.4); q.fillRect(x,7.2,1.8,1.4); }
  q.fillStyle="rgba(0,0,0,.25)"; for (const x of [46,-30]) for (const s of [-1,1]) q.fillRect(x,s>0?7:-9.5,3.4,2.6);
  q.fillStyle="#ff3b30"; q.beginPath(); q.arc(0,0,1.3,0,7); q.fill(); }
// (Flugzeuge werden jetzt live gezeichnet – sie können wegfliegen)
// 8) soft building shadows + contact shade (sun low in the west-south-west)
function softPoly(pts,col,blur){ g.save(); g.shadowColor=col; g.shadowBlur=blur; g.shadowOffsetX=40000*GS; g.fillStyle="#000"; g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x-40000,y):g.moveTo(x-40000,y)); g.closePath(); g.fill(); g.restore(); }
for (const b of buildings){ const L=b.H*.62, dx=L, dy=L*.38;
  softPoly([[b.x+b.w,b.y],[b.x+b.w+dx,b.y+dy],[b.x+b.w+dx,b.y+b.h+dy],[b.x+dx,b.y+b.h+dy],[b.x,b.y+b.h],[b.x,b.y]],"rgba(35,22,55,.42)",Math.min(28,6+b.H*.04));
  softPoly([[b.x-6,b.y-6],[b.x+b.w+6,b.y-6],[b.x+b.w+6,b.y+b.h+6],[b.x-6,b.y+b.h+6]],"rgba(20,12,30,.45)",14); }
for (const p of palms) softPoly([[p.x+18*p.s,p.y-4],[p.x+70*p.s,p.y+14*p.s],[p.x+64*p.s,p.y+34*p.s],[p.x+16*p.s,p.y+6]],"rgba(35,22,55,.32)",10);
for (const t of trees) softPoly([[t.x+10,t.y-30*t.s],[t.x+70*t.s,t.y-8*t.s],[t.x+64*t.s,t.y+40*t.s],[t.x,t.y+30*t.s]],"rgba(35,22,55,.32)",16);

