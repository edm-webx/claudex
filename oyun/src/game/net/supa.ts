/**
 * Martıköy sunucusu: Supabase (2026-10-24 13:05 user: kullanıcı adı + şifre, veritabanı; no server purchase needed).
 * - Auth: a username becomes a fake e-mail <name>@martikoy.oyun (Confirm email OFF in Supabase), so nobody types a mail.
 * - Tables (oyun/sunucu/supabase-kurulum.sql + migrations/): oyuncular (public profile: kullanici_adi, esnaf look),
 *   kayitlar (private save code, only the owner reads it; RLS).
 * - Realtime channels carry the room codes (online.ts).
 * URL + anon/publishable key are public by design (RLS protects the data). Never put a service_role/secret key here.
 * Empty config = guest-only game, everything else keeps working.
 */
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://fxvbtfkvpnrnhyuntcgj.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4dmJ0Zmt2cG5ybmh5dW50Y2dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MjI2MDUsImV4cCI6MjEwODM5ODYwNX0.kXYXHCNg3xOIaBp0E3i3EOBofZQe01aeTpMDJWrwDVM';  // anon (public)

let client: SupabaseClient | null = null;
let jeton = '';
export const supaReady = () => !!(SUPABASE_URL && SUPABASE_KEY);
export function supa(): SupabaseClient | null {
  if (!supaReady()) return null;
  if (!client) {
    try {
      client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, storageKey: 'martikoy-giris' }, realtime: { params: { eventsPerSecond: 12 } } });
      // KAL-01: kapanış yazımı (keepalive fetch) asenkron getSession bekleyemez; güncel erişim jetonunu burada tut (yenilenince de güncellenir)
      client.auth.onAuthStateChange((_e, s) => { jeton = s?.access_token || ''; });
    } catch { client = null; }
  }
  return client;
}

export const userRe = /^[a-z0-9_çğıöşü]{3,16}$/;
/** Supabase refuses made-up domains (".oyun" was "invalid"), so the fake address tries real-looking ones in order.
 *  Nothing is ever mailed (Confirm email OFF); sign-in tries the same list. */
const asciiOf = (name: string) => name.trim().toLocaleLowerCase('tr').replace(/ç/g, 'c1').replace(/ğ/g, 'g1').replace(/ı/g, 'i1').replace(/ö/g, 'o1').replace(/ş/g, 's1').replace(/ü/g, 'u1');
const mailsOf = (name: string) => { const a = asciiOf(name); return ['martikoy.' + a + '@gmail.com', a + '@martikoy.com']; };
const trErr = (m: string) =>
  /Invalid login/i.test(m) ? 'Kullanıcı adı ya da şifre yanlış.'
  : /already registered|already exists/i.test(m) ? 'Bu kullanıcı adı alınmış.'
  : /Password should be/i.test(m) ? 'Şifre en az 6 karakter olmalı.'
  : /weak|pwned|known to be|easy to guess/i.test(m) ? 'Bu şifre sızdırılmış/çok bilinen bir şifre, başka bir şifre seç.'
  : /değiştirilemez/i.test(m) ? 'Kullanıcı adı değiştirilemez.'
  : /oyuncular_ad_bicim|check constraint/i.test(m) ? 'Kullanıcı adı 3-16 küçük harf/rakam olsun (boşluk yok).'
  : /rate limit|too many/i.test(m) ? 'Çok fazla deneme oldu, biraz bekle.'
  : /fetch|network|Failed/i.test(m) ? 'Sunucuya ulaşılamadı. İnternetini kontrol et.'
  : /signups not allowed|Signups/i.test(m) ? 'Kayıtlar kapalı (Supabase: Email provider açık olmalı).'
  : /Email address .* is invalid/i.test(m) ? 'Bu kullanıcı adıyla kayıt olmadı, başka bir ad dene.'
  : /Email not confirmed/i.test(m) ? 'Hesap onay bekliyor (Supabase: Confirm email kapalı olmalı).'
  : m;

export interface Hesap { id: string; ad: string }
let me: Hesap | null = null;
export const hesap = () => me;

export async function oturum(): Promise<Hesap | null> {
  const c = supa(); if (!c) return null;
  try {
    const { data } = await c.auth.getSession();
    return (me = fromSession(data.session));
  } catch { return null; }
}
const fromSession = (s: Session | null): Hesap | null => s ? { id: s.user.id, ad: String((s.user.user_metadata as { ad?: string })?.ad || s.user.email?.split('@')[0] || 'esnaf') } : null;

export async function kayitOl(ad: string, sifre: string): Promise<string | null> {
  const c = supa(); if (!c) return 'Sunucu henüz bağlı değil.';
  ad = ad.trim().toLocaleLowerCase('tr');
  if (!userRe.test(ad)) return 'Kullanıcı adı 3-16 harf/rakam olsun (boşluk yok).';
  if (sifre.length < 6) return 'Şifre en az 6 karakter olmalı.';
  try {
    const taken = await c.from('oyuncular').select('id').eq('kullanici_adi', ad).maybeSingle();
    if (taken.data) return 'Bu kullanıcı adı alınmış.';
    let data = null as Awaited<ReturnType<typeof c.auth.signUp>>['data'] | null, error: { message: string } | null = null;
    for (const email of mailsOf(ad)) {
      const r = await c.auth.signUp({ email, password: sifre, options: { data: { ad } } });
      data = r.data; error = r.error;
      if (!error || !/invalid/i.test(error.message) || /password/i.test(error.message)) break;
    }
    if (error || !data) return trErr(error ? error.message : 'Kayıt olmadı.');
    if (!data.session) return 'Hesap onay bekliyor (Supabase: Confirm email kapalı olmalı).';
    me = fromSession(data.session);
    await c.from('oyuncular').upsert({ id: data.session.user.id, kullanici_adi: ad });
    return null;
  } catch (e) { return trErr(String((e as Error)?.message || e)); }
}

export async function girisYap(ad: string, sifre: string): Promise<string | null> {
  const c = supa(); if (!c) return 'Sunucu henüz bağlı değil.';
  try {
    let msg = '';
    for (const email of mailsOf(ad)) {
      const { data, error } = await c.auth.signInWithPassword({ email, password: sifre });
      if (!error) { me = fromSession(data.session); return null; }
      msg = error.message;
      if (/rate|fetch|network/i.test(msg)) break;
    }
    return trErr(msg.replace(/Email address .* is invalid/i, 'Invalid login'));
  } catch (e) { return trErr(String((e as Error)?.message || e)); }
}

export async function cikisYap() { const c = supa(); me = null; try { await c?.auth.signOut(); } catch { /* */ } }

/**
 * Whole cloud record of the account (kayitlar.veri): active slot code + slots + bank (net/slots.ts shapes it).
 * KAYIT-GUV (2026-11-21): a failed read is NOT "no record". ok=false means the server could not be asked/answered;
 * the caller must not write anything then (a write built on an empty read would wipe every slot and the bank).
 * satir = the row exists (needed to pick insert vs. conditional update).
 */
export interface VeriOkuma { ok: boolean; veri: Record<string, unknown> | null; satir: boolean }
export async function veriOku(): Promise<VeriOkuma> {
  const c = supa(); if (!c || !me) return { ok: false, veri: null, satir: false };
  try {
    const { data, error } = await c.from('kayitlar').select('veri').eq('id', me.id).maybeSingle();
    if (error) return { ok: false, veri: null, satir: false };
    const veri = data?.veri && typeof data.veri === 'object' ? data.veri as Record<string, unknown> : null;
    return { ok: true, veri, satir: !!data };
  } catch { return { ok: false, veri: null, satir: false }; }
}

/** Result of a conditional write: ok = stored; cakisma = someone else wrote since our read (re-read + merge); hata = network/server. */
export type YazSonuc = 'ok' | 'cakisma' | 'hata';
/**
 * Optimistic lock on veri.rev (no schema change): the row is only updated while its stored rev still equals `rev`
 * (the rev we read). Another tab/device that wrote in between makes this a 'cakisma' instead of a silent overwrite.
 * satir=false: no row yet, insert (a unique-key clash = someone created it first = cakisma).
 */
export async function veriYazKosullu(veri: Record<string, unknown>, rev: number, satir: boolean, esnaf: unknown): Promise<YazSonuc> {
  const c = supa(); if (!c || !me) return 'hata';
  const guncellendi = new Date().toISOString();
  try {
    if (!satir) {
      const r = await c.from('kayitlar').insert({ id: me.id, veri, guncellendi });
      if (r.error) return r.error.code === '23505' ? 'cakisma' : 'hata';
    } else {
      let q = c.from('kayitlar').update({ veri, guncellendi }).eq('id', me.id);
      q = rev > 0 ? q.eq('veri->>rev', String(rev)) : q.is('veri->>rev', null);
      const r = await q.select('id');
      if (r.error) return 'hata';
      if (!r.data || r.data.length === 0) return 'cakisma';
    }
    if (esnaf) { try { await c.from('oyuncular').update({ esnaf, guncellendi }).eq('id', me.id); } catch { /* yan veri: hata kaydı bozmaz */ } }
    return 'ok';
  } catch { return 'hata'; }
}

/** keepalive isteklerinin toplam sınırı 64 KB; gövde bunu aşarsa kapanış yazımı denenmez (normal yazım zaten gider). */
export const KAPANIS_LIMIT = 60_000;
/**
 * Sekme kapanırken son yazım: asenkron beklemeden, önbellekteki jetonla REST (keepalive). Dönüş: istek atıldı mı.
 * Same optimistic lock as veriYazKosullu (PATCH filtered on veri->>rev), so a closing stale tab can never overwrite a
 * newer save of another tab/device. Sunucu onayı beklenmez (sayfa kapanıyor), rozet "Kaydedildi" demez.
 */
export function veriKapanisYaz(veri: Record<string, unknown>, rev: number, satir: boolean): boolean {
  if (!me || !jeton) return false;
  const guncellendi = new Date().toISOString();
  let body = '';
  try { body = JSON.stringify(satir ? { veri, guncellendi } : { id: me.id, veri, guncellendi }); } catch { return false; }
  if (body.length > KAPANIS_LIMIT) { try { console.warn('[kayit] kapanış gövdesi sınırı aştı', body.length); } catch { /* */ } return false; }
  const url = satir
    ? SUPABASE_URL + '/rest/v1/kayitlar?id=eq.' + encodeURIComponent(me.id) + '&' + encodeURIComponent('veri->>rev') + '=' + (rev > 0 ? 'eq.' + rev : 'is.null')
    : SUPABASE_URL + '/rest/v1/kayitlar';
  try {
    void fetch(url, { method: satir ? 'PATCH' : 'POST', keepalive: true,
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body }).catch(() => { /* sayfa kapanıyor */ });
    return true;
  } catch { return false; }
}
