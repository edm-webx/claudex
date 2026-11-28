/**
 * Martıköy İlkokulu'nun yaşamı (2026-11-28 sahip: "okul da içine girilebilecek, sınıflar olacak, müdür olacak, her şeyi yapmamız gerekiyor").
 * Oyuncu okul diyarındayken (content/realm.ts 'okul') gerçek, yürüyen aktörler:
 *  - öğrenciler (4 sınıf): 08:00 bahçe kapısından gelir, meydanda sınıf sınıf sıraya girer (08:30 tören, müdür konuşur), zille
 *    sınıfa geçip sırasına oturur (bazıları parmak kaldırır); fen laboratuvarı ve müzik atölyesine sırayla giderler (DERS_YERI);
 *    teneffüste koridorda / kütüphanede / sınıfta sohbet, öğle arasında bahçede basket, seksek, kovalamaca, salıncak, çeşme;
 *    14:50 zil, kapıdan çıkıp giderler.
 *  - sınıf öğretmenleri tahtada anlatır, sıraların arasında dolaşır; sınıfı başka derslikteyken öğretmenler odasında çay içer.
 *    Fen ve müzik öğretmeni kendi dersliğinde. Teneffüste bir nöbetçi öğretmen koridorda.
 *  - müdür masasında; derste koridor turu atar, sınıf kapılarına bakar; törende meydanda. Oyuncu misafir koltuğunun önüne gelince konuşur.
 *  - müdür yardımcısı, sekreter, hemşire, kütüphaneci, hizmetli (koridoru süpürür, okul dağılınca sınıfları); arada bir veli müdüre gelir.
 * Zil: program geçişlerinde 'okulZil' (oyuncu okuldaysa her yerden, karşı yakadaki okulun önündeyse konumlu).
 * Ekonomiyle ilişkisi yok (para, sayaç yazmaz; kantin satışları sim/agents/kafe.ts). Deterministik (kendi rng akışı). Saf sim.
 */
import type { System, SimCtx } from '../../../engine/api';
import type { AgentEnv } from './env';
import type { Actor } from './types';
import { IC_BY_ID, icWorld, icDim, icLayout, icUV, icYol, type IcItem } from '../../../content/ic-mekan';
import {
  OKUL, OKUL_OX, KOR, SINIR, OKUL_DIS, OKUL_ODA_BY_ID, SINIF_ODA, ZIL_FAZ,
  okulProgram, dersOdasi, okulYol, okulOdaAt, odaKapiOnu, type OkulFaz,
} from '../../../content/okul-ic';
import { sinifSiralar } from '../../../content/okul-yerlesim';
import { realmAt } from '../../../content/realm';

type Pt = { x: number; z: number };
/** varılacak nokta: konum, bakış (rot), hareket, süre aralığı; y: oturma yüksekliği (yatak) */
interface Yer { p: Pt; rot: number; act: string; y?: number; key?: string }
interface Hedef extends Yer { sn: [number, number]; say?: string; hiz?: number }
type Plan = (k: Kisi, faz: OkulFaz, ders: number) => Hedef | null;
interface Kisi { a: Actor; ad: string; path: Pt[]; st: 'yol' | 'dur' | 'cik'; t: number; dur: number; h: Hedef | null; faz: string; plan: Plan; i: number; sinif?: string; no?: number; gel: number; git: number; tutulan?: string; kadroI?: number; lane: number }

const CX = OKUL_OX;
const L = (x: number) => CX + x;
const KAPI_DIS: Pt = { x: CX, z: SINIR.z0 - 1.6 };   // çit kapısının dışı (gelen burada belirir, giden burada kaybolur)
const SINIFLAR = ['1-A', '2-A', '3-A', '4-A'];
export const SINIF_MEVCUT = 7;
const SP = 1.3, SP_COCUK = 1.5, SP_KOS = 2.6;

/* ---------- oda koordinatları (kapı çerçevesi: u kapı duvarı boyunca, v içeri, kapı v = +D/2) ---------- */
const oda = (id: string) => IC_BY_ID[id];
const W = (id: string, u: number, v: number): Pt => icWorld(oda(id), u, v);
/** odada (fu, fv) yönüne bakış -> dünya rot */
const yon = (id: string, fu: number, fv: number) => { const m = oda(id), a = icWorld(m, 0, 0), b = icWorld(m, fu, fv); return Math.atan2(b.x - a.x, b.z - a.z); };
const esya = (id: string, k: string, n = 0): IcItem | undefined => icLayout(oda(id)).filter(i => i.k === k)[n];
const Y = (id: string, u: number, v: number, fu: number, fv: number, act: string, o: Partial<Yer> = {}): Yer => ({ p: W(id, u, v), rot: yon(id, fu, fv), act, key: id + ':' + u.toFixed(2) + ',' + v.toFixed(2), ...o });
const bak = (from: Pt, to: Pt) => Math.atan2(to.x - from.x, to.z - from.z);

/** sınıf sıraları: her sırada iki öğrenci, tahtaya bakar (v -) */
function sinifKoltuk(id: string): Yer[] {
  const { W: w } = icDim(oda(id)), { cols, rows } = sinifSiralar(w), o: Yer[] = [];
  for (const v of rows) for (const u of cols) for (const s of [-0.275, 0.275]) o.push(Y(id, u + s, v + 0.45, 0, -1, 'sit'));
  // önden arkaya, ortadan kenara dolsun: aynı sınıf mevcudu her derslikte ön sıralarda toplanır
  return o;
}
function fenYer(): Yer[] {
  const id = 'okul_fen', o: Yer[] = [];
  for (let n = 0; n < 4; n++) { const m = esya(id, 'labMasa', n); if (!m) continue; for (const du of [-0.7, 0.7]) { o.push(Y(id, m.u + du, m.v + (m.v < 0 ? -0.85 : 0.85), 0, m.v < 0 ? 1 : -1, 'serve')); } }
  for (let n = 0; n < 4; n++) { const m = esya(id, 'labMasa', n); if (!m) continue; for (const du of [-0.7, 0.7]) { o.push(Y(id, m.u + du, m.v + (m.v < 0 ? 0.85 : -0.85), 0, m.v < 0 ? -1 : 1, 'serve')); } }
  return o;
}
function muzikYer(): Yer[] {
  const id = 'okul_muzik', o: Yer[] = [], pi = esya(id, 'piyano'), hoca = pi ? W(id, pi.u + 0.9, pi.v + 0.9) : W(id, 0, -2);
  for (const u of [-1.6, -0.6, 0.4, 1.4, 2.4]) { const p = W(id, u, -1.7); o.push({ p, rot: bak(p, hoca), act: 'talk', key: id + ':sarki' + u }); }   // şarkı söyleyenler piyanoya döner
  const rm = esya(id, 'resimMasa'); if (rm) for (const u of [-0.8, 0, 0.8]) { o.push(Y(id, rm.u + u, rm.v - 0.95, 0, 1, 'serve'), Y(id, rm.u + u, rm.v + 0.95, 0, -1, 'serve')); }
  for (let n = 0; n < 3; n++) { const s = esya(id, 'sehpa', n); if (s) o.push(Y(id, s.u, s.v - 0.6, 0, 1, 'serve')); }
  return o;
}
/** masanın arkasındaki oturma yeri (ry: 0 +v'ye, 1 +u'ya, 2 -v'ye, 3 -u'ya bakar; oturan masanın arkasında aynı yöne bakar) */
function masaArkasi(id: string, k: string, n = 0, geri = 0.35): Yer {
  const m = esya(id, k, n) || { u: 0, v: 0, d: 0.7, ry: 0 } as IcItem, f = [[0, 1], [1, 0], [0, -1], [-1, 0]][(m.ry || 0) % 4], g = m.d / 2 + geri;
  return Y(id, m.u - f[0] * g, m.v - f[1] * g, f[0], f[1], 'sit');
}
/** eşyanın önünde ayakta (dolap, fotokopi, raf): eşyanın baktığı tarafta, ona dönük */
function onunde(id: string, k: string, n: number, act: string, mesafe = 0.45): Yer {
  const m = esya(id, k, n) || { u: 0, v: 0, d: 0.5, ry: 0 } as IcItem, f = [[0, 1], [1, 0], [0, -1], [-1, 0]][(m.ry || 0) % 4], g = m.d / 2 + mesafe;
  return Y(id, m.u + f[0] * g, m.v + f[1] * g, -f[0], -f[1], act);
}

/* ---------- açık alan noktaları (dünya) ---------- */
/** tören sırası: her sınıf bir kolon, binaya sırtı dönük bayrağa / müdüre bakar */
const SIRA_X = [-4.2, -1.4, 1.4, 4.2];
const siraYer = (s: number, n: number): Yer => ({ p: { x: L(SIRA_X[s]), z: 34.6 + n * 0.75 }, rot: Math.PI, act: 'idle' });
const KURSU: Yer = { p: { x: CX, z: 32.3 }, rot: 0, act: 'perform' };
const BAHCE_SERIT = 64.8;   // bahçede yatay geçiş hattı (potaların, bankların ve oyun parkının arasında boş)
const SAHA = { x0: L(-16.5), x1: L(-7.5), z0: 65.6, z1: 77.8 };
const KOSU = { x0: L(-3.4), x1: L(3.4), z0: 66.4, z1: 77 };
const BAHCE: (Yer & { tur: string })[] = [
  ...[[-14, 68], [-10, 68], [-12, 70.6], [-13.6, 74], [-10.4, 74], [-12, 76.6]].map(([x, z]) => ({ p: { x: L(x), z }, rot: bak({ x: L(x), z }, { x: L(-12), z: 71.5 }), act: 'cheer', tur: 'basket' })),
  { p: { x: L(1.5), z: 65.4 }, rot: 0, act: 'dance', tur: 'seksek' }, { p: { x: L(1.5), z: 66.7 }, rot: 0, act: 'dance', tur: 'seksek' },
  { p: { x: L(8.6), z: 68.3 }, rot: Math.PI, act: 'cheer', tur: 'park' }, { p: { x: L(10.4), z: 68.3 }, rot: Math.PI, act: 'cheer', tur: 'park' },
  { p: { x: L(12.2), z: 73 }, rot: -Math.PI / 2, act: 'cheer', tur: 'park' }, { p: { x: L(16), z: 69.7 }, rot: Math.PI, act: 'cheer', tur: 'park' },
  { p: { x: L(18.6), z: 73.4 }, rot: -Math.PI / 2, act: 'sit', tur: 'park' }, { p: { x: L(18.6), z: 74.6 }, rot: -Math.PI / 2, act: 'sit', tur: 'park' },
  { p: { x: L(-5.6), z: 70 }, rot: Math.PI / 2, act: 'talk', tur: 'sohbet' }, { p: { x: L(-4.6), z: 70 }, rot: -Math.PI / 2, act: 'talk', tur: 'sohbet' },
  { p: { x: L(-0.8), z: 72.3 }, rot: Math.PI / 2, act: 'talk', tur: 'sohbet' }, { p: { x: L(0.2), z: 72.3 }, rot: -Math.PI / 2, act: 'talk', tur: 'sohbet' },
  { p: { x: L(0), z: 79.75 }, rot: 0, act: 'sip', tur: 'cesme' },
].map(b => ({ ...b, key: 'bahce:' + b.p.x.toFixed(1) + ',' + b.p.z }));
/** koridorda ikişerli sohbet köşeleri (dolapların, su sebilinin, saksıların yanından uzak) */
const KOR_SOHBET: Yer[] = [-20.5, -12.5, -5.5, 5.5, 12.5, 20.5].flatMap((x, i) => {
  const z = i % 2 ? KOR.z0 + 0.75 : KOR.z1 - 0.75;
  return [{ p: { x: L(x - 0.38), z }, rot: Math.PI / 2, act: 'talk', key: 'kor:' + x + 'a' }, { p: { x: L(x + 0.38), z }, rot: -Math.PI / 2, act: 'talk', key: 'kor:' + x + 'b' }];
});
const NOBET: Yer = { p: { x: CX, z: KOR.zm }, rot: 0, act: 'idle' };
const SOZ_TENEFFUS = ['Ebe sensin!', 'Top bende!', 'Teneffüs bitmesin!', 'Yarın maç var mı?', 'Kantinden tost alalım!', 'Ödevi yaptın mı?'];
const SOZ_DERS = ['Öğretmenim!', 'Ben söyleyebilir miyim?', 'Bitti öğretmenim!'];
const SOZ_HOCA = ['Defterlerinizi açın.', 'Sessiz olalım çocuklar.', 'Bunu kim biliyor?', 'Aferin, çok güzel!', 'Tahtaya bakalım.'];
const SOZ_INGILIZCE = ['Good morning, class!', 'Repeat after me!', 'Open your books, please.', 'Well done!'];
const SOZ_MUDUR = ['Koridorda koşmak yok çocuklar!', 'Günaydın, kolay gelsin.', 'Her şey yolunda mı hocam?'];
const SOZ_MUDUR_OYUNCU = [
  'Hoş geldiniz! Okulumuz 1954\'ten beri Martıköy\'ün çocuklarını yetiştiriyor.',
  'Kantinimiz sizin elinizde, çocuklara sağlıklı şeyler satın lütfen.',
  'Ders saatinde koridorda sessiz olalım, çocuklar sınıfta.',
  'Bahçemizi yeniledik, teneffüste çocuklar orada oynuyor.',
];

export interface OkulYasamSystem extends System {
  /** test / araç: aktif kişiler */
  rows(): { key: string; ad: string; sinif?: string; st: string; x: number; z: number; act: string; oda: string | null }[];
  count(): number;
}

export function createOkulYasam(env: AgentEnv): OkulYasamSystem {
  const rng = env.rng('okul-yasam');
  const ks: Kisi[] = [], tutulu = new Set<string>(), gitti = new Set<number>();   // gitti: bugün okuldan çıkmış kadro (yeniden doğmasın)
  let icerde = false, n = 0, sonI = -1, veliT = 20, mudurSoz = 0;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng.next() * xs.length)];
  const ara = (a: number, b: number) => a + rng.next() * (b - a);
  const h24 = () => ((env.host.hour() % 24) + 24) % 24;
  const H = (y: Yer, sn: [number, number], o: Partial<Hedef> = {}): Hedef => ({ ...y, sn, ...o });

  /* ---------- yol: bina içi okulYol, oda içi icYol (sıraların arasından), bahçede serit ---------- */
  const bahcede = (p: Pt) => p.z > OKUL.z1 + 0.5;
  const icinde = (r: { x0: number; x1: number; z0: number; z1: number }, p: Pt) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1;
  function odaIci(from: Pt, to: Pt): Pt[] {
    const o = okulOdaAt(from); if (!o || okulOdaAt(to) !== o) return [to];
    const m = oda(o.id); return icYol(m, icUV(m, from.x, from.z), icUV(m, to.x, to.z), 0.2).map(q => icWorld(m, q.u, q.v));
  }
  /** lane: koridor orta hattından yana kayma (herkes tek sıra tren gibi yürümesin) */
  function yol(a: Pt, b: Pt, lane = 0): Pt[] {
    const kaba = okulYol(a, b), out: Pt[] = [];
    let cur = a;
    for (const q of kaba) {
      if (bahcede(cur) && bahcede(q) && !(icinde(SAHA, cur) && icinde(SAHA, q)) && !(icinde(KOSU, cur) && icinde(KOSU, q))) {
        out.push({ x: cur.x, z: BAHCE_SERIT }, { x: q.x, z: BAHCE_SERIT }, q);
      } else out.push(...odaIci(cur, q));
      cur = q;
    }
    if (lane) for (let i = 0; i < out.length; i++) if (Math.abs(out[i].z - KOR.zm) < 1e-6) out[i] = { x: out[i].x, z: KOR.zm + lane };
    return out.filter((p, i) => Math.hypot(p.x - (i ? out[i - 1].x : a.x), p.z - (i ? out[i - 1].z : a.z)) > 0.04);
  }

  /* ---------- kişiler ---------- */
  function kur(rig: Record<string, unknown>, ad: string, plan: Plan, gel: number, git: number, o: Partial<Kisi> = {}): Kisi {
    const a = env.reg.add('sakin', 'okul-' + n++, rig, KAPI_DIS, { name: ad, okul: true });
    const k: Kisi = { a, ad, path: [], st: 'dur', t: 0, dur: 0, h: null, faz: '', plan, i: 0, gel, git, lane: ((n * 37) % 13) / 12 * 1.8 - 0.9, ...o };
    ks.push(k); return k;
  }
  const worker = (role: string, seed: number, apron?: string) => ({ kind: 'worker', role, seed, look: { lookSeed: seed, ...(apron ? { apronText: apron } : {}) } });
  const cocuk = (seed: number) => ({ kind: 'regular', look: { lookType: 'okul', lookSeed: seed }, seed });
  const birak = (k: Kisi) => { if (k.tutulan) { tutulu.delete(k.tutulan); k.tutulan = undefined; } };
  /** boş yer seç (tutulmamış); yoksa null */
  const bos = <T extends Yer>(xs: readonly T[]): T | null => { const c = xs.filter(x => !x.key || !tutulu.has(x.key)); return c.length ? c[Math.floor(rng.next() * c.length)] : null; };
  function hedefle(k: Kisi, h: Hedef | null) {
    birak(k);
    if (!h) { k.h = null; k.st = 'dur'; k.dur = 1; k.t = 0; return; }
    if (h.key) { tutulu.add(h.key); k.tutulan = h.key; }
    k.h = h; k.path = Math.hypot(h.p.x - k.a.x, h.p.z - k.a.z) < 0.1 ? [] : yol(k.a, h.p, k.lane); k.st = 'yol'; k.t = 0; k.a.y = 0;
  }
  function cikar(k: Kisi) { birak(k); k.h = null; k.st = 'cik'; k.a.y = 0; k.path = [...yol(k.a, { x: CX, z: SINIR.z0 + 1.0 }, k.lane), KAPI_DIS]; }
  function sil(k: Kisi, cikti = false) { birak(k); if (cikti && k.kadroI !== undefined) gitti.add(k.kadroI); env.reg.remove(k.a); ks.splice(ks.indexOf(k), 1); }

  /* ---------- planlar ---------- */
  const koltukCache = new Map<string, Yer[]>();
  const derslikYer = (id: string): Yer[] => { let c = koltukCache.get(id); if (!c) { c = id === 'okul_fen' ? fenYer() : id === 'okul_muzik' ? muzikYer() : sinifKoltuk(id); koltukCache.set(id, c); } return c; };
  const ogretmenOda = { sandalye: [] as Yer[], cay: null as Yer | null };
  function ogretmenOdaYer() {
    if (ogretmenOda.cay) return ogretmenOda;
    const id = 'okul_ogretmen', m = esya(id, 'toplantiMasa');
    if (m) for (const du of [-1.2, 0, 1.2]) ogretmenOda.sandalye.push(Y(id, m.u + du, m.v - m.d / 2 - 0.35, 0, 1, 'sit'), Y(id, m.u + du, m.v + m.d / 2 + 0.35, 0, -1, 'sit'));
    ogretmenOda.cay = onunde('okul_ogretmen', 'cayOcak', 0, 'pour', 0.4);
    return ogretmenOda;
  }
  const ogretmenlerOdasi = (k: Kisi): Hedef => {
    const o = ogretmenOdaYer(), r = rng.next();
    if (r < 0.25 && o.cay && !tutulu.has(o.cay.key!)) return H(o.cay, [4, 6]);
    const s = bos(o.sandalye); return s ? H({ ...s, act: rng.next() < 0.3 ? 'sip' : 'sit' }, [10, 18]) : H(Y('okul_ogretmen', 1.6, 1.4, 0, -1, 'idle'), [6, 9]);
  };

  /** öğrenci: sınıf s, sıra no (0..) */
  const ogrenciPlan: Plan = (k, faz, ders) => {
    const s = k.sinif!, no = k.no!, si = SINIFLAR.indexOf(s);
    if (faz === 'giris') return H({ ...siraYer(si, no), act: rng.next() < 0.6 ? 'talk' : 'idle', rot: rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2 }, [3, 6]);
    if (faz === 'toren') return H(siraYer(si, no), [6, 10]);
    if (faz === 'ders') {
      const yer = dersOdasi(s, ders), y = derslikYer(yer)[no] ?? derslikYer(yer)[0];
      const el = yer !== 'okul_muzik' && yer !== 'okul_fen' && rng.next() < 0.12;
      return H({ ...y, act: el ? 'wave' : y.act }, el ? [2.5, 3.5] : [8, 16], el && rng.next() < 0.5 ? { say: pick(SOZ_DERS) } : {});
    }
    if (faz === 'teneffus' || faz === 'ogle') {
      const r = rng.next(), uzun = faz === 'ogle';   // teneffüs kısa (~13 sn): bahçeye yalnız öğle arasında çıkılır
      const kendi = SINIF_ODA[s];
      if (uzun && r < 0.62) {
        if (rng.next() < 0.3) { const p = { x: ara(KOSU.x0, KOSU.x1), z: ara(KOSU.z0, KOSU.z1) }; return H({ p, rot: 0, act: 'cheer' }, [0.4, 1.2], { hiz: SP_KOS, say: rng.next() < 0.15 ? pick(SOZ_TENEFFUS) : undefined }); }
        const b = bos(BAHCE); if (b) return H(b, b.tur === 'basket' ? [2, 4] : [6, 12], { hiz: b.tur === 'basket' ? SP_KOS : SP_COCUK, say: rng.next() < 0.12 ? pick(SOZ_TENEFFUS) : undefined });
      }
      if (r < 0.75 || (!uzun && r < 0.5)) { const c = bos(KOR_SOHBET); if (c) return H(c, [5, 9], { say: rng.next() < 0.1 ? pick(SOZ_TENEFFUS) : undefined }); }
      if (r < 0.85) { const id = 'okul_kutuphane', ms = [0, 1].flatMap(i => { const m = esya(id, 'okumaMasa', i); return m ? [-0.45, 0.45].flatMap(du => [Y(id, m.u + du, m.v - m.d / 2 - 0.35, 0, 1, 'sit'), Y(id, m.u + du, m.v + m.d / 2 + 0.35, 0, -1, 'sit')]) : []; }); const y = bos(ms); if (y) return H(y, [10, 16]); }
      if (r < 0.88) { const b = masaArkasi('okul_revir', 'bekleme', 0, -0.45); if (!tutulu.has(b.key!)) return H({ ...b, act: 'sit' }, [8, 12]); }
      const y = derslikYer(kendi)[no]; return H({ ...y, p: { x: y.p.x + 0.3, z: y.p.z + 0.35 }, act: 'talk', key: undefined }, [4, 8]);
    }
    return null;   // çıkış / kapalı: eve
  };

  /** sınıf öğretmeni: sınıfı kendi sınıfındaysa ders anlatır; fen / müzik dersindeyse öğretmenler odasında */
  function dersAnlat(k: Kisi, id: string, ingilizce = false): Hedef {
    const { D } = icDim(oda(id)), i = k.i++ % 5;
    if (id === 'okul_fen') { const d = esya(id, 'deneyMasa'); const y = d ? Y(id, d.u + (i % 2 ? 0.6 : -0.6), d.v + d.d / 2 + 0.45, 0, 1, 'perform') : Y(id, 0, -2, 0, 1, 'perform'); return H(y, [6, 10], i === 0 ? { say: 'Gözlüklerinizi takın, deneye başlıyoruz.' } : {}); }
    if (id === 'okul_muzik') { const pi = esya(id, 'piyano'); return H(pi ? Y(id, pi.u + 0.15, pi.v + pi.d / 2 + 0.35, 0, -1, i === 3 ? 'perform' : 'sit') : Y(id, -2, -2, 0, -1, 'sit'), [8, 14], i === 0 ? { say: 'Do re mi fa sol... Hep birlikte!' } : {}); }
    if (i === 3) { const { cols } = sinifSiralar(icDim(oda(id)).W); return H(Y(id, (cols[0] + cols[1]) / 2, 0.2 + ara(-0.6, 0.8), 0, -1, 'idle'), [3, 5]); }
    if (i === 4) { const o = esya(id, 'ogrSandalye'); return H(o ? Y(id, o.u, o.v, 0, 1, 'sit') : Y(id, -1.4, -D / 2 + 0.85, 0, 1, 'sit'), [5, 8]); }
    return H(Y(id, ara(-0.8, 1.2), -D / 2 + 0.75, 0, 1, 'perform'), [6, 10], i === 0 || rng.next() < 0.15 ? { say: pick(ingilizce ? SOZ_INGILIZCE : SOZ_HOCA) } : {});
  }
  const sinifOgretmeni = (s: string): Plan => (k, faz, ders) => {
    const si = SINIFLAR.indexOf(s);
    if (faz === 'giris' || faz === 'toren') return H({ p: { x: L(SIRA_X[si] + 0.95), z: 34.1 }, rot: Math.PI, act: 'idle' }, [6, 10]);
    if (faz === 'ders') { const yer = dersOdasi(s, ders); return yer === SINIF_ODA[s] ? dersAnlat(k, yer, s === '3-A') : ogretmenlerOdasi(k); }
    if ((faz === 'teneffus' || faz === 'ogle') && SINIFLAR[(ders + (faz === 'ogle' ? 1 : 0)) % 4] === s) return H({ ...NOBET, p: { x: CX + (faz === 'ogle' ? 0 : ara(-3, 3)), z: faz === 'ogle' ? OKUL.z1 + 1.6 : KOR.zm } }, [6, 10]);   // nöbetçi
    return ogretmenlerOdasi(k);
  };
  const bransOgretmeni = (id: string): Plan => (k, faz, ders) => {
    if (faz === 'ders' && SINIFLAR.some(s => dersOdasi(s, ders) === id)) return dersAnlat(k, id);
    if (faz === 'giris' || faz === 'toren' || faz === 'ders') return id === 'okul_fen' && faz === 'ders' ? H(onunde(id, 'deneyMasa', 0, 'serve'), [8, 12]) : ogretmenlerOdasi(k);
    return ogretmenlerOdasi(k);
  };
  const MUDUR_KOLTUK = (): Yer => masaArkasi('okul_mudur', 'mudurMasa', 0, 0.35);
  const mudurPlan: Plan = (k, faz) => {
    const i = k.i++;
    if (faz === 'toren') return H(KURSU, [8, 12], i % 2 ? { say: 'Günaydın çocuklar! İstiklal Marşı\'na hazır ol!' } : {});
    if (faz === 'ders' && i % 4 === 2) { const o = OKUL_ODA_BY_ID[pick(['okul_1a', 'okul_2a', 'okul', 'okul_4a', 'okul_muzik', 'okul_fen'])], p = odaKapiOnu(o); return H({ p, rot: o.on ? Math.PI : 0, act: 'idle' }, [3, 5]); }
    if (faz === 'teneffus' && i % 3 === 1) return H({ p: { x: L(-1.5), z: KOR.zm }, rot: Math.PI, act: 'idle' }, [5, 8], { say: pick(SOZ_MUDUR) });
    if (faz === 'ogle' && i % 3 === 0) return ogretmenlerOdasi(k);
    return H(MUDUR_KOLTUK(), [12, 22]);
  };
  const masaPlan = (oturak: () => Yer, isler: (() => Yer)[]): Plan => (k) => { const i = k.i++; return i % 4 === 3 && isler.length ? H(pick(isler)(), [4, 7]) : H(oturak(), [12, 20]); };
  const hizmetliPlan: Plan = (k, faz) => {
    const i = k.i++;
    if (faz === 'ders' || faz === 'giris' || faz === 'toren') return H({ p: { x: L(-21 + (i % 11) * 4.2), z: KOR.zm + (i % 2 ? 0.5 : -0.5) }, rot: i % 2 ? Math.PI / 2 : -Math.PI / 2, act: 'sweep' }, [5, 7]);
    if (faz === 'teneffus' || faz === 'ogle') return H({ p: { x: L(i % 2 ? -1.8 : 1.8), z: 43.2 }, rot: 0, act: 'sweep' }, [6, 8]);   // giriş holü
    const id = pick(['okul_1a', 'okul_2a', 'okul', 'okul_4a']); return H(Y(id, ara(-1, 1), 0.2, 0, -1, 'sweep'), [6, 9]);   // dağılınca sınıflar
  };
  const veliPlan: Plan = (k) => {
    const i = k.i++;
    if (i === 0) return H(onunde('okul_sekreter', 'sekreterMasa', 0, 'talk', 0.55), [3, 4], { say: 'Müdür bey müsait mi?' });
    if (i === 1) { const m = esya('okul_mudur', 'misafirKoltuk', 0); return H(m ? Y('okul_mudur', m.u, m.v + 0.05, 0, -1, 'sit') : Y('okul_mudur', -0.6, -0.5, 0, -1, 'sit'), [18, 30], { say: 'Kızımın notları nasıl hocam?' }); }
    return null;
  };

  /* ---------- kadro ---------- */
  function kadro(): { rig: Record<string, unknown>; ad: string; plan: Plan; gel: number; git: number; sinif?: string; no?: number }[] {
    const o: ReturnType<typeof kadro> = [];
    SINIFLAR.forEach((s, si) => { for (let no = 0; no < SINIF_MEVCUT; no++) o.push({ rig: cocuk(9100 + si * 37 + no * 5), ad: '', plan: ogrenciPlan, gel: 8 + ((no * 7 + si * 3) % 10) / 22, git: 14.85 + ((no * 5 + si) % 9) / 18, sinif: s, no }); });
    const og = ['Ayşe Öğretmen', 'Mehmet Öğretmen', 'Zeynep Öğretmen', 'Hasan Öğretmen'];
    SINIFLAR.forEach((s, si) => o.push({ rig: worker('ogretmen', 9200 + si * 11), ad: og[si], plan: sinifOgretmeni(s), gel: 7.85, git: 15.7 + si * 0.15 }));
    o.push({ rig: worker('ogretmen', 9260), ad: 'Fen Öğretmeni Selin', plan: bransOgretmeni('okul_fen'), gel: 7.9, git: 15.9 });
    o.push({ rig: worker('ogretmen', 9270), ad: 'Müzik Öğretmeni Kerem', plan: bransOgretmeni('okul_muzik'), gel: 7.95, git: 16.0 });
    o.push({ rig: worker('mudur', 9300), ad: 'Müdür Nevzat Bey', plan: mudurPlan, gel: 7.7, git: 16.6 });
    o.push({ rig: worker('mudur', 9310), ad: 'Müdür Yardımcısı Filiz Hanım', plan: masaPlan(() => masaArkasi('okul_sekreter', 'sekreterMasa', 1), [() => onunde('okul_sekreter', 'dosyaDolap', 0, 'grab'), () => ({ ...NOBET, p: { x: L(-13), z: KOR.zm } })]), gel: 7.8, git: 16.3 });
    o.push({ rig: worker('hostes', 9320), ad: 'Sekreter Gül Hanım', plan: masaPlan(() => masaArkasi('okul_sekreter', 'sekreterMasa', 0), [() => onunde('okul_sekreter', 'fotokopi', 0, 'serve'), () => onunde('okul_sekreter', 'dosyaDolap', 0, 'grab')]), gel: 7.9, git: 16.2 });
    o.push({ rig: worker('hemsire', 9330), ad: 'Hemşire Derya', plan: masaPlan(() => masaArkasi('okul_revir', 'sekreterMasa', 0, 0.3), [() => onunde('okul_revir', 'ilac', 0, 'grab'), () => onunde('okul_revir', 'lavabo', 0, 'serve')]), gel: 8, git: 16 });
    o.push({ rig: worker('ogretmen', 9340), ad: 'Kütüphaneci Nur Hanım', plan: masaPlan(() => masaArkasi('okul_kutuphane', 'sekreterMasa', 0, 0.3), [() => onunde('okul_kutuphane', 'kitaplik', 0, 'grab'), () => onunde('okul_kutuphane', 'kitaplik', 1, 'grab')]), gel: 8, git: 16 });
    o.push({ rig: worker('temizlik', 9350), ad: 'Hizmetli Cemile Abla', plan: hizmetliPlan, gel: 7.2, git: 17.2 });
    return o;
  }
  const KADRO = kadro();

  /* ---------- tick ---------- */
  const yuru = (a: Actor, path: Pt[], dt: number, sp: number): boolean => {
    let left = sp * dt;
    while (path.length && left > 0) {
      const to = path[0], dx = to.x - a.x, dz = to.z - a.z, d = Math.hypot(dx, dz);
      if (d < 1e-3) { path.shift(); continue; }
      const q = Math.min(1, left / d); a.x += dx * q; a.z += dz * q; a.rot = Math.atan2(dx, dz); left -= d * q;
      if (q < 1) break;
      path.shift();
    }
    a.speed = path.length ? sp : 0; a.act = path.length ? 'walk' : 'idle';
    return !path.length;
  };
  function sec(k: Kisi, faz: OkulFaz, ders: number) {
    k.faz = faz + ders;
    const h = k.plan(k, faz, ders);
    if (!h) { cikar(k); return; }
    hedefle(k, h);
  }
  function adim(k: Kisi, faz: OkulFaz, ders: number, dt: number) {
    const a = k.a; if (a.sayT > 0 && (a.sayT -= dt) <= 0) a.say = '';
    if (k.st === 'cik') { if (yuru(a, k.path, dt, k.sinif ? SP_COCUK : SP)) sil(k, true); return; }
    const degisti = k.faz !== faz + ders;
    if (k.st === 'yol') {
      if (degisti) { sec(k, faz, ders); return; }
      if (!yuru(a, k.path, dt, k.h?.hiz ?? (k.sinif ? SP_COCUK : SP))) return;
      const h = k.h!; k.st = 'dur'; k.t = 0; k.dur = ara(h.sn[0], h.sn[1]);
      a.speed = 0; a.act = h.act; a.rot = h.rot; a.y = h.y || 0;
      if (h.say) { a.say = h.say; a.sayT = 2.6; }
      return;
    }
    k.t += dt;
    if (degisti || k.t >= k.dur) sec(k, faz, ders);
  }
  /** oyuncu okula girince: o saatte okulda olması gerekenler zaten yerinde (kapıda belirip içeri koşmazlar) */
  function doldur(h: number, pr: ReturnType<typeof okulProgram>) {
    KADRO.forEach((t, ki) => {
      if (!(h >= t.gel && h < t.git) || gitti.has(ki)) return;
      const k = kur(t.rig, t.ad, t.plan, t.gel, t.git, { sinif: t.sinif, no: t.no, kadroI: ki });
      k.faz = pr.faz + pr.ders; const hd = t.plan(k, pr.faz, pr.ders);
      if (!hd) { sil(k, true); return; }
      hedefle(k, hd); k.a.x = k.a.px = hd.p.x; k.a.z = k.a.pz = hd.p.z; k.path = []; k.st = 'yol';
      k.t = 0;
    });
  }
  function temizle() { for (const k of [...ks]) sil(k); tutulu.clear(); }
  function zil(pr: ReturnType<typeof okulProgram>) {
    if (pr.i === sonI) return;
    const ilk = sonI < 0; sonI = pr.i;
    if (ilk || !ZIL_FAZ.has(pr.faz)) return;
    const p = env.player();
    if (realmAt(p.x)?.id === 'okul') env.emit('okulZil', { faz: pr.faz });
    else if (Math.hypot(p.x - OKUL_DIS.x, p.z - OKUL_DIS.z) < 40) env.emit('okulZil', { faz: pr.faz, x: OKUL_DIS.x, z: OKUL_DIS.z + 4 });
  }

  // oyuncu müdürün masasının önüne gelince müdür konuşur (misafir koltuklarının arası)
  {
    const m = oda('okul_mudur'), d = icDim(m), p = icWorld(m, 0, -d.D / 2 + 2.35);
    env.interactions.register({
      id: 'okulMudur', pos: p, radius: 0.7, kind: 'station', dwell: 0.8, interval: 6,
      canAct: () => icerde && ks.some(k => k.plan === mudurPlan && k.st === 'dur' && k.h?.act === 'sit' && Math.hypot(k.a.x - p.x, k.a.z - p.z) < 2),
      act: () => { env.host.heroSay('Müdür Nevzat Bey: ' + SOZ_MUDUR_OYUNCU[mudurSoz++ % SOZ_MUDUR_OYUNCU.length], 3.2); return 'done'; },
    });
  }

  return {
    id: 'okul-yasam', order: 49, phase: 'sim',
    step(ctx: SimCtx) {
      const dt = Math.min(ctx.dt, 0.25), p = env.player(), ic = realmAt(p.x)?.id === 'okul', h = h24(), pr = okulProgram(h);
      zil(pr);
      if (ic !== icerde) { icerde = ic; if (ic) doldur(h, pr); else temizle(); }
      if (!ic) return;
      // gelenler (zamanı gelen, okulda olmayan) ve gidenler
      if (h < 7) gitti.clear();   // yeni gün
      KADRO.forEach((t, ki) => {
        const var_ = ks.find(k => k.kadroI === ki);
        if (h >= t.gel && h < t.git && !var_ && !gitti.has(ki)) { const k = kur(t.rig, t.ad, t.plan, t.gel, t.git, { sinif: t.sinif, no: t.no, kadroI: ki }); k.a.x = k.a.px = KAPI_DIS.x + ara(-1.2, 1.2); sec(k, pr.faz, pr.ders); }
        else if (var_ && (h >= t.git || h < t.gel) && var_.st !== 'cik') cikar(var_);
      });
      // arada bir veli müdüre gelir (ders saatlerinde, en çok bir)
      if (pr.faz === 'ders' && (veliT -= dt) <= 0 && !ks.some(k => k.plan === veliPlan)) {
        veliT = ara(60, 110);
        const k = kur({ kind: 'regular', look: { lookType: pick(['teyze', 'plaza', 'emekli']), lookSeed: 9400 + n }, seed: 9400 + n }, 'Veli', veliPlan, 0, 24);
        k.a.x = k.a.px = KAPI_DIS.x; sec(k, pr.faz, pr.ders);
      }
      for (let i = ks.length - 1; i >= 0; i--) if (ks[i]) adim(ks[i], pr.faz, pr.ders, dt);
    },
    rows: () => ks.map(k => ({ key: k.a.key, ad: k.ad, sinif: k.sinif, st: k.st, x: k.a.x, z: k.a.z, act: k.a.act, oda: okulOdaAt(k.a)?.id ?? null })),
    count: () => ks.length,
  };
}
