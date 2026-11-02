/**
 * Stadyum Mahallesi: bilet gişesi, kulüp odası, tribündeki taraftarlar ve kulüp pankartı (2026-11-02). Pure view:
 * reads mulkApi(rules).model() (takim, stad). Before the club exists the office is a grey "kulüp kurma ofisi" and the
 * stand is nearly empty; once founded the building, awnings, scarves, banner and the crowd take the club colours and the
 * crowd size follows the gate (stad.doluluk / tahmin). Boxes and canvas textures only, no placeholders.
 */
import * as T from 'three';
import type { Rules } from '../../sim/state';
import { mulkApi } from '../../sim/mulk';
import type { Vec3, ScreenPt } from '../../../engine/api';
import type { HtmlLabels } from '../../ui/labels';

export interface StadyumViewDeps { scene: T.Scene; labels: HtmlLabels; project(p: Vec3, out: ScreenPt): boolean; rules: () => Rules | null; hero: () => { x: number; z: number }; setSolid?: (r: { x0: number; x1: number; z0: number; z1: number }[]) => void }
export interface StadyumView { update(dt: number): void; dispose(): void }
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const OFIS = { x: 417, z: 8.5, w: 8, d: 5 }, GISE = { x: 404.5, z: 9, w: 3.2, d: 2.2 };
const ROWS = 4, COLS = 28, SEATS = ROWS * COLS;

export function createStadyumView(d: StadyumViewDeps): StadyumView {
  const geos: T.BufferGeometry[] = [], mats: T.Material[] = [], texs: T.Texture[] = [];
  const G = <X extends T.BufferGeometry>(g: X) => (geos.push(g), g);
  const M = (c: string, extra: T.MeshStandardMaterialParameters = {}) => { const m = new T.MeshStandardMaterial({ color: c, roughness: 0.78, metalness: 0.04, ...extra }); mats.push(m); return m; };
  const root = new T.Group(); root.name = 'stadyum-kulup'; d.scene.add(root);
  const box = (p: T.Object3D, w: number, h: number, dd: number, m: T.Material, x: number, y: number, z: number) => { const o = new T.Mesh(G(new T.BoxGeometry(w, h, dd)), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; p.add(o); return o; };
  const tmp: ScreenPt = { x: 0, y: 0 }, at: Vec3 = { x: 0, y: 0, z: 0 };

  /** Painted crest plate: club colours, crest emoji and name. */
  function plate(w: number, h: number, c1: string, c2: string, arma: string, name: string): THREE_Tex {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * h / w); const g = cv.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, cv.width, 0); gr.addColorStop(0, c1); gr.addColorStop(0.5, c1); gr.addColorStop(0.5, c2); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = 'rgba(255,255,255,.14)'; for (let i = -2; i < 12; i++) g.fillRect(i * 64, 0, 28, cv.height);
    g.font = `${cv.height * 0.62}px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif`; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(arma, cv.height * 0.62, cv.height / 2 + 4);
    g.font = `900 ${cv.height * 0.34}px system-ui,sans-serif`; g.textAlign = 'left'; g.lineWidth = 8; g.strokeStyle = 'rgba(10,18,36,.85)'; g.strokeText(name, cv.height * 1.2, cv.height / 2, cv.width - cv.height * 1.3); g.fillStyle = '#fff'; g.fillText(name, cv.height * 1.2, cv.height / 2, cv.width - cv.height * 1.3);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; texs.push(t); return t;
  }
  type THREE_Tex = T.CanvasTexture;

  // ---- dynamic club parts, rebuilt when the club record changes
  const dyn = new T.Group(); root.add(dyn);
  let key = '#';
  const labGise = d.labels.label(), labOfis = d.labels.label();

  // ---- crowd (instanced, follows occupancy and club colours)
  const bodyG = G(new T.BoxGeometry(0.42, 0.55, 0.3)), headG = G(new T.SphereGeometry(0.17, 8, 6));
  const bodyM = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), headM = new T.MeshStandardMaterial({ color: '#e7b48a', roughness: 0.8 }); mats.push(bodyM, headM);
  const bodies = new T.InstancedMesh(bodyG, bodyM, SEATS), heads = new T.InstancedMesh(headG, headM, SEATS);
  bodies.castShadow = true; root.add(bodies, heads);
  const seat = (i: number) => { const r = Math.floor(i / COLS), c = i % COLS; return { x: 426 - (-13.5 + c * (27 / (COLS - 1))), y: 0.5 + r * 0.5, z: 30.2 + r * 1.0 }; };
  const sway = new Float32Array(SEATS).map((_, i) => ((i * 2654435761) >>> 0) / 4294967296 * 6.28);
  const hide = new T.Matrix4().makeScale(0, 0, 0), m4 = new T.Matrix4(), col = new T.Color();
  let fans = 0, tt = 0;
  const neutral = ['#d8d2c4', '#8aa0b8', '#b88a6a', '#c9c0d8', '#7a8a70'];
  function paintCrowd(n: number, c1: string, c2: string, club: boolean) {
    fans = n; const order = Array.from({ length: SEATS }, (_, i) => i).sort((a, b) => ((Math.sin(a * 12.9898) * 43758.5453) % 1) - ((Math.sin(b * 12.9898) * 43758.5453) % 1));
    for (let k = 0; k < SEATS; k++) {
      const i = order[k]; if (k >= n) { bodies.setMatrixAt(i, hide); heads.setMatrixAt(i, hide); continue; }
      const r = Math.sin(i * 7.31) * 0.5 + 0.5; col.set(club ? (r < 0.55 ? c1 : r < 0.8 ? c2 : neutral[i % neutral.length]) : neutral[i % neutral.length]); bodies.setColorAt(i, col);
    }
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true; crowdOrder = order;
  }
  let crowdOrder: number[] = [];

  function build(t: { ad: string; renk: string; renk2?: string; arma?: string } | null, doluluk: number) {
    dyn.clear();
    const c1 = t ? t.renk : '#9aa3ad', c2 = t ? t.renk2 || '#f2c230' : '#c8ced6', arma = t ? t.arma || '🛡️' : '❓', name = t ? t.ad : 'KULÜP KURMA OFİSİ';
    // club office
    const o = new T.Group(); o.position.set(OFIS.x, 0, OFIS.z); dyn.add(o);
    box(o, OFIS.w + 0.8, 0.2, OFIS.d + 0.8, M('#b9b4aa'), 0, 0.1, 0);
    box(o, OFIS.w, 3.2, OFIS.d, M(c1), 0, 1.8, 0);
    box(o, OFIS.w + 0.5, 0.35, OFIS.d + 0.5, M(c2), 0, 3.55, 0);
    box(o, 3.0, 2.0, 0.1, M('#1b2a40', { transparent: true, opacity: 0.8, roughness: 0.2, metalness: 0.3 }), -2.2, 1.6, OFIS.d / 2 + 0.03);
    box(o, 1.3, 2.3, 0.15, M('#2a2018'), 1.0, 1.25, OFIS.d / 2 + 0.05);
    const sign = box(o, 6.4, 1.1, 0.14, new T.MeshStandardMaterial({ map: plate(6.4, 1.1, c1, c2, arma, name.toUpperCase()), roughness: 0.5, emissive: new T.Color('#ffffff'), emissiveMap: null, emissiveIntensity: 0 }), 0, 4.3, OFIS.d / 2 + 0.2);
    mats.push(sign.material as T.Material);
    for (const sx of [-1, 1]) { const p = new T.Mesh(G(new T.CylinderGeometry(0.06, 0.06, 5.6, 8)), M('#cfd4da')); p.position.set(sx * (OFIS.w / 2 + 0.6), 2.8, OFIS.d / 2 + 0.6); o.add(p); box(o, 1.5, 0.9, 0.04, M(sx < 0 ? c1 : c2, { side: T.DoubleSide }), sx * (OFIS.w / 2 + 1.4), 5.0, OFIS.d / 2 + 0.6); }
    if (t) { for (let i = 0; i < 3; i++) box(o, 0.5, 0.7, 0.05, M(i % 2 ? c1 : c2), -3.2 + i * 0.7, 2.9, OFIS.d / 2 + 0.1); }   // scarves on the façade
    // ticket booth
    const b = new T.Group(); b.position.set(GISE.x, 0, GISE.z); dyn.add(b);
    box(b, GISE.w + 0.4, 0.15, GISE.d + 0.4, M('#b9b4aa'), 0, 0.08, 0);
    box(b, GISE.w, 2.4, GISE.d, M('#f1ece0'), 0, 1.35, 0);
    box(b, GISE.w + 0.3, 0.2, GISE.d + 0.3, M(c1), 0, 2.65, 0);
    box(b, 1.6, 0.9, 0.08, M('#1b2a40', { transparent: true, opacity: 0.75, roughness: 0.2 }), 0, 1.7, GISE.d / 2 + 0.03);
    box(b, 1.9, 0.12, 0.45, M('#8a6a4a'), 0, 1.15, GISE.d / 2 + 0.25);
    for (let i = 0; i < 8; i++) { const s = box(b, 0.4, 0.12, 1.6, M(i % 2 ? c1 : '#fbfaf6'), -1.4 + i * 0.4, 2.35, GISE.d / 2 + 0.5); s.rotation.x = 0.35; }
    box(b, 2.6, 0.5, 0.1, new T.MeshStandardMaterial({ map: plate(2.6, 0.5, '#101c3a', '#16284c', '🎟️', 'BİLET'), roughness: 0.5 }), 0, 3.1, GISE.d / 2 + 0.1);
    for (const sx of [-0.9, 0, 0.9]) { box(b, 0.08, 0.9, 0.08, M('#c9a23a'), sx, 0.45, GISE.d / 2 + 1.7); }   // queue posts
    box(b, 1.9, 0.05, 0.05, M('#a02a2a'), 0, 0.85, GISE.d / 2 + 1.7);
    // banner along the stand roof edge + scarf garland
    const ban = new T.Mesh(G(new T.PlaneGeometry(11, 1.1)), new T.MeshStandardMaterial({ map: plate(11, 1.1, c1, c2, arma, name.toUpperCase()), roughness: 0.6, side: T.DoubleSide })); mats.push(ban.material as T.Material);
    ban.position.set(426, 2.5, 33.95); ban.rotation.y = Math.PI; dyn.add(ban);
    const gar = 18; for (let i = 0; i < gar; i++) box(dyn, 0.7, 0.4, 0.06, M(i % 2 ? c1 : c2), 411.5 + i * (29 / gar), 0.3, 29.64);
    paintCrowd(Math.round(SEATS * (t ? Math.max(0.25, doluluk) : 0.08)), c1, c2, !!t);
    d.setSolid?.([{ x0: OFIS.x - OFIS.w / 2, x1: OFIS.x + OFIS.w / 2, z0: OFIS.z - OFIS.d / 2, z1: OFIS.z + OFIS.d / 2 }, { x0: GISE.x - GISE.w / 2, x1: GISE.x + GISE.w / 2, z0: GISE.z - GISE.d / 2, z1: GISE.z + GISE.d / 2 }]);
  }
  const put = (lb: ReturnType<HtmlLabels['label']>, x: number, y: number, z: number, html: string) => { at.x = x; at.y = y; at.z = z; if (d.project(at, tmp)) lb.set(tmp.x, tmp.y, html, 'say'); else lb.hide(); };

  return {
    update(dt) {
      const h = d.hero(), near = h.x > 380 && h.x < 465; root.visible = near;
      if (!near) { labGise.hide(); labOfis.hide(); return; }
      tt += dt;
      const rl = d.rules(), api = rl ? mulkApi(rl) : null, md = api ? api.model() as unknown as { takim: { ad: string; renk: string; renk2?: string; arma?: string } | null; stad: { fiyat: number; tahmin: number; doluluk: number } | null } : null;
      const t = md?.takim ?? null, dol = md?.stad ? (md.stad.doluluk || md.stad.tahmin) : 0;
      const k = t ? [t.ad, t.renk, t.renk2, t.arma, Math.round(dol * 20)].join('|') : 'yok';
      if (k !== key) { key = k; build(t, dol); }
      // crowd sway: seated fans bob and cheer a little
      for (let k2 = 0; k2 < fans; k2++) {
        const i = crowdOrder[k2], s = seat(i), a = Math.sin(tt * 2.2 + sway[i]), up = Math.max(0, Math.sin(tt * 1.1 + sway[i] * 3)) > 0.93 ? 0.25 : 0;
        m4.makeTranslation(s.x, s.y + 0.28 + a * 0.015 + up, s.z); bodies.setMatrixAt(i, m4);
        m4.makeTranslation(s.x, s.y + 0.72 + a * 0.02 + up, s.z); heads.setMatrixAt(i, m4);
      }
      bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
      const st = md?.stad;
      if (Math.hypot(h.x - GISE.x, h.z - GISE.z) < 24) put(labGise, GISE.x, 4.2, GISE.z + 1, st ? '🎟️ BİLET ' + st.fiyat.toLocaleString('tr') + ' ₺ · doluluk %' + Math.round(st.tahmin * 100) : '🎟️ Bilet gişesi (önce kulüp kur)'); else labGise.hide();
      if (Math.hypot(h.x - OFIS.x, h.z - OFIS.z) < 24) put(labOfis, OFIS.x, 6.3, OFIS.z + OFIS.d / 2 + 0.6, t ? esc((t.arma || '🛡️') + ' ' + t.ad) + ' · Kulüp Odası' : '🛡️ Kulüp kurma ofisi · Mülk > Stadyum'); else labOfis.hide();
    },
    dispose() { root.removeFromParent(); geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); texs.forEach(x => x.dispose()); labGise.hide(); labOfis.hide(); },
  };
}
