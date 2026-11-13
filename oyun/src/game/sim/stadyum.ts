/**
 * Stadyum kapısı (2026-11-02): bilet gişesi + kulüp kadro ayarı. State S.zones.arsa.stad (kulüp kurulunca anlamlı):
 * fiyat (gişe bileti), doluluk (son maç), gelir (toplam), son (son maç geliri), maclar, formasyon.
 * Doluluk = kulüp formu + rakip gücü + ligdeki rakip - fiyat; gelir = doluluk x kapasite x fiyat / 50.
 * Pure functions on the save record so the sim, the view and the panel all read the same numbers.
 */
export const KAPASITE = 120, FIYAT_MIN = 1000, FIYAT_MAX = 15000, FIYAT_ADIM = 500, FIYAT_VARSAYILAN = 4000;
export const FORMASYONLAR = [{ id: '2-2', ad: '2-2 Dengeli', not: 'İki savunma, iki forvet' }, { id: '1-2-1', ad: '1-2-1 Elmas', not: 'Tek stoper, iki orta, tek forvet' }, { id: '2-1-1', ad: '2-1-1 Köprü', not: 'İki savunma, bir orta, bir forvet' }] as const;
export interface StadSave { fiyat: number; doluluk: number; gelir: number; son: number; maclar: number; formasyon: string }
export function stadSave(arsa: Record<string, unknown>): StadSave {
  const s = ((arsa as { stad?: Partial<StadSave> }).stad ||= {}) as StadSave;
  if (!Number.isFinite(s.fiyat)) s.fiyat = FIYAT_VARSAYILAN;
  s.fiyat = Math.max(FIYAT_MIN, Math.min(FIYAT_MAX, Math.round(s.fiyat / FIYAT_ADIM) * FIYAT_ADIM));
  for (const k of ['doluluk', 'gelir', 'son', 'maclar'] as const) if (!Number.isFinite(s[k])) s[k] = 0;
  if (!FORMASYONLAR.some(f => f.id === s.formasyon)) s.formasyon = '2-2';
  return s;
}
/** 0..1 expected fill for the next gate: form 'G'/'B'/'M' string, rival strength 40-70, ticket price. */
export function tahminDoluluk(fiyat: number, form: string[], rakipGuc = 55): number {
  const f = form.slice(-5).reduce((a, x) => a + (x === 'G' ? 0.07 : x === 'B' ? 0.02 : -0.03), 0);
  return Math.max(0.05, Math.min(1, 0.42 + f + (rakipGuc - 50) / 160 - (fiyat - FIYAT_VARSAYILAN) / 14000));
}
export const kapiGeliri = (doluluk: number, fiyat: number) => Math.round(doluluk * KAPASITE * fiyat / 50);
export function fiyatAyarla(s: StadSave, delta: number): boolean {
  const n = Math.max(FIYAT_MIN, Math.min(FIYAT_MAX, s.fiyat + Math.sign(delta) * FIYAT_ADIM * Math.max(1, Math.min(10, Math.abs(delta)))));
  const ch = n !== s.fiyat; s.fiyat = n; return ch;
}
