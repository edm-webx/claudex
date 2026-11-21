import { describe, it, expect, vi, beforeEach } from 'vitest';
// KAYIT-GUV (tarama 2026-11-21 KAYIT/BULUT): oyuncu verisi hiçbir durumda sessizce silinmez / ezilmez.
import type { SahteSunucu } from './sahte-supa';
const srv = vi.hoisted(() => ({ row: null, okuHata: false, yazHata: false, yazim: 0, kapanis: 0 }) as SahteSunucu);
vi.mock('../../../src/game/net/supa', async () => (await import('./sahte-supa')).sahteSupa(srv));
const { store, ls } = (await import('./sahte-supa')).sahteStore();
vi.stubGlobal('localStorage', ls);

type Slots = typeof import('../../../src/game/net/slots');
/** her çağrı ayrı bir sekme: modül durumu (bellekteki kayıt) ayrı, sunucu ortak */
async function sekme(): Promise<Slots> { vi.resetModules(); return await import('../../../src/game/net/slots'); }
async function gir(t: Slots, slot: number) { expect(await t.slotlariYukle()).toBe(true); t.slotSec(slot); return t.bulutOku(); }

const sl = (code: string, ad: string, playT = 100) => ({ code, ad, sinif: 'asci', tip: 'a', level: 3, playT, dukkan: '' });
type V = { rev?: number; code?: string; slots: (ReturnType<typeof sl> | null)[]; banka: { tl: number; esya: Record<string, number> } };
const veri = () => srv.row!.veri as unknown as V;

beforeEach(() => {
  store.clear(); srv.okuHata = false; srv.yazHata = false; srv.yazim = 0; srv.kapanis = 0; srv.araGir = null;
  srv.row = { veri: { code: 'C0', playT: 100, aktif: 0, slots: [sl('C0', 'bir'), sl('C1', 'iki'), null, null], banka: { tl: 500, esya: { simit: 2 } } } };
});

describe('bulut okuma hatası (sev5)', () => {
  it('okunamayan kayıt "4 boş yuva" sayılmaz; hiçbir yazım gitmez, banka silinmez', async () => {
    const once = JSON.stringify(srv.row); srv.okuHata = true;
    const t = await sekme();
    expect(await t.slotlariYukle()).toBe(false);
    expect(t.slotOkumaHatasi()).toBe(true);
    expect(t.slotsHazir()).toBe(false);
    t.slotSec(0);
    await expect(t.bulutOku()).rejects.toThrow();
    expect(await t.bulutYaz('YENI', 0, { ad: 'x' }, 1)).toBe(false);
    expect(await t.bankaYaz({ tl: 0, esya: {} })).toBe(false);
    expect(t.bulutKapanisYaz('YENI', 0, null, 1)).toBe(false);
    expect(srv.yazim + srv.kapanis).toBe(0);
    expect(JSON.stringify(srv.row)).toBe(once);
  });
  it('bağlantı gelince yeniden denenen okuma gerçek yuvaları getirir', async () => {
    srv.okuHata = true; const t = await sekme();
    expect(await t.slotlariYukle()).toBe(false);
    srv.okuHata = false;
    expect(await t.slotlariYukle()).toBe(true);
    expect(t.slotListesi().map(s => s?.ad ?? null)).toEqual(['bir', 'iki', null, null]);
  });
  it('aktif yuva boot tarafından okunmadan (bulutOku) hiçbir şey yazılmaz', async () => {
    const t = await sekme(); await t.slotlariYukle(); t.slotSec(0);
    expect(await t.bulutYaz('BOS', 0, null, 1)).toBe(false);
    expect(veri().slots[0]!.code).toBe('C0');
  });
  it('yeni hesap (satır yok) normal başlar ve ilk yazım satırı açar', async () => {
    srv.row = null; const t = await sekme();
    expect(await gir(t, 0)).toBeNull();
    expect(t.slotYeni()).toBe(true);
    expect(await t.bulutYaz('K1', 5, { ad: 'ali' }, 1)).toBe(true);
    expect(veri().slots[0]!.code).toBe('K1'); expect(veri().rev).toBe(1);
  });
});

describe('sürüm kilidi / bozuk kayıt (sev5)', () => {
  it('kilitliyken bulut, kapanış ve yerel yedek yazımı reddedilir', async () => {
    const t = await sekme(); await gir(t, 0);
    t.kayitKilitle('surum');
    expect(t.kayitKilidi()).toBe('surum');
    expect(await t.bulutYaz('BOS', 0, null, 1)).toBe(false);
    expect(t.bulutKapanisYaz('BOS', 0, null, 1)).toBe(false);
    expect(await t.bankaYaz({ tl: 0, esya: {} })).toBe(false);
    t.yerelYedekYaz('BOS', 0, 1);
    expect([...store.keys()].some(k => k.startsWith('martikoy-yedek:'))).toBe(false);
    expect(veri().slots[0]!.code).toBe('C0'); expect(srv.yazim + srv.kapanis).toBe(0);
  });
  it('kodSurumu: geçerli kodun sürümünü okur, bozuk kodda null', async () => {
    const t = await sekme();
    const kod = (v: number, data: unknown) => { const json = JSON.stringify(data); return 'MB1.' + btoa(JSON.stringify({ v, sum: 'x', json })); };
    expect(t.kodSurumu(kod(2, { version: 2 }))).toBe(2);
    expect(t.kodSurumu(kod(2, { version: 3 }))).toBe(3);   // iç sürüm daha yeni: yeni sürüm sayılır
    expect(t.kodSurumu(kod(3, { version: 3 }))).toBe(3);
    expect(t.kodSurumu('MB1.!!bozuk')).toBeNull();
    expect(t.kodSurumu('MB1.' + btoa('{"v":2,"json":"{kirik"}'))).toBeNull();
  });
});

describe('çift sekme / iki cihaz (sev4)', () => {
  it('farklı yuvalar: iki sekme de kaydeder, kimse diğerini geri almaz', async () => {
    const a = await sekme(); await gir(a, 0);
    const b = await sekme(); await gir(b, 1);
    expect(await a.bulutYaz('C0-a', 200, { ad: 'bir' }, 4)).toBe(true);
    expect(await b.bulutYaz('C1-b', 300, { ad: 'iki' }, 5)).toBe(true);   // bayat rev: yeniden okur, birleştirir
    expect(await a.bulutYaz('C0-a2', 260, { ad: 'bir' }, 4)).toBe(true);
    expect(veri().slots[0]!.code).toBe('C0-a2'); expect(veri().slots[1]!.code).toBe('C1-b');
    expect(veri().banka).toEqual({ tl: 500, esya: { simit: 2 } });
    expect(a.kayitKilidi()).toBeNull(); expect(b.kayitKilidi()).toBeNull();
  });
  it('aynı yuva: ikinci sekme ilkinin ilerlemesini ezmez, salt-okunur olur', async () => {
    const a = await sekme(); await gir(a, 0);
    const b = await sekme(); await gir(b, 0);
    expect(await a.bulutYaz('C0-a', 900, { ad: 'bir' }, 9)).toBe(true);
    expect(await b.bulutYaz('C0-b', 150, { ad: 'bir' }, 3)).toBe(false);
    expect(b.kayitKilidi()).toBe('cakisma');
    expect(veri().slots[0]!.code).toBe('C0-a');
    expect(b.bulutKapanisYaz('C0-b', 160, null, 3)).toBe(false);   // kapanışta da yazmaz
    expect(veri().slots[0]!.code).toBe('C0-a');
  });
  it('banka iki sekmeden aynı anda değişince ikisinin farkı da kalır', async () => {
    const a = await sekme(); await gir(a, 0);
    const b = await sekme(); await gir(b, 1);
    expect(await a.bankaYaz({ tl: 600, esya: { simit: 2 } })).toBe(true);           // +100
    expect(await b.bankaYaz({ tl: 550, esya: { simit: 1, cay: 3 } })).toBe(true);   // +50, -1 simit, +3 çay
    expect(veri().banka).toEqual({ tl: 650, esya: { simit: 1, cay: 3 } });
    expect(veri().slots[0]!.code).toBe('C0'); expect(veri().slots[1]!.code).toBe('C1');
  });
  it('kendi kapanış (keepalive) yazımı sonraki yazımda çakışma sayılmaz, banka iki kez eklenmez', async () => {
    const t = await sekme(); await gir(t, 0);
    expect(await t.bankaYaz({ tl: 700, esya: { simit: 2 } })).toBe(true);
    expect(t.bulutKapanisYaz('C0-k', 150, { ad: 'bir' }, 3)).toBe(true);   // sekme gizlendi, cevabı görülmedi
    expect(veri().slots[0]!.code).toBe('C0-k');
    expect(await t.bulutYaz('C0-n', 170, { ad: 'bir' }, 3)).toBe(true);
    expect(t.kayitKilidi()).toBeNull();
    expect(veri().slots[0]!.code).toBe('C0-n'); expect(veri().banka.tl).toBe(700);
  });
  it('yazım ile okuma arasında araya giren cihaz: yeniden okunur, yine ezilmez', async () => {
    const t = await sekme(); await gir(t, 0);
    srv.araGir = () => { const v = veri(); v.rev = 41; v.slots[0] = sl('C0-telefon', 'bir', 999); };
    expect(await t.bulutYaz('C0-pc', 120, { ad: 'bir' }, 3)).toBe(false);
    expect(t.kayitKilidi()).toBe('cakisma');
    expect(veri().slots[0]!.code).toBe('C0-telefon');
  });
  it('rev alanı olmayan eski kayıt da kilitle yazılır', async () => {
    const t = await sekme(); await gir(t, 0);
    expect(veri().rev).toBeUndefined();
    expect(await t.bulutYaz('C0-x', 150, { ad: 'bir' }, 3)).toBe(true);
    expect(veri().rev).toBe(1); expect(veri().slots[1]!.code).toBe('C1');
  });
});

describe('yerel yedek (sev4: çevrimdışı kapanış ilerlemeyi silmesin)', () => {
  it('buluttaki kayıttan büyüyen yerel kopya girişte geri gelir', async () => {
    const t = await sekme(); await gir(t, 0);
    t.yerelYedekYaz('C0-off', 400, 1);   // çevrimdışı oynadı, kapattı
    const t2 = await sekme(); const c = await gir(t2, 0);
    expect(t2.yerelYedekOku(c)).toMatchObject({ code: 'C0-off', playT: 400, taban: 'C0' });
  });
  it('bulut o arada başka yerde ilerlediyse eski yerel kopya kullanılmaz ve silinir', async () => {
    const t = await sekme(); await gir(t, 0);
    t.yerelYedekYaz('C0-off', 400, 1);
    veri().slots[0] = sl('C0-telefon', 'bir', 300); veri().rev = 5;
    const t2 = await sekme(); const c = await gir(t2, 0);
    expect(t2.yerelYedekOku(c)).toBeNull();
    expect([...store.keys()].some(k => k.startsWith('martikoy-yedek:'))).toBe(false);
  });
  it('bulut zaten aynı kodu taşıyorsa yedek gerekmez', async () => {
    const t = await sekme(); await gir(t, 0);
    t.yerelYedekYaz('C0', 100, 1);
    const t2 = await sekme(); const c = await gir(t2, 0);
    expect(t2.yerelYedekOku(c)).toBeNull();
  });
  it('yedek hesap ve yuvaya özeldir; karakter silinince yedeği de gider', async () => {
    const t = await sekme(); await gir(t, 1);
    t.yerelYedekYaz('C1-off', 500, 1);
    const t2 = await sekme(); const c0 = await gir(t2, 0);
    expect(t2.yerelYedekOku(c0)).toBeNull();
    expect(await t2.slotSil(1)).toBe(true);
    expect(store.has('martikoy-yedek:u1:1')).toBe(false);
  });
});
