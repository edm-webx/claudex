# Lisanslar

Bu klasördeki her dosya ticari oyunda serbestçe kullanılabilir. Kaynağı belli olmayan veya lisansı karışık hiçbir şey alınmadı.
Çıkış noktası: https://threejsresources.com (bir bağlantı dizini; kendisi dosya barındırmıyor, buradaki her şey gösterdiği asıl kaynaklardan alındı).

| Klasör | Ne | Kaynak | Lisans | Not |
|---|---|---|---|---|
| `hdri-kucuk/` | 18 HDRI, 512x256 EXR (DWAB), ~150 KB | [@pmndrs/assets 1.7.0](https://www.npmjs.com/package/@pmndrs/assets), asıl kaynak [Poly Haven](https://polyhaven.com/hdris) | CC0 1.0 | Sadece ortam ışığı/yansıma için. Gökyüzü arka planı olarak bulanık görünür, onun için `polyhaven/hdri/` 2k kullan. |
| `doku/bulut.webp` | Bulut dokusu 512 | @pmndrs/assets | CC0 1.0 | Sprite bulut, sis. |
| `font/inter_*.woff`, `inter_*.json` | Inter yazı tipi (woff = HTML/troika, json = TextGeometry) | @pmndrs/assets, asıl kaynak [rsms/inter](https://github.com/rsms/inter) | SIL Open Font License 1.1 | Oyunda kullanmak serbest; fontu tek başına satmak yasak. |
| `polyhaven/hdri/` | 2k HDR gökyüzü/ortam | [Poly Haven](https://polyhaven.com) | CC0 1.0 | Her öğenin yazarı ve sayfası `polyhaven/katalog.json` içinde. |
| `polyhaven/doku/` | 1k PBR dokular (renk, normal GL, ARM, yükseklik) | Poly Haven | CC0 1.0 | 〃 |
| `polyhaven/model/` | 1k glTF modeller | Poly Haven | CC0 1.0 | 〃 |

CC0 = kamu malı: atıf zorunlu değil, değiştirip satılabilir. Yine de jenerikte "Poly Haven" teşekkürü güzel durur.

## Bilerek alınmayanlar
- @pmndrs/assets içindeki matcap ve normal haritaları: paket CC0 diyor ama üst kaynak koleksiyonlar (nidorx/emmelleppi) farklı yerlerden derlenmiş, tek tek kaynağı belli değil.
- pmndrs/react/three logoları ve bunny/suzi test modelleri: marka logosu ya da işe yaramaz test modeli.
- Sketchfab, TurboSquid, Freepik, Flaticon, Zapsplat: her dosyanın lisansı ayrı (çoğu atıf ister ya da ticari kullanımı kısıtlı). Gerektiğinde tek tek, lisansı buraya yazılarak alınır.
- Kenney ve ambientCG (ikisi de CC0): siteleri bulut ortamından erişilemiyor; istenirse aynı yöntemle PC'den eklenir.
