# İlerleme
- 2026-11-28 16:10 TR: keşif bitti, plan yazıldı.
- 16:40: diyar (realm 'okul'), 13 oda + yerleşim, okul eşyaları, kapı geçişi, çarpışma (bolgeNav), görünüm (meydan, bina kabuğu, koridor, bahçe) yazıldı, boot'a bağlandı. Ses: koridor/oda döngüleri, bahçe ambiyansı 'karsi.okul', zil olayı 'okulZil'.
- 16:55: sim/agents/okul-yasam.ts: 28 öğrenci (4 sınıf x 7), 4 sınıf + fen + müzik öğretmeni, müdür, müdür yrd., sekreter, hemşire, kütüphaneci, hizmetli, veli. Program: giriş, tören, ders (fen/müzik dönüşü), teneffüs (koridor/kütüphane/sınıf), öğle (bahçe), çıkış. Eski ic-sakin OKUL kaldırıldı.
- Testler: tests/sim/okul-yasam.test.ts (4), ic-sakin ve ic-mekan (kantin odası) güncellendi. Tarayıcı çekimi: tests/browser/okul-ic.mjs.
