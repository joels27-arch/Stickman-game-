// ================= AKT 2: "DIE SPUR" – von Santoro zur Central Bank zu Donny =================
// Roter Faden: Santoro hat Donny. Für den Bankcoup (Santoros Geld liegt im Tresor der Central Bank)
// braucht die Crew Codes (m8), eine Schlüsselkarte (m10), Werkzeug (m11 Diamant), Fluchtwagen (m12) und einen Plan (m13).
const ACT2_SPOTS={
  suvChase:{x:5520,y:1030}, brooks:{x:BROOKSH.x-30,y:BROOKSH.y+36}, luna:{x:5060,y:4360},
  whit:{x:WDOOR.x,y:WDOOR.y+60}, mus:{x:MUSDOOR.x,y:MUSDOOR.y+50}, docks:{x:960,y:3400},
  recon:{x:BANKDOOR.x,y:BANKDOOR.y+90}, heist:{x:BANKDOOR.x,y:BANKDOOR.y+40} };
Object.assign(CHATS,{ rico:CHATS.rico||{n:"Rico",sub:"Autos & Klamotten",col:"linear-gradient(180deg,#ffb347,#9c6b1e)",ini:"R",msgs:[],unread:0},
  enzo:{n:"Enzo",sub:"Hehler",col:"linear-gradient(180deg,#c9a27c,#7a5636)",ini:"E",msgs:[],unread:0} });
Object.assign(CONTACT_OF,{m7:"luka",m8:"yunus",m10:"rico",m11:"enzo",m12:"rico"});
const mLoc=(x,y)=>({x,y});
function act2Def(o){ o.act2=true; o.intro=o.intro||""; MDEF.push(o); return o; }

// ---------- Akt-2-Auftakt: ZWEI MONATE SPÄTER ----------
function act2Intro(){ showCard({done:true,next:()=>{ if (jj.veh) exitVeh(true); const ry=AIR.runway.y+AIR.runway.h/2; ESC={x:AIR.runway.x-700,y:ry,a:0,h:240,v:430,t:0,phase:"land",cam:true}; setCinema(true); setTimeout(()=>blackout(false),200); jj.hidden=true; jj.lock=99; jj.x=ESC.x; jj.y=ry; cam.x=jj.x; cam.y=jj.y; LEAD=nextDef()&&nextDef().id; renderObj(); }},
  `<div class="mk">${L2("ZWEI MONATE SPÄTER","TWO MONTHS LATER")}</div><h2>${L2("Zurück in L.A.","Back in L.A.")}</h2><p>${L2("Nach dem Coup ist die Crew in Mexiko untergetaucht. Jetzt sind sie zurück – ohne Wagen, ohne Bleibe, aber mit Santoros Geld. Und JJ will Donny finden.","After the heist the crew laid low in Mexico. Now they're back – no car, no place to stay, but with Santoro's money. And JJ wants to find Donny.")}</p>`,L2("LOS","GO")); }
// ---------- Haus zum Verkaufen ----------
const SALEH=NEVILLA;
const SALEDOOR={x:10155,y:920}, SALESIGN={x:10232,y:950};
const HOUSE_PRICE=12000;
function drawAct2World(q,vis,t){
  { const B=ACT2_SPOTS.brooks; if (vis(B.x,B.y,80)&&!MS.done.m8){ for (const [dx,dy,r] of [[-6,20,15],[12,24,13],[-22,6,12],[4,-18,11]]){ q.fillStyle="rgba(0,0,0,.22)"; q.beginPath(); q.arc(B.x+dx+4,B.y+dy+4,r,0,7); q.fill(); q.fillStyle="#2f6b2a"; q.beginPath(); q.arc(B.x+dx,B.y+dy,r,0,7); q.fill(); q.fillStyle="#3f8a36"; q.beginPath(); q.arc(B.x+dx-3,B.y+dy-3,r*.6,0,7); q.fill(); } } }
  if (vis(SALESIGN.x,SALESIGN.y,60)){ const sold=!!MS.done.mh; q.fillStyle="rgba(0,0,0,.25)"; q.fillRect(SALESIGN.x+2,SALESIGN.y-2,4,20); q.fillStyle="#6b4a2a"; q.fillRect(SALESIGN.x-2,SALESIGN.y-6,4,22);
    q.fillStyle=sold?"#2f7d3a":"#c8302a"; rr(q,SALESIGN.x-46,SALESIGN.y-28,92,22,3); q.fill(); q.fillStyle="#fff"; q.font='400 13px "Bebas Neue",Impact,sans-serif'; q.textAlign="center"; q.textBaseline="middle";
    q.fillText(sold?"JJ":L2("ZU VERKAUFEN","FOR SALE"),SALESIGN.x,SALESIGN.y-17); }
  if (MI&&MI.def.id==="mf"&&MI.d.rings){ const R0=MI.d.rings[MI.d.ri]; if (R0){ const pu=.6+.4*Math.sin(t*4); q.save(); q.strokeStyle=`rgba(255,214,10,${.55+.4*pu})`; q.lineWidth=8; q.beginPath(); q.arc(R0.x,R0.y,95,0,7); q.stroke(); q.strokeStyle="rgba(255,255,255,.6)"; q.lineWidth=2; q.beginPath(); q.arc(R0.x,R0.y,80,0,7); q.stroke(); q.restore();
      tag(q,R0.x,R0.y-110,L2("RING ","RING ")+(MI.d.ri+1)+"/"+MI.d.rings.length); } } }
act2Def({id:"mh",n:"Ein eigenes Zuhause",loc:{x:DOOR.x+60,y:DOOR.y+46},giver:[["Onkel Bobby",-30,-6]],cash:0,ruf:60,unlockTxt:"Villa auf Bel Air Key + Garage",
  intro:"Onkel Bobby will dich nicht mehr auf seiner Couch. Kauf dir dein eigenes Haus.",
  start(m){ talk(TL([["Onkel Bobby","Zwei Monate weg – und jetzt willst du wieder auf meiner Couch pennen? Vergiss es.","Two months gone – and now you want my couch again? Forget it."],["Onkel Bobby","Die Nachbarn reden schon über dich. Und die Cops fahren jeden Abend vorbei.","The neighbors already talk about you. And the cops drive by every night."],["JJ","Ich hab Geld vom Coup.","I've got money from the heist."],["Onkel Bobby","Dann kauf dir was Eigenes. Ganz im Nordosten, über die neue Brücke, liegt Bel Air Key. Da steht eine Villa zum Verkauf – mit Pool und Garage.","Then buy your own place. Way up in the northeast, over the new bridge, there's Bel Air Key. A villa is for sale there – pool and garage included."],["JJ","Weit weg von den Cops. Klingt perfekt.","Far away from the cops. Sounds perfect."]]),()=>{
      m.step=1; obj(L2("Fahr über die Brücke nach Bel Air Key (Nordosten) – zur Villa mit dem Schild ZU VERKAUFEN","Drive over the bridge to Bel Air Key (northeast) – to the villa with the FOR SALE sign"),SALESIGN); }); },
  door(m,d){ if (m.step===1&&!CURROOM&&d(SALESIGN)<50) return {lbl:L2("VILLA KAUFEN · $12.000","BUY VILLA · $12,000"),fn:()=>{
      if (!canPay(HOUSE_PRICE)){ toast(L2("Zu wenig Geld – du brauchst $12.000","Not enough money – you need $12,000")); return; }
      pay(HOUSE_PRICE); m.step=2; sfx("ping");
      talk(TL([["JJ","Meine eigene Villa. Pool, Garage, Meerblick. Hier fängt alles neu an.","My own villa. Pool, garage, ocean view. Everything starts over here."]]),()=>completeMission()); }};
    return null; },
  tick(){},
  after(){ crewMsg("marco",L2("Mo hier. Wenn wir Santoro kriegen wollen, musst du fliegen können. Komm zum Flughafen – Flugstunde.","Mo here. If we want Santoro, you need to fly. Come to the airport – flight lesson.")); }});
// ---------- Flugstunde mit Mo ----------
act2Def({id:"mf",n:"Flugstunde",loc:{x:PLANES[0].x+110,y:PLANES[0].y+40},giver:[["Mo",0,0]],cash:1000,ruf:80,unlock:["plane"],unlockTxt:"✈ Flugzeuge fliegen · 🪂 Abspringen",
  intro:"Mo bringt dir das Fliegen bei: abheben, durch die Ringe fliegen und sauber landen.",
  start(m){ talk(TL([["Mo","Ein Pilot in der Crew ist zu wenig. Heute lernst du fliegen.","One pilot in the crew isn't enough. Today you learn to fly."],["Mo","Gas geben, ab 300 km/h hebst du ab. Lenken wie beim Auto.","Full throttle, you lift off at 300 km/h. Steer like a car."],["Mo","Flieg durch die Ringe und lande wieder hier auf der Landebahn.","Fly through the rings and land back here on the runway."]]),()=>{
      m.step=1; obj(L2("Steig ins Flugzeug","Get in the plane"),PLANES[0]); m.mark=[PLANES[0]]; }); },
  tick(m,dt){ const F=FLY;
    if (m.step===1&&F){ m.step=2; m.mark=null; m.d.ri=0; m.d.rings=[{x:6700,y:450},{x:7600,y:1300},{x:5800,y:1900},{x:4300,y:1200},{x:4500,y:450}]; obj(L2("Heb ab und flieg durch die Ringe (1/5)","Take off and fly through the rings (1/5)"),m.d.rings[0]); }
    if (m.step>=2&&m.step<4&&!F){ failMission(L2("Du bist aus dem Flugzeug raus.","You left the plane.")); return; }
    if (m.step===2&&F){ const R0=m.d.rings[m.d.ri]; if (R0&&F.h>25&&Math.hypot(F.x-R0.x,F.y-R0.y)<110){ m.d.ri++; sfx("ping"); if (m.d.ri>=m.d.rings.length){ m.step=3; obj(L2("Lande auf der Landebahn und bremse ab","Land on the runway and brake"),{x:AIR.runway.x+AIR.runway.w/2,y:AIR.runway.y+AIR.runway.h/2}); } else obj(L2("Flieg durch die Ringe ("+(m.d.ri+1)+"/5)","Fly through the rings ("+(m.d.ri+1)+"/5)"),m.d.rings[m.d.ri]); } }
    if (m.step===3&&F&&F.h<=0&&onAirfield(F.x,F.y)&&Math.abs(F.v)<40){ m.step=4; talk(TL([["Mo","Gelandet! Nicht schön, aber du lebst. Ab jetzt darfst du jedes Flugzeug fliegen.","Landed! Not pretty, but alive. From now on you can fly any plane."],["Mo","Und wenn's brennt: Absprung-Taste. Der Fallschirm ist immer dabei.","And if it burns: the bail-out button. The chute's always on board."]]),()=>completeMission()); } },
  after(){ crewMsg("luka",L2("Bruder! Der schwarze SUV von damals ist wieder da – gerade am Flughafen gesehen. Komm schnell!","Bro! The black SUV from back then is back – just seen at the airport. Come quick!")); }});

// ---------- M7: Der schwarze SUV (Verfolgungsjagd Airport → Brücke) ----------
act2Def({id:"m7",n:"Der schwarze SUV",loc:ACT2_SPOTS.suvChase,giver:[["Luka",44,-4]],cash:3000,ruf:120,
  intro:"Santoros schwarzer SUV ohne Kennzeichen wurde am Flughafen gesehen. Schnapp ihn dir, bevor er aus der Stadt verschwindet.",
  start(m){ talk(TL([["Luka","Da! Der schwarze SUV vom Video – ohne Kennzeichen. Santoros Leute.","There! The black SUV from the video – no plates. Santoro's men."],["JJ","Acht Jahre hab ich auf den gewartet.","Eight years I've waited for that SUV."],["Luka","Dann lass ihn nicht entkommen! Klau 'ne Karre und dranbleiben!","Then don't let it get away! Grab a car and stay on it!"]]),()=>{
      const suv=addVeh("suv",5560,1030,Math.PI,"#0b0c10",{ai:true,driver:true,missionV:true,keep:true,hp:220}); suv.t=Object.assign({},VT.suv,{max:330,hp:220}); m.vehs.push(suv); m.d.suv=suv;
      fleeRoute(suv,[[4600,1030],[4585,2900],[4585,3600],[2855,3600],[2855,2500],[1200,2500],[1200,1780]],true);
      m.mark=[suv]; m.d.hp0=suv.hp; obj(L2("Klau ein Auto und verfolge den SUV","Steal a car and chase the SUV"),suv); }); },
  tick(m,dt){ const suv=m.d.suv; if (!suv) return; const stopped=suv.wreck||suv.gone||suv.burn>0||suv.hp<=0; if (stopped){ if (m.step<2){ m.step=2; suv.ai=false; suv.goal=null; suv.v=0; suv.burn=0; suv.hp=Math.max(1,suv.hp); m.mark=null;
      talk(TL([["Fahrer","Schon gut, schon gut! Santoro schuldet mir noch Geld – ich red!","Okay, okay! Santoro still owes me – I'll talk!"],["Fahrer","Der Plan liegt im Tresor der Central Bank. Santoros ganzes Vermögen. Aber da kommt keiner rein.","The plan's in the Central Bank vault. Santoro's whole fortune. But nobody gets in there."],["JJ","Dann sind wir wohl keiner.","Then I guess we're nobody."]]),()=>completeMission()); } return; }
    if (m.step===0&&jj.veh&&jj.veh!==suv){ m.step=1; obj(L2("Ramm den SUV, bis er stoppt","Ram the SUV until it stops")); }
    if (m.step===1){ const dmg=Math.round((1-suv.hp/m.d.hp0)*100); obj(L2("Ramm den SUV, bis er stoppt – "+dmg+"%","Ram the SUV until it stops – "+dmg+"%"));
      if (jj.veh&&jj.veh!==suv){ const rel=Math.hypot(jj.veh.v||0,0); if (inVeh(suv,jj.veh.x,jj.veh.y,18)&&Math.abs(jj.veh.v)>60&&(m.d.ram||0)<=0){ m.d.ram=.5; damageVeh(suv,22); shake=Math.max(shake,4); } }
      m.d.ram=Math.max(0,(m.d.ram||0)-dt);
      if (Math.hypot(suv.x-jj.x,suv.y-jj.y)>2600){ failMission(L2("Der SUV ist entkommen.","The SUV got away.")); } } },
  after(){ crewMsg("yunus","Central Bank? Unmöglich – außer wir kriegen die Wachcodes. Der Wachmann Brooks wohnt in Eastside. Heute Abend ist er aus."); }});
// ---------- M8: Einbruch beim Wachmann (Stealth + Safe) ----------
act2Def({id:"m8",n:"Das Haus vom Wachmann",loc:ACT2_SPOTS.brooks,giver:[["Yunus",0,0]],cash:2500,ruf:130,
  intro:"Bankwachmann Brooks hat die Wachcodes der Central Bank zuhause im Safe. Brich bei Nacht ein – leise, sonst wecken Hund und Nachbarn die Cops.",
  start(m){ talk(TL([["Yunus","Brooks ist beim Pokern. Nur sein Köter ist da.","Brooks is out playing poker. Only his mutt's home."],["JJ","Und der Safe mit den Codes?","And the safe with the codes?"],["Yunus","Im Wohnzimmer. Schleich durchs Fenster. Weck den Hund nicht – sonst stehen die Bullen auf der Matte.","In the living room. Sneak through the window. Don't wake the dog – or the cops show up."]]),()=>{
      m.step=1; obj(L2("Steig durchs Fenster ins Haus","Climb in through the window"),{x:BROOKSWIN.x,y:BROOKSWIN.y}); m.d.win=1; }); },
  door(m,d){ if (m.step===1&&!CURROOM&&d({x:BROOKSWIN.x,y:BROOKSWIN.y})<40) return {lbl:L2("EINSTEIGEN","CLIMB IN"),fn:()=>{ m.step=2; const o=BHOUSE; o.night=true; o.missionOnly=true; o.dog={x:o.r.x+236,y:o.r.y+292,a:1.2,awake:false,bark:0}; enterRoom("bhouse",{x:92,y:372,a:Math.PI}); obj(L2("Schleich zum Safe – nicht rennen!","Sneak to the safe – don't run!"),{x:BHOUSE.r.x+420,y:BHOUSE.r.y+360}); setTimeout(()=>toast(touch?L2("🐾 Stick nur leicht schieben = leise schleichen. Halte Abstand zum roten Kreis.","🐾 Push the stick lightly = sneak quietly. Keep out of the red circle."):L2("🐾 Ohne Shift gehen = leise. Halte Abstand zum roten Kreis.","🐾 Walk without Shift = quiet. Keep out of the red circle.")),500); } };
    if (m.step===2&&CURROOM===BHOUSE&&!SAFE&&Math.hypot(jj.x-(BHOUSE.r.x+420),jj.y-(BHOUSE.r.y+358))<40) return {lbl:L2("SAFE KNACKEN","CRACK SAFE"),fn:()=>{ openSafe(()=>{ m.step=3; m.d.got=1; sfx("reload"); toast(L2("🔑 Wachcodes!","🔑 Guard codes!")); obj(L2("Raus aus dem Haus – zum Fenster","Get out – back to the window"),{x:BHOUSE.r.x+90,y:BHOUSE.r.y+400}); }); } };
    return null; },
  tick(m,dt){ if (CURROOM!==BHOUSE) return; const o=BHOUSE, D=o.dog; if (!D) return;
    const dj=Math.hypot(jj.x-D.x,jj.y-D.y), running=jj.moving&&jj.run;
    if (!D.awake){ D.noise=(D.noise||0)+((running&&dj<220?dt*1.6:0)+(dj<70?dt*1.1:0)-(dt*.5)); D.noise=Math.max(0,D.noise); D.a=Math.atan2(-(jj.x-D.x),jj.y-D.y);
      if (D.noise>1.6&&m.step===2){ D.awake=true; toast(L2("🐕 Der Hund bellt!","🐕 The dog's barking!")); } }
    else { D.bark+=dt; const a=Math.atan2(jj.y-D.y,jj.x-D.x); D.a=Math.atan2(-(jj.x-D.x),jj.y-D.y); if (dj>40){ D.x+=Math.cos(a)*90*dt; D.y+=Math.sin(a)*90*dt; }
      if (D.bark>5){ failMission(L2("Der Hund hat die Nachbarn geweckt – die Cops kamen.","The dog woke the neighbors – the cops showed up.")); } }
    if (m.step===3&&jj.y>o.r.y+376&&Math.abs(jj.x-(o.r.x+90))<36){ exitRoom({x:BROOKSWIN.x,y:BROOKSWIN.y-22},Math.PI); o.night=false; o.dog=null; m.step=4; obj(L2("Verschwinde aus Eastside","Get out of Eastside")); setTimeout(()=>{ if (MI===m) completeMission(); },1500); } },
  after(){ crewMsg("rico","Rico hier. Mit Codes kommt ihr ins Foyer – aber die Tresortür braucht die Schlüsselkarte vom Direktor Whitmore. Erst noch was anderes: Santoros Leute wollen dich im Luna Park treffen. Riecht nach Falle."); }});
// ---------- M9: Falle im Luna Park (Schießerei) ----------
act2Def({id:"m9",n:"Falle im Luna Park",loc:ACT2_SPOTS.luna,giver:[["Luka",44,-4]],cash:2000,ruf:140,unlock:["rpg"],unlockTxt:"Raketenwerfer bei LA ARMS",
  intro:"Santoros Männer wollen reden – im Luna Park auf der Insel. Natürlich ist es eine Falle. Kämpf dich raus.",
  start(m){ talk(TL([["Dario","JJ. Mr. Santoro bietet dir Geld, damit du aufhörst, nach Donny zu suchen.","JJ. Mr. Santoro offers you money to stop looking for Donny."],["JJ","Wo ist er?","Where is he?"],["Dario","Lebendig. Noch. … Jungs! JETZT!","Alive. For now. … Boys! NOW!"]]),()=>{
      m.step=1; m.d.wave=0; this.wave(m); }); },
  wave(m){ const L=ACT2_SPOTS.luna, sets=[[[-220,-120,"pistol"],[220,-100,"pistol"],[0,-240,null]],[[-260,120,"pistol"],[260,140,"pistol"],[-120,240,null],[200,240,null]],[[0,-260,"pistol"],[-240,0,"pistol"],[240,0,"pistol"],[-160,200,null],[160,200,null]]];
    m.d.wf=sets[m.d.wave].map(([x,y,w])=>spawnFoe(L.x+x,L.y+y,{weapon:w,sp:w?90:115,look:GANG_LOOK,stay:true})); obj(L2("Kämpf dich frei – Welle "+(m.d.wave+1)+"/3","Fight your way out – wave "+(m.d.wave+1)+"/3")); },
  tick(m){ if (m.step!==1) return; if (m.d.wf&&aliveFoes(m.d.wf)===0){ if (m.d.wave<2){ m.d.wave++; m.d.wf=null; setTimeout(()=>{ if (MI===m) this.wave(m); },1200); } else { m.step=2; talk(TL([["Luka","Das war also sein Angebot. Charmant.","So that was his offer. Charming."],["JJ","Donny lebt. Das reicht mir. Zeit für die Bank.","Donny's alive. That's enough. Time for the bank."]]),()=>completeMission()); } } },
  after(){ crewMsg("rico","Jetzt die Schlüsselkarte. Direktor Whitmore ist beim Golf im Country Club. Sein Haus in Palm Heights steht leer – bis auf die Security. Geh rein, ohne dass sie Alarm schlagen."); }});
// ---------- M10: Die Villa vom Direktor (Stealth Schlüsselkarte) ----------
act2Def({id:"m10",n:"Villa Whitmore",loc:ACT2_SPOTS.whit,giver:[["Rico",44,-4]],cash:3000,ruf:150,
  intro:"Bankdirektor Whitmore hat die Schlüsselkarte für den Tresor in seiner Villa. Er golft gerade. Schleich an seiner Security vorbei und hol die Karte.",
  start(m){ talk(TL([["Rico","Kameras, zwei Wachen. Werd gesehen und sie machen den Tresor für Wochen dicht.","Cameras, two guards. Get seen and they lock the vault down for weeks."],["JJ","Also lautlos.","So, quiet."],["Rico","Lautlos. Die Karte liegt im Arbeitszimmer. Schlag Wachen von hinten aus, wenn's sein muss.","Quiet. The card's in the study. Knock guards out from behind if you must."],
      ["Rico","Und so wie du aussiehst, kennt dich halb Palm Heights von den Fahndungsfotos. Hol dir im DRIP STORE einen neuen Look.","And looking like that, half of Palm Heights knows you from the wanted posters. Get a new look at the DRIP STORE."]]),()=>{
      m.d.dress=1; obj(L2("Zieh dich im DRIP STORE um – neues Outfit kaufen oder anziehen","Change at the DRIP STORE – buy or wear a new outfit"),CLO); }); },
  door(m,d){ if (m.step===1&&!CURROOM&&d({x:WDOOR.x,y:WDOOR.y})<42) return {lbl:L2("REINSCHLEICHEN","SNEAK IN"),fn:()=>{ m.step=2; const o=WVILLA; o.missionOnly=true; enterRoom("wvilla",{x:860,y:548,a:Math.PI});
      sgStart(()=>{ guardsToFoes(); m.d.blown=1; });
      sgGuard(o,330,420,[[330,120,2],[620,120,1.5],[620,470,2],[150,470,1.5]],{range:200,fov:.5});
      sgGuard(o,820,300,[[820,120,2],[820,520,2]],{range:190,fov:.5});
      sgCam(o,480,40,Math.PI/2,.7,{range:230}); sgCam(o,940,320,Math.PI,.6,{range:230});
      m.d.card={x:o.r.x+160,y:o.r.y+150}; obj(L2("Hol die Schlüsselkarte aus dem Arbeitszimmer","Grab the keycard from the study"),m.d.card); } };
    return null; },
  tick(m,dt){ if (m.d.dress===1&&m.d.dressed&&$("ricoShop").hidden){ m.d.dress=2; m.step=1; toast(L2("👕 Neuer Look!","👕 New look!")); obj(L2("Geh zur Hintertür der Villa","Go to the villa's back door"),{x:WDOOR.x,y:WDOOR.y}); }
    if (CURROOM!==WVILLA) return; if (m.d.blown&&!m.d.failT){ m.d.failT=1; obj(L2("Enttarnt! Hol die Karte und hau ab!","Blown! Grab the card and run!")); }
    if (m.step===2&&!m.d.got&&Math.hypot(jj.x-m.d.card.x,jj.y-m.d.card.y)<30){ m.d.got=1; m.step=3; sfx("reload"); toast(L2("💳 Schlüsselkarte!","💳 Keycard!")); SG.on=SG.on&&m.d.blown; obj(L2("Raus aus der Villa","Get out of the villa"),{x:WVILLA.r.x+840,y:WVILLA.r.y+580}); }
    if (m.step===3&&jj.y>WVILLA.r.y+560&&jj.x>WVILLA.r.x+800){ exitRoom({x:WDOOR.x,y:WDOOR.y+20}); sgReset(); m.step=4; obj(L2("Verschwinde aus Palm Heights","Leave Palm Heights")); setTimeout(()=>{ if (MI===m) completeMission(); },1400); } },
  after(){ crewMsg("enzo","Enzo, Pauls Hehler. Die Tresortür braucht Diamantbohrer. Gegentausch: Hol mir den 'Stern von Malibu' aus dem L.A. Museum. Laser, Kameras – euer Spezialgebiet."); }});
// ---------- M11: Das Museum (Stealth + Diebstahl + Flucht) ----------
act2Def({id:"m11",n:"Der Stern von Malibu",loc:ACT2_SPOTS.mus,giver:[["Yunus",40,8]],cash:4000,ruf:160,
  intro:"Enzo tauscht Diamantbohrer gegen den 'Stern von Malibu'. Der Diamant liegt im L.A. Museum hinter Lasern und Kameras.",
  start(m){ talk(TL([["Yunus","Nachts ist nur Technik an. Laser, Kameras, ein Nachtwächter.","At night it's all tech. Lasers, cameras, one night guard."],["JJ","Und raus?","And out?"],["Yunus","Hintertür am Personaleingang. Hast du den Stein, hast du zwei Minuten, bis es laut wird.","Back door, staff exit. Once you grab the stone, you've got two minutes before it gets loud."]]),()=>{
      m.step=1; obj(L2("Geh zum Museumseingang","Go to the museum entrance"),{x:MUSDOOR.x,y:MUSDOOR.y}); }); },
  door(m,d){ if (m.step===1&&!CURROOM&&d({x:MUSDOOR.x,y:MUSDOOR.y})<42) return {lbl:L2("REINSCHLEICHEN","SNEAK IN"),fn:()=>{ m.step=2; const o=MUSEUM; o.night=true; o.missionOnly=true; o.taken=false; enterRoom("museum",{x:800,y:640,a:Math.PI});
      sgStart(()=>{ guardsToFoes(); m.d.blown=1; m.d.loud=0; });
      sgGuard(o,800,560,[[300,560,2],[300,300,1.5],[800,300,1.5],[1300,300,1.5],[1300,560,2]],{range:200,fov:.5,sp:46});
      sgCam(o,500,40,Math.PI/2,.6,{range:240}); sgCam(o,1100,40,Math.PI/2,.6,{range:240});
      sgLaser(o,520,330,980,330,{per:0,dx:0,dy:1,amp:60,spd:.8});
      sgLaser(o,700,120,700,300,{per:2.4,duty:.5}); sgLaser(o,900,120,900,300,{per:2.4,duty:.5,ph:1.2});
      sgLaser(o,1150,250,1450,250,{per:0,dx:0,dy:1,amp:90,spd:.6});
      m.d.gem={x:o.r.x+800,y:o.r.y+104}; obj(L2("Hol den Stern von Malibu","Grab the Star of Malibu"),m.d.gem); } };
    return null; },
  tick(m,dt){ if (m.step===4&&WANT.lv===0){ m.step=5; talk(TL([["Enzo","Der Stern. Wunderschön. Hier, eure Bohrer.","The star. Beautiful. Here, your drills."],["JJ","Jetzt gehört uns der Tresor.","Now the vault is ours."]]),()=>completeMission()); return; }
    if (CURROOM!==MUSEUM) return;
    if (m.step===2&&!MUSEUM.taken&&Math.hypot(jj.x-m.d.gem.x,jj.y-m.d.gem.y)<28){ MUSEUM.taken=true; m.step=3; sfx("ping"); SG.alarm=true; toast(L2("💎 Stern von Malibu! Alarm!","💎 Star of Malibu! Alarm!")); m.d.loud=120; obj(L2("Raus durch den Personalausgang!","Out through the staff exit!"),{x:MUSEUM.r.x+1490,y:MUSEUM.r.y+680}); guardsToFoes(); }
    if (m.step===3){ m.d.loud-=dt; if (m.d.loud<=0){ failMission(L2("Die Polizei hat das Museum umstellt.","The police surrounded the museum.")); return; }
      if (jj.y>MUSEUM.r.y+660&&jj.x>MUSEUM.r.x+1440){ exitRoom({x:MUSBACK.x,y:MUSBACK.y+18},0); MUSEUM.night=false; sgReset(); m.step=4; crime(2,"Museum"); obj(L2("Häng die Cops ab!","Lose the cops!")); } }
  },
  cleanup(){ MUSEUM.night=false; MUSEUM.taken=false; },
  after(){ crewMsg("rico","Fast soweit. Ihr braucht Fluchtwagen und ein Boot. Klau zwei schnelle Karren und bring sie zu mir – und schnapp dir ein Speedboot am Hafen."); }});
// ---------- M12: Die Fluchtwagen (Autos klauen + Boot) ----------
act2Def({id:"m12",n:"Die Fluchtwagen",loc:ACT2_SPOTS.docks,giver:[["Rico",44,-4]],cash:0,ruf:120,unlockTxt:"Autos kaufen bei Rico's",
  intro:"Für den Bankcoup braucht ihr Fluchtfahrzeuge: zwei schnelle Wagen für Rico und ein Speedboot am Hafen als Notausgang übers Wasser. Danach kaufst du dir bei Rico ein eigenes Auto.",
  start(m){ talk(TL([["Rico","Zwei schnelle Karren vor meinen Laden. Geknackt, nicht gekauft – muss sauber sein.","Two fast cars outside my shop. Hot-wired, not bought – has to be clean."],["JJ","Und das Boot?","And the boat?"],["Rico","Am Hafen liegt ein Speedboot. Fahr's zum Steg am Strand. Das ist euer Notausgang.","There's a speedboat at the harbor. Take it to the beach pier. That's your escape hatch."]]),()=>{
      m.step=1; m.d.cars=0; obj(L2("Klau ein schnelles Auto und bring es zu Rico (0/2)","Steal a fast car and bring it to Rico (0/2)"),{x:RICO.x,y:RICO.y}); }); },
  tick(m,dt){ if (m.step===1){ const v=jj.veh;
      if (v&&v.t.kind==="car"&&v.unlocked&&Math.hypot(v.x-RICO.x,v.y-RICO.y)<120&&Math.abs(v.v)<30&&!v.delivered){ v.delivered=1; v.keep=true; m.d.cars++; sfx("ping"); toast(L2("🚗 Abgeliefert ("+m.d.cars+"/2)","🚗 Delivered ("+m.d.cars+"/2)"));
        if (m.d.cars>=2){ m.step=2; obj(L2("Hol ein Speedboot am Hafen","Grab a speedboat at the harbor"),{x:960,y:3410}); } else obj(L2("Noch ein schnelles Auto zu Rico ("+m.d.cars+"/2)","One more fast car to Rico ("+m.d.cars+"/2)"),{x:RICO.x,y:RICO.y}); } }
    if (m.step===2){ const v=jj.veh;
      if (v&&v.t.kind==="boat"){ obj(L2("Bring das Boot zum Steg am Strand","Take the boat to the beach pier"),{x:1000,y:3320}); if (Math.hypot(v.x-1000,v.y-3320)<80&&Math.abs(v.v)<40){ m.step=3; v.keep=true; talk(TL([["Rico","Perfekt. Wagen und Boot stehen.","Perfect. Cars and boat ready."],["Rico","Und du? Fährst immer noch geklaute Karren? Hier sind $3.000 für die Wagen – kauf dir bei mir was Eigenes.","And you? Still driving stolen rides? Here's $3,000 for the cars – buy something of your own from me."]]),()=>{
        cash+=3000; hudDirty=true; toast(L2("+$3.000 von Rico","+$3,000 from Rico")); m.step=4; obj(L2("Kauf dir bei Rico's Autos ein eigenes Auto","Buy your own car at Rico's"),{x:RICO.x,y:RICO.y}); }); } } }
    if (m.step===4&&m.d.carBought&&$("ricoShop").hidden){ m.step=5; talk(TL([["Rico","Gute Wahl. Jetzt fehlt nur noch der Plan.","Good choice. Now you just need the plan."]]),()=>completeMission()); } },
  after(){ crewMsg("yunus","Letzter Schritt vor dem Coup: Wir fahren die Bank ab. Wachwechsel, Kameras, Fluchtroute. Ich schick dir die Punkte."); }});
// ---------- M13: Der Probelauf (Recon-Fahrt mit Checkpoints) ----------
act2Def({id:"m13",n:"Der Probelauf",loc:ACT2_SPOTS.recon,giver:[["Yunus",40,8]],cash:1500,ruf:120,
  intro:"Bevor ihr die Central Bank überfallt, fahrt ihr die Fluchtroute ab und checkt die Bank von außen aus.",
  start(m){ talk(TL([["Yunus","Fahr die Punkte ab, die ich markiere. Merk dir jeden Weg. Beim echten Coup zählt jede Sekunde.","Drive to the points I mark. Learn every route. On the real job every second counts."]]),()=>{
      m.step=1; m.d.cp=0; m.d.pts=[{x:BANKDOOR.x,y:BANKDOOR.y+40,t:"Vordereingang"},{x:3980,y:1780,t:"Lieferhof"},{x:2855,y:2500,t:"Kreuzung Fluchtweg"},{x:RICO.x,y:RICO.y,t:"Wagenwechsel bei Rico"},{x:1000,y:3320,t:"Notausgang Boot"}]; this.next(m); }); },
  next(m){ const p=m.d.pts[m.d.cp]; m.d.ring=null; obj(L2("Checkpoint "+(m.d.cp+1)+"/"+m.d.pts.length+": "+p.t,"Checkpoint "+(m.d.cp+1)+"/"+m.d.pts.length),p); m.mark=[p]; },
  tick(m,dt){ if (m.step!==1) return; const p=m.d.pts[m.d.cp]; if (!p) return;
    if (Math.hypot(jj.x-p.x,jj.y-p.y)<90){ m.d.cp++; sfx("ping"); if (m.d.cp>=m.d.pts.length){ m.step=2; m.mark=null; talk(TL([["Yunus","Route sitzt. Morgen früh, wenn der Tresor offen ist. Dann holen wir uns Santoros Geld.","Route's locked. Tomorrow morning, when the vault's open. Then we take Santoro's money."],["JJ","Und dann Donny.","And then Donny."]]),()=>completeMission()); } else this.next(m); } },
  after(){ crewMsg("luka","Es ist soweit, Bruder. Alle treffen sich vor der Central Bank. Masken auf. Für Donny."); }});
// ---------- M14: CENTRAL BANK (Finale Akt 2) ----------
act2Def({id:"m14",n:"Central Bank",wave(m,n){ m.d.wave++; for (let i=0;i<n;i++){ const p=roadSpotAway(jj.x,jj.y,500,800); if (!p) continue; const v=spawnChaser("suv",p.x,p.y,p.a,"#0d0e11"); v.hunter=true; v.gunner=true; v.t=Object.assign({},v.t,{max:340,acc:260}); v.hp=220; m.d.hunt.push(v); } },loc:ACT2_SPOTS.heist,giver:[["Luka",-78,16],["Yunus",0,-30],["Paul",78,16]],cash:50000,ruf:400,
  intro:"Der große Coup. Mit Codes, Schlüsselkarte, Bohrern, Fluchtwagen und Plan überfallt ihr die Central Bank und holt euch Santoros Vermögen.",
  start(m){ talk(TL([["Luka","Codes, Karte, Bohrer, Wagen, Boot. Alles da.","Codes, card, drills, cars, boat. All set."],["Yunus","Ich übernehm die Kameras im Sicherheitsraum. Paul bohrt den Tresor.","I'll take the cameras in the security room. Paul drills the vault."],["Paul","Keine Zivilisten verletzen. Schnell rein, schnell raus.","Nobody innocent gets hurt. In fast, out fast."],["JJ","Danach weiß Santoro, dass wir kommen. Gut.","After this Santoro knows we're coming. Good."]]),()=>{
      m.step=0; m.allies=giverSpots(this).map(g=>({n:g.n,x:g.x,y:g.y,ang:0,step:0,moving:false,cd:1,pro:true,w:g.n==="Paul"?"shotgun":"pistol"})); m.ride=true;
      obj(L2("Geh mit der Crew in die Bank","Enter the bank with the crew"),{x:BANKDOOR.x,y:BANKDOOR.y}); }); },
  door(m,d){ if (m.step===0&&!CURROOM&&d({x:BANKDOOR.x,y:BANKDOOR.y})<42) return {lbl:L2("BANK STÜRMEN","STORM THE BANK"),fn:()=>{ m.step=1; const o=RBANK; o.missionOnly=true; enterRoom("bank",{x:700,y:840,a:Math.PI}); o.actors.length=0;
      const Lk=i=>Object.assign({},LOOKS[i%LOOKS.length],{rig:RIG_CIV[i%RIG_CIV.length]});
      m.d.host=[]; for (const [x,y] of [[360,320],[640,340],[920,320],[500,500],[800,500]]){ const a=roomActor(o,"Kunde",Lk(m.d.host.length),x,y,null,{}); a.down=true; m.d.host.push(a); }
      m.d.tellers=[]; for (let i=0;i<3;i++){ const a=roomActor(o,"Kassierer",Lk(i+6),380+i*180,150,null,{}); a.down=true; m.d.tellers.push(a); }
      obj(L2("Geh zum Sicherheitsraum hinter den Schaltern","Get to the security room behind the counters"),{x:o.r.x+1260,y:o.r.y+110}); }};
    return null; },
  tick(m,dt){ const o=RBANK; if (CURROOM!==o&&CURROOM!==VAULT&&m.step>=1&&m.step<9){ return; }
    if (m.step===1&&CURROOM===o&&Math.hypot(jj.x-(o.r.x+1260),jj.y-(o.r.y+110))<70){ m.step=2; setGate(o,"staff",true);
      figSetup: { m.d.yun=fig(m,"Yunus",o.r.x+1240,o.r.y+300,{tx:o.r.x+1250,ty:o.r.y+110,face:{x:o.r.x+1250,y:o.r.y+60},w:"pistol",arrive:()=>{ m.d.yun.bar=0; m.d.yun.lap=true; figSay(m.d.yun,L2("Kameras in 20 Sekunden.","Cameras down in 20.")); }}); }
      obj(L2("Gib Yunus Deckung – er legt die Kameras lahm","Cover Yunus – he's killing the cameras")); }
    if (m.step===2){ const y=m.d.yun; if (y&&y.bar>=0){ y.bar+=dt/8;
        if (y.bar>.3&&!m.d.g1){ m.d.g1=1; m.d.foes=[[o.r.x+700,o.r.y+700],[o.r.x+200,o.r.y+700]].map(([x,yy])=>spawnFoe(x,yy,{weapon:"pistol",look:GUARD_LOOK,sp:90,stay:true})); figSay(y,L2("Security! Halt sie dir vom Hals!","Security! Keep them off me!")); }
        if (y.bar>=1){ y.bar=-1; y.lap=false; m.step=3; sfx("ping"); setGate(o,"stairs",true); figSay(y,L2("Kameras aus! Treppe zum Tresor ist frei.","Cameras off! Stairs to the vault are open.")); obj(L2("Runter in den Tresor","Down to the vault"),{x:o.r.x+700,y:o.r.y+40}); } } }
    if (m.step===3&&CURROOM===VAULT){ m.step=4; m.d.paul=fig(m,"Paul",VAULT.r.x+460,VAULT.r.y+300,{tx:VAULT.r.x+540,ty:VAULT.r.y+360,face:{x:VAULT.r.x+540,y:VAULT.r.y+415},w:"shotgun",arrive:()=>{ m.d.paul.bar=0; m.d.paul.lap=true; figSay(m.d.paul,L2("Bohrer läuft. Deck mich.","Drill's running. Cover me.")); }});
      obj(L2("Deck Paul, während er die Tresortür bohrt","Cover Paul while he drills the vault")); }
    if (m.step===4){ const P=m.d.paul; if (P&&P.bar>=0){ P.bar+=dt/10; VAULT.doorOpen=Math.max(0,P.bar-.5)*2;
        if (P.bar>.4&&!m.d.g2){ m.d.g2=1; [[VAULT.r.x+550,VAULT.r.y+60]].map(([x,yy])=>spawnFoe(x,yy,{weapon:"pistol",look:SWAT_LOOK||GUARD_LOOK,sp:95,stay:true})); figSay(P,L2("Die kommen von oben!","They're coming from above!")); }
        if (P.bar>=1){ P.bar=-1; P.lap=false; VAULT.doorOpen=1; m.step=5; sfx("ping"); toast(L2("🔓 Tresor offen!","🔓 Vault open!")); m.d.bags=0; obj(L2("Sammle das Geld ein (0/4 Taschen)","Grab the cash (0/4 bags)"),{x:VAULT.r.x+250,y:VAULT.r.y+575}); } } }
    if (m.step===5){ for (const [x,y] of [[250,575],[840,575],[460,560],[640,560]]){ } const spots=[[250,575],[840,575],[460,560],[640,560]];
      for (let i=0;i<spots.length;i++){ if (m.d["bag"+i]) continue; if (Math.hypot(jj.x-(VAULT.r.x+spots[i][0]),jj.y-(VAULT.r.y+spots[i][1]))<34){ m.d["bag"+i]=1; m.d.bags++; sfx("reload"); jj.cashHeavy=m.d.bags; toast(L2("💰 Tasche "+m.d.bags+"/4","💰 Bag "+m.d.bags+"/4")); } }
      obj(L2("Sammle das Geld ein ("+m.d.bags+"/4 Taschen)","Grab the cash ("+m.d.bags+"/4 bags)"));
      if (m.d.bags>=4){ m.step=6; obj(L2("Rauf in die Halle – kämpf dich zum Ausgang","Back up to the hall – fight to the exit"),{x:VAULT.r.x+550,y:VAULT.r.y+60}); } }
    if (m.step===6&&CURROOM===RBANK){ m.step=7; m.d.swat=[[200,700],[760,700],[1100,700],[500,880],[900,880]].map(([x,y])=>spawnFoe(o.r.x+x,o.r.y+y,{weapon:"pistol",look:SWAT_LOOK||GUARD_LOOK,sp:95,stay:true})); toast(L2("🚨 SWAT in der Halle!","🚨 SWAT in the hall!")); figSay(m.d.yun||{},""); obj(L2("Kämpf dich zum Ausgang","Fight to the exit")); }
    if (m.step===7&&CURROOM===RBANK){ obj(L2("Kämpf dich zum Ausgang ("+(5-aliveFoes(m.d.swat))+"/5)","Fight to the exit ("+(5-aliveFoes(m.d.swat))+"/5)"));
      if (aliveFoes(m.d.swat)===0){ m.step=8; obj(L2("Raus aus der Bank!","Out of the bank!"),{x:o.r.x+700,y:o.r.y+880}); } }
    if (m.step===8&&CURROOM===RBANK&&inZone(o,[640,860,120,40])){ m.step=9; o.missionOnly=false; exitRoom({x:BANKDOOR.x,y:BANKDOOR.y+20},0); jj.cashHeavy=0; crime(5,"Banküberfall"); WANT.heat=5.5; WANT.lv=5; m.d.esc=0; m.d.ht=0; m.d.wave=0; m.d.hunt=[]; this.wave(m,3);
      talk(TL([["Santoro","(am Telefon) Ihr habt mein Geld? Dann lernt meine Jungs kennen.","(on the phone) You have my money? Then meet my boys."],["Paul","Schwarze SUVs! Fahr, JJ – ich schieß aus dem Fenster!","Black SUVs! Drive, JJ – I'll shoot from the window!"]]),()=>obj(L2("Santoros Killer jagen euch – schalte sie aus oder häng sie ab!","Santoro's killers are hunting you – take them out or lose them!"))); }
    if (m.step===9){ const d=m.d; d.ht+=dt; const H=d.hunt.filter(v=>!v.gone&&!v.wreck&&!(v.hp<=0));
      for (const v of H){ const dd=Math.hypot(v.x-jj.x,v.y-jj.y); v.lostT=dd>1500?(v.lostT||0)+dt:0; if (v.lostT>7){ v.hunter=false; v.gunner=false; v.ai=false; v.gone=true; toast(L2("Einen SUV abgehängt!","Lost one SUV!")); } }
      if (d.wave===1&&d.ht>28){ this.wave(m,2); toast(L2("🚨 Mehr SUVs!","🚨 More SUVs!")); }
      if (d.wave===2&&d.ht>55&&H.length<=1){ this.wave(m,2); toast(L2("🚨 Santoro schickt alles, was er hat!","🚨 Santoro sends everything he's got!")); }
      d.pT=(d.pT||0)-dt; if (jj.veh&&d.pT<=0){ d.pT=.45; let t=null, bd=400; for (const v of H){ const dd=Math.hypot(v.x-jj.veh.x,v.y-jj.veh.y); if (dd<bd&&losFree(jj.veh.x,jj.veh.y,v.x,v.y)){ bd=dd; t=v; } }
        if (t){ const sx=jj.veh.x, sy=jj.veh.y, hit=rnd()<.6; tracers.push({x1:sx,y1:sy,x2:t.x+(hit?0:(rnd()-.5)*60),y2:t.y+(hit?0:(rnd()-.5)*60),t:.07}); sfx("shot"); if (hit) damageVeh(t,11); if (!d.pSaid||d.ht-d.pSaid>9){ d.pSaid=d.ht; floatTxt(jj.veh.x,jj.veh.y-40,["PAUL: Bleib ruhig am Steuer!","PAUL: Treffer!","PAUL: Näher ran, JJ!"][Math.floor(rnd()*3)],"#ef4444"); } } }
      const left=H.length+(d.wave<3?1:0); obj(L2("Santoros Killer: "+H.length+" übrig – ausschalten oder abhängen","Santoro's killers: "+H.length+" left – take them out or lose them"));
      if (left===0&&WANT.lv>2){ WANT.lv=2; WANT.heat=Math.min(WANT.heat,2.5); }
      d.esc=left===0?Math.max(0,Math.min(1,d.esc+(WANT.seenT>0?-dt/20:dt/6))):0; if (left===0&&(WANT.lv===0||d.esc>=1)){ m.step=10; clearWanted(true);
        talk(TL([["Luka","WIR HABEN'S! Santoros ganzes Vermögen!","WE GOT IT! Santoro's entire fortune!"],["Paul","Und in den Unterlagen steht, wo er Donny festhält.","And the papers say where he's holding Donny."],["JJ","Leuchtturm am Kap von Santa Luna. Ich hol dich, Donny.","Lighthouse at Santa Luna cape. I'm coming, Donny."]]),()=>{ completeMission();
          setTimeout(()=>showCard({done:true,next:act3Intro},`<div class="mk">${L2("AKT 2 ABGESCHLOSSEN","ACT 2 COMPLETE")}</div><h2>${L2("Die Spur","The Trail")}</h2><p>${L2("Santoros Geld ist weg, sein Netzwerk zerschlagen – und JJ weiß endlich, wo Donny ist. Am Leuchtturm von Santa Luna wartet das Finale.","Santoro's money is gone, his network broken – and JJ finally knows where Donny is. The finale waits at the Santa Luna lighthouse.")}<br><br><b>${L2("Weiter mit Akt 3: Für Donny.","On to Act 3: For Donny.")}</b></p>`,L2("WEITER","NEXT")),400); }); } } }});
Object.assign(LEADS,{
  mh:{from:"earl",hint:"Onkel Bobby wartet vor seinem Haus",bark:""},
  mf:{from:"marco",hint:"Mo wartet am Flughafen",bark:"Flugstunde bei Mo. Ab zum Flughafen."},
  m7:{from:"luka",hint:"Luka hat den SUV am Flughafen gesehen",bark:"Der schwarze SUV. Endlich. Ab zum Flughafen."},
  m8:{from:"yunus",hint:"Brooks' Haus in Eastside – heute Abend",bark:"Die Wachcodes. Brooks wohnt in Eastside."},
  m9:{from:"luka",hint:"Treffen im Luna Park auf der Insel",bark:"Santoro will reden. Luna Park. Riecht nach Falle."},
  m10:{from:"rico",hint:"Whitmores Villa in Palm Heights",bark:"Die Schlüsselkarte. Rein in Whitmores Villa."},
  m11:{from:"yunus",hint:"L.A. Museum – der Stern von Malibu",bark:"Enzo will den Diamanten. Ab ins Museum."},
  m12:{from:"rico",hint:"Fluchtwagen für Rico, Boot am Hafen",bark:"Fluchtwagen und ein Boot. Fast soweit."},
  m13:{from:"yunus",hint:"Probelauf: Fluchtroute abfahren",bark:"Letzter Check vor dem Coup."},
  m14:{from:"luka",hint:"Alle treffen sich vor der Central Bank",bark:"Masken auf. Für Donny."}});

