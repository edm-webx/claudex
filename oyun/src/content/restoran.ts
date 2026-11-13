/**
 * Faz 2 restoran fazı + stantlar. Pure data (no sim, no three). Data-driven so a later online/MMO build can load the
 * same shapes from a JSON database (ids are stable strings, every number lives here).
 *
 * STANTLAR: stands in front of the büfe, bought with hard-earned money, visible in the world. A counter customer
 *   who just paid may grab one portion on the way out (impulse buy, `chance`). Stands hold stock; the player
 *   refills by standing at the stand (dwell), paying the ingredients up front. Empty stand = "BİTTİ" sign.
 * ADISYON: from the çay bahçesi stage on, part of the customers walk straight to a table, sit and order there.
 *   An adisyon (ticket) prints on the rail (HUD) and a numbered plate floats over the table. Carry the items to
 *   the table (dwell). Served -> they eat -> pay the bill on the table (+ speed tip). A garson on the team serves
 *   tickets from the counter stock by himself. Late tickets make the guests leave without paying.
 * Cherry on top: Günün Yemeği (one product is the chef's special each day: +15 % on tickets, a bit more demand),
 *   servis puanı (rolling 0..5 stars from ticket speed; good service brings more table guests), "hesap kavgası"
 *   (two friends fight over who pays: the winner tips double), and the bill line of each guest type.
 */
import type { ProductId } from '../game/sim/schema';

export interface StantDef {
  id: string; name: string; short: string; desc: string;
  stage: number;            // kiosk stage needed
  cost: number;             // ₺ to buy
  price: number;            // ₺ per portion
  maliyet: number;          // ingredient share of the price (paid at refill)
  stock: number;            // portions when full
  chance: number;           // impulse buy chance per paying counter customer
  hours?: [number, number]; // busy hours (chance ×1.6)
  look: 'midye' | 'islak' | 'kestane' | 'misir' | 'kokorec' | 'dondurma' | 'kumpir' | 'lahmacun' | 'tatli' | 'simit' | 'cigkofte' | 'pizza' | 'waffle';
  spot: number;             // index into STANT_SPOTS
  color: string;            // sign colour
}
/** false until the stand meshes / adisyon rail / zincir panel ship: the sim stays installed but dormant (ara önizleme). */
export const FAZ2_UI = true;
export const TUM_STANTLAR: StantDef[] = [
  { id: 'kestane', name: 'Kestane arabası', short: 'KESTANE', desc: 'Közde kestane, kağıt külahta. Soğuk akşamın en iyi arkadaşı.', stage: 2, cost: 9000, price: 60, maliyet: 0.35, stock: 20, chance: 0.18, hours: [15, 23], look: 'kestane', spot: 8, color: '#7b3f1d' },
  { id: 'midye', name: 'Midye tepsisi', short: 'MİDYE', desc: 'Limonlu dolma midye, porsiyonu 6 tane. Gece kuşları bayılır.', stage: 2, cost: 12000, price: 90, maliyet: 0.4, stock: 24, chance: 0.2, hours: [18, 24], look: 'midye', spot: 0, color: '#2b3a55' },
  { id: 'islak', name: 'Islak hamburger fanusu', short: 'ISLAK', desc: 'Buğulu camın içinde sarımsaklı soslu ıslak burgerler.', stage: 2, cost: 20000, price: 70, maliyet: 0.45, stock: 20, chance: 0.18, hours: [20, 24], look: 'islak', spot: 1, color: '#c0392b' },
  { id: 'misir', name: 'Mısır arabası', short: 'MISIR', desc: 'Haşlama ya da közde. Tuz bol, sohbet bedava.', stage: 2, cost: 20000, price: 60, maliyet: 0.35, stock: 20, chance: 0.14, hours: [12, 19], look: 'misir', spot: 7, color: '#d68910' },
  { id: 'kokorec', name: 'Kokoreç tezgahı', short: 'KOKOREÇ', desc: 'Kekik kokusu iki iskele öteden duyulur.', stage: 3, cost: 80000, price: 180, maliyet: 0.45, stock: 16, chance: 0.12, hours: [21, 24], look: 'kokorec', spot: 3, color: '#6e2c00' },
  { id: 'dondurma', name: 'Maraş dondurması dolabı', short: 'DONDURMA', desc: 'Usta külahı verir, geri alır, yine verir. Müşteri ağlar, sonra güler.', stage: 4, cost: 150000, price: 80, maliyet: 0.3, stock: 30, chance: 0.16, hours: [13, 20], look: 'dondurma', spot: 4, color: '#2874a6' },
  { id: 'kumpir', name: 'Kumpir standı', short: 'KUMPİR', desc: 'Patates ne kadar büyükse hayaller o kadar büyük.', stage: 4, cost: 220000, price: 220, maliyet: 0.4, stock: 14, chance: 0.1, hours: [17, 23], look: 'kumpir', spot: 5, color: '#7d3c98' },
  // survey 2026-10-24 (yeni yemekler): more stands, so the survey food list stands in the world, not just in a list
  { id: 'lahmacun', name: 'Lahmacun ve pide fırını', short: 'LAHMACUN', desc: 'Taş fırından çıtır lahmacun, kaşarlı pide. Limonu bol.', stage: 3, cost: 60000, price: 120, maliyet: 0.4, stock: 18, chance: 0.14, hours: [11, 22], look: 'lahmacun', spot: 7, color: '#a04000' },
  { id: 'cigkofte', name: 'Çiğ köfte tezgahı', short: 'ÇİĞ KÖFTE', desc: 'Etsiz, acılı, marullu dürüm. Nar ekşisi şart.', stage: 3, cost: 35000, price: 70, maliyet: 0.3, stock: 24, chance: 0.15, hours: [11, 23], look: 'cigkofte', spot: 8, color: '#1e8449' },
  { id: 'pizza', name: 'Dilim pizza vitrini', short: 'PİZZA', desc: 'Sucuklu, karışık, bol kaşarlı dilimler. Vapuru kaçıran öğrencinin dostu.', stage: 4, cost: 120000, price: 110, maliyet: 0.4, stock: 16, chance: 0.12, hours: [12, 24], look: 'pizza', spot: 9, color: '#cb4335' },
  { id: 'tatli', name: 'Baklava ve künefe vitrini', short: 'TATLI', desc: 'Fıstıklı baklava, sıcak künefe, yanında kaymak.', stage: 4, cost: 180000, price: 150, maliyet: 0.35, stock: 20, chance: 0.12, hours: [12, 23], look: 'tatli', spot: 10, color: '#7e5109' },
  { id: 'waffle', name: 'Waffle arabası', short: 'WAFFLE', desc: 'Çikolata, muz, renkli şeker. Ortaköy değil ama yakışır.', stage: 5, cost: 260000, price: 160, maliyet: 0.35, stock: 16, chance: 0.12, hours: [14, 24], look: 'waffle', spot: 11, color: '#d35400' },
];
/** 2026-10-25 user: only the chestnut and corn carts stay for now (the rest crowded the pier and block the road); the others come back later as stations INSIDE the restaurant. */
export const AKTIF_STANT: string[] = [];   // 2026-11-08 user: "kestane ve mısır arabasını komple kaldır"
export const STANTLAR: StantDef[] = TUM_STANTLAR.filter(d => AKTIF_STANT.includes(d.id));
/** Stand places in front of the büfe (stage >= 2 layout; x, z, rotY). Kept clear of the queue, door and window line. */
export const STANT_SPOTS: [number, number, number][] = [[2.15, -3.75, 0], [3.65, -3.75, 0], [-1.75, -3.75, 0], [5.35, -2.4, -Math.PI / 2], [-5.4, 4.0, Math.PI], [4.6, 4.0, Math.PI],
  // 2026-10-24 user: the simit stand in the middle of the pier (O8) looked out of place; the new stands line the pier edges
  [-3.9, 4.0, Math.PI], [6.9, 2.2, -Math.PI / 2], [6.9, -0.5, -Math.PI / 2], [-7.6, 4.0, Math.PI], [2.9, 4.0, Math.PI], [-9.4, 0.8, Math.PI / 2]];
/** Where the player stands to refill (in front of the stand). */
export const STANT_STAND_D = 0.85;

export const ADISYON = {
  fromStage: 3,
  /** share of new customers that come for table service, by kiosk stage (index stage-1) */
  share: [0, 0, 0.2, 0.3, 0.4, 0.45, 0.5, 0.55, 0.55, 0.6],   // 2026-11-09 user: seated customers must not cycle so fast the player gives up (calmer)
  orderDelay: 4,          // s after sitting before the ticket prints
  patience: 150,          // s for the whole ticket
  maxOpen: 3,             // open tickets at once
  eat: [22, 32] as [number, number],
  /** speed tip: share of the bill by the fraction of the ticket time used */
  tip: [[0.35, 0.18], [0.65, 0.1], [1, 0.04]] as [number, number][],
  garsonS: 6,             // s per delivery for a garson (per hired garson)
  special: 0.15,          // Günün Yemeği premium on tickets
  specialDemand: 1.6,     // weight of the special when a table orders
  fightChance: 0.12,      // hesap kavgası
  maxItems: 4,
};
export const ADISYON_LINES = {
  call: ['Bakar mısınız!', 'Garson bey!', 'Pardon, sipariş verebilir miyiz?', 'Usta, buraya!'],
  served: ['Ellerine sağlık!', 'Maşallah, sıcacık.', 'İşte bu!', 'Kokusu bile yetti.'],
  late: ['Biz gidiyoruz, afiyet olsun size.', 'Bu adisyon yazılırken emekli oldum.', 'Vapuru kaçırdık, sağ olun.'],
  fight: ['Bu sefer ben ödüyorum!', 'Olmaz abi, ayıp ediyorsun!', 'Kartı geri koy, kavga çıkacak!'],
  special: ['Günün yemeği neymiş?', 'Ustanın tavsiyesinden alayım.'],
};
/** Servis puanı (0..5): rolling average of ticket speed. Bonus share of table guests per star above 3. */
export const SERVIS = { start: 3, weight: 0.15, sharePerStar: 0.05 };

/** Products a table may order and how much each guest type likes sitting down (fallback weight 1). */
export const TABLE_MENU: ProductId[] = ['doner', 'cay', 'ayran', 'simit', 'tost', 'gazoz'];
