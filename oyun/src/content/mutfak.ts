import { RANKS, rankOf } from './ranks';
/**
 * Büfe mutfağı (2026-11-09 survey: "büfe zamanla yavaşça otel restoran mutfağına dönüşsün, kapalı mutfak, sadece pass
 * penceresi, 15+ istasyon, esnaf tarzından çeliğe"). A room behind the kiosk's covered walkway (content/ic-mekan.ts
 * 'mutfak'); stations unlock with the büfe stage, kitchen staff are hired through the normal staff board.
 */
/**
 * islev (BUF-05): 'pisir' bir pişirme istasyonu; 'pass' servis rafı (Maraş dondurması da pasoda kepçelenir); 'sef' şef pasosu
 * (fine dining finişi, her aşçı kullanır: uzmanlık yok); 'bulasik' BUF-13'ün; 'gorsel' yalnız görünen model (soğuk oda: malzeme/stok YOK).
 */
export type IstasyonIslev = 'pisir' | 'pass' | 'sef' | 'bulasik' | 'gorsel';
export interface IstasyonDef { id: string; ad: string; stage: number; islev: IstasyonIslev }
export const MUTFAK_ISTASYON: IstasyonDef[] = [
  { id: 'pass', ad: 'Pass (servis tezgahı)', stage: 3, islev: 'pass' }, { id: 'ocak', ad: 'Ocak (tencere yemekleri)', stage: 3, islev: 'pisir' }, { id: 'cay_bar', ad: 'Çay ve kahve barı', stage: 3, islev: 'pisir' },
  // 2026-11-22 (sahibi: "bütün restoran kafelerde büfe gibi dolaptan kola, soda, gazoz verilsin"): soğuk içecek dolabı, şişe dolaptan çıkar
  { id: 'icecek_dolap', ad: 'İçecek dolabı (Kolaz, soda, gazoz)', stage: 3, islev: 'pisir' },
  { id: 'izgara', ad: 'Izgara', stage: 4, islev: 'pisir' }, { id: 'fritoz', ad: 'Fritöz', stage: 4, islev: 'pisir' },
  { id: 'bulasik', ad: 'Bulaşık', stage: 5, islev: 'bulasik' }, { id: 'soguk_oda', ad: 'Soğuk oda', stage: 5, islev: 'gorsel' },
  { id: 'doner', ad: 'Döner', stage: 6, islev: 'pisir' }, { id: 'salata', ad: 'Salata', stage: 6, islev: 'pisir' },
  { id: 'meze', ad: 'Soğuk meze', stage: 7, islev: 'pisir' }, { id: 'tatli', ad: 'Tatlı, pasta', stage: 7, islev: 'pisir' },
  { id: 'tas_firin', ad: 'Taş fırın, tandır', stage: 8, islev: 'pisir' },
  { id: 'ocak2', ad: 'İkinci ocak hattı', stage: 9, islev: 'pisir' }, { id: 'izgara2', ad: 'İkinci ızgara hattı', stage: 9, islev: 'pisir' },
  { id: 'sef_masa', ad: 'Şef pasosu', stage: 10, islev: 'sef' },
];
export const MUTFAK_IST_BY_ID: Record<string, IstasyonDef> = Object.fromEntries(MUTFAK_ISTASYON.map(i => [i.id, i]));
/** bir aşçının başında tabak hazırlayabildiği istasyon mu (bulaşık ve soğuk oda asla) */
export const pisirIstasyonu = (id: string): boolean => { const i = MUTFAK_IST_BY_ID[id]; return !!i && (i.islev === 'pisir' || i.islev === 'pass' || i.islev === 'sef'); };
/** aynı işi yapan hatlar: birincisi ana hat, ikincisi yoğun saatte (iki ve fazla aşçı varken) devreye girer */
export const HAT: Record<string, string[]> = { ocak: ['ocak', 'ocak2'], izgara: ['izgara', 'izgara2'] };
const HAT_OF: Record<string, string> = Object.fromEntries(Object.entries(HAT).flatMap(([h, l]) => l.map(i => [i, h])));
/** tezgâh ürünleri masa biletinde mutfakta pişerse hangi istasyonda (yemekler kendi DishDef.istasyon'unu kullanır) */
export const URUN_ISTASYON: Record<string, string> = { doner: 'doner', cay: 'cay_bar', ayran: 'cay_bar', gazoz: 'icecek_dolap', simit: 'tas_firin', tost: 'izgara' };
/** tezgâh ürününün mutfakta hazırlanma süresi (sn); yemekler DishDef.hazirlik */
export const PISIRME_S: Record<string, number> = { doner: 5, tost: 5, simit: 3.5, cay: 3.5, ayran: 3, gazoz: 1.5 };
/** istenen istasyon o aşamada yoksa ocak (aşama 3'te her şey ocakta pişer, mutfak büyüdükçe kendi istasyonuna taşınır) */
export function calismaIstasyonuOf(ist: string, stage: number): string {
  const esya = mutfakEsya(stage);
  if (pisirIstasyonu(ist) && esya.includes(ist)) return ist;
  const h = HAT_OF[ist]; if (h && esya.includes(HAT[h][0])) return HAT[h][0];   // ikinci hat yoksa ana hat
  return 'ocak';
}
/** istasyonun hattındaki, o aşamada duran üyeler (ana hat önce); hat dışı istasyon için yalnız kendisi */
export function hatUyeleri(ist: string, stage: number): string[] {
  const h = HAT_OF[ist]; if (!h) return [ist];
  const esya = mutfakEsya(stage); return HAT[h].filter(i => esya.includes(i));
}
/**
 * Bulaşık akışı (BUF-13): silinen masadan kirli tabak bulaşık istasyonuna yığılır (en çok max); bulaşıkçı tek tek yıkar (washS sn / hız).
 * Bulaşıkçı yokken yığın soft'u geçince masa silme (garson, temizlikçi) yavaşlar, hard'da en çok 1 + wipeX kat: ceza hafif, yıkım yok.
 * Aşama 5 öncesi (bulaşık istasyonu yok) yığın da ceza da yok.
 */
export const BULASIK = { max: 40, soft: 8, hard: 24, washS: 1.6, wipeX: 1.0, gorunur: 20 } as const;
export const bulasikCeza = (n: number): number => 1 + BULASIK.wipeX * Math.min(1, Math.max(0, (n - BULASIK.soft) / (BULASIK.hard - BULASIK.soft)));
/** yığının büyüklüğü hijyen/zemin için: mutfağın günlük kir artışı (bir meşgul işçi, sn başına) */
export const MUTFAK_KIR_HIZ = 0.0012;
/** mutfak pass rafı kapasitesi (tabak) */
export const PASS_KAP = 8;
export const MUTFAK_MIN_STAGE = 3;
/** stations standing at a büfe stage */
export const mutfakEsya = (stage: number): string[] => (stage < MUTFAK_MIN_STAGE ? [] : MUTFAK_ISTASYON.filter(i => i.stage <= stage).map(i => i.id));
/** "esnaf" look until stage 6, stainless steel from 7 */
export const mutfakCelik = (stage: number) => stage >= 7;

/** Kitchen staff roles (ROLES in content/ranks.ts carry `mutfak: true`): label, hire price base, slots by büfe stage */
export interface MutfakRol { id: string; label: string; base: number; stage: number; slots: number[]; etki: string; /** works out front (salon/pier), not in the kitchen */ on?: boolean }
const S = (...a: number[]) => a;   // slots for stages 1..10
export const MUTFAK_ROL: MutfakRol[] = [
  { id: 'asci', label: 'Aşçı', base: 2600, stage: 3, slots: S(0, 0, 1, 1, 2, 2, 3, 3, 4, 5), etki: 'Siparişleri istasyonunda pişirir; bir istasyonu devredebilirsin' },
  { id: 'komi', label: 'Komi', base: 1700, stage: 4, slots: S(0, 0, 0, 1, 1, 2, 2, 3, 3, 4), etki: 'Hazır tabağı istasyondan pass rafına taşır, aşçı pişirmeye devam eder' },
  { id: 'bulasikci', label: 'Bulaşıkçı', base: 1500, stage: 5, slots: S(0, 0, 0, 0, 1, 1, 1, 2, 2, 2), etki: 'Kirli tabakları yıkar; o yokken tabak yığılır ve masa hazırlığı yavaşlar' },
  { id: 'kasiyer', label: 'Kasiyer', base: 2300, stage: 3, slots: S(0, 0, 1, 1, 1, 2, 2, 2, 3, 3), etki: 'Kasada durur, müşteri kasaya gelip öder: seviyesi kasa sırasını hızlandırır, bahşiş artar', on: true },
  { id: 'sef', label: 'Şef', base: 7000, stage: 7, slots: S(0, 0, 0, 0, 0, 0, 1, 1, 1, 2), etki: 'Tüm mutfağı hızlandırır' },
  // survey 2026-11-09: front-of-house roles
  { id: 'guvenlik', label: 'Güvenlik', base: 2400, stage: 4, slots: S(0, 0, 0, 1, 1, 1, 1, 2, 2, 2), etki: 'Kapıda kuyruğu düzenler: maç günü ve büyük grupta sabır daha yavaş tükenir', on: true },
  { id: 'muzisyen', label: 'Müzisyen', base: 2000, stage: 4, slots: S(0, 0, 0, 1, 1, 1, 1, 1, 2, 2), etki: 'Canlı müzik çalar: yakın masada yemek uzar, sabır az düşer', on: true },
  { id: 'hostes', label: 'Hostes', base: 2200, stage: 5, slots: S(0, 0, 0, 0, 1, 1, 1, 2, 2, 2), etki: 'Kapıda karşılar, kalabalık günde masa gösterir', on: true },
  { id: 'barista', label: 'Barista', base: 2500, stage: 5, slots: S(0, 0, 0, 0, 1, 1, 1, 1, 2, 2), etki: 'Çay ve içecek siparişlerini çay barında ve içecek dolabında kendisi yapar, aşçılar içeceğe bakmaz' },
  { id: 'mudur', label: 'Müdür', base: 9000, stage: 6, slots: S(0, 0, 0, 0, 0, 1, 1, 1, 1, 1), etki: 'Sen büfeden uzaktayken boş istasyonları işletir, kasayı toplar (yavaş)', on: true },
  { id: 'vale', label: 'Vale', base: 1800, stage: 8, slots: S(0, 0, 0, 0, 0, 0, 0, 1, 1, 2), etki: 'Arabalı müşterinin anahtarını alır, arabayı park eder', on: true },
  // BUF-15 paket servis (aşama 5+): kurye pass'tan paketi alıp bisikletle adrese götürür, dönüşte geliri kasaya getirir
  { id: 'kurye', label: 'Kurye', base: 2100, stage: 5, slots: S(0, 0, 0, 0, 1, 1, 1, 2, 2, 2), etki: 'Telefon siparişlerini bisikletle adrese götürür, dönünce geliri getirir', on: true },
];
export const MUTFAK_ROL_BY_ID: Record<string, MutfakRol> = Object.fromEntries(MUTFAK_ROL.map(r => [r.id, r]));
export const mutfakSlot = (rol: string, stage: number): number => { const r = MUTFAK_ROL_BY_ID[rol]; return r && stage >= r.stage ? r.slots[Math.max(0, Math.min(9, stage - 1))] : 0; };

/** What the hired kitchen staff do (rank multiplier x per level): faster stations, bigger tips */
export function mutfakEtki(workers: { role: string; xp?: number }[]): { hiz: number; bahsis: number } {
  let hiz = 0, bahsis = 0;
  for (const w of workers) {
    const k = RANKS[rankOf(w.xp || 0)].x;
    if (w.role === 'asci') hiz += 0.05 * k; else if (w.role === 'komi') hiz += 0.025 * k; /* bulaşıkçı ve barista sahte hız vermez: BUF-13'te gerçek işleri var */   // şef burada YOK: sefHizi (BUF-05, çifte sayım bitti)
    else if (w.role === 'kasiyer') bahsis += 0.06 * k;
    else if (w.role === 'hostes') bahsis += 0.04 * k; else if (w.role === 'muzisyen' || w.role === 'vale') bahsis += 0.03 * k;
    else if (w.role === 'mudur') { hiz += 0.03 * k; bahsis += 0.02 * k; }
  }
  return { hiz: Math.min(0.6, hiz), bahsis: Math.min(0.5, bahsis) };
}

/**
 * Şefin mutfak hızı (BUF-05): TEK yer. Her şef 0.20 x rütbe çarpanı, toplam en çok 0.60. Yalnız mutfak pişirme süresine girer
 * (mutfakEtki'de şef yok); personel panelinde "+%N mutfak hızı" olarak görünür.
 */
export function sefHizi(workers: { role: string; xp?: number }[]): number {
  let h = 0; for (const w of workers) if (w.role === 'sef') h += 0.20 * RANKS[rankOf(w.xp || 0)].x;
  return Math.min(0.6, Math.round(h * 1000) / 1000);
}
/** bir tabağın gerçek pişirme süresi (sn): hazırlık / (1 + 0.12 x aşçı rütbesi + şef hızı). Bekle-al: yanma ve kalite yok. */
export const pisirmeSuresi = (hazirlik: number, rank: number, workers: { role: string; xp?: number }[]): number => hazirlik / (1 + 0.12 * rank + sefHizi(workers));
