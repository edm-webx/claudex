// Harita ızgarası: A1..Z14, 2 m kareler. Komutlar "A4" gibi adlarla verilecek, bu yüzden sabit kalmalı.
import { describe, it, expect } from 'vitest';
import { cellOf, cellRect, IZGARA_COLS, IZGARA_ROWS } from '../../src/content/izgara';

describe('izgara', () => {
  it('26 sütun, 14 satır; köşeler sabit', () => {
    expect(IZGARA_COLS).toBe(26); expect(IZGARA_ROWS).toBe(14);
    expect(cellOf(-25.9, -13.9)).toBe('A1'); expect(cellOf(25.9, 13.9)).toBe('Z14');
    expect(cellOf(0.1, 0.1)).toBe('N8'); expect(cellOf(-30, 0)).toBeNull(); expect(cellOf(0, 20)).toBeNull();
  });
  it('ad -> sınırlar -> ad', () => {
    for (const n of ['A1', 'A4', 'K2', 'O6', 'Z14']) { const r = cellRect(n)!; expect(cellOf(r.cx, r.cz)).toBe(n); }
    expect(cellRect('a4')).toEqual(cellRect('A4')); expect(cellRect('A15')).toBeNull(); expect(cellRect('AA1')).toBeNull();
    const a4 = cellRect('A4')!; expect([a4.x0, a4.x1, a4.z0, a4.z1]).toEqual([-26, -24, -8, -6]);
  });
});
