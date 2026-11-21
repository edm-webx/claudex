/**
 * Oturum logu (2026-10-27 user: "ben yokken biri girdiyse ismi, bişey yazdıysa ne yazdı, admin paneline özel, tek tek
 * tıklayarak görebileyim"). Every client appends its own rows to `oturum_log` (sosisci-oyun/sunucu/supabase-log.sql);
 * RLS lets only an admin read them. Table missing = silently off, the game plays on.
 */
import { supa, hesap, SUPABASE_URL, SUPABASE_KEY } from './supa';
import { sunucu } from './sunucu';

export type LogTur = 'giris' | 'cikis' | 'sohbet' | 'pm' | 'karakter';
export interface LogSatir { id: number; uid: string; ad: string; tur: LogTur; metin: string; veri: Record<string, unknown>; sunucu: number | null; zaman: string }

let token = '', girisAt = 0;
const cihaz = () => { try { const u = navigator.userAgent; return (/Mobi|Android|iPhone|iPad/i.test(u) ? '📱 ' : '💻 ') + (/Edg\//.test(u) ? 'Edge' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : 'Tarayıcı'); } catch { return '?'; } };

export async function logYaz(tur: LogTur, metin = '', veri: Record<string, unknown> = {}): Promise<void> {
  const c = supa(), h = hesap(); if (!c || !h) return;
  try { await c.from('oturum_log').insert({ uid: h.id, ad: h.ad, tur, metin: metin.slice(0, 300), veri, sunucu: sunucu() }); } catch { /* table missing */ }
}

/** after a good login: the giris row + a keepalive 'cikis' row when the tab closes */
export async function girisLogu(yeni: boolean): Promise<void> {
  const c = supa(); if (!c || !hesap()) return;
  try { token = (await c.auth.getSession()).data.session?.access_token || ''; } catch { token = ''; }
  girisAt = Date.now();
  void logYaz('giris', yeni ? 'Yeni hesap açtı' : 'Oyuna girdi', { cihaz: cihaz(), yeni });
  addEventListener('pagehide', cikisLogu, { once: true });
}
function cikisLogu() {
  const h = hesap(); if (!h || !token) return;
  const dk = Math.round((Date.now() - girisAt) / 60000);
  try {
    void fetch(SUPABASE_URL + '/rest/v1/oturum_log', { method: 'POST', keepalive: true,
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ uid: h.id, ad: h.ad, tur: 'cikis', metin: dk + ' dk oynadı', veri: { dk }, sunucu: sunucu() }) });
  } catch { /* */ }
}

/** admin only (RLS): newest first */
export async function logOku(limit = 400): Promise<LogSatir[] | null> {
  const c = supa(); if (!c) return null;
  try {
    const r = await c.from('oturum_log').select('id,uid,ad,tur,metin,veri,sunucu,zaman').order('id', { ascending: false }).limit(limit);
    return r.error ? null : (r.data as LogSatir[]);
  } catch { return null; }
}
