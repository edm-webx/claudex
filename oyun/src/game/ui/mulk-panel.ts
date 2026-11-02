// Envanter / Banka / Günlük / Mülk / Stadyum paneli (karar paketi G: alt bar Envanter + Mülk, her buton gerçek iş yapar).
// View only: reads rt.mulk (sim/mulk.ts) and sends { kind: 'mulk', ... }. A floating hint button appears at the bank door, a plot
// door or the stadium gate and opens the right tab.
import { mulkApi } from '../sim/mulk';
import { ESYALAR, ESYA_BY_ID, SANDIKLAR, TARIFLER, DUKKAN_TIPLERI, DUKKAN_BY_ID, DUKKAN_STOK_MAX, dukkanMusteri, BANKA } from '../../content/esya';

interface Deps { root: HTMLElement; rules: () => { rt: unknown } | null; command(c: { kind: string; [k: string]: unknown }): void; sfx?(id: string): void }
export interface MulkPanel { update(dt: number): void; open(tab?: Tab): void; close(): void; dispose(): void }
type Tab = 'envanter' | 'banka' | 'gunluk' | 'mulk' | 'stadyum' | 'lig' | 'defter';

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
  let tab: Tab = 'envanter', key = '', openNow = false, t = 0, hintTab: Tab | null = null, pickPlot = '', pickTip = '';
  const cmd = (c: Record<string, unknown>) => { d.command({ kind: 'mulk', ...c }); try { d.sfx?.('pick'); } catch { /* */ } key = ''; };

  const itemCard = (id: string, n: number, acts = '') => { const e = ESYA_BY_ID[id]; if (!e) return ''; return `<div class="mp-it r${e.nadir}"><span class="mp-ic">${e.ikon}</span><b>${esc(e.ad)}</b><small>${esc(e.blurb)}</small><span class="mp-n">×${n}</span>${acts}</div>`; };
  const usable = (id: string) => ['bozuk_kese', 'tecrube_simit', 'sans_simidi', 'altin_kupon'].includes(id);

  function envanter(m: M): string {
    let s = '';
    if (m.son) s += `<div class="mp-son">Son sandık: <b>${esc(m.son.sandik)}</b> · +${tl(m.son.tl)}${m.son.esya.length ? ' · ' + m.son.esya.map((i: string) => (ESYA_BY_ID[i]?.ikon || '') + ' ' + esc(ESYA_BY_ID[i]?.ad || i)).join(', ') : ''}</div>`;
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
    if (!b.yakin) return s + `<div class="mp-note">Bankaya erişmek için binanın önüne git.<br><b>Mahalle Meydanı</b>, çeşmenin batısı. Haritadan 42B durağına, oradan yürüyerek.<br>Bankadaki mal: <b>${tl(b.tl)}</b> · ${Object.values(b.esya).reduce((a: number, n: any) => a + n, 0)} eşya</div>`;
    s += `<div class="mp-sec">Para · bankada ${tl(b.tl)} · cebinde ${tl(m.money)}</div><div class="mp-row">${[1000, 10000, 100000].map(n => `<button class="mp-b" data-a="tlYatir" data-n="${n}"${m.money >= n ? '' : ' disabled'}>Yatır ${n / 1000}K</button>`).join('')}<button class="mp-b g" data-a="tlYatir" data-n="${Math.floor(m.money)}"${m.money >= 1 ? '' : ' disabled'}>Hepsini yatır</button></div>`;
    s += `<div class="mp-row">${[1000, 10000, 100000].map(n => `<button class="mp-b" data-a="tlCek" data-n="${n}"${b.tl >= n ? '' : ' disabled'}>Çek ${n / 1000}K</button>`).join('')}<button class="mp-b y" data-a="tlCek" data-n="${b.tl}"${b.tl >= 1 ? '' : ' disabled'}>Hepsini çek</button></div>`;
    const all = ESYALAR.filter(e => (m.esya[e.id] || 0) > 0 || (b.esya[e.id] || 0) > 0);
    s += `<div class="mp-sec">Eşya depo</div>` + (all.length ? all.map(e => `<div class="mp-row"><span class="mp-ic">${e.ikon}</span><div><b>${esc(e.ad)}</b><small>çantada ${m.esya[e.id] || 0} · bankada ${b.esya[e.id] || 0}</small></div><button class="mp-b" data-a="esyaYatir" data-id="${e.id}" data-n="${m.esya[e.id] || 0}"${(m.esya[e.id] || 0) ? '' : ' disabled'}>Yatır</button><button class="mp-b y" data-a="esyaCek" data-id="${e.id}" data-n="${b.esya[e.id] || 0}"${(b.esya[e.id] || 0) ? '' : ' disabled'}>Çek</button></div>`).join('') : '<div class="mp-note">Depo ve çanta boş.</div>');
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
    for (const a of m.arsa) {
      if (!a.owned) { const lock = m.level < a.seviye; s += `<div class="mp-row"><span class="mp-ic">🏗️</span><div><b>Arsa ${a.id.toUpperCase()}</b><small>${lock ? '🔒 ' + a.seviye + '. seviyede açılır · ' : ''}${tl(a.fiyat)}</small></div><button class="mp-b g" data-a="arsaAl" data-id="${a.id}"${lock || m.sahip >= m.hak || m.money < a.fiyat ? ' disabled' : ''}>Satın al</button></div>`; continue; }
      if (!a.tur) {
        s += `<div class="mp-row"><span class="mp-ic">🏗️</span><div><b>Arsa ${a.id.toUpperCase()} · boş</b><small>Ne kurulsun?</small></div><button class="mp-b y" data-a="kurEv" data-id="${a.id}"${m.money >= 25000 ? '' : ' disabled'}>🏠 Ev · 25.000 ₺</button><button class="mp-b y" data-a="dukPick" data-id="${a.id}">🏪 Dükkân</button></div>`;
        if (pickPlot === a.id) s += `<div class="mp-grid" style="margin-bottom:8px">${DUKKAN_TIPLERI.map(t => `<div class="mp-it"><span class="mp-ic">${t.ikon}</span><b>${esc(t.ad)}</b><small>Kurulum ${tl(t.kurulum)}${m.level < t.seviye ? ' · 🔒 ' + t.seviye + '. seviye' : ''}</small><button class="mp-b g" data-a="kurDuk" data-id="${a.id}" data-tip="${t.id}"${m.level < t.seviye || m.money < t.kurulum ? ' disabled' : ''}>Kur</button></div>`).join('')}</div>`;
        continue;
      }
      if (a.tur === 'ev') { s += `<div class="mp-row"><span class="mp-ic">🏠</span><div><b>Evin (Arsa ${a.id.toUpperCase()})</b><small>Oda, mutfak, balkon, teras, kedi köşesi. Kapıya yaklaşıp gir.</small></div><button class="mp-b g" data-a="evAc" data-id="${a.id}"${a.yakin ? '' : ' disabled'}>${a.yakin ? 'Eve gir' : 'Kapıya git'}</button></div>`; continue; }
      const t = DUKKAN_BY_ID[a.tip], y = a.yukselt;
      s += `<div class="mp-row" style="align-items:flex-start"><span class="mp-ic">${t.ikon}</span><div><b>${esc(t.ad)} · ${a.lv}. seviye (Arsa ${a.id.toUpperCase()})</b><small>Stok ${a.stok}/${a.stokMax} · ~${Math.round(dukkanMusteri(t, a.lv))} müşteri/saat · ${a.sat} satış · kasada ${tl(a.till)}${a.yakin ? '' : ' (kasayı toplamak için kapıya git)'}</small><div class="mp-bar"><i style="width:${a.stokMax ? a.stok / a.stokMax * 100 : 0}%"></i></div></div>
<button class="mp-b" data-a="stokAl" data-id="${a.id}" data-n="10"${m.money >= t.maliyet * 10 ? '' : ' disabled'}>+10 stok · ${tl(t.maliyet * 10)}</button><button class="mp-b" data-a="stokAl" data-id="${a.id}" data-n="50"${m.money >= t.maliyet * 10 ? '' : ' disabled'}>+50</button>
${y ? `<button class="mp-b y" data-a="yukselt" data-id="${a.id}"${Object.entries(y.esya).every(([k, v]) => (m.esya[k] || 0) >= (v as number)) && m.money >= y.tl ? '' : ' disabled'}>⬆ ${tl(y.tl)} + ${Object.entries(y.esya).map(([k, v]) => v + ' ' + esc(ESYA_BY_ID[k].ad)).join(' + ')}</button>` : '<span class="mp-chip">En üst seviye</span>'}</div>`;
    }
    void DUKKAN_STOK_MAX;
    return s;
  }

  const CLUB_COL = ['#e0533c', '#f2c230', '#2ec4c4', '#3a6fb0', '#1f8a70', '#a990dd', '#2b2b38', '#f4f4f4'], CLUB_ARMA = ['🦅', '🐟', '🦁', '⭐', '⚓', '🔥', '🐈', '🥙'];
  const club = { c1: '#e0533c', c2: '#f2c230', arma: '🦅' };
  function stadyum(m: M): string {
    const s = m.stadyum;
    let h = `<div class="mp-row"><span class="mp-ic" style="font-size:34px">⚽</span><div><b>Martı Arena</b><small>Stadyum kapısında bilet al, halı sahada maç yap. Galibiyet sandık getirir.</small></div></div>`;
    if (!s.yakin) h += `<div class="mp-note">Stadyum Mahallesi'ne 42B ile git (harita > Stadyum).</div>`;
    h += `<div class="mp-row"><span class="mp-ic">🎟️</span><div><b>Anlık maç · bilet ${tl(s.bilet)}</b><small>Kimse yoksa rakip yapay zeka. 2 yarı.</small></div><button class="mp-b g" data-a="bilet"${s.yakin && m.money >= s.bilet ? '' : ' disabled'}>Bilet al</button></div>`;
    if (m.takim) h += `<div class="mp-row"><span class="mp-ic" style="background:${m.takim.renk};border-radius:12px">${m.takim.arma || '🛡️'}</span><div><b>Kulübün: ${esc(m.takim.ad)}</b><small>Kuruluş: gün ${m.takim.kurulus ?? '?'} · Lig sekmesinde puan durumu ve istatistik.</small></div></div>`;
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

  const TABS: [Tab, string][] = [['envanter', '🎒 Envanter'], ['banka', '🏦 Banka'], ['gunluk', '📋 Günlük'], ['mulk', '🏠 Mülk'], ['stadyum', '⚽ Stadyum'], ['lig', '🏆 Lig'], ['defter', '📓 Defter']];
  function paint(m: M) {
    const body = tab === 'envanter' ? envanter(m) : tab === 'banka' ? banka(m) : tab === 'gunluk' ? gunluk(m) : tab === 'mulk' ? mulk(m) : tab === 'lig' ? lig(m) : tab === 'defter' ? defter(m) : stadyum(m);
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
    if (a === 'bilet') { cmd({ op: 'bilet' }); api.close(); return; }
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
      const ht: Tab | null = v.ipucuYakin ? 'defter' : v.stadyumYakin ? 'stadyum' : v.bankaYakin ? 'banka' : v.arsaYakin ? 'mulk' : null;
      if (ht !== hintTab) { hintTab = ht; hint.style.display = ht && !openNow ? 'block' : 'none'; hint.textContent = ht === 'defter' ? '🔍 İncele' : ht === 'stadyum' ? '🎟️ Stadyum: bilet ve takım' : ht === 'banka' ? '🏦 Bankayı aç' : ht === 'mulk' ? '🏠 Arsa / Dükkân' : ''; }
      else if (hintTab) hint.style.display = openNow ? 'none' : 'block';
      if (!openNow) return;
      const mod = m.model(); const k2 = tab + '|' + pickPlot + '|' + JSON.stringify(mod);
      if (k2 !== key) { key = k2; paint(mod); }
    },
    dispose() { st.remove(); bg.remove(); hint.remove(); },
  };
  hint.onclick = () => { if (hintTab === 'defter') d.command({ kind: 'gizem', op: 'oku' } as never); if (hintTab) api.open(hintTab); };
  return api;
}
