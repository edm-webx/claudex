/**
 * Martı AVM sinema katı görünümü. 2026-11-22 22:55 sahip: "canlı müzik yerini kaldır, sinemaları büyüt, bekleme alanı ve iki gişe,
 * sinemalar gerçek uzun animasyon, hikâyeli". En üst kat: Martı Sinemaları (iki büyük karanlık salon, kırmızı koltuk sıraları,
 * büyük perde: seansta animasyon dizisinin o günkü bölümü oynar, view/world/sinema-perde.ts), doğu lobide iki gişe kulübesi ve seans
 * tablosu, doğu blok arkasında bekleme alanı (kanepeler, sehpalar, saksılar, fragman ekranı, afiş panoları). Açık Sinema Büfesi
 * standı bir dükkân odası olarak ic-mekan-look'ta çizilir. Yerleşim / takvim content/avm-eglence.ts; aktörler sim/agents/avm-yasam.ts.
 * Yalnız kahraman bu kattayken görünür. Işık eklemez: parlayanlar MeshBasic.
 */
import * as T from 'three';
import { Batch } from '../../../engine/prefab/batch';
import { AVM, HOL, LOBI_Z1, katY, avmIcinde } from '../../../content/avm-kat';
import { EGLENCE_KAT, KORIDOR_X, SALONLAR, SALON_H, GISELER, KANEPELER, BEKLEME, FRAGMAN, BILET_FIYAT, seans, type Salon } from '../../../content/avm-eglence';
import { DIZILER, diziOf, bolumOf } from '../../../content/sinema-dizi';
import { perdeCiz } from './sinema-perde';

export interface AvmEglenceDeps { root: () => T.Object3D | null; hero: () => { x: number; z: number; kat?: number }; saat: () => number }
export interface AvmEglenceView { update(dt: number): void }

const HP = Math.PI / 2, F = katY(EGLENCE_KAT) + 0.12, WH = SALON_H, ZM = (AVM.z0 + AVM.z1) / 2;
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

interface Perde { s: Salon; tv: ReturnType<typeof tuval>; durum: string; t: number; ciz: number }
interface Yapi { g: T.Group; perde: Perde[]; tablo: ReturnType<typeof tuval>; tabloT: number; afis: { s: Salon; tv: ReturnType<typeof tuval>; key: string }[]; frag: ReturnType<typeof tuval>; fragT: number; fragCiz: number }

function insa(): Yapi {
  const g = new T.Group(); g.name = 'avmEglence';
  const solid = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.06 });
  const glow = new T.MeshBasicMaterial({ vertexColors: true });
  const b = new Batch(), l = new Batch();

  /* ---- Martı Sinemaları (batı blok, lobi dahil) ---- */
  b.span(AVM.x0, HOL.x0, F, F + 0.012, AVM.z0, AVM.z1, '#3b2442');   // halı
  const duvar = '#2c2742', ust = '#c9a14a';
  b.span(AVM.x0, AVM.x0 + 0.2, F, F + WH, AVM.z0, AVM.z1, duvar); b.span(AVM.x0, HOL.x0, F, F + WH, AVM.z1 - 0.2, AVM.z1, duvar);
  b.span(AVM.x0, HOL.x0, F, F + WH, AVM.z0 + 0.06, AVM.z0 + 0.26, duvar); b.span(AVM.x0, HOL.x0, F, F + WH, ZM - 0.1, ZM + 0.1, duvar);
  for (const s of SALONLAR) {
    // basamaklı zemin şeritleri (sıraların altı) ve duvar akustik panelleri
    for (let i = 0; i < 5; i++) b.span(AVM.x0 + 1.85 + i * 0.85, AVM.x0 + 2.55 + i * 0.85, F + 0.012, F + 0.03 + i * 0.012, s.z0 + 0.6, s.z1 - 0.6, '#4a2f55');
    for (let z = s.z0 + 0.8; z < s.z1 - 0.8; z += 1.3) for (const x of [AVM.x0 + 0.21]) b.span(x, x + 0.05, F + 0.6, F + WH - 0.4, z, z + 1.0, '#3a3256');
    b.span(HOL.x0 - 0.1, HOL.x0 + 0.1, F, F + WH, s.z0, s.zc - 0.65, duvar); b.span(HOL.x0 - 0.1, HOL.x0 + 0.1, F, F + WH, s.zc + 0.65, s.z1, duvar);
    b.span(HOL.x0 - 0.1, HOL.x0 + 0.1, F + 2.25, F + WH, s.zc - 0.65, s.zc + 0.65, duvar);   // kapı üstü
    l.span(HOL.x0 + 0.1, HOL.x0 + 0.14, F + 2.18, F + 2.25, s.zc - 0.7, s.zc + 0.7, '#ffcf5a');   // kapı ışığı
    // perde çerçevesi (büyük perde) ve önündeki sahne
    const p = s.perde, py = F + 0.55 + p.h / 2;
    b.span(AVM.x0 + 0.2, AVM.x0 + 0.6, F, F + 0.4, p.z - p.w / 2 - 0.3, p.z + p.w / 2 + 0.3, '#1d1a2c');
    b.span(AVM.x0 + 0.2, AVM.x0 + 0.3, py - p.h / 2 - 0.12, py + p.h / 2 + 0.12, p.z - p.w / 2 - 0.14, p.z + p.w / 2 + 0.14, '#111018');
    for (const sg of [-1, 1]) b.span(AVM.x0 + 0.22, AVM.x0 + 0.45, F, F + WH - 0.05, p.z + sg * (p.w / 2 + 0.15) - 0.25, p.z + sg * (p.w / 2 + 0.15) + 0.25, '#7a1f2e');   // kadife perde kanatları
    // koltuklar (perdeye, batıya bakar): oturak + sırt + kolçak
    for (const k of s.koltuk) {
      b.box(0.5, 0.12, 0.62, '#b3263a', k.x, F + 0.42, k.z); b.box(0.12, 0.62, 0.62, '#9a1f31', k.x + 0.3, F + 0.68, k.z);
      b.box(0.5, 0.36, 0.05, '#1d1a2c', k.x, F + 0.2, k.z - 0.33); b.box(0.5, 0.06, 0.08, '#1d1a2c', k.x, F + 0.62, k.z - 0.34);
    }
    const n = s.koltuk.length / 5 | 0; for (const k of s.koltuk.filter((_, i) => i % n === n - 1)) b.box(0.5, 0.36, 0.05, '#1d1a2c', k.x, F + 0.2, k.z + 0.33);
    l.span(AVM.x0 + 1.6, KORIDOR_X + 0.4, F + 0.032, F + 0.036, s.z0 + 0.38, s.z0 + 0.42, '#7fd4ff'); l.span(AVM.x0 + 1.6, KORIDOR_X + 0.4, F + 0.032, F + 0.036, s.z1 - 0.42, s.z1 - 0.38, '#7fd4ff');
    for (let z = s.z0 + 1.0; z < s.z1 - 0.8; z += 1.6) l.box(0.06, 0.06, 0.06, '#ffb35a', HOL.x0 - 0.13, F + 0.25, z);   // koridor zemin lambaları
  }
  b.span(HOL.x0 - 0.12, HOL.x0 + 0.14, F + WH, F + WH + 0.08, AVM.z0, AVM.z1, ust);

  /* ---- doğu blok: zemin, dış duvar, gişeler, bekleme alanı ---- */
  const zeminDesen = (z0: number, z1: number) => { for (let i = 0; i < Math.ceil(AVM.x1 - HOL.x1); i++) for (let j = 0; j < Math.ceil(z1 - z0); j++) b.span(HOL.x1 + i, Math.min(AVM.x1, HOL.x1 + i + 1), F, F + 0.008, z0 + j, Math.min(z1, z0 + j + 1), (i + j) % 2 ? '#3a3350' : '#2f2a44'); };
  zeminDesen(AVM.z0 + 0.2, LOBI_Z1); zeminDesen(BEKLEME.z0 - 0.6, AVM.z1 - 0.2);
  b.span(AVM.x1 - 0.2, AVM.x1, F, F + 3.4, LOBI_Z1, AVM.z1, '#2b2740'); b.span(HOL.x1, AVM.x1, F, F + 3.4, AVM.z1 - 0.2, AVM.z1, '#2b2740');
  for (const k of GISELER) {
    const x0 = k.x - k.d / 2, x1 = k.x + k.d / 2, z0 = k.z - k.w / 2, z1 = k.z + k.w / 2;
    b.span(x0, x1, F, F + 1.05, z0, z1, '#7d2b3a'); b.span(x0 - 0.06, x1 + 0.03, F + 1.05, F + 1.11, z0 - 0.03, z1 + 0.03, '#e9d7b0');   // tezgâh
    for (const z of [z0, z1 - 0.08]) b.span(x0, x1, F + 1.11, F + 2.5, z, z + 0.08, '#5a1f2c');   // yan dikmeler
    b.span(x0, x1 + 0.05, F + 2.5, F + 2.75, z0 - 0.05, z1 + 0.05, '#2c2742'); l.span(x0 - 0.01, x0, F + 2.52, F + 2.73, z0 + 0.1, z1 - 0.1, '#ffcf5a');
    b.span(x0 + 0.05, x0 + 0.08, F + 1.11, F + 2.5, z0 + 0.08, z1 - 0.08, '#cfe8f2');   // cam (konuşma deliği altta)
    b.cyl(0.09, 0.09, 0.02, '#1d1d22', x0 + 0.04, F + 1.35, k.z, { rz: HP, seg: 12 });
    b.span(x1, AVM.x1 - 0.2, F, F + 0.05, z0, z1, '#5a4a3a');   // gişecinin arkası
    for (let i = 0; i < 4; i++) b.box(0.32, 0.03, 0.2, ['#ffcf5a', '#e07bb0', '#9fd3ff', '#c9f2c0'][i], k.x - 0.05, F + 1.13, z0 + 0.3 + i * 0.32);   // bilet desteleri
    // sıra kordonu (gişe önü)
    for (let i = 0; i < 3; i++) { const x = x0 - 0.6 - i * 0.9; for (const z of [k.z - 0.55, k.z + 0.55]) { b.cyl(0.11, 0.12, 0.03, '#c9a23a', x, F + 0.015, z, { seg: 10 }); b.cyl(0.022, 0.022, 0.9, '#c9a23a', x, F + 0.45, z, { seg: 6 }); } }
    for (const z of [k.z - 0.55, k.z + 0.55]) b.span(x0 - 2.4, x0 - 0.6, F + 0.76, F + 0.8, z - 0.02, z + 0.02, '#9e1b2f');
  }
  // bekleme alanı: kanepeler (doğuya, fragman ekranına bakar), sehpalar, saksılar, afiş panoları
  for (const k of KANEPELER) {
    const x = k.x; b.span(x - k.d / 2, x + k.d / 2, F, F + 0.42, k.z - k.w / 2, k.z + k.w / 2, '#6b2a3a');
    b.span(x - k.d / 2, x - k.d / 2 + 0.22, F + 0.42, F + 0.95, k.z - k.w / 2, k.z + k.w / 2, '#5a2030');
    for (const sg of [-1, 1]) b.span(x - k.d / 2, x + k.d / 2, F + 0.42, F + 0.65, k.z + sg * k.w / 2 - (sg > 0 ? 0.18 : 0), k.z + sg * k.w / 2 + (sg > 0 ? 0 : 0.18), '#5a2030');
    for (let i = 0; i < 3; i++) b.box(0.5, 0.1, k.w / 3 - 0.08, '#7d3446', x + 0.05, F + 0.47, k.z - k.w / 3 + i * k.w / 3);
    b.cyl(0.35, 0.35, 0.04, '#c9a23a', x + 1.0, F + 0.45, k.z, { seg: 16 }); b.cyl(0.05, 0.05, 0.43, '#3a3a40', x + 1.0, F + 0.22, k.z, { seg: 8 });
    b.cyl(0.07, 0.05, 0.12, '#d63c3c', x + 1.0, F + 0.53, k.z + 0.12, { seg: 8 }); b.sph(0.05, '#fff4c2', x + 1.0, F + 0.6, k.z + 0.12, { ws: 6, hs: 4 });   // sehpada mısır kovası
  }
  for (const [x, z] of [[BEKLEME.x0 + 0.4, BEKLEME.z1 - 0.4], [BEKLEME.x1 - 0.5, BEKLEME.z1 - 0.4], [BEKLEME.x0 + 0.4, BEKLEME.z0 + 0.2]]) { b.cyl(0.32, 0.26, 0.6, '#5b6068', x, F + 0.3, z, { seg: 12 }); b.ico(0.42, '#4f8a4a', x, F + 0.95, z, { d: 1 }); b.ico(0.3, '#5f9a52', x + 0.1, F + 1.35, z - 0.08, { d: 1 }); }
  // fragman ekranı çerçevesi (doğu duvarı)
  b.span(AVM.x1 - 0.3, AVM.x1 - 0.2, F + 0.9, F + 1.2 + FRAGMAN.h + 0.2, FRAGMAN.z - FRAGMAN.w / 2 - 0.1, FRAGMAN.z + FRAGMAN.w / 2 + 0.1, '#111018');

  g.add(b.mesh(solid, false, true), l.mesh(glow, false, false));
  g.add(levha('MARTI SİNEMALARI', '#2c2742', '#ffcf5a', 5.2, 0.6, HOL.x0 + 0.16, F + WH - 0.35, ZM, HP));
  for (const s of SALONLAR) g.add(levha(s.ad.toLocaleUpperCase('tr') + ' · ' + diziOf(s.id).ad.toLocaleUpperCase('tr'), '#1d1a2c', '#ffcf5a', 2.4, 0.3, HOL.x0 + 0.115, F + 2.45 + 0.2, s.zc, HP));
  for (const k of GISELER) g.add(levha('GİŞE ' + k.id + ' · ' + BILET_FIYAT + ' ₺', '#7d2b3a', '#ffffff', 1.5, 0.22, k.x - k.d / 2 - 0.012, F + 2.62, k.z, -HP));
  g.add(levha('BEKLEME SALONU', '#2c2742', '#ffcf5a', 2.6, 0.4, AVM.x1 - 0.21, F + 3.05, FRAGMAN.z, -HP));

  // perdeler, afişler, seans tablosu, fragman: tuvaller (update çizer)
  const perde: Perde[] = SALONLAR.map(s => {
    const tv = tuval(640, 272), m = new T.Mesh(new T.PlaneGeometry(s.perde.w, s.perde.h), tv.m); m.position.set(AVM.x0 + 0.31, F + 0.55 + s.perde.h / 2, s.perde.z); m.rotation.y = HP; g.add(m);
    return { s, tv, durum: '', t: 0, ciz: 0 };
  });
  const afis = SALONLAR.map(s => { const tv = tuval(160, 240), m = new T.Mesh(new T.PlaneGeometry(0.8, 1.2), tv.m); m.position.set(HOL.x0 + 0.115, F + 1.35, s.zc + (s.id === 1 ? -1.35 : 1.35)); m.rotation.y = HP; g.add(m); return { s, tv, key: '' }; });
  const tablo = tuval(384, 192); { const m = new T.Mesh(new T.PlaneGeometry(2.4, 1.2), tablo.m); m.position.set(AVM.x1 - 0.21, F + 2.55, (GISELER[0].z + GISELER[1].z) / 2); m.rotation.y = -HP; g.add(m); }
  const frag = tuval(448, 190); { const m = new T.Mesh(new T.PlaneGeometry(FRAGMAN.w, FRAGMAN.h), frag.m); m.position.set(AVM.x1 - 0.31, F + 1.2 + FRAGMAN.h / 2, FRAGMAN.z); m.rotation.y = -HP; g.add(m); }
  return { g, perde, tablo, tabloT: 0, afis, frag, fragT: 0, fragCiz: 0 };
}

function afisCiz(tv: ReturnType<typeof tuval>, film: { ad: string; tur: string; renk: string }, ust: string, alt: string) {
  const { g, c } = tv, W = c.width, H = c.height;
  g.fillStyle = film.renk; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, H * 0.62, W, H * 0.38);
  g.strokeStyle = '#ffcf5a'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '800 15px system-ui,sans-serif'; sigdir(g, ust, W / 2, 26, W - 20);
  const sozler = film.ad.split(' '), satir: string[] = []; let cur = '';
  for (const w of sozler) { if ((cur + ' ' + w).trim().length > 11) { satir.push(cur.trim()); cur = w; } else cur += ' ' + w; } satir.push(cur.trim());
  g.font = '800 22px system-ui,sans-serif'; satir.slice(0, 3).forEach((s, i) => sigdir(g, s, W / 2, H * 0.68 + i * 22, W - 16));
  g.font = '600 13px system-ui,sans-serif'; g.fillStyle = '#ffe9a8'; sigdir(g, alt, W / 2, H - 14, W - 20);
  tv.t.needsUpdate = true;
}

export function createAvmEglence(d: AvmEglenceDeps): AvmEglenceView {
  let v: Yapi | null = null, t = 0, kapaliS = 0;
  /** Sinema katı kahraman 12 sn kat dışında kalırsa boşaltılır (geometri + tuval dokuları); girişte yeniden kurulur. */
  const bosalt = () => {
    if (!v) return;
    v.g.parent?.remove(v.g);
    v.g.traverse(o => {
      const m = o as T.Mesh; if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mt of ([] as T.Material[]).concat(m.material)) { const mm = mt as T.MeshBasicMaterial; mm.map?.dispose(); mm.dispose(); }
    });
    v = null;
  };
  return {
    update(dt) {
      const sahne = d.root(); if (!sahne) return;
      const hp = d.hero(), on = avmIcinde(hp, 2) && (hp.kat || 0) === EGLENCE_KAT;
      if (!on) { if (v) { v.g.visible = false; kapaliS += dt; if (kapaliS > 12) bosalt(); } return; }
      kapaliS = 0;
      if (!v) v = insa();
      if (v.g.parent !== sahne) sahne.add(v.g);
      v.g.visible = true; t += dt;
      const h = d.saat();
      for (const p of v.perde) {
        const x = seans(p.s, h), dz = diziOf(p.s.id), bo = bolumOf(dz, x.bolum);
        if (x.durum === 'film') {
          // salonun içindeyken akıcı (12 kare/sn), holde / uzakta seyrek: perde her zaman bölümün o anını gösterir
          const ic = hp.x < HOL.x0 + 0.5 && hp.z > p.s.z0 && hp.z < p.s.z1, hz = ic ? 1 / 12 : 1.0;
          p.t += dt; if (p.durum !== 'film' || (p.ciz -= dt) <= 0) { p.ciz = hz; perdeCiz(p.tv.g, p.tv.c.width, p.tv.c.height, dz, bo.no, bo.b, x.f, t); p.tv.t.needsUpdate = true; }
          p.durum = 'film'; continue;
        }
        const key = x.durum + bo.no + Math.floor(x.sonraki);
        if (key === p.durum) continue; p.durum = key; p.t = 0;
        const { g, c } = p.tv; g.fillStyle = '#0d0c16'; g.fillRect(0, 0, c.width, c.height); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#ffcf5a'; g.font = '800 34px system-ui,sans-serif';
        sigdir(g, x.durum === 'giris' ? 'Bölüm birazdan başlıyor' : x.durum === 'cikis' ? 'İyi seyirler dileriz' : 'Martı Sinemaları', c.width / 2, 92, c.width - 40);
        g.fillStyle = '#fff'; g.font = '700 26px system-ui,sans-serif'; sigdir(g, dz.ad + (x.durum === 'kapali' ? '' : ' · ' + bo.no + '. Bölüm: ' + bo.b.ad), c.width / 2, 146, c.width - 40);
        g.fillStyle = '#9aa0c8'; g.font = '600 18px system-ui,sans-serif'; sigdir(g, x.durum === 'kapali' ? 'İlk seans ' + saatYaz(x.sonraki) : p.s.ad + ' · sıradaki seans ' + saatYaz(x.sonraki), c.width / 2, 196, c.width - 40); p.tv.t.needsUpdate = true;
      }
      for (const a of v.afis) {
        const x = seans(a.s, h), nxt = x.durum === 'cikis' || x.durum === 'kapali' ? seans(a.s, x.sonraki + 0.05) : x, bo = bolumOf(diziOf(a.s.id), nxt.bolum), key = nxt.film.ad + bo.no;
        if (key !== a.key) { a.key = key; afisCiz(a.tv, nxt.film, a.s.ad + ' · ' + saatYaz(x.durum === 'giris' || x.durum === 'film' ? h - x.t : x.sonraki), bo.no + '. Bölüm: ' + bo.b.ad); }
      }
      if ((v.tabloT -= dt) <= 0) {
        v.tabloT = 2; const { g, c } = v.tablo; g.fillStyle = '#14122b'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#ffcf5a'; g.font = '800 24px system-ui,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('SEANSLAR · BİLET ' + BILET_FIYAT + ' ₺', 16, 32);
        SALONLAR.forEach((s, i) => { const x = seans(s, h), bo = bolumOf(diziOf(s.id), x.bolum), y = 76 + i * 54; g.fillStyle = '#fff'; g.font = '700 19px system-ui,sans-serif'; g.textAlign = 'center'; sigdir(g, s.ad + ' · ' + x.film.ad + ' ' + bo.no + '. Bölüm', c.width / 2, y, c.width - 32);
          g.fillStyle = x.durum === 'film' ? '#ff8a7a' : x.durum === 'giris' ? '#7fe08a' : '#9aa0c8'; g.font = '600 16px system-ui,sans-serif';
          g.fillText(x.durum === 'film' ? 'Oynuyor' : x.durum === 'giris' ? 'Giriş açık · ' + saatYaz(h - x.t + 0.35) : 'Sıradaki seans ' + saatYaz(x.sonraki), c.width / 2, y + 24); g.textAlign = 'left'; });
        v.tablo.t.needsUpdate = true;
      }
      // fragman ekranı: iki dizinin bölümlerinden hızlı kesitler (yalnız yakındayken akıcı)
      v.fragT += dt;
      const yakin = Math.hypot(hp.x - FRAGMAN.x, hp.z - FRAGMAN.z) < 13;
      if ((v.fragCiz -= dt) <= 0) {
        v.fragCiz = yakin ? 1 / 10 : 2;
        const tur = Math.floor(v.fragT / 30), dz = DIZILER[tur % DIZILER.length], bo = bolumOf(dz, Math.floor(tur / DIZILER.length)), f = (v.fragT % 30) / 30;
        perdeCiz(v.frag.g, v.frag.c.width, v.frag.c.height, dz, bo.no, bo.b, f, t);
        const { g, c } = v.frag; g.fillStyle = 'rgba(214,60,60,.9)'; g.fillRect(8, 8, 92, 24); g.fillStyle = '#fff'; g.font = '800 15px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FRAGMAN', 54, 21);
        v.frag.t.needsUpdate = true;
      }
    },
  };
}
