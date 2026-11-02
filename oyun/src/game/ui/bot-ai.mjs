/* Martı Motoru M1 bot AI (Builder D). Port of the v2 test/bot.js in-page player AI, 1:1 decisions, run against a thin
   adapter `B` so the same code drives the headless sim (tests/sim/first-session.test.ts) and the real page
   (tests/browser/bot-m1.mjs, injected as window.makeBot). Plain ESM JS, not bundled into the game.

   Adapter B (all sync):
     state() -> v2 state shape (sim.rules.v2State())     input(x, z)      path(from, to) -> [{x,z}]
     claimOrder(id)   panelModel(id)   upgradeTier(id)   decorBuy(id)   saveSign(text, font)   signSet() -> bool
     skipCeremony()   tapSlow()        solution() -> {cost,...}|null      acceptSolution()
     jobBoardModel() -> {candidates:[{id,name,role,rarity,legend,price,canHire}]}   hireCandidate(id)
   Dwell rule: a station/counter acts only after the player stood still ~0.4 s; go() stops inside the radius and the
   task cases below wait there, so this bot plays by the same rules as a human. */
export function makeBot(B) {
  const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const M = { task: null, notes: [], hires: [], gullMode: 0, lastBoard: -999, petT: 0, stillT: 0, upT: 0, s: null };
  let path = null, pathTo = null, pathT = 0, last = null, stuckT = 0, taskT = 0, wait = 0;
  function go(at, r) {
    const s = M.s, p = s.pos;
    if (d2(p, at) < (r || 0.25)) { B.input(0, 0); return true; }
    pathT -= 0.1;
    if (!path || !pathTo || d2(pathTo, at) > 0.1 || pathT <= 0) { path = B.path(p, at); pathTo = { x: at.x, z: at.z }; pathT = 1.2; }
    while (path.length > 1 && d2(p, path[0]) < 0.35) path.shift();
    const w = path[0] || at, dx = w.x - p.x, dz = w.z - p.z, L = Math.hypot(dx, dz) || 1;
    const k = path.length <= 1 ? Math.max(0.4, Math.min(1, L / 0.6)) : 1;
    B.input(dx / L * k, dz / L * k);
    if (last && d2(last, p) < 0.01) { stuckT += 0.1; if (stuckT > 1.2) { B.input(-dz / L, dx / L); pathT = 0; stuckT = 0; M.notes.push('stuck@' + s.t); } } else stuckT = 0;
    last = { x: p.x, z: p.z };
    return false;
  }
  const station = k => M.s.anchors.stations[k];
  function want() {
    const s = M.s, w = {};
    s.queue.slice(0, 5).forEach(c => { for (const k in c.need) w[k] = (w[k] || 0) + c.need[k]; });
    for (const k in w) w[k] -= (s.counter[k] || 0);
    return w;
  }
  function choose() {
    const s = M.s, w = want(), carry = s.carry, has = p => carry.includes(p);
    if (s.kap && s.kap.state === 'run') return { kind: 'chase', at: s.kap.pos, r: 0.6, dyn: true };
    if (s.cat && s.cat.state === 'rub') return { kind: 'pet', at: s.pos, still: true };
    if (s.gull && s.gull.mode === 'stare' && M.gullMode % 2 === 0) return { kind: 'gull', at: s.gull.pos, r: 1.3 };
    if (s.sleeper) return { kind: 'wake', at: s.sleeper, r: 1.0 };
    if (s.window && s.window.open && s.window.t > 2) {
      const front = s.winq.find(c => c.state === 'wqueue') || s.winq[0];
      const need = front ? Object.keys(front.need) : [];
      const winNeeds = {}; s.winq.forEach(c => { for (const k in c.need) winNeeds[k] = (winNeeds[k] || 0) + c.need[k]; });
      if (need.length && need.some(has)) return { kind: 'window', at: s.anchors.window, r: 0.5 };
      if (front && carry.length < s.cap) { const p = Object.keys(winNeeds).find(k => s.built.includes(k)) || need[0]; if (p && s.built.includes(p)) return { kind: 'station', at: station(p), k: p, need: Math.min(s.cap - carry.length, winNeeds[p] || 1), r: 0.3, forWindow: true }; }
    }
    const sp = s.reg && s.reg.state === 'wait' ? s.reg : s.vip && s.vip.state === 'wait' ? s.vip : null;
    if (sp) {
      const miss = []; const cc = carry.slice();
      for (const k in sp.need) for (let i = 0; i < sp.need[k]; i++) { const j = cc.indexOf(k); if (j >= 0) cc.splice(j, 1); else miss.push(k); }
      if (!miss.length) return { kind: 'special', at: sp.pos, r: 1.6 };
      if (carry.length < s.cap && s.built.includes(miss[0])) return { kind: 'station', at: station(miss[0]), k: miss[0], need: miss.filter(x => x === miss[0]).length + (carry.filter(x => x === miss[0]).length), r: 0.3, forSpecial: true };
    }
    // first hire as soon as the job board exists (a player hires Rıza right away; GDD 08:00)
    if (s.owned.includes('isbul') && s.workers.length === 0 && s.t - M.lastBoard > 90 && !carry.length) return { kind: 'board', at: s.anchors.job, r: 0.5 };
    // an affordable pad with empty hands: buy it now (a busy queue must not starve the unlocks)
    if (!carry.length) { const pd = s.pads.filter(q => q.key !== 'tadilat' || s.stars >= 1).find(q => s.money >= q.price - q.paid); if (pd) return { kind: 'pad', at: pd.pos, key: pd.key, r: 0.2 }; }
    const frontNeed = [];
    s.queue.slice(0, 3).forEach(c => { for (const k in c.need) if (!(s.counter[k] > 0) && !frontNeed.includes(k) && s.built.includes(k)) frontNeed.push(k); });
    const canDrop = p => (s.counter[p] || 0) < 8;
    if (carry.some(p => frontNeed.includes(p) && canDrop(p))) return { kind: 'counter', at: s.anchors.counter, r: 0.4 };
    if (frontNeed.length && carry.length < s.cap) { const p = frontNeed[0]; return { kind: 'station', at: station(p), k: p, need: Math.max(1, Math.min(s.cap - carry.length, (w[p] || 1))), r: 0.3 }; }
    if (carry.some(p => canDrop(p) && (w[p] || 0) > -3) || (carry.length >= s.cap && carry.some(canDrop))) return { kind: 'counter', at: s.anchors.counter, r: 0.4 };
    const padOk = s.pads.filter(pd => pd.key !== 'tadilat' || s.stars >= 1).sort((a, b) => (a.price - a.paid) - (b.price - b.paid));
    for (const pd of padOk) {
      const left = pd.price - pd.paid;
      if (s.money >= left) return { kind: 'pad', at: pd.pos, key: pd.key, r: 0.2 };
      if (s.money + s.kasaValue >= left && s.kasaPile) return { kind: 'kasa', at: s.anchors.kasa, r: 0.6 };
    }
    if (s.kasaPile >= 4 || (s.kasaPile && !s.queue.length)) return { kind: 'kasa', at: s.anchors.kasa, r: 0.6 };
    const openRoles = s.workers.length < 6;
    if (s.owned.includes('isbul') && openRoles && s.t - M.lastBoard > 90 && (s.workers.length === 0 || (s.t > 800 && s.money > 2600))) return { kind: 'board', at: s.anchors.job, r: 0.5 };
    const tp = s.tablePiles.find(t => t.n >= 2 || t.dirty);
    if (tp && carry.length < 2) return { kind: 'table', at: tp.pos, r: 1.2 };
    if (s.floor.length) return { kind: 'floor', at: s.floor[0], r: 0.4 };
    let best = null, bs = -1;
    for (const k of s.built) {
      const helper = s.workers.some(x => x.role !== 'garson' && x.role !== 'temizlik' && { doner: 'doner', cay: 'cay', tost: 'tost' }[k] === x.role);
      let sc = (w[k] || 0) + (s.out[k] >= 4 ? 2 : 0) - (helper && !s.out[k] ? 2 : 0);
      if (sc > bs) { bs = sc; best = k; }
    }
    if (best && bs > 0 && carry.length < s.cap && !(carry.length && !carry.some(canDrop) && (s.counter[best] || 0) >= 8)) return { kind: 'station', at: station(best), k: best, need: Math.max(1, Math.min(s.cap - carry.length, bs)), r: 0.3 };
    if (carry.some(canDrop)) return { kind: 'counter', at: s.anchors.counter, r: 0.4 };
    if (s.kasaPile) return { kind: 'kasa', at: s.anchors.kasa, r: 0.6 };
    return { kind: 'idle', at: s.anchors.counter, r: 0.5 };
  }
  function menus() {
    const s = M.s;
    if (s.orders && s.orders.list) s.orders.list.forEach(o => { if (!o.claimed) B.claimOrder(o.id); });
    M.upT -= 0.1; if (M.upT > 0) return; M.upT = 8;
    if (s.level >= 2) {
      const mm = B.panelModel('menu').products.filter(p => p.unlocked && !p.pseudo && p.nextCost).sort((a, b) => a.nextCost - b.nextCost);
      const p = mm[0]; if (p && s.money > p.nextCost * 2 + 1500) B.upgradeTier(p.id);
    }
    if (s.level >= 5 && s.money > 45000) { const k = B.panelModel('menu').products.find(p => p.id === 'kepenk'); if (k && k.nextCost && s.money > k.nextCost * 2.5) B.upgradeTier('kepenk'); }
    if (s.level >= 6) { const dm = B.panelModel('dekor'); const it = dm.items.filter(i => !i.owned).sort((a, b) => a.price - b.price)[0]; if (it && dm.items.filter(i => i.owned).length < 12 && s.money > it.price * 3 + 3000) B.decorBuy(it.id); }
    if (B.invest && s.level >= 8) { const iv = B.panelModel('menu').invest.filter(y => y.cost != null && !y.locked).sort((a, b) => a.cost - b.cost)[0]; if (iv && s.money > iv.cost * 1.5 + 2000) B.invest(iv.id); }
    if (s.day >= 4 && !B.signSet()) B.saveSign('Martı Büfe', 'neon');
  }
  function hire() {
    const jb = B.jobBoardModel(); if (!jb || !jb.candidates) return false;
    const s = M.s;
    const roles = s.workers.map(w => w.role);
    const score = c => (c.legend ? 50 : 0) + ({ altin: 8, mavi: 5, yesil: 3, gri: 1 }[c.rarity] || 0) + (!roles.includes(c.role) ? 20 : 0) + (c.role === 'garson' && roles.filter(r => r === 'garson').length < 2 ? 10 : 0);
    const list = jb.candidates.filter(c => c.canHire !== false && s.money >= c.price).sort((a, b) => score(b) - score(a));
    if (!list.length) return false;
    const c = list[0];
    B.hireCandidate(c.id); M.hires.push({ t: s.t, name: c.name, role: c.role, price: c.price });
    return true;
  }
  M.tick = function () {
    const s = M.s = B.state();
    if (s.paused) { B.input(0, 0); if (s.pauseWhy === 'kasa') B.skipCeremony(); return; }
    // a human first looks around until the drag hand shows (v2 bot moved at once, so v2 itself missed the tutShow walk step)
    if (s.t < 3.5) { B.input(0, 0); return; }
    menus();
    if (s.slow && !M.slowSeen) M.slowSeen = s.t;
    if (s.slow && !M.slowDone && s.t - M.slowSeen < 1.5) { /* look first */ }
    else if (s.slow && !M.slowDone) { B.tapSlow(); const sol = B.solution(); if (sol && (!sol.cost || s.money >= sol.cost)) { B.acceptSolution(); M.slowDone = true; M.slowAt = s.t; } }
    else if (s.slow && M.slowDone && s.t - (M.slowAt || 0) > 30) { M.slowAt = s.t; B.tapSlow(); const sol = B.solution(); if (sol && sol.cost && s.money >= sol.cost * 1.5) B.acceptSolution(); }
    taskT -= 0.1;
    const t = M.task;
    const urgent = ['chase', 'pet', 'gull', 'wake', 'window', 'special'];
    if (!t || taskT <= 0 || (!urgent.includes(t.kind) && ((s.kap && s.kap.state === 'run') || (s.cat && s.cat.state === 'rub') || s.sleeper || (s.gull && s.gull.mode === 'stare' && M.gullMode % 2 === 0) || (s.window && s.window.open && t.kind !== 'station')))) {
      M.task = choose(); taskT = M.task.kind === 'station' ? 12 : 7; wait = 0;
    }
    const k = M.task;
    if (M.traceT === undefined || s.t - M.traceT >= 1) { M.traceT = s.t; (M.trace = M.trace || []).push([s.t, k.kind, k.k || k.key || '', s.carry.join('+'), s.pos.x.toFixed(1) + ',' + s.pos.z.toFixed(1)]); if (M.trace.length > 4000) M.trace.shift(); }
    if (k.kind === 'pet') { B.input(0, 0); M.petT += 0.1; if (!(s.cat && s.cat.state === 'rub') || M.petT > 4) { M.petT = 0; M.task = null; } return; }
    const at = k.dyn && s.kap ? s.kap.pos : k.kind === 'gull' && s.gull ? s.gull.pos : k.at;
    const there = go(at, k.r);
    if (!there) return;
    wait += 0.1;
    switch (k.kind) {
      case 'station': if (s.carry.length >= s.cap || s.carry.filter(x => x === k.k).length >= k.need || wait > 6) M.task = null; break;
      case 'counter': if (!s.carry.length || wait > 2.5) M.task = null; break;
      case 'kasa': if (!s.kasaPile || wait > 2) M.task = null; break;
      case 'pad': if (!s.pads.some(p => p.key === k.key) || wait > 4 || s.money < 1) M.task = null; break;
      case 'board': if (s.boardOpen) { const ok = hire(); if (ok || wait > 1.5) { M.lastBoard = s.t; M.task = null; } } else if (wait > 2) { M.lastBoard = s.t; M.task = null; } break;
      case 'window': if (!s.window || !s.carry.length || wait > 6) M.task = null; break;
      case 'special': if (wait > 3) M.task = null; break;
      case 'gull': if (!s.gull || wait > 2) { M.gullMode++; M.task = null; } break;
      default: if (wait > 1.5) M.task = null;
    }
  };
  return M;
}

/* GDD first-session table (times from launch; the sim clock starts after the portrait pick, about 5 s in) */
export const OFF = 5;
export const STEPS = [
  { gdd: '00:03', what: 'Portre seçimi (Sabri/Sabriye)', ev: 'heroPick', max: 0 },
  { gdd: '00:05', what: 'Kamera iner, sabah; çatıda martı çığlığı; Pamuk tentede uyuyor', ev: 'introGull', max: 8, extra: r => r.catAsleep },
  { gdd: '00:08', what: 'Sürükleme eli', ev: 'tutShow', id: 'walk', max: 12 },
  { gdd: '00:10', what: 'Döner ok; ilk kesim', ev: 'firstCut', max: 25 },
  { gdd: '00:15', what: 'Tezgah ok; ilk müşteri emekli amca; Siftah ×2', ev: 'siftah', max: 40 },
  { gdd: '00:20', what: 'Para ok; toplama', ev: 'firstCollect', max: 50 },
  { gdd: '00:30', what: 'İlk sarı kare (çay ocağı) dolar', ev: 'padShown', key: 'cay', max: 55 },
  { gdd: '01:00', what: 'Çay açılır', ev: 'unlock', key: 'cay', max: 100 },
  { gdd: '02:00', what: 'Vapur düdüğü ve dalga', ev: 'ferryDock', max: 135 },
  { gdd: '02:00', what: 'İlk "Seri!"', ev: 'firstStreak', max: 200 },
  { gdd: '02:40', what: 'Pamuk uyanır, bacağa sürtünür', ev: 'catRub', max: 185 },
  { gdd: '02:40', what: 'Sev: Kedi Defteri sayfası', ev: 'catPet', max: 200 },
  { gdd: '03:30', what: 'Ayran açılır', ev: 'unlock', key: 'ayran', max: 260 },
  { gdd: '03:30', what: 'İlk döner+ayran seti', ev: 'set', set: 'doner_ayran', max: 420 },
  { gdd: '04:00', what: '1. gün biter, kart kayar, oyun sürer', ev: 'dayEnd', max: 500 },
  { gdd: '05:00', what: 'Simit tablası', ev: 'unlock', key: 'simit', max: 360 },
  { gdd: '05:00', what: 'İki tabure', ev: 'unlock', key: 'tabure2', max: 380 },
  { gdd: '05:00', what: 'Oturan müşteri yemeğini bitirip gider (bahşiş yok, survey 2026-10-24)', ev: 'mealDone', max: 420 },
  { gdd: '08:00', what: 'İş ve İşçi Bulma: 3 kart', ev: 'boardOpen', max: 560 },
  { gdd: '08:00', what: 'Rıza işe başlar', ev: 'hire', name: 'Rıza', max: 570 },
  { gdd: '08:00', what: 'Rıza 3 sn izler, devralır', ev: 'takeover', name: 'Rıza', max: 600 },
  { gdd: '09:00', what: 'Vapur penceresi kurulur', ev: 'unlock', key: 'pencere', max: 640 },
  { gdd: '09:00', what: 'İlk 20 sn pencere telaşı', ev: 'firstWindowSale', max: 760 },
  { gdd: '10:00', what: 'Martı tezgahta bakar', ev: 'gullStare', max: 680 },
  { gdd: '10:00', what: 'Yürü, uçsun (ya da simidi kapar)', ev: ['gullChased', 'gullSnatch'], max: 700 },
  { gdd: '11:00', what: 'Rıza uyur (Zzz)', ev: 'workerSleep', max: 740 },
  { gdd: '11:00', what: '"Uyumuyordum abi!"', ev: 'wake', max: 760 },
  { gdd: '12:00', what: 'İlk kırmızı yavaş nokta', ev: 'slowIcon', max: 820 },
  { gdd: '12:00', what: 'Dokun: kamera kayar, çözüm kartı', ev: 'slowTap', max: 830 },
  { gdd: '12:00', what: 'Nazlı işe başlar', ev: 'hire', name: 'Nazlı', max: 900 }, // survey 2026-10-24: no tips and an 8-min day slow the first wages a little
  { gdd: 'sonra', what: 'Tayfun', ev: 'hire', name: 'Tayfun', max: 1500 },
  { gdd: 'sonra', what: 'İlk yıldız', ev: 'star', max: 1500 }
];
/** Finds the first matching log event for a step (same matching as v2). */
export function findEvent(log, st) {
  return log.find(e => (Array.isArray(st.ev) ? st.ev.includes(e.ev) : e.ev === st.ev) && (!st.id || e.id === st.id) && (!st.key || e.key === st.key) && (!st.name || e.name === st.name) && (!st.set || e.set === st.set));
}
/** Runs the acceptance table; returns [{ok, step, t}] and the pass count. */
export function evaluate(log, ctx) {
  const rows = STEPS.map(st => { const e = findEvent(log, st); const ok = !!(e && (st.max == null || e.t <= st.max) && (!st.extra || st.extra(ctx || {}))); return { ok, st, t: e ? e.t : null }; });
  return { rows, pass: rows.filter(r => r.ok).length, total: rows.length };
}
/** Bus records ({name,data,t}) -> v2 flat log entries ({ev,t,...data}). `t` is sim seconds since play (play is called at tick 0). */
export function flattenLog(records) {
  return records.map(r => Object.assign({}, r.data || {}, { ev: r.name, t: +r.t.toFixed(2) }));
}
