// Menü sheet tabs for the yiyecek feature (survey yiyecek-*, icecek-*, tarif-*, marka-*): Kademeler (the existing
// renderMenu body plus freshness + çay ustalığı cards), Tarif Defteri, Deney Tezgahı and Anlaşma Masası. Pure HTML string
// renderers in the v2ui style (sb-card / sb-btn / sb-chip); every button is data-a="yy" data-id="op:id", which
// panelActions('menu').yy turns into { kind: 'yiyecek', arg }. Mascots and the vegetarian leaf are tiny code-made SVGs.
import { ICONS } from '../../engine/ui/v2-style';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const I = (k: string) => ICONS[k] || '';
const fmt = (n: number) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const tl = (n: number) => fmt(n) + ' ₺';
const yb = (label: string, arg: string, cls: string, sub?: string, off?: boolean, why?: string) =>
  `<button class="sb-btn ${cls}${off ? ' off' : ''}" data-a="yy" data-id="${esc(arg)}"${why ? ` data-why="${esc(why)}"` : ''}><span class="sb-bl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;

export const LEAF = '<svg class="yy-leaf" viewBox="0 0 24 24" aria-label="etsiz"><path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z" fill="#6bb36b" stroke="#2e5e2e" stroke-width="2"/><path d="M5 19L14 10" stroke="#2e5e2e" stroke-width="2" fill="none"/></svg>';

/** Code-made mascot faces (marka-4). */
export function maskotSvg(kind: string, color: string, size = 44): string {
  const ink = '#3b2a20', eyes = '<circle cx="19" cy="24" r="2.6" fill="#3b2a20"/><circle cx="29" cy="24" r="2.6" fill="#3b2a20"/>', smile = '<path d="M19 31q5 4 10 0" stroke="#3b2a20" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
  let b = '';
  switch (kind) {
    case 'balon': b = `<circle cx="24" cy="25" r="15" fill="${color}" stroke="${ink}" stroke-width="2.5"/><circle cx="18" cy="19" r="4" fill="#fff" opacity=".6"/><circle cx="38" cy="10" r="3" fill="${color}" stroke="${ink}" stroke-width="1.6"/><circle cx="10" cy="8" r="2.2" fill="${color}" stroke="${ink}" stroke-width="1.4"/>${eyes}${smile}`; break;
    case 'inek': b = `<ellipse cx="24" cy="26" rx="15" ry="14" fill="#fff" stroke="${ink}" stroke-width="2.5"/><path d="M9 16l-4-5 7 2zM39 16l4-5-7 2z" fill="#f2d39b" stroke="${ink}" stroke-width="2"/><ellipse cx="17" cy="20" rx="4" ry="3" fill="#3b2a20" opacity=".7"/><ellipse cx="24" cy="33" rx="9" ry="5" fill="#f4b6c2" stroke="${ink}" stroke-width="2"/><path d="M13 30q5-4 11 0 6-4 11 0" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M13 30q5-4 11 0 6-4 11 0" stroke="${ink}" stroke-width="1" fill="none"/>${eyes}`; break;
    case 'damla': b = `<path d="M24 6C30 16 38 22 38 30a14 14 0 0 1-28 0c0-8 8-14 14-24z" fill="${color}" stroke="${ink}" stroke-width="2.5"/><path d="M8 26q-4-4 2-6M40 26q4-4-2-6" stroke="${ink}" stroke-width="2.5" fill="#fff"/><path d="M22 31l2 3 2-3z" fill="#f2a43a" stroke="${ink}" stroke-width="1.4"/>${eyes}`; break;
    case 'nar': b = `<circle cx="24" cy="27" r="14" fill="${color}" stroke="${ink}" stroke-width="2.5"/><path d="M19 12l2 4h6l2-4-3 2-2-3-2 3z" fill="#e0533c" stroke="${ink}" stroke-width="1.6"/><g fill="#f4a1b0"><circle cx="13" cy="22" r="2"/><circle cx="35" cy="22" r="2"/><circle cx="12" cy="30" r="2"/><circle cx="36" cy="30" r="2"/></g>${eyes}${smile}`; break;
    case 'kurye': b = `<ellipse cx="24" cy="28" rx="13" ry="12" fill="#fff" stroke="${ink}" stroke-width="2.5"/><path d="M10 22a14 12 0 0 1 28 0z" fill="${color}" stroke="${ink}" stroke-width="2.5"/><rect x="10" y="20" width="28" height="4" rx="2" fill="#3b2a20"/><path d="M21 32l3 4 3-4z" fill="#f2a43a" stroke="${ink}" stroke-width="1.4"/><circle cx="19" cy="28" r="2.4" fill="#3b2a20"/><circle cx="29" cy="28" r="2.4" fill="#3b2a20"/>`; break;
    case 'robot': b = `<path d="M9 24a15 9 0 0 1 30 0z" fill="#e8a24a" stroke="${ink}" stroke-width="2.5"/><rect x="8" y="24" width="32" height="5" fill="#6bb36b" stroke="${ink}" stroke-width="2"/><rect x="8" y="29" width="32" height="5" fill="#8a3324" stroke="${ink}" stroke-width="2"/><path d="M9 34h30a15 6 0 0 1-30 0z" fill="#e8a24a" stroke="${ink}" stroke-width="2.5"/><rect x="16" y="15" width="5" height="4" fill="#9fe8ff" stroke="${ink}" stroke-width="1.4"/><rect x="27" y="15" width="5" height="4" fill="#9fe8ff" stroke="${ink}" stroke-width="1.4"/><path d="M24 4v6" stroke="${ink}" stroke-width="2"/><circle cx="24" cy="4" r="2.4" fill="${color}" stroke="${ink}" stroke-width="1.4"/>`; break;
    default: b = `<circle cx="24" cy="24" r="16" fill="${color}" stroke="${ink}" stroke-width="2.5"/>${eyes}${smile}`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${b}</svg>`;
}

const CSS = `<style>
.yy-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:0 0 10px}
.yy-tabs button{min-height:52px;border:3px solid var(--ink);border-radius:14px;background:#fff6e6;font:900 14px/1.1 var(--disp);color:var(--ink);padding:4px 2px;position:relative}
.yy-tabs button.on{background:var(--red,#e0533c);color:#fff}
.yy-tabs i{position:absolute;top:-6px;right:-4px;background:#ffd23f;border:2px solid var(--ink);border-radius:9px;font:900 11px/1 var(--body);padding:2px 5px;font-style:normal;color:var(--ink)}
.yy-leaf{width:20px;height:20px;display:inline-block;vertical-align:-4px}
.yy-chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:6px}
.yy-chips button{flex:0 0 auto;min-height:44px;border:2.5px solid var(--ink);border-radius:22px;background:#fff;font:800 15px/1 var(--body);padding:0 12px;color:var(--ink)}
.yy-chips button.on{background:var(--tea,#c96f3b);color:#fff}.yy-chips button.new::after{content:' •';color:#e0533c}
.yy-chips button.off{opacity:.5}
.yy-card{display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:center;cursor:pointer}
.yy-card h3{font:900 18px/1.15 var(--disp);margin:0}.yy-card p{font:700 14px/1.3 var(--body);margin:0}
.yy-card.lock{opacity:.6;filter:grayscale(.7)}.yy-card.sel{outline:3px solid var(--tea,#c96f3b)}
.yy-pr{font:900 16px/1 var(--disp);text-align:right}.yy-pr small{display:block;font:700 12px/1.2 var(--body);opacity:.75}
.yy-tag{display:inline-block;border:2px solid var(--ink);border-radius:8px;padding:1px 6px;font:900 11px/1.3 var(--body);margin-left:4px;vertical-align:2px;background:#fff}
.yy-tag.d{background:#ffd23f}.yy-tag.n{background:#e0533c;color:#fff}.yy-tag.s{background:#bfe6e9}.yy-tag.g{background:#c9b3f0}
.yy-det{background:#fffaf0}.yy-det h3{font:900 21px/1.15 var(--disp);margin:0 0 6px}.yy-det p{font:700 15px/1.4 var(--body);margin:4px 0}
.yy-looks{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:8px 0}
.yy-looks div{border:2.5px solid var(--ink);border-radius:10px;padding:5px 4px;font:700 12px/1.25 var(--body);background:#fff;min-height:74px}
.yy-looks b{display:block;font:900 13px/1.1 var(--disp);margin-bottom:3px}.yy-looks .on{background:#ffe9a0}.yy-looks .done{background:#e6f4dc}
.yy-note{font:700 17px/1.35 'Segoe Print','Bradley Hand','Comic Sans MS',cursive;color:#2f4f9a;background:repeating-linear-gradient(#fffef6 0 26px,#cfe0f5 26px 27px);border:2px dashed #9fb6d6;border-radius:10px;padding:6px 10px;transform:rotate(-.6deg);margin-top:8px}
.yy-ings{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.yy-ings button{min-height:56px;border:3px solid var(--ink);border-radius:14px;background:#fff;font:800 15px/1.1 var(--body);display:flex;align-items:center;gap:6px;padding:4px 8px;color:var(--ink)}
.yy-ings button i{width:22px;height:22px;border-radius:50%;border:2px solid var(--ink);flex:0 0 auto}
.yy-ings button.on{background:#ffe9a0;transform:translateY(-2px);box-shadow:0 3px 0 var(--ink)}
.yy-res{font:800 17px/1.35 var(--body);text-align:center;padding:12px}.yy-res.ok{background:#e6f4dc}.yy-res.no{background:#fde8e4}
.yy-brands{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}
.yy-brand{border:3px solid var(--ink);border-radius:14px;padding:6px;display:flex;flex-direction:column;gap:4px;min-height:110px;cursor:pointer;position:relative}
.yy-brand h4{font:900 15px/1.1 var(--disp);margin:0}.yy-brand p{font:700 12px/1.25 var(--body);margin:0}
.yy-brand.signed{box-shadow:0 0 0 3px #ffd23f,0 4px 0 var(--ink)}.yy-brand .yy-ok{position:absolute;top:-8px;right:-6px;background:#49b96a;color:#fff;border:2px solid var(--ink);border-radius:10px;font:900 11px/1 var(--body);padding:3px 6px}
.yy-brand.off{opacity:.55}
.yy-masc{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}.yy-masc div{flex:0 0 120px;border:2.5px solid var(--ink);border-radius:12px;background:#fff;padding:6px;text-align:center;font:700 12px/1.25 var(--body)}
.yy-masc b{display:block;font:900 14px/1.1 var(--disp)}
.yy-row{display:flex;gap:10px;align-items:center}.yy-row h3{font:900 18px/1.1 var(--disp);margin:0}.yy-row p{font:700 14px/1.3 var(--body);margin:2px 0}
</style>`;

function tabs(m: any): string {
  const T: [string, string, string][] = [['kademe', 'Kademeler', '']];
  return `<div class="yy-tabs">${T.map(([id, n, badge]) => `<button class="${m.tab === id ? 'on' : ''}" data-a="yy" data-id="tab:${id}">${esc(n)}${badge ? `<i>${esc(badge)}</i>` : ''}</button>`).join('')}</div>`;
}

/** Extra cards under the Kademeler list: tarif count, Gezgin Aşçı, çay ustalığı and the freshness line. */
function kademeExtras(m: any): string {
  let s = `<div class="sb-card yy-row" data-a="yy" data-id="tab:defter">${I('menu')}<div class="sb-grow"><h3>Menüde ${m.openN} / ${m.total} tarif</h3><p>Müşteriler açık tariflerden adıyla ister: "Bir kokoreç lütfen!" Tarif farkı kasaya.</p></div></div>`;
  s += gezginCard(m.gezgin);
  const c = m.cay;
  if (c) s += `<div class="sb-card yy-row">${I('cay')}<div class="sb-grow"><h3>Çay ustalığı: ${esc(c.name)}</h3><p>${esc(c.line)}${c.pct ? ' Çay satışlarına +%' + c.pct + '.' : ''}</p><p>${fmt(c.sold)} çay satıldı${c.next ? ' · ' + esc(c.nextName) + ' için ' + fmt(c.next) : ''}</p></div></div>`;
  const f = m.fresh;
  if (f) s += `<div class="sb-card yy-row">${I('cat')}<div class="sb-grow"><h3>Tazelik çizgisi</h3><p>Tezgahta bekleyen yiyecek bir süre sonra bayatlar, ucuza gider. Daha da beklerse kediler alır. Çöp yok!</p><p>Şu an bayat: ${f.now} · Ucuza giden: ${fmt(f.bayat)} · Kedilere: ${fmt(f.kedi)}</p></div></div>`;
  return s;
}

function gezginCard(g: any): string {
  if (!g) return '';
  if (g.soon) return `<div class="sb-card yy-row sb-muted">${I('map')}<div class="sb-grow"><h3>Gezgin Aşçı</h3><p>${g.from}. günden itibaren her hafta bir bölgeden konuk tarif getirir.</p></div></div>`;
  const act = g.learned ? `<span class="sb-chip ok">${I('check')} Kalıcı menüde</span>`
    : yb(g.cost ? 'Tarifi öğren' : 'Bedava öğren', 'learn:' + g.id, 'green sm', g.cost ? tl(g.cost) : 'Gezgin Aşçı hediyesi');
  return `<div class="sb-card yy-row">${I('map')}<div class="sb-grow"><h3>Gezgin Aşçı: ${esc(g.region)}</h3><p><b>${esc(g.name)}</b> (${esc(g.station)}). ${esc(g.story)}</p><p>${g.learned ? '' : `Bu hafta satılan: ${g.sold} / ${g.need} (dolunca öğrenmek bedava) · `}${g.daysLeft} gün kaldı${g.stationBuilt ? '' : ' · İstasyonu kurulunca müşteriler ister'}</p></div>${act}</div>`;
}

function defter(m: any): string {
  let s = `<div class="yy-chips">${(m.stations || []).map((st: any) => `<button class="${m.st === st.id ? 'on' : ''}${st.isNew ? ' new' : ''}${st.built ? '' : ' off'}" data-a="yy" data-id="st:${st.id}">${esc(st.short)} ${st.open}/${st.total}</button>`).join('')}<button class="${m.st === 'gezgin' ? 'on' : ''}" data-a="yy" data-id="st:gezgin">Gezgin</button><button class="${m.st === 'ay' ? 'on' : ''}" data-a="yy" data-id="st:ay">Ay Mutfağı</button></div>`;
  if (m.st === 'gezgin') s += gezginCard(m.gezgin);
  if (m.st === 'ay') s += `<div class="sb-card sb-muted">Ay şubesi için Sabri'nin hayal defteri. Şimdilik sadece tarif kağıtları, yerçekimi izin verince menüye.</div>`;
  for (const c of m.list || []) {
    const tags = (c.veg ? LEAF : '') + (c.duble ? '<span class="yy-tag d">Duble</span>' : '') + (c.isNew ? '<span class="yy-tag n">Yeni</span>' : '') + (c.season ? `<span class="yy-tag s">${esc(c.months)}</span>` : '') + (c.how === 'gezgin' ? '<span class="yy-tag g">Gezgin</span>' : c.how === 'deney' ? '<span class="yy-tag g">Deney</span>' : '');
    if (!c.open && m.st !== 'ay') {
      s += `<div class="sb-card yy-card lock"><div><h3>${c.how === 'deney' ? '???' : esc(c.name)} ${tags}</h3><p>${I('lock').replace('<svg', '<svg style="width:16px;height:16px;display:inline-block;vertical-align:-3px"')} ${esc(c.lock)}</p></div><div class="yy-pr">+%${c.plus}</div></div>`;
      continue;
    }
    s += `<div class="sb-card yy-card${c.sel ? ' sel' : ''}" data-a="yy" data-id="sel:${esc(c.id)}"><div><h3>${esc(c.name)} ${tags}</h3><p>${c.season ? 'Mevsimi değil, ' + esc(c.months) + ' arası menüde. ' : ''}${c.sold ? fmt(c.sold) + ' satıldı · ' : ''}Dokun, defteri aç</p></div><div class="yy-pr">${m.st === 'ay' ? '?' : tl(c.price)}<small>${c.plus ? '+%' + c.plus + ' tarif farkı' : 'temel fiyat'}</small></div></div>`;
    if (c.sel && m.sel) s += detail(m.sel);
  }
  return s;
}

function detail(d: any): string {
  return `<div class="sb-card yy-det"><h3>${esc(d.name)} ${d.veg ? LEAF + ' <span class="yy-tag">Etsiz</span>' : ''}${d.duble ? '<span class="yy-tag d">Duble istenebilir</span>' : ''}</h3>
  <p>${esc(d.story)}</p>
  <div class="yy-looks">${(d.looks || []).map((l: any) => `<div class="${l.on ? 'on' : l.done ? 'done' : ''}"><b>${esc(l.name)}</b>${esc(l.text)}</div>`).join('')}</div>
  <p><b>Kim sever:</b> ${d.likes && d.likes.length ? esc(d.likes.join(', ')) : 'Henüz kimse tatmadı, Ay\'da belli olur.'}</p>
  <p><b>İstasyon:</b> ${esc(d.station)}${d.brand ? ' · <b>Tedarik:</b> ' + esc(d.brand) : ''}${d.region ? ' · <b>Bölge:</b> ' + esc(d.region) : ''}${d.months ? ' · <b>Mevsim:</b> ' + esc(d.months) : ''}</p>
  <div class="yy-note">Sabri'nin notu: ${esc(d.note)}</div></div>`;
}

function deney(m: any): string {
  const d = m.deney || {};
  let s = `<div class="sb-card sb-muted" style="font:700 15px/1.35 var(--body)">İki ya da üç malzeme seç, karıştır. Tutarsa yeni tarif, tutmazsa komik bir sonuç. ${d.free ? `Bugün ${d.free} deney bedava.` : `Bugünkü bedava deneyler bitti, her deney ${tl(d.cost)}.`}</div>`;
  if (d.last) s += `<div class="sb-card yy-res ${d.last.ok ? 'ok' : 'no'}">${d.last.ok ? I('sparkle') : I('warn')} ${esc(d.last.text)}</div>`;
  s += `<div class="yy-ings">${(d.ings || []).map((g: any) => `<button class="${g.on ? 'on' : ''}" data-a="yy" data-id="ing:${esc(g.id)}"><i style="background:${esc(g.color)}"></i>${esc(g.name)}</button>`).join('')}</div>`;
  s += `<div class="sb-mrow" style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-top:10px">${yb('Karıştır!', 'mix:', 'green', d.picks + ' / 3 malzeme', (d.picks || 0) < 2, 'En az iki malzeme seç.')}${yb('Temizle', 'clear:', 'cream')}</div>`;
  s += `<div class="sb-sec">${I('sparkle')}Keşfedilen tarifler<span>${(d.found || []).length} / ${d.total || 0}</span></div>`;
  s += (d.found || []).length ? `<div class="sb-card">${d.found.map((f: any) => `<span class="sb-chip ok" style="margin:2px">${esc(f.name)}</span>`).join('')}</div>` : `<div class="sb-card sb-muted">Henüz keşif yok. Sabri\'nin önlüğü temiz, demek ki deney yapılmamış.</div>`;
  if ((d.hints || []).length) s += `<div class="yy-note">İpuçları: ${d.hints.map((h: string) => esc(h)).join(' / ')}</div>`;
  return s;
}

function anlasma(m: any): string {
  const d = m.deal || {};
  let s = `<div class="sb-card sb-muted" style="font:700 15px/1.35 var(--body)">Her kategoride bir marka seç. Seçtiğin markanın adı büfenin tabelasına çıkar, o kategorinin satışlarına küçük bonus gelir. Ünlü markaları müşteriler adıyla ister, anlaşman varsa bahşiş bırakır. Bir kategori günde bir kere değişir.</div>`;
  if (!d.open) return s + `<div class="sb-card sb-muted">${I('lock')} Anlaşma Masası Seviye ${d.level}'te açılır.</div>` + mascots(d);
  for (const k of d.kats || []) {
    s += `<div class="sb-sec">${I('shop')}${esc(k.name)}<span>${k.curName ? esc(k.curName) : 'Anlaşma yok'}</span></div><div class="sb-muted" style="font:700 13px/1.3 var(--body)">Bonus: ${esc(k.what)}${k.lockedToday ? ' · Bugün değiştirildi' : ''}</div><div class="yy-brands">`;
    for (const b of k.brands) {
      const off = !b.signed && k.lockedToday;
      s += `<div class="yy-brand${b.signed ? ' signed' : ''}${off ? ' off' : ''}" style="background:${esc(b.color)};color:${esc(b.ink)}" data-a="yy" data-id="deal:${esc(b.id)}"${off ? ' data-why="Bu kategoriyi bugün değiştirdin. Yarın tekrar."' : ''}>${b.signed ? '<span class="yy-ok">Anlaşmalı</span>' : ''}<div style="display:flex;gap:6px;align-items:center">${b.maskot ? maskotSvg((d.maskots || []).find((x: any) => x.id === b.maskot)?.kind || '', (d.maskots || []).find((x: any) => x.id === b.maskot)?.color || b.color, 34) : ''}<h4>${esc(b.name)}</h4></div><p>"${esc(b.slogan)}"</p><p><b>+%${b.pct}</b>${b.famous ? ' · Ünlü: müşteri adıyla ister' : ''}</p></div>`;
    }
    s += '</div>';
  }
  return s + mascots(d);
}
function mascots(d: any): string {
  const ms = d.maskots || [];
  if (!ms.length) return '';
  return `<div class="sb-sec">${I('smile')}Marka maskotları<span>${d.brandN || ''} marka</span></div><div class="yy-masc">${ms.map((x: any) => `<div>${maskotSvg(x.kind, x.color, 52)}<b>${esc(x.name)}</b>${esc(x.brand)}<br>${esc(x.desc)}</div>`).join('')}</div>`;
}

/**
 * Renders the tab strip and, for tabs other than 'kademe', the whole tab body. For 'kademe' returns
 * { head, tail } so renderMenu keeps its own product list in between.
 */
export function renderYiyecek(m: any): { head: string; tail: string; full: string | null } {
  if (!m) return { head: '', tail: '', full: null };
  // Faz 2 (user items 11/12/14/17): the menu shows only the tier list. Tarif Defteri, Deney, Anlaşma and the big
  // extra cards (tarif count, Gezgin Aşçı, çay ustalığı, tazelik) are gone; the code stays for a later redesign.
  void tabs; void defter; void deney; void anlasma; void kademeExtras;
  return { head: CSS, tail: '', full: null };
}
