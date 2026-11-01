# Gulag Kaçışı 3D: plan

Hedef: Eski 2D canvas platform oyununu (yeni-oyun/gulag-itch-2026-10-24.zip) Three.js ile 2.5D gizlilik + bulmaca oyununa çevirmek.

## Spec
- Yandan kamera, 3D sahne (PBR, ay ışığı, gerçek gölgeli projektörler, sis, kar).
- Oynanış: koş, zıpla, eğil (sürünerek dar delikten geç, saklanma noktasında gizlen), E ile etkileşim, F ile sosis at.
- Tehlikeler: projektör (çatı altı güvenli), muhafız (fener konisi, görüş hattı), köpek (koku, sosisle oyalanır), dikenli tel (tel makasıyla kesilir).
- Bulmacalar: sandık itme, basınç plakası + kapı, şalter (süreli karartma), anahtar + kapı, 3 sigorta + sigorta kutusu.
- 5 el yapımı seviye, kontrol noktası, yakalanınca kontrol noktasından devam, her seviyede gizli lastik ördek.
- Hikaye: Viktor, Doktor Pavel, Nina (eski oyundan), seviye arası telsiz, final sahnesi.
- Ses: tamamen prosedürel WebAudio (rüzgar, kar adımı, alarm, havlama, müzik).
- Gore yok, silah yok.

## Plan
1. vendor/three.min.js (r159, global THREE, itch için çevrimdışı)
2. js/veri.js: seviyeler + metinler
3. js/ses.js: ses
4. js/oyun.js: dokular, sahne, karakterler, fizik, yapay zeka, arayüz
5. test/: Playwright ile ekran görüntüsü + otomatik oynanış kontrolü
