# İlerleme — 2026-11-26 tamamlandı (kullanıcı onayı bekliyor, jo0q11'e birleşmedi)

Dal: claude/project-thread-b3u8z9 (taban jo0q11 fef56d9).

## Yapılanlar
- Kök neden: kart sonrası 27->32 şafak koridoru 5 gerçek saniyede oynatılıyordu (~37x hız) + güneş yönü tablo anahtarlarında geri savruluyordu. tod.ts'de 27 clamp hatası.
- 24 saatlik gün (DAY_END_H 32, 08:00 -> 08:00, GAME_DAY_S 480 aynı, 20 sn/saat), analitik güneş/ay yolu (doğuş 05:42, batış 20:00), devir ışık sönükken.
- Gece müşterisi/sokak/rol saatleri 24 saate yayıldı (inHours h-24), müşteri eğrisi integrali eşit; 0..24 varsayan gece kontrolleri %24.
- Oyun takvimi (1 oyun günü = 1 hafta, mevsim ~13 gün, kenar karışımı), eski kayıt göçü, tek mevsim kaynağı oyunTakvim.
- Hava rampası 1.2 saat, bulut ön toplanma, gece/şafak pencereleri, gökkuşağı sadece gündüz. Kar bulutlu gün; kar çatı örtüsü kioskRoof'a oturuyor.

## Doğrulama
- Tam test seti: 1201 geçti, 0 kırmızı (2026-11-26).
- Tam oyun botu TAM=1 (aşama dk, eski -> yeni): 2: 32.5->33.7, 3: 93.9->92.9, 4: 349->344.6, 5: 665.4->645.7, 6: 1015.7->943, 7: 1527.7->1478.3, 8: 2066.8->2065.5, 9: 2612.6->2605.7, 10: 3144->3144.9. Bulgu/tıkanma yok. Son para 54.0M -> 64.6M (+%20, gece geliri; aşama süresine etkisi yok).
- 5 günlük bot geliri (tohum 1-3) 4. gün toplamı 249963 -> 249436.
- Perf kapısı YEŞİL: dengeli karşı yaka 597181 / 616981 üçgen (bu iş geometri eklemedi).
- Kareler: /mnt/project-files/zaman-dongusu-2026-11-25/ (ana 7 kare + şafak şeridi 04:30-07:15, ortalama parlaklık 48->46->58->69->84->102 düzgün).

## Açık karar
- Gün sonu kartı 08:00'de çıkıyor; kalsın mı / kartsız mı (kullanıcıya soruldu).

## 2026-11-26 22:15 TR: jo0q11 (fe795d1) birleştirme + ekonomi ayarı (kullanıcı "kaydet ve dur" dedi)
- Merge commit 9d7ed2a: çakışmalar çözüldü (citizens: 'Sahil yolcusu' + gece saatleri; hava-look: jo0q11 tavanı 0.45 + bulutK*0.16; first-session ref 6042/22709/45997 korundu, bant gevşetilmedi).
- customers.ts gündüz eğrisi: 08-21 daha kalabalık (0.95/1.1/1.35/1.1/1.2), 21-08 daha seyrek (0.7/0.55/0.4/0.25/0.45/0.7/0.9; gece satış sürüyor). Gün integrali 20.65 (eski 21.2, -%3).
  Ölçüm: ilk döner+ayran seti 12 tohumda en geç 287 sn (sınır 480; önce seed 2 484.8). Parite gün 1/3/5 = 5570/23246/50726 (ref içinde, %8/%2/%10).
  İlk deneme (1.0/1.15/1.4/1.15/1.25) gün 5'i %19 aştı, geri çekildi.
- Tam test: 1201 yeşil, 1 KIRMIZI: tests/sim/asama-botu.test.ts "her çalışan gerçekten iş yapar" -> ölü kilit denetçisi:
  aşama 9, gün 27, t=12607, masa 45 'menu' >30 sn ve yetkili garson 10 sn+ boşta. jo0q11'de (fe795d1) aynı test YEŞİL; müşteri akışı değişince ortaya çıkan gerçek garson-AI açığı.
  Tanı (geçici debug ile): masa 45 bölge b16 (sahibi garson 45, tabak taşıyor). Komşu bölge b23'ün garsonu 52 state 'idle', bolgeKurali(52,45,yas,false) = ok:true
  olduğu halde yas 10 -> 14 arası (≈4 sn, 0.4 sn'lik isAl yoklamasıyla 10 kez) işi ALMADI, ancak yas 14'te aldı; sonra 15 sn yürüdü -> menü ~31 sn.
  Sıradaki adım: workers.ts garsonWork 'idle' dalı / garsonIsBul -> restoran.ts isAl içinde 52'yi neyin durdurduğunu bul (acilSon? 'mine' iş? isAl hiç çağrılmıyor mu, yoksa null mı dönüyor?).
  Debug yaması geri alındı. Test bandına dokunulmadı.
- Kalan: bu düzeltme, sonra tam test + perf kapısı + TAM bot, sonra Ana İş'e dal/commit.
