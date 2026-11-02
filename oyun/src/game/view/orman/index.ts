/**
 * Otobüs + Belgrad Ormanı view (16:52 user). Never writes sim state.
 * - 42B bus stop across the büfe and its twin at Orman Durağı (Martı Atölyesi models), the bus itself driving in,
 *   opening its doors and pulling away, from rt.disari bus (sim/disari.ts).
 * - Forest life near x 800..880: mangal families (griller, eaters on blankets), people filling bidons at the
 *   fountain with a running water stream, joggers on the trail, smoke over every mangal, the day's mushrooms
 *   (rt.mantar from sim/mantar.ts) and a painted "BELGRAD ORMANI" sign.
 */
import * as T from 'three';
import type { Rules } from '../../sim/state';
import { disariApi } from '../../sim/disari';
import type { MantarItem } from '../../sim/mantar';
import { OTOBUS, MANTARLAR, REGION_BY_ID } from '../../../content/disari/martikoy';
import { REALM_BY_ID } from '../../../content/realm';
import { createKit, buildBus, buildBusStop, buildMushroom } from '../atolye';

interface HeroLike { object: T.Object3D; setPose(p: { x: number; z: number }, r: number): void; setInput(i: Record<string, unknown>): void; update(dt: number, a: number): void; dispose(): void }
export interface OrmanViewDeps { scene: T.Scene; rules: () => Rules | null; hero: () => { x: number; z: number }; chars: { makeHero(o: never): unknown } | null; hour: () => number;
  /** 17:24 user: the bus was a ghost. Its body is a nav solid while it is on screen. */
  setSolid?: (rects: { x0: number; x1: number; z0: number; z1: number }[]) => void }
export interface OrmanView { update(dt: number): void; dispose(): void }

const MANGALS: [number, number][] = [[826, 2.4], [856, 2.0], [868, 17.6], [838, -3.2], [872, 5.4], [846, 21.5]];
const CESME = { x: 838, z: 16.5 };
const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

export function createOrmanView(d: OrmanViewDeps): OrmanView {
  const kit = createKit();
  const root = new T.Group(); root.name = 'orman-otobus'; d.scene.add(root);
  // stops: shelter behind the waiting spot, facing the road (-z)
  const stopA = buildBusStop(kit); stopA.position.set(OTOBUS.stop.x, 0, OTOBUS.stop.z + 1.5); stopA.rotation.y = Math.PI; root.add(stopA);
  const os = REGION_BY_ID.orman.stop;
  const stopB = buildBusStop(kit, OTOBUS.line, 'Martıköy İskele'); stopB.position.set(os.x, 0, os.z + 1.6); stopB.rotation.y = Math.PI; root.add(stopB);
  // J1: the stadium realm's stop (third spawn)
  const ss = REALM_BY_ID.stadyum.stop;
  const stopC = buildBusStop(kit, OTOBUS.line, 'Stadyum · İskele · Orman'); stopC.position.set(ss.x, 0, ss.z + 1.6); stopC.rotation.y = Math.PI; root.add(stopC);
  const bus = buildBus(kit); bus.object.visible = false; root.add(bus.object);
  let busX = 0, busKey = '', busT0 = 0, busP0 = 0, solidT = 0, solidOn = false;
  // forest sign text
  const signTex = kit.paint(512, 128, (g, w, h) => { g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, w, h); g.fillStyle = '#3f5a2a'; g.font = '900 62px Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BELGRAD ORMANI', w / 2, 58, w - 40); g.font = '700 26px system-ui'; g.fillText('Mangal alanı · Çeşme · Mantar yolu', w / 2, 104, w - 40); });
  for (const s of [1, -1]) { const m = new T.Mesh(new T.PlaneGeometry(2.25, 0.56), kit.mat('#ffffff', { map: signTex })); m.position.set(812, 1.9, 13.6 + s * 0.06); if (s < 0) m.rotation.y = Math.PI; root.add(m); }

  // ground cover: instanced grass tufts, ferns and wild flowers over the whole forest floor (cheap: 3 draw calls)
  {
    const R = (i: number) => { const x = Math.sin(i * 91.7 + 3.1) * 43758.5453; return x - Math.floor(x); };
    const mk = (geo: T.BufferGeometry, mat: T.Material, n: number, place: (i: number, m: T.Object3D) => void) => {
      const im = new T.InstancedMesh(geo, mat, n), o = new T.Object3D();
      for (let i = 0; i < n; i++) { place(i, o); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
      im.receiveShadow = true; root.add(im); return im;
    };
    const offTrail = (i: number) => { let z = -8 + R(i * 2 + 1) * 34; if (z > 6.8 && z < 11.2) z += z < 9 ? -4.6 : 4.6; return z; };
    const tuft = new T.ConeGeometry(0.12, 0.42, 4); tuft.translate(0, 0.21, 0);
    mk(tuft, kit.mat('#5d9a45'), 900, (i, o) => { o.position.set(801 + R(i) * 78, 0, offTrail(i)); o.rotation.set((R(i + 7) - 0.5) * 0.4, R(i + 3) * 6, 0); o.scale.setScalar(0.7 + R(i + 5) * 0.9); });
    const fern = new T.SphereGeometry(0.35, 6, 4); fern.scale(1, 0.45, 1); fern.translate(0, 0.12, 0);
    mk(fern, kit.mat('#4a8a3a'), 160, (i, o) => { o.position.set(801 + R(i + 500) * 78, 0, offTrail(i + 500)); o.rotation.set(0, R(i) * 6, 0); o.scale.setScalar(0.8 + R(i + 9) * 1.2); });
    const fl = new T.IcosahedronGeometry(0.07, 0); fl.translate(0, 0.25, 0);
    const flowers = mk(fl, kit.mat('#ffffff'), 240, (i, o) => { o.position.set(801 + R(i + 900) * 78, 0, offTrail(i + 900)); o.scale.setScalar(1 + R(i) * 0.6); });
    const cols = ['#f2c230', '#ffffff', '#e85a9a', '#9b7fe0', '#e0533c'].map(c => new T.Color(c));
    for (let i = 0; i < 240; i++) flowers.setColorAt(i, cols[i % cols.length]);
  }

  // J7: dense instanced forest beyond the walkable band (z < -8 and z > 26), in chunks with hi/lo LOD by distance to the hero
  const chunks: { cx: number; hi: T.Object3D[]; lo: T.Object3D }[] = [];
  {
    const R = (i: number) => { const x = Math.sin(i * 57.3 + 1.7) * 24634.6345; return x - Math.floor(x); };
    const trunkG = new T.CylinderGeometry(0.16, 0.24, 1.8, 6); trunkG.translate(0, 0.9, 0);
    const coneA = new T.ConeGeometry(1.5, 3.2, 7); coneA.translate(0, 3.0, 0);
    const coneB = new T.ConeGeometry(1.05, 2.4, 7); coneB.translate(0, 4.6, 0);
    const loG = new T.ConeGeometry(1.5, 5.6, 5); loG.translate(0, 2.8, 0);
    const mTrunk = kit.mat('#6b4a2e'), mA = kit.mat('#3f7a48'), mB = kit.mat('#4d8f55'), mLo = kit.mat('#437f4b');
    const CH = 5, W = 100, N = 90;
    for (let c = 0; c < CH; c++) {
      const x0 = 790 + c * (W / CH) * 1.1, o = new T.Object3D();
      const mk = (g: T.BufferGeometry, m: T.Material) => new T.InstancedMesh(g, m, N);
      const a = mk(trunkG, mTrunk), b = mk(coneA, mA), e = mk(coneB, mB), l = mk(loG, mLo);
      for (let i = 0; i < N; i++) {
        const k = c * 1000 + i, north = i % 2 === 0;
        const z = north ? 27 + R(k) * 30 : -9 - R(k) * 30, x = x0 + R(k + 3) * (W / CH * 1.1);
        o.position.set(x, 0, z); o.rotation.set(0, R(k + 5) * 6, 0); o.scale.setScalar(0.85 + R(k + 7) * 0.7); o.updateMatrix();
        for (const im of [a, b, e, l]) im.setMatrixAt(i, o.matrix);
      }
      for (const im of [a, b, e, l]) { im.castShadow = false; im.receiveShadow = false; root.add(im); }
      chunks.push({ cx: x0 + W / CH * 0.55, hi: [a, b, e], lo: l });
    }
  }

  // forest life, built when Sabri is near the forest
  let life: { group: T.Group; npcs: { h: HeroLike; x: number; z: number; r: number; act: string; path?: number; sp?: number; off?: number }[]; smoke: T.Points[]; water: T.Mesh[] } | null = null;
  const smokeMat = new T.PointsMaterial({ color: '#d8d4cc', size: 0.9, transparent: true, opacity: 0.45, depthWrite: false, sizeAttenuation: true });
  const smokeTex = kit.paint(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  smokeMat.map = smokeTex;
  function buildLife() {
    const group = new T.Group(); root.add(group);
    const npcs: NonNullable<typeof life>['npcs'] = [];
    const add = (seed: number, x: number, z: number, r: number, act: string, path?: number, off = 0) => {
      if (!d.chars) return;
      try { const h = d.chars.makeHero({ kind: 'regular', seed } as never) as HeroLike; group.add(h.object); npcs.push({ h, x, z, r, act, path, sp: 0, off }); } catch { /* */ }
    };
    MANGALS.forEach(([x, z], i) => { add(300 + i * 7, x - 0.9, z, Math.PI / 2, 'cut'); add(320 + i * 5, x + 2.6, z + 1.8, -2.4, 'eat'); add(340 + i * 3, x + 3.4, z + 1.0, -1.6, 'sip'); });
    add(360, CESME.x - 0.5, CESME.z + 1.45, Math.PI, 'pour'); add(361, CESME.x + 1.3, CESME.z + 2.0, Math.PI + 0.4, 'carry');
    // 2026-10-25: trekking groups on three trails (a guide leads, the group follows in a loose line), picnickers, kids, a photographer
    for (let g = 0; g < 3; g++) for (let k = 0; k < 4; k++) add(400 + g * 10 + k, 810, [-2.0, 18.0, 9.2][g] + (k % 2) * 0.5, 0, 'walk', 10 + g, -k * 1.3);
    add(430, 832, 12.4, 0.8, 'sip'); add(431, 834, 13.2, -0.6, 'eat'); add(432, 861, 12.6, 2.2, 'sip'); add(433, 863.4, 13.6, -2.4, 'eat');
    add(434, 874, 5.0, 1.2, 'cut'); add(435, 836.5, -3.8, -1.5, 'sip'); add(436, 848, 21.0, 0.4, 'eat');
    add(440, 842, 15.0, Math.PI, 'pour'); add(441, 835.4, 17.6, 0.2, 'carry');
    add(370, 820, 8.6, 0, 'walk', 0); add(371, 860, 9.6, 0, 'walk', 1); add(372, 840, 8.8, 0, 'walk', 2);
    const smoke = MANGALS.map(([x, z]) => {
      const n = 22, pos = new Float32Array(n * 3), geo = new T.BufferGeometry();
      for (let i = 0; i < n; i++) { pos[i * 3] = x; pos[i * 3 + 1] = 1 + (i / n) * 3.5; pos[i * 3 + 2] = z; }
      geo.setAttribute('position', new T.BufferAttribute(pos, 3)); const p = new T.Points(geo, smokeMat); p.frustumCulled = false; group.add(p); return p;
    });
    const wm = kit.mat('#9fd8f0', { transparent: true, opacity: 0.75, emissive: '#5ab0d8', emissiveIntensity: 0.3 });
    const water = [-0.5, 0.5].map(dx => { const m = new T.Mesh(new T.CylinderGeometry(0.025, 0.035, 0.55, 6), wm); m.position.set(CESME.x - dx, 0.72, CESME.z + 0.62); group.add(m); return m; });
    life = { group, npcs, smoke, water };
  }
  function dropLife() { if (!life) return; life.npcs.forEach(n => n.h.dispose()); life.smoke.forEach(p => p.geometry.dispose()); life.water.forEach(m => m.geometry.dispose()); root.remove(life.group); life = null; }

  // story: Sabri Abi waits in the keeper's hut until the player frees him (sim/gizem.ts)
  let sabriH: HeroLike | null = null;
  const SABRI_AT = { x: 876, z: 21.5 };

  // mushrooms: a small pool per species
  const shrooms = new Map<number, T.Object3D>();
  const shroomOf = (id: string) => { const m = MANTARLAR.find(x => x.id === id) || MANTARLAR[0]; return buildMushroom(kit, m.cap, '#efe6d2', 'zehir' in m && !!m.zehir); };

  let t = 0;
  return {
    update(dt) {
      t += dt;
      const rl = d.rules(), api = rl ? disariApi(rl) : null, v = api ? api.view() : null, p = d.hero();
      // bus
      const b = v?.bus;
      if (b) {
        // smooth: run the phase clock on the frame time (the sim view only moves in sim steps, which looked laggy)
        const now = performance.now() / 1000;
        if (b.phase !== busKey) { busKey = b.phase; busT0 = b.t; busP0 = now; }
        const bt = Math.min(b.dur, busT0 + (now - busP0));
        const sx = b.x - 2.2, z = b.z - 2.5;
        let x = sx, doors = 0;
        if (b.phase === 'geliyor') { x = sx - 70 * (1 - ease(bt / b.dur)); }
        else if (b.phase === 'durakta') { doors = Math.min(1, bt / 0.8); }
        else { doors = Math.max(0, 1 - bt / 0.5); x = sx + Math.pow(Math.max(0, bt - 0.5), 2) * 6; }
        if (d.setSolid && (solidT -= dt) <= 0) { solidT = 0.1; d.setSolid([{ x0: x - 5.3, x1: x + 5.3, z0: z - 1.3, z1: z + 1.3 }]); solidOn = true; }
        const moved = x - busX; busX = x;
        bus.object.visible = true; bus.object.position.set(x, 0, z);
        const h = d.hour();
        bus.set({ doors, lights: h >= 19 || h < 7 ? 1 : 0.2, moved });
      } else { bus.object.visible = false; busKey = ''; if (solidOn && d.setSolid) { d.setSolid([]); solidOn = false; } }
      for (const c of chunks) { const dx = Math.abs(p.x - c.cx), hi = dx < 70, lo = !hi && dx < 170; c.hi.forEach(m => { m.visible = hi; }); c.lo.visible = lo; }
      { const gv = (rl?.rt as unknown as { gizem?: { view(): { sabriBelgrad: boolean; sabriBuldu: boolean } } } | undefined)?.gizem?.view(), want = !!gv && gv.sabriBelgrad && !gv.sabriBuldu && Math.abs(p.x - SABRI_AT.x) < 70;
        if (want && !sabriH && d.chars) { try { sabriH = d.chars.makeHero({ kind: 'regular', seed: 777 } as never) as HeroLike; root.add(sabriH.object); } catch { sabriH = null; } }
        if (!want && sabriH) { sabriH.dispose(); root.remove(sabriH.object); sabriH = null; }
        if (sabriH) { sabriH.setPose(SABRI_AT, -0.8); sabriH.setInput({ speed: 0, act: 'sip', mood: 'sad', t }); sabriH.update(dt, 1); } }
      // forest
      const near = p.x > 780 && p.x < 900;
      if (near && !life) buildLife(); else if (!near && life) dropLife();
      if (life) {
        for (const n of life.npcs) {
          let x = n.x, z = n.z, r = n.r, sp = 0;
          if (n.path != null) { const L = 64, k = (((t * (n.path >= 10 ? 1.0 : 1.3) + n.path * 21 + (n.off || 0)) % (L * 2)) + L * 2) % (L * 2), fw = k < L; x = 808 + (fw ? k : L * 2 - k); r = fw ? Math.PI / 2 : -Math.PI / 2; sp = n.path >= 10 ? 1.0 : 1.3; z = n.z + Math.sin(t * 0.3 + n.path + (n.off || 0)) * 0.4; }
          n.h.setPose({ x, z }, r); n.h.setInput({ speed: sp, carry: n.act === 'carry' ? 1 : 0, act: sp > 0 ? 'walk' : n.act, mood: 'happy', t: t + (n.path ?? 0) }); n.h.update(dt, 1);
        }
        life.smoke.forEach((pt, i) => {
          const a = pt.geometry.getAttribute('position') as T.BufferAttribute, [mx, mz] = MANGALS[i];
          for (let k = 0; k < a.count; k++) {
            let y = a.getY(k) + dt * 0.9; if (y > 4.6) y = 1.0;
            const s = (y - 1) * 0.35; a.setXYZ(k, mx + Math.sin(k * 1.7 + t * 0.6) * s + (y - 1) * 0.25, y, mz + Math.cos(k * 2.3 + t * 0.5) * s);
          }
          a.needsUpdate = true;
        });
        life.water.forEach((m, i) => { m.scale.x = m.scale.z = 1 + Math.sin(t * 20 + i) * 0.15; });
      }
      // mushrooms
      const mt = (rl?.rt as unknown as { mantar?: { items: MantarItem[] } | null })?.mantar;
      const want = new Set<number>();
      if (mt) for (const it of mt.items) {
        want.add(it.i);
        let o = shrooms.get(it.i);
        if (!o || o.userData.id !== it.id) { if (o) root.remove(o); o = shroomOf(it.id); o.userData.id = it.id; root.add(o); shrooms.set(it.i, o); }
        o.position.set(it.x, 0, it.z); o.rotation.y = t * 0.4 + it.i; const s = 1.15 + Math.sin(t * 3 + it.i) * 0.06; o.scale.setScalar(s);
      }
      for (const [i, o] of shrooms) if (!want.has(i)) { root.remove(o); shrooms.delete(i); }
    },
    dispose() { if (sabriH) sabriH.dispose(); dropLife(); smokeMat.dispose(); d.scene.remove(root); kit.dispose(); },
  };
}
