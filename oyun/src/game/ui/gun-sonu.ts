// Gün sonu (survey 2026-10-24, user reversed "no end-of-day card"): at 03:00 the screen fades to night black, the
// day's ciro shows, and "Yeni güne başla" starts the next morning. Reads rt.uiLast.gunSonu; writes only the
// 'yeniGun' command. Code-made DOM, Turkish text, no images.
import type { Rules } from '../sim/state';
import { fmtMoney } from '../sim/util';

export interface GunSonuView { update(): void; dispose(): void }
interface GunSonuModel { day: number; earned: number; customers: number; angry: number; money: number; record: boolean; maas?: number; ekip?: number }

const CSS = `
.gs-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:auto;background:rgba(6,8,22,0);transition:background 1.6s ease;z-index:60}
.gs-wrap.on{background:rgba(6,8,22,.92)}
.gs-card{opacity:0;transform:translateY(18px) scale(.97);transition:opacity .8s ease 1.1s,transform .8s ease 1.1s;background:#fdf3e1;color:#3b2a20;border-radius:22px;border:4px solid #3b2a20;box-shadow:0 10px 0 #3b2a20;padding:22px 24px 20px;width:min(360px,calc(100vw - 32px));text-align:center;font-family:var(--body)}
.gs-wrap.on .gs-card{opacity:1;transform:none}
.gs-moon{font-size:40px;line-height:1;margin-bottom:4px}
.gs-h{font:900 26px/1.1 var(--disp);margin:2px 0 2px}
.gs-sub{font:700 14px/1.3 var(--body);opacity:.75;margin-bottom:12px}
.gs-ciro{font:900 40px/1.05 var(--disp);color:#1e8449;margin:6px 0 2px}
.gs-rec{display:inline-block;background:#ffd23f;border:3px solid #3b2a20;border-radius:999px;padding:2px 12px;font:900 13px/1.4 var(--disp);margin:4px 0 6px}
.gs-row{display:flex;justify-content:space-between;font:800 16px/1.2 var(--body);padding:7px 2px;border-top:2px dashed rgba(59,42,32,.25)}
.gs-btn{margin-top:14px;width:100%;min-height:58px;border-radius:16px;border:4px solid #3b2a20;background:#ffd23f;box-shadow:0 5px 0 #3b2a20;font:900 21px/1 var(--disp);color:#3b2a20;cursor:pointer}
.gs-btn:active{transform:translateY(4px);box-shadow:0 1px 0 #3b2a20}
`;

export function createGunSonu(deps: { root: HTMLElement; rules: () => Rules | null; command: (c: { kind: string }) => unknown; sfx?: (id: string) => void }): GunSonuView {
  const st = document.createElement('style'); st.textContent = CSS; deps.root.appendChild(st);
  let wrap: HTMLDivElement | null = null, shownDay = -1;
  const close = () => { if (wrap) { wrap.remove(); wrap = null; } shownDay = -1; };
  function show(m: GunSonuModel) {
    const g = deps.rules()?.rt.uiLast.giderSon as { day: number; kira: number; fatura: number; malzeme: number } | undefined;
    close(); shownDay = m.day;
    wrap = document.createElement('div'); wrap.className = 'gs-wrap';
    wrap.innerHTML = `<div class="gs-card"><div class="gs-moon">🌙</div><div class="gs-h">Kepenkler indi</div><div class="gs-sub">${m.day}. gün bitti. Saat 03:00, iskele sessiz.</div>
      <div class="gs-sub" style="margin:0">Günün cirosu</div><div class="gs-ciro">${fmtMoney(m.earned)}</div>${m.record ? '<div class="gs-rec">Yeni rekor!</div>' : ''}
      <div class="gs-row"><span>Müşteri</span><b>${m.customers}</b></div>
      <div class="gs-row"><span>Kızgın giden</span><b>${m.angry}</b></div>
      ${m.ekip ? `<div class="gs-row"><span>Personel payı (${m.ekip} kişi, bahşiş kumbarası dahil)</span><b>−${fmtMoney(m.maas || 0)}</b></div>` : ''}
      ${g && g.day === m.day ? `<div class="gs-row"><span>Kira</span><b>−${fmtMoney(g.kira)}</b></div><div class="gs-row"><span>Faturalar (elektrik, su, tüp)</span><b>−${fmtMoney(g.fatura)}</b></div><div class="gs-row"><span>Malzeme</span><b>−${fmtMoney(g.malzeme)}</b></div>` : ''}
      <div class="gs-row"><span>Kasada</span><b>${fmtMoney(m.money)}</b></div>
      <button class="gs-btn" type="button">Yeni güne başla ☀️</button></div>`;
    deps.root.appendChild(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap?.classList.add('on')));
    wrap.querySelector('.gs-btn')!.addEventListener('click', () => { deps.sfx?.('pop'); deps.command({ kind: 'yeniGun' }); close(); });
  }
  return {
    update() {
      const r = deps.rules(); const m = r?.rt.uiLast.gunSonu as GunSonuModel | undefined;
      if (m && m.day !== shownDay) show(m);
      else if (!m && wrap) close();
    },
    dispose() { close(); st.remove(); },
  };
}
