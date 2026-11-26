# Kedi iç içe gezme düzeltmesi (2026-11-25)
Dal: claude/project-thread-mq70uj (base jo0q11)

## Yapılan
- src/game/sim/agents/cats.ts: kedi başına ayrı dinlenme noktası (çıpa + zemin halkaları, SPOT_GAP 0.7), oyuncu etrafında kedi başına ayrı slot (2 halka), yürüyen kedide ayrılma itmesi (CAT_R 0.5).
- tests/sim/kedi-yayilma.test.ts: 6 kedi, ~6 dk oyun, 0.5 m altı çift ölçümü.
## Ölçüm (kare oranı iç içe)
- Önce: duran %97, yürüyen %100, en yakın mesafe 0
- Sonra (final): duran %0.5, yürüyen %0.5, en yakın 0.40 / 0.37
## Testler
- tsc, lint:sim temiz; tests/sim 103 dosya geçti. kanat-masalar 'pasif salon' testi kedi ziyaretinin başarım ödülünü (+6 TL, Kedi Defteri) pasif gelir sanıyordu; test ödülü hariç tutacak şekilde düzeltildi (zaman tesadüfü, kedi kodu para üretmiyor). Zemin dinlenme noktaları oyuncunun 2.5 m içine konmaz.
## Kalan
- Tarayıcı botuyla gözle kontrol yapılmadı (yalnız sim ölçümü). Kedi-insan/eşya çakışması ele alınmadı.
