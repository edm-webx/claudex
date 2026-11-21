/**
 * Martı AVM içi (2026-11-21 sahip: "AVM'ye girince başka bir haritaya geçilsin, ayrı bir level design gibi"; "merdiven işlevsiz").
 * Kendi diyarında (content/avm-kat.ts AVM_OX) duran hol: üç katın döşemesi (üst katlarda merdiven boşluğu), cam cephe ve
 * otomatik giriş kapısı, giriş lobisi (danışma, saksılar, banklar), iki çift yürüyen merdiven (gövde, cam korkuluk, kara küpeşte,
 * gerçekten akan basamaklar, uçlarda yön okları), galerilerin cam korkulukları ve LED şeridi, dükkân kapılarının üstünde
 * tabelaları, kat adları, dışarıda meydan. Dükkânların kendisi view/world/ic-mekan-look.ts. Kat kesiti: kahramanın katından
 * yukarısı gizli (üst katın döşemesi ve odaları görünmez), böylece kamera her katı açık görür.
 */
import * as T from 'three';
import { Batch } from '../../../engine/prefab/batch';
import { AVM, HOL, SERIT, MERD, GIRIS_KAPI, LOBI_Z1, LOBI_DEKOR, KAT_ADI, katY, avmIcinde, type SeritId } from '../../../content/avm-kat';
import { icBina, icDim, icWorld, AVM_TABELA } from '../../../content/ic-mekan';

export interface AvmIcDeps { /** the scene (the iskele zone root may be unloaded while inside) */ root: () => T.Object3D | null; hero: () => { x: number; z: number; kat?: number }; night: () => number }
export interface AvmIcView { update(dt: number): void }

const O = { r: 0 };
const HP = Math.PI / 2;
const SLOPE = Math.atan2(AVM.FH, MERD.arka - MERD.on - 2 * MERD.duz), RUN = MERD.arka - MERD.on - 2 * MERD.duz, LEN = Math.hypot(RUN, AVM.FH);
const STEP = 0.4, HIZ = 0.5;   // basamak boyu ve görsel akış hızı (m/sn)

function yazi(text: string, bg: string, fg: string, w: number, h: number): T.MeshBasicMaterial {
  const H = 96, W = Math.max(96, Math.round(H * w / h)), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = fg; g.font = '800 52px system-ui,"Segoe UI",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const m = g.measureText(text).width, max = W - 28; if (m > max) { g.save(); g.translate(W / 2, H / 2 + 3); g.scale(max / m, 1); g.fillText(text, 0, 0); g.restore(); } else g.fillText(text, W / 2, H / 2 + 3);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return new T.MeshBasicMaterial({ map: t });
}
function levha(text: string, bg: string, fg: string, w: number, h: number, x: number, y: number, z: number, ry: number): T.Mesh {
  const m = new T.Mesh(new T.PlaneGeometry(w, h), yazi(text, bg, fg, w, h)); m.position.set(x, y, z); m.rotation.y = ry; return m;
}

/** merdiven yolu: (s 0..1) -> nokta, alt kattan; öndeki düz, eğim, arkadaki düz */
function yolNokta(s: number, alt: number): { z: number; y: number } {
  const total = LEN + 2 * MERD.duz, d = s * total, y0 = katY(alt);
  if (d < MERD.duz) return { z: MERD.on + d, y: y0 };
  if (d < MERD.duz + LEN) { const t = (d - MERD.duz) / LEN; return { z: MERD.on + MERD.duz + t * RUN, y: y0 + t * AVM.FH }; }
  return { z: MERD.arka - MERD.duz + (d - MERD.duz - LEN), y: y0 + AVM.FH };
}

function insa(): { g: T.Group; katlar: T.Group[]; basamak: { m: T.InstancedMesh; serit: SeritId; alt: number }[]; kapi: T.Object3D[] } {
  const g = new T.Group(); g.name = 'avmIc';
  const solid = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.08 });
  const glass = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.32, depthWrite: false });
  const glow = new T.MeshBasicMaterial({ vertexColors: true });
  const katlar: T.Group[] = [], basamak: { m: T.InstancedMesh; serit: SeritId; alt: number }[] = [], kapi: T.Object3D[] = [];
  const cx = AVM.cx, voidX0 = MERD.kx0 - 0.05, voidX1 = MERD.kx1 + 0.05;

  // dışarısı: meydan (cephenin önü ve çevresi), birkaç ağaç ve lamba, kaldırım
  { const b = new Batch();
    b.box(80, 0.1, 70, '#cfc6b4', cx, -0.05, AVM.z0 + 10); b.box(AVM.x1 - AVM.x0 + 4, 0.02, 3.2, '#b9b0a0', cx, 0.01, AVM.z0 - 2.2);
    for (let i = -3; i <= 3; i++) for (let j = 0; j < 4; j++) b.box(1.9, 0.012, 1.9, (i + j) % 2 ? '#d8cfbd' : '#c4bba8', cx + i * 2, 0.006, AVM.z0 - 6 - j * 2);
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { const x = cx + sx * (4 + i * 4.5), z = AVM.z0 - 7.5; b.cyl(0.12, 0.16, 2.2, '#6b4a2a', x, 1.1, z, { seg: 8 }); b.ico(1.25, '#4f8a4a', x, 2.9, z, { d: 1 }); b.cyl(0.6, 0.6, 0.35, '#8a8f96', x, 0.17, z, { seg: 12 }); }
    for (const sx of [-1, 1]) { b.cyl(0.05, 0.06, 3.4, '#2b2f36', cx + sx * 3, 1.7, AVM.z0 - 3.4, { seg: 8 }); b.sph(0.18, '#fff1c8', cx + sx * 3, 3.45, AVM.z0 - 3.4, { ws: 8, hs: 6 }); }
    g.add(b.mesh(solid, false, true)); }

  for (let k = 0; k < AVM.KAT; k++) {
    const kg = new T.Group(); kg.name = 'avmKat' + k; g.add(kg); katlar.push(kg);
    const y = katY(k), b = new Batch(), gl = new Batch(), l = new Batch(), top = y + 0.12;
    // döşeme: zeminde tam; üst katlarda merdiven boşluğu açık (dört parça), altı beyaz tavan
    const slab = (x0: number, x1: number, z0: number, z1: number) => { b.span(x0, x1, top - 0.3, top, z0, z1, '#e9e4da'); };
    if (k === 0) slab(AVM.x0, AVM.x1, AVM.z0, AVM.z1);
    else { slab(AVM.x0, AVM.x1, AVM.z0, MERD.on); slab(AVM.x0, AVM.x1, MERD.arka, AVM.z1); slab(AVM.x0, voidX0, MERD.on, MERD.arka); slab(voidX1, AVM.x1, MERD.on, MERD.arka); }
    // hol zemini: terrazzo karoları, yürüyüş yollarında koyu bordür, lobide pusula kakması
    for (let x = HOL.x0 + 1; x < HOL.x1; x += 1) b.box(0.02, 0.004, AVM.z1 - LOBI_Z1, '#d4cdbf', x, top + 0.002, (LOBI_Z1 + AVM.z1) / 2);
    for (let z = LOBI_Z1 + 1; z < AVM.z1; z += 1) b.box(HOL.x1 - HOL.x0, 0.004, 0.02, '#d4cdbf', cx, top + 0.002, z);
    for (const sx of [-1, 1]) b.box(0.18, 0.006, AVM.z1 - LOBI_Z1, '#7a6e60', cx + sx * (HOL.x1 - HOL.x0) / 2 - sx * 0.12, top + 0.003, (LOBI_Z1 + AVM.z1) / 2);
    b.box(AVM.x1 - AVM.x0, 0.004, LOBI_Z1 - AVM.z0, '#efe9df', cx, top + 0.002, (AVM.z0 + LOBI_Z1) / 2);
    if (k === 0) { b.cyl(1.1, 1.1, 0.008, '#c9a23a', cx, top + 0.004, 45.3, { seg: 32 }); b.cyl(0.95, 0.95, 0.01, '#1d4f86', cx, top + 0.006, 45.3, { seg: 32 }); for (let i = 0; i < 4; i++) b.box(0.12, 0.012, 1.6, '#fbfaf6', cx, top + 0.008, 45.3, { ry: i * Math.PI / 4 }); }
    // cam cephe (ön): dikmeler, kat kirişi; zeminde ortada otomatik kapı
    const fz = AVM.z0 + 0.05, fh = 3.48;
    for (let x = AVM.x0; x <= AVM.x1 + 0.01; x += 1.5) if (k > 0 || x < GIRIS_KAPI.x0 - 0.05 || x > GIRIS_KAPI.x1 + 0.05) b.box(0.08, fh, 0.12, '#3f4a6b', x, top + fh / 2, fz);
    b.box(AVM.x1 - AVM.x0, 0.22, 0.2, '#3f4a6b', cx, top + fh - 0.05, fz); b.box(AVM.x1 - AVM.x0, 0.06, 0.14, '#3f4a6b', cx, top + 0.03, fz);
    const camParca = (x0: number, x1: number) => gl.span(x0, x1, top + 0.06, top + fh - 0.16, fz - 0.01, fz + 0.01, '#bfe0ee');
    if (k === 0) { camParca(AVM.x0, GIRIS_KAPI.x0); camParca(GIRIS_KAPI.x1, AVM.x1); b.box(GIRIS_KAPI.x1 - GIRIS_KAPI.x0 + 0.3, 0.35, 0.3, '#3f4a6b', cx, top + 2.45, fz); b.box(GIRIS_KAPI.x1 - GIRIS_KAPI.x0 + 1.2, 0.02, 1.6, '#7a2b2b', cx, top + 0.006, fz + 0.9); }
    else camParca(AVM.x0, AVM.x1);
    // arka duvar (hol) ve lobinin yan duvarları
    b.span(HOL.x0, HOL.x1, top, top + fh, AVM.z1 - 0.25, AVM.z1, '#f1ece3'); b.box(HOL.x1 - HOL.x0, 0.12, 0.04, '#e0533c', cx, top + 0.06, AVM.z1 - 0.27);
    for (const x of [AVM.x0, AVM.x1 - 0.25]) b.span(x, x + 0.25, top, top + fh, AVM.z0, LOBI_Z1, '#f1ece3');
    kg.add(levha(KAT_ADI[k].toLocaleUpperCase('tr'), '#3f4a6b', '#ffffff', 4.2, 0.55, cx, top + 2.75, AVM.z1 - 0.26, Math.PI));
    // dükkân cepheleri (holde): kapı üstü bant ve tabela, kapı çerçevesi
    for (const m of icBina('avm').filter(r => (r.kat || 0) === k)) {
      const r = AVM_TABELA[m.tur] || AVM_TABELA.avmLokanta, D = icDim(m).D, p = icWorld(m, 0, D / 2 + 0.03), sg = m.kapi === '+x' ? 1 : -1;
      b.box(0.06, 0.32, icDim(m).W, '#3f4a6b', p.x + sg * 0.02, top + 3.3, m.z);
      for (const dz of [-0.62, 0.62]) b.box(0.08, 2.3, 0.08, r.c, p.x + sg * 0.03, top + 1.15, m.z + dz);
      b.box(0.08, 0.1, 1.32, r.c, p.x + sg * 0.03, top + 2.35, m.z);
      kg.add(levha(r.txt, r.c, '#ffffff', 2.6, 0.46, p.x + sg * 0.07, top + 2.78, m.z, sg * HP));
      l.box(0.02, 0.03, 2.5, '#fff3d6', p.x + sg * 0.06, top + 2.52, m.z);
    }
    // galeri (üst katlar): boşluğun çevresinde cam korkuluk, çelik küpeşte, döşeme kenarında LED şerit
    if (k > 0) {
      const rail = (x0: number, x1: number, z0: number, z1: number) => { gl.span(x0, x1, top, top + 1.0, z0, z1, '#cfe8f2'); b.span(x0, x1, top + 1.0, top + 1.06, z0, z1, '#9aa5b0'); };
      rail(voidX0 - 0.03, voidX0, MERD.on, MERD.arka); rail(voidX1, voidX1 + 0.03, MERD.on, MERD.arka);
      const acik0 = SERIT.U.x0 - 0.05, acik1 = SERIT.D.x1 + 0.05;
      rail(voidX0, acik0, MERD.arka - 0.03, MERD.arka); rail(acik1, voidX1, MERD.arka - 0.03, MERD.arka);
      if (k === AVM.KAT - 1) rail(voidX0, voidX1, MERD.on, MERD.on + 0.03); else { rail(voidX0, acik0, MERD.on, MERD.on + 0.03); rail(acik1, voidX1, MERD.on, MERD.on + 0.03); }
      for (const x of [voidX0 - 0.02, voidX1 + 0.02]) l.box(0.02, 0.025, MERD.arka - MERD.on, '#bfe9ff', x, top - 0.05, (MERD.on + MERD.arka) / 2);
    }
    // lobi: danışma, saksılar, banklar (zemin)
    if (k === 0) for (const d of LOBI_DEKOR) {
      if (d.k === 'danisma') { b.box(d.w, 1.05, d.d, '#fbfaf6', d.x, top + 0.52, d.z, { r: 0.08, s: 2 }); b.box(d.w + 0.06, 0.05, d.d + 0.06, '#3f4a6b', d.x, top + 1.07, d.z); b.box(d.w, 0.12, 0.02, '#e0533c', d.x, top + 0.85, d.z - d.d / 2 - 0.01); kg.add(levha('DANIŞMA', '#3f4a6b', '#ffffff', 1.3, 0.3, d.x, top + 1.6, d.z, 0)); b.box(0.04, 0.5, 0.04, '#2b2f36', d.x, top + 1.33, d.z); }
      if (d.k === 'saksi') { b.cyl(d.w / 2, d.w / 2 - 0.08, 0.7, '#7d8a96', d.x, top + 0.35, d.z, { seg: 14 }); b.ico(d.w * 0.6, '#4f8a4a', d.x, top + 1.25, d.z, { d: 1 }); b.ico(d.w * 0.4, '#5f9a52', d.x + 0.15, top + 1.75, d.z - 0.1, { d: 1 }); }
      if (d.k === 'bank') { b.box(d.w, 0.08, d.d, '#b8875a', d.x, top + 0.45, d.z); b.box(d.w, 0.4, 0.06, '#b8875a', d.x, top + 0.7, d.z + d.d / 2 - 0.03); for (const sx of [-1, 1]) b.box(0.06, 0.45, d.d, '#2b2f36', d.x + sx * (d.w / 2 - 0.1), top + 0.22, d.z); }
    }
    // saksılar holde (duvar diplerinde, kapılara denk gelmeyen yerler)
    for (const sx of [-1, 1]) for (const z of [47.0, 56.6]) { const x = cx + sx * ((HOL.x1 - HOL.x0) / 2 - 0.45); b.cyl(0.28, 0.22, 0.55, '#d9d2c4', x, top + 0.28, z, { seg: 12 }); b.ico(0.38, '#4f8a4a', x, top + 0.85, z, { d: 1 }); }
    kg.add(b.mesh(solid, true, true)); if (!gl.empty) { const gm = gl.mesh(glass, false, false); gm.renderOrder = 2; kg.add(gm); } if (!l.empty) kg.add(l.mesh(glow, false, false));
  }

  // yürüyen merdivenler: alt katın grubunda (üst kat gizlenince eğim görünür kalır)
  const stepGeo = new T.BoxGeometry(SERIT.U.x1 - SERIT.U.x0 - 0.04, 0.22, STEP - 0.03);
  const stepMat = new T.MeshStandardMaterial({ color: '#4a4f57', roughness: 0.5, metalness: 0.5 });
  for (let alt = 0; alt < AVM.KAT - 1; alt++) for (const s of ['U', 'D'] as SeritId[]) {
    const kg = katlar[alt], b = new Batch(), gl = new Batch(), l = new Batch(), r = SERIT[s], x = (r.x0 + r.x1) / 2, w = r.x1 - r.x0, y0 = katY(alt), y1 = katY(alt + 1);
    const midZ = MERD.on + MERD.duz + RUN / 2, midY = y0 + AVM.FH / 2;
    b.box(w + 0.14, 0.75, LEN, '#2a2d33', x, midY - 0.25, midZ, { rx: -SLOPE });   // gövde
    for (const sx of [-1, 1]) b.box(0.05, 0.12, LEN, '#c9ced6', x + sx * (w / 2 + 0.05), midY + 0.1, midZ, { rx: -SLOPE });   // yan süpürgelik (paslanmaz)
    b.box(w + 0.14, 0.4, MERD.duz + 0.4, '#2a2d33', x, y0 - 0.08, MERD.on + MERD.duz / 2 - 0.1); b.box(w + 0.14, 0.4, MERD.duz + 0.4, '#2a2d33', x, y1 - 0.08, MERD.arka - MERD.duz / 2 + 0.1);
    for (const [z, yy] of [[MERD.on - 0.15, y0], [MERD.arka + 0.15, y1]] as [number, number][]) b.box(w + 0.1, 0.03, 0.3, '#c9ced6', x, yy + 0.135, z);   // tarak plakaları
    for (const sx of [-1, 1]) {   // cam korkuluk + kara küpeşte, uçlarda dönüş
      const xx = x + sx * (w / 2 + 0.03); gl.box(0.02, 0.85, LEN, '#d8eef6', xx, midY + 0.6, midZ, { rx: -SLOPE });
      b.box(0.07, 0.07, LEN, '#121417', xx, midY + 1.05, midZ, { rx: -SLOPE });
      for (const [z, yy] of [[MERD.on + 0.1, y0], [MERD.arka - 0.1, y1]] as [number, number][]) { gl.box(0.02, 0.85, 0.9, '#d8eef6', xx, yy + 0.6, z); b.box(0.07, 0.07, 0.9, '#121417', xx, yy + 1.05, z); b.tor(0.4, 0.035, '#121417', xx, yy + 0.65, z + (z < midZ ? -0.45 : 0.45), { ry: HP, arc: Math.PI, rz: z < midZ ? HP : -HP, ts: 10 }); }
    }
    // yön okları (biniş ucunda yeşil, iniş ucunda kırmızı çizgi)
    const binisZ = s === 'U' ? MERD.on - 0.55 : MERD.arka + 0.55, binisY = s === 'U' ? y0 : y1, inisZ = s === 'U' ? MERD.arka + 0.55 : MERD.on - 0.55, inisY = s === 'U' ? y1 : y0;
    l.cone(0.22, 0.4, '#5fd68a', x, binisY + 0.135, binisZ, { rx: s === 'U' ? HP : -HP, seg: 3, sz: 0.05 });
    l.box(0.6, 0.012, 0.08, '#e0533c', x, inisY + 0.135, inisZ);
    kg.add(b.mesh(solid, true, true)); const gm = gl.mesh(glass, false, false); gm.renderOrder = 2; kg.add(gm); kg.add(l.mesh(glow, false, false));
    const n = Math.ceil((LEN + 2 * MERD.duz) / STEP), im = new T.InstancedMesh(stepGeo, stepMat, n); im.frustumCulled = false; kg.add(im);
    basamak.push({ m: im, serit: s, alt });
    // kat panosu: merdiven başında asılı yön levhası
    const hedef = s === 'U' ? '▲ ' + KAT_ADI[alt + 1] : '▼ ' + KAT_ADI[alt];
    kg.add(levha(hedef, s === 'U' ? '#2f9e5a' : '#3f4a6b', '#ffffff', 2.0, 0.32, x, binisY + 2.55, binisZ, s === 'U' ? Math.PI : 0));
  }
  // otomatik kapının iki kanadı (yakınlaşınca kayar)
  for (const sx of [-1, 1]) { const m = new T.Mesh(new T.BoxGeometry((GIRIS_KAPI.x1 - GIRIS_KAPI.x0) / 2, 2.2, 0.04), new T.MeshStandardMaterial({ color: '#cfe8f2', transparent: true, opacity: 0.4, roughness: 0.05, metalness: 0.3, depthWrite: false })); m.position.set(cx + sx * (GIRIS_KAPI.x1 - GIRIS_KAPI.x0) / 4, 0.12 + 1.1, AVM.z0 + 0.05); m.userData.sx = sx; m.renderOrder = 2; katlar[0].add(m); kapi.push(m); }
  katlar[0].add(levha('MARTI AVM', '#e0533c', '#ffffff', 2.6, 0.5, cx, 0.12 + 2.95, AVM.z0 - 0.1, Math.PI));
  return { g, katlar, basamak, kapi };
}

export function createAvmIc(d: AvmIcDeps): AvmIcView {
  let v: ReturnType<typeof insa> | null = null, t = 0, ac = 0;
  const mt = new T.Matrix4();
  return {
    update(dt) {
      const sahne = d.root(); if (!sahne) return;
      const hp = d.hero(), icerde = avmIcinde(hp, 8);
      if (!icerde) { if (v) v.g.visible = false; return; }
      if (!v) { v = insa(); }
      if (v.g.parent !== sahne) sahne.add(v.g);
      v.g.visible = true; t += dt;
      const kat = hp.kat || 0; v.katlar.forEach((g, k) => { g.visible = k <= kat; });
      const total = LEN + 2 * MERD.duz;
      for (const e of v.basamak) {
        if (!v.katlar[e.alt].visible) continue;
        const x = (SERIT[e.serit].x0 + SERIT[e.serit].x1) / 2, n = e.m.count;
        for (let i = 0; i < n; i++) {
          let s = ((i / n) + (t * HIZ / total)) % 1; if (e.serit === 'D') s = 1 - s;
          const p = yolNokta(s, e.alt); mt.makeTranslation(x, p.y + 0.01, p.z); e.m.setMatrixAt(i, mt);
        }
        e.m.instanceMatrix.needsUpdate = true;
      }
      const yakin = kat === 0 && Math.abs(hp.x - AVM.cx) < 2.6 && hp.z < AVM.z0 + 2.4;
      ac += ((yakin ? 1 : 0) - ac) * Math.min(1, dt * 5);
      for (const m of v.kapi) m.position.x = AVM.cx + m.userData.sx * ((GIRIS_KAPI.x1 - GIRIS_KAPI.x0) / 4 + ac * 1.25);
      void d.night;
    },
  };
}
