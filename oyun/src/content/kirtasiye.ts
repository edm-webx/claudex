/** Martı Kırtasiye first-person counter mode (survey 2026-11-09): customers ask, you pick from the shelves, hand it over. */
export interface KtUrun { id: string; ad: string; ikon: string; fiyat: number }
export const KT_URUN: KtUrun[] = [
  { id: 'kalem', ad: 'Kurşun kalem', ikon: '✏️', fiyat: 15 }, { id: 'tukenmez', ad: 'Tükenmez', ikon: '🖊️', fiyat: 20 }, { id: 'silgi', ad: 'Silgi', ikon: '🧽', fiyat: 10 },
  { id: 'defter', ad: 'Defter', ikon: '📓', fiyat: 45 }, { id: 'cetvel', ad: 'Cetvel', ikon: '📏', fiyat: 18 }, { id: 'boya', ad: 'Boya kalemi', ikon: '🖍️', fiyat: 60 },
  { id: 'makas', ad: 'Makas', ikon: '✂️', fiyat: 35 }, { id: 'dosya', ad: 'Dosya', ikon: '📁', fiyat: 12 }, { id: 'yapistirici', ad: 'Yapıştırıcı', ikon: '🧴', fiyat: 25 },
  { id: 'fotokopi', ad: 'Fotokopi', ikon: '🖨️', fiyat: 5 }, { id: 'zarf', ad: 'Zarf', ikon: '✉️', fiyat: 8 }, { id: 'pergel', ad: 'Pergel', ikon: '📐', fiyat: 40 },
];
export const KT_BY_ID: Record<string, KtUrun> = Object.fromEntries(KT_URUN.map(u => [u.id, u]));
export const KT_MUSTERI = ['Öğrenci Elif', 'Emekli Hasan Bey', 'Ödev telaşlı Kerem', 'Öğretmen Nermin Hanım', 'Mimar Selin', 'Avukat Tarık', 'Minik Ayşe ve annesi', 'Muhtar Rıza'];
export const KT_SABIR = 28;   // s per customer
