# Bulgular (2026-11-23)
Yöntem: denetci.mjs STAGE=10 (38 nokta), insaat-shot.mjs (mikser/betoniyer/saha), es-duzlem.mjs (eş düzlem + bozuk normal).

## Düzeltilen
1. Mikser tamburu (insaat-sahasi.ts): 6 beyaz şerit düz kutuydu; tambur uçlarda daraldığı için uçlardan dışarı çubuk gibi taşıyordu,
   ry ile de yüzeye teğet değildi. Tambur ters takılıydı (ağız kabine, kalkık uç önde). Yeni: helis() yüzeye yapışık spiral şerit,
   ağız arkada oluğun üstünde, ağız içi koyu disk. Betoniyerdeki tek düz şerit de helis.
2. İç mekânlarda havada kiriş/çubuk (ic-mekan-look.ts): yakın duvar arkadan bakınca (backface) kayboluyor ama süpürgelik, bant,
   kesik başlık, pencere kasası ve kapı kasası kutu olduğu için kalıyordu. Artık her duvarın süsü kendi mesh'inde, duvar düzlemiyle
   aynı kuralla gizleniyor (kafe, bistro, kırtasiye, kantin, tesis, banka, hastane, mutfak, AVM dükkanları hepsi).
3. Dükkân cephe süsü (karsi-yasam.ts): içerideyken tente/lamba kolları/ampul dizisi odanın üstünde havada kalıyordu; kabuk gibi gizlenir.
4. Salon çatı merdiveni (bufe-buyume.ts): 14 basamak havada duruyordu; limon kirişi, korkuluk, dikme eklendi.
5. Kayık (scenery.ts): batı salonun güvertesinin altına giriyordu; z -19 -> -21.6.
6. Yol uçlarındaki tünel blokları (yol-look.ts): üstten düz gri kutu; çimenli sırt + çalı + taş başlık.
7. Eş düzlem: halı saha tribün basamak uçları (karsi.ts), okul çiti tel/ray (karsi.ts), stadyum tribün sırt nervürleri
   (stadyum/index.ts), otobüs kapısı/cam iç yüzü (yol-look.ts).

## Bakıldı, hata değil / kapsam dışı
- Bina çatısındaki eş düzlemler (H kotu): korniş kutusunun içinde, görünmez. Büfe fayans/zemin, banka arka pencere kasaları: duvara gömülü.
- Pier/promenad -0.73 eş düzlemi: denize bakan yüz, kameradan görünmez.
- Mutfak arkasındaki sarı şerit: çatıdaki "SABRİ'NİN SOFRASI" tabelası (dik açı), doğru.
- Eski AVM plaza (hastane yanı boş taş meydan): bilinen açık tasarım sorusu. denetci.mjs moda/tekno/oyuncak noktaları eski AVM yerini gösteriyor.
- Salon E'de masa üstü turkuaz kare: sarı kare/masa satın alma mantığı (başka thread).
- Gerçek GPU'ya özgü titreme bulutta görülmez (SwiftShader); bozuk normal taraması 0.
