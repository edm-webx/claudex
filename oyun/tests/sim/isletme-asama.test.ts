// DKN-02: far-shore upgrades are timed renovations; stage decides tables, queue and crew cap
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { mulkApi } from '../../src/game/sim/mulk';
import { ARSALAR } from '../../src/content/esya';

const mk = () => { const sim = played(1) as any; sim.rules.rt.acilisSerbest = true; sim.step(1); /* kurulum: sıralı açılma şartı yok (content/acilis.ts, kendi testi acilis.test.ts) */ const S = sim.state; S.level = 40; S.money = 1e8; return { sim, S, m: mulkApi(sim.rules)!, h: sim.rules.rt.kafeHost, c: (x: any) => sim.command({ kind: 'mulk', ...x }) }; };
const plot = (S: any, id: string) => S.zones.arsa.plots[id];

it('tadilat süreli: yükseltme anında lv artırmaz, süre dolunca artırır; ikinci yükseltme ve alet reddedilir', () => {
  const { sim, S, c } = mk(); c({ op: 'arsaAl', id: 'k1' }); const fiyat = ARSALAR.find(a => a.id === 'k1')!.fiyat;
  const m0 = S.money; c({ op: 'yukselt', id: 'k1' });
  expect(plot(S, 'k1').lv).toBe(1); expect(plot(S, 'k1').tadilat).toMatchObject({ to: 2, total: 90 }); expect(m0 - S.money).toBe(Math.round(fiyat * 0.45));
  const m1 = S.money; c({ op: 'yukselt', id: 'k1' }); c({ op: 'kafeEsya', id: 'k1', e: 'espresso' }); expect(S.money).toBe(m1);
  for (let i = 0; i < 400; i++) sim.step(0.25);
  expect(plot(S, 'k1').lv).toBe(2); expect(plot(S, 'k1').tadilat).toBeUndefined();
});
it('tadilat sırasında işletme çalışır; kayıt dönüşünde tadilat korunur', () => {
  const { sim, S, h, c } = mk(); c({ op: 'arsaAl', id: 'k1' }); c({ op: 'adminIsci', id: 'k1' }); c({ op: 'yukselt', id: 'k1' });
  const sat0 = plot(S, 'k1').sat;
  for (let i = 0; i < 400; i++) { sim.step(0.1); h.pending.k1 = Math.max(h.pending.k1 || 0, 1); }
  expect(plot(S, 'k1').sat).toBeGreaterThan(sat0);
  const j = JSON.parse(JSON.stringify(S.zones.arsa)); expect(j.plots.k1.tadilat.left).toBeLessThan(90);
});
it('kapasite aşamayla artar: masa ve kuyruk', () => {
  const { S, h, c } = mk(); c({ op: 'arsaAl', id: 'k1' }); c({ op: 'arsaAl', id: 'k3' });
  expect(h.info('k1')).toMatchObject({ masa: 2, kuyruk: 3 }); expect(h.info('k3').kuyruk).toBe(2);
  for (let i = 0; i < 4; i++) { c({ op: 'yukselt', id: 'k1' }); c({ op: 'adminTadilatBitir', id: 'k1' }); }
  expect(plot(S, 'k1').lv).toBe(5); expect(h.info('k1')).toMatchObject({ masa: 5, kuyruk: 5 });
  c({ op: 'yukselt', id: 'k1' }); expect(plot(S, 'k1').tadilat).toBeUndefined();   // top stage
});
it('Altın Simitle bitirme altın ister', () => {
  const { S, c } = mk(); c({ op: 'arsaAl', id: 'k1' }); c({ op: 'yukselt', id: 'k1' });
  S.gold = 0; c({ op: 'tadilatAtla', id: 'k1' }); expect(plot(S, 'k1').lv).toBe(1);
  S.gold = 99; c({ op: 'tadilatAtla', id: 'k1' }); expect(plot(S, 'k1').lv).toBe(2); expect(S.gold).toBeLessThan(99);
});
