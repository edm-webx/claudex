/**
 * PRF-15 doku akışı (texture streaming): büyük çizimli dokuların en üst mip katı yalnız gerektiğinde bellekte.
 * Bir karakter atlası 1024x512 (mip ile GPU'da 2.7 MB, tuvali de RAM'de 2 MB). Uzaktaki bir karakterin yüzünde ekran pikseli
 * başına bir dokudan az düşer: GPU zaten en üst katı örneklemez, alttaki katlardan okur. Bu yüzden kayıtlı doku önce yarım
 * çözünürlükte (512x256, aynı çizim) çizilir; kamera, yarım dokunun piksel başına bir dokuyu karşılamayacağı kadar yaklaşınca
 * tam çözünürlüğe çıkar, uzaklaşınca yarıma iner. Ekranda görülen ayrıntı aynı kalır, bellek dörtte bire iner.
 * - Ölçüt: ekranda 1 m'nin kaç piksel tuttuğu (ppm = yarı yükseklik / tan(fov/2) / uzaklık) ile dokunun 1 m'ye düşen doku
 *   sayısı (dpm, yarım çözünürlükte) karşılaştırılır. ppm > dpm * YUKARI ise tam, ppm < dpm * ASAGI ise yarım (gecikmeli eşik).
 * - Ana sahnede olmayan (ayrı renderer'lı kulis/ev odası önizlemesi gibi) nesneler ölçülemez: her zaman tam çözünürlük.
 * - Görünmeyen (kendisi ya da bir atası visible=false) nesneler yarıma iner.
 * - Kare başına en çok bir yeniden çizim (en acil olan önce): yaklaşırken bile kare süresine sıçrama koymaz.
 * - Eski doku değişimden sonra dispose edilir; malzemenin haritası değişir, shader değişmez (yeniden derleme yok).
 */
import * as T from 'three';

export const YUKARI = 1.0, ASAGI = 0.7;

export interface AkisKaydi {
  /** Nesne (dünya konumu ve görünürlük buradan okunur). */
  obj: T.Object3D;
  /** Yarım çözünürlükte 1 m'ye düşen doku sayısı (yüz gibi en ince ayrıntının yoğunluğu). */
  dpm: number;
  /** Ölçekte (0.5 yarım, 1 tam) yeni doku çizer. */
  ciz(olcek: number): T.Texture;
  /** Yeni dokuyu malzemeye takar (eskisi akış tarafından dispose edilir). */
  tak(t: T.Texture): void;
}
interface Kayit extends AkisKaydi { olcek: number; tex: T.Texture | null; sil: boolean }

const kayitlar = new Set<Kayit>();
let cizim = 0, yukari = 0, asagi = 0, zorlaTam = false;
/** Measurement hook (A/B proof that streaming changes no visible pixel): true keeps every texture at full scale. */
export function akisZorla(tam: boolean): void { zorlaTam = tam; }
const _p = /* @__PURE__ */ new T.Vector3();

/** Registers a streamed texture; draws it now at half scale and returns the texture plus a remover (disposes it). */
export function akisKaydet(k: AkisKaydi): { tex: T.Texture; birak(): void } {
  const r: Kayit = { ...k, olcek: 0.5, tex: null, sil: false };
  r.tex = r.ciz(0.5); cizim++;
  kayitlar.add(r);
  return { tex: r.tex, birak() { if (r.sil) return; r.sil = true; kayitlar.delete(r); r.tex?.dispose(); r.tex = null; } };
}

function kokVeGorunur(o: T.Object3D): { kok: T.Object3D; gorunur: boolean } {
  let g = true, c: T.Object3D = o;
  for (;;) { if (!c.visible) g = false; if (!c.parent) break; c = c.parent; }
  return { kok: c, gorunur: g };
}

/** Picks at most one texture to redraw per call (the most urgent). Call once per frame with the main scene camera. */
export function akisGuncelle(scene: T.Object3D, camera: T.PerspectiveCamera, ekranYuk: number): void {
  if (!kayitlar.size) return;
  const tanH = Math.tan((camera.fov * Math.PI) / 360) || 1, yari = ekranYuk / 2;
  camera.getWorldPosition(_p);
  const cx = _p.x, cy = _p.y, cz = _p.z;
  let en: Kayit | null = null, enOlcek = 0, enAciliyet = 0;
  for (const r of kayitlar) {
    const { kok, gorunur } = kokVeGorunur(r.obj);
    let ist: number;
    if (kok !== scene || zorlaTam) ist = 1;
    else if (!gorunur) ist = 0.5;
    else {
      r.obj.getWorldPosition(_p);
      const d = Math.max(0.05, Math.hypot(_p.x - cx, _p.y + 1.2 - cy, _p.z - cz));
      const ppm = yari / tanH / d, oran = ppm / r.dpm;
      ist = r.olcek === 1 ? (oran < ASAGI ? 0.5 : 1) : (oran > YUKARI ? 1 : 0.5);
      if (ist !== r.olcek) { const a = ist === 1 ? oran : 1 / Math.max(oran, 1e-3); if (a > enAciliyet) { enAciliyet = a; en = r; enOlcek = ist; } }
      continue;
    }
    if (ist !== r.olcek && !en) { en = r; enOlcek = ist; enAciliyet = 1e-6; }
  }
  if (!en) return;
  const eski = en.tex;
  en.tex = en.ciz(enOlcek); en.olcek = enOlcek; cizim++;
  if (enOlcek === 1) yukari++; else asagi++;
  en.tak(en.tex);
  eski?.dispose();
}

/** Counters for tests and the perf meter. */
export function akisDurum(): { kayit: number; tam: number; cizim: number; yukari: number; asagi: number } {
  let tam = 0; kayitlar.forEach(r => { if (r.olcek === 1) tam++; });
  return { kayit: kayitlar.size, tam, cizim, yukari, asagi };
}
