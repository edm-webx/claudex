/**
 * Event names. Lead-owned, FROZEN at kickoff (CONTRACT.md).
 * v2 names (every `logEv(...)` in 3d/v2/js/game.js) are kept exactly so v2 bots port 1:1.
 * Payloads are loose (`EvData`) except where v2 had a clear shape; bots only rely on names + listed fields.
 * Decision: `sale` is logged like any other event (v2 kept it out of R.log for size; our bus log is bounded instead).
 */

/** All v2 event names, alphabetical (from v2 game.js logEv calls). */
export const V2_EVENT_NAMES = [
  'ach', 'angry', 'autoTier', 'boardOpen', 'catPet', 'catRub', 'catWake', 'cayUsed', 'dayEnd', 'decorBuy',
  'dogArrive', 'ferryDock', 'ferryHorn', 'ferryLeave', 'firstCollect', 'firstCustomer', 'firstCut', 'firstDrop',
  'firstStreak', 'firstWindowSale', 'gullChased', 'gullSnatch', 'gullStare', 'gurmePartial', 'gurmePass', 'heroPick',
  'hire', 'introGull', 'kapkacArrive', 'kapkacCaught', 'kapkacEscaped', 'kapkacGrab', 'karamelTurned', 'kasaDone',
  'kasaStart', 'level', 'orderClaim', 'ordersNew', 'padShown', 'panel', 'plaque', 'probe', 'rankUp', 'regularArrive',
  'regularMiss', 'regularOk', 'sale', 'selfie', 'set', 'siftah', 'sign', 'slowIcon', 'slowTap', 'star', 'start',
  'tadilatDone', 'tadilatStart', 'takeover', 'tap', 'tier', 'tip', 'toast', 'tutDone', 'tutShow', 'unlock',
  'vipArrive', 'wake', 'welcome', 'welcomeCollect', 'windowClose', 'windowOpen', 'workerSleep', 'workerWatch',
] as const;

/** New engine/ecosystem events (not in v2). */
export const ENGINE_EVENT_NAMES = [
  'ticket', 'serve', 'hesap', 'stantBuy', 'stantSale', 'stantRefill', 'dukkanAc', 'erimGlitch', 'erimBonk', // Faz 2
  'kasaOde',         // BUF-12 { yontem: 'nakit' | 'kart', x, z }: customer paid at the till (yalnız görsel)
  'kizginAyril',     // BUF-23 { x, z, masa, type }: sabrı biten müşteri masaya/tezgâha vurup kızgın ayrıldı
  'passBell',       // BUF-05 { no, p, x, z }: a plate landed on the kitchen pass (servis zili; ses SES-05)
  'tavaCarpma',     // BUF-08 { ist, x, z }: a pan dish finished on a tava station (mutfak-hat ready)
  'bulasikSes',     // BUF-08 { x, z }: dishwasher clink; emitter not yet wired (BUF-13 owns the dish pile trigger)
  'canliMuzik',     // BUF-14 { x, z }: the musician is playing (live music cue; the sound layer owns the audio)
  'zoneState',      // { id, state }
  'save',           // { reason, ok, mode }
  'saveRepaired',   // { notes }
  'dwellStart',     // { id, actor }
  'dwellCancel',    // { id, actor }
  'transfer',       // { id, actor, item?, n }
  'systemError',    // { id, strikes }
  'contextLost',    // {}
  'contextRestored',// {}
  'stage',          // { stage }
  'timeSet',        // { hour }
  'esnafGreet',     // M2
  'shopOpen',       // M2 { shop }
  'shopClose',      // M2 { shop }
  'anomali',        // KAL-13 bekçi (?qa=1): { tur, anahtar, t, gun, ayrinti }
] as const;

export const EVENT_NAMES = [...V2_EVENT_NAMES, ...ENGINE_EVENT_NAMES] as const;
export type V2EventName = (typeof V2_EVENT_NAMES)[number];
export type EngineEventName = (typeof ENGINE_EVENT_NAMES)[number];
export type EventName = (typeof EVENT_NAMES)[number];

export type EvData = Record<string, unknown> | undefined;

/** Payload map for the typed bus. Fields listed are the v2 fields; extra fields allowed. */
export interface SimEvents extends Record<EventName, EvData> {
  sale: { value: number; n: number; streak: number; kind: string; [k: string]: unknown };
  siftah: { value: number; [k: string]: unknown };
  tip: { tip: number; [k: string]: unknown };
  set: { set: string; [k: string]: unknown };
  angry: { type: string; [k: string]: unknown };
  zoneState: { id: string; state: 'cold' | 'sim' | 'warm' | 'hot' };
  save: { reason: string; ok: boolean; mode: string };
  saveRepaired: { notes: string[] };
  dwellStart: { id: string; actor: number };
  dwellCancel: { id: string; actor: number };
  transfer: { id: string; actor: number; item?: string; n: number };
  systemError: { id: string; strikes: number };
  stage: { stage: number };
  timeSet: { hour: number };
}

export function isEventName(s: string): s is EventName {
  return (EVENT_NAMES as readonly string[]).includes(s);
}
