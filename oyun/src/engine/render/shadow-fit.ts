/**
 * GRS-06: güneş gölgesi kutusu kameraya göre büyür/küçülür. Kamera uzaklaşınca (zoomRaw 4) sabit ±15 m kutunun kenarı ekranda
 * kesik bir çizgi gibi görünüyordu. Ekran köşelerinden atılan ışınların y=0 düzlemine değdiği noktaların odağa en büyük uzaklığı
 * ölçülür; kutu {12,15,19,24} basamaklarından birine, histerezisle (her 30 karede en çok bir değişim) oturur ki titremesin.
 * Saf fonksiyonlar (birim test); harita boyutu ve shadowMap.enabled değişmez.
 */
import * as T from 'three';

export const SHADOW_STEPS = [12, 15, 19, 24] as const;
const _o = new T.Vector3(), _d = new T.Vector3();

/** Ekran köşelerinin zemindeki izinin odağa en büyük uzaklığı (ufka bakan köşe = maxR). */
export function groundRadius(cam: T.Camera, focus: { x: number; z: number }, maxR = 40): number {
  cam.updateMatrixWorld();
  let r = 0;
  for (const [nx, ny] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    _o.setFromMatrixPosition(cam.matrixWorld);
    _d.set(nx, ny, 0.5).unproject(cam).sub(_o).normalize();
    if (_d.y > -1e-3) return maxR;
    const t = -_o.y / _d.y;
    r = Math.max(r, Math.hypot(_o.x + _d.x * t - focus.x, _o.z + _d.z * t - focus.z));
  }
  return Math.min(maxR, r);
}

/** Bir sonraki kutu yarı genişliği: yalnız radius*1.1 > prev ise büyür, radius*1.1 < prev*0.7 ise küçülür (basamaklar arasında). */
export function nextShadowExt(prev: number, radius: number): number {
  const want = radius * 1.1;
  if (want > prev) { for (const s of SHADOW_STEPS) if (s >= want) return s; return SHADOW_STEPS[SHADOW_STEPS.length - 1]; }
  if (want < prev * 0.7) { let best: number = SHADOW_STEPS[0]; for (const s of SHADOW_STEPS) if (s >= want && s < prev) { best = s; break; } return best; }
  return prev;
}
