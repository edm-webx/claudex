/**
 * Çarşı Sokağı extras for the esnaf friendship feature (view only, never writes sim state):
 * - the evening esnaf çayı table (low-poly tavla table, tea glasses, stools) at CAY_SPOT, shown in EVENING_H;
 * - the lost cat of a "Kayıp kedisini bul" favour (chars.makeCat, curled up asleep) with a small name tag;
 * - a floating package marker above the esnaf a "Siparişini götür" package goes to.
 * Reads `info()` (rt.esnaf.view()) each frame. Visual table has no collider on purpose (decor, nav untouched).
 */
import * as T from 'three';
import type { ZoneManager, Vec3, ScreenPt, HeroHandle } from '../../../engine/api';
import type { MotorChars } from '../chars';
import type { HtmlLabels, HtmlLabel } from '../../ui/labels';
import { ESNAF, STREET_ZONE, placeFronts } from '../../../content/carsi/street';
import { CAY_SPOT, EVENING_H } from '../../../content/carsi/esnaf-dostluk';
import type { EsnafView } from '../../sim/esnaf';

export interface EsnafExtrasDeps {
  scene: T.Scene; chars: MotorChars; zones: ZoneManager; labels: HtmlLabels;
  project(p: Vec3, out: ScreenPt): boolean; hour(): number; info(): EsnafView | null;
}
export interface EsnafExtras { update(dt: number): void; dispose(): void }

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);

function makeTable(): T.Group {
  const g = new T.Group();
  const mat = (c: string) => new T.MeshLambertMaterial({ color: c });
  const box = (w: number, h: number, d: number, c: string, x: number, y: number, z: number) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); g.add(m); return m; };
  box(1.3, 0.08, 0.9, '#8a5a36', 0, 0.72, 0);             // table top
  for (const [x, z] of [[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.35], [0.55, 0.35]]) box(0.08, 0.7, 0.08, '#6b4a2e', x, 0.36, z);
  box(0.62, 0.05, 0.42, '#d9b07a', -0.2, 0.79, 0);          // tavla board
  box(0.02, 0.06, 0.42, '#6b4a2e', -0.2, 0.8, 0);
  for (let i = 0; i < 5; i++) { const p = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.02, 10), mat(i % 2 ? '#f6efe1' : '#3a2a1e')); p.position.set(-0.45 + i * 0.1, 0.83, 0.13); g.add(p); }
  for (const [x, z] of [[0.35, -0.2], [0.45, 0.15], [0.25, 0.25]]) {
    const gl = new T.Mesh(new T.CylinderGeometry(0.035, 0.028, 0.1, 10), new T.MeshLambertMaterial({ color: '#b5361f', transparent: true, opacity: 0.85 }));
    gl.position.set(x, 0.81, z); g.add(gl);
  }
  const pot = new T.Mesh(new T.CylinderGeometry(0.09, 0.11, 0.18, 12), mat('#c9c9c9')); pot.position.set(0.5, 0.85, -0.05); g.add(pot);
  for (const [x, z] of [[-0.95, 0], [0.95, 0], [0, -0.8], [0, 0.8]]) { box(0.36, 0.06, 0.36, '#c94f3b', x, 0.42, z); box(0.05, 0.4, 0.05, '#6b4a2e', x, 0.2, z); }
  return g;
}
function makePackage(): T.Group {
  const g = new T.Group();
  const b = new T.Mesh(new T.BoxGeometry(0.34, 0.26, 0.26), new T.MeshLambertMaterial({ color: '#d9a35a' })); g.add(b);
  const r1 = new T.Mesh(new T.BoxGeometry(0.36, 0.05, 0.27), new T.MeshLambertMaterial({ color: '#c23d63' })); g.add(r1);
  const r2 = new T.Mesh(new T.BoxGeometry(0.06, 0.27, 0.27), new T.MeshLambertMaterial({ color: '#c23d63' })); g.add(r2);
  return g;
}

export function createEsnafExtras(d: EsnafExtrasDeps): EsnafExtras {
  const placed = placeFronts();
  const table = makeTable(); table.position.set(CAY_SPOT.x, 0, CAY_SPOT.z); table.visible = false; d.scene.add(table);
  const pkg = makePackage(); pkg.visible = false; d.scene.add(pkg);
  let cat: HeroHandle | null = null;
  try { cat = d.chars.makeCat({ name: 'Kayıp', coat: 'ginger' }); cat.object.visible = false; } catch (e) { console.warn('[carsi] cat', e); }
  const catLabel: HtmlLabel = d.labels.label();
  const pkgLabel: HtmlLabel = d.labels.label();
  const at: Vec3 = { x: 0, y: 0, z: 0 };
  const sp: ScreenPt = { x: 0, y: 0 };
  let t = 0;
  const standOf = (id: string) => {
    const e = ESNAF.find(q => q.id === id); const p = e && placed.find(q => q.id === e.shop);
    if (!p) return null;
    const n = p.side === 'n';
    return { x: p.cx, z: n ? p.frontZ - 0.7 : p.frontZ + 0.85 };
  };
  return {
    update(dt) {
      t += dt;
      const st = d.zones.state(STREET_ZONE);
      const live = st === 'warm' || st === 'hot';
      const h = d.hour();
      const info = live ? d.info() : null;
      table.visible = live && h >= EVENING_H[0] && h < EVENING_H[1];
      // lost cat
      const c = info?.cat || null;
      if (cat) {
        cat.object.visible = !!c;
        if (c) {
          cat.setPose({ x: c.x, z: c.z }, 0.6);
          cat.setInput({ speed: 0, act: 'sleep' } as never);
          cat.update(dt, 1);
          at.x = c.x; at.y = 0.9; at.z = c.z;
          if (d.project(at, sp)) catLabel.set(sp.x, sp.y, `<div class="tag">${esc(c.name)} zZ</div>`, 'tag'); else catLabel.hide();
        } else catLabel.hide();
      } else catLabel.hide();
      // package target
      const to = info?.teslimTo ? standOf(info.teslimTo) : null;
      pkg.visible = !!to;
      if (to) {
        pkg.position.set(to.x, 2.7 + Math.sin(t * 3) * 0.12, to.z); pkg.rotation.y = t * 1.5;
        at.x = to.x; at.y = 3.2; at.z = to.z;
        if (d.project(at, sp)) pkgLabel.set(sp.x, sp.y, `<div class="tag">Paket buraya!</div>`, 'tag'); else pkgLabel.hide();
      } else pkgLabel.hide();
    },
    dispose() {
      d.scene.remove(table); d.scene.remove(pkg);
      table.traverse(o => { const m = o as T.Mesh; if (m.geometry) m.geometry.dispose(); const mm = m.material as T.Material | undefined; if (mm) mm.dispose(); });
      pkg.traverse(o => { const m = o as T.Mesh; if (m.geometry) m.geometry.dispose(); const mm = m.material as T.Material | undefined; if (mm) mm.dispose(); });
      if (cat) { cat.dispose(); cat = null; }
      catLabel.free(); pkgLabel.free();
    },
  };
}
