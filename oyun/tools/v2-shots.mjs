// v2 reference shots for look parity (Builder D). Runs the v2 game READ-ONLY from its folder (files are only read and
// served through Playwright routes; nothing under 3d/v2 is written) and saves into tests/fixtures/v2-shots/:
//   s{1,2}-{09,13,19,22}-{noart,art}.{png,jpg,color.png,nodyn.png,id.png}   (see tools/shot-compare.mjs)
//   chars-heroes.png      v2 test/chars.html 'heroes' view (390x844, DPR 2, like v2 chars-shot.js)
//   hud-ref.png           copy of v2 test/game-02-first-customer.png (HUD band reference)
//   crowd-s1.json / crowd-s2.json   v2 crowd snapshot (x, z, rot, type, act, sit) after a 20 s warm-up
//   meta.json             per shot: renderer.info, player pos, camera, categories seen
// How v2 is put in each state: a v2-format save (hero sabri, stage N, tutorial done, quality dengeli) is written to
// localStorage before boot under its own key (?save=parity-sN), then S.dayT is set per hour and the sim stepped 0.4 s
// (v2 calls world.setTime every 0.2 s of sim). requestAnimationFrame is frozen like v2 test/bot.js.
// Usage: NODE_PATH=$(npm root -g) node tools/v2-shots.mjs [outDir] [filter-regex] [--fixture-only]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { MASK_KIT, saveDataUrl, SHOT_NAMES, parseShot } from './shot-compare.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const V2 = process.env.V2_DIR || '/mnt/project-files/sosisci-oyun/3d/v2';
const ARGV = process.argv.slice(2).filter(a => !a.startsWith('--'));
const OUT = path.resolve(ARGV[0] || 'tests/fixtures/v2-shots');
const FILTER = ARGV[1] ? new RegExp(ARGV[1]) : null;
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const TYPES = { js: 'application/javascript; charset=utf-8', json: 'application/json', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', html: 'text/html; charset=utf-8' };
fs.mkdirSync(OUT, { recursive: true });

const fnv = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
function v2Save(stage) {
  const tut = { firstCut: 1, firstCustomer: 1, firstDrop: 1, firstCollect: 1, siftah: 1, pad: 1, done: 1 };
  const body = JSON.stringify({ v: 1, hero: 'sabri', stage, renewed: [], day: 1, dayT: 15, playT: 30, tut, lastSeen: 0, seed: 1,
    settings: { muted: true, quality: 'dengeli', autoTier: 'dengeli' } });
  return JSON.stringify({ at: 1, sum: fnv(body), body });
}

// injected right after three.min.js: remember the last scene/camera/renderer used to draw (r160 defines render()
// inside the constructor, so the instance method is wrapped)
const PATCH_THREE = `<script>(function(){var O=THREE.WebGLRenderer;THREE.WebGLRenderer=function(a){var r=new O(a);var R=r.render;r.render=function(s,c){if(s&&s.isScene&&!window.__pkBusy)window.__v2h={scene:s,camera:c,renderer:r};return R.apply(r,arguments);};return r;};THREE.WebGLRenderer.prototype=O.prototype;})();</script>`;
// injected right after chars.js: shadow every crowd member for the fixture
const PATCH_CROWD = `<script>(function(){var CH=window.SB&&SB.chars;if(!CH||!CH.makeCrowd)return;var mk=CH.makeCrowd;CH.makeCrowd=function(){var cr=mk.apply(this,arguments);var M=window.__v2crowd=new Map();var a=cr.add,s=cr.set,r=cr.remove;cr.add=function(L){var id=a.apply(cr,arguments);if(id!=null&&id!==-1)M.set(id,{type:L&&L.type,x:0,z:0,rot:0,act:'idle',sit:0});return id;};cr.set=function(id,o){var m=M.get(id);if(m&&o){['x','z','rot','act','sit','speed'].forEach(function(k){if(o[k]!=null)m[k]=o[k];});}return s.apply(cr,arguments);};cr.remove=function(id){M.delete(id);return r.apply(cr,arguments);};return cr;};})();</script>`;

async function openGame(b, stage, noart, errs) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const tag = `[v2 s${stage}${noart ? ' noart' : ''}]`;
  p.on('pageerror', e => errs.push(tag + ' PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(tag + ' CONSOLE ' + m.text()); });
  await p.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }, [`parity-s${stage}:0`, v2Save(stage)]);
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ path: path.join(V2, 'test/vendor/three.min.js'), contentType: TYPES.js }));
  await p.route('http://bufe.test/**', r => {
    const u = new URL(r.request().url()); const f = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname);
    const fp = path.join(V2, f);
    if (!fp.startsWith(V2) || !fs.existsSync(fp)) return r.fulfill({ status: 404, body: '' });
    if (f === '/index.html') {
      let html = fs.readFileSync(fp, 'utf8');
      html = html.replace('<script src="https://cdn.jsdelivr.net', '<script>window.requestAnimationFrame=()=>0;</script><script src="https://cdn.jsdelivr.net');
      html = html.replace(/(<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>)/, '$1' + PATCH_THREE);
      html = html.replace('<script src="js/chars.js"></script>', '<script src="js/chars.js"></script>' + PATCH_CROWD);
      return r.fulfill({ contentType: TYPES.html, body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + html + '</body></html>' });
    }
    r.fulfill({ path: fp, contentType: TYPES[f.split('.').pop().toLowerCase()] || 'application/octet-stream' });
  });
  await p.goto(`http://bufe.test/?seed=1&tier=dengeli&save=parity-s${stage}&autoplay` + (noart ? '#noart' : ''));
  await p.waitForFunction(() => window.__bufe && window.__bufe.ready(), null, { timeout: 60000 });
  if (!noart) await p.waitForFunction(() => { const A = window.SB && SB.art; return !A || A.off || !A.pending || A.pending() === 0; }, null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(800); // art images decode
  await p.evaluate(kit => { window.__bufe.renderFrames(1, 1 / 30); const h = window.__v2h; const PL = window.__bufe.PL; (0, eval)('(' + kit + ')')({ ...h, T: THREE, extraDyn: PL && PL.rig ? [PL.rig.group] : [] }); }, MASK_KIT);
  return { p, ctx };
}

async function grab(p, base, info) {
  // eye-check shot like motor parity mode: HUD only (toasts, menu bar, pads' DOM labels hidden)
  await p.addStyleTag({ content: '#sbui>:not(.sb-hud){display:none!important}' });
  await p.screenshot({ path: base + '.png' });
  await p.screenshot({ path: base + '.jpg', type: 'jpeg', quality: 82 });
  for (const mode of ['color', 'nodyn', 'id']) {
    const url = await p.evaluate(m => { window.__pkBusy = true; try { return window.__pk.grab(m); } finally { window.__pkBusy = false; } }, mode);
    saveDataUrl(`${base}.${mode}.png`, url);
  }
  return info;
}

// src/game/parity/fixture.ts from the crowd snapshots + v2 player/camera (Builder D owns that file)
const CITIZEN_IDS = ['teyze', 'emekli', 'universiteli', 'okul', 'plaza', 'taraftar', 'taksici', 'gecekusu', 'simitci', 'hamal', 'oltaci', 'kurye', 'muzisyen', 'boyaci', 'midyeci', 'kestaneci', 'kruvaziyer', 'gezgin', 'vlogcu', 'balayi', 'turgrubu', 'isinsani', 'vapuryolcusu', 'bebekarabali'];
function writeFixture() {
  const meta = fs.existsSync(path.join(OUT, 'meta.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'meta.json'), 'utf8')) : {};
  const crowd = {}, player = {};
  for (const st of [1, 2]) {
    const f = path.join(OUT, `crowd-s${st}.json`);
    crowd[st] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
    const m = meta[`s${st}-09-noart`]; if (m) player[st] = { pos: m.pos, cam: m.cam };
  }
  const ts = `// GENERATED by tools/v2-shots.mjs from the v2 game (read-only run). Do not edit by hand. Owner: Builder D.
// v2 crowd snapshot after a 20 s warm-up at 09:00 (seed 1, tier dengeli) and v2 player / camera position per stage.
export const V2_CITIZEN_IDS = ${JSON.stringify(CITIZEN_IDS)} as const;
export interface ParityCitizen { type: string; x: number; z: number; rot: number; act: string; sit: number; }
export const PARITY_CROWD: Record<number, ParityCitizen[]> = ${JSON.stringify(crowd)};
export const PARITY_PLAYER: Record<number, { pos: { x: number; z: number }; cam: number[] }> = ${JSON.stringify(player)};
`;
  const dst = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../src/game/parity/fixture.ts');
  fs.writeFileSync(dst, ts);
  console.log('wrote', dst);
}
if (process.argv.includes('--fixture-only')) { writeFixture(); process.exit(0); }

(async () => {
  const b = await chromium.launch({ args: ARGS });
  const errs = [], meta = {};
  const t0 = Date.now();
  for (const stage of [1, 2]) for (const noart of [true, false]) {
    const names = SHOT_NAMES.filter(n => { const s = parseShot(n); return s.stage === stage && s.art === !noart && (!FILTER || FILTER.test(n)); });
    if (!names.length) continue;
    const { p, ctx } = await openGame(b, stage, noart, errs);
    // warm-up so the pier has its everyday crowd, then snapshot the crowd for src/game/parity/fixture.ts
    await p.evaluate(() => { const B = window.__bufe; B.S.dayT = 15; for (let i = 0; i < 20; i++) B.step(1); });
    if (noart) {
      const crowd = await p.evaluate(() => [...(window.__v2crowd || new Map()).values()].map(c => ({ type: c.type, x: +c.x.toFixed(2), z: +c.z.toFixed(2), rot: +(+c.rot).toFixed(3), act: c.act, sit: c.sit ? 1 : 0 })));
      fs.writeFileSync(path.join(OUT, `crowd-s${stage}.json`), JSON.stringify(crowd));
      console.log(`crowd-s${stage}: ${crowd.length} citizens`);
    }
    for (const name of names) {
      const { hour } = parseShot(name);
      const info = await p.evaluate(h => {
        const B = window.__bufe; B.S.dayT = (h - 8) * 15; B.step(0.4); B.renderFrames(9, 1 / 30); // 0.3 s: v2 HUD refreshes every 0.25 s
        const s = B.state(), i = B.info(), h2 = window.__v2h, c = h2.camera.position;
        return { clock: s.clock, pos: s.pos, stage: s.stage, calls: i.calls, tris: i.triangles, geos: i.geometries, texs: i.textures, cam: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)], cats: window.__pk.cats() };
      }, hour);
      await grab(p, path.join(OUT, name), info);
      meta[name] = info;
      console.log(name, JSON.stringify(info));
    }
    await ctx.close();
  }
  // character lineup (v2 test/chars.html, as v2 chars-shot.js does it)
  if (!FILTER || FILTER.test('chars')) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push('[chars] ' + e.message));
    await p.goto('file://' + path.join(V2, 'test/chars.html') + '#heroes');
    await p.waitForFunction(() => window.__chars && window.__chars.ready, null, { timeout: 30000 });
    await p.evaluate(() => window.__chars.setView('heroes'));
    await p.waitForTimeout(300);
    await p.evaluate(() => window.__chars.step(45, 1 / 30));
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, 'chars-heroes.png') });
    await ctx.close();
    console.log('chars-heroes.png');
  }
  fs.copyFileSync(path.join(V2, 'test/game-02-first-customer.png'), path.join(OUT, 'hud-ref.png'));
  const old = fs.existsSync(path.join(OUT, 'meta.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'meta.json'), 'utf8')) : {};
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ ...old, ...meta, _at: new Date().toISOString() }, null, 1));
  writeFixture();
  console.log(`done in ${Math.round((Date.now() - t0) / 1000)} s, errors: ${errs.length ? '\n' + errs.join('\n') : 'none'}`);
  await b.close();
})().catch(e => { console.error('V2 SHOTS CRASH', e); process.exit(1); });
