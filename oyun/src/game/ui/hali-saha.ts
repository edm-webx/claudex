// Halı saha (user 2026-10-24): the maç günü offer card and a playable 5v5 halı saha match.
// View only: reads rt.uiLast.haliSahaTeklif / haliSahaMac (sim/halisaha.ts) and sends { kind: 'halisaha', ... }.
// The match is a top-down 2D canvas game with its own requestAnimationFrame loop while open (the sim is paused):
// 40 x 20 m pitch with walls, 5 a side (keeper + 4), the player controls the teammate nearest the ball.
// Controls: left half of the screen = joystick (touch/mouse), right buttons ŞUT and PAS; keyboard WASD/arrows,
// Space = şut, K or Shift = pas. Without the ball ŞUT tackles and PAS switches player. Two 75 s halves.
// Sounds come from the engine synth (whistle, kick, post, net, crowdCheer, crowdOoh in engine/audio).
// 2026-10-24 15:13: the field, players and ball render in 3D (hali-saha-3d.ts); the 2D canvas keeps the HUD.
// Parody teams only. Visual randomness uses Math.random (UI code, not sim).
import { createHaliSaha3D, type HS3 } from './hali-saha-3d';
import { createMatch, FORMATIONS } from '../sim/macmotor';

type Cmd = { kind: string; [k: string]: unknown };
interface MacInfo { team: string; name: string; colors: [string, string]; rival: string; rivalName: string; rivalColors: [string, string]; formasyon?: string }
export interface HaliSahaDeps { root: HTMLElement; rules: () => { rt: { uiLast: Record<string, unknown> } } | null; command(c: Cmd): void; sfx?(id: string): void; chars?: { makeHero(o: never): unknown } | null; esnaf?: () => Record<string, unknown> | null }
export interface HaliSahaView { update(): void; dispose(): void }

const L = 40, WD = 20, MOUTH0 = 8.2, MOUTH1 = 11.8, HALF_S = 75;
const HOME_NAMES = ['Kaleci Nuri', 'Hamdi', 'Cemil', 'SABRİ', 'Tayyar'];
const AWAY_NAMES = ['Kaleci Rıfkı', 'Bülent', 'Oktay', 'Ferdi', 'Sinan'];
const BOARDS = ['KOLAZ', 'MARTIKART', 'AYRANBEY', 'BOĞAZ GAZOZU', 'SABRİ\'NİN BÜFESİ', 'NARÇİÇEK'];

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const len = (x: number, y: number) => Math.hypot(x, y) || 1e-6;

const CSS = `
.hs-offer{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:auto;background:rgba(10,20,30,.45);z-index:58}
.hs-card{background:#fdf3e1;color:#3b2a20;border:4px solid #3b2a20;border-radius:22px;box-shadow:0 8px 0 #3b2a20;padding:18px 20px;width:min(360px,calc(100vw - 32px));text-align:center;font-family:var(--body)}
.hs-card h2{font:900 24px/1.1 var(--disp);margin:6px 0}
.hs-card p{font:700 15px/1.4 var(--body);margin:6px 0 12px}
.hs-teams{display:flex;align-items:center;justify-content:center;gap:10px;font:900 16px/1 var(--disp);margin:6px 0}
.hs-teams i{display:inline-block;width:22px;height:22px;border-radius:50%;border:3px solid #3b2a20}
.hs-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.hs-btn{min-height:54px;border-radius:15px;border:4px solid #3b2a20;box-shadow:0 4px 0 #3b2a20;font:900 19px/1 var(--disp);color:#3b2a20;cursor:pointer;background:#fff6e6}
.hs-btn.go{background:#7ed957}
.hs-game{position:absolute;inset:0;z-index:62;pointer-events:auto;background:#1d4d2b;touch-action:none;user-select:none;-webkit-user-select:none}
.hs-game canvas{position:absolute;inset:0;width:100%;height:100%}
`;

export function createHaliSaha(deps: HaliSahaDeps): HaliSahaView {
  const st = document.createElement('style'); st.textContent = CSS; deps.root.appendChild(st);
  let offerEl: HTMLDivElement | null = null, offerKey = '';
  let game: { close(): void } | null = null, gameKey = '';
  const sfx = (id: string) => { try { deps.sfx?.(id); } catch { /* */ } };

  function showOffer(t: MacInfo) {
    offerEl?.remove();
    offerEl = document.createElement('div'); offerEl.className = 'hs-offer';
    offerEl.innerHTML = `<div class="hs-card"><div style="font-size:44px;line-height:1">⚽</div><h2>Halı saha teklifi</h2>
      <div class="hs-teams"><i style="background:${t.colors[0]}"></i>${t.name}<span style="opacity:.6">vs</span>${t.rivalName}<i style="background:${t.rivalColors[0]}"></i></div>
      <p>${t.name} taraftarı Cemil: "Abi akşam ${t.rivalName}'la maçımız var, bir kişi eksik. Döneri bırak, gel bir maç at!"</p>
      <div class="hs-row"><button class="hs-btn" data-a="red">Sonra</button><button class="hs-btn go" data-a="kabul">Kabul et</button></div></div>`;
    deps.root.appendChild(offerEl);
    offerEl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { sfx('pop'); deps.command({ kind: 'halisaha', op: (b as HTMLElement).dataset.a }); offerEl?.remove(); offerEl = null; }));
  }

  function startGame(t: MacInfo) {
    const wrap = document.createElement('div'); wrap.className = 'hs-game';
    const cv = document.createElement('canvas'); wrap.appendChild(cv); deps.root.appendChild(wrap);
    const g = cv.getContext('2d')!;
    let dpr = 1, cw = 0, ch = 0;
    const resize = () => { dpr = Math.min(2, window.devicePixelRatio || 1); cw = wrap.clientWidth; ch = wrap.clientHeight; cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); };
    resize(); window.addEventListener('resize', resize);
    let hs3: HS3 | null = null;
    try { hs3 = createHaliSaha3D({ wrap, chars: deps.chars || null, esnaf: deps.esnaf?.() || null, L, WD, m0: MOUTH0, m1: MOUTH1, colors: t.colors, rival: t.rivalColors, clubName: t.name, rivalName: t.rivalName }); } catch { hs3 = null; }

    // ---- state: the match itself lives in sim/macmotor.ts (formation + role AI, stats); this view only draws and feeds input
    const FKEYS = Object.keys(FORMATIONS), seed = (Date.now() & 0xfffff) | 1;
    const M = createMatch({ seed, human: 0, humanSlot: 3, formations: [FORMATIONS[t.formasyon || ''] ? (t.formasyon as string) : '2-2', FKEYS[seed % FKEYS.length] as string], names: [HOME_NAMES, AWAY_NAMES], halfS: HALF_S, skill: [0.6, 0.55 + (seed % 7) * 0.02] });
    const pls = M.pls, ball = M.ball, SABRI = 3;
    const colsOf = (team: number) => (team === 0 ? t.colors : t.rivalColors);
    // 2026-10-26 owner: a referee in every match, stepping in on taç / korner / aut.
    const ref = { x: L / 2, y: WD / 2 + 4, vx: 0, vy: 0, fx: 0, fy: -1, point: 0 };
    let shake = 0;
    sfx('whistle');

    // ---- input
    const keys: Record<string, boolean> = {};
    const onKey = (e: KeyboardEvent, on: boolean) => {
      const k = e.key.toLowerCase(); keys[k] = on;
      if (on && (k === ' ' || k === 'j')) { act('sut'); e.preventDefault(); }
      if (on && (k === 'k' || k === 'shift')) { act('pas'); e.preventDefault(); }
    };
    const kd = (e: KeyboardEvent) => onKey(e, true), ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    let joy: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
    const btnRect = () => { const s = Math.min(cw, ch); const r = Math.max(38, s * 0.085); return { sut: { x: cw - r * 1.6, y: ch - r * 1.7, r: r * 1.15 }, pas: { x: cw - r * 3.9, y: ch - r * 1.15, r: r * 0.9 }, end: { x: cw - 34, y: 34, r: 22 } }; };
    const hit = (b: { x: number; y: number; r: number }, x: number, y: number) => Math.hypot(x - b.x, y - b.y) <= b.r * 1.15;
    const onDown = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, B = btnRect();
      if (M.over) { if (resultBtn && x > resultBtn.x && x < resultBtn.x + resultBtn.w && y > resultBtn.y && y < resultBtn.y + resultBtn.h) finish(); return; }
      if (hit(B.sut, x, y)) { act('sut'); return; }
      if (hit(B.pas, x, y)) { act('pas'); return; }
      if (!joy && x < cw * 0.6) { joy = { id: e.pointerId, ox: x, oy: y, x, y }; try { wrap.setPointerCapture(e.pointerId); } catch { /* */ } }
    };
    const onMove = (e: PointerEvent) => { if (joy && e.pointerId === joy.id) { const r = wrap.getBoundingClientRect(); joy.x = e.clientX - r.left; joy.y = e.clientY - r.top; } };
    const onUp = (e: PointerEvent) => { if (joy && e.pointerId === joy.id) joy = null; };
    wrap.addEventListener('pointerdown', onDown); wrap.addEventListener('pointermove', onMove); wrap.addEventListener('pointerup', onUp); wrap.addEventListener('pointercancel', onUp);

    // screen <-> field (portrait screens turn the pitch so we attack upward)
    let sc = 10, ox = 0, oy = 0, portrait = false;
    function layout() {
      portrait = ch > cw * 1.05;
      const fw = portrait ? WD + 3 : L + 4, fh = portrait ? L + 4 : WD + 3, top = 64, bottom = portrait ? 150 : 24;
      sc = Math.min((cw - 24) / fw, (ch - top - bottom) / fh);
      const pw = (portrait ? WD : L) * sc, ph = (portrait ? L : WD) * sc;
      ox = (cw - pw) / 2; oy = top + (ch - top - bottom - ph) / 2;
    }
    const P = (x: number, y: number): [number, number] => (portrait ? [ox + y * sc, oy + (L - x) * sc] : [ox + x * sc, oy + y * sc]);
    function inputVec(): [number, number] {
      let sx = 0, sy = 0;
      if (keys.a || keys.arrowleft) sx -= 1; if (keys.d || keys.arrowright) sx += 1; if (keys.w || keys.arrowup) sy -= 1; if (keys.s || keys.arrowdown) sy += 1;
      if (joy) { const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), m = Math.max(14, Math.min(cw, ch) * 0.09); if (d > 6) { sx = dx / Math.max(d, m); sy = dy / Math.max(d, m); } }
      const m = Math.hypot(sx, sy); if (m > 1) { sx /= m; sy /= m; }
      return portrait ? [-sy, sx] : [sx, sy];
    }

    // ---- simulation glue
    const act = (k: 'sut' | 'pas') => M.act(k);
    function step(dt: number) {
      if (shake > 0) shake = Math.max(0, shake - dt);
      const [ix, iy] = inputVec(); M.input.ix = ix; M.input.iy = iy;
      M.step(dt);
      for (const e of M.events) { if (e.k === 'sfx') sfx(e.id); else if (e.k === 'shake') shake = Math.max(shake, e.t); else if (e.k === 'banner' && e.text !== 'GOOOOL!' && e.text !== 'Devre arası') ref.point = 1.6; }
      const rx = clamp(ball.x - (ball.vx >= 0 ? 3 : -3), 2, L - 2), ry = ball.y < WD / 2 ? clamp(ball.y + 5, 2, WD - 1) : clamp(ball.y - 5, 1, WD - 2);
      const dx = rx - ref.x, dy = ry - ref.y, d = Math.hypot(dx, dy), want = d > 0.3 ? Math.min(6, d * 2) : 0;
      ref.vx += ((d > 0 ? dx / d * want : 0) - ref.vx) * Math.min(1, dt * 5); ref.vy += ((d > 0 ? dy / d * want : 0) - ref.vy) * Math.min(1, dt * 5);
      ref.x += ref.vx * dt; ref.y += ref.vy * dt;
      const fd = len(ball.x - ref.x, ball.y - ref.y); ref.fx = (ball.x - ref.x) / fd; ref.fy = (ball.y - ref.y) / fd; ref.point = Math.max(0, ref.point - dt);
    }

  // ---- drawing
    let resultBtn: { x: number; y: number; w: number; h: number } | null = null;
    function rrect(x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function line(x0: number, y0: number, x1: number, y1: number) { const a = P(x0, y0), b = P(x1, y1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    function draw() {
      layout();
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sh = shake > 0 ? (Math.random() - 0.5) * shake * 18 : 0;
      g.translate(sh, sh * 0.6);
      if (hs3) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); hs3.render({ pls, ball, ctrl: M.ctrl, portrait, shake, dt: lastDt, ref }); }
      else {
      g.fillStyle = '#183f24'; g.fillRect(-20, -20, cw + 40, ch + 40);
      // walls + ad boards
      const [a0x, a0y] = P(0, 0), [a1x, a1y] = P(L, WD);
      const fx0 = Math.min(a0x, a1x), fy0 = Math.min(a0y, a1y), fw = Math.abs(a1x - a0x), fh = Math.abs(a1y - a0y);
      const wall = sc * 0.9;
      g.fillStyle = '#2b2b33'; rrect(fx0 - wall, fy0 - wall, fw + wall * 2, fh + wall * 2, 10); g.fill();
      g.font = `900 ${Math.max(9, wall * 0.62)}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const along = portrait ? fh : fw, n = Math.max(3, Math.floor(along / 120));
      for (let k = 0; k < n; k++) {
        const txt = BOARDS[k % BOARDS.length], cols = ['#e0533c', '#3fb5b0', '#ffd23f', '#7d6bb0'][k % 4];
        g.fillStyle = cols;
        if (!portrait) { const x = fx0 + (k + 0.5) * fw / n; g.fillRect(x - fw / n / 2 + 3, fy0 - wall + 3, fw / n - 6, wall - 6); g.fillStyle = '#fff'; g.fillText(txt, x, fy0 - wall / 2, fw / n - 10); }
        else { const y = fy0 + (k + 0.5) * fh / n; g.save(); g.translate(fx0 - wall / 2, y); g.rotate(-Math.PI / 2); g.fillRect(-fh / n / 2 + 3, -wall / 2 + 3, fh / n - 6, wall - 6); g.fillStyle = '#fff'; g.fillText(txt, 0, 0, fh / n - 10); g.restore(); }
      }
      // turf stripes
      for (let k = 0; k < 10; k++) { g.fillStyle = k % 2 ? '#3f9b4a' : '#48a854'; const p0 = P(k * 4, 0), p1 = P(k * 4 + 4, WD); g.fillRect(Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.abs(p1[0] - p0[0]), Math.abs(p1[1] - p0[1])); }
      // lines
      g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = Math.max(2, sc * 0.12);
      line(0, 0, L, 0); line(L, 0, L, WD); line(L, WD, 0, WD); line(0, WD, 0, 0); line(L / 2, 0, L / 2, WD);
      { const c = P(L / 2, WD / 2); g.beginPath(); g.arc(c[0], c[1], 3 * sc, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(c[0], c[1], sc * 0.18, 0, Math.PI * 2); g.fill(); }
      for (const gx of [0, L]) { const s2 = gx === 0 ? 1 : -1; line(gx, 5, gx + s2 * 6, 5); line(gx + s2 * 6, 5, gx + s2 * 6, 15); line(gx + s2 * 6, 15, gx, 15); const pp = P(gx + s2 * 4.5, 10); g.fillStyle = '#fff'; g.beginPath(); g.arc(pp[0], pp[1], sc * 0.15, 0, Math.PI * 2); g.fill(); }
      // goals with nets
      for (const gx of [0, L]) {
        const s2 = gx === 0 ? -1 : 1, p0 = P(gx, MOUTH0), p1 = P(gx + s2 * 1.3, MOUTH1);
        const x = Math.min(p0[0], p1[0]), y = Math.min(p0[1], p1[1]), w = Math.abs(p1[0] - p0[0]), h = Math.abs(p1[1] - p0[1]);
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, w, h);
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1;
        for (let k = 0; k <= 8; k++) { g.beginPath(); g.moveTo(x + k * w / 8, y); g.lineTo(x + k * w / 8, y + h); g.stroke(); g.beginPath(); g.moveTo(x, y + k * h / 8); g.lineTo(x + w, y + k * h / 8); g.stroke(); }
        g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(3, sc * 0.2); g.strokeRect(x, y, w, h);
      }
      // players (sorted by screen y)
      const order = pls.map((p, i) => i).sort((a, b) => P(pls[a].x, pls[a].y)[1] - P(pls[b].x, pls[b].y)[1]);
      const R = sc * 0.68;
      for (const i of order) {
        const p = pls[i], [x, y] = P(p.x, p.y), c = colsOf(p.team);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + R * 0.2, y + R * 0.55, R * 1.05, R * 0.55, 0, 0, Math.PI * 2); g.fill();
        if (i === M.ctrl) { g.strokeStyle = '#ffd23f'; g.lineWidth = Math.max(3, sc * 0.16); g.beginPath(); g.ellipse(x, y + R * 0.45, R * 1.35, R * 0.75, 0, 0, Math.PI * 2); g.stroke(); }
        const run = Math.hypot(p.vx, p.vy) > 1 ? Math.sin(performance.now() / 70 + i) * R * 0.18 : 0;
        g.fillStyle = '#2b2b33'; g.beginPath(); g.arc(x - R * 0.35, y + R * 0.55 + run, R * 0.28, 0, Math.PI * 2); g.arc(x + R * 0.35, y + R * 0.55 - run, R * 0.28, 0, Math.PI * 2); g.fill();
        g.fillStyle = p.gk ? (p.team === 0 ? '#ffd23f' : '#2b2b33') : c[0]; g.strokeStyle = '#2a1d17'; g.lineWidth = Math.max(1.5, sc * 0.08);
        g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill(); g.stroke();
        if (!p.gk) { g.fillStyle = c[1]; g.fillRect(x - R * 0.18, y - R * 0.85, R * 0.36, R * 1.7); }
        g.fillStyle = '#e9b88f'; g.beginPath(); g.arc(x + p.fx * R * 0.25, y - R * 0.45 + p.fy * R * 0.15, R * 0.42, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = i === SABRI ? '#1d1d1d' : ['#3a2a20', '#6b4a2a', '#1d1d1d', '#8a5a2a'][i % 4]; g.beginPath(); g.arc(x + p.fx * R * 0.25, y - R * 0.6, R * 0.36, Math.PI, 0); g.fill();
        if (i === SABRI || i === M.ctrl) {
          g.font = `900 ${Math.max(10, sc * 0.55)}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'bottom';
          g.lineWidth = 3; g.strokeStyle = '#2a1d17'; g.strokeText(p.name, x, y - R * 1.15); g.fillStyle = i === SABRI ? '#ffd23f' : '#fff'; g.fillText(p.name, x, y - R * 1.15);
        }
        if (p.stun > 0) { g.font = `${Math.max(10, sc * 0.6)}px system-ui`; g.textBaseline = 'bottom'; g.fillText('💫', x, y - R * 1.6); }
      }
      // referee: black kit, yellow trim, arm up while he points
      { const [x, y] = P(ref.x, ref.y), R = sc * 0.6;
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + R * 0.2, y + R * 0.55, R, R * 0.5, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#1d1d1d'; g.strokeStyle = '#ffd23f'; g.lineWidth = Math.max(1.5, sc * 0.1); g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = '#e9b88f'; g.beginPath(); g.arc(x + ref.fx * R * 0.25, y - R * 0.45, R * 0.4, 0, Math.PI * 2); g.fill();
        if (ref.point > 0) { g.strokeStyle = '#1d1d1d'; g.lineWidth = Math.max(2, sc * 0.14); g.beginPath(); g.moveTo(x, y - R * 0.2); g.lineTo(x + R * 0.9, y - R * 1.6); g.stroke(); }
        g.font = `800 ${Math.max(9, sc * 0.42)}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillStyle = '#fff'; g.fillText('HAKEM', x, y - R * 1.1); }
      // ball
      { const [x, y] = P(ball.x, ball.y), br = Math.max(4, sc * 0.3);
        g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + br * 0.3, y + br * 0.6, br, br * 0.55, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.strokeStyle = '#222'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, br, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = '#222'; g.beginPath(); g.arc(x + br * 0.2, y - br * 0.15, br * 0.36, 0, Math.PI * 2); g.fill(); }
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // scoreboard
      const sbW = Math.min(cw - 24, 460), sbX = (cw - sbW) / 2;
      g.fillStyle = '#fdf3e1'; g.strokeStyle = '#3b2a20'; g.lineWidth = 3; rrect(sbX, 8, sbW, 46, 14); g.fill(); g.stroke();
      g.textBaseline = 'middle'; g.font = `900 ${sbW < 360 ? 13 : 16}px system-ui,sans-serif`;
      g.fillStyle = t.colors[0]; g.fillRect(sbX + 10, 21, 18, 18); g.fillStyle = t.rivalColors[0]; g.fillRect(sbX + sbW - 28, 21, 18, 18);
      g.fillStyle = '#3b2a20'; g.textAlign = 'left'; g.fillText(t.name, sbX + 34, 31, sbW * 0.3); g.textAlign = 'right'; g.fillText(t.rivalName, sbX + sbW - 34, 31, sbW * 0.3);
      g.textAlign = 'center'; g.font = '900 24px system-ui,sans-serif'; g.fillText(M.score[0] + ' - ' + M.score[1], cw / 2, 27);
      const left = Math.max(0, HALF_S * M.half - M.clock), mm = Math.floor(left / 60), ss = Math.floor(left % 60);
      g.font = '800 11px system-ui,sans-serif'; g.fillText(M.half + '. YARI  ' + mm + ':' + String(ss).padStart(2, '0'), cw / 2, 46);
      // controls
      const B = btnRect();
      const own = ball.owner === M.ctrl;
      const btn = (b: { x: number; y: number; r: number }, label: string, col: string) => { g.fillStyle = col; g.strokeStyle = '#3b2a20'; g.lineWidth = 4; g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#3b2a20'; g.font = `900 ${Math.round(b.r * 0.42)}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, b.x, b.y); };
      if (!M.over) { btn(B.sut, own ? 'ŞUT' : 'KAP', own ? '#ffd23f' : '#f2a2b3'); btn(B.pas, own ? 'PAS' : 'DEĞİŞ', '#bfe6ff'); }
      if (joy) { const m = Math.max(14, Math.min(cw, ch) * 0.09); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; g.beginPath(); g.arc(joy.ox, joy.oy, m, 0, Math.PI * 2); g.stroke(); const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), k = d > m ? m / d : 1; g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(joy.ox + dx * k, joy.oy + dy * k, m * 0.42, 0, Math.PI * 2); g.fill(); }
      else if (M.clock < 6 && !M.over) { g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '800 14px system-ui,sans-serif'; g.textAlign = 'left'; g.fillText(portrait ? 'Sol alta dokun, sürükle: koş' : 'Sola dokun, sürükle (ya da WASD): koş', 16, ch - 26); }
      // M.banner
      if (M.bannerT > 0 && !M.over) {
        const a = Math.min(1, M.bannerT * 2); g.globalAlpha = a; g.font = `900 ${Math.min(64, cw * 0.11)}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 8; g.strokeStyle = '#3b2a20'; g.strokeText(M.banner, cw / 2, ch * 0.42); g.fillStyle = M.banner.startsWith('GO') ? '#ffd23f' : '#fff'; g.fillText(M.banner, cw / 2, ch * 0.42); g.globalAlpha = 1;
      }
      // result card
      resultBtn = null;
      if (M.over) {
        g.fillStyle = 'rgba(6,12,20,.6)'; g.fillRect(0, 0, cw, ch);
        const w = Math.min(360, cw - 32), h = 360, x = (cw - w) / 2, y = (ch - h) / 2;
        g.fillStyle = '#fdf3e1'; g.strokeStyle = '#3b2a20'; g.lineWidth = 4; rrect(x, y, w, h, 20); g.fill(); g.stroke();
        const res = M.score[0] > M.score[1] ? 'Kazandın!' : M.score[0] === M.score[1] ? 'Berabere' : 'Kaybettin';
        g.fillStyle = '#3b2a20'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 30px system-ui,sans-serif'; g.fillText(res, cw / 2, y + 42);
        g.font = '900 40px system-ui,sans-serif'; g.fillText(M.score[0] + ' - ' + M.score[1], cw / 2, y + 92);
        g.font = '700 14px system-ui,sans-serif'; g.fillText(t.name + ' & Sabri  vs  ' + t.rivalName, cw / 2, y + 128, w - 20);
        { const a = M.teamStats(0), b = M.teamStats(1), rows: [string, string, string][] = [['Şut', a.shots + ' (' + a.onTarget + ')', b.shots + ' (' + b.onTarget + ')'], ['Topla oynama', a.possession + '%', b.possession + '%'], ['Pas isabeti', (a.passes ? Math.round(a.passesOk / a.passes * 100) : 0) + '%', (b.passes ? Math.round(b.passesOk / b.passes * 100) : 0) + '%'], ['Kurtarış', '' + a.saves, '' + b.saves], ['Korner', '' + a.corners, '' + b.corners], ['Top çalma', '' + a.tackles, '' + b.tackles]];
          g.font = '800 14px system-ui,sans-serif'; rows.forEach((r, k) => { const yy = y + 152 + k * 22; g.textAlign = 'left'; g.fillText(r[1], x + 28, yy); g.textAlign = 'center'; g.fillStyle = '#7a5a46'; g.fillText(r[0], cw / 2, yy); g.fillStyle = '#3b2a20'; g.textAlign = 'right'; g.fillText(r[2], x + w - 28, yy); }); }
        resultBtn = { x: x + 24, y: y + h - 74, w: w - 48, h: 54 };
        g.fillStyle = '#ffd23f'; rrect(resultBtn.x, resultBtn.y, resultBtn.w, resultBtn.h, 14); g.fill(); g.stroke();
        g.fillStyle = '#3b2a20'; g.font = '900 20px system-ui,sans-serif'; g.fillText('Büfeye dön', cw / 2, resultBtn.y + 28);
      }
    }
    let raf = 0, last = performance.now(), closed = false, lastDt = 1 / 60;
    const loop = (now: number) => { if (closed) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; lastDt = dt; step(dt); draw(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const keyEnter = (e: KeyboardEvent) => { if (M.over && (e.key === 'Enter' || e.key === ' ')) finish(); };
    window.addEventListener('keydown', keyEnter);
    function finish() { if (closed) return; sfx('pop'); deps.command({ kind: 'halisaha', op: 'sonuc', biz: M.score[0], onlar: M.score[1], ist: { takim: [M.teamStats(0), M.teamStats(1)], oyuncu: M.pls.filter(p => p.team === 0).map(p => ({ ad: p.name, rol: p.role, ...p.st })) } }); close(); }
    function close() { closed = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('keydown', keyEnter); hs3?.dispose(); wrap.remove(); }
    (wrap as unknown as { __hs: unknown }).__hs = { state: () => ({ score: M.score, clock: M.clock, half: M.half, over: M.over, ctrl: M.ctrl, ball: { ...ball }, stats: [M.teamStats(0), M.teamStats(1)] }), act, finish, ff: (sec: number) => { for (let k = 0; k < sec * 60; k++) step(1 / 60); } };
    return { close };
  }

  return {
    update() {
      const r = deps.rules(); if (!r) return;
      const of = r.rt.uiLast.haliSahaTeklif as MacInfo | undefined, mac = r.rt.uiLast.haliSahaMac as MacInfo | undefined;
      const ok = of ? of.team + of.rival : '';
      if (ok !== offerKey) { offerKey = ok; if (of) showOffer(of); else { offerEl?.remove(); offerEl = null; } }
      const mk = mac ? mac.team + mac.rival : '';
      if (mk !== gameKey) { gameKey = mk; game?.close(); game = mac ? startGame(mac) : null; }
    },
    dispose() { offerEl?.remove(); game?.close(); st.remove(); },
  };
}
