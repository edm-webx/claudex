// DKN-18: bina iç mekânlarında heykel yok; sakinler gerçek aktör (odaya yaklaşınca doğar, uzaklaşınca kalkar, yürür/iş yapar).
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeSandbox, type Sandbox } from './agents-harness';
import { IC_BY_ID } from '../../src/content/ic-mekan';

const near = (sb: Sandbox, id: string) => { const m = IC_BY_ID[id]; sb.player.x = m.x; sb.player.z = m.z; };
const far = (sb: Sandbox) => { sb.player.x = -200; sb.player.z = -200; };
const rows = (sb: Sandbox, oda?: string) => sb.h.icSakin.rows().filter(r => !oda || r.oda === oda);

it('approaching a room spawns its residents under the cap, leaving removes them all', () => {
  const sb = makeSandbox(1); sb.host.hour_ = 10.5;
  far(sb); sb.step(2); expect(sb.h.icSakin.count()).toBe(0);
  for (const id of ['banka', 'acil', 'morg']) {
    near(sb, id); sb.step(3);
    expect(rows(sb, id).length, id).toBeGreaterThan(0); expect(sb.h.icSakin.count()).toBeLessThanOrEqual(25);
    far(sb); sb.step(1); expect(sb.h.icSakin.count(), id + ' gone').toBe(0);
  }
});

it('residents are real actors: they move, and the bank clerk is named', () => {
  const sb = makeSandbox(2); sb.host.hour_ = 10.5;
  near(sb, 'banka'); sb.step(2);   // 2026-11-28: hastane ve okul kendi diyarlarında (hastane-yasam.ts, okul-yasam.ts)
  const pos0 = rows(sb).map(r => ({ ...r })); let enUzak = 0; const acts = new Set<string>();
  for (let i = 0; i < 60; i++) { sb.step(2); for (const r of rows(sb)) { acts.add(r.act); const q = pos0.find(o => o.id === r.id && o.oda === r.oda); if (q) enUzak = Math.max(enUzak, Math.hypot(r.x - q.x, r.z - q.z)); } }
  expect(enUzak).toBeGreaterThan(0.5);
  expect(acts.has('walk')).toBe(true);
  far(sb); sb.step(1); near(sb, 'banka'); sb.step(3);
  expect(sb.h.registry.list.some(a => a.kind === 'sakin' && a.info.name === 'Selim')).toBe(true);
});

// okul 2026-11-28'den beri kendi diyarında: tests/sim/okul-yasam.test.ts

it('no static human props left in the room view (only the büfe halls\' allowed ones)', () => {
  const src = readFileSync('src/game/view/world/ic-mekan-look.ts', 'utf8');
  expect(src).not.toMatch(/person\('(teacher|student|clerk|nurse|doctor|patient|chef|barista)'/);
  for (const l of src.split('\n').filter(x => /person\('/.test(x))) expect(/gozleme:|if \(k < n\)/.test(l), l.slice(0, 80)).toBe(true);
});
