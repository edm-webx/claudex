/**
 * engine/save: layered, defensive SaveStore (MOTOR §17). Owner: Builder A.
 * Pure: storage and clock come in via opts.platform; no DOM, no wall clock of its own.
 *
 * Layout (key = opts.key):
 *   <key>:s0..s2          rotating slots in the primary store (IndexedDB, else localStorage, else memory)
 *   <key>:0..2            localStorage mirror of the same slots when the primary is IndexedDB (v2 scheme)
 *   <key>:ptr             last written slot index + seq (written last)
 *   <key>:daily:<date>    one daily snapshot per UTC day, newest 7 kept
 *   <key>:pre:<v>:<at>    pre-migration snapshot (written before any migration runs)
 * Every record is a string `{"seq","at","v","sum","json"}`; sum = FNV-1a 32 over `json`.
 * Load: newest seq whose checksum verifies across primary+mirror -> daily backups (newest first) -> fresh defaults.
 * Decisions:
 * - exportCode = "MB1." + base64(UTF-8 JSON {v,sum,json}); no gzip (CompressionStream is async/optional; codes stay portable).
 * - importCode verifies, migrates + validates, then writes as the newest slot; caller re-runs load() to apply.
 * - A failing primary write demotes the mode (idb -> ls -> memory) for the rest of the session; never throws.
 */
import type { BackupInfo, Logger, SaveLoadResult, SaveOpts, SaveReason, SaveStore, Platform } from '../api';
import { fnv1a, hex8 } from '../core';

const SLOTS = 3;
const DAILY_KEEP = 7;
const INTERVAL_MS = 10_000;

interface Rec { seq: number; at: number; v: number; sum: string; json: string; }
interface KV { get(k: string): Promise<string | undefined>; set(k: string, v: string): Promise<boolean>; del(k: string): Promise<void>; keys(prefix: string): Promise<string[]>; }

const memKV = (): KV => {
  const m = new Map<string, string>();
  return {
    get: async k => m.get(k),
    set: async (k, v) => { m.set(k, v); return true; },
    del: async k => { m.delete(k); },
    keys: async p => [...m.keys()].filter(k => k.startsWith(p)).sort(),
  };
};
const lsKV = (s: Platform['storage']): KV => ({
  get: async k => { try { return s.get(k) ?? undefined; } catch { return undefined; } },
  set: async (k, v) => { try { return s.set(k, v); } catch { return false; } },
  del: async k => { try { s.del(k); } catch { /* ignore */ } },
  keys: async p => { try { return s.keys(p); } catch { return []; } },
});
const idbKV = (d: Platform['idb']): KV => ({
  get: async k => { try { const v = await d.get<string>(k); return typeof v === 'string' ? v : undefined; } catch { return undefined; } },
  set: async (k, v) => { try { return await d.set(k, v); } catch { return false; } },
  del: async k => { try { await d.del(k); } catch { /* ignore */ } },
  keys: async p => { try { return await d.keys(p); } catch { return []; } },
});

export function checksum(json: string): string { return hex8(fnv1a(json)); }

function parseRec(raw: string | undefined): Rec | null | 'bad' {
  if (raw == null) return null;
  try {
    const r = JSON.parse(raw) as Rec;
    if (typeof r?.json !== 'string' || typeof r.sum !== 'string') return 'bad';
    if (checksum(r.json) !== r.sum) return 'bad';
    return r;
  } catch { return 'bad'; }
}

function utf8ToB64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64ToUtf8(b: string): string {
  const bin = atob(b);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function createSave<S>(o: SaveOpts<S>): SaveStore<S> {
  const log: Logger | undefined = o.log;
  const K = o.key;
  let mode: 'idb' | 'ls' | 'memory' = 'memory';
  let primary: KV = memKV();
  let mirror: KV | null = null;
  let initP: Promise<void> | null = null;
  let seq = 0, nextSlot = 0, dirty = false, lastSaveAt = -1, writing: Promise<boolean> | null = null;
  const lsOk = (() => { try { return !!o.platform.storage?.available; } catch { return false; } })();

  const init = () => initP ??= (async () => {
    let idbOk = false;
    try { idbOk = !!(await o.platform.idb.available()); } catch { idbOk = false; }
    if (idbOk) { mode = 'idb'; primary = idbKV(o.platform.idb); mirror = lsOk ? lsKV(o.platform.storage) : null; }
    else if (lsOk) { mode = 'ls'; primary = lsKV(o.platform.storage); mirror = null; }
    else { mode = 'memory'; primary = memKV(); mirror = null; log?.warn('save: no storage, memory mode'); }
  })();

  const demote = () => {
    if (mode === 'idb' && lsOk) { mode = 'ls'; primary = lsKV(o.platform.storage); mirror = null; }
    else if (mode !== 'memory') { mode = 'memory'; primary = memKV(); mirror = null; }
    log?.warn('save: demoted to', mode);
  };
  const now = () => { try { return o.platform.clock.wall(); } catch { return 0; } };

  /** Writes a record to the next slot (primary, mirror, then pointer). */
  const writeRec = async (json: string, v: number): Promise<boolean> => {
    const rec: Rec = { seq: ++seq, at: now(), v, sum: checksum(json), json };
    const raw = JSON.stringify(rec);
    const slot = nextSlot; nextSlot = (nextSlot + 1) % SLOTS;
    let ok = await primary.set(`${K}:s${slot}`, raw);
    if (!ok) { demote(); ok = await primary.set(`${K}:s${slot}`, raw); }
    if (mirror) await mirror.set(`${K}:${slot}`, raw);
    await primary.set(`${K}:ptr`, JSON.stringify({ slot, seq: rec.seq }));
    // daily ring
    const day = dayOf(rec.at);
    const dk = `${K}:daily:${day}`;
    if (!(await primary.get(dk))) {
      await primary.set(dk, raw);
      const days = (await primary.keys(`${K}:daily:`)).sort();
      for (let i = 0; i < days.length - DAILY_KEEP; i++) await primary.del(days[i]);
    }
    return ok;
  };

  const readSlots = async (notes: string[]): Promise<{ rec: Rec; src: 'idb' | 'ls' }[]> => {
    const out: { rec: Rec; src: 'idb' | 'ls' }[] = [];
    const srcName = mode === 'idb' ? 'idb' : 'ls';
    for (let i = 0; i < SLOTS; i++) {
      const a = parseRec(await primary.get(`${K}:s${i}`));
      if (a === 'bad') notes.push(`checksum: slot ${i} bozuk`); else if (a) out.push({ rec: a, src: srcName });
      if (mirror) {
        const b = parseRec(await mirror.get(`${K}:${i}`));
        if (b === 'bad') notes.push(`checksum: yedek slot ${i} bozuk`); else if (b) out.push({ rec: b, src: 'ls' });
      }
    }
    return out.sort((x, y) => y.rec.seq - x.rec.seq);
  };

  /** Parse + migrate + validate. Throws on unusable data. */
  const adopt = async (json: string, notes: string[]): Promise<S> => {
    let data = JSON.parse(json) as any;
    if (!data || typeof data !== 'object') throw new Error('not an object');
    let v = typeof data.version === 'number' ? data.version : 0;
    if (v > o.version) throw new Error(`save version ${v} newer than ${o.version}`);
    if (v < o.version) {
      await primary.set(`${K}:pre:${v}:${now()}`, JSON.stringify({ seq: 0, at: now(), v, sum: checksum(json), json } satisfies Rec));
      while (v < o.version) {
        const m = o.migrations.find(x => x.from === v);
        if (!m) throw new Error(`no migration from v${v}`);
        data = m.up(data);
        v = m.to;
        if (data && typeof data === 'object') data.version = v;
        notes.push(`migrated v${m.from} -> v${m.to}`);
      }
    }
    const base = o.defaults() as any;
    for (const k of Object.keys(base)) if (!(k in data)) { data[k] = base[k]; notes.push(`missing field ${k} filled`); }
    try { notes.push(...o.validate(data as S)); } catch (e) { notes.push(`validate failed: ${(e as Error).message}`); }
    return data as S;
  };

  void init(); // decide the mode right away (state()/perf show it even before the first load/save)
  const store: SaveStore<S> = {
    get mode() { return mode; },
    async load(): Promise<SaveLoadResult<S>> {
      await init();
      const notes: string[] = [];
      try {
        const slots = await readSlots(notes);
        if (slots.length) { seq = Math.max(seq, slots[0].rec.seq); }
        // next slot = after the newest primary slot
        const ptr = await primary.get(`${K}:ptr`);
        try { if (ptr) nextSlot = ((JSON.parse(ptr).slot | 0) + 1) % SLOTS; } catch { /* ignore */ }
        for (const s of slots) {
          try {
            const data = await adopt(s.rec.json, notes);
            return { data, from: s.src, repaired: notes };
          } catch (e) { notes.push(`slot unusable: ${(e as Error).message}`); }
        }
        const days = (await primary.keys(`${K}:daily:`)).sort().reverse();
        for (const dk of days) {
          const r = parseRec(await primary.get(dk));
          if (!r || r === 'bad') { notes.push(`backup ${dk} bozuk`); continue; }
          try { const data = await adopt(r.json, notes); notes.push(`restored from ${dk.slice(K.length + 1)}`); return { data, from: 'backup', repaired: notes }; }
          catch (e) { notes.push(`backup unusable: ${(e as Error).message}`); }
        }
      } catch (e) { notes.push(`load error: ${(e as Error).message}`); }
      return { data: o.defaults(), from: 'fresh', repaired: notes };
    },
    save(reason: SaveReason) {
      const run = async (): Promise<boolean> => {
        await init();
        try {
          const data = o.get() as any;
          const json = JSON.stringify(data);
          const ok = await writeRec(json, typeof data?.version === 'number' ? data.version : o.version);
          if (ok) { dirty = false; lastSaveAt = now(); }
          return ok;
        } catch (e) { log?.error('save failed', reason, e); return false; }
      };
      // serialize writes
      const p = (writing ?? Promise.resolve(true)).then(run, run);
      writing = p;
      return p;
    },
    markDirty() { dirty = true; },
    tick(nowMs) {
      if (lastSaveAt < 0) lastSaveAt = nowMs;
      if (dirty && nowMs - lastSaveAt >= INTERVAL_MS) { lastSaveAt = nowMs; void store.save('interval'); }
    },
    async exportCode() {
      const json = JSON.stringify(o.get());
      return 'MB1.' + utf8ToB64(JSON.stringify({ v: o.version, sum: checksum(json), json }));
    },
    async importCode(code) {
      await init();
      try {
        const body = code.trim().replace(/^MB1\./, '');
        const env = JSON.parse(b64ToUtf8(body)) as { v: number; sum: string; json: string };
        if (typeof env.json !== 'string' || checksum(env.json) !== env.sum) return false;
        const data = await adopt(env.json, []);
        return await writeRec(JSON.stringify(data), o.version);
      } catch { return false; }
    },
    async backups() {
      await init();
      const out: BackupInfo[] = [];
      const add = async (k: string, kind: BackupInfo['kind']) => {
        const raw = await primary.get(k);
        const r = parseRec(raw);
        if (r && r !== 'bad') out.push({ id: k.slice(K.length + 1), kind, at: r.at, version: r.v, bytes: raw!.length });
      };
      for (const k of await primary.keys(`${K}:daily:`)) await add(k, 'daily');
      for (const k of await primary.keys(`${K}:pre:`)) await add(k, 'premigration');
      for (let i = 0; i < SLOTS; i++) await add(`${K}:s${i}`, 'slot');
      return out.sort((a, b) => b.at - a.at);
    },
    async restore(id) {
      await init();
      const r = parseRec(await primary.get(`${K}:${id}`));
      if (!r || r === 'bad') return false;
      try { const data = await adopt(r.json, []); return await writeRec(JSON.stringify(data), o.version); }
      catch { return false; }
    },
    async wipe() {
      await init();
      for (const kv of [primary, mirror]) {
        if (!kv) continue;
        for (const k of await kv.keys(`${K}:`)) await kv.del(k);
      }
      seq = 0; nextSlot = 0; dirty = false;
    },
  };
  return store;
}

/** Saves when the page hides (visibilitychange/pagehide/test hide()) and pauses/resumes an optional loop. */
export function bindSaveToVisibility<S>(save: SaveStore<S>, vis: Platform['visibility'], loop?: { pause(why: string): void; resume(): void }): () => void {
  return vis.onChange(hidden => {
    if (hidden) { loop?.pause('hidden'); void save.save('hidden'); }
    else loop?.resume();
  });
}
