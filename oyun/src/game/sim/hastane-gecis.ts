/**
 * Devlet Hastanesi geçişi (2026-11-28 sahip: "hastanenin içi de AVM gibi açılsın"). sim/avm-gecis.ts ile aynı kural:
 * iskeledeki hastanenin ön kapısına yürüyen hastane diyarına (content/realm.ts 'hastane', content/hastane-kat.ts) geçer;
 * zemin katın girişinden dışarı yürüyen kapının önüne çıkar. Asansörler: kabin kapısının önünde ASANSOR_BEKLE sn duran,
 * soldakiyle bir üst, sağdakiyle bir alt kata çıkar (en üst / en alt katta o kabin çalışmaz, söyler). Saf sim.
 */
import { HST, HST_DIS, HST_DIS_CIKIS, HST_GIRIS_IC, HST_CIKIS_Z, GIRIS_KAPI, ASANSOR, KAT_ADI } from '../../content/hastane-kat';
import { realmAt } from '../../content/realm';
import type { Kernel } from './state';

export const HST_KAPI_MENZIL = 0.8, ASANSOR_BEKLE = 0.7;
/** asansör kapısının önü: kabinin önünde 1.1 m genişlik, duvardan 0.9 m */
export const asansorOnu = (p: { x: number; z: number }) => ASANSOR.find(a => Math.abs(p.x - a.x) < 0.55 && p.z > a.z - 0.9) || null;

export function installHastaneGecis(K: Kernel, teleport: (x: number, z: number, kat?: number) => void): { update(dt: number): void; icerde(): boolean } {
  let cd = 0, bek = 0, uyari = '';
  const icerde = () => realmAt(K.playerPos.x)?.id === 'hastane';
  return {
    icerde,
    update(dt) {
      if ((cd -= dt) > 0) return;
      const p = K.playerPos as { x: number; z: number; kat?: number };
      if (!icerde()) {
        if (Math.hypot(p.x - HST_DIS.x, p.z - HST_DIS.z) < HST_KAPI_MENZIL) {
          cd = 1; teleport(HST_GIRIS_IC.x, HST_GIRIS_IC.z + 0.35, 0);
          const t = K.state.tut as Record<string, unknown>;
          if (!t.hstIlk) { t.hstIlk = 1; K.toast('Devlet Hastanesi\'ne hoş geldin! Hasta kabule uğra, merdiven ya da asansörle katları gez.', 'good'); }
        }
        return;
      }
      const kat = p.kat || 0;
      if (!kat && p.z < HST_CIKIS_Z && p.x > GIRIS_KAPI.x0 && p.x < GIRIS_KAPI.x1 && p.x > HST.x0) { cd = 1; teleport(HST_DIS_CIKIS.x, HST_DIS_CIKIS.z, 0); return; }
      const a = asansorOnu(p);
      if (!a) { bek = 0; uyari = ''; return; }
      const hedef = kat + a.yon;
      if (hedef < 0 || hedef >= HST.KAT) { if (uyari !== a.id) { uyari = a.id; K.toast(a.yon > 0 ? '🛗 Bu asansör yukarı çıkar; en üst kattasın.' : '🛗 Bu asansör aşağı iner; zemin kattasın.', 'info'); } return; }
      if ((bek += dt) < ASANSOR_BEKLE) return;
      bek = 0; cd = 1.2; teleport(a.x, a.z - 1.35, hedef);
      K.toast('🛗 ' + KAT_ADI[hedef], 'info');
    },
  };
}
