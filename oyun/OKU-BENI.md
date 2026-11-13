# Sabri'nin Büfesi, Martı Motoru kaynak kodu (v34, 2026-10-24)

Bu klasör, canlı önizleme linkindeki sürümün (v34) tam kaynak kodudur.
Canlı link (tek link, her sürüm aynı link üzerine yayınlanır):
https://claude.ai/artifact/QLKgqtAKpixJWkd7VcTexe

## Kurulum ve komutlar
- Node 20+ gerekli. İlk seferde: `npm install` (node_modules klasörü bu pakette YOK, tekrar kurulmalı).
- Tip kontrolü: `npx tsc --noEmit`
- Testler (194 test, yeşil): `npx vitest run`
- Geliştirme sunucusu: `npx vite --port 4174`. Tarayıcıda `http://localhost:4174/`.
- Yayın paketi: `npm run build` (tsc + vite build + tools/build-artifact.mjs + tools/check-dist.mjs).
  Çıktı: `dist/index.html` ve `dist/game.js`. Canlı linke yayın için bu iki dosya kullanılır.
- Tarayıcı testleri için Playwright gerekir. Sistemde kurulu Chromium: `/opt/pw-browsers/chromium`.

## Önemli dosyalar (anket kararlarının yeri)
- Anket kararları özeti: /mnt/project-files/sosisci-oyun/calisma/arge-2026-10-24/anket-cevaplari-faz-plani.md
- Yapılanlar ve açık işler: /mnt/project-files/sosisci-oyun/DEVAM-ET.md (en alttaki bölümler)
- Kıyafet verisi: src/content/kiyafet.ts. Kıyafet dolabı: src/game/sim/kiyafet.ts
- Zemin: src/game/sim/zemin.ts (kirlenme, temizleme; görsel ton view/world/index.ts içinde)
- Bahşiş kapalı: src/game/sim/customers.ts (TIPS_ON). Çevrimdışı kazanç kapalı: src/game/sim/offline.ts (OFFLINE_ON)
- Gün süresi 480 sn: src/engine/api.ts (GAME_DAY_S)
- Yemek menüsü (tarifler): src/content/yiyecek.ts. Anket yemek listesi testi: tests/unit/survey-menu.test.ts
- Dekor: src/content/dekor-katalog.ts, şekiller src/content/prefabs/iskele/decor-extra.ts
- Büfe kahramanı görünümü: src/game/boot.ts (heroLook / wornLook)

## Yapılmamış işler (kalan liste)
1. Büfe çatısı içeriyi kapatıyor. Zemin tonu ve iç mekan normal kamerada görünmüyor. Çatının açılması ya da yarı saydam olması gerekir.
2. Fayans ve mermer desen görünümü: sim'de var (`zemin` komutu, op 'desen'), görsel doku yok.
3. Kıyafetler: sadece üst, alt, ayakkabı ve şapka karaktere giriyor. Kostüm (palyaço, korsan, spor forması, takım elbise) giydirilmiyor. Kıyafet dolabı arayüzü dekor/menü panelinde.
4. Ürünler: menüde tarif olarak var (yiyecek.ts). Survey'deki eksikler eklendi (lahmacun, pide, pizza, sushi vb.). Ürün görselleri ve istasyon yerleşimi büyük iş.
5. Ses ve hava: gün batımı, mevsim sesleri, Kıraç tarzı müzik yok. Sadece mevcut ses motoru.
6. Harita ve dükkan zinciri: Bütün İstanbul haritası ve dükkanlar yok.
7. Mini oyunlar (hafıza, labirent, yarış) ve cila: yok.
8. Faz 7 (online, hesap, sohbet, lider tablosu): sunucu gerektirir. Bu ortamda yapılmadı.
9. APK/AAB paketleme: kullanıcı kararıyla ertelendi.

## Stok sınırsız
Karar verilmedi. Malzeme parası yoksa stant durur. Mevcut kural korunuyor.

## v36 (2026-10-24): açık dünya bel kemiği
- Anket cevapları: sosisci-oyun/anket-mmo/cevaplar-2026-10-24.md
- "Bir yer tıkandı" düzeltildi (sim/queue.ts): kuyruk alarmı sadece tezgahta eksik ürün varken; boş kart yok; aynı uyarı 3 dk dinlenir.
- Yeni tezgahlar iskele kenarında (content/restoran.ts STANT_SPOTS 6-11), pad yönü düzeltildi.
- Kıyafetle saç/bıyık düzgün; esnaf yaratıldıysa oyuncunun seçimi geçerli (boot.ts wornLook/esnafLook).
- Dükkan içi: pas/boya lekesi yok (kiosk.ts, props.ts), kir yavaş (zemin.ts), temizlikçi paspas (agents/workers.ts 'mop'), her gün temiz.
- Gece ışıkları gerçek PointLight havuzu (view/world/night-lights.ts).
- Semtler: Martıköy geri açık (ACIK_DUNYA in boot.ts) + Gece Pazarı, Stadyum, Tersane, Metro Altı, Tepe ve Koru, Adalar (content/zones/disari.ts, content/disari/martikoy.ts). Hepsi şimdilik seviye 1 (test için).
- İstanbul haritası (ui/harita-panel.ts), alt çubukta Harita; dokun, ışınlan (sim/disari.ts knownStop hep true).
- Esnafını yarat (sim/esnafim.ts, ui/esnaf-yarat.ts). ?yarat parametresi autoplay'de de açar.
- Online ilk deneme (game/online.ts): claude.ai artifact `room` yeteneği; presence ile konum, görünüş, sohbet. itch/yerelde çevrimdışı.
