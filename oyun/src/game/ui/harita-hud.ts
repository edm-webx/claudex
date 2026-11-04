// Martıköy HUD pieces (survey disari-1..9, kontrol-3): the corner minimap (only away from the pier, tap = open map),
// the travel overlay (dolmuş / vapur / own vehicle crossing the screen while the sim teleports Sabri underneath) and
// the "ask a citizen" direction banner. DOM only; reads disariApi(rules).view(), writes nothing but commands.
import { disariApi, type DisariView } from '../sim/disari';
import { REGIONS } from '../../content/disari/martikoy';
import type { Rules } from '../sim/state';

export interface HaritaHudDeps { root: HTMLElement; rules: () => Rules | null; command: (c: { kind: string; [k: string]: unknown }) => void; sfx?: (id: string) => void }
export interface HaritaHud { update(dt: number): void; dispose(): void }

const CSS = `
.mk-mini{position:absolute;left:calc(var(--sl,0px) + 10px);top:calc(var(--hudb,64px) + 50px);width:168px;height:70px;border:3px solid #3b2a20;border-radius:14px;background:#f7ecd2;box-shadow:0 3px 0 #3b2a20;z-index:28;pointer-events:auto;overflow:hidden;cursor:pointer;transition:opacity .3s,transform .3s}
.mk-mini.off{opacity:0;transform:translateY(-8px);pointer-events:none}
.mk-mini canvas{display:block;width:100%;height:100%}
.mk-mini b{position:absolute;left:6px;top:3px;font:900 11px/1 var(--disp,system-ui);color:#7a4a12;pointer-events:none}
.mk-trav{position:absolute;inset:0;z-index:66;pointer-events:auto;overflow:hidden;opacity:0;transition:opacity .25s;background:linear-gradient(180deg,#9fd3f5 0 58%,#e8d6ac 58% 70%,#7a7468 70% 100%)}
.mk-trav.sea{background:linear-gradient(180deg,#9fd3f5 0 56%,#3f8fbf 56% 100%)}
.mk-trav.on{opacity:1}
.mk-trav .veh{position:absolute;left:0;top:calc(58% - 74px);font-size:84px;line-height:1;will-change:transform;filter:drop-shadow(0 6px 0 rgba(0,0,0,.18))}
.mk-trav.sea .veh{top:calc(56% - 70px)}
.mk-trav .lane{position:absolute;left:0;right:0;top:84%;height:6px;background:repeating-linear-gradient(90deg,#f6efe1 0 34px,transparent 34px 62px)}
.mk-trav.sea .lane{top:70%;height:4px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.6) 0 18px,transparent 18px 40px)}
.mk-trav .cap{position:absolute;left:50%;top:18%;transform:translateX(-50%);background:#fffaf1;border:3px solid #3b2a20;border-radius:18px;box-shadow:0 4px 0 #3b2a20;padding:10px 18px;font:900 20px/1.2 var(--disp,system-ui);color:#3b2a20;text-align:center;white-space:nowrap}
.mk-trav .cap small{display:block;font:800 14px/1.3 var(--body,system-ui);opacity:.8}
.mk-trav .gull{position:absolute;font-size:30px;top:10%}
.mk-arrow{position:absolute;left:50%;top:calc(var(--hudb,64px) + 96px);transform:translateX(-50%);z-index:29;pointer-events:none;background:#fffaf1;border:3px solid #3b2a20;border-radius:999px;box-shadow:0 3px 0 #3b2a20;padding:6px 16px;font:900 18px/1.2 var(--disp,system-ui);color:#3b2a20;display:none;white-space:nowrap}
.mk-arrow i{display:inline-block;font-style:normal;animation:mk-nudge .7s ease-in-out infinite}
@keyframes mk-nudge{50%{transform:translateX(6px)}}
.mk-arrow.w i{animation-name:mk-nudgew}@keyframes mk-nudgew{50%{transform:translateX(-6px)}}
`;
const ICON: Record<string, string> = { dolmus: '🚐', vapur: '⛴', bisiklet: '🚲', motor: '🛵', kayik: '🚣', yaya: '🚶' };
const SAY: Record<string, string> = { dolmus: 'Martıköy Dolmuşu', vapur: 'Vapur', bisiklet: 'Zırr zırr!', motor: 'Vızvız!', kayik: 'Kürek, kürek!', yaya: 'Yürüyoruz' };
const X0 = -62, X1 = 344;

export function createHaritaHud(d: HaritaHudDeps): HaritaHud {
  const style = document.createElement('style'); style.textContent = CSS; d.root.appendChild(style);
  const mini = document.createElement('div'); mini.className = 'mk-mini off'; mini.setAttribute('role', 'button'); mini.setAttribute('aria-label', 'Martıköy haritası');
  mini.innerHTML = '<canvas width="336" height="140"></canvas><b>MARTIKÖY</b>';
  d.root.appendChild(mini);
  const cv = mini.querySelector('canvas') as HTMLCanvasElement, g = cv.getContext('2d');
  mini.addEventListener('click', () => d.command({ kind: 'disari', op: 'open' }));
  const trav = document.createElement('div'); trav.className = 'mk-trav'; trav.style.display = 'none';
  trav.innerHTML = '<div class="lane"></div><div class="gull" style="left:20%">🕊</div><div class="gull" style="left:70%;top:16%">🕊</div><div class="veh"></div><div class="cap"></div>';
  d.root.appendChild(trav);
  const veh = trav.querySelector('.veh') as HTMLElement, cap = trav.querySelector('.cap') as HTMLElement;
  const arrow = document.createElement('div'); arrow.className = 'mk-arrow'; d.root.appendChild(arrow);
  let drawT = 0, travKey = '', lastArrow = '';

  function drawMini(v: DisariView) {
    if (!g) return;
    const W = cv.width, H = cv.height, sx = (x: number) => 8 + ((x - X0) / (X1 - X0)) * (W - 16);
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#f7ecd2'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#a9d8ee'; g.fillRect(0, H - 34, W, 34);
    for (const r of REGIONS) {
      const a = sx(r.x0), b = sx(r.x1);
      g.fillStyle = v.open[r.id] ? r.color : '#cfc6b6'; g.globalAlpha = v.region === r.id ? 0.95 : 0.6;
      g.fillRect(a + 1, 30, b - a - 2, H - 70); g.globalAlpha = 1;
      g.strokeStyle = '#3b2a20'; g.lineWidth = 2; g.strokeRect(a + 1, 30, b - a - 2, H - 70);
      if (!v.open[r.id]) { g.fillStyle = '#3b2a20'; g.font = '900 22px system-ui'; g.textAlign = 'center'; g.fillText('🔒', (a + b) / 2, 70); }
    }
    g.strokeStyle = '#8a7f70'; g.lineWidth = 4; g.setLineDash([10, 6]); g.beginPath(); g.moveTo(8, H - 52); g.lineTo(W - 8, H - 52); g.stroke(); g.setLineDash([]);
    const tgt = v.guide || v.owner;
    if (tgt) { const x = sx(tgt.x); g.fillStyle = '#ffd23f'; g.strokeStyle = '#3b2a20'; g.lineWidth = 2; star(g, x, H - 52, 11); }
    const rules = d.rules(), p = rules ? rules.playerPos : null;
    if (p) { const x = sx(p.x); g.fillStyle = '#e0533c'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(x, H - 52, 9, 0, Math.PI * 2); g.fill(); g.stroke(); }
  }
  function star(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.fill(); c.stroke();
  }

  return {
    update(dt) {
      const api = disariApi(d.rules()); if (!api) return;
      const v = api.view();
      // minimap: away from the pier only
      const show = v.away && !v.travel;
      mini.classList.toggle('off', !show);
      if (show && (drawT -= dt) <= 0) { drawT = 0.12; drawMini(v); }
      // travel overlay
      const t = v.travel;
      if (t) {
        const key = t.mode + t.to;
        if (key !== travKey) {
          travKey = key; trav.style.display = ''; trav.classList.toggle('sea', t.mode === 'vapur' || t.mode === 'kayik');
          veh.textContent = ICON[t.mode] || '🚐';
          cap.innerHTML = `${SAY[t.mode] || ''}<small>${t.from ? t.from + ' → ' : ''}${t.to}</small>`;
          requestAnimationFrame(() => trav.classList.add('on'));
          try { d.sfx?.(t.mode === 'vapur' ? 'ferryHorn' : 'pick'); } catch { /* */ }
        }
        const k = Math.min(1, t.t / t.dur), w = d.root.clientWidth || 390;
        const bob = Math.sin(t.t * (t.mode === 'vapur' ? 4 : 14)) * (t.mode === 'vapur' ? 5 : 3);
        // vehicles face left in the emoji set: travel right-to-left
        veh.style.transform = `translate(${(1 - k) * (w + 120) - 110}px, ${bob}px)`;
        if (k > 0.85) trav.classList.remove('on');
      } else if (travKey) { travKey = ''; trav.classList.remove('on'); setTimeout(() => { if (!travKey) trav.style.display = 'none'; }, 260); }
      // ask-a-citizen arrow
      const a = v.arrow;
      const ak = a ? a.text + a.dir : '';
      if (ak !== lastArrow) {
        lastArrow = ak;
        if (a) { arrow.style.display = 'block'; arrow.classList.toggle('w', a.dir < 0); arrow.innerHTML = a.dir > 0 ? `${esc(a.text)} <i>➜</i>` : `<i>⬅</i> ${esc(a.text)}`; }
        else arrow.style.display = 'none';
      }
    },
    dispose() { style.remove(); mini.remove(); trav.remove(); arrow.remove(); },
  };
}
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
