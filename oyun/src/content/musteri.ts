/**
 * Müşteri istekleri ve yeni müdavimler (survey musteri-2, musteri-3, musteri-4, musteri-7, icecek-2).
 * Pure data: special request lines per product, tourist pronunciations, five new regulars (RegularDef format,
 * appended to REGULARS in regulars.ts). Used by src/game/sim/musteri.ts and src/game/sim/agents/regulars.ts.
 */
import type { RegularDef } from './regulars';

/** Small extra wish on an order bubble (~1 in 6 queue orders). Key: product id. */
export const REQUESTS: Record<string, string[]> = {
  doner: ['soğansız', 'bol acılı', 'bol soslu', 'domatessiz'],
  cay: ['açık olsun', 'demli olsun', 'tavşan kanı'],
  ayran: ['bol köpüklü', 'buz gibi'],
  simit: ['susamı bol', 'çıtır olsun'],
  tost: ['bol kaşarlı', 'iyice kızarsın'],
  gazoz: ['buz gibi', 'pipetli olsun'],
};
/** Odds that a fresh queue customer carries a request. */
export const REQUEST_CHANCE = 1 / 6;
/** Extra tip for serving a request order (fraction of the sale). */
export const REQUEST_TIP = 0.10;
export const REQUEST_THANKS = ['Tam istediğim gibi!', 'Eline sağlık usta!', 'Aynen böyle, harikasın!', 'Beni anladın ya, yeter!'];

/** Citizen types that count as tourists (cap + camera looks). */
export const TOURIST_TYPES = ['kruvaziyer', 'turgrubu', 'gezgin'];
/** Comic pronunciations per product, shown in the tourist's bubble. */
export const TOURIST_SAY: Record<string, string[]> = {
  doner: ['Dönır!', 'Dönner plis!', 'Dö-ner? Dönır!'],
  cay: ['Çayy plis!', 'Çaay, ince belli!', 'Tşay?'],
  ayran: ['Ayrun!', 'Ayraan, köpük köpük!', 'Eyran?'],
  simit: ['Simmit!', 'Simit, simit, simmit!', 'Sesame halka?'],
  tost: ['Tosst!', 'Tost, çiz çok!', 'Toast? Tost!'],
  gazoz: ['Gazooz!', 'Gazoz, fıss!', 'Gaz-oz?'],
};
export const TOURIST_THANKS = ['Teşekkürler! Teşşekür?', 'Çok güzel! Very çok!', 'Sabri numbır van!', 'Yummy, afiyet!'];
/** Sabri explains with hands and arms. */
export const SABRI_GESTURE = ['(el kol hareketi) Yes yes, çok güzel!', '(baş parmak) Süper, afiyet!', '(eliyle kalp) Hoş geldin turist!', '(parmakla sayar) Bir, iki... tamam!'];
export const PHOTO_TOAST = 'Büfen fotoğraflandı! Turist albümüne girdin.';
export const GUIDE_WAVE = { say: 'Rehber: Herkes bir şey alsın!', toast: 'Bayraklı rehber kafilesini getirdi! Toplu sipariş dalgası!' };

export const YENI_MUDAVIMLER: RegularDef[] = [
  {
    id: 'nevzat', name: 'Emekli Kaptan Nevzat', fromDay: 1, hour: [7, 12],
    look: { lookType: 'emekli', skin: 3, body: 'round', age: 'old', hair: 'short', hairColor: '#d8d8d8', mustache: 'thick', hat: 'captain', hatColor: '#1f2f4f', top: '#2e3a59', topStyle: 'jacket', accent: '#2e3a59', bottom: '#2e3a59', glasses: 'thick' },
    order: { cay: 2 }, alt: { doner: 1 }, likes: ['denizci_can_simidi'], voice: 105,
    hint: 'İki demli çay, kaptan usulü. Tavşan kanı, rüzgar poyraz!',
    altHint: 'Çay ocağın yok mu daha? Bir dürüm ver bari, tayfa!',
    selam: ['Günaydın tayfa! Pruva büfeye!', 'Selam reis! Deniz bugün yağ gibi.', 'Rıhtıma yanaştım evlat, demli bekliyorum!'],
    idle: ['1974 kışı, Martı-3 vapurunu sisin içinden ben getirdim.', 'Bak şu vapura, düdüğü benim zamanımda daha kalındı.', 'Martılar beni tanır, eskiden simit atardım.', 'Demli çay denizcinin pusulasıdır evlat.'],
    story: [
      'Ben Kaptan Nevzat! Kırk yıl vapur sürdüm. Her sabah iki demli çay, aklında olsun.',
      'Senin çayın benim gemideki çaya benziyor. O kadar demli değil ama yaklaşıyor. Her zamankinden!',
      'Bir keresinde vapuru martı sürüsü takip etti, iskeleye kadar. Simit kokusundan. Her zamankinden!',
      'Kaptan şapkamı sana emanet etsem mi diyorum. Şaka şaka, daha erken. Her zamankinden!',
      'Sen bu büfenin kaptanısın artık evlat. Rotan açık olsun!'
    ]
  },
  {
    id: 'defne', name: 'Öğrenci Defne', fromDay: 2, hour: [11, 19],
    look: { lookType: 'universiteli', skin: 2, body: 'slim', hair: 'ponytail', hairColor: '#3a2416', top: '#7d6bb0', topStyle: 'hoodie', bottom: '#3f5878', glasses: 'thick', back: 'pack', props: ['headphones'] },
    order: { tost: 1, cay: 1 }, alt: { doner: 1 }, likes: [], voice: 215,
    hint: 'Bir tost, bir çay! Beynim yandı, yakıt lazım!',
    altHint: 'Tost makinen yoksa bir dürüm olur, ders çalışacağım!',
    selam: ['Selam abi! Sınav haftası, beni kurtar!', 'Merhaba! Üç saat uyudum, çay lazım!', 'Abi bugün integral var, dua et!'],
    idle: ['Türev neydi ya... martı türevi?', 'Notlarım rüzgarla uçmasın, tut şunu!', 'Tostun kokusu beynimi açıyor resmen.', 'Hoca "kolay soru" dedi. Kesin zor.'],
    story: [
      'Ben Defne, üniversitedeyim. Sınav haftası tost ve çay olmadan geçmez! Aklında tut.',
      'Dün gece senin tost sayesinde iki ünite bitirdim. Her zamankinden!',
      'Arkadaşlara söyledim, burası artık resmi çalışma mekanımız. Her zamankinden!',
      'Sınavdan AA aldım! Tostun hakkı var bunda. Her zamankinden!',
      'Mezun olunca da geleceğim abi, söz. Diplomamı tezgaha asarız!'
    ]
  },
  {
    id: 'saniye', name: 'Çiçekçi Saniye Teyze', fromDay: 2, hour: [9, 15],
    look: { lookType: 'teyze', skin: 4, body: 'round', age: 'old', headscarf: 'yazma', scarfColor: '#f0d35a', top: '#8daa5b', topStyle: 'cardigan', bottom: '#5a4a6a', bottomStyle: 'skirt', props: ['bouquet'] },
    order: { cay: 1, simit: 1 }, alt: { doner: 1 }, likes: ['saksi_sardunya'], voice: 280,
    hint: 'Bir çay, bir de simit yavrum. Çiçeğin yanına yakışır.',
    altHint: 'Daha çayın yok mu? Bir dürüm ver, çiçek de benden!',
    gift: 'Saniye Teyze tezgaha taze bir çiçek bıraktı. Büfe mis gibi kokuyor!',
    selam: ['Günaydın yavrum! Bugün papatyalar çok güzel.', 'Sana bir çiçek getirdim, bak bakayım!', 'Hayırlı işler evladım, çiçek gibi gün olsun!'],
    idle: ['Bu sardunya senin tezgaha çok yakıştı.', 'Gül diken ister, büfe müşteri ister.', 'Lale mi koysak yarın, ne dersin?', 'Çiçeğe su, büfeye çay, ikisi de şart!'],
    story: [
      'Ben Saniye, köşedeki çiçekçiyim. Her gün sana bir çiçek getireceğim, çayımı da sen koyacaksın!',
      'Dünkü karanfil solmamış, demek ki burada sevgi var. Her zamankinden!',
      'Kocam rahmetli de böyle bir büfede çay içerdi. Her zamankinden!',
      'Tezgahın çiçek bahçesine döndü yavrum, müşteriler bayılıyor. Her zamankinden!',
      'Sana bir saksı ortanca aldım, büfenin önüne koyalım. Senin de bahçen olsun!'
    ]
  },
  {
    id: 'efe', name: 'Martı Dostu Efe', fromDay: 1, hour: [13, 18],
    look: { lookType: 'okul', top: '#3fb5b0', bottom: '#3f5878', hat: 'cap', hatColor: '#e0533c', back: 'pack', props: ['simit'] },
    order: { simit: 2 }, alt: { ayran: 1 }, likes: [], voice: 290,
    hint: 'İki simit! Biri bana, biri martılara!',
    altHint: 'Simit yok mu? O zaman ayran, martılar da içer mi acaba?',
    gift: 'Efe martılara simit kırıntısı attı. Martılar bayram ediyor!',
    selam: ['Abii! Martılar beni bekliyor!', 'Selam! Bugün yeni bir martıya isim koydum: Kaptan Kanat!', 'Okul bitti, martı saati!'],
    idle: ['Bak bak, şu martı benim simidimi kaptı!', 'Martıların da bir patronu var biliyor musun?', 'Annem simidin yarısını ben yiyeyim dedi.', 'Kırıntı atınca hepsi dans ediyor!'],
    story: [
      'Ben Efe! Martıları besliyorum. İki simit lazım, biri bana biri onlara. Unutma!',
      'Martılardan biri bugün elimden yedi! Her zamankinden!',
      'Öğretmenime martıları anlattım, ödev oldu. Her zamankinden!',
      'Martılara isim listesi yaptım, bak: Kanat, Lodos, Simitçi Bey. Her zamankinden!',
      'Büyüyünce martı bilimcisi olacağım. Büfeni de martı istasyonu yaparız!'
    ]
  },
  {
    id: 'necmi', name: 'Besteci Necmi Abi', fromDay: 3, hour: [15, 22],
    look: { lookType: 'muzisyen', skin: 5, body: 'mid', hair: 'curly', hairColor: '#2b1d14', mustache: 'curl', hat: 'beanie', hatColor: '#c94f6d', top: '#f0d35a', topStyle: 'shirt', vest: '#3c3a44', bottom: '#3c3a44' },
    order: { ayran: 1, doner: 1 }, alt: { doner: 1 }, likes: ['nostalji_radyo'], voice: 160,
    hint: 'Bir dürüm, bir ayran. Do-re-mi-dürüm!',
    altHint: 'Ayran yoksa dürüm solo çalsın!',
    selam: ['♪ Dım dım dıııım ♪ Selam maestro!', 'Yeni bestem hazır: Ayranın Ağıdı!', '♪ La la la ♪ Büfe senfonisi başlıyor!'],
    idle: ['♪ Hım hım hıııım ♪', '♪ Vapuuur düdüğü, si bemol! ♪', 'Martılar korist olsa, ben şef!', '♪ Döner döner döööner, hayat döner ♪', 'Bu tezgahın ritmi var, dinle: tak tak tıss!'],
    story: [
      'Ben Necmi, besteciyim. Henüz kimse bilmiyor ama bilecek! Bir dürüm, bir ayran lütfen.',
      'Dün gece sana bir şarkı yazdım: "Sabri\'nin Tezgahı, Do Majör". Her zamankinden!',
      'Martılar bestemi dinlerken sustu. Bu bir iltifat bence. Her zamankinden!',
      'Yeni bestem iskelede çalındı, iki kişi alkışladı! Biri sendin. Her zamankinden!',
      'Albüm kapağına büfeni koyacağım. Adı da: "Her Zamankinden"!'
    ]
  }
];
