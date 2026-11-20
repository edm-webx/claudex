/**
 * Yemek kataloğu ve 10 aşamalı menü büyümesi (BUF-04). Pure data + küçük saf yardımcılar (sim yok, three yok).
 *
 * İki katalog: tezgâh ürünleri (products.ts, 6 ProductId: ekonomi çekirdeği, DEĞİŞMEZ) ve mutfak yemekleri (burada, DishId).
 * Yemek masa biletinde adıyla istenir ve adıyla getirilir; fiziksel olarak bir "taşıyıcı" ürün tabağı üzerinden akar
 * (usta/garson/tezgâh akışı ProductId ile çalışmaya devam eder), satışta yemeğin kendi fiyatı geçer, birim maliyet taşıyıcının
 * MALIYET oranıyla her satıştan düşer. STOK / malzeme / kalite yok.
 * Eski ürünler (simit, çay, ayran...) üst aşamalarda da menüde kalır; yeniler eklenir. Türk mutfağı çekirdek,
 * fine dining aşamasında (10) birkaç dünya yemeği.
 */
import type { ProductId } from '../game/sim/schema';
import { MALIYET } from './ekonomi2';
import { MUTFAK_ISTASYON } from './mutfak';

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
  /** tabağı taşıyan tezgâh ürünü adayları (ilk yapılı olan seçilir) */
  tasiyici: ProductId[];
  grup: DishGrup;
  /** tadım menüsü: art arda [min, maks] servis, fiyat servislere bölünür */
  kurs?: [number, number];
}
export type DishId = string;
/** Sim'de masa biletlerinde geçen yiyecek: tezgâh ürünü ya da mutfak yemeği */
export type FoodId = ProductId | DishId;

const D = (id: string, ad: string, istasyon: string, hazirlik: number, fiyat: number, asama: number, tasiyici: ProductId[], grup: DishGrup, kurs?: [number, number]): DishDef => ({ id, ad, istasyon, hazirlik, fiyat, asama, tasiyici, grup, kurs });
export const DISHES: DishDef[] = [
  // 3 çay bahçesi
  D('demlik_cay', 'Demlik çay', 'cay_bar', 6, 35, 3, ['cay'], 'icecek'),
  D('gozleme', 'Gözleme', 'ocak', 14, 80, 3, ['simit', 'tost'], 'hamur'),
  // 4
  D('maras_dondurma', 'Maraş dondurma', 'pass', 5, 60, 4, ['ayran', 'cay'], 'tatli'),
  D('gazoz_cesit', 'Gazoz çeşitleri', 'cay_bar', 3, 55, 4, ['gazoz'], 'icecek'),
  D('tavuk_sis', 'Tavuk şiş', 'izgara', 22, 150, 4, ['doner'], 'izgara'),
  D('patates_kizartma', 'Patates kızartması', 'fritoz', 12, 70, 4, ['tost', 'simit'], 'hamur'),
  // 5
  D('kumpir', 'Kumpir', 'ocak', 18, 110, 5, ['tost', 'simit'], 'hamur'),
  D('limonata', 'Limonata', 'cay_bar', 5, 45, 5, ['ayran', 'gazoz'], 'icecek'),
  D('mercimek_corbasi', 'Mercimek çorbası', 'ocak', 10, 60, 5, ['cay', 'ayran'], 'kahvalti'),
  // 6 kahvaltı salonu
  D('serpme_kahvalti', 'Serpme kahvaltı', 'salata', 20, 220, 6, ['simit', 'tost'], 'kahvalti'),
  D('menemen', 'Menemen', 'ocak', 12, 120, 6, ['tost', 'simit'], 'kahvalti'),
  D('sucuklu_yumurta', 'Sucuklu yumurta', 'ocak', 10, 130, 6, ['tost', 'simit'], 'kahvalti'),
  D('iskender', 'İskender', 'doner', 16, 190, 6, ['doner'], 'izgara'),
  D('coban_salata', 'Çoban salata', 'salata', 8, 70, 6, ['ayran', 'cay'], 'meze'),
  // 7 lokanta
  D('hamsi_tava', 'Hamsi tava', 'fritoz', 14, 190, 7, ['doner'], 'deniz'),
  D('levrek', 'Levrek', 'izgara', 26, 260, 7, ['doner'], 'deniz'),
  D('midye_dolma', 'Midye dolma', 'meze', 10, 150, 7, ['simit', 'tost'], 'deniz'),
  D('kunefe', 'Künefe', 'tatli', 16, 140, 7, ['simit', 'tost'], 'tatli'),
  D('yaprak_sarma', 'Zeytinyağlı yaprak sarma', 'meze', 8, 120, 7, ['simit', 'ayran'], 'meze'),
  // 8 meze ve akşam
  D('meze_tabagi', 'Meze tabağı', 'meze', 12, 180, 8, ['simit', 'ayran'], 'meze'),
  D('bogaz_aksam', 'Boğaz manzaralı akşam yemeği', 'tas_firin', 30, 420, 8, ['doner'], 'sef'),
  D('ahtapot_salata', 'Ahtapot salatası', 'meze', 14, 230, 8, ['simit', 'ayran'], 'deniz'),
  D('manti', 'Mantı', 'ocak', 18, 160, 8, ['tost', 'doner'], 'hamur'),
  D('lahmacun', 'Lahmacun', 'tas_firin', 12, 100, 8, ['doner', 'tost'], 'hamur'),
  D('sutlac', 'Fırın sütlaç', 'tatli', 10, 110, 8, ['ayran', 'cay'], 'tatli'),
  // 9 ocakbaşı
  D('izgara_kofte', 'Izgara köfte', 'izgara2', 20, 240, 9, ['doner'], 'izgara'),
  D('adana', 'Şefin Adana\'sı', 'izgara2', 24, 280, 9, ['doner'], 'izgara'),
  D('kuzu_tandir', 'Kuzu tandır', 'tas_firin', 35, 360, 9, ['doner'], 'izgara'),
  D('beyti_sarma', 'Beyti sarma', 'ocak2', 26, 300, 9, ['doner'], 'izgara'),
  D('sufle', 'Çikolatalı sufle', 'tatli', 18, 190, 9, ['simit', 'tost'], 'tatli'),
  // 10 fine dining (tadım menüsü + birkaç dünya yemeği)
  D('tadim_menusu', 'Tadım menüsü', 'sef_masa', 20, 900, 10, ['doner', 'tost', 'simit'], 'tadim', [4, 6]),
  D('lufer_bugulama', 'Lüfer buğulama', 'sef_masa', 26, 380, 10, ['doner'], 'deniz'),
  D('katmer', 'Fıstıklı katmer', 'tatli', 16, 210, 10, ['simit', 'tost'], 'tatli'),
  D('risotto', 'Trüflü risotto', 'sef_masa', 22, 340, 10, ['tost', 'doner'], 'sef'),
  D('sushi', 'Somon sushi tabağı', 'sef_masa', 18, 360, 10, ['ayran', 'simit'], 'sef'),
  D('biftek', 'Dry-aged biftek', 'izgara2', 30, 480, 10, ['doner'], 'sef'),
];
export const DISH_BY_ID: Record<string, DishDef> = Object.fromEntries(DISHES.map(d => [d.id, d]));
export const isDish = (id: string): id is DishId => id in DISH_BY_ID;

/** o aşamada ve öncesinde açılmış yemekler */
export const acikYemekler = (stage: number): DishDef[] => DISHES.filter(d => d.asama <= stage);
/** tam o aşamada menüye giren yemekler (SALON.yeni ve açılış toast'ı bundan gelir) */
export const yeniYemekler = (stage: number): DishDef[] => DISHES.filter(d => d.asama === stage);
/** yemeğin ilk yapılı taşıyıcı ürünü (hiçbiri yapılı değilse null: yemek o an çıkmaz) */
export const tasiyiciOf = (d: DishDef, built: readonly ProductId[]): ProductId | null => d.tasiyici.find(p => built.includes(p)) ?? null;
/** birim maliyet payı: taşıyıcının MALIYET oranı, her satıştan düşer (stok yok) */
export const yemekMaliyet = (d: DishDef): number => MALIYET[d.tasiyici[0]];
/** yemeğin istasyonunun mutfakta durduğu aşama */
export const istasyonAsama = (d: DishDef): number => MUTFAK_ISTASYON.find(i => i.id === d.istasyon)?.stage ?? 99;

/** müşteri tipine göre yemek grubu tercihi (balayı tatlı, taraftar köfte, iş insanı balık/şef...) */
export const TIP_TERCIH: Record<string, Partial<Record<DishGrup, number>>> = {
  taraftar: { izgara: 3, icecek: 1.5 }, gecekusu: { izgara: 2, hamur: 1.5 },
  balayi: { tatli: 3, deniz: 1.6, sef: 1.6, tadim: 3 }, isinsani: { deniz: 2.5, sef: 3, izgara: 1.5, tadim: 3.5 }, plaza: { sef: 2, izgara: 1.6, tadim: 2.5 },
  teyze: { hamur: 2.5, kahvalti: 2.5, tatli: 1.5 }, emekli: { icecek: 2, kahvalti: 2 }, universiteli: { hamur: 1.6, izgara: 1.5 },
  kruvaziyer: { deniz: 1.8, meze: 1.6, tadim: 1.5 }, gezgin: { deniz: 1.5, meze: 1.5 }, turgrubu: { meze: 1.6, izgara: 1.4 },
};
/** yemeğin seçilme ağırlığı: tip tercihi x (siparişin ürünüyle aynı taşıyıcıysa x2.5) */
export const yemekAgirlik = (d: DishDef, typeId: string, birim: ProductId | null): number => (TIP_TERCIH[typeId]?.[d.grup] ?? 1) * (birim && d.tasiyici[0] === birim ? 2.5 : 1);

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
