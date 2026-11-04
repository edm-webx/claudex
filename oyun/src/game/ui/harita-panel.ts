// Martıköy Haritası sheet ('harita' panel) and its small card in the Görevler panel (survey disari-1..9, mekan-1..9).
// Pure HTML string renderers in the v2ui style; data-a names map to panelActions('harita') / ('gorevler').
// Decisions: the map is a folding paper SVG (fold creases are gradients, it unfolds on first open only, since the
// sheet re-renders twice a second); every pin and row is one tap: "Git" travels (dolmuş/vapur/own vehicle) to the
// region's stop and hands the last metres to Fındık the guide cat. Text 15px+.
import { ICONS } from '../../engine/ui/v2-style';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const I = (k: string) => ICONS[k] || '';
const fmt = (n: number) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const tl = (n: number) => fmt(n) + ' ₺';
const btn = (label: string, act: string, id: string | null, cls: string, sub?: string, off?: boolean, why?: string) =>
  `<button class="sb-btn ${cls}${off ? ' off' : ''}" data-a="${act}"${id != null ? ` data-id="${esc(id)}"` : ''}${why ? ` data-why="${esc(why)}"` : ''}><span class="sb-bl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;

const CSS = `<style>
.mk-paper{position:relative;border:3px solid var(--ink);border-radius:14px;overflow:hidden;background:#f7ecd2;box-shadow:0 4px 0 var(--ink);margin-bottom:10px;transform-origin:50% 0}
.mk-paper.unfold{animation:mk-unfold .7s cubic-bezier(.3,1.3,.5,1)}
@keyframes mk-unfold{0%{transform:perspective(600px) rotateX(-80deg) scaleY(.3);opacity:.2}60%{transform:perspective(600px) rotateX(8deg) scaleY(1.02);opacity:1}100%{transform:none}}
.mk-paper:after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,transparent 32.8%,rgba(90,60,20,.16) 33.3%,transparent 33.8%,transparent 66.2%,rgba(90,60,20,.16) 66.7%,transparent 67.2%),linear-gradient(0deg,transparent 49.5%,rgba(90,60,20,.12) 50%,transparent 50.5%)}
.mk-paper svg{display:block;width:100%;height:auto}
.mk-paper .t{font:900 15px var(--disp,system-ui);fill:#3b2a20}.mk-paper .s{font:800 11px var(--body,system-ui);fill:#3b2a20}
.mk-pin{cursor:pointer}.mk-pin circle{stroke:#3b2a20;stroke-width:2}
.mk-title{position:absolute;left:10px;top:6px;font:900 16px/1 var(--disp);color:#7a4a12;letter-spacing:.04em;pointer-events:none}
.mk-row{display:grid;grid-template-columns:44px 1fr auto;gap:8px;align-items:center;margin:6px 0}
.mk-row .ic{width:44px;height:44px;border-radius:12px;border:2.5px solid var(--ink);display:flex;align-items:center;justify-content:center;font-size:24px;background:#fff6e6}
.mk-row h3{font:900 17px/1.1 var(--disp);margin:0}.mk-row p{font:700 15px/1.3 var(--body);margin:2px 0 0}.mk-row p small{display:block;font:700 13px/1.25 var(--body);opacity:.75}
.mk-row .sb-btn{min-height:50px}
.mk-st{display:inline-block;border:2px solid var(--ink);border-radius:999px;padding:1px 8px;font:800 12px/1.4 var(--body);margin-left:4px;vertical-align:2px}
.mk-st.on{background:#bfe3a8}.mk-st.off{background:#e9e4da}.mk-st.lock{background:#f3b0a8}
.mk-tools{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:4px 0 10px}
.mk-tags{display:flex;gap:6px;flex-wrap:wrap}.mk-tags span{border:2px solid var(--ink);border-radius:999px;padding:4px 10px;font:800 14px/1.2 var(--body);background:#fff}
.mk-sec{display:flex;gap:10px;align-items:center}.mk-sec .ic{width:52px;height:52px;border-radius:50%;border:3px solid var(--ink);background:#f7ecd2;font-size:30px;display:flex;align-items:center;justify-content:center}
.mk-sec h3{font:900 18px/1.1 var(--disp);margin:0}.mk-sec p{font:700 15px/1.3 var(--body);margin:2px 0}
</style>`;

let lastRender = 0;
// 2026-10-24 user: "haritaya tıklanıyor ama hiçbir şey açılmıyor". A tapped district opens its card (what is there,
// how you get there, a big Git button) on top of the map; the selection is UI state only.
let sel = '';
if (typeof document !== 'undefined') document.addEventListener('click', e => {
  const g = (e.target as Element | null)?.closest?.('.mk-pin') as HTMLElement | null;
  if (g?.dataset.sel) { sel = g.dataset.sel === sel ? '' : g.dataset.sel; e.stopPropagation(); window.dispatchEvent(new CustomEvent('ui:rerender', { detail: 'harita' })); }
  else if ((e.target as Element | null)?.closest?.('[data-mksel-x]')) { sel = ''; window.dispatchEvent(new CustomEvent('ui:rerender', { detail: 'harita' })); }
}, true);

// 2026-10-24 açık dünya anketi (harita ESO / WoW gibi): an illustrated map of the imaginary İstanbul. Every district
// sits where its `map` coordinates say (0..100), roads join neighbours in walking order, dotted vapur lines join the
// piers, Adalar floats in the Marmara. Tap a district to travel there.
const ICON: Record<string, string> = { iskele: '⚓', carsi: '🧺', sahil: '🎡', yokus: '🪜', meydan: '⛲', barinak: '🐟', gece: '🏮', stadyum: '⚽', tersane: '🏗', metro: 'Ⓜ', tepe: '🌲', adalar: '🏝' };
const MW = 640, MH = 430;
const mx = (v: number) => 20 + (v / 100) * (MW - 40), my = (v: number) => 20 + (v / 100) * (MH - 40);
function mapSvg(m: any): string {
  const regs = (m.regions || []).filter((r: any) => r.map);
  let s = `<svg viewBox="0 0 ${MW} ${MH}" role="img" aria-label="İstanbul haritası"><defs>
<radialGradient id="mkv" cx="50%" cy="45%" r="70%"><stop offset="60%" stop-color="#f3e4c0"/><stop offset="100%" stop-color="#d9c08e"/></radialGradient>
<pattern id="mkw" width="34" height="14" patternUnits="userSpaceOnUse"><path d="M2 8 q7 -6 14 0 q7 6 14 0" fill="none" stroke="#7fb8d6" stroke-width="1.6"/></pattern></defs>`;
  s += `<rect width="${MW}" height="${MH}" fill="#9fd0ea"/><rect width="${MW}" height="${MH}" fill="url(#mkw)" opacity=".7"/>`;
  // land: one big coast with a bay, plus the Boğaz cutting in from the north-east
  s += `<path d="M0 0 H${MW} V${my(60)} C ${mx(92)} ${my(70)}, ${mx(84)} ${my(78)}, ${mx(76)} ${my(86)} C ${mx(66)} ${my(80)}, ${mx(52)} ${my(74)}, ${mx(40)} ${my(73)} C ${mx(26)} ${my(72)}, ${mx(14)} ${my(80)}, 0 ${my(76)} Z" fill="url(#mkv)" stroke="#8a6a3a" stroke-width="3"/>`;
  s += `<path d="M${mx(98)} 0 C ${mx(92)} ${my(12)}, ${mx(97)} ${my(22)}, ${mx(93)} ${my(30)} C ${mx(90)} ${my(36)}, ${mx(95)} ${my(42)}, ${MW} ${my(46)} V0 Z" fill="#9fd0ea" stroke="#8a6a3a" stroke-width="3"/>`;
  // islands (Adalar) and little hills / trees for texture
  for (const [x, y, r] of [[56, 92, 5.5], [64, 95, 3], [49, 96, 2.4], [70, 92, 2]] as number[][]) s += `<ellipse cx="${mx(x)}" cy="${my(y)}" rx="${r * 6}" ry="${r * 3.6}" fill="#efdcae" stroke="#8a6a3a" stroke-width="2.4"/>`;
  for (const [x, y] of [[22, 14], [36, 12], [26, 30], [12, 40], [88, 18], [74, 26], [14, 60], [62, 16]] as number[][]) s += `<path d="M${mx(x)} ${my(y)} l7 -12 l7 12 z" fill="#8fb36a" stroke="#5f7d44" stroke-width="1.5"/>`;
  // roads in walking order, vapur lines between piers
  const by: Record<string, any> = {}; for (const r of regs) by[r.id] = r;
  const order = ['iskele', 'carsi', 'sahil', 'yokus', 'meydan', 'barinak', 'gece', 'stadyum', 'tersane', 'metro', 'tepe'];
  let road = '';
  for (let i = 0; i < order.length - 1; i++) { const a = by[order[i]], b = by[order[i + 1]]; if (a && b) road += `M${mx(a.map[0])} ${my(a.map[1])} Q ${(mx(a.map[0]) + mx(b.map[0])) / 2 + 12} ${(my(a.map[1]) + my(b.map[1])) / 2 - 10} ${mx(b.map[0])} ${my(b.map[1])} `; }
  s += `<path d="${road}" fill="none" stroke="#a0784a" stroke-width="6" stroke-linecap="round" opacity=".55"/><path d="${road}" fill="none" stroke="#fff6e0" stroke-width="2" stroke-dasharray="8 7"/>`;
  const piers = regs.filter((r: any) => r.vapur);
  for (let i = 0; i < piers.length; i++) for (let j = i + 1; j < piers.length; j++) { const a = piers[i], b = piers[j]; if (!(a.island || b.island) && j !== i + 1) continue;
    s += `<path d="M${mx(a.map[0])} ${my(a.map[1])} L ${mx(b.map[0])} ${my(b.map[1])}" stroke="#2f6f9a" stroke-width="2.4" stroke-dasharray="3 6" fill="none" opacity=".7"/>`; }
  // districts
  for (const r of regs) {
    const x = mx(r.map[0]), y = my(r.map[1]), here = m.here === r.id;
    s += `<g class="mk-pin" data-sel="${esc(r.id)}">`;
    if (here) s += `<circle cx="${x}" cy="${y}" r="31" fill="none" stroke="#e0533c" stroke-width="3" stroke-dasharray="5 4"><animateTransform attributeName="transform" type="rotate" from="0 ${x} ${y}" to="360 ${x} ${y}" dur="8s" repeatCount="indefinite"/></circle>`;
    if (sel === r.id) s += `<circle cx="${x}" cy="${y}" r="33" fill="#ffd23f" opacity=".55"/>`;
    s += `<circle cx="${x}" cy="${y}" r="24" fill="${r.open ? esc(r.color) : '#cfc6b6'}" stroke="#3b2a20" stroke-width="3"/><text x="${x}" y="${y + 8}" text-anchor="middle" font-size="22">${ICON[r.id] || '🏘'}</text>`;
    const w = Math.max(54, String(r.short).length * 8.4 + 14);
    s += `<rect x="${x - w / 2}" y="${y + 27}" width="${w}" height="20" rx="10" fill="#fff6e6" stroke="#3b2a20" stroke-width="2"/><text class="s" x="${x}" y="${y + 41}" text-anchor="middle">${esc(r.short)}</text>`;
    if (r.vapur) s += `<text x="${x + 22}" y="${y - 16}" font-size="15">⛴</text>`;
    if (here) s += `<text class="s" x="${x}" y="${y - 30}" text-anchor="middle" fill="#e0533c">Buradasın</text>`;
    s += `</g>`;
  }
  // dükkan zinciri pins moved to the list below the map (they cluttered the districts)
  // compass rose
  s += `<g transform="translate(${MW - 40},${MH - 44})"><circle r="20" fill="#fff6e6" stroke="#3b2a20" stroke-width="2"/><path d="M0 -15 L6 0 L0 15 L-6 0 Z" fill="#e0533c"/><text class="s" y="-23" text-anchor="middle">K</text></g>`;
  s += `<text x="${mx(84)}" y="${my(6)}" class="s" font-style="italic" fill="#2f6f9a">Boğaz</text><text x="${mx(30)}" y="${my(88)}" class="s" font-style="italic" fill="#2f6f9a">Marmara</text>`;
  return s + `</svg>`;
}

export function renderHarita(m: any): string {
  if (!m || !m.regions) return `<div class="sb-empty">${I('sparkle')}<span>Harita katlanıyor, bir saniye.</span></div>`;
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  const fresh = now - lastRender > 1500; lastRender = now;
  let s = CSS + `<div class="mk-paper${fresh ? ' unfold' : ''}"><div class="mk-title">İSTANBUL · MARTIKÖY</div>${mapSvg(m)}</div>`;
  if (m.travel) s += `<div class="sb-card" style="text-align:center;font:900 17px/1.3 var(--disp)">Yoldasın... 🚐</div>`;
  const sr = sel && (m.regions || []).find((r: any) => r.id === sel);
  if (sr) {
    const here = m.here === sr.id, places = (m.places || []).filter((p: any) => p.region === sr.id || p.regionName === sr.name);
    const go = !sr.open ? btn('Kilitli', 'mkGo', sr.id, 'cream', sr.lockLine || 'Henüz açılmadı.', true, sr.lockLine || 'Henüz açılmadı.')
      : here ? `<span class="sb-chip ok" style="justify-content:center;width:100%">${I('check')} Buradasın</span>` : btn(sr.name + '\'a git ▶', 'mkGo', sr.id, 'green', sr.bus ? 'Önce 42B durağına' : sr.vapur ? 'Vapur ya da dolmuşla' : 'Dolmuşla');
    s += `<div class="sb-card" style="border-color:${esc(sr.color)};border-width:4px"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="font:900 20px var(--disp);margin:0">${ICON[sr.id] || '🏘'} ${esc(sr.name)}</h3><button class="sb-btn cream sm" data-mksel-x="1">✕</button></div>
      <p style="font:700 15px/1.35 var(--body);margin:4px 0 6px">${esc(sr.open ? sr.blurb : sr.lockLine)}</p>
      ${places.length ? `<div class="sb-muted" style="font-size:14px;margin-bottom:6px">Burada: ${places.map((p: any) => esc(p.icon + ' ' + p.name)).join(' · ')}</div>` : ''}${go}</div>`;
  } else s += `<div class="sb-muted" style="text-align:center;margin:-4px 0 8px">Haritada bir semte dokun, ne olduğunu gör ve git.</div>`;
  s += `<div class="mk-tools">${btn('Yoldan geçene sor', 'mkAsk', null, 'cream', 'Biri yolu gösterir')}${m.guide ? btn('Fındık dursun', 'mkStop', null, 'cream', 'Rehber: ' + m.guide) : btn('Fındık, bana yol göster', 'mkGuide', nextGuide(m), 'green', 'Rehber kedi önden yürür')}</div>`;
  // neighbourhoods
  s += `<div class="sb-sec">${I('people')}Mahalleler<span>${(m.regions || []).filter((r: any) => r.open).length} / ${(m.regions || []).length} açık</span></div>`;
  for (const r of m.regions) {
    const here = m.here === r.id;
    const st = !r.open ? `<span class="mk-st lock">${r.realm ? r.level + '. seviye' : 'Yakında'}</span>` : here ? `<span class="mk-st on">Buradasın</span>` : '';
    const how = r.bus ? '42B durağına götürür' : r.vapur ? 'Vapur ya da dolmuş' : 'Dolmuş';
    const action = !r.open ? btn('Kilitli', 'mkGo', r.id, 'cream sm', '', true, r.lockLine || 'Henüz açılmadı.')
      : r.bus ? btn('🚌 42B', 'mkGo', r.id, 'blue sm', how) : r.stopKnown ? btn('Git', 'mkGo', r.id, 'blue sm', how) : btn('Yürü', 'mkGuide', r.id, 'cream sm', 'Fındık götürür');
    s += `<div class="sb-card mk-row"><div class="ic" style="background:${esc(r.color)}">${r.open ? '🏘' : '🔒'}</div><div><h3>${esc(r.name)}${st}</h3><p>${esc(r.open ? r.blurb : r.lockLine)}<small>${r.stopKnown ? '🚐 ' + esc(r.stop) : 'Durak: henüz bulunmadı, yürüyerek keşfet'}</small></p></div>${action}</div>`;
  }
  // places
  const pl = (m.places || []);
  const mk = (kind: string, title: string, icon: string) => {
    const list = pl.filter((p: any) => p.kind === kind); if (!list.length) return '';
    let o = `<div class="sb-sec">${I(icon)}${title}<span>${list.filter((p: any) => p.open && p.reachable).length} açık</span></div>`;
    for (const p of list) {
      const st = !p.reachable ? `<span class="mk-st lock">Kapalı mahalle</span>` : p.open ? `<span class="mk-st on">Açık</span>` : `<span class="mk-st off">Kapalı</span>`;
      o += `<div class="sb-card mk-row"><div class="ic">${esc(p.icon)}</div><div><h3>${esc(p.name)}${st}</h3><p>${esc(p.line || p.blurb)}<small>${esc(p.regionName)} · ${esc(p.hours)}</small></p></div>${btn('Git', 'mkGo', p.id, 'blue sm', '', !p.reachable, 'Bu mahalle henüz açılmadı.')}</div>`;
    }
    return o;
  };
  s += mk('mekan', 'Mekanlar', 'sparkle');
  s += mk('lokanta', 'Lokantalar', 'menu');
  // survey 2026-10-24: dükkan zinciri (big shops), locked ones listed with what opens them
  const zc = (m.zincir || []) as any[];
  if (zc.length) {
    s += `<div class="sb-sec">${I('shop')}Dükkan zinciri<span>${zc.filter(d => d.durum === 'acik').length} / ${zc.length} açık</span></div>`;
    for (const d of zc) {
      const st = d.durum === 'acik' ? `<span class="mk-st on">Senin</span>` : d.durum === 'alinabilir' ? `<span class="mk-st off">Alınabilir</span>` : `<span class="mk-st lock">Kilitli</span>`;
      s += `<div class="sb-card mk-row"><div class="ic" style="background:${d.durum === 'kilitli' ? '#cfc6b6' : esc(d.color)}">${d.durum === 'kilitli' ? '🔒' : esc(d.icon)}</div><div><h3>${esc(d.ad)}${st}</h3><p>${esc(d.durum === 'kilitli' ? d.neden || d.desc : d.desc)}<small>${esc(d.tur)} · ${tl(d.cost)} · günde ~${tl(d.gunluk)}</small></p></div></div>`;
    }
  }
  // side shops
  s += `<div class="sb-sec">${I('shop')}Yan dükkanlar<span>${m.shopsOwned} / ${m.shopMax}</span></div>`;
  s += `<div class="sb-card" style="font:700 15px/1.35 var(--body)">Küçük dükkanları devral, kendi kendine kazansın. Kasayı boşaltmak için yanına uğra!</div>`;
  for (const sh of m.shops || []) {
    const full = m.shopsOwned >= m.shopMax;
    const right = sh.owned ? (sh.till > 0 ? btn('Kasası: ' + tl(sh.till), 'mkGo', sh.id, 'green sm', 'Git topla') : `<span class="sb-chip ok">${I('check')} Senin</span>`)
      : btn('Devral', 'mkShop', sh.id, 'green sm', tl(sh.price), !sh.open || full || m.money < sh.price, !sh.open ? sh.region + ' henüz açılmadı.' : full ? 'En fazla ' + m.shopMax + ' yan dükkan.' : 'Kasada ' + tl(sh.price) + ' olmalı.');
    s += `<div class="sb-card mk-row"><div class="ic">${esc(sh.icon)}</div><div><h3>${esc(sh.name)}</h3><p>${esc(sh.line)}<small>${esc(sh.region)} · saatte ${tl(sh.perHour)}</small></p></div>${right}</div>`;
  }
  // garage
  s += `<div class="sb-sec">${I('stopwatch')}Garaj<span>Yolculuk şekli</span></div>`;
  for (const v of m.vehicles || []) {
    const right = v.on ? `<span class="sb-chip ok">${I('check')} Seçili</span>` : v.owned ? btn('Seç', 'mkVeh', v.id, 'cream sm')
      : btn('Al', 'mkBuyVeh', v.id, 'green sm', tl(v.price), m.level < v.level || m.money < v.price, m.level < v.level ? v.level + '. seviyede açılır.' : 'Kasada ' + tl(v.price) + ' olmalı.');
    s += `<div class="sb-card mk-row"><div class="ic">${esc(v.icon)}</div><div><h3>${esc(v.name)}</h3><p>${esc(v.blurb)}</p></div>${right}</div>`;
  }
  s += `<div class="sb-card" style="font:700 14px/1.35 var(--body)">🚐 ${esc(m.dolmus?.name || 'Dolmuş')} ${tl(m.fares?.dolmus || 0)} · ⛴ Vapur ${tl(m.fares?.vapur || 0)} (İskele ile Barınak arası). Paran yetmezse şoför idare eder.</div>`;
  // finds
  const f = m.finds || {};
  s += `<div class="sb-sec">${I('cat')}Buluntular<span>${(f.cats || 0) + (f.photos || 0) + (f.returned || 0)} / ${(f.catsN || 0) + (f.photosN || 0) + (f.lostN || 0)}</span></div><div class="sb-card">`;
  s += `<p style="font:800 15px/1.3 var(--body);margin:0 0 6px">🐱 Gizli kediler ${f.cats}/${f.catsN} · 📷 Foto noktaları ${f.photos}/${f.photosN} · 🎁 Sahibine dönen ${f.returned}/${f.lostN} · 🪙 Bugün yerde ${f.coinsLeft} bozuk para</p>`;
  if (f.carrying) s += `<div class="mk-row" style="margin:6px 0"><div class="ic">🎁</div><div><h3>${esc(f.carrying.name)}</h3><p>Sahibi: ${esc(f.carrying.owner)}</p></div>${btn('Sahibine götür', 'mkGuide', 'owner', 'green sm')}</div>`;
  const tags = [...(f.catNames || []).map((n: string) => '🐱 ' + n), ...(f.photoNames || []).map((n: string) => '📷 ' + n)];
  s += tags.length ? `<div class="mk-tags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : `<p class="sb-muted" style="margin:0">Sokaklarda gözünü dört aç: çalıların arkası, merdiven başları, kayıkların burnu...</p>`;
  s += `</div><div class="sb-foot">Sen gezerken ekip büfeyi çevirir. ${m.trips ? 'Toplam yolculuk: ' + m.trips : ''}</div>`;
  return s;
}

function nextGuide(m: any): string | null {
  const r = (m.regions || []).find((x: any) => x.open && !x.stopKnown);
  return r ? r.id : 'iskele';
}

/** Small card for the Görevler panel that opens the map. */
export function renderHaritaSection(m: any): string {
  if (!m) return '';
  return CSS + `<div class="sb-sec">${I('sparkle')}Martıköy Haritası<span>${m.open} / ${m.total} mahalle</span></div><div class="sb-card mk-sec"><div class="ic">🗺</div><div class="sb-grow"><h3>Mahalleyi gez</h3>
    <p>${m.next ? 'Sıradaki: ' + esc(m.next) : 'Bütün mahalleler açık!'} · Gizli kedi ${m.cats}/${m.catsN} · Yan dükkan ${m.shops}</p></div>${btn('Haritayı aç', 'haritaOpen', null, 'blue sm')}</div>`;
}
