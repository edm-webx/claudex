/**
 * Maç günü + halı saha (user 2026-10-24): every week one parody club's fans flood the pier (more customers, mostly
 * taraftar), and in the afternoon a fan offers Sabri a halı saha match. Accepting pauses the büfe and opens the
 * playable match (ui/hali-saha.ts); the result comes back as a command and pays a small reward.
 * Parody teams only (content/traits.ts TEAMS), never real club names. Cosmetic-light economy: small money, Altın Simit.
 * State: S.zones.halisaha = { offerDay, played, won, drawn, lost, goals, conceded, form, team, players (by name, kept for old saves),
 *   oyuncu (by shirt number), sezon, rakip, rekor, son (çetele), izlenen, bekleyen + bahis (pending bet), tuz (bet salt), bahisGun/bahisN, bahisKazanc }.
 * Commands: { kind: 'halisaha', op: 'kabul' | 'red' | 'sonuc', biz?, onlar? } and op 'teklif' (debug: offer now).
 */
import type { Kernel } from './state';
import { TEAMS } from '../../content/traits';
import { LIG_BY_ID, gucSkill, kulupGuc } from '../../content/lig';
import { stadSave, tahminDoluluk, kapiGeliri, FIYAT_VARSAYILAN, KADRO, RAKIP_KADRO, kadroNo } from './stadyum';
import { createMatch, FORMATIONS, rng } from './macmotor';

export const MAC_GUNU_EVERY = 7;          // one fan day a game week
export const MAC_GUNU_OFFSET = 3;          // day 3, 10, 17, ...
export const TEKLIF_SAAT = 15;             // the offer comes in the afternoon
/** The one place of match prizes. anlik = ticket match (no club), kulup = own club's league match. The owner still has to pick between these and 15k/5k/2k. */
export const ODUL = { anlik: { win: 1500, draw: 600, loss: 250, goldWin: 1, goldDraw: 0 }, kulup: { win: 6000, draw: 2000, loss: 600, goldWin: 2, goldDraw: 0 } } as const;
export const MAC_ODUL = ODUL.anlik, KULUP_ODUL = ODUL.kulup;
/** Spectator betting at the gate ("seyirciler izleyip ufak bahis yapabilir"): stake limits, bets per game day; odds come from the two sides' strength. */
export const BAHIS = { min: 100, max: 5000, halfS: 60, gunluk: 10 };
/**
 * Bet odds model, calibrated on the engine (3000 seeded izleMac runs, refit 2026-11-21): home win ~0.40 at equal strength and +0.6 per skill point of
 * difference, draw ~0.22, away the rest. KASA is the house share: every flat strategy returns about 0.84 per lira (0.88 fits the 3000-run mean, but 400-seed samples scatter by +-0.06, so the extra margin keeps the test stable) staked (tests/sim/bahis-oran.test.ts
 * keeps each of '1', 'X', '2' under 1.0, so an engine change that shifts the real frequencies fails there before it becomes a money printer).
 */
export const BAHIS_MODEL = { ev0: 0.40, egim: 0.6, pD: 0.22, pMin: 0.2, pMax: 0.7, KASA: 0.84 } as const;
/** Max rewarded halı saha matches (ticket or club) per game day: prize money, gold, gate receipts and the match chests stop after this; later ones are friendlies. */
export const ODULLU_MAC_GUNLUK = 2;
/** Rewarded matches still open today (also read by mulk.ts: past the cap the ticket is free, the match is a friendly). */
export function odulluMacKaldi(z0: unknown, day: number): boolean { const z = (z0 || {}) as { odulGun?: number; odulN?: number }; return z.odulGun !== day || (z.odulN || 0) < ODULLU_MAC_GUNLUK; }
export function bahisOran(s0: number, s1: number): Record<'1' | 'X' | '2', number> {
  const M = BAHIS_MODEL, pH = Math.min(M.pMax, Math.max(M.pMin, M.ev0 + (s0 - s1) * M.egim)), pD = M.pD, pA = Math.max(0.12, 1 - pH - pD);
  const o = (p: number) => Math.max(1.05, Math.round(M.KASA / p * 20) / 20);
  return { '1': o(pH), X: o(pD), '2': o(pA) };
}
/** Odds span the panel shows before the bet (strengths are drawn 0.5-0.7 per side when the ticket is bought). */
export const BAHIS_ARALIK = (() => { const a = bahisOran(0.7, 0.5), b = bahisOran(0.5, 0.7); return { ev: [a['1'], b['1']], X: a.X, dep: [b['2'], a['2']] }; })();

/** Odds and the real result of a watched match (seeded, headless, same engine and fixed 1/60 step as the view). */
export function izleMac(seed: number) {
  const R = rng(seed ^ 0x5bd1e995), s0 = 0.5 + R() * 0.2, s1 = 0.5 + R() * 0.2, FK = Object.keys(FORMATIONS);
  const f: [string, string] = [FK[Math.floor(R() * FK.length)], FK[Math.floor(R() * FK.length)]];
  const oran = bahisOran(s0, s1);
  const m = createMatch({ seed, human: null, halfS: BAHIS.halfS, skill: [s0, s1], formations: f });
  for (let i = 0; i < 60 * BAHIS.halfS * 2 + 60 * 60 && !m.over; i++) m.step(1 / 60);
  const [a, b] = m.score; return { s0, s1, f, oran, sonuc: (a > b ? '1' : a === b ? 'X' : '2') as '1' | 'X' | '2', skor: [a, b] as [number, number] };
}

type Say = Record<string, number>;
type Tahmin = '1' | 'X' | '2';
interface Bahis { seed: number; bahis: Tahmin; n: number; oran: number }
interface Save {
  izlenen?: number; bekleyen?: number; odulGun?: number; odulN?: number; bahis?: Bahis; tuz?: number; bahisGun?: number; bahisN?: number; bahisKazanc?: number;
  offerDay: number; played: number; won: number; drawn: number; lost: number; goals: number; conceded?: number; form?: string[]; team?: Say;
  players?: Record<string, Say>; oyuncu?: Record<string, Say>; sezon?: Record<string, Say>; rakip?: Record<string, Say & { ad?: unknown }>; rekor?: Say; son?: Record<string, unknown>;
}
const N = (v: unknown, max = 99999) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : 0; };
const clean = (v: unknown, n: number) => String(v ?? '').replace(/[<>]/g, '').slice(0, n);
const TEAM_KEYS = ['shots', 'onTarget', 'passes', 'passesOk', 'tackles', 'saves', 'corners', 'possession'] as const;
const PL_KEYS = ['goals', 'assists', 'shots', 'onTarget', 'passes', 'passesOk', 'tackles', 'saves', 'touches'] as const;
const SEZON_SAKLA = 10;
/** Season index of a game day (same grid as lig.ts: match days every 7 days from day 3, 5 rounds a season). */
const sezonOfDay = (day: number) => Math.max(0, Math.floor(Math.floor((day - MAC_GUNU_OFFSET) / MAC_GUNU_EVERY) / 5));
const mac3 = (r: Say | undefined, biz: number, onlar: number): Say => { const a = r || {}, k = biz > onlar ? 'g' : biz === onlar ? 'b' : 'm'; a.o = (a.o || 0) + 1; a.ag = (a.ag || 0) + biz; a.yg = (a.yg || 0) + onlar; a[k] = (a[k] || 0) + 1; return a; };

/** Old saves keyed the player ledger by name: copy it to the shirt-number key once (the name key stays as a mirror for older readers). */
function oyuncuDefteri(z: Save): Record<string, Say> {
  if (z.oyuncu) return z.oyuncu;
  const o: Record<string, Say> = (z.oyuncu = {});
  for (const [ad, r] of Object.entries(z.players || {})) { const no = kadroNo(ad); if (no) o[no] = { ...r }; }
  return o;
}
export interface CeteleCtx { sezon?: number; rakip?: string; rakipAd?: string; kapi?: number; gun?: number }
/** Fold one match's stats ({takim:[ours,theirs], oyuncu:[...]} from the match view) into the career ledger (çetele). Untrusted input, so clamped. */
export function recordStats(z: Save, ist: unknown, biz: number, onlar: number, ctx: CeteleCtx = {}) {
  z.conceded = (z.conceded || 0) + onlar; z.form = [...(z.form || []), biz > onlar ? 'G' : biz === onlar ? 'B' : 'M'].slice(-5);
  const rk = (z.rekor ||= {}); if (biz > onlar && biz - onlar > (rk.fark || 0)) { rk.fark = biz - onlar; rk.farkB = biz; rk.farkO = onlar; }
  rk.gol = Math.max(rk.gol || 0, biz); rk.cur = biz > onlar ? (rk.cur || 0) + 1 : 0; rk.seri = Math.max(rk.seri || 0, rk.cur);
  const sz = (z.sezon ||= {}), sk = String(ctx.sezon ?? 0); sz[sk] = mac3(sz[sk], biz, onlar);
  for (const k of Object.keys(sz).sort((a, b) => Number(a) - Number(b)).slice(0, -SEZON_SAKLA)) delete sz[k];
  if (ctx.rakip) { const ra = (z.rakip ||= {}), id = clean(ctx.rakip, 24); ra[id] = Object.assign(mac3(ra[id], biz, onlar), { ad: clean(ctx.rakipAd || id, 24) }) as never; }
  z.son = { biz, onlar, rakip: clean(ctx.rakipAd || ctx.rakip, 24), kapi: N(ctx.kapi, 1e7), gun: N(ctx.gun, 1e6) };
  const o = ist as { takim?: Record<string, unknown>[]; oyuncu?: Record<string, unknown>[] } | undefined; if (!o || !Array.isArray(o.takim) || !Array.isArray(o.oyuncu)) return;
  const t = (z.team ||= {}), a = o.takim[0] || {}; for (const k of TEAM_KEYS) t[k] = (t[k] || 0) + N(a[k], 200); t.possSum = (t.possSum || 0) + N(a.possession, 100);
  const P = (z.players ||= {}), D = oyuncuDefteri(z);
  for (const q of o.oyuncu.slice(0, 8)) {
    const ad = clean(q.ad, 20); if (!ad) continue;
    const r = (P[ad] ||= { oyun: 0 }); r.oyun++; for (const k of PL_KEYS) r[k] = (r[k] || 0) + N(q[k], 200);
    const no = kadroNo(ad); if (!no) continue;   // only the fixed squad has a shirt number to key by
    const d = (D[no] ||= { oyun: 0 }); d.oyun++; for (const k of PL_KEYS) d[k] = (d[k] || 0) + N(q[k], 200);
  }
}
/** View model of the ledger for the coordinator's Çetele page (null before the first match). */
export function ceteleOf(z0: unknown) {
  const z = z0 as Save | null; if (!z || !z.played) return null;
  const D = oyuncuDefteri(z), t = z.team || {}, sat = (r: Say) => ({ o: r.o || 0, g: r.g || 0, b: r.b || 0, m: r.m || 0, ag: r.ag || 0, yg: r.yg || 0 });
  return {
    oyun: z.played, g: z.won, b: z.drawn, m: z.lost, gol: z.goals, yenilen: z.conceded || 0, form: [...(z.form || [])],
    takim: { sut: t.shots || 0, isabet: t.onTarget || 0, pas: t.passes || 0, pasIsabet: t.passesOk || 0, top: t.tackles || 0, kurtaris: t.saves || 0, korner: t.corners || 0, sahiplik: Math.round((t.possSum || 0) / z.played) },
    oyuncu: KADRO.map(k => { const r = D[k.no] || {}; return { no: k.no, ad: k.ad, oyun: r.oyun || 0, gol: r.goals || 0, asist: r.assists || 0, kurtaris: r.saves || 0, sut: r.shots || 0 }; }),
    sezon: Object.entries(z.sezon || {}).map(([s, r]) => ({ sezon: Number(s) + 1, ...sat(r) })).sort((a, b) => b.sezon - a.sezon),
    rakip: Object.entries(z.rakip || {}).map(([id, r]) => ({ id, ad: String(r.ad || id), ...sat(r) })).sort((a, b) => b.o - a.o).slice(0, 6),
    rekor: { fark: z.rekor?.fark ? [z.rekor.farkB, z.rekor.farkO] as [number, number] : null, seri: z.rekor?.seri || 0, gol: z.rekor?.gol || 0 },
    son: (z.son as { biz: number; onlar: number; rakip: string; kapi: number } | undefined) || null,
  };
}
export interface MacGunu { team: string; name: string; colors: [string, string]; rival: string; rivalName: string; rivalColors: [string, string]; ligG?: number; doluluk?: number; formasyon?: string }

export function isMacGunu(day: number): boolean { return day >= MAC_GUNU_OFFSET && (day - MAC_GUNU_OFFSET) % MAC_GUNU_EVERY === 0; }
export function macGunuOf(day: number): MacGunu {
  const w = Math.floor((day - MAC_GUNU_OFFSET) / MAC_GUNU_EVERY), a = TEAMS[((w % TEAMS.length) + TEAMS.length) % TEAMS.length], b = TEAMS[(w + 2) % TEAMS.length];
  return { team: a.id, name: a.name, colors: a.colors, rival: b.id, rivalName: b.name, rivalColors: b.colors };
}

const hashId = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/**
 * Everything the match view needs to build createMatch(): pure, from the save and the offer. Own strength grows with the club's ledger (kulupGuc),
 * the rival's comes from its league strength; plan is the tactic name per side for the engine's MatchOpts.plan ('pres' | 'dengeli' | 'kontra').
 */
export function macAyari(S: { zones: Record<string, unknown> }, t: Pick<MacGunu, 'rival' | 'colors' | 'rivalColors'>) {
  const ar = S.zones.arsa as { takim?: unknown; stad?: { formasyon?: string } } | undefined, h = S.zones.halisaha as Save | undefined, FK = Object.keys(FORMATIONS);
  const own = kulupGuc(h?.played || 0, h?.won || 0), rakipGuc = LIG_BY_ID[t.rival]?.guc ?? 55;
  const fo = ar?.stad?.formasyon || '', f0 = ar?.takim && FORMATIONS[fo] ? fo : '2-2', f1 = FK[hashId(t.rival) % FK.length];
  const plan = (g: number) => (g >= 60 ? 'pres' : g <= 46 ? 'kontra' : 'dengeli');
  return {
    skill: [gucSkill(own), gucSkill(rakipGuc)] as [number, number], formations: [f0, f1] as [string, string],
    names: [KADRO.map(k => k.ad), [...RAKIP_KADRO]] as [string[], string[]], colors: [t.colors, t.rivalColors] as [[string, string], [string, string]], plan: [plan(own), plan(rakipGuc)] as [string, string],
  };
}

type LigIf = { mac(day: number): (MacGunu & { ligG: number }) | null; siradaki?(day: number): (MacGunu & { ligG: number }) | null; sonuc(g: number, biz: number, onlar: number): boolean };
type Izle = { sonuc: Tahmin; skor: [number, number]; bahis: Tahmin | null; n: number; oran: number; ad: [string, string] };
type RtX = { _izle?: Izle; macGunu?: MacGunu | null };

export function installHaliSaha(K: Kernel, lig?: LigIf) {
  const S = K.state, rt = K.rt, odul = (v: number) => (K.earnTam ? K.earnTam(v) : K.earn(v));
  const save = (): Save => {
    const z = (S.zones.halisaha ||= {}) as unknown as Save;
    for (const k of ['offerDay', 'played', 'won', 'drawn', 'lost', 'goals'] as const) if (!Number.isFinite(z[k])) z[k] = 0;
    return z;
  };
  let announced = -1;
  const izleRng = K.rng('sim.izle');   // the watched match's seed is drawn when the ticket is bought, mixed with the save's salt: it cannot be precomputed
  const R = rt as unknown as RtX;
  const kulupVar = () => !!(S.zones.arsa as { takim?: unknown } | undefined)?.takim;
  /** True while today's rewarded-match allowance (ODULLU_MAC_GUNLUK) is not used up. */
  const odulHakki = (z: Save) => odulluMacKaldi(z, S.day);
  const lockClear = () => { if (rt.pauseWhy === 'halisaha') { rt.paused = false; rt.pauseWhy = ''; } };

  /** Pay or burn a settled bet; shared by the live result and by the load-time settlement of a bet whose match never finished on screen. */
  function bahisCoz(z: Save, b: { bahis: Tahmin | null; n: number; oran: number }, sonuc: Tahmin, skor: string, ozel = '') {
    if (b.bahis && b.bahis === sonuc) { const kaz = Math.round(b.n * b.oran); odul(kaz); z.bahisKazanc = (z.bahisKazanc || 0) + kaz - b.n; K.toast(ozel + '🎉 Bahsi tutturdun (' + skor + ')! Ödeme ' + kaz.toLocaleString('tr') + ' ₺ (net +' + (kaz - b.n).toLocaleString('tr') + ' ₺)', 'good'); }
    else if (b.bahis) { z.bahisKazanc = (z.bahisKazanc || 0) - b.n; K.toast(ozel + 'Bahis yattı: maç ' + skor + ' bitti. Haftaya!', 'info'); }
    else K.toast('Maç ' + skor + ' bitti. Güzel maçtı!', 'info');
  }

  /** The one match-closing flow: validate, ledger, gate receipts, prize, league record and the toast all happen here, once per offer. */
  function maciKapat(t: MacGunu, c: { biz?: unknown; onlar?: unknown; ist?: unknown }): boolean {
    const z = save(), biz = Math.min(30, Math.max(0, Math.round(Number(c.biz) || 0))), onlar = Math.min(30, Math.max(0, Math.round(Number(c.onlar) || 0)));
    delete rt.uiLast.haliSahaMac; lockClear();
    const kulup = kulupVar() && t.ligG != null;   // the founded club's own league match
    if (kulup && !(lig && lig.sonuc(t.ligG!, biz, onlar))) { K.toast('Bu lig maçı zaten kayıtlı: ikinci kez ödül ve puan yok.', 'info'); K.saveNow(); return true; }
    const odullu = odulHakki(z); if (odullu) { z.odulN = (z.odulGun === S.day ? z.odulN || 0 : 0) + 1; z.odulGun = S.day; }
    const st = kulup && odullu ? stadSave(S.zones.arsa as never) : null, ode = kulup ? ODUL.kulup : ODUL.anlik, kapi = st ? kapiGeliri(t.doluluk ?? tahminDoluluk(st.fiyat, z.form || [], LIG_BY_ID[t.rival]?.guc || 55), st.fiyat) : 0;
    z.played++; z.goals += biz; recordStats(z, c.ist, biz, onlar, { sezon: kulup ? Math.floor(t.ligG! / 5) : sezonOfDay(S.day), rakip: t.rival, rakipAd: t.rivalName, kapi, gun: S.day });
    if (st) {   // gate receipts: the fill was fixed when the match was offered (before kick-off), the cash comes in now
      const dol = t.doluluk ?? tahminDoluluk(st.fiyat, [], LIG_BY_ID[t.rival]?.guc || 55);
      st.doluluk = dol; st.son = kapi; st.gelir += kapi; st.maclar++; odul(kapi); K.toast('🎟️ Kapı geliri: ' + kapi.toLocaleString('tr') + ' ₺ (doluluk %' + Math.round(dol * 100) + ')', 'good');
    }
    const sonuc = biz > onlar ? 'win' : biz === onlar ? 'draw' : 'loss';
    if (sonuc === 'win') z.won++; else if (sonuc === 'draw') z.drawn++; else z.lost++;
    if (!odullu) {   // past the daily cap: a friendly, ledger only (no prize, gold, gate, match chests)
      K.toast('🤝 Dostluk maçı ' + biz + '-' + onlar + (kulup ? ' · Lig: +' + (sonuc === 'win' ? 3 : sonuc === 'draw' ? 1 : 0) + ' puan' : '') + '. Bugünkü ' + ODULLU_MAC_GUNLUK + ' ödüllü maç hakkın dolmuştu, ödül yarın.', 'info');
      K.logEv('haliSaha', { op: 'sonuc', biz, onlar, dostluk: true }); K.saveNow(); return true;
    }
    K.stat('macOyun'); if (biz > onlar) K.stat('macGalibiyet');
    odul(ode[sonuc]); if (sonuc === 'win') S.gold += ode.goldWin; else if (sonuc === 'draw') S.gold += ode.goldDraw;
    const para = ode[sonuc].toLocaleString('tr') + ' ₺';
    if (kulup) K.toast((sonuc === 'win' ? '🏆 ' + t.name + ' kazandı ' : sonuc === 'draw' ? '🤝 Berabere ' : '😤 Kaybettik ') + biz + '-' + onlar + ' · Lig: +' + (sonuc === 'win' ? 3 : sonuc === 'draw' ? 1 : 0) + ' puan · +' + para, biz >= onlar ? 'good' : 'info');
    else if (sonuc === 'win') K.toast('Maçı kazandın ' + biz + '-' + onlar + '! Taraftar seni omuzlarda taşıdı.', 'good');
    else if (sonuc === 'draw') K.toast('Berabere ' + biz + '-' + onlar + '. Çaylar senden!', 'info');
    else K.toast('Kaybettin ' + biz + '-' + onlar + '. Olsun, döner herkese iyi geldi.', 'info');
    K.logEv('haliSaha', { op: 'sonuc', biz, onlar }); K.saveNow();
    return true;
  }

  return {
    update(): void {
      if (!rt.started) return;
      const zb = save();
      const calisiyor = !!R._izle || !!rt.uiLast.haliSahaIzle;
      if (zb.bekleyen && !calisiyor) {   // the page was reloaded mid-match: the seeded result is settled now (no refund trick), a broken record is refunded
        const b = zb.bahis, ok = !!b && Number.isFinite(b.seed) && (b.bahis === '1' || b.bahis === 'X' || b.bahis === '2') && b.n === zb.bekleyen;
        if (ok) { const r = izleMac(b!.seed); bahisCoz(zb, b!, r.sonuc, r.skor[0] + '-' + r.skor[1], 'Maç yarıda kaldı, sonuç yazıldı. '); }
        else { K.cashIn!(zb.bekleyen); K.toast('Maç yarıda kaldı: bahis ' + zb.bekleyen.toLocaleString('tr') + ' ₺ iade edildi.', 'info'); }
        zb.bekleyen = 0; delete zb.bahis;
      }
      if (rt.pauseWhy === 'halisaha' && !calisiyor && !rt.uiLast.haliSahaMac) lockClear();   // an unfinished match never keeps the game locked
      const fan = isMacGunu(S.day);
      R.macGunu = fan ? macGunuOf(S.day) : null;
      if (!fan) return;
      const mg = (lig?.mac(S.day) || R.macGunu!) as MacGunu;
      R.macGunu = mg;
      if (announced !== S.day && K.hour() >= 9) { announced = S.day; K.toast('Maç günü! ' + mg.name + ' taraftarları iskeleye akın etti.', 'good'); K.logEv('macGunu', { team: mg.team }); }
      const z = save();
      if (z.offerDay !== S.day && K.hour() >= TEKLIF_SAAT && !rt.paused && !rt.uiLast.haliSahaTeklif && !rt.uiLast.haliSahaMac) {
        z.offerDay = S.day;
        rt.uiLast.haliSahaTeklif = { ...mg };
      }
    },
    run(c: { op: string; biz?: unknown; onlar?: unknown; ist?: unknown; bahis?: unknown; n?: unknown }): boolean {
      const z = save();
      if (c.op === 'teklif') {
        const kl = kulupVar() && odulHakki(z) ? lig?.siradaki?.(S.day) : null;   // past the daily cap the club plays a friendly, not the next league round
        const mg = kl || macGunuOf(Math.max(MAC_GUNU_OFFSET, S.day)); rt.uiLast.haliSahaTeklif = { ...mg }; return true;
      }
      if (c.op === 'izle') {   // spectator ticket + bet: the result is fixed here by the seeded engine, the view only replays it
        const bahis = (['1', 'X', '2'] as const).find(x => x === c.bahis) || null, n = bahis ? Math.max(BAHIS.min, Math.min(BAHIS.max, N(c.n))) : 0;
        if (rt.uiLast.haliSahaIzle || rt.uiLast.haliSahaMac) return false;
        if (n > S.money) { K.toast('Bahis için para yetmiyor.', 'bad'); return false; }
        if (n && z.bahisGun === S.day && (z.bahisN || 0) >= BAHIS.gunluk) { K.toast('Bugünlük bahis hakkın bitti (' + BAHIS.gunluk + '). Yarın yine gel!', 'info'); return false; }
        z.tuz ??= Math.floor(izleRng.next() * 0x7fffffff);   // salt lives in the save; the seed shown to the view is mixed with it and with a fresh draw
        const seed = ((Math.floor(izleRng.next() * 0x7fffffff) ^ z.tuz ^ Math.imul((z.izlenen || 0) + 1, 0x9e3779b1)) & 0x7fffffff) | 1, im = izleMac(seed), tm = macGunuOf(Math.max(MAC_GUNU_OFFSET, S.day) + 7 * ((z.izlenen || 0) + 1));
        if (n) { K.spend(n); z.bekleyen = n; z.bahis = { seed, bahis: bahis!, n, oran: im.oran[bahis!] }; z.bahisN = (z.bahisGun === S.day ? z.bahisN || 0 : 0) + 1; z.bahisGun = S.day; }   // persisted until the result is settled
        z.izlenen = (z.izlenen || 0) + 1;
        rt.uiLast.haliSahaIzle = { ...tm, seed, s0: im.s0, s1: im.s1, f: im.f, oran: im.oran, bahis, n, halfS: BAHIS.halfS };
        R._izle = { sonuc: im.sonuc, skor: im.skor, bahis, n, oran: bahis ? im.oran[bahis] : 0, ad: [tm.name, tm.rivalName] };
        rt.paused = true; rt.pauseWhy = 'halisaha'; K.logEv('haliSaha', { op: 'izle', bahis, n });
        if (n) K.saveNow();   // the stake, the pending bet and the advanced seed stream are on disk before the match is shown: a reload settles it, never refunds it
        return true;
      }
      if (c.op === 'izleSonuc') {
        const iz = R._izle;
        delete rt.uiLast.haliSahaIzle; lockClear();
        z.bekleyen = 0; delete z.bahis;
        if (!iz) return false; delete R._izle;
        bahisCoz(z, iz, iz.sonuc, iz.skor[0] + '-' + iz.skor[1]);
        K.logEv('haliSaha', { op: 'izleSonuc', skor: iz.skor.join('-'), bahis: iz.bahis, sonuc: iz.sonuc }); K.saveNow();
        return true;
      }
      if (c.op === 'red') { delete rt.uiLast.haliSahaTeklif; K.toast('"Peki abi, haftaya!" Taraftar omuz silkti.', 'info'); return true; }
      if (c.op === 'kabul') {
        const t = rt.uiLast.haliSahaTeklif as MacGunu | undefined; if (!t) return false;
        delete rt.uiLast.haliSahaTeklif;
        const club = kulupVar(), st = club ? stadSave(S.zones.arsa as never) : null;   // the gate is sold BEFORE kick-off: fill uses the form going in and the rival's real strength
        rt.uiLast.haliSahaMac = { ...t, doluluk: tahminDoluluk(st ? st.fiyat : FIYAT_VARSAYILAN, z.form || [], LIG_BY_ID[t.rival]?.guc || 55), formasyon: st ? st.formasyon : '2-2', ayar: macAyari(S, t) }; rt.paused = true; rt.pauseWhy = 'halisaha';
        K.logEv('haliSaha', { op: 'kabul', team: t.team });
        return true;
      }
      if (c.op === 'sonuc') {
        const t = rt.uiLast.haliSahaMac as MacGunu | undefined; if (!t) return false;
        return maciKapat(t, c);
      }
      return false;
    },
  };
}
