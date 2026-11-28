# Okul iç mekanı (thread "Build enterable school with classrooms", dal claude/project-thread-dxorpc)

Sahip 2026-11-28: "okul da içine girilebilecek avm gibi; sınıflar olacak, müdür olacak, her şeyi yapmamız gerekiyor".

## Spec
- Karşı yakadaki Martıköy İlkokulu (x 48.85, z 37.25) kapısına yürüyen AVM gibi ayrı diyara geçer: realm 'okul', x 1300..1400 (hastane 1450..1550).
- Diyar: önde giriş meydanı (bayrak direği, Atatürk büstü, bahçe kapısı = çıkış), bina 48 x 19 m, arkada bahçe (basket, oyun alanı, banklar, ağaçlar).
- Bina: ortada 3.5 m koridor; ön sıra Müdür Odası, Müdür Yrd./Sekreterlik, Öğretmenler Odası, giriş holü (Atatürk köşesi, kupa dolabı), Revir, Fen Laboratuvarı, Kütüphane;
  arka sıra 1-A, 2-A, 3-A (İngilizce dersliği = sınav yeri, eski 'okul' odası), 4-A, Müzik & Resim, Kantin (k4 işletmesi buraya taşınır), ortada bahçe kapısı.
- Yaşam: ders programı ve zil (08:30 giriş töreni, 40 dk ders + 10 dk teneffüs, 12-13 öğle, 15:00 çıkış). Derste öğrenciler sıralarda, öğretmen tahtada;
  teneffüste koridor ve bahçeye taşarlar; müdür tur atar, sekreter masada, hemşire revirde, kütüphaneci, hizmetli koridoru siler, öğretmenler odasında çay.
- Kurallar: stok yok, aletler katı değil, ajanlar gerçek yürüyen aktör; flaş yok; perf bütçesi (karşı yaka <= 617k tris).

## Plan
1. content/okul-ic.ts: plan sabitleri, odalar (IcMekan bina 'okulIc'), çarpışma, yol (okulYol), ders programı (faz).
2. Ortak dosyalara yalnız ek dallar: realm.ts, ic-mekan.ts (odalar + layoutlar), headless/walk (okul nav), disari.ts kilit itmesi, boot (görünüm + geçiş), kafe.ts k4 yolu, mulk.ts okulYakin, esya.ts k4 yeri, ses bölgesi.
3. sim/okul-gecis.ts: kapı geçişi. sim/agents/okul-yasam.ts: okul ajanları + zil olayı.
4. view/world/okul-ic.ts: koridor, cephe, meydan, bahçe, tabelalar; okul eşyaları ic-mekan-look'a ek builder.
5. Test: tsc, vitest (ilgili), tarayıcı çekimi (tests/browser/okul-ic.mjs), perf (tris/draw).
6. Review, push, rapor.
