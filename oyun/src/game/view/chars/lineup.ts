/**
 * Character lineup page logic (tests/browser/chars.html). Owner: Builder C.
 * Port of v2 test/chars.html (same views, layout, camera fit, labels) so the lineup shot compares 1:1 with v2
 * (CONTRACT M0 acceptance 6: SSIM >= 0.7). Extra motor views (hidden buttons, reachable by hash):
 *   faces  - the 12 expressions + brow springs on a hero (HeroHandle API)
 *   soa    - the instanced crowd driven by an agents SoA (CrowdView API) + ambient walkers
 *   fx     - effect blocks (steam, sesame, feathers, foam, ...)
 *   carry  - carried stack wobble while walking/stopping
 * Hooks: window.__chars = { ready, setView, step(n, dt), info(), cam } like v2.
 */
import * as T from 'three';
import { CH } from './v2/chars-v2';
import * as C from './v2/kit';
import { createChars } from './index';
import { createAnim } from '../../../engine/anim';
import { createFx, type MotorFx } from '../../../engine/fx';
import { EFFECTS } from '../../../content/effects';
import { EXPR_ORDER, AGENT_SCHEMA, AGENT_FLAG, GAIT_ORDER, ACT_ORDER } from '../../sim/schema';
import type { Quality, TierDef, SoAStore, ExprId, BrowId, Chars, Fx, HeroHandle } from '../../../engine/api';
import { createSoA as makeSoA } from '../../../engine/ecs';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new T.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
C.setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());
const scene = new T.Scene();
scene.background = new T.Color('#9fd3f5');
scene.fog = new T.Fog('#9fd3f5', 40, 110);
const camera = new T.PerspectiveCamera(42, 1, 0.1, 250);
const hemi = new T.HemisphereLight('#d9eeff', '#8a6a4f', 1.7); scene.add(hemi);
const sun = new T.DirectionalLight('#fff1d6', 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
sun.position.set(8, 18, 10); scene.add(sun, sun.target);
const deckTex = C.canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#c9a27a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#c29a72' : '#cfa982'; g.fillRect(0, i * 32, w, 30); g.fillStyle = 'rgba(90,60,40,.25)'; g.fillRect(0, i * 32 + 30, w, 2); } }, [12, 12]);
const deck = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshLambertMaterial({ map: deckTex })); deck.rotation.x = -Math.PI / 2; deck.receiveShadow = true; scene.add(deck);
const sea = new T.Mesh(new T.PlaneGeometry(400, 200), new T.MeshLambertMaterial({ color: '#5aa9d6' })); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.6, -140); scene.add(sea);

interface Lab { el: HTMLDivElement; obj: T.Object3D | T.Vector3; dy: number }
const labels: Lab[] = [];
function label(obj: T.Object3D | T.Vector3, text: string, dy?: number): HTMLDivElement { const el = document.createElement('div'); el.className = 'lab'; el.textContent = text; document.body.appendChild(el); labels.push({ el, obj, dy: dy == null ? -0.12 : dy }); return el; }
function clearLabels() { labels.forEach(l => l.el.remove()); labels.length = 0; }
const v3 = new T.Vector3();
function placeLabels() {
  const w = innerWidth, h = innerHeight;
  labels.forEach(l => { ((l.obj as T.Vector3).isVector3 ? v3.copy(l.obj as T.Vector3) : (l.obj as T.Object3D).getWorldPosition(v3)); v3.y += l.dy; v3.project(camera); l.el.style.left = ((v3.x + 1) / 2 * w) + 'px'; l.el.style.top = ((1 - v3.y) / 2 * h) + 'px'; l.el.style.display = v3.z < 1 ? '' : 'none'; });
}

let root = new T.Group(); scene.add(root);
let updaters: ((dt: number) => void)[] = [];
interface CamCfg { pos?: number[]; look?: number[]; dir?: number[]; box?: T.Box3; fov: number }
let camCfg: CamCfg = { pos: [0, 12, 14], look: [0, 0.8, 0], fov: 42 };
const R = C.rng(2026);
const acts = ['idle', 'cut', 'pour', 'wipe', 'sleep', 'selfie', 'talk', 'pet', 'wave', 'count', 'chase', 'sit', 'cheer'];
const ACT_TR: Record<string, string> = { phone: 'telefonda', idle: 'bekliyor', cut: 'döner kesiyor', pour: 'çay dolduruyor', wipe: 'siliyor', sleep: 'uyuyor', selfie: 'selfie', talk: 'konuşuyor', pet: 'kedi seviyor', wave: 'el sallıyor', count: 'para sayıyor', chase: 'kovalıyor', sit: 'oturuyor', cheer: 'seviniyor', carry: 'taşıyor' };
const TYPE_TR: Record<string, string> = { teyze: 'Teyze', emekli: 'Emekli amca', universiteli: 'Üniversiteli', okul: 'Okul çocuğu', plaza: 'Plazacı', taraftar: 'Taraftar', taksici: 'Taksici', gecekusu: 'Gece kuşu', simitci: 'Simitçi', hamal: 'Hamal', oltaci: 'Oltacı', kurye: 'Kurye', muzisyen: 'Müzisyen', boyaci: 'Boyacı', midyeci: 'Midyeci', kestaneci: 'Kestaneci', kruvaziyer: 'Kruvaziyer', gezgin: 'Gezgin', vlogcu: 'Vlogcu', balayi: 'Balayı', turgrubu: 'Tur grubu', isinsani: 'İş insanı', vapuryolcusu: 'Vapur yolcusu', bebekarabali: 'Bebek arabalı' };
const EXPR_TR: Record<ExprId, string> = { neutral: 'sakin', smile: 'gülümsüyor', grin: 'sırıtıyor', laugh: 'gülüyor', surprised: 'şaşkın', sleepy: 'uykulu', pout: 'surat asık', grumpy: 'huysuz', love: 'aşık', wink: 'göz kırpıyor', thinking: 'düşünüyor', bliss: 'keyifli' };

function heroBox(color: string) { const g = new T.Group(); const b = C.mesh(C.roundBox(0.24, 0.12, 0.18, 0.03, 2), color); g.add(b); return g; }
let portrait = innerWidth < innerHeight * 0.9, curView = 'heroes';
const gridPos = (i: number, cols: number, dx: number, dz: number) => ({ x: (i % cols - (cols - 1) / 2) * dx, z: Math.floor(i / cols) * dz });
const boxOf = (pts: { x: number; z: number }[], y1: number, pad: number) => { const b = new T.Box3(); pts.forEach(p => b.expandByPoint(new T.Vector3(p.x, 0, p.z))); b.min.x -= pad; b.max.x += pad; b.min.z -= pad; b.max.z += pad; b.max.y = y1; return b; };

// motor-side services for the extra views (quality stub: lineup always shows the top tier)
const TIER: TierDef = { name: 'sahane', label: 'Şahane', crowd: 90, gullsNear: 16, gullsFar: 40, pigeons: 30, pixelRatio: 2, antialias: true, shadows: true, shadowSize: 2048, fps: 60, particles: 1000, buildBudgetMs: 6, maxLiveZones: 4, heroes: 16, flags: {} };
const quality = { current: () => TIER, setting: () => 'sahane', set() {}, onChange: () => () => {}, feed() {}, batterySaver() {}, table: { akici: TIER, dengeli: TIER, sahane: TIER } } as unknown as Quality;
const anim = createAnim();
let fx: MotorFx | null = null;
let chars: Chars | null = null;
function motor() {
  if (!fx) { fx = createFx({ scene, quality }); for (const id in EFFECTS) fx.define(EFFECTS[id]); }
  if (!chars) chars = createChars({ scene, anim, dress: null as never, quality, fx });
  return { fx, chars };
}

const VIEWS: Record<string, () => void> = {
  heroes() {
    const list: { o: Record<string, unknown>; act: string; name: string }[] = [
      { o: { kind: 'sabri' }, act: 'cut', name: 'Sabri' },
      { o: { kind: 'sabriye' }, act: 'pour', name: 'Sabriye' },
      { o: { kind: 'sabriye', look: { headscarf: 'turban', scarfColor: '#3fb5b0' } }, act: 'wave', name: 'Sabriye (türban)' },
      { o: { kind: 'worker', role: 'doner', preset: 'riza' }, act: 'sleep', name: 'Rıza, dönerci' },
      { o: { kind: 'worker', role: 'cay', preset: 'tayfun' }, act: 'selfie', name: 'Tayfun, çaycı' },
      { o: { kind: 'worker', role: 'garson', preset: 'nazli' }, act: 'carry', name: 'Nazlı, garson' },
      { o: { kind: 'worker', role: 'tost', seed: 4 }, act: 'wipe', name: 'Tostçu' },
      { o: { kind: 'worker', role: 'temizlik', seed: 9 }, act: 'wipe', name: 'Temizlikçi' },
      { o: { kind: 'worker', role: 'kurye', seed: 12 }, act: 'cheer', name: 'Kurye' },
      { o: { kind: 'regular', preset: 'necati' }, act: 'talk', name: 'Necati Amca' },
      { o: { kind: 'regular', preset: 'nermin' }, act: 'pet', name: 'Nermin Teyze' },
      { o: { kind: 'vip', preset: 'bulent' }, act: 'count', name: 'Gurme Bülent Bey' },
    ];
    const cols = portrait ? 3 : 6, pts: { x: number; z: number }[] = [];
    list.forEach((it, i) => {
      const g = gridPos(i, cols, 1.25, portrait ? 2.3 : 2.0), x = g.x, z = g.z; pts.push(g);
      const h = CH.makeHero(it.o);
      h.group.position.set(x, 0, z); root.add(h.group);
      const st = { act: it.act === 'carry' ? 'idle' : it.act, carry: it.act === 'carry', speed: 0, mood: it.act === 'cheer' || it.act === 'count' ? 'happy' : 'ok' };
      if (it.act === 'carry') { for (let k = 0; k < 3; k++) { const b = heroBox(['#f1dcae', '#a3301a', '#fbfdff'][k]); b.position.y = 0.06 + k * 0.13; h.hand.add(b); } }
      if (it.act === 'pet') { const cat = CH.makeCat({ name: 'Pamuk', coat: 'white' }); cat.group.position.set(x + 0.05, 0, z + 0.42); cat.group.rotation.y = -Math.PI / 2; root.add(cat.group); updaters.push(dt => cat.update(dt, { act: 'purr' })); }
      updaters.push(dt => h.update(dt, st));
      label(new T.Vector3(x, 0, z + 0.42), it.name + '\n' + ACT_TR[it.act], 0);
    });
    camCfg = { dir: [0, portrait ? 1 : 0.7, 1], box: boxOf(pts, 1.9, 0.6), fov: 36 };
  },
  acts() {
    const h = CH.makeHero({ kind: 'sabri' }); root.add(h.group);
    const h2 = CH.makeHero({ kind: 'sabriye' }); h2.group.position.x = 1.3; root.add(h2.group);
    const st: Record<string, unknown> = { act: 'idle', speed: 0 }, st2: Record<string, unknown> = { act: 'idle', speed: 0 };
    let t = 0, i = 0; const el = label(new T.Vector3(0.65, 0, 0.5), '', 0);
    const cat = CH.makeCat({ coat: 'white' }); cat.group.position.set(0.1, 0, 0.45); cat.group.rotation.y = -1.6; root.add(cat.group);
    updaters.push(dt => { t += dt; if (t > 2.2) { t = 0; i = (i + 1) % (acts.length + 2); } const a = acts[i] || 'idle'; st.act = a; st2.act = a; st.speed = i === acts.length ? 0.8 : (a === 'chase' ? 1 : 0); st2.speed = st.speed; st.carry = st2.carry = i === acts.length + 1; el.textContent = i === acts.length ? 'yürüyor' : i === acts.length + 1 ? 'taşıyor' : ACT_TR[a]; h.update(dt, st); h2.update(dt, st2); cat.update(dt, { act: 'sit' }); });
    camCfg = { dir: [0, 0.32, 1], box: new T.Box3(new T.Vector3(-0.45, 0, -0.3), new T.Vector3(1.75, 1.95, 0.7)), fov: 34 };
  },
  citizens() {
    const crowd = CH.makeCrowd(root, 60);
    const types: string[] = CH.TYPE_IDS, cols = portrait ? 4 : 10, pts: { x: number; z: number }[] = [];
    const extra: [string, Record<string, unknown>][] = [['plaza', { mobility: 'wheelchair' }], ['universiteli', { mobility: 'whitecane' }], ['gezgin', { mobility: 'cane', back: 'bigpack' }], ['plaza', { headscarf: 'turban', scarfColor: '#2e4a6b' }], ['universiteli', { headscarf: 'sport', scarfColor: '#3fb5b0' }], ['teyze', { headscarf: 'yazma', scarfColor: '#f2b632' }]];
    const all: [string, any][] = types.map((ty, i) => [ty, CH.randomLook(ty, C.rng(100 + i * 31))] as [string, any]).concat(extra.map((e, i) => { const L = Object.assign(CH.randomLook(e[0], C.rng(900 + i)), e[1]); if (e[1].headscarf) { L.fem = true; L.hat = null; L.bottomStyle = 'skirt'; } return [e[0], L] as [string, any]; }));
    all.forEach(([ty, L], i) => {
      const g = gridPos(i, cols, 1.15, portrait ? 1.95 : 2.0); pts.push(g);
      const id = crowd.add(L);
      crowd.set(id, { x: g.x, z: g.z, rot: 0, speed: 0, act: ty === 'vlogcu' ? 'selfie' : ty === 'taraftar' ? 'cheer' : ty === 'plaza' && i < 24 ? 'phone' : 'idle', mood: i % 3 === 0 ? 'happy' : 'ok' });
      label(new T.Vector3(g.x, 0, g.z + 0.42), TYPE_TR[ty], 0);
    });
    updaters.push(dt => crowd.update(dt));
    (window as any).__crowd = crowd;
    camCfg = { dir: [0, portrait ? 1 : 0.75, 1], box: boxOf(pts, 1.9, 0.5), fov: 36 };
  },
  crowd() {
    const crowd = CH.makeCrowd(root, 90);
    const types: string[] = CH.TYPE_IDS; const people: any[] = [];
    const W = portrait ? 4 : 11, lanes = portrait ? 7 : 3, gap = portrait ? 1.9 : 2.6;
    for (let i = 0; i < 90; i++) {
      const ty = types[i % types.length], L = CH.randomLook(ty, C.rng(500 + i * 7)), id = crowd.add(L);
      const lane = i % lanes, dir = (i % 2) ? 1 : -1;
      people.push({ id, x: R.range(-W, W), z: -((lanes - 1) * gap) / 2 + lane * gap + R.range(-0.5, 0.5), dir, sp: R.range(0.7, 1.3) * (L.gait === 'slow' || L.gait === 'wheel' ? 0.6 : L.gait === 'fast' ? 1.25 : 1), stop: R.range(0, 6), sitting: i % 11 === 0, act: i % 13 === 0 ? 'talk' : i % 17 === 0 ? 'eat' : 'idle', carry: i % 19 === 0 });
    }
    updaters.push(dt => {
      people.forEach(p => {
        p.stop -= dt; const moving = !p.sitting && p.stop < 0;
        if (p.stop < -8) p.stop = R.range(1, 4);
        if (moving) { p.x += p.dir * p.sp * dt * 1.1; if (p.x > W) p.x = -W; if (p.x < -W) p.x = W; }
        crowd.set(p.id, { x: p.x, z: p.z, rot: p.dir > 0 ? Math.PI / 2 : -Math.PI / 2, speed: moving ? Math.min(1, p.sp * 0.75) : 0, sit: p.sitting, act: moving ? 'idle' : p.act, carry: p.carry, mood: p.sitting ? 'happy' : 'ok' });
      });
      crowd.update(dt);
    });
    (window as any).__crowd = crowd;
    const hz = (lanes - 1) * gap / 2 + 0.8;
    camCfg = { dir: portrait ? [0, 1.1, 1] : [0.55, 0.95, 1], box: new T.Box3(new T.Vector3(-W, 0, -hz), new T.Vector3(W, 1.8, hz)), fov: 40 };
  },
  animals() {
    const coats = ['white', 'tabby', 'black', 'ginger', 'calico', 'grey'], cacts = ['curl', 'sleep', 'sit', 'walk', 'rub', 'meow'];
    const cc = portrait ? 3 : 6, pts: { x: number; z: number }[] = [];
    coats.forEach((c, i) => { const g = gridPos(i, cc, 0.95, 1.1); g.z += 1.4; pts.push(g); const cat = CH.makeCat({ name: c, coat: c }); cat.group.position.set(g.x, 0, g.z); cat.group.rotation.y = i === 4 ? -0.6 : 0.4; root.add(cat.group); updaters.push(dt => cat.update(dt, { act: cacts[i], speed: cacts[i] === 'walk' ? 0.5 : 0 })); label(new T.Vector3(g.x, 0, g.z + 0.3), 'kedi\n' + ACT_AN[cacts[i]], 0); });
    const dp = portrait ? { x: 0, z: 1.4 + 2 * 1.1 + 0.1 } : { x: 3.3, z: 1.5 }; pts.push(dp);
    const dog = CH.makeDog({ name: 'Karamel' }); dog.group.position.set(dp.x, 0, dp.z); dog.group.rotation.y = -0.6; root.add(dog.group);
    let dt0 = 0; updaters.push(dt => { dt0 += dt; dog.update(dt, { act: ['wag', 'sit', 'bark', 'sleep'][Math.floor(dt0 / 3) % 4] }); }); label(new T.Vector3(dp.x, 0, dp.z + 0.45), 'Karamel', 0);
    const gm = [['adult', 'stand'], ['adult', 'stare'], ['adult', 'scream'], ['young', 'walk'], ['reis', 'stand'], ['gold', 'stand'], ['adult', 'snatch'], ['young', 'stand']];
    const gc = portrait ? 4 : 8;
    gm.forEach((g, i) => { const p = gridPos(i, gc, 0.85, 1.05); p.z -= portrait ? 1.15 : 0.2; pts.push(p); const gu = CH.makeGull({ kind: g[0] }); gu.group.position.set(p.x, 0, p.z); gu.group.rotation.y = 0.5; root.add(gu.group); updaters.push(dt => gu.update(dt, { mode: g[1], speed: 0.5 })); label(new T.Vector3(p.x, 0, p.z + 0.3), GULL_TR[g[0]] + '\n' + GULL_TR[g[1]], 0); });
    const fm = [['adult', 'fly'], ['adult', 'glide'], ['adult', 'land'], ['young', 'takeoff']];
    fm.forEach((g, i) => { const x = (i - 1.5) * (portrait ? 0.95 : 1.6), z = portrait ? -2.2 : -1.6; const gu = CH.makeGull({ kind: g[0] }); gu.group.position.set(x, 1.6 + (i % 2) * 0.35, z); gu.group.rotation.y = 0.35 + i * 0.3; root.add(gu.group); updaters.push(dt => gu.update(dt, { mode: g[1], speed: 0.6 })); label(gu.group, GULL_TR[g[1]], -0.3); });
    const pz = portrait ? 1.4 + 2 * 1.1 + 1.1 : 2.9;
    const pig = CH.makePigeons(root, 16, { x0: -1.5, x1: 1.5, z0: pz - 0.4, z1: pz + 0.4 }); pts.push({ x: -1.6, z: pz + 0.5 }, { x: 1.6, z: pz + 0.5 });
    let pt = 0; updaters.push(dt => { pt += dt; if (Math.abs(pt - 2.5) < dt / 2 + 0.001) pig.scatter(0, pz); pig.update(dt); });
    const flock = CH.makeFlock(root, 24, new T.Vector3(0, 9, -26), 12); let ft = 0; updaters.push(dt => { ft += dt; flock.update(dt, ft); });
    pts.push({ x: 0, z: portrait ? -2.6 : -2.0 });
    camCfg = { dir: [0, portrait ? 1 : 0.7, 1], box: boxOf(pts, 1.4, 0.3), fov: 40 };
  },
  gulls() {
    const gm = [['adult', 'stand'], ['adult', 'stare'], ['adult', 'scream'], ['young', 'stand'], ['reis', 'stand'], ['gold', 'stand']];
    const cols = portrait ? 2 : 3, pts: { x: number; z: number }[] = [];
    gm.forEach((g, i) => { const p = gridPos(i, cols, 0.8, 0.9); pts.push(p); const gu = CH.makeGull({ kind: g[0] }); gu.group.position.set(p.x, 0, p.z); gu.group.rotation.y = 0.6; root.add(gu.group); updaters.push(dt => gu.update(dt, { mode: g[1] })); label(new T.Vector3(p.x, 0, p.z + 0.28), GULL_TR[g[0]] + '\n' + GULL_TR[g[1]], 0); });
    const gu = CH.makeGull({ kind: 'adult' }); gu.group.position.set(0, 1.45, -0.7); gu.group.rotation.y = 0.3; root.add(gu.group);
    let tt = 0; updaters.push(dt => { tt += dt; gu.update(dt, { mode: Math.floor(tt / 2.5) % 2 ? 'glide' : 'fly' }); });
    const b = boxOf(pts, 0.7, 0.35); b.min.z = Math.min(b.min.z, -1.2); b.max.y = 1.9;
    camCfg = { dir: [0, 0.45, 1], box: b, fov: 36 };
  },
  // ---- motor views ----
  faces() {
    const { chars: ch } = motor();
    const cols = portrait ? 3 : 6, pts: { x: number; z: number }[] = [];
    const brows: (BrowId | undefined)[] = [undefined, undefined, undefined, undefined, 'up', undefined, 'worried', 'down', undefined, 'oneUp', 'down', undefined];
    EXPR_ORDER.forEach((e, i) => {
      const g = gridPos(i, cols, 1.0, portrait ? 1.6 : 1.5); pts.push(g);
      const h = ch.makeHero({ kind: i % 2 ? 'sabriye' : 'sabri', seed: i } as never);
      h.setPose({ x: g.x, z: g.z }, 0); root.add(h.object);
      h.setExpr(e, brows[i]); h.setInput({ act: 'idle', speed: 0, mood: 'ok' });
      updaters.push(dt => h.update(dt, 1));
      label(new T.Vector3(g.x, 0, g.z + 0.42), e + '\n' + EXPR_TR[e], 0);
    });
    camCfg = { dir: [0, 0.75, 1], box: boxOf(pts, 1.85, 0.4), fov: 30 };
  },
  soa() {
    const { chars: ch } = motor();
    const agents: SoAStore = makeSoA('agents', 256, AGENT_SCHEMA);
    const N = 50, f32 = (k: string) => agents.f32(k), u8 = (k: string) => agents.u8(k);
    const ws: { i: number; dir: number; sp: number }[] = [];
    for (let k = 0; k < N; k++) {
      const i = agents.alloc(); const lane = k % 5, dir = k % 2 ? 1 : -1;
      f32('x')[i] = R.range(-4, 4); f32('z')[i] = -3 + lane * 1.5; f32('rot')[i] = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      u8('typeId')[i] = k % 24; u8('gait')[i] = GAIT_ORDER.indexOf('normal'); u8('act')[i] = ACT_ORDER.indexOf('walk');
      u8('expr')[i] = k % 12; agents.u16('flags')[i] = AGENT_FLAG.visible | AGENT_FLAG.ambient;
      ws.push({ i, dir, sp: R.range(0.8, 1.4) });
    }
    ch.crowd.setBudget(N);
    if (!ch.crowd.object.parent) scene.add(ch.crowd.object);
    updaters.push(dt => {
      for (const w of ws) { const x = f32('x'), px = f32('px'); px[w.i] = x[w.i]; f32('pz')[w.i] = f32('z')[w.i]; f32('prot')[w.i] = f32('rot')[w.i]; x[w.i] += w.dir * w.sp * dt; if (x[w.i] > 4) x[w.i] = px[w.i] = -4; if (x[w.i] < -4) x[w.i] = px[w.i] = 4; f32('speed')[w.i] = w.sp; }
      ch.crowd.update(agents, dt, 1);
    });
    updaters.push(() => {}); onLeave = () => { ch.crowd.setBudget(0); ch.crowd.update(agents, 0, 1); scene.remove(ch.crowd.object); };
    camCfg = { dir: [0, 1, 1], box: new T.Box3(new T.Vector3(-4, 0, -3.5), new T.Vector3(4, 1.8, 3.5)), fov: 40 };
  },
  fx() {
    const { fx: f } = motor();
    const ids = Object.keys(EFFECTS), cols = portrait ? 3 : 6, pts: { x: number; z: number }[] = [];
    const leaves: (() => void)[] = [];
    ids.forEach((id, i) => {
      const g = gridPos(i, cols, 1.2, 1.4); pts.push(g);
      const at = new T.Vector3(g.x, 0.6, g.z); let t = 9; let h: { stop(): void } | null = null;
      updaters.push(dt => { t += dt; if (t > 1.6) { t = 0; if (h) h.stop(); h = f.play(id, at); } });
      leaves.push(() => { if (h) h.stop(); });
      label(new T.Vector3(g.x, 0, g.z + 0.3), id, 0);
    });
    updaters.push(dt => f.update(dt));
    onLeave = () => { for (const l of leaves) l(); f.clear(); };
    camCfg = { dir: [0, 0.8, 1], box: boxOf(pts, 1.6, 0.6), fov: 38 };
  },
  carry() {
    const { chars: ch } = motor();
    const h: HeroHandle = ch.makeHero({ kind: 'sabri' } as never); root.add(h.object);
    h.setCarry(['doner', 'cay', 'ayran', 'simit', 'tost', 'gazoz']);
    let t = 0, x = -2;
    updaters.push(dt => { t += dt; const moving = (t % 3) < 1.6; if (moving) x += dt * 2.2; if (x > 2) x = -2; h.setPose({ x, z: 0 }, Math.PI / 2); h.setInput({ speed: moving ? 3 : 0, act: 'idle', mood: 'happy' }); h.update(dt, 1); });
    camCfg = { dir: [0, 0.4, 1], box: new T.Box3(new T.Vector3(-2.5, 0, -0.6), new T.Vector3(2.5, 2.2, 0.6)), fov: 34 };
  },
};
let onLeave: (() => void) | null = null;
const ACT_AN: Record<string, string> = { curl: 'kıvrılmış', sleep: 'uyuyor', sit: 'oturuyor', walk: 'yürüyor', rub: 'sürtünüyor', meow: 'miyavlıyor' };
const GULL_TR: Record<string, string> = { adult: 'martı', young: 'yavru', reis: 'Reis', gold: 'altın', stand: 'duruyor', stare: 'bakıyor', scream: 'bağırıyor', walk: 'yürüyor', snatch: 'kapıyor', fly: 'uçuyor', glide: 'süzülüyor', land: 'konuyor', takeoff: 'havalanıyor' };
const bar = document.getElementById('bar') as HTMLDivElement;
const NAMES: Record<string, string> = { heroes: 'Kahramanlar', acts: 'Hareketler', citizens: '24 tip', crowd: 'Kalabalık 90', animals: 'Hayvanlar', gulls: 'Martılar', faces: 'Yüzler', soa: 'SoA', fx: 'Efekt', carry: 'Taşıma' };
const EXTRA = new Set(['faces', 'soa', 'fx', 'carry']);
Object.keys(NAMES).forEach(k => { const b = document.createElement('button'); b.textContent = NAMES[k]; b.dataset.v = k; if (EXTRA.has(k)) b.className = 'x'; b.onclick = () => setView(k); bar.appendChild(b); });
function setView(name: string) {
  if (onLeave) { onLeave(); onLeave = null; }
  scene.remove(root);
  root = new T.Group(); scene.add(root); updaters = []; clearLabels();
  C.reseedView(20261017);
  portrait = innerWidth < innerHeight * 0.9; curView = VIEWS[name] ? name : 'heroes';
  VIEWS[curView]();
  [...bar.children].forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.v === curView));
  location.hash = curView; resize();
}
const corners = (b: T.Box3) => { const r: T.Vector3[] = []; for (let i = 0; i < 8; i++) r.push(new T.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z)); return r; };
function fitCamera() {
  const b = camCfg.box as T.Box3, ctr = b.getCenter(new T.Vector3()), dir = new T.Vector3(...(camCfg.dir as [number, number, number])).normalize(), pts = corners(b), tmp = new T.Vector3();
  const top = (innerHeight - (bar.offsetHeight + 16)) / innerHeight * 2 - 1, bot = -0.92;
  const ext = (d: number) => { camera.position.copy(ctr).addScaledVector(dir, d); camera.lookAt(ctr); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); const e = [9, -9, 9, -9]; pts.forEach(p => { tmp.copy(p).project(camera); e[0] = Math.min(e[0], tmp.x); e[1] = Math.max(e[1], tmp.x); e[2] = Math.min(e[2], tmp.y); e[3] = Math.max(e[3], tmp.y); }); return e; };
  let lo = 0.5, hi = 200;
  for (let it = 0; it < 30; it++) { const d = (lo + hi) / 2, e = ext(d); if (e[1] - e[0] < 1.86 && e[3] - e[2] < top - bot) hi = d; else lo = d; }
  const e = ext(hi), hf = Math.tan(camera.fov * Math.PI / 360) * hi;
  const dx = (e[0] + e[1]) / 2, dy = (e[2] + e[3]) / 2 - (top + bot) / 2;
  const off = new T.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(dx * hf * camera.aspect).add(new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(dy * hf));
  camera.position.add(off); camera.lookAt(ctr.clone().add(off)); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
}
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = camCfg.fov;
  if ((innerWidth < innerHeight * 0.9) !== portrait) { setView(curView); return; }
  if (camCfg.box) fitCamera();
  else {
    const look = new T.Vector3(...(camCfg.look as [number, number, number]));
    camera.position.copy(look).add(new T.Vector3(...(camCfg.pos as [number, number, number])).sub(look)); camera.lookAt(look); camera.updateProjectionMatrix();
  }
}
addEventListener('resize', resize);
let last = performance.now(), frames = 0, fpsT = 0, fps = 0, paused = false;
const info = document.getElementById('info') as HTMLDivElement;
function tick(dt: number) { updaters.forEach(u => u(dt)); anim.update(dt); if (chars) chars.update(dt, 1); }
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!paused) tick(dt);
  renderer.render(scene, camera); placeLabels();
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  const ri = renderer.info.render; info.textContent = `çizim ${ri.calls} · üçgen ${(ri.triangles / 1000).toFixed(1)}k · ${fps} fps`;
  requestAnimationFrame(frame);
}
(window as any).__chars = {
  renderer, scene, camera, setView,
  /** Freeze the rAF updates (shots): only step() advances animation. */
  pause(on: boolean) { paused = on; },
  step(n: number, dt?: number) { for (let i = 0; i < n; i++) tick(dt || 1 / 30); renderer.render(scene, camera); placeLabels(); return Object.assign({}, renderer.info.render); },
  info: () => Object.assign({}, renderer.info.render, { fxLive: fx ? fx.live() : 0, crowd: chars ? chars.crowd.visible() : 0 }),
  get cam() { return camCfg; }, ready: true,
};
setView((location.hash || '#heroes').slice(1));
requestAnimationFrame(frame);
