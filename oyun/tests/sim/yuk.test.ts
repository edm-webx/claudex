// PRF-14: sim tick maliyeti, en kötü durum yük testi. Sim saf TS olduğundan Node'da tam ve donanımdan bağımsız ölçülür.
// Senaryo: büfe aşama 10, altı kafe/kantin/lokanta satın alınmış ve tam kadro, 40 kiralık çalışan, 200 yürüyen vatandaş
// (ajan tavanı 256'ya yakın), gerçek A* (engelli sentetik ızgara). Stok/malzeme çağrısı yok (yasak mekanik).
// Ölçüm sim DIŞINDA: performance.now yalnız bu test dosyasında ve scheduler'a enjekte edilen `now` kancasında (lint:sim kuralı korunur).
import { it, expect } from 'vitest';
import { createSim } from '../../src/game/headless';
import { emptyContent } from '../../src/content/index';
import { createNav } from '../../src/engine/nav';
import { createAmbient } from '../../src/game/sim/ambient';
import { createLoop } from '../../src/engine/loop';
import { AGENT_CAP } from '../../src/game/sim/schema';
import type { WalkGrid } from '../../src/engine/api';
import budget from '../../tools/perf-budget.json';

const log = { info() {}, warn() {}, error() {} };
const B = budget.sim;
const WARM = 300, TICKS = 3000;

/** 160 x 120 m, 0.5 m hücre; tohumlu dikdörtgen engeller (A* gerçekten dolanmak zorunda). */
function grid(): WalkGrid {
  const w = 320, h = 240, cost = new Uint8Array(w * h).fill(1);
  let s = 12345; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < 90; k++) {
    const bw = 4 + Math.floor(r() * 16), bh = 4 + Math.floor(r() * 16), bx = Math.floor(r() * (w - bw)), bz = Math.floor(r() * (h - bh));
    for (let z = bz; z < bz + bh; z++) for (let x = bx; x < bx + bw; x++) cost[z * w + x] = 0;
  }
  return { cell: 0.5, w, h, origin: { x: -80, z: -60 }, cost, zone: 'iskele' };
}

function worstCase(seed: number) {
  const nav = createNav(); nav.addGrid(grid());
  const clock = { t: 0 };
  const sim = createSim({ seed, content: emptyContent() }, {
    log, nav, now: () => performance.now(),
    ambient: createAmbient({ nav, anchors: () => ({}), count: 200 }),
  }) as any;
  sim.command({ kind: 'play', hero: 'sabri' }); sim.step(1);
  const S = sim.state; S.level = 40; S.money = 5e8; S.stars = 5;
  sim.command({ kind: 'setStage', stage: 10 });
  const mulk = (x: any) => sim.command({ kind: 'mulk', ...x });
  for (const id of ['k1', 'k2', 'k3', 'k4', 'k5', 'k6']) { mulk({ op: 'arsaAl', id }); const p = S.zones.arsa?.plots?.[id]; if (p) { p.lv = 5; for (let i = 0; i < 8; i++) mulk({ op: 'isciAl', id }); } }
  const roles = ['doner', 'garson', 'temizlik', 'cay', 'simit', 'ayran', 'tost', 'gazoz'];
  for (let i = 0; i < 40; i++) S.workers.push({ id: S.nextWid++, name: 'D' + i, role: roles[i % 8], trait: 'hamarat', traits: ['hamarat'], rarity: 'gri', xp: 0, rank: 0, morale: 70, legend: null, look: {}, about: '', hiredDay: 1, team: null });
  sim.step(20);
  void clock;
  return { sim, nav };
}

const q = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];

it('en kötü durum: tick maliyeti bütçe altında (p95 ve maks), sistem dağılımı raporlanır', () => {
  const { sim, nav } = worstCase(1);
  for (let i = 0; i < WARM; i++) sim.tickOnce();          // JIT ısınması: ilk tick'ler ölçüme girmez
  const tot: number[] = [], per: Record<string, number[]> = {};
  const n0 = nav.stats!();
  let maxCallsInTick = 0;
  for (let i = 0; i < TICKS; i++) {
    const c0 = nav.stats!().pathCalls;
    const t0 = performance.now(); sim.tickOnce(); tot.push(performance.now() - t0);
    const c1 = nav.stats!().pathCalls - c0; if (c1 > maxCallsInTick) maxCallsInTick = c1;
    const tm = sim.scheduler.timings(); for (const k in tm) (per[k] ||= []).push(tm[k]);
  }
  const n1 = nav.stats!();
  const p95 = q(tot, 0.95), mx = Math.max(...tot);
  const top = Object.entries(per).map(([k, v]) => [k, q(v, 0.95), Math.max(...v)] as const).sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log(`[yuk] ajan=${sim.agents.hi}/${AGENT_CAP} işçi=${sim.state.workers.length} aşama=${sim.state.stage} tick p50=${q(tot, 0.5).toFixed(3)} p95=${p95.toFixed(3)} p99=${q(tot, 0.99).toFixed(3)} maks=${mx.toFixed(2)} ms`);
  console.log('[yuk] en pahalı sistemler (p95/maks ms):', top.map(t => `${t[0]} ${t[1].toFixed(3)}/${t[2].toFixed(2)}`).join(' | '));
  console.log(`[yuk] nav: ${n1.pathCalls - n0.pathCalls} yol isteği/${TICKS} tick, tick başı en çok ${maxCallsInTick}, istek başı ort. ${((n1.expanded - n0.expanded) / Math.max(1, n1.pathCalls - n0.pathCalls)).toFixed(0)} düğüm, en çok ${n1.maxExpanded}, başarısız ${n1.pathFails - n0.pathFails}; akış alanı yeniden kurulum ${n1.flowBuilds - n0.flowBuilds}, isabet ${n1.flowHits - n0.flowHits}`);
  expect(sim.agents.hi).toBeGreaterThan(150);               // gerçekten kalabalık senaryo
  expect(sim.scheduler.disabled()).toEqual([]);            // hiçbir sistem düşmedi
  expect(p95).toBeLessThan(B.tickP95Ms);
  // Maks bütçesi p99.9 üzerinden: ölçüm kutusundaki tek seferlik işletim sistemi/GC sıçraması (bir koşuda 76 ms görüldü, tekrarda
  // 6 ms) bütçeyi yanlış yere kırmasın. Gerçek bir sim regresyonu p99.9'u da yükseltir. Mutlak tavan 4 kat.
  expect(q(tot, 0.999)).toBeLessThan(B.tickMaxMs);
  expect(mx).toBeLessThan(B.tickMaxMs * 4);
  expect(maxCallsInTick).toBeLessThanOrEqual(B.pathCallsPerTickMax);
}, 120000);

it('determinizm: aynı tohum iki koşuda aynı durum özeti (ölçüm sim sonucunu değiştirmez)', () => {
  const a = worstCase(7).sim, b = worstCase(7).sim;
  for (let i = 0; i < 900; i++) { a.tickOnce(); b.tickOnce(); }
  expect(a.hash()).toBe(b.hash());
  const c = worstCase(8).sim; for (let i = 0; i < 900; i++) c.tickOnce();
  expect(c.hash()).not.toBe(a.hash());
}, 120000);

it('ölüm sarmalı: 5 adımı aşan karelerde oyun zamanı kaybı sayılır, sessiz değildir', () => {
  let steps = 0;
  const loop = createLoop({ step: () => { steps++; }, render: () => {}, targetFps: () => 60, raf: () => 0, cancelRaf: () => {} });
  loop.frame(0);
  for (let k = 1; k <= 60; k++) loop.frame(k * 1000 / 60);           // sağlıklı 60 Hz: kayıp yok
  expect(loop.stats()).toMatchObject({ slowFrames: 0, lostMs: 0, clampedFrames: 0 });
  const s0 = steps; loop.frame(1000 + 2000);                         // 2 sn takılma: 250 ms'ye kırpılır
  const st = loop.stats();
  expect(steps - s0).toBe(5); expect(st.clampedFrames).toBe(1); expect(st.slowFrames).toBe(1);
  expect(st.lostMs).toBeGreaterThan(0); expect(st.maxStepsInFrame).toBe(5);
  // kayıp = kırpılmış 250 ms - çalışan 5 adım (166.7 ms), tam adım katı olarak
  expect(st.lostMs).toBeLessThanOrEqual(250);
});
