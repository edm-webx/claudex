# ★5 kilidi: durum (2026-11-27)
- Hata: economy.ts ★5 koşulu `pads >= 16`; starReport.pads = S.owned sayısı, tadilat karesi owned olmaz, vapur penceresi silinince en fazla 15.
- Düzeltme: `pads >= 15` + metin "15 sarı kare" (src/content/economy.ts:93). Başka yerde 16'ya bağlı kural/metin/test yok (tarandı).
- Test: vitest tam takım 1217 yeşil (6 skip).
- TAM=1 tam oyun botu başlatıldı ama kullanıcı isteğiyle yarıda durduruldu: ölçüm tablosu YOK. Devam: `TAM=1 npx vitest run tests/sim/tam-oyun-botu.test.ts` (~66 dk), sonra aşama süreleri/gelir-saat tablosu sosisci-oyun/qa-2026-11-27/ekonomi.md'ye eklenecek. Bantlar gevşetilmedi.
