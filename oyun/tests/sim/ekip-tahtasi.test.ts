// BUF-27: ekip tahtası saf çekirdeği: çalışan satırları ve darboğaz ipucu (yeni mekanik yok, yalnız görünürlük).
import { describe, it, expect } from 'vitest';
import { tahtaOf } from '../../src/game/sim/ekip-tahta';
import { PASS_KAP } from '../../src/content/mutfak';

const view = (o: Record<string, unknown> = {}) => ({ active: true, tickets: [], servis: 4, stands: [], pass: [], ist: {}, sefHizi: 0, oyuncu: { ist: null, p: null, frac: 0, elde: 0 }, devir: {}, masalar: [], ...o }) as never;
const bilet = (no: number, p: string) => ({ no, table: no, frac: 0.2, items: [{ p, dish: null, name: p, n: 1, left: 1 }] });
const rows = (...r: [number, string, string][]) => r.map(([id, role, state]) => ({ id, name: 'K' + id, role, state }));

describe('ekip tahtası', () => {
  it('pass dolu: garson ekle ipucu', () => {
    const t = tahtaOf({ rows: rows([1, 'asci', 'kCook'], [2, 'garson', 'toMasa']), view: view({ pass: Array(PASS_KAP).fill('tost') }), bulasik: 0, stage: 5 });
    expect(t.ipucu).toBe('Pass dolu, garson ekle');
    expect(t.satirlar.map(s => s.durum)).toEqual(['Pişiriyor', 'Masaya gidiyor']);
  });
  it('ızgara hattında 3 fiş bekliyor', () => {
    const t = tahtaOf({ rows: rows([1, 'asci', 'kIdle'], [2, 'garson', 'idle']), view: view({ tickets: [bilet(1, 'tost'), bilet(2, 'tost'), bilet(3, 'tost')] }), bulasik: 0, stage: 5 });
    expect(t.ipucu).toBe('Izgara hattında 3 fiş bekliyor');
  });
  it('garson yok ve bulaşık yığını', () => {
    const t = tahtaOf({ rows: rows([1, 'asci', 'kCook']), view: view({ masalar: [{ table: 0, durum: 'hesap', frac: 0.1 }] }), bulasik: 12, stage: 5 });
    expect(t.ipuclari).toEqual(['Garson yok, masalar bekliyor', 'Bulaşık yığını 12 tabak, bulaşıkçı ekle']);
  });
  it('tıkanma yoksa ipucu null, restoran yoksa boş tahta', () => {
    expect(tahtaOf({ rows: rows([1, 'garson', 'idle']), view: view(), bulasik: 0, stage: 5 }).ipucu).toBeNull();
    expect(tahtaOf({ rows: [], view: null, bulasik: 0, stage: 1 }).satirlar).toEqual([]);
  });
});
