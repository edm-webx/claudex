/**
 * GRS-05 ıslak zemin: yağmurda ve yağmurdan sonra yere yakın, yukarı bakan yüzeyler (iskele tahtası, kaldırım taşı, yol) koyulaşır ve
 * yatık bakışta gökyüzü rengini parlatır; kuruyunca (uWet -> 0) eski görünüme döner. Ortak Lambert malzemelerine bir kez eklenir
 * (zemin-detay.ts deseni: idempotent, önceki onBeforeCompile ve program anahtarıyla zincirlenir); ıslaklık uniform olduğu için
 * yağmur başlarken/biterken hiçbir program yeniden derlenmez. Yağmursuz gece zemin parlamaz (uWet 0).
 */
import * as T from 'three';

const shared = { uWet: { value: 0 }, uWetSky: { value: new T.Color('#9fc4e0') } };

/** 0 kuru .. 1 sırılsıklam (hava-look wetK) */
export function setZeminWet(k: number): void { shared.uWet.value = Math.max(0, Math.min(1, +k || 0)); }
/** kenar parlamasında yansıyan gök rengi (tod.sky2) */
export function setZeminSky(c: T.Color): void { shared.uWetSky.value.copy(c); }
export function zeminWet(): number { return shared.uWet.value; }

/** Önceki program anahtarına ek koyar (zeminDetay anahtarı ezmesin diye zincir). */
export function chainKey(mat: T.Material, tag: string): void {
  const prevKey = mat.customProgramCacheKey;
  mat.customProgramCacheKey = function () { return prevKey.call(mat) + tag; };
}

/** Dünya konumu/normali varying'i: zemin-detay'ın vZW/vZN'si varsa onu kullanır, yoksa bir kez vGW/vGN ekler (varying sayısı az kalsın). */
export function worldVaryings(sh: { vertexShader: string; fragmentShader: string }): [string, string] {
  if (sh.vertexShader.includes('varying vec3 vZW;')) return ['vZW', 'vZN'];
  if (!sh.vertexShader.includes('varying vec3 vGW;')) {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW; varying vec3 vGN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz; vGN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW; varying vec3 vGN;');
  }
  return ['vGW', 'vGN'];
}

export function wetZemin(mat: T.Material): void {
  if (!mat || mat.userData.islak) return;
  mat.userData.islak = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uWet = shared.uWet; sh.uniforms.uWetSky = shared.uWetSky;
    const [W, N] = worldVaryings(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWet; uniform vec3 uWetSky;')
      .replace('#include <color_fragment>', `#include <color_fragment>
float wetM = uWet * step(${W}.y, 1.25) * smoothstep(0.8, 0.95, ${N}.y);
diffuseColor.rgb *= 1.0 - 0.38 * wetM;`)
      .replace('#include <opaque_fragment>', `outgoingLight += uWetSky * pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0) * 0.55 * wetM;
#include <opaque_fragment>`);
  };
  chainKey(mat, '|islak');
  mat.needsUpdate = true;
}
