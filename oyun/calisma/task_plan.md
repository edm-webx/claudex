# task_plan.md — Büfe + Stadyum + Belgrad yeniden kurulum (thread 2026-11-02)
Kaynak: oyun/ (motor-v40 kopyası, Vite+TS+Three 0.160). Kural: Spec>Plan>Implement>Test>Review, minimal kod, sahte test yok.
Kapsam: sadece iskele/büfe çevresi, stadyum + halı saha, Belgrad ormanı.

## Fazlar
1. [x] Repo'ya taşı, build doğrula (npm ci + build OK; check-dist external URL uyarıları eski/bilinen)
2. [~] Saha araştırması -> findings.md
3. [ ] Maç motoru yeniden yazımı: sim/macmotor.ts (saf, seed'li, formasyon+rol, istatistik) + headless bot testleri
4. [ ] hali-saha.ts'i yeni motora bağla (UI sadece çizer), stat ekranı
5. [ ] Kulüp kurma standı (ad, forma, arma) + lig/fikstür/puan durumu/istatistik çetelesi (lig.ts üstüne)
6. [ ] Gezgin gözlemci botlar: Playwright turu (iskele, büfe içi, stadyum, Belgrad) -> bug listesi -> düzelt
7. [ ] Görünüm: HUD/UI yeniden tasarım, PBR/LOD, placeholder temizliği
8. [ ] Büfe içi asset/özellik denetimi
9. [ ] Doğrulama + itch zip (yalnız "at" denince)
