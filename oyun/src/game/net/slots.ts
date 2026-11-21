/**
 * Karar paketi C/E (2026-10-27): Metin2 style, 4 character slots per account + one account-shared bank.
 * All of it rides in the one cloud record kayitlar.veri (no new table):
 *   { code, playT }            the ACTIVE slot (old builds / old saves keep working: legacy saves become slot 1)
 *   slots: ({ code, ad, sinif, tip, level, playT, dukkan } | null)[4]
 *   aktif: 0..3                slot in play
 *   banka: { tl, esya }        shared by every character (rt.banka mirrors it, see sim/banka.ts)
 * Guests (no account) have no slots: they play the single local save.
 */
import { hesap, veriOku, veriYaz, veriKapanisYaz } from './supa';

export const SLOT_N = 4;
export interface SlotOzet { ad: string; sinif: string; tip: string; level: number; playT: number; dukkan: string }
export interface Slot extends SlotOzet { code: string }
export interface Banka { tl: number; esya: Record<string, number>; /** EKO: wall-clock second of the account's last deposit interest (all 4 slots share it) */ faizSaat?: number }
interface Veri { code?: string; playT?: number; slots?: (Slot | null)[]; aktif?: number; banka?: Banka }

let v: Veri = {}, yeni = false, loaded = false;
export const slotsHazir = () => loaded;
export const aktifSlot = () => (typeof v.aktif === 'number' && v.aktif >= 0 && v.aktif < SLOT_N ? v.aktif : 0);
/** true when the picked slot is empty: the boot starts a fresh character (kulis opens, the name is chosen once) */
export const slotYeni = () => yeni;
export const bankaOku = (): Banka => ({ tl: Math.max(0, Math.floor(v.banka?.tl || 0)), esya: { ...(v.banka?.esya || {}) }, faizSaat: Math.max(0, Math.floor(Number(v.banka?.faizSaat) || 0)) });

export function slotListesi(): (SlotOzet | null)[] {
  const out: (SlotOzet | null)[] = [];
  for (let i = 0; i < SLOT_N; i++) { const s = v.slots?.[i]; out.push(s ? { ad: s.ad, sinif: s.sinif, tip: s.tip, level: s.level, playT: s.playT, dukkan: s.dukkan } : null); }
  return out;
}

/** after login: read the account record; an old single-save account becomes slot 1 (nothing is lost) */
export async function slotlariYukle(): Promise<void> {
  loaded = false; v = {}; yeni = false;
  if (!hesap()) return;
  const raw = await veriOku();
  if (raw) v = raw as Veri;
  if (!Array.isArray(v.slots)) v.slots = [null, null, null, null];
  while (v.slots.length < SLOT_N) v.slots.push(null);
  if (v.code && !v.slots.some(Boolean)) { v.slots[0] = { code: v.code, playT: v.playT || 0, ad: hesap()!.ad, sinif: 'asci', tip: 'a', level: 1, dukkan: '' }; v.aktif = 0; }
  loaded = true;
}

export function slotSec(i: number): void {
  if (i < 0 || i >= SLOT_N) return;
  v.aktif = i; yeni = !v.slots?.[i];
}

/**
 * Karakter silme (2026-11-21): clears ONE slot of the cloud record. Re-reads the record first so another device's
 * newer slots/bank are never clobbered, touches nothing but slots[i] (+ the legacy top-level code mirror of that slot),
 * leaves `banka` and the other slots as they are. true = server confirmed. On failure the in-memory copy is reloaded.
 */
export async function slotSil(i: number): Promise<boolean> {
  if (!hesap() || i < 0 || i >= SLOT_N) return false;
  await slotlariYukle();
  const s = v.slots?.[i]; if (!s) return true;   // already empty
  v.slots![i] = null;
  // the legacy mirror (code/playT) would otherwise resurrect the deleted character as slot 1 on the next load
  if (v.code === s.code) { delete v.code; delete v.playT; }
  if (v.aktif === i) v.aktif = Math.max(0, v.slots!.findIndex(Boolean));
  const ok = await veriYaz(v as Record<string, unknown>, null);
  if (!ok) { await slotlariYukle(); return false; }
  // the local save may still hold this character: mark it foreign so the next entry reloads from the cloud / starts fresh
  try { localStorage.setItem('martikoy-save-owner', 'silindi'); } catch { /* */ }
  return true;
}

/** cloud copy of the ACTIVE slot (null for an empty slot or a guest) */
export async function bulutOku(): Promise<{ code: string; playT: number } | null> {
  if (!hesap()) return null;
  if (!loaded) await slotlariYukle();
  const s = v.slots?.[aktifSlot()];
  return s && s.code ? { code: s.code, playT: s.playT } : null;
}

function aktifYaz(code: string, playT: number, esnaf: { ad?: string; sinif?: string; tip?: string; dukkan?: string } | null, level: number): void {
  const i = aktifSlot(), e = esnaf || {};
  (v.slots ||= [null, null, null, null])[i] = { code, playT, ad: String(e.ad || hesap()!.ad), sinif: String(e.sinif || 'asci'), tip: String(e.tip || 'a'), level, dukkan: String(e.dukkan || '') };
  v.code = code; v.playT = playT; v.aktif = i; yeni = false;
}

/** true = sunucu kaydı onayladı (KAL-01: eskiden void'di, hata sessizce kayboluyordu). Hesapsızken true döner (yazılacak bulut yok). */
export async function bulutYaz(code: string, playT: number, esnaf: { ad?: string; sinif?: string; tip?: string; dukkan?: string } | null, level = 1): Promise<boolean> {
  if (!hesap()) return true;
  if (!loaded) await slotlariYukle();
  aktifYaz(code, playT, esnaf, level);
  return veriYaz(v as Record<string, unknown>, esnaf);
}

/** pagehide: await yok, keepalive fetch. Dönüş: istek atıldı mı (onay beklenmez). */
export function bulutKapanisYaz(code: string, playT: number, esnaf: { ad?: string; sinif?: string; tip?: string; dukkan?: string } | null, level = 1): boolean {
  if (!hesap() || !loaded) return false;
  aktifYaz(code, playT, esnaf, level);
  return veriKapanisYaz(v as Record<string, unknown>);
}

/** the bank moved: written on its own, without a game save */
export async function bankaYaz(b: Banka): Promise<void> {
  if (!hesap()) return;
  if (!loaded) await slotlariYukle();
  v.banka = { tl: Math.max(0, Math.floor(b.tl)), esya: Object.fromEntries(Object.entries(b.esya).filter(([, n]) => n > 0)), faizSaat: Math.max(0, Math.floor(Number(b.faizSaat) || 0)) };
  await veriYaz(v as Record<string, unknown>, null);
}
