/**
 * Goals card (ekonomi-6/7). DOM only; reads `hedefApi(rules)`, writes through
 * `command({ kind: 'hedef', op })`. Owner: hedef feature.
 * - Card: top-left under the HUD money pill (uses the v2 `--hudb` CSS var), 1 main goal with a money bar and a pin
 *   button (cycles the pinned target), 2 small goals with progress. Header tap folds it (saved in the sim state).
 *   Re-renders only when its text signature changes (checked 4x per second).
 * - When `doneN` grows, the finished row flashes and coins fly to the money pill (v2 coins play the coin sound).
 * - Teselli: a centre card with a steaming tea glass, a comforting line and the gift; shown 2.5 s after the day ends
 *   (after the day card slid in), never while the weekly kasa count is up.
 */
import { hedefApi, type GoalCardModel } from '../sim/goals';

export interface HedefCardDeps {
  root: HTMLElement;
  v2: { coins(x: number, y: number, n: number): void };
  rules(): { rt: { started: boolean; paused: boolean; uiLast: Record<string, unknown> } } | null;
  command(c: { kind: string; [k: string]: unknown }): void;
  sfx?(id: string): void;
}
export interface HedefCard { update(dt: number): void; dispose(): void }

const CSS = `
.hd-card{position:absolute;left:calc(var(--sl,0px) + 8px);top:calc(var(--hudb,100px) + 54px);width:min(214px,54vw);z-index:24;pointer-events:auto;
  background:var(--paper,#fff8ec);border:3px solid var(--ink,#3b2a20);border-radius:16px;box-shadow:0 4px 0 var(--ink,#3b2a20);color:var(--ink,#3b2a20);
  font-family:var(--body,system-ui,sans-serif);overflow:hidden;user-select:none;-webkit-user-select:none;transition:opacity .25s}
.hd-card.off{opacity:0;pointer-events:none}
.hd-hd{display:flex;align-items:center;gap:6px;padding:5px 9px 4px;background:#ffd23f;border-bottom:2px solid var(--ink,#3b2a20);cursor:pointer}
.hd-hd b{font:900 13px/1 var(--disp,system-ui);letter-spacing:.06em;flex:1}
.hd-hd i{font-style:normal;font:900 12px/1 var(--disp,system-ui);background:#fff;border:2px solid var(--ink,#3b2a20);border-radius:9px;padding:2px 6px}
.hd-hd .cv{width:14px;height:14px;transition:transform .2s}
.hd-card.fold .hd-hd{border-bottom:0}
.hd-card.fold .hd-hd .cv{transform:rotate(-90deg)}
.hd-card.fold .hd-bd{display:none}
.hd-main{display:flex;gap:6px;align-items:flex-start;padding:7px 8px 6px;border-bottom:2px dashed rgba(59,42,32,.25);cursor:pointer}
.hd-main .tx{flex:1;min-width:0}
.hd-main .lb{font:900 15px/1.25 var(--disp,system-ui);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hd-main .sb{font:700 12px/1.2 var(--body,system-ui);color:var(--ink2,#6b5444);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hd-bar{position:relative;height:12px;border:2px solid var(--ink,#3b2a20);border-radius:8px;background:#efe3cf;margin-top:5px;overflow:hidden}
.hd-bar u{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(180deg,#5fc36f,#2f9a47);border-radius:6px;transition:width .4s}
.hd-main.rdy .hd-bar u{background:linear-gradient(180deg,#ffe066,#f4a922);animation:hd-glow 1s ease-in-out infinite alternate}
.hd-amt{font:800 12px/1.2 var(--body,system-ui);margin-top:3px;color:#226b3a}
.hd-pin{flex:none;width:32px;height:32px;border:2px solid var(--ink,#3b2a20);border-radius:10px;background:#fff;display:grid;place-items:center;cursor:pointer;padding:0}
.hd-pin.on{background:#ffd23f}
.hd-pin svg{width:18px;height:18px}
.hd-sm{display:flex;align-items:center;gap:6px;padding:6px 8px;font:800 13.5px/1.2 var(--body,system-ui)}
.hd-sm+.hd-sm{border-top:1px solid rgba(59,42,32,.15)}
.hd-sm .ck{flex:none;width:18px;height:18px;border:2px solid var(--ink,#3b2a20);border-radius:50%;background:#fff;display:grid;place-items:center;font:900 12px/1 var(--disp,system-ui)}
.hd-sm.done .ck{background:#5fc36f;color:#fff}
.hd-sm .t{flex:1;min-width:0}
.hd-sm .n{font:900 12px/1 var(--disp,system-ui);color:var(--ink2,#6b5444);white-space:nowrap}
.hd-sm .rw{display:block;font:800 11.5px/1.2 var(--body,system-ui);color:#226b3a}
.hd-sm.done .t{text-decoration:line-through;opacity:.75}
.hd-sm.flash{animation:hd-flash .9s ease-out}
@keyframes hd-flash{0%{background:#fff3a8;transform:scale(1.04)}100%{background:transparent;transform:none}}
@keyframes hd-glow{from{filter:brightness(1)}to{filter:brightness(1.25)}}
  padding:16px 16px 14px;text-align:center;color:var(--ink,#3b2a20);animation:hd-pop .45s cubic-bezier(.3,1.5,.5,1)}
  border-radius:12px 12px 16px 16px / 8px 8px 22px 22px;background:linear-gradient(90deg,rgba(255,255,255,.55),rgba(255,255,255,.1) 40%,rgba(255,255,255,.4));overflow:hidden;
  clip-path:polygon(0 0,100% 0,88% 48%,100% 100%,0 100%,12% 48%)}
@keyframes hd-steam{0%{transform:translateY(8px) scaleX(1);opacity:0}30%{opacity:.9}100%{transform:translateY(-22px) scaleX(-1);opacity:0}}
@keyframes hd-fade{from{opacity:0}to{opacity:1}}
@keyframes hd-pop{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
`;

const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l-1 6 4 4H6l4-4z" fill="#e0533c"/><path d="M12 13v8"/></svg>';
const CHEV = '<svg class="cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
const fmt = (n: number) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const esc = (s: unknown) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function createHedefCard(d: HedefCardDeps): HedefCard {
  if (!document.getElementById('hd-css')) { const st = document.createElement('style'); st.id = 'hd-css'; st.textContent = CSS; document.head.appendChild(st); }
  const card = document.createElement('div');
  card.className = 'hd-card off';
  d.root.appendChild(card);
  let sig = '', t = 0, lastDone = -1, flashId = '', flashUntil = 0;
  let clock = 0;

  card.addEventListener('click', e => {
    const el = e.target as HTMLElement;
    if (el.closest('.hd-pin')) { e.stopPropagation(); d.command({ kind: 'hedef', op: 'pin' }); sig = ''; return; }
    if (el.closest('.hd-hd')) { d.command({ kind: 'hedef', op: 'fold' }); sig = ''; return; }
    if (el.closest('.hd-main')) { d.command({ kind: 'hedef', op: 'go' }); return; }
  });

  function render(m: GoalCardModel): void {
    const doneSm = m.small.filter(s => s.done).length;
    const mm = m.main;
    const s = JSON.stringify([m.fold, mm && [mm.key, mm.label, mm.sub, Math.round(mm.frac * 100), Math.floor(mm.have), mm.pinned, mm.ready], m.small.map(x => [x.id, x.got, x.done, x.reward]), flashId]);
    if (s === sig) return;
    sig = s;
    card.classList.toggle('fold', m.fold);
    const head = `<div class="hd-hd"><b>HEDEFLER</b><i>${doneSm}/${m.small.length}</i>${CHEV}</div>`;
    const main = mm ? `<div class="hd-main${mm.ready ? ' rdy' : ''}"><div class="tx"><div class="lb">${esc(mm.label)}</div><div class="sb">${esc(mm.sub)}</div>
      <div class="hd-bar"><u style="width:${Math.round(mm.frac * 100)}%"></u></div>
      ${mm.cost > 0 ? `<div class="hd-amt">${fmt(Math.min(mm.have, mm.cost))} / ${fmt(mm.cost)} ₺</div>` : ''}</div>
      ${mm.canPin ? `<button class="hd-pin${mm.pinned ? ' on' : ''}" aria-label="Hedefe iğne at">${PIN}</button>` : ''}</div>` : '';
    const small = m.small.map(x => `<div class="hd-sm${x.done ? ' done' : ''}${x.id === flashId ? ' flash' : ''}" data-id="${esc(x.id)}"><span class="ck">${x.done ? '✓' : ''}</span>
      <span class="t">${esc(x.text)}<span class="rw">+${fmt(x.reward)} ₺</span></span><span class="n">${x.got}/${x.n}</span></div>`).join('');
    card.innerHTML = head + `<div class="hd-bd">${main}${small}</div>`;
  }

  function coinsFrom(el: Element | null, n: number): void {
    const r = (el || card).getBoundingClientRect();
    try { d.v2.coins(r.left + r.width / 2, r.top + r.height / 2, n); } catch { /* ui optional */ }
  }

  return {
    update(dt) {
      clock += dt;
      if ((t -= dt) > 0) return;
      t = 0.25;
      const r = d.rules(); const api = hedefApi(r);
      const hud = d.root.querySelector('.sb-hud');
      const on = !!(r && api && r.rt.started && (!hud || !hud.classList.contains('off')));
      card.classList.toggle('off', !on);
      if (!r || !api || !on) return;
      const m = api.card();
      if (flashId && clock > flashUntil) flashId = '';
      if (lastDone >= 0 && m.doneN > lastDone) {
        const fin = m.small.find(x => x.done);
        flashId = fin ? fin.id : ''; flashUntil = clock + 1;
        sig = '';
        render(m);
        coinsFrom(fin ? card.querySelector(`.hd-sm[data-id="${fin.id}"]`) : card, 6);
      } else render(m);
      lastDone = m.doneN;
    },
    dispose() { card.remove(); },
  };
}
