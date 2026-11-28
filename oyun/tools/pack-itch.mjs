// itch.io paketi: dist/ içeriği zip KÖKÜNE (index.html + game.js kökte). Çıktı: marti-itch.zip (repo dışına yazılır: --cikti).
import { execFileSync } from 'node:child_process'; import { existsSync, rmSync, cpSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs'; import { resolve, join } from 'node:path'; import { tmpdir } from 'node:os';
import { itchSarmala } from './itch-html.mjs';
const i = process.argv.indexOf('--cikti'); const out = resolve(i > 0 ? process.argv[i + 1] : 'marti-itch.zip'); const dist = resolve('dist');
if (!existsSync(join(dist, 'index.html')) || !existsSync(join(dist, 'game.js'))) { console.error('pack-itch: dist/index.html veya game.js yok'); process.exit(2); }
if (existsSync(out)) rmSync(out);
// QA 2026-11-27: zip'teki index.html <!DOCTYPE html> belgesi (quirks modu olmasın); dist/ olduğu gibi kalır (claude.ai sözleşmesi)
const sahne = mkdtempSync(join(tmpdir(), 'marti-itch-'));
cpSync(dist, sahne, { recursive: true });
writeFileSync(join(sahne, 'index.html'), itchSarmala(readFileSync(join(dist, 'index.html'), 'utf8')));
try { execFileSync('zip', ['-r', '-X', out, '.'], { cwd: sahne, stdio: 'ignore' }); } finally { rmSync(sahne, { recursive: true, force: true }); }
if (!/^<!DOCTYPE html>/.test(execFileSync('unzip', ['-p', out, 'index.html']).toString())) { console.error('pack-itch: zip index.html doctype yok'); process.exit(1); }
const list = execFileSync('unzip', ['-Z1', out]).toString().split('\n').filter(Boolean);
for (const k of ['index.html', 'game.js']) if (!list.includes(k)) { console.error('pack-itch: zip kökünde ' + k + ' yok'); process.exit(1); }
console.log(`pack-itch: ${out} (${list.length} dosya, kökte index.html + game.js)`);
