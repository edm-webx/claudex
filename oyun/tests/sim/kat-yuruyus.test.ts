// 2026-11-27 QA-1: çatı / Şef katında yürüyen işçinin yüksekliği her adımda zeminY ile sıfırlanıyordu; goVia "yerdeyim" sanıp aynı
// kattaki masaya bile merdivenden inip çıkıyordu (ya da görüntüde döşemenin içinden düşüyordu). Walker.yAt kat bilgisini korur.
import { it, expect } from 'vitest';
import { Walker } from '../../src/game/sim/agents/move';
import { katY, catiY, catiYukari, catiAyak } from '../../src/content/kanat';
import { zeminY } from '../../src/content/ustgecit';

const navDuz = { path: (_a: any, b: any) => [{ x: b.x, z: b.z }], walkable: () => true } as any;
const yeni = (x: number, z: number, y: number) => ({ x, z, y, px: x, pz: z, rot: 0, speed: 0 } as any);
const katli = (a: any, st: number) => { const w = new Walker(a, navDuz); w.yAt = (x, z, y) => katY(st, x, z, y > 0.5) || zeminY(x, z); return w; };

it('çatı terasında yürüyen işçi çatıda kalır, Şef koridorunda da', () => {
  const ry = catiY(9, 'W');
  const a = yeni(-11.7, -2.0, ry), w = katli(a, 9);
  w.goTo({ x: -16, z: -2.0 }); for (let i = 0; i < 40; i++) w.walk(0.1, 2.6);
  expect(a.y).toBeCloseTo(ry, 3);
  w.path = [{ x: -11.7, z: -5 }, { x: -11.7, z: -13.1 }, { x: -4, z: -13.1 }]; for (let i = 0; i < 160; i++) w.walk(0.1, 2.6);
  expect(a.x).toBeCloseTo(-4, 1); expect(a.y).toBeCloseTo(ry, 3);
});
it('merdivenden çıkınca yükselir, inince yere döner', () => {
  const ry = catiY(9, 'W'), a = yeni(catiAyak('W').x, catiAyak('W').z, 0), w = katli(a, 9);
  w.path = catiYukari('W', { x: -16, z: -2.0 }); for (let i = 0; i < 80; i++) w.walk(0.1, 2.6);
  expect(a.y).toBeCloseTo(ry, 3);
  // yerdeki işçi aynı (x, z)'den geçse de çatıya ışınlanmaz
  const b = yeni(-16, -2.0, 0), wb = katli(b, 9); wb.goTo({ x: -18, z: -2.0 }); for (let i = 0; i < 10; i++) wb.walk(0.1, 2.6);
  expect(b.y).toBe(0);
});
