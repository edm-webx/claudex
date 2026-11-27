import { describe, it, expect } from 'vitest';
import { EGITICI, EGT_ZAMAN as Z, egtAra, type EgtCtx } from '../../src/content/egitici';
import { egtSec, egtGoruldu, egtSifirla, egtEskiKayit, egtGorulenler } from '../../src/game/egitici-karar';

const ctx = (o: Partial<EgtCtx> & { v?: any; S?: any } = {}): EgtCtx => ({
  v: { kasaPile: 0, pads: [], carry: [], cap: 2, queue: [], tablePiles: [], workers: [], anchors: { kasa: { x: 1, z: 2 } }, ...(o.v || {}) },
  S: { owned: {}, playT: 400, level: 1, day: 1, stage: 1, zones: {}, tut: {}, ...(o.S || {}) },
  rt: {}, pos: { x: 0, z: 0 }, saat: 12, ic: null, bolge: null, yagmur: false, cokOyunculu: false, hud: () => false, ...o,
} as EgtCtx);

describe('eğitici kartları', () => {
  it('kimlikler tekil, vapur yok, ölü kapkaççı kartı yok', () => {
    const ids = EGITICI.map(k => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('kapkac');
    for (const k of EGITICI) {
      const t = JSON.stringify([k.baslik, typeof k.metin === 'string' ? k.metin : '', ...(k.devam || []).map(d => [d.baslik, typeof d.metin === 'string' ? d.metin : ''])]).toLocaleLowerCase('tr');
      expect(t).not.toContain('vapur');
    }
  });
  it('temel oklar bitmeden kart çıkmaz', () => {
    const c = ctx({ v: { pads: [{ key: 'cay', pos: { x: 3, z: 3 } }] } });
    expect(egtSec(c, {}, 30)).toBeNull();
    expect(egtSec(c, { firstDrop: 1 }, 30)?.id).toBe('sari_kare');
  });
  it('bir kez gösterilir; ilk 10 dk 90 sn, sonra 45 sn ara', () => {
    expect(egtAra(100)).toBe(Z.ARA_ILK_S);
    expect(egtAra(Z.ILK_DK_S + 1)).toBe(Z.ARA_S);
    const tut: Record<string, number> = { firstDrop: 1, firstCollect: 1 };
    const c = ctx({ v: { kasaPile: 3, pads: [{ key: 'cay', pos: { x: 3, z: 3 } }] }, S: { tut } });
    expect(egtSec(c, tut, 400)?.id).toBe('sari_kare');
    egtGoruldu(tut, 'sari_kare', 400);
    expect(egtSec(c, tut, 400 + Z.ARA_ILK_S - 1)).toBeNull();
    expect(egtSec(c, tut, 400 + Z.ARA_ILK_S + 1)?.id).toBe('kasa');
    const t2: Record<string, number> = { firstDrop: 1, firstCollect: 1 };
    egtGoruldu(t2, 'sari_kare', 1000);
    expect(egtSec(c, t2, 1000 + Z.ARA_S - 1)).toBeNull();
    expect(egtSec(c, t2, 1000 + Z.ARA_S + 1)?.id).toBe('kasa');
  });
  it('kasa kartı para okunun (ilk toplama) bitmesini bekler', () => {
    const c = ctx({ v: { kasaPile: 3 } }), c2 = ctx({ v: { kasaPile: 3 }, S: { tut: { firstCollect: 1 } } });
    expect(egtSec(c, { firstDrop: 1 }, 500)).toBeNull();
    expect(egtSec(c2, { firstDrop: 1, firstCollect: 1 }, 500)?.id).toBe('kasa');
  });
  it("'yan' kartlar daha uzun ara ister", () => {
    const tut: Record<string, number> = { firstDrop: 1 };
    const c = ctx({ yagmur: true, S: { playT: 100 } });
    egtGoruldu(tut, 'kasa', 1000);
    expect(egtSec(c, tut, 1000 + Z.ARA_S + 1)).toBeNull();
    expect(egtSec(c, tut, 1000 + Z.YAN_ARA_S + 1)?.id).toBe('yagmur');
  });
  it('geçici olay kartı koşul bir an doğru olduysa BEK_S sn beklemede kalır, kalıcı kartları geçer', () => {
    const tut: Record<string, number> = { firstDrop: 1 };
    egtGoruldu(tut, 'kasa', 1000);
    const kuyruk = ctx({ v: { queue: [{ pat: 0.2 }], carry: [{}] }, S: { playT: 1010, level: 2, day: 2 } });
    expect(egtSec(kuyruk, tut, 1010)).toBeNull();   // ara dolmadı ama olay görüldü
    const sakin = ctx({ v: { queue: [], carry: [] }, S: { playT: 1050, level: 2, day: 2 } });
    expect(egtSec(sakin, tut, 1050)?.id).toBe('sabirsiz');   // ara doldu, olay az önceydi: seviye kartının önünde
    const t2: Record<string, number> = { firstDrop: 1 };
    egtGoruldu(t2, 'kasa', 1000);
    egtSec(kuyruk, t2, 1010);
    expect(egtSec(sakin, t2, 1010 + Z.BEK_S + 5)?.id).not.toBe('sabirsiz');   // süre doldu
  });
  it('uygun değilse (hedef/HUD öğesi yok) kart seçilmez, görüldü de yazılmaz', () => {
    const tut: Record<string, number> = { firstDrop: 1, firstCollect: 1 };
    const c = ctx({ v: { pads: [{ key: 'cay', pos: { x: 3, z: 3 } }] } });
    expect(egtSec(c, tut, 500, () => false)).toBeNull();
    expect(Object.keys(tut).some(k => k.startsWith('egt_'))).toBe(false);
    expect(egtSec(c, tut, 500, () => true)?.id).toBe('sari_kare');
  });
  it('büfenin dış alanını anlatan kartlar iç mekândayken çıkmaz', () => {
    const tut: Record<string, number> = { firstDrop: 1, firstCollect: 1 };
    const ic = { tur: 'kafe', id: 'k1' } as never;
    const c = ctx({ ic, v: { pads: [{ key: 'cay', pos: { x: 3, z: 3 } }] } });
    expect(egtSec(c, tut, 500)?.id).not.toBe('sari_kare');   // yalnız iç mekân kartı (kafe_ic) çıkabilir
  });
  it('arayüz turu oyuncu boştayken çıkar, 420. sn\'de her koşulda; eski hedefler/telefon kartı görüldüyse tekrar etmez', () => {
    const tut: Record<string, number> = { firstDrop: 1 };
    const mesgul = ctx({ hud: () => true, v: { carry: [{}] }, S: { playT: 300 } });
    const bos = ctx({ hud: () => true, S: { playT: 300 } });
    expect(egtSec(mesgul, tut, 300)).toBeNull();
    expect(egtSec(bos, tut, 300)?.id).toBe('arayuz');
    expect(egtSec(ctx({ hud: () => true, v: { carry: [{}] }, S: { playT: 430 } }), tut, 430)?.id).toBe('arayuz');
    expect(EGITICI.find(k => k.id === 'arayuz')?.devam?.length).toBe(1);
    expect(egtSec(bos, { firstDrop: 1, egt_hedefler: 100 }, 300)).toBeNull();
  });
  it('gece kartı akşam 20-24 arası, gündüz ya da sabaha karşı değil', () => {
    const g = EGITICI.find(k => k.id === 'gece')!;
    expect(g.kosul(ctx({ saat: 21 }))).toBe(true);
    expect(g.kosul(ctx({ saat: 12 }))).toBe(false);
    expect(g.kosul(ctx({ saat: 26 }))).toBe(false);
    expect(g.onem).toBeUndefined();
  });
  it('kapalıyken hiç kart yok; baştan göster görülenleri siler', () => {
    const tut: Record<string, number> = { firstDrop: 1, firstCollect: 1, egt__kapali: 1 };
    expect(egtSec(ctx({ v: { kasaPile: 1 } }), tut, 500)).toBeNull();
    delete tut.egt__kapali; egtGoruldu(tut, 'kasa', 500); tut.egb_sabirsiz = 5;
    expect(egtGorulenler(tut).map(k => k.id)).toEqual(['kasa']);
    egtSifirla(tut);
    expect(egtGorulenler(tut)).toEqual([]);
    expect(tut.egb_sabirsiz).toBeUndefined();
    expect(tut.firstDrop).toBe(1);
  });
  it('eski kayıtta bilinen şeyler görülmüş sayılır (koşulu o an tutmayanlar da)', () => {
    const tut: Record<string, number> = { firstDrop: 1, firstCollect: 1 };
    const c = ctx({ S: { owned: { cay: 1, tabure1: 1, isbul: 1, tepsi1: 1 }, level: 4, day: 6, stage: 3, workers: [{}], tut } });
    egtEskiKayit(c, tut, 5000);
    for (const id of ['kasa', 'cay', 'masa', 'pano', 'tasima', 'tadilat_kare', 'karne', 'ilk_isci', 'seviye', 'ust_gecit', 'sabirsiz', 'kedi']) expect(tut['egt_' + id], id).toBeTruthy();
    expect(egtSec(c, tut, 5000)).toBeNull();
  });
  it('arsa alınınca kart arsanın ortasını gösterir (60 m menzil), iki sayfa', () => {
    const c = ctx({ S: { zones: { arsa: { plots: { a1: { tur: null } } } } } });
    const k = EGITICI.find(x => x.id === 'arsa_alindi')!;
    expect(k.kosul(c)).toBe(true);
    const h = k.hedef!(c)!;
    expect(Math.abs(h.x - 259.5)).toBeLessThan(5);
    expect(k.menzil).toBe(60);
    expect(k.devam?.length).toBe(1);
  });
  it("dükkân kare kartı 'isl.k1' / 'avm.k7' anahtarlarını arsa kimliğine çevirir, alınmışsa çıkmaz", () => {
    const k = EGITICI.find(x => x.id === 'dukkan_kare')!;
    for (const [key, id] of [['isl.k1', 'k1'], ['avm.k7', 'k7']] as const) {
      const c = ctx({ S: { tut: { ['acGor_' + key]: 1 } } });
      expect(k.kosul(c)).toBe(true);
      const h = k.hedef!(c);
      expect(h && isFinite(h.x) && isFinite(h.z), id).toBe(true);
    }
    expect(k.kosul(ctx({ S: { tut: { 'acGor_isl.k1': 1 }, zones: { arsa: { plots: { k1: { tur: null } } } } } }))).toBe(false);
  });
  it('masa ve tadilat kartlarının metni gerçek davranışı söyler', () => {
    const m = EGITICI.find(k => k.id === 'masa')!.metin as string, t = EGITICI.find(k => k.id === 'tadilat_kare')!.metin as string;
    expect(m).toContain('kumbara'); expect(m).not.toMatch(/masaya bahşiş/);
    expect(t).toContain('bir saniye'); expect(t).toContain('Büfem > Tadilat'); expect(t).not.toContain('panel');
  });
});
