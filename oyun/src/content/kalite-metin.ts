/** GRS-17: Ayarlar > Görüntü kalitesi altındaki açıklama satırı (her kademe neyi değiştirir). Yalnız metin. */
export const KALITE_METIN: Readonly<Record<'akici' | 'dengeli' | 'sahane', string>> = {
  akici: 'Gölge ve parıltı kapalı, kalabalık az, en akıcı.',
  dengeli: 'Gölge, parıltı ve gökyüzü yansıması açık.',
  sahane: 'Daha keskin çizim, yüksek çözünürlüklü gölge, kalabalık ve parçacık en çok.',
};
export function kaliteSatiri(setting: string, nowLabel: string | null, neden = ''): string {
  if (setting === 'auto' || setting === 'otomatik') return nowLabel ? 'Şu an: ' + nowLabel + (neden ? ' (' + neden + ')' : '') : 'Otomatik, cihazına göre ayarlar.';
  return KALITE_METIN[setting as keyof typeof KALITE_METIN] ?? '';
}
