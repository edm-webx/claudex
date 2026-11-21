# AVM katları ve mağazaları (thread "AVM katlarını ve mağazalarını aç", 2026-11-21)

Sahip isteği (18:13): "AVM'de merdiven var ama işlevsiz; her katında mağaza olsun, satın alıp düzenleyip satış yapalım, aynı mantık, zamanla her yere hâkim olalım."
18:14: "Düzgün isimler, görseller, her şey düzgün, mantıklı ve eğlenceli olsun."
Kurallar: büfe/kafe mantığı (haritada kilitli, kendi aletleri, gerçek yürüyen müşteri, GERÇEK yürüyen işçi, aynı yükseltme), STOK YOK,
ekonomi şişmez, halı saha dosyalarına dokunma, yeni sektör (giyim dışı) yok: yeni dükkânlar yemek / yemeğe yakın.

## Tasarım (karar)
- Kabuk aynı yer ve boy (x 11.7..28.6, z 46.5..57.1, 3 kat, kat yüksekliği 3.6). Ortada 5 m'lik hol (x 17.65..22.65), içinde
  yan yana iki yürüyen merdiven (yukarı / aşağı), makas düzeni: 0->1 önden arkaya, 1->2 arkadan öne. Üst katlarda merdiven
  boşluğunun çevresinde galeri (korkuluklu halka yol).
- Her katta 4 dükkân: hol kenarında batı/doğu bloklar, her blok ön/arka iki oda (5.3 x 5.95), kapı hola bakar.
  - Kat 0 (Giriş): Martı Moda (k7), Tekno Martı (k8), Oyuncak Dünyası (k9), Hacı Martı Şekerleme (k10, lokum/şekerleme)
  - Kat 1 (Kahve & Tatlı): Telve Kahve Laboratuvarı (k11), Maraşlı Martı Dondurma (k12), Şerbetçi Baklava Sarayı (k13), Çıtırcı Kuruyemiş (k14)
  - Kat 2 (Yemek Katı): Martı Lokantası (k5, buraya taşındı), Dürümcü Dayı (k15), Kumpir Kulesi (k16), Midyeci Mido (k17)
- Kat sistemi: sim 2B kalır. Oyuncunun `kat`ı (walk.pos.kat, kayıtta state.player.kat). İç mekân / arsa / ses kontrolleri
  konumdaki kat'a bakar (icIcinde). Üst kat çarpışması ayrı küçük nav (yalnız dikdörtgen), merdivene binince otomatik yolculuk.
- Müşteriler AVM girişinden yürür, merdivenle çıkar, galeriden dükkân kapısına gider (yol noktaları y taşır). İşçiler de öyle.

## Aşamalar
1. [ ] content/avm-kat.ts: hol, merdivenler, kat çarpışmaları, yükseklik, yol (saf veri + fonksiyon)
2. [ ] ic-mekan.ts: kat alanı, 12 oda, yeni yerleşimler (dükkân + yemek), icIcinde kat'a duyarlı
3. [ ] walk.ts + headless/boot: kat, merdiven yolculuğu, üst kat nav, kamera/kahraman y
4. [ ] kafe.ts: AVM odalarına müşteri/işçi hol yolu (merdivenle), istasyonlar kat'a duyarlı
5. [ ] esya.ts + isletme-*: 8 yeni işletme tipi (menü, alet, aşama, kadro, istasyon), arsalar k10..k17, fiyat/seviye
6. [ ] görünüm: hol + galeri + merdiven modeli, katlı oda gösterimi, cephe tabelaları, kat tabelası
7. [ ] testler: ic-mekan-yerlesim (yeni odalar), avm-magaza, avm-kat (yolculuk, nav), tarayıcı çekimi
8. [ ] push, Ana İş'e haber
