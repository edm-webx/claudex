/**
 * Komşu esnaf ve dostluk (survey esnaf-1..10, hikaye-2, tarif-3): pure data for the friendship system in
 * src/game/sim/esnaf.ts and the panel in src/game/ui/esnaf-panel.ts.
 * - 5 levels per esnaf (Selam .. Aile), raised by talking (once a day), favours, gifts, shopping and their büfe visits.
 * - Each esnaf has a 5-part short story; part n opens at level n.
 * - Supply bonus (tarif-3): related products sell for a little more as the friendship grows.
 * Every name and brand here is invented. Player-facing text Turkish, no em-dashes.
 */
import type { ProductId } from '../../game/sim/schema';

export const DOST_LEVELS = ['Selam', 'Hal hatır', 'Çay arkadaşı', 'Can dostu', 'Aile'] as const;
/** Friendship points needed for level 1..5 (index = level - 1). */
export const DOST_XP = [0, 10, 28, 55, 95];
/** Supply quality bonus on related products per level (fraction of the sale). */
export const SUPPLY_PCT = [0, 0.03, 0.06, 0.1, 0.15];
/** General bonus per level for esnaf with no product of their own (berber, bisikletçi). */
export const GENERAL_PCT = [0, 0.005, 0.01, 0.015, 0.02];
/** Level from which an esnaf visits the büfe for "her zamankinden". */
export const VISIT_LEVEL = 2;

export const DOST_GAIN = { talk: 2, gift: 5, buy: 3, visit: 4, favour: 8, morning: 1, cay: 2, hakemWin: 3, hakemOther: 1 };
export const GIFT_COST = [25, 40, 60, 90, 120];
export const BUY_COST = [30, 45, 60, 80, 100];
/** Extra supply bonus for the rest of the day after shopping from the esnaf. */
export const FRESH_PCT = 0.05;

export interface StoryPart { title: string; text: string }
export interface EsnafDost {
  id: string; short: string;
  products: ProductId[]; perk: string;
  /** büfe visit window (game hours 8..24) and the "her zamankinden" order */
  hour: [number, number]; order: Partial<Record<ProductId, number>>;
  visitHint: string; visitLines: string[];
  gift: string; giftThanks: string[];
  buy: string; buyLine: string;
  talk: string[];
  story: StoryPart[];
  cat: string;
  morning: string; evening: string;
}

export const ESNAF_DOST: Record<string, EsnafDost> = {
  huesnu: {
    id: 'huesnu', short: 'Hüsnü',
    products: ['simit', 'tost'], perk: 'Simit ve tost ekmeği fırından sıcak gelir.',
    hour: [8, 10.5], order: { cay: 2 },
    visitHint: 'İki çay evladım, biri bana biri hamura.',
    visitLines: ['Fırın kızdı, ben de çaya geldim. Her zamankinden!', 'Hamur mayalanırken bir çay iyi gider.', 'Senin çayın benim simitime yakışıyor, söylemesi ayıp.'],
    gift: 'Bir demlik taze çay', giftThanks: ['Ooo, demlik! Sana yarın en çıtır simidi ayırdım.', 'Bu çayla hamur bile güler.'],
    buy: 'Sıcak ekmek ve simit al', buyLine: 'Al, fırından yeni çıktı. Elini yakma!',
    talk: ['Bugün hamur çok uslu, hiç kabarmadı yaramazlık yapmak için.', 'Benim simitim daha çıtır, Zeki duymasın.', 'Susamı tek tek sayarım, yalan yok, bazen ikişer.', 'Fırının sıcağı bende, gönlümün sıcağı sende.'],
    story: [
      { title: 'Ekşi maya', text: 'Hüsnü\'nün dedesinden kalan ekşi mayanın adı "Bereket Hanım". Her sabah ona günaydın der, yoksa küser.' },
      { title: 'Kayıp tarif', text: 'Dedesinin simit tarifi bir defterdeymiş. Defteri martı kapmış. Hüsnü o günden beri martılarla göz göze gelmez.' },
      { title: 'Çıtırlık yarışı', text: 'Yıllar önce mahalle çıtırlık yarışında ikinci olmuş. Birinci kim? Kendi babası. Hâlâ itiraz ediyor.' },
      { title: 'Gizli malzeme', text: 'Sana bir sır: simidin gizli malzemesi sabah dörtte söylenen türkü. Ses ne kadar falsoluysa simit o kadar çıtır.' },
      { title: 'Yeni defter', text: 'Hüsnü tarifleri yeni bir deftere yazdı ve ilk sayfaya senin adını koydu: "Büfedeki komşum, ailemden".' },
    ],
    cat: 'Susam', morning: 'Kepenk yukarı, fırın sıcak! Hayırlı sabahlar!', evening: 'Akşam çayı benden, simitler de kalan simitlerden.',
  },
  hayriye: {
    id: 'hayriye', short: 'Hayriye Abla',
    products: ['doner', 'ayran'], perk: 'Dönerin domatesi, marulu tazecik olur.',
    hour: [10.5, 13], order: { ayran: 1, doner: 1 },
    visitHint: 'Bir döner, bir ayran evladım. Domatesini ben verdim zaten.',
    visitLines: ['Tezgahı oğlana bıraktım, her zamankinden ver bakayım.', 'Senin dönerde benim domates var, belli oluyor.', 'Yorulunca buraya geliyorum, deniz de bedava.'],
    gift: 'Bir saksı fesleğen', giftThanks: ['Fesleğen mi? Kokusuna bayılırım evladım, gel sarılayım.', 'Bunu tezgahın başköşesine koyacağım.'],
    buy: 'Taze sebze sepeti al', buyLine: 'Domatesin en kırmızısı, marulun en çıtırı senin.',
    talk: ['Bugün karpuzlar çok sabırsız, hepsi ben ben diyor.', 'Evladım yemek yedin mi? Yüzün solgun.', 'Domatesle konuşursan daha tatlı olur, bilimsel.', 'Şevket yine dedikodu yapıyordu, ben dinlemedim, biraz dinledim.'],
    story: [
      { title: 'İlk tezgah', text: 'Hayriye Abla tezgahını otuz yıl önce bir el arabasıyla kurmuş. El arabasının adı "Gülizar", hâlâ arka bahçede emekli.' },
      { title: 'Karpuz kazası', text: 'Bir yaz yokuştan karpuz yuvarlanmış, mahalle bütün gün karpuz kovalamış. O günden beri her yaz "Karpuz Bayramı" yapılır.' },
      { title: 'Yeşil eller', text: 'Abla\'nın balkonu bir orman. Domatesler, biberler, bir de kimsenin ne olduğunu bilmediği tek bir bitki var.' },
      { title: 'Mektup', text: 'Gençken uzaktaki birine her hafta bir sepet incir yollarmış. Sepetler hep dolu dönmüş. İçinde mektuplar.' },
      { title: 'Bizim çocuk', text: 'Hayriye Abla artık seni herkese "bizim büfedeki çocuk" diye tanıtıyor. Tezgahta sana ayrılmış bir sepet hep duruyor.' },
    ],
    cat: 'Turşu', morning: 'Günaydın canlarım, sebzeler de uyandı!', evening: 'Akşam çayına bir tabak meyve getirdim, kimse eli boş gelmesin.',
  },
  sevket: {
    id: 'sevket', short: 'Şevket Usta',
    products: [], perk: 'Mahallede adını duyurur: bütün satışlara küçük bir şöhret katkısı.',
    hour: [13, 16], order: { cay: 1, tost: 1 },
    visitHint: 'Bir çay, bir tost. Haberler de benden.',
    visitLines: ['Her zamankinden usta! Bu arada duydun mu, yok yok sonra anlatırım.', 'Makası bıraktım, kulaklar bir saat dinlensin.', 'Tostun kenarı tıpkı benim kestiğim favori gibi, dümdüz.'],
    gift: 'Bir şişe limon kolonyası', giftThanks: ['Kolonya! Usta işi bir hediye, mahalle duyacak.', 'Bunu sadece özel müşterilere sürerim, sen de özelsin.'],
    buy: 'Tıraş ol, haber dinle', buyLine: 'Otur bakalım. Sakal da gitti, dertler de.',
    talk: ['Duydun mu, Zeki\'nin tartısı yine fazla tartıyormuş. Kalbi gibi.', 'Ben kimseyi çekiştirmem, sadece bilgilendiririm.', 'Bugün üç kişinin saçını kestim, dördünün de derdini.', 'Benim makasım mahallenin en keskin dili, ikinci keskini benim dilim.'],
    story: [
      { title: 'Haber merkezi', text: 'Şevket Usta\'nın aynasının köşesinde mahallenin bütün düğün davetiyeleri asılı. Hiçbirini kaçırmamış, bazılarına davetsiz.' },
      { title: 'Altın makas', text: 'Gençken "Altın Makas Turnuvası"nda saçı değil, bıyığı yarım kesip kazanmış. Jüri sanat sanmış.' },
      { title: 'Radyo', text: 'Dükkandaki eski radyo yalnızca tek bir kanal çeker: kendi sesi. Kaset doldurup çalıyor, kimse fark etmiyor.' },
      { title: 'Sessiz gün', text: 'Yılda bir gün hiç konuşmaz. O gün mahalle tuhaf bir sessizliğe gömülür, kediler bile endişelenir.' },
      { title: 'Aynadaki fotoğraf', text: 'Aynanın köşesinde artık büfenin fotoğrafı da var. Altında yazıyor: "Mahallenin yeni haberi, benim komşum".' },
    ],
    cat: 'Fırça', morning: 'Kepenkler açılsın, haberler de açılsın! Hayırlı sabahlar!', evening: 'Akşam çayında yeni haberlerim var, tavlayı da kaybetmeyeceğim bu sefer.',
  },
  zeki: {
    id: 'zeki', short: 'Zeki',
    products: ['cay'], perk: 'Çayın yanına çifte kavrulmuş leblebi, çay daha çok satar.',
    hour: [16, 19], order: { gazoz: 1 },
    visitHint: 'Bir gazoz, buz gibi. Tartıda fazla verirsen kızmam.',
    visitLines: ['Her zamankinden! Gazoz gelsin, leblebi benden.', 'Kavurma makinesi soğurken ben de serinleyeyim.', 'Sana bir avuç fındık getirdim, tartmadım, kalbimle ölçtüm.'],
    gift: 'Bir kese kahve çekirdeği', giftThanks: ['Bu çekirdekleri kavurup sana geri getireceğim, döngü tamam.', 'Hediye mi? Ben de sana fazla tartarım, ödeştik.'],
    buy: 'Leblebi ve fındık al', buyLine: 'Tartıyı kapattım, gözümle tarttım. Fazla oldu, kusura bakma.',
    talk: ['Benim leblebim Hüsnü\'nün simidinden daha çıtır. Söyleme ona.', 'Tartım bozuk değil, cömert.', 'Bir fıstık bir fıstığa, aç kalmayalım hiç.', 'Bugün bir sincap geldi, sohbet ettik, fındık istedi.'],
    story: [
      { title: 'Cömert tartı', text: 'Zeki\'nin tartısı hep fazla gösterir. Tamir ettirmek istemiş, usta tartıyı açıp içinden bir kalp çıkmış demiş.' },
      { title: 'Kavurma sesi', text: 'Kavurma makinesinin sesine göre fındığın keyfini anlar. Bazen fındıklar şarkı söyler, o gün satış iyi gider.' },
      { title: 'Sincap dostu', text: 'Parktaki sincap "Kemik" her sabah gelir. Zeki ona hesap defteri tutar. Borç bugün itibarıyla iki bin fındık.' },
      { title: 'Büyük yarışma', text: 'Leblebi fırlatma yarışında tavana yapıştırmış. Leblebi hâlâ orada, mahallenin uğuru sayılıyor.' },
      { title: 'Ortak kese', text: 'Zeki artık senin için ayrı bir kese hazırlıyor. Üstünde yazıyor: "Tartılmaz, ailedendir".' },
    ],
    cat: 'Fıstık', morning: 'Günaydın esnaf! Kavurma makinesi ısınıyor, ben de!', evening: 'Akşam çayına çekirdek getirdim, kabukları kimse yere atmasın.',
  },
  kemal: {
    id: 'kemal', short: 'Kemal',
    products: ['ayran', 'gazoz'], perk: 'Buzluğundan buz: ayran ve gazoz buz gibi satılır.',
    hour: [9, 11.5], order: { doner: 1, ayran: 1 },
    visitHint: 'Bir döner, bir ayran. Denizden gelen adam acıkır.',
    visitLines: ['Ağlar kurudu, mide acıktı. Her zamankinden!', 'Bugün bir lüfer bana göz kırptı, ben de ona.', 'Senin dönerin denizden sonraki en güzel şey.'],
    gift: 'Yeni bir olta ipi', giftThanks: ['Olta ipi! Bununla balina tutarım, tutmam ama tutarım gibi.', 'Rast gele sana da kardeşim, bu ipi saklayacağım.'],
    buy: 'Buz ve taze balık al', buyLine: 'Buz kalıbı al, ayranın buz kessin. Balık da hediye.',
    talk: ['Balık tutmanın sırrı sabır. Bir de iyi bir hikaye.', 'Dün denizde bir terlik tuttum. Sağ ayak. Solunu arıyorum.', 'Martılar benim ortağım, ama hesapları karışık.', 'Benim balığım Hayriye Abla\'nın domatesinden tazedir, o da kabul eder.'],
    story: [
      { title: 'Mavi Kayık', text: 'Kemal\'in kayığının adı "Mavi Kayık". Neden mavi? Çünkü elde kalan tek boya oymuş. Kayık da memnun.' },
      { title: 'Martı ortaklığı', text: 'Bir martı her sabah kayığa konar. Kemal ona "Kaptan" der. Kaptan hiç çalışmaz ama hep pay ister.' },
      { title: 'Fırtına gecesi', text: 'Bir fırtına gecesi limana herkesten önce dönmüş, çünkü fenerin ışığını Hüsnü\'nün fırınının ışığıyla karıştırmış. Şans.' },
      { title: 'Şişedeki mektup', text: 'Ağına bir şişe takılmış, içinde bir tarif: "Ayranı buzla değil gülümsemeyle soğut". Kemal ikisini de yapıyor.' },
      { title: 'Ailenin kayığı', text: 'Kemal kayığın yan tarafına küçük harflerle senin büfenin adını yazdı. "Artık bu kayık ikimizin" dedi.' },
    ],
    cat: 'Hamsi', morning: 'Rast gele esnaf! Ağlar boş, gönül dolu, hayırlı sabahlar!', evening: 'Akşam çayına deniz havası getirdim, bir de balık hikayesi.',
  },
  ayten: {
    id: 'ayten', short: 'Ayten',
    products: [], perk: 'Büfeyi boyar, zili parlatır: bütün satışlara küçük bir parlaklık katkısı.',
    hour: [17, 21], order: { tost: 1, ayran: 1 },
    visitHint: 'Bir tost, bir ayran. Pedal çevirmek acıktırır.',
    visitLines: ['Her zamankinden! Tostu çıtır, ayranı köpüklü olsun.', 'Zinciri yağladım, ellerimi yıkadım, geldim.', 'Senin büfenin rengi solmuş, bir boya sözüm var.'],
    gift: 'Parlak bir bisiklet zili', giftThanks: ['Bu zili duyan dönüp bakar! Teşekkürler komşu.', 'Ziline bayıldım, ilk bisiklete takacağım, yani benimkine.'],
    buy: 'Arabayı boyat, zili parlat', buyLine: 'Boya bitti, tekerlek ayarlandı. Gıcır gıcır!',
    talk: ['Bir tekerlek bir tekerleğe, yollar bizim.', 'Bugün üç bisiklet, bir el arabası, bir de bebek arabası tamir ettim.', 'Benim boyam Şevket\'in makasından daha keskin, çizgisi dümdüz.', 'Pedalı çevir, dertler geride kalsın.'],
    story: [
      { title: 'İlk bisiklet', text: 'Ayten ilk bisikletini çöpten bulduğu parçalarla yapmış. Adı "Frankeşteyn Kuzu". Hâlâ çalışıyor, gıcırdayarak.' },
      { title: 'Yokuş rekoru', text: 'Mahallenin en dik yokuşunu pedal çevirerek ilk çıkan o. Zirvede bir simitçi alkışlamış. O simitçi Hüsnü\'ymüş.' },
      { title: 'Renk kataloğu', text: 'Dükkanın duvarında yüz renk boya var. Her birine bir isim vermiş. En sevdiği "Vapur Dumanı Grisi".' },
      { title: 'Büyük tur', text: 'Bir gün bütün sahili bisikletle dolaşacakmış. Rotayı çizmiş, ilk durak senin büfen.' },
      { title: 'Aile turu', text: 'Ayten sana bir bisiklet yaptı, rengi büfenle aynı. Selesinde yazıyor: "Komşu değil, aile".' },
    ],
    cat: 'Zincir', morning: 'Günaydın! Zilleri çaldım, kepenkleri açtım!', evening: 'Akşam çayına geldim, bisikleti de getirdim, o da dinlensin.',
  },
};

export const DOST_IDS = ['huesnu', 'hayriye', 'sevket', 'zeki', 'kemal', 'ayten'];

// ───────── favours (esnaf-4, hikaye-2 "ayaküstü ricalar") ─────────
export type FavourKind = 'goz' | 'teslim' | 'kedi' | 'mektup';
export interface FavourDef { kind: FavourKind; title: string; ask: string; howTo: string; done: string; money: number; gold: number }
export const FAVOURS: Record<FavourKind, FavourDef> = {
  goz: { kind: 'goz', title: 'Dükkana bir göz at', ask: 'Bir çay içip geleceğim, dükkana bir göz atar mısın? Beş dakika, söz!', howTo: 'Çarşı Sokağı\'nda biraz vakit geçir.', done: 'Dükkan yerinde, kasa yerinde, sen de yerindesin. Sağ ol!', money: 40, gold: 0 },
  teslim: { kind: 'teslim', title: 'Siparişini başka komşuya götür', ask: 'Şu paketi komşuya götürür müsün? Benim ayaklar bugün grevde.', howTo: 'Paketi taşı ve komşunun tezgahına yürü.', done: 'Paket gitti, gönül rahat. Eline sağlık!', money: 50, gold: 0 },
  kedi: { kind: 'kedi', title: 'Kayıp kedisini bul', ask: 'Kedim yine kayboldu! Sokakta bir yerde uyuyordur, bulur musun?', howTo: 'Sokakta kediyi ara, yanına yürü.', done: 'Buldun mu? Hayırsız seni, gel kucağıma! Çok sağ ol komşu.', money: 60, gold: 1 },
  mektup: { kind: 'mektup', title: 'Aşk mektubu yazmaya yardım', ask: 'Birine mektup yazacağım ama kelimeler kaçıyor. Yardım eder misin?', howTo: 'Mektubun üç cümlesini seç.', done: 'Mektup hazır! Elim titriyor ama gönlüm sakin. Sağ ol!', money: 45, gold: 1 },
};
export const FAVOUR_ORDER: FavourKind[] = ['goz', 'teslim', 'kedi', 'mektup'];
/** seconds to spend in the street for "göz at" (sim seconds) */
export const GOZ_SECONDS = 45;

/** Love letter: three steps, three choices each. Every choice works, they are all a bit silly. */
export const LETTER_STEPS: { prompt: string; options: string[] }[] = [
  { prompt: 'Nasıl başlasın?', options: ['Sevgili deniz kokulu komşum,', 'Sabah simidi kadar sıcak dostum,', 'Merhaba, ben. Hani şu ben.'] },
  { prompt: 'Ne desin?', options: ['Seni görünce martılar bile susuyor.', 'Kalbim çay ocağı gibi, hep kaynıyor.', 'Tartıda kalbim hep fazla geliyor.'] },
  { prompt: 'Nasıl bitsin?', options: ['Akşam çayında bir bardak da sana koyarım.', 'Cevabını bir simidin içine sakla.', 'Not: Bu mektubu büfeci yazdı, ben imzaladım.'] },
];

/** Spots where a lost cat curls up (world coordinates, inside the walkable street). */
export const CAT_SPOTS: { x: number; z: number; where: string }[] = [
  { x: 70, z: 12.4, where: 'fırının önünde' },
  { x: 84, z: 6.0, where: 'manavın kasalarının yanında' },
  { x: 98, z: 12.2, where: 'berberin önünde' },
  { x: 108, z: 5.8, where: 'kuruyemişçinin yakınında' },
  { x: 118, z: 9.0, where: 'sokağın sonunda' },
  { x: 90, z: 9.0, where: 'sokağın ortasında' },
];

// ───────── rivalry (esnaf-6 tatlı atışma, hikaye-2 "sen hakemsin") ─────────
export interface Rivalry { a: string; b: string; lineA: string; lineB: string; topic: string }
export const RIVALRIES: Rivalry[] = [
  { a: 'huesnu', b: 'zeki', lineA: 'Benim simitim daha çıtır!', lineB: 'Benim leblebim ses yapar, simit fısıldar!', topic: 'Kim daha çıtır?' },
  { a: 'hayriye', b: 'kemal', lineA: 'Benim domatesim daha taze!', lineB: 'Benim balığım bu sabah denizdeydi, domates nerdeydi?', topic: 'Kim daha taze?' },
  { a: 'sevket', b: 'ayten', lineA: 'Benim makasım daha keskin!', lineB: 'Benim boya fırçamın çizgisi daha düz!', topic: 'Kimin işi daha ince?' },
  { a: 'zeki', b: 'kemal', lineA: 'Benim tartım daha cömert!', lineB: 'Benim ağım daha cömert, bugün terlik bile verdi!', topic: 'Kim daha cömert?' },
  { a: 'huesnu', b: 'ayten', lineA: 'Fırın yokuşu ben çıkarım, simit tepsisiyle!', lineB: 'Ben bisikletle çıkarım, tepsi de taşırım!', topic: 'Yokuşun kralı kim?' },
  { a: 'hayriye', b: 'sevket', lineA: 'Mahallenin haberini ben önce duyarım!', lineB: 'Haber benim aynamdan çıkar abla!', topic: 'Haber kimde önce?' },
];
export const HAKEM_WIN = ['Hakem benden yana! Bugün herkese ikram benden.', 'Gördün mü? Büfeci adil adam.'];
export const HAKEM_LOSE = ['Peki peki, yarın rövanş!', 'Hakeme itirazım yok, ama yarın görürüz.'];

// ───────── shared moments (esnaf-7) ─────────
export const MORNING_H: [number, number] = [8, 10];
export const EVENING_H: [number, number] = [19, 21.5];
/** Street-centre point where the esnaf gather for evening tea (view only, world coordinates). */
export const CAY_SPOT = { x: 92, z: 9 };
export const MORNING_TOAST = 'Kepenk selamı! Bütün esnaf "Hayırlı sabahlar!" dedi. Dostluk +1';
export const CAY_TOAST = 'Akşam esnaf çayına oturdun. Tavla, dedikodu, bol çay. Dostluk +2';
export const GOSSIP: string[] = [
  'Şevket: "Duydunuz mu, Kemal bugün bir terlik tutmuş, sağ ayak!"',
  'Hayriye Abla: "Zeki\'nin tartısı yine fazla tartmış, kadıncağız iki kilo fındıkla dönmüş."',
  'Zeki: "Hüsnü\'nün fırınından bütün gece türkü sesi geliyordu."',
  'Ayten: "Martılar Kemal\'in kayığına abone olmuş, her sabah toplantı yapıyorlar."',
  'Kemal: "Şevket\'in radyosunda yine Şevket konuşuyordu, dinledim, güzeldi."',
  'Hüsnü: "Ayten yokuşu öyle hızlı çıktı ki simitler havada soğudu."',
];
export const TAVLA_LINES = ['Şeş beş!', 'Hep gele gele bu zar mı gelir?', 'Bir çay daha, zar soğudu.', 'Tavla tahtası benden yana bugün.'];
export const MORNING_REPLY = 'Hayırlı sabahlar!';
