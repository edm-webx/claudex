/**
 * DKN-18 iç mekân sakinleri: banka, okul, hastane, acil ve morgda kıpırdamayan insan heykelleri yerine gerçek aktörler.
 * Oyuncu odaya yaklaşınca sakinler doğar, uzaklaşınca kaldırılır (hepsi birden en çok CAP aktör). Koordinatlar oda kapı
 * çerçevesindedir (content/ic-mekan.ts icWorld: u kapı duvarı boyunca, v içeri doğru, kapı v=+D/2).
 * Ekonomiyle ilişkisi yok: para, kasa, sayaç yazmaz. Okul ders saatleri (DKN-08): 09:00 zil, her saat 40 dk ders + 10 dk teneffüs,
 * 12:00-13:00 öğle, 15:00 çıkış; kapalıyken sınıf boş.
 */
import type { System, SimCtx, Vec2 } from '../../../engine/api';
import { IC_BY_ID, icWorld, icDim, type IcMekan } from '../../../content/ic-mekan';
import type { AgentEnv } from './env';
import type { Actor } from './types';

type P = [number, number];
/** p: tek nokta ya da aday listesi (listede boş olan ilk nokta kilitlenir); via: önce uğranacak ara noktalar; sn: bekleme süresi aralığı */
interface Step { p: P | P[]; act?: string; sn?: [number, number]; f?: P; y?: number; say?: string; via?: P[]; kilit?: boolean }
type Ne = (s: Sakin, faz: string) => Step | null;
interface Tanim { id: string; rig: Record<string, unknown>; ad?: string; ne: Ne }
interface Gelen { enCok: number; aralik: [number, number]; acik: (h: number) => boolean; yap(r: { next(): number }, k: number): { rig: Record<string, unknown>; steps: Step[] } }
interface Oda { id: string; kalici: Tanim[]; gelen?: Gelen; faz(h: number): string; acik(faz: string): boolean; giris?: P[] }
interface Sakin { a: Actor; oda: string; durum: 'git' | 'bekle' | 'dur' | 'cik'; ne: Ne; i: number; yol: Vec2[]; bek: number; kilit: P | null; faz: string; st: Step | null; kalici: boolean; id: string }

const CAP = 25, YAKIN = 22, UZAK = 30;
const w = (u: number, v: number): Step => ({ p: [u, v], sn: [0, 0] });
const N: P = [0, -1], S: P = [0, 1], WW: P = [-1, 0];
const dongu = (steps: Step[]): Ne => (s) => steps[s.i++ % steps.length];
const bir = (steps: Step[]): Ne => (s) => steps[s.i++] ?? null;
const worker = (role: string, seed: number, apron?: string) => ({ kind: 'worker', role, seed, look: { lookSeed: seed, ...(apron ? { apronText: apron } : {}) } });
const reg = (lookType: string, seed: number) => ({ kind: 'regular', look: { lookType, lookSeed: seed }, seed });

/* ---------- okul (W=18.3, D=7.5): tahta u -6.7..-2.5, sıralar u=-7.6+1.55c, v=-1.3+1.4r ---------- */
const OKUL_ARA: P[] = [[-2.0, -0.6], [-2.0, 0.9], [-1.2, 2.2], [-1.0, -1.8], [-3.2, -2.3], [-6.4, -2.3], [-7.6, -2.3], [-1.9, 2.8]];
function ogrenci(k: number): Tanim {
  const r = Math.floor(k / 4), c = k % 4, u = -7.6 + c * 1.55 + ((r + c) % 2 ? 0.275 : -0.275), v = -1.3 + r * 1.4 + 0.45, lane = v + 0.45;
  const koltuk: Step = { p: [u, v], act: 'sit', sn: [10, 25], f: N, via: [[-1.9, lane], [u, lane]] };
  const ne: Ne = (s, faz) => {
    const i = s.i++;
    if (faz === 'teneffus') return i % 2 ? { p: OKUL_ARA, act: i % 4 === 1 ? 'talk' : 'idle', sn: [4, 9], via: [[-1.9, lane]] } : { ...koltuk, sn: [1, 1] };
    return i % 4 === 3 ? { ...koltuk, act: 'wave', sn: [3, 3] } : koltuk;
  };
  return { id: 'ogrenci' + k, rig: reg('okul', 300 + k * 17), ne };
}
const OKUL: Oda = {
  id: 'okul', giris: [[0, 2.9], [-1.9, 2.9]],
  faz: (h) => (h < 9 || h >= 15 || (h >= 12 && h < 13) ? 'kapali' : (h % 1) * 60 < 40 ? 'ders' : 'teneffus'), acik: (f) => f !== 'kapali',
  kalici: [
    { id: 'ogretmen', rig: worker('ogretmen', 11), ad: 'Zeynep Öğretmen', ne: (s, faz) => {
      const i = s.i++;
      if (faz === 'teneffus') return i % 2 ? w(-3.0, -2.0) : { p: [-4.6, -1.7], act: 'idle', sn: [5, 9], f: S };
      const ders: Step[] = [{ p: [-6.2, -3.15], act: 'perform', sn: [10, 14], f: S }, w(-2.9, -3.15), { p: [-2.9, -3.15], act: 'perform', sn: [6, 9], f: S }, w(-2.0, -2.2), { p: [-2.0, 0.9], act: 'idle', sn: [5, 8], f: WW }, w(-2.0, -2.2)];
      return ders[i % 6];
    } },
    ...Array.from({ length: 12 }, (_, k) => ogrenci(k)),
  ],
};

/* ---------- banka (W=10, D=8.4): gişe v=-2.5, ortadaki pencere açık, kasa kapısı u=3.6 ---------- */
const BANKA: Oda = {
  id: 'banka', faz: () => 'acik', acik: () => true, giris: [[0, 3.4]],
  kalici: [{ id: 'memur', rig: worker('kasiyer', 41, 'SELİM'), ad: 'Selim', ne: dongu([
    { p: [0, -3.25], act: 'sit', sn: [25, 40], f: S, say: 'Buyurun, sıradaki lütfen.' }, w(2.0, -3.25), { p: [3.4, -3.55], act: 'carry', sn: [6, 6], f: N }, w(2.0, -3.25)]) }],
  gelen: {
    enCok: 3, aralik: [20, 45], acik: (h) => h >= 9 && h < 18,
    yap: (rng, k) => ({
      rig: reg(['plaza', 'emekli', 'teyze'][Math.floor(rng.next() * 3)], 500 + k),
      steps: [w(0, 3.4), { p: [[-0.9, -0.3], [-0.9, 0.5], [-0.9, 1.3]], act: 'idle', sn: [0.5, 1.5], f: N }, { p: [0, -1.5], kilit: true, act: 'idle', sn: [8, 12], f: N, say: 'Merhaba' }, w(-1.5, -0.9), w(-1.5, 3.0)],
    }),
  },
};

/* ---------- hastane (W=16.9, D=6.7): resepsiyon (0,-0.9), ilaç dolabı (0,-3.05), yataklar v=-2.1 ---------- */
const yatakta = (id: string, u: number, v: number, seed: number, look: string): Tanim => ({ id, rig: reg(look, seed), ne: dongu([
  { p: [u, v], act: 'sit', sn: [20, 30], f: S, y: 0.25 }, { p: [u, v], act: 'phone', sn: [8, 12], f: S, y: 0.25 }, { p: [u, v], act: 'sit', sn: [10, 14], f: S, y: 0.25 }]) });
const vizit = (u: number): Step => ({ p: [u, -0.7], act: 'idle', sn: [5, 7], f: N });
const HASTANE: Oda = {
  id: 'hastane', faz: () => 'acik', acik: () => true, giris: [[0, 2.6]],
  kalici: [
    { id: 'hemsire', rig: worker('hemsire', 21), ad: 'Ayşe Hemşire', ne: dongu([
      { p: [0.3, -1.9], act: 'serve', sn: [15, 22], f: S }, w(2.3, -1.9), w(2.3, 0.3), { p: [3.6, -0.7], act: 'idle', sn: [5, 5], f: N }, w(2.3, 0.3), w(2.3, -1.9), { p: [0.9, -2.4], act: 'carry', sn: [6, 6], f: N }]) },
    { id: 'doktor', rig: worker('doktor', 22, 'DR. KEMAL'), ad: 'Dr. Kemal', ne: dongu([
      vizit(-7.2), vizit(-5.4), vizit(-3.6), w(-2.2, 0.2), w(2.2, 0.2), vizit(3.6), vizit(5.4), vizit(7.2), w(5.4, -0.2), w(2.2, 0.2), w(-2.2, 0.2), w(-5.4, -0.2)]) },
    yatakta('yatak1', -5.4, -2.35, 610, 'emekli'), yatakta('yatak2', 3.6, -2.35, 611, 'teyze'), yatakta('yatak3', 7.2, -2.35, 612, 'plaza'),
  ],
  gelen: {
    enCok: 2, aralik: [25, 50], acik: () => true,
    yap: (rng, k) => ({
      rig: reg(['emekli', 'teyze', 'plaza'][Math.floor(rng.next() * 3)], 700 + k),
      steps: [w(0, 2.6), { p: [[-4.6, 2.35], [-2.6, 2.35], [2.6, 2.35], [4.6, 2.35]], act: 'sit', sn: [40, 70], f: N }, w(0, 2.6), { p: [0, 0.2], kilit: true, act: 'idle', sn: [5, 5], f: N }, w(0, 2.6)],
    }),
  },
};

/* ---------- acil / morg (3.3 x 3.2) ---------- */
const ACIL: Oda = {
  id: 'acil', faz: () => 'acik', acik: () => true,
  kalici: [
    yatakta('sedye', -0.3, -1.0, 620, 'emekli'),
    { id: 'saglikci', rig: worker('hemsire', 23), ad: 'Hemşire Elif', ne: dongu([{ p: [0.75, -0.3], act: 'idle', sn: [10, 10], f: WW }, { p: [0.75, 0.9], act: 'serve', sn: [6, 6], f: WW }]) },
  ],
};
const MORG: Oda = {
  id: 'morg', faz: () => 'acik', acik: () => true,
  kalici: [{ id: 'gorevli', rig: worker('gorevli', 31), ad: 'Cemal', ne: dongu([
    { p: [-0.7, 0.2], act: 'idle', sn: [10, 10], f: N }, { p: [-0.7, -0.7], act: 'serve', sn: [6, 6], f: N }, { p: [0, 1.0], act: 'idle', sn: [8, 8], f: [1, 0] }]) }],
};
const ODALAR = [BANKA, OKUL, HASTANE, ACIL, MORG];

export interface SakinRow { oda: string; id: string; x: number; z: number; act: string }
export interface IcSakinSystem extends System { rows(): SakinRow[]; count(): number }

export function createIcSakin(env: AgentEnv): IcSakinSystem {
  const rng = env.rng('icsakin');
  const live: Sakin[] = [], locks = new Map<P, Sakin>(), on = new Set<string>(), tmr: Record<string, number> = {};
  let n = 0;
  const wd = (m: IcMekan, p: P): Vec2 => icWorld(m, p[0], p[1]);
  const doorOut = (m: IcMekan): Vec2 => icWorld(m, 0, icDim(m).D / 2 + 0.9);

  function kur(m: IcMekan, rig: Record<string, unknown>, ne: Ne, kalici: boolean, id: string, at: Vec2, faz: string, ad?: string): Sakin {
    const a = env.reg.add('sakin', `ic-${m.id}-${id}-${n++}`, rig, at, { name: ad ?? '', oda: m.id });
    const s: Sakin = { a, oda: m.id, durum: 'dur', ne, i: 0, yol: [], bek: 0, kilit: null, faz, st: null, kalici, id };
    live.push(s); return s;
  }
  function sil(s: Sakin) { if (s.kilit) locks.delete(s.kilit); env.reg.remove(s.a); live.splice(live.indexOf(s), 1); }
  function cik(s: Sakin, m: IcMekan) {
    if (s.kilit) { locks.delete(s.kilit); s.kilit = null; }
    s.durum = 'cik'; s.yol = [icWorld(m, 0, icDim(m).D / 2 - 0.5), doorOut(m)]; s.a.y = 0;
  }
  function sec(s: Sakin, m: IcMekan, faz: string) {
    const st = s.ne(s, faz); s.faz = faz;
    if (!st) { cik(s, m); return; }
    const cand = (typeof st.p[0] === 'number' ? [st.p] : st.p) as P[], lock = !!st.kilit || cand.length > 1;
    const hit = cand.find(c => !lock || !locks.has(c) || locks.get(c) === s);
    if (!hit) { s.durum = 'dur'; s.a.act = 'idle'; s.a.speed = 0; return; }
    if (s.kilit && s.kilit !== hit) locks.delete(s.kilit);
    if (lock) { locks.set(hit, s); s.kilit = hit; } else s.kilit = null;
    const to = wd(m, hit), a = s.a;
    s.yol = Math.hypot(to.x - a.x, to.z - a.z) < 0.15 ? [] : (st.via || []).map(q => wd(m, q));
    s.yol.push(to); s.st = st; s.durum = 'git';
  }
  const step1 = (a: Actor, to: Vec2, sp: number, dt: number) => {
    const dx = to.x - a.x, dz = to.z - a.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return true;
    const k = Math.min(1, sp * dt / d); a.x += dx * k; a.z += dz * k; a.rot = Math.atan2(dx, dz); a.speed = sp; a.act = 'walk'; return false;
  };
  /** one tick of one resident: walk the path, then do the step's act for its time, then pick the next step */
  function tick(s: Sakin, m: IcMekan, faz: string, dt: number) {
    const a = s.a;
    if (s.durum === 'dur') { sec(s, m, faz); return; }
    if (s.durum === 'bekle') { s.bek -= dt; if (s.bek <= 0 || faz !== s.faz) sec(s, m, faz); return; }
    if (s.yol.length && !step1(a, s.yol[0], s.durum === 'cik' ? 1.5 : 1.4, dt)) return;
    if (s.yol.length) { s.yol.shift(); if (s.yol.length) return; }
    if (s.durum === 'cik') { sil(s); return; }
    const st = s.st!; s.durum = 'bekle'; s.bek = st.sn ? st.sn[0] + rng.next() * (st.sn[1] - st.sn[0]) : 0;
    a.speed = 0; a.act = st.act || 'idle'; a.y = st.y || 0;
    if (st.f) { const p0 = icWorld(m, 0, 0), p1 = icWorld(m, st.f[0], st.f[1]); a.rot = Math.atan2(p1.x - p0.x, p1.z - p0.z); }
    if (st.say) { a.say = st.say; a.sayT = 2.4; }
  }

  return {
    id: 'icsakin', order: 48, phase: 'sim',
    step(ctx: SimCtx) {
      const dt = Math.min(ctx.dt, 0.25), p = env.player(), h = env.host.hour();
      for (const o of ODALAR) {
        const m = IC_BY_ID[o.id], R = Math.max(m.wx, m.wz) / 2, d = Math.hypot(p.x - m.x, p.z - m.z), faz = o.faz(h);
        if (on.has(o.id) && d > R + UZAK) { for (const s of live.filter(x => x.oda === o.id)) sil(s); on.delete(o.id); continue; }
        if (!on.has(o.id)) {
          if (d >= R + YAKIN) continue;
          on.add(o.id); tmr[o.id] = 0;
          // first appearance: residents are already at their post (nobody pops in at the door in front of the player's eyes)
          if (o.acik(faz)) for (const t of o.kalici) if (live.length < CAP) { const s = kur(m, t.rig, t.ne, true, t.id, { x: 0, z: 0 }, faz, t.ad); sec(s, m, faz); const q = s.yol[s.yol.length - 1]; s.a.x = s.a.px = q.x; s.a.z = s.a.pz = q.z; s.yol = []; s.durum = 'git'; }
        }
        const mine = live.filter(s => s.oda === o.id);
        if (o.acik(faz)) {   // closed -> open: residents walk in through the door
          for (const t of o.kalici) if (!mine.some(s => s.id === t.id) && live.length < CAP) { const s = kur(m, t.rig, t.ne, true, t.id, doorOut(m), faz, t.ad), gi = o.giris || [[0, icDim(m).D / 2 - 0.6]]; s.yol = gi.map(q => wd(m, q)); s.st = w(0, 0); s.durum = 'git'; }
        } else for (const s of mine) if (s.kalici && s.durum !== 'cik') cik(s, m);
        const g = o.gelen;
        if (g && g.acik(h) && o.acik(faz) && mine.filter(s => !s.kalici).length < g.enCok && live.length < CAP && (tmr[o.id] -= dt) <= 0) {
          tmr[o.id] = g.aralik[0] + rng.next() * (g.aralik[1] - g.aralik[0]);
          const y = g.yap(rng, n); kur(m, y.rig, bir(y.steps), false, 'gelen', doorOut(m), faz);
        }
        for (const s of [...live]) if (s.oda === o.id) tick(s, m, faz, dt);
      }
    },
    rows: () => live.map(s => ({ oda: s.oda, id: s.id, x: s.a.x, z: s.a.z, act: s.a.act })),
    count: () => live.length,
  };
}
