// 'deniz' sheet (İskele ve Deniz) + the small cards in the Tadilat and Görevler panels. Pure HTML string renderers in the
// v2ui style (sb-card / sb-btn); data-a names map to panelActions('deniz' | 'tadilat' | 'gorevler') in sim/panels.ts.
// Owner: deniz feature (survey vapur-4..7, iskele-3/5/10, yasam-2). Big text, one tap per action, emoji glyphs (no images).
import { ICONS } from '../../engine/ui/v2-style';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const I = (k: string) => ICONS[k] || '';
const fmt = (n: number) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const tl = (n: number) => fmt(n) + ' ₺';
const btn = (label: string, act: string, id: string | null, cls: string, sub?: string, off?: boolean, why?: string) =>
  `<button class="sb-btn ${cls}${off ? ' off' : ''}" data-a="${act}"${id != null ? ` data-id="${esc(id)}"` : ''}${why ? ` data-why="${esc(why)}"` : ''}><span class="sb-bl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
const own = () => `<span class="sb-chip ok">${I('check')} Var</span>`;

const CSS = `<style>
.dz-ic{font-size:34px;line-height:52px;text-align:center;width:52px;height:52px;border-radius:50%;border:3px solid var(--ink);background:#e6f4fb;flex:none}
.dz-row{display:flex;gap:10px;align-items:center}.dz-row h3{font:900 18px/1.15 var(--disp);margin:0}.dz-row p{font:700 15px/1.3 var(--body);margin:2px 0}
.dz-row .sb-btn{min-height:52px;flex:none}
.dz-top{display:flex;gap:10px;align-items:center;background:linear-gradient(180deg,#bfe6f5,#e6f6fb)}.dz-top h3{font:900 21px/1.1 var(--disp);margin:0}.dz-top p{font:700 15px/1.3 var(--body);margin:3px 0 0}
.dz-tb{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center;margin:6px 0}.dz-tb b{font:900 16px/1 var(--disp)}
.dz-seg{display:flex;gap:6px;flex-wrap:wrap}.dz-seg button{min-width:52px;min-height:48px;font-size:24px;border:2.5px solid var(--ink);border-radius:12px;background:#fff;cursor:pointer}
.dz-seg button.on{background:var(--yellow);box-shadow:0 3px 0 var(--ink)}
.dz-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dz-life{border:2.5px solid var(--ink);border-radius:14px;background:#fff;padding:8px;text-align:center}
.dz-life .e{font-size:34px;line-height:1.1}.dz-life h4{font:900 15px/1.15 var(--disp);margin:4px 0 2px}.dz-life p{font:700 13px/1.25 var(--body);margin:0;opacity:.8}
.dz-life.no .e{filter:grayscale(1) brightness(.4);opacity:.5}.dz-life.rare{background:#fff7dd}
.dz-now{border-width:3px;background:#fff7dd}
</style>`;

export function renderDeniz(m: any): string {
  if (!m || !m.exterior) return `<div class="sb-empty">${I('sun')}<span>Deniz biraz dalgalı, birazdan açılıyor.</span></div>`;
  let s = CSS + `<div class="sb-card dz-top"><div class="dz-ic">⚓</div><div><h3>İskele ve Deniz</h3><p>Büfenin dışı, masalar, iskele genişlemesi ve Deniz Defteri.</p><p><b>Satış bonusu: %${m.bonus}</b> (en fazla %${m.cap})</p></div></div>`;
  if (m.now && (m.now.sight || m.now.boat)) s += `<div class="sb-card dz-now"><p style="font:800 16px/1.3 var(--body);margin:0">${m.now.sight ? '🌊 Şu an denizde: <b>' + esc(m.now.sight) + '</b>. Fotoğrafını çek!' : ''}${m.now.sight && m.now.boat ? '<br>' : ''}${m.now.boat ? '⛵ İskelede: <b>' + esc(m.now.boat) + '</b>' : ''}</p>
    <div class="sb-mrow" style="margin-top:6px">${m.now.sight ? btn('Fotoğraf çek', 'dzPhoto', null, 'blue sm') : ''}${m.now.boat ? btn('Teklife bak', 'dzBoat', null, 'green sm') : ''}</div></div>`;

  // vapur
  const v = m.vapur || {};
  s += `<div class="sb-sec">${I('tray')}Vapur ve güverte<span>${v.runs} koşu</span></div><div class="sb-card">
    <p style="font:700 15px/1.35 var(--body);margin:0 0 6px">Vapur yanaşınca elin doluyken iskele kapısına koş: 10 saniye güvertede satış, fiyatlar %40 fazla!</p>
    <p style="font:800 15px/1.3 var(--body);margin:0">En iyi koşu: ${v.best} satış · Toplam: ${v.sales} satış, ${tl(v.earned)}${v.vip ? ' · Yat VIP: ' + v.vip : ''}${v.fish ? ' · Balık ekmek: ' + v.fish : ''}</p></div>
    <div class="sb-card dz-row"><div class="dz-ic">⛴</div><div class="sb-grow"><h3>Vapur Büfesi</h3><p>${esc(v.bufeText)}</p></div>${v.bufe ? own() : btn('Aç', 'dzBufe', null, 'green sm', tl(v.bufeCost), !!v.bufeWhy, v.bufeWhy)}</div>`;

  // exterior
  s += `<div class="sb-sec">${I('hammer')}Büfenin dışı<span>Sabah açılır, gece kapanır</span></div>`;
  for (const e of m.exterior) s += `<div class="sb-card dz-row"><div class="dz-ic">${esc(e.icon)}</div><div class="sb-grow"><h3>${esc(e.name)}</h3><p>${esc(e.text)}</p><p>Satış +%${e.bonus}</p></div>${e.owned ? own() : btn('Yap', 'dzExt', e.id, 'green sm', tl(e.cost), !!e.why, e.why)}</div>`;
  const w = m.pencere || {};
  s += `<div class="sb-card dz-row"><div class="dz-ic">${esc(w.icon)}</div><div class="sb-grow"><h3>${esc(w.name)}</h3><p>${esc(w.text)}</p></div>${w.owned ? own() : '<span class="sb-chip">Pedden</span>'}</div>`;

  // seating
  s += `<div class="sb-sec">${I('people')}Masa ve oturaklar<span>${(m.kinds || []).length - 1} / ${(m.seats || []).length} çeşit</span></div>`;
  for (const sd of m.seats || []) s += `<div class="sb-card dz-row"><div class="dz-ic">${esc(sd.icon)}</div><div class="sb-grow"><h3>${esc(sd.name)}</h3><p>${esc(sd.text)}</p><p>Masa başına satış +%${sd.bonus}</p></div>${sd.owned ? own() : btn('Al', 'dzSeatBuy', sd.id, 'green sm', tl(sd.cost), !!sd.why, sd.why)}</div>`;
  const tz = m.tez || {};
  s += `<div class="sb-card dz-row"><div class="dz-ic">${esc(tz.icon)}</div><div class="sb-grow"><h3>${esc(tz.name)} (${tz.n} / ${tz.max})</h3><p>${esc(tz.text)}</p><p>Tezgah başına satış +%1</p></div>${tz.n >= tz.max ? own() : btn('As', 'dzTez', null, 'green sm', tl(tz.cost), !!tz.why, tz.why)}</div>`;
  const tables = m.tables || [], kinds = m.kinds || [];
  if (tables.length && kinds.length > 1) {
    s += `<div class="sb-card"><h3 style="font:900 18px/1.1 var(--disp);margin:0 0 4px">Masalara yerleştir</h3><p style="font:700 14px/1.3 var(--body);margin:0 0 6px">Her masa için bir çeşit seç. Tek dokunuş.</p><div class="dz-tb">`;
    for (const t of tables) s += `<b>Masa ${t.i + 1}</b><div class="dz-seg">${kinds.map((k: any) => `<button class="${t.kind === k.id ? 'on' : ''}" data-a="dzSeatSet" data-id="${t.i}:${esc(k.id)}" title="${esc(k.name)}" aria-label="${esc(k.name)}">${esc(k.icon)}</button>`).join('')}</div>`;
    s += `</div></div>`;
  }

  // pier expansion
  s += `<div class="sb-sec">${I('sparkle')}İskele genişlemesi<span>${(m.pier || []).filter((p: any) => p.owned).length} / 3</span></div>`;
  for (const p of m.pier || []) s += `<div class="sb-card dz-row"><div class="dz-ic">${esc(p.icon)}</div><div class="sb-grow"><h3>${esc(p.name)}</h3><p>${esc(p.text)}</p><p><b>${esc(p.perk)}</b> Satış +%${p.bonus}</p></div>${p.owned ? own() : btn('Yap', 'dzPier', p.id, 'green sm', tl(p.cost), !!p.why, p.why)}</div>`;

  // defter
  const life = m.life || [];
  s += `<div class="sb-sec">${I('camera')}Deniz Defteri<span>${life.filter((l: any) => l.n).length} / ${life.length}</span></div><div class="dz-grid">`;
  for (const l of life) s += `<div class="dz-life${l.n ? '' : ' no'}${l.rare ? ' rare' : ''}"><div class="e">${esc(l.icon)}</div><h4>${l.n ? esc(l.name) : '???'}</h4><p>${l.n ? l.n + ' fotoğraf' : esc(l.when)}${l.rare ? ' · Nadir' : ''}</p></div>`;
  s += `</div><div class="sb-sec">${I('note')}Tekneler<span>Tek dokunuşla teklif</span></div><div class="dz-grid">`;
  for (const b of m.boats || []) s += `<div class="dz-life${b.n ? '' : ' no'}"><div class="e">${esc(b.icon)}</div><h4>${esc(b.name)}</h4><p>${b.n ? esc(b.who) + ' · ' + b.n + ' ziyaret' : b.needs ? esc(b.needs) + ' gerekir' : 'Henüz uğramadı'}</p></div>`;
  s += `</div><div class="sb-sec">${I('cat')}İskele hayvanları<span>Pamuk ${m.duel?.kedi || 0} - ${m.duel?.marti || 0} Cemil</span></div><div class="dz-grid">`;
  for (const a of m.animals || []) s += `<div class="dz-life${a.seen ? '' : ' no'}"><div class="e">${esc(a.icon)}</div><h4>${a.seen ? esc(a.name) : '???'}</h4><p>${a.seen ? esc(a.text) : 'Gözünü dört aç.'}</p></div>`;
  return s + `</div>`;
}

/** Small card for the Tadilat / Görevler panels that opens the İskele ve Deniz sheet. */
export function renderDenizSection(k: any): string {
  if (!k) return '';
  return CSS + `<div class="sb-sec">⚓ İskele ve Deniz<span>Bonus %${k.bonus}</span></div><div class="sb-card dz-row"><div class="dz-ic">🌊</div><div class="sb-grow"><h3>Deniz Defteri ${k.seen} / ${k.total}</h3><p>${esc(k.line)}</p></div>${btn('Aç', 'denizOpen', null, 'green sm')}</div>`;
}
