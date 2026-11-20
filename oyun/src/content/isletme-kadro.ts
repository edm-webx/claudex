/**
 * DKN-03: roles of the far-shore businesses (kafe, bistro, kırtasiye, kantin, lokanta, kafeterya). Their staff lives in
 * Plot.kadro (NOT in S.workers: the büfe crew has its own ROLES/ROLE_SLOTS and must never mix with these).
 * `huyRol` borrows the personality pool of a büfe role; `gorunum` is the uniform (a ROLE_LOOK key of the character view).
 */
import { ISCI_SAAT_UCRET, type IsletmeId } from './esya';

export interface IsletmeRol { rol: string; ad: string; huyRol: string; gorunum: string; minLv: number }
export const ISLETME_ROL: Record<IsletmeId, IsletmeRol[]> = {
  kafe: [{ rol: 'barista', ad: 'Barista', huyRol: 'cay', gorunum: 'barista', minLv: 1 }, { rol: 'garson', ad: 'Garson', huyRol: 'garson', gorunum: 'garson', minLv: 1 }, { rol: 'kasiyer', ad: 'Kasiyer', huyRol: 'kasiyer', gorunum: 'kasiyer', minLv: 1 }],
  bistro: [{ rol: 'barista', ad: 'Barista', huyRol: 'cay', gorunum: 'barista', minLv: 1 }, { rol: 'garson', ad: 'Garson', huyRol: 'garson', gorunum: 'garson', minLv: 1 }, { rol: 'asci', ad: 'Aşçı', huyRol: 'asci', gorunum: 'asci', minLv: 1 }],
  kirtasiye: [{ rol: 'tezgahci', ad: 'Tezgâhtar', huyRol: 'kasiyer', gorunum: 'kasiyer', minLv: 1 }, { rol: 'fotokopici', ad: 'Fotokopici', huyRol: 'komi', gorunum: 'komi', minLv: 2 }],
  kantin: [{ rol: 'kantinci', ad: 'Kantinci', huyRol: 'tost', gorunum: 'tost', minLv: 1 }, { rol: 'garson', ad: 'Garson', huyRol: 'garson', gorunum: 'garson', minLv: 1 }],
  lokanta: [{ rol: 'asci', ad: 'Aşçı', huyRol: 'asci', gorunum: 'asci', minLv: 1 }, { rol: 'garson', ad: 'Garson', huyRol: 'garson', gorunum: 'garson', minLv: 1 }, { rol: 'kasiyer', ad: 'Kasiyer', huyRol: 'kasiyer', gorunum: 'kasiyer', minLv: 1 }],
  kafeterya: [{ rol: 'kantinci', ad: 'Kantinci', huyRol: 'tost', gorunum: 'tost', minLv: 1 }, { rol: 'garson', ad: 'Garson', huyRol: 'garson', gorunum: 'garson', minLv: 1 }],
  // 2026-11-20 AVM shops: a sales consultant fetches the goods, the cashier rings them up
  giyim: [{ rol: 'danisman', ad: 'Satış danışmanı', huyRol: 'garson', gorunum: 'hostes', minLv: 1 }, { rol: 'kasiyer', ad: 'Kasiyer', huyRol: 'kasiyer', gorunum: 'kasiyer', minLv: 1 }, { rol: 'vitrinci', ad: 'Vitrin sorumlusu', huyRol: 'komi', gorunum: 'gorevli', minLv: 3 }],
  elektronik: [{ rol: 'danisman', ad: 'Satış danışmanı', huyRol: 'garson', gorunum: 'hostes', minLv: 1 }, { rol: 'kasiyer', ad: 'Kasiyer', huyRol: 'kasiyer', gorunum: 'kasiyer', minLv: 1 }, { rol: 'teknisyen', ad: 'Teknisyen', huyRol: 'komi', gorunum: 'gorevli', minLv: 2 }],
  oyuncak: [{ rol: 'danisman', ad: 'Satış danışmanı', huyRol: 'garson', gorunum: 'tost', minLv: 1 }, { rol: 'kasiyer', ad: 'Kasiyer', huyRol: 'kasiyer', gorunum: 'kasiyer', minLv: 1 }],
};
/** wage is paid once at day end: same total as the old hourly cut (24 game hours) */
export const ISCI_GUN_UCRET = ISCI_SAAT_UCRET * 24;
export const ILAN_YENILE_UCRET = 2000;
