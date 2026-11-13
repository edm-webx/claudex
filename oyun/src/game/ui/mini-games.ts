// Mini oyun overlay (survey mini-1..11, icecek-8/9). DOM + one 2D canvas, view only: reads the sim's mini API
// (rules.rt.mini) and sends { kind: 'mini', ... } commands; it never writes sim state.
// - When the sim starts a round (op 'play'/'practice'), a full-screen overlay opens: intro card -> 20..60 s round ->
//   result card (score, stars, rewards; comic fail moment + consolation on 0 stars). One finger only: taps or a hold.
// - Station prompts: a small bubble "Ustalık hareketi" while the sim offers a micro-move; tapping it runs a 5..6 s
//   micro game (çay to the line, Türk kahvesi off the fire, ayran shake). Ignoring it is fine: drinks stay automatic.
// - A small chip shows the 5 min ×1.5 sales bonus while it runs.
// Decisions: the canvas runs its own requestAnimationFrame loop while open (the sim is paused meanwhile); visual
// variety uses Math.random (UI code, not sim); scores are 0..100 and the sim turns them into stars and rewards.
import { miniApi, type MiniApi, type MiniResult } from '../sim/mini';
import { GAME_BY_ID, MICRO, type MiniId, type MicroId } from '../../content/mini-oyunlar';

type Cmd = { kind: string; [k: string]: unknown };
export interface MiniGamesDeps { root: HTMLElement; rules: () => { rt: unknown }; command(c: Cmd): void; sfx?(id: string): void; }
export interface MiniGamesView { update(dt: number): void; dispose(): void; }

interface Game {
  secs: number;
  step(dt: number): void;
  draw(g: CanvasRenderingContext2D): void;
  down(x: number, y: number): void;
  up?(): void;
  score(): number;
  /** small status text under the timer */
  hud(): string;
  /** micro games end early */
  done?(): boolean;
}

const INK = '#3b2a20';
const CSS = `
.mg-ov{position:absolute;inset:0;z-index:60;pointer-events:auto;background:linear-gradient(#bfe3f6,#ffe7c2);touch-action:none;user-select:none;-webkit-user-select:none}
.mg-ov canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.mg-hd{position:absolute;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top,0px));display:flex;gap:8px;align-items:center;z-index:2;pointer-events:none}
.mg-hd h2{flex:1;margin:0;font:900 20px/1.1 var(--disp);color:var(--ink);text-shadow:0 2px 0 #fff}
.mg-hd .x{pointer-events:auto;width:46px;height:46px;border:2.5px solid var(--ink);border-radius:14px;background:var(--cream);font:900 22px/1 var(--disp);color:var(--ink)}
.mg-tm{position:absolute;left:12px;right:12px;top:calc(62px + env(safe-area-inset-top,0px));height:14px;border:2.5px solid var(--ink);border-radius:9px;background:#fff;overflow:hidden;z-index:2}
.mg-tm i{display:block;height:100%;background:var(--tea);width:100%}
.mg-st{position:absolute;left:0;right:0;top:calc(84px + env(safe-area-inset-top,0px));text-align:center;font:900 19px/1.2 var(--disp);color:var(--ink);text-shadow:0 2px 0 #fff;z-index:2;pointer-events:none}
.mg-cd{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:3;background:rgba(59,42,32,.35);padding:16px}
.mg-cd .c{width:100%;max-width:380px;background:var(--paper);border:3px solid var(--ink);border-radius:22px;box-shadow:0 6px 0 var(--ink);padding:18px 16px;text-align:center}
.mg-cd h3{margin:0 0 8px;font:900 26px/1.1 var(--disp)}
.mg-cd p{margin:6px 0;font:800 18px/1.35 var(--body)}
.mg-cd .big{font:900 44px/1 var(--disp);margin:6px 0}
.mg-cd .rw{display:flex;flex-direction:column;gap:6px;margin:10px 0;font:800 17px/1.25 var(--body)}
.mg-cd .rw span{background:var(--cream2);border:2px solid var(--ink);border-radius:12px;padding:6px 10px}
.mg-cd .row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.mg-cd .sb-btn{min-height:58px;font-size:19px;width:100%}
.mg-cd .fail{animation:mgwob .5s ease-in-out 3}
.mg-sr{font-size:40px;letter-spacing:4px}
@keyframes mgwob{0%,100%{transform:rotate(0)}25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
.mg-bub{position:absolute;left:50%;bottom:calc(150px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:30;pointer-events:auto;display:flex;align-items:center;gap:6px;animation:mgpop .35s ease-out}
.mg-bub .sb-btn{min-height:58px;font-size:18px;background:var(--foam)}
.mg-bub .sk{min-height:46px;width:46px;padding:0;background:var(--cream)}
@keyframes mgpop{0%{transform:translateX(-50%) scale(.6)}80%{transform:translateX(-50%) scale(1.06)}100%{transform:translateX(-50%) scale(1)}}
.mg-chip{position:absolute;right:10px;top:calc(118px + env(safe-area-inset-top,0px));z-index:25;pointer-events:none;background:var(--yellow);border:2.5px solid var(--ink);border-radius:999px;padding:4px 10px;font:900 15px/1.1 var(--disp);color:var(--ink);box-shadow:0 3px 0 var(--ink)}
`;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke = INK, lw = 3) {
  g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
}
function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string | null, stroke: string | null = INK, lw = 3) {
  g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
}
function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = INK) {
  g.font = `900 ${size}px "Baloo 2", Nunito, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 5; g.strokeStyle = '#fff'; g.strokeText(s, x, y); g.fillStyle = color; g.fillText(s, x, y);
}
interface Pop { s: string; x: number; y: number; t: number; c: string }
function pops() {
  const list: Pop[] = [];
  return {
    add(s: string, x: number, y: number, c = INK) { list.push({ s, x, y, t: 0, c }); if (list.length > 8) list.shift(); },
    step(dt: number) { for (const p of list) p.t += dt; while (list.length && list[0].t > 0.9) list.shift(); },
    draw(g: CanvasRenderingContext2D) { for (const p of list) { g.globalAlpha = 1 - p.t / 0.9; text(g, p.s, p.x, p.y - p.t * 50, 26, p.c); } g.globalAlpha = 1; },
  };
}

// ───────────────────────── 1. Dürüm Sarma Ritmi ─────────────────────────
function durum(W: number, H: number): Game {
  const cx = W / 2, cy = H * 0.52, R0 = Math.min(W, H) * 0.36, RT = Math.min(W, H) * 0.13;
  let ring = -1, beat = 0, period = 0.95, pts = 0, beats = 0, rolled = 0, flap = 0, t = 0;
  const P = pops();
  const spawn = () => { ring = R0; beats++; };
  return {
    secs: 30,
    step(dt) {
      t += dt; P.step(dt); flap = Math.max(0, flap - dt);
      if (ring < 0) { beat -= dt; if (beat <= 0) spawn(); return; }
      ring -= dt * (R0 - RT) / period;
      if (ring < RT - 18) { ring = -1; beat = 0.25; flap = 0.6; P.add('Kaçtı!', cx, cy - RT - 30, '#b8392a'); period = Math.max(0.6, period - 0.005); }
    },
    draw(g) {
      // counter
      rr(g, cx - W * 0.42, cy - 10 + RT + 40, W * 0.84, 40, 12, '#c99a6b');
      // lavaş
      const wob = flap > 0 ? Math.sin(t * 40) * 10 * flap : 0;
      g.save(); g.translate(cx, cy); g.rotate(wob * 0.02);
      circle(g, 0, 0, RT * 1.25, '#f2d39b'); circle(g, 0, 0, RT * 0.9, null, '#e0b06a', 2);
      g.fillStyle = '#e0533c'; for (let i = 0; i < 5; i++) { const a = i * 1.26; circle(g, Math.cos(a) * RT * 0.5, Math.sin(a) * RT * 0.5, 7, '#e0533c', null); }
      g.fillStyle = '#6bb36b'; for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.6; circle(g, Math.cos(a) * RT * 0.7, Math.sin(a) * RT * 0.7, 6, '#6bb36b', null); }
      g.restore();
      circle(g, cx, cy, RT, null, '#2f8f4c', 6);
      if (ring > 0) { const d = Math.abs(ring - RT); circle(g, cx, cy, ring, null, d < 8 ? '#2f8f4c' : d < 18 ? '#d9822b' : INK, 5); }
      // rolled dürüms
      for (let i = 0; i < Math.min(rolled, 14); i++) rr(g, 14 + (i % 7) * 22, H - 110 - Math.floor(i / 7) * 22, 18, 16, 8, '#f2d39b', INK, 2);
      P.draw(g);
    },
    down() {
      if (ring < 0) return;
      const d = Math.abs(ring - RT);
      if (d < 8) { pts += 2; rolled++; P.add('Harika!', cx, cy - RT - 30, '#2f8f4c'); }
      else if (d < 18) { pts += 1; rolled++; P.add('İyi', cx, cy - RT - 30, '#d9822b'); }
      else { flap = 0.5; P.add('Erken!', cx, cy - RT - 30, '#b8392a'); }
      ring = -1; beat = 0.2; period = Math.max(0.6, period - 0.012);
    },
    score: () => beats ? clamp(pts / (2 * Math.max(beats, 18)) * 118, 0, 100) : 0,
    hud: () => 'Sarılan dürüm: ' + rolled,
  };
}

// ───────────────────────── 2. Çay Bardağı Kulesi ─────────────────────────
function kule(W: number, H: number): Game {
  const gw = 46, gh = 40, base = H - 120;
  const stack: number[] = [W / 2];
  let x = 40, dir = 1, speed = 150, fall: { x: number; y: number; vy: number; r: number } | null = null, perfect = 0, msg = 0, wob = 0;
  const P = pops();
  const topY = () => base - stack.length * gh;
  const cam = () => Math.max(0, stack.length - 7) * gh;
  return {
    secs: 45,
    step(dt) {
      P.step(dt); wob = Math.max(0, wob - dt); msg = Math.max(0, msg - dt);
      x += dir * speed * dt;
      if (x > W - gw / 2 - 10) { x = W - gw / 2 - 10; dir = -1; } else if (x < gw / 2 + 10) { x = gw / 2 + 10; dir = 1; }
      if (fall) { fall.vy += 900 * dt; fall.y += fall.vy * dt; fall.r += dt * 6; if (fall.y > H + 60) fall = null; }
    },
    draw(g) {
      const c = cam();
      g.save(); g.translate(0, c);
      rr(g, W / 2 - 80, base, 160, 18, 9, '#b98a5e');
      stack.forEach((sx, i) => {
        const y = base - (i + 1) * gh, w = wob > 0 && i === stack.length - 1 ? Math.sin(wob * 40) * 4 : 0;
        if (i === 0) return;
        glass(g, sx + w, y);
      });
      g.restore();
      // moving glass on the tray
      const ty = topY() - gh - 50 + c;
      glass(g, x, ty);
      rr(g, x - 34, ty + gh, 68, 8, 4, '#cfc8be', INK, 2);
      if (fall) { g.save(); g.translate(fall.x, fall.y); g.rotate(fall.r); glass(g, 0, 0); g.restore(); }
      P.draw(g);
    },
    down() {
      const top = stack[stack.length - 1];
      const dx = Math.abs(x - top);
      const c = cam();
      if (stack.length === 1 || dx < gw * 0.55) {
        const nx = stack.length === 1 ? x : (dx < 6 ? top : x);
        if (stack.length > 1 && dx < 6) { perfect++; P.add('Tam ortası!', W / 2, topY() - 30 + c, '#2f8f4c'); } else P.add('+1', nx, topY() - 30 + c, '#2f8f4c');
        stack.push(nx); speed = Math.min(380, speed + 14); wob = 0.3;
      } else {
        fall = { x, y: topY() - gh - 50 + c, vy: -120, r: 0 }; msg = 1;
        P.add('Eyvah! Yumuşak iniş.', W / 2, H * 0.3, '#b8392a');
        speed = Math.max(140, speed - 30);
      }
    },
    score: () => clamp((stack.length - 1) * 7 + perfect * 2, 0, 100),
    hud: () => 'Kule: ' + (stack.length - 1) + ' bardak',
  };
  function glass(g: CanvasRenderingContext2D, cx: number, y: number) {
    g.beginPath(); g.moveTo(cx - gw / 2, y); g.lineTo(cx + gw / 2, y); g.lineTo(cx + gw / 2 - 7, y + gh - 4); g.lineTo(cx - gw / 2 + 7, y + gh - 4); g.closePath();
    g.fillStyle = 'rgba(255,255,255,.75)'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.moveTo(cx - gw / 2 + 4, y + 9); g.lineTo(cx + gw / 2 - 4, y + 9); g.lineTo(cx + gw / 2 - 8, y + gh - 7); g.lineTo(cx - gw / 2 + 8, y + gh - 7); g.closePath();
    g.fillStyle = '#c2551f'; g.fill();
  }
}

// ───────────────────────── 3. Tost Makinesi Zamanlaması ─────────────────────────
function tost(W: number, H: number): Game {
  const n = 3, mw = Math.min(110, (W - 40) / 3 - 10), my = H * 0.5;
  const m = Array.from({ length: n }, (_, i) => ({ x: 20 + (W - 40) * (i + 0.5) / n, c: -rnd(0, 1.2), rate: rnd(0.22, 0.34), pop: 0, wait: 0 }));
  let good = 0, perf = 0;
  const P = pops();
  const col = (c: number) => { const k = clamp(c, 0, 1.15); const r = Math.round(250 - k * 120), gg = Math.round(235 - k * 150), b = Math.round(200 - k * 170); return `rgb(${r},${Math.max(40, gg)},${Math.max(20, b)})`; };
  return {
    secs: 40,
    step(dt) {
      P.step(dt);
      for (const t of m) {
        if (t.wait > 0) { t.wait -= dt; if (t.wait <= 0) { t.c = 0; t.rate = rnd(0.2, 0.36); } continue; }
        t.pop = Math.max(0, t.pop - dt);
        t.c += t.rate * dt;
        if (t.c >= 1.05) { P.add('Fazla esmer!', t.x, my - 90, '#7d5638'); t.wait = 0.7; t.pop = 0.5; }
      }
    },
    draw(g) {
      for (const t of m) {
        rr(g, t.x - mw / 2, my - 40, mw, 90, 16, '#9aa3ab');
        rr(g, t.x - mw / 2 + 8, my - 30, mw - 16, 18, 6, '#c7ced4', INK, 2);
        // golden zone meter
        const bx = t.x - mw / 2 + 6, bw = mw - 12, byy = my + 64;
        rr(g, bx, byy, bw, 14, 7, '#fff', INK, 2);
        g.fillStyle = '#ffd23f'; g.fillRect(bx + bw * 0.6, byy + 2, bw * 0.2, 10);
        if (t.wait <= 0) { const k = clamp(t.c, 0, 1); g.fillStyle = INK; g.fillRect(bx + bw * k - 2, byy - 4, 4, 22); }
        if (t.wait <= 0 && t.c > 0) rr(g, t.x - mw / 2 + 14, my - 12 - (t.pop > 0 ? 30 : 0), mw - 28, 40, 10, col(t.c), INK, 2.5);
        if (t.wait <= 0 && t.c < 0) text(g, '...', t.x, my, 24);
      }
      text(g, 'Sarı bölgede dokun!', W / 2, my + 120, 22);
      P.draw(g);
    },
    down(x) {
      let best = m[0], bd = 1e9;
      for (const t of m) { const d = Math.abs(t.x - x); if (d < bd) { bd = d; best = t; } }
      const t = best;
      if (t.wait > 0 || t.c < 0) return;
      if (t.c >= 0.6 && t.c <= 0.8) { good++; const p = Math.abs(t.c - 0.7) < 0.04; if (p) perf++; P.add(p ? 'Altın sarısı!' : 'Güzel!', t.x, my - 90, '#2f8f4c'); }
      else if (t.c < 0.6) P.add('Daha soğuk!', t.x, my - 90, '#2f7fb3');
      else P.add('Biraz geç', t.x, my - 90, '#7d5638');
      t.wait = 0.6; t.pop = 0.4;
    },
    score: () => clamp(good * 4.6 + perf * 1.5, 0, 100),
    hud: () => 'Altın tost: ' + good,
  };
}

// ───────────────────────── 4. Simit Fırlatma ─────────────────────────
function simit(W: number, H: number): Game {
  const gulls: { x: number; y: number; v: number; fed: number; flap: number }[] = [];
  const shots: { x0: number; y0: number; x1: number; y1: number; t: number }[] = [];
  const FL = 0.45;
  let spawnT = 0, caught = 0, thrown = 0;
  const P = pops();
  const add = () => { const left = Math.random() < 0.5; gulls.push({ x: left ? -40 : W + 40, y: rnd(H * 0.2, H * 0.55), v: (left ? 1 : -1) * rnd(90, 190), fed: 0, flap: Math.random() * 6 }); };
  return {
    secs: 30,
    step(dt) {
      P.step(dt);
      spawnT -= dt; if (spawnT <= 0 && gulls.length < 5) { add(); spawnT = rnd(0.6, 1.3); }
      for (const g of gulls) { g.x += g.v * dt * (g.fed > 0 ? 0.4 : 1); g.flap += dt * 10; if (g.fed > 0) { g.fed += dt; g.y -= 60 * dt; } }
      for (let i = gulls.length - 1; i >= 0; i--) if (gulls[i].x < -80 || gulls[i].x > W + 80 || gulls[i].fed > 1.6) gulls.splice(i, 1);
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i]; s.t += dt;
        if (s.t >= FL) {
          let hit = false;
          for (const g of gulls) if (!g.fed && Math.hypot(g.x - s.x1, g.y - s.y1) < 44) { g.fed = 0.01; hit = true; caught++; P.add('Hap!', g.x, g.y - 30, '#2f8f4c'); break; }
          if (!hit) P.add('Pıt', s.x1, s.y1, '#7d5638');
          shots.splice(i, 1);
        }
      }
    },
    draw(g) {
      g.fillStyle = '#6fbde2'; g.fillRect(0, H * 0.7, W, H * 0.3);
      rr(g, -10, H - 100, W + 20, 120, 0, '#c99a6b', INK, 3);
      for (const gl of gulls) {
        const f = Math.sin(gl.flap) * 10, d = gl.v > 0 ? 1 : -1;
        g.save(); g.translate(gl.x, gl.y); g.scale(d, 1);
        g.beginPath(); g.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
        g.beginPath(); g.moveTo(-8, -4); g.lineTo(-20, -18 - f); g.lineTo(6, -6); g.closePath(); g.fillStyle = '#e8eef2'; g.fill(); g.stroke();
        circle(g, 18, -8, 8, '#fff'); circle(g, 21, -9, 2, INK, null);
        g.beginPath(); g.moveTo(25, -7); g.lineTo(34, -5); g.lineTo(25, -3); g.closePath(); g.fillStyle = '#f2b632'; g.fill(); g.lineWidth = 2; g.stroke();
        if (gl.fed) circle(g, 30, -2, 8, null, '#b5733a', 5);
        g.restore();
      }
      for (const s of shots) {
        const k = s.t / FL, x = s.x0 + (s.x1 - s.x0) * k, y = s.y0 + (s.y1 - s.y0) * k - Math.sin(k * Math.PI) * 60;
        circle(g, x, y, 13, null, '#b5733a', 7); circle(g, x, y, 13, null, INK, 1.5);
        g.globalAlpha = 0.35; circle(g, s.x1, s.y1, 8, null, INK, 2); g.globalAlpha = 1;
      }
      circle(g, W / 2, H - 60, 16, null, '#b5733a', 8);
      P.draw(g);
    },
    down(x, y) { if (shots.length >= 3) return; thrown++; shots.push({ x0: W / 2, y0: H - 60, x1: x, y1: Math.min(y, H - 130), t: 0 }); },
    score: () => clamp(caught * 7.5 + (thrown ? caught / thrown : 0) * 10, 0, 100),
    hud: () => 'Doyan martı: ' + caught,
  };
}

// ───────────────────────── 5. Ayran Köpürtme ─────────────────────────
function ayran(W: number, H: number): Game {
  const gx = W / 2, gy0 = H * 0.3, gy1 = H * 0.78, gw = Math.min(170, W * 0.45);
  let f = 0.3, zc = 0.6, zv = 0.07, inT = 0, tot = 0, decay = 0.13, splash = 0, t = 0;
  const zh = 0.16;
  const P = pops();
  return {
    secs: 25,
    step(dt) {
      t += dt; P.step(dt); splash = Math.max(0, splash - dt);
      f = Math.max(0.05, f - decay * dt); decay += dt * 0.006;
      zc += zv * dt; if (zc > 0.8 || zc < 0.35) zv = -zv;
      if (t > 1) { tot += dt; if (Math.abs(f - zc) < zh / 2) inT += dt; }
    },
    draw(g) {
      const L = (v: number) => gy1 - (gy1 - gy0) * v;
      // zone
      g.fillStyle = 'rgba(73,185,106,.35)'; g.fillRect(gx - gw / 2 - 30, L(zc + zh / 2), gw + 60, L(zc - zh / 2) - L(zc + zh / 2));
      // glass
      g.beginPath(); g.moveTo(gx - gw / 2, gy0); g.lineTo(gx + gw / 2, gy0); g.lineTo(gx + gw / 2 - 16, gy1); g.lineTo(gx - gw / 2 + 16, gy1); g.closePath();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fill();
      g.save(); g.clip();
      g.fillStyle = '#f7fbfc'; g.fillRect(gx - gw, L(Math.min(f, 0.55)), gw * 2, gy1);
      g.fillStyle = '#e3f3f8'; g.fillRect(gx - gw, L(f), gw * 2, L(Math.min(f, 0.55)) - L(f) + 2);
      for (let i = 0; i < 7; i++) circle(g, gx - gw / 2 + 12 + i * (gw - 24) / 6, L(f), 12, '#fff', null);
      g.restore();
      g.lineWidth = 3.5; g.strokeStyle = INK; g.beginPath(); g.moveTo(gx - gw / 2, gy0); g.lineTo(gx - gw / 2 + 16, gy1); g.lineTo(gx + gw / 2 - 16, gy1); g.lineTo(gx + gw / 2, gy0); g.stroke();
      if (splash > 0) for (let i = 0; i < 8; i++) circle(g, gx + Math.cos(i) * (60 + (1 - splash) * 90), gy0 - 20 - Math.sin(i * 2) * 40 * (1 - splash), 10, '#fff');
      text(g, Math.abs(f - zc) < zh / 2 ? 'Tam kıvam!' : f > zc ? 'Yavaş!' : 'Dokun dokun!', W / 2, gy1 + 40, 24, Math.abs(f - zc) < zh / 2 ? '#2f8f4c' : INK);
      P.draw(g);
    },
    down() {
      f += 0.075;
      if (f > 1) { f = 0.5; splash = 0.8; P.add('Taştı! Martı köpük banyosu yaptı.', W / 2, H * 0.24, '#b8392a'); }
    },
    score: () => tot ? clamp(inT / tot * 118, 0, 100) : 0,
    hud: () => 'Kıvamda: %' + Math.round(tot ? inT / tot * 100 : 0),
  };
}

// ───────────────────────── micro-moves (icecek-9) ─────────────────────────
function microCay(W: number, H: number): Game {
  const line = 0.82; let lvl = 0, hold = false, done = false, sc = 0;
  const gx = W / 2, gy0 = H * 0.32, gy1 = H * 0.7, gw = 110;
  return {
    secs: 6,
    step(dt) { if (done) return; if (hold) { lvl += dt * 0.42; if (lvl >= 1.02) { lvl = 1.02; done = true; sc = 0; } } },
    draw(g) {
      const L = (v: number) => gy1 - (gy1 - gy0) * v;
      g.beginPath(); g.moveTo(gx - gw / 2, gy0); g.quadraticCurveTo(gx - gw / 2 - 18, (gy0 + gy1) / 2, gx - gw / 2 + 14, gy1); g.lineTo(gx + gw / 2 - 14, gy1); g.quadraticCurveTo(gx + gw / 2 + 18, (gy0 + gy1) / 2, gx + gw / 2, gy0); g.closePath();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.fill();
      g.save(); g.clip(); g.fillStyle = '#c2551f'; g.fillRect(gx - gw, L(Math.min(1, lvl)), gw * 2, gy1); g.restore();
      g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
      g.setLineDash([8, 6]); g.strokeStyle = '#2f8f4c'; g.beginPath(); g.moveTo(gx - gw, L(line)); g.lineTo(gx + gw, L(line)); g.stroke(); g.setLineDash([]);
      text(g, 'çizgi', gx + gw + 4, L(line) - 14, 18, '#2f8f4c');
      if (hold && !done) for (let i = 0; i < 3; i++) rr(g, gx - 4, gy0 - 120 + i * 30, 8, 22, 4, '#c2551f', INK, 0);
      rr(g, gx - 40, gy0 - 160, 80, 40, 12, '#e0533c');
    },
    down() { if (!done) hold = true; },
    up() { if (hold && !done) { done = true; sc = clamp(100 - Math.abs(lvl - line) * 500, 0, 100); } hold = false; },
    score: () => sc,
    hud: () => 'Basılı tut, çizgide bırak!',
    done: () => done,
  };
}
function microKahve(W: number, H: number): Game {
  let foam = 0, v = 0.12, done = false, sc = 0, t = 0;
  const cx = W / 2, cy = H * 0.55;
  return {
    secs: 6,
    step(dt) { if (done) return; t += dt; v += dt * 0.09; foam += v * dt; if (foam > 1.08) { done = true; sc = 0; } },
    draw(g) {
      circle(g, cx, cy + 90, 70, '#9aa3ab'); for (let i = 0; i < 8; i++) circle(g, cx + Math.cos(i) * 40, cy + 90 + Math.sin(i) * 12, 6, '#e0533c', null);
      rr(g, cx - 50, cy - 20, 100, 90, 14, '#d9a24a');
      rr(g, cx + 46, cy, 90, 12, 6, '#7d5638');
      const fy = cy - 20 + 70 * (1 - Math.min(foam, 1.08));
      g.fillStyle = '#c9a26b'; for (let i = 0; i < 5; i++) circle(g, cx - 40 + i * 20, fy, 12 + Math.sin(t * 8 + i) * 2, '#e8d1a8', null);
      g.setLineDash([8, 6]); g.lineWidth = 3; g.strokeStyle = '#2f8f4c'; g.beginPath(); g.moveTo(cx - 70, cy - 20 + 70 * 0.1); g.lineTo(cx + 70, cy - 20 + 70 * 0.1); g.stroke(); g.setLineDash([]);
      if (foam > 1) text(g, 'Taştı!', cx, cy - 70, 30, '#b8392a');
    },
    down() { if (done) return; done = true; sc = clamp(100 - Math.abs(foam - 0.92) * 450, 0, 100); },
    score: () => sc,
    hud: () => 'Köpük ağza gelince dokun!',
    done: () => done,
  };
}
function microSallama(W: number, H: number): Game {
  let lvl = 0, shake = 0;
  const cx = W / 2, cy = H * 0.52;
  return {
    secs: 5,
    step(dt) { lvl = Math.max(0, lvl - dt * 0.06); shake = Math.max(0, shake - dt * 4); },
    draw(g) {
      g.save(); g.translate(cx + Math.sin(shake * 30) * 14 * shake, cy); g.rotate(Math.sin(shake * 25) * 0.2 * shake);
      rr(g, -50, -90, 100, 180, 20, '#fff');
      g.fillStyle = '#e3f3f8'; g.fillRect(-46, -86 + 172 * (1 - lvl) * 0.5, 92, 20 + lvl * 50);
      rr(g, -40, -110, 80, 26, 8, '#4a9bc4');
      g.restore();
      rr(g, W * 0.15, H * 0.8, W * 0.7, 18, 9, '#fff', INK, 2.5); g.fillStyle = '#4a9bc4'; g.fillRect(W * 0.15 + 3, H * 0.8 + 3, (W * 0.7 - 6) * clamp(lvl, 0, 1), 12);
    },
    down() { lvl = Math.min(1, lvl + 0.065); shake = 1; },
    score: () => clamp(lvl * 110, 0, 100),
    hud: () => 'Hızlı hızlı dokun!',
    done: () => lvl >= 1,
  };
}

const MAKERS: Record<MiniId, (W: number, H: number) => Game> = { durum, kule, tost, simit, ayran };
const MICRO_MAKERS: Record<MicroId, (W: number, H: number) => Game> = { cay: microCay, kahve: microKahve, sallama: microSallama };
const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function createMiniGames(d: MiniGamesDeps): MiniGamesView {
  const style = document.createElement('style'); style.textContent = CSS; d.root.appendChild(style);
  const sfx = (id: string) => { try { d.sfx?.(id); } catch { /* optional */ } };
  let ov: HTMLDivElement | null = null, raf = 0, lastN = -1, lastMicroN = -1;
  let bub: HTMLDivElement | null = null, bubKey = '';
  let chip: HTMLDivElement | null = null;
  const api = (): MiniApi | null => { try { return miniApi(d.rules()); } catch { return null; } };

  function close() { if (raf) cancelAnimationFrame(raf); raf = 0; if (ov) ov.remove(); ov = null; }

  /** Opens the overlay and runs one game. `onEnd(score)` is called once; `quit()` when the player taps X. */
  function run(title: string, make: (W: number, H: number) => Game, intro: string, onEnd: (score: number) => void, onQuit: () => void, auto = false) {
    close();
    const el = ov = document.createElement('div');
    el.className = 'mg-ov';
    el.innerHTML = `<canvas></canvas><div class="mg-hd"><h2>${esc(title)}</h2><button class="x" aria-label="Vazgeç">✕</button></div><div class="mg-tm"><i></i></div><div class="mg-st"></div>`;
    d.root.appendChild(el);
    const cv = el.querySelector('canvas') as HTMLCanvasElement, g = cv.getContext('2d') as CanvasRenderingContext2D;
    const bar = el.querySelector('.mg-tm i') as HTMLElement, st = el.querySelector('.mg-st') as HTMLElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = el.clientWidth || window.innerWidth, H = el.clientHeight || window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const game = make(W, H);
    let left = game.secs, live = false, ended = false, prev = 0;
    const finish = () => { if (ended) return; ended = true; live = false; onEnd(game.score()); };
    (el.querySelector('.x') as HTMLElement).addEventListener('click', e => { e.stopPropagation(); if (!ended) { ended = true; close(); onQuit(); } else close(); });
    for (const ev of ['pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchmove']) el.addEventListener(ev, e => e.stopPropagation());
    el.addEventListener('pointerdown', e => {
      if (!live || (e.target as HTMLElement).closest('.x,.mg-cd')) return;
      const r = cv.getBoundingClientRect(); game.down(e.clientX - r.left, e.clientY - r.top); sfx('pop');
    });
    const up = () => { if (live && game.up) game.up(); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    const frame = (ts: number) => {
      if (ov !== el) return;
      const dt = prev ? Math.min(0.05, (ts - prev) / 1000) : 0; prev = ts;
      if (live) {
        left -= dt; game.step(dt);
        if (left <= 0 || (game.done && game.done())) { if (game.up && left <= 0) game.up(); finish(); }
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      game.draw(g);
      bar.style.width = (clamp(left / game.secs, 0, 1) * 100).toFixed(1) + '%';
      st.textContent = game.hud();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    if (auto) { live = true; return; }
    card(`<h3>${esc(title)}</h3><p>${esc(intro)}</p><p style="opacity:.75">${game.secs} saniye. Tek parmak yeter!</p><div class="row" style="grid-template-columns:1fr"><button class="sb-btn green" data-k="go">Başla!</button></div>`, k => { if (k === 'go') { live = true; sfx('buy'); } });
  }
  function card(html: string, on: (k: string) => void) {
    if (!ov) return;
    const c = document.createElement('div'); c.className = 'mg-cd'; c.innerHTML = `<div class="c">${html}</div>`;
    ov.appendChild(c);
    c.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('[data-k]') as HTMLElement | null; if (!b) return; e.stopPropagation(); c.remove(); on(b.dataset.k || ''); });
  }

  function startGame(id: MiniId, practice: boolean) {
    const def = GAME_BY_ID[id];
    if (!def) return;
    run(def.name + (practice ? ' · Antrenman' : ''), MAKERS[id], def.how, score => {
      d.command({ kind: 'mini', op: 'result', id, arg: score });
      const r = api()?.last();
      showResult(r && r.id === id ? r : null, score);
    }, () => d.command({ kind: 'mini', op: 'quit' }));
  }
  function showResult(r: MiniResult | null, score: number) {
    if (!ov) return;
    const stars = r ? r.stars : 0;
    const starTxt = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    let rw = '';
    if (r && !r.practice) {
      rw += `<span>+ ${fmt(r.money)} ₺</span>`;
      if (r.gold) rw += `<span>+ ${r.gold} Altın Simit</span>`;
      if (r.piece) rw += `<span>Yeni ${esc(r.pieceKind)}: ${esc(r.piece)}</span>`;
      if (r.bonus) rw += `<span>5 dakika satışlar ×1,5!</span>`;
    } else if (r) rw += `<span>Antrenman turu: ödül yok, keyif bol.</span>`;
    if (r && r.kupa) rw += `<span>Yeni kupa: ${esc(r.kupa)}</span>`;
    if (r && r.newBest) rw += `<span>Yeni rekor!</span>`;
    const fail = stars === 0;
    if (fail) sfx('day'); else sfx('cash');
    const hasTickets = (api()?.panelModel().tickets ?? 0) > 0;
    card(`<h3 class="${fail ? 'fail' : ''}">${fail ? 'Eyvah!' : stars === 3 ? 'Efsane!' : 'Aferin!'}</h3><div class="mg-sr" style="color:#f2b632">${starTxt}</div><div class="big">${Math.round(r ? r.score : score)}</div>
      <p class="${fail ? 'fail' : ''}">${esc(r ? r.line : '')}</p>${r && r.consolation ? `<p style="opacity:.8">${esc(r.consolation)}</p>` : ''}<div class="rw">${rw}</div>
      <div class="row"><button class="sb-btn cream" data-k="close">Kapat</button><button class="sb-btn green" data-k="again">${hasTickets ? 'Tekrar' : 'Antrenman'}</button></div>`, k => {
      const id = r ? r.id : null;
      close();
      if (k === 'again' && id) d.command({ kind: 'mini', op: hasTickets ? 'play' : 'practice', id });
      else d.command({ kind: 'mini', op: 'open' });
    });
  }
  function startMicro(id: MicroId) {
    const def = MICRO[id];
    run(def.name, MICRO_MAKERS[id], def.how, score => {
      d.command({ kind: 'mini', op: 'micro', arg: score });
      const lm = api()?.lastMicro();
      if (lm) { sfx(lm.ok ? 'cash' : 'pop'); }
      card(`<h3>${lm && lm.ok ? 'Usta işi!' : 'Olsun!'}</h3><p>${esc(lm ? lm.text : '')}</p><div class="row" style="grid-template-columns:1fr"><button class="sb-btn green" data-k="ok">Tamam</button></div>`, () => close());
    }, () => d.command({ kind: 'mini', op: 'microSkip' }), false);
  }

  function syncBubble(a: MiniApi | null) {
    const p = a ? a.prompt() : null;
    const key = p && !ov ? p.id + p.until : '';
    if (key === bubKey) return;
    bubKey = key;
    if (bub) { bub.remove(); bub = null; }
    if (!p || ov) return;
    bub = document.createElement('div'); bub.className = 'mg-bub';
    bub.innerHTML = `<button class="sb-btn" data-k="go"><span class="sb-bl">Ustalık: ${esc(p.name)}<small>İstersen dokun, kalite bonusu!</small></span></button><button class="sb-btn sk" data-k="skip" aria-label="Geç">✕</button>`;
    bub.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('[data-k]') as HTMLElement | null; if (!b) return;
      e.stopPropagation();
      d.command({ kind: 'mini', op: b.dataset.k === 'go' ? 'microStart' : 'microSkip' });
    });
    d.root.appendChild(bub);
  }
  function syncChip(a: MiniApi | null) {
    const s = a ? a.bonusLeft() : 0;
    if (s <= 0 || ov) { if (chip) { chip.remove(); chip = null; } return; }
    if (!chip) { chip = document.createElement('div'); chip.className = 'mg-chip'; d.root.appendChild(chip); }
    const t = 'Satış ×1,5 · ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    if (chip.textContent !== t) chip.textContent = t;
  }

  return {
    update() {
      const a = api();
      if (!a) return;
      const p = a.playing();
      if (p && p.n !== lastN) { lastN = p.n; startGame(p.id, p.practice); }
      const m = a.microRun();
      if (m && m.n !== lastMicroN) { lastMicroN = m.n; startMicro(m.id); }
      // sim side was reset / quit elsewhere while our overlay is open without an active round
      syncBubble(a);
      syncChip(a);
    },
    dispose() { close(); style.remove(); bub?.remove(); chip?.remove(); },
  };
}
