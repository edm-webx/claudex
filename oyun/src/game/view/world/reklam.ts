/**
 * İskele reklamları (survey marka-7) and the Anlaşma Masası brand sign (marka-5). View only, reads
 * yiyecekApi(rules).reklam():
 * - a poster board hung on the pier lamp post at (-10.05, -4.2) whose poster changes every game week (brand colours,
 *   name, slogan and a code-drawn mascot face on a canvas texture);
 * - big brand ads on both sides of the docking ferry (children of the inner 'ferry' object, like ferry-look.ts);
 * - a small brand plaque on the counter listing the signed brands;
 * - now and then a gull flock pulling a banner across the sky.
 * No colliders (the board hangs on an existing lamp collider), nav and zones untouched. Code-made, no image files.
 */
import * as T from 'three';
import { yiyecekApi, type ReklamModel } from '../../sim/yiyecek';
import { MARKA_BY_ID, MASKOTLAR } from '../../../content/markalar';
import type { Rules } from '../../sim/state';

export interface ReklamDeps { scene: T.Object3D; root: () => T.Object3D | null; rules: () => Rules | null }
export interface ReklamView { update(dt: number): void; dispose(): void }

const POST = { x: -10.05, z: -4.2 };

function canvasTex(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D; t: T.CanvasTexture } {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  return { c, g: c.getContext('2d')!, t };
}
function face(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  g.fillStyle = color; g.strokeStyle = '#3b2a20'; g.lineWidth = Math.max(3, r * 0.1);
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#3b2a20';
  g.beginPath(); g.arc(x - r * 0.35, y - r * 0.1, r * 0.12, 0, Math.PI * 2); g.arc(x + r * 0.35, y - r * 0.1, r * 0.12, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x, y + r * 0.15, r * 0.4, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
}
function drawAd(g: CanvasRenderingContext2D, W: number, H: number, id: string, big: boolean): void {
  const b = MARKA_BY_ID[id]; if (!b) return;
  g.fillStyle = b.color; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#3b2a20'; g.lineWidth = 10; g.strokeRect(5, 5, W - 10, H - 10);
  const m = b.maskot ? MASKOTLAR.find(x => x.id === b.maskot) : null;
  const fr = H * 0.32, hasFace = !!m || big;
  if (hasFace) face(g, fr * 1.4, H / 2, fr, m ? m.color === b.color ? '#fff6e6' : m.color : '#fff6e6');
  const x0 = hasFace ? fr * 2.8 : 20, cx = x0 + (W - x0) / 2;
  g.fillStyle = b.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${Math.round(H * (big ? 0.24 : 0.34))}px system-ui, sans-serif`;
  g.fillText(b.name.toLocaleUpperCase('tr-TR'), cx, H * (big ? 0.36 : 0.4), W - x0 - 20);
  g.font = `800 ${Math.round(H * (big ? 0.12 : 0.17))}px system-ui, sans-serif`;
  g.fillText(b.slogan, cx, H * (big ? 0.66 : 0.76), W - x0 - 20);
  if (big) { g.font = `700 ${Math.round(H * 0.08)}px system-ui, sans-serif`; g.fillText('Bu hafta iskelede', cx, H * 0.86, W - x0 - 20); }
}

export function createReklam(d: ReklamDeps): ReklamView {
  const geos: T.BufferGeometry[] = [], mats: T.Material[] = [], texs: T.Texture[] = [];
  const G = <X extends T.BufferGeometry>(g: X) => { geos.push(g); return g; };
  const M = <X extends T.Material>(m: X) => { mats.push(m); return m; };
  const ink = M(new T.MeshLambertMaterial({ color: '#33373b' }));

  /* ---- pier poster board on the lamp post ---- */
  const poster = canvasTex(384, 512); texs.push(poster.t);
  const board = new T.Group(); board.name = 'reklamPanosu';
  board.position.set(POST.x, 0, POST.z);
  const frame = new T.Mesh(G(new T.BoxGeometry(0.08, 1.5, 1.14)), M(new T.MeshLambertMaterial({ color: '#1d5fa8' })));
  frame.position.set(0.12, 2.15, 0);
  const pf = new T.Mesh(G(new T.PlaneGeometry(1.04, 1.38)), M(new T.MeshLambertMaterial({ map: poster.t, emissive: new T.Color('#ffffff'), emissiveMap: poster.t, emissiveIntensity: 0.25 })));
  pf.position.set(0.165, 2.15, 0); pf.rotation.y = Math.PI / 2;
  const arm = new T.Mesh(G(new T.BoxGeometry(0.2, 0.06, 0.06)), ink); arm.position.set(0.06, 2.95, 0);
  board.add(frame, pf, arm);
  board.rotation.z = 0.12; // lean a little toward the steep play camera
  board.traverse(o => { o.userData.parity = 'dyn'; });
  let boardIn: T.Object3D | null = null;

  /* ---- counter brand plaque ---- */
  const plaqueTex = canvasTex(256, 160); texs.push(plaqueTex.t);
  const plaque = new T.Group(); plaque.name = 'markaTabelasi';
  const pp = new T.Mesh(G(new T.PlaneGeometry(0.34, 0.21)), M(new T.MeshLambertMaterial({ map: plaqueTex.t, side: T.DoubleSide })));
  pp.position.y = 0.16; pp.rotation.x = -0.35;
  const leg = new T.Mesh(G(new T.BoxGeometry(0.02, 0.12, 0.02)), ink); leg.position.y = 0.05;
  plaque.add(pp, leg); plaque.visible = false;
  d.scene.add(plaque);

  /* ---- ferry side ads ---- */
  const fTex = canvasTex(1024, 160); texs.push(fTex.t);
  const fMat = M(new T.MeshLambertMaterial({ map: fTex.t }));
  const ferryAds = new T.Group(); ferryAds.name = 'ferryAds';
  for (const s of [-1, 1]) {
    const p = new T.Mesh(G(new T.PlaneGeometry(5.6, 0.86)), fMat);
    p.position.set(s * 2.25, 1.5, 0); p.rotation.y = s * Math.PI / 2;
    ferryAds.add(p);
  }
  ferryAds.traverse(o => { o.userData.parity = 'dyn'; });
  let ferryObj: T.Object3D | null = null;

  /* ---- gull banner ---- */
  const banTex = canvasTex(512, 64); texs.push(banTex.t);
  const flock = new T.Group(); flock.name = 'pankartMartilar'; flock.visible = false;
  const white = M(new T.MeshLambertMaterial({ color: '#ffffff' }));
  const wingG = G(new T.BoxGeometry(0.9, 0.04, 0.22)), bodyG = G(new T.BoxGeometry(0.22, 0.2, 0.5));
  const wings: T.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const gl = new T.Group(); gl.position.set(i * 0.9, (i % 2) * 0.4, (i - 1) * 0.7);
    const body = new T.Mesh(bodyG, white); body.rotation.y = Math.PI / 2;
    const w = new T.Mesh(wingG, white); w.rotation.y = Math.PI / 2; w.position.y = 0.08; wings.push(w);
    gl.add(body, w); flock.add(gl);
  }
  const rope = new T.Mesh(G(new T.BoxGeometry(1.6, 0.02, 0.02)), ink); rope.position.set(-1.3, -0.1, 0);
  const banner = new T.Mesh(G(new T.PlaneGeometry(5, 0.62)), M(new T.MeshLambertMaterial({ map: banTex.t, side: T.DoubleSide })));
  banner.position.set(-4.6, -0.2, 0);
  flock.add(rope, banner);
  d.scene.add(flock);

  let t = 0, poll = 0, posterKey = '', ferryKey = '', plaqueKey = '', banKey = '', flyT = -1, nextFly = 45;
  function attached(o: T.Object3D, root: T.Object3D): boolean { let p: T.Object3D | null = o; while (p) { if (p === root) return true; p = p.parent; } return false; }

  function sync(m: ReklamModel, r: Rules): void {
    if (m.poster + m.week !== posterKey) { posterKey = m.poster + m.week; drawAd(poster.g, 384, 512, m.poster, true); poster.t.needsUpdate = true; }
    if (m.ferry !== ferryKey) { ferryKey = m.ferry; drawAd(fTex.g, 1024, 160, m.ferry, false); fTex.t.needsUpdate = true; }
    const pk = m.deals.map(x => x.id).join(',');
    if (pk !== plaqueKey) {
      plaqueKey = pk;
      const g = plaqueTex.g; g.fillStyle = '#fff6e6'; g.fillRect(0, 0, 256, 160); g.strokeStyle = '#3b2a20'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 152);
      g.fillStyle = '#c0392b'; g.font = '900 24px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BURADA', 128, 26);
      const list = m.deals.slice(0, 4);
      list.forEach((b, i) => { const y = 54 + i * 26; g.fillStyle = b.color; g.fillRect(16, y - 11, 224, 22); g.fillStyle = b.ink; g.font = '800 17px system-ui, sans-serif'; g.fillText(b.name, 128, y, 216); });
      if (m.deals.length > 4) { g.fillStyle = '#3b2a20'; g.font = '700 14px system-ui, sans-serif'; g.fillText('+' + (m.deals.length - 4) + ' marka', 128, 150); }
      plaqueTex.t.needsUpdate = true;
    }
    plaque.visible = m.deals.length > 0;
    const c = r.rt.layout.counter; plaque.position.set(c.pos.x + 0.62, c.drop.y, c.pos.z + 0.1);
    if (m.pankart !== banKey) {
      banKey = m.pankart; const g = banTex.g;
      g.fillStyle = '#fff3c4'; g.fillRect(0, 0, 512, 64); g.strokeStyle = '#c0392b'; g.lineWidth = 6; g.strokeRect(3, 3, 506, 58);
      g.fillStyle = '#c0392b'; g.font = '900 36px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(m.pankart, 256, 34, 490);
      banTex.t.needsUpdate = true;
    }
  }

  return {
    update(dt) {
      t += dt;
      const r = d.rules(), root = d.root();
      if ((poll -= dt) <= 0) {
        poll = 0.5;
        const api = yiyecekApi(r);
        const m = api && r && r.rt.started ? api.reklam() : null;
        if (m && r) sync(m, r); else plaque.visible = false;
        if (root && boardIn !== root) { root.add(board); boardIn = root; }
        board.visible = !!m;
        if (root) {
          if (!ferryObj || !attached(ferryObj, root)) {
            ferryObj = root.getObjectByName('ferry') ?? null;
            while (ferryObj) { const ch = ferryObj.children.find(k => k.name === 'ferry'); if (!ch) break; ferryObj = ch; }
            if (ferryObj && ferryAds.parent !== ferryObj) ferryObj.add(ferryAds);
          }
        }
        ferryAds.visible = !!m;
      }
      // gull banner: every couple of minutes, 22 s across the sky over the sea
      if (flyT < 0) { if ((nextFly -= dt) <= 0 && boardIn) { flyT = 0; flock.visible = true; } }
      else {
        flyT += dt;
        const k = flyT / 22;
        flock.position.set(-45 + k * 90, 11 + Math.sin(flyT * 0.8) * 0.4, -24);
        for (let i = 0; i < wings.length; i++) wings[i].rotation.x = Math.sin(t * 9 + i) * 0.5;
        banner.rotation.x = Math.sin(t * 3) * 0.15;
        if (k >= 1) { flyT = -1; flock.visible = false; nextFly = 110 + (t % 40); }
      }
    },
    dispose() {
      board.parent?.remove(board); plaque.parent?.remove(plaque); flock.parent?.remove(flock); ferryAds.parent?.remove(ferryAds);
      geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); texs.forEach(x => x.dispose());
    },
  };
}
