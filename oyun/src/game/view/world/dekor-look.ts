/**
 * Dekor 2.0 world bits on the kiosk (survey dekor-9, dekor-11, ev-1/ev-2/ev-7). View only, reads `rt.dekorEv`:
 * - Sabri'nin Evi: a little attic house on the kiosk roof with a ladder, glowing window at night, and extras that appear
 *   as the home grows (mutfak chimney + smoke, balkon railing, teras flag string, kedi in the window). Tap it to go up.
 * - Seasonal decoration layer: a garland of little flags/bulbs in the season colours over the sign (toggle in the panel).
 * - Sign designer extras: a slogan strip under the sign (text/background colours), frame style around it, emblem badge.
 * Everything hangs under the built kiosk object (the one carrying userData.k2), re-attached when the kiosk is rebuilt.
 * No colliders, no nav: purely decorative meshes.
 */
import * as T from 'three';
import { dekorEvApi } from '../../sim/dekor-ev';
import { seasonFor, SIGN_SLOGANS, SIGN_TEXT_COLORS, SIGN_BG_COLORS } from '../../../content/dekor-katalog';
import type { Rules } from '../../sim/state';

export interface DekorLookDeps {
  root: () => T.Object3D | null; rules: () => Rules | null; camera: () => T.Camera | null; hour: () => number;
  command: (c: { kind: string; [k: string]: unknown }) => void;
}
export interface DekorLookView { update(dt: number): void; debug(): Record<string, unknown>; dispose(): void }

const mats = new Map<string, T.Material>();
const lam = (c: string) => { let m = mats.get('l' + c); if (!m) { m = new T.MeshLambertMaterial({ color: c }); mats.set('l' + c, m); } return m; };
const bas = (c: string) => { let m = mats.get('b' + c); if (!m) { m = new T.MeshBasicMaterial({ color: c }); mats.set('b' + c, m); } return m; };
const box = (g: T.Object3D, w: number, h: number, d: number, m: T.Material, x: number, y: number, z: number) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };

interface SignPos { x: number; y: number; z: number; ry: number; w: number; h: number }

function stripTex(text: string, fg: string, bg: string, emblem: string): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, 512, 64);
  g.fillStyle = fg; g.font = 'italic 800 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 34, 470);
  void emblem;
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
function emblemMesh(id: string): T.Group {
  const g = new T.Group();
  const disc = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.04, 20), lam('#fbfaf6')); disc.rotation.x = Math.PI / 2; g.add(disc);
  const ring = new T.Mesh(new T.TorusGeometry(0.22, 0.025, 4, 20), lam('#33373b')); g.add(ring);
  const f = new T.Group(); f.position.z = 0.03; g.add(f);
  if (id === 'marti') { box(f, 0.24, 0.06, 0.02, lam('#ffffff'), 0, 0.02, 0).rotation.z = 0.2; box(f, 0.2, 0.05, 0.02, lam('#ffffff'), -0.08, 0.06, 0).rotation.z = -0.5; box(f, 0.05, 0.03, 0.03, lam('#ffb000'), 0.12, 0.03, 0); }
  else if (id === 'cay') { box(f, 0.1, 0.16, 0.02, lam('#c23e2c'), 0, 0, 0); box(f, 0.16, 0.02, 0.02, lam('#b8862e'), 0, -0.1, 0); }
  else if (id === 'simit') { const t = new T.Mesh(new T.TorusGeometry(0.1, 0.04, 6, 14), lam('#d8a25a')); f.add(t); }
  else if (id === 'vapur') { box(f, 0.26, 0.06, 0.02, lam('#ffffff'), 0, -0.04, 0); box(f, 0.14, 0.06, 0.02, lam('#ffffff'), 0, 0.02, 0); box(f, 0.04, 0.07, 0.02, lam('#e0533c'), 0, 0.08, 0); }
  else if (id === 'lale') { box(f, 0.02, 0.16, 0.02, lam('#5d8f45'), 0, -0.05, 0); const b = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), lam('#e0533c')); b.scale.y = 1.4; b.position.y = 0.06; f.add(b); }
  return g;
}

export function createDekorLook(deps: DekorLookDeps): DekorLookView {
  let kiosk: T.Object3D | null = null;
  const grp = new T.Group(); grp.name = 'dekorLook';
  const attic = new T.Group(); attic.name = 'evAttic';
  const extras = new T.Group(); const season = new T.Group(); const sign = new T.Group();
  grp.add(season, sign); attic.add(extras);
  attic.visible = false; // Faz 2 (asılı ev): the little roof house is removed from the scene
  let winMesh: T.Mesh | null = null, smoke: T.Mesh[] = [], seasonBulbs: T.Mesh[] = [];
  let keyAttic = '', keySeason = '', keySign = '', t = 0, findT = 0;
  let sp: SignPos | null = null, top = 3, cx = 0, cz = 0, halfD = 1;

  function findKiosk(): T.Object3D | null {
    const r = deps.root(); if (!r) return null;
    let k: T.Object3D | null = null;
    r.traverse(o => { if (!k && o.userData && o.userData.k2) k = o; });
    return k;
  }
  function measure(k: T.Object3D): void {
    k.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(k.matrixWorld).invert(), bb = new T.Box3(), tmp = new T.Box3();
    k.traverse(o => {
      const m = o as T.Mesh; if (!m.isMesh || !m.geometry || o === grp || isMine(o)) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      tmp.copy(m.geometry.boundingBox!).applyMatrix4(new T.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      if (tmp.max.y - tmp.min.y > 8) return; // ignore tall lamp poles / pools
      bb.union(tmp);
    });
    if (bb.isEmpty()) { top = 3; cx = 0; cz = 0; halfD = 1; }
    else { top = Math.min(bb.max.y, 4.5); cx = (bb.min.x + bb.max.x) / 2; cz = (bb.min.z + bb.max.z) / 2; halfD = Math.max(0.6, (bb.max.z - bb.min.z) / 2); }
    const s = (k.userData.k2 as { sign?: SignPos | null }).sign;
    sp = s ? { x: s.x, y: s.y, z: s.z, ry: s.ry || 0, w: s.w || 2, h: s.h || 0.5 } : null;
  }
  const isMine = (o: T.Object3D) => { let p: T.Object3D | null = o; while (p) { if (p === grp) return true; p = p.parent; } return false; };

  function clear(g: T.Group): void { while (g.children.length) { const c = g.children.pop()!; c.traverse(o => { const m = o as T.Mesh; if (m.isMesh) { m.geometry.dispose(); const mt = m.material as T.MeshBasicMaterial; if (mt.map) { mt.map.dispose(); mt.dispose(); } } }); } }

  function buildAttic(areas: string[]): void {
    clear(attic); attic.add(extras); clear(extras); smoke = [];
    const wood = lam('#e9d3ae'), roof = lam('#c0533c'), trim = lam('#8a5d3b');
    box(attic, 1.5, 0.9, 1.1, wood, 0, 0.45, 0);
    // gabled roof: two slanted slabs
    const r1 = box(attic, 1.7, 0.08, 0.72, roof, 0, 1.12, 0.3); r1.rotation.x = 0.6;
    const r2 = box(attic, 1.7, 0.08, 0.72, roof, 0, 1.12, -0.3); r2.rotation.x = -0.6;
    // front gable triangle
    const tg = new T.CylinderGeometry(0.3, 0.3, 1.46, 3, 1); tg.rotateZ(Math.PI / 2); tg.rotateX(-Math.PI / 2); tg.scale(1, 1, 2.1);
    const tri = new T.Mesh(tg, wood); tri.position.set(0, 1.05, 0); attic.add(tri);
    // round window + little door
    winMesh = new T.Mesh(new T.CircleGeometry(0.18, 16), new T.MeshBasicMaterial({ color: '#8fd0f2' })); winMesh.position.set(0.35, 0.55, 0.556); attic.add(winMesh);
    const wr = new T.Mesh(new T.TorusGeometry(0.18, 0.03, 4, 16), trim); wr.position.copy(winMesh.position); attic.add(wr);
    box(attic, 0.36, 0.62, 0.04, trim, -0.35, 0.31, 0.56); box(attic, 0.05, 0.05, 0.03, lam('#f2b632'), -0.24, 0.32, 0.59);
    // ladder down the side of the kiosk ("küçük merdiven")
    const lad = new T.Group(); lad.position.set(0.85, 0, 0.3); attic.add(lad);
    [-0.14, 0.14].forEach(z => box(lad, 0.05, 1.6, 0.05, trim, 0, -0.5, z));
    for (let i = 0; i < 6; i++) box(lad, 0.04, 0.04, 0.3, trim, 0, -1.2 + i * 0.26, 0);
    // tiny sign "EV"
    box(attic, 0.4, 0.16, 0.03, lam('#fbfaf6'), -0.35, 0.74, 0.57);
    if (areas.includes('mutfak')) {
      box(extras, 0.2, 0.5, 0.2, lam('#a7a69c'), -0.5, 1.3, -0.25);
      for (let i = 0; i < 3; i++) { const s = new T.Mesh(new T.SphereGeometry(0.09, 6, 4), new T.MeshBasicMaterial({ color: '#f4f1ea', transparent: true, opacity: 0.7 })); s.position.set(-0.5, 1.6 + i * 0.2, -0.25); extras.add(s); smoke.push(s); }
    }
    if (areas.includes('balkon')) {
      box(extras, 1.5, 0.05, 0.4, trim, 0, 0.02, 0.75);
      for (let i = 0; i < 7; i++) box(extras, 0.03, 0.32, 0.03, lam('#fbfaf6'), -0.72 + i * 0.24, 0.2, 0.94);
      box(extras, 1.5, 0.04, 0.04, lam('#fbfaf6'), 0, 0.36, 0.94);
      const g = new T.Mesh(new T.SphereGeometry(0.08, 8, 6), lam('#ffffff')); g.position.set(0.5, 0.42, 0.94); extras.add(g); // the morning gull
    }
    if (areas.includes('teras')) {
      box(extras, 0.03, 0.9, 0.03, trim, 0.7, 1.35, -0.45);
      const f = box(extras, 0.3, 0.18, 0.01, lam('#e0533c'), 0.86, 1.7, -0.45); f.name = 'flag';
      for (let i = 0; i < 5; i++) { const b = new T.Mesh(new T.SphereGeometry(0.035, 6, 4), bas(['#ffd23f', '#ff5fa2', '#49e6d8'][i % 3])); b.position.set(0.7 - i * 0.3, 1.25 - Math.sin(i / 4 * Math.PI) * 0.12, -0.45); extras.add(b); }
    }
    if (areas.includes('kedi')) {
      const c = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), lam('#e8964a')); c.position.set(0.35, 0.47, 0.6); extras.add(c);
      [-0.04, 0.04].forEach(x => { const e = new T.Mesh(new T.ConeGeometry(0.025, 0.05, 4), lam('#e8964a')); e.position.set(0.35 + x, 0.55, 0.6); extras.add(e); });
    }
    attic.position.set(cx - 0.2, top, cz - Math.min(0.3, halfD * 0.3));
    attic.scale.setScalar(0.9);
  }

  function buildSeason(id: string | null, colors: string[]): void {
    clear(season); seasonBulbs = [];
    if (!id || !sp) return;
    const n = 13, w = sp.w + 0.5, y0 = sp.y + sp.h / 2 + 0.25;
    const ox = Math.sin(sp.ry) * 0.08, oz = Math.cos(sp.ry) * 0.08;
    const cs = Math.cos(sp.ry), sn = Math.sin(sp.ry);
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1), lx = -w / 2 + k * w, y = y0 - Math.sin(k * Math.PI) * 0.22;
      const x = sp.x + lx * cs + ox, z = sp.z - lx * sn + oz;
      const c = colors[i % colors.length];
      if (id === 'yilbasi' || id === 'kis') {
        const b = new T.Mesh(new T.SphereGeometry(id === 'kis' ? 0.06 : 0.05, 8, 6), bas(c)); b.position.set(x, y - 0.06, z); season.add(b); seasonBulbs.push(b);
        if (id === 'kis' && i % 2) { const fl = new T.Mesh(new T.OctahedronGeometry(0.09, 0), lam('#ffffff')); fl.position.set(x, y - 0.22, z); season.add(fl); }
      } else {
        const tri = new T.Mesh(new T.ConeGeometry(0.09, 0.2, 3), lam(id === 'sonbahar' && i % 2 ? '#d9822b' : c)); tri.rotation.set(Math.PI, sp.ry, 0); tri.position.set(x, y - 0.1, z); season.add(tri);
        if (id === 'lale' && i % 3 === 0) { const b = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), lam(c)); b.scale.y = 1.4; b.position.set(x, y - 0.3, z); season.add(b); }
      }
    }
    // the cord
    const cord = new T.Mesh(new T.BoxGeometry(w, 0.012, 0.012), lam('#33373b')); cord.position.set(sp.x + ox, y0 - 0.1, sp.z + oz); cord.rotation.y = sp.ry; season.add(cord);
  }

  function buildSign(sg: { slogan: number; emblem: string; frame: string; text: string; bg: string }): void {
    clear(sign);
    if (!sp) return;
    const holder = new T.Group(); holder.position.set(sp.x, sp.y, sp.z); holder.rotation.y = sp.ry; sign.add(holder);
    const w = sp.w, h = sp.h;
    const slogan = SIGN_SLOGANS[sg.slogan] || '';
    if (slogan) {
      const fg = SIGN_TEXT_COLORS.find(c => c.id === sg.text)?.hex || '#fffaf0', bg = SIGN_BG_COLORS.find(c => c.id === sg.bg)?.hex || '#16325c';
      const m = new T.Mesh(new T.PlaneGeometry(w * 0.92, h * 0.38), new T.MeshBasicMaterial({ map: stripTex(slogan, fg, bg, sg.emblem) }));
      m.position.set(0, -h / 2 - h * 0.22, 0.02); holder.add(m);
    }
    if (sg.frame && sg.frame !== 'yok') {
      const c = sg.frame === 'ahsap' ? '#8a5d3b' : sg.frame === 'cini' ? '#3fb5b0' : sg.frame === 'neon' ? '#ff5fa2' : '#f2b632';
      const mat = sg.frame === 'neon' ? bas(c) : lam(c), th = sg.frame === 'neon' ? 0.035 : 0.07;
      box(holder, w + th * 2, th, 0.05, mat, 0, h / 2 + th / 2, 0.01); box(holder, w + th * 2, th, 0.05, mat, 0, -h / 2 - th / 2, 0.01);
      box(holder, th, h, 0.05, mat, -w / 2 - th / 2, 0, 0.01); box(holder, th, h, 0.05, mat, w / 2 + th / 2, 0, 0.01);
      if (sg.frame === 'ampul') for (let i = 0; i < 12; i++) { const b = new T.Mesh(new T.SphereGeometry(0.035, 6, 4), bas('#fff2b0')); b.position.set(-w / 2 + (i + 0.5) * (w / 12), h / 2 + th / 2, 0.05); holder.add(b); }
      if (sg.frame === 'cini') for (let i = 0; i < 8; i++) box(holder, 0.06, 0.06, 0.055, lam('#2f6fb0'), -w / 2 + (i + 0.5) * (w / 8), -h / 2 - th / 2, 0.02).rotation.z = Math.PI / 4;
    }
    if (sg.emblem && sg.emblem !== 'yok') { const e = emblemMesh(sg.emblem); e.position.set(-w / 2 - 0.3, 0, 0.04); holder.add(e); }
  }

  // ── tap the attic to go up (ev-7 "Yukarı çık") ──
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  let down: { x: number; y: number; t: number } | null = null;
  const onDown = (e: PointerEvent) => { down = (e.target as HTMLElement)?.tagName === 'CANVAS' ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; };
  const onUp = (e: PointerEvent) => {
    const d = down; down = null;
    const tg = e.target as HTMLElement;
    if (!d || !tg || tg.tagName !== 'CANVAS' || tg.closest('.ev-ov') || !attic.parent) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12 || performance.now() - d.t > 500) return;
    const cam = deps.camera(); if (!cam) return;
    const r = tg.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    if (ray.intersectObject(attic, true).length) deps.command({ kind: 'dekor2', arg: 'evOpen' });
  };
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });

  return {
    update(dt) {
      t += dt;
      const r = deps.rules(); const a = r ? dekorEvApi(r) : null;
      if (!r || !a) return;
      findT -= dt;
      if (findT <= 0 || !kiosk) {
        findT = 1;
        const k = findKiosk();
        if (k && k !== kiosk) { kiosk = k; measure(k); k.add(grp); keyAttic = keySeason = keySign = ''; }
        if (!k) { kiosk = null; if (grp.parent) grp.parent.remove(grp); return; }
        if (grp.parent !== k) k.add(grp);
        // cheap keys (once a second)
        const D = a.data(), E = a.ev();
        const ka = E.areas.join(',') + '|' + top.toFixed(2);
        if (ka !== keyAttic) { keyAttic = ka; buildAttic(E.areas); }
        const se = D.season ? seasonFor(String((r.state as { calendar?: string }).calendar || '')) : null;
        const ks = se ? se.id : '-';
        if (ks !== keySeason) { keySeason = ks; buildSeason(se ? se.id : null, se ? se.colors : []); }
        const ksg = JSON.stringify(D.sign);
        if (ksg !== keySign) { keySign = ksg; buildSign(D.sign); }
      }
      // night window glow + smoke + bulbs twinkle
      const h = deps.hour(), night = h >= 19 || h < 6;
      if (winMesh) (winMesh.material as T.MeshBasicMaterial).color.set(a.evOpen ? '#ffe27a' : night ? '#ffc96a' : '#8fd0f2');
      smoke.forEach((s, i) => { const k = (t * 0.4 + i / 3) % 1; s.position.y = 1.55 + k * 0.7; s.scale.setScalar(0.6 + k); (s.material as T.MeshBasicMaterial).opacity = 0.7 * (1 - k); });
      seasonBulbs.forEach((b, i) => { b.visible = !night || Math.sin(t * 3 + i) > -0.6; });
      const flag = extras.getObjectByName('flag'); if (flag) flag.rotation.y = Math.sin(t * 3) * 0.3;
    },
    debug() { return { attached: !!grp.parent, top, sign: sp, attic: keyAttic, season: keySeason, sign2: keySign }; },
    dispose() { window.removeEventListener('pointerdown', onDown); window.removeEventListener('pointerup', onUp); grp.parent?.remove(grp); },
  };
}
