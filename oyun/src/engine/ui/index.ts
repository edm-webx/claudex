// Engine UI layer (Builder D). DOM over the canvas, a 1:1 TS port of v2 js/ui.js (CSS, HUD, toasts, pooled labels,
// day card, sheets) so the look matches v2 screenshots. Game panels (isciler, menu, ...) are ported in M1 (src/game/ui).
//
// Decisions (contract silent):
// - Root is <div id="sbui"> inside deps.root, same id/classes as v2 so the ported CSS applies unchanged.
//   CSS is injected once as <style id="sbui-style"> (the vite build must not emit .css files).
// - HUD taps dispatch DOM CustomEvents on ui.root: 'ui:open' (detail 'ayarlar' | 'karne'), 'ui:mute' (detail bool),
//   sheets dispatch 'ui:close' (detail id). Mute also flips the audio buses when deps.audio is given.
// - hud(): accepts v2 fields (clock, dayProgress, levelProgress, streak, muted) through the HudPatch index signature;
//   `hour` (8..24) becomes the v2 clock text (10-minute steps) and day progress when clock/dayProgress are absent.
// - label(): WorldLabel kinds map to v2 classes: say->say, good->'bubble praise', bad->'bubble angry', info->bubble,
//   icon->icon (text = icon name). Max 8 bubble labels visible (v2 rule). Positioned in update() via the projector.
// - sheet(id, model): model may carry { title, sub, icon, acc, html, foot }; without html a friendly "Yakında" body
//   (v2 rule for unknown ids). Elements with data-a="<name>" call actions[name](data-id, data-v).
// - transition('kepenk'): full-screen shutter rolls down then up (v2 kepenk stripes); 'spring': quick soft flash.
// - setMode('parity'): only the HUD stays; 'hidden': nothing (photo mode).
import type { Ui, UiDeps, HudPatch, WorldLabel, CenterCard, Notice, Vec3, ScreenPt, UiSettings } from '../api';
import { CSS, ICONS } from './v2-style';

export const esc = (s: unknown): string => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const num = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
export const fmt = (n: number) => {
  n = n || 0; const a = Math.abs(n);
  const q = (d: number, u: string) => { const x = Math.round((a / d) * 10) / 10; return (n < 0 ? '-' : '') + (x % 1 === 0 ? String(x) : x.toFixed(1)) + u; };
  if (a >= 1e12) return q(1e12, 'T'); if (a >= 1e9) return q(1e9, 'B'); if (a >= 1e6) return q(1e6, 'M');
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};
export const tl = (n: number) => fmt(n) + ' ₺';
export function mk<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e;
}
/** v2 clockText: hour float -> "HH:M0". */
export function clockText(h: number): string {
  const hh = Math.floor(h) % 24, mm = Math.floor(((h % 1) * 60) / 10) * 10;
  return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
}
export { ICONS, CSS };

const EXTRA_CSS = `
.sb-kep{position:absolute;inset:0;z-index:80;pointer-events:auto;background:repeating-linear-gradient(180deg,#bdb5aa 0 14px,#8d857b 14px 18px);border-bottom:6px solid var(--ink);transform:translateY(-102%);transition:transform .45s cubic-bezier(.5,0,.3,1)}
.sb-kep.down{transform:translateY(0)}
.sb-kep::after{content:"";position:absolute;left:50%;bottom:18px;width:64px;height:12px;margin-left:-32px;border-radius:5px;background:var(--ink)}
.sb-spring{position:absolute;inset:0;z-index:80;pointer-events:none;background:var(--cream);opacity:0;transition:opacity .18s}
.sb-spring.on{opacity:.55}
#sbui.m-parity>:not(.sb-hud){display:none!important}
#sbui.m-hidden{display:none!important}
`;

const KIND_CLS: Record<string, string> = { say: 'say', good: 'bubble praise', bad: 'bubble angry', info: 'bubble', icon: 'icon' };
const MAX_BUBBLES = 3;
const CENTERED = /(^|\s)(bubble|say|tag|price|full|zz)(\s|$)/;

export function createUi(deps: UiDeps): Ui {
  const host = deps.root;
  if (!document.getElementById('sbui-style')) {
    const st = document.createElement('style'); st.id = 'sbui-style'; st.textContent = CSS + EXTRA_CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  const root = mk('div'); root.id = 'sbui'; root.setAttribute('lang', 'tr');
  host.appendChild(root);
  const labelsEl = root.appendChild(mk('div', 'sb-labels'));
  root.appendChild(mk('div', 'sb-floats'));
  const emit = (name: string, detail: unknown) => { try { root.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) { console.warn(e); } };
  const sfx = (id: string) => { try { deps.audio?.sfx(id); } catch { /* audio optional */ } };

  // ---------- HUD (v2 buildHud) ----------
  const hud = root.appendChild(mk('div', 'sb-hud off'));
  hud.innerHTML = `
    <button class="sb-lvl" data-h="karne" aria-label="Esnaf Seviyesi ve karne"><span class="sb-lvl-in">1</span><small>ESNAF</small></button>
    <div class="sb-hmid">
      <div class="sb-hl">
        <div class="sb-pill sb-money" aria-label="Para">${ICONS.coin}<b>0</b></div>
        <div class="sb-pill sb-gold" aria-label="Altın Simit">${ICONS.gold}<b>0</b></div>
      </div>
      <div class="sb-hl">
        <div class="sb-pill sb-day" aria-label="Gün ve saat"><span class="dic">${ICONS.sun}</span><b>GÜN 1</b><span class="clk">08:00</span><i class="sb-dbar"></i></div>
        <button class="sb-stars" data-h="karne" aria-label="Yıldızlar"></button>
      </div>
    </div>
    <div class="sb-hbtns">
      <button class="sb-ib" data-h="ayarlar" aria-label="Ayarlar">${ICONS.gear}</button>
      <button class="sb-ib" data-h="mute" aria-label="Sesi kapat">${ICONS.sound}</button>
    </div>
    <div class="sb-streak" hidden>${ICONS.flame}<span>SERİ ×2</span></div>`;
  const q = (s: string) => hud.querySelector(s) as HTMLElement;
  const L = {
    lvl: q('.sb-lvl'), lvlN: q('.sb-lvl-in'),
    money: q('.sb-money b'), moneyPill: q('.sb-money'),
    gold: q('.sb-gold b'), goldPill: q('.sb-gold'),
    dayIc: q('.sb-day .dic'), dayN: q('.sb-day b'), clock: q('.sb-day .clk'), dbar: q('.sb-dbar'),
    stars: q('.sb-stars'), mute: q('[data-h="mute"]'), streak: q('.sb-streak'),
  };
  const toasts = root.appendChild(mk('div', 'sb-toasts'));
  const S: Record<string, unknown> = {};
  let hudShown = false;
  const setMuteIcon = (m: boolean) => { L.mute.innerHTML = m ? ICONS.mute : ICONS.sound; L.mute.setAttribute('aria-label', m ? 'Sesi aç' : 'Sesi kapat'); };
  const setStars = (n: number) => { let s = ''; for (let i = 0; i < 5; i++) s += i < n ? ICONS.star : ICONS.starOff; L.stars.innerHTML = s; L.stars.setAttribute('aria-label', n + ' yıldız'); };
  const bump = (el: HTMLElement) => { el.classList.remove('sb-bump'); void el.offsetWidth; el.classList.add('sb-bump'); };
  const setMuted = (m: boolean) => { if (deps.audio) for (const b of Object.values(deps.audio.buses)) b.muted = m; };
  hud.addEventListener('click', e => {
    const b = (e.target as Element).closest('[data-h]') as HTMLElement | null; if (!b) return;
    const k = b.dataset.h as string;
    if (k === 'mute') { const m = !S.muted; S.muted = m; setMuted(m); if (!m) deps.audio?.unlock(); setMuteIcon(m); emit('ui:mute', m); }
    else emit('ui:open', k);
  });
  root.addEventListener('pointerdown', e => {
    const b = (e.target as Element).closest?.('.sb-btn,.sb-bi,.sb-ib,.sb-x,.sb-tog,.sb-seg button') as HTMLButtonElement | null;
    if (b && !b.disabled && !b.classList.contains('off')) { sfx('pop'); if (settings.haptics) deps.platform.vibrate(8); }
  }, { passive: true });
  setStars(0);
  const measure = () => {
    const hb = hudShown ? hud.getBoundingClientRect().bottom : 0;
    root.style.setProperty('--hudb', Math.max(0, Math.round(hb)) + 'px');
  };
  window.addEventListener('resize', measure);

  function hudPatch(p: HudPatch) {
    if (!hudShown) { hudShown = true; hud.classList.remove('off'); requestAnimationFrame(measure); }
    if (num(p.money) && p.money !== S.money) { const up = num(S.money) && p.money > S.money; S.money = p.money; L.money.textContent = fmt(p.money); if (up) bump(L.moneyPill); }
    if (num(p.gold) && p.gold !== S.gold) { const up = num(S.gold) && p.gold > S.gold; S.gold = p.gold; L.gold.textContent = fmt(p.gold); if (up) bump(L.goldPill); }
    if (p.day != null && p.day !== S.day) { S.day = p.day; L.dayN.textContent = 'GÜN ' + p.day; }
    const clock = p.clock != null ? String(p.clock) : num(p.hour) ? clockText(p.hour) : null;
    if (clock != null && clock !== S.clock) {
      S.clock = clock; L.clock.textContent = clock;
      const hr = parseInt(clock, 10), night = num(hr) && (hr >= 19 || hr < 6);
      if (night !== S.night) { S.night = night; L.dayIc.innerHTML = night ? ICONS.moon : ICONS.sun; }
    }
    const dp = num(p.dayProgress) ? p.dayProgress : num(p.hour) ? (p.hour - 8) / 16 : null;
    if (dp != null && dp !== S.dayProgress) { S.dayProgress = dp; L.dbar.style.width = (clamp(dp, 0, 1) * 100).toFixed(1) + '%'; }
    if (num(p.stars) && p.stars !== S.stars) { S.stars = p.stars; setStars(clamp(Math.floor(p.stars), 0, 5)); }
    if (p.level != null && p.level !== S.level) { S.level = p.level; L.lvlN.textContent = String(p.level); }
    const lp = num(p.levelProgress) ? p.levelProgress : num(p.xp) && num(p.xpMax) && p.xpMax > 0 ? p.xp / p.xpMax : null;
    if (lp != null && lp !== S.levelProgress) { S.levelProgress = lp; L.lvl.style.setProperty('--p', clamp(lp, 0, 1).toFixed(3)); }
    if (p.streak != null && p.streak !== S.streak) {
      const prev = (S.streak as number) || 0, st = Number(p.streak); S.streak = st;
      if (st >= 2) { L.streak.hidden = false; (L.streak.querySelector('span') as HTMLElement).textContent = 'SERİ ×' + st; if (st > prev) { L.streak.classList.remove('pop'); void L.streak.offsetWidth; L.streak.classList.add('pop'); } }
      else L.streak.hidden = true;
    }
    if (p.muted != null && !!p.muted !== S.muted) { S.muted = !!p.muted; setMuteIcon(!!p.muted); }
  }

  // ---------- toasts (v2) ----------
  const toastQ: Array<[string, 'good' | 'bad' | 'info']> = [];
  let toastBusy = false, lastToast = '';
  function toastNext() {
    const it = toastQ.shift(); if (!it) { toastBusy = false; return; }
    toastBusy = true;
    const [text, kind] = it;
    const ic = kind === 'good' ? ICONS.check : kind === 'bad'
      ? '<svg viewBox="0 0 48 48"><path d="M24 11v16" stroke="#fff" stroke-width="7" stroke-linecap="round"/><circle cx="24" cy="37" r="4" fill="#fff"/></svg>'
      : '<svg viewBox="0 0 48 48"><circle cx="24" cy="12" r="4.5" fill="#fff"/><path d="M24 22v16" stroke="#fff" stroke-width="7" stroke-linecap="round"/></svg>';
    const t = mk('div', 'sb-toast ' + kind, `<i>${ic}</i><span>${esc(text)}</span>`);
    toasts.appendChild(t);
    while (toasts.children.length > 1) toasts.firstChild!.remove();
    if (kind === 'bad') sfx('bad');
    setTimeout(() => { t.classList.add('out'); setTimeout(() => { t.remove(); toastNext(); }, 320); }, 2200);
  }
  function toast(text: string, kind: 'good' | 'bad' | 'info') {
    kind = kind || 'info';
    if (text === lastToast && toastBusy) return;
    if (kind === 'info' && toastQ.length >= 1) return;
    if (toastQ.length >= 3) toastQ.shift();
    lastToast = text; toastQ.push([text, kind]);
    if (!toastBusy) toastNext();
  }

  // ---------- pooled world labels ----------
  interface LabelRec { el: HTMLDivElement; inner: HTMLDivElement; cls: string; html: string; world: Vec3 | null; on: boolean; shown: boolean; bubble: boolean; dirty: boolean; lx: number; ly: number; free: boolean; }
  const pool: LabelRec[] = [];
  const live = new Set<LabelRec>();
  let bubbles = 0;
  const scr: ScreenPt = { x: 0, y: 0 };
  function newRec(): LabelRec {
    const el = mk('div', 'sb-lab'); const inner = el.appendChild(mk('div')); el.style.display = 'none'; labelsEl.appendChild(el);
    return { el, inner, cls: '', html: '', world: null, on: false, shown: false, bubble: false, dirty: true, lx: -1e9, ly: -1e9, free: false };
  }
  const showEl = (r: LabelRec, v: boolean) => {
    if (v === r.shown) return;
    if (v && r.bubble) { if (bubbles >= MAX_BUBBLES) return; bubbles++; }
    else if (!v && r.bubble) bubbles--;
    r.shown = v; r.el.style.display = v ? '' : 'none';
  };
  function label(): WorldLabel {
    const r = pool.pop() || newRec(); r.free = false; r.on = true; r.world = null; live.add(r);
    return {
      set(text, kind) {
        if (r.free) return;
        const cls = KIND_CLS[kind || 'info'] || 'bubble';
        if (cls !== r.cls) { showEl(r, false); r.cls = cls; r.bubble = /(^|\s)bubble(\s|$)/.test(cls); r.inner.className = cls; r.dirty = true; }
        const html = cls === 'icon' ? (ICONS[text] || esc(text)) : `<span class="bt">${esc(text)}</span>`;
        if (html !== r.html) { r.html = html; r.inner.innerHTML = html; r.dirty = true; }
      },
      at(p) { if (!r.world) r.world = { x: 0, y: 0, z: 0 }; r.world.x = p.x; r.world.y = p.y; r.world.z = p.z; },
      show(on) { r.on = on; if (!on) showEl(r, false); },
      release() {
        if (r.free) return; showEl(r, false); r.free = true; live.delete(r);
        r.inner.innerHTML = ''; r.inner.className = ''; r.cls = r.html = ''; r.world = null; r.dirty = true; pool.push(r);
      },
    };
  }
  function update(_dt: number, project: (p: Vec3, out: ScreenPt) => boolean) {
    const vw = window.innerWidth, vh = window.innerHeight;
    for (const r of live) {
      if (!r.on || !r.world || !r.cls) { showEl(r, false); continue; }
      const ok = project(r.world, scr);
      if (!ok || !(scr.x > -120 && scr.x < vw + 120 && scr.y > -120 && scr.y < vh + 160)) { showEl(r, false); continue; }
      const rx = Math.round(scr.x * 2) / 2, ry = Math.round(scr.y * 2) / 2;
      if (rx !== r.lx || ry !== r.ly) { r.lx = rx; r.ly = ry; r.el.style.transform = `translate3d(${rx}px,${ry}px,0)`; r.dirty = true; }
      const was = r.shown; showEl(r, true);
      if (r.shown && (r.dirty || !was) && CENTERED.test(r.cls)) {
        r.dirty = false;
        const w = r.inner.offsetWidth, half = w / 2, m = 6, lim = Math.max(0, half - 18);
        const dx = Math.round(clamp(rx - half < m ? m - (rx - half) : rx + half > vw - m ? vw - m - (rx + half) : 0, -lim, lim));
        r.inner.style.setProperty('--dx', dx + 'px');
      }
    }
  }

  // ---------- center card (v2 day card look) ----------
  function card(c: CenterCard): Promise<void> {
    return new Promise(res => {
      const d = mk('div', 'sb-dayc');
      const ic = c.icon && ICONS[c.icon] ? ICONS[c.icon] : c.kind === 'day' ? ICONS.moon : ICONS.star;
      d.innerHTML = `<div class="dh">${ic}<span>${esc(c.title)}</span></div>`
        + (c.body ? `<div class="dc"><span>${esc(c.body)}</span></div>` : '')
        + `<div class="df">${c.button ? `<button class="sb-btn green wide" data-ok><span class="sb-bl">${esc(c.button)}</span></button>` : ''}</div><i class="dt"></i>`;
      root.appendChild(d);
      sfx(c.kind === 'day' ? 'day' : 'buy');
      requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('in')));
      let done = false;
      const hide = () => { if (done) return; done = true; d.classList.remove('in'); setTimeout(() => { d.remove(); res(); }, 500); };
      const bar = d.querySelector('.dt') as HTMLElement;
      try { bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: 4000, easing: 'linear', fill: 'forwards' }); } catch { /* old browsers */ }
      const t = setTimeout(hide, c.button ? 12000 : 4000);
      d.addEventListener('click', () => { clearTimeout(t); hide(); });
    });
  }

  // ---------- sheets ----------
  let sheet: HTMLElement | null = null;
  let acts: Record<string, (...a: any[]) => void> = {};
  function close() {
    if (!sheet) return;
    const s = sheet; sheet = null; s.classList.add('out'); setTimeout(() => s.remove(), 200);
  }
  function sheetFn(id: string, model: unknown, actions: Record<string, (...a: any[]) => void>) {
    const m = (model && typeof model === 'object' ? model : {}) as { title?: string; sub?: string; icon?: string; acc?: string; html?: string; foot?: string };
    acts = actions || {};
    if (!sheet || sheet.dataset.id !== id) {
      close();
      const s = sheet = mk('section', 'sb-sheet'); s.dataset.id = id; s.setAttribute('role', 'dialog');
      s.innerHTML = `<div class="sb-awn"></div><div class="sb-shh"><span class="hi"></span><h2></h2><button class="sb-x" data-a="__close" aria-label="Kapat">${ICONS.close}</button></div><div class="sb-shb"></div><div class="sb-shf" hidden></div>`;
      const onAct = (e: Event) => {
        const b = (e.target as Element).closest('[data-a]') as HTMLElement | null; if (!b) return;
        if (e.type === 'input' && b.tagName !== 'INPUT') return;
        if (e.type === 'click' && b.tagName === 'INPUT' && (b as HTMLInputElement).type === 'range') return;
        if (b.classList.contains('off') || (b as HTMLButtonElement).disabled) { if (b.dataset.why) toast(b.dataset.why, 'info'); return; }
        const a = b.dataset.a as string;
        if (a === '__close') { close(); emit('ui:close', id); acts.__close?.(); return; }
        const v = b.tagName === 'INPUT' ? (b as HTMLInputElement).value : b.dataset.v;
        try { acts[a]?.(b.dataset.id, v); } catch (err) { console.error('[ui] action', a, err); }
      };
      s.addEventListener('click', onAct); s.addEventListener('input', onAct);
      root.appendChild(s);
    }
    const s = sheet as HTMLElement;
    const title = m.title || id;
    const body = s.querySelector('.sb-shb') as HTMLElement, keep = body.scrollTop;
    s.setAttribute('aria-label', title);
    s.style.setProperty('--acc', m.acc || 'var(--blue)');
    (s.querySelector('.hi') as HTMLElement).innerHTML = ICONS[m.icon || id] || ICONS.sparkle;
    (s.querySelector('h2') as HTMLElement).innerHTML = esc(title) + (m.sub ? `<small>${esc(m.sub)}</small>` : '');
    body.innerHTML = m.html ?? `<div class="sb-muted" style="text-align:center;padding:24px 8px">Yakında burada olacak.</div>`;
    body.scrollTop = keep;
    const foot = s.querySelector('.sb-shf') as HTMLElement; foot.hidden = !m.foot; foot.innerHTML = m.foot || '';
  }

  // ---------- notices, transitions, modes ----------
  const notices: Notice[] = [];
  function transition(kind: 'kepenk' | 'spring'): Promise<void> {
    return new Promise(res => {
      if (kind === 'spring') {
        const f = root.appendChild(mk('div', 'sb-spring'));
        requestAnimationFrame(() => f.classList.add('on'));
        setTimeout(() => { f.classList.remove('on'); setTimeout(() => { f.remove(); res(); }, 200); }, 180);
        return;
      }
      const k = root.appendChild(mk('div', 'sb-kep'));
      sfx('drop');
      requestAnimationFrame(() => requestAnimationFrame(() => k.classList.add('down')));
      setTimeout(() => { k.classList.remove('down'); setTimeout(() => { k.remove(); res(); }, 480); }, 900);
    });
  }
  const settings: UiSettings = { textScale: 1, hand: 'right', colorBlindIcons: false, haptics: true, batterySaver: false };

  return {
    hud: hudPatch,
    toast,
    label,
    card,
    sheet: sheetFn,
    close,
    bell: {
      push(n) { notices.unshift(n); if (notices.length > 50) notices.length = 50; },
      list: () => notices.slice(),
    },
    transition,
    settings,
    update,
    setMode(m) {
      root.classList.toggle('m-parity', m === 'parity');
      root.classList.toggle('m-hidden', m === 'hidden');
    },
    root,
  };
}
