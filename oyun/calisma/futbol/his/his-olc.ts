// Halı saha "his" ölçümü (2026-11-21): insan politikası + bot maçları, 60 Hz sabit adım, oynanış hissi metrikleri.
// npx vite-node calisma/futbol/his/his-olc.ts [mac_sayisi]
import { createMatch, L, WD, type Match } from '../../../src/game/sim/macmotor';
const N = +(process.argv[2] || 6), DT = 1 / 60;
type Acc = Record<string, number>;
const add = (a: Acc, k: string, v = 1) => { a[k] = (a[k] || 0) + v; };
function insanPolitika(M: Match, t: number, s: { fT: number; f: boolean }) {
  const me = M.pls[M.ctrl], bl = M.ball, has = bl.owner === M.ctrl;
  let tx: number, ty: number; if (has) { tx = L; ty = WD / 2; } else { tx = bl.x + bl.vx * 0.2; ty = bl.y + bl.vy * 0.2; }
  const dx = tx - me.x, dy = ty - me.y, d = Math.hypot(dx, dy) || 1; M.input.ix = Math.abs(dx) > 0.4 ? Math.sign(dx) : 0; M.input.iy = Math.abs(dy) > 0.4 ? Math.sign(dy) : 0;
  const m = Math.hypot(M.input.ix, M.input.iy); if (m > 1) { M.input.ix /= m; M.input.iy /= m; }
  M.input.kos = d > 4;
  if (has && L - me.x < 12 && t - s.fT > 1) { M.act('sut', 0.45); s.fT = t; }
  else if (has && Math.random() < 0.01) M.act('pas', 0.5);
  else if (!has && bl.owner >= 0 && M.pls[bl.owner].team === 1 && Math.hypot(bl.x - me.x, bl.y - me.y) < 1.4 && Math.random() < 0.05) M.act('sut');
}
const A: Acc = {}; let steps = 0;
for (let n = 0; n < N; n++) {
  const human = n % 2 === 0 ? 0 : null;
  const M = createMatch({ seed: 100 + n, human: human as 0 | null, humanSlot: 3, halfS: 75 });
  const prev = M.pls.map(p => ({ yaw: Math.atan2(p.fx, p.fy), vx: 0, vy: 0, act: '' }));
  const s = { fT: -9, f: false }; let t = 0, lastOwner = -1, ownT = 0;
  while (!M.over && t < 200) {
    if (human !== null) insanPolitika(M, t, s);
    M.step(DT); t += DT; steps++;
    for (const e of M.events) { const k = e.k === 'sfx' ? 'sfx:' + e.id : e.k; add(A, 'ev:' + k); }
    if (M.freeze > 0) continue;
    add(A, 'oyunAdim');
    M.pls.forEach((p, i) => {
      const yaw = Math.atan2(p.fx, p.fy), pv = prev[i]; let dyaw = Math.abs(yaw - pv.yaw); if (dyaw > Math.PI) dyaw = 2 * Math.PI - dyaw;
      if (dyaw > Math.PI / 3) add(A, 'donus>60/adim'); if (dyaw > Math.PI / 2) add(A, 'donus>90/adim');
      add(A, 'donusToplam', dyaw);
      const sp = Math.hypot(p.vx, p.vy), psp = Math.hypot(pv.vx, pv.vy);
      if (sp > 1 && psp > 1 && (p.vx * pv.vx + p.vy * pv.vy) / (sp * psp) < 0) add(A, 'hizTersAdim');
      if (p.act === 'tackle' && pv.act !== 'tackle') add(A, 'mudahaleDeneme');
      if (p.stun > 0) add(A, 'sersemAdim'); if (p.dive > 0) add(A, 'dalisAdim');
      if (p.act === 'tackle') add(A, 'tackleAdim');
      add(A, 'oyuncuAdim'); add(A, 'hizToplam', sp); if (sp > 6.5) add(A, 'hiz>6.5');
      pv.yaw = yaw; pv.vx = p.vx; pv.vy = p.vy; pv.act = p.act;
    });
    for (let a = 0; a < M.pls.length; a++) for (let b = a + 1; b < M.pls.length; b++) if (Math.hypot(M.pls[a].x - M.pls[b].x, M.pls[a].y - M.pls[b].y) < 0.85) add(A, 'ustUste');
    const o = M.ball.owner;
    if (o !== lastOwner) { if (lastOwner >= 0 && o >= 0 && M.pls[o].team !== M.pls[lastOwner].team) add(A, 'topDegisti'); if (lastOwner >= 0) { add(A, 'sahiplikSure', ownT); add(A, 'sahiplikSay'); } ownT = 0; lastOwner = o; } else if (o >= 0) ownT += DT;
    if (o >= 0) { const c = M.pls[o], d = Math.hypot(M.ball.x - c.x, M.ball.y - c.y); add(A, 'topMesafe', d); add(A, 'topSahipAdim'); if (d > 1.5) add(A, 'topUzak>1.5'); }
    if (human !== null) { add(A, 'insanAdim'); if (M.ball.owner === M.ctrl) add(A, 'insanTopta'); }
  }
  add(A, 'gol', M.score[0] + M.score[1]); add(A, 'mac');
  const ts = [M.teamStats(0), M.teamStats(1)]; add(A, 'sut', ts[0].shots + ts[1].shots); add(A, 'pas', ts[0].passes + ts[1].passes); add(A, 'pasOk', ts[0].passesOk + ts[1].passesOk);
}
const sec = (A.oyunAdim || 1) * DT, ps = (A.oyuncuAdim || 1);
const r = {
  mac: A.mac, golMac: (A.gol / A.mac).toFixed(2), sutMac: (A.sut / A.mac).toFixed(1), pasIsabet: (A.pasOk / A.pas).toFixed(2),
  'oyuncu başı sn başı >60° yön sıçraması': ((A['donus>60/adim'] || 0) / ps * 60).toFixed(3),
  'oyuncu başı sn başı ortalama dönüş (°/sn)': ((A.donusToplam / ps) * 60 * 180 / Math.PI).toFixed(1),
  'hız ters dönüş /oyuncu/dk': ((A.hizTersAdim || 0) / ps * 3600).toFixed(2),
  'müdahale denemesi /dk (tüm saha)': ((A.mudahaleDeneme || 0) / sec * 60).toFixed(1),
  'tackle pozunda oyuncu oranı': ((A.tackleAdim || 0) / ps).toFixed(3),
  'sersem oyuncu oranı': ((A.sersemAdim || 0) / ps).toFixed(3),
  'dalış /dk': ((A.dalisAdim || 0) * DT / 0.45 / sec * 60).toFixed(2),
  'üst üste çift oranı /adim': ((A.ustUste || 0) / A.oyunAdim).toFixed(3),
  'top el değiştirme /dk': ((A.topDegisti || 0) / sec * 60).toFixed(1),
  'ortalama sahiplik (sn)': ((A.sahiplikSure || 0) / (A.sahiplikSay || 1)).toFixed(2),
  'taşıyıcı-top ort mesafe': ((A.topMesafe || 0) / (A.topSahipAdim || 1)).toFixed(2),
  'insan topta oranı': ((A.insanTopta || 0) / (A.insanAdim || 1)).toFixed(3),
  'ort hız m/s': (A.hizToplam / ps).toFixed(2),
  'faul /mac': ((A['ev:foul'] || 0) / A.mac).toFixed(1), 'kurtarış /mac': ((A['ev:save'] || 0) / A.mac).toFixed(1),
};
console.log(JSON.stringify(r, null, 1));
