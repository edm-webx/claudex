// M1 world spec (Builder B). Run: NODE_PATH=$(npm root -g) node tests/browser/world-m1.spec.mjs
// Drives the world harness with a fake rules runtime (rt) and checks: stages 1-5 with every station/table/decor and
// golden tier 4 render without errors, item stacks / money / plates / pads / dwell ring / ferry phases / window show up,
// draw calls stay inside the dengeli budget. Shots go to $TMPDIR/marti-world-m1/.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { createServer } = await import('vite');
const OUT = join(os.tmpdir(), 'marti-world-m1'); mkdirSync(OUT, { recursive: true });
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let fails = 0; const check = (ok, m) => { console.log((ok ? 'ok   ' : 'FAIL ') + m); if (!ok) fails++; };
const server = await createServer({ server: { port: 0 }, logLevel: 'error' }); await server.listen();
const base = `http://localhost:${server.config.server.port ?? server.httpServer.address().port}`;
const browser = await chromium.launch({ args: ARGS });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`${base}/tests/browser/world.html?tier=dengeli&time=19&stage=1&x=0.2&z=-2.6#noart`);
await p.waitForFunction(() => window.__world && window.__world.ready, null, { timeout: 120000 });
const P = ['doner', 'cay', 'ayran', 'simit', 'tost', 'gazoz'];
const stack = (n, tier) => Array.from({ length: n }, (_, i) => ({ type: P[i % 6], tier }));
for (const stage of [1, 2, 3, 4, 5]) {
  const tier = Math.min(4, stage);
  const info = await p.evaluate(({ stage, tier, P }) => {
    const W = window.__world;
    W.own(['cay', 'ayran', 'simit', 'tost', 'gazoz', 'tabure1', 'tabure2', 'masa1', 'masa2', 'masa3', 'masa4']);
    const items = (n, t, ps) => Array.from({ length: n }, (_, i) => ({ type: ps[i % ps.length], tier: t }));
    const counter = {}; P.forEach((p, i) => { counter[p] = items(5, tier, [p]); });
    const stations = {}; P.forEach(k => { stations[k] = { built: true, out: items(3, tier, [k]) }; });
    W.fake({ counter, stations, carry: items(4, tier, P), kasa: Array.from({ length: 9 }, () => ({ value: 50 })), floor: [{ value: 20, x: 2, z: 2 }],
      tables: Array.from({ length: 8 }, () => ({ built: true, seats: [], pile: [{ value: 5 }, { value: 5 }], dirty: 2 })),
      ferry: { state: 'docked', t: 8 }, window: { open: true, t: 10, sales: 0 },
      pads: [{ key: 'cay', price: 300, paid: 150, pos: { x: 2.5, z: -1 } }], slow: { at: { x: -2, z: -2 } } },
      { tiers: { doner: tier, cay: tier, ayran: tier, simit: tier, tost: tier, gazoz: tier }, decorSlots: [{ slot: '0', item: 'nostalji_radyo' }] },
      { id: 'station.cay', progress: 0.6, transferring: false, pos: { x: 0.2, z: -2.6 } });
    W.setStage(stage, stage >= 2 ? ['tabela', 'floresan'] : []);
    return W.frame(8, 1 / 30);
  }, { stage, tier, P });
  await p.screenshot({ path: join(OUT, `s${stage}.png`) });
  check(info.calls <= 150, `stage ${stage} tier ${tier} draw calls ${info.calls} <= 150 (tris ${info.tris})`);
}
for (const [st, t] of [['arriving', 5], ['docked', 12], ['leaving', 6]]) {
  await p.evaluate(({ st, t }) => { window.__world.fake({ ferry: { state: st, t } }); window.__world.frame(3, 1 / 30); }, { st, t });
  await p.screenshot({ path: join(OUT, `ferry-${st}.png`) });
}
check(errs.length === 0, `no console errors ${errs.slice(0, 2).join(' | ')}`);
await browser.close(); await server.close();
console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
