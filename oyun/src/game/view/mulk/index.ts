/**
 * Mahalle Meydanı mülkleri (karar paketi D/E): the bank building, the plot grid and what stands on each plot (home or shop of
 * the chosen type). Pure view: reads rt.mulk.view() (sim/mulk.ts). Everything is built from boxes in code (no placeholders):
 * stone bank with columns + pediment, fenced lots with a sale sign, houses with hip roofs, shops with striped awnings,
 * stock crates that follow the shelf level. Solid walls go to the nav through `setSolid`.
 */
import * as T from 'three';
import type { Rules } from '../../sim/state';
import { mulkApi } from '../../sim/mulk';
import { BANKA, ARSALAR, DUKKAN_BY_ID } from '../../../content/esya';
import { icBina } from '../../../content/ic-mekan';
import { santiyeKur, type Santiye } from '../world/santiye-kit';
import { binaKur } from '../world/karsi-bina';
import { SETLER } from '../../../content/santiye';
const AVM_ARSA = icBina('avm').map(m => m.arsa || '').sort((x, y) => (ARSALAR.find(a => a.id === x)?.x || 0) - (ARSALAR.find(a => a.id === y)?.x || 0));
import type { Vec3, ScreenPt } from '../../../engine/api';
import type { HtmlLabels, HtmlLabel } from '../../ui/labels';

export interface MulkViewDeps {
  scene: T.Scene; labels: HtmlLabels; project(p: Vec3, out: ScreenPt): boolean; rules: () => Rules | null; hero: () => { x: number; z: number };
  setSolid?: (rects: { x0: number; x1: number; z0: number; z1: number }[]) => void;
}
export interface MulkView { update(dt: number): void; dispose(): void }

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);

export function createMulkView(d: MulkViewDeps): MulkView {
  const geos: T.BufferGeometry[] = [], mats = new Map<string, T.Material>();
  const G = <X extends T.BufferGeometry>(g: X) => { geos.push(g); return g; };
  const M = (c: string, extra: T.MeshLambertMaterialParameters = {}) => { const k = c + JSON.stringify(extra); let m = mats.get(k); if (!m) { m = new T.MeshLambertMaterial({ color: c, ...extra }); mats.set(k, m); } return m; };
  const box = (p: T.Object3D, w: number, h: number, dd: number, c: string, x: number, y: number, z: number, extra: T.MeshLambertMaterialParameters = {}) => { const o = new T.Mesh(G(new T.BoxGeometry(w, h, dd)), M(c, extra)); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; p.add(o); return o; };
  const cyl = (p: T.Object3D, r: number, h: number, c: string, x: number, y: number, z: number, seg = 12) => { const o = new T.Mesh(G(new T.CylinderGeometry(r, r * 1.08, h, seg)), M(c)); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
  const root = new T.Group(); root.name = 'mulk'; d.scene.add(root);
  const tmp: ScreenPt = { x: 0, y: 0 }, at: Vec3 = { x: 0, y: 0, z: 0 };
  const put = (lb: HtmlLabel, x: number, y: number, z: number, html: string) => { at.x = x; at.y = y; at.z = z; if (d.project(at, tmp)) lb.set(tmp.x, tmp.y, html, 'say'); else lb.hide(); };

  /* ---- bank ---- */
  // 2026-11-08: the bank building itself is a detailed model in view/world/karsi-bina.ts; this group stays empty
  const bank = new T.Group(); bank.position.set(BANKA.x, 0, BANKA.z); root.add(bank);
  if (false as boolean) {
    const W = BANKA.w, D = BANKA.d;
    box(bank, W + 0.8, 0.25, D + 0.9, '#b9ad99', 0, 0.12, 0.2);                 // plinth
    box(bank, W, 3.1, D, '#e4d9c0', 0, 1.8, 0);                                 // body
    box(bank, W + 0.5, 0.28, D + 0.5, '#8a6a4a', 0, 3.5, 0);                    // cornice
    for (const dx of [-2.4, -0.8, 0.8, 2.4]) { cyl(bank, 0.24, 3.0, '#f3ecda', dx, 1.75, D / 2 + 0.55); box(bank, 0.6, 0.15, 0.6, '#cfc3aa', dx, 0.33, D / 2 + 0.55); box(bank, 0.6, 0.15, 0.6, '#cfc3aa', dx, 3.28, D / 2 + 0.55); }
    box(bank, W - 0.4, 0.3, 1.5, '#d8cdb4', 0, 3.45, D / 2 + 0.4);               // porch roof
    const ped = new T.Mesh(G(new T.CylinderGeometry(1.5, 1.5, W - 0.2, 3)), M('#e8dec8')); ped.rotation.set(0, 0, Math.PI / 2); ped.scale.set(1, 1, 0.45);   // prism along x (2026-11-04: it lay along z, crossing the roof) ped.position.set(0, 4.3, D / 2 + 0.3); bank.add(ped);
    box(bank, 1.4, 2.2, 0.15, '#3b2a20', 0, 1.35, D / 2 + 0.05);                // door
    box(bank, 1.1, 0.12, 0.16, '#c9a23a', 0, 2.5, D / 2 + 0.1);                  // brass trim
    for (const dx of [-2.3, 2.3]) { box(bank, 1.1, 1.3, 0.12, '#2b4a6a', dx, 1.9, D / 2 + 0.03); box(bank, 1.3, 0.1, 0.2, '#c9a23a', dx, 1.2, D / 2 + 0.08); }
    box(bank, 3.2, 0.5, 0.12, '#c9a23a', 0, 3.9, D / 2 + 0.62, { emissive: '#4a3a10', emissiveIntensity: 0.4 });   // sign plate
    for (const sx of [-1.4, 0, 1.4]) box(bank, 1.1, 0.1, 0.25, '#cfc3aa', sx, 0.35 - 0.2, D / 2 + 1.5 + Math.abs(sx) * 0);   // steps
    for (const sx of [-1, 1]) { cyl(bank, 0.06, 2.6, '#2b2b2b', sx * 3.6, 1.3, D / 2 + 1.2, 8); box(bank, 0.3, 0.3, 0.3, '#ffe9a8', sx * 3.6, 2.7, D / 2 + 1.2, { emissive: '#ffd97a', emissiveIntensity: 0.6 }); }   // lamps
  }
  const bankL = d.labels.label();

  /* ---- plots ---- */
  interface PlotG { g: T.Group; dyn: T.Group; key: string; label: HtmlLabel; sign: string; santiye?: Santiye | null }
  const plots = new Map<string, PlotG>();
  for (const a of ARSALAR) {
    const g = new T.Group(); g.position.set(a.x, 0, a.z); g.rotation.y = a.rotY; root.add(g);
    if (a.sabit) { const dyn = new T.Group(); g.add(dyn); plots.set(a.id, { g, dyn, key: '#', label: d.labels.label(), sign: '' }); continue; }
    box(g, 6.2, 0.1, 4.6, '#7fa456', 0, 0.05, 0);   // 2026-11-26: boş arsa çimenli (eskiden düz bej kutu); yapımda üstüne toprak gelir
    for (const [x, z] of [[-3.1, -2.3], [3.1, -2.3], [-3.1, 2.3], [3.1, 2.3], [0, -2.3], [-3.1, 0], [3.1, 0]]) box(g, 0.14, 0.9, 0.14, '#7d5638', x, 0.5, z);
    for (const z of [-2.3, 2.3]) for (const y of [0.45, 0.75]) box(g, 6.2, 0.07, 0.07, '#9a6a42', 0, y, z);
    for (const x of [-3.1, 3.1]) for (const y of [0.45, 0.75]) box(g, 0.07, 0.07, 4.6, '#9a6a42', x, y, 0);
    const dyn = new T.Group(); g.add(dyn);
    plots.set(a.id, { g, dyn, key: '#', label: d.labels.label(), sign: '' });
  }
  const awning = (p: T.Object3D, w: number, c1: string, c2: string, z: number, y: number) => { const n = 8, sw = w / n; for (let i = 0; i < n; i++) { const o = box(p, sw, 0.1, 1.5, i % 2 ? c1 : c2, -w / 2 + sw * (i + 0.5), y, z); o.rotation.x = 0.28; } };
  function build(p: PlotG, v: { tur: string | null; tip: string; lv: number; owned: boolean; insa?: number | null }) {
    p.dyn.clear(); if (p.santiye) { p.santiye.dispose(); p.santiye = null; }
    const g = p.dyn;
    // 2026-11-26: arsada yapım sürüyor: hafriyat/temel, karkas, duvar, çatı+sıva aşamaları; betoniyer, el arabası, kum, tuğla, merdiven (ustalar view/mahalle'de yürür)
    if (v.owned && v.tur && v.insa != null) {
      const ev = v.tur === 'ev', t = ev ? null : DUKKAN_BY_ID[v.tip];
      const s = santiyeKur({ w: 6.0, d: 4.4, sikisik: true, plan: { ...SETLER.orta, cit: false, toz: 10 }, kabuk: ev ? { w: 4.4, d: 3.0, h: 2.7, cati: 'kirma' } : { w: 4.6, d: 3.0, h: 2.9, cati: 'duz', duvar: '#efe6d2' }, iskeleYer: 'yok', cit: false, serit: false,
        pano: { baslik: ev ? 'EV YAPIMI' : (t ? t.ad.toLocaleUpperCase('tr-TR') : 'DÜKKÂN') + ' İNŞAATI', alt: 'Sahibi: Sabri · Martı Konutları' } });
      box(g, 6.0, 0.03, 4.4, '#8a6c4c', 0, 0.115, 0);   // kazılmış toprak
      s.g.position.set(0, 0.1, 0); g.add(s.g); p.santiye = s; s.update(0, v.insa, 0);
      return;
    }
    if (!v.owned) { cyl(g, 0.05, 1.9, '#7d5638', 2.4, 1.0, 1.7, 6); box(g, 1.4, 0.7, 0.08, '#ffd23f', 2.4, 1.9, 1.7, { emissive: '#4a3d08', emissiveIntensity: 0.3 }); return; }
    if (!v.tur) { box(g, 3.2, 0.5, 2.2, '#b09878', 0, 0.35, 0); box(g, 1.0, 0.5, 0.9, '#c8b08a', 1.4, 0.85, 0.4); return; }
    // 2026-11-26 sahip "güzellik şart": biten ev / dükkân karşı yakadaki binalarla aynı üreticiden (sıva, çerçeveli pencere, panjur, saksı, gece ışığı).
    // Ölçüler şantiye kabuğuyla aynı (ev 4.4 x 3.0, dükkân 4.6 x 3.0): ustaların ördüğü duvar, biten binanın kendisi.
    const bahce = (c: string) => { box(g, 6.0, 0.03, 4.4, c, 0, 0.115, 0); box(g, 1.0, 0.035, 1.3, '#d8cbb0', 0, 0.12, 1.55); };   // bahçe + kapıya taş yol
    if (v.tur === 'ev') {
      bahce('#86b65e');
      const ev = binaKur({ id: 'arsa-ev-' + v.lv, x: 0, z: -0.3, wx: 4.4, wz: 3.0, front: '+z', floors: 1, fh: 2.7, wall: '#f1e3c4', trim: '#fbf6ea', accent: '#b8553a', ground: 'plain', lit: 0.6, roof: 'tile', win: { w: 0.9, h: 1.1, gap: 0.9, frame: '#fbf6ea', shutter: '#6f8f5a', flower: true } });
      ev.position.y = 0.1; g.add(ev);
      for (const x of [-2.4, 2.4]) { box(g, 0.6, 0.5, 0.6, '#6d9a4c', x, 0.4, 1.6); box(g, 0.35, 0.3, 0.35, '#e0533c', x, 0.75, 1.6); }   // bahçe çalıları, çiçek
      return;
    }
    const t = DUKKAN_BY_ID[v.tip]; if (!t) return;
    bahce('#c9c2b2');
    const dk = binaKur({ id: 'arsa-dk-' + v.tip + '-' + v.lv, x: 0, z: -0.3, wx: 4.6, wz: 3.0, front: '+z', floors: v.lv >= 3 ? 2 : 1, fh: 2.9, wall: '#efe6d2', trim: '#fbfaf6', accent: t.renk, ground: 'shop', lit: 0.7, roof: 'flat',
      sign: { text: t.ikon + ' ' + t.tabela, bg: t.renk, fg: '#ffffff', w: 3.6 }, win: { w: 0.9, h: 1.2, gap: 0.8, frame: '#fbfaf6', flower: true } });
    dk.position.y = 0.1; g.add(dk);
  }

  // story clue markers: a bobbing paper with a glow ring at every clue that can be read now (sim/gizem.ts)
  const clueRoot = new T.Group(); clueRoot.name = 'gizem-ipuclari'; d.scene.add(clueRoot);
  const clueMeshes = new Map<string, T.Group>(); let tt = 0;
  const paperG = G(new T.BoxGeometry(0.5, 0.04, 0.38)), ringG = G(new T.TorusGeometry(0.55, 0.05, 6, 20));
  const paperM = new T.MeshLambertMaterial({ color: '#f7ecc8', emissive: '#e8b23a', emissiveIntensity: 0.55 }), ringM = new T.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.8 });
  mats.set('clue-paper', paperM); mats.set('clue-ring', ringM);

  let solidT = 0, solidKey = '';
  return {
    update(dt) {
      tt += dt;
      { const rl0 = d.rules(), gz = rl0 ? (rl0.rt as unknown as { gizem?: { view(): { acik: { id: string; x: number; z: number }[] } } }).gizem : null, want = new Set<string>();
        if (gz) for (const c of gz.view().acik) {
          want.add(c.id); let g = clueMeshes.get(c.id);
          if (!g) { g = new T.Group(); const pm = new T.Mesh(paperG, paperM), rm = new T.Mesh(ringG, ringM); rm.rotation.x = Math.PI / 2; rm.position.y = -0.55; g.add(pm, rm); g.position.set(c.x, 0, c.z); clueRoot.add(g); clueMeshes.set(c.id, g); }
          g.children[0].position.y = 1.1 + Math.sin(tt * 2.4) * 0.12; g.children[0].rotation.y = tt * 1.3; g.children[1].position.y = 0.06; g.children[1].scale.setScalar(1 + Math.sin(tt * 3) * 0.08);
        }
        for (const [id, g] of clueMeshes) if (!want.has(id)) { clueRoot.remove(g); clueMeshes.delete(id); } }
      const near = true;   // 2026-11-02: clue markers now live on the pier and at the stadium, so this layer always draws root.visible = near;
      const rl = d.rules(), m = rl ? mulkApi(rl) : null; if (!m || !near) { bankL.hide(); for (const p of plots.values()) p.label.hide(); return; }
      const v = m.view(), md = m.model();
      for (const pv of v.plots) {
        const p = plots.get(pv.id)!, mp = md.arsa.find(x => x.id === pv.id)!;
        const k = [pv.owned, pv.tur, pv.tip, pv.lv, pv.insa != null, 12].join('|');
        if (k !== p.key) { p.key = k; if (!pv.sabit) build(p, pv); }
        if (p.santiye && pv.insa != null && Math.hypot(d.hero().x - pv.x, d.hero().z - pv.z) < 60) p.santiye.update(dt, pv.insa, 0);
      }
      if (Math.hypot(d.hero().x - BANKA.x, d.hero().z - BANKA.z) < 26) put(bankL, BANKA.x, 4.8, BANKA.z + BANKA.d / 2 + 0.7, '🏦 ' + esc(BANKA.ad)); else bankL.hide();
      for (const pv of v.plots) {
        const p = plots.get(pv.id)!, a = ARSALAR.find(x => x.id === pv.id)!, mp = md.arsa.find(x => x.id === pv.id)!;
        if (Math.hypot(d.hero().x - a.x, d.hero().z - a.z) > 20) { p.label.hide(); continue; }
        const t = pv.tur === 'dukkan' ? DUKKAN_BY_ID[pv.tip] : null;
        const ik = (mp as { ikon?: string }).ikon || '☕', txt = !pv.owned ? (a.sabit ? ik + ' ' + (a.ad || 'Kafe') + ' · SATILIK · ' : '🏗️ SATILIK · ') + Math.round(mp.fiyat / 1000) + 'K ₺' + ((mp as { kilit?: string }).kilit ? ' · 🔒' : '') : !pv.tur ? 'Boş arsa' : pv.tur === 'ev' ? '🏠 Evin' : (a.sabit ? ik + ' ' + (a.ad || '') : (t ? t.ikon + ' ' + t.tabela : '')) + (pv.isci ? ' · 👷 ' + pv.isci : '') + (pv.till > 0 ? ' · 💰 ' + pv.till : '');
        const avm = AVM_ARSA.indexOf(a.id);   // 2026-11-20: four AVM doors 3.9 m apart: labels right over each door, staggered in height
        if (a.kapi && avm >= 0) put(p.label, a.kapi.x, 4.4 + (avm % 2) * 0.75, a.kapi.z, esc(txt)); else if (a.kapi) put(p.label, a.kapi.x - 1.2, 4.6, a.kapi.z, esc(txt)); else put(p.label, a.x, 4.2 + (pv.tur ? 0.6 : -1.2), a.z + (a.rotY ? -1.8 : 1.8), esc(txt));
      }
      // solid walls: bank body and every built plot
      if ((solidT -= dt) <= 0 && d.setSolid) {
        solidT = 0.5;
        // KAL-13: banka gövdesi artık burada tam dikdörtgen duvar OLMAZ; iç mekan duvarları kapı boşluğuyla zone çarpıştırıcılarından gelir (kr.banka, icCollidersLocal). Eski tam gövde kapıyı kapatıyordu, gezgin bot yakaladı.
        const rects: { x0: number; x1: number; z0: number; z1: number }[] = [];
        for (const pv of v.plots) if (pv.tur && !pv.sabit) { const a = ARSALAR.find(x => x.id === pv.id)!; const s = a.rotY ? -1 : 1; rects.push({ x0: a.x - 2.6, x1: a.x + 2.6, z0: a.z - 2.2 - (s > 0 ? 0 : 0), z1: a.z + 0.9 }); if (a.rotY) { rects[rects.length - 1].z0 = a.z - 0.9; rects[rects.length - 1].z1 = a.z + 2.2; } }
        const k = JSON.stringify(rects); if (k !== solidKey) { solidKey = k; d.setSolid(rects); }
      }
    },
    dispose() { clueRoot.removeFromParent(); root.removeFromParent(); geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); bankL.hide(); },
  };
}
