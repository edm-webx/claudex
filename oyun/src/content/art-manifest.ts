/**
 * Art manifest: dressing slot id -> file under the art base ('img/', copied from v2 img/ into dist/img by the build).
 * Same files, sizes and rects as v2 art.js META (3d/v2/js/art.js). In v2 only the UI icon and the title backdrop
 * consume images; world and characters keep their code-made look, so for look parity the world does not swap these
 * in by default. Slots stay ready for later art (MOTOR §12): a slot 'prop.<prefabId>' replaces a prefab's code shape.
 * rect: [x, y, w, h] in pixels of the image (front/back halves for clothing paints, cells for the face atlas).
 */
import type { ArtManifest } from '../engine/api';

export const ART_MANIFEST: ArtManifest = {
  'ui.title.backdrop': { file: 'img/stil-kilavuzu.jpg' },
  'sky.panorama.day': { file: 'img/manzara-gunduz.webp' },
  'tex.cini': { file: 'img/doku-cini-mavi.jpg' },
  'char.gull.top': { file: 'img/marti-ust-yetiskin.webp' },
  'ui.icon.cay': { file: 'img/ikon-cay.webp' },
  'char.face.atlas00': { file: 'img/yuz-00.webp' },
  'char.face.atlas00.0': { file: 'img/yuz-00.webp', rect: [0, 0, 256, 256] },
  'char.face.atlas00.1': { file: 'img/yuz-00.webp', rect: [256, 0, 256, 256] },
  'char.face.atlas00.2': { file: 'img/yuz-00.webp', rect: [0, 256, 256, 256] },
  'char.face.atlas00.3': { file: 'img/yuz-00.webp', rect: [256, 256, 256, 256] },
  'char.sabri.paint.front': { file: 'img/sabri-temel.webp', rect: [0, 0, 700, 1076] },
  'char.sabri.paint.back': { file: 'img/sabri-temel.webp', rect: [700, 0, 700, 1074] },
  'char.top.tee.front': { file: 'img/ust-tisort.webp', rect: [0, 0, 512, 452] },
  'char.top.tee.back': { file: 'img/ust-tisort.webp', rect: [512, 0, 512, 452] },
  'char.bottom.jeans.front': { file: 'img/alt-kot.webp', rect: [0, 0, 512, 835] },
  'char.bottom.jeans.back': { file: 'img/alt-kot.webp', rect: [512, 0, 512, 840] },
};

/** Face atlas skin tones per cell (v2 art.json), for C's face decals. */
export const FACE_ATLAS00_SKINS = ['#eabd86', '#f3b897', '#cb7951', '#e29867'];

export default ART_MANIFEST;
