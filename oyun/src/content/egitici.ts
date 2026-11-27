/**
 * Eğitici kartları (2026-11-25 sahip: "oyuncu neyi nerden yapacağını yavaş yavaş öğrenmeli, pop-up ekranı kaplayıp oyunu durduran
 * eğiticilerle, dileyen ayarlardan kapatabilir"). Bütün metinler ve tetikler bu tek dosyada; görünüm ui/egitici.ts.
 * - Sıra = öncelik: aynı anda iki kartın koşulu tutarsa listede önce olan gösterilir, diğeri sırasını bekler.
 * - onem 'yan': kedi, martı, yağmur gibi küçük şeyler; son kartın üstünden YAN_ARA_S geçmeden çıkmaz (oyunu boğmasın).
 * - hud: kart HUD'daki bir düğmeyi gösterir. Düğmeler isimle bağlanır (HUD_HEDEF); HUD yeniden tasarlanınca yalnız o eşleme değişir.
 * - İlk üç temel (yürü, döner, tezgâh) kart DEĞİL: tutorial.ts'deki oklar durdurmadan gösterir (sahip kararı 2026-11-26).
 * - Vapur geçen hiçbir kart yok (kalıcı karar).
 */
import type { Vec2 } from '../engine/api';
import type { IcMekan } from './ic-mekan';
import { ARSALAR, arsaKapi } from './esya';
import { UG } from './ustgecit';

/** Koşulların okuduğu anlık durum (görünüm her 0.5 sn kurar). v: rules.v2State(), S: GameState, rt: Rules.rt */
export interface EgtCtx {
  v: any; S: any; rt: any;
  pos: Vec2 & { kat?: number };
  saat: number;
  ic: IcMekan | null;
  bolge: string | null;
  /** gerçek yağmur (kar ve fırtına değil) */
  yagmur: boolean;
  cokOyunculu: boolean;
  /** HUD'da o düğme var mı (HUD_HEDEF adı) */
  hud(ad: string): boolean;
}
export interface EgtAdim {
  baslik: string;
  metin: string | ((c: EgtCtx) => string);
  /** tuşlu küçük "nasıl" satırı; [W] gibi köşeli parantezler tuş olarak çizilir */
  nasil?: string;
  /** dünyada gösterilecek yer (kamera oraya kayar, halka çıkar) */
  hedef?(c: EgtCtx): Vec2 | null | undefined;
  /** HUD düğmesi adı (HUD_HEDEF anahtarı) */
  hud?: string;
  /** halkanın üstündeki etiket */
  etiket?: string;
  /** kamera ve halka yalnız hedef bu kadar metreden yakınsa (varsayılan UZAK_M); uzaksa halkasız, yalnız karartmalı kart */
  menzil?: number;
}
export interface EgtKart extends EgtAdim {
  id: string;
  grup: EgtGrup;
  onem?: 'ana' | 'yan';
  /** geçici olay kartı (kedi, martı, sabırsız müşteri...): koşul bir an doğru olsa bile BEK_S saniye beklemede kalır, kalıcı HUD kartlarına yenilmez */
  gecici?: boolean;
  /** büfenin dış alanını anlatır: oyuncu bir iç mekândayken çıkmaz (kamera dışarı kaymasın) */
  dis?: boolean;
  /** hedef bulunamazsa/uzaksa da kart çıkabilir (yoksa hedef çözülene kadar beklenir, görüldü sayılmaz) */
  hedefsizOk?: boolean;
  /** bu kartın yerine geçtiği eski kimlikler: biri görüldüyse bu da görülmüş sayılır (eski kayıt tekrar göstermesin) */
  eski?: string[];
  /** kartın çıkması için koşul; hata atarsa yanlış sayılır */
  kosul(c: EgtCtx): boolean;
  /** aynı kartın ikinci, üçüncü sayfası (nokta göstergesiyle) */
  devam?: EgtAdim[];
}
export type EgtGrup = 'baslangic' | 'isci' | 'buyume' | 'mulk' | 'isletme' | 'olay' | 'birlikte';
export const GRUP_AD: Record<EgtGrup, string> = {
  baslangic: 'İlk adımlar', isci: 'İşçiler', buyume: 'Büyüme', mulk: 'Mülk ve şehir', isletme: 'İşletme', olay: 'Olaylar', birlikte: 'Birlikte oynama',
};

/** HUD düğmeleri: ad -> sırayla denenen CSS seçiciler ya da 'bar:<yazı>' (alt çubukta o yazıyı taşıyan düğme). İlk bulunan gösterilir; HUD değişince yalnız burası değişir. */
export const HUD_HEDEF: Record<string, string[]> = {
  hedef: ['.hd-card'],
  seviye: ['.sb-lvl'],
  usta: ['.yt-b'],
  arkadas: ['.on-oda'],
  ayar: ['.sb-hbtns .sb-ib'],
  // yeni HUD (dal b1jn50): alt çubukta yalnız Çanta ve Telefon, sol altta yuvarlak mini harita, iskelede "Büfem" hapı
  telefon: ['bar:Telefon'],
  bufem: ['.tf-ctx'],
  harita: ['.tf-mini', 'bar:Harita'],
  mulk: ['bar:Telefon', 'bar:Mülk'],
  envanter: ['bar:Çanta', 'bar:Envanter'],
};

/** Zamanlama: kartlar arası en az ARA_S oyun saniyesi; 'yan' kartlar için YAN_ARA_S. Temel oklar bitmeden ya da BASLA_S dolmadan kart yok. */
export const EGT_ZAMAN = { ARA_S: 45, ARA_ILK_S: 90, ILK_DK_S: 600, YAN_ARA_S: 150, BEK_S: 60, BASLA_S: 180, TARA_S: 0.5, UZAK_M: 600, ESKI_KAYIT_S: 900 };
/** ilk 10 dakika sakin geçsin: o sürede kartlar arası ARA_ILK_S, sonra ARA_S */
export const egtAra = (playT: number) => (playT < EGT_ZAMAN.ILK_DK_S ? EGT_ZAMAN.ARA_ILK_S : EGT_ZAMAN.ARA_S);
// UZAK_M: kamera bu mesafeye kadar hedefe uçar (arsa Mülk panelinden uzaktan alınabildiği için büyük)

// ───────── yardımcılar ─────────
const own = (c: EgtCtx, k: string) => !!c.S.owned?.[k];
const plots = (c: EgtCtx): Record<string, { tur: string | null }> => (c.S.zones?.arsa?.plots || {}) as Record<string, { tur: string | null }>;
const arsaBul = (id: string) => ARSALAR.find(a => a.id === id);
const kapiOf = (id: string): Vec2 | null => { const a = arsaBul(id); return a ? arsaKapi(a) : null; };
/** boş arsa kartları parselin ortasını gösterir (kapı değil) */
const ortaOf = (id: string): Vec2 | null => { const a = arsaBul(id); return a ? { x: a.x, z: a.z } : null; };
/** sabit dükkân (kafe, kırtasiye, AVM...) değil, boş arsa olarak alınmış parseller */
const bosArsalar = (c: EgtCtx) => Object.keys(plots(c)).filter(id => { const a = arsaBul(id); return a && !a.sabit; });
const dukkanlar = (c: EgtCtx) => Object.keys(plots(c)).filter(id => !!arsaBul(id)?.sabit);
const yeniKare = (c: EgtCtx): string | null => { for (const k of Object.keys(c.S.tut || {})) if (k.startsWith('acGor_')) { const id = arsaId(k.slice(6)); if (arsaBul(id) && !plots(c)[id]) return id; } return null; };
const padPos = (c: EgtCtx, key: string): Vec2 | null => (c.v.pads || []).find((p: { key: string }) => p.key === key)?.pos ?? null;
/** oyuncu boşta: elinde ürün yok, kuyruk boş (HUD kartları işin ortasında çıkmasın) */
const bosta = (c: EgtCtx) => (c.v.carry || []).length === 0 && (c.v.queue || []).length === 0;
/** dükkân kapısındaki sarı kareler 'isl.k1' gibi gelir; arsa kimliği öneksiz ('k1') */
const arsaId = (k: string) => k.replace(/^(isl|avm)\./, '');
/** oyuncunun hemen alabileceği temel kare (tadilat ve dükkân kareleri kendi kartıyla anlatılır) */
const temelKareler = (c: EgtCtx): { key: string; pos: Vec2 }[] => (c.v.pads || []).filter((p: { key: string }) => !own(c, p.key) && !p.key.includes('.') && p.key !== 'tadilat');
const icTur = (c: EgtCtx, ...t: string[]) => !!c.ic && t.includes(c.ic.tur);

// ───────── kartlar (sıra = öncelik) ─────────
export const EGITICI: readonly EgtKart[] = [
  // İlk adımlar: yürü / döner / tezgâh okla gösterilir (tutorial.ts), kart buradan başlar
  // sari_kare ilk sırada: ilk para toplandıktan hemen sonra çay karesi çıkar, kart onu gösterir. Kasa kartı para okunun (tutorial.ts 'money') bitmesini bekler.
  { id: 'sari_kare', grup: 'baslangic', baslik: 'Sarı kare: yeni alet', etiket: 'Sarı kare', dis: true,
    metin: 'Sarı karenin üstünde durursan cebinden para akar, dolunca alet kurulur. Fiyatı karenin üstünde yazar, yarıda bırakırsan ödediğin kaybolmaz.',
    nasil: 'Karenin üstünde dur, dolmasını bekle',
    kosul: c => temelKareler(c).length > 0, hedef: c => temelKareler(c)[0]?.pos },
  { id: 'kasa', grup: 'baslangic', baslik: 'Paran kasada birikiyor', etiket: 'Kasa', dis: true,
    metin: 'Müşteri ödeyince para kasanın yanına yığılır, sen başka işteyken de büyür. Üstünden yürüdükçe cebine girer.',
    kosul: c => c.v.kasaPile > 0 && !!c.S.tut?.firstCollect, hedef: c => c.v.anchors?.kasa },
  { id: 'cay', grup: 'baslangic', baslik: 'Çay ocağı kuruldu', etiket: 'Çay ocağı', dis: true,
    metin: 'Ocağın yanında durunca çay demlenir ve bardak eline gelir. Döner gibi onu da tezgâha bırak.',
    kosul: c => own(c, 'cay'), hedef: c => c.v.anchors?.stations?.cay },
  { id: 'tasima', grup: 'baslangic', baslik: 'Elin doldu', etiket: 'Taşıma sınırı', gecici: true,
    metin: c => `Bir seferde en çok ${c.v.cap} ürün taşıyabilirsin.` + (c.S.owned?.tepsi2 ? '' : c.S.owned?.tepsi1 ? ' Sarı karelerdeki Dev Tepsi bu sınırı artırır.' : ' Sarı karelerdeki Büyük Tepsi bu sınırı artırır.'),
    kosul: c => c.v.cap > 0 && (c.v.carry || []).length >= c.v.cap, hedef: c => c.pos },
  { id: 'masa', grup: 'baslangic', baslik: 'Oturan müşteri', etiket: 'Tabure', dis: true,
    metin: 'Müşteri taburede oturup yer, kalkınca masa kirli kalır. İşçin ya da sen silmezsen yeni müşteri oturmaz. Garson varsa bahşiş ortak kumbaraya girer.',
    kosul: c => own(c, 'tabure1'), hedef: c => c.v.anchors?.tables?.[0] },
  { id: 'kirli_masa', grup: 'baslangic', baslik: 'Kirli masa müşteri kaçırır', etiket: 'Kirli masa', gecici: true, dis: true,
    metin: 'Yeni gelen kirli masaya oturmaz. Masanın yanında bir an dur, silinir. İşçin varsa o da siler.',
    kosul: c => (c.v.tablePiles || []).some((t: { dirty: boolean }) => t.dirty), hedef: c => (c.v.tablePiles || []).find((t: { dirty: boolean }) => t.dirty)?.pos },
  { id: 'sabirsiz', grup: 'baslangic', baslik: 'Sabrı tükenen müşteri', etiket: 'Sıra', gecici: true, dis: true,
    metin: 'Başının üstündeki çubuk kızardıkça müşterinin sabrı azalır. Biterse sinirlenip gider. Önce ona yetiş.',
    kosul: c => (c.v.queue || []).some((q: { pat: number }) => q.pat < 0.35), hedef: c => c.v.anchors?.queue0 },

  // İşçiler
  { id: 'pano', grup: 'isci', baslik: 'İş ve işçi bulma panosu', etiket: 'İş panosu', dis: true,
    metin: 'İşçileri bu panodan tutarsın. Her adayın huyu, kusuru ve maaşı farklıdır. Panoya her sabah yeni adaylar gelir.',
    nasil: 'Panonun önünde dur, aday kartları açılır',
    kosul: c => own(c, 'isbul'), hedef: c => c.v.anchors?.job },
  { id: 'ilk_isci', grup: 'isci', baslik: 'İlk işçin geldi', etiket: 'İşçin', dis: true,
    metin: 'İşçin gerçek biri: kendi yürür, ürün yapar, tezgâha taşır, masa siler. Yorulur ve arada uyuklar, maaşı gün sonunda kasadan çıkar.',
    kosul: c => (c.v.workers || []).length > 0, hedef: c => c.v.workers?.[0]?.pos },
  { id: 'uyuyan', grup: 'isci', baslik: 'İşçin uyuyakaldı', etiket: 'Zzz', gecici: true,
    metin: 'Uyuyan işçi iş yapmaz. Yanına yürü, uyanıp işine döner.',
    kosul: c => !!c.v.sleeper, hedef: c => c.v.sleeper },

  // Büyüme
  // Arayüz turu: eskiden üç ayrı kart (hedefler, telefon + bufem) peş peşe oyunu durduruyordu; hedefler ve telefon tek kartın iki sayfası.
  // Oyuncu boştayken çıkar (elinde ürün, kuyrukta müşteri yokken), 420. sn'de boşluk beklemeden çıkar.
  { id: 'arayuz', grup: 'buyume', baslik: 'Sıradaki işin hep burada', hud: 'hedef', eski: ['hedefler', 'telefon'],
    metin: 'Sol üstteki Hedefler kartı bir sonraki adımı ve ödülünü yazar. Bir hedefi iğneyle sabitleyebilir, oku takip edebilirsin.',
    kosul: c => c.hud('hedef') && ((c.S.playT > 200 && bosta(c)) || c.S.playT > 420),
    devam: [{ baslik: 'Telefonun', hud: 'telefon', metin: 'Harita, ajanda ve günün işleri, mülklerin, karne, karakter ve ayarlar telefonda. Sağ alttaki düğmeyle açılır.' }] },
  { id: 'bufem', grup: 'buyume', baslik: 'Büfem', hud: 'bufem', dis: true,
    metin: 'Büfenin önündeyken altta çıkan bu hapta büfenin işleri var: menü, ekip ve tadilat. Hangilerinin göründüğü seviyene bağlı.',
    kosul: c => c.hud('bufem') && c.S.playT > 300 && bosta(c) },
  { id: 'seviye', grup: 'buyume', baslik: 'Esnaf seviyen yükseldi', hud: 'seviye',
    metin: 'Sattıkça ve görev bitirdikçe seviye atlarsın. Yeni dükkânlar ve yollar seviyeyle açılır, karşı yakaya geçen üst geçit Esnaf 3’te açılır.',
    kosul: c => c.S.level >= 2 },
  { id: 'tadilat_kare', grup: 'buyume', baslik: 'Büfeyi büyütme zamanı', etiket: 'Tadilat', dis: true,
    metin: 'Bu kare büfenin bir sonraki aşamasını başlatır. Karede bir saniye dur: ücret akar, ustalar işe başlar. Yarı fiyata kendin kurmak istersen Büfem > Tadilat.',
    kosul: c => !!padPos(c, 'tadilat'), hedef: c => padPos(c, 'tadilat') },
  { id: 'tadilat_basladi', grup: 'buyume', baslik: 'Ustalar çalışıyor', etiket: 'Tadilat', dis: true,
    metin: 'Tadilat sürerken büfe açık kalır, satışa devam edebilirsin. Kalan süre tadilat panelinde yazar. Bitince yeni bölüm ve yeni kareler açılır.',
    kosul: c => !!c.S.tadilat, hedef: c => c.v.anchors?.counter },
  { id: 'karne', grup: 'buyume', baslik: 'Gün sonu karnesi',
    metin: 'Her gün sonunda karne gelir: hız, lezzet, temizlik ve güler yüz notların. Yıldızlar büfeyi büyütmene ve yeni dükkânlara yol açar.',
    kosul: c => c.S.day >= 2 },
  { id: 'gece', grup: 'buyume', baslik: 'Akşam oldu',
    metin: 'Büfe gece de açık, müşteri gelmeye devam eder. Sabah 08.00’de gün biter ve karne gelir.',
    kosul: c => c.saat >= 20 && c.saat < 24, hedef: c => c.pos },

  // Mülk ve şehir
  { id: 'dukkan_kare', grup: 'mulk', baslik: 'Satılık dükkân', etiket: 'Satılık',
    metin: 'Kapısındaki sarı karede açılması için gerekenler yazar. Şartlar tamam olunca karede durup satın alırsın.',
    kosul: c => !!yeniKare(c), hedef: c => { const id = yeniKare(c); return id ? kapiOf(id) : null; } },
  { id: 'dukkan_alindi', grup: 'mulk', baslik: 'Dükkân artık senin', etiket: 'Dükkânın',
    metin: 'İçerideki sarı karelerden alet kur, işçi panosundan eleman tut. Dükkân seviye atladıkça yeni aletler ve görevler açılır.',
    kosul: c => dukkanlar(c).length > 0, hedef: c => kapiOf(dukkanlar(c)[0]) },
  { id: 'arsa_alindi', grup: 'mulk', baslik: 'Arsan burası', etiket: 'Arsan',
    metin: c => { const h = ortaOf(bosArsalar(c)[0]); const uzak = !!h && Math.hypot(h.x - c.pos.x, h.z - c.pos.z) > 60; return 'Bu parsel artık senin. Üstüne ev ya da dükkân kurabilirsin.' + (uzak ? ' Buraya otobüs durağından gidebilirsin.' : ''); },
    nasil: 'Parselin kapısında dur, ne kuracağını seç', menzil: 60, hedefsizOk: true,
    kosul: c => bosArsalar(c).length > 0, hedef: c => ortaOf(bosArsalar(c)[0]),
    devam: [{ baslik: 'Ev mi dükkân mı?', metin: 'Ev senin dinlenip döşediğin yer olur. Dükkân para kazandırır ama işçi ve alet ister. Kararını sonra da verebilirsin, arsa bekler.' }] },
  { id: 'arsa_kuruldu', grup: 'mulk', baslik: 'Binan bu parselde', etiket: 'Binan',
    metin: c => { const p = plots(c)[bosArsalar(c).find(id => plots(c)[id]?.tur) || '']; return p?.tur === 'ev' ? 'Evin bu parselde. Kapısından girip istediğin gibi döşeyebilirsin.' : 'Dükkânın bu parselde. Kapıdan girip alet kur ve işçi tut.'; },
    menzil: 60, hedefsizOk: true,
    kosul: c => bosArsalar(c).some(id => !!plots(c)[id]?.tur), hedef: c => ortaOf(bosArsalar(c).find(id => !!plots(c)[id]?.tur) || '') },
  { id: 'ust_gecit', grup: 'mulk', baslik: 'Üst geçit açıldı', etiket: 'Üst geçit',
    metin: 'Merdivenden çıkıp yolun karşısına geçebilirsin. Karşı yakada kafeler, okul ve yeni dükkânlar var.',
    kosul: c => c.S.level >= 3, hedef: () => ({ x: UG.x, z: UG.zA }) },
  { id: 'banka', grup: 'mulk', baslik: 'Banka', metin: 'Kredi işleri banka gişesinde. Para yatırıp çekmek için gişeye ya da ATM’ye git; bankadaki para güvende kalır, karakterlerin arasında ortaktır.',
    kosul: c => icTur(c, 'banka') },
  { id: 'stadyum', grup: 'mulk', baslik: 'Stadyum Mahallesi', metin: 'Halı sahalar ve lig maçları burada. Maç günü bilet alıp tribüne girebilirsin.',
    kosul: c => c.bolge === 'stadyum' },
  { id: 'orman', grup: 'mulk', baslik: 'Belgrad Ormanı', metin: 'Sepetini al, ağaç diplerinde mantar ara. Topladığın mantarı satabilir ya da mutfağında kullanabilirsin.',
    kosul: c => c.bolge === 'orman' },

  // İşletme içi
  { id: 'kafe_ic', grup: 'isletme', baslik: 'Kafenin içi', metin: 'Aletler içerideki sarı karelerden kurulur, kurulanlar burada görünür. İşçiler siparişi kendi hazırlayıp masaya götürür.',
    kosul: c => icTur(c, 'kafe', 'bistro', 'kafeterya') },
  { id: 'avm_dukkan', grup: 'isletme', baslik: 'AVM’de bir dükkân', metin: 'AVM’deki her dükkân ayrı bir işletme. Önündeki sarı karede durup satın alırsın, aletleri içerideki karelerden kurarsın.',
    kosul: c => !!c.ic && c.ic.id.startsWith('avm') },
  { id: 'kirtasiye', grup: 'isletme', baslik: 'Kırtasiye', metin: 'Sahibiysen tezgâha geçip kendin satabilirsin. Öğrenciler okul saatlerinde gelir.',
    kosul: c => icTur(c, 'kirtasiye') },
  { id: 'okul', grup: 'isletme', baslik: 'Martıköy İlkokulu', metin: 'Dersler ve sınavlar burada. Sınavı geçen esnaf ödül alır.', kosul: c => icTur(c, 'okul') },
  { id: 'mutfak', grup: 'isletme', baslik: 'Sabri Mutfağı', metin: 'Malzemeyi istasyona koy, makine kendi yapar. Hazır olanı sen ya da işçin alıp götürür. İstasyonlar büfe aşamasıyla açılır.',
    kosul: c => icTur(c, 'mutfak') },
  { id: 'salon', grup: 'isletme', baslik: 'Salon', metin: 'Garsonlar masalara servis eder, sen mutfağı ve tezgâhı besle. Salon büfe aşamasıyla büyür, yeni masalar sarı karelerden açılır.',
    kosul: c => icTur(c, 'kahvalti', 'balik') },
  { id: 'bulasik', grup: 'isletme', baslik: 'Bulaşık birikiyor', metin: 'Kirli tabaklar yığılırsa hijyen düşer, müfettiş görür. Bulaşıkçı tut ya da istasyona gidip kendin yıka. Ceza yok, sadece müşteri azalır.',
    kosul: c => c.S.stage >= 5 },

  // Olaylar
  { id: 'kedi', grup: 'olay', onem: 'yan', gecici: true, baslik: 'Pamuk geldi', etiket: 'Kedi', metin: 'Sokak kedisi bacağına sürünüyor. Yanında durup sev, biraz neşe verir.',
    kosul: c => c.v.cat?.state === 'rub', hedef: c => c.v.cat?.pos },
  { id: 'marti', grup: 'olay', onem: 'yan', gecici: true, baslik: 'Martı simide göz dikti', etiket: 'Martı', metin: 'Tezgâhtaki ürüne bakan martıyı üstüne yürüyerek kovala, yoksa kapıp kaçar.',
    kosul: c => c.v.gull?.mode === 'stare', hedef: c => c.v.gull?.pos },
  { id: 'yetenek', grup: 'olay', hud: 'usta', baslik: 'Özel yeteneğin hazır',
    metin: c => { const y = c.rt.yetenek; return y ? `${y.icon} ${y.ad}: ${y.desc} Düğmeye bas, kullandıktan sonra bir süre dolmasını beklersin.` : 'Düğmeye bas, özel yeteneğin çalışır.'; },
    kosul: c => !!c.rt.yetenek && c.rt.yetenek.cd <= 0 && c.S.playT > 300 && bosta(c) },
  { id: 'yagmur', grup: 'olay', onem: 'yan', baslik: 'Yağmur başladı', metin: 'Yağmurda sıcak içecek daha çok satar, açık masaya az kişi oturur. Hava gün içinde değişir.',
    kosul: c => c.yagmur },

  // Birlikte oynama
  { id: 'arkadas', grup: 'birlikte', baslik: 'Arkadaşını çağır', hud: 'arkadas',
    metin: 'Bu düğmeden oda açıp arkadaşını büfene çağırabilirsin. Birlikte satarsınız; herkesin parası ve seviyesi kendine.',
    kosul: c => c.S.level >= 2 && c.S.playT > 900 },
  { id: 'misafir', grup: 'birlikte', baslik: 'Arkadaşının büfesindesin', etiket: 'Tezgâh', dis: true,
    metin: 'Burada sattığın ev sahibinin kasasına gider, sana satışın %25’i maaş olarak cebine girer. Kazandığın XP kendi seviyene yazılır. Alışverişi ev sahibi yapar.',
    kosul: c => !!c.rt.misafir, hedef: c => c.v.anchors?.counter },
  { id: 'ev_sahibi', grup: 'birlikte', baslik: 'Misafirin geldi',
    metin: 'Misafirin sattığı para senin kasana girer, onun maaşını oyun öder. Sarı kareleri ve alışverişi sadece sen yaparsın.',
    kosul: c => c.cokOyunculu && !c.rt.misafir },
];

/** tutorial.ts 'ipucu' çipleri: bu kimlikler kart olarak anlatıldığından eğitici açıkken çip gösterilmez */
export const EGT_IPUCU_KAPSAR: ReadonlySet<string> = new Set([
  'bina_kafe1', 'bina_kafe2', 'bina_banka', 'bina_kirtasiye', 'bina_okul', 'bina_mutfak', 'bina_salonW', 'bina_salonE', 'bolge_stadyum', 'bolge_orman',
]);
export const egtIpucuKapsar = (id: string) => EGT_IPUCU_KAPSAR.has(id) || id.startsWith('bina_avm');

export const egtKart = (id: string) => EGITICI.find(k => k.id === id);
export const EGT_KEY = (id: string) => 'egt_' + id;
export const EGT_KAPALI = 'egt__kapali';
export const EGT_SURUM = 'egt__v';
