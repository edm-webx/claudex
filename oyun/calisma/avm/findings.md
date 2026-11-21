# Bulgular (AVM katları)
- Başlangıç: jo0q11 cdb9a69 + g3g2bo 17d72d7 birleştirildi (çakışma yalnız calisma/asama-botu-rapor.json, Ana İş tarafı alındı).
- AVM kabuğu görselde 3 kat (karsi-bina.ts floors 3, fh 3.6) ama sim'de tek kat: zemin 4 şerit (k5 lokanta + k7/k8/k9), her biri sokağa kapılı.
- Oyuncu hareketi: walk.ts -> nav.move(solids). Üst geçit (ustgecit.ts) tek yükseltilmiş yol örneği; büfe çatı terası (kanat.ts katY) aktör y örneği.
- Oda sim'i (agents/kafe.ts) global nav kullanmaz: oda çerçevesinde düz adım + icYol; aktör y'si görünümde çizilir (agents-view a.y).
- K.playerPos = walk.pos (aynı nesne) -> pos.kat eklenirse mulk/ses/tutorial kontrolleri kat'ı görür.
- tests/browser/avm.mjs ve denetci.mjs kulis ad alanı zorunlu olunca bozulmuştu (ad doldurulmadan "Sahneye çık" açmıyor). denetci düzeltildi.
