# Aşama 6: Halı saha ve stadyum v2.0 (2026-11-20)
Dal: claude/project-thread-wa2wu6 (taban jo0q11 @ 4a36662). Entegrasyon: ana thread merge eder.
Kaynak paketler: /mnt/project-files/sosisci-oyun/plan-2026-11-13/studyo/uzman-paketleri.json (FUT-01..18), sahibin sözleri studyo/talepler-futbol.txt.

## Kararlar (sahip sözlerine dayalı)
- Faul + penaltı + kale vuruşu YAPILIR: karar paketi B-046 "Hakem: taç, korner, kale vuruşu, penaltı, faul." Sarı kart yalnız uyarı, atma yok.
- Tuşlar: B-050 (WASD, Shift koş, Space pas, E uzun/ara pas, F şut şarjlı, C müdahale, Q değiştir) ana şema; eski K/L/Space-şut alternatif olarak kalmaz -> çakışma: Space artık PAS. Ekranda yardım kartı.
- Maç 2 yarı x ~2-3 dk (B-047). 5v5 kalır (bugünkü, 7v7 belirsiz).
- Ödül rakamı (6000+kapı vs 15k/5k/2k): sahibe karar kartı; cevap gelene kadar bugünkü değer.
- KODLANMAZ (karar bekler/öneri): FUT-10 (maçı dünyaya taşıma), FUT-16 (k6 işletme bağı, işletme rolüne bağlı), FUT-O1..O5. Koordinatörün iskelede ikinci standı yok (sonraki mesaj: halı saha önü).

## Motor sözleşmesi (görsel ve UI bunu okur; alan yoksa varsayılan kullan)
- m.ball.z, m.ball.vz (metre, top yüksekliği; yerde 0)
- p.dive (sn, >0 kaleci dalıyor), p.diveDir (-1 | 1, y yönü), p.act ('' | 'kick' | 'tackle' | 'celebrate') + p.actT
- m.ref {x, y, signal: '' | 'foul' | 'penalti' | 'korner' | 'tac' | 'aut' | 'kale', t}
- m.heat 0..1 (tribün heyecanı)
- Ev ek: {k:'foul', team, x, y, pen}, {k:'save', team}, {k:'post'}, {k:'card', who}
- restart.kind: 'tac' | 'korner' | 'aut' | 'kale' | 'serbest' | 'penalti'
- act() API ve createMatch(o) imzası korunur; MatchOpts'a plan?: [string,string] eklenir.

## İş bölümü (paralel, dosya sahipliği ayrık)
| İz | Sahip | Paketler | Dosyalar |
|---|---|---|---|
| Motor | ana oturum | FUT-01,02,03,04,05 | sim/macmotor.ts, sim/mac-olcum.ts(yeni), tools/mac-metrik.mjs(yeni), tests/sim/macmotor*.test.ts |
| Görsel | ajan G | FUT-08,09, FUT-06 (3D kısmı) | ui/hali-saha-3d.ts, view/stadyum/** , tests/browser/halisaha-*.mjs |
| Kulüp/lig | ajan K | FUT-11,12,13,14,15,17 | sim/{halisaha,lig,stadyum}.ts, content/lig.ts, ui/koordinator.ts(yeni), ui/mulk-panel.ts (yalnız stadyum/lig sekmeleri), tests/sim/{lig,kulup-mac}.test.ts |
| Kontrol/akış | ajan C | FUT-07, FUT-06 (sabit adım), FUT-18 (olay->ses eşleme) | ui/hali-saha.ts, ui/hali-saha-girdi.ts(yeni), tests/unit/hali-saha-girdi.test.ts |

## Durum
- [ ] Motor  - [ ] Görsel  - [ ] Kulüp/lig  - [ ] Kontrol  - [ ] Birleştirme + qa + ekran görüntüleri  - [ ] Ana thread'e teslim
