// SNT-04: her UI rolünün ses-db karşılığı var ve yumuşak/kısa; para olmayan onay 'ok'.
import { describe, it, expect } from 'vitest';
import { SFX_DB, sesOlc } from './olcum';

describe('UI ses ailesi', () => {
  const ROLLER = ['tik', 'ok', 'error', 'panelAc', 'panelKapat', 'sekme', 'slider', 'toggle', 'bildirim'];
  it('her rol tanımlı, en çok 9 ses', () => { for (const r of ROLLER) expect(SFX_DB[r], r).toBeTruthy(); expect(ROLLER.length).toBeLessThanOrEqual(9); });
  it('kısa (<0.5 sn), yumuşak (tepe < 0.2) ve tiz değil (merkez < 3 kHz)', () => {
    for (const r of ROLLER) { const o = sesOlc(r); expect(o.sure, r).toBeLessThan(0.5); expect(o.tepe, r).toBeLessThan(0.2); expect(o.merkez, r).toBeLessThan(3000); }
  });
  it('hızlı tıklamada kapı: tik soğuma süresi tanımlı', () => { expect(SFX_DB.tik.cooldown).toBeGreaterThanOrEqual(40); });
});
