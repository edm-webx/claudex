# Bulgular
- Mevcut okul: karşı yaka tek oda (sınıf yarısı + kantin k4 yarısı), content/ic-mekan.ts 'okul' + okulLayout; sakinler sim/agents/ic-sakin.ts OKUL (12 öğrenci + öğretmen, ders saatleri).
- AVM deseni: realm 'avm' (x 1150..1250), content/avm-kat.ts (AVM_OX), sim/avm-gecis.ts (kapı ışınlama), view/world/avm-ic.ts (hol), odalar IcMekan bina 'avm', kafe.ts gel/git yolları, headless katNav (yalnız dikdörtgen engel; ızgarasız nav her yer yürünür).
- disari.ts kilitli bölge itmesi AVM'yi istisna tutuyor (realmAt(...).id !== 'avm'): okul diyarı da istisna olmalı (bus === false genel kural).
- ic-mekan-look görünürlük: AVM odaları avmIcinde ile; diğerleri "aynı binanın odasındaysan". Okul koridoru için okulIcinde dalı gerek.
- Sınav: mulk.ts okulYakin = IC_BY_ID.okul içinde. Kantin k4: kafe.ts ROOMS room 'okul'.
- Sesler: ses-db 'zil' (okul zili), 'cocuk', döngü 'ic_okul' var.
