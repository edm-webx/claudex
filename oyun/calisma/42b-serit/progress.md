# 42B metrobüs şeridi (2026-11-27, durduruldu: kullanıcı morg oyununa odaklandı)

## Yapıldı (dal claude/project-thread-qb1htt, taban jo0q11 aaa2e34)
- content/realm.ts: ISKELE_BUS_LANE (z 16.48, batıya, kapı yürüyüş yoluna bakar), busLaneAtStop, busBodyX. Diğer realm'lerde otobüs zaten kendi yolunda, davranış aynı.
- view/world/yol-look.ts: caddenin yürüyüşe en yakın şeridi (z 15.0..17.95) 42B şeridi: kırmızı yüzey, ayırıcı kerb, OTOBÜS 42B yazıları, durak çizgisi, peron şeridi. Başka şeritler 1.7 m, araçlar inceltildi (otobüs 1.4, araba 1.5), şeritte ambiyans trafik yok, 42B yazılı sahte otobüsler başka hat numarası aldı. Eski BETT durağı kalktı.
- view/orman/index.ts: otobüs iskelede doğudan gelip batıya gider (tünel ağzı), y=0.35, kapı kuzeye. Durak gölgeliği yürüyüş yolunda şeride bakıyor. yasam.ts yolcular kapıya göre.
- sim/disari.ts: binme noktası lane.doorZ, otobüs 5 sn'de görüşten çıkıyor (eskiden 20 m'de yok oluyordu), varışta kahraman durağa sabitlenir (QA dünya #1).
- atolye otobüs aynaları içeri alındı (üst geçit ayağına 2 cm boşluk).
- Testler: tests/unit/yol (5/5 yeşil, yeni 42B şerit testleri), tests/browser/otobus-serit.mjs görüntü aracı. Ekran: shots/once (eski), shots/sonra (bus z düzeltmesinden ÖNCE çekildi).

## Yapılmadı / doğrulanmadı
- Tam vitest + tsc koşusu bitmedi (durduruldu). tests/sim/realm.test.ts önceki koşuda yeşildi, disari.ts son teleport değişikliğinden sonra yeniden koşulmadı.
- Son hâlin (z 16.48, aynalar) oyun içi ekran görüntüsü alınmadı; perf kapısı koşulmadı.
- Ara sahne girdi kilidi yalnız varışta sabitleme ile çözüldü; sahne sırasında yürüme hâlâ açık.
- Mahalle araç GLB / durak gölgeliği bulguları dokunulmadı (dünya düzeltme thread'i).
