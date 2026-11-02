/**
 * Juice: the small "tatlılık" layer (survey ses-4, animasyon-2/4..7/11..13, motor-8). View only, never writes sim state.
 *
 * - Particles (motor-8): registers the content EFFECTS into the game's fx (once) and plays them on sim events:
 *   tost press steam + 'press' click (pick tost), sesame crumbs (pick simit), gull feathers (gullSnatch / gullChased /
 *   introGull), wave spray at the dock (ferryDock + now and then, more in lodos), run dust puffs at the hero's feet
 *   and a puff on a sudden stop, coin sparkle at the counter on each sale, confetti on unlocks / level ups.
 * - Customers (animasyon-7): a seated citizen sipping tea now and then blows on it (tiny steam puff + soft 'blow'),
 *   one eating drops a few crumbs (the bite).
 * - Emotes (animasyon-6): level / star = çay bardağını kaldır, streak = alkış, gullSnatch = 'eyvah' (elini alnına),
 *   angry customer = omuz silkme. Rate limited so they stay special.
 * - Coins (animasyon-13): each sale throws 1-3 DOM coins from the counter to the money pill in a hopping arc, with
 *   a little sparkle when they land. Unlock: the camera slides to the new thing for a moment, confetti, and whatever
 *   appeared there pops in with a squash spring (anim.squashPop).
 * - Flag (animasyon-11): an invented "Martıköy İskelesi" pennant on a pole behind the kiosk, its cloth waving in the
 *   wind (CPU vertex wave on a 10x4 plane, stronger in lodos via crowdWeather.lean).
 * - Panels (animasyon-12): sheets already spring open; this adds a kepenk (corrugated shutter) that rolls up over a
 *   freshly opened sheet, with a soft rattle.
 * - Haptics (ses-4): light tick when money is collected, strong tick on a pickup, a pattern when a gull snatches a
 *   simit, a rhythmic pulse while the ferry docks. Only when the Titreşim setting is on and after a user gesture.
 */
import * as T from 'three';
import type { Fx, Bus, HeroHandle, AnchorDef, Vec3, ScreenPt, SoAStore, EffectDef } from '../../engine/api';
import { EFFECTS } from '../../content/effects';
import { ACT_ORDER, AGENT_FLAG } from '../sim/schema';
import { crowdWeather } from './chars/weather-pose';

export interface JuiceDeps {
  bus: Bus<any>;
  fx: Fx | null;
  hero: () => HeroHandle | null;
  heroPos: () => { x: number; z: number };
  speed: () => number;
  anchors: () => Record<string, AnchorDef>;
  zoneRoot: () => T.Object3D | null;
  uiRoot: HTMLElement | null;
  project: (p: Vec3, out: ScreenPt) => boolean;
  agents?: () => SoAStore | null;
  crowdHead?: (slot: number, out: Vec3) => boolean;
  haptics: () => boolean;
  sfx: (id: string, at?: { x: number; z: number }) => void;
  pan?: (at: { x: number; z: number }) => void;
  squashPop?: (o: T.Object3D, amount?: number) => void;
  /** Lodos-ish wind 0..1 (optional; falls back to crowdWeather.lean). */
  wind?: () => number;
}
export interface JuiceView { update(dt: number): void; dispose(): void; }

const EXTRA_FX: Record<string, EffectDef> = {
  // customer blowing on tea: 3 small, quick puffs pushed forward
  blowSteam: { id: 'blowSteam', life: [0.5, 0.9], emitters: [{ kind: 'burst', count: 4, shape: 'point' }],
    modules: [{ kind: 'velocity', dir: { x: 0, y: 0.6, z: 0 }, spread: 0.5, speed: [0.3, 0.6] }, { kind: 'drag', k: 2 },
      { kind: 'sizeOverLife', stops: [[0, 0.04], [1, 0.14]] }, { kind: 'colorOverLife', stops: [[0, '#ffffff', 0.7], [1, '#ffffff', 0]] }, { kind: 'sprite', atlas: 'fx', frames: [1] }] },
  crumbs: { id: 'crumbs', life: [0.4, 0.7], emitters: [{ kind: 'burst', count: 5, shape: 'point' }],
    modules: [{ kind: 'velocity', dir: { x: 0, y: 0.3, z: 0 }, spread: 0.9, speed: [0.3, 0.7] }, { kind: 'gravity', g: -6 },
      { kind: 'sizeOverLife', stops: [[0, 0.03], [1, 0.025]] }, { kind: 'colorOverLife', stops: [[0, '#d9a35b', 1], [1, '#c8833c', 0.6]] }, { kind: 'sprite', atlas: 'fx', frames: [2] }] },
};

const CSS = `
.sb-sheet::after{content:none;display:none;position:absolute;left:0;right:0;top:0;height:100%;pointer-events:none;z-index:40;
background:repeating-linear-gradient(180deg,#b9c2c7 0 9px,#8e999f 9px 11px,#d4dadd 11px 13px);border-bottom:6px solid #5c666b;
transform-origin:50% 0;animation:sb-kepenk .55s cubic-bezier(.5,0,.3,1) .05s both}
@keyframes sb-kepenk{0%{transform:scaleY(1)}100%{transform:scaleY(0)}}
.sb-jcoin{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;pointer-events:none;z-index:60;
background:radial-gradient(circle at 35% 30%,#fff6c2 0 18%,#ffd23f 19% 62%,#d99a12 63%);border:2px solid #7a4a10;box-shadow:0 2px 0 #7a4a10}
.sb-jspark{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;pointer-events:none;z-index:61;
background:radial-gradient(circle,#fff8d0 0 20%,rgba(255,220,90,.0) 62%);animation:sb-jspark .45s ease-out forwards}
@keyframes sb-jspark{0%{transform:scale(.3) rotate(0);opacity:1}100%{transform:scale(1.8) rotate(45deg);opacity:0}}
.sb-jpop{position:absolute;pointer-events:none;z-index:61;font:900 26px/1 var(--disp,var(--body,sans-serif));color:#fff;
-webkit-text-stroke:2px #3b2a20;paint-order:stroke;transform:translate(-50%,-50%);animation:sb-jpop .9s cubic-bezier(.25,1.6,.45,1) forwards}
@keyframes sb-jpop{0%{transform:translate(-50%,-50%) scale(.2)}35%{transform:translate(-50%,-80%) scale(1.25)}70%{opacity:1}100%{transform:translate(-50%,-140%) scale(1);opacity:0}}
@media (prefers-reduced-motion: reduce){.sb-sheet::after{animation-duration:.01s}.sb-jcoin{display:none}}
`;

export function createJuice(d: JuiceDeps): JuiceView {
  const offs: Array<() => void> = [];
  const on = (name: string, cb: (p: any) => void) => { offs.push(d.bus.on(name, (p: any) => { try { cb(p); } catch { /* juice is optional */ } }) as () => void); };
  // ── fx registry
  const fx = d.fx;
  if (fx) for (const def of [...Object.values(EFFECTS), ...Object.values(EXTRA_FX)]) { try { if (!fx.has(def.id)) fx.define(def); } catch { /* */ } }
  const at3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
  const play = (id: string, p: Vec3, scale?: number, stopAfter?: number) => {
    if (!fx) return;
    try { const h = fx.play(id, p, scale ? { scale } : undefined); if (stopAfter) setTimeout(() => { try { h.stop(); } catch { /* */ } }, stopAfter * 1000); } catch { /* */ }
  };
  const anchor = (id: string): { x: number; y: number; z: number } | null => {
    try { const a = d.anchors()[id]; return a ? { x: a.pos.x, y: a.y ?? 1, z: a.pos.z } : null; } catch { return null; }
  };
  const heroAt = (y: number) => { const p = d.heroPos(); return at3(p.x, y, p.z); };

  // ── haptics (ses-4)
  const buzz = (pat: number | number[]) => {
    try {
      if (!d.haptics()) return;
      const nav = navigator as Navigator & { userActivation?: { hasBeenActive: boolean } };
      if (nav.userActivation && !nav.userActivation.hasBeenActive) return;
      nav.vibrate?.(pat);
    } catch { /* no vibration */ }
  };
  let lastCoinBuzz = 0, clock = 0;

  // ── emotes (animasyon-6)
  let emoteT = 0;
  const emote = (id: 'clap' | 'shrug' | 'facepalm' | 'raiseTea', gap = 6) => {
    if (clock < emoteT) return; emoteT = clock + gap;
    try { d.hero()?.animator.emote(id); } catch { /* */ }
  };

  // ── DOM: style, coins, pops
  const root = d.uiRoot;
  let style: HTMLStyleElement | null = null;
  if (root && typeof document !== 'undefined') { style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style); }
  interface Coin { el: HTMLElement; t: number; dur: number; x0: number; y0: number; x1: number; y1: number; h: number; }
  const coins: Coin[] = [];
  const sp: ScreenPt = { x: 0, y: 0 };
  function moneyTarget(): { x: number; y: number } | null {
    if (!root) return null;
    const pill = root.querySelector('.sb-money') as HTMLElement | null; if (!pill) return null;
    const r = pill.getBoundingClientRect(), rr = root.getBoundingClientRect();
    return { x: r.left - rr.left + 18, y: r.top - rr.top + r.height / 2 };
  }
  function flyCoins(from: Vec3, n: number) {
    if (!root || coins.length > 8) return;
    if (!d.project(from, sp)) return;
    const tg = moneyTarget(); if (!tg) return;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div'); el.className = 'sb-jcoin';
      el.style.left = sp.x + 'px'; el.style.top = sp.y + 'px';
      root.appendChild(el);
      coins.push({ el, t: -i * 0.09, dur: 0.7 + i * 0.05, x0: sp.x + (i - 1) * 10, y0: sp.y, x1: tg.x, y1: tg.y, h: 70 + Math.random() * 40 });
    }
  }
  function sparkAt(x: number, y: number) {
    if (!root) return;
    const s = document.createElement('div'); s.className = 'sb-jspark'; s.style.left = x + 'px'; s.style.top = y + 'px';
    root.appendChild(s); setTimeout(() => s.remove(), 500);
  }
  function popText(p: Vec3, text: string) {
    if (!root || !d.project(p, sp)) return;
    const el = document.createElement('div'); el.className = 'sb-jpop'; el.textContent = text; el.style.left = sp.x + 'px'; el.style.top = sp.y + 'px';
    root.appendChild(el); setTimeout(() => el.remove(), 950);
  }
  // kepenk rattle when a sheet appears (the CSS shutter runs on its own)
  let mo: MutationObserver | null = null;
  if (root && typeof MutationObserver !== 'undefined') {
    let lastSheet = 0;
    mo = new MutationObserver(list => {
      for (const m of list) for (const n of Array.from(m.addedNodes)) {
        if (n instanceof HTMLElement && n.classList.contains('sb-sheet') && clock - lastSheet > 0.4) { lastSheet = clock; d.sfx('shutter'); return; }
      }
    });
    mo.observe(root, { childList: true, subtree: true });
  }

  // ── sim events
  on('pick', p => {
    buzz(22);
    const type = String(p?.type ?? '');
    if (type === 'tost') { const o = anchor('stations.tost.out'); const q = o ? at3(o.x, o.y + 0.1, o.z) : heroAt(1.2); play('tostSteam', q); d.sfx('press', q); }
    else if (type === 'simit') play('sesame', heroAt(1.1));
    else if (type === 'cay') { const o = anchor('stations.cay.out'); if (o) play('steam', at3(o.x, o.y + 0.15, o.z), 0.6, 0.9); }
  });
  on('transfer', p => {
    const id = String(p?.id ?? '');
    if ((id === 'kasa' || id.startsWith('floor') || id.startsWith('tip.')) && clock - lastCoinBuzz > 0.12) { lastCoinBuzz = clock; buzz(8); }
  });
  on('sale', p => {
    const c = anchor('counter.drop') || anchor('counter');
    if (c) { const q = at3(c.x, (c.y || 1) + 0.25, c.z); play('coinSparkle', q); flyCoins(q, Math.max(1, Math.min(3, Number(p?.n) || 1))); }
  });
  on('streak', p => { if ((Number(p?.streak) || 0) >= 3) emote('clap', 8); });
  on('firstStreak', () => emote('clap', 2));
  on('level', () => { emote('raiseTea', 1); play('confetti', heroAt(1.6)); popText(heroAt(2.4), 'Seviye!'); buzz([20, 40, 20]); });
  on('star', () => { emote('raiseTea', 1); play('confetti', heroAt(1.6)); });
  on('angry', () => emote('shrug', 10));
  const feathers = () => { play('feather', heroAt(1.8)); d.sfx('feather'); };
  on('gullSnatch', () => { feathers(); emote('facepalm', 2); buzz([30, 50, 30, 50, 60]); });
  on('gullChased', () => feathers());
  on('introGull', () => feathers());
  on('ferryDock', () => { spray(1.4); buzz([60, 90, 60, 90, 60, 90, 120]); });
  on('ferryHorn', () => buzz([40, 120, 40]));

  // unlock: camera slide, confetti, pop the new object
  let popWait: { t: number; before: Set<T.Object3D>; at: { x: number; z: number } } | null = null;
  on('unlock', p => {
    const key = String(p?.key ?? '');
    const a = anchor('pads.' + key) || anchor('stations.' + key);
    const q = a ? at3(a.x, 0.6, a.z) : heroAt(1.2);
    play('confetti', q); play('coinSparkle', at3(q.x, 1.2, q.z), 1.4); d.sfx('confetti'); buzz(35);
    popText(at3(q.x, 2.2, q.z), 'Açıldı!');
    if (a && d.pan) { try { d.pan({ x: a.x, z: a.z }); } catch { /* */ } }
    const zr = d.zoneRoot();
    if (zr && d.squashPop) popWait = { t: 0.25, before: new Set(zr.children), at: { x: q.x, z: q.z } };
  });
  function popNew() {
    const zr = d.zoneRoot(); if (!zr || !popWait || !d.squashPop) return;
    const w = popWait; popWait = null;
    const fresh = zr.children.filter(c => !w.before.has(c));
    const tmp = new T.Vector3();
    const near = (o: T.Object3D) => { o.getWorldPosition(tmp); return Math.hypot(tmp.x - w.at.x, tmp.z - w.at.z) < 2.2; };
    const list = fresh.filter(near);
    for (const o of list.slice(0, 3)) { try { d.squashPop(o, 1.2); } catch { /* */ } }
  }

  // wave spray around the dock pilings
  const DOCK = { x: 10.75, z: -7.1 };
  function spray(scale = 1) {
    const x = DOCK.x + (Math.random() - 0.5) * 3, z = DOCK.z + (Math.random() - 0.5) * 2.5;
    play('foamSplash', at3(x, 0.05, z), scale);
    if (scale > 1) d.sfx('splash', { x, z });
  }
  let sprayT = 5;

  // ── flag on a pole behind the kiosk (animasyon-11)
  const flag = new T.Group(); flag.name = 'juice-flag'; flag.userData.parity = 'dyn';
  const pole = new T.Mesh(new T.CylinderGeometry(0.035, 0.045, 4.6, 6), new T.MeshLambertMaterial({ color: '#e8e2d4' }));
  pole.position.y = 2.3; flag.add(pole);
  const knob = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), new T.MeshLambertMaterial({ color: '#f2b632' })); knob.position.y = 4.64; flag.add(knob);
  const clothGeo = new T.PlaneGeometry(1.1, 0.6, 10, 4); clothGeo.translate(0.55, 0, 0);
  const cols: number[] = [];
  const pos0 = (clothGeo.attributes.position.array as Float32Array).slice();
  for (let i = 0; i < pos0.length; i += 3) { const y = pos0[i + 1], x = pos0[i]; const c = new T.Color(Math.abs(y) < 0.09 ? '#fffaf1' : (x > 0.85 ? '#f2b632' : '#2fa39d')); cols.push(c.r, c.g, c.b); }
  clothGeo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  const cloth = new T.Mesh(clothGeo, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }));
  cloth.position.y = 4.25; flag.add(cloth);
  flag.position.set(4.55, 0, -10.5);
  let flagT = 0;
  function flagUpdate(dt: number) {
    const zr = d.zoneRoot();
    if (zr && flag.parent !== zr) { flag.parent?.remove(flag); zr.add(flag); }
    if (!flag.parent) return;
    const w = Math.min(1, Math.max(d.wind ? d.wind() : 0, Math.abs(crowdWeather.lean) * 4));
    flagT += dt * (3 + w * 5);
    const a = clothGeo.attributes.position as T.BufferAttribute, arr = a.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = pos0[i], k = x / 1.1;
      arr[i + 2] = Math.sin(flagT - x * 5) * 0.09 * k * (1 + w);
      arr[i + 1] = pos0[i + 1] - k * k * 0.12 * (1 - w) + Math.sin(flagT * 1.3 - x * 4) * 0.02 * k;
    }
    a.needsUpdate = true;
    cloth.rotation.y = -0.4 + Math.sin(flagT * 0.21) * 0.25;
  }

  // ── run dust + stop puff, customers blowing tea / crumbs
  let dustT = 0, lastSpeed = 0, custT = 2;
  const head: Vec3 = { x: 0, y: 0, z: 0 };
  const SIP = ACT_ORDER.indexOf('sip'), EAT = ACT_ORDER.indexOf('eat');
  function customers() {
    const A = d.agents?.(); if (!A || !d.crowdHead) return;
    const act = A.u8('act'), flags = A.u16('flags'), hi = Math.min(A.hi, 256);
    let done = 0;
    const start = Math.floor(Math.random() * Math.max(1, hi));
    for (let k = 0; k < hi && done < 2; k++) {
      const i = (start + k) % hi;
      if (!A.alive(i) || !(flags[i] & AGENT_FLAG.visible)) continue;
      if (act[i] !== SIP && act[i] !== EAT) continue;
      if (Math.random() < 0.6) continue;
      if (!d.crowdHead(i, head)) continue;
      if (act[i] === SIP) { play('blowSteam', at3(head.x, head.y - 0.12, head.z)); if (!done) d.sfx('blow', { x: head.x, z: head.z }); }
      else play('crumbs', at3(head.x, head.y - 0.2, head.z));
      done++;
    }
  }

  return {
    update(dt: number) {
      clock += dt;
      // coins in flight: hop arc to the money pill, sparkle on landing
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i]; c.t += dt;
        const u = Math.max(0, Math.min(1, c.t / c.dur)), e = u * u * (3 - 2 * u);
        const x = c.x0 + (c.x1 - c.x0) * e, y = c.y0 + (c.y1 - c.y0) * e - Math.sin(u * Math.PI) * c.h - Math.abs(Math.sin(u * Math.PI * 3)) * 10 * (1 - u);
        c.el.style.transform = `translate(${(x - c.x0).toFixed(1)}px,${(y - c.y0).toFixed(1)}px) scale(${(1 - u * 0.35).toFixed(2)})`;
        c.el.style.left = c.x0 + 'px'; c.el.style.top = c.y0 + 'px';
        c.el.style.opacity = c.t < 0 ? '0' : '1';
        if (u >= 1) { c.el.remove(); coins.splice(i, 1); sparkAt(c.x1, c.y1); }
      }
      if (popWait && (popWait.t -= dt) <= 0) popNew();
      // dust
      const s = d.speed();
      if (s > 3.4) { dustT -= dt; if (dustT <= 0) { dustT = 0.2; play('dust', heroAt(0.05), 0.8); } }
      if (lastSpeed > 2.8 && s < 0.4) { play('dust', heroAt(0.05), 1.2); d.sfx('puff'); }
      lastSpeed = s;
      // spray
      sprayT -= dt;
      if (sprayT <= 0) { const w = Math.abs(crowdWeather.lean) * 4; sprayT = (w > 0.3 ? 2 : 6) + Math.random() * 5; spray(1); }
      custT -= dt;
      if (custT <= 0) { custT = 1.8 + Math.random() * 1.5; try { customers(); } catch { /* */ } }
      try { flagUpdate(dt); } catch { /* */ }
    },
    dispose() {
      offs.forEach(o => { try { o(); } catch { /* */ } }); offs.length = 0;
      for (const c of coins) c.el.remove(); coins.length = 0;
      mo?.disconnect(); style?.remove();
      flag.parent?.remove(flag); clothGeo.dispose();
    },
  };
}
