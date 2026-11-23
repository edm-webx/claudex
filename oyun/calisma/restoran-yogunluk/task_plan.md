# Restoran 7-10 yoğunluk (2026-11-23, thread qog4c2, base jo0q11 51a6dc6)
Spec: aşama 7-10'da masalar çok bekliyor (beta 10 çıkış şartı). İşçi gerçek yürüyen ajan, stok yok, denge bozulmasın.
1. [x] Ölç: aşama botuna (tests/sim/asama-botu.test.ts) aşama başına masa bekleme dağılımı (ort/p95/max/%>30) eklendi
2. [x] Kök neden: garson zaman dağılımı + uzun bekleme anları
3. [x] Düzeltmeler (minimal, sim): menü+sipariş tek ziyaret, kapıda akış kontrolü, kadro, komşuluk hatası, hesap yaşlanması
4. [x] Kilit: aşama 7-10 eşikleri aynı testte; tüm vitest + tsc + lint:sim + restoran-carpisma (aşama 10)
5. [x] Push, Ana İş'e haber
