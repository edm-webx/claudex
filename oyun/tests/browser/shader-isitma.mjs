// PRF-03: oyun içinde yeni shader programı doğuyor mu? node tests/browser/shader-isitma.mjs   (DIST=klasör, TIER=dengeli)
// Açılış ısıtmasından sonra gece-gündüz, 5 dükkân içi, uzak bölgeler ve Sabri'nin evi gezilir; her adımda renderer program sayısı
// ve o adımda doğan programların adı yazılır. Hedef: oyun içi adımlarda yeni program = 0 (kademe değişimi menüde sayılır, ayrı yazılır).
// Program SAYISI donanımdan bağımsızdır (SwiftShader'da da geçerli); derleme SÜRESİ değildir.
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist');
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 800, height: 450 } })).newPage();
const errs = []; p.on('pageerror', e => { errs.push(String(e).slice(0, 200)); console.log('[pageerror]', String(e).slice(0, 200)); });
const t0 = Date.now(), log = s => console.log(`${String(((Date.now() - t0) / 1000).toFixed(0)).padStart(4)}s  ${s}`);
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=${process.env.TIER || 'dengeli'}&seed=3&stage=10&time=12`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 180000 });
log('hazır');
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { const ad = await p.$('input[name="ad"]'); if (ad) await ad.fill('Olcum'); await go.click({ force: true }); await p.waitForTimeout(500); }
const settle = (n = 6) => p.evaluate(n => { const M = window.__marti; for (let k = 0; k < n; k++) M.renderFrames(2, 0.1); }, n);
// compileAsync bitene kadar bekle (KHR_parallel_shader_compile yoklaması rAF/setTimeout ile ilerler)
const warmWait = async () => { for (let i = 0; i < 40; i++) { const busy = await p.evaluate(() => window.__marti.warmBusy?.() ?? false); if (!busy) return; await p.waitForTimeout(150); } };
let prevDraw = 0, prevN = 0; const rows = [];
// "karede" = programs three linked inside a frame (blocking, the freeze); "ısıtma" = compileAsync (parallel) births are fine
const snap = async (tag, kind) => {
  const r = await p.evaluate(() => { const M = window.__marti, i = M.info(), w = M.warmStats?.() || { born: { draw: 0, warm: 0 }, lastDrawBorn: [] }; return { n: i.programs, draw: w.born.draw, warm: w.born.warm, last: w.lastDrawBorn, room: M.lights?.()?.room ?? null }; });
  const yeni = r.draw - prevDraw; prevDraw = r.draw; rows.push({ tag, kind, n: r.n, yeni, art: r.n - prevN }); prevN = r.n;
  log(`${tag.padEnd(26)} program=${String(r.n).padStart(3)}  karede-doğan=${yeni}  (ısıtmada toplam ${r.warm})${r.room ? '  oda=' + r.room : ''}${yeni ? '  [' + r.last.slice(-Math.min(yeni, 6)).join(', ') + ']' : ''}`);
};
await settle(8); await warmWait(); await settle(4); await snap('açılış (ısıtma sonrası)', 'acilis');
await p.evaluate(() => { const M = window.__marti; M.simCmd('money', 9e9); M.simCmd('level', 40); });
for (const h of [19.5, 22, 9, 13]) { await p.evaluate(h => window.__marti.setTime(h), h); await settle(4); await snap('saat ' + h, 'oyun'); }
// dükkân içleri (oda adı gece ışığı istatistiğinden) ve uzak bölgeler
const SPOTS = { 'kafe 1': [-16.4, 37.9], kirtasiye: [28.6, 34.6], okul: [50, 35.2], avm: [18.5, 49.2], tesis: [-53.3, 44], banka: [11.7, 39.2], hastane: [46.95, 51.5], 'büfe': [0, -2] };
for (const [id, [x, z]] of Object.entries(SPOTS)) { await p.evaluate(([x, z]) => window.__marti.teleport(x, z), [x, z]); await settle(8); await warmWait(); await settle(3); await snap('bölge ' + id, 'oyun'); }
await p.evaluate(() => window.__marti.setTime(21)); await settle(3);
for (const [id, [x, z]] of Object.entries(SPOTS).slice(0, 3)) { await p.evaluate(([x, z]) => window.__marti.teleport(x, z), [x, z]); await settle(6); await warmWait(); await settle(3); await snap('gece bölge ' + id, 'oyun'); }
await p.evaluate(() => window.__marti.teleport(0, -2)); await settle(6);
for (const tier of (process.env.KADEME || 'akici,sahane,dengeli').split(',')) { await p.evaluate(t => window.__marti.setTier(t), tier); await settle(2); await warmWait(); await settle(3); await snap('kademe ' + tier + ' (menü)', 'kademe'); }
for (const h of [20, 12]) { await p.evaluate(h => window.__marti.setTime(h), h); await settle(3); await snap('kademe sonrası saat ' + h, 'oyun'); }
const oyun = rows.filter(r => r.kind === 'oyun').reduce((a, r) => a + r.yeni, 0), kad = rows.filter(r => r.kind === 'kademe').reduce((a, r) => a + r.yeni, 0);
console.log(`\nTABLO: açılışta ${rows[0].n} program; oyun içi adımlarda yeni program toplam ${oyun}; kademe değişiminde (menü, ısıtılır) ${kad}`);
const bad = oyun > 0 || errs.length > 0;
console.log(bad ? 'KIRMIZI: oyun içinde shader derlendi' : 'YEŞİL: oyun içinde yeni shader programı yok');
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
