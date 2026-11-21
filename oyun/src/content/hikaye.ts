/**
 * Hikaye, görevler, rakipler ve karakterli öğreticiler (survey hikaye-1..7, kontrol-7, zincir-1..8). Pure data.
 * - CHAPTERS: each place is a chapter with 3 main quests and a finale scene (30-45 s, skippable, portrait bubbles).
 * - Scenes: lines are [speaker, text]; a word wrapped in *stars* is the key word (shown bold and voiced).
 * - ABSURD: small absurd breaks that happen once on a given day (5-10 s moments).
 * - RIVALS / RIVAL_ACTIONS: invented chains, their corporate-parody lines, actions and late transformations.
 * - TUTORS: when a system unlocks, a familiar character shows it in about 10 s (skippable, replayable in the Defter).
 * All names and brands invented (CONTRACT list). No "zam", no em-dashes, no real people.
 */

export type SpeakerId =
  | 'sabri' | 'pamuk' | 'huesnu' | 'hayriye' | 'sevket' | 'zeki' | 'kemal' | 'ayten' | 'kaptan' | 'muhtar' | 'radyo'
  | 'plaza' | 'burgatron' | 'gevrek' | 'kopuk' | 'tavuk' | 'dron' | 'kokorec' | 'borek' | 'uzayli' | 'casus';

export interface Speaker { name: string; skin: string; shirt: string; hat: string; accent: string }
/** Portrait look for each speaker (drawn as tiny code-made SVG faces by the scene overlay). */
export const SPEAKERS: Record<SpeakerId, Speaker> = {
  sabri: { name: 'Sabri', skin: '#f1c39a', shirt: '#e0533c', hat: 'kasket', accent: '#e0533c' },
  pamuk: { name: 'Pamuk', skin: '#f7f3ea', shirt: '#f7f3ea', hat: 'kedi', accent: '#f2a2b3' },
  huesnu: { name: 'Fırıncı Hüsnü', skin: '#f1c9a0', shirt: '#f6efe1', hat: 'asci', accent: '#d9822b' },
  hayriye: { name: 'Manav Hayriye Abla', skin: '#e9b993', shirt: '#5a9a4b', hat: 'esarp', accent: '#c94f6d' },
  sevket: { name: 'Berber Şevket', skin: '#e6b48c', shirt: '#e9e4da', hat: 'biyik', accent: '#6b6b6b' },
  zeki: { name: 'Kuruyemişçi Zeki', skin: '#d9a77c', shirt: '#7a4e2d', hat: 'bere', accent: '#2e4a6b' },
  kemal: { name: 'Balıkçı Kemal', skin: '#c99068', shirt: '#2f6f9a', hat: 'yagmurluk', accent: '#e8b23a' },
  ayten: { name: 'Bisikletçi Ayten', skin: '#eebd96', shirt: '#3a8a6e', hat: 'kask', accent: '#7a3a2a' },
  kaptan: { name: 'Vapur Kaptanı', skin: '#ffffff', shirt: '#22344f', hat: 'kaptan', accent: '#e8b23a' },
  muhtar: { name: 'Muhtar Rüstem', skin: '#e0b088', shirt: '#6b5a8a', hat: 'gozluk', accent: '#6b5a8a' },
  radyo: { name: 'Martı FM', skin: '#ffd23f', shirt: '#2f7fb3', hat: 'radyo', accent: '#2f7fb3' },
  plaza: { name: 'Genel Müdür Plazaoğlu', skin: '#efc6a0', shirt: '#2b2b38', hat: 'kravat', accent: '#d23b3b' },
  burgatron: { name: 'Burgatron', skin: '#b9c3cc', shirt: '#d23b3b', hat: 'robot', accent: '#d23b3b' },
  gevrek: { name: 'Sürat Bey (Gevrek Express)', skin: '#e8b48a', shirt: '#e8a12a', hat: 'kask', accent: '#e8a12a' },
  kopuk: { name: 'Barista Lal (Köpük Kulesi)', skin: '#f0c8a4', shirt: '#6b4a8a', hat: 'bere', accent: '#b07ad6' },
  tavuk: { name: 'Kanat Bey (Tavuk Tekeli)', skin: '#e9b993', shirt: '#f2d14a', hat: 'ibik', accent: '#e0533c' },
  dron: { name: 'Dron-3 (Uçan Paket)', skin: '#cfd8df', shirt: '#4a9bc4', hat: 'pervane', accent: '#4a9bc4' },
  kokorec: { name: 'Üç Kardeş Kokoreç', skin: '#d9a77c', shirt: '#8a3a2a', hat: 'biyik', accent: '#8a3a2a' },
  borek: { name: 'Dede Usulü Börek', skin: '#e9c4a0', shirt: '#f6efe1', hat: 'takke', accent: '#c2a35a' },
  uzayli: { name: 'Uzaylı Gurme Zıppo', skin: '#9fe08a', shirt: '#5a4a9a', hat: 'anten', accent: '#9fe08a' },
  casus: { name: 'Şüpheli Müşteri', skin: '#e2b48e', shirt: '#4a4a4a', hat: 'gozluk', accent: '#4a4a4a' },
};

export type Line = readonly [SpeakerId, string];
export type SceneKind = 'finale' | 'ara' | 'absurt' | 'ogretici' | 'rakip';
export interface SceneDef { id: string; title: string; kind: SceneKind; lines: readonly Line[]; icon?: string }

/** Quest goal: delta of a stat since the chapter began, or an absolute threshold. */
export type Goal =
  | { t: 'stat'; k: string; n: number }
  | { t: 'earned'; n: number }
  | { t: 'level'; n: number }
  | { t: 'stage'; n: number }
  | { t: 'workers'; n: number }
  | { t: 'owned'; k: string };
export interface QuestDef { id: string; title: string; giver: SpeakerId; text: string; goal: Goal; start: string; done: string }
export interface ChapterDef { id: string; n: number; place: string; title: string; blurb: string; quests: readonly [QuestDef, QuestDef, QuestDef]; finale: SceneDef; rewardMin: number; gold: number }

export const CHAPTERS: readonly ChapterDef[] = [
  {
    id: 'iskele', n: 1, place: 'Martıköy İskelesi', title: 'Büfenin Açılışı', blurb: 'Sabri iskelede ilk tostunu basar. Martılar şüpheyle izler.', rewardMin: 3, gold: 1,
    quests: [
      { id: 'iskele-1', title: 'İlk 20 müşteri', giver: 'pamuk', text: '20 müşteriye servis yap.', goal: { t: 'stat', k: 'served', n: 20 }, start: 'Miyav. (Tercüme: 20 müşteri doyur, sonra beni doyur.)', done: 'Pamuk onaylar gibi kuyruğunu salladı. Ya da sinek kovaladı.' },
      { id: 'iskele-2', title: 'Demlik yansın', giver: 'zeki', text: 'Çay ocağını kur.', goal: { t: 'owned', k: 'cay' }, start: 'Çaysız iskele, tuzsuz leblebi gibi Sabri. Bir ocak kur!', done: 'İşte bu! Çay kokusu çarşıya kadar geldi.' },
      { id: 'iskele-3', title: 'Vapuru karşıla', giver: 'kaptan', text: '3 vapur yanaşsın.', goal: { t: 'stat', k: 'ferries', n: 3 }, start: 'Düüüt! Yolcularım aç gelir, hazır ol!', done: 'Düüüt düüt! (Kaptan memnun. Sanırım. Paltosu kıpırdadı.)' },
    ],
    finale: { id: 'final-iskele', title: 'İskelenin Yıldızı', kind: 'finale', icon: 'radyo', lines: [
      ['radyo', "Martı FM'den canlı yayın! İskelenin yeni yıldızı Sabri'nin büfesindeyiz!"],
      ['sabri', 'Ben mi? Yıldız mı? Abla, ben sadece tost basıyorum.'],
      ['pamuk', 'Miyav. (Tercüme: Yıldız benim, o sadece aşçım.)'],
      ['radyo', 'Peki büfenin *sırrı* ne Sabri?'],
      ['sabri', 'Sevgi, demli çay ve biraz da martılara karşı sabır.'],
      ['plaza', 'Ehem. Plaza Burger Holding olarak bu yayını izliyoruz.'],
      ['burgatron', 'BİP. RAKİP TESPİT EDİLDİ. GÜLÜMSEME PROTOKOLÜ: HA. HA. HA.'],
      ['plaza', 'Martıköy bizim yeni pazarımız olacak. Toplantıda kararlaştırdık.'],
      ['sabri', 'Gel bir çay iç, sonra karar verirsin.'],
      ['radyo', 'Gerilim tırmanıyor dinleyiciler! Bölüm 1 burada biter. *Çay* soğumasın!'],
    ] },
  },
  {
    id: 'carsi', n: 2, place: 'Çarşı Sokağı', title: 'Komşular', blurb: 'İskelenin ucundan çarşıya yol açılır. Her dükkanın bir derdi var.', rewardMin: 4, gold: 1,
    quests: [
      { id: 'carsi-1', title: 'Esnaf Seviyesi 3', giver: 'huesnu', text: 'Esnaf Seviyesi 3 ol.', goal: { t: 'level', n: 3 }, start: 'Çarşıda sözün geçsin istiyorsan biraz pişmen lazım. Simit gibi.', done: 'Hah, artık çarşının hamuru oldun!' },
      { id: 'carsi-2', title: 'İlk yardımcı', giver: 'sevket', text: 'Bir işçi işe al.', goal: { t: 'workers', n: 1 }, start: 'Tek başına koşturma Sabri, saçın dökülür. Ben bilirim.', done: 'Ekip kuruldu! Saçların kurtuldu.' },
      { id: 'carsi-3', title: '100 servis', giver: 'hayriye', text: '100 müşteriye servis yap.', goal: { t: 'stat', k: 'served', n: 100 }, start: 'Domatesim gibi kızar, ama çalış evladım. 100 müşteri!', done: 'Maşallah! Sana iki domates, bir de dua.' },
    ],
    finale: { id: 'final-carsi', title: 'İlk Esnaf Çayı', kind: 'finale', icon: 'cay', lines: [
      ['huesnu', 'Akşam oldu, kepenkler iniyor. Esnaf çayına buyur Sabri!'],
      ['hayriye', 'Ben kurabiye getirdim. Domatesli. Deneme aşamasında.'],
      ['zeki', 'Ben de leblebi. Klasik. Risk yok.'],
      ['gevrek', 'Pardon! Gevrek Express olarak 47 saniyede simit teslim ediyoruz!'],
      ['huesnu', 'Benim simitim daha *çıtır*! 47 saniyede çıtırlık olmaz evlat.'],
      ['gevrek', 'Hız bizim değerimiz. Çıtırlık için toplantı ayarlayalım.'],
      ['sevket', 'Toplantıya gelirken saçını da tarat bari.'],
      ['sabri', 'Arkadaşlar, çay soğuyor. Sürat Bey, sen de otur.'],
      ['gevrek', 'Oturmak... verimlilik kaybı ama... bu çay çok güzelmiş.'],
      ['pamuk', 'Miyav. (Tercüme: Kurabiyeyi ben yedim, domatesli değildi.)'],
    ] },
  },
  {
    id: 'meydan', n: 3, place: 'Meydan', title: 'Büyük Meydan', blurb: 'Meydanda kalabalık büyür, Köpük Kulesi karşıya dükkan açar.', rewardMin: 5, gold: 1,
    quests: [
      { id: 'meydan-1', title: 'Büfe büyüsün', giver: 'muhtar', text: 'Büfeyi 2. aşamaya büyüt (tadilat).', goal: { t: 'stage', n: 2 }, start: 'Meydana yakışır bir büfe istiyorum. Mühürlü ricamdır.', done: 'Mührümü bastım! Pardon, yanlışlıkla tostuna bastım.' },
      { id: 'meydan-2', title: 'Kasa dolsun', giver: 'zeki', text: '3.000 ₺ kazan.', goal: { t: 'earned', n: 3000 }, start: 'Para leblebi gibidir, tane tane birikir.', done: 'Bak gördün mü, bir avuç oldu!' },
      { id: 'meydan-3', title: 'Bahşiş sanatı', giver: 'ayten', text: '15 bahşiş al.', goal: { t: 'stat', k: 'tips', n: 15 }, start: 'Güler yüz pedal gibidir, çevirdikçe gider.', done: 'Zil zil! Müşteriler seni seviyor.' },
    ],
    finale: { id: 'final-meydan', title: 'Köpük Kulesi Geldi', kind: 'finale', icon: 'kahve', lines: [
      ['kopuk', 'Merhaba Martıköy! Köpük Kulesi açıldı. Kahvemizin adı: Bulutsu Karamel Rüya Deluxe.'],
      ['sabri', 'Ne kadar uzun bir isim. Biz buna çay deriz.'],
      ['kopuk', 'Her bardağa müşterinin adını yazıyoruz. Yanlış yazmak geleneğimiz.'],
      ['zeki', 'Benim adımı "Zekeriyya Bey Pastası" yazdılar.'],
      ['hayriye', 'Benimkine "Hayriye Abla" değil "Hay Rüya" yazmışlar. Beğendim aslında.'],
      ['kopuk', 'Sabri Bey, sizin çaya *köpük* koysak?'],
      ['sabri', 'Çaya köpük mü? O zaman ayran olur.'],
      ['kopuk', 'Ayran... köpüklü... Yöneticime soracağım. Bu bir devrim olabilir.'],
      ['pamuk', 'Miyav. (Tercüme: Köpüğü ben yalarım, sorun yok.)'],
    ] },
  },
  {
    id: 'barinak', n: 4, place: 'Balıkçı Barınağı', title: 'Tekneler ve Teller', blurb: 'Balıkçı Kemal ağlarını açar, Tavuk Tekeli ise her şeyi tavuklaştırmak ister.', rewardMin: 6, gold: 1,
    quests: [
      { id: 'barinak-1', title: 'Esnaf Seviyesi 6', giver: 'kemal', text: 'Esnaf Seviyesi 6 ol.', goal: { t: 'level', n: 6 }, start: 'Deniz sabır ister, büfe de öyle. Biraz daha usta ol.', done: 'Rast gele Sabri! Artık sen de denizin adamısın.' },
      { id: 'barinak-2', title: 'Paketler yola', giver: 'ayten', text: '8 kurye teslimatı yap.', goal: { t: 'stat', k: 'kuryeTeslim', n: 8 }, start: 'PaketMartı siparişleri yağıyor, pedallar hazır!', done: 'Zincir yağlandı, paketler uçtu!' },
      { id: 'barinak-3', title: 'Pırıl pırıl', giver: 'hayriye', text: '25 masa temizle.', goal: { t: 'stat', k: 'cleaned', n: 25 }, start: 'Temiz masa, güzel sohbet getirir evladım.', done: 'Masalar ayna gibi! Kendimi gördüm, saçım iyiymiş.' },
    ],
    finale: { id: 'final-barinak', title: 'Her Şey Tavuk', kind: 'finale', icon: 'balik', lines: [
      ['tavuk', 'Tavuk Tekeli A.Ş. olarak duyururuz: Balık artık tavuk aromalı!'],
      ['kemal', 'Balığın kendisi zaten balık aromalı kardeşim.'],
      ['tavuk', 'Vizyonumuz: Dünyada her şey bir gün *tavuk* olacak.'],
      ['sabri', 'Peki ayran?'],
      ['tavuk', 'Tavuk ayran. Ar-Ge aşamasında. Çok gizli.'],
      ['pamuk', 'Miyav! (Tercüme: Tavuk mu dedi? Buradayım.)'],
      ['kemal', 'Bak, kedi bile senden daha iyi pazarlamacı.'],
      ['tavuk', 'Bu kediyi marka yüzü yapalım! Kontratı hazırlayın!'],
      ['pamuk', 'Mrr. (Tercüme: Ücretim günde üç hamsi. Pazarlık yok.)'],
    ] },
  },
  {
    id: 'sahil', n: 5, place: 'Sahil Yolu', title: 'Gökyüzünde Paketler', blurb: 'Uçan Paket dronları sahile iner. Martılar bunu kişisel algılar.', rewardMin: 7, gold: 2,
    quests: [
      { id: 'sahil-1', title: 'Üçüncü aşama', giver: 'muhtar', text: 'Büfeyi 3. aşamaya büyüt.', goal: { t: 'stage', n: 3 }, start: 'Sahil Yolu fotoğraf karesi ister. Büfe büyüsün!', done: 'Vay! Turistler artık büfenin önünde poz veriyor.' },
      { id: 'sahil-2', title: 'Pencere ustası', giver: 'kaptan', text: 'Vapur penceresinden 25 satış yap.', goal: { t: 'stat', k: 'windowSales', n: 25 }, start: 'Düüüt! Pencereden uzat, yolcu kapsın!', done: 'Düüt! (Paltonun içinden alkış sesi geldi. Çok fazla el var gibi.)' },
      { id: 'sahil-3', title: 'Ekip büyüsün', giver: 'sevket', text: '3 işçin olsun.', goal: { t: 'workers', n: 3 }, start: 'Kalabalık ekip, bol sohbet. Benim dükkan gibi.', done: 'Maşallah, takım tamam! Hepsine tıraş benden.' },
    ],
    finale: { id: 'final-sahil', title: 'Martılar Dronlara Karşı', kind: 'finale', icon: 'dron', lines: [
      ['dron', 'VIIIZ. UÇAN PAKET. SİPARİŞİNİZ 3 DAKİKADA KAPINIZDA.'],
      ['sabri', 'Benim kapım yok ki, büfe bu.'],
      ['dron', 'HATA. KAPI BULUNAMADI. PAKETİ DENİZE BIRAKIYORUM.'],
      ['kemal', 'Hop! Tuttum! Tavuk dürüm çıktı, ağımda.'],
      ['pamuk', 'Miyav. (Tercüme: Buna ben bakarım.)'],
      ['dron', 'UYARI. MARTI SÜRÜSÜ YAKLAŞIYOR. MARTI SAYISI: ÇOK.'],
      ['sabri', 'Martılar simit sanıyor seni! Kaç kardeşim, *kaç*!'],
      ['dron', 'VIIIZ! GERİ ÇEKİLİYORUM. MÜŞTERİ MEMNUNİYET ANKETİMİZE KATILIN.'],
      ['ayten', 'Bisiklet yine kazandı. Pedal zinciri, pervaneden sağlamdır.'],
    ] },
  },
  {
    id: 'vapur', n: 6, place: 'Vapur Büfesi', title: 'Kaptanın Sırrı', blurb: 'Vapurun içinde ikinci bir büfe! Ama kaptan neden hiç konuşmuyor?', rewardMin: 8, gold: 2,
    quests: [
      { id: 'vapur-1', title: 'Esnaf Seviyesi 10', giver: 'kaptan', text: 'Esnaf Seviyesi 10 ol.', goal: { t: 'level', n: 10 }, start: 'Düüüt. (Kaptan sana bir kağıt uzattı: "Usta ol, sonra konuşuruz.")', done: 'Düüüt! (Kağıtta artık "Tamam" yazıyor. El yazısı tavuk ayağı gibi. Martı ayağı.)' },
      { id: 'vapur-2', title: 'Sefer sefer', giver: 'kemal', text: '30 vapur yanaşsın.', goal: { t: 'stat', k: 'ferries', n: 30 }, start: 'Her sefer bir hikaye Sabri. 30 hikaye biriktir.', done: 'Otuz sefer! Artık iskelenin efsanesisin.' },
      { id: 'vapur-3', title: 'Büyük kasa', giver: 'zeki', text: '25.000 ₺ kazan.', goal: { t: 'earned', n: 25000 }, start: 'Büyük kasa, büyük leblebi çuvalı gibidir.', done: 'Çuval doldu! Ben de bir çuval leblebi ısmarlarım.' },
    ],
    finale: { id: 'final-vapur', title: 'Paltodaki Martılar', kind: 'finale', icon: 'vapur', lines: [
      ['sabri', 'Kaptanım, aylardır tek kelime etmediniz. Bir derdiniz mi var?'],
      ['kaptan', 'Düüüt.'],
      ['pamuk', 'Hhhh! (Pamuk paltoya tısladı. Palto da ona tısladı.)'],
      ['kaptan', 'Gaak! Gaak gaak!'],
      ['sabri', 'Bir dakika... Bu palto... *Yedi martı*?!'],
      ['kaptan', 'Gaak. (Tercüme: Evet. Vapur ehliyetini birlikte aldık.)'],
      ['kemal', 'Ben yıllardır biliyordum. Kimseye söylemedim, kimse sormadı.'],
      ['sabri', 'Peki... vapuru güzel kullanıyorsunuz, devam edin.'],
      ['kaptan', 'Gaak! (Tercüme: Ücretimiz simit. Sabah ikişer tane.)'],
      ['sabri', 'Anlaştık. Yedi kere iki, on dört simit. Tablaya ekliyorum.'],
    ] },
  },
  {
    id: 'kopru', n: 7, place: 'Köprüaltı', title: 'Holding Dönüşüyor', blurb: 'Plaza Burger Holding batmak üzere. Plazaoğlu Sabri\'den akıl ister.', rewardMin: 9, gold: 2,
    quests: [
      { id: 'kopru-1', title: 'Dördüncü aşama', giver: 'muhtar', text: 'Büfeyi 4. aşamaya büyüt.', goal: { t: 'stage', n: 4 }, start: 'Köprüaltı sana göz kırpıyor. Büfe biraz daha büyüsün.', done: 'Bu büfe artık mahallenin simgesi! Kartpostala basıyoruz.' },
      { id: 'kopru-2', title: '1.000 servis', giver: 'hayriye', text: '1.000 müşteriye servis yap.', goal: { t: 'stat', k: 'served', n: 1000 }, start: 'Bin müşteri, bin dua evladım.', done: 'Bin! Ben saymaktan yoruldum, sen servisten yorulmadın.' },
      { id: 'kopru-3', title: 'Süslü büfe', giver: 'ayten', text: '8 dekor satın al.', goal: { t: 'stat', k: 'decorBought', n: 8 }, start: 'Güzel büfe, güzel bisiklet gibi. Biraz süsle!', done: 'Rengarenk! Zilimi bile kıskandırdın.' },
    ],
    finale: { id: 'final-kopru', title: 'Plazaoğlu\'nun Çay Bahçesi', kind: 'finale', icon: 'cay', lines: [
      ['plaza', 'Sabri Bey... Toplantıya gelmediniz, ben size geldim.'],
      ['burgatron', 'BİP. YÖNETİM KURULU 14. KEZ TOPLANDI. SONUÇ: KİMSE MUTLU DEĞİL.'],
      ['plaza', 'Herkes sizin büfenize gidiyor. Sırrınız nedir?'],
      ['sabri', 'Gel otur. Önce çay. Sonra sohbet. Sonra yine çay.'],
      ['plaza', 'Sadece... oturuyor muyuz? Sunum yok mu? Slayt?'],
      ['sabri', 'Slayt yok. Martı var, kedi var, *komşu* var.'],
      ['burgatron', 'BİP. GÜLÜMSEME PROTOKOLÜ... HATA... GERÇEK GÜLÜMSEME TESPİT EDİLDİ.'],
      ['plaza', 'Kararımı verdim. Burger kulesini kapatıp çay bahçesi açıyorum!'],
      ['huesnu', 'Simitleri benden alırsan, anlaşırız.'],
      ['plaza', 'Anlaştık! Sabri Bey, açılışta kurdeleyi siz keser misiniz?'],
      ['sabri', 'Keserim ama makas yerine ekmek bıçağıyla. Alışkanlık.'],
    ] },
  },
  {
    id: 'ay', n: 8, place: 'Ay', title: 'Ay\'a Büfe', blurb: 'Simit tablasına gelen sinyaller bir davetmiş. Uzaylı gurme Zıppo aç!', rewardMin: 12, gold: 3,
    quests: [
      { id: 'ay-1', title: 'Esnaf Seviyesi 15', giver: 'uzayli', text: 'Esnaf Seviyesi 15 ol.', goal: { t: 'level', n: 15 }, start: 'Bzzt. Dünya büfecisi. Ay\'da açlık var. Ustalaş, gel.', done: 'Bzzt! Antenlerim titredi. Hazırsın.' },
      { id: 'ay-2', title: 'Uzay simidi', giver: 'huesnu', text: '400 simit sat.', goal: { t: 'stat', k: 'sold_simit', n: 400 }, start: 'Uzaya giden simit bayat olmamalı. Pratik yap!', done: 'Bu simitler yörüngeye girer, o kadar çıtır!' },
      { id: 'ay-3', title: 'Roket yakıtı', giver: 'zeki', text: '150.000 ₺ kazan.', goal: { t: 'earned', n: 150000 }, start: 'Roket yakıtı pahalı. Leblebiyle de uçmuyor, denedim.', done: 'Yakıt tamam! Bir avuç leblebi de yedek olarak koydum.' },
    ],
    finale: { id: 'final-ay', title: 'Büyük Ay Kutlaması', kind: 'finale', icon: 'ay', lines: [
      ['uzayli', 'Bzzt! Ay\'a hoş geldin Sabri! Bütün krater seni bekliyor.'],
      ['sabri', 'Burada çay nasıl demleniyor? Su havada uçuyor!'],
      ['pamuk', 'Mrrr! (Pamuk ağırlıksız ortamda süzülüyor. Çok memnun.)'],
      ['uzayli', 'Bu tost... bu *tost*! Antenlerim düğüm oldu!'],
      ['kaptan', 'Gaak gaak! (Yedi martı Ay\'da da uçabildiklerini keşfetti.)'],
      ['plaza', 'Çay bahçemizin Ay şubesini açtık bile! Sabri Bey\'in tavsiyesi.'],
      ['radyo', 'Martı FM, Ay\'dan canlı! Kutlama havai fişeklerle sürüyor!'],
      ['sabri', 'Arkadaşlar, çok güzel ama... Martıköy\'ü özledim.'],
      ['huesnu', 'Dönelim o zaman! Sabah simitleri kendi kendine pişmez.'],
      ['sabri', 'Martıköy\'e dönüş! Yeni sezon başlıyor!'],
      ['uzayli', 'Bzzt. Ben de geliyorum. Turist olarak. Bir de... iskelenin altından garip bir ses geliyor.'],
    ] },
  },
];

/** After the Moon: "new season" oddities that keep the story going (one every few days). */
export const NEW_SEASON: readonly SceneDef[] = [
  { id: 'sezon-1', title: 'İskelenin Altındaki Ses', kind: 'ara', lines: [['sabri', 'İskelenin altından bir ses geliyor...'], ['kemal', 'Bir ahtapot. Tost istiyor. Sekiz tane.']] },
  { id: 'sezon-2', title: 'Kedilerin Seçimi', kind: 'ara', lines: [['muhtar', 'Mahalle kedileri kendi muhtarlarını seçmiş.'], ['pamuk', 'Miyav. (Tercüme: Oyların hepsi bana. Mama vaat ettim.)']] },
  { id: 'sezon-3', title: 'Ters Dönen Vapur', kind: 'ara', lines: [['kaptan', 'Gaak! (Vapur bugün geri geri geldi.)'], ['sabri', 'Yolcular memnun ama, manzarayı iki kez gördüler.']] },
  { id: 'sezon-4', title: 'Zıppo\'nun Akrabaları', kind: 'ara', lines: [['uzayli', 'Bzzt. Kuzenlerim geliyor. 400 kişiler.'], ['sabri', 'Tost makinesini ısıtın arkadaşlar!']] },
];

/** Absurd breaks (hikaye-6): once each, on/after the given day. Short (5-10 s) moments, nothing changes in the sim. */
export interface AbsurdDef { id: string; day: number; at: number; scene: SceneDef }
export const ABSURD: readonly AbsurdDef[] = [
  { id: 'yuruyen-bufe', day: 3, at: 20, scene: { id: 'absurt-yuruyen', title: 'Büfe Yürümüş', kind: 'absurt', icon: 'bufe', lines: [
    ['sabri', 'Bir dakika... Büfe dün akşam burada değil miydi? *Üç metre* yürümüş!'],
    ['pamuk', 'Miyav. (Tercüme: Gece sıkıldı, biraz gezdi. Ben de bindim.)'],
    ['zeki', 'Benim tezgah da geçen yıl yürümüştü. Sonra geri geldi. Özlemiş.'],
  ] } },
  { id: 'kaptan-marti', day: 5, at: 60, scene: { id: 'absurt-kaptan', title: 'Kaptanın Paltosu', kind: 'absurt', icon: 'vapur', lines: [
    ['kaptan', 'Düüüt.'],
    ['sabri', 'Kaptanım, paltonuzun cebinden bir kanat çıktı sanki?'],
    ['kaptan', 'Gaak. Ehem. Düüüt! (Kanat hızla içeri girdi.)'],
  ] } },
  { id: 'simit-sinyal', day: 7, at: 40, scene: { id: 'absurt-sinyal', title: 'Simit Tablası Sinyal Alıyor', kind: 'absurt', icon: 'simit', lines: [
    ['huesnu', 'Sabri! Simit tablası bip bip ediyor!'],
    ['sabri', 'Bip... bip... Bu mors alfabesi! Diyor ki: "*TOST* GETİR."'],
    ['huesnu', 'Uzaydan sipariş! Hamuru daha çıtır yapayım, yolda soğumasın.'],
  ] } },
  { id: 'patron-durum', day: 9, at: 90, scene: { id: 'absurt-patron', title: 'Gizli Müşteri', kind: 'absurt', icon: 'durum', lines: [
    ['casus', 'Bir dürüm lütfen. Acil. Kimse görmesin.'],
    ['sabri', 'Plazaoğlu Bey? Güneş gözlüğü ve bıyık takmışsınız ama kravatınızda logo var.'],
    ['plaza', 'Şşş! Yönetim kurulu bilmesin. Bu dürüm... *efsane*. Bir tane daha.'],
  ] } },
  { id: 'martilar-toplanti', day: 12, at: 30, scene: { id: 'absurt-toplanti', title: 'Martı Toplantısı', kind: 'absurt', icon: 'marti', lines: [
    ['sabri', 'Martılar korkuluğa dizilmiş, biri tahta gösteriyor...'],
    ['burgatron', 'BİP. MARTILAR SUNUM YAPIYOR. KONU: SİMİT YAKALAMA VERİMLİLİĞİ.'],
    ['pamuk', 'Miyav. (Tercüme: Sunum sıkıcı. Ben uyuyorum.)'],
  ] } },
];

// ───────── rivals (zincir-1..8) ─────────
export type RivalId = 'plaza' | 'gevrek' | 'kopuk' | 'tavuk' | 'ucan' | 'kokorec' | 'borek';
export interface RivalDef {
  id: RivalId; name: string; kind: 'zincir' | 'yerel'; who: SpeakerId; color: string; slogan: string; blurb: string;
  /** chapter index (0-based) from which this rival acts */
  from: number;
  /** corporate parody lines shown in the Defter and on actions */
  quips: readonly string[];
  /** after this chapter is finished, the rival transforms (zincir-8) */
  turnAfter: number; turned: string;
}
export const RIVALS: readonly RivalDef[] = [
  { id: 'plaza', name: 'Plaza Burger Holding', kind: 'zincir', who: 'plaza', color: '#d23b3b', slogan: 'Burger. Strateji. Sinerji.', blurb: 'Kötü adamımız. Maskotu robot Burgatron. Her şeyi toplantıda karar verir.', from: 1, turnAfter: 6,
    quips: ['Bu çeyrekte gülümseme hedefimiz yüzde 12.', 'Burgatron, robot gülüşünü başlat.', 'Müşteri değil, "burger deneyimi paydaşı" diyoruz.', 'Toplantının toplantısını yapacağız.'],
    turned: 'Plazaoğlu burger kulesini kapattı, çay bahçesi açtı. Her sabah Sabri\'ye danışıyor.' },
  { id: 'gevrek', name: 'Gevrek Express', kind: 'zincir', who: 'gevrek', color: '#e8a12a', slogan: '47 saniyede simit!', blurb: 'Hızlı simit zinciri. Hız her şey, çıtırlık sonra.', from: 1, turnAfter: 4,
    quips: ['Simit teslim süremiz 47 saniye. Simit pişme süremiz gizli.', 'Oturan müşteri verimsiz müşteridir.', 'Yeni ürün: koşarken yenen simit.'],
    turned: 'Sürat Bey yavaşlamayı öğrendi. Artık Hüsnü\'den simit alıp "yavaş simit" satıyor.' },
  { id: 'kopuk', name: 'Köpük Kulesi', kind: 'zincir', who: 'kopuk', color: '#b07ad6', slogan: 'Her yudumda bir bulut.', blurb: 'Süslü kahve zinciri. Bardaklara isimleri yanlış yazar.', from: 2, turnAfter: 5,
    quips: ['Bugünkü özel: Fıstıklı Gün Batımı Bulutu Grande Venti Plus.', 'Adınızı "Sapri" yazdık, kabul edin.', 'Köpüğün altında da köpük var.'],
    turned: 'Lal köpüklü ayran icat etti, Sabri\'ye lisans parası olarak her gün bir ayran veriyor.' },
  { id: 'tavuk', name: 'Tavuk Tekeli A.Ş.', kind: 'zincir', who: 'tavuk', color: '#f2d14a', slogan: 'Her şey bir gün tavuk olacak.', blurb: 'Her ürünü tavuklaştırmak isteyen şirket.', from: 3, turnAfter: 6,
    quips: ['Tavuk aromalı su. Ar-Ge aşamasında.', 'Vizyon: tavuk. Misyon: daha çok tavuk.', 'Kedinizle marka yüzü kontratı istiyoruz.'],
    turned: 'Kanat Bey sebze dürümü çıkardı. Hayriye Abla tedarikçisi oldu.' },
  { id: 'ucan', name: 'Uçan Paket', kind: 'zincir', who: 'dron', color: '#4a9bc4', slogan: 'Gökten kapınıza!', blurb: 'Dronla teslimat girişimi. Martılarla arası kötü.', from: 4, turnAfter: 6,
    quips: ['VIIIZ. SİPARİŞİNİZ YOLDA. YOL: BULUT.', 'DRON-3 MARTI TARAFINDAN ELE GEÇİRİLDİ.', 'MEMNUNİYET ANKETİ: 1 İLE 1 ARASINDA PUANLAYIN.'],
    turned: 'Dronlar artık martılarla barışık. Simit taşıyorlar, martılar eşlik ediyor.' },
  { id: 'kokorec', name: 'Üç Kardeş Kokoreç', kind: 'yerel', who: 'kokorec', color: '#8a3a2a', slogan: 'Üç kardeş, üç şube, tek tarif (kavgalı).', blurb: 'Üç kardeş, üç şube, hep kavga. Ama kokoreçleri güzel.', from: 2, turnAfter: 5,
    quips: ['Tarif benim! Hayır benim! Annem bana vermişti!', 'Bu şube ağabeyin değil, ortanca kardeşin.', 'Barıştık. Pardon, yine küstük.'],
    turned: 'Kardeşler Sabri\'nin hakemliğinde barıştı. Tek tezgahta, sırayla bağırıyorlar.' },
  { id: 'borek', name: 'Dede Usulü Börek', kind: 'yerel', who: 'borek', color: '#c2a35a', slogan: '50 yıldır aynı merdane.', blurb: '50 yıllık börekçi. Rakip değil, rakip olmayı sever.', from: 1, turnAfter: 3,
    quips: ['Biz 50 yıldır buradayız. Martılar bile bizi hatırlar.', 'Merdanem dedemden kalma. Dedem de dedesinden.', 'Gençler acele ediyor, börek acele etmez.'],
    turned: 'Dede Nuri ile ortak "Börek ve Çay" menüsü yaptınız. Sabahları kuyruk olur.' },
];

export type RivalActionKind = 'konsept' | 'casus' | 'billboard' | 'dron' | 'tat' | 'ortak';
export interface RivalActionDef {
  kind: RivalActionKind; title: string; intro: string; secs: number; dip: number;
  /** buttons: [label, op-arg] */
  choices: readonly (readonly [string, string])[];
  rivals: readonly RivalId[];
}
/** {r} = rival name. dip = temporary sales multiplier while the action runs (small and temporary, zincir-6). */
export const RIVAL_ACTIONS: readonly RivalActionDef[] = [
  { kind: 'konsept', title: 'Konsept Mağaza', intro: '{r} karşıya konsept mağaza açtı! Kampanya: "İkinciye üçüncüsü bedava, birinciyi sonra konuşuruz."', secs: 120, dip: 0.9, rivals: ['plaza', 'gevrek', 'kopuk', 'tavuk', 'kokorec'],
    choices: [['Karşı kampanya: Çay kokusu yay', 'koku'], ['Boş ver, işine bak', 'bos']] },
  { kind: 'casus', title: 'Casus Müşteri', intro: 'Gözlüklü bir müşteri tarifini çok merak ediyor. Not defterinde {r} logosu var...', secs: 60, dip: 1, rivals: ['plaza', 'gevrek', 'kopuk', 'tavuk', 'kokorec', 'borek'],
    choices: [['Sahte tarif ver: "Bol sevgi, bir tutam martı tüyü"', 'sahte'], ['Çay ikram et, sohbet et', 'cay']] },
  { kind: 'billboard', title: 'Dev Billboard', intro: '{r} iskelenin karşısına dev bir billboard dikti. Üstünde gülümseyen bir robot var. Müşteriler ürkek.', secs: 180, dip: 0.93, rivals: ['plaza', 'kopuk', 'tavuk'],
    choices: [['Üstüne kedi posteri as', 'kedi']] },
  { kind: 'dron', title: 'Dron Yağmuru', intro: 'Uçan Paket dronları iskelenin üstünde broşür yağdırıyor. Müşteriler yukarı bakmaktan sipariş vermeyi unuttu.', secs: 90, dip: 0.92, rivals: ['ucan'],
    choices: [['Martılara simit at, dronları kovalasınlar', 'marti']] },
  { kind: 'tat', title: 'Tat Yarışı', intro: '{r} meydan okudu: Tat Yarışı! Mahalle jürisi oylayacak. Hangi ürünle girersin?', secs: 90, dip: 1, rivals: ['plaza', 'gevrek', 'kopuk', 'tavuk', 'kokorec', 'borek'],
    choices: [] },
  { kind: 'ortak', title: 'Ortak İş', intro: '{r} toplantıda simit bitmiş! Senden sipariş istiyorlar. Rakip ama para para.', secs: 240, dip: 1, rivals: ['plaza', 'gevrek', 'kopuk', 'tavuk'],
    choices: [['Kabul: 12 ürün sat, siparişi götür', 'kabul'], ['Bu sefer pas', 'pas']] },
];

export const RIVAL_RESULT: Record<string, string> = {
  koku: 'Demlik kokusu meydana yayıldı. Müşteriler burnunu takip edip sana geldi! Kısa süre satış artışı.',
  bos: 'Sen işine baktın. Kampanya kendi kendine söndü, kimse "birinciyi" anlamadı.',
  sahte: 'Casus not aldı: "martı tüyü". Ertesi gün rakip menüsünde "Tüylü Dürüm" çıktı, kimse almadı. Sana bir Altın Simit düştü!',
  cay: 'Casus çayı içti, gözlüğünü çıkardı: "Ben aslında simit seviyorum." Müdavimin oldu. Sana bahşiş bıraktı.',
  kedi: 'Billboardun üstüne kocaman Pamuk posteri astın. Mahalle bayıldı, robot küstü. Satışlar eski haline döndü!',
  marti: 'Simit atınca martılar coştu, dronları kovaladı. Gökyüzü yine martıların!',
  kabul: 'Anlaştın! 12 ürün sat, sipariş tamamlanınca ödeme senin.',
  pas: 'Kibarca pas geçtin. Rakip toplantıda kuru kraker yedi.',
  ortakOk: 'Sipariş teslim! Rakip toplantıda simitleri yerken sunumu unuttu. Ödeme kasada.',
  ortakGec: 'Süre bitti, rakip simitsiz toplantı yaptı. Kimse kızmadı, herkes biraz uykuluydu.',
};

/** Tat Yarışı jury (zincir-5): three neighbours, each line picked by score. */
export const JURY: readonly SpeakerId[] = ['huesnu', 'hayriye', 'pamuk'];
export const JURY_LINES = {
  win: ['Bu tat beni çocukluğuma götürdü!', 'Ellerine sağlık evladım!', 'Miyav! (Tercüme: On puan, bir de kuyruk.)'],
  lose: ['Rakibinki fena değildi, ama senin gönlün büyük.', 'Bir dahakine bir tutam daha sevgi koy.', 'Miyav. (Tercüme: Ben ikisini de yedim, berabere.)'],
};

// ───────── tutorials by character (kontrol-7) ─────────
export type TutorCond =
  | { t: 'owned'; k: string } | { t: 'level'; n: number } | { t: 'workers'; n: number } | { t: 'stat'; k: string; n: number }
  | { t: 'stage'; n: number } | { t: 'rival' };
export interface TutorDef { id: string; system: string; cond: TutorCond; scene: SceneDef; demo: string }
const tut = (id: string, system: string, cond: TutorCond, demo: string, lines: Line[]): TutorDef => ({ id, system, cond, demo, scene: { id: 'tut-' + id, title: system, kind: 'ogretici', lines, icon: demo } });
export const TUTORS: readonly TutorDef[] = [
  tut('cay', 'Çay Ocağı', { t: 'owned', k: 'cay' }, 'cay', [
    ['zeki', 'Çay ocağın hazır! Bak, önünde bir nefes *dur*, demlik kendi dolar.'],
    ['zeki', 'Bardaklar tepsiye dizilince al, tezgaha bırak. Bu kadar!'],
    ['pamuk', 'Miyav. (Tercüme: Bir bardak da bana. Süt olsun.)'],
  ]),
  tut('isci', 'İşçi Bulma', { t: 'owned', k: 'isbul' }, 'isci', [
    ['sevket', 'İş panosu kuruldu! Kartlara bak, her adayın bir *huyu* var.'],
    ['sevket', 'Kartın altındaki iyi yanı ve kusuru oku. Sonra "İşe al" de, gerisi kolay.'],
    ['sevket', 'Uykucu olanı da al, uyanınca iki kat çalışır. Benim çırak öyle.'],
  ]),
  tut('pencere', 'Vapur Penceresi', { t: 'owned', k: 'pencere' }, 'vapur', [
    ['kaptan', 'Düüüt! Vapur yanaşınca pencere açılır.'],
    ['kaptan', 'Gaak! (Tercüme: Ürünü kap, pencereye koş, yolcuya uzat. *Hızlı* ol!)'],
    ['sabri', 'Kaptan bugün çok konuşkan. Gaak dedi, değil mi?'],
  ]),
  tut('komsu', 'Komşu Defteri', { t: 'level', n: 2 }, 'kalp', [
    ['huesnu', 'Çarşıya hoş geldin! İskelenin ucundan yürü, bizi bulursun.'],
    ['huesnu', 'Bize dokun, sohbet et, ricalarımızı yap. Dostluk *kalpleri* dolar.'],
    ['hayriye', 'Dostluk artınca malzeme de daha taze gelir evladım. Domates sözü.'],
  ]),
  tut('mini', 'Mini Oyunlar', { t: 'level', n: 2 }, 'oyun', [
    ['ayten', 'Lunapark Martı köşesi açıldı! Görevler sayfasında Mini Oyunlar\'a bak.'],
    ['ayten', 'Tek parmakla oynanır, tamamen *beceri*. Günde 5 ödüllü tur var.'],
    ['ayten', 'Başaramazsan da olur, komik bir an yaşarsın, teselli ödülü alırsın.'],
  ]),
  tut('kurye', 'PaketMartı Kuryeleri', { t: 'level', n: 3 }, 'kurye', [
    ['ayten', 'Tezgahtaki tablet öttü mü? PaketMartı siparişi geldi demek!'],
    ['ayten', 'Fişi kabul et, kurye *pedallasın*. İstersen kendin de götürebilirsin.'],
    ['kemal', 'Barınağa gelen siparişlere balık koyma ama. Bende yeterince var.'],
  ]),
  tut('dekor', 'Dekor', { t: 'stat', k: 'decorBought', n: 1 }, 'dekor', [
    ['hayriye', 'İlk süsünü aldın! Dekor sayfasından istediğin yere *yerleştir*.'],
    ['hayriye', 'Güzel büfeye müşteri daha uzun oturur, bahşişi de bol olur.'],
    ['pamuk', 'Miyav. (Tercüme: Bir kedi evi de al. Bütçe benden değil.)'],
  ]),
  tut('tadilat', 'Tadilat', { t: 'stage', n: 2 }, 'tadilat', [
    ['muhtar', 'Büfen büyüdü! Yeni masalar, yeni yerler açıldı.'],
    ['muhtar', 'Tadilat sayfasında sıradaki aşamayı gör. Her aşama *gelir* çarpanını büyütür.'],
  ]),
  tut('firin', 'Altın Fırın', { t: 'level', n: 8 }, 'firin', [
    ['huesnu', 'İskelenin köşesindeki Altın Fırın uyandı! Görevler sayfasında Koleksiyon\'a bak.'],
    ['huesnu', 'Altın Simitleri fırına koy, *vitrin* parçası dök. Benim fırından daha parlak, kıskandım.'],
  ]),
  tut('rakip', 'Rakipler', { t: 'rival' }, 'rakip', [
    ['sabri', 'Rakipler sahneye çıktı! Ara sıra kampanya, casus, billboard yaparlar.'],
    ['pamuk', 'Miyav. (Tercüme: Ekrana çıkan düğmeye bas, cevap ver. Gelir düşüşü kısa sürer.)'],
    ['sabri', 'Bazen ortak iş, bazen Tat Yarışı teklif ederler. Hikaye Defteri\'nde hepsi yazılı.'],
  ]),
];

/** Timings (seconds of play). */
export const HIKAYE_TIMING = {
  firstRival: [200, 320] as const,
  rivalGap: [300, 480] as const,
  boostSecs: 60, boostX: 1.08,
  araShow: 7, // in-between moment duration
  seasonGapDays: 3,
  logCap: 80,
  ortakN: 12,
  /** reward minutes of current earnings */
  sahteGold: 1, cayTipMin: 2, kediMin: 2, ortakMin: 5, tatWinMin: 4, tatLoseMin: 1,
};
