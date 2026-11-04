/**
 * Ana hikaye sim (content/gizem.ts). State S.zones.gizem = { basla, oku: {id: day} }. A clue can be read only near its spot
 * and only after its prerequisites; each is read once. Command { kind: 'gizem', op: 'oku' } reads the nearest available one.
 */
import type { Kernel } from './state';
import { IPUCLARI, IPUCU_BY_ID, SABRI_GUN, BITIS, HEDEF_METIN, SOHBET } from '../../content/gizem';

interface GSave { basla: boolean; oku: Record<string, number>; sohbet?: number }
const RANGE = 3.4;

export function installGizem(K: Kernel) {
  const S = K.state, rt = K.rt as unknown as Record<string, unknown>;
  const z = (): GSave => { const g = (S.zones.gizem ||= {}) as unknown as GSave; g.oku ||= {}; g.basla = !!g.basla; return g; };
  const acik = (id: string) => { const g = z(); return g.basla && !g.oku[id] && IPUCU_BY_ID[id].once.every(o => g.oku[o]); };
  const dist = (id: string) => Math.hypot(K.playerPos.x - IPUCU_BY_ID[id].x, K.playerPos.z - IPUCU_BY_ID[id].z);
  const yakin = () => IPUCLARI.find(i => acik(i.id) && dist(i.id) < RANGE)?.id || null;

  function hedef(): string {
    const g = z(); if (!g.basla) return 'bekle';
    if (!g.oku.mektup) return 'mektup';
    if (!(g.oku.hesap && g.oku.sapka && g.oku.ilan)) return 'izle';
    if (!g.oku.bilet) return 'barinak';
    if (!g.oku.kapak) return 'belgrad';
    if (!g.oku.sabri) return 'kulube';
    if (!g.oku.oy) return 'muhtar';
    return 'bitti';
  }
  function oku(): boolean {
    const id = yakin(); if (!id) { K.toast('Yakında incelenecek bir şey yok.', 'info'); return false; }
    const g = z(); g.oku[id] = S.day; K.stat('ipucu'); K.addXP(40);
    K.toast(IPUCU_BY_ID[id].ikon + ' ' + IPUCU_BY_ID[id].baslik, 'good'); K.logEv('ipucu', { id });
    rt.sonIpucu = id;
    if (id === 'oy') { K.earn(BITIS.para); S.gold += BITIS.altin; K.addXP(BITIS.xp); K.toast('Hikaye tamam! +' + BITIS.para + ' ₺ ve ' + BITIS.altin + ' Altın Simit', 'good'); }
    K.saveNow(); return true;
  }
  K.addSystem({ id: 'gizem', order: 52, phase: 'sim', step() {
    if (!K.rt.started) return;
    const g = z();
    if (g.basla && g.sohbet !== S.day && K.hour() >= 10) {
      g.sohbet = S.day; const L = SOHBET[hedef()]; if (L && S.day > SABRI_GUN) { const [w, t] = L[S.day % L.length]; K.toast('💬 ' + w + ': ' + t, 'info'); }
    }
    if (!g.basla && S.day >= SABRI_GUN && K.hour() >= 8) { g.basla = true; K.toast('Sabri Abi tezgahta yok! Bir mektup bırakmış.', 'bad'); K.logEv('sabriGitti', {}); }
  } });
  const api = {
    handle(c: { op: string }): boolean { return c.op === 'oku' ? oku() : false; },
    view() { const g = z(); return { yakin: yakin(), hedef: hedef(), acik: IPUCLARI.filter(i => acik(i.id)).map(i => ({ id: i.id, x: i.x, z: i.z, ikon: i.ikon })), sabriBelgrad: g.basla && !!g.oku.kapak && !g.oku.oy, sabriBuldu: !!g.oku.sabri }; },
    model() {
      const g = z(), h = hedef();
      return { basla: g.basla, hedef: HEDEF_METIN[h], bitti: h === 'bitti', oku: IPUCLARI.filter(i => g.oku[i.id]).map(i => ({ id: i.id, ikon: i.ikon, baslik: i.baslik, yer: i.yer, metin: i.metin, gun: g.oku[i.id] })), son: String(rt.sonIpucu || '') };
    },
  };
  rt.gizem = api;
  return api;
}
export type GizemApi = ReturnType<typeof installGizem>;
