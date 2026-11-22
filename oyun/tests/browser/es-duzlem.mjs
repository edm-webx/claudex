// Eş düzlem (z-fighting) denetimi: node tests/browser/es-duzlem.mjs [çıktı-dizini]
// Önce: npx vite build --mode development --outDir dist-dev && MARTI_DIST=dist-dev node tools/build-artifact.mjs
// İskele (büfe 10. aşama, üst geçit açık) ve AVM'nin dört katı taranır; renk/malzemesi farklı iki yüz aynı düzlemde örtüşüyorsa
// bulgudur (gerçek GPU'da "yanıp sönen siyah kare"). Ayrıca BOZUK NORMAL: uzunluğu 0/NaN köşe normali (GPU'da NaN, bloom siyah
// dikdörtgene yayar; 2026-11-22 üst geçit merdiveni). KATI=1: bozuk normal varsa çıkış 1 (npm run qa bunu çalıştırır);
// KATI=2: eş düzlem bulgusu da kırmızı. Ayrıntı: es-duzlem-lib.mjs
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { esDuzlemTara } from './es-duzlem-lib.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.MARTI_DIST || 'dist-dev');
const out = process.argv[2] || 'es-duzlem-cikti'; mkdirSync(out, { recursive: true });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=${process.env.TIER || 'sahane'}&seed=3&stage=10`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
for (let k = 0; k < 3; k++) { const pb = await p.waitForSelector('.ka-pb', { timeout: k ? 500 : 6000 }).catch(() => null); if (pb) { await pb.click({ force: true }).catch(() => {}); await p.waitForTimeout(300); } const go = await p.waitForSelector('.ka-go, .kl-go', { timeout: k ? 2000 : 8000 }).catch(() => null); if (!go) break; const ad = await p.$('input[name="ad"]'); if (ad) await ad.fill('Denetci').catch(() => {}); await go.click({ force: true }).catch(() => {}); await p.waitForTimeout(400); }
await p.evaluate((LV) => { const M = window.__marti; M.setTime(13); M.step(2); M.izgara?.(false); M.simCmd('money', 9e9); M.simCmd('level', LV); try { M.simCmd('cmd', { kind: 'setStage', stage: 10 }); } catch { /* */ } M.closeJobBoard?.(); M.closePanel?.(); for (let i = 0; i < 20; i++) { M.step(0.5); M.renderFrames(1, 0.1); } }, +(process.env.LEVEL || 40));
const rapor = {};
const yer = async (ad, x, z, kat, kutu) => {
  await p.evaluate(([x, z, kat]) => { const M = window.__marti; M.teleport(x, z, kat); for (let k = 0; k < 24; k++) { M.step(0.5); M.renderFrames(1, 0.1); } }, [x, z, kat]);
  const r = await p.evaluate(esDuzlemTara, { kutu: process.env.KUTU ? JSON.parse(process.env.KUTU) : kutu, tol: +(process.env.TOL || 0.001), asagi: process.env.ASAGI === '1' }); rapor[ad] = r;
  console.log(`${ad}: ${r.ucgen} üçgen, ${r.list.length} eş düzlem, ${r.bozukNormal.length} bozuk normal`); for (const f of r.bozukNormal) console.log(`  BOZUK NORMAL  ${f.kotu}/${f.toplam} köşe  ${f.tip}  ${f.ad}`);
  for (const f of r.list.slice(0, 25)) console.log(`  ${f.alan} m²  @${f.ornek}  n${f.normal} d${f.d}  ${f.a} [${f.renkA}]  ⟂  ${f.b} [${f.renkB}]`);
};
const ONLY = (process.env.YER || 'iskele,avm,stadyum,belgrad').split(',');
if (ONLY.includes('iskele')) await yer('iskele', 24, 12, 0, { x0: -70, x1: 70, z0: -40, z1: 40 });
if (ONLY.includes('stadyum')) await yer('stadyum', 404, 12.2, 0, { x0: 360, x1: 480, z0: -60, z1: 80 });
if (ONLY.includes('belgrad')) await yer('belgrad', 806, 9, 0, { x0: 760, x1: 920, z0: -80, z1: 80 });
if (ONLY.includes('avm')) await yer('avm', 1200.15, 47, 3, { x0: 1150, x1: 1250, z0: 30, z1: 70 });
writeFileSync(join(out, 'es-duzlem.json'), JSON.stringify({ rapor, errs }, null, 1));
const toplam = Object.values(rapor).reduce((s, r) => s + r.list.length, 0), bozuk = Object.values(rapor).reduce((s, r) => s + r.bozukNormal.length, 0);
console.log('eş düzlem', toplam, 'bozuk normal', bozuk, 'sayfa hatası', errs.length);
const K = process.env.KATI; await b.close(); srv.close(); process.exit((K === '1' || K === '2') && bozuk > 0 || K === '2' && toplam > 0 ? 1 : 0);
