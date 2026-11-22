/**
 * Dükkân makineleri görünümü (2026-11-22 sahip: "tost makinesi gibi bekledikçe ürün geliyor, tüm dükkânlara bu mantık").
 * Sim: sim/agents/kafe.ts makineler() (rt.kafeMakineler). Çalışan bir makinenin üstünde dönen ilerleme halkası + kalan saniye
 * ve makinenin adı; biten ürünler makinenin önünde, tezgâhın üstünde hazır durur (urun-model, çalışanın taşıdığı aynı model).
 * Yalnız kahramanın katında ve 14 m içinde; havuzlu (en çok 8 halka, 24 ürün), yeni malzeme yaratmaz, ışık eklemez.
 */
import * as T from 'three';
import { katY } from '../../../content/avm-kat';
import { makeUrunModel } from '../chars/urun-model';
import { IC_BY_ID, icHangi } from '../../../content/ic-mekan';

export interface MakineVeri { room: string; kat: number; ist: string; ad: string; x: number; z: number; hx: number; hz: number; dx: number; dz: number; cook: string; p: number; kalan: number; ready: string[] }
export interface MakineDeps { root: () => T.Object3D | null; hero: () => { x: number; z: number; kat?: number }; list: () => MakineVeri[] }
export interface MakineView { update(dt: number): void }

const HALKA_N = 8, URUN_N = 24, MESAFE = 14, TEZGAH_Y = 0.14 + 1.05, HALKA_Y = 2.05;   // oda tabanı katY + 0.14 (ic-mekan-look), tezgâh üstü 1.05
interface Halka { s: T.Sprite; c: HTMLCanvasElement; g: CanvasRenderingContext2D; t: T.CanvasTexture; key: string }

function halkaYap(): Halka {
  const c = document.createElement('canvas'); c.width = 192; c.height = 128; const g = c.getContext('2d')!;
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  const s = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(1.3, 0.87, 1); s.renderOrder = 20; s.visible = false;
  return { s, c, g, t, key: '' };
}
function halkaCiz(h: Halka, p: number, kalan: number, ad: string, hazir: number) {
  const { g, c } = h, cx = c.width / 2, cy = 52, R = 36;
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(20,18,30,0.72)'; g.beginPath(); g.arc(cx, cy, R + 9, 0, Math.PI * 2); g.fill();
  g.lineWidth = 9; g.strokeStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = p >= 1 ? '#7fe08a' : '#ffcf5a'; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, p)); g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 26px system-ui,"Segoe UI",sans-serif'; g.fillText(p >= 1 ? (hazir > 1 ? '×' + hazir : '✓') : Math.ceil(kalan) + ' sn', cx, cy + 1);
  g.font = '700 17px system-ui,"Segoe UI",sans-serif'; g.fillStyle = 'rgba(20,18,30,0.72)';
  const w = Math.min(c.width - 4, g.measureText(ad).width + 18); g.fillRect(cx - w / 2, 100, w, 26);
  g.fillStyle = p >= 1 ? '#bff5c6' : '#ffe6a3'; g.fillText(ad, cx, 114, c.width - 12);
  h.t.needsUpdate = true;
}

export function createMakineGorunum(d: MakineDeps): MakineView {
  let kok: T.Group | null = null;
  const halkalar: Halka[] = [];
  const urunler = new Map<string, T.Object3D[]>();   // ürün id -> havuz
  const kullan: T.Object3D[] = [];
  const urunAl = (id: string, i: number): T.Object3D => {
    let pool = urunler.get(id); if (!pool) { pool = []; urunler.set(id, pool); }
    while (pool.length <= i) { const m = makeUrunModel(id); m.scale.setScalar(1.35); m.visible = false; pool.push(m); kok!.add(m); }
    return pool[i];
  };
  let tik = 0;
  return {
    update(dt) {
      const sahne = d.root(); if (!sahne) return;
      tik += dt; if (tik < 0.1 && kok) return; tik = 0;   // 10 Hz yeter
      if (!kok) { kok = new T.Group(); kok.name = 'makineler'; for (let i = 0; i < HALKA_N; i++) { const h = halkaYap(); halkalar.push(h); kok.add(h.s); } }
      if (kok.parent !== sahne) sahne.add(kok);
      const hp = d.hero(), kat = hp.kat || 0;
      let list: MakineVeri[] = [];
      try { list = d.list() || []; } catch { list = []; }
      // karşı yaka odaları çatılı binada: kahraman o odada değilse halka çatının üstünden görünmesin (depthTest kapalı). AVM odaları salona açık.
      const oda = icHangi(hp, 0.3)?.id;
      list = list.filter(m => m.kat === kat && (m.room === oda || IC_BY_ID[m.room]?.bina === 'avm') && Math.hypot(m.x - hp.x, m.z - hp.z) < MESAFE).sort((a, b) => Math.hypot(a.x - hp.x, a.z - hp.z) - Math.hypot(b.x - hp.x, b.z - hp.z));
      for (const o of kullan) o.visible = false; kullan.length = 0;
      const sayac = new Map<string, number>();
      let hi = 0, ui = 0; const dolu: { x: number; z: number }[] = [];
      for (const m of list) {
        const y0 = katY(m.kat);
        if (hi < HALKA_N && (m.cook || m.ready.length)) {
          const h = halkalar[hi++], key = (m.cook ? Math.round(m.p * 40) + ':' + Math.ceil(m.kalan) : 'h') + ':' + m.ready.length + m.ad;
          if (key !== h.key) { h.key = key; halkaCiz(h, m.cook ? m.p : 1, m.kalan, m.ad, m.ready.length); }
          // aynı alette iki istasyon (ör. espresso hem kahve hem soğuk içecek): halkalar yan yana
          let k2 = 0; while (dolu.some(q => Math.hypot(q.x - (m.hx + m.dx * k2 * 1.1), q.z - (m.hz + m.dz * k2 * 1.1)) < 0.9) && k2 < 4) k2++;
          const hx = m.hx + m.dx * k2 * 1.1, hz = m.hz + m.dz * k2 * 1.1; dolu.push({ x: hx, z: hz });
          h.s.position.set(hx, y0 + HALKA_Y, hz); h.s.visible = true;
        }
        m.ready.forEach((id, k) => {
          if (ui >= URUN_N) return;
          const n = sayac.get(id) || 0; sayac.set(id, n + 1);
          const o = urunAl(id, n); const f = (k - (m.ready.length - 1) / 2) * 0.3; o.position.set(m.x + m.dx * f, y0 + TEZGAH_Y, m.z + m.dz * f); o.visible = true; kullan.push(o); ui++;
        });
      }
      for (let i = hi; i < HALKA_N; i++) halkalar[i].s.visible = false;
    },
  };
}
