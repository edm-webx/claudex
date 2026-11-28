# QA 2026-11-27 teknik rapor YÜKSEK bulguları (thread "Fix multiplayer money, save and login bugs")
Kaynak: /mnt/project-files/sosisci-oyun/qa-2026-11-27/teknik.md. Taban jo0q11 b93e768. Dal claude/project-thread-ojdgng.
- [x] 1 Çok oyunculu: kasa doğrulama (tip, gönderen misafir, kişi başı dakikalık bütçe) + dunya ev sahibine sabit (net/oda-dogrula.ts)
- [x] 2 Çift sayım: ev sahibine yalnız MISAFIR_IS satışı (rt.misafirSatis, economy.ts book)
- [x] 3 Bozuk kayıt: adopt dizi/ilkel reddi, validate hatası = kullanılamaz slot, sim.load geri alma, açılışta kayıt kurtarma (sim/kayit-kurtar.ts)
- [x] 4 Admin XSS: data-* esc, presence uid yalnız uuid karakterleri
- [x] 5 Giriş: fetch zaman aşımı 20 sn + arayüz emniyeti, çift gönderim kilidi, ham İngilizce hata yok
- [x] 6 Kalite: 3lecyq parkı (GPU adı, açılış sınaması) + bilinmeyen kart Dengeli + piksel tavanı + 60 fps tavanı
- [x] 7 itch: zip index.html DOCTYPE, yükleme bekçisi (Tekrar dene), e.code WASD, Space düğmede
- [ ] E-posta (martikoy.<ad>@gmail.com) riski: kullanıcıya soruldu, kod değişmedi
