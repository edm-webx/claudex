/**
 * Kilitli bölgeler (2026-11-21, sahip: "haritanın iki ucu inşaat sahası olsun, zamanla büyüyüp açılacağı belli olsun").
 * İskele promenadının iki ucu (eskiden apartman blokları kapatıyordu) belediye inşaat sahasıdır: promenadı çit keser, denize
 * doğru toprak dolgu yapılmaktadır. İskele büyüdüğünde her saha ayrı ayrı yeni bir MAHALLE olarak açılacak; mahallenin kendisi
 * henüz yok. Saf veri, three yok: görünüm (view/world/insaat-sahasi.ts), işçiler (sim/agents/belediye.ts) ve çarpışma (boot)
 * aynı yerden okur.
 *
 * Koordinatlar yerel: u = taraf * x (u haritanın ucuna doğru büyür), z dünya z'si. Doğu taraf = +1, batı taraf = -1.
 *
 * Açılış kancası: bir bölge `acikBolgeler(state)` listesinde olduğunda açıktır. Bugün bu listeye kimse yazmaz (mahalle yok).
 * İskele genişlemesi yapıldığında o iş `state.acikBolgeler`e bölge id'sini ekler ve kaydeder; saha, işçiler ve çit kendiliğinden
 * kalkar, yerine mahalle kurulur.
 */

export interface UZ { u: number; z: number }
export interface Kutu { u0: number; u1: number; z0: number; z1: number }
export type Makine = 'ekskavator' | 'yukleyici' | 'damperli' | 'mikser' | 'silindir';

export interface IsciPlan {
  /** görev: tasiyici (yığından kalas taşır, kalıpta çekiç), kurek (kum küreği, betoniyere boşaltır), bayrakci (kapıda, oyuncuya el sallar), sef (kazıklar arasında gezer, telefon) */
  is: 'tasiyici' | 'kurek' | 'bayrakci' | 'sef';
  ad: string;
  /** sırayla gidilen noktalar; ilk nokta başlangıç */
  yol: UZ[];
}

export interface KilitliBolge {
  id: string;
  taraf: 1 | -1;
  /** gelecekteki mahallenin adı (tabelada yazar) */
  mahalle: string;
  yuklenici: string;
  /** promenadı kesen çit hattı (u) ve önündeki bariyer şeridi */
  citU: number; bariyerU: number;
  /** promenad üstündeki saha (çitin arkası) ve denize yapılan dolgu */
  saha: Kutu; dolgu: Kutu;
  /** kapı (çitte, z) */
  kapiZ: number;
  /** yon: kamyonlarda burnun baktığı u yönü (+1 haritanın ucuna, -1 içeri); diğerlerinde kullanılmaz */
  makineler: { tip: Makine; u: number; z: number; yon: number }[];
  /** ekskavatörün kazdığı toprak yığını ve kamyonun kasası; yükleyicinin/silindirin gidip geldiği hat */
  yigin: UZ; hat: { a: UZ; b: UZ };
  isciler: IsciPlan[];
  /** projektör kuleleri: gece ışık havuzuna lamba olarak girer */
  projektor: UZ[];
  /** açılma koşulu bilgisi (UI/plan için; asıl karar acikBolgeler listesinde) */
  acilis: { kosul: 'iskele-buyume'; not: string };
}

/** promenad yürünür z aralığı (layout WALKABLE ile aynı) */
export const PROM_Z0 = 4.45, PROM_Z1 = 13.3;

/** iki sahada aynı iş bölümü; noktalar makinelerin, yığınların ve kalıbın dışında (yürüyüş düz çizgi, gidip gelir) */
const ISCILER: IsciPlan[] = [
  { is: 'tasiyici', ad: 'Belediye işçisi Hayri', yol: [{ u: 55.6, z: 10.3 }, { u: 54.8, z: 4.0 }, { u: 43.1, z: 2.0 }] },
  { is: 'kurek', ad: 'Belediye işçisi Nurettin', yol: [{ u: 57.2, z: 7.4 }, { u: 55.7, z: 8.3 }] },
  { is: 'bayrakci', ad: 'Bayrakçı Cafer', yol: [{ u: 53.0, z: 8.0 }, { u: 53.0, z: 10.6 }] },
  { is: 'sef', ad: 'Şantiye şefi Kemal Bey', yol: [{ u: 44.0, z: 3.2 }, { u: 50.0, z: 2.8 }, { u: 56.0, z: 2.6 }, { u: 56.4, z: 6.4 }] },
];

export const KILITLI_BOLGELER: readonly KilitliBolge[] = [
  {
    id: 'insaat-dogu', taraf: 1, mahalle: 'Doğu Yakası Mahallesi', yuklenici: 'Kepçeoğlu İnşaat Taahhüt Ltd. Şti.',
    citU: 52, bariyerU: 50.5,
    saha: { u0: 52, u1: 80, z0: PROM_Z0, z1: PROM_Z1 }, dolgu: { u0: 36, u1: 80, z0: -8, z1: 4.4 },
    kapiZ: 9.3, yigin: { u: 44.5, z: -6.0 }, hat: { a: { u: 59.0, z: -5.0 }, b: { u: 59.0, z: -1.6 } },
    makineler: [
      { tip: 'ekskavator', u: 44.5, z: -1.7, yon: 0 },
      { tip: 'damperli', u: 50.5, z: -0.8, yon: 1 },
      { tip: 'yukleyici', u: 59.0, z: -3.0, yon: 0 },
      { tip: 'mikser', u: 62.5, z: 2.4, yon: 1 },
    ],
    isciler: ISCILER,
    projektor: [{ u: 37.4, z: 3.5 }, { u: 63.6, z: 12.6 }],
    acilis: { kosul: 'iskele-buyume', not: 'İskele doğuya büyüdüğünde Doğu Yakası Mahallesi açılır.' },
  },
  {
    id: 'insaat-bati', taraf: -1, mahalle: 'Batı Yakası Mahallesi', yuklenici: 'Mıcır Kardeşler Hafriyat A.Ş.',
    citU: 52, bariyerU: 50.5,
    saha: { u0: 52, u1: 80, z0: PROM_Z0, z1: PROM_Z1 }, dolgu: { u0: 36, u1: 80, z0: -8, z1: 4.4 },
    kapiZ: 9.3, yigin: { u: 57.5, z: -6.1 }, hat: { a: { u: 39.0, z: -4.6 }, b: { u: 46.5, z: -4.6 } },
    makineler: [
      { tip: 'ekskavator', u: 57.5, z: -2.4, yon: 0 },
      { tip: 'damperli', u: 50.5, z: -1.5, yon: -1 },
      { tip: 'silindir', u: 42.5, z: -4.6, yon: 0 },
      { tip: 'mikser', u: 62.5, z: 2.4, yon: 1 },
    ],
    isciler: ISCILER,
    projektor: [{ u: 37.4, z: 3.5 }, { u: 63.6, z: 12.6 }],
    acilis: { kosul: 'iskele-buyume', not: 'İskele batıya büyüdüğünde Batı Yakası Mahallesi açılır.' },
  },
];

/** yerel -> dünya */
export const dunya = (b: KilitliBolge, p: UZ): { x: number; z: number } => ({ x: b.taraf * p.u, z: p.z });
/** yerel kutu -> dünya dikdörtgeni */
export function dunyaKutu(b: KilitliBolge, k: Kutu): { x0: number; x1: number; z0: number; z1: number } {
  const a = b.taraf * k.u0, c = b.taraf * k.u1;
  return { x0: Math.min(a, c), x1: Math.max(a, c), z0: k.z0, z1: k.z1 };
}

/** AÇILIŞ KANCASI: açılmış bölgelerin id'leri (kayıtta `acikBolgeler`; bugün hep boş) */
export function acikBolgeler(state: unknown): readonly string[] {
  const l = (state as { acikBolgeler?: unknown } | null | undefined)?.acikBolgeler;
  return Array.isArray(l) ? l.filter((x): x is string => typeof x === 'string') : [];
}
export const bolgeKilitli = (b: KilitliBolge, state: unknown): boolean => !acikBolgeler(state).includes(b.id);

/** kilitli bölgelerin oyuncuyu durduran dikdörtgenleri: bariyer şeridinden haritanın ucuna, promenadın tamamı */
export function bolgeEngelleri(state: unknown): { x0: number; x1: number; z0: number; z1: number }[] {
  return KILITLI_BOLGELER.filter(b => bolgeKilitli(b, state)).map(b => dunyaKutu(b, { u0: b.bariyerU - 0.25, u1: 82, z0: PROM_Z0 - 0.6, z1: PROM_Z1 + 1.0 }));
}
