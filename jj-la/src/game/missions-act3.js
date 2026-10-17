

// ================= AKT 3: "FÜR DONNY" – Gefängnishof, Lukas Verrat, Leuchtturm, Finale =================
// Roter Faden: Dario verrät, dass jemand aus der Crew mit Santoro redet → Luka. Luka lockt JJ in die Falle,
// JJ muss in 2 Minuten zu Mo (Zeitlimit), holt sich Luka zurück, befreit Donny am Leuchtturm und erledigt Santoro.
function act3Def(o){ o.act2=true; o.act3=true; o.intro=o.intro||""; MDEF.push(o); return o; }
Object.assign(SPK,{Dario:"#c0c4cc"});
const HENCH_LOOK={skin:"#a8714f",skinHi:"#c48a66",shirt:"#141519",shirtHi:"#2e3038",pants:"#111214",shoe:"#0b0b0d",hair:"#111"};
const SANTORO_LOOK={skin:"#e2b48e",skinHi:"#f3cba7",shirt:"#f1ede4",shirtHi:"#ffffff",pants:"#1b1b1f",shoe:"#0d0d0f",hair:"#9ca3af"};
Object.assign(CREWLOOK,{ Dario:{skin:"#c99572",skinHi:"#ddb08c",shirt:"#e8742a",shirtHi:"#ff9a4a",pants:"#d8661f",shoe:"#2a2a2a",hair:"#1b1410"},
  Donny:{skin:"#c48a62",skinHi:"#d9a27c",shirt:"#6fd08a",shirtHi:"#93e6aa",pants:"#2b2d33",shoe:"#e8e4dc",hair:"#1a120c"} });
const SANTOROLOT=LOTS[8], SANTGATE={x:SANTOROLOT.drive.x+SANTOROLOT.drive.w/2,y:SANTOROLOT.ly+SANTOROLOT.lh+12}, SANTDOOR={x:SANTOROLOT.b.x+SANTOROLOT.b.w/2,y:SANTOROLOT.b.y+SANTOROLOT.b.h+30};
const LHDOOR={x:LH.x,y:6135};

// Endgegner: n.boss = Anzahl Treffer, die er einsteckt (jede Waffe zählt als ein Treffer)
const _killNpc3=killNpc;
killNpc=function(n,vx,vy){ if (n&&!n.dead&&n.boss>1){ n.boss--; sfx("hit"); for (let k=0;k<6;k++) emit("spark",n.x,n.y,{vx:(rnd()-.5)*220,vy:(rnd()-.5)*220,life:.25,max:.25}); return; } return _killNpc3(n,vx,vy); };

// ---------- Zeitlimit ----------
function mTimer(m,secs){ m.d.tl=secs; m.d.tOn=true; m.d.tBeep=false; $("mTimer").hidden=false; m.cleanup=()=>{ $("mTimer").hidden=true; }; mTimerTick(m,0); }
function mTimerTick(m,dt){ if (!m.d.tOn) return false; m.d.tl-=dt; const s=Math.max(0,Math.ceil(m.d.tl)), el=$("mTimer"), txt="⏱ "+Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
  if (el.textContent!==txt){ el.textContent=txt; el.classList.toggle("hot",s<=20); } if (s<=10&&!m.d.tBeep){ m.d.tBeep=true; sfx("ping"); toast(L2("⏱ Nur noch 10 Sekunden!","⏱ Only 10 seconds left!")); } return m.d.tl<=0; }
function mTimerStop(m){ m.d.tOn=false; $("mTimer").hidden=true; }

// Gegner genau an einer Stelle (ohne Reinlaufen von außerhalb des Bildes)
function foeAt(x,y,o){ const n=spawnFoe(x,y,Object.assign({stay:true},o||{})); n.x=x; n.y=y; n.walkIn=null; return n; }
function hench(m,pts,cx,cy,o){ return pts.map(([dx,dy,w])=>spawnFoe(cx+dx,cy+dy,Object.assign({weapon:w,sp:w?90:115,look:HENCH_LOOK,stay:true},o||{}))); }
function act3Intro(){ showCard({done:true,next:()=>{ LEAD=nextDef()&&nextDef().id; renderObj(); }},
  `<div class="mk">${L2("AKT 3","ACT 3")}</div><h2>${L2("Für Donny","For Donny")}</h2><p>${L2("Donny lebt – irgendwo am Leuchtturm von Santa Luna. Santoro hat sein Geld verloren und nichts mehr zu verlieren. Und irgendwer in der Crew spielt falsch.","Donny is alive – somewhere at the Santa Luna lighthouse. Santoro has lost his money and has nothing left to lose. And somebody in the crew is playing both sides.")}</p>`,L2("LOS","GO")); }
function drawAct3World(q,vis,t){ if (!MI||!MI.def.act3) return;
  for (const n of MI.foes) if (n.bossMax&&!n.dead&&vis(n.x,n.y,60)){ const f=Math.max(0,n.boss)/n.bossMax, w=56, x=n.x-w/2, y=n.y-46;
    q.fillStyle="rgba(10,8,14,.8)"; q.fillRect(x-2,y-2,w+4,9); q.fillStyle="#ff3b30"; q.fillRect(x,y,w*f,5); tag(q,n.x,y-10,"SANTORO"); } }
const _drawA2=drawAct2World; drawAct2World=function(q,vis,t){ _drawA2(q,vis,t); drawAct3World(q,vis,t); };

// ---------- M15: Hinter Gittern (Gefängnishof) ----------
act3Def({id:"m15",n:"Hinter Gittern",loc:{x:JDOOR.x+110,y:JDOOR.y+20},giver:[["Yunus",40,8]],cash:3000,ruf:150,unlock:["gl"],unlockTxt:"Granatwerfer bei LA ARMS",
  intro:"Dario sitzt seit dem Luna Park im Gefängnis. Er kennt Santoros Wachen am Leuchtturm. Kämpf dich an den Türstehern vorbei in den Gefängnishof.",
  start(m){ talk(TL([["Yunus","Bevor wir zum Leuchtturm fahren: Dario sitzt hier ein. Die Cops haben ihn nach dem Luna Park eingesackt.","Before we hit the lighthouse: Dario's locked up in here. The cops grabbed him after Luna Park."],
      ["Yunus","Er kennt Santoros Leute am Leuchtturm. Die Türsteher lassen keinen rein – du musst an ihnen vorbei in den Hof.","He knows Santoro's men at the lighthouse. The bouncers let nobody in – get past them into the yard."],
      ["JJ","Dann klopf ich mal an.","Then I'll knock."]]),()=>{ m.step=1; this.chk(m); }); },
  chk(m){ if (JAIL.open){ m.step=2; obj(L2("Geh durch die Tür in den Gefängnishof","Go through the door into the prison yard"),JDOOR); } else obj(L2("Schalte die zwei Türsteher am Gefängnistor aus","Take out the two bouncers at the prison gate"),JDOOR); },
  tick(m,dt){ const inY=jj.x>JAILR.x&&jj.x<JAILR.x+JAILR.w-30&&jj.y>JAILR.y&&jj.y<JAILR.y+JAILR.h;
    if (m.step===1&&JAIL.open) this.chk(m);
    if (m.step===2&&inY){ m.step=3; m.d.dar=fig(m,"Dario",6800,820,{}); m.mark=[m.d.dar]; obj(L2("Finde Dario im Hof","Find Dario in the yard"),m.d.dar); }
    if (m.step===3&&Math.hypot(jj.x-m.d.dar.x,jj.y-m.d.dar.y)<60){ m.step=4; m.mark=null;
      talk(TL([["Dario","JJ. Kommst du mich rausholen?","JJ. Here to bust me out?"],["JJ","Ich komm für Antworten. Wer bewacht den Leuchtturm?","I'm here for answers. Who's guarding the lighthouse?"],
        ["Dario","Santoros Beste. Und noch was: Santoro wusste von eurem Bankcoup – vorher. Einer aus deiner Crew redet mit ihm.","Santoro's best. And one more thing: Santoro knew about your bank job – before. Someone in your crew talks to him."],
        ["JJ","Du lügst.","You're lying."],["Dario","Frag deinen Freund mit der großen Klappe. … Und jetzt lauf. Die Jungs hier mögen keine Besucher. JUNGS!","Ask your friend with the big mouth. … Now run. The boys here don't like visitors. BOYS!"]]),()=>{
        m.d.dar.tx=6745; m.d.dar.ty=1020; m.d.in=[[6830,900],[6960,960],[7040,860],[6890,1010]].map(([x,y],i)=>foeAt(x,y,{look:INMATE_LOOK[i%3],sp:112})); m.step=5; }); }
    if (m.step===5){ const n=aliveFoes(m.d.in); obj(L2("Die Häftlinge greifen an – wehr dich ("+(4-n)+"/4)","The inmates attack – fight back ("+(4-n)+"/4)"));
      if (n===0){ m.step=6; obj(L2("Raus aus dem Hof – zur Tür","Get out of the yard – to the door"),JYIN); } }
    if (m.step===6&&jj.x>JAILR.x+JAILR.w+8){ m.step=7; completeMission(); } },
  after(){ crewMsg("luka",L2("Bruder, ich hab ein Boot zum Leuchtturm besorgt. Treffen am Steg in Venice. Komm allein – je weniger davon wissen, desto besser.","Bro, I got us a boat to the lighthouse. Meet me at the pier in Venice. Come alone – the fewer people know, the better.")); }});

// ---------- M16: Der Verrat (Hinterhalt + 2 Minuten Zeitlimit zum Heliport) ----------
act3Def({id:"m16",n:"Der Verrat",loc:{x:ACT2_SPOTS.docks.x,y:ACT2_SPOTS.docks.y},giver:[["Luka",44,-4]],cash:3000,ruf:160,noHeli:true,
  intro:"Luka hat angeblich ein Boot zum Leuchtturm besorgt. Treffen am Steg in Venice – allein.",
  start(m){ talk(TL([["Luka","Da bist du ja. Das Boot liegt da vorne.","There you are. The boat's right over there."],["JJ","Dario sagt, einer aus der Crew redet mit Santoro.","Dario says someone in the crew talks to Santoro."],["Luka","…","…"],
      ["Luka","Es tut mir leid, Bruder. Santoro hat meine Schulden gekauft. Entweder du – oder meine Familie.","I'm sorry, bro. Santoro bought my debts. It was you – or my family."],["Luka","Jungs! Er gehört euch!","Boys! He's all yours!"]]),()=>{
      const g=giverSpots(this)[0]; m.d.lu=fig(m,"Luka",g.x,g.y,{tx:g.x+520,ty:g.y-260}); figSay(m.d.lu,L2("Sorry, JJ …","Sorry, JJ …"));
      m.d.f=hench(m,[[-260,-140,"pistol"],[260,-160,"pistol"],[-200,180,null],[220,200,"pistol"],[0,-280,null]],jj.x,jj.y,{stay:false}); m.step=1; }); },
  tick(m,dt){ const L=m.d.lu; if (L&&!L.gone&&Math.hypot(L.x-L.tx,L.y-L.ty)<20) L.gone=true;
    if (m.step===1){ const n=aliveFoes(m.d.f); obj(L2("Hinterhalt! Überlebe Santoros Leute ("+(5-n)+"/5)","Ambush! Survive Santoro's men ("+(5-n)+"/5)"));
      if (n===0){ m.step=2; talk(TL([["Yunus","(am Telefon) JJ! Luka hat Santoro verraten, wo Mo seinen Heli parkt. Seine Leute sind schon unterwegs!","(on the phone) JJ! Luka told Santoro where Mo parks his chopper. His men are already on their way!"],
          ["Yunus","Du hast zwei Minuten. Fahr zum Heliport – SOFORT!","You've got two minutes. Get to the heliport – NOW!"]]),()=>{ m.step=3; mTimer(m,120); m.d.hp={x:HELIPAD.x,y:HELIPAD.y+150};
          obj(L2("Fahr in 2 Minuten zu Mos Heliport!","Get to Mo's heliport within 2 minutes!"),m.d.hp);
          const p=roadSpotAway(jj.x,jj.y,500,800); if (p){ const v=spawnChaser("suv",p.x,p.y,p.a,"#0d0e11"); v.hunter=true; v.hp=200; } }); } }
    if (m.step===3){ if (mTimerTick(m,dt)){ failMission(L2("Zu spät – Santoros Leute haben Mos Heli in die Luft gejagt.","Too late – Santoro's men blew up Mo's chopper.")); return; }
      if (Math.hypot(jj.x-m.d.hp.x,jj.y-m.d.hp.y)<240){ mTimerStop(m); m.step=4; sfx("ping"); toast(L2("⏱ Rechtzeitig!","⏱ Just in time!"));
        m.d.mo=fig(m,"Mo",HELIPAD.x+30,HELIPAD.y+120,{w:"pistol"}); figSay(m.d.mo,L2("JJ! Hier drüben!","JJ! Over here!"));
        m.d.f2=hench(m,[[-300,60,"pistol"],[300,80,"pistol"],[-160,300,null],[200,320,"pistol"]],HELIPAD.x,HELIPAD.y+150,{stay:false}); } }
    if (m.step===4){ const n=aliveFoes(m.d.f2); obj(L2("Hilf Mo – schalte Santoros Leute aus ("+(4-n)+"/4)","Help Mo – take out Santoro's men ("+(4-n)+"/4)"));
      if (n===0){ m.step=5; talk(TL([["Mo","Gerade noch rechtzeitig. Danke, Bruder.","Just in time. Thanks, brother."],["Mo","Luka hat das Geld aus unserem Versteck geholt. Er will damit abhauen.","Luka took the money from our stash. He wants to run with it."],["JJ","Er kommt nicht weit.","He won't get far."]]),()=>completeMission()); } } },
  after(){} });

// ---------- M17: Lukas Flucht (Verfolgung, Luka stoppen) ----------
act3Def({id:"m17",n:"Lukas Flucht",loc:{x:HELIPAD.x,y:HELIPAD.y+150},giver:[["Mo",44,-4]],cash:4000,ruf:170,unlock:["alien"],unlockTxt:"Alien-Blaster bei LA ARMS",
  intro:"Luka flieht mit dem Geld der Crew. Hol ihn ein und stopp seinen Wagen.",
  start(m){ talk(TL([["Mo","Da vorne – der blaue Wagen! Das ist Luka.","Up there – the blue car! That's Luka."],["JJ","Den hol ich mir.","I'll get him."]]),()=>{
      const p=roadSpotAway(jj.x,jj.y,360,620)||{x:jj.x+320,y:jj.y,a:0}; const v=addVeh("sedan",p.x,p.y,p.a,"#1f5fd0",{ai:true,driver:true,missionV:true,hp:200}); v.t=Object.assign({},VT.sedan,{max:300,hp:200}); v.hp=200; m.vehs.push(v); m.d.car=v; m.d.hp0=v.hp;
      const to=[2855,2500], r1=roadRoute(p.x,p.y,to[0],to[1]), r2=roadRoute(to[0],to[1],p.x,p.y); fleeRoute(v,r1.concat(r2),true);
      m.mark=[v]; obj(L2("Schnapp dir ein Auto und verfolge Luka","Grab a car and chase Luka"),v); }); },
  tick(m,dt){ const v=m.d.car; if (!v) return; const stopped=v.wreck||v.gone||v.burn>0||v.hp<=0;
    if (stopped){ if (m.step<2){ m.step=2; v.ai=false; v.goal=null; v.v=0; v.burn=0; v.hp=Math.max(1,v.hp); m.mark=null;
      talk(TL([["Luka","Okay! Okay … ich halt an!","Okay! Okay … I'm stopping!"],["JJ","Acht Jahre hab ich dich Bruder genannt.","Eight years I called you brother."],["Luka","Santoro hatte meine Mutter in der Hand, JJ. Ich hatte keine Wahl.","Santoro had my mother, JJ. I had no choice."],
        ["JJ","Man hat immer eine Wahl.","There's always a choice."],["Luka","Hier, das Geld. Alles. Und Donny ist wirklich im Leuchtturm – aber Santoro bringt ihn morgen früh weg.","Here, the money. All of it. And Donny really is in the lighthouse – but Santoro moves him tomorrow morning."],
        ["Luka","Lass mich das wiedergutmachen. Ich komm mit zum Leuchtturm.","Let me make this right. I'm coming to the lighthouse."],["JJ","Fällst du mir noch einmal in den Rücken, war's das. Für immer.","Stab me in the back once more and that's it. Forever."]]),()=>completeMission()); } return; }
    if (m.step===0&&jj.veh&&jj.veh!==v){ m.step=1; }
    if (m.step===1){ const dmg=Math.round((1-v.hp/m.d.hp0)*100); obj(L2("Ramm Lukas Wagen, bis er stoppt – "+dmg+"%","Ram Luka's car until it stops – "+dmg+"%"));
      if (jj.veh&&jj.veh!==v&&inVeh(v,jj.veh.x,jj.veh.y,18)&&Math.abs(jj.veh.v)>60&&(m.d.ram||0)<=0){ m.d.ram=.5; damageVeh(v,24); shake=Math.max(shake,4); }
      m.d.ram=Math.max(0,(m.d.ram||0)-dt); }
    if (Math.hypot(v.x-jj.x,v.y-jj.y)>2600){ failMission(L2("Luka ist entkommen.","Luka got away.")); } },
  after(){ crewMsg("paul",L2("Paul hier. Morgen früh bringt Santoro Donny weg. Wir schlagen heute zu – Leuchtturm, Kap von Santa Luna. Ich warte am Weg zum Leuchtturm.","Paul here. Santoro moves Donny tomorrow morning. We strike tonight – the lighthouse, Santa Luna cape. I'll wait at the path to the lighthouse.")); }});

// ---------- M18: Der Leuchtturm (Donny befreien, nach Hause bringen) ----------
act3Def({id:"m18",n:"Der Leuchtturm",loc:{x:LH.x,y:5990},giver:[["Paul",-60,10],["Luka",60,10]],cash:6000,ruf:220,
  intro:"Donny wird im Leuchtturm am Kap von Santa Luna festgehalten. Kämpf dich mit Paul und Luka durch, brich die Tür auf und bring Donny zu Onkel Bobby.",
  wave(m){ const W2=[[[-220,-80,"pistol"],[220,-60,"pistol"],[-140,120,null],[160,130,null]],[[-260,60,"pistol"],[260,40,"pistol"],[0,-200,"pistol"],[-180,180,null],[180,190,null]]][m.d.wave];
    m.d.wf=hench(m,W2,LH.x,LH.y-130); obj(L2("Kämpf dich zum Leuchtturm durch – Welle "+(m.d.wave+1)+"/2","Fight your way to the lighthouse – wave "+(m.d.wave+1)+"/2")); },
  start(m){ talk(TL([["Paul","Da oben ist er. Zwei Trupps vor der Tür, vielleicht mehr.","He's up there. Two squads at the door, maybe more."],["Luka","Ich geh vor, JJ. Ich schulde dir was.","I'll go first, JJ. I owe you."],["JJ","Dann los. Für Donny.","Let's go. For Donny."]]),()=>{
      m.allies=giverSpots(this).map(g=>({n:g.n,x:g.x,y:g.y,ang:0,step:0,moving:false,cd:1,pro:true,w:g.n==="Paul"?"shotgun":"pistol"})); m.ride=true; m.step=1; m.d.wave=0; this.wave(m); }); },
  tick(m,dt){
    if (m.step===1&&m.d.wf&&aliveFoes(m.d.wf)===0){ if (m.d.wave<1){ m.d.wave++; m.d.wf=null; setTimeout(()=>{ if (MI===m) this.wave(m); },1200); } else { m.step=2; obj(L2("Brich die Tür vom Leuchtturm auf","Break open the lighthouse door"),LHDOOR); } }
    if (m.step===2&&holdRing(m,"door",LHDOOR,40,3,dt)){ m.step=3; m.ring=null; sfx("door");
      m.d.don=fig(m,"Donny",LHDOOR.x,LHDOOR.y+10,{});
      talk(TL([["Donny","JJ …? Bist du das wirklich?","JJ …? Is that really you?"],["JJ","Acht Jahre, Kleiner. Ich hab dir gesagt, ich find dich.","Eight years, kid. I told you I'd find you."],["Donny","Santoro hat gesagt, du hättest mich vergessen.","Santoro said you'd forgotten me."],
        ["JJ","Niemals. Komm, wir fahren nach Hause – zu Onkel Bobby.","Never. Come on, we're going home – to Uncle Bobby."],["Paul","SUVs auf der Brücke! Santoro weiß Bescheid!","SUVs on the bridge! Santoro knows!"]]),()=>{
        const d=m.d.don; d.gone=true; m.allies.push({n:"Donny",x:d.x,y:d.y,ang:0,step:0,moving:false,cd:1,w:null});
        m.d.hunt=[]; for (let i=0;i<2;i++){ const p=roadSpotAway(jj.x,jj.y,500,800); if (!p) continue; const v=spawnChaser("suv",p.x,p.y,p.a,"#0d0e11"); v.hunter=true; v.gunner=true; v.hp=200; m.d.hunt.push(v); }
        m.step=4; obj(L2("Bring Donny zu Onkel Bobby","Take Donny to Uncle Bobby"),{x:DOOR.x,y:DOOR.y+30}); }); }
    if (m.step===4){ const dn=m.allies.find(a=>a.n==="Donny"), near=Math.hypot(jj.x-DOOR.x,jj.y-(DOOR.y+30))<160, withD=dn&&(dn.inCar||Math.hypot(dn.x-jj.x,dn.y-jj.y)<260);
      for (const v of m.d.hunt){ if (v.gone||v.wreck) continue; v.lostT=Math.hypot(v.x-jj.x,v.y-jj.y)>1500?(v.lostT||0)+dt:0; if (v.lostT>7){ v.hunter=false; v.gunner=false; v.ai=false; v.gone=true; } }
      if (near&&!withD&&!m.d.wait){ m.d.wait=1; obj(L2("Warte auf Donny","Wait for Donny")); }
      if (near&&withD){ m.step=5; if (WANT.lv>0) clearWanted(true);
        talk(TL([["Onkel Bobby","Donny? … DONNY! Junge, komm her!","Donny? … DONNY! Come here, boy!"],["Donny","Onkel Bobby …","Uncle Bobby …"],["Onkel Bobby","JJ … du hast es wirklich geschafft.","JJ … you really did it."],["JJ","Noch nicht. Solange Santoro frei rumläuft, ist keiner von uns sicher.","Not yet. As long as Santoro walks free, none of us is safe."]]),()=>completeMission()); } } },
  after(){ crewMsg("yunus",L2("Hab Santoro gefunden. Er hat sich in seiner Villa in Palm Heights verschanzt – mit allem, was er noch hat. Wir treffen uns vor dem Tor. Letzte Runde.","Found Santoro. He's holed up in his villa in Palm Heights – with everything he's got left. We meet at the gate. Last round.")); }});

// ---------- M19: Für Donny (Finale in Santoros Villa) ----------
act3Def({id:"m19",n:"Für Donny",loc:{x:SANTGATE.x,y:SANTGATE.y+60},giver:[["Luka",-78,16],["Yunus",0,-30],["Paul",78,16]],cash:25000,ruf:500,
  intro:"Das Finale. Santoro hat sich in seiner Villa in Palm Heights verschanzt. Stürm die Villa mit der Crew und erledige Santoro.",
  wave(m,k){ const c=k===0?{x:SANTGATE.x,y:SANTGATE.y-60}:{x:SANTDOOR.x,y:SANTDOOR.y+40}; const W2=k===0?[[-200,-60,"pistol"],[200,-40,"pistol"],[-120,-180,null],[140,-170,"pistol"],[0,-240,null]]:[[-220,0,"pistol"],[220,0,"pistol"],[-140,-60,"pistol"],[140,-60,"pistol"],[-60,80,null],[60,80,null]];
    m.d.wf=hench(m,W2,c.x,c.y); },
  start(m){ talk(TL([["Yunus","Santoros Villa. Er hat alles hergeholt, was er noch hat.","Santoro's villa. He's brought in everything he's got left."],["Paul","Wir halten dir den Rücken frei. Santoro gehört dir.","We'll cover your back. Santoro is yours."],["Luka","Für Donny.","For Donny."],["JJ","Für Donny.","For Donny."]]),()=>{
      m.allies=giverSpots(this).map(g=>({n:g.n,x:g.x,y:g.y,ang:0,step:0,moving:false,cd:1,pro:true,w:g.n==="Paul"?"shotgun":"pistol"})); m.step=1; this.wave(m,0); obj(L2("Stürm das Tor (0/5)","Storm the gate (0/5)"),SANTGATE); }); },
  tick(m,dt){
    if (m.step===1){ const n=aliveFoes(m.d.wf); obj(L2("Stürm das Tor ("+(5-n)+"/5)","Storm the gate ("+(5-n)+"/5)")); if (n===0){ m.step=2; this.wave(m,1); obj(L2("Kämpf dich zur Villa vor (0/6)","Fight your way to the villa (0/6)"),SANTDOOR); } }
    if (m.step===2){ const n=aliveFoes(m.d.wf); obj(L2("Kämpf dich zur Villa vor ("+(6-n)+"/6)","Fight your way to the villa ("+(6-n)+"/6)"));
      if (n===0){ m.step=3; const s=foeAt(SANTDOOR.x,SANTDOOR.y,{weapon:"pistol",look:SANTORO_LOOK,sp:80,cd:.5}); s.boss=s.bossMax=14; s.say=L2("Du bist ein Niemand, JJ!","You're a nobody, JJ!"); s.sayT=3; m.d.boss=s;
        m.d.gd=hench(m,[[-90,30,"pistol"],[90,30,"pistol"]],SANTDOOR.x,SANTDOOR.y); toast(L2("👔 Santoro kommt raus!","👔 Santoro steps out!")); obj(L2("Erledige Santoro","Take down Santoro"),SANTDOOR); m.mark=[s]; } }
    if (m.step===3){ const s=m.d.boss;
      if (s.dead){ m.step=4; m.mark=null; for (const n of m.foes) if (!n.dead) killNpc(n,0,0); if (WANT.lv>0) clearWanted(true);
        talk(TL([["Santoro","Du … bist doch … ein Niemand …","You … are just … a nobody …"],["JJ","War ich mal. Jetzt bin ich der, der dich erledigt hat.","I used to be. Now I'm the one who took you down."],["Luka","Es ist vorbei, Bruder.","It's over, bro."],["JJ","Nein. Für Donny fängt's gerade erst an.","No. For Donny it's just beginning."]]),()=>{ completeMission();
          setTimeout(()=>showCard({done:true},`<div class="mk">${L2("AKT 3 ABGESCHLOSSEN · ENDE","ACT 3 COMPLETE · THE END")}</div><h2>${L2("Für Donny","For Donny")}</h2><p>${L2("Santoro ist erledigt, sein Imperium zerfällt. JJ hat seinen Bruder zurück – und aus dem Niemand ist eine Legende von Los Angeles geworden.","Santoro is finished, his empire falls apart. JJ has his brother back – and the nobody has become a Los Angeles legend.")}<br><br><b>${L2("Danke fürs Spielen! Die Stadt gehört dir – fahr weiter frei herum.","Thanks for playing! The city is yours – keep cruising.")}</b></p>`,"OK"),400); }); } } },
  after(){} });
Object.assign(LEADS,{
  m15:{from:"yunus",hint:"Yunus wartet vor dem Gefängnis",bark:"Dario sitzt im Gefängnis. Der weiß was über den Leuchtturm."},
  m16:{from:"luka",hint:"Luka wartet am Steg in Venice",bark:"Luka hat ein Boot … Hoffentlich lügt Dario."},
  m17:{from:"marco",hint:"Mo wartet am Heliport",bark:"Luka. Ausgerechnet Luka."},
  m18:{from:"paul",hint:"Paul wartet am Weg zum Leuchtturm (Santa Luna)",bark:"Heute Nacht hol ich Donny da raus."},
  m19:{from:"yunus",hint:"Die Crew wartet vor Santoros Villa in Palm Heights",bark:"Letzte Runde. Für Donny."}});
