import { describe, it, expect } from 'vitest';
import { IC_MEKANLAR, icLayout } from '../../src/content/ic-mekan';
import { ISLETME, SALON_ESYA, ARSA_ISLETME } from '../../src/content/esya';
import { MUTFAK_ISTASYON } from '../../src/content/mutfak';
// 2026-11-25 sahip: "balık restoranı gibi yerlerde alınan geliştirmeler hiçbir yerde görünmüyor". Satın alınabilen her eşya / istasyon,
// ait olduğu odanın yerleşiminde (görünümün çizdiği IcItem listesi) bir öğeye bağlı olmalı.
describe('her satın alınan geliştirme sahnede bir öğe', () => {
  it('salon eşyaları (W/E)', () => {
    for (const e of SALON_ESYA) {
      const m = IC_MEKANLAR.find(x => x.salon === e.salon)!;
      expect(icLayout(m, 10).some(i => i.esya === e.id), `salon ${e.salon}: ${e.id}`).toBe(true);
    }
  });
  it('mutfak istasyonları', () => {
    const m = IC_MEKANLAR.find(x => x.mutfak)!, items = icLayout(m, 10);
    for (const i of MUTFAK_ISTASYON) { if (i.islev === 'gorsel' && false) continue; expect(items.some(x => x.esya === i.id), `mutfak: ${i.id}`).toBe(true); }
  });
  it('dükkân eşyaları (her arsa, her seviye)', () => {
    for (const [arsa, isl] of Object.entries(ARSA_ISLETME)) {
      const odalar = IC_MEKANLAR.filter(x => x.arsa === arsa); if (!odalar.length) continue;
      const ids = new Set(odalar.flatMap(m => icLayout(m, 10).map(i => i.esya)));
      for (const e of ISLETME[isl].esya.filter(x => !(x as { teras?: boolean }).teras)) expect(ids.has(e.id), `${arsa}/${isl}: ${e.id} (${e.ad})`).toBe(true);
    }
  });
});
