/**
 * PRF-15 doku akışı (texture streaming): büyük çizimli dokuların üst mip katları yalnız gerektiğinde bellekte.
 * Bir karakter atlası 1024x512 (mip ile GPU'da 2.7 MB, tuvali de RAM'de 2 MB). Uzaktaki bir karakterin yüzünde ekran pikseli
 * başına bir dokudan az düşer: GPU zaten üst katları örneklemez, alttaki katlardan okur. Bu yüzden kayıtlı doku bir ölçek
 * merdiveninden (1, 1/2, 1/4, 1/8; aynı çizim küçük tuvalde) ekranın gerçekten okuyabildiği en küçük basamakta tutulur:
 * kamera yaklaşınca bir üst basamağa çıkar, uzaklaşınca iner. Ekranda görülen ayrıntı aynı kalır; 1/2 dörtte bir, 1/8 altmış
 * dörtte bir bellek tutar (karşı yakanın 41 işçisi iskeleden bakarken 28 MB yerine 0.5 MB).
 * - Ölçüt: ekranda 1 m'nin kaç piksel tuttuğu (ppm = yarı yükseklik / tan(fov/2) / uzaklık) ile basamağın 1 m'ye düşen doku
 *   sayısı (dpm yarım ölçekte verilir; ölçek s'de dpm * 2s). Bir basamak ppm > doku * YUKARI ise yetmez (bir üst, yetene dek);
 *   daha küçük bir basamakta ppm < doku * ASAGI kalıyorsa ona iner (gecikmeli eşik: sınırda gidip gelmez).
 * - Ana sahnede olmayan (ayrı renderer'lı kulis/ev odası önizlemesi gibi) nesneler ölçülemez: her zaman tam çözünürlük.
 * - Görünmeyen (kendisi ya da bir atası visible=false) nesneler en çok yarımda tutulur (daha küçükse olduğu gibi kalır).
 * - Kare başına en çok bir yeniden çizim (en acil olan önce): yaklaşırken bile kare süresine sıçrama koymaz.
 * - Eski doku değişimden sonra dispose edilir; malzemenin haritası değişir, shader değişmez (yeniden derleme yok).
 */
import * as T from 'three';

export const YUKARI = 1.0, ASAGI = 0.7;
/** Scale ladder, largest first (1/8 of a 1024x512 atlas is 128x64). */
export const OLCEKLER = [1, 0.5, 0.25, 0.125] as const;

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

/** Ladder step for scale `s` at `ppm` screen pixels per metre (`dpm` = texels per metre at half scale), with hysteresis. */
export function hedefOlcek(s: number, ppm: number, dpm: number): number {
  const doku = (x: number) => dpm * 2 * x;
  if (ppm > doku(s) * YUKARI) {   // not enough texels: the smallest larger step that is enough
    for (let i = OLCEKLER.length - 1; i >= 0; i--) { const x = OLCEKLER[i]; if (x > s && ppm <= doku(x) * YUKARI) return x; }
    return 1;
  }
  for (let i = OLCEKLER.length - 1; i >= 0; i--) { const x = OLCEKLER[i]; if (x < s && ppm < doku(x) * ASAGI) return x; }   // smallest step with margin
  return s;
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
    else if (!gorunur) ist = Math.min(r.olcek, 0.5);
    else {
      r.obj.getWorldPosition(_p);
      const d = Math.max(0.05, Math.hypot(_p.x - cx, _p.y + 1.2 - cy, _p.z - cz));
      const ppm = yari / tanH / d;
      ist = hedefOlcek(r.olcek, ppm, r.dpm);
      if (ist !== r.olcek) { const oran = ppm / (r.dpm * 2 * r.olcek), a = ist > r.olcek ? oran : 1 / Math.max(oran, 1e-3); if (a > enAciliyet) { enAciliyet = a; en = r; enOlcek = ist; } }
      continue;
    }
    if (ist !== r.olcek && !en) { en = r; enOlcek = ist; enAciliyet = 1e-6; }
  }
  if (!en) return;
  const eski = en.tex;
  if (enOlcek > en.olcek) yukari++; else asagi++;
  en.tex = en.ciz(enOlcek); en.olcek = enOlcek; cizim++;
  en.tak(en.tex);
  eski?.dispose();
}

/** Counters for tests and the perf meter. */
export function akisDurum(): { kayit: number; tam: number; cizim: number; yukari: number; asagi: number; seviye: Record<string, number> } {
  let tam = 0; const seviye: Record<string, number> = {};
  kayitlar.forEach(r => { if (r.olcek === 1) tam++; seviye[r.olcek] = (seviye[r.olcek] || 0) + 1; });
  return { kayit: kayitlar.size, tam, cizim, yukari, asagi, seviye };
}
