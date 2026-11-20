/**
 * Faz 2 restoran fazı. Pure data (no sim, no three). Data-driven so a later online/MMO build can load the
 * same shapes from a JSON database (ids are stable strings, every number lives here).
 *
 * ADISYON: from the çay bahçesi stage on, part of the customers walk straight to a table, sit and order there.
 *   An adisyon (ticket) prints on the rail (HUD) and a numbered plate floats over the table. Carry the items to
 *   the table (dwell). Served -> they eat -> pay the bill on the table (+ speed tip). A garson on the team serves
 *   tickets from the counter by himself. Late tickets make the guests leave without paying.
 * Cherry on top: servis puanı (rolling 0..5 stars from ticket speed; good service brings more table guests),
 *   "hesap kavgası" (two friends fight over who pays: the winner tips double), and the bill line of each guest type.
 */

/** false until the stand meshes / adisyon rail / panel ship: the sim stays installed but dormant (ara önizleme). */
export const FAZ2_UI = true;
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
  fightChance: 0.12,      // hesap kavgası
  maxItems: 4,
};
export const ADISYON_LINES = {
  call: ['Bakar mısınız!', 'Garson bey!', 'Pardon, sipariş verebilir miyiz?', 'Usta, buraya!'],
  served: ['Ellerine sağlık!', 'Maşallah, sıcacık.', 'İşte bu!', 'Kokusu bile yetti.'],
  late: ['Biz gidiyoruz, afiyet olsun size.', 'Bu adisyon yazılırken emekli oldum.', 'Vapuru kaçırdık, sağ olun.'],
  fight: ['Bu sefer ben ödüyorum!', 'Olmaz abi, ayıp ediyorsun!', 'Kartı geri koy, kavga çıkacak!'],
};
/** Servis puanı (0..5): rolling average of ticket speed. Bonus share of table guests per star above 3. */
export const SERVIS = { start: 3, weight: 0.15, sharePerStar: 0.05 };
