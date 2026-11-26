// DKN-02: ustalar are real actors: exactly 2 per renovating business, gone when the renovation ends
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { mulkApi } from '../../src/game/sim/mulk';

const mk = () => { const sim = played(1) as any; sim.rules.rt.acilisSerbest = true; sim.step(1); /* kurulum: sıralı açılma şartı yok (content/acilis.ts, kendi testi acilis.test.ts) */ const S = sim.state; S.level = 40; S.money = 1e8; return { sim, S, c: (x: any) => sim.command({ kind: 'mulk', ...x }) }; };
const ustalar = (sim: any) => sim.rules.rt.agents.registry.list.filter((a: any) => a.kind === 'worker' && !a.dead && a.info.role === 'usta');

it('tadilat başlayınca işletme başına tam 2 usta, bitince 0', () => {
  const { sim, c } = mk(); expect(ustalar(sim)).toHaveLength(0);
  c({ op: 'arsaAl', id: 'k1' }); c({ op: 'arsaAl', id: 'k2' }); sim.step(0.25); expect(ustalar(sim)).toHaveLength(0);
  c({ op: 'yukselt', id: 'k1' }); sim.step(0.25); expect(ustalar(sim)).toHaveLength(2);
  c({ op: 'yukselt', id: 'k2' }); sim.step(0.25); expect(ustalar(sim)).toHaveLength(4);
  expect(ustalar(sim).every((a: any) => a.rig.role === 'usta' && a.rig.kind === 'worker')).toBe(true);
  // iskele görünümü (view/world/isletme-insaat) view().plots[].tadilat okur: 2026-11-26'ya kadar alan yoktu, iskele hiç kurulmuyordu
  const pk = () => mulkApi(sim.rules)!.view().plots.find((p: any) => p.id === 'k1') as any; expect(pk().tadilat?.total).toBeGreaterThan(0);
  c({ op: 'adminTadilatBitir', id: 'k1' }); sim.step(0.25); expect(ustalar(sim)).toHaveLength(2);
  c({ op: 'adminTadilatBitir', id: 'k2' }); sim.step(0.25); expect(ustalar(sim)).toHaveLength(0); expect(pk().tadilat).toBeNull();
});
it('ustalar yürür ve çalışır: malzeme yığınından iskeleye, sonra sweep hareketi', () => {
  const { sim, c } = mk(); c({ op: 'arsaAl', id: 'k1' }); c({ op: 'yukselt', id: 'k1' });
  const acts = new Set<string>(), x0 = new Map<number, number>();
  for (let i = 0; i < 400; i++) { sim.step(0.1); for (const a of ustalar(sim)) { acts.add(a.act); if (!x0.has(a.id)) x0.set(a.id, a.z); } }
  expect(acts.has('sweep')).toBe(true); expect(acts.has('carry')).toBe(true);
  expect(ustalar(sim).some((a: any) => Math.abs(a.z - x0.get(a.id)!) > 0.5)).toBe(true);
});
