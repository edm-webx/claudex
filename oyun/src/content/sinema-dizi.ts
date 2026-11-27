/**
 * Martı Sinemaları'nın dizileri (2026-11-22 22:55 sahip: "sinemaları gerçek uzun animasyon olarak yapalım, hikâyesi olsun, dizi gibi
 * de olur"). Her salon bir dizi oynatır; günün her seansı bir sonraki bölümdür (content/avm-eglence.ts seans().bolum), hikâye
 * bölümden bölüme sürer. Bir bölüm: açılış kartı ("önceki bölümde...") + 7 sahne + "devamı bir sonraki seansta". Saf veri:
 * perdeye çizim view/world/sinema-perde.ts. Bütün isimler uydurma (parodi), gerçek marka / kişi yok.
 */
export type Arka = 'iskele' | 'rihtim' | 'gece' | 'carsi' | 'deniz' | 'firtina' | 'ev' | 'kule' | 'gunbatimi';
export type Karakter = 'kaptan' | 'yavru' | 'kedi' | 'simitci' | 'balikci' | 'ayten' | 'kerem' | 'mido' | 'nine' | 'kumpirci';
export type Hareket = 'dur' | 'yuru' | 'kos' | 'uc' | 'konus' | 'zipla' | 'uzgun' | 'gul' | 'dans';
/** sahnedeki rol: x (perde genişliğinin oranı, 0..1) -> x2'ye yürür / uçar; yon -1 sola bakar */
export interface Rol { k: Karakter; a: Hareket; x: number; x2?: number; yon?: 1 | -1 }
export interface Sahne { arka: Arka; roller: Rol[]; kim?: Karakter; soz: string }
export interface Bolum { ad: string; ozet: string; sahneler: Sahne[] }
export interface Dizi { ad: string; renk: string; bolumler: Bolum[] }

export const KARAKTER: Record<Karakter, { ad: string; renk: string }> = {
  kaptan: { ad: 'Martı Kaptan', renk: '#9fd3ff' }, yavru: { ad: 'Yavru Cevdet', renk: '#c9f2c0' }, kedi: { ad: 'Kedi Paşa', renk: '#ffb36b' },
  simitci: { ad: 'Simitçi Rıza', renk: '#ffe08a' }, balikci: { ad: 'Balıkçı Hasan', renk: '#a8d8c8' }, ayten: { ad: 'Ayten', renk: '#ffb3d1' },
  kerem: { ad: 'Kaptan Kerem', renk: '#b8c8ff' }, mido: { ad: 'Midye Mido', renk: '#e0e0e0' }, nine: { ad: 'Nazlı Nine', renk: '#e8c8ff' },
  kumpirci: { ad: 'Kumpirci Kenan', renk: '#ffd27a' },
};

const S = (arka: Arka, roller: Rol[], kim: Karakter | undefined, soz: string): Sahne => ({ arka, roller, kim, soz });
const r = (k: Karakter, a: Hareket, x: number, x2?: number, yon?: 1 | -1): Rol => ({ k, a, x, x2, yon });

export const DIZILER: Dizi[] = [
  {
    ad: 'Martı Kaptan', renk: '#d64545', bolumler: [
      { ad: 'Altın Simit', ozet: 'Boğaz’ın en meşhur simidi tezgâhında parlıyordu...', sahneler: [
        S('iskele', [r('simitci', 'konus', 0.35), r('kaptan', 'dur', 0.65, undefined, -1)], 'simitci', 'Bu Altın Simit, dedemden kalma. Yılda bir kez pişer!'),
        S('iskele', [r('kaptan', 'konus', 0.6, undefined, -1), r('yavru', 'zipla', 0.75, undefined, -1)], 'kaptan', 'Ben buranın kaptanıyım Rıza Usta. Simidin bana emanet.'),
        S('gece', [r('kedi', 'yuru', 0.05, 0.45)], 'kedi', 'Hı hı hı... Altın Simit bu gece benim olacak.'),
        S('iskele', [r('kedi', 'kos', 0.4, 1.05)], undefined, '(Tezgâhtan bir gölge kaçar. Altın Simit yok!)'),
        S('iskele', [r('simitci', 'uzgun', 0.4), r('kaptan', 'uc', 0.9, 0.62, -1)], 'simitci', 'Simidim! Simidimi çaldılar Kaptan!'),
        S('deniz', [r('kaptan', 'uc', 0.1, 0.55), r('yavru', 'uc', 0.0, 0.4)], 'kaptan', 'Yavru Cevdet, kanatları aç! İz sürüyoruz.'),
        S('gece', [r('kedi', 'gul', 0.6, undefined, -1)], 'kedi', 'Beni asla bulamayacaksın, kuş beyinli!'),
      ] },
      { ad: 'Kız Kulesi’ndeki İz', ozet: 'Kedi Paşa Altın Simit’i çaldı. Kaptan ile Cevdet peşine düştü.', sahneler: [
        S('deniz', [r('kaptan', 'uc', 0.15, 0.6), r('yavru', 'uc', 0.05, 0.45)], 'yavru', 'Kaptan, aşağıda simit kırıntıları var!'),
        S('kule', [r('kaptan', 'dur', 0.45), r('yavru', 'zipla', 0.58)], 'kaptan', 'Kırıntılar kuleye gidiyor. Akıllı kedi...'),
        S('kule', [r('balikci', 'konus', 0.3), r('kaptan', 'dur', 0.6, undefined, -1)], 'balikci', 'Gece bir kedi kayıkla geçti, ağzında parlak bir şey vardı!'),
        S('kule', [r('kaptan', 'konus', 0.55, undefined, -1), r('balikci', 'dur', 0.3)], 'kaptan', 'Hangi yöne gitti Hasan Abi?'),
        S('kule', [r('balikci', 'konus', 0.3)], 'balikci', 'Karşı yakaya, balık pazarına doğru.'),
        S('rihtim', [r('kaptan', 'dur', 0.4), r('yavru', 'uzgun', 0.55)], 'yavru', 'Kaptan... ben deniz tutuyorum galiba.'),
        S('rihtim', [r('kaptan', 'gul', 0.45), r('yavru', 'uzgun', 0.58)], 'kaptan', 'Martı dediğin deniz tutmaz Cevdet! Dayan!'),
      ] },
      { ad: 'Fırtınalı İskele', ozet: 'İz karşı yakadaki balık pazarını gösteriyordu. Kayığa bindiler.', sahneler: [
        S('firtina', [r('kaptan', 'dur', 0.4), r('yavru', 'uzgun', 0.55)], undefined, '(Boğaz’da fırtına kopar. Kayık sallanır.)'),
        S('firtina', [r('yavru', 'kos', 0.5, 0.9)], 'yavru', 'İmdaaat! Rüzgâr beni götürüyor!'),
        S('firtina', [r('kaptan', 'uc', 0.2, 0.75)], 'kaptan', 'Tutun Cevdet! Geliyorum!'),
        S('firtina', [r('kaptan', 'uc', 0.75, 0.45, -1), r('yavru', 'uc', 0.8, 0.5, -1)], 'yavru', 'Kurtardın beni Kaptan!'),
        S('rihtim', [r('kerem', 'konus', 0.3), r('kaptan', 'dur', 0.6, undefined, -1)], 'kerem', 'Sağ olun kuşlar! Teknenin kaptanı benim, Kerem.'),
        S('rihtim', [r('kerem', 'konus', 0.3), r('kaptan', 'dur', 0.6, undefined, -1)], 'kerem', 'Kedi Paşa mı? Balık pazarının altında gizli bir mahzeni var!'),
        S('gunbatimi', [r('kaptan', 'uc', 0.2, 0.7), r('yavru', 'uc', 0.1, 0.6)], 'kaptan', 'Fırtına dindi. Şimdi sıra Kedi Paşa’da.'),
      ] },
      { ad: 'Balık Pazarı', ozet: 'Kaptan Kerem, Kedi Paşa’nın gizli mahzenini söyledi.', sahneler: [
        S('carsi', [r('kaptan', 'yuru', 0.1, 0.4), r('yavru', 'yuru', 0.0, 0.28)], 'yavru', 'Burası çok balık kokuyor Kaptan...'),
        S('carsi', [r('balikci', 'konus', 0.65, undefined, -1), r('kaptan', 'dur', 0.38)], 'balikci', 'Yine mi siz? Mahzen tezgâhın altında, sessiz olun!'),
        S('carsi', [r('kedi', 'dans', 0.55)], 'kedi', 'Altın Simit benim, simit benim, la la la!'),
        S('carsi', [r('kaptan', 'konus', 0.3), r('kedi', 'dur', 0.65, undefined, -1)], 'kaptan', 'Oyun bitti Paşa! Simidi geri ver!'),
        S('carsi', [r('kedi', 'kos', 0.65, 1.05)], 'kedi', 'Yakalarsan senindir!'),
        S('carsi', [r('kaptan', 'kos', 0.2, 0.7), r('yavru', 'kos', 0.05, 0.55)], 'kaptan', 'Durdurun o kediyi!'),
        S('gece', [r('kedi', 'dur', 0.5)], 'kedi', 'Simit nerede biliyor musunuz? Martı AVM’nin çatısında!'),
      ] },
      { ad: 'Büyük Final', ozet: 'Kedi Paşa simidi Martı AVM’nin çatısına sakladığını söyledi.', sahneler: [
        S('gece', [r('kaptan', 'uc', 0.1, 0.45), r('yavru', 'uc', 0.0, 0.35)], 'kaptan', 'Çatıdayız. Simit kokusunu alıyorum...'),
        S('gece', [r('kedi', 'konus', 0.65, undefined, -1), r('kaptan', 'dur', 0.35)], 'kedi', 'Aslında... ben de simit sevdiğim için çaldım. Kimse bana simit vermiyor.'),
        S('gece', [r('kaptan', 'konus', 0.35), r('kedi', 'uzgun', 0.65, undefined, -1)], 'kaptan', 'Sormak bedava Paşa. Rıza Usta herkese simit verir.'),
        S('iskele', [r('simitci', 'gul', 0.3), r('kedi', 'zipla', 0.55, undefined, -1), r('kaptan', 'dur', 0.78, undefined, -1)], 'simitci', 'Altın Simit’im! Gel Paşa, sana da sıcak simit var!'),
        S('iskele', [r('nine', 'konus', 0.25), r('simitci', 'dur', 0.5)], 'nine', 'Hep beraber çay demleyelim evladım.'),
        S('gunbatimi', [r('kaptan', 'dans', 0.3), r('yavru', 'dans', 0.45), r('kedi', 'dans', 0.6), r('simitci', 'dans', 0.78)], undefined, '(Boğaz’da simit ve çay şenliği.)'),
        S('gece', [r('kaptan', 'uc', 0.3, 0.8)], 'kaptan', 'Boğaz güvende. Ama yeni bir macera her an kapıda...'),
      ] },
    ],
  },
  {
    ad: 'Boğazda Aşk ve Midye', renk: '#e07bb0', bolumler: [
      { ad: 'Limon Kazası', ozet: 'İskelede midye tezgâhı açan Ayten’in ilk günü...', sahneler: [
        S('iskele', [r('ayten', 'konus', 0.35), r('mido', 'zipla', 0.5)], 'ayten', 'Bugün ilk günüm Mido. Ya kimse gelmezse?'),
        S('iskele', [r('mido', 'konus', 0.5), r('ayten', 'dur', 0.3)], 'mido', 'Merak etme abla, ben buranın en yakışıklı midyesiyim.'),
        S('iskele', [r('kerem', 'kos', 0.0, 0.42)], 'kerem', 'Dolmuş kalkıyor! Yetişmem lazım!'),
        S('iskele', [r('kerem', 'uzgun', 0.42), r('ayten', 'uzgun', 0.6, undefined, -1)], undefined, '(Kerem tezgâha çarpar, limonlar her yere saçılır.)'),
        S('iskele', [r('ayten', 'konus', 0.6, undefined, -1), r('kerem', 'dur', 0.38)], 'ayten', 'Önüne baksana! Bütün limonlarım gitti!'),
        S('iskele', [r('kerem', 'konus', 0.38), r('ayten', 'dur', 0.6, undefined, -1)], 'kerem', 'Çok özür dilerim... yarın telafi ederim, söz!'),
        S('iskele', [r('mido', 'gul', 0.5)], 'mido', 'Ooo... limon kazası. Bu işin içinde aşk var.'),
      ] },
      { ad: 'Yanlış Anlaşılma', ozet: 'Kerem limonları döktü, ertesi gün telafi edeceğine söz verdi.', sahneler: [
        S('iskele', [r('kerem', 'yuru', 0.0, 0.35)], 'kerem', 'Bir kasa limon getirdim. Umarım affeder.'),
        S('iskele', [r('kumpirci', 'konus', 0.6, undefined, -1), r('ayten', 'gul', 0.75, undefined, -1)], 'kumpirci', 'Ayten Hanım, kumpirime sizin midyeyi koyalım mı?'),
        S('iskele', [r('kerem', 'uzgun', 0.35)], 'kerem', '(Yoksa onlar... birlikte mi?)'),
        S('rihtim', [r('kerem', 'uzgun', 0.45)], 'kerem', 'Boş ver Kerem. Sen teknene bak.'),
        S('iskele', [r('ayten', 'konus', 0.4), r('mido', 'dur', 0.55)], 'ayten', 'Dünkü çocuk gelmedi Mido. Söz vermişti...'),
        S('iskele', [r('mido', 'konus', 0.55), r('ayten', 'dur', 0.4)], 'mido', 'Gördüm onu, limonları bırakıp üzgün gitti.'),
        S('iskele', [r('ayten', 'dur', 0.4), r('mido', 'gul', 0.55)], 'mido', 'Bana bir plan lazım. Midye usulü bir plan!'),
      ] },
      { ad: 'Mido’nun Planı', ozet: 'Kerem, Ayten’i kumpirciyle görüp yanlış anladı. Mido plan yapıyor.', sahneler: [
        S('ev', [r('mido', 'konus', 0.5), r('nine', 'dur', 0.25)], 'mido', 'Nazlı Nine, Kerem’in ninesi sizsiniz değil mi?'),
        S('ev', [r('nine', 'gul', 0.25), r('mido', 'dur', 0.5)], 'nine', 'Konuşan midye! Torunum aşık mı oldu yoksa?'),
        S('ev', [r('nine', 'konus', 0.25)], 'nine', 'Yarın akşam iskelede çay ikram etsin. Ayten’i de çağırırız.'),
        S('rihtim', [r('kerem', 'dur', 0.35), r('nine', 'konus', 0.6, undefined, -1)], 'nine', 'Kerem! Akşam güverteye çay ocağı kur, misafir var.'),
        S('iskele', [r('mido', 'konus', 0.5), r('ayten', 'dur', 0.3)], 'mido', 'Abla, akşam iskelede bedava çay varmış. Gidelim!'),
        S('iskele', [r('ayten', 'konus', 0.3)], 'ayten', 'Peki ama sadece çay için, tamam mı?'),
        S('gunbatimi', [r('mido', 'dans', 0.5)], 'mido', 'Plan işliyor. Midye zekâsı!'),
      ] },
      { ad: 'Kumpir Savaşı', ozet: 'Nine ve Mido, Kerem ile Ayten’i iskelede buluşturmak için anlaştı.', sahneler: [
        S('rihtim', [r('kerem', 'konus', 0.35), r('ayten', 'dur', 0.6, undefined, -1)], 'kerem', 'Hoş geldin... Limonlar için tekrar özür dilerim.'),
        S('rihtim', [r('ayten', 'gul', 0.6, undefined, -1), r('kerem', 'gul', 0.35)], 'ayten', 'Limonları sen mi getirdin? Kumpirci getirdi sanmıştım!'),
        S('rihtim', [r('kumpirci', 'kos', 1.0, 0.7, -1)], 'kumpirci', 'Durun! Ayten Hanım’ın gönlü kumpirde!'),
        S('rihtim', [r('kerem', 'konus', 0.35), r('kumpirci', 'dur', 0.7, undefined, -1)], 'kerem', 'Ayten’in gönlü midyede kardeşim.'),
        S('rihtim', [r('mido', 'zipla', 0.5), r('kumpirci', 'uzgun', 0.72, undefined, -1)], 'mido', 'Kumpir de güzel ama bu hikâye midyenin!'),
        S('rihtim', [r('kumpirci', 'gul', 0.7, undefined, -1)], 'kumpirci', 'Peki peki... Ama düğünde kumpirler benden!'),
        S('gunbatimi', [r('ayten', 'dur', 0.42), r('kerem', 'dur', 0.56, undefined, -1)], undefined, '(Gün batarken ikisi ilk kez yan yana susar.)'),
      ] },
      { ad: 'Kız Kulesi’nde Teklif', ozet: 'Kumpirci geri çekildi. Ayten ile Kerem yakınlaştı.', sahneler: [
        S('kule', [r('kerem', 'yuru', 0.0, 0.4), r('ayten', 'yuru', 0.0, 0.28)], 'kerem', 'Seni buraya getirmek istedim. Burası Boğaz’ın kalbi.'),
        S('kule', [r('mido', 'zipla', 0.62)], 'mido', '(fısıldar) Şimdi! Yüzüğü şimdi çıkar!'),
        S('kule', [r('kerem', 'konus', 0.42), r('ayten', 'dur', 0.6, undefined, -1)], 'kerem', 'Ayten... benimle bir ömür limon toplar mısın?'),
        S('kule', [r('ayten', 'gul', 0.6, undefined, -1), r('kerem', 'dur', 0.42)], 'ayten', 'Evet! Ama limonları bir daha dökmeyeceksin!'),
        S('iskele', [r('nine', 'dans', 0.25), r('kumpirci', 'dans', 0.45), r('mido', 'dans', 0.62)], 'nine', 'Davul zurna gelsin, düğün var!'),
        S('gunbatimi', [r('ayten', 'dans', 0.4), r('kerem', 'dans', 0.55)], undefined, '(İskelede midyeli, kumpirli bir düğün.)'),
        S('gece', [r('mido', 'konus', 0.5)], 'mido', 'Ben söylemiştim. Her aşk bir limonla başlar.'),
      ] },
    ],
  },
];
/** salon sırasıyla: hangi dizi, günün n. seansı hangi bölüm (bölümler döner) */
export const diziOf = (salonId: number): Dizi => DIZILER[(salonId - 1) % DIZILER.length];
export const bolumOf = (d: Dizi, n: number): { no: number; b: Bolum } => { const i = ((n % d.bolumler.length) + d.bolumler.length) % d.bolumler.length; return { no: i + 1, b: d.bolumler[i] }; };
/** bölümün zaman çizelgesi (f 0..1): açılış kartı, 7 sahne, son kartı */
export const SAHNE_N = 7, KART_ACILIS = 0.07, KART_SON = 0.05;
export function anOf(f: number): { tur: 'acilis' | 'sahne' | 'son'; i: number; ls: number } {
  if (f < KART_ACILIS) return { tur: 'acilis', i: 0, ls: f / KART_ACILIS };
  if (f > 1 - KART_SON) return { tur: 'son', i: SAHNE_N - 1, ls: (f - (1 - KART_SON)) / KART_SON };
  const x = (f - KART_ACILIS) / (1 - KART_ACILIS - KART_SON) * SAHNE_N, i = Math.min(SAHNE_N - 1, Math.floor(x));
  return { tur: 'sahne', i, ls: x - i };
}
