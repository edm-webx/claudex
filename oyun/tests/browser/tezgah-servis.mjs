// Uçtan uca oyuncu akışı (2026-11-21 sahip: "tepsimde bişey varken HALA tezgaha koyamıyorum"):
// yoğun gün (masalar, sıra dolu) -> oyuncu gerçek yürüme girdisiyle istasyona gider, tepsiye alır -> tezgâha yürür ->
// ürün tezgâha iner -> sıradaki müşteri alır -> öder ('sale'). Her aşamada ekran görüntüsü.
// Kullanım: npm run build:vite && node tools/build-artifact.mjs && STAGES=3,5,10 node tests/browser/tezgah-servis.mjs <çıktı klasörü>
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const out = process.argv[2] || 'tests/browser/shots-tezgah'; mkdirSync(out, { recursive: true });
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0;
for (const STAGE of (process.env.STAGES || '3,5,10').split(',').map(Number)) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3`);
  await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
  await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
  await kulisKapat(p, 'Olcum');
  await p.evaluate((STAGE) => {
    const M = window.__marti; M.command({ kind: 'esnafim', op: 'done' }); M.step(1); M.skipCeremony?.(); M.collectWelcome?.(); M.closeJobBoard?.(); M.closePanel?.();
    M.simCmd('money', 9e6); M.setStage(STAGE); M.step(1); M.setTime(11.5); for (let i = 0; i < 120; i++) M.step(1);   // yoğun öğle: sıra + masalar dolar
    window.__walk = (x, z, maxS = 20) => { let t = 0; for (; t < maxS; t += 0.1) { const s = M.state(); const dx = x - s.pos.x, dz = z - s.pos.z, d = Math.hypot(dx, dz); if (d < 0.15) break; M.input(dx / d, dz / d); M.step(0.1); } M.input(null); return M.state().pos; };
    window.__snap = () => { const s = M.state(); return { pos: s.pos, carry: (s.carry || []).map(c => c.type || c), counter: M.dbg().counter.doner, q: (s.queue || []).length, qDoner: (s.queue || []).slice(0, 3).filter(c => (c.need?.doner || 0) > 0).length }; };
  }, STAGE);
  const shot = async (name, cx, cz, zr = 0.6) => { await p.evaluate(([cx, cz, zr]) => { document.querySelectorAll('.sb-toast,.sb-ach,.sb-modal').forEach(e => e.remove()); const M = window.__marti; M.camera({ x: cx, z: cz, zoomRaw: zr }); for (let k = 0; k < 8; k++) M.renderFrames(2, 0.1); M.camera({}); }, [cx, cz, zr]); await p.screenshot({ path: join(out, `s${STAGE}-${name}.png`), timeout: 300000 }); };
  const W = (x, z) => p.evaluate(([x, z]) => window.__walk(x, z), [x, z]);
  const snap = () => p.evaluate(() => window.__snap());
  // içeri gir, döner istasyonu, tepsiye al
  await W(-3.3, -3.9); await W(-3.3, -5.4); await W(-2.75, -9.18);
  await p.evaluate(() => window.__marti.step(6));
  const s1 = await snap(); await shot('1-tepside', -1.5, -7.5);
  // tezgâha yürü (sadece giriş: ışınlanma yok)
  const ev0 = await p.evaluate(() => { const e = window.__marti.events(); return e.length ? e[e.length - 1].tick : 0; });
  await W(-0.25, -5.45);
  await p.evaluate(() => window.__marti.step(1.5));
  const s2 = await snap(); await shot('2-tezgahta', -0.4, -5.0, 0.5);
  await p.evaluate(() => window.__marti.step(8));
  const s3 = await snap();
  const sales = await p.evaluate((ev0) => window.__marti.events().filter(e => e.tick > ev0 && e.name === 'sale' && e.data?.kind === 'q').length, ev0);
  await shot('3-musteri-aldi', -0.4, -4.6, 0.6);
  const dropped = s1.carry.filter(c => c === 'doner').length - Math.min(...[s2, s3].map(s => s.carry.filter(c => c === 'doner').length));
  const ok = s1.carry.includes('doner') && dropped > 0 && sales > 0;
  console.log(`aşama ${STAGE}: ${ok ? 'GEÇTİ' : 'KALDI'} | tepside ${s1.carry.length} döner, tezgâha inen ${dropped}, sırada döner isteyen ${s1.qDoner}, kuyruktan satış ${sales}, son tepsi [${s3.carry}]`);
  if (!ok) fail++;
  await p.close();
}
await b.close(); srv.close(); process.exit(fail ? 1 : 0);
