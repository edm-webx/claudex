/**
 * Odaya misafir olarak girmek (online.ts "dünya"). Kural geçmişi:
 *  - 2026-10-25 sahip: "odamda çalışan arkadaşım maaş gibi para alsın ama benim payımdan gitmesin".
 *  - 2026-11-23 sahip: "öğrencilerle girdik, bende ne para varsa onlarda da o görünüyor" (misafir ev sahibinin parasını görüyordu).
 *  - 2026-11-25 sahip: "paranın ortak oluşunu dert ediyorlar ... bir mmorpg gibi düşün herkesin seviyesi parası gelişimi kendine,
 *    gelen arkadaş yardım ediyor karşılığında maaş alıyor".
 * Şimdiki kural:
 *  - Herkesin parası, altını, seviyesi kendinedir. Misafirin ekranında yalnız kendi cüzdanı durur; ev sahibinin kasası yazmaz.
 *  - Misafirin ev sahibinin büfesinde sattığı ev sahibinin kasasına gider (yardım). Misafire oyun satışın MISAFIR_MAAS kadarını
 *    maaş olarak basar (ev sahibinden kesilmez, misafirin parası hiç geri düşmez): sim/economy.ts.
 *  - Misafirin kazandığı XP kendi seviyesine yazılır (sim/levels.ts); ev sahibinin dünyasındaki seviye / kapılar onunkidir.
 *  - Ev sahibinin dünyasını değiştiren alışveriş, kira / fatura, pasif gelir misafire kapalı: sim/misafir-kural.ts.
 *  - Maaş ve XP düzenli olarak misafirin KENDİ kaydına yazılır (sekme kapansa da kaybolmaz, boot.ts).
 * Saf yardımcılar (boot.ts world köprüsü kullanır, tests/sim/misafir-para.test.ts).
 */
import { xpForLevel } from '../../content/economy';
import { MISAFIR_MAAS } from '../sim/misafir-kural';
export { MISAFIR_MAAS };
type Rec = Record<string, unknown>;

/** ev sahibinin dünyası + misafirin kendi kimliği ve cüzdanı. Ev sahibinin toplanmamış kasası misafire geçmez (pile 0). */
export function misafirDunya(own: Rec, host: Rec): Rec {
  return { ...host, money: own.money, gold: own.gold, player: own.player, settings: own.settings, hero: own.hero, lastSeen: own.lastSeen, pile: 0, zones: { ...(host.zones as Rec), esnafim: (own.zones as Rec | undefined)?.esnafim } };
}
/** misafirin kendi kaydı: misafirken değişen cüzdan, kazandığı XP (seviye atlatır), `sure` sn oyun süresi (bulut kaydı daha yeni sayılsın) */
export function misafirDonus(own: Rec, cur: Rec, sure = 0, xp = 0): Rec {
  let level = Math.max(1, Number(own.level) || 1), x = Math.max(0, Number(own.xp) || 0) + Math.max(0, xp);
  for (let need = xpForLevel(level); x >= need; need = xpForLevel(level)) { x -= need; level++; }
  return { ...own, money: cur.money, gold: cur.gold, xp: x, level, playT: (Number(own.playT) || 0) + Math.max(0, sure) };
}
/** misafirin yerel dünyasında toplanmamış satış parası (kasa yığını, masa bahşişi, yerdeki para) */
export function toplanmamis(rt: { kasa?: { value: number }[]; tables?: { pile?: { value: number }[] }[]; floor?: { value: number }[] }): number {
  const sum = (p?: { value: number }[]) => (p || []).reduce((a, b) => a + (Number(b.value) || 0), 0);
  return Math.floor(sum(rt.kasa) + (rt.tables || []).reduce((a, t) => a + sum(t.pile), 0) + sum(rt.floor));
}
/** dünya yenilenirken / çıkarken toplanmamış satıştan misafirin cebine geçen maaş */
export const toplanmamisMaas = (rt: Parameters<typeof toplanmamis>[0]): number => Math.floor(toplanmamis(rt) * MISAFIR_MAAS);
