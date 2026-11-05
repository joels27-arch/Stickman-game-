const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const errs=[]; const p=await b.newPage({viewport:{width:1280,height:800}}); p.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').split('\n').slice(1,3).join('|')));
 await p.goto('file://'+require('path').resolve(__dirname,'../index.html')); await p.waitForTimeout(1500); console.log(errs); await b.close(); })();
