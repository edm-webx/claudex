// 2026-11-23 yürüyüş turu botu: gerçek akış kayıtlarıyla (tests/sim/tam-oyun-botu.ts kayitKlasor -> asama-<N>.json) gerçek derlemede,
// GERÇEK girdiyle (window.__marti.input + step, nav yolu) büfeden her hedefe yürür; yolda hiç ışınlanmaz. Hedefler: görünen her sarı kare,
// sahip olunan dükkânların kapısı (kapı önü -> iç), üst geçit (güney ayak -> güverte -> kuzey ayak), AVM katları (giriş -> merdiven -> kat holü).
// Her adımda oyuncunun bir solid'in içinde ya da yürünemez hücrede olup olmadığına bakar (hayalet geçiş; dev kancası 'carpisma').
// Varılan, kilitsiz ve parası yeten karede durup paranın gerçekten çekildiğini dener (dwell, kat uyumu).
// Kullanım:
//   npx vite build --mode development --outDir dist-dev && MARTI_DIST=dist-dev node tools/build-artifact.mjs
//   npx vite-node tests/browser/yuruyus-turu.mjs [-- --kayit /tmp/claude-0/sp/kayitlar] [--asama 2,3] [--sinir 40]
// Çıktı: calisma/tam-oyun-botu/yuruyus-rapor.json; çıkış kodu 1: hayalet / takılma / varılamayan hedef ya da para çekmeyen kare.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { kulisKapat } from './kulis-kapat.mjs';
import { IC_MEKANLAR, icKapi, icWorld, icDim, icIcinde } from '../../src/content/ic-mekan';
import { ARSALAR } from '../../src/content/esya';
import { AVM_DIS, AVM_GIRIS_IC, AVM, avmYol, avmIcinde, YOL, MERD, SERIT } from '../../src/content/avm-kat';
import { UG } from '../../src/content/ustgecit';
import { gecitAcik } from '../../src/content/kilitli-bolge';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const A = process.argv.slice(2), al = (k, v) => { const i = A.indexOf(k); return i >= 0 ? (A[i + 1] ?? v) : v; };
const KAYIT = resolve(al('--kayit', '/tmp/claude-0/sp/kayitlar')), DIST = resolve(KOK, al('--dist', 'dist-dev'));
const ASAMALAR = al('--asama', ''), SINIR = Number(al('--sinir', 40));
const OUT = join(KOK, 'calisma/tam-oyun-botu'); mkdirSync(OUT, { recursive: true });
if (!existsSync(join(DIST, 'game.js'))) { console.error(`yuruyus: ${DIST}/game.js yok (npx vite build --mode development --outDir dist-dev)`); process.exit(2); }
const dosyalar = readdirSync(KAYIT).filter(f => /^asama-\d+\.json$/.test(f)).sort((a, b) => parseInt(a.slice(6)) - parseInt(b.slice(6)))
  .filter(f => !ASAMALAR || ASAMALAR.split(',').includes(f.slice(6, -5)));
if (!dosyalar.length) { console.error('yuruyus: kayıt yok: ' + KAYIT); process.exit(2); }

// kayıt kodu: engine/save exportCode ile aynı biçim ("MB1." + base64(UTF-8 {v,sum,json}), sum = FNV-1a 32)
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };
const kod = json => 'MB1.' + Buffer.from(JSON.stringify({ v: JSON.parse(json).version ?? 2, sum: fnv(json), json }), 'utf8').toString('base64');

const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.glb': 'model/gltf-binary', '.webp': 'image/webp' };
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/' || p === '/index.html') { res.writeHead(200, { 'content-type': types['.html'] }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

const r2 = v => Math.round(v * 100) / 100, pt = p => ({ x: r2(p.x), z: r2(p.z) });
const rapor = { tarih: new Date().toISOString(), kayit: KAYIT, asamalar: [], ozet: {} };

/** Sayfaya gövde açıklığıyla (yarıçap 0.36 + pay) A* kurar: nav ızgarası 0.5 m hücrelidir ve 0.5 m'lik çapraz aralıklardan yol verir, oyuncu
 *  gövdesi oradan geçemez (oyuncuda dokun-yürü yok; bu yalnız botun yol bulması). Hücre 0.3 m, serbest = 'carpisma' kancası (solid yok, yürünebilir). */
const ASTAR = () => {
  window.__ytYol = (a, b, kat, tol, PAY = 12) => {
    const M = window.__marti, C = 0.3, x0 = Math.min(a.x, b.x) - PAY, z0 = Math.min(a.z, b.z) - PAY;
    const W = Math.ceil((Math.max(a.x, b.x) + PAY - x0) / C), H = Math.ceil((Math.max(a.z, b.z) + PAY - z0) / C);
    const cx = i => x0 + (i % W + 0.5) * C, cz = i => z0 + (Math.floor(i / W) + 0.5) * C, hc = new Map();
    const bos = i => { let v = hc.get(i); if (v === undefined) { const c = M.carpisma(0.4, cx(i), cz(i), kat); v = !c.solid && c.yol; hc.set(i, v); } return v; };
    const idx = (x, z) => Math.floor((z - z0) / C) * W + Math.floor((x - x0) / C);
    const s0 = idx(a.x, a.z), hed = i => Math.hypot(cx(i) - b.x, cz(i) - b.z) <= tol;
    const g = new Map([[s0, 0]]), par = new Map(), heap = [[0, s0]], kapali = new Set();
    const h = i => { const dx = Math.abs(cx(i) - b.x), dz = Math.abs(cz(i) - b.z); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const push = e => { heap.push(e); let k = heap.length - 1; while (k > 0) { const q = (k - 1) >> 1; if (heap[q][0] <= e[0]) break; heap[k] = heap[q]; k = q; } heap[k] = e; };
    const pop = () => { const top = heap[0], e = heap.pop(); if (heap.length) { let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; if (l >= heap.length) break; const m = r < heap.length && heap[r][0] < heap[l][0] ? r : l; if (heap[m][0] >= e[0]) break; heap[k] = heap[m]; k = m; } heap[k] = e; } return top; };
    let n = 0, son = -1;
    while (heap.length && n < 250000) {
      const [, i] = pop(); if (kapali.has(i)) continue; kapali.add(i); n++;
      if (hed(i)) { son = i; break; }
      const ix = i % W, iz = Math.floor(i / W);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= W || jz >= H) continue;
        const j = jz * W + jx; if (kapali.has(j) || !bos(j)) continue;
        if (dx && dz && (!bos(iz * W + jx) || !bos(jz * W + ix))) continue;
        const ng = g.get(i) + (dx && dz ? 1.414 : 1) * C; if (ng < (g.get(j) ?? Infinity)) { g.set(j, ng); par.set(j, i); push([ng + h(j), j]); }
      }
    }
    if (son < 0) return null;
    const out = []; for (let i = son; i !== undefined && i !== s0; i = par.get(i)) out.push({ x: cx(i), z: cz(i) });
    return out.reverse();
  };
};

/** Sayfada yürür: her 0.1 sn adımda girdi = sıradaki ara noktaya yön (düz durak ya da gövde açıklıklı A* yolu). Işınlanma yok. */
async function yuru(p, ad, duraklar, { tol = 0.5, maxSn = 150 } = {}) {
  const sonuc = { ad, vardi: false, sn: 0, takildi: null, hayalet: [], son: null, maxY: 0, katlar: [], yolYok: [] };
  let i = 0, sn = 0, gecmis = [];
  while (i < duraklar.length && sn < maxSn) {
    // tek evaluate'te en çok 40 adım (4 sn); arada bir kare çizilir ki bölgeler (nav ızgaraları, collider'lar) yüklensin
    const r = await p.evaluate(([duraklar, i0, tol]) => {
      const M = window.__marti, out = { i: i0, iz: [], hay: [], yolYok: [] };
      let i = i0, yol = null, yolI = -1, yolT = 0;
      for (let k = 0; k < 40 && i < duraklar.length; k++) {
        const c = M.carpisma();
        if (!c.binik && (c.solid || !c.yol)) out.hay.push({ x: c.x, z: c.z, kat: c.kat, solid: c.solid, yol: c.yol });
        const d = duraklar[i], son = i === duraklar.length - 1, dt = d.tol ?? (son ? tol : 0.6);
        const katOk = d.kat === undefined || d.kat === c.kat;
        // tur hep yukarı çıkar: oyuncu durağın katını geçtiyse (merdiven erken bindirdi) o durak geride kaldı
        if ((katOk && Math.hypot(d.x - c.x, d.z - c.z) <= dt && !c.binik) || (d.avm && c.x > 1000) || (d.kat !== undefined && c.kat > d.kat && !c.binik)) { i++; yol = null; continue; }
        if (c.binik) { M.input(null); M.step(0.1); out.iz.push([c.x, c.z, c.y, c.kat]); continue; }
        let w = d;
        if (!d.duz) {
          if (!yol || yolI !== i || k - yolT >= 20) { const A0 = { x: c.x, z: c.z }, t0 = Math.max(0.25, dt - 0.15); yol = window.__ytYol(A0, d, c.kat, t0) || window.__ytYol(A0, d, c.kat, t0, 40); yolI = i; yolT = k; if (!yol) { out.yolYok.push({ i, m: Math.round(Math.hypot(d.x - c.x, d.z - c.z)) }); yol = M.path(A0, d); } }
          let j = 0, bd = Infinity; for (let q = 0; q < yol.length; q++) { const e = Math.hypot(yol[q].x - c.x, yol[q].z - c.z); if (e < bd) { bd = e; j = q; } }
          w = yol.slice(j).find(q => Math.hypot(q.x - c.x, q.z - c.z) > 0.5) || d;
        }
        const dx = w.x - c.x, dz = w.z - c.z, n = Math.hypot(dx, dz) || 1;
        M.input(dx / n, dz / n); M.step(0.1);
        out.iz.push([c.x, c.z, c.y, c.kat]);
      }
      M.input(null); M.renderFrames(1, 0.1);
      out.i = i; out.c = M.carpisma();
      return out;
    }, [duraklar, i, tol]);
    i = r.i; sn += r.iz.length * 0.1; sonuc.son = { x: r.c.x, z: r.c.z, kat: r.c.kat };
    for (const y of r.yolYok) { const e = sonuc.yolYok.find(q => q.i === y.i); if (!e) sonuc.yolYok.push(y); else e.m = Math.min(e.m, y.m); }
    for (const h of r.hay) if (!sonuc.hayalet.some(q => Math.hypot(q.x - h.x, q.z - h.z) < 1 && q.kat === h.kat)) sonuc.hayalet.push(h);
    for (const q of r.iz) { sonuc.maxY = Math.max(sonuc.maxY, q[2]); if (!sonuc.katlar.includes(q[3])) sonuc.katlar.push(q[3]); gecmis.push(q); }
    if (r.iz.length === 0 && i < duraklar.length) { sonuc.takildi = { ...sonuc.son, neden: 'adım yok' }; break; }
    // takılma: son 3 sn'de 0.3 m'den az yer değiştirme (merdivende binik değilken)
    gecmis = gecmis.slice(-31);
    if (gecmis.length >= 31) { const a = gecmis[0], z = gecmis[gecmis.length - 1]; if (Math.hypot(a[0] - z[0], a[1] - z[1]) < 0.3 && a[3] === z[3]) { sonuc.takildi = { ...sonuc.son, durak: i, hedef: pt(duraklar[i]), iz: gecmis.filter((_, k) => k % 6 === 0).map(q => q.map(r2)) }; break; } }
  }
  sonuc.vardi = i >= duraklar.length; sonuc.sn = r2(sn);
  return sonuc;
}

for (const f of dosyalar) {
  const json = readFileSync(join(KAYIT, f), 'utf8'), S0 = JSON.parse(json), asama = S0.stage;
  const p = await (await b.newContext({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1 })).newPage();
  const hatalar = []; p.on('pageerror', e => hatalar.push('PAGEERR ' + e.message));
  const q = `?save=yuruyus${asama}&noloop&tier=akici`;
  await p.goto(URL0 + q); await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
  const ok = await p.evaluate(c => window.__marti.importSave(c), kod(json));
  if (!ok) { console.error(f + ': importSave reddetti'); process.exit(2); }
  await p.goto(URL0 + q); await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
  await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
  await kulisKapat(p, 'Yuruyus', { sessiz: true });
  await p.evaluate(ASTAR);
  const bas = await p.evaluate(() => { const M = window.__marti; M.setTime(11); M.step(0.5); M.renderFrames(6, 0.1); const s = M.state(); return { pos: s.pos, stage: s.stage, money: M.S.money, paused: s.paused, pauseWhy: s.pauseWhy }; });
  console.log(`\n== ${f}: aşama ${bas.stage}, para ${Math.round(bas.money)}, başlangıç ${bas.pos.x},${bas.pos.z}${bas.paused ? ' DURAKLI ' + bas.pauseWhy : ''}`);
  const sahip = Object.keys(S0.zones?.arsa?.plots || {});
  // hedefler
  const hedef = [];
  // merdivende yalnız biniş ucu ve iniş sahanlığı durak (ara noktaları bant taşır). AVM kapısı: önüne yürü, sonra kapıya doğru yürümeye devam et; diyar geçişi (sim/avm-gecis.ts, 0.8 m) içeri alır
  const avmGir = (kat, to) => [{ ...AVM_DIS, tol: 0.9, avm: true }, { ...AVM_DIS, tol: 0, duz: true, avm: true }, { ...AVM_GIRIS_IC, kat: 0, tol: 1.0, duz: true }, ...avmYol(0, AVM_GIRIS_IC, kat, to).filter(w => Number.isInteger(w.y / AVM.FH) && !(w.x > SERIT.U.x0 && w.x < SERIT.U.x1 && w.z > MERD.on + 0.01 && w.z < MERD.arka + 0.5)).map(w => ({ x: w.x, z: w.z, kat: w.y / AVM.FH, duz: true }))];
  const padlar = await p.evaluate(() => window.__marti.rules.rt.pads.map(q => ({ key: q.key, x: q.pos.x, z: q.pos.z, kat: q.kat || 0, price: q.price, paid: q.paid })));
  for (const pd of padlar.slice(0, SINIR)) {
    const yol = avmIcinde(pd, 0.5) ? avmGir(pd.kat, pd) : [{ x: pd.x, z: pd.z }];
    yol[yol.length - 1] = { ...yol[yol.length - 1], kat: pd.kat };
    yol[yol.length - 1].tol = 0.7;   // kare yarıçapı 0.8
    hedef.push({ tur: 'kare', ad: 'kare ' + pd.key, yol, pad: pd });
  }
  // kapılar: sahip olunan dükkânlar + satın alma karesi görünenler (isl.<arsa> / avm.<arsa>: oyuncu oraya gidecek)
  const gorunen = padlar.map(q => /^(isl|avm)\.([a-z0-9]+)$/.exec(q.key)?.[2]).filter(Boolean);
  for (const id of [...new Set([...sahip, ...gorunen])]) {
    const m = IC_MEKANLAR.find(x => x.arsa === id); if (!m) continue;
    const { D } = icDim(m), dis = icKapi(m, 1.6), ic = icWorld(m, 0, D / 2 - 1.3);
    const yol = m.bina === 'avm' ? avmGir(m.kat || 0, dis).concat([{ ...ic, kat: m.kat || 0, duz: true }]) : [dis, { ...ic, duz: true }];
    hedef.push({ tur: 'kapi', ad: 'kapı ' + id + ' ' + m.ad, yol, oda: m.id });
  }
  hedef.push({ tur: 'ustgecit', ad: 'üst geçit', yol: [{ x: UG.x, z: UG.zA - 0.6 }, { x: UG.x, z: (UG.zB + UG.zC) / 2, duz: true }, { x: UG.x, z: UG.zD + 0.8, duz: true }] });
  for (let k = 0; k < AVM.KAT; k++) hedef.push({ tur: 'avm', ad: 'AVM kat ' + k, yol: avmGir(k, { x: (YOL.W.x0 + YOL.W.x1) / 2, z: MERD.arka + 1.25 }) });

  const sonuclar = [];
  for (const h of hedef) {
    await p.evaluate(([x, z]) => { const M = window.__marti; M.teleport(x, z, 0); M.step(0.2); M.renderFrames(2, 0.1); }, [bas.pos.x, bas.pos.z]);   // tur başı: büfeye dön (yürüyüş değil)
    const t0 = Date.now();
    const s = await yuru(p, h.ad, h.yol);
    const k = { tur: h.tur, ad: h.ad, hedef: pt(h.yol[h.yol.length - 1]), ...s, ms: Date.now() - t0 };
    if (h.tur === 'ustgecit') { k.gecitAcik = gecitAcik(S0); if (s.vardi !== k.gecitAcik) k.not = k.gecitAcik ? 'geçit açık ama geçilemedi' : 'geçit KAPALI ama geçildi'; }
    if (h.tur === 'kapi' && s.vardi) k.icerde = await p.evaluate(() => window.__marti.carpisma()).then(c => icIcinde(IC_MEKANLAR.find(m => m.id === h.oda), c));
    if (h.tur === 'kare' && s.vardi) {
      // dwell: kare kilitsiz (isletme-kareler 'sub' 🔒 yazmıyor) ve cepte para varsa 1.5 sn durunca para çekilmeli (ya da kare açılıp kaybolmalı)
      k.para = await p.evaluate(key => {
        const M = window.__marti, rt = M.rules.rt, it = M.rules.interactions.all().find(i => i.id === 'pad.' + key);
        let acik = false; try { acik = !!it && it.canAct(); } catch { acik = false; }
        const m0 = M.S.money, q0 = rt.pads.find(q => q.key === key), p0 = q0 ? q0.paid : 0, kalan = q0 ? q0.price - q0.paid : 0;
        M.input(null); M.step(1.5);
        const q1 = rt.pads.find(q => q.key === key), cekilen = m0 - M.S.money;
        M.S.money = m0;   // sonraki karelerin denemesi için cebi geri koy (kare ilerlemesi kalır)
        return { acik, kilitli: /🔒/.test(q0?.sub || ''), para0: Math.round(m0), kalan: Math.round(kalan), cekilen: Math.round(cekilen), odendi: Math.round((q1 ? q1.paid : (q0 ? q0.price : 0)) - p0), kayboldu: !q1, dwell: M.state().dwell };
      }, h.pad.key);
      k.paraHata = k.para.acik && !k.para.kilitli && k.para.para0 >= 1 && k.para.kalan > 1 && k.para.odendi <= 0 && !k.para.kayboldu;
    }
    sonuclar.push(k);
    console.log(`${s.vardi ? 'VARDI ' : 'VARAMADI'} ${h.ad.padEnd(34)} ${String(s.sn).padStart(5)} sn${s.takildi ? ' TAKILDI@' + s.takildi.x + ',' + s.takildi.z : ''}${s.hayalet.length ? ' HAYALET×' + s.hayalet.length + ' ' + JSON.stringify(s.hayalet[0]) : ''}${k.para ? ' para:' + (k.paraHata ? 'ÇEKMEDİ ' : '') + JSON.stringify(k.para) : ''}${k.icerde === false ? ' İÇERİ GİRMEDİ' : ''}${k.not ? ' ' + k.not : ''}`);
  }
  rapor.asamalar.push({ dosya: f, asama: bas.stage, para: Math.round(bas.money), baslangic: bas.pos, hatalar, sonuclar });
  await p.context().close();
}
await b.close(); srv.close();

const hepsi = rapor.asamalar.flatMap(a => a.sonuclar.map(s => ({ ...s, asama: a.asama })));
// AVM / üst geçit henüz açılmamışsa (kilitli bölge) varamamak hata değil: kilit sonucu ayrı sayılır
rapor.ozet = {
  hedef: hepsi.length, vardi: hepsi.filter(s => s.vardi).length,
  takildi: hepsi.filter(s => s.takildi && !(s.tur === 'ustgecit' && !s.gecitAcik)).map(s => `a${s.asama} ${s.ad} @${s.takildi.x},${s.takildi.z}`),
  hayalet: hepsi.filter(s => s.hayalet.length).map(s => `a${s.asama} ${s.ad}: ${s.hayalet.length} nokta, ilk ${JSON.stringify(s.hayalet[0])}`),
  ustGecit: hepsi.filter(s => s.not).map(s => `a${s.asama} ${s.ad}: ${s.not}`),
  varamadi: hepsi.filter(s => !s.vardi && !(s.tur === 'ustgecit' && !s.gecitAcik)).map(s => `a${s.asama} ${s.ad} (son ${s.son?.x},${s.son?.z} kat ${s.son?.kat})`),
  // gövde açıklıklı yol yalnız hedefe yakınken (< 15 m; uzak bölgeler henüz yüklenmemiş olabilir) bulunamadıysa sayılır
  gövdeYoluYok: hepsi.filter(s => s.yolYok.some(y => y.m < 15)).map(s => `a${s.asama} ${s.ad} (${JSON.stringify(s.yolYok)})`),
  icerGirmedi: hepsi.filter(s => s.icerde === false).map(s => `a${s.asama} ${s.ad}`),
  paraCekmedi: hepsi.filter(s => s.paraHata).map(s => `a${s.asama} ${s.ad}`),
  sayfaHatasi: rapor.asamalar.flatMap(a => a.hatalar.map(h => `a${a.asama} ${h}`)),
};
writeFileSync(join(OUT, 'yuruyus-rapor.json'), JSON.stringify(rapor, null, 1));
const o = rapor.ozet;
console.log(`\nÖZET: ${o.hedef} hedef, ${o.vardi} varıldı, ${o.takildi.length} takılma, ${o.hayalet.length} hayalet, ${o.varamadi.length} varılamadı, ${o.paraCekmedi.length} para çekmeyen kare`);
for (const k of ['takildi', 'hayalet', 'ustGecit', 'varamadi', 'gövdeYoluYok', 'icerGirmedi', 'paraCekmedi', 'sayfaHatasi']) for (const x of o[k]) console.log(`  [${k}] ${x}`);
console.log('rapor: ' + join(OUT, 'yuruyus-rapor.json'));
process.exit(o.takildi.length || o.hayalet.length || o.varamadi.length || o.paraCekmedi.length || o.icerGirmedi.length || o.ustGecit.length ? 1 : 0);
