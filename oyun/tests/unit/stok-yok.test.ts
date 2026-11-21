// Sahibin kırmızı çizgileri: stok, bayat yemek, Deney Tezgahı, stant, özel istek, günün yemeği, kapkaççı ve müdavim sistemi kodda yok.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(d: string, out: string[] = []): string[] {
  for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (p.endsWith('.ts')) out.push(p); }
  return out;
}
const YASAK = [/maxStock/, /havaStock/, /buyStant/, /TUM_STANTLAR/, /STALE_S\b/, /MALZEMELER/, /DENEY_COST/, /REQUEST_CHANCE/, /SEASON_FOODS/, /YENI_MUDAVIMLER/, /createKapkac/, /createRegulars/, /YORUMLAR/, /COMPLAINTS/];

describe('stok ve kaldırılan sistemler', () => {
  it('src içinde yasak sözcük yok', () => {
    const bulunan: string[] = [];
    for (const f of walk('src')) { const s = readFileSync(f, 'utf8'); for (const re of YASAK) if (re.test(s)) bulunan.push(f + ' ' + re); }
    expect(bulunan).toEqual([]);
  });
});
