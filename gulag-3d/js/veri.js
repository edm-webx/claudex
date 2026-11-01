// Gulag Kaçışı 3D: seviyeler ve metinler
// Izgara: 12 satır, satır 0 en üst, satır 11 zemin. Harfler:
// # beton/taş  = ahşap iskele (alttan geçilir)  W dikenli tel çit  w yerde jilet tel
// B sandık  _ basınç plakası  D panjur kapı (plakaya bağlı)  G kilitli kapı
// S şalter  F sigorta kutusu  H saklanma yeri  C kontrol noktası  E çıkış  @ başlangıç
// k anahtar  c tel makası  s sosis  f sigorta  o lastik ördek  n not  x ıvır zıvır
'use strict';
function izgara(w) {
  const g = [...Array(12)].map(() => Array(w).fill('.'));
  const o = {
    g, w,
    h(x0, x1, r, c) { for (let x = x0; x <= x1; x++) g[r][x] = c; return o; },
    v(x, r0, r1, c) { for (let r = r0; r <= r1; r++) g[r][x] = c; return o; },
    p(x, r, c) { g[r][x] = c; return o; },
  };
  o.h(0, w - 1, 11, '#').v(0, 0, 10, '#').v(w - 1, 0, 10, '#');
  return o;
}

const SEVIYELER = [
  {
    ad: 'Barakalar', w: 64, ic: false, sis: 0x0b1424,
    kur: o => o
      .p(2, 10, '@').p(5, 10, 'n').p(8, 10, 'w')
      .h(10, 11, 9, '=').h(13, 15, 7, '=').p(14, 6, 'c')
      .v(19, 3, 10, 'W')
      .p(31, 10, 'H').p(35, 10, 'x')
      .p(41, 10, 'C')
      .h(43, 44, 9, '=').h(46, 48, 7, '=').p(47, 6, 'k')
      .h(50, 52, 5, '=').p(51, 4, 'o')
      .v(56, 1, 6, '#').v(56, 7, 10, 'G')
      .p(61, 10, 'E'),
    muhafiz: [{ x: 30, a: 23, b: 38 }],
    kopek: [], isik: [], salter: [],
    notlar: ['Doktor Pavel\'in notu: "Evlat, tel makasını iskelenin tepesine sakladım. Çitin ötesinde Grişa nöbette. Saman balyasında eğil, geçmesini bekle. Anahtar çaydanlıkta."'],
    ivir: ['Tek çorap. Kokusu muhafızları bile ağlatır. Yine de aldın.'],
    ordek: 'Lastik ördek #1. Kuyruğunda "Kimse görmedi" yazıyor.',
    ipucu: 'A/D yürü · W/Boşluk zıpla · S eğil',
  },
  {
    ad: 'Projektörler', w: 74, ic: false, sis: 0x0a1222,
    kur: o => o
      .p(2, 10, '@').p(4, 10, 'n').p(7, 10, 'S')
      .h(17, 18, 9, '=').h(20, 21, 8, '=')
      .h(23, 25, 6, '=').p(24, 5, 'o')
      .h(32, 34, 8, '=').p(33, 10, 'C')
      .h(42, 43, 8, '=').p(45, 10, 'B').h(51, 52, 8, '=')
      .p(56, 10, '_').p(58, 10, 'x')
      .v(63, 1, 7, '#').v(63, 8, 10, 'D')
      .p(66, 10, 'n')
      .p(70, 10, 'E'),
    muhafiz: [], kopek: [],
    isik: [{ a: 11, b: 30, hiz: 0.55, kule: 20 }, { a: 37, b: 58, hiz: 0.65, kule: 48 }],
    salter: [{ isik: 0, sure: 10 }],
    notlar: [
      'Elektrikçi Tolya\'nın notu: "Şalteri indirirsen birinci projektör on saniye söner. Sonra jeneratör kendine gelir. Çatı altları güvenli."',
      'Telsiz kâğıdı: "Panjur kapı, plakaya ağırlık konunca açılır. Sandık iyi bir ağırlıktır. Muhafız Vasya değildir, o ağırlık yapmaz, uyur."',
    ],
    ivir: ['Bir kutu kibrit. Hepsi yanmış. Biri hepsini tek tek denemiş.'],
    ordek: 'Lastik ördek #2. Projektör altında bronzlaşmış.',
    ipucu: 'E şalter · Işık çemberine girme · Çatı altı güvenli',
  },
  {
    ad: 'Erzak Deposu', w: 72, ic: true, sis: 0x120c08,
    kur: o => o
      .h(0, 71, 0, '#')
      .p(2, 10, '@').p(4, 10, 'n')
      .h(4, 6, 7, '=').p(5, 6, 'o')
      .h(8, 9, 9, '=').h(11, 26, 7, '=')
      .v(30, 1, 9, '#').v(31, 1, 9, '#')
      .p(33, 10, '_').p(35, 10, 'B').p(37, 10, 'B')
      .v(39, 1, 7, '#').v(39, 8, 10, 'D')
      .h(42, 46, 8, '#').h(42, 46, 9, '#').h(42, 46, 10, '#')
      .p(44, 7, 'k').p(45, 7, 'C')
      .p(53, 10, 'H').p(58, 10, 'x')
      .v(63, 1, 6, '#').v(63, 7, 10, 'G')
      .p(69, 10, 'E'),
    muhafiz: [{ x: 18, a: 12, b: 27 }, { x: 55, a: 48, b: 61 }],
    kopek: [], isik: [], salter: [],
    notlar: ['Depocu Fyodor\'un defteri: "Havalandırma deliğinden sadece eğilen geçer. Sağdaki sandık plakaya, soldaki merdivene. Yoksa tersi miydi? Votka bitti, hatırlamıyorum."'],
    ivir: ['Kırk yıllık konserve. Etiketinde "Belki fasulye" yazıyor.'],
    ordek: 'Lastik ördek #3. Konservelerin arasında saklanmış, bir şeyler biliyor.',
    ipucu: 'Sandığı yürüyerek it · R kontrol noktasına dön',
  },
  {
    ad: 'Köpekli Orman', w: 82, ic: false, sis: 0x07141a, aurora: true,
    kur: o => o
      .p(2, 10, '@').p(5, 10, 's').p(7, 10, 's').p(9, 10, 'n')
      .p(29, 10, 'w').p(30, 10, 'w')
      .h(31, 33, 9, '=').p(32, 8, 's')
      .h(37, 38, 9, '=').h(40, 41, 8, '=').h(44, 45, 6, '=').p(44, 5, 'o').h(47, 48, 8, '=')
      .p(52, 10, 'c').p(55, 10, 'C')
      .v(71, 3, 10, 'W')
      .p(75, 10, 'x')
      .p(78, 10, 'E'),
    muhafiz: [],
    kopek: [{ x: 20, a: 14, b: 26 }, { x: 63, a: 58, b: 68 }],
    isik: [{ a: 35, b: 54, hiz: 0.7, kule: 44 }],
    salter: [],
    notlar: ['Aşçı Baba Zina\'nın notu: "Köpekler saklandığını umursamaz, burunları var. Sosisi fırlat (F), yemeye dalarlar. Sosisler kantinden, sorma."'],
    ivir: ['Donmuş bir şapka. İçinde daha da donmuş bir sincap uyuyor. Uyandırmadın.'],
    ordek: 'Lastik ördek #4. Bir çam ağacında yuva yapmış.',
    ipucu: 'F sosis fırlat · Köpekler kokunu alır',
  },
  {
    ad: 'Kızıl Kule', w: 92, ic: false, sis: 0x1a0a10, aurora: true, kizil: true,
    kur: o => o
      .p(2, 10, '@').p(4, 10, 'n')
      .p(8, 10, 'B')
      .h(13, 15, 8, '#').h(13, 15, 9, '#').h(13, 15, 10, '#').p(14, 7, 'f')
      .h(10, 11, 6, '=').p(10, 5, 'o')
      .p(18, 10, 'S')
      .h(24, 25, 8, '=')
      .h(37, 39, 7, '#').p(36, 10, 'H').p(38, 10, 'f').h(42, 43, 8, '=')
      .p(48, 10, 'C')
      .h(49, 50, 9, '=').h(51, 53, 7, '=').p(52, 6, 'c').p(55, 10, 's')
      .v(58, 3, 10, 'W')
      .p(70, 10, 'f').p(73, 10, 'x')
      .v(75, 1, 9, '#')
      .p(80, 10, 'F')
      .v(84, 1, 6, '#').v(84, 7, 10, 'G')
      .p(89, 10, 'E'),
    muhafiz: [{ x: 34, a: 28, b: 44 }],
    kopek: [{ x: 67, a: 63, b: 72 }],
    isik: [{ a: 20, b: 46, hiz: 0.6, kule: 31 }],
    salter: [{ isik: 0, sure: 12 }],
    sigorta: 3,
    notlar: ['Doktor Pavel\'in son notu: "Üç sigortayı kutuya tak. Kule kararır, kapı açılır. Kamyon sınırda bekliyor. Arkana bakma evlat."'],
    ivir: ['Kule nöbetçisinin şiir defteri. Her şiir "Soğuk" kelimesiyle bitiyor. Her şiir.'],
    ordek: 'Lastik ördek #5. Kulenin tepesinden her şeyi izliyor. Ördeklerin hepsi buradaydı.',
    ipucu: '3 sigorta topla · F kutusunda E',
  },
];

const KONUSMACI = {
  a: { ad: 'Anlatıcı', renk: '#c9b98a' },
  v: { ad: 'Viktor', renk: '#e8d9a8' },
  p: { ad: 'Doktor Pavel', renk: '#9fc4e0' },
  n: { ad: 'Nina (telsiz)', renk: '#f08a7a' },
  m: { ad: 'Muhafız', renk: '#d06a50' },
};

const GIRIS = [
  ['a', 'Ekim 1962. Dünya, Küba krizinde nükleer savaşın eşiğinde.'],
  ['a', 'Sibirya, Vorkuta Gulagı. Roket mühendisi Viktor Sokolov uydurma bir casusluk suçuyla üç yıldır burada.'],
  ['v', 'Üç yıl. Her gece aynı hesabı kafamda çözüyorum. O güdüm sistemi yanlış kuruldu. Biri durdurmalı.'],
  ['p', 'Sessiz ol evlat, duvarların kulağı var. Nöbet gece yarısı değişiyor. Projektörler düşmanın, karanlık dostun.'],
  ['v', 'Siz de geliyorsunuz Doktor.'],
  ['p', 'Benim bacaklarım bu kışı çıkaramaz. Senin aklın binlerce hayat demek. Git!'],
  ['n', '...Viktor? Ben Nina. Bu sinyali duyuyorsan sınırda buluşuruz. Kamyon bekleyecek.'],
  ['v', 'Geliyorum Nina. Ne olursa olsun.'],
];

const ARA = [
  [['n', 'Viktor, çiti geçtiğini duydum. Önünde projektör avlusu var. Işık seni bulursa biter.'], ['v', 'Karanlık dostum. Pavel öyle dedi.']],
  [['p', 'Evlat, depodan geç. Fyodor içerde ama gözleri votkadan bulanık. Yine de dikkat.'], ['v', 'Bir depo, bir kapı daha.']],
  [['n', 'Ormanda köpekler var. Kantinden sosis aşırdığını biliyorum. Akıllıca.'], ['v', 'Sosis evrensel bir dildir Nina.']],
  [['n', 'Kızıl Kule son engel. Elektriği kesersen kapı açılır. Kamyonun motoru çalışıyor.'], ['v', 'Üç sigorta. Sonra özgürlük.']],
];

const FINAL = [
  ['a', 'Kule karardı. Kapı gıcırdayarak açıldı. Kamyonun farları karın içinde iki sıcak nokta gibi parlıyordu.'],
  ['n', 'Viktor! Atla, çabuk!'],
  ['v', 'Nina... Hesapları getirdim. Güdüm hatası düzeltilebilir. Kimse yanlışlıkla bir şehri yakmayacak.'],
  ['a', 'Birkaç gün sonra Küba krizi sessizce çözüldü. Kimse nedenini tam bilmedi.'],
  ['a', 'Vorkuta\'da bir hücrede Doktor Pavel, radyoda haberi duyunca gülümsedi.'],
  ['a', 'Ve kulenin tepesinde beş lastik ördek, sabaha kadar karı izledi.'],
];
