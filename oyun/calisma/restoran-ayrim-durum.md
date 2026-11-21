# Büfe ↔ Restoran+Mutfak ayrımı — durum (2026-11-21, kullanıcı "kaydet, durdur" dedi)

## Yapıldı
- Büfe ayrı, restoran+mutfak tek yapı: arada açık ara sokak; eski yapışık geçit ve aşama-9 sağdaki ayrı "Şef Mutfağı · Izgara" KALDIRILDI.
- Mutfak, salonlara yan duvarlardaki servis kapıları + kapalı servis koridorları ile bağlı (W salon aşama ≥6, E salon ≥7). Salonlarda "salon pass" tezgâhı; tabak masanın tarafındaki pass'a çıkar, o salonun garsonu alır (mutfak-hat yer: on/W/E).
- Aşçılar/şef gerçekten pişiriyor (şef de istasyon alıyor); boştaki aşçı arka istasyonda tezgâh siler, sıra halinde dikilmez. Koridorda işçi itişme kilidi düzeltildi (mutfakAlan).
- Mutfak rengi/tabelaları restoran diliyle aynı; aşama 6+ çatıda "SABRİ RESTORAN/SOFRASI" arması; aşama 10 kırmızı halı salon kapılarında.
- Masa payı arttı (ADISYON.share), kanat fiyatları aşama 6/8/9 yeniden ayarlandı.
- tsc temiz; mutfak-hat, asama-botu, mutfak, mutfak-buyume, asama10 testleri yeşildi.

## Kalan
- Gözlemci bot turu: tests/browser/restoran-tur.mjs (DIST=... STAGES=... node tests/browser/restoran-tur.mjs <çıktı>). Yalnız aşama 1 görüntüleri alındı, swiftshader yavaş; 10 aşama tam tur + gozlem.json (musteriPersonelAlaninda=0, garsonSalonPass>0) bakılmadı.
- Tüm sim/unit test paketi bu son hâlde koşulmadı (durdurma geldi).
- Kanat fiyatı ayarı sonrası ekonomi ölçümü tekrar yapılmadı.
- Büfe kulübesi aşama 5 sonrası az değişiyor; her aşama görünür fark için büfeye ek değişim düşünülebilir.
