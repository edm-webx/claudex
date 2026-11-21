/**
 * Karar paketi C/E (2026-10-27): Metin2 style, 4 character slots per account + one account-shared bank.
 * All of it rides in the one cloud record kayitlar.veri (no new table):
 *   { code, playT }            the ACTIVE slot (old builds / old saves keep working: legacy saves become slot 1)
 *   slots: ({ code, ad, sinif, tip, level, playT, dukkan } | null)[4]
 *   aktif: 0..3                slot in play
 *   banka: { tl, esya }        shared by every character (rt.banka mirrors it, see sim/banka.ts)
 *   rev: n                     write counter for the optimistic lock (net/supa.ts veriYazKosullu)
 * Guests (no account) have no slots: they play the single local save.
 *
 * KAYIT-GUV (2026-11-21, tarama raporu KAYIT/BULUT): player data is never lost.
 * - A failed cloud read is not "empty": nothing is written until a read succeeded (slotlariYukle -> false, giris shows retry).
 * - Every write is conditional on the rev we read. On a clash the record is re-read and merged: other slots come from the
 *   server, the bank gets our delta on top of the server bank, the active slot is ours only if nobody else changed it.
 *   If another tab/device advanced OUR active slot, this tab goes read-only (kilit 'cakisma') instead of rolling it back.
 * - kilit 'surum' / 'bozuk' (boot): the cloud code of the active slot cannot be opened by this build: no writes at all.
 * - A local copy of the active slot code (per account + slot) survives a refresh/close while offline (yerelYedek*).
 */
import { hesap, veriOku, veriYazKosullu, veriKapanisYaz } from './supa';

export const SLOT_N = 4;
export interface SlotOzet { ad: string; sinif: string; tip: string; level: number; playT: number; dukkan: string }
export interface Slot extends SlotOzet { code: string }
export interface Banka { tl: number; esya: Record<string, number>; /** EKO: wall-clock second of the account's last deposit interest (all 4 slots share it) */ faizSaat?: number }
interface Veri { code?: string; playT?: number; slots?: (Slot | null)[]; aktif?: number; banka?: Banka; rev?: number }
export type KayitKilidi = null | 'cakisma' | 'surum' | 'bozuk' | 'okunamadi';

let v: Veri = {}, yeni = false, loaded = false, satir = false, okumaHatasi = false;
/** the bank as the server had it at the last sync (our bank delta = v.banka - bankaTaban) */
let bankaTaban: Banka = { tl: 0, esya: {} };
/** code of the active slot as the server had it at the last sync ('' = empty slot) */
let slotTaban = '';
/** codes this tab sent for the active slot (a keepalive whose answer we never saw still counts as ours) */
const gonderilen: string[] = [];
let aktifOkundu = false, kilit: KayitKilidi = null, sonYazilan = '';

export const slotsHazir = () => loaded;
/** true after slotlariYukle failed because the server could not be read (not "no record") */
export const slotOkumaHatasi = () => okumaHatasi;
export const kayitKilidi = (): KayitKilidi => kilit;
/** boot: the active slot's cloud save can't be opened by this build (newer version / broken): block every cloud write */
export function kayitKilitle(k: Exclude<KayitKilidi, null>): void { if (!kilit) kilit = k; }
export const aktifSlot = () => (typeof v.aktif === 'number' && v.aktif >= 0 && v.aktif < SLOT_N ? v.aktif : 0);
/** true when the picked slot is empty: the boot starts a fresh character (kulis opens, the name is chosen once) */
export const slotYeni = () => yeni;
const bankaTemiz = (b?: Banka | null): Banka => ({ tl: Math.max(0, Math.floor(Number(b?.tl) || 0)), esya: Object.fromEntries(Object.entries(b?.esya || {}).filter(([, n]) => Number(n) > 0).map(([k, n]) => [k, Math.floor(Number(n))])), ...(Number(b?.faizSaat) > 0 ? { faizSaat: Math.floor(Number(b?.faizSaat)) } : {}) });
export const bankaOku = (): Banka => bankaTemiz(v.banka);
const kopya = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export function slotListesi(): (SlotOzet | null)[] {
  const out: (SlotOzet | null)[] = [];
  for (let i = 0; i < SLOT_N; i++) { const s = v.slots?.[i]; out.push(s ? { ad: s.ad, sinif: s.sinif, tip: s.tip, level: s.level, playT: s.playT, dukkan: s.dukkan } : null); }
  return out;
}

/** shape a raw server record: 4 slots, an old single-save account becomes slot 1 (nothing is lost) */
function bicimle(raw: Record<string, unknown> | null): Veri {
  const x: Veri = raw ? kopya(raw) as Veri : {};
  if (!Array.isArray(x.slots)) x.slots = [null, null, null, null];
  while (x.slots.length < SLOT_N) x.slots.push(null);
  if (x.code && !x.slots.some(Boolean)) { x.slots[0] = { code: x.code, playT: x.playT || 0, ad: hesap()!.ad, sinif: 'asci', tip: 'a', level: 1, dukkan: '' }; x.aktif = 0; }
  x.rev = Math.max(0, Math.floor(Number(x.rev) || 0));
  return x;
}

/** after login: read the account record. false = the server could not be read: show an error + retry, write nothing. */
export async function slotlariYukle(): Promise<boolean> {
  loaded = false; v = {}; yeni = false; aktifOkundu = false; okumaHatasi = false;
  if (!hesap()) return false;
  const r = await veriOku();
  if (!r.ok) { okumaHatasi = true; return false; }
  v = bicimle(r.veri); satir = r.satir;
  bankaTaban = bankaTemiz(v.banka);
  slotTaban = v.slots![aktifSlot()]?.code || '';
  loaded = true;
  return true;
}

export function slotSec(i: number): void {
  if (i < 0 || i >= SLOT_N) return;
  v.aktif = i; yeni = !v.slots?.[i]; aktifOkundu = false;
  slotTaban = v.slots?.[i]?.code || ''; gonderilen.length = 0;
}

/**
 * Write v with the optimistic lock; on a clash re-read, merge and retry. `aktifBizde`: the active slot in v carries
 * this tab's progress (bulutYaz); false = only the bank / another slot changed (bankaYaz, slotSil).
 */
async function kosulluYaz(esnaf: unknown, aktifBizde: boolean): Promise<boolean> {
  let aktifBizim = true;   // false once the server's active slot turned out to be someone else's: never adopt it as our base
  for (let deneme = 0; deneme < 4; deneme++) {
    const a = aktifSlot();
    const next = kopya(v); next.rev = (v.rev || 0) + 1;
    const r = await veriYazKosullu(next as Record<string, unknown>, v.rev || 0, satir, esnaf);
    if (r === 'ok') {
      v = next; satir = true; bankaTaban = bankaTemiz(v.banka);
      if (aktifBizim) slotTaban = v.slots?.[a]?.code || '';
      return true;
    }
    if (r === 'hata') return false;
    // cakisma: someone wrote since our read. Re-read and merge; never roll their work back.
    const o = await veriOku();
    if (!o.ok) return false;
    const f = bicimle(o.veri); satir = o.satir;
    const srvKod = f.slots![a]?.code || '';
    const bizim = srvKod === slotTaban || (!!srvKod && gonderilen.includes(srvKod));
    if (!bizim && aktifBizde && aktifOkundu) { kilit = 'cakisma'; v.rev = f.rev; return false; }
    if (!bizim) aktifBizim = false;
    const benimSlot = aktifBizde || bizim ? v.slots![a] : f.slots![a];
    // bank: our delta since the last sync, applied on top of the server bank (the bank is shared by every tab/slot)
    const b = bankaTemiz(v.banka), fb = bankaTemiz(f.banka), esya: Record<string, number> = { ...fb.esya };
    for (const k of new Set([...Object.keys(b.esya), ...Object.keys(bankaTaban.esya)])) esya[k] = Math.max(0, (esya[k] || 0) + (b.esya[k] || 0) - (bankaTaban.esya[k] || 0));
    const banka = bankaTemiz({ tl: fb.tl + b.tl - bankaTaban.tl, esya, faizSaat: Math.max(fb.faizSaat || 0, b.faizSaat || 0) });   // EKO: hesap başına faiz damgası, ikisinin büyüğü
    bankaTaban = fb;
    const slots = f.slots!.slice(); slots[a] = benimSlot;
    v = { ...f, slots, banka, aktif: a };
    if (benimSlot) { v.code = benimSlot.code; v.playT = benimSlot.playT; }
    if (bizim) slotTaban = srvKod;
  }
  return false;
}

/**
 * Karakter silme (2026-11-21): clears ONE slot of the cloud record. Re-reads the record first so another device's
 * newer slots/bank are never clobbered, touches nothing but slots[i] (+ the legacy top-level code mirror of that slot),
 * leaves `banka` and the other slots as they are. true = server confirmed. On failure the in-memory copy is reloaded.
 */
export async function slotSil(i: number): Promise<boolean> {
  if (!hesap() || i < 0 || i >= SLOT_N) return false;
  if (!(await slotlariYukle())) return false;
  const s = v.slots?.[i]; if (!s) return true;   // already empty
  v.slots![i] = null;
  // the legacy mirror (code/playT) would otherwise resurrect the deleted character as slot 1 on the next load
  if (v.code === s.code) { delete v.code; delete v.playT; }
  if (v.aktif === i) v.aktif = Math.max(0, v.slots!.findIndex(Boolean));
  // slotSil must not lose a clash either: a re-read slot i that changed meanwhile is deleted only if it is the same character
  const ok = await silYaz(i, s.code);
  if (!ok) { await slotlariYukle(); return false; }
  yerelYedekSil(i);
  // the local save may still hold this character: mark it foreign so the next entry reloads from the cloud / starts fresh
  try { localStorage.setItem('martikoy-save-owner', 'silindi'); } catch { /* */ }
  return true;
}
async function silYaz(i: number, kod: string): Promise<boolean> {
  for (let deneme = 0; deneme < 4; deneme++) {
    const next = kopya(v); next.rev = (v.rev || 0) + 1;
    const r = await veriYazKosullu(next as Record<string, unknown>, v.rev || 0, satir, null);
    if (r === 'ok') { v = next; satir = true; bankaTaban = bankaTemiz(v.banka); return true; }
    if (r === 'hata') return false;
    const o = await veriOku(); if (!o.ok) return false;
    const f = bicimle(o.veri); satir = o.satir;
    if ((f.slots![i]?.code || '') !== kod) return false;   // the character changed meanwhile (played elsewhere): don't delete blind
    f.slots![i] = null; if (f.code === kod) { delete f.code; delete f.playT; }
    v = f;
  }
  return false;
}

/** cloud copy of the ACTIVE slot (null for an empty slot or a guest). Throws when the record could not be read. */
export async function bulutOku(): Promise<{ code: string; playT: number } | null> {
  if (!hesap()) return null;
  if (!loaded && !(await slotlariYukle())) throw new Error('bulut okunamadı');
  const s = v.slots?.[aktifSlot()];
  aktifOkundu = true;
  slotTaban = s?.code || '';
  return s && s.code ? { code: s.code, playT: s.playT } : null;
}

type Esnaf = { ad?: string; sinif?: string; tip?: string; dukkan?: string } | null;
function aktifYaz(code: string, playT: number, esnaf: Esnaf, level: number): void {
  const i = aktifSlot(), e = esnaf || {};
  (v.slots ||= [null, null, null, null])[i] = { code, playT, ad: String(e.ad || hesap()!.ad), sinif: String(e.sinif || 'asci'), tip: String(e.tip || 'a'), level, dukkan: String(e.dukkan || '') };
  v.code = code; v.playT = playT; v.aktif = i; yeni = false;
  gonderilen.push(code); if (gonderilen.length > 6) gonderilen.shift();
}
/** may this tab write the active slot? (logged in, record read, active slot read by the boot, no lock) */
const yazabilir = () => !!hesap() && loaded && aktifOkundu && !kilit;

/** true = sunucu kaydı onayladı. Hesapsızken true döner (yazılacak bulut yok). Kilitliyken / okunmadan false (hiç yazmaz). */
export async function bulutYaz(code: string, playT: number, esnaf: Esnaf, level = 1): Promise<boolean> {
  if (!hesap()) return true;
  if (!yazabilir()) return false;
  aktifYaz(code, playT, esnaf, level);
  const key = JSON.stringify({ ...v, rev: 0 });
  if (key === sonYazilan) return true;   // aynı veri zaten onaylı gitti
  const ok = await kosulluYaz(esnaf, true);
  sonYazilan = ok ? JSON.stringify({ ...v, rev: 0 }) : '';
  return ok;
}

/** pagehide: await yok, keepalive fetch. Dönüş: istek atıldı mı (onay beklenmez). The bank rides as last synced (no double delta). */
export function bulutKapanisYaz(code: string, playT: number, esnaf: Esnaf, level = 1): boolean {
  if (!yazabilir()) return false;
  aktifYaz(code, playT, esnaf, level);
  const next = kopya(v); next.rev = (v.rev || 0) + 1; next.banka = bankaTemiz(bankaTaban);
  return veriKapanisYaz(next as Record<string, unknown>, v.rev || 0, satir);
}

/** the bank moved: written on its own, without a game save. false = not stored (no read yet, locked, clash, network). */
export async function bankaYaz(b: Banka): Promise<boolean> {
  if (!hesap()) return true;
  if (!loaded || kilit) return false;
  v.banka = bankaTemiz(b);
  return kosulluYaz(null, false);
}

// ── yerel yedek: the active slot's code, per account + slot, in this browser (production has no engine-side local save)
const yedekAnahtar = (i: number) => { const h = hesap(); return h ? 'martikoy-yedek:' + h.id + ':' + i : ''; };
export interface YerelYedek { code: string; playT: number; taban: string; at: number }
/** written before every cloud attempt and when the tab hides; `taban` = the cloud code this progress grew from */
export function yerelYedekYaz(code: string, playT: number, at: number): void {
  if (!hesap() || !loaded || !aktifOkundu || kilit) return;
  const k = yedekAnahtar(aktifSlot()); if (!k) return;
  try { localStorage.setItem(k, JSON.stringify({ code, playT, taban: slotTaban, at } satisfies YerelYedek)); } catch { /* storage full/blocked */ }
}
/**
 * The local copy worth restoring at login: it must have grown from exactly the cloud code that is there now
 * (taban === cloud code: nobody else saved this slot since) and be further on. Otherwise null (and a stale copy is dropped).
 */
export function yerelYedekOku(bulut: { code: string; playT: number } | null): YerelYedek | null {
  const k = yedekAnahtar(aktifSlot()); if (!k) return null;
  let y: YerelYedek | null = null;
  try { const raw = localStorage.getItem(k); y = raw ? JSON.parse(raw) as YerelYedek : null; } catch { y = null; }
  if (!y || typeof y.code !== 'string' || !y.code) return null;
  const bulutKod = bulut?.code || '';
  if (y.code === bulutKod) return null;   // the cloud already has it
  if (y.taban === bulutKod && (Number(y.playT) || 0) >= (bulut?.playT || 0)) return y;
  try { localStorage.removeItem(k); } catch { /* */ }   // grew from an older cloud save that someone else replaced: stale
  return null;
}
export function yerelYedekSil(i = aktifSlot()): void { const k = yedekAnahtar(i); if (k) try { localStorage.removeItem(k); } catch { /* */ } }

/**
 * Save-format version inside an export code ("MB1." + base64 {v,sum,json}, engine/save exportCode).
 * null = not a readable code. Lets the boot lock a slot whose cloud save comes from a newer build before touching it.
 */
export function kodSurumu(code: string): number | null {
  try {
    const bin = atob(String(code).trim().replace(/^MB1\./, ''));
    const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const env = JSON.parse(new TextDecoder().decode(bytes)) as { v?: unknown; json?: unknown };
    if (typeof env.json !== 'string') return null;
    let iv: unknown; try { iv = (JSON.parse(env.json) as { version?: unknown }).version; } catch { return null; }
    const n = Math.max(Number(env.v) || 0, Number(iv) || 0);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}
