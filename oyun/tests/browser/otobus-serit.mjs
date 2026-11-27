// 42B şeridi görüntüsü: her realm durağında otobüsü çağırır, durakta bekleyen otobüsün ekran görüntüsünü alır.  DIST=dist node tests/browser/otobus-serit.mjs <çıktı> [realm,...]
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist');
const out = process.argv[2] || 'calisma/42b-serit/shots'; mkdirSync(out, { recursive: true });
const realms = (process.argv[3] || 'iskele,mahalle,stadyum,belgrad').split(',');
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm', css: 'text/css' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = join(DIST, p === '/' ? 'index.html' : p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': p === '/' ? 'text/html' : TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(p === '/' ? '<!doctype html><html><head><meta charset="utf-8"></head><body>' + readFileSync(f, 'utf8') + '</body></html>' : readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&qa=1&stage=10&saat=13`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
await kulisKapat(p, 'Olcum');
await p.evaluate(() => { const M = window.__marti; M.setTime(13); M.skipCeremony?.(); M.collectWelcome?.(); M.closeJobBoard?.(); M.closePanel?.(); for (let i = 0; i < 20; i++) M.step(1); });
await p.addStyleTag({ content: '#sbui{visibility:hidden!important}' });
const STOP = { iskele: [6, 12.2], mahalle: [248, 12.2], stadyum: [404, 12.2], belgrad: [806, 9] };
for (const r of realms) {
  const [sx, sz] = STOP[r];
  await p.evaluate(([x, z]) => { const M = window.__marti; M.teleport(x + 1.5, z + 1.2); for (let k = 0; k < 8; k++) { M.step(0.5); M.renderFrames(2, 0.1); } }, [sx, sz]);
  await p.evaluate(() => window.__marti.command({ kind: 'disari', op: 'otobusBekle' }));
  const tag = async (n, secs, cam) => { await p.evaluate(([s, cam]) => { const M = window.__marti; for (let k = 0; k < s * 5; k++) { M.step(0.2); M.renderFrames(1, 0.2); } if (cam) M.camera(cam); for (let k = 0; k < 6; k++) { M.step(0.05); M.renderFrames(2, 0.1); } }, [secs, cam]); await p.waitForTimeout(250); await p.screenshot({ path: join(out, `${r}-${n}.png`), timeout: 300000 }); console.log('ok', r, n); };
  const cam = { x: sx + 2, z: sz + 2, zoomRaw: Number(process.env.ZOOM || 0.6), yaw: Number(process.env.YAW || 0) * Math.PI / 2, tilt: Number(process.env.TILT || 0.9) };
  await tag('geliyor', 2, cam); await tag('durakta', 5, cam);
  await tag('gidiyor', 17, cam);
}
await b.close(); srv.close(); process.exit(0);
