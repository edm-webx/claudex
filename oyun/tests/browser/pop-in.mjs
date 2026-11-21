// PRF-07: bölge pop-in kaydı. node tests/browser/pop-in.mjs   (DIST=klasör, TIER=dengeli, ADIM=1 m, KARE=1, X0=20, X1=110, W/H=640x360)
// Kahraman iskeleden (x 20) doğuya çarşı sokağına (x 110) ve geri yürütülür (ADIM metrede bir ışınlanma + KARE kare çizim),
// üç kamerayla: varsayılan, en uzak yakınlaştırma (x2.1) ve yatık bakış (eğim -0.55). Her karede bölge akışı kameranın
// görüş kesiğiyle karar verir; ekrandayken (kesiğin içinde, sisin önünde) beliren ya da kaybolan bölge bir "pop" sayılır
// (engine/zones popStats). Aynı derlemede A/B: viewAware=false eski kural (yalnız oyuncuya uzaklık), true PRF-07.
// Not: SwiftShader yavaş olduğu için metre başına 1 kare çizilir (60 fps yürüyüşte ~15): bölge kurulumu daha az kareye sığmak
// zorunda, yani sonuç kötümser.
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist');
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: +(process.env.W || 640), height: +(process.env.H || 360) } })).newPage();
const errs = []; p.on('pageerror', e => { errs.push(String(e).slice(0, 200)); console.log('[pageerror]', String(e).slice(0, 200)); });
const t0 = Date.now(), log = s => console.log(`${String(((Date.now() - t0) / 1000).toFixed(0)).padStart(4)}s  ${s}`);
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=${process.env.TIER || 'dengeli'}&seed=3&stage=10&time=12`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 180000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { const inp = await p.$('input[name="ad"]'); if (inp) await inp.fill('Deneme'); await go.click({ force: true }); await p.waitForTimeout(500); }
log('hazır');
const ADIM = Number(process.env.ADIM || 1), KARE = Number(process.env.KARE || 1), Z = 9, X0 = Number(process.env.X0 || 20), X1 = Number(process.env.X1 || 110);
const KAMERA = { varsayilan: { zoom: 1, tilt: 0 }, uzak: { zoom: 2.1, tilt: 0 }, yatik: { zoom: 1, tilt: -0.55 } };
const rows = [];
for (const view of process.env.SADECE === 'isin' ? [] : [false, true]) {
  for (const [ad, c] of Object.entries(KAMERA)) {
    // start clean: far west, every zone but the pier dropped, then the camera for this run
    await p.evaluate(({ view, c, X0 }) => { const M = window.__marti; M.zonePop({ viewAware: view }); M.camera({ zoom: 1, tilt: 0 }); M.teleport(-40, 9); for (let i = 0; i < 30; i++) M.renderFrames(1, 1 / 30); M.camera({ zoom: c.zoom, tilt: c.tilt }); M.teleport(X0, 9); for (let i = 0; i < 20; i++) M.renderFrames(1, 1 / 30); M.zonePop({ reset: true }); }, { view, c, X0 });
    const r = await p.evaluate(({ ADIM, KARE, Z, X0, X1 }) => {
      const M = window.__marti, path = [];
      for (let x = X0; x <= X1; x += ADIM) path.push(x);
      for (let x = X1; x >= X0; x -= ADIM) path.push(x);
      const t = performance.now(); let maxState = {};
      for (const x of path) { M.teleport(x, Z); M.renderFrames(KARE, 1 / 30); const s = M.zonePop().states; for (const k in s) if (s[k] === 'warm' || s[k] === 'hot') maxState[k] = 1; }
      const st = M.zonePop({ reset: true });
      return { popIn: st.popIn, popOut: st.popOut, last: st.last, live: Object.keys(maxState), ms: performance.now() - t, steps: path.length };
    }, { ADIM, KARE, Z, X0, X1 });
    if (c.tilt) await p.evaluate(t => window.__marti.camera({ tilt: -t }), c.tilt);   // the camera hook tilts by a delta
    rows.push({ kural: view ? 'PRF-07 (görüşe göre)' : 'eski (yalnız uzaklık)', kamera: ad, ...r });
    log(`${(view ? 'PRF-07' : 'eski  ')} ${ad.padEnd(10)} pop-in=${r.popIn} pop-out=${r.popOut}  kurulan bölgeler=[${r.live.join(',')}]  ${r.last.slice(-4).join(' ')}`);
  }
}
// ışınlanma (otobüs/harita yolculuğu): varılan bölge kamera karşısındayken parça parça mı doluyor?
const DUR = { sahil: [150, 9], meydan: [262, 9], orman: [812, 9], iskele: [0, 9] };
const isin = [];
for (const [ad, [x, z]] of Object.entries(DUR)) {
  const r = await p.evaluate(([x, z]) => {
    const M = window.__marti; M.zonePop({ reset: true }); const t = performance.now(); M.teleport(x, z); M.renderFrames(1, 1 / 30); const ilk = performance.now() - t;
    let kare = 1; for (; kare < 90 && M.zone('iskele').pending > 0; kare++) M.renderFrames(1, 1 / 30);   // pending = every zone's build queue
    const st = M.zonePop({ reset: true });
    return { popIn: st.popIn, popOut: st.popOut, last: st.last, kare, ilkKareMs: +ilk.toFixed(1), kesmeMs: st.cutMs };
  }, [x, z]);
  isin.push({ ad, ...r }); log(`ışınlanma ${ad.padEnd(7)} pop-in=${r.popIn} pop-out=${r.popOut} kurulum ${r.kare} kare, ilk kare ${r.ilkKareMs} ms (bölge kurulumu ${r.kesmeMs} ms)  ${r.last.join(' ')}`);
}
const sum = k => !rows.length ? 0 : rows.filter(r => r.kural.startsWith(k)).reduce((a, r) => a + r.popIn + r.popOut, 0);
const once = sum('eski'), sonra = sum('PRF-07');
console.log(`\nTABLO: ekranda beliren/kaybolan bölge sayısı (3 kamera, iskele <-> çarşı gidiş-dönüş): önce ${once}, sonra ${sonra}`);
console.log(JSON.stringify(rows.map(({ last, ...r }) => r)));
const bad = sonra > 0 || errs.length > 0;
console.log(bad ? 'KIRMIZI: PRF-07 kuralıyla hâlâ ekranda bölge beliriyor/kayboluyor' : 'YEŞİL: ekranda pop yok');
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
