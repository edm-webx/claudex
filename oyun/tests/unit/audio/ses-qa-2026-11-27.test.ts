// 2026-11-27 ses/müzik QA düzeltmeleri: vapur düdüğü yalnız vapur yanaşırken, tek öğeli olay havuzu boş çekmez, yağmur kısık,
// UI 'pick'/'tap' kimlikleri pop'a düşmez, EVENT_SFX'te horn yok.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import SES_DB from '../../../src/content/ses/ses-db.json';
import { Canta, YAGMUR_VOL, KURU_OLAY, AMBIYANS } from '../../../src/content/ses/ambiyans';
import { EVENT_SFX } from '../../../src/content/sfx';
import { DEFAULT_TABLE } from '../../../src/engine/audio/atmosphere';

const kok = join(__dirname, '../../..');
// 2026-11-27 (sonra) sahibi: vapur geri geldi, düdüğü de geri. Düdük YALNIZ gerçek vapur yanaşırken (ferryHorn olayı) çalar:
// rastgele ambiyans düdüğü yok (vapur yokken düdük duyulmasın).
describe('vapur düdüğü yalnız vapurla', () => {
  it('ses-db horn + vapur yaması var; olay eşlemesi ferryHorn -> horn; ambiyansta rastgele düdük yok', () => {
    const db = SES_DB as unknown as { sfx: Record<string, unknown>; patches: Record<string, unknown> };
    expect(db.sfx.horn).toBeDefined(); expect(db.patches.vapur).toBeDefined();
    expect(JSON.stringify(DEFAULT_TABLE)).not.toContain('"horn"');
    expect(JSON.stringify(AMBIYANS)).not.toContain('"horn"');
    expect(EVENT_SFX.ferryHorn).toBe('horn');
    expect(Object.entries(EVENT_SFX).filter(([, v]) => v === 'horn').map(([k]) => k)).toEqual(['ferryHorn']);
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
