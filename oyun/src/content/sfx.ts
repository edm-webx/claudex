// SFX content table (Builder D, M1): which sound plays on which game event. Ids are the v2 synth recipes in
// engine/audio (pop drop cut pour fizz coin cash buy bad wake flash clean gull horn purr bark streak day spoon sizzle creak,
// plus the ses polish set: tik steamHiss press blow shutter sparkle confetti feather splash puff jingle simitci).
// Values: a sound id, or a function of the event payload.
type Payload = Record<string, unknown> | undefined;
export type SfxRule = string | ((d: Payload) => string | null);

/** v2 SFX() call sites, expressed as event -> sound. */
export const EVENT_SFX: Record<string, SfxRule> = {
  // dwell transfers: station pick, counter drop, kasa/floor money
  transfer: d => {
    const id = String(d?.id ?? '');
    if (id.startsWith('station.')) return null;   // stations sound on 'pick' (a real pickup), not on every act tick
    if (id === 'counter') return 'drop';
    if (id === 'kasa' || id.startsWith('floor')) return 'coin';
    if (id.startsWith('tip.')) return 'coin';
    if (id.startsWith('table.')) return 'clean';
    return null;
  },
  pick: d => (d?.type === 'gazoz' ? 'fizz' : d?.type === 'cay' ? 'tik' : d?.type === 'tost' ? 'steamHiss' : 'pop'),
  // 2026-10-30 story + league + chests
  ipucu: 'ticket', sabriGitti: 'bad', ligMac: 'horn', ligYukseldi: 'confetti', sandikDustu: 'sparkle',
  firstCut: 'cut', cayUsed: 'pour', sale: 'coin', siftah: 'coin', tip: 'coin', firstCollect: 'coin',
  streak: 'streak', firstStreak: 'streak', rankUp: 'streak', ach: 'streak',
  hire: 'buy', tier: 'buy', plaque: 'buy', star: 'buy', decorBuy: 'buy', tadilatStart: 'buy', sign: 'buy', unlock: 'buy', set: 'coin',
  level: 'day', dayEnd: 'day', tadilatDone: 'day', kasaDone: 'day',
  orderClaim: 'cash', welcomeCollect: 'cash',
  ferryHorn: 'horn', windowOpen: 'flash', ferryDock: 'splash',
  catWake: 'purr', catPet: 'purr', catRub: 'purr',
  introGull: 'gull', gullStare: 'gull', gullChased: 'gull', gullSnatch: 'gull', karamelTurned: 'bark', dogArrive: 'bark',
  kapkacGrab: 'bad', angry: 'bad', wake: 'wake',
  // Faz 2: restoran + stantlar + NPC Erim
  ticket: 'ticket', serve: 'serve', hesap: 'hesap', stantBuy: 'buy', stantSale: 'coin', stantRefill: 'pop', erimGlitch: 'glitch', erimBonk: 'bonk',
};

/** ses-3: events that get a short voiced (grumble) line; the engine plays at most one per 10 s. */
export const EVENT_VOICE: Record<string, string> = {
  regularArrive: 'selam', vipArrive: 'selam', level: 'mutlu', star: 'mutlu', rankUp: 'mutlu', tadilatDone: 'mutlu',
};
