/**
 * v2 save (localStorage 'sabrinin-bufesi-v2') -> GameState. Field names match 1:1; the shapes that changed are
 * converted: owned (true -> 1), decorSlots (array of ids|null -> [{slot,item}]), cats (ids -> {id}), settings (extended).
 * Accepts the raw data object or a wrapper { data } / { d } / { v, data }, as a string or object. Owner: Builder A. Pure.
 */
import { defaultState, defaultSettings, newToday, SAVE_VERSION, type GameState, type CatSave, type DecorSlotSave, type WorkerSave } from './schema';
import { normalizeState } from './save';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, d = 0): number => (typeof v === 'number' && isFinite(v) ? v : d);

export function migrateV2(input: unknown, seed = 1): GameState {
  let raw: unknown = input;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = {}; } }
  if (isObj(raw) && isObj(raw.data)) raw = raw.data; else if (isObj(raw) && isObj(raw.d)) raw = raw.d;
  const v = (isObj(raw) ? raw : {}) as Record<string, any>;
  const s = defaultState(num(v.seed, seed) || seed);
  const put = <K extends keyof GameState>(k: K, val: unknown) => { if (val !== undefined && val !== null) (s as unknown as Record<string, unknown>)[k as string] = val; };
  for (const k of ['money', 'gold', 'xp', 'level', 'day', 'dayT', 'playT', 'totalEarned', 'stage', 'nextWid', 'jobRefreshAt', 'boards', 'stars', 'plaque', 'magnet', 'kepenk', 'vipLast', 'pile', 'floor', 'owedBack', 'lastSeen', 'rate', 'kapkacDay', 'karamelDay', 'teamDay', 'tanidikDay'] as const) put(k, num(v[k], (s as any)[k]));
  put('hero', v.hero === 'sabri' || v.hero === 'sabriye' ? v.hero : null);
  s.gurmePass = !!v.gurmePass; s.dog = !!v.dog; s.teamWin = !!v.teamWin;
  if (isObj(v.owned)) for (const k of Object.keys(v.owned)) if (v.owned[k]) s.owned[k] = 1;
  if (isObj(v.padPaid)) for (const k of Object.keys(v.padPaid)) s.padPaid[k] = num(v.padPaid[k]);
  if (isObj(v.tiers)) for (const k of Object.keys(s.tiers)) s.tiers[k as keyof typeof s.tiers] = Math.min(4, Math.max(1, num(v.tiers[k], 1)));
  if (isObj(v.grades)) for (const k of Object.keys(s.grades)) s.grades[k as keyof typeof s.grades] = Math.min(5, Math.max(1, num(v.grades[k], 1)));
  if (Array.isArray(v.renewed)) s.renewed = v.renewed.map(String);
  if (isObj(v.tadilat)) s.tadilat = { part: 'stage' + num(v.tadilat.to), endsAt: s.playT + num(v.tadilat.left), to: num(v.tadilat.to), left: num(v.tadilat.left), total: num(v.tadilat.total) };
  if (Array.isArray(v.workers)) s.workers = v.workers.filter(isObj).map(w => ({ ...w, id: num(w.id), name: String(w.name ?? 'İşçi'), role: String(w.role ?? 'garson'), xp: num(w.xp), morale: num(w.morale, 70), traits: Array.isArray(w.traits) ? w.traits : [String(w.trait ?? 'hamarat')] }) as WorkerSave);
  s.jobCards = Array.isArray(v.jobCards) ? v.jobCards : null;
  if (isObj(v.stats)) for (const k of Object.keys(v.stats)) s.stats[k] = num(v.stats[k]);
  if (isObj(v.ach)) for (const k of Object.keys(v.ach)) s.ach[k] = num(v.ach[k], 1);
  if (Array.isArray(v.cats)) s.cats = v.cats.map((c: unknown): CatSave => (isObj(c) ? ({ ...c, id: String(c.id) } as CatSave) : { id: String(c) }));
  if (Array.isArray(v.decorOwned)) s.decorOwned = v.decorOwned.map(String);
  if (Array.isArray(v.decorSlots)) {
    const out: DecorSlotSave[] = [];
    v.decorSlots.forEach((it: unknown, i: number) => { if (typeof it === 'string' && it) out.push({ slot: String(i), item: it }); else if (isObj(it) && it.item) out.push({ ...(it as object), slot: String(it.slot ?? i), item: String(it.item) } as DecorSlotSave); });
    s.decorSlots = out;
  }
  s.sign = isObj(v.sign) ? v.sign : null;
  s.orders = isObj(v.orders) ? (v.orders as unknown as unknown[]) : null;
  if (isObj(v.regulars)) s.regulars = v.regulars as GameState['regulars'];
  if (isObj(v.tut)) for (const k of Object.keys(v.tut)) s.tut[k] = num(v.tut[k], 1);
  s.settings = { ...defaultSettings(), ...(isObj(v.settings) ? v.settings : {}) } as GameState['settings'];
  s.siftahDate = typeof v.siftahDate === 'string' ? v.siftahDate : '';
  if (isObj(v.week)) s.week = { earned: num(v.week.earned), customers: num(v.week.customers) };
  s.today = isObj(v.today) ? { ...newToday(), ...(v.today as object) } : newToday();
  s.version = SAVE_VERSION;
  normalizeState(s);
  return s;
}
