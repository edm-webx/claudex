// Para sesi tek kapısı: coin/cash/hesap/tip... hangi yoldan (bank, örnek, tarif) çalarsa çalsın aynı alışma.
// Saf mantık (AudioContext yok): sfx() girişinde çağrılır. Yoğun serviste ses seyrekleşir ve kısılır; patlama olmaz.
export const MONEY_IDS = ['coin', 'coinFloor', 'cash', 'buy', 'hesap', 'tip'] as const;
const MONEY = new Set<string>(MONEY_IDS);
export const isMoney = (id: string): boolean => MONEY.has(id);
/** A major pentatonic ratios (relative to the 440 Hz base of the soft bank sounds). */
export const PENTA_RATIOS = [330, 371, 440, 495, 554, 660].map(f => f / 440);

export interface MoneyGate { pass(nowMs: number): { vol: number; pitch: number } | null; }
/** Min gap 160 ms, growing 60 ms per recent coin (decays 1.2/s, capped at 8); volume shrinks as 1 / (1 + 0.35 * recent). */
export function createMoneyGate(rand: () => number = Math.random): MoneyGate {
  let last = -1e9, recent = 0, lastAt = 0, step = 0;
  return {
    pass(now) {
      recent = Math.max(0, recent - Math.max(0, now - lastAt) / 1000 * 1.2); lastAt = now;
      const gap = 160 + Math.min(recent, 8) * 60;
      if (now - last < gap) return null;
      last = now; recent += 1;
      step = (step + 1 + Math.floor(rand() * 3)) % PENTA_RATIOS.length;   // never the same note twice in a row
      return { vol: 1 / (1 + (recent - 1) * 0.35), pitch: PENTA_RATIOS[step] };
    },
  };
}
