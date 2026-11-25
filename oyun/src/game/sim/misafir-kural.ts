/**
 * Odada misafirken (rt.misafir, net/misafir.ts) sim kuralları. 2026-11-25 sahip: "arkadaşın oyununa katılınca paranın ortak
 * oluşunu dert ediyorlar, dert edilmemeli". Aynı gün: "bir mmorpg gibi düşün herkesin seviyesi parası gelişimi kendine, gelen
 * arkadaş yardım ediyor karşılığında maaş alıyor". Misafirin ekranındaki dünya ev sahibinin büfesinin yerel kopyasıdır; o kopyada
 * harcanan para hiçbir yere gitmez, oradan gelen pasif gelir de ev sahibinin kendi gelirinin ikizidir. Kural:
 *  - Misafirin ev sahibinin büfesindeki satışı (MISAFIR_IS) ev sahibinindir; misafirin cebine oyunun bastığı MISAFIR_MAAS maaş girer
 *    (economy.ts pay / cashIn). Kendi oynadığı maç / bahis / sınav / iş parası tam kendisinin.
 *  - XP misafirin kendi seviyesine yazılır, ev sahibinin seviyesi oynamaz (levels.ts, rt.misafirXp).
 *  - Ev sahibinin işletme kasası, faizi, hedef / başarım / yıldız / tadilat ödülleri misafire ödenmez (ikiz para).
 *  - Ev sahibinin dünyasını değiştiren alışveriş misafire kapalıdır (para cebinden çıkıp boşa giderdi); toast söyler.
 *  - Gün sonu kira / fatura / maaş misafirin cebinden kesilmez (gider.ts, karne.ts).
 */
type Cmd = { kind: string; op?: unknown; arg?: unknown };

/** misafirin ev sahibinin büfesinde çalışarak kazandığı (satış ev sahibine gider, misafire maaş) */
export const MISAFIR_IS: ReadonlySet<string> = new Set(['tezgah', 'adisyon', 'bahsis', 'salon']);
/** satışın misafire maaş olarak basılan payı (ev sahibinden kesilmez) */
export const MISAFIR_MAAS = 0.25;
/** misafirin cebine girmeyen gelir kaynakları (economy.ts credit) */
export const MISAFIR_KAPALI_KAYNAK: ReadonlySet<string> = new Set(['isletme', 'faiz', 'hedef', 'basarim', 'yildiz', 'tadilat']);

const HEP = new Set(['upgradeTier', 'invest', 'startTadilat', 'startTadilatSelf', 'skipTadilat', 'hireCandidate', 'refreshBoard', 'fire', 'train',
  'decorBuy', 'decorPlace', 'decorRemove', 'decorRotate', 'saveSign', 'acceptSolution', 'claimOrder', 'ordersRefresh', 'pencere', 'tabela']);
const OP: Record<string, ReadonlySet<string>> = {
  calisan: new Set(['kurs', 'call']), yiyecek: new Set(['learn', 'deal']), kiyafet: new Set(['buy']), zemin: new Set(['desen']), hava: new Set(['umb']),
  deniz: new Set(['seatBuy', 'ext', 'tez', 'pier', 'bufe']), disari: new Set(['buyShop', 'buyVeh']), esnaf: new Set(['gift', 'buy']),
  koleksiyon: new Set(['pack', 'cast', 'buy', 'vitrin']),
};
/** mulk: misafire açık işlemler (gerisi ev sahibinin arsası, bankası, envanteri) */
const MULK_ACIK = new Set(['ktAc', 'ktKapat', 'ktEkle', 'ktTemizle', 'ktVer', 'bilet', 'izle']);

/** true: bu komut ev sahibinin dünyasında para harcar / dünyayı değiştirir, misafire kapalı */
export function misafirYasak(c: Cmd): boolean {
  if (HEP.has(c.kind)) return true;
  const op = String(c.op ?? '');
  if (c.kind === 'mulk') return !MULK_ACIK.has(op);
  if (c.kind === 'dekor2') return /^(buy|craft|paint|set|cat)/.test(String(c.arg ?? ''));
  return !!OP[c.kind]?.has(op);
}
export const MISAFIR_ALIS_UYARI = 'Burası ev sahibinin büfesi: alışverişi o yapar. Senin paran cebinde kalır.';
