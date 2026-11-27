# Bulgular

## Gün doğumu hız sıçraması (kök neden)
- Sim günü 08:00-27:00 (19 saat / 480 sn = 25 sn/saat). 27:00'da gün biter, kart açılır.
- Kart kapanınca boot-saat.ts "şafak koridoru" 27→32 (5 görsel saat) 5 GERÇEK saniyede oynatılıyordu, smoothstep ile ortada 1,5 saat/sn = normalin ~37 katı. Güneş yönü bu sırada ay yönünden (az -0.45) güneş yönüne (az 1.2) savruluyordu. Ardından 08:00'den itibaren normal hız: "aşırı hızlı sonra normal".
- Ek: güneş az/el tablo anahtarlarından Catmull-Rom ile geliyordu; 19.5→20.05→20.6 arasında yön geri dönüyor (az -1.3 → -1.0 → -0.6) ve yükseklik hızla artıyordu (el 0.12→0.75) ışık hâlâ güçlüyken: gün batımında gölgeler geri savruluyor.

## Mevsim
- hava.ts: 1 oyun günü = 1 takvim günü, gerçek tarih ileri giderse takvim atlıyor → mevsim fiilen gerçek hayat mevsimi (kışta 3 ay kış).
- Mevsimi farklı yerler ayrı okuyor: hava.ts (çapa tarih), customers.ts/yiyecek.ts/koleksiyon.ts/dekor-ev.ts (S.calendar ayı), headless clock.season.
