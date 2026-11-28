// 2026-11-27 sahibi: vapur geri geldi ama sınırlı. Sürekli gelip gider, düdük çalar, yanaşır ve yalnız vatandaş indirir
// (potansiyel müşteri). Oyuncunun vapurla HİÇBİR etkileşimi yok: pencere açılmaz, güverte koşusu başlamaz, vapur içi kartı yok.
// Ekonomi: dalga anı ve büyüklüğü eski kalabalık dalgasıyla aynı (bantlar gevşemez); gece 00:30-06:00 seyrek.
import { describe, it, expect } from 'vitest';
import { played, events } from './m1-helpers';
import { denizApi } from '../../src/game/sim/deniz';
import { hourOf } from '../../src/game/sim/util';
import { FERRY_DOOR, FERRY_T, GECE_SEYREK, VAPUR_TELAFI, ferryGap } from '../../src/game/sim/ferry';

describe('vapur gelip gider, vatandaş indirir', () => {
  it('ilk düdük 104. sn, yanaşma 114. sn (eski dalga anından 6 sn önce); evreler sırayla döner ve inenler vapur kapısından yürür', () => {
    const sim = played(1);
    sim.state.tut.firstCustomer = 1;
    const f = () => sim.rules.rt.ferry;
    sim.step(103);
    expect(f().state).toBe('away');
    expect(events(sim, 'ferryHorn').length).toBe(0);
    sim.step(2);
    expect(f().state).toBe('arriving');
    expect(events(sim, 'ferryHorn').length).toBe(1);
    const c0 = sim.rules.rt.customers.length;
    sim.step(10);
    expect(f().state).toBe('docked');
    expect(events(sim, 'ferryDock').length).toBe(1);
    sim.step(0.2);
    const yeni = sim.rules.rt.customers.slice(c0).filter(c => c.hiz === VAPUR_TELAFI.hiz);   // vapur yolcuları (aynı anda gelen yürüyenler hariç)
    expect(yeni.length).toBeGreaterThan(0);
    // ilk yolcu kapıdan iner (birkaç adım yürümüş olabilir)
    expect(Math.hypot(yeni[0].x - FERRY_DOOR.x, yeni[0].z - FERRY_DOOR.z)).toBeLessThan(4);
    sim.step(FERRY_T.docked + 1.3);
    expect(f().state).toBe('leaving');
    expect(events(sim, 'ferryLeave').length).toBe(1);
    sim.step(FERRY_T.leaving + 0.5);
    expect(f().state).toBe('away');
    expect(f().next).toBeGreaterThan(sim.state.playT);
  });

  it('vapur sürekli gelir: 20 dakikada birçok sefer, her seferde düdük ve yanaşma', () => {
    const sim = played(2);
    sim.state.tut.firstCustomer = 1;
    sim.step(1200);
    const n = events(sim, 'ferryDock').length;
    expect(n).toBeGreaterThanOrEqual(5);
    expect(events(sim, 'ferryHorn').length).toBeGreaterThanOrEqual(n);
  });
});

describe('oyuncu etkileşimi yok', () => {
  it('eski kayıtta pencere alınmış olsa da vapur yanaşınca pencere açılmaz', () => {
    const sim = played(3);
    for (const k of ['cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'isbul']) sim.command({ kind: 'force', what: 'unlock', value: k });
    sim.state.owned.pencere = 1 as never;
    sim.command({ kind: 'force', what: 'ferry' });
    sim.step(60);
    expect(events(sim, 'ferryDock').length).toBe(1);
    expect(events(sim, 'windowOpen').length).toBe(0);
    expect(!!sim.rules.rt.window?.open).toBe(false);
  });

  it('elinde ürünle vapur kapısında dursan da güverte koşusu başlamaz; deniz kartı vapuru göstermez', () => {
    const sim = played(4);
    sim.state.stage = 3 as never;
    sim.command({ kind: 'force', what: 'ferry' });
    sim.step(10.5);
    expect(sim.rules.rt.ferry.state).toBe('docked');
    (sim.rules.rt as unknown as { carry: unknown[] }).carry.push({ type: 'cay', tier: 1 });
    sim.step(5);
    const d = denizApi(sim.rules)!;
    expect(d.view().run).toBeNull();
    expect(d.view().canRun).toBe(false);
    expect(d.view().docked).toBe(false);
    expect(events(sim, 'denizRun').length).toBe(0);
  });
});

describe('gece seyrek', () => {
  it('00:30-06:00 arası yanaşmada bir sonraki aralık uzar; gündüz aralığı bant içinde', () => {
    const sim = played(5);
    sim.state.tut.firstCustomer = 1;
    const docks: { t: number; h: number; gap: number }[] = [];
    let last = events(sim, 'ferryDock').length;
    for (let i = 0; i < 480 * 3 / 2; i++) {
      sim.step(2);
      const n = events(sim, 'ferryDock').length;
      if (n > last) { last = n; docks.push({ t: sim.state.playT, h: hourOf(sim.state.dayT), gap: sim.rules.rt.ferry.next - sim.state.playT }); }
    }
    const [lo, hi] = ferryGap(sim.state.stage);
    for (const d of docks) {
      const gece = d.h >= GECE_SEYREK.from && d.h < GECE_SEYREK.to;
      expect(d.gap).toBeLessThanOrEqual(hi * (gece ? GECE_SEYREK.gapX : 1) + 2.5);
      expect(d.gap).toBeGreaterThanOrEqual(lo * (gece ? GECE_SEYREK.gapX : 1) - 2.5);
    }
    expect(docks.length).toBeGreaterThan(3);
  });
});
