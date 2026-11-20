/**
 * Bulaşık akışı (BUF-13). Pure sim: no three, no DOM, no rng. Çalışma anı durumu rt.dirtyDishes (kayda yazılmaz: yeniden yüklemede
 * temiz mutfak). Silinen masadan kirli tabak sayısı kadar yığın artar (masaSilindi: garson, temizlikçi ve oyuncu aynı kapıdan geçer),
 * bulaşıkçı tek tek yıkar (workers.ts 'kWash' -> wash). Yığın en çok BULASIK.max; bulaşıkçı yokken soft'u geçince garson/temizlikçinin
 * masa silme süresi uzar (ceza, en çok 2 kat), yıkım yok. Aşama 5 öncesi (bulaşık istasyonu yok) hiçbir şey yapmaz.
 */
import type { Kernel } from './state';
import { BULASIK, bulasikCeza, mutfakEsya } from '../../content/mutfak';

export interface BulasikApi {
  aktif(): boolean;
  /** n kirli tabak yığına eklenir (aktif değilse yok sayılır); yığın tavanı BULASIK.max */
  add(n: number): void;
  count(): number;
  /** bir tabak yıkanır (yığın boşsa false) */
  wash(): boolean;
  /** masa silme süresi çarpanı: 1 .. 1 + wipeX */
  ceza(): number;
  /** masa `i` silinmeden HEMEN ÖNCE çağrılır: üstündeki kirli tabaklar yığına gider */
  masaSilindi(i: number): void;
}

export function installBulasik(K: Kernel): BulasikApi {
  const rt = K.rt, S = K.state;
  const aktif = () => mutfakEsya(S.stage || 1).includes('bulasik');
  const api: BulasikApi = {
    aktif,
    add(n) { if (!aktif() || !(n > 0)) return; rt.dirtyDishes = Math.min(BULASIK.max, (rt.dirtyDishes || 0) + Math.floor(n)); },
    count: () => rt.dirtyDishes || 0,
    wash() {
      if ((rt.dirtyDishes || 0) <= 0) return false;
      rt.dirtyDishes--; K.stat('tabakYikandi'); return true;
    },
    ceza: () => (aktif() ? bulasikCeza(rt.dirtyDishes || 0) : 1),
    masaSilindi(i) { const t = rt.tables[i]; if (t && t.dirty > 0) api.add(t.dirty); },
  };
  (rt as unknown as { bulasik?: BulasikApi }).bulasik = api;
  return api;
}
