// Takvim ve Hava sheet ('hava' panel) and the small "Takvim ve Hava" card in the Görevler panel. Pure HTML string
// renderers in the v2ui style (sb-card / sb-btn); v2ui.ts calls them from its RENDER table. data-a names map to
// panelActions('hava') / ('gorevler') in sim/panels.ts. Owner: hava feature (survey etkinlik-1..8, iskele-8, yiyecek-6).
// Decisions: weather icons are emoji glyphs drawn big (no image files); one tap per action, 15px+ text.
import { ICONS } from '../../engine/ui/v2-style';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const I = (k: string) => ICONS[k] || '';
const fmt = (n: number) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const tl = (n: number) => fmt(n) + ' ₺';
const btn = (label: string, act: string, id: string | null, cls: string, sub?: string, off?: boolean, why?: string) =>
  `<button class="sb-btn ${cls}${off ? ' off' : ''}" data-a="${act}"${id != null ? ` data-id="${esc(id)}"` : ''}${why ? ` data-why="${esc(why)}"` : ''}><span class="sb-bl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
const meter = (p: number, color: string) => `<div class="sb-meter"><i style="width:${(Math.max(0, Math.min(1, p)) * 100).toFixed(1)}%;background:${color}"></i></div>`;

const CSS = `<style>
.hv-top{display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center}
.hv-ic{font-size:44px;line-height:64px;text-align:center;width:64px;height:64px;border-radius:50%;border:3px solid var(--ink);background:#fff6e6}
.hv-top h3{font:900 21px/1.1 var(--disp);margin:0}.hv-top p{font:700 15px/1.3 var(--body);margin:3px 0 0}
.hv-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.hv-chips .sb-chip{font-size:14px;padding:4px 9px}
.hv-ev{border-width:3px}.hv-ev h3{font:900 21px/1.1 var(--disp);margin:0 0 2px}.hv-ev p{font:700 15px/1.3 var(--body);margin:3px 0}
.hv-ban{height:14px;border-radius:7px;margin:-2px 0 8px;border:2px solid var(--ink)}
.hv-items{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0}
.hv-it{border:2.5px solid var(--ink);border-radius:12px;background:#fff;padding:6px 8px;font:800 14px/1.2 var(--body)}.hv-it b{display:block;font:900 15px/1.1 var(--body);color:var(--money)}
.hv-row{display:flex;gap:10px;align-items:center}.hv-row h3{font:900 18px/1.1 var(--disp);margin:0}.hv-row p{font:700 15px/1.3 var(--body);margin:2px 0}
.hv-up{display:grid;grid-template-columns:54px 1fr;gap:8px;align-items:center}.hv-up .d{font:900 20px/1 var(--disp);text-align:center;border:2.5px solid var(--ink);border-radius:12px;padding:6px 0;background:#fff6e6}.hv-up .d small{display:block;font:800 11px/1 var(--body)}
.hv-up h3{font:900 17px/1.1 var(--disp);margin:0}.hv-up p{font:700 14px/1.3 var(--body);margin:2px 0}
.hv-mk{display:grid;grid-template-columns:30px 1fr auto;gap:8px;align-items:center;margin:6px 0}.hv-mk i{width:28px;height:28px;border-radius:50%;border:2.5px solid var(--ink)}
.hv-mk p{margin:0;font:800 15px/1.2 var(--body)}.hv-mk p small{display:block;font:700 13px/1.2 var(--body);opacity:.75}.hv-mk .sb-btn{min-height:52px}
.hv-tags{display:flex;gap:6px;flex-wrap:wrap}.hv-tags span{border:2px solid var(--ink);border-radius:999px;padding:4px 10px;font:800 14px/1.2 var(--body);background:#fff}
.hv-sec{display:flex;gap:10px;align-items:center}.hv-sec .hv-ic{width:52px;height:52px;line-height:52px;font-size:34px}.hv-sec h3{font:900 18px/1.1 var(--disp);margin:0}.hv-sec p{font:700 15px/1.3 var(--body);margin:2px 0}
</style>`;

export function renderHava(m: any): string {
  if (!m || !m.dateText) return `<div class="sb-empty">${I('sun')}<span>Takvim birazdan açılıyor.</span></div>`;
  const w = m.weather || {};
  let s = CSS + `<div class="sb-card hv-top"><div class="hv-ic">${esc(w.icon || '☀')}</div><div><h3>${esc(m.dateText)}</h3><p><b>${esc(m.season)}</b> · ${esc(w.name)}${w.on ? '' : ' (şimdilik açık)'}</p><p>${esc(w.effect || '')}</p>
    <div class="hv-chips">${(m.today || []).map((t: any) => `<span class="sb-chip">${esc(t.icon)} ${esc(t.name)} ${t.from}:00-${t.to}:00</span>`).join('') || '<span class="sb-chip">☀ Bütün gün açık</span>'}</div></div></div>`;
  // umbrellas
  const um = m.umbrella || {};
  const canU = um.n < um.max, rich = (um.money || 0) >= (um.cost || 0);
  s += `<div class="sb-sec">${I('umbrella')}Masa şemsiyeleri<span>${um.n} / ${um.max}</span></div><div class="sb-card"><div class="hv-row"><div class="hv-ic" style="width:52px;height:52px;line-height:52px;font-size:32px">⛱</div><div class="sb-grow"><h3>Her masaya bir şemsiye</h3>
    <p>Güneşte müşteri daha uzun oturur, bahşiş artar. Yağmurda masalar boşalmaz. Lodosta uçar: yakalarsan bonus!</p><p>Masalar: ${um.tables} · Şemsiye: ${um.n}${m.caught ? ' · Yakalanan: ' + m.caught : ''}</p></div></div>
    <div style="margin-top:8px">${canU ? btn('Şemsiye al', 'havaUmb', null, 'green', tl(um.cost), !rich, 'Kasada ' + tl(um.cost) + ' olmalı.') : `<span class="sb-chip ok">${I('check')} Bütün şemsiyeler tamam</span>`}</div></div>`;
  // night market
  const mk = m.market || {};
  s += `<div class="sb-sec">${I('moon')}Gece Pazarı<span>${mk.today ? (mk.open ? 'Şu an açık' : mk.closed ? 'Bu hafta bitti' : 'Bu akşam 19:00') : mk.days + ' gün sonra'}</span></div><div class="sb-card">
    <p style="font:700 15px/1.35 var(--body);margin:0 0 4px">Her Cumartesi gecesi iskeleye tezgahlar kurulur. Stoku önceden koy, tezgah kendi satar. Son saat yarı fiyat, kalanlar kedilere.</p>
    ${mk.today && (mk.open || mk.closed) ? `<p style="font:800 15px/1.3 var(--body);margin:0 0 4px">Bu gece: ${mk.sold} satış, ${tl(mk.earned)}${mk.fresh && mk.open ? ' · Tazelik saati!' : ''}</p>` : ''}`;
  for (const it of mk.items || []) {
    const full = it.stock >= it.max, ok = (mk.money || 0) >= it.cost;
    s += `<div class="hv-mk"><i style="background:${esc(it.color)}"></i><p>${esc(it.name)} · ${it.stock} adet<small>Tanesi ${tl(it.price)}</small></p>${btn('+' + it.pack, 'havaStock', it.id, 'cream sm', tl(it.cost), full || !ok, full ? 'Tezgah dolu.' : 'Kasada ' + tl(it.cost) + ' olmalı.')}</div>`;
  }
  s += `</div>`;
  // seasonal foods
  s += `<div class="sb-sec">${I('flame')}Mevsimlik tezgah<span>${esc(m.season)}</span></div><div class="sb-card"><p style="font:700 15px/1.35 var(--body);margin:0 0 6px">Mevsimin lezzetleri satışların yanına eklenir. Kışın sıcaklar, yazın soğuklar daha çok istenir.${m.foodSold ? ' Satılan: ' + m.foodSold : ''}</p>
    <div class="hv-items">${(m.foods || []).map((f: any) => `<div class="hv-it">${esc(f.name)}<b>${tl(f.price)}</b></div>`).join('')}</div></div>`;
  // trophies
  const tr = m.trophies || [], ex = m.extras || [];
  if (tr.length || ex.length) s += `<div class="sb-sec">${I('trophy')}Kupalar ve ödüller<span>${tr.length}</span></div><div class="sb-card"><div class="hv-tags">${tr.map((t: string) => `<span>${I('trophy')} ${esc(t)}</span>`).join('')}${ex.map((t: string) => `<span>${esc(t)}</span>`).join('')}</div></div>`;
  return s;
}

/** Small card for the Görevler panel that opens the Takvim ve Hava sheet. */
export function renderHavaSection(k: any): string {
  if (!k) return '';
  const sub = [k.market].filter(Boolean).slice(0, 2).map(esc).join(' · ');
  return CSS + `<div class="sb-sec">${I('sun')}Takvim ve Hava<span>${esc(k.season)}</span></div><div class="sb-card hv-sec"><div class="hv-ic">${esc(k.icon)}</div><div class="sb-grow"><h3>${esc(k.dateText)} · ${esc(k.weather)}</h3><p>${sub || 'Şemsiyeler, Gece Pazarı, şenlikler'}</p></div>${btn('Aç', 'havaOpen', null, 'green sm')}</div>`;
}
