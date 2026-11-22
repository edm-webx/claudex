// PRF-15/PRF-11: bellek ölçümü. node tools/bellek-olc.mjs [--build] [--dist KLASÖR] [--kademe dengeli] [--json çıktı.json] [--tekrar 2] [--boyut 1280x720] [--dokum] [--kapi]
// --kapi: tools/perf-budget.json bellek.calisma[kademe] tavanlarını (gpuMB, dokuMB, tamponMB, heapMB) aşan ya da (--tekrar 3+) son turda aynı
// noktada GPU belleği bir önceki turdan 2 MB'tan fazla büyüyen ölçümde çıkış 1 (bütçe 1280x720 için yazıldı). İlk tur karşılaştırılmaz:
// iskelenin ilk ölçümü karşı yaka hiç kurulmadan alınır, sonraki turlarda karşı yakanın gizli ama canlı kısmı iskelede de sayılır.
// --dokum: ölçüm derlemesi (vite --mode olcum) yapar ve her noktada kaynakDokum (doku/geometri baytı sahibine göre) yazar.
// Rota boyunca her noktada: GPU bellek (WebGL çağrılarından sayılan doku/renderbuffer/tampon baytı, tools/gpu-bellek-kanca.mjs),
// renderer.info.memory (geometri/doku sayısı), JS yığını (gc sonrası), DOM düğümü; ayrıca indirilen varlık baytı ve ilk kare süresi.
// Rota --tekrar kez gezilir: ikinci turda aynı noktada bellek ilk turdan büyükse uzak bölge boşaltılmıyor ya da sızıyor demektir.
// Donanımdan bağımsız sayılardır (SwiftShader'da da geçerli). Süreler bilgi amaçlı (makineye bağlı).
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, mkdtempSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { gpuBellekKanca } from './gpu-bellek-kanca.mjs';
import { kulisKapat } from '../tests/browser/kulis-kapat.mjs';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
let DIST = resolve(arg('--dist', 'dist'));
if (arg('--build')) {
  DIST = mkdtempSync(join(tmpdir(), 'marti-bellek-'));
  const env = { ...process.env, MARTI_DIST: DIST };
  const r1 = spawnSync('npx', ['vite', 'build', ...(arg('--dokum') ? ['--mode', 'olcum'] : []), '--outDir', DIST, '--emptyOutDir'], { stdio: ['ignore', 'ignore', 'inherit'], env });
  const r2 = r1.status === 0 ? spawnSync(process.execPath, ['tools/build-artifact.mjs'], { stdio: 'inherit', env }) : r1;
  if (r2.status !== 0) { console.error('bellek-olc: derleme başarısız'); process.exit(2); }
}
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const tier = String(arg('--kademe', 'dengeli')), TEKRAR = +arg('--tekrar', 2);
const ROTA = [['iskele', 0, -8], ['bufe-ici', 0.2, -2.6], ['hali-saha', 399, 12.2], ['orman', 806, 9], ['karsi-yaka', -30, 45], ['avm-ici', 1200.15, 46.0], ['avm-diyar', 1200.15, 46.6], ['avm-kat1', 1196, 50.9]];
const mime = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2' };
const indirilen = new Map();
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') { res.writeHead(200, { 'content-type': mime['.html'] }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p);
  if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const b = readFileSync(f); indirilen.set(p, (indirilen.get(p) || 0) + b.length);
  res.writeHead(200, { 'content-type': mime[extname(f)] || 'application/octet-stream' }); res.end(b);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
const [VW, VH] = String(arg('--boyut', '1280x720')).split('x').map(Number);
const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
const p = await ctx.newPage();
const hatalar = []; p.on('pageerror', e => hatalar.push(String(e).slice(0, 200)));
await p.addInitScript(gpuBellekKanca);
const t0 = Date.now();
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=${tier}&seed=3&stage=10`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
const hazirMs = Date.now() - t0;
await p.evaluate(() => { const M = window.__marti; M.play('sabri'); M.renderFrames(2, 0.1); });
await kulisKapat(p, 'Olcum');   // ad zorunlu (UX-15): karakter atölyesi açık kalırsa sim duraklı kalır, atölye bağlamı ölçüme karışır
await p.evaluate(() => { const M = window.__marti; M.simCmd('money', 9e9); M.simCmd('level', 40); });
const settle = n => p.evaluate(n => { for (let k = 0; k < n; k++) window.__marti.renderFrames(2, 0.1); }, n);
const sample = () => p.evaluate(() => { try { gc(); } catch { /* */ } const M = window.__marti, i = M.info(), g = window.__gpuBellek(6); return { gpuMB: g.toplamMB, dokuMB: g.dokuMB, rbMB: g.rbMB, tamponMB: g.tamponMB, glDoku: g.doku, glTampon: g.tampon, geos: i.geos, texs: i.texs, programs: i.programs, calls: i.calls, heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), dom: document.getElementsByTagName('*').length, enBuyuk: g.enBuyuk }; });
await settle(6); await p.waitForTimeout(1500); await settle(4);
const ilk = await sample();
const satir = [];
for (let t = 0; t < TEKRAR; t++) for (const [ad, x, z] of ROTA) {
  await p.evaluate(([x, z]) => window.__marti.teleport(x, z), [x, z]);
  await settle(10); await p.waitForTimeout(900); await settle(4);
  satir.push({ tur: t + 1, ad, ...(await sample()) });
  if (arg('--dokum')) { const d = await p.evaluate(() => window.__marti.kaynakDokum?.(3, 12)); if (d) { console.log(`\n[${t + 1} ${ad}] sahne doku ${d.dokuMB} MB, geometri ${d.geoMB} MB, aynı resmi paylaşan doku ${d.ayniResim}`); d.doku.forEach(r => console.log(`  doku ${String(r.kb).padStart(6)} KB x${r.adet} ${r.ad}`)); d.geo.slice(0, 6).forEach(r => console.log(`  geo  ${String(r.kb).padStart(6)} KB x${r.adet} ${r.ad}`)); } }
}
await p.evaluate(() => window.__marti.teleport(0, -8)); await settle(20); await p.waitForTimeout(1200); await settle(6);
const donus = await sample();
await browser.close(); srv.close();

const pad = (s, n) => String(s).padStart(n);
console.log(`kademe ${tier}, ${VW}x${VH}, hazır ${hazirMs} ms (index.html -> __marti.ready, SwiftShader; bilgi amaçlı)`);
console.log(`indirilen: ${[...indirilen].map(([k, v]) => `${k} ${(v / 1024).toFixed(0)}KB`).join(', ')}`);
console.log(`toplam indirilen ${(([...indirilen.values()].reduce((a, b) => a + b, 0)) / 1048576).toFixed(2)} MB, ${indirilen.size} dosya\n`);
console.log('tur nokta        GPU MB  doku   rb  tampon  glDoku glTamp  geo  tex prog  calls heapMB   dom');
const yaz = (r, ad) => console.log(`${pad(r.tur ?? '-', 3)} ${String(ad).padEnd(11)} ${pad(r.gpuMB, 7)} ${pad(r.dokuMB, 6)} ${pad(r.rbMB, 4)} ${pad(r.tamponMB, 7)} ${pad(r.glDoku, 7)} ${pad(r.glTampon, 6)} ${pad(r.geos, 4)} ${pad(r.texs, 4)} ${pad(r.programs, 4)} ${pad(r.calls, 6)} ${pad(r.heapMB, 6)} ${pad(r.dom, 5)}`);
yaz(ilk, 'ilk'); satir.forEach(r => yaz(r, r.ad)); yaz(donus, 'iskele-son');
const enb = satir.reduce((a, r) => r.gpuMB > a.gpuMB ? r : a, satir[0]);
console.log(`\nen yüksek GPU: ${enb.gpuMB} MB (${enb.ad}); en büyük dokular: ${enb.enBuyuk.map(d => `${d.w}x${d.h}${d.mip ? '+mip' : ''} ${d.mb}MB`).join(', ')}`);
const ozet = { tarih: new Date().toISOString().slice(0, 16), kademe: tier, hazirMs, indirilenMB: +(([...indirilen.values()].reduce((a, b) => a + b, 0)) / 1048576).toFixed(3), indirilen: Object.fromEntries(indirilen), ilk, satir, donus, gpuMaxMB: enb.gpuMB, heapMaxMB: Math.max(...satir.map(r => r.heapMB)), geoMax: Math.max(...satir.map(r => r.geos)), texMax: Math.max(...satir.map(r => r.texs)), hatalar };
if (hatalar.length) console.log('sayfa hataları:', hatalar);
let kapiKotu = 0;
if (arg('--kapi')) {
  const B = JSON.parse(readFileSync('tools/perf-budget.json', 'utf8')).bellek?.calisma?.[tier];
  if (!B) { console.log(`kapı: bütçede ${tier} yok`); kapiKotu++; }
  else for (const k of ['gpuMB', 'dokuMB', 'tamponMB', 'heapMB']) { const v = Math.max(...satir.map(r => r[k])); const ok = v <= B[k]; if (!ok) kapiKotu++; console.log(`kapı ${ok ? 'tamam' : 'AŞILDI'} ${k.padEnd(9)} ${v} / ${B[k]}`); }
  if (TEKRAR > 2) for (const r of satir.filter(r => r.tur === TEKRAR)) { const i = satir.find(q => q.tur === TEKRAR - 1 && q.ad === r.ad); if (i && r.gpuMB - i.gpuMB > 2) { kapiKotu++; console.log(`kapı BÜYÜME ${r.ad}: tur ${TEKRAR - 1} ${i.gpuMB} MB -> tur ${TEKRAR} ${r.gpuMB} MB`); } }
}
const jf = arg('--json'); if (jf && jf !== true) { writeFileSync(jf, JSON.stringify(ozet, null, 1)); console.log(`json: ${jf}`); }
process.exit(hatalar.length || kapiKotu ? 1 : 0);
