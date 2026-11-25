# İlerleme — KALDIĞIM YER (2026-11-25 21:10 UTC, kullanıcı "yarın devam" dedi)

Dal: claude/project-thread-b3u8z9 (taban jo0q11 fef56d9). jo0q11'e birleşmedi, zip yok.

## Bitti
- Kök neden: kart sonrası 27->32 şafak koridoru 5 gerçek saniyede oynatılıyordu (normalin ~37 katı) + güneş yönü tablo anahtarlarında geri savruluyordu.
- 24 saatlik gün (DAY_END_H 32, 08:00 -> 08:00, GAME_DAY_S 480 aynı), analitik güneş/ay yolu (tod.ts sunPath), şafak anahtarları, tod clamp hatası (27) düzeldi.
- Gece müşterisi/sokak/rol saatleri 24 saate yayıldı (inHours h-24 eşleşmesi), müşteri eğrisi integrali eşit. 0..24 varsayan gece kontrolleri (%24) düzeltildi.
- Oyun takvimi (hava.ts oyunTarihi/oyunHaftaGunu/oyunTakvim/havaAgirlik), eski kayıt göçü (tv=2), mevsim okuyan modüller tek kaynak.
- Hava rampası 1.2 saat, bulut ön toplanma (view.bulut, hava-look bulutK), gece/şafak pencereleri, chip ayText/gunText.
- Kar çatı örtüsü artık kioskRoof mesh'ine oturuyor (eskiden büfe önüne taşıyordu).
- Testler: tam set koşuldu, 8 kırmızının hepsi düzeltildi/gerekçeyle yeniden kalibre edildi (first-session parity ölçüm saati, set adımı max 420->480, tod/görsel saat, sokak rolleri). zaman-takvim.test.ts eklendi.
- 5 günlük bot geliri (tohum 1-3): 4. gün toplamı eski 249963 / yeni 249436 (eşit).
- Ekran görüntüleri: calisma/zaman-dongusu/kareler (git dışı) ve /mnt/project-files/zaman-dongusu-2026-11-25/.

## Yarım kalan / sıradaki
1. Tam oyun botu (TAM=1) önce/sonra karşılaştırması: iki koşu durduruldu, yeniden koş (her biri ~60 dk, 4 çekirdekte paralel yavaş). Komut: TAM=1 npx vitest run tests/sim/tam-oyun-botu.test.ts (taban için jo0q11 worktree).
2. Şafak şeridi kareleri (28.5..32) çekilmedi: node calisma/zaman-dongusu/seri.mjs --hepsi --sadece X (CPU boşken; swiftshader kar karesinde zaman aşımı yaşadı).
3. Kar karesinde ortam fazla güneşli: karda kararma flakeK*0.3 -> ~0.45 düşünülebilir; kar zemini birikimi yavaş (snowK 0.05/sn).
4. Kartta "gün sonu" 08:00'de çıkıyor: kullanıcıya sorulabilir (kart 08:00 mi, yoksa kartsız akış mı).
5. perf: geometri eklenmedi, perf:gate koşulmadı.
6. Tam test seti son değişikliklerden sonra (hava-look kar örtüsü) tekrar koşulmadı.
