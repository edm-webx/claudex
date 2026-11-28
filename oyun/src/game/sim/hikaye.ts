/**
 * Hikaye sim (survey hikaye-1..7, kontrol-7, zincir-1..8). Pure: no three, no DOM, seeded rng only.
 * - Chapters: each place is a chapter with 3 quests (progress = stat deltas since the chapter began, or absolute
 *   thresholds). When all 3 are done the finale scene is queued; finishing or skipping it pays the chapter reward and
 *   opens the next chapter. After the Moon the "new season" keeps bringing small oddities.
 * - Scenes: the overlay (ui/hikaye-scene.ts) shows `scene()`; finale and tutorial scenes pause the rules
 *   (pauseWhy 'hikaye') so customers wait politely. Short in-between moments (`ara()`) never pause.
 * - Absurd breaks: once each on/after a given day.
 * - Rivals: every few minutes an active rival does something (concept store, spy customer, billboard, drones, Tat
 *   Yarışı, joint order). Dips are small and temporary: a venue multiplier below 1 while the action runs, never money
 *   taken away. Rivals transform after their chapter (zincir-8): then they only offer friendly actions.
 * - Tutorials by character: when a system unlocks a character explains it in ~10 s; replayable from the Defter.
 * Persistent state lives in GameState.zones.hikaye (created with defaults so old saves load).
 * Commands: { kind: 'hikaye', op, id?, arg? } ops: open, tab, sceneDone, replay, rival, araDone.
 */
import type { Kernel } from './state';
import type { ProductId } from './schema';
import {
  CHAPTERS, ABSURD, RIVALS, RIVAL_ACTIONS, RIVAL_RESULT, TUTORS, NEW_SEASON, JURY, JURY_LINES, SPEAKERS, HIKAYE_TIMING as TM,
  type SceneDef, type Goal, type QuestDef, type RivalDef, type RivalActionDef, type SpeakerId, type TutorCond,
} from '../../content/hikaye';
import { PRODUCTS } from '../../content/products';
import { fmtMoney } from './util';

/** Faz 2: the story layer is switched off (kept in code so it can come back later, saves stay compatible). */
export const HIKAYE_ON = false;

interface RivalSave { next: number; n: number; wins: number; losses: number; met: string[]; tat: number }
interface HikayeSave {
  ch: number; base: Record<string, number>; done: string[]; fin: string[]; absurd: string[]; tutSeen: string[];
  log: { d: number; t: string }[]; rv: RivalSave; dipT: number; dipX: number; boostT: number;
  ortak: { r: string; base: number; until: number } | null; season: number; seasonDay: number; tab: string; seenCh: number;
}
export interface SceneRun { scene: SceneDef; n: number; replay: boolean }
export interface AraRun { who: SpeakerId; name: string; title: string; text: string; until: number; n: number }
export interface RivalRun { kind: string; rival: string; rivalName: string; who: SpeakerId; color: string; title: string; text: string; choices: [string, string][]; until: number; n: number }
export interface HikayeApi {
  handle(c: { kind: string; [k: string]: unknown }): boolean;
  panelModel(): Record<string, any>;
  summary(): Record<string, any> | null;
  scene(): SceneRun | null;
  ara(): AraRun | null;
  rival(): RivalRun | null;
  result(): { text: string; n: number; who: SpeakerId; lines?: [SpeakerId, string][] } | null;
  ortak(): { name: string; left: number; secs: number } | null;
  dipX(): number;
}

const PAUSING = new Set(['finale', 'ogretici']);

export function installHikaye(K: Kernel): HikayeApi {
  const rng = K.rng('hikaye');
  const rt = K.rt;
  let runN = 0;
  const queue: { scene: SceneDef; replay: boolean }[] = [];
  const araQ: Omit<AraRun, 'until' | 'n'>[] = [];
  let cur: SceneRun | null = null;
  let ara: AraRun | null = null;
  let rv: (RivalRun & { def: RivalActionDef; r: RivalDef }) | null = null;
  let last: { text: string; n: number; who: SpeakerId; lines?: [SpeakerId, string][] } | null = null;
  let checkT = 0, fresh = false;

  function save(): HikayeSave {
    const S = K.state;
    if (!S.zones || typeof S.zones !== 'object') (S as { zones: Record<string, Record<string, unknown>> }).zones = {};
    let h = S.zones.hikaye as unknown as HikayeSave | undefined;
    if (!h || typeof h !== 'object') {
      h = { ch: 0, base: {}, done: [], fin: [], absurd: [], tutSeen: [], log: [], rv: { next: 0, n: 0, wins: 0, losses: 0, met: [], tat: 0 }, dipT: 0, dipX: 1, boostT: 0, ortak: null, season: 0, seasonDay: 0, tab: 'bolum', seenCh: -1 };
      S.zones.hikaye = h as unknown as Record<string, unknown>;
      fresh = true;
    }
    h.base ||= {};
    for (const k of ['done', 'fin', 'absurd', 'tutSeen', 'log'] as const) if (!Array.isArray(h[k])) (h as unknown as Record<string, unknown[]>)[k] = [];
    if (!h.rv || typeof h.rv !== 'object') h.rv = { next: 0, n: 0, wins: 0, losses: 0, met: [], tat: 0 };
    if (!Array.isArray(h.rv.met)) h.rv.met = [];
    for (const k of ['next', 'n', 'wins', 'losses', 'tat'] as const) if (typeof h.rv[k] !== 'number' || !isFinite(h.rv[k])) h.rv[k] = 0;
    for (const k of ['ch', 'dipT', 'boostT', 'season', 'seasonDay'] as const) if (typeof h[k] !== 'number' || !isFinite(h[k])) h[k] = 0;
    if (typeof h.dipX !== 'number' || !isFinite(h.dipX)) h.dipX = 1;
    if (typeof h.seenCh !== 'number') h.seenCh = -1;
    if (typeof h.tab !== 'string') h.tab = 'bolum';
    h.ch = Math.max(0, Math.min(CHAPTERS.length, Math.floor(h.ch)));
    return h;
  }

  // ───────── helpers ─────────
  const perMin = () => Math.max(20, K.incomePerMin() || 0);
  const pay = (min: number) => { const v = Math.max(10, Math.round(min * perMin())); K.earn(v); return v; };
  const log = (t: string) => { const h = save(); h.log.push({ d: K.state.day, t }); if (h.log.length > TM.logCap) h.log.splice(0, h.log.length - TM.logCap); };
  const say = (who: SpeakerId, title: string, text: string) => { araQ.push({ who, name: SPEAKERS[who]?.name || '', title, text }); };
  const enqueue = (scene: SceneDef, replay = false) => { if (!queue.some(q => q.scene.id === scene.id) && (!cur || cur.scene.id !== scene.id)) queue.push({ scene, replay }); };
  const statOf = (k: string) => K.state.stats[k] || 0;
  const goalVal = (g: Goal): number => {
    const S = K.state;
    switch (g.t) {
      case 'stat': return statOf(g.k);
      case 'earned': return S.totalEarned || 0;
      case 'level': return S.level;
      case 'stage': return S.stage;
      case 'workers': return S.workers.length;
      case 'owned': return S.owned[g.k] ? 1 : 0;
    }
  };
  const goalNeed = (g: Goal) => (g.t === 'owned' ? 1 : g.n);
  const isDelta = (g: Goal) => g.t === 'stat' || g.t === 'earned';
  function progress(q: QuestDef): number {
    const h = save(), v = goalVal(q.goal);
    const p = isDelta(q.goal) ? v - (h.base[q.id] ?? v) : v;
    return Math.max(0, Math.min(goalNeed(q.goal), p));
  }
  function startChapter(i: number, announce: boolean): void {
    const h = save(), ch = CHAPTERS[i];
    if (!ch) return;
    for (const q of ch.quests) if (isDelta(q.goal) && h.base[q.id] == null) h.base[q.id] = goalVal(q.goal);
    if (announce) {
      log('Bölüm ' + ch.n + ' başladı: ' + ch.place + ', ' + ch.title + '.');
      say(ch.quests[0].giver, 'Bölüm ' + ch.n + ': ' + ch.place, ch.blurb);
      for (const q of ch.quests) say(q.giver, 'Yeni görev: ' + q.title, q.start);
    }
  }
  const turned = (r: RivalDef) => save().ch > r.turnAfter;

  function condTrue(c: TutorCond): boolean {
    const S = K.state;
    switch (c.t) {
      case 'owned': return !!S.owned[c.k];
      case 'level': return S.level >= c.n;
      case 'workers': return S.workers.length >= c.n;
      case 'stat': return statOf(c.k) >= c.n;
      case 'stage': return S.stage >= c.n;
      case 'rival': return save().rv.n >= 1;
    }
  }

  function finishScene(): void {
    if (!cur) return;
    const s = cur.scene, replay = cur.replay;
    cur = null;
    if (rt.paused && rt.pauseWhy === 'hikaye') { rt.paused = false; rt.pauseWhy = ''; }
    if (replay) return;
    const h = save();
    if (s.kind === 'finale') {
      const i = CHAPTERS.findIndex(c => c.finale.id === s.id);
      if (i >= 0 && i === h.ch && !h.fin.includes(s.id)) {
        const ch = CHAPTERS[i];
        h.fin.push(s.id);
        const v = pay(ch.rewardMin);
        K.state.gold += ch.gold;
        K.addXP(5 + ch.n * 2);
        K.toast('Bölüm ' + ch.n + ' tamam! +' + fmtMoney(v) + ' ve ' + ch.gold + ' Altın Simit', 'good');
        log('Bölüm ' + ch.n + ' bitti: "' + ch.finale.title + '". Ödül ' + fmtMoney(v) + ' ve ' + ch.gold + ' Altın Simit.');
        for (const r of RIVALS) if (r.turnAfter === i) { log(r.name + ' dönüştü: ' + r.turned); say(r.who, r.name + ' dönüştü!', r.turned); }
        h.ch = i + 1;
        if (h.ch < CHAPTERS.length) startChapter(h.ch, true);
        else { log('Ay\'dan dönüldü. Martıköy\'de yeni sezon başladı!'); h.seasonDay = K.state.day; }
        K.stat('hikayeBolum');
        K.dirty();
      }
    }
  }

  function takeScene(): void {
    const q = queue.shift();
    if (!q) return;
    cur = { scene: q.scene, n: ++runN, replay: q.replay };
    if (PAUSING.has(q.scene.kind) && !rt.paused) { rt.paused = true; rt.pauseWhy = 'hikaye'; }
    if (!q.replay && q.scene.kind === 'absurt') log('Tuhaf an: ' + q.scene.title + '.');
    K.logEv('hikayeScene', { id: q.scene.id, kind: q.scene.kind });
  }

  // ───────── rivals ─────────
  function startRival(): void {
    const h = save(), S = K.state;
    const live = RIVALS.filter(r => h.ch >= r.from);
    if (!live.length) return;
    // all turned rivals only offer friendly actions
    const opts: { def: RivalActionDef; r: RivalDef }[] = [];
    for (const def of RIVAL_ACTIONS) for (const id of def.rivals) {
      const r = live.find(x => x.id === id); if (!r) continue;
      const friendly = def.kind === 'tat' || def.kind === 'ortak';
      if (turned(r) && !friendly) continue;
      if (def.kind === 'tat' && S.level < 3) continue;
      opts.push({ def, r });
    }
    if (!opts.length) return;
    const o = rng.pick(opts);
    const name = o.r.name;
    let choices: [string, string][] = o.def.choices.map(c => [c[0], c[1]]);
    if (o.def.kind === 'tat') {
      choices = [];
      for (const p of Object.keys(rt.stations) as ProductId[]) if (rt.stations[p].built && choices.length < 4) choices.push([PRODUCTS[p]?.name || p, 'tat:' + p]);
      if (!choices.length) return;
    }
    const text = o.def.intro.replace(/\{r\}/g, name) + (turned(o.r) ? ' (Artık dostuz, kavga yok!)' : '');
    rv = { def: o.def, r: o.r, kind: o.def.kind, rival: o.r.id, rivalName: name, who: o.r.who, color: o.r.color, title: o.def.title, text, choices, until: S.playT + o.def.secs, n: ++runN };
    h.rv.n++;
    if (!h.rv.met.includes(o.r.id)) { h.rv.met.push(o.r.id); log('Yeni rakip: ' + name + '. "' + o.r.slogan + '"'); }
    if (o.def.dip < 1 && !turned(o.r)) { h.dipX = o.def.dip; h.dipT = o.def.secs; }
    log(o.def.title + ': ' + name + '.');
    K.logEv('rival', { kind: o.def.kind, rival: o.r.id });
    K.dirty();
  }
  function endRival(): void { const h = save(); if (rv && rv.def.dip < 1) { h.dipT = 0; h.dipX = 1; } rv = null; }
  function answerRival(arg: string): void {
    if (!rv) return;
    const h = save(), r = rv.r, name = rv.rivalName;
    let text = RIVAL_RESULT[arg] || '';
    let lines: [SpeakerId, string][] | undefined;
    switch (arg) {
      case 'koku': h.boostT = TM.boostSecs; break;
      case 'sahte': K.state.gold += TM.sahteGold; break;
      case 'cay': { const v = pay(TM.cayTipMin); text += ' (+' + fmtMoney(v) + ')'; break; }
      case 'kedi': { const v = pay(TM.kediMin); text += ' (+' + fmtMoney(v) + ')'; K.stat('kediPoster'); break; }
      case 'marti': h.boostT = TM.boostSecs * 0.5; break;
      case 'kabul': h.ortak = { r: name, base: statOf('sales'), until: K.state.playT + rv.def.secs }; break;
      default:
        if (arg.startsWith('tat:')) {
          const p = arg.slice(4) as ProductId;
          const tier = K.state.tiers[p] || 1;
          const mine = Math.round(tier * 18 + K.state.level * 1.5 + rng.range(10, 40));
          const theirs = Math.round(rng.range(35, 80) + h.ch * 3);
          const win = mine >= theirs;
          h.rv.tat++;
          lines = JURY.map((j, i) => [j, (win ? JURY_LINES.win : JURY_LINES.lose)[i]] as [SpeakerId, string]);
          if (win) { h.rv.wins++; const v = pay(TM.tatWinMin); K.state.gold += 1; text = 'Tat Yarışı: ' + (PRODUCTS[p]?.name || p) + ' ' + mine + ' puan, ' + name + ' ' + theirs + ' puan. Kazandın! +' + fmtMoney(v) + ' ve 1 Altın Simit.'; K.stat('tatWin'); }
          else { h.rv.losses++; const v = pay(TM.tatLoseMin); text = 'Tat Yarışı: ' + (PRODUCTS[p]?.name || p) + ' ' + mine + ' puan, ' + name + ' ' + theirs + ' puan. Bu sefer onlar. Teselli: +' + fmtMoney(v) + '. Kimse üzülmedi, herkes doydu.'; }
        }
    }
    last = { text, n: ++runN, who: arg === 'kabul' || arg.startsWith('tat:') ? r.who : 'sabri', lines };
    if (text) log(text);
    endRival();
    K.dirty();
  }

  // dips and boosts as a venue multiplier (never takes money away)
  const baseVM = K.venueMult;
  K.venueMult = () => {
    const h = save();
    let x = baseVM();
    if (h.dipT > 0) x *= h.dipX;
    if (h.boostT > 0) x *= TM.boostX;
    return x;
  };

  // ───────── per tick ─────────
  K.addSystem({
    id: 'hikaye', order: 22, phase: 'sim',
    step(ctx) {
      if (!rt.started || rt.paused) return;
      const dt = ctx.dt, h = save(), S = K.state;
      if (h.dipT > 0) { h.dipT = Math.max(0, h.dipT - dt); if (h.dipT === 0) h.dipX = 1; }
      if (h.boostT > 0) h.boostT = Math.max(0, h.boostT - dt);
      // in-between moment
      if (ara && S.playT >= ara.until) ara = null;
      if (!ara && araQ.length) { const a = araQ.shift()!; ara = { ...a, until: S.playT + TM.araShow, n: ++runN }; }
      // rival action timeout
      if (rv && S.playT >= rv.until) {
        const k = rv.kind;
        if (k === 'konsept') last = { text: RIVAL_RESULT.bos, n: ++runN, who: 'sabri' };
        endRival();
      }
      if (h.ortak) {
        const got = statOf('sales') - h.ortak.base;
        if (got >= TM.ortakN) { const v = pay(TM.ortakMin); last = { text: RIVAL_RESULT.ortakOk + ' +' + fmtMoney(v), n: ++runN, who: 'sabri' }; log(h.ortak.r + ' ortak siparişi teslim edildi. +' + fmtMoney(v)); h.ortak = null; K.stat('ortakIs'); }
        else if (S.playT >= h.ortak.until) { last = { text: RIVAL_RESULT.ortakGec, n: ++runN, who: 'sabri' }; h.ortak = null; }
      }
      if (!HIKAYE_ON) return;   // Faz 2: no story chapters, neighbour quests, absurd scenes or rivals (user, 2026-10-23)
      if ((checkT -= dt) > 0) return;
      checkT = 1;
      // wait for the first-session basics before story starts talking
      if (!S.tut.firstCollect && S.playT < 90) return;
      if (fresh) {
        fresh = false;
        // old save: don't replay a pile of tutorials at once (still replayable from the Defter)
        if (S.playT > 900) for (const t of TUTORS) if (condTrue(t.cond)) h.tutSeen.push(t.id);
        startChapter(h.ch, true);
      } else if (h.ch < CHAPTERS.length) startChapter(h.ch, false);
      // quests
      if (h.ch < CHAPTERS.length) {
        const ch = CHAPTERS[h.ch];
        for (const q of ch.quests) {
          if (h.done.includes(q.id)) continue;
          if (progress(q) >= goalNeed(q.goal)) {
            h.done.push(q.id); K.addXP(2); K.stat('hikayeGorev');
            say(q.giver, 'Görev tamam: ' + q.title, q.done);
            log('Görev tamam: ' + q.title + ' (' + ch.place + ').');
            K.dirty();
          }
        }
        if (ch.quests.every(q => h.done.includes(q.id)) && !h.fin.includes(ch.finale.id)) enqueue(ch.finale);
      } else if (S.day - h.seasonDay >= TM.seasonGapDays) {
        h.seasonDay = S.day;
        const sc = NEW_SEASON[h.season % NEW_SEASON.length]; h.season++;
        enqueue(sc); log('Yeni sezon tuhaflığı: ' + sc.title + '.');
      }
      // absurd breaks
      for (const a of ABSURD) if (!h.absurd.includes(a.id) && (S.day > a.day || (S.day === a.day && S.dayT >= a.at))) { h.absurd.push(a.id); enqueue(a.scene); break; }
      // tutorials by character
      // survey npc1/h8: no unsolicited character tutorials; they stay replayable from the Defter
      // rivals
      if (h.ch >= 1 && !rv) {
        if (h.rv.next <= 0) h.rv.next = S.playT + rng.range(TM.firstRival[0], TM.firstRival[1]);
        else if (S.playT >= h.rv.next && !cur && !queue.length && !rt.panel) { h.rv.next = S.playT + rng.range(TM.rivalGap[0], TM.rivalGap[1]); startRival(); }
      }
      // play the next scene when nothing else is open
      if (!cur && queue.length && !rt.panel && !rt.boardOpen) takeScene();
    },
  });

  // ───────── commands ─────────
  function replay(id: string): void {
    const all: SceneDef[] = [...CHAPTERS.map(c => c.finale), ...TUTORS.map(t => t.scene), ...ABSURD.map(a => a.scene), ...NEW_SEASON];
    const s = all.find(x => x.id === id);
    if (!s) return;
    rt.panel = null;
    if (cur) finishScene();
    cur = { scene: s, n: ++runN, replay: true };
  }
  function handle(c: { kind: string; [k: string]: unknown }): boolean {
    if (c.kind !== 'hikaye') return false;
    const op = String(c.op || ''), id = String(c.id ?? '');
    switch (op) {
      case 'open': rt.boardOpen = false; rt.panel = 'hikaye'; save().seenCh = save().ch; if (id) save().tab = id; return true;
      case 'tab': save().tab = id || 'bolum'; return true;
      case 'sceneDone': case 'skip': finishScene(); return true;
      case 'replay': replay(id); return true;
      case 'rival': answerRival(id); return true;
      case 'rivalClose': if (rv && !rv.choices.length) endRival(); return true;
      case 'araDone': ara = null; return true;
      case 'resultDone': last = null; return true;
      default: return true;
    }
  }

  // ───────── panel ─────────
  function panelModel(): Record<string, any> {
    const h = save(), S = K.state;
    const chapters = CHAPTERS.map((ch, i) => ({
      id: ch.id, n: ch.n, place: ch.place, title: ch.title, blurb: ch.blurb, state: i < h.ch ? 'done' : i === h.ch ? 'now' : 'lock',
      finale: ch.finale.id, finaleTitle: ch.finale.title, reward: fmtMoney(Math.round(ch.rewardMin * perMin())) + ' + ' + ch.gold + ' Altın Simit',
      quests: i === h.ch ? ch.quests.map(q => ({ id: q.id, title: q.title, text: q.text, giver: SPEAKERS[q.giver].name, who: q.giver, done: h.done.includes(q.id), p: progress(q), need: goalNeed(q.goal) })) : [],
    }));
    const rivals = RIVALS.map(r => ({
      id: r.id, name: r.name, kind: r.kind === 'zincir' ? 'Büyük zincir' : 'Yerel dükkan', who: r.who, color: r.color, slogan: r.slogan, blurb: r.blurb,
      state: h.ch < r.from ? 'yok' : turned(r) ? 'donustu' : 'aktif', quip: r.quips[(S.day + r.id.length) % r.quips.length], turned: r.turned, met: h.rv.met.includes(r.id),
    }));
    const tutors = TUTORS.map(t => ({ id: t.scene.id, name: t.system, who: t.scene.lines[0][0], seen: h.tutSeen.includes(t.id) }));
    const scenes = [
      ...CHAPTERS.filter(c => h.fin.includes(c.finale.id)).map(c => ({ id: c.finale.id, title: 'Bölüm ' + c.n + ' finali: ' + c.finale.title })),
      ...ABSURD.filter(a => h.absurd.includes(a.id)).map(a => ({ id: a.scene.id, title: a.scene.title })),
    ];
    return {
      tab: h.tab, ch: h.ch, total: CHAPTERS.length, season: h.ch >= CHAPTERS.length, chapters, rivals, tutors, scenes,
      log: h.log.slice().reverse(), wins: h.rv.wins, losses: h.rv.losses, tat: h.rv.tat,
      dip: h.dipT > 0 ? Math.round((1 - h.dipX) * 100) : 0, boost: h.boostT > 0 ? Math.round((TM.boostX - 1) * 100) : 0,
      event: rv ? { title: rv.title, rival: rv.rivalName } : null,
      ortak: h.ortak ? { name: h.ortak.r, got: Math.max(0, statOf('sales') - h.ortak.base), need: TM.ortakN } : null,
    };
  }
  function summary(): Record<string, any> | null {
    if (!HIKAYE_ON) return null;
    const h = save();
    if (h.ch >= CHAPTERS.length) return { season: true, title: 'Yeni sezon', place: 'Martıköy', done: 3, total: 3, isNew: false, event: rv ? rv.title : '' };
    const ch = CHAPTERS[h.ch];
    const next = ch.quests.find(q => !h.done.includes(q.id));
    return { season: false, n: ch.n, place: ch.place, title: ch.title, done: ch.quests.filter(q => h.done.includes(q.id)).length, total: 3, next: next ? next.text : 'Bölüm finali hazır!', isNew: h.seenCh !== h.ch, event: rv ? rv.title + ' (' + rv.rivalName + ')' : '' };
  }

  const api: HikayeApi = {
    handle, panelModel, summary,
    scene: () => cur, ara: () => ara, rival: () => rv, result: () => last,
    ortak: () => { const h = save(); return h.ortak ? { name: h.ortak.r, left: Math.max(0, TM.ortakN - (statOf('sales') - h.ortak.base)), secs: Math.max(0, Math.ceil(h.ortak.until - K.state.playT)) } : null; },
    dipX: () => { const h = save(); return h.dipT > 0 ? h.dipX : 1; },
  };
  (rt as unknown as { hikaye: HikayeApi }).hikaye = api;
  K.addStateView(() => ({ hikaye: { ch: save().ch, scene: cur ? cur.scene.id : null, rival: rv ? rv.kind : null } }));
  return api;
}

export function hikayeApi(r: { rt: unknown }): HikayeApi | null { return ((r.rt as { hikaye?: HikayeApi }).hikaye) || null; }
export function hikayePanelModel(r: { rt: unknown }): Record<string, any> { const a = hikayeApi(r); return a ? a.panelModel() : {}; }
export function hikayeSummary(r: { rt: unknown }): Record<string, any> | null { const a = hikayeApi(r); return a ? a.summary() : null; }
