// PRF-11: game.js dökümü (hangi kaynak ne kadar yer kaplıyor). Bağımlılık yok: kaynak haritası VLQ'su elle çözülür.
//   node tools/paket-dokum.mjs [--build] [--map dosya.js.map] [--top 30] [--json çıktı.json]
// --build: geçici klasöre sourcemap'li üretim derlemesi yapar (dist/'e dokunmaz). Sayılar küçültülmüş game.js baytıdır.
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
let mapP = arg('--map');
if (arg('--build') || !mapP) {
  const d = mkdtempSync(join(tmpdir(), 'marti-dokum-'));
  const r = spawnSync('npx', ['vite', 'build', '--outDir', d, '--emptyOutDir', '--sourcemap'], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) { console.error('paket-dokum: derleme başarısız'); process.exit(2); }
  mapP = join(d, readdirSync(d).find(f => f.endsWith('.js.map')));
}
const map = JSON.parse(readFileSync(mapP, 'utf8'));
const js = readFileSync(mapP.replace(/\.map$/, ''), 'utf8').split('\n');
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', DEC = Object.fromEntries([...B64].map((c, i) => [c, i]));
function vlq(s) { const out = []; let v = 0, sh = 0; for (const ch of s) { const d = DEC[ch]; v += (d & 31) << sh; if (d & 32) sh += 5; else { out.push(v & 1 ? -(v >>> 1) : v >>> 1); v = 0; sh = 0; } } return out; }
const bytes = new Float64Array(map.sources.length); let src = 0, unmapped = 0;
map.mappings.split(';').forEach((line, li) => {
  const L = js[li] || ''; let col = 0, prevCol = 0, prevSrc = -1;
  for (const seg of line.split(',')) {
    if (!seg) continue; const f = vlq(seg); col += f[0];
    if (prevSrc >= 0) bytes[prevSrc] += col - prevCol; else unmapped += col - prevCol;
    prevCol = col; if (f.length >= 4) { src += f[1]; prevSrc = src; } else prevSrc = -1;
  }
  if (prevSrc >= 0) bytes[prevSrc] += L.length - prevCol; else unmapped += L.length - prevCol;
});
const grup = s => { s = s.replace(/^(\.\.\/)+/, ''); let m;
  if ((m = s.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)\/(.*)/))) { const p = m[1]; if (p === 'three') return m[2].includes('examples/jsm/') ? 'three/' + m[2].split('examples/jsm/')[1].split('/')[0] + '/' + m[2].split('/').pop() : 'three (çekirdek)'; return p.startsWith('@supabase') ? 'supabase (' + p + ')' : p; }
  if ((m = s.match(/src\/(game\/(sim|view|content|net)?|engine\/[^/]+|content|[^/]+)/))) return 'src/' + (m[1].replace(/\/$/, '')); return s; };
const g = new Map(), f = new Map();
map.sources.forEach((s, i) => { const k = grup(s); g.set(k, (g.get(k) || 0) + bytes[i]); f.set(s, bytes[i]); });
const total = js.reduce((a, l) => a + l.length + 1, 0), KB = n => (n / 1024).toFixed(1).padStart(8) + ' KB';
const top = +arg('--top', 30);
console.log(`game.js ${(total / 1048576).toFixed(3)} MiB, gzip ${(gzipSync(js.join('\n'), { level: 9 }).length / 1024).toFixed(0)} KB, eşlenmeyen ${KB(unmapped)}`);
console.log('\nGRUP'); [...g].sort((a, b) => b[1] - a[1]).slice(0, top).forEach(([k, v]) => console.log(KB(v), (v / total * 100).toFixed(1).padStart(5) + '%', k));
console.log('\nDOSYA'); [...f].sort((a, b) => b[1] - a[1]).slice(0, top).forEach(([k, v]) => console.log(KB(v), k.replace(/^(\.\.\/)+/, '')));
const jo = arg('--json'); if (jo && jo !== true) writeFileSync(jo, JSON.stringify({ total, grup: Object.fromEntries(g), dosya: Object.fromEntries(f) }, null, 1));
