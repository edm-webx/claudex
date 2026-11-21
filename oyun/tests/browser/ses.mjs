// Bölgesel ses doğrulaması: node tests/browser/ses.mjs   (önce npm run build:vite)
// Karakteri iskele / mutfak / salon / ormana ışınlar; __marti.audio.atmo yalnız o bölgenin katmanlarını göstermeli.
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.glb') ? 'model/gltf-binary' : f.endsWith('.png') ? 'image/png' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=10`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 60000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { const ad = await p.$('input[name="ad"]'); if (ad) await ad.fill('Olcum'); await go.click({ force: true }); await p.waitForTimeout(700); }
await p.mouse.click(640, 360); await p.keyboard.press('Space'); await p.waitForTimeout(800);
const SPOTS = { iskele: [0, 2, ['deniz', 'izgara']], mutfak: [0, -15, ['ic_mutfak']], salonE: [15.6, -12, ['ic_lokanta']], hastane: [46.95, 51.5, ['ic_hastane']] };
let bad = 0;
for (const [ad, [x, z, beklenen]] of Object.entries(SPOTS)) {
  const r = await p.evaluate(async ([x, z]) => { const M = window.__marti; M.teleport(x, z); for (let k = 0; k < 12; k++) M.renderFrames(3, 0.1); await new Promise(r => setTimeout(r, 900)); return M.audio?.atmo ?? null; }, [x, z]);
  if (!r) { console.log('ATLANDI (ses bağlamı yok)', ad); continue; }
  const ok = JSON.stringify([...r.active].sort()) === JSON.stringify([...beklenen].sort());
  console.log(ok ? 'ok' : 'HATA', ad, JSON.stringify(r)); if (!ok) bad++;
}
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
