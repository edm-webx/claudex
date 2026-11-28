# Mutfak / geliştirme / tezgâh (2026-11-25)
1. Tezgâha bırakamama: restoran.ts rt.reserved açık HER masa adisyonunu (48 masaya kadar) elde taşınan ürüne "ayırıyordu"; sırada kimse yokken counter.ts pickDrop hiçbir şey indirmiyordu. Düzeltme: yalnız en eski 3 adisyon ayrılır (AYIRMA_BILET). Depo/stok yok: tezgâh 12'de dolar. tests/sim/tezgah-birakma-bos.test.ts.
   Denenip bırakılan: ayrılmışı da her zaman indirmek tam oyun botunu bozdu (tek oyuncu masayı elden servis eder).
2. Mutfak: istasyon yalnız bilet varken pişiriyordu. Bilet yokken artık o istasyonun açık menüsünden hazırlık (elde en çok 2 tabak). Devir (aşçıya devret) artık yalnız hazırlanacak yemek kalmazsa; devredilmiş istasyon önce geri alınır. tests/sim/mutfak-tum-istasyon.test.ts (aşama 3-10, her istasyon).
3. Geliştirmeler: salon/mutfak/dükkân eşyalarının hepsi yerleşimde çiziliyordu (tests/sim/gelistirme-gorunur.test.ts) ama salon çatısı dışarıdan düz beyaz kutuydu. Çatı oyuncu 5 m yakınken kalkar (bufe-buyume.ts SALON_CATI_YAKIN).
Probe: salon-probe.mjs (STAGE=7 node ... <out>), shots/.
