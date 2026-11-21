// PRF-10 girdi: iki parmak yakınlaştırma kamerayı döndürmez (ölü bölge), bilinçli bükme döndürür; Q/E döndürür, R ortalar,
// yazı alanında hiçbiri çalışmaz; orta tuş pointer capture; birinci şahısta (freeze) kahraman hareket girdisi almaz.
import { describe, it, expect } from 'vitest';
import { createInput, TWIST_DEAD, KEY_ORBIT } from '../../../src/engine/input';

type L = Record<string, ((e: any) => void)[]>;
function fakeDom() {
  const ls: L = {}, wl: L = {};
  const el = () => ({ className: '', innerHTML: '', hidden: false, style: {} as Record<string, string>, textContent: '', firstChild: { style: {} }, appendChild() {}, remove() {} });
  const win = { addEventListener: (k: string, f: (e: any) => void) => { (wl[k] ??= []).push(f); }, removeEventListener() {} };
  const doc = { createElement: el, head: { appendChild() {} }, defaultView: win };
  const captured: number[] = [];
  const canvas = { ownerDocument: doc, addEventListener: (k: string, f: (e: any) => void) => { (ls[k] ??= []).push(f); }, removeEventListener() {}, setPointerCapture: (id: number) => { captured.push(id); } };
  let now = 0;
  const platform = { clock: { now: () => now }, audioCtx: () => null };
  const input = createInput({ canvas: canvas as never, root: el() as never, platform: platform as never });
  const fire = (k: string, e: Record<string, unknown>) => (ls[k] ?? []).forEach(f => f({ preventDefault() {}, button: 0, buttons: 0, ...e }));
  const key = (k: string, e: Record<string, unknown> = {}) => (wl[k] ?? []).forEach(f => f({ preventDefault() {}, target: { tagName: 'CANVAS' }, ...e }));
  return { input, fire, key, captured, tick: (ms: number) => { now += ms; } };
}

describe('girdi (PRF-10)', () => {
  it('iki parmak yakınlaştırmada küçük açı oynaması kamerayı döndürmez', () => {
    const { input, fire } = fakeDom();
    fire('pointerdown', { pointerId: 1, clientX: 100, clientY: 300 }); fire('pointerdown', { pointerId: 2, clientX: 300, clientY: 300 });
    input.poll();
    let orbit = 0, zoom = 1;
    // fingers spread from 200 px to 360 px apart while the pair wobbles ±6°
    for (let i = 1; i <= 20; i++) {
      const half = 100 + i * 4, a = Math.sin(i) * 0.1;
      fire('pointermove', { pointerId: 1, clientX: 200 - Math.cos(a) * half, clientY: 300 - Math.sin(a) * half });
      fire('pointermove', { pointerId: 2, clientX: 200 + Math.cos(a) * half, clientY: 300 + Math.sin(a) * half });
      const s = input.poll(); orbit += s.orbit ?? 0; zoom *= s.pinch ?? 1;
    }
    expect(orbit).toBe(0);
    expect(zoom).toBeLessThan(0.7);
  });
  it('bilinçli bükme ölü bölgeyi geçince döndürür (ölü bölge kadar eksik, sıçramasız)', () => {
    const { input, fire } = fakeDom();
    fire('pointerdown', { pointerId: 1, clientX: 100, clientY: 300 }); fire('pointerdown', { pointerId: 2, clientX: 300, clientY: 300 });
    let orbit = 0;
    for (let i = 1; i <= 10; i++) {
      const a = i * 0.06;
      fire('pointermove', { pointerId: 1, clientX: 200 - Math.cos(a) * 100, clientY: 300 - Math.sin(a) * 100 });
      fire('pointermove', { pointerId: 2, clientX: 200 + Math.cos(a) * 100, clientY: 300 + Math.sin(a) * 100 });
      orbit += input.poll().orbit ?? 0;
    }
    expect(orbit).toBeCloseTo(0.6 - TWIST_DEAD, 5);
  });
  it('Q/E duvar saati süresiyle döndürür, R ortalar; yazı alanında çalışmaz', () => {
    const { input, key, tick } = fakeDom();
    input.poll();
    key('keydown', { key: 'e' }); tick(500); expect(input.poll().orbit).toBeCloseTo(KEY_ORBIT * 0.1, 6);   // one poll is capped at 0.1 s
    tick(16); expect(input.poll().orbit).toBeCloseTo(KEY_ORBIT * 0.016, 6);
    key('keyup', { key: 'e' }); key('keydown', { key: 'q' }); tick(16); expect(input.poll().orbit).toBeCloseTo(-KEY_ORBIT * 0.016, 6);
    key('keyup', { key: 'q' });
    key('keydown', { key: 'r' }); expect(input.poll().recenter).toBe(true); expect(input.poll().recenter).toBe(false);
    key('keyup', { key: 'r' });
    key('keydown', { key: 'r', target: { tagName: 'INPUT' } }); key('keydown', { key: 'e', target: { tagName: 'TEXTAREA' } }); tick(16);
    const s = input.poll(); expect(s.recenter).toBe(false); expect(s.orbit).toBe(0);
  });
  it('orta tuş işaretçiyi yakalar, sürükleme döndürür/eğer, tıklama ortalar', () => {
    const { input, fire, captured } = fakeDom();
    fire('pointerdown', { pointerId: 7, button: 1, clientX: 10, clientY: 10 });
    expect(captured).toEqual([7]);
    fire('pointermove', { pointerId: 7, buttons: 4, clientX: 60, clientY: 30 });
    const s = input.poll(); expect(s.orbit).toBeCloseTo(0.4, 6); expect(s.tilt).toBeCloseTo(-0.12, 6);
    fire('pointerup', { pointerId: 7 });
    fire('pointerdown', { pointerId: 8, button: 1, clientX: 10, clientY: 10 }); fire('pointerup', { pointerId: 8 });
    expect(input.poll().recenter).toBe(true);
  });
  it('freeze: joystick ve tuşlar kahramanı yürütmez, kalkınca yürütür', () => {
    const { input, key } = fakeDom();
    key('keydown', { key: 'w' });
    expect(input.poll().moving).toBe(true);
    input.freeze!(true); expect(input.poll().moving).toBe(false); expect(input.poll().move).toEqual({ x: 0, z: 0 });
    input.inject({ x: 1, z: 0 }); expect(input.poll().moving).toBe(false);
    input.freeze!(false); input.inject(null); expect(input.poll().move.z).toBe(-1);
  });
});
