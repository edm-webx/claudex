/**
 * DKN-02: renovation site (şantiye) in front of a far-shore business while its Plot.tadilat runs: scaffold wings either side
 * of the door with a signed bridge over it, barriers with a gap for the customers, a material pile, a tower crane whose hook
 * sways, and deck planks that fill with the progress. The ustalar themselves are real actors (sim/agents/isletme-insaat.ts),
 * nothing here is a worker prop. One group per business, removed and disposed when the renovation ends.
 * Same idea as the büfe's buildSite (bufe-buyume.ts, not touched: duplication accepted until the two merge).
 */
import * as T from 'three';
import { Batch } from '../../../engine/prefab/batch';
import { insaatYer, type InsaatYer } from '../../../content/isletme-insaat';
import { SETLER, isletmeBoyut } from '../../../content/santiye';
import { merdiven, boyaKovasi, elArabasi, kumYigini, tuvalet, jenerator } from './santiye-kit';

export interface InsaatDeps {
  root: () => T.Object3D | null; night: () => number;
  /** every business in tadilat: p = progress 0..1 (1 - left/total) */
  tadilat: () => { id: string; p: number; lv?: number }[];
}
export interface InsaatView { update(dt: number): void; dispose(): void }

const STEEL = '#aeb6c0', YEL = '#ffd23f', RED = '#e0533c', WOOD_A = '#a8794e', WOOD_B = '#9c6f46';
let solid: T.MeshStandardMaterial | null = null;
const solidMat = () => solid || (solid = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.1 }));

interface Site { id: string; g: T.Group; planks: T.Mesh[]; jib: T.Group | null; trolley: T.Group; cable: T.Mesh; load: T.Mesh; beacons: T.MeshBasicMaterial[]; sign: T.MeshStandardMaterial; ph: number }

function signTex(): T.CanvasTexture {
  const w = 640, h = 160, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  g.fillStyle = '#ffd23f'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1c1f24'; for (let x = -h; x < w + h; x += 56) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 26, 0); g.lineTo(x + 26 - h * 0.5, h); g.lineTo(x - h * 0.5, h); g.fill(); }
  g.fillStyle = '#ffd23f'; g.fillRect(0, 26, w, h - 52);
  g.fillStyle = '#1c1f24'; g.font = '900 86px system-ui,"Segoe UI",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TADİLAT', w / 2, h / 2 + 4);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** lv = the business's current level (renovation lv -> lv+1): 2026-11-26 sahip, makineler işin büyüklüğüne göre (content/santiye.ts) */
function buildSite(y: InsaatYer, lv = 1): Site {
  const set = SETLER[isletmeBoyut(lv)];
  const g = new T.Group(); g.name = 'insaat-' + y.id; g.position.set(y.ox, 0, y.oz); g.rotation.y = y.yaw;
  const b = new Batch(), S = y.S, H = 4.4;
  const planks: T.Mesh[] = [], plankGeo = new T.BoxGeometry(0.4, 0.07, 1.1);
  const mA = new T.MeshLambertMaterial({ color: WOOD_A }), mB = new T.MeshLambertMaterial({ color: WOOD_B });
  // scaffold wings (left = -1, right = +1): two pole rows, three decks, rails, diagonal bracing
  const bays = 2, u0 = 1.3, u1 = S / 2, V0 = 0.9, V1 = 2.0, decks = [1.2, 2.4, 3.6];
  for (const s of [-1, 1]) {
    const us = Array.from({ length: bays + 1 }, (_, i) => s * (u0 + i * (u1 - u0) / bays));
    for (const u of us) for (const v of [V0, V1]) { b.box(0.07, H, 0.07, STEEL, u, H / 2, v); b.box(0.16, 0.04, 0.16, '#5b6068', u, 0.02, v); }
    for (const yy of decks) {
      b.box(u1 - u0 + 0.1, 0.06, 0.06, STEEL, s * (u0 + u1) / 2, yy - 0.06, V0); b.box(u1 - u0 + 0.1, 0.06, 0.06, STEEL, s * (u0 + u1) / 2, yy - 0.06, V1);
      b.box(u1 - u0 + 0.1, 0.05, 0.05, RED, s * (u0 + u1) / 2, yy + 0.55, V1); b.box(u1 - u0 + 0.1, 0.05, 0.05, '#f4f2ec', s * (u0 + u1) / 2, yy + 0.95, V1);
      for (let i = 0; i < bays; i++) b.box(0.05, 0.05, V1 - V0, STEEL, (us[i] + us[i + 1]) / 2, yy - 0.06, (V0 + V1) / 2);
    }
    for (let i = 0; i < bays; i++) { const a = us[i], c = us[i + 1], dw = Math.abs(c - a), len = Math.hypot(dw, 2.4); b.box(len, 0.045, 0.045, STEEL, (a + c) / 2, 2.4, V1 + 0.04, { rz: Math.atan2(2.4, dw) * (i % 2 ? -1 : 1) }); }
  }
  // deck planks, filled bottom deck first with the progress
  const cnt = Math.floor((u1 - u0) / 0.42);
  for (const yy of decks) for (let i = 0; i < cnt; i++) for (const s of [-1, 1]) {
    const m = new T.Mesh(plankGeo, (i + (s > 0 ? 1 : 0)) % 2 ? mA : mB); m.position.set(s * (u0 + 0.22 + i * 0.42), yy, (V0 + V1) / 2); m.visible = false; m.castShadow = true; g.add(m); planks.push(m);
  }
  // bridge over the door with the TADİLAT sign (emissive at night)
  b.box(2 * u0 + 0.2, 0.08, 0.08, STEEL, 0, H - 0.2, V1); b.box(2 * u0 + 0.2, 0.08, 0.08, STEEL, 0, H - 0.2, V0);
  const signMat = new T.MeshStandardMaterial({ map: signTex(), roughness: 0.6, emissive: new T.Color('#ffd23f'), emissiveMap: null, emissiveIntensity: 0, side: T.DoubleSide });
  signMat.emissiveMap = signMat.map;
  const sign = new T.Mesh(new T.PlaneGeometry(2.5, 0.62), signMat); sign.position.set(0, H - 0.62, V1 + 0.06); g.add(sign);
  // barriers along the customer side with a gap at the door; cones and flashing lamps at the gap
  const BZ = 4.4;
  for (const s of [-1, 1]) for (let u = 1.5 + 0.65; u < S / 2 + 1.0; u += 1.4) {
    b.box(1.25, 0.8, 0.07, '#f4f2ec', s * u, 0.62, BZ); b.box(1.27, 0.2, 0.08, RED, s * u, 0.82, BZ); b.box(1.27, 0.2, 0.08, RED, s * u, 0.46, BZ);
    for (const d of [-0.5, 0.5]) b.box(0.06, 0.25, 0.4, '#3a3d42', s * u + d, 0.12, BZ);
  }
  const beacons: T.MeshBasicMaterial[] = [];
  for (const s of [-1, 1]) {
    b.cone(0.22, 0.6, '#ff7a1a', s * 1.0, 0.3, BZ + 0.3, { seg: 8 }); b.cyl(0.04, 0.04, 1.1, '#3a3d42', s * 1.5, 0.55, BZ);
    const bm = new T.MeshBasicMaterial({ color: '#ffb02e' }); beacons.push(bm); const l = new T.Mesh(new T.SphereGeometry(0.13, 8, 6), bm); l.position.set(s * 1.5, 1.2, BZ); g.add(l);
  }
  // material pile at the usta's start spot: plank stack, brick pallet, cement bags
  const P = y.pile, px = P.u - 1.0, pv = P.v;
  for (let i = 0; i < 4; i++) b.box(1.5, 0.12, 0.5, i % 2 ? WOOD_A : WOOD_B, px, 0.14 + i * 0.12, pv - 0.4);
  b.box(1.1, 0.12, 0.9, '#8a6a4a', px, 0.06, pv + 0.5); for (let i = 0; i < 3; i++) b.box(1.0, 0.18, 0.8, '#b5532f', px, 0.21 + i * 0.18, pv + 0.5);
  for (let i = 0; i < 3; i++) b.box(0.5, 0.18, 0.32, '#c9c4b8', px + 1.1 + (i % 2) * 0.05, 0.1 + i * 0.17, pv - 0.1, { ry: i * 0.2 });
  // hand tools for small and medium jobs on the right side, where big jobs get the crane
  const rx = S / 2 + 1.0;
  if (set.boya) { merdiven(b, rx, 1.4, -Math.PI / 2, 1.8); boyaKovasi(b, rx + 0.1, 2.7, '#e0533c'); boyaKovasi(b, rx + 0.5, 2.9); }
  if (set.elArabasi && !set.kuleVinc && !set.mobilVinc) { elArabasi(b, rx, 1.6, 0.5); kumYigini(b, rx + 0.4, 3.1, 0.7); }
  if (set.mobilVinc || set.kuleVinc) { if (set.jenerator) jenerator(b, S / 2 + 1.8, 3.5, Math.PI / 2); else tuvalet(b, S / 2 + 1.6, 3.4, -Math.PI / 2); }
  const trolley = new T.Group(), cable = new T.Mesh(new T.BoxGeometry(0.03, 1, 0.03), new T.MeshLambertMaterial({ color: '#222' })), load = new T.Mesh(new T.BoxGeometry(1.5, 0.28, 0.6), mA);
  trolley.add(cable, load);
  if (!set.mobilVinc && !set.kuleVinc) { const m0 = b.mesh(solidMat()); g.add(m0); return { id: y.id, g, planks, jib: null, trolley, cable, load, beacons, sign: signMat, ph: y.ox * 0.37 + y.oz * 0.19 }; }
  // tower crane beside the right wing (big jobs only); the jib swings over the site, the hook sways
  const cx = S / 2 + 1.6, cz = 1.5, CH = 9.6;
  b.box(1.5, 0.3, 1.5, '#5b6068', cx, 0.15, cz);
  for (let yy = 0; yy < CH; yy += 1.2) { for (const [ox, oz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) b.box(0.07, 1.25, 0.07, YEL, cx + ox, yy + 0.7, cz + oz); b.box(0.66, 0.05, 0.05, YEL, cx, yy + 1.2, cz - 0.3); b.box(0.66, 0.05, 0.05, YEL, cx, yy + 1.2, cz + 0.3); b.box(0.05, 0.05, 0.66, YEL, cx - 0.3, yy + 1.2, cz); b.box(0.05, 0.05, 0.66, YEL, cx + 0.3, yy + 1.2, cz); b.box(0.05, 1.3, 0.05, YEL, cx, yy + 0.7, cz - 0.3, { rz: 0.5 }); }
  b.box(0.9, 0.9, 0.9, '#e0533c', cx, CH + 0.5, cz);
  const jib = new T.Group(); jib.position.set(cx, CH + 0.55, cz);
  const jb = new Batch(); jb.box(9.2, 0.3, 0.3, YEL, -4.2, 0.45, 0); jb.box(9.2, 0.05, 0.05, '#c9a02a', -4.2, 0.2, 0.28); jb.box(9.2, 0.05, 0.05, '#c9a02a', -4.2, 0.2, -0.28);
  jb.box(2.6, 0.3, 0.3, YEL, 1.5, 0.45, 0); jb.box(1.0, 0.8, 0.7, '#5b6068', 2.4, 0.35, 0); jb.box(0.3, 1.1, 0.3, YEL, 0, 1.0, 0);
  const jm = jb.mesh(solidMat()); jib.add(jm); g.add(jib);
  trolley.position.set(-5, 0.2, 0); jib.add(trolley);
  const cb = new T.MeshBasicMaterial({ color: '#ff3b2e' }); beacons.push(cb); const top = new T.Mesh(new T.SphereGeometry(0.14, 8, 6), cb); top.position.set(0, 1.25, 0); jib.add(top);
  const m = b.mesh(solidMat()); g.add(m);
  return { id: y.id, g, planks, jib, trolley, cable, load, beacons, sign: signMat, ph: y.ox * 0.37 + y.oz * 0.19 };
}

export function createIsletmeInsaat(d: InsaatDeps): InsaatView {
  const sites = new Map<string, Site>(); let t = 0;
  const drop = (s: Site) => {
    s.g.removeFromParent();
    s.g.traverse(o => { const m = o as T.Mesh; m.geometry?.dispose(); const mt = m.material as T.Material | T.Material[] | undefined; if (mt && mt !== solid) for (const x of Array.isArray(mt) ? mt : [mt]) { (x as T.MeshStandardMaterial).map?.dispose(); x.dispose(); } });
  };
  return {
    update(dt) {
      t += dt;
      const root = d.root(), want = root ? d.tadilat() : [];
      for (const [id, s] of sites) if (!root || !want.some(w => w.id === id) || s.g.parent !== root) { drop(s); sites.delete(id); }
      if (!root) return;
      const n = d.night();
      for (const w of want) {
        let s = sites.get(w.id);
        if (!s) { const y = insaatYer(w.id); if (!y) continue; s = buildSite(y, w.lv); root.add(s.g); sites.set(w.id, s); }
        const vis = Math.floor(Math.max(0, Math.min(1, w.p)) * s.planks.length);
        for (let i = 0; i < s.planks.length; i++) { const v = i < vis; if (s.planks[i].visible !== v) s.planks[i].visible = v; }
        const k = t + s.ph;
        if (s.jib) s.jib.rotation.y = Math.sin(k * 0.25) * 0.28;
        s.trolley.position.x = -5.4 + Math.sin(k * 0.4) * 2.2;
        const L = 5.6 + Math.sin(k * 0.55) * 1.1;
        s.cable.scale.y = L; s.cable.position.y = -L / 2; s.load.position.y = -L - 0.15;
        s.trolley.rotation.z = Math.sin(k * 1.3) * 0.05; s.trolley.rotation.x = Math.sin(k * 0.9 + 1) * 0.04;
        s.sign.emissiveIntensity = 0.15 + n * 0.6;
        const on = Math.sin(k * 5) > 0; s.beacons.forEach((b, i) => b.color.set((i % 2 ? on : !on) ? '#ffcf5a' : '#6a4a12'));
      }
    },
    dispose() { for (const s of sites.values()) drop(s); sites.clear(); },
  };
}
