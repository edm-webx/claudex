// GRS-01: parlaklık / pastel / okunurluk ölçümü. Aynı kareyi (konum x saat x kademe) çeker ve sayıya döker.
//   node tests/browser/lum.spec.mjs [--dist KLASÖR] [--cikti KLASÖR] [--kademe akici,dengeli,sahane] [--saat 11,17,18.5,22]
//                                   [--konum iskele,karsi,stadyum,orman] [--baz-yaz DOSYA] [--baz DOSYA]
// Her kare için (canvas-only, UI gizli): ortalama Y (Rec.709, 0-255), p98 Y, kırpılan piksel oranı (bir kanal >= 250),
// pastel oranı (HSV S 0.08..0.50 ve V >= 0.78, üst %35 gök bandı hariç), ortalama doygunluk (gök hariç), ortalama renk (Lab, ΔE76 için).
// UI açıkken her görünür .sb-lab etiketi için yazı rengi ile altındaki sahne arasında WCAG kontrast oranı.
// --baz-yaz: ölçümü JSON olarak yazar (önce kaydı). --baz: önceki kayda göre regresyon kapısı (ort Y <= baz+3, p98 <= baz+4,
// pastel <= baz+0.005) ve kademe uyumu (akici ile dengeli ortalama renk ΔE76 <= 8). Çıkış: 0 yeşil, 1 kapı kırmızı.
// Headless SwiftShader: piksel değerleri güvenilir, kare süresi değil.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const DIST = resolve(arg('--dist', 'dist'));
const OUT = resolve(arg('--cikti', 'calisma/lum-cikti'));
const tiers = String(arg('--kademe', 'akici,dengeli,sahane')).split(',');
const hours = String(arg('--saat', '11,17,18.5,22')).split(',').map(Number);
const KONUM = {
  iskele: { x: 0, z: -3, yaw: 0, zoom: 2.8 },
  karsi: { x: -12, z: 33, yaw: 0, zoom: 2.8 },
  stadyum: { x: 399, z: 12.2, yaw: 0, zoom: 3.0 },
  orman: { x: 806, z: 9, yaw: 0, zoom: 2.8 },
};
const konumlar = String(arg('--konum', Object.keys(KONUM).join(','))).split(',');
const bazYaz = arg('--baz-yaz'), bazOku = arg('--baz');
mkdirSync(OUT, { recursive: true });

const globalRoot = (() => { try { return execSync('npm root -g').toString().trim(); } catch { return ''; } })();
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(join(globalRoot, 'x.js'))('playwright')); }
const { PNG } = require('pngjs');

const mime = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') { res.writeHead(200, { 'content-type': mime['.html'] }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p);
  if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

// ── renk yardımcıları
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lab = (r, g, b) => {
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const relL = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const wcag = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

function olcPng(buf, labels) {
  const png = PNG.sync.read(buf), { width: w, height: h, data: d } = png;
  const hist = new Uint32Array(256); let sy = 0, clip = 0, past = 0, nb = 0, ssat = 0, sr = 0, sg = 0, sbb = 0;
  const skyH = Math.round(h * 0.35);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b; sy += Y; hist[Math.min(255, Math.round(Y))]++;
    if (r >= 250 || g >= 250 || b >= 250) clip++;
    sr += r; sg += g; sbb += b;
    if (y >= skyH) {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), S = mx ? (mx - mn) / mx : 0, V = mx / 255;
      nb++; ssat += S; if (S >= 0.08 && S <= 0.5 && V >= 0.78) past++;
    }
  }
  const N = w * h; let acc = 0, p98 = 255; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= N * 0.98) { p98 = v; break; } }
  const mR = sr / N, mG = sg / N, mB = sbb / N;
  const lab0 = lab(mR, mG, mB);
  // labels: mean colour of the canvas under each label rect vs its text colour
  const lb = [];
  for (const L of labels || []) {
    const x0 = Math.max(0, Math.floor(L.x)), y0 = Math.max(0, Math.floor(L.y)), x1 = Math.min(w, Math.ceil(L.x + L.w)), y1 = Math.min(h, Math.ceil(L.y + L.h));
    if (x1 <= x0 || y1 <= y0) continue;
    let r = 0, g = 0, b = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    const bg = L.bg && L.bg[3] > 0.5 ? L.bg : null;   // an opaque plate: contrast against the plate, not the scene
    const under = bg ? relL(bg[0], bg[1], bg[2]) : relL(r / n, g / n, b / n);
    lb.push({ text: L.text, px: L.px, oran: +wcag(relL(L.fg[0], L.fg[1], L.fg[2]), under).toFixed(2), plaka: !!bg });
  }
  return { ortY: +(sy / N).toFixed(2), p98, kirpik: +(clip / N).toFixed(4), pastel: +(past / Math.max(1, nb)).toFixed(4), doyg: +(ssat / Math.max(1, nb)).toFixed(4), lab: lab0.map(v => +v.toFixed(2)), etiket: lb };
}

const sonuc = {};
for (const tier of tiers) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('  sayfa hatası:', String(e).slice(0, 160)));
  await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=${tier}&seed=3&stage=10`);
  await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
  await p.evaluate(() => { const M = window.__marti; M.play('sabri'); M.renderFrames(2, 0.1); });
  const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { const ad = await p.$('input[name="ad"]'); if (ad) await ad.fill('Olcum'); await go.click({ force: true }); await p.waitForTimeout(700); }
  await p.evaluate(() => { const M = window.__marti; M.izgara?.(false); M.simCmd('money', 9e9); M.simCmd('level', 40); });
  for (const k of konumlar) {
    const K = KONUM[k];
    await p.evaluate(K => { const M = window.__marti; M.teleport(K.x, K.z); for (let i = 0; i < 10; i++) M.renderFrames(3, 0.1); }, K);
    await p.waitForTimeout(600);
    for (const h of hours) {
      await p.evaluate(([K, h]) => { const M = window.__marti; M.setTime(h); M.camera({ x: K.x, z: K.z, zoomRaw: K.zoom, yaw: K.yaw, tilt: 0.75 }); for (let i = 0; i < 12; i++) M.renderFrames(2, 0.1); }, [K, h]);
      const labels = await p.evaluate(() => {
        const out = [], rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
        for (const el of document.querySelectorAll('.sb-lab')) {
          if (el.style.display === 'none') continue; const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) continue;
          const inner = el.firstElementChild || el, cs = getComputedStyle(inner), bgc = rgb(cs.backgroundColor);
          out.push({ x: r.x, y: r.y, w: r.width, h: r.height, fg: rgb(cs.color), bg: bgc.length >= 3 ? [bgc[0], bgc[1], bgc[2], bgc.length > 3 ? bgc[3] : 1] : null, px: parseFloat(cs.fontSize) || 12, text: (inner.textContent || '').trim().slice(0, 24) });
        }
        return out;
      });
      const filtre = await p.evaluate(() => { const c = document.querySelector('canvas'); return { filter: c ? getComputedStyle(c).filter : 'none', vig: !!document.getElementById('sb-vig') }; });
      await p.evaluate(() => { const st = document.createElement('style'); st.id = 'lum-giz'; st.textContent = 'body *{visibility:hidden!important}canvas{visibility:visible!important}'; document.head.appendChild(st); });
      const ad = `${k}-${String(h).replace('.', '_')}-${tier}`;
      const buf = await p.screenshot({ path: join(OUT, ad + '.png'), timeout: 300000 });
      await p.evaluate(() => document.getElementById('lum-giz')?.remove());
      const m = olcPng(buf, labels); m.filtre = filtre;
      sonuc[ad] = m;
      console.log(`${ad.padEnd(22)} ortY ${String(m.ortY).padStart(6)}  p98 ${String(m.p98).padStart(3)}  kırpık ${(m.kirpik * 100).toFixed(2)}%  pastel ${(m.pastel * 100).toFixed(1)}%  doyg ${m.doyg.toFixed(3)}  etiket ${m.etiket.length ? Math.min(...m.etiket.map(e => e.oran)).toFixed(2) : '-'}  filtre ${filtre.filter}${filtre.vig ? ' +vig' : ''}`);
    }
  }
  await ctx.close();
}
await browser.close(); srv.close();
writeFileSync(join(OUT, 'olcum.json'), JSON.stringify(sonuc, null, 1));
if (bazYaz && bazYaz !== true) { writeFileSync(resolve(bazYaz), JSON.stringify(sonuc, null, 1)); console.log('baz yazıldı:', bazYaz); }

let fail = 0; const check = (ok, msg) => { if (!ok) { console.log('KIRMIZI', msg); fail++; } };
// tier match: akici vs dengeli at the same spot/hour
for (const k of konumlar) for (const h of hours) {
  const a = sonuc[`${k}-${String(h).replace('.', '_')}-akici`], b = sonuc[`${k}-${String(h).replace('.', '_')}-dengeli`];
  if (a && b) { const d = dE(a.lab, b.lab); console.log(`kademe uyumu ${k} ${h}: ΔE76 ${d.toFixed(2)}`); check(d <= 8, `kademe uyumu ${k} ${h}: ΔE ${d.toFixed(2)} > 8`); }
}
for (const [ad, m] of Object.entries(sonuc)) {
  check(m.filtre.filter === 'none' && !m.filtre.vig, `${ad}: canvas CSS filtresi/vinyet var (${m.filtre.filter})`);
  for (const e of m.etiket) check(e.oran >= (e.px >= 18 ? 3 : 4.5), `${ad}: etiket "${e.text}" kontrast ${e.oran}`);
}
if (bazOku && bazOku !== true && existsSync(resolve(bazOku))) {
  const baz = JSON.parse(readFileSync(resolve(bazOku), 'utf8'));
  for (const [ad, m] of Object.entries(sonuc)) {
    const b = baz[ad]; if (!b) continue;
    const d = dE(m.lab, b.lab);
    console.log(`önce→sonra ${ad.padEnd(22)} ortY ${b.ortY}→${m.ortY}  p98 ${b.p98}→${m.p98}  pastel ${(b.pastel * 100).toFixed(1)}→${(m.pastel * 100).toFixed(1)}%  doyg ${b.doyg.toFixed(3)}→${m.doyg.toFixed(3)}  ΔE ${d.toFixed(2)}`);
    check(m.ortY <= b.ortY + 3, `${ad}: ortalama Y ${m.ortY} > baz ${b.ortY}+3`);
    check(m.p98 <= b.p98 + 4, `${ad}: p98 ${m.p98} > baz ${b.p98}+4`);
    check(m.pastel <= b.pastel + 0.005, `${ad}: pastel ${m.pastel} > baz ${b.pastel}`);
  }
}
console.log(fail ? `lum: ${fail} kırmızı` : 'lum: yeşil');
process.exit(fail ? 1 : 0);
