# Bulgular
- KÖK NEDEN: three EffectComposer ping-pong sırası kareler arasında korunur. Akıcı (antialias:false) FXAA geçişini açar (2026-11-25 grafik-kalite).
  Karede swap eden geçiş sayısı 3 oldu (OutputPass + GRADE + FXAA) = tek sayı. Her iki karede bir RenderPass sahneyi rt1'e
  (derinlik tamponu yok) çizdi: zemin her şeyin üstüne çıktı, ekran iki görüntü arasında her karede gidip geldi (30-60 Hz strobe).
  Otomatik modda zayıf cihaz Akıcı seçince oyun açılışında da oluyordu.
- Ölçüm (SwiftShader, 640x360, ardışık 8 kare): önce Akıcı lum 101<->128, piksellerin %50'si her karede değişiyor; ana menüde 60.2<->65.9.
  Sonra: sabit (Δlum ≤0.3), tüm kademeler + Otomatik.
- İkincil: setTier içindeki setTime ışıkları havasız değere sıfırlıyordu; havaLook birkaç kare sonra karartıyordu (~%4 parlama). applyTier'da relight.
- Düzeltme: render/index.ts postBufFix (composer.render sonrası readBuffer !== renderTarget2 ise swap) + gfx().postBufOk; boot.ts applyTier relight.
