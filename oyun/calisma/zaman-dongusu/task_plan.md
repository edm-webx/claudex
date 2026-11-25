# Zaman döngüsü (gün, gece, hava, mevsim) — 2026-11-25

Kullanıcı: güneş doğarken aşırı hızlı gidip normale dönüyor; gece saatlerini de yaşayalım; yağmur/kar gerçek ay/hafta takvimine bağlı olmasın, daha hızlı ilerlesin ama hızlı hissettirmesin.

## Spec
1. Gün 08:00 → ertesi 08:00, 24 saat, kesintisiz (GAME_DAY_S 480 aynı, ekonomi günü aynı uzunlukta). 03:00-08:00 artık atlanmıyor, gün sonu kartı 08:00'de, gün doğumu oynanarak yaşanıyor.
2. Güneş yolu analitik (doğuş 06:00, batış ~19:50), gece ay ışığı; güneş↔ay devri ışık ~0'dayken, yön atlaması görünmez. Tablo anahtarlarından gelen az/el sapmaları yok.
3. Gece oynanışı: gece müşterisi (gece kuşları, balıkçı, vardiya, sabah erkencileri), sokak yoğunluğu gece de canlı; gün toplam müşteri integrali eskisiyle aynı (ekonomi korunur).
4. Oyun takvimi: 1 oyun günü = 1 hafta (ay ~4 günde, mevsim ~13 günde = ~1,7 saat oyun). Haftanın günü her gün 1 ilerler (hafta sonu / Gece Pazarı aynı). Mevsim sınırında ağırlıklar yumuşak karışır. Gerçek takvim sadece yeni oyunun başlangıç noktası.
5. Hava: rampa 0,4 saat → ~1,2 saat (bulut önce toplanır), pencereler 24 saat içinde, gece de yağabilir. Parçacık sayısı aynı/az.
6. Saat arayüzü: 10 dk adımları kalıyor.

## Plan / durum
- [ ] tod.ts güneş/ay yolu + şafak anahtarları, DAY_END_H 32
- [ ] boot-saat koridor sadeleştirme
- [ ] müşteri/sokak/ambient gece eğrileri, integral eşitleme
- [ ] hava.ts takvim + rampa + pencereler; takvim okuyan diğer modüller tek kaynaktan
- [ ] testler, tam oyun botu önce/sonra, perf
- [ ] ekran görüntüleri
