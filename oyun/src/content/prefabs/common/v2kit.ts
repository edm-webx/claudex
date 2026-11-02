/**
 * Shared v2 look kit (content): palette, seeded rng, canvas helpers, the 1024² print atlas, repeating world textures
 * and the shared materials (v2 world.js `K`, `R`, `MAT`). Ported 1:1 so prefab ports look identical.
 * Decisions:
 * - Lazy: nothing touches `document` at import time (content may be imported headless). Builders call `ensureKit()`.
 * - Build order and the shared `rnd` stream (seed 7331) match v2 module load order exactly (atlas, plank, stone,
 *   tile new, tile worn, floor, radial; drawSign keeps drawing from the same stream later), so textures are identical.
 * - Anisotropy 4 everywhere (v2 world.js ran before the renderer existed, so C.canvasTex used 4).
 */
import * as T from 'three';
import { Batch, PI, TAU, type UVRect } from '../../../engine/prefab/batch';

type G = CanvasRenderingContext2D;
interface TxtOpts { w?: number; fam?: string; align?: CanvasTextAlign; stroke?: string; lw?: number; max?: number; }

/** v2 world.js palette (GDD "Martıköy paleti"). */
export const K = {
  red: '#e0533c', redDeep: '#c23e2c', tea: '#d9822b', sesame: '#ebc07a', cream: '#fff6e6', wood: '#b98a5e', woodDark: '#7d5638',
  woodLight: '#d6aa78', stone: '#cfc8be', sea: '#5aa9d6', foam: '#bfe6e9', grey: '#a3acb5', cini: '#3fb5b0', tulip: '#f2a2b3',
  olive: '#8daa5b', yellow: '#ffd23f', money: '#49b96a', warn: '#e63946', night: '#2e2a5a', neonPink: '#ff5fa2', neonTeal: '#49e6d8',
  navy: '#2b3a55', blue: '#1d5fa8', sky: '#5b9bd5', steel: '#cdd5dc', steelDark: '#8c969e', iron: '#3c4146', black: '#2a2624',
  white: '#fbfaf6', paint: '#f3ead8', gold: '#f2b632', goldDeep: '#d4952a', copper: '#c8743a', rust: '#9a5a3a', rustDark: '#6b3a24',
  lamp: '#33524a', leaf: '#6f9e4f', leafDark: '#557f3c', meat: '#9c5428', chicken: '#d9a066', lavash: '#f1dcae', tomato: '#e0533c',
  glass: '#cfe8f0', teaRed: '#b5361e', ayran: '#fbfbf7', terracotta: '#c8693e', pink: '#f2a2b3', purple: '#8a6bbf', orange: '#f08a3c'
};

/** v2 core.js C.PAL (kept for ports that used it). */
export const PAL = { kioskRed: '#d8433a', bosphorus: '#3f8fc9', sea: '#4aa3d8', tea: '#c8781e', wood: '#a8774f', woodDark: '#7d5638', gullWhite: '#f4f2ec', gullGrey: '#a9b3bd', cream: '#f6ead2', mint: '#7fcfb3', sky: '#9fd3f5', tile: '#1d5fa8', rust: '#9a5a3a', gold: '#f2b632', ink: '#3b2f2a' };

/** v2 core.js C.rng (mulberry32). Pure. */
export interface V2Rng { next(): number; range(a: number, b: number): number; int(a: number, b: number): number; pick<X>(arr: readonly X[]): X; chance(p: number): boolean; }
export function v2rng(seed: number): V2Rng {
  let s = (seed >>> 0) || 1;
  const next = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  return {
    next,
    range: (a, b) => a + next() * (b - a),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
  };
}
/** Shared texture-drawing stream (v2 `rnd`). */
export const rnd = v2rng(7331);

export function canvasTex(w: number, h: number, draw: (g: G, w: number, h: number) => void, rep?: [number, number]): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
export const rrect = (g: G, x: number, y: number, w: number, h: number, r: number): void => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
export const fitText = (g: G, s: string, x: number, y: number, max: number): void => { const m = g.measureText(s).width; if (m > max) { g.save(); g.translate(x, y); g.scale(max / m, 1); g.fillText(s, 0, 0); g.restore(); } else g.fillText(s, x, y); };

/* ---------- canvas atlas ---------- */
const AW = 1024, AH = 1024, APAD = 4;
let atlasCanvas: HTMLCanvasElement;
let ag: G;
let shX = 0, shY = 0, shH = 0;
/** Atlas regions (uv rects), filled by ensureKit(). */
export const R: Record<string, UVRect> = {};
function region(name: string, w: number, h: number, bg: string | null, draw?: (g: G, w: number, h: number) => void): UVRect {
  if (shX + w + APAD * 2 > AW) { shX = 0; shY += shH; shH = 0; }
  const x = shX + APAD, y = shY + APAD;
  ag.save();
  if (bg) { ag.fillStyle = bg; ag.fillRect(x - APAD, y - APAD, w + APAD * 2, h + APAD * 2); }
  ag.translate(x, y); ag.beginPath(); ag.rect(0, 0, w, h); ag.clip();
  if (draw) draw(ag, w, h);
  ag.restore();
  shX += w + APAD * 2; shH = Math.max(shH, h + APAD * 2);
  return (R[name] = [(x + 0.5) / AW, 1 - (y + h - 0.5) / AH, (x + w - 0.5) / AW, 1 - (y + 0.5) / AH]);
}
const font = (w: number, px: number, fam?: string) => `${w} ${px}px ${fam || '"Trebuchet MS", "Segoe UI", Roboto, Arial, sans-serif'}`;
export function txt(g: G, s: string, x: number, y: number, px: number, color: string, o: TxtOpts = {}): void {
  g.font = font(o.w || 800, px, o.fam); g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
  if (o.stroke) { g.lineWidth = o.lw || px * 0.18; g.strokeStyle = o.stroke; g.lineJoin = 'round'; o.max ? strokeFit(g, s, x, y, o.max) : g.strokeText(s, x, y); }
  g.fillStyle = color; o.max ? fitText(g, s, x, y, o.max) : g.fillText(s, x, y);
}
function strokeFit(g: G, s: string, x: number, y: number, max: number): void { const m = g.measureText(s).width; if (m > max) { g.save(); g.translate(x, y); g.scale(max / m, 1); g.strokeText(s, 0, 0); g.restore(); } else g.strokeText(s, x, y); }
function speckle(g: G, w: number, h: number, n: number, c: string, rmin: number, rmax: number): void { g.fillStyle = c; for (let i = 0; i < n; i++) { g.beginPath(); g.ellipse(rnd.next() * w, rnd.next() * h, rmin + rnd.next() * (rmax - rmin), rmin * 0.6 + rnd.next() * rmin, rnd.next() * PI, 0, TAU); g.fill(); } }

function buildAtlas(): void {
  region('white', 24, 24, '#ffffff');
  region('grain', 64, 64, '#ffffff', (g, w, h) => {
    for (let i = 0; i < 22; i++) { g.strokeStyle = `rgba(90,55,25,${0.05 + rnd.next() * 0.07})`; g.lineWidth = 1 + rnd.next() * 2; const y = rnd.next() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + rnd.range(-4, 4), w * 0.6, y + rnd.range(-4, 4), w, y + rnd.range(-3, 3)); g.stroke(); }
  });
  region('rust', 64, 64, '#ffffff', (g, w, h) => {
    for (let i = 0; i < 14; i++) { const x = rnd.next() * w, y = rnd.next() * h, r = 3 + rnd.next() * 9; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(150,70,30,.85)'); gr.addColorStop(1, 'rgba(150,70,30,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(120,55,25,.35)'; const x = rnd.next() * w; g.fillRect(x, rnd.next() * h * 0.5, 1.5, h * 0.5); }
  });
  region('peel', 128, 128, '#ffffff', (g, w, h) => {
    for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(180,160,130,${0.35 + rnd.next() * 0.3})`; g.beginPath(); const x = rnd.next() * w, y = rnd.next() * h; g.moveTo(x, y); for (let k = 0; k < 7; k++) g.lineTo(x + rnd.range(-14, 14), y + rnd.range(-10, 10)); g.fill(); }
    g.strokeStyle = 'rgba(110,90,70,.35)'; g.lineWidth = 1; for (let i = 0; i < 8; i++) { g.beginPath(); let x = rnd.next() * w, y = rnd.next() * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += rnd.range(-8, 8); y += rnd.range(2, 9); g.lineTo(x, y); } g.stroke(); }
    const gr = g.createLinearGradient(0, h * 0.6, 0, h); gr.addColorStop(0, 'rgba(120,100,80,0)'); gr.addColorStop(1, 'rgba(120,100,80,.25)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const corr = (g: G, w: number, h: number, light: string, dark: string) => { for (let y = 0; y < h; y += 8) { g.fillStyle = light; g.fillRect(0, y, w, 5); g.fillStyle = dark; g.fillRect(0, y + 5, w, 3); } };
  region('kepenkNew', 128, 128, '#d8d8d8', (g, w, h) => corr(g, w, h, '#ffffff', '#c9c9c9'));
  region('kepenkWorn', 128, 128, '#a07a62', (g, w, h) => {
    corr(g, w, h, '#b59a86', '#8a6e5c');
    for (let i = 0; i < 16; i++) { const x = rnd.next() * w; const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(160,80,35,.0)'); gr.addColorStop(0.3 + rnd.next() * 0.4, 'rgba(160,80,35,.75)'); gr.addColorStop(1, 'rgba(120,60,30,.2)'); g.fillStyle = gr; g.fillRect(x, 0, 2 + rnd.next() * 6, h); }
    speckle(g, w, h, 40, 'rgba(120,55,25,.6)', 1.5, 4);
  });
  region('sesame', 64, 64, '#c47a35', (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#b56a2c'); gr.addColorStop(0.5, '#cf8a42'); gr.addColorStop(1, '#b56a2c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 120, '#f6e2b4', 1.6, 2.6);
  });
  region('grill', 64, 64, '#e3b064', (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.7); gr.addColorStop(0, '#f0c47a'); gr.addColorStop(1, '#c98a45'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(110,60,25,.75)'; g.lineWidth = 4; for (let i = -2; i < 6; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16 + h, h); g.stroke(); }
  });
  const wrap = (name: string, bg: string, draw: (g: G) => void) => region(name, 64, 64, bg, draw);
  wrap('wrap1', '#fbf8f0', g => { g.fillStyle = '#e0533c'; g.fillRect(0, 10, 64, 5); g.fillRect(0, 22, 64, 3); g.fillStyle = 'rgba(0,0,0,.05)'; for (let i = 0; i < 64; i += 9) g.fillRect(i, 0, 1, 64); });
  wrap('wrap2', '#d9b98c', g => { g.fillStyle = '#2b3a55'; g.fillRect(0, 12, 64, 6); g.fillStyle = 'rgba(90,60,30,.12)'; for (let i = 0; i < 64; i += 7) g.fillRect(i, 0, 1, 64); });
  wrap('wrap3', '#d8433a', g => { g.fillStyle = '#fff6e6'; g.fillRect(0, 8, 64, 14); txt(g, 'S', 32, 15, 13, '#d8433a', { w: 900 }); });
  wrap('wrap4', '#e7b23a', g => { const gr = g.createLinearGradient(0, 0, 64, 64); gr.addColorStop(0, '#fbe08a'); gr.addColorStop(0.5, '#e4a62e'); gr.addColorStop(1, '#fff0b0'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); speckle(g, 64, 64, 18, '#fffbe6', 1, 2); });
  region('ayranbey', 128, 64, '#ffffff', (g, w, h) => { g.fillStyle = '#2f6fdb'; g.fillRect(0, 14, w, 34); txt(g, 'Ayranbey', w * 0.3, 31, 17, '#ffffff', { w: 900 }); txt(g, 'Ayranbey', w * 0.8, 31, 17, '#ffffff', { w: 900 }); g.fillStyle = '#9fc3ff'; g.fillRect(0, 50, w, 3); });
  region('bogaz', 128, 64, '#e8f3ea', (g, w, h) => {
    g.fillStyle = '#fff6e6'; g.beginPath(); g.ellipse(w * 0.3, h / 2, 34, 22, 0, 0, TAU); g.fill(); g.strokeStyle = '#1d5fa8'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = '#3fb5b0'; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.3 - 26, 40); g.quadraticCurveTo(w * 0.3 - 12, 32, w * 0.3, 40); g.quadraticCurveTo(w * 0.3 + 12, 48, w * 0.3 + 26, 40); g.stroke();
    txt(g, 'Boğaz', w * 0.3, 22, 13, '#1d5fa8', { w: 900 }); txt(g, 'GAZOZU', w * 0.78, 32, 12, '#1d5fa8', { w: 900 });
  });
  region('kolaz', 128, 64, '#d8433a', (g, w, h) => { g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 44); g.bezierCurveTo(30, 30, 70, 58, 128, 38); g.stroke(); txt(g, 'Kolaz', w * 0.3, 24, 20, '#ffffff', { w: 900, fam: 'Georgia, serif' }); txt(g, 'Kolaz', w * 0.8, 24, 20, '#ffffff', { w: 900, fam: 'Georgia, serif' }); });
  region('kolazUzay', 128, 64, '#24264a', (g, w, h) => { speckle(g, w, h, 30, '#ffffff', 0.8, 1.6); txt(g, 'KOLAZ', w * 0.3, 26, 16, '#49e6d8', { w: 900 }); txt(g, 'UZAY', w * 0.3, 44, 12, '#ff5fa2', { w: 900 }); txt(g, '★', w * 0.8, 32, 22, '#ffd23f'); });
  region('note', 128, 64, '#49b96a', (g, w, h) => {
    g.fillStyle = '#6fd08b'; rrect(g, 5, 5, w - 10, h - 10, 6); g.fill(); g.fillStyle = '#3e9f5a'; rrect(g, 10, 10, w - 20, h - 20, 5); g.fill();
    g.fillStyle = '#a8e6b8'; g.beginPath(); g.ellipse(w * 0.68, h / 2, 17, 15, 0, 0, TAU); g.fill(); txt(g, '₺', w * 0.68, h / 2 + 1, 22, '#2f7d46', { w: 900 }); txt(g, '100', w * 0.27, h / 2, 16, '#e6ffe9', { w: 900 });
  });
  region('cini', 128, 128, '#f4f8fb', (g, w, h) => drawCini(g, w, h, false));
  region('ciniPano', 128, 128, '#f4f8fb', (g, w, h) => drawCini(g, w, h, true));
  region('tavla', 128, 96, '#8a5a34', (g, w, h) => {
    g.fillStyle = '#e9d2a6'; g.fillRect(6, 6, w / 2 - 9, h - 12); g.fillRect(w / 2 + 3, 6, w / 2 - 9, h - 12);
    for (let s = 0; s < 2; s++) for (let i = 0; i < 6; i++) {
      const x0 = (s ? w / 2 + 3 : 6) + i * (w / 2 - 9) / 6, ww = (w / 2 - 9) / 6;
      g.fillStyle = (i + s) % 2 ? '#2b3a55' : '#c23e2c'; g.beginPath(); g.moveTo(x0, 6); g.lineTo(x0 + ww, 6); g.lineTo(x0 + ww / 2, h / 2 - 4); g.fill();
      g.fillStyle = (i + s) % 2 ? '#c23e2c' : '#2b3a55'; g.beginPath(); g.moveTo(x0, h - 6); g.lineTo(x0 + ww, h - 6); g.lineTo(x0 + ww / 2, h / 2 + 4); g.fill();
    }
    ([[20, 14, '#fff'], [30, 14, '#fff'], [92, 82, '#222'], [102, 82, '#222'], [40, 78, '#fff'], [84, 16, '#222']] as [number, number, string][]).forEach(([x, y, c]) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, 4.5, 0, TAU); g.fill(); });
  });
  region('afis', 96, 140, '#d9c39a', (g, w, h) => poster(g, w, h, 'DÜRÜMÜN', 'GÖZYAŞLARI', 0));
  region('afis2', 96, 140, '#d6bd92', (g, w, h) => poster(g, w, h, 'LODOS GİBİ', 'SEVDİM', 1));
  region('gazete', 96, 128, '#f4efe2', (g, w, h) => paper(g, w, h, 'Günaydın', 'POSTASI', '#1d3d6b'));
  region('gazete2', 96, 128, '#f4efe2', (g, w, h) => paper(g, w, h, 'BOĞAZ', 'HABER', '#c23e2c'));
  region('gazete3', 96, 128, '#f4efe2', (g, w, h) => paper(g, w, h, 'SPOR', 'MARTI', '#2f8a4a'));
  region('radio', 96, 64, '#e8d7b4', (g, w, h) => {
    g.fillStyle = '#d9c39a'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(120,90,50,.35)'; g.lineWidth = 1; for (let i = 0; i < w; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h * 0.62); g.stroke(); }
    g.fillStyle = '#fff3c8'; rrect(g, 8, h * 0.68, w - 16, h * 0.24, 4); g.fill(); g.fillStyle = '#7d5638'; for (let i = 0; i < 9; i++) g.fillRect(14 + i * 8.5, h * 0.72, 1.5, h * 0.12); g.fillStyle = '#c23e2c'; g.fillRect(w * 0.55, h * 0.7, 2, h * 0.18);
  });
  region('hasir', 64, 64, '#e2c27a', (g, w, h) => { for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { g.fillStyle = ((x + y) / 8) % 2 ? '#d1ac62' : '#ecd08e'; g.fillRect(x, y, 8, 8); } });
  region('kilim', 128, 64, '#b8352a', (g, w, h) => {
    g.fillStyle = '#2b3a55'; g.fillRect(0, 0, w, 8); g.fillRect(0, h - 8, w, 8);
    for (let i = 0; i < 5; i++) { const cx = 14 + i * 25, cy = h / 2; g.fillStyle = i % 2 ? '#f2b632' : '#f6ead2'; g.beginPath(); g.moveTo(cx, cy - 16); g.lineTo(cx + 11, cy); g.lineTo(cx, cy + 16); g.lineTo(cx - 11, cy); g.fill(); g.fillStyle = '#2b3a55'; g.beginPath(); g.moveTo(cx, cy - 7); g.lineTo(cx + 5, cy); g.lineTo(cx, cy + 7); g.lineTo(cx - 5, cy); g.fill(); }
  });
  region('jobBoard', 192, 144, '#c9955c', (g, w, h) => {
    g.fillStyle = '#d8a86e'; g.fillRect(6, 6, w - 12, h - 12); speckle(g, w, h, 60, 'rgba(120,80,40,.35)', 1, 2);
    g.fillStyle = '#1d5fa8'; rrect(g, 12, 10, w - 24, 34, 6); g.fill(); txt(g, 'İŞ VE İŞÇİ BULMA', w / 2, 27, 17, '#fff6e6', { w: 900, max: w - 34 });
    ([['#9aa3ab', -0.08], ['#5fb36e', 0.05], ['#a98be0', -0.03]] as [string, number][]).forEach(([c, r], i) => { g.save(); g.translate(36 + i * 60, 92); g.rotate(r); g.fillStyle = '#fffaf0'; g.fillRect(-24, -34, 48, 66); g.fillStyle = c; g.fillRect(-24, -34, 48, 12); g.fillStyle = '#e8b998'; g.beginPath(); g.arc(0, -6, 9, 0, TAU); g.fill(); g.fillStyle = '#ccc'; g.fillRect(-16, 10, 32, 3); g.fillRect(-16, 17, 24, 3); g.fillStyle = '#e0533c'; g.beginPath(); g.arc(0, -30, 3.5, 0, TAU); g.fill(); g.restore(); });
  });
  region('soon', 256, 128, '#fff6e6', (g, w, h) => {
    g.strokeStyle = '#7d5638'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    txt(g, 'YAKINDA', w / 2, 30, 30, '#e0533c', { w: 900 }); txt(g, 'Vapur Büfesi', w / 2 - 14, 72, 30, '#1d5fa8', { w: 900, max: 170 });
    g.save(); g.translate(w / 2 + 92, 74); g.fillStyle = '#2b3a55'; g.beginPath(); g.moveTo(-26, 0); g.lineTo(26, 0); g.lineTo(20, 9); g.lineTo(-20, 9); g.fill(); g.fillStyle = '#fbfaf6'; g.fillRect(-18, -12, 36, 12); g.fillStyle = '#f2b632'; g.fillRect(-4, -22, 8, 10); g.restore();
    g.fillStyle = '#3fb5b0'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(30 + i * 25, 104, 8, PI, 0); g.fill(); }
  });
  region('pierName', 256, 64, '#1d5fa8', (g, w, h) => { g.strokeStyle = '#fff6e6'; g.lineWidth = 4; rrect(g, 5, 5, w - 10, h - 10, 8); g.stroke(); txt(g, 'MARTIKÖY İSKELESİ', w / 2, h / 2 + 1, 24, '#fff6e6', { w: 900, max: w - 28 }); });
  region('ferryName', 256, 48, '#2b3a55', (g, w, h) => txt(g, 'MARTIKÖY', w / 2, h / 2 + 1, 30, '#fbfaf6', { w: 900 }));
  region('ferryWin', 128, 32, '#fbfaf6', (g, w, h) => { for (let i = 0; i < 6; i++) { g.fillStyle = '#35507a'; rrect(g, 4 + i * 21, 6, 16, 20, 6); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(7 + i * 21, 9, 4, 8); } });
  region('emblem', 64, 64, '#2b3a55', (g, w, h) => { g.fillStyle = '#f2b632'; g.fillRect(0, 0, w, h); g.fillStyle = '#2b3a55'; g.beginPath(); g.arc(32, 32, 24, 0, TAU); g.fill(); g.strokeStyle = '#fbfaf6'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(14, 32); g.quadraticCurveTo(23, 22, 32, 32); g.quadraticCurveTo(41, 22, 50, 32); g.stroke(); });
  region('menu', 256, 128, '#2f3a36', (g, w, h) => {
    g.strokeStyle = '#a8774f'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    txt(g, 'MENÜ', w / 2, 22, 22, '#fff6e6', { w: 900 });
    const items = ['Döner', 'Çay', 'Ayran', 'Simit', 'Tost', 'Gazoz'], cols = ['#d9a066', '#e0533c', '#ffffff', '#ebc07a', '#f2b632', '#3fb5b0'];
    items.forEach((s, i) => { const x = 22 + (i % 2) * 120, y = 50 + Math.floor(i / 2) * 26; g.fillStyle = cols[i]; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); txt(g, s, x + 14, y + 1, 17, '#f6ead2', { w: 700, align: 'left' }); });
  });
  region('martiPozu', 128, 32, '#2b3a55', (g, w, h) => txt(g, 'MARTI POZU', w / 2, h / 2 + 1, 18, '#f2b632', { w: 900 }));
  region('fridgeBogaz', 128, 32, '#1d5fa8', (g, w, h) => txt(g, 'Boğaz Gazozu', w / 2, h / 2 + 1, 18, '#fff6e6', { w: 900, max: w - 10 }));
  region('fridgeAyran', 128, 32, '#2f6fdb', (g, w, h) => txt(g, 'AYRANBEY', w / 2, h / 2 + 1, 19, '#ffffff', { w: 900 }));
  region('fridgeKolaz', 128, 32, '#d8433a', (g, w, h) => txt(g, 'Kolaz', w / 2, h / 2 + 1, 20, '#ffffff', { w: 900, fam: 'Georgia, serif' }));
  region('timetable', 128, 96, '#1d5fa8', (g, w, h) => {
    g.fillStyle = '#fff6e6'; g.fillRect(6, 26, w - 12, h - 32); txt(g, 'VAPUR SAATLERİ', w / 2, 14, 13, '#fff6e6', { w: 900, max: w - 12 });
    ['08:15', '09:40', '11:10', '13:30', '16:45', '19:20'].forEach((s, i) => txt(g, s, 30 + (i % 2) * 64, 40 + Math.floor(i / 2) * 18, 13, '#2b3a55', { w: 800 }));
  });
  region('marble', 64, 64, '#f2efe8', (g, w, h) => { g.strokeStyle = 'rgba(150,150,160,.35)'; g.lineWidth = 1.2; for (let i = 0; i < 6; i++) { g.beginPath(); let x = rnd.next() * w, y = 0; g.moveTo(x, y); while (y < h) { x += rnd.range(-6, 6); y += rnd.range(4, 10); g.lineTo(x, y); } g.stroke(); } });
  region('crate', 64, 64, '#c99a62', (g, w, h) => { g.fillStyle = '#b5844f'; for (let y = 0; y < h; y += 16) g.fillRect(0, y + 13, w, 3); g.fillStyle = 'rgba(70,40,20,.45)'; txt(g, 'MARTIKÖY', w / 2, 25, 9, 'rgba(90,50,25,.55)', { w: 900 }); });
  region('kasaScreen', 32, 16, '#1d2b22', (g, w, h) => txt(g, '00,00', w / 2, h / 2 + 1, 9, '#7dffa0', { w: 700 }));
  region('menuTiny', 64, 32, '#fff6e6', (g, w, h) => { txt(g, 'ÇAY 20', w / 2, 10, 10, '#c23e2c', { w: 900 }); txt(g, 'SİMİT 15', w / 2, 23, 10, '#1d5fa8', { w: 900 }); });
  region('starBadge', 32, 32, '#f2b632', (g, w, h) => txt(g, '★', w / 2, h / 2 + 1, 26, '#fff6e6'));
  region('cartSign', 192, 64, '#c23e2c', (g, w, h) => {
    g.strokeStyle = '#ffd23f'; g.lineWidth = 4; rrect(g, 5, 5, w - 10, h - 10, 10); g.stroke();
    txt(g, 'DÖNER', w / 2, h / 2 + 2, 34, '#fff6e6', { w: 900, stroke: '#7a2416', lw: 5 });
    g.fillStyle = '#ffd23f'; [[20, h / 2], [w - 20, h / 2]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); });
  });
  region('checker', 64, 64, '#ffffff', (g, w, h) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) { g.fillStyle = '#e0533c'; g.fillRect(x * 8, y * 8, 8, 8); } g.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 8; i++) g.fillRect(i * 8 + 3, 0, 2, h); });
  region('bahce', 256, 60, '#3f7a4a', (g, w, h) => {
    g.strokeStyle = '#f6ead2'; g.lineWidth = 3; rrect(g, 4, 4, w - 8, h - 8, 8); g.stroke();
    txt(g, 'ÇAY BAHÇESİ', w / 2 + 14, h / 2 + 1, 28, '#fff6e6', { w: 900, max: w - 70 });
    g.fillStyle = '#c8361e'; g.beginPath(); g.moveTo(22, 16); g.quadraticCurveTo(36, 30, 26, 44); g.lineTo(40, 44); g.quadraticCurveTo(30, 30, 44, 16); g.fill(); g.fillStyle = '#f6ead2'; g.fillRect(18, 44, 30, 4);
  });
  region('gazeteSign', 128, 24, '#1d3d6b', (g, w, h) => txt(g, 'GAZETE', w / 2, h / 2 + 1, 17, '#fff6e6', { w: 900 }));
  region('pencere', 256, 48, '#1d5fa8', (g, w, h) => { g.strokeStyle = '#fff6e6'; g.lineWidth = 3; rrect(g, 4, 4, w - 8, h - 8, 8); g.stroke(); txt(g, 'VAPUR PENCERESİ', w / 2, h / 2 + 1, 24, '#fff6e6', { w: 900, max: w - 24 }); });
  region('gurur', 128, 24, '#7d5638', (g, w, h) => txt(g, 'GURUR RAFI', w / 2, h / 2 + 1, 16, '#ffd23f', { w: 900 }));
}
function drawCini(g: G, w: number, h: number, big: boolean): void {
  g.fillStyle = '#f4f8fb'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#1d5fa8'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, w - 5, h - 5);
  g.fillStyle = '#1d5fa8'; [[0, 0], [w, 0], [0, h], [w, h]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, w * 0.18, 0, TAU); g.fill(); });
  g.fillStyle = '#3fb5b0'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.2, 0, TAU); g.fill();
  const tulip = (x: number, y: number, s: number, c: string) => { g.fillStyle = '#2f8a6a'; g.fillRect(x - s * 0.06, y, s * 0.12, s * 0.9); g.beginPath(); g.ellipse(x - s * 0.22, y + s * 0.55, s * 0.08, s * 0.25, -0.7, 0, TAU); g.fill(); g.beginPath(); g.ellipse(x + s * 0.22, y + s * 0.55, s * 0.08, s * 0.25, 0.7, 0, TAU); g.fill(); g.fillStyle = c; g.beginPath(); g.moveTo(x, y + s * 0.05); g.bezierCurveTo(x - s * 0.4, y - s * 0.05, x - s * 0.3, y - s * 0.5, x - s * 0.15, y - s * 0.55); g.lineTo(x, y - s * 0.35); g.lineTo(x + s * 0.15, y - s * 0.55); g.bezierCurveTo(x + s * 0.3, y - s * 0.5, x + s * 0.4, y - s * 0.05, x, y + s * 0.05); g.fill(); };
  if (big) { tulip(w / 2, h * 0.45, 60, '#d8433a'); tulip(w * 0.25, h * 0.6, 36, '#1d5fa8'); tulip(w * 0.75, h * 0.6, 36, '#1d5fa8'); g.fillStyle = '#d8433a'; g.beginPath(); g.arc(w / 2, h * 0.86, 8, 0, TAU); g.fill(); }
  else { tulip(w / 2, h * 0.52, 44, '#d8433a'); }
}
function poster(g: G, w: number, h: number, a: string, b: string, kind: number): void {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e8d4ad'); gr.addColorStop(1, '#b9986a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#6b4a2e'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6);
  g.fillStyle = 'rgba(80,50,30,.75)';
  if (kind === 0) { g.save(); g.translate(w / 2, h * 0.42); g.rotate(-0.5); rrect(g, -30, -11, 60, 22, 10); g.fill(); g.restore(); g.fillStyle = 'rgba(255,250,235,.9)'; g.beginPath(); g.moveTo(w * 0.62, h * 0.5); g.quadraticCurveTo(w * 0.7, h * 0.58, w * 0.62, h * 0.62); g.quadraticCurveTo(w * 0.54, h * 0.58, w * 0.62, h * 0.5); g.fill(); }
  else { g.lineWidth = 4; g.strokeStyle = 'rgba(80,50,30,.75)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(10, h * 0.32 + i * 14); g.bezierCurveTo(30, h * 0.26 + i * 14, 60, h * 0.38 + i * 14, w - 10, h * 0.3 + i * 14); g.stroke(); } }
  txt(g, a, w / 2, h * 0.74, 14, '#4a2e1a', { w: 900, max: w - 12 }); txt(g, b, w / 2, h * 0.86, 15, '#7a2a1a', { w: 900, max: w - 12 });
}
function paper(g: G, w: number, h: number, a: string, b: string, c: string): void {
  g.fillStyle = c; g.fillRect(0, 0, w, 30); txt(g, a + ' ' + b, w / 2, 16, 13, '#fffaf0', { w: 900, max: w - 8 });
  g.fillStyle = '#b8c4cf'; g.fillRect(8, 38, 40, 34); g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(28, 56, 10, 6, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(40,40,40,.4)'; for (let i = 0; i < 9; i++) g.fillRect(54, 40 + i * 7, 34, 2.5); for (let i = 0; i < 6; i++) g.fillRect(8, 80 + i * 7, w - 16, 2.5);
}

function buildTextures(): void {
function tex(w: number, h: number, draw: (g: G, w: number, h: number) => void, rep?: number): T.CanvasTexture { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = T.RepeatWrapping; if (rep) t.repeat.set(rep, rep); return t; }
plankTex = tex(512, 512, (g, w, h) => {
  const n = 16, ph = h / n;
  for (let i = 0; i < n; i++) {
    const tone = rnd.range(-14, 14), y = i * ph;
    g.fillStyle = `rgb(${206 + tone},${160 + tone * 0.8},${112 + tone * 0.6})`; g.fillRect(0, y, w, ph);
    for (let k = 0; k < 5; k++) { g.fillStyle = `rgba(${rnd.next() < 0.5 ? '120,80,45' : '245,215,170'},${0.06 + rnd.next() * 0.08})`; g.fillRect(0, y + 3 + rnd.next() * (ph - 6), w, 1 + rnd.next() * 1.5); }
    g.fillStyle = 'rgba(80,48,24,.55)'; g.fillRect(0, y, w, 2.5);
    g.fillStyle = 'rgba(255,240,215,.22)'; g.fillRect(0, y + 2.5, w, 1.5);
    let x = rnd.next() * 200; while (x < w) { g.fillStyle = 'rgba(80,48,24,.5)'; g.fillRect(x, y, 2, ph); g.fillStyle = 'rgba(70,45,30,.6)'; [x - 6, x + 6].forEach(xx => { g.beginPath(); g.arc(xx, y + ph * 0.3, 1.6, 0, TAU); g.fill(); g.beginPath(); g.arc(xx, y + ph * 0.72, 1.6, 0, TAU); g.fill(); }); x += 150 + rnd.next() * 200; }
  }
  for (let i = 0; i < 18; i++) { const x = rnd.next() * w, y = rnd.next() * h, r = 10 + rnd.next() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(110,80,50,.10)'); gr.addColorStop(1, 'rgba(110,80,50,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
});
stoneTex = tex(512, 512, (g, w, h) => {
  g.fillStyle = '#c9c1b6'; g.fillRect(0, 0, w, h);
  const rh = 32, rw = 64;
  for (let r = 0; r < h / rh; r++) for (let c = -1; c < w / rw + 1; c++) {
    const x = c * rw + (r % 2 ? rw / 2 : 0), y = r * rh, t = rnd.range(-12, 12);
    g.fillStyle = `rgb(${214 + t},${206 + t},${195 + t})`; rrect(g, x + 2, y + 2, rw - 4, rh - 4, 5); g.fill();
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 5, y + 4, rw - 12, 3);
  }
});
function tileCanvas(worn: boolean) {
  return (g: G, w: number, h: number) => {
    const s = w / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const x = i * s, y = j * s, deco = (i + j) % 2 === 0;
      g.fillStyle = worn ? '#e9e0c8' : '#f6f8fb'; g.fillRect(x, y, s, s);
      if (deco) {
        g.fillStyle = worn ? '#5f7fa0' : '#1d5fa8';
        [[0, 0], [s, 0], [0, s], [s, s]].forEach(([a, b]) => { g.beginPath(); g.arc(x + a, y + b, s * 0.22, 0, TAU); g.fill(); });
        g.fillStyle = worn ? '#6aa8a2' : '#3fb5b0'; g.beginPath(); g.moveTo(x + s / 2, y + s * 0.22); g.lineTo(x + s * 0.78, y + s / 2); g.lineTo(x + s / 2, y + s * 0.78); g.lineTo(x + s * 0.22, y + s / 2); g.fill();
        g.fillStyle = worn ? '#c9a49a' : '#e0533c'; g.beginPath(); g.arc(x + s / 2, y + s / 2, s * 0.1, 0, TAU); g.fill();
      }
      g.strokeStyle = worn ? 'rgba(120,105,80,.8)' : 'rgba(170,185,200,.9)'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
    }
    if (worn) {
      g.strokeStyle = 'rgba(70,60,50,.55)'; g.lineWidth = 1.3;
      for (let i = 0; i < 5; i++) { g.beginPath(); let x = rnd.next() * w, y = rnd.next() * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += rnd.range(-12, 12); y += rnd.range(-12, 12); g.lineTo(x, y); } g.stroke(); }
      g.fillStyle = '#a49a8a'; g.fillRect(s + 2, 2, s - 4, s * 0.45); // a chipped tile
      for (let i = 0; i < 10; i++) { const x = rnd.next() * w, y = rnd.next() * h, r = 8 + rnd.next() * 20; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(140,110,60,.22)'); gr.addColorStop(1, 'rgba(140,110,60,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    }
  };
}
tileNewTex = tex(256, 256, tileCanvas(false));
tileWornTex = tex(256, 256, tileCanvas(true));
floorTex = tex(128, 128, (g, w, h) => {
  g.fillStyle = '#f3e6cc'; g.fillRect(0, 0, w, h); g.fillStyle = '#d29a6e'; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
  g.strokeStyle = 'rgba(110,70,40,.25)'; g.lineWidth = 2; g.strokeRect(1, 1, w / 2 - 2, h / 2 - 2); g.strokeRect(w / 2 + 1, h / 2 + 1, w / 2 - 2, h / 2 - 2);
});
radialTex = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
}


export let atlasTex: T.CanvasTexture;
export let plankTex: T.CanvasTexture, stoneTex: T.CanvasTexture, tileNewTex: T.CanvasTexture, tileWornTex: T.CanvasTexture, floorTex: T.CanvasTexture, radialTex: T.CanvasTexture;
export interface V2Mats {
  atlas: T.MeshLambertMaterial; plank: T.MeshLambertMaterial; stone: T.MeshLambertMaterial; tile: T.MeshLambertMaterial; floor: T.MeshLambertMaterial;
  bulb: T.MeshBasicMaterial; win: T.MeshBasicMaterial; glow: T.MeshBasicMaterial; halo: T.PointsMaterial; glass: T.MeshLambertMaterial; marker: T.MeshBasicMaterial;
}
/** Shared materials (v2 MAT), filled by ensureKit(). */
export const MAT = {} as V2Mats;
let ready = false;

/** Builds the atlas, textures and materials once (v2 module-load order). Safe to call often. */
export function ensureKit(): void {
  if (ready) return;
  ready = true;
  atlasCanvas = document.createElement('canvas'); atlasCanvas.width = AW; atlasCanvas.height = AH;
  ag = atlasCanvas.getContext('2d')!;
  buildAtlas();
  atlasTex = new T.CanvasTexture(atlasCanvas);
  atlasTex.colorSpace = T.SRGBColorSpace;
  atlasTex.anisotropy = 4;
  Batch.white = [(R.white[0] + R.white[2]) / 2, (R.white[1] + R.white[3]) / 2];
  buildTextures();
  MAT.atlas = new T.MeshLambertMaterial({ map: atlasTex, vertexColors: true });
  MAT.plank = new T.MeshLambertMaterial({ map: plankTex, vertexColors: true });
  MAT.stone = new T.MeshLambertMaterial({ map: stoneTex, vertexColors: true });
  MAT.tile = new T.MeshLambertMaterial({ map: tileWornTex, vertexColors: true });
  MAT.floor = new T.MeshLambertMaterial({ map: floorTex, vertexColors: true });
  MAT.bulb = new T.MeshBasicMaterial({ vertexColors: true, color: '#d8d2c0', map: atlasTex });
  MAT.win = new T.MeshBasicMaterial({ vertexColors: true, color: '#000000', map: atlasTex, transparent: true, opacity: 0 });
  MAT.glow = new T.MeshBasicMaterial({ map: radialTex, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
  MAT.halo = new T.PointsMaterial({ map: radialTex, vertexColors: true, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
  MAT.glass = new T.MeshLambertMaterial({ color: '#cfeaf4', transparent: true, opacity: 0.32, depthWrite: false });
  MAT.marker = new T.MeshBasicMaterial({ color: K.yellow, transparent: true, opacity: 0.85, depthWrite: false });
}
/** All canvas textures of the kit (zones dispose/re-upload them with the pier). */
export function kitTextures(): T.Texture[] { return ready ? [atlasTex, plankTex, stoneTex, tileNewTex, tileWornTex, floorTex, radialTex] : []; }
