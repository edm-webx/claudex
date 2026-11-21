// EKO-01: ekonomi ölçüm tezgahını koşar. Kullanım: node tools/ekonomi-olc.mjs [--saat 3] [--hedef] [--cikti <klasör>]
// Çıktı: tablo (konsol), egri-*.csv ve egri.html (varsayılan: <geçici>/ekonomi-olc). Repoya yazmaz.
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const a = process.argv.slice(2), al = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
const env = { ...process.env, EKO_CIKTI: al('--cikti') || join(tmpdir(), 'ekonomi-olc') };
if (al('--saat')) env.EKO_UZUN = al('--saat');
if (a.includes('--hedef')) env.EKO_HEDEF = '1';
const r = spawnSync('npx', ['vitest', 'run', 'tests/sim/ekonomi-egri.test.ts', 'tests/sim/ekonomi-istismar.test.ts'], { stdio: 'inherit', env, cwd: new URL('..', import.meta.url).pathname });
console.log('çıktı klasörü: ' + env.EKO_CIKTI);
process.exit(r.status ?? 1);
