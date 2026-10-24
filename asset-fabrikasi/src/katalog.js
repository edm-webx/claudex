/**
 * Katalog: her asset tek satır. Oyunda kullanım:
 *   import { kit, rng } from './kit.js'; import { uret } from './katalog.js';
 *   const k = kit(); const model = uret(k, 'otobus', { hat: '25T' }, 42); scene.add(model);
 * Yeni asset eklemek: ilgili dosyaya üretici yaz, buraya bir satır ekle.
 */
import { rng, olc } from './kit.js';
import * as KR from './karakter.js';
import * as AR from './arac.js';
import * as BI from './bina.js';
import * as DE from './dekor.js';
import * as YE from './yemek.js';
import * as DO from './doga.js';

export const KATEGORILER = ['Karakter', 'Araç', 'Bina', 'Dekor', 'Yemek', 'Doğa'];

export const KATALOG = [
  // Karakterler: hazır tarifler + rastgele
  ...Object.keys(KR.HAZIR).map(id => ({ id: 'kisi-' + id, ad: id[0].toUpperCase() + id.slice(1), kat: 'Karakter', yap: (k, R, s) => KR.karakter(k, { ...KR.HAZIR[id], ...s }) })),
  { id: 'kisi-rastgele', ad: 'Rastgele vatandaş', kat: 'Karakter', yap: (k, R, s) => KR.karakter(k, { ...KR.rastgeleKarakter(R), ...s }) },
  // Araçlar
  { id: 'otobus', ad: 'Belediye otobüsü', kat: 'Araç', yap: (k, R, s) => AR.otobus(k, s), secenek: { hat: ['42B', '25T', '40', '59R'], yon: ['BELGRAD ORMANI', 'BAHÇEKÖY', 'TAKSİM', 'SARIYER'] } },
  { id: 'dolmus', ad: 'Sarı dolmuş', kat: 'Araç', yap: (k, R, s) => AR.dolmus(k, s) },
  { id: 'taksi', ad: 'Taksi', kat: 'Araç', yap: (k, R, s) => AR.taksi(k, s) },
  { id: 'vapur', ad: 'Vapur', kat: 'Araç', yap: (k, R, s) => AR.vapur(k, s), secenek: { ad: ['MARTIKÖY-3', 'BOĞAZİÇİ-7', 'SİMİTKAPI'] } },
  { id: 'seyyar', ad: 'Seyyar araba', kat: 'Araç', yap: (k, R, s) => AR.seyyar(k, s), secenek: { tur: ['simit', 'misir', 'kestane', 'dondurma'] } },
  { id: 'motor', ad: 'Kurye motoru', kat: 'Araç', yap: (k, R, s) => AR.motor(k, s) },
  { id: 'bisiklet', ad: 'Bisiklet', kat: 'Araç', yap: (k, R, s) => AR.bisiklet(k, s) },
  // Binalar
  { id: 'apartman', ad: 'Cumbalı apartman', kat: 'Bina', yap: (k, R, s) => BI.apartman(k, s, R), secenek: { kat: [3, 4, 5, 2], gece: [false, true] } },
  { id: 'ahsap-ev', ad: 'Ahşap konak', kat: 'Bina', yap: (k, R, s) => BI.ahsapEv(k, s, R) },
  { id: 'dukkan', ad: 'Mahalle dükkanı', kat: 'Bina', yap: (k, R, s) => BI.dukkan(k, s), secenek: { tur: ['firin', 'manav', 'berber', 'bakkal'] } },
  { id: 'durak', ad: 'Otobüs durağı', kat: 'Bina', yap: (k, R, s) => BI.durak(k, s) },
  { id: 'kule', ad: 'Martı Kulesi', kat: 'Bina', yap: k => BI.kule(k) },
  // Dekor
  { id: 'sokak-lambasi', ad: 'Sokak lambası', kat: 'Dekor', yap: (k, R, s) => DE.sokakLambasi(k, s) },
  { id: 'bank', ad: 'Bank', kat: 'Dekor', yap: k => DE.bank(k) },
  { id: 'cop-kutusu', ad: 'Çöp kutusu', kat: 'Dekor', yap: k => DE.copKutusu(k) },
  { id: 'cay-masasi', ad: 'Çay bahçesi masası', kat: 'Dekor', yap: k => DE.cayBahcesi(k) },
  { id: 'semaver', ad: 'Semaver', kat: 'Dekor', yap: k => DE.semaver(k) },
  { id: 'koni', ad: 'Trafik konisi', kat: 'Dekor', yap: k => DE.trafikKonisi(k) },
  { id: 'saksi', ad: 'Saksı çiçek', kat: 'Dekor', yap: (k, R, s) => DE.saksi(k, s), secenek: { cicek: ['#e0533c', '#f2a2b3', '#ffd23f', '#8a6bbf'] } },
  { id: 'cesme', ad: 'Mermer çeşme', kat: 'Dekor', yap: k => DE.cesme(k) },
  { id: 'reklam', ad: 'Reklam panosu', kat: 'Dekor', yap: (k, R, s) => DE.reklamPanosu(k, s), secenek: { marka: ['kolaz', 'ayranbey', 'narcicek', 'martikart'] } },
  { id: 'kedi', ad: 'Sokak kedisi', kat: 'Dekor', yap: (k, R, s) => DE.kedi(k, s), secenek: { renk: ['tekir', 'sari', 'siyah', 'beyaz', 'ucrenk'] } },
  { id: 'marti', ad: 'Martı', kat: 'Dekor', yap: k => DE.marti(k) },
  // Yemek
  { id: 'simit', ad: 'Simit', kat: 'Yemek', yap: k => YE.simit(k) },
  { id: 'cay', ad: 'Çay bardağı', kat: 'Yemek', yap: k => DE.cayBardagi(k) },
  { id: 'doner-ocagi', ad: 'Döner ocağı', kat: 'Yemek', yap: (k, R, s) => YE.donerOcagi(k, s), secenek: { tur: ['et', 'tavuk'] } },
  { id: 'durum', ad: 'Dürüm', kat: 'Yemek', yap: k => YE.durum(k) },
  { id: 'lahmacun', ad: 'Lahmacun', kat: 'Yemek', yap: k => YE.lahmacun(k) },
  { id: 'balik-ekmek', ad: 'Balık ekmek', kat: 'Yemek', yap: k => YE.balikEkmek(k) },
  { id: 'sosisli', ad: 'Sosisli', kat: 'Yemek', yap: k => YE.sosisli(k) },
  { id: 'midye', ad: 'Midye dolma', kat: 'Yemek', yap: k => YE.midye(k) },
  { id: 'kunefe', ad: 'Künefe', kat: 'Yemek', yap: k => YE.kunefe(k) },
  { id: 'baklava', ad: 'Baklava tepsisi', kat: 'Yemek', yap: k => YE.baklava(k) },
  { id: 'pide', ad: 'Kaşarlı pide', kat: 'Yemek', yap: k => YE.pide(k) },
  { id: 'ayran', ad: 'Ayran', kat: 'Yemek', yap: k => YE.ayran(k) },
  { id: 'turk-kahvesi', ad: 'Türk kahvesi', kat: 'Yemek', yap: k => YE.turkKahvesi(k) },
  { id: 'sise', ad: 'Şişe içecek', kat: 'Yemek', yap: (k, R, s) => YE.sise(k, s), secenek: { tur: ['gazoz', 'su', 'kolaz'] } },
  { id: 'islak-hamburger', ad: 'Islak hamburger', kat: 'Yemek', yap: k => YE.islakHamburger(k) },
  { id: 'misir', ad: 'Mısır', kat: 'Yemek', yap: k => YE.misir(k) },
  // Doğa
  { id: 'cam', ad: 'Çam', kat: 'Doğa', yap: (k, R, s) => DO.cam(k, s, R) },
  { id: 'mese', ad: 'Meşe', kat: 'Doğa', yap: (k, R, s) => DO.mese(k, s, R) },
  { id: 'cinar', ad: 'Ulu çınar', kat: 'Doğa', yap: (k, R, s) => DO.cinar(k, s, R) },
  { id: 'selvi', ad: 'Selvi', kat: 'Doğa', yap: (k, R, s) => DO.selvi(k, s, R) },
  { id: 'erguvan', ad: 'Erguvan', kat: 'Doğa', yap: (k, R, s) => DO.erguvan(k, s, R) },
  { id: 'cali', ad: 'Çalı', kat: 'Doğa', yap: (k, R, s) => DO.cali(k, s, R) },
  { id: 'kaya', ad: 'Kaya', kat: 'Doğa', yap: (k, R, s) => DO.kaya(k, s, R) },
  { id: 'cicek-tarhi', ad: 'Lale tarhı', kat: 'Doğa', yap: (k, R, s) => DO.cicekTarhi(k, s, R) },
  { id: 'mantar', ad: 'Mantar', kat: 'Doğa', yap: (k, R, s) => DO.mantar(k, s), secenek: { tur: ['kirmizi', 'kahve', 'sari'] } },
];

export const BUL = Object.fromEntries(KATALOG.map(a => [a.id, a]));

/** id ile üret. tohum aynıysa model aynı çıkar. */
export function uret(k, id, sec = {}, tohum = 1) {
  const a = BUL[id]; if (!a) throw new Error('Böyle asset yok: ' + id);
  const g = a.yap(k, rng(tohum), sec); g.userData.assetId = id; g.userData.tohum = tohum;
  if (!g.userData.carpisma) olc(g);
  return g;
}

export { KR, AR, BI, DE, YE, DO };
