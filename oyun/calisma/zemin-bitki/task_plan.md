# Zemin ve bitki güzelleştirme (2026-11-26, dal claude/project-thread-5ibr1b, taban jo0q11)
İstek: kaldırım, asfalt, çim, çiçek, börtü böcek hepsi güzel görünsün. Tek stil, A2 kırmızı çizgi, bütçe gevşetilmez.
## Spec
- Zemin yüzeyleri: şu an dünya koordinatlı Poly Haven dokusu (zemin-detay.ts), ama büyük alanlarda tekrar ve düzlük var (meydan, kordon, yol).
- Çim: düz yeşil kutu; çiçek, ot kümesi, böcek yok.
## Plan
1. zemin-detay.ts shader: makro renk değişimi (tekrarı kırar), asfaltta yama/lastik izi, çimde ton lekesi + çiçek benekleri (sıfır üçgen).
2. Örnekli (instanced) ot/çiçek kümeleri: sadece çim alanlarında, kameraya yakın halka; üçgen bütçesi ≤ ~8k.
3. Kelebek + arı (instanced, birkaç adet), çiçeklerin etrafında; gündüz, yağmurda/gece yok.
4. Test: tsc, vitest, perf:gate, qa:normal; önce/sonra ekran görüntüleri.
## Kurallar
Minimal kod, instancing, performans bütçesi aynı, vapur yok, ana dala birleştirme yok.
