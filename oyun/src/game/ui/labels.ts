// World labels with HTML bodies (integrator, M1): a 1:1 port of v2 ui.js U.label (pooled DOM nodes in .sb-labels,
// set(x, y, html, cls) in screen pixels, max 8 thought bubbles, patience-bar patch in place, --dx edge shift, tappable
// labels). The engine Ui.label (M0) only carries escaped text, the v2 bubbles need icon rows and patience bars.
// CSS (.sb-lab, .bubble, .say, .slow, .ring, .tag, .zz, .hearts, .icon) comes from engine/ui/v2-style.

export interface HtmlLabel {
  onTap: (() => void) | null;
  set(x: number, y: number, html: string | number, cls?: string): HtmlLabel;
  hide(): HtmlLabel;
  free(): void;
  readonly visible: boolean;
}
export interface HtmlLabels { label(): HtmlLabel; dispose(): void; }

const MAX_BUBBLES = 3;
const MAX_SAY = 2;
const SAY_MS = 3500;
const BP_RE = /<div class="bp"><i style="([^"]*)"><\/i><\/div>/;
const CENTERED = /(^|\s)(bubble|say|tag|price|full|zz)(\s|$)/;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function createHtmlLabels(root: HTMLElement): HtmlLabels {
  let host = root.querySelector('.sb-labels') as HTMLElement | null;
  if (!host) { host = document.createElement('div'); host.className = 'sb-labels'; root.insertBefore(host, root.firstChild); }
  const H = host;
  const pool: HTMLDivElement[] = [];
  const bubbleSet = new Set<number>();
  const saySet = new Set<number>();
  let n = 0;
  type El = HTMLDivElement & { _h?: HtmlLabel | null };
  const makeEl = (): El => { const o = document.createElement('div') as El; o.className = 'sb-lab'; o.appendChild(document.createElement('div')); o.style.display = 'none'; H.appendChild(o); return o; };
  const onDown = (e: Event) => {
    const t = (e.target as Element | null)?.closest?.('.sb-lab.tap') as El | null;
    if (t && t._h && typeof t._h.onTap === 'function') { e.stopPropagation(); try { t._h.onTap(); } catch (err) { console.error('[labels] tap', err); } }
  };
  document.addEventListener('pointerdown', onDown, true);

  function label(): HtmlLabel {
    const id = ++n;
    let el: El | null = null, lastHtml: string | null = null, lastKey: string | null = null, lastCls: string | null = null;
    let lx = -1e9, ly = -1e9, shown = false, isBubble = false, isSay = false, sayHtml = '', sayT0 = 0, freed = false, w = 0, dirty = true, ldx = 0;
    const inner = () => el!.firstChild as HTMLDivElement;
    const acquire = () => { if (el) return; el = (pool.pop() as El | undefined) || makeEl(); el._h = h; };
    const showEl = (v: boolean) => { if (v !== shown) { shown = v; el!.style.display = v ? '' : 'none'; } };
    const h: HtmlLabel = {
      onTap: null,
      set(x, y, html, cls) {
        if (freed) return h;
        acquire();
        cls = cls || 'bubble';
        const wantBubble = /(^|\s)bubble(\s|$)/.test(cls);
        if (wantBubble && !isBubble) {
          if (bubbleSet.size >= MAX_BUBBLES) { showEl(false); return h; }
          bubbleSet.add(id); isBubble = true;
        } else if (!wantBubble && isBubble) { bubbleSet.delete(id); isBubble = false; }
        const wantSay = /(^|\s)say(\s|$)/.test(cls);
        if (wantSay) {
          const hs = String(html);
          const now = performance.now();
          if (hs !== sayHtml) { sayHtml = hs; sayT0 = now; }
          if (now - sayT0 > SAY_MS || (!isSay && saySet.size >= MAX_SAY)) { if (isSay) { saySet.delete(id); isSay = false; } sayHtml = ''; showEl(false); return h; }
          if (!isSay) { saySet.add(id); isSay = true; }
        } else if (isSay) { saySet.delete(id); isSay = false; sayHtml = ''; }
        const vw = window.innerWidth, vh = window.innerHeight;
        if (!(x > -120 && x < vw + 120 && y > -120 && y < vh + 160)) { showEl(false); return h; }
        if (cls !== lastCls) { lastCls = cls; inner().className = cls; dirty = true; }
        if (typeof html === 'number') {
          if (lastHtml !== '') { inner().innerHTML = ''; lastHtml = lastKey = ''; dirty = true; }
          inner().style.setProperty('--p', clamp(html, 0, 1).toFixed(3));
        } else if (html !== lastHtml) {
          const s = html == null ? '' : String(html);
          let bs: string | null = null;
          const key = s.replace(BP_RE, (_m0, st: string) => { bs = st; return '<div class="bp"></div>'; });
          const bar = bs !== null && key === lastKey ? inner().querySelector('.bp i') : null;
          if (bar) bar.setAttribute('style', bs as unknown as string);
          else { inner().innerHTML = s; dirty = true; }
          lastHtml = s; lastKey = key;
        }
        const rx = Math.round(x * 2) / 2, ry = Math.round(y * 2) / 2;
        if (rx !== lx || ry !== ly) { lx = rx; ly = ry; el!.style.transform = `translate3d(${rx}px,${ry}px,0)`; }
        const tap = typeof h.onTap === 'function';
        if (tap !== el!.classList.contains('tap')) el!.classList.toggle('tap', tap);
        const wasShown = shown;
        showEl(true);
        if (dirty || !wasShown) { dirty = false; w = CENTERED.test(cls) ? inner().offsetWidth : 0; }
        if (w) {
          const half = w / 2, m = 6, lim = Math.max(0, half - 18);
          let dx = rx - half < m ? m - (rx - half) : rx + half > vw - m ? vw - m - (rx + half) : 0;
          dx = Math.round(clamp(dx, -lim, lim));
          if (dx !== ldx) { ldx = dx; inner().style.setProperty('--dx', dx + 'px'); }
        } else if (ldx) { ldx = 0; inner().style.removeProperty('--dx'); }
        return h;
      },
      hide() { if (isBubble) { bubbleSet.delete(id); isBubble = false; } if (isSay) { saySet.delete(id); isSay = false; } sayHtml = ''; if (el) showEl(false); return h; },
      free() {
        h.hide(); freed = true;
        if (el) {
          el.classList.remove('tap'); inner().innerHTML = ''; inner().className = ''; inner().style.removeProperty('--p'); inner().style.removeProperty('--dx');
          el._h = null; pool.push(el); el = null;
        }
        lastHtml = lastKey = lastCls = null; ldx = 0; w = 0; dirty = true;
      },
      get visible() { return shown; },
    };
    return h;
  }
  return {
    label,
    dispose() { document.removeEventListener('pointerdown', onDown, true); },
  };
}
