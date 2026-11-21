/**
 * Martı AVM geçişi (2026-11-21 18:46 sahip: "AVM'ye girildiğinde başka bir haritaya geçilsin, orada ayrı gezilebilsin").
 * İskeledeki AVM binasının giriş kapısına yürüyen AVM diyarına (content/realm.ts 'avm', content/avm-kat.ts) geçer; içeride zemin
 * katın girişinden dışarı yürüyen kapının önüne çıkar. Diyar, disari.ts'in duvar kuralında konuma göre benimsenir.
 * Görünümde kamera atlamayı görüp kısa bir kararma yapar (boot.ts). Saf sim.
 */
import { AVM, AVM_DIS, AVM_DIS_CIKIS, AVM_GIRIS_IC, AVM_CIKIS_Z, GIRIS_KAPI } from '../../content/avm-kat';
import { realmAt } from '../../content/realm';
import type { Kernel } from './state';

export const AVM_KAPI_MENZIL = 0.8;

export function installAvmGecis(K: Kernel, teleport: (x: number, z: number, kat?: number) => void): { update(dt: number): void; icerde(): boolean } {
  let cd = 0;
  const icerde = () => realmAt(K.playerPos.x)?.id === 'avm';
  return {
    icerde,
    update(dt) {
      if ((cd -= dt) > 0) return;
      const p = K.playerPos as { x: number; z: number; kat?: number };
      if (!icerde()) {
        if (Math.hypot(p.x - AVM_DIS.x, p.z - AVM_DIS.z) < AVM_KAPI_MENZIL) {
          cd = 1; teleport(AVM_GIRIS_IC.x, AVM_GIRIS_IC.z + 0.35, 0);
          const t = K.state.tut as Record<string, unknown>;
          if (!t.avmIlk) { t.avmIlk = 1; K.toast('Martı AVM\'ye hoş geldin! Yürüyen merdivenle katlara çık, dükkânları gez.', 'good'); }
        }
      } else if (!p.kat && p.z < AVM_CIKIS_Z && p.x > GIRIS_KAPI.x0 && p.x < GIRIS_KAPI.x1 && p.x > AVM.x0) {
        cd = 1; teleport(AVM_DIS_CIKIS.x, AVM_DIS_CIKIS.z, 0);
      }
    },
  };
}
