// Survey 2026-10-24 (Şart list): every food the owner marked as must-have is on the menu as a tarif, or as one of the six stations.
import { describe, it, expect } from 'vitest';
import { TARIFLER } from '../../src/content/yiyecek';

// Turkish-aware lowercase: İ→i, I→ı before lowercasing, so 'İskender' matches 'iskender'.
const tr = (s: string) => s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();

const SART = ['döner', 'çay', 'ayran', 'simit', 'tost', 'gazoz', 'kumpir', 'kokoreç', 'midye', 'Islak hamburger', 'mısır', 'dondurma',
  'lahmacun', 'pide', 'balık ekmek', 'köfte ekmek', 'çorba', 'pilav', 'börek', 'poğaça', 'baklava', 'künefe', 'salep', 'türk kahvesi',
  'limonata', 'portakal', 'şalgam', 'kek', 'waffle', 'hamburger', 'patates', 'nugget', 'pizza', 'sushi', 'tavuk pilav',
  'nohutlu pilav', 'çiğ köfte', 'gözleme', 'kestane', 'patlamış mısır', 'tulumba', 'lokma', 'sütlaç', 'kazandibi', 'dürüm',
  'tavuk döner', 'iskender', 'mantı'];

describe('survey menu coverage', () => {
  it('every Şart food has a tarif whose name contains it (or a stand name for the six basics)', () => {
    const names = TARIFLER.map(t => tr(t.name));
    const missing = SART.filter(w => !names.some(n => n.includes(tr(w))));
    expect(missing, 'missing foods').toEqual([]);
  });
});
