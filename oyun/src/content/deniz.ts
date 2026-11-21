/**
 * Deniz, vapur ekstraları ve iskele büyümesi (survey vapur-4..7, iskele-3, iskele-5, iskele-10, yasam-2, animasyon-9/10, motor-3).
 * Pure data: no three, no DOM. Every brand / boat / person name is invented.
 * - DECK_RUN: tepsiyle güverteye 10 saniyelik koşu (vapur-4) and the Vapur Büfesi (vapur-5).
 * - SEA_LIFE: rare dolphins, summer jellyfish glow, lüfer / istavrit schools, a lost seal, a tiny octopus on a bollard (vapur-6).
 * - ANIMALS: vapur kedisi, çatı martı yuvası, karabatak, kirpi, kaplumbağa, kedi-martı düellosu (yasam-2).
 * - EXTERIOR: açılır tente + yan kanatlar, yan kulübe, çatı terası (iskele-3; Vapur Penceresi is the existing 'pencere' pad).
 * - SEATING: alçak hasır tabure + sehpa, uzun ortak masa, korkuluk tezgahı, tavla masası (iskele-5).
 * - PIER_EXP: yan iskele, uzun mendirek, yüzer platform (iskele-10).
 */

export type DenizSeason = 'ilkbahar' | 'yaz' | 'sonbahar' | 'kis';

/* ───────── vapur-4/5: güverte koşusu + Vapur Büfesi ───────── */
export const DECK_RUN = {
  /** seconds of selling on the deck */
  time: 10,
  /** with the Vapur Büfesi owned */
  timeBufe: 15,
  /** one carried item sells every this many seconds */
  every: 0.75,
  /** deck premium on top of the normal sale value */
  premium: 0.4,
  /** how close to the gangway (m) the player must stand to start */
  radius: 1.6,
  /** one run per docking */
  minStage: 1,
  lines: {
    start: ['Tepsiyle güverteye! 10 saniye, koş Sabri koş!', 'Güverte satışı başladı, yolcular el kaldırıyor!', 'Kaptan göz kırptı: hadi çabuk!'],
    sale: ['Güvertede kapış kapış!', 'Bir çay da arka sıraya!', 'Yolcu: "Vapurda simit, hayatın anlamı!"', 'Teyze: "Oğlum üstü kalsın!"'],
    end: 'Düdük çaldı! Güverte koşusu bitti: {n} satış, {money}.',
    empty: 'Tepsi bitti! Güverteden alkış geldi.',
    hint: 'Vapur yanaştı! Elin doluyken iskele kapısına koş, güvertede sat.',
  },
};
export const VAPUR_BUFE = {
  name: 'Vapur Büfesi',
  cost: 250000,
  minStage: 3,
  /** passive deck sales per docking, × stage */
  perDock: 180,
  blurb: 'Vapurun salonuna küçük bir tezgah. Her seferde güvertede kendi kendine satar, koşu süresi uzar, vapura binip gezebilirsin.',
  decks: [
    { id: 'alt', name: 'Alt salon', text: 'Ahşap sıralar, cam kenarında uyuklayan amcalar. Çaycı tepsisi tıngırdıyor.' },
    { id: 'ust', name: 'Üst güverte', text: 'Martılar simit peşinde, rüzgar saçları dağıtıyor. Herkes selfie çekiyor.' },
    { id: 'kaptan', name: 'Kaptan köşkü', text: 'Kaptan Nazmi dümende, demli çayı hep sağ elinde. "Lodos mu? Lodos bizim kanka."' },
    { id: 'bufe', name: 'Vapur Büfesi', text: 'Senin tezgahın! Tost makinesi vapurla birlikte hafif hafif sallanıyor.' },
  ],
  passengers: [
    { id: 'p1', name: 'Gazete okuyan amca', want: 'Bir çay, açık olsun.', tip: 1 },
    { id: 'p2', name: 'Uykulu öğrenci', want: 'Simit ve en büyük çay!', tip: 1 },
    { id: 'p3', name: 'Örgü ören teyze', want: 'Ayran, ama soğuk mu?', tip: 2 },
    { id: 'p4', name: 'Turist çift', want: 'Döner! Döner! Fotoğraf!', tip: 3 },
    { id: 'p5', name: 'Takım elbiseli bey', want: 'Tost, acele lütfen.', tip: 2 },
    { id: 'p6', name: 'Martı Cemil (kaçak yolcu)', want: 'Simit... sadece simit.', tip: 0 },
  ],
  serveTip: 25,
};

/* ───────── vapur-6: deniz canlıları ───────── */
export interface SeaLifeDef {
  id: string; name: string; icon: string; rare: boolean;
  seasons?: DenizSeason[]; hours?: [number, number]; w: number;
  /** seconds on screen */ dur: number;
  /** reward for the photo (₺ × stage), first time Altın Simit */ money: number; gold: number;
  line: string; photo: string;
}
export const SEA_LIFE: SeaLifeDef[] = [
  { id: 'yunus', name: 'Yunus sürüsü', icon: '🐬', rare: true, w: 1, dur: 16, money: 120, gold: 2, line: 'Yunuslar! Boğaz\'da yunus sürüsü zıplıyor!', photo: 'Yunuslar poz verdi, biri göz kırptı bile.' },
  { id: 'denizanasi', name: 'Denizanası parıltısı', icon: '🪼', rare: false, seasons: ['yaz'], hours: [19, 24], w: 3, dur: 22, money: 40, gold: 1, line: 'Su parlıyor! Denizanaları gece lambası gibi.', photo: 'Mavi mavi parlayan denizanaları. Dokunma ama, bakması bedava.' },
  { id: 'ahtapot', name: 'Minik ahtapot', icon: '🐙', rare: true, w: 0.8, dur: 18, money: 100, gold: 2, line: 'Babaya minik bir ahtapot tırmanıyor!', photo: 'Ahtapot babanın tepesine çıktı, sekiz koluyla zafer pozu verdi.' },
];
/** seconds between sea-life rolls [min, max] */
export const SEA_EVERY: [number, number] = [70, 140];


/* ───────── yasam-2: yeni hayvanlar ───────── */
export const ANIMALS = [
  { id: 'vapurkedisi', name: 'Vapur kedisi Kaptan', icon: '🐈', text: 'Her seferde vapurla gelir, iskelede bir tur atar, vapur kalkmadan geri atlar. Bileti yok, kimse sormaz.' },
  { id: 'martiyuvasi', name: 'Çatıdaki martı yuvası', icon: '🪺', text: 'Çatıda bir martı ailesi. Yavrular her gün biraz büyüyor ve her gün biraz daha gürültücü.' },
  { id: 'karabatak', name: 'Direkteki karabatak', icon: '🐦‍⬛', text: 'İskele direğinde kanatlarını açıp kurutuyor. Dünyanın en sabırlı modeli.' },
  { id: 'kirpi', name: 'Gece kirpisi Dikendiken', icon: '🦔', text: 'Gece olunca çalının dibinden çıkar, düşen simit kırıntılarını toplar.' },
  { id: 'kaplumbaga', name: 'Yaşlı kaplumbağa Hüsnüye', icon: '🐢', text: 'Çeşme başında yaşar, 80 yaşında olduğu söylenir. Bir turu bir gün sürer.' },
];
export const DUEL = {
  every: [90, 170] as [number, number], dur: 8,
  start: ['Bakışma düellosu başladı! Pamuk ve martı Cemil göz göze...', 'Sessizlik... Kedi ile martı bakışıyor. İskele nefesini tuttu.'],
  win: { kedi: 'Martı ilk göz kırptı! Pamuk kazandı, simit kırıntısı onun.', marti: 'Pamuk esnedi! Martı Cemil kazandı, gururla bağırdı.' },
};
export const SHIP_CAT = { chance: 0.3, line: ['Vapur kedisi Kaptan iskeleye atladı, bir tur atacak.', 'Kaptan (kedi) vapurdan indi, tezgahı teftiş ediyor.'], back: 'Vapur kedisi son anda vapura geri atladı. Profesyonel!' };

/* ───────── iskele-3: büfenin dışı ───────── */
export interface ExteriorDef { id: string; name: string; icon: string; cost: number; minStage: number; bonus: number; text: string; line: string }
export const EXTERIOR: ExteriorDef[] = [
  { id: 'tente', name: 'Açılır tente ve yan kanatlar', icon: '⛺', cost: 6000, minStage: 2, bonus: 0.03, text: 'Sabah kepenkle birlikte açılır, gece katlanır. Yan kanatlarda menü ve gazoz afişleri.', line: 'Tente açıldı, kanatlar kanat çırptı. Büfe sabaha uyandı!' },
  { id: 'kulube', name: 'Yan kulübe (depo + çay ocağı)', icon: '🛖', cost: 25000, minStage: 2, bonus: 0.04, text: 'Yan tarafa ahşap kulübe: çuvallar, kasalar ve bacası tüten bir çay ocağı.', line: 'Yan kulübe kuruldu! Çay ocağı tütmeye başladı.' },
  { id: 'teras', name: 'Çatıya küçük teras', icon: '🌇', cost: 140000, minStage: 3, bonus: 0.05, text: 'Çatıda iki sandalye, bir şemsiye ve ışık zinciri. Gün batımı manzarası bedava.', line: 'Çatı terası açıldı! Martılar komşu oldu.' },
];
/** Vapur Penceresi (iskele-3 option 2) is the existing 'pencere' pad; shown in the list only. */
export const WINDOW_NOTE = { name: 'Vapur Penceresi (iskele tarafı)', icon: '🪟', text: 'İskele tarafına bakan pencere. Vapur yanaşınca yolculara hızlı satış. Pencere pedinden açılır.' };

/* ───────── iskele-5: masa ve oturak çeşitleri ───────── */
export type SeatKind = 'standart' | 'hasir' | 'ortak' | 'tavla';
export interface SeatDef { id: SeatKind; name: string; icon: string; cost: number; bonus: number; text: string }
export const SEATS: SeatDef[] = [
  { id: 'standart', name: 'Standart masa', icon: '🪑', cost: 0, bonus: 0, text: 'Eski dost: plastik masa, iki sandalye.' },
  { id: 'hasir', name: 'Alçak hasır tabure + sehpa', icon: '🧺', cost: 3000, bonus: 0.008, text: 'Çay içmenin resmi oturuşu. Müşteri çabuk yer, çabuk kalkar, yine gelir.' },
  { id: 'ortak', name: 'Uzun ortak tahta masa', icon: '🪵', cost: 9000, bonus: 0.012, text: 'Yabancılar aynı masada tanışır, sohbet uzar, sipariş artar.' },
  { id: 'tavla', name: 'Tavla masası', icon: '🎲', cost: 16000, bonus: 0.015, text: 'Emekli amcalar saatlerce oturur, "Şeş beş!" diye bağırır, çay üstüne çay.' },
];
export const TEZGAH = { name: 'Korkuluğa asılı ayakta tezgah', icon: '🍹', cost: 5000, max: 3, bonus: 0.01, text: 'Denize bakarak ayakta çay. Masa bekleyen müşteri burada oyalanır.', spots: [{ x: -8.0, z: -13.18 }, { x: -6.6, z: -13.18 }, { x: 3.7, z: -13.18 }] };

/* ───────── iskele-10: iskele genişlemesi ───────── */
export interface PierExpDef { id: string; name: string; icon: string; cost: number; minStage: number; bonus: number; text: string; perk: string; line: string }
export const PIER_EXP: PierExpDef[] = [
  { id: 'yan', name: 'Yan iskele', icon: '🌉', cost: 60000, minStage: 2, bonus: 0.05, text: 'Batı tarafına ahşap bir yan iskele. Sandallar ve yatlar bağlanır.', perk: 'Gösterişli yatlar ve VIP müşteriler gelir, balıkçı sandalı daha sık uğrar.', line: 'Yan iskele açıldı! İlk bağlanan bir kayık oldu, adı "Umut Etmek".' },
  { id: 'mendirek', name: 'Uzun mendirek', icon: '🗼', cost: 450000, minStage: 3, bonus: 0.06, text: 'Açıkta taş bir mendirek ve ucunda kırmızı fener. Dalgayı keser, karabatakları toplar.', perk: 'Lüfer ve istavrit sürüleri daha sık gelir, karabataklar çoğalır.', line: 'Mendirek bitti! Fener ilk kez yandı, vapurlar selam verdi.' },
  { id: 'platform', name: 'Yüzer platform', icon: '🛟', cost: 2200000, minStage: 4, bonus: 0.08, text: 'Fenerli yüzer bir platform. Gece ışıl ışıl, gündüz güneşlenen martılarla dolu.', perk: 'Gece deniz canlıları daha sık görünür, yat VIP\'leri daha cömert.', line: 'Yüzer platform suya indi! Fenerler yandı, Martıköy bayram etti.' },
];

/** Total cap on all sale bonuses from this module. */
export const DENIZ_BONUS_CAP = 0.3;
