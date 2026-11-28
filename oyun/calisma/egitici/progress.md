# İlerleme
## 2026-11-26 — Sistem kuruldu (dal claude/project-thread-hqvrbo)
- src/content/egitici.ts: 42 kart (metin, tetik, hedef, HUD adı), HUD_HEDEF eşlemesi (eski ve yeni HUD seçicileri sırayla denenir), zamanlama EGT_ZAMAN.
- src/game/egitici-karar.ts: saf seçim (sıra=öncelik, 45 sn ara, 'yan' kartlar 150 sn, eski kayıtta bilinenler görülmüş sayılır, baştan göster).
- src/game/ui/egitici.ts: Tente kartı, duraklatma (pauseWhy 'egitici', odada başka oyuncu varken durdurmaz), kamera hedefe uçar (boot.ts follow zinciri), delikli karartma + kesik halka + etiket, HUD hedefinde yuvarlatılmış dikdörtgen; Enter/Boşluk/Esc; çok sayfalı kart.
- Ayarlar sekmesi: Eğitici kartları aç/kapa, Baştan göster, Tekrar izle (v2ui.ts renderAyarlar, panels.ts).
- tutorial.ts: kartın anlattığı bina/bölge çipleri (EGT_IPUCU_KAPSAR) eğitici açıkken toast olmaz.
- Test: tests/unit/egitici.test.ts (7), ipucu/hali-saha-girdi/ekip-tahtasi geçti; tsc + lint-sim temiz; tarayıcıda kart, duraklama, kapanış, arsa uçuşu, HUD halkası, ayarlar ekran görüntüsüyle kontrol edildi (project-files/egitici-2026-11-26). Tam vitest paketi 10 dk'yı aştığı için koşturulmadı.
## Bilinen / açık
- HUD thread'i (dal b1jn50) birleşince: telefon/büfem kartları kendiliğinden devreye girer (HUD'da o düğme varsa). Mülk/harita/çanta hedefleri yeni seçicilere düşer.
- Arsa satın alma ve Emlak ofisi ertelendi (HUD thread notu): arsa kartları yalnız arsa sahibi olunca çıkar, ARSALAR verisine bağlı; şantiye görseli gelince hedefi ona çevir.
- Uzak arsada (x≈260) çevre zemini headless'ta boş görünüyor; kart çiti ve binayı gösteriyor. Bölge yüklemesini hedefe kaydırmak denendi, büfe zemini boşaldığı için geri alındı.
- Ana dala birleştirme yok, kullanıcı "tamam" diyene kadar.
