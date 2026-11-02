/**
 * Play view (integrator, M1): the render-side half of v2 game.js that is not world, characters or panels.
 * Ports v2 updateLabels (order bubbles with patience bars, say lines, Zzz, slow icon tap, cat hearts, gull icon, ferry
 * window ring, tadilat tag, job corner tag), renderTutorial (bobbing arrow + ground ring, drag hand), hudNow (v2 HUD
 * fields every 0.25 s), floats ("+12 ₺", "Menü! ×1.4", "Seri! ×3") with coins flying to the money pill, toasts and
 * achievement popups from sim events, and the camera pan on a slow-icon tap.
 * Reads sim state only; the one write path is `sim.command` (slow icon tap).
 * Decisions: money floats come from the per-frame money delta while the sim runs (v2 floated on kasa collect and direct
 * earnings, which are exactly the moments money grows), so the sim needs no extra 'float' event.
 */
import type { Object3D } from 'three';
import type { Ui, Vec2, Vec3, ScreenPt } from '../engine/api';
import { GAME_DAY_S } from '../engine/api';
import type { RulesFull } from './sim/rules';
import type { Customer } from './sim/state';
import type { AgentsHandle } from './sim/agents';
import type { V2UiApi } from './ui/v2ui';
import type { HtmlLabels, HtmlLabel } from './ui/labels';
import type { TutCurrent } from './tutorial';
import { P, xpForLevel } from '../content/economy';
import { SETS } from '../content/products';
import { LINES } from '../content/lines';
import { musteriBubble, photoFlash } from './ui/musteri-ui';

export interface PlayViewDeps {
  ui: Ui;
  v2: V2UiApi;
  labels: HtmlLabels;
  rules(): RulesFull | null;
  command(c: { kind: string; [k: string]: unknown }): void;
  project(p: Vec3, out: ScreenPt): boolean;
  /** Interpolated hero ground position. */
  hero(): Vec2;
  /** Tutorial step to draw (D's tutorial current()), or null. */
  tutorial(): TutCurrent | null;
  /** Arrow / ring marker factory (world view) and the parent to add them to. */
  marker?(kind: 'arrow' | 'ring'): Object3D | null;
  addToScene?(o: Object3D): void;
  crowdHead?(slot: number, out: Vec3): boolean;
  actorHead?(id: number, out: Vec3): boolean;
  pan?(at: Vec2): void;
}
export interface PlayView { update(fdt: number): void; reset(): void; dispose(): void; }

const fmt = (n: number) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const esc = (s: unknown) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
type Order = Partial<Record<string, number>>;

function orderLeft(c: { order: Order; got: Order }): Order {
  const l: Order = {};
  for (const p in c.order) { const k = (c.order[p] || 0) - (c.got[p] || 0); if (k > 0) l[p] = k; }
  return l;
}
/** order -> bubble icon list: what is still missing first, delivered items dimmed (v2 orderIcons). */
function orderIcons(order: Order, left: Order) {
  const out: { id: string; n: number; done?: boolean }[] = [];
  for (const p in order) { const n = order[p] || 0; if (n <= 0) continue; const l = left[p] || 0; if (l > 0) out.push({ id: p, n: l }); }
  for (const p in order) { const n = order[p] || 0; if (n > 0 && !((left[p] || 0) > 0)) out.push({ id: p, n, done: true }); }
  return out;
}

export function createPlayView(d: PlayViewDeps): PlayView {
  const { ui, v2, labels } = d;
  const byKey = new Map<string, HtmlLabel>();
  const scr: ScreenPt = { x: 0, y: 0 };
  const hp: Vec3 = { x: 0, y: 0, z: 0 };
  let frame = 0, tAll = 0, hudT = 0, lastMoney = NaN, coinsAt = -9, handOn = false;
  let arrow: Object3D | null = null, ring: Object3D | null = null;
  const offs: (() => void)[] = [];
  let boundBus: unknown = null;

  const screenOf = (x: number, y: number, z: number): ScreenPt | null => { hp.x = x; hp.y = y; hp.z = z; return d.project(hp, scr) ? scr : null; };
  const started = () => { const r = d.rules(); return !!(r && r.rt.started); };
  const floatAt = (x: number, z: number, y: number, text: string, kind = 'good') => {
    if (!started()) return;
    const s = screenOf(x, y + 2.0, z); if (s) v2.float(s.x, s.y, text, kind);
  };
  const agents = (r: RulesFull) => (r.rt as unknown as { agents?: AgentsHandle }).agents ?? null;

  function bindEvents(r: RulesFull) {
    if (boundBus === r.bus) return;
    offs.forEach(o => { try { o(); } catch { /* */ } }); offs.length = 0;
    boundBus = r.bus;
    const on = (name: string, fn: (data: any) => void) => { offs.push(r.bus.on(name as never, ((x: unknown) => { try { fn(x); } catch (e) { console.error('[play-view]', name, e); } }) as never) as () => void); };
    const front = () => { const q = r.rt.layout.queue[0]; return q ? { x: q.x, z: q.z } : d.hero(); };
    on('toast', e => { if (e && e.text) ui.toast(String(e.text), (e.kind as 'good' | 'bad' | 'info') || 'info'); });
    on('ach', e => v2.achievement({ title: e?.title, text: e?.text, reward: e?.reward }));
    on('set', e => { const s = SETS.find(x => x.id === e?.set); const p = front(); floatAt(p.x, p.z, 0, LINES.set + (s ? ' ×' + s.x : ''), 'good'); });
    on('sale', e => { if (e && e.streak >= 2) { const p = front(); floatAt(p.x, p.z, 0.3, LINES.streak + ' ×' + (e.streak + 1), 'good'); } });
    on('slowTap', () => { const s = r.rt.slow; if (s && d.pan) d.pan({ x: s.at.x, z: s.at.z }); });
    on('musteriPhoto', e => { const s = e && screenOf(Number(e.x) || 0, 1.7, Number(e.z) || 0); if (s) photoFlash(s.x, s.y); });
  }

  function head(c: Customer, out: Vec3): Vec3 {
    if (c.agent >= 0 && d.crowdHead && d.crowdHead(c.agent, out) && Number.isFinite(out.x) && (out.x || out.z)) return out;
    out.x = c.x; out.y = 1.75; out.z = c.z; return out;
  }
  function actorHead(id: number, x: number, z: number, y: number, out: Vec3): Vec3 {
    if (d.actorHead && d.actorHead(id, out) && Number.isFinite(out.x)) return out;
    out.x = x; out.y = y; out.z = z; return out;
  }

  interface Cand { x: number; y: number; z: number; html: string | number; cls: string; prio: number; key: string; tap: (() => void) | null; }
  const cand: Cand[] = [];
  const seen = new Set<string>();
  const tmp: Vec3 = { x: 0, y: 0, z: 0 };
  function updateLabels(r: RulesFull) {
    cand.length = 0;
    const rt = r.rt, S = r.state;
    const add = (p: Vec3, html: string | number, cls: string, prio: number, key: string, tap: (() => void) | null = null) => cand.push({ x: p.x, y: p.y, z: p.z, html, cls, prio, key, tap });
    // customers in the queue: what they still want, patience bar, a line now and then
    rt.queue.forEach((c, i) => {
      if (c.state !== 'queue' || (c.agent < 0 && i > 2)) return;
      const left = orderLeft(c), k = c.patience / Math.max(0.01, c.patMax);
      const icons = orderIcons(c.order, left);
      if (!icons.length && !(c.sayT > 0)) return;
      const party = c.n > 1 && c.members.length + 1 < c.n ? c.n + ' kişilik' : '';
      const text = c.sayT > 0 ? c.say : party;
      const h = head(c, tmp); h.y += 0.35;
      add(h, musteriBubble(v2.bubbleHTML({ icons, text, patience: k }), c, k), k < 0.25 ? 'bubble angry' : i > 2 ? 'bubble mini' : 'bubble', 10 - i + (k < 0.3 ? 4 : 0), 'c' + c.id);
    });
    rt.winq.forEach((c, i) => {
      if (c.state !== 'wqueue' || i > 2) return;
      const h = head(c, tmp); h.y += 0.35;
      add(h, v2.bubbleHTML({ icons: orderIcons(c.order, orderLeft(c)) }), 'bubble mini', 9 - i + (rt.window ? 3 : 0), 'w' + c.id);
    });
    rt.customers.forEach(c => {
      if ((c.state === 'leave' || c.state === 'eat' || c.state === 'toSeat') && c.sayT > 0) { const h = head(c, tmp); h.y += 0.3; add(h, esc(c.say), 'say', 3, 'c' + c.id); }
      if (c.heartT && c.heartT > 0 && c.state !== 'queue') { const h = head(c, tmp); h.y += c.sayT > 0 ? 0.95 : 0.4; add(h, v2.icon('heart'), 'icon', 4, 'h' + c.id); } // musteri: happy heart
    });
    const ag = agents(r);
    if (ag) {
      const reg = ag.registry;
      // regulars and the gurme
      const specials: [string, { state: string; need: Record<string, number>; visit?: number } | null][] = [['regular', ag.regulars.current()], ['vip', ag.vip.current()]];
      for (const [kind, o] of specials) {
        if (!o || o.state === 'walk') continue;
        const a = reg.list.find(x => x.kind === kind && !x.dead); if (!a) continue;
        const p = actorHead(a.id, a.x, a.z, 1.85, tmp); p.y += 0.35;
        if (o.state === 'wait') {
          const known = kind === 'regular' && (o.visit || 0) > 0;
          const name = String((a.info as { name?: string }).name || '');
          const order: Order = {}; for (const k in o.need) order[k] = o.need[k];
          const text = a.sayT > 0 ? a.say : name;
          add(p, v2.bubbleHTML({ icons: known ? [] : orderIcons(order, order), text }), kind === 'vip' ? 'bubble vip' : 'bubble praise', 13, kind);
        } else if (a.sayT > 0) add(p, esc(a.say), 'say', 12, kind);
      }
      const kap = ag.kapkac.current() as { state: string; pos: Vec2 } | null;
      const ka = reg.list.find(x => x.kind === 'kapkac' && !x.dead);
      if (kap && kap.state === 'run') add({ x: kap.pos.x, y: 2.2, z: kap.pos.z }, v2.icon('warn'), 'icon', 15, 'kap');
      else if (ka && ka.sayT > 0) add({ x: ka.x, y: 2.1, z: ka.z }, esc(ka.say), 'say', 12, 'kap');
      // workers: Zzz while asleep, short lines otherwise
      for (const w of ag.workers.rows() as { id: number; state: string }[]) {
        const a = reg.byKey('worker', String(w.id)); if (!a) continue;
        if (w.state === 'sleep') { const p = actorHead(a.id, a.x, a.z, 1.85, tmp); p.y += 0.25; add(p, 'Zzz', 'zz', 14, 'z' + w.id); }
        else if (a.sayT > 0) { const p = actorHead(a.id, a.x, a.z, 1.85, tmp); p.y += 0.3; add(p, esc(a.say), 'say', 6, 'k' + w.id); }
      }
      // cats: hearts while being petted, one heart while rubbing
      const catRows = ag.cats.rows();
      for (const a of reg.list) {
        if (a.kind !== 'cat' || a.dead) continue;
        const row = catRows.find(c => c.id === a.key);
        const p = { x: a.x, y: 0.75 + (a.y || 0), z: a.z };
        if (a.fx === 'heart') add(p, v2.heartsHTML(), 'hearts', 12, 'cat' + a.key);
        else if (row && row.state === 'rub') { p.y += 0.25; add(p, v2.icon('heart'), 'icon', 12, 'cat' + a.key); }
      }
      // gull staring at the counter
      const g = reg.list.find(x => x.kind === 'gull' && !x.dead && x.act === 'stare');
      if (g) add({ x: g.x, y: (g.y || 0) + 0.75, z: g.z }, v2.icon('gull'), 'icon', 12, 'gull');
    }
    if (rt.sayT > 0 && rt.say) { const h = d.hero(); add({ x: h.x, y: 2.2, z: h.z }, esc(rt.say), 'say', 11, 'pl'); }
    // slow-spot red icon (tappable)
    if (rt.slow) add({ x: rt.slow.at.x, y: 2.3, z: rt.slow.at.z }, v2.slowHTML(), 'slow', 20, 'slow', () => d.command({ kind: 'tapSlow' }));
    // ferry window countdown
    if (rt.window && rt.window.open) { const w = rt.layout.window.standAt; add({ x: w.x, y: 2.5, z: w.z }, clamp(rt.window.t / P.WINDOW_S, 0, 1), 'ring', 9, 'win'); }
    // tadilat progress
    const tad = S.tadilat as unknown as { left: number; total: number } | null;
    if (tad && typeof tad.left === 'number') {
      const c = rt.layout.counter.pos ?? rt.layout.counter.drop;
      add({ x: c.x, y: 3.4, z: c.z }, `<b>TADİLAT</b>${Math.ceil(tad.left)} sn`, 'tag', 8, 'tad');
      add({ x: c.x, y: 2.7, z: c.z }, 1 - tad.left / Math.max(1, tad.total), 'ring', 8, 'tadr');
    }
    if (S.owned.isbul) { const j = rt.layout.job.pos; add({ x: j.x, y: 2.4, z: j.z }, '<b>İŞ VE İŞÇİ BULMA</b>', 'tag', 1, 'job'); }
    // pick: non-bubbles up to 8, bubbles up to 8 by priority
    cand.sort((a, b) => b.prio - a.prio);
    let nb = 0, ni = 0;
    seen.clear();
    const vw = window.innerWidth, vh = window.innerHeight;
    for (const c of cand) {
      if (seen.has(c.key)) continue;
      const bubble = /(^|\s)bubble(\s|$)/.test(c.cls);
      if (bubble ? nb >= P.MAX_BUBBLES : ni >= 8) continue;
      const s = screenOf(c.x, c.y, c.z);
      if (!s || s.x < -50 || s.x > vw + 50 || s.y < -50 || s.y > vh + 50) continue;
      if (bubble) nb++; else ni++;
      seen.add(c.key);
      let l = byKey.get(c.key);
      if (!l) { l = labels.label(); byKey.set(c.key, l); }
      l.onTap = c.tap;
      l.set(s.x, s.y, c.html, c.cls);
    }
    byKey.forEach((l, key) => { if (seen.has(key)) return; l.onTap = null; l.free(); byKey.delete(key); });
  }

  function renderTutorial(t: number) {
    if (!arrow && d.marker) {
      arrow = d.marker('arrow'); ring = d.marker('ring');
      if (arrow) { arrow.visible = false; d.addToScene?.(arrow); }
      if (ring) { ring.visible = false; d.addToScene?.(ring); }
    }
    const s = started() ? d.tutorial() : null;
    if (s && s.hand) {
      if (arrow) arrow.visible = false; if (ring) ring.visible = false;
      const h = d.hero(), sc = screenOf(h.x, 0.8, h.z);
      if (sc) v2.hand(true, sc.x + 40, sc.y + 60);
      handOn = true; return;
    }
    if (handOn) { v2.hand(false); handOn = false; }
    const at = s && s.at;
    if (!at) { if (arrow) arrow.visible = false; if (ring) ring.visible = false; return; }
    const ay = (at as Vec2 & { y?: number }).y;
    if (arrow) { arrow.visible = true; arrow.position.set(at.x, (s!.y != null ? s!.y : (ay || 0)) + 1.7 + Math.abs(Math.sin(t * 4)) * 0.35, at.z); arrow.rotation.y = t * 2; }
    if (ring) { ring.visible = true; ring.position.set(at.x, 0.04, at.z); const k = 1 + Math.sin(t * 5) * 0.08; ring.scale.set(k, k, k); }
  }

  function hudNow(r: RulesFull) {
    const S = r.state, h = r.hour(), hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60 / 10) * 10;
    ui.hud({
      money: Math.floor(S.money), gold: S.gold, day: S.day, clock: (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm,
      dayProgress: clamp(S.dayT / GAME_DAY_S, 0, 1), stars: S.stars, level: S.level, levelProgress: clamp(S.xp / xpForLevel(S.level), 0, 1),
      streak: r.rt.streak + (r.rt.streak > 0 ? 1 : 0), muted: !!S.settings.muted,
    } as Parameters<Ui['hud']>[0]);
  }

  function moneyFloats(r: RulesFull) {
    const m = r.state.money;
    if (!Number.isFinite(lastMoney) || !r.rt.started) { lastMoney = m; return; }
    const got = m - lastMoney; lastMoney = m;
    if (got < 1 || r.rt.paused) return;
    const h = d.hero();
    floatAt(h.x, h.z, 0, '+' + fmt(got) + ' ₺', 'good');
    if (tAll - coinsAt > 0.35) {
      coinsAt = tAll;
      const sp = screenOf(h.x, 1.3, h.z);
      if (sp) v2.coins(sp.x, sp.y, Math.min(8, 2 + Math.round(Math.log10(got + 1) * 1.5)));
    }
  }

  return {
    update(fdt) {
      frame++; tAll += fdt;
      const r = d.rules(); if (!r) return;
      bindEvents(r);
      renderTutorial(tAll);
      if (!r.rt.started) { if (byKey.size) { byKey.forEach(l => l.free()); byKey.clear(); } return; }
      moneyFloats(r);
      if (frame % 2 === 0) updateLabels(r);
      if ((hudT -= fdt) <= 0) { hudT = 0.25; hudNow(r); }
    },
    reset() { lastMoney = NaN; hudT = 0; byKey.forEach(l => l.free()); byKey.clear(); },
    dispose() { offs.forEach(o => { try { o(); } catch { /* */ } }); offs.length = 0; byKey.forEach(l => l.free()); byKey.clear(); },
  };
}
