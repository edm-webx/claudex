# Alım denetimi 2026-11-25
Test: tests/sim/alim-denetimi.test.ts (aşama 1-10 tüm sarı kareler: alınır, ulaşılır, yakın çakışma yok; ilk zincir; dekor x5 aşama; Deniz paneli).
Sonuç: tek oyunculu simde hata yok (130 kare aşama 10, rapor.json, dekor.json). Tam paket 1117 yeşil.
Düzeltme: misafirde sarı kareler gri "Ev sahibi açar" (view/world/rtview.ts). Misafir kare açamaz kararı korunuyor.
Açık: döner şikâyeti yeniden üretilemedi (ayrıntı bekleniyor).
