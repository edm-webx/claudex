# Toolbar sadeleştirme + Emlak ajansı + Banka (thread b1jn50, 2026-11-25)

## KALDIĞIM YER (2026-11-25 ~00:10 TR, kullanıcı "kaydet, yarın devam" dedi)
- Envanter bitti (aşağıda). Karar taslağı yazıldı. Konsept maketleri HENÜZ ÇİZİLMEDİ, kod değişikliği YOK.
- Ekran görüntüleri: shots/01-hud.png (mevcut HUD), 02-mulk.png, 02-envanter.png, yer-banka/hastane/arsa/meydan.png (UI'sız arka planlar).
- Görüntü aracı: tests/browser/hud-shot.mjs (DIST=<vite build + build-artifact çıktısı> node tests/browser/hud-shot.mjs <çıktı>; YER='{"ad":[x,z,cx,cz,zoom,yaw,tilt]}' ile UI'sız yer çekimi).

## 2026-11-26 DURUM
- Konsept artifact yayınlandı: https://claude.ai/artifact/SgLFgzQ46Ce1fXk8zvpq59 (kaynak konsept/hud-konsept.html, maket konsept/hud.html ?v=A|B1|B2|C).
- BÜYÜK BULGU: A1-A5 arsaları (content/esya.ts ARSALAR x 259-285) eski açık dünyadan kalma, harita dışı boşlukta. Oyuncu hiç görmüyor. Öneri: okul+hastane doğusundaki boş çimen (x~60-80, z~30-58) "Martı Evleri", ofis girişte.
- Kullanıcıdan beklenen: HUD yönü (A/B/C, öneri B telefon) + ofis yeri (arsaların yanı / meydan).

## SIRADAKİ ADIMLAR
1. 3 HUD yönü maketi (UI'sız oyun görüntüsü üstüne HTML/CSS bindir, playwright ile PNG): A Sade Dock, B Esnaf Telefonu, C Köşe HUD (aşağıda).
2. Emlak ajansı konsepti: yer adayı (Mahalle Meydanı bankanın yanı / hastane yanındaki boş taş meydan = açık tasarım sorusuydu), dış görünüş, iç (masa, emlakçı NPC, vitrinde ilanlar).
3. Arsa şantiyesi konsepti: arsa alınca/ev-dükkân kurulunca anında bitmesin; süreli inşaat + projeye göre usta sayısı + iş makinesi (view/world/isletme-insaat.ts + sim/agents/isletme-insaat.ts zaten var, karşı yaka dükkân tadilatı için; arsalara genişlet).
4. Hepsini bir artifact'te kullanıcıya göster, onay al, sonra uygula.
5. Uygulama: menuItems (src/game/ui/panels.ts), mulk-panel TABS (src/game/ui/mulk-panel.ts), GUNLUK_HAVUZ (src/content/esya.ts), view/mulk/index.ts build() (anında ev), yeni ajans binası. Kayıt uyumu (rt.mulk/plots şeması) bozulmasın; perf bütçesi.

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
