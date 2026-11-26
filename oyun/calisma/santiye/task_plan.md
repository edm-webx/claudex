# Şantiye: inşaat / tadilat / geliştirme anlarına makine ve usta (2026-11-25)
Sahip isteği: inşaat, geliştirme, tadilat sürecindeki HER yerde projenin büyüklüğüne göre makine, araç, usta. Arsa alınınca arsa nerede belli olsun, ev yapılıyorsa ev görünsün (aşamalı).

## Aşamalar
1. [x] Envanter: koddaki tüm inşaat anları (findings.md)
2. [x] Set kararları: content/santiye.ts SETLER (küçük/orta/büyük/dev) + YAPI_ASAMA
3. [x] Kit: view/world/santiye-kit.ts (tek Batch mesh + birkaç hareketli grup + Points toz)
4. [x] Konsept görseller: calisma/santiye/shot/*.png (konsept.html + shot.mjs, vite dev 5199)
5. [ ] Büfe tadilatı: boyuta göre set (bufe-buyume buildSite) + usta sayısı
6. [ ] Karşı yaka / AVM işletme tadilatı: boyuta göre set + usta sayısı 2/3/4/5
7. [ ] Arsa: haritada görünür yere taşı (karar), ev/dükkân süreli aşamalı yapım (sim Plot.insa) + ustalar + kamera/işaret
8. [ ] Test: vitest, typecheck, oyunda ekran görüntüsü, perf (karşı yaka ≤617k üçgen)
9. [ ] Ses thread'ine not (matkap, çekiç, betoniyer, vinç, geri vites bip)
