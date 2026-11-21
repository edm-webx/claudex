/**
 * Halı saha maç motoru (saf, DOM yok, seed'li): formasyon + rol tabanlı yapay zeka, istatistik çetelesi.
 * UI (ui/hali-saha.ts) sadece çizer ve girdi verir; testler aynı motoru başsız (headless) bot vs bot oynatır.
 * Saha: x 0..L (takım 0 sağa, +x, hücum eder), y 0..WD. Kale ağızları y M0..M1, x=0 ve x=L; üst direk GH, ağ derinliği GD.
 * Ölçüm: sim/mac-olcum.ts + tools/mac-metrik.mjs (FUT-01).
 */
export const L = 40, WD = 20, M0 = 8.2, M1 = 11.8, GH = 2, GD = 1.3;
/** Ceza alanı: kale çizgisinden 6 m derin, y 5..15; penaltı noktası 4.5 m. */
export const BOX_D = 6, BOX_Y0 = 5, BOX_Y1 = 15, PEN_D = 4.5;
const G = 9.81, POST_HIT = 0.18;   // direk yarıçapı 0.07 + top 0.11
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const len = (x: number, y: number) => Math.hypot(x, y) || 1e-6;
export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export type Role = 'GK' | 'DEF' | 'MID' | 'FWD';
export interface Skill { flair: number; pace: number; pass: number; shoot: number; tackle: number; vision: number; gk: number }
export interface Stats { goals: number; assists: number; shots: number; onTarget: number; passes: number; passesOk: number; tackles: number; saves: number; touches: number; dist: number }
export type PlAct = '' | 'kick' | 'tackle' | 'celebrate';
export interface Pl {
  x: number; y: number; vx: number; vy: number; fx: number; fy: number; team: 0 | 1; gk: boolean; role: Role; ax: number; ay: number;
  name: string; num: number; stun: number; kickCd: number; think: number; tx: number; ty: number; spd: number; sk: Skill; st: Stats; hold: number;
  /** Çalım patlaması (kalan sn) ve bekleme süresi: patlamada taşıyıcı daha hızlı koşar ve topu yana/öne uzun iter. */
  boost: number; cd2: number;
  /** FUT-04: kaleci dalışı (kalan sn, >0 dalıyor) ve yönü (y ekseninde -1 | 1). */
  dive: number; diveDir: -1 | 1;
  /** FUT-03: animasyon bayrağı ('kick' vuruş, 'tackle' müdahale, 'celebrate' gol sevinci) ve kalan süresi (sn). */
  act: PlAct; actT: number;
  /** FUT-03: top sürmede bir sonraki dokunuşa kalan süre (sn). */
  touch: number;
  /** FUT-02: seed'li oyuncu eğilimi (karar ağırlıkları). */
  egilim: Egilim;
}
export type Egilim = 'pasci' | 'calimci' | 'sutor' | 'yerkapan';
/** FUT-02 takım oyun planı: kısa pas, uzun top, kanat. */
export const PLANLAR = ['kisa', 'uzun', 'kanat'] as const;
export type Plan = typeof PLANLAR[number];
/** FUT-02 savunma tavrı (halisaha.macAyari'den): pres = yüksek blok + erken ikinci presçi, kontra = derin blok, top kazanınca forvet derine koşar. */
export const TAVIRLAR = ['pres', 'dengeli', 'kontra'] as const;
export type Tavir = typeof TAVIRLAR[number];
/** z/vz: top yüksekliği (m, yerde 0) ve dikey hızı. Taşınan top yerdedir. */
export interface Ball { x: number; y: number; z: number; vx: number; vy: number; vz: number; owner: number; lastTouch: 0 | 1; lastKicker: number }
export type Ev = { k: 'sfx'; id: string } | { k: 'banner'; text: string; t: number } | { k: 'goal'; team: 0 | 1; scorer: number } | { k: 'end' } | { k: 'shake'; t: number }
  | { k: 'post' } | { k: 'save'; team: 0 | 1 } | { k: 'foul'; team: 0 | 1; x: number; y: number; pen: boolean } | { k: 'card'; who: number };
/** 'aut' eski kayıtlar/çağrılar için tipte kalır; motor kale çizgisi dışını 'kale' (kale vuruşu) olarak verir. */
export type RestartKind = 'tac' | 'korner' | 'aut' | 'kale' | 'serbest' | 'penalti';
export type RefSignal = '' | 'foul' | 'penalti' | 'korner' | 'tac' | 'aut' | 'kale';
export type Action = 'sut' | 'pas' | 'calim' | 'uzun' | 'kap' | 'degis';

/** Normalised anchors (x: own goal 0 -> opp goal 1, y 0..1), slot 0 = keeper. */
export const FORMATIONS: Record<string, { role: Role; x: number; y: number }[]> = {
  '2-2': [{ role: 'GK', x: .04, y: .5 }, { role: 'DEF', x: .27, y: .3 }, { role: 'DEF', x: .27, y: .7 }, { role: 'FWD', x: .62, y: .28 }, { role: 'FWD', x: .62, y: .72 }],
  '1-2-1': [{ role: 'GK', x: .04, y: .5 }, { role: 'DEF', x: .24, y: .5 }, { role: 'MID', x: .45, y: .2 }, { role: 'MID', x: .45, y: .8 }, { role: 'FWD', x: .7, y: .5 }],
  '2-1-1': [{ role: 'GK', x: .04, y: .5 }, { role: 'DEF', x: .26, y: .3 }, { role: 'DEF', x: .26, y: .7 }, { role: 'MID', x: .48, y: .5 }, { role: 'FWD', x: .72, y: .5 }],
};

export interface MatchOpts { seed?: number; formations?: [string, string]; names?: [string[], string[]]; human?: 0 | 1 | null; halfS?: number; skill?: [number, number]; humanSlot?: number; plan?: [string, string] }
const defNames = [['Kaleci Nuri', 'Hamdi', 'Cemil', 'SABRİ', 'Tayyar'], ['Kaleci Rıfkı', 'Bülent', 'Oktay', 'Ferdi', 'Sinan']];
const emptySt = (): Stats => ({ goals: 0, assists: 0, shots: 0, onTarget: 0, passes: 0, passesOk: 0, tackles: 0, saves: 0, touches: 0, dist: 0 });

export function createMatch(o: MatchOpts = {}) {
  const R = rng(o.seed ?? 1), HALF = o.halfS ?? 75, human = o.human === undefined ? null : o.human;
  const form: [string, string] = o.formations || ['2-2', '2-2'];
  const names = o.names || [defNames[0], defNames[1]];
  // plan dizgesi hücum biçimi ve/veya savunma tavrı taşır: 'kanat', 'pres', 'kanat-pres'. Hücum biçimi yoksa seed'li seçilir.
  const parca = (v: string | undefined) => (v || '').split(/[-+ ,]/);
  const asPlan = (v: string | undefined): Plan => parca(v).find(x => (PLANLAR as readonly string[]).includes(x)) as Plan || PLANLAR[Math.floor(R() * 3)];
  const asTavir = (v: string | undefined): Tavir => parca(v).find(x => (TAVIRLAR as readonly string[]).includes(x)) as Tavir || 'dengeli';
  const plans: [Plan, Plan] = [asPlan(o.plan?.[0]), asPlan(o.plan?.[1])], tavir: [Tavir, Tavir] = [asTavir(o.plan?.[0]), asTavir(o.plan?.[1])];
  const EG: Egilim[] = ['pasci', 'calimci', 'sutor', 'yerkapan'];
  const pls: Pl[] = [];
  for (const team of [0, 1] as const) {
    const base = o.skill ? o.skill[team] : 0.6;
    FORMATIONS[form[team]].forEach((s, i) => {
      const j = () => clamp(base + (R() - 0.5) * 0.18, 0.25, 0.95);
      const ax = team === 0 ? s.x : 1 - s.x, x = ax * L, y = s.y * WD;
      pls.push({ x, y, vx: 0, vy: 0, fx: team === 0 ? 1 : -1, fy: 0, team, gk: i === 0, role: s.role, ax: s.x, ay: s.y, name: names[team][i] || ('Oyuncu' + i), num: i === 0 ? 1 : [0, 4, 5, 10, 9][i] + (team ? -1 : 0),
        stun: 0, kickCd: 0, think: R() * 0.2, tx: x, ty: y, spd: 6, hold: 0, boost: 0, cd2: 0, dive: 0, diveDir: 1, act: '', actT: 0, touch: 0, egilim: EG[Math.floor(R() * 4)],
        sk: { flair: R(), pace: j(), pass: j(), shoot: j(), tackle: j(), vision: j(), gk: j() }, st: emptySt() });
    });
  }
  const ball: Ball = { x: L / 2, y: WD / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, lastTouch: 0, lastKicker: -1 };
  const m = {
    pls, ball, score: [0, 0] as [number, number], clock: 0, half: 1, over: false, freeze: 1.4, ctrl: o.humanSlot ?? 3, input: { ix: 0, iy: 0 }, events: [] as Ev[],
    restart: null as null | { taker: number; kind: RestartKind; t: number }, poss: [0, 0] as [number, number], corners: [0, 0] as [number, number], fouls: [0, 0] as [number, number],
    /** FUT-05 hakem: sahada topu çaprazdan izler; signal karar işareti (kol), t işaretin kalan süresi (sn). vx/vy yürüyüş animasyonu için. */
    ref: { x: L / 2, y: WD / 2 + 4, vx: 0, vy: 0, signal: '' as RefSignal, t: 0 },
    /** FUT-02: takım oyun planları ve tribün heyecanı (0..1: tehlikeli atak, şut, kurtarış, direk, faul, gol = 1). */
    plan: plans, tavir, heat: 0.15,
    pass: null as null | { from: number; team: 0 | 1 }, shot: null as null | { team: 0 | 1; t: number }, lastPasser: -1, lastPasserT: -9, switchT: 0, planT: 0,
    timers: [] as { t: number; fn: () => void }[], banner: 'Başlıyoruz!', bannerT: 1.6,
    /** Top ayaktan uzaktayken (dokun-kovala) basılan vuruş, top 1.5 m'ye girince (en çok 0.5 sn içinde) yapılır. */
    bekleyen: null as null | { a: Action; power: number; uzun: boolean; t: number },
    step, act, kickoff, teamStats,
  };
  const dirOf = (t: number) => (t === 0 ? 1 : -1), goalX = (t: number) => (t === 0 ? L : 0), ownX = (t: number) => (t === 0 ? 0 : L);
  const emit = (e: Ev) => m.events.push(e), sfx = (id: string) => emit({ k: 'sfx', id });
  const say = (text: string, t: number) => { m.banner = text; m.bannerT = t; emit({ k: 'banner', text, t }); };
  const after = (t: number, fn: () => void) => m.timers.push({ t, fn });
  const isHuman = (i: number) => human !== null && pls[i].team === human && i === m.ctrl;
  const setAct = (p: Pl, a: PlAct, t: number) => { p.act = a; p.actT = t; };
  const placeBall = (x: number, y: number) => { ball.x = x; ball.y = y; ball.z = 0; ball.vx = ball.vy = ball.vz = 0; };

  function kickoff(toTeam: 0 | 1) {
    m.restart = null; m.pass = null; m.shot = null;
    pls.forEach(p => { const nx = p.team === 0 ? Math.min(p.ax * L, L / 2 - 1.5) : Math.max((1 - p.ax) * L, L / 2 + 1.5); p.x = p.gk ? ownX(p.team) + dirOf(p.team) * 0.8 : nx; p.y = p.ay * WD; p.vx = p.vy = 0; p.stun = 0; p.dive = 0; p.tx = p.x; p.ty = p.y; });
    const t = pls.findIndex(p => p.team === toTeam && p.role === 'FWD') >= 0 ? pls.findIndex(p => p.team === toTeam && p.role === 'FWD') : pls.findIndex(p => p.team === toTeam && !p.gk);
    pls[t].x = L / 2 + (toTeam === 0 ? -0.7 : 0.7); pls[t].y = WD / 2;
    placeBall(L / 2, WD / 2); ball.owner = t; ball.lastTouch = toTeam; m.freeze = 1.2;
    if (human !== null && toTeam === human) m.ctrl = t; else if (human !== null) m.ctrl = pls.findIndex(p => p.team === human && p.role === 'FWD');
    if (human !== null && (m.ctrl < 0 || pls[m.ctrl].team !== human)) m.ctrl = pls.findIndex(p => p.team === human && !p.gk);
  }

  // ---------- helpers for decisions
  const nearestOpp = (p: Pl, x = p.x, y = p.y) => { let d = 1e9; for (const o of pls) if (o.team !== p.team && !o.gk) d = Math.min(d, Math.hypot(o.x - x, o.y - y)); return d; };
  function laneClear(p: Pl, x: number, y: number): number {   // min distance of any opponent (incl. keeper) to the segment p->(x,y)
    const dx = x - p.x, dy = y - p.y, dd = dx * dx + dy * dy || 1; let best = 1e9;
    for (const o of pls) if (o.team !== p.team) { const t = clamp(((o.x - p.x) * dx + (o.y - p.y) * dy) / dd, 0.05, 1); best = Math.min(best, Math.hypot(p.x + dx * t - o.x, p.y + dy * t - o.y)); }
    return best;
  }
  function xg(p: Pl, x = p.x, y = p.y): number {
    const gx = goalX(p.team), dx = Math.abs(gx - x), dist = Math.hypot(dx, WD / 2 - y);
    const half = (M1 - M0) / 2, ang = Math.atan2(half * 2 * Math.max(0.2, dx / dist), dist);  // visible mouth, shrinking with wide angles
    let block = 0; for (const o of pls) if (o.team !== p.team && !o.gk) { const px = (o.x - x) * dirOf(p.team); if (px > 0 && px < dist) { const lat = Math.abs((o.y - y) - (WD / 2 - y) * px / Math.max(dx, 0.1)); if (lat < 1.2) block += 0.35; } }
    return clamp(Math.exp(-dist / 9) * (ang * 1.3) * (1 - Math.min(block, 0.8)) * (0.6 + p.sk.shoot * 0.6), 0, 0.9);
  }

  /**
   * Vuruş (FUT-03): yön (dx, dy), yatay hız, dikey hız vz (0 = yerden pas). Pas hata modeli: açı hatası pas becerisine, baskıya ve
   * mesafeye bağlı; hız hatası becerisizlikle büyür. Şut isabeti top yüksekliği dahil hesaplanır (üst direği aşan şut isabetsiz).
   */
  function kick(p: Pl, dx: number, dy: number, speed: number, kind: 'sut' | 'pas', vz = 0) {
    const d = len(dx, dy), i = pls.indexOf(p);
    if (kind === 'pas') {
      const press = nearestOpp(p), err = ((1 - p.sk.pass) * 0.16 + (press < 1.5 ? 0.06 : 0) + d * 0.002) * (R() - 0.5) * 2, c = Math.cos(err), s = Math.sin(err);
      const nx = (dx * c - dy * s) / d, ny = (dx * s + dy * c) / d; dx = nx * d; dy = ny * d; speed *= 1 + (R() - 0.5) * 0.16 * (1.2 - p.sk.pass);
    }
    ball.owner = -1; ball.vx = dx / d * speed; ball.vy = dy / d * speed; ball.vz = vz; ball.z = 0; ball.lastTouch = p.team; ball.lastKicker = i; p.kickCd = 0.35; p.touch = 0;
    if (Math.hypot(ball.x - p.x, ball.y - p.y) > 1.5) { ball.x = p.x + dx / d * 0.6; ball.y = p.y + dy / d * 0.6; }   // top ayağın önünden çıkar
    setAct(p, 'kick', 0.3);
    if (kind === 'pas') { m.pass = { from: i, team: p.team }; p.st.passes++; m.shot = null; sfx('puff'); }
    else {
      if (m.restart && m.restart.kind === 'penalti') {   // penaltıda kaleci vuruş anında bir yöne karar verir (beceriyle doğru tahmin)
        const k = pls.find(q => q.gk && q.team !== p.team)!, side = ball.vy >= 0 ? 1 : -1, guess = R() < 0.3 + k.sk.gk * 0.3 ? side : (R() < 0.5 ? 1 : -1);
        k.dive = 0.5; k.diveDir = guess as -1 | 1; k.vy = 4.5 + k.sk.gk * 1.5;
      }
      m.pass = null; p.st.shots++; const tt = (goalX(p.team) - ball.x) / (ball.vx || 1e-6), zl = vz * tt - G / 2 * tt * tt;
      if (tt > 0 && ball.vx * dirOf(p.team) > 0 && ball.y + ball.vy * tt > M0 - 0.3 && ball.y + ball.vy * tt < M1 + 0.3 && zl < GH - 0.1) { p.st.onTarget++; m.shot = { team: p.team, t: 3 }; } else m.shot = null;
      sfx('kick'); emit({ k: 'shake', t: 0.15 });
    }
  }
  /** Havadan uzun top: hedefe yakın düşecek dikey ve yatay hız. */
  function loft(p: Pl, tx: number, ty: number) {
    const d = len(tx - p.x, ty - p.y), vz = clamp(2.4 + d * 0.16, 3, 6.5), T = 2 * vz / G;
    kick(p, tx - p.x, ty - p.y, clamp(d * 0.92 / T, 6, 22), 'pas', vz);
  }

  /** Best pass target for p: progress + open lane + receiver openness. Returns [mate, score]. */
  function passOption(p: Pl, dirx = 0, diry = 0, steer = false): [Pl | null, number] {
    let best: Pl | null = null, bs = -1e9; const dir = dirOf(p.team);
    for (const q of pls) {
      if (q === p || q.team !== p.team || q.gk) continue;
      const dx = q.x - p.x, dy = q.y - p.y, d = len(dx, dy); if (d < 2) continue;
      const lane = laneClear(p, q.x + q.vx * 0.3, q.y + q.vy * 0.3), open = nearestOpp(p, q.x, q.y);
      let s = (dx * dir) * 0.09 + Math.min(lane, 3) * 0.5 + Math.min(open, 5) * 0.22 - d * 0.03 + xg(q) * 3 + (R() - 0.5) * (1.4 - p.sk.vision);   // görüşü zayıf oyuncu daha sık yanlış seçer
      if (lane < 1.0) s -= 3;
      if (steer) s += (dx * dirx + dy * diry) / d * 3;
      if (s > bs) { bs = s; best = q; }
    }
    return [best, bs];
  }

  /** Çalım (FUT-03): topu yana-öne iter + kısa hız patlaması. Yakındaki rakipler tepki gecikmesi boyunca müdahale edemez;
   *  savunmacı yanlış yöne yatmışsa (top ondan uzaklaşan yana gidiyorsa) geometrik olarak geçilir. */
  function calim(p: Pl, ix: number, iy: number) {
    let nd = 1e9, n: Pl | null = null; for (const o of pls) if (o.team !== p.team && !o.gk) { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < nd) { nd = d; n = o; } }
    let sx = -p.fy, sy = p.fx;   // yan vektör: rakipten uzak taraf
    if (n && (n.x - p.x) * sx + (n.y - p.y) * sy > 0) { sx = -sx; sy = -sy; }
    let dx = p.fx * 0.65 + sx * 0.75, dy = p.fy * 0.65 + sy * 0.75;
    if (Math.hypot(ix, iy) > 0.25) { dx = ix; dy = iy; }
    const d = len(dx, dy), sp = Math.hypot(p.vx, p.vy) + 3.2;
    ball.vx = dx / d * sp; ball.vy = dy / d * sp; p.touch = 0.32; p.boost = 0.5; p.cd2 = 1.4;
    for (const o of pls) if (o.team !== p.team && Math.hypot(o.x - p.x, o.y - p.y) < 2.6) o.kickCd = Math.max(o.kickCd, 0.22 + (1 - o.sk.tackle) * 0.25);
    sfx('puff');
  }

  /**
   * Müdahale (FUT-03): yakınlık + giriş açısı. Topa erişim 0.6 m + beceri; taşıyıcının gövdesi topla müdahaleci arasındaysa (top
   * korunuyor) ya da arkadan geliniyorsa top alınamaz. Başarısız müdahale kısa sendeleme verir (spam işe yaramaz).
   */
  function tackle(qi: number): boolean {
    const q = pls[qi], o = ball.owner >= 0 ? pls[ball.owner] : null; setAct(q, 'tackle', 0.45); q.kickCd = 0.6;
    if (!o || o.team === q.team || o.gk || m.restart) return false;
    const db = Math.hypot(ball.x - q.x, ball.y - q.y), dc = Math.hypot(o.x - q.x, o.y - q.y), reach = 0.5 + q.sk.tackle * 0.55, qs = Math.hypot(q.vx, q.vy);
    const behind = ((q.x - o.x) * o.fx + (q.y - o.y) * o.fy) / (dc || 1) < -0.35, shielded = dc + 0.3 < db && Math.hypot(ball.x - o.x, ball.y - o.y) < 0.8;
    if (db < reach && !behind && !shielded) { o.stun = 0.45; take(qi, true); sfx('kick'); return true; }
    if (dc < 1.0 && (behind || (qs > 6.5 && dc < 0.8 && db > reach + 0.3))) { foul(qi, o, behind && qs > 6); return false; }   // arkadan ya da topa gitmeyen sert giriş
    q.stun = 0.28; return false;
  }

  // ---------- carrier decision (non-human)
  function carrierAI(p: Pl, i: number, dt: number) {
    const dir = dirOf(p.team), gx = goalX(p.team), press = nearestOpp(p), dGoal = Math.hypot(gx - p.x, WD / 2 - p.y);
    // dribble target: toward goal, steer away from the closest defender in front, avoid walls
    const ty0 = WD / 2 + (p.y - WD / 2) * 0.35;
    let ux = 0, uy = 0; for (const o of pls) if (o.team !== p.team && !o.gk) { const dx = o.x - p.x, dy = o.y - p.y, d = len(dx, dy); if (d < 3.2 && dx * dir > -0.5) { ux -= dx / d * (3.2 - d); uy -= dy / d * (3.2 - d); } }
    p.tx = clamp(p.x + dir * 6 + ux * 1.4, 1.5, L - 1.5); p.ty = clamp(ty0 + uy * 1.4, 2, WD - 2); p.spd = 4.9 + p.sk.pace * 2 - (press < 1.5 ? 0.4 : 0);
    const near = Math.hypot(ball.x - p.x, ball.y - p.y) < 1.0;
    p.think -= dt; if (p.think > 0 || p.kickCd > 0 || (m.restart && m.restart.taker === i && m.restart.t < 0.6) || (!near && !m.restart)) return;   // top ayaktan uzaktayken (dokun-kovala) karar yok
    // karar zamanlaması: baskı altında ve son üçte birde hızlı, boşta ve kendi yarısında sakin; görüşü iyi oyuncu daha seri
    p.think = (press < 1.8 ? 0.14 + R() * 0.16 : dGoal < 13 ? 0.15 + R() * 0.2 : 0.2 + R() * 0.32) * (1.25 - p.sk.vision * 0.45);
    const eg = p.egilim, pl = m.plan[p.team];
    if (near && press < 1.7 && p.cd2 <= 0 && !m.restart && R() < 0.1 + p.sk.flair * 0.2 + (eg === 'calimci' ? 0.15 : 0)) { calim(p, 0, 0); return; }
    const shotV = xg(p), [mate, ps] = passOption(p);
    const carry = 0.9 + p.sk.flair * 1.3 - (press < 1.6 ? 1.6 : 0) - (press < 2.6 ? 0.5 : 0) + (press > 3.5 ? 1.0 : 0) + (dGoal < 9 ? 0.6 : 0) + R() * 0.9 + (p.hold > 3 ? -1.5 : 0)
      + (eg === 'calimci' ? 0.7 : eg === 'pasci' ? -0.5 : 0) + (pl === 'kisa' ? -0.3 : 0);
    if (m.restart && m.restart.taker === i) {   // set piece: look, then play it
      const kd = m.restart.kind;
      if (kd === 'penalti' || (kd === 'serbest' && dGoal < 14 && shotV > 0.06 && R() < 0.6)) {   // penaltı ya da doğrudan serbest vuruş: köşeye
        const side = R() < 0.5 ? -1 : 1, aim = WD / 2 + side * (0.9 + R() * 0.8);
        kick(p, gx + dir * 0.5 - p.x, aim - p.y + (R() - 0.5) * (1 - p.sk.shoot) * 1.6, 17 + p.sk.shoot * 6, 'sut', kd === 'penalti' ? 0.3 + R() * 1.6 : 2.6 + R() * 1.2); return;
      }
      // duran top seçenekleri (FUT-02): kısa / ceza alanına / uzun, plana ve boşluğa göre seed'li seçilir
      const ground = (q: Pl) => kick(p, q.x - p.x, q.y - p.y, clamp(len(q.x - p.x, q.y - p.y) * 1.5 + 4, 9, 17), 'pas');
      const outs = pls.filter(q => q.team === p.team && !q.gk && q !== p), open = (q: Pl) => nearestOpp(p, q.x, q.y) > 2 && laneClear(p, q.x, q.y) > 1.1;
      if (kd === 'korner') {
        const short = outs.filter(q => Math.hypot(q.x - p.x, q.y - p.y) < 6 && open(q))[0], box = outs.filter(q => Math.abs(gx - q.x) < BOX_D + 2).sort((a, b) => Math.abs(a.x - gx) - Math.abs(b.x - gx));
        const u = R();
        if (short && u < 0.25) ground(short);
        else if (box.length) { const t = u < 0.6 ? box[0] : box[box.length - 1]; if (R() < 0.6) loft(p, t.x, clamp(t.y + (u < 0.6 ? 0 : (WD / 2 - p.y) * 0.25), 2, WD - 2)); else ground(t); }   // ön direk ya da arka direk
        else if (mate) ground(mate);
        return;
      }
      if (kd === 'kale' || kd === 'aut') {   // kale vuruşu: boş savunmacıya kısa, yoksa (ya da uzun/kontra planında) forvete havadan
        const longP = pl === 'uzun' || m.tavir[p.team] === 'kontra' ? 0.55 : 0.2, fwd = outs.slice().sort((a, b) => (b.x - a.x) * dir)[0];
        const short = outs.filter(q => Math.abs(q.x - p.x) < 14 && open(q)).sort((a, b) => nearestOpp(p, b.x, b.y) - nearestOpp(p, a.x, a.y))[0];
        if (short && R() > longP) ground(short); else if (fwd) loft(p, fwd.x + dir * 1.5, fwd.y); else kick(p, dir, 0, 13, 'pas');
        return;
      }
      if (kd === 'tac') {   // taç: çizgi boyunca öndeki arkadaşa ya da en boş kısa seçeneğe
        const line = outs.filter(q => (q.x - p.x) * dir > 2 && Math.abs(q.y - p.y) < 7 && open(q))[0];
        if (line && R() < 0.4) { const tx = clamp(line.x + dir * 1.5, 1, L - 1); kick(p, tx - p.x, line.y - p.y, clamp(len(tx - p.x, line.y - p.y) * 1.4 + 5, 9, 16), 'pas'); }
        else if (mate) ground(mate); else kick(p, dir, 0, 12, 'pas');
        return;
      }
      if (mate) kick(p, mate.x - p.x, mate.y - p.y, clamp(len(mate.x - p.x, mate.y - p.y) * 1.4 + 6, 9, 17), 'pas'); else kick(p, dir, 0, 12, 'pas');
      return;
    }
    if (dGoal < 16 && shotV > 0.085 + R() * 0.07 + (press > 2.5 ? 0.03 : 0) + (eg === 'sutor' ? -0.03 : eg === 'pasci' ? 0.02 : 0) && shotV >= xg(mate || p) - 0.02) {
      const side = (R() < 0.5 ? -1 : 1), aim = WD / 2 + side * (1.1 + (1 - p.sk.shoot) * 0.9 + R() * 0.6) * ((M1 - M0) / 2 / 1.6);
      kick(p, gx + dir * 0.5 - p.x, aim - p.y + (R() - 0.5) * ((1 - p.sk.shoot) * 3.4 + dGoal * 0.18 + (press < 1.8 ? 2.2 : 0)), 14 + p.sk.shoot * 10 + R() * 2, 'sut', 0.4 + R() * 2.4 + (1 - p.sk.shoot) * R() * 2); return;
    }
    // kanat planı: son üçte birde kenardaki taşıyıcı ceza alanındaki arkadaşa havadan orta açar
    if (pl === 'kanat' && (p.y < 4.5 || p.y > WD - 4.5) && Math.abs(gx - p.x) < 13) {
      const box = pls.filter(q => q.team === p.team && !q.gk && q !== p && Math.abs(gx - q.x) < 8 && q.y > BOX_Y0 && q.y < BOX_Y1)[0];
      if (box && R() < 0.55) { loft(p, box.x + box.vx * 0.5, box.y + box.vy * 0.5); return; }
    }
    if (mate && (ps > carry * 1.4 || (press < 1.5 && ps > -0.5))) {
      const thr = (mate.x - p.x) * dir > 2 && nearestOpp(mate) > 2.2 && R() < 0.25 + p.sk.vision * 0.3 + (m.tavir[p.team] === 'kontra' ? 0.2 : 0);   // ara pas: önündeki boşluğa
      const tx2 = clamp(mate.x + mate.vx * 0.3 + (thr ? dir * 2.5 : 0), 1, L - 1), ty2 = clamp(mate.y + mate.vy * 0.3, 1, WD - 1), d = len(tx2 - p.x, ty2 - p.y);
      if ((d > 13 && laneClear(p, tx2, ty2) < 1.2) || (pl === 'uzun' && d > 10 && R() < 0.5)) loft(p, tx2, ty2); else kick(p, tx2 - p.x, ty2 - p.y, clamp(d * 1.5 + 6, 9, 18), 'pas');
      return;
    }
    p.hold += p.think;
  }

  const inBox = (team: 0 | 1, x: number, y: number) => Math.abs(x - ownX(team)) < BOX_D && y > BOX_Y0 && y < BOX_Y1;

  /**
   * FUT-04 kaleci durum makinesi: konumlan -> dar aç -> dal -> tut/yumrukla (top temasında) -> hızlı oyun (topu elindeyken).
   * Konum: topun iki direğe bakışının açıortayı üzerinde, çizgiden 0.8 m (uzaktaki topçuyu izlemez, açıortay uzakta ağız ortasına
   * yakın kalır). Dar aç: rakip taşıyıcı 9 m içinde ve ortadaysa açıortay boyunca en çok 2.6 m çıkar. Dal: kaleye giden şutu
   * reaksiyon gecikmesinden (beceriye bağlı) sonra görür; vücuduna uzaksa o yana dalar. Ceza alanındaki serbest topa yalnız
   * rakipten önce yetişecekse çıkar. Ceza alanından hiç çıkmaz.
   */
  function kaleciPlan(p: Pl, holder: Pl | null) {
    if (p.dive > 0 || ball.owner === pls.indexOf(p)) return;
    const team = p.team, dir = dirOf(team), og = ownX(team), bx = ball.x, by = ball.y, depth = Math.abs(bx - og);
    const l0 = len(og - bx, M0 - by), l1 = len(og - bx, M1 - by), vx = (og - bx) / l0 + (og - bx) / l1, vy = (M0 - by) / l0 + (M1 - by) / l1;
    const carrier = holder && holder.team !== team ? holder : null;
    const line = carrier && depth < 9 && Math.abs(by - WD / 2) < 6 ? clamp(0.8 + (9 - depth) * 0.22, 0.8, 2.6) : 0.8;
    const k = (og + dir * line - bx) / (Math.abs(vx) > 1e-3 ? vx : 1e-3);
    p.tx = og + dir * line; p.ty = clamp(k > 0 ? by + vy * k : WD / 2, M0 + 0.15, M1 - 0.15); p.spd = Math.hypot(p.tx - p.x, p.ty - p.y) > 1 ? 6 : 4.6 + p.sk.gk * 1.2;   // yerinden çıkmışsa hızla döner
    if (ball.owner >= 0) return;
    const towards = (team === 0 ? ball.vx < -3 : ball.vx > 3) && depth < 18;
    if (towards && m.shot && m.shot.team !== team && 3 - m.shot.t > 0.08 + (1 - p.sk.gk) * 0.18) {
      const tt = (p.x - ball.x) / (ball.vx || 1e-6), yc = ball.y + ball.vy * Math.max(0, tt), off = yc - p.y, zc = ball.z + ball.vz * tt - G / 2 * tt * tt;
      const run = 0.5 + 2 * tt;   // bu kadarına adım atarak yetişir, fazlasına dalar
      if (tt > 0 && tt < 0.5 && zc < GH + 0.4 && Math.abs(off) > run && Math.abs(off) < 2.6 + p.sk.gk * 0.6 && yc > M0 - 0.6 && yc < M1 + 0.6) { p.dive = 0.45; p.diveDir = off < 0 ? -1 : 1; p.vy = clamp(Math.abs(off) / 0.35, 3, 7.5); return; }
      p.tx = og + dir * 0.8; p.ty = clamp(yc, M0 - 0.4, M1 + 0.4); p.spd = 6.2 + p.sk.gk * 1.4; return;
    }
    if (inBox(team, bx, by) && Math.hypot(ball.vx, ball.vy) < 7) {
      const eta = (q: Pl) => Math.hypot(q.x - bx, q.y - by) / (5.5 + q.sk.pace * 1.6);
      let opp = 1e9; for (const o of pls) if (o.team !== team && !o.gk) opp = Math.min(opp, eta(o));
      if (eta(p) < opp - 0.1) { p.tx = bx; p.ty = by; p.spd = 6.5; }
    }
  }

  // ---------- team plan (off-ball): runs every ~0.15 s, sets tx/ty/spd for everyone except the carrier / human
  /**
   * FUT-02 takım yapay zekâsı. Hücumda "alan sahipliği": saha 4x3 hücreye bölünür; her hücrenin boşluk (en yakın rakip), pas
   * koridoru, ilerleme ve tehlike (xG) puanı var. Topsuz oyuncular sırayla kendi rol bölgesine yakın en değerli boş hücreyi alır,
   * arkadaşın aldığı hücre cezalıdır; seçilen hücre içinde küçük bir arama ile kesin nokta bulunur. Rol akışkanlığı: topun gerisinde
   * en derindeki oyuncu (rolü ne olursa olsun) emniyet olur, öne çıkan savunmacının yerini başkası kapatır. Savunmada en yakın
   * presçi + kapatan + adam markajı; pres tetikleyicileri (kötü kontrol, geri pas, çizgiye sıkışmış taşıyıcı) ikinci presçiyi yollar.
   */
  function plan() {
    const holder = ball.owner >= 0 ? pls[ball.owner] : null;
    for (const team of [0, 1] as const) {
      const dir = dirOf(team), mates = pls.filter(p => p.team === team), opps = pls.filter(p => p.team !== team), pl = m.plan[team], tv = m.tavir[team];
      const bp = clamp((team === 0 ? ball.x : L - ball.x) / L, 0, 1);
      const phase = holder ? (holder.team === team ? 'atk' : 'def') : 'loose';
      // blok yüksekliği: pres takımı savunmada önde bekler, kontra takımı kendi yarısına çekilir
      const shift = (bp - 0.5) * 0.4 + (phase === 'atk' ? 0.1 : phase === 'def' ? (tv === 'pres' ? 0.01 : tv === 'kontra' ? -0.15 : -0.07) : 0);
      const outf = mates.filter(p => !p.gk && !isHuman(pls.indexOf(p)) && p !== holder);
      const eta = (p: Pl, x: number, y: number) => Math.hypot(p.x - x, p.y - y) / (5.5 + p.sk.pace * 1.6);
      const rel = (x: number) => (team === 0 ? x : L - x) / L;   // 0 kendi kalesi, 1 rakip kalesi
      const anchor = (p: Pl): [number, number] => {
        let ax = clamp(p.ax + shift * (p.role === 'DEF' ? 0.8 : 1), 0.08, 0.92); const wide = pl === 'kanat' ? 1.25 : 1;
        const ay = clamp(0.5 + (p.ay - 0.5) * wide + (ball.y / WD - 0.5) * 0.4, 0.1, 0.9);
        if (p.role === 'FWD' && phase === 'atk') ax = Math.max(ax, (pl === 'uzun' || tv === 'kontra' ? 0.68 : 0.62) + (bp - 0.5) * 0.2);
        if (p.role === 'FWD' && phase === 'def' && tv === 'kontra') ax = Math.max(ax, 0.52);   // kontra: bir forvet çizgide bekler, top kazanılınca derine koşu hazır
        return [team === 0 ? ax * L : (1 - ax) * L, ay * WD];
      };
      const run = (p: Pl) => 5 + p.sk.pace * 2;
      for (const p of mates) if (p.gk && !isHuman(pls.indexOf(p))) kaleciPlan(p, holder);
      if (phase === 'atk') {
        const h = holder!, deep = outf.length > 1 ? outf.reduce((a, b) => (rel(b.x) < rel(a.x) ? b : a)) : null;
        const taken: [number, number][] = [];
        const order = outf.filter(p => p !== deep).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
        if (deep) {   // emniyet: topun 5-8 m gerisinde, ortaya yakın
          const sx = clamp(h.x - dir * (6 + (deep.egilim === 'yerkapan' ? 2 : 0)), 3, L - 3), sy = WD / 2 + (h.y - WD / 2) * 0.35;
          const [ax] = anchor(deep); deep.tx = dir > 0 ? Math.min(sx, Math.max(ax, sx - 4)) : Math.max(sx, Math.min(ax, sx + 4)); deep.ty = sy; deep.spd = run(deep); taken.push([deep.tx, deep.ty]);
        }
        for (const p of order) {
          const [ax, ay] = anchor(p), stick = p.egilim === 'yerkapan' ? 0.35 : 0.18;
          let best = -1e9, bx = ax, by = ay;
          for (let c = 0; c < 4; c++) for (let r = 0; r < 3; r++) {
            const cx = team === 0 ? (c + 0.5) * L / 4 : L - (c + 0.5) * L / 4, cy = (r + 0.5) * WD / 3;
            if ((cx - h.x) * dir < -6) continue;   // topun çok gerisi emniyetin işi
            let sc = Math.min(nearestOpp(p, cx, cy), 6) * 0.4 + Math.min(laneClear(h, cx, cy), 3) * 0.7 + rel(cx) * (pl === 'uzun' ? 3 : 2) + xg(p, cx, cy) * 4
              - Math.hypot(cx - p.x, cy - p.y) * 0.06 - Math.hypot(cx - ax, cy - ay) * stick + (pl === 'kanat' && r !== 1 ? 0.6 : 0) + (pl === 'kisa' ? -Math.hypot(cx - h.x, cy - h.y) * 0.05 : 0);
            for (const [tx, ty] of taken) sc -= Math.max(0, 7 - Math.hypot(tx - cx, ty - cy)) * 0.45;
            if (Math.hypot(cx - h.x, cy - h.y) < 3) sc -= 2;
            if (sc > best) { best = sc; bx = cx; by = cy; }
          }
          let fb = -1e9, fx = bx, fy = by;   // hücre içinde ince ayar
          for (let k = 0; k < 9; k++) {
            const cx = clamp(bx + ((k % 3) - 1) * 2.5, 1.5, L - 1.5), cy = clamp(by + (Math.floor(k / 3) - 1) * 2, 1.5, WD - 1.5);
            let sc = Math.min(nearestOpp(p, cx, cy), 5) * 0.5 + Math.min(laneClear(h, cx, cy), 3) * 1.1 + xg(p, cx, cy) * 4 + (k === 4 ? 0.3 : 0);
            for (const [tx, ty] of taken) sc -= Math.max(0, 3.5 - Math.hypot(tx - cx, ty - cy)) * 0.6;
            if (sc > fb) { fb = sc; fx = cx; fy = cy; }
          }
          p.tx = fx; p.ty = fy; p.spd = run(p) + 0.2; taken.push([fx, fy]);
        }
      } else if (phase === 'def') {
        const ranked = outf.slice().sort((a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y));
        const hold = holder!, og = ownX(team), loose = Math.hypot(ball.x - hold.x, ball.y - hold.y) > 1.0;
        const back = (ball.vx * dirOf(hold.team) < -2), wall = hold.y < 2.5 || hold.y > WD - 2.5;
        // pres tetikleri: kötü kontrol, geri pas, çizgiye sıkışma. Pres tavrında rakip kendi yarısındayken de ikinci presçi gider;
        // kontra tavrında rakip yarı sahada ikinci presçi hiç çıkmaz (blok bozulmaz).
        const trig = (loose || back || wall || (tv === 'pres' && bp > 0.45)) && !(tv === 'kontra' && bp > 0.55);
        const press = ranked[0], press2 = trig ? ranked[1] : null, cover = trig ? ranked[2] : ranked[1];
        const free = opps.filter(o => !o.gk && o !== hold), used = new Set<Pl>();
        for (const p of outf) {
          let [tx, ty] = anchor(p), sp = 4.6 + p.sk.pace * 1.6;
          if (p === press || p === press2) {   // kale tarafından kapan, yakınken jokey; tetikte daha sert
            const gd = len(og - hold.x, WD / 2 - hold.y), off = p === press2 ? 1.6 : 0.9, px = hold.x + (og - hold.x) / gd * off, py = hold.y + (WD / 2 - hold.y) / gd * off + (p === press2 ? (hold.y < WD / 2 ? 1 : -1) * 1.2 : 0);
            const dd = Math.hypot(px - p.x, py - p.y); tx = px; ty = py; sp = dd > 3 ? 5.8 + p.sk.pace * 1.6 + (trig ? 0.5 : 0) + (tv === 'pres' ? 0.3 : 0) : 4.6;
          } else if (p === cover) { const c = tv === 'kontra' ? 0.6 : tv === 'pres' ? 0.35 : 0.45; tx = hold.x + (og - hold.x) * c; ty = hold.y + (WD / 2 - hold.y) * c; sp = 5.2 + p.sk.pace; }
          else {
            // markaj: pres takımı adamını sıkı ve yüksekte tutar, kontra takımı bölgesinde kalıp adamı yalnız yakınsa alır
            const w = tv === 'pres' ? 0.85 : tv === 'kontra' ? 0.4 : 0.65, gap = tv === 'pres' ? 1.2 : 1.7;
            let mk: Pl | null = null, md = 1e9; for (const o of free) if (!used.has(o)) { const d = Math.hypot(o.x - tx, o.y - ty); if (d < md) { md = d; mk = o; } }
            if (mk && md < (tv === 'pres' ? 12 : 9)) { used.add(mk); const gd = len(og - mk.x, WD / 2 - mk.y); tx = tx * (1 - w) + (mk.x + (og - mk.x) / gd * gap) * w; ty = ty * (1 - w) + (mk.y + (WD / 2 - mk.y) / gd * gap) * w; }
          }
          p.tx = tx; p.ty = ty; p.spd = sp;
        }
      } else {   // loose ball: the quickest of each team goes, the others hold shape; the passer's target goes to the pass
        const tgt = m.pass && m.pass.team === team ? (() => { let b: Pl | null = null, bd = 1e9; for (const q of outf) { const d = Math.hypot(q.x - (ball.x + ball.vx * 0.6), q.y - (ball.y + ball.vy * 0.6)); if (q !== pls[m.pass!.from] && d < bd) { bd = d; b = q; } } return b; })() : null;
        const ranked = outf.slice().sort((a, b) => eta(a, ball.x, ball.y) - eta(b, ball.x, ball.y));
        const chaser = tgt || ranked[0];
        for (const p of outf) {
          let [tx, ty] = anchor(p), sp = 4.6 + p.sk.pace * 1.6;
          if (p === chaser) { const lt = clamp(eta(p, ball.x, ball.y) * 0.8, 0, 1.2); tx = clamp(ball.x + ball.vx * lt, 0.5, L - 0.5); ty = clamp(ball.y + ball.vy * lt, 0.5, WD - 0.5); sp = 6 + p.sk.pace * 2; }
          p.tx = tx; p.ty = ty; p.spd = sp;
        }
      }
    }
  }

  const BANNER: Record<RestartKind, string> = { tac: 'TAÇ', korner: 'KORNER', aut: 'AUT', kale: 'KALE VURUŞU', serbest: 'FAUL', penalti: 'PENALTI' };
  const signal = (s: RefSignal) => { m.ref.signal = s; m.ref.t = 1.6; };

  /** Duran top (FUT-05): taç, korner, kale vuruşu, serbest vuruş (5v5 kısa duvar), penaltı. Hakem kararı kolla gösterir (m.ref). */
  function setPiece(kind: RestartKind, team: 0 | 1, bx: number, by: number) {
    sfx('whistle'); say(BANNER[kind], 1.4); m.freeze = kind === 'penalti' ? 1.8 : 1.1; m.pass = null; m.shot = null; m.bekleyen = null;
    signal(kind === 'serbest' ? 'foul' : kind);
    if (kind === 'korner') m.corners[team]++;
    let tx: number, ty: number, taker = -1;
    const nearest = () => { let bd = 1e9; pls.forEach((q, i) => { if (q.team === team && !q.gk) { const d = Math.hypot(q.x - tx, q.y - ty); if (d < bd) { bd = d; taker = i; } } }); };
    if (kind === 'aut' || kind === 'kale') { taker = pls.findIndex(q => q.team === team && q.gk); tx = team === 0 ? 2 : L - 2; ty = WD / 2; }
    else if (kind === 'penalti') {
      tx = ownX(1 - team) + dirOf(1 - team) * PEN_D; ty = WD / 2; let bs = -1;
      pls.forEach((q, i) => { if (q.team === team && !q.gk && q.sk.shoot > bs) { bs = q.sk.shoot; taker = i; } });
      pls.forEach((q, i) => { if (i === taker || q.gk) return; if (inBox(1 - team as 0 | 1, q.x, q.y) || Math.hypot(q.x - tx, q.y - ty) < 3) { q.x = ownX(1 - team) + dirOf(1 - team) * (BOX_D + 1 + (i % 3) * 0.8); q.vx = q.vy = 0; } });
      const k = pls.find(q => q.gk && q.team !== team)!; k.x = ownX(k.team) + dirOf(k.team) * 0.5; k.y = WD / 2; k.vx = k.vy = 0;
    }
    else if (kind === 'serbest') { tx = clamp(bx, 1, L - 1); ty = clamp(by, 0.6, WD - 0.6); nearest(); }
    else { tx = kind === 'korner' ? (bx > L / 2 ? L - 0.4 : 0.4) : clamp(bx, 1, L - 1); ty = by < WD / 2 ? 0.4 : WD - 0.4; nearest(); }
    const p = pls[taker]; p.x = tx; p.y = ty; p.vx = p.vy = 0; p.stun = 0; p.dive = 0; p.kickCd = 0; p.think = kind === 'penalti' ? 1.0 : 0.5;
    const gx = goalX(team), aimX = kind === 'korner' ? (tx > L / 2 ? L - 3 : 3) : kind === 'penalti' || kind === 'serbest' ? gx : L / 2, ad = len(aimX - tx, WD / 2 - ty); p.fx = (aimX - tx) / ad; p.fy = (WD / 2 - ty) / ad;
    pls.forEach(q => { if (q.team === team) return; const dx = q.x - tx, dy = q.y - ty, dd = Math.hypot(dx, dy); if (dd < 3) { const ux = dd > 0.01 ? dx / dd : -p.fx, uy = dd > 0.01 ? dy / dd : -p.fy; q.x = clamp(tx + ux * 3, 0.4, L - 0.4); q.y = clamp(ty + uy * 3, 0.4, WD - 0.4); q.vx = q.vy = 0; } });
    if (kind === 'serbest' && Math.hypot(gx - tx, WD / 2 - ty) < 15) {   // kısa duvar: en yakın iki rakip, topla kale arasında 3 m'de
      const gd = len(gx - tx, WD / 2 - ty), ux = (gx - tx) / gd, uy = (WD / 2 - ty) / gd;
      pls.filter(q => q.team !== team && !q.gk).sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty)).slice(0, 2)
        .forEach((q, k) => { q.x = clamp(tx + ux * 3 - uy * (k - 0.5) * 0.7, 0.4, L - 0.4); q.y = clamp(ty + uy * 3 + ux * (k - 0.5) * 0.7, 0.4, WD - 0.4); q.vx = q.vy = 0; q.stun = 0.4; });
    }
    placeBall(kind === 'penalti' ? tx : p.x + p.fx * 0.6, kind === 'penalti' ? ty : p.y + p.fy * 0.6); ball.owner = taker; ball.lastTouch = team;
    if (kind === 'penalti') { p.x = tx - p.fx * 0.7; p.y = ty - p.fy * 0.7; }
    m.restart = { taker, kind, t: 0 }; if (human !== null && team === human && !p.gk) m.ctrl = taker;
  }

  /**
   * Faul (FUT-05): arkadan temaslı müdahale ya da topa değmeyen aşırı sert (hızlı) temaslı müdahale. Temiz top kazanma faul değildir.
   * Faulü yapanın kendi ceza alanında = penaltı, başka yerde = serbest vuruş. Sert arkadan giriş ya da aynı oyuncunun 3. faulü sarı kart
   * (yalnız uyarı, atma yok).
   */
  const faulSay = pls.map(() => 0);
  function foul(qi: number, o: Pl, hard: boolean) {
    const q = pls[qi], pen = inBox(q.team, o.x, o.y), card = hard || ++faulSay[qi] >= 3; m.fouls[q.team]++;
    emit({ k: 'foul', team: q.team, x: o.x, y: o.y, pen }); o.stun = 0.6;
    setPiece(pen ? 'penalti' : 'serbest', o.team, o.x, o.y);
    if (card) { faulSay[qi] = 0; emit({ k: 'card', who: qi }); say(BANNER[pen ? 'penalti' : 'serbest'] + ' - SARI KART: ' + q.name, 1.8); }
  }

  function goal(team: 0 | 1) {
    m.score[team]++; const sc = ball.lastKicker >= 0 && pls[ball.lastKicker].team === team ? ball.lastKicker : -1;
    if (sc >= 0) { pls[sc].st.goals++; if (m.lastPasser >= 0 && m.lastPasser !== sc && pls[m.lastPasser].team === team && m.clock - m.lastPasserT < 5) pls[m.lastPasser].st.assists++; }
    for (const p of pls) if (p.team === team) setAct(p, 'celebrate', 2.1);
    sfx('net'); sfx('crowdCheer'); if (human !== null && team !== human) sfx('crowdOoh');
    say('GOOOOL!', 2.2); m.freeze = 2.2; emit({ k: 'shake', t: 0.4 }); emit({ k: 'goal', team, scorer: sc });
    after(2.1, () => { if (!m.over) kickoff(team === 0 ? 1 : 0); });
  }

  /**
   * İnsan tarafının eylemleri (UI eşlemesi ui/hali-saha.ts). Mevcut çağrılar korunur: act('sut', güç), act('pas', 0.5, araPas), act('calim').
   * - sut: basılı tutup şarj (güç 0..1); nişan çubuğun gösterdiği köşe, yoksa kaleciden uzak köşe. Yüksek güç hızlı ama dağınık ve
   *   daha yüksek (üst direği aşabilir). Topsuzken müdahale (kap) olarak çalışır.
   * - pas: çubuğun gösterdiği arkadaşa yerden pas; uzun=true ara pas (önündeki boşluğa). Topsuzken topa en yakın arkadaşa geçer.
   * - uzun: havadan uzun top (alçak savunmanın üstünden). calim: topla yana-öne çalım + patlama; topsuz kısa depar.
   * - kap: müdahale. degis: topa en yakın arkadaşa geç.
   */
  function act(a: Action, power = 0.5, uzun = false) {
    if (m.over || m.freeze > 0 || human === null) return;
    if (m.restart && m.restart.kind === 'tac' && ball.owner === m.ctrl && a !== 'uzun') a = 'pas';
    if (m.restart && m.restart.kind === 'penalti' && ball.owner === m.ctrl) a = 'sut';   // penaltıda yalnız şut
    const p = pls[m.ctrl], { ix, iy } = m.input, dir = dirOf(p.team), mv = Math.hypot(ix, iy) > 0.25, has = ball.owner === m.ctrl;
    power = clamp(power, 0, 1);
    if (a === 'degis' || (a === 'pas' && !has)) {
      let bi = m.ctrl, bd = 1e9; pls.forEach((q, i) => { if (q.team === human && !q.gk && i !== m.ctrl) { const d = Math.hypot(q.x - ball.x, q.y - ball.y); if (d < bd) { bd = d; bi = i; } } }); m.ctrl = bi; m.switchT = 1.2;
      return;
    }
    if (a === 'calim') {
      if (p.cd2 > 0) return;
      if (has && Math.hypot(ball.x - p.x, ball.y - p.y) < 1.3) calim(p, mv ? ix : 0, mv ? iy : 0);
      else { p.boost = 0.35; p.cd2 = 1.0; if (mv) { p.fx = ix / Math.hypot(ix, iy); p.fy = iy / Math.hypot(ix, iy); } sfx('puff'); }
      return;
    }
    if (has && a !== 'kap' && Math.hypot(ball.x - p.x, ball.y - p.y) > 1.5) { m.bekleyen = { a, power, uzun, t: 0.5 }; return; }
    if (!has) { if ((a === 'sut' || a === 'kap') && p.kickCd <= 0) { const d = Math.hypot(ball.x - p.x, ball.y - p.y); p.vx += (ball.x - p.x) / (d || 1) * 3; p.vy += (ball.y - p.y) / (d || 1) * 3; tackle(m.ctrl); } return; }
    if (a === 'sut') {
      if (ix * dir < -0.5 && Math.abs(ix) > Math.abs(iy)) { kick(p, ix, iy, 16 + power * 8, 'sut', 2 + power * 3); return; }   // facing away: clear it
      const gx = goalX(p.team), keeper = pls.find(q => q.gk && q.team !== p.team)!, half = (M1 - M0) / 2;
      const side = Math.abs(iy) > 0.25 ? Math.sign(iy) : (keeper.y > WD / 2 ? -1 : 1);
      const press = nearestOpp(p), dGoal = Math.hypot(gx - p.x, WD / 2 - p.y);
      const aim = WD / 2 + side * (half - 0.4) + (R() - 0.5) * (0.5 + power * power * 2.6 * (1.2 - p.sk.shoot * 0.6) + dGoal * 0.1 + (press < 1.4 ? 1.2 : 0));
      kick(p, gx + dir * 0.5 - p.x, aim - p.y, 13 + power * 13, 'sut', 0.3 + power * 2.2 + R() * power * power * 2.2);
    } else if (a === 'kap') return;
    else {
      const fx = mv ? ix : p.fx, fy = mv ? iy : p.fy, [q] = passOption(p, fx, fy, true);
      if (a === 'uzun') { if (q) loft(p, q.x + q.vx * 0.6, q.y + q.vy * 0.6); else loft(p, clamp(p.x + fx * 16, 1, L - 1), clamp(p.y + fy * 16, 1, WD - 1)); if (q) { m.ctrl = pls.indexOf(q); m.switchT = 1.2; } return; }
      if (q) {
        let tx = q.x + q.vx * 0.45, ty = q.y + q.vy * 0.45;
        if (uzun) { tx = clamp(q.x + dir * 4 + q.vx * 0.5, 1, L - 1); ty = clamp(q.y + q.vy * 0.5, 1, WD - 1); }
        const d = len(tx - p.x, ty - p.y);
        kick(p, tx - p.x, ty - p.y, clamp(d * (uzun ? 1.25 : 1.6) + 5, 8, uzun ? 17 : 19), 'pas'); m.ctrl = pls.indexOf(q); m.switchT = 1.0;
      } else kick(p, fx, fy, uzun ? 15 : 11, 'pas');
    }
  }

  /** FUT-02 kötü kontrol: hızlı gelen topu becerisi zayıf ve baskı altındaki oyuncu sektirir (top serbest kalır, pres tetiklenir). */
  function badTouch(p: Pl, bs: number): boolean {
    if (p.gk || bs < 9) return false;
    const touch = (p.sk.pass + p.sk.flair) / 2, chance = clamp((bs - 9) * 0.035 + (1 - touch) * 0.25 + (nearestOpp(p) < 1.5 ? 0.1 : 0) - 0.12, 0, 0.6);
    if (R() >= chance) return false;
    const a = (R() - 0.5) * 2.2, c = Math.cos(a), s = Math.sin(a), k = 0.3 + R() * 0.25;
    const vx = ball.vx * k, vy = ball.vy * k; ball.vx = vx * c - vy * s; ball.vy = vx * s + vy * c; ball.lastTouch = p.team; p.kickCd = 0.3; m.pass = null;
    return true;
  }

  function take(i: number, tackled = false) {   // player i gains the ball
    const p = pls[i], prev = ball.owner;
    if (m.pass) { if (p.team === m.pass.team && i !== m.pass.from) { pls[m.pass.from].st.passesOk++; m.lastPasser = m.pass.from; m.lastPasserT = m.clock; } m.pass = null; }
    if (m.shot && p.gk && p.team !== m.shot.team) { p.st.saves++; emit({ k: 'save', team: p.team }); }
    m.shot = null; ball.owner = i; ball.lastTouch = p.team; ball.z = 0; ball.vz = 0; p.hold = 0; p.touch = 0.15; p.st.touches++; if (tackled && prev >= 0) p.st.tackles++;
  }

  /**
   * Top sürme (FUT-03 dokun-kovala): top ayağa yapışık değil. Taşıyıcı topa 0.8 m'den yakınken dokunur, top istenen yöne koşu
   * hızından biraz hızlı çıkar ve yavaşlar; aradaki mesafe ~0.6-1.4 m salınır. Yavaş/duran taşıyıcı topu ayağında tutar (korur).
   * Top 2.4 m'den fazla açılırsa sahiplik biter (serbest top).
   */
  function carryBall(o: Pl, oi: number, dt: number) {
    const rx = ball.x - o.x, ry = ball.y - o.y, d = Math.hypot(rx, ry), sp = Math.hypot(o.vx, o.vy);
    o.touch = Math.max(0, o.touch - dt);
    const taker = m.restart && m.restart.taker === oi;
    if ((taker || sp < 1.2) && d < 1.2) {
      const k = Math.min(1, dt * 10); ball.x += (o.x + o.fx * 0.55 - ball.x) * k; ball.y += (o.y + o.fy * 0.55 - ball.y) * k; ball.vx = o.vx; ball.vy = o.vy; return;
    }
    if (o.touch <= 0 && d < 0.8) {
      let dx: number, dy: number;
      if (isHuman(oi)) { const { ix, iy } = m.input; if (Math.hypot(ix, iy) > 0.25) { dx = ix; dy = iy; } else { dx = o.fx; dy = o.fy; } } else { dx = o.tx - o.x; dy = o.ty - o.y; }
      const dl = len(dx, dy), u = 2.6 + (o.boost > 0 ? 0.6 : 0); ball.vx = dx / dl * (sp + u); ball.vy = dy / dl * (sp + u); o.touch = 0.26; o.st.touches++; ball.lastKicker = oi; ball.lastTouch = o.team;
    }
    const bs = Math.hypot(ball.vx, ball.vy); if (bs > 0) { const nb = Math.max(0, bs - 5.5 * dt) / bs; ball.vx *= nb; ball.vy *= nb; }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (d > 2.4) { ball.owner = -1; m.pass = null; }
  }

  /** Top kale çizgisini / taç çizgisini geçti mi: gol, direk, üst direk, aut, korner, taç. true = oyun durdu ya da yön değişti. */
  function lines(px: number, py: number): boolean {
    for (const gx of [0, L]) for (const gy of [M0, M1]) {   // direkler
      const dx = ball.x - gx, dy = ball.y - gy, d = Math.hypot(dx, dy);
      if (d < POST_HIT && ball.z < GH) {
        const nx = dx / (d || 1), ny = dy / (d || 1), vn = ball.vx * nx + ball.vy * ny;
        if (vn < 0) { ball.vx -= 1.7 * vn * nx; ball.vy -= 1.7 * vn * ny; ball.x = gx + nx * POST_HIT; ball.y = gy + ny * POST_HIT; emit({ k: 'post' }); sfx('post'); m.shot = null; }
      }
    }
    if (ball.y < 0 || ball.y > WD) { setPiece('tac', ball.lastTouch === 0 ? 1 : 0, ball.x, ball.y < 0 ? 0 : WD); return true; }
    const right = ball.x > L, left = ball.x < 0;
    if (!right && !left) return false;
    const gx = right ? L : 0, t = (gx - px) / ((ball.x - px) || 1e-6), yc = py + (ball.y - py) * t, inMouth = yc > M0 && yc < M1;
    if (inMouth && Math.abs(ball.z - GH) < 0.13) {   // üst direk
      ball.x = gx + (right ? -0.12 : 0.12); ball.vx = -ball.vx * 0.55; ball.vz = -Math.abs(ball.vz) * 0.4; emit({ k: 'post' }); sfx('post'); m.shot = null; return true;
    }
    if (inMouth && ball.z < GH) { ball.owner = -1; goal(right ? 0 : 1); return true; }
    const att: 0 | 1 = right ? 0 : 1, def: 0 | 1 = right ? 1 : 0;
    m.pass = null; ball.owner = -1;
    if (ball.lastTouch === att) setPiece('kale', def, ball.x, ball.y); else setPiece('korner', att, right ? L : 0, ball.y);
    return true;
  }

  /** Gol sonrası top ağda yavaşlar ve durur (ağ derinliği GD, üst direk GH). */
  function netBall(dt: number) {
    if (ball.x >= 0 && ball.x <= L) return;
    const right = ball.x > L, f = Math.exp(-7 * dt);
    ball.vx *= f; ball.vy *= f; ball.vz -= G * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
    if (ball.z < 0) { ball.z = 0; ball.vz = -ball.vz * 0.3; }
    if (ball.z > GH - 0.12) { ball.z = GH - 0.12; ball.vz = 0; }
    const back = right ? L + GD - 0.12 : -GD + 0.12; if (right ? ball.x > back : ball.x < back) { ball.x = back; ball.vx = -ball.vx * 0.15; }
    ball.y = clamp(ball.y, M0 + 0.12, M1 - 0.12);
  }

  /** Hakem topu çaprazdan, 3 m geriden ve 5 m yandan izler; duran topta karar yerine yürür. */
  function refStep(dt: number) {
    const r = m.ref, rx = clamp(ball.x - (ball.vx >= 0 ? 3 : -3), 2, L - 2), ry = ball.y < WD / 2 ? clamp(ball.y + 5, 2, WD - 1) : clamp(ball.y - 5, 1, WD - 2);
    const dx = rx - r.x, dy = ry - r.y, d = Math.hypot(dx, dy), want = d > 0.3 ? Math.min(6, d * 2) : 0;
    r.vx += ((d > 0 ? dx / d * want : 0) - r.vx) * Math.min(1, dt * 5); r.vy += ((d > 0 ? dy / d * want : 0) - r.vy) * Math.min(1, dt * 5);
    r.x += r.vx * dt; r.y += r.vy * dt;
    if (r.t > 0) { r.t -= dt; if (r.t <= 0) { r.t = 0; r.signal = ''; } }
  }

  /** Olaylar bir adım boyunca m.events'te durur; adımlar arasında act() ile çıkan olaylar (müdahale, faul, vuruş sesi) da sonraki adımın listesine girer. */
  let seen = 0;
  function step(dt: number) { m.events.splice(0, seen); stepIn(dt); heatStep(dt); seen = m.events.length; }
  /** Tribün heyecanı: topun kaleye yakınlığı taban, olaylar sıçratır, yavaşça söner. */
  function heatStep(dt: number) {
    let up = 0;
    for (let k = seen; k < m.events.length; k++) { const e = m.events[k]; up += e.k === 'goal' ? 1 : e.k === 'post' || e.k === 'save' ? 0.35 : e.k === 'foul' ? (e.pen ? 0.5 : 0.12) : e.k === 'sfx' && e.id === 'kick' ? 0.2 : 0; }
    const dGoal = Math.min(Math.hypot(ball.x, ball.y - WD / 2), Math.hypot(L - ball.x, ball.y - WD / 2)), base = 0.12 + clamp((14 - dGoal) / 14, 0, 1) * 0.4;
    m.heat = clamp(Math.max(base, m.heat - dt * 0.12) + up, 0, 1);
  }
  function stepIn(dt: number) {
    if (m.bannerT > 0) m.bannerT -= dt;
    for (const p of pls) if (p.actT > 0) { p.actT -= dt; if (p.actT <= 0) { p.actT = 0; p.act = ''; } }
    for (let k = m.timers.length - 1; k >= 0; k--) { m.timers[k].t -= dt; if (m.timers[k].t <= 0) { const f = m.timers[k].fn; m.timers.splice(k, 1); f(); } }
    refStep(dt);
    if (m.freeze > 0) { m.freeze -= dt; netBall(dt); return; }
    if (m.restart) { m.restart.t += dt; if (human !== null && m.restart.taker === m.ctrl && m.restart.t > 6 && ball.owner === m.ctrl) act(m.restart.kind === 'penalti' ? 'sut' : 'pas', 0.6); }
    if (m.over) return;
    m.clock += dt; if (m.shot) { m.shot.t -= dt; if (m.shot.t <= 0) m.shot = null; }
    if (ball.owner >= 0) m.poss[pls[ball.owner].team] += dt;
    if (m.half === 1 && m.clock >= HALF) { m.half = 2; sfx('whistleLong'); say('Devre arası', 2); kickoff(1); m.freeze = 2; return; }
    if (m.half === 2 && m.clock >= HALF * 2) { m.over = true; sfx('whistleLong'); if (human !== null && m.score[human] > m.score[1 - human]) sfx('crowdCheer'); emit({ k: 'end' }); return; }
    // human: auto-switch to the mate nearest a loose / enemy ball
    if (human !== null) {
      const b = m.bekleyen;
      if (b) { b.t -= dt; if (b.t <= 0 || ball.owner !== m.ctrl) m.bekleyen = null; else if (Math.hypot(ball.x - pls[m.ctrl].x, ball.y - pls[m.ctrl].y) <= 1.5) { m.bekleyen = null; act(b.a, b.power, b.uzun); } }
      m.switchT -= dt;
      if (m.switchT <= 0 && ball.owner !== m.ctrl && !(ball.owner >= 0 && pls[ball.owner].team === human)) {
        let bi = m.ctrl, bd = Math.hypot(pls[m.ctrl].x - ball.x, pls[m.ctrl].y - ball.y) - 1.5;
        pls.forEach((q, i) => { if (q.team === human && !q.gk) { const d = Math.hypot(q.x - ball.x, q.y - ball.y); if (d < bd) { bd = d; bi = i; } } });
        if (bi !== m.ctrl) { m.ctrl = bi; m.switchT = 0.5; }
      }
      if (ball.owner >= 0 && pls[ball.owner].team === human && ball.owner !== m.ctrl && !pls[ball.owner].gk) m.ctrl = ball.owner;
    }
    m.planT -= dt; if (m.planT <= 0) { m.planT = 0.12 + R() * 0.06; plan(); }
    else if (m.shot && ball.owner < 0) for (let i = 0; i < pls.length; i++) if (pls[i].gk && !isHuman(i)) kaleciPlan(pls[i], null);   // şuta her karede tepki
    const carrier = ball.owner >= 0 ? pls[ball.owner] : null;
    pls.forEach((p, i) => {
      p.kickCd = Math.max(0, p.kickCd - dt); p.cd2 = Math.max(0, p.cd2 - dt); p.boost = Math.max(0, p.boost - dt);
      const bm = p.boost > 0 ? 1.3 : 1;
      if (p.dive > 0) { p.dive -= dt; p.vy = p.diveDir * Math.abs(p.vy); p.vx *= 0.85; if (p.dive <= 0) { p.dive = 0; p.vy *= 0.2; p.stun = 0.3; } }
      else if (p.stun > 0) { p.stun -= dt; p.vx *= 0.9; p.vy *= 0.9; }
      else if (m.restart && m.restart.taker === i) { p.vx = 0; p.vy = 0; if (!isHuman(i)) carrierAI(p, i, dt); }
      else if (isHuman(i)) {
        let ix = m.input.ix, iy = m.input.iy; const idle = Math.hypot(ix, iy) < 0.3;
        // pas insana gelirken çubuk boştaysa alıcı topa kendisi koşar; topu sürerken çubuk boştaysa topa adım atar
        if (idle && ball.owner < 0 && m.pass && m.pass.team === p.team) {
          const lt = clamp(Math.hypot(ball.x - p.x, ball.y - p.y) / 9, 0, 0.8), dx = ball.x + ball.vx * lt - p.x, dy = ball.y + ball.vy * lt - p.y, d = Math.hypot(dx, dy);
          if (d > 0.3) { ix = dx / d; iy = dy / d; }
        } else if (idle && ball.owner === i) { const dx = ball.x - p.x, dy = ball.y - p.y, d = Math.hypot(dx, dy); if (d > 0.7) { ix = dx / d * 0.5; iy = dy / d * 0.5; } }
        if (p.boost > 0 && Math.hypot(ix, iy) < 0.3) { ix = p.fx; iy = p.fy; }
        const spd = (ball.owner === i ? 6.7 : 7.1) * bm; p.vx += (ix * spd - p.vx) * Math.min(1, dt * 10); p.vy += (iy * spd - p.vy) * Math.min(1, dt * 10);
      }
      else {
        if (ball.owner === i && !p.gk) carrierAI(p, i, dt);
        else if (ball.owner === i && p.gk) { p.tx = p.x; p.ty = p.y; p.spd = 0; p.think -= dt; if (p.think <= 0 && p.kickCd <= 0) { const [q] = passOption(p); if (q) kick(p, q.x - p.x, q.y - p.y, clamp(len(q.x - p.x, q.y - p.y) * 1.4 + 6, 10, 18), 'pas'); else kick(p, dirOf(p.team), 0, 13, 'pas'); } }
        else if (carrier && carrier.team !== p.team && !p.gk && !m.restart && p.kickCd <= 0 && Math.hypot(ball.x - p.x, ball.y - p.y) < 1.1) {
          // müdahale kararı: önden/yandan istekli; arkadan (faul riski) nadiren, becerisiz oyuncu daha sık dener
          const dc = len(p.x - carrier.x, p.y - carrier.y), bh = ((p.x - carrier.x) * carrier.fx + (p.y - carrier.y) * carrier.fy) / dc < -0.35;
          if (R() < dt * (1.6 + p.sk.tackle * 2.4) * (bh ? 0.9 + (1 - p.sk.tackle) * 1.2 : 1)) tackle(i);
        }
        let tx = p.tx, ty = p.ty;
        if (ball.owner === i && Math.hypot(ball.x - p.x, ball.y - p.y) > 0.6) { tx = ball.x + ball.vx * 0.15; ty = ball.y + ball.vy * 0.15; }   // topu kovala
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), want = d > 0.15 ? Math.min(p.spd * bm, d * 3) : 0;
        p.vx += ((d > 0 ? dx / d * want : 0) - p.vx) * Math.min(1, dt * 7); p.vy += ((d > 0 ? dy / d * want : 0) - p.vy) * Math.min(1, dt * 7);
      }
      const ox = p.x, oy = p.y;
      p.x = clamp(p.x + p.vx * dt, 0.4, L - 0.4); p.y = clamp(p.y + p.vy * dt, 0.4, WD - 0.4); p.st.dist += Math.hypot(p.x - ox, p.y - oy);
      if (p.gk && !isHuman(i)) { const og = ownX(p.team), x1 = og + dirOf(p.team) * (BOX_D - 0.4); p.x = clamp(p.x, Math.min(og, x1), Math.max(og, x1)); p.y = clamp(p.y, BOX_Y0 + 0.4, BOX_Y1 - 0.4); }
      const s = Math.hypot(p.vx, p.vy); if (s > 0.6 && p.dive <= 0) { p.fx = p.vx / s; p.fy = p.vy / s; }
    });
    for (let a = 0; a < pls.length; a++) for (let b = a + 1; b < pls.length; b++) {
      const A = pls[a], B = pls[b], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
      if (d < 0.9 && d > 1e-4) { const k = (0.9 - d) / 2; A.x -= dx / d * k; A.y -= dy / d * k; B.x += dx / d * k; B.y += dy / d * k; }
    }
    // ball
    const px = ball.x, py = ball.y;
    if (ball.owner >= 0) {
      const oi = ball.owner, o = pls[oi]; carryBall(o, oi, dt);
      if (lines(px, py)) return;
      // açıkta kalan top (taşıyıcıdan >0.9 m): rakip topa taşıyıcıdan yakınsa kapar (geometrik, zar yok)
      if (ball.owner === oi && !m.restart && !o.gk) {
        const exp = Math.hypot(ball.x - o.x, ball.y - o.y);
        if (exp > 0.9) for (let qi = 0; qi < pls.length; qi++) { const q = pls[qi]; if (q.team !== o.team && q.stun <= 0 && q.kickCd <= 0 && !q.gk && Math.hypot(q.x - ball.x, q.y - ball.y) < Math.min(0.55, exp - 0.3)) { take(qi, true); sfx('kick'); break; } }
      }
    } else {
      // serbest top: yerde sürtünme, havada yerçekimi + hafif hava direnci, yere çarpınca sekme
      if (ball.z > 0 || ball.vz > 0) {
        ball.vz -= G * dt; ball.z += ball.vz * dt; const f = Math.exp(-0.12 * dt); ball.vx *= f; ball.vy *= f;
        if (ball.z <= 0) { ball.z = 0; if (ball.vz < -1.5) { ball.vz = -ball.vz * 0.45; ball.vx *= 0.85; ball.vy *= 0.85; } else ball.vz = 0; }
      } else { const f = Math.exp(-1.15 * dt); ball.vx *= f; ball.vy *= f; }
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (lines(px, py)) return;
      const bs = Math.hypot(ball.vx, ball.vy);
      for (let i = 0; i < pls.length; i++) {
        const p = pls[i]; if (p.kickCd > 0 || p.stun > 0) continue;
        const hands = p.gk && inBox(p.team, p.x, p.y), d = Math.hypot(p.x - ball.x, p.y - ball.y), reach = hands ? (p.dive > 0 ? 1.6 : 1.25) : 0.75;
        if (d >= reach || ball.z > (hands ? GH + 0.35 : 1.2)) continue;
        if (hands && bs > 11 && m.shot && m.shot.team !== p.team) {   // a real shot on the keeper: catch or parry by speed and skill
          // tut / yumrukla / kaçır: hız, vücuttan uzaklık (dalışta gövde uzanır), yükseklik ve beceri
          const dd = p.dive > 0 ? Math.max(0, d - 0.9) : d, sv = clamp(1.05 - (bs - 10) * 0.035 - Math.max(0, dd - 0.45) * 0.9 - Math.max(0, ball.z - 1.6) * 0.5 + (p.sk.gk - 0.5) * 0.8, 0.1, 0.95), u = R();
          if (u >= sv) { p.kickCd = 0.3; continue; }
          if (u > sv * 0.55 || bs > 21) { ball.vx = R() < 0.35 ? ball.vx * 0.5 : -ball.vx * 0.3 + (R() - 0.5) * 6; ball.vy = (R() - 0.5) * 9; ball.vz = R() * 2.5; p.kickCd = 0.4; p.st.saves++; m.shot = null; ball.lastTouch = p.team; emit({ k: 'save', team: p.team }); sfx('post'); sfx('crowdOoh'); break; }
          sfx('crowdOoh');
        }
        if (!hands && badTouch(p, bs)) break;
        if (bs < 15 || hands || R() < 0.35 + p.sk.pace * 0.2) {
          take(i); if (hands) { p.kickCd = 0.6; p.think = 0.7; p.dive = 0; }
          break;
        }
      }
    }
    if (m.restart && ball.owner !== m.restart.taker) m.restart = null;
  }

  function teamStats(team: 0 | 1) {
    const mine = pls.filter(p => p.team === team), sum = (k: keyof Stats) => mine.reduce((s, p) => s + p.st[k], 0), tot = m.poss[0] + m.poss[1] || 1;
    return { goals: m.score[team], shots: sum('shots'), onTarget: sum('onTarget'), passes: sum('passes'), passesOk: sum('passesOk'), tackles: sum('tackles'), saves: sum('saves'), corners: m.corners[team], possession: Math.round(m.poss[team] / tot * 100), dist: sum('dist') };
  }
  kickoff(0);
  return m;
}
export type Match = ReturnType<typeof createMatch>;
