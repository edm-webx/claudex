// Mini Oyunlar sheet ('mini' panel) and the "Mini Oyunlar" section of the Görevler panel. Pure HTML string renderers in
// the v2ui style (sb-card / sb-btn); v2ui.ts calls them from its RENDER table. Button data-a names map to the
// panelActions('mini') / ('gorevler') factories in sim/panels.ts. Owner: mini feature (survey mini-1..11).
// Decisions: game icons are tiny code-made SVGs (no image files); big text, one tap per action.
import { ICONS } from '../../engine/ui/v2-style';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const I = (k: string) => ICONS[k] || '';
const btn = (label: string, act: string, id: string | null, cls: string, sub?: string, off?: boolean, why?: string) =>
  `<button class="sb-btn ${cls}${off ? ' off' : ''}" data-a="${act}"${id != null ? ` data-id="${esc(id)}"` : ''}${why ? ` data-why="${esc(why)}"` : ''}><span class="sb-bl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;

const GICON: Record<string, string> = {
  durum: '<rect x="8" y="16" width="32" height="16" rx="8" fill="#f2d39b" stroke="#3b2a20" stroke-width="2.5"/><path d="M14 20q10 6 20 0" stroke="#e0533c" stroke-width="3" fill="none"/><path d="M14 27q10-5 20 0" stroke="#6bb36b" stroke-width="3" fill="none"/>',
  kule: '<path d="M17 36h14l-2 8H19z" fill="#c2551f" stroke="#3b2a20" stroke-width="2"/><path d="M18 24h12l-2 10H20z" fill="#d9822b" stroke="#3b2a20" stroke-width="2"/><path d="M19 12h10l-2 10h-6z" fill="#c2551f" stroke="#3b2a20" stroke-width="2"/>',
  tost: '<rect x="8" y="14" width="32" height="22" rx="5" fill="#9aa3ab" stroke="#3b2a20" stroke-width="2.5"/><rect x="13" y="19" width="22" height="12" rx="3" fill="#e8b23a" stroke="#3b2a20" stroke-width="2"/><path d="M16 25h16" stroke="#b5733a" stroke-width="2"/>',
  simit: '<circle cx="24" cy="26" r="13" fill="#b5733a" stroke="#3b2a20" stroke-width="2.5"/><circle cx="24" cy="26" r="5" fill="#fff6e6" stroke="#3b2a20" stroke-width="2"/><g fill="#fff6e6"><circle cx="17" cy="20" r="1.3"/><circle cx="30" cy="19" r="1.3"/><circle cx="32" cy="30" r="1.3"/><circle cx="18" cy="33" r="1.3"/></g>',
  ayran: '<path d="M15 14h18l-3 30H18z" fill="#fff" stroke="#3b2a20" stroke-width="2.5"/><path d="M15 14q4-8 9-2 5-7 9 2z" fill="#e8f6fb" stroke="#3b2a20" stroke-width="2"/>',
};
const gicon = (id: string, color: string) => `<svg width="56" height="56" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="${esc(color)}" opacity=".25"/>${GICON[id] || ''}</svg>`;
const stars = (n: number) => { let s = '<span class="mg-stars">'; for (let i = 0; i < 3; i++) s += `<i class="${i < n ? 'on' : ''}">${I('star')}</i>`; return s + '</span>'; };

const CSS = `<style>
.mg-top{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}.mg-top .sb-chip{font-size:15px;padding:5px 10px}
.mg-card{display:grid;grid-template-columns:56px 1fr;gap:10px;align-items:center}
.mg-card h3{font:900 20px/1.1 var(--disp);margin:0}.mg-card p{font:700 15px/1.3 var(--body);margin:3px 0}
.mg-card .mg-btns{grid-column:1/-1;display:grid;grid-template-columns:2fr 1fr;gap:8px}.mg-card .mg-btns .sb-btn{min-height:56px;font-size:18px}
.mg-card.lock{opacity:.6;filter:grayscale(.6)}
.mg-stars{display:inline-flex;gap:2px;vertical-align:middle}.mg-stars i svg{width:20px;height:20px;opacity:.25;filter:grayscale(1)}.mg-stars i.on svg{opacity:1;filter:none}
.mg-coll{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.mg-pc{border:2.5px solid var(--ink);border-radius:12px;padding:6px 4px;text-align:center;font:800 12px/1.15 var(--body);background:#fff;min-height:64px}
.mg-pc i{display:block;width:26px;height:26px;margin:0 auto 4px;border-radius:50%;border:2px solid var(--ink)}
.mg-pc.no{opacity:.45}.mg-pc.no i{background:#ddd!important}
.mg-sec-card{display:flex;gap:10px;align-items:center}.mg-sec-card h3{font:900 18px/1.1 var(--disp);margin:0}.mg-sec-card p{font:700 15px/1.3 var(--body);margin:2px 0}
</style>`;

export function renderMini(m: any): string {
  const games = m.games || [];
  let s = CSS + `<div class="mg-top"><span class="sb-chip gold">${I('trophy')} Ödüllü tur: ${m.tickets ?? 0} / ${m.freeMax ?? 5}</span><span class="sb-chip">${I('gold')} Altın Simit bugün ${m.gold ?? 0} / ${m.goldCap ?? 3}</span>${m.bonusLeft > 0 ? `<span class="sb-chip ok">${I('bolt')} Satış ×1,5: ${Math.floor(m.bonusLeft / 60)}:${String(m.bonusLeft % 60).padStart(2, '0')}</span>` : ''}</div>`;
  s += `<div class="sb-card sb-muted" style="font:700 15px/1.35 var(--body)">${esc(m.venue || '')}. Tamamen beceri! 2 yıldız: koleksiyon parçası ve 5 dakika satış ×1,5. 3 yıldız: Altın Simit. Bir dakikalık kazanç şu an ${esc(m.perMin || '')}.</div>`;
  if ((m.tickets ?? 0) <= 0) s += `<div class="sb-card">${btn('Deneme reklamı izle', 'miniAd', null, 'blue', '+1 ödüllü tur', (m.ad ?? 0) <= 0, 'Bugünlük reklam bileti bitti.')}<p style="font:700 14px/1.3 var(--body);margin:6px 0 0">${esc(m.practiceNote || '')}</p></div>`;
  s += `<div class="sb-sec">${I('play')}Büfe oyunları<span>${games.filter((g: any) => g.open).length} / ${games.length}</span></div>`;
  for (const g of games) {
    if (!g.open) { s += `<div class="sb-card mg-card lock">${gicon(g.id, g.color)}<div><h3>${esc(g.name)}</h3><p>${I('lock')} Esnaf Seviyesi ${g.level} olunca açılır.</p></div></div>`; continue; }
    const rew = (m.tickets ?? 0) > 0;
    s += `<div class="sb-card mg-card">${gicon(g.id, g.color)}<div><h3>${esc(g.name)}</h3><p>${esc(g.how)}</p><p>${stars(g.stars)} ${g.kupa ? esc(g.kupa) + ' · ' : ''}En iyi: ${g.best} · ${g.secs} sn</p></div>
      <div class="mg-btns">${btn(rew ? 'Oyna' : 'Oyna (antrenman)', rew ? 'miniPlay' : 'miniPractice', g.id, rew ? 'green' : 'cream', rew ? 'Ödüllü tur' : 'Ödülsüz')}${btn('Antrenman', 'miniPractice', g.id, 'cream sm', 'Ödülsüz')}</div></div>`;
  }
  const coll = m.coll || [];
  s += `<div class="sb-sec">${I('sparkle')}Mini oyun koleksiyonu<span>${coll.filter((c: any) => c.got).length} / ${coll.length}</span></div><div class="mg-coll">`;
  for (const c of coll) s += `<div class="mg-pc${c.got ? '' : ' no'}"><i style="background:${esc(c.color)}"></i>${c.got ? esc(c.name) : esc(c.kindName) + ' ???'}</div>`;
  s += '</div>';
  if (m.micro) s += `<div class="sb-card sb-muted" style="margin-top:8px">Ustalık hareketi başarısı: ${m.micro}. Çay ve ayran tezgahında bekleyince arada sorulur.</div>`;
  return s;
}

/** Small card for the Görevler panel that opens the Mini Oyunlar sheet. */
export function renderMiniSection(k: any): string {
  if (!k || !k.open) return k && k.next ? CSS + `<div class="sb-sec">${I('play')}Mini Oyunlar</div><div class="sb-card sb-muted">${I('lock')} İlk oyun: ${esc(k.next)}</div>` : '';
  return CSS + `<div class="sb-sec">${I('play')}Mini Oyunlar<span>${k.open} / ${k.total}</span></div><div class="sb-card mg-sec-card">${gicon('simit', '#ffd23f')}<div class="sb-grow"><h3>Lunapark Martı köşesi${k.isNew ? ' <span class="sb-chip gold">Yeni!</span>' : ''}</h3><p>Ödüllü tur: ${k.tickets} / ${k.freeMax}${k.next ? ' · Sırada: ' + esc(k.next) : ''}</p></div>${btn('Aç', 'miniOpen', null, 'green sm')}</div>`;
}
