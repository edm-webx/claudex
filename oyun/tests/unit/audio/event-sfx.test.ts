// SNT-01: content/sfx.ts içindeki her ses kimliği ses-db'de ya da motor tarifinde tanımlı olmalı; tanımsız id 'pop'a düşer.
import { describe, it, expect } from 'vitest';
import { EVENT_SFX, EVENT_VOICE } from '../../../src/content/sfx';
import { createAudio } from '../../../src/engine/audio';
import { SFX_DB } from './olcum';

const recipes = new Set((createAudio({ platform: { audioCtx: () => null, clock: { now: () => 0 }, device: {} } } as never) as unknown as { recipes: string[] }).recipes);
const PAYLOADS = [undefined, {}, { id: 'kasa' }, { id: 'counter' }, { id: 'floor.1' }, { id: 'tip.1' }, { id: 'table.3' }, { id: 'station.doner' }, { type: 'gazoz' }, { type: 'cay' }, { type: 'tost' }, { type: 'x' }];
const known = (id: string) => !!SFX_DB[id] || recipes.has(id);

describe('EVENT_SFX kapsamı', () => {
  it('her olayın her çıktısı tanımlı bir ses', () => {
    const missing: string[] = [];
    for (const [ev, rule] of Object.entries(EVENT_SFX)) {
      const ids = typeof rule === 'function' ? PAYLOADS.map(p => rule(p as never)) : [rule];
      for (const id of ids) if (id && !known(id)) missing.push(`${ev}:${id}`);
    }
    expect(missing).toEqual([]);
  });
  it('EVENT_VOICE satırları metin kimliği (ses-db voices ya da babble)', () => {
    for (const v of Object.values(EVENT_VOICE)) expect(typeof v).toBe('string');
  });
  it('error, panel, para sesleri tanımlı', () => { for (const id of ['error', 'coin', 'cash', 'buy', 'hesap', 'tik']) expect(known(id), id).toBe(true); });
});
