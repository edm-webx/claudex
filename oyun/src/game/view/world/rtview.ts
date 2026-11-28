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
import { avmIcinde, katY } from '../../../content/avm-kat';
import { hstIcinde } from '../../../content/hastane-kat';
import * as T from 'three';
import type { Rules, Item, MoneyStack } from '../../sim/state';
import type { AnchorDef } from '../../../engine/api';
import { itemGeo, moneyGeo, ITEM_HT, makeMarker } from '../../../content/prefabs/iskele/props';
import { MAT } from '../../../content/prefabs/common/v2kit';
import { padDef, padCost } from '../../../content/pads';
import { mutfakDunya, mutfakUst } from '../../../content/ic-mekan';
import { BULASIK } from '../../../content/mutfak';
import { makeUrunModel } from '../chars/urun-model';
import { yemekVar, yemekGeo, yemekH } from '../../../content/prefabs/yemek/yemek-geo';
import { STATION_KINDS, counterSlot } from '../../../content/prefabs/iskele/layout';
import type { StageLayout } from '../../../content/prefabs/iskele/layout';

export interface RtEnv {
  root(): T.Object3D | null;
  anchors(): Record<string, AnchorDef>;
  layout(): StageLayout;
  /** interpolated hero pose (falls back to the sim position) */
  pose?(): { x: number; z: number; rot: number } | null;
}

type Pt = { x: number; y: number; z: number; s?: number };
interface Entry { s?: number; key: string; obj: object; x: number; y: number; z: number; rot: number; fly: null | { t: number; dur: number; fx: number; fy: number; fz: number; arc: number }; h: number; seen: number; }
interface Sink { s?: number; key: string; x: number; y: number; z: number; rot: number; t: number; dur: number; tx: number; ty: number; tz: number; fx: number; fy: number; fz: number; }

const CAP = 96, PROD = ['doner', 'cay', 'ayran', 'simit', 'tost', 'gazoz'] as const;
const hashf = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const itemH = (it: Item<string>) => { const t = (ITEM_HT as Record<string, number[]>)[it.type]; return t ? t[Math.max(0, Math.min(3, (it.tier || 1) - 1))] : yemekVar(it.type) ? yemekH(it.type) : 0.1; };
/** 2026-11-25: mutfak yemeği (kendi tabağı / kâsesi modelin içinde): elde üst üste değil, tepside yan yana dizilir */
const isDish = (it: Item<string>) => !(PROD as readonly string[]).includes(it.type) && yemekVar(it.type);

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
    else if (key.startsWith('y:')) m = new T.InstancedMesh(yemekGeo(key.slice(2)), MAT.atlas, CAP);
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
  const padMk = new Map<string, { g: T.Object3D; price: number; sub?: string }>();
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
  let tepsiKey = '';
  const tepsiObj: T.Object3D[] = [], urunHavuz = new Map<string, T.Object3D[]>();
  const urunPool = (id: string, n: number): T.Object3D => { let p = urunHavuz.get(id); if (!p) { p = []; urunHavuz.set(id, p); } while (p.length <= n) { const o = makeUrunModel(id); o.userData.id = id; p.push(o); } return p[n]; };
  // trash bin outside the kitchen (see binPos in sim/pads.ts)
  const binG = new T.Group(); binG.name = 'copKutusu';
  { const body = new T.Mesh(new T.CylinderGeometry(0.34, 0.28, 0.8, 14), new T.MeshLambertMaterial({ color: '#4d6b5a' })); body.position.y = 0.4; binG.add(body);
    const lid = new T.Mesh(new T.CylinderGeometry(0.37, 0.37, 0.07, 14), new T.MeshLambertMaterial({ color: '#35493e' })); lid.position.y = 0.84; binG.add(lid);
    const band = new T.Mesh(new T.CylinderGeometry(0.335, 0.335, 0.06, 14), new T.MeshLambertMaterial({ color: '#e8e2d4' })); band.position.y = 0.55; binG.add(band); }
  group.add(binG);
  // Martı AVM diyarı: iskele kökü orada gizli; AVM kareleri ve halka sahnede ayrı bir grupta (katın yüksekliğinde)
  const avmGrp = new T.Group(); avmGrp.name = 'rtviewAvm';
  let sc0: T.Object3D | null = null;   // the scene, remembered: the iskele zone root unloads while the hero is inside the AVM realm
  function ensureAttached() { const r = env.root(); if (r && group.parent !== r) { group.parent?.remove(group); r.add(group); } if (r?.parent) sc0 = r.parent; if (sc0 && avmGrp.parent !== sc0) sc0.add(avmGrp); return !!r || !!sc0; }

  function place(obj: object, key: string, to: Pt, rot: number, h: number, from: Pt | null, dur = 0.28, arc = 0.5) {
    let e = entries.get(obj);
    if (!e) {
      e = { key, obj, x: to.x, y: to.y, z: to.z, rot, fly: null, h, seen: frame };
      if (from) e.fly = { t: 0, dur, fx: from.x, fy: from.y, fz: from.z, arc };
      entries.set(obj, e);
    }
    e.seen = frame; e.key = key; e.h = h; e.rot = rot; e.s = to.s;
    const x = to.x, y = to.y, z = to.z;
    e.x = x; e.y = y; e.z = z;
    return e;
  }

  const sinkAt = (e: Entry, t: Pt) => { sinks.push({ s: e.s, key: e.key, x: e.x, y: e.y, z: e.z, rot: e.rot, t: 0, dur: 0.25, tx: t.x, ty: t.y, tz: t.z, fx: e.x, fy: e.y, fz: e.z }); };

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
    // 2026-11-23 dükkân tepsisi (sim/agents/kafe.ts rt.kafeTepsi): karşı yaka / AVM dükkânında makineden alınan ürünler aynı tepside
    const kt = (rt as unknown as { kafeTepsi?: { kat: number; items: string[] } }).kafeTepsi, ktN = kt ? kt.items.length : 0;
    const pk0 = rules.playerPos as { x: number; z: number; kat?: number }, avmT = ktN > 0 && avmIcinde(pk0, 3), ty = avmT ? katY(pk0.kat || 0) : 0;
    const tp = avmT ? avmGrp : group; if (trayG.parent !== tp) tp.add(trayG);
    trayG.visible = rt.carry.length > 0 || ktN > 0; trayRect.visible = !master; trayRound.visible = master;
    if (trayG.visible) { trayG.position.set(hx, hy + ty, hz); trayG.rotation.y = pp.rot; }
    {   // tepsi ürünleri trayG'nin çocukları (yerel konum): makine görünümündeki aynı model, küçük havuz
      const want = ktN ? kt!.items.join('|') : '';
      if (want !== tepsiKey) {
        tepsiKey = want; for (const o of tepsiObj) trayG.remove(o); tepsiObj.length = 0;
        (ktN ? kt!.items : []).forEach((id, i) => { const o = urunPool(id, tepsiObj.filter(x => x.userData.id === id).length); o.position.set((i - (ktN - 1) / 2) * 0.2, 0.02, 0); o.scale.setScalar(o instanceof T.Mesh ? 0.95 : 1.15); trayG.add(o); tepsiObj.push(o); });
      }
    }
    const emit = (obj: object, key: string, to: Pt, rot: number, h: number, from: Pt | null, dur?: number, arc?: number) => { place(obj, key, to, rot, h, frame <= 2 ? null : from, dur, arc); };
    // BUF-06: oyuncunun elindeki mutfak tabağı (yemek kimliği) ürün modeli değil, sade tabak olarak çizilir
    // 2026-11-25 sahip: "tepsiye gelen ürünler hep aynı düz yuvarlak bişey": yemek kimliği artık kendi modeliyle (content/prefabs/yemek)
    const itemKey = (it: Item<string>) => ((PROD as readonly string[]).includes(it.type) ? it.type + ':' + Math.max(1, Math.min(4, it.tier || 1)) : yemekVar(it.type) ? 'y:' + it.type : 'plate');

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
    {   // büfe ürünleri elde üst üste (eskisi gibi); yemekler tepside 2x2 yan yana, beşinciden sonra ikinci kat
      const sc = Math.cos(pp.rot), sn = Math.sin(pp.rot), urunler = rt.carry.filter(it => !isDish(it));
      let yd = 0, kat = 0;
      rt.carry.forEach((it) => {
        if (!isDish(it)) { const i = urunler.indexOf(it), p = hand(i, urunler), k = Math.min(1, i / 5); p.x += wob.ox * k; p.z += wob.oz * k; emit(it, itemKey(it), p, pp.rot + wob.ox * k * 2, itemH(it), null); return; }
        // dikdörtgen tepsi 0.62x0.4: 2x2, ölçek 0.75; yuvarlak tepsi r 0.27: dört çeyrek, ölçek 0.7 (tabaklar tepsiden taşmaz)
        const j = yd++ % 4; if (j === 0 && yd > 1) kat += 0.06;
        const lx = (j % 2 ? 1 : -1) * (master ? 0.105 : 0.15), lz = (j < 2 ? -1 : 1) * (master ? 0.105 : 0.085), ol = master ? 0.7 : 0.8;
        emit(it, itemKey(it), { x: hx + lx * sc + lz * sn + wob.ox, y: hy + 0.03 + kat, z: hz - lx * sn + lz * sc + wob.oz, s: ol }, pp.rot + wob.ox * 2, itemH(it) * ol, null);
      });
    }
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
        const sl = counterSlot(L, pi, col);
        emit(it, itemKey(it), { x: sl.x, y: (d.y || 1) + y, z: sl.z }, 0, itemH(it), hand(0, []), 0.28, 0.5);
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
    // BUF-13: kirli tabak yığını bulaşık istasyonunda (sim: rt.dirtyDishes; en çok BULASIK.gorunur disk, iki sütun, aşama 5'ten önce 0)
    {
      const n = Math.min(BULASIK.gorunur, rt.dirtyDishes || 0), top = mutfakUst('bulasik');
      for (let k = 0; k < BULASIK.gorunur; k++) {
        const key = 'dish.' + k; let o = plateObjs.get(key); if (!o) { o = {}; plateObjs.set(key, o); }
        if (k < n) { const w = mutfakDunya([top[0] + (k % 2 ? 0.32 : -0.32), top[1]]); emit(o, 'plate', { x: w.x, y: 0.99 + Math.floor(k / 2) * 0.03, z: w.z }, 0, 0.04, null); }
        else { const e = entries.get(o); if (e) entries.delete(o); }
      }
    }
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
    const write = (key: string, x: number, y: number, z: number, rot: number, sc = 1) => {
      const m = meshFor(key), n = used.get(key) ?? 0; if (n >= CAP) return;
      Q.setFromAxisAngle(AX, rot); P.set(x, y, z); S.setScalar(sc); M.compose(P, Q, S); m.setMatrixAt(n, M); used.set(key, n + 1);
    };
    entries.forEach(e => {
      let x = e.x, y = e.y, z = e.z;
      if (e.fly) {
        e.fly.t += dt / e.fly.dur;
        const kk = Math.min(1, e.fly.t), ea = easeOut(kk);
        x = e.fly.fx + (x - e.fly.fx) * ea; y = e.fly.fy + (y - e.fly.fy) * ea + Math.sin(kk * Math.PI) * e.fly.arc; z = e.fly.fz + (z - e.fly.fz) * ea;
        if (kk >= 1) e.fly = null;
      }
      write(e.key, x, y, z, e.rot, e.s ?? 1);
    });
    for (let i = sinks.length - 1; i >= 0; i--) {
      const s = sinks[i]; s.t += dt / s.dur; const k = Math.min(1, s.t), ea = easeOut(k);
      write(s.key, s.fx + (s.tx - s.fx) * ea, s.fy + (s.ty - s.fy) * ea + Math.sin(k * Math.PI) * 0.4, s.fz + (s.tz - s.fz) * ea, s.rot, s.s ?? 1);
      if (k >= 1) sinks.splice(i, 1);
    }
    inst.forEach((m, key) => { const n = used.get(key) ?? 0; m.count = n; m.instanceMatrix.needsUpdate = true; m.visible = n > 0; });

    // ---- pads (yellow squares)
    const root = group;
    const keep = new Set<string>();
    rt.pads.forEach(pd => {
      keep.add(pd.key);
      const def0 = padDef(pd.key) ?? (pd.label ? { label: pd.label, sub: pd.sub || '' } : null); if (!def0) return;
      // 2026-11-25 misafir: kareleri ev sahibi açar (sim/pads.ts misafirKare); kare sarı/alınabilir görünüp para çekmesin, gri "Ev sahibi açar" yazsın
      const def = (rt as { misafir?: boolean }).misafir ? { ...def0, sub: '🔒 Ev sahibi açar' } : def0;
      const price = pd.price || padCost(pd.key, rules.state.stage);
      let rec = padMk.get(pd.key);
      const paid = rules.state.padPaid[pd.key] || 0;
      // 2026-10-25 user: while paying, the price drains like a fuel pump (shows what is still left)
      const shown = paid > 0.5 ? Math.max(0, Math.ceil((price - paid) / 10) * 10) : Math.round(price);
      if (!rec) {
        const g = makeMarker('pad', { label: def.label, sub: def.sub, price: shown }) as T.Object3D;
        (pd.kat !== undefined ? avmGrp : root).add(g); rec = { g, price: shown, sub: def.sub }; padMk.set(pd.key, rec);
      } else if (rec.price !== shown || rec.sub !== def.sub) {   /* kilit satırı (content/acilis.ts görev sayacı) değişince de yenilenir */ rec.price = shown; rec.sub = def.sub; (rec.g.userData.setText as (a: unknown) => void)({ label: def.label, sub: def.sub, price: shown }); }
      rec.g.position.set(pd.pos.x, pd.y || 0, pd.pos.z); rec.g.visible = (pd.kat || 0) <= ((rules.playerPos as { kat?: number }).kat || 0);   // Martı AVM: on its floor, hidden above the hero's (cutaway)
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
      const pk = rules.playerPos as { x: number; z: number; kat?: number }, avm = avmIcinde(pk, 3) || hstIcinde(pk, 3);   // AVM / hastane diyarı
      const dp = avm ? avmGrp : group; if (dwell.g.parent !== dp) dp.add(dwell.g);
      dwell.g.visible = true; dwell.g.position.set(it.pos.x, avm ? katY(pk.kat || 0) : 0, it.pos.z);
      const step = ds.transferring ? 48 : Math.max(1, Math.round(ds.progress * 48));
      if (step !== dwell.last) {
        dwell.last = step;
        let g = dwellGeos.get(step); if (!g) { g = new T.RingGeometry(0.46, 0.62, 40, 1, Math.PI / 2, -(step / 48) * Math.PI * 2 - 1e-3); dwellGeos.set(step, g); }
        dwell.ring!.geometry = g;
      }
      dwellMat.color.set(ds.transferring ? '#7bd88f' : '#ffd23f');
      dwell.g.scale.set(1, 1, 1);   // steady ring: no per-frame pulse (it read as jitter on phones)
    } else {
      // 2026-11-25: mutfakta hazırlarken oyuncunun çevresinde dolan halka (büfedeki gibi ne kadar kaldığı görünür)
      const mo = (rules.rt as unknown as { mutfakOyuncu?: { ist: string | null; frac: number } }).mutfakOyuncu, pk = rules.playerPos as { x: number; z: number };
      if (mo?.ist && rt.act !== 'idle' && rt.actT > 0) {
        if (dwell.g.parent !== group) group.add(dwell.g);
        dwell.g.visible = true; dwell.g.position.set(pk.x, 0.16, pk.z);
        const step = Math.max(1, Math.round(mo.frac * 48));
        if (step !== dwell.last) { dwell.last = step; let g = dwellGeos.get(step); if (!g) { g = new T.RingGeometry(0.46, 0.62, 40, 1, Math.PI / 2, -(step / 48) * Math.PI * 2 - 1e-3); dwellGeos.set(step, g); } dwell.ring!.geometry = g; }
        dwellMat.color.set('#ff9a3d');
      } else { dwell.g.visible = false; dwell.last = -1; }
    }
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
