/**
 * Turistler (survey musteri-4, musteri-7). Pure data: tourist pronunciations and guide wave. Used by src/game/sim/musteri.ts.
 */
import type { ProductId } from '../game/sim/schema';
/** Citizen types that count as tourists (cap + camera looks). */
export const TOURIST_TYPES = ['kruvaziyer', 'turgrubu', 'gezgin'];
/** Comic pronunciations per product, shown in the tourist's bubble. */
export const TOURIST_SAY: Record<string, string[]> = {
  doner: ['Dönır!', 'Dönner plis!', 'Dö-ner? Dönır!'],
  cay: ['Çayy plis!', 'Çaay, ince belli!', 'Tşay?'],
  ayran: ['Ayrun!', 'Ayraan, köpük köpük!', 'Eyran?'],
  simit: ['Simmit!', 'Simit, simit, simmit!', 'Sesame halka?'],
  tost: ['Tosst!', 'Tost, çiz çok!', 'Toast? Tost!'],
  gazoz: ['Gazooz!', 'Gazoz, fıss!', 'Gaz-oz?'],
};
export const TOURIST_THANKS = ['Teşekkürler! Teşşekür?', 'Çok güzel! Very çok!', 'Sabri numbır van!', 'Yummy, afiyet!'];
/** Sabri explains with hands and arms. */
export const SABRI_GESTURE = ['(el kol hareketi) Yes yes, çok güzel!', '(baş parmak) Süper, afiyet!', '(eliyle kalp) Hoş geldin turist!', '(parmakla sayar) Bir, iki... tamam!'];
export const PHOTO_TOAST = 'Büfen fotoğraflandı! Turist albümüne girdin.';
export const GUIDE_WAVE = { say: 'Rehber: Herkes bir şey alsın!', toast: 'Bayraklı rehber kafilesini getirdi! Toplu sipariş dalgası!' };

// ───────── BUF-12 kasa, BUF-23 müşteri tipleri, BUF-24 gruplar ve yoğunluk (saf veri; sim/customers.ts kullanır) ─────────

/**
 * Kasiyer gerçek kasada (BUF-12): kasiyer yokken ödeme anında (eski davranış). Kasiyer kasa başındayken tezgâhtan ürünü alan
 * müşteri kasa sırasına girer. İşlem süresi = (taban + kalem x kalemSayısı) x tipX / rütbeÇarpanı (RANKS[rank].x), yani seviye gerçekten hızlandırır.
 * Kasa kuyruğu doluysa (maxKuyruk) müşteri yan kasadan hemen öder (tezgâh kuyruğu asla tıkanmaz).
 */
export const KASA = {
  taban: 2.2, kalem: 0.4, maxKuyruk: 6,
  /** ürünleri alan müşterinin sabrı kasaya girerken bu kadar patMax payı kadar tazelenir (yemeği aldı, daha hoşgörülü) */
  sabirPayi: 0.25,
  /** kasa kuyruğunda sabır bu çarpanla akar (tezgâh kuyruğundan yavaş) */
  sabirAkis: 0.7,
  /** kasiyerin yerinde sayılması için kasa duruşuna en çok bu kadar uzakta (m) */
  yerindeM: 1.8,
  /** kart ödeme animasyonu (yalnız görsel) */
  kartAnimS: 0.9,
};
export const KASA_SOZ = {
  hizli: ['Hemen geçiyorum!', 'Bir saniye, kasa açık.', 'Buyurun, hesap şu.'],
  sinirli: ['Bu kasa hiç ilerlemiyor!', 'Ben kasada beklemeye gelmedim!', 'Ödeyeceğiz, ödeyeceğiz, yeter ki biri baksın!'],
};

/** Kasa duruşu (kasiyerin durduğu yer) kasa objesinin ve para yığınının arkası: bölge/yerleşim L.kasa'dan. */
export function kasaDurus(kasa: { pos: { x: number; z: number }; pile: { x: number; z: number } }, i = 0): { x: number; z: number } {
  return { x: kasa.pile.x + 0.75 + 1.05 * i, z: kasa.pile.z + 0.05 };
}
/** Kasa sırası noktaları: kasa objesinin önünde (kiosk dışı yol), 3'lü sütun + yan sütun. */
export function kasaSiraNokta(kasa: { pos: { x: number; z: number } }, i: number): { x: number; z: number } {
  return { x: kasa.pos.x + (i >= 3 ? 0.85 : 0), z: kasa.pos.z + 1.0 + 0.8 * (i % 3) };
}
/** Kasa işlem süresi (sn): kalem sayısı, müşteri tipi çarpanı, kasiyer rütbe çarpanı (RANKS[rank].x). */
export const kasaSure = (kalem: number, rankX: number, tipX = 1): number => (KASA.taban + KASA.kalem * Math.max(1, kalem)) * tipX / Math.max(1, rankX);

/**
 * Müşteri tipi davranışları (BUF-23). Ekonomi hızı korunur: sabir < 1 YOK (ilk oturum eğrisi bozuluyordu; iş insanının acelesi zaten patience 1 ve hızlı kasa), ürün eğilimleri hafif. Anahtar: citizens/index.ts tip id'si; etiket oyuncunun gördüğü tür adı.
 *  ye: yeme süresi çarpanı | sabir: sabır çarpanı | kasa: kasa işlem süresi çarpanı | kart: karta yatkınlık 0..1 (yalnız görsel)
 *  urun: ürün tercih çarpanı (ucuz/pahalı eğilim) | sohbet: kasada sohbet satırları | buyuk: büyük grup şansı ve boyu
 */
export type TipEtiket = 'ogrenci' | 'aile' | 'cift' | 'yasli' | 'isinsani' | 'turist' | 'taraftar';
export interface TipDavranis {
  etiket: TipEtiket; ye: number; sabir: number; kasa: number; kart: number;
  urun?: Partial<Record<ProductId, number>>; sohbet?: string[];
  buyuk?: { sans: number; n: [number, number]; ad: string };
}
const SOHBET_YASLI = ['Bizim zamanımızda kasa defterdi evladım...', 'Hele bir dur, bozuk paramı arıyorum.', 'Nasılsın kızım, anan iyi mi?', 'Çay da güzeldi, sohbet de.'];
export const TIP_DAVRANIS: Record<string, TipDavranis> = {
  universiteli: { etiket: 'ogrenci', ye: 0.8, sabir: 1, kasa: 0.85, kart: 0.5, urun: { simit: 1.2, ayran: 1.15, gazoz: 1.1 }, buyuk: { sans: 0.06, n: [4, 6], ad: 'Doğum günü kalabalığı' } },
  okul: { etiket: 'ogrenci', ye: 0.8, sabir: 1, kasa: 0.9, kart: 0.1, buyuk: { sans: 0.12, n: [5, 6], ad: 'Okul gezisi' } },
  bebekarabali: { etiket: 'aile', ye: 1.15, sabir: 1.1, kasa: 1.15, kart: 0.7, buyuk: { sans: 0.2, n: [4, 6], ad: 'Aile sofrası' } },
  teyze: { etiket: 'yasli', ye: 1.3, sabir: 1.1, kasa: 1.3, kart: 0.15, sohbet: SOHBET_YASLI },
  emekli: { etiket: 'yasli', ye: 1.4, sabir: 1.1, kasa: 1.35, kart: 0.1, sohbet: SOHBET_YASLI },
  turgrubu: { etiket: 'yasli', ye: 1.3, sabir: 1.1, kasa: 1.3, kart: 0.3, sohbet: SOHBET_YASLI },
  balayi: { etiket: 'cift', ye: 1.5, sabir: 1.15, kasa: 1.1, kart: 0.8 },
  isinsani: { etiket: 'isinsani', ye: 0.85, sabir: 1, kasa: 0.8, kart: 0.95, urun: { doner: 1.7, tost: 1.5, cay: 0.8, ayran: 0.9 } },
  plaza: { etiket: 'isinsani', ye: 0.9, sabir: 1, kasa: 0.85, kart: 0.9, urun: { doner: 1.3, tost: 1.2 } },
  kruvaziyer: { etiket: 'turist', ye: 1.0, sabir: 1, kasa: 1.25, kart: 0.7, buyuk: { sans: 0.1, n: [4, 6], ad: 'Tur kafilesi' } },
  gezgin: { etiket: 'turist', ye: 1.0, sabir: 1, kasa: 1.2, kart: 0.6 },
  taraftar: { etiket: 'taraftar', ye: 0.9, sabir: 1, kasa: 0.9, kart: 0.3, buyuk: { sans: 0.25, n: [4, 6], ad: 'Taraftar grubu' } },
};
export const TIP_DAVRANIS_VARSAYILAN: TipDavranis = { etiket: 'ogrenci', ye: 1, sabir: 1, kasa: 1, kart: 0.4 };
export const davranisOf = (typeId: string): TipDavranis => TIP_DAVRANIS[typeId] || TIP_DAVRANIS_VARSAYILAN;

/**
 * Büyük gruplar (BUF-24): grup boyu 1..6, gövde sayısı grup kadar. Bir masa 2 kişilik: büyük grup yakın masaları birleştirir
 * (6 kişi = 3 masa). Oyuncuyu bunaltmama: aynı anda en çok `esZamanli` büyük grup, kuyruk kısaysa gelir, sabır payı artar.
 */
export const GRUP = {
  max: 6, masaKisi: 2,
  /** aynı anda sahnede olabilecek büyük (>= 5 kişi) grup sayısı */
  esZamanli: 2,
  /** büyük grubun sabrına eklenen pay (kişi başı, üst sınır) */
  sabirKisi: 0.08, sabirUst: 0.3,
  /** büyük grup gelmek için tezgâh kuyruğu bu uzunluktan kısa olmalı */
  kuyrukMax: 4,
  /** masa birleştirme: ana masaya bu kadar metreden yakın masalar birleşir */
  birlesM: 5.2,
  /** hafta sonu ve maç dalgasında büyük grup şansı çarpanı */
  haftaSonuX: 1.6, macDalgaX: 1.8,
};
/** Hafta sonu yoğunluğu (BUF-24): Cumartesi ve Pazar varış hızı çarpanı (11:00-24:00). Hafta içi 1 kalır. */
export const HAFTA_SONU = { arrival: 1.2, from: 11, to: 24, say: 'Hafta sonu kalabalığı!' };
/**
 * Maç günü iki dalga (BUF-24): öncesi (maça hazırlık) ve sonrası (tribün dönüşü) çarpan; aralarda hafif yüksek taban.
 * Eski düz x1.35 yerine geçer; günlük toplam yük aşağı yukarı aynı kalır, ama tepe noktaları dalga olur.
 */
export const MAC_DALGA = {
  from: 11, to: 24, taban: 1.1, carpan: 1.6,
  once: [14, 17.5] as [number, number], sonra: [19, 22.5] as [number, number],
  say: { once: 'Maç öncesi dalgası: taraftarlar iskeleye doluyor!', sonra: 'Maç sonrası dalgası: tribün dönüşü!' },
};
/** hafta sonu x maç günü birlikte: toplam kalabalık çarpanı bu sınırı geçmez (açık bilet sınırı ve sabır payı korunur) */
export const KALABALIK_UST = 1.8;
export const macDalgaX = (h: number): number => (h < MAC_DALGA.from || h >= MAC_DALGA.to ? 1 : (h >= MAC_DALGA.once[0] && h < MAC_DALGA.once[1]) || (h >= MAC_DALGA.sonra[0] && h < MAC_DALGA.sonra[1]) ? MAC_DALGA.carpan : MAC_DALGA.taban);
export const macDalgaAdi = (h: number): 'once' | 'sonra' | null => (h >= MAC_DALGA.once[0] && h < MAC_DALGA.once[1] ? 'once' : h >= MAC_DALGA.sonra[0] && h < MAC_DALGA.sonra[1] ? 'sonra' : null);
