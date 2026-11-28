# Bulgular

## Aşama 2 "80 dk takılma" = ölçüm artefaktı (gerçek kilit değil)
Taban kod (aaa2e34), tam oyun botu tohum 11, 700 oyun dk, kayıt turu kapalı:
- aşama 2 @ 36,3 dk, aşama 3 @ 94,2 dk (hedef 120 ±%35 = 78-162: bant içinde), aşama 4 @ 322,2 dk (hedef 300, 195-405: bant içinde).
- Aşama 3 şartı 120.000 ₺ + ★3 (plaket + gurme). Bot ★4'e 40. dakikada varıyor; bekleten yalnız para. 80 dk'da 72-110 bin ₺ birikmiş oluyor, 120 bine ~90. dk'da ulaşıyor.
- QA koşusu 80 dk'da kesildiği için "hiç geçemedi" görünmüş. Aşama 2'de bekleme ~58 dk (ölü bölge sınırı 90 dk altında); bu sırada Meydan Kafe (k1) karesi açık ve alınabilir (bot tadilata para biriktirdiği için 109. dk'da alıyor).

## Aşama 3 -> 4
Bu tabanda 228 dk (94 -> 322), ekonomi raporundaki 510 dk değil (o ölçüm dekor eşiği düzeltmesinden önceydi, b93e768). 260-300. dk arası yalnız kilitli kareler var ama para 650k tadilata birikiyor (~40 dk).

## Aşama 4 ölü bölge (gerçek)
360. dk'dan sonra açık kare yok: k6🔒 (5★ ister), k3/k4 tadilat🔒 (aşama 5 ister). ★5 kuralı (pads>=16) ayrı thread'de düzeltiliyor.
