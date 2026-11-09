/**
 * Maç günü + halı saha (user 2026-10-24): every week one parody club's fans flood the pier (more customers, mostly
 * taraftar), and in the afternoon a fan offers Sabri a halı saha match. Accepting pauses the büfe and opens the
 * playable match (ui/hali-saha.ts); the result comes back as a command and pays a small reward.
 * Parody teams only (content/traits.ts TEAMS), never real club names. Cosmetic-light economy: small money, Altın Simit.
 * State: S.zones.halisaha = { offerDay, played, won, drawn, lost, goals }.
 * Commands: { kind: 'halisaha', op: 'kabul' | 'red' | 'sonuc', biz?, onlar? } and op 'teklif' (debug: offer now).
 */
import type { Kernel } from './state';
import { TEAMS } from '../../content/traits';
import { stadSave, tahminDoluluk, kapiGeliri } from './stadyum';
import { createMatch, FORMATIONS, rng } from './macmotor';

export const MAC_GUNU_EVERY = 7;          // one fan day a game week
export const MAC_GUNU_OFFSET = 3;          // day 3, 10, 17, ...
export const TEKLIF_SAAT = 15;             // the offer comes in the afternoon
export const MAC_ODUL = { win: 1500, draw: 600, loss: 250, goldWin: 1, goldDraw: 0 };
/** 2026-11-08 user: "kulüp kurduysam o kulüp adıyla oynarım, puanı yükselir, maç kazanılırsa para kazanılır". Own-club league match prize. */
export const KULUP_ODUL = { win: 6000, draw: 2000, loss: 600, goldWin: 2 };
/** Spectator betting at the gate ("seyirciler izleyip ufak bahis yapabilir"): stake limits; odds come from the two sides' strength. */
export const BAHIS = { min: 100, max: 5000, halfS: 60 };

/** Odds and the real result of a watched match (seeded, headless, same engine and fixed 1/60 step as the view). */
export function izleMac(seed: number) {
  const R = rng(seed ^ 0x5bd1e995), s0 = 0.5 + R() * 0.2, s1 = 0.5 + R() * 0.2, FK = Object.keys(FORMATIONS);
  const f: [string, string] = [FK[Math.floor(R() * FK.length)], FK[Math.floor(R() * FK.length)]];
  const pH = Math.min(0.68, Math.max(0.18, 0.4 + (s0 - s1) * 2.2)), pD = 0.22, pA = Math.max(0.12, 1 - pH - pD);
  const o = (p: number) => Math.round(0.9 / p * 20) / 20;
  const oran = { '1': o(pH), X: o(pD), '2': o(pA) } as Record<'1' | 'X' | '2', number>;
  const m = createMatch({ seed, human: null, halfS: BAHIS.halfS, skill: [s0, s1], formations: f });
  for (let i = 0; i < 60 * BAHIS.halfS * 2 + 60 * 60 && !m.over; i++) m.step(1 / 60);
  const [a, b] = m.score; return { s0, s1, f, oran, sonuc: (a > b ? '1' : a === b ? 'X' : '2') as '1' | 'X' | '2', skor: [a, b] as [number, number] };
}

interface Save { izlenen?: number; bahisKazanc?: number; offerDay: number; played: number; won: number; drawn: number; lost: number; goals: number; conceded?: number; form?: string[]; team?: Record<string, number>; players?: Record<string, Record<string, number>> }
const N = (v: unknown, max = 99999) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : 0; };
const TEAM_KEYS = ['shots', 'onTarget', 'passes', 'passesOk', 'tackles', 'saves', 'corners', 'possession'] as const;
const PL_KEYS = ['goals', 'assists', 'shots', 'onTarget', 'passes', 'passesOk', 'tackles', 'saves', 'touches'] as const;
/** Fold one match's stats ({takim:[ours,theirs], oyuncu:[...]} from the match view) into the career ledger (çetele). Untrusted input, so clamped. */
export function recordStats(z: Save, ist: unknown, biz: number, onlar: number) {
  z.conceded = (z.conceded || 0) + onlar; z.form = [...(z.form || []), biz > onlar ? 'G' : biz === onlar ? 'B' : 'M'].slice(-5);
  const o = ist as { takim?: Record<string, unknown>[]; oyuncu?: Record<string, unknown>[] } | undefined; if (!o || !Array.isArray(o.takim) || !Array.isArray(o.oyuncu)) return;
  const t = (z.team ||= {}), a = o.takim[0] || {}; for (const k of TEAM_KEYS) t[k] = (t[k] || 0) + N(a[k], 200); t.possSum = (t.possSum || 0) + N(a.possession, 100);
  const P = (z.players ||= {}); for (const q of o.oyuncu.slice(0, 8)) { const ad = String(q.ad || '').replace(/[<>]/g, '').slice(0, 20); if (!ad) continue; const r = (P[ad] ||= { oyun: 0 }); r.oyun++; for (const k of PL_KEYS) r[k] = (r[k] || 0) + N(q[k], 200); }
}
export interface MacGunu { team: string; name: string; colors: [string, string]; rival: string; rivalName: string; rivalColors: [string, string]; ligG?: number }

export function isMacGunu(day: number): boolean { return day >= MAC_GUNU_OFFSET && (day - MAC_GUNU_OFFSET) % MAC_GUNU_EVERY === 0; }
export function macGunuOf(day: number): MacGunu {
  const w = Math.floor((day - MAC_GUNU_OFFSET) / MAC_GUNU_EVERY), a = TEAMS[((w % TEAMS.length) + TEAMS.length) % TEAMS.length], b = TEAMS[(w + 2) % TEAMS.length];
  return { team: a.id, name: a.name, colors: a.colors, rival: b.id, rivalName: b.name, rivalColors: b.colors };
}

export function installHaliSaha(K: Kernel, lig?: { mac(day: number): (MacGunu & { ligG: number }) | null; siradaki?(day: number): (MacGunu & { ligG: number }) | null; sonuc(g: number, biz: number, onlar: number): boolean }) {
  const S = K.state, rt = K.rt, odul = (v: number) => (K.earnTam ? K.earnTam(v) : K.earn(v));
  const save = (): Save => {
    const z = (S.zones.halisaha ||= {}) as unknown as Save;
    for (const k of ['offerDay', 'played', 'won', 'drawn', 'lost', 'goals'] as const) if (!Number.isFinite(z[k])) z[k] = 0;
    return z;
  };
  let announced = -1;
  const R = rt as unknown as { macGunu?: MacGunu | null };
  return {
    update(): void {
      if (!rt.started) return;
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
        const kl = (S.zones.arsa as { takim?: unknown } | undefined)?.takim ? lig?.siradaki?.(S.day) : null;
        const mg = kl || macGunuOf(Math.max(MAC_GUNU_OFFSET, S.day)); rt.uiLast.haliSahaTeklif = { ...mg }; return true;
      }
      if (c.op === 'izle') {   // spectator ticket + bet: the result is fixed here by the seeded engine, the view only replays it
        const bahis = (['1', 'X', '2'] as const).find(x => x === c.bahis) || null, n = bahis ? Math.max(BAHIS.min, Math.min(BAHIS.max, N(c.n))) : 0;
        if (rt.uiLast.haliSahaIzle || rt.uiLast.haliSahaMac) return false;
        if (n > S.money) { K.toast('Bahis için para yetmiyor.', 'bad'); return false; }
        const seed = ((S.day * 7919 + Math.floor(K.hour() * 60) * 31 + (z.izlenen || 0) * 977) >>> 0) | 1, im = izleMac(seed), tm = macGunuOf(Math.max(MAC_GUNU_OFFSET, S.day) + 7 * ((z.izlenen || 0) + 1));
        if (n) K.spend(n);
        z.izlenen = (z.izlenen || 0) + 1;
        rt.uiLast.haliSahaIzle = { ...tm, seed, s0: im.s0, s1: im.s1, f: im.f, oran: im.oran, bahis, n, halfS: BAHIS.halfS };
        (rt as unknown as { _izle?: unknown })._izle = { sonuc: im.sonuc, skor: im.skor, bahis, n, oran: bahis ? im.oran[bahis] : 0, ad: [tm.name, tm.rivalName] };
        rt.paused = true; rt.pauseWhy = 'halisaha'; K.logEv('haliSaha', { op: 'izle', bahis, n });
        return true;
      }
      if (c.op === 'izleSonuc') {
        const iz = (rt as unknown as { _izle?: { sonuc: string; skor: [number, number]; bahis: string | null; n: number; oran: number; ad: [string, string] } })._izle;
        delete rt.uiLast.haliSahaIzle; if (rt.pauseWhy === 'halisaha') { rt.paused = false; rt.pauseWhy = ''; }
        if (!iz) return false; delete (rt as unknown as { _izle?: unknown })._izle;
        const skor = iz.skor[0] + '-' + iz.skor[1];
        if (iz.bahis && iz.bahis === iz.sonuc) { const kaz = Math.round(iz.n * iz.oran); odul(kaz); z.bahisKazanc = (z.bahisKazanc || 0) + kaz - iz.n; K.toast('🎉 Bahsi tutturdun (' + skor + ')! +' + kaz.toLocaleString('tr') + ' ₺', 'good'); }
        else if (iz.bahis) { z.bahisKazanc = (z.bahisKazanc || 0) - iz.n; K.toast('Bahis yattı: maç ' + skor + ' bitti. Haftaya!', 'info'); }
        else K.toast('Maç ' + skor + ' bitti. Güzel maçtı!', 'info');
        K.logEv('haliSaha', { op: 'izleSonuc', skor, bahis: iz.bahis, sonuc: iz.sonuc }); K.saveNow();
        return true;
      }
      if (c.op === 'red') { delete rt.uiLast.haliSahaTeklif; K.toast('"Peki abi, haftaya!" Taraftar omuz silkti.', 'info'); return true; }
      if (c.op === 'kabul') {
        const t = rt.uiLast.haliSahaTeklif as MacGunu | undefined; if (!t) return false;
        delete rt.uiLast.haliSahaTeklif;
        rt.uiLast.haliSahaMac = { ...t, formasyon: ((S.zones.arsa as { takim?: unknown; stad?: { formasyon?: string } } | undefined)?.takim ? stadSave(S.zones.arsa as never).formasyon : '2-2') }; rt.paused = true; rt.pauseWhy = 'halisaha';
        K.logEv('haliSaha', { op: 'kabul', team: t.team });
        return true;
      }
      if (c.op === 'sonuc') {
        const t = rt.uiLast.haliSahaMac as MacGunu | undefined; if (!t) return false;
        const biz = Math.min(30, Math.max(0, Math.round(Number(c.biz) || 0))), onlar = Math.min(30, Math.max(0, Math.round(Number(c.onlar) || 0)));
        delete rt.uiLast.haliSahaMac; if (rt.pauseWhy === 'halisaha') { rt.paused = false; rt.pauseWhy = ''; }
        const ligOk = t.ligG != null && lig ? lig.sonuc(t.ligG, biz, onlar) : false; void ligOk;
        z.played++; z.goals += biz; recordStats(z, c.ist, biz, onlar);
        const ar = S.zones.arsa as { takim?: unknown } | undefined;
        if (ar?.takim && t.ligG != null) {   // gate receipts of the club's own league match
          const st = stadSave(ar as never), dol = tahminDoluluk(st.fiyat, z.form || [], 55), gel = kapiGeliri(dol, st.fiyat);
          st.doluluk = dol; st.son = gel; st.gelir += gel; st.maclar++; odul(gel); K.toast('🎟️ Kapı geliri: ' + gel.toLocaleString('tr') + ' ₺ (doluluk %' + Math.round(dol * 100) + ')', 'good');
        }
        K.stat('macOyun'); if (biz > onlar) K.stat('macGalibiyet');
        if (ar?.takim && t.ligG != null) {   // own club in the league: bigger prize, league points
          const pu = biz > onlar ? 3 : biz === onlar ? 1 : 0;
          if (biz > onlar) z.won++; else if (biz === onlar) z.drawn++; else z.lost++;
          odul(biz > onlar ? KULUP_ODUL.win : biz === onlar ? KULUP_ODUL.draw : KULUP_ODUL.loss); if (biz > onlar) S.gold += KULUP_ODUL.goldWin;
          K.toast((biz > onlar ? '🏆 ' + t.name + ' kazandı ' : biz === onlar ? '🤝 Berabere ' : '😤 Kaybettik ') + biz + '-' + onlar + ' · Lig: +' + pu + ' puan · +' + (biz > onlar ? KULUP_ODUL.win : biz === onlar ? KULUP_ODUL.draw : KULUP_ODUL.loss).toLocaleString('tr') + ' ₺', biz >= onlar ? 'good' : 'info');
        } else if (biz > onlar) { z.won++; odul(MAC_ODUL.win); S.gold += MAC_ODUL.goldWin; K.toast('Maçı kazandın ' + biz + '-' + onlar + '! Taraftar seni omuzlarda taşıdı.', 'good'); }
        else if (biz === onlar) { z.drawn++; odul(MAC_ODUL.draw); S.gold += MAC_ODUL.goldDraw; K.toast('Berabere ' + biz + '-' + onlar + '. Çaylar senden!', 'info'); }
        else { z.lost++; odul(MAC_ODUL.loss); K.toast('Kaybettin ' + biz + '-' + onlar + '. Olsun, döner herkese iyi geldi.', 'info'); }
        K.logEv('haliSaha', { op: 'sonuc', biz, onlar }); K.saveNow();
        return true;
      }
      return false;
    },
  };
}
