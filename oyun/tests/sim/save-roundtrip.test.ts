// KAL-02: yükle-geri turu. Dolu bir v2 kaydı motor deposundan geçer, yeni sim'de açılır, her sistemin alanı eşit kalır.
// Ayrıca bozuk veri tablosu: onarılır, oyun 60 sn adım atıp çökmez; yeni sürüm kaydı salt-okunur korunur.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createGameSave, normalizeState } from '../../src/game/sim/save';
import { createSave } from '../../src/engine/save';
import { SAVE_VERSION, defaultState, type GameState } from '../../src/game/sim/schema';
import { normalizeZones } from '../../src/game/sim/zones-norm';
import { fakePlatform, log, mkSim } from './m1-helpers';

const fx = (n: string) => JSON.parse(readFileSync(new URL('../fixtures/saves/' + n, import.meta.url), 'utf8')) as GameState;
const jz = (s: GameState) => JSON.stringify(s.zones);

describe('save-roundtrip (KAL-02)', () => {
  it('SAVE_VERSION 2 ve v2 fixture kaydedilip yüklenince tüm zones eşit', async () => {
    expect(SAVE_VERSION).toBe(2);
    const sim = mkSim(7, fx('v2-dolu.json'));
    const once = jz(sim.state);
    const fp = fakePlatform();
    expect(await createGameSave(sim, fp.platform, { log }).save('manual')).toBe(true);
    const back = await createGameSave(mkSim(7), fp.platform, { log }).load();
    expect(back.from).not.toBe('fresh');
    expect(back.data.version).toBe(2);
    expect(jz(back.data)).toBe(once);
    expect(back.data.money).toBeCloseTo(98765.5, 3);
  });

  // 12 sistem: kafe, kredi, okul, AVM, salon, banka yedeği, kırtasiye, tabela, kıyafet, yatırım, lig, halı saha, ...
  const kontrol: [string, (z: Record<string, any>) => unknown, unknown][] = [
    ['kafe seviye', z => z.arsa.plots.k1.lv, 3], ['kafe işçi', z => z.arsa.plots.k1.isci, 2], ['kafe tema', z => z.arsa.plots.k1.tema, 'sahil'],
    ['kafe eşya', z => z.arsa.plots.k1.esya, ['kasa', 'isik']], ['kafe kasa kesri', z => z.arsa.plots.k1.till, 1234.5],
    ['kredi borcu', z => z.arsa.kredi.borc, 2500.75], ['kredi günü', z => z.arsa.kredi.gun, 12],
    ['okul sınavları', z => z.okul.sinavlar, [80, 60, 100]], ['AVM alınanlar', z => z.avm.alinan, ['gomlek1', 'ruj2']],
    ['salon eşyaları', z => z.salon.esya, ['koltuk', 'tv']], ['banka yedeği', z => z.arsa.yedek, { tl: 5000, esya: { tahta: 2 } }],
    ['kırtasiye sayaçları', z => [z.arsa.plots.k3.sat, z.arsa.plots.k3.till], [41, 310]], ['tabela', z => z.tabela, { tier: 2, renk: '#ff8a00' }],
    ['kıyafet', z => z.kiyafet.worn, { ust: 'lc_gomlek_mavi' }], ['yatırım', z => z.yatirim, { a: 2, b: 5 }],
    ['lig', z => [z.lig.fin, z.lig.bolum.martisk, z.lig.maclar.length], [2, 2, 1]], ['halı saha', z => z.halisaha.form, ['G', 'B', 'M', 'G', 'G']],
    ['stadyum (bilinmeyen anahtar korunur)', z => z.arsa.stad.formasyon, '1-2-1'],
  ];
  for (const [ad, oku, bek] of kontrol) {
    it('tur: ' + ad, async () => {
      const sim = mkSim(7, fx('v2-dolu.json'));
      const fp = fakePlatform();
      await createGameSave(sim, fp.platform, { log }).save('manual');
      const back = await createGameSave(mkSim(7), fp.platform, { log }).load();
      expect(oku(back.data.zones as never)).toEqual(bek);
    });
  }

  it('bozuk değer tablosu onarılır ve sim 60 sn çökmeden adım atar', () => {
    const d = fx('v2-dolu.json') as any;
    d.zones.arsa.plots.k1.lv = 'x9'; d.zones.arsa.plots.k1.isci = 99; d.zones.arsa.plots.k1.till = null; d.zones.arsa.plots.k1.esya = 'kasa';
    d.zones.arsa.plots.e1 = 'bozuk'; d.zones.arsa.kredi = { borc: -50, gun: NaN }; d.zones.arsa.lastH = 'sabah';
    d.zones.okul = { soru: 9999, secenek: [9999, -3, 'a'], cevap: -1, dogru: 'x', sinavlar: [250, -4, null], son: 7 };
    d.zones.avm = []; d.zones.salon = 'x'; d.zones.yatirim = { a: 99, b: -2, c: 'zz' }; d.zones.tabela = { tier: 1e9, renk: null };
    d.zones.kiyafet = { owned: { a: 1 }, worn: [] }; d.zones.gizem = null; d.zones.lig = { fin: Infinity, bolum: [], maclar: 5 };
    d.zones.mini = { best: { balik: -1 }, stars: { balik: 9 } }; d.zones.hava = 'gunesli';
    d.zones.halisaha = { played: -3, form: 'GGG' }; d.zones.envanter = { esya: { tahta: -1 }, sans: 'a' };
    d.zones.devasa = {}; d.zones.mantar = { taken: new Array(5000).fill('m') };
    const notes: string[] = [];
    normalizeState(d, notes);
    const z = d.zones;
    expect(z.arsa.plots.k1.lv).toBe(1); expect(z.arsa.plots.k1.isci).toBe(3); expect(z.arsa.plots.k1.till).toBe(0); expect(z.arsa.plots.k1.esya).toEqual([]);
    expect(z.arsa.plots.e1).toBeUndefined(); expect(z.arsa.kredi.borc).toBe(0); expect(z.arsa.kredi.gun).toBe(0);
    expect(z.okul.sinavlar).toEqual([100, 0, 0]); expect(z.okul.secenek.every((i: number) => i >= 0 && i < 400)).toBe(true);
    expect(z.avm).toBeUndefined(); expect(z.salon).toBeUndefined(); expect(z.gizem).toBeUndefined(); expect(z.hava).toBeUndefined();   // bozuk bölge atılır, tembel okuyucu varsayılanı kurar
    expect(z.yatirim).toEqual({ a: 5, b: 0, c: 0 }); expect(z.tabela.tier).toBe(20);
    expect(z.lig.fin).toBe(0); expect(z.halisaha.played).toBe(0); expect(z.mantar.taken.length).toBe(100);
    expect(notes.some(n => n.startsWith('zones.'))).toBe(true);
    const sim = mkSim(7, d as GameState);
    expect(() => sim.step(60)).not.toThrow();
    expect(Number.isFinite(sim.state.money)).toBe(true);
  });

  it('normalizeZones boş / eksik zones ile sorunsuz, bilinmeyen anahtarı korur', () => {
    const z: any = { arsa: { plots: {}, yeniAlan: 5 }, baskaKol: { x: 1 } };
    expect(normalizeZones(z)).toBe(0);
    expect(z.arsa.yeniAlan).toBe(5); expect(z.baskaKol).toEqual({ x: 1 });
    expect(normalizeZones({} as never)).toBe(0);
    const d: any = defaultState(1); d.zones = null; normalizeState(d); expect(d.zones).toEqual({});
  });

  it('yeni sürüm kaydı: salt-okunur, depo ezilmez', async () => {
    const fp = fakePlatform();
    const yeni = createSave<GameState>({ key: 'marti-bufe', version: SAVE_VERSION + 1, defaults: () => defaultState(1), migrations: [], validate: () => [], get: () => ({ ...defaultState(1), money: 777, version: SAVE_VERSION + 1 }), platform: fp.platform });
    expect(await yeni.save('manual')).toBe(true);
    const ham = JSON.stringify([...fp.db.entries()].sort());
    const sim = mkSim(1);
    const eski = createGameSave(sim, fp.platform, { log });
    const r = await eski.load();
    expect(r.newerVersion).toBe(SAVE_VERSION + 1);
    expect(eski.readOnly).toBe(true);
    expect(await eski.save('manual')).toBe(false);
    expect(JSON.stringify([...fp.db.entries()].sort())).toBe(ham);   // hiçbir şey yazılmadı
    await eski.wipe(); expect(eski.readOnly).toBe(false);            // sahibin bilinçli sıfırlaması kilidi açar
  });
});
