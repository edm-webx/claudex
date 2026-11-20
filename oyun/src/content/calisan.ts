/**
 * Çalışanlar content (survey calisan-1, calisan-3, calisan-6): Mahalle Kurs Merkezi courses, roster caps per stage,
 * the waiting list lines, and the huy (personality) lines. Pure data, no imports of sim code.
 * BUF-02: moral (Keyif), dinlenme bankı, etkinlikler (pasta, halı saha, çay köşesi, piknik, Ayın Elemanı) and the
 * Mekanlar list are removed. All names invented. Player-facing text Turkish, no em-dashes.
 */

export interface KursDef { id: string; name: string; desc: string; /** play seconds away */ sure: number; /** base cost, x (rank+1) */ cost: number; xp: number; minRank?: number; }
export const KURSLAR: KursDef[] = [
  { id: 'hafta', name: 'Hafta Sonu Kursu', desc: 'Kısa ve tatlı. Tepsi tutuşu, çay bardağı parlatma, "buyrun abla" tonlaması.', sure: 120, cost: 250, xp: 140 },
  { id: 'gulus', name: 'Güler Yüz Semineri', desc: 'Gülümseme kası çalıştırılır. Müşteri de gülümser.', sure: 90, cost: 300, xp: 40 },
  { id: 'usta', name: 'Ustalık Kursu', desc: 'Mahallenin en eski ustası Fevzi Hoca anlatır. Uzun ama değer.', sure: 300, cost: 600, xp: 420 },
  { id: 'kamp', name: 'Usta-Çırak Kampı', desc: 'Bir hafta sonu Martıköy Yaylası\'nda. Döndüğünde başka biri olur (yine aynı kişi ama).', sure: 600, cost: 1500, xp: 1300, minRank: 2 },
];
export const KURS_MERKEZI = 'Mahalle Kurs Merkezi';
export const KURS_SLOTS = 2;
export const KURS_GIDIS = [
  'Abi kursa gidiyorum, bana çay ayırın!',
  'Defterimi aldım, kalemimi aldım, simidimi aldım. Hazırım!',
  'Döndüğümde beni tanımayacaksın usta.',
  'Fevzi Hoca\'ya selamını iletirim.',
];
export const KURS_DONUS = [
  'Geldim! Sertifikam bile var, çerçeveletirim.',
  'Hocam "sende iş var" dedi. Ben de biliyordum ama olsun.',
  'Kursta tepsiyi tek parmakla taşımayı öğrendim. Denemeyeceğim tabii.',
  'Özledim burayı. Martılar beni tanıdı mı?',
];

/** Extra garson / temizlik slots per stage (index = stage-1): total roster per venue grows 6 -> 10. */
export const STAGE_EXTRA_SLOTS: { garson: number; temizlik: number }[] = [
  { garson: 2, temizlik: 1 }, { garson: 3, temizlik: 1 }, { garson: 3, temizlik: 2 }, { garson: 4, temizlik: 2 }, { garson: 5, temizlik: 2 }, { garson: 5, temizlik: 2 },
];

// ── huy hareketleri (animasyon-8): speech lines the view may pop with the motion ──
export const HUY_LINES: Record<string, string[]> = {
  uykucu: ['Hıh! Uyumuyordum.', 'Ne? Buradayım!'],
  geveze: ['Abla dinle bak, ne oldu biliyor musun...', 'Sonra adam dedi ki...', 'Yok yok, daha bitmedi!'],
  martici: ['Evet evet, anladım.', 'Ne diyorsun? Simit mi?', 'Haklısın kanka.'],
  usta: ['Hop!', 'Dürüm havada, ustalık yerde!', 'Seyret!'],
  aceleci: ['Pardon! Ben iyiyim!', 'Kimse görmedi değil mi?', 'Hızlıyım ama ayaklar yetişmiyor.'],
};
