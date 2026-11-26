# Kırtasiye kulübesi (2026-11-26)
Sahip: "kırtasiye binası merdivenin önünü kesiyor, küçük bir kulübe yap". Bina (24.45..31.55) üst geçit merdiven ayağına (UG x 22.85..25.15, iniş z 33.0) biniyordu.
Şimdi: 5.0 x 3.6 m, x merkez 29.7 (27.2..32.2; merdivene 2 m, doğuda basket çiti 32.5'e 0.3 m), 1 kat, kiremit çatı. Kapı önü (29.7, 32.6).
Değişen: content/zones/karsi.ts, ic-mekan.ts (boyut + kirtasiyeLayout yeniden), esya.ts (k3 x/kapı), view/world/karsi-bina.ts, karsi-look.ts (eski liste), gezgin manifest.json (yeniden üretildi).
Kural: doğu ön köşeyi (tezgâh ucu) boş bırak; personel yolu oradan dolaşır (tests/unit/ic-mekan-yerlesim).
Çekim: node tests/browser/kirtasiye-kulube.mjs <çıktı> ; önce/sonra: calisma/kirtasiye-kulube/{once,sonra,ic}
