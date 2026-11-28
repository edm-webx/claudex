# Aşama 6: Halı saha ve stadyum v2.0 (2026-11-20)
Dal: claude/project-thread-wa2wu6 (taban jo0q11 @ 4a36662). Entegrasyon: ana thread merge eder.
Kaynak paketler: /mnt/project-files/sosisci-oyun/plan-2026-11-13/studyo/uzman-paketleri.json (FUT-01..18), sahibin sözleri studyo/talepler-futbol.txt.

## Kararlar (sahip sözlerine dayalı)
- Faul + penaltı + kale vuruşu YAPILIR: karar paketi B-046 "Hakem: taç, korner, kale vuruşu, penaltı, faul." Sarı kart yalnız uyarı, atma yok.
- Tuşlar: B-050 (WASD, Shift koş, Space pas, E uzun/ara pas, F şut şarjlı, C müdahale, Q değiştir) ana şema; eski K/L/Space-şut alternatif olarak kalmaz -> çakışma: Space artık PAS. Ekranda yardım kartı.
- Maç 2 yarı x ~2-3 dk (B-047). 5v5 kalır (bugünkü, 7v7 belirsiz).
- Ödül rakamı (6000+kapı vs 15k/5k/2k): sahibe karar kartı; cevap gelene kadar bugünkü değer.
- KODLANMAZ (karar bekler/öneri): FUT-10 (maçı dünyaya taşıma), FUT-16 (k6 işletme bağı, işletme rolüne bağlı), FUT-O1..O5. Koordinatörün iskelede ikinci standı yok (sonraki mesaj: halı saha önü).

## Motor sözleşmesi (görsel ve UI bunu okur; alan yoksa varsayılan kullan)
- m.ball.z, m.ball.vz (metre, top yüksekliği; yerde 0)
- p.dive (sn, >0 kaleci dalıyor), p.diveDir (-1 | 1, y yönü), p.act ('' | 'kick' | 'tackle' | 'celebrate') + p.actT
- m.ref {x, y, signal: '' | 'foul' | 'penalti' | 'korner' | 'tac' | 'aut' | 'kale', t}
- m.heat 0..1 (tribün heyecanı)
- Ev ek: {k:'foul', team, x, y, pen}, {k:'save', team}, {k:'post'}, {k:'card', who}
- restart.kind: 'tac' | 'korner' | 'aut' | 'kale' | 'serbest' | 'penalti'
- act() API ve createMatch(o) imzası korunur; MatchOpts'a plan?: [string,string] eklenir.

## İş bölümü (paralel, dosya sahipliği ayrık)
| İz | Sahip | Paketler | Dosyalar |
|---|---|---|---|
| Motor | ana oturum | FUT-01,02,03,04,05 | sim/macmotor.ts, sim/mac-olcum.ts(yeni), tools/mac-metrik.mjs(yeni), tests/sim/macmotor*.test.ts |
| Görsel | ajan G | FUT-08,09, FUT-06 (3D kısmı) | ui/hali-saha-3d.ts, view/stadyum/** , tests/browser/halisaha-*.mjs |
| Kulüp/lig | ajan K | FUT-11,12,13,14,15,17 | sim/{halisaha,lig,stadyum}.ts, content/lig.ts, ui/koordinator.ts(yeni), ui/mulk-panel.ts (yalnız stadyum/lig sekmeleri), tests/sim/{lig,kulup-mac}.test.ts |
| Kontrol/akış | ajan C | FUT-07, FUT-06 (sabit adım), FUT-18 (olay->ses eşleme) | ui/hali-saha.ts, ui/hali-saha-girdi.ts(yeni), tests/unit/hali-saha-girdi.test.ts |

## Durum
- [ ] Motor  - [ ] Görsel  - [ ] Kulüp/lig  - [ ] Kontrol  - [ ] Birleştirme + qa + ekran görüntüleri  - [ ] Ana thread'e teslim

## DURDURULDU 2026-11-20 18:41 (sahip kararı, limit tasarrufu)
Tüm alt ajanlar durduruldu. Kodda hiçbir değişiklik commit'lenmedi; yalnızca iki yarım dosya kaldı, bunlar da dala alınmadı:
- motor ajanı: sadece okuma/ön araştırma yaptı, kod yazmadı (oyun/calisma/futbol/hiz.ts boş taslak, worktree'de).
- kontrol ajanı: src/game/ui/hali-saha-girdi.ts başlangıç iskeleti (worktree agent-ade8b9f61acd7a983, commit'siz).
- görsel ve kulüp/lig ajanları: hiçbir dosya üretmedi.
Devam emri gelince: iz tablosundaki 4 işi baştan başlat (motor opus, görsel opus, kulüp/kontrol sonnet). İlk adım: FUT-01 ölçüm düzeneği.

## DURAKLATILDI 2026-11-21 16:15 (sahip: önce Dünya ve Sesler bitsin)
Dört izin işi dala birleştirildi (tsc temiz; qa:hizli ve testler birleşik hâlde HENÜZ çalıştırılmadı).
- İz 3 kulüp/lig/koordinatör/bahis: BİTTİ (ccf66e9, 9a81671). Bağlanacak: macAyari(S,t) -> {skill, formations, names, colors, plan:['pres'|'dengeli'|'kontra']} hali-saha.ts'e bağlanmadı. qa:hizli'de tests/sim/faz2-ekonomi ve yuk.test.ts taban dalda da kırmızı (bizden değil). ekonomi-istismar.test.ts'te bahis .fails kaldırıldı (ana işin dosyası, onay).
- İz 1 motor: FUT-01 ölçüm, FUT-04 kaleci, FUT-03 top fiziği, FUT-05 hakem commit'li. FUT-02 takım yapay zekası YARIM (WIP commit, macmotor.ts + macmotor-takim.test.ts): doğrulanmadı, determinizm ve güç farkı ölçümü yapılmadı. Sonraki adım: `node tools/mac-metrik.mjs` ile önce/sonra, FUT-02'yi tamamla, m.heat.
- İz 4 kontrol: girdi modülü, olay-ses tablosu, sabit adım, tuş şeması, yardım kartı commit'li. Ekran görüntüsü ve gamepad gerçek cihaz doğrulaması yok.
- İz 2 görsel: YARIM (WIP commit): ortak.ts, hali-saha-3d.ts, dünya stadyumu (view/stadyum/index.ts). Ekran görüntüsüyle doğrulanmadı, çıplak stadyum bulgusu kapanmadı.
Kalan: motor FUT-02+heat, görseli bitir ve ekranla doğrula, macAyari bağlama, hali-saha.ts ↔ yeni motor alanları (ball.z, dive, ref, heat) uyumu, qa:hizli, ekran görüntüleri, Ana İş'e bildirim.

## FUT-02 BİTTİ 2026-11-21 (thread "Halı saha takım yapay zekası", dal claude/project-thread-1upa5a)
Ayrıntı ve ölçümler: fut02-ilerleme.md, olcum/fut02-sonra.md. macAyari -> insan maçı bağlandı. m.heat zaten vardı (test yeşil).
## Görsel iz tamamlandı 2026-11-21 (thread "Halı saha stadyum görseli", dal claude/project-thread-bv7cfm)
- Prefab kimlik çakışması düzeltmesi (Belgrad 267c5b5) alındı: stadyum zemini artık çiziliyor (mavi zemin yok).
- Dünya stadyumu: saha 30 x 15.4 (z 11.8..27.2) kulüp binası ile çit arasına sığdı; çizgiler view'de geometri (kenar, orta yuvarlak, ceza/kale alanı, nokta, korner yayı); beyaz dolu kale kutuları yerine çerçeve + file; sahanın içindeki 3 sokak lambası dışarı; kısa mk.flood direkleri kalktı (4 kafes direk yeter); beton meydan zemini; projektör kafasının arkası gri çelik; reklam panoları çizgiye binmiyor.
- Maç sahnesi: uzak şehir binaları bembeyaz parlıyordu (pencere dokusu zemini beyaz + emissive) -> koyu cephe, yalnız pencereler yanar.
- Doğrulama: tests/browser/halisaha-gorsel.mjs (dunya-ust karesi eklendi), kanıt /mnt/project-files/sosisci-oyun/asama7-kanit/stadyum-gorsel-2026-11-21/. Maç geniş açı dengeli: 245 çizim, 375k üçgen (doluluk 1).
- vitest: 4 kırmızı (ipucu, baglilik, ekonomi-egri, faz2-ekonomi) taban 7babb68'de de kırmızı, bizden değil.
- Kalan (görsel): kulüp binası çatısı sade; maç sahnesi köşe blokları düz beton; "Nasıl oynanır" kartı açılışta sahayı kapatıyor (kontrol izinin işi).

### Görsel 2. tur 2026-11-21 akşam (sahip: "kulüp binası görüşü engelliyor", "çevre düz ve yavan", "futbolcular yuvarlanıyor")
- Kulüp binası OFIS (398, 25.8) = eski otoparkın yeri (sahanın batısı, ön yüz +z kameraya). Otopark eski bina yerine (417, 8.4), 3 araba, bordür, baba. Saydamlaştırma YAPILMADI (sahip istemedi).
- Varsayılan kamera kuzeyde (+z) güneye bakar; üst tribün kameraya en yakın tribün, çatısı sahanın yarısını kapatıyordu: çatı kaldırıldı (roof:false), çatı soldurma kodu silindi.
- Çevre: mk.ground.pitchzone haki -> çim; view'de 190 m çim disk, ~230 park ağacı (2 instanced çizim), uzak apartman silueti (1 instanced çizim). Yalnız oyuncu stadyum diyarındayken (x 392..452) görünür.
- Yuvarlanma kök nedeni (ui/hali-saha-3d.ts): setPose yalnız rotation.y yazıyor, dalış rotateZ ve müdahale rotateX her kare birikiyordu; artık her kare x/z sıfırlanıyor (hakem dahil).
- Araç: tests/browser/stadyum-kus.mjs. Kanıt: asama7-kanit/stadyum-gorsel-2026-11-21/tur2-*.png
- Şut/pas pozu: motor p.act 'kick' (actT ~0.3 sn geri sayar) artık sağ bacakta geri çekiş + vuruş (rig.addJ rtX/rkX). Hız > 4.5 m/s koşu döngüsü (rig 5.5 üstünde koşar, hız 5.6'ya yükseltilip verilir). Test kancası __hs3.kick(i|-1, u) ve __hs3.cam('oyuncu'). Kanıt tur2-sut-pozu.png (0 / geri çekiş / vuruş).
