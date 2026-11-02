// Martı Synth bank: owns the rendered AudioBuffers. One-shots render on first use (a few ms) and are pre-warmed
// in idle slices after unlock; ambience loops and music tracks render in the background, one per slice, and are
// handed back by callback when ready. Nothing is ever synthesised per frame.
import { SR_SFX, SR_LOOP } from './dsp';
import { renderSfx, renderLoopGen, type SfxDef, type LoopDef, type RenderCtx } from './render';
import { renderTrackGen, type MusicDb } from './music';
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
  sfx(id: string): AudioBuffer | null;
  /** Per-sound cooldown gate; returns false if `id` played too recently. */
  gate(id: string, nowMs: number): boolean;
  pitchVar(id: string): number;
  /** Background render of a loop / music track; cb fires with the buffer (sync if cached). */
  loop(id: string, cb: (b: AudioBuffer) => void): void;
  track(id: string, cb: (b: AudioBuffer) => void): void;
  /** Start pre-rendering every one-shot in idle slices. */
  prewarm(): void;
  /** Debug: how many buffers are cached. */
  stats(): { sfx: number; loops: number; tracks: number; queued: number };
}

const idle = (fn: () => void) => {
  const w = globalThis as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 400 }); else setTimeout(fn, 16);
};

export function createBank(ac: BaseAudioContext, db: SesDb): Bank {
  const rc = (sr: number): RenderCtx => ({ sr, patches: db.patches || {} });
  const sfxC = new Map<string, AudioBuffer>(), loopC = new Map<string, AudioBuffer>(), trackC = new Map<string, AudioBuffer>();
  const last = new Map<string, number>();
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
        if (b) job.cache.set(job.key, b);
        const cbs = waiting.get(job.key) || []; waiting.delete(job.key);
        if (b) for (const cb of cbs) { try { cb(b); } catch { /* listener */ } }
      }
      pump();
    });
  }
  function enqueue(key: string, cache: Map<string, AudioBuffer>, make: () => Generator<void, Float32Array>, sr: number, cb: (b: AudioBuffer) => void, front = false) {
    const hit = cache.get(key); if (hit) { cb(hit); return; }
    const w = waiting.get(key); if (w) { w.push(cb); return; }
    waiting.set(key, [cb]);
    const job = { key, gen: make(), sr, cache };
    if (front && queue.length) queue.splice(1, 0, job); else queue.push(job);
    pump();
  }
  const bank: Bank = {
    db,
    hasSfx: id => !!db.sfx[id],
    sfx(id) {
      const hit = sfxC.get(id); if (hit) return hit;
      const def = db.sfx[id]; if (!def) return null;
      let b: AudioBuffer | null = null;
      try { b = toBuf(renderSfx(id, def, rc(SR_SFX)), SR_SFX); } catch { b = null; }
      if (b) sfxC.set(id, b);
      return b;
    },
    gate(id, now) {
      const cd = db.sfx[id]?.cooldown ?? 30, l = last.get(id) ?? -1e9;
      if (now - l < cd) return false;
      last.set(id, now); return true;
    },
    pitchVar: id => db.sfx[id]?.pitchVar ?? 0,
    loop(id, cb) { const def = db.loops[id]; if (!def) return; enqueue('L:' + id, loopC, () => renderLoopGen(id, def, rc(SR_LOOP)), SR_LOOP, cb, true); },
    track(id, cb) { const t = db.music.tracks[id]; if (!t) return; enqueue('M:' + id, trackC, () => renderTrackGen(id, t, SR_LOOP), SR_LOOP, cb); },
    prewarm() {
      const ids = Object.keys(db.sfx).filter(id => !sfxC.has(id));
      let i = 0;
      const step = () => { const t0 = Date.now(); while (i < ids.length && Date.now() - t0 < 8) bank.sfx(ids[i++]); if (i < ids.length) idle(step); };
      idle(step);
    },
    stats: () => ({ sfx: sfxC.size, loops: loopC.size, tracks: trackC.size, queued: queue.length }),
  };
  return bank;
}
