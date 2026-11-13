/**
 * Altın Fırın view (survey altin-5/6/8, koleksiyon-3/6): a glowing little bakery cart at the front-right corner of
 * the pier with a dome oven, gold-striped awning, a glass case showing today's 4 showcase items, the golden shelf
 * (items appear once bought), the Altın Martı heykeli, the wooden kapak panosu (caps collected), and a small
 * 3-medal achievement vitrin on the büfe counter. Tapping the "Altın Fırın" tag opens the Koleksiyon sheet on the
 * Fırın tab. Code-made low-poly meshes, no colliders (decision: it sits in the open pier corner, nav untouched).
 * Reads only (kolApi(rules).view()); writes nothing to the sim, sends a command on tap.
 */
import * as T from 'three';
import { kolApi } from '../../sim/koleksiyon';
import type { Rules } from '../../sim/state';
import type { HtmlLabels, HtmlLabel } from '../../ui/labels';
import { CAP_BRANDS, CAP_KINDS, FIRIN_SHELF } from '../../../content/koleksiyon';

type Vec2 = { x: number; z: number };
type ScreenPt = { x: number; y: number };
export interface AltinFirinDeps {
  scene: T.Object3D; rules: () => Rules | null; labels?: HtmlLabels | null; hero: () => Vec2;
  project?: (p: { x: number; y: number; z: number }, out: ScreenPt) => boolean;
  command: (c: { kind: string; [k: string]: unknown }) => void;
}
export interface AltinFirinView { update(dt: number): void; dispose(): void }

const POS = { x: 7.45, z: 3.45 }, ROT = -0.55;

function signTex(text: string, bg: string, fg: string): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, 256, 64);
  g.strokeStyle = '#7a4a12'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 58);
  g.fillStyle = fg; g.font = '900 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 34, 236);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

export function createAltinFirin(d: AltinFirinDeps): AltinFirinView {
  const root = new T.Group(); root.name = 'altinFirin';
  const geos: T.BufferGeometry[] = [], mats: T.Material[] = [], texs: T.Texture[] = [];
  const G = <X extends T.BufferGeometry>(g: X) => { geos.push(g); return g; };
  const M = <X extends T.Material>(m: X) => { mats.push(m); return m; };
  const L = (color: string, extra: T.MeshLambertMaterialParameters = {}) => M(new T.MeshLambertMaterial({ color, ...extra }));
  const box = (w: number, h: number, dd: number, m: T.Material, x: number, y: number, z: number, p: T.Object3D = cart) => { const o = new T.Mesh(G(new T.BoxGeometry(w, h, dd)), m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };

  const cart = new T.Group(); root.add(cart);
  const gold = L('#f2b632', { emissive: '#6a4300', emissiveIntensity: 0.35 });
  const cream = L('#fff3d6'), wood = L('#9a6a42'), ink = L('#3b2a20');
  // body + gold trim + wheels
  box(1.3, 0.82, 0.78, cream, 0, 0.53, 0);
  box(1.36, 0.08, 0.84, gold, 0, 0.96, 0);
  box(1.36, 0.06, 0.84, gold, 0, 0.14, 0);
  const wheelG = G(new T.CylinderGeometry(0.17, 0.17, 0.06, 14));
  for (const sx of [-0.45, 0.45]) { const w = new T.Mesh(wheelG, wood); w.rotation.x = Math.PI / 2; w.position.set(sx, 0.17, 0.42); cart.add(w); }
  // glass case on the counter with today's 4 items
  const glass = M(new T.MeshLambertMaterial({ color: '#d8f0f6', transparent: true, opacity: 0.32, depthWrite: false }));
  const caseM = box(1.0, 0.3, 0.36, glass, -0.08, 1.15, 0.12); caseM.castShadow = false; caseM.renderOrder = 2;
  const showG = G(new T.TorusGeometry(0.075, 0.035, 8, 14));
  const showMats = [0, 1, 2, 3].map(() => L('#f2b632', { emissive: '#3a2400', emissiveIntensity: 0.3 }));
  const showItems = showMats.map((m, i) => { const o = new T.Mesh(showG, m); o.rotation.x = -1.1; o.position.set(-0.45 + i * 0.245, 1.1, 0.12); cart.add(o); return o; });
  // dome oven with a glowing mouth
  const dome = new T.Mesh(G(new T.SphereGeometry(0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), L('#d9822b', { emissive: '#4a1a00', emissiveIntensity: 0.25 }));
  dome.position.set(0.45, 1.0, -0.12); cart.add(dome);
  const glowM = M(new T.MeshBasicMaterial({ color: '#ffb347' }));
  const mouth = new T.Mesh(G(new T.CircleGeometry(0.13, 14, 0, Math.PI)), glowM); mouth.position.set(0.45, 1.0, 0.215); cart.add(mouth);
  const chim = new T.Mesh(G(new T.CylinderGeometry(0.05, 0.06, 0.32, 8)), ink); chim.position.set(0.55, 1.42, -0.2); cart.add(chim);
  // awning posts + gold/white stripes
  for (const sx of [-0.62, 0.62]) box(0.05, 0.95, 0.05, wood, sx, 1.45, 0.36);
  for (const sx of [-0.62, 0.62]) box(0.05, 1.15, 0.05, wood, sx, 1.55, -0.36);
  const white = L('#fffaf0');
  for (let i = 0; i < 7; i++) { const s = box(0.2, 0.04, 0.92, i % 2 ? white : gold, -0.6 + i * 0.2, 2.02, 0); s.rotation.x = -0.22; }
  // sign
  const tOpen = signTex('ALTIN FIRIN', '#fff3c4', '#b7811a'); texs.push(tOpen);
  const tSoon = signTex('YAKINDA', '#e9e2d0', '#7a6a5a'); texs.push(tSoon);
  const signM = M(new T.MeshBasicMaterial({ map: tOpen }));
  const sign = new T.Mesh(G(new T.PlaneGeometry(1.2, 0.3)), signM); sign.position.set(0, 2.3, 0.4); sign.rotation.x = -0.12; cart.add(sign);
  // closed shutter (kepenk) over the case until the Fırın opens
  const shutter = box(1.2, 0.5, 0.04, L('#a9b1b7'), 0, 1.25, 0.34);
  // golden shelf on the left side: one shape per FIRIN_SHELF item
  const shelf = new T.Group(); shelf.position.set(-0.69, 0, 0); shelf.rotation.y = -Math.PI / 2; cart.add(shelf);
  box(0.74, 0.04, 0.16, wood, 0, 0.62, 0.08, shelf); box(0.74, 0.04, 0.16, wood, 0, 0.36, 0.08, shelf);
  const ghost = M(new T.MeshLambertMaterial({ color: '#d9cfb8', transparent: true, opacity: 0.35 }));
  const shelfShapes: Record<string, T.Mesh> = {};
  const shapeFor = (id: string): T.BufferGeometry => {
    switch (id) {
      case 'altin_cay_ocagi': return G(new T.CylinderGeometry(0.06, 0.08, 0.12, 10));
      case 'altin_kask': return G(new T.SphereGeometry(0.075, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2));
      case 'altin_marti_heykel': return G(new T.ConeGeometry(0.06, 0.15, 6));
      case 'altin_tezgah': return G(new T.BoxGeometry(0.16, 0.07, 0.08));
      case 'altin_kedi_kabi': return G(new T.CylinderGeometry(0.07, 0.05, 0.05, 12));
      default: return G(new T.CylinderGeometry(0.02, 0.02, 0.18, 6));
    }
  };
  FIRIN_SHELF.forEach((it, i) => { const o = new T.Mesh(shapeFor(it.id), ghost); o.position.set(-0.24 + (i % 3) * 0.24, i < 3 ? 0.7 : 0.44, 0.08); shelf.add(o); shelfShapes[it.id] = o; });
  // Altın Martı heykeli (visible once bought)
  const statue = new T.Group(); statue.position.set(-0.95, 0, 0.55); root.add(statue);
  { const ped = new T.Mesh(G(new T.CylinderGeometry(0.2, 0.24, 0.5, 10)), cream); ped.position.y = 0.25; statue.add(ped);
    const body = new T.Mesh(G(new T.SphereGeometry(0.16, 12, 8)), gold); body.scale.set(1.3, 0.85, 0.9); body.position.y = 0.68; statue.add(body);
    const head = new T.Mesh(G(new T.SphereGeometry(0.09, 10, 8)), gold); head.position.set(0.16, 0.84, 0); statue.add(head);
    const beak = new T.Mesh(G(new T.ConeGeometry(0.03, 0.1, 6)), L('#e8a92a', { emissive: '#5a3a00', emissiveIntensity: 0.4 })); beak.rotation.z = -Math.PI / 2; beak.position.set(0.28, 0.83, 0); statue.add(beak);
    for (const s of [-1, 1]) { const wg = new T.Mesh(G(new T.BoxGeometry(0.26, 0.03, 0.14)), gold); wg.position.set(-0.02, 0.76, s * 0.14); wg.rotation.x = s * 0.6; statue.add(wg); } }
  statue.visible = false;
  // kapak panosu: wooden board on two legs with 12 x 3 caps
  const board = new T.Group(); board.position.set(0.95, 0, 0.35); board.rotation.y = -0.25; root.add(board);
  box(0.06, 1.3, 0.06, wood, -0.42, 0.65, 0, board); box(0.06, 1.3, 0.06, wood, 0.42, 0.65, 0, board);
  box(0.92, 0.78, 0.05, L('#b98a5c'), 0, 1.0, 0.02, board);
  const tCap = signTex('KAPAK PANOSU', '#fff6e6', '#7a4a12'); texs.push(tCap);
  const capSign = new T.Mesh(G(new T.PlaneGeometry(0.8, 0.16)), M(new T.MeshBasicMaterial({ map: tCap }))); capSign.position.set(0, 1.48, 0.05); board.add(capSign);
  const capG = G(new T.CylinderGeometry(0.03, 0.03, 0.012, 10));
  const capEmpty = M(new T.MeshLambertMaterial({ color: '#8f6a45' }));
  const capMats: Record<string, T.Material> = {};
  const capMesh: Record<string, T.Mesh> = {};
  CAP_BRANDS.forEach((b, bi) => CAP_KINDS.forEach((k, ki) => {
    capMats[b.id + ':' + k.id] = k.id === 'a' ? gold : (k.id === 'o' ? L(b.ink === '#fff' ? b.color : b.ink) : L(b.color));
    const o = new T.Mesh(capG, capEmpty); o.rotation.x = Math.PI / 2;
    o.position.set(-0.36 + (bi % 6) * 0.144, 1.26 - Math.floor(bi / 6) * 0.3 - ki * 0.085, 0.055); board.add(o); capMesh[b.id + ':' + k.id] = o;
  }));
  // sparkles
  const sparkM = M(new T.MeshBasicMaterial({ color: '#fff6a0', transparent: true, opacity: 0.9, depthWrite: false }));
  const sparkG = G(new T.OctahedronGeometry(0.035, 0));
  const sparks = [0, 1, 2, 3, 4].map(() => { const s = new T.Mesh(sparkG, sparkM); root.add(s); return s; });
  root.position.set(POS.x, 0, POS.z); root.rotation.y = ROT;
  d.scene.add(root);

  // the 3-medal vitrin on the büfe counter (koleksiyon-6)
  const vit = new T.Group(); vit.name = 'basarimVitrini';
  const vb = new T.Mesh(G(new T.BoxGeometry(0.36, 0.17, 0.03)), wood); vb.position.y = 0.11; vb.rotation.x = -0.25; vit.add(vb);
  const leg = new T.Mesh(G(new T.BoxGeometry(0.04, 0.12, 0.04)), wood); leg.position.set(0, 0.06, -0.04); vit.add(leg);
  const medalG = G(new T.CylinderGeometry(0.04, 0.04, 0.012, 12));
  const ribbonG = G(new T.BoxGeometry(0.03, 0.05, 0.006));
  const ribbonM = [L('#e0533c'), L('#2f7fb3'), L('#7bd389')];
  const medals = [0, 1, 2].map(i => { const g = new T.Group(); const m = new T.Mesh(medalG, gold); m.rotation.x = Math.PI / 2 - 0.25; m.position.y = 0.1; const r = new T.Mesh(ribbonG, ribbonM[i]); r.position.y = 0.16; r.rotation.x = -0.25; g.add(r, m); g.position.set(-0.11 + i * 0.11, 0, 0.022); vit.add(g); return g; });
  vit.visible = false;
  d.scene.add(vit);

  const label: HtmlLabel | null = d.labels ? d.labels.label() : null;
  if (label) label.onTap = () => { try { d.command({ kind: 'koleksiyon', op: 'open', id: 'firin' }); } catch (e) { console.warn('[altinFirin] tap', e); } };
  const tmp: ScreenPt = { x: 0, y: 0 };
  const wp = new T.Vector3();

  let t = 0, poll = 0, open = false, key = '', vitKey = '';
  return {
    update(dt) {
      t += dt;
      const r = d.rules();
      const api = kolApi(r);
      if ((poll -= dt) <= 0 && api && r) {
        poll = 0.3;
        const v = api.view();
        const k = JSON.stringify(v);
        if (k !== key) {
          key = k; open = v.open;
          shutter.visible = !open; signM.map = open ? tOpen : tSoon; signM.needsUpdate = true;
          showItems.forEach((o, i) => { o.visible = open; (showMats[i] as T.MeshLambertMaterial).color.set(v.showcase[i] || '#f2b632'); });
          for (const it of FIRIN_SHELF) shelfShapes[it.id].material = v.shelf.includes(it.id) ? gold : ghost;
          statue.visible = v.shelf.includes('altin_marti_heykel');
          for (const id of Object.keys(capMesh)) capMesh[id].material = v.caps.includes(id) ? capMats[id] : capEmpty;
          medals.forEach((m, i) => { m.visible = i < v.vitrin.length; });
          vit.visible = v.vitrin.length > 0;
        }
        const c = r.rt.layout.counter, vk = c.pos.x + ',' + c.pos.z + ',' + c.drop.y;
        if (vk !== vitKey) { vitKey = vk; vit.position.set(c.pos.x + 0.62, c.drop.y, c.pos.z + 0.08); }
      }
      // glow pulse + floating showcase + sparkles
      const pulse = 0.6 + 0.4 * Math.sin(t * 2.4);
      glowM.color.setRGB(1, 0.55 + 0.25 * pulse, 0.2 + 0.15 * pulse);
      (gold as T.MeshLambertMaterial).emissiveIntensity = open ? 0.3 + 0.2 * pulse : 0.15;
      showItems.forEach((o, i) => { o.rotation.z = t * 0.8 + i; o.position.y = 1.1 + Math.sin(t * 2 + i) * 0.015; });
      sparks.forEach((s, i) => {
        s.visible = open;
        const a = t * 0.7 + i * 1.256;
        s.position.set(Math.cos(a) * 0.85, 1.4 + Math.sin(t * 1.6 + i) * 0.35, Math.sin(a) * 0.55);
        s.rotation.y = t * 2 + i; const k = 0.6 + 0.4 * Math.sin(t * 3 + i * 2); s.scale.setScalar(k);
      });
      // tappable tag when Sabri is around
      if (label && d.project) {
        const h = d.hero();
        const near = Math.hypot(h.x - POS.x, h.z - POS.z) < 9 && !!r && r.rt.started;
        if (near) {
          root.localToWorld(wp.set(0, 2.65, 0.2));
          if (d.project({ x: wp.x, y: wp.y, z: wp.z }, tmp)) label.set(tmp.x, tmp.y, `<div class="say">Altın Fırın<br><small>${open ? 'Vitrine bak!' : 'Seviye 8\'de açılır'}</small></div>`, 'say tap');
          else label.hide();
        } else label.hide();
      }
    },
    dispose() {
      root.removeFromParent(); vit.removeFromParent();
      if (label) label.free();
      for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const x of texs) x.dispose();
    },
  };
}
