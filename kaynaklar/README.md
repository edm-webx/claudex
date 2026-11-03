# Kaynak kütüphanesi (ücretsiz, ticari kullanıma açık)

Yeni bir Three.js oyunu yaparken önce buraya bak. Lisanslar: `LISANSLAR.md`. Poly Haven öğelerinin listesi, etiketleri ve gerçek boyutları: `polyhaven/katalog.json`.

## Klasörler
- `hdri-kucuk/` 18 küçük EXR ortam haritası (apartment, bridge, city, dawn, esplanade, forest, hall, lab, lobby, night, park, sky, studio, sunrise, sunset, venice, warehouse, workshop).
- `polyhaven/hdri/<id>/` 2k HDR + `onizleme.jpg`.
- `polyhaven/doku/<id>/` `<id>_diffuse_1k.jpg`, `_nor_gl_1k.jpg`, `_arm_1k.jpg`, `_displacement_1k.jpg`.
- `polyhaven/model/<id>/` glTF (+ .bin + dokular).
- `doku/`, `font/` küçük yardımcılar.
- `araclar/polyhaven-indir.mjs` kütüphaneyi Poly Haven'dan doldurur/büyütür (`node kaynaklar/araclar/polyhaven-indir.mjs --kuru` önce listeyi gösterir). Var olan dosyayı tekrar indirmez.

## Three.js'te kullanım (r150+)
```js
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

// Ortam ışığı (küçük EXR) ya da gökyüzü (2k HDR)
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
const pmrem = new THREE.PMREMGenerator(renderer);
new EXRLoader().load('kaynaklar/hdri-kucuk/park.exr', (t) => { scene.environment = pmrem.fromEquirectangular(t).texture; t.dispose(); });
new RGBELoader().load('kaynaklar/polyhaven/hdri/<id>/<id>_2k.hdr', (t) => { t.mapping = THREE.EquirectangularReflectionMapping; scene.background = t; });

// PBR doku: renk sRGB, diğerleri linear. ARM tek doku = AO + pürüz + metal.
const tl = new THREE.TextureLoader(), yol = 'kaynaklar/polyhaven/doku/<id>/<id>';
const tekrar = (t, n = 4) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(n, n); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
const renk = tekrar(tl.load(`${yol}_diffuse_1k.jpg`)); renk.colorSpace = THREE.SRGBColorSpace;
const arm = tekrar(tl.load(`${yol}_arm_1k.jpg`));
const mat = new THREE.MeshStandardMaterial({
  map: renk, normalMap: tekrar(tl.load(`${yol}_nor_gl_1k.jpg`)),
  aoMap: arm, roughnessMap: arm, metalnessMap: arm,
});
// aoMap için geometride uv1 gerekir (r151+): geo.setAttribute('uv1', geo.attributes.uv);

// Model
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
new GLTFLoader().load('kaynaklar/polyhaven/model/<id>/<id>_1k.gltf', (g) => scene.add(g.scene));
```
Poly Haven normal haritaları için `_nor_gl` (OpenGL) kullanılır, `_nor_dx` değil. Modeller gerçek metre ölçüsündedir.
