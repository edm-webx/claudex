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
- [ ] M-E AVM (giyim/sinema/kozmetik), kırtasiye (first-person stationary tycoon), okul (İngilizce ders/sınav, genel puan), banka kredi/faiz
- [ ] M-F Müşteri tipleri + sabır çubuğu + gruplar; vatandaşlar (acıkır, dükkana gider); dekor sürükle-bırak; gün sonu raporu; Martı yıldızı
- [x] M-G (checkShaderErrors kapalı, gece ışığı sayısı sabit, otomatik kalite yukarı-aşağı döngüsü kesildi, zone sonrası compileAsync) Chrome donma kök nedeni (EN SON). Baseline: perf.mjs 183-263 çağrı, 94k-392k üçgen
- [ ] M-H Karakter yaratıcı (yüz ifadesi, cinsiyet, saç, sakal, kıyafet) EN SON
