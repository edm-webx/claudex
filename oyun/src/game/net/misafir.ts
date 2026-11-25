/**
 * Odaya misafir olarak girmek (online.ts "dünya"). Kural geçmişi:
 *  - 2026-10-25 sahip: "odamda çalışan arkadaşım maaş gibi para alsın ama benim payımdan gitmesin".
 *  - 2026-11-23 sahip: "öğrencilerle girdik, bende ne para varsa onlarda da o görünüyor" (misafir ev sahibinin parasını görüyordu).
 *  - 2026-11-25 sahip: "arkadaşın oyununa katılınca paranın ortak oluşunu dert ediyorlar, öyle bir hal almalı ki dert edilmemeli".
 * Şimdiki kural (tek cümle: "Sattığın senin, ev sahibinden hiçbir şey eksilmez"):
 *  - Misafirin cüzdanı kendisinindir: ekranda yalnız kendi parası / altını durur, ev sahibinin kasası hiçbir yerde yazmaz.
 *  - Misafir ev sahibinin büfesinde ne satarsa TAMAMI kendi cebine girer (kesinti yok, geri düşme yok) ve kendi kaydına taşınır.
 *  - Ev sahibine misafirin satışının ORTAK_PAY kadarı "ortaklık payı" olarak oyundan basılır (misafirden kesilmez).
 *  - Ev sahibinin dünyasını değiştiren alışveriş, kira / fatura, pasif gelir misafire kapalı: sim/misafir-kural.ts.
 *  - Misafirken kazanılan para düzenli olarak misafirin KENDİ kaydına yazılır (sekme kapansa da kaybolmaz, boot.ts).
 * Saf yardımcılar (boot.ts world köprüsü kullanır, tests/sim/misafir-para.test.ts).
 */
type Rec = Record<string, unknown>;
/** ev sahibine misafirin satışından oyunun bastığı ortaklık payı */
export const ORTAK_PAY = 0.25;

/** ev sahibinin dünyası + misafirin kendi kimliği ve cüzdanı. Ev sahibinin toplanmamış kasası misafire geçmez (pile 0). */
export function misafirDunya(own: Rec, host: Rec): Rec {
  return { ...host, money: own.money, gold: own.gold, player: own.player, settings: own.settings, hero: own.hero, lastSeen: own.lastSeen, pile: 0, zones: { ...(host.zones as Rec), esnafim: (own.zones as Rec | undefined)?.esnafim } };
}
/** ev sahibinin aldığı ortaklık payı (misafirin `satis` ₺ satışından) */
export function ortakPay(satis: number): number {
  return satis > 0 && satis < 1e7 ? Math.round(satis * ORTAK_PAY) : 0;
}
/** misafirin kendi kaydı, misafirken değişen cüzdanla; `sure` sn misafirlik oyun süresine eklenir (bulut kaydı daha yeni sayılsın) */
export function misafirDonus(own: Rec, cur: Rec, sure = 0): Rec {
  return { ...own, money: cur.money, gold: cur.gold, playT: (Number(own.playT) || 0) + Math.max(0, sure) };
}
/** misafirin yerel dünyasında toplanmamış parası (kasa yığını, masa bahşişi, yerdeki para): dünya yenilenince cebe geçer */
export function toplanmamis(rt: { kasa?: { value: number }[]; tables?: { pile?: { value: number }[] }[]; floor?: { value: number }[] }): number {
  const sum = (p?: { value: number }[]) => (p || []).reduce((a, b) => a + (Number(b.value) || 0), 0);
  return Math.floor(sum(rt.kasa) + (rt.tables || []).reduce((a, t) => a + sum(t.pile), 0) + sum(rt.floor));
}
