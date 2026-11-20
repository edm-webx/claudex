/**
 * İç mekanlar (2026-11-09, owner: "her binaya girilebilmeli, özellikle kafe bistro lokanta; her birinde geliştirmeler, yeni
 * aletler, kafede kahve makinesi; her yerde bir şey olmalı; belirli bir seviyeden sonra satın alınıp işletilebilmeli").
 * Pure data shared by the colliders (content/zones/karsi.ts, view/world/bufe-buyume.ts buyumeEngel) and the view
 * (view/world/ic-mekan-look.ts): per building the footprint, the door side, and a furniture layout in a door frame where
 * the door is at v = +D/2 and u runs along the door wall. Walls get colliders with a door gap; `solid` furniture collides.
 * Items with `esya` show only when that equipment is bought (never solid, so the static walk grid stays valid).
 */
export type Yon = '+x' | '-x' | '+z' | '-z';
export type IcTur = 'kafe' | 'bistro' | 'kirtasiye' | 'okul' | 'lokanta' | 'kafeterya' | 'banka' | 'hastane' | 'acil' | 'morg' | 'kahvalti' | 'balik' | 'mutfak' | 'giyim' | 'elektronik' | 'oyuncak';
export interface IcMekan { id: string; ad: string; tur: IcTur; x: number; z: number; wx: number; wz: number; kapi: Yon; arsa?: string; bina?: string; salon?: 'W' | 'E'; mutfak?: boolean; h: number }
export interface IcItem { k: string; u: number; v: number; w: number; d: number; ry?: number; solid?: boolean; esya?: string; y?: number; txt?: string; c?: string }
export interface Rect { x0: number; x1: number; z0: number; z1: number }

export const IC_MEKANLAR: IcMekan[] = [
  { id: 'kafe1', ad: 'Meydan Kafe', tur: 'kafe', x: -17.5, z: 37.9, wx: 7, wz: 9.4, kapi: '+x', arsa: 'k1', bina: 'kafe1', h: 3.1 },
  { id: 'kafe2', ad: 'Sahil Bistro', tur: 'bistro', x: -17.5, z: 51.5, wx: 7, wz: 9.4, kapi: '+x', arsa: 'k2', bina: 'kafe2', h: 3.1 },
  { id: 'kirtasiye', ad: 'Martı Kırtasiye', tur: 'kirtasiye', x: 28, z: 35.2, wx: 7.1, wz: 3.6, kapi: '-z', arsa: 'k3', bina: 'kirtasiye', h: 3.0 },
  { id: 'okul', ad: 'Martıköy İlkokulu', tur: 'okul', x: 48.85, z: 37.25, wx: 18.3, wz: 7.5, kapi: '-z', arsa: 'k4', bina: 'okul', h: 3.2 },
  // 2026-11-20 owner: "AVM içindeki mağazalar ayrı, satın alınıp işletilebilen işletmeler olsun". The mall footprint
  // (x 11.7..28.6, z 46.5..57.1) is cut into strips side by side, each with its own door on the -z front: lokanta (k5, keeps
  // the room id 'avm') + Martı Moda (k7) + Tekno Martı (k8) + Oyuncak Dünyası (k9). The rooms touch but never overlap.
  { id: 'avm', ad: 'Martı Lokantası', tur: 'lokanta', x: 26.0, z: 51.8, wx: 5.2, wz: 10.6, kapi: '-z', arsa: 'k5', bina: 'avm', h: 3.6 },
  { id: 'avm_moda', ad: 'Martı Moda', tur: 'giyim', x: 21.45, z: 51.8, wx: 3.9, wz: 10.6, kapi: '-z', arsa: 'k7', bina: 'avm', h: 3.6 },
  { id: 'avm_tekno', ad: 'Tekno Martı', tur: 'elektronik', x: 17.55, z: 51.8, wx: 3.9, wz: 10.6, kapi: '-z', arsa: 'k8', bina: 'avm', h: 3.6 },
  { id: 'avm_oyuncak', ad: 'Oyuncak Dünyası', tur: 'oyuncak', x: 13.65, z: 51.8, wx: 3.9, wz: 10.6, kapi: '-z', arsa: 'k9', bina: 'avm', h: 3.6 },
  { id: 'tesis', ad: 'Halı Saha Tesisleri', tur: 'kafeterya', x: -54.1, z: 45.4, wx: 3.7, wz: 17.8, kapi: '+x', arsa: 'k6', bina: 'tesis', h: 2.8 },
  { id: 'banka', ad: 'Martı Kasası Bankası', tur: 'banka', x: 11.7, z: 36.8, wx: 10, wz: 8.4, kapi: '+z', bina: 'banka', h: 3.3 },
  { id: 'hastane', ad: 'Devlet Hastanesi', tur: 'hastane', x: 46.95, z: 53.55, wx: 16.9, wz: 6.7, kapi: '-z', bina: 'hastane', h: 3.0 },
  { id: 'acil', ad: 'Acil', tur: 'acil', x: 57.3, z: 52.0, wx: 3.3, wz: 3.2, kapi: '-x', bina: 'acil', h: 3.3 },
  { id: 'morg', ad: 'Morg', tur: 'morg', x: 57.3, z: 55.5, wx: 3.3, wz: 3.2, kapi: '-x', bina: 'morg', h: 3.1 },
  // büfe salonları on the pier (view/world/bufe-buyume.ts WB / EB), door on the promenade side
  { id: 'salonW', ad: 'Kahvaltı salonu', tur: 'kahvalti', x: -17.6, z: -13.9, wx: 10.8, wz: 6.6, kapi: '+z', salon: 'W', h: 3.4 },
  // Sabri'nin mutfağı: behind the covered walkway behind the kiosk, door on the walkway side (view/world/bufe-buyume.ts shell)
  { id: 'mutfak', ad: 'Sabri Mutfağı', tur: 'mutfak', x: 0, z: -15.2, wx: 18, wz: 4.4, kapi: '+z', mutfak: true, h: 3.4 },
  { id: 'salonE', ad: 'Balık lokantası', tur: 'balik', x: 15.6, z: -13.9, wx: 12, wz: 6.6, kapi: '+z', salon: 'E', h: 3.4 },
];
export const IC_BY_ID: Record<string, IcMekan> = Object.fromEntries(IC_MEKANLAR.map(m => [m.id, m]));
/** business rooms run by the live room sim (sim/agents/kafe.ts): real guests + real workers, no props */
export const IC_CANLI = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9'];
/** every room of one building (the AVM has four) */
export const icBina = (bina: string) => IC_MEKANLAR.filter(m => m.bina === bina);
export const icOfArsa = (arsa: string) => IC_MEKANLAR.find(m => m.arsa === arsa);

const YAW: Record<Yon, number> = { '+z': 0, '+x': Math.PI / 2, '-z': Math.PI, '-x': -Math.PI / 2 };
export const icYaw = (m: IcMekan) => YAW[m.kapi];
/** width along the door wall, depth into the room */
export const icDim = (m: IcMekan) => (m.kapi === '+x' || m.kapi === '-x' ? { W: m.wz, D: m.wx } : { W: m.wx, D: m.wz });
export function icWorld(m: IcMekan, u: number, v: number): { x: number; z: number } {
  const t = YAW[m.kapi], c = Math.round(Math.cos(t)), s = Math.round(Math.sin(t));
  return { x: m.x + u * c + v * s, z: m.z - u * s + v * c };
}
function rectW(m: IcMekan, u0: number, u1: number, v0: number, v1: number): Rect {
  const a = icWorld(m, u0, v0), b = icWorld(m, u1, v1);
  return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) };
}
export const IC_DUVAR = 0.25, IC_KAPI = 1.7;
/** is p inside the room (margin < 0 shrinks) */
export function icIcinde(m: IcMekan, p: { x: number; z: number }, margin = 0): boolean {
  return Math.abs(p.x - m.x) < m.wx / 2 + margin && Math.abs(p.z - m.z) < m.wz / 2 + margin;
}
export const icHangi = (p: { x: number; z: number }, margin = 0) => IC_MEKANLAR.find(m => icIcinde(m, p, margin)) || null;
/** door point just outside / inside */
export const icKapi = (m: IcMekan, off = 0.6) => icWorld(m, 0, icDim(m).D / 2 + off);

/* ---------- layouts (door frame) ---------- */
const it = (k: string, u: number, v: number, w: number, d: number, o: Partial<IcItem> = {}): IcItem => ({ k, u, v, w, d, ...o });
const masa = (u: number, v: number, k = 'masa2') => it(k, u, v, 0.8, 0.8, { solid: true });

function kafeLayout(W: number, D: number, bistro: boolean): IcItem[] {
  const bv = -D / 2 + 1.2, o: IcItem[] = [
    it('rafArka', -1.2, -D / 2 + 0.32, 5.6, 0.36), it('tezgah', -1.2, bv, 5.0, 0.75, { solid: true, c: bistro ? '#1d4f86' : '#7a3b1c' }), it('kasa', 0.9, bv, 0.4, 0.4, { y: 1.05 }),
    it('menuPano', -1.2, -D / 2 + 0.27, 3.0, 0.05, { y: 2.3, txt: bistro ? 'SAHİL BİSTRO' : 'MEYDAN KAFE' }),
    masa(-3.3, 0.2, bistro ? 'masa4' : 'masa2'), masa(-3.3, 2.1), masa(-1.8, 1.2), masa(1.9, 0.5, bistro ? 'masa4' : 'masa2'), masa(1.9, 2.3),
    it('saksiB', W / 2 - 0.45, D / 2 - 0.45, 0.6, 0.6), it('lamba', 0, 0, W, D),
  ];
  if (!bistro) o.push(
    it('espresso', -2.7, bv, 0.6, 0.5, { esya: 'espresso', y: 1.05 }), it('barista', -0.4, bv, 0.9, 0.5, { esya: 'barista', y: 1.05 }),
    it('vitrin', 2.0, bv, 1.4, 0.8, { esya: 'vitrin' }), it('koltuk', W / 2 - 1.2, D / 2 - 1.3, 1.8, 1.6, { esya: 'koltuk' }),
    it('muzik', W / 2 - 0.55, -D / 2 + 0.55, 0.8, 0.6, { esya: 'muzik' }), it('kitaplik', -W / 2 + 0.3, 0.4, 3.2, 0.4, { esya: 'kitaplik', ry: 1 }),
    it('saksi', -W / 2 + 0.5, D / 2 - 0.5, 0.5, 0.5, { esya: 'saksi' }), it('saksi', W / 2 - 0.5, -0.6, 0.5, 0.5, { esya: 'saksi' }), it('isikTavan', 0, 0, W - 0.6, D - 0.6, { esya: 'isik' }));
  else o.push(
    it('espresso', -2.7, bv, 0.6, 0.5, { esya: 'kahve_bar', y: 1.05 }), it('waffle', -0.5, bv, 0.6, 0.45, { esya: 'waffle_mak', y: 1.05 }), it('bicak', 0.3, bv, 0.5, 0.3, { esya: 'sef_seti', y: 1.05 }),
    it('buzVitrin', 2.1, bv, 1.6, 0.85, { esya: 'buz_vitrin' }), it('akvaryum', -W / 2 + 0.32, 0.6, 3.2, 0.45, { esya: 'akvaryum', ry: 1 }),
    it('mangal', W / 2 - 0.65, -D / 2 + 0.6, 1.0, 0.8, { esya: 'mangal' }), it('piyano', W / 2 - 1.1, D / 2 - 1.1, 1.5, 1.2, { esya: 'piyano' }), it('isikTavan', 0, 0, W - 0.6, D - 0.6, { esya: 'isik' }));
  return o;
}
function kirtasiyeLayout(W: number, D: number): IcItem[] {
  return [
    it('rafArka', -0.9, -D / 2 + 0.45, W - 2.8, 0.5, { solid: true, c: 'kirtasiye' }), it('tezgah', W / 2 - 1.1, 0.0, 1.8, 0.7, { solid: true, ry: 1, c: '#2b6fb8' }), it('kasa', W / 2 - 1.1, 0.5, 0.4, 0.4, { y: 1.05 }),
    it('stand', -1.6, 0.5, 1.3, 0.55, { solid: true }), it('lamba', 0, 0, W, D),
    it('fotokopi', W / 2 - 0.6, -D / 2 + 0.6, 0.9, 0.7, { esya: 'fotokopi' }), it('pos', W / 2 - 1.1, -0.4, 0.3, 0.3, { esya: 'pos', y: 1.05 }),
    it('laminasyon', W / 2 - 1.1, 0.15, 0.5, 0.4, { esya: 'laminasyon', y: 1.05 }), it('kitaplik', -W / 2 + 0.3, 0.1, 2.6, 0.4, { esya: 'kitap_raf', ry: 1 }),
    it('kalemVitrin', 1.2, -D / 2 + 0.55, 1.2, 0.6, { esya: 'vitrin_k' }), it('oyuncak', -W / 2 + 1.3, D / 2 - 0.6, 1.2, 0.7, { esya: 'oyuncak' }),
    it('yazici3d', -2.9 + 0.2, -D / 2 + 0.45, 0.6, 0.5, { esya: 'yazici3d', y: 1.25 }), it('okuma', 0.2, 0.7, 1.2, 1.0, { esya: 'okuma' }),
  ];
}
function okulLayout(W: number, D: number): IcItem[] {
  const o: IcItem[] = [it('tahta', -4.6, -D / 2 + 0.16, 4.2, 0.1, { y: 1.6 }), it('ogretmen', -4.6, -D / 2 + 1.3, 1.4, 0.7, { solid: true }), it('lamba', 0, 0, W, D),
    it('dolap', -4.8, D / 2 - 0.35, 3.4, 0.45, { solid: true, ry: 2 }), it('pano', -8.9, 0, 2.4, 0.06, { ry: 1, y: 1.6 }), it('bolme', 0.2, -1.2, 0.18, D - 2.4 - 0.5, { solid: true })];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) o.push(it('sira', -7.6 + c * 1.55, -1.3 + r * 1.4, 1.1, 0.55, { solid: true }));
  // the school canteen (business k4) in the east half
  const bv = -D / 2 + 1.15;
  o.push(it('tezgah', 5.2, bv, 4.6, 0.7, { solid: true, c: '#e0533c' }), it('rafArka', 5.2, -D / 2 + 0.32, 4.8, 0.36), it('kasa', 6.9, bv, 0.4, 0.4, { y: 1.05 }),
    it('menuPano', 5.2, -D / 2 + 0.27, 2.6, 0.05, { y: 2.2, txt: 'KANTİN' }),
    it('tostMak', 4.0, bv, 0.5, 0.4, { esya: 'tost_mak', y: 1.05 }), it('buzdolap', 8.5, -D / 2 + 0.5, 0.9, 0.7, { esya: 'buzdolap' }),
    it('semaver', 5.4, bv, 0.4, 0.4, { esya: 'semaver_k', y: 1.05 }), it('firinK', 2.4, -D / 2 + 0.5, 0.9, 0.7, { esya: 'mikrodalga' }),
    it('meyve', 8.4, 0.6, 0.9, 0.7, { esya: 'meyve' }), it('masaK', 3.6, 1.4, 1.6, 0.8, { esya: 'masa_k' }), it('masaK', 6.4, 1.4, 1.6, 0.8, { esya: 'masa_k' }),
    it('ekran', 5.2, -D / 2 + 0.2, 1.4, 0.08, { esya: 'ekran_k', y: 2.0 }), it('izgara', 7.3, -D / 2 + 0.55, 0.9, 0.6, { esya: 'izgara_k' }));
  return o;
}
/** AVM lokanta strip (W 5.2): counter at the back, staff behind it, cooking line on the back wall, tables in a column on the
 *  east side so the queue lanes on the west side stay clear */
function avmLayout(W: number, D: number): IcItem[] {
  const bv = -D / 2 + 1.6, bw = -D / 2 + 0.5;
  return [
    it('lamba', 0, 0, W, D), it('zemin', 0, 0, W, D, { c: 'avm' }),
    it('tezgah', -0.5, bv, 3.6, 0.8, { solid: true, c: '#a2472f' }), it('kasa', 1.0, bv, 0.4, 0.4, { y: 1.05 }), it('menuPano', -0.5, -D / 2 + 0.27, 3.4, 0.05, { y: 2.75, txt: 'MARTI LOKANTASI' }),
    masa(-1.6, -0.9, 'masa4'), masa(-1.6, 1.1, 'masa4'), masa(-1.6, 3.1, 'masa4'), it('saksiB', W / 2 - 0.55, D / 2 - 0.55, 0.5, 0.5, { solid: true }),
    it('benmari', -1.6, bv, 1.4, 0.6, { esya: 'benmari', y: 1.05 }), it('corba', -0.45, bv, 0.5, 0.5, { esya: 'corba_kazan', y: 1.05 }), it('semaver', 0.3, bv, 0.4, 0.4, { esya: 'cay_ocak', y: 1.05 }),
    // back wall cooking line; the staff lane (v ~ bv - 0.7) stays free in front of it
    it('tasFirin', -1.75, bw, 1.0, 0.5, { esya: 'pide_firin' }), it('mangal', -0.7, bw, 0.9, 0.5, { esya: 'ocakbasi' }), it('doner', 0.1, bw, 0.5, 0.5, { esya: 'doner' }),
    it('ustaOcak', 0.9, bw, 0.8, 0.5, { esya: 'sef_ocak' }), it('tatliVitrin', W / 2 - 0.75, bw, 0.8, 0.5, { esya: 'tatli_vitrin' }),
    it('ekran', -0.5, -D / 2 + 0.2, 1.6, 0.08, { esya: 'led_menu', y: 1.85 }),
  ];
}
/** AVM shop strip (W 3.9, D 10.6), door at v = +D/2. The till counter stands along the depth (ry 3: front to the customers on
 *  the -u side, like the stationery shop), the stock shelf behind it on the +u wall, goods racks on the -u wall, a display
 *  table near the door. The middle lane (u ~ -0.6..0.2) stays empty: guests walk door -> racks -> till in straight lines.
 *  Equipment (`esya`) never collides. */
export const MAGAZA_RENK: Record<'giyim' | 'elektronik' | 'oyuncak', { c: string; txt: string }> = {
  giyim: { c: '#c94f6d', txt: 'MARTI MODA' }, elektronik: { c: '#2b6fb8', txt: 'TEKNO MARTI' }, oyuncak: { c: '#e8892b', txt: 'OYUNCAK DÜNYASI' },
};
function magazaLayout(W: number, D: number, tur: 'giyim' | 'elektronik' | 'oyuncak'): IcItem[] {
  const R = MAGAZA_RENK[tur], tv = -2.6, tu = 0.5, wl = -W / 2 + 0.5, wr = W / 2 - 0.4, fv = D / 2 - 0.55;
  const o: IcItem[] = [
    it('lamba', 0, 0, W, D), it('zemin', 0, 0, W, D, { c: 'avm' }),
    it('tezgah', tu, tv, 3.0, 0.6, { solid: true, ry: 3, c: R.c }), it('kasa', tu, tv + 1.15, 0.4, 0.4, { y: 1.05, ry: 3 }),
    it('depoRaf', wr + 0.05, tv, 3.0, 0.3, { ry: 3, c: tur }), it('paketMasa', tu, tv + 0.45, 0.5, 0.4, { y: 1.05, ry: 3, c: tur }),
    it('menuPano', 0, -D / 2 + 0.27, 2.8, 0.05, { y: 2.55, txt: R.txt }),
    it('reyon', wl + 0.05, -2.15, 3.5, 0.4, { solid: true, ry: 1, c: tur }), it('reyon', wl + 0.05, 2.0, 3.2, 0.4, { solid: true, ry: 1, c: tur }),
    it('teshir', 0.9, 2.2, 0.9, 1.3, { solid: true, c: tur }),
  ];
  if (tur === 'giyim') o.push(
    it('askilik', 0.95, 0.55, 0.9, 0.9, { esya: 'askilik' }), it('manken', wl + 0.15, fv, 0.5, 0.5, { esya: 'manken' }), it('manken', wr - 0.05, fv, 0.5, 0.5, { esya: 'manken', c: 'b' }),
    it('prova', wl + 0.3, -D / 2 + 0.75, 1.0, 1.0, { esya: 'prova' }), it('ayna', -W / 2 + 0.3, 0.0, 0.7, 0.06, { esya: 'ayna', ry: 1 }),
    it('ayakkabi', wr + 0.1, 0.55, 1.1, 0.3, { esya: 'ayakkabi', ry: 3 }), it('aksesuar', 0.9, 3.65, 0.55, 0.55, { esya: 'aksesuar' }),
    it('ledPano', 0.45, -D / 2 + 0.2, 1.5, 0.05, { esya: 'led_vitrin', y: 1.5, c: R.c }), it('dikis', tu, tv - 0.95, 0.55, 0.45, { esya: 'tasarim', y: 1.05, ry: 3 }));
  else if (tur === 'elektronik') o.push(
    it('testMasa', tu, tv - 0.9, 0.6, 0.45, { y: 1.05, ry: 3 }),
    it('demoMasa', 0.95, 0.55, 0.8, 0.9, { esya: 'demo_masa' }), it('tamir', tu, tv - 0.3, 0.5, 0.4, { esya: 'tamir', y: 1.05, ry: 3 }),
    it('tvDuvar', W / 2 - 0.27, 2.2, 2.4, 0.06, { esya: 'tv_duvar', y: 1.75, ry: 3 }), it('kulaklikStand', wl + 0.15, fv, 0.5, 0.5, { esya: 'kulaklik_stand' }),
    it('konsol', wl + 0.3, -D / 2 + 0.75, 1.0, 1.0, { esya: 'konsol' }), it('vr', wr - 0.05, fv, 0.6, 0.6, { esya: 'vr' }),
    it('drone', -0.2, 1.0, 0.6, 0.6, { esya: 'drone', y: 2.35 }), it('ledPano', 0.45, -D / 2 + 0.2, 1.5, 0.05, { esya: 'led_e', y: 1.5, c: R.c }));
  else o.push(
    it('testMasa', tu, tv - 0.9, 0.6, 0.45, { y: 1.05, ry: 3 }),
    it('pelusSepet', 0.95, 0.55, 0.8, 0.8, { esya: 'pelus_sepet' }), it('balon', wl + 0.15, fv, 0.5, 0.5, { esya: 'balon' }),
    it('trenPist', 0.9, 2.2, 0.8, 1.2, { esya: 'tren_pist', y: 0.8 }), it('legoDuvar', wr + 0.1, 0.55, 1.1, 0.3, { esya: 'lego_duvar', ry: 3 }),
    it('oyunKale', wl + 0.3, -D / 2 + 0.75, 1.0, 1.0, { esya: 'oyun_kale' }), it('maskot', wr - 0.05, fv, 0.6, 0.6, { esya: 'maskot' }),
    it('hediye', tu, tv - 0.3, 0.5, 0.4, { esya: 'hediye_paket', y: 1.05, ry: 3 }), it('ledPano', 0.45, -D / 2 + 0.2, 1.5, 0.05, { esya: 'led_o', y: 1.5, c: R.c }));
  return o;
}
function kafeteryaLayout(W: number, D: number): IcItem[] {
  const bv = -D / 2 + 0.85;
  return [
    it('lamba', 0, 0, W, D), it('tezgah', -4.8, bv, 4.6, 0.6, { solid: true, c: '#2f9e5a' }), it('kasa', -2.9, bv, 0.4, 0.4, { y: 1.05 }), it('menuPano', -4.8, -D / 2 + 0.27, 2.8, 0.05, { y: 2.0, txt: 'KAFETERYA' }),
    masa(-6.4, 1.0), masa(-3.6, 1.0), it('dolap', 5.6, -D / 2 + 0.3, 5.0, 0.45, { solid: true }), it('bank', 5.6, 0.2, 3.6, 0.4, { solid: true }),
    it('pano', 2.2, -D / 2 + 0.17, 1.6, 0.06, { y: 1.5, txt: 'SOYUNMA' }), it('dus', 8.2, 0.9, 1.0, 1.2),
    it('semaver', -5.8, bv, 0.4, 0.4, { esya: 'cay_mak', y: 1.05 }), it('buzdolap', -7.9, -D / 2 + 0.45, 0.9, 0.7, { esya: 'icecek_dolap' }),
    it('ekran', -0.8, -D / 2 + 0.2, 1.8, 0.08, { esya: 'mac_tv', y: 1.7 }), it('langirt', -0.8, 0.7, 1.3, 0.75, { esya: 'langirt' }),
    it('kupa', 1.0, -D / 2 + 0.35, 1.2, 0.45, { esya: 'kupa' }), it('izgara', -6.9, -D / 2 + 0.45, 0.9, 0.55, { esya: 'izgara_t' }),
    it('formaDuvar', 3.2, -D / 2 + 0.16, 2.0, 0.06, { esya: 'forma_duvar', y: 1.6 }), it('vip', -8.2, 1.0, 0.9, 1.4, { esya: 'vip' }),
  ];
}
function bankaLayout(W: number, D: number): IcItem[] {
  const gv = -D / 2 + 1.7;
  return [
    it('lamba', 0, 0, W, D), it('zemin', 0, 0, W, D, { c: 'mermer' }), it('gise', 0, gv, 7.2, 0.8, { solid: true }), it('kasaKapi', W / 2 - 1.4, -D / 2 + 0.18, 1.6, 0.2),
    it('atm', W / 2 - 0.5, D / 2 - 1.4, 0.7, 0.6, { solid: true, ry: 3 }), it('sira', -3.3, 1.1, 2.4, 0.5, { solid: true }), it('sira', -3.3, 2.5, 2.4, 0.5, { solid: true }),
    it('kuyruk', 0.6, 0.6, 2.4, 1.6), it('saksiB', -W / 2 + 0.5, D / 2 - 0.5, 0.6, 0.6, { solid: true }), it('saksiB', -W / 2 + 0.5, -D / 2 + 0.5, 0.6, 0.6, { solid: true }),
    it('menuPano', -2.4, -D / 2 + 0.17, 3.0, 0.05, { y: 2.5, txt: 'MARTI KASASI' }),
  ];
}
function hastaneLayout(W: number, D: number): IcItem[] {
  const o: IcItem[] = [it('lamba', 0, 0, W, D), it('zemin', 0, 0, W, D, { c: 'hastane' }), it('resepsiyon', 0, -0.9, 3.4, 0.8, { solid: true }),
    it('sira', -3.6, 1.9, 3.0, 0.5, { solid: true }), it('sira', 3.6, 1.9, 3.0, 0.5, { solid: true }), it('ilac', 0, -D / 2 + 0.3, 1.6, 0.45, { solid: true }),
    it('menuPano', 0, -D / 2 + 0.17, 3.2, 0.05, { y: 2.4, txt: 'POLİKLİNİK' })];
  for (const u of [-7.2, -5.4, -3.6, 3.6, 5.4, 7.2]) o.push(it('yatak', u, -D / 2 + 1.25, 1.0, 2.0, { solid: true }), it('perde', u + 0.9, -D / 2 + 1.25, 0.06, 2.0));
  return o;
}
function kahvaltiLayout(W: number, D: number): IcItem[] {
  return [
    it('lamba', 0, 0, W, D), it('acikBufe', -1.2, -D / 2 + 1.0, 5.2, 0.8, { solid: true }), it('menuPano', -1.2, -D / 2 + 0.27, 3.2, 0.05, { y: 2.5, txt: 'SERPME KAHVALTI' }),
    masa(-4.0, 0.2, 'masa4'), masa(-4.0, 2.1, 'masa4'), masa(-2.1, 1.2, 'masa4'), masa(2.2, 1.2, 'masa4'), masa(4.1, 0.2, 'masa4'), masa(4.1, 2.1, 'masa4'),
    it('semaverDev', -W / 2 + 0.6, -D / 2 + 0.6, 0.8, 0.8, { esya: 'semaver_dev' }), it('tasFirin', 3.9, -D / 2 + 0.75, 2.0, 1.1, { esya: 'tas_firin' }),
    it('gozleme', 2.0, -D / 2 + 0.75, 1.4, 0.9, { esya: 'gozleme' }), it('balKaymak', -W / 2 + 0.45, -1.25, 1.4, 0.6, { esya: 'bal_kaymak', ry: 1 }),
    it('sarkuteri', W / 2 - 0.45, -1.25, 1.6, 0.7, { esya: 'sarkuteri', ry: 3 }),
  ];
}
function balikLayout(W: number, D: number): IcItem[] {
  return [
    it('lamba', 0, 0, W, D), it('bar', -2.4, -D / 2 + 1.0, 5.0, 0.8, { solid: true }), it('menuPano', -2.4, -D / 2 + 0.27, 3.2, 0.05, { y: 2.5, txt: 'GÜNÜN BALIĞI' }),
    masa(-4.2, 0.4, 'masa4'), masa(-4.2, 2.3, 'masa4'), masa(-2.2, 1.4, 'masa4'), masa(2.2, 1.0, 'masa4'), masa(2.6, -0.9, 'masa4'), masa(4.5, 0.4, 'masa4'),
    it('buzTezgah', 1.6, -D / 2 + 0.8, 2.4, 0.9, { esya: 'buz_tezgah' }), it('mangal', 4.6, -D / 2 + 0.65, 1.4, 0.8, { esya: 'mangal_e' }),
    it('akvaryum', -W / 2 + 0.32, 0.4, 3.6, 0.45, { esya: 'akvaryum_e', ry: 1 }), it('mezeDolap', W / 2 - 0.4, 1.6, 1.8, 0.6, { esya: 'meze_dolap', ry: 3 }),
    it('piyano', 4.3, 2.4, 1.6, 1.2, { esya: 'piyano_s' }),
  ];
}
function acilLayout(W: number, D: number): IcItem[] {
  return [it('lamba', 0, 0, W, D), it('zemin', 0, 0, W, D, { c: 'hastane' }), it('sedye', -0.3, -0.55, 0.8, 1.9, { solid: true }), it('monitor', W / 2 - 0.45, -D / 2 + 0.45, 0.5, 0.5),
    it('ilac', -W / 2 + 0.3, 0.6, 1.2, 0.4, { solid: true, ry: 1 })];
}
function morgLayout(W: number, D: number): IcItem[] {
  return [it('lamba', 0, 0, W, D, { c: 'titrek' }), it('zemin', 0, 0, W, D, { c: 'morg' }), it('cekmece', 0, -D / 2 + 0.4, W - 0.7, 0.55, { solid: true }), it('otopsi', 0.85, 0.15, 0.7, 1.7, { solid: true })];
}

/**
 * Mutfak istasyonlarının yeri (BUF-05, kapı çerçevesi: u kapı duvarı boyunca, v odanın içine): tek doğruluk kaynağı. mutfakLayout,
 * sim'deki aşçı durakları (mutfakStand) ve rota (mutfakRota) buradan okur. sira: arka duvar hattı, ön hat ya da ortada (şef pasosu).
 */
export const MUTFAK_YER: Record<string, { u: number; w: number; sira: 'arka' | 'on' | 'orta'; k: string }> = {
  soguk_oda: { u: -8.1, w: 1.4, sira: 'arka', k: 'sogukOda' }, ocak: { u: -6.3, w: 1.6, sira: 'arka', k: 'ocakK' }, ocak2: { u: -4.5, w: 1.6, sira: 'arka', k: 'ocakK' },
  izgara: { u: -2.7, w: 1.6, sira: 'arka', k: 'izgaraK' }, izgara2: { u: -0.9, w: 1.6, sira: 'arka', k: 'izgaraK' }, fritoz: { u: 0.8, w: 1.2, sira: 'arka', k: 'fritoz' },
  tas_firin: { u: 2.7, w: 1.8, sira: 'arka', k: 'tasFirin' }, doner: { u: 4.5, w: 1.1, sira: 'arka', k: 'doner' }, tatli: { u: 5.9, w: 1.2, sira: 'arka', k: 'tatliVitrin' },
  pass: { u: 7.8, w: 2.0, sira: 'arka', k: 'pass' },
  bulasik: { u: -7.2, w: 2.0, sira: 'on', k: 'bulasik' }, salata: { u: -4.6, w: 1.6, sira: 'on', k: 'salata' }, meze: { u: -2.6, w: 1.4, sira: 'on', k: 'mezeDolap' },
  cay_bar: { u: 6.5, w: 1.6, sira: 'on', k: 'cayBar' }, sef_masa: { u: 0, w: 2.8, sira: 'orta', k: 'sefMasa' },
};
/** mutfak koridorları ve duraklar (u, v): arka koridor v=-D/2+1.5, ön koridor v=D/2-1.3; geçitler hazırlık tezgâhlarının arasından */
export const MUTFAK_NOKTA = {
  passAsci: [6.9, -0.7] as [number, number], passGarson: [8.1, -0.7] as [number, number],
  gecit: [-6.0, 2.05, 6.0], sefDurak: [[8.0, 0.4], [6.7, 0.4]] as [number, number][], komiDurak: [[3.6, -0.7], [1.9, -0.7]] as [number, number][],
};
const mutfakD = () => icDim(IC_BY_ID.mutfak).D;
export const mutfakKoridor = () => { const D = mutfakD(); return { arka: -D / 2 + 1.5, on: D / 2 - 1.3 }; };
/** istasyonun önünde aşçının durduğu nokta (u, v); şef pasosu arka koridordan */
export function mutfakStand(id: string): [number, number] {
  const y = MUTFAK_YER[id], k = mutfakKoridor(); if (!y) return [0, k.arka];
  return [y.u, y.sira === 'on' ? k.on : k.arka];
}
/** istasyonun üstü (tabak görünümü), oda çerçevesinde (u, v) */
export function mutfakUst(id: string): [number, number] {
  const y = MUTFAK_YER[id], D = mutfakD(); if (!y) return [0, 0];
  return [y.u, y.sira === 'on' ? D / 2 - 0.55 : y.sira === 'orta' ? 0.1 : -D / 2 + 0.55];
}
export const mutfakDunya = (uv: [number, number]) => icWorld(IC_BY_ID.mutfak, uv[0], uv[1]);
/**
 * Mutfak içi yürüyüş rotası (u, v noktaları): koridora çık, koridor boyunca git, gerekirse en kısa geçitten öbür koridora geç,
 * hedefe in. Hazırlık tezgâhlarının (solid) içinden geçmez; kapı (v > ön koridor) ve şef durakları gibi ara noktalar dikine bağlanır.
 */
export function mutfakRota(from: [number, number], to: [number, number]): [number, number][] {
  const k = mutfakKoridor(), near = (v: number, a: number) => Math.abs(v - a) < 0.3;
  const aisleOf = (p: [number, number]) => (near(p[1], k.arka) ? k.arka : near(p[1], k.on) ? k.on : p[1] < (k.arka + k.on) / 2 - 0.4 ? k.arka : k.on);
  const a0 = aisleOf(from), a1 = aisleOf(to), out: [number, number][] = [];
  if (Math.abs(from[1] - a0) > 0.05) out.push([from[0], a0]);
  if (a0 !== a1) {
    let g = MUTFAK_NOKTA.gecit[0], best = 1e9;
    for (const x of MUTFAK_NOKTA.gecit) { const c = Math.abs(from[0] - x) + Math.abs(x - to[0]); if (c < best) { best = c; g = x; } }
    out.push([g, a0], [g, a1]);
  }
  out.push([to[0], a1]);
  if (Math.abs(to[1] - a1) > 0.05) out.push([to[0], to[1]]);
  return out;
}
const cache = new Map<string, IcItem[]>();
/** Kitchen (door frame): cooking line on the back wall, prep line in front, pass at the right end; every station is `esya` = its id */
function mutfakLayout(W: number, D: number): IcItem[] {
  const bv = -D / 2 + 0.55, fv = D / 2 - 0.55;
  const st = (id: string) => { const y = MUTFAK_YER[id]; return it(y.k, y.u, y.sira === 'arka' ? bv : y.sira === 'on' ? fv : 0.1, y.w, 0.9, { esya: id }); };
  void W;
  return [
    ...Object.keys(MUTFAK_YER).map(st),
    it('davlumbaz', -4.0, bv, 9.0, 1.0, { esya: 'ocak' }), it('asiliTava', -1.0, -D / 2 + 0.3, 16, 0.2), it('kds', 7.8, -D / 2 + 0.3, 1.9, 0.1),   // duvar yüzü -D/2+0.25: duvara asılı öğeler onun önünde (2026-11-20 BUF-07: eskiden duvarın içinde, görünmüyordu)
    it('mutfakMenu', 3.5, -D / 2 + 0.28, 3.3, 0.1),   // BUF-07: duvar menü panosu (aşamaya göre) + şef notu
    it('islakTabela', -1.6, 0.95, 0.4, 0.4),   // BUF-07: ıslak zemin tabelasının yeri (yalnız yerleşim, görünürlük kir eşiğiyle ic-mekan-look'ta)
    it('hazirlik', -3.4, 0.1, 2.4, 0.7, { solid: true }), it('hazirlik', 3.9, 0.1, 2.4, 0.7, { solid: true }),
  ];
}

export function icLayout(m: IcMekan): IcItem[] {
  let o = cache.get(m.id); if (o) return o;
  const { W, D } = icDim(m);
  o = m.tur === 'kafe' ? kafeLayout(W, D, false) : m.tur === 'bistro' ? kafeLayout(W, D, true) : m.tur === 'kirtasiye' ? kirtasiyeLayout(W, D) : m.tur === 'okul' ? okulLayout(W, D)
    : m.tur === 'lokanta' ? avmLayout(W, D) : m.tur === 'kafeterya' ? kafeteryaLayout(W, D) : m.tur === 'banka' ? bankaLayout(W, D) : m.tur === 'hastane' ? hastaneLayout(W, D)
    : m.tur === 'giyim' || m.tur === 'elektronik' || m.tur === 'oyuncak' ? magazaLayout(W, D, m.tur)
    : m.tur === 'mutfak' ? mutfakLayout(W, D) : m.tur === 'kahvalti' ? kahvaltiLayout(W, D) : m.tur === 'balik' ? balikLayout(W, D) : m.tur === 'acil' ? acilLayout(W, D) : morgLayout(W, D);
  cache.set(m.id, o); return o;
}

/** World-space colliders: walls with the door gap plus solid furniture. */
export function icColliders(m: IcMekan): Rect[] {
  const { W, D } = icDim(m), t = IC_DUVAR, g = IC_KAPI / 2, o: Rect[] = [];
  o.push(rectW(m, -W / 2, W / 2, -D / 2, -D / 2 + t), rectW(m, -W / 2, -W / 2 + t, -D / 2, D / 2), rectW(m, W / 2 - t, W / 2, -D / 2, D / 2));
  o.push(rectW(m, -W / 2, -g, D / 2 - t, D / 2), rectW(m, g, W / 2, D / 2 - t, D / 2));
  for (const i of icLayout(m)) if (i.solid) { const sw = (i.ry || 0) % 2 ? i.d : i.w, sd = (i.ry || 0) % 2 ? i.w : i.d; o.push(rectW(m, i.u - sw / 2, i.u + sw / 2, i.v - sd / 2, i.v + sd / 2)); }
  return o;
}
/** Same, relative to the building centre (prefab-local colliders for an unrotated placement). */
export const icCollidersLocal = (m: IcMekan, cx = m.x, cz = m.z): Rect[] => icColliders(m).map(r => ({ x0: r.x0 - cx, x1: r.x1 - cx, z0: r.z0 - cz, z1: r.z1 - cz }));
/** every room of a building, relative to the building centre (the AVM shell holds four rooms) */
export const icBinaCollidersLocal = (bina: string, cx: number, cz: number): Rect[] => icBina(bina).flatMap(m => icCollidersLocal(m, cx, cz));
/** bank teller window: bank ops work here too */
export function bankaGise(): { x: number; z: number } { const m = IC_BY_ID.banka; return icWorld(m, 0, -icDim(m).D / 2 + 2.6); }
