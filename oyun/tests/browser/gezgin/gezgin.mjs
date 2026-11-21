// KAL-13 sürekli gezgin gözlemci bot. Manifestten (tools/gezgin-manifest.mjs) her binaya gerçek nav yoluyla yürür, kapıdan girer, içerideki
// noktaları gezer, çıkar; kayıtlı her etkileşim noktasına (window.__marti.etkilesimler()) yürür. Her durakta konsol/sayfa hatası, NaN, takılma,
// kare süresi, çizim sayıları, bellek, bekçi (?qa=1) anomalileri ve ekran görüntüsü toplar.
//
// Kullanım:
//   node tests/browser/gezgin/gezgin.mjs [--profil hizli|tam|surekli] [--build | --dist KLASÖR] [--tohum N] [--esik 0.9] [--cikti KLASÖR]
//       [--kapat <binaId>]        fixture: o binanın kapısını yürünebilir ağda kapatır; bot 'girilemedi' bulgusu vermeli
//       [--hata-enjekte]          fixture: sayfaya konsol hatası, NaN para atar; bot yakalamalı
//   --profil surekli: tohumlu rastgele gezgin (her koşuda farklı --tohum); hata çıkınca tohum + komut günlüğü rapora yazılır.
//   --sure <dk> (surekli profil süresi, varsayılan 10)
// Çıktı: <cikti>/gezgin-rapor.json, <cikti>/*.png (varsayılan tests/browser/shots-gezgin/gezgin). Çıkış kodu 1: kapsam eşiği altı ya da 'bug' bulgusu.
// SwiftShader: kare süreleri yalnız CPU süresidir; GPU FPS iddiası yok, yalnız göreli karşılaştırma.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const A = process.argv.slice(2), al = (k, v) => { const i = A.indexOf(k); return i >= 0 ? (A[i + 1] ?? true) : v; }, var_ = k => A.includes(k);
const PROFIL = al('--profil', 'hizli'), TOHUM = Number(al('--tohum', 3)), ESIK = Number(al('--esik', 0.9)), SURE_DK = Number(al('--sure', 10));
const OUT = resolve(al('--cikti', join(KOK, 'tests/browser/shots-gezgin/gezgin'))); mkdirSync(OUT, { recursive: true });

let DIST = resolve(al('--dist', join(KOK, 'dist')));
if (var_('--build')) {
  DIST = mkdtempSync(join(tmpdir(), 'marti-gezgin-'));
  const env = { ...process.env, MARTI_DIST: DIST };
  const r1 = spawnSync('npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], { stdio: 'inherit', env, cwd: KOK });
  const r2 = r1.status === 0 ? spawnSync(process.execPath, ['tools/build-artifact.mjs'], { stdio: 'inherit', env, cwd: KOK }) : r1;
  if (r2.status !== 0) { console.error('gezgin: derleme başarısız'); process.exit(2); }
}
if (!existsSync(join(DIST, 'game.js'))) { console.error(`gezgin: ${DIST}/game.js yok (--build ya da --dist)`); process.exit(2); }
const M = JSON.parse(readFileSync(join(KOK, 'tests/browser/gezgin/manifest.json'), 'utf8'));
const BIL = existsSync(join(KOK, 'tests/browser/gezgin/bilinen.json')) ? JSON.parse(readFileSync(join(KOK, 'tests/browser/gezgin/bilinen.json'), 'utf8')) : { girilemeyen: {}, cikamayan: {} };

const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.glb': 'model/gltf-binary', '.webp': 'image/webp' };
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/' || p === '/index.html') { res.writeHead(200, { 'content-type': types['.html'] }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/`;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();

const rapor = { profil: PROFIL, tohum: TOHUM, baslangic: new Date().toISOString(), kapsam: {}, duraklar: [], bulgular: [], hatalar: [], bekci: [], komutGunlugu: [], fixture: { kapat: al('--kapat', null), hataEnjekte: var_('--hata-enjekte') } };
p.on('pageerror', e => rapor.hatalar.push('PAGEERR ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/supabase|Failed to load resource|ERR_|favicon/.test(m.text())) rapor.hatalar.push('CONSOLE ' + m.text()); });
const bulgu = (siddet, nerede, ne) => {
  // bilinen.json'daki girilemeyen/çıkılamayan bina bulguları 'bilinen' olarak işaretlenir (kırmızı vermez)
  const id = (nerede.match(/^bina-([A-Za-z0-9]+)/) || [])[1] || (ne.match(/^([A-Za-z0-9]+) kapısından girilemedi/) || [])[1];
  if (siddet === 'bug' && id && ((/girilemedi/.test(ne) && BIL.girilemeyen[id]) || (/çıkılamadı/.test(ne) && BIL.cikamayan[id]))) siddet = 'bilinen';
  rapor.bulgular.push({ siddet, nerede, ne }); console.log(`[${siddet}] ${nerede}: ${ne}`);
};
const ev = (f, a) => p.evaluate(f, a);
const log = (k, d) => { if (rapor.komutGunlugu.length < 2000) rapor.komutGunlugu.push({ k, ...d }); };

await p.goto(`${url}?fresh=1&noloop&tier=akici&seed=${TOHUM}&qa=1&stage=10`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
await ev(() => window.__marti.play('sabri')); await ev(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 6000 }).catch(() => null); if (go) { await go.click({ force: true }); await p.waitForTimeout(600); }
await ev(() => { const M = window.__marti; M.setTime(13); M.step(2); M.simCmd('money', 9e9); M.simCmd('level', 40); M.perfRecord?.(true); });
// canlı işletmeleri aç (kafeler, kırtasiye...): iç mekan işçi ve müşteriyle dolu görünsün
await ev(m => { const M = window.__marti; for (const a of m.arsalar) if (a.sabit) { M.command({ kind: 'mulk', op: 'adminKafe', id: a.id, n: 3 }); M.command({ kind: 'mulk', op: 'adminIsci', id: a.id }); } M.step(2); }, M);

const snap = async ad => { try { await p.screenshot({ path: join(OUT, ad + '.png'), timeout: 120000 }); } catch { bulgu('uyari', ad, 'ekran görüntüsü alınamadı'); } };
const durum = () => ev(() => { const M = window.__marti, s = M.state(), i = M.info(); return { pos: s.pos, calls: i.calls, tris: i.tris, geos: i.geos, tex: i.tex ?? i.textures, fps: i.fps, bellek: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, money: M.S.money, xp: M.S.xp }; });
const mesafe = (a, c) => Math.hypot(a.x - c.x, a.z - c.z);
const poz = async () => (await ev(() => window.__marti.state().pos));

/** Gerçek nav yoluyla yürür: yol noktalarına doğru girdi verir, ilerleme yoksa takıldı sayar. @returns {Promise<{ok: boolean, takildi: boolean, adim: number}>} */
async function yuru(hedef, { tol = 0.9, maxAdim = 260, ad = '' } = {}) {
  let son = null, durgun = 0, adim = 0;
  for (; adim < maxAdim; adim++) {
    const r = await ev(([hx, hz, tol]) => {
      const M = window.__marti, pos = M.state().pos;
      if (Math.hypot(hx - pos.x, hz - pos.z) <= tol) { M.input(null); return { bitti: true, pos }; }
      const yol = M.path(pos, { x: hx, z: hz });
      let w = yol.find(q => Math.hypot(q.x - pos.x, q.z - pos.z) > 0.6) || { x: hx, z: hz };
      const dx = w.x - pos.x, dz = w.z - pos.z, n = Math.hypot(dx, dz) || 1;
      M.input(dx / n, dz / n); M.step(0.25); M.input(null);
      return { bitti: false, pos: M.state().pos };
    }, [hedef.x, hedef.z, tol]);
    if (r.bitti) { return { ok: true, takildi: false, adim }; }
    if (!Number.isFinite(r.pos.x) || !Number.isFinite(r.pos.z)) { bulgu('bug', ad, 'konum NaN'); return { ok: false, takildi: true, adim }; }
    if (son && mesafe(son, r.pos) < 0.02) durgun++; else durgun = 0;
    son = r.pos;
    if (durgun >= 8) return { ok: false, takildi: true, adim };
  }
  return { ok: false, takildi: false, adim };
}

// kapsam hesapları
const kapsam = { binaGirildi: [], binaGirilemedi: [], binaCikildi: [], etkilesimDenenen: [], etkilesimBilinen: [], etkilesimToplam: 0, noktaDenenen: 0, noktaToplam: 0 };
const tara = async (ad, { sn = false } = {}) => {
  await ev(() => { const M = window.__marti; M.renderFrames(4, 0.1); M.step(0.5); });
  const d = await durum(); const kayit = { ad, ...d }; rapor.duraklar.push(kayit);
  if (!d.pos || !Number.isFinite(d.pos.x) || !Number.isFinite(d.pos.z)) bulgu('bug', ad, 'konum NaN');
  if (!Number.isFinite(d.money)) bulgu('bug', ad, 'para NaN');
  if (!(d.calls > 0)) bulgu('bug', ad, 'çizim sayısı 0');
  const an = await ev(() => window.__marti.bekci?.anomaliler() ?? []);
  for (const x of an) if (!rapor.bekci.some(y => y.tur === x.tur && y.anahtar === x.anahtar && y.t === x.t)) { rapor.bekci.push(x); bulgu('bug', ad, `bekçi anomali [${x.tur}]: ${x.ayrinti}`); }
  if (sn) await snap(ad);
  return kayit;
};

// hata enjeksiyonu fixture'ı: konsol hatası + NaN para; bot ve bekçi yakalamalı
if (var_('--hata-enjekte')) { await ev(() => { console.error('ENJEKTE konsol hatası'); setTimeout(() => { throw new Error('ENJEKTE sayfa hatası'); }, 0); window.__marti.S.money = NaN; window.__marti.step(2); }); await p.waitForTimeout(300); await tara('enjeksiyon'); await ev(() => { window.__marti.S.money = 9e9; }); }
// kapı kapatma fixture'ı
const kapat = al('--kapat', null);
if (kapat) { const b0 = M.binalar.find(x => x.id === kapat); if (!b0) { console.error('--kapat: bina yok ' + kapat); process.exit(2); } const k = b0.kapi; await ev(r => window.__marti.navKapat(r, true), { x0: k.x - 1.0, x1: k.x + 1.0, z0: k.z - 1.0, z1: k.z + 1.0 }); bulgu('bilgi', kapat, 'fixture: kapı çevresi kapatıldı'); }

// 1) dış duraklar
const hizli = PROFIL === 'hizli';
const duraklar = hizli ? M.duraklar.slice(0, 2) : M.duraklar;
for (const d of duraklar) {
  await ev(([x, z]) => window.__marti.teleport(x, z), [d.x, d.z]); log('teleport', d);
  const k = await tara(d.ad, { sn: true });
  if (Math.abs(k.pos.x - d.x) > 25) bulgu('bug', d.ad, `ışınlanma tutmadı: istenen ${d.x}, olan ${k.pos.x}`);
}
// 2) binalar: dış kapı önüne ışınla (bölgeler arası uzak), içeri yürü, noktaları gez, çık
const girisHazirla = async (b0, ad = 'bina-' + b0.id) => {   // kapı önüne gelir; kapısı başka binanın içinde olan odada önce ebeveyne girer
  if (b0.ebeveyn) { const eb = M.binalar.find(x => x.id === b0.ebeveyn); await girisHazirla(eb); await yuru(eb.kapiIc, { tol: 0.8, ad }); }
  await ev(([x, z]) => window.__marti.teleport(x, z), [b0.kapiDis.x, b0.kapiDis.z]); log('teleport-kapi', { id: b0.id });
  return yuru(b0.kapiDis, { ad });
};
const binalar = hizli ? M.binalar.filter(x => ['kafe1', 'avm', 'banka'].includes(x.id)) : M.binalar;
kapsam.binaToplam = binalar.length;
for (const bn of binalar) {
  const ad = 'bina-' + bn.id;
  const yDis = await girisHazirla(bn); if (!yDis.ok) bulgu('uyari', ad, 'kapı önüne yürünemedi' + (yDis.takildi ? ' (takıldı)' : ''));
  const yIc = await yuru(bn.kapiIc, { tol: 0.8, ad }); log('yuru-ic', { id: bn.id, ...yIc });
  const girdi = await ev(b => { const M = window.__marti, pos = M.state().pos; return Math.abs(pos.x - b.merkez.x) < b.boy.wx / 2 && Math.abs(pos.z - b.merkez.z) < b.boy.wz / 2; }, bn);
  if (!girdi) { kapsam.binaGirilemedi.push(bn.id); bulgu('bug', ad, `girilemedi: kapıdan içeri yürünemedi (${yIc.takildi ? 'takıldı' : 'varılamadı'})`); await tara(ad + '-girilemedi', { sn: true }); continue; }
  kapsam.binaGirildi.push(bn.id);
  for (const nk of bn.noktalar) {
    kapsam.noktaToplam++;
    const y = await yuru(nk, { tol: 0.9, maxAdim: 160, ad: ad + ':' + nk.ad });
    if (y.ok) kapsam.noktaDenenen++; else if (y.takildi) bulgu('uyari', ad, `iç nokta "${nk.ad}" için yol takıldı`);
  }
  await tara(ad, { sn: true });
  // çıkış: kapı önüne geri yürü
  const yc = await yuru(bn.kapiDis, { tol: 1.2, ad }); const cikti = await ev(b => { const pos = window.__marti.state().pos; return !(Math.abs(pos.x - b.merkez.x) < b.boy.wx / 2 - 0.3 && Math.abs(pos.z - b.merkez.z) < b.boy.wz / 2 - 0.3); }, bn);
  if (cikti) kapsam.binaCikildi.push(bn.id); else bulgu('bug', ad, 'çıkılamadı: içeriden kapı önüne yürünemedi');
}
// 3) kayıtlı her etkileşim noktası (istasyon, pad, kapı...) için yürü ve değ
const et = await ev(() => window.__marti.etkilesimler());
kapsam.etkilesimToplam = et.length;
const etListe = hizli ? et.slice(0, 8) : et;
for (const e of etListe) {
  // bina içindeki nokta: önce kapıdan gir (oyuncu da öyle ulaşır); dışarıdaki nokta: yakınına ışınla, yürü
  const bn = M.binalar.find(x => Math.abs(e.x - x.merkez.x) < x.boy.wx / 2 && Math.abs(e.z - x.merkez.z) < x.boy.wz / 2);
  let hazir = true;
  if (bn) {
    hazir = (await girisHazirla(bn)).ok && (await yuru(bn.kapiIc, { tol: 0.8, ad: 'etkilesim:' + e.id })).ok;
    if (!hazir) bulgu('bug', 'etkilesim:' + e.id, `${bn.id} kapısından girilemedi, içerideki etkileşime ulaşılamıyor`);
  } else await ev(([x, z]) => window.__marti.teleport(x, z + 5), [e.x, e.z]);
  if (!hazir) { if (bn && BIL.girilemeyen[bn.id]) kapsam.etkilesimBilinen.push(e.id); continue; }
  const y = await yuru({ x: e.x, z: e.z }, { tol: Math.max(0.8, e.radius * 0.6), maxAdim: 160, ad: 'etkilesim:' + e.id });
  if (y.ok) kapsam.etkilesimDenenen.push(e.id); else if (y.takildi) bulgu('uyari', 'etkilesim:' + e.id, 'etkileşim noktasına yürünemedi (takıldı)');
}
await tara('son', { sn: true });

// 4) sürekli profil: tohumlu rastgele gezinti
if (PROFIL === 'surekli') {
  let s = TOHUM >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const bit = Date.now() + SURE_DK * 60000; let tur = 0;
  while (Date.now() < bit) {
    const hdf = rnd() < 0.6 ? M.binalar[Math.floor(rnd() * M.binalar.length)] : null;
    const t = hdf ? hdf.kapiDis : M.duraklar[Math.floor(rnd() * M.duraklar.length)];
    await ev(([x, z]) => window.__marti.teleport(x, z + 4), [t.x, t.z]); log('rastgele', { tur, hedef: hdf?.id ?? t.ad });
    await yuru(t, { maxAdim: 100 }); await tara('surekli-' + (tur % 20), { sn: tur % 10 === 0 }); tur++;
    if (rapor.bulgular.some(x => x.siddet === 'bug') && rapor.hatalar.length) { rapor.yenidenUretim = { tohum: TOHUM, profil: 'surekli', not: 'tohum + komutGunlugu ile yeniden üret (KAL-03 replay)' }; break; }
  }
}

// kare süresi özeti (SwiftShader: yalnız göreli CPU süresi)
try { const d = await ev(() => window.__marti.perfDump?.()); if (d) { const f = d.frames ?? d.kare ?? d; rapor.kareSuresi = typeof f === 'object' ? JSON.stringify(f).slice(0, 600) : String(f).slice(0, 600); } } catch { /* perf kaydı yok */ }
for (const e of [...new Set(rapor.hatalar)].slice(0, 20)) bulgu('bug', 'konsol', e);
const topla = (ad, bol, top) => ({ ad, bol, top, oran: top ? +(bol / top).toFixed(3) : 1 });
rapor.kapsam = { ...kapsam, ozet: [topla('bina girildi', kapsam.binaGirildi.length, kapsam.binaToplam), topla('bina çıkıldı', kapsam.binaCikildi.length, kapsam.binaToplam), topla('iç nokta', kapsam.noktaDenenen, kapsam.noktaToplam), topla('etkileşim', kapsam.etkilesimDenenen.length + kapsam.etkilesimBilinen.length, etListe.length)],
  denenmeyen: { bina: binalar.map(x => x.id).filter(x => !kapsam.binaGirildi.includes(x)), etkilesim: etListe.map(x => x.id).filter(x => !kapsam.etkilesimDenenen.includes(x)), bilinenEngelli: kapsam.etkilesimBilinen } };
for (const o of rapor.kapsam.ozet) console.log(`kapsam: ${o.ad} ${o.bol} / ${o.top}`);
// kapsam eşiği: bilinen (teşhis edilmiş) girilemeyen/çıkılamayan binalar 'denenmiş' sayılır; yeni düşüş eşiği geçirmez
const bGir = kapsam.binaGirilemedi.filter(x => BIL.girilemeyen[x]).length, bCik = binalar.filter(x => !kapsam.binaCikildi.includes(x.id) && BIL.cikamayan[x.id]).length;
for (const o of rapor.kapsam.ozet) { if (o.ad === 'bina girildi') o.bol += bGir; if (o.ad === 'bina çıkıldı') o.bol += bGir + bCik; o.oran = o.top ? +(o.bol / o.top).toFixed(3) : 1; }
for (const id of binalar.map(x => x.id)) if (kapsam.binaGirildi.includes(id) && BIL.girilemeyen[id]) bulgu('bilgi', 'bilinen', `${id} artık girilebiliyor: bilinen.json girilemeyen listesinden sil`);
const dusuk = rapor.kapsam.ozet.filter(o => o.oran < ESIK);
for (const o of dusuk) bulgu('bug', 'kapsam', `${o.ad} ${o.bol}/${o.top} eşik ${ESIK} altında`);
rapor.bitis = new Date().toISOString();
writeFileSync(join(OUT, 'gezgin-rapor.json'), JSON.stringify(rapor, null, 1));
const bugs = rapor.bulgular.filter(x => x.siddet === 'bug').length, bil = rapor.bulgular.filter(x => x.siddet === 'bilinen').length;
console.log(`\ngezgin(${PROFIL}): ${rapor.duraklar.length} durak, ${bugs} bug, ${bil} bilinen, ${rapor.bulgular.length} bulgu -> ${join(OUT, 'gezgin-rapor.json')}`);
await b.close(); srv.close(); process.exit(bugs ? 1 : 0);
