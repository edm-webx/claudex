# Hastane içi (2026-11-28) — plan
Sahip: "hastanenin içi de AVM gibi açılsın, çok detaylı olsun". Okul ayrı thread (dxorpc, realm 'okul' x 1300-1400).

1. [x] Kat planı: content/hastane-kat.ts (saf veri; 4 kat x 4 oda, ön bant, merdiven, 2 asansör, çarpışma, ajan yol bulma)
2. [x] Âlem: realm.ts 'hastane' x 1450-1550, bus:false; disari.ts `realmAt(p.x)?.bus !== false`
3. [x] Geçiş: sim/hastane-gecis.ts (iskele kapısı ↔ giriş, asansör yukarı/aşağı)
4. [x] Görsel: view/world/hastane-ic.ts (kesitli duvarlar, üst katlar gizli, dış meydan + ambulans, ışık/flaş yok)
5. [x] Yaşam: sim/agents/hastane-yasam.ts (~45 personel/hasta + ziyaretçi; kayıt, muayene, eczane, kan bağışı, kafeterya, başhekim)
6. [x] Test: tests/sim/hastane.test.ts; çekim: tests/browser/hastane.mjs
7. [ ] Sonra (sahip isterse): kafeterya/eczane oyuncunun işletmesi olsun (dükkan alımı), hastane görevleri
