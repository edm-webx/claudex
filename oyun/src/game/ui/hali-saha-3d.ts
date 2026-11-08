// Halı saha 3D layer (user 2026-10-24 15:13: "futbol aşırı rezil, 3d bişey yap"). A WebGL canvas behind the
// 2D HUD canvas of hali-saha.ts: turf with stripes and lines, cage walls with parody ad boards, goals with nets,
// floodlights, the real char rigs in team jerseys (Sabri wears the player's own esnaf look) and a ball.
// Field x (0..L) maps to world X, field y (0..WD) to world Z. Landscape: broadcast camera on the y = WD side
// (screen right = +x, screen down = +y). Portrait: camera behind our goal looking +x (screen up = +x, right = +y),
// which matches the input mapping of the 2D game. Returns null when WebGL or the rigs are missing (2D fallback).
import * as T from 'three';
import { esnafHeroOpts } from '../sim/esnafim';

interface HeroLike { object: T.Object3D; setPose(p: { x: number; z: number }, r: number): void; setInput(i: Record<string, unknown>): void; update(dt: number, a: number): void; dispose(): void }
export interface Pl3 { x: number; y: number; vx: number; vy: number; fx: number; fy: number; team: 0 | 1; gk: boolean; stun: number }
export interface HS3 { render(o: { score?: [number, number]; pls: Pl3[]; ball: { x: number; y: number; vx: number; vy: number; owner: number }; ctrl: number; portrait: boolean; shake: number; dt: number; ref?: { x: number; y: number; vx: number; vy: number; fx: number; fy: number; point: number } }): void; dispose(): void }

const BOARDS_BASE = ['KOLAZ', 'MARTIKART', 'AYRANBEY', 'BOĞAZ GAZOZU', "SABRİ'NİN BÜFESİ", 'NARÇİÇEK', 'MARTI SU', 'SPOR MARTI'];
let BOARDS = BOARDS_BASE;
const BCOL = ['#e0533c', '#3fb5b0', '#ffd23f', '#7d6bb0'];

export function createHaliSaha3D(o: {
  wrap: HTMLElement; chars: { makeHero(o: never): unknown } | null; esnaf: Record<string, unknown> | null;
  L: number; WD: number; m0: number; m1: number; colors: [string, string]; rival: [string, string]; clubName?: string; rivalName?: string;
}): HS3 | null {
  if (!o.chars) return null;
  const { L, WD } = o;
  BOARDS = o.clubName ? [o.clubName.toUpperCase(), 'MARTIKART', o.rivalName ? o.rivalName.toUpperCase() : 'AYRANBEY', 'BOĞAZ GAZOZU', o.clubName.toUpperCase(), 'NARÇİÇEK', 'MARTI SU', o.clubName.toUpperCase()] : BOARDS_BASE;
  let ren: T.WebGLRenderer;
  try { ren = new T.WebGLRenderer({ antialias: true }); } catch { return null; }
  ren.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  ren.shadowMap.enabled = true; ren.shadowMap.type = T.PCFSoftShadowMap;
  ren.outputColorSpace = T.SRGBColorSpace;
  const cv = ren.domElement; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  o.wrap.insertBefore(cv, o.wrap.firstChild);
  const scene = new T.Scene(); scene.background = new T.Color('#16233a'); scene.fog = new T.Fog('#16233a', 45, 95);
  const cam = new T.PerspectiveCamera(42, 1, 0.3, 200);
  const disp: { dispose(): void }[] = [];
  const mat = (c: string, extra: T.MeshStandardMaterialParameters = {}) => { const m = new T.MeshStandardMaterial({ color: c, roughness: 0.8, ...extra }); disp.push(m); return m; };
  const geo = <G extends T.BufferGeometry>(g: G) => { disp.push(g); return g; };
  const box = (w: number, h: number, d: number, m: T.Material, x: number, y: number, z: number) => { const b = new T.Mesh(geo(new T.BoxGeometry(w, h, d)), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; scene.add(b); return b; };

  // lights: night match under floodlights
  scene.add(new T.HemisphereLight('#cfe2ff', '#2a3a22', 1.1));
  const sun = new T.DirectionalLight('#fff4dc', 2.2); sun.position.set(L * 0.35, 30, WD + 12); sun.target.position.set(L / 2, 0, WD / 2);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 16, bottom: -16, near: 5, far: 80 }); sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);

  // turf texture: stripes, lines, penalty boxes
  const tc = document.createElement('canvas'); tc.width = 1024; tc.height = 512; const g = tc.getContext('2d')!;
  const sx = 1024 / L, sy = 512 / WD;
  for (let k = 0; k < 10; k++) { g.fillStyle = k % 2 ? '#3f9b4a' : '#4aab56'; g.fillRect(k * 4 * sx, 0, 4 * sx + 1, 512); }
  for (let k = 0; k < 2500; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.04)'; g.fillRect(Math.random() * 1024, Math.random() * 512, 2, 2); }
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 5;
  g.strokeRect(3, 3, 1018, 506); g.beginPath(); g.moveTo(512, 0); g.lineTo(512, 512); g.stroke();
  g.beginPath(); g.arc(512, 256, 3 * sx, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(512, 256, 6, 0, Math.PI * 2); g.fill();
  for (const s of [0, 1]) { const x0 = s ? 1024 - 6 * sx : 0; g.strokeRect(x0, 5 * sy, 6 * sx, 10 * sy); g.beginPath(); g.arc(s ? 1024 - 4.5 * sx : 4.5 * sx, 256, 6, 0, Math.PI * 2); g.fill(); }
  const tex = new T.CanvasTexture(tc); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4; disp.push(tex);
  const turf = new T.Mesh(geo(new T.PlaneGeometry(L, WD)), mat('#ffffff', { map: tex, roughness: 0.95 }));
  turf.rotation.x = -Math.PI / 2; turf.position.set(L / 2, 0, WD / 2); turf.receiveShadow = true; scene.add(turf);
  const apron = new T.Mesh(geo(new T.PlaneGeometry(L + 8, WD + 8)), mat('#2f7a3a'));
  apron.rotation.x = -Math.PI / 2; apron.position.set(L / 2, -0.01, WD / 2); apron.receiveShadow = true; scene.add(apron);

  // ad boards around the cage (texture per board)
  const boardMat = (txt: string, c: string) => {
    const bc = document.createElement('canvas'); bc.width = 512; bc.height = 96; const b = bc.getContext('2d')!;
    b.fillStyle = c; b.fillRect(0, 0, 512, 96); b.fillStyle = 'rgba(255,255,255,.18)'; b.fillRect(0, 0, 512, 10);
    b.fillStyle = '#fff'; b.font = '900 54px system-ui,sans-serif'; b.textAlign = 'center'; b.textBaseline = 'middle';
    b.lineWidth = 6; b.strokeStyle = 'rgba(0,0,0,.35)'; b.strokeText(txt, 256, 52, 480); b.fillText(txt, 256, 52, 480);
    const t = new T.CanvasTexture(bc); t.colorSpace = T.SRGBColorSpace; disp.push(t); return mat('#ffffff', { map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.35 });
  };
  let bi = 0;
  const boardsAlong = (z: number, rotY: number) => { for (let k = 0; k < 8; k++) { const b = box(L / 8 - 0.15, 0.9, 0.12, boardMat(BOARDS[bi % BOARDS.length], BCOL[bi % 4]), (k + 0.5) * L / 8, 0.45, z); b.rotation.y = rotY; bi++; } };
  boardsAlong(-0.15, 0); boardsAlong(WD + 0.15, Math.PI);
  for (const x of [-0.15, L + 0.15]) for (const z0 of [0, WD - o.m0]) { const w = o.m0, b = box(0.12, 0.9, w, boardMat(BOARDS[bi % BOARDS.length], BCOL[bi % 4]), x, 0.45, z0 + w / 2); b.rotation.y = x < 1 ? Math.PI / 2 : -Math.PI / 2; b.geometry.dispose(); b.geometry = geo(new T.BoxGeometry(w, 0.9, 0.12)); bi++; }
  // cage net (far side and ends only, so the camera side stays open)
  const netTex = (() => { const nc = document.createElement('canvas'); nc.width = nc.height = 64; const n = nc.getContext('2d')!; n.strokeStyle = 'rgba(230,240,255,.55)'; n.lineWidth = 2; n.beginPath(); n.moveTo(0, 0); n.lineTo(64, 64); n.moveTo(64, 0); n.lineTo(0, 64); n.stroke(); const t = new T.CanvasTexture(nc); t.wrapS = t.wrapT = T.RepeatWrapping; disp.push(t); return t; })();
  const cageMat = (rx: number, ry: number) => { const t = netTex.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; disp.push(t); return mat('#ffffff', { map: t, transparent: true, side: T.DoubleSide, depthWrite: false }); };
  const farNet = new T.Mesh(geo(new T.PlaneGeometry(L, 5)), cageMat(L / 1.2, 5 / 1.2)); farNet.position.set(L / 2, 3.4, -0.25); scene.add(farNet);
  for (const x of [-0.25, L + 0.25]) { const n = new T.Mesh(geo(new T.PlaneGeometry(WD, 5)), cageMat(WD / 1.2, 5 / 1.2)); n.position.set(x, 3.4, WD / 2); n.rotation.y = Math.PI / 2; scene.add(n); }
  const poleM = mat('#c9ccd4', { metalness: 0.6, roughness: 0.35 });
  for (let k = 0; k <= 8; k++) box(0.12, 6, 0.12, poleM, k * L / 8, 3, -0.3);
  // floodlights
  for (const x of [L * 0.2, L * 0.8]) for (const z of [-2, WD + 2]) {
    box(0.25, 11, 0.25, poleM, x, 5.5, z);
    const head = box(2.2, 0.9, 0.4, mat('#fffbe8', { emissive: '#fff6c8', emissiveIntensity: 2 }), x, 11.2, z); head.lookAt(L / 2, 0, WD / 2);
  }
  // goals: posts, crossbar, box net
  const postM = mat('#ffffff', { roughness: 0.4 });
  const gm0 = o.m0, gm1 = o.m1, gh = 2, gd = 1.3;
  for (const gx of [0, L]) {
    const s = gx === 0 ? -1 : 1;
    for (const z of [gm0, gm1]) box(0.14, gh, 0.14, postM, gx, gh / 2, z);
    box(0.14, 0.14, gm1 - gm0 + 0.14, postM, gx, gh, (gm0 + gm1) / 2);
    const back = new T.Mesh(geo(new T.PlaneGeometry(gm1 - gm0, gh)), cageMat((gm1 - gm0) * 2, gh * 2)); back.position.set(gx + s * gd, gh / 2, (gm0 + gm1) / 2); back.rotation.y = Math.PI / 2; scene.add(back);
    const top = new T.Mesh(geo(new T.PlaneGeometry(gd, gm1 - gm0)), cageMat(gd * 2, (gm1 - gm0) * 2)); top.rotation.x = -Math.PI / 2; top.position.set(gx + s * gd / 2, gh, (gm0 + gm1) / 2); scene.add(top);
    for (const z of [gm0, gm1]) { const side = new T.Mesh(geo(new T.PlaneGeometry(gd, gh)), cageMat(gd * 2, gh * 2)); side.position.set(gx + s * gd / 2, gh / 2, z); scene.add(side); }
  }
  // 2026-11-08 user: "görseli çevresi taraftarı asla kalitesiz ve dandik duramaz". Real stands: a long main stand behind the far
  // side and two end stands, concrete tiers with plastic seats, a roof on steel trusses, fans as instanced figures in the two
  // clubs' colours (home end left, away end right), flags and a big club banner; the crowd bounces and roars on goals.
  const tierM = mat('#7d828c', { roughness: 0.95 }), seatCols = [o.colors[0], '#d9dde3', o.rival[0]];
  type Stand = { x0: number; x1: number; z0: number; dz: number; rows: number; rotY: number; side: 'far' | 'w' | 'e' };
  const stands: Stand[] = [{ x0: -2, x1: L + 2, z0: -2.4, dz: -1, rows: 7, rotY: 0, side: 'far' }];
  const fanPos: { x: number; y: number; z: number; team: 0 | 1; ph: number }[] = [];
  for (const st of stands) for (let r = 0; r < st.rows; r++) {
    const z = st.z0 + st.dz * r * 0.85, y = 0.45 + r * 0.55;
    box(st.x1 - st.x0, 0.12, 0.85, tierM, (st.x0 + st.x1) / 2, y, z).receiveShadow = true;
    box(st.x1 - st.x0, y, 0.85, tierM, (st.x0 + st.x1) / 2, y / 2, z).castShadow = false;
    for (let x = st.x0 + 0.4; x < st.x1 - 0.2; x += 0.62) {
      const team: 0 | 1 = x < L * 0.45 ? 0 : x > L * 0.55 ? 1 : (Math.random() < 0.5 ? 0 : 1);
      if (Math.random() < 0.86) fanPos.push({ x: x + (Math.random() - 0.5) * 0.12, y: y + 0.06, z, team, ph: Math.random() * 6 });
    }
  }
  // end stands behind both goals (smaller, steeper)
  for (const [gx, sgn] of [[-3.2, -1], [L + 3.2, 1]] as const) for (let r = 0; r < 5; r++) {
    const x = gx + sgn * r * 0.85, y = 0.45 + r * 0.6;
    box(0.85, 0.12, WD + 2, tierM, x, y, WD / 2); box(0.85, y, WD + 2, tierM, x, y / 2, WD / 2).castShadow = false;
    for (let z = -0.6; z < WD + 0.6; z += 0.62) if (Math.random() < 0.8 && (z < o.m0 - 1.5 || z > o.m1 + 1.5 || r > 1)) fanPos.push({ x: x + (Math.random() - 0.5) * 0.1, y: y + 0.06, z, team: sgn < 0 ? 0 : 1, ph: Math.random() * 6 });
  }
  // roof over the main stand on trusses
  const roofM = mat('#d6dbe2', { metalness: 0.4, roughness: 0.5 });
  box(L + 6, 0.15, 7.2, roofM, L / 2, 6.4, -5.2).castShadow = false;
  for (let x = -2; x <= L + 2; x += 6) { box(0.18, 6.4, 0.18, poleM, x, 3.2, -8.4); box(0.12, 0.12, 7.2, poleM, x, 6.25, -5.2); }
  // seats under the fans
  const seatG = geo(new T.BoxGeometry(0.46, 0.32, 0.42)), seatIM = new T.InstancedMesh(seatG, mat('#ffffff'), fanPos.length);
  // fans: instanced bodies + heads, team coloured; arms up on goals
  const bodyG = geo(new T.BoxGeometry(0.42, 0.62, 0.3)), headG = geo(new T.SphereGeometry(0.15, 8, 6)), scarfG = geo(new T.BoxGeometry(0.9, 0.08, 0.06));
  const bodyIM = new T.InstancedMesh(bodyG, mat('#ffffff'), fanPos.length), headIM = new T.InstancedMesh(headG, mat('#ffffff'), fanPos.length), scarfIM = new T.InstancedMesh(scarfG, mat('#ffffff'), fanPos.length);
  const SKINC = ['#f1c9a5', '#d9a27a', '#b9805a', '#8a5a3c'].map(c => new T.Color(c)), tmpC = new T.Color(), tmpM = new T.Matrix4();
  fanPos.forEach((f, i) => {
    const kit = f.team === 0 ? o.colors : o.rival;
    bodyIM.setColorAt(i, tmpC.set(Math.random() < 0.75 ? kit[0] : Math.random() < 0.5 ? kit[1] : '#3a3d42'));
    headIM.setColorAt(i, SKINC[i % 4]); scarfIM.setColorAt(i, tmpC.set(kit[i % 2]));
    seatIM.setColorAt(i, tmpC.set(seatCols[f.team === 0 ? 0 : 2])); tmpM.makeTranslation(f.x, f.y - 0.02, f.z + 0.12 * (f.z < 0 ? -1 : 0)); seatIM.setMatrixAt(i, tmpM);
  });
  for (const im of [bodyIM, headIM, scarfIM, seatIM]) { im.castShadow = false; im.receiveShadow = false; scene.add(im); }
  // flags on the roof edge and a big club banner across the main stand
  const flagTex = (c1: string, c2: string, txt: string) => { const fc = document.createElement('canvas'); fc.width = 512; fc.height = 96; const f = fc.getContext('2d')!; f.fillStyle = c1; f.fillRect(0, 0, 512, 96); f.fillStyle = c2; f.fillRect(0, 70, 512, 26); f.fillStyle = '#fff'; f.font = '900 52px system-ui,sans-serif'; f.textAlign = 'center'; f.textBaseline = 'middle'; f.fillText(txt, 256, 38, 490); const t = new T.CanvasTexture(fc); t.colorSpace = T.SRGBColorSpace; disp.push(t); return t; };
  const banner = new T.Mesh(geo(new T.PlaneGeometry(14, 1.6)), mat('#ffffff', { map: flagTex(o.colors[0], o.colors[1], (o.clubName || 'EV SAHİBİ').toLocaleUpperCase('tr-TR')), side: T.DoubleSide }));
  banner.position.set(L * 0.25, 5.2, -7.6); scene.add(banner);
  const banner2 = new T.Mesh(geo(new T.PlaneGeometry(12, 1.4)), mat('#ffffff', { map: flagTex(o.rival[0], o.rival[1], (o.rivalName || 'DEPLASMAN').toLocaleUpperCase('tr-TR')), side: T.DoubleSide }));
  banner2.position.set(L * 0.76, 5.2, -7.6); scene.add(banner2);
  const flags: T.Mesh[] = [];
  for (let k = 0; k < 8; k++) { const home = k < 4, fl = new T.Mesh(geo(new T.PlaneGeometry(1.4, 0.9, 6, 1)), mat(home ? o.colors[k % 2] : o.rival[k % 2], { side: T.DoubleSide })); fl.position.set(1 + k * (L - 2) / 7, 7.5, -1.7); box(0.05, 1.4, 0.05, poleM, 1 + k * (L - 2) / 7 - 0.7, 7.1, -1.7); scene.add(fl); flags.push(fl); }
  let cheer = 0, lastScore = '';

  // players: real rigs. Home outfield = colors, home keeper yellow, away keeper dark; Sabri = own esnaf look in our jersey
  const heroes: (HeroLike | null)[] = [];
  const SKIN = [1, 2, 3, 4, 5, 6], HAIR = ['short', 'buzz', 'sport', 'curly', 'wavy', 'bald'], HC = ['#1f1813', '#3a2416', '#6b4a2a', '#2a2a2a'];
  const kit = (i: number, team: 0 | 1, gk: boolean): Record<string, unknown> => {
    const c = team === 0 ? o.colors : o.rival;
    const top = gk ? (team === 0 ? '#ffd23f' : '#2b2b33') : c[0], acc = gk ? '#ffffff' : c[1];
    return { ust: top, aksan: acc, ustStil: 'jersey', alt: gk ? '#2b2b33' : '#fbf9f4', altStil: 'shorts', ayakkabi: '#1d1d1d', onluk: null, sapka: null, gozluk: null, papyon: null, kravat: null, desen: 0 };
  };
  for (let i = 0; i < 10; i++) {
    const team = (i < 5 ? 0 : 1) as 0 | 1, gk = i % 5 === 0;
    const base = i === 3 && o.esnaf ? { ...o.esnaf } : { ad: '', ten: SKIN[(i * 7) % 6], sac: HAIR[(i * 5) % 6], sacRenk: HC[i % 4], biyik: i % 3 ? 'ince' : 'yok', sakal: i % 4 === 1, vucut: i % 3 === 2 ? 'round' : 'mid', tip: 'a' };
    try {
      const opts = esnafHeroOpts({ ...base, ...kit(i, team, gk) } as never) as Record<string, unknown>;
      (opts.look as Record<string, unknown>).bottomStyle = 'shorts'; (opts.look as Record<string, unknown>).sleeves = 'short';
      opts.apron = null; opts.seed = 20 + i;
      const h = o.chars.makeHero(opts as never) as HeroLike;
      scene.add(h.object); h.object.traverse(m => { if ((m as T.Mesh).isMesh) (m as T.Mesh).castShadow = true; });
      heroes.push(h);
    } catch { heroes.push(null); }
  }
  // referee: all black with yellow trim
  let refHero: HeroLike | null = null;
  try {
    const opts = esnafHeroOpts({ ad: '', ten: 3, sac: 'bald', sacRenk: '#2a2a2a', biyik: 'ince', sakal: false, vucut: 'mid', tip: 'a', ust: '#1d1d1d', aksan: '#ffd23f', ustStil: 'jersey', alt: '#1d1d1d', altStil: 'shorts', ayakkabi: '#1d1d1d', onluk: null, sapka: null, gozluk: null, papyon: null, kravat: null, desen: 0 } as never) as Record<string, unknown>;
    (opts.look as Record<string, unknown>).bottomStyle = 'shorts'; (opts.look as Record<string, unknown>).sleeves = 'short';
    opts.apron = null; opts.seed = 99;
    refHero = o.chars!.makeHero(opts as never) as HeroLike;
    scene.add(refHero.object);
  } catch { refHero = null; }
  // controlled-player ring and ball
  const ring = new T.Mesh(geo(new T.RingGeometry(0.55, 0.75, 32)), mat('#ffd23f', { emissive: '#ffd23f', emissiveIntensity: 0.8, side: T.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; scene.add(ring);
  const bc = document.createElement('canvas'); bc.width = 128; bc.height = 64; const bg2 = bc.getContext('2d')!;
  bg2.fillStyle = '#fff'; bg2.fillRect(0, 0, 128, 64); bg2.fillStyle = '#1d1d1d';
  for (const [x, y] of [[16, 16], [48, 40], [80, 16], [112, 40], [16, 56], [80, 56]]) { bg2.beginPath(); bg2.arc(x, y, 8, 0, Math.PI * 2); bg2.fill(); }
  const btex = new T.CanvasTexture(bc); btex.colorSpace = T.SRGBColorSpace; disp.push(btex);
  const ballM = new T.Mesh(geo(new T.SphereGeometry(0.22, 20, 14)), mat('#ffffff', { map: btex, roughness: 0.5 })); ballM.castShadow = true; scene.add(ballM);
  const bshadow = new T.Mesh(geo(new T.CircleGeometry(0.24, 16)), new T.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false })); bshadow.rotation.x = -Math.PI / 2; scene.add(bshadow);

  let t = 0, bz = 0, bvz = 0, lastOwner = -1;
  const camPos = new T.Vector3(L / 2, 14, WD + 14), camLook = new T.Vector3(L / 2, 0, WD / 2);
  let w0 = 0, h0 = 0;
  return {
    render(s) {
      t += s.dt;
      const w = o.wrap.clientWidth, h = o.wrap.clientHeight;
      if (w !== w0 || h !== h0) { w0 = w; h0 = h; ren.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); }
      s.pls.forEach((p, i) => {
        const hh = heroes[i]; if (!hh) return;
        const sp = Math.hypot(p.vx, p.vy);
        hh.setPose({ x: p.x, z: p.y }, Math.atan2(p.fx, p.fy)); hh.object.position.y = 0;   // 2026-11-08: setPose lifts heroes onto the world's overpass (ustgecit) whose x/z overlap this pitch, so players floated
        hh.setInput({ speed: sp, carry: 0, act: p.stun > 0 ? 'idle' : sp > 0.3 ? 'walk' : 'idle', mood: p.stun > 0 ? 'sad' : 'happy', t });
        hh.update(s.dt, 1);
      });
      if (refHero && s.ref) {
        const r = s.ref, sp = Math.hypot(r.vx, r.vy);
        refHero.setPose({ x: r.x, z: r.y }, Math.atan2(r.fx, r.fy)); refHero.object.position.y = 0;
        refHero.setInput({ speed: sp, carry: 0, act: r.point > 0 ? 'wave' : sp > 0.3 ? 'walk' : 'idle', mood: 'happy', t } as never);
        refHero.update(s.dt, 1);
      }
      const cp = s.pls[s.ctrl]; if (cp) { ring.visible = true; ring.position.set(cp.x, 0.03, cp.y); } else ring.visible = false;
      // crowd: idle sway, a big jump and scarves up after a goal
      const sk = s.score ? s.score.join('-') : ''; if (sk !== lastScore) { if (lastScore) cheer = 4; lastScore = sk; }
      cheer = Math.max(0, cheer - s.dt);
      const near = (Math.abs(s.ball.x - L / 2) > L * 0.3 ? 0.35 : 0) + cheer;
      for (let i = 0; i < fanPos.length; i++) {
        const f = fanPos[i], amp = 0.04 + Math.min(1, near) * 0.22, hop = Math.max(0, Math.sin(t * (cheer > 0 ? 9 : 2.4) + f.ph)) * amp;
        tmpM.makeTranslation(f.x, f.y + 0.31 + hop, f.z); bodyIM.setMatrixAt(i, tmpM);
        tmpM.makeTranslation(f.x, f.y + 0.78 + hop, f.z); headIM.setMatrixAt(i, tmpM);
        tmpM.makeTranslation(f.x, f.y + (cheer > 0 ? 1.15 : 0.58) + hop, f.z); scarfIM.setMatrixAt(i, tmpM);
      }
      bodyIM.instanceMatrix.needsUpdate = true; headIM.instanceMatrix.needsUpdate = true; scarfIM.instanceMatrix.needsUpdate = true;
      for (const fl of flags) { const p = fl.geometry.attributes.position as T.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 0.7; p.setZ(i, Math.sin(t * 4 + x * 3 + fl.position.x) * 0.12 * x); } p.needsUpdate = true; }
      // ball: rolls on the ground, hops a little when kicked
      if (s.ball.owner === -1 && lastOwner !== -1 && Math.hypot(s.ball.vx, s.ball.vy) > 19) bvz = 1.6;   // only hard shots lift a little; passes roll on the turf
      lastOwner = s.ball.owner;
      bvz -= 12 * s.dt; bz += bvz * s.dt; if (bz < 0) { bz = 0; bvz = Math.abs(bvz) > 1.2 ? -bvz * 0.35 : 0; }
      ballM.position.set(s.ball.x, 0.22 + bz, s.ball.y);
      ballM.rotation.z -= s.ball.vx * s.dt / 0.22; ballM.rotation.x += s.ball.vy * s.dt / 0.22;
      bshadow.position.set(s.ball.x, 0.02, s.ball.y);
      // camera follows the ball
      const bx = Math.max(7, Math.min(L - 7, s.ball.x));
      if (s.portrait) { camPos.lerp(new T.Vector3(Math.max(-8, s.ball.x - 19), 21, WD / 2), 0.08); camLook.lerp(new T.Vector3(Math.min(L, s.ball.x + 4), 0, WD / 2), 0.08); cam.fov = 58; }
      else { camPos.lerp(new T.Vector3(bx, 15, WD + 15), 0.08); camLook.lerp(new T.Vector3(bx, 0, WD / 2 + 0.5), 0.08); cam.fov = 40; }
      cam.updateProjectionMatrix();
      const sh = s.shake > 0 ? (Math.random() - 0.5) * s.shake * 2 : 0;
      cam.position.set(camPos.x + sh, camPos.y + sh * 0.5, camPos.z); cam.lookAt(camLook);
      ren.render(scene, cam);
    },
    dispose() {
      heroes.forEach(h => { try { h?.dispose(); } catch { /* */ } });
      try { refHero?.dispose(); } catch { /* */ }
      disp.forEach(d => { try { d.dispose(); } catch { /* */ } });
      ren.dispose(); cv.remove();
    },
  };
}
