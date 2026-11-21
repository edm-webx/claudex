// Karakter Atölyesi: body rules, body-aware random, old-save compatibility, 3D hair kit sanity.
import { it, expect, describe } from 'vitest';
import { applyEsnafim, esnafHeroOpts, esnafimSave, ESNAFIM_DEFAULT, type EsnafimSave } from '../../src/game/sim/esnafim';
import { SAC, SAKAL, BIYIK, UST, ALT, rastgeleGorunum, bedenSec } from '../../src/content/karakter-katalog';
import { hairKit, beardKit, mustacheKit, KIT_HAIR, KIT_BEARD, KIT_MUSTACHE, kitTris } from '../../src/game/view/chars/v2/sac-kit';

const fresh = (): EsnafimSave => ({ ...ESNAFIM_DEFAULT });
function rng(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

describe('beden kuralları', () => {
  it('kadın bedende sakal ve bıyık kalmaz, sonradan da eklenemez', () => {
    const z = fresh(); applyEsnafim(z, { sakalStil: 'tam', biyik: 'kalin' }); expect(z.sakalStil).toBe('tam');
    applyEsnafim(z, { tip: 'b' }); expect(z.sakalStil).toBe('yok'); expect(z.biyik).toBe('yok');
    applyEsnafim(z, { sakalStil: 'uzun', biyik: 'pos' }); expect(z.sakalStil).toBe('yok'); expect(z.biyik).toBe('yok');
    const o = esnafHeroOpts({ ...z, sakalStil: 'tam', biyik: 'kalin' } as EsnafimSave) as { look: Record<string, unknown> };
    expect(o.look.beard).toBe(false); expect(o.look.mustache).toBe(false);   // even a tampered record draws no beard
  });
  it('erkek bedende elbise/etek kalmaz', () => {
    const z = fresh(); applyEsnafim(z, { tip: 'b', ustStil: 'dress', altStil: 'skirt' }); expect(z.ustStil).toBe('dress');
    applyEsnafim(z, { tip: 'a' }); expect(z.ustStil).toBe('tee'); expect(z.altStil).toBe('pants');
  });
  it('yeni alanlar doğrulanır', () => {
    const z = fresh();
    applyEsnafim(z, { far: '#7d3c98', eyeliner: 'kanat', kirpik: true, ben: 'yanak', yas: 'yasli', kol: 'rolled', yelek: '#2b2b33', kolye: true, sakalRenk: '#c9c5bf', allikRenk: '#f08a9a' });
    expect(z).toMatchObject({ far: '#7d3c98', eyeliner: 'kanat', kirpik: true, ben: 'yanak', yas: 'yasli', kol: 'rolled', yelek: '#2b2b33', kolye: true, sakalRenk: '#c9c5bf', allikRenk: '#f08a9a' });
    applyEsnafim(z, { far: 'javascript:1', eyeliner: 'x', ben: '<b>', yas: 99, sakalRenk: 'red' });
    expect(z.far).toBe('#7d3c98'); expect(z.eyeliner).toBe('kanat'); expect(z.ben).toBe('yanak'); expect(z.yas).toBe('yasli'); expect(z.sakalRenk).toBe('#c9c5bf');
  });
});

describe('rastgele bedene saygılı', () => {
  it('500 kadın rastgelesinde hiç sakal, bıyık; 500 erkekte hiç elbise/etek yok', () => {
    const r = rng(7);
    for (let i = 0; i < 500; i++) {
      const b = rastgeleGorunum('b', r); expect(b.sakalStil).toBe('yok'); expect(b.biyik).toBe('yok');
      expect(bedenSec(SAC, 'b').some(s => s.id === b.sac)).toBe(true);
      const a = rastgeleGorunum('a', r); expect(a.ustStil).not.toBe('dress'); expect(a.altStil).not.toBe('skirt'); expect(a.ruj).toBeNull();
      expect(bedenSec(SAC, 'a').some(s => s.id === a.sac)).toBe(true);
      const z = fresh(); applyEsnafim(z, a); expect(z.tip).toBe('a');
    }
  });
});

describe('eski kayıt uyumu', () => {
  it('v1 kaydı (yeni alanlar yok) açılır ve aynı görünür', () => {
    const old: Record<string, unknown> = { ad: 'Kemal', dukkan: 'Kemal Büfe', sinif: 'balikci', done: true, tip: 'a', vucut: 'round', boy: 1, ten: 5, goz: 'oval', gozRenk: '#3a2416', kas: 'thick', allik: 0.2, cil: false, gamze: false, ruj: null, sac: 'curly', sacRenk: '#3b281c', biyik: 'kalin', sakal: true, ustStil: 'jacket', ust: '#f2c230', aksan: '#2f6f9a', desen: 0, altStil: 'pants', alt: '#2f6f9a', ayakkabi: '#7a5236', onluk: null, sapka: 'bucket', sapkaRenk: '#f2c230', gozluk: null, papyon: null, kravat: null, kupe: false };
    const S = { zones: { esnafim: old } } as never;
    const z = esnafimSave(S);
    expect(z.adKilit).toBe(true); expect(z.ad).toBe('Kemal');
    const o = esnafHeroOpts(z) as { look: Record<string, unknown> };
    expect(o.look.hair).toBe('curly'); expect(o.look.beard).toBe('tam'); expect(o.look.mustache).toBe('kalin'); expect(o.look.hat).toBe('bucket');
    expect(o.look.age).toBeUndefined(); expect(o.look.vest).toBeNull();
  });
  it('eski sakal kimlikleri (keci, cember, kisa, favori) yeni kitte karşılığını bulur', () => {
    for (const s of ['keci', 'cember', 'kisa', 'favori', 'tam']) { const o = esnafHeroOpts({ ...fresh(), sakalStil: s as never }) as { look: { beard: string } }; expect(beardKit(o.look.beard, 0.195)).not.toBeNull(); }
  });
});

describe('3D saç kiti', () => {
  const finite = (g: { attributes: { position: { array: ArrayLike<number> } } }) => Array.from(g.attributes.position.array).every(Number.isFinite);
  it('katalogdaki her saç / sakal / bıyık kitte var', () => {
    for (const s of SAC) expect(KIT_HAIR).toContain(s.id);
    for (const s of SAKAL) if (s.id !== 'yok' && s.id !== 'kirli') expect(KIT_BEARD).toContain(s.id);
    for (const s of BIYIK) if (s.id !== 'yok') expect(KIT_MUSTACHE).toContain(s.id);
  });
  it('geometriler sonlu, üçgen bütçesi içinde (kahraman ≤ 5.5k, NPC ≤ 2.2k)', () => {
    for (const id of KIT_HAIR) for (const hat of [false, true]) {
      const hi = hairKit(id, 0.195, { hat })!, lo = hairKit(id, 0.195, { hat, lod: 1 })!;
      for (const p of [...hi, ...lo]) { expect(finite(p.g as never)).toBe(true); if (p.sh) expect(p.sh.length).toBe(p.g.attributes.position.count); }
      expect(kitTris(hi)).toBeLessThan(5500); expect(kitTris(lo)).toBeLessThan(2200);
    }
    for (const id of KIT_BEARD) expect(kitTris(beardKit(id, 0.195)!)).toBeLessThan(2500);
    for (const id of KIT_MUSTACHE) expect(kitTris(mustacheKit(id, 0.195)!)).toBeLessThan(700);
  });
  it('katalog: elbise ve etek yalnız kadın bedeninde', () => {
    expect(bedenSec(UST, 'a').some(s => s.id === 'dress')).toBe(false);
    expect(bedenSec(ALT, 'a').some(s => s.id === 'skirt')).toBe(false);
  });
});
