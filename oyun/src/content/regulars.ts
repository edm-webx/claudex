/**
 * Regular customers (v2 D.REGULARS): Sabri hands their order over.
 * Ported 1:1 from v2 data.js (numbers and Turkish text kept). Owner: Builder C (M1). Pure data, no imports of sim code.
 */

import { YENI_MUDAVIMLER } from './musteri';

export interface RegularDef { id: string; name: string; fromDay: number; hour: [number, number]; needs?: string; look: Record<string, unknown>; order: Record<string, number>; likes: string[]; voice: number; hint: string; story: string[]; /** musteri.ts extras: fallback order when `order` is not sellable yet, its hint, arrival greetings, idle lines while waiting, toast on a served visit */ alt?: Record<string, number>; altHint?: string; selam?: string[]; idle?: string[]; gift?: string; }
export const REGULARS: RegularDef[] = [
  {
    "id": "necati",
    "name": "Necati Amca",
    "fromDay": 2,
    "hour": [
      8,
      12
    ],
    "look": {
      "skin": 3,
      "body": "round",
      "hair": "short",
      "hairColor": "#cfcfcf",
      "mustache": true,
      "top": "#7a6a5a",
      "bottom": "#4a4a4a",
      "hat": "flatcap",
      "glasses": true
    },
    "order": {
      "cay": 2,
      "simit": 1
    },
    "likes": [
      "tavla_masasi",
      "nostalji_gazetelik",
      "lale_semaver"
    ],
    "voice": 115,
    "hint": "İki tavşan kanı, yanında da susamlı bir halka evladım.",
    "story": [
      "Her sabah buradayım evladım. İki çay, bir simit. Aklında tut!",
      "Tavla bilir misin? Bilmezsin, belli. Neyse, her zamankinden!",
      "Bak, iskelenin 70'lerdeki fotoğrafı. Ben bilet keserdim burada.",
      "Torunumu getirdim, o da simit sever. Her zamankinden!",
      "Evde canım sıkılıyor evladım. Kasada bir işin olur mu bir gün?"
    ]
  },
  {
    "id": "nermin",
    "name": "Nermin Teyze",
    "fromDay": 3,
    "hour": [
      10,
      16
    ],
    "look": {
      "skin": 2,
      "body": "round",
      "hair": "bun",
      "hairColor": "#8a8a8a",
      "headscarf": "yazma",
      "top": "#b0607e",
      "bottom": "#5b4a6b"
    },
    "order": {
      "cay": 1,
      "simit": 1,
      "ayran": 1
    },
    "likes": [
      "saksi_sardunya",
      "kedi_evi",
      "lale_minder"
    ],
    "voice": 300,
    "hint": "Bir sıcak, bir soğuk, bir de halka. Unuttun mu oğlum?",
    "story": [
      "Oğlum sen çok zayıflamışsın! Bana bir çay, bir simit, bir de ayran. Aklında olsun.",
      "Teyzeleri getirdim, burası artık bizim mekan. Her zamankinden!",
      "Kolonya ister misiniz? Kuyruk mis gibi oldu. Her zamankinden!",
      "Pamuk'a mama getirdim, kızmazsın değil mi? Her zamankinden!",
      "Oğlum ben evde boş duramam, bir işin olursa söyle."
    ]
  },
  {
    "id": "remzi",
    "name": "Remzi Abi",
    "fromDay": 4,
    "hour": [
      9,
      18
    ],
    "needs": "simit",
    "look": {
      "skin": 5,
      "body": "mid",
      "hair": "short",
      "hairColor": "#2b1d14",
      "mustache": true,
      "top": "#ffffff",
      "bottom": "#3a3a3a",
      "apron": "#d8433a",
      "hat": "cap"
    },
    "order": {
      "cay": 1,
      "ayran": 1
    },
    "likes": [
      "denizci_can_simidi",
      "sokak_lambasi",
      "nostalji_radyo"
    ],
    "voice": 135,
    "hint": "Biri tavşan kanı, biri bembeyaz köpüklü. Hadi usta!",
    "story": [
      "Komşu simitçi Remzi! Bana bir çay, bir ayran. Simitler benden, bilmem anlatabildim mi?",
      "Senin simitlere bakıyorum da... fena değil. Her zamankinden!",
      "Arabanın tekerleği kırıldı, sağ ol yardım ettin. Her zamankinden!",
      "Ortak olalım mı diyorum ya? Şaka şaka. Her zamankinden!",
      "Arabamı büfeye bağlasam, ekibe katılsam ne dersin?"
    ]
  }
];

// Müşteri istekleri ve yeni müdavimler (musteri-3): Nevzat, Defne, Saniye, Efe, Necmi.
REGULARS.push(...YENI_MUDAVIMLER);
