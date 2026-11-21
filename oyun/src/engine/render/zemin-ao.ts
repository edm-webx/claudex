/**
 * GRS-06 zemin AO'su: duvar, direk, tezgâh ve bankın yere değdiği yerde yumuşak koyulaşma (fragman başına, dünya y'sine göre).
 * Batch kutuları kaba olduğu için köşe rengine pişirmek uzun duvarda bütün yüzeye gradyan verirdi; burada yalnız alttaki
 * 0.55 m koyulaşır. Aşağı bakan yüzler (masa altı, saçak altı) sabit 0.72 alır. Yukarı bakan zemin dokunulmaz (nesne altındaki
 * gölgeyi temas düzlemleri verir, batch.ts). Ortak malzemeleri bir kez değiştirir: program sayısı kademeden bağımsızdır.
 * `?noao=1` ölçümü için uAoK sıfırlanabilir (uniform: yeniden derleme yok).
 */
import type * as T from 'three';
import { chainKey, worldVaryings } from './zemin-islak';

const shared = { uAoK: { value: 0.3 }, uAoDown: { value: 0.72 } };
/** 0 = kapalı (A/B ölçümü), varsayılan 0.30 */
export function setGroundAo(k: number, down = 0.72): void { shared.uAoK.value = Math.max(0, Math.min(1, +k || 0)); shared.uAoDown.value = k > 0 ? down : 1; }
export const groundAoK = (): number => shared.uAoK.value;

/** Düz fonksiyon (birim test): dünya yüksekliği y ve normal ny için çarpan. */
export function aoFactor(y: number, ny: number, k = 0.3, down = 0.72, baseY = 0): number {
  let f = 1;
  if (Math.abs(ny) < 0.5) { const h = Math.max(0, Math.min(1, (y - baseY) / 0.55)); f *= 1 - k * (1 - h * h * (3 - 2 * h)); }
  if (ny < -0.3) f *= down;
  return f;
}

export function groundAo(mat: T.Material, o: { baseY?: number } = {}): void {
  if (!mat || mat.userData.groundAo) return;
  mat.userData.groundAo = true;
  const baseY = (o.baseY ?? 0).toFixed(2);
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uAoK = shared.uAoK; sh.uniforms.uAoDown = shared.uAoDown;
    const [W, N] = worldVaryings(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uAoK; uniform float uAoDown;')
      .replace('#include <color_fragment>', `#include <color_fragment>
{ vec3 aoN = normalize(${N});
  if (abs(aoN.y) < 0.5) { float aoH = clamp((${W}.y - ${baseY}) / 0.55, 0.0, 1.0); diffuseColor.rgb *= 1.0 - uAoK * (1.0 - smoothstep(0.0, 1.0, aoH)); }
  if (aoN.y < -0.3) diffuseColor.rgb *= uAoDown; }`);
  };
  chainKey(mat, '|ao' + baseY);
  mat.needsUpdate = true;
}
