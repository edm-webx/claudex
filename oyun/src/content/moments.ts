/**
 * "Canlı iskele anları" content (survey yasam-3, yasam-4, genel-7, genel-8, ses-1): pure data, no three, no DOM.
 * - CHATS: two ambient citizens stop and trade 2-3 bubbles (a = first speaker, b = second; lines alternate a, b, a).
 * - RADIO: İskele Radyosu announcer lines (Martı FM, parody ads of invented brands only).
 * - EVENT_LINES: the bubble shown with each small random event.
 * - RITUALS: real-clock greeting cards (morning 06-11, night 22-05).
 * All brands invented (CONTRACT list). No "zam", no politics, no real people. No em-dashes.
 */

export type ChatLine = readonly [speaker: 'a' | 'b', text: string];
export interface ChatDef { id: string; lines: readonly ChatLine[] }

export const CHATS: readonly ChatDef[] = [
  { id: 'vapur-kacti', lines: [['a', 'Vapuru kaçırdım yine!'], ['b', 'Dert etme, yarım saate bir tane daha kaçırırsın.']] },
  { id: 'marti-simit', lines: [['a', 'Martı simidimi kaptı!'], ['b', 'Hayırlı olsun, artık akrabasınız.'], ['a', 'Bari çayı bıraksaydı...']] },
  { id: 'hava', lines: [['a', 'Lodos var bugün.'], ['b', 'Ben de saçımı öyle taradım, moda diye.']] },
  { id: 'cay-kac', lines: [['a', 'Kaçıncı çayın bu?'], ['b', 'Saymayı bıraktım, bardak sayıyorum.'], ['a', 'Kaç bardak?'], ['b', 'Onu da bıraktım.']] },
  { id: 'balik', lines: [['a', 'Bugün balık tuttun mu?'], ['b', 'Yok, balık beni tuttu, kalk diyor bırakmıyor.']] },
  { id: 'diyet', lines: [['a', 'Diyetteyim, sadece simit.'], ['b', 'Yanında?'], ['a', 'İki simit daha.']] },
  { id: 'sabri', lines: [['a', 'Sabri yine erkenden açmış.'], ['b', 'Adam büfede uyuyor bence.'], ['a', 'Uyusa da tost yapıyor ama.']] },
  { id: 'telefon', lines: [['a', 'Telefonum çekmiyor burada.'], ['b', 'Martılar sinyali yiyor abla.']] },
  { id: 'emekli', lines: [['a', 'Emekli olunca ne yapacaksın?'], ['b', 'Burada oturup vapur sayacağım.'], ['a', 'Ben şimdiden başladım, 14 oldu.']] },
  { id: 'gazoz', lines: [['a', 'Boğaz Gazozu mu Kolaz mı?'], ['b', 'İkisini karıştır, adını Boğolaz koy.']] },
  { id: 'karsi', lines: [['a', 'Karşıya geçmem lazım.'], ['b', "Ben 1998'den beri geçmeyi düşünüyorum."]] },
  { id: 'kedi', lines: [['a', 'Bu kedi her gün burada.'], ['b', 'Kira veriyor mu?'], ['a', 'Bakışıyla ödüyor.']] },
  { id: 'ayran', lines: [['a', 'Ayranbey yeni tat çıkarmış.'], ['b', 'Neymiş?'], ['a', 'Daha ayran.']] },
  { id: 'yuruyus', lines: [['a', 'Sabah yürüyüşündeyim.'], ['b', 'Bankta mı?'], ['a', 'Önce ısınıyorum, üç saattir.']] },
  { id: 'dalga', lines: [['a', 'Dalgalar bugün coşkulu.'], ['b', 'Bizim gibi, çay içmişler.']] },
  { id: 'ruya', lines: [['a', 'Rüyamda simit gördüm.'], ['b', 'Hayra yorarım: acıkmışsın.']] },
  { id: 'gunes', lines: [['a', 'Güneş çıktı, şemsiyeyi açayım mı?'], ['b', 'Aç aç, martılar gölge sever.']] },
  { id: 'tanidik', lines: [['a', 'Aa merhaba komşu!'], ['b', 'Ooo nerelerdesin, iki gündür yoksun!'], ['a', 'Karşı iskeleye kaçamak yaptım, affet.']] },
  { id: 'tavla', lines: [['a', 'Akşam tavla var mı?'], ['b', 'Var, ama bu sefer zarları ben seçiyorum.']] },
  { id: 'vapurcu', lines: [['a', 'Bu vapur hep 2 dakika geç kalıyor.'], ['b', 'Ona geç değil, Martıköy saati denir.']] },
];

/** İskele Radyosu: one short announcer line per ~90 s (Martı FM 98.6, invented). */
export const RADIO_LINES: readonly string[] = [
  "Martı FM'den günaydın İskele! Hava güzel, çaylar demli.",
  'Susadın mı? Boğaz Gazozu: içince martılar bile kıskanır!',
  'Ayranbey: köpüğü bıyığına, serinliği yüreğine.',
  'Kolaz! Bir yudumda vapur düdüğü gibi ferahlık.',
  'Martı Su: o kadar saf ki martılar aynası sanıyor.',
  'Narçiçek şerbeti: kırmızısı yanaklarına bulaşır.',
  'Trafik bilgisi: iskelede 3 martı, 1 kedi, akıcı.',
  'Şimdi sırada bir istek parçası: "Simitçi Abi" geliyor.',
  'Demlikhan Çay: demi tam, sohbeti bol.',
  'Hava durumu: öğlene doğru tost kokusu bekleniyor.',
  'Vapur bilgisi: bir sonraki vapur birazdan, belki biraz sonra.',
  'Lodos Soda: kabarcıkları rüzgara karşı yüzer.',
  'Dinleyicimiz Nebahat Hanım arıyor: "Sabri, simit sıcak mı?"',
  "Martı FM, Martıköy'ün tek ve en tuzlu radyosu.",
  'Buzdağı Limonata: o kadar soğuk ki penguenler abone.',
];

export type MomentEvent = 'simit' | 'ball' | 'rainbow' | 'blackout' | 'gullSteal';
export const EVENT_KINDS: readonly MomentEvent[] = ['simit', 'ball', 'rainbow', 'blackout', 'gullSteal'];

export const EVENT_LINES: Record<MomentEvent, readonly string[]> = {
  simit: ['Eyvah, simitler kaçtı!', 'Tutun şu simitleri!', 'Simitler yuvarlanıyor, yakala!'],
  ball: ['Topumuz vapurdan düştü!', 'Abi topu atar mısın?', 'Gol değil, iskele!'],
  rainbow: ['Aa, gökkuşağı!', 'Bak bak, Boğaz renklendi!', 'Dilek tut çabuk!'],
  blackout: ['Elektrik gitti!', 'Kim bastı düğmeye?', 'Tamam geldi, korkmayın.'],
  gullSteal: ['Martı simidi kaptı!', 'Hey! O benim kahvaltımdı!', 'Martı yine kazandı.'],
};

export type RitualId = 'morning' | 'night';
export const RITUALS: Record<RitualId, { title: string; body: string; radio: string }> = {
  morning: { title: 'Günaydın!', body: 'Simit-çay zamanı. Çaylar demlendi, martılar uyandı.', radio: "Martı FM'den günaydın! Simitler sıcak, çaylar tavşan kanı." },
  night: { title: 'İyi geceler', body: 'Lambalar yandı, iskele sakin. Bir çay daha?', radio: 'Martı FM gece yayını: dalgalar fısıldıyor, lambalar yanık.' },
};

/** Timings (seconds). */
export const MOMENT_TIMING = {
  chatGap: [25, 60] as const,
  chatLine: 2.6,
  eventGap: [120, 240] as const,
  firstEvent: [40, 80] as const,
  radioGap: [80, 100] as const,
  firstRadio: [12, 20] as const,
  radioShow: 5,
  ritualShow: 7,
  ritualWindow: 60,
};
