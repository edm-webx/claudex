import { describe, it, expect } from 'vitest';
import { EGITICI, EGT_ZAMAN as Z, type EgtCtx } from '../../src/content/egitici';
import { egtSec, egtGoruldu, egtSifirla, egtEskiKayit, egtGorulenler } from '../../src/game/egitici-karar';

const ctx = (o: Partial<EgtCtx> & { v?: any; S?: any } = {}): EgtCtx => ({
  v: { kasaPile: 0, pads: [], carry: [], cap: 2, queue: [], tablePiles: [], workers: [], anchors: { kasa: { x: 1, z: 2 } }, ...(o.v || {}) },
  S: { owned: {}, playT: 400, level: 1, day: 1, stage: 1, zones: {}, tut: {}, ...(o.S || {}) },
  rt: {}, pos: { x: 0, z: 0 }, saat: 12, ic: null, bolge: null, yagmur: false, cokOyunculu: false, hud: () => false, ...o,
} as EgtCtx);

describe('eğitici kartları', () => {
  it('kimlikler tekil, vapur yok', () => {
    const ids = EGITICI.map(k => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const k of EGITICI) expect(JSON.stringify([k.baslik, typeof k.metin === 'string' ? k.metin : '']).toLocaleLowerCase('tr')).not.toContain('vapur');
  });
  it('temel oklar bitmeden kart çıkmaz', () => {
    const c = ctx({ v: { kasaPile: 3 } });
    expect(egtSec(c, {}, 30)).toBeNull();
    expect(egtSec(c, { firstDrop: 1 }, 30)?.id).toBe('kasa');
  });
  it('bir kez gösterilir ve kartlar arası bekleme var', () => {
    const tut: Record<string, number> = { firstDrop: 1 };
    const c = ctx({ v: { kasaPile: 3, pads: [{ key: 'cay', pos: { x: 3, z: 3 } }] } });
    expect(egtSec(c, tut, 400)?.id).toBe('kasa');
    egtGoruldu(tut, 'kasa', 400);
    expect(egtSec(c, tut, 400 + Z.ARA_S - 1)).toBeNull();
    expect(egtSec(c, tut, 400 + Z.ARA_S + 1)?.id).toBe('sari_kare');
  });
  it("'yan' kartlar daha uzun ara ister", () => {
    const tut: Record<string, number> = { firstDrop: 1 };
    const c = ctx({ yagmur: true, S: { playT: 100 } });
    egtGoruldu(tut, 'kasa', 1000);
    expect(egtSec(c, tut, 1000 + Z.ARA_S + 1)).toBeNull();
    expect(egtSec(c, tut, 1000 + Z.YAN_ARA_S + 1)?.id).toBe('yagmur');
  });
  it('kapalıyken hiç kart yok; baştan göster görülenleri siler', () => {
    const tut: Record<string, number> = { firstDrop: 1, egt__kapali: 1 };
    expect(egtSec(ctx({ v: { kasaPile: 1 } }), tut, 500)).toBeNull();
    delete tut.egt__kapali; egtGoruldu(tut, 'kasa', 500);
    expect(egtGorulenler(tut).map(k => k.id)).toEqual(['kasa']);
    egtSifirla(tut);
    expect(egtGorulenler(tut)).toEqual([]);
    expect(tut.firstDrop).toBe(1);
  });
  it('eski kayıtta bilinen şeyler görülmüş sayılır', () => {
    const tut: Record<string, number> = { firstDrop: 1 };
    const c = ctx({ v: { kasaPile: 2 }, S: { owned: { cay: 1, tabure1: 1 }, level: 4 } });
    egtEskiKayit(c, tut, 5000);
    expect(tut.egt_kasa && tut.egt_cay && tut.egt_masa && tut.egt_seviye && tut.egt_ust_gecit).toBeTruthy();
    expect(egtSec(c, tut, 5000)).toBeNull();
  });
  it('arsa alınınca kart arsanın kapısını gösterir, iki sayfa', () => {
    const c = ctx({ S: { zones: { arsa: { plots: { a1: { tur: null } } } } } });
    const k = EGITICI.find(x => x.id === 'arsa_alindi')!;
    expect(k.kosul(c)).toBe(true);
    const h = k.hedef!(c)!;
    expect(Math.abs(h.x - 259.5)).toBeLessThan(5);
    expect(k.devam?.length).toBe(1);
  });
});
