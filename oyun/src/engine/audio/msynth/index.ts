// Martı Synth bank: owns the rendered AudioBuffers. One-shots render on first use (a few ms) and are pre-warmed
// in idle slices after unlock; ambience loops and music tracks render in the background, one per slice, and are
// handed back by callback when ready. Nothing is ever synthesised per frame.
import { SR_SFX, SR_LOOP } from './dsp';
import { renderSfx, renderLoopGen, type SfxDef, type LoopDef, type RenderCtx } from './render';
import { renderTrackGen, varyasyon, taban, varyantNo, type MusicDb } from './music';
import type { OmniPatch } from './omni';
import type { VoiceProfile } from './voice';

export interface SesDb {
  version: number;
  patches: Record<string, OmniPatch>;
  sfx: Record<string, SfxDef>;
  loops: Record<string, LoopDef>;
  music: MusicDb;
  voices: Record<string, VoiceProfile>;
}
export interface Bank {
  readonly db: SesDb;
  hasSfx(id: string): boolean;
  /** Rendered buffer for a one-shot (renders now if needed); null if unknown. */
  sfx(id: string, variant?: number): AudioBuffer | null;
  /** Kac ses cesidi var (seed farkli render): varsayilan 4. */
  variantCount(id: string): number;
  /** Per-sound cooldown gate; returns false if `id` played too recently. */
  gate(id: string, nowMs: number): boolean;
  pitchVar(id: string): number;
  /** Background render of a loop / music track; cb fires with the buffer (sync if cached). */
  loop(id: string, cb: (b: AudioBuffer) => void): void;
  track(id: string, cb: (b: AudioBuffer) => void): void;
  /** Start pre-rendering every one-shot in idle slices. */
  prewarm(): void;
  /** Debug: how many buffers are cached. */
  stats(): { sfx: number; loops: number; tracks: number; queued: number; bytes: number };
  /** Önbellekten bırak (LRU dışında elle): çalan kaynak tamponu tuttuğu için güvenli. */
  drop(kind: 'loop' | 'track', id: string): void;
}

const idle = (fn: () => void) => {
  const w = globalThis as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 400 }); else setTimeout(fn, 16);
};

/** Döngü + parça önbellek tavanı (mono float32 bayt). PS3 ruhu: toplam ses belleği < 20 MB (sfx ~3 MB + bu). */
export const STREAM_BUDGET = 16 * 1024 * 1024;

export function createBank(ac: BaseAudioContext, db: SesDb, budget = STREAM_BUDGET): Bank {
  const rc = (sr: number): RenderCtx => ({ sr, patches: db.patches || {} });
  const sfxC = new Map<string, AudioBuffer>(), loopC = new Map<string, AudioBuffer>(), trackC = new Map<string, AudioBuffer>();
  const last = new Map<string, number>();
  const use = new Map<AudioBuffer, number>();   // loop/track son kullanım (LRU)
  let tick = 0;
  const size = (b: AudioBuffer) => b.length * (b.numberOfChannels || 1) * 4;
  const bytesOf = (m: Map<string, AudioBuffer>) => { let n = 0; for (const b of m.values()) n += size(b); return n; };
  /** Bütçe aşılınca en az yakın kullanılan loop/track tamponlarını at (yeni eklenen hariç). */
  function evict(keep: AudioBuffer | null) {
    for (;;) {
      let total = bytesOf(loopC) + bytesOf(trackC); if (total <= budget) return;
      let victim: { m: Map<string, AudioBuffer>; k: string; t: number } | null = null;
      for (const m of [loopC, trackC]) for (const [k, b] of m) { if (b === keep) continue; const t = use.get(b) ?? 0; if (!victim || t < victim.t) victim = { m, k, t }; }
      if (!victim) return;
      use.delete(victim.m.get(victim.k)!); victim.m.delete(victim.k);
    }
  }
  const waiting = new Map<string, ((b: AudioBuffer) => void)[]>();
  const queue: { key: string; gen: Generator<void, Float32Array>; sr: number; cache: Map<string, AudioBuffer> }[] = [];
  let busy = false;
  const toBuf = (data: Float32Array, sr: number): AudioBuffer | null => {
    try { const b = ac.createBuffer(1, Math.max(1, data.length), sr); b.getChannelData(0).set(data); return b; } catch { return null; }
  };
  function pump() {
    if (busy || !queue.length) return;
    busy = true;
    idle(() => {
      busy = false;
      const job = queue[0];
      if (!job) return;
      // ~6 ms of rendering per idle slice so the game never hitches
      const t0 = Date.now(); let done: Float32Array | null = null, failed = false;
      try { while (Date.now() - t0 < 6) { const r = job.gen.next(); if (r.done) { done = r.value; break; } } } catch { failed = true; }
      if (done || failed) {
        queue.shift();
        const b = done ? toBuf(done, job.sr) : null;
        if (b) { job.cache.set(job.key, b); use.set(b, ++tick); evict(b); }
        const cbs = waiting.get(job.key) || []; waiting.delete(job.key);
        if (b) for (const cb of cbs) { try { cb(b); } catch { /* listener */ } }
      }
      pump();
    });
  }
  function enqueue(key: string, cache: Map<string, AudioBuffer>, make: () => Generator<void, Float32Array>, sr: number, cb: (b: AudioBuffer) => void, front = false) {
    const hit = cache.get(key); if (hit) { use.set(hit, ++tick); cb(hit); return; }
    const w = waiting.get(key); if (w) { w.push(cb); return; }
    waiting.set(key, [cb]);
    const job = { key, gen: make(), sr, cache };
    if (front && queue.length) queue.unshift(job); else queue.push(job);
    pump();
  }
  /** Döngü dikişi tıkı (ölçüm: ic_mutfak 3.7x, ic_avm 4.7x, orman 3.1x medyan adım): başı ve sonu 12 ms'lik yumuşak kenarla bağla. */
  function sealSeam(b: AudioBuffer) {
    try {
      const n = Math.min(Math.floor(b.sampleRate * 0.012), Math.floor(b.length / 4));
      if (n < 8) return;
      for (let c = 0; c < b.numberOfChannels; c++) {
        const d = b.getChannelData(c);
        for (let i = 0; i < n; i++) { const k = i / n; d[i] *= k; d[d.length - 1 - i] *= k; }
      }
    } catch { /* read-only buffer: leave as is */ }
  }
  /** Gerçek kayıt: fetch + decodeAudioData (stereo, 48 kHz kalır); başarısızsa false -> sentez yedek. Aynı anahtar tek indirme. */
  function fromFile(key: string, cache: Map<string, AudioBuffer>, file: string, cb: (b: AudioBuffer) => void, fallback: (cb: (b: AudioBuffer) => void) => void) {
    const hit = cache.get(key); if (hit) { use.set(hit, ++tick); cb(hit); return; }
    const w = waiting.get(key); if (w) { w.push(cb); return; }
    waiting.set(key, [cb]);
    const f = (globalThis as unknown as { fetch?: (u: string) => Promise<{ ok: boolean; arrayBuffer(): Promise<ArrayBuffer> }> }).fetch;
    const fail = () => { const cbs = waiting.get(key) || []; waiting.delete(key); for (const c of cbs) fallback(c); };   // dosya yok/çözülemedi: sentez yedek
    if (!f) { fail(); return; }
    f('ses/' + file).then(r => { if (!r.ok) throw new Error('http'); return r.arrayBuffer(); })
      .then(ab => ac.decodeAudioData(ab))
      .then(b => { sealSeam(b); cache.set(key, b); use.set(b, ++tick); evict(b); const cbs = waiting.get(key) || []; waiting.delete(key); for (const c of cbs) { try { c(b); } catch { /* listener */ } } })
      .catch(fail);
  }
  const bank: Bank = {
    db,
    hasSfx: id => !!db.sfx[id],
    sfx(id, variant = 0) {
      const key = variant ? id + '#' + variant : id;
      const hit = sfxC.get(key); if (hit) return hit;
      const def = db.sfx[id]; if (!def) return null;
      let b: AudioBuffer | null = null;
      try { b = toBuf(renderSfx(key, def, rc(SR_SFX)), SR_SFX); } catch { b = null; }
      if (b) sfxC.set(key, b);
      return b;
    },
    variantCount: id => Math.max(1, db.sfx[id]?.variants ?? 4),
    gate(id, now) {
      const cd = db.sfx[id]?.cooldown ?? 30, l = last.get(id) ?? -1e9;
      if (now - l < cd) return false;
      last.set(id, now); return true;
    },
    pitchVar: id => db.sfx[id]?.pitchVar ?? 0,
    loop(id, cb) { const def = db.loops[id]; if (!def) return; if (def.file) { fromFile('L:' + id, loopC, def.file, cb, c => enqueue('L:' + id, loopC, () => renderLoopGen(id, def, rc(SR_LOOP)), SR_LOOP, c, true)); return; } enqueue('L:' + id, loopC, () => renderLoopGen(id, def, rc(SR_LOOP)), SR_LOOP, cb, true); },
    track(id, cb) {
      const b = taban(id), v = varyantNo(id), base = db.music.tracks[b]; if (!base) return;
      if (base.file && !v) { fromFile('M:' + id, trackC, base.file, cb, c => enqueue('M:' + id, trackC, () => renderTrackGen(id, base, SR_LOOP), SR_LOOP, c)); return; }
      const t = varyasyon(b, base, v);
      enqueue('M:' + id, trackC, () => renderTrackGen(id, t, SR_LOOP), SR_LOOP, cb);
    },
    prewarm() {
      const ids = Object.keys(db.sfx).filter(id => !sfxC.has(id));
      let i = 0;
      const step = () => { const t0 = Date.now(); while (i < ids.length && Date.now() - t0 < 8) bank.sfx(ids[i++]); if (i < ids.length) idle(step); };
      idle(step);
    },
    drop(kind, id) { const m = kind === 'loop' ? loopC : trackC, k = (kind === 'loop' ? 'L:' : 'M:') + id, b = m.get(k); if (b) { use.delete(b); m.delete(k); } },
    stats: () => ({ sfx: sfxC.size, loops: loopC.size, tracks: trackC.size, queued: queue.length, bytes: bytesOf(sfxC) + bytesOf(loopC) + bytesOf(trackC) }),
  };
  return bank;
}
