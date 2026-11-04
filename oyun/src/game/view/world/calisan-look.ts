/**
 * Çalışanlar 2.0 world props (survey calisan-4/5): the Ayın Elemanı photo frame on the kiosk wall (code-drawn canvas
 * portrait + name), a birthday cake on the counter on a worker's birthday once the cake is cut, the çay molası köşesi
 * (tiny table, semaver, two stools) behind the kiosk once bought, and the Dinlenme Bankı: a little sign at the back
 * pier bench where up to three benched workers sit as real rigs. Code-made low-poly meshes, no colliders (the bench
 * itself is the existing pier bench with its own collider). Reads only (calisanApi(rules).view()).
 */
import * as T from 'three';
import { calisanApi, type CalisanView } from '../../sim/calisan';
import type { Rules } from '../../sim/state';
import { BENCHES, benchSeats } from '../../../content/prefabs/iskele/layout';
import type { MotorChars } from '../chars/index';
import { resolveLook } from '../chars/agents-view';
import type { HeroHandle } from '../../../engine/api';

export interface CalisanLookDeps { scene: T.Object3D; rules: () => Rules | null; chars: MotorChars | null }
export interface CalisanLookView { update(dt: number): void; dispose(): void }

const INK = '#3b2a20';
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
const hashCol = (s: string, pal: string[]) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return pal[h % pal.length]; };

/** A cute code-drawn mugshot: face, hair, mustache by look hints, name banner. */
function drawPhoto(g: CanvasRenderingContext2D, name: string, look: Record<string, unknown> | null) {
  const W = 128, H = 160;
  g.fillStyle = '#ffe9a8'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff6d6'; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(64, 70); g.arc(64, 70, 120, i * Math.PI / 4, i * Math.PI / 4 + 0.35); g.fill(); }
  const skins = ['#f6d5b8', '#f0c39c', '#e2a878', '#c98a5a', '#a86b42', '#8a5532', '#6e4026', '#f2c9a0'];
  const skin = look && typeof look.skin === 'number' ? skins[(look.skin as number) % skins.length] : hashCol(name, skins);
  const hair = look && typeof look.hairColor === 'string' ? look.hairColor as string : hashCol(name + 'h', ['#2b1d14', '#5a2d0c', '#1b1410', '#7a4a2a', '#3a2a1a']);
  const top = look && typeof look.top === 'string' ? look.top as string : hashCol(name + 't', ['#2ecc71', '#ff9f43', '#8e44ad', '#49a8e0', '#e0533c']);
  g.lineWidth = 4; g.strokeStyle = INK;
  // shoulders + apron
  g.fillStyle = top; g.beginPath(); g.ellipse(64, 152, 50, 34, 0, Math.PI, 0); g.fill(); g.stroke();
  g.fillStyle = '#1d5fa8'; g.fillRect(46, 128, 36, 32); g.strokeRect(46, 128, 36, 32);
  // head
  g.fillStyle = skin; g.beginPath(); g.arc(64, 78, 34, 0, Math.PI * 2); g.fill(); g.stroke();
  if (look && look.headscarf) { g.fillStyle = hashCol(name + 's', ['#e0533c', '#c0392b', '#8e44ad', '#2ecc71']); g.beginPath(); g.arc(64, 74, 38, Math.PI * 0.92, Math.PI * 2.08); g.fill(); g.stroke(); }
  else { g.fillStyle = hair; g.beginPath(); g.arc(64, 70, 35, Math.PI * 1.05, Math.PI * 1.95); g.lineTo(98, 66); g.quadraticCurveTo(64, 50, 30, 66); g.fill(); g.stroke(); }
  // eyes, smile, mustache
  g.fillStyle = INK; g.beginPath(); g.arc(52, 80, 4, 0, Math.PI * 2); g.arc(76, 80, 4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(64, 90, 12, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  if (look && look.mustache) { g.fillStyle = hair; g.beginPath(); g.ellipse(57, 92, 9, 4, 0.2, 0, Math.PI * 2); g.ellipse(71, 92, 9, 4, -0.2, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#f7a1a1'; g.globalAlpha = 0.6; g.beginPath(); g.arc(44, 92, 6, 0, Math.PI * 2); g.arc(84, 92, 6, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  // banner
  g.fillStyle = '#c0392b'; g.fillRect(0, 0, W, 30); g.strokeRect(2, 2, W - 4, 26);
  g.fillStyle = '#fff'; g.font = '900 15px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('AYIN ELEMANI', 64, 16, 120);
  g.fillStyle = '#fff6e6'; g.fillRect(8, 122, 112, 30); g.strokeRect(8, 122, 112, 30);
  g.fillStyle = INK; g.font = '900 20px system-ui, sans-serif'; g.fillText(name.toLocaleUpperCase('tr-TR'), 64, 138, 104);
  void H;
}

export function createCalisanLook(d: CalisanLookDeps): CalisanLookView {
  const geos: T.BufferGeometry[] = [], mats: T.Material[] = [], texs: T.Texture[] = [];
  const G = <X extends T.BufferGeometry>(g: X) => { geos.push(g); return g; };
  const M = <X extends T.Material>(m: X) => { mats.push(m); return m; };
  const lam = (c: string) => M(new T.MeshLambertMaterial({ color: c }));
  const wood = lam('#b5733a'), dark = lam('#6b4426'), brass = M(new T.MeshLambertMaterial({ color: '#d9a441', emissive: '#4a3000', emissiveIntensity: 0.2 }));

  // ── Ayın Elemanı frame
  const frame = new T.Group(); frame.name = 'ayinElemani';
  const photoMat = M(new T.MeshBasicMaterial({ color: '#ffffff' }));
  const border = new T.Mesh(G(new T.BoxGeometry(0.5, 0.6, 0.04)), wood);
  const photo = new T.Mesh(G(new T.PlaneGeometry(0.4, 0.5)), photoMat); photo.position.z = 0.022;
  const nail = new T.Mesh(G(new T.SphereGeometry(0.025, 6, 4)), brass); nail.position.set(0, 0.36, 0.01);
  const string = new T.Mesh(G(new T.CylinderGeometry(0.006, 0.006, 0.2, 4)), dark); string.position.set(0, 0.33, 0); string.rotation.z = 0;
  frame.add(border, photo, nail, string); frame.visible = false; d.scene.add(frame);
  let photoKey = '';

  // ── birthday cake on the counter
  const cake = new T.Group(); cake.name = 'pasta';
  const sponge = new T.Mesh(G(new T.CylinderGeometry(0.15, 0.15, 0.12, 16)), lam('#f7c6d0')); sponge.position.y = 0.06;
  const cream = new T.Mesh(G(new T.TorusGeometry(0.14, 0.022, 6, 16)), lam('#ffffff')); cream.rotation.x = Math.PI / 2; cream.position.y = 0.12;
  const plate = new T.Mesh(G(new T.CylinderGeometry(0.19, 0.19, 0.012, 16)), lam('#e8eef2'));
  cake.add(plate, sponge, cream);
  const flames: T.Mesh[] = [];
  const flameMat = M(new T.MeshBasicMaterial({ color: '#ffb02e' }));
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    const cdl = new T.Mesh(G(new T.CylinderGeometry(0.01, 0.01, 0.07, 5)), lam(['#5c8fd6', '#ffd23f', '#49b96a'][i])); cdl.position.set(Math.cos(a) * 0.07, 0.155, Math.sin(a) * 0.07);
    const fl = new T.Mesh(G(new T.ConeGeometry(0.014, 0.035, 5)), flameMat); fl.position.set(cdl.position.x, 0.205, cdl.position.z);
    cake.add(cdl, fl); flames.push(fl);
  }
  cake.visible = false; d.scene.add(cake);

  // ── çay molası köşesi
  const cay = new T.Group(); cay.name = 'cayKosesi';
  const top = new T.Mesh(G(new T.CylinderGeometry(0.32, 0.32, 0.04, 14)), wood); top.position.y = 0.62;
  const leg = new T.Mesh(G(new T.CylinderGeometry(0.04, 0.06, 0.6, 8)), dark); leg.position.y = 0.3;
  const sem = new T.Group();
  const semBody = new T.Mesh(G(new T.CylinderGeometry(0.08, 0.1, 0.22, 10)), brass); semBody.position.y = 0.11;
  const semTop = new T.Mesh(G(new T.ConeGeometry(0.06, 0.06, 10)), brass); semTop.position.y = 0.25;
  const pot = new T.Mesh(G(new T.SphereGeometry(0.055, 10, 8)), lam('#c0392b')); pot.position.y = 0.31;
  sem.add(semBody, semTop, pot); sem.position.set(-0.08, 0.64, 0);
  const glassMat = M(new T.MeshLambertMaterial({ color: '#b5361f', transparent: true, opacity: 0.85 }));
  const g1 = new T.Mesh(G(new T.CylinderGeometry(0.025, 0.02, 0.07, 8)), glassMat); g1.position.set(0.15, 0.675, 0.08);
  const g2 = g1.clone(); g2.position.set(0.14, 0.675, -0.1);
  cay.add(top, leg, sem, g1, g2);
  for (const sx of [-0.55, 0.55]) {
    const st = new T.Group();
    const seat = new T.Mesh(G(new T.CylinderGeometry(0.15, 0.15, 0.05, 10)), lam('#e0533c')); seat.position.y = 0.4;
    const sl = new T.Mesh(G(new T.CylinderGeometry(0.03, 0.04, 0.38, 6)), dark); sl.position.y = 0.19;
    st.add(seat, sl); st.position.x = sx; cay.add(st);
  }
  const steam: T.Mesh[] = [];
  const steamGeo = G(new T.SphereGeometry(0.03, 6, 4));
  for (let i = 0; i < 3; i++) { const s = new T.Mesh(steamGeo, M(new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }))); steam.push(s); cay.add(s); }
  cay.position.set(-5.5, 0, -12.45); cay.visible = false; d.scene.add(cay);

  // ── Dinlenme Bankı sign at the back bench
  const bn = BENCHES[0];
  const signTex = canvasTex(256, 64, g => {
    g.fillStyle = '#fff3c4'; g.fillRect(0, 0, 256, 64); g.strokeStyle = INK; g.lineWidth = 6; g.strokeRect(3, 3, 250, 58);
    g.fillStyle = '#1d5fa8'; g.font = '900 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('DİNLENME BANKI', 128, 34, 236);
  }); texs.push(signTex);
  const sign = new T.Group(); sign.name = 'dinlenmeBanki';
  const board = new T.Mesh(G(new T.PlaneGeometry(0.9, 0.225)), M(new T.MeshLambertMaterial({ map: signTex, side: T.DoubleSide })));
  board.position.y = 1.15;
  const post = new T.Mesh(G(new T.CylinderGeometry(0.03, 0.03, 1.1, 6)), dark); post.position.y = 0.55;
  sign.add(post, board);
  sign.position.set(bn.pos.x - 1.15 * Math.cos(bn.rotY), 0, bn.pos.z + 0.25); sign.rotation.y = bn.rotY + Math.PI;
  d.scene.add(sign);
  const seats = benchSeats(bn);
  const sitters = new Map<number, HeroHandle>();

  function syncSitters(v: CalisanView) {
    const want = new Set(v.bench.map(b => b.id));
    for (const [id, h] of sitters) if (!want.has(id)) { try { h.dispose(); } catch { /* */ } sitters.delete(id); }
    if (!d.chars) return;
    v.bench.forEach((b, i) => {
      let h = sitters.get(b.id);
      if (!h) {
        try {
          const look = resolveLook(d.chars!, (b.look as Record<string, unknown>) || undefined);
          h = d.chars!.makeHero({ kind: 'worker', look, seed: (b.id * 977) % 10007 } as never);
          sitters.set(b.id, h);
        } catch { return; }
      }
      const s = seats[i % seats.length];
      h.setPose({ x: s.x, z: s.z }, bn.rotY + Math.PI);
    });
  }

  let t = 0, poll = 0, view: CalisanView | null = null, layoutKey = '';
  function place(r: Rules) {
    const L = r.rt.layout, c = L.counter, st = r.state.stage;
    const key = c.pos.x + ',' + c.pos.z + ',' + st;
    if (key === layoutKey) return;
    layoutKey = key;
    cake.position.set(c.pos.x + 0.55, c.drop.y, c.pos.z + 0.04);
    if (st <= 1) { frame.position.set(-3.9, 2.15, -4.25); frame.rotation.y = 0; }
    else { frame.position.set(-3.25, 2.0, -10.22); frame.rotation.y = 0; }
  }
  return {
    update(dt) {
      const r = d.rules(); if (!r) return;
      t += dt;
      if ((poll -= dt) <= 0) {
        poll = 0.5;
        place(r);
        view = calisanApi(r)?.view() ?? null;
        if (view) {
          const k = view.ayin ? view.ayin.name + JSON.stringify(view.ayin.look ?? null) : '';
          if (k !== photoKey) {
            photoKey = k;
            if (view.ayin) {
              const old = photoMat.map; const nm = view.ayin.name, lk = (view.ayin.look as Record<string, unknown>) || null;
              const tex = canvasTex(128, 160, g => drawPhoto(g, nm, lk));
              photoMat.map = tex; photoMat.needsUpdate = true; if (old) old.dispose();
            }
          }
          frame.visible = !!view.ayin;
          cake.visible = view.cake;
          cay.visible = view.cayKosesi;
          syncSitters(view);
        }
      }
      if (cake.visible) flames.forEach((f, i) => { const s = 1 + 0.25 * Math.sin(t * 13 + i * 2); f.scale.set(s, 1 + 0.35 * Math.sin(t * 9 + i), s); });
      if (cay.visible) steam.forEach((s, i) => { const p = ((t * 0.5 + i / 3) % 1); s.position.set(-0.08 + Math.sin(t * 2 + i) * 0.03, 1.0 + p * 0.35, 0); s.scale.setScalar(0.6 + p * 1.2); (s.material as T.MeshBasicMaterial).opacity = 0.5 * (1 - p); });
      for (const h of sitters.values()) {
        h.setInput({ speed: 0, act: 'sit' as never, mood: 'happy' });
        (h as unknown as { setState?: (s: Record<string, unknown>) => void }).setState?.({ act: 'sit', sit: true });
        h.update(dt, 1);
      }
    },
    dispose() {
      for (const h of sitters.values()) { try { h.dispose(); } catch { /* */ } }
      sitters.clear();
      for (const o of [frame, cake, cay, sign]) o.parent?.remove(o);
      if (photoMat.map) photoMat.map.dispose();
      geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); texs.forEach(x => x.dispose());
    },
  };
}
