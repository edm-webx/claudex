// SES ANA KURALI: yalnız bulunulan bölge/iç mekân katmanları açık; geçişte gain rampası, sonra bırakma; tavan.
import { describe, it, expect } from 'vitest';
import { createAtmosphere, createVoiceCap, DEFAULT_TABLE, type AtmoHost, type LayerDef } from '../../../src/engine/audio/atmosphere';

function fake() {
  const gains = new Map<string, number>(), started: string[] = [], stopped: string[] = [], released: string[] = [], shots: string[] = [];
  const host: AtmoHost = {
    start(d: LayerDef) { started.push(d.id); return { setGain: g => gains.set(d.id, g), stop: () => { stopped.push(d.id); } }; },
    shoot(_d, s) { shots.push(s.id); },
    release: d => released.push(d.id),
  };
  return { host, gains, started, stopped, released, shots };
}
const CTX = { phase: 'noon', weather: 'acik' };

describe('bölge kapısı', () => {
  it('iskelede yalnız deniz + ızgara; orman/stadyum katmanı kurulmaz', () => {
    const f = fake(), a = createAtmosphere(f.host);
    a.setZone('iskele'); a.tick(0, CTX);
    expect(a.active()).toEqual(['deniz', 'izgara']);
    expect(f.started.sort()).toEqual(['deniz', 'izgara']);
  });
  it('ormana geçince deniz kısılır (gain 0), 1.5 rampa sonrası bırakılır; yalnız orman aktif', () => {
    const f = fake(), a = createAtmosphere(f.host, { fadeS: 1.6 });
    a.setZone('iskele'); a.tick(0, CTX);
    a.setZone('orman'); a.tick(100, CTX);
    expect(a.active()).toEqual(['ruzgar']);
    expect(f.gains.get('deniz')).toBe(0);
    expect(a.live()).toContain('deniz');             // rampa sürerken hâlâ kurulu (crossfade)
    a.tick(100 + 1000, CTX); expect(f.stopped).not.toContain('deniz');
    a.tick(100 + 3000, CTX);
    expect(f.stopped.sort()).toEqual(['deniz', 'izgara']); expect(f.released).toContain('deniz');
    expect(a.live()).toEqual(['ruzgar']);
  });
  it('iç mekâna girince dış deniz/martı kesilir ve atım yok; çıkınca geri gelir', () => {
    const f = fake(), a = createAtmosphere(f.host, { rand: undefined } as never);
    a.setZone('iskele'); a.tick(0, CTX);
    a.setInterior('restoran'); a.tick(10, CTX);
    expect(a.active()).toEqual([]); expect(a.scope()).toBe('ic'); expect(a.outdoor()).toBe(0);
    f.shots.length = 0;
    for (let t = 10; t < 400000; t += 250) a.tick(t, CTX, () => 0.5);
    expect(f.shots).toEqual([]); expect(a.live()).toEqual([]);
    a.setInterior(null); a.tick(400100, CTX);
    expect(a.active()).toEqual(['deniz', 'izgara']);
  });
  it('tablo değişince mutfak/restoran/kafe katmanları yalnız o iç mekânda', () => {
    const f = fake(), a = createAtmosphere(f.host, { table: { ...DEFAULT_TABLE, mutfak: [{ id: 'mutfakOda', loop: 'izgara', gain: 0.3 }], kafe: [{ id: 'kafeOda', loop: 'deniz', gain: 0.2 }] } });
    a.setZone('iskele'); a.setInterior('mutfak'); a.tick(0, CTX);
    expect(a.active()).toEqual(['mutfakOda']);
    a.setInterior('kafe'); a.tick(50, CTX); expect(a.active()).toEqual(['kafeOda']);
    a.tick(50 + 3000, CTX); expect(a.live()).toEqual(['kafeOda']);
  });
  it('atımlar yalnız aktif katmandan ve gündüz/gece koşuluna göre', () => {
    const f = fake(), a = createAtmosphere(f.host);
    a.setZone('orman'); a.tick(0, CTX);
    for (let t = 250; t < 120000; t += 250) a.tick(t, CTX, () => 0.5);
    expect(f.shots.length).toBeGreaterThan(5);
    expect(f.shots).not.toContain('gull'); expect(f.shots).not.toContain('crowdCheer');
    expect(f.shots).not.toContain('seasonCall');      // gece atımı gündüz çalmaz
  });
  it('dispose hepsini bırakır', () => {
    const f = fake(), a = createAtmosphere(f.host); a.setZone('iskele'); a.tick(0, CTX); a.dispose();
    expect(a.live()).toEqual([]); expect(f.stopped.length).toBe(2);
  });
});

describe('eşzamanlı ses tavanı', () => {
  it('dolunca düşük öncelikli reddedilir, yüksek öncelikli yerini alır, süre bitince yer açılır', () => {
    const c = createVoiceCap(3);
    expect([1, 2, 3].map(() => c.take(0, 1000, 0))).toEqual([true, true, true]);
    expect(c.take(10, 1000, 0)).toBe(false);
    expect(c.take(10, 1000, 2)).toBe(true); expect(c.count(10)).toBe(3);
    expect(c.take(2000, 1000, 0)).toBe(true);
  });
});
