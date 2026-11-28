# Bulgular
- Kök neden (madde 1) doğrulandı: Walker.walk her adımda a.y = zeminY yazıyordu; çatıdaki işçi bir sonraki tikte katY(yukari=false) ile 0 oluyordu.
  Sonuç iki yönlü: goVia catiIc kısa yolunu hiç kullanmıyordu VE yere giden garson merdivensiz, döşemenin içinden "düşüyordu" (sim hile yapıyordu).
- Dürüst kat hareketi tek başına bekleme düşürmedi (temizlikçi ve yardım eden garson artık gerçekten merdiven iniyor). Gereken üç ek:
  (a) çatı/Şef garsonu postu kendi katında (KANAT_POST), (b) üst kattaki garson aynı kattaki her masaya komşu gibi yardım eder
  (restoran.ts bolgeKurali, isAl at.kat), (c) temizlikçi çatı masasına yalnız 30 sn sonra çıkar + uzaktan gelen temizlikçinin yer masasını
  yakındaki boş temizlikçi devralır.
- Madde 3 çoğunlukla sahte alarm: restoran-carpisma-hedef.json 11-22 yerleşiminden kalmış, 11-25 ters U'da salon masaları kaymış. Liste
  artık icKatiEsya'dan üretiliyor (tests/unit/carpisma-hedef.test.ts eskirse kırmızı). Park listesindeki aşama 6 'job' kutusu da eskiydi (silindi).
  Yeni koşu (BOT_ST=10): 284 itiş, 3 hit (hepsi eski job kutusu, sonra silindi), salon masası 0, gridOpen yalnız job.
- Şef salonu menü max hâlâ 45-66 sn arası oynayabiliyor (qa koşuları); tek ön merdiven Şef masalarına 9-27 m. İkinci (arka) merdiven ya da
  Şef katına yemek asansörü ayrı tasarım kararı (bkz. merdiven-onerisi.md).
