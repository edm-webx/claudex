/**
 * Effect definitions built from engine/fx blocks (MOTOR §14). Owner: Builder C.
 * Sprite frames: 0 dot, 1 puff, 2 seed, 3 feather, 4 drop, 5 star, 6 rect, 7 heart, 8 z, 9 flake, 10 ring, 11 flash.
 * tierScale = count multiplier akici/dengeli/sahane. Streams without `duration` run until handle.stop().
 */
import type { EffectDef } from '../../engine/api';

const up = { x: 0, y: 1, z: 0 };
export const EFFECTS: Record<string, EffectDef> = {
  // çay / döner steam: soft rising puffs, drifts with the wind
  steam: { id: 'steam', life: [1.2, 2.0], emitters: [{ kind: 'stream', rate: 9, shape: 'disc', size: { x: 0.05, y: 0, z: 0.05 } }],
    modules: [{ kind: 'velocity', dir: up, spread: 0.18, speed: [0.25, 0.45] }, { kind: 'drag', k: 0.6 }, { kind: 'wind', scale: 0.25 },
      { kind: 'sizeOverLife', stops: [[0, 0.07], [1, 0.32]] }, { kind: 'colorOverLife', stops: [[0, '#ffffff', 0], [0.15, '#ffffff', 0.42], [1, '#f4f4f4', 0]] }, { kind: 'spin', speed: [0.2, 0.8] }, { kind: 'sprite', atlas: 'fx', frames: [1] }],
    tierScale: [0.5, 1, 1.4] },
  // tost lid opens: one thick puff burst + short stream
  tostSteam: { id: 'tostSteam', life: [0.8, 1.4], duration: 0.8, emitters: [{ kind: 'burst', count: 6, shape: 'box', size: { x: 0.3, y: 0.02, z: 0.2 } }, { kind: 'stream', rate: 16, shape: 'box', size: { x: 0.3, y: 0.02, z: 0.2 } }],
    modules: [{ kind: 'velocity', dir: up, spread: 0.3, speed: [0.4, 0.8] }, { kind: 'drag', k: 1.2 }, { kind: 'wind', scale: 0.2 },
      { kind: 'sizeOverLife', stops: [[0, 0.1], [1, 0.4]] }, { kind: 'colorOverLife', stops: [[0, '#ffffff', 0.55], [1, '#f0ece6', 0]] }, { kind: 'sprite', atlas: 'fx', frames: [1] }],
    tierScale: [0.5, 1, 1.3] },
  // simit sesame seeds flicked off
  sesame: { id: 'sesame', life: [0.5, 0.9], emitters: [{ kind: 'burst', count: 14, shape: 'disc', size: { x: 0.08, y: 0, z: 0.08 } }],
    modules: [{ kind: 'velocity', dir: up, spread: 0.9, speed: [0.8, 1.8] }, { kind: 'gravity', g: -7 }, { kind: 'spin', speed: [4, 10] },
      { kind: 'sizeOverLife', stops: [[0, 0.03], [1, 0.025]] }, { kind: 'colorOverLife', stops: [[0, '#f3e2b0', 1], [0.8, '#ead39a', 1], [1, '#ead39a', 0]] }, { kind: 'sprite', atlas: 'fx', frames: [2] }],
    tierScale: [0.5, 1, 1.5] },
  // gull feathers (snatch, chase)
  feather: { id: 'feather', life: [1.6, 2.6], emitters: [{ kind: 'burst', count: 6, shape: 'disc', size: { x: 0.12, y: 0, z: 0.12 } }],
    modules: [{ kind: 'velocity', dir: up, spread: 1.0, speed: [0.6, 1.4] }, { kind: 'gravity', g: -0.7 }, { kind: 'drag', k: 1.6 }, { kind: 'wind', scale: 0.6 }, { kind: 'spin', speed: [1.5, 4] },
      { kind: 'sizeOverLife', stops: [[0, 0.09], [1, 0.08]] }, { kind: 'colorOverLife', stops: [[0, '#fbfbf8', 1], [0.75, '#f2f2ee', 1], [1, '#eeeeea', 0]] }, { kind: 'sprite', atlas: 'fx', frames: [3] }],
    tierScale: [0.6, 1, 1.4] },
  // ferry wake / docking bump foam
  foamSplash: { id: 'foamSplash', life: [0.5, 1.0], emitters: [{ kind: 'burst', count: 16, shape: 'disc', size: { x: 0.25, y: 0, z: 0.25 } }, { kind: 'ring', count: 12, size: { x: 0.35, y: 0, z: 0.35 } }],
    modules: [{ kind: 'velocity', dir: up, spread: 0.6, speed: [0.8, 2.0] }, { kind: 'gravity', g: -6 }, { kind: 'drag', k: 0.8 },
      { kind: 'sizeOverLife', stops: [[0, 0.08], [1, 0.2]] }, { kind: 'colorOverLife', stops: [[0, '#ffffff', 0.9], [0.6, '#e6f4fb', 0.7], [1, '#d6ecf7', 0]] }, { kind: 'sprite', atlas: 'fx', frames: [1, 4] }],
    tierScale: [0.5, 1, 1.5] },
  // run / stop dust puff (animasyon-2)
  dust: { id: 'dust', life: [0.4, 0.8], emitters: [{ kind: 'burst', count: 5, shape: 'disc', size: { x: 0.12, y: 0, z: 0.12 } }],
    modules: [{ kind: 'velocity', dir: { x: 0, y: 0.4, z: 0 }, spread: 0.8, speed: [0.2, 0.5] }, { kind: 'drag', k: 3 },
      { kind: 'sizeOverLife', stops: [[0, 0.08], [1, 0.26]] }, { kind: 'colorOverLife', stops: [[0, '#d8c6a8', 0.6], [1, '#d8c6a8', 0]] }, { kind: 'sprite', atlas: 'fx', frames: [1] }],
    tierScale: [0.6, 1, 1.4] },
  coinSparkle: { id: 'coinSparkle', life: [0.4, 0.8], emitters: [{ kind: 'burst', count: 8, shape: 'disc', size: { x: 0.1, y: 0, z: 0.1 } }],
    modules: [{ kind: 'velocity', dir: up, spread: 0.7, speed: [0.6, 1.4] }, { kind: 'gravity', g: -2 }, { kind: 'spin', speed: [2, 5] },
      { kind: 'sizeOverLife', stops: [[0, 0.06], [0.3, 0.1], [1, 0.02]] }, { kind: 'colorOverLife', stops: [[0, '#fff3b0', 1], [1, '#f2b632', 0]] }, { kind: 'sprite', atlas: 'fx', frames: [5] }, { kind: 'flash', color: '#fff2b8', intensity: 0.5, dur: 0.18 }],
    tierScale: [0.6, 1, 1.4] },
  confetti: { id: 'confetti', life: [1.2, 2.0], emitters: [{ kind: 'burst', count: 24, shape: 'disc', size: { x: 0.2, y: 0, z: 0.2 } }],
    modules: [{ kind: 'velocity', dir: up, spread: 0.7, speed: [2.2, 3.6] }, { kind: 'gravity', g: -4 }, { kind: 'drag', k: 1.2 }, { kind: 'spin', speed: [4, 9] },
      { kind: 'sizeOverLife', stops: [[0, 0.07], [1, 0.07]] }, { kind: 'colorOverLife', stops: [[0, '#e0533c', 1], [0.8, '#f2b632', 1], [1, '#f2b632', 0]] }, { kind: 'sprite', atlas: 'fx', frames: [6] }],
    children: [{ effect: 'confettiB', delay: 0 }], tierScale: [0.5, 1, 1.5] },
  confettiB: { id: 'confettiB', life: [1.2, 2.0], emitters: [{ kind: 'burst', count: 24, shape: 'disc', size: { x: 0.2, y: 0, z: 0.2 } }],
    modules: [{ kind: 'velocity', dir: up, spread: 0.7, speed: [2.2, 3.6] }, { kind: 'gravity', g: -4 }, { kind: 'drag', k: 1.2 }, { kind: 'spin', speed: [4, 9] },
      { kind: 'sizeOverLife', stops: [[0, 0.07], [1, 0.07]] }, { kind: 'colorOverLife', stops: [[0, '#3fb5b0', 1], [0.8, '#f2a2b3', 1], [1, '#f2a2b3', 0]] }, { kind: 'sprite', atlas: 'fx', frames: [6] }],
    tierScale: [0.5, 1, 1.5] },
  heartPop: { id: 'heartPop', life: [0.8, 1.2], emitters: [{ kind: 'burst', count: 4, shape: 'disc', size: { x: 0.1, y: 0, z: 0.1 } }],
    modules: [{ kind: 'velocity', dir: up, spread: 0.35, speed: [0.5, 0.9] }, { kind: 'drag', k: 1 },
      { kind: 'sizeOverLife', stops: [[0, 0.04], [0.25, 0.13], [1, 0.1]] }, { kind: 'colorOverLife', stops: [[0, '#f26b8a', 1], [0.7, '#f26b8a', 1], [1, '#f2a2b3', 0]] }, { kind: 'sprite', atlas: 'fx', frames: [7] }] },
  zzz: { id: 'zzz', life: [1.6, 2.2], emitters: [{ kind: 'stream', rate: 1.3, shape: 'point' }],
    modules: [{ kind: 'velocity', dir: { x: 0.4, y: 1, z: 0 }, spread: 0.1, speed: [0.25, 0.35] }, { kind: 'sizeOverLife', stops: [[0, 0.06], [1, 0.16]] },
      { kind: 'colorOverLife', stops: [[0, '#5a6ea8', 0], [0.2, '#5a6ea8', 0.9], [1, '#5a6ea8', 0]] }, { kind: 'sprite', atlas: 'fx', frames: [8] }] },
  rainDrop: { id: 'rainDrop', life: [0.7, 0.9], emitters: [{ kind: 'stream', rate: 260, shape: 'box', size: { x: 24, y: 2, z: 24 } }],
    modules: [{ kind: 'velocity', dir: { x: 0.1, y: -1, z: 0 }, spread: 0.02, speed: [9, 11] }, { kind: 'sizeOverLife', stops: [[0, 0.06], [1, 0.06]] },
      { kind: 'colorOverLife', stops: [[0, '#cfe3f3', 0.55], [1, '#cfe3f3', 0.4]] }, { kind: 'sprite', atlas: 'fx', frames: [4] }],
    tierScale: [0.3, 0.6, 1] },
  snowFlake: { id: 'snowFlake', life: [4, 6], emitters: [{ kind: 'stream', rate: 70, shape: 'box', size: { x: 24, y: 2, z: 24 } }],
    modules: [{ kind: 'velocity', dir: { x: 0, y: -1, z: 0 }, spread: 0.2, speed: [0.6, 1.0] }, { kind: 'wind', scale: 0.4 }, { kind: 'spin', speed: [0.5, 1.5] },
      { kind: 'sizeOverLife', stops: [[0, 0.05], [1, 0.05]] }, { kind: 'colorOverLife', stops: [[0, '#ffffff', 0], [0.1, '#ffffff', 0.9], [1, '#ffffff', 0.7]] }, { kind: 'sprite', atlas: 'fx', frames: [9] }],
    tierScale: [0.3, 0.6, 1] },
};
export default EFFECTS;
