/**
 * Belgrad Ormanı mantar avı (16:52 user: "ormanda mantar arıycaz"). Each game day seeds MANTAR_PER_DAY mushrooms
 * in the forest (x 800..880); walking onto one picks it into the basket. Edible ones sell to the forager on the
 * spot (money + small XP); the poisonous sinek mantarı is thrown away with a warning. Nothing persists except the
 * day's picked list and the lifetime count: S.zones.mantar { day, taken[], toplam }.
 * View reads rt.mantar { items: {i,id,x,z}[] } (view/orman draws them).
 */
import type { Kernel } from './state';
import { MANTARLAR, MANTAR_PER_DAY } from '../../content/disari/martikoy';
import { fmtMoney } from './util';

interface MSave { day: number; taken: number[]; toplam: number }
export interface MantarItem { i: number; id: string; x: number; z: number }

function hash(n: number) { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; }
export function mantarlarOf(day: number): MantarItem[] {
  const tot = MANTARLAR.reduce((a, m) => a + m.w, 0), out: MantarItem[] = [];
  for (let i = 0; i < MANTAR_PER_DAY; i++) {
    const r = hash(day * 97 + i * 13 + 1), rx = hash(day * 31 + i * 7 + 2), rz = hash(day * 53 + i * 11 + 3);
    let k = r * tot, m: typeof MANTARLAR[number] = MANTARLAR[0];
    for (const c of MANTARLAR) { if (k < c.w) { m = c; break; } k -= c.w; }
    // under the trees along both edges of the clearing, away from the trail
    const north = rz < 0.5;
    out.push({ i, id: m.id, x: 806 + rx * 70, z: north ? 17.5 + hash(i + day) * 3.5 : -2.5 + hash(i * 3 + day) * 3.5 });
  }
  return out;
}

export function installMantar(K: Kernel) {
  const S = K.state;
  const save = () => { const z = (S.zones.mantar ||= { day: -1, taken: [], toplam: 0 }) as unknown as MSave; if (!Array.isArray(z.taken)) z.taken = []; return z; };
  let acc = 0;
  K.addSystem({
    id: 'mantar', order: 49, phase: 'sim',
    step(ctx) {
      const rtx = K.rt as unknown as Record<string, unknown>;
      const p = K.playerPos;
      if (p.x < 795 || p.x > 885) { rtx.mantar = null; return; }
      const z = save(), day = S.day || 1;
      if (z.day !== day) { z.day = day; z.taken = []; }
      const items = mantarlarOf(day).filter(m => !z.taken.includes(m.i));
      rtx.mantar = { items, toplam: z.toplam };
      if (K.rt.paused) return;
      acc += ctx.dt; if (acc < 0.15) return; acc = 0;
      for (const m of items) {
        if (Math.hypot(p.x - m.x, p.z - m.z) > 1.1) continue;
        z.taken.push(m.i);
        const def = MANTARLAR.find(x => x.id === m.id)!;
        if ('zehir' in def && def.zehir) { K.toast('Sinek mantarı! Kırmızı, beyaz benekli: ZEHİRLİ. Sepete koymadın, iyi ki.', 'bad'); continue; }
        z.toplam++; S.money += def.price; K.addXP(3); K.stat('mantar');
        const left = items.length - 1;
        K.toast('🍄 ' + def.name + ' buldun! Ormancı Hüsnü aldı: +' + fmtMoney(def.price) + (left > 0 ? ' · ormanda ' + left + ' mantar daha var' : ' · bugünlük bitti, yarın yine gel'), 'good');
      }
    },
  });
}
