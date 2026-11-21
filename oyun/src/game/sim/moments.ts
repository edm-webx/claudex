/**
 * "Canlı iskele anları" director: pure scheduling for the moments view (citizen chats, small random events,
 * İskele Radyosu, real-clock rituals). No three, no DOM, no Math.random/Date: randomness from a seeded Rng passed in,
 * the real hour is passed in by the view (ritualFor). Not a sim System: nothing here touches GameState or the
 * agents SoA, so replays and the save are unaffected; the view feeds it candidate positions read from the SoA.
 *
 * Steady state allocates nothing: the frame object, chat state and candidate buffers are reused.
 */
import type { Rng } from '../../engine/api';
import { CHATS, RADIO_LINES, EVENT_KINDS, MOMENT_TIMING as TM, type ChatDef, type MomentEvent, type RitualId } from '../../content/moments';

/** Candidate citizens for a chat (filled by the view each time a chat is due; capacity fixed). */
export interface PairSource { count: number; slot: Int32Array; x: Float32Array; z: Float32Array; still: Uint8Array }
export const createPairSource = (cap = 64): PairSource => ({ count: 0, slot: new Int32Array(cap), x: new Float32Array(cap), z: new Float32Array(cap), still: new Uint8Array(cap) });

export interface ChatState { def: ChatDef; a: number; b: number; t: number; line: number }
export interface MomentEnv { live: boolean; night: boolean }
export interface MomentFrame {
  /** Running chat (null when none). `line` is the bubble index showing now. */
  chat: ChatState | null;
  /** True on the frame a chat line changed (start, next line). */
  chatChanged: boolean;
  /** Event fired this frame (consumed by the view), else null. */
  event: MomentEvent | null;
  /** Radio line showing now, else null. */
  radio: string | null;
  /** True on the frame the radio line changed. */
  radioChanged: boolean;
}
export interface MomentDirector {
  update(dt: number, env: MomentEnv, cands: PairSource): MomentFrame;
  /** Force the next chat / event / radio line (test hooks). */
  forceChat(): void;
  forceEvent(kind?: MomentEvent): void;
  forceRadio(line?: string): void;
  cancelChat(): void;
  readonly frame: MomentFrame;
}

export const CHAT_MIN_D = 0.5, CHAT_MAX_D = 3.2, CHAT_WALK_D = 2.2;

/** Real-clock ritual for an hour 0..23: morning 06-11, night 22-05, else null. */
export function ritualFor(hour: number): RitualId | null {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 22 || h < 5) return 'night';
  return null;
}

/**
 * Pick two candidates within [CHAT_MIN_D, CHAT_MAX_D] metres, starting at a random index. Prefers two standing
 * citizens, then one standing (the other stops by), then two walking side by side (closer than CHAT_WALK_D).
 * Returns false if none.
 */
export function pickPair(src: PairSource, rng: Rng, out: { a: number; b: number }): boolean {
  const n = src.count;
  if (n < 2) return false;
  const start = rng.int(0, n - 1);
  const lo = CHAT_MIN_D * CHAT_MIN_D;
  for (let pass = 0; pass < 3; pass++) {
    const hi = pass === 2 ? CHAT_WALK_D * CHAT_WALK_D : CHAT_MAX_D * CHAT_MAX_D;
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      if (pass < 2 && !src.still[i]) continue;
      for (let m = 1; m < n; m++) {
        const j = (i + m) % n;
        if (pass === 0 && !src.still[j]) continue;
        const dx = src.x[i] - src.x[j], dz = src.z[i] - src.z[j], d2 = dx * dx + dz * dz;
        if (d2 >= lo && d2 <= hi) { out.a = src.slot[i]; out.b = src.slot[j]; return true; }
      }
    }
  }
  return false;
}

export function createMomentDirector(rng: Rng): MomentDirector {
  const frame: MomentFrame = { chat: null, chatChanged: false, event: null, radio: null, radioChanged: false };
  const chat: ChatState = { def: CHATS[0], a: -1, b: -1, t: 0, line: 0 };
  const pair = { a: -1, b: -1 };
  let chatT = rng.range(TM.chatGap[0] * 0.4, TM.chatGap[1] * 0.5);
  let eventT = rng.range(TM.firstEvent[0], TM.firstEvent[1]);
  let radioT = rng.range(TM.firstRadio[0], TM.firstRadio[1]);
  let radioShow = 0;
  let lastChat = -1, lastEvent: MomentEvent | null = null, lastRadio = -1;
  let forcedEvent: MomentEvent | null = null, wantEvent = false, forcedRadio: string | null = null;

  const endChat = () => { frame.chat = null; chatT = rng.range(TM.chatGap[0], TM.chatGap[1]); };
  const pickEvent = (night: boolean): MomentEvent => {
    for (let k = 0; k < 8; k++) {
      const e = EVENT_KINDS[rng.int(0, EVENT_KINDS.length - 1)];
      if (e === lastEvent) continue;
      if (e === 'blackout' && !night) continue;
      if (e === 'rainbow' && night) continue;
      return e;
    }
    return night ? 'blackout' : 'ball';
  };

  const d: MomentDirector = {
    frame,
    update(dt, env, cands) {
      frame.chatChanged = false; frame.event = null; frame.radioChanged = false;
      if (!env.live) {
        // zone not visible: cancel what shows, hold timers
        if (frame.chat) endChat();
        if (frame.radio) { frame.radio = null; radioShow = 0; frame.radioChanged = true; }
        return frame;
      }
      // chats
      if (frame.chat) {
        chat.t += dt;
        const li = Math.floor(chat.t / TM.chatLine);
        if (li >= chat.def.lines.length) endChat();
        else if (li !== chat.line) { chat.line = li; frame.chatChanged = true; }
      } else {
        chatT -= dt;
        if (chatT <= 0) {
          if (pickPair(cands, rng, pair)) {
            let ci = rng.int(0, CHATS.length - 1);
            if (ci === lastChat) ci = (ci + 1) % CHATS.length;
            lastChat = ci;
            chat.def = CHATS[ci]; chat.a = pair.a; chat.b = pair.b; chat.t = 0; chat.line = 0;
            frame.chat = chat; frame.chatChanged = true;
          } else chatT = 3;   // nobody standing close: look again soon
        }
      }
      // events
      eventT -= dt;
      if (wantEvent || eventT <= 0) {
        const e = forcedEvent ?? pickEvent(env.night);
        forcedEvent = null; wantEvent = false;
        lastEvent = e; frame.event = e;
        eventT = rng.range(TM.eventGap[0], TM.eventGap[1]);
      }
      // radio
      if (frame.radio) {
        radioShow -= dt;
        if (radioShow <= 0) { frame.radio = null; frame.radioChanged = true; }
      }
      radioT -= dt;
      if (forcedRadio || radioT <= 0) {
        if (forcedRadio) frame.radio = forcedRadio;
        else {
          let ri = rng.int(0, RADIO_LINES.length - 1);
          if (ri === lastRadio) ri = (ri + 1) % RADIO_LINES.length;
          lastRadio = ri; frame.radio = RADIO_LINES[ri];
        }
        forcedRadio = null;
        radioShow = TM.radioShow; frame.radioChanged = true;
        radioT = rng.range(TM.radioGap[0], TM.radioGap[1]);
      }
      return frame;
    },
    forceChat() { if (frame.chat) endChat(); chatT = 0; },
    forceEvent(kind) { wantEvent = true; forcedEvent = kind ?? null; },
    forceRadio(line) { forcedRadio = line ?? null; radioT = 0; },
    cancelChat() { if (frame.chat) endChat(); },
  };
  return d;
}
