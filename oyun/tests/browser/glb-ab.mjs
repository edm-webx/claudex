// PRF-11 GLB sıkıştırma A/B: her modeli iki klasörden (A: özgün, B: tools/glb-sikistir.mjs çıktısı) aynı sahnede, aynı kamerayla
// three'nin GLTFLoader'ı ile çizer ve piksel piksel karşılaştırır. Sahne normal ve UV nicemlemesini zorlar: yönlü ışık + yarım küre
// ışığı + oda ortam haritası (yansıma normale çok duyarlıdır), üç açı. Yükleme hatası ya da fark eşiği aşılırsa çıkış 1.
//   node tests/browser/glb-ab.mjs <klasörA> <klasörB> [--esik 0.002] [--cikti klasör]
// Ör.: cp -r public/modeller /tmp/once && node tools/glb-sikistir.mjs && node tests/browser/glb-ab.mjs /tmp/once public/modeller
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, extname, relative } from 'node:path';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [dA, dB] = process.argv.slice(2).filter(a => !a.startsWith('--')).map(p => resolve(p));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
if (!dA || !dB) { console.error('kullanım: node tests/browser/glb-ab.mjs <klasörA> <klasörB> [--esik 0.002] [--cikti klasör]'); process.exit(2); }
const ESIK = +arg('--esik', 0.002), OUT = arg('--cikti', null); if (OUT) mkdirSync(OUT, { recursive: true });
const THREE = resolve('node_modules/three');
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.glb') ? [p] : []; });
const modeller = walk(dA).map(f => relative(dA, f).split('\\').join('/')).sort();
const mime = { '.js': 'text/javascript', '.png': 'image/png', '.glb': 'model/gltf-binary', '.html': 'text/html; charset=utf-8' };
const SAYFA = `<!doctype html><html><head><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script></head>
<body style="margin:0;background:#000"><canvas id="c" width="480" height="360"></canvas><script type="module">
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const r = new T.WebGLRenderer({ canvas: document.getElementById('c'), antialias: false, preserveDrawingBuffer: true });
r.toneMapping = T.ACESFilmicToneMapping; r.outputColorSpace = T.SRGBColorSpace;
const env = new T.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
window.ciz = async (url, aci) => {
  const sc = new T.Scene(); sc.background = new T.Color('#5b7a8c'); sc.environment = env;
  sc.add(new T.HemisphereLight('#dfeeff', '#4a3a2a', 0.8)); const d = new T.DirectionalLight('#fff3e0', 2.2); d.position.set(3, 5, 2); sc.add(d);
  const g = await new GLTFLoader().loadAsync(url);
  g.scene.traverse(o => { if (o.isMesh) { const m = o.material; if (m.isMeshStandardMaterial) { m.envMapIntensity = 1.2; m.roughness = Math.min(m.roughness, 0.4); m.metalness = Math.max(m.metalness, 0.2); } } });
  sc.add(g.scene);
  const b = new T.Box3().setFromObject(g.scene), c = b.getCenter(new T.Vector3()), s = b.getSize(new T.Vector3()).length();
  const cam = new T.PerspectiveCamera(35, 480 / 360, s / 100, s * 10);
  cam.position.set(c.x + Math.cos(aci) * s * 1.1, c.y + s * 0.55, c.z + Math.sin(aci) * s * 1.1); cam.lookAt(c);
  r.render(sc, cam);
  const n = { tamponBayt: 0 }; g.scene.traverse(o => { if (o.isMesh) for (const k in o.geometry.attributes) n.tamponBayt += o.geometry.attributes[k].array.byteLength; });
  return n;
};
window.hazir = true;
</script></body></html>`;
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f;
  if (p === '/') { res.writeHead(200, { 'content-type': mime['.html'] }); return res.end(SAYFA); }
  if (p.startsWith('/three/')) f = join(THREE, p.slice(7)); else if (p.startsWith('/A/')) f = join(dA, p.slice(3)); else if (p.startsWith('/B/')) f = join(dB, p.slice(3));
  if (!f || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 480, height: 360 } })).newPage();
const hatalar = []; p.on('pageerror', e => hatalar.push(String(e).slice(0, 200))); p.on('console', m => { if (m.type() === 'error') hatalar.push(m.text().slice(0, 200)); });
await p.goto(`http://127.0.0.1:${srv.address().port}/`);
await p.waitForFunction(() => window.hazir, null, { timeout: 60000 });
let kotu = 0, enKotu = 0, tA = 0, tB = 0;
const kare = async (url, aci) => { const n = await p.evaluate(([u, a]) => window.ciz(u, a), [url, aci]); return { n, png: PNG.sync.read(await p.locator('#c').screenshot()) }; };
for (const m of modeller) {
  for (const [i, aci] of [0.6, 2.4, 4.3].entries()) {
    let A, B;
    try { A = await kare('/A/' + m, aci); B = await kare('/B/' + m, aci); } catch (e) { console.log(`HATA   ${m}: ${String(e).slice(0, 160)}`); kotu++; break; }
    if (i === 0) { tA += A.n.tamponBayt; tB += B.n.tamponBayt; }
    const D = new PNG({ width: A.png.width, height: A.png.height });
    const px = pixelmatch(A.png.data, B.png.data, D.data, A.png.width, A.png.height, { threshold: 0.1 });
    const oran = px / (A.png.width * A.png.height); enKotu = Math.max(enKotu, oran);
    const ok = oran <= ESIK; if (!ok) kotu++;
    if (OUT && (i === 0 || !ok)) { const ad = m.replace(/[/.]/g, '_') + '-' + i; writeFileSync(join(OUT, ad + '-A.png'), PNG.sync.write(A.png)); writeFileSync(join(OUT, ad + '-B.png'), PNG.sync.write(B.png)); writeFileSync(join(OUT, ad + '-fark.png'), PNG.sync.write(D)); }
    console.log(`${ok ? 'aynı  ' : 'FARKLI'} ${m.padEnd(36)} açı ${i}  fark %${(oran * 100).toFixed(3)} (${px} px)${i === 0 ? `  köşe verisi ${(A.n.tamponBayt / 1024).toFixed(0)} KB -> ${(B.n.tamponBayt / 1024).toFixed(0)} KB` : ''}`);
  }
}
await b.close(); srv.close();
if (hatalar.length) { console.log('sayfa hataları:', hatalar); kotu++; }
console.log(`\n${modeller.length} model, en büyük fark %${(enKotu * 100).toFixed(3)} (eşik %${(ESIK * 100).toFixed(2)}); köşe verisi (CPU+GPU) ${(tA / 1048576).toFixed(2)} MB -> ${(tB / 1048576).toFixed(2)} MB`);
console.log(kotu ? 'KIRMIZI' : 'YEŞİL: sıkıştırılmış GLB aynı görünüyor');
process.exit(kotu ? 1 : 0);
