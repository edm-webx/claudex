# Bulgular (tam oyun botu, 2026-11-23)

## Oyun hataları (düzeltildi)
1. **Halı saha ve Tesis Kafeteryası (k6) girilemiyordu** (tarayıcı yürüyüş turu). src/content/zones/karsi.ts `pitchCol`: doğu kale ağı
   çarpıştırıcısı doğu çitin tek kapı boşluğunu (z 43.5..47.5) kapatıyordu (iki yanda 0.3 m), batı kale ağı tesis duvarına gömülü ve
   tesis kapısını kapatıyordu (gezgin bilinen.json 'tesis' maddesinin kökü). Düzeltme: batıda ağ/çarpıştırıcı yok; çit boşluğu ağın
   kuzeyine (z 41.3..43.5). Kilit: tests/unit/yol/halisaha-kapi.test.ts (eski kodda kırmızı).

## Botun kanıtladıkları (admin yok, tohum 11)
- Aşama varışları (oyun dk, sıfırdan): 2 @ 33, 3 @ 163, 4 @ 410, 5 @ 738, 6 @ 1190, 7 @ 1655, 8 @ 2233; aşama 8 kaydından 9 @ 2915, 10 @ 3545.
- 18 dükkânın hepsi sırayla alındı (k1 → k17, k18), sıralı açılma ihlali yok, kilit yazıları tutarlı, etkileşimsiz kare yok.
- Her aşama atlayışında gerçek kayıt deposundan kaydet → yeni sim'e yükle → karşılaştır → koşu yeni sim'de sürer: aşama, para, dükkânlar,
  işçiler, açılan kareler, görünen kareler, kurulu masalar birebir.
- Tarayıcı yürüyüş turu (aşama 2-10 kayıtları, gerçek girdi + çarpışma): 37/37 + 156/156 hedef, 0 sıkışma, 0 hayalet geçiş, 0 ulaşılamayan kare, para çekmeyen kare yok.

## Tasarım / tempo notları (hata değil, kullanıcıya)
- 5★ için karnede beş "İyi": şıklık (dekor) şart. Aşama 5'te 12 yuvayla en yüksek şıklık %60 = "Orta" (SIKLIK_MAX[5]=96); dekor 4. aşamada yapılmazsa 5★ zorlaşır (notlar en yüksekte kaldığı için kilit değil).
- k5 Martı Lokantası "40 paket teslim" ister: kurye işe alınmadan paket hiç açılmaz. Oyuncu kuryeyi bilmezse holding zinciri (k5 → k15 → k16 → k17, k18) burada durur. Hedef kartı sadece "40 paket siparişi teslim et" diyor; "kurye tut" ipucu yok.
- Ölü bölgeler: aşama 3 → 4 (~90 dk) ve 5 → 6, 8 → 9: dükkân tadilatları "büfe aşaması" kilidinde, para birikiyor, alınacak şey yok.
- Büfe tadilat karesi yürüyüş yolunun üstünde (aşama 6+ (3.0, 1.2)); üstünde duran oyuncunun cebi 30 M'lik tadilata akar (yarım ödeme saklanır).
