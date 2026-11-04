// Owner: Builder A. CONTRACT M0 acceptance 1: dist/ size + page contract + bundle hygiene. Exit 1 on any failure.
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = process.argv[2] || 'dist';
const errs = [];
const MB = 1024 * 1024;
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
if (!existsSync(dist)) { console.error(`check-dist: ${dist} missing`); process.exit(1); }
const files = walk(dist);
let total = 0;
for (const f of files) {
  const s = statSync(f).size; total += s;
  if (s > 16 * MB) errs.push(`${relative(dist, f)} is ${(s / MB).toFixed(1)} MB (> 16 MB)`);
}
if (files.length > 40) errs.push(`${files.length} files (> 40)`);
if (total > 30 * MB) errs.push(`total ${(total / MB).toFixed(1)} MB (> 30 MB)`);

// page contract
const idxP = join(dist, 'index.html');
if (!existsSync(idxP)) errs.push('index.html missing');
else {
  const h = readFileSync(idxP, 'utf8');
  if (/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i.test(h)) errs.push('index.html has doctype/html/head/body');
  if (!/^\s*<title>Sabri'nin Büfesi<\/title>/.test(h)) errs.push('index.html: <title> must come first');
  if (!/<div id="app">\s*<canvas id="c"><\/canvas>\s*<\/div>/.test(h)) errs.push('index.html: #app > canvas#c missing');
  if (!/id="fail"/.test(h)) errs.push('index.html: #fail missing');
  if (!/<script src="game\.js"><\/script>/.test(h)) errs.push('index.html: classic <script src="game.js"> missing');
  if (/type="module"/.test(h)) errs.push('index.html: module script not allowed');
  if (/https?:\/\//.test(h)) errs.push('index.html: external URL');
}

// bundle hygiene
const gameP = join(dist, 'game.js');
if (!existsSync(gameP)) errs.push('game.js missing');
else {
  const js = readFileSync(gameP, 'utf8');
  const size = statSync(gameP).size;
  if (size > 2.5 * MB) errs.push(`game.js ${(size / MB).toFixed(2)} MB (> 2.5 MB)`);
  // Allowlist: W3C namespace strings for createElementNS (xhtml from three.js, svg from the UI) and three.js's
  // console-warning link. Nothing is ever fetched from them. Block comments (license banners) are ignored.
  const ALLOW = [/^http:\/\/www\.w3\.org\/(1999\/xhtml|2000\/svg)$/, /^https:\/\/discourse\.threejs\.org\/t\/updates-to-lighting-in-three-js-r155\/53733\.?$/];
  const code = js.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of code.matchAll(/https?:\/\/[^\s"'`)\\]+/g)) if (!ALLOW.some(r => r.test(m[0]))) errs.push(`game.js: external URL ${m[0]}`);
  const banned = [[/\bserviceWorker\b/, 'serviceWorker'], [/\bWebAssembly\b/, 'WebAssembly'], [/(^|[^\w.$])eval\s*\(/, 'eval('], [/new\s+Function\s*\(/, 'new Function(']];
  for (const [r, name] of banned) if (r.test(js)) errs.push(`game.js contains ${name}`);
  if (/^\s*(import|export)\s/m.test(js.slice(0, 2000))) errs.push('game.js is not a classic script (ES module syntax at top)');
}

console.log(`check-dist: ${files.length} files, ${(total / MB).toFixed(2)} MB total`);
if (errs.length) { for (const e of errs) console.error('  FAIL ' + e); process.exit(1); }
console.log('check-dist: OK');
