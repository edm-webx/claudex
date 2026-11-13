/**
 * Faz 2 dükkan zinciri: new shops the player can open once the iskele büfesi is big (Lokanta), one after another.
 * Pure data, shaped like a future online database row (MMO vision): every shop type has a stable id, a default
 * name the owner can change, and a catalogue the owner picks the menu from. The save keeps only the owner's choices
 * (name, menu, level, opened day), so a server can later own the same records per player.
 * Income: only while playing, paid at the end of each game day (no offline income, ekonomi2.ts).
 * All names are invented parodies (no real brand).
 */
export interface MenuItemDef { id: string; name: string; price: number }
export interface DukkanDef {
  id: string; tur: string; ad: string; desc: string; slogan: string;
  cost: number; gunluk: number;              // net ₺ per game day at level 1 with one menu item
  menuBonus: number;                         // + share per extra menu item
  maxMenu: number; katalog: MenuItemDef[];
  req: { stage: number; prev?: string };
  color: string; icon: string;
  map: [number, number];                     // pin on the small Martıköy map (0..100)
}
export const ZINCIR_SCHEMA = 1;
export const DUKKAN_AD_MAX = 22;
export const DUKKANLAR: DukkanDef[] = [
  { id: 'sosisci', tur: 'Sosisçi', ad: 'Sosis Çalısı', desc: 'Sade bir sosisçi. Ekmek, sosis, hardal; gerisi lüks.', slogan: 'Sosis var, dert yok.',
    cost: 350000, gunluk: 1200, menuBonus: 0.08, maxMenu: 4, req: { stage: 4 }, color: '#c0392b', icon: '🌭', map: [22, 62],
    katalog: [{ id: 'sosis_ekmek', name: 'Sosis ekmek', price: 90 }, { id: 'sucuk_ekmek', name: 'Sucuk ekmek', price: 130 }, { id: 'patso', name: 'Patso', price: 110 }, { id: 'ayran', name: 'Ayran', price: 25 }, { id: 'turşu_suyu', name: 'Turşu suyu', price: 30 }] },
  { id: 'tavukpilav', tur: 'Tavuk pilavcı', ad: 'Nohutlu Nuri', desc: 'Camekanlı arabada tereyağlı pilav, üstüne didilmiş tavuk.', slogan: 'Pilavın da gönlün de tok olsun.',
    cost: 800000, gunluk: 2600, menuBonus: 0.08, maxMenu: 4, req: { stage: 4, prev: 'sosisci' }, color: '#d68910', icon: '🍗', map: [40, 30],
    katalog: [{ id: 'tavuk_pilav', name: 'Tavuklu pilav', price: 120 }, { id: 'nohut_pilav', name: 'Nohutlu pilav', price: 90 }, { id: 'duble', name: 'Duble pilav', price: 170 }, { id: 'ayran', name: 'Ayran', price: 25 }, { id: 'salgam', name: 'Şalgam', price: 30 }] },
  { id: 'kofteci', tur: 'Köfteci', ad: 'Köfteci Yunus', desc: 'Izgara köfte, piyaz, közlenmiş biber. Duman mahalleye yayılır.', slogan: 'Köfte bizden, ayran sizden. Şaka, o da bizden.',
    cost: 1800000, gunluk: 5500, menuBonus: 0.08, maxMenu: 5, req: { stage: 4, prev: 'tavukpilav' }, color: '#6e2c00', icon: '🧆', map: [62, 66],
    katalog: [{ id: 'kofte_porsiyon', name: 'Porsiyon köfte', price: 260 }, { id: 'kofte_ekmek', name: 'Köfte ekmek', price: 170 }, { id: 'piyaz', name: 'Piyaz', price: 90 }, { id: 'corba', name: 'Mercimek çorbası', price: 80 }, { id: 'irmik', name: 'İrmik helvası', price: 70 }, { id: 'ayran', name: 'Ayran', price: 25 }] },
  { id: 'birburger', tur: 'Burgerci', ad: 'Birburger', desc: 'Tek tip burger, tek tip kutu, sınırsız özgüven.', slogan: 'Bir yersin, bir daha yersin.',
    cost: 4000000, gunluk: 11000, menuBonus: 0.07, maxMenu: 5, req: { stage: 5, prev: 'kofteci' }, color: '#1f618d', icon: '🍔', map: [78, 38],
    katalog: [{ id: 'birburger', name: 'Birburger', price: 240 }, { id: 'cift_bir', name: 'Çift Bir', price: 330 }, { id: 'tavuk_bir', name: 'Tavuk Bir', price: 220 }, { id: 'patates', name: 'Patates', price: 90 }, { id: 'kolaz', name: 'Kolaz', price: 50 }, { id: 'sufle', name: 'Sufle', price: 120 }] },
  { id: 'mcdonado', tur: 'Hızlı yemek zinciri', ad: 'McDonado', desc: 'Kırmızı-sarı, çok hızlı, palyaçosu hep gülüyor. Neden gülüyor, kimse bilmiyor.', slogan: 'Hızlı ye, hızlı düşün, hızlı unut.',
    cost: 9000000, gunluk: 24000, menuBonus: 0.06, maxMenu: 6, req: { stage: 5, prev: 'birburger' }, color: '#b7950b', icon: '🍟', map: [50, 82],
    katalog: [{ id: 'buyuk_mado', name: 'Büyük Mado', price: 290 }, { id: 'nugget', name: 'Tavuk Taneleri', price: 180 }, { id: 'patates_b', name: 'Büyük patates', price: 110 }, { id: 'milkshake', name: 'Milkshake', price: 120 }, { id: 'elmali_turta', name: 'Elmalı turta', price: 80 }, { id: 'cocuk_menu', name: 'Mutlu Kutu', price: 230 }, { id: 'kolaz', name: 'Kolaz', price: 50 }] },
];
