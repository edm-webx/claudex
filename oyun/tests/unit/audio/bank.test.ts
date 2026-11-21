// Bank LRU: döngü/parça önbelleği bütçeyi aşınca en eski atılır; toplam bellek tahmini bütçe altında.
import { describe, it, expect, vi } from 'vitest';
import { createBank, STREAM_BUDGET, type SesDb } from '../../../src/engine/audio/msynth';

const fakeAc = { createBuffer: (ch: number, len: number, sr: number) => { const d = new Float32Array(len); return { length: len, numberOfChannels: ch, sampleRate: sr, duration: len / sr, getChannelData: () => d } as unknown as AudioBuffer; } } as unknown as BaseAudioContext;
const db = (n: number): SesDb => ({ version: 1, patches: {}, sfx: {}, music: { tracks: {} } as never, voices: {},
  loops: Object.fromEntries(Array.from({ length: n }, (_, i) => ['l' + i, { dur: 4, layers: [{ k: 'noise', v: 0.2, d: 1 }] }])) as never });
const flush = async () => { for (let i = 0; i < 60; i++) await new Promise(r => setTimeout(r, 20)); };

describe('bank LRU', () => {
  it('bütçe aşılınca en az yakın kullanılan döngü atılır', async () => {
    const one = 4 * 24000 * 4;                       // 4 sn x 24 kHz mono float32
    const b = createBank(fakeAc, db(4), one * 2.5);
    for (let i = 0; i < 4; i++) { b.loop('l' + i, () => {}); await flush(); }
    const s = b.stats();
    expect(s.loops).toBe(2); expect(s.bytes).toBeLessThanOrEqual(one * 2.5);
  }, 20000);
  it('drop() önbellekten bırakır; varsayılan bütçe 12 MB (toplam ses belleği < 20 MB ruhu)', async () => {
    const b = createBank(fakeAc, db(1));
    b.loop('l0', () => {}); await flush(); expect(b.stats().loops).toBe(1);
    b.drop('loop', 'l0'); expect(b.stats().loops).toBe(0); expect(b.stats().bytes).toBe(0);
    expect(STREAM_BUDGET).toBeLessThanOrEqual(12 * 1024 * 1024);
  }, 10000);
});
void vi;
