/**
 * Belediye işçileri (2026-11-21): iskelenin iki ucundaki kilitli inşaat sahalarında (content/kilitli-bolge.ts) çalışan gerçek
 * actor'lar. Rol 'usta' (turuncu tulum, sarı baret). Çalışan değiller: işe alınmaz, maaş yok, kayda yazılmaz; bölge kilitliyken
 * sahadadırlar, bölge açılınca (acikBolgeler) kalkarlar.
 * - taşıyıcı: malzeme yığınından kalas alır, dolgudaki kalıba taşır, çekiçle çakar, geri döner
 * - kürekçi: kum yığınını kürekler, betoniyere taşır, döner
 * - bayrakçı: kapının arkasında volta atar; oyuncu bariyere yaklaşınca durur, ona döner, el sallar, laf atar
 * - şef: kalıp ile saha arasında gezer, durup konuşur / telefonla konuşur
 * Yürüyüş düz çizgi (noktalar makinelerin ve yığınların dışında seçildi), nav'a girmez: çitin arkası oyuncuya kapalı.
 * Deterministik: kendi rng akışı ('belediye').
 */
import type { System, SimCtx } from '../../../engine/api';
import { KILITLI_BOLGELER, bolgeKilitli, dunya, type KilitliBolge, type IsciPlan } from '../../../content/kilitli-bolge';
import type { AgentEnv } from './env';
import type { Actor } from './types';

const BAYRAK_SOZ = ['Abi buradan geçiş yok!', 'Kardeşim şantiye burası, dön geri!', 'İskele büyüyünce gel, mahalle olacak burası!', 'Baretin yoksa giremezsin!', 'Belediye çalışıyor, sabır!'];
const SEF_SOZ = ['Kepçeyi biraz geri çek!', 'Kamyon dolunca haber verin.', 'Şurası park olacak, buraya dokunmayın.', 'Müdür bey yarın geliyor, hızlı!', 'Çay geldi mi çay?'];
const TEL_SOZ = ['Alo müdürüm, dolgu bitiyor...', 'Mıcır yarın gelecek dediler.', 'Beton saat üçte, tamam.'];

interface Isci { a: Actor; p: IsciPlan; b: KilitliBolge; i: number; dir: 1 | -1; st: 'yuru' | 'is'; t: number; dur: number; soz: number }

export interface BelediyeSystem extends System { isciler(): { bolge: string; is: string; st: string; x: number; z: number; act: string; fx: string }[] }

export function createBelediye(env: AgentEnv): BelediyeSystem {
  const rng = env.rng('belediye');
  const sahalar = new Map<string, Isci[]>();
  const say = (a: Actor, t: string, s = 2.6) => { a.say = t; a.sayT = s; };
  const nokta = (w: Isci, i: number) => dunya(w.b, w.p.yol[i]);

  function ac(b: KilitliBolge): Isci[] {
    return b.isciler.map((p, k) => {
      const at = dunya(b, p.yol[0]);
      const a = env.reg.add('worker', b.id + '-' + k, { kind: 'worker', role: 'usta', seed: 8300 + k * 13 + (b.taraf > 0 ? 0 : 7) }, at, { role: 'belediye', name: p.ad });
      return { a, p, b, i: 0, dir: 1 as const, st: 'is' as const, t: rng.next() * 2, dur: 1 + rng.next() * 2, soz: 4 + rng.next() * 8 };
    });
  }

  /** hedef noktaya düz yürü; vardıysa true */
  function yuru(w: Isci, dt: number, hiz: number, act: string): boolean {
    const a = w.a, to = nokta(w, w.i), dx = to.x - a.x, dz = to.z - a.z, d = Math.hypot(dx, dz);
    if (d < 0.06) { a.speed = 0; return true; }
    const k = Math.min(1, hiz * dt / d); a.x += dx * k; a.z += dz * k; a.rot = Math.atan2(dx, dz); a.speed = hiz; a.act = act; return false;
  }
  const bak = (a: Actor, x: number, z: number) => { a.rot = Math.atan2(x - a.x, z - a.z); };
  /** gidip gelen yol: sıradaki nokta */
  function sonraki(w: Isci) {
    const n = w.p.yol.length; if (n < 2) return;
    if (w.i + w.dir >= n || w.i + w.dir < 0) w.dir = (-w.dir) as 1 | -1;
    w.i += w.dir;
  }

  function adim(w: Isci, dt: number) {
    const a = w.a;
    w.t += dt; w.soz -= dt;
    if (a.sayT > 0) { a.sayT -= dt; if (a.sayT <= 0) { a.say = ''; a.sayT = 0; } }
    const son = w.p.yol.length - 1;
    switch (w.p.is) {
      case 'tasiyici': {
        if (w.st === 'yuru') {
          const tasiyor = w.dir > 0;   // yığından kalıba giderken kalas omzunda
          a.fx = tasiyor ? 'kalas' : '';
          if (yuru(w, dt, tasiyor ? 1.0 : 1.3, tasiyor ? 'carry' : 'walk')) {
            if (w.i === son) { w.st = 'is'; w.t = 0; w.dur = 6 + rng.next() * 3; a.fx = 'cekic'; a.act = 'cut'; bak(a, a.x - w.b.taraf * 1.2, a.z - 0.4); }
            else if (w.i === 0) { w.st = 'is'; w.t = 0; w.dur = 1.4; a.act = 'idle'; a.fx = 'kalas'; }
            else sonraki(w);
          }
        } else if (w.t > w.dur) { w.st = 'yuru'; sonraki(w); }
        break;
      }
      case 'kurek': {
        if (w.st === 'yuru') {
          a.fx = 'kurek';
          if (yuru(w, dt, 1.1, w.dir > 0 ? 'carry' : 'walk')) {
            w.st = 'is'; w.t = 0;
            if (w.i === 0) { w.dur = 5 + rng.next() * 2; a.act = 'wipe'; const k = dunya(w.b, { u: 57.2, z: 6.0 }); bak(a, k.x, k.z); }
            else { w.dur = 1.6; a.act = 'idle'; const k = dunya(w.b, { u: 55.0, z: 7.0 }); bak(a, k.x, k.z); }
          }
        } else if (w.t > w.dur) { w.st = 'yuru'; sonraki(w); }
        break;
      }
      case 'bayrakci': {
        a.fx = 'bayrak';
        const kapi = dunya(w.b, { u: w.b.bariyerU, z: w.b.kapiZ }), P = env.player();
        const yakin = P && Math.hypot(P.x - kapi.x, P.z - kapi.z) < 7.5 && Math.sign(P.x) === w.b.taraf;
        if (yakin && P) {
          a.speed = 0; a.act = 'wave'; bak(a, P.x, P.z);
          if (w.soz <= 0) { say(a, BAYRAK_SOZ[rng.int(0, BAYRAK_SOZ.length - 1)], 3); w.soz = 9 + rng.next() * 6; }
        } else if (w.st === 'yuru') {
          if (yuru(w, dt, 0.7, 'walk')) { w.st = 'is'; w.t = 0; w.dur = 2 + rng.next() * 3; a.act = 'idle'; bak(a, a.x - w.b.taraf, a.z); }
        } else if (w.t > w.dur) { w.st = 'yuru'; sonraki(w); }
        break;
      }
      case 'sef': {
        a.fx = '';
        if (w.st === 'yuru') {
          if (yuru(w, dt, 1.05, 'walk')) {
            w.st = 'is'; w.t = 0; const tel = rng.next() < 0.35;
            w.dur = tel ? 5 : 3 + rng.next() * 2; a.act = tel ? 'phone' : 'talk';
            const ex = dunya(w.b, w.b.makineler[0]); bak(a, ex.x, ex.z);
            if (w.soz <= 0) { say(a, tel ? TEL_SOZ[rng.int(0, TEL_SOZ.length - 1)] : SEF_SOZ[rng.int(0, SEF_SOZ.length - 1)], 2.8); w.soz = 14 + rng.next() * 10; }
          }
        } else if (w.t > w.dur) { w.st = 'yuru'; sonraki(w); }
        break;
      }
    }
  }

  return {
    id: 'belediye', order: 49, phase: 'sim',
    step(ctx: SimCtx) {
      const dt = Math.min(ctx.dt, 0.25), S = env.rules.state;
      for (const b of KILITLI_BOLGELER) {
        const on = bolgeKilitli(b, S), l = sahalar.get(b.id);
        if (on && !l) sahalar.set(b.id, ac(b));
        else if (!on && l) { for (const w of l) env.reg.remove(w.a); sahalar.delete(b.id); }
        else if (l) for (const w of l) adim(w, dt);
      }
    },
    isciler: () => [...sahalar.values()].flat().map(w => ({ bolge: w.b.id, is: w.p.is, st: w.st, x: w.a.x, z: w.a.z, act: w.a.act, fx: w.a.fx })),
  };
}
