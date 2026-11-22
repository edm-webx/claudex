// 2026-11-21 mantık denetimi (kullanıcı: "vapur saati niye orda? martılar niye üst üste?"): sabit iskele yerleşiminin kuralları.
// Tarayıcıdaki canlı denetçi tests/browser/mantik-denetci.mjs; burası saf veri kuralları (her derlemede koşar).
import { describe, it, expect } from 'vitest';
import { staticObstacles, stageLayout, PIER, type Obstacle } from '../../src/content/prefabs/iskele/layout';
import { PIER_PROPS } from '../../src/content/disari/martikoy';
import { devriyeNoktalari, DEVRIYE_MIN } from '../../src/game/sim/garson-bolge';

const kes = (a: Obstacle, b: Obstacle, pay = 0) => a.x0 < b.x1 - pay && b.x0 < a.x1 - pay && a.z0 < b.z1 - pay && b.z0 < a.z1 - pay;
const kutu = (x: number, z: number, hx: number, hz: number): Obstacle => ({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz });

describe('iskele sabit yerleşim', () => {
  const obs = staticObstacles().filter(o => o.tag !== 'rail');
  it('iki sabit prop / bank / lamba / baba birbirinin içine girmez', () => {
    const hata: string[] = [];
    for (let i = 0; i < obs.length; i++) for (let j = i + 1; j < obs.length; j++) if (kes(obs[i], obs[j], 0.05)) hata.push(`${obs[i].tag}@${obs[i].x0.toFixed(1)},${obs[i].z0.toFixed(1)} <> ${obs[j].tag}@${obs[j].x0.toFixed(1)},${obs[j].z0.toFixed(1)}`);
    expect(hata).toEqual([]);
  });
  it('bilet gişesi iskelenin üstünde, canlı tarife tahtasının yanında, başka bir propun üstünde değil', () => {
    const g = PIER_PROPS.gise;
    expect(g.x > PIER.x0 && g.x < PIER.x1 && g.z > PIER.z0 && g.z < PIER.z1).toBe(true);
    expect(Math.hypot(g.x - 21.0, g.z - -10.6)).toBeLessThan(4.5);   // ferry-look.ts BOARD_POS
    const gk = kutu(g.x, g.z, 0.65, 0.5);
    const ust = obs.filter(o => kes(o, gk) && !(Math.abs((o.x0 + o.x1) / 2 - g.x) < 0.05 && Math.abs((o.z0 + o.z1) / 2 - g.z) < 0.6));
    expect(ust).toEqual([]);
  });
  it('tarife tahtası kimsenin çarpışma kutusuna oturmaz', () => {
    const tb = kutu(21.0, -10.6, 1.06, 0.3);
    expect(obs.filter(o => kes(o, tb))).toEqual([]);
  });
});

describe('martı tünekleri', () => {
  it('hiçbir aşamada iki tünek aynı yerde değil (iki martı üst üste inmesin)', () => {
    const hata: string[] = [];
    for (let s = 1; s <= 10; s++) {
      const P = stageLayout(s).perch;
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (Math.hypot(P[i][0] - P[j][0], P[i][2] - P[j][2]) < 0.6) hata.push(`aşama ${s}: ${i}<>${j}`);
    }
    expect(hata).toEqual([]);
  });
});

describe('garson devriyesi', () => {
  it('noktalar masaların içinde değil, birbirine yapışık değil, deterministik', () => {
    const T = [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 0, z: 3 }, { x: 3, z: 3 }, { x: 6, z: 0 }];
    const a = devriyeNoktalari(T), b = devriyeNoktalari(T);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(2);
    for (const p of a) for (const t of T) expect(Math.hypot(p.x - t.x, p.z - t.z)).toBeGreaterThanOrEqual(DEVRIYE_MIN);
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) expect(Math.hypot(a[i].x - a[j].x, a[i].z - a[j].z)).toBeGreaterThanOrEqual(1.2);
  });
  it('tek masada bile dolaşacak yer var', () => { expect(devriyeNoktalari([{ x: 5, z: 5 }]).length).toBeGreaterThanOrEqual(2); });
});

describe('aşama yerleşimi (1-10): masa, istasyon, dekor yuvası, iş panosu, pad üst üste değil', () => {
  const obs = staticObstacles().filter(o => o.tag !== 'rail');
  const R: Record<string, number> = { s: 0.35, m: 0.5, l: 0.7 };
  for (let s = 1; s <= 10; s++) it('aşama ' + s, () => {
    const L = stageLayout(s) as unknown as { tables: { x: number; z: number; cati?: boolean }[]; stations: Record<string, { x: number; z?: number }>; slots: { pos: { x: number; z: number }; size: string }[]; job: { board: number[]; pos: { x: number; z: number } }; extraPads: Record<string, { x: number; z: number }>; counter: { pos: { x: number; z: number } } };
    const it: { ad: string; k: Obstacle }[] = [];
    L.tables.slice(0, 8).forEach((t, i) => it.push({ ad: 'masa' + i, k: kutu(t.x, t.z, 0.75, 0.75) }));
    L.slots.forEach((t, i) => it.push({ ad: 'dekor' + i, k: kutu(t.pos.x, t.pos.z, R[t.size] ?? 0.5, R[t.size] ?? 0.5) }));
    it.push({ ad: 'isPanosu', k: kutu(L.job.board[0], L.job.board[1], 0.6, 0.25) });
    for (const [k, p] of Object.entries(L.extraPads)) it.push({ ad: 'pad:' + k, k: kutu(p.x, p.z, 0.45, 0.45) });
    const hata: string[] = [];
    for (let i = 0; i < it.length; i++) {
      for (let j = i + 1; j < it.length; j++) if (kes(it[i].k, it[j].k, 0.02)) hata.push(it[i].ad + ' <> ' + it[j].ad);
      for (const o of obs) if (kes(it[i].k, o, 0.05)) hata.push(it[i].ad + ' <> sabit ' + o.tag + '@' + o.x0.toFixed(1) + ',' + o.z0.toFixed(1));
    }
    expect(hata).toEqual([]);
  });
});

describe('orman', () => {
  it('mantar piknik örtüsünün / mangalın / masanın üstünde çıkmaz (60 gün)', async () => {
    const { mantarlarOf } = await import('../../src/game/sim/mantar');
    const { ormanZone } = await import('../../src/content/zones/disari');
    const yum = ormanZone().props.filter(p => ['mk.ortu', 'mk.mangal', 'mk.piknik'].includes(p.prefab));
    const hata: string[] = [];
    for (let d = 1; d <= 60; d++) for (const m of mantarlarOf(d)) for (const p of yum) if (Math.hypot(m.x - p.pos.x, m.z - p.pos.z) < 1.3) hata.push(`gün ${d} ${m.id} ${p.prefab}`);
    expect(hata).toEqual([]);
  });
  it('orman durağında tek sundurma var', async () => {
    const { ormanZone } = await import('../../src/content/zones/disari');
    expect(ormanZone().props.filter(p => p.prefab === 'mk.stop')).toEqual([]);
  });
});
