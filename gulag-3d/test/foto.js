// Ekran görüntüleri: node test/foto.js [klasor]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || path.join(__dirname, 'foto');
require('fs').mkdirSync(out, { recursive: true });
const NOKTA = [[0, 12], [0, 30], [1, 24], [1, 47], [2, 18], [2, 40], [3, 20], [3, 46], [4, 36], [4, 82]];
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const hata = []; p.on('pageerror', (e) => hata.push(e.message));
  const url = 'file://' + path.resolve(__dirname, '../index.html');
  await p.goto(url); await p.waitForTimeout(3000); await p.screenshot({ path: out + '/00-menu.png' });
  for (const [s, x] of NOKTA) {
    await p.goto(url + '?sv=' + s + '&test=1'); await p.waitForTimeout(1200);
    await p.evaluate(([x]) => { GK.dondur(true); const R = GK.R(); R.P.x = x; R.P.y = 1; GK.tus.sag = true; GK.simule(0.5); GK.tus.sag = false; GK.simule(0.3); for (let i = 0; i < 3; i++) GK.ciz(); }, [x]);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/s${s + 1}-${x}.png`, timeout: 120000 });
  }
  console.log(hata.join('\n') || 'hata yok');
  await b.close();
})();
