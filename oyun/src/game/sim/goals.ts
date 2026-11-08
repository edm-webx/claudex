/**
 * Hedefler, bahşiş kavanozu (survey ekonomi-6, ekonomi-7, musteri-8). Pure sim module:
 * no three, no DOM, seeded rng only.
 * - Persistent state: GameState.zones['hedef'] (created with defaults on first read, so old saves load untouched).
 * - Goals card model: 1 main goal (next meaningful unlock: the cheapest open pad, else the cheapest tier upgrade, else
 *   the stars for the next tadilat, or the running tadilat) with a money progress bar; the player can "pin" another
 *   candidate (ekonomi-7 "hedefe iğne at", op 'pin' cycles). 2 small goals rotate from content SMALL_GOALS; each
 *   counts the delta of one S.stats key since it was given; done -> small ₺ reward + toast; the UI sees `doneN` grow
 *   and plays the coin sound + flying coins.
 * - Tip jar: every 'tip' event (and a müdavim's 'regularOk') drops a coin in the jar; at JAR cap the jar is full:
 *   every worker gets +JAR_MORALE morale (morale drives worker speed via moraleFactor and decays on its own, so the
 *   boost fades naturally), the jar sparkles JAR_SPARKLE_S sim seconds. Empties at day end.
 * - Commands: { kind: 'hedef', op: 'fold' | 'pin' | 'go' }.
 * - Views/UI read `hedefApi(rules)`: card(), jar().
 */
import type { Rules } from './state';
import type { ProductId } from './schema';
import {
  SMALL_GOALS, GOAL_NEXT_S, GOAL_DONE_LINES, JAR_BASE, JAR_PER_STAGE, JAR_MORALE, JAR_SPARKLE_S, JAR_FULL_LINES, JAR_FULL_ALONE,
  JAR_REGULAR_LINE, type SmallGoalDef,
} from '../../content/goals';
import { padDef } from '../../content/pads';
import { KIOSK_STAGES } from '../../content/stages';
import { PRODUCTS, PRODUCT_IDS } from '../../content/products';
import { clamp, fmtMoney } from './util';

export const HEDEF_KEY = 'hedef';

interface SlotSave { id: string; base: number; doneAt: number }
interface HedefSave {
  slots: (SlotSave | null)[]; doneN: number; lastIds: string[]; fold: boolean; pin: string;
  jar: number; jarDay: number; jarFull: boolean; jarFullAt: number;
  prevEarned: number;
}

export interface MainGoalModel { key: string; label: string; sub: string; cost: number; have: number; frac: number; ready: boolean; pinned: boolean; canPin: boolean; go: string }
export interface SmallGoalModel { id: string; text: string; n: number; got: number; reward: number; done: boolean }
export interface GoalCardModel { fold: boolean; main: MainGoalModel | null; small: SmallGoalModel[]; doneN: number }
export interface JarModel { fill: number; full: boolean; sparkle: boolean; coins: number; cap: number }
export interface HedefApi {
  handle(c: { kind: string; [k: string]: unknown }): boolean;
  card(): GoalCardModel;
  jar(): JarModel;
}

const round5 = (v: number) => Math.max(5, Math.round(v / 5) * 5);

export function installHedef(r: Rules): HedefApi {
  const rng = r.rng('sim.hedef');
  const S = () => r.state;
  const G = (): HedefSave => {
    const st = S();
    if (!st.zones || typeof st.zones !== 'object') st.zones = {};
    let g = st.zones[HEDEF_KEY] as unknown as HedefSave | undefined;
    if (!g || typeof g !== 'object') { g = {} as HedefSave; st.zones[HEDEF_KEY] = g as unknown as Record<string, unknown>; }
    if (!Array.isArray(g.slots)) g.slots = [null, null];
    while (g.slots.length < 2) g.slots.push(null);
    if (!Array.isArray(g.lastIds)) g.lastIds = [];
    g.doneN = g.doneN | 0; if (g.fold === undefined) g.fold = true; g.fold = !!g.fold; g.pin = typeof g.pin === 'string' ? g.pin : '';
    g.jar = g.jar | 0; g.jarDay = g.jarDay | 0; g.jarFull = !!g.jarFull; g.jarFullAt = Number(g.jarFullAt) || 0;
    g.prevEarned = Number(g.prevEarned) || 0;
    return g;
  };
  const stat = (k: string) => Number(S().stats[k]) || 0;
  const def = (id: string): SmallGoalDef | undefined => SMALL_GOALS.find(d => d.id === id);
  const rewardOf = (d: SmallGoalDef) => round5(Math.max(d.reward, (r.rt.rate || 0) * d.min));

  // ───────── small goals ─────────
  const eligible = (d: SmallGoalDef, g: HedefSave): boolean => {
    const st = S();
    if (d.needs && !st.owned[d.needs]) return false;
    if (d.minDay && st.day < d.minDay) return false;
    if (g.slots.some(s => s && s.id === d.id)) return false;
    // two goals on the same stat at once would complete together
    if (g.slots.some(s => { const o = s && def(s.id); return !!o && o.stat === d.stat; })) return false;
    return true;
  };
  function roll(i: number): void {
    const g = G();
    g.slots[i] = null;
    let pool = SMALL_GOALS.filter(d => eligible(d, g) && !g.lastIds.includes(d.id));
    if (!pool.length) pool = SMALL_GOALS.filter(d => eligible(d, g));
    if (!pool.length) return;
    const d = rng.pick(pool);
    g.slots[i] = { id: d.id, base: stat(d.stat), doneAt: -1 };
    g.lastIds.push(d.id); while (g.lastIds.length > 4) g.lastIds.shift();
  }
  function checkSmall(): void {
    const g = G(), t = S().playT;
    for (let i = 0; i < g.slots.length; i++) {
      const s = g.slots[i];
      if (!s) { roll(i); continue; }
      const d = def(s.id);
      if (!d) { roll(i); continue; }
      if (s.doneAt >= 0) { if (t - s.doneAt >= GOAL_NEXT_S) roll(i); continue; }
      if (stat(d.stat) - s.base >= d.n) {
        s.doneAt = t; g.doneN++;
        const rw = rewardOf(d);
        r.earn(rw);
        r.toast(rng.pick(GOAL_DONE_LINES) + ': ' + d.text + '! +' + fmtMoney(rw), 'good');
        r.stat('hedefDone');
      }
    }
  }

  // ───────── main goal ─────────
  function candidates(): MainGoalModel[] {
    const st = S(), rt = r.rt, money = st.money, out: MainGoalModel[] = [];
    if (st.tadilat) {
      const t = st.tadilat as unknown as { left?: number; total?: number };
      const frac = t.total ? clamp(1 - (t.left || 0) / t.total, 0, 1) : 0;
      out.push({ key: 'tadilat', label: 'Tadilat sürüyor', sub: Math.ceil(t.left || 0) + ' sn kaldı, ustalar çayda', cost: 0, have: 0, frac, ready: false, pinned: false, canPin: false, go: '' });
      return out;
    }
    const pads = rt.pads.slice().sort((a, b) => a.price - b.price);
    for (const p of pads) {
      const d = padDef(p.key); if (!d || p.price <= 0) continue;
      const paid = Number(st.padPaid[p.key]) || 0, have = paid + money;
      const label = d.kind === 'tadilat' ? 'Tadilat: ' + ((KIOSK_STAGES[st.stage] && KIOSK_STAGES[st.stage].short) || 'yeni büfe') : d.label.charAt(0) + d.label.slice(1).toLocaleLowerCase('tr');
      out.push({ key: 'pad.' + p.key, label, sub: have >= p.price ? 'Hazır! Sarı kareye yürü' : d.sub, cost: p.price, have, frac: clamp(have / p.price, 0, 1), ready: have >= p.price, pinned: false, canPin: true, go: '' });
    }
    const tiers: MainGoalModel[] = [];
    for (const p of PRODUCT_IDS as readonly ProductId[]) {
      if (!rt.stations[p] || !rt.stations[p].built || (st.tiers[p] || 1) >= 4) continue;
      const cost = r.ext.upgradeCost(p); if (!cost) continue;
      const next = PRODUCTS[p].tiers[st.tiers[p]];
      tiers.push({ key: 'tier.' + p, label: PRODUCTS[p].short + ' ' + ((st.tiers[p] || 1) + 1) + '. kademe', sub: money >= cost ? 'Hazır! Menü defterinden yükselt' : (next ? next.name : 'Daha lezzetli'), cost, have: money, frac: clamp(money / cost, 0, 1), ready: money >= cost, pinned: false, canPin: true, go: 'menu' });
    }
    tiers.sort((a, b) => a.cost - b.cost);
    out.push(...tiers);
    const nx = KIOSK_STAGES[st.stage];
    if (nx && !nx.soon && nx.req && st.stars < nx.req.stars) {
      out.push({ key: 'star', label: nx.req.stars + ' yıldıza ulaş', sub: nx.short + ' tadilatı için karneyi parlat', cost: 0, have: 0, frac: clamp(st.stars / nx.req.stars, 0, 1), ready: false, pinned: false, canPin: true, go: 'karne' });
    }
    return out;
  }
  function mainGoal(): MainGoalModel | null {
    const c = candidates(); if (!c.length) return null;
    const g = G();
    const pinned = g.pin ? c.find(x => x.key === g.pin) : undefined;
    if (pinned) { pinned.pinned = true; return pinned; }
    // default: the first pad (cheapest), else the cheapest upgrade, else stars
    return c[0];
  }
  function pinNext(): void {
    const c = candidates().filter(x => x.canPin), g = G();
    if (c.length < 2) { r.toast(c.length ? 'Şimdilik tek hedef var, iğne zaten onda.' : 'Şimdilik iğnelenecek hedef yok.', 'info'); return; }
    const cur = mainGoal();
    const i = cur ? c.findIndex(x => x.key === cur.key) : -1;
    const nx = c[(i + 1) % c.length];
    g.pin = nx.key === c[0].key ? '' : nx.key;
    r.toast('İğne atıldı: ' + nx.label, 'info');
  }

  // ───────── tip jar ─────────
  const jarCap = () => JAR_BASE + JAR_PER_STAGE * clamp(S().stage, 1, 10);
  function jarCoin(n: number, line?: string): void {
    const g = G();
    if (g.jarDay !== S().day) { g.jarDay = S().day; g.jar = 0; g.jarFull = false; }
    if (g.jarFull) return;
    g.jar += n;
    if (line && g.jar < jarCap()) r.toast(line, 'info');
    if (g.jar >= jarCap()) {
      g.jar = jarCap(); g.jarFull = true; g.jarFullAt = S().playT;
      const ws = S().workers;
      ws.forEach(w => { w.morale = Math.min(100, (Number(w.morale) || 70) + JAR_MORALE); });
      r.toast(ws.length ? rng.pick(JAR_FULL_LINES) : JAR_FULL_ALONE, 'good');
      r.stat('jarFull');
    }
  }
  r.bus.on('tip', () => { jarCoin(1); });
  r.bus.on('regularOk', () => { jarCoin(1, JAR_REGULAR_LINE); });

  r.bus.on('dayEnd', (e) => {
    const g = G();
    const data = (e || {}) as { day?: number; earned?: number };
    g.prevEarned = Math.round(Number(data.earned) || 0);
    // the jar empties at day end
    g.jar = 0; g.jarFull = false; g.jarDay = (Number(data.day) || S().day) + 1;
  });

  let acc = 0;
  r.addSystem({
    id: 'hedef', order: 48, phase: 'sim',
    step(ctx) {
      if (!r.rt.started || r.rt.paused) return;
      if ((acc -= ctx.dt) > 0) return;
      acc = 0.5;
      checkSmall();
      const g = G();
      if (g.jarDay !== S().day) { g.jarDay = S().day; g.jar = 0; g.jarFull = false; }
    },
  });

  const api: HedefApi = {
    handle(c) {
      const g = G();
      switch (String(c.op || '')) {
        case 'fold': g.fold = c.value === undefined ? !g.fold : !!c.value; return true;
        case 'pin': pinNext(); return true;
        case 'go': {
          const m = mainGoal(); if (!m) return true;
          if (m.go) r.command({ kind: 'openPanel', id: m.go });
          else if (m.key.startsWith('pad.')) r.toast(m.ready ? 'İskeledeki sarı "' + m.label + '" karesine yürü, para akınca açılır.' : 'Biriktir: ' + fmtMoney(m.cost) + '. İskeledeki sarı karede bekliyor.', 'info');
          return true;
        }
        default: return true;
      }
    },
    card() {
      const g = G();
      const small: SmallGoalModel[] = [];
      for (const s of g.slots) {
        if (!s) continue;
        const d = def(s.id); if (!d) continue;
        const done = s.doneAt >= 0;
        small.push({ id: d.id, text: d.text, n: d.n, got: done ? d.n : clamp(stat(d.stat) - s.base, 0, d.n), reward: rewardOf(d), done });
      }
      return { fold: g.fold, main: mainGoal(), small, doneN: g.doneN };
    },
    jar() {
      const g = G(), cap = jarCap();
      const coins = g.jarDay === S().day ? g.jar : 0, full = g.jarDay === S().day && g.jarFull;
      return { fill: clamp(coins / cap, 0, 1), full, sparkle: full && S().playT - g.jarFullAt < JAR_SPARKLE_S, coins, cap };
    },
  };
  (r.rt as unknown as { hedef: HedefApi }).hedef = api;
  r.addStateView(() => { const g = G(); return { hedef: { small: g.slots.map(s => (s ? s.id : null)), doneN: g.doneN, jar: g.jar, jarFull: g.jarFull, pin: g.pin } }; });
  return api;
}

export function hedefApi(r: { rt: unknown } | null | undefined): HedefApi | null { return r ? ((r.rt as { hedef?: HedefApi }).hedef || null) : null; }
