/**
 * Martıköy view (survey disari-1..9, mekan-1..9, iskele-9/10): everything visual for the neighbourhoods east of the
 * street that the static zone props cannot do. Never writes sim state; taps send commands.
 * - Labels (HTML layer, only near the hero and while the zone is warm/hot): places with day/night/closed lines,
 *   side shops (price or "Sabri'nin" + till), dolmuş stops, wooden arrow signs, finds (hidden cat eyes, coins,
 *   photo spots, lost item, the owner's "!"), plus a "Fındık" tag over the guide cat.
 * - Guide cat Fındık: a cat rig walking a few metres ahead of Sabri towards rt.disari guide target, sits on arrival.
 * - Lunapark Martı ferris wheel (turns; bulbs glow at night) and the open-air cinema film (night only).
 * - "Islak boya" barrier (sawhorses + sign) at the first locked region's west edge.
 * - Pier props on the iskele root (bollards with ropes, can simidi, bilet gişesi + turnike, oltacı köşesi + kova,
 *   bozuk paralı tartı, gazete bayii kulübesi): code-made low-poly meshes, no colliders (nav untouched).
 */
import * as T from 'three';
import type { ZoneManager, Vec3, ScreenPt, HeroHandle } from '../../../engine/api';
import type { HtmlLabels, HtmlLabel } from '../../ui/labels';
import type { Rules } from '../../sim/state';
import { disariApi, type DisariView } from '../../sim/disari';
import { HIDDEN_CATS, PHOTO_SPOTS, GUIDE_CAT, PIER_PROPS, BAND, regionAt } from '../../../content/disari/martikoy';

export interface DisariViewDeps {
  scene: T.Scene; zones: ZoneManager; labels: HtmlLabels; project(p: Vec3, out: ScreenPt): boolean;
  rules: () => Rules | null; hero: () => { x: number; z: number }; hour: () => number;
  command: (c: { kind: string; [k: string]: unknown }) => void;
  makeCat?: (opts: Record<string, unknown>) => HeroHandle;
}
export interface DisariLookView { update(dt: number): void; dispose(): void }

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const fmt = (n: number) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function createDisariLook(d: DisariViewDeps): DisariLookView {
  const geos: T.BufferGeometry[] = [], mats: T.Material[] = [], texs: T.Texture[] = [];
  const G = <X extends T.BufferGeometry>(g: X) => { geos.push(g); return g; };
  const L = (color: string, extra: T.MeshLambertMaterialParameters = {}) => { const m = new T.MeshLambertMaterial({ color, ...extra }); mats.push(m); return m; };
  const box = (p: T.Object3D, w: number, h: number, dd: number, m: T.Material, x: number, y: number, z: number) => { const o = new T.Mesh(G(new T.BoxGeometry(w, h, dd)), m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
  const cyl = (p: T.Object3D, rt: number, rb: number, h: number, m: T.Material, x: number, y: number, z: number, seg = 10) => { const o = new T.Mesh(G(new T.CylinderGeometry(rt, rb, h, seg)), m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
  const tmp: ScreenPt = { x: 0, y: 0 }, at: Vec3 = { x: 0, y: 0, z: 0 };
  const live = (zone: string) => { const s = d.zones.state(zone); return s === 'warm' || s === 'hot'; };
  const put = (lb: HtmlLabel, x: number, y: number, z: number, html: string, cls: string) => { at.x = x; at.y = y; at.z = z; if (d.project(at, tmp)) lb.set(tmp.x, tmp.y, html, cls); else lb.hide(); };

  /* ---------- labels ---------- */
  const zoneOf = (x: number) => regionAt(x)?.zone || 'iskele';
  const catL = HIDDEN_CATS.map(() => d.labels.label());
  const photoL = PHOTO_SPOTS.map(() => d.labels.label());
  const coinL: HtmlLabel[] = []; for (let i = 0; i < 16; i++) coinL.push(d.labels.label());
  const lostL = d.labels.label(), ownerL = d.labels.label(), guideL = d.labels.label(), lockL = d.labels.label();

  /* ---------- guide cat ---------- */
  let cat: HeroHandle | null = null;
  const catPos = { x: 0, z: 0, rot: 0 }; let catOn = false, catSitT = 0;
  function ensureCat(): HeroHandle | null {
    if (cat || !d.makeCat) return cat;
    try { cat = d.makeCat({ name: GUIDE_CAT.name, coat: GUIDE_CAT.coat }); cat.object.visible = false; } catch (e) { console.warn('[disari] cat', e); d.makeCat = undefined; }
    return cat;
  }

  /* ---------- ferris wheel + cinema ---------- */
  const lunaRoot = new T.Group(); lunaRoot.name = 'lunapark-wheel'; lunaRoot.position.set(185, 4.4, 21.5); d.scene.add(lunaRoot);
  const wheel = new T.Group(); lunaRoot.add(wheel);
  const rimM = L('#f6efe1'), spokeM = L('#e0533c');
  const bulbM = new T.MeshLambertMaterial({ color: '#fff1c0', emissive: '#000000' }); mats.push(bulbM);
  const rim = new T.Mesh(G(new T.TorusGeometry(3.4, 0.09, 6, 40)), rimM); rim.rotation.y = Math.PI / 2; wheel.add(rim);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const sp = box(wheel, 0.06, 6.8, 0.06, spokeM, 0, 0, 0); sp.rotation.x = a; }
  const gondolas: T.Object3D[] = [];
  const gCols = ['#e0533c', '#ffd23f', '#5aa9d6', '#8fd06b', '#e78fb3', '#f08a3c', '#8c5a9a', '#3fb5b0'];
  const bulbG = G(new T.SphereGeometry(0.11, 6, 4));
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, gp = new T.Group(); gp.position.set(0, Math.sin(a) * 3.4, Math.cos(a) * 3.4); wheel.add(gp);
    box(gp, 0.8, 0.6, 0.7, L(gCols[i]), 0, -0.45, 0); box(gp, 0.9, 0.08, 0.8, L('#f6efe1'), 0, -0.1, 0);
    gondolas.push(gp);
  }
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; const b = new T.Mesh(bulbG, bulbM); b.position.set(0.1, Math.sin(a) * 3.5, Math.cos(a) * 3.5); wheel.add(b); }
  // cinema film (canvas texture on the screen, night only)
  const filmC = document.createElement('canvas'); filmC.width = 256; filmC.height = 112;
  const filmTex = new T.CanvasTexture(filmC); filmTex.colorSpace = T.SRGBColorSpace; texs.push(filmTex);
  const filmM = new T.MeshBasicMaterial({ map: filmTex }); mats.push(filmM);
  const film = new T.Mesh(G(new T.PlaneGeometry(8.0, 3.3)), filmM); film.position.set(158, 3.0, 21.2 + 1.4 - 0.08); film.rotation.y = Math.PI; film.visible = false; d.scene.add(film);
  let filmT = 0;
  function drawFilm(t: number) {
    const g = filmC.getContext('2d'); if (!g) return;
    g.fillStyle = '#1d2b4a'; g.fillRect(0, 0, 256, 112);
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(200, 26, 12, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2f6f9a'; g.fillRect(0, 80, 256, 32);
    const gx = (t * 40) % 300 - 30, gy = 50 + Math.sin(t * 3) * 8;
    g.fillStyle = '#fbfaf6'; g.beginPath(); g.ellipse(gx, gy, 16, 8, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(gx - 4, gy); g.lineTo(gx - 18, gy - 14 - Math.sin(t * 10) * 6); g.lineTo(gx + 6, gy - 2); g.fill();
    g.strokeStyle = '#d9822b'; g.lineWidth = 5; g.beginPath(); g.arc(gx + 30 + Math.sin(t * 2) * 6, gy + 14, 9, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#fff'; g.font = '900 13px system-ui'; g.textAlign = 'center'; g.fillText('MARTI İLE SİMİT 2', 128, 104);
    filmTex.needsUpdate = true;
  }

  /* ---------- "Islak boya" barrier ---------- */
  const barrier = new T.Group(); barrier.name = 'islak-boya'; d.scene.add(barrier); barrier.visible = false;
  {
    const red = L('#e0533c'), white = L('#fbfaf6'), wood = L('#9a6a42'), yellow = L('#ffd23f');
    for (const z of [BAND.z0 + 1.2, BAND.mid, BAND.z1 - 1.2]) {
      const s = new T.Group(); s.position.set(0, 0, z); barrier.add(s);
      box(s, 0.1, 0.24, 2.2, red, 0, 0.82, 0); box(s, 0.1, 0.24, 2.2, white, 0, 0.58, 0);
      for (const dz of [-0.95, 0.95]) { const l1 = box(s, 0.08, 1.0, 0.08, wood, 0.18, 0.45, dz); l1.rotation.z = 0.35; const l2 = box(s, 0.08, 1.0, 0.08, wood, -0.18, 0.45, dz); l2.rotation.z = -0.35; }
    }
    box(barrier, 0.1, 0.8, 2.6, yellow, -0.3, 1.55, BAND.mid);
    // paint bucket + brush
    cyl(barrier, 0.22, 0.18, 0.36, L('#5aa9d6'), -0.8, 0.18, BAND.mid + 2.0);
  }

  /* ---------- pier props (on the iskele zone root) ---------- */
  const pier = new T.Group(); pier.name = 'iskele-props';
  {
    const iron = L('#3b4146'), rope = L('#d8c39a'), red = L('#e0533c'), white = L('#fbfaf6'), wood = L('#9a6a42'), cream = L('#fff3d6'), blue = L('#2f6f9a'), brass = L('#c9a23a');
    for (const [x, z] of PIER_PROPS.babalar) {
      const g = new T.Group(); g.position.set(x, 0, z); pier.add(g);
      cyl(g, 0.16, 0.2, 0.42, iron, 0, 0.21, 0, 10); cyl(g, 0.22, 0.22, 0.07, iron, 0, 0.44, 0, 10);
      const r1 = new T.Mesh(G(new T.TorusGeometry(0.22, 0.045, 6, 14)), rope); r1.rotation.x = Math.PI / 2; r1.position.y = 0.28; g.add(r1);
      const hang = box(g, 0.05, 0.05, 0.9, rope, 0, 0.2, x < 0 ? 0 : 0); hang.position.x = x < 0 ? -0.35 : 0.35; hang.rotation.y = Math.PI / 2; hang.rotation.z = x < 0 ? 0.5 : -0.5;
    }
    for (const [x, z] of PIER_PROPS.canSimidi) {
      const g = new T.Group(); g.position.set(x, 0.85, z); g.rotation.y = Math.PI / 2; pier.add(g);
      const ring = new T.Mesh(G(new T.TorusGeometry(0.32, 0.09, 8, 18)), white); g.add(ring);
      for (let i = 0; i < 4; i++) { const b = new T.Mesh(G(new T.TorusGeometry(0.32, 0.095, 8, 3, Math.PI / 5)), red); b.rotation.z = i * Math.PI / 2; g.add(b); }
      box(g, 0.06, 0.6, 0.06, wood, 0, -0.5, -0.02);
    }
    // bilet gişesi + turnike
    {
      const g = new T.Group(); g.position.set(PIER_PROPS.gise.x, 0, PIER_PROPS.gise.z); pier.add(g);
      box(g, 1.3, 2.1, 1.0, cream, 0, 1.05, 0); box(g, 1.5, 0.14, 1.2, blue, 0, 2.17, 0); box(g, 0.8, 0.5, 0.04, L('#9cc3d6'), 0, 1.35, 0.52);
      box(g, 1.1, 0.26, 0.05, blue, 0, 1.85, 0.53);
      for (const dx of [1.1, 1.8]) { cyl(g, 0.12, 0.12, 0.9, iron, dx, 0.45, 0.1, 8); const arm = box(g, 0.5, 0.05, 0.05, brass, dx + 0.25, 0.8, 0.1); arm.rotation.y = 0.4; }
    }
    // oltacı köşesi + kova
    {
      const g = new T.Group(); g.position.set(PIER_PROPS.oltaci.x, 0, PIER_PROPS.oltaci.z); pier.add(g);
      box(g, 0.45, 0.4, 0.45, blue, 0, 0.2, 0); cyl(g, 0.2, 0.16, 0.36, red, 0.55, 0.18, 0, 10);
      const rod = cyl(g, 0.015, 0.025, 2.6, iron, 0.1, 1.1, -0.5, 4); rod.rotation.x = -0.6;
      const line = box(g, 0.008, 1.2, 0.008, white, 0.1, 1.3, -1.6); line.rotation.x = 0.1;
    }
    // bozuk paralı tartı
    {
      const g = new T.Group(); g.position.set(PIER_PROPS.tarti.x, 0, PIER_PROPS.tarti.z); pier.add(g);
      box(g, 0.6, 0.12, 0.6, iron, 0, 0.06, 0); box(g, 0.32, 1.3, 0.22, red, 0, 0.75, -0.2);
      const face = new T.Mesh(G(new T.CylinderGeometry(0.22, 0.22, 0.05, 16)), white); face.rotation.x = Math.PI / 2; face.position.set(0, 1.25, -0.07); g.add(face);
      box(g, 0.16, 0.04, 0.03, brass, 0, 0.95, -0.08);
    }
    // gazete bayii kulübesi
    {
      const g = new T.Group(); g.position.set(PIER_PROPS.bayii.x, 0, PIER_PROPS.bayii.z); g.rotation.y = Math.PI; pier.add(g);
      box(g, 1.8, 2.2, 1.4, L('#5a7ea8'), 0, 1.1, 0); box(g, 2.0, 0.14, 1.6, cream, 0, 2.27, 0);
      box(g, 1.4, 0.8, 0.05, L('#fbfaf6'), 0, 1.3, 0.72);
      for (let i = 0; i < 4; i++) box(g, 0.3, 0.4, 0.03, L(['#e0533c', '#ffd23f', '#8fd06b', '#e78fb3'][i]), -0.5 + i * 0.33, 1.35, 0.75);
      box(g, 1.6, 0.3, 0.08, red, 0, 1.95, 0.72);
    }
  }
  let pierParent: T.Object3D | null = null;

  /* ---------- update ---------- */
  let clock = 0;
  function hideAll() {
    for (const l of [...catL, ...photoL, ...coinL, lostL, ownerL, guideL, lockL]) l.hide();
  }
  function near(h: { x: number; z: number }, x: number, z: number, r: number) { return Math.abs(h.x - x) < r && Math.abs(h.z - z) < r; }

  return {
    update(dt) {
      clock += dt;
      // pier props follow the iskele zone root
      const ir = d.zones.root('iskele') as T.Object3D | null | undefined;
      if (ir && pierParent !== ir) { ir.add(pier); pierParent = ir; }
      const r = d.rules(); const api = disariApi(r);
      const v: DisariView | null = api ? api.view() : null;
      const h = d.hero(), hr = d.hour(), night = hr >= 19 || hr < 6;
      // wheel + film
      const sahilLive = live('sahil');
      lunaRoot.visible = sahilLive;
      if (sahilLive) {
        wheel.rotation.x += dt * 0.22;
        for (const gp of gondolas) gp.rotation.x = -wheel.rotation.x;
        bulbM.emissive.set(night ? '#ffcf5a' : '#000000');
        const show = night && near(h, 158, 18, 30);
        film.visible = show;
        if (show && (filmT -= dt) <= 0) { filmT = 0.08; drawFilm(clock); }
      } else film.visible = false;
      // barrier
      const lk = v?.locked;
      barrier.visible = !!lk && Math.abs(h.x - lk.x) < 45;
      if (lk) barrier.position.set(lk.x - 0.2, 0, 0);
      if (!v || v.travel) { hideAll(); if (cat) cat.object.visible = false; return; }
      if (lk && barrier.visible && Math.abs(h.x - lk.x) < 22) put(lockL, lk.x, 2.6, BAND.mid, `<div class="say">🚧 ${esc(lk.line)}</div>`, 'say'); else lockL.hide();
      // finds
      const leftIds = new Set(v.catsLeft.map(c => c.id));
      HIDDEN_CATS.forEach((c, i) => {
        const l = catL[i];
        if (!leftIds.has(c.id) || !live(zoneOf(c.x)) || !near(h, c.x, c.z, 7)) { l.hide(); return; }
        put(l, c.x, 0.7 + Math.sin(clock * 3 + i) * 0.05, c.z, `<div class="tag">${clock % 2.4 < 2.1 ? '👀' : '😺'}</div>`, 'tag');
      });
      PHOTO_SPOTS.forEach((ph, i) => {
        const l = photoL[i], done = v.photos[i]?.done;
        if (done || !live(zoneOf(ph.x)) || !near(h, ph.x, ph.z, 12)) { l.hide(); return; }
        put(l, ph.x, 1.4, ph.z, `<div class="tag">📷 ${esc(ph.name)}</div>`, 'tag');
      });
      for (let i = 0; i < coinL.length; i++) {
        const c = v.coins[i], l = coinL[i];
        if (!c || !live(zoneOf(c.x)) || !near(h, c.x, c.z, 10)) { l.hide(); continue; }
        put(l, c.x, 0.35 + Math.abs(Math.sin(clock * 4 + i)) * 0.25, c.z, `<div class="tag">🪙</div>`, 'tag');
      }
      if (v.lost && live(zoneOf(v.lost.x)) && near(h, v.lost.x, v.lost.z, 12)) put(lostL, v.lost.x, 0.8, v.lost.z, `<div class="tag">🎁 ${esc(v.lost.name)}</div>`, 'tag'); else lostL.hide();
      if (v.owner && live(zoneOf(v.owner.x)) && near(h, v.owner.x, v.owner.z, 24)) put(ownerL, v.owner.x, 2.6, v.owner.z, `<div class="say">❗ ${esc(v.owner.name)}</div>`, 'say'); else ownerL.hide();
      // guide cat
      const tgt = v.guide || null;
      const c = tgt ? ensureCat() : cat;
      if (c) {
        if (tgt) {
          if (!catOn) { catOn = true; catPos.x = h.x + 1.2; catPos.z = h.z + 0.6; catSitT = 0; }
          const dx = tgt.x - h.x, dz = tgt.z - h.z, dist = Math.hypot(dx, dz) || 1;
          const lead = Math.min(2.8, dist);
          const wx = h.x + dx / dist * lead, wz = h.z + dz / dist * lead;
          const mx = wx - catPos.x, mz = wz - catPos.z, md = Math.hypot(mx, mz);
          const spd = Math.min(md, dt * Math.max(2.2, md * 2.2));
          if (md > 0.05) { catPos.x += mx / md * spd; catPos.z += mz / md * spd; catPos.rot = Math.atan2(mx, mz); }
          c.object.visible = true;
          c.setPose({ x: catPos.x, z: catPos.z }, catPos.rot);
          (c as unknown as { setState?(s: Record<string, unknown>): void }).setState?.({ act: md > 0.2 ? 'walk' : 'sit', speed: Math.min(1, spd / Math.max(dt, 1e-3) / 2.4) });
          c.update(dt, 1);
          put(guideL, catPos.x, 1.05, catPos.z, `<div class="tag">🐾 ${esc(GUIDE_CAT.name)} · ${esc(tgt.name)}</div>`, 'tag');
        } else if (catOn) {
          catSitT += dt;
          (c as unknown as { setState?(s: Record<string, unknown>): void }).setState?.({ act: 'sit', speed: 0 });
          c.update(dt, 1);
          guideL.hide();
          if (catSitT > 2.5) { catOn = false; c.object.visible = false; }
        }
      } else guideL.hide();
    },
    dispose() {
      for (const l of [...catL, ...photoL, ...coinL, lostL, ownerL, guideL, lockL]) l.free();
      if (cat) { cat.dispose(); cat = null; }
      lunaRoot.removeFromParent(); film.removeFromParent(); barrier.removeFromParent(); pier.removeFromParent();
      geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); texs.forEach(t => t.dispose());
    },
  };
}
