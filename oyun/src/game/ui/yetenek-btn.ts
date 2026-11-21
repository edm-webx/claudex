// Sınıf yeteneği butonu (sim/yetenek.ts): a round button above the bottom bar with the class skill's icon, a
// cooldown ring and a small label. Tap = use. Reads rt.yetenek, hidden until the esnaf is made.
import type { Rules } from '../sim/state';

const CSS = `
.yt-b{position:absolute;right:14px;bottom:110px;z-index:31;width:74px;height:74px;border-radius:50%;border:4px solid #3b2a20;background:#ffd23f;box-shadow:0 5px 0 #3b2a20;font-size:34px;line-height:1;cursor:pointer;pointer-events:auto;display:flex;align-items:center;justify-content:center;padding:0}
.yt-b.cd{background:#e9dcc4;filter:saturate(.4)}.yt-b.on{background:#8fd06b;animation:yt-p 1s infinite}
@keyframes yt-p{50%{transform:scale(1.07)}}
.yt-b svg{position:absolute;inset:-4px;width:74px;height:74px;transform:rotate(-90deg);pointer-events:none}
.yt-b span{position:absolute;bottom:-22px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#3b2a20;color:#fff6e6;border-radius:999px;padding:1px 8px;font:900 12px/1.4 var(--disp)}
`;
export function createYetenekBtn(deps: { root: HTMLElement; rules: () => Rules | null; command: (c: { kind: string; [k: string]: unknown }) => unknown }) {
  const st = document.createElement('style'); st.textContent = CSS; deps.root.appendChild(st);
  const b = document.createElement('button'); b.className = 'yt-b'; b.style.display = 'none';
  b.innerHTML = '<b></b><svg viewBox="0 0 74 74"><circle cx="37" cy="37" r="33" fill="none" stroke="#3b2a20" stroke-width="5" stroke-dasharray="207" stroke-dashoffset="207" opacity=".55"/></svg><span></span>';
  deps.root.appendChild(b);
  b.addEventListener('click', e => { e.stopPropagation(); deps.command({ kind: 'yetenek', op: 'use' }); });
  const ic = b.querySelector('b') as HTMLElement, ring = b.querySelector('circle') as SVGCircleElement, lb = b.querySelector('span') as HTMLElement;
  let key = '';
  return {
    update() {
      const r = deps.rules(); const y = r && (r.rt as unknown as { yetenek?: { ad: string; icon: string; left: number; cd: number; cdMax: number; sure: number; desc: string } }).yetenek;
      const done = !!(r && (r.state.zones as Record<string, { done?: boolean }>).esnafim?.done);
      const sheet = !!document.querySelector('.sb-sheet, .kl-p, .gr-bg');
      if (!y || !done || sheet) { b.style.display = 'none'; return; }
      b.style.display = '';
      const on = y.left > 0, cd = !on && y.cd > 0;
      const k = y.icon + (on ? 'on' + Math.ceil(y.left) : cd ? 'cd' + Math.ceil(y.cd) : 'ok');
      if (k === key) return; key = k;
      ic.textContent = y.icon; b.title = y.ad + ': ' + y.desc;
      b.classList.toggle('on', on); b.classList.toggle('cd', cd);
      ring.style.strokeDashoffset = String(on ? 207 * (1 - y.left / y.sure) : cd ? 207 * (1 - y.cd / y.cdMax) : 207);
      lb.textContent = on ? y.ad + ' ' + Math.ceil(y.left) + ' sn' : cd ? Math.ceil(y.cd) + ' sn' : y.ad;
    },
  };
}
