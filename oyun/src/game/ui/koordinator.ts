// Maç Koordinatörü kartı (FUT-11/12/13/14/17): halı sahanın önündeki koordinatörle konuşunca açılan diegetic kart.
// Futbol işleri (bilet, kulüp kur, sahaya çık, lig, çetele, kadro/formasyon, tribünden izle) envanter/mülk panelinde DEĞİL, burada.
// View only: reads rt.mulk model (sim/mulk.ts; .lig comes from sim/lig.ts) and sends { kind: 'mulk', op: bilet | takim | biletFiyat | formasyon | izle }.
import { FORMATIONS } from '../sim/macmotor';
import { mulkApi } from '../sim/mulk';
import { BAHIS, BAHIS_ARALIK, ODULLU_MAC_GUNLUK } from '../sim/halisaha';
const fx = (v: number) => v.toFixed(2).replace('.', ',');
import { KADRO } from '../sim/stadyum';

interface Deps { root: HTMLElement; rules: () => { rt: unknown } | null; command(c: { kind: string; [k: string]: unknown }): void; sfx?(id: string): void }
export type KoordinatorSayfa = 'mac' | 'lig' | 'cetele' | 'kadro' | 'tribun';
export interface Koordinator { open(sayfa?: KoordinatorSayfa): void; close(): void; isOpen(): boolean; update(dt: number): void; dispose(): void }
type M = Record<string, any>;

const CSS = `
.kd-bg{position:fixed;inset:0;z-index:63;display:none;align-items:center;justify-content:center;background:rgba(28,18,14,.62);padding:10px;pointer-events:auto;font-family:var(--body)}
.kd-bg.on{display:flex}
.kd-card{width:min(680px,100%);max-height:calc(100vh - 20px);max-height:calc(100dvh - 20px);display:flex;flex-direction:column;background:#fdf3e1;color:#2b1d15;border:4px solid #3b2a20;border-radius:22px;box-shadow:0 8px 0 #3b2a20;overflow:hidden}
.kd-top{flex:none;display:flex;align-items:center;gap:10px;padding:12px 14px 6px}.kd-top h2{flex:1;margin:0;font:900 22px/1.1 var(--disp)}
.kd-av{width:52px;height:52px;border-radius:50%;border:3px solid #3b2a20;background:#ffd23f;display:grid;place-items:center;font-size:30px;flex:none}
.kd-chip{font:900 15px var(--disp);background:#fff;border:3px solid #3b2a20;border-radius:12px;padding:3px 10px;white-space:nowrap}
.kd-x{min-height:46px;min-width:46px;border:3px solid #3b2a20;border-radius:12px;background:#ffd23f;font:900 20px var(--disp);color:#2b1d15;cursor:pointer}
.kd-say{flex:none;margin:0 14px 8px;border:3px solid #3b2a20;border-radius:16px;background:#fff;padding:9px 13px;font:800 16px/1.4 var(--body);position:relative}
.kd-tabs{flex:none;display:flex;gap:6px;padding:0 14px 8px;overflow-x:auto;scrollbar-width:none}
.kd-t{flex:none;min-height:46px;padding:0 14px;border:3px solid #3b2a20;border-radius:12px;background:#fff6e6;font:900 16px var(--disp);color:#2b1d15;cursor:pointer}.kd-t.on{background:#ffd23f}
.kd-body{overflow-y:auto;padding:4px 14px 16px;flex:1}
.kd-h{font:900 17px var(--disp);margin:14px 0 6px}
.kd-row{display:flex;align-items:center;gap:10px;border:3px solid #3b2a20;border-radius:14px;background:#fff;padding:10px 12px;margin-bottom:8px;flex-wrap:wrap}
.kd-row>div{flex:1;min-width:150px}.kd-row b{font:900 17px/1.2 var(--disp)}.kd-row small{display:block;font:700 15px/1.35 var(--body);margin-top:2px}
.kd-ic{font-size:30px;line-height:1}
.kd-b{min-height:46px;padding:0 16px;border:3px solid #3b2a20;border-radius:12px;background:#fff6e6;font:900 16px var(--disp);color:#2b1d15;cursor:pointer;box-shadow:0 3px 0 #3b2a20}
.kd-b.g{background:#8fd06b}.kd-b.y{background:#ffd23f}.kd-b:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
.kd-note{border:3px dashed #3b2a20;border-radius:14px;padding:11px 13px;font:800 16px/1.4 var(--body);background:#fff6e6;margin-bottom:8px}
.kd-uyari{border:3px solid #8a1f12;background:#ffd9d2;color:#5a0f06;border-radius:14px;padding:10px 13px;font:900 16px/1.35 var(--body);margin-bottom:8px}
.kd-tbl{width:100%;border-collapse:collapse;font:700 16px/1.3 var(--body);background:#fff;border:3px solid #3b2a20;border-radius:12px;overflow:hidden}
.kd-tbl th{font:900 14px var(--disp);text-align:center;background:#3b2a20;color:#fff;padding:5px 4px}.kd-tbl th:nth-child(1),.kd-tbl td:nth-child(1){text-align:left;padding-left:8px}
.kd-tbl td{padding:7px 4px;text-align:center;border-top:1px solid #e0d2b8}.kd-tbl td:nth-child(1){max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kd-tbl tr.ben td{font-weight:900;box-shadow:inset 0 0 0 9999px rgba(255,210,63,.45)}
.kd-tbl tr.yuksel td{background:#d4f2c4}.kd-tbl tr.dus td{background:#ffd3cb}
.kd-tag{display:inline-block;font:900 12px var(--disp);border-radius:8px;padding:1px 6px;margin-left:6px;border:2px solid #3b2a20;background:#fff}
.kd-dot{display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid #3b2a20;margin-right:6px;vertical-align:-1px}
.kd-form{display:flex;gap:5px;margin-top:4px}.kd-form i{width:30px;height:30px;border-radius:8px;border:3px solid #3b2a20;display:grid;place-items:center;font:900 15px var(--disp);font-style:normal}
.kd-in{box-sizing:border-box;width:100%;min-height:48px;border:3px solid #3b2a20;border-radius:11px;padding:4px 12px;font:800 18px var(--body);background:#fff;color:#2b1d15;margin:6px 0}
.kd-pk{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:8px 0;font:800 15px var(--body)}.kd-pk>span{min-width:86px}
.kd-sw{width:36px;height:36px;border-radius:50%;border:3px solid #3b2a20;cursor:pointer;padding:0;font-size:18px;background:#fff6e6}.kd-sw.wide{border-radius:10px}.kd-sw.on{outline:4px solid #ffd23f;outline-offset:1px}
.kd-bar{height:16px;border-radius:8px;background:#e7d9bf;border:3px solid #3b2a20;overflow:hidden;margin-top:5px}.kd-bar i{display:block;height:100%;background:#8fd06b}
.kd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
.kd-st{border:3px solid #3b2a20;border-radius:12px;background:#fff;padding:7px 10px;font:700 14px/1.3 var(--body)}.kd-st b{display:block;font:900 20px var(--disp)}
.kd-fix{display:grid;grid-template-columns:auto 1fr auto;gap:4px 10px;align-items:center;border:3px solid #3b2a20;border-radius:12px;background:#fff;padding:7px 11px;margin-bottom:6px;font:700 16px/1.3 var(--body)}
.kd-fix.ben{background:#ffefb0;font-weight:900}
.kd-pitch{width:100%;max-width:420px;display:block;margin:6px auto;border:3px solid #3b2a20;border-radius:12px;background:#4f9a4a}
.kd-sq{display:flex;align-items:center;gap:10px;border:3px solid #3b2a20;border-radius:12px;background:#fff;padding:7px 10px;margin-bottom:6px}.kd-sq.ben{background:#ffefb0}
.kd-sq i{width:36px;height:36px;border-radius:50%;border:3px solid #3b2a20;display:grid;place-items:center;font:900 16px var(--disp);font-style:normal;flex:none}
.kd-sq small{display:block;font:700 14px/1.3 var(--body)}
.kd-gb{display:flex;align-items:center;gap:8px;margin:3px 0;font:700 15px var(--body)}.kd-gb u{flex:none;width:110px;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kd-gb s{display:block;height:14px;border-radius:7px;background:#e8a317;border:2px solid #3b2a20;text-decoration:none}
@media (max-width:520px){.kd-top h2{font-size:19px}.kd-tbl{font-size:15px}.kd-tbl td:nth-child(1){max-width:120px}}
`;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const tl = (n: number) => Math.round(n || 0).toLocaleString('tr') + ' ₺';
const COL = ['#e0533c', '#f2c230', '#2ec4c4', '#3a6fb0', '#1f8a70', '#a990dd', '#2b2b38', '#f4f4f4'], ARMA = ['🦅', '🐟', '🦁', '⭐', '⚓', '🔥', '🐈', '🥙'];
const ROL: Record<string, string> = { GK: 'Kaleci', DEF: 'Savunma', MID: 'Orta saha', FWD: 'Forvet' }, ROL_K: Record<string, string> = { GK: 'K', DEF: 'D', MID: 'O', FWD: 'F' };
const TABS: [KoordinatorSayfa, string][] = [['mac', '🎟️ Maç'], ['lig', '🏆 Lig'], ['cetele', '📒 Çetele'], ['kadro', '👕 Kadro'], ['tribun', '📣 Tribün']];
/** Text color that stays readable on a given hex background. */
const okunur = (hex: string) => { const n = parseInt(hex.slice(1), 16) || 0, l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); return l > 150 ? '#2b1d15' : '#fff'; };
const flama = (c1: string, c2: string, w = 96) => `<svg width="${w}" height="${Math.round(w * 0.5)}" viewBox="0 0 96 48" aria-label="flama"><polygon points="2,4 94,24 2,44" fill="${c1}" stroke="#3b2a20" stroke-width="3" stroke-linejoin="round"/><polygon points="2,4 48,14 48,34 2,44" fill="${c2}"/><polygon points="2,4 94,24 2,44" fill="none" stroke="#3b2a20" stroke-width="3" stroke-linejoin="round"/></svg>`;

/** Mini pitch with the formation's dots (own goal on the left, attack to the right). */
function minisaha(f: string, c1: string): string {
  const fm = FORMATIONS[f] || FORMATIONS['2-2'];
  let s = `<svg class="kd-pitch" viewBox="0 0 200 100" role="img" aria-label="${esc(f)} dizilişi"><rect x="3" y="3" width="194" height="94" fill="none" stroke="#e8f5e1" stroke-width="1.6"/><line x1="100" y1="3" x2="100" y2="97" stroke="#e8f5e1" stroke-width="1.4"/><circle cx="100" cy="50" r="13" fill="none" stroke="#e8f5e1" stroke-width="1.4"/><rect x="3" y="30" width="22" height="40" fill="none" stroke="#e8f5e1" stroke-width="1.4"/><rect x="175" y="30" width="22" height="40" fill="none" stroke="#e8f5e1" stroke-width="1.4"/>`;
  fm.forEach((p, i) => { const x = 8 + p.x * 184, y = 8 + p.y * 84, ben = KADRO[i]?.no === 10, gk = p.role === 'GK'; s += `<g><circle cx="${x}" cy="${y}" r="${ben ? 9 : 8}" fill="${gk ? '#f2c230' : c1}" stroke="${ben ? '#ffffff' : '#2b1d15'}" stroke-width="${ben ? 2.6 : 1.8}"/><text x="${x}" y="${y + 3.6}" text-anchor="middle" font-size="9.5" font-weight="900" fill="${gk ? '#2b1d15' : okunur(c1)}" font-family="sans-serif">${ROL_K[p.role]}</text></g>`; });
  return s + '</svg>';
}

export function createKoordinator(d: Deps): Koordinator {
  const st = document.createElement('style'); st.textContent = CSS; d.root.appendChild(st);
  const bg = document.createElement('div'); bg.className = 'kd-bg'; d.root.appendChild(bg);
  let sayfa: KoordinatorSayfa = 'mac', key = '', acik = false, t = 0, basa = false;
  const club = { ad: '', c1: COL[0], c2: COL[1], arma: ARMA[0] }, bet = { k: '1', n: 500 };
  const cmd = (c: Record<string, unknown>) => { d.command({ kind: 'mulk', ...c }); try { d.sfx?.('tik'); } catch { /* */ } key = ''; t = 0; };

  const lbl = (ok: boolean) => (ok ? '' : ' disabled');
  const konus = (m: M): string => {
    const l = m.lig as M | null;
    if (!m.stadyum.yakin) return 'Beni karşı yakada, halı sahanın önünde bulursun. Gel yanıma, konuşalım.';
    if (!m.takim) return 'Hoş geldin Sabri! Anlık maça bilet ' + tl(m.stadyum.bilet) + '. Kendi kulübünü kurmak istersen ' + tl(m.stadyum.takim) + '.';
    return m.takim.ad + ' hazır abi. Hakem düdüğünü bekliyor, ' + (l?.sonraki ? 'sıradaki rakip ' + l.sonraki.rakip + '.' : 'bu haftaki maç oynandı.');
  };

  function mac(m: M): string {
    const s = m.stadyum, yakin = !!s.yakin, l = m.lig as M | null;
    let h = yakin ? '' : '<div class="kd-note">Koordinatöre yaklaş: halı saha girişi, karşı yaka (üst geçitten geç). Kart açık kalır ama işlemler yaklaşınca çalışır.</div>';
    if (l?.uyari) h += `<div class="kd-uyari">⚠️ ${esc(l.uyari)}</div>`;
    if (m.takim) {
      const sr = l?.sonraki;
      h += `<div class="kd-row"><span class="kd-ic">⚽</span><div><b>Sahaya çık: lig maçı</b><small>${sr ? esc(m.takim.ad) + ' - ' + esc(sr.rakip) + ' (' + (sr.ic ? 'iç saha' : 'deplasman') + ') · bilet yok. Galibiyet +3 puan, ' + tl(6000) + ' ve kapı geliri.' : 'Bu haftaki lig maçı oynandı. Yeni maç günü gelince burada.'}</small></div><button class="kd-b g" data-a="bilet"${lbl(yakin && !!sr)}>Sahaya çık</button></div>`;
      if (l?.cetele?.son) { const o = l.cetele.son; h += `<div class="kd-row"><span class="kd-ic">📋</span><div><b>Son maç raporu</b><small>${esc(m.takim.ad)} ${o.biz}-${o.onlar} ${esc(o.rakip)} · ${o.biz > o.onlar ? 'Galibiyet' : o.biz === o.onlar ? 'Beraberlik' : 'Mağlubiyet'}${o.kapi ? ' · kapı ' + tl(o.kapi) : ''}</small></div></div>`; }
      if (m.stad) {
        const g = m.stad, dol = Math.round(g.tahmin * 100);
        h += `<div class="kd-h">Bilet gişesi</div><div class="kd-row" style="display:block"><div style="display:flex;align-items:center;gap:12px"><b style="flex:1">Bilet fiyatı</b><button class="kd-b" data-a="biletFiyat" data-n="-1" aria-label="Fiyatı düşür">−</button><b style="min-width:96px;text-align:center;font-size:21px">${tl(g.fiyat)}</b><button class="kd-b" data-a="biletFiyat" data-n="1" aria-label="Fiyatı artır">+</button></div>
<div class="kd-bar"><i style="width:${dol}%"></i></div><small>Beklenen doluluk %${dol} (${Math.round(g.tahmin * g.kapasite)}/${g.kapasite} koltuk). Pahalı bilet az seyirci demek; galibiyet serisi ve güçlü rakip tribünü doldurur. Son maç ${tl(g.son)}, toplam ${tl(g.gelir)}.</small></div>`;
      }
    } else {
      h += `<div class="kd-row"><span class="kd-ic">🎟️</span><div><b>Anlık maç · bilet ${tl(s.bilet)}</b><small>Kimse yoksa rakip yapay zeka. 2 yarı. Günde ilk ${ODULLU_MAC_GUNLUK} maç ödüllü, sonrası biletsiz ve ödülsüz dostluk maçı. Kulüp kurarsan maçlar kulübünün adıyla lige sayılır.</small></div><button class="kd-b g" data-a="bilet"${lbl(yakin && m.money >= s.bilet)}>Bilet al</button></div>`;
      const sw = (k: 'c1' | 'c2', v: string) => `<button class="kd-sw${club[k] === v ? ' on' : ''}" data-a="kPick" data-k="${k}" data-v="${v}" style="background:${v}" aria-label="renk ${v}"></button>`;
      h += `<div class="kd-h">Kulüp kur · ${tl(s.takim)}</div><div class="kd-row" style="display:block"><div><small>Ad, iki renk, arma ve flama. Bir kez seçilir; lig ve çetele bu kulüple tutulur.</small></div>
<input class="kd-in" data-f="takim" maxlength="16" placeholder="Kulüp adı (en az 3 harf)" aria-label="Kulüp adı">
<div class="kd-pk"><span>Ana renk</span>${COL.map(v => sw('c1', v)).join('')}</div><div class="kd-pk"><span>Yedek renk</span>${COL.map(v => sw('c2', v)).join('')}</div>
<div class="kd-pk"><span>Arma</span>${ARMA.map(v => `<button class="kd-sw wide${club.arma === v ? ' on' : ''}" data-a="kPick" data-k="arma" data-v="${v}">${v}</button>`).join('')}</div>
<div class="kd-pk"><span>Flama</span><span style="display:flex;align-items:center;gap:12px;min-width:0"><b data-prev style="display:inline-grid;place-items:center;width:62px;height:62px;border:3px solid #3b2a20;border-radius:12px;background:linear-gradient(90deg,${club.c1} 50%,${club.c2} 50%);font-size:30px">${club.arma}</b>${flama(club.c1, club.c2)}</span></div>
<button class="kd-b y" data-a="takim"${lbl(yakin && m.money >= s.takim)}>Kulübü kur (${tl(s.takim)})</button></div>`;
    }
    return h;
  }

  function lig(m: M): string {
    const l = m.lig as M | null; if (!l) return '<div class="kd-note">Lig henüz başlamadı.</div>';
    if (!m.takim) return `<div class="kd-note">Lig kulüp kuranlar için işler. Önce Maç sayfasından kulübünü kur; fikstür, puan tablosu ve haftanın sonuçları burada olacak.</div>${tabloHtml(l, l.benBolum)}`;
    const b = l.benBolum as number; let h = '';
    h += `<div class="kd-row"><span class="kd-ic">🏆</span><div><b>${esc(l.bolumAd[b])} · Sezon ${l.sezon}</b><small>Hafta ${l.tur}/${l.turN} · kulüp gücü ${l.guc} (çetelendeki tecrübeyle büyür).</small></div></div>`;
    if (l.uyari) h += `<div class="kd-uyari">⚠️ ${esc(l.uyari)}</div>`;
    if (l.ozet) { const o = l.ozet, sn: Record<string, string> = { yukseldi: '⬆️ Yükseldik!', dustu: '⬇️ Düştük', sampiyon: '🏆 Şampiyonuz!', kaldi: 'Ligde kaldık' }; h += `<div class="kd-row" style="background:#fff3c4"><span class="kd-ic">📅</span><div><b>Sezon ${o.s} bitti: ${sn[o.sonuc] || ''}</b><small>${esc(l.bolumAd[o.bolum])} ${o.sira}. sıra · ${o.puan} puan${o.g != null ? ' · ' + o.g + ' G ' + o.b + ' B ' + o.m + ' M' : ''}${o.odul ? ' · ödül ' + tl(o.odul) : ''}. Şampiyonlar: ${esc(o.sampiyon[0])} / ${esc(o.sampiyon[1])}.</small></div></div>`; }
    h += '<div class="kd-h">Puan durumu</div>' + tabloHtml(l, b) + '<small style="display:block;margin:5px 2px;font:700 14px var(--body)">Yeşil: sezon sonunda yükselir · Kırmızı: düşer.</small>' + tabloHtml(l, 1 - b);
    if (l.hafta) {
      h += '<div class="kd-h">Haftanın sonuçları</div>';
      for (const x of l.hafta as M[]) h += `<div class="kd-fix${x.ben ? ' ben' : ''}"><span style="font-size:13px;opacity:.8">${esc(l.bolumAd[x.b])}</span><span>${esc(x.ev)} - ${esc(x.dep)}</span><b>${x.eg == null ? 'akşam' : x.eg + ' - ' + x.dg}</b></div>`;
    }
    if ((l.fikstur as M[]).length) {
      h += '<div class="kd-h">Fikstürüm</div>';
      for (const f of l.fikstur as M[]) h += `<div class="kd-fix${f.durum === 'sirada' ? ' ben' : ''}"><span>H${f.k} · gün ${f.gun}</span><span>${esc(f.rakip)} <small style="display:inline;opacity:.8">(${f.ic ? 'iç saha' : 'deplasman'})</small></span><b>${f.skor ? f.skor[0] + ' - ' + f.skor[1] : f.durum === 'sirada' ? 'sırada' : '-'}</b></div>`;
    }
    if ((l.gecmis as M[]).length) {
      h += '<div class="kd-h">Geçmiş sezonlar</div>';
      for (const x of [...l.gecmis].reverse() as M[]) h += `<div class="kd-note" style="text-align:left">Sezon ${x.s}: ${esc(l.bolumAd[x.bolum])} ${x.sira}. (${x.puan} p)${x.sonuc === 'yukseldi' ? ' · yükseldik' : x.sonuc === 'dustu' ? ' · düştük' : x.sonuc === 'sampiyon' ? ' · şampiyon' : ''} · şampiyonlar ${esc(x.sampiyon[0])} / ${esc(x.sampiyon[1])}</div>`;
    }
    return h;
  }
  function tabloHtml(l: M, b: number): string {
    let h = `<div class="kd-h" style="margin-top:10px">${esc(l.bolumAd[b])}</div><table class="kd-tbl"><tr><th>Kulüp</th><th>O</th><th>G</th><th>B</th><th>M</th><th>Av</th><th>P</th></tr>`;
    (l.tablo[b] as M[]).forEach((r, i) => { h += `<tr class="${r.ben ? 'ben ' : ''}${r.bolge}"><td><i class="kd-dot" style="background:${r.renk[0]}"></i>${i + 1}. ${esc(r.ad)}${r.bolge === 'yuksel' ? '<span class="kd-tag">↑</span>' : r.bolge === 'dus' ? '<span class="kd-tag">↓</span>' : ''}</td><td>${r.o}</td><td>${r.g}</td><td>${r.b}</td><td>${r.m}</td><td>${r.av > 0 ? '+' : ''}${r.av}</td><td><b>${r.p}</b></td></tr>`; });
    return h + '</table>';
  }

  function cetele(m: M): string {
    const c = m.lig?.cetele as M | null;
    if (!c) return '<div class="kd-note">Henüz maç oynamadın. Çetele ilk maçtan sonra dolar: gol krallığı, asistler, kurtarışlar, sezon sezon kayıt.</div>';
    const fc: Record<string, string> = { G: '#8fd06b', B: '#ffd23f', M: '#ff8b7a' }, mx = Math.max(1, ...(c.oyuncu as M[]).map(p => p.gol));
    let h = `<div class="kd-grid"><div class="kd-st">Maç<b>${c.oyun}</b></div><div class="kd-st">G / B / M<b>${c.g} / ${c.b} / ${c.m}</b></div><div class="kd-st">Gol<b>${c.gol}</b></div><div class="kd-st">Yenilen<b>${c.yenilen}</b></div></div>
<div class="kd-h">Form (son 5 maç)</div><div class="kd-form">${(c.form as string[]).map(x => `<i style="background:${fc[x]}">${x}</i>`).join('') || '-'}</div>
<div class="kd-h">Takım</div><div class="kd-grid"><div class="kd-st">Şut<b>${c.takim.sut}</b>isabetli ${c.takim.isabet}</div><div class="kd-st">Pas isabeti<b>%${c.takim.pas ? Math.round(c.takim.pasIsabet / c.takim.pas * 100) : 0}</b>${c.takim.pas} pas</div><div class="kd-st">Topla oynama<b>%${c.takim.sahiplik}</b>ortalama</div><div class="kd-st">Top çalma<b>${c.takim.top}</b>kurtarış ${c.takim.kurtaris} · korner ${c.takim.korner}</div></div>
<div class="kd-h">Oyuncular · gol dağılımı</div>${(c.oyuncu as M[]).map(p => `<div class="kd-gb"><u>${p.no} ${esc(p.ad)}</u><s style="width:${Math.max(3, Math.round(p.gol / mx * 100))}px;max-width:40%"></s><span>${p.gol} gol · ${p.asist} asist${p.no === 1 ? ' · ' + p.kurtaris + ' kurtarış' : ''} · ${p.oyun} maç</span></div>`).join('')}
<div class="kd-h">Rekorlar</div><div class="kd-grid"><div class="kd-st">En büyük galibiyet<b>${c.rekor.fark ? c.rekor.fark[0] + '-' + c.rekor.fark[1] : '-'}</b></div><div class="kd-st">En uzun galibiyet serisi<b>${c.rekor.seri}</b></div><div class="kd-st">Bir maçta en çok gol<b>${c.rekor.gol}</b></div></div>`;
    if ((c.rakip as M[]).length) h += '<div class="kd-h">Rakipler · kafa kafaya</div>' + (c.rakip as M[]).map(r => `<div class="kd-fix"><span>${r.o} maç</span><span>${esc(r.ad)}</span><b>${r.g}G ${r.b}B ${r.m}M</b></div>`).join('');
    if ((c.sezon as M[]).length) h += '<div class="kd-h">Sezonlar</div>' + (c.sezon as M[]).map(r => `<div class="kd-fix"><span>Sezon ${r.sezon}</span><span>${r.o} maç · averaj ${r.ag}-${r.yg}</span><b>${r.g}G ${r.b}B ${r.m}M</b></div>`).join('');
    return h;
  }

  function kadro(m: M): string {
    if (!m.takim || !m.stad) return '<div class="kd-note">Kadro ve formasyon kulüp kurulunca açılır. Önce Maç sayfasından kulübünü kur.</div>';
    const g = m.stad, c1 = m.takim.renk, c2 = m.takim.renk2 || '#f2c230', fm = FORMATIONS[g.formasyon] || FORMATIONS['2-2'], fi = (g.formaylar as M[]).find(f => f.id === g.formasyon);
    const D = ((m.lig?.cetele?.oyuncu || []) as M[]);
    let h = `<div class="kd-h" style="margin-top:2px">Diziliş</div><div class="kd-pk">${(g.formaylar as M[]).map(f => `<button class="kd-b${f.id === g.formasyon ? ' y' : ''}" data-a="formasyon" data-id="${f.id}"${m.stadyum.yakin ? '' : ' disabled'}>${esc(f.ad)}</button>`).join('')}</div>`;
    h += minisaha(g.formasyon, c1) + `<div class="kd-note">${esc(fi?.ad || g.formasyon)}: ${esc(fi?.not || '')}. Noktalar rolü gösterir: K kaleci, D savunma, O orta saha, F forvet; beyaz halkalı SABRİ.</div>`;
    h += '<div class="kd-h">Kadro</div>' + KADRO.map((k, i) => { const r = D.find(x => x.no === k.no) || {}, rol = fm[i]?.role || 'MID'; return `<div class="kd-sq${k.no === 10 ? ' ben' : ''}"><i style="background:${c1};color:${okunur(c1)}">${k.no}</i><span><b>${esc(k.ad)}${k.no === 10 ? ' (sen)' : ''}</b><small>${ROL[rol]} · ${r.oyun || 0} maç · ${r.gol || 0} gol · ${r.asist || 0} asist${rol === 'GK' ? ' · ' + (r.kurtaris || 0) + ' kurtarış' : ''}</small></span></div>`; }).join('');
    return h + `<div class="kd-row"><div style="flex:none">${flama(c1, c2, 80)}</div><div><b>${m.takim.arma || '🛡️'} ${esc(m.takim.ad)}</b><small>Forma: ${c1} / ${c2}. Kadro sabit; formasyon maçta gerçekten farklı oynatır.</small></div></div>`;
  }

  function tribun(m: M): string {
    const yakin = !!m.stadyum.yakin, bb = (k: string, l: string) => `<button class="kd-b${bet.k === k ? ' y' : ''}" data-a="betK" data-v="${k}">${l}</button>`;
    return `<div class="kd-row" style="display:block"><div><b>📣 Tribünden izle · küçük bahis</b><small>Mahalle takımlarının maçını tribünden izle. Tahminin tutarsa bahis × oran kadar ödeme alırsın. Oranlar takımlara göre maç başında belli olur: ev sahibi ×${fx(BAHIS_ARALIK.ev[0])}-${fx(BAHIS_ARALIK.ev[1])}, berabere ×${fx(BAHIS_ARALIK.X)}, deplasman ×${fx(BAHIS_ARALIK.dep[0])}-${fx(BAHIS_ARALIK.dep[1])}. Kasa her zaman biraz önde. Günde en çok ${BAHIS.gunluk} bahis, ${tl(BAHIS.min)} - ${tl(BAHIS.max)} arası.</small></div>
<div class="kd-pk"><span>Tahmin</span>${bb('1', 'Ev sahibi')}${bb('X', 'Berabere')}${bb('2', 'Deplasman')}${bb('', 'Bahissiz')}</div>
<div class="kd-pk"><span>Bahis</span>${[100, 500, 1000, 5000].map(v => `<button class="kd-b${bet.n === v ? ' y' : ''}" data-a="betN" data-v="${v}">${tl(v)}</button>`).join('')}</div>
<button class="kd-b g" data-a="izle"${lbl(yakin && (!bet.k || m.money >= bet.n))}>Tribüne geç</button></div>
<div class="kd-note">Bekleyen bahsin kayda yazılır: sayfayı yenilesen de paran yanmaz, sonuç yazılır.</div>`;
  }

  function paint(m: M) {
    const body = sayfa === 'lig' ? lig(m) : sayfa === 'cetele' ? cetele(m) : sayfa === 'kadro' ? kadro(m) : sayfa === 'tribun' ? tribun(m) : mac(m);
    const girdi = bg.querySelector('input[data-f="takim"]') as HTMLInputElement | null, odak = !!girdi && document.activeElement === girdi, imlec = girdi?.selectionStart ?? null;
    const sc = basa ? 0 : (bg.querySelector('.kd-body') as HTMLElement | null)?.scrollTop || 0, tsc = (bg.querySelector('.kd-tabs') as HTMLElement | null)?.scrollLeft || 0;
    bg.innerHTML = `<div class="kd-card" role="dialog" aria-label="Maç Koordinatörü"><div class="kd-top"><span class="kd-av">🧢</span><h2>Maç Koordinatörü</h2><span class="kd-chip">${tl(m.money)}</span><button class="kd-x" data-a="close" aria-label="Kapat">✕</button></div>
<div class="kd-say">“${esc(konus(m))}”</div><div class="kd-tabs">${TABS.map(([k, l]) => `<button class="kd-t${sayfa === k ? ' on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div class="kd-body">${body}</div></div>`;
    const i = bg.querySelector('input[data-f="takim"]') as HTMLInputElement | null;
    if (i) { i.value = club.ad; if (odak) { i.focus(); if (imlec != null) i.setSelectionRange(imlec, imlec); } }
    (bg.querySelector('.kd-body') as HTMLElement).scrollTop = sc; (bg.querySelector('.kd-tabs') as HTMLElement).scrollLeft = tsc; basa = false;
  }

  bg.addEventListener('pointerdown', e => e.stopPropagation());
  bg.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
  for (const ev of ['keydown', 'keyup'] as const) bg.addEventListener(ev, e => { e.stopPropagation(); if (ev === 'keydown' && (e as KeyboardEvent).key === 'Escape') api.close(); });
  bg.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (el.dataset.f === 'takim') club.ad = el.value; });
  bg.addEventListener('click', e => {
    if (e.target === bg) { api.close(); return; }
    const el = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!el || el.disabled) return;
    if (el.dataset.tab) { sayfa = el.dataset.tab as KoordinatorSayfa; basa = true; key = ''; t = 0; return; }
    const a = el.dataset.a, n = Number(el.dataset.n) || 0;
    if (a === 'close') { api.close(); return; }
    if (a === 'kPick') { const k = el.dataset.k as 'c1' | 'c2' | 'arma'; club[k] = el.dataset.v!; key = ''; t = 0; return; }
    if (a === 'takim') { cmd({ op: 'takim', name: club.ad, renk: club.c1, renk2: club.c2, arma: club.arma }); return; }
    if (a === 'bilet') { cmd({ op: 'bilet' }); api.close(); return; }
    if (a === 'biletFiyat') { cmd({ op: 'biletFiyat', n }); return; }
    if (a === 'formasyon') { cmd({ op: 'formasyon', id: el.dataset.id }); return; }
    if (a === 'betK') { bet.k = el.dataset.v || ''; key = ''; t = 0; return; }
    if (a === 'betN') { bet.n = Number(el.dataset.v) || 500; key = ''; t = 0; return; }
    if (a === 'izle') { cmd({ op: 'izle', bahis: bet.k || null, n: bet.k ? bet.n : 0 }); api.close(); }
  });

  const api: Koordinator = {
    open(s) { if (s) sayfa = s; basa = true; acik = true; bg.classList.add('on'); key = ''; t = 0; },
    close() { acik = false; bg.classList.remove('on'); },
    isOpen: () => acik,
    update(dt) {
      if (!acik) return; t -= dt; if (t > 0) return; t = 0.25;
      const mk = mulkApi(d.rules() as never); if (!mk) return;
      const m = mk.model() as M, k2 = sayfa + '|' + club.c1 + club.c2 + club.arma + bet.k + bet.n + '|' + JSON.stringify([m.money, m.takim, m.stad, m.stadyum, m.lig]);
      if (k2 !== key) { key = k2; paint(m); }
    },
    dispose() { st.remove(); bg.remove(); },
  };
  return api;
}
