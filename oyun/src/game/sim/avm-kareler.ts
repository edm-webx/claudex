/**
 * Martı AVM sarı kareleri (2026-11-21 18:46 sahip: "dükkânlarda para yatırıp alet alacağımız, büfedeki gibi kareler; aynı ilk
 * büfemiz gibi olacak geliştirme işi"). Büfenin sarı karesiyle aynı akış (sim/pads.ts, görünüm view/world/rtview.ts):
 * üstünde durunca cepten para akar, dolunca açılır. İki tür kare:
 *  - dükkân kapısının önünde (holde) satın alma karesi: dolunca dükkân senin (mulk arsaAl). Kilitliyse kare görünür ama
 *    para almaz, neden kilitli olduğunu yazar (seviye / önce katın öncü dükkânı).
 *  - sahip olunan dükkânın içinde sıradaki iki alet (seviyesi yeten, en ucuzdan): dolunca alet kurulur (mulk kafeEsya).
 * Ödenen para S.padPaid['avm.<arsa>.<alet>'] içinde kalır (yarım bırakılan kare kaydedilir, büfeyle aynı alan).
 * Kare oyuncunun katında çalışır; görünüm kareyi katın yüksekliğinde çizer.
 */
import type { Vec2 } from '../../engine/api';
import { ARSALAR, ISLETME, ARSA_ISLETME, type Arsa } from '../../content/esya';
import { icBina, icWorld, icDim, type IcMekan } from '../../content/ic-mekan';
import { HOL, katY } from '../../content/avm-kat';
import type { Kernel, PadRt } from './state';

interface Plot { lv: number; esya?: string[]; tadilat?: unknown }
export interface AvmKareApi { arsaAl(id: string): void; kafeEsya(id: string, e: string): void; plot(id: string): Plot | undefined }
interface Kare { key: string; pos: Vec2; kat: number; label: string; sub: string; price: number; kilit: string; done: () => void }

const ROOMS: { m: IcMekan; a: Arsa }[] = icBina('avm').filter(m => m.arsa).map(m => ({ m, a: ARSALAR.find(x => x.id === m.arsa)! }));
/** satın alma karesi: dükkân kapısının önünde, holün yürüyüş yolunda */
export const satisKaresi = (a: Arsa): Vec2 => ({ x: a.x < (HOL.x0 + HOL.x1) / 2 ? HOL.x0 + 1.15 : HOL.x1 - 1.15, z: a.z });
/** alet kareleri: dükkânın müşteri tarafında, kapının iki yanında */
export const aletKaresi = (m: IcMekan, i: number): Vec2 => icWorld(m, i ? 1.7 : -1.7, icDim(m).D / 2 - 1.95);

export function installAvmKareler(K: Kernel, api: AvmKareApi): { sync(): void } {
  const S = K.state, rt = K.rt, ids = new Map<string, PadRt>(), uyari = new Set<string>();
  const katim = () => (K.playerPos as { kat?: number }).kat || 0;
  function istenen(): Kare[] {
    const out: Kare[] = [];
    for (const { m, a } of ROOMS) {
      const kat = m.kat || 0, p = api.plot(a.id), ad = (a.ad || '').replace(' (AVM)', '');
      if (!p) {
        const kilit = S.level < a.seviye ? '🔒 ' + a.seviye + '. seviye' : a.once && !api.plot(a.once) ? '🔒 önce ' + (ARSALAR.find(x => x.id === a.once)?.ad || '').replace(' (AVM)', '') : '';
        out.push({ key: 'avm.' + a.id, pos: satisKaresi(a), kat, label: ad, sub: kilit || 'Dükkânı satın al', price: a.fiyat, kilit, done: () => api.arsaAl(a.id) });
        continue;
      }
      if (p.tadilat) continue;
      const own = p.esya || [], t = ISLETME[ARSA_ISLETME[a.id]];
      const sira = t.esya.filter(e => !own.includes(e.id) && e.lv <= p.lv).sort((x, y) => x.fiyat - y.fiyat).slice(0, 2);
      sira.forEach((e, i) => out.push({ key: 'avm.' + a.id + '.' + e.id, pos: aletKaresi(m, i), kat, label: e.ikon + ' ' + e.ad, sub: e.desc, price: e.fiyat, kilit: '', done: () => api.kafeEsya(a.id, e.id) }));
    }
    return out;
  }
  function ekle(k: Kare) {
    const pr: PadRt = { key: k.key, price: k.price, paid: S.padPaid[k.key] || 0, pos: k.pos, kind: 'avm', warned: false, label: k.label, sub: k.sub, y: katY(k.kat), kat: k.kat };
    rt.pads.push(pr); ids.set(k.key, pr);
    K.interactions.register({
      id: 'pad.' + k.key, pos: k.pos, radius: 0.8, kind: 'pad', dwell: 0, interval: 0.05,
      canAct: () => rt.pads.includes(pr) && katim() === k.kat,
      act: () => {
        if (k.kilit) { if (!uyari.has(k.key)) { uyari.add(k.key); K.toast(k.label + ': ' + k.kilit.replace('🔒 ', '') + ' gerekli.', 'info'); } return 'done'; }
        const paid = S.padPaid[k.key] || 0, left = pr.price - paid;
        if (S.money < 1) { if (!pr.warned) { pr.warned = true; K.toast('Para lazım: satış yap, kasayı topla.', 'info'); } return 'continue'; }
        const amt = Math.min(Math.max(pr.price / 1.2, 250) * 0.05, S.money, left);
        S.money -= amt; S.padPaid[k.key] = paid + amt; pr.paid = S.padPaid[k.key];
        if (S.padPaid[k.key] < pr.price - 0.01) return 'continue';
        // full: hand the money back and buy through the normal path (same checks, toast, XP, save); a refused buy keeps it in the pocket
        S.money = Math.round((S.money + S.padPaid[k.key]) * 100) / 100; delete S.padPaid[k.key]; pr.paid = 0;
        k.done(); sync(); return 'done';
      },
    });
  }
  function sil(key: string) {
    const pr = ids.get(key); if (!pr) return; ids.delete(key);
    const i = rt.pads.indexOf(pr); if (i >= 0) rt.pads.splice(i, 1);
    K.interactions.unregister('pad.' + key);
  }
  function sync() {
    const want = istenen(), keys = new Set(want.map(k => k.key));
    for (const key of [...ids.keys()]) if (!keys.has(key)) sil(key);
    for (const k of want) { const have = ids.get(k.key); if (!have) ekle(k); else if (have.sub !== k.sub) { sil(k.key); ekle(k); } }
  }
  return { sync };
}
