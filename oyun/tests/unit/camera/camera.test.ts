// PRF-10 kamera: kare hızından bağımsız takip, dinamik near (PRF-09), birinci şahısta yörünge/eğim/yakınlaştırma yok sayılır,
// fp(null) sonrası anında yerine oturma, recenter yakınsaması, eğim sınırı, merdivende kameranın kahramanla yükselmesi.
import { describe, it, expect } from 'vitest';
import { createCameraRig } from '../../../src/engine/camera';
import { CAMERA_PITCH } from '../../../src/engine/api';

const run = (hz: number, secs: number, target: (t: number) => { x: number; z: number; y?: number }) => {
  const r = createCameraRig({ aspect: 16 / 9 });
  r.snap({ x: 0, z: 0 }); r.follow(target(0), 0); r.update(1 / hz, 1);
  const n = Math.round(secs * hz);
  for (let i = 1; i <= n; i++) { r.follow(target(i / hz), 1 / hz); r.update(1 / hz, 1); }
  return r;
};

describe('kamera rig (PRF-10)', () => {
  it('30, 60 ve 144 Hz aynı yörüngeyi izler (üstel takip)', () => {
    // a 10 m jump of the target: the follow is exactly 1 - exp(-4 t) at every frame rate (min(1, dt*4) was 14 cm apart at 0.5 s)
    const at = (hz: number, secs: number) => { const r = run(hz, secs, t => ({ x: t > 0 ? 10 : 0, z: 0 })); return r.focus().x; };
    for (const secs of [1 / 3, 0.5, 1]) {
      const want = 10 * (1 - Math.exp(-4 * secs));
      for (const hz of [30, 60, 144]) expect(Math.abs(at(hz, secs) - want), `${hz} Hz ${secs} sn`).toBeLessThan(0.002);
    }
    // walking at full speed: the camera trails the hero by nearly the same distance at 30 and 144 Hz
    const lag = (hz: number) => { const r = run(hz, 3, t => ({ x: 4.6 * t, z: 0 })); return 4.6 * 3 - r.focus().x; };
    expect(Math.abs(lag(30) - lag(144))).toBeLessThan(0.07);
  });
  it('merdivende kamera kahramanla yükselir', () => {
    const low = run(60, 3, () => ({ x: 24, z: 20 })).camera.position.y;
    const high = run(60, 3, () => ({ x: 24, z: 20, y: 4.75 })).camera.position.y;
    expect(high - low).toBeCloseTo(4.75, 2);
  });
  it('near uzaklığa göre: takipte 0,1 değil, birinci şahısta küçük; projeksiyon yalnız değişince yenilenir', () => {
    const r = run(60, 1, () => ({ x: 0, z: 0 }));
    const d = r.distance();
    expect(r.camera.near).toBeCloseTo(Math.round(Math.min(3, Math.max(0.1, d * 0.08)) * 20) / 20, 6);
    expect(r.camera.near).toBeGreaterThan(0.9);
    expect(r.camera.far / r.camera.near).toBeLessThan(500);
    let calls = 0; const orig = r.camera.updateProjectionMatrix.bind(r.camera);
    r.camera.updateProjectionMatrix = () => { calls++; orig(); };
    for (let i = 0; i < 30; i++) r.update(1 / 60, 1);
    expect(calls).toBe(0);
    r.fp({ x: 1, y: 1.55, z: 2, yaw: 0 }); r.update(1 / 60, 1);
    expect(r.camera.near).toBe(0.05); expect(calls).toBe(1);
    r.nearFixed(0.1); r.update(1 / 60, 1); expect(r.camera.near).toBe(0.1);
  });
  it('birinci şahısta yörünge, eğim, yakınlaştırma ve recenter yok sayılır; çıkınca takip anında yerinde', () => {
    const r = run(60, 1, () => ({ x: 5, z: 5 }));
    const yaw0 = r.yaw, zoom0 = r.zoom, pos0 = r.camera.position.clone();
    r.fp({ x: 1, y: 1.55, z: 2, yaw: 0.5 }); r.update(1 / 60, 1);
    r.turn(1.2); r.tilt(0.4); r.zoom = 2; r.recenter();
    for (let i = 0; i < 20; i++) r.update(1 / 60, 1);
    expect(r.camera.position.x).toBe(1); expect(r.camera.position.y).toBe(1.55);
    r.fp(null); r.follow({ x: 5, z: 5 }, 1 / 60); r.update(1 / 60, 1);
    expect(r.yaw).toBe(yaw0); expect(r.zoom).toBe(zoom0);
    expect(r.camera.position.distanceTo(pos0)).toBeLessThan(1e-6);
  });
  it('recenter düz açıya yakınsar, eğim sınırda kalır', () => {
    const r = run(60, 0.5, () => ({ x: 0, z: 0 }));
    r.turn(1.3); r.recenter();
    for (let i = 0; i < 120; i++) r.update(1 / 60, 1);
    expect(Math.abs(r.yaw)).toBeLessThan(0.003);
    r.tilt(10); r.update(1 / 60, 1);
    const p = r.camera.position, dh = Math.hypot(p.x - r.focus().x, p.z - r.focus().z - 0.4);
    expect(Math.atan2(p.y, dh)).toBeLessThanOrEqual(1.4 + 1e-6);
    r.tilt(-20); r.update(1 / 60, 1);
    expect(Math.atan2(r.camera.position.y, Math.hypot(r.camera.position.x - r.focus().x, r.camera.position.z - r.focus().z - 0.4))).toBeGreaterThanOrEqual(0.3 - 1e-6);
    expect(CAMERA_PITCH).toBeGreaterThan(0.3);
  });
});
