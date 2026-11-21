/**
 * Kendi esnafın (2026-10-24 açık dünya anketi: "herkes kendi esnafını yaratır").
 * 13:05 user: no woman/man pick on the first screen, a unique character editor, and real classes instead of a
 * "baskın yön". State: S.zones.esnafim (EsnafimSave below). The view (kulis creator, own hero, other players online)
 * turns it into rig options with esnafHeroOpts(); online sends the same record.
 * Commands: { kind: 'esnafim', op: 'set', data } (partial, live preview), 'open' (creator, pauses), 'done'.
 */
import type { Kernel } from './state';

export type Sinif = 'asci' | 'tuccar' | 'balikci' | 'tamirci' | 'kurye' | 'bahcivan' | 'sanatci' | 'sporcu';
/** Classes: everyone can do everything (survey 12), the class is what you are best at and how you start. */
export const SINIFLAR: { id: Sinif; ad: string; icon: string; desc: string; perk: string; kit: Partial<EsnafimSave> }[] = [
  { id: 'asci', ad: 'Aşçı', icon: '🍳', desc: 'Tezgahın ustası. Tarifleri erken açar, yemekler daha lezzetli.', perk: 'Satışlardan +%5', kit: { ustStil: 'shirt', ust: '#fbfbf8', onluk: '#e0533c', sapka: 'paper', sapkaRenk: '#fbfbf8' } },
  { id: 'tuccar', ad: 'Tüccar', icon: '💰', desc: 'Pazarlık kralı. Pazarda daha iyi fiyat, takasta şanslı.', perk: 'Pazar komisyonu yarı', kit: { ustStil: 'suit', ust: '#f6f1e6', aksan: '#2e3a59', kravat: '#c0392b', onluk: null, sapka: null } },
  { id: 'balikci', ad: 'Balıkçı', icon: '🎣', desc: 'Oltası şanslı. Denizden bol malzeme, nadir balıklar.', perk: 'Nadir balık şansı x2', kit: { ustStil: 'jacket', ust: '#f2c230', aksan: '#2f6f9a', sapka: 'bucket', sapkaRenk: '#f2c230', onluk: null } },
  { id: 'tamirci', ad: 'Tamirci', icon: '🔧', desc: 'Eşyalara artı basar, tezgahları onarır, makineleri çalıştırır.', perk: 'Artı basma şansı +%10', kit: { ustStil: 'overall', ust: '#2f6f9a', alt: '#2f6f9a', sapka: 'cap', sapkaRenk: '#e0533c', onluk: null } },
  { id: 'kurye', ad: 'Kurye', icon: '🛵', desc: 'Şehrin en hızlısı. Teslimatlardan bahşiş, binekler ucuz.', perk: 'Yürüme hızı +%10', kit: { ustStil: 'hoodie', ust: '#e0533c', aksan: '#ffd23f', sapka: 'cap', sapkaRenk: '#ffd23f', onluk: null } },
  { id: 'bahcivan', ad: 'Bahçıvan', icon: '🌿', desc: 'Koruda mantar, çay ve meyve toplar. Taze malzeme onun işi.', perk: 'Toplamadan +1 malzeme', kit: { ustStil: 'shirt', ust: '#8daa5b', desen: 3, sapka: 'bucket', sapkaRenk: '#c9a05a', onluk: '#7d5638' } },
  { id: 'sanatci', ad: 'Sokak Sanatçısı', icon: '🎸', desc: 'Metroda çalar, meydanda söyler. Etkinliklerde kalabalığı toplar.', perk: 'Etkinlik ödülü +%20', kit: { ustStil: 'cardigan', ust: '#7d3c98', aksan: '#ffd23f', sapka: 'beanie', sapkaRenk: '#3fb5b0', onluk: null } },
  { id: 'sporcu', ad: 'Sporcu', icon: '⚽', desc: 'Halı sahanın yıldızı. Turnuvalarda bir adım önde.', perk: 'Maçta dayanıklılık +%15', kit: { ustStil: 'jersey', ust: '#3fa35a', aksan: '#ffffff', altStil: 'shorts', alt: '#ffffff', sapka: null, onluk: null } },
];
export interface EsnafimSave {
  ad: string; dukkan: string; sinif: Sinif; done: boolean;
  tip: 'a' | 'b'; vucut: 'slim' | 'mid' | 'round'; boy: number; ten: number;
  goz: string; gozRenk: string; kas: string; allik: number; cil: boolean; gamze: boolean; ruj: string | null;
  sac: string; sacRenk: string; biyik: 'yok' | 'ince' | 'kalin' | 'burma'; sakal: boolean;
  /** 16:52 detailed face: eye spacing, mouth width, nose, ears, beard style (overrides sakal), brow colour */
  gozAra?: 'yakin' | 'orta' | 'uzak'; agiz?: 'dar' | 'orta' | 'genis'; burun?: 'kucuk' | 'orta' | 'iri' | 'uzun'; kulak?: 'kucuk' | 'orta' | 'kepce';
  sakalStil?: 'yok' | 'kirli' | 'keci' | 'tam' | 'kisa' | 'favori' | 'cember'; gozY?: 'asagi' | 'orta' | 'yukari';
  /** resting face (index into the chars X_CELLS expressions) */ ifade?: string;
  ustStil: string; ust: string; aksan: string | null; desen: number; altStil: string; alt: string; ayakkabi: string; onluk: string | null;
  sapka: string | null; sapkaRenk: string; gozluk: string | null; papyon: string | null; kravat: string | null; kupe: boolean;
  /** karar paketi C3: the character name is chosen once and never changes (set on the first 'done') */
  adKilit?: boolean;
  /** old field (v36): kept only to migrate */
  yon?: string; beden?: string; biyikOld?: string;
}
export const ESNAFIM_DEFAULT: EsnafimSave = {
  ad: 'Sabri', dukkan: "Sabri'nin Büfesi", sinif: 'asci', done: false,
  tip: 'a', vucut: 'mid', boy: 1, ten: 4,
  goz: 'round', gozRenk: '#3a2416', kas: 'mid', allik: 0.25, cil: false, gamze: false, ruj: null,
  sac: 'short', sacRenk: '#1f1813', biyik: 'ince', sakal: false,
  ustStil: 'tee', ust: '#fbf9f4', aksan: null, desen: 0, altStil: 'pants', alt: '#4f6f98', ayakkabi: '#7a5236', onluk: '#e0533c',
  sapka: null, sapkaRenk: '#e0533c', gozluk: null, papyon: null, kravat: null, kupe: false,
};

export function esnafimSave(S: { zones: Record<string, Record<string, unknown>> }): EsnafimSave {
  const z = (S.zones.esnafim ||= { ...ESNAFIM_DEFAULT }) as unknown as EsnafimSave;
  // v36 -> v37: beden/yon became tip/sinif
  if (z.beden && !(z as { tip?: string }).tip) z.tip = z.beden === 'kadin' ? 'b' : 'a';
  if (z.yon && !(z as { sinif?: string }).sinif) z.sinif = (z.yon === 'usta' ? 'tamirci' : z.yon) as Sinif;
  if (z.done && z.adKilit === undefined) z.adKilit = true;
  for (const k of Object.keys(ESNAFIM_DEFAULT) as (keyof EsnafimSave)[]) if (z[k] === undefined) (z as unknown as Record<string, unknown>)[k] = ESNAFIM_DEFAULT[k];
  return z;
}
const clean = (v: unknown, n: number, def: string) => { const s = String(v ?? '').replace(/[<>]/g, '').trim().slice(0, n); return s || def; };
const STR_KEYS = ['goz', 'gozRenk', 'kas', 'sac', 'sacRenk', 'ustStil', 'ust', 'altStil', 'alt', 'ayakkabi', 'sapkaRenk'] as const;
const NULLABLE = ['ruj', 'aksan', 'onluk', 'sapka', 'gozluk', 'papyon', 'kravat'] as const;

/** resting face choices -> chars X_CELLS index (neutral 0, smile 1, grin 2, grumpy 7, wink 9, thinking 10, bliss 11, sleepy 5) */
export const IFADE: Record<string, number> = { notr: 0, gulumser: 1, nese: 2, ciddi: 7, gozkirp: 9, dalgin: 10, huzurlu: 11, uykulu: 5 };
export function applyEsnafim(z: EsnafimSave, d: Record<string, unknown>): void {
  if (d.ad !== undefined && !z.adKilit) z.ad = clean(d.ad, 14, z.ad);
  if (d.dukkan !== undefined) z.dukkan = clean(d.dukkan, 22, z.dukkan);
  if (d.tip === 'a' || d.tip === 'b') z.tip = d.tip;
  if (d.vucut === 'slim' || d.vucut === 'mid' || d.vucut === 'round') z.vucut = d.vucut;
  if (typeof d.boy === 'number') z.boy = Math.max(0.9, Math.min(1.1, d.boy));
  if (typeof d.ten === 'number') z.ten = Math.max(0, Math.min(11, Math.round(d.ten)));
  if (typeof d.allik === 'number') z.allik = Math.max(0, Math.min(0.45, d.allik));
  if (typeof d.desen === 'number') z.desen = Math.max(0, Math.min(3, Math.round(d.desen)));
  for (const k of ['cil', 'gamze', 'sakal', 'kupe'] as const) if (typeof d[k] === 'boolean') z[k] = d[k] as boolean;
  for (const k of STR_KEYS) if (typeof d[k] === 'string') (z as unknown as Record<string, string>)[k] = String(d[k]).slice(0, 16);
  for (const k of NULLABLE) if (d[k] === null || typeof d[k] === 'string') (z as unknown as Record<string, unknown>)[k] = d[k] === null ? null : String(d[k]).slice(0, 16);
  if (d.biyik === 'yok' || d.biyik === 'ince' || d.biyik === 'kalin' || d.biyik === 'burma') z.biyik = d.biyik;
  const pick = <K extends keyof EsnafimSave>(k: K, ok: string[]) => { if (typeof d[k] === 'string' && ok.includes(d[k] as string)) (z as unknown as Record<string, unknown>)[k] = d[k]; };
  pick('gozAra', ['yakin', 'orta', 'uzak']); pick('agiz', ['dar', 'orta', 'genis']); pick('burun', ['kucuk', 'orta', 'iri', 'uzun']);
  pick('kulak', ['kucuk', 'orta', 'kepce']); pick('sakalStil', ['yok', 'kirli', 'keci', 'tam', 'kisa', 'favori', 'cember']); pick('ifade', Object.keys(IFADE)); pick('gozY', ['asagi', 'orta', 'yukari']);
  if (typeof d.sakalStil === 'string') z.sakal = d.sakalStil === 'tam';
  if (typeof d.sakal === 'boolean') z.sakalStil = d.sakal ? 'tam' : 'yok';
  if (typeof d.sinif === 'string' && SINIFLAR.some(s => s.id === d.sinif)) z.sinif = d.sinif as Sinif;
}

export function installEsnafim(K: Kernel) {
  const S = K.state;
  return {
    run(c: { op: string; data?: Record<string, unknown> }): boolean {
      const z = esnafimSave(S);
      if (c.op === 'set' && c.data) {
        applyEsnafim(z, c.data);
        S.hero = z.tip === 'b' ? 'sabriye' : 'sabri';
        if (K.rt.uiLast.esnafim) K.rt.uiLast.esnafim = { ...z };
        return true;
      }
      if (c.op === 'done') {
        const again = z.done; z.done = true; z.adKilit = true; delete K.rt.uiLast.esnafim;
        if (K.rt.pauseWhy === 'esnafim') { K.rt.paused = false; K.rt.pauseWhy = ''; }
        const sn = SINIFLAR.find(s => s.id === z.sinif);
        if (again) K.toast('Yeni görünüşün hazır, ' + z.ad + '!', 'good'); else K.toast('Hoş geldin ' + z.ad + (sn ? ', ' + sn.ad.toLocaleLowerCase('tr') : '') + '! ' + z.dukkan + ' açıldı.', 'good'); K.logEv('esnafim', { sinif: z.sinif }); K.saveNow();
        return true;
      }
      if (c.op === 'open') { K.rt.uiLast.esnafim = { ...z }; K.rt.paused = true; K.rt.pauseWhy = 'esnafim'; return true; }
      return false;
    },
  };
}

/** Chars rig options for an esnaf (own hero, the kulis preview and other players online share it). */
export function esnafHeroOpts(e: Partial<EsnafimSave>, worn: Record<string, unknown> = {}): Record<string, unknown> {
  const z = { ...ESNAFIM_DEFAULT, ...e };
  const b = z.tip === 'b';
  const name = String(z.ad || '').toLocaleUpperCase('tr').slice(0, 9);
  const look: Record<string, unknown> = {
    skin: z.ten, body: z.vucut, height: z.boy, girth: z.vucut === 'slim' ? 0.92 : z.vucut === 'round' ? 1.16 : 1.0,
    // short, bushy styles poke through a hat: under one they sit as a neat crop
    hair: z.sapka && z.sapka !== 'bandana' && /^(short|sport|curly|wavy|afro|loose)$/.test(z.sac) ? 'buzz' : z.sac, hairColor: z.sacRenk, temples: null, beard: z.sakalStil === 'keci' || z.sakalStil === 'cember' ? 'goatee' : z.sakalStil === 'kisa' ? 'short' : z.sakalStil === 'favori' ? 'sideburns' : z.sakalStil ? z.sakalStil === 'tam' : !!z.sakal,
    restCell: IFADE[z.ifade || ''] ?? undefined,
    mustache: z.sakalStil === 'cember' && z.biyik === 'yok' ? 'thin' : z.biyik === 'yok' ? false : z.biyik === 'kalin' ? 'thick' : z.biyik === 'burma' ? 'curl' : 'thin',
    faceSpec: { eye: z.goz, iris: z.gozRenk, brow: z.kas, blush: z.allik, freckles: z.cil ? 1 : 0, dimples: z.gamze ? 1 : 0, lips: z.ruj || undefined,
      mouthW: z.agiz === 'dar' ? 10 : z.agiz === 'genis' ? 19 : 15, ex: z.gozAra === 'yakin' ? 17 : z.gozAra === 'uzak' ? 25 : 21,
      ey: z.gozY === 'asagi' ? 61 : z.gozY === 'yukari' ? 53 : 57, stubble: z.sakalStil === 'kirli' ? 1 : 0, browCol: z.kas === 'none' ? undefined : z.sacRenk },
    nose: z.burun || 'orta', ears: z.kulak || 'orta',
    top: z.ust, topStyle: z.ustStil, accent: z.aksan || undefined, accent2: z.aksan || undefined, pattern: z.desen,
    bottom: z.alt, bottomStyle: z.altStil, shoes: z.ayakkabi, apron: z.onluk || null, apronText: z.onluk ? name : undefined,
    hat: z.sapka || null, hatColor: z.sapkaRenk, glasses: z.gozluk || null, bowtie: z.papyon || undefined, tie: z.kravat || undefined, earrings: !!z.kupe,
    vest: null, pen: null, sleeves: undefined,
    ...worn,
  };
  return b ? { kind: 'sabriye', typeId: 'sabriye', seed: 8, apron: name || 'SABRİYE', look } : { kind: 'sabri', typeId: 'sabri', seed: 7, apron: name || 'SABRİ', look };
}
