/**
 * VIP (Gurme Bülent Bey) and the kapkaççı (v2 D.VIPS, D.KAPKAC).
 * Ported 1:1 from v2 data.js (numbers and Turkish text kept). Owner: Builder C (M1). Pure data, no imports of sim code.
 */

export interface VipDef { id: string; name: string; fromDay: number; every: number; look: Record<string, unknown>; voice: number; minTier: number; lines: { arrive: string; chew: string[]; pass: string; partial: string; fast: string }; }
export const VIPS: VipDef[] = [
  {
    "id": "gurme",
    "name": "Gurme Bülent Bey",
    "fromDay": 5,
    "every": 2,
    "look": {
      "skin": 3,
      "body": "round",
      "hair": "slick",
      "hairColor": "#3a3a3a",
      "mustache": true,
      "top": "#2c3e50",
      "bottom": "#2c3e50",
      "glasses": false,
      "hat": "fedora"
    },
    "voice": 105,
    "minTier": 2,
    "lines": {
      "arrive": "Gurme Bülent Bey geldi! Siparişini elden sen ver.",
      "chew": [
        "Hımm...",
        "Hımmmm...",
        "Hım."
      ],
      "pass": "Lavaş iyi, yürek daha iyi. Yıldızı hak ettin evladım.",
      "partial": "Hımm. Emek var ama bir kademe daha isterdi. Yarın yine gelirim.",
      "fast": "Acele eden lokmayı kaçırır... ama güzel."
    }
  }
];
export interface KapkacDef { name: string; fromDay: number; every: [number, number]; look: Record<string, unknown>; caught: string; escaped: string; turned: string; }
export const KAPKAC: KapkacDef = {
  "name": "Kapkaççı",
  "fromDay": 3,
  "every": [
    1,
    3
  ],
  "look": {
    "skin": 4,
    "body": "slim",
    "hair": "short",
    "hairColor": "#1b1410",
    "top": "#555b66",
    "bottom": "#2d2d2d",
    "hat": "beanie"
  },
  "caught": "Abi şaka şaka, ben sana parayı taşıyordum!",
  "escaped": "Annem duydu abi, al paranı.",
  "turned": "Köpek var, köpek! Ben bir şey yapmadım!"
};
