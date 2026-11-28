// BUF-29: aşama 3 / 6 / 10 kare süresi ölçümü (tests/browser/perf.mjs sunucu ve SwiftShader kurulumu aynı). Her aşamada tam kadro işe alınır (iş panosu),
// sim birkaç dakika ilerletilir (müşteri + çalışan kalabalığı oluşsun), sonra 3 noktada (büfe önü, mutfak vitrini, uzak karşı yaka) N kare ölçülür:
// her kare = 1 sim adımı (loop.advance 1/30) + 1 render karesi. Kare başına süreler ayrı ayrı alınır: p50 / p95 / maks.
// Kullanım: MARTI_DIST=/tmp/marti-dist node tests/browser/perf-asama.mjs [--asama 3,6,10] [--kare 240] [--json calisma/perf-asama-rapor.json] [--etiket onceki]
// SwiftShader NOTU: render süresi yazılım rasterıdır, sahibin GPU'su değildir; güvenilir olanlar sim adımı ve JS tarafı (guard sistem zamanlayıcıları).
import { createServer } from 'node:http'; import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, resolve, dirname } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.MARTI_DIST || 'dist');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const NOKTA_SEC = String(arg('--nokta', 'bufe-onu,mutfak-vitrin,uzak-karsi-yaka')).split(',');
const ASAMALAR = String(arg('--asama', '3,6,10')).split(',').map(Number), KARE = +arg('--kare', 240), JSON_YOL = arg('--json', null), ETIKET = arg('--etiket', 'olcum');
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ROLLER = ['doner', 'cay', 'tost', 'garson', 'temizlik', 'asci', 'komi', 'bulasikci', 'kasiyer', 'sef', 'guvenlik', 'muzisyen', 'hostes', 'barista', 'mudur', 'vale', 'kurye'];
const NOKTA = [['bufe-onu', 0.2, -6], ['mutfak-vitrin', -6, -10], ['uzak-karsi-yaka', -30, 45]];
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0; };
const r2 = v => Math.round(v * 100) / 100;
const T0 = Date.now(), zaman = (t) => console.log(`  [${Math.round((Date.now() - T0) / 1000)} sn] ${t}`);
const sonuc = { etiket: ETIKET, kare: KARE, asamalar: {} };

for (const asama of ASAMALAR) {
  const p = await (await b.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  const hata = []; p.on('pageerror', e => hata.push(String(e).slice(0, 160)));
  await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=${asama}`, { timeout: 120000 });
  await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 }); zaman('sayfa hazır, aşama ' + asama);
  await p.evaluate(() => { const M = window.__marti; M.play('sabri'); M.renderFrames(2, 0.1); });
  await kulisKapat(p, 'Olcum');   // ad boşsa panel kapanmaz (sim duraklı kalır)
  // tam kadro: açık her rolün bütün kadroları iş panosundan işe alınır (para yetsin diye kasa doldurulur)
  const kadro = await p.evaluate((ROLLER) => {
    const M = window.__marti, S = M.S; M.simCmd('money', 9e9); M.simCmd('level', 40);
    for (const k of ['doner', 'cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'masa1', 'gazoz', 'masa2', 'tost']) M.simCmd('unlock', k);
    const say = {};
    for (const role of ROLLER) for (let g = 0; g < 12; g++) {
      let ok = false;
      M.simCmd('cmd', { kind: 'openJobBoard' });
      for (let i = 0; i < 80 && !ok; i++) {
        const c = (S.jobCards || []).find(x => x.role === role);
        if (c) { const n = S.workers.length; M.simCmd('money', c.price); M.simCmd('cmd', { kind: 'hireCandidate', id: c.id }); ok = S.workers.length > n; if (ok) say[role] = (say[role] || 0) + 1; }
        if (!ok) { M.simCmd('money', 1000); M.simCmd('cmd', { kind: 'refreshBoard' }); }
      }
      M.simCmd('cmd', { kind: 'closeJobBoard' });
      if (!ok) break;
    }
    return { say, toplam: S.workers.length, stage: S.stage };
  }, ROLLER);
  zaman('kadro: ' + JSON.stringify(kadro.say));
  await p.evaluate(() => { const M = window.__marti; M.step(240); for (let k = 0; k < 6; k++) M.renderFrames(2, 0.1); });   // 4 dk oyun: müşteriler ve çalışanlar sahnede
  zaman('240 sn sim bitti');
  const noktalar = {};
  for (const [ad, x, z] of NOKTA) {
    if (ad === 'uzak-karsi-yaka' && asama !== 10) continue;
    if (!NOKTA_SEC.includes(ad)) continue;
    if (ad !== 'bufe-onu') await p.evaluate(([x, z]) => { const M = window.__marti; M.teleport(x, z); }, [x, z]);
    zaman('nokta ' + ad + ': ısınma');
    for (let k = 0; k < 6; k++) await p.evaluate(() => { const M = window.__marti; for (let j = 0; j < 4; j++) M.renderFrames(1, 0.1); });
    zaman('nokta ' + ad + ': ölçüm');
    const o = await p.evaluate(async (KARE) => {
      const M = window.__marti, cv = document.getElementById('c'), gl = cv.getContext('webgl2') || cv.getContext('webgl');
      M.perfRecord(true);
      for (let k = 0; k < 6; k++) { M.step(1 / 30); M.renderFrames(1, 1 / 30); gl && gl.finish(); }   // ısınma
      M.perfGuard(true);
      const sim = [], js = [], ras = [], cpu = [], tot = [];
      for (let k = 0; k < KARE; k++) {
        const t0 = performance.now(); M.step(1 / 30); const t1 = performance.now(); M.renderFrames(1, 1 / 30); const t2 = performance.now(); gl && gl.finish(); const t3 = performance.now();
        sim.push(t1 - t0); js.push(t2 - t1); ras.push(t3 - t2); cpu.push(t2 - t0); tot.push(t3 - t0);
      }
      const guard = M.perfGuard(true), i = M.info(), rt = M.rules.rt;
      const sayim = {};
      for (const a of rt.agents.registry.list) sayim[a.kind] = (sayim[a.kind] || 0) + 1;
      M.perfRecord(false);
      return { sim, js, ras, cpu, tot, guard, calls: i.calls, tris: i.tris, geos: i.geos, particles: i.particles, heapMB: i.heapMB, counters: i.counters, musteri: rt.customers.length, aktor: rt.agents.registry.list.length, aktorKind: sayim, calisan: M.S.workers.length };
    }, KARE);
    const ozet = a => ({ p50: r2(q(a, 0.5)), p95: r2(q(a, 0.95)), maks: r2(Math.max(...a)), ort: r2(a.reduce((s, v) => s + v, 0) / a.length) });
    const guard = Object.entries(o.guard).map(([k, v]) => [k, { ortMs: v.ms, maksMs: v.max, n: v.n }]).sort((a, c) => c[1].ortMs - a[1].ortMs).slice(0, 14);
    noktalar[ad] = { simAdimiMs: ozet(o.sim), jsRenderMs: ozet(o.js), cpuKareMs: ozet(o.cpu), swiftShaderRasterMs: ozet(o.ras), swiftShaderToplamKareMs: ozet(o.tot), calls: o.calls, tris: o.tris, geos: o.geos, parcacik: o.particles, heapMB: o.heapMB, calisan: o.calisan, musteri: o.musteri, aktorToplam: o.aktor, aktorTur: o.aktorKind, sayac: { 'crowd.visible': o.counters?.['crowd.visible'], frameWorkMs: o.counters?.frameWorkMs }, enPahaliGuardMs: Object.fromEntries(guard) };
    console.log(`aşama ${asama} ${ad.padEnd(16)} sim p50/p95 ${noktalar[ad].simAdimiMs.p50}/${noktalar[ad].simAdimiMs.p95}  jsRender ${noktalar[ad].jsRenderMs.p50}/${noktalar[ad].jsRenderMs.p95}  cpuKare ${noktalar[ad].cpuKareMs.p50}/${noktalar[ad].cpuKareMs.p95}  swiftshader-toplam ${noktalar[ad].swiftShaderToplamKareMs.p50}/${noktalar[ad].swiftShaderToplamKareMs.p95} ms  calls ${o.calls} tris ${o.tris} aktor ${o.aktor} musteri ${o.musteri} calisan ${o.calisan}`);
  }
  sonuc.asamalar[asama] = { kadro, noktalar, hata };
  await p.context().close();
}
await b.close(); srv.close();
if (JSON_YOL) { mkdirSync(dirname(resolve(JSON_YOL)), { recursive: true }); writeFileSync(resolve(JSON_YOL), JSON.stringify(sonuc, null, 1) + '\n'); console.log('yazıldı:', JSON_YOL); }
process.exit(0);
