// Survey 2026-10-24: clothing market uses parody chain names only (no real brand, no sound-alike that is the brand itself).
import { describe, it, expect } from 'vitest';
import { KIYAFET_ZINCIRLER, KIYAFET_URUNLER, kiyafetUrunleri } from '../../src/content/kiyafet';

const REAL = ['lc waikiki', 'koton', 'zara', 'mango', 'defacto', 'mavi', 'boyner', 'nike', 'adidas', 'h&m', 'bershka', 'pull&bear'];

describe('kıyafet marketi', () => {
  it('no chain or item carries a real brand name', () => {
    const names = [...KIYAFET_ZINCIRLER.map(z => z.name), ...KIYAFET_URUNLER.map(u => u.name)].map(s => s.toLowerCase());
    for (const r of REAL) for (const n of names) expect(n.includes(r), `${n} contains ${r}`).toBe(false);
  });
  it('every item points at a known chain and has a price and colours', () => {
    const ids = new Set(KIYAFET_ZINCIRLER.map(z => z.id));
    for (const u of KIYAFET_URUNLER) {
      expect(ids.has(u.zincir), u.id).toBe(true);
      expect(u.gold).toBeGreaterThan(0);
      expect(u.colors.length).toBeGreaterThan(0);
    }
  });
  it('the survey costumes exist: palyaço, korsan, spor forması, takım elbise', () => {
    const k = kiyafetUrunleri().filter(u => u.slot === 'kostum').map(u => u.name.toLowerCase());
    for (const w of ['palyaço', 'korsan', 'spor forması', 'takım elbise']) expect(k.some(n => n.includes(w)), w).toBe(true);
  });
});
