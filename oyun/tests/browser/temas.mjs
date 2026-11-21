// PRF-09/10 temas çekimleri: üst geçit merdiveni (alçak ve yüksek kamera, yukarı yürürken), otobüs durağı, otoyol.
// node tests/browser/temas.mjs <dist-klasörü> <çıktı-klasörü> [önek]
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, resolve, extname } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const DIST = resolve(process.argv[2] || 'dist'), out = resolve(process.argv[3] || 'temas-shots'), pre = process.argv[4] || ''; mkdirSync(out, { recursive: true });
const types = { '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.json': 'application/json', '.webp': 'image/webp' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1024, height: 576 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { const ad = await p.$('input[name="ad"]'); if (ad) await ad.fill('Olcum'); await go.click({ force: true }); await p.waitForTimeout(700); }
await p.evaluate(() => { const M = window.__marti; M.command({ kind: 'esnafim', op: 'done' }); M.setTime(13); M.step(2); M.renderFrames(40, 0.1); });   // intro descent ends before the first shot
await p.addStyleTag({ content: 'body > *:not(#app), #app > *:not(canvas){display:none!important}' });
const shot = async (name) => { await p.screenshot({ path: join(out, pre + name + '.png'), timeout: 540000 }); console.log('çekildi', pre + name); };
// hero walks up the south flight; stop mid-flight, frame from low (side) and high
const stairs = async (z, yaw, tilt, zr, name) => {
  await p.evaluate(([z, yaw, tilt, zr]) => { const M = window.__marti; M.teleport(24, 7.4); M.camera({ yaw: 0, zoomRaw: 1 }); M.input(0, 1); for (let i = 0; i < 80; i++) { M.step(1 / 30); if (M.state().pos.z >= z) break; } M.input(null); M.step(0.2); M.camera({ yaw, zoomRaw: zr }); if (tilt) M.camera({ tilt }); M.renderFrames(12, 0.1); }, [z, yaw, tilt, zr]);
  await shot(name);
  await p.evaluate(() => window.__marti.camera({ tilt: -2 }));
};
const all = process.env.TEMAS !== 'near';
if (all) {
await stairs(11.3, 1.35, -0.75, 0.42, 'merdiven-alcak');
await stairs(12.6, 1.0, 0, 0.55, 'merdiven-yuksek');
await stairs(14.0, -0.5, -0.4, 0.5, 'merdiven-ust');
// bus stop and the motorway from the promenade, low angle (where the owner saw ghosting)
await p.evaluate(() => { const M = window.__marti; M.teleport(-20, 12); M.camera({ yaw: 0.2, zoomRaw: 0.75, tilt: -0.6 }); M.renderFrames(12, 0.1); });
await shot('otobus-duragi');
await p.evaluate(() => { const M = window.__marti; M.camera({ tilt: -2 }); M.teleport(10, 12.5); M.camera({ yaw: -0.4, zoomRaw: 1.4, tilt: -0.7 }); M.renderFrames(12, 0.1); });
await shot('otoyol-alcak');
await p.evaluate(() => { const M = window.__marti; M.camera({ tilt: 2 }); M.renderFrames(12, 0.1); });
await shot('otoyol-ust');
}
// near A/B (needs the measurement build: vite --mode olcum): the same frame with near 0.1 and with the automatic near
const hasNear = await p.evaluate(() => typeof window.__marti.kameraNear === 'function');
if (hasNear) {
  const { PNG } = require('pngjs'); const pixelmatch = (await import('pixelmatch')).default;
  for (const [name, setup] of [['karsi-uzak', [-6, 12, 3.14, 2.1, -0.75]], ['otoyol-uzak', [10, 12.5, -0.4, 2.1, -0.7]]]) {
    await p.evaluate(([x, z, yaw, zr, tilt]) => { const M = window.__marti; M.camera({ tilt: -2 }); M.teleport(x, z); M.camera({ yaw, zoomRaw: zr }); M.camera({ tilt }); M.renderFrames(12, 0.1); M.renderFrames(2, 1e-6); }, setup);
    const shots = [];
    for (const n of [0.1, null]) {
      const near = await p.evaluate(n => { const M = window.__marti; M.kameraNear(n); M.renderFrames(2, 1e-6); return M.heroPoz().near; }, n);
      const f = join(out, `${pre}${name}-near-${n === null ? 'oto' : '0.1'}.png`); await p.screenshot({ path: f, timeout: 540000 }); shots.push([f, near]);
    }
    const A = PNG.sync.read(readFileSync(shots[0][0])), B = PNG.sync.read(readFileSync(shots[1][0])), D = new PNG({ width: A.width, height: A.height });
    const n = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: 0.1 });
    (await import('node:fs')).writeFileSync(join(out, `${pre}${name}-near-fark.png`), PNG.sync.write(D));
    console.log(`${name}: near ${shots[0][1]} -> ${shots[1][1]}, farklı piksel ${n} (%${(100 * n / (A.width * A.height)).toFixed(2)})`);
  }
}
if (errs.length) console.log('hatalar', errs.slice(0, 5));
await b.close(); srv.close();
