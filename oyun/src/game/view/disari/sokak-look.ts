/**
 * DNY-02/03/19: sokak vatandaşlarının elindeki eşya ve yanlarındaki köpek (yalnız görünüm; sim/ambient.ts sokakDurum okur).
 * - Yağmurda yürüyenin şemsiyesi, bankta okuyanın gazetesi, balıkçının oltası + misinası + kovası, müzisyenin sazı,
 *   gece bekçisinin kasketi ve kısık feneri (ışık kaynağı değil, parlayan küçük cam: gece parlaklık kuralı).
 * - Köpek gezdirenin köpeği: sim'deki takipçinin konumuna oturan köpek rig'i (havuz 2).
 * Eşyalar kalabalık görünümünün o karede çizdiği vatandaşa bağlanır (crowd.headPos): çizilmeyenin eşyası da çizilmez.
 * InstancedMesh, kare başı ayırma yok; hepsi tek bir grupta, her kare yeniden yazılır.
 */
import * as T from 'three';
import type { SoAStore, HeroHandle } from '../../../engine/api';
import type { MotorCrowd } from '../chars';
import { sokakDurum } from '../../sim/ambient';
import { ACT_ORDER, AGENT_FLAG } from '../../sim/schema';
import { SOKAK_ROLLER, KOPEK } from '../../../content/sokak';
import { PIER_PROPS } from '../../../content/disari/martikoy';

export interface SokakLookDeps {
  scene: T.Scene; agents: () => SoAStore | null; crowd: MotorCrowd;
  makeDog?: (o: Record<string, unknown>) => HeroHandle;
  hour: () => number;
}
export interface SokakLookView { update(dt: number): void; dispose(): void }

const A_READ = ACT_ORDER.indexOf('read'), A_FISH = ACT_ORDER.indexOf('fish'), A_PLAY = ACT_ORDER.indexOf('play');
const ROL = (id: string) => SOKAK_ROLLER.findIndex(r => r.id === id) + 1;
const R_BALIK = ROL('balikci'), R_MUZ = ROL('muzisyen'), R_BEKCI = ROL('bekci');
const UMB_COL = ['#d93a3a', '#2f6fdb', '#1f1f24', '#f2c230', '#2fb56a', '#7d6bb0', '#e8892b', '#fbfaf6'];

export function createSokakLook(d: SokakLookDeps): SokakLookView {
  const root = new T.Group(); root.name = 'sokak-esya'; root.userData.parity = 'dyn';
  d.scene.add(root);
  const geos: T.BufferGeometry[] = [], mats: T.Material[] = [];
  const G = <X extends T.BufferGeometry>(g: X) => { geos.push(g); return g; };
  const M = (c: string, e?: string) => { const m = new T.MeshLambertMaterial({ color: c, ...(e ? { emissive: new T.Color(e) } : {}) }); mats.push(m); return m; };
  const inst = (g: T.BufferGeometry, m: T.Material, n: number, shadow = false) => { const o = new T.InstancedMesh(g, m, n); o.count = 0; o.frustumCulled = false; o.castShadow = shadow; root.add(o); return o; };

  // umbrella: open canopy (8 panels) + stick
  const canopy = inst(G(new T.ConeGeometry(0.62, 0.3, 8, 1, true).translate(0, 0.15, 0)), (() => { const m = M('#ffffff'); m.side = T.DoubleSide; return m; })(), 48, true);
  // instanceColor must exist before the first render, or the program compiles without instance colours (white canopy)
  canopy.instanceColor = new T.InstancedBufferAttribute(new Float32Array(48 * 3).fill(1), 3);
  const stick = inst(G(new T.CylinderGeometry(0.012, 0.012, 0.95, 5).translate(0, -0.475, 0)), M('#2b2b30'), 48);
  // newspaper (two pages, tilted to the reader)
  const paper = inst(G(new T.BoxGeometry(0.46, 0.32, 0.012)), M('#efe9da'), 24);
  const print = inst(G(new T.BoxGeometry(0.4, 0.04, 0.014).translate(0, 0.1, 0.001)), M('#3a3a3a'), 24);
  // fishing rod (base at the hand), line (unit height, scaled), bucket
  const ROD_L = 2.5;
  const rod = inst(G(new T.CylinderGeometry(0.008, 0.02, ROD_L, 5).translate(0, ROD_L / 2, 0)), M('#3b4146'), 4);
  const line = inst(G(new T.CylinderGeometry(0.003, 0.003, 1, 3).translate(0, -0.5, 0)), M('#f4f4f0'), 4);
  const bucket = inst(G(new T.CylinderGeometry(0.17, 0.13, 0.3, 10).translate(0, 0.15, 0)), M('#2f6f9a'), 4);
  // saz: pear body + long neck
  const sazBody = inst(G(new T.SphereGeometry(0.17, 10, 8).scale(1, 1.25, 0.55)), M('#8a5a2e'), 2);
  const sazNeck = inst(G(new T.BoxGeometry(0.035, 0.6, 0.025).translate(0, 0.3, 0)), M('#5a3a1e'), 2);
  // night watchman: peaked cap + small glowing lantern
  const cap = inst(G(new T.CylinderGeometry(0.13, 0.135, 0.08, 10)), M('#1d2a44'), 2);
  const visor = inst(G(new T.BoxGeometry(0.2, 0.015, 0.09).translate(0, 0, 0.1)), M('#111318'), 2);
  const lantern = inst(G(new T.CylinderGeometry(0.045, 0.05, 0.14, 8)), M('#fff2c4', '#ffd98a'), 2);

  const dummy = new T.Object3D(); dummy.rotation.order = 'YXZ';
  const head = { x: 0, y: 0, z: 0 }, col = new T.Color();
  const put = (o: T.InstancedMesh, x: number, y: number, z: number, ry: number, rx = 0, sy = 1) => {
    if (o.count >= (o.instanceMatrix.count)) return -1;
    dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, 0); dummy.scale.set(1, sy, 1); dummy.updateMatrix();
    const k = o.count++; o.setMatrixAt(k, dummy.matrix); return k;
  };

  // dogs: a small pool of rigs that sit where the sim's follower is
  const dogs: { h: HeroHandle; slot: number }[] = [];
  const dogFor = (slot: number, ad: number): HeroHandle | null => {
    const f = dogs.find(g => g.slot === slot) ?? dogs.find(g => g.slot < 0);
    if (f) { f.slot = slot; f.h.object.visible = true; return f.h; }
    if (!d.makeDog || dogs.length >= 2) return null;
    try {
      const h = d.makeDog({ name: KOPEK.adlar[ad % KOPEK.adlar.length] });
      // coat colour per dog (the rig's own material is tinted; Karamel's rig is a separate instance)
      h.object.traverse(o => { const m = (o as T.Mesh).material as T.MeshLambertMaterial | undefined; if (m && (o as T.Mesh).isMesh && m.color && !(o as T.Mesh).name.includes('blob')) { const c = m.clone(); c.color.set(KOPEK.renk[ad % KOPEK.renk.length]); (o as T.Mesh).material = c; mats.push(c); } });
      dogs.push({ h, slot }); return h;
    } catch { return null; }
  };

  return {
    update(dt) {
      for (const o of [canopy, stick, paper, print, rod, line, bucket, sazBody, sazNeck, cap, visor, lantern]) o.count = 0;
      const s = d.agents(), st = sokakDurum(s);
      for (const g of dogs) g.slot = -1;
      if (!s || !st) { for (const g of dogs) g.h.object.visible = false; return; }
      const R = s.f32('rot'), F = s.u16('flags'), A = s.u8('act'), night = d.hour() >= 20 || d.hour() < 6;
      for (let i = 0, n = Math.min(s.hi, 256); i < n; i++) {
        if (!s.alive(i) || !(F[i] & AGENT_FLAG.ambient)) continue;
        const rol = st.rol[i], um = st.semsiye[i], act = A[i];
        const dogOn = st.kopek[i * 4] === st.kopek[i * 4];
        if (!um && !rol && act !== A_READ) continue;
        if (!d.crowd.headPos(i, head)) continue;   // not drawn this frame
        const ry = R[i], fx = Math.sin(ry), fz = Math.cos(ry), rx = Math.cos(ry), rz = -Math.sin(ry);
        if (um) {
          const k = put(canopy, head.x + fx * 0.05, head.y + 0.42, head.z + fz * 0.05, ry, -0.12);
          if (k >= 0) canopy.setColorAt(k, col.set(UMB_COL[(i * 5) % UMB_COL.length]));
          put(stick, head.x + fx * 0.05, head.y + 0.42, head.z + fz * 0.05, ry, -0.12);
        }
        if (act === A_READ && (F[i] & AGENT_FLAG.seated)) { put(paper, head.x + fx * 0.3, head.y - 0.3, head.z + fz * 0.3, ry, -0.35); put(print, head.x + fx * 0.3, head.y - 0.3, head.z + fz * 0.3, ry, -0.35); }
        if (rol === R_BALIK && act === A_FISH) {
          const bx = head.x + fx * 0.28 + rx * 0.18, by = head.y - 0.62, bz = head.z + fz * 0.28 + rz * 0.18, tilt = 0.95;
          const staticRod = Math.hypot(head.x - PIER_PROPS.oltaci.x, head.z - PIER_PROPS.oltaci.z) < 0.9;   // the pier corner already has its rod
          if (!staticRod) {
            put(rod, bx, by, bz, ry, tilt);
            const tx = bx + fx * Math.sin(tilt) * ROD_L, ty = by + Math.cos(tilt) * ROD_L, tz = bz + fz * Math.sin(tilt) * ROD_L;
            put(line, tx, ty, tz, ry, 0, ty + 0.8);
            put(bucket, head.x + rx * 0.55, 0, head.z + rz * 0.55, 0);
          }
        }
        if (rol === R_MUZ && act === A_PLAY) {
          put(sazBody, head.x + fx * 0.22 - rx * 0.05, head.y - 0.78, head.z + fz * 0.22 - rz * 0.05, ry, 0);
          put(sazNeck, head.x + fx * 0.24 + rx * 0.02, head.y - 0.72, head.z + fz * 0.24 + rz * 0.02, ry + 0.2, 0.9);
        }
        if (rol === R_BEKCI) {
          put(cap, head.x, head.y - 0.02, head.z, ry); put(visor, head.x, head.y - 0.03, head.z, ry);
          if (night) put(lantern, head.x + fx * 0.12 + rx * 0.3, head.y - 0.85, head.z + fz * 0.12 + rz * 0.3, ry);
        }
        if (dogOn) {
          const h = dogFor(i, st.kopekAd[i]);
          if (h) {
            const o = i * 4;
            h.setPose({ x: st.kopek[o], z: st.kopek[o + 1] }, st.kopek[o + 2]);
            h.setInput({ speed: st.kopek[o + 3], act: st.kopek[o + 3] > 0.1 ? 'walk' : 'idle', carry: 0, mood: 'ok', t: 0 });
            h.update(dt, 1);
          }
        }
      }
      for (const g of dogs) if (g.slot < 0) g.h.object.visible = false;
      for (const o of [canopy, stick, paper, print, rod, line, bucket, sazBody, sazNeck, cap, visor, lantern]) { o.instanceMatrix.needsUpdate = true; if (o.instanceColor) o.instanceColor.needsUpdate = true; }
    },
    dispose() {
      for (const g of dogs) g.h.dispose();
      root.removeFromParent(); geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose());
    },
  };
}
