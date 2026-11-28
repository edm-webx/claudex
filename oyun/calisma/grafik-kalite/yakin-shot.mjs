// Görsel mantık denetçisi (2026-11-21): oyunu headless açar, bir aşamada canlı sim'i ilerletir, her bölge/iç mekânda
// birkaç açıdan ekran görüntüsü alır.  STAGE=10 node tests/browser/denetci.mjs <çıktı> [id,id,...]
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.MARTI_DIST || 'dist');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const STAGE = Number(process.env.STAGE || 10);
// PADS=1: masa / istasyon pad'leri açık (dolu büfe; garson davranışı görünsün)
const PADS = process.env.PADS ? [...readFileSync(resolve('src/content/pads.ts'), 'utf8').matchAll(/key: '([a-z0-9_]+)'[^\n]*kind: '(table|station)'/g)].map(m => m[1]) : [];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=${process.env.TIER || 'dengeli'}&seed=3&stage=${STAGE}`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
// karakter atölyesi (kulis.ts .ka-go; eski .kl-go): ad yazılmazsa panel kapanmaz ve sim duraklı kalır
  for (let k = 0; k < 3; k++) { const pb = await p.waitForSelector('.ka-pb', { timeout: k ? 500 : 6000 }).catch(() => null); if (pb) { await pb.click({ force: true }).catch(() => {}); await p.waitForTimeout(300); } const go = await p.waitForSelector('.ka-go, .kl-go', { timeout: k ? 2000 : 8000 }).catch(() => null); if (!go) break; const ad = await p.$('input[name="ad"]'); if (ad) await ad.fill('Olcum').catch(() => {}); await go.click({ force: true }).catch(() => {}); await p.waitForTimeout(400); }
  if (await p.$('.ka-go, .kl-go')) console.log('UYARI: karakter paneli kapanmadı, ölçüm geçersiz');
await p.evaluate(([STAGE, PADS]) => { const M = window.__marti; M.setTime(13); M.step(2); M.izgara(false); M.simCmd('money', 9e9); void 0; M.simCmd('level', 40); M.simCmd('unlock', 'isbul');
  try { M.simCmd('cmd', { kind: 'setStage', stage: STAGE }); } catch { /* */ }
  for (const k of PADS) try { M.simCmd('unlock', k); } catch { /* */ }
  for (let i = 0; i < 12; i++) { M.simCmd('hire'); M.step(1); }
  const all = { k1: ['espresso', 'vitrin', 'koltuk', 'isik', 'muzik', 'kitaplik', 'saksi', 'barista'], k2: ['kahve_bar', 'waffle_mak', 'buz_vitrin', 'isik', 'akvaryum', 'mangal', 'piyano', 'sef_seti'], k3: ['fotokopi', 'pos', 'laminasyon', 'kitap_raf', 'vitrin_k', 'oyuncak', 'yazici3d', 'okuma'], k4: ['tost_mak', 'buzdolap', 'semaver_k', 'mikrodalga', 'meyve', 'masa_k', 'ekran_k', 'izgara_k'], k5: ['benmari', 'corba_kazan', 'pide_firin', 'cay_ocak', 'ocakbasi', 'doner', 'tatli_vitrin', 'led_menu', 'sef_ocak'], k6: ['cay_mak', 'icecek_dolap', 'mac_tv', 'langirt', 'kupa', 'izgara_t', 'forma_duvar', 'vip'], k7: [], k8: [], k9: [] };
  for (const id of Object.keys(all)) { M.command({ kind: 'mulk', op: 'adminKafe', id, n: 5 }); for (let i = 0; i < 3; i++) M.command({ kind: 'mulk', op: 'adminIsci', id }); for (const e of all[id]) M.command({ kind: 'mulk', op: 'kafeEsya', id, e }); }
  M.closeJobBoard?.(); M.closePanel?.(); for (const id of ['sb-vig']) { const v = document.getElementById(id); if (v) v.style.display = 'none'; }
  M.setTime(12.3); try { M.havaZorla(''); } catch { /* */ } for (let i = 0; i < 90; i++) M.step(1);
  if (!new URLSearchParams(location.search).get('ui')) { const st = document.createElement('style'); st.textContent = '#sbui{visibility:hidden!important}'; document.head.appendChild(st); } }, [STAGE, PADS]);
// [id, hero x, z, cam x, z, zoomRaw, yaw (×π/2), tilt]
const SPOTS = {
  yolYakin: [0, 30, 0, 21, 1.5, 0, 0.55], heroYakin: [0, -2, 0, -3.2, 0.35, 0, 0.35], heroOrta: [0, -2, 0, -4, 0.8, 0, 0.6], ambulans: [35, 50.5, 35.4, 52, 0.6, 2, 0.35], meydanUzak: [0, 30, 0, 38, 4, 0, 0.6], kalabalik: [2, 4, 2, 2, 1.2, 0, 0.5], dukkanKenar: [20, 40, 22, 42, 0.9, 1, 0.4],
  iskele: [0, -2, 0, -6, 3.6, 0, 0.9], yakindaTabela: [5, -8, 6.3, -12.3, 1.2, 0, -0.45], giseYeni: [17, -9, 19.5, -12, 1.2, 0, -0.45], batiKose: [-8, 0, -10, 3, 1.2, 0, -0.45], bufeAci: [0, 1, 0, -3, 1.8, 0, -0.45], garson: [4, 1, 1, -2, 0.9, 0, -0.45], kafe1Yakin: [-16.4, 37.9, -17.5, 37.9, 0.7, 1, 0.3], kirtasiyeYakin: [28.6, 34.6, 28, 35.2, 0.6, 2, 0.3], avmTekno: [1193.5, 54, 1191.5, 54, 0.6, 1, 0.3], avmOyuncak: [1206.5, 49.8, 1208.8, 49.8, 0.6, 3, 0.3], tesisYakin: [-53.3, 44, -54.1, 45.4, 0.8, 1, 0.3], iskeleArka: [0, -11, 0, -12, 2.6, 2, 0.8], bufeOn: [0, -4, 0, -6, 1.5, 0, 0.75], bufeYan: [-6, -8, -2, -10, 1.8, 1, 0.75],
  mutfak: [0, -14.6, 0, -15, 1.2, 0, 0.9], mutfakDis: [0, -9, 0, -13, 1.6, 0, 0.7],
  salonW: [-17.6, -12.0, -17.6, -13.5, 1.6, 0, 0.8], salonE: [15.6, -12.0, 15.6, -13.5, 1.6, 0, 0.8],
  kafe1: [-16.4, 37.9, -17.5, 37.9, 1.6, 1, 0.8], kafe2: [-16.4, 51.5, -17.5, 51.5, 1.6, 1, 0.8], kirtasiye: [28.6, 34.6, 28, 35.2, 1.4, 2, 0.8], okul: [50, 35.2, 48.85, 37.25, 2.2, 2, 0.8],
  avm: [26, 49.5, 26, 51.8, 1.6, 2, 0.8], moda: [21.45, 49.5, 21.45, 51.8, 1.6, 2, 0.8], tekno: [17.55, 49.5, 17.55, 51.8, 1.6, 2, 0.8], oyuncak: [13.65, 49.5, 13.65, 51.8, 1.6, 2, 0.8],
  tesis: [-53.3, 44, -54.1, 45.4, 2.2, 1, 0.8], banka: [11.7, 39.2, 11.7, 36.8, 1.8, 0, 0.8], hastane: [46.95, 51.5, 46.95, 53.55, 2.2, 2, 0.8],
  meydan: [0, 30, 0, 38, 4, 0, 0.9], stadyum: [404, 14, 420, 8, 2.1, 0, 0.9], orman: [820, 10, 830, 4, 2.1, 0, 0.9], stadyumGenis: [404, 14, 420, 8, 4.5, 0, 0.9], ormanGenis: [820, 10, 830, 4, 4, 0, 0.9],
};
const ids = (process.argv[3] || Object.keys(SPOTS).join(',')).split(',');
for (const id of ids) {
  const s = SPOTS[id]; if (!s) { console.log('?', id); continue; }
  const [x, z, cx, cz, zr, yi, tilt] = s;
  try {
    await p.evaluate(([x, z, cx, cz, zr, yi, tilt]) => { const M = window.__marti; M.setTime(12.5); M.teleport(x, z); for (let k = 0; k < 6; k++) { M.step(0.5); M.renderFrames(3, 0.1); } M.camera({ x: cx, z: cz, zoomRaw: zr, yaw: yi * Math.PI / 2, tilt }); for (let k = 0; k < 16; k++) { M.step(0.1); M.renderFrames(2, 0.1); } }, [x, z, cx, cz, zr, yi, tilt]);
    await p.waitForTimeout(250); await p.screenshot({ path: join(out, `${process.env.TIER || 'dengeli'}-${id}.png`), timeout: 300000 }); console.log('ok', id, JSON.stringify(await p.evaluate(() => { const i = window.__marti.info(); let hv=null; try{hv=window.__marti.havaZorla('');}catch{} const el=document.elementsFromPoint(640,360).slice(0,4).map(e=>e.tagName+'#'+e.id+'.'+String(e.className).slice(0,20)+'@'+getComputedStyle(e).opacity); return { calls: i.calls, tris: i.tris, hv, el }; })));
  } catch (e) { console.log('ERR', id, e.message.slice(0, 200)); }
}
writeFileSync(join(out, `hatalar-${STAGE}.txt`), errs.join('\n'));
await b.close(); srv.close(); process.exit(0);
