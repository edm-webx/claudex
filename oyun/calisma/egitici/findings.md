# Bulgular
- src/game/tutorial.ts: TUT ok adımları (walk, doner, counter, money, pad_*, cay, isbul...) duraklatmaz; tut_<id> kayıtta. 'pencere'/window adımları vapur -> eklemeyin (vapur kalıcı yasak).
- hikaye karakter eğiticileri kapalı (HIKAYE_ON=false); kullanıcı eskiden istenmeyen karakter eğiticisi istemedi -> kartlar karaktersiz.
- Duraklama: rt.paused + rt.pauseWhy (karne.ts kasa/gunSonu, mini.ts, offline.ts welcome, esnafim.ts). Duraklıyken sim sistemleri çalışmaz.
- Kamera: engine/camera/index.ts pan() en çok 2 sn, tutma yok; boot.ts:803 follow zinciri (acilis?.kamera() ?? camHold ?? ...) tutma için uygun.
- v2State() anchors: counter, kasa, job, stations, tables, pads[{key,pos}]; mulk.ts arsaAl/arsaKur toast'ları ('🏗️ Arsa senin!', '🏠 Evin hazır!'), K.stat('arsaAlindi').
- Bugün arsa = çitli boş parsel (ekran görüntüsü) -> görünürlük işi başka thread.
- HUD bugün: koyu lacivert; alt bar Harita/Karakter/Envanter/Mülk; sağ altta Usta Dokunuşu; üstte Arkadaş çağır. HUD yeniden tasarımı ayrı thread.
