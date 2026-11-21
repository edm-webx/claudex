/**
 * Ferry kinds (survey vapur-1, vapur-3, vapur-8): which boat docks at Martıköy İskelesi, how many buyers walk off and
 * who they are, what the dock toast says, and the cheap look tweaks the view applies to the shared ferry mesh.
 * Weights x buyersX average to ~1.0 so the economy curve keeps its shape. Pure data (no three, no DOM).
 */
export type FerryKindId = 'sehir' | 'lodos' | 'araba' | 'tatli' | 'buharli';

export interface FerryLook {
  /** ferry object scale (x = beam, y = height, z = length) */
  scale: [number, number, number];
  /** colour band over the hull, null = keep the default navy hull */
  hull: string | null;
  /** funnel sleeve colour + optional ring colour, null = keep the default yellow funnel */
  funnel: string | null; ring?: string;
  /** taller funnel (steam ferry) */
  tall?: boolean;
  /** roof awning colour (tourist boat) */
  awning?: string;
  /** little cars on the deck ends (car ferry) */
  cars?: boolean;
  /** smoke puffs from the funnel */
  smoke?: boolean;
}

export interface FerryKindDef {
  id: FerryKindId;
  name: string;
  /** short name for the timetable board */
  board: string;
  weight: number;
  /** multiplier on the dock wave size */
  buyersX: number;
  /** citizen id -> chance (checked in order); the rest picks a normal passer-by type */
  mix: [string, number][];
  dock: string[];
  look: FerryLook;
}

export const FERRY_KINDS: Record<FerryKindId, FerryKindDef> = {
  sehir: {
    id: 'sehir', name: 'Martıköy Şehir Hattı', board: 'ŞEHİR HATTI', weight: 0.42, buyersX: 1.0,
    mix: [['vapuryolcusu', 0.6]],
    dock: ['Martıköy Şehir Hattı yanaştı! Simitler hazır mı abi?', 'Şehir Hattı geldi, iskele bir anda doldu!', 'Şehir Hattı yanaştı, millet çay kokusunu aldı bile.'],
    look: { scale: [1, 1, 1], hull: null, funnel: null },
  },
  lodos: {
    id: 'lodos', name: 'Lodos Kızı', board: 'LODOS KIZI', weight: 0.2, buyersX: 0.55,
    mix: [['vapuryolcusu', 0.45], ['gezgin', 0.25]],
    dock: ['Lodos Kızı yanaştı! Üç yolcu, bir sepet, bir de kaçak martı.', 'Lodos Kızı geldi, motoru hâlâ öksürüyor.', 'Ada motoru Lodos Kızı yanaştı, az ama öz yolcu!'],
    look: { scale: [0.85, 0.8, 0.5], hull: '#2a8c8c', funnel: '#fbfaf6', ring: '#e0533c' },
  },
  araba: {
    id: 'araba', name: 'Teneke Kaplumbağa', board: 'ARABALI VAPUR', weight: 0.16, buyersX: 1.25,
    mix: [['bebekarabali', 0.45], ['vapuryolcusu', 0.3]],
    dock: ['Arabalı vapur Teneke Kaplumbağa yanaştı! Aileler iniyor, çocuklar acıkmış.', 'Arabalı vapur geldi, korna sesinden çay dökülecekti!'],
    look: { scale: [1.08, 0.88, 1.06], hull: '#c8402f', funnel: '#2f6fdb', ring: '#fbfaf6', cars: true },
  },
  tatli: {
    id: 'tatli', name: 'Boğaz Tatlısı', board: 'BOĞAZ TATLISI', weight: 0.16, buyersX: 1.35,
    mix: [['gezgin', 0.3], ['turgrubu', 0.2], ['vlogcu', 0.15], ['balayi', 0.1]],
    dock: ['Boğaz Tatlısı yanaştı! Turistler fotoğrafını çekmeden yemiyor.', 'Tur teknesi Boğaz Tatlısı geldi, rehber bayrağını sallıyor!'],
    look: { scale: [0.9, 0.9, 0.75], hull: '#f29bb5', funnel: '#7fd6c2', ring: '#fbfaf6', awning: '#f29bb5' },
  },
  buharli: {
    id: 'buharli', name: 'Nostalji Buharlısı', board: 'NOSTALJİ BUHARLISI', weight: 0.06, buyersX: 1.15,
    mix: [['emekli', 0.3], ['balayi', 0.15], ['vapuryolcusu', 0.3]],
    dock: ['Nostalji Buharlısı yanaştı! Düdüğü duyan herkes on yaş gençleşti.', 'Vay, Nostalji Buharlısı! Dede bunu gençliğinden hatırlıyor.'],
    look: { scale: [1, 1.04, 1], hull: '#2f5d46', funnel: '#1d1d1d', ring: '#e0533c', tall: true, smoke: true },
  },
};
export const FERRY_KIND_IDS = Object.keys(FERRY_KINDS) as FerryKindId[];

/** The lit last ferry of the night (vapur-8). */
export const NIGHT_FERRY = {
  /** a ferry whose horn sounds at/after this hour is the lit last ferry */
  fromHour: 21.5,
  board: 'SON VAPUR',
  mix: [['gecekusu', 0.3], ['vapuryolcusu', 0.5]] as [string, number][],
  buyersX: 0.8,
  sleepyChance: 0.65,
  dock: ['Işıklı son vapur yanaştı! Yolcular esniyor, iskele mışıl mışıl.', 'Son vapur geldi, ampuller yanıyor, gözler kapanıyor.'],
  sleepy: ['Uykum var abi...', 'Hıı, bir çay... uyanırım belki.', 'Esnemeden sipariş veremiyorum.', 'Zzz... simit... zzz', 'Gözlerim kapanıyor, çabuk ol usta.', 'Yastık satıyor musun?'],
};
