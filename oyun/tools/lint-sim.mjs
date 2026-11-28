// Owner: Builder A. CONTRACT M0 acceptance 2 (purity): no three, window, document, Math.random, Date.now,
// performance.now in src/game/sim/** and src/engine/{core,ecs,save,nav}/** (plus src/engine/input/interactions.ts and
// src/game/headless.ts, which the headless sim imports). Comments are ignored; identifiers are checked outside strings.
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['src/game/sim', 'src/engine/core', 'src/engine/ecs', 'src/engine/save', 'src/engine/nav'];
const extraFiles = ['src/engine/input/interactions.ts', 'src/game/headless.ts'];
const walk = d => (existsSync(d) ? readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(ts|js|mjs)$/.test(f) ? [p] : []; }) : []);
const files = [...roots.flatMap(walk), ...extraFiles.filter(f => existsSync(f))];

/** Blank out comments (keep strings), and a second variant with strings blanked too. Keeps line numbers. */
function strip(src) {
  let noC = '', noCS = '';
  let i = 0;
  const n = src.length;
  const blank = s => s.replace(/[^\n]/g, ' ');
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { const j = src.indexOf('\n', i); const e = j < 0 ? n : j; noC += blank(src.slice(i, e)); noCS += blank(src.slice(i, e)); i = e; continue; }
    if (c === '/' && d === '*') { const j = src.indexOf('*/', i + 2); const e = j < 0 ? n : j + 2; noC += blank(src.slice(i, e)); noCS += blank(src.slice(i, e)); i = e; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      const e = Math.min(n, j + 1);
      noC += src.slice(i, e); noCS += c + blank(src.slice(i + 1, e - 1)) + (e - 1 > i ? c : ''); i = e; continue;
    }
    noC += c; noCS += c; i++;
  }
  return { noC, noCS };
}

const rules = [
  { name: "import of 'three'", on: 'noC', re: /(from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"]three(\/[^'"]*)?['"]/ },
  { name: 'window', on: 'noCS', re: /(?<![\w$.])window(?![\w$])/ },
  { name: 'document', on: 'noCS', re: /(?<![\w$.])document(?![\w$])/ },
  { name: 'Math.random', on: 'noCS', re: /Math\s*\.\s*random/ },
  { name: 'Date.now', on: 'noCS', re: /Date\s*\.\s*now/ },
  { name: 'performance.now', on: 'noCS', re: /performance\s*\.\s*now/ },
];

const errs = [];
for (const f of files) {
  const s = strip(readFileSync(f, 'utf8'));
  for (const r of rules) {
    const lines = s[r.on].split('\n');
    lines.forEach((l, k) => { if (r.re.test(l)) errs.push(`${f}:${k + 1}: ${r.name}`); });
  }
}
console.log(`lint-sim: ${files.length} files checked`);
if (errs.length) { for (const e of errs) console.error('  FAIL ' + e); process.exit(1); }
console.log('lint-sim: OK');
