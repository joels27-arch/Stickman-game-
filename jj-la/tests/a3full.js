const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const errs=[]; const p=await b.newPage({viewport:{width:1280,height:800}}); p.on('pageerror',e=>errs.push(e.message));
 const ev=(f,a)=>p.evaluate(f,a), W=ms=>p.waitForTimeout(ms);
 const skip=async()=>{ for(let i=0;i<18;i++){ if (await ev(()=>!!DLG)){ await p.keyboard.press('Enter'); await W(90);} else break; } };
 const killAll=()=>ev(()=>{ if (MI) for (const n of MI.foes) for (let k=0;k<20&&!n.dead;k++) killNpc(n,0,0); });
 const car=()=>ev(()=>{ const c=addVeh("sports",jj.x+40,jj.y,0,"#f00",{}); c.unlocked=true; c.v=0; jj.x=c.x; jj.y=c.y; getIn(c); });
 await p.addInitScript(()=>localStorage.setItem('jjla-tut3','1')); await p.goto('file://'+require('path').resolve(__dirname,'../index.html')); await W(600); await p.click('#go'); await W(900);
 const idx={m14:15,m15:16,m16:17,m17:18,m18:19,m19:20};
 const jump=async id=>{ await ev(()=>{ if (cardMode) hideCard(); }); await ev(i=>jumpToMission(i),idx[id]); await W(500); await skip(); await W(400); console.log('jump',id,JSON.stringify(await ev(()=>[MI&&MI.def.id,MI&&MI.step,MI&&MI.obj]))); };
 const res={};
 // Freischaltungen: vor Akt 3 kein Granatwerfer/Alien, Raketenwerfer ja
 await jump('m15'); res.unl15=await ev(()=>[UNLOCK.rpg,UNLOCK.gl,UNLOCK.alien]);
 res.shopLock=await ev(()=>{ renderShop(); return [...document.querySelectorAll('#sGrid button[data-buy]')].map(b=>b.dataset.buy+':'+b.textContent); });
 // M15 Gefängnishof
 await ev(()=>{ jj.x=JDOOR.x+60; jj.y=JDOOR.y; }); await W(500); await ev(()=>{ for (const n of JAIL.b) killNpc(n,0,0); }); await W(400); res.m15a=await ev(()=>[MI.step,JAIL.open]);
 await ev(()=>{ jj.x=JDOOR.x; jj.y=JDOOR.y; const t=doorTarget(); if (t) t.fn(); }); await W(400); res.m15b=await ev(()=>MI.step);
 await ev(()=>{ jj.x=MI.d.dar.x+20; jj.y=MI.d.dar.y; }); await W(300); await skip(); await W(300); res.m15c=await ev(()=>[MI.step,MI.d.in&&MI.d.in.length]);
 await killAll(); await W(400); res.m15d=await ev(()=>MI.step);
 await ev(()=>{ jj.x=JYIN.x; jj.y=JYIN.y; const t=doorTarget(); if (t) t.fn(); }); await W(500); res.m15=await ev(()=>[MS.done.m15,UNLOCK.gl]);
 // M16 Verrat + Zeitlimit (erst scheitern lassen, dann schaffen)
 await jump('m16'); res.m16a=await ev(()=>[MI.step,MI.d.f&&MI.d.f.length]); await killAll(); await W(500); await skip(); await W(300);
 res.m16t=await ev(()=>[MI.step,MI.d.tl|0,$('mTimer').hidden,$('mTimer').textContent]);
 await ev(()=>{ MI.d.tl=.5; }); await W(800); res.m16fail=await ev(()=>[!!MI,$('mTimer').hidden,!!cardMode,$('mcBody').textContent.slice(0,80)]);
 await jump('m16'); await killAll(); await W(500); await skip(); await W(300);
 await ev(()=>{ jj.x=MI.d.hp.x; jj.y=MI.d.hp.y; }); await W(400); res.m16b=await ev(()=>[MI.step,$('mTimer').hidden,MI.d.f2&&MI.d.f2.length]);
 await killAll(); await W(400); await skip(); await W(300); res.m16=await ev(()=>MS.done.m16);
 // M17 Lukas Flucht
 await jump('m17'); await car(); await W(300); await ev(()=>{ MI.d.car.hp=5; damageVeh(MI.d.car,80); }); await W(500); await skip(); await W(400); res.m17=await ev(()=>[MS.done.m17,UNLOCK.alien]);
 // M18 Leuchtturm
 await jump('m18'); res.m18a=await ev(()=>[MI.step,MI.allies.length]); for (let w=0;w<2;w++){ await W(300); await killAll(); await W(1600); }
 res.m18b=await ev(()=>MI.step); await ev(()=>{ jj.x=LHDOOR.x; jj.y=LHDOOR.y; }); await W(3600); await skip(); await W(300); res.m18c=await ev(()=>[MI.step,MI.allies.map(a=>a.n)]);
 await ev(()=>{ jj.x=DOOR.x; jj.y=DOOR.y+30; for (const a of MI.allies){ a.x=jj.x+20; a.y=jj.y; } }); await W(400); await skip(); await W(300); res.m18=await ev(()=>MS.done.m18);
 // M19 Finale
 await jump('m19'); res.m19a=await ev(()=>[MI.step,MI.d.wf&&MI.d.wf.length]); await killAll(); await W(400); await killAll(); await W(400);
 res.m19b=await ev(()=>[MI.step,MI.d.boss&&MI.d.boss.boss]); await ev(()=>{ const s=MI.d.boss; killNpc(s,0,0); }); res.m19hit=await ev(()=>[MI.d.boss.dead,MI.d.boss.boss]);
 await killAll(); await W(400); await skip(); await W(800); res.m19=await ev(()=>[MS.done.m19,!!cardMode,$('mcBody').textContent.slice(0,40)]);
 res.phone=await ev(()=>{ openPhone(); phoneView.screen='jobs'; renderPhone(); const t=document.getElementById('phone').textContent; closePhone(); return [t.includes('AKT 3'),t.includes('Für Donny')]; });
 console.log(JSON.stringify(res)); console.log('ERRORS', errs.slice(0,8)); await b.close(); })();
