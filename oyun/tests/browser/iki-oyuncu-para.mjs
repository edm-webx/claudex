// 2026-11-25 iki oyunculu para denetimi (net/misafir.ts): iki ayrı tarayıcı bağlamı, Supabase Realtime yerine yerel Phoenix
// rölesi (page.routeWebSocket). Ev sahibi oda kurar, misafir kodla katılır; misafirin satışı ev sahibinin kasasına gidiyor mu,
// misafire maaş geliyor mu (geri düşmeden), kimsenin parası azalıyor mu, misafir ev sahibinin dünyasında para harcayabiliyor mu, sekme kapanınca
// misafirin kazancı kendi kaydında kalıyor mu, odadan çıkınca parasıyla kendi dükkânına dönüyor mu.
//  npx vite build && node tests/browser/iki-oyuncu-para.mjs [çıktı-klasörü]
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const out = process.argv[2] || 'calisma/iki-oyuncu-para'; mkdirSync(out, { recursive: true });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm', js: 'text/javascript' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}/`;

// ── yerel Supabase Realtime (Phoenix vsn 1.0.0) rölesi: join / heartbeat cevaplar, broadcast'i aynı odadaki diğerlerine iletir
const subs = new Map();
const role = (ws) => {
  const send = (o) => { try { ws.send(JSON.stringify(o)); } catch { /* kapandı */ } };
  ws.onMessage((raw) => {
    let m; try { m = JSON.parse(String(raw)); } catch { return; }
    const ok = () => send({ topic: m.topic, event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: m.ref, join_ref: m.join_ref });
    if (m.event === 'heartbeat') return ok();
    if (m.event === 'phx_join') { if (!subs.has(m.topic)) subs.set(m.topic, new Set()); subs.get(m.topic).add(ws); return send({ topic: m.topic, event: 'phx_reply', payload: { status: 'ok', response: { postgres_changes: [] } }, ref: m.ref, join_ref: m.join_ref }); }
    if (m.event === 'phx_leave') { subs.get(m.topic)?.delete(ws); return ok(); }
    if (m.event === 'broadcast') { for (const o of subs.get(m.topic) || []) if (o !== ws) { try { o.send(JSON.stringify({ topic: m.topic, event: 'broadcast', payload: m.payload, ref: null })); } catch { /* */ } } return ok(); }
    ok();
  });
  ws.onClose(() => { for (const s of subs.values()) s.delete(ws); });
};

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
async function baglam() {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.routeWebSocket(/supabase\.co\/realtime/, role);
  await ctx.route(/supabase\.co\/(rest|auth|functions)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  return ctx;
}
async function ac(ctx, q, ad) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(ad + ': ' + e.message));
  await p.goto(base + q);
  await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
  await p.evaluate(() => { const M = window.__marti; M.step(0.5); M.renderFrames(2, 0.1); M.closeJobBoard?.(); M.closePanel?.(); });
  return p;
}
const kare = (p, n = 10) => p.evaluate((n) => { const M = window.__marti; for (let i = 0; i < n; i++) { M.step(0.1); M.renderFrames(1, 0.1); } }, n);
/** iki sayfayı gerçek zamanla birlikte ilerlet (ağ mesajları arada akar) */
async function birlikte(sn, ...ps) { const t0 = Date.now(); while (Date.now() - t0 < sn * 1000) { for (const p of ps) await kare(p, 3); await new Promise(r => setTimeout(r, 60)); } }
async function bekleKadar(sn, kosul, ...ps) { const t0 = Date.now(); while (Date.now() - t0 < sn * 1000) { if (await kosul()) return true; await birlikte(0.5, ...ps); } return false; }
const para = (p) => p.evaluate(() => Math.round(window.__marti.state().money));
const pill = (p) => p.evaluate(() => document.querySelector('.on-pill')?.textContent || '');
const sonuc = { adimlar: [] }; const adim = (ad, ok, x = {}) => { sonuc.adimlar.push({ ad, ok, ...x }); console.log((ok ? 'OK  ' : 'HATA') + ' ' + ad, JSON.stringify(x)); };

const hctx = await baglam(), mctx = await baglam();
const ev = await ac(hctx, '?fresh=1&noloop&tier=dusuk&seed=3&stage=5&autoplay', 'ev');
await ev.evaluate(() => { const M = window.__marti; M.simCmd('money', 2_000_000); M.step(0.2); });
const MQ = '?save=misafir-test&noloop&tier=dusuk&seed=4&autoplay';
let mi = await ac(mctx, MQ, 'misafir');
await mi.evaluate(() => { const M = window.__marti; M.simCmd('money', 1000); M.step(0.2); });
const evPara0 = await para(ev), miPara0 = await para(mi);
adim('başlangıç', evPara0 > 1_000_000 && miPara0 < 100_000, { evPara0, miPara0 });

// ev sahibi oda kurar (gerçek düğmeler)
await ev.click('.on-oda', { force: true }); await ev.click('[data-a="kur"]', { force: true });
const kod = await ev.evaluate(() => document.querySelector('.on-big')?.textContent || '');
await ev.click('[data-a="kapat"]', { force: true });
adim('oda kuruldu', /^[A-Z0-9]{6}$/.test(kod), { kod });
// misafir kodla katılır
await mi.click('.on-oda', { force: true }); await mi.fill('.on-code', kod); await mi.click('[data-a="katil"]', { force: true });
await birlikte(8, ev, mi);
const g1 = await mi.evaluate(() => { const s = window.__marti.state(); return { stage: s.stage, money: Math.round(s.money) }; });
adim('misafir ev sahibinin büfesinde, kendi cüzdanıyla', g1.stage === 5 && g1.money === miPara0, { ...g1, pill: await pill(mi) });
await mi.screenshot({ path: join(out, '1-misafir-katildi.png') });

// misafir satar: 4000 ₺ tezgah + 1000 ₺ adisyon (sim kredi kapısı, gerçek satışla aynı defter)
await mi.evaluate(() => { const M = window.__marti; M.kazanc('tezgah', 4000); M.kazanc('adisyon', 1000); M.step(0.1); });
await bekleKadar(20, () => pill(ev).then(t => /yardım/.test(t)), ev, mi);   // bildirim 2 sn'de bir; yavaş swiftshader karesinde gerçek süre değişir
const miPara1 = await para(mi), evPara1 = await para(ev);
adim('misafire satışın %25 maaşı, geri düşmüyor', miPara1 === miPara0 + 1250, { miPara1 });
adim('misafirin satışı ev sahibinin kasasında', evPara1 >= evPara0 + 5000, { evPara1, fark: evPara1 - evPara0 });
const p1 = await pill(mi), p2 = await pill(ev);
adim('rozetler: misafirde kendi maaşı, ev sahibinde yardım; ev sahibinin kasası misafirde yazmıyor', /maaşın \+1\.250/.test(p1) && /yardım \+5\.000/.test(p2) && !/kasası/.test(p1), { misafir: p1, ev: p2 });
await mi.screenshot({ path: join(out, '2-misafir-satti.png') }); await ev.screenshot({ path: join(out, '3-ev-sahibi-yardim.png') });

// ev sahibinin pasif geliri misafire ödenmez; misafir ev sahibinin bankasına / büfesine para harcayamaz
const pasif = await mi.evaluate(() => window.__marti.kazanc('isletme', 9000));
await mi.evaluate(() => { const M = window.__marti; M.simCmd('cmd', { kind: 'mulk', op: 'tlYatir', n: 3000 }); M.simCmd('cmd', { kind: 'upgradeTier', id: 'cay' }); M.step(0.2); });
const miPara2 = await para(mi);
adim('misafire ikiz pasif gelir yok, alışveriş kapalı', pasif === 0 && miPara2 === miPara1, { pasif, miPara2 });

// ev sahibi bir şey alır (dünya yenilenir): misafirin parası ve yeri korunur
const yer0 = await mi.evaluate(() => { const M = window.__marti; M.teleport(3, 6); M.step(0.2); return M.state().pos; });
await ev.evaluate(() => { const M = window.__marti; M.simCmd('cmd', { kind: 'upgradeTier', id: 'cay' }); M.simCmd('cmd', { kind: 'upgradeTier', id: 'doner' }); M.step(0.2); });
await birlikte(6, ev, mi);
const yer1 = await mi.evaluate(() => window.__marti.state().pos), miPara3 = await para(mi), evPara2 = await para(ev);
adim('dünya yenilenince misafirin parası ve yeri durur', miPara3 === miPara1 && Math.hypot(yer1.x - yer0.x, yer1.z - yer0.z) < 1.5, { miPara3, yer0, yer1 });

// misafirin sekmesi kapanır (odadan çıkmadan): kazancı kendi kaydında kalmalı
await kare(mi, 120); await birlikte(3, ev, mi);   // >10 sn oyun karesi: kendi kaydı yazılır
await mi.close();
mi = await ac(mctx, MQ, 'misafir2');
const miPara4 = await para(mi), st4 = await mi.evaluate(() => window.__marti.state().stage);
adim('sekme kapanınca misafirin kazancı kendi kaydında (kendi aşaması)', miPara4 === miPara1 && st4 === 1, { miPara4, stage: st4 });

// tekrar katıl, sonra odadan çık: parasıyla kendi dükkânına döner
await mi.click('.on-oda', { force: true }); await mi.fill('.on-code', kod); await mi.click('[data-a="katil"]', { force: true });
await birlikte(8, ev, mi);
await mi.evaluate(() => { const M = window.__marti; M.kazanc('tezgah', 2000); M.step(0.1); });
await birlikte(4, ev, mi);
await mi.click('.on-oda', { force: true }); await mi.click('[data-a="kur"]', { force: true }); await mi.click('[data-a="kapat"]', { force: true });   // başka oda kurmak = bu odadan çıkış
await birlikte(2, ev, mi);
const son = await mi.evaluate(() => { const s = window.__marti.state(); return { stage: s.stage, money: Math.round(s.money) }; });
adim('odadan çıkınca parasıyla kendi dükkânında', son.stage === 1 && son.money === miPara1 + 500, son);
const evParaSon = await para(ev);
adim('ev sahibinin parası misafir yüzünden hiç azalmadı (kendi aldıkları hariç)', evParaSon >= evPara2 + 2000, { evPara2, evParaSon });

sonuc.hatalar = errs.slice(0, 20);
writeFileSync(join(out, 'rapor.json'), JSON.stringify(sonuc, null, 2));
const bas = sonuc.adimlar.filter(a => !a.ok).length;
console.log(bas ? `\n${bas} adım HATALI` : '\nHepsi geçti', errs.length ? `(sayfa hatası ${errs.length})` : '');
await b.close(); srv.close(); process.exit(bas ? 1 : 0);
