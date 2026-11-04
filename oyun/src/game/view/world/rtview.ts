/**
 * Runtime half of the pier world view (M1): draws what the sim holds in `rules.rt` (Builder A) and nothing else.
 * Reads only: player hands, station trays, counter stacks, kasa pile, floor money, table piles + plates, customers'
 * hands, yellow pads (fill = state.padPaid / price), the red slow-spot ring and the dwell ring on the ground.
 * Items are InstancedMesh batches per (product, tier) so 60+ stacked units cost a handful of draw calls.
 * Items are tracked by object identity: when the sim moves the same Item between arrays the mesh flies (v2 put()),
 * when it disappears it flies to a sink point (customer / chest) and vanishes. New items spawn at a holder-specific
 * origin (hero hand for the counter, station tray for hands, ...) so transfers read like v2.
 * Never writes sim state. No Math.random (plates use a hash).
 */
import * as T from 'three';
import type { Rules, Item, MoneyStack } from '../../sim/state';
import type { AnchorDef } from '../../../engine/api';
import { itemGeo, moneyGeo, ITEM_HT, makeMarker } from '../../../content/prefabs/iskele/props';
import { MAT } from '../../../content/prefabs/common/v2kit';
import { padDef, padCost } from '../../../content/pads';
import { STATION_KINDS } from '../../../content/prefabs/iskele/layout';
import type { StageLayout } from '../../../content/prefabs/iskele/layout';

export interface RtEnv {
  root(): T.Object3D | null;
  anchors(): Record<string, AnchorDef>;
  layout(): StageLayout;
  /** interpolated hero pose (falls back to the sim position) */
  pose?(): { x: number; z: number; rot: number } | null;
}

type Pt = { x: number; y: number; z: number };
interface Entry { key: string; obj: object; x: number; y: number; z: number; rot: number; fly: null | { t: number; dur: number; fx: number; fy: number; fz: number; arc: number }; h: number; seen: number; }
interface Sink { key: string; x: number; y: number; z: number; rot: number; t: number; dur: number; tx: number; ty: number; tz: number; fx: number; fy: number; fz: number; }

const CAP = 96, PROD = ['doner', 'cay', 'ayran', 'simit', 'tost', 'gazoz'] as const;
const hashf = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const itemH = (it: Item) => { const t = (ITEM_HT as Record<string, number[]>)[it.type]; return t ? t[Math.max(0, Math.min(3, (it.tier || 1) - 1))] : 0.1; };

export interface RtView {
  update(rules: Rules, dt: number): void;
  dispose(): void;
}

export function createRtView(env: RtEnv): RtView {
  const group = new T.Group(); group.name = 'rtview';
  const inst = new Map<string, T.InstancedMesh>();
  const plateGeo = new T.CylinderGeometry(0.17, 0.13, 0.035, 14);
  const plateMat = new T.MeshLambertMaterial({ color: '#f4f1ea' });
  function meshFor(key: string): T.InstancedMesh {
    let m = inst.get(key);
    if (m) return m;
    if (key === 'money') m = new T.InstancedMesh(moneyGeo(), MAT.atlas, CAP);
    else if (key === 'plate') m = new T.InstancedMesh(plateGeo, plateMat, CAP);
    else { const [p, t] = key.split(':'); m = new T.InstancedMesh(itemGeo(p, +t), MAT.atlas, CAP); }
    m.frustumCulled = false; m.castShadow = true; m.count = 0; m.name = 'items-' + key;
    inst.set(key, m); group.add(m); return m;
  }
  const entries = new Map<object, Entry>();
  const sinks: Sink[] = [];
  let frame = 0;
  const M = new T.Matrix4(), Q = new T.Quaternion(), S = new T.Vector3(1, 1, 1), P = new T.Vector3(), AX = new T.Vector3(0, 1, 0);
  const used = new Map<string, number>();

  // ---- ground markers
  const padMk = new Map<string, { g: T.Object3D; price: number }>();
  let slowMk: T.Object3D | null = null;
  let focusMk: T.Object3D | null = null, focusBeam: T.Mesh | null = null;
  const dwell = { g: new T.Group(), ring: null as T.Mesh | null, base: null as T.Mesh | null, last: -1 };
  dwell.g.visible = false; dwell.g.name = 'dwellRing';
  const dwellGeos = new Map<number, T.RingGeometry>();
  const dwellMat = new T.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.9, depthWrite: false, side: T.DoubleSide });
  const dwellBaseMat = new T.MeshBasicMaterial({ color: '#19120c', transparent: true, opacity: 0.35, depthWrite: false, side: T.DoubleSide });
  dwell.base = new T.Mesh(new T.RingGeometry(0.46, 0.62, 40), dwellBaseMat);
  dwell.base.rotation.x = -Math.PI / 2; dwell.base.position.y = 0.045; dwell.base.renderOrder = 5;
  dwell.ring = new T.Mesh(new T.RingGeometry(0.46, 0.62, 40, 1, 0, 0.01), dwellMat);
  dwell.ring.rotation.x = -Math.PI / 2; dwell.ring.position.y = 0.05; dwell.ring.renderOrder = 6;
  dwell.g.add(dwell.base, dwell.ring);
  group.add(dwell.g);

  // 2026-10-25 user: the hero carries a real tray: a rectangular two-hand tray at first, a round one-hand tray with mastery
  const trayG = new T.Group(); trayG.visible = false; trayG.name = 'heroTray';
  const trayWood = new T.MeshLambertMaterial({ color: '#b9885a' }), trayRim = new T.MeshLambertMaterial({ color: '#8a5f38' });
  const trayRect = new T.Group(), trayRound = new T.Group();
  { const b = new T.Mesh(new T.BoxGeometry(0.62, 0.035, 0.4), trayWood); trayRect.add(b);
    for (const [w, d, x, z] of [[0.62, 0.025, 0, 0.2], [0.62, 0.025, 0, -0.2], [0.025, 0.4, 0.3, 0], [0.025, 0.4, -0.3, 0]] as number[][]) { const r = new T.Mesh(new T.BoxGeometry(w, 0.05, d), trayRim); r.position.set(x, 0.03, z); trayRect.add(r); } }
  { const b = new T.Mesh(new T.CylinderGeometry(0.27, 0.27, 0.03, 20), trayWood); trayRound.add(b); const r = new T.Mesh(new T.TorusGeometry(0.27, 0.014, 6, 24), trayRim); r.rotation.x = Math.PI / 2; r.position.y = 0.02; trayRound.add(r); }
  trayG.add(trayRect, trayRound);
  group.add(trayG);
  // trash bin outside the kitchen (see binPos in sim/pads.ts)
  const binG = new T.Group(); binG.name = 'copKutusu';
  { const body = new T.Mesh(new T.CylinderGeometry(0.34, 0.28, 0.8, 14), new T.MeshLambertMaterial({ color: '#4d6b5a' })); body.position.y = 0.4; binG.add(body);
    const lid = new T.Mesh(new T.CylinderGeometry(0.37, 0.37, 0.07, 14), new T.MeshLambertMaterial({ color: '#35493e' })); lid.position.y = 0.84; binG.add(lid);
    const band = new T.Mesh(new T.CylinderGeometry(0.335, 0.335, 0.06, 14), new T.MeshLambertMaterial({ color: '#e8e2d4' })); band.position.y = 0.55; binG.add(band); }
  group.add(binG);
  function ensureAttached() { const r = env.root(); if (r && group.parent !== r) { group.parent?.remove(group); r.add(group); } return !!r; }

  function place(obj: object, key: string, to: Pt, rot: number, h: number, from: Pt | null, dur = 0.28, arc = 0.5) {
    let e = entries.get(obj);
    if (!e) {
      e = { key, obj, x: to.x, y: to.y, z: to.z, rot, fly: null, h, seen: frame };
      if (from) e.fly = { t: 0, dur, fx: from.x, fy: from.y, fz: from.z, arc };
      entries.set(obj, e);
    }
    e.seen = frame; e.key = key; e.h = h; e.rot = rot;
    const x = to.x, y = to.y, z = to.z;
    e.x = x; e.y = y; e.z = z;
    return e;
  }

  const sinkAt = (e: Entry, t: Pt) => { sinks.push({ key: e.key, x: e.x, y: e.y, z: e.z, rot: e.rot, t: 0, dur: 0.25, tx: t.x, ty: t.y, tz: t.z, fx: e.x, fy: e.y, fz: e.z }); };

  const wob = { lx: NaN, lz: NaN, vx: 0, vz: 0, ox: 0, oz: 0, sx: 0, sz: 0 };
  function update(rules: Rules, dt: number) {
    if (!ensureAttached()) return;
    frame++;
    const rt = rules.rt, A = env.anchors(), L = env.layout();
    binG.position.set(L.counter.pos.x - 4.4, 0, L.counter.pos.z + 1.6);
    const pp = env.pose?.() ?? { x: rules.playerPos.x, z: rules.playerPos.z, rot: rules.state.player.rot };
    const chest: Pt = { x: pp.x, y: 1.15, z: pp.z };
    const master = (rules.state.level || 1) >= 8;   // mastery: one hand, round tray held out to the side
    const hx = pp.x + Math.sin(pp.rot) * 0.4 + (master ? Math.cos(pp.rot) * 0.28 : 0), hz = pp.z + Math.cos(pp.rot) * 0.4 - (master ? Math.sin(pp.rot) * 0.28 : 0), hy = master ? 1.32 : 1.0;
    const hand = (i: number, items: Item[]): Pt => {
      let y = hy + 0.03; for (let k = 0; k < i; k++) y += itemH(items[k]);
      return { x: hx, y, z: hz };
    };
    trayG.visible = rt.carry.length > 0; trayRect.visible = !master; trayRound.visible = master;
    if (trayG.visible) { trayG.position.set(hx, hy, hz); trayG.rotation.y = pp.rot; }
    const emit = (obj: object, key: string, to: Pt, rot: number, h: number, from: Pt | null, dur?: number, arc?: number) => { place(obj, key, to, rot, h, frame <= 2 ? null : from, dur, arc); };
    const itemKey = (it: Item) => it.type + ':' + Math.max(1, Math.min(4, it.tier || 1));

    // player hands (spawn from the station tray they came from is implicit: the same Item object flies)
    // animasyon-3: the stack sways a little against the hero's acceleration (damped spring, clamped), never falls
    if (dt > 0 && wob.lx === wob.lx) {
      const vx = (pp.x - wob.lx) / dt, vz = (pp.z - wob.lz) / dt, ax = (vx - wob.vx) / dt, az = (vz - wob.vz) / dt;
      wob.vx = vx; wob.vz = vz;
      const n = Math.max(1, Math.ceil(dt * 120)), h = dt / n;
      for (let j = 0; j < n; j++) {
        wob.sx += (-wob.ox * 90 - wob.sx * 7 - Math.max(-40, Math.min(40, ax)) * 0.05) * h; wob.sz += (-wob.oz * 90 - wob.sz * 7 - Math.max(-40, Math.min(40, az)) * 0.05) * h;
        wob.ox += wob.sx * h; wob.oz += wob.sz * h;
      }
      const l = Math.hypot(wob.ox, wob.oz); if (l > 0.05) { wob.ox *= 0.05 / l; wob.oz *= 0.05 / l; }
    }
    wob.lx = pp.x; wob.lz = pp.z;
    rt.carry.forEach((it, i) => { const p = hand(i, rt.carry), k = Math.min(1, i / 5); p.x += wob.ox * k; p.z += wob.oz * k; emit(it, itemKey(it), p, pp.rot + wob.ox * k * 2, itemH(it), null); });
    // station trays
    STATION_KINDS.forEach(k => {
      const st = rt.stations[k]; const o = A['stations.' + k + '.out']; if (!st || !o) return;
      const r = L.stations[k]?.rotY ?? 0;
      st.out.forEach((it, i) => {
        const col = Math.floor(i / 4); let y = 0; for (let n = col * 4; n < i; n++) y += itemH(st.out[n]);
        const off = (col - 0.5) * 0.22;
        emit(it, itemKey(it), { x: o.pos.x + Math.cos(r) * off, y: (o.y || 0.95) + y, z: o.pos.z - Math.sin(r) * off }, r, itemH(it), { x: o.pos.x, y: (o.y || 0.95) + 0.2, z: o.pos.z }, 0.28, 0.4);
      });
    });
    // counter stacks
    const d = L.counter.drop;
    PROD.forEach((p, pi) => {
      const arr = rt.counter[p]; if (!arr) return;
      arr.forEach((it, i) => {
        const col = Math.floor(i / 4); let y = 0; for (let n = col * 4; n < i; n++) y += itemH(arr[n]);
        emit(it, itemKey(it), { x: d.x + (pi - 2.5) * 0.24, y: (d.y || 1) + y, z: d.z + (col ? -0.14 : 0.06) }, 0, itemH(it), hand(0, []), 0.28, 0.5);
      });
    });
    // kasa pile
    const kp = L.kasa.pile;
    rt.kasa.forEach((m: MoneyStack, i) => {
      const per = 6, layer = Math.floor(i / per), r = i % per;
      emit(m, 'money', { x: kp.x + ((r % 3) - 1) * 0.36, y: (kp.y || 0) + layer * 0.07, z: kp.z + (Math.floor(r / 3) - 0.5) * 0.22 }, 0, 0.06, { x: kp.x, y: (kp.y || 0) + 1, z: kp.z }, 0.4, 0.7);
    });
    // floor money
    rt.floor.forEach(f => emit(f, 'money', { x: f.x, y: 0.03, z: f.z }, 0.5, 0.06, { x: f.x, y: 1, z: f.z }, 0.4, 0.6));
    // tables: tip piles + dirty plates
    rt.tables.forEach((tb, i) => {
      const pile = A['tables.' + i + '.pile']; if (!pile || !tb.built) return;
      tb.pile.forEach((m, k) => {
        const per = 4, layer = Math.floor(k / per), r = k % per;
        emit(m, 'money', { x: pile.pos.x + ((r % 2) - 0.5) * 0.24, y: (pile.y || 0.8) + layer * 0.06, z: pile.pos.z + (Math.floor(r / 2) - 0.5) * 0.18 }, 0.2, 0.06, null);
      });
      for (let k = 0; k < tb.dirty; k++) {
        const key = ('plate' + i + '.' + k); let o = plateObjs.get(key); if (!o) { o = {}; plateObjs.set(key, o); }
        emit(o, 'plate', { x: pile.pos.x + (hashf(i, k) - 0.5) * 0.4, y: 0.82 + 0.03, z: pile.pos.z + (hashf(k, i + 9) - 0.5) * 0.3 }, 0, 0.04, null);
      }
      for (let k = tb.dirty; k < 8; k++) { const o = plateObjs.get('plate' + i + '.' + k); if (o) { const e = entries.get(o); if (e) { sinkAt(e, chest); entries.delete(o); } } }
    });
    // customers' hands
    rt.customers.forEach(c => {
      if (!c.items.length) return;
      c.items.forEach((it, i) => {
        let y = c.sit ? 0.82 : 1.0; for (let k = 0; k < i; k++) y += itemH(c.items[k]);
        emit(it, itemKey(it), { x: c.x + Math.sin(c.rot) * 0.32, y, z: c.z + Math.cos(c.rot) * 0.32 }, c.rot, itemH(it), null);
      });
    });

    // vanished entries sink
    entries.forEach((e, obj) => {
      if (e.seen === frame) return;
      const tgt: Pt = e.key === 'money' ? chest : (rt.queue[0] ? { x: rt.queue[0].x, y: 1.1, z: rt.queue[0].z } : chest);
      sinkAt(e, tgt); entries.delete(obj);
    });

    // advance flights and write instances
    used.clear();
    const write = (key: string, x: number, y: number, z: number, rot: number) => {
      const m = meshFor(key), n = used.get(key) ?? 0; if (n >= CAP) return;
      Q.setFromAxisAngle(AX, rot); P.set(x, y, z); M.compose(P, Q, S); m.setMatrixAt(n, M); used.set(key, n + 1);
    };
    entries.forEach(e => {
      let x = e.x, y = e.y, z = e.z;
      if (e.fly) {
        e.fly.t += dt / e.fly.dur;
        const kk = Math.min(1, e.fly.t), ea = easeOut(kk);
        x = e.fly.fx + (x - e.fly.fx) * ea; y = e.fly.fy + (y - e.fly.fy) * ea + Math.sin(kk * Math.PI) * e.fly.arc; z = e.fly.fz + (z - e.fly.fz) * ea;
        if (kk >= 1) e.fly = null;
      }
      write(e.key, x, y, z, e.rot);
    });
    for (let i = sinks.length - 1; i >= 0; i--) {
      const s = sinks[i]; s.t += dt / s.dur; const k = Math.min(1, s.t), ea = easeOut(k);
      write(s.key, s.fx + (s.tx - s.fx) * ea, s.fy + (s.ty - s.fy) * ea + Math.sin(k * Math.PI) * 0.4, s.fz + (s.tz - s.fz) * ea, s.rot);
      if (k >= 1) sinks.splice(i, 1);
    }
    inst.forEach((m, key) => { const n = used.get(key) ?? 0; m.count = n; m.instanceMatrix.needsUpdate = true; m.visible = n > 0; });

    // ---- pads (yellow squares)
    const root = group;
    const keep = new Set<string>();
    rt.pads.forEach(pd => {
      keep.add(pd.key);
      const def = padDef(pd.key) ?? (pd.label ? { label: pd.label, sub: pd.sub || '' } : null); if (!def) return;
      const price = pd.price || padCost(pd.key, rules.state.stage);
      let rec = padMk.get(pd.key);
      const paid = rules.state.padPaid[pd.key] || 0;
      // 2026-10-25 user: while paying, the price drains like a fuel pump (shows what is still left)
      const shown = paid > 0.5 ? Math.max(0, Math.ceil((price - paid) / 10) * 10) : Math.round(price);
      if (!rec) {
        const g = makeMarker('pad', { label: def.label, sub: def.sub, price: shown }) as T.Object3D;
        root.add(g); rec = { g, price: shown }; padMk.set(pd.key, rec);
      } else if (rec.price !== shown) { rec.price = shown; (rec.g.userData.setText as (a: unknown) => void)({ label: def.label, sub: def.sub, price: shown }); }
      rec.g.position.set(pd.pos.x, 0, pd.pos.z);
      (rec.g.userData.setFill as (k: number) => void)(Math.min(1, paid / Math.max(1, price)));
    });
    padMk.forEach((rec, k) => { if (!keep.has(k)) { rec.g.parent?.remove(rec.g); padMk.delete(k); } });

    // ---- decor focus ring: a bought decor item glows for a moment where it was placed (Faz 2)
    {
      const df = rules.rt.uiLast.decorFocus as { x: number; z: number; until: number } | undefined;
      if (df && rules.state.playT <= df.until) {
        if (!focusMk) { focusMk = makeMarker('ring', { r: 0.7, color: '#ffd23f' }) as T.Object3D; root.add(focusMk); }
        focusMk.visible = true; focusMk.position.set(df.x, 0.05, df.z);
        const k = 1 + 0.12 * Math.sin(rules.state.playT * 8); focusMk.scale.set(k, k, k);
        // survey 2026-10-24 (dekor parlama): a soft golden light pillar over the new item
        if (!focusBeam) { focusBeam = new T.Mesh(new T.CylinderGeometry(0.55, 0.75, 3.2, 20, 1, true), new T.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.35, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending })); focusBeam.renderOrder = 7; root.add(focusBeam); }
        focusBeam.visible = true; focusBeam.position.set(df.x, 1.6, df.z); focusBeam.rotation.y = rules.state.playT * 1.5;
        (focusBeam.material as T.MeshBasicMaterial).opacity = 0.22 + 0.14 * Math.sin(rules.state.playT * 6);
      } else { if (focusMk) focusMk.visible = false; if (focusBeam) focusBeam.visible = false; }
    }
    // ---- slow spot ring (red)
    if (rt.slow) {
      if (!slowMk) { slowMk = makeMarker('ring', { r: 0.9, color: '#e0533c' }) as T.Object3D; root.add(slowMk); }
      slowMk.position.set(rt.slow.at.x, 0, rt.slow.at.z); slowMk.visible = true;
    } else if (slowMk) slowMk.visible = false;

    // ---- dwell ring on the ground
    const ds = rules.interactions.status(rules.player);
    const it = ds ? rules.interactions.get(ds.id) : null;
    // ring only while filling, and green while a real (filled) dwell transfers; a primed resume (progress 0) shows none
    if (ds && it && it.dwell > 0 && (ds.transferring ? ds.progress >= 0.999 : ds.progress > 0.02)) {
      dwell.g.visible = true; dwell.g.position.set(it.pos.x, 0, it.pos.z);
      const step = ds.transferring ? 48 : Math.max(1, Math.round(ds.progress * 48));
      if (step !== dwell.last) {
        dwell.last = step;
        let g = dwellGeos.get(step); if (!g) { g = new T.RingGeometry(0.46, 0.62, 40, 1, Math.PI / 2, -(step / 48) * Math.PI * 2 - 1e-3); dwellGeos.set(step, g); }
        dwell.ring!.geometry = g;
      }
      dwellMat.color.set(ds.transferring ? '#7bd88f' : '#ffd23f');
      dwell.g.scale.set(1, 1, 1);   // steady ring: no per-frame pulse (it read as jitter on phones)
    } else { dwell.g.visible = false; dwell.last = -1; }
  }
  const plateObjs = new Map<string, object>();

  return {
    update,
    dispose() {
      group.parent?.remove(group);
      inst.forEach(m => m.dispose()); dwellGeos.forEach(g => g.dispose()); plateGeo.dispose(); plateMat.dispose();
    },
  };
}
