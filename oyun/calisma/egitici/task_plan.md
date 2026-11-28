# Eğitici kartları (thread "Oyuncuyu yavaş yavaş öğreten eğitici sistemi yap")

Dal: claude/project-thread-hqvrbo (taban claude/project-thread-jo0q11 fef56d9). Konsept: konsept-egitici-kartlari.html (artifact 2rvDvTFjbfsvJjsf9jBURg).

## Kullanıcı kararları (2026-11-26 00:07 TR)
1. Kart tasarımı: **A Tente** (krem kâğıt, kırmızı-beyaz tente, kalın mürekkep çerçeve, Baloo 2).
2. Liste: "eklenecek ne varsa ekle, soru işareti kalmasın ama boku da çıkmasın, sıkıcı olmasın" -> 40 kart + sıkı sıklık sınırı.
3. İlk üç temel (yürü, döner, tezgâh) DURDURMADAN sadece okla (mevcut TUT okları), kart yok.

## Plan
1. `src/content/egitici.ts`: tüm kart verisi tek dosya {id, grup, oncelik ana|yan, baslik, metin, nasil?, hedef (anchor adı / dünya noktası / 'hud:<ad>'), kosul(v)}. HUD hedefleri isimle (hud:hedef, hud:mulk, hud:yetenek, hud:arkadas); yeni HUD gelince yalnız eşleme değişir.
2. `src/game/ui/egitici.ts`: görünüm tarafı denetçi (sim duraklıyken sistemler çalışmadığı için karar mantığı view update'te; headless.ts:190). Her ~0.5 sn koşulları tarar; kart açınca rt.paused=true, rt.pauseWhy='egitici'; kapanınca bırakır. Başka duraklama/panel (gunSonu, kasa, esnafim, mini, welcome, rt.panel, rt.boardOpen) varsa bekler.
3. Kayıt: st.tut['egt_<id>'] = playT (bulut kaydıyla taşınır, şema değişikliği yok). Kapalı bayrağı st.tut['egt__kapali']. Eski kayıt (playT > 900): temel grup görülmüş sayılır.
4. Sıklık: kartlar arası en az 45 sn oyun; 'yan' kartlar son 3 dk içinde kart çıktıysa atlanır, olay tekrar olunca yeniden denenir; zincir adımları (2-3 adım) arası bekleme yok.
5. Kamera: boot.ts:803 follow zinciri başına `egitici?.kamera() ??` ekle (yumuşak 1-exp(-4dt) kayış), kart kapanınca Sabri'ye döner. Hedef ekran konumu R.worldToScreen ile; karartma radial-gradient spotlight + kesik sarı halka + etiket (konseptteki gibi). HUD hedefinde DOM elemanının rect'i.
6. Ayarlar (v2ui.ts renderAyarlar ~834, panels.ts actionsFor 'ayarlar'): "Eğitici kartları" aç/kapa, "Baştan göster", "Tekrar izle" listesi.
7. Çok oyunculu: odada başka oyuncu varken oyunu DURDURMA (kart sadece görünür; online.ts remotes). Misafir kartları: rt.misafir.
8. Mülk/arsa: kamera arsaKapi(ar)'ya (content/esya ARSALAR). Şantiye görseli ayrı thread'de ("İnşaat ve tadilat alanlarına makine ve usta ekle"); hedef arsa verisinden gelsin, şantiye nesnesi gelince ona bakacak şekilde esnek.
9. Mevcut 'ipucu' toast'ları (tutorial.ts installTutorial ipucu sistemi, bina/bölge ilk giriş) bu kartlara taşınır, toast kaldırılır.
10. Test: vitest birim (koşul/sıra/sıklık saf fonksiyonları) + playwright ekran görüntüsü (arka.mjs benzeri), sonra commit/push. Yeni zip YOK.
