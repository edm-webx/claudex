/**
 * Çalışanlar 2.0, sim side (survey calisan-1, calisan-3..6, musteri-8 morale). Pure: no three, no DOM, seeded rng only.
 * Decisions:
 * - Persistent state in GameState.zones.calisan (defaults created on first read, so old saves load).
 * - Workers on duty at the active venue (İskele) stay in GameState.workers (the workers agent system draws and runs
 *   them). A worker at the Kurs Merkezi, on the Dinlenme Bankı or at another venue is moved OUT of S.workers into
 *   this module's lists; moving back pushes the same save entry in again (the workers system walks it in).
 * - Roster per venue grows 6 -> 10 with the kiosk stage: extra garson / temizlik slots are written into ROLE_SLOTS
 *   every tick from S.stage (deterministic from state). Station roles keep one slot each (one stand per station).
 * - Kurs Merkezi (calisan-3): the worker leaves for `sure` play seconds and returns with xp + morale. If the role
 *   got filled meanwhile, the worker sits on the bench instead (no loss).
 * - Events (calisan-4): birthday cake (per worker, every PASTA.cycle days), weekly halı saha (once per 7-day week),
 *   çay molası köşesi (bought once: periodic morale), seasonal picnic (once per real season), Ayın Elemanı (auto
 *   every 7 days: biggest xp gain since the last pick, photo on the kiosk wall, view/world/calisan-look.ts).
 * - Other venues are data only for now (closed, with their future special role, calisan-1); the move UI already
 *   lists every open venue so new venues just flip `open`.
 * - Commands: { kind: 'calisan', op, id?, arg? } ops: tab, sel, close, kurs (id 'wid|kursId'), bank, call,
 *   pasta, hali, cay, piknik.
 */
import type { Kernel } from './state';
import type { GameState, WorkerSave } from './schema';
import { ROLES, ROLE_SLOTS, RANKS, rankOf, MORALE_START } from '../../content/ranks';
import { TRAITS } from '../../content/traits';
import {
  KURSLAR, KURS_SLOTS, KURS_MERKEZI, KURS_GIDIS, KURS_DONUS, MEKANLAR, BANK_CAP, BANK_NAME, BANK_LINES, STAGE_EXTRA_SLOTS,
  PASTA, PASTA_LINES, HALISAHA, HALISAHA_SONUC, CAY_KOSESI, CAY_KOSESI_LINES, PIKNIK, MEVSIMLER, AYIN_ELEMANI,
  AYIN_ELEMANI_LINES, AYIN_NOTE, HUY_LINES,
} from '../../content/calisan';
import { roleOpen, roleWhy } from './agents/hiring';
import { fmtMoney } from './util';

interface KursRow { w: WorkerSave; kurs: string; until: number; total: number }
interface AyinSave { id: number; name: string; look: unknown; day: number; roleLabel: string }
interface CalisanSave {
  kurs: KursRow[]; bench: WorkerSave[]; away: Record<string, WorkerSave[]>;
  cayKosesi: boolean; cayT: number; cakeDay: number; haliWeek: number; piknik: string;
  ayin: AyinSave | null; ayinDay: number; xpMark: Record<string, number>; bdayToast: number; log: string[];
}
export interface CalisanView {
  ayin: { name: string; look: unknown; roleLabel: string } | null;
  cake: boolean; cayKosesi: boolean; bench: { id: number; name: string; look: unknown }[]; kursN: number;
}
export interface CalisanApi {
  handle(c: { kind: string; [k: string]: unknown }): boolean;
  summary(): Record<string, any>;
  view(): CalisanView;
}

const seasonOf = (cal: string, day: number): { key: string; id: string } => {
  const m = Number(String(cal || '').slice(5, 7));
  const y = String(cal || '').slice(0, 4);
  if (!m) { const i = Math.floor((day - 1) / 30); return { key: 'd' + i, id: ['ilkbahar', 'yaz', 'sonbahar', 'kis'][i % 4] }; }
  const id = m >= 3 && m <= 5 ? 'ilkbahar' : m >= 6 && m <= 8 ? 'yaz' : m >= 9 && m <= 11 ? 'sonbahar' : 'kis';
  return { key: (m === 12 ? String(Number(y) + 1) : y) + id, id };
};
const bdayOf = (w: WorkerSave) => (w.id * 11 + 5) % PASTA.cycle;
const isBday = (w: WorkerSave, day: number) => day % PASTA.cycle === bdayOf(w);
const daysToBday = (w: WorkerSave, day: number) => (bdayOf(w) - (day % PASTA.cycle) + PASTA.cycle) % PASTA.cycle;

export function installCalisan(K: Kernel): CalisanApi {
  const rng = K.rng('calisan');
  const rt = K.rt;
  let tab = 'kadro';
  let sel: { id: number; mode: 'kurs' | 'tasi' } | null = null;
  let lastDay = -1;
  let huyT = 30;

  function save(): CalisanSave {
    const S = K.state;
    if (!S.zones || typeof S.zones !== 'object') (S as { zones: Record<string, Record<string, unknown>> }).zones = {};
    let m = S.zones.calisan as unknown as CalisanSave | undefined;
    if (!m || typeof m !== 'object') {
      m = { kurs: [], bench: [], away: {}, cayKosesi: false, cayT: 0, cakeDay: 0, haliWeek: -1, piknik: '', ayin: null, ayinDay: 0, xpMark: {}, bdayToast: 0, log: [] };
      S.zones.calisan = m as unknown as Record<string, unknown>;
    }
    if (!Array.isArray(m.kurs)) m.kurs = [];
    if (!Array.isArray(m.bench)) m.bench = [];
    if (!m.away || typeof m.away !== 'object') m.away = {};
    if (!m.xpMark || typeof m.xpMark !== 'object') m.xpMark = {};
    if (!Array.isArray(m.log)) m.log = [];
    for (const k of ['cayT', 'cakeDay', 'haliWeek', 'ayinDay', 'bdayToast'] as const) if (typeof m[k] !== 'number' || !isFinite(m[k])) m[k] = k === 'haliWeek' ? -1 : 0;
    m.cayKosesi = !!m.cayKosesi;
    if (typeof m.piknik !== 'string') m.piknik = '';
    return m;
  }
  const agentsW = () => (rt as unknown as { agents?: { workers: { say(id: number, t: string, s?: number): void } } }).agents?.workers ?? null;
  const say = (id: number, t: string) => { try { agentsW()?.say(id, t, 3); } catch { /* agents optional */ } };
  const host = () => K.hiringHost();
  const log = (m: CalisanSave, t: string) => { m.log.unshift(t); if (m.log.length > 6) m.log.length = 6; };

  function applySlots(S: GameState) {
    const x = STAGE_EXTRA_SLOTS[Math.max(0, Math.min(STAGE_EXTRA_SLOTS.length - 1, (S.stage || 1) - 1))];
    ROLE_SLOTS.garson = x.garson; ROLE_SLOTS.temizlik = x.temizlik;
  }
  const capOf = (S: GameState) => { let n = 0; for (const k in ROLE_SLOTS) n += ROLE_SLOTS[k] || 0; return n; };
  const kursCost = (w: WorkerSave, k: { cost: number }) => k.cost * (rankOf(w.xp || 0) + 1);
  const morale = (w: WorkerSave) => (w.morale == null ? MORALE_START : w.morale);
  const addMorale = (w: WorkerSave, n: number) => { w.morale = Math.max(0, Math.min(100, morale(w) + n)); };
  /** Remove a worker from wherever it is (duty or bench); returns where it was. */
  function takeOut(S: GameState, m: CalisanSave, id: number): { w: WorkerSave; from: 'duty' | 'bench' } | null {
    let i = S.workers.findIndex(w => w.id === id);
    if (i >= 0) { const w = S.workers[i]; S.workers.splice(i, 1); return { w, from: 'duty' }; }
    i = m.bench.findIndex(w => w.id === id);
    if (i >= 0) { const w = m.bench[i]; m.bench.splice(i, 1); return { w, from: 'bench' }; }
    return null;
  }
  const findAny = (S: GameState, m: CalisanSave, id: number) => S.workers.find(w => w.id === id) || m.bench.find(w => w.id === id) || null;
  /** Try to put a worker on duty at İskele; false (with a reason) when the role is full / closed. */
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
    const row: KursRow = { w, kurs: k.id, until: S.playT, total: 0 };
    finishKurs(S, m, row);
    K.stat('kurs'); log(m, w.name + ' kursa gitti (' + k.name + ').');
    // 2026-10-25 user: the course box stays on the SAME worker until they close it (train as often as wanted)
    sel = { id, mode: 'kurs' };
    K.saveNow();
  }
  function finishKurs(S: GameState, m: CalisanSave, row: KursRow) {
    const k = KURSLAR.find(x => x.id === row.kurs) || KURSLAR[0], w = row.w;
    const was = rankOf(w.xp || 0);
    w.xp = (w.xp || 0) + k.xp; addMorale(w, k.morale);
    const r = rankOf(w.xp || 0);
    w.rank = r;
    w.kursN = (Number(w.kursN) || 0) + 1;
    const why = toDuty(S, w);
    if (why) { m.bench.push(w); K.toast(w.name + ' kurstan döndü! Kadro dolu, ' + BANK_NAME + '\'nda bekliyor.', 'good'); }
    else { K.toast(w.name + ' kurstan döndü!' + (r > was ? ' Artık ' + RANKS[r].name + '!' : ' +' + k.xp + ' tecrübe'), 'good'); }
    K.logEv('kursDone', { name: w.name, kurs: k.id });
    log(m, w.name + ' kurstan döndü' + (r > was ? ', ' + RANKS[r].name + ' oldu.' : '.'));
    pendingSay.push({ id: w.id, t: rng.pick(KURS_DONUS), at: S.playT + 2.5 });
    if (r >= 1) K.statMax('kalfa', 1);
    if (r >= 2) K.statMax('usta', 1);
  }
  const pendingSay: { id: number; t: string; at: number }[] = [];

  function bank(S: GameState, m: CalisanSave, id: number) {
    if (!S.workers.some(w => w.id === id)) return;
    if (m.bench.length >= BANK_CAP) { K.toast(BANK_NAME + ' dolu (' + BANK_CAP + ' kişi).', 'info'); return; }
    const o = takeOut(S, m, id)!; m.bench.push(o.w);
    K.toast(o.w.name + ' ' + BANK_NAME + '\'na geçti. ' + rng.pick(BANK_LINES), 'info');
    addMorale(o.w, 3); sel = null; K.dirty(); K.saveNow();
  }
  function call(S: GameState, m: CalisanSave, id: number) {
    const i = m.bench.findIndex(w => w.id === id); if (i < 0) return;
    const w = m.bench[i];
    if (!roleOpen(S, host(), w.role)) { K.toast(roleWhy(S, host(), w.role), 'info'); return; }
    m.bench.splice(i, 1); toDuty(S, w);
    K.toast(w.name + ' göreve döndü: ' + (ROLES[w.role]?.label || w.role), 'good'); sel = null; K.saveNow();
  }
  function pasta(S: GameState, m: CalisanSave) {
    const w = S.workers.find(x => isBday(x, S.day)); if (!w || m.cakeDay === S.day) return;
    if (S.money < PASTA.cost) { K.toast('Pasta için ' + fmtMoney(PASTA.cost) + ' lazım.', 'bad'); return; }
    K.spend(PASTA.cost); m.cakeDay = S.day;
    addMorale(w, PASTA.morale); for (const o of S.workers) if (o !== w) addMorale(o, PASTA.others);
    say(w.id, rng.pick(PASTA_LINES));
    K.toast('İyi ki doğdun ' + w.name + '! Pasta tezgahta, herkes bir dilim aldı.', 'good');
    K.stat('pasta'); log(m, w.name + ' için doğum günü pastası kesildi.');
  }
  function hali(S: GameState, m: CalisanSave) {
    const wk = Math.floor((S.day - 1) / HALISAHA.every);
    if (m.haliWeek === wk || !S.workers.length) return;
    m.haliWeek = wk;
    const res = rng.pick(HALISAHA_SONUC);
    for (const w of S.workers) addMorale(w, HALISAHA.morale + ((TRAITS[(w as { trait?: string }).trait || '']?.fx.football) ? HALISAHA.futbolBonus : 0));
    K.toast('Halı saha: ' + res, 'good'); log(m, 'Halı saha: ' + res); K.stat('halisaha');
    const f = S.workers.find(w => (w as { trait?: string }).trait === 'futbol') || S.workers[0];
    if (f) say(f.id, 'Gol benim! Kimse itiraz etmesin.');
  }
  function cay(S: GameState, m: CalisanSave) {
    if (m.cayKosesi) return;
    if (S.money < CAY_KOSESI.cost) { K.toast('Çay köşesi için ' + fmtMoney(CAY_KOSESI.cost) + ' lazım.', 'bad'); return; }
    K.spend(CAY_KOSESI.cost); m.cayKosesi = true; m.cayT = 0;
    K.toast('Çay molası köşesi kuruldu! Semaver fokurduyor, ekip mutlu.', 'good'); log(m, 'Çay molası köşesi kuruldu.');
    for (const w of S.workers) addMorale(w, 5);
  }
  function piknik(S: GameState, m: CalisanSave) {
    const se = seasonOf(S.calendar, S.day);
    if (m.piknik === se.key || !S.workers.length) return;
    if (S.money < PIKNIK.cost) { K.toast('Piknik için ' + fmtMoney(PIKNIK.cost) + ' lazım.', 'bad'); return; }
    K.spend(PIKNIK.cost); m.piknik = se.key;
    for (const w of [...S.workers, ...m.bench]) addMorale(w, PIKNIK.morale);
    const txt = MEVSIMLER[se.id].piknik;
    K.toast(MEVSIMLER[se.id].name + ' pikniği: ' + txt, 'good'); log(m, MEVSIMLER[se.id].name + ' pikniği yapıldı.'); K.stat('piknik');
  }
  function pickAyin(S: GameState, m: CalisanSave) {
    if (!S.workers.length) return;
    let best: WorkerSave | null = null, bg = -1;
    for (const w of S.workers) { const g = (w.xp || 0) - (m.xpMark[String(w.id)] ?? 0); if (g > bg) { bg = g; best = w; } }
    for (const w of [...S.workers, ...m.bench]) m.xpMark[String(w.id)] = w.xp || 0;
    if (!best) return;
    m.ayin = { id: best.id, name: best.name, look: (best as { look?: unknown }).look ?? null, day: S.day, roleLabel: ROLES[best.role]?.label || best.role };
    m.ayinDay = S.day;
    addMorale(best, AYIN_ELEMANI.morale);
    best.ayinN = (Number(best.ayinN) || 0) + 1;
    K.toast('Ayın Elemanı: ' + best.name + '! Fotoğrafı büfenin duvarına asıldı.', 'good');
    pendingSay.push({ id: best.id, t: rng.pick(AYIN_ELEMANI_LINES), at: S.playT + 1 });
    log(m, 'Ayın Elemanı ' + best.name + ' seçildi.'); K.stat('ayinElemani');
  }

  function handle(c: { kind: string; [k: string]: unknown }): boolean {
    const S = K.state, m = save(), op = String(c.op || ''), id = c.id == null ? '' : String(c.id);
    switch (op) {
      case 'tab': tab = ['kadro', 'kurs', 'etkinlik', 'mekan'].includes(id) ? id : 'kadro'; sel = null; return true;
      case 'sel': { const [wid, mode] = id.split('|'); const w = findAny(S, m, Number(wid)); sel = w ? { id: w.id, mode: mode === 'tasi' ? 'tasi' : 'kurs' } : null; return true; }
      case 'close': sel = null; return true;
      case 'kurs': startKurs(S, m, id); return true;
      case 'bank': bank(S, m, Number(id)); return true;
      case 'call': call(S, m, Number(id)); return true;
      case 'pasta': pasta(S, m); return true;
      case 'hali': hali(S, m); return true;
      case 'cay': cay(S, m); return true;
      case 'piknik': piknik(S, m); return true;
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
      if (S.day !== lastDay) {
        const first = lastDay < 0; lastDay = S.day;
        if (!first && m.ayinDay !== S.day && (!m.ayin || (S.day - 1) % AYIN_ELEMANI.every === 0)) pickAyin(S, m);
        for (const w of S.workers) if (!((String(w.id)) in m.xpMark)) m.xpMark[String(w.id)] = w.xp || 0;
        const b = S.workers.find(w => isBday(w, S.day));
        if (b && m.bdayToast !== S.day) { m.bdayToast = S.day; K.toast('Bugün ' + b.name + '\'in doğum günü! Ekip > Etkinlikler\'den pasta kes.', 'info'); }
      }
      // huy lines that go with the view's personality motion (view/chars/huy-motion.ts)
      if ((huyT -= dt) <= 0) {
        huyT = rng.range(35, 60);
        const cand = S.workers.filter(w => HUY_LINES[String((w as { trait?: string }).trait || '')] || rankOf(w.xp || 0) >= 2);
        if (cand.length) {
          const w = rng.pick(cand), tr = String((w as { trait?: string }).trait || '');
          say(w.id, rng.pick(HUY_LINES[tr] || HUY_LINES.usta));
        }
      }
      if (m.cayKosesi && S.workers.length) {
        m.cayT += dt;
        if (m.cayT >= CAY_KOSESI.every) {
          m.cayT = 0;
          let low: WorkerSave | null = null;
          for (const w of S.workers) { if (morale(w) < 97) addMorale(w, CAY_KOSESI.morale); if (!low || morale(w) < morale(low)) low = w; }
          if (low) say(low.id, rng.pick(CAY_KOSESI_LINES));
        }
      }
    },
  });

  function summary(): Record<string, any> {
    const S = K.state, m = save();
    applySlots(S);
    const cap = capOf(S);
    const left = (r: KursRow) => Math.max(0, Math.ceil(r.until - S.playT));
    const card = (w: WorkerSave) => ({ id: w.id, name: w.name, roleLabel: ROLES[w.role]?.label || w.role, role: w.role, rankLabel: RANKS[rankOf(w.xp || 0)].name, look: (w as { look?: unknown }).look ?? null, morale: Math.round(morale(w)) });
    const selW = sel ? findAny(S, m, sel.id) : null;
    const bw = S.workers.find(w => isBday(w, S.day));
    const nextB = S.workers.slice().sort((a, b) => daysToBday(a, S.day) - daysToBday(b, S.day))[0];
    const wk = Math.floor((S.day - 1) / HALISAHA.every);
    const se = seasonOf(S.calendar, S.day);
    const events = [
      bw ? { id: 'pasta', icon: 'cake', title: 'Doğum günü: ' + bw.name, text: m.cakeDay === S.day ? 'Pasta kesildi, mumlar üflendi. Kremalı mutluluk!' : 'Bugün ' + bw.name + '\'in doğum günü! Pasta kes, keyfi tavan yapsın.', btn: 'Pasta kes', cost: PASTA.cost, done: m.cakeDay === S.day, can: S.money >= PASTA.cost }
        : { id: 'pasta', icon: 'cake', title: 'Doğum günü pastası', text: nextB ? 'Sıradaki doğum günü: ' + nextB.name + ', ' + daysToBday(nextB, S.day) + ' gün sonra.' : 'Ekip kurulunca doğum günleri takvime düşer.', btn: '', cost: 0, done: false, can: false },
      { id: 'hali', icon: 'ball', title: 'Haftalık halı saha', text: m.haliWeek === wk ? 'Bu haftanın maçı oynandı. Haftaya rövanş!' : 'Büfe FC sahaya çıkmaya hazır. Herkesin keyfi +' + HALISAHA.morale + ', futbol hastalarına ekstra.', btn: 'Maça çık', cost: 0, done: m.haliWeek === wk, can: S.workers.length > 0 },
      { id: 'cay', icon: 'cay', title: 'Çay molası köşesi', text: m.cayKosesi ? 'Semaver fokurduyor. Her ' + Math.round(CAY_KOSESI.every / 60) + ' dakikada ekibin keyfi biraz artar.' : 'Büfenin yanına minik bir çay köşesi kur: ekip mola verdikçe keyfi artar.', btn: 'Köşeyi kur', cost: CAY_KOSESI.cost, done: m.cayKosesi, can: S.money >= CAY_KOSESI.cost },
      { id: 'piknik', icon: 'sun', title: MEVSIMLER[se.id].name + ' pikniği', text: m.piknik === se.key ? 'Bu mevsimin pikniği yapıldı. ' + MEVSIMLER[se.id].piknik : 'Mevsimde bir kere bütün ekip (banktakiler dahil) pikniğe gider. Keyif +' + PIKNIK.morale + '.', btn: 'Pikniğe git', cost: PIKNIK.cost, done: m.piknik === se.key, can: S.money >= PIKNIK.cost && S.workers.length > 0 },
    ];
    const nextAyin = AYIN_ELEMANI.every - ((S.day - 1) % AYIN_ELEMANI.every);
    return {
      tab, cap, n: S.workers.length, bankN: m.bench.length, bankCap: BANK_CAP, kursN: m.kurs.length, kursCap: KURS_SLOTS,
      sel: selW && sel ? { ...card(selW), mode: sel.mode, onBench: m.bench.includes(selW),
        kurslar: KURSLAR.map(k => { const cost = kursCost(selW, k), rk = rankOf(selW.xp || 0); const lock = !!k.minRank && rk < k.minRank; return { id: k.id, name: k.name, desc: k.desc, min: Math.ceil(k.sure / 60), xp: k.xp, morale: k.morale, cost, can: !lock && S.money >= cost && m.kurs.length < KURS_SLOTS, why: lock ? 'En az ' + RANKS[k.minRank!].name + ' olmalı.' : m.kurs.length >= KURS_SLOTS ? 'Kurs Merkezi dolu.' : 'Biraz daha para lazım.' }; }),
        dest: [
          ...MEKANLAR.filter(x => x.open).map(x => ({ id: x.id, name: x.name, here: !m.bench.includes(selW), can: m.bench.includes(selW) && roleOpen(S, host(), selW.role), why: m.bench.includes(selW) ? roleWhy(S, host(), selW.role) : 'Zaten burada.' })),
          { id: 'bank', name: BANK_NAME, here: m.bench.includes(selW), can: !m.bench.includes(selW) && m.bench.length < BANK_CAP, why: m.bench.includes(selW) ? 'Zaten bankta.' : BANK_NAME + ' dolu.' },
        ] } : null,
      mekanlar: MEKANLAR.map(x => ({ id: x.id, name: x.name, open: x.open, n: x.open ? S.workers.length : 0, cap: x.open ? cap : x.caps[0], maxCap: x.caps[x.caps.length - 1], when: x.when, role: x.role })),
      bench: m.bench.map(w => ({ ...card(w), canCall: roleOpen(S, host(), w.role), why: roleWhy(S, host(), w.role) })),
      kurs: m.kurs.map(r => ({ ...card(r.w), kursName: (KURSLAR.find(k => k.id === r.kurs) || KURSLAR[0]).name, left: left(r), frac: r.total ? 1 - left(r) / r.total : 1 })),
      events, ayin: m.ayin ? { name: m.ayin.name, look: m.ayin.look, roleLabel: m.ayin.roleLabel, day: m.ayin.day } : null, ayinNext: nextAyin, ayinNote: AYIN_NOTE,
      log: m.log.slice(0, 4), merkez: KURS_MERKEZI, bankName: BANK_NAME,
    };
  }
  function view(): CalisanView {
    const S = K.state, m = save();
    const bw = S.workers.find(w => isBday(w, S.day));
    return {
      ayin: m.ayin ? { name: m.ayin.name, look: m.ayin.look, roleLabel: m.ayin.roleLabel } : null,
      cake: !!bw && m.cakeDay === S.day, cayKosesi: m.cayKosesi,
      bench: m.bench.slice(0, 3).map(w => ({ id: w.id, name: w.name, look: (w as { look?: unknown }).look ?? null })), kursN: m.kurs.length,
    };
  }
  const api: CalisanApi = { handle, summary, view };
  (rt as unknown as { calisan: CalisanApi }).calisan = api;
  K.addStateView(() => { const m = save(); return { calisan: { bench: m.bench.length, kurs: m.kurs.length, ayin: m.ayin ? m.ayin.name : null, cay: m.cayKosesi } }; });
  return api;
}

export function calisanApi(r: { rt: unknown } | null | undefined): CalisanApi | null { return r ? ((r.rt as { calisan?: CalisanApi }).calisan) || null : null; }
export function calisanSummary(r: { rt: unknown }): Record<string, any> | null { const a = calisanApi(r); return a ? a.summary() : null; }
