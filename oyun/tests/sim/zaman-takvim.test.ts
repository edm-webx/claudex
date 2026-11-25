// ZMN-02 oyun takvimi: 1 oyun günü = 1 hafta, haftanın günü her gün 1 ilerler, mevsim sınırları yumuşak; ZMN-01 24 saatlik gün.
import { describe, it, expect } from 'vitest';
import { oyunTarihi, oyunHaftaGunu, oyunTakvim, havaAgirlik, seasonOfMonth, TAKVIM_ADIM, HAVA_KEY } from '../../src/game/sim/hava';
import { hourOf } from '../../src/game/sim/util';
import { GAME_DAY_S } from '../../src/engine/api';

const st = (day: number, extra: Record<string, unknown> = {}) => ({ day, calendar: '2026-11-25', zones: { [HAVA_KEY]: { anchorDate: '2026-11-25', anchorDay: 1, tv: 2, ...extra } } });

describe('oyun takvimi (ZMN-02)', () => {
  it('bir oyun günü bir hafta, haftanın günü bir gün ilerler', () => {
    expect(TAKVIM_ADIM).toBe(7);
    expect(oyunTakvim(st(1))).toBe('2026-11-25');
    expect(oyunTakvim(st(2))).toBe('2026-12-02');
    expect(oyunHaftaGunu(st(1))).toBe(3);   // 25 Kasım 2026 Çarşamba
    expect(oyunHaftaGunu(st(2))).toBe(4);
    expect(oyunHaftaGunu(st(5))).toBe(0);
  });

  it('bir mevsim 12-14 oyun günü sürer, yıl ~52 gün', () => {
    let prev = seasonOfMonth(oyunTarihi(st(1))!.m), start = 1;
    const lens: number[] = [];
    for (let d = 2; d < 200; d++) { const s = seasonOfMonth(oyunTarihi(st(d))!.m); if (s !== prev) { lens.push(d - start); start = d; prev = s; } }
    for (const l of lens.slice(1)) { expect(l).toBeGreaterThanOrEqual(12); expect(l).toBeLessThanOrEqual(14); }
  });

  it('eski kayıt (tv yok) bugünkü tarihi korur, gerçek takvim artık zıplatmaz', () => {
    const eski = { day: 10, calendar: '2027-05-01', zones: { [HAVA_KEY]: { anchorDate: '2026-11-25', anchorDay: 1 } } };
    expect(oyunTakvim(eski)).toBe('2026-12-04');   // old rule: one day per game day
  });

  it('mevsim sınırı yumuşak: sonbahar sonunda kar ihtimali azdan başlar', () => {
    const ekimOrta = havaAgirlik({ y: 2026, m: 10, d: 15 }), kasimSonu = havaAgirlik({ y: 2026, m: 11, d: 28 }), aralikBas = havaAgirlik({ y: 2026, m: 12, d: 3 }), ocak = havaAgirlik({ y: 2027, m: 1, d: 15 });
    expect(ekimOrta.kar || 0).toBe(0);
    expect(kasimSonu.kar || 0).toBeGreaterThan(0); expect(kasimSonu.kar!).toBeLessThan(aralikBas.kar!); expect(aralikBas.kar!).toBeLessThan(ocak.kar!);
  });
});

describe('24 saatlik gün (ZMN-01)', () => {
  it('gün 08:00da başlar, ertesi 08:00de biter; bir oyun saati 20 sn', () => {
    expect(hourOf(0)).toBe(8); expect(hourOf(GAME_DAY_S)).toBe(32); expect(hourOf(GAME_DAY_S / 2)).toBe(20);
    expect((hourOf(100) - hourOf(80)) * 20).toBeCloseTo(20, 6);
  });
});
