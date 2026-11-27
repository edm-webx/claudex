// SNT-07 / SNT-08 / SNT-14 / DNY-17: ambiyans tablosu, çanta, evre geçişi, kapı tablosu (a'nın atmosphere kapısıyla).
import { describe, it, expect } from 'vitest';
import {
  AMBIYANS, ambBolge, katmanAgirlik, hedefKazanclar, kapiTablosu, yaklas, Canta, MORG, CANLI, canliSeviye,
  AMB_MAX_KATMAN, EVRE_GECIS_SN, EVRE_SIRA, ALT_BOLGELER,
} from '../../../src/content/ses/ambiyans';
import { createAtmosphere, DEFAULT_TABLE, type AtmoHost, type AmbienceTable } from '../../../src/engine/audio/atmosphere';
import { renderLoop } from '../../../src/engine/audio/msynth/render';
import { SR_LOOP } from '../../../src/engine/audio/msynth/dsp';
import DB from '../../../src/content/ses/ses-db.json';

const db = DB as unknown as { loops: Record<string, { dur: number }>; sfx: Record<string, unknown>; patches: Record<string, never> };
/** motor tarifleri (engine/audio/index.ts SFX + seasonCall/simitci): ses-db'de olmayan olay kimlikleri bunlar olmalı */
const MOTOR = new Set(['mevsim', 'simitci', 'birdTrill', 'birdCall', 'woodpecker', 'clapChant', 'tribunDavul', 'crowdCheer', 'crowdOoh']);
const O = { x: 0, z: 10 };

describe('ambiyans tablosu', () => {
  it('kapsam bölgeleri tanımlı: iskele, karşı yaka, orman, stadyum (döngü + olay)', () => {
    for (const z of ['iskele', 'karsi', 'orman', 'stadyum']) {
      expect(AMBIYANS[z].katman.length, z).toBeGreaterThan(0);
      expect(AMBIYANS[z].olay.length, z).toBeGreaterThan(0);
    }
  });
  it('her döngü ses-db loops, her olay ses-db sfx ya da motor tarifi', () => {
    for (const [z, b] of Object.entries(AMBIYANS)) {
      for (const k of b.katman) expect(db.loops[k.loop], z + ':' + k.loop).toBeTruthy();
      for (const o of b.olay) expect(!!db.sfx[o.id] || MOTOR.has(o.id), z + ':' + o.id).toBe(true);
    }
  });
  it('yeni döngüler 10-20 sn (kısa mono 24 kHz) ve dikişsiz', () => {
    for (const id of ['iskele_gece', 'orman_gunduz', 'orman_gece', 'karsi_sokak', 'fiskiye', 'kalabalik']) {
      const def = db.loops[id] as never as Parameters<typeof renderLoop>[1];
      expect(def.dur).toBeGreaterThanOrEqual(10); expect(def.dur).toBeLessThanOrEqual(20);
      const b = renderLoop(id, def, { sr: SR_LOOP, patches: db.patches });
      expect(Math.abs(b.length / SR_LOOP - def.dur)).toBeLessThan(0.05);
      // dikiş: son ve ilk örnek arasındaki sıçrama sıradan komşu farkından büyük değil
      let mx = 0; for (let i = 1; i < b.length; i++) mx = Math.max(mx, Math.abs(b[i] - b[i - 1]));
      expect(Math.abs(b[b.length - 1] - b[0])).toBeLessThanOrEqual(mx + 1e-6);
      expect(b.some(v => !Number.isFinite(v))).toBe(false);
    }
  });
  it('iskele: gündüz deniz, gece sakin gece döngüsü; orman gündüz/gece ayrı; başka bölge katmanı yok', () => {
    expect(Object.keys(katmanAgirlik('iskele', 'noon', O))).toEqual(['deniz']);
    expect(Object.keys(katmanAgirlik('iskele', 'night', O)).sort()).toEqual(['deniz', 'iskele_gece']);
    expect(Object.keys(katmanAgirlik('iskele', 'sunset', O)).sort()).toEqual(['deniz', 'iskele_gece']);
    expect(Object.keys(katmanAgirlik('orman', 'noon', O))).toEqual(['orman_gunduz']);
    expect(Object.keys(katmanAgirlik('orman', 'night', O))).toEqual(['orman_gece']);
    expect(Object.keys(katmanAgirlik('carsi', 'noon', O))).toEqual([]);   // kapsam dışı: deniz çalmasın
    expect(katmanAgirlik('iskele', 'night', O).deniz).toBeLessThan(katmanAgirlik('iskele', 'noon', O).deniz);   // gece dalga yumuşar
  });
  it('gece martı seyrek (sahibe karar: seyrek/kes tek sabitte)', () => {
    const gull = AMBIYANS.iskele.olay.find(o => o.id === 'gull')!;
    expect(gull.evre[3]).toBeLessThan(gull.evre[1] * 0.25);
  });
  it('karşı yaka fıskiye konumlu: meydanda duyulur, sahada duyulmaz (kurulmaz)', () => {
    expect(katmanAgirlik('karsi.meydan', 'noon', { x: -3.9, z: 40 }).fiskiye).toBeGreaterThan(0.3);
    expect(katmanAgirlik('karsi.halisaha', 'noon', { x: -45, z: 45 }).fiskiye).toBeUndefined();
    expect(katmanAgirlik('karsi.halisaha', 'noon', { x: -45, z: 45 }).kalabalik).toBeGreaterThan(0.3);
  });
  it('eşzamanlı döngü en çok 4 (bölge + hava), her bölge x evre x hava', () => {
    for (const z of [...Object.keys(AMBIYANS), ...ALT_BOLGELER]) for (const p of EVRE_SIRA) for (const w of ['acik', 'saganak', 'firtina', 'lodos']) {
      expect(Object.keys(hedefKazanclar(z, p, w, { x: -3.9, z: 45 })).length).toBeLessThanOrEqual(AMB_MAX_KATMAN);
    }
    expect(hedefKazanclar('ic.kafe', 'noon', 'saganak', O).yagmur).toBeLessThan(0.2);   // iç mekanda hava kısık
  });
  it('evre geçişi: kazanç adımları sürekli (ardışık fark < 0.1), 20-40 sn içinde hedefte', () => {
    for (const z of ['iskele', 'orman', 'karsi']) for (const [a, b] of [['noon', 'sunset'], ['sunset', 'night'], ['night', 'morning']] as const) {
      const from = katmanAgirlik(z, a, O), to = katmanAgirlik(z, b, O);
      for (const id of new Set([...Object.keys(from), ...Object.keys(to)])) {
        let g = from[id] ?? 0, t = 0; const hedef = to[id] ?? 0;
        while (g !== hedef) { const n = yaklas(g, hedef, 0.25, EVRE_GECIS_SN); expect(Math.abs(n - g)).toBeLessThan(0.1); g = n; t += 0.25; }
        expect(t).toBeLessThanOrEqual(40);
      }
    }
  });
});

describe('çanta (shuffle-bag)', () => {
  it('1000 çekimde ardışık tekrar 0 (ağırlıklı, seyrek öğeli havuz)', () => {
    let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (const z of ['iskele', 'karsi', 'orman', 'stadyum']) for (let e = 0; e < 4; e++) {
      const items = AMBIYANS[z].olay.map(o => ({ v: o.id, w: o.evre[e] })), distinct = items.filter(i => i.w > 0).length;
      const c = new Canta(items, rnd); let prev: string | undefined, rep = 0;
      for (let i = 0; i < 1000; i++) { const v = c.next(); if (v === prev && distinct > 1) rep++; prev = v; }
      expect(rep, z + e).toBe(0);
    }
  });
  it('ağırlığı 0 olan öğe hiç çıkmaz', () => {
    const c = new Canta([{ v: 'a', w: 1 }, { v: 'b', w: 0 }, { v: 'c', w: 0.5 }], Math.random);
    for (let i = 0; i < 300; i++) expect(c.next()).not.toBe('b');
  });
});

describe('kapı tablosu (atmosphere.ts ile)', () => {
  function fake() {
    const started: string[] = [];
    const host: AtmoHost = { start(d) { started.push(d.id); return { setGain() { /* */ }, stop() { /* */ } }; }, shoot() { /* */ } };
    return { host, started };
  }
  it('bölge değişince aktif katman listesi yalnız o bölge', () => {
    const f = fake(), a = createAtmosphere(f.host);
    const tab = (z: string, p = 'noon', at = O) => kapiTablosu(p, at, z, {}, DEFAULT_TABLE) as unknown as AmbienceTable;
    a.setTable(tab('iskele')); a.setZone('iskele'); a.tick(0, { phase: 'noon', weather: 'acik' });
    expect(a.active().sort()).toEqual(['deniz', 'izgara']);
    a.setTable(tab('orman')); a.setZone('orman'); a.tick(100, { phase: 'noon', weather: 'acik' });
    expect(a.active()).toEqual(['orman_gunduz']);
    a.setTable(tab('karsi.meydan', 'noon', { x: -3.9, z: 42 })); a.setZone('karsi.meydan'); a.tick(200, { phase: 'noon', weather: 'acik' });
    expect(a.active().sort()).toEqual(['fiskiye', 'karsi_sokak']);
    a.setTable(tab('carsi')); a.setZone('carsi'); a.tick(300, { phase: 'noon', weather: 'acik' });
    expect(a.active()).toEqual([]);
    a.setInterior('mutfak'); a.tick(400, { phase: 'noon', weather: 'acik' });
    expect(a.active().some(id => ['deniz', 'orman_gunduz', 'fiskiye'].includes(id))).toBe(false);
  });
  it('evre geçişinde sönen döngü (kazancı > 0) tablodan düşmez; iç mekan anahtarları korunur', () => {
    const t = kapiTablosu('morning', O, 'iskele', { iskele_gece: 0.4 }, { mutfak: [{ id: 'm', loop: 'izgara', gain: 1 }] });
    expect(t.iskele.map(l => l.id)).toContain('iskele_gece');
    expect(kapiTablosu('morning', O, 'iskele', {}, {}).iskele.map(l => l.id)).not.toContain('iskele_gece');
    expect(t.mutfak.length).toBe(1);
    expect(t['*']).toEqual([]);
  });
});

describe('morg ve canlı müzik', () => {
  it('morg tetik aralığı alt sınırı 12 sn, yalnız gece', () => {
    expect(MORG.aralik[0]).toBeGreaterThanOrEqual(12);
    expect(MORG.gece(23)).toBe(true); expect(MORG.gece(12)).toBe(false); expect(MORG.gece(3)).toBe(true);
    for (const id of MORG.sesler) expect(db.sfx[id], id).toBeTruthy();   // yumuşak ses-db sürümü motor tarifinden önce gelir
  });
  it('canlı müzik: uzaklaştıkça kazanç düşer, yakında arka plan müziği kısılır, yarıçap dışında kaynak yok', () => {
    let prev = Infinity;
    for (let d = 0; d <= CANLI.r; d += 1) { const v = canliSeviye(d).vol; expect(v).toBeLessThanOrEqual(prev); prev = v; }
    expect(canliSeviye(CANLI.r).vol).toBe(0);
    expect(canliSeviye(1).muzik).toBeLessThan(0.7);
    expect(canliSeviye(CANLI.r + 5).muzik).toBe(1);
    expect(ambBolge('ic.kafe').ic).toBe(true);
  });
});

describe('MUZ-ic: iç mekan oda tonları (kafede kafe, mutfakta mutfak, dış ses yok)', () => {
  const KOK = ['iskele', 'deniz', 'gull'];
  it('her iç mekan kimliğinin bir oda tonu var ve döngü ses-db içinde', async () => {
    const { IC_MEKANLAR } = await import('../../../src/content/ic-mekan');
    const { IC_ODA } = await import('../../../src/content/ses/ambiyans');
    for (const m of IC_MEKANLAR) expect(IC_ODA[m.id], m.id).toBeTruthy();
    for (const [id, o] of Object.entries(IC_ODA)) { expect(db.loops[o.loop], id).toBeTruthy(); expect(o.vol).toBeLessThanOrEqual(0.55); }
  });
  it('oda tonu döngüleri 10-20 sn, dikişsiz, sonlu', () => {
    for (const id of ['ic_kafe', 'ic_lokanta', 'ic_avm', 'ic_hastane', 'ic_okul', 'ic_oda', 'ic_mutfak']) {
      const def = db.loops[id] as never as Parameters<typeof renderLoop>[1];
      expect(def.dur).toBeGreaterThanOrEqual(10); expect(def.dur).toBeLessThanOrEqual(20);
      const b = renderLoop(id, def, { sr: SR_LOOP, patches: db.patches });
      let mx = 0; for (let i = 1; i < b.length; i++) mx = Math.max(mx, Math.abs(b[i] - b[i - 1]));
      expect(Math.abs(b[b.length - 1] - b[0])).toBeLessThanOrEqual(mx + 1e-6);
      expect(b.some(v => !Number.isFinite(v))).toBe(false);
    }
  });
  it('kapı: kafe1 içinde yalnız ic_kafe açık, mutfakta ic_mutfak, dışarı sesleri hiç yok', () => {
    const t = kapiTablosu('noon', O, 'iskele', {}, DEFAULT_TABLE as never);
    const at = createAtmosphere({ start: () => ({ setGain() { /**/ }, stop() { /**/ } }), shoot() { /**/ } }, { table: t as unknown as AmbienceTable });
    for (const [id, loop] of [['kafe1', 'ic_kafe'], ['kafe2', 'ic_lokanta'], ['mutfak', 'ic_mutfak'], ['hastane', 'ic_hastane'], ['avm_moda', 'ic_avm']] as const) {
      at.setInterior(id); expect(at.active(), id).toEqual([loop]);
      for (const k of KOK) expect(at.active()).not.toContain(k);
    }
    at.setInterior(null); at.setZone('iskele'); expect(at.active()).toContain('deniz');
  });
});
