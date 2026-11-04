/** Decor, Şıklık and the sign (v2 decorAct / saveSign). decorSlots = placed items [{slot: "<index>", item}]. Owner: Builder A. Pure. */
import { DECOR_IDS, decorById, siklik as siklikOf, P } from '../../content/economy';
import { cleanSign, SIGN_FONTS } from '../../content/sign-fonts';
import type { Kernel } from './state';
import { fmtMoney } from './util';

const SIZE_N: Record<string, number> = { s: 1, m: 2, l: 3 };
export function installDecor(K: Kernel) {
  const rt = K.rt, S = K.state;
  const itemAt = (i: number) => S.decorSlots.find(d => d.slot === String(i))?.item || null;
  K.placedDecor = () => S.decorSlots.map(d => d.item);
  K.refreshSiklik = () => { rt.siklik = siklikOf(K.placedDecor(), S.stage); K.statMax('siklikBest', rt.siklik); };
  K.siklikBonus = () => 0;   // 2026-10-25 decor off
  const freeSlotFor = (id: string): number => {
    const d = decorById(id), need = SIZE_N[d ? d.size : 's'] || 1;
    let best = -1;
    rt.layout.slots.forEach((s, i) => {
      if (itemAt(i)) return;
      if ((SIZE_N[s.size] || 2) >= need && (best < 0 || (SIZE_N[s.size] || 2) < (SIZE_N[rt.layout.slots[best].size] || 2))) best = i;
    });
    return best;
  };
  const placeAt = (i: number, id: string) => { S.decorSlots = S.decorSlots.filter(d => d.slot !== String(i)); S.decorSlots.push({ slot: String(i), item: id }); K.refreshSiklik(); };
  return {
    buy(id: string) {
      const d = decorById(id); if (!d || !DECOR_IDS.includes(id)) return;
      if (S.money < d.price) { K.toast('Para yetmiyor abi: ' + fmtMoney(d.price), 'bad'); return; }
      K.spend(d.price); S.decorOwned.push(id); K.stat('decorBought'); K.renewNext(); K.addXP(P.XP.buy);
      const i = freeSlotFor(id);
      if (i >= 0) {
        placeAt(i, id); K.toast(d.name + ' yerleştirildi! Bak, orada.', 'good');
        // Faz 2 (dekor-27): close the sheet and show the new item for a moment so the player sees where it went
        const sp = rt.layout.slots[i].pos; rt.uiLast.decorFocus = { x: sp.x, z: sp.z, until: S.playT + 2.6, reopen: true };   // survey 2026-10-24: then the sheet reopens on the shape/colour card (rt as unknown as { dekorEv?: { select(n: number): void } }).dekorEv?.select(i);
      } else K.toast(d.name + ' alındı. Boş yer açınca yerleştir.', 'info');
      K.logEv('decorBuy', { id }); K.saveNow();
    },
    place(id: string) {
      const owned = S.decorOwned.filter(x => x === id).length, placed = S.decorSlots.filter(x => x.item === id).length;
      if (owned <= placed) return;
      const i = freeSlotFor(id); if (i < 0) { K.toast('Boş yer yok. Önce bir dekoru kaldır.', 'info'); return; }
      placeAt(i, id); K.saveNow();
    },
    remove(i: number) { if (!itemAt(i)) return; S.decorSlots = S.decorSlots.filter(d => d.slot !== String(i)); K.refreshSiklik(); K.saveNow(); },
    // survey 2026-10-24: döndürme. Every press turns the item a quarter turn (0, 90, 180, 270 degrees).
    rotate(i: number) { const d = S.decorSlots.find(x => x.slot === String(i)); if (!d) return; d.rotY = (((d.rotY || 0) + Math.PI / 2) % (Math.PI * 2)); K.saveNow(); },
    saveSign(text: string, font?: string): boolean {
      const r = cleanSign(text, S.hero);
      if (!r.ok) { K.toast(r.reason || 'Olmadı.', 'bad'); return false; }
      const f = SIGN_FONTS.some(x => x.id === font) ? (font as string) : 'vapur';
      S.sign = { text: r.text, font: f, renamed: true };
      K.stat('signRenamed'); K.toast('Tabela yenilendi: ' + r.text, 'good'); K.logEv('sign', { text: r.text }); K.saveNow();
      return true;
    },
    itemAt,
  };
}
