/**
 * Tadilat ustaları (BUF-21, sahip kararı: yürüyen ustalar): tadilat sürerken gelen geçici, gerçek yürüyen karakterler. Çalışan
 * değiller (işe alınmaz, maaş yok, kayda yazılmaz): S.tadilat varken iskeleye gelir, malzeme yığınından kalas alıp çalışma
 * noktasına taşır, baretle çekiç sallar (act 'cut', fx 'cekic'), sonra sıradaki noktaya geçer; tadilat bitince el sallayıp gider.
 * Noktalar content/insaat.ts (görünümdeki iskele / vinç ile aynı alan). Deterministik: kendi rng akışı ('ustalar').
 */
import type { System, SimCtx, Vec2 } from '../../../engine/api';
import type { AgentEnv } from './env';
import { Walker, pointBack, near2 } from './move';
import { ustaNoktalari, ustaSayisi } from '../../../content/insaat';
import type { Actor } from './types';

export interface UstalarSystem extends System { rows(): { key: string; state: string; x: number; z: number; act: string; fx: string }[] }
interface Usta { a: Actor; wk: Walker; state: 'git' | 'calis' | 'cik'; t: number; hedef: number; kalas: boolean; dur: number; slot: number }

const SOZ = ['Kalas geliyor!', 'Su terazisi nerede?', 'Bu kolon tamam usta!', 'Çay molası birazdan.', 'Dikkat, vinç dönüyor!', 'Şunu bir tut!'];
const LOOK = (i: number) => ({ top: ['#3d5a80', '#5b6068', '#2f4a6a', '#6b5a3a', '#3d5a80'][i % 5], topStyle: 'overall', sleeves: 'long', vest: '#ff8a1f', bottom: ['#3d5a80', '#5b6068', '#2f4a6a', '#6b5a3a', '#3d5a80'][i % 5], hat: 'helmet', hatColor: i % 3 === 2 ? '#fbfaf6' : '#ffd23f', gloves: '#f2d24a', shoes: '#3a2a22', mustache: i % 2 === 0 ? 'thick' : false });

export function createUstalar(env: AgentEnv): UstalarSystem {
  const rng = env.rng('ustalar');
  const list: Usta[] = [];
  let to = 0, spawnT = 0, n = 0;
  const say = (a: Actor, t: string, s = 2.2) => { a.say = t; a.sayT = s; };
  const cikis = (): Vec2 => { const s = env.book.spawns(); return s.length ? s[rng.int(0, s.length - 1)] : { x: 0, z: 12 }; };
  // her usta kendine ait bir çalışma noktasına ve yığının kendi payına gider: aynı noktada üst üste binmezler
  const ev = (u: Usta, pts: Vec2[]): number => (pts.length < 2 ? 0 : 1 + (u.slot % (pts.length - 1)));
  const nokta = (u: Usta, pts: Vec2[], h: number): Vec2 => (h === 0 ? { x: pts[0].x + ((u.slot % 5) - 2) * 0.45, z: pts[0].z } : (u.slot >= pts.length - 1 ? { x: pts[h].x + 0.9, z: pts[h].z } : pts[h]));
  function sonraki(u: Usta): void {
    const pts = ustaNoktalari(to);
    // malzeme yığını (0) ile kendi çalışma noktası arasında gidip gelir: yığından kalas alır, noktaya taşır
    u.hedef = pts.length < 2 ? 0 : u.kalas || rng.next() < 0.45 ? ev(u, pts) : 0;
    u.wk.goTo(nokta(u, pts, u.hedef)); u.state = 'git'; u.t = 0;
  }
  return {
    id: 'ustalar', order: 44, phase: 'sim',
    step(ctx: SimCtx) {
      const dt = ctx.dt, S = env.rules.state, td = S.tadilat as unknown as { to: number } | null;
      const want = td && td.to >= 2 && env.rules.rt.started ? td.to : 0;
      if (want && want !== to) { to = want; spawnT = 0; for (const u of list) sonraki(u); }
      if (!want && to) { to = 0; for (const u of list) if (u.state !== 'cik') { u.state = 'cik'; u.t = 0; u.a.fx = ''; u.kalas = false; say(u.a, 'Kolay gelsin, hayırlı olsun!', 2.6); u.wk.goTo(cikis()); } }
      // gelen ustalar birer birer (1.4 sn arayla), noktalardan geriye doğru yürüyüş mesafesinde belirir
      if (to && list.filter(u => u.state !== 'cik').length < ustaSayisi(to) && (spawnT -= dt) <= 0) {
        spawnT = 1.4;
        let slot = 0; while (list.some(x => x.state !== 'cik' && x.slot === slot)) slot++;
        const pts = ustaNoktalari(to), us = { slot } as Usta, h = ev(us, pts), first = nokta(us, pts, h);
        const from = pointBack(env.nav, cikis(), first, rng.range(9, 13));
        const a = env.reg.add('regular', 'usta-' + n, { kind: 'regular', seed: 7100 + n, look: LOOK(n) }, from, { name: 'Tadilat ustası', usta: true });
        const u: Usta = { a, wk: new Walker(a, env.nav), state: 'git', t: 0, hedef: 0, kalas: false, dur: 0, slot };
        n++; list.push(u); u.wk.goTo(first); u.hedef = h;
      }
      for (let i = list.length - 1; i >= 0; i--) {
        const u = list[i], a = u.a; u.t += dt; a.sayT -= dt; if (a.sayT <= 0) { a.say = ''; a.sayT = 0; }
        if (u.state === 'cik') {
          a.act = 'walk';
          if (!u.wk.walk(dt, 1.35) || u.t > 45) { env.reg.remove(a); list.splice(i, 1); }
          continue;
        }
        if (u.state === 'git') {
          a.act = u.kalas ? 'carry' : 'walk'; a.fx = u.kalas ? 'kalas' : '';
          if (u.wk.walk(dt, u.kalas ? 1.0 : 1.25) && u.t < 40) continue;
          if (u.hedef === 0) { u.kalas = true; u.state = 'calis'; u.t = 0; u.dur = 1.2; a.act = 'grab'; a.fx = 'kalas'; continue; }   // yığından kalas al
          u.kalas = false; u.state = 'calis'; u.t = 0; u.dur = rng.range(4, 7); a.fx = 'cekic'; a.act = 'cut';
          if (rng.next() < 0.3) say(a, rng.pick(SOZ));
          continue;
        }
        // calis: çekiç sallar (ya da kalası omuzlar), süre dolunca sıradaki nokta
        a.speed = 0; if (u.hedef !== 0) a.act = 'cut';
        if (u.t >= u.dur) sonraki(u);
      }
    },
    rows: () => list.map(u => ({ key: u.a.key, state: u.state, x: u.a.x, z: u.a.z, act: u.a.act, fx: u.a.fx })),
  };
}
void near2;
