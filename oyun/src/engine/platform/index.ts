/**
 * engine/platform: guards for every browser API that may throw or be missing. No method ever throws.
 * Owner: Builder A.
 * Decisions:
 * - IndexedDB: one database 'marti' with one object store 'kv' (string keys, structured-clone values).
 *   If open fails (sandbox, private mode), idb.available() resolves false and every call becomes a no-op.
 * - `createPlatform(overrides)` lets tests inject a fake storage/idb/visibility; params come from location (or overrides.search).
 * - visibility.simulate(hidden) fires listeners with why='test' (hooks hide()/show()).
 */
import type { Platform, UrlParams, TierName, Disposer } from '../api';

const TIERS: TierName[] = ['akici', 'dengeli', 'sahane'];

export function parseParams(search: string, hash = ''): UrlParams {
  const raw: Record<string, string> = {};
  let sp: URLSearchParams | null = null;
  try { sp = new URLSearchParams(search); } catch { sp = null; }
  sp?.forEach((v, k) => { raw[k] = v; });
  const has = (k: string) => k in raw && raw[k] !== '0' && raw[k] !== 'false';
  const num = (k: string) => { if (!(k in raw) || raw[k] === '') return undefined; const n = Number(raw[k]); return Number.isFinite(n) ? n : undefined; };
  const tier = raw.tier as TierName | undefined;
  return {
    parity: has('parity'), time: num('time'), stage: num('stage'), seed: num('seed'),
    noloop: has('noloop'), noart: has('noart') || /(^|[#&])noart\b/.test(hash),
    tier: tier && TIERS.includes(tier) ? tier : undefined,
    edit: has('edit'), fresh: has('fresh'), save: raw.save || undefined, zone: raw.zone || undefined,
    raw,
  };
}

function safe<T>(fn: () => T, fb: T): T { try { return fn(); } catch { return fb; } }

export interface PlatformOverrides {
  search?: string; hash?: string;
  localStorage?: Storage | null;
  indexedDB?: IDBFactory | null;
}

export function createPlatform(ov: PlatformOverrides = {}): Platform {
  const g = globalThis as unknown as Record<string, any>;
  const loc = safe(() => g.location as Location | undefined, undefined);
  const params = parseParams(ov.search ?? loc?.search ?? '', ov.hash ?? loc?.hash ?? '');

  // ── localStorage
  const ls: Storage | null = 'localStorage' in ov ? ov.localStorage ?? null : safe(() => g.localStorage as Storage ?? null, null);
  const lsOk = safe(() => { if (!ls) return false; ls.setItem('__marti_t', '1'); ls.removeItem('__marti_t'); return true; }, false);
  const storage: Platform['storage'] = {
    available: lsOk,
    get: k => (lsOk ? safe(() => ls!.getItem(k), null) : null),
    set: (k, v) => (lsOk ? safe(() => { ls!.setItem(k, v); return true; }, false) : false),
    del: k => { if (lsOk) safe(() => ls!.removeItem(k), undefined); },
    keys: prefix => (lsOk ? safe(() => { const out: string[] = []; for (let i = 0; i < ls!.length; i++) { const k = ls!.key(i); if (k && k.startsWith(prefix)) out.push(k); } return out.sort(); }, []) : []),
  };

  // ── IndexedDB
  const factory: IDBFactory | null = 'indexedDB' in ov ? ov.indexedDB ?? null : safe(() => g.indexedDB as IDBFactory ?? null, null);
  let dbP: Promise<IDBDatabase | null> | null = null;
  const openDb = (): Promise<IDBDatabase | null> => {
    if (dbP) return dbP;
    dbP = new Promise<IDBDatabase | null>(res => {
      try {
        if (!factory) return res(null);
        const req = factory.open('marti', 1);
        const to = setTimeout(() => res(null), 3000);
        req.onupgradeneeded = () => { try { req.result.createObjectStore('kv'); } catch { /* exists */ } };
        req.onsuccess = () => { clearTimeout(to); res(req.result); };
        req.onerror = () => { clearTimeout(to); res(null); };
        req.onblocked = () => { clearTimeout(to); res(null); };
      } catch { res(null); }
    });
    return dbP;
  };
  const tx = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest, map: (r: any) => T, fb: T): Promise<T> =>
    openDb().then(db => new Promise<T>(res => {
      if (!db) return res(fb);
      try {
        const t = db.transaction('kv', mode);
        const r = fn(t.objectStore('kv'));
        let out = fb;
        r.onsuccess = () => { out = map(r.result); };
        t.oncomplete = () => res(out);
        t.onerror = () => res(fb);
        t.onabort = () => res(fb);
      } catch { res(fb); }
    }), () => fb);
  const idb: Platform['idb'] = {
    available: () => openDb().then(d => !!d, () => false),
    get: <T>(k: string) => tx<T | undefined>('readonly', s => s.get(k), r => r as T | undefined, undefined),
    set: (k, v) => tx('readwrite', s => s.put(v, k), () => true, false),
    del: k => tx('readwrite', s => s.delete(k), () => undefined, undefined),
    keys: prefix => tx('readonly', s => s.getAllKeys(), (r: IDBValidKey[]) => (r || []).map(String).filter(k => k.startsWith(prefix)).sort(), [] as string[]),
  };

  // ── audio
  let actx: AudioContext | null | undefined;
  const audioCtx = () => {
    if (actx !== undefined) return actx;
    actx = safe(() => { const C = g.AudioContext || g.webkitAudioContext; return C ? new C() as AudioContext : null; }, null);
    return actx;
  };

  // ── visibility
  const vis = new Set<(h: boolean, why: 'visibility' | 'pagehide' | 'test') => void>();
  let hidden = safe(() => !!g.document?.hidden, false);
  const fire = (h: boolean, why: 'visibility' | 'pagehide' | 'test') => {
    hidden = h;
    for (const cb of [...vis]) { try { cb(h, why); } catch (e) { console.error('[platform] visibility cb', e); } }
  };
  safe(() => {
    g.document?.addEventListener?.('visibilitychange', () => fire(!!g.document.hidden, 'visibility'));
    g.addEventListener?.('pagehide', () => fire(true, 'pagehide'));
    g.addEventListener?.('pageshow', () => { if (hidden && !g.document?.hidden) fire(false, 'visibility'); });
  }, undefined);

  const nav = safe(() => g.navigator as Navigator | undefined, undefined);
  const device = {
    memoryGB: safe(() => Number((nav as any)?.deviceMemory) || 4, 4),
    cores: safe(() => Number(nav?.hardwareConcurrency) || 4, 4),
    mobile: safe(() => /Android|iPhone|iPad|iPod|Mobile/i.test(nav?.userAgent || ''), false),
    touch: safe(() => (Number(nav?.maxTouchPoints) || 0) > 0 || 'ontouchstart' in g, false),
    reducedMotion: safe(() => !!g.matchMedia?.('(prefers-reduced-motion: reduce)').matches, false),
  };

  const perfNow = safe(() => g.performance && typeof g.performance.now === 'function', false);
  return {
    params,
    storage,
    idb,
    audioCtx,
    vibrate(ms = 12) { safe(() => nav?.vibrate?.(ms), false); },
    visibility: {
      get hidden() { return hidden; },
      onChange(cb): Disposer { vis.add(cb); return () => { vis.delete(cb); }; },
      simulate(h) { fire(h, 'test'); },
    },
    device,
    clock: {
      now: () => (perfNow ? g.performance.now() : g.Date.now()),
      wall: () => g.Date.now(),
    },
    copyText(text) {
      return new Promise<boolean>(res => {
        try {
          const cb = nav?.clipboard;
          if (cb?.writeText) { cb.writeText(text).then(() => res(true), () => res(fallbackCopy(text))); return; }
        } catch { /* fall through */ }
        res(fallbackCopy(text));
      });
    },
  };
}

function fallbackCopy(text: string): boolean {
  try {
    const d = (globalThis as any).document as Document | undefined;
    if (!d) return false;
    const ta = d.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    d.body.appendChild(ta); ta.select();
    const ok = d.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}
