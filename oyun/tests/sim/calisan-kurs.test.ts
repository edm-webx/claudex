// BUF-18: a course really takes its time; the worker is away and comes back with xp
import { it, expect } from 'vitest';
import { played } from './m1-helpers';

it('kurs süre boyunca çalışanı götürür, sonra tecrübeyle geri getirir', () => {
  const sim = played(1) as any; sim.step(1); const S = sim.state; S.money = 1e6;
  S.workers.push({ id: S.nextWid++, name: 'Test', role: 'cay', trait: 'hamarat', traits: ['hamarat'], rarity: 'gri', xp: 0, rank: 0, look: {}, about: '' });
  const wid = S.workers[0].id;
  sim.command({ kind: 'calisan', op: 'kurs', id: wid + '|gulus' });
  expect(S.zones.calisan.kurs.length).toBe(1); expect(S.workers.find((w: any) => w.id === wid)).toBeUndefined();
  for (let i = 0; i < 400; i++) sim.step(0.25);   // 100 s > 90 s
  expect(S.zones.calisan.kurs.length).toBe(0);
  const w = S.workers.find((x: any) => x.id === wid) || S.zones.calisan.bench.find((x: any) => x.id === wid);
  expect(w.xp).toBeGreaterThan(0);
});
