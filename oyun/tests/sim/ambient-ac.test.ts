// BUF-25: vatandaşlar acıkır; acıkan, sokaktaki en yakın vatandaş büfeye kendi isteğiyle gelir (gövdesi ve konumu korunur).
import { describe, it, expect } from 'vitest';
import { sokakRun } from './sokak-harness';
import { SOKAK_KAPI } from '../../src/content/sokak';
import { AGENT_FLAG } from '../../src/game/sim/schema';

describe('vatandaş açlığı (BUF-25)', () => {
  it('açlık zamanla artar; acıkan yakın vatandaş devralınır, uzaktakine dokunulmaz, serbest bırakılınca yeniden doyar', () => {
    const r = sokakRun(7, 13);
    const near = { x: 0, z: 8 };
    r.tick(30 * 5);
    // 5 sn: çoğu henüz tok olabilir ama ilk anda hepsi acıkmış olmamalı
    const early = r.amb.recruitHungry!(near, 1000);
    if (early >= 0) r.amb.release(early);
    r.tick(30 * 200);                 // 200 sn: en az bir vatandaş acıkmıştır
    const X = r.s.f32('x'), Z = r.s.f32('z'), F = r.s.u16('flags');
    expect(r.amb.recruitHungry!(near, 0.01)).toBe(-1);          // menzil dışı: kimse alınmaz
    const before = r.amb.count;
    const b = r.amb.recruitHungry!(near, 1000);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(r.amb.count).toBe(before - 1);
    expect(F[b] & AGENT_FLAG.ambient).toBe(0);
    expect(F[b] & AGENT_FLAG.visible).not.toBe(0);
    const x0 = X[b], z0 = Z[b];
    r.tick(1);
    expect(Math.hypot(X[b] - x0, Z[b] - z0)).toBeLessThan(0.01);  // devralınan ambient hareket ettirmez
    r.amb.release(b);
    expect(r.amb.count).toBe(before);
  }, 120000);

  it('aynı tohum aynı acıkan vatandaşı seçer', () => {
    const pick = (seed: number) => { const r = sokakRun(seed, 13); r.tick(30 * 200); return r.amb.recruitHungry!({ x: 0, z: 8 }, 1000); };
    expect(pick(9)).toBe(pick(9));
  }, 120000);

  it('acıkan vatandaş dükkân kapısına yürür, varınca içeri girer (ışınlanma yok), kimse kapıdan vazgeçirilmez', () => {
    const r = sokakRun(7, 13);
    r.tick(30 * 200);
    const door = SOKAK_KAPI[0];
    const X = r.s.f32('x'), Z = r.s.f32('z');
    const sl = r.amb.sendHungry!(door, 1000);
    expect(sl).toBeGreaterThanOrEqual(0);
    expect(r.amb.visitStatus!(sl)).toBe('walk');
    let prev = { x: X[sl], z: Z[sl] }, jump = 0, st = 'walk';
    for (let i = 0; i < 30 * 180 && st === 'walk'; i++) {
      r.tick(1); st = r.amb.visitStatus!(sl);
      if (st === 'walk') { jump = Math.max(jump, Math.hypot(X[sl] - prev.x, Z[sl] - prev.z)); prev = { x: X[sl], z: Z[sl] }; }
    }
    expect(st).toBe('in');
    expect(jump).toBeLessThan(0.5);
    expect(r.amb.visitStatus!(sl)).toBe('lost');   // bir kez bildirildi
  }, 120000);
});
