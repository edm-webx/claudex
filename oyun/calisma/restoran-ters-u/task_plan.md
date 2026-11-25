# Ters U restoran (2026-11-25)

Sahibi: "tek dev restoran, ayrı dükkânlar gibi olmayacak", kırmızı çizgi ters U, seçim: "1'in görünüşü + 5'in U tezgâhı, sen en iyisini yap".

## Spec (aşama 6+; 1-5 sahibinin 2026-11-22 büfe düzeni aynen)
- Sol kanat x -23.2..-10.05, sağ kanat x 8.0..21.8, orta bant arada; arka z -17.4, kanat ucu z 4.2. Batı aşama 6, doğu aşama 7.
- Tek zemin, iç duvar yok. Katı duvar: arka (deniz), dış yanlar, kanat uçları (kapılı). Avluya bakan kenar direkli açık revak.
- Vapur koridoru (z -9.2..-4.8) doğu kanadın içinden açık geçit.
- Mutfak duvarsız: arka hat + ön tezgâh (U'nun tabanı); kanatların iç kenarında salon aletleri (U'nun kolları). Servis koridoru yok.
- Pass: orta (avlu), W ve E (kanat başları). PassYer anlamı aynı.
- Masa indexleri değişmez (kayıt): salon masaları öne, çatı masaları ön teraslara kayar. Çatı tek kat (3.76); merdiven kanadın içinde.
- Görünüş: kırmızı ahşap, krem söve, kırmızı kiremit beşik çatı, kırmızı beyaz tente; 8'de kanat uçları teras, 10'da lacivert-altın tabela.
- Çatı oyuncu iskeledeyken kalkar (aletler hep görünür), promenaddan bakınca durur.
- Salon aletleri: kare aletin yerinde; pişirenler mutfak hattına katılır.

## Adımlar
1. [ ] content: ic-mekan, kanat, mutfak
2. [ ] çarpışma (buyumeEngel)
3. [ ] sim: garson/aşçı rota, kareler
4. [ ] görünüm: bufe-buyume, ic-mekan-look, kiosk
5. [ ] salon aletleri hat üyesi
6. [ ] testler, ekonomi, ekran görüntüsü

## Sonuç (2026-11-25)
- 1-6. adımlar bitti. Oyuncu mutfakta ve salon aletinde büfe gibi çalışır (OYUNCU_HIZ 0.4, en az 1.2 sn, eller dolana kadar); content/salon-alet.ts.
- Gelir/gün (aşama botu, jo0q11 -> ters U): 6 %-10, 7 %-5, 8 %+5, 9 %+3, 10 %0; 1-5 aynı.
- vitest: 8 kırmızı jo0q11'de de vardı (Windows yol ayracı: kirmizi-cizgi, baglilik, ekonomi-kapi).
