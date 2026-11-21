// PRF-03/04/15 ölçüm kancası: node tests/browser/akicilik-probe.mjs  (DIST=yol ile başka derleme klasörü)
// Her olaydan sonra renderer program/geometri/doku sayısı ve canlı WebGL bağlamı sayısı yazılır. SwiftShader: yalnız sayılar güvenilir, süre değil.
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist');
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
await p.addInitScript(() => {   // canlı WebGL bağlamı sayacı
  const live = new Set(); window.__ctxLive = () => live.size; window.__ctxMade = 0; window.__loseCalls = 0;
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, ...a) { const c = gc.call(this, t, ...a); if (c && /webgl/.test(t)) { if (!live.has(this)) { live.add(this); window.__ctxMade++; } const ge = c.getExtension.bind(c); c.getExtension = n => { const e = ge(n); if (n === 'WEBGL_lose_context' && e && !e.__w) { const lc = e.loseContext.bind(e); e.loseContext = () => { window.__loseCalls++; live.delete(this); return lc(); }; e.__w = true; } return e; }; } return c; };
});
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=${process.env.TIER || 'dengeli'}&seed=3&stage=${process.env.STAGE || 10}`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { await go.click({ force: true }); await p.waitForTimeout(700); }
let prevNames = null;
const snap = (tag) => p.evaluate(([tag, prev]) => { const M = window.__marti; const i = M.info(); window.__pn = i.programNames; const nw = prev ? i.programNames.filter(n => !prev.includes(n)).slice(0, 6).join(',') : ''; return `${tag.padEnd(28)} yeni=[${nw}] prog=${i.programs} geo=${i.geos} tex=${i.texs} ctx=${window.__ctxLive()} heapMB=${(performance.memory?.usedJSHeapSize / 1048576).toFixed(1)}`; }, [tag, prevNames]).then(async r => { prevNames = await p.evaluate(() => window.__pn); return r; });
const settle = (n = 12) => p.evaluate((n) => { const M = window.__marti; for (let k = 0; k < n; k++) M.renderFrames(2, 0.1); }, n);
const out = [];
await settle(); await p.waitForTimeout(1500); await settle(4); out.push(await snap('açılış'));
const SPOTS = { kafe1: [-16.4, 37.9], kirtasiye: [28.6, 34.6], okul: [50, 35.2], avm: [18.5, 49.2], tesis: [-53.3, 44], banka: [11.7, 39.2], hastane: [46.95, 51.5] };
await p.evaluate(() => { const M = window.__marti; M.simCmd('money', 9e9); M.simCmd('level', 40); });
for (const t of [13, 19.5, 22, 9]) { await p.evaluate(t => window.__marti.setTime(t), t); await settle(6); out.push(await snap('saat ' + t)); }
for (const tier of ['akici', 'sahane', 'dengeli']) { await p.evaluate(t => window.__marti.setTier(t), tier); await settle(6); await p.waitForTimeout(500); await settle(4); out.push(await snap('kademe ' + tier)); }
for (const [id, [x, z]] of Object.entries(SPOTS)) { await p.evaluate(([x, z]) => { const M = window.__marti; M.teleport(x, z); }, [x, z]); await settle(10); await p.waitForTimeout(800); await settle(4); out.push(await snap('bölge ' + id)); }
console.log(out.join('\n'));
await b.close(); srv.close(); process.exit(0);
