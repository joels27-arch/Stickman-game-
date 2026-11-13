// headless race screenshots: node ob.js <map card prefix> [shots] [query]
const { chromium } = require('playwright');
(async () => {
  const MAP = process.argv[2], N = +(process.argv[3] || 2), Q = process.argv[4] || "";
  const b = await chromium.launch({ args: ["--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
  const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  await c.addInitScript(() => { localStorage.setItem("lr:asked","1"); localStorage.setItem("lr:name","Joel"); localStorage.setItem("lr:tutAuto","1"); localStorage.setItem("lr:endlessTut","1"); localStorage.setItem("lr:prefs", JSON.stringify({sound:false,music:false})); });
  const p = await c.newPage(); const errs=[]; p.on("pageerror", e=>errs.push("PE "+e.message)); p.on("console", m=>{ const t=m.text(); if(m.type()==="error" && !/useProgram|GPU stall|ReadPixels/.test(t)) errs.push("C "+t.slice(0,400)); });
  await p.goto("http://127.0.0.1:8787/?x="+Date.now()+Q, { waitUntil: "domcontentloaded", timeout: 150000 });
  await p.waitForFunction(() => !document.querySelector("#boot"), null, { timeout: 150000 });
  await p.evaluate(() => document.querySelector("#createBtn").click());
  await p.waitForTimeout(3000);
  const r = await p.evaluate((MAP) => { const cards=[...document.querySelectorAll("#mapPick button")]; const c=cards.find(b=>b.textContent.trim().toLowerCase().startsWith(MAP)); if(c){ c.click(); return "picked"; } return "cards: "+cards.map(b=>b.textContent.trim()).join("/"); }, MAP);
  console.log(r);
  await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector("#lockBtn").click());
  for (let i=0;i<N;i++) { await p.waitForTimeout(3500); await p.screenshot({ path: MAP+i+".jpg", quality: 60, timeout: 90000, animations: "disabled" }).catch(()=>{}); console.log("shot", i); }
  console.log("errors", JSON.stringify(errs).slice(0,2000)); await b.close();
})().catch(e=>console.log("FAIL",e.message));
