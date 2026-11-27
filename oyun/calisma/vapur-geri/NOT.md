# Vapur geri geldi (2026-11-27, sınırlı)

Sahibi kararı: vapur sürekli gelip gider, düdük çalar, iskeleye yanaşır, yalnız vatandaş indirir (potansiyel müşteri).
Oyuncunun vapurla HİÇBİR etkileşimi yok.

## Yapılan
- sim/ferry.ts: gerçek evreler (away -> arriving 10 sn -> docked 25 sn -> leaving 16 sn). Yolcular vapur kapısından (22.4, -7.1) iner.
- Ekonomi: dalga anı (= eski kalabalık dalgasının `next` anı), büyüklüğü (KALABALIK_PAY 0.4) ve rng akışları aynı. Gece 00:30-06:00 aralığı x1.8 (seyrek).
- Vapur çeşitleri geri (content/ferries.ts, ferry-kinds.ts, view/world/ferry-look.ts). "Şehir Hattı" adı kurgusal "Martıköy Vapur Hattı" oldu.
- Kapalı (etkileşim): tarife tahtası, vapur penceresi, güverte koşusu, güverte büfesi geliri, vapur ipuçları, deniz taksisi seyahati.
- Düdük: ses-db `horn` + omni `vapur` yaması geri; yalnız `ferryHorn` olayında, iskele kapısından konumlu. Rastgele ambiyans düdüğü YOK.
- Gece ampulleri sabit (eski yanıp sönme kaldırıldı, ışığa duyarlılık).
- Görsel: üst güverte tik tahta, kaptan köşkü çatısı beyaz + lacivert şerit (kırmızı çatı yukarıdan kötü okunuyordu).
- Metinler geri: Vapur tostu, Vapurcu Kahve, Martıköy Vapur Hattı, sinema dizisi vapur sahneleri, koleksiyon, anlar, yiyecek hikâyeleri, tersane kızağındaki gemi.

## Test
- vitest 176 dosya / 1227 test yeşil; tests/sim/ferry.test.ts yeni kurallar; perf kapısı yeşil.
- Ekran: node tests/browser/vapur-shot.mjs calisma/vapur-geri (önce vite build + build-artifact).

## Açık
- vapur.opus (liman uğultusu kaydı) geri getirilmedi: kodda hiç bağlı değildi.
