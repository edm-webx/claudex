# Görsel model hata taraması (2026-11-23, thread 5ki0ot, base jo0q11 8e829bd)
İstek: tüm bölgelerde mikser tamburundaki çubuklar gibi görsel model hataları (yanlış duran, iç içe geçen, taşan geometri,
z-fighting, titreyen yüzey, eksik doku, havada nesne). Mantık/akış hataları ve laptop kasma işi kapsam dışı. A2 kırmızı çizgisi korunur.
1. [x] Mikser tamburu: düz şerit kutuları yüzeyden taşıyordu + tambur ters takılı (ağız kabine bakıyordu)
2. [x] denetci.mjs ile STAGE=10 tüm noktalar önce görüntüsü + insaat-shot
3. [x] es-duzlem (z-fight) taraması: iskele, avm, stadyum, belgrad
4. [x] Bulguları findings.md'ye yaz, düzelt
5. [ ] Sonra görüntüleri, tsc + vitest + qa:normal
6. [ ] push, rapor
