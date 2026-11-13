/** Martı AVM (survey 2026-11-09): shopping, not food. Clothes/cosmetics are kept for the character creator; cinema/fun give XP. */
export interface AvmUrun { id: string; ad: string; ikon: string; kat: 'giyim' | 'kozmetik' | 'sinema' | 'eglence'; fiyat: number; xp: number; desc: string }
export const AVM_URUN: AvmUrun[] = [
  { id: 'gomlek_keten', ad: 'Keten gömlek', ikon: '👔', kat: 'giyim', fiyat: 4500, xp: 4, desc: 'Yazlık, Boğaz esintisine birebir.' },
  { id: 'esofman_mart', ad: 'Martıspor eşofman', ikon: '🩳', kat: 'giyim', fiyat: 3800, xp: 4, desc: 'Halı saha sonrası klasiği.' },
  { id: 'deri_ceket', ad: 'Deri ceket', ikon: '🧥', kat: 'giyim', fiyat: 12500, xp: 8, desc: 'Vapurda rüzgârda havalı dur.' },
  { id: 'sapka_kasket', ad: 'Kasket', ikon: '🧢', kat: 'giyim', fiyat: 1900, xp: 2, desc: 'Eski İstanbul havası.' },
  { id: 'spor_ayakkabi', ad: 'Spor ayakkabı', ikon: '👟', kat: 'giyim', fiyat: 6200, xp: 5, desc: 'İskeleden stada koşarken.' },
  { id: 'parfum_lodos', ad: 'Lodos parfüm', ikon: '🧴', kat: 'kozmetik', fiyat: 5400, xp: 4, desc: 'Deniz tuzu ve simit notası.' },
  { id: 'sakal_bakim', ad: 'Sakal bakım seti', ikon: '🪒', kat: 'kozmetik', fiyat: 2600, xp: 3, desc: 'Usta şef sakalı için.' },
  { id: 'sac_jole', ad: 'Saç şekillendirici', ikon: '💈', kat: 'kozmetik', fiyat: 1400, xp: 2, desc: 'Fırtınada bile bozulmaz.' },
  { id: 'film_martilar', ad: 'Sinema: Martıların Dönüşü', ikon: '🎬', kat: 'sinema', fiyat: 900, xp: 12, desc: 'Gişe rekortmeni simit soygunu filmi.' },
  { id: 'film_doner', ad: 'Sinema: Döner Ustası 3', ikon: '🍿', kat: 'sinema', fiyat: 900, xp: 12, desc: 'Bıçak sesinden ağlatan dram.' },
  { id: 'bowling', ad: 'Bowling', ikon: '🎳', kat: 'eglence', fiyat: 1200, xp: 8, desc: 'Bir oyun, bir ayran.' },
  { id: 'atari', ad: 'Atari salonu', ikon: '🕹️', kat: 'eglence', fiyat: 600, xp: 5, desc: 'Eski usul jeton.' },
];
/** what an AVM clothing item sets on the character (kulis Dolap: "Giy") */
export const AVM_GIY: Record<string, Record<string, string>> = {
  gomlek_keten: { ustStil: 'shirt', ust: '#e9dcc0' }, esofman_mart: { ustStil: 'hoodie', ust: '#2f6f9a', altStil: 'pants', alt: '#2f6f9a' },
  deri_ceket: { ustStil: 'jacket', ust: '#2b2b33' }, sapka_kasket: { sapka: 'kasket', sapkaRenk: '#7d5638' }, spor_ayakkabi: { ayakkabi: '#fbf9f4' },
};
export const AVM_BY_ID: Record<string, AvmUrun> = Object.fromEntries(AVM_URUN.map(u => [u.id, u]));
