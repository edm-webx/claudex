# BUF-29 akicilik olcumu (SwiftShader, 640x360, tier dengeli, 60 kare/nokta, bufe-onu)
Ham veri: perf-asama-onceki.json, perf-gecis-onceki.json. Raster SwiftShader (yazilim) oldugu icin yalniz sim adimi ve JS tarafi guvenilir.

| Asama | sim p50/p95 ms | JS render p50/p95 ms | aktor (calisan) | musteri | agents guard ort ms |
|---|---|---|---|---|---|
| 3  | 0.3/2.2 | 5.7/18.8 | 22 (8)  | 16 | 0.57 |
| 6  | 0.4/2.5 | 7.9/(1040*) | 33 (19) | 19 | 1.18 |
| 10 | 0.5/4.5 | 8.9/(1309*) | 49 (35) | 42 | 1.22 |
(*) p95 SwiftShader gl.finish/raster kuyruk sicramasi (render guard maks 1.1-1.6 s, JS sistemleri maks <10 ms). Gercek GPU'da gecerli degil.

Bufe-buyume yeniden insa: 1->10 gecislerinde 3 / 14.8 / 13.1 / 12.2 / 20.5 / 28.6 / 38.6 / 34.9 / 34.2 ms (tek kare, kalici maliyet yok; geo 180->244).
Ajan tavani: en kalabalik durumda registry 49 aktor + crowd.visible 50, AGENT_CAP 256 ve tier butcesi (50) altinda.
KDS (0.7 sn kisitli), mutfak-canli ve odalar (mesafe LOD) zaten LOD'lu; yeni LOD eklenmedi.
Sonuc: olculen gercek darbogaz yok, kod optimizasyonu yapilmadi. Eklenen: boot.ts perfGuard olcum kancasi (yalniz perfRecord acikken), perf-asama.mjs, perf-gecis.mjs.
