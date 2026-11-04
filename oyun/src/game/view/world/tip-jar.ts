/**
 * Bahşiş kavanozu view (survey musteri-8): a small glass jar at the left end of the counter that fills with coins as
 * the day's tips come in (hedefApi(rules).jar()), sparkles when full, empties at day end (the sim resets it).
 * Code-made low-poly meshes, no colliders (it sits on the counter top). Follows the stage layout (counter moves on
 * tadilat). Reads only.
 */
import * as T from 'three';
import { hedefApi, type JarModel } from '../../sim/goals';
import type { Rules } from '../../sim/state';

export interface TipJarDeps { scene: T.Object3D; rules: () => Rules | null }
export interface TipJarView { update(dt: number): void; dispose(): void }

const JAR_R = 0.095, JAR_H = 0.24, N_COINS = 7, N_SPARK = 6;

function labelTex(): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 128; c.height = 48;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff3c4'; g.fillRect(0, 0, 128, 48);
  g.strokeStyle = '#3b2a20'; g.lineWidth = 4; g.strokeRect(2, 2, 124, 44);
  g.fillStyle = '#c0392b'; g.font = '900 24px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('BAHŞİŞ', 64, 26, 116);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

export function createTipJar(d: TipJarDeps): TipJarView {
  const root = new T.Group(); root.name = 'tipJar';
  const geos: T.BufferGeometry[] = [], mats: T.Material[] = [];
  const G = <X extends T.BufferGeometry>(g: X) => { geos.push(g); return g; };
  const M = <X extends T.Material>(m: X) => { mats.push(m); return m; };

  const glass = new T.Mesh(G(new T.CylinderGeometry(JAR_R, JAR_R * 0.92, JAR_H, 14, 1, true)), M(new T.MeshLambertMaterial({ color: '#cfeaf3', transparent: true, opacity: 0.38, side: T.DoubleSide, depthWrite: false })));
  glass.position.y = JAR_H / 2; glass.renderOrder = 2;
  const bottom = new T.Mesh(G(new T.CylinderGeometry(JAR_R * 0.92, JAR_R * 0.92, 0.012, 14)), M(new T.MeshLambertMaterial({ color: '#a9cfdc', transparent: true, opacity: 0.6 })));
  bottom.position.y = 0.006;
  const rim = new T.Mesh(G(new T.TorusGeometry(JAR_R, 0.012, 6, 16)), M(new T.MeshLambertMaterial({ color: '#8fb7c4' })));
  rim.rotation.x = Math.PI / 2; rim.position.y = JAR_H;
  const tex = labelTex();
  const label = new T.Mesh(G(new T.PlaneGeometry(0.15, 0.056)), M(new T.MeshLambertMaterial({ map: tex, transparent: true })));
  label.position.set(0, JAR_H * 0.42, JAR_R + 0.004); label.renderOrder = 3;
  const gold = M(new T.MeshLambertMaterial({ color: '#f2b632', emissive: '#5a3a00', emissiveIntensity: 0.25 }));
  // the coin pile: a gold cylinder whose height follows the fill, plus loose coins on top
  const pile = new T.Mesh(G(new T.CylinderGeometry(JAR_R * 0.86, JAR_R * 0.8, 1, 14)), gold);
  pile.visible = false;
  const coinGeo = G(new T.CylinderGeometry(0.03, 0.03, 0.008, 10));
  const coins: T.Mesh[] = [];
  for (let i = 0; i < N_COINS; i++) {
    const c = new T.Mesh(coinGeo, gold);
    const a = i * 2.4, rr = i === 0 ? 0 : 0.035 + (i % 2) * 0.012;
    c.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    c.rotation.set((i % 3 - 1) * 0.5, a, (i % 2 ? 0.4 : -0.3));
    c.visible = false; coins.push(c);
  }
  const sparkMat = M(new T.MeshBasicMaterial({ color: '#fff6a0', transparent: true, opacity: 0.95, depthWrite: false }));
  const sparkGeo = G(new T.OctahedronGeometry(0.028, 0));
  const sparks: T.Mesh[] = [];
  for (let i = 0; i < N_SPARK; i++) { const s = new T.Mesh(sparkGeo, sparkMat); s.visible = false; sparks.push(s); }
  root.add(bottom, pile, ...coins, glass, rim, label, ...sparks);
  root.visible = false;
  d.scene.add(root);

  let t = 0, poll = 0, model: JarModel | null = null, shown = 0, lastKey = '';
  function place(r: Rules): void {
    const L = r.rt.layout, c = L.counter;
    const key = c.pos.x + ',' + c.pos.z + ',' + c.drop.y;
    if (key === lastKey) return;
    lastKey = key;
    root.position.set(c.pos.x - 0.68, c.drop.y, c.pos.z + 0.06);
  }
  return {
    update(dt) {
      t += dt;
      const r = d.rules();
      if ((poll -= dt) <= 0) {
        poll = 0.2;
        const api = hedefApi(r);
        model = api && r && r.rt.started ? api.jar() : null;
        root.visible = !!model;
        if (r && model) place(r);
      }
      if (!model) return;
      // ease the visible fill towards the model (coins "drop in")
      shown += (model.fill - shown) * Math.min(1, dt * 4);
      if (Math.abs(model.fill - shown) < 0.002) shown = model.fill;
      const h = Math.max(0.0001, shown * (JAR_H - 0.03));
      pile.visible = shown > 0.01;
      pile.scale.y = h; pile.position.y = 0.012 + h / 2;
      const nLoose = model.coins > 0 ? Math.min(N_COINS, 1 + Math.ceil(shown * (N_COINS - 1))) : 0;
      for (let i = 0; i < N_COINS; i++) { const c = coins[i]; c.visible = i < nLoose; c.position.y = 0.016 + h + (i % 3) * 0.006; }
      const sp = model.sparkle;
      for (let i = 0; i < N_SPARK; i++) {
        const s = sparks[i]; s.visible = sp; if (!sp) continue;
        const a = t * 1.6 + (i / N_SPARK) * Math.PI * 2, k = 0.6 + 0.4 * Math.sin(t * 6 + i * 1.7);
        s.position.set(Math.cos(a) * (JAR_R + 0.07), JAR_H * (0.4 + 0.5 * ((i % 3) / 2)) + Math.sin(t * 3 + i) * 0.04, Math.sin(a) * (JAR_R + 0.07));
        s.scale.setScalar(Math.max(0.2, k)); s.rotation.y = t * 4 + i;
      }
      if (sp) { const g = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 5)); (gold as T.MeshLambertMaterial).emissiveIntensity = g; }
      else (gold as T.MeshLambertMaterial).emissiveIntensity = model.full ? 0.4 : 0.25;
    },
    dispose() {
      d.scene.remove(root);
      geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); tex.dispose();
    },
  };
}
