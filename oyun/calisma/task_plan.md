# v54 — Her binaya girilebilsin (2026-11-09)
İstek: her binaya girilebilmeli; kafe/bistro/lokanta içinde geliştirme + aletler (kahve makinesi vb.), her yerde bir şey olsun; işletmeler belli seviyeden sonra satın alınıp işletilsin.

Karar (in-world dollhouse, büfe gibi aynı dünyada):
- content/ic-mekan.ts: her bina için kapı yönü + iç yerleşim (saf veri). Duvar çarpıştırıcıları kapı boşluklu, katı eşyalar çarpışır.
- İçerideyken dış kabuk gizlenir, iç mekan görünür (karsi-bina). Büfe salonlarında çatı/üst kat gizlenir.
- İşletmeler (ARSALAR sabit): k1 Meydan Kafe, k2 Sahil Bistro, k3 Kırtasiye (lv4), k4 Okul Kantini (okul içinde, lv3), k5 AVM Martı Lokantası (lv6), k6 Tesis Kafeteryası (lv5). Her birinin kendi menüsü + 8-10 aleti; alınan alet içeride 3D görünür.
- Büfe salonları (kahvaltı, balık): içeri girilir; salon aletleri salon gelirini artırır (mulk op salonEsya).
- Banka: içeride gişe (banka işlemleri gişede de olur). Okul sınıfı, hastane, acil, morg, AVM mağazaları: görsel + figürler.
Adımlar: veri > sim > çarpıştırıcı > görünüm > panel > test > ekran görüntüsü > zip.
