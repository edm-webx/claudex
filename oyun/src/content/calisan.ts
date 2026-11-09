/**
 * Çalışanlar 2.0 content (survey calisan-1, calisan-3..6, animasyon-8, musteri-8 morale): Mahalle Kurs Merkezi courses,
 * worker events (doğum günü pastası, halı saha, çay molası köşesi, mevsimlik piknik, Ayın Elemanı), venues and roster
 * caps, Dinlenme Bankı, future special roles per venue, and the lines. Pure data, no imports of sim code.
 * All names invented. Player-facing text Turkish, no em-dashes.
 */

export interface KursDef { id: string; name: string; desc: string; /** play seconds away */ sure: number; /** base cost, x (rank+1) */ cost: number; xp: number; morale: number; minRank?: number; }
export const KURSLAR: KursDef[] = [
  { id: 'hafta', name: 'Hafta Sonu Kursu', desc: 'Kısa ve tatlı. Tepsi tutuşu, çay bardağı parlatma, "buyrun abla" tonlaması.', sure: 120, cost: 250, xp: 140, morale: 5 },
  { id: 'gulus', name: 'Güler Yüz Semineri', desc: 'Gülümseme kası çalıştırılır. Döner gelince keyfi tavan yapar.', sure: 90, cost: 300, xp: 40, morale: 40 },
  { id: 'usta', name: 'Ustalık Kursu', desc: 'Mahallenin en eski ustası Fevzi Hoca anlatır. Uzun ama değer.', sure: 300, cost: 600, xp: 420, morale: 10 },
  { id: 'kamp', name: 'Usta-Çırak Kampı', desc: 'Bir hafta sonu Martıköy Yaylası\'nda. Döndüğünde başka biri olur (yine aynı kişi ama).', sure: 600, cost: 1500, xp: 1300, morale: 20, minRank: 2 },
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

/** Venues for the roster (calisan-5/6). Only open ones take workers; later venues show their special role (calisan-1). */
export interface MekanDef { id: string; name: string; open: boolean; caps: number[]; role: { id: string; name: string; desc: string; line: string } | null; when: string; }
export const MEKANLAR: MekanDef[] = [
  { id: 'iskele', name: 'Martıköy İskelesi', open: true, caps: [6, 7, 8, 9, 10, 10], role: null, when: '' },
  { id: 'sahil', name: 'Sahil Büfesi', open: false, caps: [6, 8, 10], role: { id: 'balikekmek', name: 'Balık Ekmek Ustası', desc: 'Dalga sesine göre balık çevirir. Hiç yakmaz.', line: 'Balık taze, ekmek taze, ben taze!' }, when: 'Sahil Yolu açılınca' },
  { id: 'stadyum', name: 'Stadyum Kapısı', open: false, caps: [6, 8, 10], role: { id: 'anonsci', name: 'Stat Anonsçusu', desc: 'Megafonla "SICAK DÖNEEER" diye anons eder, kuyruk ikiye katlanır.', line: 'Sayın seyirciler! Tostlar sıcak!' }, when: 'Maç günleri gelince' },
  { id: 'gece', name: 'Gece Kokoreççisi', open: false, caps: [6, 8, 10], role: { id: 'bekci', name: 'Gece Bekçisi', desc: 'Düdüğüyle kapkaççıyı daha köşede kaçırır.', line: 'Düdük bende, uyku sende değil!' }, when: 'Gece pazarı büyüyünce' },
  { id: 'ada', name: 'Ada İskelesi', open: false, caps: [6, 8, 10], role: { id: 'kayikci', name: 'Kayıkçı', desc: 'Siparişleri kayıkla teknelere götürür, kürek çekerken türkü söyler.', line: 'Hamsi gibi süzülürüm abi.' }, when: 'Vapur Büfesi açılınca' },
  { id: 'ay', name: 'Ay İskelesi', open: false, caps: [6, 8, 10], role: { id: 'ayrehberi', name: 'Ay Rehberi', desc: 'Krater krater gezdirir, her turist bir ayran içer.', line: 'Solunuzda bir krater, sağınızda bir krater daha.' }, when: 'Çok ama çok sonra' },
];
export const BANK_CAP = 10;
export const BANK_NAME = 'Dinlenme Bankı';
export const BANK_LINES = ['Biraz soluklanayım abi.', 'Bank güzelmiş, martı manzaralı.', 'Çağırırsan koşarım.', 'Ayaklarımı uzattım, dünya umurumda değil.'];

/** Extra garson / temizlik slots per stage (index = stage-1): total roster per venue grows 6 -> 10. */
export const STAGE_EXTRA_SLOTS: { garson: number; temizlik: number }[] = [
  { garson: 2, temizlik: 1 }, { garson: 3, temizlik: 1 }, { garson: 3, temizlik: 2 }, { garson: 4, temizlik: 2 }, { garson: 5, temizlik: 2 }, { garson: 5, temizlik: 2 },
];

// ── etkinlikler (calisan-4) ──
export const PASTA = { cost: 150, morale: 20, others: 6, cycle: 28 };
export const PASTA_LINES = ['Pasta mı? Benim için mi? Ağlıyorum şu an.', 'Mumu üfledim, dileğim: hiç bitmeyen çay.', 'Kaç yaşına girdim söylemem, pasta kadar tatlıyım.'];
export const HALISAHA = { every: 7, morale: 10, futbolBonus: 8 };
export const HALISAHA_SONUC = [
  'Büfe FC 5, Berberler 4! Son dakika golü kafayla, top hâlâ aranıyor.',
  'Büfe FC 3, Fırın Spor 3. Penaltıda kaleci simit yerken gol oldu, kimse kızmadı.',
  'Büfe FC 2, Balıkçılar 7. Ama formalar çok yakıştı, ahlaki galibiyet bizim!',
  'Büfe FC 6, Kuyumcular 1. Kupa yerine bir tepsi baklava aldık.',
  'Maç martı yüzünden yarıda kaldı. Topu kaptı, Kadıköy\'e uçtu.',
];
export const CAY_KOSESI = { cost: 1200, every: 180, morale: 3 };
export const CAY_KOSESI_LINES = ['Bir çay molası, bir dünya keyif.', 'Semaver fokurduyor, ben de fokurduyorum.', 'Beş dakika abi, sonra dünyayı devirim.'];
export const PIKNIK = { cost: 800, morale: 15 };
export const MEVSIMLER: Record<string, { name: string; piknik: string }> = {
  ilkbahar: { name: 'İlkbahar', piknik: 'Erguvanların altında köfte, top, uçurtma. Garson Nazlı uçurtmayı ağaca taktı.' },
  yaz: { name: 'Yaz', piknik: 'Koyda karpuz, deniz, kum. Biri kum kalesine büfe yaptı, müşteri bile geldi.' },
  sonbahar: { name: 'Sonbahar', piknik: 'Korulukta kestane ve çay. Yapraklarla yaprak savaşı, herkes kazandı.' },
  kis: { name: 'Kış', piknik: 'Karda salep ve kardan adam. Kardan adama önlük giydirdik, adı Sabrişko.' },
};
export const AYIN_ELEMANI = { every: 7, morale: 10, bonus: 200 };
export const AYIN_ELEMANI_LINES = ['Ayın Elemanı mı? Annemi arayayım!', 'Bu fotoğrafta çok yakışıklı çıkmışım, değil mi?', 'Teşekkür ederim, önce Allah sonra tepsim.'];
export const AYIN_NOTE = 'Martıköy\'de bir ay yedi gün sürer, kimse sorgulamaz.';

// ── huy hareketleri (animasyon-8): speech lines the view may pop with the motion ──
export const HUY_LINES: Record<string, string[]> = {
  uykucu: ['Hıh! Uyumuyordum.', 'Ne? Buradayım!'],
  geveze: ['Abla dinle bak, ne oldu biliyor musun...', 'Sonra adam dedi ki...', 'Yok yok, daha bitmedi!'],
  martici: ['Evet evet, anladım.', 'Ne diyorsun? Simit mi?', 'Haklısın kanka.'],
  usta: ['Hop!', 'Dürüm havada, ustalık yerde!', 'Seyret!'],
  aceleci: ['Pardon! Ben iyiyim!', 'Kimse görmedi değil mi?', 'Hızlıyım ama ayaklar yetişmiyor.'],
};
