// ================= STORY: AKT 1 – "EIN NIEMAND" =================
// Gang: Los Cuervos · Cop: Detective Cole · Drogenboss: Victor Santoro (Palm Heights)
const SPK={JJ:"#ffb347",Donny:"#6fd08a",Fahrer:"#f6c21c","Onkel Bobby":"#8fd18f",Luka:"#4fc3f7",Yunus:"#a78bfa",Paul:"#ef4444",Mo:"#d8b35a",Santoro:"#9ca3af",Mama:"#ff8a7a"};
const GANG_LOOK={skin:"#8d5a3b",skinHi:"#a8714f",shirt:"#1d1d22",shirtHi:"#34343c",pants:"#1a1a1f",shoe:"#b91c1c",cap:"#b91c1c"};
const GUARD_LOOK={skin:"#e2b48e",skinHi:"#f3cba7",shirt:"#24272e",shirtHi:"#3a3e48",pants:"#15171b",shoe:"#0d0d0f",hair:"#141414"};
const RANKS=[[0,"Niemand"],[50,"Neu in der Stadt"],[120,"Straßenjunge"],[200,"Bekanntes Gesicht"],[300,"Name in Eastside"],[600,"Respektiert"],[1000,"Gefürchtet"],[1600,"Boss der Stadt"]];
const MS={done:{},ruf:0};
const rankOf=r=>{ let n=RANKS[0][1]; for (const [v,t] of RANKS) if (r>=v) n=t; return n; };
let paused=false, MI=null, failedDef=null, cardMode=null, startArmed=true;
const SAVEKEY="jjla-save-v1";
function saveGame(){ try{ localStorage.setItem(SAVEKEY,JSON.stringify({cash,bank:BANK,blog:BANKLOG,own:W.own,done:MS.done,ruf:MS.ruf,sk:SKXP,unl:UNLOCK,mag:W.mag,res:W.res,outs:OWN_OUT,cars:OWN_CARS})); }catch(e){} }
function loadGame(){ try{ const d=JSON.parse(localStorage.getItem(SAVEKEY)||"null"); if (!d) return false; cash=d.cash|0; BANK=d.bank|0; BANKLOG=Array.isArray(d.blog)?d.blog:[]; Object.assign(W.own,d.own||{}); Object.assign(MS.done,d.done||{}); MS.ruf=d.ruf|0; Object.assign(SKXP,d.sk||{}); Object.assign(UNLOCK,d.unl||{}); if (Array.isArray(d.outs)) for (const o of d.outs) if (!OWN_OUT.includes(o)) OWN_OUT.push(o); if (Array.isArray(d.cars)) OWN_CARS.push(...d.cars.filter(c=>c&&RICO_CARS.some(r=>r.id===c.id))); for (const [m,u] of [["m4","scar"],["m5","gl"],["m6","alien"],["m6","plane"]]) if (MS.done[m]) UNLOCK[u]=true; for (const k of ["shotgun","scar","gl","rpg","alien"]){ if (d.mag&&d.mag[k]!=null) W.mag[k]=d.mag[k]; if (d.res&&d.res[k]!=null) W.res[k]=d.res[k]; else if (W.own[k]&&!W.mag[k]) W.res[k]={rpg:2,shotgun:16,scar:60,gl:6,alien:12}[k]; } return true; }catch(e){ return false; } }
function jumpToMission(i){ const def=MDEF[i]; if (!def) return; closePhone(); if (MI) cleanupMission(); MI=null; failedDef=null;
  if (FLY){ FLY.p.gone=false; FLY.p.x=FLY.p.hx; FLY.p.y=FLY.p.hy; FLY.p.a=FLY.p.ha; FLY=null; } if (RIDE){ RIDE.car.chauffeur=false; RIDE=null; } if (jj.veh) exitVeh(true);
  clearWanted(true); CINE=null; ESC=null; paused=false; jj.hidden=false; jj.lock=0; jj.dead=false; jj.hp=100; jj.h=0; jj.roof=null; jj.glide=null; LK.dive=false;
  for (const k of Object.keys(MS.done)) delete MS.done[k]; MS.ruf=0; BANK=0; BANKLOG=[]; cash=7; for (const k of Object.keys(UNLOCK)) UNLOCK[k]=false;
  for (const k of Object.keys(W.own)) if (k!=="fist") delete W.own[k];
  for (let k=0;k<i;k++){ const d=MDEF[k]; MS.done[d.id]=true; MS.ruf+=d.ruf; if (d.cash){ BANK+=d.cash; bankLog("Überweisung · "+d.n,d.cash); } for (const u of d.unlock||[]) UNLOCK[u]=true; }
  if (i>=2){ W.own.bat=true; } if (i>=3){ W.own.shotgun=true; W.mag.shotgun=8; W.res.shotgun=16; } setWeapon(i>=3?"shotgun":i>=2?"bat":"fist");
  LEAD=null; ARRIVAL=null; saveGame(); hudDirty=true; startMission(def,true); renderObj(); toast("Test: Mission "+(i+1)+" – "+def.n); }
function resetGame(){ try{ localStorage.removeItem(SAVEKEY); }catch(e){} }

// ---------- dialog ----------
let DLG=null;
function talk(lines,cb){ DLG={lines,i:0,cb}; paused=true; showDlg(); }
function showDlg(){ document.body.classList.add("talk"); const [who,txt]=DLG.lines[DLG.i]; $("dWho").textContent=who; $("dWho").style.color=SPK[who]||"#fff"; $("dTxt").textContent=txt; $("dlg").hidden=false; }
function dlgNext(){ if (!DLG) return; DLG.i++; if (DLG.i>=DLG.lines.length){ const cb=DLG.cb; DLG=null; $("dlg").hidden=true; document.body.classList.remove("talk"); paused=!!cardMode; if (cb) cb(); } else showDlg(); }
$("dlg").addEventListener("pointerdown",e=>{ e.preventDefault(); e.stopPropagation(); dlgNext(); });

// ---------- cards (start / done / fail) ----------
function showCard(mode,html,primary,secondary){ cardMode=mode; paused=true; $("mcBody").innerHTML=html; $("mcA").textContent=primary||""; $("mcA").hidden=!primary; $("mcB").textContent=secondary||""; $("mcB").hidden=!secondary; $("mcard").hidden=false; }
function hideCard(){ cardMode=null; $("mcard").hidden=true; paused=!!DLG; }
$("mcA").addEventListener("click",()=>{ const m=cardMode; hideCard(); if (m&&m.start) startMission(m.start); else if (m&&m.retry) startMission(m.retry,true); else if (m&&m.next) m.next(); });
$("mcB").addEventListener("click",()=>{ hideCard(); startArmed=false; });

// ---------- mission helpers ----------
const MDEF=[];
const nextDef=()=>MDEF.find(d=>!MS.done[d.id]);
function obj(text,target){ if (!MI) return; MI.obj=text; if (target){ gps={n:text,x:target.x,y:target.y,mission:true}; routeT=0; } else if (gps&&gps.mission) gps=null; renderObj(); }
function fitObj(L,T){ const hp=$("hpBox"); if (!hp) return; const r=hp.getBoundingClientRect(); const o=$("obj");
  const k=L+"|"+T+"|"+Math.round(r.left)+"|"+Math.round(r.bottom)+"|"+innerWidth; if (k===fitObj.k) return; fitObj.k=k;
  if (!r.width){ o.style.maxWidth=""; return; }
  // Mission-Box darf nie unter/neben die Lebensanzeige ragen
  if (T<r.bottom+6){ const room=Math.floor(r.left-L-10); if (room>=150){ o.style.maxWidth=room+"px"; } else { o.style.maxWidth=""; o.style.top=Math.ceil(r.bottom+8)+"px"; } }
  else o.style.maxWidth=""; }
function renderObj(){ const el=$("obj"); if (MI){ el.hidden=false; $("oT").textContent="MISSION "+(MDEF.indexOf(MI.def)+1)+" · "+MI.def.n; $("oX").textContent=MI.obj||""; }
  else if (RIDE&&!RIDE.done&&started){ el.hidden=false; $("oT").textContent="NÄCHSTE MISSION · Der Schläger"; $("oX").textContent=RIDE.phase==="drive"?"Onkel Bobby fährt dich zu Luka …":"Steig bei Onkel Bobby ins Auto"; }
  else { const d=nextDef(); if (d&&started&&MS.done.m1&&LEAD===d.id){ el.hidden=false; $("oT").textContent="NÄCHSTE MISSION · "+d.n; $("oX").textContent=(LEADS[d.id]||{}).hint||d.n; } else el.hidden=true; } }
function offView(x,y,m){ const W2=cssW/view.sc, H2=cssH/view.sc; return x<view.ox-m||x>view.ox+W2+m||y<view.oy-m||y>view.oy+H2+m; }
function spawnOutside(x,y){ if (offView(x,y,30)) return [x,y]; let ax=x-jj.x, ay=y-jj.y; if (Math.hypot(ax,ay)<5){ const a=rnd()*6.28; ax=Math.cos(a); ay=Math.sin(a); }
  const base=Math.atan2(ay,ax); for (const off of [0,.4,-.4,.8,-.8,1.3,-1.3,2,-2,3.14]){ const a=base+off; for (let r=60;r<1400;r+=40){ const px=x+Math.cos(a)*r, py=y+Math.sin(a)*r; if (px<20||py<20||px>WW-20||py>WH-20) break; if (offView(px,py,40)&&npcFree(px,py,12)) return [px,py]; } }
  return [x,y]; }
function freeSpot(x,y){ if (npcFree(x,y,12)) return [x,y]; for (let r=16;r<=420;r+=16) for (let k=0;k<16;k++){ const a=k/16*6.2832, px=x+Math.cos(a)*r, py=y+Math.sin(a)*r; if (npcFree(px,py,12)) return [px,py]; } return [x,y]; }
function spawnFoe(x,y,o){ let wi=null; if (!(o&&o.stay)){ const q2=spawnOutside(x,y); x=q2[0]; y=q2[1]; } else if (started&&!INROOM&&!CURROOM&&!offView(x,y,10)){ const q2=spawnOutside(x,y); if (q2[0]!==x||q2[1]!==y){ wi={x,y}; x=q2[0]; y=q2[1]; } } [x,y]=freeSpot(x,y); const n=Object.assign({x,y,ang:0,step:0,moving:false,run:false,look:GANG_LOOK,hostile:true,dead:false,deadT:0,cd:.6+rnd(),weapon:null,range:20,sp:120,hits:0,m:true},o||{}); n.sp=Math.min(n.sp,n.weapon?85:95); if (wi) n.walkIn=wi; npcs.push(n); if (MI) MI.foes.push(n); return n; }
