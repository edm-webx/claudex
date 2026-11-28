# Büfe ↔ Restoran+Mutfak ayrımı: durum (2026-11-22, BİTTİ)

## Yapıldı
- Büfe ayrı yapı, restoran + mutfak tek yapı; aradaki yapışık geçit ve aşama 9'daki ayrı "Şef Mutfağı · Izgara" kaldırıldı.
- Mutfak salonlara yan servis kapıları + kapalı koridorlarla bağlı (W salon aşama ≥6, E ≥7). Her salonun pass tezgâhı var; tabak masanın tarafındaki pass'a çıkar, o salonun garsonu alır.
- Aşçılar ve şef istasyonlarda gerçekten pişiriyor. Boştaki aşçı kendi arka hat istasyonunda, komi ön hattın hazırlık tezgâhında (salata/meze/tatlı) siler; koridorda dizilme yok.
- Büfe kulübesi aşama 6-10'da da değişiyor: 6 çizgili tente + spot, 7 dijital menü panoları + neon şerit, 8 sarkıt pirinç lambalar + ahşap kaplama + mavi tente, 9 kırmızı çatı tabelası, 10 lacivert/altın tente + altın köşe direkleri.
- Mutfak rengi ve tabelaları restoranla aynı dilde; aşama 6+ çatıda restoran arması; aşama 10 kırmızı halı salon kapılarında.

## Doğrulama
- tsc temiz; tüm sim/unit testleri: 1008 geçti (tek kırmızı, eski gezgin manifesti, yenilendi).
- Ekonomi (12 dk, tam kadro, tohum 9/13): aşama 6 -4%/+23%, 8 0%/+7%, 7 ve 10 değişmedi.
- Tarayıcı gözlemci botu (tests/browser/restoran-tur.mjs), 10 aşama: masada yiyenlerin payı aşama 3'te %30, aşama 9-10'da %76-80; salon pass'larından garson tabak alıyor; mutfağa/koridora giren müşteri 0 (çatı merdiveni hariç); sayfa hatası 0.
- Öncesi/sonrası görüntüler: /mnt/project-files/sosisci-oyun/restoran-ayrim-2026-11-21/

## Bilinen
- Botta her aşamanın ilk görüntüsü bazen kararık çıkıyor (aşama atlatınca gelen açılış efekti); oyunda sorun değil.
- Çay bahçesindeki yeşil karelerin dağınık görünümü önceden de vardı, bu işin kapsamı dışında.
