# Dondurulmuş: Martı Emlak ofisi (2026-11-26)
Kullanıcı: "yeni arsalar mahalle gibi ayrı yerde olacak, sonraya attık". Bu iş HUD dalından çıkarıldı, burada saklı.

## Ana İş için birleştirme uyarısı
Bu dalın geçmişinde inşaat thread'inin b2a9074 commit'i merge edilip (0e6794c) sonra geri alındı (a1216e8). Normal `git merge` yapılırsa git b2a9074'ü "zaten birleşti" sayar ve inşaat dalı sonradan birleşince onun mahalle/inşaat kodu silinmiş kalır.
Bu dalı jo0q11'e **`git merge --squash`** ile (ya da `git diff a0775a6^..<uç>` yamasıyla) al; normal merge kullanma.

## Geri getirmek için (mahalle açılınca, inşaat dalı claude/project-thread-arinot)
- 1-emlak-kapisi.patch: content/esya.ts EMLAK (kapı 265.6, 14.4, menzil 2.6), sim/mulk.ts nearEmlak/emlakDegil (arsaAl, arsaKur, yukselt sadece ofiste; acilisSerbest atlar), mulk-panel ofis notu + düğme kilidi + kapı ipucu, telefon mini harita EMLAK noktası. HUD ucuna göre alındı; telefon/hud-shot satırlarındaki küçük farkları atla. mulk.ts'de arinot'un arsaKur insa satırıyla elle birleştir (ev satırının önüne emlakDegil()).
- 2-mahalle-eczane-emlak.patch: view/mahalle/index.ts (arinot b2a9074'e göre): ECZANE -> MARTI EMLAK tabelası, vitrin ilanları, ayaklı pano, emlakçı NPC, kameraya yatık çatı tabelası, sign() rx parametresi.
- Tam hâli commit 9634861'de.
Görseller: ../shots/emlak3/ (çatı tabelası), ../shots/emlak-tel/ (telefon paneli).
