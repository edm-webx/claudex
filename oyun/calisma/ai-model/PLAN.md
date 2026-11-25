# Yapay zekâ 3D model denemesi (Tripo)
Kural (kullanıcı 2026-11-25): üretilen hiçbir model oyuna girmeden ÖNCE kullanıcıya gösterilir (döndürmeli önizleme sayfası +
oyun içi önce/sonra görüntüsü). Onaysız entegrasyon yok.
Kurulum: ortamda api.tripo3d.ai izinli + TRIPO_API_KEY (yeni oturumda okunur).

## İlk 3 model (stil testi)
Ortak stil: "stylized cozy low-poly game asset, soft rounded shapes, clean hand-painted colors, no text, no logos, game-ready, single object, neutral pose"
1. sabri: "chubby friendly middle-aged Turkish street food vendor, short black hair, thick mustache, white t-shirt, red apron, dark trousers, A-pose" (+ referans blender-kit2/referans/sabri-tombul-onarka.png ile image_to_model denemesi)
2. araba: "small compact city taxi car, yellow, rounded cartoon proportions" (marka/logo yok)
3. agac: "round leafy plane tree with thick trunk, lush green canopy"

## Sonra
- Önizleme: tek sayfa, üç model döner, üçgen sayısı + doku boyutu yazar; mevcut oyundaki karşılığıyla yan yana.
- Onay gelirse: üçgen azaltma (hedef: karakter <8k, araba <5k, ağaç <3k), oyunun ışığına uyum, oyuna ekleme.
- Not: Tripo karakterleri risiz gelir; yürüme animasyonu için ayrıca rig (Tripo animate_rig) gerekir.
