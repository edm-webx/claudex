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

## Sıradaki adımlar
1. Büfe buildSite (bufe-buyume.ts) setini bufeBoyut ile kur: vinç sadece büyük/dev (restoran thread'i de bu dosyada: küçük ve ayrık değişiklik).
2. Karşı yaka işletme tadilat görünümü (view isletme-insaat) isletmeBoyut ile: küçük işte kule vinç yok; boot lv geçirmeli.
3. Ses thread'ine not: matkap, çekiç, betoniyer, vinç, geri vites bip, mahalle ambiyansı (çocuk sesi, kuş, trafik).
4. Bug avı thread'inin inşaat sahası projeksiyon düzeltmesi dalı bulunamadı; birleştirmeden önce kontrol et.
