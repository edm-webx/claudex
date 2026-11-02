/**
 * Hava view (survey motor-7, yasam-5, etkinlik-1, iskele-8, etkinlik-5/6): everything the weather, the seasons and the
 * events show in the world. View only: reads `havaApi(rules).view()`, writes nothing to the sim.
 * - Rain streaks + wet shiny deck + puddles with ripples; snow flakes + white deck/roof/lamp caps + snowballs; fog
 *   (scene fog pulled in, horn from far away); lodos: faster sea, whitecaps, flying hats, crowd leans while walking;
 *   rainbow arcs after a sağanak; light tint per season and weather (sun/hemi/sky/fog from render.tod()).
 * - Seasons: tree crowns re-coloured (spring blossom, autumn orange, winter snow), citizen accessories (winter beanie +
 *   scarf, summer straw hat, umbrellas/newspapers in rain, fans in heat, paper party hats on 23 Nisan).
 * - Table umbrellas (sway in lodos), the flying umbrella and its "Yakala!" ring/label,
 *   the seasonal cart, the Gece Pazarı stalls with lanterns.
 * - A small weather chip under the HUD (not a button).
 * Decisions: particles follow the camera focus; pier pieces hang under the iskele zone root (re-parented when the zone
 * rebuilds); no colliders, no nav edits. Allocation-free per frame except label strings.
 */
import * as T from 'three';
import type { Vec2, Vec3, ScreenPt, SoAStore } from '../../../engine/api';
import type { Rules } from '../../sim/state';
import { havaApi, type HavaView } from '../../sim/hava';
import { AGENT_FLAG } from '../../sim/schema';
import { PIER, PIER_LAMPS, BUFE } from '../../../content/prefabs/iskele/layout';
import { UMBRELLA, MARKET } from '../../../content/hava';
import type { HtmlLabels, HtmlLabel } from '../../ui/labels';
import { crowdWeather } from '../chars/weather-pose';

export interface HavaLookDeps {
  scene: T.Scene;
  root: () => T.Object3D | null;
  rules: () => Rules | null;
  render: unknown;
  focus: () => Vec2;
  agents: () => SoAStore | null;
  crowdHead?: (slot: number, out: Vec3) => boolean;
  labels?: HtmlLabels | null;
  project?: (p: Vec3, out: ScreenPt) => boolean;
  uiRoot?: HTMLElement | null;
  hour: () => number;
  command: (c: { kind: string; [k: string]: unknown }) => void;
  sfx?: (id: string) => void;
  float?: (x: number, z: number, text: string) => void;
}
export interface HavaLookView { update(dt: number): void; relight(): void; dispose(): void }

const RAIN_N = 700, SNOW_N = 600, CAP = 140, HATS = 6, CAPS_W = 14, PUDDLES = 7, BALLS = 3;
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

interface RenderLike {
  sun?: T.DirectionalLight; hemi?: T.HemisphereLight; sky?: T.Mesh; tod?: () => { top: T.Color; hor: T.Color; low: T.Color; fog: T.Color; sun: T.Color; si: number; hs: T.Color; hg: T.Color; hi: number; n: number };
}

export function createHavaLook(d: HavaLookDeps): HavaLookView {
  const R = d.render as RenderLike;
  const geos: T.BufferGeometry[] = [], mats: T.Material[] = [];
  const G = <X extends T.BufferGeometry>(g: X) => { geos.push(g); return g; };
  const M = <X extends T.Material>(m: X) => { mats.push(m); return m; };
  const lam = (c: string) => M(new T.MeshLambertMaterial({ color: c }));

  // ───────── camera-following particles (scene) ─────────
  const sky = new T.Group(); sky.name = 'havaSky'; d.scene.add(sky);
  const rainPos = new Float32Array(RAIN_N * 6), rainSeed = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) { rainSeed[i * 3] = (hash(i) - 0.5) * 36; rainSeed[i * 3 + 1] = hash(i + 0.3) * 14; rainSeed[i * 3 + 2] = (hash(i + 0.7) - 0.5) * 36; }
  const rainGeo = G(new T.BufferGeometry()); rainGeo.setAttribute('position', new T.BufferAttribute(rainPos, 3));
  const rainMat = M(new T.LineBasicMaterial({ color: '#cfe6f5', transparent: true, opacity: 0.55, depthWrite: false }));
  const rain = new T.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; rain.visible = false; rain.renderOrder = 6; sky.add(rain);
  const snowPos = new Float32Array(SNOW_N * 3), snowSeed = new Float32Array(SNOW_N * 3);
  for (let i = 0; i < SNOW_N; i++) { snowSeed[i * 3] = (hash(i + 9) - 0.5) * 34; snowSeed[i * 3 + 1] = hash(i + 9.3) * 12; snowSeed[i * 3 + 2] = (hash(i + 9.7) - 0.5) * 34; }
  const snowGeo = G(new T.BufferGeometry()); snowGeo.setAttribute('position', new T.BufferAttribute(snowPos, 3));
  const snowMat = M(new T.PointsMaterial({ color: '#ffffff', size: 0.16, transparent: true, opacity: 0.9, depthWrite: false }));
  const snow = new T.Points(snowGeo, snowMat); snow.frustumCulled = false; snow.visible = false; snow.renderOrder = 6; sky.add(snow);
  // rainbow: 6 half-ring arcs over the sea
  const rainbow = new T.Group(); rainbow.visible = false; sky.add(rainbow);
  const rbMats: T.MeshBasicMaterial[] = [];
  ['#e0533c', '#f08a3c', '#ffd23f', '#5fbf5f', '#3f8fd8', '#8a6bbf'].forEach((c, i) => {
    const m = M(new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, fog: false, side: T.DoubleSide })); rbMats.push(m);
    const a = new T.Mesh(G(new T.TorusGeometry(70 - i * 2.2, 1.1, 4, 48, Math.PI)), m); rainbow.add(a);
  });
  // flying hats (lodos)
  const hatGeo = G(new T.CylinderGeometry(0.22, 0.22, 0.03, 12)), hatTop = G(new T.CylinderGeometry(0.12, 0.13, 0.13, 10));
  const hats: { g: T.Group; t: number; sp: number; y: number; z: number }[] = [];
  for (let i = 0; i < HATS; i++) {
    const g = new T.Group(); const col = ['#3b2a20', '#c98a52', '#2f7fb3', '#e0533c', '#5d8f45', '#f2e6c8'][i];
    const b = new T.Mesh(hatGeo, lam(col)); const tp = new T.Mesh(hatTop, lam(col)); tp.position.y = 0.07; g.add(b, tp); g.visible = false; sky.add(g);
    hats.push({ g, t: hash(i + 40) * 6, sp: 5 + hash(i + 41) * 3, y: 1.5 + hash(i + 42) * 2, z: (hash(i + 43) - 0.5) * 16 });
  }
  // snowballs
  const ballGeo = G(new T.SphereGeometry(0.09, 8, 6)), ballMat = lam('#ffffff');
  const balls: { m: T.Mesh; t: number; a: Vec3; b: Vec3 }[] = [];
  for (let i = 0; i < BALLS; i++) { const m = new T.Mesh(ballGeo, ballMat); m.visible = false; sky.add(m); balls.push({ m, t: 9, a: { x: 0, y: 0, z: 0 }, b: { x: 0, y: 0, z: 0 } }); }

  // ───────── crowd accessories (instanced, scene) ─────────
  const dummy = new T.Object3D();
  const mkInst = (g: T.BufferGeometry, m: T.Material, colors = false) => { const im = new T.InstancedMesh(g, m, CAP); im.count = 0; im.frustumCulled = false; if (colors) im.instanceColor = new T.InstancedBufferAttribute(new Float32Array(CAP * 3), 3); sky.add(im); return im; };
  const canopyGeo = G(new T.ConeGeometry(0.55, 0.26, 8, 1, true)); canopyGeo.translate(0, 0.13, 0);
  const iUmb = mkInst(canopyGeo, M(new T.MeshLambertMaterial({ color: '#ffffff', side: T.DoubleSide })), true);
  const stickGeo = G(new T.CylinderGeometry(0.012, 0.012, 0.55, 4)); stickGeo.translate(0, -0.12, 0);
  const iStick = mkInst(stickGeo, lam('#3b2a20'));
  const paperGeo = G(new T.BoxGeometry(0.42, 0.02, 0.3));
  const iPaper = mkInst(paperGeo, lam('#efe9dc'));
  const beanieGeo = G(new T.SphereGeometry(0.13, 8, 5, 0, TAU, 0, Math.PI / 2));
  const iBeanie = mkInst(beanieGeo, M(new T.MeshLambertMaterial({ color: '#ffffff' })), true);
  const scarfGeo = G(new T.TorusGeometry(0.12, 0.04, 5, 10)); scarfGeo.rotateX(Math.PI / 2);
  const iScarf = mkInst(scarfGeo, M(new T.MeshLambertMaterial({ color: '#ffffff' })), true);
  const strawGeo = G(new T.CylinderGeometry(0.26, 0.27, 0.025, 12)); const strawTop = G(new T.CylinderGeometry(0.12, 0.13, 0.11, 10)); strawTop.translate(0, 0.06, 0);
  const iStraw = mkInst(strawGeo, lam('#e9cf86')), iStrawTop = mkInst(strawTop, lam('#d9b95e'));
  const fanGeo = G(new T.CircleGeometry(0.14, 8, 0, Math.PI));
  const iFan = mkInst(fanGeo, M(new T.MeshLambertMaterial({ color: '#ffffff', side: T.DoubleSide })), true);
  const partyGeo = G(new T.ConeGeometry(0.08, 0.22, 7)); partyGeo.translate(0, 0.11, 0);
  const iParty = mkInst(partyGeo, M(new T.MeshLambertMaterial({ color: '#ffffff' })), true);
  const insts = [iUmb, iStick, iPaper, iBeanie, iScarf, iStraw, iStrawTop, iFan, iParty];
  const PAL_UMB = ['#e0533c', '#2f7fb3', '#3b3b48', '#ffd23f', '#5d8f45', '#8a6bbf', '#f2a2b3'].map(c => new T.Color(c));
  const PAL_WOOL = ['#c23e2c', '#2f5a8a', '#5d8f45', '#e8964a', '#8a6bbf', '#f2e6c8'].map(c => new T.Color(c));
  const PAL_PARTY = ['#e0533c', '#ffd23f', '#3fb5b0', '#f2a2b3', '#5fbf5f'].map(c => new T.Color(c));

  // ───────── pier pieces (under the iskele zone root) ─────────
  const pier = new T.Group(); pier.name = 'havaPier';
  // wet / snow deck overlays
  const deckW = PIER.x1 - PIER.x0, deckD = PIER.z1 - PIER.z0, deckX = (PIER.x0 + PIER.x1) / 2, deckZ = (PIER.z0 + PIER.z1) / 2;
  const wetMat = M(new T.MeshPhongMaterial({ color: '#25303b', specular: '#ffffff', shininess: 90, transparent: true, opacity: 0, depthWrite: false }));
  const wet = new T.Mesh(G(new T.PlaneGeometry(deckW, deckD)), wetMat); wet.rotation.x = -Math.PI / 2; wet.position.set(deckX, 0.012, deckZ); wet.renderOrder = 1; wet.visible = false; pier.add(wet);
  const snowDeckMat = M(new T.MeshLambertMaterial({ color: '#f7fbff', transparent: true, opacity: 0, depthWrite: false }));
  const snowDeck = new T.Mesh(G(new T.PlaneGeometry(deckW + 0.2, deckD + 0.2)), snowDeckMat); snowDeck.rotation.x = -Math.PI / 2; snowDeck.position.set(deckX, 0.016, deckZ); snowDeck.renderOrder = 1; snowDeck.visible = false; pier.add(snowDeck);
  const puddleMat = M(new T.MeshPhongMaterial({ color: '#4d6b86', specular: '#ffffff', shininess: 120, transparent: true, opacity: 0, depthWrite: false }));
  const rippleMat = M(new T.MeshBasicMaterial({ color: '#dff1ff', transparent: true, opacity: 0, depthWrite: false }));
  const puddles: { p: T.Mesh; r: T.Mesh; t: number }[] = [];
  const pudGeo = G(new T.CircleGeometry(0.6, 16)), ripGeo = G(new T.RingGeometry(0.16, 0.2, 16));
  const PUD_AT: [number, number][] = [[-8.2, 1.6], [5.6, -1.8], [-6.5, -12.4], [2.6, 2.8], [6.8, -11.8], [-9.2, -6.8], [-2.5, 3.4]];
  for (let i = 0; i < PUDDLES; i++) {
    const p = new T.Mesh(pudGeo, puddleMat); p.rotation.x = -Math.PI / 2; p.position.set(PUD_AT[i][0], 0.02, PUD_AT[i][1]); p.scale.set(1 + hash(i) * 0.6, 0.6 + hash(i + 1) * 0.4, 1); p.renderOrder = 2;
    const r = new T.Mesh(ripGeo, rippleMat); r.rotation.x = -Math.PI / 2; r.position.set(PUD_AT[i][0], 0.025, PUD_AT[i][1]); r.renderOrder = 3;
    p.visible = r.visible = false; pier.add(p, r); puddles.push({ p, r, t: hash(i + 5) });
  }
  // snow caps on lamps and the kiosk roof
  const capMat = lam('#fbfdff');
  const lampCaps: T.Mesh[] = PIER_LAMPS.map(([x, z]) => { const m = new T.Mesh(G(new T.SphereGeometry(0.2, 8, 4, 0, TAU, 0, Math.PI / 2)), capMat); m.position.set(x, 3.25, z); m.scale.y = 0.6; m.visible = false; pier.add(m); return m; });
  const roof = new T.Mesh(G(new T.BoxGeometry(1, 1, 1)), capMat); roof.visible = false; pier.add(roof);
  let roofKey = '';
  // seasonal tree crowns (promenade park trees, same spots as pier.ts tree())
  const crownGeo = G(new T.IcosahedronGeometry(1, 1));
  const crowns: T.InstancedMesh = new T.InstancedMesh(crownGeo, M(new T.MeshLambertMaterial({ color: '#ffffff' })), 60);
  crowns.instanceColor = new T.InstancedBufferAttribute(new Float32Array(60 * 3), 3); crowns.frustumCulled = false; crowns.visible = false; pier.add(crowns);
  // Faz 2 (clipping/ağaç): the crowns floated with no trunk; one trunk per tree under its crown
  const trunks: T.InstancedMesh = new T.InstancedMesh(G(new T.CylinderGeometry(0.16, 0.22, 1, 6).translate(0, 0.5, 0)), M(new T.MeshLambertMaterial({ color: '#7a5636' })), 20);
  trunks.frustumCulled = false; trunks.visible = false; pier.add(trunks);
  const crownSpots: [number, number, number, number][] = []; // x y z r
  for (let x = -54; x <= 54; x += 9) {
    const s = 0.9 + (Math.abs(x) % 3) * 0.05, tx = x + 0.5, tz = 11.6;
    for (const [a, y, c, r0] of [[0, 2.7, 0, 1.25], [0.6, 2.4, 0.3, 0.9], [-0.55, 2.5, -0.2, 0.95], [0.1, 3.3, -0.1, 0.85]]) crownSpots.push([tx + a * s, y * s, tz + c * s, r0 * s * 1.06]);
  }
  let crownSeason = '';
  // table umbrellas
  const tUmb: { g: T.Group; can: T.Mesh }[] = [];
  const poleGeo = G(new T.CylinderGeometry(0.035, 0.035, 2.3, 6)); poleGeo.translate(0, 1.15, 0);
  const bigCan = G(new T.ConeGeometry(1.15, 0.42, 8, 1, true)); bigCan.translate(0, 0.21, 0);
  const tipGeo = G(new T.SphereGeometry(0.06, 6, 4));
  for (let i = 0; i < UMBRELLA.max; i++) {
    const g = new T.Group(); const pole = new T.Mesh(poleGeo, lam('#f2e6c8'));
    const can = new T.Mesh(bigCan, M(new T.MeshLambertMaterial({ color: UMBRELLA.colors[i], side: T.DoubleSide }))); can.position.y = 2.1;
    const tip = new T.Mesh(tipGeo, lam('#fbfaf6')); tip.position.y = 2.55; can.add(new T.Mesh(G(new T.ConeGeometry(1.17, 0.12, 8, 1, true)).translate(0, 0.05, 0), M(new T.MeshLambertMaterial({ color: '#fbfaf6', side: T.DoubleSide }))));
    g.add(pole, can, tip); g.visible = false; pier.add(g); tUmb.push({ g, can });
  }
  // flying umbrella + catch ring
  const flyG = new T.Group(); flyG.visible = false; pier.add(flyG);
  const flyMat = M(new T.MeshLambertMaterial({ color: '#e0533c', side: T.DoubleSide }));
  const flyCan = new T.Mesh(bigCan, flyMat); flyCan.scale.setScalar(0.75); flyG.add(flyCan);
  const flyPole = new T.Mesh(poleGeo, lam('#f2e6c8')); flyPole.scale.set(1, 0.5, 1); flyPole.position.y = -1.1; flyG.add(flyPole);
  const ringMat = M(new T.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.8, depthWrite: false }));
  const ring = new T.Mesh(G(new T.RingGeometry(1.1, 1.35, 28)), ringMat); ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 4; pier.add(ring);
  // seasonal cart (corner by the east lamp)
  const cart = new T.Group(); cart.position.set(6.9, 0, 3.35); cart.rotation.y = -Math.PI / 2; pier.add(cart);
  const cartBody = new T.Mesh(G(new T.BoxGeometry(0.95, 0.55, 0.55)), lam('#c98a52')); cartBody.position.y = 0.55; cart.add(cartBody);
  const wheelGeo = G(new T.CylinderGeometry(0.17, 0.17, 0.05, 10)); wheelGeo.rotateX(Math.PI / 2);
  [-0.33, 0.33].forEach(x => { const w = new T.Mesh(wheelGeo, lam('#3b2a20')); w.position.set(x, 0.17, 0.3); cart.add(w); });
  const cartTop = new T.Mesh(G(new T.BoxGeometry(1.05, 0.05, 0.62)), lam('#fbfaf6')); cartTop.position.y = 1.4; cart.add(cartTop);
  [-0.46, 0.46].forEach(x => { const p = new T.Mesh(G(new T.CylinderGeometry(0.02, 0.02, 0.6, 4)), lam('#3b2a20')); p.position.set(x, 1.1, 0); cart.add(p); });
  const cartGoods: T.Mesh[] = [];
  const goodGeo = G(new T.SphereGeometry(0.07, 6, 5));
  const goodMat = M(new T.MeshLambertMaterial({ color: '#8a5d3b' }));
  for (let i = 0; i < 9; i++) { const g = new T.Mesh(goodGeo, goodMat); g.position.set(-0.3 + (i % 3) * 0.3, 0.87, -0.15 + Math.floor(i / 3) * 0.15); cart.add(g); cartGoods.push(g); }
  const smokeMat = M(new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }));
  const smokes = [0, 1, 2].map(i => { const s = new T.Mesh(goodGeo, smokeMat); s.position.set(0, 1, 0); s.userData.t = i / 3; cart.add(s); return s; });
  let cartFood = '';
  // Gece Pazarı stalls along the west railing
  const market = new T.Group(); market.visible = false; pier.add(market);
  const lanterns: T.Mesh[] = [];
  const lanMat = M(new T.MeshBasicMaterial({ color: '#ffcf6a' }));
  MARKET.items.forEach((it, i) => {
    const s = new T.Group(); s.position.set(-9.35, 0, -9.6 + i * 2.6); s.rotation.y = Math.PI / 2;
    const table = new T.Mesh(G(new T.BoxGeometry(1.3, 0.08, 0.6)), lam('#8a6242')); table.position.y = 0.85; s.add(table);
    const cloth = new T.Mesh(G(new T.BoxGeometry(1.32, 0.45, 0.62)), lam(['#c23e2c', '#2f7fb3', '#5d8f45', '#8a6bbf'][i])); cloth.position.y = 0.6; s.add(cloth);
    [-0.6, 0.6].forEach(x => { const p = new T.Mesh(G(new T.CylinderGeometry(0.025, 0.025, 2.0, 4)), lam('#3b2a20')); p.position.set(x, 1.0, -0.25); s.add(p); });
    const aw = new T.Mesh(G(new T.BoxGeometry(1.45, 0.05, 0.8)), lam(['#ffd23f', '#fbfaf6', '#f2a2b3', '#3fb5b0'][i])); aw.position.set(0, 2.0, 0.05); aw.rotation.x = -0.25; s.add(aw);
    for (let k = 0; k < 4; k++) { const g = new T.Mesh(goodGeo, lam(it.color)); g.position.set(-0.4 + k * 0.27, 0.95, 0.05); s.add(g); }
    for (let k = 0; k < 3; k++) { const l = new T.Mesh(G(new T.SphereGeometry(0.09, 8, 6)), lanMat); l.position.set(-0.5 + k * 0.5, 1.85, 0.35); s.add(l); lanterns.push(l); }
    market.add(s);
  });
  let pierParent: T.Object3D | null = null;

  // ───────── HUD chip ─────────
  let chip: HTMLDivElement | null = null;
  if (d.uiRoot) {
    chip = document.createElement('div');
    chip.style.cssText = 'position:absolute;right:calc(var(--sr,0px) + 8px);top:calc(var(--hudb,100px) + 6px);z-index:23;pointer-events:none;background:var(--paper,#fffaf1);color:var(--ink,#3b2a20);border:2.5px solid var(--ink,#3b2a20);border-radius:14px;box-shadow:0 3px 0 rgba(59,42,32,.35);padding:4px 10px;font:800 14px/1.2 system-ui,sans-serif;text-align:right;max-width:52vw;opacity:0;transition:opacity .4s';
    d.uiRoot.appendChild(chip);
  }
  let chipKey = '';

  // ───────── labels ─────────
  let flyLabel: HtmlLabel | null = null, mktLabel: HtmlLabel | null = null;
  const scr: ScreenPt = { x: 0, y: 0 }, tmp: Vec3 = { x: 0, y: 0, z: 0 };
  const showLabel = (l: HtmlLabel | null, x: number, y: number, z: number, html: string, cls: string): boolean => {
    if (!l || !d.project) return false; tmp.x = x; tmp.y = y; tmp.z = z;
    if (!d.project(tmp, scr)) { l.hide(); return false; }
    l.set(scr.x, scr.y, html, cls); return true;
  };

  // ───────── state ─────────
  let t = 0, wetK = 0, snowK = 0, fogK = 0, rainK = 0, flakeK = 0, lodosK = 0, heatK = 0, rainbowK = 0, lightT = 0, hornT = 15, seaOff = 0;
  let sea: T.Mesh | null = null, seaParent: T.Object3D | null = null;
  const C1 = new T.Color(), C2 = new T.Color(), GREY = new T.Color('#8f9ba6'), FOGC = new T.Color('#c9d1d8');
  const TINT: Record<string, T.Color> = { ilkbahar: new T.Color('#fff2f5'), yaz: new T.Color('#fff6df'), sonbahar: new T.Color('#ffe7c9'), kis: new T.Color('#e4edff') };
  const CROWN: Record<string, string[]> = { ilkbahar: ['#f6b8cf', '#fbd3e2', '#b9d98f'], sonbahar: ['#d9822b', '#c2551f', '#f2b632'], kis: ['#f4f8fc', '#e6eef6', '#ffffff'] };
  const head: Vec3 = { x: 0, y: 0, z: 0 };

  function attachPier(): void {
    const r = d.root();
    if (r && r !== pierParent) { r.add(pier); pierParent = r; roofKey = ''; sea = null; }
    if (!r && pierParent) { pierParent.remove(pier); pierParent = null; }
    if (r && (!sea || seaParent !== r)) {
      seaParent = r; sea = null;
      r.traverse(o => { const m = (o as T.Mesh).material as T.ShaderMaterial | undefined; if (!sea && m && (m as T.ShaderMaterial).uniforms && m.uniforms.uTime && m.uniforms.uFerry) sea = o as T.Mesh; });
    }
  }
  function placeRoof(): void {
    const r = pierParent; if (!r) return;
    let kiosk: T.Object3D | null = null;
    r.traverse(o => { if (!kiosk && o.name === 'kiosk' && o.children.length) kiosk = o; });
    const key = kiosk ? (kiosk as T.Object3D).uuid + ':' + (kiosk as T.Object3D).children.length : 'none';
    if (key === roofKey) return; roofKey = key;
    const box = new T.Box3();
    if (kiosk) box.setFromObject(kiosk); else box.set(new T.Vector3(BUFE.x0, 0, BUFE.z0), new T.Vector3(BUFE.x1, 3, BUFE.z1));
    if (!isFinite(box.max.y) || box.max.y < 1) box.set(new T.Vector3(BUFE.x0, 0, BUFE.z0), new T.Vector3(BUFE.x1, 3, BUFE.z1));
    const sx = Math.min(box.max.x - box.min.x, BUFE.x1 - BUFE.x0 + 1.4), sz = Math.min(box.max.z - box.min.z, BUFE.z1 - BUFE.z0 + 1.4);
    roof.scale.set(sx * 0.92, 0.14, sz * 0.92); roof.position.set((box.min.x + box.max.x) / 2, box.max.y + 0.03, (box.min.z + box.max.z) / 2);
    pierParent!.worldToLocal(roof.position);
  }

  let baseHemi = 1, flashK = 0, flashT = 20, flashAge = 9;
  function lightning(dt: number, kd: string, k: number): void {
    if ((kd === 'firtina' || kd === 'saganak') && k > 0.7 && !(kd === 'saganak' && rainK < 0.8)) {
      flashT -= dt;
      if (flashT <= 0) { flashT = (kd === 'firtina' ? 14 : 30) + Math.random() * (kd === 'firtina' ? 26 : 50); flashAge = 0; }
    }
    flashAge += dt;
    flashK = flashAge < 0.06 ? flashAge / 0.06 : Math.max(0, 1 - (flashAge - 0.06) / 0.55);
    flashK = flashK * flashK * (3 - 2 * flashK) * 0.55;
    if (R.hemi) R.hemi.intensity = baseHemi + flashK * 1.3;
  }

  function light(v: HavaView): void {
    const tod = R.tod?.(); if (!tod || !R.sun || !R.hemi) return;
    const dark = clamp(rainK * 0.55 + flakeK * 0.3 + fogK * 0.35, 0, 0.7);
    C1.copy(tod.sun).multiply(TINT[v.season] || TINT.yaz).lerp(GREY, dark * 0.6);
    R.sun.color.copy(C1); R.sun.intensity = tod.si * (1 - dark * 0.5) * (heatK > 0 ? 1 + heatK * 0.08 : 1);
    R.hemi.color.copy(tod.hs).lerp(GREY, dark * 0.4); baseHemi = tod.hi * (1 - dark * 0.15); R.hemi.intensity = baseHemi;
    const su = (R.sky?.material as T.ShaderMaterial | undefined)?.uniforms;
    if (su && su.uTop && su.uHor) { su.uTop.value.copy(tod.top).lerp(GREY, dark * (1 - tod.n * 0.7)); su.uHor.value.copy(tod.hor).lerp(FOGC, dark * (1 - tod.n * 0.7)); if (su.uLow) su.uLow.value.copy(tod.low).lerp(GREY, dark * 0.8 * (1 - tod.n * 0.7)); }
    const fog = d.scene.fog as T.Fog | null;
    if (fog) {
      fog.color.copy(tod.fog).lerp(C2.copy(FOGC).multiplyScalar(1 - tod.n * 0.6), clamp(dark + fogK * 0.6, 0, 1));
      const sm = R.sky?.material as T.Material | undefined;
      if (sm) sm.userData.autoFog = fogK < 0.05;
      if (fogK >= 0.05) { fog.near = 6 + (1 - fogK) * 40; fog.far = 30 + (1 - fogK) * 140; }
    }
  }

  function crowd(v: HavaView): void {
    for (const im of insts) im.count = 0;
    const ag = d.agents(); if (!ag || !d.crowdHead) return;
    const flagsA = ag.u16('flags'), rotA = ag.f32('rot'), hi = Math.min(ag.hi, 256);
    const wetOn = rainK > 0.25 || flakeK > 0.5, heatOn = heatK > 0.3;
    const winter = v.season === 'kis', summer = v.season === 'yaz';
    let nU = 0, nP = 0, nB = 0, nS = 0, nW = 0, nF = 0, nY = 0;
    for (let i = 0; i < hi; i++) {
      const f = flagsA[i]; if (!(f & AGENT_FLAG.visible) || (f & AGENT_FLAG.hero)) continue;
      if (!d.crowdHead(i, head) || !(head.y > 0.5)) continue;
      const h = hash(i * 3.17), ry = rotA[i], sit = (f & AGENT_FLAG.seated) !== 0;
      if (wetOn && !sit && h < 0.75 && nU < CAP) {
        if (h < 0.55) {
          dummy.position.set(head.x, head.y + 0.42, head.z); dummy.rotation.set(Math.sin(t * 2 + i) * 0.05 + lodosK * 0.25, ry, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
          iUmb.setMatrixAt(nU, dummy.matrix); iStick.setMatrixAt(nU, dummy.matrix); iUmb.setColorAt(nU, PAL_UMB[(i * 7) % PAL_UMB.length]); nU++;
        } else if (nP < CAP) {
          dummy.position.set(head.x, head.y + 0.08, head.z); dummy.rotation.set(0.15, ry, 0.1); dummy.scale.setScalar(1); dummy.updateMatrix(); iPaper.setMatrixAt(nP++, dummy.matrix);
        }
        continue;
      }
      if (winter && h > 0.3) {
        const c = PAL_WOOL[(i * 5) % PAL_WOOL.length];
        if (nB < CAP && h > 0.45) { dummy.position.set(head.x, head.y - 0.12, head.z); dummy.rotation.set(0, ry, 0); dummy.scale.set(1, 1.05, 1); dummy.updateMatrix(); iBeanie.setMatrixAt(nB, dummy.matrix); iBeanie.setColorAt(nB, c); nB++; }
        if (nS < CAP) { dummy.position.set(head.x, head.y - 0.36, head.z); dummy.rotation.set(0, ry, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); iScarf.setMatrixAt(nS, dummy.matrix); iScarf.setColorAt(nS, PAL_WOOL[(i * 3 + 1) % PAL_WOOL.length]); nS++; }
      } else if ((summer || heatOn) && h > 0.6 && nW < CAP) {
        dummy.position.set(head.x, head.y - 0.07, head.z); dummy.rotation.set(0, ry, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); iStraw.setMatrixAt(nW, dummy.matrix); iStrawTop.setMatrixAt(nW, dummy.matrix); nW++;
      }
      if (heatOn && h < 0.45 && nF < CAP) {
        const s = Math.sin(ry), c = Math.cos(ry);
        dummy.position.set(head.x + s * 0.22 + c * 0.12, head.y - 0.2, head.z + c * 0.22 - s * 0.12); dummy.rotation.set(0, ry + Math.sin(t * 9 + i) * 0.6, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
        iFan.setMatrixAt(nF, dummy.matrix); iFan.setColorAt(nF, PAL_PARTY[(i * 2) % PAL_PARTY.length]); nF++;
      }
    }
    iUmb.count = iStick.count = nU; iPaper.count = nP; iBeanie.count = nB; iScarf.count = nS; iStraw.count = iStrawTop.count = nW; iFan.count = nF; iParty.count = nY;
    for (const im of insts) { if (im.count) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; } }
  }

  function snowballs(dt: number): void {
    const ag = d.agents();
    for (const b of balls) {
      if (b.t < 1) {
        b.t += dt * 1.3;
        const k = Math.min(1, b.t);
        b.m.position.set(b.a.x + (b.b.x - b.a.x) * k, b.a.y + (b.b.y - b.a.y) * k + Math.sin(k * Math.PI) * 1.2, b.a.z + (b.b.z - b.a.z) * k);
        b.m.visible = true; continue;
      }
      b.m.visible = false;
      if (flakeK < 0.5 || !ag || !d.crowdHead || Math.random() > dt * 0.25) continue;
      const fl = ag.u16('flags'), hi = Math.min(ag.hi, 256);
      let i1 = -1, i2 = -1;
      for (let tries = 0; tries < 12 && (i1 < 0 || i2 < 0); tries++) { const i = Math.floor(Math.random() * hi); if ((fl[i] & AGENT_FLAG.visible) && !(fl[i] & AGENT_FLAG.hero)) { if (i1 < 0) i1 = i; else if (i !== i1) i2 = i; } }
      if (i1 < 0 || i2 < 0) continue;
      if (!d.crowdHead(i1, b.a) || !d.crowdHead(i2, b.b)) continue;
      if (Math.hypot(b.a.x - b.b.x, b.a.z - b.b.z) > 7) continue;
      b.a.y -= 0.4; b.b.y -= 0.3; b.t = 0;
    }
  }

  function particles(dt: number, f: Vec2): void {
    sky.position.set(0, 0, 0);
    if (rainK > 0.02) {
      rain.visible = true; rainMat.opacity = 0.3 * rainK;
      const n = Math.floor(RAIN_N * 0.6 * clamp(rainK, 0.2, 1)), wind = 2 + lodosK * 6;
      for (let i = 0; i < RAIN_N; i++) {
        const o = i * 6;
        if (i >= n) { rainPos[o + 1] = rainPos[o + 4] = -50; continue; }
        let y = rainSeed[i * 3 + 1] - dt * 16; if (y < 0) y += 14; rainSeed[i * 3 + 1] = y;
        const x = f.x + rainSeed[i * 3], z = f.z + rainSeed[i * 3 + 2];
        rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z; rainPos[o + 3] = x - wind * 0.04; rainPos[o + 4] = y + 0.55; rainPos[o + 5] = z - 0.02;
      }
      rainGeo.attributes.position.needsUpdate = true;
    } else rain.visible = false;
    if (flakeK > 0.02) {
      snow.visible = true; snowMat.opacity = 0.9 * flakeK;
      for (let i = 0; i < SNOW_N; i++) {
        let y = snowSeed[i * 3 + 1] - dt * (1.1 + hash(i) * 0.6); if (y < 0) y += 12; snowSeed[i * 3 + 1] = y;
        snowPos[i * 3] = f.x + snowSeed[i * 3] + Math.sin(t * 0.8 + i) * 0.4; snowPos[i * 3 + 1] = y; snowPos[i * 3 + 2] = f.z + snowSeed[i * 3 + 2] + Math.cos(t * 0.6 + i * 1.3) * 0.3;
      }
      snowGeo.attributes.position.needsUpdate = true;
    } else snow.visible = false;
    for (const h of hats) {
      if (lodosK < 0.3) { h.g.visible = false; continue; }
      h.t += dt * h.sp;
      if (h.t > 30) { h.t = 0; h.z = (Math.random() - 0.5) * 16; h.y = 1.2 + Math.random() * 2.2; }
      h.g.visible = true;
      h.g.position.set(f.x - 15 + h.t, h.y + Math.sin(h.t * 1.3) * 0.6, f.z + h.z + Math.sin(h.t * 0.7) * 0.8);
      h.g.rotation.set(h.t * 2.1, h.t * 1.3, h.t * 1.7);
    }
    rainbow.visible = rainbowK > 0.02;
    if (rainbow.visible) { rainbow.position.set(f.x + 8, -12, -105); rbMats.forEach(m => { m.opacity = 0.42 * rainbowK; }); }
  }

  function pierLook(v: HavaView, dt: number): void {
    if (!pierParent) return;
    const r = d.rules();
    // wet / snow
    wet.visible = wetK > 0.02; wetMat.opacity = 0.32 * wetK;
    snowDeck.visible = snowK > 0.02; snowDeckMat.opacity = 0.62 * snowK;
    for (const p of puddles) {
      const on = wetK > 0.35; p.p.visible = p.r.visible = on;
      if (!on) continue;
      puddleMat.opacity = 0.55 * clamp((wetK - 0.35) * 2, 0, 1);
      p.t += dt * 1.4; if (p.t > 1) p.t -= 1;
      const s = 0.4 + p.t * 2.4; p.r.scale.set(s, s, 1); rippleMat.opacity = rainK > 0.2 ? (1 - p.t) * 0.6 * rainK : 0;
    }
    lampCaps.forEach(c => { c.visible = snowK > 0.3; });
    roof.visible = snowK > 0.3; if (roof.visible) placeRoof();
    // tree crowns
    const want = v.season === 'yaz' && !(snowK > 0.3) ? '' : (snowK > 0.3 ? 'kis' : v.season === 'kis' ? 'kis' : v.season);
    if (want !== crownSeason) {
      crownSeason = want; crowns.visible = !!want && !!CROWN[want]; trunks.visible = crowns.visible;
      if (crowns.visible) {
        const pal = CROWN[want];
        crownSpots.forEach(([x, y, z, rr], i) => {
          if (i >= 60) return;
          dummy.position.set(x, y + (want === 'kis' ? 0.12 : 0), z); dummy.rotation.set(0, i, 0);
          dummy.scale.set(rr, want === 'kis' ? rr * 0.75 : rr, rr); dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix); crowns.setColorAt(i, C1.set(pal[i % pal.length]));
        });
        crowns.count = Math.min(60, crownSpots.length); crowns.instanceMatrix.needsUpdate = true; if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
        // trunks: the first spot of each tree is its main crown; the trunk stands under it
        let nT = 0;
        for (let i = 0; i < crownSpots.length && nT < 20; i += 4) {
          const [x, y, z] = crownSpots[i];
          dummy.position.set(x, 0, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, Math.max(0.5, y - 0.4), 1); dummy.updateMatrix(); trunks.setMatrixAt(nT++, dummy.matrix);
        }
        trunks.count = nT; trunks.instanceMatrix.needsUpdate = true; trunks.visible = crowns.visible;
      }
    }
    // table umbrellas
    const L = r?.rt.layout, tbs = r?.rt.tables || [];
    let shown = 0;
    for (let i = 0; i < tUmb.length; i++) {
      const u = tUmb[i], tb = L?.tables[i];
      const flying = !!v.fly && v.fly.color === i;
      const on = !!tb && !!tbs[i]?.built && shown < v.umbrellas && !flying;
      if (tb && tbs[i]?.built && shown < v.umbrellas) shown++;
      u.g.visible = on; if (!on || !tb) continue;
      u.g.position.set(tb.x, 0, tb.z);
      u.can.rotation.z = 0; u.can.rotation.x = 0;
    }
    // flying umbrella
    const fl = v.fly;
    if (fl) {
      flyG.visible = true; flyMat.color.set(UMBRELLA.colors[fl.color % UMBRELLA.colors.length]);
      if (fl.phase === 'fly') {
        const k = clamp(fl.t / 2.4, 0, 1);
        flyG.position.set(fl.x0 + (fl.x - fl.x0) * k, 2.2 + Math.sin(k * Math.PI) * 3.5 - k * 1.6, fl.z0 + (fl.z - fl.z0) * k);
        flyG.rotation.set(k * 7, k * 5, k * 3); ring.visible = false;
      } else {
        flyG.position.set(fl.x, 0.55 + Math.abs(Math.sin(t * 3)) * 0.12, fl.z); flyG.rotation.set(1.1, t * 0.8, 0.3);
        ring.visible = true; ring.position.set(fl.x, 0.04, fl.z); const s = 1 + Math.sin(t * 6) * 0.1; ring.scale.set(s, s, 1);
      }
    } else { flyG.visible = false; ring.visible = false; }
    // seasonal cart: goods colour by food, smoke when hot food
    if (v.food !== cartFood) {
      cartFood = v.food;
      const col = /kestane/i.test(v.food) ? '#7a4a2a' : /börek|pide/i.test(v.food) ? '#e0a957' : /karpuz/i.test(v.food) ? '#e0533c' : /dondurma|güllaç/i.test(v.food) ? '#f7e8d0' : /mısır/i.test(v.food) ? '#f2c94c' : /erik|çağla/i.test(v.food) ? '#8fc45a' : /lüfer/i.test(v.food) ? '#9fb3c2' : '#c98a52';
      goodMat.color.set(col);
    }
    const hot = /kestane|börek|mısır|lüfer|pide/i.test(v.food);
    smokes.forEach(s => { s.visible = hot; if (!hot) return; s.userData.t = (s.userData.t + dt * 0.35) % 1; const k = s.userData.t; s.position.set(Math.sin(k * 6) * 0.08, 0.95 + k * 0.9, 0); s.scale.setScalar(0.8 + k * 2.2); });
    smokeMat.opacity = 0.35;
    // Gece Pazarı
    const night = d.hour() >= MARKET.fromH - 0.5;
    market.visible = v.market.today && night;
    if (market.visible) lanterns.forEach((l, i) => { l.scale.setScalar(1 + Math.sin(t * 3 + i) * 0.08); });
  }

  function labels(v: HavaView): void {
    if (!d.labels) return;
    if (v.fly && v.fly.phase === 'down') {
      if (!flyLabel) flyLabel = d.labels.label();
      showLabel(flyLabel, v.fly.x, 1.6, v.fly.z, '<b>YAKALA!</b>⛱', 'tag');
    } else if (flyLabel) { flyLabel.free(); flyLabel = null; }
    if (market.visible && pierParent) {
      if (!mktLabel) { mktLabel = d.labels.label(); mktLabel.onTap = () => d.command({ kind: 'hava', op: 'open' }); }
      showLabel(mktLabel, -9.3, 2.6, -5.7, '<b>GECE PAZARI</b>' + (v.market.stock ? v.market.stock + ' ürün tezgahta' : 'Tezgah boş'), 'tag');
    } else if (mktLabel) { mktLabel.onTap = null; mktLabel.free(); mktLabel = null; }
  }

  // floats for seasonal extras
  let boundBus: unknown = null, offFloat: (() => void) | null = null, offHorn: (() => void) | null = null;
  function bind(r: Rules): void {
    if (boundBus === r.bus) return;
    offFloat?.(); offHorn?.(); boundBus = r.bus;
    offFloat = r.bus.on('havaFloat' as never, ((e: { text: string; x: number; z: number }) => { if (e && d.float) d.float(e.x, e.z, e.text); }) as never) as () => void;
    offHorn = r.bus.on('havaCatch' as never, (() => { d.sfx?.('coin'); }) as never) as () => void;
  }

  let lastV: HavaView | null = null;
  return {
    relight() { if (lastV) light(lastV); },
    update(dtIn) {
      const dt = Math.min(0.1, Math.max(0, dtIn || 0)); t += dt;
      const r = d.rules(); const api = havaApi(r);
      if (!r || !api || !r.rt.started) { sky.visible = false; pier.visible = false; if (chip) chip.style.opacity = '0'; crowdWeather.lean = 0; return; }
      sky.visible = true; pier.visible = true;
      bind(r);
      attachPier();
      const v = api.view(); lastV = v;
      const k = v.k, kd = v.kind;
      rainK = damp(rainK, (kd === 'saganak' ? 1 : kd === 'firtina' ? 1 : 0) * k, 1.5, dt);
      flakeK = damp(flakeK, (kd === 'kar' ? 1 : 0) * k, 1.2, dt);
      fogK = damp(fogK, (kd === 'sis' ? 1 : 0) * k, 0.8, dt);
      lodosK = damp(lodosK, (kd === 'lodos' ? 1 : kd === 'firtina' ? 0.7 : 0) * k, 1.2, dt);
      heatK = damp(heatK, (kd === 'sicak' ? 1 : 0) * k, 1, dt);
      rainbowK = damp(rainbowK, (kd === 'gokkusagi' ? 1 : 0) * k, 0.8, dt);
      wetK = clamp(wetK + (rainK > 0.2 ? dt * 0.12 * rainK : flakeK > 0.2 ? 0 : -dt * 0.015), 0, 1);
      snowK = clamp(snowK + (flakeK > 0.2 ? dt * 0.05 * flakeK : -dt * 0.01), 0, 1);
      crowdWeather.lean = lodosK * 0.28;
      // sea: faster waves in lodos / storm
      const U = (sea?.material as T.ShaderMaterial | undefined)?.uniforms;
      if (U && U.uTime) { seaOff += dt * lodosK * 1.6; U.uTime.value = (U.uTime.value as number) + seaOff; }
      // fog horn from far away
      if (fogK > 0.5) { hornT -= dt; if (hornT <= 0) { hornT = 22 + Math.random() * 18; d.sfx?.('horn'); } }
      const f = d.focus();
      particles(dt, f);
      pierLook(v, dt);
      crowd(v);
      snowballs(dt);
      labels(v);
      if ((lightT -= dt) <= 0) { lightT = 0.25; light(v); }
      lightning(dt, kd, k);
      if (chip) {
        const key = v.icon + v.name + v.dateText + (v.market.open ? 'm' : '');
        if (key !== chipKey) {
          chipKey = key;
          const sub = v.market.open ? 'Gece Pazarı açık' : v.dateText;
          chip.innerHTML = `<div style="font-size:16px">${v.icon} ${v.kind === 'acik' ? v.dateText.split(' ').slice(0, 2).join(' ') : v.name}</div><div style="font-size:12.5px;opacity:.8">${sub.replace(/[<>&]/g, '')}</div>`;
        }
        chip.style.opacity = r.rt.panel ? '0' : '1';
      }
    },
    dispose() {
      offFloat?.(); offHorn?.();
      flyLabel?.free(); mktLabel?.free();
      chip?.remove();
      sky.parent?.remove(sky); pier.parent?.remove(pier);
      geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose());
      crowdWeather.lean = 0;
    },
  };
}
