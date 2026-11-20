/**
 * Turistler (survey musteri-4, musteri-7). Pure data: tourist pronunciations and guide wave. Used by src/game/sim/musteri.ts.
 */
/** Citizen types that count as tourists (cap + camera looks). */
export const TOURIST_TYPES = ['kruvaziyer', 'turgrubu', 'gezgin'];
/** Comic pronunciations per product, shown in the tourist's bubble. */
export const TOURIST_SAY: Record<string, string[]> = {
  doner: ['Dönır!', 'Dönner plis!', 'Dö-ner? Dönır!'],
  cay: ['Çayy plis!', 'Çaay, ince belli!', 'Tşay?'],
  ayran: ['Ayrun!', 'Ayraan, köpük köpük!', 'Eyran?'],
  simit: ['Simmit!', 'Simit, simit, simmit!', 'Sesame halka?'],
  tost: ['Tosst!', 'Tost, çiz çok!', 'Toast? Tost!'],
  gazoz: ['Gazooz!', 'Gazoz, fıss!', 'Gaz-oz?'],
};
export const TOURIST_THANKS = ['Teşekkürler! Teşşekür?', 'Çok güzel! Very çok!', 'Sabri numbır van!', 'Yummy, afiyet!'];
/** Sabri explains with hands and arms. */
export const SABRI_GESTURE = ['(el kol hareketi) Yes yes, çok güzel!', '(baş parmak) Süper, afiyet!', '(eliyle kalp) Hoş geldin turist!', '(parmakla sayar) Bir, iki... tamam!'];
export const PHOTO_TOAST = 'Büfen fotoğraflandı! Turist albümüne girdin.';
export const GUIDE_WAVE = { say: 'Rehber: Herkes bir şey alsın!', toast: 'Bayraklı rehber kafilesini getirdi! Toplu sipariş dalgası!' };
