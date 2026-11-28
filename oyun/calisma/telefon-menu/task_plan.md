# Telefon içi menüler (2026-11-27, kullanıcı: "telefon tuşlarına basınca her şey telefondan, ortada kocaman menü yok, telefon büyüyebilir")

## Hedef
Ekranın ortasında açılan büyük paneller (v2 sheet'leri, Çanta/Mülklerim/ATM kartı, Oyun kodu kartı, Koordinatör kartı) sağ altta duran
Esnaf telefonunun KENDİ ekranında açılsın. Telefon açıkken büyür (masaüstü dikey, kısa yatay ekranda yan çevrilmiş geniş telefon).

## Adımlar
1. Ortak telefon kabuğu CSS (telefon-kabuk.ts): geometri değişkenleri, çerçeve, çentik, durum çubuğu, ana ekran çubuğu.
2. v2 sheet: kabuk + "‹ telefon" geri düğmesi + ana ekran çubuğu (ui:open telefon).
3. mulk-panel kartı, online Oyun kodu kartı, koordinatör kartı kabuğa.
4. Telefon açıkken: toast/bildirim sola kayar, Arkadaş çağır gizlenir, alt bar telefonun altında kalır.
5. Rapor düzeltmeleri: ana menü yatay taşma, telefon ✕, harita SVG yazıları, Çanta Esc, bar etiket 10px.
6. Vapur: oyuncu etkileşimi ima eden UI metinleri.
7. Test: vitest + ekran görüntüleri 844x390, 932x430, 667x375, 1280x720.

## Durum (2026-11-27 gece)
Hepsi yapıldı. Kanıt: /mnt/project-files/sosisci-oyun/telefon-menu-2026-11-27/ (once/ sonra/, 4 çözünürlük). Betik: calisma/telefon-menu/shot.mjs
(rapor.json: "orta" = ekran ortasını kaplayan büyük kutu sayısı, hepsinde 0; "tasma" 0). vitest 176/176 dosya yeşil.
Bilinçli kararlar: arka plan karartması kaldırıldı (parlaklık sıçraması), "Arkadaş çağır" hapı gizli (telefon > Arkadaşlar),
bildirimler telefon açıkken telefon ekranının tepesinden iner, vapur güverte koşusu/ipucu OYUNCU_VAPUR=false ile kapalı.
Kalan: kulis (Karakter) tam ekran 3B sahne olarak kaldı; gün sonu/kasa sayımı/onay gibi olay kartları menü değil, ortada kaldı.
