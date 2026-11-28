# Hata avı (2026-11-25), dal claude/project-thread-tz1bfz (base claude/restoran-ters-u f194f9f)

Sahibi: "güzel olmuş ama hâlâ çok bug, görsel bozukluk ve hata var" + somut liste (aşağıda). Restoran dosyaları (kanat, restoran-plan, bufe-buyume,
ic-mekan, workers/customers çatı rotası, restoran.ts) restoran thread'inin; onlara dokunulmadı, bulgular raporlandı.

## Adımlar
1. [x] Tepside / elde / pass'ta her yemek kendi modeli (content/prefabs/iskele/yemek-geo.ts, 38 yemek)
2. [x] Vapur kavramı tamamen kalktı (sayaç = tarife tahtası, pencere, vapur prefabı, görevler, panel yazıları, hikâye) ; ekonomi dengesi korundu
3. [x] İçeride arabayla yürüyen adamlar (müşteriye dönen vatandaşın bebek / pazar arabası)
4. [x] İşçi bulma panosu promenata (aşama 3+)
5. [x] Balıkçı (doğu kanat) sağ alt karanlık: kanat tavan lambaları
6. [x] İnşaat projektörleri
7. [x] Kötü havada ekranın kararması (hava-look dark tavanı)
8. [x] Testler (vitest) + perf kapısı
