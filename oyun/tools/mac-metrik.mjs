// FUT-01: başsız toplu maç koşumu + Türkçe rapor. Ölçüm mantığı src/game/sim/mac-olcum.ts'te (saf); bu araç onu esbuild ile
// paketleyip çalıştırır. Set: N seed x 3 formasyon çifti x 3 beceri x (bot-bot + 3 insan botu kişiliği) = 36N maç, sabit 1/60 adım.
// Kullanım: node tools/mac-metrik.mjs [--n 14] [--guc 500] [--out klasor] [--etiket taban]
//   --n    seed sayısı (14 -> 504 maç)      --guc  güçlü(0.7) vs zayıf(0.5) maç sayısı (0 = atla)
//   --out  JSON + rapor klasörü (yoksa yalnız ekrana)   --etiket dosya adı öneki
import { build } from 'esbuild';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const N = +arg('n', 14), GUC = +arg('guc', 500), OUT = arg('out', ''), ETIKET = arg('etiket', 'mac-metrik');
const kok = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gecici = join(tmpdir(), `mac-olcum-${process.pid}.mjs`);
await build({ entryPoints: [join(kok, 'src/game/sim/mac-olcum.ts')], bundle: true, format: 'esm', platform: 'node', outfile: gecici, logLevel: 'error' });
const O = await import(pathToFileURL(gecici).href); rmSync(gecici, { force: true });

const t0 = Date.now(), maclar = [];
for (let s = 0; s < N; s++) for (const f of O.FORM_CIFTLERI) for (const sk of O.BECERILER) for (const bot of [null, ...O.KISILIKLER]) {
  maclar.push(O.macKos({ seed: 1 + s * 7919 + maclar.length * 31, formations: f, skill: sk, bot }));
}
const ozet = O.topla(maclar), botBot = O.topla(maclar.filter(x => !x.bot)), insan = O.topla(maclar.filter(x => x.bot));
const kalip = O.FORM_CIFTLERI.map(f => O.kalipYolu(Array.from({ length: 12 }, (_, i) => 101 + i * 977), f));
const guc = GUC > 0 ? O.gucFarki(0.7, 0.5, GUC) : null;
const sure = Math.round((Date.now() - t0) / 1000);
const E = O.ESIK, ok = (b) => (b ? 'tamam' : 'HEDEF DIŞI');
const satir = [
  `# Maç kalitesi raporu (${ETIKET})`, `${maclar.length} maç (bot-bot ${botBot.mac}, insan botu ${insan.mac}), ${sure} sn. Sabit 1/60 adım, 2 x 75 sn.`, '',
  '| Metrik | Değer | Hedef | Durum |', '|---|---|---|---|',
  `| Kaleci kovalama (ort / en kötü maç) | ${ozet.kaleciKovalamaOrt} / ${ozet.kaleciKovalamaMax} | < ${E.kaleciKovalama} | ${ok(ozet.kaleciKovalamaMax < E.kaleciKovalama)} |`,
  `| Kaleci alan dışı süre | ${ozet.kaleciAlanDisiOrt} | < ${E.kaleciAlanDisi} | ${ok(ozet.kaleciAlanDisiOrt < E.kaleciAlanDisi)} |`,
  `| Kaleci y'sinin uzak topa eğimi | ${ozet.kaleciEgimOrt} | küçük (1 = birebir takip) | - |`,
  `| En uzun takılma (sn) / >3 sn maç | ${ozet.takilmaMax} / ${ozet.takilma3snMac} | 0 maç | ${ok(ozet.takilma3snMac === 0)} |`,
  `| Duvara yapışma en uzun (sn) | ${ozet.duvarMax} | < 3 | ${ok(ozet.duvarMax < 3)} |`,
  `| Taşıyıcı çizgide takılma en uzun (sn) | ${ozet.tasiyiciCizgiMax} | < 0.8 | ${ok(ozet.tasiyiciCizgiMax < 0.8)} |`,
  `| Jitter (yön değişimi/sn, ort / max) | ${ozet.jitterOrt} / ${ozet.jitterMax} | < ${E.jitter} | ${ok(ozet.jitterMax < E.jitter)} |`,
  `| Pas isabeti (bot-bot) | ${botBot.pasIsabet} | ${E.pasIsabet.join('-')} | ${ok(botBot.pasIsabet >= E.pasIsabet[0] && botBot.pasIsabet <= E.pasIsabet[1])} |`,
  `| Pas/maç, ort. uzunluk (m), ileri/geri/yan | ${ozet.pasMacOrt}, ${ozet.pasUzOrt}, ${ozet.pasIleri}/${ozet.pasGeri}/${ozet.pasYan} | - | - |`,
  `| Şut/takım (bot-bot) | ${botBot.sutTakimOrt} | ${E.sutTakim.join('-')} | ${ok(botBot.sutTakimOrt >= E.sutTakim[0] && botBot.sutTakimOrt <= E.sutTakim[1])} |`,
  `| İsabet oranı, xG/takım, gol/xG | ${ozet.isabetOran}, ${ozet.xgTakimOrt}, ${ozet.golXgOran} | - | - |`,
  `| Gol/maç ort (min-max, %10-%90) | ${ozet.golOrt} (${ozet.golMin}-${ozet.golMax}, ${ozet.golYuzde10}-${ozet.golYuzde90}) | ${E.golMac.join('-')} | ${ok(ozet.golOrt >= E.golMac[0] && ozet.golOrt <= E.golMac[1])} |`,
  `| Topa sahip olma aralığı (%, bot-bot / tümü) | ${botBot.sahipMin}-${botBot.sahipMax} / ${ozet.sahipMin}-${ozet.sahipMax} | 25-75 (bot-bot) | ${ok(botBot.sahipMin >= 25 && botBot.sahipMax <= 75)} |`,
  `| Yığılma (≥5 oyuncu 4 m içinde) | ${ozet.yigilmaOrt} | < 0.3 | ${ok(ozet.yigilmaOrt < 0.3)} |`,
  `| Takım arkadaşı çakışması (<1.5 m) | ${ozet.cakismaOrt} | düşük | - |`,
  `| Alan kapsamı (ısı entropisi 0-1) | ${ozet.kapsamOrt} | yüksek | - |`,
  `| Olay n-gram: tekil 3-gram / 4-gram, en sık 3-gram payı | ${ozet.ngram3} / ${ozet.ngram4}, ${ozet.ngram3EnSik} | çok çeşit, pay düşük | - |`,
  `| Başlama vuruşu yol farkı (m, 3 formasyon) | ${kalip.join(' / ')} | > 4 (küçük = kalıp) | ${ok(Math.min(...kalip) > 4)} |`,
  `| Farklı skor sayısı | ${ozet.skorCesit} | çeşitli | - |`,
  `| Faul/maç | ${ozet.faulMac} | ${E.faulMac.join('-')} | ${ok(ozet.faulMac >= E.faulMac[0] && ozet.faulMac <= E.faulMac[1])} |`,
  `| Kart/maç, direk/maç, penaltı/maç | ${ozet.kartMac}, ${ozet.direkMac}, ${ozet.penaltiMac} | - | - |`,
  `| Duran top/maç | ${Object.entries(ozet.duranTopMac).map(([k, v]) => k + ' ' + v).join(', ')} | - | - |`,
  guc ? `| Güçlü (0.7) vs zayıf (0.5), ${guc.n} maç: G/B/M | ${guc.galibiyet.toFixed(3)} / ${guc.beraberlik.toFixed(3)} / ${guc.yenilgi.toFixed(3)} | G > 0.6, M 0.1-0.3 | ${ok(guc.galibiyet > 0.6)} |` : '',
].filter(Boolean);
console.log(satir.join('\n'));
if (OUT) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, ETIKET + '.json'), JSON.stringify({ etiket: ETIKET, sure, ozet, botBot, insan, kalip, guc, maclar: maclar.map(({ olaylar, ...x }) => ({ ...x, olayN: olaylar.length })) }, null, 1));
  writeFileSync(join(OUT, ETIKET + '.md'), satir.join('\n') + '\n');
  console.log('\nyazıldı:', join(OUT, ETIKET + '.json'));
}
