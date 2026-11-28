/**
 * Martı Kimlik (hesap sistemi) + Martıköy sunucusu: Supabase (2026-10-24 13:05 user: kullanıcı adı + şifre, veritabanı; no server purchase needed).
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
/** QA 2026-11-27: yanıtsız istek "Bekle..." ekranını sonsuza dek kilitliyordu. Her REST/Auth isteği bu sürede kesilir (Realtime ayrı) */
export const ISTEK_ZAMAN_ASIMI_MS = 20000;
export const SUNUCU_YAVAS = 'Sunucu çok yavaş yanıt veriyor. İnternetini kontrol edip tekrar dene.';
/** fetch + zaman aşımı (çağıranın kendi sinyali de geçerli kalır) */
export function zamanliFetch(ms = ISTEK_ZAMAN_ASIMI_MS, f: typeof fetch = (...a) => fetch(...a)): typeof fetch {
  return (input, init = {}) => {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(new DOMException('timeout', 'TimeoutError')), ms);
    const dis = init.signal; if (dis) { if (dis.aborted) ac.abort(dis.reason); else dis.addEventListener('abort', () => ac.abort(dis.reason), { once: true }); }
    return f(input, { ...init, signal: ac.signal }).finally(() => clearTimeout(t));
  };
}
/** söz + zaman aşımı: süre dolunca `yedek` döner (arayüz düğmesi kilitli kalmasın) */
export function zamanAsimi<T>(p: Promise<T>, ms: number, yedek: T): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p, new Promise<T>(res => { t = setTimeout(() => res(yedek), ms); })]).finally(() => clearTimeout(t));
}
let jeton = '';
export const supaReady = () => !!(SUPABASE_URL && SUPABASE_KEY);
export function supa(): SupabaseClient | null {
  if (!supaReady()) return null;
  if (!client) {
    try {
      client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, storageKey: 'martikoy-giris' }, realtime: { params: { eventsPerSecond: 12 } }, global: { fetch: zamanliFetch() } });
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
/** Martı Kimlik ortak hata dili. Giriş hatası "ad mı şifre mi" ayrımı yapmaz (Supabase de yapmaz, yapmamalı): yol gösterir. */
export const GIRIS_TUTMADI = 'Kullanıcı adı ya da şifre tutmadı. Adı kayıttaki gibi yaz (küçük harf, boşluksuz). Hesabın yoksa "Kayıt ol" sekmesinden aç.';
export const AD_KURALI = 'Kullanıcı adı 3-16 karakter olsun: küçük harf, rakam ya da _ (boşluk yok).';
const trErr = (m: string) =>
  /Invalid login/i.test(m) ? GIRIS_TUTMADI
  : /already registered|already exists/i.test(m) ? 'Bu kullanıcı adı alınmış.'
  : /Password should be/i.test(m) ? 'Şifre en az 6 karakter olmalı.'
  : /weak|pwned|known to be|easy to guess/i.test(m) ? 'Bu şifre sızdırılmış/çok bilinen bir şifre, başka bir şifre seç.'
  : /değiştirilemez/i.test(m) ? 'Kullanıcı adı değiştirilemez.'
  : /oyuncular_ad_bicim|check constraint/i.test(m) ? AD_KURALI
  : /rate limit|too many/i.test(m) ? 'Çok fazla deneme oldu, birkaç dakika bekleyip tekrar dene.'
  : /fetch|network|Failed|timeout|abort/i.test(m) ? 'Sunucuya ulaşılamadı. İnternetini kontrol edip tekrar dene.'
  : /signups not allowed|Signups/i.test(m) ? 'Kayıtlar şu an kapalı, biraz sonra tekrar dene.'
  : /Email address .* is invalid/i.test(m) ? 'Bu kullanıcı adıyla kayıt olmadı, başka bir ad dene.'
  : /Email not confirmed/i.test(m) ? 'Hesap onay bekliyor, admine yaz.'
  : /[çğıöşüÇĞİÖŞÜ]/.test(m) ? m   // zaten Türkçe (oyunun kendi mesajı)
  : (console.warn('[giris] sunucu hatası:', m), 'Bir şeyler ters gitti, birazdan tekrar dene.');   // ham İngilizce sunucu metni gösterilmez

export interface Hesap { id: string; ad: string }
let me: Hesap | null = null;
export const hesap = () => me;

/** Sahte e-postadan ad (yalnız yedek): martikoy.<a>@gmail.com / <a>@martikoy.com, c1→ç ... */
const adOfMail = (mail: string) => mail.split('@')[0].replace(/^martikoy\./, '').replace(/c1/g, 'ç').replace(/g1/g, 'ğ').replace(/i1/g, 'ı').replace(/o1/g, 'ö').replace(/s1/g, 'ş').replace(/u1/g, 'ü');
/**
 * MARTI KİMLİK: görünen ad SUNUCUDAKİ oyuncular.kullanici_adi'dir (değiştirilemez, trigger korur). user_metadata.ad
 * oyuncunun kendisinin değiştirebildiği bir alan, ona hiç güvenilmez. Profil satırı yoksa (kayıtta bağlantı koptuysa)
 * burada onarılır: ad = giriş e-postasından çözülen ad (e-posta adın kendisinden türer, şifreyle doğrulandı).
 * Dönüş: profil var/onarıldı mı (false = sunucu okunamadı, ad e-postadan; oyun yine açılır, onarım sonraki girişte).
 */
async function kimlikBagla(c: SupabaseClient, s: Session, yazilanAd = ''): Promise<boolean> {
  const id = s.user.id, mailAd = adOfMail(String(s.user.email || '')), ad = (yazilanAd || mailAd || 'esnaf');
  me = { id, ad };
  try {
    const r = await c.from('oyuncular').select('kullanici_adi').eq('id', id).maybeSingle();
    if (r.error) return false;
    if (r.data?.kullanici_adi) { me = { id, ad: String(r.data.kullanici_adi) }; return true; }
    const u = await c.from('oyuncular').upsert({ id, kullanici_adi: ad });
    return !u.error;
  } catch { return false; }
}

export async function oturum(): Promise<Hesap | null> {
  const c = supa(); if (!c) return null;
  try {
    const { data } = await c.auth.getSession();
    if (!data.session) return (me = null);
    await kimlikBagla(c, data.session);
    return me;
  } catch { return null; }
}

export async function kayitOl(ad: string, sifre: string): Promise<string | null> {
  const c = supa(); if (!c) return 'Sunucu henüz bağlı değil.';
  ad = ad.trim().toLocaleLowerCase('tr');
  if (!userRe.test(ad)) return AD_KURALI;
  if (sifre.length < 6) return 'Şifre en az 6 karakter olmalı.';
  try {
    const taken = await c.from('oyuncular').select('id').eq('kullanici_adi', ad).maybeSingle();
    if (taken.error) return trErr(taken.error.message || 'network');
    if (taken.data) return 'Bu kullanıcı adı alınmış.';
    let data = null as Awaited<ReturnType<typeof c.auth.signUp>>['data'] | null, error: { message: string } | null = null;
    for (const email of mailsOf(ad)) {
      const r = await c.auth.signUp({ email, password: sifre, options: { data: { ad } } });
      data = r.data; error = r.error;
      if (!error || !/invalid/i.test(error.message) || /password/i.test(error.message)) break;
    }
    if (error || !data) return trErr(error ? error.message : 'Kayıt olmadı.');
    if (!data.session) return 'Hesap onay bekliyor, admine yaz.';
    // profil satırı (görünen adın kaynağı): bir kez yeniden dene; yine olmazsa oturumu kapat, net söyle. Hesap açıldı,
    // ilk girişte kimlikBagla satırı kendisi onarır; oyuncu "kayıt oldu mu olmadı mı" arafında kalmaz.
    const id = data.session.user.id;
    let pe: { message: string } | null = null;
    for (let i = 0; i < 2; i++) { try { pe = (await c.from('oyuncular').upsert({ id, kullanici_adi: ad })).error; } catch (e) { pe = { message: String((e as Error)?.message || e) }; } if (!pe) break; }
    if (pe) { me = null; try { await c.auth.signOut(); } catch { /* */ } return PROFIL_YAZILAMADI; }
    me = { id, ad };
    return null;
  } catch (e) { return trErr(String((e as Error)?.message || e)); }
}
export const PROFIL_YAZILAMADI = 'Hesabın açıldı ama bağlantı koptu, profilin tamamlanamadı. Hiçbir şey kaybolmadı: "Giriş yap" sekmesinden aynı ad ve şifreyle gir, kendiliğinden tamamlanır.';

export async function girisYap(ad: string, sifre: string): Promise<string | null> {
  const c = supa(); if (!c) return 'Sunucu henüz bağlı değil.';
  ad = ad.trim().toLocaleLowerCase('tr');
  // sunucuya hiç gitmeden yakalanan hatalar (her yanlış deneme 2 istek yiyordu)
  if (!ad) return 'Kullanıcı adını yaz.';
  if (!userRe.test(ad)) return AD_KURALI;
  if (!sifre) return 'Şifreni yaz.';
  try {
    let msg = '';
    for (const email of mailsOf(ad)) {
      const { data, error } = await c.auth.signInWithPassword({ email, password: sifre });
      if (!error && data.session) { await kimlikBagla(c, data.session, ad); return null; }
      msg = error?.message || 'Invalid login';
      if (/rate|fetch|network|Failed/i.test(msg)) break;
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
