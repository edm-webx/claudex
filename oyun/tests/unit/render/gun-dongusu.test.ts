import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { readFileSync } from 'node:fs';
import { todAt, TOD } from '../../../src/engine/render/tod';
import { makeSky, BULUT_TEMEL } from '../../../src/engine/render/sky';
import { createRender } from '../../../src/engine/render/index';

const hsv = (c: T.Color) => { const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b); return { s: mx ? (mx - mn) / mx : 0, v: mx }; };
// display-space (sRGB) values, as the owner sees them
const disp = (c: T.Color) => c.clone().convertLinearToSRGB();

describe('gün döngüsü ve atmosfer (GRS-02)', () => {
  it('öğle göğü ve sisi pastel bandından çıktı (daha az beyaz, daha çok renk)', () => {
    const t = todAt(11);
    for (const k of ['hor', 'fog'] as const) {
      const c = hsv(disp(t[k]));
      expect(c.s, k).toBeGreaterThanOrEqual(0.12);
      expect(c.v, k).toBeLessThanOrEqual(0.93);
    }
    expect(hsv(disp(t.top)).s).toBeGreaterThanOrEqual(0.6);   // saturated noon blue
  });

  it('altın saat 17.25 başlar: güneş kehribar ve alçak, gölgeler uzun', () => {
    expect(TOD.some(k => k.h === 17.25)).toBe(true);
    const g = todAt(17.75), noon = todAt(13);
    expect(g.el).toBeLessThan(0.55); expect(g.el).toBeLessThan(noon.el);
    expect(g.sun.b / g.sun.r).toBeLessThan(0.6);   // warm amber, not white
    expect(g.n).toBe(0);
  });

  it('mavi saat 20.05: turuncudan geceye mavi-mor bir ara', () => {
    const b = todAt(20.05);
    expect(b.top.b).toBeGreaterThan(b.top.r); expect(b.n).toBeGreaterThan(0.5); expect(b.n).toBeLessThan(1);
    expect(b.hor.b).toBeGreaterThan(todAt(19.5).hor.b);
  });

  it('sis mesafesi saate bağlı: sabah puslu, öğle açık, gece yakın', () => {
    expect(todAt(8).fd).toBeLessThan(todAt(12).fd);
    expect(todAt(25).fd).toBeLessThan(todAt(12).fd);
    for (let h = 8; h <= 32; h += 0.25) { const f = todAt(h).fd; expect(f).toBeGreaterThanOrEqual(0.6); expect(f).toBeLessThanOrEqual(1.1); }
    const R = createRender({ quality: { current: () => ({ name: 'dengeli' }) }, dress: null, canvas: undefined } as never);
    R.setTime(8); const a = R.sky.userData.fogMul; R.setTime(12); const b = R.sky.userData.fogMul;
    expect(a).toBeCloseTo(todAt(8).fd, 6); expect(b).toBeCloseTo(todAt(12).fd, 6);
  });

  it('gökyüzü tek mesh: bulut, ay ve yıldız terimleri; akıcı bulutsuz', () => {
    const sky = makeSky(), m = sky.material as T.ShaderMaterial;
    for (const u of ['uTime', 'uCloud', 'uCloudQ', 'uMoonDir']) expect(m.uniforms[u], u).toBeDefined();
    expect(m.uniforms.uCloud.value).toBe(BULUT_TEMEL);
    expect(m.fragmentShader).toContain('fbm(');
    expect(sky.children.length).toBe(0);
    const R = createRender({ quality: { current: () => ({ name: 'dengeli' }) }, dress: null, canvas: undefined } as never);
    const u = (R.sky.material as T.ShaderMaterial).uniforms;
    R.setTier({ name: 'akici', pixelRatio: 1 } as never); expect(u.uCloudQ.value).toBe(0);
    R.setTier({ name: 'dengeli', pixelRatio: 1 } as never); expect(u.uCloudQ.value).toBe(1);
  });

  it('yıldız parıltısı yavaş (H-052: saniyede 3 değişimden az)', () => {
    const src = (makeSky().material as T.ShaderMaterial).fragmentShader;
    const m = src.match(/sin\(uTime \* \(([\d.]+) \+ ([\d.]+) \* h31/);
    expect(m).not.toBeNull();
    const maxRad = Number(m![1]) + Number(m![2]);   // rad/s
    expect(maxRad / (2 * Math.PI) * 2).toBeLessThan(3);   // two brightness changes per cycle
  });

  it('bulutlar kayar: uTime her karede ilerler', () => {
    const sky = makeSky(), u = (sky.material as T.ShaderMaterial).uniforms;
    const cam = new T.PerspectiveCamera(); const sc = new T.Scene(); sc.fog = new T.Fog('#000', 1, 2);
    sky.onBeforeRender(null as never, sc, cam, null as never, null as never, null as never);
    expect(typeof u.uTime.value).toBe('number');
    sky.userData.fogMul = 0.5; sky.onBeforeRender(null as never, sc, cam, null as never, null as never, null as never);
    const f1 = (sc.fog as T.Fog).far; sky.userData.fogMul = 1; sky.onBeforeRender(null as never, sc, cam, null as never, null as never, null as never);
    expect((sc.fog as T.Fog).far).toBeCloseTo(f1 * 2, 6);
  });

  it('yağmurda renk biraz solar: hava-look GRADE doygunluğunu ve bulutu sürer', () => {
    const s = readFileSync(new URL('../../../src/game/view/world/hava-look.ts', import.meta.url), 'utf8');
    expect(s).toMatch(/R\.weatherSat = 1 - dark \* 0\.3/);
    expect(s).toMatch(/su\.uCloud\.value = BULUT_TEMEL/);
    const r = readFileSync(new URL('../../../src/engine/render/index.ts', import.meta.url), 'utf8');
    expect(r).toMatch(/uSat\.value = look\.sat \* ws/);
  });
});
