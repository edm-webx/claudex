// Halı saha 3D layer (user 2026-10-24 15:13: "futbol aşırı rezil, 3d bişey yap"). A WebGL canvas behind the 2D HUD canvas of
// hali-saha.ts. FUT-08/09 (2026-11-21): broadcast look. Real grass (engine/render/zemin-detay.ts), crisp line geometry, PBR metal
// goals whose nets catch and damp the ball, a closed ring of stands (shared stadium module view/stadyum/ortak.ts: tiers, roofs,
// rails, instanced low-poly fans that sit, stand, clap, raise arms and wave scarves on the GPU), dugouts, sky gradient and a
// distant city, a limited set of floodlight spots, parody ad boards and a scrolling LED ribbon. ACES exposure 0.85; the lights are
// kept deliberately low (owner: "ışık parlak olmasın, yazılar okunsun").
// Field x (0..L) maps to world X, field y (0..WD) to world Z. Landscape: broadcast camera on the y = WD side (screen right = +x,
// screen down = +y). Portrait: camera behind our goal looking +x (screen up = +x, right = +y), matching the 2D input mapping.
// Motor contract fields are read optionally (?? defaults): ball.z, p.dive/p.diveDir, p.act/p.actT, ref.signal, heat, events.
// Returns null when WebGL or the rigs are missing (2D fallback).
import * as T from 'three';
import { esnafHeroOpts } from '../sim/esnafim';
import { createLookRenderer, LOOK_POZ } from '../../engine/render/look';
import { zeminDetay } from '../../engine/render/zemin-detay';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createKit, tierNow, type Tier, buildStand, buildSeats, createCrowd, buildMast, panoDoku, ledDoku, flagaDoku, formaRengi, REKLAM, type FanSeat, type Seat } from '../view/stadyum/ortak';

interface HeroLike { object: T.Object3D; setPose(p: { x: number; z: number }, r: number): void; setInput(i: Record<string, unknown>): void; update(dt: number, a: number): void; dispose(): void }
export interface Pl3 { x: number; y: number; vx: number; vy: number; fx: number; fy: number; team: 0 | 1; gk: boolean; stun: number; dive?: number; diveDir?: number; act?: string; actT?: number }
export interface HS3 {
  render(o: {
    score?: [number, number]; pls: Pl3[]; ball: { x: number; y: number; vx: number; vy: number; owner: number; z?: number }; ctrl: number; portrait: boolean; shake: number; dt: number;
    ref?: { x: number; y: number; vx: number; vy: number; fx: number; fy: number; point: number; signal?: string };
    /** motor m.heat 0..1 (crowd excitement); events of this frame (motor Ev: goal/save/post/foul/card...) */
    heat?: number; events?: { k: string; team?: number }[];
  }): void;
  dispose(): void;
}
export function createHaliSaha3D(o: {
  wrap: HTMLElement; chars: { makeHero(o: never): unknown } | null; esnaf: Record<string, unknown> | null;
  L: number; WD: number; m0: number; m1: number; colors: [string, string]; rival: [string, string]; clubName?: string; rivalName?: string;
  /** 0..1 expected gate fill (sim/stadyum tahminDoluluk); mapped onto `fill` when `fill` is not given */
  doluluk?: number;
  /** 0..1 share of seats with a fan (default 1) */
  fill?: number;
  tier?: Tier;
}): HS3 | null {
  if (!o.chars) return null;
  const { L, WD } = o;
  const tier = tierNow(o.tier), lo = tier === 'akici';
  const club = (o.clubName || 'EV SAHİBİ').toLocaleUpperCase('tr-TR'), rivalN = (o.rivalName || 'DEPLASMAN').toLocaleUpperCase('tr-TR');
  let ren: T.WebGLRenderer;
  // GRS-01: one look (sRGB + ACES, exposure 0.85 so the floodlights do not blow out); PRF-04: pixel ratio 1.5 instead of 2 on retina
  try { ren = createLookRenderer({ antialias: !lo, exposure: LOOK_POZ.halisaha, pixelRatioMax: lo ? 1 : 1.5 }); } catch { return null; }
  ren.shadowMap.enabled = !lo; ren.shadowMap.type = T.PCFSoftShadowMap;
  const cv = ren.domElement; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  o.wrap.insertBefore(cv, o.wrap.firstChild);
  const kit = createKit();
  const scene = new T.Scene();
  const HORIZON = '#27324a';
  scene.fog = new T.Fog(HORIZON, 70, 175);
  const cam = new T.PerspectiveCamera(42, 1, 0.3, 260);
  const mat = kit.mat, geo = kit.geo;
  const box = (w: number, h: number, d: number, m: T.Material, x: number, y: number, z: number, shadow = true) => { const b = new T.Mesh(geo(new T.BoxGeometry(w, h, d)), m); b.position.set(x, y, z); b.castShadow = shadow; b.receiveShadow = true; scene.add(b); return b; };

  // ---- sky: gradient dome (deep night blue above, city glow at the horizon), no texture
  const skyM = kit.keep(new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new T.Color('#0a1222') }, mid: { value: new T.Color('#1a2440') }, hor: { value: new T.Color(HORIZON) }, glow: { value: new T.Color('#5a4648') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 glow; varying vec3 vP; void main(){ float h = clamp(vP.y, -0.2, 1.0); vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.7, h)); c += glow * 0.35 * exp(-abs(h) * 14.0); gl_FragColor = vec4(c, 1.0); }',
  }));
  const sky = new T.Mesh(geo(new T.SphereGeometry(230, 24, 12)), skyM); sky.position.set(L / 2, 0, WD / 2); scene.add(sky);
  scene.background = new T.Color('#0a1222');

  // ---- lights: night match. Soft sky fill, one shadowing key from the main floodlight bank, a few real spots on dengeli+
  scene.add(new T.HemisphereLight('#b9cdf0', '#24301f', lo ? 0.85 : 0.5));
  const key = new T.DirectionalLight('#fff1d8', lo ? 1.25 : 0.95); key.position.set(L * 0.3, 32, WD + 14); key.target.position.set(L / 2, 0, WD / 2);
  key.castShadow = !lo; key.shadow.mapSize.set(tier === 'sahane' ? 2048 : 1024, tier === 'sahane' ? 2048 : 1024); key.shadow.bias = -0.0004;
  Object.assign(key.shadow.camera, { left: -L / 2 - 3, right: L / 2 + 3, top: WD / 2 + 4, bottom: -WD / 2 - 4, near: 8, far: 75 }); key.shadow.camera.updateProjectionMatrix();
  scene.add(key, key.target);
  const MAST = [[-7, -7], [L + 7, -7], [-7, WD + 8], [L + 7, WD + 8]] as const;
  if (!lo) for (const [mx, mz] of MAST) {
    const sp = new T.SpotLight('#fff3dc', tier === 'sahane' ? 260 : 220, 90, 0.62, 0.55, 1.6);
    sp.position.set(mx, 21, mz); sp.target.position.set(L / 2 + (L / 2 - mx) * -0.35, 0, WD / 2 + (WD / 2 - mz) * -0.3); scene.add(sp, sp.target);
  }
  // metal needs something to reflect: a tiny PMREM of the sky + floodlight panels, used only by metal materials
  let envTex: T.Texture | null = null;
  try {
    const pm = new T.PMREMGenerator(ren), es = new T.Scene();
    es.add(new T.Mesh(new T.SphereGeometry(10, 16, 8), skyM));
    const panel = new T.MeshBasicMaterial({ color: '#fff4dc' });
    for (const [mx, mz] of MAST) { const p = new T.Mesh(new T.BoxGeometry(2, 1.2, 0.2), panel); p.position.set(Math.sign(mx - L / 2) * 6, 6, Math.sign(mz - WD / 2) * 6); es.add(p); }
    envTex = kit.keep(pm.fromScene(es, 0.02).texture); pm.dispose(); panel.dispose();
    es.traverse(m => { if ((m as T.Mesh).isMesh && (m as T.Mesh).geometry) (m as T.Mesh).geometry.dispose(); });
  } catch { envTex = null; }
  const metal = (c: string, r = 0.3) => mat(c, { metalness: 0.85, roughness: r, envMap: envTex, envMapIntensity: 0.7 });

  // ---- ground: real grass with mowing stripes (zemin-detay grass cell), surround of darker turf, concrete concourse
  const tc = kit.canvas(512, 256, (g, w, h) => {
    for (let k = 0; k < 10; k++) { g.fillStyle = k % 2 ? '#3e8f45' : '#47a04e'; g.fillRect(k * w / 10, 0, w / 10 + 1, h); }
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.03)'; g.fillRect(0, k * h / 6, w, h / 6); }
  });
  const turfM = mat('#ffffff', { map: tc, roughness: 0.96 }); zeminDetay(turfM, { force: 2, ds: 0.75, ns: 0.8 });
  const turf = new T.Mesh(geo(new T.PlaneGeometry(L, WD)), turfM); turf.rotation.x = -Math.PI / 2; turf.position.set(L / 2, 0, WD / 2); turf.receiveShadow = true; scene.add(turf);
  const runM = mat('#2f6e37', { roughness: 0.97 }); zeminDetay(runM, { force: 2, ds: 0.6, ns: 0.7 });
  const run = new T.Mesh(geo(new T.PlaneGeometry(L + 12, WD + 14)), runM); run.rotation.x = -Math.PI / 2; run.position.set(L / 2, -0.01, WD / 2 + 1); run.receiveShadow = true; scene.add(run);
  const concM = mat('#6d7077', { roughness: 0.95 }); zeminDetay(concM, { force: 1, ds: 0.5, ns: 0.6 });
  const apron = new T.Mesh(geo(new T.PlaneGeometry(L + 70, WD + 70)), concM); apron.rotation.x = -Math.PI / 2; apron.position.set(L / 2, -0.02, WD / 2); apron.receiveShadow = true; scene.add(apron);
  const outer = new T.Mesh(geo(new T.CircleGeometry(200, 32)), mat('#1d2a22', { roughness: 1 })); outer.rotation.x = -Math.PI / 2; outer.position.set(L / 2, -0.05, WD / 2); scene.add(outer);

  // ---- line markings as geometry (crisp at any distance): touchlines, halfway, circle, boxes, spots, corner arcs
  {
    const lw = 0.1, parts: T.BufferGeometry[] = [];
    const rect = (x0: number, z0: number, x1: number, z1: number) => { const g = new T.PlaneGeometry(Math.abs(x1 - x0) || lw, Math.abs(z1 - z0) || lw); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2); parts.push(g); };
    const outline = (x0: number, z0: number, x1: number, z1: number) => { rect(x0, z0, x1, z0 + lw); rect(x0, z1 - lw, x1, z1); rect(x0, z0, x0 + lw, z1); rect(x1 - lw, z0, x1, z1); };
    const ring = (x: number, z: number, r0: number, r1: number, a0 = 0, a1 = Math.PI * 2) => { const g = new T.RingGeometry(r0, r1, 40, 1, a0, a1 - a0); g.rotateX(-Math.PI / 2); g.translate(x, 0, z); parts.push(g); };
    outline(0.05, 0.05, L - 0.05, WD - 0.05);
    rect(L / 2 - lw / 2, 0.05, L / 2 + lw / 2, WD - 0.05);
    ring(L / 2, WD / 2, 3 - lw, 3); ring(L / 2, WD / 2, 0, 0.16);
    for (const s of [0, 1]) {
      const x0 = s ? L - 6 : 0.05, x1 = s ? L - 0.05 : 6;
      outline(x0, WD / 2 - 5, x1, WD / 2 + 5);
      ring(s ? L - 4.5 : 4.5, WD / 2, 0, 0.14);
      const gx0 = s ? L - 2 : 0.05, gx1 = s ? L - 0.05 : 2; outline(gx0, WD / 2 - 3, gx1, WD / 2 + 3);
    }
    for (const [cx, cz, a] of [[0, 0, 0], [L, 0, Math.PI / 2], [L, WD, Math.PI], [0, WD, -Math.PI / 2]] as const) ring(cx, cz, 0.6, 0.7, -a - Math.PI / 2, -a);
    const lm = new T.Mesh(geo(mergeGeometries(parts)), mat('#f4f6f2', { roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }));
    lm.position.y = 0.006; lm.receiveShadow = true; scene.add(lm); parts.forEach(p => p.dispose());
  }

  // ---- ad boards around the pitch (parody brands only) and the club name between them
  const boardList = [club, ...REKLAM.slice(0, 5), rivalN, ...REKLAM.slice(5)];
  let bi = 0;
  const boardMat = (txt: string) => { const tx = panoDoku(kit, txt); return mat('#ffffff', { map: tx, emissive: '#ffffff', emissiveMap: tx, emissiveIntensity: 0.28, roughness: 0.6 }); };
  const boardsAlong = (z: number, rotY: number) => { for (let k = 0; k < 8; k++) { const b = box(L / 8 - 0.15, 0.9, 0.12, boardMat(boardList[bi % boardList.length]), (k + 0.5) * L / 8, 0.45, z); b.rotation.y = rotY; bi++; } };
  boardsAlong(-0.15, 0); boardsAlong(WD + 0.15, Math.PI);
  for (const x of [-0.15, L + 0.15]) for (const z0 of [0, o.m1]) { const w = z0 === 0 ? o.m0 : WD - o.m1, b = box(w, 0.9, 0.12, boardMat(boardList[bi % boardList.length]), x, 0.45, z0 + w / 2); b.rotation.y = x < 1 ? Math.PI / 2 : -Math.PI / 2; bi++; }

  // ---- halı saha cage net (far side and ends; camera side open) on metal poles
  const netTex = kit.canvas(64, 64, (g) => { g.strokeStyle = 'rgba(230,240,255,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke(); });
  netTex.wrapS = netTex.wrapT = T.RepeatWrapping;
  const netMat = (rx: number, ry: number, op = 1) => { const t = kit.keep(netTex.clone()); t.repeat.set(rx, ry); t.needsUpdate = true; return mat('#ffffff', { map: t, transparent: true, opacity: op, side: T.DoubleSide, depthWrite: false, alphaTest: 0.02 }); };
  const farNet = new T.Mesh(geo(new T.PlaneGeometry(L, 4)), netMat(L / 1.2, 4 / 1.2, 0.55)); farNet.position.set(L / 2, 2.9, -0.3); scene.add(farNet);
  for (const x of [-0.3, L + 0.3]) { const n = new T.Mesh(geo(new T.PlaneGeometry(WD, 4)), netMat(WD / 1.2, 4 / 1.2, 0.55)); n.position.set(x, 2.9, WD / 2); n.rotation.y = Math.PI / 2; scene.add(n); }
  const poleM = metal('#aeb6bf', 0.4);
  for (let k = 0; k <= 8; k++) box(0.1, 4.9, 0.1, poleM, k * L / 8, 2.45, -0.32, false);
  for (const x of [-0.32, L + 0.32]) for (let k = 0; k <= 4; k++) box(0.1, 4.9, 0.1, poleM, x, 2.45, k * WD / 4, false);

  // ---- goals: aluminium posts (PBR metal), nets that bulge where the ball hits and settle
  const postM = metal('#eef1f4', 0.28);
  const gm0 = o.m0, gm1 = o.m1, gh = 2, gd = 1.3, gw = gm1 - gm0;
  type NetS = { pos: T.BufferAttribute; base: Float32Array; amp: number; t: number; iz: number; iy: number; s: number; inside: boolean };
  const nets: NetS[] = [];
  for (const gx of [0, L]) {
    const s = gx === 0 ? -1 : 1;
    const cyl = (len: number, x: number, y: number, z: number, rx: number, rz: number) => { const c = new T.Mesh(geo(new T.CylinderGeometry(0.06, 0.06, len, 14)), postM); c.position.set(x, y, z); c.rotation.set(rx, 0, rz); c.castShadow = true; scene.add(c); };
    for (const z of [gm0, gm1]) { cyl(gh, gx, gh / 2, z, 0, 0); cyl(gh + 0.1, gx + s * gd, gh / 2, z, 0, 0); cyl(gd, gx + s * gd / 2, gh, z, 0, Math.PI / 2); cyl(gd, gx + s * gd / 2, 0.03, z, 0, Math.PI / 2); }
    cyl(gw, gx, gh, (gm0 + gm1) / 2, Math.PI / 2, 0); cyl(gw, gx + s * gd, gh, (gm0 + gm1) / 2, Math.PI / 2, 0); cyl(gw, gx + s * gd, 0.03, (gm0 + gm1) / 2, Math.PI / 2, 0);
    const bg = geo(new T.PlaneGeometry(gw, gh, 14, 8));
    const back = new T.Mesh(bg, netMat(gw * 2.4, gh * 2.4)); back.position.set(gx + s * gd, gh / 2, (gm0 + gm1) / 2); back.rotation.y = Math.PI / 2; scene.add(back);
    const pos = bg.attributes.position as T.BufferAttribute; nets.push({ pos, base: Float32Array.from(pos.array as Float32Array), amp: 0, t: 0, iz: 0, iy: 0, s, inside: false });
    const top = new T.Mesh(geo(new T.PlaneGeometry(gd, gw)), netMat(gd * 2.4, gw * 2.4)); top.rotation.x = -Math.PI / 2; top.position.set(gx + s * gd / 2, gh, (gm0 + gm1) / 2); scene.add(top);
    for (const z of [gm0, gm1]) { const side = new T.Mesh(geo(new T.PlaneGeometry(gd, gh)), netMat(gd * 2.4, gh * 2.4)); side.position.set(gx + s * gd / 2, gh / 2, z); scene.add(side); }
  }

  // ---- stands: closed ring (main stand with roof behind the far side, roofed ends behind both goals, open camera-side stand)
  const stands: T.Group[] = [], seats: Seat[] = [];
  const add = (r: ReturnType<typeof buildStand>) => { stands.push(r.group); seats.push(...r.seats); return r; };
  const main = add(buildStand(kit, scene, { len: L + 6, rows: lo ? 7 : 9, roof: true, aisle: 11, id: 0 }, { x: L / 2, z: -1.6, rotY: 0 }));
  add(buildStand(kit, scene, { len: WD + 6, rows: lo ? 6 : 8, roof: true, aisle: 9, id: 1 }, { x: -2.4, z: WD / 2, rotY: Math.PI / 2 }));
  add(buildStand(kit, scene, { len: WD + 6, rows: lo ? 6 : 8, roof: true, aisle: 9, id: 2 }, { x: L + 2.4, z: WD / 2, rotY: -Math.PI / 2 }));
  add(buildStand(kit, scene, { len: L + 2, rows: 6, aisle: 11, backWall: 0.6, id: 3 }, { x: L / 2, z: WD + 5.2, rotY: Math.PI }));
  for (const g of stands) g.traverse(m => { if ((m as T.Mesh).isMesh) (m as T.Mesh).castShadow = false; });   // tight shadow box: only the pitch casts
  // corner blocks close the ring (concrete with stairs up to the concourse)
  const cornM = mat('#5f656e', { roughness: 0.92 }), exitM = mat('#2f8a4a', { emissive: '#2f8a4a', emissiveIntensity: 0.4 });
  for (const [cx, cz] of [[-4.6, -4.4], [L + 4.6, -4.4], [-4.6, WD + 6.6], [L + 4.6, WD + 6.6]]) {
    box(5.6, 4.2, 5.4, cornM, cx, 2.1, cz, false); box(5.8, 0.08, 5.6, poleM, cx, 4.24, cz, false);
    const fz = cz < 0 ? cz + 2.71 : cz - 2.71; box(1.6, 2.2, 0.06, mat('#15181d'), cx, 1.1, fz, false); box(0.9, 0.28, 0.07, exitM, cx, 2.45, fz, false);   // vomitory door + exit sign
  }
  // seats: home colour behind our goal, away colour behind theirs, main stand in club stripes, camera side grey
  const seatIM = buildSeats(kit, scene, seats, (s) => s.stand === 1 ? o.colors[0] : s.stand === 2 ? o.rival[0] : s.stand === 0 ? (s.row % 3 === 2 ? '#e9ecef' : o.colors[0]) : '#9aa3ad');
  // fans
  let rs = 11; const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
  const fanSeats: FanSeat[] = seats.map(s => {
    let team: 0 | 1 | 2; const fx = s.x / L;
    if (s.stand === 1) team = 0; else if (s.stand === 2) team = 1;
    else if (s.stand === 0) team = fx < 0.4 ? 0 : fx > 0.6 ? 1 : rnd() < 0.5 ? 0 : 1;
    else team = rnd() < 0.55 ? 0 : 2;
    const k = team === 1 ? o.rival : o.colors;
    // tifo: the home end wears its two colours in bands (reads as a block from the pitch)
    const shirt = s.stand === 1 ? ((s.row >> 1) % 2 ? o.colors[1] : o.colors[0]) : team === 2 ? ['#d8d2c4', '#5d6b7a', '#2b2d33', '#8aa0b8'][Math.floor(rnd() * 4)] : formaRengi(k, rnd());
    return { ...s, team, shirt, acc: team === 2 ? '#c9c0b0' : k[rnd() < 0.5 ? 1 : 0] };
  });
  const crowd = createCrowd(kit, scene, fanSeats, { seed: 5 });
  const fillBase = o.fill ?? (o.doluluk == null ? 1 : Math.max(0.2, Math.min(1, 0.25 + 0.75 * o.doluluk)));
  const density = lo ? 0.55 : 1;
  const setFill = (f: number) => crowd.setFill(f * density);
  setFill(fillBase);

  // ---- roof dressing: LED ribbon on the main stand fascia, club and rival banners hung on the front rails, tifo banner, flags
  const led = ledDoku(kit, [club, ...REKLAM]);
  led.repeat.set((L + 6) / 22, 1);
  const ledM = mat('#ffffff', { map: led, emissive: '#ffffff', emissiveMap: led, emissiveIntensity: 0.55, roughness: 0.5 });
  { const l = new T.Mesh(geo(new T.PlaneGeometry(L + 6, 0.5)), ledM); const f = main.roof[1]; l.position.set(L / 2, f.position.y, -1.6 + f.position.z + 0.07); scene.add(l); }
  const banner = (c1: string, c2: string, txt: string, w: number, x: number, y: number, z: number, ry: number) => { const m = new T.Mesh(geo(new T.PlaneGeometry(w, w * 0.2)), mat('#ffffff', { map: flagaDoku(kit, c1, c2, txt), side: T.DoubleSide, roughness: 0.85 })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };
  banner(o.colors[0], o.colors[1], club, 6, L * 0.2, 1.1, -1.52, 0); banner(o.colors[1], o.colors[0], 'HEP SENİNLE', 5, L * 0.4, 1.1, -1.52, 0);
  banner(o.rival[0], o.rival[1], rivalN, 6, L * 0.78, 1.1, -1.52, 0);
  banner(o.colors[0], o.colors[1], club, 6, -2.32, 1.1, WD / 2, Math.PI / 2);
  banner(o.rival[0], o.rival[1], rivalN, 6, L + 2.32, 1.1, WD / 2, -Math.PI / 2);
  { const back = 8 * 0.85 + 0.3, t = banner(o.colors[0], o.colors[1], club + ' • TİFO', WD - 2, -2.4 - back - 0.2, 5.6, WD / 2, Math.PI / 2); t.scale.y = 1.6; }
  const flags: T.Mesh[] = [];
  for (let k = 0; k < 8; k++) { const home = k < 4, fl = new T.Mesh(geo(new T.PlaneGeometry(1.4, 0.9, 6, 1)), mat(home ? o.colors[k % 2] : o.rival[k % 2], { side: T.DoubleSide })); const fx = 1 + k * (L - 2) / 7; fl.position.set(fx + 0.7, 8.9, -1.0); box(0.05, 1.6, 0.05, poleM, fx, 8.5, -1.0, false); scene.add(fl); flags.push(fl); }

  // ---- dugouts (camera side) and the tunnel mouth
  const dugM = mat('#2b313b', { roughness: 0.7 }), perspex = mat('#bcd6e6', { transparent: true, opacity: 0.35, roughness: 0.1, side: T.DoubleSide, depthWrite: false });
  const benchSeats: Seat[] = [];
  for (const [dx, c] of [[-7, o.colors[0]], [7, o.rival[0]]] as const) {
    const x = L / 2 + dx, z = WD + 2.6;
    box(5, 0.12, 1.6, dugM, x, 0.06, z, false); box(5, 1.5, 0.1, dugM, x, 0.75, z + 0.8, false);
    const shell = new T.Mesh(geo(new T.CylinderGeometry(1.25, 1.25, 5, 16, 1, true, -Math.PI / 2, Math.PI)), perspex); shell.rotation.z = Math.PI / 2; shell.rotation.y = 0; shell.position.set(x, 0.15, z + 0.3); shell.scale.set(1, 1, 1); scene.add(shell);
    box(5, 0.08, 0.06, mat(c, { roughness: 0.6 }), x, 1.4, z - 0.95, false);
    for (let i = 0; i < 7; i++) benchSeats.push({ x: x - 2.1 + i * 0.7, y: 0.05, z: z + 0.25, rotY: Math.PI, col: i, row: 0, stand: 9 });
  }
  buildSeats(kit, scene, benchSeats, (s) => s.x < L / 2 ? o.colors[0] : o.rival[0]);
  box(3.2, 2.6, 0.3, mat('#20252d'), L / 2, 1.3, WD + 4.9, false);

  // ---- floodlight masts in the four corners
  for (const [mx, mz] of MAST) buildMast(kit, scene, mx, mz, 20, { x: L / 2, z: WD / 2 });

  // ---- distant city silhouette with dim lit windows, a ring of trees outside the stands
  {
    const winTex = kit.canvas(64, 128, (g, w, h) => { g.fillStyle = '#3a4256'; g.fillRect(0, 0, w, h); for (let y = 6; y < h - 4; y += 10) for (let x = 5; x < w - 4; x += 10) { const r = Math.random(); g.fillStyle = r < 0.32 ? '#ffd9a0' : r < 0.4 ? '#cfe0ff' : '#1b2233'; g.fillRect(x, y, 5, 6); } });
    winTex.wrapS = winTex.wrapT = T.RepeatWrapping; winTex.repeat.set(2, 3);
    const bm = mat('#ffffff', { map: winTex, emissive: '#ffffff', emissiveMap: winTex, emissiveIntensity: 0.22, roughness: 0.9 });
    const n = lo ? 40 : 80, bIM = new T.InstancedMesh(geo(new T.BoxGeometry(1, 1, 1)), bm, n), m4 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), sc = new T.Vector3(), c = new T.Color();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.05, r = 85 + rnd() * 45, h = 8 + rnd() * rnd() * 40;
      v.set(L / 2 + Math.cos(a) * r, h / 2, WD / 2 + Math.sin(a) * r); q.setFromAxisAngle(new T.Vector3(0, 1, 0), -a); sc.set(8 + rnd() * 10, h, 8 + rnd() * 8);
      bIM.setMatrixAt(i, m4.compose(v, q, sc)); bIM.setColorAt(i, c.set(['#4a5168', '#3b4357', '#5a5f70', '#454b5c'][i % 4]));
    }
    scene.add(bIM);
    const tIM = new T.InstancedMesh(geo(new T.ConeGeometry(1.6, 5, 7)), mat('#1f3a2a', { roughness: 0.9 }), lo ? 24 : 48);
    for (let i = 0; i < tIM.count; i++) { const a = (i / tIM.count) * Math.PI * 2, r = 42 + rnd() * 8; v.set(L / 2 + Math.cos(a) * r * 1.2, 2.5, WD / 2 + Math.sin(a) * r * 0.8); q.identity(); const s = 0.8 + rnd() * 0.6; sc.set(s, s, s); tIM.setMatrixAt(i, m4.compose(v, q, sc)); }
    scene.add(tIM);
  }

  let cheerH = 0, cheerA = 0, ooh = 0, lastScore: [number, number] | null = null;
  const crowdIn = { heat: 0, cheer: [0, 0] as [number, number] };   // reused every frame (no per-frame garbage)

  // players: real rigs. Home outfield = colors, home keeper yellow, away keeper dark; Sabri = own esnaf look in our jersey
  const heroes: (HeroLike | null)[] = [];
  const SKIN = [1, 2, 3, 4, 5, 6], HAIR = ['short', 'buzz', 'sport', 'curly', 'wavy', 'bald'], HC = ['#1f1813', '#3a2416', '#6b4a2a', '#2a2a2a'];
  const kitOf = (team: 0 | 1, gk: boolean): Record<string, unknown> => {
    const c = team === 0 ? o.colors : o.rival;
    const top = gk ? (team === 0 ? '#ffd23f' : '#2b2b33') : c[0], acc = gk ? '#ffffff' : c[1];
    return { ust: top, aksan: acc, ustStil: 'jersey', alt: gk ? '#2b2b33' : '#fbf9f4', altStil: 'shorts', ayakkabi: '#1d1d1d', onluk: null, sapka: null, gozluk: null, papyon: null, kravat: null, desen: 0 };
  };
  for (let i = 0; i < 10; i++) {
    const team = (i < 5 ? 0 : 1) as 0 | 1, gk = i % 5 === 0;
    const base = i === 3 && o.esnaf ? { ...o.esnaf } : { ad: '', ten: SKIN[(i * 7) % 6], sac: HAIR[(i * 5) % 6], sacRenk: HC[i % 4], biyik: i % 3 ? 'ince' : 'yok', sakal: i % 4 === 1, vucut: i % 3 === 2 ? 'round' : 'mid', tip: 'a' };
    try {
      const opts = esnafHeroOpts({ ...base, ...kitOf(team, gk) } as never) as Record<string, unknown>;
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
  const ring = new T.Mesh(geo(new T.RingGeometry(0.55, 0.75, 32)), mat('#ffd23f', { emissive: '#ffd23f', emissiveIntensity: 0.6, side: T.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; scene.add(ring);
  const btex = kit.canvas(128, 64, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#1d1d1d'; for (const [x, y] of [[16, 16], [48, 40], [80, 16], [112, 40], [16, 56], [80, 56]]) { g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill(); } });
  const ballM = new T.Mesh(geo(new T.SphereGeometry(0.22, 20, 14)), mat('#ffffff', { map: btex, roughness: 0.5 })); ballM.castShadow = true; scene.add(ballM);
  const shM = kit.keep(new T.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false }));
  const bshadow = new T.Mesh(geo(new T.CircleGeometry(0.24, 16)), shM); bshadow.rotation.x = -Math.PI / 2; scene.add(bshadow);

  let t = 0, bz = 0, bvz = 0, lastOwner = -1, frame = 0;
  const camPos = new T.Vector3(L / 2, 14, WD + 14), camLook = new T.Vector3(L / 2, 0, WD / 2);
  const camT = new T.Vector3();   // shared target vector: no new Vector3 per frame
  let w0 = 0, h0 = 0, camPreset: string | null = null, dbgKick: { i: number; u: number } | null = null;
  const PRESETS: Record<string, [number, number, number, number, number, number, number]> = {
    korner: [L - 0.6, 3.4, WD + 1.6, L - 11, 0.6, WD / 2 - 3, 56],
    kale: [-2.05, 2.5, WD / 2 + 0.4, 10, 0.4, WD / 2, 62],
    tribun: [L * 0.3, 3.2, 5, L * 0.36, 2.6, -6, 55],
    genis: [L / 2, 30, WD + 26, L / 2, 0, WD / 2 - 2, 50],
  };
  // debug/test hook (tests/browser/halisaha-gorsel.mjs): fixed camera presets, fill, draw stats
  (o.wrap as unknown as { __hs3: unknown }).__hs3 = {
    cam: (n: string | null) => { camPreset = n && (PRESETS[n] || n === 'oyuncu') ? n : null; },
    kick: (i: number | null, u = 0.75) => { dbgKick = i == null ? null : { i, u }; },   // test: hold player i in a kick pose (u 0..1)
    setFill, info: () => ({ calls: ren.info.render.calls, tris: ren.info.render.triangles, geos: ren.info.memory.geometries, tex: ren.info.memory.textures, fans: crowd.meshes.reduce((a, m) => a + m.count, 0), seats: crowd.total, tier }),
  };
  return {
    render(s) {
      t += s.dt; frame++;
      const w = o.wrap.clientWidth, h = o.wrap.clientHeight;
      if (w !== w0 || h !== h0) { w0 = w; h0 = h; ren.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); }
      s.pls.forEach((p, i) => {
        const hh = heroes[i]; if (!hh) return;
        const sp = Math.hypot(p.vx, p.vy), dk = !!dbgKick && (dbgKick.i === i || dbgKick.i < 0), act = dk ? 'kick' : p.act ?? '';
        hh.setPose({ x: p.x, z: p.y }, Math.atan2(p.fx, p.fy)); hh.object.position.y = 0; hh.object.rotation.x = 0; hh.object.rotation.z = 0;   // 2026-11-21: setPose only sets rotation.y; the dive/tackle rotateZ/rotateX below piled up frame after frame and players rolled over   // 2026-11-08: setPose lifts heroes onto the world's overpass (ustgecit) whose x/z overlap this pitch, so players floated
        // sprint (> 4.5 m/s) uses the rig's run cycle instead of a sped-up walk; the rig switches to it above 5.5 m/s
        hh.setInput({ speed: sp > 4.5 ? Math.max(sp, 5.6) : sp, carry: 0, act: p.stun > 0 ? 'idle' : act === 'celebrate' ? 'cheer' : sp > 0.3 ? 'walk' : 'idle', mood: p.stun > 0 ? 'sad' : 'happy', t });
        // kick (motor act 'kick', actT counts down from ~0.3 s): right leg back-swing then strike, on the rig's additive joints
        const aj = (hh as unknown as { rig?: { addJ?: Record<string, number> } }).rig?.addJ;
        if (aj) {
          if (act === 'kick' && (dk || (p.actT ?? 0) > 0)) {
            const u = dk ? dbgKick!.u : Math.min(1, Math.max(0, 1 - (p.actT ?? 0) / 0.3));
            if (u < 0.35) { const a = u / 0.35; aj.rtX = 0.5 * a; aj.rkX = 1.2 * a; }
            else { const w = (u - 0.35) / 0.65, sw = Math.sin(Math.min(1, w * 1.6) * Math.PI / 2); aj.rtX = 0.5 - 1.6 * sw * (1 - 0.4 * Math.max(0, w - 0.6)); aj.rkX = 1.2 * (1 - sw); }
          } else { aj.rtX = 0; aj.rkX = 0; }
        }
        hh.update(s.dt, 1);
        const dv = p.dive ?? 0;
        if (dv > 0 && p.diveDir) {   // keeper dive: roll toward the dive side, slide and lift off the turf while airborne
          const k = Math.min(1, dv * 4), yaw = hh.object.rotation.y, side = -Math.sin(yaw) * p.diveDir;
          hh.object.rotateZ(-Math.sign(side || 1) * 1.25 * k); hh.object.position.z += 0.45 * k * p.diveDir; hh.object.position.y = 0.3 * k;
        } else if (act === 'tackle' && (p.actT ?? 0) > 0) hh.object.rotateX(0.35);
      });
      if (refHero && s.ref) {
        const r = s.ref, sp = Math.hypot(r.vx, r.vy);
        refHero.setPose({ x: r.x, z: r.y }, Math.atan2(r.fx, r.fy)); refHero.object.position.y = 0; refHero.object.rotation.x = 0; refHero.object.rotation.z = 0;
        refHero.setInput({ speed: sp, carry: 0, act: r.point > 0 || r.signal ? 'wave' : sp > 0.3 ? 'walk' : 'idle', mood: 'happy', t } as never);
        refHero.update(s.dt, 1);
      }
      const cp = s.pls[s.ctrl]; if (cp) { ring.visible = true; ring.position.set(cp.x, 0.03, cp.y); } else ring.visible = false;
      // crowd: goals light up the scoring end, saves/posts give an "ooh", the ball near a box lifts the general heat
      if (s.score) { if (lastScore) { if (s.score[0] > lastScore[0]) cheerH = 1.2; if (s.score[1] > lastScore[1]) cheerA = 1.2; lastScore[0] = s.score[0]; lastScore[1] = s.score[1]; } else lastScore = [s.score[0], s.score[1]]; }
      if (s.events) for (const e of s.events) { if (e.k === 'save' || e.k === 'post' || e.k === 'shot') ooh = Math.max(ooh, e.k === 'shot' ? 0.35 : 0.7); else if (e.k === 'foul' || e.k === 'card') ooh = Math.max(ooh, 0.3); }
      cheerH = Math.max(0, cheerH - s.dt * 0.22); cheerA = Math.max(0, cheerA - s.dt * 0.22); ooh = Math.max(0, ooh - s.dt * 0.6);
      const nearBox = Math.abs(s.ball.x - L / 2) > L * 0.32 ? 0.3 : 0.08;
      crowdIn.heat = Math.min(1, (s.heat ?? nearBox) + ooh); crowdIn.cheer[0] = Math.min(1.2, cheerH); crowdIn.cheer[1] = Math.min(1.2, cheerA);
      crowd.update(lo ? s.dt * 0.5 : s.dt, crowdIn);
      led.offset.x = (led.offset.x + s.dt * 0.03) % 1;
      if (!lo && frame % 2 === 0) for (const fl of flags) { const p = fl.geometry.attributes.position as T.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 0.7; p.setZ(i, Math.sin(t * 4 + x * 3 + fl.position.x) * 0.12 * x); } p.needsUpdate = true; }
      // ball: motor height when given (ball.z), otherwise a small hop on hard shots; shadow stays on the turf
      let ballZ: number;
      if (s.ball.z != null) ballZ = Math.max(0, s.ball.z);
      else {
        if (s.ball.owner === -1 && lastOwner !== -1 && Math.hypot(s.ball.vx, s.ball.vy) > 19) bvz = 1.6;
        bvz -= 12 * s.dt; bz += bvz * s.dt; if (bz < 0) { bz = 0; bvz = Math.abs(bvz) > 1.2 ? -bvz * 0.35 : 0; } ballZ = bz;
      }
      lastOwner = s.ball.owner;
      // nets: a ball entering the mouth bulges the back net at its point; the ball is held inside the frame
      let bx = s.ball.x;
      const inMouth = s.ball.y > gm0 && s.ball.y < gm1 && ballZ < gh;
      for (const n of nets) {
        const inside = inMouth && (n.s < 0 ? s.ball.x < -0.05 : s.ball.x > L + 0.05);
        if (inside && !n.inside) { n.amp = Math.min(0.55, 0.12 + Math.hypot(s.ball.vx, s.ball.vy) * 0.022); n.t = 0; n.iz = s.ball.y; n.iy = ballZ + 0.22; }
        n.inside = inside;
        if (inside) bx = n.s < 0 ? Math.max(-gd + 0.26 - n.amp * 0.5, bx) : Math.min(L + gd - 0.26 + n.amp * 0.5, bx);
        if (n.amp > 0.002) {
          n.t += s.dt; const env = n.amp * Math.exp(-n.t * 3.2) * Math.cos(n.t * 13), cz = (gm0 + gm1) / 2;
          const a = n.pos.array as Float32Array;
          for (let i = 0; i < n.pos.count; i++) {
            const px = n.base[i * 3], py = n.base[i * 3 + 1];   // plane x = -(world z - cz) after the y rotation, plane y = height - gh/2
            const dz = -px + cz - n.iz, dy = py + gh / 2 - n.iy, f = Math.exp(-(dz * dz + dy * dy) / 0.5);
            a[i * 3 + 2] = n.s * env * f;   // plane +z = world +x: outward is -x for the left goal, +x for the right
          }
          n.pos.needsUpdate = true; if (n.t > 2.5) { n.amp = 0; a.set(n.base); n.pos.needsUpdate = true; }
        }
      }
      ballM.position.set(bx, 0.22 + ballZ, s.ball.y);
      ballM.rotation.z -= s.ball.vx * s.dt / 0.22; ballM.rotation.x += s.ball.vy * s.dt / 0.22;
      bshadow.position.set(bx, 0.02, s.ball.y); const shs = 1 / (1 + ballZ * 0.35); bshadow.scale.setScalar(shs); shM.opacity = 0.3 * shs;
      // camera follows the ball (or a fixed preset for tests)
      if (camPreset === 'oyuncu' && s.pls[1]) { const q = s.pls[1]; camPos.set(q.x + 0.6, 1.3, q.y + 3.6); camLook.set(q.x, 0.8, q.y); cam.fov = 45; }   // test: side close-up of player 1
      else if (camPreset) { const p = PRESETS[camPreset]; camPos.set(p[0], p[1], p[2]); camLook.set(p[3], p[4], p[5]); cam.fov = p[6]; }
      else {
        const cx = Math.max(7, Math.min(L - 7, s.ball.x));
        if (s.portrait) { camPos.lerp(camT.set(Math.max(-8, s.ball.x - 19), 21, WD / 2), 0.08); camLook.lerp(camT.set(Math.min(L, s.ball.x + 4), 0, WD / 2), 0.08); cam.fov = 58; }
        else { camPos.lerp(camT.set(cx, 15, WD + 15), 0.08); camLook.lerp(camT.set(cx, 0, WD / 2 + 0.5), 0.08); cam.fov = 40; }
      }
      cam.updateProjectionMatrix();
      const sh = s.shake > 0 ? (Math.random() - 0.5) * s.shake * 2 : 0;
      cam.position.set(camPos.x + sh, camPos.y + sh * 0.5, camPos.z); cam.lookAt(camLook);
      ren.render(scene, cam);
    },
    dispose() {
      heroes.forEach(h => { try { h?.dispose(); } catch { /* */ } });
      try { refHero?.dispose(); } catch { /* */ }
      seatIM.dispose(); crowd.meshes.forEach(m => m.dispose());
      kit.dispose();
      ren.dispose();
      // ayrı WebGL bağlamı: art arda maç açıp kapatınca tarayıcı bağlam sınırı dolmasın
      try { ren.forceContextLoss(); } catch { /* */ }
      cv.remove();
    },
  };
}
