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

export const MAC_GUNU_EVERY = 7;          // one fan day a game week
export const MAC_GUNU_OFFSET = 3;          // day 3, 10, 17, ...
export const TEKLIF_SAAT = 15;             // the offer comes in the afternoon
export const MAC_ODUL = { win: 1500, draw: 600, loss: 250, goldWin: 1, goldDraw: 0 };

interface Save { offerDay: number; played: number; won: number; drawn: number; lost: number; goals: number; conceded?: number; form?: string[]; team?: Record<string, number>; players?: Record<string, Record<string, number>> }
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

export function installHaliSaha(K: Kernel, lig?: { mac(day: number): (MacGunu & { ligG: number }) | null; sonuc(g: number, biz: number, onlar: number): boolean }) {
  const S = K.state, rt = K.rt;
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
    run(c: { op: string; biz?: unknown; onlar?: unknown; ist?: unknown }): boolean {
      const z = save();
      if (c.op === 'teklif') { const mg = macGunuOf(Math.max(MAC_GUNU_OFFSET, S.day)); rt.uiLast.haliSahaTeklif = { ...mg }; return true; }
      if (c.op === 'red') { delete rt.uiLast.haliSahaTeklif; K.toast('"Peki abi, haftaya!" Taraftar omuz silkti.', 'info'); return true; }
      if (c.op === 'kabul') {
        const t = rt.uiLast.haliSahaTeklif as MacGunu | undefined; if (!t) return false;
        delete rt.uiLast.haliSahaTeklif;
        rt.uiLast.haliSahaMac = { ...t }; rt.paused = true; rt.pauseWhy = 'halisaha';
        K.logEv('haliSaha', { op: 'kabul', team: t.team });
        return true;
      }
      if (c.op === 'sonuc') {
        const t = rt.uiLast.haliSahaMac as MacGunu | undefined; if (!t) return false;
        const biz = Math.max(0, Math.round(Number(c.biz) || 0)), onlar = Math.max(0, Math.round(Number(c.onlar) || 0));
        delete rt.uiLast.haliSahaMac; if (rt.pauseWhy === 'halisaha') { rt.paused = false; rt.pauseWhy = ''; }
        const ligOk = t.ligG != null && lig ? lig.sonuc(t.ligG, biz, onlar) : false; void ligOk;
        z.played++; z.goals += biz; recordStats(z, c.ist, biz, onlar);
        K.stat('macOyun'); if (biz > onlar) K.stat('macGalibiyet');
        if (biz > onlar) { z.won++; K.earn(MAC_ODUL.win); S.gold += MAC_ODUL.goldWin; K.toast('Maçı kazandın ' + biz + '-' + onlar + '! Taraftar seni omuzlarda taşıdı.', 'good'); }
        else if (biz === onlar) { z.drawn++; K.earn(MAC_ODUL.draw); S.gold += MAC_ODUL.goldDraw; K.toast('Berabere ' + biz + '-' + onlar + '. Çaylar senden!', 'info'); }
        else { z.lost++; K.earn(MAC_ODUL.loss); K.toast('Kaybettin ' + biz + '-' + onlar + '. Olsun, döner herkese iyi geldi.', 'info'); }
        K.logEv('haliSaha', { op: 'sonuc', biz, onlar }); K.saveNow();
        return true;
      }
      return false;
    },
  };
}
