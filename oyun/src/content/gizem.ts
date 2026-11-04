/**
 * Ana hikaye: "Sabri Abi nereye gitti?" (Master Directive 2026-10-30). Pure data, all names invented.
 * TRUTH: Plazaoğlu (Plaza Simit AVM) wants the pier plot, claims it is private land with a forged deed. Sabri's grandfather,
 * the old Belgrad çeşme keeper, hid the real VAKIF deed (the plot belongs to the neighbourhood, cannot be sold) inside the çeşme.
 * An anonymous note (from Plaza's clerk Şükrü, who regrets the forgery) told Sabri. Sabri went on the night bus before the
 * Muhtar's vote (day 12), found the deed, then the rotten çeşme hatch fell and trapped his foot in the keeper's hut.
 * RED HERRING: Kemal blames Gevrek Express (Sürat Bey). Resolution: bring the deed to Muhtar Rüstem at the Meydan.
 */
export interface Ipucu { id: string; yer: string; x: number; z: number; once: string[]; baslik: string; metin: string; ikon: string }
export const SABRI_GUN = 5;       // the morning Sabri is gone
export const OY_GUNU = 12;        // the council vote, shown in the clues
export const IPUCLARI: Ipucu[] = [
  { id: 'mektup', yer: 'Büfe', x: 1.2, z: -7.2, once: [], ikon: '✉️', baslik: 'Tezgahtaki mektup',
    metin: 'Evladım, sakın telaşlanma. Plaza\'nın tapusu sahte, gerçeğini dedemin Belgrad\'daki çeşmesine gizlemişlerdi. Oy gününden önce alıp döneceğim. Kasayı sana emanet ettim, simit kuyruğu uzamasın. Martıları da doyur. İmza: Sabri. (Not: nereye gittiğimi kimseye söyleme, Plazaoğlu\'nun adamları her yerde.)' },
  { id: 'hesap', yer: 'İskele Kıyısı', x: -22, z: 10, once: ['mektup'], ikon: '🧾', baslik: 'Kıyıdaki bankta bir fiş',
    metin: 'Fiş Sabri\'nin masasında kalmış: "2 çay, 1 tost, Belgrad Ormanı yol tarifi: Orman Durağı\'ndan çeşmeye düz, mangallardan sola." Altına kurşun kalemle: "Muhtar oy gününü 12\'ye aldı. Acele."' },
  { id: 'sapka', yer: 'Stadyum', x: 408, z: 11, once: ['mektup'], ikon: '🧢', baslik: 'Stadyum önünde kasket',
    metin: 'Balıkçı Kemal kasketi gösteriyor: "Sabri bu gece ayrılırken Gevrek Express\'in kuryesi onu takip etti, ben gördüm!" Ama kasketin içinde Gevrek Express\'in değil, çarşıdan alınmış sıradan bir simit poşeti var. Kemal\'in gördüğü kurye belki sadece yolunu kaybetmişti.' },
  { id: 'ilan', yer: 'İskele Panosu', x: -28, z: 10.5, once: ['mektup'], ikon: '📜', baslik: 'Muhtarlık ilan panosu',
    metin: 'Muhtar Rüstem\'in ilanı: "Martıköy İskele arsasının satışı, tapu belgesi ibraz edilirse 12. gün oylanacaktır. Belgesi olan gelsin." Altında Plazaoğlu\'nun parlak, mührü yarım basılmış bir tapu fotokopisi. Mühür gerçek mührün aynası gibi, ters.' },
  { id: 'bilet', yer: 'Stadyum Gişesi', x: 440, z: 11, once: ['hesap', 'sapka', 'ilan'], ikon: '🎫', baslik: 'Stadyum gişesinde otobüs bileti',
    metin: 'Şüpheli Müşteri Şükrü\'nün gizli notu: "Ben Plaza\'nın katibiyim. Tapuyu ben sahte bastım, pişmanım. Sabri\'ye çeşmeyi ben yazdım. Belgrad, 42B, Orman Durağı. Beni ele vermeyin. Çeşmenin altındaki kapak çürük, dikkat!"' },
  { id: 'kapak', yer: 'Belgrad Çeşmesi', x: 838, z: 14.2, once: ['bilet'], ikon: '🪵', baslik: 'Çeşmenin altındaki kapak',
    metin: 'Kapak çürümüş, içinde taze izler ve boş bir tahta kutu var. Kutunun üstünde Sabri\'nin yazısı: "Buldum! Kulübeye indim, ayağım sıkıştı, yardım!" Kulübe mangal alanının arkasında olmalı.' },
  { id: 'sabri', yer: 'Bekçi Kulübesi', x: 876, z: 21.5, once: ['kapak'], ikon: '🧔', baslik: 'Sabri Abi bulundu',
    metin: 'Sabri Abi kulübenin köşesinde oturuyor, ayağı çürük kapağın kirişi arasında. "Geldin demek, işçi! Tapu elimde, vakıf belgesi: Martıköy İskele arsası mahalleliniki, satılamaz. Beni çıkar, Muhtar\'a birlikte gidelim." Kirişi kaldırıp onu çıkarıyorsun. Belgeyi sana veriyor.' },
  { id: 'oy', yer: 'Muhtarlık Panosu', x: -28, z: 10.5, once: ['sabri'], ikon: '🏛️', baslik: 'Oy günü',
    metin: 'Belgeyi Muhtar Rüstem\'e veriyorsun. Mühür gerçek, vakıf kaydı kesin. Satış oylaması iptal. Plazaoğlu\'nun AVM planı çöküyor, Şükrü itiraf edip bağışlanıyor. Sabri Abi büfeye döndü: "Bundan sonra bu büfe senin de, mahallenin de." Martıköy\'ün güvencesi sensin.' },
];
export const IPUCU_BY_ID: Record<string, Ipucu> = Object.fromEntries(IPUCLARI.map(i => [i.id, i]));
export const BITIS = { para: 25000, altin: 5, xp: 400 };
export const HEDEF_METIN: Record<string, string> = {
  bekle: 'Büfeyi çalıştır. Birkaç gün sonra bir şey olacak.',
  mektup: 'Sabri Abi yok! Tezgahtaki mektubu oku.',
  izle: 'İz sür: Çarşı, Sahil ve Meydan\'da ipuçları var. Hepsini bul, sonra Barınak.',
  barinak: 'Barınak\'taki kayığa bak.',
  belgrad: 'Belgrad Ormanı\'na 42B ile git, çeşmeyi bul.',
  kulube: 'Çeşmenin arkasındaki kulübeyi ara.',
  muhtar: 'Belgeyi Meydan\'daki Muhtar panosuna götür.',
  bitti: 'Hikaye tamam. Sabri Abi\'nin büfesi artık mahallenin.',
};

/** Neighbour gossip, one line a day at 10:00 while the story runs. Keys are the current objective (HEDEF_METIN keys). */
export const SOHBET: Record<string, [string, string][]> = {
  mektup: [['Fırıncı Hüsnü', 'Sabri\'nin kepengi bu sabah açık ama kendisi yok. Tezgaha bir bak, kağıt gördüm.'], ['Manav Hayriye Abla', 'Sabri bu hafta hep telaşlıydı, cebinde bir harita vardı.']],
  izle: [['Berber Şevket', 'Plaza\'nın adamları iskele arsasını ölçüyormuş. Yazık, güzel yerdi.'], ['Balıkçı Kemal', 'Gevrek Express\'in kuryesini Sabri\'nin peşinde gördüm, bence o bir şeyler biliyor.'], ['Kuruyemişçi Zeki', 'Muhtar oy gününü öne almış, cebinde fotokopi var diyorlar.']],
  barinak: [['Balıkçı Kemal', 'Kayığın burnuna biri bir şey bıraktı. Ben dokunmadım, Plaza\'dan değilim.'], ['Bisikletçi Ayten', 'Şüpheli bir müşteri bu aralar kimseye bakmadan çay içiyor, kendi kendine konuşuyor.']],
  belgrad: [['Vapur Kaptanı', 'Belgrad\'a 42B gidiyor evlat. Çeşmeden mangallara doğru yürü.'], ['Muhtar Rüstem', 'Belge ibraz edilmezse arsa satılır. Bir mucize olsa...']],
  kulube: [['Muhtar Rüstem', 'Oy günü yaklaşıyor, kapak çürükmüş diyorlar, dikkat et.']],
  muhtar: [['Muhtar Rüstem', 'Sabri\'yi gördün mü? Belge yanındaysa panoma uğrayın, oylama bekliyor.']],
  bitti: [['Fırıncı Hüsnü', 'Plaza\'nın AVM planı çöktü. Bu simidi mahalle ısmarlıyor.'], ['Manav Hayriye Abla', 'Sabri Abi güldü, ilk kez böyle güldüğünü gördüm.'], ['Balıkçı Kemal', 'Gevrek Express\'ten özür diledim. Kurye gerçekten sadece kaybolmuş.']],
};
