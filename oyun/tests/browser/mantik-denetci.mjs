// Mantık denetçisi (2026-11-21, kullanıcı: "garsonlar yan yana bekliyor, vapur saati tabelanın üstünde, martılar üst üste ...
// tek tek göstermeyeyim, her yeri tara"). Geliştirme derlemesinde (dist-dev, `ajanlar` + `sahne` kancaları) oyunu açar, verilen
// aşamalarda canlı sim'i ilerletir ve kural tabanlı tarar:
//   K1 personel üst üste (iki çalışan < 0.55 m, örneklerin %60'ı)      K2 boştaki garsonlar yan yana dizili (< 1.1 m, %50)
//   K3 hayvanlar üst üste (aynı tür < 0.35 m, %50)                   K4 tabela/pano çakışması (y > 0.9 m kutular kesişiyor)
//   K5 yer propları iç içe (taban izi kesişimi > %45, küçük olanın)    K6 ağız açık prop: ad/kök listesinde yasaklı (torba)
// Kullanım: npx vite build --mode development --outDir dist-dev && MARTI_DIST=dist-dev node tools/build-artifact.mjs
//           STAGES=1,2,5,10 node tests/browser/mantik-denetci.mjs <çıktı-dizini>
// Çıkış kodu: bulgu sayısı > 0 ise 1 (KATI=1 ile); rapor <çıktı>/rapor.json + konsol.
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.MARTI_DIST || 'dist-dev');
const out = process.argv[2] || 'denetim-cikti'; mkdirSync(out, { recursive: true });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const STAGES = (process.env.STAGES || '1,2,3,5,7,10').split(',').map(Number);
const SURE = Number(process.env.SURE || 40);
// tüm masa / istasyon pad'leri açılır (kullanıcının dolu büfesi gibi: masalar varken garson davranışı ölçülür)
const PADS = [...readFileSync(resolve('src/content/pads.ts'), 'utf8').matchAll(/key: '([a-z0-9_]+)'[^\n]*kind: '(table|station)'/g)].map(m => m[1]);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const rapor = {};
for (const STAGE of STAGES) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=${STAGE}`);
  await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
  await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
  // karakter atölyesi (kulis.ts .ka-go; eski .kl-go): ad yazılmazsa panel kapanmaz ve sim duraklı kalır
  for (let k = 0; k < 3; k++) { const pb = await p.waitForSelector('.ka-pb', { timeout: k ? 500 : 6000 }).catch(() => null); if (pb) { await pb.click({ force: true }).catch(() => {}); await p.waitForTimeout(300); } const go = await p.waitForSelector('.ka-go, .kl-go', { timeout: k ? 2000 : 8000 }).catch(() => null); if (!go) break; const ad = await p.$('input[name="ad"]'); if (ad) await ad.fill('Denetci').catch(() => {}); await go.click({ force: true }).catch(() => {}); await p.waitForTimeout(400); }
  if (await p.$('.ka-go, .kl-go')) console.log('UYARI: karakter paneli kapanmadı, ölçüm geçersiz');
  await p.evaluate(([STAGE, PADS]) => { const M = window.__marti; M.setTime(13); M.step(2); M.izgara(false); M.simCmd('money', 9e9); M.simCmd('level', 40); M.simCmd('unlock', 'isbul');
    try { M.simCmd('cmd', { kind: 'setStage', stage: STAGE }); } catch { /* */ }
    for (const k of PADS) try { M.simCmd('unlock', k); } catch { /* */ }
    for (let i = 0; i < 12; i++) { M.simCmd('hire'); M.step(1); }
    // karşı kıyı / AVM işletmeleri: satın alınmış, 5. kademe, 3 işçi, tüm ekipman (iç mekânlar canlı çalışsın)
    const all = { k1: ['espresso', 'vitrin', 'koltuk', 'isik', 'muzik', 'kitaplik', 'saksi', 'barista'], k2: ['kahve_bar', 'waffle_mak', 'buz_vitrin', 'isik', 'akvaryum', 'mangal', 'piyano', 'sef_seti'], k3: ['fotokopi', 'pos', 'laminasyon', 'kitap_raf', 'vitrin_k', 'oyuncak', 'yazici3d', 'okuma'], k4: ['tost_mak', 'buzdolap', 'semaver_k', 'mikrodalga', 'meyve', 'masa_k', 'ekran_k', 'izgara_k'], k5: ['benmari', 'corba_kazan', 'pide_firin', 'cay_ocak', 'ocakbasi', 'doner', 'tatli_vitrin', 'led_menu', 'sef_ocak'], k6: ['cay_mak', 'icecek_dolap', 'mac_tv', 'langirt', 'kupa', 'izgara_t', 'forma_duvar', 'vip'], k7: [], k8: [], k9: [] };
    for (const id of Object.keys(all)) { try { M.command({ kind: 'mulk', op: 'adminKafe', id, n: 5 }); for (let i = 0; i < 3; i++) M.command({ kind: 'mulk', op: 'adminIsci', id }); for (const e of all[id]) M.command({ kind: 'mulk', op: 'kafeEsya', id, e }); } catch { /* */ } }
    M.closeJobBoard?.(); M.closePanel?.(); M.setTime(12.3); for (let i = 0; i < 60; i++) M.step(1); }, [STAGE, PADS]);
  if (process.env.TELEPORT) { const [tx, tz] = process.env.TELEPORT.split(',').map(Number); await p.evaluate(([tx, tz]) => { const M = window.__marti; M.teleport(tx, tz); for (let k = 0; k < 20; k++) { M.step(0.5); M.renderFrames(1, 0.1); } }, [tx, tz]); }
  // ── aktör örnekleri ──
  const ornek = [];
  for (let s = 0; s < SURE; s++) { ornek.push(await p.evaluate(() => { const M = window.__marti; M.step(1); return M.ajanlar(); })); }
  if (process.env.YAKIN) { const [yx, yz] = process.env.YAKIN.split(',').map(Number); console.log('YAKIN', JSON.stringify(ornek[ornek.length - 1].filter(a => Math.hypot(a.x - yx, a.z - yz) < 1.5))); }
  const bulgu = [];
  { const say = {}; for (const a of ornek[ornek.length - 1]) say[a.kind] = (say[a.kind] || 0) + 1; console.log('  aktörler:', JSON.stringify(say), 'hata:', errs.slice(0, 3).join(' | ').slice(0, 400), JSON.stringify(await p.evaluate(() => { const st = window.__marti.state(); return { stage: st.stage, workers: (st.workers || []).length, money: st.money, kl: !!document.querySelector('.kl-go') }; }))); }
  const ciftSay = (filtre, esik, oran, kural, ad) => {
    const say = new Map(), poz = new Map();
    for (const liste of ornek) {
      const L = liste.filter(filtre);
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const A = L[i], B = L[j]; if (Math.abs((A.y || 0) - (B.y || 0)) > 1) continue;
        if (Math.hypot(A.x - B.x, A.z - B.z) < esik) { const k = A.key + '|' + B.key + '|' + A.kind; say.set(k, (say.get(k) || 0) + 1); poz.set(k, { a: ad(A), b: ad(B), x: A.x, z: A.z }); }
      }
    }
    for (const [k, n] of say) if (n / ornek.length >= oran) bulgu.push({ kural, oran: +(n / ornek.length).toFixed(2), ...poz.get(k) });
  };
  const adOf = a => `${a.kind}:${a.role || a.key}(${a.act}/${a.state || ''})`;
  ciftSay(a => ['worker', 'sakin', 'vip', 'regular'].includes(a.kind), 0.5, 0.6, 'K1 personel / sakin üst üste', adOf);
  ciftSay(a => a.kind === 'worker' && a.role === 'garson' && a.act === 'idle', 1.1, 0.5, 'K2 boştaki garsonlar yan yana', adOf);
  // K7 müşteri / misafir üst üste: iki müşteri (ya da müşteri + çalışan / sakin) aynı noktada (< 0.38 m) örneklerin yarısında
  ciftSay(a => ['musteri', 'regular', 'sakin', 'vip', 'worker'].includes(a.kind), 0.38, 0.5, 'K7 müşteri / kişi üst üste', adOf);
  for (const kd of ['gull', 'pigeon', 'cat', 'dog', 'parrot']) ciftSay(a => a.kind === kd, 0.35, 0.5, 'K3 hayvanlar üst üste', adOf);
  // ── sahne: tabela çakışması, iç içe yer propları ──
  const sahne = await p.evaluate((PROBE) => {
    const M = window.__marti, sc = M.sahne(); if (!sc) return { hata: 'sahne kancası yok (geliştirme derlemesi gerekli)' };
    sc.updateMatrixWorld(true);
    // her mesh en yakın adlı atasına bağlanır: "öğe"
    const oge = new Map();
    const T = sc.children[0]?.position?.constructor; void T;
    sc.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.visible || !o.geometry) return;   // instanced: geometri kutusu örnek konumlarını bilmez
      let v = true; for (let q = o; q; q = q.parent) if (!q.visible) { v = false; break; } if (!v) return;
      // öğe = adlı bir ebeveynin doğrudan çocuğu olan düğüm (adsız grup da olur: iskele-props içindeki gişe gibi); adlı ebeveynin
      // doğrudan çocuğu olan tek mesh parça sayılır, öğe ebeveynin kendisidir. GLB iç adları (Mesh_*) ad sayılmaz.
      const adli = q => !!q && !!q.name && !/^(Mesh_|Object_|node_)/i.test(q.name);
      let n = o; while (n.parent && n.parent !== sc && !adli(n.parent)) n = n.parent;
      if (n.isMesh && n.parent && adli(n.parent) && !adli(n)) n = n.parent;
      if (!n || n === sc || n.parent === sc) return;
      if (/^(contact|shadow|golge|zemin|ground|water|deniz|sky|gok)/i.test(n.name)) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox; if (!bb) return;
      const e = o.matrixWorld.elements, pts = [];
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) pts.push([e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]);
      const k = oge.get(n) || { mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] };
      for (const pt of pts) for (let i = 0; i < 3; i++) { k.mn[i] = Math.min(k.mn[i], pt[i]); k.mx[i] = Math.max(k.mx[i], pt[i]); }
      oge.set(n, k);
    });
    const yol = n => { const s = []; for (let q = n; q && q.parent; q = q.parent) s.unshift(q.name || ('#' + q.parent.children.indexOf(q))); return s.slice(-4).join('/'); };
    const L = [...oge].map(([n, k]) => ({ n, ad: yol(n), mn: k.mn, mx: k.mx, sx: k.mx[0] - k.mn[0], sy: k.mx[1] - k.mn[1], sz: k.mx[2] - k.mn[2] }))
      .filter(o => Math.abs(o.mn[0]) < 2000 && o.sx < 8 && o.sz < 8 && o.sy < 8 && o.sx * o.sz > 0.04);
    const ata = (a, b) => { for (let q = b.parent; q; q = q.parent) if (q === a) return true; return false; };
    const tabela = [], ic = [], yasak = [];
    for (const o of L) if (/^(torba|cop.?torba|garbage.?bag)/i.test(o.n.name)) yasak.push({ ad: o.ad, x: +o.mn[0].toFixed(1), z: +o.mn[2].toFixed(1) });
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const A = L[i], B = L[j];
      if (B.mn[0] > A.mx[0] || A.mn[0] > B.mx[0] || B.mn[2] > A.mx[2] || A.mn[2] > B.mx[2]) continue;
      if (ata(A.n, B.n) || ata(B.n, A.n)) continue;
      if (/treeblock|kr-tree|hero-|dog-|cat-|gull|^rig|crowd/.test(A.ad + ' ' + B.ad)) continue;   // gövde + taç (ayrı model) / insanlar (aktör kuralları ayrı)
      const ox = Math.min(A.mx[0], B.mx[0]) - Math.max(A.mn[0], B.mn[0]), oz = Math.min(A.mx[2], B.mx[2]) - Math.max(A.mn[2], B.mn[2]), oy = Math.min(A.mx[1], B.mx[1]) - Math.max(A.mn[1], B.mn[1]);
      if (ox <= 0 || oz <= 0 || oy <= 0) continue;
      const tab = o => o.mn[1] > 0.9 && o.sy < 3;
      if (tab(A) && tab(B)) { const v = ox * oy * oz, vm = Math.min(A.sx * A.sy * A.sz, B.sx * B.sy * B.sz); if (v / Math.max(vm, 1e-4) > 0.15) tabela.push({ a: A.ad, b: B.ad, x: +A.mn[0].toFixed(1), z: +A.mn[2].toFixed(1), oran: +(v / vm).toFixed(2) }); continue; }
      const yer = o => o.mn[1] < 0.25 && o.mn[1] > -0.3 && o.sx * o.sz >= 0.25 && o.sy > 0.3;
      if (yer(A) && yer(B)) { const f = ox * oz, fm = Math.min(A.sx * A.sz, B.sx * B.sz); if (f / fm > 0.45) ic.push({ a: A.ad, b: B.ad, x: +A.mn[0].toFixed(1), z: +A.mn[2].toFixed(1), oran: +(f / fm).toFixed(2) }); }
    }
    let yakinlar = null;
    const ray = PROBE.match(/^ray:(-?[\d.]+),(-?[\d.]+)$/);
    if (ray) { const out = []; const X = +ray[1], Z = +ray[2];
      sc.traverse(o => { if (!o.isMesh || !o.geometry) return; let v = true; for (let q = o; q; q = q.parent) if (!q.visible) { v = false; break; } if (!v) return;
        const pa = o.geometry.attributes.position; if (!pa) return; const e = o.matrixWorld.elements; let hit = 0, ymax = -1e9;
        for (let i = 0; i < pa.count; i += Math.max(1, Math.floor(pa.count / 4000))) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i); const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14]; if (Math.abs(wx - X) < 0.6 && Math.abs(wz - Z) < 0.6 && wy > 0.3) { hit++; ymax = Math.max(ymax, wy); } }
        if (hit) out.push({ ad: yol(o), hit, ymax: +ymax.toFixed(2), mat: o.material?.color?.getHexString?.() }); });
      return { oge: 0, tabela: [], ic: [], yasak: [], yakinlar: out };
    }
    if (PROBE) { const xz = PROBE.match(/^(-?[\d.]+),(-?[\d.]+)$/); const P = xz ? { mn: [+xz[1] - 1.5, 0, +xz[2] - 1.5], mx: [+xz[1] + 1.5, 3, +xz[2] + 1.5] } : L.find(o => o.n.name === PROBE); if (P) yakinlar = { p: { mn: P.mn.map(v => +v.toFixed(2)), mx: P.mx.map(v => +v.toFixed(2)) }, n: L.filter(o => o !== P && o.mx[0] > P.mn[0] - 1.5 && o.mn[0] < P.mx[0] + 1.5 && o.mx[2] > P.mn[2] - 1.5 && o.mn[2] < P.mx[2] + 1.5).map(o => ({ ad: o.ad, mn: o.mn.map(v => +v.toFixed(2)), mx: o.mx.map(v => +v.toFixed(2)) })) }; else yakinlar = 'yok'; }
    return { oge: L.length, tabela: tabela.slice(0, 80), ic: ic.slice(0, 120), yasak, yakinlar };
  }, process.env.PROBE || '');
  if (sahne.yakinlar) console.log('PROBE', JSON.stringify(sahne.yakinlar, null, 0));
  if (sahne.hata) { console.log('HATA', sahne.hata); process.exit(2); }
  for (const t of sahne.tabela) bulgu.push({ kural: 'K4 tabela çakışması', ...t });
  for (const t of sahne.ic) bulgu.push({ kural: 'K5 yer propları iç içe', ...t });
  for (const t of sahne.yasak) bulgu.push({ kural: 'K6 yasaklı prop', ...t });
  rapor[STAGE] = { bulgu, hata: errs.slice(0, 10), oge: sahne.oge };
  const say = {}; for (const f of bulgu) say[f.kural] = (say[f.kural] || 0) + 1;
  console.log(`aşama ${STAGE}: ${bulgu.length} bulgu`, JSON.stringify(say));
  if (process.env.SHOT) { await p.addStyleTag({ content: '#sbui{visibility:hidden!important}' }); await p.evaluate(() => { const M = window.__marti; M.teleport(0, -2); M.camera({ x: 0, z: -6, zoomRaw: 1.5, yaw: 0, tilt: 0.75 }); for (let k = 0; k < 10; k++) { M.step(0.1); M.renderFrames(2, 0.1); } }); await p.screenshot({ path: join(out, `asama-${STAGE}.png`), timeout: 300000 }); }
  await p.context().close();
}
writeFileSync(join(out, 'rapor.json'), JSON.stringify(rapor, null, 1));
await b.close(); srv.close();
const toplam = Object.values(rapor).reduce((s, r) => s + r.bulgu.length, 0);
process.exit(process.env.KATI && toplam ? 1 : 0);
