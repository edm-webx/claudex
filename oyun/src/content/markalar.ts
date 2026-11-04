/**
 * Uydurma markalar, maskotlar, Anlaşma Masası ve iskele reklamları (survey marka-1..7). Pure data.
 * - Style (marka-1): witty but believable; the top tier (Ay) gets absurd.
 * - 40 brands at launch (marka-2) over the marka-3 categories. All invented, never a real trademark or sound-alike.
 * - Anlaşma Masası (marka-5): one brand per DEAL category; a signed brand adds `pct` of the sale value on sales of the
 *   category's products (sim/yiyecek.ts, kasa top-up) and its name goes on the kiosk's small brand sign.
 * - Brand-loyal customers (marka-6): some ask for a brand of a LOYAL category; if it is your signed brand they tip a
 *   little more, otherwise they take another one (no penalty, just no extra).
 * - In-world ads (marka-7): ferry side ads, weekly pier poster, a gull flock pulling a banner (view/world/reklam.ts).
 * Brand colours follow koleksiyon.ts CAP_BRANDS where the brand exists there.
 */
import type { ProductId } from '../game/sim/schema';

export type MarkaKat = 'gazoz' | 'cay' | 'ayran' | 'su' | 'kahve' | 'firin' | 'et' | 'atistirmalik' | 'dukkan' | 'uygulama' | 'arac' | 'medya';
export const KAT_NAMES: Record<MarkaKat, string> = {
  gazoz: 'Gazoz ve soda', cay: 'Çay', ayran: 'Ayran ve şalgam', su: 'Su', kahve: 'Kahve', firin: 'Fırın ve börek', et: 'Et ve tavuk',
  atistirmalik: 'Atıştırmalık', dukkan: 'Dükkan ve zincir', uygulama: 'Uygulama', arac: 'Araç ve vapur hattı', medya: 'Medya',
};

export interface MaskotDef { id: string; name: string; desc: string; kind: 'balon' | 'inek' | 'damla' | 'nar' | 'kurye' | 'robot'; color: string; }
export const MASKOTLAR: MaskotDef[] = [
  { id: 'fis', name: 'Fıs', desc: 'Kolaz\'ın zıp zıp gazoz balonu. Şişe açılınca ilk o fırlar.', kind: 'balon', color: '#c0392b' },
  { id: 'sutlu_nuri', name: 'Sütlü Nuri', desc: 'Ayranbey\'in bıyıklı ineği. Bıyığı aslında ayran köpüğü.', kind: 'inek', color: '#ecf3f6' },
  { id: 'damlacik', name: 'Damlacık', desc: 'Martı Su\'yun damla şeklindeki martısı. Uçarken şıpır şıpır ses çıkarır.', kind: 'damla', color: '#6fbde2' },
  { id: 'nare', name: 'Nare', desc: 'Narçiçek\'in nar taneli kızı. Saçları tane tane, kalbi ekşi tatlı.', kind: 'nar', color: '#9b1c3a' },
  { id: 'vizir', name: 'Vızır', desc: 'PaketMartı\'nın kasklı kurye martısı. Trafikte bile vızır vızır.', kind: 'kurye', color: '#ffd23f' },
  { id: 'burgatron', name: 'Burgatron', desc: 'Plaza Burger Holding\'in robot burgeri. Bip bip, menü büyütelim mi?', kind: 'robot', color: '#8a8f96' },
];

export interface MarkaDef {
  id: string; name: string; kat: MarkaKat; color: string; ink: string; slogan: string;
  /** Anlaşma Masası bonus on the category's sales (fraction) */
  pct?: number;
  maskot?: string;
  /** shown on the weekly pier poster rotation / ferry ads */
  ad?: boolean;
}

export const MARKALAR: MarkaDef[] = [
  // gazoz ve soda
  { id: 'kolaz', name: 'Kolaz', kat: 'gazoz', color: '#c0392b', ink: '#ffffff', slogan: 'Aç bir Kolaz, Fıs zıplasın!', pct: 0.03, maskot: 'fis', ad: true },
  { id: 'bogaz_gazozu', name: 'Boğaz Gazozu', kat: 'gazoz', color: '#27ae60', ink: '#ffffff', slogan: 'Kapağı pıss, yaz geldi!', pct: 0.03, ad: true },
  { id: 'lodos_soda', name: 'Lodos Soda', kat: 'gazoz', color: '#3d6fa8', ink: '#ffffff', slogan: 'Mideye lodos gibi eser.', pct: 0.03, ad: true },
  { id: 'buzdagi', name: 'Buzdağı Limonata', kat: 'gazoz', color: '#f4e04d', ink: '#33373b', slogan: 'Bir yudum, buzdağının tepesi!', pct: 0.04 },
  // çay
  { id: 'demlikhan', name: 'Demlikhan Çay', kat: 'cay', color: '#a0401c', ink: '#ffffff', slogan: 'Tavşan kanı, iki katlı keyif.', pct: 0.03, ad: true },
  { id: 'rize_bulutu', name: 'Yayla Bulutu Çay', kat: 'cay', color: '#3f8f5a', ink: '#ffffff', slogan: 'Buluttan toplanmış gibi taze.', pct: 0.04 },
  { id: 'ince_bel', name: 'İncebel Çay', kat: 'cay', color: '#c96f3b', ink: '#ffffff', slogan: 'Bardağı ince, sohbeti uzun.', pct: 0.04 },
  // ayran ve şalgam
  { id: 'ayranbey', name: 'Ayranbey', kat: 'ayran', color: '#ecf3f6', ink: '#2f7fb3', slogan: 'Sütlü Nuri onaylı köpük!', pct: 0.03, maskot: 'sutlu_nuri', ad: true },
  { id: 'salgamzade', name: 'Şalgamzade', kat: 'ayran', color: '#6c2a5a', ink: '#ffffff', slogan: 'Mor ama mutlu.', pct: 0.03, ad: true },
  { id: 'yayik_yildizi', name: 'Yayık Yıldızı', kat: 'ayran', color: '#f7f7f2', ink: '#3b2a20', slogan: 'Yayıkta dövülmüş, yıldız gibi parlar.', pct: 0.04 },
  { id: 'ay_bozasi', name: 'Ay Bozası', kat: 'ayran', color: '#e8d9a8', ink: '#4a2f22', slogan: 'Kış akşamının tatlı ekşisi.', pct: 0.04 },
  // su
  { id: 'marti_su', name: 'Martı Su', kat: 'su', color: '#6fbde2', ink: '#ffffff', slogan: 'Damlacık\'tan selam, şıpır şıpır!', pct: 0.02, maskot: 'damlacik', ad: true },
  { id: 'kaynakca', name: 'Kaynakça Su', kat: 'su', color: '#9fd8e8', ink: '#1d4f6e', slogan: 'Dağdan indi, iskeleye geldi.', pct: 0.02 },
  // kahve
  { id: 'vapurcu_kahve', name: 'Vapurcu Kahve', kat: 'kahve', color: '#4a2f22', ink: '#f6bd3a', slogan: 'Köpüğü kaçırmayan kaptanların kahvesi.', pct: 0.03, ad: true },
  { id: 'kopuk_kulesi', name: 'Köpük Kulesi', kat: 'kahve', color: '#f29e4c', ink: '#ffffff', slogan: 'Bardak uzun, köpük kule!', pct: 0.04 },
  { id: 'cezve_dede', name: 'Cezve Dede', kat: 'kahve', color: '#7a4b2e', ink: '#fff3c4', slogan: 'Kırk yıllık hatır, bir fincanda.', pct: 0.04 },
  // fırın ve börek
  { id: 'altin_firin', name: 'Altın Fırın', kat: 'firin', color: '#e8b23a', ink: '#3b2a20', slogan: 'Sabah yedide sıcak, yedi buçukta efsane.', pct: 0.03, ad: true },
  { id: 'gevrek_express', name: 'Gevrek Express', kat: 'firin', color: '#b5733a', ink: '#ffffff', slogan: 'Simit hızında teslimat!', pct: 0.04 },
  { id: 'dede_usulu', name: 'Dede Usulü Börek', kat: 'firin', color: '#d97a3a', ink: '#ffffff', slogan: 'Kat kat sevgi, bir de peynir.', pct: 0.04 },
  // et ve tavuk
  { id: 'tavuk_tekeli', name: 'Tavuk Tekeli A.Ş.', kat: 'et', color: '#f2c14e', ink: '#3b2a20', slogan: 'Tavuğun tekeli bizde, keyfi sizde.', pct: 0.04 },
  { id: 'uc_kardes', name: 'Üç Kardeş Kokoreç', kat: 'et', color: '#8a3324', ink: '#ffffff', slogan: 'Üç kardeş, bir kekik, sonsuz gece.', pct: 0.03, ad: true },
  { id: 'koz_ustasi', name: 'Köz Ustası Köfte', kat: 'et', color: '#5b3a2a', ink: '#ffd23f', slogan: 'Küçük köfte, büyük özgüven.', pct: 0.04 },
  // atıştırmalık
  { id: 'citir_marti', name: 'Çıtır Martı Cips', kat: 'atistirmalik', color: '#ffd23f', ink: '#c0392b', slogan: 'Martılar bile paylaşmıyor.' },
  { id: 'kraker_kaptan', name: 'Kaptan Kraker', kat: 'atistirmalik', color: '#1d5fa8', ink: '#ffffff', slogan: 'Tuzlu, çıtır, rotası belli.' },
  { id: 'cikolata_lodos', name: 'Poyraz Çikolata', kat: 'atistirmalik', color: '#5a3a2a', ink: '#f6bd3a', slogan: 'Ağızda poyraz gibi erir.' },
  { id: 'leblebici_hasan', name: 'Leblebiz', kat: 'atistirmalik', color: '#e8d9a8', ink: '#5a3a2a', slogan: 'Tek leblebi olmaz, avuç avuç!' },
  // dükkan ve zincir
  { id: 'plaza_burger', name: 'Plaza Burger Holding', kat: 'dukkan', color: '#8a8f96', ink: '#ffffff', slogan: 'Bip bip! Menü büyütelim mi?', maskot: 'burgatron', ad: true },
  { id: 'koseci_market', name: 'Köşeci Market', kat: 'dukkan', color: '#2e8b57', ink: '#ffffff', slogan: 'Her köşede bir Köşeci.' },
  { id: 'kalemtras', name: 'Kalemtraş Kırtasiye', kat: 'dukkan', color: '#7d6bb0', ink: '#ffffff', slogan: 'Sınav haftasının sırdaşı.' },
  // uygulamalar
  { id: 'paketmarti', name: 'PaketMartı', kat: 'uygulama', color: '#ffd23f', ink: '#3b2a20', slogan: 'Vızır vızır kapında!', maskot: 'vizir', ad: true },
  { id: 'martikart', name: 'Martıkart', kat: 'uygulama', color: '#2f7fb3', ink: '#ffffff', slogan: 'Bas geç, vapura yetiş.' },
  { id: 'uclu_paket', name: 'Uçan Paket', kat: 'uygulama', color: '#e0533c', ink: '#ffffff', slogan: 'Paketin kanatlı, kuryen güleryüzlü.' },
  // araç ve vapur hattı
  { id: 'pedalcan', name: 'Pedalcan Bisiklet', kat: 'arac', color: '#3fb5b0', ink: '#ffffff', slogan: 'Zili çalışır, freni de çoğu zaman.' },
  { id: 'vin_motor', name: 'Vınvın Motor', kat: 'arac', color: '#e0533c', ink: '#ffffff', slogan: 'Vın vın, yokuşa meydan okur.' },
  { id: 'martikoy_hatti', name: 'Martıköy Vapur Hattı', kat: 'arac', color: '#1d5fa8', ink: '#ffffff', slogan: 'Düdüğü kalın, çayı demli.', ad: true },
  // medya
  { id: 'gunaydin_postasi', name: 'Günaydın Postası', kat: 'medya', color: '#fbfaf6', ink: '#c0392b', slogan: 'Haberin en sabahçısı.', pct: 0.02 },
  { id: 'bogaz_haber', name: 'Boğaz Haber', kat: 'medya', color: '#14243d', ink: '#ffffff', slogan: 'İki yakanın haberi, tek kanalda.', pct: 0.02 },
  { id: 'spor_marti', name: 'Spor Martı', kat: 'medya', color: '#27ae60', ink: '#ffffff', slogan: 'Gol sesi iskeleden duyulur.', pct: 0.02 },
  { id: 'iskele_fm', name: 'İskele FM', kat: 'medya', color: '#c94f6d', ink: '#ffffff', slogan: 'Vapur düdüğü eşliğinde en güzel şarkılar.', pct: 0.02, ad: true },
  // Ay (marka-1: en üst kademede absürt), later
  { id: 'kraterkola', name: 'Kraterkola', kat: 'gazoz', color: '#3b2f6b', ink: '#ffe9a0', slogan: 'Kabarcıklar aşağı akar, sen yukarı uçarsın.' },
];
export const MARKA_BY_ID: Record<string, MarkaDef> = Object.fromEntries(MARKALAR.map(m => [m.id, m]));

/** Anlaşma Masası categories and the station products each one boosts ('*' = every sale). */
export const DEAL_KATS: { kat: MarkaKat; products: ProductId[] | '*' }[] = [
  { kat: 'gazoz', products: ['gazoz'] },
  { kat: 'cay', products: ['cay'] },
  { kat: 'ayran', products: ['ayran'] },
  { kat: 'kahve', products: ['cay'] },
  { kat: 'firin', products: ['simit'] },
  { kat: 'et', products: ['doner', 'tost'] },
  { kat: 'su', products: '*' },
  { kat: 'medya', products: '*' },
];
/** brands of a deal category (the Ay brand waits for the Moon) */
export const dealBrands = (kat: MarkaKat): MarkaDef[] => MARKALAR.filter(m => m.kat === kat && m.pct != null && m.id !== 'kraterkola');
/** Anlaşma Masası opens at this player level (Menü panel is there from level 2). */
export const DEAL_LEVEL = 3;
export const DEAL_TOAST = '{b} ile anlaştın! Tabelada adı var, satışlara küçük bonus.';

/** Brand-loyal customers (marka-6): chance per queue customer that orders a product of these categories. */
export const LOYAL_CHANCE = 1 / 7;
export const LOYAL_KATS: { kat: MarkaKat; product: ProductId }[] = [{ kat: 'gazoz', product: 'gazoz' }, { kat: 'cay', product: 'cay' }, { kat: 'ayran', product: 'ayran' }];
export const LOYAL_TIP = 0.08;
export const LOYAL_ASK = ['{b} var mı? Ben hep {b} içerim.', 'Bana {b} olsun, başkası olmaz!', '{b} varsa ondan, yoksa da olur.'];
export const LOYAL_YES = ['Oh, {b}! Sen beni anlıyorsun.', '{b} ha! Bahşiş de benden.', 'İşte bu, {b}!'];
export const LOYAL_NO = ['{b} yokmuş, olsun, bu da olur.', 'Peki, başka marka olsun. Bir dahakine {b}!', 'Tamam usta, idare ederiz.'];

/** Weekly pier poster rotation and ferry side ads (brand ids with `ad`). */
export const AD_BRANDS = MARKALAR.filter(m => m.ad).map(m => m.id);
/** Gull flock banner lines (marka-7). */
export const PANKART = ['KOLAZ: FIS ZIPLASIN!', 'AYRANBEY: KÖPÜK BIYIK!', 'İSKELE FM 99.9', 'PAKETMARTI: VIZIR VIZIR', 'MARTI SU: ŞIPIR ŞIPIR', 'ALTIN FIRIN: SICAK SICAK'];
