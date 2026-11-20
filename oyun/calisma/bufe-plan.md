# Büfe 10 aşama + mutfak v2.0 (BUF kolu) — plan
Dal: claude/project-thread-ukvrqf (taban 4a36662). Şartname: studyo/uzman-paketleri.json (BUF-01..30), sartname-cikti/BUF-01..05.json.
Kurallar: stok yok, çalışan hep gerçek ajan, büfe iskelede yerinde büyür, tek giriş, ara zip yok, push öncesi `npm run qa:hizli` yeşil.
Varsayılan kararlar (sahip onayı/öneri): ortak bahşiş kumbarası gün sonu paylaşım (2026-11-09 anketi geçerli, koordinatör teyit 18:38; 10 dk gün + gün sonu raporu kalır); kurye görünür; bayat/Deney Tezgahı kalkar; müdavim kalkar; Türk mutfağı çekirdek + eski ürünler kalır; müfettiş yalnız uyarı; Martı yıldızı ayrı gösterge; terfi=rol merdiveni; ustalar yürür; mutfak arkadaki oda + pass penceresi; hostes olsun; vale yalnız anahtar+hafif araba; düğün kafilesi YOK (rezervasyon yok).

## Dalgalar (dosya sahipliği ayrık, dalga içi paralel)
W1 temizlik: A=BUF-01+03 (sonnet) | B=BUF-02 (haiku)
W2 çekirdek: BUF-04 menü (sonnet) -> BUF-05 hat (opus)
W3 mutfak+garson: BUF-06,13 (sonnet) | BUF-09,10 (opus) | BUF-07,08 (sonnet/haiku, görsel)
W4 rol/akış: BUF-12,14,15,16 (sonnet), BUF-23,24,25 (sonnet), BUF-26,27 (haiku/sonnet)
W5 büyüme: BUF-19,20 (opus), BUF-22,21 (opus), BUF-30 (haiku)
W6 kanıt: BUF-28 bot, BUF-29 perf (sonnet), ekran görüntüsü, qa, push.
BUF-11/17/18 = kafe/çalışan kolu, onlara bırakıldı.
Model: kritik sim/tasarım=opus, normal kod=sonnet, küçük/mekanik=haiku.

## Notlar (DKN kolundan 18:47)
- Gün sonu (BUF-26): işletme satışları S.today.sold içinde 'k:<menü id>' anahtarı (ad: ISLETME[..].menu); işletme maaşları rt.uiLast.isletmeMaas = {toplam, odenen, satirlar:[{ad,tutar,odenen}], gun} -> gun-sonu.ts kartına satır olarak ekle.
- DKN kolu ukvrqf dalını kendi dalına merge etti; ben onların dalını merge etmem, entegrasyon ana thread'de.

## DURUM (2026-11-20 20:25, kullanıcı "her şeyi durdur" dedi)
Tamam + commit: BUF-01,02,03 (1e9fd9c), 04 (fb4c323), 05 (ea27edd), 06,07,08,09,10,13 (1111fe1).
Dalga 4: BUF-26+27 bitti (yeşil, 352 test). BUF-12/23/24 (kasa, sabır, gruplar) ve BUF-14/15/16 (salon rolleri, kurye, hijyen/müfettiş) AJANLAR YARIDA KESİLDİ: ağaçta YARIM işler var, tsc/test kırmızı olabilir (bkz. WIP commit). Devam: önce `git diff HEAD~1` ile yarımları gör, tamamla, qa:hizli yeşile getir.
Kalan: BUF-12,14,15,16,23,24 (yarım); BUF-25 (ambient.ts DNY kolunda, ana thread'e sorulacak); dalga 5 (BUF-19,20,22,21,30); dalga 6 (BUF-28 bot, 29 perf, ekran görüntüleri, qa:hizli, ana thread'e bildir). BUF-11/17/18 = kafe/çalışan kolu.
Açık notlar: BUF-07 sabit 4'lük kirli tabak yığını ile BUF-13 rtview yığını çift çizim olabilir; tepsi/kumbara/bölge kalıcılığı yok (şema kararı); ekonomi testleri yeni ödeme gecikmesine göre yeniden ayarlanmalı.
