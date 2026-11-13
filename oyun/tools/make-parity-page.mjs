// Builds dist/parity.html (Builder D): every v2 / Martı Motoru pair side by side with the diff image and the numbers,
// for the owner's eye check. Self-contained (images embedded as data URIs: JPEG shots, PNG diffs), no scripts.
// Usage: node tools/make-parity-page.mjs [motorOutDir=/tmp/marti-parity] [out=dist/parity.html]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { loadSet, diffImage, SHOT_NAMES, parseShot, REGIONS, THRESH, resize, W, H } from './shot-compare.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MO = path.resolve(process.argv[2] || '/tmp/marti-parity');
const OUTF = path.resolve(process.argv[3] || path.join(ROOT, 'dist/parity.html'));
const V2 = path.join(ROOT, 'tests/fixtures/v2-shots');
const res = fs.existsSync(path.join(MO, 'results.json')) ? JSON.parse(fs.readFileSync(path.join(MO, 'results.json'), 'utf8')) : { rows: [], extra: {}, errors: [] };
const byName = Object.fromEntries((res.rows || []).map(r => [r.name, r]));

const uri = (file, type) => (fs.existsSync(file) ? `data:${type};base64,${fs.readFileSync(file).toString('base64')}` : '');
const pngUri = img => `data:image/png;base64,${PNG.sync.write(img).toString('base64')}`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const HOURS = { 9: 'Sabah 09:00', 13: 'Öğle 13:00', 19: 'Akşam 19:00', 22: 'Gece 22:00' };

function cell(r, k) {
  const g = r && r.regions && r.regions[k];
  if (!g) return '<td>-</td>';
  if (g.status === 'n/a') return '<td class="na">yok</td>';
  return `<td class="${g.status === 'ok' ? 'ok' : 'bad'}">${g.dE}</td>`;
}
let cards = '', pass = 0, total = 0;
for (const name of SHOT_NAMES) {
  const s = parseShot(name), r = byName[name];
  const v2jpg = uri(path.join(V2, name + '.jpg'), 'image/jpeg'), mojpg = uri(path.join(MO, name + '.jpg'), 'image/jpeg');
  if (!v2jpg) continue;
  total++; if (r && r.pass) pass++;
  const a = loadSet(V2, name), b = loadSet(MO, name);
  let diff = '', diffPx = null;
  const A = a.color || a.shot, B = b.color || b.shot;
  if (A && B) { const d = diffImage(resize(A, W, H), resize(B, W, H)); diff = pngUri(d.img); diffPx = d.diffPx; }
  const k = r ? r.kiosk : {};
  cards += `<section class="pair ${r ? (r.pass ? 'pass' : 'fail') : 'none'}" id="${name}">
  <h2><span>Bölüm ${s.stage} · ${HOURS[s.hour]} · ${s.art ? 'resimli' : 'kod çizimi (#noart)'}</span><b>${r ? (r.pass ? 'GEÇTİ' : 'KALDI') : 'ÇEKİM YOK'}</b></h2>
  <div class="imgs">
    <figure><img src="${v2jpg}" alt="v2 ${name}"><figcaption>v2 (mevcut oyun)</figcaption></figure>
    <figure>${mojpg ? `<img src="${mojpg}" alt="motor ${name}">` : '<div class="miss">Martı Motoru çekimi yok</div>'}<figcaption>Martı Motoru</figcaption></figure>
    <figure>${diff ? `<img src="${diff}" alt="fark ${name}">` : '<div class="miss">fark yok</div>'}<figcaption>Fark (kırmızı/mavi = farklı piksel${diffPx != null ? `, ${(100 * diffPx / (W * H)).toFixed(1)}%` : ''})</figcaption></figure>
  </div>
  <table><tr><th>ΔE</th>${REGIONS.map(x => `<th>${x}</th>`).join('')}<th>büfe SSIM</th><th>büfe kutu</th><th>hareketli maske</th></tr>
  <tr><td>${name}</td>${REGIONS.map(x => cell(r, x)).join('')}<td class="${k && k.ssim != null ? (k.ssim >= THRESH.ssim ? 'ok' : 'bad') : 'na'}">${k && k.ssim != null ? k.ssim : '-'}</td>
  <td class="${k && k.bboxErr != null ? (k.bboxErr <= THRESH.bbox ? 'ok' : 'bad') : 'na'}">${k && k.bboxErr != null ? (k.bboxErr * 100).toFixed(1) + '%' : '-'}</td><td>${r && r.dynFrac != null ? (r.dynFrac * 100).toFixed(1) + '%' : '-'}</td></tr></table>
  ${r && r.notes && r.notes.length ? `<p class="note">${esc(r.notes.join('; '))}</p>` : ''}
</section>`;
}
const ex = res.extra || {};
const v2ch = uri(path.join(V2, 'chars-heroes.png'), 'image/png'), moch = uri(path.join(MO, 'chars-heroes.png'), 'image/png');
const hudv2 = uri(path.join(V2, 'hud-ref.png'), 'image/png'), hudmo = uri(path.join(MO, 's1-09-noart.png'), 'image/png');
const extraHtml = `<section class="pair ${ex.chars && ex.chars.pass ? 'pass' : 'fail'}"><h2><span>Karakterler (kahramanlar dizisi)</span><b>SSIM ${ex.chars ? ex.chars.ssim : '-'} (en az ${THRESH.charsSsim})</b></h2>
<div class="imgs two"><figure><img src="${v2ch}" alt="v2 karakterler"><figcaption>v2 test/chars.html</figcaption></figure><figure>${moch ? `<img src="${moch}" alt="motor karakterler">` : '<div class="miss">yok</div>'}<figcaption>Martı Motoru tests/browser/chars.html</figcaption></figure></div></section>
<section class="pair ${ex.hud && ex.hud.pass ? 'pass' : 'fail'}"><h2><span>Üst gösterge (HUD) şeridi</span><b>ΔE ${ex.hud ? ex.hud.dE : '-'} (en çok ${THRESH.hudDeltaE})</b></h2>
<div class="imgs two hud"><figure><div class="band" style="background-image:url(${hudv2})"></div><figcaption>v2 game-02-first-customer.png</figcaption></figure><figure>${hudmo ? `<div class="band" style="background-image:url(${hudmo})"></div>` : '<div class="miss">yok</div>'}<figcaption>Martı Motoru</figcaption></figure></div></section>`;

const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Görünüm Karşılaştırması</title>
<style>
:root{--bg:#fdf3e1;--card:#fffaf1;--ink:#3b2a20;--mute:#7d6450;--ok:#2f8f4c;--bad:#c62f3b;--line:#e3d3bb}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#1e1a17;--card:#2a2420;--ink:#f6ead2;--mute:#c9b79c;--ok:#7fd49a;--bad:#ff8a8f;--line:#4a3f36}}
:root[data-theme="dark"]{--bg:#1e1a17;--card:#2a2420;--ink:#f6ead2;--mute:#c9b79c;--ok:#7fd49a;--bad:#ff8a8f;--line:#4a3f36}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:16px}
header{max-width:1240px;margin:0 auto 16px}h1{font-size:24px;margin:0 0 4px}header p{margin:2px 0;color:var(--mute)}
.sum{display:inline-block;margin-top:8px;padding:4px 10px;border-radius:999px;border:2px solid var(--line);font-weight:700}
.pair{max-width:1240px;margin:0 auto 18px;background:var(--card);border:2px solid var(--line);border-radius:14px;padding:12px}
.pair.fail{border-color:var(--bad)}.pair.pass{border-color:var(--ok)}
.pair h2{font-size:16px;margin:0 0 10px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
.pass h2 b{color:var(--ok)}.fail h2 b{color:var(--bad)}
.imgs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.imgs.two{grid-template-columns:repeat(2,minmax(0,1fr))}
figure{margin:0}figure img{width:100%;height:auto;display:block;border-radius:8px;border:1px solid var(--line)}
figcaption{font-size:12px;color:var(--mute);margin-top:4px}
.miss{aspect-ratio:390/844;display:flex;align-items:center;justify-content:center;border:2px dashed var(--line);border-radius:8px;color:var(--mute);text-align:center;padding:8px}
.hud .band{width:100%;aspect-ratio:390/110;background-size:100% auto;background-position:top;border-radius:8px;border:1px solid var(--line)}
table{border-collapse:collapse;margin-top:10px;font-size:13px;width:100%;display:block;overflow-x:auto}td,th{border:1px solid var(--line);padding:3px 7px;text-align:center;white-space:nowrap}
td.ok{color:var(--ok);font-weight:700}td.bad{color:var(--bad);font-weight:700}td.na{color:var(--mute)}
.note{font-size:12px;color:var(--mute);margin:6px 0 0}
@media (max-width:700px){.imgs{grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}figcaption{font-size:10px}}
</style></head><body>
<header><h1>Görünüm karşılaştırması: v2 ve Martı Motoru</h1>
<p>Martıköy İskelesi, 390×844, kalite Dengeli. Sol: mevcut oyun (v2), orta: Martı Motoru, sağ: fark resmi.</p>
<p>Ölçüler: bölge renk farkı ΔE (en çok ${THRESH.deltaE}), büfe benzerliği SSIM (en az ${THRESH.ssim}), büfe kutusu kayması (en çok %${THRESH.bbox * 100}). Hareket edenler (kalabalık, martılar, Sabri) ölçüme girmez.</p>
<p>Oluşturuldu: ${esc(res.at || new Date().toISOString())}${res.errors && res.errors.length ? ` · konsol hatası: ${res.errors.length}` : ''}</p>
<span class="sum">${pass}/${total} çift geçti</span></header>
${cards}${extraHtml}
</body></html>`;
fs.mkdirSync(path.dirname(OUTF), { recursive: true });
fs.writeFileSync(OUTF, html);
console.log(`wrote ${OUTF} (${(html.length / 1048576).toFixed(1)} MB, ${pass}/${total} pairs pass)`);
