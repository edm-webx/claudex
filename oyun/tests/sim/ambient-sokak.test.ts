// DNY-01 / DNY-15 / DNY-20: tüm haritayı gezen, gün programlı vatandaşlar (gerçek iskele ızgarası, tests/fixtures/iskele-izgara.txt).
import { describe, it, expect } from 'vitest';
import { sokakRun, sokakNav } from './sokak-harness';
import { AGENT_FLAG, AGENT_LOD, ACT_ORDER } from '../../src/game/sim/schema';
import { CITIZENS } from '../../src/content/citizens';
import { BUFE } from '../../src/content/prefabs/iskele/layout';
import { UG } from '../../src/content/ustgecit';
import {
  SOKAK_HAVUZ, SOKAK_YURU, SOKAK_KAPI, SOKAK_BEKLE, SOKAK_KORKULUK, SOKAK_SIGINAK, SOKAK_GOLGE, SOKAK_BANK, SOKAK_ROLLER, SOKAK_YOGUNLUK, UG_AYAK, bankOnu,
} from '../../src/content/sokak';

const vis = (f: number) => (f & AGENT_FLAG.visible) !== 0 && (f & AGENT_FLAG.ambient) !== 0;
const onBridge = (x: number, z: number) => Math.abs(x - UG.x) <= UG.hw + 0.25 && z > UG.zA - 0.6 && z < UG.zD + 0.6;
const inHours = (spans: [number, number][], h: number) => spans.some(([a, b]) => (h >= a && h < b) || (b >= 24 && h >= 24));

describe('yaşayan sokak (DNY-01)', () => {
  it('her nokta yürünür ve üst geçitten geçerek her yerden ulaşılabilir', () => {
    const nav = sokakNav();
    const pts = [...SOKAK_YURU, ...SOKAK_KAPI, ...SOKAK_BEKLE, ...SOKAK_KORKULUK, ...SOKAK_SIGINAK, ...SOKAK_GOLGE, ...SOKAK_BANK.flatMap(b => [bankOnu(b, 0), bankOnu(b, 1)]),
      ...SOKAK_ROLLER.flatMap(r => [...(r.rota ?? []), ...(r.durak ?? [])])];
    const start = { x: 0, z: 8 };
    const bad: string[] = [];
    for (const p of pts) {
      if (!nav.walkable(p)) { bad.push(`dolu ${p.x},${p.z}`); continue; }
      const k = p.z > 20;
      const ok = k ? nav.path(start, UG_AYAK.i, { maxNodes: 20000 }).length && nav.path(UG_AYAK.k, p, { maxNodes: 20000 }).length : nav.path(start, p, { maxNodes: 20000 }).length;
      if (!ok) bad.push(`ulaşılmaz ${p.x},${p.z}`);
    }
    expect(bad).toEqual([]);
    // yol kapalı, tek geçiş üst geçit
    expect(nav.walkable({ x: 0, z: 20 })).toBe(false);
    expect(nav.walkable({ x: UG.x, z: 20 })).toBe(true);
  });

  it('sokak kipi açılır, havuz sabit (48), aynı tohum aynı konumlar', () => {
    const a = sokakRun(11), b = sokakRun(11), c = sokakRun(12);
    for (const r of [a, b, c]) r.tick(30 * 120);
    expect(a.amb.sokak).toBe(true);
    expect(a.amb.count).toBe(SOKAK_HAVUZ);
    expect(Array.from(a.s.f32('x'))).toEqual(Array.from(b.s.f32('x')));
    expect(Array.from(a.s.u8('typeId'))).toEqual(Array.from(b.s.u8('typeId')));
    expect(Array.from(a.s.f32('x'))).not.toEqual(Array.from(c.s.f32('x')));
  }, 120000);

  it('600 sn: kimse duvarda/büfede/yolda değil, ışınlanma yok, takılan yok, üst geçit kullanılıyor', () => {
    const r = sokakRun(5, 13);
    // kahraman haritayı dolaşsın ki LOD gizlemesi tüm vatandaşları kapatmasın
    const tour = [{ x: 0, z: 8 }, { x: 24, z: 20 }, { x: -4, z: 44 }, { x: 30, z: 45 }, { x: -40, z: 30 }, { x: 40, z: 9 }];
    const X = r.s.f32('x'), Z = r.s.f32('z'), F = r.s.u16('flags'), SP = r.s.f32('speed'), A = r.s.u8('act');
    const prevX = new Float32Array(256).fill(NaN), prevZ = new Float32Array(256), prevVis = new Uint8Array(256), stuckT = new Float32Array(256), wallT = new Float32Array(256);
    let bridge = 0, wall = 0, road = 0, bufe = 0, jumps = 0, stuck = 0, k = 0;
    const seatedSlots = () => new Set(r.amb.rows().filter(w => w.seated).map(w => w.slot));
    r.tick(30 * 600, () => {
      k++;
      if (k % (30 * 100) === 0) Object.assign(r.state.player, tour[(k / 3000) % tour.length]);
      const seated = k % 10 === 0 ? seatedSlots() : null;
      for (let i = 0; i < r.s.hi; i++) {
        const v = r.s.alive(i) && vis(F[i]);
        if (v && prevVis[i] && prevX[i] === prevX[i] && Math.hypot(X[i] - prevX[i], Z[i] - prevZ[i]) > 0.5) jumps++;
        prevVis[i] = v ? 1 : 0; prevX[i] = X[i]; prevZ[i] = Z[i];
        if (!r.s.alive(i) || !(F[i] & AGENT_FLAG.ambient)) continue;
        if (A[i] === ACT_ORDER.indexOf('walk') && SP[i] < 0.05) { stuckT[i] += 1 / 30; if (stuckT[i] > 3) { stuck++; stuckT[i] = -1e9; } } else if (stuckT[i] > 0) stuckT[i] = 0;
        if (!v || !seated) continue;
        if (onBridge(X[i], Z[i]) && Z[i] > 15 && Z[i] < 26) bridge++;
        if (Z[i] > 14.3 && Z[i] < 28.3 && !onBridge(X[i], Z[i])) road++;
        if (X[i] > BUFE.x0 + 0.6 && X[i] < BUFE.x1 - 0.6 && Z[i] > BUFE.z0 + 0.6 && Z[i] < BUFE.z1 - 0.6) bufe++;   // ızgara köşesi payı (oyunda tam duvar yüzü: move solids)
        if (!seated.has(i) && !r.nav.walkable({ x: X[i], z: Z[i] }) && !onBridge(X[i], Z[i])) { wallT[i] += 10 / 30; if (wallT[i] > 1.5) { wall++; wallT[i] = -1e9; } } else if (wallT[i] > 0) wallT[i] = 0;
      }
    });
    expect(bridge).toBeGreaterThan(0);
    expect({ road, bufe, jumps, stuck }).toEqual({ road: 0, bufe: 0, jumps: 0, stuck: 0 });
    // ızgara 0,5 m: banka oturma adımı / köşe dönüşü bir an dolu hücreye taşabilir; 1,5 sn'den uzun duvar içinde kalan yok
    expect(wall).toBe(0);
  }, 180000);

  it('saate göre yoğunluk ve tip dağılımı (content hours)', () => {
    for (const h of [9, 13, 18, 22, 26]) {
      const r = sokakRun(3, h);
      r.tick(30 * 40);
      const rows = r.amb.rows().filter(w => !w.inside);
      const want = SOKAK_HAVUZ * (SOKAK_YOGUNLUK.find(([hh]) => hh >= h)?.[1] ?? 0.1);
      expect(Math.abs(rows.length - want)).toBeLessThanOrEqual(Math.max(4, want * 0.35));
      const plain = rows.filter(w => w.rol < 0);
      const ok = plain.filter(w => inHours(CITIZENS[r.s.u8('typeId')[w.slot]].hours, h)).length;
      expect(ok / Math.max(1, plain.length), 'saat ' + h).toBeGreaterThanOrEqual(0.75);
      expect(plain.every(w => CITIZENS[r.s.u8('typeId')[w.slot]].id !== 'kestaneci')).toBe(true);
    }
  }, 120000);

  it('LOD: yakındakiler A, uzaktakiler çizilmez; müşteriye önce içerideki verilir', () => {
    const r = sokakRun(8, 22, { x: 0, z: 8 });
    r.tick(30 * 30);
    const X = r.s.f32('x'), Z = r.s.f32('z'), F = r.s.u16('flags'), L = r.s.u8('lod');
    for (const w of r.amb.rows()) {
      if (w.inside) { expect(F[w.slot] & AGENT_FLAG.visible).toBe(0); continue; }
      const d = Math.hypot(X[w.slot], Z[w.slot] - 8);
      if (d > 53) expect(F[w.slot] & AGENT_FLAG.visible).toBe(0);
      if (d < 14) { expect(L[w.slot]).toBe(AGENT_LOD.A); expect(F[w.slot] & AGENT_FLAG.visible).toBeTruthy(); }
    }
    const inside = new Set(r.amb.rows().filter(w => w.inside).map(w => w.slot));
    expect(inside.size).toBeGreaterThan(0);
    const slot = r.amb.recruit((id) => id === 'plaza');
    expect(inside.has(slot)).toBe(true);
    expect(CITIZENS[r.s.u8('typeId')[slot]].id).toBe('plaza');
    r.amb.release(slot);
    r.tick(30);
  }, 60000);
});
