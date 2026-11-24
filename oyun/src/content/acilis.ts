/**
 * Açılış sırası (2026-11-22 sahip): "kırtasiye ve okulun önünde sarı kareler var, onlar hemen açılmayacak; belirli bir düzene ve sıraya
 * göre açacağız, aynı büfenin büyümesi belli aşamalarda yıldızlarda oluyor ya; hepsine bir koşul, bir görev bağlamak lazım".
 *
 * TEK tablo: satın alınabilen her yer (karşı yaka dükkânları, AVM dükkânları, boş arsalar) burada büfenin ilerleyişine bağlanır.
 *  - asama: büfe bu aşamaya gelmeden dükkânın sarı karesi hiç görünmez (büfe aşaması da yıldızla açılır: content/stages.ts req.stars)
 *  - once:  sıradaki bir önceki dükkân alınmadan kare görünmez (zincir: biri alınınca sıradaki kare çıkar)
 *  - yildiz / gorev: kare görünür ama kilitlidir, eksik koşulu yazar ("4★ + 600 müşteri (212/600)")
 *  - esnaf seviyesi: Arsa.seviye (content/esya.ts), aynı kilit satırına eklenir
 * Dükkân tadilatı da büfeye bağlı: L. seviyeye tadilat için büfe aşaması >= asama + floor((L - 1) / 2) (2. seviye hemen, 3-4 bir aşama, 5 iki aşama sonra; en çok 10).
 * Kayıt alanı yok: hepsi mevcut S.stage / S.stars / S.level / S.stats ve sahip olunan arsalardan okunur (eski kayıtta alınmış dükkân alınmış kalır).
 * Pure data + saf yardımcılar.
 */
import { ARSALAR, type Arsa } from './esya';
import { KIOSK_STAGES } from './stages';

export interface Gorev { stat: string; n: number; ad: string }
export interface AcilisKosul { asama: number; once?: string; yildiz?: number; gorev?: Gorev[] }

/** görev: S.stats sayacı + oyuncunun okuyacağı ad (sayıyla birlikte). Görevler dükkânın konusuna bağlı (2026-11-22 sahip: "keyifli hale getir") */
const g = (stat: string, n: number, ad: string): Gorev => ({ stat, n, ad });
const servis = (n: number) => g('served', n, n + ' müşteriye servis');

/** Sıra: Meydan Kafe > Sahil Bistro > Okul Kantini > Martı Kırtasiye > Tesis Kafeteryası > AVM (şekerci, moda, ...). Ekonomi: tests/sim/acilis.test.ts */
export const ACILIS: Record<string, AcilisKosul> = {
  // karşı yaka (üst geçit esnaf seviyesi 3'te açılır: Arsa.seviye). Büfe 3. aşaması 500 bin ₺ ister ve geç gelir: ilk ikisi 2. aşamada, görevle sıralı
  k1: { asama: 2, gorev: [servis(500)] },
  k2: { asama: 2, once: 'k1', yildiz: 4, gorev: [g('ferries', 50, '50 vapur karşıla')] },   // sahil: vapurcuların gözdesi ol
  k4: { asama: 3, once: 'k2', gorev: [g('sinav', 3, 'okulda 3 sınav ver'), servis(3000)] },   // okulu tanımadan kantin olmaz
  k3: { asama: 3, once: 'k4', gorev: [g('sinav', 8, 'okulda 8 sınav ver'), g('cleaned', 1500, '1500 masa temizle')] },
  k6: { asama: 4, once: 'k3', yildiz: 5, gorev: [g('macOyun', 3, 'halı sahada 3 maç oyna')] },   // tesis: sahayı bilen kafeteryayı işletir
  // Martı AVM: zemin kat > 1. kat (yeme-içme) > 2. kat (yemek katı)
  k10: { asama: 5, once: 'k6', gorev: [g('miniPlay', 10, '10 mini oyun oyna')] },   // şekerci: oyun ve şeker
  k7: { asama: 5, once: 'k10', gorev: [g('turistFoto', 15, 'turistler büfeni 15 kez fotoğraflasın')] },   // moda: şöhret
  k9: { asama: 5, once: 'k7', gorev: [servis(17500)] },   // 2026-11-24 dengeleme: aşama 5-6 arası boş kalmasın diye ara hedef
  k8: { asama: 6, once: 'k9', gorev: [servis(23500)] },
  k11: { asama: 6, once: 'k10' },
  k12: { asama: 6, once: 'k11' },
  k14: { asama: 7, once: 'k12' },
  k13: { asama: 7, once: 'k14' },
  k5: { asama: 7, once: 'k11', gorev: [g('paketTeslim', 40, '40 paket siparişi teslim et (büfeye Aşçı ve Kurye al)'), servis(29000)] },   // lokanta: paket servis tecrübesi
  k15: { asama: 8, once: 'k5' },
  k16: { asama: 8, once: 'k15', gorev: [servis(36000)] },
  k17: { asama: 9, once: 'k16', gorev: [servis(42500)] },
  k18: { asama: 8, once: 'k5' },   // Martı Sinema Büfesi (AVM sinema katı)
  // boş arsalar (panelden alınır)
  a1: { asama: 2 }, a2: { asama: 3 }, a3: { asama: 4 }, a4: { asama: 5 }, a5: { asama: 6 },
};
/** holding yolu: dükkânların açılış sırası (tablonun sırası, boş arsalar hariç) */
export const SIRA: string[] = Object.keys(ACILIS).filter(id => ARSALAR.find(a => a.id === id)?.sabit);

export interface AcilisDurum { stage: number; stars: number; level: number; stats: Record<string, number>; sahip(id: string): boolean }
/** oyun durumundan (S) açılış durumu; serbest: yönetici / test kurulumu (sıra şartı yok, esnaf seviyesi yine sayılır) */
export function durumOf(S: { stage?: number; stars?: number; level: number; stats: Record<string, number>; zones: Record<string, unknown> }, serbest = false): AcilisDurum {
  const plots = () => ((S.zones.arsa as { plots?: Record<string, unknown> } | undefined)?.plots || {});
  return serbest
    ? { stage: 99, stars: 99, level: S.level, stats: new Proxy({}, { get: () => Infinity }), sahip: () => true }
    : { stage: S.stage || 1, stars: S.stars || 0, level: S.level, stats: S.stats, sahip: id => !!plots()[id] };
}

const ad = (id: string) => (ARSALAR.find(a => a.id === id)?.ad || id).replace(' (AVM)', '');
const asamaAd = (s: number) => s + '. aşama büfe (' + (KIOSK_STAGES[s - 1]?.short || '') + ')';
const kosulOf = (id: string): AcilisKosul => ACILIS[id] || { asama: 1 };

/** Kare / dükkân oyuncuya görünsün mü: büfe aşaması geldi ve sıradaki önceki dükkân alındı. */
export function acilisGorunur(a: Arsa, d: AcilisDurum): boolean {
  const k = kosulOf(a.id);
  return d.stage >= k.asama && (!k.once || d.sahip(k.once));
}

/** Eksik koşullar, oyuncunun okuyacağı sırayla (boşsa alınabilir). */
export function acilisEksik(a: Arsa, d: AcilisDurum): string[] {
  const k = kosulOf(a.id), out: string[] = [];
  if (d.stage < k.asama) out.push(asamaAd(k.asama));
  if (k.once && !d.sahip(k.once)) out.push('önce ' + ad(k.once));
  if (d.level < a.seviye) out.push(a.seviye + '. esnaf seviyesi');
  if (k.yildiz && d.stars < k.yildiz) out.push(k.yildiz + '★ karne');
  for (const gv of k.gorev || []) { const v = Math.floor(d.stats[gv.stat] || 0); if (v < gv.n) out.push(gv.ad + ' (' + v + '/' + gv.n + ')'); }
  return out;
}
/** Koşulların ne kadarı tamam (0..1): her koşul eşit pay, görevler kendi oranıyla (hedef çubuğu için) */
export function acilisOran(a: Arsa, d: AcilisDurum): number {
  const k = kosulOf(a.id), r: number[] = [Math.min(1, d.stage / k.asama), Math.min(1, d.level / Math.max(1, a.seviye))];
  if (k.once) r.push(d.sahip(k.once) ? 1 : 0);
  if (k.yildiz) r.push(Math.min(1, d.stars / k.yildiz));
  for (const gv of k.gorev || []) r.push(Math.min(1, (d.stats[gv.stat] || 0) / gv.n));
  return r.reduce((t, x) => t + x, 0) / r.length;
}
/** Holding yolunda sıradaki dükkân: alınmamış, önceki dükkânı alınmış ilk dükkân (yoksa null: hepsi senin) */
export function siradaki(d: AcilisDurum): Arsa | null {
  for (const id of SIRA) { const k = kosulOf(id); if (!d.sahip(id) && (!k.once || d.sahip(k.once))) return ARSALAR.find(a => a.id === id) || null; }
  return null;
}

/** Dükkânı `lv` seviyesine tadilat için gereken büfe aşaması. */
export const tadilatAsama = (id: string, lv: number): number => Math.min(10, kosulOf(id).asama + Math.floor((lv - 1) / 2));
export function tadilatEksik(id: string, lv: number, d: AcilisDurum): string[] {
  const s = tadilatAsama(id, lv);
  return d.stage < s ? [asamaAd(s)] : [];
}
/** Kilit satırı: en çok iki koşul ("🔒 4★ karne + 700 müşteri (212/700)"). */
export const kilitYazi = (eksik: string[]): string => (eksik.length ? '🔒 ' + eksik.slice(0, 2).join(' + ') + (eksik.length > 2 ? ' …' : '') : '');

/**
 * Dükkân görevleri (2026-11-22): alınan her dükkânın kendi görev zinciri, sırayla. Sayılar o dükkânın kendi kaydından (Plot: esya, isci,
 * sat, lv), ödül o dükkânın fiyatının payı (pahalı dükkân, büyük ödül). İlerleme S.tut['dg_<id>'] = sıradaki görevin indeksi.
 * Satın alınca da sıraya göre sandık düşer (SATIN_SANDIK).
 */
export interface DukkanPlot { esya?: string[]; isci?: number; sat?: number; lv?: number }
export interface DukkanGorev { ad: string; v: (p: DukkanPlot) => number; n: number; pay: number; sandik?: string }
export const DUKKAN_GOREV: DukkanGorev[] = [
  { ad: 'İlk aleti kur', v: p => (p.esya || []).length, n: 1, pay: 0.02 },
  { ad: 'İlk işçini tut', v: p => Number(p.isci) || 0, n: 1, pay: 0.02 },
  { ad: '50 satış yap', v: p => Number(p.sat) || 0, n: 50, pay: 0.03 },
  { ad: '2. seviyeye çıkar', v: p => Number(p.lv) || 1, n: 2, pay: 0.04 },
  { ad: '300 satış yap', v: p => Number(p.sat) || 0, n: 300, pay: 0.05 },
  { ad: '3. seviyeye çıkar', v: p => Number(p.lv) || 1, n: 3, pay: 0.06, sandik: 'gumus' },
  { ad: '1000 satış yap', v: p => Number(p.sat) || 0, n: 1000, pay: 0.08 },
  { ad: 'En üst seviyeye çıkar', v: p => Number(p.lv) || 1, n: 5, pay: 0.12, sandik: 'gumus' },
];
export const dukkanGorevOdul = (a: Arsa, g: DukkanGorev): number => Math.max(500, Math.round(a.fiyat * g.pay / 100) * 100);
/** satın alma sandığı: holding yolunda ilk iki dükkân tahta, sonrakiler gümüş */
export const satinSandik = (id: string): string => (SIRA.indexOf(id) < 2 ? 'tahta' : 'gumus');
