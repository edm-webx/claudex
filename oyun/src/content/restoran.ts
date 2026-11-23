/**
 * Faz 2 restoran fazı. Pure data (no sim, no three). Data-driven so a later online/MMO build can load the
 * same shapes from a JSON database (ids are stable strings, every number lives here).
 *
 * ADISYON: from the çay bahçesi stage on, part of the customers walk straight to a table, sit and order there.
 *   An adisyon (ticket) prints on the rail (HUD) and a numbered plate floats over the table. Carry the items to
 *   the table (dwell). Served -> they eat -> pay the bill (+ speed tip into the waiters' shared jar, BUF-10). With a garson on
 *   the team the waiter brings the menu, takes the order, carries the plates, brings the bill and wipes the table (BUF-09).
 *   Late tickets make the guests leave without paying.
 * Cherry on top: servis puanı (rolling 0..5 stars from ticket speed; good service brings more table guests),
 *   "hesap kavgası" (two friends fight over who pays: the winner tips double), and the bill line of each guest type.
 */

/** false until the stand meshes / adisyon rail / panel ship: the sim stays installed but dormant (ara önizleme). */
export const FAZ2_UI = true;
export const ADISYON = {
  fromStage: 3,
  /** share of new customers that come for table service, by kiosk stage (index stage-1) */
  // 2026-11-09 user: seated customers must not cycle so fast the player gives up (calmer). 2026-11-21 owner: "son seviyelere doğru
  // müşteriler sıra olmak yerine restorana girip sipariş vermeli": from the salons on (6+) most guests dine in, the büfe counter
  // stays the takeaway window (queue) for the rest. Bills are recalibrated in content/kanat.ts KANAT_FIYAT_X.
  share: [0, 0, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.86, 0.9],
  orderDelay: 4,          // s after sitting before the ticket prints
  patience: 150,          // s for the whole ticket
  maxOpen: 3,             // open tickets at once
  eat: [22, 32] as [number, number],
  /** speed tip: share of the bill by the fraction of the ticket time used */
  tip: [[0.35, 0.18], [0.65, 0.1], [1, 0.04]] as [number, number][],
  fightChance: 0.12,      // hesap kavgası
  maxItems: 4,
  // ── BUF-09 garson akışı (menü -> sipariş -> pass -> masa -> hesap -> sil; ışınlanma yok) ──
  /** s the guest reads the menu before the waiter may take the order */
  dusunS: [3, 5] as [number, number],
  /** s a seated guest waits for a waiter to take the order before leaving angry (the ticket has its own `patience`) */
  bekleSabirS: 100,
  /** s after the meal a guest waits for the bill; then the money is left on the table (no waiter came) */
  hesapBekleMaxS: 40,
  /** a claimed task (counted from the claim) older than this is released and the waiter goes idle (no deadlock) */
  isZamanAsimiS: 45,
  /** s the waiter spends at the table per step */
  adim: { menu: 1.3, siparis: 1.6, hesap: 1.6, tabak: 0.8, sil: 1.6 },
  /** waiter priority: hot plate from the pass > take order > menu > bill > wipe */
  oncelik: ['tabak', 'siparis', 'menu', 'hesap', 'sil'] as const,
  /** BUF-10: an idle waiter takes a neighbouring zone's task only after it waited this long unclaimed */
  yardimBekleS: 3,
  /** komşu olmayan bölgenin işi bu kadar sahipsiz bekleyince boştaki her garson yardım eder */
  yardimUzakS: 15,
  /** aşama 6+: garson başına karşılanmamış (oturmaya yürüyen / siparişi alınmamış) masa misafiri üst sınırı (restoran.ts wantMasa) */
  yeniMasaGarson: 1,
  /** test sentinel: a table action farther than this from the table counts as a teleport (stats.isinlanma) */
  isinlanmaM: 2.4,
};
export type GarsonTur = typeof ADISYON.oncelik[number];
/** act the waiter rig plays per step (BUF-11 swaps in take_order / bow) */
export const GARSON_ACT: Record<GarsonTur, string> = { menu: 'pour', siparis: 'pour', hesap: 'count', tabak: 'carry', sil: 'sweep' };
/** BUF-10 masa bölgeleri: tables closer than `bagM` form one cluster; zones within `komsuM` (nearest tables) are neighbours */
export const BOLGE = { bagM: 3.8, komsuM: 8 };
export const ADISYON_LINES = {
  call: ['Bakar mısınız!', 'Garson bey!', 'Pardon, sipariş verebilir miyiz?', 'Usta, buraya!'],
  served: ['Ellerine sağlık!', 'Maşallah, sıcacık.', 'İşte bu!', 'Kokusu bile yetti.'],
  late: ['Biz gidiyoruz, afiyet olsun size.', 'Bu adisyon yazılırken emekli oldum.', 'Vapuru kaçırdık, sağ olun.'],
  menu: ['Teşekkürler, bakalım...', 'Ne güzel menü!', 'Hmm, ne yesek?'],
  siparis: ['Buyurun, ne alırdınız?', 'Hemen not alıyorum.', 'Siparişiniz mutfağa gidiyor.'],
  hesap: ['Hesap tamam, eline sağlık!', 'Üstü kalsın!', 'Çok iyiydi.'],
  kendi: ['Hesabı masaya bıraktım.', 'Parayı masaya koyduk, sağ olun.'],
  fight: ['Bu sefer ben ödüyorum!', 'Olmaz abi, ayıp ediyorsun!', 'Kartı geri koy, kavga çıkacak!'],
};
/** Servis puanı (0..5): rolling average of ticket speed. Bonus share of table guests per star above 3. */
export const SERVIS = { start: 3, weight: 0.15, sharePerStar: 0.05 };
