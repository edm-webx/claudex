/**
 * Çalışanlar, sim side (survey calisan-1, calisan-3). Pure: no three, no DOM, seeded rng only.
 * Decisions:
 * - Persistent state in GameState.zones.calisan (defaults created on first read, so old saves load). Only `kurs` and
 *   `bench` are read; the old keys of earlier builds (morale events, bank tabs, venues) are left alone in old saves.
 * - Workers on duty at İskele stay in GameState.workers (the workers agent system draws and runs them). A worker at
 *   the Kurs Merkezi is moved OUT of S.workers; when the course ends and the role is full, the worker waits in `bench`
 *   (the waiting list, "Bekleyenler") until "Göreve çağır" puts them back on duty.
 * - Roster grows 6 -> 10 with the kiosk stage: extra garson / temizlik slots are written into ROLE_SLOTS every tick
 *   from S.stage (deterministic from state). Station roles keep one slot each (one stand per station).
 * - Kurs Merkezi (calisan-3): the worker leaves and returns with xp (and a rank if it crosses one).
 * - Huy lines (animasyon-8): the personality motions pop a line now and then (view/chars/huy-motion.ts).
 * - Commands: { kind: 'calisan', op, id? } ops: tab, sel, close, kurs (id 'wid|kursId'), call.
 */
import type { Kernel } from './state';
import type { GameState, WorkerSave } from './schema';
import { ROLES, ROLE_SLOTS, RANKS, rankOf } from '../../content/ranks';
import { KURSLAR, KURS_SLOTS, KURS_MERKEZI, KURS_GIDIS, KURS_DONUS, STAGE_EXTRA_SLOTS, HUY_LINES } from '../../content/calisan';
import { roleOpen, roleWhy } from './agents/hiring';
import { fmtMoney } from './util';

interface KursRow { w: WorkerSave; kurs: string; until: number; total: number }
interface CalisanSave { kurs: KursRow[]; bench: WorkerSave[] }
export interface CalisanApi {
  handle(c: { kind: string; [k: string]: unknown }): boolean;
  summary(): Record<string, any>;
}

export function installCalisan(K: Kernel): CalisanApi {
  const rng = K.rng('calisan');
  const rt = K.rt;
  let tab = 'kadro';
  let sel: { id: number } | null = null;
  let huyT = 30;

  function save(): CalisanSave {
    const S = K.state;
    if (!S.zones || typeof S.zones !== 'object') (S as { zones: Record<string, Record<string, unknown>> }).zones = {};
    let m = S.zones.calisan as unknown as CalisanSave | undefined;
    if (!m || typeof m !== 'object') {
      m = { kurs: [], bench: [] };
      S.zones.calisan = m as unknown as Record<string, unknown>;
    }
    if (!Array.isArray(m.kurs)) m.kurs = [];
    if (!Array.isArray(m.bench)) m.bench = [];
    return m;
  }
  const agentsW = () => (rt as unknown as { agents?: { workers: { say(id: number, t: string, s?: number): void } } }).agents?.workers ?? null;
  const say = (id: number, t: string) => { try { agentsW()?.say(id, t, 3); } catch { /* agents optional */ } };
  const host = () => K.hiringHost();

  function applySlots(S: GameState) {
    const x = STAGE_EXTRA_SLOTS[Math.max(0, Math.min(STAGE_EXTRA_SLOTS.length - 1, (S.stage || 1) - 1))];
    ROLE_SLOTS.garson = x.garson; ROLE_SLOTS.temizlik = x.temizlik;
  }
  const capOf = () => { let n = 0; for (const k in ROLE_SLOTS) n += ROLE_SLOTS[k] || 0; return n; };
  const kursCost = (w: WorkerSave, k: { cost: number }) => k.cost * (rankOf(w.xp || 0) + 1);
  /** Remove a worker from wherever it is (duty or waiting list); returns where it was. */
  function takeOut(S: GameState, m: CalisanSave, id: number): { w: WorkerSave; from: 'duty' | 'bench' } | null {
    let i = S.workers.findIndex(w => w.id === id);
    if (i >= 0) { const w = S.workers[i]; S.workers.splice(i, 1); return { w, from: 'duty' }; }
    i = m.bench.findIndex(w => w.id === id);
    if (i >= 0) { const w = m.bench[i]; m.bench.splice(i, 1); return { w, from: 'bench' }; }
    return null;
  }
  const findAny = (S: GameState, m: CalisanSave, id: number) => S.workers.find(w => w.id === id) || m.bench.find(w => w.id === id) || null;
  /** Try to put a worker on duty at İskele; returns the reason when the role is full / closed, '' when placed. */
  function toDuty(S: GameState, w: WorkerSave): string {
    if (!roleOpen(S, host(), w.role)) return roleWhy(S, host(), w.role);
    S.workers.push(w); K.dirty();
    return '';
  }

  function startKurs(S: GameState, m: CalisanSave, arg: string) {
    const [ids, kid] = arg.split('|');
    const k = KURSLAR.find(x => x.id === kid), id = Number(ids);
    const w = findAny(S, m, id);
    if (!k || !w) return;
    if (m.kurs.length >= KURS_SLOTS) { K.toast(KURS_MERKEZI + ' dolu. Biri dönünce yer açılır.', 'info'); return; }
    if (k.minRank && rankOf(w.xp || 0) < k.minRank) { K.toast(k.name + ' için en az ' + RANKS[k.minRank].name + ' olmalı.', 'info'); return; }
    const cost = kursCost(w, k);
    if (S.money < cost) { K.toast('Kurs için ' + fmtMoney(cost) + ' lazım.', 'bad'); return; }
    K.spend(cost);
    say(w.id, rng.pick(KURS_GIDIS));
    takeOut(S, m, id);
    // BUF-18: the worker really leaves for `sure` play seconds (shown in the Kurs tab) and comes back with the xp
    m.kurs.push({ w, kurs: k.id, until: S.playT + k.sure, total: k.sure });
    K.toast(w.name + ' ' + k.name + "'na gitti, " + Math.round(k.sure / 60 * 10) / 10 + ' dk sonra döner.', 'info');
    K.stat('kurs'); sel = null; K.dirty();
    K.saveNow();
  }
  function finishKurs(S: GameState, m: CalisanSave, row: KursRow) {
    const k = KURSLAR.find(x => x.id === row.kurs) || KURSLAR[0], w = row.w;
    const was = rankOf(w.xp || 0);
    w.xp = (w.xp || 0) + k.xp;
    const r = rankOf(w.xp || 0);
    w.rank = r;
    w.kursN = (Number(w.kursN) || 0) + 1;
    const why = toDuty(S, w);
    if (why) { m.bench.push(w); K.toast(w.name + ' kurstan döndü! Kadro dolu, bekleme listesinde.', 'good'); }
    else { K.toast(w.name + ' kurstan döndü!' + (r > was ? ' Artık ' + RANKS[r].name + '!' : ' +' + k.xp + ' tecrübe'), 'good'); }
    K.logEv('kursDone', { name: w.name, kurs: k.id });
    pendingSay.push({ id: w.id, t: rng.pick(KURS_DONUS), at: S.playT + 2.5 });
    if (r >= 1) K.statMax('kalfa', 1);
    if (r >= 2) K.statMax('usta', 1);
  }
  const pendingSay: { id: number; t: string; at: number }[] = [];

  function call(S: GameState, m: CalisanSave, id: number) {
    const i = m.bench.findIndex(w => w.id === id); if (i < 0) return;
    const w = m.bench[i];
    if (!roleOpen(S, host(), w.role)) { K.toast(roleWhy(S, host(), w.role), 'info'); return; }
    m.bench.splice(i, 1); toDuty(S, w);
    K.toast(w.name + ' göreve döndü: ' + (ROLES[w.role]?.label || w.role), 'good'); sel = null; K.saveNow();
  }

  function handle(c: { kind: string; [k: string]: unknown }): boolean {
    const S = K.state, m = save(), op = String(c.op || ''), id = c.id == null ? '' : String(c.id);
    switch (op) {
      case 'tab': tab = ['kadro', 'kurs'].includes(id) ? id : 'kadro'; sel = null; return true;
      case 'sel': { const wid = id.split('|')[0]; const w = findAny(S, m, Number(wid)); sel = w ? { id: w.id } : null; return true; }
      case 'close': sel = null; return true;
      case 'kurs': startKurs(S, m, id); return true;
      case 'call': call(S, m, Number(id)); return true;
      default: return true;
    }
  }

  K.addSystem({
    id: 'calisan', order: 41, phase: 'sim',
    step(ctx) {
      const S = K.state;
      applySlots(S);
      if (!rt.started) return;
      const m = save(), dt = ctx.dt;
      for (let i = m.kurs.length - 1; i >= 0; i--) if (S.playT >= m.kurs[i].until) { const row = m.kurs[i]; m.kurs.splice(i, 1); finishKurs(S, m, row); }
      for (let i = pendingSay.length - 1; i >= 0; i--) if (S.playT >= pendingSay[i].at) { say(pendingSay[i].id, pendingSay[i].t); pendingSay.splice(i, 1); }
      // huy lines that go with the view's personality motion (view/chars/huy-motion.ts)
      if ((huyT -= dt) <= 0) {
        huyT = rng.range(35, 60);
        const cand = S.workers.filter(w => HUY_LINES[String((w as { trait?: string }).trait || '')] || rankOf(w.xp || 0) >= 2);
        if (cand.length) {
          const w = rng.pick(cand), tr = String((w as { trait?: string }).trait || '');
          say(w.id, rng.pick(HUY_LINES[tr] || HUY_LINES.usta));
        }
      }
    },
  });

  function summary(): Record<string, any> {
    const S = K.state, m = save();
    applySlots(S);
    const cap = capOf();
    const left = (r: KursRow) => Math.max(0, Math.ceil(r.until - S.playT));
    const card = (w: WorkerSave) => ({ id: w.id, name: w.name, roleLabel: ROLES[w.role]?.label || w.role, role: w.role, rankLabel: RANKS[rankOf(w.xp || 0)].name, look: (w as { look?: unknown }).look ?? null });
    const selW = sel ? findAny(S, m, sel.id) : null;
    return {
      tab, cap, n: S.workers.length, benchN: m.bench.length, kursN: m.kurs.length, kursCap: KURS_SLOTS,
      sel: selW && sel ? { ...card(selW),
        kurslar: KURSLAR.map(k => { const cost = kursCost(selW, k), rk = rankOf(selW.xp || 0); const lock = !!k.minRank && rk < k.minRank; return { id: k.id, name: k.name, desc: k.desc, min: Math.ceil(k.sure / 60), xp: k.xp, cost, can: !lock && S.money >= cost && m.kurs.length < KURS_SLOTS, why: lock ? 'En az ' + RANKS[k.minRank!].name + ' olmalı.' : m.kurs.length >= KURS_SLOTS ? 'Kurs Merkezi dolu.' : 'Biraz daha para lazım.' }; }),
      } : null,
      bench: m.bench.map(w => ({ ...card(w), canCall: roleOpen(S, host(), w.role), why: roleWhy(S, host(), w.role) })),
      kurs: m.kurs.map(r => ({ ...card(r.w), kursName: (KURSLAR.find(k => k.id === r.kurs) || KURSLAR[0]).name, left: left(r), frac: r.total ? 1 - left(r) / r.total : 1 })),
      merkez: KURS_MERKEZI,
    };
  }

  const api: CalisanApi = { handle, summary };
  (rt as unknown as { calisan: CalisanApi }).calisan = api;
  K.addStateView(() => { const m = save(); return { calisan: { bench: m.bench.length, kurs: m.kurs.length } }; });
  return api;
}

export function calisanSummary(r: { rt: unknown }): Record<string, any> | null {
  const a = ((r.rt as { calisan?: CalisanApi }).calisan) || null;
  return a ? a.summary() : null;
}
