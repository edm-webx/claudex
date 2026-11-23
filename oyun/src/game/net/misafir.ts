/**
 * Odaya misafir olarak girmek (online.ts "dünya"): 2026-11-23 sahip "öğrencilerle girdik, bende ne para varsa onlarda da o görünüyor".
 * Kural (2026-10-25 sahip: "odamda çalışan arkadaşım maaş gibi para alsın ama benim payımdan gitmesin"):
 *  - Misafir ev sahibinin büfesinde çalışır ama CÜZDANI KENDİSİNİNDİR: ekranda kendi parası / altını görünür.
 *  - Sattığı her şey ev sahibinin kasasına gider (online 'kasa'); misafire oyun ayrıca satışın MISAFIR_MAAS payını maaş olarak basar
 *    (ev sahibinden kesilmez).
 *  - Ev sahibinin kasası misafirde yalnız bilgi olarak durur (oda rozeti). Misafir sarı kare açamaz: kareleri ev sahibi açar
 *    (yoksa harcanan para yalnız misafirin ekranında kaybolur, iki dünya kayar).
 *  - Odadan çıkınca kendi kaydına döner; misafirken kazandığı maaş cebinde kalır.
 * Saf yardımcılar (boot.ts world köprüsü kullanır, tests/sim/misafir-para.test.ts).
 */
type Rec = Record<string, unknown>;
export const MISAFIR_MAAS = 0.25;

/** ev sahibinin dünyası + misafirin kendi kimliği ve cüzdanı */
export function misafirDunya(own: Rec, host: Rec): Rec {
  return { ...host, money: own.money, gold: own.gold, player: own.player, settings: own.settings, hero: own.hero, lastSeen: own.lastSeen, zones: { ...(host.zones as Rec), esnafim: (own.zones as Rec | undefined)?.esnafim } };
}
/** misafirin sattığı `satis` ₺ yerelde cebe girdi; ev sahibine gidiyor, cebe yalnız maaş kalır */
export function misafirMaas(money: number, satis: number): number {
  if (!(satis > 0)) return money;
  return Math.max(0, Math.round((money - satis + satis * MISAFIR_MAAS) * 100) / 100);
}
/** odadan çıkış: kendi kaydı, misafirken değişen cüzdanla */
export function misafirDonus(own: Rec, cur: Rec): Rec {
  return { ...own, money: cur.money, gold: cur.gold };
}
