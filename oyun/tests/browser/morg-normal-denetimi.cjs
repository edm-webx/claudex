// NaN normal audit: every chapter must have 0 broken normals after build (black-block bug on real GPUs)
const {chromium}=require('playwright');const path=require('path');const T='/home/user/claudex/oyun/node_modules/three';
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader']});const p=await b.newPage({viewport:{width:320,height:180}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('https://cdn.jsdelivr.net/npm/three@0.160.1/**',r=>{const u=r.request().url().replace('https://cdn.jsdelivr.net/npm/three@0.160.1/','');r.fulfill({path:path.join(T,u),contentType:'application/javascript'})});
await p.goto('file://'+path.resolve('morg3.html'));await p.waitForTimeout(2500);let fail=0;
for(let i=0;i<9;i++){await p.evaluate(i=>window.__morg.startChapter(i,false),i);await p.waitForTimeout(3000);
 if(i===7) await p.evaluate(()=>{const M=window.__morg;M.G.hunter(3,4);M.G.peek([[10,4]]);M.tick(5);});
 await p.waitForTimeout(300);const r=await p.evaluate(()=>({fixed:window.__morgFixed,bad:window.__morg.badNormals()}));if(r.bad)fail++;console.log('ch',i,JSON.stringify(r));}
console.log(fail?'FAIL':'OK',errs.slice(0,3).join(' | '));await b.close()})();
