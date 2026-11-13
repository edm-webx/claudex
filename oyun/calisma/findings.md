# findings.md
## Arama notu
WebSearch (standard) bu oturumda ince/alakasız sonuç döndürdü; aşağıdakiler iyi bilinen oyun-AI pratikleri + koddan okuma. Doğrulanmamış iddia yok.
## Mevcut durum (koddan)
- halı saha 5v5, 40x20 m, tek dosya, aiMove: sabit ev çapası + topa kayma; pas/şut Math.random ile -> "kalıpsal/saçma" hissin kaynağı. Tüm istatistik yok (sadece skor).
- lig.ts: 2 bölüm x 6 kulüp, 5 tur sezon, tablo/averaj/yükselme var. Oyuncu kulübü sabit (KULUP), kurulamıyor, oyuncu bazlı istatistik yok.
## Tasarım referansları (FIFA/PES/Sensible hissi)
- Formasyon çapaları + takım bloğu topa göre kayar (sıkışma), possession'da yukarı/savunmada geri.
- Savunma: bir presser, bir cover, kalanlar adam/bölge; topa herkes koşmaz.
- Hücum: top taşıyıcı dışındaki 1-2 destek oyuncusu açık/pas hattı temiz noktayı skorlar; diğerleri şekli korur.
- Karar: şut (xG ~ mesafe+açı), pas (ilerleme+hat+açıklık), sürme; algı gecikmesi + beceri gürültüsü -> aynı kalıp tekrar etmez.
- Kaleci: topla kale arasında yay üzerinde durur, şut hızına göre kurtarış olasılığı, dağıtımda açık savunmacıya atar.
- Test: headless seed'li botlar; metrikler: gol/maç, şut, pas isabeti, topa yığılma oranı, takım yayılımı, sıkışıp kalma.
## Görsel
- ACES + exposure 1.18, vinyet, tema skin.ts (v42) zaten var; PBR/LOD/Belgrad LOD v40'ta var. Bloom/SSAO bilerek yok (mobil).
