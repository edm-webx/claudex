// KAL-01 kayıt rozeti: Supabase istekleri route ile taklit edilir. Giriş yap, kayıt isteğini kes -> rozet "Kaydedilemedi",
// isteği geri ver -> "Kaydedildi". Çıktı: ekran görüntüleri (EKRAN_DIR). Kullanım: MARTI_DIST=<klasör> node tests/browser/kayit-rozet.spec.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const DIST = resolve(process.env.MARTI_DIST || 'dist');
const OUT = process.env.EKRAN_DIR || '/tmp/kayit-ekran'; mkdirSync(OUT, { recursive: true });
const srv = createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/' || p === '/index.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
let yazimlar = 0, kes = false;
const user = { id: 'u-test-1', aud: 'authenticated', role: 'authenticated', email: 'deneme@martikoy.com', app_metadata: {}, user_metadata: { ad: 'deneme' }, created_at: new Date().toISOString() };
await ctx.route('**/*supabase.co/**', route => {
  const r = route.request(), u = new URL(r.url()), m = r.method(), j = (o, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (u.pathname.startsWith('/auth/v1/token')) return j({ access_token: 'tok-1', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r-1', user });
  if (u.pathname.startsWith('/auth/v1/')) return j({});
  if (u.pathname === '/rest/v1/kayitlar') {
    if (m === 'POST') { if (kes) return route.abort('connectionfailed'); yazimlar++; return route.fulfill({ status: 201, body: '' }); }
    return j({ veri: { slots: [null, null, null, null] } });
  }
  return j(/object/.test(r.headers()['accept'] || '') ? {} : []);
});
await page.goto(`http://127.0.0.1:${srv.address().port}/?tier=akici&seed=3`);
await page.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
await page.waitForSelector('.sb-title [data-play]', { state: 'attached', timeout: 30000 });
await page.evaluate(() => document.querySelector('.sb-title [data-play]').click());
await page.waitForSelector('.gr-card', { timeout: 20000 });
await page.fill('input[name="ad"]', 'deneme'); await page.fill('input[name="sifre"]', 'sifre123');
await page.evaluate(() => document.querySelector('.gr-go').click());
await page.waitForTimeout(1500);
await page.evaluate(() => document.querySelector('[data-slot="0"]').click());
const go = await page.waitForSelector('.kl-go', { timeout: 15000 }).catch(() => null);
if (go) { await page.evaluate(() => document.querySelector('.kl-go').click()); await page.waitForTimeout(1200); }
let fail = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
const rozet = () => page.evaluate(() => { const e = document.getElementById('kayit-rozet'); return e ? { t: e.textContent, d: e.dataset.durum, gorunur: e.style.display !== 'none' } : null; });
const bekle = async (durum, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const r = await rozet(); if (r?.d === durum) return r; await page.waitForTimeout(150); } return rozet(); };
await page.evaluate(() => window.__marti.kayitIstek());
let r = await bekle('tamam'); ok(r?.d === 'tamam' && /^Kaydedildi \d\d:\d\d$/.test(r.t) && r.gorunur, 'başarılı yazım: ' + JSON.stringify(r)); ok(yazimlar >= 1, 'sunucuya kayıt isteği gitti (' + yazimlar + ')');
await page.waitForTimeout(450); await page.screenshot({ path: join(OUT, '02-kaydedildi.png') });
kes = true;
await page.evaluate(() => window.__marti.kayitIstek());
r = await bekle('hata'); ok(r?.d === 'hata' && r.t === 'Kaydedilemedi, tekrar deniyorum', 'istek kesilince rozet: ' + JSON.stringify(r));
await page.waitForTimeout(450); await page.screenshot({ path: join(OUT, '03-kaydedilemedi.png') });
await ctx.setOffline(true); await page.evaluate(() => window.dispatchEvent(new Event('offline')));
await page.evaluate(() => window.__marti.kayitIstek());
r = await bekle('cevrimdisi', 6000); ok(r?.d === 'cevrimdisi' || r?.d === 'hata', 'çevrimdışı rozeti: ' + JSON.stringify(r));
await page.waitForTimeout(450); await page.screenshot({ path: join(OUT, '04-cevrimdisi.png') });
await ctx.setOffline(false); kes = false;
await page.evaluate(() => window.dispatchEvent(new Event('online')));
r = await bekle('tamam'); ok(r?.d === 'tamam', 'ağ gelince hemen Kaydedildi: ' + JSON.stringify(r));
await page.waitForTimeout(450); await page.screenshot({ path: join(OUT, '05-geri-geldi.png') });
ok(errs.length === 0, 'sayfa hatası yok ' + errs.join(' | '));
await b.close(); srv.close(); process.exit(fail ? 1 : 0);
