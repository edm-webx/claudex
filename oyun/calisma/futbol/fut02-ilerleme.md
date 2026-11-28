# FUT-02 takım yapay zekası: bitirme (thread "Halı saha takım yapay zekası", 2026-11-21)
Taban: 7babb68 (WIP dfbb08c). Dal: claude/project-thread-1upa5a.

## Bulgular (taban ölçüm, node tools/mac-metrik.mjs --n 6 --guc 300, 216 maç)
- Tüm FUT-01 eşikleri tamam: kaleci kovalama 0/0.001, alan dışı 0, takılma 0 maç, jitter 1.50/1.69, pas isabeti 0.665,
  şut/takım 7.47, gol/maç 8.08, sahip olma 38-67, yığılma 0.027, faul 3.42, güçlü/zayıf G 0.713 M 0.203.
- 53/53 macmotor testi yeşil, tsc temiz.
- Eksik kapsam: (1) halisaha.macAyari plan adları 'pres|dengeli|kontra', motor 'kisa|uzun|kanat' bekliyor: geçersiz sayılıp
  rastgele seçiliyordu, savunma tavrı hiç yoktu. (2) macAyari insan maçına bağlı değil (sabit skill 0.6 / 0.55+). (3) duran top
  seçenekleri tek tip (kale vuruşu ve taç hep en iyi pas). (4) karar zamanlaması baskı/bölgeye bağlı değil. (5) guc 66 vs 40 ölçülmedi.

## Yapılan (hepsi ölçüldü)
- [x] Motor: savunma tavrı TAVIRLAR pres/dengeli/kontra (MatchOpts.plan dizgesinden, 'kanat-pres' gibi birleşik de olur; m.tavir).
  Blok yüksekliği, pres tetiği (pres: rakip yarıda da 2. presçi; kontra: rakip yarıda 2. presçi yok), markaj sıkılığı, kontra
  forveti çizgide bekler ve ara pas eğilimi artar. Ölçüm: savunma çizgisi (en geri iki oyuncu) pres 13.6 m, kontra 9.7 m.
  Denge (150'şer maç, eşit beceri): pres-kontra G .47 B .18 M .35; pres-dengeli .41/.23/.36; kontra-dengeli .39/.13/.47.
- [x] Karar zamanlaması: baskı altında 0.14-0.30 sn, son üçte birde 0.15-0.35, boşta 0.2-0.52 (x görüş katsayısı).
- [x] Duran top seçenekleri: korner kısa / ön direk / arka direk (havadan ya da yerden); kale vuruşu kısa boş savunmacıya ya da
  (uzun plan / kontra tavrında daha sık) forvete havadan; taç çizgi boyu öndeki arkadaşa ya da en iyi kısa pas.
- [x] macAyari insan maçına bağlı: halisaha.ts kabul -> haliSahaMac.ayar; hali-saha.ts createMatch skill/formations/plan oradan
  (eski kayıtta ayar yoksa eski değerler). Seyirci/bahis modu (izleMac) değişmedi, determinizm testi yeşil.
- [x] Zorluk eğrisi: gucSkill(66) vs gucSkill(40), 300 maç: G .643 B .12 M .237 (hedef G > .6, M .1-.3). 58 vs 50: .49/.13/.38.
- Sonra ölçümü: olcum/fut02-sonra.md (216 maç, tüm eşikler tamam; faul/maç 3.42 -> 2.5, hâlâ 2-6 bandında).

## Testler
- tsc temiz. macmotor* + kulup-mac + mulk: 91/91 yeşil (3 yeni FUT-02 testi + kulup-mac'te ayar kontrolü).
- Tam vitest: 809 yeşil, 4 kırmızı: ipucu, baglilik, ekonomi-egri, faz2-ekonomi. Dördü de taban 7babb68'de aynı şekilde kırmızı (bizden değil).

## Açık / doğrulanmadı
- Tarayıcıda gerçek maç ekranıyla oynanarak bakılmadı (yalnız başsız motor ölçümü). Görsel/3D bu işin dışında.
