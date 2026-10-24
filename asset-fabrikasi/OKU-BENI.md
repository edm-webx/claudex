# Martı Asset Fabrikası

Sabri'nin Büfesi için oyun içi 3D modelleri **kodla** üreten motor. Resim yapay zekası yok, internet gerekmez, her model tohumla sonsuz çeşit verir ve oyuna tek satırla girer.

- Canlı vitrin: https://claude.ai/artifact/NeZgs7Hc8bk9kzupFYwoLG (Sokak sahnesi + Katalog, karakteri parça parça değiştir, Zar at, Gece)
- 59 asset hazır, `glb/` (oyun ve Blender açar) ve `onizleme/` (PNG) klasörlerinde. Liste: `katalog.json`

## Neler var
| Grup | Assetler |
|---|---|
| Karakter (11) | Sabri, Simitçi (kafada simit tablası), Teyze, Kurye, Balıkçı, Turist, Öğrenci, Taraftar, Aşçı, Dede, Rastgele vatandaş. Parça parça: 10 saç, 6 sakal/bıyık, 8 üst, 4 alt, 3 ayakkabı, 9 şapka, gözlük, 4 göz, 4 ağız, 3 gövde, 6 ten, sınırsız renk. Yürüme animasyonu hazır. |
| Araç (7) | 42B belediye otobüsü (kayar kapılar, LED tabela, iç koltuklar), sarı dolmuş, taksi, vapur, seyyar araba (simit/mısır/kestane/dondurma), Paket Kuş kurye motoru, sepetli bisiklet |
| Bina (5) | Cumbalı apartman (2-5 kat, gece ışıklı pencere, alt kat dükkan), ahşap konak, mahalle dükkanı (fırın/manav/berber/bakkal), otobüs durağı, Martı Kulesi |
| Dekor (12) | Sokak lambası, bank, çöp kutusu, çay bahçesi masası + tabureler, semaver, trafik konisi, saksı, mermer çeşme, reklam panosu (Kolaz/Ayranbey/Narçiçek/Martıkart), sokak kedisi (5 renk), martı |
| Yemek (16) | Simit, ince belli çay, döner ocağı (et/tavuk, döner), dürüm, lahmacun, balık ekmek, sosisli, midye dolma, künefe, baklava tepsisi, kaşarlı pide, ayran, Türk kahvesi, şişe (Boğaz Gazozu/Martı Su/Kolaz), ıslak hamburger, mısır |
| Doğa (9) | Çam, meşe, ulu çınar, selvi, erguvan, çalı, kaya, lale tarhı, mantar (3 tür) |

## Kendi bilgisayarında Claude Code ile çalıştır
1. Node 20+ kur (nodejs.org). Claude Code kur: `npm install -g @anthropic-ai/claude-code`
2. Bu klasörü al: GitHub'dan `git clone https://github.com/edm-webx/claudex` (dal: `claude/project-thread-by6qhq`, klasör `asset-fabrikasi/`) ya da proje dosyalarındaki zip'i aç.
3. Klasörde: `npm run kurulum` (three + playwright tarayıcısı iner, bir kere)
4. `claude` yaz, Claude Code açılır. `CLAUDE.md` dosyası kuralları ona zaten anlatır.

### Hazır promptlar (kopyala yapıştır)
- `Katalog'a "kokoreç tezgahı" ekle: cam vitrinli, ızgarada dönen kokoreç, üstünde parodi tabela. Önizlemeye bakıp düzelt.`
- `Karakterlere 3 yeni saç (afro, dalgalı uzun, yandan ayrık) ve 2 kıyafet (takım elbise, yağmurluk) ekle. Her biri için önizleme çıkar.`
- `Vapur iskelesi binası yap: ahşap iskele, bekleme salonu, turnike, saat kulesi. Çarpışma kutusu ver.`
- `Bütün yemekleri 1.5 kat daha iştah açıcı yap: parlaklık, buhar, sos. Önce/sonra önizlemelerini yan yana göster.`
- `Otobüse iç mekan ekle: tutunma kayışları, bilet makinesi, şoför koltuğu, direksiyon.`
- `Yeni semt seti: Belgrad Ormanı için 6 ağaç, kütük, piknik masası, mangal, çeşme. Tutarlı renk paleti.`
- `Her şey bitince npm run disa-aktar çalıştır ve oyunun motor-v39/src/game/view/fabrika/ klasörüne kopyalanacak şekilde hazırla.`

## Oyuna bağlama
Kod olarak (önerilen, hafif ve çeşitli):
```js
import { kit } from './fabrika/kit.js';
import { uret } from './fabrika/katalog.js';
const k = kit();
const otobus = uret(k, 'otobus', { hat: '42B', yon: 'BELGRAD ORMANI' }, 7);
scene.add(otobus);
otobus.userData.kapiAc(1);            // kapıları aç (0..1)
otobus.userData.carpisma;             // {w,h,d}: içinden geçilmesin diye katı kutu
```
Dosya olarak: `glb/otobus.glb` dosyasını GLTFLoader ile yükle.

## Pluginler (2026-10-24 denemesi)
Blueprint Studio, Adobe, Canva, Cloudinary ve abracadabrax görsel pluginleri bulut ortamında bağlanamadı (proxy 403). Bu yüzden motor tamamen kodla çalışıyor. Kendi bilgisayarındaki Claude Code'da bu pluginler açılırsa kapak resmi, ikon, mağaza görseli gibi 2B işler için kullanılabilir; 3D model için bu motor yeterli.

## Klasör
- `src/kit.js` alet çantası (yuvarlak kutu, torna, ekstrüzyon, canvas doku, pişirme = parça birleştirme)
- `src/karakter.js arac.js bina.js dekor.js yemek.js doga.js` üreticiler
- `src/katalog.js` asset listesi ve `uret()`
- `src/sahne.js` vitrin sokağı
- `araclar/disa-aktar.cjs` GLB + PNG üretimi
- `index.html` vitrin sayfası
