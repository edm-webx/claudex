import { describe, it, expect, vi, beforeEach } from 'vitest';

// Karakter silme: yalnız o yuva temizlenir; banka, diğer yuvalar kalır; eski code aynası karakteri geri getirmez.
let db: Record<string, unknown> | null = null;
let yazOk = true;
vi.mock('../../../src/game/net/supa', () => ({
  hesap: () => ({ id: 'u1', ad: 'ali' }),
  veriOku: async () => (db ? JSON.parse(JSON.stringify(db)) : null),
  veriYaz: async (v: Record<string, unknown>) => { if (!yazOk) return false; db = JSON.parse(JSON.stringify(v)); return true; },
  veriKapanisYaz: () => true,
}));
const store = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, x: string) => { store.set(k, x); }, removeItem: (k: string) => { store.delete(k); } });

import { slotSil, slotlariYukle, slotListesi } from '../../../src/game/net/slots';

const sl = (code: string, ad: string) => ({ code, ad, sinif: 'asci', tip: 'a', level: 3, playT: 100, dukkan: '' });

beforeEach(() => {
  yazOk = true; store.clear();
  db = { code: 'C1', playT: 100, aktif: 1, slots: [sl('C0', 'bir'), sl('C1', 'iki'), null, sl('C3', 'dort')], banka: { tl: 500, esya: { simit: 2 } } };
});

describe('slotSil', () => {
  it('yalnız seçilen yuvayı siler; banka ve diğer yuvalar durur', async () => {
    expect(await slotSil(1)).toBe(true);
    const d = db as { slots: (ReturnType<typeof sl> | null)[]; banka: { tl: number; esya: Record<string, number> } };
    expect(d.slots[1]).toBeNull();
    expect(d.slots[0]?.code).toBe('C0'); expect(d.slots[3]?.code).toBe('C3');
    expect(d.banka).toEqual({ tl: 500, esya: { simit: 2 } });
  });
  it('eski code aynası temizlenir: silinen karakter yuva 1 olarak geri gelmez', async () => {
    await slotSil(1);
    expect((db as { code?: string }).code).toBeUndefined();
    await slotlariYukle();
    expect(slotListesi().map(x => x?.ad ?? null)).toEqual(['bir', null, null, 'dort']);
  });
  it('tek karakter silinince hesap boş yuvayla kalır, eski kayıttan geri doğmaz', async () => {
    db = { code: 'C9', playT: 5, slots: [sl('C9', 'tek'), null, null, null] };
    expect(await slotSil(0)).toBe(true);
    await slotlariYukle();
    expect(slotListesi().every(x => x === null)).toBe(true);
  });
  it('sunucu yazmayı reddederse false döner ve hiçbir şey silinmez', async () => {
    const once = JSON.stringify(db); yazOk = false;
    expect(await slotSil(0)).toBe(false);
    expect(JSON.stringify(db)).toBe(once);
    expect(slotListesi()[0]?.ad).toBe('bir');
  });
  it('boş yuva ve geçersiz indeks zarar vermez', async () => {
    expect(await slotSil(2)).toBe(true); expect(await slotSil(7)).toBe(false); expect(await slotSil(-1)).toBe(false);
    expect((db as { slots: unknown[] }).slots.filter(Boolean)).toHaveLength(3);
  });
  it('yerel kayıt sahibi işaretlenir: sonraki girişte buluttan yüklenir', async () => {
    await slotSil(1); expect(store.get('martikoy-save-owner')).toBe('silindi');
  });
});
