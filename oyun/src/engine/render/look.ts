/**
 * PRF-04: one colour pipeline for every WebGL canvas in the game (main scene, Sabri'nin Evi, kulis, halı saha).
 * A secondary renderer left on three's defaults draws without tone mapping: bright lights clip to flat white and the
 * room looks washed out next to the main scene (owner 2026-11-08: glare made the text unreadable). The light values
 * themselves stay with each view; this only sets the shared output: sRGB, ACES filmic, exposure.
 */
import * as T from 'three';

/** main scene exposure (render/index.ts); secondary rooms pass their own when their lights are tuned for it */
export const LOOK_EXPOSURE = 0.98;

export function applyLookDefaults(r: T.WebGLRenderer, o: { exposure?: number } = {}): T.WebGLRenderer {
  r.outputColorSpace = T.SRGBColorSpace;
  r.toneMapping = T.ACESFilmicToneMapping;
  r.toneMappingExposure = o.exposure ?? LOOK_EXPOSURE;
  return r;
}
