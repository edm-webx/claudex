# Karakter Atölyesi (karakter yaratıcı baştan) — plan

Hedef: kulis yaratıcısını baştan yap. Önce Erkek/Kadın seçimi, seçenekler bedene göre. Gerçek 3D saç/sakal/bıyık
(prosedürel, Three.js), makyaj, kıyafet, aksesuar, yüz/vücut, sınıflar. Mobilde panel karakteri örtmez (360px + yatay).
4 yuva + silme akışı ve eski kayıtlar çalışır. Kıyafet verisi ileride premium market için genişletilebilir.

## Aşamalar
1. [ ] İnceleme: kulis.ts, esnafim.ts, chars-v2.ts (hairPieces, buildHeroMesh, paintFace), slots.ts, boot.ts
2. [ ] Saç kiti (src/game/view/chars/v2/sac-kit.ts): kabuk + perde + tüp üreticiler, ≥20 stil (erkek/kadın)
3. [ ] Sakal/bıyık kiti: kabuk maskeleri (tam, kısa, keçi, çember, çene, favori, uzun), bıyık eğrileri (≥7)
4. [ ] Makyaj: far, eyeliner (ince/kanat), kirpik, allık rengi, ruj, ben (paintFace/paintFaceX)
5. [ ] Katalog (src/content/karakter-katalog.ts): tüm seçenekler tek yerde, beden filtresi, premium alanı
6. [ ] Yeni UI (kulis.ts yeniden): beden seçimi ekranı, kategori rayı, küçük resimli seçenekler, geri al, rastgele (beden kurallı), kamera yakın/uzak, setViewOffset ile karakter boş alanda
7. [ ] Kayıt: yeni alanlar opsiyonel + doğrulama, eski kayıt göçü, slot özeti
8. [ ] Test: birim (applyEsnafim, rastgele kuralları, katalog), tarayıcı ekran görüntüleri (1280x720, 360x740, 740x360)
9. [ ] Push + Ana İş'e haber

## Kararlar
- Kadın bedende sakal/bıyık sekmesi yok; erkekte makyaj sekmesi yok (kullanıcı: "adam mı kadın mı seçsin, ona göre").
- Elbise/etek yalnız kadın bedeninde.
- Saç rengi: doğal palet + fantezi palet.
