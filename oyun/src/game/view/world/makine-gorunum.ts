/**
 * Dükkân makineleri görünümü (2026-11-22 sahip: "tost makinesi gibi bekledikçe ürün geliyor, tüm dükkânlara bu mantık").
 * Sim: sim/agents/kafe.ts makineler() (rt.kafeMakineler). Büfedeki gibi (sahip 2026-11-22): havada yazı / tik yok. Pişen ürün
 * makinenin önünde küçükten büyüyerek döner (pişme ilerlemesi), biten ürünler yanında tezgâhta hazır durur (urun-model, çalışanın
 * taşıdığı aynı model). Yalnız kahramanın katında ve 14 m içinde; havuzlu (en çok 24 ürün), yeni malzeme yaratmaz, ışık eklemez.
 */
import * as T from 'three';
import { katY } from '../../../content/avm-kat';
import { makeUrunModel } from '../chars/urun-model';
import { IC_BY_ID, icHangi } from '../../../content/ic-mekan';

export interface MakineVeri { room: string; kat: number; ist: string; ad: string; x: number; z: number; mx: number; mz: number; hx: number; hz: number; dx: number; dz: number; cook: string; p: number; kalan: number; ready: string[] }
export interface MakineDeps { root: () => T.Object3D | null; hero: () => { x: number; z: number; kat?: number }; list: () => MakineVeri[] }
export interface MakineView { update(dt: number): void }

const URUN_N = 24, MESAFE = 14, TEZGAH_Y = 0.14 + 1.05;   // oda tabanı katY + 0.14 (ic-mekan-look), tezgâh üstü 1.05

export function createMakineGorunum(d: MakineDeps): MakineView {
  let kok: T.Group | null = null;
  const urunler = new Map<string, T.Object3D[]>();   // ürün id -> havuz
  const kullan: T.Object3D[] = [];
  const urunAl = (id: string, i: number): T.Object3D => {
    let pool = urunler.get(id); if (!pool) { pool = []; urunler.set(id, pool); }
    while (pool.length <= i) { const m = makeUrunModel(id); m.scale.setScalar(1.35); m.visible = false; pool.push(m); kok!.add(m); }
    return pool[i];
  };
  let tik = 0, tSaat = 0;
  return {
    update(dt) {
      const sahne = d.root(); if (!sahne) return;
      tik += dt; tSaat += dt; if (tik < 0.1 && kok) return; tik = 0;   // 10 Hz yeter
      if (!kok) { kok = new T.Group(); kok.name = 'makineler'; }
      if (kok.parent !== sahne) sahne.add(kok);
      const hp = d.hero(), kat = hp.kat || 0;
      let list: MakineVeri[] = [];
      try { list = d.list() || []; } catch { list = []; }
      // karşı yaka odaları çatılı binada: kahraman o odada değilse ürünler çizilmez (çatı zaten örter). AVM odaları salona açık.
      const oda = icHangi(hp, 0.3)?.id;
      list = list.filter(m => m.kat === kat && (m.room === oda || IC_BY_ID[m.room]?.bina === 'avm') && Math.hypot(m.x - hp.x, m.z - hp.z) < MESAFE).sort((a, b) => Math.hypot(a.x - hp.x, a.z - hp.z) - Math.hypot(b.x - hp.x, b.z - hp.z));
      for (const o of kullan) o.visible = false; kullan.length = 0;
      const sayac = new Map<string, number>(); let ui = 0;
      const urunKoy = (id: string, x: number, y: number, z: number, k: number, ry: number) => {
        if (ui >= URUN_N) return; const n = sayac.get(id) || 0; sayac.set(id, n + 1);
        const o = urunAl(id, n); o.position.set(x, y, z); o.scale.setScalar(1.35 * k); o.rotation.y = ry; o.visible = true; kullan.push(o); ui++;
      };
      for (const m of list) {
        const y0 = katY(m.kat);
        // 2026-11-22 sahip: "büfede nasılsa öyle olsun". Büfedeki gibi havada rozet / tik / saniye yok: pişen ürün makinenin üstünde
        // yavaşça büyür (pişme ilerlemesi), biten ürün tezgâhta yan yana durur. Oyuncunun beklediği yer yerdeki dolum halkasıyla (rtview) görünür.
        if (m.cook) urunKoy(m.cook, m.mx, y0 + TEZGAH_Y + 0.04, m.mz, 0.55 + 0.45 * m.p, (m.p * 3 + tSaat) % (Math.PI * 2));
        m.ready.forEach((id, k) => { const f = (k - (m.ready.length - 1) / 2) * 0.3; urunKoy(id, m.x + m.dx * f, y0 + TEZGAH_Y, m.z + m.dz * f, 1, 0); });
      }
    },
  };
}
