// Sahte Supabase kayitlar satırı: veri.rev üzerinde iyimser kilit (net/supa.ts veriYazKosullu ile aynı kural).
export interface SahteSunucu { row: { veri: Record<string, unknown> } | null; okuHata: boolean; yazHata: boolean; yazim: number; kapanis: number; /** bir sonraki yazımdan hemen önce bir kez çalışır: araya giren başka sekme/cihaz */ araGir?: (() => void) | null }
const kopya = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
export function sahteSupa(srv: SahteSunucu) {
  const yaz = (veri: Record<string, unknown>, rev: number, satir: boolean): 'ok' | 'cakisma' | 'hata' => {
    if (srv.araGir) { const f = srv.araGir; srv.araGir = null; f(); }
    if (srv.yazHata) return 'hata';
    if (!satir) { if (srv.row) return 'cakisma'; srv.row = { veri: kopya(veri) }; srv.yazim++; return 'ok'; }
    if (!srv.row) return 'cakisma';
    const cur = srv.row.veri.rev;
    const eslesir = rev > 0 ? String(cur) === String(rev) : cur == null;
    if (!eslesir) return 'cakisma';
    srv.row = { veri: kopya(veri) }; srv.yazim++;
    return 'ok';
  };
  return {
    hesap: () => ({ id: 'u1', ad: 'ali' }),
    veriOku: async () => (srv.okuHata ? { ok: false, veri: null, satir: false } : { ok: true, veri: srv.row ? kopya(srv.row.veri) : null, satir: !!srv.row }),
    veriYazKosullu: async (veri: Record<string, unknown>, rev: number, satir: boolean) => yaz(veri, rev, satir),
    veriKapanisYaz: (veri: Record<string, unknown>, rev: number, satir: boolean) => { srv.kapanis++; yaz(veri, rev, satir); return true; },
  };
}
export function sahteStore() {
  const store = new Map<string, string>();
  return { store, ls: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, x: string) => { store.set(k, x); }, removeItem: (k: string) => { store.delete(k); } } };
}
