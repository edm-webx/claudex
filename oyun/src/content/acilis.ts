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
export interface AcilisKosul { asama: number; once?: string; yildiz?: number; gorev?: Gorev }

const servis = (n: number): Gorev => ({ stat: 'served', n, ad: 'müşteri' });
const vapur = (n: number): Gorev => ({ stat: 'ferries', n, ad: 'vapur karşıla' });
const temiz = (n: number): Gorev => ({ stat: 'cleaned', n, ad: 'masa temizle' });

/** Sıra: Meydan Kafe > Sahil Bistro > Okul Kantini > Martı Kırtasiye > Tesis Kafeteryası > AVM (şekerci, moda, ...). Ekonomi: tests/sim/acilis.test.ts */
export const ACILIS: Record<string, AcilisKosul> = {
  // karşı yaka (üst geçit esnaf seviyesi 3'te açılır: Arsa.seviye). Büfe 3. aşaması 500 bin ₺ ister ve geç gelir: ilk ikisi 2. aşamada, görevle sıralı
  k1: { asama: 2, gorev: servis(500) },
  k2: { asama: 2, once: 'k1', yildiz: 4, gorev: vapur(50) },
  k4: { asama: 3, once: 'k2', gorev: servis(3000) },
  k3: { asama: 3, once: 'k4', gorev: temiz(1500) },
  k6: { asama: 4, once: 'k3', yildiz: 5 },
  // Martı AVM: zemin kat > 1. kat (yeme-içme) > 2. kat (yemek katı)
  k10: { asama: 5, once: 'k6' },
  k7: { asama: 5, once: 'k10', gorev: servis(8000) },
  k9: { asama: 5, once: 'k7' },
  k8: { asama: 6, once: 'k9' },
  k11: { asama: 6, once: 'k10' },
  k12: { asama: 6, once: 'k11' },
  k14: { asama: 7, once: 'k12' },
  k13: { asama: 7, once: 'k14' },
  k5: { asama: 7, once: 'k11', gorev: servis(15000) },
  k15: { asama: 8, once: 'k5' },
  k16: { asama: 8, once: 'k15' },
  k17: { asama: 9, once: 'k16' },
  // boş arsalar (panelden alınır)
  a1: { asama: 2 }, a2: { asama: 3 }, a3: { asama: 4 }, a4: { asama: 5 }, a5: { asama: 6 },
};

export interface AcilisDurum { stage: number; stars: number; level: number; stats: Record<string, number>; sahip(id: string): boolean }

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
  if (k.gorev) { const v = Math.floor(d.stats[k.gorev.stat] || 0); if (v < k.gorev.n) out.push(k.gorev.n + ' ' + k.gorev.ad + ' (' + v + '/' + k.gorev.n + ')'); }
  return out;
}

/** Dükkânı `lv` seviyesine tadilat için gereken büfe aşaması. */
export const tadilatAsama = (id: string, lv: number): number => Math.min(10, kosulOf(id).asama + Math.floor((lv - 1) / 2));
export function tadilatEksik(id: string, lv: number, d: AcilisDurum): string[] {
  const s = tadilatAsama(id, lv);
  return d.stage < s ? [asamaAd(s)] : [];
}
/** Kilit satırı: en çok iki koşul ("🔒 4★ karne + 700 müşteri (212/700)"). */
export const kilitYazi = (eksik: string[]): string => (eksik.length ? '🔒 ' + eksik.slice(0, 2).join(' + ') + (eksik.length > 2 ? ' …' : '') : '');
