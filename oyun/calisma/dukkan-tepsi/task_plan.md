# Dükkân kareleri + makine tepsisi (2026-11-23)
İstek (sahip): "meydan kafe'nin kareleri neden dışarıda kaç metre uzakta? niye espressonun başına gidip kahve yapıp tepsiye alamıyorum"
+ "bir tek meydan kafe değil satın alınabilen tüm mekanlara bak düzelt".
Spec: kareler dükkânın kapısında / içinde; makine: başına git (tezgâh arkası ya da önü), ürünü koy, makine yapar, ürün TEPSİYE gelir,
müşteriye götürüp verirsin. Stok yok (tepsi dükkândan çıkınca boşalır), işçiler eskisi gibi gerçek yürüyen ajan.
- [x] Ölç: her satın alınabilir dükkânın karelerinin kapıya uzaklığı (sim testi tablosu)
- [x] Kafe kareleri: satın alma kapının önünde, aletler içeride (icKareYerleri); diğer sokak dükkânları kapının iki yanında
- [x] Kare dolunca aynı yere çıkan yeni kare oyuncu inmeden para çekmesin
- [x] kafe.ts: makine iki yanlı (müşteri + personel tarafı), tepsiye al, kuyruk noktalarında servis; elle istasyonlar da tepsiye
- [x] Görünüm: kahramanın tepsisinde ürün modeli (rtview, AVM katında da)
- [x] Testler: dukkan-tepsi.test.ts (18 canlı dükkân), eski 3 test yeni akışa
- [x] Tarayıcı: tests/browser/meydan-kafe.mjs yürüyerek uçtan uca
