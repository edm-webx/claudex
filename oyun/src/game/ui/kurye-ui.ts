// PaketMartı overlay (survey kurye-2, kurye-3, kurye-6, kurye-8). DOM + one 2D canvas, view only: reads the sim's
// kurye API (rules.rt.kurye) and sends { kind: 'kurye', ... } commands; it never writes sim state.
// - Receipt: a small paper fiş in the right corner while orders wait on the counter tablet (beeps), one-tap
//   'Kabul' / 'Sen götür!' / 'Geç'. Tapping the header opens the Kuryeler sheet.
// - Live map: a tiny corner map with courier dots moving along the streets while anyone is on the road.
// - Feed: star ratings with comments, slope/stair moments and cat visits pop as a short bubble.
// - 'Sen götür!': a 20 s one-finger route game (tap the next square) on a full-screen canvas; score 0..100 to the sim.
// Decisions: visual variety uses Math.random (UI code, not sim). The canvas runs its own rAF loop while open (the sim
// is paused meanwhile with pauseWhy 'kurye').
import { kuryeApi, type KuryeView } from '../sim/kurye';
import { SEMTLER, SEN_GOTUR, SEN_GOTUR_SECS } from '../../content/kurye';
import { aracSvg, havaSvg } from './kurye-panel';

type Cmd = { kind: string; [k: string]: unknown };
export interface KuryeUiDeps { root: HTMLElement; rules: () => { rt: unknown } | null; command(c: Cmd): void; sfx?(id: string): void; }
export interface KuryeUiView { update(dt: number): void; dispose(): void; }

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const tl = (n: number) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₺';
const INK = '#3b2a20';
const PN: Record<string, string> = { doner: 'döner', cay: 'çay', ayran: 'ayran', simit: 'simit', tost: 'tost', gazoz: 'gazoz' };

const CSS = `
.ky-ui{position:absolute;right:calc(var(--sr,0px) + 8px);bottom:calc(var(--sbm,0px) + 88px);z-index:26;display:flex;flex-direction:column;align-items:flex-end;gap:6px;pointer-events:none;width:min(200px,52vw)}
.ky-fis{pointer-events:auto;width:100%;background:#fffdf6;border:2.5px solid ${INK};border-radius:10px 10px 4px 4px;box-shadow:0 4px 0 ${INK};padding:6px 8px 8px;font:800 14px/1.25 var(--body);color:${INK};position:relative;
  -webkit-mask:linear-gradient(#000 0 0) top/100% calc(100% - 6px) no-repeat,radial-gradient(circle 4px at 6px 100%,#0000 98%,#000) bottom left/12px 7px repeat-x;mask:linear-gradient(#000 0 0) top/100% calc(100% - 6px) no-repeat,radial-gradient(circle 4px at 6px 100%,#0000 98%,#000) bottom left/12px 7px repeat-x;padding-bottom:12px}
.ky-fis.beep{animation:kybeep .5s ease-in-out 3}
.ky-fis .hd{display:flex;align-items:center;gap:6px;font:900 15px/1 var(--disp);border-bottom:2px dashed #c9b99a;padding-bottom:4px;margin-bottom:4px;cursor:pointer}
.ky-fis .hd i{width:10px;height:10px;border-radius:50%;background:#ff4d4d;border:2px solid ${INK};animation:kyled 1s steps(2) infinite}
.ky-fis .hd b{flex:1}
.ky-fis .it{font:800 14px/1.25 var(--body)}.ky-fis .sm{font:700 12px/1.2 var(--body);opacity:.75}
.ky-fis .val{font:900 18px/1.1 var(--disp);margin:2px 0}
.ky-fis .bt{display:flex;gap:5px;margin-top:5px}
.ky-fis .bt button{flex:1;min-height:46px;border:2.5px solid ${INK};border-radius:12px;font:900 15px/1 var(--disp);color:${INK};background:var(--money,#5fc36f);box-shadow:0 3px 0 ${INK}}
.ky-fis .bt button.s{background:#7cc7f0}.ky-fis .bt button.x{flex:0 0 40px;background:var(--cream,#fff3dc)}
.ky-fis .more{position:absolute;top:-8px;left:-8px;background:var(--red,#e0533c);color:#fff;border:2px solid ${INK};border-radius:10px;font:900 12px/1 var(--disp);padding:3px 6px}
.ky-mp{pointer-events:auto;width:110px;height:110px;border:2.5px solid ${INK};border-radius:14px;box-shadow:0 3px 0 ${INK};background:#f6ecd2;overflow:hidden;cursor:pointer}
.ky-mp canvas{width:100%;height:100%;display:block}
.ky-bub{pointer-events:none;width:100%;background:var(--paper,#fff8ec);border:2.5px solid ${INK};border-radius:14px;box-shadow:0 3px 0 ${INK};padding:6px 8px;font:800 13px/1.3 var(--body);color:${INK};animation:kypop .3s ease-out}
.ky-bub .st{color:#f2b632;font-size:16px;letter-spacing:1px;text-shadow:0 1px 0 ${INK}}
@keyframes kybeep{0%,100%{transform:rotate(0)}25%{transform:rotate(-3deg) scale(1.03)}75%{transform:rotate(3deg) scale(1.03)}}
@keyframes kyled{0%{opacity:1}100%{opacity:.25}}
@keyframes kypop{0%{transform:scale(.7);opacity:0}100%{transform:scale(1);opacity:1}}
.ky-ov{position:absolute;inset:0;z-index:60;pointer-events:auto;background:linear-gradient(#bfe3f6,#ffe7c2);touch-action:none;user-select:none;-webkit-user-select:none}
.ky-ov canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.ky-ov .hd{position:absolute;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top,0px));display:flex;gap:8px;align-items:center;z-index:2;pointer-events:none}
.ky-ov .hd h2{flex:1;margin:0;font:900 22px/1.1 var(--disp);color:${INK};text-shadow:0 2px 0 #fff}
.ky-ov .hd .x{pointer-events:auto;width:46px;height:46px;border:2.5px solid ${INK};border-radius:14px;background:var(--cream,#fff3dc);font:900 22px/1 var(--disp);color:${INK}}
.ky-ov .tm{position:absolute;left:12px;right:12px;top:calc(62px + env(safe-area-inset-top,0px));height:14px;border:2.5px solid ${INK};border-radius:9px;background:#fff;overflow:hidden;z-index:2}
.ky-ov .tm i{display:block;height:100%;background:#5fc36f;width:100%}
.ky-ov .st{position:absolute;left:0;right:0;top:calc(84px + env(safe-area-inset-top,0px));text-align:center;font:900 18px/1.2 var(--disp);color:${INK};text-shadow:0 2px 0 #fff;z-index:2;pointer-events:none}
.ky-ov .cd{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:3;background:rgba(59,42,32,.35);padding:16px}
.ky-ov .cd .c{width:100%;max-width:380px;background:var(--paper,#fff8ec);border:3px solid ${INK};border-radius:22px;box-shadow:0 6px 0 ${INK};padding:18px 16px;text-align:center}
.ky-ov .cd h3{margin:0 0 8px;font:900 26px/1.1 var(--disp)}
.ky-ov .cd p{margin:6px 0;font:800 18px/1.35 var(--body)}
.ky-ov .cd .big{font:900 40px/1 var(--disp);margin:6px 0;color:#f2b632;text-shadow:0 2px 0 ${INK}}
.ky-ov .cd button{min-height:58px;font-size:19px;width:100%;margin-top:12px}
`;

// ───────── 'Sen götür!' route game ─────────
type Tile = 0 | 1 | 2 | 3 | 4 | 5; // 0 road, 1 house (blocked), 2 water (blocked), 3 stairs (2 taps), 4 cat (wait, bonus), 5 gull (jump)
const COLS = 5, ROWS = 7;
interface Route { grid: Tile[]; px: number; py: number; tx: number; ty: number; stairTaps: number; catWait: number; cats: number; done: boolean; msg: string; msgT: number; hop: number }
function genRoute(): Route {
  for (let tries = 0; tries < 60; tries++) {
    const grid: Tile[] = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      const r = Math.random();
      grid.push((r < 0.2 ? 1 : r < 0.27 ? 2 : r < 0.4 ? 3 : r < 0.47 ? 4 : r < 0.52 ? 5 : 0) as Tile);
    }
    const px = 2, py = ROWS - 1, tx = Math.floor(Math.random() * COLS), ty = 0;
    grid[py * COLS + px] = 0; grid[ty * COLS + tx] = 0;
    // BFS over passable tiles
    const seen = new Set<number>([py * COLS + px]); const q = [py * COLS + px];
    while (q.length) { const c = q.shift()!, x = c % COLS, y = (c / COLS) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue; const n = ny * COLS + nx; if (seen.has(n) || grid[n] === 1 || grid[n] === 2) continue; seen.add(n); q.push(n); } }
    if (seen.has(ty * COLS + tx)) return { grid, px, py, tx, ty, stairTaps: 0, catWait: 0, cats: 0, done: false, msg: '', msgT: 0, hop: 0 };
  }
  const grid = new Array(COLS * ROWS).fill(0) as Tile[];
  return { grid, px: 2, py: ROWS - 1, tx: 2, ty: 0, stairTaps: 0, catWait: 0, cats: 0, done: false, msg: '', msgT: 0, hop: 0 };
}

export function createKuryeUi(d: KuryeUiDeps): KuryeUiView {
  const style = document.createElement('style'); style.textContent = CSS; d.root.appendChild(style);
  const wrap = document.createElement('div'); wrap.className = 'ky-ui'; d.root.appendChild(wrap);
  const bub = document.createElement('div'); bub.className = 'ky-bub'; bub.style.display = 'none';
  const mp = document.createElement('div'); mp.className = 'ky-mp'; mp.style.display = 'none';
  const mpc = document.createElement('canvas'); mpc.width = 220; mpc.height = 220; mp.appendChild(mpc);
  const fis = document.createElement('div'); fis.className = 'ky-fis'; fis.style.display = 'none';
  wrap.append(bub, mp, fis);
  mp.addEventListener('click', () => d.command({ kind: 'kurye', op: 'open' }));
  fis.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('[data-k]') as HTMLElement | null;
    if (b) { const op = b.dataset.k!, id = b.dataset.id; d.command({ kind: 'kurye', op, id }); if (op === 'accept') d.sfx?.('buy'); fisKey = ''; return; }
    if ((e.target as HTMLElement).closest('.hd')) d.command({ kind: 'kurye', op: 'open' });
  });

  let fisKey = '', lastTabletIds = '', beepT = 0, feedSeen = 0, bubT = 0, poll = 0, mapOn = false;
  let v: KuryeView | null = null;
  let selfN = 0, selfLastN = 0;

  function renderFis(): void {
    const t = v && v.on ? v.tablet : [];
    if (!t.length) { if (fis.style.display !== 'none') fis.style.display = 'none'; fisKey = ''; return; }
    const o = t[0];
    const key = o.id + ':' + t.length + ':' + Math.ceil(o.left / 5);
    if (key === fisKey) return;
    fisKey = key;
    fis.style.display = '';
    fis.innerHTML = `${t.length > 1 ? `<span class="more">+${t.length - 1}</span>` : ''}<div class="hd"><i></i><b>PaketMartı</b>${v ? havaSvg(v.hava.id, 20) : ''}<span class="sm">${o.left} sn</span></div>
      <div class="it">${esc(o.items)}</div><div class="val">${tl(o.value)}</div><div class="sm">${esc(o.semtName)} · ${esc(o.who)}</div>
      <div class="bt"><button data-k="accept" data-id="${o.id}">Kabul</button>${o.sen ? `<button class="s" data-k="self" data-id="${o.id}">Sen götür!</button>` : ''}<button class="x" data-k="decline" data-id="${o.id}" aria-label="Geç">×</button></div>`;
  }
  function drawMap(): void {
    const g = mpc.getContext('2d'); if (!g || !v) return;
    const W = mpc.width, H = mpc.height, P = (x: number, y: number): [number, number] => [x * W, y * H];
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#f6ecd2'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#8fd0ea'; g.beginPath(); g.moveTo(0, H * 0.92); g.quadraticCurveTo(W * 0.25, H * 0.86, W * 0.5, H * 0.92); g.quadraticCurveTo(W * 0.75, H * 0.98, W, H * 0.92); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    g.strokeStyle = '#d8c7a0'; g.lineWidth = 9; g.lineCap = 'round';
    for (const s of SEMTLER) { const [x, y] = P(s.mx, s.my), my = (0.88 + s.my) / 2 * H; g.beginPath(); g.moveTo(W * 0.5, H * 0.88); g.lineTo(W * 0.5, my); g.lineTo(x, my); g.lineTo(x, y); g.stroke(); }
    for (const s of SEMTLER) { const [x, y] = P(s.mx, s.my); g.fillStyle = '#fff6e6'; g.strokeStyle = INK; g.lineWidth = 3; g.fillRect(x - 11, y - 9, 22, 18); g.strokeRect(x - 11, y - 9, 22, 18); g.fillStyle = '#e0533c'; g.beginPath(); g.moveTo(x - 13, y - 8); g.lineTo(x, y - 18); g.lineTo(x + 13, y - 8); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = '#ffd23f'; g.fillRect(W * 0.5 - 14, H * 0.84, 28, 18); g.strokeRect(W * 0.5 - 14, H * 0.84, 28, 18);
    const tt = performance.now() / 1000;
    for (const c of v.couriers) {
      if (c.state === 'idle') continue;
      const [x, y] = P(c.mx, c.my), bob = Math.sin(tt * 10 + c.id) * 2;
      g.fillStyle = c.color; g.strokeStyle = INK; g.lineWidth = 3;
      g.beginPath(); g.arc(x, y + bob, 11, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#ffd23f'; g.fillRect(x - 5, y - 5 + bob, 10, 8); g.strokeRect(x - 5, y - 5 + bob, 10, 8);
      if (c.state === 'wait') { g.fillStyle = INK; g.font = '900 20px system-ui'; g.textAlign = 'center'; g.fillText('…', x, y - 14); }
    }
  }
  function showFeed(): void {
    if (!v) return;
    const f = v.feed.filter(x => x.n > feedSeen);
    if (!f.length) return;
    const x = f[0]; feedSeen = x.n;
    bub.style.display = '';
    bub.innerHTML = x.kind === 'rate'
      ? `<div><span class="st">${'★'.repeat(x.stars || 0)}${'☆'.repeat(5 - (x.stars || 0))}</span> +${tl(x.money || 0)}</div><div>"${esc(x.text)}"</div><div style="opacity:.7;font-size:12px">${esc(x.who || '')}</div>`
      : `<div>${esc(x.text)}</div>`;
    bub.style.animation = 'none'; void bub.offsetWidth; bub.style.animation = '';
    bubT = x.kind === 'rate' ? 4.5 : 5;
    if (x.kind === 'rate') d.sfx?.('coin');
  }

  // ───── Sen götür overlay ─────
  let ov: HTMLDivElement | null = null, raf = 0;
  function openSelf(order: KuryeView['tablet'][number] | { semtName?: string; items?: string; value?: number } | null): void {
    closeOv();
    const o = document.createElement('div'); o.className = 'ky-ov'; ov = o;
    o.innerHTML = `<canvas></canvas><div class="hd"><h2>${esc(SEN_GOTUR.title)}</h2><button class="x" aria-label="Kapat">×</button></div><div class="tm"><i></i></div><div class="st"></div>
      <div class="cd"><div class="c">${aracSvg('bisiklet', '#ffd23f', 84)}<h3>${esc(SEN_GOTUR.title)}</h3><p>${esc(order && 'semtName' in order ? (order.semtName || '') + ': ' + (order.items || '') : '')}</p><p>${esc(SEN_GOTUR.how)}</p><button class="sb-btn green big">Yola çık!</button></div></div>`;
    d.root.appendChild(o);
    const cv = o.querySelector('canvas') as HTMLCanvasElement, tmI = o.querySelector('.tm i') as HTMLElement, st = o.querySelector('.st') as HTMLElement;
    const g = cv.getContext('2d')!;
    let R = genRoute(), left = SEN_GOTUR_SECS, running = false, last = 0, finished = false;
    const fit = () => { const r = o.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); };
    fit();
    const geom = () => { const r = o.getBoundingClientRect(); const top = 120, bot = 30; const cs = Math.min((r.width - 24) / COLS, (r.height - top - bot) / ROWS); const ox = (r.width - cs * COLS) / 2, oy = top + ((r.height - top - bot) - cs * ROWS) / 2; return { cs, ox, oy }; };
    const finish = (score: number) => {
      if (finished) return; finished = true; running = false;
      d.command({ kind: 'kurye', op: score > 0 ? 'selfResult' : 'selfQuit', arg: score });
      setTimeout(() => {
        const api = kuryeApi(d.rules()); const sl = api ? api.view().selfLast : null;
        const cd = document.createElement('div'); cd.className = 'cd';
        cd.innerHTML = `<div class="c"><h3>${score > 0 ? 'Teslim edildi!' : 'Kurye yetişti!'}</h3>${score > 0 ? `<div class="big">${'★'.repeat(sl ? sl.stars : 3)}</div><p>+${tl(sl ? sl.money : 0)}</p>` : ''}<p>${esc(sl ? sl.text : '')}</p><button class="sb-btn green big">Büfeye dön</button></div>`;
        o.appendChild(cd);
        cd.querySelector('button')!.addEventListener('click', closeOv);
      }, 60);
    };
    o.querySelector('.hd .x')!.addEventListener('click', () => { if (!finished) finish(0); else closeOv(); });
    o.querySelector('.cd button')!.addEventListener('click', () => { (o.querySelector('.cd') as HTMLElement).remove(); running = true; last = performance.now(); });
    cv.addEventListener('pointerdown', e => {
      if (!running || R.done) return;
      const r = o.getBoundingClientRect(), { cs, ox, oy } = geom();
      const cx = Math.floor((e.clientX - r.left - ox) / cs), cy = Math.floor((e.clientY - r.top - oy) / cs);
      if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return;
      if (Math.abs(cx - R.px) + Math.abs(cy - R.py) !== 1) return;
      if (R.catWait > 0) { R.msg = 'Kedi geçiyor, bekle...'; R.msgT = 0.8; return; }
      const i = cy * COLS + cx, t = R.grid[i];
      if (t === 1 || t === 2) { R.msg = t === 1 ? 'Oradan ev var!' : 'Sandal yok, yüzemezsin!'; R.msgT = 1; return; }
      if (t === 3 && R.stairTaps < 1) { R.stairTaps++; R.msg = 'Merdiven! Bir daha dokun.'; R.msgT = 0.8; return; }
      if (t === 4) { R.catWait = 0.9; R.cats++; R.grid[i] = 0; R.msg = 'Kediye yol verdin. Kibar kurye!'; R.msgT = 1.2; return; }
      R.stairTaps = 0; R.px = cx; R.py = cy; R.hop = 1;
      if (t === 5) {
        // the gull points a short cut: one more square toward the house
        const dx = Math.sign(R.tx - R.px), dy = Math.sign(R.ty - R.py);
        const nx = R.px + (dy !== 0 ? 0 : dx), ny = R.py + (dy !== 0 ? dy : 0);
        if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && R.grid[ny * COLS + nx] !== 1 && R.grid[ny * COLS + nx] !== 2) { R.px = nx; R.py = ny; R.msg = 'Martı kısa yolu gösterdi!'; R.msgT = 1; }
        R.grid[i] = 0;
      }
      d.sfx?.('pick');
      if (R.px === R.tx && R.py === R.ty) { R.done = true; const score = Math.min(100, Math.round(35 + 65 * (left / SEN_GOTUR_SECS) + R.cats * 5)); setTimeout(() => finish(score), 350); }
    });
    const icon = (t: Tile, x: number, y: number, cs: number) => {
      const c = x + cs / 2, m = y + cs / 2;
      g.lineWidth = 2.5; g.strokeStyle = INK;
      if (t === 1) { g.fillStyle = '#f2d6b0'; g.fillRect(x + cs * 0.15, y + cs * 0.35, cs * 0.7, cs * 0.55); g.strokeRect(x + cs * 0.15, y + cs * 0.35, cs * 0.7, cs * 0.55); g.fillStyle = '#c0533c'; g.beginPath(); g.moveTo(x + cs * 0.08, y + cs * 0.38); g.lineTo(c, y + cs * 0.1); g.lineTo(x + cs * 0.92, y + cs * 0.38); g.closePath(); g.fill(); g.stroke(); }
      else if (t === 2) { g.fillStyle = '#8fd0ea'; g.fillRect(x + 2, y + 2, cs - 4, cs - 4); g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(x + cs * 0.15, m); g.quadraticCurveTo(c - cs * 0.15, m - 6, c, m); g.quadraticCurveTo(c + cs * 0.15, m + 6, x + cs * 0.85, m); g.stroke(); }
      else if (t === 3) { g.fillStyle = '#c9b99a'; for (let k = 0; k < 4; k++) { g.fillRect(x + cs * 0.15, y + cs * (0.2 + k * 0.17), cs * 0.7, cs * 0.12); g.strokeRect(x + cs * 0.15, y + cs * (0.2 + k * 0.17), cs * 0.7, cs * 0.12); } }
      else if (t === 4) { g.fillStyle = '#f0a050'; g.beginPath(); g.ellipse(c, m + cs * 0.12, cs * 0.26, cs * 0.15, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.beginPath(); g.arc(c - cs * 0.18, m - cs * 0.02, cs * 0.13, 0, Math.PI * 2); g.fill(); g.stroke(); }
      else if (t === 5) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(c, m, cs * 0.2, cs * 0.12, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.beginPath(); g.moveTo(c - cs * 0.05, m); g.lineTo(c - cs * 0.32, m - cs * 0.22); g.moveTo(c + cs * 0.05, m); g.lineTo(c + cs * 0.32, m - cs * 0.22); g.stroke(); }
    };
    const draw = () => {
      const r = o.getBoundingClientRect(), { cs, ox, oy } = geom();
      g.clearRect(0, 0, r.width, r.height);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const X = ox + x * cs, Y = oy + y * cs, t = R.grid[y * COLS + x];
        const adj = Math.abs(x - R.px) + Math.abs(y - R.py) === 1 && t !== 1 && t !== 2;
        g.fillStyle = adj ? '#fff3b0' : '#efe2c4'; g.fillRect(X + 1, Y + 1, cs - 2, cs - 2);
        g.strokeStyle = 'rgba(59,42,32,.25)'; g.lineWidth = 1; g.strokeRect(X + 1, Y + 1, cs - 2, cs - 2);
        icon(t, X, Y, cs);
      }
      // target house
      { const X = ox + R.tx * cs, Y = oy + R.ty * cs; g.fillStyle = '#ffd23f'; g.strokeStyle = INK; g.lineWidth = 3; g.fillRect(X + cs * 0.15, Y + cs * 0.3, cs * 0.7, cs * 0.6); g.strokeRect(X + cs * 0.15, Y + cs * 0.3, cs * 0.7, cs * 0.6); g.fillStyle = INK; g.font = `900 ${Math.round(cs * 0.22)}px system-ui`; g.textAlign = 'center'; g.fillText('EV', X + cs / 2, Y + cs * 0.7); }
      // player (Sabri on a bike)
      { const X = ox + R.px * cs + cs / 2, Y = oy + R.py * cs + cs / 2 - R.hop * cs * 0.15; g.fillStyle = '#ffd23f'; g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(X, Y, cs * 0.3, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#f2c9a0'; g.beginPath(); g.arc(X, Y - cs * 0.06, cs * 0.14, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = INK; g.fillRect(X - cs * 0.07, Y - cs * 0.08, cs * 0.04, cs * 0.04); g.fillRect(X + cs * 0.03, Y - cs * 0.08, cs * 0.04, cs * 0.04); }
    };
    const loop = (now: number) => {
      if (ov !== o) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
      if (running && !R.done) {
        left -= dt; if (R.catWait > 0) R.catWait -= dt; if (R.msgT > 0) R.msgT -= dt; if (R.hop > 0) R.hop = Math.max(0, R.hop - dt * 6);
        if (left <= 0) { left = 0; finish(0); }
      }
      tmI.style.width = (100 * left / SEN_GOTUR_SECS).toFixed(1) + '%';
      st.textContent = R.msgT > 0 ? R.msg : (running ? Math.ceil(left) + ' sn · kediler: ' + R.cats : '');
      draw();
    };
    window.addEventListener('resize', fit);
    raf = requestAnimationFrame(loop);
    void R;
  }
  function closeOv(): void { if (ov) { cancelAnimationFrame(raf); ov.remove(); ov = null; } }

  return {
    update(dt) {
      const api = kuryeApi(d.rules());
      if (!api) return;
      if ((poll -= dt) <= 0) {
        poll = 0.25;
        v = api.view();
        renderFis();
        const ids = v.tablet.map(o => o.id).join(',');
        if (ids !== lastTabletIds) {
          const fresh = v.tablet.some(o => !lastTabletIds.split(',').includes(String(o.id)));
          lastTabletIds = ids;
          if (fresh) { fis.classList.remove('beep'); void fis.offsetWidth; fis.classList.add('beep'); d.sfx?.('pop'); beepT = 6; }
        }
        mapOn = v.couriers.some(c => c.state !== 'idle');
        mp.style.display = 'none';
        showFeed();
        if (v.self && v.self.n !== selfN) { selfN = v.self.n; const o = v.self.order; openSelf({ semtName: (SEMTLER.find(s => s.id === o.semt) || SEMTLER[0]).name, items: Object.entries(o.items).map(([p, n]) => n + ' ' + (PN[p] || p)).join(', '), value: o.value }); }
        if (v.selfLast && v.selfLast.n !== selfLastN) selfLastN = v.selfLast.n;
      }
      ;
      if (beepT > 0) { beepT -= dt; if (beepT <= 0 && v && v.tablet.length) { fis.classList.remove('beep'); void fis.offsetWidth; fis.classList.add('beep'); d.sfx?.('pop'); beepT = 9; } }
      if (bubT > 0) { bubT -= dt; if (bubT <= 0) bub.style.display = 'none'; }
    },
    dispose() { closeOv(); wrap.remove(); style.remove(); },
  };
}
