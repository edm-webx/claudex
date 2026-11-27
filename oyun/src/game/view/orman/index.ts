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
import { REALM_BY_ID, ISKELE_BUS_LANE, busBodyX, busLaneAtStop } from '../../../content/realm';
import { createKit, buildBus, buildBusStop, buildMushroom } from '../atolye';
import { createDoga, gunBandi } from './doga';
import { createYasam, MANGALS, type CharsLike } from './yasam';
import { createUzakOrman } from './uzak-orman';

interface HeroLike { object: T.Object3D; setPose(p: { x: number; z: number }, r: number): void; setInput(i: Record<string, unknown>): void; update(dt: number, a: number): void; dispose(): void }
export interface OrmanViewDeps { scene: T.Scene; rules: () => Rules | null; hero: () => { x: number; z: number }; chars: { makeHero(o: never): unknown } | null; hour: () => number;
  /** 17:24 user: the bus was a ghost. Its body is a nav solid while it is on screen. */
  /** render kamerası: sis mesafesi kameranın baktığı zemin noktasından hesaplanır (sky.ts kuralı dünya orijinine göre olduğundan x=800'de sis yok oluyordu) */
  camera?: () => T.Camera;
  setSolid?: (rects: { x0: number; x1: number; z0: number; z1: number }[]) => void }
export interface OrmanView { update(dt: number): void; dispose(): void }

const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

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
  // iskele stop: the 42B runs in the street's own lane south of the promenade (content/realm ISKELE_BUS_LANE), so the shelter stands on the promenade
  // facing the lane, behind the bus's rear door, and the boarding spot at the front door stays free
  { const s = buildBusStop(kit, OTOBUS.line, 'Martıköy Hattı'); s.position.set(OTOBUS.stop.x + 7.7, 0, ISKELE_BUS_LANE.doorZ - 1.55); root.add(s); }
  const os = REGION_BY_ID.orman.stop, ss = REALM_BY_ID.stadyum.stop;
  stop(os.x, os.z, 'Martıköy İskele', 'ORMAN DURAĞI · 42B DÖNÜŞ');
  stop(ss.x, ss.z, 'Stadyum · İskele · Orman', 'STADYUM KAPISI · 42B');
  { const ms = REALM_BY_ID.mahalle.stop; stop(ms.x, ms.z, 'İskele · Stadyum · Orman', 'MARTI KONUTLARI · 42B'); }   // 2026-11-26 arsaların mahallesi
  const bus = buildBus(kit); bus.object.visible = false; root.add(bus.object);
  let busX = 0, busKey = '', busT0 = 0, busP0 = 0, solidT = 0, solidOn = false;
  // forest sign text
  const signTex = kit.paint(512, 128, (g, w, h) => { g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, w, h); g.fillStyle = '#3f5a2a'; g.font = '900 62px Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BELGRAD ORMANI', w / 2, 58, w - 40); g.font = '700 26px system-ui'; g.fillText('Mangal · Çeşme · Gölet · Kamp · Mantar yolu', w / 2, 104, w - 40); });
  for (const s of [1, -1]) { const m = new T.Mesh(new T.PlaneGeometry(2.25, 0.56), kit.mat('#ffffff', { map: signTex })); m.position.set(812, 1.9, 13.6 + s * 0.06); if (s < 0) m.rotation.y = Math.PI; root.add(m); }

  // forest: nature + life live in their own group, shown only while Sabri is in or near the forest
  const forest = new T.Group(); forest.name = 'orman-doga'; root.add(forest);
  const doga = createDoga(kit, forest);
  const yasam = createYasam(d.chars as CharsLike | null, root);

  // uzak koru: yürünebilir bandın dört yanında yoğun örnekli orman (uzak-orman.ts), mesafeye göre hi/lo LOD
  const uzak = createUzakOrman(kit, root);

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

  const fogDir = new T.Vector3();
  // geceleri ormanda ay ışığı gibi soğuk, çok hafif bir gökyüzü/zemin aydınlığı; ışık sahnede hep durur (yalnızca şiddeti değişir: ışık sayısı değişince tüm gölgelendiriciler yeniden derlenirdi)
  const ay = new T.HemisphereLight('#8aa0e0', '#2c3d3a', 0); ay.name = 'orman-ay'; root.add(ay);
  let hazeK = 0, t = 0;
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
        // 42B lane: the bus runs along its realm's lane (iskele: the street's own bus lane, westbound, doors to the promenade) and always comes from / leaves toward off-screen
        const ln = busLaneAtStop(b.x), z = ln.z, sx = busBodyX(b.x, ln.dir);
        let x = sx, doors = 0;
        if (b.phase === 'geliyor') { x = sx - ln.dir * 70 * (1 - ease(bt / b.dur)); }
        else if (b.phase === 'durakta') { doors = Math.min(1, bt / 0.8); }
        else { const hold = b.drop ? 0.9 : 0; doors = b.drop && bt < hold ? 1 : Math.max(0, 1 - (bt - hold) / 0.5); x = sx + ln.dir * Math.pow(Math.max(0, bt - 0.5 - hold), 2) * 6; }
        bus.object.rotation.y = ln.dir === 1 ? 0 : Math.PI;
        if (d.setSolid && (solidT -= dt) <= 0) { solidT = 0.1; d.setSolid([{ x0: x - 5.3, x1: x + 5.3, z0: z - 1.3, z1: z + 1.3 }]); solidOn = true; }
        const moved = (x - busX) * ln.dir; busX = x;
        bus.object.visible = true; bus.object.position.set(x, ln.y, z);
        bus.set({ doors, lights: h % 24 >= 19 || h % 24 < 7 ? 1 : 0.2, moved });
      } else { bus.object.visible = false; busKey = ''; if (solidOn && d.setSolid) { d.setSolid([]); solidOn = false; } }
      uzak.update(p.x, p.z);
      { const sky = d.scene.getObjectByName('sky'), cm = d.camera?.();
        if (sky && cm) { if (p.x > 700 && p.x < 980) { const dir = cm.getWorldDirection(fogDir); sky.userData.fogD = (dir.y < -0.15 ? Math.min(120, cm.position.y / -dir.y) : 45) * (1 - 0.3 * hazeK * (1 - gunBandi(h).night * 0.5)); } else if (sky.userData.fogD) delete sky.userData.fogD; } }
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
      ay.intensity = 0.55 * hazeK * gunBandi(h).night;
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
    dispose() { ay.dispose?.(); if (sabriH) sabriH.dispose(); uzak.dispose(); yasam.dispose(); doga.dispose(); smokeMat.dispose(); smoke.forEach(p => p.geometry.dispose()); spGeo.dispose(); spM.dispose(); d.scene.remove(root); kit.dispose(); },
  };
}
