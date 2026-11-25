# İlerleme
2026-11-25 20:16 UTC başladı. 20:35 4 konsept üretildi (/mnt/project-files/sosisci-oyun/giris-aaa-2026-11-25/). 20:28 kullanıcı A (Altın Saat) seçti, stüdyo adı "EDMX Studios" (web'de oyun stüdyosu çakışması yok; mağaza öncesi TÜRKPATENT önerildi).

## Yapılanlar (bu dal, commit edildi)
- src/game/ui/menu-font.ts: Baloo 2 + Rubik gömülü (OFL), özel adlar 'SB Baslik'/'SB Govde' (HUD yazısı değişmez). Üretici: calisma/giris-aaa/font-uret.mjs
- src/game/ui/menu-stil.ts: ortak Altın Saat stili (renk katmanı, siyah şeritler, martılar, zerreler, altın logo, cam panel, menü, ayar/kredi, perde, mobil düzen)
- v2ui.ts U.title yeniden: "Başlamak için tuşa bas/dokun" -> Oyna / Arkadaşınla oyna / Ayarlar / Yapımcılar, klavye ↑↓ Enter Esc, müzik aç/kapa. Oyna'da data-play korunuyor (testler).
- giris.ts: sadece görünüm (CSS + .gr-host + mn-panel), mantık aynı.
- view/menu-kamera.ts + boot.ts: menuModu (HUD gizli, kamera cam.fp ile iskele yörüngesi, ışık 18.3, uzak vapur ferryFar menüde gizli, çıkışta perde). "Arkadaşınla oyna" oyuna girince .on-oda'ya tıklar.
- panels.ts: ayarEylem() (menü ayarları için)
- tools/build-artifact.mjs: yükleme ekranı yeni stil, arka plan koyu.

## Testler
- tsc temiz, npm run build tamam (check-dist nvidia URL hatası TABANDA da var), game.js +~170 KB.
- Akış testi /tmp script (menü, ayarlar, klavye, Martı Kimlik hata/admin/unuttum/kayıt/misafir) 18/18 PASS.
- boot.spec 20/23, kayit-guvenligi, kayit-rozet: AYNI hatalar tabanda da var (önceden kırık).
- vitest: arka planda koştu, sonuç görülmedi (yeniden çalıştır).

## KALDIĞIM YER / SIRADAKİ
1. Headless (swiftshader) ekranda menüde iskele zemini bembeyaz görünüyor: sebep pierRoot/lampGlow (glowSet: düzlem + Points halo), gece faktörü n küçükken (18.3). lampGlow gizlenince düzeliyor. Gerçek GPU'da (kullanıcının PC) kontrol et; gerçekse menüde MENU_SAAT'i değiştir ya da halo boyutunu düzelt.
2. Kullanıcının PC'sinde gerçek ekran kartıyla önce/sonra görüntüleri al (build'i PC klasörüne kopyala, Claude Browser ya da yerel sunucu).
3. Menü kamera kadrajını gerçek görüntüde ince ayarla (masaüstü yaw +0.13, telefonda r 54).
4. Kullanıcıya göster, onay gelince Ana İş thread'i jo0q11'e birleştirsin. Yeni zip ÜRETME.
## Açık sorular
- Dünyadaki uzak vapur (ferryFar) oyun içinde de duruyor; kullanıcı vapur istemiyor -> tamamen kaldıralım mı sor.
- Yapımcılar'da "Kod ve tasarım ortağı: Claude (Anthropic)" satırı kalsın mı sor.
