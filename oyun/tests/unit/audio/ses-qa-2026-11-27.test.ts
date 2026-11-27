// 2026-11-27 ses/müzik QA düzeltmeleri: vapur düdüğü hiçbir yerde yok, tek öğeli olay havuzu boş çekmez, yağmur kısık,
// UI 'pick'/'tap' kimlikleri pop'a düşmez, EVENT_SFX'te horn yok.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import SES_DB from '../../../src/content/ses/ses-db.json';
import { Canta, YAGMUR_VOL, KURU_OLAY, AMBIYANS } from '../../../src/content/ses/ambiyans';
import { EVENT_SFX } from '../../../src/content/sfx';
import { DEFAULT_TABLE } from '../../../src/engine/audio/atmosphere';

const kok = join(__dirname, '../../..');
describe('vapur düdüğü kalktı', () => {
  it('ses-db, dosya, tablo ve olay eşlemesinde yok', () => {
    const db = SES_DB as unknown as { sfx: Record<string, unknown>; patches: Record<string, unknown> };
    expect(db.sfx.horn).toBeUndefined(); expect(db.patches.vapur).toBeUndefined();
    expect(existsSync(join(kok, 'public/ses/vapur.opus'))).toBe(false);
    expect(JSON.stringify(DEFAULT_TABLE)).not.toContain('"horn"');
    expect(JSON.stringify(AMBIYANS)).not.toContain('"horn"');
    expect(Object.values(EVENT_SFX).filter(v => v === 'horn')).toEqual([]);
    expect(Object.keys(EVENT_SFX)).not.toContain('ferryHorn');
  });
});
describe('tek öğeli olay havuzu', () => {
  it('her çekiliş dolu (eskiden her 2. çekiliş boştu)', () => {
    const c = new Canta([{ v: 'gull', w: 1 }], Math.random);
    for (let i = 0; i < 40; i++) expect(c.next()).toBe('gull');
  });
});
describe('yağmur ve kuru olaylar', () => {
  it('yağmur kazancı kısık, kuru dış olaylar listede', () => {
    expect(YAGMUR_VOL.firtina).toBeLessThanOrEqual(0.3); expect(YAGMUR_VOL.saganak).toBeLessThan(YAGMUR_VOL.firtina);
    for (const id of ['gull', 'birdTrill', 'simitci', 'kopek', 'cocuk']) expect(KURU_OLAY.has(id), id).toBe(true);
  });
});
describe('UI kimlikleri', () => {
  it("ui altında sfx('pick') / sfx('tap') yok (ses-db'de yok, pop'a düşerdi)", () => {
    const bad: string[] = [];
    for (const f of readdirSync(join(kok, 'src/game/ui'))) if (/\.(ts|mjs)$/.test(f) && /sfx\??\.?\(\s*'(pick|tap)'/.test(readFileSync(join(kok, 'src/game/ui', f), 'utf8'))) bad.push(f);
    expect(bad).toEqual([]);
  });
});
