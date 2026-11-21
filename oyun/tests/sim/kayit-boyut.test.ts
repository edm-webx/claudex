// KAL-01 yük boyutu: kayıt kodu (base64) ve 4 yuvalı bulut satırı gerçek boyutu; keepalive (64 KB) sınırına uzaklık raporu.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createGameSave } from '../../src/game/sim/save';
import { KAPANIS_LIMIT } from '../../src/game/net/supa';
import { played, mkSim, fakePlatform, log } from './m1-helpers';
import type { GameState } from '../../src/game/sim/schema';

describe('kayıt boyutu', () => {
  it('19+ gün oynanmış bot kaydı ve dolu fixture: kod boyutu, 4 yuva toplamı, kapanış sınırı', async () => {
    const sim = played(5); for (let i = 0; i < 30; i++) sim.step(300);
    const dolu = JSON.parse(readFileSync(new URL('../fixtures/saves/v2-dolu.json', import.meta.url), 'utf8')) as GameState;
    const rows: string[] = [];
    for (const [ad, s] of [['bot gün ' + sim.state.day, sim], ['v2-dolu', mkSim(7, dolu)]] as const) {
      const code = await createGameSave(s, fakePlatform().platform, { log }).exportCode();
      const dort = code.length * 4;
      rows.push(`${ad}: json=${JSON.stringify(s.state).length}B kod=${code.length}B 4yuva=${dort}B (keepalive sınırı ${KAPANIS_LIMIT}B)`);
      expect(code.length).toBeLessThan(30_000);   // tek yuva
      expect(dort).toBeLessThan(KAPANIS_LIMIT);   // 4 yuva kapanış yazımına sığar; aşarsa kapanış yazımı atlanır, düzenli yazım zaten gider
    }
    console.log(rows.join('\n'));
  });
});
