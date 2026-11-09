/**
 * Karşı yaka'nın canlılığı (2026-11-04, owner: "ruhsuz görünüyor"): fıskiye damlaları ve sisi, çay buharı, uçuşan
 * polen, sokak lambaları, okulda öğrenci/öğretmen, meydanda gazete okuyan ve çay içen insanlar, çaycı arabası,
 * Maç Koordinatörü, halı sahada kendi kendine oynanan maç (macmotor, AI vs AI) + tribün seyircisi, morgda gece
 * ışığı/gölgesi/sesleri. Tamamen görsel: sim'e dokunmaz. Oyuncu uzaktayken hiçbir şey güncellenmez.
 */
import * as T from 'three';
import type { Chars } from '../../../engine/api';
import * as K from '../chars/v2/kit';
import { createMatch, L as ML, WD as MW } from '../../sim/macmotor';
import { KARSI_FOUNTAIN, KARSI_PITCH } from '../../../content/zones/karsi';
import { ARSALAR, arsaKapi } from '../../../content/esya';

export interface YasamDeps { root: () => T.Object3D | null; chars: Chars | null; hero: () => { x: number; z: number }; hour: () => number; sfx: (id: string) => void; /** hired café workers per owned fixed plot (sim/mulk) */ isci?: () => { id: string; n: number; lv?: number; esya?: string[] }[] }
export interface YasamView { update(dt: number): void; dispose(): void }

type H = { object: T.Object3D; setPose(p: { x: number; z: number }, r: number): void; setInput(i: Record<string, unknown>): void; update(dt: number, a: number): void };
interface Actor { h: H; x: number; z: number; yaw: number; speed: number; act: string; path?: [number, number][]; pi: number; wait: number; sp: number; y: number }

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const L2 = (x0: number, z0: number, x1: number, z1: number) => Math.hypot(x1 - x0, z1 - z0);

function textSprite(text: string, w = 2.4): T.Sprite {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(14,22,44,.82)'; g.beginPath(); g.roundRect(6, 14, 500, 100, 22); g.fill();
  g.strokeStyle = '#ffb627'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#fff'; g.font = '800 46px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66, 470);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(w, w / 4, 1); return s;
}

export function createKarsiYasam(d: YasamDeps): YasamView {
  const holder = new T.Group(); holder.name = 'karsiYasam';
  const actors: Actor[] = [];
  let built = false, tt = 0;
  let mkH: ((type: string, seed: number, over?: Record<string, unknown>) => H | null) | null = null, addA: ((h: H | null, x: number, z: number, o?: Partial<Actor>) => void) | null = null;
  const kafeIsci = new Map<string, Actor[]>(); let isciT = 0;
  /** café workers: one waiter per hired worker in front of the café door (pouring tea, greeting) */
  function syncIsci() {
    if (!d.isci || !mkH || !addA) return;
    const want = new Map(d.isci().map(x => [x.id, x.n]));
    for (const a of ARSALAR) {
      if (!a.sabit) continue; const n = Math.min(1, want.get(a.id) || 0) * (a.id === 'k1' || a.id === 'k2' ? 1 : 0), cur = kafeIsci.get(a.id) || [];   // 2026-11-09: staff work inside (ic-mekan-look); one greeter at the café door
      while (cur.length > n) { const w = cur.pop()!; w.h.object.removeFromParent(); const i = actors.indexOf(w); if (i >= 0) actors.splice(i, 1); }
      while (cur.length < n) { const i = cur.length, k = arsaKapi(a); const h = mkH(['universiteli', 'plaza', 'teyze'][i % 3], 700 + a.id.charCodeAt(1) * 10 + i, { hat: 'cap' }); if (!h) break; addA(h, k.x - 0.6 - i * 0.2, k.z - 1.3 + i * 1.3, { act: i === 0 ? 'pour' : 'perform', yaw: Math.PI / 2 }); cur.push(actors[actors.length - 1]); }
      kafeIsci.set(a.id, cur);
    }
    syncTeras();
  }
  /** café terrace grows with the café level (2026-11-08 owner: kafeler "aynı mantıkla işletilmeli", like the büfe stages):
   *  lv1 2 tables, lv2 4, lv3 + pergola awning, lv4 6 + planters, lv5 8 + string lights and a gold "BİSTRO" frame. */
  const teras = new Map<string, { lv: string; g: T.Group }>();
  function syncTeras() {
    if (!d.isci) return;
    const lvs = new Map(d.isci().map(x => [x.id, x.lv || 1])), es = new Map(d.isci().map(x => [x.id, new Set(x.esya || [])]));
    for (const a of ARSALAR) {
      if (!a.sabit || (a.id !== 'k1' && a.id !== 'k2')) continue; const lv = lvs.get(a.id) || 0, cur = teras.get(a.id), has = es.get(a.id) || new Set<string>(), key = lv + ':' + [...has].sort().join(',');
      if (cur && cur.lv === key) continue;
      if (cur) { cur.g.removeFromParent(); cur.g.traverse(o => { const m = o as T.Mesh; m.geometry?.dispose(); }); teras.delete(a.id); }
      if (!lv) continue;
      const g = new T.Group(), k = arsaKapi(a), UMB = ['#e0533c', '#2f7fb3', '#2f9e8f', '#ffd23f'];
      const n = [0, 2, 4, 4, 6, 8][Math.min(5, lv)];
      for (let i = 0; i < n; i++) {
        const col = Math.floor(i / 2) % 2, side = i % 2 ? 1 : -1, row = Math.floor(i / 4);
        const x = k.x + 1.0 + col * 1.7 + row * 0.0, z = k.z + side * (1.7 + row * 1.6);
        bx(0.08, 0.72, 0.08, '#3a3d42', x, 0.36, z, g); const top = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.05, 14), lam(lv >= 5 ? '#fbfaf6' : '#d6aa78')); top.position.set(x, 0.74, z); g.add(top);
        for (const s2 of [-1, 1]) bx(0.34, 0.45, 0.34, lv >= 5 ? '#6b1f2a' : '#7d5638', x + s2 * 0.55, 0.23, z, g);
        if (lv < 3 || has.has('semsiye')) { bx(0.03, 2.1, 0.03, '#f4f2ec', x, 1.05, z, g); const u = new T.Mesh(new T.ConeGeometry(1.0, 0.4, 8), lam(UMB[i % 4])); u.position.set(x, 2.25, z); g.add(u); }
      }
      if (lv >= 3) {   // pergola awning over the terrace
        const x0 = k.x + 0.5, x1 = k.x + 3.6, z0 = k.z - 4.2, z1 = k.z + 4.2;
        for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [x1, k.z - 1.0], [x1, k.z + 1.0]]) bx(0.12, 2.6, 0.12, '#5a4330', x, 1.3, z, g);
        for (let i = 0; i < 8; i++) { const st = new T.Mesh(new T.BoxGeometry(x1 - x0 + 0.3, 0.04, (z1 - z0) / 8), lam(i % 2 ? '#fbfaf6' : '#e0533c')); st.position.set((x0 + x1) / 2, 2.62, z0 + (i + 0.5) * (z1 - z0) / 8); g.add(st); }
      }
      if (lv >= 4 || has.has('saksi')) for (const z of [k.z - 4.4, k.z + 4.4]) { bx(0.6, 0.5, 0.6, '#f4f2ec', k.x + 2.0, 0.25, z, g); const p = new T.Mesh(new T.SphereGeometry(0.45, 8, 6), lam('#3f7a34')); p.position.set(k.x + 2.0, 0.85, z); g.add(p); }
      if (has.has('soba')) for (const z of [k.z - 2.6, k.z + 2.6]) {   // patio heaters
        bx(0.5, 0.08, 0.5, '#3a3d42', k.x + 3.1, 0.04, z, g); const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.07, 2.1, 8), lam('#9aa5b0')); pole.position.set(k.x + 3.1, 1.05, z); g.add(pole);
        const hd = new T.Mesh(new T.ConeGeometry(0.42, 0.3, 12), lam('#9aa5b0')); hd.position.set(k.x + 3.1, 2.2, z); g.add(hd);
        const fl = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.25, 10), new T.MeshBasicMaterial({ color: '#ff8a3a' })); fl.position.set(k.x + 3.1, 1.95, z); g.add(fl);
      }
      if (lv >= 5 || has.has('isik')) {
        const bulbs = new T.MeshBasicMaterial({ color: '#ffd890' });
        for (let i = 0; i <= 12; i++) { const z = k.z - 4.2 + i * 0.7, b = new T.Mesh(new T.SphereGeometry(0.06, 6, 4), bulbs); b.position.set(k.x + 3.6, 2.45 - Math.sin(i / 12 * Math.PI) * 0.3, z); g.add(b); }
        if (lv >= 5) bx(0.1, 0.1, 3.0, '#c9a24a', k.x + 0.25, 3.3, k.z, g);
      }
      holder.add(g); teras.set(a.id, { lv: key, g });
    }
  }
  const lam = (c: string) => new T.MeshLambertMaterial({ color: c });
  const bx = (w: number, h: number, dd: number, c: string, x: number, y: number, z: number, p: T.Object3D = holder) => { const m = new T.Mesh(new T.BoxGeometry(w, h, dd), lam(c)); m.position.set(x, y, z); p.add(m); return m; };

  /* ---------------- particles ---------------- */
  const pts = (n: number, size: number, color: string, add = true, op = 0.9) => {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3));
    const m = new T.PointsMaterial({ color, size, transparent: true, opacity: op, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending, sizeAttenuation: true });
    const p = new T.Points(g, m); p.frustumCulled = false; holder.add(p); return p;
  };
  const NJ = 260, jets = pts(NJ, 0.12, '#cfeeff'), mist = pts(60, 0.55, '#ffffff', false, 0.16);
  const jv = Array.from({ length: NJ }, () => ({ t: Math.random() * 2, a: Math.random() * Math.PI * 2, k: Math.floor(Math.random() * 7), s: rnd(0.8, 1.2) }));
  const steam = pts(70, 0.3, '#ffffff', false, 0.22), steamV = Array.from({ length: 70 }, (_, i) => ({ t: Math.random() * 3, src: i % 3 }));
  const pollen = pts(90, 0.09, '#fff3b0'), polV = Array.from({ length: 90 }, () => ({ x: rnd(-24, 12), y: rnd(0.5, 4), z: rnd(33, 56), ph: Math.random() * 6 }));
  const glowPts = pts(8, 2.4, '#ffd890', true, 0.0);
  const LAMPS: [number, number][] = [[-12.2, 33.6], [5.6, 33.6], [-12.2, 56.4], [5.6, 56.4], [-23, 33], [30.8, 40], [-24, 57]];

  /* ---------------- build ---------------- */
  function build() {
    built = true;
    // sokak lambaları
    LAMPS.forEach(([x, z]) => { bx(0.14, 4.2, 0.14, '#2b2f36', x, 2.1, z); const b = new T.Mesh(new T.SphereGeometry(0.28, 10, 8), new T.MeshBasicMaterial({ color: '#ffe6a8' })); b.position.set(x, 4.3, z); holder.add(b); });
    (glowPts.geometry.attributes.position as T.BufferAttribute).array.set(LAMPS.flatMap(([x, z]) => [x, 4.3, z]).slice(0, 24));
    // çaycı arabası (meydanın köşesi)
    const cx = -11.4, cz = 53.2; const cart = new T.Group(); cart.position.set(cx, 0, cz); holder.add(cart);
    bx(2.2, 0.9, 1.1, '#3f7fd0', 0, 0.75, 0, cart); bx(2.3, 0.12, 1.2, '#f4f4f0', 0, 1.25, 0, cart); bx(0.2, 0.2, 0.2, '#b9bec6', 0.9, 0.2, 0.5, cart);
    const sam = new T.Mesh(new T.CylinderGeometry(0.28, 0.34, 0.8, 14), new T.MeshStandardMaterial({ color: '#c9a23a', metalness: 0.8, roughness: 0.28 })); sam.position.set(-0.5, 1.7, 0); cart.add(sam);
    for (let i = 0; i < 6; i++) bx(0.12, 0.16, 0.12, '#f2c230', 0.1 + i * 0.16, 1.4, 0.3, cart);
    const tag = textSprite('☕ Çaycı Hasan', 2.6); tag.position.set(cx, 3.2, cz); holder.add(tag);
    // Maç Koordinatörü tezgâhı (halı saha girişi)
    const gx = -24.6, gz = 42.2; bx(1.8, 1.0, 0.7, '#e0674f', gx, 0.5, gz + 1.0); bx(2.0, 0.1, 0.9, '#f4f4f0', gx, 1.05, gz + 1.0);
    bx(0.08, 2.5, 0.08, '#cfd4da', gx - 0.9, 1.25, gz + 1.4); bx(0.08, 2.5, 0.08, '#cfd4da', gx + 0.9, 1.25, gz + 1.4); bx(2.2, 0.5, 0.06, '#c8504a', gx, 2.55, gz + 1.4);
    const ctag = textSprite('🧢 Maç Koordinatörü', 3.0); ctag.position.set(gx, 3.5, gz + 0.6); holder.add(ctag);
    const mtag = textSprite('⚽ Bilet · Kulüp · Lig', 2.6); mtag.position.set(gx, 4.0, gz + 0.6); holder.add(mtag);
    // morg: kırmızı titrek ışık + gölge
    morgLight = bx(0.08, 0.9, 1.1, '#ff2a1a', 55.58, 2.0, 55.5);
    morgShadow = bx(0.06, 1.6, 0.5, '#07080b', 55.56, 1.3, 55.5); morgShadow.visible = false;
    const mt = textSprite('MORG', 1.6); mt.position.set(55.4, 3.9, 55.5); holder.add(mt);
    // tribün seyircisi (instanced)
    crowdGeo(); 
    // insanlar
    if (!d.chars) return;
    const mk = (type: string, seed: number, over: Record<string, unknown> = {}): H | null => {
      try { const look = (d.chars as unknown as { v2: { randomLook(t: string, r: unknown): Record<string, unknown> } }).v2.randomLook(type, K.rng(seed)); const h = d.chars!.makeHero({ ...look, ...over } as never) as unknown as H; holder.add(h.object); h.object.visible = true; return h; } catch { return null; }
    };
    const add = (h: H | null, x: number, z: number, o: Partial<Actor> = {}) => { if (!h) return; const a: Actor = { h, x, z, yaw: 0, speed: 0, act: 'idle', pi: 0, wait: 0, sp: 1.1, y: 0, ...o }; actors.push(a); h.setPose({ x, z }, a.yaw); h.object.position.y = a.y; };
    mkH = mk; addA = add;
    // okul: öğrenciler bahçede dolaşır, öğretmenler konuşur
    const YARD: [number, number][] = [[35, 42.6], [40, 42.2], [46, 42.8], [52, 42.4], [44, 44.0], [36, 38]];
    for (let i = 0; i < 8; i++) { const p = YARD.slice().sort(() => Math.random() - 0.5); add(mk('okul', 100 + i), p[0][0], p[0][1], { path: p, sp: rnd(0.9, 1.6), act: 'idle' }); }
    add(mk('isinsani', 201), 47.5, 41.8, { act: 'perform', yaw: Math.PI }); add(mk('emekli', 202), 49.0, 41.8, { act: 'perform', yaw: Math.PI });
    // basketbol
    for (let i = 0; i < 4; i++) { const p: [number, number][] = [[34 + Math.random() * 4, 36 + Math.random() * 4], [34 + Math.random() * 4, 36 + Math.random() * 6], [35 + Math.random() * 3, 35 + Math.random() * 7]]; add(mk('okul', 300 + i), p[0][0], p[0][1], { path: p, sp: rnd(2.4, 3.4) }); }
    // meydan: banklarda oturanlar (gazete / çay)
    const SEAT: [number, number, number, 'gazete' | 'cay'][] = [[-10.6 + 1 * 2.8, 34.85, 0, 'gazete'], [-10.6 + 3 * 2.8, 34.85, 0, 'cay'], [-10.6 + 2 * 2.8, 55.25, Math.PI, 'gazete'], [-10.6 + 4 * 2.8, 55.25, Math.PI, 'cay'], [-10.6 + 0 * 2.8, 55.25, Math.PI, 'cay']];
    SEAT.forEach(([x, z, yaw, what], i) => {
      const h = mk(i % 2 ? 'teyze' : 'emekli', 400 + i); if (!h) return;
      add(h, x, z, { act: 'sit', yaw, y: 0.45 });
      if (what === 'gazete') { const p = bx(0.5, 0.36, 0.02, '#f4f1e8', 0, 1.0, 0.38, h.object); p.rotation.x = -0.35; bx(0.46, 0.03, 0.01, '#222', 0, 1.1, 0.4, h.object); }
      else { bx(0.08, 0.1, 0.08, '#c0392b', 0.22, 0.92, 0.3, h.object); }
    });
    add(mk('emekli', 450), cx + 0.2, cz + 1.0, { act: 'pour', yaw: Math.PI, speed: 0 });     // çaycı
    add(mk('taksici', 451), cx + 1.6, cz + 1.6, { act: 'sip', yaw: -2.2 }); add(mk('teyze', 452), cx - 1.0, cz + 1.7, { act: 'sip', yaw: 2.6 });
    // Maç Koordinatörü
    add(mk('isinsani', 460, { hat: 'cap' }), gx, gz + 0.1, { act: 'perform', yaw: 0 });
    // yaya trafiği
    const ROUTES: [number, number][][] = [[[-20, 44.5], [-8, 44.5], [-3.9, 40.5], [4, 44], [10, 42.6], [28, 42.6]], [[8.5, 31], [-30, 31], [-48, 31]], [[30.5, 57], [30.5, 40], [18, 42.6]], [[46, 47], [34, 47], [30.5, 47], [18, 42.6]]];
    ROUTES.forEach((r, i) => { for (let k = 0; k < 2; k++) { const rr = k ? r.slice().reverse() : r; add(mk(['universiteli', 'plaza', 'gezgin', 'teyze'][(i + k) % 4], 500 + i * 3 + k), rr[0][0], rr[0][1], { path: rr, sp: rnd(1.0, 1.4) }); } });
    // halı saha oyuncuları + top
    const kit = ['#e0533c', '#2f6fdb'];
    for (let i = 0; i < 10; i++) {
      const h = mk('universiteli', 600 + i); if (!h) continue; const bib = bx(0.5, 0.42, 0.34, kit[i < 5 ? 0 : 1], 0, 1.05, 0, h.object); bib.name = 'bib';
      players.push(h); actors.push({ h, x: 0, z: 0, yaw: 0, speed: 0, act: 'idle', pi: -1, wait: 0, sp: 0, y: 0 });
    }
    ballMesh = new T.Mesh(new T.SphereGeometry(0.14, 12, 10), new T.MeshStandardMaterial({ color: '#fbfaf6', roughness: 0.5 })); ballMesh.position.set(KARSI_PITCH.x, 0.15, KARSI_PITCH.z); holder.add(ballMesh);
    newMatch();
  }
  let morgLight: T.Mesh, morgShadow: T.Mesh, ballMesh: T.Mesh;
  const players: H[] = [];
  let match: ReturnType<typeof createMatch> | null = null, matchEnd = 0;
  function newMatch() { match = createMatch({ seed: (Math.random() * 1e6) | 0, halfS: 55, skill: [0.6, 0.6], formations: ['2-2', '1-2-1'] }); matchEnd = 0; }
  // tribün seyircisi: top ve alt tribünde sıralar
  let crowd: T.InstancedMesh | null = null; const cb: { x: number; y: number; z: number; ph: number }[] = [];
  function crowdGeo() {
    const spots: [number, number][] = []; const P = KARSI_PITCH;
    for (let r = 0; r < 4; r++) for (let i = 0; i < 12; i++) { const x = P.x - 12 + i * 2.1 + (r % 2) * 0.5; spots.push([x, P.z - P.d / 2 - 0.9 - r * 0.7], [x, P.z + P.d / 2 + 0.9 + r * 0.7]); }
    cb.push(...spots.map(([x, z], i) => ({ x, y: 0.7 + Math.floor(i / 24) * 0.5 + 0.5, z, ph: Math.random() * 6 })));
    crowd = new T.InstancedMesh(new T.CapsuleGeometry(0.2, 0.45, 3, 7), new T.MeshLambertMaterial({ color: '#ffffff' }), cb.length); crowd.frustumCulled = false;
    const cols = ['#e0533c', '#2f6fdb', '#f2c230', '#fbfaf6', '#2fb56a']; cb.forEach((_, i) => crowd!.setColorAt(i, new T.Color(cols[(i * 7) % cols.length])));
    holder.add(crowd);
  }

  /* ---------------- update ---------------- */
  const tmp = new T.Object3D(), pos = new Float32Array(0); void pos;
  function stepActors(dt: number) {
    for (const a of actors) {
      if (a.pi === -1) continue;   // match players are driven by the match
      if (a.path && a.path.length > 1) {
        if (a.wait > 0) { a.wait -= dt; a.speed = 0; }
        else {
          const [tx, tz] = a.path[(a.pi + 1) % a.path.length], dd = L2(a.x, a.z, tx, tz);
          if (dd < 0.15) { a.pi = (a.pi + 1) % a.path.length; a.wait = Math.random() < 0.4 ? rnd(1, 4) : 0; }
          else { const k = Math.min(1, a.sp * dt / dd); a.yaw = Math.atan2(tx - a.x, tz - a.z); a.x += (tx - a.x) * k; a.z += (tz - a.z) * k; a.speed = a.sp; }
        }
      }
      a.h.setPose({ x: a.x, z: a.z }, a.yaw); a.h.object.position.y = a.y;
      a.h.setInput({ speed: a.speed, act: a.speed > 0.05 ? 'idle' : a.act }); a.h.update(dt, 1);
    }
  }
  function stepMatch(dt: number, near: boolean) {
    if (!match || !players.length) return;
    if (match.over) { matchEnd += dt; if (matchEnd > 4) newMatch(); }
    else { match.step(Math.min(dt, 0.05) * 1.0); }
    const P = KARSI_PITCH, m = match!;
    m.events.splice(0).forEach(e => { if (e.k === 'sfx' && near) d.sfx(e.id); });
    const sx = P.w / ML, sz = P.d / MW;
    m.pls.forEach((p, i) => {
      const h = players[i]; if (!h) return;
      const x = P.x + (p.x - ML / 2) * sx, z = P.z + (p.y - MW / 2) * sz, sp = Math.hypot(p.vx, p.vy);
      h.setPose({ x, z }, sp > 0.3 ? Math.atan2(p.vx, p.vy) : (p.team === 0 ? Math.PI / 2 : -Math.PI / 2)); h.setInput({ speed: Math.min(sp * 0.8, 6), act: 'idle' }); h.update(dt, 1);
    });
    ballMesh.position.set(P.x + (m.ball.x - ML / 2) * sx, 0.15, P.z + (m.ball.y - MW / 2) * sz);
  }
  let morgT = 6;
  return {
    update(dt) {
      const root = d.root(); if (!root) return;
      if (holder.parent !== root) root.add(holder);
      const h = d.hero(), near = h.z > 8, hour = d.hour(), night = hour >= 19.5 || hour < 6.2;
      holder.visible = near; if (!near) return;
      if (!built) build();
      dt = Math.min(dt, 0.1); tt += dt;
      // fountain
      { const F = KARSI_FOUNTAIN, a = jets.geometry.attributes.position as T.BufferAttribute;
        for (let i = 0; i < NJ; i++) { const j = jv[i]; j.t += dt * j.s; if (j.t > 1.6) { j.t = 0; j.a = Math.random() * 6.28; j.k = Math.floor(Math.random() * 7); }
          const ring = j.k < 6, ang = ring ? j.k * 1.047 + (j.a - 3.14) * 0.05 : j.a, r0 = ring ? 1.5 : 0.1, vr = ring ? 0.9 : 0.35 + (j.a % 1) * 0.3, vy = ring ? 4.2 : 6.4;
          const r = r0 + vr * j.t, y = 0.7 + vy * j.t - 4.9 * j.t * j.t * (ring ? 1 : 1.0);
          a.setXYZ(i, F.x + Math.cos(ang) * r, Math.max(0.55, y), F.z + Math.sin(ang) * r); }
        a.needsUpdate = true;
        const m = mist.geometry.attributes.position as T.BufferAttribute; for (let i = 0; i < 60; i++) { const q = (tt * 0.25 + i / 60) % 1, ang = i * 2.4; m.setXYZ(i, F.x + Math.cos(ang) * (0.8 + q * 2.2), 1.0 + q * 2.4, F.z + Math.sin(ang) * (0.8 + q * 2.2)); } m.needsUpdate = true; }
      // steam from tea
      { const a = steam.geometry.attributes.position as T.BufferAttribute; const src: [number, number][] = [[-11.4, 53.2], [-11.4 + 0.6, 53.4], [-7.8, 34.9]];
        steamV.forEach((s, i) => { s.t = (s.t + dt * 0.5) % 3; const [sx, sz] = src[s.src]; a.setXYZ(i, sx + Math.sin(tt + i) * 0.12 * s.t, 1.9 + s.t * 0.7 - (s.src === 2 ? 0.7 : 0), sz + Math.cos(tt * 0.8 + i) * 0.1 * s.t); }); a.needsUpdate = true; (steam.material as T.PointsMaterial).opacity = 0.22; }
      // pollen / leaves
      { const a = pollen.geometry.attributes.position as T.BufferAttribute; polV.forEach((p, i) => { p.x += dt * 0.35; p.y += Math.sin(tt * 0.7 + p.ph) * dt * 0.25; if (p.x > 14) p.x = -26; a.setXYZ(i, p.x, 0.6 + Math.abs(p.y) % 3.8, p.z + Math.sin(tt * 0.5 + p.ph) * 0.6); }); a.needsUpdate = true; (pollen.material as T.PointsMaterial).opacity = night ? 0.15 : 0.7; }
      (glowPts.material as T.PointsMaterial).opacity = night ? 0.85 : 0;
      // morg
      { if (night && (hour >= 22 || hour < 5.5)) { morgLight.visible = Math.sin(tt * 23) * Math.sin(tt * 7.3) > -0.15; (morgLight.material as T.MeshLambertMaterial).color.set(Math.random() < 0.08 ? '#ffffff' : '#ff2a1a');
          morgT -= dt; if (morgT <= 0 && Math.hypot(h.x - 57, h.z - 55) < 40) { morgT = rnd(7, 16); morgShadow.visible = true; d.sfx(Math.random() < 0.5 ? 'moan' : Math.random() < 0.5 ? 'knock' : 'whisper'); setTimeout(() => { morgShadow.visible = false; }, 1400); }
          if (morgShadow.visible) morgShadow.position.z = 55.5 + Math.sin(tt * 3) * 0.5; } else { morgLight.visible = false; morgShadow.visible = false; } }
      if ((isciT -= dt) <= 0) { isciT = 1.0; syncIsci(); }
      stepActors(dt); stepMatch(dt, Math.hypot(h.x + 39, h.z - 45) < 45);
      if (crowd) { const goalT = match ? match.bannerT : 0; cb.forEach((c, i) => { tmp.position.set(c.x, c.y + Math.max(0, Math.sin(tt * (goalT > 0 ? 9 : 2.2) + c.ph)) * (goalT > 0 ? 0.35 : 0.06), c.z); tmp.updateMatrix(); crowd!.setMatrixAt(i, tmp.matrix); }); crowd.instanceMatrix.needsUpdate = true; }
    },
    dispose() { holder.parent?.remove(holder); },
  };
}
