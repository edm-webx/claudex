// Eğitici kartları uçtan uca: her kartı (içerik dosyasındaki bütün kimlikler) açar, kamera/halka/kart yerleşimini ölçer, ekran görüntüsü alır.
//   DIST=dist node tests/browser/egitici-dogrula.mjs <çıktıKlasörü> [kimlik,kimlik...]    VW/VH ile tek boyut, yoksa 667x375, 844x390, 932x430, 1280x720
// Ölçüler her kart için: halka (ya da HUD öğesi) ekranın içinde mi, kart ekranın içinde mi, kart halkayı örtüyor mu, etiket taşıyor mu, hedef (kamera) ekran merkezine ne kadar yakın.
// Çıkış kodu 1: örtüşme, taşma ya da konsol hatası var. Koşulsuz açılan (goster) kartlarda dünya hedefi yoksa "hedefsiz" yazılır (örn. kedi yokken kedi kartı).
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist');
const out = process.argv[2] || 'calisma/egitici-dogrula'; mkdirSync(out, { recursive: true });
const kaynak = readFileSync(resolve('src/content/egitici.ts'), 'utf8');
const ids = (process.argv[3] ? process.argv[3].split(',') : [...kaynak.matchAll(/^\s*\{ id: '([a-z_0-9]+)', grup:/gm)].map(m => m[1]));
const BOYUT = process.env.VW ? [[Number(process.env.VW), Number(process.env.VH)]] : [[667, 375], [844, 390], [932, 430], [1280, 720]];
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm', css: 'text/css' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = join(DIST, p === '/' ? 'index.html' : p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': p === '/' ? 'text/html' : TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(p === '/' ? '<!doctype html><html><head><meta charset="utf-8"></head><body>' + readFileSync(f, 'utf8') + '</body></html>' : readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const rapor = []; let hata = 0;
for (const [vw, vh] of BOYUT) {
  const p = await (await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: vw < 1000 })).newPage();
  const konsol = []; p.on('pageerror', e => konsol.push(e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=3&saat=13`);
  await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
  await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
  await kulisKapat(p, 'Olcum');
  await p.evaluate(() => { const M = window.__marti; M.setTime(13); M.step(2); M.simCmd('money', 2e6); M.simCmd('level', 12); for (let i = 0; i < 2; i++) { M.simCmd('hire'); M.step(1); }
    M.command({ kind: 'esnafim', op: 'done' }); M.step(1); M.skipCeremony?.(); M.collectWelcome?.(); M.closeJobBoard?.(); M.closePanel?.(); for (let i = 0; i < 40; i++) M.step(1); });
  for (const id of ids) {
    const r = await p.evaluate(async id => {
      const M = window.__marti, E = M.egitici(); E.kapat?.();
      M.closePanel?.(); await new Promise(r => setTimeout(r, 30));
      const acildi = E.goster(id);
      for (let k = 0; k < 24; k++) { M.step(0.2); M.renderFrames(1, 0.2); }   // kamera hedefe otursun
      await new Promise(r => setTimeout(r, 400));
      const ov = document.querySelector('.eg-ov'); if (!ov) return { id, acildi, yok: true };
      const R = e => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height, gor: getComputedStyle(e).display !== 'none' }; };
      const ring = R(ov.querySelector('.eg-ring')), card = R(ov.querySelector('.eg-card')), lbl = R(ov.querySelector('.eg-lbl')), pz = R(ov.querySelector('.eg-pz'));
      const btn = R(ov.querySelector('.eg-btn')), skip = R(ov.querySelector('.eg-skip'));
      return { id, acildi, ring, card, lbl, pz, btn, skip, dbg: E.dbg(), vw: innerWidth, vh: innerHeight, sayfa: ov.querySelector('.eg-k')?.textContent, bas: ov.querySelector('.eg-h')?.textContent, yan: [...ov.querySelector('.eg-card').classList].filter(c => ['sag', 'sol', 'alt'].includes(c))[0] };
    }, id);
    const s = { id, boyut: vw + 'x' + vh, sorun: [] };
    if (r.yok) { s.sorun.push('kart açılmadı'); }
    else {
      const ic = (x, W, H) => x.l >= -1 && x.t >= -1 && x.r <= W + 1 && x.b <= H + 1;
      s.hedef = r.ring.gor ? 'halka' : 'hedefsiz';
      if (!ic(r.card, r.vw, r.vh)) s.sorun.push('kart ekrandan taşıyor');
      if (r.ring.gor) {
        if (!(r.ring.l + r.ring.w / 2 > 0 && r.ring.l + r.ring.w / 2 < r.vw && r.ring.t + r.ring.h / 2 > 0 && r.ring.t + r.ring.h / 2 < r.vh)) s.sorun.push('halka ekran dışında');
        const kes = !(r.ring.r < r.card.l || r.ring.l > r.card.r || r.ring.b < r.card.t || r.ring.t > r.card.b);
        if (kes) s.sorun.push('kart halkayı örtüyor');
        if (r.lbl.gor && !ic(r.lbl, r.vw, r.vh)) s.sorun.push('etiket taşıyor');
      }
      if (r.pz.gor && !(r.pz.r < r.card.l || r.pz.l > r.card.r || r.pz.b < r.card.t || r.pz.t > r.card.b)) s.sorun.push('OYUN DURDU hapı karta biniyor');
      if (r.btn.w < 44 || r.btn.h < 40) s.sorun.push(`Anladım küçük ${Math.round(r.btn.w)}x${Math.round(r.btn.h)}`);
      s.kart = `${Math.round(r.card.w)}x${Math.round(r.card.h)}`; s.yan = r.yan; s.sayfa = r.sayfa;
      if (process.env.SHOT_HEPSI || s.sorun.length || ['arsa_alindi', 'tadilat_kare', 'sari_kare', 'arayuz', 'kasa'].includes(id)) await p.screenshot({ path: join(out, `${vw}x${vh}-${id}.png`) });
      // ikinci sayfa
      if (/\/\d/.test(r.sayfa || '')) {
        await p.evaluate(() => { const E = window.__marti.egitici(); document.querySelector('.eg-btn')?.click(); });
        await p.waitForTimeout(700); await p.evaluate(() => document.querySelector('.eg-btn')?.click());
        await p.evaluate(async () => { for (let k = 0; k < 30; k++) { window.__marti.step(0.05); window.__marti.renderFrames(1, 0.05); } });
        const r2 = await p.evaluate(() => { const ov = document.querySelector('.eg-ov'); if (!ov) return null; const b = e => e.getBoundingClientRect(); const rg = b(ov.querySelector('.eg-ring')), cd = b(ov.querySelector('.eg-card')); return { gor: getComputedStyle(ov.querySelector('.eg-ring')).display !== 'none', kes: !(rg.right < cd.left || rg.left > cd.right || rg.bottom < cd.top || rg.top > cd.bottom), tasma: cd.left < -1 || cd.top < -1 || cd.right > innerWidth + 1 || cd.bottom > innerHeight + 1, k: ov.querySelector('.eg-k')?.textContent }; });
        if (r2) { if (r2.gor && r2.kes) s.sorun.push('2. sayfada kart halkayı örtüyor'); if (r2.tasma) s.sorun.push('2. sayfada kart taşıyor'); s.sayfa2 = r2.k + (r2.gor ? ' halka' : ' hedefsiz'); if (process.env.SHOT_HEPSI || r2.kes) await p.screenshot({ path: join(out, `${vw}x${vh}-${id}-2.png`) }); }
      }
    }
    await p.evaluate(() => { window.__marti.egitici().kapat(); });
    await p.waitForTimeout(300);
    if (s.sorun.length) hata++;
    rapor.push(s); console.log(s.boyut, s.id.padEnd(16), (s.hedef || '').padEnd(8), s.kart || '', s.yan || '', s.sorun.length ? '!! ' + s.sorun.join('; ') : 'ok');
  }
  if (konsol.length) { rapor.push({ id: 'KONSOL', boyut: vw + 'x' + vh, sorun: konsol.slice(0, 5) }); hata++; }
  await p.context().close();
}
writeFileSync(join(out, 'rapor.json'), JSON.stringify(rapor, null, 1));
console.log('SORUNLU:', hata, '/', rapor.length);
await b.close(); srv.close(); process.exit(hata ? 1 : 0);
