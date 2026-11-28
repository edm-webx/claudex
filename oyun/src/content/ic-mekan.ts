/**
 * İç mekanlar (2026-11-09, owner: "her binaya girilebilmeli, özellikle kafe bistro lokanta; her birinde geliştirmeler, yeni
 * aletler, kafede kahve makinesi; her yerde bir şey olmalı; belirli bir seviyeden sonra satın alınıp işletilebilmeli").
 * Pure data shared by the colliders (content/zones/karsi.ts, view/world/bufe-buyume.ts buyumeEngel) and the view
 * (view/world/ic-mekan-look.ts): per building the footprint, the door side, and a furniture layout in a door frame where
 * the door is at v = +D/2 and u runs along the door wall. Walls get colliders with a door gap; `solid` furniture collides.
 * Items with `esya` show only when that equipment is bought (never solid, so the static walk grid stays valid).
 */
import { ODA_X, ODA_Z, ODA_OLCU, SINEMA_BUFE } from './avm-kat';
import { mutfakEsya, MUTFAK_IST_BY_ID } from './mutfak';
import { KANAT_W, KANAT_E, PASS_X, PASS_Z, kanatAcikMi } from './restoran-plan';
import { KANAT_MASALAR, KANAT_BASE, kanatKurulu, SALON_U, SALON_V } from './kanat';
export type Yon = '+x' | '-x' | '+z' | '-z';
export type IcTur = 'kafe' | 'bistro' | 'kirtasiye' | 'okul' | 'lokanta' | 'kafeterya' | 'banka' | 'hastane' | 'acil' | 'morg' | 'kahvalti' | 'balik' | 'mutfak' | 'giyim' | 'elektronik' | 'oyuncak'
  | AvmYemekTur;
/** AVM'nin yemek / yemeğe yakın dükkânları (2026-11-21): tezgâhlı, kapısı hola bakan oda (avmYemekLayout) */
export type AvmYemekTur = 'sekerci' | 'kahveci' | 'dondurma' | 'baklava' | 'kuruyemis' | 'donerci' | 'kumpir' | 'midye' | 'avmLokanta' | 'sinema';
/** kat: AVM katı (content/avm-kat.ts), yok = 0. Kat > 0 odalar zemin çarpışmasına girmez, oyuncunun katı tutunca görünür. */
export interface IcMekan { id: string; ad: string; tur: IcTur; x: number; z: number; wx: number; wz: number; kapi: Yon; arsa?: string; bina?: string; salon?: 'W' | 'E'; mutfak?: boolean; h: number; kat?: number; /** açık stand: yalnız arka duvar var (yan ve ön duvar, kapı yok) */ acik?: boolean }
export interface IcItem { k: string; u: number; v: number; w: number; d: number; ry?: number; solid?: boolean; esya?: string; y?: number; txt?: string; c?: string; /** büfe salonu: o aşamada kurulur (BUF-20 aşama 10 masaları) */ asama?: number; /** salon masası: sim masa indexi (kanat.ts) */ masa?: number }
export interface Rect { x0: number; x1: number; z0: number; z1: number }

export const IC_MEKANLAR: IcMekan[] = [
  { id: 'kafe1', ad: 'Meydan Kafe', tur: 'kafe', x: -17.5, z: 37.9, wx: 7, wz: 9.4, kapi: '+x', arsa: 'k1', bina: 'kafe1', h: 3.1 },
  { id: 'kafe2', ad: 'Sahil Bistro', tur: 'bistro', x: -17.5, z: 51.5, wx: 7, wz: 9.4, kapi: '+x', arsa: 'k2', bina: 'kafe2', h: 3.1 },
  { id: 'kirtasiye', ad: 'Martı Kırtasiye', tur: 'kirtasiye', x: 29.7, z: 35.2, wx: 5.0, wz: 3.6, kapi: '-z', arsa: 'k3', bina: 'kirtasiye', h: 3.0 },
  { id: 'okul', ad: 'Martıköy İlkokulu', tur: 'okul', x: 48.85, z: 37.25, wx: 18.3, wz: 7.5, kapi: '-z', arsa: 'k4', bina: 'okul', h: 3.2 },
  // 2026-11-20 owner: "AVM içindeki mağazalar ayrı, satın alınıp işletilebilen işletmeler olsun". 2026-11-21 owner: "merdiven var ama
  // işlevsiz, her katında mağaza olsun": three floors (content/avm-kat.ts), each with four shops either side of the central hall
  // (escalators in the middle). West rooms x 11.7..17.65 open +x, east rooms x 22.65..28.6 open -x; front z 46.5..51.8, back ..57.1.
  ...avmOdalar(),
  { id: 'tesis', ad: 'Halı Saha Tesisleri', tur: 'kafeterya', x: -54.1, z: 45.4, wx: 3.7, wz: 17.8, kapi: '+x', arsa: 'k6', bina: 'tesis', h: 2.8 },
  { id: 'banka', ad: 'Martı Kasası Bankası', tur: 'banka', x: 11.7, z: 36.8, wx: 10, wz: 8.4, kapi: '+z', bina: 'banka', h: 3.3 },
  // 2026-11-28 sahip: "hastanenin içi de AVM gibi açılsın": hastane artık kendi diyarı (content/hastane-kat.ts); burada oda yok
  { id: 'acil', ad: 'Acil', tur: 'acil', x: 57.3, z: 52.0, wx: 3.3, wz: 3.2, kapi: '+x', bina: 'acil', h: 3.3 },
  { id: 'morg', ad: 'Morg', tur: 'morg', x: 57.3, z: 55.5, wx: 3.3, wz: 3.2, kapi: '+x', bina: 'morg', h: 3.1 },
  // büfe salonları on the pier (view/world/bufe-buyume.ts WB / EB), door on the promenade side
  { id: 'salonW', ad: 'Kahvaltı kanadı', tur: 'kahvalti', x: (KANAT_W.x0 + KANAT_W.x1) / 2, z: (KANAT_W.z0 + KANAT_W.z1) / 2, wx: KANAT_W.x1 - KANAT_W.x0, wz: KANAT_W.z1 - KANAT_W.z0, kapi: '+z', salon: 'W', h: 3.4 },
  // Sabri'nin mutfağı: the RESTAURANT's kitchen (2026-11-21 owner: büfe ayrı, restoran + mutfak ayrı). It stands behind the büfe across an open
  // service alley (door + outside pass on the alley for the terraces) and joins the two salons through closed service corridors (SERVIS_KOR).
  { id: 'mutfak', ad: 'Sabri Mutfağı', tur: 'mutfak', x: 0, z: -15.2, wx: 17.1, wz: 4.4, kapi: '+z', mutfak: true, h: 3.4 },
  { id: 'salonE', ad: 'Balık kanadı', tur: 'balik', x: (KANAT_E.x0 + KANAT_E.x1) / 2, z: (KANAT_E.z0 + KANAT_E.z1) / 2, wx: KANAT_E.x1 - KANAT_E.x0, wz: KANAT_E.z1 - KANAT_E.z0, kapi: '+z', salon: 'E', h: 3.4 },
];
export const IC_BY_ID: Record<string, IcMekan> = Object.fromEntries(IC_MEKANLAR.map(m => [m.id, m]));
/** business rooms run by the live room sim (sim/agents/kafe.ts): real guests + real workers, no props */
export const IC_CANLI = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9', 'k10', 'k11', 'k12', 'k13', 'k14', 'k15', 'k16', 'k17', 'k18'];
/** every room of one building (the AVM has twelve, four per floor) */
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
/** dünya (x, z) -> oda çerçevesi (u, v): icWorld'ün tersi */
export function icUV(m: IcMekan, x: number, z: number): { u: number; v: number } {
  const t = YAW[m.kapi], c = Math.round(Math.cos(t)), s = Math.round(Math.sin(t)), dx = x - m.x, dz = z - m.z;
  return { u: dx * c - dz * s, v: dx * s + dz * c };
}
export const IC_DUVAR = 0.25, IC_KAPI = 1.7;
/** is p inside the room (margin < 0 shrinks) */
/** p.kat (oyuncu konumu walk.pos.kat taşır; yoksa 0) odanın katıyla aynı olmalı: AVM'de üst üste odalar ayrışır */
export function icIcinde(m: IcMekan, p: { x: number; z: number; kat?: number }, margin = 0): boolean {
  return (m.kat || 0) === (p.kat || 0) && Math.abs(p.x - m.x) < m.wx / 2 + margin && Math.abs(p.z - m.z) < m.wz / 2 + margin;
}
/** kanadın ön bahçesi (aşama 6 öncesi açık teras) oda sayılmaz: oda kanadın masalı arka kısmıdır */
export const KANAT_ODA_Z = -9.4;
export const icHangi = (p: { x: number; z: number; kat?: number }, margin = 0) => IC_MEKANLAR.find(m => icIcinde(m, p, margin) && !(m.salon && p.z > KANAT_ODA_Z)) || null;
/** door point just outside / inside */
export const icKapi = (m: IcMekan, off = 0.6) => icWorld(m, 0, icDim(m).D / 2 + off);

/* ---------- layouts (door frame) ---------- */
const it = (k: string, u: number, v: number, w: number, d: number, o: Partial<IcItem> = {}): IcItem => ({ k, u, v, w, d, ...o });
const masa = (u: number, v: number, k = 'masa2') => it(k, u, v, 0.8, 0.8, { solid: true });
/**
 * BUF-20: büfe salonlarının masaları sim masasıdır (content/kanat.ts KANAT_MASALAR salonW / salonE, aynı u/v ızgarası): koltuklar
 * u ekseninde ±0.78, garson v+0.95'te. Kapıya yakın iki masa aşama 10'da (fine dining) kurulur.
 */

/** salon masası = sim masası (aynı sıra: content/kanat.ts salon()); `masa` sim indexi: sarı kareyle alınmadıysa çizilmez, çarpmaz */
const salonMasalar = (b: 'salonW' | 'salonE'): IcItem[] => { const i0 = KANAT_BASE + KANAT_MASALAR.findIndex(m => m.bolge === b); return SALON_V.flatMap((v, a) => SALON_U.map((u, c) => it('salonMasa', u, v, 0.9, 0.8, { solid: true, masa: i0 + a * SALON_U.length + c, ...(a === 1 && Math.abs(u) < 3 ? { asama: 10 } : {}) }))); };
/** salon masası o an kurulu mu (kanat.ts kanatKurulu: aşama + sarı kare) */
export const icMasaKurulu = (i: IcItem, stage: number): boolean => i.masa == null || kanatKurulu(stage).includes(i.masa);

function kafeLayout(W: number, D: number, bistro: boolean): IcItem[] {
  // 2026-11-21 denetim: tezgâh arkasında 0.9 m personel koridoru (raf duvara yaslı, tezgâh öne alındı; eskiden 0.33 m kalıyordu)
  const bv = -D / 2 + 1.95, o: IcItem[] = [
    it('rafArka', -1.7, -D / 2 + IC_DUVAR + 0.18, 4.6, 0.36), it('icecekDolap', 1.15, -D / 2 + IC_DUVAR + 0.3, 0.8, 0.55), it('tezgah', -1.2, bv, 5.0, 0.75, { solid: true, c: bistro ? '#1d4f86' : '#7a3b1c' }), it('kasa', 0.9, bv, 0.4, 0.4, { y: 1.05 }),
    it('menuPano', -1.2, -D / 2 + 0.27, 3.0, 0.05, { y: 2.3, txt: bistro ? 'SAHİL BİSTRO' : 'MEYDAN KAFE' }),
    masa(-3.1, 0.5, bistro ? 'masa4' : 'masa2'), masa(-3.1, 2.4), masa(-1.6, 1.45), masa(1.9, 0.85, bistro ? 'masa4' : 'masa2'), masa(1.9, 2.55),
    it('saksiB', W / 2 - 0.45, D / 2 - 0.45, 0.6, 0.6), it('lamba', 0, 0, W, D),
  ];
  if (!bistro) o.push(
    it('espresso', -2.7, bv, 0.6, 0.5, { esya: 'espresso', y: 1.05 }), it('barista', -0.4, bv, 0.9, 0.5, { esya: 'barista', y: 1.05 }),
    it('vitrin', 2.0, bv, 1.4, 0.8, { esya: 'vitrin' }), it('koltuk', W / 2 - 1.05, D / 2 - 1.3, 1.6, 1.6, { esya: 'koltuk' }),
    it('muzik', W / 2 - 0.55, -D / 2 + 0.55, 0.8, 0.6, { esya: 'muzik' }), it('kitaplik', -W / 2 + 0.3, 0.4, 3.2, 0.4, { esya: 'kitaplik', ry: 1 }),
    it('saksi', -W / 2 + 0.5, D / 2 - 0.5, 0.5, 0.5, { esya: 'saksi' }), it('saksi', W / 2 - 0.5, -0.6, 0.5, 0.5, { esya: 'saksi' }), it('isikTavan', 0, 0, W - 0.6, D - 0.6, { esya: 'isik' }));
  else o.push(
    it('espresso', -2.7, bv, 0.6, 0.5, { esya: 'kahve_bar', y: 1.05 }), it('waffle', -0.5, bv, 0.6, 0.45, { esya: 'waffle_mak', y: 1.05 }), it('bicak', 0.3, bv, 0.5, 0.3, { esya: 'sef_seti', y: 1.05 }),
    it('buzVitrin', 2.1, bv, 1.6, 0.85, { esya: 'buz_vitrin' }), it('akvaryum', -W / 2 + 0.32, 0.6, 3.2, 0.45, { esya: 'akvaryum', ry: 1 }),
    it('mangal', W / 2 - 0.7, -D / 2 + 0.6, 0.9, 0.7, { esya: 'mangal' }), it('piyano', W / 2 - 1.1, D / 2 - 1.1, 1.5, 1.2, { esya: 'piyano' }), it('isikTavan', 0, 0, W - 0.6, D - 0.6, { esya: 'isik' }));
  return o;
}
function kirtasiyeLayout(W: number, D: number): IcItem[] {
  // 2026-11-26 sahip: "kırtasiye merdivenin önünü kesiyor, küçük kulübe yap": 5.0 x 3.6 m kulübe (eskiden 7.1). Arka duvarda raf + vitrin + fotokopi,
  // batı duvarda kitaplık, tezgâh doğu ucunda (kasiyer arkada), okuma köşesi ve stand kapı yolunun batısında; oyuncak batı ön köşede (doğu ön köşe boş: personel tezgâhın ucundan dolaşır).
  return [
    it('rafArka', -W / 2 + 1.25, -D / 2 + 0.45, 2.0, 0.5, { solid: true, c: 'kirtasiye' }), it('tezgah', W / 2 - 1.55, 0.0, 1.8, 0.7, { solid: true, ry: 1, c: '#2b6fb8' }), it('kasa', W / 2 - 1.55, 0.5, 0.4, 0.4, { y: 1.05 }),
    it('stand', -1.2, 0.55, 1.3, 0.55, { solid: true }), it('lamba', 0, 0, W, D),
    it('fotokopi', W / 2 - 0.6, -D / 2 + 0.6, 0.9, 0.7, { esya: 'fotokopi' }), it('pos', W / 2 - 1.55, -0.4, 0.3, 0.3, { esya: 'pos', y: 1.05 }),
    it('laminasyon', W / 2 - 1.55, 0.15, 0.5, 0.4, { esya: 'laminasyon', y: 1.05 }), it('kitaplik', -W / 2 + 0.3, 0.05, 1.8, 0.4, { esya: 'kitap_raf', ry: 1 }),
    it('kalemVitrin', 0.45, -D / 2 + 0.55, 1.0, 0.6, { esya: 'vitrin_k' }), it('oyuncak', -W / 2 + 0.65, D / 2 - 0.4, 0.8, 0.6, { esya: 'oyuncak' }),
    it('yazici3d', -W / 2 + 0.6, -D / 2 + 0.45, 0.6, 0.5, { esya: 'yazici3d', y: 1.25 }), it('okuma', -1.2, -0.45, 1.1, 0.9, { esya: 'okuma' }),
  ];
}
function okulLayout(W: number, D: number): IcItem[] {
  const o: IcItem[] = [it('tahta', -4.6, -D / 2 + 0.16, 4.2, 0.1, { y: 1.6 }), it('ogretmen', -4.6, -D / 2 + 1.3, 1.4, 0.7, { solid: true }), it('lamba', 0, 0, W, D),
    it('dolap', -4.8, D / 2 - 0.35, 3.4, 0.45, { solid: true, ry: 2 }), it('pano', -8.9, 0, 2.4, 0.06, { ry: 1, y: 1.6 }), it('bolme', 0.2, -1.2, 0.18, D - 2.4 - 0.5, { solid: true })];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) o.push(it('sira', -7.6 + c * 1.55, -1.3 + r * 1.4, 1.1, 0.55, { solid: true }));
  // the school canteen (business k4) in the east half
  const bv = -D / 2 + 1.95;   // 2026-11-21 denetim: kantin tezgâhı öne, arkada 0.9 m personel koridoru
  o.push(it('tezgah', 5.2, bv, 4.6, 0.7, { solid: true, c: '#e0533c' }), it('rafArka', 4.35, -D / 2 + IC_DUVAR + 0.18, 2.9, 0.36), it('icecekDolap', 6.3, -D / 2 + IC_DUVAR + 0.3, 0.8, 0.55), it('kasa', 6.9, bv, 0.4, 0.4, { y: 1.05 }),
    it('menuPano', 5.2, -D / 2 + 0.27, 2.6, 0.05, { y: 2.2, txt: 'KANTİN' }),
    it('tostMak', 4.0, bv, 0.5, 0.4, { esya: 'tost_mak', y: 1.05 }), it('buzdolap', 8.5, -D / 2 + 0.5, 0.9, 0.7, { esya: 'buzdolap' }),
    it('semaver', 5.4, bv, 0.4, 0.4, { esya: 'semaver_k', y: 1.05 }), it('firinK', 2.4, -D / 2 + 0.5, 0.9, 0.7, { esya: 'mikrodalga' }),
    it('meyve', 8.4, 0.6, 0.9, 0.7, { esya: 'meyve' }), it('masaK', 3.6, 1.4, 1.6, 0.8, { esya: 'masa_k' }), it('masaK', 6.4, 1.4, 1.6, 0.8, { esya: 'masa_k' }),
    it('ekran', 5.2, -D / 2 + 0.2, 1.4, 0.08, { esya: 'ekran_k', y: 2.0 }), it('izgara', 7.3, -D / 2 + 0.55, 0.9, 0.6, { esya: 'izgara_k' }));
  return o;
}
/* ---------- Martı AVM odaları (2026-11-21: 3 kat x 4 dükkân, content/avm-kat.ts) ----------
 * Her oda 6.8 (kapı duvarı) x 7.0 (derinlik; 2026-11-22 büyütüldü, ilk hali 5.3 x 5.95), kapı hola bakar. Ortak iskelet: tezgâh arkada (u -2.3..1.3, v -0.925), arkasında 0.9 m
 * personel koridoru, arka duvarda aletler (v bw), tezgâhın doğu ucunda 1.1 m personel geçidi; kuyruk tezgâh önünde (v ~0.2).
 * Yemek dükkânlarında kapı tarafında iki masa, mağazalarda yan duvarda reyon + ortada teşhir masası (müşteri önce bakınır).
 * Aletler (`esya`) yalnız alınınca görünür, hiçbiri katı değil. */
function avmOdalar(): IcMekan[] {   // (IC_MEKANLAR'dan önce çağrılır: sabitler içeride)
  const AVM_ODA = ODA_OLCU;   // 2026-11-22: 6.8 x 7.0 (content/avm-kat.ts)
  const AVM_SLOT = { WF: { x: ODA_X.W, z: ODA_Z.F, kapi: '+x' as Yon }, WB: { x: ODA_X.W, z: ODA_Z.B, kapi: '+x' as Yon }, EF: { x: ODA_X.E, z: ODA_Z.F, kapi: '-x' as Yon }, EB: { x: ODA_X.E, z: ODA_Z.B, kapi: '-x' as Yon } };   // AVM realm coords
  const o = (id: string, ad: string, tur: IcTur, arsa: string, kat: number, s: keyof typeof AVM_SLOT): IcMekan =>
    ({ id, ad, tur, x: AVM_SLOT[s].x, z: AVM_SLOT[s].z, wx: AVM_ODA.D, wz: AVM_ODA.W, kapi: AVM_SLOT[s].kapi, arsa, bina: 'avm', h: 3.6, ...(kat ? { kat } : {}) });
  return [
    // giriş katı: mağazalar + şekerci
    o('avm_moda', 'Martı Moda', 'giyim', 'k7', 0, 'WF'), o('avm_tekno', 'Tekno Martı', 'elektronik', 'k8', 0, 'WB'),
    o('avm_oyuncak', 'Oyuncak Dünyası', 'oyuncak', 'k9', 0, 'EF'), o('avm_seker', 'Hacı Martı Şekerleme', 'sekerci', 'k10', 0, 'EB'),
    // 1. kat: kahve & tatlı
    o('avm_kahve', 'Telve Kahve Laboratuvarı', 'kahveci', 'k11', 1, 'WF'), o('avm_baklava', 'Şerbetçi Baklava Sarayı', 'baklava', 'k13', 1, 'WB'),
    o('avm_dondurma', 'Maraşlı Martı Dondurma', 'dondurma', 'k12', 1, 'EF'), o('avm_kuruyemis', 'Çıtırcı Kuruyemiş', 'kuruyemis', 'k14', 1, 'EB'),
    // 2. kat: yemek katı (Martı Lokantası buraya taşındı; oda kimliği 'avm' aynı kaldı)
    o('avm', 'Martı Lokantası', 'avmLokanta', 'k5', 2, 'WF'), o('avm_doner', 'Dürümcü Dayı', 'donerci', 'k15', 2, 'WB'),
    o('avm_kumpir', 'Kumpir Kulesi', 'kumpir', 'k16', 2, 'EF'), o('avm_midye', 'Midyeci Mido', 'midye', 'k17', 2, 'EB'),
    // 3. kat: sinema katının doğu bloğunda açık Sinema Büfesi standı (2026-11-22 sahip: "patlamış mısırcı olsun, dolaptan kola soda
    // gazoz versin"; 22:55: "mısır kapalı yerde olmaz, etraf mısır kokacak")
    { id: 'avm_sinema', ad: 'Martı Sinema Büfesi', tur: 'sinema', x: SINEMA_BUFE.x, z: SINEMA_BUFE.z, wx: SINEMA_BUFE.D, wz: SINEMA_BUFE.W, kapi: '-x', arsa: 'k18', bina: 'avm', h: 3.6, kat: 3, acik: true },
  ];
}
/** dükkân rengi ve tabela yazısı (iç pano, cephe / galeri tabelası) */
export const AVM_TABELA: Record<string, { c: string; txt: string }> = {
  giyim: { c: '#c94f6d', txt: 'MARTI MODA' }, elektronik: { c: '#2b6fb8', txt: 'TEKNO MARTI' }, oyuncak: { c: '#e8892b', txt: 'OYUNCAK DÜNYASI' },
  sekerci: { c: '#b8326e', txt: 'HACI MARTI ŞEKERLEME' }, kahveci: { c: '#5a3a24', txt: 'TELVE KAHVE LAB.' }, dondurma: { c: '#2f9bd6', txt: 'MARAŞLI MARTI' },
  baklava: { c: '#3f7a34', txt: 'ŞERBETÇİ BAKLAVA' }, kuruyemis: { c: '#c07a2c', txt: 'ÇITIRCI KURUYEMİŞ' }, avmLokanta: { c: '#a2472f', txt: 'MARTI LOKANTASI' },
  donerci: { c: '#c0392b', txt: 'DÜRÜMCÜ DAYI' }, kumpir: { c: '#e2a82b', txt: 'KUMPİR KULESİ' }, midye: { c: '#1d4f86', txt: 'MİDYECİ MİDO' },
  sinema: { c: '#b3122e', txt: 'SİNEMA BÜFESİ' },
};
/** eski ad (karsi-bina, tests): mağaza renkleri */
export const MAGAZA_RENK = AVM_TABELA as Record<'giyim' | 'elektronik' | 'oyuncak', { c: string; txt: string }>;
const MAGAZA_TUR = new Set<IcTur>(['giyim', 'elektronik', 'oyuncak', 'sekerci', 'kuruyemis']);
/** müşterinin önce reyonlara bakındığı dükkânlar (agents/kafe.ts) */
export const icMagaza = (t: IcTur) => MAGAZA_TUR.has(t);
/**
 * 2026-11-22 sahip: "AVM'yi daha da büyüt". Yerleşim ilk oda ölçüsünde (5.3 x 5.95) yazıldı; daha büyük odada aynı yerleşim
 * yeni boyuta yayılır: arka yarı (tezgâh, arkasındaki aletler, pano) arka duvara yapışık kalır, tezgâh uzar ve üstündeki
 * aletler tezgâh boyunca açılır, yan duvardaki öğeler duvarda kalır, ön yarı (masalar, teşhir) kapıya doğru açılır.
 */
const AVM_ODA0 = { W: 5.3, D: 5.95 } as const;
function avmOdaLayout(W: number, D: number, tur: IcTur): IcItem[] {
  const base = avmOdaLayout0(AVM_ODA0.W, AVM_ODA0.D, tur);
  if (W <= AVM_ODA0.W + 1e-6 && D <= AVM_ODA0.D + 1e-6) return base;
  const dW = (W - AVM_ODA0.W) / 2, dD = (D - AVM_ODA0.D) / 2, tz = base.find(i => i.k === 'tezgah')!, s = (tz.w + 2 * dW * 0.7) / tz.w;
  const yay = (x: number, yari: number, d: number) => x + Math.sign(x) * d * Math.min(1, Math.abs(x) / (yari - 0.6));
  const o = base.map(i => {
    if (i.k === 'zemin' || i.k === 'lamba') return { ...i, u: 0, v: 0, w: W, d: D };
    const v = i.v < 0 ? i.v - dD : yay(i.v, AVM_ODA0.D / 2, dD);
    if (i.v === tz.v) return { ...i, u: tz.u + (i.u - tz.u) * s, v, ...(i.k === 'tezgah' ? { w: i.w * s } : {}) };   // tezgâh ve üstündekiler
    if (i.k === 'menuPano') return { ...i, v, w: i.w * s };
    const duvar = Math.abs(i.u) >= AVM_ODA0.W / 2 - IC_DUVAR - 0.45;   // yan duvardaki öğe duvarda kalır
    return { ...i, u: duvar ? i.u + Math.sign(i.u) * dW : yay(i.u, AVM_ODA0.W / 2, dW), v };
  });
  // büyüyen odanın ortası boş kalmasın: yemek dükkânına iki masa daha (yanlarda), mağazaya ikinci teşhir masası
  if (dW > 0.8 && dD > 0.8) {
    if (MAGAZA_TUR.has(tur)) o.push(it('teshir', W / 2 - 2.1, 0.35, 1.0, 0.7, { solid: true, c: tur }));
    else if (tur !== 'sinema') for (const sx of [-1, 1]) { const mu = sx * (W / 2 - 1.35); if (!o.some(i => i.k !== 'zemin' && i.k !== 'lamba' && (i.y ?? 0) < 1 && Math.abs(i.u - mu) < 1.0 + i.w / 2 && Math.abs(i.v - 0.75) < 0.9 + i.d / 2)) o.push(masa(mu, 0.75)); }   // yan duvarda dolap / akvaryum varsa o tarafa koymaz
  }
  return o;
}
function avmOdaLayout0(W: number, D: number, tur: IcTur): IcItem[] {
  const R = AVM_TABELA[tur] || AVM_TABELA.avmLokanta, bv = -D / 2 + 2.05, bw = -D / 2 + IC_DUVAR + 0.27, cy = 1.05;
  const ct = (k: string, u: number, w: number, d: number, esya?: string, o: Partial<IcItem> = {}) => it(k, u, bv, w, d, { y: cy, ...(esya ? { esya } : {}), ...o });
  const arka = (k: string, u: number, w: number, d: number, esya?: string, o: Partial<IcItem> = {}) => it(k, u, bw + (0.5 - d) / 2, w, d, { ...(esya ? { esya } : {}), ...o });
  const o: IcItem[] = [
    it('lamba', 0, 0, W, D), it('zemin', 0, 0, W, D, { c: 'avm' }),
    it('tezgah', -0.5, bv, 3.6, 0.75, { solid: true, c: R.c }), it('kasa', 0.85, bv, 0.4, 0.4, { y: cy }),
    it('menuPano', -0.5, -D / 2 + 0.27, 3.0, 0.05, { y: 2.6, txt: R.txt }),
  ];
  if (MAGAZA_TUR.has(tur)) {
    // mağaza: batı duvarında reyon, ortada teşhir masası (yolun iki yanında 1.4 m), kapının iki yanında vitrin köşeleri
    o.push(it('reyon', -W / 2 + IC_DUVAR + 0.2, 1.0, 2.3, 0.4, { solid: true, ry: 1, c: tur }), it('teshir', 0.3, 1.3, 1.0, 0.7, { solid: true, c: tur }));
    if (tur === 'giyim') o.push(arka('depoRaf', -0.6, 3.0, 0.3, undefined, { c: tur }), ct('paketMasa', -0.4, 0.5, 0.4, undefined, { c: tur }),
      it('askilik', -1.3, 2.0, 0.7, 0.7, { esya: 'askilik' }), it('manken', -1.95, 2.6, 0.5, 0.5, { esya: 'manken' }), it('manken', 1.95, 2.6, 0.5, 0.5, { esya: 'manken', c: 'b' }),
      it('prova', 1.9, 1.0, 0.9, 0.9, { esya: 'prova' }), it('ayna', W / 2 - IC_DUVAR - 0.03, 2.05, 0.6, 0.06, { esya: 'ayna', ry: 3 }),
      arka('ayakkabi', 1.75, 0.9, 0.3, 'ayakkabi'), ct('aksesuar', -2.0, 0.45, 0.45, 'aksesuar'), ct('dikis', -1.2, 0.55, 0.45, 'tasarim'),
      it('ledPano', -W / 2 + IC_DUVAR + 0.03, 1.0, 1.6, 0.05, { esya: 'led_vitrin', y: 2.35, ry: 1, c: R.c }));
    else if (tur === 'elektronik') o.push(arka('depoRaf', -0.6, 3.0, 0.3, undefined, { c: tur }), ct('testMasa', -2.0, 0.6, 0.45),
      it('demoMasa', -1.3, 2.0, 0.7, 0.7, { esya: 'demo_masa' }), ct('tamir', -1.2, 0.5, 0.4, 'tamir'), it('tvDuvar', W / 2 - IC_DUVAR - 0.03, 1.0, 1.8, 0.06, { esya: 'tv_duvar', y: 1.75, ry: 3 }),
      it('kulaklikStand', -1.95, 2.6, 0.5, 0.5, { esya: 'kulaklik_stand' }), it('konsol', 1.9, 1.0, 0.85, 0.85, { esya: 'konsol' }), it('vr', 1.95, 2.6, 0.55, 0.55, { esya: 'vr' }),
      it('drone', 0.3, 0.4, 0.6, 0.6, { esya: 'drone', y: 2.35 }), it('ledPano', -W / 2 + IC_DUVAR + 0.03, 1.0, 1.6, 0.05, { esya: 'led_e', y: 2.35, ry: 1, c: R.c }));
    else if (tur === 'oyuncak') o.push(arka('depoRaf', -0.6, 3.0, 0.3, undefined, { c: tur }), ct('testMasa', -2.0, 0.6, 0.45),
      it('pelusSepet', -1.3, 2.0, 0.7, 0.7, { esya: 'pelus_sepet' }), it('balon', -1.95, 2.6, 0.5, 0.5, { esya: 'balon' }), it('trenPist', 0.3, 1.3, 0.8, 0.6, { esya: 'tren_pist', y: 0.8 }),
      arka('legoDuvar', 1.75, 0.9, 0.3, 'lego_duvar'), it('oyunKale', 1.9, 1.0, 0.85, 0.85, { esya: 'oyun_kale' }), it('maskot', 1.95, 2.6, 0.55, 0.55, { esya: 'maskot' }),
      ct('hediye', -1.2, 0.5, 0.4, 'hediye_paket'), it('ledPano', -W / 2 + IC_DUVAR + 0.03, 1.0, 1.6, 0.05, { esya: 'led_o', y: 2.35, ry: 1, c: R.c }));
    else if (tur === 'sekerci') o.push(arka('kavanoz', -1.0, 1.7, 0.4, undefined, { c: 'seker' }),
      ct('tepsiTezgah', -2.0, 0.6, 0.45, 'lokum_tezgah', { c: 'lokum' }), it('kavanoz', 0.3, 1.3, 0.9, 0.5, { esya: 'cam_kavanoz', y: 0.78, c: 'akide' }),
      it('tepsiTezgah', -1.95, 2.6, 0.55, 0.5, { esya: 'macuncu', y: 0.75, c: 'macun' }), arka('hamurMasa', 0.95, 0.85, 0.5, 'pismaniye_tezgah', { c: 'pismaniye' }),
      arka('kazan', 1.95, 0.6, 0.5, 'kestane_ocak', { c: 'kestane' }), it('hediye', 1.95, 2.6, 0.5, 0.5, { esya: 'hediye_kutu', y: 0.4 }),
      it('vitrin', 1.9, 1.0, 0.85, 0.85, { esya: 'cikolata_vitrin', c: 'cikolata' }), ct('tepsiTezgah', -1.2, 0.6, 0.45, 'osmanli_tezgah', { c: 'altin' }));
    else o.push(arka('kavanoz', -1.0, 1.7, 0.4, 'cam_hazne', { c: 'cerez' }),   // kuruyemiş
      ct('terazi', -2.0, 0.45, 0.4, 'terazi'), it('cuval', -1.3, 2.0, 0.8, 0.7, { esya: 'cuval' }), arka('kavurucu', 0.95, 0.85, 0.5, 'kavurma_kazan'),
      it('cuval', 1.9, 1.0, 0.85, 0.85, { esya: 'kuru_meyve', c: 'meyve' }), arka('paketMasa', 1.95, 0.6, 0.45, 'paket_mak', { c: 'kuruyemis' }),
      ct('tepsiTezgah', -1.2, 0.6, 0.45, 'tadim', { c: 'cerez' }), it('kavurucu', 1.95, 2.6, 0.55, 0.5, { esya: 'kavurma_ustasi', c: 'kucuk' }), it('saksi', -1.95, 2.6, 0.5, 0.5));
    return o;
  }
  // yemek dükkânı: kapı tarafında iki masa (sandalyeler duvara 0.2 m mesafede), ön köşelerde saksı
  if (tur !== 'sinema') o.push(masa(-1.45, 1.95), masa(1.45, 1.95)); o.push(it('saksi', -2.05, 2.6, 0.45, 0.45));
  const yan = (k: string, s: -1 | 1, esya: string, o2: Partial<IcItem> = {}) => it(k, s * (W / 2 - IC_DUVAR - 0.03), 0.45, 1.5, 0.06, { esya, ry: s < 0 ? 1 : 3, y: 1.6, ...o2 });
  if (tur === 'kahveci') o.push(ct('kumOcak', -2.0, 0.6, 0.45, 'kum_ocak'), ct('espresso', -1.2, 0.6, 0.5, 'espresso_t'), ct('degirmen', -0.35, 0.3, 0.3, 'degirmen'),
    arka('kavanoz', -1.95, 0.8, 0.4, 'dibek_havan', { c: 'kahve' }), arka('kavanoz', -1.0, 0.85, 0.4, 'demleme_bar', { c: 'demleme' }), arka('barista', -0.05, 0.85, 0.5, 'latte_sanat'),
    arka('kavurucu', 1.0, 0.85, 0.5, 'kavurucu'), it('falci', 2.0, 1.05, 0.6, 0.6, { esya: 'falci' }), yan('bakirDuvar', -1, '', { c: 'cezve' }));
  else if (tur === 'dondurma') o.push(ct('dondurmaTezgah', -1.45, 1.4, 0.55, 'dondurma_vitrin'), ct('waffle', 0.15, 0.55, 0.45, 'waffle_mak_d'),
    arka('kazan', -1.95, 0.6, 0.5, 'dovme_kazan', { c: 'dovme' }), arka('firinK', -1.0, 0.8, 0.5, 'kulah_kalip'), arka('buzdolap', -0.05, 0.8, 0.5, 'sorbe'),
    arka('buzdolap', 1.0, 0.8, 0.5, 'kar_dolap', { c: 'kar' }), yan('dondurmaSov', -1, 'sopa_sov'), yan('dondurmaSov', 1, 'zil', { c: 'zil', v: 0.2, w: 0.8 }));
  else if (tur === 'baklava') o.push(ct('corba', -2.0, 0.5, 0.45, 'serbet_kazan', { c: 'serbet' }), ct('tepsiTezgah', -1.2, 0.7, 0.5, 'kunefe_ocak', { c: 'kunefe' }), ct('tepsiTezgah', -0.35, 0.6, 0.45, 'serbetci_usta', { c: 'baklava' }),
    arka('hamurMasa', -1.95, 0.8, 0.5, 'oklava', { c: 'yufka' }), arka('tasFirin', -0.9, 1.0, 0.5, 'tas_firin_b'), arka('buzdolap', 0.15, 0.7, 0.5, 'kaymak'),
    arka('tatliVitrin', 1.1, 0.8, 0.5, 'tatli_vitrin_b'), yan('bakirDuvar', -1, 'bakir_tepsi'));
  else if (tur === 'donerci') o.push(ct('lavasSac', -2.0, 0.55, 0.45, 'lavas_sac'), ct('bicak', -1.2, 0.5, 0.3, 'dayi_bicak'), ct('kazan', -0.35, 0.5, 0.45, 'pilav_kazan', { c: 'pilav' }),
    arka('doner', -1.85, 0.6, 0.5, 'doner_ocak'), arka('doner', -0.95, 0.6, 0.5, 'ikinci_sis'), arka('yayik', 0.0, 0.6, 0.5, 'ayran_yayik'), arka('kavanoz', 1.0, 0.85, 0.4, 'tursu', { c: 'tursu' }),
    yan('ledPano', -1, 'led_d', { c: R.c, y: 1.8 }));
  else if (tur === 'kumpir') o.push(ct('benmari', -1.6, 1.3, 0.55, 'ic_bari'), ct('tepsiTezgah', -0.35, 0.6, 0.45, 'ezme_tezgah', { c: 'tereyag' }),
    arka('kumpirFirin', -1.6, 1.1, 0.5, 'kumpir_firin'), arka('fritoz', -0.5, 0.7, 0.5, 'fritoz_k'), arka('buzdolap', 0.45, 0.6, 0.5, 'limonata_dispenser', { c: 'limon' }),
    arka('ustaOcak', 1.35, 0.8, 0.5, 'usta_k'), yan('ledPano', -1, 'neon', { c: '#ff4fa3', y: 1.8 }), it('vitrin', 2.05, 1.05, 0.55, 0.6, { esya: 'kule_vitrin', c: 'kumpir' }));
  else if (tur === 'midye') o.push(ct('tepsiTezgah', -1.9, 0.8, 0.5, 'midye_tabla', { c: 'midye' }), ct('tepsiTezgah', -1.0, 0.5, 0.4, 'limon_sepet', { c: 'limon' }), ct('tepsiTezgah', -0.3, 0.6, 0.45, 'mido_tezgah', { c: 'altin' }),
    arka('ocakK', -1.85, 0.8, 0.5, 'tava_ocak'), arka('buzVitrin', -0.75, 1.1, 0.5, 'buz_tezgah_m'), arka('tasFirin', 0.45, 0.9, 0.5, 'guvec_firin'),
    yan('agSus', 1, 'ag_sus'), it('akvaryum', -W / 2 + IC_DUVAR + 0.22, 0.45, 1.5, 0.4, { esya: 'akvaryum_m', ry: 1 }));
  else if (tur === 'sinema') o.push(   // Sinema Büfesi (açık stand, avmOdaLayout tezgâhı uzatır): makineler tezgâh boyunca ~1.5 m arayla, arkada dolap; masa yok
    ct('kazan', -2.05, 0.4, 0.38, 'karamel_kazan', { c: 'karamel' }), ct('misirMak', -1.35, 0.75, 0.5, 'misir_mak'), ct('nachoIsitici', 0.0, 0.45, 0.42, 'nacho_isitici'),
    arka('icecekDolap', -1.75, 1.2, 0.5, 'icecek_dolap_s'), arka('kavanoz', -0.45, 0.8, 0.4, undefined, { c: 'misir' }), arka('slushMak', 1.0, 0.6, 0.45, 'slush_mak'),
    it('ledPano', 0.4, bv - 0.15, 1.6, 0.05, { esya: 'led_menu_s', y: 2.75, c: R.c }),   // tezgâhın üstünde asılı
    it('afisVitrin', -2.0, 1.55, 1.3, 0.35, { esya: 'afis_vitrin' }), it('kordon', 1.6, 1.4, 0.5, 1.6, { esya: 'vip_bar' }));
  else o.push(   // Martı Lokantası (k5): esnaf lokantası aletleri bu odaya sığacak şekilde
    ct('benmari', -1.7, 1.2, 0.55, 'benmari'), ct('corba', -0.75, 0.45, 0.45, 'corba_kazan'), ct('semaver', -0.2, 0.35, 0.35, 'cay_ocak'),
    arka('tasFirin', -1.75, 0.9, 0.5, 'pide_firin'), arka('mangal', -0.8, 0.8, 0.5, 'ocakbasi'), arka('doner', 0.0, 0.5, 0.5, 'doner'), arka('ustaOcak', 0.75, 0.7, 0.5, 'sef_ocak'),
    arka('tatliVitrin', 1.75, 0.7, 0.5, 'tatli_vitrin'), yan('ledPano', -1, 'led_menu', { c: R.c, y: 1.8 }));
  return o;
}
function kafeteryaLayout(W: number, D: number): IcItem[] {
  const bv = -D / 2 + 1.45;   // 2026-11-21 denetim: tezgâh arkasında 0.9 m koridor; masalar kuyruğun önünden doğuya alındı
  return [
    it('lamba', 0, 0, W, D), it('tezgah', -4.8, bv, 4.6, 0.6, { solid: true, c: '#2f9e5a' }), it('kasa', -2.9, bv, 0.4, 0.4, { y: 1.05 }), it('menuPano', -4.8, -D / 2 + 0.27, 2.8, 0.05, { y: 2.0, txt: 'KAFETERYA' }), it('icecekDolap', -4.0, -D / 2 + IC_DUVAR + 0.14, 0.8, 0.26),
    masa(1.1, 0.7), masa(2.8, 0.7), it('dolap', 5.6, -D / 2 + 0.3, 5.0, 0.45, { solid: true }), it('bank', 5.6, 0.2, 3.6, 0.4, { solid: true }),
    it('pano', 2.2, -D / 2 + 0.17, 1.6, 0.06, { y: 1.5, txt: 'SOYUNMA' }), it('dus', 8.2, 0.9, 1.0, 1.2),
    it('semaver', -5.8, bv, 0.4, 0.4, { esya: 'cay_mak', y: 1.05 }), it('buzdolap', -7.9, -D / 2 + 0.45, 0.9, 0.7, { esya: 'icecek_dolap' }),
    it('ekran', -0.8, -D / 2 + 0.2, 1.8, 0.08, { esya: 'mac_tv', y: 1.7 }), it('langirt', -1.0, 1.0, 1.3, 0.75, { esya: 'langirt' }),
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
/** 2026-11-25 ters U: kanat odası bütün kanattır (arka duvar hattı + masalar + ön bahçe). 5'in U tezgâhı: aletler arka duvarda ve avluya
 *  bakan iç kenarda (U'nun kolları); ön bahçe masaları kanat.ts'te (bufe-buyume çizer). */
function kahvaltiLayout(W: number, D: number): IcItem[] {
  return [
    it('lamba', 0, 0, W, D), it('acikBufe', -2.4, -D / 2 + 0.85, 4.4, 0.8, { solid: true }), it('menuPano', -2.4, -D / 2 + 0.27, 3.2, 0.05, { y: 2.5, txt: 'SERPME KAHVALTI' }),
    ...salonMasalar('salonW'),
    it('tasFirin', 2.2, -D / 2 + 0.85, 1.7, 1.1, { esya: 'tas_firin' }), it('gozleme', 4.5, -D / 2 + 0.85, 1.4, 0.9, { esya: 'gozleme' }),
    it('semaverDev', W / 2 - 0.65, -4.4, 0.8, 0.8, { esya: 'semaver_dev' }), it('balKaymak', W / 2 - 0.6, -2.7, 1.4, 0.6, { esya: 'bal_kaymak', ry: 3 }),
    it('sarkuteri', W / 2 - 0.65, -0.8, 1.4, 0.7, { esya: 'sarkuteri', ry: 3 }), it('salonPass', PASS_X.W - (KANAT_W.x0 + KANAT_W.x1) / 2, PASS_Z - (KANAT_W.z0 + KANAT_W.z1) / 2, 1.4, 0.4, { y: 1.0, solid: true }),
  ];
}
function balikLayout(W: number, D: number): IcItem[] {
  return [
    it('lamba', 0, 0, W, D), it('bar', 2.4, -D / 2 + 0.95, 5.0, 0.8, { solid: true }), it('menuPano', 2.4, -D / 2 + 0.27, 3.2, 0.05, { y: 2.5, txt: 'GÜNÜN BALIĞI' }),
    ...salonMasalar('salonE'), it('salonPass', PASS_X.E - (KANAT_E.x0 + KANAT_E.x1) / 2, PASS_Z - (KANAT_E.z0 + KANAT_E.z1) / 2, 1.4, 0.4, { y: 1.0, solid: true }),
    it('mangal', -2.6, -D / 2 + 0.75, 1.4, 0.8, { esya: 'mangal_e' }), it('buzTezgah', -W / 2 + 0.75, -4.1, 2.3, 0.9, { esya: 'buz_tezgah', ry: 1 }),
    it('mezeDolap', -W / 2 + 0.65, 3.4, 1.8, 0.6, { esya: 'meze_dolap', ry: 1 }), it('akvaryum', W / 2 - 0.5, 8.2, 3.6, 0.45, { esya: 'akvaryum_e', ry: 3 }),
    it('piyano', 4.4, 9.0, 1.6, 1.0, { esya: 'piyano_s' }),
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
 * BUF-22: mutfak aşamayla yerinde büyür (mutfakOda): oda hep x=0'a ortalı, kapı u=0'da, u = dünya x. Her istasyon kendi açıldığı
 * aşamanın odasına sığar (3-5 esnaf ±4.6, 6-8 lokanta ±6.9, 9-10 iki hatlı ±9). Pass ön duvarda, büfe tezgâhının arkasında: garson
 * tabağı dışarıdan, pass penceresinden alır (passGarson odanın dışında, kapıdan girmez).
 */
export const MUTFAK_YER: Record<string, { u: number; w: number; sira: 'arka' | 'on' | 'orta'; k: string }> = {
  // arka hat (aşama 3-5 esnaf odası: soğuk oda, ocak, ızgara, fritöz, bulaşık)
  soguk_oda: { u: -3.6, w: 1.4, sira: 'arka', k: 'sogukOda' }, ocak: { u: -2.0, w: 1.6, sira: 'arka', k: 'ocakK' }, izgara: { u: -0.3, w: 1.6, sira: 'arka', k: 'izgaraK' },
  fritoz: { u: 1.3, w: 1.2, sira: 'arka', k: 'fritoz' }, bulasik: { u: 3.25, w: 2.0, sira: 'arka', k: 'bulasik' },
  // aşama 6-8 lokanta odası: taş fırın sola, döner sağa; 9: ikinci ocak / ızgara hatları uçlarda
  tas_firin: { u: -5.5, w: 1.8, sira: 'arka', k: 'tasFirin' }, doner: { u: 5.0, w: 1.1, sira: 'arka', k: 'doner' },
  ocak2: { u: -7.45, w: 1.6, sira: 'arka', k: 'ocakK' }, izgara2: { u: 7.45, w: 1.6, sira: 'arka', k: 'izgaraK' },
  // ön hat: pass (pencerede), çay barı; 6-7: salata, soğuk meze, tatlı
  pass: { u: -2.9, w: 2.0, sira: 'on', k: 'pass' }, cay_bar: { u: 2.6, w: 1.6, sira: 'on', k: 'cayBar' },
  icecek_dolap: { u: 1.4, w: 0.8, sira: 'on', k: 'buzdolap' },   // 2026-11-22: kapının sağında soğuk içecek dolabı (Kolaz, soda, gazoz)
  salata: { u: -5.4, w: 1.6, sira: 'on', k: 'salata' }, meze: { u: 4.6, w: 1.4, sira: 'on', k: 'mezeDolap' }, tatli: { u: 5.95, w: 1.2, sira: 'on', k: 'tatliVitrin' },
  // 10: şef pasosu ortada (hazırlık tezgâhlarının sağında)
  sef_masa: { u: 6.0, w: 2.4, sira: 'orta', k: 'sefMasa' },
};
/** mutfak koridorları ve duraklar (u, v): arka koridor v=-D/2+1.5, ön koridor v=D/2-1.3; geçitler hazırlık tezgâhlarının arasından.
 *  passGarson pass penceresinin önü (odanın dışı, yürüyüş yolu). Geçitler en küçük odaya da sığar: rota aşamadan bağımsız. */
export const MUTFAK_NOKTA = {
  passAsci: [-2.9, 0.9] as [number, number], passGarson: [-2.9, 2.95] as [number, number],
  gecit: [-4.0, 0, 4.0], sefDurak: [[-1.5, 0.9], [-4.4, 0.9]] as [number, number][], komiDurak: [[3.6, -0.7], [1.9, -0.7]] as [number, number][],
};
/** BUF-22: aşamaya göre mutfak odası (x=0'a ortalı, ön duvar sabit z=-13.0, derinlik sabit): genişlik 9.2 / 13.8 / 17.1 m (2026-11-21: 18 m
 *  oda doğu çatı merdiveninin (x 8.6..9.5) içine giriyordu; 17.1 m duvar merdivenin önünde biter) */
export const MUTFAK_BOY: { s: number; yari: number; ad: string }[] = [
  { s: 3, yari: 4.6, ad: 'Esnaf mutfağı' }, { s: 6, yari: 8.55, ad: 'Lokanta mutfağı' }, { s: 9, yari: 8.55, ad: 'İki hatlı açık mutfak' }, { s: 10, yari: 8.55, ad: 'Şef pasolu otel mutfağı' },
];
export function mutfakBoy(stage: number): { s: number; yari: number; ad: string } {
  let b = MUTFAK_BOY[0]; for (const x of MUTFAK_BOY) if (stage >= x.s) b = x; return b;
}
const odaCache = new Map<number, IcMekan>();
/** the kitchen room of this stage (the IC_BY_ID.mutfak record is the largest, stage 9-10 room) */
export function mutfakOda(stage: number): IcMekan {
  const b = mutfakBoy(stage), key = b.yari; let o = odaCache.get(key);
  if (!o) { o = { ...IC_BY_ID.mutfak, wx: b.yari * 2 }; odaCache.set(key, o); }
  return o;
}
/** BUF-22: oyuncu büfede ya da arkasındaki servis geçidindeyken mutfağın içi çizilir (camlı ön / pass penceresinden görünür; 2026-11-21: çatı yalnız mutfağın içindeyken kalkar) */
export const mutfakVitrin = (p: { x: number; z: number }): boolean => p.x > -10.5 && p.x < 10.5 && p.z > -13.2 && p.z < -3.6;
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
/** BUF-22: bu aşamada mutfakta bekleme / durma noktası odanın içinde kalsın (iç duvar yüzünden 0.6 m) */
export function mutfakIcine(uv: [number, number], stage: number): [number, number] {
  const m = mutfakBoy(stage).yari - IC_DUVAR - 0.6; return [Math.max(-m, Math.min(m, uv[0])), uv[1]];
}
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
/**
 * Kitchen (door frame): cooking line on the back wall, prep line in front, pass in the front wall (window to the walkway); every
 * station is `esya` = its id. BUF-22: duvar öğeleri (davlumbaz, tava rayı, menü) o aşamanın oda genişliğine göre; hazırlık
 * tezgâhları aşamayla çoğalır (asama alanı: kurulmadan çarpışmaz). Ön hat istasyonları aşçıya dönük (ry 2).
 */
function mutfakLayout(W: number, D: number, stage: number): IcItem[] {
  const bv = -D / 2 + 0.55, fv = D / 2 - 0.55, yari = W / 2 - IC_DUVAR;
  const st = (id: string) => { const y = MUTFAK_YER[id]; return it(y.k, y.u, y.sira === 'arka' ? bv : y.sira === 'on' ? fv : 0.1, y.w, 0.75, { esya: id, ...(y.sira === 'on' ? { ry: 2 } : {}) }); };
  const hood = stage >= 9 ? [-8.25, 2.0] : stage >= 6 ? [-6.4, 2.0] : [-2.9, 2.0];
  return [
    ...Object.keys(MUTFAK_YER).map(st),
    it('davlumbaz', (hood[0] + hood[1]) / 2, bv, hood[1] - hood[0], 1.0, { esya: 'ocak' }),
    ...(stage >= 9 ? [it('davlumbaz', 6.3, bv, 4.0, 1.0, { esya: 'izgara2' })] : []),
    it('asiliTava', 0, -D / 2 + 0.3, Math.max(4, 2 * yari - 1.4), 0.2), it('kds', 3.25, -D / 2 + 0.3, 1.9, 0.1),   // duvar yüzü -D/2+0.25: duvara asılı öğeler onun önünde (2026-11-20 BUF-07)
    it('mutfakMenu', -yari + 0.03, 0.15, 2.6, 0.1, { ry: 1 }),   // BUF-07: duvar menü panosu (aşamaya göre) + şef notu; BUF-22: sol yan duvarda (oda büyüyünce duvarla gider)
    it('islakTabela', -1.0, 0.95, 0.4, 0.4),   // BUF-07: ıslak zemin tabelasının yeri (yalnız yerleşim, görünürlük kir eşiğiyle ic-mekan-look'ta)
    it('hazirlik', -2.7, 0.1, 1.8, 0.7, { solid: true }), it('hazirlik', 2.7, 0.1, 1.8, 0.7, { solid: true }),
    it('hazirlik', -5.8, 0.1, 1.6, 0.7, { solid: true, asama: 6 }), it('hazirlik', -7.6, 0.1, 1.2, 0.7, { solid: true, asama: 9 }),
  ];
}

/** room furniture; `stage` only matters for the büfe kitchen (BUF-22: grows with the stage, default = the full stage-10 kitchen) */
export function icLayout(m: IcMekan, stage = 10): IcItem[] {
  if (m.mutfak) m = mutfakOda(stage);
  const key = m.mutfak ? 'mutfak' + mutfakBoy(stage).s : m.id;
  let o = cache.get(key); if (o) return o;
  const { W, D } = icDim(m);
  o = m.tur === 'kafe' ? kafeLayout(W, D, false) : m.tur === 'bistro' ? kafeLayout(W, D, true) : m.tur === 'kirtasiye' ? kirtasiyeLayout(W, D) : m.tur === 'okul' ? okulLayout(W, D)
    : m.bina === 'avm' ? avmOdaLayout(W, D, m.tur) : m.tur === 'kafeterya' ? kafeteryaLayout(W, D) : m.tur === 'banka' ? bankaLayout(W, D)
    : m.tur === 'mutfak' ? mutfakLayout(W, D, stage) : m.tur === 'kahvalti' ? kahvaltiLayout(W, D) : m.tur === 'balik' ? balikLayout(W, D) : m.tur === 'acil' ? acilLayout(W, D) : morgLayout(W, D);
  o = o.map(i => duvaraOturt(i, W, D));
  cache.set(key, o); return o;
}
/** 2026-11-21 denetim: zemin eşyası duvarın içine taşmaz; taşan eşya duvar yüzüne yaslanacak kadar içeri kayar (ince duvar panoları,
 *  kapılar ve kasa kapağı gibi derinliği 0.25 m'den az olanlar duvarda kalır). */
function duvaraOturt(i: IcItem, W: number, D: number): IcItem {
  if (!icZeminEngeli(i)) return i;
  const r = icItemRect(i), t = IC_DUVAR, sw = r.u1 - r.u0, sd = r.v1 - r.v0; let du = 0, dv = 0;
  if (sw > 0.25 && sw < W - 2 * t) { if (r.u0 < -W / 2 + t) du = -W / 2 + t - r.u0; else if (r.u1 > W / 2 - t) du = W / 2 - t - r.u1; }
  if (sd > 0.25 && sd < D - 2 * t) { if (r.v0 < -D / 2 + t) dv = -D / 2 + t - r.v0; else if (r.v1 > D / 2 - t) dv = D / 2 - t - r.v1; }
  return du || dv ? { ...i, u: i.u + du, v: i.v + dv } : i;
}

/** World-space colliders: walls with the door gap plus solid furniture (`stage`: büfe salonunda o aşamada kurulmamış masa yok). */
/** 2026-11-22 (sahibi: "her yerinde hayaletlenme, içinden geçiliyor"): restoranın salon ve mutfak eşyaları gövdeleriyle katı.
 *  Yerde duran (tavana / duvara asılı olmayan) her eşya; satın alınan eşya yalnız alınmışsa (salon: sahip listesi, mutfak: mutfakEsya). */
const RESTORAN_KATI = new Set(['sogukOda', 'ocakK', 'izgaraK', 'fritoz', 'bulasik', 'tasFirin', 'doner', 'pass', 'cayBar', 'buzdolap', 'salata', 'mezeDolap', 'tatliVitrin', 'sefMasa',
  'semaverDev', 'gozleme', 'balKaymak', 'sarkuteri', 'buzTezgah', 'mangal', 'akvaryum', 'piyano']);
function restoranKati(m: IcMekan, i: IcItem, stage: number, sahip?: readonly string[]): boolean {
  if (!(m.mutfak || m.salon) || !RESTORAN_KATI.has(i.k)) return false;
  if (!i.esya) return true;
  if (m.mutfak) return MUTFAK_IST_BY_ID[i.esya] ? mutfakEsya(stage).includes(i.esya) : true;
  return !sahip || sahip.includes(i.esya);
}
export function icColliders(m: IcMekan, stage = 99, sahip?: readonly string[]): Rect[] {
  const oda = m;
  if (m.mutfak) m = mutfakOda(stage);   // BUF-22: kitchen walls follow the stage room
  const { W, D } = icDim(m), t = IC_DUVAR, g = IC_KAPI / 2, o: Rect[] = [];
  const acikPlan = !!m.salon || (!!m.mutfak && stage >= 6);   // 2026-11-25 ters U: kanatların ve mutfağın iç duvarı yok (dış duvar: restoran-plan.ts restoranDuvar)
  if (!acikPlan) o.push(rectW(m, -W / 2, W / 2, -D / 2, -D / 2 + t));
  for (const [, u0, u1] of (m.acik || acikPlan ? [] : [['W', -W / 2, -W / 2 + t], ['E', W / 2 - t, W / 2]]) as ['W' | 'E', number, number][]) {
    o.push(rectW(m, u0, u1, -D / 2, D / 2));
  }
  if (!m.acik && !acikPlan) o.push(rectW(m, -W / 2, -g, D / 2 - t, D / 2), rectW(m, g, W / 2, D / 2 - t, D / 2));
  for (const i of icLayout(m, Math.min(10, stage))) if ((i.solid || restoranKati(oda, i, stage, sahip)) && (i.asama ?? 0) <= stage && icMasaKurulu(i, stage)) { const sw = (i.ry || 0) % 2 ? i.d : i.w, sd = (i.ry || 0) % 2 ? i.w : i.d; o.push(rectW(m, i.u - sw / 2, i.u + sw / 2, i.v - sd / 2, i.v + sd / 2)); }
  return o;
}
/** Same, relative to the building centre (prefab-local colliders for an unrotated placement). */
export const icCollidersLocal = (m: IcMekan, cx = m.x, cz = m.z): Rect[] => icColliders(m).map(r => ({ x0: r.x0 - cx, x1: r.x1 - cx, z0: r.z0 - cz, z1: r.z1 - cz }));
/** every ground-floor room of a building, relative to the building centre (upper AVM floors: content/avm-kat.ts katEngel) */
export const icBinaCollidersLocal = (bina: string, cx: number, cz: number): Rect[] => icBina(bina).filter(m => !m.kat).flatMap(m => icCollidersLocal(m, cx, cz));
/** bank teller window: bank ops work here too */
export function bankaGise(): { x: number; z: number } { const m = IC_BY_ID.banka; return icWorld(m, 0, -icDim(m).D / 2 + 2.6); }

/* ---------- personel geometrisi (2026-11-21 görsel mantık denetimi) ----------
 * Kullanıcı: "kafeye girince çalışanlar tezgâhın arasında kağıt gibi sıkışmış". Tezgâh arkasındaki çalışan yeri, tezgâh
 * hattının ucu ve koridor derinliği tek yerden hesaplanır (sim/agents/kafe.ts ve tests/unit/ic-mekan-yerlesim.test.ts).
 * Çerçeve: a = tezgâh boyunca konum, b = tezgâhtan uzaklık (müşteri tarafı +, personel tarafı -). */
/** çalışan gövde yarıçapı (görsel karakter omuz genişliği ~0.44 m) */
export const PERSONEL_R = 0.22;
/** u/v dikdörtgeni (kapı çerçevesi) */
export function icItemRect(i: IcItem): { u0: number; u1: number; v0: number; v1: number } {
  const sw = (i.ry || 0) % 2 ? i.d : i.w, sd = (i.ry || 0) % 2 ? i.w : i.d;
  return { u0: i.u - sw / 2, u1: i.u + sw / 2, v0: i.v - sd / 2, v1: i.v + sd / 2 };
}
/** zeminde duran, yürümeye engel olan öğe mi (tavan / duvar paneli / tezgâh üstü cihaz / zemin deseni değil) */
export function icZeminEngeli(i: IcItem): boolean {
  if (i.k === 'lamba' || i.k === 'zemin' || i.k === 'isikTavan' || i.k === 'kuyruk' || i.k === 'islakTabela') return false;
  if (i.y !== undefined && i.y >= 0.9) return false;   // tezgâh üstü (1.05) ya da duvara asılı
  return true;
}
export interface PersonelGeo { tz: IcItem; vert: boolean; arka: number; cu: number; endU: number; lo: number; hi: number }
/** tezgâhlı işletme odasında personelin durduğu bant: arka = tezgâh merkezinden personel noktasına uzaklık */
export function personelGeo(m: IcMekan): PersonelGeo | null {
  const lay = icLayout(m), tz = lay.find(i => i.k === 'tezgah'); if (!tz) return null;
  const vert = (tz.ry || 0) % 2 === 1, arka = tz.d / 2 + 0.36;
  // tezgâh hattına bitişik zemin öğeleri (vitrin dolabı vb.) hattı uzatır: personel ucun ötesinden dolaşır, içinden geçmez
  const along = (i: IcItem) => { const r = icItemRect(i); return vert ? [r.v0, r.v1] : [r.u0, r.u1]; };
  const off = (i: IcItem) => (vert ? i.u - tz.u : i.v - tz.v);
  let a0 = vert ? tz.v - tz.w / 2 : tz.u - tz.w / 2, a1 = vert ? tz.v + tz.w / 2 : tz.u + tz.w / 2;
  for (const i of lay) if (i !== tz && icZeminEngeli(i) && Math.abs(off(i)) < 0.3) { const [x0, x1] = along(i); if (x1 >= a1 - 0.05 && x0 <= a1 + 0.3) a1 = Math.max(a1, x1); if (x0 <= a0 + 0.05 && x1 >= a0 - 0.3) a0 = Math.min(a0, x0); }
  const cu = vert ? a0 + 0.3 : tz.u - tz.w / 2 + 1.0, endU = a1 + 0.55;
  return { tz, vert, arka, cu, endU, lo: cu + 0.2, hi: a1 - 0.4 };
}
/**
 * 2026-11-22 mantık denetimi (kırtasiyede kasiyer + iki komi 0.3 m arayla iç içe, AVM dükkânlarında omuz omuza 0.5 m):
 * tezgâh arkasındaki personel duraklarının tezgâh boyunca konumları (a ekseni). Sığarsa eski düzen (ilk durak `cu + 0.6/1.5`,
 * aralık `post`); sığmıyorsa duraklar tezgâh hattının içine eşit yayılır, en az `PERSONEL_MIN_ARA` m arayla.
 */
export const PERSONEL_MIN_ARA = 0.6;
export function personelDuraklari(pg: PersonelGeo, n: number, post: number, narrow: boolean): number[] {
  const base = pg.cu + (pg.vert ? 0.6 : 1.5);
  if (n <= 1) return [base];
  if (!pg.vert && !narrow) return Array.from({ length: n }, (_, i) => base + i * post);
  const lo = pg.vert ? pg.cu : pg.cu + 0.5, hi = pg.vert ? pg.endU - 0.85 : pg.endU - 0.6;
  const s = Math.min(pg.vert ? 0.75 : 1.4, Math.max(PERSONEL_MIN_ARA, post, (hi - lo) / (n - 1)));
  const a0 = Math.max(lo, Math.min(base, hi - s * (n - 1)));
  return Array.from({ length: n }, (_, i) => a0 + i * s);
}
/** oda içinde u/v çerçevesinde engelden kaçan yol (ızgara A*, 0.15 m, sonra görüş hattıyla sadeleştirilir). Duvarlar ve zemin
 *  eşyaları `rad` kadar şişirilir. Başlangıç / hedef bir engele değiyorsa en yakın boş hücreden başlar. Izgara oda başına bir kez kurulur. */
const yolCache = new Map<string, { u: number; v: number }[]>();
interface YolIzgara { nu: number; nv: number; W: number; D: number; ok: Uint8Array }
const izgaraCache = new Map<string, YolIzgara>();
const YS = 0.15;
function yolIzgara(m: IcMekan, rad: number, stage: number): YolIzgara {
  const key = `${m.id}|${m.wx}|${stage}|${rad}`; let g = izgaraCache.get(key); if (g) return g;
  const { W, D } = icDim(m), t = IC_DUVAR;
  const rs: { u0: number; u1: number; v0: number; v1: number }[] = [
    { u0: -W / 2, u1: -W / 2 + t, v0: -D / 2, v1: D / 2 }, { u0: W / 2 - t, u1: W / 2, v0: -D / 2, v1: D / 2 }, { u0: -W / 2, u1: W / 2, v0: -D / 2, v1: -D / 2 + t },
    { u0: -W / 2, u1: -IC_KAPI / 2, v0: D / 2 - t, v1: D / 2 }, { u0: IC_KAPI / 2, u1: W / 2, v0: D / 2 - t, v1: D / 2 },
    ...icLayout(m, stage).filter(i => icZeminEngeli(i) && (i.asama ?? 0) <= stage).map(icItemRect)];
  const nu = Math.ceil(W / YS), nv = Math.ceil((D + 3) / YS), ok = new Uint8Array(nu * nv);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const u = -W / 2 + (i + 0.5) * YS, v = -D / 2 + (j + 0.5) * YS; let f = 1;
    for (const r of rs) if (u > r.u0 - rad && u < r.u1 + rad && v > r.v0 - rad && v < r.v1 + rad) { f = 0; break; }
    ok[j * nu + i] = f;
  }
  g = { nu, nv, W, D, ok }; izgaraCache.set(key, g); return g;
}
export function icYol(m: IcMekan, from: { u: number; v: number }, to: { u: number; v: number }, rad = 0.2, stage = 10): { u: number; v: number }[] {
  const key = `${m.id}|${m.wx}|${stage}|${from.u.toFixed(2)},${from.v.toFixed(2)}|${to.u.toFixed(2)},${to.v.toFixed(2)}|${rad}`;
  const hit = yolCache.get(key); if (hit) return hit.slice();
  const G = yolIzgara(m, rad, stage), { nu, nv, W, D, ok } = G;
  const ci = (u: number) => Math.floor((u + W / 2) / YS), cj = (v: number) => Math.floor((v + D / 2) / YS);
  const free = (u: number, v: number) => { const i = ci(u), j = cj(v); return i >= 0 && j >= 0 && i < nu && j < nv && ok[j * nu + i] === 1; };
  const los = (a: { u: number; v: number }, b: { u: number; v: number }) => { const n = Math.ceil(Math.hypot(b.u - a.u, b.v - a.v) / 0.05); for (let k = 0; k <= n; k++) if (!free(a.u + (b.u - a.u) * k / n, a.v + (b.v - a.v) * k / n)) return false; return true; };
  const cu = (i: number) => -W / 2 + (i + 0.5) * YS, cv = (j: number) => -D / 2 + (j + 0.5) * YS;
  const cell = (p: { u: number; v: number }) => {
    const i0 = ci(p.u), j0 = cj(p.v); let bi = -1, bd = 1e9;
    for (let r = 0; r < 10 && bi < 0; r++) for (let i = i0 - r; i <= i0 + r; i++) for (let j = j0 - r; j <= j0 + r; j++) { if (i < 0 || j < 0 || i >= nu || j >= nv || !ok[j * nu + i]) continue; const d = Math.hypot(cu(i) - p.u, cv(j) - p.v); if (d < bd) { bd = d; bi = j * nu + i; } }
    return bi;
  };
  let out: { u: number; v: number }[] = [to];
  const s0 = cell(from), g0 = cell(to);
  if (s0 >= 0 && g0 >= 0 && !los(from, to)) {
    const N = nu * nv, gs = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    const gi = g0 % nu, gj = Math.floor(g0 / nu), h = (k: number) => { const di = Math.abs(k % nu - gi), dj = Math.abs(Math.floor(k / nu) - gj); return Math.max(di, dj) + 0.4142 * Math.min(di, dj); };
    // binary heap on f = g + h
    const hk: number[] = [], hf: number[] = [];
    const push = (k: number, f: number) => { let i = hk.length; hk.push(k); hf.push(f); while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; [hk[p], hk[i]] = [hk[i], hk[p]]; [hf[p], hf[i]] = [hf[i], hf[p]]; i = p; } };
    const pop = () => { const k = hk[0], lk = hk.pop()!, lf = hf.pop()!; if (hk.length) { hk[0] = lk; hf[0] = lf; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m2 = i; if (l < hk.length && hf[l] < hf[m2]) m2 = l; if (r < hk.length && hf[r] < hf[m2]) m2 = r; if (m2 === i) break; [hk[m2], hk[i]] = [hk[i], hk[m2]]; [hf[m2], hf[i]] = [hf[i], hf[m2]]; i = m2; } } return k; };
    gs[s0] = 0; push(s0, h(s0));
    while (hk.length) {
      const k = pop(); if (k === g0) break; if (done[k]) continue; done[k] = 1;
      const i = k % nu, j = Math.floor(k / nu);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue; const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nu || jj >= nv) continue;
        const n = jj * nu + ii; if (done[n] || !ok[n] || (di && dj && (!ok[j * nu + ii] || !ok[jj * nu + i]))) continue;
        const c = gs[k] + (di && dj ? 1.4142 : 1); if (c < gs[n]) { gs[n] = c; prev[n] = k; push(n, c + h(n)); }
      }
    }
    if (prev[g0] >= 0 || g0 === s0) {
      const raw: { u: number; v: number }[] = []; for (let k = g0; k >= 0; k = prev[k]) raw.unshift({ u: cu(k % nu), v: cv(Math.floor(k / nu)) });
      raw.unshift(from); raw.push(to);
      out = []; let a = 0;
      while (a < raw.length - 1) { let b = raw.length - 1; while (b > a + 1 && !los(raw[a], raw[b])) b--; out.push(raw[b]); a = b; }
    }
  }
  if (yolCache.size > 400) yolCache.clear();   // keys carry positions: keep the cache bounded
  yolCache.set(key, out); return out.slice();
}

/* ---------- pass pencereleri ----------
 * 2026-11-25 ters U: servis koridorları kalktı. Üç pass aynı U tezgâhın üstünde: 'on' orta (avlu ve büfe önü masaları), 'W' ve 'E'
 * kanat başlarında (aşama 6 / 7). Tabak hangi kanadın masasına gidiyorsa o pass'a konur; aşçı mutfak tarafından, garson salon tarafından. */
export type PassYer = 'on' | 'W' | 'E';
const MUTFAK_SALON_MIN = 3;
/** o aşamada bu pass var mı (ön pass mutfakla aşama 3'te, batı kanadı 6, doğu kanadı 7) */
export const passAcik = (yer: PassYer, stage: number): boolean => (yer === 'on' ? stage >= MUTFAK_SALON_MIN : kanatAcikMi(yer, stage));
/** aşçının tabağı bıraktığı nokta (mutfak u,v çerçevesi; kanat pass'ları odanın uçlarının dışında) */
export function passAsciUV(yer: PassYer): [number, number] {
  return yer === 'on' ? MUTFAK_NOKTA.passAsci : [PASS_X[yer] - IC_BY_ID.mutfak.x, MUTFAK_NOKTA.passAsci[1]];
}
/** garsonun tabağı aldığı nokta (dünya) */
export function passGarsonNokta(yer: PassYer): { x: number; z: number } {
  return yer === 'on' ? mutfakDunya(MUTFAK_NOKTA.passGarson) : { x: PASS_X[yer], z: PASS_Z + 0.8 };
}
/** mutfak personelinin alanı: dar yerde karşılaşan iki kişi itişmez */
export const mutfakPersonelAlani = (p: { x: number; z: number }, stage: number): boolean =>
  icIcinde(mutfakOda(stage), p, 0);
/** 2026-11-25: aletin önünde durulan nokta (dünya): kare aletin yerinde, oyuncu buradan kullanır */
export function icItemOn(m: IcMekan, i: IcItem, bosluk = 0.55): { x: number; z: number } {
  const r = i.ry || 0, d = i.d / 2 + bosluk;
  return icWorld(m, i.u + (r === 1 ? d : r === 3 ? -d : 0), i.v + (r === 0 ? d : r === 2 ? -d : 0));
}
