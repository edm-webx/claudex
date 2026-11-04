// Koleksiyon sheet ('koleksiyon' panel) and its card in the Görevler panel. Pure HTML string renderers in the v2ui
// style (sb-card / sb-btn); v2ui.ts calls them from its RENDER table. Button data-a names map to panelActions('koleksiyon')
// and ('gorevler') in sim/panels.ts. Owner: koleksiyon feature (survey koleksiyon-1..8, altin-1..9, marka-8).
// Decisions: tabs are big one-tap chips at the top; every picture is a small code-made SVG (no image files).
import { ICONS } from '../../engine/ui/v2-style';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const I = (k: string) => ICONS[k] || '';
const btn = (label: string, act: string, id: string | null, cls: string, sub?: string, off?: boolean, why?: string) =>
  `<button class="sb-btn ${cls}${off ? ' off' : ''}" data-a="${act}"${id != null ? ` data-id="${esc(id)}"` : ''}${why ? ` data-why="${esc(why)}"` : ''}><span class="sb-bl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;

const TABS: [string, string, string][] = [
  ['album', 'Çıkartmalar', 'sparkle'], ['balik', 'Balıklar', 'ferry'], ['kapak', 'Kapaklar', 'gazoz'], ['kartpostal', 'Kartpostal', 'camera'],
  ['hikaye', 'Hikayeler', 'newspaper'], ['vitrin', 'Vitrin', 'medal'], ['firin', 'Altın Fırın', 'gold'],
];

/** tiny simit svg (also used by the gold overlay) */
export const SIMIT_SVG = (s = 44) => `<svg width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="#f2b632" stroke="#7a4a12" stroke-width="3"/><circle cx="24" cy="24" r="7" fill="#fff6e6" stroke="#7a4a12" stroke-width="2.5"/><g fill="#fff8d8"><ellipse cx="14" cy="17" rx="2" ry="1.2" transform="rotate(-30 14 17)"/><ellipse cx="31" cy="12" rx="2" ry="1.2"/><ellipse cx="36" cy="27" rx="2" ry="1.2" transform="rotate(60 36 27)"/><ellipse cx="22" cy="37" rx="2" ry="1.2"/><ellipse cx="12" cy="30" rx="2" ry="1.2" transform="rotate(40 12 30)"/></g><path d="M12 14q6-6 14-6" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/></svg>`;

const sticker = (color: string, got: boolean, shiny: boolean, rare: boolean) => `<svg width="46" height="46" viewBox="0 0 48 48" aria-hidden="true">${shiny ? '<circle cx="24" cy="24" r="23" fill="#fff3a8"/>' : ''}<path d="M24 4l5 9 10-2-2 10 8 6-9 5 1 10-10-3-7 8-4-10-10-1 5-9-6-8 10-3z" fill="${got ? esc(color) : '#d8d8d8'}" stroke="#33373b" stroke-width="2.5" stroke-linejoin="round"/>${got ? '<circle cx="19" cy="21" r="2.4" fill="#33373b"/><circle cx="29" cy="21" r="2.4" fill="#33373b"/><path d="M18 29q6 5 12 0" stroke="#33373b" stroke-width="2.5" fill="none" stroke-linecap="round"/>' : '<text x="24" y="31" text-anchor="middle" font-size="20" font-weight="900" fill="#888" font-family="system-ui">?</text>'}${rare && got ? '<path d="M38 6l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill="#ffd23f" stroke="#33373b" stroke-width="1.5"/>' : ''}</svg>`;
const fish = (color: string, got: boolean, id: string) => {
  const c = got ? esc(color) : '#d8d8d8';
  if (got && id === 'eski_terlik') return `<svg width="46" height="46" viewBox="0 0 48 48"><path d="M10 30q0-12 14-14 12 0 14 8t-8 10H14q-4 0-4-4z" fill="${c}" stroke="#33373b" stroke-width="2.5"/><path d="M20 18q4 8 14 6" stroke="#33373b" stroke-width="3" fill="none"/></svg>`;
  if (got && id === 'pasli_anahtar') return `<svg width="46" height="46" viewBox="0 0 48 48"><circle cx="14" cy="24" r="7" fill="none" stroke="${c}" stroke-width="5"/><path d="M21 24h20M35 24v6M40 24v5" stroke="${c}" stroke-width="5" stroke-linecap="round"/></svg>`;
  return `<svg width="46" height="46" viewBox="0 0 48 48"><path d="M6 24q12-14 28-4l8-7v22l-8-7Q18 38 6 24z" fill="${c}" stroke="#33373b" stroke-width="2.5" stroke-linejoin="round"/>${got ? '<circle cx="14" cy="22" r="2.2" fill="#33373b"/>' : ''}</svg>`;
};
const cap = (color: string, ink: string, got: boolean, kind: string) => `<svg width="40" height="40" viewBox="0 0 48 48"><path d="M24 3l4 3 5-1 2 4 5 1 0 5 4 3-2 5 2 5-4 3v5l-5 1-2 4-5-1-4 3-4-3-5 1-2-4-5-1v-5l-4-3 2-5-2-5 4-3v-5l5-1 2-4 5 1z" fill="${got ? (kind === 'a' ? '#f6bd3a' : esc(color)) : '#d8d8d8'}" stroke="#33373b" stroke-width="2"/><circle cx="24" cy="24" r="12" fill="${got ? (kind === 'o' ? '#fff' : 'none') : 'none'}" stroke="${got ? esc(kind === 'o' ? color : ink) : '#aaa'}" stroke-width="2.5"/>${got ? `<text x="24" y="29" text-anchor="middle" font-size="13" font-weight="900" fill="${esc(kind === 'o' ? color : kind === 'a' ? '#7a4a12' : ink)}" font-family="system-ui">${kind === 'a' ? '★' : kind === 'o' ? 'Ö' : 'K'}</text>` : ''}</svg>`;
const postcard = (sky: string[], got: boolean, place: string) => `<svg viewBox="0 0 120 80" width="100%" aria-hidden="true"><defs><linearGradient id="pc${esc(place)}${esc(sky[0].slice(1))}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${got ? esc(sky[0]) : '#ddd'}"/><stop offset="1" stop-color="${got ? esc(sky[1]) : '#eee'}"/></linearGradient></defs><rect x="2" y="2" width="116" height="76" rx="6" fill="url(#pc${esc(place)}${esc(sky[0].slice(1))})" stroke="#33373b" stroke-width="3"/>${got ? `<rect x="2" y="52" width="116" height="26" fill="#2f7fb3" opacity=".75"/><path d="M14 52h40v-14h-6v-6h-10v6H14z" fill="#fff6e6" stroke="#33373b" stroke-width="2"/><path d="M70 48q6-6 12 0 6-6 12 0" stroke="#fff" stroke-width="2.5" fill="none"/><circle cx="96" cy="22" r="8" fill="#fff3c4"/>` : '<text x="60" y="48" text-anchor="middle" font-size="26" font-weight="900" fill="#aaa" font-family="system-ui">?</text>'}</svg>`;
const face = (look: any, met: boolean) => {
  const top = met ? esc(look?.top || '#7a6a5a') : '#ccc', skin = met ? ['#f6d7b0', '#eec39a', '#d9a477', '#b98055', '#8a5a3a'][Math.max(0, Math.min(4, (look?.skin || 2) - 1))] : '#e2e2e2';
  return `<svg width="54" height="54" viewBox="0 0 48 48"><circle cx="24" cy="24" r="23" fill="#fbfaf6" stroke="#33373b" stroke-width="2"/><path d="M8 46q2-12 16-12t16 12z" fill="${top}"/><circle cx="24" cy="21" r="10" fill="${skin}" stroke="#33373b" stroke-width="2"/>${met ? `<circle cx="20" cy="20" r="1.6" fill="#33373b"/><circle cx="28" cy="20" r="1.6" fill="#33373b"/><path d="M20 25q4 3 8 0" stroke="#33373b" stroke-width="2" fill="none" stroke-linecap="round"/>${look?.mustache ? '<path d="M19 24q5-2 10 0" stroke="#555" stroke-width="2.5" fill="none"/>' : ''}${look?.glasses ? '<g fill="none" stroke="#33373b" stroke-width="1.5"><circle cx="20" cy="20" r="3"/><circle cx="28" cy="20" r="3"/></g>' : ''}` : '<text x="24" y="26" text-anchor="middle" font-size="14" font-weight="900" fill="#999" font-family="system-ui">?</text>'}</svg>`;
};
const goldItem = (color: string, owned: boolean) => `<svg width="50" height="50" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="${esc(color)}" opacity="${owned ? '.35' : '.22'}"/><path d="M24 7l4 10 10 1-8 7 3 10-9-6-9 6 3-10-8-7 10-1z" fill="${esc(color)}" stroke="#7a4a12" stroke-width="2.2" stroke-linejoin="round"/>${owned ? '<path d="M16 25l6 6 11-12" stroke="#2e7d32" stroke-width="4" fill="none" stroke-linecap="round"/>' : ''}</svg>`;

const CSS = `<style>
.kl-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:6px;scrollbar-width:none}
.kl-tabs button{flex:none;min-height:48px;padding:4px 12px;border:2.5px solid var(--ink);border-radius:14px;background:#fff;font:900 16px/1.1 var(--disp);color:var(--ink);display:flex;align-items:center;gap:6px;cursor:pointer}
.kl-tabs button svg{width:22px;height:22px}.kl-tabs button.on{background:var(--yellow,#ffd23f);box-shadow:0 3px 0 var(--ink)}
.kl-top{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.kl-top .sb-chip{font-size:15px;padding:5px 10px}
.kl-page{margin-bottom:10px}.kl-page h3{font:900 19px/1.15 var(--disp);margin:0 0 4px;display:flex;justify-content:space-between;gap:6px;align-items:baseline}
.kl-page h3 small{font:800 14px/1 var(--body);opacity:.75}
.kl-rw{font:800 14px/1.3 var(--body);margin:2px 0 8px;opacity:.85}.kl-rw.ok{color:#2e7d32;opacity:1}
.kl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.kl-it{border:2.5px solid var(--ink);border-radius:12px;padding:6px 4px;text-align:center;font:800 13px/1.15 var(--body);background:#fff;min-height:84px;position:relative}
.kl-it.no{opacity:.55}.kl-it.sh{background:linear-gradient(135deg,#fff8c8,#fff 50%,#fde6a8);box-shadow:0 0 0 2px #f6bd3a inset}
.kl-it .tg{display:inline-block;font:900 11px/1 var(--body);padding:2px 5px;border-radius:6px;background:#e8f6fb;margin-top:3px}
.kl-it .tg.r{background:#fbe7b0}.kl-it .tg.n{background:#2b3a55;color:#fff}
.kl-note{font:700 12px/1.25 var(--body);opacity:.8;margin-top:3px}
.kl-caps{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}
.kl-cap{border:2.5px solid var(--ink);border-radius:12px;padding:6px;background:#c9a27a1f}
.kl-cap b{display:block;font:900 15px/1.1 var(--disp);margin-bottom:4px}.kl-cap .row{display:flex;gap:2px;justify-content:space-around}
.kl-cap.done{background:#dff3e3}
.kl-pc{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.kl-pc div{font:800 13px/1.2 var(--body);text-align:center}
.kl-ch{display:grid;grid-template-columns:54px 1fr;gap:10px;align-items:start}
.kl-ch h3{font:900 18px/1.1 var(--disp);margin:0}.kl-ch ol{margin:4px 0 0;padding-left:20px;font:700 15px/1.35 var(--body)}
.kl-ch ol li.no{opacity:.45;font-style:italic}
.kl-vit{display:flex;gap:8px;justify-content:center;margin:6px 0 10px}
.kl-vit i{width:84px;height:96px;border:3px solid var(--ink);border-radius:12px;background:#7d5638;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff6e6;font:900 12px/1.1 var(--body);text-align:center;padding:4px;font-style:normal}
.kl-vit i svg{width:40px;height:40px}
.kl-ach{display:flex;gap:8px;align-items:center}.kl-ach h3{font:900 16px/1.1 var(--disp);margin:0}.kl-ach p{font:700 13px/1.25 var(--body);margin:2px 0 0}
.kl-fi{display:grid;grid-template-columns:50px 1fr;gap:10px;align-items:center}
.kl-fi h3{font:900 17px/1.1 var(--disp);margin:0}.kl-fi p{font:700 14px/1.3 var(--body);margin:2px 0}.kl-fi .sb-btn{grid-column:1/-1;min-height:52px;font-size:17px}
.kl-fi.own{background:#fff8dc}
.kl-firin{background:linear-gradient(180deg,#fff3c4,#fbe7b0);border:3px solid #b7811a}
.kl-rev{background:#2b3a55;color:#fff;border:3px solid var(--ink)}.kl-rev h3{font:900 20px/1.1 var(--disp);margin:0 0 6px;color:#ffd23f}
.kl-rev .kl-grid .kl-it{color:var(--ink);animation:klpop .45s cubic-bezier(.3,1.6,.5,1) both}.kl-rev .kl-grid .kl-it:nth-child(2){animation-delay:.12s}.kl-rev .kl-grid .kl-it:nth-child(3){animation-delay:.24s}
.kl-new{position:absolute;top:-8px;right:-6px;background:#e0533c;color:#fff;font:900 11px/1 var(--body);padding:3px 6px;border-radius:8px;border:2px solid var(--ink)}
@keyframes klpop{from{transform:scale(.3) rotate(-12deg);opacity:0}to{transform:none;opacity:1}}
.kl-sec-card{display:flex;gap:10px;align-items:center}.kl-sec-card h3{font:900 18px/1.1 var(--disp);margin:0}.kl-sec-card p{font:700 15px/1.3 var(--body);margin:2px 0}
</style>`;

const rwLine = (p: any) => p.done ? `<div class="kl-rw ok">${I('check')} Sayfa tamam! Ödül alındı: ${esc(p.reward)}</div>` : p.reward ? `<div class="kl-rw">${I('trophy')} Sayfa ödülü: ${esc(p.reward)}</div>` : '';

function revealCard(r: any): string {
  if (!r) return '';
  let s = `<div class="sb-card kl-rev"><h3>${r.kind === 'pack' ? 'Paket açıldı!' : 'Oltaya bir şey takıldı!'}</h3><div class="kl-grid">`;
  for (const it of r.items) s += `<div class="kl-it${it.shiny ? ' sh' : ''}">${it.isNew ? '<span class="kl-new">YENİ</span>' : ''}${r.kind === 'pack' ? sticker(it.color, true, it.shiny, false) : fish(it.color, true, '')}<div>${esc(it.name)}</div>${it.note ? `<div class="kl-note">${esc(it.note)}</div>` : ''}</div>`;
  return s + `</div><p style="font:700 15px/1.3 var(--body);margin:8px 0 0">${esc(r.line)}</p></div>`;
}

function tabAlbum(m: any): string {
  let s = `<div class="sb-card"><div class="kl-top"><span class="sb-chip gold">${I('sparkle')} Paket: ${m.packs}</span><span class="sb-chip">Çift: ${m.dupes} / ${m.dupesPer}</span><span class="sb-chip">Parıltılı: ${m.shinyN}</span><span class="sb-chip">${esc(m.season)}${m.night ? ' gecesi' : ''}</span></div>`;
  s += btn(m.packs > 0 ? 'Paketi aç!' : 'Paket yok', 'kolPack', null, 'green wide', m.packs > 0 ? '3 çıkartma' : m.salesLeft + ' satış sonra yeni paket', m.packs <= 0, 'Satış yap, sipariş tamamla, seviye atla: paket gelir.');
  s += `<p style="font:700 13px/1.3 var(--body);margin:6px 0 0">Paketler oynayarak gelir: ${esc(String(m.salesLeft))} satışta bir, her sipariş ödülünde, her seviyede, müdavimlerden. Nadir şans koruması: en geç ${m.pity} denemede bir nadir garanti (şimdi ${Math.max(1, m.pityLeft.st)} kaldı).</p></div>`;
  s += revealCard(m.reveal && m.reveal.kind === 'pack' ? m.reveal : null);
  for (const p of m.album) {
    if (p.hidden) { s += `<div class="sb-card kl-page sb-muted"><h3>${I('lock')} Gizli sayfa<small>??? / ${p.total}</small></h3><p style="font:700 14px/1.3 var(--body);margin:0">${esc(p.hint)}</p></div>`; continue; }
    s += `<div class="sb-card kl-page"><h3>${esc(p.name)}<small>${p.have} / ${p.total}</small></h3>${rwLine(p)}<div class="kl-grid">`;
    for (const it of p.items) s += `<div class="kl-it${it.got ? '' : ' no'}${it.shiny ? ' sh' : ''}">${sticker(it.color, it.got, it.shiny, it.rare)}<div>${it.got ? esc(it.name) : '???'}</div>${it.season ? `<span class="tg">${esc(it.season)}</span>` : ''}${it.rare ? '<span class="tg r">Nadir</span>' : ''}${it.night ? '<span class="tg n">Gece</span>' : ''}</div>`;
    s += '</div></div>';
  }
  return s;
}
function tabBalik(m: any): string {
  let s = `<div class="sb-card"><div class="kl-top"><span class="sb-chip gold">${I('ferry')} Olta hakkı: ${m.casts} / ${m.castCap}</span><span class="sb-chip">${esc(m.season)}</span></div>`;
  s += btn(m.casts > 0 ? 'Oltayı at!' : 'Olta dinleniyor', 'kolCast', null, 'blue wide', m.casts > 0 ? 'İskelenin ucundan' : 'Her gün 3 hak, her vapurda +1', m.casts <= 0, 'Vapur yanaşınca bir hak daha gelir.');
  s += `<p style="font:700 13px/1.3 var(--body);margin:6px 0 0">Bazı balıklar sadece kendi mevsiminde gelir. Altın Hamsi çok nadir, ama en geç ${m.pity} atışta bir garanti (şimdi ${Math.max(1, m.pityLeft.fish)} kaldı).</p></div>`;
  s += revealCard(m.reveal && m.reveal.kind === 'cast' ? m.reveal : null);
  for (const p of m.balik) {
    s += `<div class="sb-card kl-page"><h3>${esc(p.name)}<small>${p.have} / ${p.total}</small></h3>${rwLine(p)}<div class="kl-grid">`;
    for (const it of p.items) s += `<div class="kl-it${it.got ? '' : ' no'}${it.rare && it.got ? ' sh' : ''}">${fish(it.color, it.got, it.id)}<div>${it.got ? esc(it.name) : it.locked ? esc(it.name) : '???'}</div>${it.season ? `<span class="tg">${esc(it.season)}</span>` : ''}${it.rare ? '<span class="tg r">Nadir</span>' : ''}${it.locked ? `<div class="kl-note">${I('lock')} ${esc(it.locked)}</div>` : it.got && it.note ? `<div class="kl-note">${esc(it.note)}</div>` : ''}</div>`;
    s += '</div></div>';
  }
  return s;
}
function tabKapak(m: any): string {
  let s = `<div class="sb-card sb-muted" style="font:700 15px/1.35 var(--body)">Her satışta bir kapak düşebilir. Kapaklar Altın Fırın'ın yanındaki tahta panoya asılır. Bir markanın 3 kapağı tamamlanınca o markadan dekor gelir. Altın kapak nadir, ${m.pity} denemede bir garanti.</div><div class="kl-caps">`;
  for (const b of m.kapak) {
    s += `<div class="kl-cap${b.done ? ' done' : ''}"><b>${esc(b.name)} <small style="font:800 12px var(--body)">${b.have}/3</small></b><div class="row">${b.caps.map((c: any) => cap(b.color, b.ink, c.got, c.id)).join('')}</div><div class="kl-note">${b.done ? 'Dekor geldi!' : 'Ödül: ' + esc(b.reward)}</div></div>`;
  }
  return s + '</div>';
}
function tabPost(m: any): string {
  let s = `<div class="sb-card sb-muted" style="font:700 15px/1.35 var(--body)">Her mekanda 3 kartpostal var: sabah, gün batımı, gece. O saatte oraya git, iki saniye dur, manzara kartpostal olur!</div>`;
  for (const p of m.kartpostal) {
    if (p.locked) { s += `<div class="sb-card kl-page sb-muted"><h3>${I('lock')} ${esc(p.name)}<small>0 / 3</small></h3><p style="font:700 14px/1.3 var(--body);margin:0">${esc(p.locked)}</p></div>`; continue; }
    s += `<div class="sb-card kl-page"><h3>${esc(p.name)}<small>${p.have} / ${p.total}</small></h3>${rwLine(p)}<div class="kl-pc">`;
    for (const c of p.cards) s += `<div>${postcard(c.sky, c.got, p.id)}${esc(c.name)}${c.got ? '' : `<br><small style="opacity:.7">${esc(c.when)}</small>`}</div>`;
    s += '</div></div>';
  }
  return s;
}
function tabHikaye(m: any): string {
  let s = `<div class="sb-card sb-muted" style="font:700 15px/1.35 var(--body)"><b>Martıköy Hikayeleri</b>: her müdavim bir bölüm. Her "her zamankinden!" bir sayfa daha açar.</div>`;
  for (const c of m.hikaye) {
    s += `<div class="sb-card kl-page kl-ch">${face(c.look, c.met)}<div><h3>${c.met ? esc(c.name) : '???'} <small style="font:800 13px var(--body);opacity:.7">${c.have} / ${c.total}</small></h3>${rwLine(c)}`;
    if (!c.met) s += `<p style="font:700 14px/1.3 var(--body);margin:2px 0">${c.fromDay}. günden sonra büfeye uğrar.</p>`;
    else s += `<ol>${c.pages.map((p: any) => p.open ? `<li>${esc(p.text)}</li>` : '<li class="no">Bir sonraki ziyarette...</li>').join('')}</ol>`;
    s += '</div></div>';
  }
  return s;
}
function tabVitrin(m: any): string {
  const v = m.vitrin || { slots: [], list: [] };
  const byId: Record<string, any> = {}; for (const a of v.list) byId[a.id] = a;
  let s = `<div class="sb-card"><h3 style="font:900 19px/1.1 var(--disp);margin:0">Başarım vitrini</h3><p style="font:700 14px/1.3 var(--body);margin:4px 0">En sevdiğin 3 rozeti seç, büfenin tezgahındaki vitrine asılsın.</p><div class="kl-vit">`;
  for (let i = 0; i < 3; i++) { const a = byId[v.slots[i]]; s += `<i>${a ? I('medal') + esc(a.title) : I('lock') + 'Boş'}</i>`; }
  s += '</div></div>';
  if (!v.list.length) return s + `<div class="sb-card sb-muted">Henüz başarım yok. Görevler sekmesindeki başarımları yap, sonra buraya as!</div>`;
  for (const a of v.list) s += `<div class="sb-card kl-ach">${I('medal')}<div class="sb-grow"><h3>${esc(a.title)}</h3><p>${esc(a.text)}</p></div>${btn(a.on ? 'İndir' : 'As', 'kolVitrin', a.id, a.on ? 'cream sm' : 'green sm')}</div>`;
  return s;
}
function tabFirin(m: any): string {
  const f = m.firin || {};
  let s = `<div class="sb-card kl-firin"><div class="kl-top"><span class="sb-chip gold">${SIMIT_SVG(20)} ${m.gold} Altın Simit</span>${f.gifts ? `<span class="sb-chip">Hediye kartı: ${f.gifts}</span>` : ''}</div><p style="font:800 15px/1.35 var(--body);margin:0 0 6px">${esc(f.line)}</p>`;
  if (!f.open) s += `<p style="font:900 16px/1.3 var(--body);margin:0">${I('lock')} Fırın Esnaf Seviyesi ${f.level} olunca açılır. Vitrine şimdiden bakabilirsin!</p>`;
  s += btn('Deneme reklamı izle', 'kolAd', null, 'blue', '+1 Altın Simit (bugün ' + f.adLeft + ' / ' + f.adMax + ')', f.adLeft <= 0, 'Bugünlük reklam bitti.') + '</div>';
  const card = (it: any) => `<div class="sb-card kl-fi${it.owned ? ' own' : ''}">${goldItem(it.color, it.owned)}<div><h3>${esc(it.name)}</h3><p><span class="sb-chip">${esc(it.kind)}</span></p><p>${esc(it.text)}</p></div>${it.owned ? `<span class="sb-chip ok" style="grid-column:1/-1;justify-content:center;min-height:44px">${I('check')} Senin</span>` : btn('Al', 'kolBuy', it.id, 'green', it.gold + ' Altın Simit', !f.open || !it.can, !f.open ? 'Fırın henüz kapalı.' : 'Altın Simit yetmiyor.')}</div>`;
  s += `<div class="sb-sec">${I('sparkle')}Bugünün vitrini<span>her sabah değişir</span></div>`;
  for (const it of f.showcase || []) s += card(it);
  s += `<div class="sb-sec">${I('gold')}Altın raf<span>hep burada</span></div>`;
  for (const it of f.shelf || []) s += card(it);
  if ((f.sandik || []).length) s += `<div class="sb-card"><b style="font:900 16px var(--disp)">Sandığın</b><p style="font:700 14px/1.35 var(--body);margin:4px 0 0">${(f.sandik as string[]).map(esc).join(', ')}</p></div>`;
  s += `<div class="sb-card sb-muted"><b style="font:900 16px var(--disp)">Altın Simit nereden gelir?</b><ul style="margin:4px 0 6px;padding-left:20px;font:700 14px/1.4 var(--body)">${(f.sources || []).map((x: string) => `<li>${esc(x)}</li>`).join('')}</ul><p style="font:800 14px/1.35 var(--body);margin:0">${esc(f.rules)} Tadilat süresini kısaltmak Tadilat sekmesinde.</p></div>`;
  return s;
}

export function renderKoleksiyon(m: any): string {
  const tab = m.tab || 'album';
  const counts = m.counts || {};
  let s = CSS + `<div class="kl-tabs">${TABS.map(([id, name, ic]) => `<button class="${tab === id ? 'on' : ''}" data-a="kolTab" data-id="${id}">${I(ic)}${esc(name)}${counts[id] ? ` <small style="font:800 12px var(--body);opacity:.7">${esc(counts[id])}</small>` : ''}</button>`).join('')}</div>`;
  s += `<div class="kl-top"><span class="sb-chip">${I('trophy')} Tamamlanan sayfa: ${m.pagesDone ?? 0} / ${m.pagesTotal ?? 0}</span>${m.bonus ? `<span class="sb-chip ok">${I('bolt')} Kalıcı satış +%${m.bonus}</span>` : ''}</div>`;
  switch (tab) {
    case 'balik': return s + tabBalik(m);
    case 'kapak': return s + tabKapak(m);
    case 'kartpostal': return s + tabPost(m);
    case 'hikaye': return s + tabHikaye(m);
    case 'vitrin': return s + tabVitrin(m);
    case 'firin': return s + tabFirin(m);
    default: return s + tabAlbum(m);
  }
}

/** Card for the Görevler panel that opens the Koleksiyon sheet (and a second button for the Altın Fırın). */
export function renderKolSection(k: any): string {
  if (!k) return '';
  return CSS + `<div class="sb-sec">${I('sparkle')}Koleksiyon<span>${k.pagesDone} / ${k.pagesTotal} sayfa</span></div><div class="sb-card kl-sec-card">${SIMIT_SVG(52)}<div class="sb-grow"><h3>Albümler ve Altın Fırın${k.isNew ? ' <span class="sb-chip gold">Yeni!</span>' : ''}</h3><p>Paket: ${k.packs} · Olta: ${k.casts} · ${k.gold} Altın Simit</p></div></div><div class="sb-mrow" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">${btn('Koleksiyon', 'kolOpen', 'album', 'green')}${btn('Altın Fırın', 'kolOpen', 'firin', 'cream', k.firinOpen ? 'Açık' : 'Yakında')}</div>`;
}
