# İlerleme / kaldığım yer (2026-11-26)
Dal: claude/project-thread-arinot (taban jo0q11 fef56d9). Ana dala birleştirme YOK, kullanıcı "tamam" diyene kadar.

## Bitti
- content/santiye.ts: SETLER (küçük/orta/büyük/dev), bufeBoyut, isletmeBoyut, YAPI_ASAMA, YAPI_SURE (ev 240 s, dükkân 360 s), arsaBoyut.
- view/world/santiye-kit.ts: santiyeKur() + parçalar. `sikisik` (dar arsa: malzeme içte), `ustKat` (temelsiz üst kat kabuğu).
- Kullanıcı kararı: arsalar 42B ile gidilen ayrı mahalle ("Martı Konutları", realm 'mahalle', x 244..292, durak "Meydan Çeşmesi").
- view/mahalle/index.ts: park (salıncak, kaydırak, tahterevalli, kum havuzu), BAKKAL/FIRIN/BERBER/ECZANE/MANAV, arka apartmanlar, yol + yaya geçitleri,
  5 araba, ~31 yaya (bisikletli/top oynayan/salıncakta çocuklar, bankta oturanlar, esnaf, belediye süpürgeci/bahçıvan/hendek ekibi/trafik görevlisi),
  Martı Apartmanı şantiyesi (iki kat karkas + üst kat duvar + mobil vinç), belediye altyapı çalışması (hendek, boru, çöp kamyonu).
  NPC'ler seg 0.45 (chars-v2 segK seçeneği) -> mahalle dengeli 281k üçgen / 198 çağrı (karşı yaka 610k, bütçe 617k).
- sim/mulk.ts: arsaKur ev/dükkân süreli inşaat (Plot.insa), bitince toast + XP; altın simitle atlama; inşaat sürerken dükkân satmaz, ev açılmaz.
- ui/mulk-panel.ts: "yapılıyor %x" satırı + altınla bitir. view/mulk: arsada aşamalı kabuk + kit; view/mahalle: her inşaata 3 yürüyen usta.
- Usta sayıları SETLER'den (büfe ustaSayisi, işletme isletmeBoyut).
- Testler: tsc temiz; tests/sim 102 dosya / 675 test geçti (mulk testi yeni süreli davranışa göre, realm testine mahalle otobüs turu eklendi).
- Görseller: calisma/santiye/shot/mahalle/*.png. Üretmek: `npx vite build && node tools/build-artifact.mjs`, sonra
  `PRE="$(cat pre.js)" SPOTS='{"genel2":[268,9,268,8,3.0,0,0.6],"egik2":[266,9,266,2,1.3,0,-0.3]}' node tests/browser/insaat-shot.mjs out`
  (PRE = arsaAl a1..a3 + arsaKur farklı zamanlarda; ARSA_HAK 3 olduğundan a4 boş arsa kalır).

- 8f6d43d: büfe buildSite + karşı yaka işletme tadilatı SETLER boyutuna bağlı (vinç sadece büyük/dev). Hata düzeltmesi: mulk view().plots'ta
  `tadilat` yoktu, karşı yaka iskelesi hiç kurulmuyordu. Görseller calisma/santiye/shot/tadilat/.
- HUD/emlak thread'i (dal b1jn50) b2a9074'ü birleştirdi; ECZANE dükkânı MARTI EMLAK oldu (kapı 265.6, 14.4), arsa alma/kurma sadece orada.
- Ses thread'ine not gönderildi.

## Kalan
- Kullanıcı denemesi ve "tamam"ı. Sonra Ana İş jo0q11'e birleştirir (b1jn50 ile birlikte; çakışma yok, b1jn50 benim b2a9074'ümü içeriyor).
- Bug avı thread'inin inşaat projeksiyon düzeltmesi dalı bulunamadı; birleştirmede kontrol.
