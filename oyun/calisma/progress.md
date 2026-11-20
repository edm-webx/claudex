# progress.md
- 2026-11-02 08:50 oyun/ klasörü repoya kopyalandı, build geçti (2.35 MB game.js).
- Mevcut halı saha: ui/hali-saha.ts içinde tek closure, AI = hx/hy çapa + Math.random vuruş/pas (kalıpsal). Lig: sim/lig.ts var (2 lig x 6 kulüp), kulüp kurma yok.
- 08:55 sim/macmotor.ts: saf, seed'li maç motoru (formasyon 2-2/1-2-1/2-1-1, rol: kaleci/defans/orta/forvet; presser+cover+adam savunma; destek noktası skorlama; xG tabanlı şut, hat/açıklık tabanlı pas; kaleci kurtarış/parry). 8 vitest: biter, NaN yok, gol 4-9/maç, pas isabeti %55-83, sıkışma yok, determinizm, seed çeşitliliği. 
- hali-saha.ts yeni motora bağlandı (UI sadece çizer), sonuç kartında istatistik, sonuç komutu `ist` taşır.
- Kulüp kurma: Stadyum sekmesi (ad+2 renk+arma), lig'de kulüp adı/rengi; halisaha.ts recordStats (çetele): form, averaj, takım toplamı, oyuncu gol/asist/kurtarış.
- tests/browser/bot-gezgin.mjs: 10 durak turu + maç + kulüp kurma; 0 bulgu. Bulunan gerçek bug: Belgrad tabelası "ELGRAD ORMA" kırpılıyordu (düzeltildi). "Boş stadyum" bot zamanlamasıydı (bölge ~30 kare sonra akar).
- vitest: 211+ geçti, eski 6 kırmızı aynı (animals x2, faz2-restoran x2, regulars x2).
## Kalan
Stadyum/Belgrad görsel zenginleştirme, HUD yeniden tasarım, büfe içi asset denetimi, halı saha 7v7 ve kulüp kadro/forma ekranı, çoklu oyuncu doğrulaması (bulutta yapılamaz).

## Aşama 7 (Belgrad, sokaklar, ses) — 2026-11-20 18:40 DURDURULDU (kullanıcı, limit tasarrufu)
Taban 4a36662. Dallar (origin): claude/project-thread-g3g2bo-a (ses para/mix: ses/gate.ts + api/audio/index/audio-map/boot/ses-db yarım, commit'li, qa YAPILMADI), -b (ambiyans/müzik: değişiklik yok), -c (sokak vatandaşları: değişiklik yok), -d (orman görsel: değişiklik yok), -f (gözlem botu: gozlem-lib.mjs + gozlem-sinama.mjs yarım). Plan: paketler studyo/uzman-paketleri.json, brif /tmp scratchpad ORTAK-BRIEF (kurallar: stok yok, gerçek işçi, hikâye/8x/kulübe KOSULLU, para sesi yumuşak). Devam emriyle: a'yı bitir (qa:hizli), sonra b, c, d, f.
