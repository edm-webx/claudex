// 2026-11-09 sahip: "dükkan zinciri saçmalığını kaldır". Zincir sim'i, arayüzü ve adı geri gelmesin.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { KIOSK_STAGES as STAGES } from '../../src/content/stages';

const kok = resolve(__dirname, '../..');
const oku = (p: string) => readFileSync(resolve(kok, p), 'utf8');

describe('dükkan zinciri kaldırıldı', () => {
  it('zincir sim dosyası yok, kural motoru onu kurmuyor', () => {
    expect(existsSync(resolve(kok, 'src/game/sim/zincir.ts'))).toBe(false);
    expect(oku('src/game/sim/rules.ts')).not.toMatch(/zincir/i);
    expect(oku('src/game/sim/panels.ts')).not.toMatch(/zincirApi/);
  });
  it('arayüzde zincir düğmesi/bölümü yok', () => {
    expect(oku('src/game/ui/faz2-hud.ts')).not.toMatch(/zincir|Dükkan zinciri/i);
    expect(oku('src/game/ui/harita-panel.ts')).not.toMatch(/Dükkan zinciri/);
  });
  it('büfe aşama adlarında "Zincir" ve ayrı "platform" yok', () => {
    for (const s of STAGES) { expect(s.short).not.toMatch(/zincir|platform/i); expect(s.name).not.toMatch(/zincir|platform/i); }
  });
});
