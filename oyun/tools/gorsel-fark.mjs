// PRF-06: aynı adlı PNG'leri iki klasörde piksel piksel karşılaştırır (birleştirme/culling "görüntüyü değiştirmedi" kanıtı).
// Kullanım: node tools/gorsel-fark.mjs <önceKlasör> <sonraKlasör> [--esik 0.0005] [--fark çıktıKlasörü]
// Çıkış 1: herhangi bir görüntüde farklı piksel oranı eşiği aşarsa. tools/shot-compare.mjs v2 eşdeğerliği içindir, bu iş için değil.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [a, b] = process.argv.slice(2).filter(x => !x.startsWith('--'));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const esik = Number(arg('--esik', 0.0005)), farkDir = arg('--fark', null);
if (!a || !b) { console.error('kullanım: node tools/gorsel-fark.mjs <önce> <sonra> [--esik 0.0005] [--fark klasör]'); process.exit(2); }
if (farkDir) mkdirSync(farkDir, { recursive: true });
let kotu = 0, n = 0;
for (const f of readdirSync(a).filter(f => f.endsWith('.png')).sort()) {
  if (!existsSync(join(b, f))) { console.log(`yok     ${f}`); continue; }
  const A = PNG.sync.read(readFileSync(join(a, f))), B = PNG.sync.read(readFileSync(join(b, f)));
  if (A.width !== B.width || A.height !== B.height) { console.log(`BOYUT   ${f} ${A.width}x${A.height} / ${B.width}x${B.height}`); kotu++; continue; }
  const D = new PNG({ width: A.width, height: A.height });
  const px = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: 0.1 });
  const oran = px / (A.width * A.height); n++;
  const ok = oran <= esik; if (!ok) kotu++;
  console.log(`${ok ? 'aynı   ' : 'FARKLI '} ${f.padEnd(34)} ${(oran * 100).toFixed(3)}% (${px} px)`);
  if (farkDir && px) writeFileSync(join(farkDir, f), PNG.sync.write(D));
}
console.log(kotu ? `\ngorsel-fark: ${kotu}/${n} görüntü eşik (%${(esik * 100).toFixed(3)}) üstü` : `\ngorsel-fark: ${n} görüntü eşik altında`);
process.exit(kotu ? 1 : 0);
