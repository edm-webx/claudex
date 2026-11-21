/**
 * Faz 2 HUD (DOM only). Reads restoranApi, writes through command().
 *  - Smaller speech/order bubbles (CSS override of engine/ui/v2-style).
 *  - Adisyon rail: right edge under the HUD, one slip per open ticket (table no, items left, time bar),
 *    Günün Yemeği and servis stars on top. Shown only in the restaurant phase.
 */
import { restoranApi } from '../sim/restoran';

export interface Faz2HudDeps {
  root: HTMLElement;
  rules(): { rt: { started: boolean; paused: boolean }; state?: unknown } | null;
  command(c: { kind: string; [k: string]: unknown }): void;
  sfx?(id: string): void;
}
export interface Faz2Hud { update(dt: number): void; dispose(): void }

const CSS = `
.sb-lab .bubble{padding:2px 6px 3px;border-width:2px;max-width:128px;font-size:13px;margin-bottom:14px;border-radius:12px}
.sb-lab .bubble::before{width:9px;height:9px;bottom:-10px;border-width:2px}
.sb-lab .bubble::after{width:5px;height:5px;bottom:-16px;border-width:2px}
.sb-lab .bubble .bi svg{width:19px;height:19px}
.sb-lab .bubble .bi .n{font-size:13px}
.sb-lab .bubble .bt{max-width:116px}
.sb-lab .say{padding:4px 8px 5px;font-size:13px;max-width:150px;border-radius:11px;margin-bottom:10px}
.sb-sheet.dk-low{max-height:38dvh!important;max-height:min(38dvh,340px)!important;bottom:calc(var(--sbm) + var(--barh) + 6px)!important}
.sb-sheet.dk-low .sb-shb{padding-bottom:6px}
.f2-rail{position:absolute;right:calc(var(--sr,0px) + 8px);top:calc(var(--hudb,100px) + 70px);width:132px;z-index:23;display:flex;flex-direction:column;gap:5px;pointer-events:none;
  font-family:var(--body,system-ui,sans-serif);color:var(--ink,#3b2a20);transition:opacity .25s}
.f2-rail.off{opacity:0;pointer-events:none!important}
.f2-rail>*{pointer-events:auto}
.f2-ph{display:flex;justify-content:space-between;align-items:center;gap:6px;background:#ffd23f;border:2px solid var(--ink,#3b2a20);border-radius:10px;padding:3px 7px;font:900 11.5px/1.2 var(--disp,system-ui);cursor:pointer;box-shadow:0 2px 0 var(--ink,#3b2a20)}
.f2-note{font:700 12px/1.25 var(--body,system-ui);opacity:.9;padding:0 2px}
.f2-top{background:var(--ink,#3b2a20);color:#fff8ec;border-radius:10px;padding:4px 7px;font:800 13px/1.25 var(--body,system-ui)}
.f2-top b{color:#ffd23f}
.f2-slip{background:#fffdf6;border:2px solid var(--ink,#3b2a20);border-radius:4px 4px 10px 10px;padding:3px 6px 4px;box-shadow:0 2px 0 var(--ink,#3b2a20);
  font:800 11px/1.25 var(--body,system-ui);animation:f2-in .25s ease-out;background-image:repeating-linear-gradient(transparent 0 13px,rgba(59,42,32,.08) 13px 14px)}
.f2-slip.sp{border-color:#d68910}
.f2-slip.late{animation:f2-shake .5s ease-in-out infinite alternate}
.f2-slip .h{display:flex;justify-content:space-between;font:900 12px/1.2 var(--disp,system-ui)}
.f2-slip .h i{font-style:normal;background:var(--ink,#3b2a20);color:#fff;border-radius:7px;padding:0 5px}
.f2-slip s{opacity:.45}
.f2-slip .bar{height:5px;border-radius:3px;background:#e8dccb;margin-top:3px;overflow:hidden}
.f2-slip .bar u{display:block;height:100%;background:#5fc36f}
.f2-slip.late .bar u{background:#e74c3c}
@keyframes f2-in{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}
@keyframes f2-shake{from{transform:rotate(-1.5deg)}to{transform:rotate(1.5deg)}}
`;

const esc = (s: unknown) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const stars = (v: number) => { const n = Math.round(v); return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n)); };

export function createFaz2Hud(d: Faz2HudDeps): Faz2Hud {
  if (!document.getElementById('f2-css')) { const st = document.createElement('style'); st.id = 'f2-css'; st.textContent = CSS; document.head.appendChild(st); }
  const rail = document.createElement('div'); rail.className = 'f2-rail off';
  d.root.append(rail);
  let t = 0, railSig = '';

  let railOpen = true;
  try { railOpen = localStorage.getItem('sb.railOpen') !== '0'; } catch { /* storage blocked */ }
  rail.addEventListener('click', e => { if (!(e.target as HTMLElement).closest('[data-rail]')) return; railOpen = !railOpen; try { localStorage.setItem('sb.railOpen', railOpen ? '1' : '0'); } catch { /* */ } railSig = ''; renderRail(); });
  function renderRail(): void {
    const r = d.rules(), api = restoranApi(r);
    const hud = d.root.querySelector('.sb-hud');
    const on = !!(r && api && r.rt.started && (!hud || !hud.classList.contains('off')));
    const v = on && api ? api.view() : null;
    const show = !!v && v.active;
    rail.classList.toggle('off', !show);
    if (!v || !show) return;
    const sig = JSON.stringify([railOpen, v.servis, v.tickets.map(k => [k.no, k.table, Math.round(k.frac * 20), k.items.map(i => i.left)])]);
    if (sig === railSig) return; railSig = sig;
    const head = `<div class="f2-ph" data-rail="1"><span>🧾 Sipariş paneli (${v.tickets.length})</span><span>${railOpen ? '▾' : '▸'}</span></div>`;
    if (!railOpen) { rail.innerHTML = head; return; }
    const top = `<div class="f2-top">Servis: <b>${stars(v.servis)}</b></div><div class="f2-note">${v.tickets.length ? 'Garsonlar siparişleri halleder. Yetişmezlerse sen servis et.' : 'Bekleyen sipariş yok.'}</div>`;
    rail.innerHTML = head + top + v.tickets.slice(0, 3).map(k => `<div class="f2-slip${k.frac > 0.7 ? ' late' : ''}"><div class="h"><span>Sipariş ${k.no}</span><i>Masa ${k.table + 1}</i></div>
      ${k.items.map(i => (i.left ? '' : '<s>') + `${i.n}× ${esc(i.name)}` + (i.left ? '' : '</s>')).join('<br>')}
      <div class="bar"><u style="width:${Math.round((1 - k.frac) * 100)}%"></u></div></div>`).join('') + (v.tickets.length > 3 ? `<div class="f2-note">+${v.tickets.length - 3} sipariş daha</div>` : '');
  }
  return {
    update(dt) {
      if ((t -= dt) > 0) return; t = 0.25;
      renderRail();
    },
    dispose() { rail.remove(); },
  };
}
