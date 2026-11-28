/**
 * Yemek kataloğu ve 10 aşamalı menü büyümesi (BUF-04). Pure data + küçük saf yardımcılar (sim yok, three yok).
 *
 * İki katalog: tezgâh ürünleri (products.ts, 6 ProductId: ekonomi çekirdeği, DEĞİŞMEZ) ve mutfak yemekleri (burada, DishId).
 * Yemek masa biletinde adıyla istenir, mutfakta KENDİ istasyonunda kendi adıyla pişer (BUF-05: gerçek FoodId akışı, taşıyıcı ürün
 * köprüsü yok), pass rafından garsonla masaya gider; satışta yemeğin fiyatı geçer, birim maliyet yemek grubunun oranıyla her
 * satıştan düşer. STOK / malzeme / kalite yok.
 * Eski ürünler (simit, çay, ayran...) üst aşamalarda da menüde kalır; yeniler eklenir. Türk mutfağı çekirdek,
 * fine dining aşamasında (10) birkaç dünya yemeği.
 */
import type { ProductId } from '../game/sim/schema';
import { PRODUCTS } from './products';
import { MUTFAK_ISTASYON, URUN_ISTASYON, PISIRME_S, calismaIstasyonuOf } from './mutfak';

export type DishGrup = 'icecek' | 'hamur' | 'kahvalti' | 'deniz' | 'izgara' | 'meze' | 'tatli' | 'sef' | 'tadim';
export interface DishDef {
  id: string;
  ad: string;
  /** content/mutfak.ts MUTFAK_ISTASYON id'si */
  istasyon: string;
  /** hazırlık süresi (sn, bilgi + bilet sabrı hesabı) */
  hazirlik: number;
  /** birim fiyat (₺, tadım menüsünde toplam) */
  fiyat: number;
  /** açıldığı büfe aşaması */
  asama: number;
  grup: DishGrup;
  /** tadım menüsü: art arda [min, maks] servis, fiyat servislere bölünür */
  kurs?: [number, number];
}
export type DishId = string;
/** Sim'de masa biletlerinde geçen yiyecek: tezgâh ürünü ya da mutfak yemeği */
export type FoodId = ProductId | DishId;

const D = (id: string, ad: string, istasyon: string, hazirlik: number, fiyat: number, asama: number, grup: DishGrup, kurs?: [number, number]): DishDef => ({ id, ad, istasyon, hazirlik, fiyat, asama, grup, kurs });
export const DISHES: DishDef[] = [
  // 3 çay bahçesi
  D('demlik_cay', 'Demlik çay', 'cay_bar', 6, 35, 3, 'icecek'),
  D('gozleme', 'Gözleme', 'ocak', 14, 80, 3, 'hamur'),
  // 2026-11-22: içecek dolabından şişe (büfedeki gazoz dolabı gibi): Kolaz ve soda, aşama 4'te gazoz çeşitleri
  D('kola', 'Kolaz (buz gibi şişe)', 'icecek_dolap', 2, 45, 3, 'icecek'),
  D('soda', 'Martı Soda', 'icecek_dolap', 2, 30, 3, 'icecek'),
  // 4
  D('maras_dondurma', 'Maraş dondurma', 'pass', 5, 60, 4, 'tatli'),
  D('gazoz_cesit', 'Gazoz çeşitleri', 'icecek_dolap', 2, 55, 4, 'icecek'),
  D('tavuk_sis', 'Tavuk şiş', 'izgara', 22, 150, 4, 'izgara'),
  D('patates_kizartma', 'Patates kızartması', 'fritoz', 12, 70, 4, 'hamur'),
  // 5
  D('kumpir', 'Kumpir', 'ocak', 18, 110, 5, 'hamur'),
  D('limonata', 'Limonata', 'cay_bar', 5, 45, 5, 'icecek'),
  D('mercimek_corbasi', 'Mercimek çorbası', 'ocak', 10, 60, 5, 'kahvalti'),
  // 6 kahvaltı salonu
  D('serpme_kahvalti', 'Serpme kahvaltı', 'salata', 20, 220, 6, 'kahvalti'),
  D('menemen', 'Menemen', 'ocak', 12, 120, 6, 'kahvalti'),
  D('sucuklu_yumurta', 'Sucuklu yumurta', 'ocak', 10, 130, 6, 'kahvalti'),
  D('iskender', 'İskender', 'doner', 16, 190, 6, 'izgara'),
  D('coban_salata', 'Çoban salata', 'salata', 8, 70, 6, 'meze'),
  // 7 lokanta
  D('hamsi_tava', 'Hamsi tava', 'fritoz', 14, 190, 7, 'deniz'),
  D('levrek', 'Levrek', 'izgara', 26, 260, 7, 'deniz'),
  D('midye_dolma', 'Midye dolma', 'meze', 10, 150, 7, 'deniz'),
  D('kunefe', 'Künefe', 'tatli', 16, 140, 7, 'tatli'),
  D('yaprak_sarma', 'Zeytinyağlı yaprak sarma', 'meze', 8, 120, 7, 'meze'),
  // 8 meze ve akşam
  D('meze_tabagi', 'Meze tabağı', 'meze', 12, 180, 8, 'meze'),
  D('bogaz_aksam', 'Boğaz manzaralı akşam yemeği', 'tas_firin', 30, 420, 8, 'sef'),
  D('ahtapot_salata', 'Ahtapot salatası', 'meze', 14, 230, 8, 'deniz'),
  D('manti', 'Mantı', 'ocak', 18, 160, 8, 'hamur'),
  D('lahmacun', 'Lahmacun', 'tas_firin', 12, 100, 8, 'hamur'),
  D('sutlac', 'Fırın sütlaç', 'tatli', 10, 110, 8, 'tatli'),
  // 9 ocakbaşı
  D('izgara_kofte', 'Izgara köfte', 'izgara2', 20, 240, 9, 'izgara'),
  D('adana', 'Şefin Adana\'sı', 'izgara2', 24, 280, 9, 'izgara'),
  D('kuzu_tandir', 'Kuzu tandır', 'tas_firin', 35, 360, 9, 'izgara'),
  D('beyti_sarma', 'Beyti sarma', 'ocak2', 26, 300, 9, 'izgara'),
  D('sufle', 'Çikolatalı sufle', 'tatli', 18, 190, 9, 'tatli'),
  // 10 fine dining (tadım menüsü + birkaç dünya yemeği)
  D('tadim_menusu', 'Tadım menüsü', 'sef_masa', 20, 900, 10, 'tadim', [4, 6]),
  D('lufer_bugulama', 'Lüfer buğulama', 'sef_masa', 26, 380, 10, 'deniz'),
  D('katmer', 'Fıstıklı katmer', 'tatli', 16, 210, 10, 'tatli'),
  D('risotto', 'Trüflü risotto', 'sef_masa', 22, 340, 10, 'sef'),
  D('sushi', 'Somon sushi tabağı', 'sef_masa', 18, 360, 10, 'sef'),
  D('biftek', 'Dry-aged biftek', 'izgara2', 30, 480, 10, 'sef'),
];
export const DISH_BY_ID: Record<string, DishDef> = Object.fromEntries(DISHES.map(d => [d.id, d]));
export const isDish = (id: string): id is DishId => id in DISH_BY_ID;

/** o aşamada ve öncesinde açılmış yemekler */
export const acikYemekler = (stage: number): DishDef[] => DISHES.filter(d => d.asama <= stage);
/** tam o aşamada menüye giren yemekler (SALON.yeni ve açılış toast'ı bundan gelir) */
export const yeniYemekler = (stage: number): DishDef[] => DISHES.filter(d => d.asama === stage);
/** birim maliyet payı (yemek grubuna göre, eski tezgâh ürünleri MALIYET bandında), her satıştan düşer (stok yok) */
export const GRUP_MALIYET: Record<DishGrup, number> = { icecek: 0.2, hamur: 0.3, kahvalti: 0.3, deniz: 0.38, izgara: 0.36, meze: 0.3, tatli: 0.3, sef: 0.38, tadim: 0.36 };
export const yemekMaliyet = (d: DishDef): number => GRUP_MALIYET[d.grup];
/** tezgâh ürününün yakın yemek grubu (müşterinin tezgâh siparişi yemek seçimini bu gruba çeker) */
export const URUN_GRUP: Record<ProductId, DishGrup> = { doner: 'izgara', cay: 'icecek', ayran: 'icecek', gazoz: 'icecek', simit: 'hamur', tost: 'hamur' };
export const isProduct = (id: string): id is ProductId => id in PRODUCTS;
/** yiyeceğin istenen istasyonu (yemek: DishDef.istasyon, tezgâh ürünü: URUN_ISTASYON) */
export const yemekIstasyon = (f: FoodId): string => DISH_BY_ID[f]?.istasyon ?? URUN_ISTASYON[f] ?? 'ocak';
/** BUF-13: içecek mi (çay barında hazırlanır: tezgâh içecekleri ve menüdeki içecek yemekleri); barista varsa yalnız o yapar */
export const icecekMi = (f: FoodId): boolean => { const i = yemekIstasyon(f); return i === 'cay_bar' || i === 'icecek_dolap'; };
/** o aşamada gerçekten pişeceği istasyon (yoksa ocak yedeği; soğuk oda ve bulaşık asla) */
export const calismaIstasyonu = (f: FoodId, stage: number): string => calismaIstasyonuOf(yemekIstasyon(f), stage);
/** yiyeceğin temel hazırlık süresi (sn): DishDef.hazirlik ya da PISIRME_S */
export const hazirlikOf = (f: FoodId): number => DISH_BY_ID[f]?.hazirlik ?? PISIRME_S[f] ?? 4.5;
/** tabağın görünen adı */
export const yemekAd = (f: FoodId): string => DISH_BY_ID[f]?.ad ?? (isProduct(f) ? PRODUCTS[f].short : f);
/** yemeğin istasyonunun mutfakta durduğu aşama */
export const istasyonAsama = (d: DishDef): number => MUTFAK_ISTASYON.find(i => i.id === d.istasyon)?.stage ?? 99;

/** müşteri tipine göre yemek grubu tercihi (balayı tatlı, taraftar köfte, iş insanı balık/şef...) */
export const TIP_TERCIH: Record<string, Partial<Record<DishGrup, number>>> = {
  taraftar: { izgara: 3, icecek: 1.5 }, gecekusu: { izgara: 2, hamur: 1.5 },
  balayi: { tatli: 3, deniz: 1.6, sef: 1.6, tadim: 3 }, isinsani: { deniz: 2.5, sef: 3, izgara: 1.5, tadim: 3.5 }, plaza: { sef: 2, izgara: 1.6, tadim: 2.5 },
  teyze: { hamur: 2.5, kahvalti: 2.5, tatli: 1.5 }, emekli: { icecek: 2, kahvalti: 2 }, universiteli: { hamur: 1.6, izgara: 1.5 },
  kruvaziyer: { deniz: 1.8, meze: 1.6, tadim: 1.5 }, gezgin: { deniz: 1.5, meze: 1.5 }, turgrubu: { meze: 1.6, izgara: 1.4 },
};
/** yemeğin seçilme ağırlığı: tip tercihi x (müşterinin tezgâh siparişi bu yemeğin grubuna yakınsa x2.5) */
export const yemekAgirlik = (d: DishDef, typeId: string, birim: ProductId | null): number => (TIP_TERCIH[typeId]?.[d.grup] ?? 1) * (birim && URUN_GRUP[birim] === d.grup ? 2.5 : 1);

export interface MenuSatir { id: string; ad: string; fiyat: number; istasyon: string; acik: boolean; kilit: string }
export interface MenuAsama { asama: number; ad: string; acik: boolean; yemekler: MenuSatir[] }
const ASAMA_AD = ['', 'Seyyar tezgâh', 'Büfe', 'Çay bahçesi', 'Izgara köşesi', 'Geniş mutfak', 'Kahvaltı salonu', 'Lokanta', 'Meze ve akşam', 'Ocakbaşı', 'Fine dining'];
/** Menü panosu: aşama aşama açılan liste; kilitli satırlar "Aşama N'de açılır" yazar (1-2: yalnız tezgâh ürünleri) */
export function menuPano(stage: number): MenuAsama[] {
  const out: MenuAsama[] = [];
  for (let a = 1; a <= 10; a++) {
    out.push({ asama: a, ad: ASAMA_AD[a], acik: a <= stage, yemekler: yeniYemekler(a).map(d => ({
      id: d.id, ad: d.ad, fiyat: d.fiyat, istasyon: MUTFAK_ISTASYON.find(i => i.id === d.istasyon)?.ad || d.istasyon,
      acik: d.asama <= stage, kilit: d.asama <= stage ? '' : 'Aşama ' + d.asama + '\'de açılır',
    })) });
  }
  return out;
}
/** tabağın üstündeki yemeğin rengi (görünüm: mutfak pass rafı ve istasyon tepsisi) */
const GRUP_RENK: Record<DishGrup, string> = { icecek: '#b0281e', hamur: '#e2b96a', kahvalti: '#f2c94c', deniz: '#9fb7c9', izgara: '#8a3a2a', meze: '#6f9e4f', tatli: '#f0d8a8', sef: '#c9a24a', tadim: '#d4af37' };
const URUN_RENK: Record<ProductId, string> = { doner: '#9a5a2a', cay: '#b0281e', ayran: '#fbfdff', simit: '#c98a3a', tost: '#e8c27a', gazoz: '#ff8a3a' };
export const yemekRenk = (f: FoodId): string => (isProduct(f) ? URUN_RENK[f] : DISH_BY_ID[f] ? GRUP_RENK[DISH_BY_ID[f].grup] : '#e8e2d4');
