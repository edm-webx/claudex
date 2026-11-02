/**
 * Yiyecek ve içecek kataloğu (survey yiyecek-1..11, icecek-1..7, icecek-10, tarif-1,2,4,6,7,8). Pure data.
 * Decision: GameState.tiers / ProductId (schema.ts) stay the six station products. Every catalogue entry ("tarif")
 * belongs to one station; when a customer orders that station's product he may ask for one of the unlocked tarifs
 * by name. The station makes the base unit, the tarif adds `x` (price multiplier, >= 1) on top, paid as a kasa top-up
 * (sim/yiyecek.ts). So the v2 economy curve stays, the menu just gets richer.
 * Unlock (yiyecek-3): `open: {}` comes with the station, `stage` with a tadilat, `tier` with the station's kademe.
 * `how`: 'temel' (menu), 'gezgin' (Gezgin Aşçı week, learnable), 'deney' (Deney Tezgahı discovery), 'ay' (later).
 * Months use the real calendar (state.calendar). No em-dashes, no real brands.
 */
import type { ProductId } from '../game/sim/schema';

export const TIER_LABELS = ['Seyyar', 'Esnaf', 'Usta', 'Efsane'] as const;

export type FamId = 'durum' | 'ekmek' | 'hamur' | 'seyyar' | 'tatli' | 'deniz' | 'sicak' | 'soguk' | 'gazoz' | 'ay';
export interface TarifDef {
  id: string; name: string; station: ProductId; fam: FamId;
  /** price multiplier on the station's unit price (>= 1) */
  x: number;
  veg?: boolean; duble?: boolean; hot?: boolean; cold?: boolean;
  open: { stage?: number; tier?: number };
  how?: 'temel' | 'gezgin' | 'deney' | 'ay';
  /** real-calendar months the tarif is on the menu (omitted: all year) */
  months?: number[];
  story: string;
  /** citizen type ids that love it */
  likes: string[];
  /** Sabri's handwritten note */
  note: string;
  /** brand that supplies it (markalar.ts id) */
  brand?: string;
  /** region for Gezgin Aşçı */
  region?: string;
}

const WINTER = [11, 12, 1, 2, 3], SUMMER = [5, 6, 7, 8, 9], AUTUMN = [9, 10, 11, 12];

/** Four looks per family (yiyecek-9): kağıt, buhar, garnitür, sos çizgisi, kürdan bayrağı ve parıltı. */
export const FAM_LOOKS: Record<FamId, [string, string, string, string]> = {
  durum: ['Yağlı kağıda sarılı, sade ve sıcak', 'Buharı tüter, yanında kürdanlı turşu', 'Sos çizgisi, pul biber serpme, limon dilimi', 'Kürdan bayrağı, parıltı, porselen tabakta'],
  ekmek: ['Kese kağıdında, elde yenir', 'Ekmeği çıtır, yanında maydanoz', 'Kızarmış ekmek, sos çizgisi, turşu', 'Altın kenarlı tabak, kürdan bayrağı, parıltı'],
  hamur: ['Peçeteye sarılı, susamlı', 'Fırından yeni çıkmış, buharı tüter', 'Kağıt tabakta, yanında çay bardağı', 'Kürdan bayrağı, üstünde parıltılı susam'],
  seyyar: ['Külahta, seyyar tezgahtan', 'Buharı tüter, tuz serpilmiş', 'Bakır kapta, yanında limon', 'Kürdan bayrağı, kömür ışıltısı'],
  tatli: ['Kağıt kapta, sade', 'Şerbeti parlıyor', 'Porselen kasede, fıstık serpme', 'Kürdan bayrağı ve şerbet parıltısı'],
  deniz: ['Gazete kağıdında, limonlu', 'Buharı tüter, maydanozlu', 'Limon dilimi, soğan halkası, pul biber', 'Kürdan bayrağı, deniz parıltısı'],
  sicak: ['İnce belli bardak, tabağıyla', 'İki katlı demlikten, buharı tüter', 'Bakır tepside, yanında lokum', 'Tavşan kanı, buharı martı gibi süzülür'],
  soguk: ['Kapalı bardakta, buz gibi', 'Cam bardakta, köpüklü', 'Bakır tasta, nane yaprağıyla', 'Bardağın üstünde parıltılı köpük bulutu'],
  gazoz: ['Cam şişe, kapağı pıss', 'Buzlu, pipetli', 'Bardakta limon dilimiyle', 'Kabarcıkları parıldar, şişe kendi döner'],
  ay: ['Uçan kasede', 'Yerçekimsiz, havada süzülür', 'Yıldız tozu serpme', 'Ay ışığında parlar'],
};

export const TARIFLER: TarifDef[] = [
  // ───────── Döner şişi: döner, dürüm, köfte, kokoreç ─────────
  { id: 'tavuk_durum', name: 'Tavuk dürüm', station: 'doner', fam: 'durum', x: 1, open: {}, story: 'İskelenin ilk dürümü. Sabri bunu ilk gün sekiz kere yaptı, dokuzuncuda lavaşı katlamayı öğrendi.', likes: ['universiteli', 'kurye', 'okul'], note: 'Lavaşı üç kere katla. Dört kere katlarsan origami olur.' },
  { id: 'et_doner_ekmek', name: 'Yarım ekmek et döner', station: 'doner', fam: 'ekmek', x: 1.2, duble: true, open: {}, story: 'Vapura koşan herkesin elinde bir yarım ekmek döner olur. Kalan yarısı martıların payı.', likes: ['hamal', 'taksici', 'taraftar'], note: 'Ekmeği hafif ısıt. Çok ısıtırsan tost olur, o başka istasyon.' },
  { id: 'nohut_kofte_durum', name: 'Nohut köftesi dürüm', station: 'doner', fam: 'durum', x: 1.1, veg: true, open: {}, story: 'Etsiz ama doyurucu. Hayriye Abla nohutları kendi seçiyor, kusurlu nohut geçemez.', likes: ['gezgin', 'balayi', 'universiteli'], note: 'Etsiz isteyene bunu ver. Yaprak işaretini unutma!' },
  { id: 'kofte_ekmek', name: 'Köfte ekmek', station: 'doner', fam: 'ekmek', x: 1.15, duble: true, open: { stage: 2 }, story: 'Maç çıkışının vazgeçilmezi. Köfteler küçük ama özgüvenleri büyük.', likes: ['taraftar', 'taksici', 'hamal'], note: 'Köfteyi bastırma, kendi kendine pişsin. Onun da gururu var.' },
  { id: 'kokorec_yarim', name: 'Yarım kokoreç', station: 'doner', fam: 'ekmek', x: 1.3, open: { stage: 2 }, brand: 'uc_kardes', story: 'Gece kuşlarının gizli aşkı. Kekik kokusu iki iskele öteden duyulur.', likes: ['gecekusu', 'taksici', 'muzisyen'], note: 'Kekik bol, acı bol, laf az.' },
  { id: 'sebzeli_durum', name: 'Közlenmiş sebze dürüm', station: 'doner', fam: 'durum', x: 1.1, veg: true, open: { stage: 2 }, story: 'Patlıcan, biber, kabak. Hepsi közde birlikte oturup dertleşmiş.', likes: ['gezgin', 'vlogcu', 'plaza'], note: 'Patlıcanı iyice közle, yoksa küser.' },
  { id: 'kokorec_ceyrek', name: 'Çeyrek kokoreç', station: 'doner', fam: 'ekmek', x: 1.1, duble: true, open: { tier: 2 }, story: 'Yarımı fazla gelenlere. Ama herkes sonunda duble ister.', likes: ['gecekusu', 'universiteli'], note: 'Çeyrek isteyen yalan söylüyor. Duble hazırla.' },
  { id: 'adana_durum', name: 'Acılı Adana dürüm', station: 'doner', fam: 'durum', x: 1.35, duble: true, open: { tier: 3 }, story: 'Acı sevenlerin sınavı. Bir lokma alan vapur düdüğü gibi öter.', likes: ['taksici', 'hamal', 'isinsani'], note: 'Yanına ayran koy. Koymazsan müşteri denize atlar.' },
  { id: 'iskender_durum', name: 'Tereyağlı İskender dürüm', station: 'doner', fam: 'durum', x: 1.45, open: { stage: 3 }, story: 'Tereyağı sesi çıkınca bütün iskele döner. Tereyağı da buna alıştı, poz veriyor.', likes: ['isinsani', 'teyze', 'emekli'], note: 'Tereyağını en son dök. Cızırtıyı herkes duysun, reklam bedava.' },
  { id: 'ciger_durum', name: 'Ciğer şiş dürüm', station: 'doner', fam: 'durum', x: 1.3, open: { stage: 4 }, story: 'Sabahın köründe balıkçılar ister. Sumaklı soğanı olmadan servis yasak.', likes: ['oltaci', 'emekli', 'hamal'], note: 'Sumaklı soğan şart. Kemal Abi sorar, hesap verirsin.' },

  // ───────── Tost makinesi: ekmek arası, tost, balık, ızgara ─────────
  { id: 'kasarli_tost', name: 'Kaşarlı tost', station: 'tost', fam: 'ekmek', x: 1, veg: true, open: {}, story: 'Tostun en sade, en dürüst hali. Kaşarı uzar, ilişkileri uzatmaz.', likes: ['okul', 'universiteli', 'vapuryolcusu'], note: 'Makineyi iyice ısıt. Soğuk tost, kırık kalptir.' },
  { id: 'karisik_tost', name: 'Karışık tost', station: 'tost', fam: 'ekmek', x: 1.2, duble: true, open: {}, story: 'Kaşar, sucuk, domates ve gizli bir sos. Sosun tarifini Sabri bile tam bilmiyor.', likes: ['vapuryolcusu', 'plaza', 'taraftar'], note: 'Gizli sos: ketçap, mayonez ve bir tutam umut.' },
  { id: 'peynirli_domatesli_tost', name: 'Domatesli beyaz peynirli tost', station: 'tost', fam: 'ekmek', x: 1.05, veg: true, open: { tier: 2 }, story: 'Kahvaltının tosta dönüşmüş hali. Teyzeler buna "hafif" der, üç tane yer.', likes: ['teyze', 'bebekarabali'], note: 'Domatesi ince kes. Kalın keserse tost kaçar.' },
  { id: 'islak_hamburger', name: 'Islak hamburger', station: 'tost', fam: 'ekmek', x: 1.25, duble: true, open: { stage: 2 }, story: 'Buhar dolabında dinlenen sarımsaklı efsane. Gece yarısından sonra lezzeti iki katına çıkar.', likes: ['gecekusu', 'universiteli', 'taraftar'], note: 'Peçeteyi bol ver. Islak hamburger, ıslak el demektir.' },
  { id: 'balik_ekmek', name: 'Balık ekmek', station: 'tost', fam: 'deniz', x: 1.35, open: { stage: 2 }, story: 'Kemal Abi\'nin tezgahından sabah gelen uskumru. Soğanı, marulu, limonu hazır.', likes: ['kruvaziyer', 'turgrubu', 'oltaci'], note: 'Kılçık kontrolü şart. Turist kılçık görünce dilini unutuyor.' },
  { id: 'midye_tava', name: 'Midye tava', station: 'tost', fam: 'deniz', x: 1.3, open: { tier: 2 }, story: 'Çıtır kılıflı midyeler, tarator sosuna dalar. Martılar en çok bunun kokusuna gelir.', likes: ['gezgin', 'gecekusu'], note: 'Tarator sosu bol. Martıya verme, alışırsa kira ister.' },
  { id: 'lufer_ekmek', name: 'Lüfer ekmek', station: 'tost', fam: 'deniz', x: 1.6, open: { stage: 2 }, months: AUTUMN, story: 'Sonbaharda Boğaz\'ın kralı. Lüfer gelince iskelede bayram havası.', likes: ['oltaci', 'emekli', 'isinsani'], note: 'Sadece sonbaharda. Lüferi yazın soran, takvimi sorsun.' },
  { id: 'ayvalik_tostu', name: 'Ayvalık usulü tost', station: 'tost', fam: 'ekmek', x: 1.4, open: { stage: 3 }, story: 'Her şeyin içinde olduğu tost. Bir ısırıkta bütün ege gözünün önünden geçer.', likes: ['vlogcu', 'balayi', 'gezgin'], note: 'İçine ne koyacağını sorma. Hepsini koy.' },
  { id: 'kumru', name: 'Kumru', station: 'tost', fam: 'ekmek', x: 1.3, open: { stage: 4 }, story: 'Susamlı yumuşak ekmekte sucuk ve kaşar. Adı kuş ama içinde kuş yok, merak etme.', likes: ['plaza', 'isinsani'], note: 'Ekmeği kumru ekmeği olsun. Simit ekmeği değil, Zeki yine karıştırdı.' },
  { id: 'kunefe', name: 'Künefe', station: 'tost', fam: 'tatli', x: 1.55, open: { stage: 4 }, story: 'Tost makinesinde künefe mi? Sabri bir gece denedi, oldu. Peyniri uzar, şerbeti parlar.', likes: ['balayi', 'teyze', 'vlogcu'], note: 'Şerbet en son, sıcak künefeye soğuk şerbet. Fizik dersi gibi.' },

  // ───────── Simit tablası: simit, poğaça, açma, börek, seyyar lezzetler ─────────
  { id: 'susamli_simit', name: 'Susamlı simit', station: 'simit', fam: 'hamur', x: 1, veg: true, open: {}, brand: 'gevrek_express', story: 'Pekmezli suya batırılıp susama bulanmış halka. İstanbul\'un en eski selamı.', likes: ['emekli', 'okul', 'vapuryolcusu'], note: 'Simidin deliğinden vapura bakınca dürbün olur. Denedim.' },
  { id: 'pogaca', name: 'Peynirli poğaça', station: 'simit', fam: 'hamur', x: 1, veg: true, open: {}, brand: 'altin_firin', story: 'Hüsnü Usta\'nın fırınından sabah yedide gelir. Yedi buçukta biter.', likes: ['okul', 'teyze', 'plaza'], note: 'Poğaçayı sıcak sat. Soğuyunca poğaça değil, anı olur.' },
  { id: 'acma', name: 'Zeytinli açma', station: 'simit', fam: 'hamur', x: 1.05, veg: true, open: {}, story: 'Yumuşacık, tereyağlı, içinde zeytin sürprizi. Çekirdeği yok, söz.', likes: ['plaza', 'universiteli'], note: 'Zeytin çekirdeksiz. Bir kere çekirdekli geldi, dişçi beni arıyor.' },
  { id: 'lokma', name: 'Şerbetli lokma', station: 'simit', fam: 'tatli', x: 1.3, open: { stage: 3 }, story: 'Kızgın yağdan şerbete dalan altın toplar. Bir tane yiyen on tane ister.', likes: ['okul', 'teyze', 'bebekarabali'], note: 'Lokmayı sayma. Sayarsan biter.' },
  { id: 'su_boregi', name: 'Su böreği', station: 'simit', fam: 'hamur', x: 1.4, veg: true, open: { stage: 2 }, brand: 'dede_usulu', story: 'Kat kat haşlanmış yufka, arası peynir. Teyzeler tadına bakıp "benimki gibi olmuş" der. En büyük iltifat.', likes: ['teyze', 'emekli', 'turgrubu'], note: 'Kışın sıcak börek iste, yazın da iste. Börek mevsim tanımaz.' },
  { id: 'kol_boregi', name: 'Ispanaklı kol böreği', station: 'simit', fam: 'hamur', x: 1.3, veg: true, open: { tier: 2 }, story: 'Spiral spiral sarılmış. Ispanağı sevmeyen çocuklar bile bunu sever.', likes: ['bebekarabali', 'okul'], note: 'Çocuk "ıspanak yok mu" diye sorarsa yok de. Yalan değil, saklı.' },
  { id: 'kozde_misir', name: 'Közde mısır', station: 'simit', fam: 'seyyar', x: 1.2, veg: true, open: { stage: 2 }, months: SUMMER, story: 'Yaz akşamı kömür kokusu, tuzlu mısır, bir de deniz. Başka bir şey isteyen yok.', likes: ['balayi', 'kruvaziyer', 'okul'], note: 'Mısırı çevir, çevir, çevir. Ben döner ustası mıyım mısır ustası mı?' },
  { id: 'haslama_misir', name: 'Haşlanmış mısır', station: 'simit', fam: 'seyyar', x: 1.1, veg: true, open: {}, months: SUMMER, story: 'Kazandan çıkan sıcak mısır, üstüne tuz. Sahil yürüyüşünün yakıtı.', likes: ['bebekarabali', 'turgrubu'], note: 'Suyu tuzlu olsun. Deniz kadar değil ama.' },
  { id: 'kestane_kebap', name: 'Kestane kebap', station: 'simit', fam: 'seyyar', x: 1.3, veg: true, open: { tier: 2 }, months: WINTER, story: 'Kışın ellerini ısıtan kese kağıdı. Kestaneci amcayla aramızda tatlı bir rekabet var.', likes: ['emekli', 'balayi', 'plaza'], note: 'Kestaneyi çizmeyi unutma. Unutursan patlar, tavana yapışır.' },
  { id: 'nohutlu_pilav', name: 'Tavuklu nohutlu pilav', station: 'simit', fam: 'seyyar', x: 1.2, duble: true, open: { stage: 3 }, brand: 'tavuk_tekeli', story: 'Camlı arabadan gelen tane tane pilav. Öğle arasının kurtarıcısı.', likes: ['plaza', 'hamal', 'taksici'], note: 'Pilavın üstüne karabiber. Hapşıran müşteriye çay ikram.' },
  { id: 'kumpir', name: 'Kumpir', station: 'simit', fam: 'seyyar', x: 1.6, veg: true, open: { stage: 4 }, story: 'Dev patates, içi tereyağı ve kaşarla ezilir, üstüne her şey. Bitirebilen madalya alır.', likes: ['universiteli', 'vlogcu', 'balayi'], note: 'Malzemeyi tek tek sor. Hepsini isterlerse bende sor.' },

  // ───────── Ayran dolabı: soğuk içecekler, şerbetler, soğuk tatlılar, mezeler ─────────
  { id: 'kopuklu_ayran', name: 'Köpüklü ayran', station: 'ayran', fam: 'soguk', x: 1, veg: true, cold: true, open: {}, brand: 'ayranbey', story: 'Bakır tasta yayık ayranı. Köpüğü bıyık bırakır, Sütlü Nuri bundan esinlenmiş.', likes: ['hamal', 'taksici', 'emekli'], note: 'Ayranı sallarken şarkı söyle. Köpük şarkıyı sever.' },
  { id: 'salgam_acili', name: 'Acılı şalgam', station: 'ayran', fam: 'soguk', x: 1.1, veg: true, cold: true, open: { stage: 2 }, brand: 'salgamzade', story: 'Mor renkli, ekşi, acı. Kokoreçin en yakın arkadaşı.', likes: ['gecekusu', 'taksici'], note: 'Acılı isteyene acılı, acısız isteyene acısız. Karıştıran yanar.' },
  { id: 'salgam_acisiz', name: 'Acısız şalgam', station: 'ayran', fam: 'soguk', x: 1.1, veg: true, cold: true, open: { stage: 2 }, brand: 'salgamzade', story: 'Şalgamın sakin kardeşi. Mor ama huzurlu.', likes: ['teyze', 'turgrubu'], note: 'Acısız da olsa mor. Herkes sorar, cevap: evet, mor.' },
  { id: 'limonata', name: 'Ev yapımı limonata', station: 'ayran', fam: 'soguk', x: 1.2, veg: true, cold: true, open: {}, months: SUMMER, brand: 'buzdagi', story: 'Limonlar sabah sıkılır, nane yaprağı eklenir. Yaz sıcağında iskelenin buzdolabı.', likes: ['bebekarabali', 'balayi', 'kruvaziyer'], note: 'Şekeri az koy, limonu çok. Yüz buruşursa tam olmuştur.' },
  { id: 'gul_serbeti', name: 'Gül şerbeti', station: 'ayran', fam: 'soguk', x: 1.25, veg: true, cold: true, open: { tier: 2 }, story: 'Pembe, kokulu, saray usulü. Bir yudumda bahçeye dönersin.', likes: ['balayi', 'turgrubu', 'teyze'], note: 'Saniye Teyze gülleri getirdi. Bir tanesini kokladım, kendimi padişah sandım.' },
  { id: 'demirhindi', name: 'Demirhindi şerbeti', station: 'ayran', fam: 'soguk', x: 1.25, veg: true, cold: true, open: { tier: 3 }, story: 'Eski İstanbul\'un ekşi tatlı şerbeti. Adını söylemek, içmekten zor.', likes: ['emekli', 'gezgin'], note: 'De-mir-hin-di. Üç kere hızlı söyle, bedava şerbet. Kimse başaramadı.' },
  { id: 'boza', name: 'Leblebili boza', station: 'ayran', fam: 'soguk', x: 1.7, veg: true, open: { tier: 2 }, months: WINTER, brand: 'ay_bozasi', story: 'Kış akşamı tarçın serpilmiş boza, üstüne leblebi. Bozacının sesi rüzgarda gelir.', likes: ['emekli', 'teyze', 'gecekusu'], note: 'Tarçını kalp şeklinde serp. Olmazsa yuvarlak de, kimse fark etmez.' },
  { id: 'midye_dolma', name: 'Midye dolma', station: 'ayran', fam: 'deniz', x: 1.3, open: { stage: 2 }, story: 'Baharatlı pilavla dolu, limon sıkılır, tek lokmada iner. Midyeci "bir tane daha" diye sayar.', likes: ['gecekusu', 'universiteli', 'gezgin'], note: 'Midye sayarken şaşırma. Müşteri saymaz, ama ben sayarım.' },
  { id: 'dondurma', name: 'Dövme dondurma', station: 'ayran', fam: 'tatli', x: 1.4, cold: true, open: { stage: 2 }, months: SUMMER, story: 'Uzar, uzar, kılıçla kesilir. Dondurmacı şakası yapmadan vermek yasak.', likes: ['okul', 'kruvaziyer', 'bebekarabali'], note: 'Dondurmayı külaha koyup geri çek. Bir kere yaptım, çocuk bana dondurma attı. Haklıydı.' },
  { id: 'karpuz_peynir', name: 'Karpuz peynir', station: 'ayran', fam: 'tatli', x: 1.3, veg: true, cold: true, open: { tier: 2 }, months: SUMMER, story: 'Buz gibi karpuz, yanında beyaz peynir. Yaz akşamının en sade mutluluğu.', likes: ['emekli', 'balayi'], note: 'Karpuzu kesmeden tıklat. Tok ses, iyi karpuz. Boş ses, bana benzer.' },
  { id: 'kazandibi', name: 'Kazandibi', station: 'ayran', fam: 'tatli', x: 1.5, open: { stage: 3 }, story: 'Altı yanık, üstü tarçınlı muhallebi. Yanık olması hata değil, sanat.', likes: ['teyze', 'isinsani', 'turgrubu'], note: 'Yanık kısmı en lezzetli yeri. Bunu müşteriye söyleme, kendine sakla.' },

  // ───────── Çay ocağı: çay, kahve, sıcak içecekler ─────────
  { id: 'acik_cay', name: 'Açık çay', station: 'cay', fam: 'sicak', x: 1, veg: true, hot: true, open: {}, brand: 'demlikhan', story: 'Rengi açık, sohbeti uzun. "Açık olsun" diyen müşteri günün geri kalanını düşünmüştür.', likes: ['plaza', 'teyze', 'universiteli'], note: 'Açık demek su gibi demek değil. Arada bir fark var, o fark sanat.' },
  { id: 'demli_cay', name: 'Demli çay', station: 'cay', fam: 'sicak', x: 1.05, veg: true, hot: true, duble: true, open: {}, brand: 'demlikhan', story: 'İki katlı demlikten koyu kırmızı. Kaptanlar ve hamallar bunu içer.', likes: ['emekli', 'hamal', 'oltaci'], note: 'Tavşan kanı rengi hedef. Tavşana sormadım, kendisi onayladı.' },
  { id: 'turk_kahvesi_sade', name: 'Türk kahvesi (sade) + lokum', station: 'cay', fam: 'sicak', x: 1.6, veg: true, hot: true, open: { stage: 2 }, brand: 'vapurcu_kahve', story: 'Bakır cezvede ağır ağır. Yanında su ve bir lokum. Fala bakmak müşteriye kalmış.', likes: ['isinsani', 'emekli', 'turgrubu'], note: 'Köpüğü kaçırma. Köpüksüz kahve, sözsüz şarkı.' },
  { id: 'turk_kahvesi_orta', name: 'Türk kahvesi (orta) + lokum', station: 'cay', fam: 'sicak', x: 1.6, veg: true, hot: true, open: { stage: 2 }, brand: 'vapurcu_kahve', story: 'Ne sade ne şekerli, tam ortası. Kararsızların ve diplomatların kahvesi.', likes: ['plaza', 'balayi'], note: 'Orta şekerli: bir kaşık. Bir buçuk değil. Bunu kendime yazıyorum.' },
  { id: 'turk_kahvesi_sekerli', name: 'Türk kahvesi (şekerli) + lokum', station: 'cay', fam: 'sicak', x: 1.6, veg: true, hot: true, open: { stage: 2 }, brand: 'vapurcu_kahve', story: 'Tatlı sevenlere, yanında bir lokum daha. Hayat zaten yeterince acı kahve gibi.', likes: ['teyze', 'kruvaziyer'], note: 'Şekerli kahvenin yanına iki lokum. Bir tanesi benim, ama veriyorum.' },
  { id: 'ihlamur', name: 'Ballı ıhlamur', station: 'cay', fam: 'sicak', x: 1.4, veg: true, hot: true, open: { tier: 3 }, story: 'Hapşıranların ilacı, sohbetin bahanesi. Teyzeler cebinden kendi ıhlamurunu çıkarır bazen.', likes: ['teyze', 'emekli', 'bebekarabali'], note: 'Hasta müşteriye ıhlamur, sağlam müşteriye de ıhlamur. Kimse bilmez kim hasta olacak.' },
  { id: 'sahlep', name: 'Tarçınlı sahlep', station: 'cay', fam: 'sicak', x: 1.8, veg: true, hot: true, open: { tier: 2 }, months: WINTER, story: 'Kar yağarken kalın kıvamlı, tarçınlı sıcacık sahlep. Vapur bekleyenlerin kışlık sobası.', likes: ['balayi', 'plaza', 'okul'], note: 'Karıştırmayı bırakma. Bırakırsan topaklanır, topaklanırsa ben ağlarım.' },
  { id: 'kozde_kahve', name: 'Közde kahve', station: 'cay', fam: 'sicak', x: 2, veg: true, hot: true, open: { stage: 3 }, brand: 'vapurcu_kahve', story: 'Kızgın kumda, közün üstünde yavaş yavaş pişer. Bekleyen kazanır, köpüğü taçlanır.', likes: ['vlogcu', 'isinsani', 'gezgin'], note: 'Kumu çok ısıtma, kahve kaçar. Kahve kaçarsa ben de kaçarım.' },
  { id: 'buzlu_kahve', name: 'Plaza tipi buzlu kahve', station: 'cay', fam: 'soguk', x: 2.2, veg: true, cold: true, open: { stage: 4 }, brand: 'kopuk_kulesi', story: 'Uzun bardak, bol buz, kıyıdaki plazalardan gelenlerin şifresi. Adı uzun, yudumu kısa.', likes: ['plaza', 'isinsani', 'vlogcu'], note: 'İsmini bardağa yaz. Yanlış yazarsan daha çok fotoğraf çekiyorlar.' },

  // ───────── Gazoz dolabı: gazozlar, sodalar, taze sıkma ─────────
  { id: 'bogaz_gazozu', name: 'Boğaz Gazozu', station: 'gazoz', fam: 'gazoz', x: 1, veg: true, cold: true, open: {}, brand: 'bogaz_gazozu', story: 'Cam şişede yerli gazoz. Kapağı açılınca çıkan ses bütün iskeleye "yaz geldi" der.', likes: ['emekli', 'okul', 'teyze'], note: 'Şişeyi geri al, depozito var. Martılar da şişe topluyor, rakip.' },
  { id: 'kolaz', name: 'Buzlu Kolaz', station: 'gazoz', fam: 'gazoz', x: 1, veg: true, cold: true, open: {}, brand: 'kolaz', story: 'Fıs\'ın zıp zıp balonlarıyla meşhur kutu. Açınca Fıs gerçekten zıplıyor gibi geliyor.', likes: ['universiteli', 'taraftar', 'okul'], note: 'Kutuyu sallama. Salladım, Fıs yüzüme zıpladı.' },
  { id: 'limonlu_soda', name: 'Limonlu maden suyu', station: 'gazoz', fam: 'gazoz', x: 1, veg: true, cold: true, open: {}, brand: 'lodos_soda', story: 'Ağır yemeğin ardından bir Lodos. Mideye rüzgar gibi eser.', likes: ['isinsani', 'emekli', 'plaza'], note: 'Dürüm yiyene soda öner. Teşekkür eder, bana değil midesine.' },
  { id: 'narli_soda', name: 'Narlı maden suyu', station: 'gazoz', fam: 'gazoz', x: 1.1, veg: true, cold: true, open: { tier: 2 }, brand: 'narcicek', story: 'Nare\'nin taneleri sodanın içinde dans eder. Pembe kabarcıklar, tatlı ekşi.', likes: ['balayi', 'vlogcu'], note: 'Narlı soda pembe. Erkekler de içer, korkmasın.' },
  { id: 'kolaz_sifir', name: 'Kolaz Sıfır Dert', station: 'gazoz', fam: 'gazoz', x: 1.1, veg: true, cold: true, open: { tier: 2 }, brand: 'kolaz', story: 'Şekeri yok, derdi yok, Fıs yine zıplıyor. Plaza çalışanlarının öğle arası yarenliği.', likes: ['plaza', 'isinsani'], note: 'Sıfır dert yazıyor ama dert sıfır olmuyor. Şikayet ettim, Fıs güldü.' },
  { id: 'mandalinali_gazoz', name: 'Mandalinalı Boğaz Gazozu', station: 'gazoz', fam: 'gazoz', x: 1.15, veg: true, cold: true, open: { tier: 3 }, brand: 'bogaz_gazozu', story: 'Kışın en turuncu gazozu. Kokusu açılınca bütün kuyruk dönüp bakar.', likes: ['okul', 'bebekarabali'], note: 'Mandalina kabuğunu kokla, mutluluk bedava.' },
  { id: 'portakal_suyu', name: 'Taze sıkma portakal', station: 'gazoz', fam: 'soguk', x: 1.6, veg: true, cold: true, open: { stage: 2 }, story: 'Seyyar sıkacakta göz önünde sıkılır. Kolu çevirmek ayrı bir gösteri.', likes: ['kruvaziyer', 'vlogcu', 'balayi'], note: 'Sıkacağın kolunu ritimle çevir. Turistler video çekiyor, ben dans ediyorum.' },
  { id: 'nar_suyu', name: 'Taze sıkma nar', station: 'gazoz', fam: 'soguk', x: 1.8, veg: true, cold: true, open: { stage: 3 }, brand: 'narcicek', story: 'Kırmızı, ekşi, şifalı. Sıkarken önlüğe sıçrar, önlük de artık nar çiçeği.', likes: ['teyze', 'gezgin', 'turgrubu'], note: 'Beyaz önlükle nar sıkma. Bunu da tecrübeyle yazıyorum.' },

  // ───────── Gezgin Aşçı (yiyecek-4, yiyecek-5): her hafta bir bölgeden konuk tarif ─────────
  { id: 'hamsili_ekmek', name: 'Karadeniz usulü hamsili ekmek', station: 'tost', fam: 'deniz', x: 1.6, how: 'gezgin', region: 'Karadeniz', open: {}, story: 'Mısır unlu ekmeğin arasında hamsiler sıra sıra dizilir. Gezgin Aşçı Temel Usta getirdi, horon da öğretti.', likes: ['oltaci', 'gezgin', 'emekli'], note: 'Hamsiler kuyrukları birbirine bakacak şekilde. Kavga etmesinler.' },
  { id: 'fistikli_katmer', name: 'Antep usulü fıstıklı katmer', station: 'simit', fam: 'tatli', x: 1.7, veg: true, how: 'gezgin', region: 'Güneydoğu', open: {}, story: 'İncecik açılmış hamur, kaymak ve bol fıstık. Usta hamuru havada döndürürken martılar bile durdu.', likes: ['balayi', 'teyze', 'vlogcu'], note: 'Hamuru havada çevirmeyi denedim. Hamur tentede, ben yerde.' },
  { id: 'boyoz', name: 'İzmir boyozu ve yumurta', station: 'simit', fam: 'hamur', x: 1.5, veg: true, how: 'gezgin', region: 'Ege', open: {}, story: 'Çıtır çıtır kat kat boyoz, yanında haşlanmış yumurta. Kordon sabahının İstanbul misafiri.', likes: ['emekli', 'plaza', 'turgrubu'], note: 'Yumurtayı boyozun yanına koy, üstüne değil. Ege usulü böyle.' },
  { id: 'cag_durum', name: 'Erzurum usulü cağ dürüm', station: 'doner', fam: 'durum', x: 1.7, how: 'gezgin', region: 'Doğu', open: {}, story: 'Yatay şişte dönen kuzu, şişle birlikte gelir. Usta "acele eden lavaşı yakar" dedi.', likes: ['hamal', 'taksici', 'isinsani'], note: 'Şişi müşteriye uzatırken dikkat. Kılıç değil, yemek.' },
  { id: 'kayseri_manti', name: 'Kayseri usulü kapta mantı', station: 'doner', fam: 'seyyar', x: 1.6, how: 'gezgin', region: 'İç Anadolu', open: {}, story: 'Bir kaşığa kırk mantı sığar. Yoğurt, tereyağı, nane, sumak. Usta mantıları tek tek saydı, biz saymadık.', likes: ['teyze', 'emekli', 'bebekarabali'], note: 'Mantı küçük olacak. Büyük mantı, mantı değil, gözleme.' },
  { id: 'cig_borek', name: 'Eskişehir usulü çiğ börek', station: 'tost', fam: 'hamur', x: 1.5, how: 'gezgin', region: 'İç Anadolu', open: {}, story: 'Kızgın yağda kabaran yarım ay. İçindeki kıymanın suyu ilk ısırıkta gömleğe atlar.', likes: ['universiteli', 'taksici', 'gecekusu'], note: 'İlk ısırık dikkatli. Gömleğimdeki leke bunun hatırası.' },

  // ───────── Deney Tezgahı keşifleri (tarif-8) ─────────
  { id: 'simit_tost', name: 'Simit tost', station: 'tost', fam: 'ekmek', x: 1.45, veg: true, how: 'deney', open: {}, story: 'Simidi ikiye böl, kaşar ve domates koy, makineye bas. Sabri\'nin ilk deneyi, ilk zaferi.', likes: ['okul', 'universiteli', 'vapuryolcusu'], note: 'Simit tost buluşu bende. Patenti martıya verdim, o da yedi.' },
  { id: 'cacikli_ayran', name: 'Naneli salatalıklı ayran', station: 'ayran', fam: 'soguk', x: 1.35, veg: true, cold: true, how: 'deney', open: {}, story: 'Ayran, nane, rendelenmiş salatalık. Yarısı içecek, yarısı salata, tamamı serinlik.', likes: ['hamal', 'gezgin'], note: 'Kaşıkla mı içilir, pipetle mi? Hâlâ karar veremedim.' },
  { id: 'kis_cayi', name: 'Portakal kabuklu kış çayı', station: 'cay', fam: 'sicak', x: 1.4, veg: true, hot: true, how: 'deney', open: {}, story: 'Demli çaya tarçın çubuğu ve portakal kabuğu. Kokusu iskeleyi sarınca vapur bile yavaşlar.', likes: ['emekli', 'teyze', 'balayi'], note: 'Tarçın çubuğu karıştırmak için. Yeme, ben yedim, odun gibi.' },
  { id: 'kasarli_sucuklu_durum', name: 'Sucuklu kaşarlı dürüm', station: 'doner', fam: 'durum', x: 1.4, how: 'deney', open: {}, story: 'Lavaşın içinde kaşar ve sucuk, tost makinesinde değil şişin yanında kızarır. Öğrencilerin gizli aşkı.', likes: ['universiteli', 'taraftar', 'gecekusu'], note: 'Bunu tost istasyonuna söyleme. Kıskanır.' },
  { id: 'simit_dondurma', name: 'Simit arası dondurma', station: 'ayran', fam: 'tatli', x: 1.5, how: 'deney', open: {}, story: 'Sıcak simidin arasına dondurma. Sıcak soğuk kavgası ağızda barışla biter.', likes: ['okul', 'vlogcu', 'kruvaziyer'], note: 'Hızlı ye. Yavaş yersen dondurma simidi terk eder.' },
  { id: 'nar_fissi', name: 'Naneli Nar Fıssı', station: 'gazoz', fam: 'gazoz', x: 1.35, veg: true, cold: true, how: 'deney', open: {}, story: 'Gazoz, taze nar, birkaç nane yaprağı. Fıs ile Nare\'nin ortak şarkısı gibi.', likes: ['balayi', 'universiteli'], note: 'Fıs ve Nare bu tarifte barıştı. Reklamcılar ağladı.' },
  { id: 'tahinli_pekmezli_simit', name: 'Tahinli pekmezli simit', station: 'simit', fam: 'hamur', x: 1.35, veg: true, how: 'deney', open: {}, story: 'Simit tahine banılır, pekmezle taçlanır. Kış sabahının enerji çubuğu.', likes: ['emekli', 'hamal', 'teyze'], note: 'Tahin damlatma, pekmez damlatma. Ben ikisini de damlattım, önlüğüm tatlı oldu.' },

  // ───────── Ay Mutfağı (yiyecek-11): ileride, Ay şubesinde ─────────
  { id: 'yercekimsiz_durum', name: 'Yerçekimsiz Dürüm', station: 'doner', fam: 'ay', x: 3, how: 'ay', open: {}, story: 'Tabaktan havalanır, ağzına kendisi uçar. Lavaşı kaçmasın diye iple bağlanır.', likes: [], note: 'Ay\'da sos yukarı akıyor. Peçeteyi tavana as.' },
  { id: 'krater_simidi', name: 'Krater Simidi', station: 'simit', fam: 'ay', x: 3, veg: true, how: 'ay', open: {}, story: 'Delikleri ay kraterleri gibi, susamları yıldız gibi. Bir ısırıkta küçük bir adım.', likes: [], note: 'Kraterleri sayma, bin tane var. Saydım.' },
  { id: 'meteor_kofte', name: 'Meteor Köfte', station: 'doner', fam: 'ay', x: 3, how: 'ay', open: {}, story: 'Dumanı tüten, sıcak sıcak, gökten düşmüş gibi. Tabağa inerken küçük bir krater açar.', likes: [], note: 'Köfteyi tabağa yavaş indir. Hızlı inerse masa kalmaz.' },
  { id: 'astronot_tostu', name: 'Astronot Tostu', station: 'tost', fam: 'ay', x: 3, veg: true, how: 'ay', open: {}, story: 'Tüpten sıkılan kaşarlı tost. Kıvamı tost, şekli diş macunu.', likes: [], note: 'Diş macunuyla karıştırma. Karıştırdım, ağzım ferah oldu ama.' },
  { id: 'dolunay_coregi', name: 'Dolunay Çöreği', station: 'simit', fam: 'ay', x: 3, veg: true, how: 'ay', open: {}, story: 'Gece parlar, gündüz uyur. Karanlıkta tezgahın lambası olur.', likes: [], note: 'Çöreği gece sat. Gündüz kimse parladığını görmüyor, üzülüyor.' },
  { id: 'uydu_midye', name: 'Uydu Midye', station: 'ayran', fam: 'ay', x: 3, how: 'ay', open: {}, story: 'Kabuklar midyenin etrafında uydu gibi döner. Limonu yörüngeden sıkarsın.', likes: [], note: 'Kabukları toplamak için ağ lazım. Kelebek ağı aldım.' },
  // Survey 2026-10-24 (Şart list): tarifs that were still missing from the menu
  { id: 'lahmacun', name: 'Lahmacun', station: 'tost', fam: 'hamur', x: 1.1, open: { stage: 2 }, story: 'İnce hamur, kıymalı harç, bol maydanoz. Sabri lahmacunu tek hamlede açmaya çalışıp iki kere yırtmış.', likes: ['taraftar', 'universiteli', 'hamal'], note: 'Limonunu sıkmadan yeme, tadı kaçar.' },
  { id: 'pide', name: 'Kıymalı pide', station: 'tost', fam: 'hamur', x: 1.2, open: { stage: 2 }, story: 'Kayıktan çıkmış gibi kenarları kıvrık. Ortasına yumurta kırılınca vapurcular bile durur.', likes: ['vapuryolcusu', 'emekli', 'kurye'], note: 'Yumurtayı tam ortada tut, yoksa kayar.' },
  { id: 'cig_kofte', name: 'Çiğ köfte', station: 'tost', fam: 'seyyar', x: 1, veg: true, open: { stage: 2 }, story: 'Bulgur, acı biber salçası, nar ekşisi. Elleri kırmızı bırakan tek yemek.', likes: ['gezgin', 'okul', 'vlogcu'], note: 'Maydanozu bol olsun, Sabri başka türlü kabul etmez.' },
  { id: 'pizza', name: 'Mini pizza', station: 'tost', fam: 'hamur', x: 1.25, duble: true, open: { stage: 3 }, story: 'Kuyruğu dolu bir öğlende ilk sıcak sıcak dilim. Peynir uzayınca herkes gülüyor.', likes: ['okul', 'vlogcu', 'universiteli'], note: 'Fırını beklemeden koyma, alt kısmı hamur kalır.' },
  { id: 'nugget', name: 'Tavuk nugget', station: 'tost', fam: 'seyyar', x: 1.1, open: { stage: 2 }, story: 'Çocuklar için yapılmış ama emekliler de ilk sırada.', likes: ['okul', 'teyze', 'emekli'], note: 'Çıtırlığı için iki kere kızdır.' },
  { id: 'sushi', name: 'Sushi tabağı', station: 'tost', fam: 'deniz', x: 1.4, open: { stage: 4 }, story: 'Boğaz’ın ortasında pirinçle balık. Sabri ilk denemede pirinci haşlamış, ikinci denemede tutmuş.', likes: ['plaza', 'universiteli', 'kruvaziyer'], note: 'Pirinç ılık olsun, soğuksa kaymaz.' },
  { id: 'tulumba', name: 'Tulumba', station: 'simit', fam: 'tatli', x: 1.2, open: { stage: 2 }, story: 'Şerbetin içinde yüzen çıtır borular. Parmak yalamak serbest.', likes: ['teyze', 'emekli', 'bebekarabali'], note: 'Şerbet soğuk, tulumba sıcak olmalı. Bu kural.' },
  { id: 'sutlac', name: 'Fırın sütlaç', station: 'simit', fam: 'tatli', x: 1.15, open: { stage: 3 }, story: 'Üstü kızarmış, altı yumuşacık. Bayram sabahı ilk bu gider.', likes: ['teyze', 'emekli', 'bebekarabali'], note: 'Tarçını sonra koy, yoksa kabuk kahverengiye döner.' },
  { id: 'baklava', name: 'Baklava dilimi', station: 'simit', fam: 'tatli', x: 1.35, open: { stage: 3 }, story: 'Yüz yaprak hamur, bir avuç fıstık. Sabri her kat için bir dilek tutuyor.', likes: ['kruvaziyer', 'taksici', 'teyze'], note: 'Şerbeti kısık tut, hamur ıslanmasın.' },
  { id: 'waffle', name: 'Çikolatalı waffle', station: 'simit', fam: 'tatli', x: 1.3, open: { stage: 3 }, story: 'Kafesli kalıptan çıkınca altın renginde. Üstüne bal, muz, çikolata, ne istersen.', likes: ['okul', 'vlogcu', 'bebekarabali'], note: 'Kalıbı yağlamayı unutma, ilk ikisi yapışır.' },
  { id: 'salep', name: 'Salep', station: 'cay', fam: 'sicak', x: 1.2, veg: true, open: { stage: 2 }, story: 'Kışın tek sıcak içecek. Tarçın kokusu vapur iskelesine kadar gider.', likes: ['emekli', 'gecekusu', 'bebekarabali'], note: 'Sütü kaynatırken karıştır, yoksa topaklanır.', cold: false },
  { id: 'corba', name: 'Mercimek çorbası', station: 'cay', fam: 'sicak', x: 1.1, veg: true, open: { stage: 2 }, story: 'Limon, pul biber, kıtır ekmek. Soğuk gün, kuyruk, bir kâse: Sabri’nin ilk kışı böyle geçti.', likes: ['hamal', 'emekli', 'isinsani'], note: 'Limonu en son sık, yoksa çorba ekşir.' },
  { id: 'tavuk_doner_porsiyon', name: 'Tavuk döner porsiyon', station: 'doner', fam: 'sicak', x: 1.2, open: { stage: 2 }, story: 'Ekmeksiz, pilavsız, sadece tabak. Diyetteki müşteri bile iki kere istiyor.', likes: ['plaza', 'emekli', 'taksici'], note: 'Ateşi biraz kısık tut, tavuk kurumasın.' },
  { id: 'patates_kizartma', name: 'Patates kızartması', station: 'tost', fam: 'seyyar', x: 1.1, veg: true, open: { stage: 2 }, story: 'Kağıt koninin içinde, üstünde tuz. Kuyrukta en çok bu koku yayılıyor.', likes: ['okul', 'taraftar', 'vlogcu'], note: 'İki kere kızdır, ilki yağı ısıtır.' },
  { id: 'gozleme', name: 'Peynirli gözleme', station: 'tost', fam: 'hamur', x: 1.15, veg: true, open: { stage: 2 }, story: 'Yufka sacın üstünde kabarır, peynir içeride erir. Teyzeler bunu sabahın körü yapar.', likes: ['teyze', 'emekli', 'gezgin'], note: 'Yufkayı iki kere çevir, bir kere değil.' },
  { id: 'patlamis_misir', name: 'Patlamış mısır', station: 'simit', fam: 'seyyar', x: 1, veg: true, open: { stage: 2 }, story: 'Kutusu dolup taşan, tuzlu ya da karamelli. Vapurdan inen çocuklar hep bunu ister.', likes: ['okul', 'bebekarabali', 'vapuryolcusu'], note: 'Tencere kapağını aralık bırak, mısır sekiyor.' },
  { id: 'kek_dilim', name: 'Ev yapımı kek', station: 'simit', fam: 'tatli', x: 1.1, veg: true, open: { stage: 2 }, story: 'Limonlu, yağlı, her dilimde biraz da Sabri’nin annesinden kalma bir ses.', likes: ['teyze', 'okul', 'bebekarabali'], note: 'Fırından çıkınca bir gün dinlendir, kesmesi kolay olur.' },
  { id: 'tavuk_pilav', name: 'Tavuk pilav', station: 'tost', fam: 'sicak', x: 1.2, open: { stage: 2 }, story: 'Tencerede kalmış pilav, üstünde tavuk, yanında turşu. İşçi öğününün kralı.', likes: ['hamal', 'isinsani', 'emekli'], note: 'Pilavı tencerede bırakma, dibi tutar.' },
];

export const TARIF_BY_ID: Record<string, TarifDef> = Object.fromEntries(TARIFLER.map(t => [t.id, t]));
/** Menu tarifs (counted toward "60 at launch": temel + gezgin + deney). */
export const MENU_TARIFLER = TARIFLER.filter(t => t.how !== 'ay');
export const AY_TARIFLER = TARIFLER.filter(t => t.how === 'ay');
export const GEZGIN_ORDER = ['hamsili_ekmek', 'fistikli_katmer', 'boyoz', 'cag_durum', 'kayseri_manti', 'cig_borek'];

/** Customers ask for a tarif by name with this chance per ordered product (if one is unlocked for that station). */
export const TARIF_ASK = 0.45;
/** 'Duble olsun!' chance when the asked tarif allows duble (pays the tarif price once more). */
export const DUBLE_ASK = 0.18;
/** Weight boost when the tarif is liked by the customer's type / when it is Gezgin Aşçı's week special. */
export const LIKE_W = 3, GEZGIN_W = 4;
/** Hot drinks in winter, cold in summer (icecek-6): weight factor. */
export const SEASON_W = 2.2;
/** Cost to learn the visiting Gezgin Aşçı recipe for good: base x this (base = station unit price). Free after GEZGIN_FREE_N sales of it. */
export const GEZGIN_LEARN_X = 60, GEZGIN_FREE_N = 12;

export const ASK_LINES = ['Bir {t} lütfen!', '{t} var mı? Ondan alayım!', 'Bana {t} olsun usta!', 'Canım {t} çekti!', '{t}, tam istediğim!'];
export const DUBLE_LINE = ' Duble olsun!';
export const TARIF_THANKS = ['Tam kıvamında!', 'Eline sağlık usta, efsane!', 'Bu tarif kimin? Helal!', 'Bunu annem bile böyle yapamaz!'];

/** Freshness line (tarif-4): seconds on the counter before an item gets stale (sold at STALE_X), and before a cat takes it. */
export const STALE_S = 120, CAT_S = 200, STALE_X = 0.6;
/** Station products that go stale on the counter (bottled drinks do not). */
export const FRESH_PRODUCTS: ProductId[] = ['doner', 'tost', 'simit', 'cay'];
export const STALE_TOAST = 'Tezgahta bayatlayan var: ucuza gidiyor.';
export const CAT_LINES = ['Pamuk bayat {p} kaptı. Çöp yok, kedi tok!', 'Mahallenin kedileri bayat {p} ile ziyafet çekti.', 'Bir kedi bayat {p} alıp tentenin üstüne çıktı. Mutlu.'];

/** Çay ustalığı (icecek-1, icecek-2): sold çay thresholds, names and extra on çay sales. */
export const CAY_USTA = [
  { n: 0, name: 'Çırak demlik', pct: 0, line: 'Tek demlik, ocakta bekliyor.' },
  { n: 40, name: 'Kalfa demlik', pct: 0.02, line: 'İki katlı demlik geldi, ara sıra taze demleme.' },
  { n: 160, name: 'Usta demlik', pct: 0.04, line: 'Bakır demlik, çay hep taze.' },
  { n: 500, name: 'Tavşan kanı', pct: 0.06, line: 'En üst kademe: tavşan kanı, ince belli bardak, cam tabak.' },
];
export const TAZE_DEMLEME_S = 200;
export const TAZE_DEMLEME_TOAST = 'Taze demleme! Çay kokusu iskeleyi sardı, bahşişler biraz artıyor.';

// ───────── Deney Tezgahı (tarif-8) ─────────
export interface Malzeme { id: string; name: string; color: string; }
export const MALZEMELER: Malzeme[] = [
  { id: 'lavas', name: 'Lavaş', color: '#f2d39b' }, { id: 'ekmek', name: 'Ekmek', color: '#d9a35f' }, { id: 'simit', name: 'Simit', color: '#b5733a' },
  { id: 'kasar', name: 'Kaşar', color: '#f4c542' }, { id: 'sucuk', name: 'Sucuk', color: '#b5432f' }, { id: 'domates', name: 'Domates', color: '#e0533c' },
  { id: 'salatalik', name: 'Salatalık', color: '#6bb36b' }, { id: 'nane', name: 'Nane', color: '#3f9b5a' }, { id: 'tarcin', name: 'Tarçın', color: '#8a5530' },
  { id: 'portakal', name: 'Portakal', color: '#f29a2e' }, { id: 'nar', name: 'Nar', color: '#c0304a' }, { id: 'tahin', name: 'Tahin', color: '#d8c19a' },
  { id: 'pekmez', name: 'Pekmez', color: '#5a2f1e' }, { id: 'dondurma', name: 'Dondurma', color: '#fbe7e9' }, { id: 'cay', name: 'Çay', color: '#a3361f' },
  { id: 'ayran', name: 'Ayran', color: '#f7f7f2' }, { id: 'gazoz', name: 'Gazoz', color: '#9fd8e8' },
];
/** Sorted ingredient ids joined with '+' -> tarif id. */
export const DENEY_TARIFLERI: Record<string, string> = {
  'domates+kasar+simit': 'simit_tost',
  'ayran+nane+salatalik': 'cacikli_ayran',
  'cay+portakal+tarcin': 'kis_cayi',
  'kasar+lavas+sucuk': 'kasarli_sucuklu_durum',
  'dondurma+simit': 'simit_dondurma',
  'gazoz+nane+nar': 'nar_fissi',
  'pekmez+simit+tahin': 'tahinli_pekmezli_simit',
};
/** Hints shown in the Deney Tezgahı (one per undiscovered recipe, no full answer). */
export const DENEY_IPUCU: Record<string, string> = {
  simit_tost: 'Simit tost makinesine girse ne olurdu? Yanına iki arkadaş lazım.',
  cacikli_ayran: 'Ayran bahçeye gitse yanında hangi yeşillikler olurdu?',
  kis_cayi: 'Çaya kış kokusu verecek iki şey düşün.',
  kasarli_sucuklu_durum: 'Tostun malzemeleri lavaşa taşınsa?',
  simit_dondurma: 'Sıcak bir halka ile soğuk bir tatlı. Sadece ikisi.',
  nar_fissi: 'Fıs ile Nare barışsa, araya bir de yeşil yaprak girse?',
  tahinli_pekmezli_simit: 'Kış kahvaltısının iki tatlı yapışkanı ve bir halka.',
};
/** Comic failures (picked by a hash of the combination, so the same mix always gives the same line). */
export const DENEY_FAIL = [
  '{m}... Martılar bile yüz çevirdi.',
  '{m} karıştı, tezgahta bir köpük canavarı doğdu. Pamuk kaçtı.',
  '{m}! Tadına bakan Zeki üç dakika konuşamadı.',
  '{m} oldu mu? Olmadı. Ama renk güzel, fotoğrafını çektim.',
  '{m} denemesi bitti. Önlük yıkamaya gitti.',
  '{m}: Hüsnü Usta "bunu fırına sokma" dedi. Haklı.',
  '{m}. Kaptan Nevzat bile "bu rotada fırtına var" dedi.',
  '{m} bardağa koydum, bardak çatladı gibi baktı bana.',
];
/** Free experiments per game day; then each costs DENEY_COST (small, earnable). */
export const DENEY_FREE = 3, DENEY_COST = 60;
