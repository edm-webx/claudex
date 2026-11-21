/**
 * One look for every WebGL canvas in the game (main scene, Sabri'nin Evi, kulis, halı saha).
 * PRF-04: a secondary renderer left on three's defaults draws without tone mapping: bright lights clip to flat white and the
 * room looks washed out next to the main scene (owner 2026-11-08: glare made the text unreadable). Every canvas gets the same
 * output: sRGB, ACES filmic, exposure from LOOK_POZ.
 * GRS-01: the colour grade lives here too (one table instead of three places):
 * - The old full-screen CSS filter (saturate 1.06, contrast 1.04) and the DOM vignette (#sb-vig) sat on top of the UI as well;
 *   they are folded into the GRADE pass (render/index.ts) so only the 3D picture is graded.
 * - Owner 2026-11-04 "oyun aşırı pastel görünüyor" and 2026-11-02 "çok aydınlık ve parlak, biraz koyuluk": on top of the folded-in
 *   CSS share the picture is a little more saturated and contrasty (DOYGUN, KONTRAST), so colours stay rich instead of milky.
 *   Brightness goes down a little: the contrast pivot sits under mid grey and the main exposure is 0.95 (was 0.98).
 * - Akıcı has no post chain (no composer: weak PCs): the same saturation/contrast runs inside the tone mapping of every material
 *   (CustomToneMapping = ACES + grade, see LOOK_TONEMAP_GLSL), so akıcı keeps the rich colours at no extra full-screen pass.
 */
import * as T from 'three';

/** main scene exposure (render/index.ts); kept as a plain number for the callers that only need the main value.
 *  GRS-01: 0.98 -> 0.95 (owner: "biraz koyuluk"); with the saturation push the picture is deeper, not greyer. */
export const LOOK_EXPOSURE = 0.95;
/** akıcı draws without shadows and without the vignette, so the same exposure reads brighter than dengeli: it gets a little less */
export const AKICI_POZ = 0.94;
/** exposure per canvas: main scene, Sabri'nin Evi, kulis (karakter ekranı), halı saha (floodlights must not blow out) */
export const LOOK_POZ = { ana: LOOK_EXPOSURE, ev: 0.95, kulis: 0.95, halisaha: 0.85 } as const;

/** GRS-01 richness push (owner: not pastel); multiplies the old CSS-filter-included values */
export const DOYGUN = 1.1, KONTRAST = 1.03;
/** contrast pivot in display space: a little under mid grey, so contrast deepens shadows more than it lifts highlights */
export const PIVOT = 0.45;

export interface LookParams {
  sat: number; con: number; pivot: number;
  tint: [number, number, number];
  vig: number;
  bloom: { strength: number; threshold: number; radius: number };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Grade for a time of day. Same formulas the render used (warm golden hour around 18:30, cool blue night), with the old CSS share
 * folded in (sat x1.06, con x1.04, vignette +0.10 for the DOM corner darkening) and the GRS-01 richness push on top.
 * Bloom threshold stays high at night (0.90 floor): a lit sign's text must not melt into its own glow (owner S-138).
 */
export function lookAt(hour: number, night: number): LookParams {
  const n = clamp(+night || 0, 0, 1);
  const gold = clamp(1 - Math.abs(hour - 18.5) / 2.2, 0, 1) * (1 - n);
  return {
    sat: (1.06 - 0.1 * n) * 1.06 * DOYGUN,
    con: 1.03 * 1.04 * KONTRAST,
    pivot: PIVOT,
    tint: [1 + 0.05 * gold - 0.04 * n, 1 + 0.01 * gold - 0.01 * n, 1 - 0.05 * gold + 0.06 * n],
    vig: 0.3 + 0.12 * n,
    bloom: { strength: 0.1 + 0.2 * n, threshold: Math.max(0.9, 0.97 - 0.07 * n), radius: 0.3 + 0.08 * n },
  };
}

/** sRGB output + ACES filmic + exposure on any renderer-like object (no GL needed: tests use a plain object) */
export function applyLook<R extends { toneMapping: number; toneMappingExposure: number; outputColorSpace: string }>(r: R, exposure: number): R {
  r.outputColorSpace = T.SRGBColorSpace;
  r.toneMapping = T.ACESFilmicToneMapping;
  r.toneMappingExposure = exposure;
  return r;
}

export function applyLookDefaults(r: T.WebGLRenderer, o: { exposure?: number } = {}): T.WebGLRenderer {
  return applyLook(r, o.exposure ?? LOOK_EXPOSURE);
}

/** The one way the game builds a WebGL renderer: colour output set, pixel ratio capped. Throws when WebGL fails (callers catch). */
export function createLookRenderer(opts: { canvas?: HTMLCanvasElement; antialias?: boolean; exposure: number; pixelRatioMax?: number; powerPreference?: WebGLPowerPreference }): T.WebGLRenderer {
  const r = new T.WebGLRenderer({ canvas: opts.canvas, antialias: !!opts.antialias, powerPreference: opts.powerPreference ?? 'default' });
  applyLook(r, opts.exposure);
  if (opts.pixelRatioMax) r.setPixelRatio(Math.min(opts.pixelRatioMax, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
  return r;
}

/**
 * Akıcı grade inside tone mapping: ACES, then saturation and contrast in (approximate) display space. Fixed day values (no per-frame
 * uniform reaches every material); the night mood comes from the light tint (render/index.ts) as before.
 */
const AK = lookAt(12, 0);
export const LOOK_TONEMAP_GLSL = `vec3 CustomToneMapping( vec3 color ) {
	vec3 c = ACESFilmicToneMapping( color );
	vec3 d = pow( max( c, vec3( 0.0 ) ), vec3( 1.0 / 2.2 ) );
	float l = dot( d, vec3( 0.2126, 0.7152, 0.0722 ) );
	d = mix( vec3( l ), d, ${AK.sat.toFixed(4)} );
	d = ( d - ${PIVOT.toFixed(3)} ) * ${AK.con.toFixed(4)} + ${PIVOT.toFixed(3)};
	return pow( clamp( d, 0.0, 1.0 ), vec3( 2.2 ) );
}`;
let patched = false;
/** installs LOOK_TONEMAP_GLSL as three's CustomToneMapping (once, before the first compile; other renderers keep ACES) */
export function installLookToneMap(): void {
  if (patched) return; patched = true;
  const k = 'tonemapping_pars_fragment' as const, src = T.ShaderChunk[k];
  const re = /vec3 CustomToneMapping\( vec3 color \) \{[^}]*\}/;
  if (re.test(src)) (T.ShaderChunk as Record<string, string>)[k] = src.replace(re, LOOK_TONEMAP_GLSL);
}
