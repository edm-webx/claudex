/**
 * BUF-10 garson bölgeleri (pure, deterministic, no rng). The built tables are split into geographic clusters and each waiter
 * gets one zone; an idle waiter helps a neighbouring zone once its task waited `ADISYON.yardimBekleS` unclaimed, a zone whose
 * waiter is gone is open to everyone at once.
 *
 * Kurallar:
 * - Küme: masalar arası mesafe <= BOLGE.bagM olan masalar aynı kümede (tek bağ). Kanat / salon masaları (BUF-19/20) kendi
 *   kümelerini konumlarından alır: tablo yok, yerleşim neyse bölge o.
 * - Bölge sayısı garson sayısına uyar: az küme varsa en kalabalık küme uzun ekseninden ikiye bölünür, çok küme varsa en
 *   yakın iki küme birleşir. Tek garsonla (ya da hiç) bölge yok: herkes her masaya bakar.
 * - Kimlikler 'b1', 'b2'... küme sırası en küçük masa indeksine göre (aynı yerleşim + aynı garson sayısı = aynı bölgeler).
 * - Atama: elle atanan (bolgeAta) önce; kalan garsonlar boşta kalan bölgelere id sırasıyla, sonra sırayla dağıtılır.
 *   '*' = serbest (bölgesiz, her masa). Atama çalışma anıdır (kayda yazılmaz).
 */
import type { Vec2 } from '../../engine/api';
import { BOLGE } from '../../content/restoran';

export interface Bolge { id: string; masalar: number[]; cx: number; cz: number; komsu: string[] }

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
/** min table-to-table distance between two clusters */
const araMesafe = (A: number[], B: number[], T: Vec2[]) => { let m = Infinity; for (const i of A) for (const j of B) m = Math.min(m, dist(T[i], T[j])); return m; };

/** split the built tables (indices) into `k` geographic zones (k <= 1: one zone with every table) */
export function bolgeleriKur(T: readonly Vec2[], built: readonly number[], k: number): Bolge[] {
  const idx = [...built].sort((a, b) => a - b);
  if (!idx.length) return [];
  const tables = T as Vec2[];
  // single-link clusters
  let ks: number[][] = [];
  for (const i of idx) {
    const near = ks.filter(c => c.some(j => dist(tables[i], tables[j]) <= BOLGE.bagM));
    const merged = [i, ...near.flat()].sort((a, b) => a - b);
    ks = ks.filter(c => !near.includes(c)); ks.push(merged);
  }
  const want = Math.max(1, Math.floor(k));
  if (want <= 1) ks = [idx];
  // too few: split the biggest cluster along its longer axis at the median
  while (ks.length < want) {
    let bi = -1;
    for (let c = 0; c < ks.length; c++) if (ks[c].length >= 2 && (bi < 0 || ks[c].length > ks[bi].length)) bi = c;
    if (bi < 0) break;
    const c = ks[bi], xs = c.map(i => tables[i].x), zs = c.map(i => tables[i].z);
    const ax: 'x' | 'z' = Math.max(...xs) - Math.min(...xs) >= Math.max(...zs) - Math.min(...zs) ? 'x' : 'z';
    const s = [...c].sort((a, b) => tables[a][ax] - tables[b][ax] || a - b), h = Math.ceil(s.length / 2);
    ks.splice(bi, 1, s.slice(0, h).sort((a, b) => a - b), s.slice(h).sort((a, b) => a - b));
  }
  // too many: merge the two closest clusters
  while (ks.length > want) {
    let ba = 0, bb = 1, bd = Infinity;
    for (let a = 0; a < ks.length; a++) for (let b = a + 1; b < ks.length; b++) { const d = araMesafe(ks[a], ks[b], tables); if (d < bd - 1e-9) { bd = d; ba = a; bb = b; } }
    const m = [...ks[ba], ...ks[bb]].sort((x, y) => x - y);
    ks = ks.filter((_, i) => i !== ba && i !== bb); ks.push(m);
  }
  ks.sort((a, b) => a[0] - b[0]);
  const out: Bolge[] = ks.map((c, i) => ({
    id: 'b' + (i + 1), masalar: c, komsu: [],
    cx: c.reduce((s, j) => s + tables[j].x, 0) / c.length, cz: c.reduce((s, j) => s + tables[j].z, 0) / c.length,
  }));
  for (const a of out) {
    let near: Bolge | null = null, nd = Infinity;
    for (const b of out) {
      if (b === a) continue;
      const d = araMesafe(a.masalar, b.masalar, tables);
      if (d <= BOLGE.komsuM) a.komsu.push(b.id);
      if (d < nd - 1e-9) { nd = d; near = b; }
    }
    if (near && !a.komsu.includes(near.id)) a.komsu.push(near.id);   // every zone has at least one neighbour to help
  }
  // 2026-11-23: komşuluk iki yönlü. "En yakın komşu" tek yöne ekleniyordu (b6 -> b2 ama b2 -> b6 değil): b2'nin garsonu boşta dururken
  // b6'nın masası 30 sn+ menü / hesap bekliyordu (aşama botu aşama 10, akış kontrolüyle yük düşünce ortaya çıktı).
  for (const a of out) for (const id of a.komsu) { const b = out.find(o => o.id === id)!; if (!b.komsu.includes(a.id)) b.komsu.push(a.id); }
  for (const a of out) a.komsu.sort();
  return out;
}

/**
 * waiter -> zone id (null = serbest / bölge yok). `elle`: manual picks (wid -> zone id or '*'); an unknown id counts as automatic.
 * With fewer than two waiters nobody has a zone.
 */
export function bolgeAtamasi(garsonlar: readonly number[], bolgeler: readonly Bolge[], elle: ReadonlyMap<number, string>): Map<number, string | null> {
  const out = new Map<number, string | null>();
  const ws = [...garsonlar].sort((a, b) => a - b);
  if (ws.length < 2 || bolgeler.length < 2) { for (const w of ws) out.set(w, null); return out; }
  const ids = bolgeler.map(b => b.id), oto: number[] = [];
  for (const w of ws) {
    const e = elle.get(w);
    if (e === '*') out.set(w, null);
    else if (e && ids.includes(e)) out.set(w, e);
    else oto.push(w);
  }
  const taken = new Set([...out.values()].filter((v): v is string => !!v));
  const free = ids.filter(i => !taken.has(i));
  oto.forEach((w, i) => out.set(w, free.length ? free[i % free.length] : ids[i % ids.length]));
  return out;
}

/**
 * 2026-11-21 (kullanıcı: "garsonlar neden yan yana bekliyor, servis yapmak yerine"): boştaki garson tezgâh yanında dizilmez,
 * bölgesindeki masaların arasında dolaşır. Devriye noktaları: masa çiftlerinin orta noktaları (koridor) ve bölge merkezi;
 * hiçbir masaya `DEVRIYE_MIN` m'den yakın olmayanlar (sandalyeye / masanın içine basmaz). Tek masada masanın dört yanı.
 * Pure + deterministik (aynı masalar = aynı noktalar, aynı sıra).
 */
export const DEVRIYE_MIN = 1.15;
export function devriyeNoktalari(T: readonly Vec2[]): Vec2[] {
  if (!T.length) return [];
  const aday: Vec2[] = [];
  const cx = T.reduce((s, t) => s + t.x, 0) / T.length, cz = T.reduce((s, t) => s + t.z, 0) / T.length;
  aday.push({ x: cx, z: cz });
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    const d = dist(T[i], T[j]); if (d < 2.3 || d > 5.5) continue;
    aday.push({ x: (T[i].x + T[j].x) / 2, z: (T[i].z + T[j].z) / 2 });
  }
  if (T.length <= 2) for (const t of T) for (const [dx, dz] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) aday.push({ x: t.x + dx, z: t.z + dz });
  const out: Vec2[] = [];
  for (const p of aday) {
    if (T.some(t => dist(t, p) < DEVRIYE_MIN)) continue;
    if (out.some(q => dist(q, p) < 1.2)) continue;
    out.push({ x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 });
    if (out.length >= 8) break;
  }
  return out;
}
