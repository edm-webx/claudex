// PRF-12 + PRF-13 ölçüm kancası: node tests/browser/profil.mjs   (DIST=klasör)
// 1) Dinamik çözünürlük: ölçek 1.0 -> 0.7 -> 1.0 geçişinde shader programı sayısı, geçiş karesi maliyeti, kare maliyeti.
// 2) Üç cihaz profili (tel 390x844 dokunmatik + CPU 4x, düşük PC 2x, güçlü PC): kare başına ms, geometri/doku sayısı, tahmini doku belleği.
// 3) Bölge gidiş-geliş (${TUR} tur): geometri/doku/program sayacı başlangıca dönüyor mu.  4) WebGL bağlam kaybı/geri gelişi: oyun devam ediyor mu.
// SwiftShader: yalnız CPU süresi ölçer (GPU süresi DEĞİL); süreler sahibin GPU'sunda PRF-01 kaydıyla doğrulanmalıdır. Sayaçlar donanımdan bağımsızdır.
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist');
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc'] });
const BOL = (process.env.BOL || '1,2,3').split(','), TUR = +(process.env.TUR || 20); let fails = 0; const ok = (c, m) => { console.log((c ? 'GEÇTİ  ' : 'KALDI  ') + m); if (!c) fails++; };
const med = a => [...a].sort((x, y) => x - y)[a.length >> 1];

async function open(opts) {
  const ctx = await b.newContext({ viewport: opts.viewport, deviceScaleFactor: opts.dsf || 1, isMobile: !!opts.touch, hasTouch: !!opts.touch });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => { errs.push(String(e).slice(0, 160)); });
  const cdp = await ctx.newCDPSession(p); if (opts.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.cpu });
  await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=${opts.tier}&seed=3&stage=10`);
  await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
  await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
  const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { await go.click({ force: true }); await p.waitForTimeout(700); }
  await p.evaluate(() => { const M = window.__marti; for (let k = 0; k < 12; k++) M.renderFrames(2, 0.1); });
  return { p, ctx, cdp, errs };
}
const frameMs = (p, n = 30) => p.evaluate(n => { const M = window.__marti, xs = []; for (let i = 0; i < n; i++) { const t = performance.now(); M.renderFrames(1, 1 / 60); xs.push(performance.now() - t); } return xs; }, n);
const info = p => p.evaluate(() => { try { gc(); } catch { /* */ } const i = window.__marti.info(), c = document.getElementById('c'); return { geo: i.geos, tex: i.texs, prog: i.programs, calls: i.calls, tris: i.tris, heapMB: +((performance.memory?.usedJSHeapSize || 0) / 1048576).toFixed(1), cw: c.width, ch: c.height, sw: i.sceneW, sh: i.sceneH }; });

// ── 1. dinamik çözünürlük
if (BOL.includes('1')) {
  const { p, errs } = await open({ viewport: { width: 1280, height: 720 }, tier: 'dengeli' });
  const a = await info(p), f1 = await frameMs(p);
  const t0 = await p.evaluate(() => { const M = window.__marti, t = performance.now(); M.setScale(0.7); M.renderFrames(1, 1 / 60); return performance.now() - t; });
  const b1 = await info(p), f07 = await frameMs(p);
  const t1 = await p.evaluate(() => { const M = window.__marti, t = performance.now(); M.setScale(1); M.renderFrames(1, 1 / 60); return performance.now() - t; });
  const c1 = await info(p);
  console.log(`ölçek 1.0: tuval ${a.cw}x${a.ch} sahne ${a.sw}x${a.sh} kare p50 ${med(f1).toFixed(1)} ms | 0.7: tuval ${b1.cw}x${b1.ch} sahne ${b1.sw}x${b1.sh} kare p50 ${med(f07).toFixed(1)} ms | geçiş karesi ->0.7 ${t0.toFixed(1)} ms, ->1.0 ${t1.toFixed(1)} ms | program ${a.prog}/${b1.prog}/${c1.prog}`);
  ok(a.prog === b1.prog && b1.prog === c1.prog, 'ölçek değişiminde shader program sayısı sabit');
  // PRF-12: bloom kademesinde tuval tam boy kalır (yeniden boyutlama yok), yalnız sahne hedefi küçülür; son geçiş tuvale gerer
  ok(b1.sw < a.sw && c1.sw === a.sw && b1.cw === a.cw, 'ölçek 0.7 sahne hedefini küçültür, tuval tam boy kalır, 1.0 geri verir');
  // PRF-12 ikinci basamak: bloom geçişi kesilir (pass.enabled), program ve hedef yeniden kurulmaz
  const fOn = await frameMs(p);
  const tc = await p.evaluate(() => { const M = window.__marti, t = performance.now(); M.setPostCut(true); M.renderFrames(1, 1 / 60); return performance.now() - t; });
  const fCut = await frameMs(p), e1 = await info(p);
  if (process.env.SHOTDIR) await p.screenshot({ path: `${process.env.SHOTDIR}/olcek-bloom-kesik.png`, timeout: 300000 });
  await p.evaluate(() => window.__marti.setPostCut(false)); await frameMs(p, 3); const e2 = await info(p);
  if (process.env.SHOTDIR) { await p.screenshot({ path: `${process.env.SHOTDIR}/olcek-1.0.png`, timeout: 300000 }); await p.evaluate(() => { window.__marti.setScale(0.7); window.__marti.renderFrames(2, 1 / 60); }); await p.screenshot({ path: `${process.env.SHOTDIR}/olcek-0.7.png`, timeout: 300000 }); await p.evaluate(() => { window.__marti.setScale(1); window.__marti.renderFrames(2, 1 / 60); }); }
  console.log(`bloom açık kare p50 ${med(fOn).toFixed(1)} ms | kesik ${med(fCut).toFixed(1)} ms | kesme karesi ${tc.toFixed(1)} ms | program ${a.prog}/${e1.prog}/${e2.prog}`);
  ok(e1.prog === a.prog && e2.prog === a.prog, 'bloom kesme/geri açmada shader program sayısı sabit');
  ok(errs.length === 0, 'sayfa hatası yok ' + errs.join('|'));
  // bağlam kaybı
  await p.evaluate(() => window.__marti.loseGl(true)); await p.waitForTimeout(300);
  await p.evaluate(() => window.__marti.renderFrames(3, 1 / 60)); await p.evaluate(() => window.__marti.loseGl(false)); await p.waitForTimeout(800);
  await p.evaluate(() => { for (let k = 0; k < 6; k++) window.__marti.renderFrames(2, 0.1); });
  const d = await info(p); await frameMs(p, 5);
  ok(d.calls > 0 && errs.length === 0, `bağlam kaybı+geri gelişte oyun sürüyor (çizim çağrısı ${d.calls}, hata ${errs.length})`);
  await p.context().close();
}
// ── 2. cihaz profilleri
const PROF = [
  { ad: 'tel (390x844 dokunmatik, CPU 4x, akici)', viewport: { width: 390, height: 844 }, dsf: 2, touch: true, cpu: 4, tier: 'akici' },
  { ad: 'düşük PC (CPU 2x, akici)', viewport: { width: 1366, height: 768 }, cpu: 2, tier: 'akici' },
  { ad: 'güçlü PC (CPU 1x, sahane)', viewport: { width: 1600, height: 900 }, cpu: 1, tier: 'sahane' },
];
const rows = [];
for (const pr of BOL.includes('2') ? PROF : []) {
  const { p, errs } = await open(pr); const f = await frameMs(p, 20); const i = await info(p);
  const texMB = (i.cw * i.ch * 4 * 1.33 / 1048576).toFixed(1);
  const row = { profil: pr.ad, kareP50ms: +med(f).toFixed(1), kareMaxms: +Math.max(...f).toFixed(1), tuval: `${i.cw}x${i.ch}`, tuvalTexMB: +texMB, geo: i.geo, tex: i.tex, prog: i.prog, calls: i.calls, tris: i.tris, heapMB: i.heapMB, hata: errs.length };
  rows.push(row); console.log(JSON.stringify(row));
  if (pr.touch) {   // dokunmatik: pull-to-refresh engeli + düğme boyutu
    const t = await p.evaluate(() => ({ otb: getComputedStyle(document.documentElement).overscrollBehavior + '/' + getComputedStyle(document.body).overscrollBehavior, ta: getComputedStyle(document.body).touchAction, small: [...document.querySelectorAll('button')].filter(x => { const r = x.getBoundingClientRect(); return r.width > 0 && (r.width < 36 || r.height < 36); }).length, all: document.querySelectorAll('button').length }));
    console.log('dokunmatik:', JSON.stringify(t));
    await p.screenshot({ path: process.env.SHOT || `profil-tel.png` });
  }
  await p.context().close();
}
// ── 3. bölge gidiş-geliş
if (BOL.includes('3')) {
  const { p, errs } = await open({ viewport: { width: 1280, height: 720 }, tier: 'dengeli' });
  await p.evaluate(() => { const M = window.__marti; M.simCmd('money', 9e9); M.simCmd('level', 40); });
  const S = [[0, -2], [-16.4, 37.9], [28.6, 34.6], [50, 35.2], [18.5, 49.2], [-53.3, 44]];
  const go = async (x, z) => { await p.evaluate(([x, z]) => window.__marti.teleport(x, z), [x, z]); await p.evaluate(() => { for (let k = 0; k < 8; k++) window.__marti.renderFrames(2, 0.1); }); };
  for (const [x, z] of S) await go(x, z); await go(0, -2);   // bir ısınma turu: önbellek dolsun
  const s0 = await info(p), seri = [];
  for (let k = 0; k < TUR; k++) { for (const [x, z] of S) await go(x, z); await go(0, -2); if (k % 5 === 4) seri.push(await info(p)); }
  const s1 = await info(p);
  console.log(`zone gidiş-geliş ${TUR} tur: başlangıç geo/tex/prog ${s0.geo}/${s0.tex}/${s0.prog} -> son ${s1.geo}/${s1.tex}/${s1.prog}; ara: ${seri.map(x => x.geo + '/' + x.tex).join(' ')}`);
  ok(s1.geo <= s0.geo && s1.tex <= s0.tex && s1.prog <= s0.prog + 1, 'zone ping-pong sonrası geo/tex/program sayaçları başlangıca dönüyor (artmıyor)');
  ok(errs.length === 0, 'sayfa hatası yok ' + errs.join('|'));
  await p.context().close();
}
console.log(fails ? `KIRMIZI: ${fails} kontrol kaldı` : 'YEŞİL'); await b.close(); srv.close(); process.exit(fails ? 1 : 0);
