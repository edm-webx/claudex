// Altın Simit kazanma anı (survey altin-9): whenever GameState.gold goes up (any source: albüm sayfası, mini oyun,
// sipariş, başarım, reklam...), a golden simit rolls across the screen with "+N Altın Simit" and a sweet "çın" chime.
// Pure view: reads sim state only. The chime is a tiny WebAudio bell (two sine partials), silent when muted.
// Decisions: the first frame only records the value (no burst on load); drops (spending, reset) just re-baseline.
import { SIMIT_SVG } from './koleksiyon-panel';

export interface AltinSimitFxDeps { root: HTMLElement; rules: () => { state: { gold: number; settings?: { muted?: boolean } } } | null }
export interface AltinSimitFx { update(dt: number): void; dispose(): void }

const CSS = `
.asf-roll{position:absolute;left:0;bottom:22%;z-index:70;pointer-events:none;display:flex;align-items:center;gap:8px;animation:asfRoll 2.1s cubic-bezier(.25,.6,.35,1) forwards}
.asf-roll .s{display:block;animation:asfSpin .55s linear infinite;filter:drop-shadow(0 4px 0 rgba(0,0,0,.25)) drop-shadow(0 0 10px #ffe58a)}
.asf-roll b{font:900 24px/1 var(--disp,system-ui);color:#fff6c8;-webkit-text-stroke:2px #7a4a12;paint-order:stroke;text-shadow:0 3px 0 #7a4a12;white-space:nowrap;animation:asfPop 2.1s ease forwards}
@keyframes asfRoll{0%{transform:translateX(-90px)}70%{transform:translateX(calc(50vw - 60px))}82%{transform:translateX(calc(50vw - 46px)) translateY(-14px)}100%{transform:translateX(calc(50vw - 50px)) translateY(-40px);opacity:0}}
@keyframes asfSpin{to{transform:rotate(360deg)}}
@keyframes asfPop{0%,40%{opacity:0;transform:scale(.6)}55%{opacity:1;transform:scale(1.15)}75%{transform:scale(1)}100%{opacity:0}}
`;

export function createAltinSimitFx(d: AltinSimitFxDeps): AltinSimitFx {
  const style = document.createElement('style'); style.textContent = CSS; d.root.appendChild(style);
  let last = NaN, ctx: AudioContext | null = null, pending = 0, cool = 0;
  const live: HTMLElement[] = [];

  function chime(): void {
    try {
      const r = d.rules();
      if (r?.state.settings?.muted) return;
      const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx ||= new AC();
      if (ctx.state === 'suspended') void ctx.resume();
      const t0 = ctx.currentTime;
      for (const [f, v, at] of [[1568, 0.16, 0], [2349, 0.09, 0], [2093, 0.12, 0.09], [3136, 0.06, 0.09]] as [number, number, number][]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(v, t0 + at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.9);
        o.connect(g).connect(ctx.destination); o.start(t0 + at); o.stop(t0 + at + 1);
      }
    } catch { /* audio optional */ }
  }
  function roll(n: number): void {
    const el = document.createElement('div');
    el.className = 'asf-roll';
    el.innerHTML = `<span class="s">${SIMIT_SVG(58)}</span><b>+${n} Altın Simit</b>`;
    el.style.bottom = (20 + (live.length % 3) * 9) + '%';
    d.root.appendChild(el); live.push(el);
    setTimeout(() => { el.remove(); const i = live.indexOf(el); if (i >= 0) live.splice(i, 1); }, 2200);
    chime();
  }
  return {
    update(dt) {
      const r = d.rules();
      if (!r) return;
      const g = Number(r.state.gold) || 0;
      if (Number.isNaN(last)) { last = g; return; }
      if (g > last) pending += g - last;
      last = g;
      cool -= dt;
      if (pending > 0 && cool <= 0 && live.length < 3) { roll(Math.round(pending)); pending = 0; cool = 0.45; }
    },
    dispose() { style.remove(); for (const el of live) el.remove(); live.length = 0; try { void ctx?.close(); } catch { /* */ } },
  };
}
