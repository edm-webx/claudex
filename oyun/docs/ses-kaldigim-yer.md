# Müzik ve ambiyans: kaldığım yer (2026-11-25)

Dal: claude/project-thread-o1d81t

## Bitti
- 25 gerçek Opus ambiyans döngüsü oyun/public/ses altında; 13 döngü ses-db'de `file` ile bağlı (sentez yedek). STREAM_BUDGET 16 MB.
- Müzik varyantları: music.ts `varyasyon()`, 12 varyant; player.ts çok-varyantlı mod (1-2 tur + sessiz ara). AÇIK (kullanıcı 26 Kasım "beğendim" dedi): ses-db.json `music.coklu.on=true`.
- Önizleme: https://claude.ai/artifact/FE2hkPTqSscWjQNvsT1zt4
- SFX: bank.sfx(id, variant), varsayılan 4 çeşit, perde/seviye oynaması; yeni adim_ahsap/beton/toprak/fayans + kapi_ac/kapa (audio-map.ts adım sayacı + iç mekan geçişi). Testler: tests/unit/audio/varyant.test.ts.

## Sıradaki adımlar
1. Kullanıcı önizlemeyi dinleyince coklu.on'u aç (onay şart).
2. Ses haritası denetimi: para/kasa/tepsi al-bırak/pişirme/kesme/seviye atlama/müşteri tepkisi için sim'de olay var mı bak (tepsi ve müşteri tepkisi olayı yok görünüyor); eksik olayları content/sfx.ts'e bağla.
3. Eksik kayıtlar: martı, gece denizi, hastane, okul, stadyum kalabalığı, saz/ney. GDC 2024 bölüm 4 ve 5 indirmesi 25 Kasım'da başlatıldı (sonuç görülmedi), 7-9 hiç indirilmedi. İndirme PC'de Claude Browser panelinden (Cloudflare yüzünden), işleme PC Remote Control oturumunda (ffmpeg).
4. Kesitleri kulakla dinle (orman gecesinde baykuş yüksek olabilir).

## Açık kararlar
- Müzik çeşitliliği oyunda açılsın mı (önizleme onayı).
- Bellek bütçesi 16 MB yeterli mi (cihazda ölçülmedi).
