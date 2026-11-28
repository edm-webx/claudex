// Halı saha (user 2026-10-24): the maç günü offer card and a playable 5v5 halı saha match.
// View only: reads rt.uiLast.haliSahaTeklif / haliSahaMac (sim/halisaha.ts) and sends { kind: 'halisaha', ... }.
// The match is a top-down 2D canvas game with its own requestAnimationFrame loop while open (the sim is paused):
// 40 x 20 m pitch with walls, 5 a side (keeper + 4), the player controls the teammate nearest the ball.
// Controls (FUT-07): all input lives in hali-saha-girdi.ts (keyboard, touch, gamepad -> one action interface): WASD, Shift, Space pas,
// E uzun pas, F şut (hold = charge), C müdahale, Q değiştir, X çalım; touch buttons ŞUT / PAS / ÇALIM. Two 75 s halves.
// The sim runs on a fixed 1/60 step with an accumulator (FUT-06); the 3D layer gets interpolated views of players and ball.
// Sounds come from the engine synth (whistle, kick, post, net, crowdCheer, crowdOoh in engine/audio).
// 2026-10-24 15:13: the field, players and ball render in 3D (hali-saha-3d.ts); the 2D canvas keeps the HUD.
// Parody teams only. Visual randomness uses Math.random (UI code, not sim).
import { createHaliSaha3D, type HS3 } from './hali-saha-3d';
import { createMatch, FORMATIONS } from '../sim/macmotor';
import { ADIM, createGirdi, dugmeBul, dugmeYerlesimi, nisanYazi, pasHedefi, sabitAdim, yardimSatirlari, type PadBenzeri } from './hali-saha-girdi';
import { tusAdi } from '../../engine/input';
import { flasAzalt } from '../../engine/fx/flas';
import { olayBanner, restartBanner, restartIpucu, sesler, type MacOlay } from './hali-saha-olay';

type Cmd = { kind: string; [k: string]: unknown };
interface Izle { seed: number; s0: number; s1: number; f: [string, string]; oran: Record<string, number>; bahis: '1' | 'X' | '2' | null; n: number; halfS: number }
interface MacInfo { iz?: Izle; team: string; name: string; colors: [string, string]; rival: string; rivalName: string; rivalColors: [string, string]; formasyon?: string; doluluk?: number; ayar?: { skill: [number, number]; formations: [string, string]; plan: [string, string] } }
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
.hs-help{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;width:min(420px,calc(100vw - 28px));max-height:calc(100% - 120px);overflow:auto;background:#fdf3e1;color:#3b2a20;border:4px solid #3b2a20;border-radius:20px;box-shadow:0 6px 0 #3b2a20;padding:14px 18px;font-family:var(--body);cursor:pointer}
.hs-help h3{font:900 22px/1.1 var(--disp);margin:0 0 8px}
.hs-help h4{font:900 15px/1.2 var(--disp);margin:10px 0 3px;color:#7a3f1a}
.hs-help p{font:700 16px/1.4 var(--body);margin:0}
.hs-help b{display:block;margin-top:10px;font:900 15px/1 var(--disp);text-align:center;background:#ffd23f;border:3px solid #3b2a20;border-radius:12px;padding:10px}
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
    try { hs3 = createHaliSaha3D({ wrap, chars: deps.chars || null, esnaf: deps.esnaf?.() || null, L, WD, m0: MOUTH0, m1: MOUTH1, colors: t.colors, rival: t.rivalColors, clubName: t.name, rivalName: t.rivalName, doluluk: t.doluluk }); } catch { hs3 = null; }

    // ---- state: the match itself lives in sim/macmotor.ts (formation + role AI, stats); this view only draws and feeds input
    const FKEYS = Object.keys(FORMATIONS), seed = (Date.now() & 0xfffff) | 1, iz = t.iz || null, HALF = iz ? iz.halfS : HALF_S;
    let speed = 1, acc = 0;
    // 2026-11-08 spectator mode: AI vs AI from the sim's seed with fixed 1/60 steps, so the replay matches the result the sim settled the bet on.
    const M = iz ? createMatch({ seed: iz.seed, human: null, halfS: iz.halfS, skill: [iz.s0, iz.s1], formations: iz.f, names: [HOME_NAMES, AWAY_NAMES] }) : createMatch({ seed, human: 0, humanSlot: 3, formations: t.ayar?.formations || [FORMATIONS[t.formasyon || ''] ? (t.formasyon as string) : '2-2', FKEYS[seed % FKEYS.length] as string], names: [HOME_NAMES, AWAY_NAMES], halfS: HALF_S, skill: t.ayar?.skill || [0.6, 0.55 + (seed % 7) * 0.02], plan: t.ayar?.plan });
    // FUT-02: insan maçında güç, formasyon ve taktik halisaha.macAyari'den (kulüp çetelesi + rakibin lig gücü); eski kayıtta ayar yoksa eski değerler
    const pls = M.pls, ball = M.ball, SABRI = 3;
    const colsOf = (team: number) => (team === 0 ? t.colors : t.rivalColors);
    // 2026-10-26 owner: a referee in every match, stepping in on taç / korner / aut.
    const ref = { x: L / 2, y: WD / 2 + 4, vx: 0, vy: 0, fx: 0, fy: -1, point: 0 };
    let shake = 0;
    const reduceMotion = (() => { try { return !!matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
    sfx('whistle');

    // ---- input (hali-saha-girdi.ts): klavye, dokunmatik ve gamepad aynı eylem arayüzüne yazar
    const syncInput = () => { const [ix, iy] = girdi.vektor(portrait, cw, ch); M.input.ix = ix; M.input.iy = iy; M.input.kos = girdi.kos || (girdi.kaynak === 'dokunmatik' && Math.hypot(ix, iy) > 0.9); };   // dokunmatikte çubuğu sonuna kadar itmek koşturur
    const girdi = createGirdi({ act: (a, g, u) => M.act(a, g, u), sahip: () => M.ball.owner === M.ctrl && M.freeze <= 0, simdi: () => performance.now(), esitle: syncInput });
    const onKey = (e: KeyboardEvent, on: boolean) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (on && !e.repeat && e.key.toLowerCase() === 'h' && !iz) { if (help) hideHelp(); else showHelp(); return; }
      if (M.over || iz) return;
      if (girdi.tus(tusAdi(e), on, e.repeat)) e.preventDefault();
    };
    const kd = (e: KeyboardEvent) => onKey(e, true), ku = (e: KeyboardEvent) => onKey(e, false), blur = () => girdi.birakHepsi();
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
    const cap = (id: number) => { try { wrap.setPointerCapture(id); } catch { /* */ } };
    const onDown = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, B = dugmeYerlesimi(cw, ch);
      if (iz && !M.over && dugmeBul(B, x, y, ['son'])) { speed = speed === 1 ? 3 : speed === 3 ? 12 : 1; return; }
      if (M.over) { if (resultBtn && x > resultBtn.x && x < resultBtn.x + resultBtn.w && y > resultBtn.y && y < resultBtn.y + resultBtn.h) finish(); return; }
      if (iz) return;
      if (dugmeBul(B, x, y, ['yardim'])) { if (help) hideHelp(); else showHelp(); return; }
      const d = dugmeBul(B, x, y);
      if (d === 'sut' || d === 'pas' || d === 'calim') { girdi.dugme(d, true, e.pointerId); cap(e.pointerId); return; }
      if (x < cw * 0.6 && girdi.joyBas(e.pointerId, x, y)) cap(e.pointerId);
    };
    const onMove = (e: PointerEvent) => { if (girdi.joy && e.pointerId === girdi.joy.id) { const r = wrap.getBoundingClientRect(); girdi.joyHareket(e.pointerId, e.clientX - r.left, e.clientY - r.top); } };
    const onUp = (e: PointerEvent) => { girdi.joyBirak(e.pointerId); const a = girdi.sarjKaynak(e.pointerId); if (a) girdi.dugme(a, false, e.pointerId); };
    wrap.addEventListener('pointerdown', onDown); wrap.addEventListener('pointermove', onMove); wrap.addEventListener('pointerup', onUp); wrap.addEventListener('pointercancel', onUp);

    // ---- yardım kartı: maç başında, kapatılabilir (H ya da sol üstteki ? ile tekrar açılır)
    let help: HTMLDivElement | null = null, helpOto = false;
    function showHelp() {
      if (help || iz) return;
      const dokunmatik = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
      const satir = (a: string[]) => a.map(x => '<p>' + x + '</p>').join('');
      help = document.createElement('div'); help.className = 'hs-help';
      help.innerHTML = '<h3>Nasıl oynanır?</h3>' + (dokunmatik ? satir(yardimSatirlari('dokunmatik')) : '<h4>Klavye</h4>' + satir(yardimSatirlari('klavye')) + '<h4>Gamepad takılıysa</h4>' + satir(yardimSatirlari('gamepad'))) + '<b>Anladım (H: yardım)</b>';
      help.addEventListener('pointerdown', ev => { ev.stopPropagation(); hideHelp(); });
      wrap.appendChild(help);
    }
    function hideHelp() { help?.remove(); help = null; helpOto = true; }
    // Kart yalnız ilk iki maçın açılışında kendiliğinden çıkar (sahayı kapatmasın); sonra H ya da ? ile açılır.
    try { const n = +(localStorage.getItem('hsYardimN') || 0); if (n < 2) { localStorage.setItem('hsYardimN', String(n + 1)); showHelp(); } } catch { showHelp(); }

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

    // ---- simulation glue: sabit 1/60 adım; 3D katmana interpolasyonlu görünüm verilir
    const prevP = pls.map(p => ({ x: p.x, y: p.y, fx: p.fx, fy: p.fy })), prevB = { x: ball.x, y: ball.y };
    const rp: typeof pls = pls.map(p => Object.create(p)), rb: typeof ball = Object.create(ball);   // x,y,fx,fy ezilir, diğer alanlar (act, dive, z...) prototipten canlı okunur
    const interp = (a: number) => {
      for (let i = 0; i < pls.length; i++) {
        const p = pls[i], q = prevP[i], v = rp[i], k = Math.abs(p.x - q.x) + Math.abs(p.y - q.y) > 3 ? 1 : a;   // ışınlanma (başlama vuruşu) karışmaz
        v.x = q.x + (p.x - q.x) * k; v.y = q.y + (p.y - q.y) * k; v.fx = q.fx + (p.fx - q.fx) * k; v.fy = q.fy + (p.fy - q.fy) * k;
      }
      const kb = Math.abs(ball.x - prevB.x) + Math.abs(ball.y - prevB.y) > 3 ? 1 : a;
      rb.x = prevB.x + (ball.x - prevB.x) * kb; rb.y = prevB.y + (ball.y - prevB.y) * kb;
    };
    let uiBanner = { text: '', t: 0 }, lastRk: string | undefined, pasH = -1;
    function step() {
      const dt = ADIM;
      syncInput(); girdi.guncelle();
      for (let i = 0; i < pls.length; i++) { const p = pls[i], q = prevP[i]; q.x = p.x; q.y = p.y; q.fx = p.fx; q.fy = p.fy; }
      prevB.x = ball.x; prevB.y = ball.y;
      if (shake > 0) shake = Math.max(0, shake - dt);
      if (uiBanner.t > 0) uiBanner.t -= dt;
      M.step(dt);
      const evs = M.events as unknown as MacOlay[];
      for (const e of evs) {
        if (e.k === 'shake') shake = Math.max(shake, e.t as number);
        else if (e.k === 'banner' && e.text !== 'GOOOOL!' && e.text !== 'KENDİ KALESİNE!' && e.text !== 'Devre arası') ref.point = 1.6;
        const b = olayBanner(e); if (b && !(M.bannerT > 0 && M.banner === b.text)) uiBanner = { text: b.text, t: b.t };
      }
      for (const id of sesler(evs)) sfx(id);
      const rk = M.restart?.kind as string | undefined;
      if (rk !== lastRk) { lastRk = rk; const t = restartBanner(rk); if (t && !(M.bannerT > 0 && M.banner === t)) uiBanner = { text: t, t: 1.6 }; }
      if (help && !helpOto && M.clock > 12) hideHelp();
      const mr = (M as unknown as { ref?: { x: number; y: number; signal: string } }).ref;   // motor hakemi (FUT-05) varsa onu izle
      if (mr) { ref.vx = (mr.x - ref.x) / dt; ref.vy = (mr.y - ref.y) / dt; ref.x = mr.x; ref.y = mr.y; if (mr.signal) ref.point = Math.max(ref.point, 0.2); }
      else {
        const rx = clamp(ball.x - (ball.vx >= 0 ? 3 : -3), 2, L - 2), ry = ball.y < WD / 2 ? clamp(ball.y + 5, 2, WD - 1) : clamp(ball.y - 5, 1, WD - 2);
        const dx = rx - ref.x, dy = ry - ref.y, d = Math.hypot(dx, dy), want = d > 0.3 ? Math.min(6, d * 2) : 0;
        ref.vx += ((d > 0 ? dx / d * want : 0) - ref.vx) * Math.min(1, dt * 5); ref.vy += ((d > 0 ? dy / d * want : 0) - ref.vy) * Math.min(1, dt * 5);
        ref.x += ref.vx * dt; ref.y += ref.vy * dt;
      }
      const fd = len(ball.x - ref.x, ball.y - ref.y); ref.fx = (ball.x - ref.x) / fd; ref.fy = (ball.y - ref.y) / fd; ref.point = Math.max(0, ref.point - dt);
    }

  // ---- drawing
    let resultBtn: { x: number; y: number; w: number; h: number } | null = null;
    const kaba = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    function rrect(x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function line(x0: number, y0: number, x1: number, y1: number) { const a = P(x0, y0), b = P(x1, y1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    function draw() {
      layout();
      const pls = rp, ball = rb;   // çizim interpolasyonlu görünümü okur
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sh = shake > 0 && !reduceMotion && !flasAzalt() ? (Math.random() - 0.5) * shake * 18 : 0;
      g.translate(sh, sh * 0.6);
      if (hs3) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); hs3.render({ score: M.score, pls, ball, ctrl: iz ? -1 : M.ctrl, portrait, shake, dt: lastDt, ref }); }
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
      g.fillStyle = '#fdf3e1'; g.strokeStyle = '#3b2a20'; g.lineWidth = 3; rrect(sbX, 8, sbW, 50, 14); g.fill(); g.stroke();
      g.textBaseline = 'middle'; g.font = `900 ${sbW < 360 ? 14 : 17}px system-ui,sans-serif`;
      g.fillStyle = t.colors[0]; g.fillRect(sbX + 10, 21, 18, 18); g.fillStyle = t.rivalColors[0]; g.fillRect(sbX + sbW - 28, 21, 18, 18);
      g.fillStyle = '#3b2a20'; g.textAlign = 'left'; g.fillText(t.name, sbX + 34, 31, sbW * 0.3); g.textAlign = 'right'; g.fillText(t.rivalName, sbX + sbW - 34, 31, sbW * 0.3);
      g.textAlign = 'center'; g.font = '900 26px system-ui,sans-serif'; g.fillText(M.score[0] + ' - ' + M.score[1], cw / 2, 28);
      const left = Math.max(0, HALF * M.half - M.clock), mm = Math.floor(left / 60), ss = Math.floor(left % 60);
      g.font = '800 14px system-ui,sans-serif'; g.fillText(M.half + '. YARI  ' + mm + ':' + String(ss).padStart(2, '0'), cw / 2, 47);
      // chip: okunur koyu zemin, açık yazı
      const chip = (text: string, x: number, y: number, col = '#fff', align: CanvasTextAlign = 'center') => {
        g.font = '800 16px system-ui,sans-serif'; const tw = g.measureText(text).width + 24, bx = align === 'left' ? x : align === 'right' ? x - tw : x - tw / 2;
        g.fillStyle = 'rgba(20,16,12,.8)'; rrect(bx, y - 15, tw, 30, 12); g.fill(); g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, bx + tw / 2, y + 1);
      };
      // controls
      const B = dugmeYerlesimi(cw, ch);
      const own = ball.owner === M.ctrl, sj = girdi.sarj();
      const btn = (b: { x: number; y: number; r: number }, label: string, col: string) => { g.fillStyle = col; g.strokeStyle = '#3b2a20'; g.lineWidth = 4; g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#3b2a20'; g.font = `900 ${Math.max(20, Math.round(b.r * 0.42))}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, b.x, b.y, b.r * 1.7); };
      if (iz && !M.over) {
        btn(B.son, speed === 1 ? '▶' : speed === 3 ? '⏩' : '⏭', '#fdf3e1');
        const bt = iz.bahis ? 'Bahsin: ' + (iz.bahis === '1' ? t.name : iz.bahis === '2' ? t.rivalName : 'Berabere') + ' · ' + iz.n.toLocaleString('tr') + ' ₺ × ' + iz.oran[iz.bahis] : 'Seyirci modu';
        chip(bt, cw / 2, 76, '#ffd23f');
      }
      if (!M.over && !iz) {
        // 2026-11-21: dokunmatik düğmeler yalnız dokunmatik ekranda / dokunmatikle oynarken çizilir; klavye-gamepad'de sahanın sağ altını kapatıyordu
        const dokun = kaba || girdi.kaynak === 'dokunmatik', cp = pls[M.ctrl];
        if (dokun) { btn(B.sut, own ? 'ŞUT' : 'MÜDAHALE', own ? '#ffd23f' : '#f2a2b3'); btn(B.pas, own ? 'PAS' : 'DEĞİŞ', '#bfe6ff'); btn(B.calim, own ? 'ÇALIM' : 'KOŞ', cp.cd2 > 0 ? '#c9c1b0' : '#a8e6a1'); }
        btn(B.yardim, '?', '#fdf3e1');
        if (sj && dokun) {   // şarj halkası: yeşil -> kırmızı (şut), pas için beyaz -> turkuaz (ara pas)
          const b = sj.a === 'sut' ? B.sut : B.pas;
          g.strokeStyle = sj.a === 'pas' ? (sj.ara ? '#3fb5b0' : '#fff') : `hsl(${120 - sj.oran * 120},85%,50%)`; g.lineWidth = 8; g.beginPath(); g.arc(b.x, b.y, b.r + 8, -Math.PI / 2, -Math.PI / 2 + sj.oran * Math.PI * 2); g.stroke();
        }
        // kontrol edilen oyuncu (3D halkası + bu yazı) ve pas hedefi
        chip('▶ ' + cp.name, 58, 76, '#ffd23f', 'left');
        const [mix, miy] = [M.input.ix, M.input.iy];
        if (own) { pasH = pasHedefi(pls, M.ctrl, mix, miy, pasH); if (pasH >= 0) chip((sj && sj.a === 'pas' && sj.ara ? 'ARA PAS ► ' : 'PAS ► ') + pls[pasH].name, cw - 12, 76, '#bfe6ff', 'right'); }
        else pasH = -1;
        if (sj) {   // alttaki güç çubuğu: kesin okunur
          const bw = Math.min(320, cw - 40), bx = (cw - bw) / 2, by = portrait ? B.calim.y - B.calim.r - 38 : ch - 54;   // dikeyde düğmelerin üstünde
          g.fillStyle = 'rgba(20,16,12,.8)'; rrect(bx - 8, by - 26, bw + 16, 50, 12); g.fill();
          g.fillStyle = '#3a342c'; g.fillRect(bx, by, bw, 12);
          g.fillStyle = sj.a === 'sut' ? `hsl(${120 - sj.oran * 120},85%,50%)` : sj.ara ? '#3fb5b0' : '#fff'; g.fillRect(bx, by, bw * sj.oran, 12);
          g.fillStyle = '#fff'; g.font = '800 15px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(sj.a === 'sut' ? 'ŞUT GÜCÜ  ' + Math.round(sj.oran * 100) + '%  ·  ' + nisanYazi(miy, portrait) : sj.ara ? 'ARA PAS (bırak)' : 'PAS (basılı tut: ara pas)', cw / 2, by - 12);
        }
        const ip = restartIpucu(M.restart?.kind as string | undefined, own); if (ip && !sj) chip(ip, cw / 2, ch - 40, '#ffd23f');
      }
      const jy = girdi.joy;
      if (jy) { const m = Math.max(14, Math.min(cw, ch) * 0.09); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; g.beginPath(); g.arc(jy.ox, jy.oy, m, 0, Math.PI * 2); g.stroke(); const dx = jy.x - jy.ox, dy = jy.y - jy.oy, d = Math.hypot(dx, dy), k = d > m ? m / d : 1; g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(jy.ox + dx * k, jy.oy + dy * k, m * 0.42, 0, Math.PI * 2); g.fill(); }
      // banner (motorunki ya da UI'ın yazdığı: FAUL, PENALTI, KALE VURUŞU...)
      const bn = M.bannerT > 0 ? { text: M.banner, t: M.bannerT } : uiBanner.t > 0 ? uiBanner : null;
      if (bn && !M.over) {
        const a = Math.min(1, bn.t * 2); g.globalAlpha = a; g.font = `900 ${Math.min(64, cw * 0.11)}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 9; g.lineJoin = 'round'; g.strokeStyle = '#3b2a20'; g.strokeText(bn.text, cw / 2, ch * 0.42, cw - 24); g.fillStyle = bn.text.startsWith('GO') ? '#ffd23f' : '#fff'; g.fillText(bn.text, cw / 2, ch * 0.42, cw - 24); g.globalAlpha = 1;
      }
      // result card (Türkçe, okunur; kısa ekranda ölçeklenir)
      resultBtn = null;
      if (M.over) {
        g.fillStyle = 'rgba(6,12,20,.65)'; g.fillRect(0, 0, cw, ch);
        const w = Math.min(380, cw - 24), a = M.teamStats(0), b = M.teamStats(1);
        const pct = (s: { passes: number; passesOk: number }) => (s.passes ? Math.round(s.passesOk / s.passes * 100) : 0) + '%';
        const rows: [string, string, string][] = [['Şut (isabetli)', a.shots + ' (' + a.onTarget + ')', b.shots + ' (' + b.onTarget + ')'], ['Topla oynama', a.possession + '%', b.possession + '%'], ['Pas isabeti', pct(a), pct(b)], ['Kurtarış', '' + a.saves, '' + b.saves], ['Korner', '' + a.corners, '' + b.corners], ['Top çalma', '' + a.tackles, '' + b.tackles]];
        const fa = (a as { fouls?: number }).fouls, fb = (b as { fouls?: number }).fouls; if (fa !== undefined && fb !== undefined) rows.push(['Faul', '' + fa, '' + fb]);
        const need = 146 + rows.length * 26 + 90, k = Math.min(1, (ch - 12) / need);
        g.save(); g.translate(cw / 2, ch / 2); g.scale(k, k);
        const x = -w / 2, y = -need / 2;
        g.fillStyle = '#fdf3e1'; g.strokeStyle = '#3b2a20'; g.lineWidth = 4; rrect(x, y, w, need, 20); g.fill(); g.stroke();
        const r3 = M.score[0] > M.score[1] ? '1' : M.score[0] === M.score[1] ? 'X' : '2';
        const res = iz ? (iz.bahis ? (iz.bahis === r3 ? 'Bahis tuttu! Ödeme ' + Math.round(iz.n * iz.oran[iz.bahis]).toLocaleString('tr') + ' ₺ (net +' + (Math.round(iz.n * iz.oran[iz.bahis]) - iz.n).toLocaleString('tr') + ' ₺)' : 'Bahis yattı') : 'Maç bitti') : M.score[0] > M.score[1] ? 'Kazandın!' : M.score[0] === M.score[1] ? 'Berabere' : 'Kaybettin';
        g.fillStyle = '#3b2a20'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 30px system-ui,sans-serif'; g.fillText(res, 0, y + 38, w - 20);
        g.font = '900 40px system-ui,sans-serif'; g.fillText(M.score[0] + ' - ' + M.score[1], 0, y + 82);
        g.font = '700 16px system-ui,sans-serif'; g.fillText(t.name + (iz ? '' : ' & Sabri') + '  vs  ' + t.rivalName, 0, y + 116, w - 20);
        g.font = '800 17px system-ui,sans-serif'; rows.forEach((r, n) => { const yy = y + 146 + n * 26; g.textAlign = 'left'; g.fillText(r[1], x + 26, yy); g.textAlign = 'center'; g.fillStyle = '#5a3f2e'; g.fillText(r[0], 0, yy); g.fillStyle = '#3b2a20'; g.textAlign = 'right'; g.fillText(r[2], x + w - 26, yy); });
        const bx = x + 24, by = y + need - 70, bw = w - 48, bh = 54;
        g.fillStyle = '#ffd23f'; rrect(bx, by, bw, bh, 14); g.fill(); g.stroke();
        g.fillStyle = '#3b2a20'; g.textAlign = 'center'; g.font = '900 22px system-ui,sans-serif'; g.fillText('Büfeye dön', 0, by + 28);
        g.restore();
        resultBtn = { x: cw / 2 + bx * k, y: ch / 2 + by * k, w: bw * k, h: bh * k };
      }
    }
    let raf = 0, last = performance.now(), closed = false, lastDt = 1 / 60, overAt = 0;
    const fix = sabitAdim(), padOku = (): PadBenzeri | null => { try { for (const p of navigator.getGamepads?.() || []) if (p && p.connected) return p; } catch { /* */ } return null; };
    const loop = (now: number) => {
      if (closed) return; const dt = Math.min(0.1, (now - last) / 1000); last = now; lastDt = dt;
      const pad = padOku(); girdi.gamepad(iz ? null : pad);
      for (let n = fix.ekle(dt * (iz ? speed : 1)); n > 0; n--) step();
      interp(fix.alfa); draw();
      if (M.over) { if (!overAt) overAt = now; else if (pad?.buttons[0]?.pressed && now - overAt > 800) { finish(); return; } }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const keyEnter = (e: KeyboardEvent) => { if (M.over && (e.key === 'Enter' || e.key === ' ')) finish(); };
    window.addEventListener('keydown', keyEnter);
    function finish() { if (closed) return; sfx('pop'); if (iz) { deps.command({ kind: 'halisaha', op: 'izleSonuc' }); close(); return; } deps.command({ kind: 'halisaha', op: 'sonuc', biz: M.score[0], onlar: M.score[1], ist: { takim: [M.teamStats(0), M.teamStats(1)], oyuncu: M.pls.filter(p => p.team === 0).map(p => ({ ad: p.name, rol: p.role, ...p.st })) } }); close(); }
    function close() { closed = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); window.removeEventListener('keydown', keyEnter); girdi.birakHepsi(); hideHelp(); hs3?.dispose(); wrap.remove(); }
    (wrap as unknown as { __hs: unknown }).__hs = { state: () => ({ score: M.score, clock: M.clock, half: M.half, over: M.over, ctrl: M.ctrl, ball: { ...ball }, stats: [M.teamStats(0), M.teamStats(1)] }), act: (k: 'sut' | 'pas' | 'calim', gu?: number, u?: boolean) => M.act(k, gu, u), finish, ff: (sec: number) => { for (let k = 0; k < sec * 60; k++) step(); interp(0); }, tus: (key: string, on: boolean) => girdi.tus(key, on), girdi, M };
    return { close };
  }

  return {
    update() {
      const r = deps.rules(); if (!r) return;
      const of = r.rt.uiLast.haliSahaTeklif as MacInfo | undefined, mac = r.rt.uiLast.haliSahaMac as MacInfo | undefined;
      const ok = of ? of.team + of.rival : '';
      if (ok !== offerKey) { offerKey = ok; if (of) showOffer(of); else { offerEl?.remove(); offerEl = null; } }
      const izl = r.rt.uiLast.haliSahaIzle as (MacInfo & Izle) | undefined;
      const mac2 = mac || (izl ? { ...izl, iz: izl } : undefined);
      const mk = mac2 ? mac2.team + mac2.rival + (izl ? izl.seed : '') : '';
      if (mk !== gameKey) { gameKey = mk; game?.close(); game = mac2 ? startGame(mac2) : null; }
    },
    dispose() { offerEl?.remove(); game?.close(); st.remove(); },
  };
}
