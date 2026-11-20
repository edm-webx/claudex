/**
 * Hijyen müfettişi (BUF-16): aşama 5+ 5-6 günde bir gelen gerçek yürüyen karakter. Salonu (kasa, masalar) ve mutfağı gezer, her durakta klipsli
 * not tutar, hijyen puanını örnekler; sonunda sonucu bildirir (sim/hijyen.ts: iyi = küçük talep artışı, kötü = yalnız uyarı). Para cezası yok.
 */
import type { Vec2 } from '../../../engine/api';
import type { System, SimCtx } from '../../../engine/api';
import type { AgentEnv } from './env';
import { Walker, pointBack, near2, side } from './move';
import { ENTRY_M } from './env';
import { spawnPoint, outOfSight } from './specials';
import { IC_BY_ID, icWorld, icDim, icKapi, mutfakRota, mutfakKoridor } from '../../../content/ic-mekan';
import { MUTFAK_MIN_STAGE } from '../../../content/mutfak';
import type { Actor } from './types';

export interface MufettisSystem extends System { current(): { state: string; pos: Vec2; stop: number } | null }
interface Tur { a: Actor; wk: Walker; state: string; t: number; stops: { at: Vec2; ic?: 'giris' | 'cikis'; say: string }[]; i: number; samples: number[]; total: number }

export function createMufettis(env: AgentEnv): MufettisSystem {
  const rng = env.rng('mufettis'), KM = IC_BY_ID.mutfak, kw = (u: number, v: number) => icWorld(KM, u, v);
  let m: Tur | null = null;
  const hij = () => (env.rules.rt as unknown as { hijyen?: import('../hijyen').HijyenApi }).hijyen;
  const say = (a: Actor, t: string, s = 2.4) => { a.say = t; a.sayT = s; };
  function planla(): Tur['stops'] {
    const rt = env.rules.rt, st: Tur['stops'] = [];
    const c = env.book.get('counter.standAt');
    st.push({ at: side(c, 1.6, 1.8), say: 'Hmm, kasa ve tezgâh...' });
    const built = rt.tables.map((t, i) => (t && t.built ? i : -1)).filter((i) => i >= 0 && rt.layout.tables[i]);
    built.sort((x, y) => (rt.tables[y].dirty > 0 ? 1 : 0) - (rt.tables[x].dirty > 0 ? 1 : 0));
    for (const i of built.slice(0, 2)) { const tb = rt.layout.tables[i]; st.push({ at: { x: tb.x + 0.9, z: tb.z + 0.9 }, say: rt.tables[i].dirty > 0 ? 'Bu masa silinmemiş...' : 'Masalara bakalım.' }); }
    if (env.rules.state.stage >= MUTFAK_MIN_STAGE) st.push({ at: kw(0, mutfakKoridor().on), ic: 'giris', say: 'Mutfak, tabaklar, zemin...' });
    return st;
  }
  const kapi = () => icKapi(KM, 0.7);
  return {
    id: 'mufettis', order: 43, phase: 'sim',
    step(ctx: SimCtx) {
      const dt = ctx.dt, h = hij();
      if (!m) {
        if (!h || !env.rules.rt.started || env.rules.rt.paused || !h.mufettisIstiyor(env.host.hour())) return;
        const stops = planla(), first = stops[0].at;
        const from = pointBack(env.nav, spawnPoint(env), first, rng.range(ENTRY_M[0], ENTRY_M[1]));
        const a = env.reg.add('regular', 'mufettis', { kind: 'regular', seed: 4242, look: { top: '#2f3542', topStyle: 'suit', bottom: '#2f3542', glasses: 'round', hair: 'short', hairColor: '#6d6d70', apron: null, bowtie: '#9a1f2b' } }, from, { name: 'Hijyen Müfettişi' });
        m = { a, wk: new Walker(a, env.nav), state: 'walk', t: 0, stops, i: 0, samples: [], total: 0 };
        m.wk.goTo(first); a.fx = 'klips'; env.host.toast('Hijyen müfettişi geldi!', 'info');
        return;
      }
      const a = m.a; m.t += dt; m.total += dt; a.sayT -= dt; if (a.sayT <= 0) { a.say = ''; a.sayT = 0; }
      if (m.total > 150 && m.state !== 'leave') { m.state = 'leave'; m.wk.goTo(spawnPoint(env)); }
      if (m.state === 'walk') {
        a.act = 'walk';
        if (m.wk.walk(dt, 1.3)) return;
        m.state = 'not'; m.t = 0; a.act = 'idle'; say(a, m.stops[m.i].say); return;
      }
      if (m.state === 'not') {
        a.act = 'idle'; a.speed = 0;
        if (m.t < 2.8) return;
        m.samples.push(h ? h.puan() : 1);
        m.i++;
        if (m.i >= m.stops.length) {
          const puan = m.samples.reduce((s, v) => s + v, 0) / Math.max(1, m.samples.length), s = h?.mufettisBitti(puan) ?? 'orta';
          say(a, s === 'iyi' ? 'Tertemiz, tebrikler!' : s === 'kotu' ? 'Uyarı yazıyorum, toparlayın.' : 'Fena değil.', 3.4);
          m.state = 'leave'; m.t = 0; m.wk.goTo(spawnPoint(env));
          if (m.stops[m.i - 1].ic) { const D = icDim(KM).D; m.wk.path = [...mutfakRota([0, mutfakKoridor().on], [0, D / 2 - 0.4]).map(([u, v]) => kw(u, v)), kapi(), ...m.wk.path]; }
          return;
        }
        const nx = m.stops[m.i];
        if (nx.ic === 'giris') { const D = icDim(KM).D; m.wk.goTo(kapi()); m.wk.path.push(...mutfakRota([0, D / 2 - 0.4], [0, mutfakKoridor().on]).map(([u, v]) => kw(u, v))); m.wk.goal = nx.at; }
        else m.wk.goTo(nx.at);
        m.state = 'walk'; return;
      }
      a.act = 'walk';
      if (!m.wk.walk(dt, 1.3) || outOfSight(env, a)) { env.reg.remove(a); m = null; }
    },
    current: () => (m ? { state: m.state, pos: { x: m.a.x, z: m.a.z }, stop: m.i } : null),
  };
}
void near2;
