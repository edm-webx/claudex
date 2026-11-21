// PRF-02: performans bütçesi ve otomatik kapı. Kullanım:
//   node tools/perf-gate.mjs [--build] [--dist KLASÖR] [--kademe akici,dengeli,sahane] [--yaz] [--sisir N] [--kaydet] [--json dosya]
//   npm run perf:gate            (derleme geçici klasöre yapılır, dist/ ile çakışmaz)
// Kapıya YALNIZ donanımdan bağımsız ölçütler girer: çizim çağrısı, üçgen, shader programı, geometri, doku, JS heap,
// game.js ve dist boyutu. (Sim tick maliyeti Node'da tests/sim/yuk.test.ts ile; JS-tarafı görünüm ms kapıda YOK: perf zamanlayıcısı üstel
// ortalama ve SwiftShader'a bağlı, ölçümler arası 1.4-48 ms oynadı, güvenilmez bulundu.) game.js ve dist boyutu. Headless Chromium SwiftShader (CPU'da yazılım GL) kullanır: kare süresi ve GPU süresi
// BURADA ÖLÇÜLMEZ ve bütçeye girmez; "sahibinGpu" sütunu PRF-01 kayıtlarından (window.__marti.perfRecord) elle doldurulur.
// --yaz: ölçülen değerlere %15 pay ekleyip tools/perf-budget.json'a yazar (sahte tahmin değil, ölçüm). --sisir N: sahneyi bilerek
// şişirir (kırmızı sınama; kapı KIRMIZI vermelidir). Çıkış kodu: 0 yeşil, 1 bütçe aşıldı, 2 ölçüm hatası.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdtempSync, mkdirSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const BUDGET_P = 'tools/perf-budget.json', HIST_P = 'calisma/perf-gecmis.json';
const PAY = 1.15, MB = 1048576;
const tiers = String(arg('--kademe', 'akici,dengeli,sahane')).split(',');
const yaz = !!arg('--yaz'), sisir = Number(arg('--sisir', 0)) || 0, kaydet = !!arg('--kaydet');

let DIST = resolve(arg('--dist', 'dist'));
if (arg('--build')) {
  DIST = mkdtempSync(join(tmpdir(), 'marti-perf-'));
  const env = { ...process.env, MARTI_DIST: DIST };
  const r1 = spawnSync('npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], { stdio: 'inherit', env });
  const r2 = r1.status === 0 ? spawnSync(process.execPath, ['tools/build-artifact.mjs'], { stdio: 'inherit', env }) : r1;
  if (r2.status !== 0) { console.error('perf-gate: derleme başarısız'); process.exit(2); }
}
if (!existsSync(join(DIST, 'game.js'))) { console.error(`perf-gate: ${DIST}/game.js yok (--build ya da önce vite build)`); process.exit(2); }

const globalRoot = (() => { try { return execSync('npm root -g').toString().trim(); } catch { return ''; } })();
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(join(globalRoot, 'x.js'))('playwright')); }

// ── yürüyüş rotası (koordinatlar oyun içeriğinden: büfe başlangıcı, kafe/AVM kapıları, halı saha kapısı, orman durağı)
const ROTA = [
  ['iskele', 0, -8], ['bufe-ici', 0.2, -2.6], ['hali-saha', 399, 12.2], ['orman', 806, 9],
  ['karsi-yaka', -30, 45], ['avm-ici', 1200.15, 46.0],
];

const mime = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') { res.writeHead(200, { 'content-type': mime['.html'] }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p);
  if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });

const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const dosyalar = walk(DIST);
const boyut = { gameJsMB: +(statSync(join(DIST, 'game.js')).size / MB).toFixed(3), distMB: +(dosyalar.reduce((a, f) => a + statSync(f).size, 0) / MB).toFixed(3), dosya: dosyalar.length };

async function olc(tier) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
  const p = await ctx.newPage();
  const hatalar = []; p.on('pageerror', e => hatalar.push(String(e).slice(0, 160)));
  await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=${tier}&seed=3&stage=10`);
  await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
  await p.evaluate(() => { const M = window.__marti; M.play('sabri'); M.renderFrames(2, 0.1); });
  const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { await go.click({ force: true }); await p.waitForTimeout(700); }
  await p.evaluate(() => { const M = window.__marti; M.simCmd('money', 9e9); M.simCmd('level', 40); });
  const settle = n => p.evaluate(n => { for (let k = 0; k < n; k++) window.__marti.renderFrames(2, 0.1); }, n);
  const sample = () => p.evaluate(() => { const M = window.__marti, i = M.info(), t = i.timers || {}; return { calls: i.calls, tris: i.tris, geos: i.geos, texs: i.texs, programs: i.programs, heapMB: +(performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0).toFixed(1), timers: t }; });
  const noktalar = {};
  for (const [ad, x, z] of ROTA) {
    await p.evaluate(([x, z]) => window.__marti.teleport(x, z), [x, z]);
    await settle(10); await p.waitForTimeout(900); await settle(4);
    if (sisir && ad === 'iskele') { const n = await p.evaluate(n => window.__marti.sisir(n), sisir); await settle(4); console.log(`  (sahne şişirildi: +${n} mesh)`); }
    let en = null;
    for (let k = 0; k < 3; k++) { await settle(1); const s = await sample(); en = en ? Object.fromEntries(Object.keys(s).filter(a => a !== 'timers').map(a => [a, Math.max(en[a], s[a])])) : { ...s }; en.timers = s.timers; }
    noktalar[ad] = en;
  }
  const loop = await p.evaluate(() => window.__marti.loop?.() ?? null);
  await ctx.close();
  return { noktalar, hatalar, loop };
}

const sonuc = {};
try { for (const t of tiers) { console.log(`ölçülüyor: kademe ${t} …`); sonuc[t] = await olc(t); } }
catch (e) { console.error('perf-gate: ölçüm hatası:', e.message); await browser.close(); srv.close(); process.exit(2); }
await browser.close(); srv.close();

// ── kademe başına rota üstü en büyük değerler
const OLC = ['calls', 'tris', 'programs', 'geos', 'texs', 'heapMB'];
const ozet = {};
for (const t of tiers) {
  ozet[t] = {}; for (const m of OLC) { let mx = 0, nerede = ''; for (const [ad, v] of Object.entries(sonuc[t].noktalar)) if (v[m] > mx) { mx = v[m]; nerede = ad; } ozet[t][m] = +mx.toFixed(m === 'heapMB' ? 2 : 0); ozet[t]['_' + m] = nerede; }
}

if (yaz) {
  const b = existsSync(BUDGET_P) ? JSON.parse(readFileSync(BUDGET_P, 'utf8')) : {};
  b.kademe = {};
  for (const t of tiers) { b.kademe[t] = {}; for (const m of OLC) b.kademe[t][m] = Math.ceil(ozet[t][m] * PAY * (m === 'heapMB' ? 1.2 : 1) * 100) / 100; }
  b.boyut = { gameJsMB: +(boyut.gameJsMB * PAY).toFixed(2), distMB: +(boyut.distMB * PAY).toFixed(2) };
  b.sahibinGpu = b.sahibinGpu || { _not: 'PRF-01 perfRecord kayıtlarından sahibin PC/telefonunda doldurulur. SwiftShader süresinden ASLA türetilmez.', akici: { kareP95Ms: null }, dengeli: { kareP95Ms: null }, sahane: { kareP95Ms: null } };
  b._temel = { tarih: new Date().toISOString().slice(0, 10), pay: '%15 (heapMB %15x1.2: GC dalgalanması)', olculen: ozet, boyut };
  writeFileSync(BUDGET_P, JSON.stringify(b, null, 2) + '\n'); console.log(`bütçe yazıldı: ${BUDGET_P}`);
}

// ── karşılaştırma
const B = JSON.parse(readFileSync(BUDGET_P, 'utf8'));
let kirmizi = 0; const sat = [];
const kontrol = (ad, deger, ust) => { const ok = ust == null || deger <= ust; if (!ok) kirmizi++; sat.push(`${ok ? 'tamam  ' : 'KIRMIZI'} ${ad.padEnd(26)} ${String(deger).padStart(9)} / ${ust ?? '-'}`); };
for (const t of tiers) {
  for (const m of OLC) kontrol(`${t} ${m}${ozet[t]['_' + m] ? ' (' + ozet[t]['_' + m] + ')' : ''}`, ozet[t][m], B.kademe?.[t]?.[m]);
  for (const h of sonuc[t].hatalar) { kirmizi++; sat.push(`KIRMIZI sayfa hatası (${t}): ${h}`); }
}
kontrol('game.js MB', boyut.gameJsMB, B.boyut?.gameJsMB); kontrol('dist toplam MB', boyut.distMB, B.boyut?.distMB);
console.log('\n' + sat.join('\n'));
console.log('\nSahibin GPU sütunu (kare p95 ms): ' + tiers.map(t => `${t}=${B.sahibinGpu?.[t]?.kareP95Ms ?? 'kayıt yok'}`).join(' ') + '  (SwiftShader kare süresi kapıya girmez)');

// ── geçmiş sürümle fark tablosu
let gecmis = []; try { gecmis = JSON.parse(readFileSync(HIST_P, 'utf8')); } catch { /* yok */ }
const son = gecmis[gecmis.length - 1];
const surum = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return '?'; } })();
if (son) {
  console.log(`\nFark tablosu (önceki kayıt ${son.surum} ${son.tarih} -> şimdi ${surum}):`);
  for (const t of tiers) if (son.ozet?.[t]) console.log('  ' + t.padEnd(8) + OLC.map(m => { const a = son.ozet[t][m], c = ozet[t][m]; const d = a ? ((c - a) / a * 100) : 0; return `${m} ${c} (${d >= 0 ? '+' : ''}${d.toFixed(1)}%)`; }).join('  '));
  if (son.boyut) console.log(`  game.js ${boyut.gameJsMB} MB (${(boyut.gameJsMB - son.boyut.gameJsMB >= 0 ? '+' : '')}${(boyut.gameJsMB - son.boyut.gameJsMB).toFixed(3)}), dist ${boyut.distMB} MB`);
} else console.log('\nFark tablosu: önceki kayıt yok (--kaydet ile ilk kayıt oluşur).');
if (kaydet && !sisir) { mkdirSync('calisma', { recursive: true }); gecmis.push({ surum, tarih: new Date().toISOString().slice(0, 16), ozet, boyut }); writeFileSync(HIST_P, JSON.stringify(gecmis.slice(-30), null, 1)); console.log(`geçmişe eklendi: ${HIST_P}`); }
const jf = arg('--json'); if (jf && jf !== true) writeFileSync(jf, JSON.stringify({ surum, ozet, boyut, noktalar: Object.fromEntries(tiers.map(t => [t, sonuc[t].noktalar])), loop: Object.fromEntries(tiers.map(t => [t, sonuc[t].loop])) }, null, 1));
console.log(kirmizi ? `\nPERF KAPISI: KIRMIZI (${kirmizi} ihlal)` : '\nPERF KAPISI: YEŞİL');
process.exit(kirmizi ? 1 : 0);
