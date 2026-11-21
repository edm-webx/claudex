/**
 * Named worker legends and card blurbs (v2 D.LEGENDS, D.ABOUT).
 * Ported 1:1 from v2 data.js (numbers and Turkish text kept). Owner: Builder C (M1). Pure data, no imports of sim code.
 */

export interface LegendDef { id: string; name: string; role: string; trait: string; rarity: string; price: number; team?: string; look: Record<string, unknown>; about: string; }
export const LEGENDS: LegendDef[] = [
  {
    "id": "riza",
    "name": "Rıza",
    "role": "doner",
    "trait": "uykucu",
    "rarity": "altin",
    "price": 900,
    "look": {
      "skin": 4,
      "body": "mid",
      "hair": "short",
      "hairColor": "#2b1d14",
      "mustache": true,
      "top": "#f7f7f2",
      "bottom": "#4a3a2a",
      "apron": "#1d5fa8",
      "apronText": "RIZA",
      "hat": "cap"
    },
    "about": "Hayali: kendi büfesi. Sabri'ye söylemeyin."
  },
  {
    "id": "tayfun",
    "name": "Tayfun",
    "role": "cay",
    "trait": "fenomen",
    "rarity": "altin",
    "price": 2000,
    "look": {
      "skin": 3,
      "body": "slim",
      "hair": "quiff",
      "hairColor": "#1b1410",
      "mustache": false,
      "top": "#2ecc71",
      "bottom": "#2e3a4a",
      "apron": "#1d5fa8",
      "apronText": "TAYFUN",
      "glasses": true
    },
    "about": "Telefonunda 4.000 martı fotoğrafı var."
  },
  {
    "id": "nazli",
    "name": "Nazlı",
    "role": "garson",
    "trait": "geveze",
    "rarity": "altin",
    "price": 2500,
    "look": {
      "skin": 2,
      "body": "mid",
      "hair": "bun",
      "hairColor": "#5a2d0c",
      "headscarf": null,
      "top": "#ff9f43",
      "bottom": "#3a3a5a",
      "apron": "#1d5fa8",
      "apronText": "NAZLI"
    },
    "about": "Kayınvalidesi Kadıköy'de, o yüzden fazla mesaiye hep hazır."
  },
  {
    "id": "sedat",
    "name": "Kuzen Sedat",
    "role": "garson",
    "trait": "cevresi",
    "rarity": "altin",
    "price": 3200,
    "look": {
      "skin": 5,
      "body": "round",
      "hair": "short",
      "hairColor": "#3a2a1a",
      "mustache": true,
      "top": "#8e44ad",
      "bottom": "#2d2d2d",
      "apron": "#1d5fa8",
      "apronText": "SEDAT"
    },
    "about": "Dayısı belediyede (öyle diyor)."
  },
  {
    "id": "husnu",
    "name": "Kaleci Hüsnü",
    "role": "garson",
    "trait": "futbol",
    "rarity": "altin",
    "price": 3200,
    "team": "lodosspor",
    "look": {
      "skin": 6,
      "body": "mid",
      "hair": "short",
      "hairColor": "#1b1410",
      "mustache": false,
      "top": "#2ec4c4",
      "bottom": "#ff8a3d",
      "apron": "#1d5fa8",
      "apronText": "HÜSNÜ"
    },
    "about": "Gençken amatör ligde kaleciymiş (öyle diyor)."
  },
  {
    "id": "gulizar",
    "name": "Bülbül Gülizar",
    "role": "cay",
    "trait": "turku",
    "rarity": "altin",
    "price": 3200,
    "look": {
      "skin": 7,
      "body": "mid",
      "hair": "long",
      "hairColor": "#2b1d14",
      "headscarf": "yazma",
      "top": "#c0392b",
      "bottom": "#3a2a4a",
      "apron": "#1d5fa8",
      "apronText": "GÜLİZAR"
    },
    "about": "Bu türkü dedemden kalma, diyor; dedesi de öyle dermiş."
  }
];
export const ABOUT: string[] = [
  "Dayısı belediyede (öyle diyor).",
  "Kayınvalidesi Kadıköy'de, o yüzden fazla mesaiye hep hazır.",
  "Üç kere vapur kaçırdı, üçünde de simit yüzünden.",
  "Telefonunda 4.000 martı fotoğrafı var.",
  "Tavlada onu kimse yenemiyor, kendisi de dahil.",
  "Kedisinin Martıgram hesabı kendisinden popüler.",
  "Emekli olunca balıkçı olacak. 23 yaşında.",
  "Gençken amatör ligde kaleciymiş (öyle diyor).",
  "Çayı ikinci bardaktan sonra \"tadına bakmak\" için içer.",
  "Bir kere bir yunus görmüş, herkese anlatıyor.",
  "Hayali: kendi büfesi. Sabri'ye söylemeyin.",
  "Bayramda bütün mahalleye şeker dağıttı, kendine kalmadı.",
  "Vapurda hep aynı koltuğa oturur, kimse ona dokunmaz.",
  "Mahalle maçında üç kez kaleci oldu, üçünde de gol yemedi (öyle diyor).",
  "Sabahları martılara günaydın der, cevap bekler.",
  "Cebinde hep bir paket kesme şeker taşır."
];
/** Story legends appear on the board in this order (v2 makeBoard): role they need to be open, optional min play time. */
export const STORY_LEGENDS: { id: string; role: string; minPlayT: number }[] = [
  { id: 'riza', role: 'doner', minPlayT: 0 }, { id: 'nazli', role: 'garson', minPlayT: 600 }, { id: 'tayfun', role: 'cay', minPlayT: 0 },
];
