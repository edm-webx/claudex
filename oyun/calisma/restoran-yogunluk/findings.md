# Bulgular
- Garson zamanının ~%70-90'ı yürüyüş (toMasa ~%27, toPass ~%19, toTable ~%22), masada ~%10, boşta ~%5: kapasite yürüyüşte tükeniyor.
- Menüden sonra garson gidiyor, misafir 3-5 sn bakınca sipariş için yeni bir garson yürüyordu: misafir başına bir boş tur.
- Uzun beklemeler (60-80 sn) aşama açılışı / sabah açılışında kümeleniyor: 20+ masa aynı anda doluyor (wantMasa sadece boş masa ve açık bilet sayısına bakıyordu).
- Garson/dolu masa oranı aşama 5'te ~1:2.6, 7-10'da ~1:4 (6/7/7/8 garson, 23-31 dolu masa).
- GİZLİ HATA: garson-bolge.ts "en yakın komşu" tek yönlü ekleniyordu (b6->b2 var, b2->b6 yok): b2 garsonu boşta dururken b6 masası 30 sn+ bekliyordu. Yük düşünce denetçi yakaladı.
- Hesap en düşük öncelikteydi, %30'u 40 sn sınırına (parayı masaya bırak) çarpıyor, masa boşuna dolu kalıyordu.
- Ön koşul olmayan: check-dist game.js 3.01 MB > 3 MB tavanı beta 10'da da vardı (3 151 431 B); bu iş +~4 KB değil, sorun önceden var.
