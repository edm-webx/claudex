# Martı Asset Fabrikası: Claude Code kuralları

Bu klasör Sabri'nin Büfesi oyununun 3D modellerini KODLA üretir (three.js 0.160.1, oyunla aynı sürüm).
Kullanıcı Türkçe konuşur, sade ve kısa cevap ister. Görünür sonuç ister, altyapı gevezeliği istemez.

## Kurallar
- Birim metre, y yukarı, model zeminde (0,0,0), ön yüz +z. Araçlarda kapılar -x tarafında (sağdan direksiyon değil, Türkiye trafiği).
- Her üretici `(k, secenek, R)` alır, `THREE.Group` döner. `k` = `kit()` (src/kit.js). Rastgelelik sadece `R` (tohumlu) ile; `Math.random` yasak.
- Hareketli parça (teker, kapı, kol, bacak, kafa, kuyruk) bir `Group` içinde ve `userData.hareket = true`. Erişim `g.userData.parca`.
- Katı çarpışma için `g.userData.carpisma = {w,h,d}` ver (yoksa `uret` ölçer). Oyunda otobüs/bina içinden geçilmesin diye bu kutu kullanılır.
- Bütün markalar uydurma/parodi: Kolaz, Boğaz Gazozu, Ayranbey, Martı Su, Narçiçek, Martıkart, Paket Kuş, Martıspor... Gerçek marka, takım, logo YOK.
- Sevimli, yuvarlak köşeli, temiz renkler (oyunun mevcut görünümü). Dini/siyasi/+18 içerik yok.
- Performans: `pisir(g)` sonrası çizim çağrısı ~40 altı, GLB 3 MB altı. Küçük parçada az segment.

## Yeni asset ekleme
1. Uygun dosyaya üretici yaz: karakter.js, arac.js, bina.js, dekor.js, yemek.js, doga.js (ya da yeni dosya).
2. src/katalog.js içindeki KATALOG'a bir satır ekle (id, ad, kat, yap, isteğe bağlı secenek listesi).
3. `npm run disa-aktar -- <id>` (ya da `node araclar/disa-aktar.cjs . <id>`) çalıştır, `onizleme/<id>.png` resmine BAK, kötüyse düzelt, tekrar.
4. Hepsi bitince tam `npm run disa-aktar` (katalog.json güncellenir).
5. Vitrin: `npm run vitrin`, tarayıcıda http://localhost:5180

## Oyuna bağlama
- Kod olarak: src/ klasörünü oyunda `src/game/view/fabrika/` altına kopyala, `import { kit } from './fabrika/kit.js'; import { uret } from './fabrika/katalog.js';` sonra `scene.add(uret(kit(), 'otobus', { hat: '42B' }, 7))`.
- Dosya olarak: `glb/<id>.glb` dosyalarını GLTFLoader ile yükle.
