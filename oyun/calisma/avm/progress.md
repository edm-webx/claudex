# İlerleme (AVM katları)
- 18:14 başladı. Kod okundu, ilk ekran görüntüleri alındı (scratchpad), tasarım yazıldı.
- 18:46 sahip yönü değiştirdi: AVM ayrı harita (diyar x 1150..1250), dükkânlara içeriden girilir, gelişim büfe gibi sarı karelerle.
- 19:xx sim: avm-gecis (kapı geçişi), kat bazlı nav, avm-kareler (satın alma + alet kareleri), işçi/müşteri katlar arası yol. 14 AVM testi.
- 20:xx görünüm: avm-ic.ts (hol, lobi, galeri, cam cephe, yürüyen merdiven basamak animasyonu, kayar kapı), 17 alet modeli, kararma geçişi.
- 21:00 düzeltmeler: AVM görünümleri sahneye bağlı (iskele kökü boşalınca kayboluyordu); üst/alt kattaki karakterler gizli; yalnız kahramanın katındaki dükkânlar çizilir.
  Ölçüm (akıcı kademe, bütün dükkânlar 5. seviye, 3 işçi): kat2 425k -> 182k üçgen, 326 -> 167 çağrı. perf-gate rotasında avm-ici noktası yeni diyara taşındı.
- Kalan: AVM tadilatında görünür usta yok (yalnız süre); panelden dükkân satın alma yedek yol olarak duruyor.
- 21:07 sahip: AVM yükleme ekranı + ayrı âlem: kalabalık, konser, sinema. Eklenenler: 4. kat eğlence katı (content/avm-eglence.ts: 2 salon x 15 koltuk, seans takvimi, sahne + günde 3 konser), sim/agents/avm-yasam.ts (ziyaretçiler, sinema seyircisi, konser izleyicisi, 3 müzisyen; yalnız oyuncu AVM'deyken), view/world/avm-eglence.ts, ui/avm-yukleme.ts. 5 yeni test. Akıcı kademede eğlence katı ~222k üçgen (kalabalık dahil).
