// KAYIT-GUV (tarama 2026-11-21 KAYIT/BULUT): gerçek oyun + taklit Supabase (rev kilitli kayitlar satırı).
// Senaryolar: okuma hatası, yeni sürüm bulut kaydı, bozuk bulut kaydı, çevrimdışı kapanış + yerel yedek, çift sekme.
// Kullanım: MARTI_DIST=dist node tests/browser/kayit-guvenligi.spec.mjs  (önce: npx vite build && node tools/build-artifact.mjs)
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const DIST = resolve(process.env.MARTI_DIST || 'dist');
const OUT = process.env.EKRAN_DIR || '/tmp/kayit-guv-ekran'; mkdirSync(OUT, { recursive: true });
const srv = createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/' || p === '/index.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const URL0 = `http://127.0.0.1:${srv.address().port}/?tier=akici&seed=3`;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };
const user = { id: 'u-test-1', aud: 'authenticated', role: 'authenticated', email: 'deneme@martikoy.com', app_metadata: {}, user_metadata: { ad: 'deneme' }, created_at: new Date().toISOString() };
const kopya = x => JSON.parse(JSON.stringify(x));
const kodBoz = code => JSON.parse(Buffer.from(code.replace(/^MB1\./, ''), 'base64').toString('utf8'));
const kodYap = env => 'MB1.' + Buffer.from(JSON.stringify(env), 'utf8').toString('base64');
const paraOf = code => Math.floor(JSON.parse(kodBoz(code).json).money || 0);

/** taklit sunucu: tek kayitlar satırı, veri->>rev üzerinde iyimser kilit */
function sunucu(S, ctx) {
  return ctx.route('**/*supabase.co/**', async route => {
    const r = route.request(), u = new URL(r.url()), m = r.method(), j = (o, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.pathname.startsWith('/auth/v1/token')) return j({ access_token: 'tok-1', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r-1', user });
    if (u.pathname.startsWith('/auth/v1/')) return j({});
    if (u.pathname === '/rest/v1/kayitlar') {
      if (m === 'GET') { S.gets++; if (S.okuHata) return j({ message: 'down' }, 503); return j(S.row ? [{ veri: kopya(S.row.veri) }] : []); }
      if (S.yazKes) return route.abort('connectionfailed');
      const body = JSON.parse(r.postData() || '{}');
      if (m === 'POST') { if (S.row) return j({ code: '23505', message: 'duplicate key' }, 409); S.row = { veri: body.veri }; S.writes++; return route.fulfill({ status: 201, body: '' }); }
      if (m === 'PATCH') {
        const f = u.searchParams.get('veri->>rev') || '', cur = S.row?.veri?.rev;
        const eslesir = !!S.row && (f === 'is.null' ? cur == null : f === 'eq.' + cur);
        if (eslesir) { S.row = { veri: body.veri }; S.writes++; }
        return /representation/.test(r.headers()['prefer'] || '') ? j(eslesir ? [{ id: user.id }] : []) : route.fulfill({ status: 204, body: '' });
      }
    }
    return j(/object/.test(r.headers()['accept'] || '') ? {} : []);
  });
}
async function yeniSayfa(ctx) {
  const page = await ctx.newPage();
  page.errs = []; page.on('pageerror', e => page.errs.push(String(e).slice(0, 200)));
  await page.goto(URL0);
  await page.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
  await page.waitForSelector('.sb-title [data-play]', { state: 'attached', timeout: 30000 });
  await page.evaluate(() => document.querySelector('.sb-title [data-play]').click());
  await page.waitForSelector('.gr-card', { timeout: 20000 });
  await page.fill('input[name="ad"]', 'deneme'); await page.fill('input[name="sifre"]', 'sifre123');
  await page.evaluate(() => document.querySelector('.gr-go').click());
  await page.waitForSelector('.gr-sl, [data-retry]', { timeout: 20000 });
  return page;
}
async function slotGir(page, i) {
  await page.evaluate(n => document.querySelector(`[data-slot="${n}"]`).click(), i);
  await kulisKapat(page, 'Olcum', { bekle: 6000, ui: true });
  await page.waitForTimeout(1500);
}
const rozet = page => page.evaluate(() => { const e = document.getElementById('kayit-rozet'); return e ? { t: e.textContent, d: e.dataset.durum } : null; });
const bekle = async (page, durum, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const r = await rozet(page); if (r?.d === durum) return r; await page.waitForTimeout(150); } return rozet(page); };

// ── 0) temel: boş yuvada karakter aç, kaydet -> sunucuda gerçek bir kod olsun (sonraki senaryoların tabanı)
let TABAN;
{
  const S = { row: null, okuHata: false, yazKes: false, gets: 0, writes: 0 };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await sunucu(S, ctx);
  const p = await yeniSayfa(ctx); await slotGir(p, 0);
  await p.evaluate(() => window.__marti.kayitIstek());
  const r = await bekle(p, 'tamam');
  ok(r?.d === 'tamam' && S.row?.veri?.slots?.[0]?.code, '0) yeni karakter buluta yazıldı: ' + JSON.stringify(r));
  TABAN = kopya(S.row.veri); TABAN.rev = undefined; delete TABAN.rev;
  TABAN.banka = { tl: 777, esya: { simit: 3 } };
  ok(p.errs.length === 0, '0) sayfa hatası yok ' + p.errs.join(' | '));
  await ctx.close();
}
const TKOD = TABAN.slots[0].code;

// ── 1) okuma hatası: 4 boş yuva görünmez, hiçbir şey yazılmaz; düzelince gerçek yuvalar gelir
{
  const S = { row: { veri: kopya(TABAN) }, okuHata: true, yazKes: false, gets: 0, writes: 0 };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await sunucu(S, ctx);
  const p = await yeniSayfa(ctx);
  const ekran = await p.evaluate(() => ({ retry: !!document.querySelector('[data-retry]'), slot: document.querySelectorAll('[data-slot]').length, t: document.querySelector('.gr-h')?.textContent }));
  await p.screenshot({ path: join(OUT, '1-okuma-hatasi.png') });
  ok(ekran.retry && ekran.slot === 0, '1) okuma hatasında yuva yok, "Tekrar dene" var: ' + JSON.stringify(ekran));
  ok(S.writes === 0, '1) hiçbir yazım gitmedi');
  S.okuHata = false;
  await p.evaluate(() => document.querySelector('[data-retry]').click());
  await p.waitForSelector('[data-slot]', { timeout: 10000 }).catch(() => null);
  const ad = await p.evaluate(() => document.querySelector('[data-slot="0"]')?.textContent || '');
  ok(/seviye/.test(ad), '1) yeniden deneyince gerçek karakter görünür: ' + ad.slice(0, 60));
  ok(JSON.stringify(S.row.veri) === JSON.stringify(TABAN), '1) kayıt ve banka olduğu gibi');
  await ctx.close();
}

// ── 2) yeni sürüm bulut kaydı (v99) ve 3) bozuk bulut kaydı: boş karakterle ezilmez, sekme salt-okunur
for (const [ad, bozucu] of [['2) yeni sürüm', c => { const e = kodBoz(c); const d = JSON.parse(e.json); d.version = 99; e.json = JSON.stringify(d); e.v = 99; return kodYap(e); }],
                             ['3) bozuk', c => { const e = kodBoz(c); e.sum = '00000000'; return kodYap(e); }]]) {
  const v = kopya(TABAN); v.slots[0].code = bozucu(TKOD); v.code = v.slots[0].code;
  const S = { row: { veri: v }, okuHata: false, yazKes: false, gets: 0, writes: 0 };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await sunucu(S, ctx);
  const p = await yeniSayfa(ctx); await slotGir(p, 0);
  await p.evaluate(() => window.__marti.kayitIstek());
  await p.evaluate(() => window.__marti.hide()); await p.waitForTimeout(800); await p.evaluate(() => window.__marti.show());
  const r = await bekle(p, 'salt', 5000);
  await p.screenshot({ path: join(OUT, (ad.startsWith('2') ? '2-yeni-surum' : '3-bozuk') + '.png') });
  ok(r?.d === 'salt' && /yazmıyor/.test(r.t), ad + ': rozet salt-okunur: ' + JSON.stringify(r));
  ok(S.writes === 0 && S.row.veri.slots[0].code === v.slots[0].code, ad + ': bulut kaydına dokunulmadı (yazım ' + S.writes + ')');
  ok(p.errs.length === 0, ad + ': sayfa hatası yok ' + p.errs.join(' | '));
  await ctx.close();
}

// ── 4) çevrimdışı kapanış: ilerleme bu tarayıcıda kalır, sonraki girişte geri gelir ve buluta gider
{
  const S = { row: { veri: kopya(TABAN) }, okuHata: false, yazKes: false, gets: 0, writes: 0 };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await sunucu(S, ctx);
  const p = await yeniSayfa(ctx); await slotGir(p, 0);
  S.yazKes = true;
  await p.evaluate(() => window.__marti.simCmd('money', 4321));   // çevrimdışıyken kazanılan para: ilerleme işaretimiz
  await p.waitForTimeout(500);
  await p.evaluate(() => window.__marti.hide()); await p.waitForTimeout(1200);
  const y = await p.evaluate(() => { const k = Object.keys(localStorage).find(x => x.startsWith('martikoy-yedek:')); return k ? JSON.parse(localStorage.getItem(k)) : null; });
  ok(!!y && y.taban === TKOD && paraOf(y.code) >= paraOf(TKOD) + 4321, '4) gizlenince yerel yedek yazıldı (para ' + paraOf(y?.code || TKOD) + ', bulutta ' + paraOf(TKOD) + ')');
  ok(S.row.veri.slots[0].code === TKOD, '4) bağlantı yokken bulut değişmedi');
  await p.close();
  S.yazKes = false;
  const p2 = await yeniSayfa(ctx); await slotGir(p2, 0);
  const kod = await p2.evaluate(() => window.__marti.exportSave());
  ok(paraOf(kod) === paraOf(y.code), '4) yeniden girişte çevrimdışı ilerleme geri geldi (para ' + paraOf(kod) + ')');
  const t0 = Date.now(); while (Date.now() - t0 < 10000 && S.row.veri.slots[0].code === TKOD) await p2.waitForTimeout(200);
  ok(S.row.veri.slots[0].code !== TKOD && paraOf(S.row.veri.slots[0].code) === paraOf(y.code), '4) geri gelen ilerleme buluta yazıldı');
  ok(S.row.veri.banka?.tl === 777, '4) banka korundu');
  await ctx.close();
}

// ── 5) çift sekme aynı karakter: ikinci sekme birincinin ilerlemesini geri almaz
{
  const S = { row: { veri: kopya(TABAN) }, okuHata: false, yazKes: false, gets: 0, writes: 0 };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await sunucu(S, ctx);
  const a = await yeniSayfa(ctx); await slotGir(a, 0);
  const c = await yeniSayfa(ctx); await slotGir(c, 0);
  await a.evaluate(() => window.__marti.kayitIstek());
  ok((await bekle(a, 'tamam'))?.d === 'tamam', '5) sekme A kaydetti');
  const aKod = S.row.veri.slots[0].code;
  await c.evaluate(() => window.__marti.kayitIstek());
  const r = await bekle(c, 'salt', 8000);
  await c.screenshot({ path: join(OUT, '5-cift-sekme.png') });
  ok(r?.d === 'salt' && /başka bir sekmede/.test(r.t), '5) sekme B salt-okunur: ' + JSON.stringify(r));
  ok(S.row.veri.slots[0].code === aKod, '5) buluttaki kayıt A\'nınki kaldı');
  await c.evaluate(() => window.__marti.hide()); await c.waitForTimeout(800);
  ok(S.row.veri.slots[0].code === aKod, '5) B gizlenince/kapanırken de yazmadı');
  ok(a.errs.length === 0 && c.errs.length === 0, '5) sayfa hatası yok ' + [...a.errs, ...c.errs].join(' | '));
  await ctx.close();
}

await b.close(); srv.close();
console.log(fail ? `\n${fail} kontrol başarısız` : '\nhepsi geçti');
process.exit(fail ? 1 : 0);
