// M1 browser bot (Builder D): the v2 gameplay bot ported to Martı Motoru. Plays the first session in the built page via
// window.__marti (full v2 `__bufe` surface), checks the 32-step table and saves screenshots with the v2 names
// (game-*.png, in tests/browser/shots-m1/ for side-by-side with v2 test/game-*.png).
// Usage: NODE_PATH=$(npm root -g) node tests/browser/bot-m1.mjs [minutes=22] [tier=dengeli] [seed=1]   (SKIP_BUILD=1 to reuse dist)
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { STEPS, OFF, findEvent, evaluate } from '../../src/game/ui/bot-ai.mjs';

const MIN = +(process.argv[2] || 22), TIER = process.argv[3] || 'dengeli', SEED = +(process.argv[4] || 1);
const DIST = resolve(process.env.MARTI_DIST || 'dist');
if (!process.env.SKIP_BUILD && !process.env.MARTI_DIST) execSync('npx vite build && node tools/build-artifact.mjs', { stdio: 'inherit' });
const SHOTS = resolve('tests/browser/shots-m1'); mkdirSync(SHOTS, { recursive: true });
const SHOT = n => join(SHOTS, 'game-' + n + '.png');
const shotFails = [];
// SwiftShader screenshots can stall under load: retry once, then log and go on (a missing picture is not a game error)
const snap = async (pg, path) => { console.log('shot ' + path.replace(/^.*game-/, '') + ' @' + Math.round((Date.now() - t0) / 1000) + 's'); for (let i = 0; i < 2; i++) { try { await pg.screenshot({ path, timeout: 60000 }); return; } catch (e) { if (i) { shotFails.push(path); console.log('screenshot failed: ' + path); } } } };

const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' };
const srv = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/' || p === '/index.html') { res.writeHead(200, { 'content-type': types['.html'] }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p);
  if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/`;

const botSrc = readFileSync(resolve('src/game/ui/bot-ai.mjs'), 'utf8').replace(/export function makeBot/, 'window.makeBot = function makeBot').replace(/^export .*$/gms, '');

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
const t0 = Date.now();
await p.goto(`${url}?seed=${SEED}&tier=${TIER}&noloop&fresh=1`);
await p.waitForFunction(() => window.__marti && window.__marti.ready && window.__marti.ready(), null, { timeout: 30000 });
await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
await p.screenshot({ path: SHOT('00-title') });
// title and portrait pick through the UI when the buttons exist, else the hook
const clicked = await p.evaluate(() => { const x = document.querySelector('[data-play]'); if (x) { x.click(); return true; } return false; });
await p.waitForTimeout(400);
await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
await p.screenshot({ path: SHOT('01-pick') });
const picked = await p.evaluate(() => { const x = document.querySelector('[data-h="sabri"]'); if (x) { x.click(); return true; } return false; });
await p.waitForTimeout(900);
await p.evaluate(() => { const M = window.__marti; if (!M.state().started) M.play('sabri'); });
console.log('title/pick through the UI:', clicked, picked);

await p.evaluate(botSrc);
await p.evaluate(() => {
  const M = window.__marti;
  const lastUi = id => M.uiLast && M.uiLast[id];
  const B = {
    state: () => M.state(), input: (x, z) => M.input(x, z), path: (a, c) => M.path(a, c),
    claimOrder: id => M.claimOrder(id), panelModel: id => M.panelModel(id), upgradeTier: id => M.upgradeTier(id),
    decorBuy: id => M.decorAct.buy(id), saveSign: (t, f) => M.saveSign(t, f), signSet: () => !!M.state().sign || !!(M.S && M.S.sign),
    skipCeremony: () => M.skipCeremony(), tapSlow: () => M.tapSlow(), solution: () => lastUi('solution'), acceptSolution: () => M.acceptSolution(),
    jobBoardModel: () => M.panelModel('jobBoard'), hireCandidate: id => M.hireCandidate(id),
  };
  window.__bot = window.makeBot(B);
});
const catAsleep = await p.evaluate(() => { const s = window.__marti.state(); return s.cat ? s.cat.state === 'sleep' : false; });

const shotsOn = { firstCustomer: '02-first-customer', siftah: '03-siftah', padShown: '04-pad', ferryDock: '05-ferry', catRub: '06-cat', dayEnd: '07-daycard', boardOpen: '08-jobboard', takeover: '09-riza', windowOpen: '10-window', gullStare: '11-gull', workerSleep: '12-sleep', slowIcon: '13-slow', regularArrive: '14-regular', star: '15-star', kapkacGrab: '16-kapkac', vipArrive: '17-gurme', tadilatStart: '18-tadilat', tadilatDone: '19-bufe', kasaStart: '20-kasa' };
const taken = {}, curve = [];
let seen = 0;
const totalSec = MIN * 60;
const flat = r => Object.assign({}, r.data || {}, r, { ev: r.ev || r.name });
for (let sec = 0; sec < totalSec; sec++) {
  const n = await p.evaluate(() => { const M = window.__marti; for (let i = 0; i < 10; i++) { window.__bot.tick(); M.step(0.1); } M.render(); return M.events(0).length; });
  if (n > seen) {
    const fresh = (await p.evaluate(k => window.__marti.events(0).slice(k), seen)).map(flat); seen = n;
    for (const e of fresh) {
      const name = shotsOn[e.ev];
      if (name && !taken[e.ev] && !(e.ev === 'padShown' && e.key !== 'cay')) {
        taken[e.ev] = 1;
        await p.evaluate(() => { const M = window.__marti; M.step(0.6); M.renderFrames(3, 0.2); });
        await p.waitForTimeout(250); await snap(p, SHOT(name));
      }
      if (e.ev === 'gullSnatch') await p.evaluate(() => { window.__bot.gullMode++; });
    }
  }
  if (sec % 30 === 0) curve.push(await p.evaluate(() => { const s = window.__marti.state(); return { t: s.t, day: s.day, clock: s.clock, money: s.money, level: s.level, stars: s.stars, stage: s.stage, owned: s.owned.length, workers: s.workers.length }; }));
  if (sec === 400 || sec === totalSec - 1) {
    for (const id of ['menu', 'isciler', 'karne', 'gorevler', 'dekor', 'tadilat', 'kedi', 'ayarlar']) {
      await p.evaluate(pid => window.__marti.openPanel(pid), id);
      await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
      await p.waitForTimeout(200);
      await snap(p, SHOT((sec === 400 ? 'p1-' : 'p2-') + id));
      await p.evaluate(() => window.__marti.closePanel && window.__marti.closePanel());
    }
  }
}
await p.evaluate(() => window.__marti.renderFrames(3, 0.2));
await snap(p, SHOT('99-end'));
const log = (await p.evaluate(() => window.__marti.events(0))).map(flat);
const ev = evaluate(log, { catAsleep });
console.log('\n=== GDD first session (sim time + ' + OFF + ' s) ===');
for (const r of ev.rows) {
  const at = r.t == null ? null : r.t + OFF;
  const mm = at == null ? '--:--' : String(Math.floor(at / 60)).padStart(2, '0') + ':' + String(Math.round(at % 60)).padStart(2, '0');
  console.log((r.ok ? 'OK  ' : 'FAIL') + '  GDD ' + r.st.gdd.padEnd(5) + '  game ' + mm + '  ' + r.st.what);
}
console.log('acceptance: ' + ev.pass + '/' + ev.total);
curve.forEach(c => console.log(`t ${String(c.t).padStart(6)}  d${c.day} ${c.clock}  money ${String(c.money).padStart(8)}  L${c.level} stars ${c.stars} st${c.stage} pads ${c.owned} workers ${c.workers}`));
console.log('errors (' + errs.length + ')\n' + errs.slice(0, 20).join('\n'));
console.log('real time ' + Math.round((Date.now() - t0) / 1000) + ' s' + (shotFails.length ? '  screenshots failed: ' + shotFails.length : ''));
await b.close(); srv.close();
process.exit(ev.pass === ev.total && !errs.length ? 0 : 1);
