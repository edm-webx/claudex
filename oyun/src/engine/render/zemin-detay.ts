/**
 * Zemin detayı (2026-11-08 grafik cilası): Poly Haven CC0 dokularından (public/doku) dünya koordinatıyla yansıtılan
 * renk ve normal detayı. Prefab'ların ortak Lambert malzemesine eklenir; UV gerekmez.
 * - Yalnızca yere yakın (y < 1.25) ve yukarı bakan yüzler etkilenir; çatılar, duvarlar, masalar aynı kalır.
 * - Hangi doku: yüzeyin kendi rengine göre seçilir (koyu gri: asfalt, yeşil: çim, sıcak bej: balıksırtı taş,
 *   açık gri: kilitli parke). `force` ile malzeme başına sabitlenebilir.
 * - Atlas 3x2 hücre (512 px): 0 asfalt, 1 parke, 2 çim, 3 balıksırtı, 4 tahta, 5 kiremit. textureGrad ile hücre
 *   kenarında mip dikişi olmaz.
 */
import * as T from 'three';

let colTex: T.Texture | null = null, norTex: T.Texture | null = null;
const shared = { uCol: { value: null as T.Texture | null }, uNor: { value: null as T.Texture | null }, uOn: { value: 0 } };
const pending = new Set<T.Material>();

function load(): void {
  if (colTex || typeof Image === 'undefined') return;
  try {
    const L = new T.TextureLoader();
    const done = () => { if (colTex!.image && norTex!.image) { shared.uOn.value = 1; pending.forEach(m => { m.needsUpdate = true; }); } };
    colTex = L.load('doku/zemin-renk.jpg', done); colTex.colorSpace = T.SRGBColorSpace;
    norTex = L.load('doku/zemin-normal.jpg', done);
    for (const t of [colTex, norTex]) { t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; }
    shared.uCol.value = colTex; shared.uNor.value = norTex;
  } catch { colTex = null; }
}

export interface ZeminOpts { force?: number; ds?: number; ns?: number }

/** Adds world-space ground detail to a Lambert/Standard material (idempotent). */
export function zeminDetay(mat: T.Material, o: ZeminOpts = {}): void {
  if (!mat || mat.userData.zemin) return;
  mat.userData.zemin = true;
  load();
  pending.add(mat);
  const force = o.force ?? -1, ds = o.ds ?? 0.8, ns = o.ns ?? 0.9;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uZCol = shared.uCol; sh.uniforms.uZNor = shared.uNor; sh.uniforms.uZOn = shared.uOn;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vZW; varying vec3 vZN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvZW = (modelMatrix * vec4(transformed, 1.0)).xyz; vZN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vZW; varying vec3 vZN; uniform sampler2D uZCol; uniform sampler2D uZNor; uniform float uZOn;
const float Z_SC[6] = float[6](0.25, 0.42, 0.33, 0.5, 0.45, 0.5);
vec2 zCellUV(int c, vec2 w) { vec2 f = fract(w * Z_SC[c]); f = f * 0.98 + 0.01; return (vec2(float(c % 3), float(1 - c / 3)) + f) / vec2(3.0, 2.0); }
vec4 zSample(sampler2D t, int c, vec2 w) { vec2 g = w * Z_SC[c] / vec2(3.0, 2.0); return textureGrad(t, zCellUV(c, w), dFdx(g), dFdy(g)); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
int zC = -1; float zK = 0.0;
if (uZOn > 0.5 && vZW.y < 1.25 && vZN.y > 0.8) {
  vec3 c = diffuseColor.rgb; float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = (mx - mn) / max(mx, 1e-3);
  zC = ${force};
  if (zC < 0) {
    if (c.g > c.r * 1.12 && c.g > c.b * 1.05) zC = 2;
    else if (lum < 0.12 && sat < 0.3) zC = 0;
    else if (c.r > c.g && c.g > c.b && sat > 0.22 && sat < 0.78) zC = 3;
    else if (sat < 0.25 && lum > 0.15) zC = 1;
  }
  if (zC >= 0) {
    zK = smoothstep(1.25, 0.9, vZW.y) * smoothstep(0.8, 0.95, vZN.y);
    vec3 d = zSample(uZCol, zC, vZW.xz).rgb * 2.0;
    diffuseColor.rgb *= mix(vec3(1.0), d, ${ds.toFixed(2)} * zK * (zC == 3 ? 0.6 : 1.0));
  }
}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
if (zC >= 0) {
  vec3 tn = zSample(uZNor, zC, vZW.xz).xyz * 2.0 - 1.0; tn.xy *= ${ns.toFixed(2)} * zK;
  vec3 wn = normalize(vec3(tn.x, tn.z, tn.y));
  normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
}`);
  };
  mat.customProgramCacheKey = () => 'zemin' + force + ds + ns;
  mat.needsUpdate = true;
}

/** Swaps a plank material's canvas map for the Poly Haven deck boards (same UVs, 16 boards per tile). */
export function tahtaDoku(mat: T.MeshLambertMaterial): void {
  if (typeof Image === 'undefined' || mat.userData.tahta) return;
  mat.userData.tahta = true;
  try {
    const L = new T.TextureLoader(), old = mat.map;
    const fit = (t: T.Texture) => { t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; if (old) { t.repeat.copy(old.repeat); t.offset.copy(old.offset); } };
    L.load('doku/iskele-tahta.jpg', t => { t.colorSpace = T.SRGBColorSpace; fit(t); mat.map = t; mat.needsUpdate = true; });
    L.load('doku/iskele-tahta-normal.jpg', t => { fit(t); mat.normalMap = t; mat.normalScale.set(0.8, 0.8); mat.needsUpdate = true; });
  } catch { /* keep canvas planks */ }
}
