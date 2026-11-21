/**
 * Worker traits and football teams (v2 D.TRAITS, D.TEAMS). fx keys: speed, cutSpeed, morningSpeed, eveningSpeed, price, tip, patienceAura, auraR, carry, walk, wage, followers, tanidik, upgradeDiscount, sleep, chat, dropEvery, phone, selfie, songPause, football, clean, showEvery, selfie.
 * Ported 1:1 from v2 data.js (numbers and Turkish text kept). Owner: Builder C (M1). Pure data, no imports of sim code.
 */

export interface TraitFx { speed?: number; cutSpeed?: number; morningSpeed?: number; eveningSpeed?: number; price?: number; tip?: number; patienceAura?: number; auraR?: number; carry?: number; walk?: number; wage?: number; followers?: [number, number]; tanidik?: [number, number]; upgradeDiscount?: number; sleep?: boolean; chat?: boolean; dropEvery?: number; phone?: boolean; selfie?: boolean; songPause?: boolean; football?: number; clean?: number; showEvery?: number; }
export interface TraitDef { id: string; name: string; effect: string; flaw: string; line: string; fx: TraitFx; roles: string[]; }
export const TRAITS: Record<string, TraitDef> = {
  // calisan feature (animasyon-8): Martı Fısıldayan, nods with a gull on the counter (view/chars/huy-motion.ts)
  "martici": { "id": "martici", "name": "Martı Fısıldayan", "effect": "Bahşiş +%5: müşteriler martı sohbetine bayılır", "flaw": "Martıyla dertleşir, %5 yavaş", "line": "Martılar beni anlar abi, ben de onları.", "fx": { "tip": 0.05, "speed": -0.05 }, "roles": ["garson", "cay", "doner", "tost", "temizlik"] },
  "uykucu": {
    "id": "uykucu",
    "name": "Uykucu",
    "effect": "Sabri uyandırırsa 20 sn ×3 hız; kendisi uyanırsa 10 sn ×2",
    "flaw": "90 sn'de bir 15-25 sn uyur",
    "line": "Uyumuyordum abi, gözümü dinlendiriyordum!",
    "fx": {
      "sleep": true
    },
    "roles": [
      "doner",
      "cay",
      "tost"
    ]
  },
  "fenomen": {
    "id": "fenomen",
    "name": "Fenomen",
    "effect": "2 dk'da bir selfie: 3-5 takipçi müşteri getirir",
    "flaw": "Işığı beğenmez, ikinci selfie: toplam 10 sn durur",
    "line": "Abi bir story atayım, sen devam et.",
    "fx": {
      "selfie": true,
      "followers": [
        3,
        5
      ]
    },
    "roles": [
      "cay",
      "doner",
      "garson",
      "tost"
    ]
  },
  "geveze": {
    "id": "geveze",
    "name": "Geveze",
    "effect": "Yakındaki kuyruğun sabrı %30 yavaş düşer",
    "flaw": "Laf daldırır, %10 yavaş",
    "line": "Abla o iş öyle olmaz, dur anlatayım...",
    "fx": {
      "patienceAura": 0.3,
      "auraR": 6,
      "chat": true,
      "speed": -0.1
    },
    "roles": [
      "garson",
      "cay"
    ]
  },
  "futbol": {
    "id": "futbol",
    "name": "Futbol Hastası",
    "effect": "Takımı kazanınca ertesi gün %30 hızlı",
    "flaw": "Rakip renkli taraftara 2 sn yavaş servis",
    "line": "Hakem bizi yaktı ama tepsiyi yakmam abi.",
    "fx": {
      "football": 0.3
    },
    "roles": [
      "garson",
      "doner",
      "cay",
      "tost"
    ]
  },
  "cevresi": {
    "id": "cevresi",
    "name": "Çevresi Geniş",
    "effect": "Her gün tanıdık grubu gelir; yükseltmeler %5 ucuz",
    "flaw": "Hep telefonda, %10 yavaş",
    "line": "O işi hallederiz abi, bacanağın kuzeni tam o işte.",
    "fx": {
      "tanidik": [
        3,
        5
      ],
      "upgradeDiscount": 0.05,
      "phone": true,
      "speed": -0.1
    },
    "roles": [
      "garson",
      "cay",
      "doner",
      "tost"
    ]
  },
  "bicak": {
    "id": "bicak",
    "name": "Bıçağı Konuşan",
    "effect": "Kesim istasyonunda %20 hızlı",
    "flaw": "10 üründe bir 1 sn bıçak şovu",
    "line": "Bıçak değil abi, keman bu.",
    "fx": {
      "cutSpeed": 0.2,
      "showEvery": 10
    },
    "roles": [
      "doner",
      "tost"
    ]
  },
  "sabahci": {
    "id": "sabahci",
    "name": "Sabahçı",
    "effect": "Sabah kalabalığında %30 hızlı",
    "flaw": "Akşamüstü esner, %10 yavaş",
    "line": "Ben martılardan önce kalkarım.",
    "fx": {
      "morningSpeed": 0.3,
      "eveningSpeed": -0.1
    },
    "roles": [
      "cay",
      "doner",
      "garson",
      "tost",
      "temizlik"
    ]
  },
  "gecekusu": {
    "id": "gecekusu",
    "name": "Gece Kuşu",
    "effect": "Akşam ve gece %30 hızlı",
    "flaw": "Sabah güneş gözlüğüyle, %10 yavaş",
    "line": "Güneş beni yorar abi.",
    "fx": {
      "eveningSpeed": 0.3,
      "morningSpeed": -0.1
    },
    "roles": [
      "tost",
      "doner",
      "garson",
      "cay",
      "temizlik"
    ]
  },
  "aceleci": {
    "id": "aceleci",
    "name": "Aceleci",
    "effect": "%25 hızlı",
    "flaw": "20 üründe 1'ini düşürür, yeniden yapar",
    "line": "Çabuk çabuk, vapur kaçıyor!",
    "fx": {
      "speed": 0.25,
      "dropEvery": 20
    },
    "roles": [
      "doner",
      "cay",
      "tost",
      "garson"
    ]
  },
  "titiz": {
    "id": "titiz",
    "name": "Titiz",
    "effect": "Yaptığı ürün %10 pahalı satılır",
    "flaw": "Tezgahı tekrar tekrar siler, %8 yavaş",
    "line": "Bu bardakta leke var, yeniden.",
    "fx": {
      "price": 0.1,
      "speed": -0.08
    },
    "roles": [
      "doner",
      "cay",
      "tost"
    ]
  },
  "hamarat": {
    "id": "hamarat",
    "name": "Hamarat",
    "effect": "%15 hızlı",
    "flaw": "Boşta kalınca sandalyeleri hizalar",
    "line": "Boş durursam hasta olurum.",
    "fx": {
      "speed": 0.15
    },
    "roles": [
      "doner",
      "cay",
      "tost",
      "garson",
      "temizlik"
    ]
  },
  "guleryuz": {
    "id": "guleryuz",
    "name": "Güler Yüzlü",
    "effect": "Bahşiş %10 fazla, kuyruk sabrı %15 yavaş düşer",
    "flaw": "Müdavimlere sarılır, 2 sn",
    "line": "Hoş geldin güzel insan!",
    "fx": {
      "tip": 0.1,
      "patienceAura": 0.15,
      "auraR": 8
    },
    "roles": [
      "garson",
      "cay",
      "doner",
      "tost"
    ]
  },
  "turku": {
    "id": "turku",
    "name": "Türkü Söyleyen",
    "effect": "4 m içindeki müşterilerin sabrı %20 fazla",
    "flaw": "Uzun havada gözünü kapar, 4 sn durur",
    "line": "Bu türkü dedemden kalma.",
    "fx": {
      "patienceAura": 0.2,
      "auraR": 4,
      "songPause": true
    },
    "roles": [
      "cay",
      "garson"
    ]
  },
  "kestirmeci": {
    "id": "kestirmeci",
    "name": "Kestirmeci",
    "effect": "Yürüme hızı %20 fazla",
    "flaw": "Dekorun arasından geçer, sandalye kayar",
    "line": "Buradan kısa abi, güven bana.",
    "fx": {
      "walk": 0.2
    },
    "roles": [
      "garson",
      "temizlik"
    ]
  },
  "pehlivan": {
    "id": "pehlivan",
    "name": "Eski Pehlivan (öyle diyor)",
    "effect": "Taşıma kapasitesi +2",
    "flaw": "Gençlik hikayesi anlatır, 2 sn",
    "line": "Gençken dişimle kamyon çekerdim.",
    "fx": {
      "carry": 2
    },
    "roles": [
      "garson"
    ]
  },
  "tutumlu": {
    "id": "tutumlu",
    "name": "Tutumlu",
    "effect": "Maaşı %30 düşük",
    "flaw": "Peçeteyi dörde böler",
    "line": "İsraf etmeyelim abi.",
    "fx": {
      "wage": -0.3
    },
    "roles": [
      "doner",
      "cay",
      "tost",
      "garson",
      "temizlik"
    ]
  },
  "bahsis": {
    "id": "bahsis",
    "name": "Bahşiş Avcısı",
    "effect": "Bahşiş %20 fazla",
    "flaw": "Servisten sonra oyalanır, taşırken %10 yavaş",
    "line": "Afiyet olsun abla... afiyet... olsun...",
    "fx": {
      "tip": 0.2,
      "walk": -0.1
    },
    "roles": [
      "garson"
    ]
  },
  "temizlikhastasi": {
    "id": "temizlikhastasi",
    "name": "Temizlik Hastası",
    "effect": "Temizlik notu artar, masaları 2 kat hızlı siler",
    "flaw": "Masa pırıl pırıl olmadan oturtmaz, 1 sn",
    "line": "Önce silerim, sonra konuşuruz.",
    "fx": {
      "clean": 1
    },
    "roles": [
      "temizlik",
      "garson"
    ]
  }
};
export const TRAIT_IDS: string[] = Object.keys(TRAITS);
export const TEAMS: { id: string; name: string; colors: [string, string] }[] = [
  {
    "id": "lodosspor",
    "name": "Lodosspor",
    "colors": [
      "#2ec4c4",
      "#ff8a3d"
    ]
  },
  {
    "id": "vapurspor",
    "name": "Vapurspor",
    "colors": [
      "#a990dd",
      "#b8bec6"
    ]
  },
  {
    "id": "simitspor",
    "name": "Simitspor",
    "colors": [
      "#7a4a2a",
      "#e8d2a6"
    ]
  },
  {
    "id": "kedispor",
    "name": "Kedispor",
    "colors": [
      "#7fdcb4",
      "#f4a3c0"
    ]
  }
];
export const CONTACTS: string[] = [
  "Kuzen Tenteci",
  "Bacanak Balıkçı",
  "Mahalleden Hamal Ahmet",
  "Matbaacı Eniştesi",
  "Motorcu Kuzen"
];
