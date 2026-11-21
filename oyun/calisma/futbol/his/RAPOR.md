# Halı saha oynanış hissi düzeltmesi (2026-11-21)
Ölçüm: `npx vite-node calisma/futbol/his/his-olc.ts 8` (4 insan-botlu + 4 bot-bot maç, 60 Hz). Tarayıcı: Playwright, gerçek oyun kurulumu (kulis > teklif > maç), klavye ile oynama, ekran görüntüleri.

| Metrik | Önce (beta 3) | Sonra |
|---|---|---|
| Oyuncu başı saniyede >60° anlık yön sıçraması | 0.264 | 0.004 |
| Gol / maç (150 sn) | 8.1 | 4.1 |
| Kurtarış / maç | 5.0 | 5.8 |
| Top el değiştirme / dk | 9.2 | 6.6 |
| Pas isabeti | 0.63 | 0.72 |
| Faul / maç | 4.6 | 2.1 |

Kök nedenler ve düzeltmeler (sim/macmotor.ts, ui/hali-saha*.ts):
- Takla/yuvarlanma: çizimde kaleci dalışı ve müdahale dönüşü her kare üst üste biniyordu (görsel thread düzeltti, 7832ab6, dala alındı).
- Fırıl fırıl dönme: hız istenen hıza 0.1 sn'de üstel yapışıyor, gövde yönü hızla aynı karede 180° dönüyordu. Artık sabit ivmeli sürüş (frenleme ayrı) ve saniyede en çok ~600° gövde dönüşü; yavaşken oyuncu topa bakar.
- Shift/RT koşu motorda hiç okunmuyordu (herkes hep tam hızdı). Artık tempolu koşu 5.5, koşu 7.1 m/s (topla 5.0 / 6.4); dokunmatikte çubuğu sonuna itmek koşturur.
- Top kalecinin içinden geçiyordu: kurtarış zarı top uzanma yarıçapına girdiği ilk karede atılıyor, kaçırırsa top gövdeden geçiyordu. Artık topun kaleciye en yakın geçiş mesafesine bakılır; gövdeye gelen top kaçırılırsa seker (dönen top).
- E tuşu "uzun pas" yazıyordu ama ara pas atıyordu; havadan uzun top hiç kullanılamıyordu. E/RB artık havadan uzun top.
- Klavye/gamepad ile oynarken dokunmatik düğmeler sahanın sağ altını kapatıyordu; artık yalnız dokunmatikte çizilir.
- Kendi kalesine gol artık "KENDİ KALESİNE!" olarak sayılır (m.kk), çetele tutarlı.
- Güç farkı korunsun diye hız/ivme ve kaleci kurtarışı beceriye daha bağlı.
- Faul eşiği: bot-bot 1-5/maç (eski 2-6). Akış için daha az kesinti; gerçek futsalda maç başına çok daha az.

Bilinen eksikler: koşu animasyonu yürüyüş döngüsünün hızlandırılmışı (hali-saha-3d.ts görsel thread'in dosyası); vuruş ('kick') pozu çizilmiyor; ortalama top sahipliği hâlâ kısa (0.58 sn, hızlı pas oyunu). Gerçek ekran kartlı bir makinede elle oynanarak hissedilmedi: headless tarayıcı ~1 fps verdiği için his ölçümü telemetriyle yapıldı.
