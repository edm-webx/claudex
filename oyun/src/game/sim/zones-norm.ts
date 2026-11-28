/**
 * KAL-02: GameState.zones doğrulayıcısı (zod'suz, elle). Her bölge kaydı için küçük bir şema: sayılar sonlu ve
 * [min,max] içine sıkışır, dizi/nesne tipi zorlanır, BİLİNMEYEN ANAHTARLAR KORUNUR (başka kolun yeni alanı silinmez).
 * Yeni bir S.zones.<anahtar> eklerken: buraya şema + tests/sim/save-roundtrip.test.ts'e tur testi şart (CONTRACT).
 * Pure: wall clock, DOM yok.
 */
import { DUKKAN_MAX_SEVIYE, KAFE_ISCI_TAVAN } from '../../content/esya';
import { OKUL_KELIME } from '../../content/okul';
import { YATIRIM_MAX } from '../../content/yatirim';

type F =
  | { k: 'n'; min: number; max: number; d: number; int?: boolean }
  | { k: 's'; d: string; max?: number }
  | { k: 'b' }
  | { k: 'a'; of?: F; max: number }
  | { k: 'r'; of?: F; max: number }               // string anahtarlı sözlük
  | { k: 'o'; f: Record<string, F> }
  | { k: 'nul'; of: F };                           // null olabilir

const BIG = 1e12;
const n = (min = 0, max = BIG, d = 0, int = true): F => ({ k: 'n', min, max, d, int });
const s = (d = '', max = 200): F => ({ k: 's', d, max });
const b: F = { k: 'b' };
const a = (of: F | undefined, max = 500): F => ({ k: 'a', of, max });
const r = (of: F | undefined, max = 500): F => ({ k: 'r', of, max });
const o = (f: Record<string, F>): F => ({ k: 'o', f });
const nul = (of: F): F => ({ k: 'nul', of });
const sa = a(s('', 80));
const sayac = r(n());

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Tek değeri şemaya göre onarır; değiştiyse ctx.fix++ . Verilen değer geçerliyse aynısını döndürür. */
function fix(v: unknown, f: F, ctx: { fix: number }): unknown {
  switch (f.k) {
    case 'n': {
      let x = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
      if (!Number.isFinite(x)) x = f.d;
      if (f.int) x = Math.floor(x);
      x = Math.min(f.max, Math.max(f.min, x));
      if (x !== v) ctx.fix++;
      return x;
    }
    case 's': { const x = typeof v === 'string' ? v.slice(0, f.max ?? 200) : f.d; if (x !== v) ctx.fix++; return x; }
    case 'b': { const x = !!v; if (x !== v) ctx.fix++; return x; }
    case 'nul': return v === null || v === undefined ? null : fix(v, f.of, ctx);
    case 'a': {
      if (!Array.isArray(v)) { ctx.fix++; return []; }
      let arr: unknown[] = v;
      if (arr.length > f.max) { arr = arr.slice(0, f.max); ctx.fix++; }
      if (f.of) { const el = f.of; arr = arr.map(x => fix(x, el, ctx)); }
      return arr;
    }
    case 'r': {
      if (!isObj(v)) { ctx.fix++; return {}; }
      const keys = Object.keys(v);
      if (keys.length > f.max) { ctx.fix++; for (const k of keys.slice(f.max)) delete v[k]; }
      if (f.of) for (const k of Object.keys(v)) v[k] = fix(v[k], f.of, ctx);
      return v;
    }
    case 'o': {
      if (!isObj(v)) { ctx.fix++; v = {}; }
      const rec = v as Record<string, unknown>;
      // yalnız VAR olan alanlar onarılır: eksik alanı tembel okuyucu (mulk/hava/hedef...) kendi varsayılanıyla kurar
      for (const k of Object.keys(f.f)) if (rec[k] !== undefined) rec[k] = fix(rec[k], f.f[k], ctx);
      return rec;
    }
  }
}

const plot = o({
  tur: { k: 'nul', of: s('', 12) }, tip: s('', 40), lv: n(1, DUKKAN_MAX_SEVIYE, 1), till: n(0, BIG, 0, false), sat: n(), fr: n(0, BIG, 0, false),
  isci: n(0, KAFE_ISCI_TAVAN, 0), esya: sa, tema: s('', 40),
});

/** Her bilinen bölge anahtarının şeması. Burada olmayan anahtarlar yalnız "nesne mi" diye bakılır. */
export const ZONE_SCHEMA: Record<string, F> = {
  envanter: o({ esya: sayac, sandik: sayac, sayac, sans: n(), acilan: n() }),
  arsa: o({
    plots: r(plot, 60),
    yedek: nul(o({ tl: n(), esya: sayac, faizGun: n(0, 1e6, 0) })),
    takim: nul(o({ ad: s('', 40), renk: s('', 20), renk2: s('', 20), arma: s('', 20), kurulus: n() })),
    kredi: nul(o({ borc: n(0, BIG, 0, false), gun: n(0, 1e6, 0) })),
    lastH: n(0, 48, 8, false),
  }),
  okul: o({ soru: n(-1, OKUL_KELIME.length - 1, -1), secenek: a(n(0, OKUL_KELIME.length - 1, 0), 12), cevap: n(0, 20, 0), dogru: n(0, 20, 0), sinavlar: a(n(0, 100, 0, false), 500), son: s('', 300), gunSinav: n(0, 1e6, 0), gunN: n(0, 100, 0), son5: a(n(0, 1000, 0), 10) }),
  avm: o({ alinan: sa }),
  salon: o({ esya: sa }),
  mutfak: o({ v: n(0, 9, 0), alinan: sa }),   // 2026-11-22 restoran mutfağı: sarı kareyle alınan istasyonlar (sim/mulk.ts mutfakZ)
  masa: o({ v: n(0, 9, 0), alinan: a(n(0, 200, 0), 80) }),   // 2026-11-22 kanat / salon / çatı masaları: sarı kareyle alınan sim masa indexleri (sim/mulk.ts masaZ)
  gizem: o({ basla: b, oku: r(n(0, 1e6, 0), 200) }),
  lig: o({ fin: n(0, 1e6, 0), bolum: r(n(0, 10, 0), 100), maclar: a(undefined, 2000), oynanan: r(b, 2000), gecmis: a(undefined, 500) }),
  halisaha: o({ offerDay: n(-1e6, 1e6, 0), played: n(), won: n(), drawn: n(), lost: n(), goals: n(), form: a(s('', 1), 40) }),
  yatirim: r(n(0, YATIRIM_MAX, 0), 100),
  kiyafet: o({ owned: sa, worn: r(s('', 60), 20) }),
  tabela: o({ tier: n(0, 20, 0), renk: s('', 20) }),
  mini: o({ day: n(-1e6, 1e6, 0), free: n(), ad: n(), adUsed: n(), gold: n(), best: r(n(0, BIG, 0, false), 50), stars: r(n(0, 3, 0), 50), plays: n(), coll: sa, bonusT: n(0, BIG, 0, false), buffN: n(), micro: n(), seenLevel: n() }),
  hava: o({ anchorDay: n(-1e6, 1e6, 0), anchorDate: s('', 20), wDay: n(-1e6, 1e6, 0), segs: a(undefined, 200), umb: n(), ev: r(undefined, 100), mem: sa, trophies: sa, extras: sa, lastEv: s('', 40), foodSold: n(), caught: n(), skipDay: n(-1e6, 1e6, 0) }),
  mantar: o({ day: n(-1e6, 1e6, -1), taken: a(undefined, 100), toplam: n() }),
  hedef: o({ slots: a(undefined, 10), doneN: n(), lastIds: sa, fold: b, pin: s('', 40), jar: n(0, BIG, 0, false), jarDay: n(-1e6, 1e6, 0), jarFull: b, jarFullAt: n(0, BIG, 0, false), prevEarned: n(0, BIG, 0, false) }),
  yetenek: o({ cdUntil: n(0, BIG, 0, false), until: n(0, BIG, 0, false) }),
};

/** Sanitizer'ı olmayan, yalnızca "nesne mi" diye bakılan bölgeler (kendi tembel okuyucuları varsayılan kurar). Yeni anahtarı buraya değil ZONE_SCHEMA'ya yaz. */
export const ZONE_GEVSEK = ['calisan', 'hikaye', 'koleksiyon', 'kurye', 'deniz', 'restoran', 'yiyecek', '_dekor', '_ev', 'pencere', 'zemin', 'martikoy', 'test-sokak', 'esnafim', 'esnaf', 'hijyen'] as const;

/** Ölü anahtarlar: 'dükkan zinciri' mekaniği kaldırıldı (kırmızı çizgi), kayıttaki izi silinir. */
export const OLU_ZONLAR = ['zincir'] as const;

/**
 * d.zones'u yerinde onarır, onarım notlarını notes'a yazar. Döner: değişen alan sayısı.
 * stok alanı (Plot.stok) kırmızı çizgi gereği göçte silinir.
 */
export function normalizeZones(zones: Record<string, Record<string, unknown>>, notes: string[] = []): number {
  const ctx = { fix: 0 };
  for (const k of OLU_ZONLAR) if (k in zones) { delete zones[k]; notes.push('zones.' + k + ' silindi'); ctx.fix++; }
  for (const k of Object.keys(zones)) {
    const f = ZONE_SCHEMA[k];
    if (!isObj(zones[k]) && !(f && f.k === 'r')) { delete zones[k]; notes.push('zones.' + k + ' bozuk, atıldı'); ctx.fix++; continue; }
    if (!f) continue;
    const before = ctx.fix;
    if (k === 'arsa') {
      const pl = (zones.arsa as { plots?: unknown }).plots;
      if (isObj(pl)) for (const id of Object.keys(pl)) {
        const p = pl[id];
        if (!isObj(p)) { delete pl[id]; ctx.fix++; continue; }   // bozuk arsa kaydı atılır (satın alınmamış sayılır)
        if ('stok' in p) delete p.stok;
        if (p.tur !== 'ev' && p.tur !== 'dukkan') p.tur = null;
      }
    }
    zones[k] = fix(zones[k], f, ctx) as Record<string, unknown>;
    if (ctx.fix > before) notes.push('zones.' + k + ' onarıldı (' + (ctx.fix - before) + ')');
  }
  return ctx.fix;
}
