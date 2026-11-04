/**
 * Mini oyunlar sim side (survey mini-1..11, icecek-8, icecek-9). Pure: no three, no DOM, seeded rng only.
 * The games themselves run in the DOM overlay (src/game/ui/mini-games.ts); this module owns everything that matters
 * for the economy: unlocks (Esnaf Seviyesi), daily tickets, rewards, collectibles, kupa, the 5 min ×1.5 sales bonus,
 * and the optional drink-mastery micro-move prompts at the çay / ayran stations.
 * Decisions:
 * - Persistent state lives in GameState.zones.mini (created with defaults, so old saves load).
 * - A round is started with op 'play' (pauses the rules with pauseWhy 'mini' so customers wait politely) and finished
 *   with op 'result' (score 0..100 from the overlay) or op 'quit'. Score is skill only; rng only picks which
 *   collectible piece drops (variety, mini-9).
 * - Rewarded rounds: FREE_TICKETS per game day + AD_TICKETS via a simulated "Deneme reklamı". Unrewarded practice is
 *   unlimited. Failed rewarded rounds (0 stars) still pay a small consolation (mini-11).
 * - Sales bonus: while active, every 'sale' adds (BONUS_MULT-1)×value to the kasa. Micro-move success: the next
 *   MICRO_BUFF_N sales get +MICRO_BUFF_PCT extra the same way. Both use the kasa so the normal pickup flow applies.
 * - Commands: { kind: 'mini', op, id?, arg? } ops: open, play, practice, result, quit, ad, microStart, micro, microSkip, seen.
 */
import type { Kernel } from './state';
import type { ProductId } from './schema';
import { standAt } from './stations';
import {
  GAMES, GAME_BY_ID, MICRO, MICRO_COOLDOWN, MICRO_CHANCE, MICRO_SHOW, MICRO_BUFF_N, MICRO_BUFF_PCT, MICRO_OK_SCORE,
  FREE_TICKETS, AD_TICKETS, GOLD_CAP, REWARD_MIN, REWARD_FLOOR, BONUS_SECS, BONUS_MULT, CONSOLATION, COLLECTIBLES,
  COLL_KIND_NAME, KUPA_NAMES, MINI_VENUE, PRACTICE_NOTE, AD_TEXT, type MiniId, type MicroId,
} from '../../content/mini-oyunlar';
import { fmtMoney } from './util';

interface MiniSave {
  day: number; free: number; ad: number; adUsed: number; gold: number;
  best: Record<string, number>; stars: Record<string, number>; plays: number; coll: string[];
  bonusT: number; buffN: number; micro: number; seenLevel: number;
}
export interface MiniResult {
  id: MiniId; name: string; score: number; stars: number; practice: boolean; line: string; consolation: string;
  money: number; gold: number; piece: string | null; pieceKind: string | null; bonus: boolean; kupa: string | null; newBest: boolean;
}
export interface MiniPrompt { id: MicroId; name: string; how: string; until: number; secs: number }
export interface MiniApi {
  handle(c: { kind: string; [k: string]: unknown }): boolean;
  panelModel(): Record<string, any>;
  summary(): Record<string, any> | null;
  /** current round (overlay starts it), null when none */
  playing(): { id: MiniId; practice: boolean; n: number } | null;
  last(): MiniResult | null;
  prompt(): MiniPrompt | null;
  microRun(): { id: MicroId; n: number } | null;
  lastMicro(): { ok: boolean; text: string; n: number } | null;
  bonusLeft(): number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function installMini(K: Kernel): MiniApi {
  const rng = K.rng('mini');
  const rt = K.rt;
  let playing: { id: MiniId; practice: boolean; n: number } | null = null;
  let last: MiniResult | null = null;
  let prompt: MiniPrompt | null = null;
  let microRun: { id: MicroId; n: number } | null = null;
  let lastMicro: { ok: boolean; text: string; n: number } | null = null;
  let runN = 0, nextPromptT = 40, kahveFlip = false, seenLvl = K.state.level || 0;

  function save(): MiniSave {
    const S = K.state;
    if (!S.zones || typeof S.zones !== 'object') (S as { zones: Record<string, Record<string, unknown>> }).zones = {};
    let m = S.zones.mini as unknown as MiniSave | undefined;
    if (!m || typeof m !== 'object') {
      m = { day: 0, free: FREE_TICKETS, ad: AD_TICKETS, adUsed: 0, gold: 0, best: {}, stars: {}, plays: 0, coll: [], bonusT: 0, buffN: 0, micro: 0, seenLevel: 0 };
      S.zones.mini = m as unknown as Record<string, unknown>;
    }
    m.best ||= {}; m.stars ||= {}; if (!Array.isArray(m.coll)) m.coll = [];
    for (const k of ['free', 'ad', 'adUsed', 'gold', 'plays', 'bonusT', 'buffN', 'micro', 'seenLevel', 'day'] as const) if (typeof m[k] !== 'number' || !isFinite(m[k])) m[k] = 0;
    if (m.day !== S.day) { m.day = S.day; m.free = FREE_TICKETS; m.ad = AD_TICKETS; m.adUsed = 0; m.gold = 0; }
    return m;
  }
  const unlocked = (id: MiniId) => K.state.level >= GAME_BY_ID[id].level;
  const starsOf = (id: MiniId, score: number) => GAME_BY_ID[id].stars.reduce((n, s) => n + (score >= s ? 1 : 0), 0);
  const tickets = () => { const m = save(); return m.free + m.adUsed; };

  function play(id: MiniId, practice: boolean): void {
    const g = GAME_BY_ID[id];
    if (!g) return;
    if (!unlocked(id)) { K.toast(g.name + ' Esnaf Seviyesi ' + g.level + ' olunca açılır.', 'info'); return; }
    if (!practice && tickets() <= 0) practice = true;
    playing = { id, practice, n: ++runN };
    rt.panel = null;
    if (!rt.paused) { rt.paused = true; rt.pauseWhy = 'mini'; }
    K.logEv('panel', { id: 'mini.' + id });
  }
  function endPause(): void { if (rt.paused && rt.pauseWhy === 'mini') { rt.paused = false; rt.pauseWhy = ''; } }

  function result(id: MiniId, score0: number): void {
    const g = GAME_BY_ID[id];
    if (!g || !playing || playing.id !== id) { endPause(); return; }
    const practice = playing.practice;
    playing = null;
    endPause();
    const m = save();
    const score = clamp(Math.round(Number(score0) || 0), 0, 100);
    const stars = starsOf(id, score);
    const newBest = score > (m.best[id] || 0);
    if (newBest) m.best[id] = score;
    const oldStars = m.stars[id] || 0;
    let kupa: string | null = null;
    if (stars > oldStars) { m.stars[id] = stars; kupa = KUPA_NAMES[stars]; }
    m.plays++;
    K.stat('miniPlay');
    const line = stars === 0 ? rng.pick(g.fails) : rng.pick(g.cheers);
    const r: MiniResult = { id, name: g.name, score, stars, practice, line, consolation: '', money: 0, gold: 0, piece: null, pieceKind: null, bonus: false, kupa, newBest };
    if (!practice) {
      if (m.free > 0) m.free--; else if (m.adUsed > 0) m.adUsed--;
      const perMin = Math.max(REWARD_FLOOR, K.incomePerMin() || 0);
      r.money = Math.max(5, Math.round(REWARD_MIN[stars] * perMin));
      K.earn(r.money);
      if (stars >= 3 && m.gold < GOLD_CAP) { m.gold++; K.state.gold += 1; r.gold = 1; }
      if (stars >= 2) {
        const left = COLLECTIBLES.filter(c => !m.coll.includes(c.id));
        if (left.length) { const c = rng.pick(left); m.coll.push(c.id); r.piece = c.name; r.pieceKind = COLL_KIND_NAME[c.kind]; }
        m.bonusT = BONUS_SECS; r.bonus = true;
      }
      if (stars === 0) r.consolation = rng.pick(CONSOLATION);
      K.addXP(1 + stars);
    } else if (stars === 0) r.consolation = rng.pick(CONSOLATION);
    last = r;
    K.dirty();
  }

  function micro(score: number): void {
    if (!microRun) return;
    const d = MICRO[microRun.id];
    const ok = (Number(score) || 0) >= MICRO_OK_SCORE;
    const m = save();
    if (ok) { m.buffN = MICRO_BUFF_N; m.micro++; K.stat('microOk'); }
    lastMicro = { ok, text: ok ? d.ok + ' Sonraki ' + MICRO_BUFF_N + ' satışa +%' + Math.round(MICRO_BUFF_PCT * 100) + ' bahşiş!' : d.meh, n: microRun.n };
    microRun = null;
    endPause();
  }

  function handle(c: { kind: string; [k: string]: unknown }): boolean {
    if (c.kind !== 'mini') return false;
    const op = String(c.op || ''), id = String(c.id || '') as MiniId;
    switch (op) {
      case 'open': rt.boardOpen = false; rt.panel = 'mini'; save().seenLevel = K.state.level; return true;
      case 'seen': save().seenLevel = K.state.level; return true;
      case 'play': play(id, false); return true;
      case 'practice': play(id, true); return true;
      case 'result': result(id, Number(c.arg)); return true;
      case 'quit': playing = null; endPause(); return true;
      case 'ad': {
        const m = save();
        if (m.ad > 0) { m.ad--; m.adUsed++; K.toast(AD_TEXT + ' +1 ödüllü tur!', 'good'); K.dirty(); }
        else K.toast('Bugünlük reklam bileti bitti. Yarın yine gel!', 'info');
        return true;
      }
      case 'microStart':
        if (!prompt) return true;
        microRun = { id: prompt.id, n: ++runN }; prompt = null;
        if (!rt.paused) { rt.paused = true; rt.pauseWhy = 'mini'; }
        return true;
      case 'micro': micro(Number(c.arg)); return true;
      case 'microSkip': prompt = null; if (microRun) { microRun = null; endPause(); } return true;
      default: return true;
    }
  }

  // sales bonus + micro buff (kasa top-up, so the normal money pickup applies)
  K.bus.on('sale', data => {
    const v = Number(data && data.value) || 0;
    if (v <= 0) return;
    const m = save();
    let extra = 0;
    if (m.bonusT > 0) extra += v * (BONUS_MULT - 1);
    if (m.buffN > 0) { m.buffN--; extra += v * MICRO_BUFF_PCT; }
    if (extra > 0) { try { K.moneyApi.addToKasa(Math.round(extra)); } catch { /* kasa not ready */ } }
  });

  // timers + station prompts (micro-moves, icecek-8/9)
  K.addSystem({
    id: 'mini', order: 21, phase: 'sim',
    step(ctx) {
      if (!rt.started || rt.paused) return;
      const dt = ctx.dt, m = save();
      if (K.state.level !== seenLvl) {
        const was = seenLvl; seenLvl = K.state.level;
        const g = GAMES.find(x => x.level > was && x.level <= seenLvl);
        if (g && was > 0) K.toast('Yeni mini oyun açıldı: ' + g.name + '! Görevler > Mini Oyunlar', 'good');
      }
      if (m.bonusT > 0) m.bonusT = Math.max(0, m.bonusT - dt);
      if (prompt && ctx.t > prompt.until) prompt = null;
      if (prompt || microRun || K.state.level < 2 || ctx.t < nextPromptT) return;
      nextPromptT = ctx.t + 1;
      if (rt.moving || rt.stillT < 0.6) return;
      const p = K.playerPos;
      for (const k of ['cay', 'ayran'] as ProductId[]) {
        if (!rt.stations[k] || !rt.stations[k].built) continue;
        const s = standAt(rt.layout, k);
        if (Math.hypot(p.x - s.x, p.z - s.z) > 1.4) continue;
        nextPromptT = ctx.t + MICRO_COOLDOWN * 0.3;
        if (!rng.chance(MICRO_CHANCE)) break;
        let id: MicroId = k === 'ayran' ? 'sallama' : 'cay';
        if (k === 'cay') { kahveFlip = !kahveFlip; if (kahveFlip && K.state.level >= 3) id = 'kahve'; }
        const d = MICRO[id];
        prompt = { id, name: d.name, how: d.how, until: ctx.t + MICRO_SHOW, secs: d.secs };
        nextPromptT = ctx.t + MICRO_COOLDOWN;
        break;
      }
    },
  });

  function panelModel(): Record<string, any> {
    const m = save(), S = K.state;
    const games = GAMES.map(g => ({
      id: g.id, name: g.name, how: g.how, level: g.level, secs: g.secs, color: g.color, open: unlocked(g.id),
      best: m.best[g.id] || 0, stars: m.stars[g.id] || 0, kupa: KUPA_NAMES[m.stars[g.id] || 0] || '',
    }));
    const coll = COLLECTIBLES.map(c => ({ id: c.id, name: c.name, kind: c.kind, kindName: COLL_KIND_NAME[c.kind], color: c.color, got: m.coll.includes(c.id) }));
    return {
      venue: MINI_VENUE, level: S.level, games, coll, free: m.free, adUsed: m.adUsed, ad: m.ad, tickets: m.free + m.adUsed, freeMax: FREE_TICKETS,
      gold: m.gold, goldCap: GOLD_CAP, bonusLeft: Math.ceil(m.bonusT), plays: m.plays, micro: m.micro, practiceNote: PRACTICE_NOTE,
      perMin: fmtMoney(Math.max(REWARD_FLOOR, K.incomePerMin() || 0)),
    };
  }
  function summary(): Record<string, any> | null {
    const m = save(), S = K.state;
    const open = GAMES.filter(g => S.level >= g.level);
    const next = GAMES.find(g => S.level < g.level);
    return { open: open.length, total: GAMES.length, tickets: m.free + m.adUsed, freeMax: FREE_TICKETS, next: next ? next.name + ' (Seviye ' + next.level + ')' : '', isNew: open.length > 0 && m.seenLevel < S.level && open.some(g => g.level > m.seenLevel) };
  }

  const api: MiniApi = {
    handle, panelModel, summary,
    playing: () => playing, last: () => last, prompt: () => prompt, microRun: () => microRun, lastMicro: () => lastMicro,
    bonusLeft: () => Math.ceil(save().bonusT),
  };
  (rt as unknown as { mini: MiniApi }).mini = api;
  K.addStateView(() => ({ mini: { playing: playing ? playing.id : null, prompt: prompt ? prompt.id : null, bonus: Math.ceil(save().bonusT), tickets: tickets() } }));
  return api;
}

/** Read the mini API from rules runtime (null before install). */
export function miniApi(r: { rt: unknown }): MiniApi | null { return ((r.rt as { mini?: MiniApi }).mini) || null; }
export function miniPanelModel(r: { rt: unknown }): Record<string, any> { const a = miniApi(r); return a ? a.panelModel() : {}; }
export function miniSummary(r: { rt: unknown }): Record<string, any> | null { const a = miniApi(r); return a ? a.summary() : null; }
