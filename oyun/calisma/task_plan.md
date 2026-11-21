# v54 — Her binaya girilebilsin (2026-11-09)
İstek: her binaya girilebilmeli; kafe/bistro/lokanta içinde geliştirme + aletler (kahve makinesi vb.), her yerde bir şey olsun; işletmeler belli seviyeden sonra satın alınıp işletilsin.

Karar (in-world dollhouse, büfe gibi aynı dünyada):
- content/ic-mekan.ts: her bina için kapı yönü + iç yerleşim (saf veri). Duvar çarpıştırıcıları kapı boşluklu, katı eşyalar çarpışır.
- İçerideyken dış kabuk gizlenir, iç mekan görünür (karsi-bina). Büfe salonlarında çatı/üst kat gizlenir.
- İşletmeler (ARSALAR sabit): k1 Meydan Kafe, k2 Sahil Bistro, k3 Kırtasiye (lv4), k4 Okul Kantini (okul içinde, lv3), k5 AVM Martı Lokantası (lv6), k6 Tesis Kafeteryası (lv5). Her birinin kendi menüsü + 8-10 aleti; alınan alet içeride 3D görünür.
- Büfe salonları (kahvaltı, balık): içeri girilir; salon aletleri salon gelirini artırır (mulk op salonEsya).
- Banka: içeride gişe (banka işlemleri gişede de olur). Okul sınıfı, hastane, acil, morg, AVM mağazaları: görsel + figürler.
Adımlar: veri > sim > çarpıştırıcı > görünüm > panel > test > ekran görüntüsü > zip.

## 2026-11-09 Anket sonrası plan (cevaplar: /mnt/project-files/sosisci-oyun/anket-2026-11-09/mutfak-anket-cevaplari.txt)
Sıra (kullanıcı seçti): 1 personel seviyesi, 2 kafe/bistro oynanış, 3 büfe→mutfak+garson. Chrome donması EN SON. Karakter yaratıcı (yüz/saç/sakal) en son.
- [x] Herkese açık sunucular kaldırıldı; oyun kodu ile arkadaş (online.ts)
- [x] Hedefler sola; vapur tabelası iskele doğu kenarında; üstgeçit merdiveni eğimli blok (ugY ile aynı yüzey); araç genişliği şeride sığar
- [x] Masa servisi sakin: share .2/.3/.4, yeme 22-32 sn, maxOpen 3, sabır 150; sipariş paneli 3 fiş + "+N"
- [x] Personel 10 seviye (ranks.ts), aday memleket+yaş, moral hız etkisi yok
- [x] M-A Roller: kasiyer, aşçı, komi, bulaşıkçı, şef, barista, müdür, hostes, güvenlik, kurye, vale, müzisyen, temizlikçi; aşamaya göre kadro; etkileri (kasiyer: bahşiş+hız, şef: mutfak hızı, bulaşıkçı: masa temizliği, güvenlik: kapkaç, kurye: görünmez gelir, müdür: yokken işletme)
- [x] M-B Mutfak: büfe aşama 3-10 boyunca istasyonlar (ızgara, fritöz, ocak, soğuk oda, çay-kahve, tatlı, pass, fırın, döner, meze, salata, bulaşık); kapalı mutfak + pass penceresi; sipariş ekranı (KDS) sırayla; bekle-al pişirme; yanma yok; kamyon/kurye teslimatı; müfettiş/hijyen
- [x] M-C (tabak, menü, hesap, ortak bahşiş) Garson akışı: menü getir, sipariş al, pass'tan tabak (2-3 tabak), masaya taşı, hesap, masa sil; bölge ataması; ortak bahşiş kumbarası gün sonu bölünür; animasyonlar
- [x] M-D (tema + makinede kahve/waffle yapma; ayrı müşteri simülasyonu yok) Kafe/bistro: her işletme ayrı oynanış, tema seçimi (retro/modern/bohem/deniz), espresso makinesinde kahve yapma
- [x] M-E AVM (giyim/sinema/kozmetik), kırtasiye (first-person stationary tycoon), okul (İngilizce ders/sınav, genel puan), banka kredi/faiz
- [x] M-F (müşteri tipleri+sabır mevcut, gün sonu raporu detaylı) Müşteri tipleri + sabır çubuğu + gruplar; vatandaşlar (acıkır, dükkana gider); dekor sürükle-bırak; gün sonu raporu; Martı yıldızı
- [x] M-G (checkShaderErrors kapalı, gece ışığı sayısı sabit, otomatik kalite yukarı-aşağı döngüsü kesildi, zone sonrası compileAsync) Chrome donma kök nedeni (EN SON). Baseline: perf.mjs 183-263 çağrı, 94k-392k üçgen
- [x] M-H (cinsiyet, dururken yüz ifadesi, 3 yeni sakal, AVM kıyafetleri dolapta giyilir) Karakter yaratıcı (yüz ifadesi, cinsiyet, saç, sakal, kıyafet) EN SON

## 2026-11-20 DÜZELTME + YOL PLANI (taslak, sahip onayı bekliyor)
DÜZELTME: Yukarıdaki 2026-11-09 [x] işaretleri koddan doğrulandı; 262 anket isteğinin 84'ü yapıldı, 91'i yarım, 55'i yok, 9'u "olmasın" dediği halde var (hijyen müfettişi, kurye, garson bölge ataması, olaylar, mutfağın büfe içinde büyümesi, duman/buğu, mini harita oluşturma vb. eksik). [x] işaretlerine güvenme; ayrıntı: /mnt/project-files/sosisci-oyun/plan-2026-11-13/ (arastirma-sonuc-*.json, studyo/).
Plan belgesi: https://claude.ai/artifact/F2BUtovpYYC5vMA5WC7QtC (8 aşama, 13 karar). Uzman paketleri: studyo/uzman-paketleri.json (213 paket: 173 İSTEK, 40 ÖNERİ), eleştirmenler: studyo/elestirmenler.json.
Kırmızı çizgiler: stok yok; prop işçi yok; büfe iskelede yerinde büyür (zincir, kestane/mısır, müdavim, deniz platformu yok); para sesi yumuşak; ışık koyu, yazı okunur; ÖNERİ paketleri onaysız yapılmaz.
Aşamalar (oturum): [ ] 0 Karar ve ölçüm (12-14) [ ] 1 Temizlik ve temel (60-70) [ ] 2 Akıcılık ve görsel omurga (50-55) [ ] 3 Gerçek çalışanlar ve canlı odalar (85-100) [ ] 4 Büfe 10 aşama ve işletmeler (110-130) [ ] 5 Futbol ve stadyum (50-55) [ ] 6 Dünya, orman, sokak, hikâye (130-150) [ ] 7 Karakter, arayüz filigranı, online (70-90).

## 2026-11-20 gece: v2.0 durum (kullanıcı "her şeyi durdur, kaydet" dedi 20:22)
- Taban dal: claude/project-thread-jo0q11. Tamam: Aşama 0 (PRF-01 ölçüm kaydedici, KAL-12 npm run qa), Aşama 1 (48 paket), PRF-02 perf:gate, PRF-14 yük testi, PRF-03/04/05/06/08/13 commitli. YARIM (commit "WIP"): PRF-09 (temas/çarpışma, merdiven) ve PRF-10 (kamera/girdi gecikmesi): tests/unit/{camera,input,yol}, tests/browser/{temas,girdi-gecikme}.mjs, engine/{camera,input}, content/ustgecit.ts; doğrulanmadı.
- Yapılmadı: PRF-07/11/12/15, GRS-xx (görsel omurga), KAL-01/02/13/15 (kayıt güvenliği), EKO-01/02/03.
- Ara dallar (başka thread'ler): claude/project-thread-ukvrqf (büfe BUF-01..05, ea27edd), claude/project-thread-unh0w1 (işletmeler 110ed0f), claude/project-thread-m0d31m (arayüz, admin düğmesi 0e62d93), claude/project-thread-wa2wu6 (futbol), claude/project-thread-g3g2bo* (dünya+ses). Birleştirme denemesi: yerel claude/v2-beta (ukvrqf + unh0w1 + jo0q11), çakışma view/world/ic-mekan-look.ts çözüldü. Ön izleme zip: arsiv/sabrinin-bufesi-itch-v2.0-onizleme-2026-11-20.zip.
- Kullanıcı kararları: AVM mağazaları ayrı işletme EVET, kantin tek kat, borç/kira/vergi/ATM şimdi yok, vizyon holding (yemek>giyim>sağlık>turizm>emlak), ses bölgesel, hedef "GTA5 PS3 512MB" dengesi (sıkıştırma + bellek bütçesi), ara zip yok (beta/önizleme hariç), sürüm v2.0.
- Detay: /tmp/claude/memory/team/silo/v2-0-gece-calismasi.md, plan belgesi + /mnt/project-files/sosisci-oyun/plan-2026-11-13/THREAD-REHBERI.md

## 2026-11-21 00:40 durum (kullanıcı "kaydet ve dur" dedi)
- jo0q11 @ d8bbfcd: PRF-09/10 tamam (testler yeşil), WIP: PRF-11/15 (tools/{bellek-olc,glb-sikistir,paket-dokum,yukleme-olc}.mjs, render/{doku-akis,kaynak-dokum,yukle-ekran}.ts), GRS-01/02 (boot-saat.ts, tod/look/hava-look). Sıkıştırılmış .glb'ler geri alındı (yama /mnt/project-files/arsiv/wip-glb-sikistirma-2026-11-21.patch, doğrulanmadı); tests/unit/render/glb-sikistir.test.ts bu yüzden kırmızı, glb.ts değişikliği sıkıştırılmış varlığı çözmeye hazır.
- Beta 1 zip: arsiv/sabrinin-bufesi-itch-v2.0-beta1-2026-11-21.zip (birleştirme dalı claude/v2-beta: bundle arsiv/v2-beta-birlestirme-2026-11-21.bundle). Açık: tests/sim/yuk.test.ts gün dönümü tick sıçraması, game.js 2.58 MB (check-dist tavanı geçici 3 MB, yalnız birleştirme dalında).
- Yapılmadı: GRS-05/06/07/17, PRF-07/12, KAL-01/02/13/15, EKO-01/02/03. Kollar: büfe ukvrqf c9b9659 (BUF-19/20/22/21/30 yolda), işletmeler unh0w1 d34f41c, arayüz m0d31m 0e62d93, futbol wa2wu6, dünya+ses g3g2bo*.

## 2026-11-21 bellek zinciri (PRF-11, PRF-15)
- GLB nicemleme uygulandı (e2f585b): 3.06 -> 1.45 MB, köşe verisi 2.81 -> 1.18 MB; tests/browser/glb-ab.mjs 20 modelde 0 piksel, oyun içi arabalı kare 0 piksel.
- Doku akışı merdiveni 1/2-1/4-1/8 (7dc1ace): dengeli 1280x720 en yüksek GPU 206.9 -> 168.7 MB, doku-akis-ab 4 karede 0 piksel. Izgara tuvali ilk açılışta. PMREM ara hedefi bırakılır (80e5400, -6 MB).
- Sızıntı: büfe zemini kir dokuları ve fiş plakaları birikiyordu (87940cb). sizinti.mjs 8 turda doku 162->174 iken 162->170 (son iki tur düz); 20 tur yeşili henüz görülmedi.
- Bütçe: tools/perf-budget.json "bellek" (varlık kuralı testi tests/unit/render/varlik-butce.test.ts, çalışma tavanı node tools/bellek-olc.mjs --kapi --tekrar 3).

## 2026-11-21 bellek zinciri 2. adım (PRF-07 motor, PRF-12)
- PRF-12 (a3fa614): bloom kademelerinde ölçek yalnız sahne hedefini küçültür (tuval sabit): setScale 994-16605 ms -> 0.1-0.9 ms (headless), geçiş karesi 4777/6057 -> 6.6/12.0 ms, program sabit. Bloom kesme basamağı (ölçek tabanda + hâlâ yavaş). Taban 0.7 (sahip kararı: 0.8/0.7/0.6).
- PRF-07 motor (f6a8e9e): zones görüşe göre kurar (kesik + 14 m pay, sis önü en çok 200 m), sıçramada (otobüs/ışınlanma) varış bölgesi aynı karede. tests/browser/pop-in.mjs: ekranda pop 4 -> 0, varışta 5 -> 0. three compileAsync takılması (atılan malzeme) düzeltildi.
- Açık (diğer kollar): orman ağacı LOD/impostor ve solma (view/orman), tribün seyircisi LOD (view/stadyum), karşı yaka sadeleştirme (karsi-*). Headless'ta orman/sahil varışının ilk karesi 2-56 sn (SwiftShader, bölge kurulumu değil: 4-9 ms).
## UX thread (claude/project-thread-m0d31m), DURAKLATILDI 2026-11-20 18:40
Yapıldı (ekranda DOĞRULANMADI, a1.png alındı ama bakılmadı): admin düğmesi .sb-hbtns içine taşındı (ui/admin-panel.ts), geniş ekranda panel sağ kanat olur ve --sr değişkenini yazar (HUD/dock/kartlar sola kayar). Test kancası: net/admin.ts `__adminUiTest(true)` yalnız ?noloop sayfasında.
Sıradaki: (1) admin kanadını ekranda doğrula; (2) yazı min 14px + kontrast (yeni-hud.ts, hedef-card, v2-style); Hedefler kartı cam zemini daha opak, sol; sipariş paneli çakışması; (3) envanterde dükkan adları; (4) ana menüde "2.0" etiketi (v2ui.ts U.title .sb-sub yanına); (5) ilk 10 dk (tutorial.ts, ölü hedefler reg1/regular/herzaman); (6) karakter yaratıcı EN SON (kulis.ts, UX-15). Ana thread'e haber: engine/ui/index.ts toast() ve boot.ts'e dokunmadan önce yaz.
Ekran aracı: /tmp/claude-0/s/cap.mjs (oturuma özel; tests/browser/shot.mjs benzeri).

### UX thread güncelleme 2026-11-21
Yapıldı (ekranda doğrulandı, 1280x720 + 844x390): admin kanadı; yazı tabanı 13px (v2-style/kulis/giris/hedef-card/yeni-hud); HUD cam zemini .8, Hedefler .9 opak; çevrimiçi şerit admin açıkken ve yatay telefonda HUD'un üstüne binmiyor; ana menüde 2.0 etiketi + not yazısı gölgeli; ölü hedefler (reg1/regular/herzaman) gerçek hedeflere çevrildi + birim testi (tests/unit/hedef-tamamlanabilir.test.ts). qa:hizli yeşil.
Notu: 'herzaman' başarımı goal 25 iken first-session testini bozdu (altın ödül ekonomiyi kaydırıyor), 200 yapıldı.
Kalan: sipariş panelinin (faz2-hud f2-rail) çakışması test edilmedi (rail ekranda çıkmadı), bildirim çift görünümü (toast hayalet), kontrast betiği, karakter yaratıcı (UX-15, en son), envanter dükkan adları mulk-panel'de var (ana thread alanı), "ilk binaya giriş ipucu" sahip kararı bekliyor (kodlanmadı).

### UX-15 ilk dilim (karakter yaratıcı) 2026-11-21
Yapıldı: Kimlik sekmesine 'Bedenin: Erkek/Kadın' (Vücut sekmesinden taşındı), Kadın seçilince sakal/bıyık temizlenir; yeni karakterde ad kutusu boş ('Adını yaz'), ad yazılmadan 'Sahneye çık' Kimlik sekmesine döndürür. Ekranda doğrulandı (k2.png).
Yapılmadı / karar bekliyor: Ayarlar'daki 'Büfeci: Sabri/Sabriye' (v2ui.ts ~822) kalksın mı (sahip kararı); 7 sakal etiketi 4 mesh (esnafim/chars-v2, SANAT rolü asset üretecek); saç şapka altında yassılaşma (H-076); canlı yüz ifadesi önizlemesi; AVM giyim 5 ürün; kozmetik ürünleri. Sipariş paneli (f2-rail) çakışma testi ve kontrast betiği (tools/kontrast.mjs) yapılmadı.

### UX thread 3. tur 2026-11-21
Yapıldı: Ayarlar'dan Büfeci Sabri/Sabriye kalktı (sahip onayı); ilk giriş ipuçları tutorial.ts 'ipucu' sistemi (bina: banka/kırtasiye/okul, bölge: stadyum/orman; kayıt st.tut['ip_*'], 10 sn aralık; toast ile; birim testi ipucu.test.ts); bildirim merkezi engine/ui/index.ts (zil, son 30, okunmamış sayacı, toast 14px/3,2 sn, aria-live); tools/kontrast.mjs (13px altı + kontrast taraması, node tools/kontrast.mjs).
Açık: view/world/hava-look.ts:480 tarih rozeti 12.5px (ana thread alanı, bir sayı değişikliği); sipariş paneli (faz2-hud f2-rail) ekranda çıkmadığı için görsel doğrulanmadı (CSS konumu rozetin altında, sağ sütun); ilk 10 dk tutorial sırası olduğu gibi bırakıldı (17 adım), yeni dakika haritası sahip girdisi bekler.

### UX thread 4. tur 2026-11-21
Yapıldı: her iç mekan için özel ipucu (tests/unit/ipucu.test.ts hepsini kapsar); ilk 10 dk sırası: çay > ilk işçi (isbul) > ayran/simit/tabure (first-session testi yeşil); sipariş paneli stage=6'da ekrana getirildi, rozetin altında çakışmıyor, 'Bekleyen sipariş yok' satırı okunur yapıldı, panel 156px.
Kalan: saç/sakal mesh'leri (7 sakal etiketi 4 mesh, chars-v2.ts, SANAT rolü), canlı yüz önizlemesi, hava-look tarih rozeti 12.5px (ana thread).

## 2026-11-21 sıra (ana şantiye)
- Sona eklendi (AR-GE öncesi): EKO-05 turu: çok tohumlu ölçüm + büfe tezgâhı / sipariş fiyat ayarı, eğri hedefe ±%10 (şimdi 30/60/90. dk +%36/+%19/+%15).
