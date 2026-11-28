/**
 * Sınıf yetenekleri (2026-10-24 user: "sınıfların skilleri yapacakları lazım ve oyundaki dünyaya etki etmeli").
 * Every class has a passive perk (always on) and one active skill with a cooldown. Actives change the world for a
 * while: more walk-ins, higher prices, a faster esnaf, a clean floor, a crowd that gathers for a song.
 * State: S.zones.yetenek { cdUntil, until } in playT seconds. rt.yetenekFx is what other systems read:
 *   arrival (customers.ts), price (economy.ts), station (stations.ts), walk (walk.ts walkBoost).
 * Command { kind: 'yetenek', op: 'use' }.
 */
import type { Kernel } from './state';
import { esnafimSave, type Sinif } from './esnafim';
import { zeminSave } from './zemin';
import { walkBoost } from './walk';

export interface YetenekDef { ad: string; icon: string; desc: string; sure: number; cd: number; fx: Partial<YetenekFx>; pasif: Partial<YetenekFx>; temiz?: boolean; dans?: boolean }
export interface YetenekFx { arrival: number; price: number; station: number; walk: number }
export const YETENEK: Record<Sinif, YetenekDef> = {
  asci: { ad: 'Usta Dokunuşu', icon: '🔥', desc: '60 sn boyunca her şey %25 daha pahalıya satılır, kimse itiraz etmez.', sure: 60, cd: 300, fx: { price: 0.25 }, pasif: { price: 0.05 } },
  tuccar: { ad: 'Kampanya!', icon: '📣', desc: '60 sn bağırarak müşteri çağırırsın: gelen kişi %60 artar.', sure: 60, cd: 300, fx: { arrival: 0.6 }, pasif: { arrival: 0.04 } },
  balikci: { ad: 'Taze Balık Günü', icon: '🐟', desc: '90 sn iskele balık kokar, martılar ve müşteriler toplanır: gelen kişi %40, fiyat %10 artar.', sure: 90, cd: 360, fx: { arrival: 0.4, price: 0.1 }, pasif: { arrival: 0.03 } },
  tamirci: { ad: 'Hızlı Bakım', icon: '🔧', desc: 'Zemin anında temizlenir, tezgahlar 60 sn %35 hızlı çalışır.', sure: 60, cd: 300, fx: { station: 0.35 }, pasif: { station: 0.05 }, temiz: true },
  kurye: { ad: 'Turbo', icon: '🛵', desc: '45 sn %60 daha hızlı koşarsın.', sure: 45, cd: 240, fx: { walk: 0.6 }, pasif: { walk: 0.1 } },
  bahcivan: { ad: 'Bahçeden Sofraya', icon: '🌿', desc: '75 sn taze malzeme: fiyat %15, tezgah hızı %15 artar.', sure: 75, cd: 300, fx: { price: 0.15, station: 0.15 }, pasif: { price: 0.03 } },
  sanatci: { ad: 'Sokak Konseri', icon: '🎸', desc: '45 sn çalarsın, kalabalık toplanır ve dans eder: gelen kişi %80 artar.', sure: 45, cd: 300, fx: { arrival: 0.8 }, pasif: { arrival: 0.03 }, dans: true },
  sporcu: { ad: 'Enerji Patlaması', icon: '⚡', desc: '60 sn hem koşu hem tezgah %30 hızlanır.', sure: 60, cd: 300, fx: { walk: 0.3, station: 0.3 }, pasif: { walk: 0.05 } },
};
const ZERO: YetenekFx = { arrival: 0, price: 0, station: 0, walk: 0 };
export interface YetenekSave { cdUntil: number; until: number }
export const yetenekSave = (S: { zones: Record<string, Record<string, unknown>> }) => (S.zones.yetenek ||= { cdUntil: 0, until: 0 }) as unknown as YetenekSave;

export function installYetenek(K: Kernel) {
  const S = K.state, rt = K.rt as unknown as { yetenekFx?: YetenekFx; yetenek?: { ad: string; icon: string; left: number; cd: number; sure: number; cdMax: number; desc: string; dans: boolean } };
  return {
    update(): void {
      const e = esnafimSave(S), d = YETENEK[e.sinif] || YETENEK.asci, y = yetenekSave(S), t = S.playT || 0;
      const on = e.done && y.until > t;
      const fx: YetenekFx = { ...ZERO };
      if (e.done) for (const k of Object.keys(fx) as (keyof YetenekFx)[]) fx[k] = (d.pasif[k] || 0) + (on ? d.fx[k] || 0 : 0);
      rt.yetenekFx = fx;
      walkBoost.x = 1 + fx.walk;
      rt.yetenek = { ad: d.ad, icon: d.icon, desc: d.desc, left: on ? y.until - t : 0, cd: Math.max(0, y.cdUntil - t), sure: d.sure, cdMax: d.cd, dans: on && !!d.dans };
    },
    run(c: { op: string }): boolean {
      if (c.op !== 'use') return false;
      const e = esnafimSave(S), d = YETENEK[e.sinif] || YETENEK.asci, y = yetenekSave(S), t = S.playT || 0;
      if (!e.done) return false;
      if (y.cdUntil > t) { K.toast(d.ad + ' ' + Math.ceil(y.cdUntil - t) + ' sn sonra hazır.', 'info'); return false; }
      y.until = t + d.sure; y.cdUntil = t + d.cd;
      if (d.temiz) zeminSave(S).kir = 0;
      K.toast(d.icon + ' ' + d.ad + '! ' + d.desc, 'good'); K.logEv('yetenek', { sinif: e.sinif });
      return true;
    },
  };
}
export const yetenekFxOf = (rt: unknown): YetenekFx => (rt as { yetenekFx?: YetenekFx }).yetenekFx || ZERO;
