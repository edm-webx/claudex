// Mutfak ses tablosu (BUF-08): hangi pişirme istasyonu cızırtı verir (w: ses ağırlığı) ve hangisi tava çarpması çıkarır.
// Kimse pişirmiyorsa istasyon listede olmaz (sim view().ist yalnız 'pisiyor' kayıtlarını verir), bu yüzden sessiz kalır.
export const SES_ISTASYON: Record<string, { w: number; tava?: boolean }> = {
  ocak: { w: 0.8, tava: true }, ocak2: { w: 0.8, tava: true },
  izgara: { w: 1 }, izgara2: { w: 1 }, doner: { w: 1 },
  fritoz: { w: 0.8 }, tas_firin: { w: 0.6 },
};
