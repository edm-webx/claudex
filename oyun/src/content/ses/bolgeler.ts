// Ses bölgesi (DNY-17): kahraman konumundan saf ses bölgesi. Müzik ve ambiyans aynı anahtarı kullanır.
// İç mekan önce ('ic.<tür>'), sonra karşı yaka alt bölgeleri (z 28.4..59, x -62..62), sonra şerit bölgesi (regionAt).
import { regionAt } from '../disari/martikoy';
import { icHangi } from '../ic-mekan';
import { avmIcinde } from '../avm-kat';
import { okulIcinde, okulBinada } from '../okul-ic';

/** karşı yaka sınırı (content/zones/karsi.ts: z 28.4..59) */
export const KARSI = { x0: -62, x1: 62, z0: 28.4, z1: 60 } as const;

/** 'iskele' | 'karsi' | 'karsi.meydan' | 'karsi.okul' | 'karsi.halisaha' | 'ic.kafe' | 'orman' | 'stadyum' ... */
export function sesBolgesi(p: { x: number; z: number }): string {
  const ic = icHangi(p, -0.15);
  if (ic) return 'ic.' + ic.tur;
  if (avmIcinde(p, 2)) return 'ic.avm';   // Martı AVM diyarı: hol (kapalı, deniz yok)
  if (okulIcinde(p)) return okulBinada(p) ? 'ic.okul' : 'karsi.okul';   // okul diyarı: koridor kapalı, bahçe zil + çocuk
  if (p.x >= KARSI.x0 && p.x < KARSI.x1 && p.z >= KARSI.z0 && p.z <= KARSI.z1) {
    if (p.x < -26.7 && p.z > 34 && p.z < 56) return 'karsi.halisaha';
    if (p.x > -25 && p.x < 8 && p.z > 33 && p.z < 57) return 'karsi.meydan';
    if (p.x > 38 && p.z < 43) return 'karsi.okul';
    return 'karsi';
  }
  return regionAt(p.x)?.id || 'iskele';
}
