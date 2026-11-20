// BUF-15: paket servis. Aşama 5+, kurye işe alınmadan paket bileti açılmaz; mutfak pişirir, pass'a iner, GERÇEK kurye (bisiklet) alır, adrese gider,
// döner, gelir dönüşte kasaya yazılır. Yorum / yıldız / şikayet yok. Deterministik: sabit tohum, rastgele müşteri akışı kapalı.
import { describe, it, expect } from 'vitest';
import { kur, evs, type Kurulum } from './garson-yardimci';
import { ROLES } from '../../src/content/ranks';
import { mutfakSlot } from '../../src/content/mutfak';
import { teslimatApi } from '../../src/game/sim/kurye';

let wid = 8100;
const isci = (k: Kurulum, role: string) => { const w = { id: wid++, name: role + wid, role, xp: 0, rank: 0, morale: 70, traits: ['hamarat'], trait: 'hamarat' }; k.S.workers.push(w); return w; };
const aktor = (k: Kurulum, id: number) => k.r.agents.registry.list.find((a: { key: string; kind: string }) => a.kind === 'worker' && a.key === String(id));
function hazir(kuryeVar = true) {
  const k = kur(); k.sim.command({ kind: 'force', what: 'stage', value: 5 });
  const asci = isci(k, 'asci'); const ky = kuryeVar ? isci(k, 'kurye') : null;
  k.step(12);
  return { k, asci, ky, api: teslimatApi(k.sim.rules)! };
}

describe('BUF-15 kurye ve paket servis', () => {
  it('kurye rolü ROLES\'ta, kadro aşama 5\'te açılır', () => {
    expect(ROLES.kurye.label).toBe('Kurye'); expect(ROLES.kurye.mutfak).toBe(false);
    expect(mutfakSlot('kurye', 4)).toBe(0); expect(mutfakSlot('kurye', 5)).toBe(1);
  });
  it('kurye işe alınmadan (ya da aşama 5 öncesi) paket bileti açılmaz', () => {
    const { k, api } = hazir(false);
    expect(api.yeni()).toBeNull(); k.step(400); expect(api.view().acik).toBe(0); expect(k.S.stats.paketSiparis || 0).toBe(0);
    const k2 = kur(); isci(k2, 'asci'); isci(k2, 'kurye'); k2.step(5);
    expect(teslimatApi(k2.sim.rules)!.yeni()).toBeNull();   // aşama 3
  });
  it('paket bileti -> pişer -> kurye pass\'tan alır -> bisikletle adrese gider -> döner -> gelir dönüşte kasaya yatar', () => {
    const { k, ky, api } = hazir();
    const t = api.yeni(); expect(t).toBeTruthy();
    const ang0 = k.S.today.angry, servis0 = (k.S.zones.restoran as { servis?: number } | undefined)?.servis, kasa0 = k.r.kasa.reduce((s: number, x: { value: number }) => s + x.value, 0);
    const a = aktor(k, ky!.id); const home = { x: a.x, z: a.z };
    let bike = false, away = 0, yolda = false, paraYolda = 0, gelirOnce = false;
    k.step(200, () => {
      if (a.fx === 'bike') bike = true;
      away = Math.max(away, Math.hypot(a.x - home.x, a.z - home.z));
      if (api.view().yolda) { yolda = true; paraYolda = k.r.kasa.reduce((s: number, x: { value: number }) => s + x.value, 0); if (paraYolda > kasa0 + 1e-6) gelirOnce = true; }
      return (k.S.stats.paketTeslim || 0) >= 1;
    });
    expect(yolda).toBe(true); expect(bike).toBe(true); expect(away).toBeGreaterThan(15);
    expect(gelirOnce).toBe(false);                                  // gelir yolda değil, dönüşte
    expect(k.S.stats.paketTeslim).toBe(1);
    const kasa1 = k.r.kasa.reduce((s: number, x: { value: number }) => s + x.value, 0);
    expect(kasa1).toBeGreaterThan(kasa0);
    expect(evs(k.sim, 'paketTeslim').length).toBe(1);
    expect(Math.hypot(a.x - home.x, a.z - home.z)).toBeLessThan(6);   // geri döndü
    expect(k.S.today.angry).toBe(ang0);
    expect((k.S.zones.restoran as { servis?: number } | undefined)?.servis).toBe(servis0);   // yıldız / şikayet yok
  });
  it('kurye teslimatta işten çıkarılırsa bilet yeniden açılır (ceza yok, takılı iş yok)', () => {
    const { k, ky, api } = hazir();
    api.yeni();
    k.step(200, () => api.view().yolda > 0);
    expect(api.view().yolda).toBe(1);
    k.S.workers.splice(k.S.workers.indexOf(ky!), 1);
    k.step(2);
    expect(api.view().yolda).toBe(0); expect(api.debug().biletler[0]?.kurye || 0).toBe(0);
    expect(k.S.stats.paketTeslim || 0).toBe(0);
  });
});
