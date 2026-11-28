// 2026-11-23 Meydan Kafe denetimi: sarı karelerin kapıya uzaklığı + espresso istasyonunun gerçek akışı (yürüyerek, admin kısayolu yok).
//  node tests/browser/meydan-kafe.mjs <çıktı>
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm', js: 'text/javascript' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=2`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
await kulisKapat(p, 'Olcum');
await p.evaluate(() => { const M = window.__marti; M.step(0.5); document.querySelector('.ka-go')?.click(); M.step(0.5); M.setTime(12); M.izgara(false); M.closeJobBoard?.(); M.closePanel?.(); });
const shot = async (name, cam) => { await p.evaluate((cam) => { const M = window.__marti; M.camera(cam); for (let k = 0; k < 10; k++) { M.step(0.05); M.renderFrames(2, 0.05); } }, cam); await p.waitForTimeout(200); await p.screenshot({ path: join(out, name + '.png'), timeout: 600000 }); console.log('shot', name); };
const log = (...a) => console.log(...a);
await p.evaluate(() => { const st = document.createElement('style'); st.textContent = '#sb-vig,#sbui{visibility:hidden!important}'; document.head.appendChild(st); });
// yürüme: input dünya yönünde (x, z); hedefe varınca bırak. Yol noktaları duvar / tezgâh çevresinden dolaşır. Işınlanma yok (yalnız başlangıç).
const yuru = (pts, maxS = 30) => p.evaluate(([pts, maxS]) => { const M = window.__marti; let t = 0; M.camera({ yaw: 0 });   // girdi kameraya göre: kuzey yukarı
  for (const q of pts) { for (;;) { const s = M.state().pos, dx = q[0] - s.x, dz = q[1] - s.z, d = Math.hypot(dx, dz); if (d < 0.25 || t > maxS) break; M.input(dx / d, dz / d); M.step(0.05); t += 0.05; } }
  M.input(null); M.step(0.1); const s = M.state().pos; return { x: s.x, z: s.z, t: +t.toFixed(1) }; }, [pts, maxS]);
const bekle = (sec) => p.evaluate((sec) => { const M = window.__marti; for (let i = 0; i < sec * 10; i++) M.step(0.1); }, sec);
const dk = () => p.evaluate(() => window.__marti.dukkan('kafe1'));
const padsK1 = () => p.evaluate(() => window.__marti.pads().filter(q => /^isl\.k1/.test(q.key)));
const sonuc = {};
// 1) kare yeri (alınmadan): kapıya uzaklık
await p.evaluate(() => { const M = window.__marti; M.teleport(-6, 37.9); M.simCmd('serbest'); M.simCmd('money', 5e6); M.simCmd('level', 12); M.simCmd('cmd', { kind: 'freezeTime', on: false }); M.step(1); });
const kare = (await padsK1())[0]; sonuc.satisKaresi = { ...kare, kapiyaM: +Math.hypot(kare.x + 14, kare.z - 37.9).toFixed(2) };
await shot('1-kafe-kareler', { x: -12.5, z: 37.9, zoomRaw: 1.1, yaw: Math.PI / 2, tilt: 1.15 });
// 2) yürüyerek kareye bas, dükkân alınsın
sonuc.yuru1 = await yuru([[kare.x, kare.z]]); await bekle(6);
sonuc.alindi = (await dk()).plots.includes('k1');
let al = await padsK1(); sonuc.aletKareleri = al.map(q => ({ key: q.key, x: q.x, z: q.z, kapiyaM: +Math.hypot(q.x + 14, q.z - 37.9).toFixed(2) }));
await shot('2-kafe-alet-kareleri', { x: -14.5, z: 37.9, zoomRaw: 1.0, yaw: Math.PI / 2, tilt: 1.15 });
// 3) espresso makinesini al (sıradaki aletleri yürüyerek; her kareden inip öbürüne)
for (let n = 0; n < 6; n++) {
  al = await padsK1(); const e = al.find(q => q.key.endsWith('.espresso')) || al[0]; if (!e) break;
  await yuru([[-8.5, 37.9], [e.x, e.z]]); await bekle(6);
  if (e.key.endsWith('.espresso')) break;
}
sonuc.espressoKareKaldi = (await padsK1()).some(q => q.key.endsWith('.espresso'));
// 4) içeri gir, tezgâhın ucundan arkaya dolan, espresso makinesinin başında dur
sonuc.yuru2 = await yuru([[-12.0, 37.9], [-15.2, 37.9], [-16.3, 34.4], [-19.75, 34.4], [-19.78, 40.4]], 60);
await bekle(1.5);
const t0 = await dk(); sonuc.makineBasinda = { tepsi: t0.tepsi, makine: t0.makine.map(m => ({ ist: m.ist, cook: m.cook, ready: m.ready })) };
await shot('3-espresso-basi', { x: -18.5, z: 39.2, zoomRaw: 0.55, yaw: Math.PI / 2, tilt: 0.9 });
// makine yapsın, tepsiye gelsin (müşteri yoksa da önceden yapılıp tepside bekler)
for (let i = 0; i < 40 && !(await dk()).tepsi.length; i++) await bekle(0.5);
const t1 = await dk(); sonuc.tepside = t1.tepsi;
await shot('4-tepside-kahve', { x: -18.5, z: 39.2, zoomRaw: 0.55, yaw: Math.PI / 2, tilt: 0.9 });
// 5) bu ürünü isteyen müşteri gelene kadar bekle, tezgâhın arkasından karşısına git, ver
let satis = 0;
for (let i = 0; i < 240 && !satis; i++) {
  const s = await dk(); const sv = s.servis.find(v => v.ok && v.id.endsWith('.arka'));
  if (!s.tepsi.length) { await yuru([[-19.78, 40.4]], 10); await bekle(3); continue; }
  if (sv) { const m0 = await p.evaluate(() => window.__marti.state().money ?? null); await yuru([[sv.x, sv.z]], 10); await bekle(1); const s2 = await dk(); if (s2.tepsi.length < s.tepsi.length) { satis = 1; sonuc.servis = { nokta: sv.id, once: s.tepsi, sonra: s2.tepsi, siparis: s.siparis, para0: m0 }; } }
  else { if (i % 20 === 0) console.log('bekle', i, JSON.stringify({ t: s.tepsi, s: s.siparis, b: s.bekleyen, saat: s.saat, o: s.odalar.find(o => o.room === 'kafe1') })); await bekle(1); }
}
sonuc.satisOldu = !!satis;
await shot('5-servis', { x: -18.5, z: 38.5, zoomRaw: 0.6, yaw: Math.PI / 2, tilt: 0.9 });
console.log(JSON.stringify(sonuc, null, 1));
writeFileSync(join(out, 'sonuc.json'), JSON.stringify(sonuc, null, 1));
writeFileSync(join(out, 'hatalar.txt'), errs.join('\n'));
await b.close(); srv.close(); process.exit(0);
