// itch.io paketi: dist/ içeriği zip KÖKÜNE (index.html + game.js kökte). Çıktı: marti-itch.zip (repo dışına yazılır: --cikti).
import { execFileSync } from 'node:child_process'; import { existsSync, rmSync } from 'node:fs'; import { resolve, join } from 'node:path';
const i = process.argv.indexOf('--cikti'); const out = resolve(i > 0 ? process.argv[i + 1] : 'marti-itch.zip'); const dist = resolve('dist');
if (!existsSync(join(dist, 'index.html')) || !existsSync(join(dist, 'game.js'))) { console.error('pack-itch: dist/index.html veya game.js yok'); process.exit(2); }
if (existsSync(out)) rmSync(out);
execFileSync('zip', ['-r', '-X', out, '.'], { cwd: dist, stdio: 'ignore' });
const list = execFileSync('unzip', ['-Z1', out]).toString().split('\n').filter(Boolean);
for (const k of ['index.html', 'game.js']) if (!list.includes(k)) { console.error('pack-itch: zip kökünde ' + k + ' yok'); process.exit(1); }
console.log(`pack-itch: ${out} (${list.length} dosya, kökte index.html + game.js)`);
