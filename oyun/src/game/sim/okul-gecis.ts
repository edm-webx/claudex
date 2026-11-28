/**
 * Martıköy İlkokulu geçişi (2026-11-28 sahip: "okul da içine girilebilecek AVM gibi"). Karşı yakadaki okul binasının kapısına yürüyen
 * okul diyarına (content/realm.ts 'okul', content/okul-ic.ts) geçer, okul bahçesinin çit kapısında belirir; çit kapısından dışarı yürüyen
 * okulun kapısının önüne döner. Diyar, disari.ts'in duvar kuralında konuma göre benimsenir. Görünümde kamera atlamayı görüp kısa bir kararma
 * yapar (boot.ts). Saf sim. (AVM'nin sim/avm-gecis.ts'iyle aynı kalıp.)
 */
import { OKUL_DIS, OKUL_DIS_CIKIS, OKUL_GIRIS_IC, OKUL_CIKIS_Z, CIT_KAPI, okulProgram } from '../../content/okul-ic';
import { realmAt } from '../../content/realm';
import type { Kernel } from './state';

export const OKUL_KAPI_MENZIL = 0.8;

export function installOkulGecis(K: Kernel, teleport: (x: number, z: number, kat?: number) => void): { update(dt: number): void; icerde(): boolean } {
  let cd = 0;
  const icerde = () => realmAt(K.playerPos.x)?.id === 'okul';
  return {
    icerde,
    update(dt) {
      if ((cd -= dt) > 0) return;
      const p = K.playerPos;
      if (!icerde()) {
        if (Math.hypot(p.x - OKUL_DIS.x, p.z - OKUL_DIS.z) < OKUL_KAPI_MENZIL) {
          cd = 1; teleport(OKUL_GIRIS_IC.x, OKUL_GIRIS_IC.z, 0);
          const t = K.state.tut as Record<string, unknown>, pr = okulProgram(K.hour());
          if (!t.okulIlk) { t.okulIlk = 1; K.toast('Martıköy İlkokulu\'na hoş geldin! Sınıfları, müdür odasını, kantini ve bahçeyi gez. İngilizce dersi 3-A\'da.', 'good'); }
          else K.toast('🏫 Martıköy İlkokulu · ' + pr.ad, 'info');
        }
      } else if (p.z < OKUL_CIKIS_Z && p.x > CIT_KAPI.x0 && p.x < CIT_KAPI.x1) {
        cd = 1; teleport(OKUL_DIS_CIKIS.x, OKUL_DIS_CIKIS.z, 0);
      }
    },
  };
}
