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

## UX thread (claude/project-thread-m0d31m), DURAKLATILDI 2026-11-20 18:40
Yapıldı (ekranda DOĞRULANMADI, a1.png alındı ama bakılmadı): admin düğmesi .sb-hbtns içine taşındı (ui/admin-panel.ts), geniş ekranda panel sağ kanat olur ve --sr değişkenini yazar (HUD/dock/kartlar sola kayar). Test kancası: net/admin.ts `__adminUiTest(true)` yalnız ?noloop sayfasında.
Sıradaki: (1) admin kanadını ekranda doğrula; (2) yazı min 14px + kontrast (yeni-hud.ts, hedef-card, v2-style); Hedefler kartı cam zemini daha opak, sol; sipariş paneli çakışması; (3) envanterde dükkan adları; (4) ana menüde "2.0" etiketi (v2ui.ts U.title .sb-sub yanına); (5) ilk 10 dk (tutorial.ts, ölü hedefler reg1/regular/herzaman); (6) karakter yaratıcı EN SON (kulis.ts, UX-15). Ana thread'e haber: engine/ui/index.ts toast() ve boot.ts'e dokunmadan önce yaz.
Ekran aracı: /tmp/claude-0/s/cap.mjs (oturuma özel; tests/browser/shot.mjs benzeri).

### UX thread güncelleme 2026-11-21
Yapıldı (ekranda doğrulandı, 1280x720 + 844x390): admin kanadı; yazı tabanı 13px (v2-style/kulis/giris/hedef-card/yeni-hud); HUD cam zemini .8, Hedefler .9 opak; çevrimiçi şerit admin açıkken ve yatay telefonda HUD'un üstüne binmiyor; ana menüde 2.0 etiketi + not yazısı gölgeli; ölü hedefler (reg1/regular/herzaman) gerçek hedeflere çevrildi + birim testi (tests/unit/hedef-tamamlanabilir.test.ts). qa:hizli yeşil.
Notu: 'herzaman' başarımı goal 25 iken first-session testini bozdu (altın ödül ekonomiyi kaydırıyor), 200 yapıldı.
Kalan: sipariş panelinin (faz2-hud f2-rail) çakışması test edilmedi (rail ekranda çıkmadı), bildirim çift görünümü (toast hayalet), kontrast betiği, karakter yaratıcı (UX-15, en son), envanter dükkan adları mulk-panel'de var (ana thread alanı), "ilk binaya giriş ipucu" sahip kararı bekliyor (kodlanmadı).
