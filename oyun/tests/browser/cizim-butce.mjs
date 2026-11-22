// PRF-06: sahne başına çizim çağrısı / üçgen bütçesi ve bölge maliyet tablosu (window.__marti.drawCost).
// Kullanım: node tests/browser/cizim-butce.mjs [--build | --dist KLASÖR] [--kademe akici,dengeli] [--sahne ad,ad] [--json çıktı.json] [--shots KLASÖR [--ab]] [--saat 12] [--kapi]
//   --ab: aynı derlemede gölge ayıklama (PRF-06) kapalı/açık iki çekim: KLASÖR/kapali ve KLASÖR/acik.
//   --shots: her sahnenin ekran görüntüsü (dinamik şeyler gizli: kalabalık, kahraman, martı, parçacık) -> tools/gorsel-fark.mjs ile önce/sonra karşılaştırılır.
//   --kapi: BUTCE aşılırsa çıkış 1 (run-browser'ın otomatik listesinde değil; tam kapı PRF-02 perf-gate'tedir).
// Ölçüm renderer.info.render (gölge ve bloom geçişleri dahil), SwiftShader: sayılar gerçek GPU ile aynı, süre değil.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
let DIST = resolve(arg('--dist', 'dist'));
if (arg('--build')) {   // ölçüm derlemesi: drawCost kancası yalnız --mode olcum (ve geliştirme) derlemesinde var
  DIST = mkdtempSync(join(tmpdir(), 'marti-cizim-'));
  const env = { ...process.env, MARTI_DIST: DIST };
  const r = spawnSync('npx', ['vite', 'build', '--mode', 'olcum', '--outDir', DIST, '--emptyOutDir'], { stdio: 'inherit', env });
  if (r.status !== 0 || spawnSync(process.execPath, ['tools/build-artifact.mjs'], { stdio: 'inherit', env }).status !== 0) { console.error('cizim-butce: derleme başarısız'); process.exit(2); }
}
const tiers = String(arg('--kademe', 'akici,dengeli')).split(',');
const shots = arg('--shots'), saat = Number(arg('--saat', 12));
const ab = !!arg('--ab');
const sahneSec = arg('--sahne') ? String(arg('--sahne')).split(',') : null;
export const BUTCE = { akici: { calls: 150, tris: 120000 }, dengeli: { calls: 250, tris: 250000 } };   // PRF-06 ilk hedef; son hâli PRF-02 kapısında
// sahne koordinatları oyun içeriğinden (perf-gate ROTA ile aynı noktalar + büfe aşama 1/10, sokak, stadyum)
export const SAHNELER = [
  { ad: 'iskele-asama1', stage: 1, tp: [0, -2] },
  { ad: 'iskele-asama10', stage: 10, tp: [0, -2] },
  { ad: 'iskele-orta', stage: 10, tp: [0, -8] },
  { ad: 'sokak', stage: 10, tp: [10, 14] },
  { ad: 'karsi-yaka', stage: 10, tp: [0, 40] },
  { ad: 'karsi-yaka-bati', stage: 10, tp: [-30, 45] },
  { ad: 'hali-saha', stage: 10, tp: [399, 12.2] },
  { ad: 'orman', stage: 10, tp: [806, 9] },
].filter(s => !sahneSec || sahneSec.includes(s.ad));

const globalRoot = (() => { try { return execSync('npm root -g').toString().trim(); } catch { return ''; } })();
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(join(globalRoot, 'x.js'))('playwright')); }
const mime = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') { res.writeHead(200, { 'content-type': mime['.html'] }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p);
  if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
if (shots) { mkdirSync(shots, { recursive: true }); if (ab) { mkdirSync(join(shots, 'kapali'), { recursive: true }); mkdirSync(join(shots, 'acik'), { recursive: true }); } }

const sonuc = {}; let kirmizi = 0;
for (const tier of tiers) {
  sonuc[tier] = {};
  for (const stage of [...new Set(SAHNELER.map(s => s.stage))]) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('  sayfa hatası:', String(e).slice(0, 160)));
    await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=${tier}&seed=3&time=${saat}&stage=${stage}`);
    await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
    await p.evaluate(() => { const M = window.__marti; M.play('sabri'); M.renderFrames(2, 0.1); });
    await kulisKapat(p, 'Olcum');
    for (const s of SAHNELER.filter(s => s.stage === stage)) {
      await p.evaluate(([x, z]) => { const M = window.__marti; M.teleport(x, z); for (let k = 0; k < 15; k++) M.renderFrames(2, 0.1); }, s.tp);
      await p.waitForTimeout(2500);
      await p.evaluate(h => { const M = window.__marti; M.setTime(h); M.renderFrames(4, 0.1); }, saat);
      const r = await p.evaluate(() => { const M = window.__marti, i = M.info(); return { calls: i.calls, tris: i.tris, programs: i.programs, cost: M.drawCost?.(200) ?? null }; });
      sonuc[tier][s.ad] = r;
      const b = BUTCE[tier]; const ok = !b || (r.calls < b.calls && r.tris < b.tris); if (!ok) kirmizi++;
      console.log(`${tier.padEnd(8)} ${s.ad.padEnd(16)} çağrı ${String(r.calls).padStart(4)}  üçgen ${String(r.tris).padStart(7)}  program ${r.programs}${b ? (ok ? '' : '  (bütçe üstü)') : ''}`);
      if (shots && ab) {
        // PRF-06 A/B in the same build: shadow-pass culling off vs on, same frame -> tools/gorsel-fark.mjs shots/kapali shots/acik
        for (const [on, dir] of [[false, 'kapali'], [true, 'acik']]) {
          const c = await p.evaluate(on => { const M = window.__marti; M.shadowCull(on); M.renderFrames(1, 0.0001); return M.info().calls; }, on);
          await p.screenshot({ path: join(shots, dir, `${tier}-${s.ad}.png`), timeout: 300000 });
          r['calls_' + dir] = c;
        }
        console.log(`         gölge ayıklama kapalı ${r.calls_kapali} -> açık ${r.calls_acik} çağrı`);
      } else if (shots) {
        await p.evaluate(() => { const M = window.__marti; M.hideDyn?.(true); M.renderFrames(1, 0.0001); });
        await p.screenshot({ path: join(shots, `${tier}-${s.ad}.png`), timeout: 300000 });
        await p.evaluate(() => window.__marti.hideDyn?.(false));
      }
    }
    await ctx.close();
  }
}
await browser.close(); srv.close();
const jf = arg('--json'); if (jf && jf !== true) { writeFileSync(jf, JSON.stringify({ tarih: new Date().toISOString().slice(0, 16), saat, BUTCE, sonuc }, null, 1)); console.log('yazıldı:', jf); }
process.exit(arg('--kapi') && kirmizi ? 1 : 0);
