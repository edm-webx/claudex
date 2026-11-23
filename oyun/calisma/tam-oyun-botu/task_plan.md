# Tam oyun botu (2026-11-23)
İstek (kullanıcı, koordinatör aracılığıyla): admin kısayolu olmadan gerçek akışta çok hata çıkıyor (üst geçit, kilitli kareler, tepsi akışı).
Yeni oyunda 1. aşamadan 10. aşamaya, bütün bölge ve dükkân zincirleriyle, yalnız normal oyuncu akışıyla ilerleyen bot; bulduğu her hata düzeltilip testle kilitlenir.

## Spec
- Admin / force / skipTadilat / para ekleme / acilisSerbest YOK. Bot yalnız oyuncunun yapabildiğini yapar: yürür (ışınlanır ama yürüme süresi kadar bekler), sarı karede durur, panel düğmelerine basar (işe al, ilan, sandık aç, günlük ödül, gün sonu "devam", halı saha kabul).
- Kapsam: büfe satış (bot-ai.mjs), büfe + restoran masa/mutfak + dükkân satın alma/alet/tadilat + salon kareleri, dükkân işçisi, dükkân kasası, görev zinciri (okul sınavı, mini oyun, halı saha maçı), sandıklar.
- Denetim: para/konum NaN, aşama geri gitmesi, sıralı açılma ihlali (content/acilis.ts), kilit yazısı tutarsızlığı, etkileşimsiz kare, çözülemeyen duraklama, gezi zaman aşımı, tıkanma (120 oyun dk ilerleme yok → teşhis), her aşamada gerçek kayıt deposundan kaydet + yeni sim'e yükle + karşılaştır + koşuya o sim'de devam.
- Çarpışma / hayalet geçiş / sıkışma: kafasız simde çarpışma yok; tarayıcıda gerçek build + botun her aşamadaki kaydıyla yürüme turu.

## Plan
1. [x] tests/sim/tam-oyun-botu.ts (koşucu), tests/sim/tam-oyun-botu.test.ts (hızlı: aşama 3; TAM=1 tam koşu)
2. [ ] Tam koşu → bulgular → kök neden düzeltmeleri → her biri için test
3. [ ] Tarayıcı yürüme turu: aşama kayıtları ile her kareye / dükkân kapısına gerçek girdiyle yürü
4. [ ] Rapor, push, Ana İş'e haber
