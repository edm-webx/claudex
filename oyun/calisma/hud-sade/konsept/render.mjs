import { createRequire } from 'node:module'; const require = createRequire('/home/user/claudex/oyun/package.json'); const { chromium } = require('playwright');
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
for (const v of process.argv.slice(3)) { await p.goto('file://' + process.argv[2] + '?v=' + v); await p.waitForTimeout(1200); await p.screenshot({ path: process.argv[2].replace(/[^/]*$/, '') + 'out-' + v + '.png' }); console.log('ok', v); }
await b.close();
