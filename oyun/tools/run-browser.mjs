// Lead-owned. Runs browser specs (tests/browser/*.spec.mjs and bot-*.mjs) one by one with the global playwright on NODE_PATH.
// Usage: npm run test:browser [-- <name-filter>]. Each spec is a plain Node script that exits non-zero on failure.
import { readdirSync, existsSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
const dir = 'tests/browser';
const filter = process.argv[2] || '';
if (!existsSync(dir)) { console.log('no browser tests yet'); process.exit(0); }
const files = readdirSync(dir).filter(f => /(\.spec\.mjs|^bot-.*\.mjs)$/.test(f) && f.includes(filter)).sort();
const globalRoot = execSync('npm root -g').toString().trim();
const env = { ...process.env, NODE_PATH: [globalRoot, process.env.NODE_PATH].filter(Boolean).join(':') };
let failed = 0;
for (const f of files) {
  console.log(`\n=== ${f}`);
  const r = spawnSync(process.execPath, [join(dir, f)], { stdio: 'inherit', env });
  if (r.status !== 0) { failed++; console.log(`FAIL ${f} (exit ${r.status})`); }
}
console.log(`\n${files.length - failed}/${files.length} browser specs passed`);
process.exit(failed ? 1 : 0);
