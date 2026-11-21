// Gezgin gözlemci bot (DNY-14): dünyayı, ormanı, karşı yakayı ve sokak vatandaşlarını gerçek tarayıcıda (SwiftShader) gezer.
// Hero gerçek nav yoluyla yürür; her durakta/saatte SoA ajanları örneklenir (gozlem-lib.mjs ornekleyici): ışınlanma, takılı, solid içi,
// T-pose, NaN; ayrıca konsol/sayfa hatası, hero ışınlanması/duvara yapışma, boş bölge, ajan sızıntısı, çizim çağrısı/üçgen/kare süresi baseline.
// Yalnız bulguları listeler; oyunu düzeltmez. Kullanım: node tests/browser/gozlem.mjs [--hizli] [--sina] [--baseline-yaz] [--cikti DOSYA]
//   SKIP_BUILD=1 ile dist yeniden kullanılır. --sina: kasıtlı bozuk fixture (vatandaş solid içine ışınlanır), bot yakalamalı.
// Çıktı: calisma/gozlem-rapor.json (+ tests/browser/shots-gezgin/gozlem/*.png). Baseline: calisma/gozlem-baseline.json.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ornekleyici, ESIK, raporKur, raporuDogrula, sizintiVar, baselineKarsilastir } from './gozlem-lib.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const A = process.argv.slice(2), al = (k, v) => { const i = A.indexOf(k); return i >= 0 ? (A[i + 1] ?? true) : v; }, var_ = k => A.includes(k);
const HIZLI = var_('--hizli'), SINA = var_('--sina');
const RAPOR = resolve(al('--cikti', join(KOK, 'calisma/gozlem-rapor.json'))), BASE = join(KOK, 'calisma/gozlem-baseline.json');
const DIST = join(KOK, 'dist'), OUT = join(KOK, 'tests/browser/shots-gezgin/gozlem'); mkdirSync(OUT, { recursive: true }); mkdirSync(dirname(RAPOR), { recursive: true });
if (!process.env.SKIP_BUILD) execSync('npx vite build && node tools/build-artifact.mjs', { stdio: 'inherit', cwd: KOK });

const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.glb': 'model/gltf-binary', '.webp': 'image/webp' };
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/' || p === '/index.html') { res.writeHead(200, { 'content-type': types['.html'] }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/`;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();

const rapor = raporKur(); rapor.mod = SINA ? 'sina' : HIZLI ? 'hizli' : 'tam';
const bulgu = (sev, tur, yer, ne, ek) => { rapor.bulgular.push({ sev, tur, yer, ne, ...ek }); console.log(`[${sev}] ${tur} @ ${yer}: ${ne}`); };
p.on('pageerror', e => bulgu('bug', 'sayfa-hatasi', 'sayfa', e.message));
p.on('console', m => { if (m.type() === 'error' && !/supabase|Failed to load resource|ERR_|favicon/.test(m.text())) bulgu('bug', 'konsol-hatasi', 'sayfa', m.text().slice(0, 240)); });
const ev = (f, a) => p.evaluate(f, a);
const snap = async ad => { try { await p.screenshot({ path: join(OUT, ad + '.png'), timeout: 90000 }); return true; } catch { return false; } };

await p.goto(`${url}?fresh=1&noloop&tier=dengeli&seed=3&qa=1&stage=10`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
await ev(() => window.__marti.play('sabri')); await ev(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 10000 }).catch(() => null); if (go) { const inp = await p.$('input[name="ad"]'); if (inp) await inp.fill('Deneme'); await go.click({ force: true }); await p.waitForTimeout(700); }
if (await ev(() => { const M = window.__marti; if (M.state().pauseWhy === 'esnafim') { M.command({ kind: 'esnafim', op: 'done' }); M.step(1); } return M.state().paused; })) console.log('uyarı: sim duraklı: ' + await ev(() => window.__marti.state().pauseWhy));
await ev(() => { const M = window.__marti; M.setTime(13); M.step(2); M.perfRecord?.(true); });
// örnekleyiciyi sayfaya enjekte et (toString ile)
await ev(([src, esik]) => { const fn = (0, eval)('(' + src + ')'); window.__gozlem = fn(window.__marti, esik); }, [ornekleyici.toString(), ESIK]);

// Bölgeler: alan (ışınlanma noktası), hedef (hero oraya yürür), yarıçap (boş bölge ölçümü), beklenenKalabalik (boşsa uyarı)
const BOLGELER = [
  { ad: 'iskele', x: 0, z: 0, hedef: [10, 4], kal: true }, { ad: 'iskele-ferry', x: -6, z: 4, hedef: [-14, 6], kal: true },
  { ad: 'sokak-carsi', x: 0, z: 25, hedef: [20, 27], kal: true }, { ad: 'karsi-okul', x: 49, z: 41, hedef: [40, 41], kal: true },
  { ad: 'karsi-meydan', x: 28, z: 41, hedef: [16, 41], kal: true }, { ad: 'karsi-halisaha', x: -50, z: 45, hedef: [-40, 45], kal: false },
  { ad: 'karsi-morg', x: 57, z: 60, hedef: [50, 60], kal: false }, { ad: 'stadyum-kapi', x: 404, z: 13, hedef: [412, 16], kal: false },
  { ad: 'stadyum-saha', x: 425, z: 20, hedef: [432, 22], kal: false }, { ad: 'orman-durak', x: 806, z: 10, hedef: [814, 14], kal: false },
  { ad: 'orman-orta', x: 840, z: 20, hedef: [848, 24], kal: false }, { ad: 'orman-derin', x: 870, z: 40, hedef: [878, 44], kal: false },
];
const SAATLER = SINA ? [13] : HIZLI ? [13] : [9, 13, 18, 22, 2];
const liste = SINA ? BOLGELER.slice(0, 1) : HIZLI ? BOLGELER.filter((_, i) => [0, 3, 9].includes(i)) : BOLGELER;
const YURU_SN = HIZLI ? 6 : 12, DT = 0.25;

/** Hero'yu gerçek nav yoluyla hedefe yürütür; her adımda ajanları örnekler. Hero ışınlanması ve duvara yapışma burada izlenir. */
async function gez(yer, hx, hz, sn) {
  return ev(([hx, hz, sn, dt, yer, esik]) => {
    const M = window.__marti, G = window.__gozlem, out = { adim: 0, yol: 0, isinlanma: null, takildi: false, vardi: false, bitis: null };
    let son = M.state().pos, durgun = 0;
    for (let t = 0; t < sn / dt; t++) {
      const pos = M.state().pos, yol = M.path(pos, { x: hx, z: hz });
      if (Math.hypot(hx - pos.x, hz - pos.z) < 1.2) { out.vardi = true; break; }
      const w = yol.find(q => Math.hypot(q.x - pos.x, q.z - pos.z) > 0.6) || { x: hx, z: hz };
      const dx = w.x - pos.x, dz = w.z - pos.z, n = Math.hypot(dx, dz) || 1;
      M.input(dx / n, dz / n); M.step(dt); M.input(null);
      if (window.__sinaP) { const A = M.rules.agents, k = window.__sinaP; A.f32('x')[window.__sinaSlot] = k.x; A.f32('z')[window.__sinaSlot] = k.z; }   // --sina fixture
      G.ornekle(dt, { yer });
      const c = M.state().pos, d = Math.hypot(c.x - son.x, c.z - son.z);
      if (!Number.isFinite(c.x) || !Number.isFinite(c.z)) { out.nan = true; break; }
      if (d > esik.ziplama) { out.isinlanma = { mesafe: +d.toFixed(2), from: son, to: c }; }
      if (d < 0.02) { if (++durgun >= 8) { out.takildi = true; break; } } else durgun = 0;
      out.yol += d; son = c; out.adim++;
    }
    out.bitis = M.state().pos; return out;
  }, [hx, hz, sn, DT, yer, ESIK]);
}

const kayit = []; let sonOlay = 0;
const yeniOlaylar = async (yer, saat) => {
  const o = await ev(() => window.__gozlem.olay.map(q => ({ ...q })));
  for (const q of o.slice(sonOlay)) { const { tur, ...ek } = q; bulgu(tur === 'tpose' || tur === 'isinlanma' || tur === 'solidIcinde' || tur === 'nan' ? 'bug' : 'warn', 'ajan-' + tur, `${yer} ${saat}:00`, `slot ${q.slot} (${q.tur})`, ek); }
  sonOlay = o.length;
};
// kasıtlı bozuk fixture: ilk canlı vatandaşı solid içine ışınlar
if (SINA) await ev(() => { const M = window.__marti, A = M.rules.agents, nav = M.rules.nav; M.step(3); const x = A.f32('x'), z = A.f32('z'), fl = A.u16('flags');
  let i = 0; for (; i < A.hi; i++) if (A.alive(i) && (fl[i] & 1) && !(fl[i] & 32)) break;
  // en yakın yürünemez nokta: büfe duvarı içi aranır
  for (let tx = -30; tx < 30; tx += 0.5) for (let tz = -30; tz < 30; tz += 0.5) if (!nav.walkable({ x: tx, z: tz })) { window.__sinaSlot = i; window.__sinaP = { x: tx, z: tz }; tx = 99; break; }
  const k = window.__sinaP; if (k) { M.teleport(k.x + 3, k.z); x[i] = k.x; z[i] = k.z; } });

for (const bl of liste) {
  for (const saat of SAATLER) {
    const yer = bl.ad;
    await ev(([x, z, s]) => { const M = window.__marti; M.setTime(s); M.teleport(x, z); M.step(2); M.renderFrames(6, 0.1); }, [bl.x, bl.z, saat]);
    await ev(() => { const M = window.__marti; M.step(1); M.renderFrames(30, 0.1); });   // bölge akışı
    await ev(() => window.__gozlem.sifirla());
    const g = await gez(yer, bl.hedef[0], bl.hedef[1], YURU_SN);
    if (g.nan) bulgu('bug', 'nan-konum', `${yer} ${saat}:00`, 'hero konumu NaN');
    if (g.isinlanma) bulgu('bug', 'hero-isinlanma', `${yer} ${saat}:00`, `yürürken bir adımda ${g.isinlanma.mesafe} m`, g.isinlanma);
    if (g.takildi) bulgu('warn', 'duvara-yapisma', `${yer} ${saat}:00`, `nav yolu üstünde ilerlenemedi, konum ${g.bitis.x.toFixed(1)},${g.bitis.z.toFixed(1)}`);
    if (!g.vardi && !g.takildi && g.yol < 1) bulgu('warn', 'yuruyemedi', `${yer} ${saat}:00`, 'hero hedefe hiç ilerlemedi');
    await yeniOlaylar(yer, saat);
    // ölçüm: çizim, üçgen, kare süresi, canlı/görünür vatandaş, hero yakınında vatandaş
    await ev(() => { const M = window.__marti; M.perfRecord?.(true); M.renderFrames(12, 0.05); });
    const m = await ev(() => { const M = window.__marti, i = M.info(), A = M.rules.agents, pos = M.state().pos, x = A.f32('x'), z = A.f32('z'), fl = A.u16('flags');
      let canli = 0, gorunur = 0, yakin = 0; for (let k = 0; k < A.hi; k++) { if (!A.alive(k)) continue; canli++; if (fl[k] & 1) { gorunur++; if (Math.hypot(x[k] - pos.x, z[k] - pos.z) < 40) yakin++; } }
      return { calls: i.calls, tris: i.tris, ms: i.frameP95 ?? null, fps: i.fps, heapMB: i.heapMB ?? null, canli, gorunur, yakin, nan: !Number.isFinite(M.state().money) }; });
    if (m.nan) bulgu('bug', 'nan-para', `${yer} ${saat}:00`, 'para NaN');
    if (!(m.calls > 0)) bulgu('bug', 'cizim-yok', `${yer} ${saat}:00`, 'çizim çağrısı 0');
    if (m.tris > 1.5e6) bulgu('perf', 'ucgen-yuksek', `${yer} ${saat}:00`, 'üçgen ' + m.tris);
    const gunduz = saat >= 9 && saat <= 22;
    if (bl.kal && gunduz && m.yakin === 0) bulgu('warn', 'bos-bolge', `${yer} ${saat}:00`, 'hero çevresinde (40 m) görünür vatandaş yok');
    rapor.olcum.push({ yer, saat, calls: m.calls, tris: m.tris, ms: m.ms, fps: m.fps, heapMB: m.heapMB, canli: m.canli, gorunur: m.gorunur, yakin: m.yakin });
    kayit.push(m.canli);
    if (SAATLER.indexOf(saat) === Math.floor(SAATLER.length / 2) || SINA) { const ok = await snap(`${yer}-${saat}`); if (!ok) bulgu('info', 'goruntu-yok', yer, 'ekran görüntüsü alınamadı'); }
  }
  rapor.bolgeler.push(bl.ad);
}
// ajan sızıntısı: canlı ajan sayısı sürekli artıyor mu (bölge sırasına göre kaba seri; yalnız sürekli artış + eşik)
if (sizintiVar(kayit)) bulgu('warn', 'ajan-sizintisi', 'dunya', `canlı ajan sayısı sürekli artıyor: ${kayit.join(',')}`);
if (SINA) { const bulundu = rapor.bulgular.some(q => q.tur === 'ajan-solidIcinde'); if (!bulundu) { bulgu('bug', 'bot-sinama', 'sina', 'kasıtlı solid içi vatandaş yakalanamadı'); } else console.log('sina: kasıtlı bozukluk yakalandı'); }

// baseline karşılaştırması
const base = existsSync(BASE) ? JSON.parse(readFileSync(BASE, 'utf8')) : null;
rapor.baseline.karsilastirma = baselineKarsilastir(rapor.olcum, base);
for (const d of rapor.baseline.karsilastirma) if (d.kotu) bulgu('perf', 'baseline-kotu', `${d.yer} ${d.saat}:00`, `çizim ${(d.calls * 100).toFixed(0)}%, üçgen ${(d.tris * 100).toFixed(0)}%, ms ${d.ms == null ? '-' : (d.ms * 100).toFixed(0) + '%'} (baseline'a göre)`);
if (var_('--baseline-yaz') && !SINA) writeFileSync(BASE, JSON.stringify({ schema: rapor.schema, zaman: rapor.zaman, not: 'SwiftShader: ms yalnız göreli; calls/tris deterministik (tohum 3)', olcum: rapor.olcum }, null, 1));
rapor.ozet = { bug: rapor.bulgular.filter(x => x.sev === 'bug').length, warn: rapor.bulgular.filter(x => x.sev === 'warn').length, perf: rapor.bulgular.filter(x => x.sev === 'perf').length, bolge: rapor.bolgeler.length, saat: SAATLER };
const sema = raporuDogrula(rapor); if (sema.length) { console.error('rapor şeması hatalı', sema); }
writeFileSync(RAPOR, JSON.stringify(rapor, null, 1));
console.log(`\ngozlem(${rapor.mod}): ${rapor.bolgeler.length} bölge, bug ${rapor.ozet.bug}, uyarı ${rapor.ozet.warn}, perf ${rapor.ozet.perf} -> ${RAPOR}`);
await b.close(); srv.close(); process.exit(SINA ? (rapor.bulgular.some(q => q.tur === 'bot-sinama') ? 1 : 0) : 0);
