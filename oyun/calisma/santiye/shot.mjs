import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CERR', m.text().slice(0, 300)); });
for (const s of process.argv.slice(2)) { const [n, pp] = s.split(':'); await p.goto(`http://localhost:5199/calisma/santiye/konsept.html?s=${n}${pp ? '&p=' + pp : ''}`); await p.waitForFunction(() => window.done, null, { timeout: 120000 }); await p.screenshot({ path: `calisma/santiye/shot/${n}${pp ? '-' + pp : ''}.png` }); console.log('ok', s); }
await b.close();
