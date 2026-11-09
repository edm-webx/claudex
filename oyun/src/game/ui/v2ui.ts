// @ts-nocheck
// Port of the v2 js/ui.js DOM screens that engine/ui (M0) does not carry: portraits, decor icons, cat faces, panels
// (isciler, menu, dekor, gorevler, kedi, karne, tadilat, ayarlar), job board, day card, solution card, achievement
// popup, menu bar, confirm, title + hero pick, rewarded-ad sim, welcome back, kasa sayimi, sign editor, tutorial hand,
// floating text and coins. Kept 1:1 from v2 (renders use `any`-typed DOM glue, hence ts-nocheck). Owner: Builder D (M1).
// Decisions: runs on the engine ui root (CSS and HUD come from engine/ui); `env` supplies sfx/buzz/unlock/emit so there
// is no global SB; DOM events 'ui:open' / 'ui:close' are dispatched on ui.root like engine/ui does.
import { TIER_PRICE_X } from '../../content/ekonomi2';
import type { Ui } from '../../engine/api';
import { ICONS, INK } from '../../engine/ui/v2-style';
import { renderEsnaf, renderKomsuSection } from './esnaf-panel';
import { renderDekor2 } from './dekor-panel';
import { renderMini, renderMiniSection } from './mini-panel';
import { renderYiyecek } from './yiyecek-panel';
import { renderHava, renderHavaSection } from './hava-panel';
import { renderDeniz, renderDenizSection } from './deniz-panel';
import { renderKurye, renderKuryeSection } from './kurye-panel';
import { renderKoleksiyon, renderKolSection } from './koleksiyon-panel';
import { renderHarita, renderHaritaSection } from './harita-panel';
import { renderHikaye, renderHikayeSection } from './hikaye-panel';
import { renderCalisanSel, renderCalisanSection } from './calisan-panel';

export interface V2UiEnv { sfx(id: string): void; buzz(ms: number): void; unlock(): void; artApi?(): any; }

const K = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const K2 = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (body, vb) => `<svg viewBox="${vb || '0 0 48 48'}" aria-hidden="true" focusable="false">${body}</svg>`;
const LIRA = c => `<path d="M21 12v21c6.5 0 10.5-3.5 11.5-9" fill="none" stroke="${c}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 21.5l12-4.2M15.5 27.2l12-4.2" stroke="${c}" stroke-width="3.2" stroke-linecap="round"/>`;

export function createV2Ui(ui: Ui, env: V2UiEnv) {
const U: any = {};
const root: HTMLElement = ui.root;
const C: any = { audioOn: () => env.unlock() };
const SB: any = {};
const L: any = {};
L.floats = root.querySelector('.sb-floats') as HTMLElement;
L.hand = root.appendChild(mk('div', 'sb-hand', `<div class="hr"></div><div class="hm">${ICONS.hand}</div>`)); L.hand.hidden = true;
const fmt = n => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const tl = n => fmt(n) + ' ₺';
const emit = (ev, d) => { try { root.dispatchEvent(new CustomEvent(ev, { detail: d })); } catch (e) { console.warn(e); } };
const sfx = k => { try { env.sfx(k); } catch (e) {} };
const buzz = ms => { try { env.buzz(ms); } catch (e) {} };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function mk(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
const num = v => typeof v === 'number' && isFinite(v);
const safe = (fn, ...a) => { try { if (typeof fn === 'function') return fn(...a); } catch (e) { console.error('[v2ui]', e); } };
const need = () => {};
const bump = el => { el.classList.remove('sb-bump'); void el.offsetWidth; el.classList.add('sb-bump'); };
const artApi = () => (env.artApi ? env.artApi() : null);
const timeStr = s => {
  if (!num(s)) return String(s == null ? '' : s);
  s = Math.max(0, Math.ceil(s));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
  if (h) return h + ' sa ' + m + ' dk';
  return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
};
function measure() {
  const hud = root.querySelector('.sb-hud') as HTMLElement | null;
  const hb = hud && !hud.classList.contains('off') ? hud.getBoundingClientRect().bottom : 0;
  root.style.setProperty('--hudb', Math.max(0, Math.round(hb)) + 'px');
  const bh = L.bar && !L.bar.hidden ? L.bar.offsetHeight + 8 : 0;
  root.style.setProperty('--barh', bh + 'px');
}
U.ICONS = ICONS;
U.toast = (t, k) => ui.toast(t, k);
const I = name => {
  if (!name) return '';
  if (typeof name === 'string' && name.trim().charAt(0) === '<') return name;
  if (ICONS[name]) return ICONS[name];
  const k = String(name).toLowerCase();
  if (ICONS[k]) return ICONS[k];
  for (const p of ['doner', 'cay', 'ayran', 'simit', 'tost', 'gazoz']) if (k.indexOf(p) >= 0) return ICONS[p];
  return ICONS.sparkle;
};
U.icon = I;
U.openId = null;
const BP_RE = /<div class="bp"><i style="([^"]*)"><\/i><\/div>/;
/* ---------- decor icons (one per decor id; keyword fallback) ---------- */
const DECOR_ICONS = {
  radyo: svg(`<rect x="5" y="14" width="38" height="26" rx="6" fill="#b5652f" ${K}/><circle cx="17" cy="27" r="7" fill="#f6ead2" ${K2}/><path d="M13 24h8M13 27h8M13 30h8" stroke="${INK}" stroke-width="1.6"/><rect x="28" y="20" width="10" height="5" rx="1" fill="#ffd23f" ${K2}/><circle cx="33" cy="33" r="3" fill="#7d5638" ${K2}/><path d="M14 14l8-9" ${K}/>`),
  gazete: svg(`<path d="M10 44V14M38 44V14" ${K}/><rect x="7" y="8" width="34" height="10" rx="2" fill="#e0533c" ${K}/><path d="M12 20h11v16H12zM25 20h11v16H25z" fill="#fffaf1" ${K2}/><path d="M14 24h7M14 28h7M27 24h7M27 28h7" stroke="${INK}" stroke-width="1.6"/>`),
  afis: svg(`<rect x="9" y="4" width="30" height="40" rx="2" fill="#f2a2b3" ${K}/><circle cx="24" cy="18" r="7" fill="#fff6e6" ${K2}/><path d="M13 36h22M16 40h16" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M24 26v5" stroke="${INK}" stroke-width="2.4"/>`),
  sandalye: ICONS.chair,
  simidi: svg(`<circle cx="24" cy="24" r="18" fill="#fff" ${K}/><circle cx="24" cy="24" r="8" fill="#fffaf1" ${K}/><path d="M24 6v10M24 32v10M6 24h10M32 24h10" stroke="#e0533c" stroke-width="7"/><circle cx="24" cy="24" r="18" fill="none" ${K}/><circle cx="24" cy="24" r="8" fill="none" ${K}/>`),
  halat: svg(`<ellipse cx="24" cy="30" rx="19" ry="11" fill="#ebc07a" ${K}/><ellipse cx="24" cy="28" rx="12" ry="6.5" fill="none" stroke="${INK}" stroke-width="2.4"/><ellipse cx="24" cy="27" rx="5.5" ry="3" fill="#c9a061" stroke="${INK}" stroke-width="2.2"/><path d="M40 26q5-10-2-16" fill="none" ${K}/>`),
  fener: svg(`<path d="M17 12h14l3 26H14z" fill="#ffe08a" ${K}/><path d="M14 12h20l-4-7H18z" fill="#e0533c" ${K}/><path d="M12 38h24v5H12z" fill="#7d5638" ${K2}/><path d="M24 18v14M18 22h12" stroke="#d9822b" stroke-width="2.4"/>`),
  heykel: svg(`<rect x="12" y="34" width="24" height="10" rx="2" fill="#cfc8be" ${K}/><path d="M15 34c0-8 4-14 11-14 4-6 9-6 11-2l-4 3c2 6-1 13-6 13z" fill="#f4f2ec" ${K}/><path d="M20 26q7-3 12 1" fill="none" stroke="#a3acb5" stroke-width="4" stroke-linecap="round"/><path d="M37 20l5 1-4 2" fill="#ffd23f" stroke="${INK}" stroke-width="1.6"/>`),
  cini: svg(`<rect x="6" y="6" width="36" height="36" rx="3" fill="#f4f8f6" ${K}/><path d="M6 24h36M24 6v36" stroke="#3fb5b0" stroke-width="2"/><path d="M24 34c-6-4-8-9-6-16 3 2 5 5 6 8 1-3 3-6 6-8 2 7 0 12-6 16z" fill="#e0533c" ${K2}/><path d="M24 34v6" stroke="#2f8f4c" stroke-width="2.6"/>`),
  saksi: svg(`<path d="M13 28h22l-3 15H16z" fill="#c8673a" ${K}/><path d="M18 28c-2-7-1-12 3-16 1 5 3 9 3 16M30 28c2-7 1-12-3-16-1 5-3 9-3 16" fill="#e0533c" ${K2}/><path d="M24 28V10" stroke="#2f8f4c" stroke-width="2.6"/><path d="M24 12c-4-1-5-4-4-7 3 1 4 4 4 7zM24 12c4-1 5-4 4-7-3 1-4 4-4 7z" fill="#f2a2b3" ${K2}/>`),
  semaver: svg(`<path d="M15 16h18l2 20H13z" fill="#d9a441" ${K}/><path d="M18 16l2-7h8l2 7" fill="#d9a441" ${K2}/><rect x="20" y="4" width="8" height="5" rx="2" fill="#c2401f" ${K2}/><path d="M13 22H7v6M35 22h6v6" fill="none" ${K2}/><rect x="11" y="36" width="26" height="6" rx="2" fill="#7d5638" ${K2}/><path d="M24 26h7" ${K}/>`),
  minder: svg(`<path d="M5 22q19-14 38 0v8q-19 14-38 0z" fill="#d76a8a" ${K}/><path d="M12 25h24" stroke="#ffd23f" stroke-width="3" stroke-dasharray="3 3"/><circle cx="24" cy="25" r="3" fill="#3fb5b0" ${K2}/>`),
  sardunya: svg(`<path d="M13 30h22l-3 13H16z" fill="#c8673a" ${K}/><path d="M24 30V18M18 30l-4-8M30 30l4-8" stroke="#2f8f4c" stroke-width="2.8"/><circle cx="24" cy="14" r="6" fill="#e63946" ${K2}/><circle cx="13" cy="19" r="5" fill="#e63946" ${K2}/><circle cx="35" cy="19" r="5" fill="#e63946" ${K2}/>`),
  kedi: svg(`<path d="M5 22L24 6l19 16v21H5z" fill="#b98a5e" ${K}/><path d="M3 23L24 5l21 18" fill="none" stroke="#e0533c" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 43V31a8 8 0 0 1 16 0v12z" fill="#3b2a20"/><circle cx="21" cy="34" r="1.6" fill="#ffd23f"/><circle cx="27" cy="34" r="1.6" fill="#ffd23f"/>`),
  lamba: svg(`<path d="M24 16v28M17 44h14" ${K}/><path d="M15 6h18l-3 10H18z" fill="#2e2a5a" ${K}/><circle cx="24" cy="18" r="4" fill="#ffe08a" ${K2}/><path d="M24 4V2" ${K}/>`),
  tavla: svg(`<rect x="4" y="10" width="40" height="28" rx="3" fill="#b5652f" ${K}/><rect x="8" y="14" width="15" height="20" fill="#f6ead2"/><rect x="25" y="14" width="15" height="20" fill="#f6ead2"/><path d="M8 14l2.5 9 2.5-9 2.5 9 2.5-9 2.5 9 2.5-9M25 34l2.5-9 2.5 9 2.5-9 2.5 9 2.5-9 2.5 9" fill="none" stroke="#e0533c" stroke-width="2"/><circle cx="14" cy="30" r="2.4" fill="${INK}"/><circle cx="33" cy="18" r="2.4" fill="#fff" stroke="${INK}" stroke-width="1.4"/>`)
};
const decorIcon = id => {
  const k = String(id || '').toLowerCase();
  const keys = [['radyo', 'radyo'], ['gazete', 'gazete'], ['afis', 'afis'], ['afiş', 'afis'], ['sandalye', 'sandalye'], ['simidi', 'simidi'], ['halat', 'halat'], ['fener', 'fener'],
    ['heykel', 'heykel'], ['cini', 'cini'], ['çini', 'cini'], ['semaver', 'semaver'], ['minder', 'minder'], ['sardunya', 'sardunya'], ['kedi', 'kedi'], ['lamba', 'lamba'],
    ['tavla', 'tavla'], ['saksi', 'saksi'], ['saksı', 'saksi']];
  for (const [w, ic] of keys) if (k.indexOf(w) >= 0) return DECOR_ICONS[ic];
  return ICONS.sparkle;
};
const SET_NAMES = { nostalji: 'Nostalji / Yeşilçam', denizci: 'Martı / Denizci', marti: 'Martı / Denizci', lale: 'Lale Devri', neon: 'Neon Gece', plaza: 'Plaza Modern', uzay: 'Uzay', genel: 'Genel', extra: 'Genel', diger: 'Genel' };

/* ---------- cat faces (Kedi Defteri) ---------- */
const COATS = { white: ['#f7f3ea', 'Beyaz'], tabby: ['#b59a7a', 'Tekir'], black: ['#34302f', 'Kara'], ginger: ['#e8964a', 'Sarman'], calico: ['#f7f3ea', 'Üç renkli'], grey: ['#9ea4ac', 'Gri'] };
function catFace(coat, found) {
  const c = COATS[coat] || ['#c9b9a5', 'Kedi'];
  if (!found) return svg(`<path d="M18 40L20 8l20 18h20l20-18 2 32c6 10 4 40-32 46C14 80 12 50 18 40z" fill="#c9bba8" opacity=".55"/><text x="50" y="66" text-anchor="middle" font-size="38" font-weight="900" fill="#fffaf1" font-family="Arial Black,Arial,sans-serif">?</text>`, '0 0 100 100');
  const dark = coat === 'black';
  const st = dark ? '#1b1716' : INK;
  let marks = '';
  if (coat === 'tabby') marks = `<path d="M42 30l3 10M50 28v12M58 30l-3 10M24 54l9 2M76 54l-9 2" stroke="#6e573f" stroke-width="4" stroke-linecap="round"/>`;
  if (coat === 'calico') marks = `<path d="M20 40C22 26 34 24 44 32c-4 10-14 14-24 12z" fill="#e8964a"/><path d="M62 30c8-6 18-4 20 10-6 6-16 6-20-10z" fill="#34302f"/>`;
  if (coat === 'ginger') marks = `<path d="M44 30l2 9M50 28v11M56 30l-2 9" stroke="#c46f2a" stroke-width="4" stroke-linecap="round"/>`;
  const eye = dark ? '#ffd23f' : '#7cc46a';
  return svg(`<path d="M18 42L20 8l21 19h18l21-19 2 34c6 10 4 38-32 44C14 80 12 52 18 42z" fill="${c[0]}" stroke="${st}" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M24 16l13 12-12 4zM76 16L63 28l12 4z" fill="#f2a2b3"/>${marks}
    <ellipse cx="37" cy="52" rx="6" ry="7" fill="${eye}" stroke="${st}" stroke-width="2.4"/><ellipse cx="63" cy="52" rx="6" ry="7" fill="${eye}" stroke="${st}" stroke-width="2.4"/>
    <ellipse cx="37" cy="52" rx="2" ry="5" fill="#1b1716"/><ellipse cx="63" cy="52" rx="2" ry="5" fill="#1b1716"/><circle cx="38.5" cy="49" r="1.6" fill="#fff"/><circle cx="64.5" cy="49" r="1.6" fill="#fff"/>
    <path d="M45 62h10l-5 5z" fill="#ef7d8d" stroke="${st}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M50 67q-4 6-10 3M50 67q4 6 10 3" fill="none" stroke="${st}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M30 63l-16-3M30 67l-16 2M70 63l16-3M70 67l16 2" stroke="${dark ? '#bdb6ad' : '#7d6a58'}" stroke-width="1.8" stroke-linecap="round"/>`, '0 0 100 100');
}

/* ---------- portraits (canvas, cached) ---------- */
const SKIN = ['#fbe2cf', '#f6d2b5', '#efc29c', '#e6b189', '#dca27a', '#cd9068', '#bb7c56', '#a66a46', '#8e5739', '#78482e', '#623a25', '#4c2d1d'];
const HAIRC = { siyah: '#231a15', black: '#231a15', kahve: '#4a2f1e', brown: '#4a2f1e', kumral: '#7a5233', sari: '#d9b25c', 'sarı': '#d9b25c', blond: '#d9b25c', kizil: '#a8471f', 'kızıl': '#a8471f', red: '#a8471f', gri: '#9a958f', grey: '#9a958f', gray: '#9a958f', beyaz: '#e8e4dc', white: '#e8e4dc' };
let colorCtx = null;
function col(c, fb) {
  if (c == null || c === '') return fb;
  if (typeof c === 'number') return '#' + (c >>> 0).toString(16).padStart(6, '0').slice(-6);
  if (typeof c === 'object' && c.getHexString) return '#' + c.getHexString();
  const s = String(c);
  if (HAIRC[s.toLowerCase()]) return HAIRC[s.toLowerCase()];
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  try { colorCtx = colorCtx || document.createElement('canvas').getContext('2d'); colorCtx.fillStyle = '#000'; colorCtx.fillStyle = s; return /^#/.test(colorCtx.fillStyle) ? colorCtx.fillStyle : fb; } catch (e) { return fb; }
}
function shade(hex, k) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16), f = v => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255);
  return '#' + ((1 << 24) | (f(n >> 16) << 16) | (f(n >> 8 & 255) << 8) | f(n & 255)).toString(16).slice(1);
}
const hash = s => { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
function seededLook(seed) {
  let s = hash(seed) || 1; const r = () => { s = Math.imul(s ^ s >>> 15, 2246822507) ^ Math.imul(s ^ s >>> 13, 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; };
  const scarf = r() < 0.22, fem = scarf || r() < 0.45;
  const hairs = fem ? ['long', 'bun', 'wavy', 'ponytail', 'curly'] : ['short', 'curly', 'short', 'bald', 'buzz'];
  return {
    skin: Math.floor(r() * 12), hair: hairs[Math.floor(r() * hairs.length)], hairColor: ['#231a15', '#4a2f1e', '#7a5233', '#a8471f', '#9a958f', '#d9b25c'][Math.floor(r() * 6)],
    mustache: !fem && r() < 0.45, headscarf: scarf ? ['turban', 'loose', 'yazma', 'sport'][Math.floor(r() * 4)] : null,
    top: ['#5aa9d6', '#8daa5b', '#d9822b', '#f2a2b3', '#7d5638', '#3fb5b0', '#2e2a5a', '#f4f1ea'][Math.floor(r() * 8)],
    scarfColor: ['#e0533c', '#3fb5b0', '#8e5bd6', '#d9822b', '#5aa9d6', '#f2a2b3'][Math.floor(r() * 6)], glasses: r() < 0.2, body: ['slim', 'mid', 'round'][Math.floor(r() * 3)]
  };
}
const HERO_LOOKS = {
  sabri: { skin: 3, hair: 'curly', hairColor: '#1f1712', mustache: true, top: '#f7f4ee', apron: '#e0533c', body: 'round', eyes: 'smile', greyTemples: true, pen: 'ear', crow: true, brows: 'thick' },
  sabriye: { skin: 3, hair: 'bun', hairColor: '#5b3b25', top: '#5aa9d6', pattern: 'check', apron: '#e0533c', body: 'mid', eyes: 'open', earrings: true, dimples: true, pen: 'bun', brows: 'thick' }
};
function hairKind(h) {
  const k = String(h || '').toLowerCase();
  if (!k) return 'short';
  const map = [['curl', 'curly'], ['kıvır', 'curly'], ['kivir', 'curly'], ['afro', 'curly'], ['bun', 'bun'], ['topuz', 'bun'], ['pony', 'ponytail'], ['kuyruk', 'ponytail'], ['long', 'long'], ['uzun', 'long'],
    ['bald', 'bald'], ['kel', 'bald'], ['buzz', 'buzz'], ['kazı', 'buzz'], ['kazi', 'buzz'], ['wav', 'wavy'], ['dalga', 'wavy'], ['bob', 'wavy'], ['short', 'short'], ['kısa', 'short'], ['kisa', 'short']];
  for (const [w, v] of map) if (k.indexOf(w) >= 0) return v;
  return 'short';
}
const PCACHE = new Map();
function drawPortrait(g, S, L, o) {
  const P = Math.PI;
  g.save(); g.scale(S / 100, S / 100);
  const ell = (x, y, rx, ry, fill, stroke, lw) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, P * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw || 1.8; g.strokeStyle = stroke; g.stroke(); } };
  const path = (d, fill, stroke, lw) => { const p = new Path2D(d); if (fill) { g.fillStyle = fill; g.fill(p); } if (stroke) { g.lineWidth = lw || 1.8; g.strokeStyle = stroke; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(p); } };
  if (o.round) { g.beginPath(); g.arc(50, 50, 50, 0, P * 2); g.clip(); }
  if (o.bg) {
    g.fillStyle = o.bg; g.fillRect(0, 0, 100, 100);
    const rg = g.createRadialGradient(50, 36, 4, 50, 46, 62); rg.addColorStop(0, 'rgba(255,255,255,.6)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 100, 100);
  }
  const ink = '#3b2a20';
  const skin = SKIN[clamp(Math.round(num(L.skin) ? L.skin : 3), 0, 11)], skinD = shade(skin, -0.16);
  const hairC = col(L.hairColor, '#2a1d15');
  const top = col(L.top, '#f4f1ea');
  const scarf = L.headscarf || null, scarfC = col(L.scarfColor || L.headscarfColor, '#3fb5b0');
  const hk = hairKind(L.hair);
  const wide = L.body === 'round' ? 1.14 : L.body === 'slim' ? 0.9 : 1;
  /* torso */
  g.save(); g.beginPath(); g.ellipse(50, 106, 39 * wide, 31, 0, 0, P * 2); g.fillStyle = top; g.fill();
  if (L.pattern === 'check') { g.clip(); g.strokeStyle = shade(top, -0.28); g.globalAlpha = 0.45; g.lineWidth = 2.2; for (let x = 6; x < 100; x += 7) { g.beginPath(); g.moveTo(x, 70); g.lineTo(x, 100); g.stroke(); } for (let y = 74; y < 100; y += 7) { g.beginPath(); g.moveTo(0, y); g.lineTo(100, y); g.stroke(); } g.globalAlpha = 1; }
  g.restore(); ell(50, 106, 39 * wide, 31, null, ink, 1.8);
  /* long hair / scarf drape behind the shoulders */
  if (!scarf && hk === 'long') path('M28 42C21 60 22 80 31 90L69 90C78 80 79 60 72 42Z', hairC, ink, 1.6);
  if (scarf && scarf !== 'sport') path('M25 44C21 64 24 82 30 93L70 93C76 82 79 64 75 44Z', shade(scarfC, -0.08), ink, 1.8);
  /* neck */
  path('M43 60h14v16a7 7 0 0 1-14 0z', skinD, null);
  if (!L.apron) path('M41 78q9 7 18 0', null, shade(top, -0.3), 1.8);
  /* apron */
  if (L.apron) {
    const ap = col(L.apron, '#e0533c');
    g.lineCap = 'round'; g.strokeStyle = ap; g.lineWidth = 3.2; g.beginPath(); g.moveTo(38, 82); g.lineTo(41, 73); g.moveTo(62, 82); g.lineTo(59, 73); g.stroke();
    path('M35 81h30l4 22H31z', ap, ink, 1.6);
    path('M41 90h18', null, shade(ap, -0.25), 1.6);
  }
  /* hair back layers */
  if (!scarf && hk === 'bun') { ell(50, 21, 10, 9, hairC, ink, 1.6); if (L.pen === 'bun' || o.pen === 'bun') { path('M56 18l11-9', null, '#2f6fdb', 2.6); path('M66.5 9.5l2-1.6', null, ink, 2.6); } }
  if (!scarf && hk === 'ponytail') { g.save(); g.translate(72, 52); g.rotate(0.3); ell(0, 0, 6.5, 14, hairC, ink, 1.6); g.restore(); }
  /* ears */
  if (!scarf) { ell(29.5, 50, 4.2, 5.6, skin, ink, 1.6); ell(70.5, 50, 4.2, 5.6, skin, ink, 1.6); }
  /* head */
  if (!scarf) ell(50, 47, 21, 23, skin, ink, 1.8);
  else {
    ell(50, 45, 26, 27.5, scarfC, ink, 1.8);
    if (scarf === 'turban') { ell(50, 22, 12, 7.5, shade(scarfC, -0.12), ink, 1.6); path('M38 30q12-8 24 0', null, shade(scarfC, -0.25), 1.6); }
    if (scarf === 'yazma') { g.save(); g.beginPath(); g.ellipse(50, 45, 26, 27.5, 0, 0, P * 2); g.clip(); g.fillStyle = 'rgba(255,255,255,.75)'; for (let y = 22; y < 74; y += 7) for (let x = 25 + ((y / 7) % 2) * 3.5; x < 78; x += 7) { g.beginPath(); g.arc(x, y, 1.3, 0, P * 2); g.fill(); } g.restore(); }
    if (scarf === 'sport') path('M28 36q22-12 44 0', null, 'rgba(255,255,255,.7)', 2.4);
    ell(50, 51, 16.5, 19, skin, ink, 1.6);
    if (scarf === 'yazma') { g.fillStyle = '#fff6e6'; for (let a = -2.7; a < -0.4; a += 0.32) { g.beginPath(); g.arc(50 + Math.cos(a) * 17.5, 51 + Math.sin(a) * 20, 1.6, 0, P * 2); g.fill(); } }
    if (scarf === 'loose') path('M36 40q6-8 14-8t14 8q-7-3-14-3t-14 3z', hairC, null);
  }
  /* hair front */
  if (!scarf) {
    if (hk === 'curly') {
      const pts = []; for (let a = -170; a <= -10; a += 20) { const r = a * P / 180; pts.push([50 + Math.cos(r) * 20.5, 45 + Math.sin(r) * 22]); }
      pts.forEach(p => ell(p[0], p[1], 6.4, 6.4, hairC, ink, 1.5));
      ell(50, 33, 18.5, 9, hairC, null);
      pts.forEach(p => ell(p[0], p[1] + 1, 5, 5, hairC, null));
      if (L.greyTemples) { g.strokeStyle = '#a49d95'; g.lineWidth = 1.3; g.lineCap = 'round'; g.beginPath(); g.moveTo(29.6, 44.5); g.lineTo(30.6, 40.5); g.moveTo(31.6, 45); g.lineTo(32.4, 41.5); g.moveTo(70.4, 44.5); g.lineTo(69.4, 40.5); g.moveTo(68.4, 45); g.lineTo(67.6, 41.5); g.stroke(); }
    } else if (hk === 'short' || hk === 'buzz') {
      g.globalAlpha = hk === 'buzz' ? 0.75 : 1;
      path('M29 47C27 30 38 22 50 22C63 22 73 30 71 47C69 40 66 36 62 34C54 37 42 37 33 35C31 39 30 43 29 47Z', hairC, ink, 1.6);
      g.globalAlpha = 1;
    } else if (hk === 'bald') {
      ell(30.5, 45, 2.8, 6, hairC, null); ell(69.5, 45, 2.8, 6, hairC, null);
      path('M38 30q5-4 11-4', null, 'rgba(255,255,255,.55)', 2.2);
    } else {
      path('M29 51C26 30 38 21 51 22C64 22 74 31 71 51C70 42 67 37 63 35C58 38 52 34 50 30C46 36 38 38 32 39C30 42 29.5 46 29 51Z', hairC, ink, 1.6);
    }
  }
  /* hats */
  if (L.hat && !scarf) {
    const hk2 = String(L.hat).toLowerCase(), hc = col(L.hatColor, '#5a5248');
    if (hk2.indexOf('chef') >= 0 || hk2.indexOf('asci') >= 0 || hk2.indexOf('aşçı') >= 0) { ell(42, 18, 9, 8, '#fff', ink, 1.5); ell(58, 18, 9, 8, '#fff', ink, 1.5); ell(50, 13, 10, 9, '#fff', ink, 1.5); path('M33 30h34v-9H33z', '#fff', ink, 1.5); }
    else if (hk2.indexOf('kaptan') >= 0 || hk2.indexOf('captain') >= 0) { path('M28 33C28 20 72 20 72 33Z', '#fff', ink, 1.6); path('M28 33h44v4H28z', '#2e2a5a', ink, 1.4); path('M38 37q12 6 24 0', '#2e2a5a', ink, 1.4); }
    else if (hk2.indexOf('kep') >= 0 || hk2.indexOf('cap') >= 0 || hk2.indexOf('sapka') >= 0) { path('M29 36C29 20 71 20 71 36Z', hc, ink, 1.6); path('M50 36q18 0 24 4q-14 3-24-1z', shade(hc, -0.2), ink, 1.4); }
    else { path('M27 36C28 22 72 21 73 34L76 37C68 41 34 41 27 36Z', hc, ink, 1.6); path('M30 37q20 6 44 0', null, shade(hc, -0.3), 1.4); }
  }
  /* face */
  const thick = L.brows === 'thick';
  g.lineCap = 'round'; g.strokeStyle = scarf ? ink : shade(hairC, -0.1); g.lineWidth = thick ? 2.9 : 2.1;
  g.beginPath(); g.moveTo(37, 42.5); g.quadraticCurveTo(41.5, 39.5, 46.5, 41.5); g.moveTo(63, 42.5); g.quadraticCurveTo(58.5, 39.5, 53.5, 41.5); g.stroke();
  const eyes = L.eyes || o.eyes || 'open';
  if (eyes === 'smile') {
    g.strokeStyle = ink; g.lineWidth = 2.3; g.beginPath(); g.arc(42, 50.5, 3.7, P * 1.12, P * 1.88); g.stroke(); g.beginPath(); g.arc(58, 50.5, 3.7, P * 1.12, P * 1.88); g.stroke();
  } else {
    ell(42, 49, 2.6, 3.1, '#2b1d15'); ell(58, 49, 2.6, 3.1, '#2b1d15'); ell(42.9, 47.9, 0.9, 0.9, '#fff'); ell(58.9, 47.9, 0.9, 0.9, '#fff');
  }
  if (L.crow) { g.strokeStyle = skinD; g.lineWidth = 1.1; g.beginPath(); g.moveTo(34, 47); g.lineTo(31.5, 46); g.moveTo(34, 49.5); g.lineTo(31.5, 50); g.moveTo(66, 47); g.lineTo(68.5, 46); g.moveTo(66, 49.5); g.lineTo(68.5, 50); g.stroke(); }
  ell(36.5, 57.5, 4.2, 2.7, 'rgba(236,104,96,.33)'); ell(63.5, 57.5, 4.2, 2.7, 'rgba(236,104,96,.33)');
  ell(50, 55.3, 3.1, 2.5, skinD);
  const my = L.mustache ? 1.6 : 0;
  path(`M41.5 ${61 + my}Q50 ${64 + my} 58.5 ${61 + my}Q57 ${71 + my} 50 ${71 + my}Q43 ${71 + my} 41.5 ${61 + my}Z`, '#7a2a1e', ink, 1.5);
  g.save(); g.clip(new Path2D(`M41.5 ${61 + my}Q50 ${64 + my} 58.5 ${61 + my}Q57 ${71 + my} 50 ${71 + my}Q43 ${71 + my} 41.5 ${61 + my}Z`));
  g.fillStyle = '#fff'; g.fillRect(40, 60 + my, 20, 4.4); ell(50, 70 + my, 5, 2.6, '#e2747a'); g.restore();
  if (L.mustache) path('M50 58.4C46 56 40 57 37.5 60.4C36 62 34.6 61.4 34 60C34.4 64.4 40 64.8 44 62.8C47 61.6 49 61.2 50 61.2C51 61.2 53 61.6 56 62.8C60 64.8 65.6 64.4 66 60C65.4 61.4 64 62 62.5 60.4C60 57 54 56 50 58.4Z', L.mustacheColor ? col(L.mustacheColor, '#1d1510') : (hk === 'bald' ? hairC : '#1d1510'), null);
  if (L.dimples) { g.strokeStyle = skinD; g.lineWidth = 1.3; g.beginPath(); g.arc(39, 63.5, 1.6, P * 0.6, P * 1.4); g.stroke(); g.beginPath(); g.arc(61, 63.5, 1.6, -P * 0.4, P * 0.4); g.stroke(); }
  if (L.glasses) { g.strokeStyle = ink; g.lineWidth = 1.6; g.beginPath(); g.arc(42, 49, 5.4, 0, P * 2); g.moveTo(63.4, 49); g.arc(58, 49, 5.4, 0, P * 2); g.moveTo(47.4, 48.5); g.lineTo(52.6, 48.5); g.stroke(); }
  if (L.earrings && !scarf) { g.strokeStyle = '#e8a91c'; g.lineWidth = 1.5; g.beginPath(); g.arc(29.5, 57, 2, 0, P * 2); g.stroke(); g.beginPath(); g.arc(70.5, 57, 2, 0, P * 2); g.stroke(); }
  if ((L.pen === 'ear' || o.pen === 'ear') && !scarf) { path('M68 47l9-13', null, '#2f6fdb', 2.6); path('M76.4 34.8l1.3-1.8', null, ink, 2.6); }
  g.restore();
}
/* returns a <canvas> (CSS size px) with the portrait; cached per look */
U.portrait = function (look, px, opts) {
  opts = opts || {}; px = px || 64;
  let L = look;
  if (typeof look === 'string' && HERO_LOOKS[look]) L = HERO_LOOKS[look];
  if (!L || typeof L !== 'object') L = seededLook(look || 'x');
  const dpr = Math.min(3, window.devicePixelRatio || 1), S = Math.round(px * dpr);
  const key = JSON.stringify([L, S, opts]);
  let src = PCACHE.get(key);
  if (!src) {
    src = document.createElement('canvas'); src.width = src.height = S;
    try { drawPortrait(src.getContext('2d'), S, L, opts); } catch (e) { console.warn('[SB.ui] portrait', e); }
    if (PCACHE.size > 120) PCACHE.clear();
    PCACHE.set(key, src);
  }
  const c = document.createElement('canvas'); c.width = c.height = S; c.style.width = c.style.height = px + 'px';
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
};
/* portraits inside innerHTML: <canvas data-por="key"> then hydrate() */
const POR = new Map(); let porN = 0;
const porKey = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0; return 'p' + h.toString(36) + str.length.toString(36); };
const porTag = (look, px, opts, cls) => { const k = porKey(JSON.stringify([look, px, opts || null])); porN++; if (!POR.has(k)) { POR.set(k, { look, px, opts }); if (POR.size > 400) { const first = POR.keys().next().value; POR.delete(first); } } return `<canvas class="sb-por ${cls || ''}" data-por="${k}" width="1" height="1" style="width:${px}px;height:${px}px"></canvas>`; };
function hydrate(root) {
  root.querySelectorAll('canvas[data-por]:not([data-hy])').forEach(cv => {
    const d = POR.get(cv.dataset.por); if (!d) return;
    const p = U.portrait(d.look, d.px, d.opts);
    p.className = cv.className; p.dataset.por = cv.dataset.por; p.dataset.hy = '1'; cv.replaceWith(p);
  });
}
/* In-place DOM update: keeps the existing elements (a button under the finger stays the same node), only changes
   what differs. Owner bug: panels re-rendered twice a second by innerHTML, so a tap that spanned a refresh was lost. */
function morph(el, html) {
  const tpl = document.createElement('template'); tpl.innerHTML = html;
  syncKids(el, tpl.content);
}
function syncAttrs(o, n) {
  for (const at of Array.from(o.attributes)) if (!n.hasAttribute(at.name)) o.removeAttribute(at.name);
  for (const at of Array.from(n.attributes)) if (o.getAttribute(at.name) !== at.value) o.setAttribute(at.name, at.value);
  if (o.tagName === 'INPUT' && o !== document.activeElement && n.hasAttribute('value') && o.value !== n.getAttribute('value')) o.value = n.getAttribute('value');
}
function syncKids(a, b) {
  const nk = Array.from(b.childNodes);
  for (let i = 0; i < nk.length; i++) {
    const o = a.childNodes[i], n = nk[i];
    if (!o) { a.appendChild(n); continue; }
    if (o.nodeType !== n.nodeType || o.nodeName !== n.nodeName) { a.replaceChild(n, o); continue; }
    if (n.nodeType !== 1) { if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue; continue; }
    if (n.nodeName === 'CANVAS' && n.dataset.por) { if (o.dataset.por !== n.dataset.por) a.replaceChild(n, o); continue; }
    syncAttrs(o, n); syncKids(o, n);
  }
  while (a.childNodes.length > nk.length) a.removeChild(a.lastChild);
}

/* ---------- floating text and coins ---------- */
const floatPool = [];
U.float = function (x, y, text, kind) {
  need();
  if (!kind) kind = /₺/.test(String(text)) ? 'money' : 'info';
  let f = floatPool.find(e => !e._busy);
  if (!f) { if (floatPool.length >= 24) f = floatPool[0]; else { f = mk('div', 'sb-float'); L.floats.appendChild(f); floatPool.push(f); } }
  if (f._anim) try { f._anim.cancel(); } catch (e) {}
  f._busy = true; f.className = 'sb-float ' + kind; f.textContent = text;
  const w = f.offsetWidth || 60, vw = window.innerWidth;
  const x0 = clamp(x - w / 2, 4, Math.max(4, vw - w - 4)), dx = (Math.random() - 0.5) * 14;
  const big = kind === 'streak' ? 1.25 : 1;
  try {
    f._anim = f.animate([
      { transform: `translate(${x0}px,${y - 10}px) scale(${0.6 * big})`, opacity: 0 },
      { transform: `translate(${x0}px,${y - 24}px) scale(${1.15 * big})`, opacity: 1, offset: 0.18 },
      { transform: `translate(${x0 + dx}px,${y - 46}px) scale(${big})`, opacity: 1, offset: 0.65 },
      { transform: `translate(${x0 + dx}px,${y - 76}px) scale(${0.95 * big})`, opacity: 0 }
    ], { duration: kind === 'streak' ? 1300 : 1000, easing: 'ease-out' });
    f._anim.onfinish = () => { f._busy = false; f.style.opacity = 0; };
  } catch (e) { f.style.transform = `translate(${x0}px,${y - 40}px)`; setTimeout(() => { f._busy = false; f.style.opacity = 0; }, 900); }
};
U.coins = function (x, y, n, target) {
  need(); n = clamp(n || 8, 1, 20);
  const tgt = target || (root.querySelector(".sb-money") ? root.querySelector(".sb-money").querySelector('svg') : null);
  const r = tgt ? tgt.getBoundingClientRect() : { left: 30, top: 30, width: 0, height: 0 };
  const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
  for (let i = 0; i < n; i++) {
    const c = mk('div', 'sb-coin', ICONS.coin); L.floats.appendChild(c);
    const sx = x + (Math.random() - 0.5) * 70, sy = y + (Math.random() - 0.5) * 40, mx = (sx + tx) / 2 + (Math.random() - 0.5) * 120, my = Math.min(sy, ty) - 40 - Math.random() * 60;
    try {
      const a = c.animate([
        { transform: `translate(${x}px,${y}px) scale(.4)`, opacity: 0 },
        { transform: `translate(${sx}px,${sy}px) scale(1.1)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${mx}px,${my}px) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${tx}px,${ty}px) scale(.7)`, opacity: 1 }
      ], { duration: 750 + i * 45, easing: 'ease-in-out', delay: i * 35 });
      a.onfinish = () => { c.remove(); sfx('coin'); if (i === n - 1) { const mp = root.querySelector(".sb-money"); if (mp) bump(mp); }; };
    } catch (e) { c.remove(); }
  }
};

U.bubbleHTML = function (o) {
  o = o || {};
  const icons = (o.icons || (o.icon ? [o.icon] : [])).map(k => {
    if (typeof k === 'object' && k) return `<span class="${k.done ? 'd' : ''}">${I(k.id || k.icon)}</span>${k.n > 1 ? `<span class="n">×${k.n}</span>` : ''}`;
    return `<span>${I(k)}</span>`;
  }).join('');
  let s = '';
  if (icons) s += `<div class="bi">${icons}${o.count > 1 ? `<span class="n">×${o.count}</span>` : ''}</div>`;
  if (o.text) s += `<div class="bt">${esc(o.text)}</div>`;
  if (num(o.patience)) { const p = clamp(o.patience, 0, 1), c = p > 0.5 ? 'var(--money)' : p > 0.25 ? 'var(--tea)' : 'var(--warn)'; s += `<div class="bp"><i style="width:${Math.round(p * 100)}%;background:${c}"></i></div>`; }
  return s;
};
U.priceHTML = (cost, title) => `${title ? `<span class="pt">${esc(title)}</span>` : ''}<span class="pv">${ICONS.coin}${typeof cost === 'number' ? fmt(cost) : esc(cost)}</span>`;
U.ringHTML = p => clamp(+p || 0, 0, 1);
U.slowHTML = () => ICONS.warn;
U.heartsHTML = () => `<i>${ICONS.heart}</i><i>${ICONS.heart}</i><i>${ICONS.heart}</i>`;
/* ---------- tutorial hand ---------- */
U.hand = function (show, x, y) {
  need();
  if (!show) { L.hand.hidden = true; return; }
  L.hand.hidden = false;
  const px = num(x) ? x : window.innerWidth * 0.42, py = num(y) ? y : window.innerHeight * 0.62;
  L.hand.style.transform = `translate(${px}px,${py}px)`;
};

/* ---------- day card ---------- */
let dayEl = null, dayT = 0;
U.dayCard = function (o) {
  need(); o = o || {};
  if (dayEl) dayEl.remove();
  clearTimeout(dayT);
  const d = dayEl = mk('div', 'sb-dayc');
  const fix = o.fix && o.fix.label;
  d.innerHTML = `<div class="dh">${ICONS.moon}<span>Gün ${esc(o.day != null ? o.day : '')} bitti</span></div>
    <div class="ds"><span>${ICONS.people}<span><b>${fmt(o.customers || 0)}</b>müşteri</span></span><span>${ICONS.coin}<span><b class="g">+${fmt(o.earned || 0)} ₺</b>kazanç</span></span></div>
    <div class="dc">${o.complaint ? `${ICONS.warn}<span>En çok şikayet: <b>${esc(o.complaint)}</b></span>` : `${ICONS.heart}<span>Şikayet yok, mahalle memnun!</span>`}</div>
    <div class="df">${fix ? `<button class="sb-btn green wide" data-fix>${ICONS.bolt}<span class="sb-bl">${esc(o.fix.label)}${o.fix.cost != null ? `<small>${typeof o.fix.cost === 'number' ? tl(o.fix.cost) : esc(o.fix.cost)}</small>` : ''}</span></button>` : ''}</div>
    <i class="dt"></i>`;
  root.appendChild(d);
  sfx('day');
  const bar = d.querySelector('.dt');
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('in')));
  try { bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: 4000, easing: 'linear', fill: 'forwards' }); } catch (e) {}
  const hide = () => { if (dayEl !== d) return; d.classList.remove('in'); setTimeout(() => { d.remove(); if (dayEl === d) dayEl = null; }, 500); };
  dayT = setTimeout(hide, 4000);
  d.addEventListener('click', e => {
    if (e.target.closest('[data-fix]')) { safe(o.fix.onClick); }
    clearTimeout(dayT); hide();
  });
};

/* ---------- solution card (red slow-spot icon) ---------- */
let solEl = null;
function closeSol() { if (!solEl) return; const s = solEl; solEl = null; s.style.transition = 'opacity .2s'; s.style.opacity = 0; setTimeout(() => s.remove(), 220); }
U.solution = function (o) {
  need(); o = o || {};
  if (solEl) solEl.remove();
  const s = solEl = mk('div', 'sb-sol');
  const costTxt = o.cost == null ? '' : (typeof o.cost === 'number' ? tl(o.cost) : esc(o.cost));
  s.innerHTML = `<div class="si">${ICONS.warn}</div><h3>${esc(o.title || 'Burada işler yavaş')}</h3><p>${esc(o.text || '')}</p>
    <div class="sr"><button class="sb-btn cream" data-s="no">Sonra</button><button class="sb-btn green" data-s="ok">${ICONS.bolt}<span class="sb-bl">${esc(o.accept || (costTxt ? 'Çöz' : 'Göster'))}${costTxt ? `<small>${costTxt}</small>` : ''}</span></button></div>`;
  root.appendChild(s);
  s.addEventListener('click', e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    closeSol(); if (b.dataset.s === 'ok') safe(o.onAccept);
  });
};

/* ---------- achievement popup (queued) ---------- */
const achQ = []; let achBusy = false;
U.achievement = function (o) { need(); achQ.push(o || {}); if (!achBusy) nextAch(); };
function nextAch() {
  const o = achQ.shift(); if (!o) { achBusy = false; return; }
  achBusy = true;
  const rw = o.reward == null ? '' : typeof o.reward === 'number' ? `<span class="sb-chip gold">${ICONS.gold}+${fmt(o.reward)} Altın Simit</span>` : `<span class="sb-chip gold">${ICONS.sparkle}${esc(o.reward)}</span>`;
  const a = mk('div', 'sb-ach', `<div class="am">${ICONS.medal}</div><div><div class="ak">BAŞARIM AÇILDI</div><h3>${esc(o.title || '')}</h3><p>${esc(o.text || '')}</p>${rw ? `<div class="ar">${rw}</div>` : ''}</div>`);
  root.appendChild(a); sfx('buy'); buzz(20);
  requestAnimationFrame(() => requestAnimationFrame(() => a.classList.add('in')));
  let done = false;
  const hide = () => { if (done) return; done = true; a.classList.remove('in'); setTimeout(() => { a.remove(); nextAch(); }, 400); };
  const t = setTimeout(hide, 3600);
  a.addEventListener('click', () => { clearTimeout(t); hide(); });
}

/* ---------- menu bar ---------- */
let barItems = [];
U.menuBar = function (items) {
  need();
  barItems = Array.isArray(items) ? items : [];
  if (!L.bar) {
    L.bar = root.appendChild(mk('nav', 'sb-bar')); L.bar.setAttribute('aria-label', 'Menü');
    L.bar.addEventListener('click', e => {
      const b = e.target.closest('[data-id]'); if (!b) return;
      const id = b.dataset.id;
      if (U.openId === id) userClose(); else emit('ui:open', id);
    });
  }
  L.bar.hidden = !barItems.length;
  const barHTML = barItems.map(it => {
    const bd = it.badge;
    const badge = bd === true ? '<i class="sb-badge dot"></i>' : (bd != null && bd !== false && bd !== 0 && bd !== '') ? `<i class="sb-badge">${esc(num(bd) && bd > 99 ? '99+' : bd)}</i>` : '';
    return `<button class="sb-bi${U.openId === it.id ? ' on' : ''}" data-id="${esc(it.id)}" aria-label="${esc(it.label || it.id)}">${I(it.icon || it.id)}<span>${esc(it.label || '')}</span>${badge}</button>`;
  }).join('');
  morph(L.bar, barHTML);
  measure();
};
const markBar = () => { if (L.bar) L.bar.querySelectorAll('.sb-bi').forEach(b => b.classList.toggle('on', b.dataset.id === U.openId)); };

/* ---------- confirm (in-page, never window.confirm) ---------- */
let confirmEl = null;
U.confirm = function (o) {
  need(); o = o || {};
  return new Promise(res => {
    if (confirmEl) confirmEl.remove();
    const m = confirmEl = mk('div', 'sb-modal sb-confirm');
    m.innerHTML = `<div class="sb-mcard" role="dialog" aria-modal="true"><div class="ci">${o.icon ? I(o.icon) : ICONS.warn}</div><h2>${esc(o.title || 'Emin misin?')}</h2>${o.text ? `<p>${esc(o.text)}</p>` : ''}
      <div class="sb-mrow"><button class="sb-btn cream" data-c="no">${esc(o.no || 'Vazgeç')}</button><button class="sb-btn ${o.danger === false ? 'green' : 'red'}" data-c="yes">${esc(o.yes || 'Evet')}</button></div></div>`;
    root.appendChild(m);
    const fin = v => { if (confirmEl === m) confirmEl = null; m.classList.add('out'); setTimeout(() => m.remove(), 200); res(v); };
    m.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) fin(b.dataset.c === 'yes'); else if (e.target === m) fin(false); });
  });
};

/* ---------- sheet panels ---------- */
let sheet = null, sheetActs = {}, sheetModel = {}, sheetClose = null;
const PANELS = {
  isciler: { t: 'Ekip', s: 'İşçiler, rütbeler ve keyifler', ic: 'people', acc: 'var(--blue)' },
  menu: { t: 'Menü', s: 'Ürün kademeleri ve fiyatlar', ic: 'menu', acc: 'var(--red)' },
  dekor: { t: 'Dekor', s: 'Büfeni güzelleştir', ic: 'dekor', acc: 'var(--tile)' },
  gorevler: { t: 'Görevler', s: 'Sipariş Panosu ve başarımlar', ic: 'gorev', acc: 'var(--tea)' },
  kedi: { t: 'Kedi Defteri', s: 'Mahallenin kedileri', ic: 'cat', acc: 'var(--pink)' },
  karne: { t: 'Karne', s: 'Notlar ve yıldızlar', ic: 'karne', acc: 'var(--olive)' },
  tadilat: { t: 'Tadilat', s: 'Büfeni büyüt', ic: 'hammer', acc: 'var(--wood)' },
  ayarlar: { t: 'Ayarlar', s: 'Ses, görüntü ve kayıt', ic: 'gear', acc: 'var(--blue)' },
  isbul: { t: 'İş ve İşçi Bulma', s: 'Panodaki adaylar', ic: 'newspaper', acc: 'var(--wood)' },
  esnaf: { t: 'Komşu Defteri', s: 'Çarşı Sokağı esnafı', ic: 'heart', acc: 'var(--pink)' },
  mini: { t: 'Mini Oyunlar', s: 'Lunapark Martı: Büfe Köşesi', ic: 'play', acc: 'var(--yellow)' },
  hava: { t: 'Takvim ve Hava', s: 'Mevsimler, şenlikler, Gece Pazarı', ic: 'sun', acc: 'var(--yellow)' },
  deniz: { t: 'İskele ve Deniz', s: 'Vapur, tekneler, deniz canlıları, iskele büyümesi', ic: 'sun', acc: 'var(--blue)' },
  kurye: { t: 'Kuryeler', s: 'PaketMartı teslimat hattı', ic: 'stopwatch', acc: 'var(--yellow)' },
  koleksiyon: { t: 'Koleksiyon', s: 'Albümler, kapaklar ve Altın Fırın', ic: 'sparkle', acc: '#e8a92a' },
  harita: { t: 'İstanbul Haritası', s: 'Semtler: dokun, ışınlan', ic: 'map', acc: '#5aa0c8' },
  hikaye: { t: 'Hikaye Defteri', s: 'Bölümler, rakipler ve günlük', ic: 'newspaper', acc: 'var(--tea)' }
};
let pressing = false, pendingSheet = null;
const release = () => { if (!pressing) return; setTimeout(() => { pressing = false; if (pendingSheet) { const a = pendingSheet; pendingSheet = null; openSheet(...a); } }, 60); };
window.addEventListener('pointerup', release, true); window.addEventListener('pointercancel', release, true);
function openSheet(id, title, sub, icon, acc, bodyHTML, footHTML, extraCls) {
  // Faz 2 (decor): the decor shelf is a low strip, so the kiosk stays visible while shopping
  if (id === 'dekor') extraCls = (extraCls ? extraCls + ' ' : '') + 'dk-low';
  need();
  const same = sheet && sheet.dataset.id === id && !sheet.classList.contains('out');
  if (same && pressing) { pendingSheet = [id, title, sub, icon, acc, bodyHTML, footHTML, extraCls]; return sheet; }
  pendingSheet = null;
  let scroll = 0;
  if (same) scroll = sheet.querySelector('.sb-shb').scrollTop;
  else { if (sheet) { const old = sheet; old.remove(); } }
  if (!same) {
    sheet = mk('section', 'sb-sheet' + (extraCls ? ' ' + extraCls : ''));
    sheet.dataset.id = id; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', title);
    sheet.innerHTML = `<div class="sb-awn"></div><div class="sb-shh"><span class="hi"></span><h2></h2><button class="sb-x" data-a="__close" aria-label="Kapat">${ICONS.close}</button></div><div class="sb-shb"></div><div class="sb-shf" hidden></div>`;
    sheet.addEventListener('click', onSheetClick);
    sheet.addEventListener('input', onSheetClick);
    sheet.addEventListener('pointerdown', () => { pressing = true; }, true);
    root.appendChild(sheet);
  }
  sheet.className = 'sb-sheet' + (extraCls ? ' ' + extraCls : '');
  sheet.style.setProperty('--acc', acc);
  sheet.querySelector('.hi').innerHTML = I(icon);
  sheet.querySelector('h2').innerHTML = esc(title) + (sub ? `<small>${esc(sub)}</small>` : '');
  const body = sheet.querySelector('.sb-shb');
  if (!same) body.innerHTML = bodyHTML; else if (body._html !== bodyHTML) morph(body, bodyHTML);
  body._html = bodyHTML; hydrate(body);
  const foot = sheet.querySelector('.sb-shf'); foot.hidden = !footHTML;
  if (!same) foot.innerHTML = footHTML || ''; else if (foot._html !== (footHTML || '')) morph(foot, footHTML || '');
  foot._html = footHTML || ''; hydrate(foot);
  if (same) body.scrollTop = scroll;
  U.openId = id; markBar(); measure();
  return sheet;
}
function closeSheet() {
  if (!sheet) return;
  const s = sheet; sheet = null; sheetClose = null;
  const id = U.openId; U.openId = null; markBar();
  s.classList.add('out'); setTimeout(() => s.remove(), 200);
  return id;
}
function userClose() {
  const cb = sheetClose; const id = closeSheet();
  if (id) emit('ui:close', id);
  safe(cb);
}
function onSheetClick(e) {
  const b = e.target.closest('[data-a]'); if (!b || (e.type === 'input' && b.tagName !== 'INPUT')) return;
  if (e.type === 'click' && b.tagName === 'INPUT') return;
  if (b.classList.contains('off') || b.disabled) { if (b.dataset.why) U.toast(b.dataset.why, 'info'); return; }
  const a = b.dataset.a, id = b.dataset.id;
  const A = sheetActs || {};
  const idv = id != null && id !== '' && !isNaN(+id) && String(+id) === id ? +id : id;
  switch (a) {
    case '__close': userClose(); return;
    case 'fire': {
      const w = (sheetModel.workers || []).find(x => String(x.id) === String(id));
      U.confirm({ title: (w ? w.name : 'İşçi') + ' işten ayrılsın mı?', text: 'Rütbesi ve tecrübesi de gider. Yerine yeni birini panodan bulman gerekir.', yes: 'Evet, ayrılsın', no: 'Vazgeç' })
        .then(ok => { if (ok) safe(A.fire, idv); });
      return;
    }
    case 'reset':
      U.confirm({ title: 'Kayıt sıfırlansın mı?', text: 'Bütün ilerleme silinir ve oyun en baştan başlar. Bu geri alınamaz.', yes: 'Evet, sıfırla', no: 'Vazgeç' })
        .then(ok => { if (ok) safe(A.reset); });
      return;
    case 'setMuted': safe(A.setMuted, b.dataset.v === '1'); return;
    case 'setHaptic': safe(A.setHaptic, b.dataset.v === '1'); return;
    case 'setVol': if (e.type === 'input') safe(A.setVol, id, (+b.value || 0) / 100); return;
    case 'setQuality': safe(A.setQuality, b.dataset.v); return;
    case 'setHero': safe(A.setHero, b.dataset.v); return;
    case 'setHand': safe(A.setHand, b.dataset.v); return;
    case 'setPerf': safe(A.setPerf, b.dataset.v === '1'); return;
    case 'copyReport': safe(A.copyReport); return;
    case 'remove': safe(A.remove, +b.dataset.slot); return;
    case 'rot': safe(A.rot, +b.dataset.slot); return;
    case 'zemin': safe(A.zemin, b.dataset.id || b.dataset.v); return;
    case 'sign': safe(A.sign); return;
    case 'start': safe(A.start); return;
    case 'startSelf': safe(A.startSelf); return;
    case 'skip': safe(A.skip); return;
    case 'board': safe(A.board); return;
    case 'hire': { const card = b.closest('.sb-cand'); if (card) card.classList.add('hired'); sfx('buy'); safe(A.hire, idv); return; }
    case 'refresh': safe(A.refresh); return;
    default: if (typeof A[a] === 'function') safe(A[a], idv);
  }
}
const btn = (label, act, id, cls, sub, opt) => {
  opt = opt || {};
  const off = opt.off ? ' off' : '';
  return `<button class="sb-btn ${cls || ''}${off}" data-a="${act}"${id != null ? ` data-id="${esc(id)}"` : ''}${opt.why ? ` data-why="${esc(opt.why)}"` : ''}${opt.attrs || ''}>${opt.icon ? I(opt.icon) : ''}<span class="sb-bl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
};
const pips = (n, of) => { let s = '<span class="sb-pips">'; for (let i = 0; i < of; i++) s += `<i class="${i < n ? 'on' : ''}"></i>`; return s + '</span>'; };
const meter = (p, color, cls) => `<div class="sb-meter ${cls || ''}"><i style="width:${(clamp(p, 0, 1) * 100).toFixed(1)}%;${color ? 'background:' + color : ''}"></i></div>`;

const RANKS = ['Çırak', 'Acemi', 'Kalfa', 'Deneyimli', 'Usta', 'Kıdemli Usta', 'Başusta', 'Uzman', 'Usta Şef', 'Efsane'];
const MOODS = [['Küs', '#e63946'], ['Küskün', '#d9822b'], ['Normal', '#ebc07a'], ['Keyifli', '#8daa5b'], ['Coşkulu', '#49b96a']];
const moodFace = i => {
  const m = ['M17 33q7-6 14 0', 'M17 32q7-3 14 0', 'M17 31h14', 'M17 29q7 5 14 0', 'M15 28q9 9 18 0'][i];
  return svg(`<circle cx="24" cy="24" r="19" fill="${MOODS[i][1]}" ${K}/><circle cx="18" cy="20" r="2.4" fill="${INK}"/><circle cx="30" cy="20" r="2.4" fill="${INK}"/><path d="${m}" fill="${i === 4 ? '#fff' : 'none'}" ${K}/>`);
};
function traitParts(t) {
  if (!t) return { name: '', effect: '', flaw: '', line: '' };
  if (typeof t === 'string') return { name: t, effect: '', flaw: '', line: '' };
  return { name: t.name || t.label || '', effect: t.effect || t.good || t.desc || '', flaw: t.flaw || t.bad || '', line: t.line || t.quote || '' };
}
const ROLE_ICON = r => { const k = String(r || '').toLowerCase(); if (k.indexOf('doner') >= 0 || k.indexOf('döner') >= 0) return 'doner'; if (k.indexOf('cay') >= 0 || k.indexOf('çay') >= 0) return 'cay'; if (k.indexOf('garson') >= 0) return 'tray'; if (k.indexOf('tost') >= 0) return 'tost'; if (k.indexOf('gazoz') >= 0) return 'gazoz'; if (k.indexOf('temiz') >= 0) return 'broom'; if (k.indexOf('kurye') >= 0) return 'stopwatch'; if (k.indexOf('ayran') >= 0) return 'ayran'; if (k.indexOf('simit') >= 0) return 'simit'; return 'people'; };
const wageTxt = w => w == null ? '' : typeof w === 'string' ? w : w <= 15 ? '%' + String(w).replace('.', ',') : tl(w) + '/gün';

function renderIsciler(m, A) {
  const ws = m.workers || [];
  let s = '';
  try { s += renderCalisanSel(m.calisan, porTag); } catch (e) { console.error('[SB.ui] calisan', e); }
  if (!ws.length) s += `<div class="sb-empty">${ICONS.people}<span>Henüz işçin yok.<br>${m.hint ? esc(m.hint) : 'İskeledeki "İş ve İşçi Bulma" köşesine yürü ya da aşağıdaki düğmeye bas, panodan birini seç.'}</span></div>`;
  ws.forEach(w => {
    let ri = RANKS.indexOf(w.rankLabel); if (ri < 0) ri = clamp(num(w.rank) ? Math.round(w.rank) : 0, 0, 9);
    const t = traitParts(w.trait);
    const mo = num(w.morale) ? clamp(w.morale, 0, 1) : 0.7, mi = clamp(Math.floor(mo * 5), 0, 4);
    s += `<div class="sb-card sb-wk">
      ${porTag(w.look || ('w' + w.id + w.name), 68, { bg: '#bfe6e9', eyes: 'open' })}
      <div class="sb-grow"><h3>${esc(w.name)} <span class="sb-chip">${I(ROLE_ICON(w.role || w.roleLabel))}${esc(w.roleLabel || '')}</span></h3>
        <div class="rk">${pips(ri + 1, 10)}<span>${ri + 1}. seviye · ${esc(w.rankLabel || RANKS[ri])}</span></div>
        ${t.name ? `<div class="sb-trait"><b>${esc(t.name)}</b>${t.effect ? ': ' + esc(t.effect) : ''}</div>` : ''}
      </div>
      <div class="wb"><span class="sb-muted">${w.wage != null ? 'Maaş payı: <b>' + esc(wageTxt(w.wage)) + '</b>' : ''}${w.station ? '<br>İstasyon: <b>' + esc(w.station) + '</b>' : ''}</span>
        ${A.train ? btn('Kurs', 'train', w.id, 'blue sm', null, { icon: 'karne' }) : ''}${A.tasi ? btn('Taşı', 'tasi', w.id, 'cream sm') : ''}${A.pencere && num(m.pencere) && m.pencere >= 0 ? btn(m.pencere === w.id ? 'Pencerede ✓' : 'Pencereye', 'pencere', w.id, m.pencere === w.id ? 'green sm' : 'cream sm', null, { icon: 'ferry' }) : ''}${A.fire ? btn('Çıkar', 'fire', w.id, 'cream sm') : ''}</div>
    </div>`;
  });
  if (A.board) s += btn('Yeni işçi bul', 'board', null, 'wide', null, { icon: 'newspaper' });
  if (A.pencereHire && num(m.pencere) && m.pencere >= 0) s += btn('Vapur penceresi için eleman al', 'pencereHire', null, 'wide', null, { icon: 'ferry' });
  try { s += renderCalisanSection(m.calisan, porTag); } catch (e) { console.error('[SB.ui] calisan', e); }
  return s;
}
const TIERX = TIER_PRICE_X.map(x => '×' + String(x).replace('.', ','));  // Faz 2: real tier multipliers (ekonomi2)
function renderMenu(m) {
  let yy = { head: '', tail: '', full: null };
  try { yy = renderYiyecek(m.yy); } catch (e) { console.error('[SB.ui] yiyecek', e); } // Tarif Defteri / Deney / Anlaşma tabs (yiyecek-panel.ts)
  if (yy.full) return yy.full;
  return yy.head + renderMenuList(m) + renderYatirim(m) + yy.tail;  // kıyafet dolabı moved to the kulis (Karakter > Dolap)
}
function renderKiyafet(m) {
  const k = m.kiy;
  if (!k) return '';
  const SL = { ust: 'Üst', alt: 'Alt', ayakkabi: 'Ayakkabı', aksesuar: 'Aksesuar', sapka: 'Şapka', kostum: 'Kostüm' };
  let s = `<div class="sb-sec">${ICONS.star}Kıyafet dolabı<span>Altın Simit ile al, üstüne giy</span></div>`;
  k.zincirler.forEach(c => {
    s += `<div class="sb-card"><div class="sb-grow"><h3>${esc(c.name)} <small>${esc(c.tagline)}</small></h3>`;
    c.items.forEach(it => {
      const b = it.owned
        ? btn(it.worn ? 'Çıkar' : 'Giy', it.worn ? 'kyTake' : 'kyWear', it.id, 'green wide', SL[it.slot] || '', { icon: 'bolt' })
        : btn('Al', 'kyBuy', it.id, 'green wide', it.gold + ' Altın Simit', { icon: 'bolt', off: k.gold < it.gold, why: 'Altın Simit yetmiyor.' });
      s += `<div class="sb-muted">${esc(it.name)}</div>${b}`;
    });
    s += '</div></div>';
  });
  return s;
}
function renderYatirim(m) {
  const list = m.invest || [];
  if (!list.length || (num(m.stage) && m.stage < 2 && !list.some(y => y.level > 0))) return '';
  let s = `<div class="sb-sec">${ICONS.star}Esnaf yatırımları<span>her seviye bir kademe büfe ister</span></div>`;
  list.forEach(y => {
    let pips = '<div class="sb-tiers">'; for (let i = 1; i <= y.max; i++) pips += `<span class="${i <= y.level ? 'done' : i === y.level + 1 ? 'on' : ''}">${i}</span>`; pips += '</div>';
    const can = y.cost != null && !y.locked && (!num(m.money) || m.money >= y.cost);
    const act = y.cost == null ? `<span class="sb-chip gold" style="justify-content:center;width:100%">${ICONS.star} Son seviye</span>`
      : btn(y.locked ? y.needStage + '. kademe büfe gerekir' : 'Yatırım yap', 'inv', y.id, 'green wide', y.locked ? null : tl(y.cost) + ' · +%' + y.nextEffect + ' ' + y.unit, { icon: 'bolt', off: !can, why: y.locked ? 'Büfeni bir kademe büyüt.' : 'Biraz daha para lazım.' });
    s += `<div class="sb-card"><div class="sb-grow"><h3>${esc(y.name)} <small>${y.level ? '+%' + y.effect + ' ' + esc(y.unit) : 'henüz yok'}</small></h3><div class="sb-muted">${esc(y.desc)}</div>${pips}${act}</div></div>`;
  });
  return s;
}
function renderMenuList(m) {
  const ps = m.products || [];
  if (!ps.length) return `<div class="sb-empty">${ICONS.menu}<span>Henüz ürün yok.</span></div>`;
  return ps.map(p => {
    const tier = clamp(num(p.tier) ? p.tier : 1, 1, 4);
    let tiers = '<div class="sb-tiers">'; for (let i = 1; i <= 4; i++) tiers += `<span class="${i < tier ? 'done' : i === tier ? 'on' : ''}">${['Seyyar', 'Esnaf', 'Usta', 'Efsane'][i - 1]} ${TIERX[i - 1]}</span>`; tiers += '</div>';
    if (p.unlocked === false) return `<div class="sb-card sb-prod locked"><div class="pi">${I(p.id)}</div><div><h3>${esc(p.name)}</h3><div class="sb-muted">${ICONS.lock.replace('<svg', '<svg style="width:18px;height:18px;display:inline-block;vertical-align:-4px"')} İskeledeki sarı karede açılır</div></div></div>`;
    const can = !num(m.money) || !num(p.nextCost) || m.money >= p.nextCost;
    const up = p.nextCost != null && p.nextTierName
      ? btn('Yükselt: ' + p.nextTierName, 'upgrade', p.id, 'green wide', (num(p.nextCost) ? tl(p.nextCost) : p.nextCost) + (TIERX[tier] ? ' · fiyat ' + TIERX[tier] : ''), { icon: 'bolt', off: !can, why: 'Biraz daha para lazım.' })
      : `<span class="sb-chip gold" style="justify-content:center;width:100%">${ICONS.star} En üst kademe</span>`;
    return `<div class="sb-card sb-prod"><div class="pi">${I(p.id)}</div><div class="sb-grow"><h3>${esc(p.name)} <small>${num(p.price) ? tl(p.price) : esc(p.price || '')}</small></h3><div class="sb-muted">${esc(p.tierName || '')}</div>${tiers}</div><div class="pb">${up}</div></div>`;
  }).join('');
}
function renderDekor(m) {
  if (m && m.x2) { try { return renderDekor2(m); } catch (e) { console.error('[SB.ui] dekor2', e); } } // Dekor 2.0 tabs (dekor-panel.ts)
  const items = m.items || [], slots = m.slots || [];
  const used = slots.filter(x => x.itemId != null && x.itemId !== '').length, free = slots.length - used;
  const st = num(m.style) ? m.style : 0;
  const styleV = st <= 1 && st > 0 && !Number.isInteger(st) ? Math.round(st * 100) : Math.round(st);
  let s = `<div class="sb-card sb-style"><div class="sv">${styleV}<small>/ 100</small></div><div class="sb-grow"><b style="font:900 16px/1.1 var(--disp)">Şıklık</b><div class="sb-muted">Müşterinin gördüğü dekor sayılır.</div>${meter(styleV / 100, 'var(--tile)')}</div>${btn('Tabela', 'sign', null, 'cream sm', null, { icon: 'sign' })}</div>`;
  if (slots.length) {
    s += `<div class="sb-sec">${ICONS.dekor}Dekor yerleri<span>${used} / ${slots.length} dolu</span></div><div class="sb-slots">`;
    slots.forEach(sl => {
      if (sl.itemId != null && sl.itemId !== '') s += `<button class="sb-slot full" data-a="remove" data-slot="${esc(sl.index)}" aria-label="Kaldır">${decorIcon(sl.itemId)}</button><button class="sb-slot" data-a="rot" data-slot="${esc(sl.index)}" aria-label="Döndür">↻</button>`;
      else s += `<span class="sb-slot"><b>${(+sl.index) + 1}</b></span>`;
    });
    s += '</div>';
  }
  if (m.zemin) s += `<div class="sb-card"><div class="sb-grow"><h3>Büfe zemini <small>${m.zemin.kir > 0.5 ? 'kirli' : m.zemin.kir > 0.15 ? 'biraz kirli' : 'parlak'}</small></h3><div class="sb-muted">Müşteri geçtikçe kirlenir. Paspasla parlatılır.</div>${meter(1 - m.zemin.kir, 'var(--tile)')}<div class="sb-row" style="display:flex;gap:6px;margin:6px 0">${[['ahsap', 'Ahşap'], ['fayans', 'Fayans'], ['mermer', 'Mermer']].map(([v, l]) => btn(l, 'zemin', 'desen:' + v, (m.zemin.desen === v ? 'green' : 'cream') + ' sm')).join('')}</div>${btn('Zemini temizle', 'zemin', 'temizle', 'green wide', null, { icon: 'bolt', off: m.zemin.kir <= 0, why: 'Zemin zaten parlak.' })}</div></div>`;
  const groups = {}; const order = [];
  items.forEach(it => { const k = it.set || 'genel'; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(it); });
  order.forEach(k => {
    const g = groups[k], have = g.filter(i => i.owned).length;
    s += `<div class="sb-sec">${ICONS.sparkle}${esc(SET_NAMES[String(k).toLowerCase()] || k)}<span>${have} / ${g.length}</span></div><div class="sb-dgrid">`;
    g.forEach(it => {
      const placed = slots.filter(x => x.itemId === it.id).length;
      const ownedN = it.owned === true ? 1 : num(it.owned) ? it.owned : 0;
      const can = !num(m.money) || !num(it.price) || m.money >= it.price;
      const bonus = it.bonus == null ? '' : num(it.bonus) ? `+${it.bonus} keyif` : String(it.bonus);
      let b;
      if (!ownedN) b = btn('Al', 'buy', it.id, 'green sm', num(it.price) ? tl(it.price) : it.price, { off: !can, why: 'Biraz daha para lazım.' });
      else if (placed < ownedN) b = btn('Yerleştir', 'place', it.id, 'sm', null, { off: free <= 0, why: 'Boş dekor yeri yok. Önce birini kaldır.' });
      else b = num(it.owned) ? btn('Bir tane daha', 'buy', it.id, 'cream sm', num(it.price) ? tl(it.price) : it.price, { off: !can, why: 'Biraz daha para lazım.' }) : `<span class="sb-chip ok" style="justify-content:center;min-height:44px">${ICONS.check.replace('<svg', '<svg style="width:18px;height:18px"')} Yerleşti</span>`;
      s += `<div class="sb-card sb-ditem${ownedN ? ' owned' : ''}"><div class="dtop"><div class="dic">${decorIcon(it.id)}</div><div class="sb-grow"><h3>${esc(it.name)}</h3><div class="db">${esc(bonus)}</div></div></div>${b}</div>`;
    });
    s += '</div>';
  });
  if (!items.length) s += `<div class="sb-empty">${ICONS.dekor}<span>Katalog yakında dolacak.</span></div>`;
  return s;
}
function renderGorevler(m) {
  const d = m.daily || [], a = m.achievements || [];
  let s = `<div class="sb-sec">${ICONS.gorev}Sipariş Panosu<span>${d.filter(x => x.done).length} / ${d.length}</span></div>`;
  if (!d.length) s += `<div class="sb-card sb-muted">Bugünün siparişleri sabah gelir.</div>`;
  // Faz 2: Görevler = Sipariş Panosu + Başarımlar only (story, neighbours, mini games, sea, map, collections removed)
  d.forEach(t => {
    const g = t.goal || 1, p = clamp((t.progress || 0) / g, 0, 1);
    const rw = t.reward == null ? '' : num(t.reward) ? `${ICONS.coin}${tl(t.reward)}` : `${ICONS.gold}${esc(t.reward)}`;
    const right = t.claimed ? `<span class="sb-chip ok">${ICONS.check.replace('<svg', '<svg style="width:16px;height:16px"')}Alındı</span>` : t.done ? btn('Al', 'claim', t.id, 'green sm glow', null, { icon: 'gold' }) : '';
    s += `<div class="sb-card sb-task${t.claimed ? ' claimed' : ''}"><div><p>${esc(t.text)}</p>${rw ? `<div class="tr">${rw}</div>` : ''}</div>${right}<div class="tp">${meter(p, t.done ? 'var(--money)' : 'var(--tea)')}<span>${fmt(Math.min(t.progress || 0, g))} / ${fmt(g)}</span></div></div>`;
  });
  s += `<div class="sb-sec">${ICONS.medal}Başarımlar<span>${a.filter(x => x.done).length} / ${a.length}</span></div><div class="sb-agrid">`;
  a.forEach(x => { s += `<div class="sb-card sb-achi${x.done ? '' : ' no'}">${x.done ? ICONS.medal : ICONS.lock}<div><h3>${esc(x.title)}</h3><p>${esc(x.text || '')}</p></div></div>`; });
  return s + '</div>';
}
function renderKedi(m) {
  const cs = m.cats || [];
  let s = `<div class="sb-sec">${ICONS.heart}Tanıştığın kediler<span>${cs.filter(c => c.found).length} / ${cs.length}</span></div><div class="sb-cgrid">`;
  cs.forEach(c => {
    s += c.found ? `<div class="sb-card sb-cat">${catFace(c.coat, true)}<h3>${esc(c.name)}</h3><span class="sb-chip">${esc((COATS[c.coat] || [0, ''])[1])}</span><p>${esc(c.story || '')}</p></div>`
      : `<div class="sb-card sb-cat no">${catFace(c.coat, false)}<h3>???</h3><p>Henüz tanışmadınız. Belki bir gün büfeye uğrar.</p></div>`;
  });
  s += '</div>';
  if (!cs.length) s = `<div class="sb-empty">${ICONS.cat}<span>Pamuk tentede uyuyor. Yanına git, belki uyanır.</span></div>`;
  return s;
}
const GRADES = ['Zayıf', 'Geçer', 'Orta', 'İyi', 'Pekiyi'], GCOL = ['#f3b0a8', '#f6cf9a', '#f6e39a', '#bfe3a8', '#8fd6a8'];
const GICON = id => { const k = String(id || '').toLowerCase(); if (k.indexOf('lez') >= 0) return ICONS.doner; if (k.indexOf('hiz') >= 0 || k.indexOf('hız') >= 0) return ICONS.stopwatch; if (k.indexOf('sik') >= 0 || k.indexOf('şık') >= 0) return ICONS.sparkle; if (k.indexOf('soh') >= 0 || k.indexOf('şöh') >= 0) return ICONS.camera; if (k.indexOf('tem') >= 0) return ICONS.broom; return ICONS.star; };
function renderKarne(m) {
  const g = m.grades || [], stars = clamp(Math.floor(m.stars || 0), 0, 5);
  let bs = ''; for (let i = 0; i < 5; i++) bs += i < stars ? ICONS.star : ICONS.starOff;
  let s = `<div class="sb-karne"><div class="sb-stamp">NOTLAR<br>ASLA DÜŞMEZ</div><div class="kh">${ICONS.karne.replace('<svg', '<svg style="width:40px;height:40px"')}<div><h3>BÜFE KARNESİ</h3><p>Martıköy İskelesi</p></div></div><div class="sb-bigstars">${bs}</div>`;
  g.forEach(x => {
    const sc = clamp(+x.score || 0, 0, 1), gi = clamp(Math.floor(sc * 5 - 1e-9), 0, 4);
    s += `<div class="sb-grade">${GICON(x.id || x.label)}<h3>${esc(x.label)}</h3><span class="gw" style="background:${GCOL[gi]}">${GRADES[gi]}</span>${meter(sc, null, 'notch')}</div>`;
  });
  s += '</div>';
  let ns = m.nextStar;
  if (ns != null && ns !== '') {
    let list = Array.isArray(ns) ? ns : (typeof ns === 'object' ? (ns.items || [{ text: ns.text || '' }]) : [{ text: ns }]);
    list = list.map(x => typeof x === 'string' ? { text: x } : x);
    s += `<div class="sb-card sb-next"><div class="sb-sec" style="margin:0">${ICONS.star.replace('<svg', '<svg style="width:22px;height:22px"')}Sıradaki yıldız için</div><ul>${list.map(x => `<li><span class="ck${x.done ? ' on' : ''}">${x.done ? ICONS.check : ''}</span>${esc(x.text)}</li>`).join('')}</ul></div>`;
  } else if (stars >= 5) s += `<div class="sb-card" style="text-align:center;font:900 16px/1.3 var(--disp)">Beş yıldız! Martıköy seninle gurur duyuyor.</div>`;
  return s;
}
const STAGES = [['Seyyar Araba', 'cart1'], ['Büfe', 'shop'], ['Çay Bahçesi', 'garden'], ['Lokanta', 'lokanta'], ['Zincir Şube', 'zincir'], ['Deniz Platformu', 'garden'], ['Balık Restoranı', 'lokanta'], ['Boğaz Restoranı', 'lokanta'], ['Şef Mutfağı', 'zincir'], ['Fine Dining', 'zincir']];
function renderTadilat(m) {
  const stg = clamp(num(m.stage) ? m.stage : 1, 1, STAGES.length);
  const names = Array.isArray(m.stages) ? m.stages : null;
  let s = '<div class="sb-card"><div class="sb-ladder">';
  STAGES.forEach((x, i) => {
    const n = i + 1, soon = false;
    s += `<div class="sb-st ${n < stg ? 'done' : n === stg ? 'cur' : ''}${soon ? ' soon' : ''}"><div class="sc">${ICONS[x[1]]}</div><span>${esc(names && names[i] ? names[i] : x[0])}</span>${soon ? '<span class="sb-chip soon">Yakında</span>' : ''}</div>`;
  });
  s += '</div></div>';
  const tLeft = m.timeLeft;
  const working = (num(tLeft) && tLeft > 0) || (typeof tLeft === 'string' && tLeft !== '' && tLeft !== '0');
  const nextSoon = stg >= 3 && !m.nextName ? true : (stg + 1 >= 4 && !m.canStart && !working && m.cost == null);
  s += `<div class="sb-card sb-tad"><div class="tn">${esc(m.stageName || STAGES[stg - 1][0])}${m.nextName || stg < STAGES.length ? ICONS.arrowR + esc(m.nextName || (STAGES[stg] || [''])[0]) : ''}</div>`;
  if (working) {
    s += `<div class="sb-work">${ICONS.hammer}<div class="sb-grow"><div class="sb-muted">Ustalar çalışıyor, büfe açık kalıyor.</div><b>${esc(timeStr(tLeft))}</b></div></div>`;
    s += btn('Altın Simitle hemen bitir', 'skip', null, 'wide', (m.skipGold != null ? fmt(m.skipGold) + ' Altın Simit' : ''), { icon: 'gold' });
  } else if (nextSoon) {
    s += `<div class="sb-muted" style="text-align:center">Sonraki tadilat yakında geliyor. Şimdilik çay bahçesinin keyfini çıkar.</div>`;
  } else {
    s += `<div class="sb-muted" style="text-align:center">Her tadilat paslı bir parçayı yeniler: tabela, fayans, floresan, tezgah, boya. Kazanç da katlanır.</div>`;
    s += btn('Tadilatı başlat', 'start', null, 'green wide', m.cost != null ? (num(m.cost) ? tl(m.cost) : m.cost) : '', { icon: 'hammer', off: m.canStart === false, why: m.reason || 'Henüz şartlar tamam değil.' });
    if (num(m.cost)) s += btn('Kendin kur (yarı fiyat, iki kat süre)', 'startSelf', null, 'cream wide', tl(Math.round(m.cost / 2)), { icon: 'hammer', off: m.canStart === false, why: m.reason || 'Henüz şartlar tamam değil.' });
    if (m.canStart === false) s += `<div class="sb-muted" style="text-align:center">${esc(m.reason || 'Önce istasyonları biraz daha geliştir.')}</div>`;
  }
  s += '</div>';
  return s;
}
const QUAL = [['auto', 'Otomatik'], ['akici', 'Akıcı'], ['dengeli', 'Dengeli'], ['sahane', 'Şahane']];
function renderAyarlar(m, A) {
  const q = (m.quality === 'otomatik' || m.quality == null) ? 'auto' : m.quality;
  const sound = !m.muted;
  let s = `<div class="sb-card sb-set">${sound ? ICONS.sound : ICONS.mute}<div class="sb-grow"><h3>Ses</h3><p>Müzik, cızırtı ve martı çığlıkları</p></div><button class="sb-tog${sound ? ' on' : ''}" data-a="setMuted" data-v="${sound ? 1 : 0}" aria-label="Ses" aria-pressed="${sound}"></button></div>`;
  if (A.setVol && m.vol) { // ses-5: separate sliders + own music mode
    const sl = (bus, label) => `<div class="sb-set" style="min-height:0;gap:10px;margin:4px 0"><span style="flex:0 0 78px;font-weight:800;font-size:16px">${label}</span><input type="range" min="0" max="100" step="5" value="${Math.round((m.vol[bus] ?? 1) * 100)}" data-a="setVol" data-id="${bus}" aria-label="${label}" style="flex:1;pointer-events:auto;height:30px;accent-color:var(--teal,#2fa39d)"></div>`;
    s += `<div class="sb-card">${sl('music', 'Müzik')}${sl('sfx', 'Efekt')}${sl('voice', 'Konuşma')}</div>`;
    const om = !!m.ownMusic;
    s += `<div class="sb-card sb-set">${ICONS.sound}<div class="sb-grow"><h3>Kendi müziğini dinle</h3><p>Oyunun müziği susar, çay kaşığı ve martılar kalır.</p></div><button class="sb-tog${om ? ' on' : ''}" data-a="setOwnMusic" data-id="${om ? 0 : 1}" aria-label="Kendi müziğini dinle" aria-pressed="${om}"></button></div>`;
  }
  if (A.setHaptic) { const hp = m.haptic !== false; s += `<div class="sb-card sb-set">${ICONS.vibrate}<div class="sb-grow"><h3>Titreşim</h3><p>Para toplarken kısa titreşim</p></div><button class="sb-tog${hp ? ' on' : ''}" data-a="setHaptic" data-v="${hp ? 0 : 1}" aria-label="Titreşim" aria-pressed="${hp}"></button></div>`; }
  s += `<div class="sb-card"><div class="sb-set" style="min-height:0;margin-bottom:8px">${ICONS.quality}<div class="sb-grow"><h3>Görüntü kalitesi</h3><p>Otomatik, telefonuna göre ayarlar.</p></div></div><div class="sb-seg">${QUAL.map(x => `<button class="${q === x[0] ? 'on' : ''}" data-a="setQuality" data-v="${x[0]}">${x[1]}</button>`).join('')}</div></div>`;
  const hero = m.hero === 'sabriye' ? 'sabriye' : 'sabri';
  s += `<div class="sb-card"><div class="sb-set" style="min-height:0;margin-bottom:8px">${ICONS.people}<div class="sb-grow"><h3>Büfeci</h3><p>Kim tezgahta dursun?</p></div></div><div class="sb-heros">${['sabri', 'sabriye'].map(h => `<button class="${hero === h ? 'on' : ''}" data-a="setHero" data-v="${h}">${porTag(h, 44, { bg: h === 'sabri' ? '#bfe6e9' : '#f9d9b8', round: true })}${h === 'sabri' ? 'Sabri' : 'Sabriye'}</button>`).join('')}</div></div>`;
  if (A.setHand) { const hd = m.hand === 'sol' ? 'sol' : 'sag'; s += `<div class="sb-card"><div class="sb-set" style="min-height:0;margin-bottom:8px">${ICONS.hand}<div class="sb-grow"><h3>El tarafı</h3><p>Düğmeler elinin tarafına geçer.</p></div></div><div class="sb-seg two"><button class="${hd === 'sol' ? 'on' : ''}" data-a="setHand" data-v="sol">Sol el</button><button class="${hd === 'sag' ? 'on' : ''}" data-a="setHand" data-v="sag">Sağ el</button></div></div>`; }
  if (A.setPerf) { const pf = !!m.perf; s += `<div class="sb-card"><div class="sb-set" style="min-height:0">${ICONS.stopwatch}<div class="sb-grow"><h3>Hız ölçer</h3><p>Kare hızı ve en yavaş parçalar. Raporu kopyalayıp gönderebilirsin.</p></div><button class="sb-tog${pf ? ' on' : ''}" data-a="setPerf" data-v="${pf ? 0 : 1}" aria-label="Hız ölçer" aria-pressed="${pf}"></button></div>${A.copyReport ? `<div class="sb-mrow" style="margin-top:8px">${btn('Raporu kopyala', 'copyReport', null, 'blue sm', null, { icon: 'newspaper' })}</div>` : ''}</div>`; }
  if (A.karakterDegis) s += `<div class="sb-card sb-set">${ICONS.people}<div class="sb-grow"><h3>Karakter değiştir</h3><p>Kaydeder, hesabına döner. 4 yuvadan başkasını seçersin.</p></div>${btn('Değiştir', 'karakterDegis', null, 'blue sm')}</div>`;
  s += `<div class="sb-card sb-set">${ICONS.trash}<div class="sb-grow"><h3>Kayıt</h3><p>Oyun her 10 saniyede bir kaydedilir.</p></div>${btn('Sıfırla', 'reset', null, 'red sm')}</div>`;
  s += `<div class="sb-foot">Sabri'nin Büfesi · Bölüm 1, Martıköy İskelesi<br>Oyundaki bütün markalar ve kişiler uydurmadır.</div>`;
  return s;
}
const RENDER = { isciler: renderIsciler, menu: renderMenu, dekor: renderDekor, gorevler: renderGorevler, kedi: renderKedi, karne: renderKarne, tadilat: renderTadilat, ayarlar: renderAyarlar, esnaf: renderEsnaf, mini: renderMini, hava: renderHava, deniz: renderDeniz, koleksiyon: renderKoleksiyon, harita: renderHarita, kurye: renderKurye, hikaye: renderHikaye };
U.open = function (panelId, model, actions) {
  need();
  const P = PANELS[panelId] || { t: 'Yakında', s: '', ic: 'sparkle', acc: 'var(--navy)' };
  model = model || {}; actions = actions || {};
  sheetModel = model; sheetActs = actions; sheetClose = null;
  let body;
  try { body = RENDER[panelId] ? RENDER[panelId](model, actions) : `<div class="sb-empty">${ICONS.sparkle}<span>Bu bölüm yakında açılıyor.</span></div>`; }
  catch (e) { console.error('[SB.ui] panel ' + panelId, e); body = `<div class="sb-empty">${ICONS.warn}<span>Bu sayfa şu an açılamadı.</span></div>`; }
  let sub = P.s;
  if (panelId === 'isciler' && model.workers) sub = model.workers.length + ' işçi';
  if (panelId === 'dekor' && num(model.money)) sub = 'Kasada ' + tl(model.money);
  openSheet(panelId, P.t, sub, P.ic, P.acc, body, '');
  return sheet;
};

/* ---------- job board ---------- */
const RAR = { gri: ['GRİ KART', 'Sıradan', 1], yesil: ['YEŞİL KART', 'Becerikli', 2], mavi: ['MAVİ KART', 'Nadir', 3], mor: ['MOR KART', 'Efsane Esnaf', 5], altin: ['ALTIN KART', 'Efsane', 4] };
const RARBG = { gri: '#dfe3e6', yesil: '#cdeed6', mavi: '#cfe3f5', mor: '#e3d6f6', altin: '#fbe7b0' };
U.jobBoard = function (o) {
  need(); o = o || {};
  const cs = o.candidates || [];
  const money = num(o.money) ? o.money : Infinity;
  let s = '';
  if (!cs.length) s = `<div class="sb-card sb-empty">${ICONS.newspaper}<span>${esc(o.emptyText || 'Panoda şu an aday yok. Yarın sabah yenileri gelir.')}</span></div>`;
  cs.forEach(c => {
    const r = RAR[c.rarity] ? c.rarity : 'gri', R = RAR[r], t = traitParts(c.trait);
    const rich = !num(c.price) || money >= c.price, can = rich && c.canHire !== false;
    const lbl = can ? 'İşe al' : !rich ? 'Para yetmiyor' : 'Kadro dolu', why = c.why || (!rich ? 'Kasada biraz daha para birikmeli.' : 'Bu iş için şu an yer yok.');
    s += `<div class="sb-cand r-${r}"><i class="pin"></i><div class="rib">${R[0]} · ${R[1]}${pips(R[2], 5)}</div><div class="cb">
      ${porTag(c.look || ('c' + c.id + c.name), 76, { bg: RARBG[r], eyes: 'open' })}
      <div class="sb-grow"><h3>${esc(c.name)}</h3><span class="role">${I(ROLE_ICON(c.role || c.roleLabel))}${esc(c.roleLabel || c.role || '')}</span>${t.name ? `<br><span class="tn">${esc(String(t.name).toLocaleUpperCase('tr'))}</span>` : ''}</div>
      <div class="sb-tl">${t.effect ? `<p><i class="gd">İYİ</i><span>${esc(t.effect)}</span></p>` : ''}${t.flaw ? `<p><i class="fl">KUSUR</i><span>${esc(t.flaw)}</span></p>` : ''}${t.line ? `<div class="ln">"${esc(String(t.line).replace(/^["“]|["”]$/g, ''))}"</div>` : ''}</div>
      <div class="sb-cf"><span class="cv">Maaş payı<b>${esc(wageTxt(c.wage)) || '-'}</b></span><span class="cv">İşe alma<b>${num(c.price) ? tl(c.price) : esc(c.price || '-')}</b></span>${btn(lbl, 'hire', c.id, 'green', null, { off: !can, why, icon: can ? 'checkInk' : null })}</div>
    </div></div>`;
  });
  const rin = o.refreshIn == null ? '' : (num(o.refreshIn) ? timeStr(o.refreshIn) : String(o.refreshIn));
  const foot = `<div class="sb-jf">${rin ? `Yeni aday<b>${esc(rin)}</b>` : 'Her gün bir kart yenilenir.'}</div>${o.onRefresh ? btn('Gazeteye ilan ver', 'refresh', null, 'blue', num(o.refreshCost) ? tl(o.refreshCost) : (o.refreshCost || 'Bütün kartlar yenilenir'), { icon: 'newspaper', off: num(o.refreshCost) && money < o.refreshCost, why: 'İlan için biraz para lazım.' }) : ''}`;
  sheetModel = o; sheetActs = { hire: o.onHire, refresh: o.onRefresh };
  openSheet('isbul', 'İş ve İşçi Bulma', cs.length + ' aday panoda', 'newspaper', 'var(--wood)', s, foot, 'jb');
  sheetClose = o.onClose || null;
  return sheet;
};

/* ---------- close ---------- */
U.close = function () {
  closeSheet();
  if (signEl) closeSign(false);
  closeSol();
  if (confirmEl) { const b = confirmEl.querySelector('[data-c="no"]'); if (b) b.click(); }
};

/* ---------- title and hero pick ---------- */
const PAMUK = svg(`<path d="M14 52c0-14 14-22 34-22s34 6 34 18c0 10-10 14-34 14S14 62 14 52z" fill="#f7f3ea" ${K}/><path d="M78 50c8 2 10 10 2 12-6 1-14-1-18-3" fill="#f7f3ea" ${K}/>
<path d="M16 46l2-16 10 9zM34 40l6-14 6 13z" fill="#f7f3ea" ${K}/><path d="M19 37l1-3 3 3zM37 36l3-6 2 5z" fill="#f2a2b3"/>
<circle cx="31" cy="50" r="13" fill="#f7f3ea"/><path d="M22 49q3 3 6 0M32 49q3 3 6 0" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><path d="M29 54l1.5 1.5 1.5-1.5" fill="#ef7d8d" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
<text x="62" y="26" font-size="16" font-weight="900" fill="#2f7fb3" font-family="Arial Black,Arial,sans-serif" stroke="#fff" stroke-width="3" paint-order="stroke">z</text><text x="74" y="14" font-size="12" font-weight="900" fill="#2f7fb3" font-family="Arial Black,Arial,sans-serif" stroke="#fff" stroke-width="3" paint-order="stroke">z</text>`, '0 0 96 70');
const SCENE = `<svg class="sb-scene" viewBox="0 0 400 860" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs><linearGradient id="sbsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4ef"/><stop offset=".42" stop-color="#bfe3f6"/><stop offset=".56" stop-color="#ffe7c2"/></linearGradient>
<linearGradient id="sbsea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fbde2"/><stop offset="1" stop-color="#2f7fb3"/></linearGradient>
<linearGradient id="sbdeck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c99a6b"/><stop offset="1" stop-color="#a8774f"/></linearGradient>
<radialGradient id="sbsun"><stop offset="0" stop-color="#fff6d0"/><stop offset=".55" stop-color="#ffe08a" stop-opacity=".8"/><stop offset="1" stop-color="#ffe08a" stop-opacity="0"/></radialGradient></defs>
<rect width="400" height="860" fill="url(#sbsky)"/>
<circle cx="300" cy="400" r="90" fill="url(#sbsun)"/><circle cx="300" cy="400" r="34" fill="#fff3c4"/>
<path d="M0 472 Q40 440 80 452 T160 446 T240 440 T320 452 T400 444 V500 H0z" fill="#a9c3d6"/>
<g fill="#93aec4"><rect x="34" y="430" width="16" height="30" rx="2"/><rect x="54" y="438" width="20" height="24" rx="2"/><rect x="200" y="432" width="14" height="28" rx="2"/><rect x="218" y="440" width="22" height="20" rx="2"/><rect x="330" y="436" width="18" height="26" rx="2"/>
<path d="M118 470V408h4l5-18 5 18h4v62z"/><path d="M262 470v-30a16 16 0 0 1 32 0v30z"/></g>
<rect y="480" width="400" height="380" fill="url(#sbsea)"/>
<g class="wv" fill="none" stroke="#e8f7fb" stroke-width="3" stroke-linecap="round" opacity=".7"><path d="M20 540q15-8 30 0t30 0"/><path d="M230 520q15-8 30 0t30 0"/><path d="M120 600q15-8 30 0t30 0"/><path d="M290 640q15-8 30 0t30 0"/><path d="M30 680q15-8 30 0t30 0"/></g>
<g class="fer"><g transform="translate(70 528)"><path d="M0 18h120l-12 16H10z" fill="#fff" stroke="#3b2a20" stroke-width="3" stroke-linejoin="round"/><rect x="18" y="4" width="78" height="14" rx="3" fill="#fff6e6" stroke="#3b2a20" stroke-width="3"/><rect x="48" y="-12" width="12" height="16" fill="#e0533c" stroke="#3b2a20" stroke-width="3"/><path d="M26 11h8M40 11h8M64 11h8M78 11h8" stroke="#2f7fb3" stroke-width="4" stroke-linecap="round"/><path d="M8 26h104" stroke="#2f7fb3" stroke-width="3"/></g></g>
<g class="gl"><path d="M60 250q14-14 28 0 14-14 28 0-14-6-28 6-14-12-28-6z" fill="#fff" stroke="#3b2a20" stroke-width="2.6" stroke-linejoin="round"/><path d="M60 250l6-3M116 250l-6-3" stroke="#3b2a20" stroke-width="4" stroke-linecap="round"/></g>
<g class="gl2"><path d="M300 190q10-10 20 0 10-10 20 0-10-4-20 4-10-8-20-4z" fill="#fff" stroke="#3b2a20" stroke-width="2.2" stroke-linejoin="round"/></g>
<g class="gl"><path d="M250 300q8-8 16 0 8-8 16 0-8-3-16 3-8-6-16-3z" fill="#fff" stroke="#3b2a20" stroke-width="2" stroke-linejoin="round"/></g>
<path d="M-20 740 L420 700 V860 H-20z" fill="url(#sbdeck)" stroke="#7d5638" stroke-width="3"/>
<g stroke="#8d6440" stroke-width="2.4" opacity=".7"><path d="M-20 770 L420 732"/><path d="M-20 802 L420 766"/><path d="M-20 836 L420 802"/></g>
<g fill="#7d5638" stroke="#3b2a20" stroke-width="3"><rect x="20" y="688" width="16" height="44" rx="5"/><rect x="364" y="660" width="16" height="44" rx="5"/></g>
<path d="M20 694 L380 664" stroke="#3b2a20" stroke-width="4"/><path d="M20 706 L380 676" stroke="#fff6e6" stroke-width="3" opacity=".8"/>
</svg>`;
/* the Gemini diorama (img/stil-kilavuzu.jpg) behind the title and the hero pick; fades in when loaded,
   until then (or without art) the drawn SVG scene stays */
const BACKDROP = 'stil-kilavuzu';
function artBackdrop(host) {
  const A = artApi(); if (!A || typeof A.when !== 'function') return;
  try {
    A.when(BACKDROP, im => {
      if (!host.parentNode || host.classList.contains('out') || host.querySelector('.sb-art')) return;
      const d = mk('div', 'sb-art');
      const img = new Image(); img.alt = ''; img.decoding = 'async'; img.draggable = false; img.src = im.currentSrc || im.src;
      d.appendChild(img);
      const sc = host.querySelector('.sb-scene'); host.insertBefore(d, sc ? sc.nextSibling : host.firstChild);
      const show = () => requestAnimationFrame(() => requestAnimationFrame(() => { d.classList.add('on'); host.classList.add('has-art'); }));
      if (img.decode) img.decode().then(show, show); else show();
    });
  } catch (e) { console.warn('[SB.ui] backdrop', e); }
}
let titleEl = null;
U.title = function (o) {
  need(); o = o || {};
  if (titleEl) titleEl.remove();
  const t = titleEl = mk('div', 'sb-full sb-title');
  t.innerHTML = SCENE + `<div class="sb-tl-wrap"><div class="sb-tl-top"><div class="sb-logo" role="img" aria-label="Sabri'nin Büfesi"><span class="sb-pamuk">${PAMUK}</span><div class="sb-awn"></div><div class="sb-signb"><span class="l1">Sabri'nin</span><span class="l2">Büfesi</span></div></div>
    <div class="sb-sub">${ICONS.gull}Martıköy İskelesi</div></div>
    <div class="sb-tl-bot"><button class="sb-btn big" data-play>${ICONS.play}Oyna</button><div class="sb-tl-note">Hesabınla gir, arkadaşınla oda kur, beraber çalışın.</div></div></div>`;
  root.appendChild(t); artBackdrop(t);
  t.querySelector('[data-play]').addEventListener('click', () => {
    try { if (C.audioOn) C.audioOn(); } catch (e) {}
    sfx('buy');
    t.classList.add('out'); setTimeout(() => { t.remove(); if (titleEl === t) titleEl = null; }, 340);
    safe(o.onPlay);
  }, { once: true });
  return t;
};
U.pickHero = function () {
  need();
  return new Promise(res => {
    const p = mk('div', 'sb-full sb-pickhero');
    p.innerHTML = SCENE + `<div class="sb-pick">${['sabri', 'sabriye'].map(h => `<button class="sb-pc" data-h="${h}" aria-label="${h === 'sabri' ? 'Sabri' : 'Sabriye'}"><span class="bob">${porTag(h, 200, { eyes: h === 'sabri' ? 'smile' : 'open' })}</span></button>`).join('')}</div><div class="sb-pick-hint">${ICONS.hand}</div>`;
    root.appendChild(p); hydrate(p); artBackdrop(p);
    let done = false;
    p.addEventListener('click', e => {
      const b = e.target.closest('[data-h]'); if (!b || done) return;
      done = true;
      try { if (C.audioOn) C.audioOn(); } catch (er) {}
      sfx('buy'); buzz(20);
      p.querySelectorAll('.sb-pc').forEach(x => x.classList.add(x === b ? 'sel' : 'dim'));
      const hint = p.querySelector('.sb-pick-hint'); if (hint) hint.remove();
      setTimeout(() => { p.classList.add('out'); setTimeout(() => p.remove(), 360); res(b.dataset.h); }, 450);
    });
  });
};

/* ---------- simulated rewarded ad ---------- */
const ADS = [
  { brand: 'Boğaz Gazozu', slogan: 'Köpüğü vapurdan büyük!', bg: 'linear-gradient(160deg,#3fb5b0,#1f6f8f)', icon: 'gazoz' },
  { brand: 'Ayranbey', slogan: 'Bir ayran, bin ferahlık.', bg: 'linear-gradient(160deg,#5aa9d6,#2e4f9a)', icon: 'ayran' },
  { brand: 'Kolaz', slogan: 'Buz gibi, fıkır fıkır.', bg: 'linear-gradient(160deg,#e0533c,#8f2a1c)', icon: 'gazoz' },
  { brand: 'Martı Su', slogan: 'Martılar bile kıskanıyor.', bg: 'linear-gradient(160deg,#9fd3f5,#3f8fc9)', icon: 'gull' }
];
let adBusy = null;
U.ad = function (seconds) {
  need();
  if (adBusy) return adBusy;
  const total = Math.max(1, num(seconds) ? seconds : 5);
  adBusy = new Promise(res => {
    const A = ADS[Math.floor(Math.random() * ADS.length)];
    const m = mk('div', 'sb-modal sb-ad');
    let bubbles = ''; for (let i = 0; i < 9; i++) bubbles += `<i style="left:${8 + i * 10}%;animation-delay:${(i * 0.37) % 2.4}s;width:${8 + (i * 7) % 14}px;height:${8 + (i * 7) % 14}px"></i>`;
    m.innerHTML = `<div class="at">DENEME REKLAMI</div><button class="ac" aria-label="Kalan süre"><span>${Math.ceil(total)}</span></button>
      <div class="stage" style="background:${A.bg}">${bubbles}${I(A.icon)}</div><div class="brand">${A.brand}</div><div class="slogan">${A.slogan}</div>
      <div class="fin" hidden>${btn('Ödülü al', 'x', null, 'big green', null, { icon: 'check' })}</div>
      <div class="fine">Bu bir deneme reklamı. Gerçek reklam gösterilmez, sadece süre dolar.</div>`;
    root.appendChild(m);
    const ac = m.querySelector('.ac'), acs = ac.querySelector('span');
    const t0 = performance.now(); let fin = false, closed = false, autoT = 0, raf = 0;
    const close = () => { if (closed) return; closed = true; clearTimeout(autoT); cancelAnimationFrame(raf); m.classList.add('out'); setTimeout(() => m.remove(), 200); adBusy = null; sfx('cash'); res(true); };
    const tick = () => {
      const el = (performance.now() - t0) / 1000, left = total - el;
      ac.style.setProperty('--p', clamp(el / total, 0, 1).toFixed(3));
      if (left > 0) { acs.textContent = Math.ceil(left); raf = requestAnimationFrame(tick); return; }
      fin = true; ac.classList.add('done'); acs.innerHTML = ICONS.close; m.querySelector('.fin').hidden = false;
      autoT = setTimeout(close, 3000);
    };
    raf = requestAnimationFrame(tick);
    m.addEventListener('click', e => { if (!fin) return; if (e.target.closest('.ac') || e.target.closest('.sb-btn')) close(); });
  });
  return adBusy;
};

/* ---------- welcome back (kepenk) ---------- */
U.welcomeBack = function (o) {
  need(); o = o || {};
  const amt = num(o.amount) ? o.amount : 0;
  const m = mk('div', 'sb-modal');
  m.innerHTML = `<div class="sb-mcard sb-wb" role="dialog" aria-modal="true">
    <div class="art"><span class="aw"></span><span class="moon">${ICONS.moon}</span><span class="sh"><span class="ka"></span></span><span class="cat">${ICONS.cat}</span></div>
    <h2>Hoş geldin!</h2>
    <p>Kepenk <b>${esc(o.away || 'bir süre')}</b> kapalıydı. Pamuk dükkana göz kulak oldu, kasa boş durmadı.</p>
    <div class="amt">${ICONS.coin}+${fmt(amt)} ₺</div>
    <div class="sb-mrow"><button class="sb-btn" data-w="1"><span class="sb-bl">Topla<small>${tl(amt)}</small></span></button>
      <button class="sb-btn blue" data-w="2">${ICONS.play}<span class="sb-bl">Reklamla ×2<small>${tl(amt * 2)}</small></span></button></div>
  </div>`;
  root.appendChild(m);
  let used = false;
  const finish = doubled => {
    m.classList.add('out'); setTimeout(() => m.remove(), 200);
    U.coins(window.innerWidth / 2, window.innerHeight / 2, doubled ? 16 : 10);
    sfx('cash'); safe(o.onCollect, doubled);
  };
  m.addEventListener('click', e => {
    const b = e.target.closest('[data-w]'); if (!b || used) return;
    used = true; m.querySelectorAll('[data-w]').forEach(x => x.classList.add('off'));
    if (b.dataset.w === '2') U.ad(5).then(() => finish(true));
    else finish(false);
  });
  return m;
};

/* ---------- kasa sayımı ceremony ---------- */
const TROPHY = tier => {
  const c = { bronz: ['#d98b4f', '#9a5a2e'], gumus: ['#dfe5ea', '#8f9aa5'], 'gümüş': ['#dfe5ea', '#8f9aa5'], altin: ['#f6bd3a', '#b7811a'], 'altın': ['#f6bd3a', '#b7811a'] }[tier] || ['#f6bd3a', '#b7811a'];
  return svg(`<path d="M34 14h52v26a26 26 0 0 1-52 0z" fill="${c[0]}" ${K}/><path d="M34 22H18c0 16 8 24 20 26M86 22h16c0 16-8 24-20 26" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M42 20v18a18 18 0 0 0 10 16" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/><path d="M52 66h16v16H52z" fill="${c[1]}" ${K}/><rect x="36" y="82" width="48" height="22" rx="4" fill="#7d5638" ${K}/><rect x="44" y="88" width="32" height="10" rx="2" fill="#ffd23f" stroke="${INK}" stroke-width="2"/><path d="M60 26l4 8 9 1.3-6.5 6.3 1.5 9-8-4.2-8 4.2 1.5-9-6.5-6.3 9-1.3z" fill="#fff6e6" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`, '0 0 120 110');
};
U.kasaSayimi = function (o) {
  need(); o = o || {};
  return new Promise(res => {
    const N = 12, total = num(o.total) ? o.total : 0, bonus = num(o.bonus) ? o.bonus : 0;
    const tr = o.trophy || {};
    const m = mk('div', 'sb-modal sb-kasa');
    const vals = ['200', '100', '50'];
    let notes = '';
    for (let i = 0; i < N; i++) {
      const k = i % 3, rot = ((i * 37) % 9) - 4, dx = ((i * 53) % 9) - 4;
      notes += `<div class="sb-note ${['', 'b', 'c'][k]}" style="transform:translate(${dx}px,${-i * 2.4}px) rotate(${rot}deg)"><span class="ne">${ICONS.ferry}</span><span class="nv">${vals[k]}</span><span class="nm">MARTIKÖY</span><span class="nl">${LIRA_SVG}</span></div>`;
    }
    m.innerHTML = `<div class="rays"></div><button class="skip" data-k="skip">Atla${ICONS.skip}</button>
      <div class="kh"><small>${esc(o.week != null ? o.week : 1)}. HAFTA</small><h2>Kasa Sayımı</h2></div>
      <div class="kc"><span>SAYILAN</span><b>0 ₺</b></div><div class="kn">0 / ${N} deste</div>
      <div class="stack" aria-label="Banknot destesi">${notes}</div>
      <div class="hint">${ICONS.hand}<span>Banknotları yukarı kaydır</span></div>`;
    root.appendChild(m);
    const stack = m.querySelector('.stack'), cnt = m.querySelector('.kc b'), kn = m.querySelector('.kn'), hint = m.querySelector('.hint');
    const els = Array.from(stack.querySelectorAll('.sb-note'));
    let counted = 0, shown = 0, closed = false, stage = 'count', lastAct = performance.now(), raf = 0, autoNext = 0;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const finish = () => {
      if (closed) return; closed = true; cancelAnimationFrame(raf); timers.forEach(clearTimeout);
      m.classList.add('out'); setTimeout(() => m.remove(), 220); res();
    };
    const fly = (dx, dy) => {
      if (stage !== 'count' || counted >= N) return;
      const el = els[N - 1 - counted]; counted++; lastAct = performance.now();
      const ang = Math.atan2(dy, dx), d = 520;
      try { el.animate([{ transform: el.style.transform, opacity: 1 }, { transform: `translate(${Math.cos(ang) * d}px,${Math.sin(ang) * d}px) rotate(${(Math.random() - 0.5) * 120}deg)`, opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' }); }
      catch (e) { el.style.opacity = 0; }
      sfx('coin'); buzz(8);
      kn.textContent = counted + ' / ' + N + ' deste';
      if (counted >= N) later(showBonus, 520);
    };
    const tick = () => {
      if (closed) return;
      const target = stage === 'count' ? total * counted / N : total + (stage === 'count' ? 0 : bonus);
      shown += (target - shown) * 0.2; if (Math.abs(target - shown) < 1) shown = target;
      cnt.textContent = fmt(shown) + ' ₺';
      const now = performance.now();
      if (stage === 'count' && now - lastAct > (counted ? 1600 : 2600) && now > autoNext) { autoNext = now + 300; fly(-0.2 + Math.random() * 0.4, -1); lastAct = now - 2000; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const showBonus = () => {
      if (closed) return; stage = 'bonus';
      hint.remove();
      const b = mk('div', 'bonus', `${ICONS.sparkle}Sayım bonusu +${fmt(bonus)} ₺`);
      kn.replaceWith(b); sfx('cash'); buzz(25);
      m.querySelector('.kc span').textContent = 'HAFTANIN KASASI';
      later(showTrophy, 1500);
    };
    const showTrophy = () => {
      if (closed) return; stage = 'trophy';
      stack.remove();
      const t = mk('div', 'tro', `${TROPHY(tr.tier)}<small>HAFTANIN KUPASI</small><h3>${esc(tr.name || 'Haftanın Esnafı')}</h3><button class="sb-btn big" data-k="ok">Rafa koy</button>`);
      m.appendChild(t); sfx('day'); buzz(30);
      later(finish, 6500);
    };
    let sx = 0, sy = 0, down = false, moved = false;
    stack.addEventListener('pointerdown', e => { down = true; moved = false; sx = e.clientX; sy = e.clientY; try { stack.setPointerCapture(e.pointerId); } catch (er) {} });
    stack.addEventListener('pointermove', e => { if (!down || moved) return; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.hypot(dx, dy) > 26) { moved = true; fly(dx, dy); } });
    const up = () => { if (down && !moved) fly(0, -1); down = false; };
    stack.addEventListener('pointerup', up); stack.addEventListener('pointercancel', () => { down = false; });
    m.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) finish(); });
    /* test/bot hook */
    m._sb = { fly, finish, get stage() { return stage; }, get counted() { return counted; } };
  });
};
const LIRA_SVG = svg(LIRA('currentColor'));

/* ---------- sign editor ---------- */
const FONT_FALLBACK = [
  { id: 'yesilcam', name: 'Yeşilçam El Yazısı', color: '#f6ead2', css: 'italic 700 1em "Brush Script MT","Segoe Script","Snell Roundhand","URW Chancery L",cursive' },
  { id: 'vapur', name: 'Vapur Şablonu', color: '#f2b632', css: '900 1em "Arial Black","Impact","Helvetica Neue",sans-serif' },
  { id: 'neon', name: 'Neon', color: '#ff5fa2', css: '400 1em "Trebuchet MS",ui-rounded,"Verdana",sans-serif' },
  { id: 'lale', name: 'Lale Süslü', color: '#f2a2b3', css: 'italic 700 1em Georgia,"Palatino Linotype","Book Antiqua",serif' },
  { id: 'plaza', name: 'Plaza Düz', color: '#ffffff', css: '500 1em "Helvetica Neue",Arial,"Liberation Sans",sans-serif' },
  { id: 'uzay', name: 'Uzay Mono', color: '#49e6d8', css: '700 1em "Courier New",ui-monospace,"DejaVu Sans Mono",monospace' }
];
const fontKey = f => { const s = String((f && (f.id || f.name)) || '').toLowerCase(); for (const k of ['yesil', 'yeşil', 'vapur', 'neon', 'lale', 'plaza', 'uzay']) if (s.indexOf(k) >= 0) return k.replace('ş', 's'); return ''; };
const FONT_KEYS = ['yesil', 'vapur', 'neon', 'lale', 'plaza', 'uzay'];
function normFonts(list) {
  const src = Array.isArray(list) && list.length ? list : (SB.data && Array.isArray(SB.data.SIGN_FONTS) && SB.data.SIGN_FONTS.length ? SB.data.SIGN_FONTS : FONT_FALLBACK);
  return src.slice(0, 6).map((f, i) => {
    if (typeof f === 'string') f = { id: f, name: f };
    const fb = FONT_FALLBACK.find(x => fontKey(x) === fontKey(f)) || FONT_FALLBACK[i % 6];
    const css = f.css || f.font || null, fam = f.family || null;
    return { id: f.id != null ? f.id : fb.id, name: f.name || f.label || f.title || fb.name, css: css && /\d+px|\dem/.test(css) ? css : (fam ? null : fb.css), family: fam, weight: f.weight || 700, style: f.style || 'normal', color: f.color || fb.color, key: fontKey(f) || fontKey(fb) };
  });
}
function applyFont(el, f, size, plain) {
  el.style.font = ''; el.style.fontFamily = ''; el.style.fontWeight = ''; el.style.fontStyle = '';
  if (f.css) el.style.font = f.css;
  else if (f.family) { el.style.fontFamily = f.family; el.style.fontWeight = String(f.weight); el.style.fontStyle = f.style; }
  el.style.fontSize = size + 'px'; el.style.lineHeight = '1.08';
  for (const k of FONT_KEYS) el.classList.toggle('f-' + k, k === f.key);
  if (f.color && !plain) el.style.setProperty('--sc', f.color); else el.style.removeProperty('--sc');
}
const BAD_WORDS = ['amk', 'amina', 'aminak', 'amcik', 'orospu', 'orspu', 'oruspu', 'yarrak', 'yarak', 'siktir', 'sikerim', 'sikeyim', 'sikim', 'sikis', 'sokuk', 'gotveren', 'gotunu', 'gotun', 'pezevenk', 'kahpe', 'kaltak', 'ibne', 'gavat', 'serefsiz', 'pust', 'kancik', 'dalyarak', 'yavsak', 'puşt', 'fuck', 'shit', 'bitch', 'cunt', 'dick', 'asshole', 'bastard', 'whore', 'slut', 'nigg'];
const BAD_TOKENS = ['aq', 'amq', 'mk', 'oc', 'piç', 'pic', 'sik', 'got', 'göt', 'am'];
function localClean(t) {
  const low = String(t).toLocaleLowerCase('tr');
  const leet = low.replace(/[0]/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/4|@/g, 'a').replace(/5|\$/g, 's').replace(/7/g, 't').replace(/8/g, 'b');
  const fold = s => s.replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');
  const squash = fold(leet).replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
  for (const w of BAD_WORDS) { const ww = fold(w).replace(/(.)\1+/g, '$1'); if (squash.indexOf(ww) >= 0) return false; }
  const toks = fold(leet).split(/[^a-z]+/).filter(Boolean);
  for (const w of BAD_TOKENS) if (toks.indexOf(fold(w)) >= 0) return false;
  return true;
}
function checkSign(t) {
  const norm = x => String(x).toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
  let r;
  try { r = (SB.data && typeof SB.data.cleanSign === 'function') ? SB.data.cleanSign(t) : (localClean(t) ? t : false); }
  catch (e) { r = localClean(t) ? t : false; }
  if (r && typeof r === 'object') return { ok: r.ok !== false && !r.bad && !r.blocked, text: r.text || r.clean || t, reason: typeof r.reason === 'string' ? r.reason : '' };
  if (r === true) return { ok: true, text: t };
  if (r === false || r == null) return { ok: false, text: t };
  return { ok: norm(r) === norm(t), text: String(r) };
}
let signEl = null, signCancel = null;
function closeSign(user) { if (!signEl) return; const s = signEl; signEl = null; s.classList.add('out'); setTimeout(() => s.remove(), 200); if (user && signCancel) safe(signCancel); signCancel = null; }
U.signEditor = function (o) {
  need(); o = o || {};
  if (signEl) signEl.remove();
  const fonts = normFonts(o.fonts);
  let font = fonts.find(f => f.id === o.font) || fonts[0];
  let text = String(o.text || "Sabri'nin Büfesi").slice(0, 20), night = false;
  const m = signEl = mk('div', 'sb-modal');
  signCancel = o.onCancel || null;
  m.innerHTML = `<div class="sb-mcard sb-sign" role="dialog" aria-modal="true"><h2>Tabela</h2>
    <div class="sb-sprev"><div class="sb-awn"></div><div class="bd"><span class="tx"></span></div></div>
    <div class="sb-srow"><label for="sb-signin">Büfenin adı</label><button class="sb-nt" data-s="night" aria-pressed="false">${ICONS.moon}<span>Gece görünümü</span></button></div>
    <div class="sb-sin"><input id="sb-signin" type="text" maxlength="20" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="done"><span class="cnt"></span></div>
    <div class="sb-fonts">${fonts.map((f, i) => `<button data-f="${i}"><span class="fa">Büfe</span><small>${esc(f.name)}</small></button>`).join('')}</div>
    <div class="sb-smsg"></div>
    ${o.tiers ? '<div class="sb-tbl"></div>' : ''}
    <div class="sb-mrow"><button class="sb-btn cream" data-s="no">Vazgeç</button><button class="sb-btn green" data-s="ok">${ICONS.checkInk.replace(INK, '#fff').replace(INK, '#fff')}Kaydet</button></div></div>`;
  root.appendChild(m);
  const tx = m.querySelector('.tx'), bd = m.querySelector('.bd'), inp = m.querySelector('input'), cnt = m.querySelector('.cnt'), msg = m.querySelector('.sb-smsg'), ok = m.querySelector('[data-s="ok"]'), prev = m.querySelector('.sb-sprev');
  m.querySelectorAll('.sb-fonts button').forEach((b, i) => applyFont(b.querySelector('.fa'), fonts[i], 22, true));
  inp.value = text;
  let valid = true, cleanTxt = text;
  const fit = () => {
    let size = 36; applyFont(tx, font, size);
    const max = bd.clientWidth - 20;
    for (let k = 0; k < 14 && tx.scrollWidth > max && size > 14; k++) { size -= 2; tx.style.fontSize = size + 'px'; }
  };
  const update = () => {
    text = inp.value.replace(/\s+/g, ' ').slice(0, 20);
    const tr = text.trim();
    tx.textContent = tr || ' ';
    cnt.textContent = tr.length + ' / 20';
    m.querySelectorAll('.sb-fonts button').forEach((b, i) => b.classList.toggle('on', fonts[i] === font));
    if (tr.length < 3) { valid = false; msg.className = 'sb-smsg bad'; msg.textContent = 'En az 3 harf yaz.'; }
    else {
      const c = checkSign(tr); valid = c.ok; cleanTxt = valid ? c.text : tr;
      msg.className = 'sb-smsg' + (valid ? '' : ' bad');
      msg.textContent = valid ? 'Gece neon yanar, gece görünümüyle bakabilirsin.' : (c.reason || 'Bu ad tabelaya yakışmaz, başka bir ad dene.');
    }
    ok.classList.toggle('off', !valid);
    fit();
  };
  inp.addEventListener('input', update);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
  m.addEventListener('click', e => {
    const f = e.target.closest('[data-f]'); if (f) { font = fonts[+f.dataset.f]; update(); return; }
    const b = e.target.closest('[data-s]'); if (!b) return;
    if (b.dataset.s === 'night') { night = !night; prev.classList.toggle('night', night); b.classList.toggle('on', night); b.setAttribute('aria-pressed', String(night)); b.innerHTML = (night ? ICONS.sun : ICONS.moon) + `<span>${night ? 'Gündüz görünümü' : 'Gece görünümü'}</span>`; return; }
    if (b.dataset.s === 'no') { closeSign(true); return; }
    if (b.dataset.s === 'ok') { if (!valid) { msg.animate && msg.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], 240); return; } closeSign(false); sfx('buy'); safe(o.onSave, cleanTxt.trim(), font.id); }
  });
  // tabela seviyesi + neon rengi (sim/tabela.ts): what the sign is worth, not just its name
  const tbl = m.querySelector('.sb-tbl');
  const paintTbl = () => {
    if (!tbl) return;
    const t = o.tabela(), cur = o.tiers[t.tier], nx = o.tiers[t.tier + 1];
    const pct = x => '+%' + Math.round(x * 100);
    tbl.innerHTML = `<div style="font:900 16px var(--disp);margin:10px 0 4px">Tabela seviyesi: ${esc(cur.ad)}</div>
      <div class="sb-muted" style="font-size:14px">${esc(cur.desc)} ${cur.musteri ? 'Müşteri ' + pct(cur.musteri) + ', gece ' + pct(cur.musteri + cur.gece) + '.' : 'Henüz ekstra müşteri çekmiyor.'}</div>
      ${nx ? `<button class="sb-btn ${t.money >= nx.fiyat ? 'green' : 'cream off'}" data-s="buy" style="width:100%;margin-top:8px">${esc(nx.ad)} al · ${nx.fiyat.toLocaleString('tr-TR')} ₺<small style="display:block;font:700 12px var(--body)">Müşteri ${pct(nx.musteri)}, gece ${pct(nx.musteri + nx.gece)}</small></button>` : '<div class="sb-muted">En iyi tabela sende!</div>'}
      ${t.tier >= 1 ? `<div style="font:900 14px var(--disp);margin:10px 0 4px">Işık rengi</div><div style="display:flex;gap:8px;flex-wrap:wrap">${o.renkler.map(r => `<button data-r="${r}" style="width:36px;height:36px;border-radius:50%;border:3px solid #3b2a20;background:${r};${r === t.renk ? 'outline:4px solid #ffd23f;' : ''}cursor:pointer"></button>`).join('')}</div>` : ''}`;
  };
  if (tbl) tbl.addEventListener('click', e => {
    const r = e.target.closest('[data-r]'); if (r) { safe(o.onRenk, r.dataset.r); setTimeout(paintTbl, 30); return; }
    if (e.target.closest('[data-s="buy"]')) { e.stopPropagation(); safe(o.onBuy); setTimeout(paintTbl, 30); }
  });
  paintTbl();
  update();
  requestAnimationFrame(fit);
  return m;
};
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (confirmEl) { confirmEl.querySelector('[data-c="no"]').click(); return; }
  if (signEl) { closeSign(true); return; }
  if (sheet) { userClose(); return; }
  if (solEl) closeSol();
});
window.addEventListener('resize', measure);
U.measure = measure;
U.hydrate = hydrate;
U.openSheetOpen = () => !!sheet;
return U;
}
export type V2UiApi = ReturnType<typeof createV2Ui>;
