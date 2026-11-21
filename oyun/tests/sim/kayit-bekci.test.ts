// KAL-02 kayıt şeması bekçisi: sim/ içinde S.zones.<anahtar> kullanan her bölge ya şemalı (zones-norm) ya da bilerek "gevşek" listede.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { ZONE_SCHEMA, OLU_ZONLAR, ZONE_GEVSEK } from '../../src/game/sim/zones-norm';

const kok = new URL('../../src/game/sim/', import.meta.url);
function dosyalar(u: URL): URL[] {
  return readdirSync(u, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? dosyalar(new URL(e.name + '/', u)) : /\.ts$/.test(e.name) ? [new URL(e.name, u)] : []));
}

describe('kayıt şeması bekçisi', () => {
  it('her zones anahtarının sanitizer ya da gevşek-liste kaydı var; ölü anahtar kodda yok', () => {
    const bulunan = new Set<string>();
    for (const f of dosyalar(kok)) {
      if (/zones-norm\.ts$|\/save\.ts$/.test(f.pathname)) continue;
      const t = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
      for (const m of t.matchAll(/(?<!content\.)\bzones(?:\?)?\.([a-z_][a-z_0-9]*)\b|\bzones\[\s*'([a-z_-]+)'\s*\]/g)) { const k = m[1] || m[2]; if (!['includes', 'slice', 'length', 'filter', 'map'].includes(k)) bulunan.add(k); }
    }
    const bilinen = new Set([...Object.keys(ZONE_SCHEMA), ...ZONE_GEVSEK]);
    const eksik = [...bulunan].filter(k => !bilinen.has(k));
    expect(eksik, 'zones-norm.ts ZONE_SCHEMA ya da ZONE_GEVSEK listesine ekle + tur testi yaz: ' + eksik.join(',')).toEqual([]);
    for (const o of OLU_ZONLAR) expect(bulunan.has(o)).toBe(false);
  });
});
