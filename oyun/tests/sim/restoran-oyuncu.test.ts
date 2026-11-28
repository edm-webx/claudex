// 2026-11-22 (sahibi: "içine girdiğimizde masalara gidebilicez, mutfakta bişeyler hazırlayıp tepsiye alıp servis edebilicez, kasaya bakabilicez"):
// aşama 6 restoranında oyuncunun uçtan uca turu, tam sim: mutfakta istasyon başında pişir (tabak tepside), aşçının pass'a koyduğu tabağı
// pass'ın salon tarafından tepsiye al (pass.al.<yer>), iki masaya yürü servis et, müşteri yer ve öder, para kasada birikir, kasadan topla.
import { describe, it, expect } from 'vitest';
import { mutfakDunya, mutfakStand, passGarsonNokta } from '../../src/content/ic-mekan';
import { RESTORAN_ASAMA } from '../../src/content/prefabs/iskele/layout';
import { kur } from './garson-yardimci';

describe('restoran: oyuncu pişirir, tepsiye alır, servis eder, kasaya bakar', () => {
  function hazir() {
    const k = kur(4);
    k.sim.command({ kind: 'force', what: 'stage', value: RESTORAN_ASAMA });
    k.step(0.5);
    return k;
  }
  it('pass.al: biletin beklediği tabak pass\'tan tepsiye alınır; kimsenin istemediği ya da garsonun ayırdığı alınmaz', () => {
    const k = hazir(), { sim, api, r } = k;
    expect(sim.interactions.get('pass.al.on')).toBeTruthy();
    expect(sim.interactions.get('pass.al.W')).toBeTruthy();   // aşama 6: kahvaltı salonunun pass'ı
    expect(sim.interactions.get('pass.al.E')).toBeUndefined();   // balık lokantası aşama 7
    k.musteri(0, { tost: 1 }); k.step(6);
    expect(api.view().tickets.length).toBe(1);
    // aynı yiyecekten 2 tabak pass'ta: biri bilete, öbürü sahipsiz
    const hat = api.hat!;
    const a = { type: 'tost', tier: 1 }, b = { type: 'tost', tier: 1 };
    expect(hat.geriKoy(a as never, 'on')).toBe(true); expect(hat.geriKoy(b as never, 'on')).toBe(true);
    const at = passGarsonNokta('on'); sim.command({ kind: 'teleport', x: at.x, z: at.z });
    k.step(2);
    expect(r.carry.length).toBe(1); expect(r.carry[0].type).toBe('tost');   // yalnız biletin istediği kadar
    expect(hat.passCount('tost', 'on')).toBe(1);
  });

  it('tam tur: pişir + pass\'tan al, iki masaya servis, müşteriler öder, kasadan para toplanır', () => {
    const k = hazir(), { sim, api, r, S } = k;
    const izgara = sim.interactions.get('mutfak.izgara');
    expect(izgara, 'aşama 6 mutfağında ızgara istasyonu').toBeTruthy();
    const c0 = k.musteri(0, { tost: 1 }), c1 = k.musteri(1, { tost: 1 });
    k.step(6);
    expect(api.view().tickets.length).toBe(2);
    // 1) oyuncu ızgaranın başında durur: tost pişer, tabak tepside
    const p = mutfakDunya(mutfakStand('izgara')); sim.command({ kind: 'teleport', x: p.x, z: p.z });
    k.step(1); expect(api.hat!.ist(-1)).toBe('izgara');
    // aşçı (gerçek yürüyen çalışan) şimdi gelir: ikinci masanın tostunu oyuncudan sonra pişirip pass'a koyar
    S.workers.push({ id: 7101, name: 'Deneme Aşçı', role: 'asci', xp: 0, rank: 0, morale: 70, traits: ['hamarat'], trait: 'hamarat', rarity: 'gri' });
    let pisti = false; k.step(40, () => (pisti = r.carry.length >= 1));
    expect(pisti, 'oyuncu ızgarada tost pişirdi').toBe(true);
    // 2) aşçının tostu pass'a düşer; oyuncu pass'ın salon tarafından tepsiye alır (tepside 2 tabak)
    sim.command({ kind: 'teleport', x: 4.5, z: -2.5 });
    let pasta = false; k.step(60, () => (pasta = api.hat!.passCount('tost') >= 1));
    expect(pasta, 'aşçı tostu pass\'a koydu').toBe(true);
    const yer = (['on', 'W'] as const).find(y => api.hat!.passCount('tost', y) > 0)!;
    const at = passGarsonNokta(yer); sim.command({ kind: 'teleport', x: at.x, z: at.z });
    k.step(2);
    expect(r.carry.filter((i: { type: string }) => i.type === 'tost').length).toBe(2);
    // 3) iki masaya servis
    for (const t of [0, 1]) { const tb = r.layout.tables[t]; sim.command({ kind: 'teleport', x: tb.x, z: tb.z }); k.step(2); }
    expect(r.carry.length).toBe(0); expect(api.view().tickets.length).toBe(0);
    expect(c0.state).toBe('eat'); expect(c1.state).toBe('eat');
    // 4) yer, öder (garson yok: kendisi öder), para kasaya
    sim.command({ kind: 'teleport', x: 4.5, z: -2.5 });
    const k0 = r.kasa.length;
    k.step(120, () => r.kasa.length > k0 && c0.state === 'leave' && c1.state === 'leave');
    expect(r.kasa.length).toBeGreaterThan(k0);
    // 5) kasaya bak: para cebe
    const m0 = S.money, kp = r.layout.kasa.pile; sim.command({ kind: 'teleport', x: kp.x, z: kp.z });
    k.step(3);
    expect(S.money).toBeGreaterThan(m0); expect(r.kasa.length).toBe(0);
  });
});
