// SFX content table (Builder D, M1): which sound plays on which game event. Ids are the v2 synth recipes in
// engine/audio (pop drop cut pour fizz coin cash buy bad wake flash clean gull purr bark streak day spoon sizzle creak,
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
    if (id.startsWith('floor')) return 'coinFloor';   // yerden para toplama: çok kısık
    if (id === 'kasa') return 'coin';
    if (id.startsWith('tip.')) return 'coin';
    if (id.startsWith('table.')) return 'clean';
    return null;
  },
  pick: d => (d?.type === 'gazoz' ? 'fizz' : d?.type === 'cay' ? 'tik' : d?.type === 'tost' ? 'steamHiss' : 'pop'),
  // 2026-10-30 story + league + chests
  ipucu: 'bildirim', sabriGitti: 'bad', dukkanKare: 'sparkle', dukkanSatilik: 'sparkle', dukkanGorev: 'streak',   // sıralı açılma (content/acilis.ts): yeni dükkân karesi / kilidi açıldı
  ligMac: 'whistleLong', ligYukseldi: 'streak', sandikDustu: 'sparkle',
  firstCut: 'cut', cayUsed: 'pour', sale: 'coin', tip: 'coin', firstCollect: 'coin',
  streak: 'streak', firstStreak: 'streak', rankUp: 'streak', ach: 'streak',
  hire: 'buy', tier: 'buy', plaque: 'buy', star: 'buy', decorBuy: 'buy', tadilatStart: 'buy', sign: 'buy', unlock: 'buy',   // 'set'/'siftah' sessiz: aynı satışta 'sale' zaten coin çalıyor (tek satış = tek ses)
 
  level: 'day', dayEnd: 'day', tadilatDone: 'streak', kasaDone: 'streak',   // 'day' yalnız seviye ve gün sonu (en gürlek ses; dördü birden çalmaz)
  orderClaim: 'cash', welcomeCollect: 'cash',
  windowOpen: 'flash',
  // ses denetimi 2026-11-27: yayılıp sessiz kalan olaylar (konum taşıyanlar duyulduğu yerden çalar)
  kizginAyril: 'bad', siparisAl: 'ticket', bahsisDagit: 'coin', musteriPhoto: 'shutter', mufettis: 'bildirim', arsaYapildi: 'buy', paketTeslim: 'ok',
  catWake: 'purr', catPet: 'purr', catRub: 'purr',
  introGull: 'gull', gullStare: 'gull', gullChased: 'gull', gullSnatch: 'gull', karamelTurned: 'bark', dogArrive: 'bark',
  kapkacGrab: 'bad', angry: 'bad', wake: 'wake',
  // Faz 2: restoran + stantlar + NPC Erim
  ticket: 'ticket', serve: 'serve', hesap: 'hesap', stantBuy: 'buy', stantSale: 'coin', stantRefill: 'pop', erimGlitch: 'glitch', erimBonk: 'bonk',
  // ses denetimi 2026-11-26: sesi olmayan olaylar. Gurme sinavi, isletme asamasi, selfie, egitim adimi.
  gurmePass: 'streak', gurmePartial: 'ok', isletmeAsama: 'buy', selfie: 'shutter', tutDone: 'ok',
  // BUF-08 mutfak sesleri: servis zili (pass), tava çarpması, bulaşık şıngırtısı (olayı henüz üretilmez, tetik hazır)
  passBell: 'passBell', tavaCarpma: 'tavaCarpma', bulasikSes: 'bulasikSes',
};

/** ses-3: events that get a short voiced (grumble) line; the engine plays at most one per 10 s. */
export const EVENT_VOICE: Record<string, string> = {
  regularArrive: 'selam', vipArrive: 'selam', level: 'mutlu', star: 'mutlu', rankUp: 'mutlu', tadilatDone: 'mutlu',
};
