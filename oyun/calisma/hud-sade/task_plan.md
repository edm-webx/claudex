# Toolbar sadeleştirme + Emlak ajansı + Banka (thread b1jn50, 2026-11-25)

## KALDIĞIM YER (2026-11-25 ~00:10 TR, kullanıcı "kaydet, yarın devam" dedi)
- Envanter bitti (aşağıda). Karar taslağı yazıldı. Konsept maketleri HENÜZ ÇİZİLMEDİ, kod değişikliği YOK.
- Ekran görüntüleri: shots/01-hud.png (mevcut HUD), 02-mulk.png, 02-envanter.png, yer-banka/hastane/arsa/meydan.png (UI'sız arka planlar).
- Görüntü aracı: tests/browser/hud-shot.mjs (DIST=<vite build + build-artifact çıktısı> node tests/browser/hud-shot.mjs <çıktı>; YER='{"ad":[x,z,cx,cz,zoom,yaw,tilt]}' ile UI'sız yer çekimi).

## 2026-11-26 DURUM
- Konsept artifact yayınlandı: https://claude.ai/artifact/SgLFgzQ46Ce1fXk8zvpq59 (kaynak konsept/hud-konsept.html, maket konsept/hud.html ?v=A|B1|B2|C).
- BÜYÜK BULGU: A1-A5 arsaları (content/esya.ts ARSALAR x 259-285) eski açık dünyadan kalma, harita dışı boşlukta. Oyuncu hiç görmüyor. Öneri: okul+hastane doğusundaki boş çimen (x~60-80, z~30-58) "Martı Evleri", ofis girişte.
- Kullanıcıdan beklenen: HUD yönü (A/B/C, öneri B telefon) + ofis yeri (arsaların yanı / meydan).

## 2026-11-26 GECE: ARSA/MAHALLE/EMLAK DONDURULDU (kullanıcı: "yeni arsalar mahalle gibi ayrı yerde olacak, sonraya attık")
- Dalın ucu yalnız HUD işi (alt bar, telefon, ATM, günlük işler, kedi listesi ve vapur temizliği, Mülklerim ekranı). Mahalle merge'ü ve Martı Emlak ofisi geri alındı ama geçmişte duruyor: emlak+mahalle hâli commit 9634861 (geri getirmek için o commit'ten dosyaları al). Arsa ve inşaatın asıl sahibi inşaat thread'i (arinot).

## 2026-11-26 UYGULANDI (karar: B Esnaf telefonu, ofis arsaların yanında)
- a0775a6: alt bar Çanta + Telefon + mini harita + Büfem; Ajanda'da günlük işler; ATM'ler; kedi listesi + vapur görevleri kalktı; yatay telefon düzeni.
- 2026-11-26 karar (kullanıcı): arsalar inşaat thread'inin Martı Konutları mahallesinde (realm 'mahalle', 42B Meydan Çeşmesi). Benim Martı Evleri/şantiye denemem (1d9ae39) geri alındı (8e6f668), arinot b2a9074 merge edildi (0e6794c). Martı Emlak = mahallede eski eczane (view/mahalle/index.ts TABELA[3]), EMLAK kapı (265.6, 14.4); alım/kurma/büyütme sadece orada. Görüntü: shots/emlak, shots/emlak-tel.
- Kalan / sonra: AVM ATM'si; ofis içi (emlakçı NPC) yok, sadece cephe; eğitici thread'i yeni yerleri bilmeli (Telefon, ofis, ATM).

## ENVANTER (mevcut alt bar, panels.ts menuItems)
Harita, Karakter, Envanter, Mülk (her zaman) + Menü (lv2), Ekip (işçi/lv3), Karne (lv4), Görevler (gün2), Kediler (kedi varsa), Tadilat (yıldız/aşama) = en fazla 10 düğme.
Envanter/Mülk paneli (mulk-panel.ts) 8 sekme: Envanter, Banka, Günlük, Mülk, Defter, Salon, Okul, AVM.
Diğer HUD: sol üst seviye+para+gün/saat, sol Hedefler kartı, sağ üst zil/ayar/ses, tarih kartı, Sipariş paneli, Servis yıldızı, Usta Dokunuşu, Arkadaş çağır.

## KARAR TASLAĞI (kullanıcı onayı bekliyor)
| Öğe | Nereye |
|---|---|
| Harita | Barda kalır |
| Envanter | Barda kalır ("Çanta") |
| Görevler | Barda kalır, Günlük + Karne buraya sekme olarak girer ("Ajanda") |
| Karakter | Telefon/menü içine + evdeki ayna |
| Mülk | Bardan çıkar. EMLAK AJANSI binası: arsa al, ev/dükkân kur, tadilat SADECE orada. Telefonda salt-okunur "Mülklerim" listesi |
| Banka sekmesi | Kaldırılır. Dünyadaki Martı Kasası Bankası gişesi (zaten var, karsi-bina.ts + ic-sakin BANKA) + iskele/AVM/meydana ATM (para yatır/çek; kredi sadece gişede) |
| Menü, Ekip, Tadilat | Bardan çıkar; kendi işletmende/yakınındayken beliren tek "Dükkân" bağlam düğmesi (o işletmenin menü/ekip/tadilatı) |
| Kediler | Kaldırılır (kedi iç içe gezme hatası BAŞKA thread'de) |
| Günlük (çıt foto, gizli kedi, otobüs, kayıp eşya) | Esnaf işine paralel günlük işlere çevrilir (satış, işçi eğitimi, kasa toplama, maç günü satışı vb.), Ajanda'ya taşınır |
| Defter/Salon/Okul/AVM sekmeleri | Sekmeden çıkar, zaten yerinde beliren ipucu düğmesiyle açılıyor |
Sonuç bar: Harita, Çanta, Ajanda, Telefon(≡) + bağlamsal Dükkân.

## AÇIK KARARLAR / NOTLAR
- 3 HUD yönünden hangisi (öneri: B Telefon + kalıcı Harita/Çanta).
- Emlak ajansı yeri (öneri: Mahalle Meydanı, bankanın karşısı; alternatif hastane yanı boş meydan).
- Eğitici pop-up sistemi başka thread'de; bu thread çakışmasın.
- Görülen ayrı hatalar (bu thread'in işi değil, bildir): Hedefler'de hâlâ "Bir vapuru iskelede karşıla" görevi var (vapur yasak); acilis.ts'de k2 şartı "50 vapur karşıla"; mülk paneli sekme başlıkları üstte kesik görünüyor.
