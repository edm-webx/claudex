/**
 * FUT-01: maç kalitesi ölçüm düzeneği (saf, DOM yok, seed'li). Motoru (sim/macmotor.ts) hiç değiştirmeden yalnız durumunu
 * gözler: oyuncu/top konumları, istatistik sayaçları, restart ve olaylar. Aynı seed + aynı bot = birebir aynı metrik.
 * Kullanım: tests/sim/macmotor-kalite.test.ts (24 maçlık hızlı set) ve tools/mac-metrik.mjs (~500 maçlık tam rapor).
 */
import { createMatch, rng, L, WD, M0, M1, type Match, type MatchOpts } from './macmotor';

export type Kisilik = 'saldirgan' | 'pasci' | 'calimci';
export const KISILIKLER: Kisilik[] = ['saldirgan', 'pasci', 'calimci'];
export const FORM_CIFTLERI: [string, string][] = [['2-2', '2-2'], ['1-2-1', '2-1-1'], ['2-1-1', '1-2-1']];
export const BECERILER: [number, number][] = [[0.6, 0.6], [0.68, 0.52], [0.52, 0.68]];

/** Yazılı hedef eşikler (FUT-01). Test bunları sert ya da raporla kipinde kullanır. */
export const ESIK = {
  kaleciKovalama: 0.01, kaleciAlanDisi: 0.01, takilmaSn: 3, jitter: 2, pasIsabet: [0.6, 0.85], sutTakim: [6, 14], golMac: [3, 12], faulMac: [2, 6],
} as const;

export interface MacMetrik {
  seed: number; formations: [string, string]; skill: [number, number]; bot: Kisilik | null; sn: number;
  skor: [number, number]; sut: [number, number]; isabet: [number, number]; xg: [number, number];
  pas: number; pasOk: number; pasUzOrt: number; pasIleri: number; pasGeri: number; pasYan: number; sahip: number;
  /** en uzun: hedefinden >2 m uzakta ama hızı <0.3 m/s kalan topsuz oyuncu (sn) / duvara yapışık (sn) / çizgide takılan taşıyıcı (sn) */
  takilma: number; duvar: number; tasiyiciCizgi: number;
  /** oyuncu başına saniyede yön işareti değişimi */
  jitter: number;
  /** top kaleciden >12 m uzaktayken kalecinin çizgiden >1.6 m çıktığı ya da kale ağzı dışına kaydığı kare oranı */
  kaleciKovalama: number; kaleciAlanDisi: number; kaleciEgim: number;
  yigilma: number; cakisma: number; kapsam: number;
  duranTop: Record<string, number>; faul: number; kart: number; direk: number; kurtaris: number; penalti: number;
  olaylar: string[];
}

/** xG yaklaşığı (ölçüm için; motorun karar xG'sinden bağımsız): mesafe + görünen ağız açısı. */
export function xgBasit(x: number, y: number, team: 0 | 1): number {
  const gx = team === 0 ? L : 0, dx = Math.max(0.1, Math.abs(gx - x)), a0 = Math.atan2(M0 - y, dx), a1 = Math.atan2(M1 - y, dx);
  const ang = Math.abs(a1 - a0), d = Math.hypot(dx, WD / 2 - y);
  return Math.min(0.95, Math.max(0.01, ang * 0.9 * Math.exp(-d / 14)));
}

/**
 * Seed'li "insan botu": m.input + m.act ile oynayan yapay insan (macmotor-oynanis.test.ts bot()'unun genellemesi).
 * saldirgan: kaleye sürer, erken şut, sık müdahale. pasci: baskıda/aralıklarla pas, yakından şut. calimci: baskıda çalım, sonra şut.
 */
export function insanBotu(kisilik: Kisilik, seed: number) {
  const R = rng(seed ^ 0x51ed), sutX = kisilik === 'saldirgan' ? 15 : kisilik === 'pasci' ? 10 : 12;
  let tasima = 0;
  return (m: Match, dt: number) => {
    const p = m.pls[m.ctrl], b = m.ball, team = p.team, dir = team === 0 ? 1 : -1, gx = team === 0 ? L : 0;
    if (b.owner === m.ctrl) {
      tasima += dt;
      const dx = Math.abs(gx - p.x), yy = (WD / 2 - p.y) / 8;
      let opp = 99; for (const q of m.pls) if (q.team !== team && !q.gk) opp = Math.min(opp, Math.hypot(q.x - p.x, q.y - p.y));
      m.input.ix = dir; m.input.iy = yy + (opp < 2.5 ? (R() - 0.5) * 1.2 : 0);
      if (dx < sutX) { m.act('sut', 0.35 + R() * 0.45); tasima = 0; }
      else if (kisilik === 'calimci' && opp < 2 && p.cd2 <= 0) m.act('calim');
      else if (kisilik === 'pasci' && (opp < 2.4 || tasima > 1.2 + R())) { m.act('pas', 0.5, R() < 0.3); tasima = 0; }
      else if (opp < 1.3) { if (p.cd2 <= 0 && R() < 0.5) m.act('calim'); else { m.act('pas'); tasima = 0; } }
    } else {
      tasima = 0;
      const d = Math.hypot(b.x - p.x, b.y - p.y) || 1; m.input.ix = (b.x - p.x) / d; m.input.iy = (b.y - p.y) / d;
      const o = b.owner >= 0 ? m.pls[b.owner] : null;
      if (o && o.team !== team && d < (kisilik === 'saldirgan' ? 1.6 : 1.3) && R() < 0.5) {
        const arkadan = ((p.x - o.x) * o.fx + (p.y - o.y) * o.fy) < -0.35 * Math.hypot(p.x - o.x, p.y - o.y);   // arkadan girmek faul: insan da çoğunlukla kaçınır
        if (!arkadan || R() < (kisilik === 'saldirgan' ? 0.12 : 0.05)) m.act('kap');
      }
    }
  };
}

/** Bir maçın ölçeri: her m.step(dt) sonrasında tick(dt), en sonda bitir(). */
export function olcer(m: Match, meta: { seed: number; formations: [string, string]; skill: [number, number]; bot: Kisilik | null }) {
  const n = m.pls.length;
  const stuck = new Array(n).fill(0), wall = new Array(n).fill(0), sgx = new Array(n).fill(0), sgy = new Array(n).fill(0);
  const heat = m.pls.map(() => new Array(32).fill(0));
  const prevSt = m.pls.map(p => ({ passes: p.st.passes, shots: p.st.shots, tackles: p.st.tackles }));
  let frames = 0, oyunSn = 0, flips = 0, crowd = 0, overlap = 0, gkChase = 0, gkFar = 0, gkOut = 0, gkFrames = 0, carrierLine = 0;
  let takilma = 0, duvar = 0, tasiyiciCizgi = 0, lastRestart: unknown = null, lastScore = m.score[0] + m.score[1];
  let pend: null | { x: number; y: number; team: 0 | 1 } = null, pasN = 0, pasUz = 0, ileri = 0, geri = 0, yan = 0;
  const xg: [number, number] = [0, 0], duranTop: Record<string, number> = {}, olaylar: string[] = [], ev: Record<string, number> = {};
  const gkSum = [0, 0, 0, 0, 0];   // n, Σby, Σgy, Σby², Σby·gy (uzak top, rakip taşırken)
  const bolge = (x: number, team: 0 | 1) => 1 + Math.min(2, Math.floor((team === 0 ? x : L - x) / (L / 3)));

  function tick(dt: number) {
    for (const e of m.events as { k: string }[]) if (e.k !== 'sfx' && e.k !== 'banner' && e.k !== 'shake') ev[e.k] = (ev[e.k] || 0) + 1;
    const r = m.restart as null | { kind: string };
    if (r && r !== lastRestart) { duranTop[r.kind] = (duranTop[r.kind] || 0) + 1; olaylar.push('R' + r.kind[0]); }
    lastRestart = r;
    const sc = m.score[0] + m.score[1]; if (sc !== lastScore) { olaylar.push('G'); lastScore = sc; }
    const b = m.ball;
    m.pls.forEach((p, i) => {
      const ps = prevSt[i];
      if (p.st.passes > ps.passes) { pend = { x: p.x, y: p.y, team: p.team }; olaylar.push('P' + bolge(p.x, p.team)); }
      if (p.st.shots > ps.shots) { xg[p.team] += xgBasit(p.x, p.y, p.team); olaylar.push('S' + bolge(p.x, p.team)); }
      if (p.st.tackles > ps.tackles) olaylar.push('T' + bolge(p.x, p.team));
      ps.passes = p.st.passes; ps.shots = p.st.shots; ps.tackles = p.st.tackles;
    });
    if (pend && b.owner >= 0) {
      const d = Math.hypot(b.x - pend.x, b.y - pend.y), fwd = (b.x - pend.x) * (pend.team === 0 ? 1 : -1) / (d || 1);
      pasN++; pasUz += d; if (fwd > 0.5) ileri++; else if (fwd < -0.5) geri++; else yan++; pend = null;
    }
    if (m.freeze > 0 || m.over) return;
    if (r) { stuck.fill(0); wall.fill(0); return; }
    frames++; oyunSn += dt;
    let near = 0;
    m.pls.forEach((p, i) => {
      const sp = Math.hypot(p.vx, p.vy), carrier = b.owner === i;
      if (!p.gk && Math.hypot(p.x - b.x, p.y - b.y) < 4) near++;
      if (!p.gk && !(meta.bot && i === m.ctrl) && !carrier && p.stun <= 0) {
        stuck[i] = Math.hypot(p.tx - p.x, p.ty - p.y) > 2 && sp < 0.3 ? stuck[i] + dt : 0; takilma = Math.max(takilma, stuck[i]);
      } else stuck[i] = 0;
      const atWall = !p.gk && (p.x < 0.6 || p.x > L - 0.6 || p.y < 0.6 || p.y > WD - 0.6) && sp < 0.8;
      wall[i] = atWall ? wall[i] + dt : 0; duvar = Math.max(duvar, wall[i]);
      const sx = Math.abs(p.vx) > 0.4 ? Math.sign(p.vx) : 0, sy = Math.abs(p.vy) > 0.4 ? Math.sign(p.vy) : 0;
      if (sx && sgx[i] && sx !== sgx[i]) flips++; if (sy && sgy[i] && sy !== sgy[i]) flips++;
      if (sx) sgx[i] = sx; if (sy) sgy[i] = sy;
      heat[i][Math.min(7, Math.floor(p.x / L * 8)) * 4 + Math.min(3, Math.floor(p.y / WD * 4))]++;
      if (p.gk) {
        const og = p.team === 0 ? 0 : L, depth = Math.abs(p.x - og); gkFrames++;
        if (depth > 6 || Math.abs(p.y - WD / 2) > 5) gkOut++;
        if (Math.hypot(b.x - p.x, b.y - p.y) > 12) {
          gkFar++; if (depth > 1.6 || p.y < M0 - 0.1 || p.y > M1 + 0.1) gkChase++;
          if (b.owner >= 0 && m.pls[b.owner].team !== p.team) { gkSum[0]++; gkSum[1] += b.y; gkSum[2] += p.y; gkSum[3] += b.y * b.y; gkSum[4] += b.y * p.y; }
        }
      }
    });
    if (near >= 5) crowd++;
    for (let a = 0; a < n; a++) for (let c = a + 1; c < n; c++) { const A = m.pls[a], B = m.pls[c]; if (A.team === B.team && !A.gk && !B.gk && Math.hypot(A.x - B.x, A.y - B.y) < 1.5) { overlap++; a = n; break; } }
    if (b.owner >= 0) { const o = m.pls[b.owner]; carrierLine = (o.x < 0.5 || o.x > L - 0.5) && Math.hypot(o.vx, o.vy) < 0.8 ? carrierLine + dt : 0; tasiyiciCizgi = Math.max(tasiyiciCizgi, carrierLine); } else carrierLine = 0;
  }

  function bitir(): MacMetrik {
    const t0 = m.teamStats(0), t1 = m.teamStats(1), f = frames || 1, sn = oyunSn || 1;
    const ent = heat.filter((_, i) => !m.pls[i].gk).map(h => { const s = h.reduce((a, b) => a + b, 0) || 1; let e = 0; for (const c of h) if (c) e -= c / s * Math.log(c / s); return e / Math.log(32); });
    const [gn, sb, sg, sbb, sbg] = gkSum, vb = gn ? sbb / gn - (sb / gn) ** 2 : 0;
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    return {
      ...meta, sn: r3(oyunSn), skor: [m.score[0], m.score[1]], sut: [t0.shots, t1.shots], isabet: [t0.onTarget, t1.onTarget], xg: [r3(xg[0]), r3(xg[1])],
      pas: t0.passes + t1.passes, pasOk: t0.passesOk + t1.passesOk, pasUzOrt: r3(pasUz / (pasN || 1)), pasIleri: r3(ileri / (pasN || 1)), pasGeri: r3(geri / (pasN || 1)), pasYan: r3(yan / (pasN || 1)),
      sahip: t0.possession, takilma: r3(takilma), duvar: r3(duvar), tasiyiciCizgi: r3(tasiyiciCizgi), jitter: r3(flips / sn / n),
      kaleciKovalama: r3(gkChase / (gkFar || 1)), kaleciAlanDisi: r3(gkOut / (gkFrames || 1)), kaleciEgim: r3(vb > 0.5 ? (sbg / gn - sb / gn * sg / gn) / vb : 0),
      yigilma: r3(crowd / f), cakisma: r3(overlap / f), kapsam: r3(ent.reduce((a, b) => a + b, 0) / (ent.length || 1)),
      duranTop, faul: ev.foul || 0, kart: ev.card || 0, direk: ev.post || 0, kurtaris: ev.save || 0, penalti: duranTop.penalti || 0, olaylar,
    };
  }
  return { tick, bitir };
}

export interface KosuAyar { seed: number; formations?: [string, string]; skill?: [number, number]; bot?: Kisilik | null; halfS?: number; dt?: number; opts?: Partial<MatchOpts> }

/** Bir maçı baştan sona sabit adımla oynatıp ölçer (varsayılan 1/60, 2 x 75 sn). */
export function macKos(a: KosuAyar): MacMetrik {
  const formations = a.formations ?? ['2-2', '2-2'], skill = a.skill ?? [0.6, 0.6], bot = a.bot ?? null, dt = a.dt ?? 1 / 60, halfS = a.halfS ?? 75;
  const m = createMatch({ seed: a.seed, formations, skill, halfS, human: bot ? 0 : null, humanSlot: 3, ...a.opts });
  const o = olcer(m, { seed: a.seed, formations, skill, bot }), drive = bot ? insanBotu(bot, a.seed) : null;
  for (let i = 0; i < (halfS * 2 + 90) / dt && !m.over; i++) { if (drive) drive(m, dt); m.step(dt); o.tick(dt); }
  return o.bitir();
}

/** Aynı başlama vuruşundan farklı seed'lerde ilk `sn` saniyede topun izlediği yol: ortalama ikili uzaklık (m). Küçük = kalıp. */
export function kalipYolu(seeds: number[], formations: [string, string] = ['2-2', '2-2'], sn = 20, dt = 1 / 60): number {
  const yollar = seeds.map(seed => {
    const m = createMatch({ seed, formations, halfS: 75 }), yol: [number, number][] = []; let t = 0, k = 0;
    for (let i = 0; i < 4000 && yol.length < sn * 2; i++) { m.step(dt); if (m.freeze > 0 && yol.length === 0) continue; t += dt; if (t >= k * 0.5) { yol.push([m.ball.x, m.ball.y]); k++; } }
    return yol;
  });
  let s = 0, c = 0;
  for (let a = 0; a < yollar.length; a++) for (let b = a + 1; b < yollar.length; b++) { const A = yollar[a], B = yollar[b], k = Math.min(A.length, B.length); let d = 0; for (let j = 0; j < k; j++) d += Math.hypot(A[j][0] - B[j][0], A[j][1] - B[j][1]); s += d / (k || 1); c++; }
  return Math.round(s / (c || 1) * 100) / 100;
}

/** Olay dizisi n-gram çeşitliliği: tekil n-gram sayısı ve en sık n-gram'ın payı (büyük pay = hep aynı kalıp). */
export function ngramCesit(diziler: string[][], n = 3) {
  const say = new Map<string, number>(); let top = 0;
  for (const d of diziler) for (let i = 0; i + n <= d.length; i++) { const k = d.slice(i, i + n).join(' '); say.set(k, (say.get(k) || 0) + 1); top++; }
  return { tekil: say.size, enSikPay: top ? Math.round(Math.max(...say.values()) / top * 1000) / 1000 : 0 };
}

const ort = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const yuz = (a: number[], q: number) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };

/** Toplu özet: ortalamalar, en kötü değerler, dağılımlar. */
export function topla(ms: MacMetrik[]) {
  const r = (v: number) => Math.round(v * 1000) / 1000, g = ms.map(x => x.skor[0] + x.skor[1]), sutT = ms.flatMap(x => x.sut);
  const dur: Record<string, number> = {}; for (const x of ms) for (const [k, v] of Object.entries(x.duranTop)) dur[k] = r((dur[k] || 0) + v / ms.length);
  const pas = ms.reduce((s, x) => s + x.pas, 0), ok = ms.reduce((s, x) => s + x.pasOk, 0), sut = sutT.reduce((a, b) => a + b, 0), isa = ms.reduce((s, x) => s + x.isabet[0] + x.isabet[1], 0);
  return {
    mac: ms.length, golOrt: r(ort(g)), golMin: Math.min(...g), golMax: Math.max(...g), golYuzde10: yuz(g, 0.1), golYuzde90: yuz(g, 0.9),
    sutTakimOrt: r(ort(sutT)), isabetOran: r(isa / (sut || 1)), xgTakimOrt: r(ort(ms.flatMap(x => x.xg))), golXgOran: r(ort(g) / (ort(ms.flatMap(x => x.xg)) * 2 || 1)),
    pasIsabet: r(ok / (pas || 1)), pasMacOrt: r(pas / ms.length), pasUzOrt: r(ort(ms.map(x => x.pasUzOrt))), pasIleri: r(ort(ms.map(x => x.pasIleri))), pasGeri: r(ort(ms.map(x => x.pasGeri))), pasYan: r(ort(ms.map(x => x.pasYan))),
    sahipMin: Math.min(...ms.map(x => x.sahip)), sahipMax: Math.max(...ms.map(x => x.sahip)),
    takilmaMax: r(Math.max(...ms.map(x => x.takilma))), takilma3snMac: ms.filter(x => x.takilma > ESIK.takilmaSn).length, duvarMax: r(Math.max(...ms.map(x => x.duvar))), tasiyiciCizgiMax: r(Math.max(...ms.map(x => x.tasiyiciCizgi))),
    jitterOrt: r(ort(ms.map(x => x.jitter))), jitterMax: r(Math.max(...ms.map(x => x.jitter))),
    kaleciKovalamaOrt: r(ort(ms.map(x => x.kaleciKovalama))), kaleciKovalamaMax: r(Math.max(...ms.map(x => x.kaleciKovalama))), kaleciAlanDisiOrt: r(ort(ms.map(x => x.kaleciAlanDisi))), kaleciEgimOrt: r(ort(ms.map(x => x.kaleciEgim))),
    yigilmaOrt: r(ort(ms.map(x => x.yigilma))), cakismaOrt: r(ort(ms.map(x => x.cakisma))), kapsamOrt: r(ort(ms.map(x => x.kapsam))),
    ngram3: ngramCesit(ms.map(x => x.olaylar)).tekil, ngram3EnSik: ngramCesit(ms.map(x => x.olaylar)).enSikPay, ngram4: ngramCesit(ms.map(x => x.olaylar), 4).tekil, skorCesit: new Set(ms.map(x => x.skor.join('-'))).size,
    duranTopMac: dur, faulMac: r(ort(ms.map(x => x.faul))), kartMac: r(ort(ms.map(x => x.kart))), direkMac: r(ort(ms.map(x => x.direk))), penaltiMac: r(ort(ms.map(x => x.penalti))),
  };
}
export type Ozet = ReturnType<typeof topla>;

/** Güç farkı: güçlü (a) vs zayıf (b) N maç, yanlar dengeli dağıtılır. Döner: güçlünün galibiyet/beraberlik/yenilgi oranı. */
export function gucFarki(a: number, b: number, n: number, seed0 = 7, halfS = 75) {
  let w = 0, d = 0, l = 0;
  for (let i = 0; i < n; i++) {
    const sw = i % 2 === 1, f = FORM_CIFTLERI[i % 3], seed = seed0 + i * 7919;
    const m = createMatch({ seed, formations: f, skill: sw ? [b, a] : [a, b], halfS, human: null });
    for (let k = 0; k < (halfS * 2 + 90) * 60 && !m.over; k++) m.step(1 / 60);
    const gs = sw ? m.score[1] : m.score[0], gz = sw ? m.score[0] : m.score[1];
    if (gs > gz) w++; else if (gs === gz) d++; else l++;
  }
  return { n, galibiyet: w / n, beraberlik: d / n, yenilgi: l / n };
}
