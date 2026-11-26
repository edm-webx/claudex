# İlerleme — 2026-11-26 tamamlandı (kullanıcı onayı bekliyor, jo0q11'e birleşmedi)

Dal: claude/project-thread-b3u8z9 (taban jo0q11 fef56d9).

## Yapılanlar
- Kök neden: kart sonrası 27->32 şafak koridoru 5 gerçek saniyede oynatılıyordu (~37x hız) + güneş yönü tablo anahtarlarında geri savruluyordu. tod.ts'de 27 clamp hatası.
- 24 saatlik gün (DAY_END_H 32, 08:00 -> 08:00, GAME_DAY_S 480 aynı, 20 sn/saat), analitik güneş/ay yolu (doğuş 05:42, batış 20:00), devir ışık sönükken.
- Gece müşterisi/sokak/rol saatleri 24 saate yayıldı (inHours h-24), müşteri eğrisi integrali eşit; 0..24 varsayan gece kontrolleri %24.
- Oyun takvimi (1 oyun günü = 1 hafta, mevsim ~13 gün, kenar karışımı), eski kayıt göçü, tek mevsim kaynağı oyunTakvim.
- Hava rampası 1.2 saat, bulut ön toplanma, gece/şafak pencereleri, gökkuşağı sadece gündüz. Kar bulutlu gün; kar çatı örtüsü kioskRoof'a oturuyor.

## Doğrulama
- Tam test seti: 1201 geçti, 0 kırmızı (2026-11-26).
- Tam oyun botu TAM=1 (aşama dk, eski -> yeni): 2: 32.5->33.7, 3: 93.9->92.9, 4: 349->344.6, 5: 665.4->645.7, 6: 1015.7->943, 7: 1527.7->1478.3, 8: 2066.8->2065.5, 9: 2612.6->2605.7, 10: 3144->3144.9. Bulgu/tıkanma yok. Son para 54.0M -> 64.6M (+%20, gece geliri; aşama süresine etkisi yok).
- 5 günlük bot geliri (tohum 1-3) 4. gün toplamı 249963 -> 249436.
- Perf kapısı YEŞİL: dengeli karşı yaka 597181 / 616981 üçgen (bu iş geometri eklemedi).
- Kareler: /mnt/project-files/zaman-dongusu-2026-11-25/ (ana 7 kare + şafak şeridi 04:30-07:15, ortalama parlaklık 48->46->58->69->84->102 düzgün).

## Açık karar
- Gün sonu kartı 08:00'de çıkıyor; kalsın mı / kartsız mı (kullanıcıya soruldu).
