/**
 * Otobüs + Belgrad Ormanı view (16:52 user; DNY-10/11 2026-11-21). Never writes sim state.
 * - 42B bus stops (büfe karşısı, Orman Durağı, Stadyum Kapısı; Martı Atölyesi models) with their own name strips, the
 *   bus driving in, opening its doors and pulling away (also from the stop it just dropped Sabri at), from
 *   rt.disari bus (sim/disari.ts); people wait, board and step off (yasam.ts).
 * - The forest's nature (doga.ts: ground cover, pond, campfire, sign faces, light by the hour, mist, fireflies,
 *   birds, squirrels) and its life by the game clock (yasam.ts), shown only while Sabri is in the forest.
 * - The day's mushrooms (rt.mantar from sim/mantar.ts) with a soft sparkle so they can be found, the far forest
 *   chunks (instanced, hi/lo by distance), a painted "BELGRAD ORMANI" sign, the story's Sabri Abi (sim/gizem.ts).
 */
import * as T from 'three';
import type { Rules } from '../../sim/state';
import { disariApi } from '../../sim/disari';
import type { MantarItem } from '../../sim/mantar';
import { OTOBUS, MANTARLAR, REGION_BY_ID } from '../../../content/disari/martikoy';
import { REALM_BY_ID } from '../../../content/realm';
import { createKit, buildBus, buildBusStop, buildMushroom } from '../atolye';
import { createDoga, gunBandi } from './doga';
import { createYasam, MANGALS, type CharsLike } from './yasam';

interface HeroLike { object: T.Object3D; setPose(p: { x: number; z: number }, r: number): void; setInput(i: Record<string, unknown>): void; update(dt: number, a: number): void; dispose(): void }
export interface OrmanViewDeps { scene: T.Scene; rules: () => Rules | null; hero: () => { x: number; z: number }; chars: { makeHero(o: never): unknown } | null; hour: () => number;
  /** 17:24 user: the bus was a ghost. Its body is a nav solid while it is on screen. */
  setSolid?: (rects: { x0: number; x1: number; z0: number; z1: number }[]) => void }
export interface OrmanView { update(dt: number): void; dispose(): void }

const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const fr = (x: number) => x - Math.floor(x);

export function createOrmanView(d: OrmanViewDeps): OrmanView {
  const kit = createKit();
  const root = new T.Group(); root.name = 'orman-otobus'; d.scene.add(root);
  // stops: shelter behind the waiting spot, facing the road (-z); each gets its own name strip over the shelter's
  const strip = (txt: string) => kit.paint(512, 64, (c, w, h) => { c.fillStyle = '#2f8f9a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '900 32px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, h / 2 + 2, w - 20); });
  const stop = (x: number, z: number, dest: string, name: string | null) => {
    const s = buildBusStop(kit, OTOBUS.line, dest); s.position.set(x, 0, z + 1.6); s.rotation.y = Math.PI; root.add(s);
    if (name) { const m = new T.Mesh(new T.PlaneGeometry(3.6, 0.16), kit.mat('#ffffff', { map: strip(name) })); m.position.set(0, 2.55, 0.962); s.add(m); }
    return s;
  };
  stop(OTOBUS.stop.x, OTOBUS.stop.z - 0.1, 'Martıköy Hattı', null);
  const os = REGION_BY_ID.orman.stop, ss = REALM_BY_ID.stadyum.stop;
  stop(os.x, os.z, 'Martıköy İskele', 'ORMAN DURAĞI · 42B DÖNÜŞ');
  stop(ss.x, ss.z, 'Stadyum · İskele · Orman', 'STADYUM KAPISI · 42B');
  const bus = buildBus(kit); bus.object.visible = false; root.add(bus.object);
  let busX = 0, busKey = '', busT0 = 0, busP0 = 0, solidT = 0, solidOn = false;
  // forest sign text
  const signTex = kit.paint(512, 128, (g, w, h) => { g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, w, h); g.fillStyle = '#3f5a2a'; g.font = '900 62px Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BELGRAD ORMANI', w / 2, 58, w - 40); g.font = '700 26px system-ui'; g.fillText('Mangal · Çeşme · Gölet · Kamp · Mantar yolu', w / 2, 104, w - 40); });
  for (const s of [1, -1]) { const m = new T.Mesh(new T.PlaneGeometry(2.25, 0.56), kit.mat('#ffffff', { map: signTex })); m.position.set(812, 1.9, 13.6 + s * 0.06); if (s < 0) m.rotation.y = Math.PI; root.add(m); }

  // forest: nature + life live in their own group, shown only while Sabri is in or near the forest
  const forest = new T.Group(); forest.name = 'orman-doga'; root.add(forest);
  const doga = createDoga(kit, forest);
  const yasam = createYasam(d.chars as CharsLike | null, root);

  // J7: dense instanced forest beyond the walkable band (z < -10 and z > 28), in chunks with hi/lo LOD by distance to the hero
  const chunks: { cx: number; hi: T.Object3D[]; lo: T.Object3D }[] = [];
  {
    const R = (i: number) => fr(Math.sin(i * 57.3 + 1.7) * 24634.6345);
    const trunkG = new T.CylinderGeometry(0.16, 0.24, 1.8, 6); trunkG.translate(0, 0.9, 0);
    const coneA = new T.ConeGeometry(1.5, 3.2, 7); coneA.translate(0, 3.0, 0);
    const coneB = new T.ConeGeometry(1.05, 2.4, 7); coneB.translate(0, 4.6, 0);
    const loG = new T.ConeGeometry(1.5, 5.6, 5); loG.translate(0, 2.8, 0);
    const mTrunk = kit.mat('#6b4a2e'), mA = kit.mat('#ffffff'), mB = kit.mat('#ffffff'), mLo = kit.mat('#437f4b');
    const tint = ['#3f7a48', '#2f6e44', '#4d8f55', '#5b9a4a', '#356c3e', '#6a9e52'].map(c => new T.Color(c)), tc = new T.Color();
    const CH = 5, W = 100, N = 110;
    for (let c = 0; c < CH; c++) {
      const x0 = 790 + c * (W / CH) * 1.1, o = new T.Object3D();
      const mk = (g: T.BufferGeometry, m: T.Material) => new T.InstancedMesh(g, m, N);
      const a = mk(trunkG, mTrunk), b = mk(coneA, mA), e = mk(coneB, mB), l = mk(loG, mLo);
      for (let i = 0; i < N; i++) {
        const k = c * 1000 + i, north = i % 2 === 0;
        const z = north ? 29 + R(k) * 30 : -11 - R(k) * 30, x = x0 + R(k + 3) * (W / CH * 1.1);
        o.position.set(x, 0, z); o.rotation.set(0, R(k + 5) * 6, 0); o.scale.setScalar(0.85 + R(k + 7) * 0.8); o.updateMatrix();
        for (const im of [a, b, e, l]) im.setMatrixAt(i, o.matrix);
        tc.copy(tint[Math.floor(R(k + 9) * tint.length)]); b.setColorAt(i, tc); e.setColorAt(i, tc.offsetHSL(0, 0, 0.05));
      }
      for (const im of [a, b, e, l]) { im.castShadow = false; im.receiveShadow = false; im.computeBoundingSphere(); root.add(im); }
      chunks.push({ cx: x0 + W / CH * 0.55, hi: [a, b, e], lo: l });
    }
  }

  // mangal smoke while the families are out
  const smokeTex = kit.paint(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const smokeMat = new T.PointsMaterial({ color: '#d8d4cc', size: 0.9, transparent: true, opacity: 0.45, depthWrite: false, sizeAttenuation: true, map: smokeTex });
  const smoke = MANGALS.map(({ m: [x, z] }) => {
    const n = 22, pos = new Float32Array(n * 3), geo = new T.BufferGeometry();
    for (let i = 0; i < n; i++) { pos[i * 3] = x; pos[i * 3 + 1] = 1 + (i / n) * 3.5; pos[i * 3 + 2] = z; }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3)); const p = new T.Points(geo, smokeMat); p.frustumCulled = false; forest.add(p); return p;
  });
  const cesmeWater = (() => { const wm = kit.mat('#9fd8f0', { transparent: true, opacity: 0.75, emissive: '#5ab0d8', emissiveIntensity: 0.3 }); return [-0.5, 0.5].map(dx => { const m = new T.Mesh(new T.CylinderGeometry(0.025, 0.035, 0.55, 6), wm); m.position.set(838 - dx, 0.72, 16.5 + 0.62); forest.add(m); return m; }); })();

  // story: Sabri Abi waits in the keeper's hut until the player frees him (sim/gizem.ts)
  let sabriH: HeroLike | null = null;
  const SABRI_AT = { x: 876, z: 21.5 };

  // mushrooms: one template per species (clones share geometry), a soft sparkle over each so they can be found
  const shroomT = new Map<string, T.Object3D>(), shrooms = new Map<number, T.Object3D>();
  const shroomOf = (id: string) => { let t0 = shroomT.get(id); if (!t0) { const m = MANTARLAR.find(x => x.id === id) || MANTARLAR[0]; t0 = buildMushroom(kit, m.cap, '#efe6d2', 'zehir' in m && !!m.zehir); shroomT.set(id, t0); } return t0.clone(); };
  const SPN = 16, spPos = new Float32Array(SPN * 3), spGeo = new T.BufferGeometry(); spGeo.setAttribute('position', new T.BufferAttribute(spPos, 3));
  const spTex = kit.paint(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.3, 'rgba(255,250,200,.55)'); gr.addColorStop(1, 'rgba(255,250,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
  const spM = new T.PointsMaterial({ size: 0.42, map: spTex, color: '#fff6c8', transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true });
  const sparkle = new T.Points(spGeo, spM); sparkle.frustumCulled = false; forest.add(sparkle);

  let fogBase = 0, fogSet = 0, hazeK = 0, t = 0;
  return {
    update(dt) {
      t += dt;
      const rl = d.rules(), api = rl ? disariApi(rl) : null, v = api ? api.view() : null, p = d.hero(), h = d.hour();
      // bus
      const b = v?.bus;
      if (b) {
        // smooth: run the phase clock on the frame time (the sim view only moves in sim steps, which looked laggy)
        const now = performance.now() / 1000;
        if (b.phase + b.x !== busKey) { busKey = b.phase + b.x; busT0 = b.t; busP0 = now; }
        const bt = Math.min(b.dur, busT0 + (now - busP0));
        const sx = b.x - 2.2, z = b.z - 2.5;
        let x = sx, doors = 0;
        if (b.phase === 'geliyor') { x = sx - 70 * (1 - ease(bt / b.dur)); }
        else if (b.phase === 'durakta') { doors = Math.min(1, bt / 0.8); }
        else { const hold = b.drop ? 0.9 : 0; doors = b.drop && bt < hold ? 1 : Math.max(0, 1 - (bt - hold) / 0.5); x = sx + Math.pow(Math.max(0, bt - 0.5 - hold), 2) * 6; }
        if (d.setSolid && (solidT -= dt) <= 0) { solidT = 0.1; d.setSolid([{ x0: x - 5.3, x1: x + 5.3, z0: z - 1.3, z1: z + 1.3 }]); solidOn = true; }
        const moved = x - busX; busX = x;
        bus.object.visible = true; bus.object.position.set(x, 0, z);
        bus.set({ doors, lights: h >= 19 || h < 7 ? 1 : 0.2, moved });
      } else { bus.object.visible = false; busKey = ''; if (solidOn && d.setSolid) { d.setSolid([]); solidOn = false; } }
      for (const c of chunks) { const dx = Math.abs(p.x - c.cx), hi = dx < 70, lo = !hi && dx < 170; c.hi.forEach(m => { m.visible = hi; }); c.lo.visible = lo; }
      { const gv = (rl?.rt as unknown as { gizem?: { view(): { sabriBelgrad: boolean; sabriBuldu: boolean } } } | undefined)?.gizem?.view(), want = !!gv && gv.sabriBelgrad && !gv.sabriBuldu && Math.abs(p.x - SABRI_AT.x) < 70;
        if (want && !sabriH && d.chars) { try { sabriH = d.chars.makeHero({ kind: 'regular', seed: 777 } as never) as HeroLike; root.add(sabriH.object); } catch { sabriH = null; } }
        if (!want && sabriH) { sabriH.dispose(); root.remove(sabriH.object); sabriH = null; }
        if (sabriH) { sabriH.setPose(SABRI_AT, -0.8); sabriH.setInput({ speed: 0, act: 'sip', mood: 'sad', t }); sabriH.update(dt, 1); } }
      // forest
      const near = p.x > 780 && p.x < 900;
      forest.visible = near;
      doga.update(dt, p, h, near);
      yasam.update(dt, p, h, !!rl?.rt.paused, b || null);
      // a light green haze while inside: the sky sets the fog distance by the hour, we only shorten whatever it set
      hazeK += ((near ? 1 : 0) - hazeK) * Math.min(1, dt * 1.5);
      { const f = d.scene.fog as T.Fog | null;
        if (f && 'far' in f) { if (Math.abs(f.far - fogSet) > 1e-3) fogBase = f.far; const k = 1 - 0.35 * hazeK * (1 - gunBandi(h).night * 0.5); fogSet = fogBase * k; f.far = fogSet; } }
      if (near) {
        const famOn = h >= 11 && h < 19.5;
        smoke.forEach((pt, i) => {
          pt.visible = famOn; if (!famOn) return;
          const a = pt.geometry.getAttribute('position') as T.BufferAttribute, [mx, mz] = MANGALS[i].m;
          for (let k = 0; k < a.count; k++) {
            let y = a.getY(k) + dt * 0.9; if (y > 4.6) y = 1.0;
            const s = (y - 1) * 0.35; a.setXYZ(k, mx + Math.sin(k * 1.7 + t * 0.6) * s + (y - 1) * 0.25, y, mz + Math.cos(k * 2.3 + t * 0.5) * s);
          }
          a.needsUpdate = true;
        });
        cesmeWater.forEach((m, i) => { m.scale.x = m.scale.z = 1 + Math.sin(t * 20 + i) * 0.15; });
      }
      // mushrooms
      const mt = (rl?.rt as unknown as { mantar?: { items: MantarItem[] } | null })?.mantar;
      const want = new Set<number>(); let sp = 0;
      if (mt) for (const it of mt.items) {
        want.add(it.i);
        let o = shrooms.get(it.i);
        if (!o || o.userData.id !== it.id) { if (o) root.remove(o); o = shroomOf(it.id); o.userData.id = it.id; root.add(o); shrooms.set(it.i, o); }
        o.position.set(it.x, 0, it.z); o.rotation.y = t * 0.4 + it.i; const s = 1.15 + Math.sin(t * 3 + it.i) * 0.06; o.scale.setScalar(s);
        if (sp < SPN) { spPos[sp * 3] = it.x + Math.sin(t * 1.3 + it.i) * 0.12; spPos[sp * 3 + 1] = 0.55 + Math.sin(t * 2 + it.i) * 0.12; spPos[sp * 3 + 2] = it.z; sp++; }
      }
      spGeo.setDrawRange(0, sp); (spGeo.getAttribute('position') as T.BufferAttribute).needsUpdate = true; spM.opacity = 0.55 + 0.3 * Math.sin(t * 2.4);
      for (const [i, o] of shrooms) if (!want.has(i)) { root.remove(o); shrooms.delete(i); }
    },
    dispose() { if (sabriH) sabriH.dispose(); yasam.dispose(); doga.dispose(); smokeMat.dispose(); smoke.forEach(p => p.geometry.dispose()); spGeo.dispose(); spM.dispose(); d.scene.remove(root); kit.dispose(); },
  };
}
