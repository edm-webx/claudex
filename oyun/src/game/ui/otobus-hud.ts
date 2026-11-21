// 42B otobüs HUD + ara sahne (16:52 user: "durakta otobüsü bekleyip binelim, belgrad ormanına gitsin, ara sahne geçişi").
// At a bus stop: "Otobüsü bekle" button, a countdown while the bus drives in, then "Otobüse bin". During the ride
// (rt.disari travel mode 'otobus') a full-screen 2.5D cutscene plays: parallax sky, hills, city blocks turning into
// pines, the road, and the bus itself bouncing along with the line board lit. View only: sends { kind: 'disari' }.
import { disariApi } from '../sim/disari';
import { OTOBUS } from '../../content/disari/martikoy';

interface Deps { root: HTMLElement; rules: () => unknown; command(c: { kind: string; [k: string]: unknown }): void; sfx?(id: string): void; hour(): number }
export interface OtobusHud { update(dt: number): void; dispose(): void }

const CSS = `
.ob-btn{position:fixed;left:50%;bottom:118px;transform:translateX(-50%);z-index:44;pointer-events:auto;min-height:54px;padding:0 22px;border-radius:18px;border:4px solid #3b2a20;background:#ffd23f;box-shadow:0 5px 0 #3b2a20;font:900 19px/1 var(--disp);color:#3b2a20;cursor:pointer;display:none;white-space:nowrap}
.ob-btn.wait{background:#bfe6ff;cursor:default}
.ob-to{position:fixed;left:50%;bottom:112px;transform:translateX(-50%);z-index:44;pointer-events:auto;display:none;max-width:min(560px,calc(100vw - 24px));background:#fdf3e1;border:4px solid #3b2a20;border-radius:18px;box-shadow:0 5px 0 #3b2a20;padding:10px;text-align:center;font:900 16px var(--disp);color:#3b2a20}
.ob-to div{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:8px}
.ob-to button{min-height:42px;padding:0 12px;border-radius:12px;border:3px solid #3b2a20;background:#ffd23f;font:900 15px var(--disp);color:#3b2a20;cursor:pointer}
.ob-cut{position:fixed;inset:0;z-index:66;pointer-events:auto;display:none;background:#000}
.ob-cut canvas{width:100%;height:100%;display:block}
.ob-cap{position:absolute;left:0;right:0;top:18px;text-align:center;font:900 22px/1.2 var(--disp);color:#fff;text-shadow:0 3px 0 #3b2a20,0 0 12px rgba(0,0,0,.5)}
.ob-cap small{display:block;font:800 14px var(--body);opacity:.9}
`;

export function createOtobusHud(d: Deps): OtobusHud {
  const st = document.createElement('style'); st.textContent = CSS; d.root.appendChild(st);
  const btn = document.createElement('button'); btn.className = 'ob-btn'; d.root.appendChild(btn);
  const toBox = document.createElement('div'); toBox.className = 'ob-to'; d.root.appendChild(toBox); let toKey = '';
  toBox.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (b?.dataset.to) { d.command({ kind: 'disari', op: 'otobusBin', id: b.dataset.to }); try { d.sfx?.('pick'); } catch { /* */ } } });
  const cut = document.createElement('div'); cut.className = 'ob-cut'; const cv = document.createElement('canvas'); const cap = document.createElement('div'); cap.className = 'ob-cap';
  cut.append(cv, cap); d.root.appendChild(cut);
  let mode = '';
  btn.onclick = () => { if (mode === 'bekle') d.command({ kind: 'disari', op: 'otobusBekle' }); };
  let cutOn = false, toForest = true, lastPhase = '', curTo = '';
  // scenery seeds
  const R = (i: number) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };

  function drawCut(k: number, now: number) {
    const dpr = Math.min(1.25, window.devicePixelRatio || 1), w = cut.clientWidth, h = cut.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const hr = d.hour(), night = hr >= 20 || hr < 6, dusk = hr >= 18 && hr < 20;
    // how "forest" the view is: city at the start, forest at the end (reverse on the way back)
    const f = toForest ? Math.min(1, Math.max(0, (k - 0.25) / 0.5)) : 0;
    const sky = g.createLinearGradient(0, 0, 0, h * 0.7);
    if (night) { sky.addColorStop(0, '#0d1630'); sky.addColorStop(1, '#2a3a5a'); } else if (dusk) { sky.addColorStop(0, '#3a4a8a'); sky.addColorStop(1, '#f2a65a'); } else { sky.addColorStop(0, '#6fb6e8'); sky.addColorStop(1, '#cfe9f5'); }
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const tt = now / 1000, ground = h * 0.72;
    // sun / moon
    g.fillStyle = night ? '#f4f0dc' : '#fff4c0'; g.beginPath(); g.arc(w * 0.8, h * 0.18, 28, 0, Math.PI * 2); g.fill();
    // far hills
    const layer = (speed: number, y: number, amp: number, col: string, freq: number) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w + 20; x += 20) { const u = (x + tt * speed) * freq; g.lineTo(x, y - Math.sin(u) * amp - Math.sin(u * 2.3 + 1) * amp * 0.4); }
      g.lineTo(w, h); g.closePath(); g.fill();
    };
    layer(12, h * 0.5, 26, night ? '#24344a' : '#9cc3b0', 0.006);
    layer(30, h * 0.58, 20, night ? '#1d2c3a' : '#6f9e7a', 0.01);
    // mid layer: city blocks fading into pines
    const span = 90, off = (tt * 90) % span;
    for (let i = -1; i < w / span + 2; i++) {
      const x = i * span - off, seed = Math.floor((tt * 90) / span) + i;
      if (R(seed) < 1 - f) {
        const bh = 60 + R(seed + 3) * 90, bw = 60 + R(seed + 5) * 20;
        g.fillStyle = ['#e6c9a0', '#d9a07a', '#c9d6df', '#f0e0c0'][Math.floor(R(seed + 7) * 4)]; g.fillRect(x, ground - bh, bw, bh);
        g.fillStyle = night ? '#ffd97a' : '#8fb8cc';
        for (let wy = ground - bh + 12; wy < ground - 16; wy += 22) for (let wx = x + 10; wx < x + bw - 12; wx += 18) if (!night || R(wx + wy) > 0.4) g.fillRect(wx, wy, 9, 12);
        g.fillStyle = '#a8553d'; g.fillRect(x - 3, ground - bh - 6, bw + 6, 8);
      } else {
        for (let j = 0; j < 2; j++) {
          const px = x + j * 45 + R(seed + j) * 20, ph = 90 + R(seed + j * 3) * 60;
          g.fillStyle = '#5a3d26'; g.fillRect(px - 4, ground - 24, 8, 24);
          g.fillStyle = night ? '#1f3d2c' : (j ? '#3a7d4e' : '#2f6e44');
          for (let s = 0; s < 3; s++) { const sy = ground - 20 - s * ph * 0.28, sw = 34 - s * 9; g.beginPath(); g.moveTo(px - sw, sy); g.lineTo(px + sw, sy); g.lineTo(px, sy - ph * 0.42); g.closePath(); g.fill(); }
        }
      }
    }
    // road
    g.fillStyle = '#4a4d52'; g.fillRect(0, ground, w, h - ground);
    g.fillStyle = f > 0.5 ? '#6f9e55' : '#cfc6b6'; g.fillRect(0, ground - 6, w, 8);
    g.fillStyle = '#f2f0e6'; const dash = 70, doff = (tt * 420) % dash;
    for (let x = -dash; x < w + dash; x += dash) g.fillRect(x - doff, ground + (h - ground) * 0.5, 36, 5);
    // near bushes / lamp posts whizzing by
    const nspan = 260, noff = (tt * 420) % nspan;
    for (let i = -1; i < w / nspan + 2; i++) {
      const x = i * nspan - noff;
      if (f > 0.5) { g.fillStyle = night ? '#173022' : '#3f7a3a'; g.beginPath(); g.arc(x, h - 6, 40, Math.PI, 0); g.fill(); }
      else { g.fillStyle = '#5a5f66'; g.fillRect(x, h - 150, 7, 150); g.fillStyle = night ? '#ffe9a8' : '#cfd6dc'; g.fillRect(x - 14, h - 154, 30, 8); }
    }
    // the bus (side view), bouncing
    const bw = Math.min(w * 0.55, 420), bh = bw * 0.3, bx = w * 0.5 - bw / 2 + Math.sin(tt * 0.7) * 10, by = ground + (h - ground) * 0.38 - bh + Math.sin(tt * 13) * 1.6;
    const rr = (x: number, y: number, ww: number, hh: number, r: number) => { g.beginPath(); g.roundRect(x, y, ww, hh, r); };
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(bx + bw / 2, by + bh + 8, bw * 0.52, 8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f4f1ea'; rr(bx, by, bw, bh, 14); g.fill();
    g.fillStyle = '#e8742c'; rr(bx, by + bh * 0.72, bw, bh * 0.28, 8); g.fill();
    g.fillStyle = '#2f8f9a'; g.fillRect(bx + 6, by + bh * 0.66, bw - 12, 4);
    g.fillStyle = '#1d2a36'; for (let i = 0; i < 7; i++) rr(bx + 14 + i * (bw - 60) / 7, by + bh * 0.14, (bw - 60) / 7 - 6, bh * 0.42, 4), g.fill();
    rr(bx + bw - 40, by + bh * 0.1, 30, bh * 0.52, 6); g.fill();
    // passengers' heads in windows
    g.fillStyle = '#c98d62'; for (let i = 0; i < 7; i++) if (R(i + 11) > 0.35) { g.beginPath(); g.arc(bx + 14 + (i + 0.5) * (bw - 60) / 7 - 3, by + bh * 0.42, bh * 0.08, 0, Math.PI * 2); g.fill(); }
    // Sabri waving from a window (red apron hint)
    g.fillStyle = '#e0533c'; g.fillRect(bx + 14 + 2.5 * (bw - 60) / 7 - 12, by + bh * 0.47, 18, bh * 0.08);
    g.fillStyle = '#0b0b0b'; rr(bx + bw * 0.55, by + 4, bw * 0.3, bh * 0.1, 3); g.fill();
    g.fillStyle = '#ffb21e'; g.font = `900 ${Math.round(bh * 0.08)}px monospace`; g.textBaseline = 'middle'; g.fillText(OTOBUS.line + ' ' + curTo.toLocaleUpperCase('tr'), bx + bw * 0.56, by + 4 + bh * 0.05);
    for (const wx of [bx + bw * 0.2, bx + bw * 0.8]) {
      const a = tt * 18; g.fillStyle = '#1b1b1b'; g.beginPath(); g.arc(wx, by + bh, bh * 0.17, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c9ccd2'; g.beginPath(); g.arc(wx, by + bh, bh * 0.09, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#555'; g.lineWidth = 2; g.beginPath(); g.moveTo(wx + Math.cos(a) * bh * 0.09, by + bh + Math.sin(a) * bh * 0.09); g.lineTo(wx - Math.cos(a) * bh * 0.09, by + bh - Math.sin(a) * bh * 0.09); g.stroke();
    }
    g.fillStyle = night ? '#fff2c0' : '#fff6d8'; rr(bx + bw - 8, by + bh * 0.7, 8, bh * 0.12, 3); g.fill();
    if (night) { const gl = g.createRadialGradient(bx + bw + 30, by + bh * 0.76, 2, bx + bw + 30, by + bh * 0.76, 90); gl.addColorStop(0, 'rgba(255,240,180,.5)'); gl.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = gl; g.fillRect(bx + bw - 60, by - 40, 200, 160); }
    // fade in/out
    const a = k < 0.08 ? 1 - k / 0.08 : k > 0.92 ? (k - 0.92) / 0.08 : 0;
    if (a > 0) { g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(0, 0, w, h); }
  }

  return {
    update() {
      const api = disariApi(d.rules() as never); if (!api) return;
      const v = api.view();
      // cutscene
      const tr = v.travel;
      if (tr && tr.mode === 'otobus') {
        if (!cutOn) { cutOn = true; toForest = tr.to === 'Orman'; curTo = tr.to; cut.style.display = 'block'; cap.innerHTML = `${OTOBUS.line} · ${tr.from ? tr.from + ' → ' : ''}${tr.to}<small>${OTOBUS.driver}: "Arkaya ilerleyelim, kapı önünü boşaltalım!"</small>`; try { d.sfx?.('busStart'); } catch { /* */ } }
        drawCut(Math.min(1, tr.t / tr.dur), performance.now());
      } else if (cutOn) { cutOn = false; cut.style.display = 'none'; }
      // stop button
      const b = v.bus; let m = '', label = '';
      const ph = b ? b.phase : ''; if (ph !== lastPhase) { if (ph === 'durakta' || (ph === 'gidiyor' && lastPhase === 'durakta')) { try { d.sfx?.('busDoor'); } catch { /* */ } } if (ph === 'geliyor') { try { d.sfx?.('busStart'); } catch { /* */ } } lastPhase = ph; }
      if (!tr && v.atBusStop) {
        if (!b) { m = 'bekle'; label = `🚌 ${OTOBUS.line} otobüsünü bekle`; }
        else if (b.phase === 'geliyor') { m = 'wait'; label = `🚌 Otobüs geliyor... ${Math.max(1, Math.ceil(b.dur - b.t))}`; }
        else if (b.phase === 'durakta' && !v.atBusDoor) { m = 'wait'; label = '🚌 Otobüs geldi! Yola in, ön kapısından bin'; }
      }
      const showTo = !tr && !!b && b.phase === 'durakta' && v.atBusDoor;
      const tk = showTo ? v.busTo.map(x => x.id).join(',') : '';
      if (tk !== toKey) {
        toKey = tk; toBox.style.display = showTo ? 'block' : 'none';
        if (showTo) toBox.innerHTML = `🚌 ${OTOBUS.line} · Nereye? <small style="font:700 12px var(--body)">(${OTOBUS.fare} ₺)</small><div>${v.busTo.length ? v.busTo.map(x => `<button data-to="${x.id}">${x.name}</button>`).join('') : '<span style="font:700 13px var(--body)">Önce yürüyerek bir durak keşfet.</span>'}</div>`;
      }
      if (showTo) m = '';
      if (m !== mode || btn.textContent !== label) { mode = m; btn.textContent = label; btn.style.display = m ? 'block' : 'none'; btn.classList.toggle('wait', m === 'wait'); }
    },
    dispose() { st.remove(); btn.remove(); toBox.remove(); cut.remove(); },
  };
}
