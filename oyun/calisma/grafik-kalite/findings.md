# Bulgular (2026-11-25)
Yöntem: render kodu okuma, es-duzlem.mjs (iskele/AVM/stadyum/belgrad), yakin-shot.mjs (yakın çekim, dengeli + akıcı, önce/sonra).

## Düzeltilen
1. Akıcı kademede hiç kenar yumuşatma yoktu (MSAA kapalı, çözünürlük 0.85): her siluet tırtıklı. Son geçişe FXAA eklendi,
   yalnız MSAA olmayan kademede açık (render/index.ts). Maliyet: tek tam ekran geçiş.
2. Anizotropi: açıkça ayarlanmamış dokular (GLB araç/bina, tabelalar) eğik açıda bulanıklaşıyordu. Varsayılan min(8, GPU azami).
3. Dekor "şemsiye": 8 tam koni aynı yerde üst üste (renk sırayla) = gerçek GPU'da titreyen çizgiler (z-fighting).
   Artık 8 ayrı dilim (Batch.cone arc seçeneği).
4. Karakter/hayvan köşeliliği: kafa, gövde, şapka 6-8 kenarlı görünüyordu (SEG hero 0.6, crowd 0.55). Dengeli/Şahane'de
   hero 0.9, crowd 0.75, hayvan 0.75. Akıcı eski değerlerde (CH.setDetay).
   Ölçüm (dengeli, aynı noktalar): üçgen ~815k -> ~1.10M, dükkân önü 1.02M -> 1.54M; draw call değişmedi (~280-390).

## Bakıldı, değişmedi
- es-duzlem: 16 eş düzlem, 0 bozuk normal. Hepsi 2026-11-23 taramasında incelendi (korniş içi, denize bakan yüz). Yeni yok.
- Gölge: normalBias texel'e göre, bias -0.0005, PCFSoft: acne görülmedi. Kamera near dinamik, far 400: uygun.
- Kenney araç colormap: 64 px renk şeritleri, mip sızıntısı ancak çok uzakta, görünür değil.
- Bulutta (SwiftShader) gerçek GPU titremesi görünmez: son kontrol kullanıcının PC'sinde.

## Blender (ya da elle modelleme) gerektirenler
Koddan düzeltilebilen kusurların hepsi yapıldı. Blender bir "kusur onarma" aracı olarak gerekmiyor; bir STİL yükseltmesi için gerekir:
- Karakterler (chars-v2, kodla üretilen kapsül/küre): yüz, el, giysi kıvrımı yok. AAA görünüm isteniyorsa elle modellenmiş + riglenmiş karakter seti.
- Araçlar: Kenney Car Kit (ücretsiz, başka oyunlarda da var, kutu gibi). Oyuna özgü araçlar için Blender'da 6-10 model.
- Ağaçlar/çalılar: düşük poligon top. Yaprak kartlı ağaç Blender ister.
- Kenney binalar (bina/*.glb): az kullanılıyor, prosedürel binalar yeterli.
