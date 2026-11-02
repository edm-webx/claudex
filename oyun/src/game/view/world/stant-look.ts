/**
 * Faz 2 stand + adisyon view. Reads restoranApi(rules).view() 5x per second:
 *  - owned stands: a low-poly stand per look (midye tepsisi, ıslak fanus, mısır arabası, kokoreç, dondurma, kumpir)
 *    with a coloured sign (name + price), food that shrinks with the stock and a "BİTTİ" board when empty;
 *  - buyable stands are drawn as normal yellow pads by rtview (money fills them, like every unit);
 *  - open tickets: a numbered plate floating over the table, red when the ticket is late.
 * Code-made meshes, no colliders. Reads only.
 */
import * as T from 'three';
import { restoranApi, type StantView } from '../../sim/restoran';
import type { Rules } from '../../sim/state';
import { fmtTL } from '../../../content/ekonomi2';

export interface StantLookDeps { scene: T.Object3D; rules: () => Rules | null }
export interface StantLookView { update(dt: number): void; dispose(): void }

function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
function signTex(title: string, sub: string, bg: string): T.CanvasTexture {
  return tex(256, 96, g => {
    g.fillStyle = bg; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#fff3c4'; g.lineWidth = 6; g.strokeRect(5, 5, 246, 86);
    g.fillStyle = '#fff'; g.font = '900 40px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(title, 128, 38, 236); g.fillStyle = '#ffd23f'; g.font = '900 26px system-ui, sans-serif'; g.fillText(sub, 128, 74, 236);
  });
}
const L = (c: string) => new T.MeshLambertMaterial({ color: c });

interface StandObj { root: T.Group; food: T.Object3D[]; bitti: T.Mesh; sig: string; signMat: T.MeshLambertMaterial }

export function createStantLook(d: StantLookDeps): StantLookView {
  const root = new T.Group(); root.name = 'stantlar'; d.scene.add(root);
  const geos: T.BufferGeometry[] = [], mats: T.Material[] = [], texs: T.Texture[] = [];
  const G = <X extends T.BufferGeometry>(g: X) => { geos.push(g); return g; };
  const M = <X extends T.Material>(m: X) => { mats.push(m); return m; };
  const wood = M(L('#8a5a3b')), metal = M(L('#b9c2c9')), ink = M(L('#3b2a20')), white = M(L('#f4efe6'));
  const box = G(new T.BoxGeometry(1, 1, 1)), cyl = G(new T.CylinderGeometry(0.5, 0.5, 1, 12)), sph = G(new T.SphereGeometry(0.5, 10, 8));
  const mesh = (g: T.BufferGeometry, m: T.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
    const o = new T.Mesh(g, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); return o;
  };
  const bittiTex = tex(128, 48, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 48); g.strokeStyle = '#c0392b'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 42); g.fillStyle = '#c0392b'; g.font = '900 30px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BİTTİ', 64, 26); });
  texs.push(bittiTex);
  const bittiMat = M(new T.MeshLambertMaterial({ map: bittiTex }));

  function build(v: StantView): StandObj {
    const g = new T.Group(); const food: T.Object3D[] = [];
    const custom = v.look === 'misir' || v.look === 'kestane';
    const color = M(L(v.color));
    const top = (o: T.Object3D) => { food.push(o); g.add(o); };
    if (!custom) {
      // base table + legs (all stands share it)
      g.add(mesh(box, wood, 1.05, 0.08, 0.6, 0, 0.82, 0));
      for (const [x, z] of [[-0.46, -0.24], [0.46, -0.24], [-0.46, 0.24], [0.46, 0.24]]) g.add(mesh(box, ink, 0.05, 0.8, 0.05, x, 0.4, z));
      g.add(mesh(box, color, 1.07, 0.3, 0.04, 0, 0.66, 0.3));
    }
    switch (v.look) {
      case 'midye': {
        g.add(mesh(cyl, metal, 0.8, 0.04, 0.5, 0, 0.88, 0));
        const sh = M(L('#22252b')), lem = M(L('#f4d03f'));
        for (let i = 0; i < 12; i++) top(mesh(sph, sh, 0.11, 0.06, 0.07, -0.3 + (i % 6) * 0.12, 0.92, -0.1 + Math.floor(i / 6) * 0.2));
        g.add(mesh(sph, lem, 0.1, 0.1, 0.1, 0.36, 0.94, 0.12));
        break;
      }
      case 'islak': {
        const glass = M(new T.MeshLambertMaterial({ color: '#dff3fa', transparent: true, opacity: 0.35, depthWrite: false }));
        const bun = M(L('#d9a066'));
        for (let i = 0; i < 6; i++) top(mesh(cyl, bun, 0.15, 0.08, 0.15, -0.26 + (i % 3) * 0.26, 0.92 + Math.floor(i / 3) * 0.1, 0));
        g.add(mesh(box, glass, 0.9, 0.42, 0.46, 0, 1.08, 0));
        break;
      }
      case 'misir': {
        // 2026-10-25 user: the old cart looked awful. A proper street corn cart: red body, big wheels, steaming pot, cobs in a tray, striped umbrella.
        const red = M(L('#c0392b')), cream = M(L('#fff3d6')), yel = M(L('#f4c20d')), steel = M(L('#c9d1d6')), dk = M(L('#2f2a26')), green = M(L('#5aa45a')), corn = M(L('#f6cf2a'));
        g.add(mesh(box, red, 1.25, 0.55, 0.72, 0, 0.72, 0));
        g.add(mesh(box, cream, 1.27, 0.07, 0.74, 0, 0.98, 0));                      // cream trim
        g.add(mesh(box, wood, 1.34, 0.06, 0.8, 0, 1.04, 0));                        // counter top
        g.add(mesh(box, yel, 1.0, 0.16, 0.02, 0, 0.7, 0.37));                       // front plate
        for (const x of [-0.62, 0.62]) { const w = mesh(cyl, dk, 0.62, 0.07, 0.62, x, 0.31, 0.1); w.rotation.z = Math.PI / 2; g.add(w); const hub = mesh(cyl, steel, 0.2, 0.09, 0.2, x, 0.31, 0.1); hub.rotation.z = Math.PI / 2; g.add(hub); }
        g.add(mesh(box, dk, 0.06, 0.06, 0.5, 0.0, 0.46, -0.55));                    // pull handle
        g.add(mesh(cyl, steel, 0.52, 0.34, 0.52, -0.33, 1.24, 0.02));              // steaming pot
        g.add(mesh(sph, steel, 0.54, 0.16, 0.54, -0.33, 1.42, 0.02));              // lid
        g.add(mesh(sph, dk, 0.08, 0.06, 0.08, -0.33, 1.51, 0.02));
        g.add(mesh(box, M(L('#8a5a3b')), 0.52, 0.06, 0.52, 0.34, 1.1, 0.04));       // cob tray
        for (let i = 0; i < 6; i++) { const cx = 0.17 + (i % 3) * 0.17, cz = -0.08 + Math.floor(i / 3) * 0.22; const c = mesh(cyl, corn, 0.11, 0.34, 0.11, cx, 1.2, cz); c.rotation.z = Math.PI / 2; c.rotation.y = 0.15 * (i % 2 ? 1 : -1); top(c); const h = mesh(cyl, green, 0.12, 0.1, 0.12, cx + 0.2, 1.2, cz); h.rotation.z = Math.PI / 2; top(h); }
        g.add(mesh(cyl, dk, 0.03, 1.55, 0.03, 0.3, 1.8, -0.2));                    // umbrella pole
        const um = G(new T.ConeGeometry(0.5, 1, 12));
        g.add(mesh(um, yel, 1.35, 0.3, 1.35, 0.3, 2.45, -0.2));
        g.add(mesh(um, red, 0.86, 0.3, 0.86, 0.3, 2.47, -0.2));
        g.add(mesh(sph, dk, 0.08, 0.08, 0.08, 0.2, 2.65, -0.28));
        break;
      }
      case 'kestane': {
        // roasted chestnut cart: dark cart, copper brazier with glowing coals, chestnuts on the grill, paper cones, burgundy striped awning
        const bark = M(L('#4a2e1a')), copper = M(L('#b8733a')), coal = M(new T.MeshBasicMaterial({ color: '#ff6a1a' })), nut = M(L('#6b3a1f')), nut2 = M(L('#8a4a24')), paper = M(L('#f3e6c8')), bur = M(L('#8e2a2a')), cr = M(L('#fff0d2')), dk = M(L('#2f2a26')), steel = M(L('#b9c2c9'));
        g.add(mesh(box, bark, 1.25, 0.55, 0.72, 0, 0.72, 0));
        g.add(mesh(box, M(L('#6b4226')), 1.3, 0.06, 0.78, 0, 1.0, 0));
        g.add(mesh(box, copper, 1.0, 0.1, 0.02, 0, 0.7, 0.37));
        for (const x of [-0.62, 0.62]) { const w = mesh(cyl, dk, 0.6, 0.07, 0.6, x, 0.3, 0.1); w.rotation.z = Math.PI / 2; g.add(w); const hub = mesh(cyl, copper, 0.2, 0.09, 0.2, x, 0.3, 0.1); hub.rotation.z = Math.PI / 2; g.add(hub); }
        g.add(mesh(cyl, copper, 0.56, 0.3, 0.56, -0.28, 1.17, 0));                  // brazier bowl
        g.add(mesh(cyl, coal, 0.46, 0.02, 0.46, -0.28, 1.33, 0));                   // glowing coals
        g.add(mesh(box, steel, 0.5, 0.02, 0.5, -0.28, 1.37, 0));                    // grill plate
        for (let i = 0; i < 9; i++) top(mesh(sph, i % 2 ? nut : nut2, 0.1, 0.075, 0.12, -0.46 + (i % 3) * 0.17, 1.42, -0.17 + Math.floor(i / 3) * 0.17));
        g.add(mesh(cyl, dk, 0.07, 0.9, 0.07, -0.52, 1.8, -0.28));                    // chimney
        g.add(mesh(cyl, dk, 0.14, 0.05, 0.14, -0.52, 2.27, -0.28));
        const cone = G(new T.ConeGeometry(0.5, 1, 8));
        for (let i = 0; i < 4; i++) g.add(mesh(cone, paper, 0.16, 0.26, 0.16, 0.3 + (i % 2) * 0.2, 1.16, -0.1 + Math.floor(i / 2) * 0.2));
        g.add(mesh(box, M(L('#f4efe6')), 0.34, 0.02, 0.5, 0.4, 1.04, 0.0));
        for (const x of [-0.6, 0.6]) g.add(mesh(cyl, dk, 0.03, 1.2, 0.03, x, 1.6, 0.34));   // awning posts
        for (let i = 0; i < 6; i++) g.add(mesh(box, i % 2 ? cr : bur, 0.21, 0.05, 0.95, -0.52 + i * 0.208, 2.2 - 0.02, 0.02));   // striped canopy
        for (let i = 0; i < 6; i++) g.add(mesh(box, i % 2 ? cr : bur, 0.21, 0.14, 0.04, -0.52 + i * 0.208, 2.1, 0.5));          // valance
        break;
      }
      case 'kokorec': {
        g.add(mesh(box, metal, 0.9, 0.06, 0.4, 0, 0.88, 0));
        const kk = M(L('#8e5b3a'));
        for (let i = 0; i < 3; i++) { const s = mesh(cyl, kk, 0.11, 0.8, 0.11, 0, 0.98, -0.12 + i * 0.12); s.rotation.z = Math.PI / 2; top(s); }
        break;
      }
      case 'dondurma': {
        g.add(mesh(box, white, 0.95, 0.12, 0.5, 0, 0.92, 0));
        const cols = ['#fdebd0', '#f5b7b1', '#d7bde2', '#a9dfbf'];
        for (let i = 0; i < 4; i++) top(mesh(sph, M(L(cols[i])), 0.17, 0.12, 0.17, -0.3 + i * 0.2, 1.0, 0));
        g.add(mesh(cyl, metal, 0.03, 0.9, 0.03, 0.45, 1.35, 0.2));
        break;
      }
      case 'kumpir': {
        const pot = M(L('#a0522d')), fill = M(L('#f9e79f'));
        for (let i = 0; i < 4; i++) { const p = mesh(sph, pot, 0.22, 0.14, 0.14, -0.33 + i * 0.22, 0.94, -0.05); top(p); top(mesh(sph, fill, 0.12, 0.06, 0.1, -0.33 + i * 0.22, 1.0, -0.05)); }
        for (let i = 0; i < 5; i++) g.add(mesh(box, M(L(['#e74c3c', '#27ae60', '#f39c12', '#8e44ad', '#ecf0f1'][i])), 0.14, 0.05, 0.12, -0.36 + i * 0.18, 0.89, 0.18));
        break;
      }
      case 'simit': {
        g.add(mesh(cyl, M(L('#c8a165')), 0.9, 0.04, 0.5, 0, 0.88, 0));
        const sm = M(L('#c9782f')), ring = G(new T.TorusGeometry(0.075, 0.032, 6, 14));
        for (let i = 0; i < 10; i++) { const r = new T.Mesh(ring, sm); r.rotation.x = Math.PI / 2; r.position.set(-0.3 + (i % 4) * 0.2, 0.92 + Math.floor(i / 4) * 0.06, -0.08 + (Math.floor(i / 4) % 2) * 0.12); top(r); }
        g.add(mesh(box, white, 0.12, 0.05, 0.12, 0.38, 0.9, 0.16));
        break;
      }
      case 'lahmacun': {
        const brick = M(L('#b0503a')), dark = M(L('#2a1d17'));
        const dome = mesh(sph, brick, 0.6, 0.5, 0.5, -0.15, 0.9, -0.05); g.add(dome);
        g.add(mesh(box, dark, 0.26, 0.18, 0.05, -0.15, 1.0, 0.2));
        g.add(mesh(cyl, M(L('#ffb347')), 0.16, 0.02, 0.05, -0.15, 0.96, 0.2));
        const lh = M(L('#d35f3a'));
        for (let i = 0; i < 3; i++) top(mesh(cyl, lh, 0.26, 0.02, 0.26, 0.32, 0.88 + i * 0.025, 0.05));
        top(mesh(box, M(L('#e3b261')), 0.4, 0.04, 0.12, 0.25, 0.9, 0.22));
        break;
      }
      case 'cigkofte': {
        g.add(mesh(box, metal, 0.95, 0.05, 0.5, 0, 0.87, 0));
        const ck = M(L('#8b2e1a')), lettuce = M(L('#58d68d'));
        for (let i = 0; i < 10; i++) top(mesh(sph, ck, 0.09, 0.06, 0.13, -0.34 + (i % 5) * 0.15, 0.92, -0.08 + Math.floor(i / 5) * 0.16));
        g.add(mesh(sph, lettuce, 0.3, 0.1, 0.2, 0.32, 0.93, 0.15));
        g.add(mesh(cyl, M(L('#7b241c')), 0.06, 0.18, 0.06, 0.4, 0.98, -0.15));
        break;
      }
      case 'pizza': {
        const glass = M(new T.MeshLambertMaterial({ color: '#e8f6fa', transparent: true, opacity: 0.3, depthWrite: false }));
        const crust = M(L('#e0a85c')), cheese = M(L('#f7dc6f')), pep = M(L('#c0392b'));
        for (const x of [-0.24, 0.24]) {
          top(mesh(cyl, crust, 0.42, 0.04, 0.42, x, 0.9, 0)); top(mesh(cyl, cheese, 0.37, 0.02, 0.37, x, 0.925, 0));
          for (let k = 0; k < 5; k++) top(mesh(cyl, pep, 0.06, 0.015, 0.06, x + Math.cos(k * 1.26) * 0.11, 0.94, Math.sin(k * 1.26) * 0.11));
        }
        g.add(mesh(box, glass, 1.0, 0.36, 0.5, 0, 1.06, 0));
        break;
      }
      case 'tatli': {
        g.add(mesh(box, white, 0.98, 0.1, 0.52, 0, 0.9, 0));
        const bak = M(L('#d4ac0d')), fis = M(L('#52be80')), kun = M(L('#e67e22'));
        const tray = mesh(cyl, metal, 0.5, 0.04, 0.5, -0.22, 0.96, 0); g.add(tray);
        for (let i = 0; i < 9; i++) { const b = mesh(box, bak, 0.1, 0.05, 0.1, -0.34 + (i % 3) * 0.12, 1.0, -0.12 + Math.floor(i / 3) * 0.12); b.rotation.y = Math.PI / 4; top(b); top(mesh(box, fis, 0.04, 0.012, 0.04, -0.34 + (i % 3) * 0.12, 1.03, -0.12 + Math.floor(i / 3) * 0.12)); }
        for (let i = 0; i < 2; i++) { top(mesh(cyl, kun, 0.22, 0.05, 0.22, 0.28, 0.98, -0.11 + i * 0.24)); }
        break;
      }
      case 'waffle': {
        for (const x of [-0.5, 0.5]) { const w = mesh(cyl, ink, 0.3, 0.06, 0.3, x, 0.16, 0.32); w.rotation.x = Math.PI / 2; g.add(w); }
        const wf = M(L('#e5b567')), choc = M(L('#5d3a1a')), ban = M(L('#f9e79f'));
        for (let i = 0; i < 3; i++) { top(mesh(box, wf, 0.24, 0.04, 0.3, -0.3 + i * 0.3, 0.9, 0)); top(mesh(box, choc, 0.2, 0.012, 0.26, -0.3 + i * 0.3, 0.925, 0)); top(mesh(cyl, ban, 0.05, 0.015, 0.05, -0.3 + i * 0.3, 0.935, 0.05)); }
        g.add(mesh(cyl, M(L('#e74c3c')), 0.03, 1.1, 0.03, 0.45, 1.4, -0.2));
        g.add(mesh(cyl, M(L('#fad7a0')), 0.9, 0.04, 0.9, 0.45, 1.95, -0.2));
        break;
      }
    }
    // sign on two poles 
    for (const x of [-0.48, 0.48]) g.add(mesh(cyl, ink, 0.03, 0.75, 0.03, x, custom ? 1.45 : 1.22, custom ? -0.34 : -0.27));
    const signMat = M(new T.MeshLambertMaterial({ color: '#fff' }));
    const sign = new T.Mesh(G(new T.PlaneGeometry(1.0, 0.38)), signMat); sign.position.set(0, custom ? 1.8 : 1.55, custom ? -0.33 : -0.26); g.add(sign);
    const back = sign.clone(); back.rotation.y = Math.PI; back.position.z = custom ? -0.34 : -0.27; g.add(back);
    const bitti = new T.Mesh(G(new T.PlaneGeometry(0.42, 0.16)), bittiMat); bitti.position.set(0, custom ? 1.25 : 1.12, 0.45); bitti.rotation.x = -0.25; bitti.visible = false; g.add(bitti);
    g.position.set(v.x, 0, v.z); g.rotation.y = v.ry; g.scale.setScalar(1.25);   // survey 2026-10-24: stands read clearly from the play camera
    root.add(g);
    return { root: g, food, bitti, sig: '', signMat };
  }

  // buy plates (dashed ring + price tag)
  const ringGeo = G(new T.RingGeometry(0.42, 0.55, 24));
  const ringMat = M(new T.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.85, depthWrite: false }));
  const plates = new Map<string, { g: T.Group; tag: T.Sprite }>();
  function plate(v: StantView) {
    const g = new T.Group(); const ring = new T.Mesh(ringGeo, ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
    const tx = signTex(v.short, fmtTL(v.cost), v.color); texs.push(tx);
    const sm = M(new T.SpriteMaterial({ map: tx, depthTest: false })); const tag = new T.Sprite(sm); tag.scale.set(0.9, 0.34, 1); tag.position.y = 1.1; tag.renderOrder = 5; g.add(tag);
    g.position.set(v.x, 0, v.z + 0.9); root.add(g);
    return { g, tag };
  }

  // ticket plates
  const tickets: T.Sprite[] = [];
  const tTex = new Map<string, T.CanvasTexture>();
  function ticketTex(no: number, late: boolean, special: boolean): T.CanvasTexture {
    const k = no + (late ? 'L' : '') + (special ? 'S' : '');
    let t = tTex.get(k); if (t) return t;
    t = tex(96, 96, g => {
      g.fillStyle = late ? '#e74c3c' : special ? '#ffd23f' : '#fff8ec'; g.beginPath(); g.arc(48, 48, 42, 0, Math.PI * 2); g.fill();
      g.lineWidth = 7; g.strokeStyle = '#3b2a20'; g.stroke();
      g.fillStyle = late ? '#fff' : '#3b2a20'; g.font = '900 40px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(no), 48, 51);
    });
    if (tTex.size > 60) { tTex.forEach(x => x.dispose()); tTex.clear(); }
    tTex.set(k, t); return t;
  }

  // Faz 2: ferry window counter (vapur penceresi tezgahı) + the items the posted worker lays out (rt.winShelf)
  const winG = new T.Group(); winG.visible = false; root.add(winG);
  // a small prep cabinet just inside the window (worker side) with a marble top; items go on the window sill
  const cab = new T.Group(); winG.add(cab);
  cab.add(mesh(box, M(L('#f2efe8')), 0.46, 0.06, 1.5, -0.38, -0.08, 0), mesh(box, M(L('#3c6e8f')), 0.42, 0.95, 1.44, -0.38, -0.58, 0));
  for (const z of [-0.36, 0.36]) cab.add(mesh(box, M(L('#c9d3da')), 0.02, 0.05, 0.22, -0.16, -0.3, z));
  const PCOL: Record<string, string> = { doner: '#c8873a', cay: '#b5452b', ayran: '#f4f4f0', simit: '#c98a3c', tost: '#e8c37a', gazoz: '#4fa3d9' };
  const shelfMats = new Map<string, T.Material>();
  const shelfItems: T.Mesh[] = [];
  for (let i = 0; i < 5; i++) { const m = mesh(cyl, white, 0.12, 0.12, 0.12, 0, 0.07, -0.56 + i * 0.28); m.visible = false; winG.add(m); shelfItems.push(m); }
  const stands = new Map<string, StandObj>();
  let poll = 0, time = 0;
  return {
    update(dt) {
      time += dt;
      tickets.forEach((s, i) => { if (s.visible) s.position.y = 1.55 + Math.sin(time * 3 + i) * 0.05; });
      if ((poll -= dt) > 0) return; poll = 0.2;
      const r = d.rules(), api = restoranApi(r);
      const v = api && r && r.rt.started ? api.view() : null;
      root.visible = !!v; if (!v || !r) return;
      for (const s of v.stands) {
        if (s.owned) {
          let o = stands.get(s.id); if (!o) { o = build(s); stands.set(s.id, o); }
          o.root.position.set(s.x, 0, s.z); o.root.rotation.y = s.ry;
          const pl = plates.get(s.id); if (pl) { root.remove(pl.g); plates.delete(s.id); }
          const sig = s.stock + '/' + s.max;
          if (sig !== o.sig) {
            o.sig = sig;
            const f = s.max ? s.stock / s.max : 0, n = Math.ceil(f * o.food.length);
            o.food.forEach((m, i) => { m.visible = i < n; });
            o.bitti.visible = s.stock <= 0;
            const old = o.signMat.map; o.signMat.map = signTex(s.short, fmtTL(s.price), s.color); o.signMat.needsUpdate = true; texs.push(o.signMat.map); if (old) old.dispose();
          }
        } else {   // buyable stands are yellow pads now (rtview); plate() kept for a later custom marker
          void plate; const pl = plates.get(s.id); if (pl) { root.remove(pl.g); plates.delete(s.id); } }
      }
      const owns = !!(r.state.owned as Record<string, number>).pencere, W = r.rt.layout.window;
      winG.visible = owns;
      if (owns) {
        // items sit on the sill (serve.y is the sill top); the cabinet stands inside, under the window
        winG.position.set(W.serve.x - 0.2, W.serve.y, W.serve.z); cab.visible = (r.state.stage || 1) >= 2;
        const sh = ((r.rt as unknown as { winShelf?: string[] }).winShelf) || [];
        shelfItems.forEach((m, i) => {
          const p = sh[i]; m.visible = !!p; if (!p) return;
          let mt = shelfMats.get(p); if (!mt) { mt = M(L(PCOL[p] || '#ddd')); shelfMats.set(p, mt); }
          m.material = mt;
        });
      }
      const tbs = r.rt.layout.tables;
      v.tickets.forEach((t, i) => {
        let s = tickets[i]; if (!s) { s = new T.Sprite(M(new T.SpriteMaterial({ depthTest: false }))); s.scale.set(0.42, 0.42, 1); s.renderOrder = 6; root.add(s); tickets.push(s); }
        const tb = tbs[t.table]; s.visible = !!tb; if (!tb) return;
        (s.material as T.SpriteMaterial).map = ticketTex(t.no, t.frac > 0.7, t.special); (s.material as T.SpriteMaterial).needsUpdate = true;
        s.position.x = tb.x; s.position.z = tb.z;
      });
      for (let i = v.tickets.length; i < tickets.length; i++) tickets[i].visible = false;
    },
    dispose() { d.scene.remove(root); geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); texs.forEach(t => t.dispose()); tTex.forEach(t => t.dispose()); },
  };
}
