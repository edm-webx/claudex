# İlerleme / kaldığım yer (2026-11-25 gece)
Dal: claude/project-thread-arinot (taban jo0q11 fef56d9).

## Bitti
- content/santiye.ts: SETLER (küçük/orta/büyük/dev), bufeBoyut, isletmeBoyut, YAPI_ASAMA (temel, karkas, duvar, çatı+sıva), YAPI_SURE, arsaBoyut.
- view/world/santiye-kit.ts: santiyeKur() + parçalar (iskele, merdiven, boya, betoniyer, el arabası, kum, tuğla, çit, konteyner, tuvalet, jeneratör, mobil vinç, kule vinç, damperli/mikser kamyon, beton pompası, toz, aşamalı kabuk, canlı proje panosu). Oyuna HENÜZ bağlı değil.
- Konsept görseller: calisma/santiye/shot/{kucuk,orta,dev,asama}.png. Üretmek: oyun/ içinde `npx vite --port 5199` sonra `node calisma/santiye/shot.mjs kucuk orta dev asama`.
- Kullanıcıya konsept HENÜZ gösterilmedi.

## Sıradaki adımlar
1. Konsept görselleri + kararları kullanıcıya göster (artifact ya da mesaj ekleri).
2. Büfe buildSite (bufe-buyume.ts) ve isletme-insaat.ts setini bufeBoyut / isletmeBoyut ile kitten kur; usta sayılarını SETLER.usta'ya bağla (ustalar.ts ustaSayisi, isletme-insaat USTA_SAYISI).
3. Arsa: Plot'a `insa {left,total}` ekle, arsaKur ev/dükkânı süreli yap; mulk view'da kabuklu şantiye; isletme-insaat agent'ı arsalara genişlet.
4. vitest + tsc + oyun içi ekran görüntüsü + perf kapısı. Ses thread'ine not (matkap, çekiç, betoniyer, vinç, geri vites bip).

## Açık karar (kullanıcıya sorulacak)
- ARSALAR a1..a5 x≈260'ta, hiçbir oyun bölgesinde değil: oyuncu arsaya gidemiyor. Nereye taşınsın? Adaylar: (a) karşı yakada hastane/metro yanındaki boş taş meydan, (b) promenad uçlarındaki belediye şantiyesi açılınca yeni mahalle. Karşı yaka doğu boş alan ekran görüntüsü alınacaktı (yarım kaldı).
- Bug avı thread'inin inşaat sahası projeksiyon düzeltmesi dalı bulunamadı; birleştirmeden önce kontrol et.
