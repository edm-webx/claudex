// Restoran gözlemci botu (2026-11-21): oyunu bir kez açar, aşama aşama (setStage) canlı sim'i ilerletir, her aşamada aynı açılardan
// ekran görüntüsü alır ve gözlem yazar: masada / sırada müşteri, mutfak personelinin hâli, pass'lardaki tabak, salon pass'ından alınan
// tabak, mutfak/koridor içine giren müşteri (olmamalı).  DIST=dist STAGES=1,2,...,10 node tests/browser/restoran-tur.mjs <çıktı> [spot,...]
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const STAGES = (process.env.STAGES || '1,2,3,4,5,6,7,8,9,10').split(',').map(Number);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=${STAGES[0]}`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
await kulisKapat(p, 'Gozlem');
await p.evaluate(() => { const M = window.__marti; try { M.command({ kind: 'esnafim', op: 'done' }); } catch {} M.step(1); M.skipCeremony?.(); M.collectWelcome?.(); M.setTime(13); M.step(2); M.izgara(false); M.simCmd('money', 9e9); M.simCmd('level', 40); M.simCmd('unlock', 'isbul'); M.closeJobBoard?.(); M.closePanel?.();
  const st = document.createElement('style'); st.textContent = '#sbui{visibility:hidden!important}'; document.head.appendChild(st); });
// [hero x, z, cam x, z, zoomRaw, yaw (×π/2), tilt]
const SPOTS = {
  genel: [0, 2, 0, -8, 4.2, 0, 0.95], arka: [0, -9, 0, -14, 3.0, 0, 1.15], bufeOn: [0, -2, 0, -7, 1.6, 0, 0.8],
  mutfak: [0, -14.6, 0, -15, 1.25, 0, 1.05], salonW: [-17.6, -12.0, -16.4, -14.4, 1.35, 0, 1.0], salonE: [15.6, -12.0, 14.4, -14.4, 1.35, 0, 1.0],
};
const ids = (process.argv[3] || Object.keys(SPOTS).join(',')).split(',');
const rapor = [];
for (const STAGE of STAGES) {
  const g = await p.evaluate(async (STAGE) => {
    const M = window.__marti; try { M.setStage(STAGE); } catch { M.simCmd('cmd', { kind: 'setStage', stage: STAGE }); }
    M.closeJobBoard?.(); M.closePanel?.();
    for (let i = 0; i < 14; i++) { M.simCmd('hire'); M.step(0.5); }
    M.setTime(12.5); M.teleport(30, 8);
    if (!M.restoranGozlem) { M.step(150); return { gozlemYok: 1 }; } // eski dist (öncesi)
    // gözlem: 150 oyun saniyesi, saniyede bir örnek
    const s = { ornek: 0, masaMusteri: 0, siraMusteri: 0, oturan: 0, kuyrukOrt: 0, biletMax: 0, mutfakIs: 0, mutfakBos: 0, asciDizi: 0, garsonSalonPass: 0, passTabak: { on: 0, W: 0, E: 0 }, musteriPersonelAlaninda: 0, ihlalYer: [], roller: {} };
    const K = { x0: -8.55, x1: 8.55, z0: -17.4, z1: -13.0 }, KOR = [{ x0: -12.2, x1: -6.9, z0: -16.95, z1: -15.45 }, { x0: 6.9, x1: 9.6, z0: -16.95, z1: -15.45 }];
    const inR = (q, r) => q.x > r.x0 && q.x < r.x1 && q.z > r.z0 && q.z < r.z1;
    const WP = { x: -12.9, z: -16.4 }, EP = { x: 10.3, z: -16.4 };
    for (let k = 0; k < 150; k++) {
      M.step(1); const o = M.restoranGozlem(); s.ornek++;
      const yeni = o.cust.filter(c => c.s !== 'leave'); s.masaMusteri += yeni.filter(c => c.k === 'masa').length; s.siraMusteri += yeni.filter(c => c.k !== 'masa' && c.k !== 'win').length;
      s.oturan += yeni.filter(c => c.t >= 0).length; s.kuyrukOrt += o.q; s.biletMax = Math.max(s.biletMax, o.bilet);
      for (const c of yeni) if (Math.abs(c.x + 11.65) > 0.5 && Math.abs(c.x - 9.05) > 0.5 && (inR(c, K) || KOR.some(r => inR(c, r)))) { s.musteriPersonelAlaninda++; if (s.ihlalYer.length < 8) s.ihlalYer.push([c.x, c.z, c.k, c.s]); }
      for (const w of o.w) { s.roller[w.r] = (s.roller[w.r] || 0) + 1;
        if (['asci', 'komi', 'sef', 'barista'].includes(w.r)) { if (/kIdle|kBack|kArrive/.test(w.s)) s.mutfakBos++; else s.mutfakIs++; }
        if (w.r === 'garson' && (Math.hypot(w.x - WP.x, w.z - WP.z) < 0.6 || Math.hypot(w.x - EP.x, w.z - EP.z) < 0.6)) s.garsonSalonPass++; }
      const as = o.w.filter(w => w.r === 'asci' && /kIdle/.test(w.s)); if (as.length >= 3 && as.every(w => Math.abs(w.z - as[0].z) < 0.2) && Math.max(...as.map(w => w.x)) - Math.min(...as.map(w => w.x)) < 2.2 * as.length) s.asciDizi++;
      if (o.passYer) for (const y of ['on', 'W', 'E']) s.passTabak[y] += o.passYer[y].length;
    }
    s.kuyrukOrt = +(s.kuyrukOrt / s.ornek).toFixed(2); s.masaPay = +(s.masaMusteri / Math.max(1, s.masaMusteri + s.siraMusteri)).toFixed(2);
    for (const k of Object.keys(s.roller)) s.roller[k] = Math.round(s.roller[k] / s.ornek);
    return s;
  }, STAGE);
  for (const id of ids.filter(i => SPOTS[i])) {
    const s = SPOTS[id]; const [x, z, cx, cz, zr, yi, tilt] = s;
    await p.evaluate(([x, z, cx, cz, zr, yi, tilt]) => { const M = window.__marti; M.setTime(13); M.closePanel?.(); M.teleport(x, z); for (let k = 0; k < 6; k++) { M.step(0.4); M.renderFrames(3, 0.1); } M.camera({ x: cx, z: cz, zoomRaw: zr, yaw: yi * Math.PI / 2, tilt }); for (let k = 0; k < 4; k++) M.renderFrames(3, 0.1); }, [x, z, cx, cz, zr, yi, tilt]);
    await p.waitForTimeout(200); await p.screenshot({ path: join(out, `${String(STAGE).padStart(2, '0')}-${id}.png`), timeout: 300000 });
  }
  rapor.push({ STAGE, ...g }); console.log('ok', STAGE, JSON.stringify(g));
}
writeFileSync(join(out, 'gozlem.json'), JSON.stringify({ rapor, hatalar: errs }, null, 1));
await b.close(); srv.close(); process.exit(0);
