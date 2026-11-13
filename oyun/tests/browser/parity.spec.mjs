// Look parity spec (Builder D, CONTRACT M0 acceptance 6). Plain Node script (tools/run-browser.mjs runs it).
// Motor shots: 390x844, isMobile/hasTouch, tier dengeli, ?parity=1, noart and art, 09/13/19/22 h, stage 1 and 2 (16 pairs),
// compared against tests/fixtures/v2-shots (tools/v2-shots.mjs) with tools/shot-compare.mjs. Plus the character
// lineup (tests/browser/chars.html #heroes vs v2 test/chars.html) and the HUD band vs v2 game-02-first-customer.png.
// Writes OUT/<name>.* + OUT/results.json, then tools/make-parity-page.mjs builds dist/parity.html.
// Env: PARITY_URL (base URL of a running server; default: starts `vite` on port 5199), PARITY_OUT (default /tmp/marti-parity),
//      PARITY_FILTER (regex on shot names), PARITY_NO_PAGE=1 (skip dist/parity.html).
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MASK_KIT, saveDataUrl, SHOT_NAMES, parseShot, loadSet, comparePair, readPng, imageSsim, bandDeltaE, THRESH, REGIONS } from '../../tools/shot-compare.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const V2DIR = path.join(ROOT, 'tests/fixtures/v2-shots');
const OUT = process.env.PARITY_OUT || '/tmp/marti-parity';
const FILTER = process.env.PARITY_FILTER ? new RegExp(process.env.PARITY_FILTER) : null;
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
fs.mkdirSync(OUT, { recursive: true });

async function startServer() {
  const url = process.env.PARITY_URL;
  if (url) return { base: url.replace(/\/$/, ''), stop() {} };
  // vite dev server through its JS API with file watching and HMR off: other builders edit the tree while specs run,
  // and a hot reload in the middle of a shot would navigate the page away
  const { createServer } = await import(path.join(ROOT, 'node_modules/vite/dist/node/index.js'));
  const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts'), logLevel: 'error', server: { port: 5199, strictPort: true, host: '127.0.0.1', hmr: false, watch: null }, optimizeDeps: { include: ['three', 'lil-gui'] } });
  await server.listen();
  return { base: 'http://127.0.0.1:5199', stop: () => server.close() };
}

async function shootMotor(b, base, errs) {
  const meta = JSON.parse(fs.readFileSync(path.join(V2DIR, 'meta.json'), 'utf8'));
  const info = {};
  for (const stage of [1, 2]) for (const art of [false, true]) {
    const names = SHOT_NAMES.filter(n => { const s = parseShot(n); return s.stage === stage && s.art === art && (!FILTER || FILTER.test(n)); });
    if (!names.length) continue;
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    const tag = `[motor s${stage}${art ? '' : ' noart'}]`;
    p.on('pageerror', e => errs.push(`${tag} PAGEERR ${e.message}`));
    p.on('console', m => { if (m.type() === 'error') errs.push(`${tag} CONSOLE ${m.text()}`); });
    const first = parseShot(names[0]);
    await p.goto(`${base}/index.html?parity=1&seed=1&tier=dengeli&noloop&fresh=1&stage=${stage}&time=${first.hour}${art ? '' : '&noart'}`);
    let ok = false;
    for (let i = 0; i < 4 && !ok; i++) {
      try { await p.waitForFunction(() => window.__marti && window.__marti.ready && window.__marti.ready(), null, { timeout: 60000 }); await p.waitForTimeout(1000); ok = await p.evaluate(() => !!(window.__marti && window.__marti.ready && window.__marti.ready())); }
      catch { /* reload in progress */ }
    }
    if (!ok) { errs.push(`${tag} __marti.ready() never true`); await ctx.close(); continue; }
    const installKit = () => p.evaluate(k => {
      const M = window.__marti, h = M.parity && M.parity.handles ? M.parity.handles() : null;
      if (!h || !h.renderer) return false;
      return (0, eval)('(' + k + ')')(h);
    }, MASK_KIT);
    for (const name of names) {
      const { hour } = parseShot(name);
      const ref = meta[name] || meta[`s${stage}-09-noart`] || {};
      const st = await p.evaluate(([h, s, pos]) => {
        const M = window.__marti;
        const call = (k, ...a) => { try { if (typeof M[k] === 'function') return M[k](...a); } catch (e) { return 'ERR ' + e.message; } return null; };
        call('setStage', s); call('setTime', h);
        if (pos) call('teleport', pos.x, pos.z);
        call('step', 0.4);
        if (typeof M.renderFrames === 'function') M.renderFrames(9, 1 / 30); else call('render');
        const i = call('info') || {};
        return { info: { calls: i.calls, tris: i.tris, geos: i.geos, texs: i.texs }, state: call('state') };
      }, [hour, stage, ref.pos || null]);
      const kit = await installKit(); // per shot: survives an unexpected page reload
      const base2 = path.join(OUT, name);
      await p.screenshot({ path: base2 + '.png' });
      await p.screenshot({ path: base2 + '.jpg', type: 'jpeg', quality: 82 });
      if (kit) for (const mode of ['color', 'nodyn', 'id']) saveDataUrl(`${base2}.${mode}.png`, await p.evaluate(m => window.__pk.grab(m), mode));
      else for (const mode of ['color', 'nodyn', 'id']) { try { fs.unlinkSync(`${base2}.${mode}.png`); } catch { /* none */ } }
      info[name] = { ...st.info, kit: !!kit };
      console.log(`${tag} ${name} calls ${st.info.calls} tris ${st.info.tris} kit ${!!kit}`);
    }
    await ctx.close();
  }
  return info;
}

async function shootChars(b, base, errs) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('[chars] ' + e.message));
  const out = path.join(OUT, 'chars-heroes.png');
  try {
    await p.goto(`${base}/tests/browser/chars.html#heroes`);
    // vite may reload once while pre-bundling deps: wait until ready stays ready
    for (let i = 0; i < 4; i++) {
      try { await p.waitForFunction(() => window.__chars && window.__chars.ready, null, { timeout: 30000 }); await p.waitForTimeout(1500); if (await p.evaluate(() => !!(window.__chars && window.__chars.ready))) break; }
      catch (e) { if (i === 3) throw e; }
    }
    await p.evaluate(() => window.__chars.setView('heroes'));
    await p.waitForTimeout(300);
    await p.evaluate(() => window.__chars.step(45, 1 / 30));
    await p.waitForTimeout(500);
    await p.screenshot({ path: out });
    return out;
  } catch (e) { errs.push('[chars] ' + e.message); return null; }
  finally { await ctx.close(); }
}

(async () => {
  if (!fs.existsSync(path.join(V2DIR, 'meta.json'))) { console.log('no v2 reference shots: run tools/v2-shots.mjs first'); process.exit(1); }
  const srv = await startServer();
  const b = await chromium.launch({ args: ARGS });
  const errs = [];
  let info = {}, charsShot = null;
  try {
    info = await shootMotor(b, srv.base, errs);
    if (!FILTER || FILTER.test('chars')) charsShot = await shootChars(b, srv.base, errs);
  } finally { await b.close(); srv.stop(); }

  const rows = [];
  for (const name of SHOT_NAMES) {
    if (FILTER && !FILTER.test(name)) continue;
    const r = comparePair(loadSet(V2DIR, name), loadSet(OUT, name));
    r.name = name; r.info = info[name] || null;
    rows.push(r);
  }
  const extra = {};
  const v2c = readPng(path.join(V2DIR, 'chars-heroes.png')), moc = charsShot ? readPng(charsShot) : null;
  extra.chars = v2c && moc ? { ssim: +imageSsim(v2c, moc).toFixed(3) } : { ssim: null, note: 'lineup shot missing' };
  extra.chars.pass = extra.chars.ssim != null && extra.chars.ssim >= THRESH.charsSsim;
  const hudRef = readPng(path.join(V2DIR, 'hud-ref.png')), hudMo = readPng(path.join(OUT, 's1-09-noart.png'));
  extra.hud = hudRef && hudMo ? bandDeltaE(hudRef, hudMo) : { dE: null, note: 'shot missing' };
  extra.hud.pass = extra.hud.dE != null && extra.hud.dE <= THRESH.hudDeltaE;
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ at: new Date().toISOString(), thresholds: THRESH, rows, extra, errors: errs }, null, 1));

  for (const r of rows) {
    const reg = REGIONS.map(k => `${k} ${r.regions[k] ? (r.regions[k].dE ?? r.regions[k].status) : '-'}`).join(', ');
    console.log(`${r.pass ? 'OK  ' : 'FAIL'} ${r.name.padEnd(13)} ΔE[${reg}] ssim ${r.kiosk.ssim ?? '-'} bbox ${r.kiosk.bboxErr ?? '-'} ${r.notes.join('; ')}`);
  }
  console.log(`chars lineup SSIM ${extra.chars.ssim} (≥ ${THRESH.charsSsim}) ${extra.chars.pass ? 'OK' : 'FAIL'}`);
  console.log(`HUD band ΔE ${extra.hud.dE} (≤ ${THRESH.hudDeltaE}) ${extra.hud.pass ? 'OK' : 'FAIL'}`);
  console.log(`console errors: ${errs.length}${errs.length ? '\n' + errs.slice(0, 20).join('\n') : ''}`);
  if (!process.env.PARITY_NO_PAGE) spawnSync(process.execPath, [path.join(ROOT, 'tools/make-parity-page.mjs'), OUT], { stdio: 'inherit', cwd: ROOT });
  const pass = rows.filter(r => r.pass).length;
  console.log(`parity: ${pass}/${rows.length} pairs pass, chars ${extra.chars.pass ? 'pass' : 'fail'}, hud ${extra.hud.pass ? 'pass' : 'fail'}`);
  process.exit(pass === rows.length && rows.length && extra.chars.pass && extra.hud.pass && !errs.length ? 0 : 1);
})().catch(e => { console.error('PARITY CRASH', e); process.exit(1); });
