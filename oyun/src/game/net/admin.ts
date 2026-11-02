/**
 * Yönetici sistemi (2026-10-25 user: itch.io sürümüne admin paneli). Şifre oyuna gömülmez: yönetici = Supabase'deki
 * `adminler` tablosunda satırı olan hesap (sosisci-oyun/sunucu/supabase-admin.sql). Ban / susturma / komut yazma RLS ile
 * sadece yöneticiye açık. Tablolar yoksa her şey sessizce kapalı kalır, oyun normal oynanır.
 */
import { supa, hesap } from './supa';

export interface Komut { id: number; olusturan?: string | null; hedef: string | null; tur: 'kick' | 'isinla' | 'para' | 'altin' | 'mesaj' | 'ayarla' | 'sifirla'; veri: Record<string, unknown> }
export interface Satir { id: string; ad: string; bitis: string | null; neden?: string }

let admin = false;
export const adminMi = () => admin;

const aktif = (bitis: string | null) => !bitis || new Date(bitis).getTime() > Date.now();
const bitisOf = (dk: number | null) => dk ? new Date(Date.now() + dk * 60000).toISOString() : null;

/** after a login: ban check on my own row + admin role check. Missing tables read as "no ban / not admin". */
export async function girisSonrasi(): Promise<{ yasak?: string }> {
  admin = false;
  const c = supa(), h = hesap(); if (!c || !h) return {};
  try {
    const y = await c.from('yasaklar').select('neden,bitis').eq('id', h.id).maybeSingle();
    if (y.data && aktif(y.data.bitis as string | null)) {
      const b = y.data.bitis as string | null;
      return { yasak: 'Bu hesap yasaklı' + (b ? ' (' + new Date(b).toLocaleString('tr') + ' tarihine kadar)' : '') + (y.data.neden ? ': ' + y.data.neden : '.') };
    }
  } catch { /* table missing */ }
  try { const a = await c.rpc('is_admin'); admin = a.data === true; } catch { admin = false; }
  return {};
}

/** usernames that need the secret key code (2026-10-25 user: only the owner's key code + password opens them) */
export const ADMIN_ADLARI = ['admin', 'xynena'];
export const adminAdiMi = (ad: string) => ADMIN_ADLARI.includes(ad.trim().toLowerCase());
/** key code check on the server (hash lives in the DB, never in the game). 'yok' = the SQL is not installed yet. */
export async function adminDogrula(kod: string): Promise<'ok' | 'yanlis' | 'yok'> {
  const c = supa(); if (!c) return 'yok';
  try {
    const r = await c.rpc('admin_dogrula', { kod });
    if (r.error) { const m = (r.error.code || '') + ' ' + (r.error.message || ''); return /42883|PGRST202|does not exist|Could not find/i.test(m) ? 'yok' : 'yanlis'; }
    return r.data === true ? 'ok' : 'yanlis';
  } catch { return 'yok'; }
}

// ---- mute list (everyone reads it so a muted player's chat is hidden for all) ----
const sus = new Map<string, string | null>();
export const susturuldu = (uid: string) => { const b = sus.get(uid); return b !== undefined && aktif(b); };
export const benSusturuldum = () => { const h = hesap(); return !!h && susturuldu(h.id); };
export async function susturmalariYenile() {
  const c = supa(); if (!c || !hesap()) return;
  try { const r = await c.from('susturmalar').select('id,bitis'); if (r.data) { sus.clear(); for (const s of r.data) sus.set(s.id as string, s.bitis as string | null); } } catch { /* */ }
}

// ---- admin actions (RLS refuses them for anyone else) ----
const ok = (e: { message: string } | null) => e ? e.message : null;
export async function komutGonder(hedef: string | null, tur: Komut['tur'], veri: Record<string, unknown> = {}): Promise<string | null> {
  const c = supa(); if (!c || !admin) return 'Yetkin yok.';
  try { return ok((await c.from('admin_komut').insert({ hedef, tur, veri })).error); } catch (e) { return String((e as Error)?.message || e); }
}
export async function yasakla(uid: string, dk: number | null, neden: string): Promise<string | null> {
  const c = supa(), h = hesap(); if (!c || !admin || !h) return 'Yetkin yok.';
  if (uid === h.id) return 'Kendini banlayamazsın.';
  const e = ok((await c.from('yasaklar').upsert({ id: uid, neden, bitis: bitisOf(dk), ekleyen: h.id })).error);
  if (!e) await komutGonder(uid, 'kick', { neden: 'Yasaklandın' + (neden ? ': ' + neden : '') });
  return e;
}
export async function yasakKaldir(uid: string) { const c = supa(); if (!c || !admin) return 'Yetkin yok.'; return ok((await c.from('yasaklar').delete().eq('id', uid)).error); }
export async function sustur(uid: string, dk: number | null): Promise<string | null> {
  const c = supa(); if (!c || !admin) return 'Yetkin yok.';
  const e = ok((await c.from('susturmalar').upsert({ id: uid, bitis: bitisOf(dk) })).error);
  if (!e) { sus.set(uid, bitisOf(dk)); await komutGonder(uid, 'mesaj', { text: 'Sohbette susturuldun.' }); }
  return e;
}
export async function susturKaldir(uid: string) { const c = supa(); if (!c || !admin) return 'Yetkin yok.'; sus.delete(uid); return ok((await c.from('susturmalar').delete().eq('id', uid)).error); }

export async function listeler(): Promise<{ yasaklar: Satir[]; susturmalar: Satir[] }> {
  const c = supa(); const out = { yasaklar: [] as Satir[], susturmalar: [] as Satir[] };
  if (!c || !admin) return out;
  try {
    const [y, s] = await Promise.all([c.from('yasaklar').select('id,neden,bitis'), c.from('susturmalar').select('id,bitis')]);
    const ids = [...(y.data || []), ...(s.data || [])].map(r => r.id as string);
    const names = new Map<string, string>();
    if (ids.length) { const o = await c.from('oyuncular').select('id,kullanici_adi').in('id', ids); for (const r of o.data || []) names.set(r.id as string, r.kullanici_adi as string); }
    for (const r of y.data || []) if (aktif(r.bitis as string | null)) out.yasaklar.push({ id: r.id as string, ad: names.get(r.id as string) || '?', bitis: r.bitis as string | null, neden: r.neden as string });
    for (const r of s.data || []) if (aktif(r.bitis as string | null)) out.susturmalar.push({ id: r.id as string, ad: names.get(r.id as string) || '?', bitis: r.bitis as string | null });
  } catch { /* */ }
  return out;
}

/** look up accounts by name (also finds players who are offline) */
export async function oyuncuAra(q: string): Promise<{ id: string; ad: string }[]> {
  const c = supa(); if (!c || !admin) return [];
  const t = q.trim().toLocaleLowerCase('tr').replace(/[^a-z0-9_çğıöşü]/g, ''); if (!t) return [];
  try { const r = await c.from('oyuncular').select('id,kullanici_adi').ilike('kullanici_adi', t + '%').limit(8); return (r.data || []).map(x => ({ id: x.id as string, ad: x.kullanici_adi as string })); } catch { return []; }
}
/** uid -> account name for the players currently in the world */
export async function adlar(ids: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>(); const c = supa(); if (!c || !ids.length) return m;
  try { const r = await c.from('oyuncular').select('id,kullanici_adi').in('id', ids); for (const x of r.data || []) m.set(x.id as string, x.kullanici_adi as string); } catch { /* */ }
  return m;
}

// ---- command polling (for the target's client) ----
let lastId = -1;   // first poll only learns the newest id so old commands never replay
export async function komutlariCek(): Promise<Komut[]> {
  const c = supa(), h = hesap(); if (!c || !h) return [];
  try {
    if (lastId < 0) { const m = await c.from('admin_komut').select('id').order('id', { ascending: false }).limit(1); lastId = m.error ? -1 : Number(m.data?.[0]?.id) || 0; return []; }
    const r = await c.from('admin_komut').select('id,hedef,tur,veri,olusturan').gt('id', lastId).order('id').limit(20);
    const out: Komut[] = [];
    for (const k of (r.data || []) as Komut[]) { lastId = Math.max(lastId, k.id); if (k.hedef === h.id || (k.hedef === null && k.tur !== 'kick' && k.olusturan !== h.id)) out.push(k); }
    return out;
  } catch { return []; }
}

/** wipe a player's cloud save + profile look (admin only); an online target also gets a 'sifirla' command and resets itself */
export async function hesapSifirla(uid: string): Promise<string | null> {
  const c = supa(); if (!c || !admin) return 'Yetkin yok.';
  try {
    const e1 = (await c.from('kayitlar').delete().eq('id', uid)).error;
    const e2 = (await c.from('oyuncular').update({ esnaf: {} }).eq('id', uid)).error;
    await komutGonder(uid, 'sifirla', {});
    return e1?.message || e2?.message || null;
  } catch (e) { return String((e as Error)?.message || e); }
}
