// Kuryeler sheet ('kurye' panel) and the "Kuryeler" section of the Ekip (isciler) panel. Pure HTML string renderers in
// the v2ui style (sb-card / sb-btn); v2ui.ts calls them from its RENDER table. Button data-a names map to the
// panelActions('kurye') / ('isciler') factories in sim/panels.ts. Owner: kurye feature (survey kurye-1..9, ekonomi-3).
// Decisions: vehicle and map art are tiny code-made SVGs (no image files); big text, one tap per action.
import { ICONS } from '../../engine/ui/v2-style';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const I = (k: string) => ICONS[k] || '';
const tl = (n: number) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₺';
const btn = (label: string, act: string, id: string | number | null, cls: string, sub?: string, off?: boolean, why?: string) =>
  `<button class="sb-btn ${cls}${off ? ' off' : ''}" data-a="${act}"${id != null ? ` data-id="${esc(id)}"` : ''}${why ? ` data-why="${esc(why)}"` : ''}><span class="sb-bl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
const starRow = (n: number) => { let s = '<span class="ky-st">'; for (let i = 1; i <= 5; i++) s += `<i class="${i <= Math.round(n) ? 'on' : ''}">★</i>`; return s + '</span>'; };

/** Small side-view vehicle icon per vehicle id. */
export function aracSvg(id: string, color: string, size = 52): string {
  const ink = '#3b2a20';
  const wheel = (x: number) => `<circle cx="${x}" cy="38" r="6" fill="#fff" stroke="${ink}" stroke-width="2.5"/>`;
  const rider = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#f2c9a0" stroke="${ink}" stroke-width="2"/><path d="M${x - 5} ${y - 2}q5-7 10 0z" fill="#ffd23f" stroke="${ink}" stroke-width="1.5"/>`;
  let body = '';
  switch (id) {
    case 'sandal': body = `<path d="M6 32h36l-5 9H11z" fill="${color}" stroke="${ink}" stroke-width="2.5"/><path d="M30 18l10 18" stroke="${ink}" stroke-width="2.5"/><rect x="14" y="24" width="10" height="8" fill="#ffd23f" stroke="${ink}" stroke-width="2"/>${rider(28, 22)}<path d="M2 44q6-3 12 0t12 0 12 0 10 0" stroke="#49a8e0" stroke-width="2.5" fill="none"/>`; break;
    case 'semer': body = `<rect x="14" y="14" width="16" height="16" rx="3" fill="${color}" stroke="${ink}" stroke-width="2.5"/><rect x="16" y="6" width="12" height="9" fill="#ffd23f" stroke="${ink}" stroke-width="2"/>${rider(33, 16)}<path d="M30 22l2 20M36 22l-2 20" stroke="${ink}" stroke-width="3"/>`; break;
    case 'marti': body = `<ellipse cx="24" cy="30" rx="16" ry="8" fill="${color}" stroke="${ink}" stroke-width="2.5"/><path d="M14 28q-10-14-12-6 4 6 12 8zM34 28q10-14 12-6-4 6-12 8z" fill="#ddd" stroke="${ink}" stroke-width="2"/><path d="M40 30l6 2-6 2z" fill="#e8b23a" stroke="${ink}" stroke-width="1.5"/>${rider(24, 18)}`; break;
    case 'teleferik': body = `<path d="M2 8L46 4" stroke="${ink}" stroke-width="2"/><path d="M24 6v8" stroke="${ink}" stroke-width="2"/><rect x="12" y="14" width="24" height="20" rx="4" fill="${color}" stroke="${ink}" stroke-width="2.5"/><rect x="16" y="18" width="16" height="7" fill="#cfeaf3" stroke="${ink}" stroke-width="1.5"/><rect x="18" y="27" width="12" height="6" fill="#ffd23f" stroke="${ink}" stroke-width="1.5"/>`; break;
    case 'roket': body = `<ellipse cx="22" cy="30" rx="16" ry="4" fill="#c9ccd1" stroke="${ink}" stroke-width="2.5"/><path d="M38 28l8-3v10l-8-3z" fill="${color}" stroke="${ink}" stroke-width="2"/><path d="M46 30h4" stroke="#ff8c2b" stroke-width="4"/>${rider(20, 20)}<rect x="8" y="22" width="8" height="6" fill="#ffd23f" stroke="${ink}" stroke-width="1.5"/>`; break;
    case 'simitci': body = `${wheel(12)}${wheel(36)}<path d="M12 38l10-12h12l2 12M22 26l-2-6" stroke="${color}" stroke-width="3.5" fill="none"/><ellipse cx="14" cy="22" rx="10" ry="3" fill="#c9893f" stroke="${ink}" stroke-width="2"/><circle cx="10" cy="19" r="2.5" fill="#b5733a"/><circle cx="17" cy="19" r="2.5" fill="#b5733a"/>${rider(30, 16)}`; break;
    default: body = `${wheel(12)}${wheel(36)}<path d="M12 38l10-12h12l2 12M22 26l-2-6" stroke="${color}" stroke-width="3.5" fill="none"/><rect x="26" y="16" width="12" height="10" fill="#ffd23f" stroke="${ink}" stroke-width="2"/>${rider(22, 14)}`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;
}

const HAVA_IC: Record<string, string> = {
  gunes: '<circle cx="24" cy="24" r="9" fill="#ffd23f" stroke="#3b2a20" stroke-width="2.5"/>',
  sicak: '<circle cx="24" cy="24" r="10" fill="#ff8c2b" stroke="#3b2a20" stroke-width="2.5"/><path d="M24 6v6M24 36v6M6 24h6M36 24h6" stroke="#ff8c2b" stroke-width="3"/>',
  yagmur: '<path d="M10 26a8 8 0 0 1 8-8 10 10 0 0 1 19 3 6 6 0 0 1 0 12H14a6 6 0 0 1-4-7z" fill="#cfd8e0" stroke="#3b2a20" stroke-width="2.5"/><path d="M16 38l-2 5M24 38l-2 5M32 38l-2 5" stroke="#49a8e0" stroke-width="3"/>',
  kar: '<path d="M10 24a8 8 0 0 1 8-8 10 10 0 0 1 19 3 6 6 0 0 1 0 12H14a6 6 0 0 1-4-7z" fill="#fff" stroke="#3b2a20" stroke-width="2.5"/><g fill="#9fd3f0"><circle cx="16" cy="40" r="2.5"/><circle cx="25" cy="42" r="2.5"/><circle cx="33" cy="39" r="2.5"/></g>',
};
export const havaSvg = (id: string, size = 40) => `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${HAVA_IC[id] || HAVA_IC.gunes}</svg>`;

/** Static district map with live courier dots (the overlay draws the animated one). */
function mapSvg(semtler: any[], live: any[]): string {
  let s = `<svg viewBox="0 0 100 100" class="ky-map" aria-hidden="true"><rect x="0" y="0" width="100" height="100" rx="8" fill="#f6ecd2"/><path d="M0 92q25-6 50 0t50 0V100H0z" fill="#8fd0ea"/><path d="M50 88V50" stroke="#d8c7a0" stroke-width="5" stroke-linecap="round"/>`;
  for (const t of semtler) {
    const x = t.mx * 100, y = t.my * 100;
    s += `<path d="M50 88V${(88 + y) / 2}H${x}V${y}" stroke="${t.open ? '#d8c7a0' : '#e8dfc8'}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }
  for (const t of semtler) {
    const x = t.mx * 100, y = t.my * 100;
    s += `<g opacity="${t.open ? 1 : 0.45}"><rect x="${x - 6}" y="${y - 6}" width="12" height="10" rx="2" fill="${t.open ? '#fff6e6' : '#ddd'}" stroke="#3b2a20" stroke-width="1.5"/><path d="M${x - 7} ${y - 5}l7-5 7 5z" fill="${t.open ? '#e0533c' : '#aaa'}" stroke="#3b2a20" stroke-width="1.2"/><text x="${x}" y="${y + 11}" font-size="5.2" font-weight="800" text-anchor="middle" fill="#3b2a20">${esc(t.name)}</text></g>`;
  }
  s += `<g><rect x="44" y="84" width="12" height="9" rx="2" fill="#ffd23f" stroke="#3b2a20" stroke-width="1.5"/><text x="50" y="99" font-size="5" font-weight="900" text-anchor="middle" fill="#3b2a20">Büfe</text></g>`;
  for (const c of live) s += `<circle cx="${c.mx * 100}" cy="${c.my * 100}" r="3.2" fill="${esc(c.color)}" stroke="#3b2a20" stroke-width="1.5"/>`;
  return s + '</svg>';
}

const CSS = `<style>
.ky-top{display:flex;gap:10px;align-items:center}.ky-top h3{font:900 19px/1.1 var(--disp);margin:0}.ky-top p{font:700 15px/1.3 var(--body);margin:3px 0 0}
.ky-row{display:grid;grid-template-columns:52px 1fr auto;gap:10px;align-items:center}
.ky-row h3{font:900 18px/1.15 var(--disp);margin:0}.ky-row p{font:700 14px/1.3 var(--body);margin:2px 0}
.ky-row .sb-btn{min-height:52px;font-size:16px}
.ky-st{display:inline-flex;gap:1px;font-size:17px;line-height:1;vertical-align:-1px}.ky-st i{font-style:normal;color:#d9cfbf}.ky-st i.on{color:#f2b632;text-shadow:0 1px 0 #3b2a20}
.ky-vsel{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap}
.ky-vsel button{border:2.5px solid var(--ink);border-radius:12px;background:#fff;padding:2px 4px;min-height:48px}.ky-vsel button.on{background:var(--yellow)}
.ky-map{width:100%;max-width:360px;display:block;margin:0 auto;border:2.5px solid var(--ink);border-radius:14px}
.ky-ord{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}.ky-ord h3{font:900 17px/1.15 var(--disp);margin:0}.ky-ord p{font:700 14px/1.3 var(--body);margin:2px 0}
.ky-ord .bt{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.ky-ord .sb-btn{min-height:50px;font-size:16px}
.ky-rate p{font:700 15px/1.35 var(--body);margin:3px 0}.ky-rate small{font:800 12px/1.2 var(--body);opacity:.7}
.ky-sus{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}
.ky-sus .sb-btn{min-height:52px;font-size:14px;justify-content:flex-start}.ky-sus .sw{display:inline-block;width:16px;height:16px;border-radius:50%;border:2px solid var(--ink);margin-right:6px;vertical-align:-3px}
.ky-sec-card{display:flex;gap:10px;align-items:center}.ky-sec-card h3{font:900 18px/1.1 var(--disp);margin:0}.ky-sec-card p{font:700 15px/1.3 var(--body);margin:2px 0}
</style>`;

const STATE_TXT: Record<string, string> = { idle: 'Büfede, çay içiyor', wait: 'Tezgahta paket bekliyor', out: 'Yolda', back: 'Dönüyor' };

export function renderKurye(m: any): string {
  if (!m || !m.on) return CSS + `<div class="sb-empty">${aracSvg('bisiklet', '#e8b23a', 72)}<span>PaketMartı tableti Esnaf Seviyesi ${esc(m?.openLevel ?? 3)} olunca tezgaha gelir. İlk kuryen hazır bekliyor!</span></div>`;
  let s = CSS;
  s += `<div class="sb-card ky-top">${havaSvg(m.hava?.id)}<div class="sb-grow"><h3>Bugün: ${esc(m.hava?.name)}</h3><p>${esc(m.hava?.note)}</p></div></div>`;
  if (m.offNote) s += `<div class="sb-card ky-top">${I('moon')}<div class="sb-grow"><p>${esc(m.offNote)}</p></div>${btn('Tamam', 'kSeen', null, 'cream sm')}</div>`;
  s += `<div class="mg-top" style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0"><span class="sb-chip">${starRow(m.avg)} ${m.avg ? String(m.avg).replace('.', ',') : '-'} (${m.starN})</span><span class="sb-chip">${I('coin')} ${tl(m.earned)}</span><span class="sb-chip">${m.trips} teslimat</span>${m.cats ? `<span class="sb-chip">${I('cat')} ${m.cats} kedi ziyareti</span>` : ''}${m.selfWins ? `<span class="sb-chip">Sen götür: ${m.selfWins}</span>` : ''}</div>`;
  // tablet
  const tab = m.tablet || [];
  s += `<div class="sb-sec">${I('newspaper')}PaketMartı tableti<span>${tab.length} sipariş${m.queued ? ' · ' + m.queued + ' sırada' : ''}</span></div>`;
  if (!tab.length) s += `<div class="sb-card sb-muted">Tablet sessiz. Biraz bekle, mahalle acıkacak.</div>`;
  for (const o of tab) s += `<div class="sb-card ky-ord"><div><h3>${esc(o.semtName)} · ${tl(o.value)}</h3><p>${esc(o.items)}</p><p class="sb-muted">${esc(o.who)}: ${esc(o.note)} · ${esc(o.terrain)} · ${o.left} sn</p></div><div class="bt">${btn('Kabul', 'kAccept', o.id, 'green')}${o.sen ? btn('Sen götür!', 'kSelf', o.id, 'blue', '20 sn') : ''}${btn('Geç', 'kDecline', o.id, 'cream sm')}</div></div>`;
  // map
  s += `<div class="sb-sec">${I('ferry')}Teslimat haritası</div><div class="sb-card">${mapSvg(m.semtler || [], m.live || [])}</div>`;
  // couriers
  const cs = m.couriers || [];
  s += `<div class="sb-sec">${I('people')}Kuryeler<span>${cs.length} / ${m.max}</span></div>`;
  const owned = (m.araclar || []).filter((a: any) => a.owned);
  for (const c of cs) {
    s += `<div class="sb-card ky-row">${aracSvg(c.arac, c.color)}<div><h3>${esc(c.name)} <span class="sb-chip">${esc(c.huy)}</span></h3><p>${esc(c.huyFx)}</p><p>${esc(STATE_TXT[c.state] || '')}${c.semt ? ': ' + esc(c.semt) : ''}${c.waitFor ? ' (' + esc(c.waitFor) + ' eksik, tezgaha koy)' : ''}</p><p>${starRow(c.avg)} ${c.trips} paket · çanta ${c.bag}</p></div><span></span>`;
    if (owned.length > 1) s += `<div class="ky-vsel">${owned.map((a: any) => `<button class="${a.id === c.arac ? 'on' : ''}" data-a="kVeh" data-id="${esc(c.id + ':' + a.id)}" aria-label="${esc(a.name)}">${aracSvg(a.id, a.color, 40)}</button>`).join('')}</div>`;
    s += '</div>';
  }
  if (m.hire) s += btn('Yeni kurye al', 'kHire', null, 'green wide', m.level >= m.hire.level ? tl(m.hire.cost) : 'Esnaf Seviyesi ' + m.hire.level, !m.hire.can, m.level < m.hire.level ? 'Esnaf Seviyesi ' + m.hire.level + ' olunca.' : 'Biraz daha para lazım.');
  // upgrades
  s += `<div class="sb-sec">${I('bolt')}Yükseltmeler</div>`;
  for (const u of m.upg || []) {
    const done = u.lvl >= u.max;
    s += `<div class="sb-card ky-row"><div style="font:900 22px/1 var(--disp);text-align:center">${u.lvl}/${u.max}</div><div><h3>${esc(u.name)}</h3><p>${esc(u.what)}</p></div>${done ? `<span class="sb-chip ok">Tam!</span>` : btn('Yükselt', 'kUpg', u.id, 'green sm', tl(u.cost), (m.money ?? 0) < u.cost, 'Biraz daha para lazım.')}</div>`;
  }
  // vehicles
  s += `<div class="sb-sec">${I('sparkle')}Araçlar<span>${owned.length} / ${(m.araclar || []).length}</span></div>`;
  for (const a of m.araclar || []) {
    let b: string;
    if (a.owned) b = `<span class="sb-chip ok">Garajda</span>`;
    else if (!a.open) b = `<span class="sb-chip">${I('lock')} Seviye ${a.level}</span>`;
    else b = btn('Al', 'kBuyVeh', a.id, 'green sm', tl(a.price), (m.money ?? 0) < a.price, 'Biraz daha para lazım.');
    s += `<div class="sb-card ky-row" style="${a.open || a.owned ? '' : 'opacity:.6'}">${aracSvg(a.id, a.color)}<div><h3>${esc(a.name)}</h3><p>${esc(a.blurb)}</p><p class="sb-muted">${a.best ? 'Usta: ' + esc(a.best) : 'Her yolda idare eder'}${a.bag ? ' · çanta +' + a.bag : ''}</p></div>${b}</div>`;
  }
  // cosmetics
  s += `<div class="sb-sec">${I('dekor')}Araç süsleri<span>süslü kurye, mutlu müşteri</span></div><div class="ky-sus">`;
  for (const x of m.sus || []) s += btn((x.on ? '✓ ' : '') + x.name, 'kSus', x.id, x.on ? '' : 'cream', x.kindName + (x.owned ? '' : ' · ' + (x.price ? tl(x.price) : 'bedava')), !x.owned && (m.money ?? 0) < x.price, 'Biraz daha para lazım.').replace('<span class="sb-bl">', `<span class="sw" style="background:${esc(x.color)}"></span><span class="sb-bl">`);
  s += '</div>';
  // districts
  s += `<div class="sb-sec">${I('ferry')}Semtler</div>`;
  for (const t of m.semtler || []) s += `<div class="sb-card ky-row" style="${t.open ? '' : 'opacity:.55'}"><div style="font:900 15px/1.1 var(--disp);text-align:center">×${String(t.payX).replace('.', ',')}</div><div><h3>${esc(t.name)}</h3><p>${esc(t.blurb)}</p></div><span class="sb-chip">${t.open ? esc(t.terrain) : I('lock') + ' Menzil ' + t.range}</span></div>`;
  // ratings
  const rs = m.ratings || [];
  s += `<div class="sb-sec">${I('star')}Müşteri yorumları</div>`;
  if (!rs.length) s += `<div class="sb-card sb-muted">İlk yıldızlar ilk teslimattan sonra gelir.</div>`;
  for (const r of rs) s += `<div class="sb-card ky-rate">${starRow(r.s)}<p>"${esc(r.text)}"</p><small>${esc(r.who)} · ${esc(r.semt)} · kurye ${esc(r.kurye)}</small></div>`;
  return s;
}

/** Small card for the Ekip panel that opens the Kuryeler sheet. */
export function renderKuryeSection(k: any): string {
  if (!k) return '';
  if (!k.on) return CSS + `<div class="sb-sec">${I('stopwatch')}Kuryeler</div><div class="sb-card sb-muted">${I('lock')} PaketMartı Esnaf Seviyesi ${esc(k.openLevel)} olunca açılır.</div>`;
  return CSS + `<div class="sb-sec">${I('stopwatch')}Kuryeler<span>${k.n} / ${k.max}</span></div><div class="sb-card ky-sec-card">${aracSvg('bisiklet', '#e8b23a')}<div class="sb-grow"><h3>PaketMartı hattı</h3><p>${k.out} yolda · ${k.tablet} sipariş bekliyor · ${k.avg ? String(k.avg).replace('.', ',') + ' yıldız' : 'henüz puan yok'} · ${esc(k.hava)}</p></div>${btn('Aç', 'kuryeOpen', null, 'green sm')}</div>`;
}
