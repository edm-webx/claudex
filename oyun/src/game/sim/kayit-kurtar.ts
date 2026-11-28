/**
 * Açılışta oyunu kuramayan kayıttan kurtulma (QA 2026-11-27 teknik rapor 04: checksum'u geçerli ama şekli bozuk kayıt
 * her açılışta "boot failed" ile oyunu kalıcı açılmaz yapıyordu).
 * Sıra: bozuk kayıt cihaza yedeklenir (localStorage BOZUK_ANAHTAR, en son bozuk olan) -> eski slotlar, günlük yedekler,
 * göç öncesi yedekler yeniden denenir (son iyi kayıt) -> hiçbiri kurulamazsa yeni oyun. Kayıt asla sessizce silinmez.
 * boot.ts kullanır; tests/sim/kayit-kurtar.test.ts.
 */
import type { SaveStore, Logger } from '../../engine/api';
import type { GameState } from './schema';

export const BOZUK_ANAHTAR = 'martikoy-bozuk-kayit';
/** en çok bu kadar yedek denenir (açılış uzamasın) */
const DENEME = 10;

export interface Kurtarma<T> { sim: T; loaded: GameState | undefined; mesaj: string; kaynak: 'yedek' | 'yeni' }

export function bozukYedekle(bozuk: unknown, depo: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null): boolean {
  if (!depo || bozuk === undefined) return false;
  try { depo.setItem(BOZUK_ANAHTAR, JSON.stringify({ at: Date.now(), json: JSON.stringify(bozuk) })); return true; } catch { return false; }
}

export async function kayitKurtar<T>(save: SaveStore<GameState>, bozuk: GameState | undefined, kur: (sv: GameState | undefined) => T, log?: Logger,
  depo?: Pick<Storage, 'setItem'> | null): Promise<Kurtarma<T>> {
  bozukYedekle(bozuk, depo);
  let liste: { id: string; kind: string }[] = [];
  try { liste = await save.backups(); } catch { /* */ }
  // önce slotlar ve günlükler (yeniden eskiye, backups() sıralı verir), göç öncesi yedekler en son
  liste = [...liste.filter(b => b.kind !== 'premigration'), ...liste.filter(b => b.kind === 'premigration')].slice(0, DENEME);
  const bozukJson = bozuk === undefined ? '' : JSON.stringify(bozuk);
  for (const b of liste) {
    try {
      if (!(await save.restore(b.id))) continue;
      const r = await save.load();
      if (r.from === 'fresh' || JSON.stringify(r.data) === bozukJson) continue;
      const sim = kur(r.data);
      log?.warn('save recovered from', b.id);
      return { sim, loaded: r.data, mesaj: 'Kaydın bozuktu: son sağlam kayıttan devam ediyorsun.', kaynak: 'yedek' };
    } catch (e) { log?.warn('backup unusable', b.id, (e as Error).message); }
  }
  return { sim: kur(undefined), loaded: undefined, mesaj: 'Kaydın açılamadı, yeni oyun başladı. Bozuk kayıt bu cihazda yedeklendi.', kaynak: 'yeni' };
}
