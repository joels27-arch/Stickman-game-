const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const errs=[]; const p=await b.newPage({viewport:{width:1280,height:800}}); p.on('pageerror',e=>errs.push(e.message));
 const ev=(f,a)=>p.evaluate(f,a), W=ms=>p.waitForTimeout(ms);
 const skip=async()=>{ for(let i=0;i<18;i++){ if (await ev(()=>!!DLG)){ await p.keyboard.press('Enter'); await W(90);} else break; } };
 const safe=async()=>{ for(let i=0;i<30;i++){ if (await ev(()=>!!SAFE)){ await ev(()=>{ SAFE.a=SAFE.zone.c; }); await ev(()=>safeHit()); await W(450);} else break; } };
 const hack=async()=>{ for(let i=0;i<40;i++){ if (await ev(()=>!!HACK)){ const k=await ev(()=>HACK.seq&&HACK.seq[HACK.i]); await p.keyboard.press(['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'][k||0]); await W(70);} else break; } };
 const car=()=>ev(()=>{ const c=addVeh("sports",jj.x+40,jj.y,0,"#f00",{}); c.unlocked=true; c.v=0; jj.x=c.x; jj.y=c.y; getIn(c); });
 await p.addInitScript(()=>localStorage.setItem('jjla-tut3','1')); await p.goto('file://'+require('path').resolve(__dirname,'../index.html')); await W(600); await p.click('#go'); await W(900);
 const idx={mh:6,mf:7,m7:8,m8:9,m9:10,m10:11,m11:12,m12:13,m13:14,m14:15};
 const jump=async id=>{ await ev(()=>{ if (cardMode) hideCard(); }); await ev(i=>jumpToMission(i),idx[id]); await W(500); await skip(); await W(400); console.log('jump',id,JSON.stringify(await ev(()=>[MI&&MI.def.id,MI&&MI.step,paused,!!DLG,cardMode&&Object.keys(cardMode),$('mcBody').textContent.slice(0,60)]))); };
 const res={};
 // MH house
 await jump('mh'); await ev(()=>{ jj.x=SALESIGN.x; jj.y=SALESIGN.y; const t=doorTarget(); if (t) t.fn(); }); await W(300); await skip(); await W(300); res.mh=await ev(()=>[MS.done.mh,BANK]);
 // MF flight
 await jump('mf'); await ev(()=>{ boardPlane(PLANES[0]); }); await W(300); res.mf1=await ev(()=>[MI.step,!!FLY]);
 for (let i=0;i<5;i++){ await ev(()=>{ const R0=MI.d.rings[MI.d.ri]; FLY.x=R0.x; FLY.y=R0.y; FLY.h=120; FLY.v=300; }); await W(250); }
 res.mf2=await ev(()=>MI.step);
 await ev(()=>{ FLY.h=0; FLY.v=0; FLY.x=AIR.runway.x+600; FLY.y=AIR.runway.y+70; }); await W(300); await skip(); await W(300); res.mf=await ev(()=>[MS.done.mf,UNLOCK.plane]);
 await ev(()=>{ if (FLY) leavePlane(false); });
 // M7
 await jump('m7'); await car(); await W(300); await ev(()=>{ MI.d.suv.hp=5; damageVeh(MI.d.suv,80); }); await W(500); await skip(); await W(400); res.m7=await ev(()=>MS.done.m7);
 // M8
 await jump('m8'); await ev(()=>{ jj.x=BROOKSWIN.x; jj.y=BROOKSWIN.y; { const t=doorTarget(); if (t) t.fn(); else window.__miss=(window.__miss||[]).concat([[MI&&MI.def.id,MI&&MI.step,paused,!!DLG,!!cardMode]]); } }); await W(400);
 await ev(()=>{ jj.x=BHOUSE.r.x+420; jj.y=BHOUSE.r.y+358; { const t=doorTarget(); if (t) t.fn(); else window.__miss=(window.__miss||[]).concat([[MI&&MI.def.id,MI&&MI.step,paused,!!DLG,!!cardMode]]); } }); await W(300); await safe(); await W(400); await skip();
 await ev(()=>{ jj.x=BHOUSE.r.x+90; jj.y=BHOUSE.r.y+392; }); await W(1800); res.m8=await ev(()=>MS.done.m8); res.m8room=await ev(()=>!!CURROOM);
 // M9
 await jump('m9'); for (let w=0;w<3;w++){ await W(400); await ev(()=>{ if(MI.d.wf) for (const n of MI.d.wf) if(!n.dead) killNpc(n,0,0); }); await W(1500); await skip(); } await W(300); res.m9=await ev(()=>MS.done.m9);
 // M10
 await jump('m10'); await ev(()=>{ openRico('o'); const b=document.querySelector('#rGrid button[data-ro="1"]'); if (b) b.click(); closeRico(); }); await W(300); res.m10dress=await ev(()=>[MI.step,OUTFIT]); await ev(()=>{ jj.x=WDOOR.x; jj.y=WDOOR.y; { const t=doorTarget(); if (t) t.fn(); else window.__miss=(window.__miss||[]).concat([[MI&&MI.def.id,MI&&MI.step,paused,!!DLG,!!cardMode]]); } }); await W(400); res.m10sg=await ev(()=>[SG.on,SG.guards.length,SG.cams.length]);
 await ev(()=>{ if(MI.d.card){ jj.x=MI.d.card.x; jj.y=MI.d.card.y; } }); await W(400);
 await ev(()=>{ jj.x=WVILLA.r.x+840; jj.y=WVILLA.r.y+585; }); await W(1700); res.m10=await ev(()=>MS.done.m10);
 // M11
 await jump('m11'); await ev(()=>{ jj.x=MUSDOOR.x; jj.y=MUSDOOR.y; { const t=doorTarget(); if (t) t.fn(); else window.__miss=(window.__miss||[]).concat([[MI&&MI.def.id,MI&&MI.step,paused,!!DLG,!!cardMode]]); } }); await W(400); res.m11sg=await ev(()=>[SG.lasers.length,SG.cams.length,SG.guards.length]);
 await ev(()=>{ if(MI.d.gem){ jj.x=MI.d.gem.x; jj.y=MI.d.gem.y; } }); await W(400);
 console.log('m11 a',JSON.stringify(await ev(()=>[MI.step,MUSEUM.taken]))); await ev(()=>{ jj.x=MUSEUM.r.x+1490; jj.y=MUSEUM.r.y+670; }); await W(500); console.log('m11 b',JSON.stringify(await ev(()=>[MI&&MI.step,!!CURROOM,WANT.lv]))); await ev(()=>clearWanted(true)); await W(600); await skip(); await W(300); res.m11=await ev(()=>MS.done.m11);
 // M12
 await jump('m12');
 for (let i=0;i<2;i++){ await ev(()=>{ const c=addVeh("sports",RICO.x,RICO.y,0,"#f00",{}); c.unlocked=true; c.v=0; jj.x=c.x; jj.y=c.y; getIn(c); MI.def.tick(MI,.1); exitVeh(true); }); await W(200); }
 res.m12cars=await ev(()=>[MI.step,MI.d.cars]);
 await ev(()=>{ const bt=addVeh("boat",1000,3320,0,"#fff",{}); bt.v=0; jj.x=bt.x; jj.y=bt.y; getIn(bt); }); await W(200); await ev(()=>MI.def.tick(MI,.1)); await W(300); await skip(); res.m12buy=await ev(()=>[MI&&MI.step,ricoTab]); await ev(()=>{ exitVeh(true); openRico('c'); const b=document.querySelector('#rGrid button[data-rc="moto"]'); if (b) b.click(); closeRico(); }); await W(400); await skip(); await W(300); res.m12=await ev(()=>[MS.done.m12,OWN_CARS.length]);
 // M13
 await jump('m13'); for (let i=0;i<5;i++){ await ev(()=>{ if (!MI||!MI.d.pts) return; const pt=MI.d.pts[MI.d.cp]; if (!pt) return; jj.x=pt.x; jj.y=pt.y; }); await W(300); } await skip(); await W(300); res.m13=await ev(()=>[MS.done.m13,MI&&MI.step,MI&&MI.d.cp]);
 // M14
 await jump('m14'); await ev(()=>{ jj.x=BANKDOOR.x; jj.y=BANKDOOR.y; { const t=doorTarget(); if (t) t.fn(); else window.__miss=(window.__miss||[]).concat([[MI&&MI.def.id,MI&&MI.step,paused,!!DLG,!!cardMode]]); } }); await W(400); res.m14in=await ev(()=>[CURROOM&&CURROOM.id,MI.step]);
 await ev(()=>{ jj.x=RBANK.r.x+1260; jj.y=RBANK.r.y+110; }); await W(400); res.m14sec=await ev(()=>MI.step);
 await ev(()=>{ if(MI.d.yun) MI.d.yun.bar=1.1; }); await W(400); res.m14cam=await ev(()=>MI.step);
 await ev(()=>{ enterRoom("vault",{x:550,y:300,a:0}); MI.def.tick(MI,.1); }); await W(400); res.m14vault=await ev(()=>MI.step);
 await ev(()=>{ if(MI.d.paul) MI.d.paul.bar=1.1; MI.def.tick(MI,.1); }); await W(400); res.m14drill=await ev(()=>MI.step);
 await ev(()=>{ ['bag0','bag1','bag2','bag3'].forEach((k,i)=>{ const sp=[[260,640],[840,640],[460,560],[640,560]][i]; jj.x=VAULT.r.x+sp[0]; jj.y=VAULT.r.y+sp[1]; MI.def.tick(MI,.1); }); }); await W(300); res.m14bags=await ev(()=>[MI.step,MI.d.bags]);
 await ev(()=>{ enterRoom("bank",{x:700,y:130,a:0}); MI.def.tick(MI,.1); }); await W(400); res.m14hall=await ev(()=>MI.step);
 await ev(()=>{ if(MI.d.swat) for(const n of MI.d.swat) if(!n.dead) killNpc(n,0,0); }); await W(400); res.m14swat=await ev(()=>MI.step);
 await ev(()=>{ jj.x=RBANK.r.x+700; jj.y=RBANK.r.y+870; MI.def.tick(MI,.1); }); await W(400); res.m14exit=await ev(()=>[MI.step,!!CURROOM]);
 await skip(); await W(300);
 await ev(()=>{ const car=vehicles.find(v=>v.t.kind==='car'&&!v.gone&&!v.wreck&&!v.missionV&&!v.driver&&v.type!=='police'); getIn(car); car.v=0; const p=landNear(jj.x+60,jj.y+40); car.x=p.x; car.y=p.y; window.__hp0=car.hp; }); await ev(()=>{ window._g2=setInterval(()=>{ jj.hp=100; },50); });
 console.log('pre', await ev(()=>[!!MI, MI&&MI.step, jj.dead, !!jj.veh, MI&&MI.d.hunt&&MI.d.hunt.length, MS.done.m14])); const samp=[]; for (let k=0;k<3;k++){ await ev(()=>{ const v=jj.veh; if (v){ v.v=Math.min(260,v.v+120); } }); await W(1000); samp.push(await ev(()=>!MI?('NOMI dead='+jj.dead+' done='+MS.done.m14+' toast='+($('toast')&&$('toast').textContent)):MI.d.hunt.map(v=>[Math.round(Math.hypot(v.x-jj.x,v.y-jj.y)),Math.round(Math.abs(v.v)),v.wreck?1:0,v.hp|0]).join('|')+' myhp '+(jj.veh?jj.veh.hp|0:'-'))); }
 res.chase=samp; await p.screenshot({path:'m14chase.png'});
 for (let w=0;w<4;w++){ await ev(()=>{ if (!MI) return; for (const v of MI.d.hunt) if (!v.wreck) damageVeh(v,999); MI.d.ht=Math.max(MI.d.ht,60*(1+0)); }); await W(800); }
 await ev(()=>clearWanted(true)); await W(800); await skip(); await W(400); res.m14=await ev(()=>MS.done.m14); res.m14st=await ev(()=>MI&&[MI.step,MI.d.wave]);
 console.log(JSON.stringify(res,null,0)); console.log('MISS',JSON.stringify(await ev(()=>window.__miss||[]))); console.log('ERRORS', errs.slice(0,8)); await b.close(); })();
