// Dekor 2.0 panel (survey dekor-1..14, ev-1..9): the "Dekor" sheet with tabs Katalog / Yerleşim / Setler / Tabela / Ev.
// Pure HTML string renderer in the v2ui style; v2ui.renderDekor hands over to it when the model carries `x2`
// (sim/dekor-ev.ts model()). Buttons: data-a="d2" data-id="op|a|b|c" -> panelActions('dekor').d2 -> { kind: 'dekor2' };
// the old buy/place/remove/sign actions keep working. Big text, one tap per action, code-made SVG swatches (no images).
import { ICONS } from '../../engine/ui/v2-style';
import { extraById, homeItemById, BASE_CAT } from '../../content/dekor-katalog';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const I = (k: string) => ICONS[k] || '';
const fmt = (n: number) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const tl = (n: number) => fmt(n) + ' ₺';
const btn = (label: string, act: string, id: string | number | null, cls: string, sub?: string, off?: boolean, why?: string, extra = '') =>
  `<button class="sb-btn ${cls}${off ? ' off' : ''}" data-a="${act}"${id != null ? ` data-id="${esc(id)}"` : ''}${why ? ` data-why="${esc(why)}"` : ''}${extra}><span class="sb-bl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
const d2 = (label: string, arg: string, cls = 'sm', sub?: string, off?: boolean, why?: string) => btn(label, 'd2', arg, cls, sub, off, why);
const chip = (label: string, arg: string, on: boolean, sw?: string) => `<button class="dk-chip${on ? ' on' : ''}" data-a="d2" data-id="${esc(arg)}">${sw ? `<i style="background:${esc(sw)}"></i>` : ''}${esc(label)}</button>`;
const meter = (p: number, c = 'var(--tile)') => `<div class="sb-meter"><i style="width:${(Math.max(0, Math.min(1, p)) * 100).toFixed(1)}%;background:${c}"></i></div>`;

const CAT_GLYPH: Record<string, string> = {
  isik: '<path d="M24 9a9 9 0 0 1 5 16v4h-10v-4a9 9 0 0 1 5-16z" fill="#ffe27a" stroke="#33373b" stroke-width="2.4"/><rect x="19" y="31" width="10" height="5" rx="1.5" fill="#9aa3aa" stroke="#33373b" stroke-width="2"/>',
  zemin: '<path d="M8 30l16-8 16 8-16 8z" fill="COL1" stroke="#33373b" stroke-width="2.4"/><path d="M16 30l8-4 8 4-8 4z" fill="COL2"/>',
  duvar: '<rect x="12" y="11" width="24" height="22" rx="2" fill="COL1" stroke="#33373b" stroke-width="2.4"/><rect x="16" y="15" width="16" height="14" fill="COL2"/>',
  biblo: '<rect x="15" y="31" width="18" height="6" rx="2" fill="#e2dbd0" stroke="#33373b" stroke-width="2"/><circle cx="24" cy="22" r="8" fill="COL1" stroke="#33373b" stroke-width="2.4"/>',
  su: '<path d="M24 9c6 9 10 14 10 19a10 10 0 0 1-20 0c0-5 4-10 10-19z" fill="#8fd0f2" stroke="#33373b" stroke-width="2.4"/><circle cx="21" cy="28" r="3" fill="COL2"/>',
  masa: '<rect x="10" y="18" width="28" height="5" rx="2" fill="COL1" stroke="#33373b" stroke-width="2.4"/><path d="M14 23v12M34 23v12" stroke="#33373b" stroke-width="3"/>',
  bitki: '<path d="M17 28h14l-2 9H19z" fill="#c98a52" stroke="#33373b" stroke-width="2.2"/><path d="M24 28c-8-3-9-11-6-15 5 2 6 8 6 15 0-7 1-13 6-15 3 4 2 12-6 15z" fill="#5d8f45" stroke="#33373b" stroke-width="2"/>',
  tema: '<path d="M24 8l4.5 9.5 10.5 1.3-7.7 7.2 2 10.4L24 31.3l-9.3 5.1 2-10.4L9 18.8l10.5-1.3z" fill="COL1" stroke="#33373b" stroke-width="2.4"/>',
};
/** Small code-made swatch: the item's three colours in a ring + a category glyph. */
function swatch(id: string, cat: string): string {
  const x = extraById(id), h = homeItemById(id);
  const cols = x ? x.cols : h ? h.cols : ['#f2b632', '#3fb5b0', '#e0533c'];
  const g = (CAT_GLYPH[cat] || CAT_GLYPH.tema).replace(/COL1/g, cols[0]).replace(/COL2/g, cols[1]);
  return `<svg viewBox="0 0 48 48" width="52" height="52" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="${cols[2]}" opacity=".35"/><path d="M24 2a22 22 0 0 1 19 11" stroke="${cols[0]}" stroke-width="4" fill="none"/><path d="M5 13A22 22 0 0 1 24 2" stroke="${cols[1]}" stroke-width="4" fill="none"/>${g}</svg>`;
}

const CSS = `<style>
.dk-tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:4px 0 10px}
.dk-tab{display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 2px;border:2.5px solid var(--ink);border-radius:14px;background:var(--cream);font:900 14px/1.1 var(--disp);color:var(--ink);cursor:pointer;pointer-events:auto}
.dk-tab svg{width:26px;height:26px}.dk-tab.on{background:var(--yellow);transform:translateY(-2px)}
.dk-chips{display:flex;gap:6px;overflow-x:auto;padding:2px 2px 8px;scrollbar-width:none;flex-wrap:nowrap}
.dk-wrap{flex-wrap:wrap;overflow:visible}
.dk-chip{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:42px;padding:6px 12px;border:2.5px solid var(--ink);border-radius:22px;background:#fff;font:900 15px/1.1 var(--disp);color:var(--ink);cursor:pointer;pointer-events:auto}
.dk-chip.on{background:var(--yellow)}.dk-chip i{width:18px;height:18px;border-radius:50%;border:2px solid var(--ink);display:inline-block}
.dk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.dk-item{display:flex;flex-direction:column;gap:6px}
.dk-item .t{display:flex;gap:8px;align-items:center}.dk-item h3{font:900 16px/1.15 var(--disp);margin:0}
.dk-tags{display:flex;flex-wrap:wrap;gap:4px}.dk-tag{font:800 12px/1 var(--body);padding:3px 7px;border-radius:10px;background:#efe6d4;border:1.5px solid var(--ink)}
.dk-tag.g{background:#fbe7b0}.dk-tag.p{background:#d9eefc}.dk-tag.l{background:#fff3b8}.dk-tag.h{background:#fde0ea}
.dk-slots{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px}
.dk-slot{min-height:76px;border:2.5px dashed var(--ink);border-radius:14px;background:rgba(255,255,255,.5);display:flex;flex-direction:column;align-items:center;justify-content:center;font:900 13px/1.1 var(--disp);color:var(--ink);cursor:pointer;pointer-events:auto;padding:4px;text-align:center}
.dk-slot.full{border-style:solid;background:#fff}.dk-slot.on{background:var(--yellow);transform:translateY(-2px)}.dk-slot svg{width:40px;height:40px}
.dk-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.dk-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px}
.dk-p{font:700 16px/1.35 var(--body);margin:6px 0}.dk-h{font:900 18px/1.15 var(--disp);margin:2px 0 6px}
.dk-sign{border:3px solid var(--ink);border-radius:12px;padding:10px;text-align:center;font:900 20px/1.2 var(--disp)}
.dk-sign small{display:block;font:800 15px/1.2 var(--body);margin-top:4px}
.dk-big{min-height:72px;font-size:20px}
.dk-set{display:flex;gap:10px;align-items:center}.dk-set .n{font:900 22px/1 var(--disp);min-width:56px;text-align:center}
.dk-set.done{background:#e3f6dc}
</style>`;

// Faz 2 (dekor-27): simplified to Katalog + Tabela; Yerleşim / Setler / Ev (Sabri's house removed) are hidden
const TABS: [string, string, string][] = [['katalog', 'Katalog', 'dekor'], ['tabela', 'Tabela', 'sign']];

type M = Record<string, any>;
export function renderDekor2(m: M): string {
  const x = m.x2 as M;
  const tab = String(x.tab || 'katalog');
  const st = Math.round(Number(m.style) || 0);
  let s = CSS + `<div class="sb-card sb-style"><div class="sv">${st}<small>/ 100</small></div><div class="sb-grow"><b style="font:900 16px/1.1 var(--disp)">Şıklık</b><div class="sb-muted">${x.setTip ? 'Set bonusu: +%' + x.setTip + ' bahşiş' : 'Bir temadan 4 eşya koy, set tamamlansın.'}</div>${meter(st / 100)}</div></div>`;
  s += '<div class="dk-tabs">' + TABS.map(([id, name, ic]) => `<button class="dk-tab${tab === id ? ' on' : ''}" data-a="d2" data-id="tab|${id}">${I(ic)}${name}</button>`).join('') + '</div>';
  try {
    void yerlesim; void setler; void evTab;
    if (tab === 'tabela') s += tabela(m, x);
    else s += katalog(m, x);
  } catch (e) { console.error('[SB.ui] dekor2', e); s += `<div class="sb-empty">${I('warn')}<span>Bu sekme şu an açılamadı.</span></div>`; }
  return s;
}

/** Faz 2 (dekor-shape): shape/colour card for the selected placed item. The first pick after buying is free; later changes cost a fee. */
function boyaCard(x: M): string {
  const si = x.selItem as M | null;
  if (!si) return `<div class="sb-card dk-p">Yerleştirdiğin bir eşyaya dokun: malzeme, renk ve desen seç. İlk seçim bedava, sonraki değişiklikler ücretli.</div>`;
  const p = si.paint || {};
  const feeTxt = si.paid && si.fee ? `<span class="sb-muted">Değişiklik ${tl(si.fee)}</span>` : '<span class="sb-muted">İlk seçim bedava</span>';
  let s = `<div class="sb-card"><div class="dk-h">${esc(si.name)} ${feeTxt}</div><div class="dk-row3">${d2('Boyayı sil', 'paint|' + si.slot + '|reset', 'cream sm')}</div>`;
  s += `<div class="dk-p"><b>Şekil</b></div><div class="dk-chips dk-wrap">${((x.shapes || []) as M[]).map(o => chip(o.name, 'paint|' + si.slot + '|shape|' + o.id, (p.shape || 'orijinal') === o.id)).join('')}</div>`;
  s += `<div class="dk-p"><b>Malzeme</b></div><div class="dk-chips dk-wrap">${((x.materials || []) as M[]).map(o => chip(o.name, 'paint|' + si.slot + '|material|' + o.id, p.material === o.id, o.tint)).join('')}</div>`;
  s += `<div class="dk-p"><b>Renk</b></div><div class="dk-chips dk-wrap">${((x.colors || []) as M[]).map(o => chip(o.name, 'paint|' + si.slot + '|color|' + o.id, p.color === o.id, o.hex || '#fff')).join('')}</div>`;
  s += `<div class="dk-p"><b>Desen</b></div><div class="dk-chips dk-wrap">${((x.patterns || []) as M[]).map(o => chip(o.name, 'paint|' + si.slot + '|pattern|' + o.id, p.pattern === o.id)).join('')}</div></div>`;
  return s;
}

function katalog(m: M, x: M): string {
  const items: M[] = m.items || [], slots: M[] = m.slots || [];
  const free = slots.filter(sl => !sl.itemId).length;
  const cat = String(x.cat || 'hepsi'), catOf = (x.catOf || {}) as Record<string, string>, ex = (x.extra || {}) as Record<string, M>;
  // Faz 2 (dekor-27): one plain shelf, cheapest first; only items bought with money (no Altın Simit / atölye / hediye).
  // Buying places the item at once and the camera shows where it went (sim/decor.ts).
  void cat; void chip;
  const head = boyaCard(x);
  const list = items.filter(it => { const e = ex[it.id] || {}; return !e.gold && !e.workshop && !e.gift; }).sort((a, b) => (a.price || 0) - (b.price || 0)).slice(0, 24);
  const ownedN = list.filter(it => it.owned).length;
  let s = `<div class="sb-sec">${I('sparkle')}Dekor rafı<span>${ownedN} / ${list.length} sende · boş yer: ${free}</span></div><div class="dk-grid">`;
  for (const it of list) {
    const e = ex[it.id] || {}, c = catOf[it.id] || BASE_CAT[it.id] || 'tema';
    const owned = Number(it.owned) || 0, placed = Number(it.placed) || 0;
    const tags: string[] = [];
    if (e.light) tags.push('<span class="dk-tag l">Işıklı</span>');
    if (e.photo) tags.push('<span class="dk-tag p">Fotoğraf köşesi</span>');
    if (e.gold) tags.push(`<span class="dk-tag g">Altın vitrin</span>`);
    if (e.workshop) tags.push('<span class="dk-tag">Usta Atölyesi</span>');
    if (e.gift) tags.push('<span class="dk-tag h">Müdavim hediyesi</span>');
    let b: string;
    if (owned > placed) b = btn('Yerleştir', 'place', it.id, 'sm', undefined, free <= 0, 'Boş dekor yeri yok. Önce birini kaldır.');
    else if (e.gold) b = d2('Vitrinden al', 'buyGold|' + it.id, 'green sm', e.gold + ' Altın Simit', x.gold < e.gold, 'Altın Simit yetmiyor.');
    else if (e.workshop) b = d2('Atölyede yap', 'craft|' + it.id, 'green sm', e.workshop + ' parça', x.parca < e.workshop, 'Parça yetmiyor. Fotoğraf köşeleri parça getirir.');
    else if (e.gift) b = owned ? `<span class="sb-chip ok" style="justify-content:center;min-height:44px">Yerleşti</span>` : `<span class="sb-chip" style="justify-content:center;min-height:44px">Seti tamamla, müdavim getirsin</span>`;
    else b = btn(owned ? 'Bir tane daha' : 'Al', 'buy', it.id, owned ? 'cream sm' : 'green sm', tl(it.price), Number(m.money) < it.price, 'Biraz daha para lazım.');
    s += `<div class="sb-card dk-item${owned ? ' owned' : ''}"><div class="t">${swatch(it.id, c)}<div class="sb-grow"><h3>${esc(it.name)}</h3><div class="sb-muted">${esc(it.set || '')}</div></div></div><div class="sb-muted" style="font-weight:800">${esc(it.bonus || '')}${owned ? ' · sende ' + owned : ''}</div>${tags.length ? `<div class="dk-tags">${tags.join('')}</div>` : ''}${b}</div>`;
  }
  s += '</div>';
  if (!list.length) s += `<div class="sb-empty">${I('dekor')}<span>Bu rafta şimdilik bir şey yok.</span></div>`;
  return head + s;
}

function yerlesim(m: M, x: M): string {
  const slots: M[] = x.slots || [];
  const sel = Number(x.sel);
  let s = `<div class="sb-sec">${I('dekor')}Dekor yerleri<span>${slots.filter(v => v.item).length} / ${slots.length} dolu</span></div><div class="dk-slots">`;
  for (const sl of slots) {
    const c = sl.item ? ((x.catOf || {})[sl.item] || BASE_CAT[sl.item] || 'tema') : '';
    s += `<button class="dk-slot${sl.item ? ' full' : ''}${sel === sl.index ? ' on' : ''}" data-a="d2" data-id="sel|${sl.index}">${sl.item ? swatch(sl.item, c) + esc(String(sl.name).slice(0, 18)) : '<b style="font-size:20px">' + (sl.index + 1) + '</b>boş'}${sl.item && sl.rot ? `<small>${sl.rot}°</small>` : ''}</button>`;
  }
  s += '</div>';
  const si = x.selItem as M | null;
  if (si) {
    const p = si.paint || {};
    s += `<div class="sb-card"><div class="dk-h">${esc(si.name)}</div><div class="dk-row3">${d2('Döndür 45°', 'rot|' + si.slot, 'blue sm')}${btn('Kaldır', 'remove', null, 'cream sm', undefined, false, undefined, ` data-slot="${si.slot}"`)}${d2('Boyayı sil', 'paint|' + si.slot + '|reset', 'cream sm')}</div>`;
    s += `<div class="dk-p"><b>Malzeme</b></div><div class="dk-chips dk-wrap">${(x.materials as M[]).map(o => chip(o.name, 'paint|' + si.slot + '|material|' + o.id, p.material === o.id, o.tint)).join('')}</div>`;
    s += `<div class="dk-p"><b>Renk</b></div><div class="dk-chips dk-wrap">${(x.colors as M[]).map(o => chip(o.name, 'paint|' + si.slot + '|color|' + o.id, p.color === o.id, o.hex || '#fff')).join('')}</div>`;
    s += `<div class="dk-p"><b>Desen</b></div><div class="dk-chips dk-wrap">${(x.patterns as M[]).map(o => chip(o.name, 'paint|' + si.slot + '|pattern|' + o.id, p.pattern === o.id)).join('')}</div></div>`;
  } else s += `<div class="sb-card dk-p">Bir yere dokun: döndür, boya, kaldır. Taşımak, döndürmek ve kaldırmak bedava!</div>`;
  s += `<div class="dk-row">${d2('Geri al', 'undo', 'cream', x.undo + ' adım', !x.undo, 'Geri alınacak bir şey yok.')}${d2('İleri al', 'redo', 'cream', x.redo + ' adım', !x.redo, 'İleri alınacak bir şey yok.')}</div>`;
  s += `<div class="sb-sec">${I('note')}Düzen yuvaları<span>3 yuva</span></div>`;
  (x.layouts as number[]).forEach((n, i) => {
    s += `<div class="sb-card" style="display:flex;gap:8px;align-items:center"><b class="sb-grow" style="font:900 17px/1.1 var(--disp)">Düzen ${i + 1}<br><small class="sb-muted">${n < 0 ? 'boş' : n + ' eşya'}</small></b>${d2('Kaydet', 'saveLayout|' + i, 'sm')}${d2('Yükle', 'loadLayout|' + i, 'green sm', undefined, n < 0, 'Bu yuva boş.')}</div>`;
  });
  const bf = x.before;
  s += `<div class="sb-card"><div class="dk-h">${I('camera')} Önce / Sonra</div><div class="dk-p">${bf == null ? 'Düzenlemeden önce bir fotoğraf çek, sonra farkı gör.' : `Önce: Şıklık <b>${bf}</b> · Şimdi: <b>${x.now}</b> ${x.now > bf ? '(+' + (x.now - bf) + ', helal!)' : x.now < bf ? '(biraz düştü)' : '(aynı)'}`}</div>${d2(bf == null ? 'Önce fotoğrafı çek' : 'Yeniden çek', 'before', 'blue sm')}</div>`;
  const se = x.season as M;
  s += `<div class="sb-card" style="display:flex;gap:10px;align-items:center"><div class="sb-grow"><div class="dk-h">Mevsim süsleri</div><div class="sb-muted">${esc(se.name)}. Takvime göre kendiliğinden asılır.</div></div><button class="sb-tog${se.on ? ' on' : ''}" data-a="d2" data-id="season" aria-pressed="${!!se.on}" aria-label="Mevsim süsleri"></button></div>`;
  return s;
}

function setler(x: M): string {
  let s = `<div class="sb-card dk-p">Bir temadan <b>4 eşya</b> yerleştir: set tamamlanır, küçük bahşiş bonusu gelir ve o seti seven müdavim uğramaya başlar. Üç gelişte bir hediye getirir!</div>`;
  for (const t of x.sets as M[]) {
    s += `<div class="sb-card dk-set${t.done ? ' done' : ''}"><div class="n">${Math.min(t.have, t.need)}/${t.need}</div><div class="sb-grow"><div class="dk-h">${esc(t.name)} ${t.done ? I('check') : ''}</div>${meter(t.have / t.need, t.done ? 'var(--money)' : 'var(--tea)')}<div class="sb-muted" style="margin-top:4px">${esc(t.bonus)} · Set sever: <b>${esc(t.lover)}</b> (${esc(t.job)})${t.visits ? ' · ' + t.visits + ' kez geldi' : ''}${t.gift ? ' · Hediyesi: ' + esc(t.gift) : ''}</div></div></div>`;
  }
  return s;
}

function tabela(m: M, x: M): string {
  const sg = x.sign as M;
  const tc = (x.textColors as M[]).find(c => c.id === sg.text)?.hex || '#fffaf0', bg = (x.bgColors as M[]).find(c => c.id === sg.bg)?.hex || '#16325c';
  const em = (x.emblems as M[]).find(e => e.id === sg.emblem), fr = (x.frames as M[]).find(f => f.id === sg.frame);
  const frameCss = sg.frame === 'neon' ? 'box-shadow:0 0 12px #ff5fa2,inset 0 0 8px #49e6d8' : sg.frame === 'ampul' ? 'border-style:dotted;border-width:5px' : sg.frame === 'cini' ? 'border-color:#3fb5b0;border-width:5px' : sg.frame === 'ahsap' ? 'border-color:#8a5d3b;border-width:6px' : '';
  let s = `<div class="dk-sign" style="background:${bg};color:${tc};${frameCss}">${em && em.id !== 'yok' ? '[' + esc(em.name) + '] ' : ''}${esc(m.sign || 'Sabri\'nin Büfesi')}${sg.sloganText ? `<small>${esc(sg.sloganText)}</small>` : ''}</div>`;
  s += `<div class="dk-row">${btn('Ad ve yazı tipi', 'sign', null, 'cream sm')}<span class="sb-muted" style="align-self:center">Çerçeve: ${esc(fr?.name || 'Sade')}</span></div>`;
  s += `<div class="dk-p"><b>Alt satır sloganı</b></div><div class="dk-chips dk-wrap">${(x.slogans as string[]).map((t, i) => chip(t || 'Slogansız', 'sign|slogan|' + i, sg.slogan === i)).join('')}</div>`;
  s += `<div class="dk-p"><b>Amblem</b></div><div class="dk-chips dk-wrap">${(x.emblems as M[]).map(o => chip(o.name, 'sign|emblem|' + o.id, sg.emblem === o.id)).join('')}</div>`;
  s += `<div class="dk-p"><b>Çerçeve</b></div><div class="dk-chips dk-wrap">${(x.frames as M[]).map(o => chip(o.name, 'sign|frame|' + o.id, sg.frame === o.id)).join('')}</div>`;
  s += `<div class="dk-p"><b>Yazı rengi</b></div><div class="dk-chips dk-wrap">${(x.textColors as M[]).map(o => chip(o.id === 'kendi' ? 'Kendi' : o.id, 'sign|text|' + o.id, sg.text === o.id, o.hex || '#fff')).join('')}</div>`;
  s += `<div class="dk-p"><b>Zemin rengi</b></div><div class="dk-chips dk-wrap">${(x.bgColors as M[]).map(o => chip(o.id === 'kendi' ? 'Kendi' : o.id, 'sign|bg|' + o.id, sg.bg === o.id, o.hex || '#fff')).join('')}</div>`;
  return s;
}

function evTab(m: M, x: M): string {
  const e = x.ev as M;
  const open = (e.areas as M[]).filter(a => a.open).length;
  let s = `<div class="sb-card"><div class="dk-h">${I('heart')} Sabri'nin Evi</div><div class="dk-p">Büfenin tepesindeki çatı katı. Merdivenden çık, eşyaları yerleştir. Dinlenen Sabri sabah biraz daha hızlı çalışır.</div>`;
  s += `<div class="dk-p">Dinlenme puanı <b>${e.rest}</b> · sabah hızı <b>+%${e.boost}</b> <span class="sb-muted">(en fazla %${e.cap})</span></div>${meter(e.boost / Math.max(1, e.cap), 'var(--pink)')}`;
  s += `<div style="margin-top:10px">${d2('Yukarı çık', 'evOpen', 'green wide dk-big', open + ' / 5 alan açık')}</div></div>`;
  s += `<div class="sb-sec">${I('hammer')}Alanlar<span>${open} / 5</span></div>`;
  for (const a of e.areas as M[]) {
    s += `<div class="sb-card" style="display:flex;gap:10px;align-items:center"><div class="sb-grow"><div class="dk-h">${esc(a.name)}</div><div class="sb-muted">${esc(a.desc)}${a.open ? ' · ' + a.items.length + ' / ' + a.slots + ' eşya' : ''}</div></div>${a.open ? `<span class="sb-chip ok">Açık</span>` : d2('Aç', 'evBuyArea|' + a.id, 'green sm', tl(a.price), Number(m.money) < a.price, 'Biraz daha para lazım.')}</div>`;
  }
  return s;
}
