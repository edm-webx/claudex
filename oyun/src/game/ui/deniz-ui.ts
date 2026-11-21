// Deniz overlay (survey vapur-4..7, yasam-2). DOM only, view only: reads the sim's deniz API (rules.rt.deniz) and sends
// { kind: 'deniz', ... } commands; it never writes sim state.
// - Güverte koşusu: a countdown bar while the 10 s deck sale runs, and a hint chip while the ferry is docked.
// - Deniz canlısı: a card with the creature and a big one-tap 'Fotoğraf çek' while it is on screen.
// - Kedi-martı düellosu chip.
// Decisions: cards sit on the left edge (the kurye fiş uses the right), re-rendered only when their content key changes
// so buttons stay tappable; bars are updated per frame by style only.
import { denizApi, type DenizView } from '../sim/deniz';
import { SEA_LIFE, VAPUR_BUFE } from '../../content/deniz';

type Cmd = { kind: string; [k: string]: unknown };
export interface DenizUiDeps { root: HTMLElement; rules: () => { rt: unknown } | null; command(c: Cmd): void; sfx?(id: string): void; }
export interface DenizUiView { update(dt: number): void; dispose(): void; }

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const tl = (n: number) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₺';
const INK = '#3b2a20';
const PN: Record<string, string> = { doner: '🌯 döner', cay: '🍵 çay', ayran: '🥛 ayran', simit: '🥯 simit', tost: '🥪 tost', gazoz: '🍾 gazoz' };

const CSS = `
.dz-ui{position:absolute;left:calc(var(--sl,0px) + 8px);top:calc(env(safe-area-inset-top,0px) + 34%);z-index:25;display:flex;flex-direction:column;align-items:flex-start;gap:6px;pointer-events:none;width:min(220px,56vw)}
.dz-c{pointer-events:auto;width:100%;box-sizing:border-box;background:#f2fbff;border:2.5px solid ${INK};border-radius:14px;box-shadow:0 4px 0 ${INK};padding:7px 9px;font:800 14px/1.25 var(--body);color:${INK};animation:dzpop .3s ease-out}
.dz-c .hd{display:flex;align-items:center;gap:6px;font:900 16px/1.1 var(--disp)}.dz-c .hd .e{font-size:26px;line-height:1}
.dz-c p{margin:4px 0 0;font:700 13px/1.3 var(--body)}
.dz-c button{width:100%;margin-top:6px;min-height:48px;border:2.5px solid ${INK};border-radius:12px;font:900 16px/1 var(--disp);color:${INK};background:var(--money,#5fc36f);box-shadow:0 3px 0 ${INK};cursor:pointer}
.dz-c button small{display:block;font:800 12px/1.1 var(--body);margin-top:2px}
.dz-c button.b{background:#7cc7f0}.dz-c button.y{background:var(--yellow,#ffd23f)}
.dz-c .bar{height:10px;border:2px solid ${INK};border-radius:7px;background:#fff;overflow:hidden;margin-top:5px}.dz-c .bar i{display:block;height:100%;background:#2f9fd8;width:100%}
.dz-c.run{background:#fff3c4}.dz-c.run .bar i{background:#e0533c}
.dz-c.chip{padding:6px 9px;font:900 14px/1.2 var(--disp);background:#fff8ec}
.dz-c ul{margin:4px 0 0;padding:0 0 0 2px;list-style:none;font:800 14px/1.35 var(--body)}
@keyframes dzpop{0%{transform:scale(.75);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes dzwob{0%,100%{transform:rotate(0)}50%{transform:rotate(-4deg)}}
.dz-c.wob{animation:dzwob .6s ease-in-out infinite}
`;

/** Ferry interior cutaway (deck tabs highlight a part). */

export function createDenizUi(d: DenizUiDeps): DenizUiView {
  const st = document.createElement('style'); st.textContent = CSS; d.root.appendChild(st);
  const box = document.createElement('div'); box.className = 'dz-ui'; d.root.appendChild(box);
  let key = '', t = 0;
  const cmd = (op: string, id?: string | number) => { try { d.sfx?.('tap'); } catch { /* */ } d.command({ kind: 'deniz', op, id: id == null ? undefined : String(id) }); };
  box.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('[data-op]') as HTMLElement | null; if (b) cmd(b.dataset.op!, b.dataset.id); });

  function cards(v: DenizView, carry: number): string {
    let s = '';
    if (v.run) s += `<div class="dz-c run" data-k="run"><div class="hd"><span class="e">🏃</span>Güverte koşusu!</div><p>${v.run.sold} satış · ${tl(v.run.earned)}</p><div class="bar"><i data-bar="run"></i></div></div>`;
    if (v.sight && !v.sight.photo) {
      const def = SEA_LIFE.find(x => x.id === v.sight!.id);
      if (def) s += `<div class="dz-c" data-k="sight"><div class="hd"><span class="e">${def.icon}</span>${esc(def.name)}${def.rare ? ' ✨' : ''}</div><div class="bar"><i data-bar="sight"></i></div><button class="b" data-op="photo">📸 Fotoğraf çek</button></div>`;
    }
    return s;
  }

  return {
    update(dt) {
      t += dt;
      const r = d.rules(), api = denizApi(r);
      if (!r || !api) { box.innerHTML = ''; return; }
      const v = api.view(), carry = ((r.rt as { carry?: unknown[] }).carry || []).length;
      const k = [v.run ? 'r' + v.run.sold : '', v.canRun && carry > 0 ? 'h' : '', v.bufe && v.docked ? 'b' : '', v.sight && !v.sight.photo ? 's' + v.sight.id : '', v.duel ? 'd' : ''].join('|');
      if (k !== key) { key = k; box.innerHTML = cards(v, carry); }
      const bar = (n: string, p: number) => { const el = box.querySelector(`[data-bar="${n}"]`) as HTMLElement | null; if (el) el.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(1) + '%'; };
      if (v.run) bar('run', v.run.left / v.run.max);
      if (v.sight) bar('sight', 1 - v.sight.t / v.sight.dur);
    },
    dispose() { box.remove(); st.remove(); },
  };
}
