/**
 * Boğaz Ligi (Master Directive 2026-10-30): two divisions of six parody clubs, single round-robin per season (5 rounds),
 * one round a game week. Pure data + pure functions, so tables are deterministic and unit-testable.
 * Invented clubs only (no real names). The player's club is KULUP and starts in the lower division.
 */
export interface LigTakim { id: string; ad: string; renk: [string, string]; guc: number }
export const KULUP: LigTakim = { id: 'sabri', ad: "Sabri'nin Büfesi SK", renk: ['#e0533c', '#f2c230'], guc: 0 };
export const LIG_ADI = ['Boğaz Süper Ligi', 'Mahalle Ligi'] as const;
export const SEZON_TUR = 5;
export const AI_TAKIMLAR: LigTakim[] = [
  { id: 'lodosspor', ad: 'Lodosspor', renk: ['#2ec4c4', '#ff8a3d'], guc: 66 },
  { id: 'vapurspor', ad: 'Vapurspor', renk: ['#a990dd', '#b8bec6'], guc: 64 },
  { id: 'poyrazspor', ad: 'Poyrazspor', renk: ['#3a6fb0', '#e8eef5'], guc: 62 },
  { id: 'hamsispor', ad: 'Hamsispor', renk: ['#c9a227', '#2b2b38'], guc: 60 },
  { id: 'martispor', ad: 'Martıspor', renk: ['#f4f4f4', '#3a8fd6'], guc: 58 },
  { id: 'balikspor', ad: 'Balıkspor', renk: ['#1f8a70', '#f2d14a'], guc: 56 },
  { id: 'simitspor', ad: 'Simitspor', renk: ['#d98a2b', '#fff0c8'], guc: 50 },
  { id: 'kedispor', ad: 'Kedispor', renk: ['#f2a2b3', '#3b2a20'], guc: 47 },
  { id: 'cayspor', ad: 'Çayspor', renk: ['#b3261e', '#f5e6c8'], guc: 44 },
  { id: 'donerspor', ad: 'Dönerspor', renk: ['#8a4a2a', '#e8c070'], guc: 42 },
  { id: 'iskelespor', ad: 'İskelespor', renk: ['#5a7a9a', '#d8e4ee'], guc: 40 },
];
export const LIG_BY_ID: Record<string, LigTakim> = Object.fromEntries([KULUP, ...AI_TAKIMLAR].map(t => [t.id, t]));
const ORDER = [KULUP, ...AI_TAKIMLAR].map(t => t.id);
/** division 0 = top six AI clubs, division 1 = the other five plus the player */
export const BASLANGIC: Record<string, 0 | 1> = Object.fromEntries([...AI_TAKIMLAR.map((t, i) => [t.id, i < 6 ? 0 : 1] as const), [KULUP.id, 1] as const]);

export interface Mac { s: number; k: number; b: number; ev: string; dep: string; eg: number; dg: number }
export interface Satir { id: string; o: number; g: number; b: number; m: number; ag: number; yg: number; av: number; p: number }

/** Division members in a fixed order (club list order), so round-robin pairs never depend on insertion order. */
export const uyeler = (bolum: Record<string, number>, b: number): string[] => ORDER.filter(id => bolum[id] === b);

/** Circle method: round k (0-based) pairs of an even-sized list. */
export function eslesme(ids: string[], k: number): [string, string][] {
  const n = ids.length, a = ids.slice(1), r = ((k % (n - 1)) + (n - 1)) % (n - 1);
  const rot = [ids[0], ...a.slice(a.length - r), ...a.slice(0, a.length - r)];
  const out: [string, string][] = [];
  for (let i = 0; i < n / 2; i++) out.push(i % 2 === 0 ? [rot[i], rot[n - 1 - i]] : [rot[n - 1 - i], rot[i]]);
  return out;
}

function hash(s: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}
/** AI vs AI result, a pure function of season, round and the two club ids. */
export function simMac(s: number, k: number, ev: string, dep: string): [number, number] {
  const r = hash(`${s}|${k}|${ev}|${dep}`), ge = (LIG_BY_ID[ev]?.guc || 50) + 4, gd = LIG_BY_ID[dep]?.guc || 50;
  const goals = (g: number, o: number) => { const lam = Math.max(0.4, 1.5 + (g - o) / 40); let n = 0; for (let i = 0; i < 6; i++) if (r() < lam / 6 * 1.0) n++; return n; };
  return [goals(ge, gd), goals(gd, ge)];
}

/** Table: points 3/1/0, then goal difference, goals scored, wins, then club name (deterministic). */
export function tablo(ids: string[], maclar: Mac[]): Satir[] {
  const t: Record<string, Satir> = Object.fromEntries(ids.map(id => [id, { id, o: 0, g: 0, b: 0, m: 0, ag: 0, yg: 0, av: 0, p: 0 }]));
  for (const m of maclar) {
    const a = t[m.ev], b = t[m.dep]; if (!a || !b) continue;
    a.o++; b.o++; a.ag += m.eg; a.yg += m.dg; b.ag += m.dg; b.yg += m.eg;
    if (m.eg > m.dg) { a.g++; b.m++; a.p += 3; } else if (m.eg < m.dg) { b.g++; a.m++; b.p += 3; } else { a.b++; b.b++; a.p++; b.p++; }
  }
  const rows = Object.values(t); for (const r of rows) r.av = r.ag - r.yg;
  return rows.sort((x, y) => y.p - x.p || y.av - x.av || y.ag - x.ag || y.g - x.g || (LIG_BY_ID[x.id]?.ad || x.id).localeCompare(LIG_BY_ID[y.id]?.ad || y.id, 'tr'));
}
