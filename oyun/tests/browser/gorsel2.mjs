// GRS-05/06/07/17 görsel doğrulama çekimleri (SwiftShader, DPR 1). Kullanım:
//   npx vite build --mode olcum --outDir /tmp/x && MARTI_DIST=/tmp/x node tools/build-artifact.mjs
//   node tests/browser/gorsel2.mjs <dist> <çıktı-klasörü> [senaryo,senaryo,...]
// Her çekimde ortalama parlaklık (pngjs) ve info()/gfx() özeti satır olarak yazılır; ölçüm sonuçları <çıktı>/olcum.json.
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve, extname } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const { PNG } = require('pngjs');
const DIST = resolve(process.argv[2] || 'dist'), OUT = resolve(process.argv[3] || 'shots-gorsel2'); mkdirSync(OUT, { recursive: true });
const types = { '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.json': 'application/json', '.webp': 'image/webp' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));

const SEA = { x: 2, z: -16, zoomRaw: 1.6, yaw: Math.PI, tilt: 0.12 };   // iskele ucundan karaya bakış: önde deniz, arkada büfe ve karşı yaka (tilt: en alçaktan fark)
const UFUK = { x: 0, z: -15, zoomRaw: 2.2, yaw: 0, tilt: 0 };   // iskele ucundan güneye: deniz, uzak kıyı ve gök
const KIOSK = { x: 0, z: -2, zoomRaw: 0.7, yaw: 0, tilt: 0.25 };
const DECK = { x: -2, z: -6, zoomRaw: 1.0, yaw: 0.4, tilt: 0.5 };
const FAR = { x: 0, z: -4, zoomRaw: 4, yaw: 0, tilt: 0.8 };
// [ad, kademe, saat, kamera, ek] ; ek: { refl: true|false, rain: true, stage, noao, contact }
const S = {
  'deniz-11-dengeli-kapali': ['dengeli', 11, SEA, { refl: false }], 'deniz-11-dengeli-acik': ['dengeli', 11, SEA, { refl: true }],
  'deniz-18-dengeli-kapali': ['dengeli', 18.5, SEA, { refl: false }], 'deniz-18-dengeli-acik': ['dengeli', 18.5, SEA, { refl: true }],
  'deniz-22-dengeli-kapali': ['dengeli', 22, SEA, { refl: false }], 'deniz-22-dengeli-acik': ['dengeli', 22, SEA, { refl: true }],
  'ufuk-11-kapali': ['dengeli', 11, UFUK, { refl: false }], 'ufuk-11-acik': ['dengeli', 11, UFUK, { refl: true }],
  'ufuk-18-kapali': ['dengeli', 18.5, UFUK, { refl: false }], 'ufuk-18-acik': ['dengeli', 18.5, UFUK, { refl: true }],
  'ufuk-22-kapali': ['dengeli', 22, UFUK, { refl: false }], 'ufuk-22-acik': ['dengeli', 22, UFUK, { refl: true }],
  'ufuk-18-sahane': ['sahane', 18.5, UFUK, { refl: true }], 'ufuk-18-akici': ['akici', 18.5, UFUK, {}],
  'deniz-18-sahane-acik': ['sahane', 18.5, SEA, { refl: true }], 'deniz-18-akici': ['akici', 18.5, SEA, {}],
  'yagmur-iskele': ['dengeli', 13, DECK, { rain: true }], 'kurudu-iskele': ['dengeli', 13, DECK, { dry: true }], 'kuru-iskele': ['dengeli', 13, DECK, {}], 'gece-kuru-iskele': ['dengeli', 22, DECK, {}],
  'vitrin': ['dengeli', 13, KIOSK, {}],
  'ao-dengeli': ['dengeli', 11, DECK, {}], 'ao-dengeli-kapali': ['dengeli', 11, DECK, { aoOff: true }], 'ao-akici': ['akici', 11, DECK, {}], 'ao-akici-kapali': ['akici', 11, DECK, { aoOff: true }],
  'uzak-dengeli': ['dengeli', 11, FAR, {}],
  'kademe-akici': ['akici', 11, DECK, {}], 'kademe-dengeli': ['dengeli', 11, DECK, {}], 'kademe-sahane': ['sahane', 11, DECK, {}],
  'fiskiye-13': ['dengeli', 13, { x: -3.9, z: 44, zoomRaw: 1.3, yaw: 0, tilt: 0.25 }, { tp: [-3.9, 39.5] }], 'fiskiye-21': ['dengeli', 21, { x: -3.9, z: 44, zoomRaw: 1.3, yaw: 0, tilt: 0.25 }, { tp: [-3.9, 39.5] }],
  'vitrin-s1': ['dengeli', 13, KIOSK, { stage: 1 }],
};
const want = (process.argv[4] || Object.keys(S).join(',')).split(',');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const lum = buf => { const png = PNG.sync.read(buf); let s = 0; const d = png.data; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / (d.length / 4); };
const pages = new Map(), res = {};
async function page(tier, extra) {
  const key = tier + (extra.noao ? '-noao' : '') + (extra.stage ? '-s' + extra.stage : '');
  if (pages.has(key)) return pages.get(key);
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
  p.on('pageerror', e => console.log('[hata]', e.message.slice(0, 200)));
  await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=${tier}&seed=3${extra.noao ? '&noao=1' : ''}`);
  await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 180000 });
  await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
  const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { const inp = await p.$('input[name="ad"]'); if (inp) await inp.fill('Deneme'); await go.click({ force: true }); await p.waitForTimeout(500); }
  await p.evaluate((st) => { const M = window.__marti; M.command({ kind: 'esnafim', op: 'done' }); M.setStage(st); M.step(1); }, extra.stage || 3);
  await p.waitForTimeout(4000);
  await p.evaluate(() => { const M = window.__marti; M.camera({ tilt: -10 }); for (let k = 0; k < 30; k++) M.renderFrames(1, 0.1); });   // let the intro camera finish
  pages.set(key, p); return p;
}
for (const name of want) {
  const sc = S[name]; if (!sc) { console.log('yok', name); continue; }
  const [tier, hour, cam, extra] = sc;
  const p = await page(tier, extra);
  const row = await p.evaluate(([hour, cam, extra]) => {
    const M = window.__marti;
    if (extra.tp) M.teleport(extra.tp[0], extra.tp[1]); else M.teleport(cam.x, cam.z + 2);
    M.setTime(hour); if (M.yagmur) { if (extra.dry) M.yagmur(0, 0); else M.yagmur(extra.rain ? 1 : -1); }
    if (M.yansima && extra.refl !== undefined) M.yansima(extra.refl);
    if (M.ao) M.ao(!extra.aoOff);
    M.camera({ ...cam, tilt: -10 }); M.camera({ tilt: cam.tilt });   // tilt is relative in the rig: clamp to the lowest pitch first
    for (let k = 0; k < (extra.rain ? 120 : extra.dry ? 20 : 12); k++) { M.step(0.1); M.renderFrames(1, 0.1); }
    M.camera({ ...cam, tilt: -10 }); M.camera({ tilt: cam.tilt });   // again: the first call can be eaten by the intro camera
    for (let k = 0; k < 8; k++) M.renderFrames(1, 0.1);
    const i = M.info();
    return { glass: M.malzeme ? JSON.stringify(M.malzeme('kioskGlass')) : null, fx: { live: i.particles ?? null, counters: i.counters ? { live: i.counters['fx.live'], amb: i.counters['fx.ambient'] } : null }, calls: i.calls, tris: i.tris, programs: i.programs, texs: i.texs, sceneW: i.sceneW, reflect: i.reflect ?? null, gfx: M.gfx ? M.gfx() : null, yansima: M.yansima ? M.yansima() : null, horizon: M.render?.horizon };
  }, [hour, cam, extra]);
  await p.waitForTimeout(300);
  const buf = await p.screenshot({ path: join(OUT, name + '.png'), timeout: 300000 });
  row.lum = +lum(buf).toFixed(2); res[name] = row;
  console.log(name.padEnd(26), 'lum', row.lum, 'calls', row.calls, 'prog', row.programs, 'tex', row.texs, row.yansima ? 'refl ' + JSON.stringify(row.reflect) : '', row.glass ? 'cam ' + row.glass : '', 'fx ' + JSON.stringify(row.fx), row.gfx ? 'gfx ' + JSON.stringify({ t: row.gfx.tier, db: row.gfx.drawingBuffer, sh: row.gfx.shadowMapSize, ext: row.gfx.shadowExt, bloom: row.gfx.bloomEnabled, msaa: row.gfx.msaa, envK: row.gfx.envK }) : '');
}
writeFileSync(join(OUT, 'olcum.json'), JSON.stringify(res, null, 1));
await b.close(); srv.close();
