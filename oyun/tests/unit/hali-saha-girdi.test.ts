import { describe, it, expect } from 'vitest';
import { ADIM, ARA_PAS_SN, createGirdi, dugmeBul, dugmeYerlesimi, ekranVektoru, nisanYazi, olubolge, pasHedefi, sabitAdim, sarjGuc, sarjOrani, type Girdi, type MotorEylem, type PadBenzeri } from '../../src/game/ui/hali-saha-girdi';
import { olayBanner, olaySesleri, restartBanner, restartIpucu, sesler } from '../../src/game/ui/hali-saha-olay';
import { createMatch, FORMATIONS } from '../../src/game/sim/macmotor';

type Cagri = [MotorEylem, number | undefined, boolean | undefined];
function kur(sahip = true) {
  const o = { t: 0, sahip, calls: [] as Cagri[], sync: 0 };
  const g = createGirdi({ act: (a, gu, u) => o.calls.push([a, gu, u]), sahip: () => o.sahip, simdi: () => o.t, esitle: () => { o.sync++; } });
  return { o, g };
}
const pad = (axes: number[], pressed: number[] = [], rt = 0): PadBenzeri => ({ axes, buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i) || (i === 7 && rt > 0.5), value: i === 7 ? rt : pressed.includes(i) ? 1 : 0 })) });

describe('FUT-07 girdi: klavye şeması (B-050)', () => {
  it('Space dokun = düz pas, basılı = ara pas', () => {
    const { o, g } = kur();
    g.tus(' ', true); o.t = 100; g.tus(' ', false);
    expect(o.calls).toEqual([['pas', 0.5, false]]);
    o.calls.length = 0; g.tus(' ', true); o.t = 100 + ARA_PAS_SN * 1000 + 50; g.tus(' ', false);
    expect(o.calls).toEqual([['pas', 0.5, true]]);
  });
  it('E havadan uzun top anında, topsuzken işe yaramaz', () => {
    const { o, g } = kur(); g.tus('e', true); expect(o.calls).toEqual([['uzun', undefined, undefined]]);
    const b = kur(false); b.g.tus('e', true); expect(b.o.calls).toEqual([]);
  });
  it('F şarj: süre -> güç eşlemesi, bırakınca vurur', () => {
    const { o, g } = kur(); g.tus('f', true); o.t = 400; g.tus('f', false);
    expect(o.calls).toEqual([['sut', 0.5, undefined]]);
    expect(sarjGuc(0)).toBeCloseTo(0.15); expect(sarjGuc(0.4)).toBeCloseTo(0.5); expect(sarjGuc(5)).toBe(1);
    expect(sarjOrani('sut', 0.4)).toBeCloseTo(0.5); expect(sarjOrani('pas', 1)).toBe(1);
  });
  it('F basılı kalırsa 1 sn sonra kendiliğinden tam güçle çıkar ve bırakınca ikinci vuruş olmaz', () => {
    const { o, g } = kur(); g.tus('f', true); o.t = 900; g.guncelle(); expect(o.calls).toEqual([]);
    o.t = 1100; g.guncelle(); expect(o.calls).toEqual([['sut', 1, undefined]]);
    g.tus('f', false); expect(o.calls.length).toBe(1);
  });
  it('topsuzken F = müdahale (şut), Space = değiştir (pas); C ve Q aynı işi açıkça yapar', () => {
    const { o, g } = kur(false);
    g.tus('f', true); g.tus('f', false); g.tus(' ', true); g.tus(' ', false); g.tus('c', true); g.tus('q', true);
    expect(o.calls).toEqual([['sut', undefined, undefined], ['pas', undefined, undefined], ['sut', undefined, undefined], ['pas', undefined, undefined]]);
  });
  it('topluyken C ve Q karışmaz (oyuncu değişmez, müdahale atılmaz)', () => {
    const { o, g } = kur(true); g.tus('c', true); g.tus('q', true); expect(o.calls).toEqual([]);
  });
  it('X çalım, tekrar eden tuş (basılı tutma) ikinci kez eylem üretmez, bilinmeyen tuş serbest', () => {
    const { o, g } = kur(); g.tus('x', true); g.tus('x', true, true); expect(o.calls).toEqual([['calim', undefined, undefined]]);
    expect(g.tus('z', true)).toBe(false); expect(g.tus('F', true)).toBe(true);
  });
  it('WASD ve oklar yön verir, Shift koş', () => {
    const { g } = kur();
    g.tus('d', true); g.tus('ArrowUp', true); expect(g.vektor(false, 800, 400)).toEqual([0.7071067811865475, -0.7071067811865475]);
    g.tus('d', false); g.tus('ArrowUp', false); expect(g.vektor(false, 800, 400)).toEqual([0, 0]);
    expect(g.kos).toBe(false); g.tus('Shift', true); expect(g.kos).toBe(true); g.tus('Shift', false); expect(g.kos).toBe(false);
  });
  it('eylem öncesi M.input eşitlenir (gecikme düşük)', () => {
    const { o, g } = kur(); g.tus(' ', true); expect(o.sync).toBeGreaterThan(0);
  });
  it('odak kaybında hiçbir şey takılı kalmaz', () => {
    const { o, g } = kur(); g.tus('w', true); g.tus('f', true); g.tus('Shift', true); g.birakHepsi();
    expect(g.vektor(false, 800, 400)).toEqual([0, 0]); expect(g.sarj()).toBeNull(); expect(g.kos).toBe(false); o.t = 2000; g.guncelle(); expect(o.calls).toEqual([]);
  });
});

describe('FUT-07 girdi: dikey ekran ve dokunmatik', () => {
  it('portre dönüşü: ekran yukarısı = +x (hücum), sağ = +y', () => {
    expect(ekranVektoru(0, -1, true)).toEqual([1, 0]); expect(ekranVektoru(1, 0, true)).toEqual([-0, 1]);
    expect(ekranVektoru(0, 1, true)).toEqual([-1, 0]); expect(ekranVektoru(1, 0, false)).toEqual([1, 0]);
    const [x, y] = ekranVektoru(3, 4, false); expect(Math.hypot(x, y)).toBeCloseTo(1);
  });
  it('dokunmatik çubuk: ölü bölge içinde durur, dışında yön verir, portrede döner', () => {
    const { g } = kur(); g.joyBas(7, 100, 300); g.joyHareket(7, 103, 301); expect(g.vektor(false, 800, 400)).toEqual([0, 0]);
    g.joyHareket(7, 300, 300); const [x, y] = g.vektor(false, 800, 400); expect(x).toBeCloseTo(1); expect(y).toBeCloseTo(0);
    const p = g.vektor(true, 400, 800); expect(p[0]).toBeCloseTo(-0); expect(p[1]).toBeCloseTo(1);
    expect(g.joyBas(9, 0, 0)).toBe(false);   // ikinci parmak çubuğu çalmaz
    expect(g.joyBirak(9)).toBe(false); expect(g.joyBirak(7)).toBe(true); expect(g.vektor(false, 800, 400)).toEqual([0, 0]);
  });
  it('dokunmatik düğme: şarj parmağa bağlı, başka parmağın bırakması vurmaz', () => {
    const { o, g } = kur(); g.dugme('sut', true, 3); o.t = 800; g.dugme('sut', false, 4); expect(o.calls).toEqual([]);
    expect(g.sarjKaynak(3)).toBe('sut'); expect(g.sarjKaynak(4)).toBeNull();
    g.dugme('sut', false, 3); expect(o.calls).toEqual([['sut', 1, undefined]]);
  });
  it('düğme yerleşimi: yatay ve dikeyde ekran içinde, birbirine değmez, en yakın düğme kazanır', () => {
    for (const [cw, ch] of [[844, 390], [390, 844], [360, 640], [1280, 720]]) {
      const B = dugmeYerlesimi(cw, ch), ad = ['sut', 'pas', 'calim'] as const;
      for (const k of ad) { expect(B[k].x - B[k].r).toBeGreaterThan(0); expect(B[k].x + B[k].r).toBeLessThanOrEqual(cw); expect(B[k].y - B[k].r).toBeGreaterThan(0); expect(B[k].y + B[k].r).toBeLessThanOrEqual(ch); }
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) { const a = B[ad[i]], b = B[ad[j]]; expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan((a.r + b.r) * 1.05); }
      expect(dugmeBul(B, B.sut.x, B.sut.y)).toBe('sut'); expect(dugmeBul(B, B.pas.x, B.pas.y)).toBe('pas'); expect(dugmeBul(B, B.calim.x, B.calim.y)).toBe('calim');
      expect(dugmeBul(B, 10, ch / 2)).toBeNull();
    }
  });
});

describe('FUT-07 girdi: gamepad', () => {
  it('sol çubuk ölü bölge ve yön, D-pad de yürütür', () => {
    expect(olubolge(0.1, 0.1)).toEqual([0, 0]); const [x] = olubolge(1, 0); expect(x).toBeCloseTo(1);
    const { g } = kur(); g.gamepad(pad([0.05, 0.05])); expect(g.vektor(false, 800, 400)).toEqual([0, 0]);
    g.gamepad(pad([1, 0])); expect(g.vektor(false, 800, 400)[0]).toBeCloseTo(1); expect(g.kaynak).toBe('gamepad');
    g.gamepad(pad([0, 0], [14])); expect(g.vektor(false, 800, 400)).toEqual([-1, 0]);
  });
  it('A pas (basılı ara pas), B şut şarjı, X çalım, Y değiştir (topsuz), RT koş', () => {
    const { o, g } = kur(); g.gamepad(pad([0, 0], [0])); g.gamepad(pad([0, 0])); expect(o.calls).toEqual([['pas', 0.5, false]]);
    o.calls.length = 0; g.gamepad(pad([0, 0], [1])); o.t += 800; g.gamepad(pad([0, 0])); expect(o.calls).toEqual([['sut', 1, undefined]]);
    o.calls.length = 0; g.gamepad(pad([0, 0], [2])); expect(o.calls).toEqual([['calim', undefined, undefined]]);
    g.gamepad(pad([0, 0], [], 1)); expect(g.kos).toBe(true); g.gamepad(pad([0, 0])); expect(g.kos).toBe(false);
    const b = kur(false); b.g.gamepad(pad([0, 0], [3])); expect(b.o.calls).toEqual([['pas', undefined, undefined]]);
  });
  it('basılı düğme her karede tekrar tetiklenmez, pad çıkarsa şarj güvenle biter', () => {
    const { o, g } = kur(); g.gamepad(pad([0, 0], [2])); g.gamepad(pad([0, 0], [2])); g.gamepad(pad([0, 0], [2])); expect(o.calls.length).toBe(1);
    g.gamepad(pad([0, 0], [1])); g.gamepad(null); expect(g.sarj()).toBeNull(); expect(o.calls.length).toBe(2);
  });
});

describe('FUT-07 pas hedefi ve nişan', () => {
  const pl = (x: number, y: number, team = 0, gk = false) => ({ x, y, team, gk, fx: 1, fy: 0 });
  const pls = [pl(2, 10, 0, true), pl(15, 10), pl(22, 6), pl(22, 14), pl(30, 10), pl(38, 10, 1, true)];
  it('dümen yönündeki arkadaşı seçer; kaleci ve rakip seçilmez', () => {
    expect(pasHedefi(pls, 1, 0, -1)).toBe(2); expect(pasHedefi(pls, 1, 0, 1)).toBe(3); expect(pasHedefi(pls, 1, 1, 0)).toBe(4);
    expect(pasHedefi(pls, 1, 0, 0)).toBe(4);   // dümen boşta: bakış yönü
  });
  it('histerezis: çok yakın iki aday arasında halka titremez', () => {
    const a = [pl(10, 10), pl(20, 9.7), pl(20, 10.3)];
    const ilk = pasHedefi(a, 0, 1, 0, -1); a[1].y = 10.35;   // adaylar yer değiştirmek üzere
    expect(pasHedefi(a, 0, 1, 0, ilk)).toBe(ilk);
  });
  it('nişan yazısı', () => {
    expect(nisanYazi(0, false)).toContain('otomatik'); expect(nisanYazi(-1, false)).toContain('üst'); expect(nisanYazi(1, false)).toContain('alt'); expect(nisanYazi(1, true)).toContain('sağ');
  });
});

describe('FUT-06 sabit adım ve belirlenimcilik', () => {
  it('kare süresi ne olursa olsun adım sayısı toplam süreye uyar', () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 144, 0.0071, 0.1]) {
      const f = sabitAdim(); let n = 0, t = 0; while (t < 10) { n += f.ekle(dt); t += dt; }
      expect(Math.abs(n - Math.floor(t / ADIM))).toBeLessThanOrEqual(1);
      expect(f.alfa).toBeGreaterThanOrEqual(0); expect(f.alfa).toBeLessThanOrEqual(1);
    }
  });
  it('takılma sonrası adım patlaması sınırlı', () => { const f = sabitAdim(10); expect(f.ekle(30)).toBe(10); expect(f.alfa).toBe(0); });

  // Aynı seed + aynı girdi dizisi = aynı maç; kare hızı ayrı ayrı olsa da (bahis izleMac tekrarı bunun üstüne kurulu).
  function oyna(parca: (i: number) => number, seed: number) {
    const M = createMatch({ seed, human: 0, humanSlot: 3, formations: ['2-2', '1-2-1'], halfS: 20, skill: [0.6, 0.6] });
    const zaman = { t: 0 };
    const ayarla = () => { const [ix, iy] = g.vektor(false, 800, 400); M.input.ix = ix; M.input.iy = iy; };
    const g: Girdi = createGirdi({ act: (a, gu, u) => M.act(a, gu, u), sahip: () => M.ball.owner === M.ctrl && M.freeze <= 0, simdi: () => zaman.t, esitle: ayarla });
    const f = sabitAdim(); let adim = 0, i = 0;
    const betik: Record<number, [string, boolean]> = { 30: ['d', true], 90: [' ', true], 100: [' ', false], 140: ['w', true], 200: ['f', true], 215: ['f', false], 260: ['w', false], 300: ['x', true], 380: ['e', true], 500: ['s', true], 700: ['d', false] };
    while (adim < 3000) {
      const n = f.ekle(parca(i++));
      for (let k = 0; k < n; k++) { const e = betik[adim]; if (e) g.tus(e[0], e[1]); const [ix, iy] = g.vektor(false, 800, 400); M.input.ix = ix; M.input.iy = iy; g.guncelle(); M.step(ADIM); adim++; }
    }
    return JSON.stringify({ s: M.score, c: +M.clock.toFixed(4), b: [M.ball.x, M.ball.y], p: M.pls.map(p => [p.x, p.y]), st: M.teamStats(0) });
  }
  it('aynı seed + aynı girdi = aynı skor ve aynı durum (60, 144, değişken kare hızı)', () => {
    for (const seed of [3, 11, 42]) {
      const a = oyna(() => 1 / 60, seed), b = oyna(() => 1 / 144, seed), c = oyna(i => 0.004 + (i * 7919 % 31) / 1000, seed), d = oyna(() => 1 / 60, seed);
      expect(b).toBe(a); expect(c).toBe(a); expect(d).toBe(a);
    }
  });
  it('farklı seed farklı maç (test boş geçmesin)', () => { expect(oyna(() => 1 / 60, 3)).not.toBe(oyna(() => 1 / 60, 4)); });
  it('formasyon anahtarları hâlâ var', () => { expect(Object.keys(FORMATIONS).length).toBeGreaterThan(1); });
});

describe('FUT-18 olay -> ses/banner eşlemesi', () => {
  it('mevcut ses id geçer, yeni olaylar mevcut seslere eşlenir', () => {
    expect(olaySesleri({ k: 'sfx', id: 'kick' })).toEqual(['kick']); expect(olaySesleri({ k: 'foul', team: 0 })).toEqual(['whistle']);
    expect(olaySesleri({ k: 'post' })).toEqual(['post', 'crowdOoh']); expect(olaySesleri({ k: 'save', team: 1 })).toEqual(['crowdOoh']);
    expect(olaySesleri({ k: 'card', who: 2 })).toEqual(['whistle']); expect(olaySesleri({ k: 'goal', team: 0 })).toEqual(['net', 'crowdCheer']);
    expect(olaySesleri({ k: 'end' })).toEqual(['whistleLong']); expect(olaySesleri({ k: 'banner', text: 'x' })).toEqual([]); expect(olaySesleri({ k: 'bilinmeyen' })).toEqual([]);
  });
  it('aynı adımda motor hem sfx hem olay yollarsa ses çift çalmaz', () => {
    expect(sesler([{ k: 'sfx', id: 'net' }, { k: 'sfx', id: 'crowdCheer' }, { k: 'goal', team: 0 }, { k: 'shake', t: 0.4 }])).toEqual(['net', 'crowdCheer']);
  });
  it('para sesi bu tablodan çalmaz; yalnız bilinen engine ses id\'leri kullanılır', () => {
    const izinli = new Set(['whistle', 'whistleLong', 'kick', 'post', 'net', 'crowdCheer', 'crowdOoh', 'puff']);
    for (const e of [{ k: 'goal' }, { k: 'foul' }, { k: 'save' }, { k: 'post' }, { k: 'card' }, { k: 'end' }]) for (const id of olaySesleri(e)) { expect(izinli.has(id)).toBe(true); expect(id).not.toMatch(/coin|para|kasa/); }
  });
  it('banner yazıları Türkçe: FAUL, PENALTI, KALE VURUŞU; eski türler bozulmaz', () => {
    expect(olayBanner({ k: 'foul' })?.text).toBe('FAUL'); expect(olayBanner({ k: 'foul', pen: true })?.text).toBe('PENALTI'); expect(olayBanner({ k: 'card' })?.text).toBe('SARI KART');
    expect(olayBanner({ k: 'goal' })).toBeNull(); expect(olayBanner({ k: 'sfx', id: 'kick' })).toBeNull();
    expect(restartBanner('penalti')).toBe('PENALTI'); expect(restartBanner('kale')).toBe('KALE VURUŞU'); expect(restartBanner('serbest')).toBe('SERBEST VURUŞ');
    expect(restartBanner('tac')).toBeNull(); expect(restartBanner(undefined)).toBeNull();
  });
  it('penaltıda insana F ipucu, topsuz oyuncuya ipucu yok', () => {
    expect(restartIpucu('penalti', true)).toContain('F'); expect(restartIpucu('penalti', false)).toBeNull(); expect(restartIpucu(undefined, true)).toBeNull();
  });
});
