/**
 * Martı AVM eğlence katı görünümü (2026-11-21 21:07 sahip: "konserler, sinema salonları hepsi ayarlansın"). En üst kat:
 * Martı Sinemaları (iki karanlık salon, kırmızı koltuk sıraları, perde: seans sırasında film oynar, yoksa afiş + seans saati),
 * Martı Sahne (platform, truss, hoparlörler, davul seti, mikrofon, arka pano; konserde renkli spot konileri döner), önde gişe
 * (seans tablosu) ve mısırcı, banklar. Yerleşim / takvim content/avm-eglence.ts; aktörler sim/agents/avm-yasam.ts.
 * Yalnız kahraman bu kattayken görünür (alt katlar bu katın döşemesi altında). Işık eklemez: parlayanlar MeshBasic.
 */
import * as T from 'three';
import { Batch } from '../../../engine/prefab/batch';
import { AVM, HOL, LOBI_Z1, katY, avmIcinde } from '../../../content/avm-kat';
import { EGLENCE_KAT, SALONLAR, SAHNE, MUZISYEN, BASAMAK, GISE, MISIR, BANKLAR, seans, konser, type Salon } from '../../../content/avm-eglence';

export interface AvmEglenceDeps { root: () => T.Object3D | null; hero: () => { x: number; z: number; kat?: number }; saat: () => number }
export interface AvmEglenceView { update(dt: number): void }

const HP = Math.PI / 2, F = katY(EGLENCE_KAT) + 0.12, WH = 2.7, ZM = (LOBI_Z1 + AVM.z1) / 2;
const saatYaz = (h: number) => { const x = ((h % 24) + 24) % 24; return String(Math.floor(x)).padStart(2, '0') + ':' + String(Math.round((x % 1) * 60) % 60).padStart(2, '0'); };

function tuval(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D; t: T.CanvasTexture; m: T.MeshBasicMaterial } {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return { c, g, t, m: new T.MeshBasicMaterial({ map: t }) };
}
function sigdir(g: CanvasRenderingContext2D, s: string, x: number, y: number, max: number) {
  const m = g.measureText(s).width; if (m <= max) { g.fillText(s, x, y); return; }
  g.save(); g.translate(x, y); g.scale(max / m, 1); g.fillText(s, 0, 0); g.restore();
}
function yaziMat(text: string, bg: string, fg: string, w: number, h: number): T.MeshBasicMaterial {
  const H = 96, W = Math.max(96, Math.round(H * w / h)), x = tuval(W, H);
  x.g.fillStyle = bg; x.g.fillRect(0, 0, W, H); x.g.fillStyle = fg; x.g.font = '800 54px system-ui,"Segoe UI",sans-serif'; x.g.textAlign = 'center'; x.g.textBaseline = 'middle';
  sigdir(x.g, text, W / 2, H / 2 + 3, W - 28); x.t.needsUpdate = true; return x.m;
}
const levha = (text: string, bg: string, fg: string, w: number, h: number, x: number, y: number, z: number, ry: number) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), yaziMat(text, bg, fg, w, h)); m.position.set(x, y, z); m.rotation.y = ry; return m; };

interface Perde { s: Salon; tv: ReturnType<typeof tuval>; durum: string; film: string; t: number }
interface Yapi { g: T.Group; perde: Perde[]; koni: T.Mesh[]; pano: ReturnType<typeof tuval>; grup: string; tablo: ReturnType<typeof tuval>; tabloT: number; afis: { s: Salon; tv: ReturnType<typeof tuval>; film: string }[] }

function insa(): Yapi {
  const g = new T.Group(); g.name = 'avmEglence';
  const solid = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.06 });
  const glow = new T.MeshBasicMaterial({ vertexColors: true });
  const b = new Batch(), l = new Batch();

  /* ---- Martı Sinemaları (batı blok) ---- */
  b.span(AVM.x0, HOL.x0, F, F + 0.012, LOBI_Z1, AVM.z1, '#3b2442');   // halı
  for (const s of SALONLAR) for (let i = 0; i < 6; i++) b.span(AVM.x0 + 4.25, AVM.x0 + 4.65, F + 0.012, F + 0.016, s.z0 + 0.4 + i * 0.85, s.z0 + 0.7 + i * 0.85, '#5a3a64');
  const duvar = '#2c2742', ust = '#c9a14a';
  b.span(AVM.x0, AVM.x0 + 0.2, F, F + WH, LOBI_Z1, AVM.z1, duvar); b.span(AVM.x0, HOL.x0, F, F + WH, AVM.z1 - 0.2, AVM.z1, duvar);
  b.span(AVM.x0, HOL.x0, F, F + WH, LOBI_Z1 - 0.1, LOBI_Z1 + 0.1, duvar); b.span(AVM.x0, HOL.x0, F, F + WH, ZM - 0.1, ZM + 0.1, duvar);
  for (const s of SALONLAR) {
    b.span(HOL.x0 - 0.1, HOL.x0 + 0.1, F, F + WH, s.z0, s.zc - 0.65, duvar); b.span(HOL.x0 - 0.1, HOL.x0 + 0.1, F, F + WH, s.zc + 0.65, s.z1, duvar);
    b.span(HOL.x0 - 0.1, HOL.x0 + 0.1, F + 2.25, F + WH, s.zc - 0.65, s.zc + 0.65, duvar);   // kapı üstü
    l.span(HOL.x0 + 0.1, HOL.x0 + 0.14, F + 2.18, F + 2.25, s.zc - 0.7, s.zc + 0.7, '#ffcf5a');   // kapı ışığı
    // perde çerçevesi ve perde önü sahnesi
    b.span(AVM.x0 + 0.2, AVM.x0 + 0.5, F, F + 0.35, s.perde.z - s.perde.w / 2, s.perde.z + s.perde.w / 2, '#1d1a2c');
    b.span(AVM.x0 + 0.2, AVM.x0 + 0.32, F + 0.55, F + 2.45, s.perde.z - s.perde.w / 2 - 0.12, s.perde.z + s.perde.w / 2 + 0.12, '#111018');
    // koltuklar (perdeye, batıya bakar): oturak + sırt + kolçak
    for (const k of s.koltuk) {
      b.box(0.5, 0.12, 0.62, '#b3263a', k.x, F + 0.42, k.z); b.box(0.12, 0.62, 0.62, '#9a1f31', k.x + 0.3, F + 0.68, k.z);
      b.box(0.5, 0.36, 0.05, '#1d1a2c', k.x, F + 0.2, k.z - 0.33); b.box(0.5, 0.06, 0.08, '#1d1a2c', k.x, F + 0.62, k.z - 0.34);
    }
    for (const k of s.koltuk.filter((_, i) => i % 5 === 4)) b.box(0.5, 0.36, 0.05, '#1d1a2c', k.x, F + 0.2, k.z + 0.33);
    l.span(AVM.x0 + 1.6, AVM.x0 + 4.1, F + 0.016, F + 0.02, s.z0 + 0.18, s.z0 + 0.22, '#7fd4ff'); l.span(AVM.x0 + 1.6, AVM.x0 + 4.1, F + 0.016, F + 0.02, s.z1 - 0.22, s.z1 - 0.18, '#7fd4ff');
  }
  b.span(AVM.x0, HOL.x0 + 0.1, F + WH, F + WH + 0.08, LOBI_Z1 - 0.12, LOBI_Z1 + 0.12, ust);

  /* ---- Martı Sahne (doğu blok) ---- */
  for (let i = 0; i < 6; i++) for (let j = 0; j < 9; j++) b.span(HOL.x1 + i, Math.min(SAHNE.x0, HOL.x1 + i + 1), F, F + 0.01, 47.6 + j, 47.6 + j + 1, (i + j) % 2 ? '#34304a' : '#2a2640');
  b.span(AVM.x1 - 0.2, AVM.x1, F, F + WH + 0.6, LOBI_Z1, AVM.z1, '#26233a'); b.span(HOL.x1, AVM.x1, F, F + WH + 0.6, AVM.z1 - 0.2, AVM.z1, '#26233a');
  b.span(SAHNE.x0, SAHNE.x1, F, F + SAHNE.h, SAHNE.z0, SAHNE.z1, '#2b2b33'); b.span(SAHNE.x0 + 0.05, SAHNE.x1, F + SAHNE.h, F + SAHNE.h + 0.02, SAHNE.z0 + 0.05, SAHNE.z1 - 0.05, '#4a3b2e');
  l.span(SAHNE.x0 - 0.02, SAHNE.x0, F + 0.08, F + SAHNE.h - 0.08, SAHNE.z0, SAHNE.z1, '#ffcf5a');
  for (let i = 0; i < 3; i++) b.span(BASAMAK.x - 0.5, BASAMAK.x + 0.5, F, F + SAHNE.h * (3 - i) / 3, SAHNE.z1 + i * 0.22, SAHNE.z1 + (i + 1) * 0.22, '#3a3a44');
  // truss: dört direk + üst kiriş
  const tx0 = SAHNE.x0 + 0.1, tx1 = SAHNE.x1 - 0.05, tz0 = SAHNE.z0 + 0.1, tz1 = SAHNE.z1 - 0.1, ty = F + SAHNE.h + 2.4;
  for (const [x, z] of [[tx0, tz0], [tx0, tz1], [tx1, tz0], [tx1, tz1]]) b.box(0.14, ty - F - SAHNE.h, 0.14, '#9aa0a8', x, (ty + F + SAHNE.h) / 2, z);
  b.span(tx0 - 0.07, tx0 + 0.07, ty, ty + 0.18, tz0, tz1, '#9aa0a8'); b.span(tx1 - 0.07, tx1 + 0.07, ty, ty + 0.18, tz0, tz1, '#9aa0a8');
  for (const z of [tz0, tz1]) b.span(tx0, tx1, ty, ty + 0.18, z - 0.07, z + 0.07, '#9aa0a8');
  for (let i = 0; i < 4; i++) { const z = tz0 + 0.8 + i * (tz1 - tz0 - 1.6) / 3; b.cyl(0.12, 0.09, 0.28, '#1a1a1f', tx0 + 0.05, ty - 0.18, z, { seg: 10 }); l.cyl(0.085, 0.085, 0.02, '#fff3c4', tx0 + 0.05, ty - 0.33, z, { seg: 10 }); }
  // hoparlör kuleleri (sahnenin iki ucu, önde)
  for (const z of [SAHNE.z0 + 0.45, SAHNE.z1 - 0.45]) { b.box(0.7, 1.5, 0.7, '#141418', SAHNE.x0 + 0.5, F + SAHNE.h + 0.75, z); for (const yy of [0.45, 1.1]) b.cyl(0.22, 0.22, 0.03, '#33333a', SAHNE.x0 + 0.14, F + SAHNE.h + yy, z, { rz: HP, seg: 14 }); }
  // davul seti, mikrofon sehpası, sazcının taburesi
  { const d = MUZISYEN[2], y0 = F + SAHNE.h; b.cyl(0.32, 0.32, 0.36, '#c23b3b', d.x - 0.55, y0 + 0.34, d.z, { rx: HP, seg: 16 }); b.cyl(0.3, 0.3, 0.02, '#f1ece0', d.x - 0.74, y0 + 0.34, d.z, { rz: HP, seg: 16 });
    b.cyl(0.17, 0.17, 0.18, '#c23b3b', d.x - 0.6, y0 + 0.66, d.z - 0.3, { seg: 12 }); b.cyl(0.17, 0.17, 0.18, '#c23b3b', d.x - 0.6, y0 + 0.66, d.z + 0.3, { seg: 12 });
    for (const z of [d.z - 0.6, d.z + 0.6]) { b.cyl(0.015, 0.015, 1.0, '#9aa0a8', d.x - 0.5, y0 + 0.5, z, { seg: 6 }); b.cyl(0.24, 0.24, 0.012, '#d9b44a', d.x - 0.5, y0 + 1.0, z, { seg: 16 }); }
    b.cyl(0.2, 0.2, 0.45, '#1a1a1f', d.x + 0.05, y0 + 0.22, d.z, { seg: 12 }); }
  { const v = MUZISYEN[1], y0 = F + SAHNE.h; b.cyl(0.015, 0.015, 1.35, '#1a1a1f', v.x - 0.4, y0 + 0.68, v.z, { seg: 6 }); b.cyl(0.15, 0.15, 0.02, '#1a1a1f', v.x - 0.4, y0 + 0.01, v.z, { seg: 12 }); b.sph(0.045, '#6b6f78', v.x - 0.4, y0 + 1.38, v.z, { ws: 8, hs: 6 }); }
  { const s = MUZISYEN[0], y0 = F + SAHNE.h; b.cyl(0.18, 0.18, 0.5, '#5a3a1c', s.x + 0.25, y0 + 0.25, s.z, { seg: 10 }); }
  // izleyici bariyeri (sahne önü, kısa)
  for (let z = SAHNE.z0 + 1.2; z < SAHNE.z1 - 1.2; z += 0.6) b.box(0.06, 0.9, 0.06, '#8a8f96', SAHNE.x0 - 0.45, F + 0.45, z);
  b.span(SAHNE.x0 - 0.48, SAHNE.x0 - 0.42, F + 0.85, F + 0.92, SAHNE.z0 + 1.2, SAHNE.z1 - 1.2, '#8a8f96');

  /* ---- lobi: gişe, mısırcı, banklar ---- */
  b.box(GISE.w, 1.05, GISE.d, '#7d2b3a', GISE.x, F + 0.52, GISE.z); b.box(GISE.w + 0.1, 0.06, GISE.d + 0.1, '#e9d7b0', GISE.x, F + 1.07, GISE.z);
  b.box(GISE.w, 1.4, 0.08, '#2c2742', GISE.x, F + 1.8, GISE.z - GISE.d / 2 + 0.04);
  b.box(MISIR.w, 0.95, MISIR.d, '#f4f1ea', MISIR.x, F + 0.48, MISIR.z); for (let i = 0; i < 4; i++) b.box(0.14, 0.95, MISIR.d + 0.01, '#d63c3c', MISIR.x - MISIR.w / 2 + 0.14 + i * 0.27, F + 0.48, MISIR.z);
  b.box(MISIR.w - 0.1, 0.5, MISIR.d - 0.1, '#fff4c2', MISIR.x, F + 1.2, MISIR.z, {}); for (let i = 0; i < 9; i++) b.sph(0.06, '#ffe08a', MISIR.x - 0.35 + (i % 5) * 0.17, F + 1.0 + Math.floor(i / 5) * 0.08, MISIR.z - 0.1 + (i % 3) * 0.1, { ws: 6, hs: 4 });
  for (const k of BANKLAR) { b.box(2.0, 0.08, 0.5, '#b98a5e', k.x, F + 0.45, k.z); b.box(2.0, 0.4, 0.06, '#b98a5e', k.x, F + 0.7, k.z - 0.24); for (const sx of [-0.85, 0.85]) b.box(0.08, 0.45, 0.45, '#3a3a40', k.x + sx, F + 0.22, k.z); }

  g.add(b.mesh(solid, false, true), l.mesh(glow, false, false));
  g.add(levha('MARTI SİNEMALARI', '#2c2742', '#ffcf5a', 5.2, 0.6, (AVM.x0 + HOL.x0) / 2, F + WH - 0.42, LOBI_Z1 - 0.11, Math.PI));
  g.add(levha('GİŞE', '#7d2b3a', '#ffffff', 1.2, 0.36, GISE.x, F + 2.3, GISE.z - GISE.d / 2 - 0.01, Math.PI));
  g.add(levha('MISIR', '#d63c3c', '#ffffff', 0.9, 0.3, MISIR.x, F + 1.62, MISIR.z - MISIR.d / 2 - 0.01, Math.PI));
  for (const s of SALONLAR) g.add(levha(s.ad.toLocaleUpperCase('tr'), '#1d1a2c', '#ffcf5a', 1.2, 0.3, HOL.x0 + 0.115, F + 2.45, s.zc, HP));

  // perdeler, afişler, gişe tablosu, sahne panosu: tuvaller (update çizer)
  const perde: Perde[] = SALONLAR.map(s => {
    const tv = tuval(512, 224), m = new T.Mesh(new T.PlaneGeometry(s.perde.w, 1.8), tv.m); m.position.set(AVM.x0 + 0.33, F + 1.5, s.perde.z); m.rotation.y = HP; g.add(m);
    return { s, tv, durum: '', film: '', t: 0 };
  });
  const afis = SALONLAR.map(s => { const tv = tuval(160, 240), m = new T.Mesh(new T.PlaneGeometry(0.8, 1.2), tv.m); m.position.set(HOL.x0 + 0.115, F + 1.35, s.zc + (s.id === 1 ? -1.35 : 1.35)); m.rotation.y = HP; g.add(m); return { s, tv, film: '' }; });
  const tablo = tuval(384, 192); { const m = new T.Mesh(new T.PlaneGeometry(GISE.w - 0.2, 1.2), tablo.m); m.position.set(GISE.x, F + 1.8, GISE.z - GISE.d / 2 - 0.005); m.rotation.y = Math.PI; g.add(m); }
  const pano = tuval(640, 200); { const m = new T.Mesh(new T.PlaneGeometry(SAHNE.z1 - SAHNE.z0 - 1.2, 1.9), pano.m); m.position.set(AVM.x1 - 0.22, F + SAHNE.h + 1.45, (SAHNE.z0 + SAHNE.z1) / 2); m.rotation.y = -HP; g.add(m); }
  // spot konileri (konserde görünür, renk döner)
  const koni: T.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const z = tz0 + 0.8 + i * (tz1 - tz0 - 1.6) / 3, h = ty - 0.33 - (F + SAHNE.h);
    const m = new T.Mesh(new T.ConeGeometry(0.85, h, 18, 1, true), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    m.position.set(tx0 + 0.05 - 0.35, F + SAHNE.h + h / 2, z); m.rotation.z = -0.25; m.visible = false; g.add(m); koni.push(m);
  }
  return { g, perde, koni, pano, grup: '-', tablo, tabloT: 0, afis };
}

function filmCiz(p: Perde, film: { ad: string; tur: string; renk: string }, t: number) {
  const { g, c } = p.tv, W = c.width, H = c.height;
  // basit "film": filme özgü renkte gökyüzü, kayan şehir silüeti, uçan martı, alt yazı
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, film.renk); gr.addColorStop(1, '#111'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,240,200,.9)'; g.beginPath(); g.arc(W * 0.78, H * 0.3, 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0d0d14'; for (let i = 0; i < 14; i++) { const x = ((i * 61 - t * 40) % (W + 80) + W + 80) % (W + 80) - 40, h = 40 + ((i * 37) % 60); g.fillRect(x, H - 40 - h, 46, h); }
  g.fillRect(0, H - 40, W, 40);
  const mx = (t * 70) % (W + 60) - 30, my = 60 + Math.sin(t * 2) * 14; g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(mx - 16, my); g.quadraticCurveTo(mx - 8, my - 10 - Math.sin(t * 9) * 6, mx, my); g.quadraticCurveTo(mx + 8, my - 10 - Math.sin(t * 9) * 6, mx + 16, my); g.stroke();
  g.fillStyle = '#fff'; g.font = '700 18px system-ui,sans-serif'; g.textAlign = 'center'; sigdir(g, film.ad, W / 2, H - 14, W - 30);
  p.tv.t.needsUpdate = true;
}
function afisCiz(tv: ReturnType<typeof tuval>, film: { ad: string; tur: string; renk: string }, ust: string) {
  const { g, c } = tv, W = c.width, H = c.height;
  g.fillStyle = film.renk; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, H * 0.62, W, H * 0.38);
  g.strokeStyle = '#ffcf5a'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '800 15px system-ui,sans-serif'; sigdir(g, ust, W / 2, 26, W - 20);
  const sozler = film.ad.split(/[:]/)[0].split(' '), satir: string[] = []; let cur = '';
  for (const w of sozler) { if ((cur + ' ' + w).trim().length > 11) { satir.push(cur.trim()); cur = w; } else cur += ' ' + w; } satir.push(cur.trim());
  g.font = '800 22px system-ui,sans-serif'; satir.slice(0, 4).forEach((s, i) => sigdir(g, s, W / 2, H * 0.68 + i * 22, W - 16));
  g.font = '600 13px system-ui,sans-serif'; g.fillStyle = '#ffe9a8'; sigdir(g, film.tur, W / 2, H - 14, W - 20);
  tv.t.needsUpdate = true;
}

export function createAvmEglence(d: AvmEglenceDeps): AvmEglenceView {
  let v: Yapi | null = null, t = 0;
  return {
    update(dt) {
      const sahne = d.root(); if (!sahne) return;
      const hp = d.hero(), on = avmIcinde(hp, 2) && (hp.kat || 0) === EGLENCE_KAT;
      if (!on) { if (v) v.g.visible = false; return; }
      if (!v) v = insa();
      if (v.g.parent !== sahne) sahne.add(v.g);
      v.g.visible = true; t += dt;
      const h = d.saat();
      for (const p of v.perde) {
        const x = seans(p.s, h);
        if (x.durum === 'film') { p.t += dt; if ((p.t * 12 | 0) !== ((p.t - dt) * 12 | 0)) filmCiz(p, x.film, p.t); p.durum = 'film'; continue; }
        const key = x.durum + x.film.ad + Math.floor(x.sonraki);
        if (key === p.durum) continue; p.durum = key; p.t = 0;
        const { g, c } = p.tv; g.fillStyle = '#0d0c16'; g.fillRect(0, 0, c.width, c.height); g.textAlign = 'center'; g.fillStyle = '#ffcf5a'; g.font = '800 30px system-ui,sans-serif';
        sigdir(g, x.durum === 'giris' ? 'Film birazdan başlıyor' : x.durum === 'cikis' ? 'İyi seyirler dileriz' : 'Martı Sinemaları', c.width / 2, 80, c.width - 40);
        g.fillStyle = '#fff'; g.font = '600 22px system-ui,sans-serif'; sigdir(g, x.durum === 'kapali' ? 'İlk seans ' + saatYaz(x.sonraki) : x.film.ad, c.width / 2, 130, c.width - 40);
        g.fillStyle = '#9aa0c8'; g.font = '600 16px system-ui,sans-serif'; sigdir(g, p.s.ad + (x.durum === 'cikis' ? ' · sıradaki ' + saatYaz(x.sonraki) : ''), c.width / 2, 170, c.width - 40); p.tv.t.needsUpdate = true;
      }
      for (const a of v.afis) { const x = seans(a.s, h), nxt = x.durum === 'cikis' || x.durum === 'kapali' ? seans(a.s, x.sonraki + 0.05) : x; if (nxt.film.ad !== a.film) { a.film = nxt.film.ad; afisCiz(a.tv, nxt.film, a.s.ad + ' · ' + saatYaz(x.durum === 'giris' || x.durum === 'film' ? h - x.t : x.sonraki)); } }
      if ((v.tabloT -= dt) <= 0) {
        v.tabloT = 2; const { g, c } = v.tablo; g.fillStyle = '#14122b'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#ffcf5a'; g.font = '800 24px system-ui,sans-serif'; g.textAlign = 'left'; g.fillText('SEANSLAR', 16, 32);
        SALONLAR.forEach((s, i) => { const x = seans(s, h), y = 76 + i * 54; g.fillStyle = '#fff'; g.font = '700 19px system-ui,sans-serif'; sigdir(g, s.ad + ' · ' + x.film.ad, 16 + (c.width - 32) / 2, y, c.width - 32); g.textAlign = 'center';
          g.fillStyle = x.durum === 'film' ? '#ff8a7a' : x.durum === 'giris' ? '#7fe08a' : '#9aa0c8'; g.font = '600 16px system-ui,sans-serif';
          g.fillText(x.durum === 'film' ? 'Oynuyor' : x.durum === 'giris' ? 'Giriş açık · ' + saatYaz(h - x.t + 0.35) : 'Sıradaki seans ' + saatYaz(x.sonraki), c.width / 2, y + 24); g.textAlign = 'left'; });
        v.tablo.t.needsUpdate = true;
      }
      const k = konser(h), grup = k.durum === 'yok' ? 'yok:' + k.sonraki.grup : k.grup;
      if (grup !== v.grup) {
        v.grup = grup; const { g, c } = v.pano, gr = g.createLinearGradient(0, 0, c.width, 0); gr.addColorStop(0, '#3d1f5c'); gr.addColorStop(1, '#14122b'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
        g.textAlign = 'center'; g.fillStyle = '#ffcf5a'; g.font = '800 64px system-ui,sans-serif'; g.fillText('MARTI SAHNE', c.width / 2, 78);
        g.fillStyle = '#fff'; g.font = '700 32px system-ui,sans-serif'; sigdir(g, k.durum === 'yok' ? 'Sıradaki: ' + k.sonraki.grup + ' · ' + saatYaz(k.sonraki.bas) : k.grup, c.width / 2, 140, c.width - 40);
        g.fillStyle = '#c9b3ff'; g.font = '600 22px system-ui,sans-serif'; g.fillText(k.durum === 'sahnede' ? 'canlı' : k.durum === 'hazirlik' ? 'birazdan sahnede' : 'her gün 13:00 · 17:00 · 20:00', c.width / 2, 182);
        v.pano.t.needsUpdate = true;
      }
      const canli = k.durum === 'sahnede';
      v.koni.forEach((m, i) => { m.visible = canli; if (!canli) return; (m.material as T.MeshBasicMaterial).color.setHSL((t * 0.12 + i * 0.27) % 1, 0.85, 0.6); m.rotation.x = Math.sin(t * 1.3 + i * 1.7) * 0.35; m.rotation.z = -0.25 + Math.cos(t * 1.1 + i) * 0.15; });
    },
  };
}
