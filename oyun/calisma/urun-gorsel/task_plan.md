# Her ürüne kendine has görsel (2026-11-25)
Sahip: "tepsiye gelen ürünlerin resimleri hep aynı düz yuvarlak bişey; üretilen her ürünün kendine has görseli olmak zorunda".

1. [x] Envanter: ürünler ve nerede çizildikleri (findings.md)
2. [x] Ürün başına karar: ortak kap (tabak/oval/kâse/sahan/tahta/arduaz/bardak/şişe/külah/kutu) + ürüne özgü içerik + süs
3. [x] content/prefabs/yemek/yemek-geo.ts: 175 tarif, tek birleşik geometri (Batch, MAT.atlas), kimliğe göre önbellek
4. [x] Bağlama: rtview (el/tepsi, masa, müşteri eli), chars (garson eli), urun-model (makine tepsisi, dükkân tepsisi), ic-mekan-look (pass rafı, istasyon tabağı)
5. [x] 2D ikon: view/yemek-ikon.ts (modelden 96px), sipariş paneli (faz2-hud) + dükkân menü çipleri (mulk-panel)
6. [x] Kontak sayfası tests/browser/yemek-kontak.mjs (önce/sonra), oyun içi tests/browser/urun-tepsi.mjs
7. [x] Testler (173 dosya, 1200 test yeşil) + perf kapısı (tek kırmızı temel dalda da aynı)
