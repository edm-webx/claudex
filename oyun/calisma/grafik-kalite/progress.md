# İlerleme
- 16:40 UTC tarama bitti, 4 düzeltme
- 17:00 önce/sonra görüntüleri; tsc temiz, vitest tam takım 1104 geçti (setDetay öncesi), ilgili testler sonra da geçti

## Kaldığım yer (2026-11-26 00:10 TR, kullanıcı "yarın devam" dedi)
- Yapıldı (dal claude/project-thread-sbh6ge): FXAA/anizotropi/şemsiye/yuvarlak karakter (639339a), Tripo betiği (f3958de, kullanılmadı: bedava sürüm ticari değil),
  KayKit (CC0) arabalar: public/modeller/auto/kk-*.glb + yol-look.ts CARS listesi (bu commit). Önce/sonra: /mnt/project-files/sosisci-oyun/grafik-kalite-2026-11-25/araba/
- Önizleme sayfası: https://claude.ai/artifact/VNZFWLWt3gUUe5B9uqeXx8 (29 KayKit modeli). KayKit klonları /tmp'deydi; yeniden: git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-<City-Builder-Bits|Restaurant-Bits|Furniture-Bits>-1.0.git
- Kullanıcı kararı: tek tip görünüm, KayKit ana tarz; Kenney/Quaternius'tan yalnız uyanlar. Oyuna girmeden önce göster.
## Sıradaki adımlar
1. Araba önce/sonra görüntüsünü kullanıcıya göster, onay -> Ana İş birleştirsin (henüz birleştirilmedi). Ambulans hâlâ Kenney (KayKit'te yok).
2. Sokak eşyaları (bank, lamba) prosedürel ve oturma noktalarına/çarpışmaya bağlı (pier.ts bench, layout.ts benchSeats): değiştirmek riskli, yapılmadı.
3. Kenney/Quaternius indirme buluttan engelli: kullanıcının PC'sinde uzak oturum gerekir (izin istenecek).
4. Yemek/mutfak modelleri: "Her ürüne kendine has görsel yap" thread'inde; KayKit Restaurant Bits bilgisi oraya iletildi, karar onda.


## 2026-11-26
- Önce/sonra araba çekimi tamam: sonra-yol.png koyuluğu rastgele bulutlu havadan geliyordu (çekimde havaZorla('') -> 'acik', örtü yok). KayKit arabalar sahneyi karartmıyor; ortalama parlaklık farkı sadece araba renklerinden.
- yakin-shot.mjs: yolYakin noktası + çekim anında hava/örtü kontrolü loglanıyor.
- Kullanıcı onayı bekleniyor ("tamam" gelmeden jo0q11'e birleştirme yok).
