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

export interface ZeminOpts { force?: number; ds?: number; ns?: number; /** çim yüzeyinde çiçek benekleri (varsayılan: yalnız otomatik seçilen çim) */ cicek?: boolean }

/** Adds world-space ground detail to a Lambert/Standard material (idempotent). */
export function zeminDetay(mat: T.Material, o: ZeminOpts = {}): void {
  if (!mat || mat.userData.zemin) return;
  mat.userData.zemin = true;
  load();
  pending.add(mat);
  const force = o.force ?? -1, ds = o.ds ?? 0.8, ns = o.ns ?? 0.9, cic = o.cicek ?? force < 0;
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
float zH(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float zN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(zH(i), zH(i + vec2(1, 0)), f.x), mix(zH(i + vec2(0, 1)), zH(i + vec2(1, 1)), f.x), f.y); }
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
    // makro değişim: dokunun tekrarını kırar (iki ölçekli gürültü; yüzeye göre ton)
    float n1 = zN(vZW.xz * 0.045), n2 = zN(vZW.xz * 0.21 + 17.0), n3 = zN(vZW.xz * 0.9 + 5.0);
    vec3 mc = diffuseColor.rgb;
    if (zC == 2) {
      mc = mix(mc, mc * vec3(1.14, 1.04, 0.62), smoothstep(0.35, 0.8, n1) * 0.55);   // kuruyan sarımsı lekeler
      mc = mix(mc, mc * vec3(0.78, 0.93, 0.8), smoothstep(0.5, 0.9, n2) * 0.45);      // gölgeli koyu çim
      mc *= 0.92 + 0.16 * n3;
    } else if (zC == 0) {
      mc *= 0.84 + 0.3 * n1 + 0.1 * (n3 - 0.5);                                        // asfalt yaması / yağ lekesi
      mc = mix(mc, mc * 0.7, smoothstep(0.62, 0.8, n2) * 0.5);
    } else {
      if (zC == 3) {   // meydan taşı: doygunluğu kıs, taş taş ton farkı, 4 m'de bir açık derz bandı
        float l = dot(mc, vec3(0.2126, 0.7152, 0.0722)); mc = mix(vec3(l), mc, 0.78);
        vec2 bc = floor(vZW.xz * vec2(5.0, 10.0)); mc *= 0.94 + 0.12 * zH(bc);
        vec2 gj = abs(fract(vZW.xz / 4.0 + 0.5) - 0.5) * 4.0; float gm = min(gj.x, gj.y);
        mc *= 1.0 + 0.1 * (1.0 - smoothstep(0.03, 0.11, gm)) - 0.16 * (1.0 - smoothstep(0.0, 0.025, gm));
      }
      mc *= 0.88 + 0.24 * n1;                                                          // taşlar: nem / güneşte solmuş alanlar
      mc = mix(mc, mc * vec3(0.9, 0.88, 0.84), smoothstep(0.6, 0.85, n2) * 0.45);
      mc *= 0.97 + 0.06 * n3;
    }
    diffuseColor.rgb = mix(diffuseColor.rgb, mc, zK);
    ${cic ? `if (zC == 2 && !(vZW.x > -53.0 && vZW.x < -26.0 && vZW.z > 34.0 && vZW.z < 56.0)) {
      // çiçek benekleri: 0.4 m hücrede seyrek, uzaklaşınca silinir (örtüşme gürültüsü olmasın)
      vec2 g = vZW.xz * 2.6; vec2 ci = floor(g); float h = zH(ci + 3.7);
      float fw = max(fwidth(g.x), fwidth(g.y));
      if (h > 0.9 - 0.08 * n1) {
        vec2 ctr = ci + 0.2 + 0.6 * vec2(zH(ci + 11.1), zH(ci + 23.3));
        float r = 0.2 + 0.1 * zH(ci + 5.5), dd = length(g - ctr);
        float a = (1.0 - smoothstep(r - fw, r + fw, dd)) * (1.0 - smoothstep(0.35, 0.8, fw));
        float k = zH(ci + 41.0); vec3 fc = k < 0.35 ? vec3(0.97, 0.96, 0.9) : k < 0.6 ? vec3(1.0, 0.82, 0.2) : k < 0.82 ? vec3(0.96, 0.55, 0.7) : vec3(0.72, 0.55, 0.9);
        diffuseColor.rgb = mix(diffuseColor.rgb, fc, a * zK);
      }
    }` : ''}
  }
}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
if (zC >= 0) {
  vec3 tn = zSample(uZNor, zC, vZW.xz).xyz * 2.0 - 1.0; tn.xy *= ${ns.toFixed(2)} * zK;
  vec3 wn = normalize(vec3(tn.x, tn.z, tn.y));
  normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
}`);
  };
  mat.customProgramCacheKey = () => 'zemin2' + force + ds + ns + (cic ? 'c' : '');
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
