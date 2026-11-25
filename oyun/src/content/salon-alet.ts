/**
 * Salon aletlerinin gerçek işi (2026-11-25, sahibi: "hepsini aldım ama nerde oldu bu güncelleme, anlaşılmıyor" ve "dönerin önüne gidip
 * kesiyor, eline döner geliyor; mutfakta böyle etkileşimler yok"). Saf veri. `yemek`: oyuncu aletin önünde durunca bu yemekler eline
 * gelir (büfedeki gibi) ve alet alınmışsa aşçılar da bu yemekleri HIZ oranında çabuk hazırlar. `yemek` boşsa alet ortam / misafir aletidir.
 */
export interface SalonAlet { yemek: string[]; act: 'cut' | 'pour'; is: string }
export const ALET_HIZ = 0.7;
export const SALON_ALET: Record<string, SalonAlet> = {
  semaver_dev: { yemek: ['cay', 'demlik_cay'], act: 'pour', is: 'Çay doldur' },
  tas_firin: { yemek: ['simit', 'lahmacun'], act: 'cut', is: 'Fırından çıkar' },
  gozleme: { yemek: ['gozleme'], act: 'cut', is: 'Gözleme aç' },
  bal_kaymak: { yemek: ['serpme_kahvalti'], act: 'cut', is: 'Serpme tabağı kur' },
  sarkuteri: { yemek: ['meze_tabagi', 'serpme_kahvalti'], act: 'cut', is: 'Peynir tabağı kes' },
  buz_tezgah: { yemek: ['midye_dolma', 'ahtapot_salata'], act: 'cut', is: 'Deniz tabağı hazırla' },
  mangal_e: { yemek: ['levrek'], act: 'cut', is: 'Balık pişir' },
  meze_dolap: { yemek: ['yaprak_sarma', 'meze_tabagi'], act: 'cut', is: 'Meze tabakla' },
  akvaryum_e: { yemek: [], act: 'cut', is: 'Misafir önünde oyalanır' },
  piyano_s: { yemek: [], act: 'cut', is: 'Akşam canlı müzik' },
};
/** alınmış bir alet bu yemeği hızlandırıyor mu */
export const aletHiz = (yemek: string, sahip: readonly string[] | undefined): number => ((sahip || []).some(e => SALON_ALET[e]?.yemek.includes(yemek)) ? ALET_HIZ : 1);
