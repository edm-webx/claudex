// Müşteri istekleri, view side (musteri-2, musteri-4, musteri-7): mood face + special request line inside the
// customer order bubble, and the small white camera flash when a tourist photographs the büfe. DOM only; the
// sim (src/game/sim/musteri.ts) decides everything. CSS is injected once.

let styled = false;
function ensureStyle(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const st = document.createElement('style');
  st.textContent = `
.sb-lab .bubble .bf{font-size:17px;line-height:1;margin-right:2px;filter:drop-shadow(0 1px 0 rgba(59,42,32,.25))}
.sb-lab .bubble .br{font:900 12px/1.1 var(--body);color:#b0406a;background:#fff0f3;border:1.5px dashed #e58aa8;border-radius:9px;padding:1px 6px 2px;white-space:nowrap}
.sb-photo{position:fixed;left:0;top:0;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;pointer-events:none;z-index:60;
background:radial-gradient(circle,#fff 0,rgba(255,255,255,.95) 22%,rgba(255,255,255,.4) 48%,rgba(255,255,255,0) 70%);animation:sb-photo .55s ease-out forwards}
.sb-photo-full{position:fixed;inset:0;background:#fff;pointer-events:none;z-index:59;animation:sb-photo-full .35s ease-out forwards}
@keyframes sb-photo{0%{transform:scale(.2);opacity:0}15%{transform:scale(1.15);opacity:1}100%{transform:scale(1.6);opacity:0}}
@keyframes sb-photo-full{0%{opacity:.35}100%{opacity:0}}`;
  document.head.appendChild(st);
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Happy / neutral / sulky by remaining patience (0..1). */
export function moodFace(k: number): string { return k > 0.6 ? '😊' : k > 0.3 ? '😐' : '😤'; }

/** Adds the mood face (front of the icon row) and the request line (under the icons) to a v2 bubble body. */
export function musteriBubble(html: string, c: { req?: string }, k: number): string {
  ensureStyle();
  const face = `<span class="bf">${moodFace(k)}</span>`;
  let s = html.includes('<div class="bi">') ? html.replace('<div class="bi">', '<div class="bi">' + face) : `<div class="bi">${face}</div>` + html;
  if (c.req) {
    const line = `<div class="br">${esc(c.req)}</div>`;
    const i = s.indexOf('<div class="bt">'), j = s.indexOf('<div class="bp">');
    const at = i >= 0 ? i : j >= 0 ? j : s.length;
    s = s.slice(0, at) + line + s.slice(at);
  }
  return s;
}

/** Small white camera flash at a screen point (plus a faint full-screen blink). */
export function photoFlash(x: number, y: number): void {
  ensureStyle();
  if (typeof document === 'undefined') return;
  const root = (document.querySelector('#app') as HTMLElement | null) || document.body;
  const f = document.createElement('div'); f.className = 'sb-photo'; f.style.left = x + 'px'; f.style.top = y + 'px';
  const g = document.createElement('div'); g.className = 'sb-photo-full';
  root.appendChild(g); root.appendChild(f);
  setTimeout(() => { f.remove(); g.remove(); }, 700);
}
