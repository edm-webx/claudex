// BUF-05: mutfak hattı. Her yiyecek kendi istasyonunda pişer, aşçı en yakın boş istasyona yürür (uzmanlık yok, bekle-al), ikinci
// ocak/ızgara hattı iki ve fazla aşçıyla devreye girer, tabak tepsiden (komi ya da aşçı taşır) pass rafına düşer, garson pass'tan alır,
// şef hızı tek yerden sayılır. Deterministik: sabit tohum, rastgelelik yok.
import { CITIZENS } from '../../src/content/citizens';
import { describe, it, expect } from 'vitest';
import { played, events } from './m1-helpers';
import { makeSandbox, addWorker, stubHat } from './agents-harness';
import { restoranApi } from '../../src/game/sim/restoran';
import { installMutfakHat, type HatTicket } from '../../src/game/sim/mutfak-hat';
import { MUTFAK_ISTASYON, PASS_KAP, mutfakEsya, mutfakEtki, pisirIstasyonu, pisirmeSuresi, sefHizi } from '../../src/content/mutfak';
import { DISHES, calismaIstasyonu, hazirlikOf } from '../../src/content/yemek-menu';
import { PRODUCT_IDS } from '../../src/content/products';
import { IC_BY_ID, icLayout, icDim, mutfakRota, mutfakStand, mutfakDunya, mutfakKoridor, MUTFAK_NOKTA, MUTFAK_YER } from '../../src/content/ic-mekan';

const PISIR10 = mutfakEsya(10).filter(pisirIstasyonu);

/** a bare kitchen line over a fake kernel: the test owns the tickets */
function hatKur(stage: number, workers: { id: number; role: string; xp?: number }[], tickets: HatTicket[]) {
  const ev: [string, Record<string, unknown>][] = [];
  const K = { state: { stage, workers, tiers: {} }, rt: { counter: { doner: [], cay: [], ayran: [], simit: [], tost: [], gazoz: [] } }, logEv: (n: string, d: Record<string, unknown>) => ev.push([n, d]) } as never;
  const hat = installMutfakHat(K, { tickets: () => tickets, jobs: () => 0 });
  return { hat, ev, K: K as { rt: { counter: Record<string, unknown[]> } } };
}
const asci = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 100 + i, role: 'asci', xp: 0 }));
/** one full plate trip: claim -> ready -> carry -> pass */
function tabakla(hat: ReturnType<typeof hatKur>['hat'], wid: number): string | null {
  const p = hat.claim(wid); if (!p) return null;
  hat.ready(wid); hat.tasiClaim(wid, { kendi: true }); hat.tasiAl(wid); hat.done(wid);
  return p;
}

describe('istasyon seçimi (içerik)', () => {
  it('aşama 3 yedek ocak, mutfak büyüdükçe kendi istasyonu', () => {
    expect(calismaIstasyonu('tost', 3)).toBe('ocak'); expect(calismaIstasyonu('tost', 4)).toBe('izgara');
    expect(calismaIstasyonu('doner', 5)).toBe('ocak'); expect(calismaIstasyonu('doner', 6)).toBe('doner');
    expect(calismaIstasyonu('simit', 7)).toBe('ocak'); expect(calismaIstasyonu('simit', 8)).toBe('tas_firin');
    expect(calismaIstasyonu('izgara_kofte', 9)).toBe('izgara2'); expect(calismaIstasyonu('hamsi_tava', 7)).toBe('fritoz');
  });
  it('her yemek ve ürün bir pişirme istasyonunda pişer; soğuk oda ve bulaşık asla (soğuk oda yalnız görsel)', () => {
    for (let s = 3; s <= 10; s++) for (const f of [...PRODUCT_IDS, ...DISHES.filter(d => d.asama <= s).map(d => d.id)]) {
      const ist = calismaIstasyonu(f, s);
      expect(pisirIstasyonu(ist), f + '@' + s).toBe(true); expect(mutfakEsya(s)).toContain(ist);
      expect(['soguk_oda', 'bulasik']).not.toContain(ist);
    }
    expect(MUTFAK_ISTASYON.find(i => i.id === 'soguk_oda')!.islev).toBe('gorsel');
    expect(MUTFAK_ISTASYON.find(i => i.id === 'soguk_oda')!.ad).not.toMatch(/depo/i);
    // 15 istasyondan 13'ü iş alır (hepsine en az bir yiyecek bağlı), soğuk oda ve bulaşık hattın parçası değil
    expect(mutfakEsya(10).length).toBe(15); expect(PISIR10.length).toBe(13);
    for (const ist of PISIR10) expect([...PRODUCT_IDS, ...DISHES.map(d => d.id)].some(f => calismaIstasyonu(f, 10) === ist || (ist.endsWith('2') && calismaIstasyonu(f, 10) === ist.slice(0, -1))), ist).toBe(true);
  });
  it('hazırlık süresi DishDef.hazirlik', () => { for (const d of DISHES) expect(hazirlikOf(d.id)).toBe(d.hazirlik); });
  it('mutfak rotaları hazırlık tezgâhlarının (solid) içinden geçmez', () => {
    const solids = icLayout(IC_BY_ID.mutfak).filter(i => i.solid).map(i => ({ u0: i.u - i.w / 2 - 0.2, u1: i.u + i.w / 2 + 0.2, v0: i.v - i.d / 2 - 0.2, v1: i.v + i.d / 2 + 0.2 }));
    const D = icDim(IC_BY_ID.mutfak).D, k = mutfakKoridor();
    const pts: [number, number][] = [...Object.keys(MUTFAK_YER).map(mutfakStand), MUTFAK_NOKTA.passAsci, MUTFAK_NOKTA.passGarson, ...MUTFAK_NOKTA.sefDurak, ...MUTFAK_NOKTA.komiDurak, [0, D / 2 - 0.4], [0, D / 2 + 0.8], [-6.3, k.arka]];
    for (const a of pts) for (const b of pts) {
      let cur = a; for (const nx of mutfakRota(a, b)) {
        const n = Math.max(1, Math.ceil(Math.hypot(nx[0] - cur[0], nx[1] - cur[1]) / 0.1));
        for (let i = 0; i <= n; i++) { const u = cur[0] + (nx[0] - cur[0]) * i / n, v = cur[1] + (nx[1] - cur[1]) * i / n; for (const r of solids) expect(u > r.u0 && u < r.u1 && v > r.v0 && v < r.v1, `${a}->${b} @${u.toFixed(2)},${v.toFixed(2)}`).toBe(false); }
        cur = nx;
      }
      expect(cur[0]).toBeCloseTo(b[0], 6); expect(cur[1]).toBeCloseTo(b[1], 6);
    }
  });
});

describe('mutfak hattı (sim/mutfak-hat.ts)', () => {
  it('FIFO: ilk claim en eski biletin kalemini verir', () => {
    const t5 = { no: 5, table: 0, want: { tost: 1 } }, t6 = { no: 6, table: 1, want: { gozleme: 1 } };
    const { hat } = hatKur(10, asci(2), [t5, t6]);
    expect(hat.claim(100)).toBe('tost'); expect(hat.durum().cooking[0].no).toBe(5);
    expect(hat.claim(101)).toBe('gozleme'); expect(hat.durum().cooking[1].no).toBe(6);
  });
  it('ikinci ocak/ızgara hattı: iki aşçıyla ikisi birden, tek aşçıyla yalnız ana hat; bir istasyonda tek iş', () => {
    const tk = [{ no: 1, table: 0, want: { izgara_kofte: 2, beyti_sarma: 2 } }];
    const a = hatKur(9, asci(2), tk);
    expect(a.hat.claim(100)).toBe('izgara_kofte'); expect(a.hat.claim(101)).toBe('izgara_kofte');
    const v = a.hat.view().ist; expect(v.izgara?.d).toBe('pisiyor'); expect(v.izgara2?.d).toBe('pisiyor');
    const b = hatKur(9, asci(1), tk);
    expect(b.hat.claim(100)).toBe('izgara_kofte'); expect(b.hat.ist(100)).toBe('izgara');
    expect(b.hat.claim(101)).toBe('beyti_sarma'); expect(b.hat.ist(101)).toBe('ocak');   // izgara dolu: sıradaki kaleme geçer, ikinci hat açılmaz
    expect(b.hat.claim(102)).toBeNull();
  });
  it('tepsi istasyonu tutar, pass rafı görünür, her tabakta tek zil, PASS_KAP üstü olmaz', () => {
    const { hat, ev } = hatKur(10, asci(1), [{ no: 1, table: 2, want: { doner: 20 } }]);
    expect(hat.claim(100)).toBe('doner'); hat.ready(100);
    expect(hat.view().ist.doner).toEqual({ d: 'hazir', p: 'doner' });
    expect(hat.claim(101)).toBeNull();   // döner istasyonu tepsi alınana kadar dolu
    hat.tasiClaim(100, { kendi: true }); expect(hat.tasiAl(100)?.type).toBe('doner'); expect(hat.done(100)).toBe(true);
    expect(hat.view().pass).toEqual(['doner']); expect(ev.filter(e => e[0] === 'passBell').length).toBe(1);
    let n = 1; while (tabakla(hat, 100)) n++;
    expect(n).toBe(PASS_KAP); expect(hat.passCount()).toBe(PASS_KAP); expect(ev.filter(e => e[0] === 'passBell').length).toBe(PASS_KAP);
    expect(hat.passTake('doner')?.type).toBe('doner'); expect(hat.passCount()).toBe(PASS_KAP - 1);
  });
  it('gerçek yiyecek akar: yemek tabağı kendi adıyla (taşıyıcı ürün yok), tezgâh stoğu ihtiyaçtan düşülür', () => {
    const { hat, K } = hatKur(7, asci(1), [{ no: 1, table: 0, want: { hamsi_tava: 1, cay: 1 } }]);
    expect(hat.claim(100)).toBe('hamsi_tava'); expect(hat.ist(100)).toBe('fritoz');
    hat.ready(100); hat.tasiClaim(100); const p = hat.tasiAl(100); expect(p?.type).toBe('hamsi_tava');
    K.rt.counter.cay.push({ type: 'cay', tier: 1 });   // tezgâhta hazır çay var: gereksiz pişirme yok
    expect(hat.claim(101)).toBeNull();
  });
  it('stok yok: bilet yokken kimse pişirmez; bileti düşen tabak 30 sn sonra sessizce silinir, tezgâha eklenmez', () => {
    const tk: HatTicket[] = [];
    const { hat, K } = hatKur(10, asci(1), tk);
    for (let i = 0; i < 1200; i++) { expect(hat.claim(100)).toBeNull(); hat.update(0.1); }
    expect(hat.passCount()).toBe(0); expect(hat.durum().tepsi.length).toBe(0);
    tk.push({ no: 3, table: 0, want: { menemen: 1 } });
    tabakla(hat, 100); expect(hat.passCount()).toBe(1);
    tk.length = 0;   // müşteri gitti
    for (let i = 0; i < 290; i++) hat.update(0.1);
    expect(hat.passCount()).toBe(1);
    for (let i = 0; i < 20; i++) hat.update(0.1);
    expect(hat.passCount()).toBe(0); expect(hat.durum().sahipsiz).toBe(1);
    expect(Object.values(K.rt.counter).every(b => b.length === 0)).toBe(true);
  });
  it('işçi giderse ayırdığı istasyon ve tabak bırakılır (takılı iş yok)', () => {
    const { hat } = hatKur(10, asci(1), [{ no: 1, table: 0, want: { kunefe: 2 } }]);
    hat.claim(100); expect(hat.ist(100)).toBe('tatli');
    hat.drop(100); expect(hat.view().ist.tatli).toBeUndefined();
    expect(hat.claim(101)).toBe('kunefe');
  });
});

describe('şef bonusu tek sayılır', () => {
  it('sefHizi tek kaynak, mutfakEtki şef içermez, pişirme süresi oranı 1.20', () => {
    expect(sefHizi([{ role: 'sef', xp: 0 }])).toBeCloseTo(0.2, 6); expect(sefHizi([{ role: 'sef', xp: 25000 }])).toBeCloseTo(0.44, 6);
    expect(sefHizi([{ role: 'sef', xp: 25000 }, { role: 'sef', xp: 25000 }])).toBe(0.6);
    expect(mutfakEtki([{ role: 'sef', xp: 25000 }]).hiz).toBe(0);
    const S0 = pisirmeSuresi(20, 0, []), S1 = pisirmeSuresi(20, 0, [{ role: 'sef', xp: 0 }]);
    expect(S0 / S1).toBeGreaterThan(1.2 * 0.97); expect(S0 / S1).toBeLessThan(1.2 * 1.03);
    // hattın süresi (aşçının beklediği) aynı formül: şef bir kez
    const w = [{ id: 100, role: 'asci', xp: 0 }], tk = [{ no: 1, table: 0, want: { menemen: 1 } }];
    const a = hatKur(10, w, tk); a.hat.claim(100);
    const b = hatKur(10, [...w, { id: 200, role: 'sef', xp: 0 }], tk); b.hat.claim(100);
    expect(a.hat.sure(100)).toBeCloseTo(hazirlikOf('menemen'), 6); expect(a.hat.sure(100) / b.hat.sure(100)).toBeCloseTo(1.2, 6);
  });
});

describe('aşçı ve komi gerçek yürüyen ajan (agents harness)', () => {
  it('her pişirme istasyonuna aşçı gider, tabak pass rafına düşer', () => {
    const sb = makeSandbox(3); sb.step(0.2);
    const hat = stubHat(sb, PISIR10.map(ist => ({ ist, p: 'doner' })));
    addWorker(sb, 'asci', 'hamarat');
    const yakin: Record<string, number> = {};
    for (let i = 0; i < 30 * 200 && hat.passed.length < PISIR10.length; i++) {
      sb.step(1 / 30);
      const r = sb.h.workers.rows()[0];
      if (r.ist && r.state === 'kCook') { const p = mutfakDunya(mutfakStand(r.ist)); yakin[r.ist] = Math.min(yakin[r.ist] ?? 9, Math.hypot(r.x - p.x, r.z - p.z)); }
    }
    expect(hat.passed.length).toBe(PISIR10.length);
    for (const ist of PISIR10) expect(yakin[ist], ist).toBeLessThanOrEqual(0.3);
  });
  it('komi taşır, aşçı istasyonunda kalıp yeni iş alır; komi yokken aşçı kendisi taşır', () => {
    const run = (komi: boolean) => {
      const sb = makeSandbox(4); sb.step(0.2);
      const hat = stubHat(sb, [{ ist: 'ocak', p: 'menemen' }, { ist: 'ocak', p: 'menemen' }]);
      const c = addWorker(sb, 'asci', 'hamarat'), k = komi ? addWorker(sb, 'komi', 'hamarat') : null;
      const claimAt: { x: number; z: number }[] = [], passAt: { wid: number; x: number; z: number }[] = [];
      const cl = sb.host.kitchenClaim!, ps = sb.host.kitchenPass!;
      sb.host.kitchenClaim = (wid, o) => { const p = cl(wid, o); if (p && o?.from) claimAt.push({ ...o.from }); return p; };
      sb.host.kitchenPass = (wid) => { const r = sb.h.workers.rows().find(x => x.id === wid)!; const ok = ps(wid); if (ok) passAt.push({ wid, x: r.x, z: r.z }); return ok; };
      sb.step(60);
      return { hat, claimAt, passAt, c, k };
    };
    const a = run(true), st = mutfakDunya(mutfakStand('ocak')), pa = mutfakDunya(MUTFAK_NOKTA.passAsci);
    expect(a.hat.passed.length).toBe(2);
    expect(a.passAt[0].wid).toBe(a.k!.id);   // tabağı komi taşıdı (komi 6 sn içinde gelemezse boştaki aşçı alır: takılma yok)
    expect(Math.hypot(a.claimAt[1].x - st.x, a.claimAt[1].z - st.z)).toBeLessThanOrEqual(0.5);   // aşçı istasyondan ayrılmadan yeni işi aldı
    for (const p of a.passAt) expect(Math.hypot(p.x - pa.x, p.z - pa.z)).toBeLessThanOrEqual(0.4);
    const b = run(false);
    expect(b.hat.passed.length).toBe(2);
    expect(b.passAt.every(p => p.wid === b.c.id)).toBe(true);
    for (const p of b.passAt) expect(Math.hypot(p.x - pa.x, p.z - pa.z)).toBeLessThanOrEqual(0.4);
  });
});

describe('aşama 10 tam mutfak (gerçek sim, 30 dk)', () => {
  it('15 istasyon: 13 pişirme istasyonunun hepsine iş gider, takılı iş ve ölü kilit yok, garson pass\'tan servis eder', () => {
    const sim = played(7) as any;
    for (let i = 0; i < 60; i++) sim.step(0.1);
    sim.command({ kind: 'force', what: 'money', value: 2_000_000_000 });
    for (const k of ['cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'masa1', 'gazoz', 'masa2', 'tost']) sim.command({ kind: 'force', what: 'unlock', value: k });
    sim.command({ kind: 'force', what: 'stage', value: 10 });
    let id = 600; const ise = (role: string, n: number) => { for (let i = 0; i < n; i++) sim.state.workers.push({ id: id++, name: role + i, role, xp: 0, morale: 70, traits: ['hamarat'] }); };
    ise('garson', 4); ise('asci', 5); ise('komi', 4); ise('sef', 2); ise('bulasikci', 2);   // BUF-13: bulaşıkçı yoksa yığın masa silmeyi yavaşlatır
    expect(mutfakEsya(sim.state.stage).length).toBe(15);
    const api = restoranApi(sim.rules)!, hat = api.hat!;
    const pg = mutfakDunya(MUTFAK_NOKTA.passGarson); let garsonPass = false;
    const is = new Map<string, number>(); let maxPass = 0, cift = 0, maxFrac = 0, sonZil = 0, sonIlerleme = 0, enUzunSessiz = 0;
    let serveN = 0, sonServe = 0; sim.rules.bus.on('serve', () => { serveN++; });   // BUF-19/20: kanat ve çatı masalarına uzun yürüyüş: masaya teslim de ilerleme
    for (let s = 0; s < 18000; s++) {   // 1800 sn = 30 dk oyun
      sim.step(0.1);
      const r = sim.rules.rt; if (r.paused) { r.paused = false; r.pauseWhy = ''; }
      // tatlı sever balayı çiftleri: tek 'pass' yemeği (Maraş dondurma) rastgele müşteri dağılımına bağlı kalmasın (tohum kaymasında da aynı kapsam)
      if (s % 300 === 150 && !is.get('pass')) r.customersApi.spawnCustomer({ type: CITIZENS.find((t: { id: string }) => t.id === 'balayi'), n: 2, kind: 'masa' });
      const d = hat.durum();
      for (const c of d.cooking) is.set(c.ist, (is.get(c.ist) || 0) + 1);
      if (!garsonPass) garsonPass = ((sim.rules.v2State().workers as { role: string; pos: { x: number; z: number } }[]) || []).some(w => w.role === 'garson' && Math.hypot(w.pos.x - pg.x, w.pos.z - pg.z) < 0.5);
      const occ = new Map<string, number>(); for (const c of d.cooking) occ.set(c.ist, (occ.get(c.ist) || 0) + 1); for (const t of d.tepsi) occ.set(t.ist, (occ.get(t.ist) || 0) + 1);
      for (const v of occ.values()) if (v > 1) cift++;
      maxPass = Math.max(maxPass, d.pass.length);
      const tk = api.view().tickets; for (const t of tk) maxFrac = Math.max(maxFrac, t.frac);
      if (d.zil > sonZil || serveN > sonServe || !tk.length) { sonZil = d.zil; sonServe = serveN; sonIlerleme = s; } else enUzunSessiz = Math.max(enUzunSessiz, s - sonIlerleme);
    }
    const d = hat.durum();
    for (const ist of PISIR10) expect(is.get(ist) || 0, ist).toBeGreaterThan(0);
    expect(is.get('soguk_oda') || 0).toBe(0); expect(is.get('bulasik') || 0).toBe(0);
    expect(cift).toBe(0);                       // bir istasyonda aynı anda tek iş
    expect(maxPass).toBeLessThanOrEqual(PASS_KAP);
    expect(d.asim).toBe(0);                     // hiçbir emniyet zaman aşımı tetiklenmedi: takılı iş yok
    expect(enUzunSessiz).toBeLessThan(600);     // açık bilet varken 60 sn'den uzun sessizlik (ne pass zili ne masaya teslim) yok: ölü kilit yok
    expect(maxFrac).toBeLessThan(1);            // hiçbir masa bileti mutfak yüzünden zaman aşımına düşmedi
    expect(d.zil).toBeGreaterThan(100);
    expect(garsonPass).toBe(true);               // garson mutfağa girip pass rafından tabak aldı
    expect(events(sim, 'passBell').length).toBeGreaterThan(0);
    const yemek = Object.entries(sim.state.stats as Record<string, number>).filter(([k]) => k.startsWith('yemek_')).reduce((a, [, v]) => a + v, 0);
    expect(yemek).toBeGreaterThan(60);
    expect(api.view().sefHizi).toBeCloseTo(0.4, 6);
  }, 120000);
});
