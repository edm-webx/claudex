import { describe, it, expect, vi, beforeEach } from 'vitest';

// Karakter silme: yalnız o yuva temizlenir; banka, diğer yuvalar kalır; eski code aynası karakteri geri getirmez.
import type { SahteSunucu } from './sahte-supa';
const srv = vi.hoisted(() => ({ row: null, okuHata: false, yazHata: false, yazim: 0, kapanis: 0 }) as SahteSunucu);
vi.mock('../../../src/game/net/supa', async () => (await import('./sahte-supa')).sahteSupa(srv));
const { store, ls } = (await import('./sahte-supa')).sahteStore();
vi.stubGlobal('localStorage', ls);
let db: Record<string, unknown> | null = null;
let yazOk = true;
// eski testin db/yazOk değişkenleri sahte sunucuya bağlanır
const bagla = () => { srv.row = db ? { veri: db } : null; srv.yazHata = !yazOk; };
const oku = () => { db = srv.row ? srv.row.veri : null; return db; };

import { slotSil, slotlariYukle, slotListesi } from '../../../src/game/net/slots';

const sl = (code: string, ad: string) => ({ code, ad, sinif: 'asci', tip: 'a', level: 3, playT: 100, dukkan: '' });

beforeEach(() => {
  yazOk = true; store.clear(); srv.okuHata = false;
  db = { code: 'C1', playT: 100, aktif: 1, slots: [sl('C0', 'bir'), sl('C1', 'iki'), null, sl('C3', 'dort')], banka: { tl: 500, esya: { simit: 2 } } };
  bagla();
});

describe('slotSil', () => {
  it('yalnız seçilen yuvayı siler; banka ve diğer yuvalar durur', async () => {
    expect(await slotSil(1)).toBe(true);
    const d = oku() as { slots: (ReturnType<typeof sl> | null)[]; banka: { tl: number; esya: Record<string, number> } };
    expect(d.slots[1]).toBeNull();
    expect(d.slots[0]?.code).toBe('C0'); expect(d.slots[3]?.code).toBe('C3');
    expect(d.banka).toEqual({ tl: 500, esya: { simit: 2 } });
  });
  it('eski code aynası temizlenir: silinen karakter yuva 1 olarak geri gelmez', async () => {
    await slotSil(1);
    expect((oku() as { code?: string }).code).toBeUndefined();
    await slotlariYukle();
    expect(slotListesi().map(x => x?.ad ?? null)).toEqual(['bir', null, null, 'dort']);
  });
  it('tek karakter silinince hesap boş yuvayla kalır, eski kayıttan geri doğmaz', async () => {
    db = { code: 'C9', playT: 5, slots: [sl('C9', 'tek'), null, null, null] }; bagla();
    expect(await slotSil(0)).toBe(true);
    await slotlariYukle();
    expect(slotListesi().every(x => x === null)).toBe(true);
  });
  it('sunucu yazmayı reddederse false döner ve hiçbir şey silinmez', async () => {
    const once = JSON.stringify(db); yazOk = false; bagla();
    expect(await slotSil(0)).toBe(false);
    expect(JSON.stringify(oku())).toBe(once);
    expect(slotListesi()[0]?.ad).toBe('bir');
  });
  it('boş yuva ve geçersiz indeks zarar vermez', async () => {
    expect(await slotSil(2)).toBe(true); expect(await slotSil(7)).toBe(false); expect(await slotSil(-1)).toBe(false);
    expect((oku() as { slots: unknown[] }).slots.filter(Boolean)).toHaveLength(3);
  });
  it('yerel kayıt sahibi işaretlenir: sonraki girişte buluttan yüklenir', async () => {
    await slotSil(1); expect(store.get('martikoy-save-owner')).toBe('silindi');
  });
  it('sunucu okunamazsa silmez, false döner', async () => {
    const once = JSON.stringify(db); srv.okuHata = true;
    expect(await slotSil(0)).toBe(false);
    expect(JSON.stringify(oku())).toBe(once);
  });
  it('silme okuması ile yazımı arasında karakter başka yerde oynandıysa körlemesine silmez', async () => {
    srv.araGir = () => { const v = srv.row!.veri as { rev?: number; slots: { code: string }[] }; v.rev = 9; v.slots[0].code = 'C0-yeni'; };
    expect(await slotSil(0)).toBe(false);
    expect((oku() as { slots: { code: string }[] }).slots[0].code).toBe('C0-yeni');
  });
});
