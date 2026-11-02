/**
 * Kıyafet marketi (survey 2026-10-24, Faz 2). Pure data.
 * - Parody chains only: every name is an invented sound-alike of a real high-street label, never the label itself
 *   ("telif yemeyecek isimler"). The test in tests/content/kiyafet.test.ts blocks exact real names.
 * - Price: Altın Simit (gold). Survey: "çoğu Altın Simit, küçük bonus". No real-money price here; that comes with the
 *   store phase (Faz 7). Items are cosmetic only.
 * - Slots: ust (top), alt (bottom), ayakkabi, aksesuar, sapka, kostum (full costume).
 */
export type KiyafetSlot = 'ust' | 'alt' | 'ayakkabi' | 'aksesuar' | 'sapka' | 'kostum';
export interface KiyafetZincir { id: string; name: string; tagline: string }
export interface KiyafetUrun { id: string; zincir: string; name: string; slot: KiyafetSlot; gold: number; colors: string[] }

export const KIYAFET_ZINCIRLER: KiyafetZincir[] = [
  { id: 'lo_ci', name: 'Lo Ci Vaikiki', tagline: 'Her gün çarşamba, her yer vaikiki' },
  { id: 'kotyon', name: 'Kotyon', tagline: 'Pamuk gibi yumuşak, Kotyon gibi sağlam' },
  { id: 'zarra', name: 'Zarra', tagline: 'Vitrinde gördüğün gibi, dolapta da' },
  { id: 'manggo', name: 'Manggo', tagline: 'Gençlerin kombin dükkanı' },
  { id: 'defakto', name: 'Defakto', tagline: 'Yakın zamanın en yakın fiyatı' },
  { id: 'bozkurt_spor', name: 'Bozkurt Spor', tagline: 'Halı sahadan vapura' },
];

export const KIYAFET_URUNLER: KiyafetUrun[] = [
  { id: 'lc_gomlek_mavi', zincir: 'lo_ci', name: 'Lacivert kareli gömlek', slot: 'ust', gold: 6, colors: ['#3b6fb6', '#f2f2f2'] },
  { id: 'lc_pantolon_kot', zincir: 'lo_ci', name: 'Kot pantolon', slot: 'alt', gold: 8, colors: ['#2e4a7a', '#4a6fa5'] },
  { id: 'kt_tisort_ay', zincir: 'kotyon', name: 'Ay baskılı tişört', slot: 'ust', gold: 4, colors: ['#ffffff', '#f2b632', '#e0533c'] },
  { id: 'kt_sort', zincir: 'kotyon', name: 'Yazlık şort', slot: 'alt', gold: 4, colors: ['#c9b59a', '#6fbde2'] },
  { id: 'zr_ceket', zincir: 'zarra', name: 'Kısa deri ceket', slot: 'ust', gold: 12, colors: ['#3a2a22', '#8a5a3c'] },
  { id: 'zr_etek', zincir: 'zarra', name: 'Pileli etek', slot: 'alt', gold: 7, colors: ['#9b1c3a', '#2b2b33'] },
  { id: 'mg_hoodie', zincir: 'manggo', name: 'Kapüşonlu sweat', slot: 'ust', gold: 9, colors: ['#7d6bb0', '#3fb5b0', '#2b2b33'] },
  { id: 'mg_jogger', zincir: 'manggo', name: 'Jogger', slot: 'alt', gold: 6, colors: ['#4a4a55', '#c9b59a'] },
  { id: 'df_kazak', zincir: 'defakto', name: 'Örgü kazak', slot: 'ust', gold: 5, colors: ['#f0d35a', '#b8d8ba', '#e8c0a0'] },
  { id: 'df_kot_pastel', zincir: 'defakto', name: 'Pastel kot', slot: 'alt', gold: 5, colors: ['#b8d8ba', '#f2a2b3'] },
  { id: 'bs_forma', zincir: 'bozkurt_spor', name: 'Spor forması', slot: 'kostum', gold: 14, colors: ['#e0533c', '#ffffff'] },
  { id: 'bs_esofman', zincir: 'bozkurt_spor', name: 'Eşofman takımı', slot: 'alt', gold: 8, colors: ['#2b2b33', '#f2b632'] },
  { id: 'bs_kosu_ayakkabi', zincir: 'bozkurt_spor', name: 'Koşu ayakkabısı', slot: 'ayakkabi', gold: 7, colors: ['#ffffff', '#3b6fb6'] },
  { id: 'kostum_palyaco', zincir: 'lo_ci', name: 'Palyaço kostümü', slot: 'kostum', gold: 16, colors: ['#e0533c', '#f0d35a'] },
  { id: 'kostum_korsan', zincir: 'zarra', name: 'Korsan kostümü', slot: 'kostum', gold: 16, colors: ['#3a2a22', '#f2f2f2'] },
  { id: 'kostum_takim', zincir: 'zarra', name: 'Takım elbise', slot: 'kostum', gold: 20, colors: ['#2b2b33', '#3b3b4a'] },
  { id: 'aks_gunes_gozlugu', zincir: 'defakto', name: 'Güneş gözlüğü', slot: 'aksesuar', gold: 3, colors: ['#2b2b33', '#c9a24a'] },
  { id: 'aks_kasket', zincir: 'manggo', name: 'Kasket', slot: 'sapka', gold: 4, colors: ['#e0533c', '#2b2b33', '#3fb5b0'] },
  { id: 'aks_kapakli_sapka', zincir: 'bozkurt_spor', name: 'Bucket şapka', slot: 'sapka', gold: 4, colors: ['#c9b59a', '#8a7a6a'] },
];

export const kiyafetUrunleri = (zincirId?: string): KiyafetUrun[] => KIYAFET_URUNLER.filter(u => !zincirId || u.zincir === zincirId);
export const kiyafetZincir = (id: string): KiyafetZincir | undefined => KIYAFET_ZINCIRLER.find(z => z.id === id);
