/** Products, tiers, sets, stations (v2 data.js, numbers kept). Owner: Builder A. Pure data. */
import type { ProductId } from '../game/sim/schema';
import type { ProductDef, SetDef, StationDef } from './types';
import { TIER_PRICE_X, TIER_COST_F } from './ekonomi2';

export const PRODUCT_IDS: readonly ProductId[] = ['doner', 'cay', 'ayran', 'simit', 'tost', 'gazoz'];
export const PRODUCTS: Record<ProductId, ProductDef> = {
  doner: { id: 'doner', name: 'Döner dürüm', short: 'Döner', base: 160, prep: 1.6, ritual: 'cut', station: 'doner', icon: 'doner', h: 0.2,
    tiers: [
      { name: 'Tavuk dürüm', desc: 'Lavaş, tavuk döner, domates, turşu' },
      { name: 'Et dürüm', desc: 'Yaprak et, sumaklı soğan, domates, maydanoz' },
      { name: 'Sabri Special', desc: 'Et döner, eritilmiş kaşar, közlenmiş biber, çift lavaş' },
      { name: 'Ay Dürümü', desc: 'Havada süzülür, etrafında sumak halkası döner' }] },
  cay: { id: 'cay', name: 'Çay', short: 'Çay', base: 20, prep: 1.2, ritual: 'pour', station: 'cay', icon: 'cay', h: 0.19,
    tiers: [
      { name: 'Ocak çayı', desc: 'İnce belli bardak, 2 kesme şeker' },
      { name: 'Demlik çayı', desc: 'Çift demlik, tavşan kanı, cam altlık' },
      { name: 'Semaver çayı', desc: 'Bakır semaver, çini altlık, yanında lokum' },
      { name: 'Altın Bardak', desc: 'Altın varaklı bardak, buharı martı gibi kanat çırpar' }] },
  ayran: { id: 'ayran', name: 'Ayran', short: 'Ayran', base: 25, prep: 0.9, ritual: 'pour', station: 'ayran', icon: 'ayran', h: 0.17,
    tiers: [
      { name: 'Ayranbey kapalı bardak', desc: 'Buz gibi, kapağı folyolu' },
      { name: 'Açık ayran', desc: 'Cam bardakta, köpüklü' },
      { name: 'Yayık ayranı', desc: 'Bakır tasta bol köpük' },
      { name: 'Sıfır Yerçekimi Ayranı', desc: 'Köpüğü bardağın üstünde bulut gibi asılı' }] },
  simit: { id: 'simit', name: 'Simit', short: 'Simit', base: 15, prep: 0.8, ritual: 'stack', station: 'simit', icon: 'simit', h: 0.06,
    tiers: [
      { name: 'Susamlı simit', desc: 'Pekmezli suya batırılmış, bol susamlı' },
      { name: 'Peynirli simit', desc: 'Sıcak simit ve beyaz peynir' },
      { name: 'Simit tabağı', desc: 'Kaşar, domates, zeytin, haşlanmış yumurta' },
      { name: 'Halka Simit Gezegeni', desc: 'Satürn gibi halkalı, susamlar uydu gibi döner' }] },
  tost: { id: 'tost', name: 'Kaşarlı-sucuklu tost', short: 'Tost', base: 110, prep: 2.0, ritual: 'press', station: 'tost', icon: 'tost', h: 0.08,
    tiers: [
      { name: 'Kaşarlı-sucuklu tost', desc: 'Tost ekmeğinde kaşar ve sucuk' },
      { name: 'Vapur tostu', desc: 'İnce, tereyağında çıtır, bol kaşar' },
      { name: 'Dolu tost', desc: 'Kaşar, sucuk, salam, turşu, domates, sos' },
      { name: 'Lav Tost', desc: 'Kaşarı bir metre uzar, Sabri ip gibi sarar' }] },
  gazoz: { id: 'gazoz', name: 'Gazoz', short: 'Gazoz', base: 40, prep: 0.6, ritual: 'fizz', station: 'gazoz', icon: 'gazoz', h: 0.22,
    tiers: [
      { name: 'Boğaz Gazozu', desc: 'Cam şişe, kapağı pıss diye açılır' },
      { name: 'Buzlu Kolaz', desc: 'Buzlu kutu' },
      { name: 'Limonlu Boğaz Gazozu', desc: 'Bardakta buzlu, limon dilimli' },
      { name: 'Kolaz Uzay', desc: 'Kabarcıkları aşağı akar, şişe kendi etrafında döner' }] }
} as Record<ProductId, ProductDef>;
/** Kademe names (survey yiyecek-7). */
export const TIER_NAMES = ['Seyyar', 'Esnaf', 'Usta', 'Efsane'] as const;
export const TIER_X = TIER_PRICE_X;   // Faz 2: small premium per kademe (was 1/2/4/10)
/** tier upgrade cost (K1->K2, K2->K3, K3->K4): base price x factor. */
export const TIER_COST_X = TIER_COST_F;
export const price = (product: ProductId, tier: number): number => { const p = PRODUCTS[product]; return p ? p.base * TIER_X[Math.max(0, Math.min(3, (tier || 1) - 1))] : 0; };
export const tierCost = (product: ProductId, toTier: number): number => { const p = PRODUCTS[product]; if (!p || toTier < 2 || toTier > 4) return 0; return p.base * TIER_COST_X[toTier - 1]; };

export const SETS: SetDef[] = [
  { id: 'doner_ayran', items: ['doner', 'ayran'], x: 1.1, name: 'Döner + ayran' },
  { id: 'cay_simit', items: ['cay', 'simit'], x: 1.08, name: 'Simit + çay ikilisi' },
  { id: 'tost_cay', items: ['tost', 'cay'], x: 1.08, name: 'Vapur kahvaltısı' },
  { id: 'tost_gazoz', items: ['tost', 'gazoz'], x: 1.08, name: 'Gece tostu' },
  // survey tarif-2 combos: Vapur Menüsü (hızlı paket), Öğrenci Menüsü (ucuz ve doyurucu)
  { id: 'vapur_menu', items: ['doner', 'gazoz'], x: 1.085, name: 'Vapur Menüsü' },
  { id: 'ogrenci_menu', items: ['simit', 'ayran'], x: 1.08, name: 'Öğrenci Menüsü' }
];
export const STATIONS: Record<ProductId, StationDef & { grab: boolean }> = {
  doner: { id: 'doner', name: 'Döner şişi', product: 'doner', role: 'doner', act: 'cut', grab: false },
  cay: { id: 'cay', name: 'Çay ocağı', product: 'cay', role: 'cay', act: 'pour', grab: false },
  ayran: { id: 'ayran', name: 'Ayran dolabı', product: 'ayran', role: null, act: 'pour', grab: true },
  simit: { id: 'simit', name: 'Simit tablası', product: 'simit', role: null, act: 'idle', grab: true },
  tost: { id: 'tost', name: 'Tost makinesi', product: 'tost', role: 'tost', act: 'cut', grab: false },
  gazoz: { id: 'gazoz', name: 'Gazoz dolabı', product: 'gazoz', role: null, act: 'idle', grab: true }
} as Record<ProductId, StationDef & { grab: boolean }>;
