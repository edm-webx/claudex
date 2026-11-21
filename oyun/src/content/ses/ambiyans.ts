// Ambiyans tablosu (SNT-07, SNT-08, DNY-17): bölge -> döngü katmanları + olay havuzu + gün evresi ağırlıkları.
// Saf veri ve saf matematik: DOM yok, AudioContext yok (engine/audio/ambiyans.ts çalar, testler doğrudan okur).
// SES ANA KURALI (sahip): yalnız bulunulan bölgenin atmosferi çalar, diğer bölge katmanları kapalı; geçişler yumuşak;
// bellek sıkı (kısa mono 24 kHz döngüler, eşzamanlı döngü en çok AMB_MAX_KATMAN).
import type { DayPhase } from '../../engine/api';

/** sabah, öğle, akşam, gece ağırlıkları (0 = hiç) */
export type EvreAgirlik = readonly [number, number, number, number];
export interface Nokta { x: number; z: number }
/** Sürekli döngü: ses-db `loops` kimliği. `at` + `r` verilirse kazanç kaynağa uzaklıkla düşer (fıskiye, tribün). */
export interface AmbKatman { loop: string; vol: number; evre: EvreAgirlik; at?: Nokta; r?: number }
/** Tek seferlik olay: ses-db `sfx` kimliği ya da motor tarifi ('simitci', 'mevsim', 'birdTrill'...). */
export interface AmbOlay { id: string; vol: number; evre: EvreAgirlik; at?: Nokta; r?: number }
export interface AmbBolge {
  katman: readonly AmbKatman[];
  olay: readonly AmbOlay[];
  /** iki olay arası (sn), evre yoğunluğuna bölünür */
  aralik: readonly [number, number];
  yogunluk: EvreAgirlik;
  /** iç mekan: dış döngü yok, hava kısık */
  ic?: boolean;
}

export const EVRE_SIRA: readonly DayPhase[] = ['morning', 'noon', 'sunset', 'night'];
export const evreIdx = (p: DayPhase | string): number => Math.max(0, EVRE_SIRA.indexOf(p as DayPhase));

/** eşzamanlı döngü üst sınırı (bölge + hava), DNY-17 doğrulaması */
export const AMB_MAX_KATMAN = 4;
/** evre geçişi (sn): 'pat diye gündüz' yok (H-080) */
export const EVRE_GECIS_SN = 30;
/** bölge geçişi (sn): yürürken yumuşak çapraz geçiş */
export const BOLGE_GECIS_SN = 3;
/** hava döngüsü geçişi (sn) */
export const HAVA_GECIS_SN = 8;
/** iç mekanda dış seslerin (hava) kısıklığı */
export const IC_KISIK = 0.25;
/** sahibe karar (SNT-07): gece iskelede martı ve vapur 'seyrek' (varsayılan) ya da 'kes'. Tek yer: aşağıdaki gece ağırlıkları. */
export const GECE_MARTI = 'seyrek' as 'seyrek' | 'kes';
const geceMarti = GECE_MARTI === 'kes' ? 0 : 0.12;

const DENIZ: AmbKatman = { loop: 'deniz', vol: 0.42, evre: [1, 1, 0.85, 0.35] };
const SESSIZ: AmbBolge = { katman: [], olay: [], aralik: [20, 40], yogunluk: [0, 0, 0, 0] };
const SAHIL_BENZERI: AmbBolge = { katman: [{ ...DENIZ, evre: [0.8, 0.8, 0.7, 0.5] }], olay: [{ id: 'gull', vol: 0.3, evre: [1, 1, 0.5, geceMarti] }], aralik: [12, 24], yogunluk: [1, 1, 0.8, 0.4] };

/** Halı saha / stadyum çevresi: kalabalık yatağı + seyrek tribün olayları (SNT-09 ile aynı kimlikler). */
const TRIBUN_OLAY: AmbOlay[] = [
  { id: 'clapChant', vol: 0.45, evre: [0.6, 1, 1, 0.3] },
  { id: 'tribunDavul', vol: 0.4, evre: [0.4, 1, 1, 0.2] },
  { id: 'crowdCheer', vol: 0.4, evre: [0.5, 1, 1, 0.3] },
  { id: 'crowdOoh', vol: 0.4, evre: [0.5, 1, 1, 0.3] },
];

export const AMBIYANS: Record<string, AmbBolge> = {
  // İskele: deniz + iskele tahtası + halat + martı + uzak vapur; gece sakin su, martı seyrek
  iskele: {
    katman: [DENIZ, { loop: 'iskele_gece', vol: 0.36, evre: [0, 0, 0.35, 1] }],
    olay: [
      { id: 'gull', vol: 0.4, evre: [1, 1, 0.55, geceMarti] },
      { id: 'creak', vol: 0.4, evre: [0.8, 0.8, 0.8, 0.6] },
      { id: 'halat', vol: 0.35, evre: [0.8, 1, 0.7, 0.4] },
      { id: 'horn', vol: 0.22, evre: [1, 1, 0.6, geceMarti] },
      { id: 'simitci', vol: 0.4, evre: [1, 0.6, 0, 0] },
      { id: 'spoon', vol: 0.3, evre: [0.6, 0.8, 1, 0.2] },
      { id: 'mevsim', vol: 0.4, evre: [0.4, 0.4, 0.6, 1] },
    ],
    aralik: [8, 16], yogunluk: [1, 1, 0.8, 0.45],
  },
  // Karşı yaka: uzak trafik + mahalle mırıltısı; meydanda fıskiye ve çay bardağı, okulda zil ve çocuklar, sahada tribün
  karsi: {
    katman: [
      { loop: 'karsi_sokak', vol: 0.3, evre: [0.8, 1, 0.9, 0.3] },
      { loop: 'fiskiye', vol: 0.32, evre: [1, 1, 1, 0.7], at: { x: -3.9, z: 45 }, r: 16 },
      { loop: 'kalabalik', vol: 0.22, evre: [0.4, 0.8, 0.8, 0.15], at: { x: -39.4, z: 45.4 }, r: 26 },
    ],
    olay: [
      { id: 'spoon', vol: 0.32, evre: [0.8, 1, 1, 0.3], at: { x: -3.9, z: 45 }, r: 22 },
      { id: 'otobus', vol: 0.35, evre: [1, 1, 0.8, 0.25], at: { x: 6, z: 22 }, r: 40 },
      { id: 'cocuk', vol: 0.3, evre: [0.8, 1, 0.3, 0], at: { x: 48.85, z: 39 }, r: 30 },
      { id: 'zil', vol: 0.3, evre: [0.7, 0.5, 0, 0], at: { x: 48.85, z: 37.25 }, r: 34 },
      { id: 'kopek', vol: 0.25, evre: [0.1, 0.1, 0.4, 0.8] },
      { id: 'mevsim', vol: 0.35, evre: [0.2, 0.2, 0.5, 1] },
    ],
    aralik: [9, 18], yogunluk: [1, 1, 0.8, 0.45],
  },
  // Orman: gündüz yaprak ve kuşlar, akşam mangal ve cırcır, gece baykuş ve rüzgar
  orman: {
    katman: [{ loop: 'orman_gunduz', vol: 0.34, evre: [1, 1, 0.5, 0] }, { loop: 'orman_gece', vol: 0.34, evre: [0, 0, 0.6, 1] }],
    olay: [
      { id: 'birdTrill', vol: 0.45, evre: [1, 1, 0.35, 0] },
      { id: 'birdCall', vol: 0.45, evre: [1, 0.9, 0.4, 0] },
      { id: 'woodpecker', vol: 0.4, evre: [0.6, 0.8, 0.2, 0] },
      { id: 'sizzle', vol: 0.22, evre: [0, 0.3, 1, 0.3] },
      { id: 'baykus', vol: 0.4, evre: [0, 0, 0.25, 1] },
      { id: 'mevsim', vol: 0.45, evre: [0.2, 0.2, 0.5, 0.8] },
    ],
    aralik: [5, 11], yogunluk: [1, 1, 0.8, 0.5],
  },
  // Stadyum ve halı sahalar: kalabalık yatağı (SNT-09 tribün olaylarıyla aynı aileden)
  stadyum: { katman: [{ loop: 'kalabalik', vol: 0.26, evre: [0.6, 1, 1, 0.35] }], olay: TRIBUN_OLAY, aralik: [6, 12], yogunluk: [0.6, 1, 1, 0.4] },
  // halı saha maç ekranı açık: aynı tribün, daha sık
  halisaha: { katman: [{ loop: 'kalabalik', vol: 0.32, evre: [1, 1, 1, 1] }], olay: TRIBUN_OLAY, aralik: [4, 8], yogunluk: [1, 1, 1, 1] },
  // deniz kıyısı ama paket kapsamı dışı: yalnız mevcut deniz döngüsü (yatırım yok)
  sahil: SAHIL_BENZERI, barinak: SAHIL_BENZERI, tersane: SAHIL_BENZERI, adalar: SAHIL_BENZERI,
  // kapsam dışı bölgeler: yanlışlıkla deniz çalmasın diye nötr (yalnız hava)
  carsi: SESSIZ, yokus: SESSIZ, meydan: SESSIZ, gece: SESSIZ, metro: SESSIZ, tepe: SESSIZ,
  // iç mekanlar: dış döngü yok, hava kısık
  ev: { ...SESSIZ, ic: true },
  ic: { ...SESSIZ, ic: true },
};

/** 'karsi.meydan' -> 'karsi', 'ic.kafe' -> 'ic'; bilinmeyen bölge -> nötr */
export function ambBolge(zone: string): AmbBolge {
  return AMBIYANS[zone] || AMBIYANS[zone.split('.')[0]] || SESSIZ;
}

/** Hava döngüsü ve tepe kazancı (yoksa null). */
export function havaKatman(weather: string): { loop: string; vol: number } | null {
  if (weather === 'firtina') return { loop: 'yagmur', vol: 0.75 };
  if (weather === 'saganak') return { loop: 'yagmur', vol: 0.55 };
  if (weather === 'lodos') return { loop: 'ruzgar', vol: 0.4 };
  return null;
}

/** Bir noktaya uzaklıkla kazanç çarpanı: r içinde (1 - d/r)^2, dışında 0 (uzak ses hiç kurulmaz). */
export function uzaklikKazanc(d: number, r: number): number { return d >= r ? 0 : (1 - d / r) * (1 - d / r); }

/** Bölge katmanlarının ağırlıkları (0..1): gün evresi x kaynağa uzaklık. ~0 olan döngü listede yok (kurulmaz). */
export function katmanAgirlik(zone: string, phase: DayPhase | string, dinleyici: Nokta): Record<string, number> {
  const b = ambBolge(zone), e = evreIdx(phase), out: Record<string, number> = {};
  for (const k of b.katman) {
    let w = k.evre[e];
    if (k.at && k.r) w *= uzaklikKazanc(Math.hypot(k.at.x - dinleyici.x, k.at.z - dinleyici.z), k.r);
    if (w * k.vol > 0.003) out[k.loop] = Math.max(out[k.loop] ?? 0, w);
  }
  return out;
}

/**
 * Bu an için hedef döngü kazançları (vol x ağırlık): yalnız bulunulan bölge (+ hava). En çok AMB_MAX_KATMAN döngü,
 * en yüksek kazançlılar kalır.
 */
export function hedefKazanclar(zone: string, phase: DayPhase | string, weather: string, dinleyici: Nokta): Record<string, number> {
  const b = ambBolge(zone), w = katmanAgirlik(zone, phase, dinleyici), out: [string, number][] = [];
  for (const k of b.katman) if (w[k.loop]) out.push([k.loop, k.vol * w[k.loop]]);
  const h = havaKatman(weather);
  if (h) out.push([h.loop, h.vol * (b.ic ? IC_KISIK : 1)]);
  const best = new Map<string, number>();
  for (const [id, v] of out) best.set(id, Math.max(best.get(id) ?? 0, v));
  return Object.fromEntries([...best].sort((a, b2) => b2[1] - a[1]).slice(0, AMB_MAX_KATMAN));
}

/** Atmosfer kapısının (engine/audio/atmosphere.ts, a ajanı) katman biçimi; yapısal, motor tipine bağlı değil. */
export interface KapiKatman { id: string; loop?: string; gain: number; dyn?: 'grill' }
/** ses bölgesi anahtarları (content/ses/bolgeler.ts): alt bölgeler aynı tabloyu kullanır */
export const ALT_BOLGELER = ['karsi.meydan', 'karsi.okul', 'karsi.halisaha'] as const;
/**
 * Kapı tablosu: her bölge için şu an duyulacak döngüler (gain = tablo vol; evre/uzaklık çarpanını motor ağırlık düğümü
 * uygular). `zone` için `canli` (kazancı hâlâ > 0 olan) döngüler de kalır ki evre geçişi kapı tarafından kesilmesin.
 * `temel` içindeki iç mekan anahtarları (mutfak, restoran, ic, ev...) aynen korunur. '*' nötr: bilinmeyen bölgede deniz yok.
 */
export function kapiTablosu(phase: DayPhase | string, dinleyici: Nokta, zone: string, canli: Record<string, number>, temel: Record<string, readonly KapiKatman[]> = {}): Record<string, KapiKatman[]> {
  const t: Record<string, KapiKatman[]> = {};
  for (const k in temel) t[k] = [...temel[k]];
  for (const key of [...Object.keys(AMBIYANS), ...ALT_BOLGELER]) {
    const b = ambBolge(key);
    if (b.ic) { t[key] = t[key] ?? []; continue; }
    const w = katmanAgirlik(key, phase, dinleyici), list: KapiKatman[] = [];
    for (const k of b.katman) if (w[k.loop] || (key === zone && (canli[k.loop] ?? 0) > 0)) list.push({ id: k.loop, loop: k.loop, gain: k.vol });
    if (key.split('.')[0] === 'iskele') list.push({ id: 'izgara', loop: 'izgara', gain: 1, dyn: 'grill' });   // büfe döneri (seviye mesafeden)
    t[key] = list;
  }
  for (const id in IC_ODA) t[id] = [{ id: IC_ODA[id].loop, loop: IC_ODA[id].loop, gain: IC_ODA[id].vol }];
  t['*'] = [];
  return t;
}
/**
 * İç mekan oda tonları (ic-mekan id -> döngü): kafede kafe, lokantada lokanta, mutfakta mutfak; dış deniz/martı yok.
 * Yalnız bulunulan iç mekanın döngüsü kurulur (kapı tek kapsam açar). vol = döngü kazancı (kısık, konuşmayı ezmez).
 */
export const IC_ODA: Record<string, { loop: string; vol: number }> = {
  kafe1: { loop: 'ic_kafe', vol: 0.5 }, kafe2: { loop: 'ic_lokanta', vol: 0.45 }, tesis: { loop: 'ic_kafe', vol: 0.4 },
  salonW: { loop: 'ic_kafe', vol: 0.45 }, salonE: { loop: 'ic_lokanta', vol: 0.45 }, avm: { loop: 'ic_lokanta', vol: 0.4 },
  avm_moda: { loop: 'ic_avm', vol: 0.45 }, avm_tekno: { loop: 'ic_avm', vol: 0.45 }, avm_oyuncak: { loop: 'ic_avm', vol: 0.45 },
  mutfak: { loop: 'ic_mutfak', vol: 0.5 }, okul: { loop: 'ic_okul', vol: 0.5 }, kirtasiye: { loop: 'ic_oda', vol: 0.4 },
  banka: { loop: 'ic_oda', vol: 0.35 }, hastane: { loop: 'ic_hastane', vol: 0.45 }, acil: { loop: 'ic_hastane', vol: 0.4 },
  morg: { loop: 'ic_hastane', vol: 0.3 }, ev: { loop: 'ic_oda', vol: 0.3 },
};
/** tablo imzası: değişmediyse kapıya yeniden verilmez */
export const tabloImza = (t: Record<string, readonly KapiKatman[]>): string => Object.keys(t).sort().map(k => k + ':' + t[k].map(l => l.id).join(',')).join('|');

/** Kazancı hedefe doğru en çok dt/sure (tam ölçek) kadar yürüt: sabit hızlı, kesintisiz rampa. */
export function yaklas(cur: number, hedef: number, dt: number, sure: number): number {
  const adim = sure > 0 ? dt / sure : 1;
  return Math.abs(hedef - cur) <= adim ? hedef : cur + Math.sign(hedef - cur) * adim;
}

/**
 * Çanta (shuffle-bag): havuzdaki her öğe çantaya ağırlığına göre 0-2 kez girer, karıştırılır; çanta bitince yeniden
 * dolar. Aynı öğe ardışık iki kez çıkmaz (çanta içinde ve çanta sınırında), havuzda tek öğe yoksa.
 */
export class Canta<T> {
  private bag: T[] = []; private last: T | undefined;
  constructor(private items: readonly { v: T; w: number }[], private rnd: () => number) {}
  private fill() {
    const b: T[] = [];
    for (const it of this.items) { const n = it.w >= 0.75 ? 2 : it.w >= 0.25 ? 1 : it.w > 0 && this.rnd() < it.w * 4 ? 1 : 0; for (let i = 0; i < n; i++) b.push(it.v); }
    if (!b.length) for (const it of this.items) if (it.w > 0) b.push(it.v);
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    // çekiliş sırası kur: her adımda öncekinden farklı öğe; yalnız aynısı kaldıysa iki farklı komşu arasına yerleştir
    const seq: T[] = []; let prev = this.last;
    while (b.length) {
      const i = b.findIndex(x => x !== prev);
      if (i >= 0) { prev = b.splice(i, 1)[0]; seq.push(prev); continue; }
      const v = b.pop() as T;
      for (let k = 1; k < seq.length; k++) if (seq[k - 1] !== v && seq[k] !== v) { seq.splice(k, 0, v); break; }
    }
    this.bag = seq.reverse();
  }
  next(): T | undefined {
    if (!this.bag.length) this.fill();
    const v = this.bag.pop();
    this.last = v; return v;
  }
  /** sıradaki (çekmeden) */
  peek(): T | undefined { if (!this.bag.length) this.fill(); return this.bag[this.bag.length - 1]; }
}

// ───────── SNT-08 morg gece sesleri ─────────
export const MORG = {
  at: { x: 57.3, z: 55.5 } as Nokta,
  /** bu mesafenin dışında hiç tetik yok */
  r: 40,
  /** tetik aralığı (sn): eski 7-16 sn yorucuydu */
  aralik: [18, 40] as const,
  sesler: ['moan', 'knock', 'whisper'] as const,
  gece: (h: number) => h >= 22 || h < 5.5,
};

// ───────── SNT-14 canlı müzik (müzisyen) ─────────
export const CANLI = {
  /** ses-db music.tracks kimliği: saz + ney, ped/bas/vurmalı yok (sert dalga yok) */
  parca: 'canli_saz',
  /** duyulma yarıçapı (m); dışında kaynak kurulmaz */
  r: 16,
  vol: 0.5,
  /** son 'canliMuzik' olayından bu kadar sn sonra susar (sim her 12 sn bildirir) */
  omur: 14,
  /** yakındayken arka plan müziğinin en çok kısılması */
  kis: 0.4,
};
/** canlı müzik kazancı ve arka plan kısma çarpanı (1 = kısma yok) */
export function canliSeviye(d: number): { vol: number; muzik: number } {
  const k = uzaklikKazanc(d, CANLI.r);
  return { vol: CANLI.vol * k, muzik: 1 - (1 - CANLI.kis) * Math.min(1, k * 1.6) };
}
