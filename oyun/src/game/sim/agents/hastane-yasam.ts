/**
 * Devlet Hastanesi'nin yaşamı (2026-11-28 sahip: "hastanenin içi de AVM gibi açılsın, çok detaylı olsun, hastaneye bir şeyler yapalım").
 * Oyuncu hastane diyarındayken:
 *  - personel (gerçek yürüyen aktör): hasta kabul memurları, danışma, güvenlik, acil doktoru ve hemşireleri, radyoloji teknisyeni,
 *    eczacılar, kafeterya çaycısı ve tostçusu, poliklinik doktorları, diş hekimi, laborantlar, servis hemşireleri, fizyoterapist,
 *    cerrahi ekip, yoğun bakım hemşiresi, başhekim ve sekreteri, nöbetçi doktorlar, temizlik görevlileri. Her biri kendi döngüsünde
 *    çalışır (yatak başı vizite, ilaç rafı, semaver, tost makinesi...). Yataktaki hastalar ve refakatçiler de aktördür.
 *  - ziyaretçiler: girişten gelir; hasta kabul gişesinde sıra alır, bekleme koltuğunda oturur, merdivenle polikliniğe çıkar,
 *    doktorun karşısına oturur; sonra eczane, kafeterya (çay içer), servis ziyareti; birkaç duraktan sonra çıkıp gider.
 *  - oyuncu: hasta kabulde kayıt, Dahiliye'de muayene (katkı payı), eczaneden reçete, laboratuvarda kan bağışı, kafeteryada çay simit,
 *    başhekimle sohbet. Günde bir kez XP verir; para yalnız katkı payı ve kafeterya için çıkar (gelir değil, harcama).
 * Hepsi deterministik (kendi rng akışı). Oyuncu diyardan çıkınca kaldırılır, girince içerisi dolu başlar. Saf sim.
 */
import type { System, SimCtx, Vec2 } from '../../../engine/api';
import type { AgentEnv } from './env';
import type { Actor } from './types';
import { katY } from '../../../content/avm-kat';
import { HST, HST_GIRIS, HST_GIRIS_IC, ODA_BY_ID, odaXZ, odaKapi, hstYol, hstKatYol, GISE, KABUL, koltuklar, LOBI_Z1, HOL, SIRA_Z, ASANSOR } from '../../../content/hastane-kat';
import { realmAt } from '../../../content/realm';

type Pt = Vec2 & { y?: number };
/** personel / sabit sakin adımı: dünya noktası, ne yapar, ne kadar, nereye bakar */
interface Adim { at: Vec2; act?: string; sn?: [number, number]; bak?: Vec2 | number; y?: number; say?: string[] }
interface Kisi { a: Actor; kat: number; adim: Adim[]; i: number; st: 'yol' | 'is'; t: number; dur: number; path: Pt[]; yerinde?: boolean }
type Dur = 'yol' | 'bekle' | 'cik';
interface Ziyaretci { a: Actor; kat: number; st: Dur; t: number; dur: number; path: Pt[]; plan: Durak[]; rot?: number; act?: string; y?: number; say?: string }
interface Durak { kat: number; at: Vec2; act: string; sn: [number, number]; bak?: Vec2 | number; y?: number; say?: string[] }

export const ZIYARETCI_HEDEF = 12, SP = 1.1;
export const MUAYENE_UCRET = 30, KAFE_UCRET = 15;
const LOOKS = ['emekli', 'teyze', 'plaza', 'universiteli', 'gezgin', 'taksici'];
const SOZ_DOKTOR = ['Tansiyon 12\'ye 8, maşallah!', 'Az tuz, bol su. Geçmiş olsun!', 'Büfe işi yorucu, uykuna dikkat et.', 'Turp gibisin, bir şeyin yok!', 'Simidi azalt, yürüyüşü artır.'];
const R = (id: string, u: number, v: number) => odaXZ(ODA_BY_ID[id], u, v);

export interface HastaneYasamSystem extends System {
  rows(): { key: string; tip: 'personel' | 'ziyaretci'; kat: number; x: number; z: number; y: number; act: string }[];
}

export function createHastaneYasam(env: AgentEnv): HastaneYasamSystem {
  const rng = env.rng('hastane-yasam');
  const kisiler: Kisi[] = [], zs: Ziyaretci[] = [];
  let n = 0, spawnT = 0, icerde = false;
  const T = () => (env.rules.state as unknown as { tut: Record<string, number>; day: number; money: number });
  const pick = <X>(xs: readonly X[]): X => xs[Math.floor(rng.next() * xs.length)];
  const say = (a: Actor, t: string, s = 2.6) => { a.say = t; a.sayT = s; };
  const bakis = (a: Actor, b?: Vec2 | number) => { if (b === undefined) return; a.rot = typeof b === 'number' ? b : Math.atan2(b.x - a.x, b.z - a.z); };
  const katOf = (p: { kat?: number }) => p.kat || 0;
  const benIcerde = () => realmAt(env.player().x)?.id === 'hastane';

  /* ---------- personel ve sabit sakinler ---------- */
  const worker = (role: string, seed: number, look: Record<string, unknown> = {}) => ({ kind: 'worker', role, seed, look: { lookSeed: seed, ...look } });
  const regular = (lookType: string, seed: number, look: Record<string, unknown> = {}) => ({ kind: 'regular', look: { lookType, lookSeed: seed, ...look }, seed });
  const GOMLEK = { top: '#a9cde3', topStyle: 'shirt', bottom: '#a9cde3' };   // hasta önlüğü
  const CERRAH = { top: '#3f8f7f', topStyle: 'shirt', sleeves: 'short', bottom: '#3f8f7f', hat: 'bandana', hatColor: '#3f8f7f', apron: null };
  const YATAK_Y = 0.2;
  function kisi(kat: number, rig: Record<string, unknown>, ad: string, adim: Adim[], kind: 'worker' | 'regular' = 'worker') {
    const at = adim[0].at, a = env.reg.add(kind, 'hst-' + n++, rig, at, { name: ad, role: (rig as { role?: string }).role });
    a.y = a.py = katY(kat) + (adim[0].y || 0);
    const k: Kisi = { a, kat, adim, i: 0, st: 'is', t: 0, dur: aralik(adim[0].sn), path: [] };
    a.act = adim[0].act || 'idle'; bakis(a, adim[0].bak); kisiler.push(k);
  }
  const aralik = (sn?: [number, number]) => sn ? sn[0] + rng.next() * (sn[1] - sn[0]) : 0;
  /** yatakta yatan / oturan hasta: başı duvarda, yüzü ayak ucuna */
  const yatakta = (kat: number, id: string, u: number, v: number, bakU: number, bakV: number, seed: number, look: string, act = 'sit') =>
    kisi(kat, regular(look, seed, GOMLEK), '', [{ at: R(id, u, v), act, sn: [20, 40], bak: R(id, bakU, bakV), y: YATAK_Y }, { at: R(id, u, v), act: 'phone', sn: [6, 10], bak: R(id, bakU, bakV), y: YATAK_Y }], 'regular');

  function personel() {
    // ZEMİN: hasta kabul, danışma, güvenlik
    GISE.slice(0, 2).forEach((g, i) => kisi(0, worker('hostes', 7100 + i), 'Hasta Kabul', [
      { at: g.gor, act: 'idle', sn: [6, 12], bak: g.hasta }, { at: g.gor, act: 'pour', sn: [3, 4], bak: g.hasta, say: ['Sıradaki lütfen.', 'Kimliğinizi alayım.', 'Hangi bölüm?'] }]));
    kisi(0, worker('hostes', 7110), 'Danışma', [{ at: { x: HST.cx - 5.6, z: 46.75 }, act: 'idle', sn: [8, 14], bak: Math.PI }, { at: { x: HST.cx - 5.0, z: 46.75 }, act: 'phone', sn: [4, 6], bak: Math.PI, say: ['Danışma, buyurun.', 'Poliklinikler birinci katta.'] }]);
    kisi(0, worker('guvenlik', 7120), 'Güvenlik', [{ at: { x: HST.cx + 3.4, z: 45.95 }, act: 'idle', sn: [10, 16], bak: Math.PI }, { at: { x: HST.cx + 7, z: 48.8 }, act: 'idle', sn: [3, 5] }, { at: { x: HST.cx - 7, z: 48.8 }, act: 'idle', sn: [3, 5] }]);
    // acil
    kisi(0, worker('doktor', 7130, { apronText: 'DR. ELİF' }), 'Dr. Elif', [1.25, 3.45, 5.65].flatMap((v): Adim[] => [{ at: R('acil', 10.2, v), act: 'serve', sn: [5, 8], bak: R('acil', 11.6, v), say: v === 1.25 ? ['Nefes alın... verin.'] : undefined }] as Adim[]).concat([{ at: R('acil', 3.8, 2.6), act: 'idle', sn: [4, 6], bak: R('acil', 3.0, 2.0) }]));
    kisi(0, worker('hemsire', 7131), 'Hemşire Zeynep', [{ at: R('acil', 3.75, 2.0), act: 'pour', sn: [8, 12], bak: R('acil', 2.0, 2.0) }, { at: R('acil', 7.6, 2.55), act: 'grab', sn: [2, 3], bak: R('acil', 7.6, 3.3) }, { at: R('acil', 10.2, 7.85), act: 'serve', sn: [5, 7], bak: R('acil', 11.6, 7.85) }]);
    kisi(0, worker('hemsire', 7132), 'Hemşire Can', [{ at: R('acil', 10.2, 5.65), act: 'serve', sn: [6, 9], bak: R('acil', 11.6, 5.65) }, { at: R('acil', 9.0, 1.0), act: 'pour', sn: [3, 4], bak: R('acil', 9.0, 0.3) }, { at: R('acil', 6.0, 1.0), act: 'grab', sn: [2, 3], bak: R('acil', 6.0, 0.3) }]);
    yatakta(0, 'acil', 11.8, 1.25, 10.6, 1.25, 7140, 'emekli'); yatakta(0, 'acil', 11.8, 3.45, 10.6, 3.45, 7141, 'plaza'); yatakta(0, 'acil', 11.8, 5.65, 10.6, 5.65, 7142, 'teyze');
    // radyoloji
    kisi(0, worker('gorevli', 7150, { apronText: 'RÖNTGEN' }), 'Teknisyen Murat', [{ at: R('radyoloji', 1.8, 7.0), act: 'sit', sn: [10, 16], bak: R('radyoloji', 3.0, 7.0) }, { at: R('radyoloji', 7.9, 2.6), act: 'serve', sn: [4, 6], bak: R('radyoloji', 9.0, 2.6), say: ['Kımıldamayın, çekiyorum.'] }]);
    kisi(0, regular('plaza', 7151, GOMLEK), '', [{ at: R('radyoloji', 9.0, 2.6), act: 'sit', sn: [30, 50], bak: R('radyoloji', 7.0, 2.6), y: 0.35 }], 'regular');
    // eczane
    kisi(0, worker('gorevli', 7160, { apronText: 'ECZACI' }), 'Eczacı Nur', [{ at: R('eczane', 4.95, 4.5), act: 'idle', sn: [6, 10], bak: R('eczane', 3.0, 4.5) }, { at: R('eczane', 12.2, 3.5), act: 'grab', sn: [2, 3], bak: R('eczane', 12.9, 3.5) }, { at: R('eczane', 4.95, 3.6), act: 'serve', sn: [3, 4], bak: R('eczane', 3.0, 3.6), say: ['Günde iki kez, tok karnına.', 'Geçmiş olsun!'] }]);
    kisi(0, worker('gorevli', 7161, { apronText: 'KALFA' }), 'Kalfa Emre', [{ at: R('eczane', 8.5, 1.15), act: 'grab', sn: [3, 5], bak: R('eczane', 8.5, 0.35) }, { at: R('eczane', 8.5, 7.85), act: 'grab', sn: [3, 5], bak: R('eczane', 8.5, 8.65) }, { at: R('eczane', 4.95, 5.6), act: 'pour', sn: [4, 6], bak: R('eczane', 3.0, 5.6) }]);
    // kafeterya
    kisi(0, worker('cay', 7170), 'Çaycı Hüseyin', [{ at: R('kafeterya', 12.2, 2.2), act: 'pour', sn: [4, 6], bak: R('kafeterya', 12.9, 2.2) }, { at: R('kafeterya', 11.0, 3.0), act: 'serve', sn: [3, 5], bak: R('kafeterya', 9.0, 3.0), say: ['Çaylar taze!', 'Simit sıcak!'] }]);
    kisi(0, worker('tost', 7171), 'Tostçu Ali', [{ at: R('kafeterya', 12.2, 3.5), act: 'cut', sn: [5, 7], bak: R('kafeterya', 12.9, 3.5) }, { at: R('kafeterya', 11.0, 4.6), act: 'serve', sn: [3, 4], bak: R('kafeterya', 9.0, 4.6) }, { at: R('kafeterya', 12.2, 5.4), act: 'grab', sn: [2, 3], bak: R('kafeterya', 12.9, 5.4) }]);
    kisi(0, worker('temizlik', 7180), 'Temizlikçi Fadime', [{ at: { x: HOL.x0 + 0.7, z: 52 }, act: 'sweep', sn: [6, 9] }, { at: { x: HOL.x0 + 0.7, z: 64 }, act: 'sweep', sn: [6, 9] }, { at: { x: HOL.x1 - 0.7, z: 64 }, act: 'sweep', sn: [6, 9] }, { at: { x: HST.cx + 8, z: 49 }, act: 'sweep', sn: [6, 9] }]);
    // 1. KAT: poliklinikler
    kisi(1, worker('hostes', 7200), 'Banko', [{ at: { x: HST.x0 + 4.4, z: 49.6 }, act: 'idle', sn: [8, 12], bak: 0 + Math.PI }, { at: { x: HST.x0 + 3.4, z: 49.6 }, act: 'pour', sn: [3, 4], bak: Math.PI }]);
    kisi(1, worker('doktor', 7210, { apronText: 'DR. KEMAL' }), 'Dr. Kemal', [{ at: R('dahiliye', 9.0, 2.2), act: 'sit', sn: [14, 22], bak: R('dahiliye', 7.0, 2.2) }, { at: R('dahiliye', 11.2, 2.2), act: 'serve', sn: [4, 6], bak: R('dahiliye', 12.5, 2.2), say: ['Derin nefes...'] }]);
    kisi(1, worker('doktor', 7211, { apronText: 'DR. SELİN' }), 'Dr. Selin', [{ at: R('dahiliye', 9.0, 6.8), act: 'sit', sn: [14, 22], bak: R('dahiliye', 7.0, 6.8) }, { at: R('dahiliye', 9.0, 6.8), act: 'phone', sn: [3, 5], bak: R('dahiliye', 7.0, 6.8) }]);
    kisi(1, worker('doktor', 7220, { apronText: 'DR. AYLA', top: '#f2a2b3' }), 'Dr. Ayla', [{ at: R('cocuk', 9.8, 6.6), act: 'sit', sn: [12, 20], bak: R('cocuk', 7.8, 6.6) }, { at: R('cocuk', 4.0, 3.4), act: 'wave', sn: [3, 4], bak: R('cocuk', 4.0, 2.4), say: ['Aferin sana!', 'Bak ne güzel oyuncak!'] }]);
    kisi(1, regular('okul', 7221), '', [{ at: R('cocuk', 4.6, 2.2), act: 'sit', sn: [8, 14], bak: R('cocuk', 3.0, 1.6) }, { at: R('cocuk', 3.6, 3.2), act: 'cheer', sn: [3, 5] }, { at: R('cocuk', 5.0, 3.0), act: 'idle', sn: [3, 5] }], 'regular');
    kisi(1, regular('teyze', 7222), '', [{ at: R('cocuk', 7.8, 6.6), act: 'sit', sn: [30, 40], bak: R('cocuk', 9.8, 6.6) }], 'regular');
    kisi(1, worker('doktor', 7230, { apronText: 'DİŞ HEKİMİ', top: '#9fd8d0' }), 'Dt. Burak', [{ at: R('dis', 8.9, 1.45), act: 'serve', sn: [8, 12], bak: R('dis', 9.4, 2.2), say: ['Ağzınızı açın lütfen.', 'Az kaldı, tamam.'] }, { at: R('dis', 9.9, 3.2), act: 'grab', sn: [2, 3], bak: R('dis', 9.9, 3.1) }]);
    kisi(1, regular('universiteli', 7231, GOMLEK), '', [{ at: R('dis', 9.6, 2.3), act: 'sit', sn: [30, 50], bak: R('dis', 8.4, 2.3), y: 0.15 }], 'regular');
    kisi(1, worker('hemsire', 7240, { apronText: 'LAB' }), 'Laborant Deniz', [{ at: R('lab', 3.5, 2.9), act: 'serve', sn: [6, 9], bak: R('lab', 2.6, 2.9), say: ['Yumruğunuzu sıkın.', 'Bitti bile!'] }, { at: R('lab', 12.0, 3.4), act: 'pour', sn: [4, 6], bak: R('lab', 12.8, 3.4) }]);
    kisi(1, worker('gorevli', 7241, { apronText: 'LAB' }), 'Biyolog Seda', [{ at: R('lab', 12.0, 2.2), act: 'idle', sn: [6, 10], bak: R('lab', 12.8, 2.2) }, { at: R('lab', 12.0, 6.0), act: 'pour', sn: [4, 6], bak: R('lab', 12.8, 6.0) }, { at: R('lab', 7.2, 1.15), act: 'idle', sn: [4, 6], bak: R('lab', 7.2, 0.4) }]);
    // 2. KAT: servisler, yenidoğan, fizik tedavi
    kisi(2, worker('hostes', 7300, { top: '#fbfbf8', vest: '#4f8fbf' }), 'Sorumlu Hemşire', [{ at: { x: HST.x0 + 4.4, z: 49.6 }, act: 'pour', sn: [8, 12], bak: Math.PI }, { at: { x: HST.x0 + 5.4, z: 49.6 }, act: 'phone', sn: [3, 5], bak: Math.PI }]);
    for (const [id, s0] of [['servisA', 7310], ['servisB', 7320]] as const) {
      kisi(2, worker('hemsire', s0), 'Hemşire', [4.6, 8.4, 12.0].flatMap(u => [{ at: R(id, u, 3.0), act: 'serve', sn: [4, 7] as [number, number], bak: R(id, u, 1.25) }, { at: R(id, u, 6.0), act: 'serve', sn: [4, 7] as [number, number], bak: R(id, u, 7.75) }]));
      const bos = s0 === 7310 ? 1 : 3;
      [[4.6, 1.25, 'on'], [8.4, 1.25, 'on'], [12.0, 1.25, 'on'], [4.6, 7.75, 'arka'], [8.4, 7.75, 'arka'], [12.0, 7.75, 'arka']].forEach(([u, v, y], i) => { if (i === bos || i === bos + 2) return; yatakta(2, id, u as number, v as number, u as number, y === 'on' ? 4.5 : 4.5, s0 + 1 + i, pick(['emekli', 'teyze', 'plaza']), i % 3 === 2 ? 'sleep' : 'sit'); });
    }
    kisi(2, regular('teyze', 7330), '', [{ at: R('servisA', 4.6, 2.75), act: 'sit', sn: [30, 40], bak: R('servisA', 4.6, 1.25) }], 'regular');
    kisi(2, worker('hemsire', 7340, { bottom: '#e58fb0' }), 'Ebe Hatice', [{ at: R('yenidogan', 6.0, 3.0), act: 'serve', sn: [5, 8], bak: R('yenidogan', 6.0, 2.0) }, { at: R('yenidogan', 10.8, 3.0), act: 'serve', sn: [5, 8], bak: R('yenidogan', 10.8, 2.0) }, { at: R('yenidogan', 8.4, 5.8), act: 'serve', sn: [5, 8], bak: R('yenidogan', 8.4, 6.8) }]);
    kisi(2, regular('balayi', 7341), '', [{ at: R('yenidogan', 12.6, 4.5), act: 'sit', sn: [40, 60], bak: R('yenidogan', 9, 4.5) }], 'regular');
    kisi(2, worker('gorevli', 7350, { apronText: 'FİZYOTERAPİST', apron: '#5fae4f' }), 'Fzt. Kerem', [{ at: R('fizik', 7.0, 3.0), act: 'talk', sn: [6, 9], bak: R('fizik', 7.0, 2.0), say: ['Yavaş yavaş, aferin!', 'Bir tur daha.'] }, { at: R('fizik', 10.6, 2.8), act: 'idle', sn: [4, 6], bak: R('fizik', 11.8, 2.8) }]);
    kisi(2, regular('emekli', 7351, { top: '#7fb8d8', topStyle: 'hoodie' }), '', [{ at: R('fizik', 5.8, 2.0), act: 'walk', sn: [0, 0], bak: Math.PI / 2 }, { at: R('fizik', 8.2, 2.0), act: 'idle', sn: [2, 3] }, { at: R('fizik', 5.8, 2.0), act: 'idle', sn: [2, 3] }], 'regular');
    kisi(2, regular('plaza', 7352, { top: '#e0533c', topStyle: 'hoodie' }), '', [{ at: R('fizik', 11.8, 1.6), act: 'walk', sn: [60, 60], bak: R('fizik', 10.0, 1.6) }], 'regular');
    // 3. KAT: ameliyathane, yoğun bakım, başhekimlik, nöbet odası
    for (const [i, u, v, rol] of [[0, 8.2, 3.3, 'CERRAH'], [1, 8.2, 5.7, 'CERRAH'], [2, 9.25, 4.5, 'ASİSTAN'], [3, 8.2, 2.5, 'ANESTEZİ']] as const)
      kisi(3, worker('doktor', 7400 + i, { ...CERRAH, apronText: rol }), rol === 'CERRAH' ? 'Op. Dr.' : rol, [{ at: R('ameliyat', u, v), act: i < 2 ? 'cut' : i === 2 ? 'grab' : 'idle', sn: [8, 14], bak: R('ameliyat', 8.2, 4.5) }, { at: R('ameliyat', u, v), act: 'serve', sn: [3, 5], bak: R('ameliyat', 8.2, 4.5) }]);
    kisi(3, worker('hemsire', 7410, { top: '#3f8f7f', bottom: '#3f8f7f' }), 'Ameliyat Hemşiresi', [{ at: R('ameliyat', 10.8, 6.0), act: 'grab', sn: [4, 7], bak: R('ameliyat', 10.8, 6.8) }, { at: R('ameliyat', 9.6, 5.9), act: 'serve', sn: [3, 5], bak: R('ameliyat', 8.2, 4.5) }]);
    kisi(3, worker('hemsire', 7420), 'Yoğun Bakım Hemşiresi', [1.6, 4.5, 7.4].flatMap(v => [{ at: R('yogun', 9.9, v + 0.4), act: 'serve', sn: [6, 9] as [number, number], bak: R('yogun', 11.4, v) }]).concat([{ at: R('yogun', 5.25, 4.5), act: 'pour', sn: [8, 12], bak: R('yogun', 4.6, 4.5) }]));
    yatakta(3, 'yogun', 11.6, 1.6, 10.2, 1.6, 7421, 'emekli', 'sleep'); yatakta(3, 'yogun', 11.6, 4.5, 10.2, 4.5, 7422, 'teyze', 'sleep');
    kisi(3, worker('mudur', 7430, { glasses: 'round', hair: 'short', hairColor: '#bdbdbd' }), 'Başhekim Prof. Dr. Nihat', [{ at: R('bashekim', 11.6, 4.5), act: 'sit', sn: [14, 22], bak: R('bashekim', 9.0, 4.5) }, { at: R('bashekim', 11.6, 4.5), act: 'phone', sn: [4, 6], bak: R('bashekim', 9.0, 4.5), say: ['Hastanemiz tam kapasite!'] }]);
    kisi(3, worker('hostes', 7431), 'Sekreter Melek', [{ at: R('bashekim', 3.1, 1.6), act: 'sit', sn: [12, 18], bak: R('bashekim', 1.4, 1.6) }, { at: R('bashekim', 3.1, 1.6), act: 'phone', sn: [3, 5], bak: R('bashekim', 1.4, 1.6), say: ['Başhekimlik, buyurun.'] }]);
    kisi(3, worker('doktor', 7440, { apronText: 'NÖBETÇİ' }), 'Nöbetçi Dr.', [{ at: R('nobet', 12.6, 1.4), act: 'sleep', sn: [30, 40], bak: R('nobet', 12.6, 3.0), y: 0.12 }]);
    kisi(3, worker('doktor', 7441, { apronText: 'NÖBETÇİ' }), 'Nöbetçi Dr.', [{ at: R('nobet', 5.2, 7.5), act: 'sit', sn: [14, 20], bak: R('nobet', 5.2, 0) }, { at: R('nobet', 12.4, 3.9), act: 'sip', sn: [4, 6], bak: R('nobet', 13.1, 3.9), say: ['Üçüncü kahve...'] }]);
    kisi(2, worker('temizlik', 7450), 'Temizlikçi Hasan', [{ at: { x: HOL.x1 - 0.7, z: 52 }, act: 'sweep', sn: [6, 9] }, { at: { x: HOL.x1 - 0.7, z: 64 }, act: 'sweep', sn: [6, 9] }, { at: { x: HOL.x0 + 0.7, z: 63 }, act: 'sweep', sn: [6, 9] }]);
  }

  function kisiAdim(k: Kisi, dt: number) {
    const a = k.a; if (a.sayT > 0 && (a.sayT -= dt) <= 0) a.say = '';
    if (k.st === 'yol') {
      if (!yuru(a, k.path, dt, 1.0)) return;
      const s = k.adim[k.i]; k.st = 'is'; k.t = 0; k.dur = aralik(s.sn); a.act = s.act || 'idle'; a.speed = s.act === 'walk' ? 0.9 : 0; a.y = katY(k.kat) + (s.y || 0); bakis(a, s.bak);
      if (s.say && rng.next() < 0.5) say(a, pick(s.say));
      return;
    }
    a.act = k.adim[k.i].act || 'idle'; a.speed = a.act === 'walk' ? 0.9 : 0;
    if ((k.t += dt) < k.dur || k.adim.length < 2) return;
    k.i = (k.i + 1) % k.adim.length;
    const s = k.adim[k.i]; a.y = katY(k.kat);
    k.path = hstKatYol(k.kat, a, s.at); k.st = 'yol';
  }

  /* ---------- ziyaretçiler ---------- */
  const otur = (kat: number): Durak => { const ks = koltuklar(kat), b = ks[Math.floor(rng.next() * ks.length)]; return { kat, at: b, act: 'sit', sn: [6, 12], bak: 0 }; };
  function plan(): Durak[] {
    const r = rng.next(), o: Durak[] = [];
    const g = pick(GISE);
    if (r < 0.5) {   // poliklinik hastası
      o.push({ kat: 0, at: { x: g.hasta.x + (rng.next() - 0.5) * 0.3, z: g.hasta.z - rng.next() * 0.2 }, act: 'idle', sn: [3, 5], bak: Math.PI * 0 + 0, say: ['Randevum vardı.', 'Dahiliye için geldim.', 'Muayene olacağım.'] }, otur(0));
      const p = pick([['dahiliye', 7.0, 1.85, 9.0, 2.2], ['dahiliye', 7.0, 6.45, 9.0, 6.8], ['cocuk', 7.8, 6.6, 9.8, 6.6], ['lab', 1.75, 6.1, 2.6, 6.1], ['lab', 1.75, 7.7, 2.6, 7.7]] as const);
      o.push(otur(1), { kat: 1, at: R(p[0], p[1], p[2]), act: p[0] === 'lab' ? 'idle' : 'sit', sn: [10, 16], bak: R(p[0], p[3], p[4]) });
      if (rng.next() < 0.6) o.push({ kat: 0, at: R('eczane', 3.3, 3.6 + rng.next() * 1.8), act: 'idle', sn: [4, 6], bak: R('eczane', 4.2, 4.5), say: ['Reçetem var.', 'Bunlar nasıl kullanılıyor?'] });
    } else if (r < 0.75) {   // ziyaretçi
      if (rng.next() < 0.5) o.push({ kat: 2, at: { x: HST.cx - 4.6, z: 45.5 }, act: 'idle', sn: [3, 4], bak: Math.PI, say: ['Geçmiş olsun çiçeği alayım.'] });
      const id = pick(['servisA', 'servisB']), u = pick([4.6, 8.4, 12.0]);
      o.push({ kat: 2, at: R(id, u + 0.9, 3.2), act: 'talk', sn: [10, 18], bak: R(id, u, 1.25), say: ['Geçmiş olsun!', 'Nasılsın bugün?', 'Sana ev yemeği getirdim.'] });
      if (rng.next() < 0.4) o.push({ kat: 2, at: { x: odaKapi(ODA_BY_ID.yenidogan).dis.x, z: odaKapi(ODA_BY_ID.yenidogan).dis.z + 1.2 }, act: 'idle', sn: [4, 6], bak: -Math.PI / 2 * -1, say: ['Maşallah, ne tatlılar!'] });
      if (rng.next() < 0.4) o.push(otur(3));
    } else if (r < 0.9) {   // kafeterya
      o.push({ kat: 0, at: R('kafeterya', 9.3, 2.6 + rng.next() * 2.0), act: 'idle', sn: [3, 5], bak: R('kafeterya', 10.2, 3.6), say: ['Bir çay, bir simit.', 'Tost var mı?', 'Ayranbey olsun.'] });
    } else o.push({ kat: 0, at: R('eczane', 3.3, 3.6 + rng.next() * 1.8), act: 'idle', sn: [4, 6], bak: R('eczane', 4.2, 4.5) });
    if (rng.next() < 0.55) {   // kafeterya masası: çay içer
      const m = pick([[2.6, 1.6], [5.4, 1.6], [2.6, 4.2], [5.4, 4.2], [2.6, 6.9], [5.4, 6.9]]), sz = rng.next() < 0.5 ? -0.66 : 0.66, c = R('kafeterya', m[0], m[1]);
      o.push({ kat: 0, at: { x: c.x, z: c.z + sz }, act: 'sip', sn: [10, 16], bak: c });
    }
    return o;
  }
  function yeniZ(at: Pt, kat: number): Ziyaretci {
    const seed = 72000 + n, a = env.reg.add('regular', 'hst-z-' + n++, { kind: 'regular', look: { lookType: pick(LOOKS), lookSeed: seed }, seed }, at, { name: '' });
    a.y = a.py = at.y ?? katY(kat);
    const z: Ziyaretci = { a, kat, st: 'yol', t: 0, dur: 0, path: [], plan: plan() }; zs.push(z); return z;
  }
  function sonraki(z: Ziyaretci) {
    const d = z.plan.shift(), a = z.a;
    if (!d) { z.st = 'cik'; z.path = [...hstYol(z.kat, a, 0, HST_GIRIS_IC), { ...HST_GIRIS, y: 0 }]; a.y = katY(z.kat); return; }
    // dolu yer: başkası oturuyorsa yanına kayar
    const dolu = zs.some(q => q !== z && q.st === 'bekle' && Math.hypot(q.a.x - d.at.x, q.a.z - d.at.z) < 0.4);
    const to = dolu ? { x: d.at.x + 0.58, z: d.at.z } : d.at;
    a.y = katY(z.kat); z.path = hstYol(z.kat, a, d.kat, to); z.kat = d.kat; z.st = 'yol'; z.dur = aralik(d.sn); z.act = d.act; z.y = d.y; z.rot = typeof d.bak === 'number' ? d.bak : undefined;
    (z as Ziyaretci & { bak?: Vec2 | number; sozler?: string[] }).bak = d.bak; (z as Ziyaretci & { sozler?: string[] }).sozler = d.say;
  }
  function zAdim(z: Ziyaretci, dt: number) {
    const a = z.a; z.t += dt; if (a.sayT > 0 && (a.sayT -= dt) <= 0) a.say = '';
    if (z.st === 'yol') {
      if (!yuru(a, z.path, dt, SP)) return;
      const x = z as Ziyaretci & { bak?: Vec2 | number; sozler?: string[] };
      z.st = 'bekle'; z.t = 0; a.act = z.act || 'idle'; a.speed = 0; a.y = katY(z.kat) + (z.y || 0); bakis(a, x.bak);
      if (x.sozler && rng.next() < 0.55) say(a, pick(x.sozler));
      return;
    }
    if (z.st === 'bekle') { a.act = z.act || 'idle'; a.speed = 0; if (z.t > z.dur) sonraki(z); return; }
    if (yuru(a, z.path, dt, SP)) { env.reg.remove(a); zs.splice(zs.indexOf(z), 1); }
  }
  function doldur() {
    for (let i = 0; i < ZIYARETCI_HEDEF - 4; i++) {
      const z = yeniZ({ ...HST_GIRIS_IC, y: 0 }, 0), d = z.plan[Math.floor(rng.next() * Math.min(2, z.plan.length))] || z.plan[0];
      if (!d) continue;
      z.plan.splice(0, z.plan.indexOf(d)); const ilk = z.plan.shift()!;
      a2(z, ilk);
    }
  }
  /** içeri girince zaten yerinde: ilk durağına ışınla (oyuncu kapıdan girerken bina boş görünmesin) */
  function a2(z: Ziyaretci, d: Durak) {
    const a = z.a, dolu = zs.some(q => q !== z && Math.hypot(q.a.x - d.at.x, q.a.z - d.at.z) < 0.4);
    a.x = a.px = d.at.x + (dolu ? 0.58 : 0); a.z = a.pz = d.at.z; z.kat = d.kat; a.y = a.py = katY(d.kat) + (d.y || 0);
    z.st = 'bekle'; z.t = 0; z.dur = aralik(d.sn); z.act = d.act; a.act = d.act; bakis(a, d.bak);
  }
  const yuru = (a: Actor, path: Pt[], dt: number, sp: number): boolean => {
    let left = sp * dt;
    while (path.length && left > 0) {
      const to = path[0], dx = to.x - a.x, dz = to.z - a.z, d = Math.hypot(dx, dz);
      if (d < 1e-3) { if (to.y !== undefined) a.y = to.y; path.shift(); continue; }
      const k = Math.min(1, left / d); a.x += dx * k; a.z += dz * k; if (to.y !== undefined) a.y += (to.y - a.y) * k; a.rot = Math.atan2(dx, dz); left -= d * k;
      if (k < 1) break;
      if (to.y !== undefined) a.y = to.y; path.shift();
    }
    a.speed = path.length ? sp : 0; a.act = path.length ? 'walk' : a.act === 'walk' ? 'idle' : a.act;
    return !path.length;
  };
  function temizle() { for (const k of kisiler) env.reg.remove(k.a); for (const z of zs) env.reg.remove(z.a); kisiler.length = 0; zs.length = 0; }

  /* ---------- oyuncu etkileşimleri ---------- */
  const oyuncuKat = () => katOf(env.player() as { kat?: number });
  const burada = (kat: number) => benIcerde() && oyuncuKat() === kat;
  const gun = () => T().day || 0;
  const tut = () => T().tut;
  const konus = (ad: string, t: string, s = 2.8) => { env.host.heroSay(ad + ': ' + t, s); const k = kisiler.find(q => q.a.info?.name === ad || (q.a as unknown as { info?: { name?: string } }).info?.name === ad); if (k) { k.a.act = 'wave'; } };
  const reg = (id: string, kat: number, pos: Vec2, act: () => void, dwell = 1.0, radius = 0.7) => env.interactions.register({ id, pos, radius, kind: 'station', dwell, interval: 0.3, canAct: () => burada(kat), act: () => { act(); return 'done'; } });
  GISE.forEach(g => reg('hstKabul.' + g.id, 0, g.hasta, () => {
    const t = tut();
    if (t.hstMuayene === gun()) { konus('Gişe ' + g.id, 'Bugün muayene oldunuz, geçmiş olsun!'); return; }
    if (t.hstKayit === gun()) { konus('Gişe ' + g.id, 'Kaydınız açık: 1. kat Dahiliye Polikliniği.'); return; }
    t.hstKayit = gun(); t.hstSira = 40 + Math.floor(rng.next() * 50);
    konus('Gişe ' + g.id, 'Kaydınız açıldı. Sıra no ' + String(t.hstSira).padStart(3, '0') + ', 1. kat Dahiliye Polikliniği. Merdiven ya da asansör.', 3.4);
  }));
  reg('hstMuayene', 1, R('dahiliye', 7.0, 1.85), () => {
    const t = tut(), S = T();
    if (t.hstMuayene === gun()) { konus('Dr. Kemal', 'Bugün baktık ya, turp gibisin! Yarın gel.'); return; }
    if (t.hstKayit !== gun()) { konus('Dr. Kemal', 'Önce zemin kattaki hasta kabulden kayıt yaptırın.'); return; }
    if (S.money < MUAYENE_UCRET) { konus('Dr. Kemal', 'Katkı payı ' + MUAYENE_UCRET + ' ₺, kasaya yatırınca gelin.'); return; }
    S.money = Math.round((S.money - MUAYENE_UCRET) * 100) / 100; t.hstMuayene = gun(); t.hstRecete = gun();
    konus('Dr. Kemal', pick(SOZ_DOKTOR) + ' Reçeten eczanede.', 3.2); env.host.heroAct('sit', 3);
    env.host.addXP?.(30); env.host.stat('hstMuayene');
    env.host.toast('🩺 Muayene oldun! +30 XP (katkı payı ' + MUAYENE_UCRET + ' ₺). Reçeteni zemin kattaki eczaneden al.', 'good');
  }, 1.2);
  reg('hstEczane', 0, R('eczane', 3.3, 4.5), () => {
    const t = tut();
    if (t.hstRecete === gun() && t.hstIlac !== gun()) { t.hstIlac = gun(); konus('Eczacı Nur', 'Reçeteniz hazır: vitamin şurubu, günde bir kaşık. Geçmiş olsun!', 3.0); env.host.addXP?.(10); env.host.toast('💊 Reçeteni aldın: vitamin şurubu. +10 XP', 'good'); return; }
    konus('Eczacı Nur', t.hstIlac === gun() ? 'İlacınızı aldınız, düzenli kullanın!' : 'Reçetesiz ilaç veremem. Önce muayene olun, 1. kat Dahiliye.');
  });
  reg('hstKan', 1, R('lab', 1.75, 2.9), () => {
    const t = tut();
    if (t.hstKan && gun() - t.hstKan < 3) { konus('Laborant Deniz', 'Kan bağışı için en az üç gün beklemelisiniz. Teşekkürler!'); return; }
    t.hstKan = gun(); t.hstCay = gun(); env.host.heroAct('sit', 4);
    konus('Laborant Deniz', 'Yumruğunuzu sıkın... bitti! Bir ünite kan, üç hayat. Kafeteryada çayınız bizden.', 3.4);
    env.host.addXP?.(40); env.host.stat('hstKan'); env.host.toast('🩸 Kan bağışı yaptın! +40 XP. Kafeteryada çay simit bugün bedava.', 'good');
  }, 1.5);
  let kafeCd = 0;
  reg('hstKafe', 0, R('kafeterya', 9.3, 3.6), () => {
    const t = tut(), S = T();
    if (kafeCd > 0) { konus('Çaycı Hüseyin', 'Çayın daha bitmedi abi, afiyet olsun!'); return; }
    const bedava = t.hstCay === gun();
    if (!bedava && S.money < KAFE_UCRET) { konus('Çaycı Hüseyin', 'Çay simit ' + KAFE_UCRET + ' ₺ abi.'); return; }
    if (bedava) delete t.hstCay; else S.money = Math.round((S.money - KAFE_UCRET) * 100) / 100;
    kafeCd = 45; env.host.heroAct('sip', 4); env.host.addXP?.(3);
    konus('Çaycı Hüseyin', bedava ? 'Kan bağışçısına çay simit bizden, afiyet olsun!' : 'Çay simit, buyur! (-' + KAFE_UCRET + ' ₺)');
  });
  reg('hstBashekim', 3, R('bashekim', 8.6, 4.5), () => {
    const t = tut();
    const soz = ['Hastanemize hoş geldin. Büfenin ünü buraya kadar geldi!', 'Kafeteryamıza iyi bir işletmeci arıyoruz; büfeyi büyütürsen konuşuruz.', 'Bugün acil çok yoğun, doktorlarımız çok yorgun.', 'Ameliyathanemiz yenilendi, ilçenin en iyisi.'];
    konus('Başhekim', soz[(t.hstBas || 0) % soz.length], 3.4); if (!t.hstBas) { env.host.addXP?.(15); env.host.toast('🏥 Başhekimle tanıştın! +15 XP', 'good'); } t.hstBas = (t.hstBas || 0) + 1;
  });
  reg('hstBebek', 2, { x: odaKapi(ODA_BY_ID.yenidogan).dis.x, z: odaKapi(ODA_BY_ID.yenidogan).dis.z }, () => {
    const t = tut(); konus('Ebe Hatice', 'Maşallah! Bugün ' + (3 + (gun() % 5)) + ' bebek dünyaya geldi.'); if (!t.hstBebekG) { t.hstBebekG = 1; env.host.addXP?.(10); }
  }, 0.8);
  reg('hstAmeliyat', 3, { x: odaKapi(ODA_BY_ID.ameliyat).dis.x, z: odaKapi(ODA_BY_ID.ameliyat).dis.z }, () => konus('Ameliyat Hemşiresi', 'Ameliyat sürüyor, steril alan. Bekleme salonunda oturabilirsiniz.'), 0.6);
  void KABUL; void LOBI_Z1; void SIRA_Z; void ASANSOR;

  return {
    id: 'hastane-yasam', order: 50, phase: 'sim',
    step(ctx: SimCtx) {
      const dt = Math.min(ctx.dt, 0.25), ic = benIcerde();
      if (ic !== icerde) { icerde = ic; if (ic) { personel(); doldur(); } else temizle(); }
      if (!ic) return;
      if (kafeCd > 0) kafeCd -= dt;
      if (zs.length < ZIYARETCI_HEDEF && (spawnT -= dt) <= 0) { spawnT = 3 + rng.next() * 3; const z = yeniZ({ ...HST_GIRIS, y: 0 }, 0); z.path = [{ ...HST_GIRIS_IC, y: 0 }]; z.st = 'yol'; (z as Ziyaretci & { bak?: number }).bak = 0; z.act = 'idle'; z.dur = 0; z.plan.unshift({ kat: 0, at: HST_GIRIS_IC, act: 'idle', sn: [0, 0] }); }
      for (const k of kisiler) kisiAdim(k, dt);
      for (let i = zs.length - 1; i >= 0; i--) zAdim(zs[i], dt);
    },
    rows: () => [...kisiler.map(k => ({ key: k.a.key, tip: 'personel' as const, kat: k.kat, x: k.a.x, z: k.a.z, y: k.a.y, act: k.a.act })), ...zs.map(z => ({ key: z.a.key, tip: 'ziyaretci' as const, kat: z.kat, x: z.a.x, z: z.a.z, y: z.a.y, act: z.a.act }))],
  };
}
