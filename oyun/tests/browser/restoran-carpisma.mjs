// Restoran çarpışma botu (2026-11-22): aşama 10, tüm salon eşyaları + mutfak istasyonları alınmış; her eşyaya 4 yönden 1.5 s itilir,
// kahraman merkezi eşyanın içine girerse "hits"e yazar; ajan yürüme ızgarası (grid) ve path örnekleri de denetlenir.
// npx vite build && node tests/browser/restoran-carpisma.mjs <çıktı>
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const STAGES = [Number(process.env.BOT_ST || 10)];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=${STAGES[0]}`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: Number(process.env.READY_MS || 120000) });   // yüklü makinede READY_MS=540000
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { const ad = await p.$('input[name="ad"]'); if (ad) await ad.fill('Gozlem'); await go.click({ force: true }); await p.waitForFunction(() => !document.querySelector('.kl-go'), null, { timeout: 20000 }).catch(() => {}); }
await p.evaluate(() => { const M = window.__marti; try { M.command({ kind: 'esnafim', op: 'done' }); } catch {} M.step(1); M.skipCeremony?.(); M.collectWelcome?.(); M.setTime(13); M.step(2); M.izgara(false); M.simCmd('money', 9e9); M.simCmd('level', 40); M.simCmd('unlock', 'isbul'); M.closeJobBoard?.(); M.closePanel?.();
  const st = document.createElement('style'); st.textContent = '#sbui{visibility:hidden!important}'; document.head.appendChild(st); });
const BOT_ST = Number(process.env.BOT_ST || 10);
// iç mekân hedefleri aşama 10 odaları; park + büfe (restoranın ön salonu) hedefleri aşama 5 / 6+ yerleşimi (layout.ts parkEngel, kioskObstacles)
const H = [...(BOT_ST >= 10 ? JSON.parse(readFileSync(new URL('./restoran-carpisma-hedef.json', import.meta.url), 'utf8')) : []),
  ...JSON.parse(readFileSync(new URL('./restoran-carpisma-park.json', import.meta.url), 'utf8')).filter(r => r.st === (BOT_ST >= 6 ? 6 : 5) && r.k !== 'garden')];
const res = await p.evaluate(async ([H, ST]) => {
  const M = window.__marti; M.setStage(ST); M.step(1); M.renderFrames(3, 0.1);
  M.simCmd('money', 9e9); for (const e of ['semaver_dev','tas_firin','gozleme','bal_kaymak','buz_tezgah','mangal_e','akvaryum_e','meze_dolap','piyano_s','sarkuteri']) M.command({ kind: 'mulk', op: 'salonEsya', e }); M.step(1); M.renderFrames(3, 0.1);
  const pos = () => { return M.state().pos; };
  const run = (ix, iz, sec) => { M.input(ix, iz); for (let t = 0; t < sec; t += 1 / 30) M.step(1 / 30); M.input(0, 0); M.step(0.1); };
  // kalibrasyon: açık zeminde
  const CS = H.__cal || [0, -8]; M.teleport(CS[0], CS[1]); M.step(0.2); const p0 = { ...pos() }; run(1, 0, 0.4); const p1 = { ...pos() };
  M.teleport(CS[0], CS[1]); M.step(0.2); run(0, 1, 0.4); const p2 = { ...pos() };
  const a = [p1.x - p0.x, p1.z - p0.z], c = [p2.x - p0.x, p2.z - p0.z];
  const det = a[0] * c[1] - a[1] * c[0];
  const toIn = (wx, wz) => { const i = (wx * c[1] - wz * c[0]) / det, j = (a[0] * wz - a[1] * wx) / det; const m = Math.hypot(i, j) || 1; return [i / m, j / m]; };
  const out = { cal: { p0, a, c }, hits: [], skip: 0, ok: 0, zones: Object.keys(M.state()) };
  for (const r of H) {
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const sides = [[r.x0 - 0.9, cz], [r.x1 + 0.9, cz], [cx, r.z0 - 0.9], [cx, r.z1 + 0.9]];
    for (const [sx, sz] of sides) {
      M.teleport(sx, sz); M.step(0.1); const q = pos();
      if (Math.hypot(q.x - sx, q.z - sz) > 0.15) { out.skip++; continue; }
      const dd = Math.hypot(cx - sx, cz - sz), ix = (cx - sx) / dd, iz = (cz - sz) / dd; M.input(ix, iz);
      let worst = null, best = 9;
      for (let t = 0; t < 1.5; t += 1 / 30) { M.step(1 / 30); const w = pos(); best = Math.min(best, Math.max(r.x0 - w.x, w.x - r.x1, r.z0 - w.z, w.z - r.z1)); if (w.x > r.x0 && w.x < r.x1 && w.z > r.z0 && w.z < r.z1) { worst = { x: +w.x.toFixed(2), z: +w.z.toFixed(2) }; break; } }
      M.input(0, 0); M.step(0.05);
      if (worst) out.hits.push({ oda: r.oda, k: r.k, from: [sx, sz], at: worst }); else { out.ok++; (out.gap ||= []).push(+best.toFixed(2)); if (best > 0.6) (out.far ||= []).push({ k: r.k, from: [sx, sz], best: +best.toFixed(2) }); }
    }
  }
  out.gridOpen = [];
  for (const r of H) { const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2; const g = M.grid('iskele', cx, cx, cz, cz); if (!g || !g.includes('#')) out.gridOpen.push({ k: r.k, oda: r.oda, g }); }
  out.pathHits = []; let np = 0;
  const pts = [[-16, -11], [-20, -12], [-12, -12], [16, -11], [20, -12], [12, -12], [0, -14.5], [-6, -15], [6, -15], [0, -9], [-18, -14], [18, -14], [0, 2.4], [-3.2, 1.6], [3.2, -2], [0, -3.4], [0, 6.5], [-6, 6.5], [6, -8]];
  for (const a of pts) for (const b2 of pts) { if (a === b2) continue; const pth = M.path({ x: a[0], z: a[1] }, { x: b2[0], z: b2[1] }); np++;
    for (let i = 1; i < pth.length; i++) { const A = pth[i - 1], B = pth[i]; for (let t = 0; t <= 1; t += 0.1) { const x = A.x + (B.x - A.x) * t, z = A.z + (B.z - A.z) * t; const r = H.find(r => x > r.x0 + 0.12 && x < r.x1 - 0.12 && z > r.z0 + 0.12 && z < r.z1 - 0.12); if (r && Math.hypot(x - b2[0], z - b2[1]) > 1.2 && Math.hypot(x - a[0], z - a[1]) > 1.2) { out.pathHits.push({ k: r.k, a, b: b2, x: +x.toFixed(2), z: +z.toFixed(2) }); t = 2; i = 1e9; } } } }
  out.np = np;
  return out;
}, [H, BOT_ST]);
console.log(JSON.stringify(res, null, 1)); console.log('errs', errs.slice(0, 5));
await b.close(); srv.close();
