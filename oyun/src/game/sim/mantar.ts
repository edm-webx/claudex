/**
 * Belgrad Ormanı mantar avı (16:52 user: "ormanda mantar arıycaz"). Each game day seeds MANTAR_PER_DAY mushrooms
 * in the forest (x 800..880); walking onto one picks it into the basket. Edible ones sell to the forager on the
 * spot (money + small XP); the poisonous sinek mantarı is thrown away with a warning. Nothing persists except the
 * day's picked list and the lifetime count: S.zones.mantar { day, taken[], toplam }.
 * View reads rt.mantar { items: {i,id,x,z}[] } (view/orman draws them).
 * DNY-10: spots are checked against the forest colliders/trails (mantarYeriUygun); fountain and pond visits count
 * stats ormanCesme / ormanGol once a day (forest goals in content/goals.ts).
 */
import type { Kernel } from './state';
import { MANTARLAR, MANTAR_PER_DAY, ORMAN, REGION_BY_ID } from '../../content/disari/martikoy';
import { ormanEngeller, ormanZone } from '../../content/zones/disari';
import { fmtMoney } from './util';

interface MSave { day: number; taken: number[]; toplam: number; /** DNY-10: day the fountain / pond was last visited (bölge hedefleri) */ cesme?: number; gol?: number }
export interface MantarItem { i: number; id: string; x: number; z: number }

function hash(n: number) { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; }
/** DNY-10: a spot is fine when it is off the trails and cross paths, clear of every forest collider (0.55 m margin),
 *  away from the bus bay/stop and inside the walkable band walkZ('orman') (z -4..20). */
export function mantarYeriUygun(x: number, z: number): boolean {
  if (x < ORMAN.x0 + 4 || x > ORMAN.x1 - 3 || z < -4 || z > 20) return false;
  if (ORMAN.trailsZ.some(t => Math.abs(z - t) < 1.85)) return false;
  if (ORMAN.cross.some(([cx, za, zb]) => Math.abs(x - cx) < 1.5 && z > za - 0.3 && z < zb + 0.3)) return false;
  if (x < ORMAN.yol.x + ORMAN.yol.w / 2 + 1 && Math.abs(z - ORMAN.yol.z) < 2.4) return false;
  const st = REGION_BY_ID.orman.stop; if (Math.hypot(x - st.x, z - st.z) < 5) return false;
  // 2026-11-21 mantık denetimi: piknik örtüsü / mangal / masanın çarpışması yok, mantar örtünün üstünde çıkıyordu
  if (yumusak().some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r)) return false;
  const m = 0.55;
  return !ormanEngeller().some(r => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m);
}
let _yum: [number, number, number][] | null = null;
const YUMUSAK: Record<string, number> = { 'mk.ortu': 2.0, 'mk.mangal': 1.4, 'mk.piknik': 1.9 };
function yumusak() { return _yum || (_yum = ormanZone().props.filter(p => YUMUSAK[p.prefab]).map(p => [p.pos.x, p.pos.z, YUMUSAK[p.prefab]] as [number, number, number])); }
const nearTree = (x: number, z: number) => ormanEngeller().some(r => r.x1 - r.x0 < 1.3 && Math.hypot(x - (r.x0 + r.x1) / 2, z - (r.z0 + r.z1) / 2) < 3.2);
export function mantarlarOf(day: number): MantarItem[] {
  const tot = MANTARLAR.reduce((a, m) => a + m.w, 0), out: MantarItem[] = [];
  for (let i = 0; i < MANTAR_PER_DAY; i++) {
    const r = hash(day * 97 + i * 13 + 1);
    let k = r * tot, m: typeof MANTARLAR[number] = MANTARLAR[0];
    for (const c of MANTARLAR) { if (k < c.w) { m = c; break; } k -= c.w; }
    // seeded tries: the first valid spot under a tree wins, else the first valid one (never on a trail or in a collider)
    let pick: { x: number; z: number } | null = null, any: { x: number; z: number } | null = null;
    for (let t = 0; t < 40 && !pick; t++) {
      const x = ORMAN.x0 + 4 + hash(day * 31 + i * 7 + t * 101 + 2) * (ORMAN.x1 - ORMAN.x0 - 7), z = -4 + hash(day * 53 + i * 11 + t * 89 + 3) * 24;
      if (!mantarYeriUygun(x, z) || out.some(o => Math.hypot(o.x - x, o.z - z) < 2.4)) continue;
      if (!any) any = { x, z };
      if (nearTree(x, z)) pick = { x, z };
    }
    const p = pick || any; if (!p) continue;
    out.push({ i, id: m.id, x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 });
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
      // DNY-10 places of the forest: once a day each (counted for the forest goals)
      const C = ORMAN.cesme, G = ORMAN.gol;
      if (z.cesme !== day && Math.hypot(p.x - C.x, p.z - (C.z + 1.6)) < 2.2) { z.cesme = day; K.stat('ormanCesme'); K.toast('Buz gibi çeşme suyu! Avucunla içtin, kendine geldin.', 'good'); }
      if (z.gol !== day && Math.abs(p.x - G.x) < G.rx + 2.2 && Math.abs(p.z - G.z) < G.rz + 2.4) { z.gol = day; K.stat('ormanGol'); K.toast('Gölette ördekler süzülüyor, kurbağalar vıraklıyor.', 'good'); }
      for (const m of items) {
        if (Math.hypot(p.x - m.x, p.z - m.z) > 1.1) continue;
        z.taken.push(m.i);
        const def = MANTARLAR.find(x => x.id === m.id)!;
        if ('zehir' in def && def.zehir) { K.toast('Sinek mantarı! Kırmızı, beyaz benekli: ZEHİRLİ. Sepete koymadın, iyi ki.', 'bad'); continue; }
        z.toplam++; K.credit!('orman', def.price); K.addXP(3); K.stat('mantar');
        const left = items.length - 1;
        K.toast('🍄 ' + def.name + ' buldun! Ormancı Hüsnü aldı: +' + fmtMoney(def.price) + (left > 0 ? ' · ormanda ' + left + ' mantar daha var' : ' · bugünlük bitti, yarın yine gel'), 'good');
      }
    },
  });
}
