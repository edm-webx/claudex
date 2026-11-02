/**
 * PaketMartı on the pier (survey kurye-2, kurye-3, kurye-7): a small tablet on the counter whose screen blinks while
 * orders wait, and one parked delivery bike per courier beside the kiosk. A bike rides off down the pier when its
 * courier leaves and rides back in when it returns; the rider waits with a bob while the counter is short of items.
 * Weather shows on the riders: umbrella in rain, sled runners in snow. Paint and flag follow the cosmetics.
 * Code-made low-poly meshes, no colliders, view only (reads kuryeApi(rules).view()).
 */
import * as T from 'three';
import { kuryeApi, type KuryeView } from '../../sim/kurye';
import type { Rules } from '../../sim/state';

export interface KuryeLookDeps { scene: T.Object3D; rules: () => Rules | null }
export interface KuryeLookView { update(dt: number): void; dispose(): void }

const PARK = { x: 5.1, z: -9.3, dx: 0.75 };
const RIDE_TO_Z = 3.6;

function screenTex(text: string, on: boolean): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 128; c.height = 80;
  const g = c.getContext('2d')!;
  g.fillStyle = on ? '#ffd23f' : '#2d3a44'; g.fillRect(0, 0, 128, 80);
  g.fillStyle = on ? '#3b2a20' : '#9fd3f0'; g.font = '900 22px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('PaketMartı', 64, 26, 120);
  g.font = '900 26px system-ui, sans-serif'; g.fillText(text, 64, 58, 120);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

interface Bike { g: T.Group; body: T.Mesh; box: T.Mesh; rider: T.Group; umb: T.Group; sled: T.Group; wheels: T.Group; flag: T.Mesh; prevState: string }

export function createKuryeLook(d: KuryeLookDeps): KuryeLookView {
  const root = new T.Group(); root.name = 'kuryeLook';
  const geos: T.BufferGeometry[] = [], mats: T.Material[] = [], texs: T.Texture[] = [];
  const G = <X extends T.BufferGeometry>(g: X) => { geos.push(g); return g; };
  const M = <X extends T.Material>(m: X) => { mats.push(m); return m; };
  const L = (color: string) => M(new T.MeshLambertMaterial({ color }));

  // ── tablet on the counter
  const tablet = new T.Group();
  const stand = new T.Mesh(G(new T.BoxGeometry(0.2, 0.02, 0.12)), L('#3b2a20'));
  const frame = new T.Mesh(G(new T.BoxGeometry(0.24, 0.16, 0.018)), L('#2a2a2a'));
  frame.position.set(0, 0.09, 0); frame.rotation.x = -0.35;
  const scrOff = screenTex('...', false), scrOn = screenTex('SİPARİŞ!', true); texs.push(scrOff, scrOn);
  const scrMat = M(new T.MeshBasicMaterial({ map: scrOff }));
  const scr = new T.Mesh(G(new T.PlaneGeometry(0.21, 0.13)), scrMat);
  scr.position.set(0, 0.09, 0.011); scr.rotation.x = -0.35;
  const led = new T.Mesh(G(new T.SphereGeometry(0.014, 8, 6)), M(new T.MeshBasicMaterial({ color: '#ff4d4d' })));
  led.position.set(0.1, 0.175, 0.0);
  tablet.add(stand, frame, scr, led);
  tablet.visible = false;
  root.add(tablet);

  // ── bikes
  const ink = L('#3b2a20'), tire = L('#2a2a2a'), skin = L('#f2c9a0'), helmet = L('#ffd23f'), boxM = L('#ffd23f');
  const wheelGeo = G(new T.TorusGeometry(0.17, 0.045, 6, 14));
  const bikes: Bike[] = [];
  function makeBike(): Bike {
    const g = new T.Group();
    const bodyMat = M(new T.MeshLambertMaterial({ color: '#ffd23f' }));
    const body = new T.Mesh(G(new T.BoxGeometry(0.16, 0.12, 0.7)), bodyMat); body.position.y = 0.42;
    const wheels = new T.Group();
    for (const z of [-0.32, 0.32]) { const w = new T.Mesh(wheelGeo, tire); w.rotation.y = Math.PI / 2; w.position.set(0, 0.2, z); wheels.add(w); }
    const bar = new T.Mesh(G(new T.CylinderGeometry(0.018, 0.018, 0.5, 6)), ink); bar.rotation.z = Math.PI / 2; bar.position.set(0, 0.72, 0.3);
    const fork = new T.Mesh(G(new T.CylinderGeometry(0.02, 0.02, 0.5, 6)), ink); fork.position.set(0, 0.47, 0.3);
    const box = new T.Mesh(G(new T.BoxGeometry(0.34, 0.3, 0.32)), boxM); box.position.set(0, 0.68, -0.28);
    const sled = new T.Group();
    for (const x of [-0.12, 0.12]) { const r = new T.Mesh(G(new T.BoxGeometry(0.04, 0.03, 0.95)), L('#9fd3f0')); r.position.set(x, 0.05, 0); sled.add(r); }
    sled.visible = false;
    // rider
    const rider = new T.Group();
    const torso = new T.Mesh(G(new T.BoxGeometry(0.26, 0.34, 0.18)), L('#e0533c')); torso.position.set(0, 0.8, 0.02);
    const head = new T.Mesh(G(new T.SphereGeometry(0.11, 10, 8)), skin); head.position.set(0, 1.08, 0.04);
    const hat = new T.Mesh(G(new T.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), helmet); hat.position.set(0, 1.1, 0.04);
    rider.add(torso, head, hat);
    const umb = new T.Group();
    const pole = new T.Mesh(G(new T.CylinderGeometry(0.012, 0.012, 0.6, 5)), ink); pole.position.set(0.12, 1.3, 0);
    const can = new T.Mesh(G(new T.ConeGeometry(0.42, 0.18, 8, 1, true)), M(new T.MeshLambertMaterial({ color: '#2f86c9', side: T.DoubleSide }))); can.position.set(0.12, 1.62, 0);
    umb.add(pole, can); umb.visible = false; rider.add(umb);
    const flagPole = new T.Mesh(G(new T.CylinderGeometry(0.01, 0.01, 0.6, 4)), ink); flagPole.position.set(0.12, 1.05, -0.38);
    const flag = new T.Mesh(G(new T.PlaneGeometry(0.22, 0.14)), M(new T.MeshLambertMaterial({ color: '#ffffff', side: T.DoubleSide }))); flag.position.set(0.12, 1.28, -0.49); flag.rotation.y = Math.PI / 2;
    flag.add(flagPole); flagPole.position.set(0, -0.23, 0.11); flagPole.rotation.y = -Math.PI / 2;
    g.add(body, wheels, bar, fork, box, sled, rider, flag);
    g.visible = false;
    root.add(g);
    return { g, body, box, rider, umb, sled, wheels, flag, prevState: 'idle' };
  }
  d.scene.add(root);

  let t = 0, poll = 0, v: KuryeView | null = null, tabletKey = '', scrOnNow = false;
  function placeTablet(r: Rules): void {
    const c = r.rt.layout.counter;
    const key = c.pos.x + ',' + c.pos.z + ',' + c.drop.y;
    if (key === tabletKey) return;
    tabletKey = key;
    tablet.position.set(c.pos.x + 0.62, c.drop.y, c.pos.z + 0.05);
  }
  return {
    update(dt) {
      t += dt;
      const r = d.rules();
      if ((poll -= dt) <= 0) {
        poll = 0.2;
        const api = kuryeApi(r);
        v = api && r && r.rt.started ? api.view() : null;
        root.visible = !!v && v.on;
        if (r && v) placeTablet(r);
        tablet.visible = !!v && v.on;
      }
      if (!v || !v.on) return;
      // tablet blink
      const want = v.tablet.length > 0 && Math.floor(t * 2.5) % 2 === 0;
      if (want !== scrOnNow) { scrOnNow = want; scrMat.map = want ? scrOn : scrOff; scrMat.needsUpdate = true; }
      led.visible = v.tablet.length > 0 ? Math.floor(t * 4) % 2 === 0 : false;
      tablet.position.y += 0;
      // bikes
      while (bikes.length < v.couriers.length) bikes.push(makeBike());
      const rain = v.hava.id === 'yagmur', snow = v.hava.id === 'kar';
      for (let i = 0; i < bikes.length; i++) {
        const b = bikes[i], c = v.couriers[i];
        if (!c) { b.g.visible = false; continue; }
        (b.body.material as T.MeshLambertMaterial).color.set(v.boya);
        (b.flag.material as T.MeshLambertMaterial).color.set(v.bayrak);
        b.flag.visible = v.bayrak.toLowerCase() !== '#ffffff';
        b.flag.rotation.z = Math.sin(t * 6 + i) * 0.15;
        b.umb.visible = rain; b.sled.visible = snow; b.wheels.visible = !snow;
        const px = PARK.x + i * PARK.dx, pz = PARK.z;
        let x = px, z = pz, vis = true, ry = 0, bob = 0;
        if (c.state === 'idle' || c.state === 'wait') { ry = 0; bob = c.state === 'wait' ? Math.abs(Math.sin(t * 5 + i)) * 0.03 : 0; b.rider.rotation.y = c.state === 'wait' ? Math.sin(t * 1.5 + i) * 0.6 : 0; }
        else if (c.state === 'out') { const f = Math.min(1, c.k / 0.3); if (c.k > 0.3) vis = false; z = pz + (RIDE_TO_Z - pz) * f; ry = 0; bob = Math.sin(t * 18) * 0.015; b.rider.rotation.y = 0; }
        else { const f = c.k < 0.7 ? 0 : (c.k - 0.7) / 0.3; if (c.k < 0.7) vis = false; z = RIDE_TO_Z + (pz - RIDE_TO_Z) * f; ry = Math.PI; bob = Math.sin(t * 18) * 0.015; b.rider.rotation.y = 0; }
        b.g.visible = vis;
        b.g.position.set(x, bob, z);
        b.g.rotation.y = ry;
        if (!snow) for (const w of b.wheels.children) w.rotation.z += (c.state === 'out' || c.state === 'back') ? dt * 12 : 0;
        b.prevState = c.state;
      }
    },
    dispose() { root.removeFromParent(); for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const x of texs) x.dispose(); },
  };
}
