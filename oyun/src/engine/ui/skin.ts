/**
 * "Boğaz Gecesi" skin (2026-10-30 yeniden tasarım): every UI stylesheet was written in the old chunky brown cartoon look.
 * Instead of editing ~20 stylesheets, each <style> text is passed through reskin() once, so the whole interface moves to the
 * new look together: deep navy ink, porcelain surfaces, coral / teal / amber accents, hairline borders, soft shadows, glass blur.
 * Install once before any UI is built (installSkin). Canvas and 3D colours are not touched.
 */
const MAP: [RegExp, string][] = [
  [/#3b2a20/gi, '#16233b'], [/#6b4a33/gi, '#46557a'], [/#fff6e6/gi, '#f7f4ee'], [/#f6ead2/gi, '#e9e6df'], [/#fffaf1/gi, '#ffffff'],
  [/#fdf3e1/gi, '#f4f1ea'], [/#fdf3dc/gi, '#f4f1ea'], [/#fff3c4/gi, '#ffe9ad'], [/#e0533c/gi, '#ff5a4e'], [/#b8392a/gi, '#d63c33'],
  [/#5aa9d6/gi, '#43b3d9'], [/#2f7fb3/gi, '#1d78a8'], [/#2e2a5a/gi, '#101c3a'], [/#ffd23f/gi, '#ffb627'], [/#49b96a/gi, '#2fbf71'],
  [/#8fd06b/gi, '#35c98c'], [/#ff8b7a/gi, '#ff7b6e'], [/#e7d9bf/gi, '#d9dce3'], [/#b98a5e/gi, '#8a96b3'], [/#7d5638/gi, '#46557a'],
];
const SOFT = 'box-shadow:0 6px 18px rgba(16,28,52,.24)';
const EXTRA = `
#sbui .sb-sheet,#sbui .sb-modal,#sbui .sb-card,.mp-card{backdrop-filter:blur(14px) saturate(1.15);-webkit-backdrop-filter:blur(14px) saturate(1.15)}
.mp-card{background:rgba(244,241,234,.94)!important;box-shadow:0 18px 50px rgba(8,16,36,.45)!important}
.mp-bg{background:rgba(8,16,36,.55)!important}
#sbui .sb-btn,.mp-b,.mp-t,.mp-x{transition:transform .12s,filter .12s}
#sbui .sb-btn:hover,.mp-b:hover:not(:disabled),.mp-t:hover{filter:brightness(1.06)}
.mp-t.on{background:#101c3a!important;color:#fff!important}
.mp-hint{box-shadow:0 8px 24px rgba(8,16,36,.4)!important}
`;

export function reskin(css: string): string {
  let o = css;
  for (const [re, to] of MAP) o = o.replace(re, to);
  o = o.replace(/(border(?:-top|-bottom|-left|-right)?:\s*)(?:2\.5|3|4)px(\s+(?:solid|dashed))/g, '$11.5px$2');
  o = o.replace(/border-width:\s*(?:2\.5|3|4)px/g, 'border-width:1.5px');
  o = o.replace(/box-shadow:\s*0\s+\d+px\s+0\s+(?:#16233b|var\(--ink\))(?:\s*,[^;}"]*)?/g, SOFT);
  o = o.replace(/--shadow:0 3px 0 rgba\(59,42,32,\.35\)/g, '--shadow:0 4px 12px rgba(16,28,52,.22)');
  o = o.replace(/border-radius:(\d+)px/g, (_m, n) => 'border-radius:' + Math.round(Number(n) * 1.15) + 'px');
  if (/\.mp-card|#sbui\{/.test(css)) o += EXTRA;
  return o;
}

/** Scene grade: light contrast/saturation lift on the 3D canvas and a soft vignette so the world sits under the glass UI. */
function installGrade(): void {
  const add = () => {
    if (document.getElementById('sb-grade')) return;
    const st = document.createElement('style'); st.id = 'sb-grade';
    st.textContent = 'canvas{filter:saturate(1.1) contrast(1.05)}#sb-vig{position:fixed;inset:0;pointer-events:none;z-index:5;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 58%,rgba(8,16,36,.28) 100%)}';
    document.head.appendChild(st);
    const v = document.createElement('div'); v.id = 'sb-vig'; document.body.appendChild(v);
  };
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
}

export function installSkin(): void {
  if (typeof HTMLStyleElement === 'undefined') return;
  installGrade();
  const d = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  if (!d || !d.set || !d.get) return;
  const get = d.get, set = d.set;
  Object.defineProperty(HTMLStyleElement.prototype, 'textContent', {
    configurable: true,
    get() { return get.call(this); },
    set(v: string | null) { set.call(this, typeof v === 'string' ? reskin(v) : v); },
  });
}
