// Envanter / Banka / Günlük / Mülk paneli (karar paketi G: alt bar Envanter + Mülk, her buton gerçek iş yapar). Futbol işleri (bilet, kulüp, lig) burada DEĞİL: Maç Koordinatörü kartında (ui/koordinator.ts).
// View only: reads rt.mulk (sim/mulk.ts) and sends { kind: 'mulk', ... }. A floating hint button appears at the bank door, a plot
// door or the stadium gate; at the gate it only opens the coordinator card.
import { createKoordinator } from './koordinator';
import { icOfArsa } from '../../content/ic-mekan';
import { SIRA } from '../../content/acilis';
import { mulkApi } from '../sim/mulk';
import { ESYALAR, ESYA_BY_ID, SANDIKLAR, DUKKAN_TIPLERI, DUKKAN_BY_ID, dukkanMusteri, BANKA } from '../../content/esya';

interface Deps { root: HTMLElement; rules: () => { rt: unknown } | null; command(c: { kind: string; [k: string]: unknown }): void; sfx?(id: string): void }
const mmss = (sec: number) => { const t = Math.max(0, Math.ceil(sec)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
export interface MulkPanel { update(dt: number): void; open(tab?: OpenTab): void; close(): void; dispose(): void }
type Tab = 'envanter' | 'banka' | 'gunluk' | 'mulk' | 'defter' | 'salon' | 'okul' | 'avm';
/** open() also accepts the old football tab names and hands them to the coordinator card. */
type OpenTab = Tab | 'stadyum' | 'lig';

const CSS = `
.mp-bg{position:fixed;inset:0;z-index:62;display:none;align-items:center;justify-content:center;background:rgba(40,22,18,.55);padding:12px;pointer-events:auto;font-family:var(--body)}
.mp-bg.on{display:flex}
.mp-card{width:min(640px,100%);max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);display:flex;flex-direction:column;background:#fdf3e1;color:#3b2a20;border:4px solid #3b2a20;border-radius:22px;box-shadow:0 8px 0 #3b2a20;overflow:hidden}
.mp-top{display:flex;align-items:center;gap:8px;padding:12px 14px 6px}.mp-top h2{flex:1;margin:0;font:900 22px/1.1 var(--disp)}
.mp-chip{font:900 14px var(--disp);background:#fff;border:3px solid #3b2a20;border-radius:12px;padding:2px 10px;white-space:nowrap}
.mp-x{min-height:44px;min-width:44px;border:3px solid #3b2a20;border-radius:12px;background:#ffd23f;font:900 18px var(--disp);color:#3b2a20;cursor:pointer}
.mp-tabs{display:flex;gap:5px;padding:0 14px 8px;overflow-x:auto;scrollbar-width:none}
.mp-tabs.mr{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 30px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 30px),transparent)}.mp-tabs.ml{-webkit-mask-image:linear-gradient(270deg,#000 calc(100% - 30px),transparent);mask-image:linear-gradient(270deg,#000 calc(100% - 30px),transparent)}.mp-tabs.ml.mr{-webkit-mask-image:linear-gradient(90deg,transparent,#000 26px,#000 calc(100% - 26px),transparent);mask-image:linear-gradient(90deg,transparent,#000 26px,#000 calc(100% - 26px),transparent)}
.mp-t{flex:none;min-height:42px;padding:6px 12px;line-height:1.2;white-space:nowrap;border:3px solid #3b2a20;border-radius:12px;background:#fff6e6;font:900 15px var(--disp);color:#3b2a20;cursor:pointer}.mp-t.on{background:#ffd23f}
.mp-body{overflow-y:auto;padding:4px 14px 14px;flex:1}
.mp-sec{font:900 15px var(--disp);margin:12px 0 6px}
.mp-yol{display:flex;flex-direction:column;gap:5px;margin-bottom:6px}.mp-yd{display:grid;grid-template-columns:30px 1fr auto;align-items:center;column-gap:8px;border:3px solid #3b2a20;border-radius:12px;background:#efe6d6;padding:5px 9px;opacity:.6}.mp-yd span{grid-row:span 2;font-size:20px;text-align:center}.mp-yd b{font:900 14px var(--disp)}.mp-yd i{font:800 11px var(--disp);font-style:normal;background:#3b2a20;color:#fff;border-radius:6px;padding:0 5px;margin-left:6px;vertical-align:2px}.mp-yd small{grid-column:2 / 4;opacity:.85}.mp-yd.ok{background:#dff3d2;opacity:.85}.mp-yd.nx{background:#fff3c4;opacity:1;border-color:#e0a400;box-shadow:0 3px 0 #3b2a20}.mp-yd.nx .mp-b{grid-column:3;grid-row:1}.mp-yd i.mp-yb{grid-column:2 / 4;display:block;height:7px;margin:3px 0 1px;padding:0;background:#fff;border:2px solid #3b2a20;border-radius:6px;overflow:hidden}.mp-yd i.mp-yb i{display:block;height:100%;margin:0;padding:0;border-radius:0;background:#5cb85c}
.mp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.mp-it{border:3px solid #3b2a20;border-radius:14px;background:#fff;padding:8px 10px;display:flex;flex-direction:column;gap:3px;min-width:0}
.mp-it.r1{background:#eaf6ff}.mp-it.r2{background:#fff3c4}
.mp-it b{font:900 15px/1.15 var(--disp)}.mp-it small{font:700 13px/1.3 var(--body);opacity:.9}.mp-ic{font-size:26px;line-height:1}
.mp-n{align-self:flex-end;font:900 14px var(--disp);background:#3b2a20;color:#fff;border-radius:9px;padding:0 8px}
.mp-b{min-height:38px;padding:0 12px;border:3px solid #3b2a20;border-radius:11px;background:#fff6e6;font:900 14px var(--disp);color:#3b2a20;cursor:pointer;box-shadow:0 3px 0 #3b2a20}
.mp-b.g{background:#8fd06b}.mp-b.y{background:#ffd23f}.mp-b.r{background:#ff8b7a}.mp-b:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
.mp-row{display:flex;align-items:center;gap:8px;border:3px solid #3b2a20;border-radius:14px;background:#fff;padding:8px 10px;margin-bottom:7px;flex-wrap:wrap}
.mp-row>div{flex:1;min-width:120px}.mp-row b{font:900 15px/1.2 var(--disp)}.mp-row small{display:block;font:700 13px/1.3 var(--body);opacity:.9}
.mp-bar{height:10px;border-radius:6px;background:#e7d9bf;border:2px solid #3b2a20;overflow:hidden;margin-top:4px}.mp-bar i{display:block;height:100%;background:#8fd06b}
.mp-note{border:3px dashed #3b2a20;border-radius:14px;padding:12px;text-align:center;font:800 14px/1.4 var(--body);background:#fff6e6}
.mp-son{border:3px solid #3b2a20;border-radius:14px;background:#fff3c4;padding:8px 12px;font:800 14px/1.4 var(--body);margin-bottom:8px}
.mp-hint{position:fixed;left:50%;bottom:184px;transform:translateX(-50%);z-index:44;pointer-events:auto;min-height:54px;padding:0 22px;border-radius:18px;border:4px solid #3b2a20;background:#ffd23f;box-shadow:0 5px 0 #3b2a20;font:900 19px/1 var(--disp);color:#3b2a20;cursor:pointer;display:none;white-space:nowrap}
`;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const tl = (n: number) => Math.round(n || 0).toLocaleString('tr') + ' ₺';
type M = Record<string, any>;

export function createMulkPanel(d: Deps): MulkPanel {
  const st = document.createElement('style'); st.textContent = CSS; d.root.appendChild(st);
  const bg = document.createElement('div'); bg.className = 'mp-bg'; d.root.appendChild(bg);
  const hint = document.createElement('button'); hint.className = 'mp-hint'; d.root.appendChild(hint);
  const kd = createKoordinator(d);
  let tab: Tab = 'envanter', key = '', openNow = false, t = 0, hintTab: OpenTab | null = null, pickPlot = '', pickTip = '', focus = '', ktMode = false;
  const cmd = (c: Record<string, unknown>) => { d.command({ kind: 'mulk', ...c }); try { d.sfx?.('pick'); } catch { /* */ } key = ''; t = 0; };

  const itemCard = (id: string, n: number, acts = '') => { const e = ESYA_BY_ID[id]; if (!e) return ''; return `<div class="mp-it r${e.nadir}"><span class="mp-ic">${e.ikon}</span><b>${esc(e.ad)}</b><small>${esc(e.blurb)}</small><span class="mp-n">×${n}</span>${acts}</div>`; };
  const usable = (id: string) => ['bozuk_kese', 'tecrube_simit', 'sans_simidi', 'altin_kupon'].includes(id);

  function envanter(m: M): string {
    let s = '';
    if (m.son) s += `<div class="mp-son">Son sandık: <b>${esc(m.son.sandik)}</b> · +${tl(m.son.tl)}${m.son.esya.length ? ' · ' + m.son.esya.map((i: string) => (ESYA_BY_ID[i]?.ikon || '') + ' ' + esc(ESYA_BY_ID[i]?.ad || i)).join(', ') : ''}</div>`;
    const own = ((m.arsa || []) as M[]).filter(a => a.owned && (a.sabit || a.tur === 'dukkan'));   // ev ve boş arsa işletme değil
    s += `<div class="mp-row"><span class="mp-ic">🌭</span><div><b>Sabri'nin Büfesi</b><small>${m.salon ? m.salon.stage + '. aşama' : 'İskelede'} · ana işletmen</small></div></div>`;
    if (m.takim) s += `<div class="mp-row"><span class="mp-ic" style="background:${m.takim.renk};border-radius:12px">${m.takim.arma || '🛡️'}</span><div><b>${esc(m.takim.ad)}</b><small>Futbol kulübün · Maç Koordinatöründe</small></div></div>`;
    s += `<div class="mp-sec">İşletmelerin <small>(büfedeki gibi: seviye, işçi, kasa)</small></div>` + (own.length ? own.map(a => { const t = a.sabit ? null : DUKKAN_BY_ID[a.tip]; return `<div class="mp-row"><span class="mp-ic">${a.sabit ? esc(a.ikon || '🏪') : t ? t.ikon : '🏠'}</span><div><b>${esc(a.ad || (t ? t.ad : (a.tur === 'ev' ? 'Ev ' : 'Boş arsa ') + String(a.id).toUpperCase()))}</b><small>${a.lv}. seviye${a.isci ? ' · 👷 ' + a.isci + '/' + a.isciMax + ' işçi' + ((a.kadro || []).length ? ' (' + (a.kadro as { ad: string }[]).map(c => esc(c.ad)).join(', ') + ')' : '') : ''}${a.tadilat ? ' · 🔨 tadilatta' : ''} · kasada ${tl(a.till)}${a.sat ? ' · ' + a.sat + ' satış' : ''}${a.asamaAd ? ' · ' + esc(a.asamaAd) : ''}${a.kesya && a.kesya.length ? ' · ' + a.kesya.length + ' alet' : ''}</small></div><button class="mp-b y" data-a="yonet" data-id="${a.id}">Yönet</button></div>`; }).join('') : '<div class="mp-note">Henüz işletmen yok: dükkânın kapısının yanındaki sarı kareye basıp satın al' + ' (sırayla açılırlar: ilki büfe 2. aşamaya gelince).' + '</div>');
    // holding yolu (content/acilis.ts SIRA): alınanlar ✓, sıradaki öne çıkar (koşulu ya da fiyatı), ötekiler sırasını bekler
    const byId = new Map(((m.arsa || []) as M[]).map(a => [a.id, a])), yol = SIRA.map(id => byId.get(id)).filter(Boolean) as M[];
    const sahipN = yol.filter(a => a.owned).length, sira = yol.find(a => !a.owned && a.gorunur !== false);
    if (yol.length) s += `<div class="mp-sec">Holding yolu <small>(${sahipN}/${yol.length} dükkân · sırayla açılır)</small></div><div class="mp-yol">` + yol.map((a, i) => {
      const ad = esc(String(a.ad || '').replace(' (AVM)', '')), avm = icOfArsa(a.id)?.bina === 'avm' ? '<i>AVM</i>' : '';
      if (a.owned) { const g = a.dgorev; return `<div class="mp-yd ok" title="${ad}"><span>${esc(a.ikon || '🏪')}</span><b>${ad}${avm}</b><small>${g ? '🎯 Görev ' + g.no + '/' + g.top + ': ' + esc(g.ad) + ' (' + g.v + '/' + g.n + ') · ödül ' + tl(g.odul) + '</small><i class="mp-yb"><i style="width:' + Math.round(g.v / g.n * 100) + '%"></i></i>' : '✓ senin · bütün görevler tamam 🏆</small>'}</div>`; }
      if (a === sira) return `<div class="mp-yd nx"><span>${esc(a.ikon || '🏪')}</span><b>${i + 1}. ${ad}${avm}</b><small>${a.kilit ? '🔒 ' + esc(a.kilit) : '🟨 Satılık: ' + tl(a.fiyat) + ' · kapısındaki kareye yürü'}</small><button class="mp-b y" data-a="yonet" data-id="${a.id}">Göster</button></div>`;
      return `<div class="mp-yd" title="${ad}"><span>🔒</span><b>${i + 1}. ${ad}${avm}</b><small>${esc(String(a.kilit || '').split(' + ')[0])}</small></div>`;
    }).join('') + '</div>';
    s += `<div class="mp-sec">Sandıklar <small>(maç, orman, mülk geliri, günlük tahta ve seviye atlayınca düşer)</small></div>`;
    const ch = SANDIKLAR.filter(x => (m.sandik[x.id] || 0) > 0);
    s += ch.length ? ch.map(x => { const key = x.anahtar ? (m.esya[x.anahtar] || 0) > 0 : true; return `<div class="mp-row"><span class="mp-ic" style="font-size:30px">${x.ikon}</span><div><b>${esc(x.ad)} ×${m.sandik[x.id]}</b><small>${tl(x.tl[0])} - ${tl(x.tl[1])} ve ${x.adet[0]}-${x.adet[1]} eşya${x.anahtar ? ' · 🗝️ Altın Anahtar ister' : ''}</small></div><button class="mp-b g" data-a="sandikAc" data-id="${x.id}"${key ? '' : ' disabled'}>Aç</button></div>`; }).join('') : '<div class="mp-note">Sandığın yok. Maç oyna, ormanda mantar topla, günlük tahtayı bitir.</div>';
    const ids = Object.keys(m.esya).filter(i => ESYA_BY_ID[i] && m.esya[i] > 0);
    s += `<div class="mp-sec">Çantan <small>(${ids.length} çeşit)</small></div>`;
    s += ids.length ? `<div class="mp-grid">${ids.map(i => itemCard(i, m.esya[i], usable(i) ? `<button class="mp-b y" data-a="kullan" data-id="${i}">Kullan</button>` : '')).join('')}</div>` : '<div class="mp-note">Çanta boş. Maç oyna, ormanda mantar topla ya da günlük tahtayı bitir.</div>';
    return s;
  }

  function banka(m: M): string {
    const b = m.banka;
    let s = `<div class="mp-row"><span class="mp-ic" style="font-size:34px">🏦</span><div><b>${esc(BANKA.ad)}</b><small>Hesabına bağlı ortak kasa: 4 karakterin de aynı parayı ve eşyayı görür. Kredi borcu ise yalnız bu karakterin.</small></div></div>`;
    if (!b.yakin) return s + `<div class="mp-note">Bankaya erişmek için binanın önüne git.<br><b>Karşı yaka</b>, meydanın doğusu: üst geçitten karşıya geç.<br>Bankadaki mal: <b>${tl(b.tl)}</b> · ${Object.values(b.esya).reduce((a: number, n: any) => a + n, 0)} eşya${(b.borc || 0) >= 1 ? `<br>Kredi borcun: <b>${tl(b.borc)}</b> / limit ${tl(b.limit || 0)} (günlük faiz %${Math.round((b.faiz || 0) * 100)} işliyor)` : ''}</div>`;
    s += `<div class="mp-sec">Para · bankada ${tl(b.tl)} · cebinde ${tl(m.money)}</div><div class="mp-row">${[1000, 10000, 100000].map(n => `<button class="mp-b" data-a="tlYatir" data-n="${n}"${m.money >= n ? '' : ' disabled'}>Yatır ${n / 1000}K</button>`).join('')}<button class="mp-b g" data-a="tlYatir" data-n="${Math.floor(m.money)}"${m.money >= 1 ? '' : ' disabled'}>Hepsini yatır</button></div>`;
    s += `<div class="mp-row">${[1000, 10000, 100000].map(n => `<button class="mp-b" data-a="tlCek" data-n="${n}"${b.tl >= n ? '' : ' disabled'}>Çek ${n / 1000}K</button>`).join('')}<button class="mp-b y" data-a="tlCek" data-n="${b.tl}"${b.tl >= 1 ? '' : ' disabled'}>Hepsini çek</button></div>`;
    s += `<div class="mp-sec">Kredi · borç ${tl(b.borc || 0)} / limit ${tl(b.limit || 0)} · günlük faiz %${Math.round((b.faiz || 0) * 100)} · birikime günlük %${((b.mevduat || 0) * 100).toFixed(1).replace('.', ',')} (en çok 200.000 ₺ ana paraya, günde bir kez)</div><div class="mp-row">${[10000, 50000].map(n => `<button class="mp-b" data-a="krediAl" data-n="${n}"${(b.limit || 0) - (b.borc || 0) >= n ? '' : ' disabled'}>Kredi çek ${n / 1000}K</button>`).join('')}<button class="mp-b" data-a="krediAl" data-n="${Math.max(0, (b.limit || 0) - (b.borc || 0))}"${(b.limit || 0) - (b.borc || 0) >= 1 ? '' : ' disabled'}>Kalan limiti çek</button><button class="mp-b" data-a="krediOde" data-n="10000"${(b.borc || 0) >= 1 && m.money >= 1 ? '' : ' disabled'}>Öde 10K</button><button class="mp-b g" data-a="krediOde" data-n="${Math.min(b.borc || 0, Math.floor(m.money))}"${(b.borc || 0) >= 1 && m.money >= 1 ? '' : ' disabled'}>Borcu öde</button></div>`;
    const all = ESYALAR.filter(e => (m.esya[e.id] || 0) > 0 || (b.esya[e.id] || 0) > 0);
    s += `<div class="mp-sec">Eşya depo</div>` + (all.length ? all.map(e => `<div class="mp-row"><span class="mp-ic">${e.ikon}</span><div><b>${esc(e.ad)}</b><small>çantada ${m.esya[e.id] || 0} · bankada ${b.esya[e.id] || 0}</small></div><button class="mp-b" data-a="esyaYatir" data-id="${e.id}" data-n="${m.esya[e.id] || 0}"${(m.esya[e.id] || 0) ? '' : ' disabled'}>Yatır</button><button class="mp-b y" data-a="esyaCek" data-id="${e.id}" data-n="${b.esya[e.id] || 0}"${(b.esya[e.id] || 0) ? '' : ' disabled'}>Çek</button></div>`).join('') : '<div class="mp-note">Depo ve çanta boş.</div>');
    return s;
  }

  /** büfe salonları (2026-11-09): equipment for the pier halls, raises the hourly salon income */
  function salon(m: M): string {
    const z = m.salon; if (!z) return '';
    if (z.stage < 6) return '<div class="mp-note">Salonlar büfe 6. aşamada (Kahvaltı salonu) açılır. Balık lokantası 7. aşamada.</div>';
    const own = new Set<string>(z.esya);
    let s = `<div class="mp-row"><span class="mp-ic" style="font-size:30px">🍽</span><div><b>Salon ve teraslar · ${z.masa ?? 0} masa</b><small>Bugün ${z.bugunMis ?? 0} misafir, ${tl(z.bugunGelir ?? 0)}. Gelir yalnız gerçek müşteriden: garson ve aşçı tut, masalar dolsun. Aletler misafiri ve adisyonu artırır.</small></div></div>`;
    for (const [k, ad, min] of [['W', '🍳 Kahvaltı salonu (batı)', 6], ['E', '🐟 Balık lokantası (doğu)', 7]] as [string, string, number][]) {
      s += `<div class="mp-sec">${ad}${z.stage < min ? ' · 🔒 ' + min + '. aşama' : ''}</div><div class="mp-grid">`;
      s += (z.liste as M[]).filter(e => e.salon === k).map(e => own.has(e.id) ? `<div class="mp-it"><span class="mp-ic">${e.ikon}</span><b>${esc(e.ad)}</b><small>✓ ${esc(e.desc)}</small></div>` : `<div class="mp-it"><span class="mp-ic">${e.ikon}</span><b>${esc(e.ad)}</b><small>${esc(e.desc)}${z.stage < e.asama ? ' · 🔒 ' + e.asama + '. aşama' : ''}</small>${z.stage < e.asama ? '' : `<small>🟨 ${tl(e.fiyat)} · salon kapısının önündeki sarı kareden</small>`}</div>`).join('') + '</div>';
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
      if (!a.owned) { const lock = !!a.kilit; s += a.sabit
        ? `<div class="mp-row"${a.id === focus ? ' style="background:#fff3c4"' : ''}><span class="mp-ic">${a.ikon || '☕'}</span><div><b>${esc(a.ad)} · satılık</b><small>${a.kilit ? '🔒 Önce: ' + esc(a.kilit) + ' · ' : ''}${tl(a.fiyat)} · ${icOfArsa(a.id)?.bina === 'avm' ? 'Martı AVM' : 'karşı yaka'}. İçeri girilir, aletleri ve menüsü kendine has. Arsa hakkından düşmez; işçi tutulur. Satın almak için dükkânın kapısının yanındaki sarı kareye bas.</small></div><span class="mp-chip">🟨 Kapıdaki kare</span></div>`
        : `<div class="mp-row"><span class="mp-ic">🏗️</span><div><b>Arsa ${a.id.toUpperCase()}</b><small>${lock ? '🔒 Önce: ' + esc(a.kilit) + ' · ' : ''}${tl(a.fiyat)}</small></div><button class="mp-b g" data-a="arsaAl" data-id="${a.id}"${lock || m.sahip >= m.hak || m.money < a.fiyat ? ' disabled' : ''}>Satın al</button></div>`; continue; }
      if (!a.tur) {
        s += `<div class="mp-row"><span class="mp-ic">🏗️</span><div><b>Arsa ${a.id.toUpperCase()} · boş</b><small>Ne kurulsun?</small></div><button class="mp-b y" data-a="kurEv" data-id="${a.id}"${m.money >= 25000 ? '' : ' disabled'}>🏠 Ev · 25.000 ₺</button><button class="mp-b y" data-a="dukPick" data-id="${a.id}">🏪 Dükkân</button></div>`;
        if (pickPlot === a.id) s += `<div class="mp-grid" style="margin-bottom:8px">${DUKKAN_TIPLERI.map(t => `<div class="mp-it"><span class="mp-ic">${t.ikon}</span><b>${esc(t.ad)}</b><small>Kurulum ${tl(t.kurulum)}${m.level < t.seviye ? ' · 🔒 ' + t.seviye + '. seviye' : ''}</small><button class="mp-b g" data-a="kurDuk" data-id="${a.id}" data-tip="${t.id}"${m.level < t.seviye || m.money < t.kurulum ? ' disabled' : ''}>Kur</button></div>`).join('')}</div>`;
        continue;
      }
      if (a.tur === 'ev') { s += `<div class="mp-row"><span class="mp-ic">🏠</span><div><b>Evin (Arsa ${a.id.toUpperCase()})</b><small>Oda, mutfak, balkon, teras, kedi köşesi. Kapıya yaklaşıp gir.</small></div><button class="mp-b g" data-a="evAc" data-id="${a.id}"${a.yakin ? '' : ' disabled'}>${a.yakin ? 'Eve gir' : 'Kapıya git'}</button></div>`; continue; }
      const t = DUKKAN_BY_ID[a.tip], y = a.yukselt;
      s += `<div class="mp-row" style="align-items:flex-start"><span class="mp-ic">${a.sabit ? a.ikon : t.ikon}</span><div><b>${a.sabit ? (a.ikon || '') + ' ' + esc(a.ad) : esc(t.ad)} · ${a.lv}. seviye${a.sabit ? ' · ' + esc(a.asamaAd || '') : '' }${a.sabit ? '' : ' (Arsa ' + a.id.toUpperCase() + ')'}</b><small>~${a.musteriSaat || Math.round(dukkanMusteri(t, a.lv) * (1 + 0.4 * a.isci))} müşteri/saat · ${a.sat} satış · kasada ${tl(a.till)}${a.isci ? ' · 👷 ' + a.isci + ' işçi (maaş gün sonunda: ' + tl(a.maasGun || 0) + ')' : ''}${a.yakin ? '' : ' (kasayı toplamak için içeri gir)'}</small></div>
${!a.sabit && a.isci < a.isciMax ? `<button class="mp-b" data-a="isciAl" data-id="${a.id}"${m.money >= a.isciFiyat ? '' : ' disabled'}>👷 İşçi tut · ${tl(a.isciFiyat)}</button>` : ''}${a.tadilat ? `<div style="flex-basis:100%"><small>🔨 Tadilat: ${esc(a.sonraki?.ad || '')} · kalan ${mmss(a.tadilat.left)}</small><div class="mp-bar"><i style="width:${Math.round((1 - a.tadilat.left / a.tadilat.total) * 100)}%"></i></div><button class="mp-b y" data-a="tadilatAtla" data-id="${a.id}"${m.gold >= a.tadilat.skipGold ? '' : ' disabled'}>⏩ Altın Simitle bitir · ${a.tadilat.skipGold}</button></div>` : y ? `${a.sabit ? `<small style="flex-basis:100%">🟨 Tadilat ${tl(y.tl)}${a.sonraki ? ' · ' + mmss(a.sonraki.sureS) : ''}: bu seviyenin aletleri bitince dükkânın önünde sarı kare çıkar</small>` : `<button class="mp-b y" data-a="yukselt" data-id="${a.id}"${m.money >= y.tl ? '' : ' disabled'}>⬆ ${tl(y.tl)}</button>`}${a.sonraki ? `<small style="flex-basis:100%">Sonraki: <b>${esc(a.sonraki.ad)}</b>${(a.sonraki.aciklar || []).length ? ' · açılır: ' + (a.sonraki.aciklar as string[]).map(esc).join(', ') : ''}${(a.menuSonraki || []).length ? ' · yeni menü' : ''}</small>` : ''}` : '<span class="mp-chip">En üst seviye</span>'}</div>`;
      if (a.sabit) {   // 2026-11-08: the café's own menu, next dishes, equipment
        const own = new Set<string>(a.kesya || []);
        s += `<div class="mp-row" style="display:block;margin-top:-4px"><small><b>Menü</b> ${(a.menu || []).map((x: { ikon: string; ad: string; fiyat: number }) => `<span class="mp-chip">${x.ikon} ${esc(x.ad)} ${tl(x.fiyat)}</span>`).join(' ')}</small>
${(a.menuSonraki || []).length ? `<small style="display:block;margin-top:4px;opacity:.75">Sonraki seviyede: ${(a.menuSonraki as { ikon: string; ad: string }[]).map(x => x.ikon + ' ' + esc(x.ad)).join(', ')}</small>` : ''}
<div class="mp-sec" style="margin:8px 0 4px">Kadro <small>(adlı, gerçek çalışanlar: kapıdan girip tezgâhta çalışır, maaş gün sonunda)</small></div>${((a.kadro || []) as { id: number; ad: string; rolAd: string; huyAd: string }[]).map(c => `<div class="mp-row" style="margin-bottom:4px"><span class="mp-ic">👷</span><div><b>${esc(c.ad)}</b><small>${esc(c.rolAd)}${c.huyAd ? ' · ' + esc(c.huyAd) : ''}</small></div><button class="mp-b r" data-a="kov" data-id="${a.id}" data-n="${c.id}">Kov</button></div>`).join('') || '<small style="display:block;opacity:.75">Henüz kimse yok. İlan panosundan birini işe al.</small>'}
${a.isci < a.isciMax ? `<div class="mp-sec" style="margin:8px 0 4px">İlan panosu <small>(3 aday)</small> <button class="mp-b" data-a="ilanYenile" data-id="${a.id}"${m.money >= 2000 ? '' : ' disabled'}>Yenile · ${tl(2000)}</button></div><div class="mp-grid">${((a.ilan || []) as { id: string; ad: string; rolAd: string; huyAd: string; about: string; fiyat: number }[]).map(k => `<div class="mp-it"><span class="mp-ic">🧑</span><b>${esc(k.ad)}</b><small>${esc(k.rolAd)}${k.huyAd ? ' · ' + esc(k.huyAd) : ''}<br>${esc(k.about)}</small><button class="mp-b g" data-a="ilanAl" data-id="${a.id}" data-e="${k.id}"${m.money >= k.fiyat ? '' : ' disabled'}>İşe al · ${tl(k.fiyat)}</button></div>`).join('')}</div>` : '<small style="display:block;opacity:.75">Kadro dolu (' + a.isci + '/' + a.isciMax + '). İşletmeyi yükseltince yeni kişi alınır.</small>'}
<div class="mp-sec" style="margin:8px 0 4px">Aletler <small>(alınca içeride görünür)</small></div><div class="mp-grid" style="margin-top:6px">${(a.aletler as M[]).map(e => own.has(e.id) ? `<div class="mp-it"><span class="mp-ic">${e.ikon}</span><b>${esc(e.ad)}</b><small>✓ ${esc(e.desc)}</small></div>` : `<div class="mp-it"><span class="mp-ic">${e.ikon}</span><b>${esc(e.ad)}</b><small>${esc(e.desc)}${a.lv < e.lv ? ' · 🔒 ' + e.lv + '. seviye' : ''}</small>${a.lv < e.lv ? '' : `<small>🟨 ${tl(e.fiyat)} · ${icOfArsa(a.id)?.bina === 'avm' ? 'dükkândaki' : 'kapının önündeki'} sarı kareden</small>`}</div>`).join('')}</div>
<div class="mp-sec" style="margin:8px 0 4px">Tema <small>(ilki bedava, sonra 15.000 ₺) · tezgahtaki makinenin önünde dur: kahveyi sen yaparsın</small></div><div>${[['retro', 'Retro'], ['modern', 'Modern'], ['bohem', 'Bohem'], ['deniz', 'Deniz']].map(([k, ad]) => `<button class="mp-b${a.tema === k ? ' g' : ''}" data-a="tema" data-id="${a.id}" data-e="${k}"${a.tema === k ? ' disabled' : ''}>${a.tema === k ? '✓ ' : ''}${ad}</button>`).join('')}</div>
<small style="display:block;margin-top:4px">👷 İşçi ${a.isci}/${a.isciMax} (seviye arttıkça daha çok işçi çalışır)</small></div>`;
      }
    }
    return s;
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
    let h = `<div class="mp-row"><span class="mp-ic" style="font-size:34px">🛍</span><div><b>Martı AVM</b><small>Giyim ve bakım ürünleri karakter dolabına girer (parfüm yalnız tecrübe verir); sinema ve eğlence tecrübe verir.</small></div></div>`;
    if (!a.yakin) h += '<div class="mp-note">Alışveriş için karşı yakadaki Martı AVM\'ye gir.</div>';
    for (const [k, ad] of [['giyim', 'Giyim'], ['kozmetik', 'Kozmetik'], ['sinema', 'Sinema'], ['eglence', 'Eğlence']]) {
      h += `<div class="mp-sec">${ad}</div><div class="mp-grid">` + (a.urun as M[]).filter(u => u.kat === k).map(u => `<div class="mp-it"><span class="mp-ic">${u.ikon}</span><b>${esc(u.ad)}</b><small>${esc(u.desc)}</small>${own.has(u.id) ? '<small>✓ dolapta</small>' : `<button class="mp-b g" data-a="avmAl" data-id="${u.id}"${a.yakin && m.money >= u.fiyat ? '' : ' disabled'}>${tl(u.fiyat)}</button>`}</div>`).join('') + '</div>';
    }
    return h;
  }
  function okul(m: M): string {
    const o = m.okul as M;
    let h = `<div class="mp-row"><span class="mp-ic" style="font-size:34px">📚</span><div><b>İngilizce dersi · genel puan ${o.genel}/100</b><small>Her ${o.sinav} cevap bir sınav. Günde ${o.gunluk} sınav para ve tecrübe verir (bugün ${o.bugun}/${o.gunluk}), sonrası deneme. Ortalaması genel puanın.</small></div></div>`;
    if (!o.yakin) return h + '<div class="mp-note">Ders sınıfta: karşı yakadaki okula gir, sıraların olduğu tarafa geç.</div>';
    if (!o.soru) return h + '<div class="mp-row"><button class="mp-b g" data-a="dersBasla">Derse başla</button></div>';
    if (o.son) h += `<div class="mp-note">${esc(o.son)}</div>`;
    h += `<div class="mp-sec">Soru ${o.cevap + 1}/${o.sinav} · doğru ${o.dogru} — "<b>${esc(o.soru)}</b>" İngilizcesi ne?</div><div class="mp-grid">${(o.secenek as string[]).map((s, i) => `<button class="mp-b" data-a="dersCevap" data-n="${i}">${esc(s)}</button>`).join('')}</div>`;
    if ((o.sinavlar as number[]).length) h += `<small style="display:block;margin-top:6px">Son sınavlar: ${(o.sinavlar as number[]).slice(-6).join(', ')}</small>`;
    return h;
  }
  const TABS: [Tab, string][] = [['envanter', '🎒 Envanter'], ['banka', '🏦 Banka'], ['gunluk', '📋 Günlük'], ['mulk', '🏠 Mülk'], ['defter', '📓 Defter'], ['salon', '🍽 Salon'], ['okul', '📚 Okul'], ['avm', '🛍 AVM']];
  function paint(m: M) {
    const body = tab === 'envanter' ? envanter(m) : tab === 'banka' ? banka(m) : tab === 'gunluk' ? gunluk(m) : tab === 'mulk' ? mulk(m) : tab === 'defter' ? defter(m) : tab === 'salon' ? salon(m) : tab === 'okul' ? okul(m) : avm(m);
    const sc = (bg.querySelector('.mp-body') as HTMLElement | null)?.scrollTop || 0, tsc = (bg.querySelector('.mp-tabs') as HTMLElement | null)?.scrollLeft || 0;
    bg.innerHTML = `<div class="mp-card"><div class="mp-top"><h2>${TABS.find(x => x[0] === tab)![1]}</h2><span class="mp-chip">${tl(m.money)}</span><span class="mp-chip">🥨 ${m.gold}</span><button class="mp-x" data-a="close">✕</button></div>
<div class="mp-tabs">${TABS.map(([k, l]) => `<button class="mp-t${tab === k ? ' on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div class="mp-body">${body}</div></div>`;
    (bg.querySelector('.mp-body') as HTMLElement).scrollTop = sc;
    // etkin sekme şeritte görünür kalsın, taşma ipucu (solma) çıksın
    const tb = bg.querySelector('.mp-tabs') as HTMLElement; tb.scrollLeft = tsc;
    const on = tb.querySelector('.mp-t.on') as HTMLElement | null;
    if (on && (on.offsetLeft < tb.scrollLeft || on.offsetLeft + on.offsetWidth > tb.scrollLeft + tb.clientWidth)) tb.scrollLeft = Math.max(0, on.offsetLeft - (tb.clientWidth - on.offsetWidth) / 2);
    const fade = () => { tb.classList.toggle('ml', tb.scrollLeft > 2); tb.classList.toggle('mr', tb.scrollLeft + tb.clientWidth < tb.scrollWidth - 2); };
    tb.addEventListener('scroll', fade, { passive: true }); fade();
  }

  bg.addEventListener('pointerdown', e => e.stopPropagation());
  bg.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
  for (const ev of ['keydown', 'keyup'] as const) bg.addEventListener(ev, e => e.stopPropagation());
  bg.addEventListener('click', e => {
    if (e.target === bg) { api.close(); return; }
    const el = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!el || el.disabled) return;
    if (el.dataset.tab) { tab = el.dataset.tab as Tab; key = ''; t = 0; return; }
    const a = el.dataset.a, id = el.dataset.id, n = Number(el.dataset.n) || 0;
    if (a === 'close') { api.close(); return; }
    if (a === 'yonet') { tab = 'mulk'; focus = id || ''; key = ''; t = 0; return; }
    if (a === 'dukPick') { pickPlot = pickPlot === id ? '' : id!; key = ''; t = 0; return; }
    if (a === 'kurEv') { cmd({ op: 'arsaKur', id, tur: 'ev' }); return; }
    if (a === 'kurDuk') { pickPlot = ''; cmd({ op: 'arsaKur', id, tur: 'dukkan', tip: el.dataset.tip }); return; }
    if (a === 'evAc') { cmd({ op: 'evAc', id }); api.close(); return; }
    if (a === 'tadilatAtla') { cmd({ op: 'tadilatAtla', id }); return; }
    if (a === 'ilanAl') { cmd({ op: 'ilanAl', id, e: el.dataset.e }); return; }
    if (a === 'ilanYenile') { cmd({ op: 'ilanYenile', id }); return; }
    if (a === 'kov') { cmd({ op: 'kov', id, n }); return; }
    if (a === 'kafeEsya') { cmd({ op: 'kafeEsya', id, e: el.dataset.e }); return; }
    if (a === 'tema') { cmd({ op: 'tema', id, e: el.dataset.e }); return; }
    if (a === 'salonEsya') { cmd({ op: 'salonEsya', e: el.dataset.e }); return; }
    if (a) cmd({ op: a, id, n });
  });

  const api: MulkPanel = {
    open(t0) { if (t0 === 'stadyum' || t0 === 'lig') { kd.open(t0 === 'lig' ? 'lig' : 'mac'); return; } if (t0) tab = t0; openNow = true; bg.classList.add('on'); key = ''; },
    close() { openNow = false; bg.classList.remove('on'); kd.close(); },
    update(dt) {
      kd.update(dt);
      t -= dt; if (t > 0) return; t = 0.25;
      const m = mulkApi(d.rules() as never); if (!m) return;
      const v = m.view();
      // contextual hint at the bank door / a plot door / the stadium gate
      if ((v as { kirtasiye?: unknown }).kirtasiye) { hint.style.display = 'none'; hintTab = null; return; }   // first-person counter has its own UI
      const ktHint = !!(v as { ktYakin?: boolean }).ktYakin;
      // 2026-11-20: every AVM room is a business of its own: an unsold one offers itself first, an owned one the mall shopping
      const avmSatilik = !!v.avmYakin && !!v.arsaYakin && !(m.model().arsa as M[]).find(x => x.id === v.arsaYakin)?.owned;
      const ht: OpenTab | null = ktHint ? 'mulk' : v.ipucuYakin ? 'defter' : v.okulYakin ? 'okul' : v.avmYakin && !avmSatilik ? 'avm' : v.stadyumYakin ? 'stadyum' : v.bankaYakin ? 'banka' : v.arsaYakin ? 'mulk' : v.salonYakin ? 'salon' : null;
      const fa = v.arsaYakin ? (m.model().arsa as M[]).find(x => x.id === v.arsaYakin) : null; if (fa) focus = fa.id;
      const lbl = ktHint ? '✏️ Tezgaha geç (birinci şahıs)' : ht === 'defter' ? '🔍 İncele' : ht === 'stadyum' ? '🧢 Koordinatörle konuş' : ht === 'banka' ? '🏦 Gişe: bankayı aç' : ht === 'salon' ? '🍽 Salon bilgisi' : ht === 'okul' ? '📚 İngilizce dersi / sınav' : ht === 'avm' ? '🛍 AVM: alışveriş, sinema' : ht === 'mulk' ? (fa && fa.sabit ? (fa.ikon || '🏪') + ' ' + fa.ad + (fa.owned ? ': işçi ve bilgi' : ': bilgi (satın almak için sarı kare)') : '🏠 Arsa / Dükkân') : '';
      ktMode = ktHint;
      if (ht !== hintTab || hint.textContent !== lbl) { hintTab = ht; hint.style.display = ht && !openNow && !kd.isOpen() ? 'block' : 'none'; hint.textContent = lbl; }
      else if (hintTab) hint.style.display = openNow || kd.isOpen() ? 'none' : 'block';
      if (!openNow) return;
      const mod = m.model(); const k2 = tab + '|' + pickPlot + '|' + JSON.stringify(mod);
      if (k2 !== key) { key = k2; paint(mod); }
    },
    dispose() { kd.dispose(); st.remove(); bg.remove(); hint.remove(); },
  };
  hint.onclick = () => { if (ktMode) { d.command({ kind: 'mulk', op: 'ktAc' } as never); return; } if (hintTab === 'defter') d.command({ kind: 'gizem', op: 'oku' } as never); if (hintTab) api.open(hintTab); };
  return api;
}
