# İlerleme / ölçüm (aşama botu, tohum 20261121, aşama başına 3 oyun günü)
Önce (51a6dc6) -> Sonra
| aşama | menü ort / max | sipariş ort / max | hesap ort / %>30 | gelir/gün |
|---|---|---|---|---|
| 7 | 20.3 / 59.5 -> 13.3 / 32.5 | 21.3 / 58 -> 5.6 / 6.8 | 22.4 / %32 -> 14.9 / %5.8 | 645k -> 701k |
| 8 | 22.4 / 54 -> 12.9 / 32.5 | 23.2 / 55.8 -> 6.4 / 18.5 | 23.3 / %31 -> 13.4 / %4 | 877k -> 1.04M |
| 9 | 21.7 / 65.5 -> 13.6 / 36.8 | 22.1 / 56.8 -> 6.7 / 17.8 | 21.4 / %28 -> 13.1 / %3.1 | 2.23M -> 2.63M |
| 10 | 22 / 56.3 -> 12.3 / 33.8 | 20.7 / 60.5 -> 6.4 / 18 | 17.8 / %20 -> 13.9 / %3.1 | 4.28M -> 5.07M |
Aşırı yük olayı (30 sn+, herkes meşgul): menü 264 -> 18, sipariş 206 -> 0, hesap 247 -> 45. İhlal 0.
Gelir +%10-20 (daha az kızgın kalkış, masa daha çabuk boşalıyor); aşama 6 -%11; hepsi GELIR_ARALIK içinde. Garson maaşı ciroya oranlı.
Testler: vitest 163 dosya / 1086 test yeşil, tsc, lint:sim OK, restoran-carpisma BOT_ST=10: 0 hit.
