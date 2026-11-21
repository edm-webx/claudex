# Maç kalitesi raporu (fut02-sonra)
216 maç (bot-bot 54, insan botu 162), 24 sn. Sabit 1/60 adım, 2 x 75 sn.
| Metrik | Değer | Hedef | Durum |
|---|---|---|---|
| Kaleci kovalama (ort / en kötü maç) | 0 / 0.001 | < 0.01 | tamam |
| Kaleci alan dışı süre | 0 | < 0.01 | tamam |
| Kaleci y'sinin uzak topa eğimi | 0.029 | küçük (1 = birebir takip) | - |
| En uzun takılma (sn) / >3 sn maç | 0.033 / 0 | 0 maç | tamam |
| Duvara yapışma en uzun (sn) | 0.55 | < 3 | tamam |
| Taşıyıcı çizgide takılma en uzun (sn) | 0.683 | < 0.8 | tamam |
| Jitter (yön değişimi/sn, ort / max) | 1.498 / 1.709 | < 2 | tamam |
| Pas isabeti (bot-bot) | 0.663 | 0.6-0.85 | tamam |
| Pas/maç, ort. uzunluk (m), ileri/geri/yan | 91.417, 7.481, 0.591/0.225/0.184 | - | - |
| Şut/takım (bot-bot) | 7.769 | 6-14 | tamam |
| İsabet oranı, xG/takım, gol/xG | 0.731, 3.26, 1.258 | - | - |
| Gol/maç ort (min-max, %10-%90) | 8.204 (2-17, 5-12) | 3-12 | tamam |
| Topa sahip olma aralığı (%, bot-bot / tümü) | 36-66 / 19-66 | 25-75 (bot-bot) | tamam |
| Yığılma (≥5 oyuncu 4 m içinde) | 0.022 | < 0.3 | tamam |
| Takım arkadaşı çakışması (<1.5 m) | 0.323 | düşük | - |
| Alan kapsamı (ısı entropisi 0-1) | 0.632 | yüksek | - |
| Olay n-gram: tekil 3-gram / 4-gram, en sık 3-gram payı | 642 / 2385, 0.045 | çok çeşit, pay düşük | - |
| Başlama vuruşu yol farkı (m, 3 formasyon) | 13.35 / 11.47 / 11.62 | > 4 (küçük = kalıp) | tamam |
| Farklı skor sayısı | 74 | çeşitli | - |
| Faul/maç | 2.5 | 2-6 | tamam |
| Kart/maç, direk/maç, penaltı/maç | 1.222, 1.111, 0.315 | - | - |
| Duran top/maç | kale 5.814, serbest 2.204, korner 1.281, tac 3.15, penalti 0.331 | - | - |
| Güçlü (0.7) vs zayıf (0.5), 300 maç: G/B/M | 0.633 / 0.137 / 0.230 | G > 0.6, M 0.1-0.3 | tamam |
