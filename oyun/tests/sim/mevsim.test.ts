import { it, expect } from 'vitest';
import { mevsim } from '../../src/game/view/world/bufe-buyume';
it('seasonal decor follows the calendar', () => {
  expect(mevsim(new Date(2026, 9, 29))).toBe('bayrak');
  expect(mevsim(new Date(2026, 3, 23))).toBe('bayrak');
  expect(mevsim(new Date(2026, 3, 10))).toBe('lale');
  expect(mevsim(new Date(2026, 11, 31))).toBe('yilbasi');
  expect(mevsim(new Date(2026, 10, 8))).toBe(null);
});
