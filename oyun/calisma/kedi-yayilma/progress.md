# Kedi iç içe gezme düzeltmesi (2026-11-25)
Dal: claude/project-thread-mq70uj (base jo0q11)

## Yapılan
- src/game/sim/agents/cats.ts: kedi başına ayrı dinlenme noktası (çıpa + zemin halkaları, SPOT_GAP 0.7), oyuncu etrafında kedi başına ayrı slot (2 halka), yürüyen kedide ayrılma itmesi (CAT_R 0.5).
- tests/sim/kedi-yayilma.test.ts: 6 kedi, ~6 dk oyun, 0.5 m altı çift ölçümü.
## Ölçüm (kare oranı iç içe)
- Önce: duran %97, yürüyen %100, en yakın mesafe 0
- Sonra: duran %1.8, yürüyen %1.0, en yakın 0.19 / 0.34
## Testler
- tsc ve lint:sim temiz; tests/sim: 674 geçti, 1 kaldı: kanat-masalar.test.ts "pasif salon geliri yok" (kedilerle ilgisi şüpheli, base dalda da kırık mı bakılmadı).
## Sıradaki
1. kanat-masalar testini base dalda çalıştırıp kırığın bizden olup olmadığını doğrula (kedi RNG akışı değişmiş olabilir).
2. Kalan kısa çakışmalar: yürüyen kedi–uyuyan kedi, purr–purr. İstenirse uyuyanı da it.
3. Tarayıcı botuyla gerçek sahnede göz kontrolü.
## Açık karar
- Kedi-insan/eşya çakışması bu işte ele alınmadı (nav.walkable kontrolü dışında).
