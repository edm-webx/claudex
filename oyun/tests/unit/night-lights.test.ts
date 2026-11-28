import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pickLamps, assignSlots, stepFade, PLAN_DT, icLambalar, floresanNoktasi, type FadeState } from '../../src/game/view/world/night-lights-plan';
import { createNightLights, roomLightsFor, LIGHT_TUNE } from '../../src/game/view/world/night-lights';
import { IC_BY_ID, IC_MEKANLAR, icIcinde } from '../../src/content/ic-mekan';
import { BUFE, bufeKutu } from '../../src/content/prefabs/iskele/layout';

const row = (n: number, step = 3) => Array.from({ length: n }, (_, i) => ({ x: i * step, z: 0 }));

describe('night-lights planner (PRF-08)', () => {
  it('pickLamps: en yakın n lamba, eşitlikte indeks sırası', () => {
    const L = row(12);
    expect(pickLamps(L, { x: 0, z: 0 }, 4)).toEqual([0, 1, 2, 3]);
    // focus at 4.5: lamps 1 (3) and 2 (6) are equally far -> lower index first
    expect(pickLamps(L, { x: 4.5, z: 0 }, 2)).toEqual([1, 2]);
  });

  it('histerezis: sınırdaki lamba titreşimle değişmez', () => {
    const L = row(12);
    const prev = pickLamps(L, { x: 4.4, z: 0 }, 4);          // 0..3 or 1..4 around the edge
    for (let k = 0; k < 20; k++) {
      const f = { x: 4.4 + (k % 2 ? 0.05 : -0.05), z: 0 };
      expect(new Set(pickLamps(L, f, 4, prev))).toEqual(new Set(prev));
    }
    // walking far enough releases the old lamp (rank >= n+2)
    const far = pickLamps(L, { x: 15, z: 0 }, 4, prev);
    expect(far).not.toContain(0);
  });

  it('assignSlots: tutulan lamba aynı ışıkta kalır', () => {
    expect(assignSlots([3, 7, 1, 9], [7, 3, 1, 4])).toEqual([3, 7, 1, 4]);
    expect(assignSlots([-1, -1], [5, 6])).toEqual([5, 6]);
  });

  it("dt'den bağımsız seçim: 30/60/144 Hz", () => {
    const L = row(12);
    const run = (hz: number) => {
      const dt = 1 / hz, out: string[] = []; let clock = 0, prev: number[] = [], plans = 0;
      for (let t = 0; t < 10 - 1e-9; t += dt) {
        clock += dt;
        while (clock >= PLAN_DT - 1e-9) { clock -= PLAN_DT; plans++; const f = { x: Math.min(30, plans * PLAN_DT * 3), z: 0 }; prev = pickLamps(L, f, 4, prev).slice(); out.push(prev.join(',')); }
      }
      return { out, plans };
    };
    const a = run(30), b = run(60), c = run(144);
    expect(Math.abs(a.plans - 25)).toBeLessThanOrEqual(1);
    const n = Math.min(a.out.length, b.out.length, c.out.length);
    expect(a.out.slice(0, n)).toEqual(b.out.slice(0, n));
    expect(b.out.slice(0, n)).toEqual(c.out.slice(0, n));
  });

  it('stepFade: sıçrama yok', () => {
    const s: FadeState = { cur: 1, want: 1, k: 1 };
    s.want = 2;
    let steps = 0;
    while (s.cur !== 2) { stepFade(s, 1 / 60); steps++; expect(s.k).toBeGreaterThanOrEqual(0); expect(s.k).toBeLessThanOrEqual(1); if (s.cur !== 2) expect(s.k).toBeGreaterThanOrEqual(0); }
    expect(s.k).toBe(0);                         // swapped only while dark
    expect(steps).toBeGreaterThanOrEqual(17); expect(steps).toBeLessThanOrEqual(19);
    const at = (dt: number) => { const q: FadeState = { cur: 1, want: 2, k: 1 }; for (let t = 0; t < 1 - 1e-9; t += dt) stepFade(q, dt); return q.k; };
    expect(Math.abs(at(1 / 30) - at(1 / 144))).toBeLessThanOrEqual(0.02);
  });

  it('icLambalar: oda ızgarası odanın içinde', () => {
    const k = IC_BY_ID.kafe1;
    const L = icLambalar(k);
    expect(L.length).toBe(6);
    for (const p of L) { expect(icIcinde(k, p, -0.1)).toBe(true); expect(p.y).toBeCloseTo(Math.min(3.2, k.h) - 0.8); }
    expect(icLambalar(IC_BY_ID.mutfak).length).toBe(5);
    for (const m of IC_MEKANLAR) for (const p of icLambalar(m)) expect(icIcinde(m, p, -0.1)).toBe(true);
  });

  it('floresanNoktasi: aşamaya göre büfe içinde', () => {
    expect(floresanNoktasi(1)).toEqual({ x: 0.2, y: 2.12, z: BUFE.z1 + 1.12 });
    for (let st = 2; st <= 10; st++) {
      const p = floresanNoktasi(st);
      const B = bufeKutu(st);   // stage 6+: the büfe is the restaurant's front hall against the kitchen
      expect(p).toEqual({ x: 0, y: 2.31, z: B.z0 + 0.3 });
      expect(p.x > B.x0 && p.x < B.x1 && p.z > B.z0 && p.z < B.z1 && p.y > 0).toBe(true);
    }
  });
});

describe('night-lights pool (PRF-08)', () => {
  const count = (s: T.Scene) => s.children.filter(o => o.name.startsWith('nightLight') && (o as T.PointLight).isPointLight).length;
  const mk = (name = 'akici') => { const scene = new T.Scene(); const nl = createNightLights({ scene, zones: null, tier: { name } }); return { scene, nl }; };

  it('ışık sayısı sabit, yalnız setTier değişir', () => {
    const { scene, nl } = mk('akici');
    expect(count(scene)).toBe(4);
    const kids = scene.children.length;
    const room = roomLightsFor('kafe1');
    for (let i = 0; i < 5000; i++) nl.update({ x: (i % 200) * 0.2, z: -5 }, [13, 22, 19.5, 23][i % 4], 1 / 60, i % 3 === 0 ? room : null);
    expect(count(scene)).toBe(4); expect(scene.children.length).toBe(kids);
    nl.setTier({ name: 'dengeli' }); expect(count(scene)).toBe(6);
    nl.setTier({ name: 'sahane' }); expect(count(scene)).toBe(10);
    expect(nl.stats().pool).toBe(10);
  });

  it('şiddet tablosu: şahane bugünküyle aynı, küçük havuz en fazla %25 fazla', () => {
    expect(LIGHT_TUNE.sahane).toMatchObject({ pool: 10, range: 12, lampI: 18, floI: 22 });
    expect(LIGHT_TUNE.dengeli.pool).toBe(6); expect(LIGHT_TUNE.akici.pool).toBe(4);
    for (const t of Object.values(LIGHT_TUNE)) { expect(t.lampI / 18).toBeLessThanOrEqual(1.25); expect(t.floI / 22).toBeLessThanOrEqual(1.25); }
  });

  it('gündüz hiçbir şey yanmaz, iç mekanda gündüz loş yanar', () => {
    const { scene, nl } = mk('dengeli');
    const L = () => scene.children.filter(o => o.name.startsWith('nightLight')) as T.PointLight[];
    for (let i = 0; i < 120; i++) nl.update({ x: 0, z: -8 }, 13, 1 / 60, null);
    expect(L().every(l => l.intensity === 0)).toBe(true);
    const room = roomLightsFor('kafe1')!;
    for (let i = 0; i < 120; i++) nl.update(IC_BY_ID.kafe1, 13, 1 / 60, room);
    const on = L().filter(l => l.intensity > 0);
    expect(on.length).toBe(4);                    // dengeli: 4 room + 2 outside (outside stays dark by day)
    for (const l of on) expect(l.intensity).toBeLessThanOrEqual(0.35 * LIGHT_TUNE.dengeli.lampI + 1e-6);
    expect(nl.stats().room).toBe('kafe1');
  });

  it('iç mekan yuvaları: akıcı 3 iç + 1 dış, dengeli 4 + 2', () => {
    for (const [name, inN] of [['akici', 3], ['dengeli', 4], ['sahane', 4]] as const) {
      const { scene, nl } = mk(name);
      for (const m of IC_MEKANLAR) {
        const room = roomLightsFor(m.id)!;
        for (let i = 0; i < 90; i++) nl.update(m, 22, 1 / 60, room);
        const lamps = room.lamps;
        const inRoom = (scene.children.filter(o => o.name.startsWith('nightLight')) as T.PointLight[])
          .filter(l => l.intensity > 0 && lamps.some(p => Math.abs(p.x - l.position.x) < 1e-6 && Math.abs(p.z - l.position.z) < 1e-6));
        expect(inRoom.length, `${name} ${m.id}`).toBe(Math.min(inN, lamps.length));
      }
    }
  });

  it('yürürken parlaklık sürekliliği (toplam şiddet kareden kareye ≤ %12)', () => {
    const { scene, nl } = mk('akici');
    const L = scene.children.filter(o => o.name.startsWith('nightLight')) as T.PointLight[];
    nl.addSource('test-row', () => row(12, 6).map(p => ({ x: p.x, y: 3, z: 30 })));
    let prevSum = -1, prevI = L.map(() => 0);
    for (let f = 0; f < 20 * 60; f++) {
      nl.update({ x: f / 60 * 3, z: 30 }, 23, 1 / 60, null);
      const sum = L.reduce((a, l) => a + l.intensity, 0);
      if (f > 60 && prevSum > 0) expect(Math.abs(sum - prevSum) / prevSum).toBeLessThanOrEqual(0.12);
      for (let j = 0; j < L.length; j++) expect(Math.abs(L[j].intensity - prevI[j])).toBeLessThan(LIGHT_TUNE.akici.floI * 0.2);
      prevSum = sum; prevI = L.map(l => l.intensity);
    }
  });

  it('kaynaklar: addSource ve Disposer, zones olmadan çökmez', () => {
    const { nl } = mk('akici');
    nl.update({ x: 0, z: 0 }, 22, 1 / 60);
    const n0 = nl.stats().lamps;
    const off = nl.addSource('x', () => [{ x: 1, y: 3, z: 1 }]);
    nl.update({ x: 0, z: 0 }, 22, 1 / 60);
    expect(nl.stats().lamps).toBe(n0 + 1);
    off(); nl.update({ x: 0, z: 0 }, 22, 1 / 60);
    expect(nl.stats().lamps).toBe(n0);
  });

  it('büfe floresanı aşamayı izler', () => {
    const scene = new T.Scene(); const nl = createNightLights({ scene, zones: null, tier: { name: 'sahane' } });
    let st = 1; nl.bind({ stage: () => st });
    const L = scene.children.filter(o => o.name.startsWith('nightLight')) as T.PointLight[];
    const flo = () => L.find(l => l.intensity > 0 && Math.abs(l.position.x - floresanNoktasi(st).x) < 1e-6 && Math.abs(l.position.z - floresanNoktasi(st).z) < 1e-6);
    for (let i = 0; i < 60; i++) nl.update({ x: 0, z: -6 }, 22, 1 / 60);
    expect(flo()).toBeTruthy();
    st = 3; for (let i = 0; i < 90; i++) nl.update({ x: 0, z: -6 }, 22, 1 / 60);
    expect(flo()).toBeTruthy();
  });

  it('iç mekanda hemi %85, dışarıda 1', () => {
    const { nl } = mk('dengeli'); const R = { hemiMul: 1 }; nl.bind({ render: R });
    for (let i = 0; i < 240; i++) nl.update(IC_BY_ID.kafe1, 13, 1 / 60, roomLightsFor('kafe1'));
    expect(R.hemiMul).toBeCloseTo(0.85, 2);
    for (let i = 0; i < 240; i++) nl.update({ x: 0, z: 0 }, 13, 1 / 60, null);
    expect(R.hemiMul).toBe(1);
  });

  it('PointLight yalnız night-lights.ts içinde üretilir', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
    const hits = [...walk('src/engine'), ...walk('src/game/view')].filter(f => /new (T|THREE)\.(PointLight|SpotLight)\b/.test(readFileSync(f, 'utf8')));
    expect(hits.map(h => h.replace(/\\/g, '/'))).toEqual(['src/game/view/world/night-lights.ts']);
  });
});
