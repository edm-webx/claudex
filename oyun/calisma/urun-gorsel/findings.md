# Bulgular
- Restoran mutfak yemekleri (yemek-menu.ts DISHES, 38) her yerde aynı "tabak + yemek grubunun renginde basık top" idi:
  pass rafı ve istasyon tepsisi (ic-mekan-look tabak()+yemekRenk), oyuncunun eli/masa (rtview itemKey 'plate').
- Garson eli: chars itemMesh -> world.makeItem(dishId) bilinmeyen ürünü 'cay'a düşürüyordu: garson her yemeği ÇAY BARDAĞI olarak taşıyordu.
- Karşı yaka / AVM kalemleri (isletme-istasyon.ts KALEM, ~140) 12 aile modeli (fincan, bardak, tabak, kutu, torba...) x renk: kahveler, tatlılar, kumpirler aynı görünüyordu.
- Büfe 6 ürünü (props.ts itemInto, 4 kademe) zaten kendine has: dokunulmadı.
- Sipariş paneli yalnız yazı, dükkân menüsü emoji.
- Tepside yemekler üst üste yığılıyordu (büfe ürünü mantığı): artık 2x2 yan yana.
- check-dist'te önceden var olan FAIL: game.js içinde http://developer.nvidia.com/ (bu işten değil).
