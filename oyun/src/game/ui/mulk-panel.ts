// Envanter / Banka / Günlük / Mülk / Stadyum paneli (karar paketi G: alt bar Envanter + Mülk, her buton gerçek iş yapar).
// View only: reads rt.mulk (sim/mulk.ts) and sends { kind: 'mulk', ... }. A floating hint button appears at the bank door, a plot
// door or the stadium gate and opens the right tab.
import { FORMATIONS } from '../sim/macmotor';
import { mulkApi } from '../sim/mulk';
import { ESYALAR, ESYA_BY_ID, SANDIKLAR, TARIFLER, DUKKAN_TIPLERI, DUKKAN_BY_ID, DUKKAN_STOK_MAX, dukkanMusteri, BANKA } from '../../content/esya';

interface Deps { root: HTMLElement; rules: () => { rt: unknown } | null; command(c: { kind: string; [k: string]: unknown }): void; sfx?(id: string): void }
export interface MulkPanel { update(dt: number): void; open(tab?: Tab): void; close(): void; dispose(): void }
type Tab = 'envanter' | 'banka' | 'gunluk' | 'mulk' | 'stadyum' | 'lig' | 'defter' | 'salon' | 'okul' | 'avm';

const CSS = `
.mp-bg{position:fixed;inset:0;z-index:62;display:none;align-items:center;justify-content:center;background:rgba(40,22,18,.55);padding:12px;pointer-events:auto;font-family:var(--body)}
.mp-bg.on{display:flex}
.mp-card{width:min(640px,100%);max-height:calc(100vh - 24px);display:flex;flex-direction:column;background:#fdf3e1;color:#3b2a20;border:4px solid #3b2a20;border-radius:22px;box-shadow:0 8px 0 #3b2a20;overflow:hidden}
.mp-top{display:flex;align-items:center;gap:8px;padding:12px 14px 6px}.mp-top h2{flex:1;margin:0;font:900 22px/1.1 var(--disp)}
.mp-chip{font:900 14px var(--disp);background:#fff;border:3px solid #3b2a20;border-radius:12px;padding:2px 10px;white-space:nowrap}
.mp-x{min-height:44px;min-width:44px;border:3px solid #3b2a20;border-radius:12px;background:#ffd23f;font:900 18px var(--disp);color:#3b2a20;cursor:pointer}
.mp-tabs{display:flex;gap:5px;padding:0 14px 8px;overflow-x:auto;scrollbar-width:none}
.mp-t{flex:none;min-height:42px;padding:0 12px;border:3px solid #3b2a20;border-radius:12px;background:#fff6e6;font:900 15px var(--disp);color:#3b2a20;cursor:pointer}.mp-t.on{background:#ffd23f}
.mp-body{overflow-y:auto;padding:4px 14px 14px;flex:1}
.mp-sec{font:900 15px var(--disp);margin:12px 0 6px;opacity:.85}
.mp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.mp-it{border:3px solid #3b2a20;border-radius:14px;background:#fff;padding:8px 10px;display:flex;flex-direction:column;gap:3px;min-width:0}
.mp-it.r1{background:#eaf6ff}.mp-it.r2{background:#fff3c4}
.mp-it b{font:900 15px/1.15 var(--disp)}.mp-it small{font:700 12px/1.25 var(--body);opacity:.75}.mp-ic{font-size:26px;line-height:1}
.mp-n{align-self:flex-end;font:900 14px var(--disp);background:#3b2a20;color:#fff;border-radius:9px;padding:0 8px;margin-top:-26px}
.mp-b{min-height:38px;padding:0 12px;border:3px solid #3b2a20;border-radius:11px;background:#fff6e6;font:900 14px var(--disp);color:#3b2a20;cursor:pointer;box-shadow:0 3px 0 #3b2a20}
.mp-gise{background:#101c3a;color:#fff;border-radius:14px;padding:10px 12px;display:grid;gap:8px}.mp-gr{display:flex;align-items:center;gap:10px}.mp-gr span{font:800 11px var(--body);letter-spacing:.14em;text-transform:uppercase;opacity:.6;flex:1}.mp-gr b{font:900 22px var(--disp);min-width:96px;text-align:center;color:#ffb627}.mp-gise .mp-b{min-height:34px;width:38px;padding:0}.mp-gb{position:relative;height:26px;border-radius:9px;background:rgba(255,255,255,.12);overflow:hidden}.mp-gb i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#2fbf71,#6ef2ab)}.mp-gb u{position:absolute;inset:0;display:grid;place-items:center;text-decoration:none;font:800 12px var(--body);color:#fff;text-shadow:0 1px 3px #000a}.mp-gs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.mp-gs span{background:rgba(255,255,255,.08);border-radius:10px;padding:6px 8px;font:800 10px var(--body);letter-spacing:.08em;text-transform:uppercase;opacity:.95}.mp-gs b{display:block;font:900 15px var(--disp);letter-spacing:0;text-transform:none;color:#6ef2ab;margin-top:3px}.mp-gise small{opacity:.6;font:700 11px var(--body)}.mp-kadro{display:flex;gap:12px;align-items:center;margin:6px 0}.mp-forma{width:74px;height:84px;border-radius:12px 12px 8px 8px;border:3px solid #16233b;position:relative;display:grid;place-items:center;clip-path:polygon(0 18%,22% 0,38% 8%,62% 8%,78% 0,100% 18%,100% 100%,0 100%);flex:none}.mp-forma b{font-size:26px;line-height:1;text-shadow:0 2px 0 #fff8}.mp-forma span{position:absolute;bottom:6px;font:900 15px var(--disp);color:#fff;text-shadow:0 2px 0 #0008}.mp-dz{display:flex;gap:6px;flex-wrap:wrap}.mp-dz .mp-b{min-height:34px;font-size:13px}.mp-sq{display:grid;gap:5px}.mp-pl{display:flex;align-items:center;gap:10px;background:#fff8;border-radius:10px;padding:5px 8px}.mp-pl i{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font:900 14px var(--disp);font-style:normal;border:2px solid #16233b;flex:none}.mp-pl small{display:block;font:700 11px var(--body);opacity:.7}
.mp-pk{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:8px 0;font:800 12px var(--body)}.mp-pk span{min-width:70px;opacity:.7}.mp-sw{width:30px;height:30px;border-radius:50%;border:3px solid #3b2a20;cursor:pointer;padding:0;font-size:16px;background:#fff6e6}.mp-sw.wide{border-radius:10px}.mp-sw.on{outline:3px solid #ffd23f;outline-offset:1px}.mp-prev{height:54px;border:3px solid #3b2a20;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:30px;margin:6px 0;text-shadow:0 2px 0 #fff8}
.mp-b.g{background:#8fd06b}.mp-b.y{background:#ffd23f}.mp-b.r{background:#ff8b7a}.mp-b:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
.mp-row{display:flex;align-items:center;gap:8px;border:3px solid #3b2a20;border-radius:14px;background:#fff;padding:8px 10px;margin-bottom:7px;flex-wrap:wrap}
.mp-row>div{flex:1;min-width:120px}.mp-row b{font:900 15px/1.2 var(--disp)}.mp-row small{display:block;font:700 12px/1.3 var(--body);opacity:.75}
.mp-bar{height:10px;border-radius:6px;background:#e7d9bf;border:2px solid #3b2a20;overflow:hidden;margin-top:4px}.mp-bar i{display:block;height:100%;background:#8fd06b}
.mp-note{border:3px dashed #3b2a20;border-radius:14px;padding:12px;text-align:center;font:800 14px/1.4 var(--body);background:#fff6e6}
.mp-in{box-sizing:border-box;width:100%;min-height:42px;border:3px solid #3b2a20;border-radius:11px;padding:4px 10px;font:800 16px var(--body);background:#fff;color:#3b2a20;margin:6px 0}
.mp-son{border:3px solid #3b2a20;border-radius:14px;background:#fff3c4;padding:8px 12px;font:800 14px/1.4 var(--body);margin-bottom:8px}
.mp-hint{position:fixed;left:50%;bottom:118px;transform:translateX(-50%);z-index:44;pointer-events:auto;min-height:54px;padding:0 22px;border-radius:18px;border:4px solid #3b2a20;background:#ffd23f;box-shadow:0 5px 0 #3b2a20;font:900 19px/1 var(--disp);color:#3b2a20;cursor:pointer;display:none;white-space:nowrap}
`;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const tl = (n: number) => Math.round(n || 0).toLocaleString('tr') + ' ₺';
type M = Record<string, any>;

export function createMulkPanel(d: Deps): MulkPanel {
  const st = document.createElement('style'); st.textContent = CSS; d.root.appendChild(st);
  const bg = document.createElement('div'); bg.className = 'mp-bg'; d.root.appendChild(bg);
  const hint = document.createElement('button'); hint.className = 'mp-hint'; d.root.appendChild(hint);
  let tab: Tab = 'envanter', key = '', openNow = false, t = 0, hintTab: Tab | null = null, pickPlot = '', pickTip = '', focus = '', ktMode = false;
  const cmd = (c: Record<string, unknown>) => { d.command({ kind: 'mulk', ...c }); try { d.sfx?.('pick'); } catch { /* */ } key = ''; };

  const itemCard = (id: string, n: number, acts = '') => { const e = ESYA_BY_ID[id]; if (!e) return ''; return `<div class="mp-it r${e.nadir}"><span class="mp-ic">${e.ikon}</span><b>${esc(e.ad)}</b><small>${esc(e.blurb)}</small><span class="mp-n">×${n}</span>${acts}</div>`; };
  const usable = (id: string) => ['bozuk_kese', 'tecrube_simit', 'sans_simidi', 'altin_kupon'].includes(id);

  function envanter(m: M): string {
    let s = '';
    if (m.son) s += `<div class="mp-son">Son sandık: <b>${esc(m.son.sandik)}</b> · +${tl(m.son.tl)}${m.son.esya.length ? ' · ' + m.son.esya.map((i: string) => (ESYA_BY_ID[i]?.ikon || '') + ' ' + esc(ESYA_BY_ID[i]?.ad || i)).join(', ') : ''}</div>`;
    const own = ((m.arsa || []) as M[]).filter(a => a.owned);
    s += `<div class="mp-sec">İşletmelerin <small>(büfedeki gibi: seviye, işçi, kasa)</small></div>` + (own.length ? own.map(a => { const t = a.sabit ? null : DUKKAN_BY_ID[a.tip]; return `<div class="mp-row"><span class="mp-ic">${a.sabit ? esc(a.ikon || '🏪') : t ? t.ikon : '🏠'}</span><div><b>${esc(a.ad || (t ? t.ad : (a.tur === 'ev' ? 'Ev ' : 'Boş arsa ') + String(a.id).toUpperCase()))}</b><small>${a.lv}. seviye${a.isci ? ' · 👷 ' + a.isci + '/' + a.isciMax + ' işçi' : ''} · kasada ${tl(a.till)}${a.sat ? ' · ' + a.sat + ' satış' : ''}</small></div></div>`; }).join('') : '<div class="mp-note">Henüz işletmen yok: Mülk sekmesinden bir dükkan satın al.</div>');
    s += `<div class="mp-sec">Sandıklar <small>(maç, orman, mülk geliri, günlük tahta ve seviye atlayınca düşer)</small></div>`;
    const ch = SANDIKLAR.filter(x => (m.sandik[x.id] || 0) > 0);
    s += ch.length ? ch.map(x => { const key = x.anahtar ? (m.esya[x.anahtar] || 0) > 0 : true; return `<div class="mp-row"><span class="mp-ic" style="font-size:30px">${x.ikon}</span><div><b>${esc(x.ad)} ×${m.sandik[x.id]}</b><small>${tl(x.tl[0])} - ${tl(x.tl[1])} ve ${x.adet[0]}-${x.adet[1]} eşya${x.anahtar ? ' · 🗝️ Altın Anahtar ister' : ''}</small></div><button class="mp-b g" data-a="sandikAc" data-id="${x.id}"${key ? '' : ' disabled'}>Aç</button></div>`; }).join('') : '<div class="mp-note">Sandığın yok. Maç oyna, ormanda mantar topla, günlük tahtayı bitir.</div>';
    const ids = Object.keys(m.esya).filter(i => ESYA_BY_ID[i] && m.esya[i] > 0);
    s += `<div class="mp-sec">Çantan <small>(${ids.length} çeşit)</small></div>`;
    s += ids.length ? `<div class="mp-grid">${ids.map(i => itemCard(i, m.esya[i], usable(i) ? `<button class="mp-b y" data-a="kullan" data-id="${i}">Kullan</button>` : '')).join('')}</div>` : '<div class="mp-note">Çanta boş.</div>';
    s += `<div class="mp-sec">Üretim <small>(malzeme biriktir, eşya üret)</small></div>`;
    s += TARIFLER.map(r => { const ok = Object.entries(r.gir).every(([k, v]) => (m.esya[k] || 0) >= v); return `<div class="mp-row"><span class="mp-ic">${ESYA_BY_ID[r.cik].ikon}</span><div><b>${esc(ESYA_BY_ID[r.cik].ad)}</b><small>${Object.entries(r.gir).map(([k, v]) => `${v} ${esc(ESYA_BY_ID[k].ad)} (${m.esya[k] || 0})`).join(' + ')}</small></div><button class="mp-b g" data-a="uret" data-id="${r.id}"${ok ? '' : ' disabled'}>Üret</button></div>`; }).join('');
    return s;
  }

  function banka(m: M): string {
    const b = m.banka;
    let s = `<div class="mp-row"><span class="mp-ic" style="font-size:34px">🏦</span><div><b>${esc(BANKA.ad)}</b><small>Hesabına bağlı ortak kasa: 4 karakterin de aynı parayı ve eşyayı görür.</small></div></div>`;
    if (!b.yakin) return s + `<div class="mp-note">Bankaya erişmek için binanın önüne git.<br><b>Karşı yaka</b>, meydanın doğusu: üst geçitten karşıya geç.<br>Bankadaki mal: <b>${tl(b.tl)}</b> · ${Object.values(b.esya).reduce((a: number, n: any) => a + n, 0)} eşya</div>`;
    s += `<div class="mp-sec">Para · bankada ${tl(b.tl)} · cebinde ${tl(m.money)}</div><div class="mp-row">${[1000, 10000, 100000].map(n => `<button class="mp-b" data-a="tlYatir" data-n="${n}"${m.money >= n ? '' : ' disabled'}>Yatır ${n / 1000}K</button>`).join('')}<button class="mp-b g" data-a="tlYatir" data-n="${Math.floor(m.money)}"${m.money >= 1 ? '' : ' disabled'}>Hepsini yatır</button></div>`;
    s += `<div class="mp-row">${[1000, 10000, 100000].map(n => `<button class="mp-b" data-a="tlCek" data-n="${n}"${b.tl >= n ? '' : ' disabled'}>Çek ${n / 1000}K</button>`).join('')}<button class="mp-b y" data-a="tlCek" data-n="${b.tl}"${b.tl >= 1 ? '' : ' disabled'}>Hepsini çek</button></div>`;
    s += `<div class="mp-sec">Kredi · borç ${tl(b.borc || 0)} / limit ${tl(b.limit || 0)} · günlük faiz %${Math.round((b.faiz || 0) * 100)} · birikime günlük %${((b.mevduat || 0) * 100).toFixed(1)}</div><div class="mp-row">${[10000, 50000].map(n => `<button class="mp-b" data-a="krediAl" data-n="${n}"${(b.limit || 0) - (b.borc || 0) >= n ? '' : ' disabled'}>Kredi çek ${n / 1000}K</button>`).join('')}<button class="mp-b g" data-a="krediOde" data-n="${Math.min(b.borc || 0, Math.floor(m.money))}"${(b.borc || 0) >= 1 && m.money >= 1 ? '' : ' disabled'}>Borcu öde</button></div>`;
    const all = ESYALAR.filter(e => (m.esya[e.id] || 0) > 0 || (b.esya[e.id] || 0) > 0);
    s += `<div class="mp-sec">Eşya depo</div>` + (all.length ? all.map(e => `<div class="mp-row"><span class="mp-ic">${e.ikon}</span><div><b>${esc(e.ad)}</b><small>çantada ${m.esya[e.id] || 0} · bankada ${b.esya[e.id] || 0}</small></div><button class="mp-b" data-a="esyaYatir" data-id="${e.id}" data-n="${m.esya[e.id] || 0}"${(m.esya[e.id] || 0) ? '' : ' disabled'}>Yatır</button><button class="mp-b y" data-a="esyaCek" data-id="${e.id}" data-n="${b.esya[e.id] || 0}"${(b.esya[e.id] || 0) ? '' : ' disabled'}>Çek</button></div>`).join('') : '<div class="mp-note">Depo ve çanta boş.</div>');
    return s;
  }

  /** büfe salonları (2026-11-09): equipment for the pier halls, raises the hourly salon income */
  function salon(m: M): string {
    const z = m.salon; if (!z) return '';
    if (z.stage < 6) return '<div class="mp-note">Salonlar büfe 6. aşamada (Kahvaltı salonu) açılır. Balık lokantası 7. aşamada.</div>';
    const own = new Set<string>(z.esya);
    let s = `<div class="mp-row"><span class="mp-ic" style="font-size:30px">🍽</span><div><b>Salonlar · saatte ~${z.misSaat} misafir</b><small>Ortalama adisyon ${tl(z.adisyon)} · ekip ${z.ekip} kişi. Gelir her oyun saati cebine yazılır.</small></div></div>`;
    for (const [k, ad, min] of [['W', '🍳 Kahvaltı salonu (batı)', 6], ['E', '🐟 Balık lokantası (doğu)', 7]] as [string, string, number][]) {
      s += `<div class="mp-sec">${ad}${z.stage < min ? ' · 🔒 ' + min + '. aşama' : ''}</div><div class="mp-grid">`;
      s += (z.liste as M[]).filter(e => e.salon === k).map(e => own.has(e.id) ? `<div class="mp-it"><span class="mp-ic">${e.ikon}</span><b>${esc(e.ad)}</b><small>✓ ${esc(e.desc)}</small></div>` : `<div class="mp-it"><span class="mp-ic">${e.ikon}</span><b>${esc(e.ad)}</b><small>${esc(e.desc)}${z.stage < e.asama ? ' · 🔒 ' + e.asama + '. aşama' : ''}</small><button class="mp-b g" data-a="salonEsya" data-e="${e.id}"${z.stage < e.asama || m.money < e.fiyat ? ' disabled' : ''}>${tl(e.fiyat)}</button></div>`).join('') + '</div>';
    }
    return s;
  }

  function gunluk(m: M): string {
    let s = `<div class="mp-sec">Bugünün görevleri <small>(üçünü bitirince Gümüş Sandık)</small></div>`;
    s += m.gunluk.map((h: M) => { const ok = h.sayi >= h.hedef; return `<div class="mp-row"><div><b>${esc(h.ad)}</b><small>Ödül ${tl(h.odul)}</small><div class="mp-bar"><i style="width:${Math.min(100, h.sayi / h.hedef * 100)}%"></i></div></div><span class="mp-chip">${h.sayi}/${h.hedef}</span><button class="mp-b g" data-a="gunlukAl" data-id="${h.id}"${ok && !h.alindi ? '' : ' disabled'}>${h.alindi ? 'Alındı' : 'Al'}</button></div>`; }).join('');
    s += m.gunlukSandik ? '<div class="mp-note">🎁 Bugünün sandığı envanterinde!</div>' : '';
    return s + `<div class="mp-note" style="margin-top:8px">Hafta sonu ödülü: 7. günde Altın Anahtar.</div>`;
  }

  function mulk(m: M): string {
    let s = `<div class="mp-sec">Arsalar <small>(${m.sahip}/${m.hak} hakkın dolu)</small></div>`;
    const list = focus ? [...m.arsa].sort((x: M, y: M) => (y.id === focus ? 1 : 0) - (x.id === focus ? 1 : 0)) : m.arsa;
    for (const a of list) {
      if (!a.owned) { const lock = m.level < a.seviye; s += a.sabit
        ? `<div class="mp-row"${a.id === focus ? ' style="background:#fff3c4"' : ''}><span class="mp-ic">${a.ikon || '☕'}</span><div><b>${esc(a.ad)} · satılık</b><small>${lock ? '🔒 ' + a.seviye + '. seviyede açılır · ' : ''}${tl(a.fiyat)} · karşı yaka. İçeri girilir, aletleri ve menüsü kendine has. Arsa hakkından düşmez; işçi tutulur.</small></div><button class="mp-b g" data-a="arsaAl" data-id="${a.id}"${lock || m.money < a.fiyat ? ' disabled' : ''}>Satın al</button></div>`
        : `<div class="mp-row"><span class="mp-ic">🏗️</span><div><b>Arsa ${a.id.toUpperCase()}</b><small>${lock ? '🔒 ' + a.seviye + '. seviyede açılır · ' : ''}${tl(a.fiyat)}</small></div><button class="mp-b g" data-a="arsaAl" data-id="${a.id}"${lock || m.sahip >= m.hak || m.money < a.fiyat ? ' disabled' : ''}>Satın al</button></div>`; continue; }
      if (!a.tur) {
        s += `<div class="mp-row"><span class="mp-ic">🏗️</span><div><b>Arsa ${a.id.toUpperCase()} · boş</b><small>Ne kurulsun?</small></div><button class="mp-b y" data-a="kurEv" data-id="${a.id}"${m.money >= 25000 ? '' : ' disabled'}>🏠 Ev · 25.000 ₺</button><button class="mp-b y" data-a="dukPick" data-id="${a.id}">🏪 Dükkân</button></div>`;
        if (pickPlot === a.id) s += `<div class="mp-grid" style="margin-bottom:8px">${DUKKAN_TIPLERI.map(t => `<div class="mp-it"><span class="mp-ic">${t.ikon}</span><b>${esc(t.ad)}</b><small>Kurulum ${tl(t.kurulum)}${m.level < t.seviye ? ' · 🔒 ' + t.seviye + '. seviye' : ''}</small><button class="mp-b g" data-a="kurDuk" data-id="${a.id}" data-tip="${t.id}"${m.level < t.seviye || m.money < t.kurulum ? ' disabled' : ''}>Kur</button></div>`).join('')}</div>`;
        continue;
      }
      if (a.tur === 'ev') { s += `<div class="mp-row"><span class="mp-ic">🏠</span><div><b>Evin (Arsa ${a.id.toUpperCase()})</b><small>Oda, mutfak, balkon, teras, kedi köşesi. Kapıya yaklaşıp gir.</small></div><button class="mp-b g" data-a="evAc" data-id="${a.id}"${a.yakin ? '' : ' disabled'}>${a.yakin ? 'Eve gir' : 'Kapıya git'}</button></div>`; continue; }
      const t = DUKKAN_BY_ID[a.tip], y = a.yukselt;
      s += `<div class="mp-row" style="align-items:flex-start"><span class="mp-ic">${a.sabit ? a.ikon : t.ikon}</span><div><b>${a.sabit ? (a.ikon || '') + ' ' + esc(a.ad) : esc(t.ad)} · ${a.lv}. seviye${a.sabit ? ' · ' + esc(a.asamaAd || '') : '' }${a.sabit ? '' : ' (Arsa ' + a.id.toUpperCase() + ')'}</b><small>~${a.musteriSaat || Math.round(dukkanMusteri(t, a.lv) * (1 + 0.4 * a.isci))} müşteri/saat · ${a.sat} satış · kasada ${tl(a.till)}${a.isci ? ' · 👷 ' + a.isci + ' işçi (saatlik ücret kasadan)' : ''}${a.yakin ? '' : ' (kasayı toplamak için içeri gir)'}</small></div>
${a.isci < a.isciMax ? `<button class="mp-b" data-a="isciAl" data-id="${a.id}"${m.money >= a.isciFiyat ? '' : ' disabled'}>👷 İşçi tut · ${tl(a.isciFiyat)}</button>` : ''}${y ? `<button class="mp-b y" data-a="yukselt" data-id="${a.id}"${Object.entries(y.esya).every(([k, v]) => (m.esya[k] || 0) >= (v as number)) && m.money >= y.tl ? '' : ' disabled'}>⬆ ${tl(y.tl)} + ${Object.entries(y.esya).map(([k, v]) => v + ' ' + esc(ESYA_BY_ID[k].ad)).join(' + ')}</button>` : '<span class="mp-chip">En üst seviye</span>'}</div>`;
      if (a.sabit) {   // 2026-11-08: the café's own menu, next dishes, equipment
        const own = new Set<string>(a.kesya || []);
        s += `<div class="mp-row" style="display:block;margin-top:-4px"><small><b>Menü</b> ${(a.menu || []).map((x: { ikon: string; ad: string; fiyat: number }) => `<span class="mp-chip">${x.ikon} ${esc(x.ad)} ${tl(x.fiyat)}</span>`).join(' ')}</small>
${(a.menuSonraki || []).length ? `<small style="display:block;margin-top:4px;opacity:.75">Sonraki seviyede: ${(a.menuSonraki as { ikon: string; ad: string }[]).map(x => x.ikon + ' ' + esc(x.ad)).join(', ')}</small>` : ''}
<div class="mp-sec" style="margin:8px 0 4px">Aletler <small>(alınca içeride görünür)</small></div><div class="mp-grid" style="margin-top:6px">${(a.aletler as M[]).map(e => own.has(e.id) ? `<div class="mp-it"><span class="mp-ic">${e.ikon}</span><b>${esc(e.ad)}</b><small>✓ ${esc(e.desc)}</small></div>` : `<div class="mp-it"><span class="mp-ic">${e.ikon}</span><b>${esc(e.ad)}</b><small>${esc(e.desc)}${a.lv < e.lv ? ' · 🔒 ' + e.lv + '. seviye' : ''}</small><button class="mp-b g" data-a="kafeEsya" data-id="${a.id}" data-e="${e.id}"${a.lv < e.lv || m.money < e.fiyat ? ' disabled' : ''}>${tl(e.fiyat)}</button></div>`).join('')}</div>
<div class="mp-sec" style="margin:8px 0 4px">Tema <small>(ilki bedava, sonra 15.000 ₺) · tezgahtaki makinenin önünde dur: kahveyi sen yaparsın</small></div><div>${[['retro', 'Retro'], ['modern', 'Modern'], ['bohem', 'Bohem'], ['deniz', 'Deniz']].map(([k, ad]) => `<button class="mp-b${a.tema === k ? ' g' : ''}" data-a="tema" data-id="${a.id}" data-e="${k}"${a.tema === k ? ' disabled' : ''}>${a.tema === k ? '✓ ' : ''}${ad}</button>`).join('')}</div>
<small style="display:block;margin-top:4px">👷 İşçi ${a.isci}/${a.isciMax} (seviye arttıkça daha çok işçi çalışır)</small></div>`;
      }
    }
    void DUKKAN_STOK_MAX;
    return s;
  }

  /** Ticket booth + squad sheet of the founded club. */
  function gise(m: M): string {
    const t = m.takim, g = m.stad, z = (m.lig?.ist || {}) as M, P = (z.players || {}) as Record<string, Record<string, number>>;
    const c1 = t.renk, c2 = t.renk2 || '#f2c230', dol = Math.round(g.tahmin * 100);
    const roller: Record<string, string> = { GK: 'Kaleci', DEF: 'Defans', MID: 'Orta saha', FWD: 'Forvet' };
    const sq = [['Kaleci Nuri', 1], ['Hamdi', 4], ['Cemil', 5], ['SABRİ', 10], ['Tayyar', 9]] as [string, number][];
    const fm = FORMATIONS[g.formasyon] || FORMATIONS['2-2'];
    let h = `<h3 style="margin:12px 0 4px;font-size:14px">🎟️ Bilet gişesi</h3><div class="mp-gise">
<div class="mp-gr"><span>Bilet</span><button class="mp-b" data-a="biletFiyat" data-n="-1">−</button><b>${tl(g.fiyat)}</b><button class="mp-b" data-a="biletFiyat" data-n="1">+</button></div>
<div class="mp-gb"><i style="width:${dol}%"></i><u>Beklenen doluluk %${dol} · ${Math.round(g.tahmin * g.kapasite)}/${g.kapasite} koltuk</u></div>
<div class="mp-gs"><span>Son maç<b>${tl(g.son)}</b></span><span>Toplam gelir<b>${tl(g.gelir)}</b></span><span>İç saha maçı<b>${g.maclar}</b></span></div>
<small>Pahalı bilet = az seyirci. Galibiyet serisi ve güçlü rakip doluluğu artırır. Gelir her lig maçından sonra kasana yazılır.</small></div>`;
    h += `<h3 style="margin:12px 0 4px;font-size:14px">👕 Kadro ve forma</h3><div class="mp-kadro"><div class="mp-forma" style="background:linear-gradient(90deg,${c1} 50%,${c2} 50%)"><b>${t.arma || '🛡️'}</b><span>10</span></div>
<div class="mp-dz">${(g.formaylar as M[]).map(f => `<button class="mp-b${f.id === g.formasyon ? ' y' : ''}" data-a="formasyon" data-id="${f.id}" title="${esc(f.not)}">${esc(f.ad)}</button>`).join('')}</div></div>
<div class="mp-sq">${sq.map(([ad, no], i) => { const r = P[ad] || {}; const rol = fm[i]?.role || 'MID'; return `<div class="mp-pl"><i style="background:${c1};color:${c2}">${no}</i><span><b>${esc(ad)}</b><small>${roller[rol]} · ${r.oyun || 0} maç · ${r.goals || 0} gol · ${r.assists || 0} asist${rol === 'GK' ? ' · ' + (r.saves || 0) + ' kurtarış' : ''}</small></span></div>`; }).join('')}</div>`;
    return h;
  }
  const CLUB_COL = ['#e0533c', '#f2c230', '#2ec4c4', '#3a6fb0', '#1f8a70', '#a990dd', '#2b2b38', '#f4f4f4'], CLUB_ARMA = ['🦅', '🐟', '🦁', '⭐', '⚓', '🔥', '🐈', '🥙'];
  const club = { c1: '#e0533c', c2: '#f2c230', arma: '🦅' };
  const bet = { k: '1', n: 500 };
  function stadyum(m: M): string {
    const s = m.stadyum;
    let h = `<div class="mp-row"><span class="mp-ic" style="font-size:34px">🧢</span><div><b>Maç Koordinatörü</b><small>Karşı yakada halı saha girişinde durur: bilet satar, kulübünü kurar, lig fikstürünü ve puan tablosunu anlatır (Lig sekmesi). Galibiyet sandık getirir.</small></div></div>`;
    if (!s.yakin) h += `<div class="mp-note">Koordinatöre git: üst geçitten karşıya geç, halı saha girişi (tribünlü saha).</div>`;
    if (m.takim) h += `<div class="mp-row"><span class="mp-ic">⚽</span><div><b>Kulüp maçı · bilet yok</b><small>${esc(m.takim.ad)} sıradaki lig maçına çıkar: galibiyet +3 puan ve 6.000 ₺, beraberlik +1 puan, kapı geliri kasana.</small></div><button class="mp-b g" data-a="bilet"${s.yakin ? '' : ' disabled'}>Sahaya çık</button></div>`;
    else h += `<div class="mp-row"><span class="mp-ic">🎟️</span><div><b>Anlık maç · bilet ${tl(s.bilet)}</b><small>Kimse yoksa rakip yapay zeka. 2 yarı. Kulüp kurarsan maçlar kulübün adıyla lige sayılır.</small></div><button class="mp-b g" data-a="bilet"${s.yakin && m.money >= s.bilet ? '' : ' disabled'}>Bilet al</button></div>`;
    // 2026-11-08: watch a match from the stands and put a small bet on it
    const stk = [100, 500, 1000, 5000], bb = (k: string, l: string) => `<button class="mp-b${bet.k === k ? ' y' : ''}" data-a="betK" data-v="${k}">${l}</button>`;
    h += `<div class="mp-row" style="display:block"><div><b>📣 Tribünden izle · küçük bahis</b><small>Mahalle takımlarının maçını izle. Tahminin tutarsa bahis × oran kadar kazanırsın.</small></div>
<div class="mp-pk"><span>Tahmin</span>${bb('1', 'Ev sahibi')}${bb('X', 'Berabere')}${bb('2', 'Deplasman')}${bb('', 'Bahissiz')}</div>
<div class="mp-pk"><span>Bahis</span>${stk.map(v => `<button class="mp-b${bet.n === v ? ' y' : ''}" data-a="betN" data-v="${v}">${tl(v)}</button>`).join('')}</div>
<button class="mp-b g" data-a="izle"${s.yakin && (!bet.k || m.money >= bet.n) ? '' : ' disabled'}>Tribüne geç</button></div>`;
    if (m.takim) h += `<div class="mp-row"><span class="mp-ic" style="background:${m.takim.renk};border-radius:12px">${m.takim.arma || '🛡️'}</span><div><b>Kulübün: ${esc(m.takim.ad)}</b><small>Kuruluş: gün ${m.takim.kurulus ?? '?'} · Lig sekmesinde puan durumu ve istatistik.</small></div></div>`;
    if (m.takim && m.stad) h += gise(m);
    else {
      const sw = (k: 'c1' | 'c2', v: string) => `<button class="mp-sw${club[k] === v ? ' on' : ''}" data-a="kPick" data-k="${k}" data-v="${v}" style="background:${v}" aria-label="${v}"></button>`;
      h += `<div class="mp-row" style="display:block"><div><b>Futbol kulübü kur · ${tl(s.takim)}</b><small>Ad, forma renkleri ve arma. Bir kez seçilir; lig ve istatistikler bu kulüple tutulur.</small></div>
<input class="mp-in" data-f="takim" maxlength="16" placeholder="Kulüp adı">
<div class="mp-pk"><span>Ana renk</span>${CLUB_COL.map(v => sw('c1', v)).join('')}</div><div class="mp-pk"><span>Yedek renk</span>${CLUB_COL.map(v => sw('c2', v)).join('')}</div>
<div class="mp-pk"><span>Arma</span>${CLUB_ARMA.map(v => `<button class="mp-sw wide${club.arma === v ? ' on' : ''}" data-a="kPick" data-k="arma" data-v="${v}">${v}</button>`).join('')}</div>
<div class="mp-prev" style="background:linear-gradient(90deg,${club.c1} 50%,${club.c2} 50%)"><b>${club.arma}</b></div>
<button class="mp-b y" data-a="takim"${s.yakin && m.money >= s.takim ? '' : ' disabled'}>Kulübü kur</button></div>`;
    }
    return h;
  }

  /** Career ledger (çetele): record, goals, form, team totals, top players. */
  function istatistik(z: M | null): string {
    if (!z || !z.played) return '<div class="mp-note">Henüz maç oynamadın: istatistikler ilk maçtan sonra burada.</div>';
    const t = (z.team || {}) as Record<string, number>, P = (z.players || {}) as Record<string, Record<string, number>>, f = ((z.form || []) as string[]);
    const acc = t.passes ? Math.round(t.passesOk / t.passes * 100) : 0, poss = Math.round((t.possSum || 0) / z.played);
    const col = (k: string) => Object.entries(P).sort((a, b) => (b[1][k] || 0) - (a[1][k] || 0)).filter(e => (e[1][k] || 0) > 0).slice(0, 3).map(e => `${esc(e[0])} ${e[1][k]}`).join(' · ') || '-';
    return `<h3 style="margin:12px 0 4px;font-size:14px">İstatistik çetelesi</h3><div class="mp-note"><b>${z.played}</b> maç · <b>${z.won}</b> G ${z.drawn} B ${z.lost} M · averaj ${z.goals}-${z.conceded || 0} · form ${f.map((x: string) => x === 'G' ? '🟢' : x === 'B' ? '🟡' : '🔴').join('') || '-'}</div>
<div class="mp-note">Şut ${t.shots || 0} (isabetli ${t.onTarget || 0}) · pas isabeti %${acc} · topla oynama %${poss} · top çalma ${t.tackles || 0} · kurtarış ${t.saves || 0} · korner ${t.corners || 0}</div>
<div class="mp-note">⚽ Gol: ${col('goals')}</div><div class="mp-note">🅰️ Asist: ${col('assists')}</div><div class="mp-note">🧤 Kurtarış: ${col('saves')}</div>`;
  }

  function lig(m: M): string {
    const l = m.lig; if (!l) return '<div class="mp-note">Lig henüz başlamadı.</div>';
    const b = l.benBolum as number;
    let h = `<div class="mp-row"><span class="mp-ic" style="font-size:34px">🏆</span><div><b>${esc(l.bolumAd[b])} · Sezon ${l.sezon}</b><small>Hafta ${l.tur}/${l.turN}. Maç günleri her oyun haftası, ödül ve sıralama sezon sonunda.</small></div></div>`;
    h += l.sonraki ? `<div class="mp-note">Sıradaki: ${esc(l.sonraki.rakip)} (${l.sonraki.ic ? 'iç saha' : 'deplasman'}) · gün ${l.sonraki.gun}. Teklif öğleden sonra gelir.</div>` : `<div class="mp-note">Bu haftaki maç oynandı.</div>`;
    for (const bi of [b, 1 - b]) {
      h += `<h3 style="margin:10px 0 4px;font-size:14px">${esc(l.bolumAd[bi])}</h3><table style="width:100%;border-collapse:collapse;font-size:13px"><tr style="opacity:.6"><td></td><td>O</td><td>G</td><td>B</td><td>M</td><td>Av</td><td>P</td></tr>`;
      (l.tablo[bi] as M[]).forEach((r, i) => { h += `<tr style="${r.ben ? 'font-weight:900;background:#ffe9a8' : ''}"><td><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${r.renk[0]};margin-right:5px"></i>${i + 1}. ${esc(r.ad)}</td><td>${r.o}</td><td>${r.g}</td><td>${r.b}</td><td>${r.m}</td><td>${r.av > 0 ? '+' : ''}${r.av}</td><td><b>${r.p}</b></td></tr>`; });
      h += '</table>';
    }
    if (l.benimMaclar.length) h += `<h3 style="margin:10px 0 4px;font-size:14px">Maçlarım</h3>` + (l.benimMaclar as M[]).map(x => `<div class="mp-note">H${x.k}: ${esc(x.ev)} ${x.eg}-${x.dg} ${esc(x.dep)}</div>`).join('');
    h += istatistik(l.ist as M | null);
    if (l.gecmis.length) h += `<h3 style="margin:10px 0 4px;font-size:14px">Geçmiş sezonlar</h3>` + (l.gecmis as M[]).map(x => `<div class="mp-note">Sezon ${x.s}: şampiyonlar ${esc(x.sampiyon[0])} / ${esc(x.sampiyon[1])} · biz ${x.sira}. (${x.puan} p)</div>`).join('');
    return h;
  }

  function defter(m: M): string {
    const g = m.gizem; if (!g) return '<div class="mp-note">Defter boş.</div>';
    let h = `<div class="mp-row"><span class="mp-ic" style="font-size:34px">📓</span><div><b>${g.bitti ? 'Hikaye tamam' : 'Sıradaki iş'}</b><small>${esc(g.hedef)}</small></div></div>`;
    if (!g.oku.length) h += '<div class="mp-note">Henüz ipucu yok.</div>';
    for (const c of [...g.oku].reverse() as M[]) h += `<div class="mp-row" style="display:block;${c.id === g.son ? 'background:#fff3c4' : ''}"><div><b>${c.ikon} ${esc(c.baslik)}</b><small>${esc(c.yer)} · gün ${c.gun}</small></div><p style="margin:6px 0 0;font-size:14px;line-height:1.4">${esc(c.metin)}</p></div>`;
    return h;
  }

  function avm(m: M): string {
    const a = m.avm as M, own = new Set<string>(a.alinan);
    let h = `<div class="mp-row"><span class="mp-ic" style="font-size:34px">🛍</span><div><b>Martı AVM</b><small>Giyim ve kozmetik karakter dolabına girer; sinema ve eğlence tecrübe verir.</small></div></div>`;
    if (!a.yakin) h += '<div class="mp-note">Alışveriş için karşı yakadaki Martı AVM\'ye gir.</div>';
    for (const [k, ad] of [['giyim', 'Giyim'], ['kozmetik', 'Kozmetik'], ['sinema', 'Sinema'], ['eglence', 'Eğlence']]) {
      h += `<div class="mp-sec">${ad}</div><div class="mp-grid">` + (a.urun as M[]).filter(u => u.kat === k).map(u => `<div class="mp-it"><span class="mp-ic">${u.ikon}</span><b>${esc(u.ad)}</b><small>${esc(u.desc)}</small>${own.has(u.id) ? '<small>✓ dolapta</small>' : `<button class="mp-b g" data-a="avmAl" data-id="${u.id}"${a.yakin && m.money >= u.fiyat ? '' : ' disabled'}>${tl(u.fiyat)}</button>`}</div>`).join('') + '</div>';
    }
    return h;
  }
  function okul(m: M): string {
    const o = m.okul as M;
    let h = `<div class="mp-row"><span class="mp-ic" style="font-size:34px">📚</span><div><b>İngilizce dersi · genel puan ${o.genel}/100</b><small>Her ${o.sinav} cevap bir sınav. Sınav puanı para + tecrübe verir, ortalaması genel puanın.</small></div></div>`;
    if (!o.yakin) return h + '<div class="mp-note">Ders sınıfta: karşı yakadaki okula gir, sıraların olduğu tarafa geç.</div>';
    if (!o.soru) return h + '<div class="mp-row"><button class="mp-b g" data-a="dersBasla">Derse başla</button></div>';
    if (o.son) h += `<div class="mp-note">${esc(o.son)}</div>`;
    h += `<div class="mp-sec">Soru ${o.cevap + 1}/${o.sinav} · doğru ${o.dogru} — "<b>${esc(o.soru)}</b>" İngilizcesi ne?</div><div class="mp-grid">${(o.secenek as string[]).map((s, i) => `<button class="mp-b" data-a="dersCevap" data-n="${i}">${esc(s)}</button>`).join('')}</div>`;
    if ((o.sinavlar as number[]).length) h += `<small style="display:block;margin-top:6px">Son sınavlar: ${(o.sinavlar as number[]).slice(-6).join(', ')}</small>`;
    return h;
  }
  const TABS: [Tab, string][] = [['envanter', '🎒 Envanter'], ['banka', '🏦 Banka'], ['gunluk', '📋 Günlük'], ['mulk', '🏠 Mülk'], ['stadyum', '🧢 Koordinatör'], ['lig', '🏆 Lig'], ['defter', '📓 Defter'], ['salon', '🍽 Salon'], ['okul', '📚 Okul'], ['avm', '🛍 AVM']];
  function paint(m: M) {
    const body = tab === 'envanter' ? envanter(m) : tab === 'banka' ? banka(m) : tab === 'gunluk' ? gunluk(m) : tab === 'mulk' ? mulk(m) : tab === 'lig' ? lig(m) : tab === 'defter' ? defter(m) : tab === 'salon' ? salon(m) : tab === 'okul' ? okul(m) : tab === 'avm' ? avm(m) : stadyum(m);
    const keep = (bg.querySelector('input[data-f="takim"]') as HTMLInputElement | null)?.value || '';
    const sc = (bg.querySelector('.mp-body') as HTMLElement | null)?.scrollTop || 0;
    bg.innerHTML = `<div class="mp-card"><div class="mp-top"><h2>${TABS.find(x => x[0] === tab)![1]}</h2><span class="mp-chip">${tl(m.money)}</span><span class="mp-chip">🥨 ${m.gold}</span><button class="mp-x" data-a="close">✕</button></div>
<div class="mp-tabs">${TABS.map(([k, l]) => `<button class="mp-t${tab === k ? ' on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div class="mp-body">${body}</div></div>`;
    const i = bg.querySelector('input[data-f="takim"]') as HTMLInputElement | null; if (i) i.value = keep;
    (bg.querySelector('.mp-body') as HTMLElement).scrollTop = sc;
  }

  bg.addEventListener('pointerdown', e => e.stopPropagation());
  bg.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
  for (const ev of ['keydown', 'keyup'] as const) bg.addEventListener(ev, e => e.stopPropagation());
  bg.addEventListener('click', e => {
    if (e.target === bg) { api.close(); return; }
    const el = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!el || el.disabled) return;
    if (el.dataset.tab) { tab = el.dataset.tab as Tab; key = ''; return; }
    const a = el.dataset.a, id = el.dataset.id, n = Number(el.dataset.n) || 0;
    if (a === 'close') { api.close(); return; }
    if (a === 'dukPick') { pickPlot = pickPlot === id ? '' : id!; key = ''; return; }
    if (a === 'kurEv') { cmd({ op: 'arsaKur', id, tur: 'ev' }); return; }
    if (a === 'kurDuk') { pickPlot = ''; cmd({ op: 'arsaKur', id, tur: 'dukkan', tip: el.dataset.tip }); return; }
    if (a === 'kPick') { const k = el.dataset.k as 'c1' | 'c2' | 'arma'; club[k] = el.dataset.v!; key = ''; return; }
    if (a === 'takim') { cmd({ op: 'takim', name: (bg.querySelector('input[data-f="takim"]') as HTMLInputElement).value, renk: club.c1, renk2: club.c2, arma: club.arma }); return; }
    if (a === 'evAc') { cmd({ op: 'evAc', id }); api.close(); return; }
    if (a === 'kafeEsya') { cmd({ op: 'kafeEsya', id, e: el.dataset.e }); return; }
    if (a === 'tema') { cmd({ op: 'tema', id, e: el.dataset.e }); return; }
    if (a === 'salonEsya') { cmd({ op: 'salonEsya', e: el.dataset.e }); return; }
    if (a === 'bilet') { cmd({ op: 'bilet' }); api.close(); return; }
    if (a === 'betK') { bet.k = el.dataset.v || ''; key = ''; return; }
    if (a === 'betN') { bet.n = Number(el.dataset.v) || 500; key = ''; return; }
    if (a === 'izle') { cmd({ op: 'izle', bahis: bet.k || null, n: bet.k ? bet.n : 0 }); api.close(); return; }
    if (a) cmd({ op: a, id, n });
  });

  const api: MulkPanel = {
    open(t0) { if (t0) tab = t0; openNow = true; bg.classList.add('on'); key = ''; },
    close() { openNow = false; bg.classList.remove('on'); },
    update(dt) {
      t -= dt; if (t > 0) return; t = 0.25;
      const m = mulkApi(d.rules() as never); if (!m) return;
      const v = m.view();
      // contextual hint at the bank door / a plot door / the stadium gate
      if ((v as { kirtasiye?: unknown }).kirtasiye) { hint.style.display = 'none'; hintTab = null; return; }   // first-person counter has its own UI
      const ktHint = !!(v as { ktYakin?: boolean }).ktYakin;
      const ht: Tab | null = ktHint ? 'mulk' : v.ipucuYakin ? 'defter' : v.okulYakin ? 'okul' : v.avmYakin ? 'avm' : v.stadyumYakin ? 'stadyum' : v.bankaYakin ? 'banka' : v.arsaYakin ? 'mulk' : v.salonYakin ? 'salon' : null;
      const fa = v.arsaYakin ? (m.model().arsa as M[]).find(x => x.id === v.arsaYakin) : null; if (fa) focus = fa.id;
      const lbl = ktHint ? '✏️ Tezgaha geç (birinci şahıs)' : ht === 'defter' ? '🔍 İncele' : ht === 'stadyum' ? '🧢 Maç Koordinatörü: bilet, kulüp, lig' : ht === 'banka' ? '🏦 Gişe: bankayı aç' : ht === 'salon' ? '🍽 Salonu yönet: aletler' : ht === 'okul' ? '📚 İngilizce dersi / sınav' : ht === 'avm' ? '🛍 AVM: alışveriş, sinema' : ht === 'mulk' ? (fa && fa.sabit ? (fa.ikon || '🏪') + ' ' + fa.ad + (fa.owned ? ': yönet' : ': satın al') : '🏠 Arsa / Dükkân') : '';
      ktMode = ktHint;
      if (ht !== hintTab || hint.textContent !== lbl) { hintTab = ht; hint.style.display = ht && !openNow ? 'block' : 'none'; hint.textContent = lbl; }
      else if (hintTab) hint.style.display = openNow ? 'none' : 'block';
      if (!openNow) return;
      const mod = m.model(); const k2 = tab + '|' + pickPlot + '|' + JSON.stringify(mod);
      if (k2 !== key) { key = k2; paint(mod); }
    },
    dispose() { st.remove(); bg.remove(); hint.remove(); },
  };
  hint.onclick = () => { if (ktMode) { d.command({ kind: 'mulk', op: 'ktAc' } as never); return; } if (hintTab === 'defter') d.command({ kind: 'gizem', op: 'oku' } as never); if (hintTab) api.open(hintTab); };
  return api;
}
