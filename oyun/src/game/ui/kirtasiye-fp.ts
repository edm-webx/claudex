// Kırtasiye birinci şahıs tezgah (survey 2026-11-09): the camera sits behind the counter (boot sets cam.fp), customers
// come one by one with a list; the player picks from the shelf buttons and hands it over. Reads mulk view().kirtasiye,
// writes only mulk commands. Code-made DOM, Turkish text.
import type { Rules } from '../sim/state';
import { mulkApi } from '../sim/mulk';
import { fmtMoney } from '../sim/util';

export interface KirtasiyeFpView { update(): void; active(): boolean; dispose(): void }
type U = { id: string; ad: string; ikon: string; fiyat: number };
type KT = { mus: { ad: string; istek: Record<string, number>; kalan: number } | null; sepet: Record<string, number>; ciro: number; sat: number; kacan: number; son: string; urun: U[] };

const CSS = `
.kt-wrap{position:absolute;inset:0;pointer-events:none;z-index:55;font-family:var(--body)}
.kt-top{position:absolute;top:12px;left:50%;transform:translateX(-50%);background:#fdf3e1;color:#3b2a20;border:3px solid #3b2a20;border-radius:14px;padding:6px 14px;font:900 15px/1.2 var(--disp);pointer-events:auto;display:flex;gap:12px;align-items:center}
.kt-top button{border:3px solid #3b2a20;background:#ffd23f;border-radius:10px;font:900 13px/1 var(--disp);padding:6px 10px;cursor:pointer;color:#3b2a20}
.kt-mus{position:absolute;top:70px;left:50%;transform:translateX(-50%);width:min(380px,calc(100vw - 32px));background:#fff;border:4px solid #3b2a20;border-radius:18px;box-shadow:0 6px 0 #3b2a20;padding:10px 14px;color:#3b2a20;pointer-events:auto}
.kt-mus b{font:900 17px/1.2 var(--disp)}
.kt-bar{height:8px;border-radius:6px;background:#eadfcf;margin:6px 0 8px;overflow:hidden}.kt-bar i{display:block;height:100%;background:#2f9e5a;transition:width .2s}
.kt-bar.low i{background:#e0533c}
.kt-ist{display:flex;flex-wrap:wrap;gap:6px}.kt-ist span{background:#f4ead8;border-radius:999px;padding:3px 9px;font:800 14px/1.3 var(--body)}
.kt-ist span.ok{background:#c9efd5}
.kt-raf{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);width:min(760px,calc(100vw - 24px));background:rgba(253,243,225,.96);border:4px solid #3b2a20;border-radius:18px;padding:8px;pointer-events:auto;color:#3b2a20}
.kt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:6px}
.kt-grid button{border:3px solid #3b2a20;background:#fff;border-radius:12px;padding:5px 2px;cursor:pointer;font:800 12px/1.15 var(--body);color:#3b2a20;min-height:58px}
.kt-grid button em{display:block;font-style:normal;font-size:22px;line-height:1.1}
.kt-grid button:active{transform:translateY(2px)}
.kt-alt{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap}
.kt-sepet{flex:1;min-width:160px;font:800 14px/1.3 var(--body)}
.kt-alt button{border:3px solid #3b2a20;border-radius:12px;font:900 16px/1 var(--disp);padding:10px 16px;cursor:pointer;color:#3b2a20}
.kt-ver{background:#7bd88f}.kt-sil{background:#f4ead8}
.kt-son{position:absolute;top:44px;left:50%;transform:translateX(-50%);font:900 14px/1.2 var(--disp);color:#fff;text-shadow:0 2px 0 #3b2a20;white-space:nowrap}
`;

export function createKirtasiyeFp(d: { root: HTMLElement; rules: () => Rules | null; command: (c: { kind: string; [k: string]: unknown }) => unknown; sfx?: (id: string) => void }): KirtasiyeFpView {
  const st = document.createElement('style'); st.textContent = CSS; d.root.appendChild(st);
  const wrap = document.createElement('div'); wrap.className = 'kt-wrap'; wrap.style.display = 'none'; d.root.appendChild(wrap);
  let key = '', on = false;
  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]);
  const cmd = (op: string, id = '') => { d.sfx?.('pop'); d.command({ kind: 'mulk', op, id }); };
  wrap.addEventListener('click', e => {
    const el = (e.target as HTMLElement).closest('[data-op]') as HTMLElement | null; if (!el) return;
    cmd(el.dataset.op!, el.dataset.id || '');
  });
  function paint(k: KT) {
    const by = Object.fromEntries(k.urun.map(u => [u.id, u]));
    const m = k.mus;
    const sepetTxt = Object.entries(k.sepet).filter(([, n]) => n > 0).map(([id, n]) => (by[id]?.ikon || '') + ' ' + n + '× ' + esc(by[id]?.ad || id)).join(', ') || 'Tezgah boş';
    wrap.innerHTML = `<div class="kt-top">✏️ Martı Kırtasiye · ${k.sat} satış · ${fmtMoney(k.ciro)}${k.kacan ? ' · ' + k.kacan + ' kaçan' : ''}<button data-op="ktKapat">Tezgahtan çık</button></div>
${k.son ? `<div class="kt-son">${esc(k.son)}</div>` : ''}
<div class="kt-mus">${m ? `<b>${esc(m.ad)}</b><div class="kt-bar${m.kalan < 0.3 ? ' low' : ''}"><i style="width:${Math.round(m.kalan * 100)}%"></i></div><div class="kt-ist">${Object.entries(m.istek).map(([id, n]) => `<span class="${(k.sepet[id] || 0) === n ? 'ok' : ''}">${by[id]?.ikon || ''} ${n}× ${esc(by[id]?.ad || id)}</span>`).join('')}</div>` : '<b>Kapı çalıyor…</b><div style="font:700 14px/1.3 var(--body);opacity:.7">Sıradaki müşteri geliyor.</div>'}</div>
<div class="kt-raf"><div class="kt-grid">${k.urun.map(u => `<button data-op="ktEkle" data-id="${u.id}"${m ? '' : ' disabled'}><em>${u.ikon}</em>${esc(u.ad)}<br>${fmtMoney(u.fiyat)}</button>`).join('')}</div>
<div class="kt-alt"><div class="kt-sepet">🧺 ${sepetTxt}</div><button class="kt-sil" data-op="ktTemizle"${m ? '' : ' disabled'}>Temizle</button><button class="kt-ver" data-op="ktVer"${m ? '' : ' disabled'}>Ver ✓</button></div></div>`;
  }
  return {
    active: () => on,
    update() {
      const r = d.rules(); const m = r ? mulkApi(r as never) : null;
      const k = (m?.view() as { kirtasiye?: KT | null } | undefined)?.kirtasiye ?? null;
      on = !!k; wrap.style.display = on ? 'block' : 'none';
      if (!k) { key = ''; return; }
      const nk = JSON.stringify([k.mus && { ...k.mus, kalan: Math.round(k.mus.kalan * 40) }, k.sepet, k.ciro, k.sat, k.kacan, k.son]);
      if (nk !== key) { key = nk; paint(k); }
    },
    dispose() { st.remove(); wrap.remove(); },
  };
}
