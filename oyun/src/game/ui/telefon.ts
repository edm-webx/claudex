// Esnaf Telefonu HUD (2026-11-26, owner picked "B · Esnaf telefonu" in the HUD concept, artifact SgLFgzQ46Ce1fXk8zvpq59).
// The old 8-10 button bottom bar is gone: the bar holds only Çanta + Telefon (panels.ts menuItems), everything else lives in
// the phone as apps. Phone-landscape first (owner: "telefonda dopdolu durdu"): the middle of the screen stays empty.
// Pieces, all view-only (they send commands / ui:open events, never write sim state):
// - the phone sheet: a slide-up handset with app tiles (Harita, Ajanda, Mülklerim, Martı Kasa, Karne, Karakter, Ayarlar, Arkadaşlar)
// - Mülklerim opens the bag sheet's read-only 'holding' screen; Martı Kasa is a read-only screen inside the phone (buying, building, money moves happen at the office / ATM / bank)
// - the mini map: a round schematic of the iskele zone baked once from nav.walkable (no extra render pass), bottom-left
// - the "Büfem" context pill: shown while Sabri stands on his own pier; chips open Menü / Ekip / Tadilat of the büfe
import { ICONS } from '../../engine/ui/v2-style';
import { ISKELE_ZONE } from '../../content/zones/iskele';
import { PIER } from '../../content/prefabs/iskele/layout';
import { BANKA, ATMLER, EMLAK } from '../../content/esya';
import { mulkApi } from '../sim/mulk';
import { realmAt } from '../../content/realm';

type Cmd = { kind: string; [k: string]: unknown };
interface Deps {
  root: HTMLElement;
  rules: () => { state: any; rt: any } | null;
  heroPos: () => { x: number; z: number };
  walkable?: (p: { x: number; z: number }) => boolean;
  command(c: Cmd): void;
  sfx?(id: string): void;
}
export interface Telefon { update(dt: number): void; open(): void; close(): void; toggle(): void; isOpen(): boolean; badge(): number; dispose(): void }

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const tl = (n: number) => Math.round(n || 0).toLocaleString('tr') + ' ₺';
const I = (k: string) => ICONS[k] || '';

const CSS = `
#sbui .sb-bar{left:auto!important;right:calc(var(--sr) + 12px)!important;bottom:calc(var(--sbm) + 12px)!important;margin:0!important;max-width:none!important;width:auto!important;overflow:visible!important;padding:5px!important;gap:4px!important}
#sbui .sb-bar .sb-bi{min-width:72px!important;min-height:60px!important;flex:none!important}
.tf-mini{position:absolute;left:calc(var(--sl,0px) + 12px);bottom:calc(var(--sbm,0px) + 12px);z-index:34;width:132px;height:132px;border-radius:50%;padding:0;border:3px solid rgba(255,255,255,.88);background:#9ccde0;overflow:hidden;box-shadow:0 8px 20px rgba(4,10,24,.4);cursor:pointer;pointer-events:auto}
.tf-mini canvas{display:block;width:100%;height:100%}
.tf-mini b{position:absolute;left:50%;bottom:7px;transform:translateX(-50%);font:900 10px/1 var(--body);letter-spacing:.1em;color:#fff;background:rgba(11,19,38,.85);padding:3px 8px;border-radius:6px;pointer-events:none}
.tf-mini.uzak canvas{display:none}.tf-mini.uzak:after{content:attr(data-yer);position:absolute;top:22%;left:8px;right:8px;text-align:center;font:800 12px/1.15 var(--disp,system-ui);color:#fff}.tf-mini.uzak{background:rgba(11,19,38,.85);display:grid;place-items:center}.tf-mini.uzak:before{content:"";width:46px;height:46px;background:currentColor;color:#fff;-webkit-mask:var(--ic) center/contain no-repeat;mask:var(--ic) center/contain no-repeat}
.tf-ctx{position:absolute;left:50%;bottom:calc(var(--sbm,0px) + 14px);transform:translateX(-50%);z-index:34;display:none;align-items:center;gap:8px;padding:6px 8px 6px 12px;border-radius:999px;background:#fff6e6;color:#3b2a20;border:3px solid #3b2a20;box-shadow:0 4px 0 #3b2a20;font:900 15px var(--disp);pointer-events:auto;white-space:nowrap}
.tf-ctx.on{display:flex}.tf-ctx svg{width:24px;height:24px}
.tf-ctx button{min-height:44px;padding:0 14px;border-radius:999px;border:2.5px solid #3b2a20;background:#ffd23f;font:900 14px var(--disp);color:#3b2a20;cursor:pointer}
.tf-bg{position:fixed;inset:0;z-index:61;display:none;pointer-events:auto;background:rgba(8,12,26,.28)}
.tf-bg.on{display:block}
.tf-ph{position:absolute;right:calc(var(--sr,0px) + 18px);bottom:12px;top:12px;width:min(340px,calc(100vw - 32px));max-height:680px;margin-top:auto;border-radius:40px;background:#0d1020;border:3px solid #2c3352;box-shadow:0 20px 50px rgba(0,0,0,.5);padding:12px;animation:tf-in .22s cubic-bezier(.2,1.2,.4,1)}
@keyframes tf-in{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.tf-ph{animation:none}}
.tf-scr{position:relative;height:100%;border-radius:30px;overflow:hidden;background:linear-gradient(170deg,#ffe7b0 0%,#f6b37a 45%,#7c6bb0 100%);color:#3b2a20;display:flex;flex-direction:column}
.tf-notch{position:absolute;top:7px;left:50%;transform:translateX(-50%);width:86px;height:20px;border-radius:12px;background:#0d1020;z-index:2}
.tf-in{flex:1;overflow-y:auto;padding:36px 16px 16px;scrollbar-width:none}
.tf-clock{font:800 42px/1 var(--disp);text-align:center;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.2)}
.tf-date{text-align:center;font:800 13px var(--body);color:#fff;margin:2px 0 12px}
.tf-w{background:rgba(255,255,255,.88);border-radius:18px;padding:10px 12px;font:800 13px/1.35 var(--body);margin-bottom:14px}
.tf-w b{display:block;font:900 11px var(--body);letter-spacing:.1em;color:#a0522d;margin-bottom:2px}
.tf-apps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px 6px}
.tf-app{display:grid;justify-items:center;gap:4px;font:800 12px var(--body);color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.4);background:none;border:0;padding:0;cursor:pointer;position:relative}
.tf-app i{width:58px;height:58px;border-radius:17px;display:grid;place-items:center;box-shadow:0 3px 0 rgba(0,0,0,.18)}
.tf-app i svg{width:34px;height:34px}
.tf-app em{position:absolute;top:-4px;right:8px;min-width:20px;height:20px;border-radius:10px;background:#e0533c;color:#fff;font:900 11px/20px var(--body);font-style:normal;border:2px solid #fff;text-shadow:none}
.tf-top{display:flex;align-items:center;gap:8px;margin:-4px 0 10px}.tf-top h3{flex:1;margin:0;font:900 20px var(--disp);color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.3)}
.tf-back,.tf-x{min-width:44px;min-height:44px;border-radius:14px;border:0;background:rgba(255,255,255,.85);font:900 18px var(--disp);color:#3b2a20;cursor:pointer}
.tf-row{background:rgba(255,255,255,.9);border-radius:16px;padding:10px 12px;margin-bottom:8px;font:700 13px/1.35 var(--body)}
.tf-row b{display:block;font:900 15px/1.2 var(--disp)}.tf-row small{display:block;opacity:.8}
.tf-big{font:800 30px/1.1 var(--disp);color:#2f7a45}
.tf-hint{font:800 12px/1.35 var(--body);color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.35);margin-top:6px}
/* phone landscape (owner 2026-11-26: "telefonda dopdolu"): side cards shrink to one line, the date chip goes into the phone */
@media (max-height:460px),(max-width:700px){
  .hd-card{width:min(190px,40vw)!important}.hd-card .hd-sm,.hd-card .hd-main .sb,.hd-card .hd-amt{display:none!important}.hd-card .hd-main{border-bottom:0!important;padding:5px 8px!important}
  .hv-chip{display:none!important}
  #sbui .sb-bar .sb-bi{max-width:none!important;min-width:64px!important;height:56px!important;min-height:56px!important}#sbui .sb-bar .sb-bi span{display:block!important;font-size:10px!important}#sbui .sb-bar .sb-bi svg{width:26px!important;height:26px!important}
  .f2-rail{top:calc(var(--hudb,100px) + 6px)!important;width:140px!important}.f2-rail .f2-top,.f2-rail .f2-note{display:none!important}
  .tf-apps{grid-template-columns:repeat(4,1fr)}.tf-w{display:none}.tf-ph{width:min(380px,calc(100vw - 24px))!important}
}
@media (max-height:460px){.tf-mini{width:96px;height:96px}.tf-mini b{display:none}.tf-ph{width:min(300px,calc(100vw - 24px));border-radius:30px;padding:8px}.tf-scr{border-radius:24px}.tf-clock{font-size:30px}.tf-in{padding-top:30px}.tf-app i{width:50px;height:50px}.tf-apps{gap:8px 4px}.tf-w{margin-bottom:10px}}
`;

type Screen = 'home' | 'kasa';
const APPS: { id: string; ad: string; ic: string; bg: string }[] = [
  { id: 'harita', ad: 'Harita', ic: 'map', bg: '#3a8fd6' }, { id: 'gorevler', ad: 'Ajanda', ic: 'gorev', bg: '#e0883a' }, { id: 'holding', ad: 'Mülklerim', ic: 'shop', bg: '#8b5cc4' },
  { id: 'kasa', ad: 'Martı Kasa', ic: 'coin', bg: '#3aa776' }, { id: 'karne', ad: 'Karne', ic: 'karne', bg: '#c49a2a' }, { id: 'karakter', ad: 'Karakter', ic: 'smile', bg: '#4a5370' },
  { id: 'ayarlar', ad: 'Ayarlar', ic: 'gear', bg: '#6c7488' }, { id: 'arkadas', ad: 'Arkadaşlar', ic: 'people', bg: '#d6513a' },
];

export function createTelefon(d: Deps): Telefon {
  const st = document.createElement('style'); st.textContent = CSS; d.root.appendChild(st);
  const emit = (id: string) => d.root.dispatchEvent(new CustomEvent('ui:open', { detail: id, bubbles: true }));
  const S = () => d.rules()?.state;

  /* ---------- mini map ---------- */
  const mini = document.createElement('button'); mini.className = 'tf-mini'; mini.setAttribute('aria-label', 'Harita');
  mini.style.setProperty('--ic', `url("data:image/svg+xml,${encodeURIComponent(I('map'))}")`);
  const cv = document.createElement('canvas'); cv.width = 264; cv.height = 264; mini.appendChild(cv);
  const lbl = document.createElement('b'); lbl.textContent = 'HARİTA'; mini.appendChild(lbl);
  d.root.appendChild(mini);
  mini.onclick = () => { try { d.sfx?.('pick'); } catch { /* */ } emit('harita'); };
  const B = ISKELE_ZONE.bounds!, PX = 3;   // 3 px per metre in the baked map
  let bake: HTMLCanvasElement | null = null, bakeKey = '', bakeT = 0;
  function doBake() {
    const W = Math.round((B.x1 - B.x0) * PX), H = Math.round((B.z1 - B.z0) * PX), c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d')!, img = g.createImageData(W, H), px = img.data, step = 1 / PX;
    const put = (i: number, r: number, gg: number, b: number) => { px[i] = r; px[i + 1] = gg; px[i + 2] = b; px[i + 3] = 255; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const wx = B.x0 + (x + 0.5) * step, wz = B.z0 + (y + 0.5) * step, i = (y * W + x) * 4;
      const ok = d.walkable ? d.walkable({ x: wx, z: wz }) : true;
      const pier = wx >= PIER.x0 && wx <= PIER.x1 && wz >= PIER.z0 && wz <= PIER.z1;
      if (ok) put(i, pier ? 214 : 233, pier ? 178 : 220, pier ? 128 : 192);
      else if (wz < PIER.z1 && !pier) put(i, 102, 172, 214);          // the Boğaz
      else if (wz > 13.3 && wz < 28.4) put(i, 70, 76, 92);           // the coast road
      else put(i, 92, 104, 128);                                     // buildings, fences, stands
    }
    g.putImageData(img, 0, 0); bake = c;
  }
  const POI = (): { x: number; z: number; c: string }[] => [{ x: 0, z: 0, c: '#ffd23f' }, { x: BANKA.x, z: BANKA.z, c: '#5aa9d6' }, { x: EMLAK.x, z: EMLAK.z, c: '#8fd06b' }, ...ATMLER.map(a => ({ x: a.x, z: a.z, c: '#ffffff' }))];
  function drawMini() {
    const p = d.heroPos(), inZone = p.x >= B.x0 - 4 && p.x <= B.x1 + 4 && p.z >= B.z0 - 4 && p.z <= B.z1 + 4;
    mini.classList.toggle('uzak', !inZone); if (!inZone) { const ad = realmAt(p.x)?.name || ''; if (mini.dataset.yer !== ad) mini.dataset.yer = ad; }
    if (!inZone || !bake) return;
    const g = cv.getContext('2d')!, R = cv.width, span = 64 * PX;   // 64 m across
    g.fillStyle = '#66acd6'; g.fillRect(0, 0, R, R);
    const sx = (p.x - B.x0) * PX - span / 2, sy = (p.z - B.z0) * PX - span / 2;
    g.imageSmoothingEnabled = false; g.drawImage(bake, sx, sy, span, span, 0, 0, R, R);
    const k = R / span;
    for (const q of POI()) { const x = ((q.x - B.x0) * PX - sx) * k, y = ((q.z - B.z0) * PX - sy) * k; if (x < 0 || y < 0 || x > R || y > R) continue; g.fillStyle = q.c; g.strokeStyle = '#14182a'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); g.stroke(); }
    g.fillStyle = '#ffd23f'; g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(R / 2, R / 2, 12, 0, 7); g.fill(); g.stroke();
  }

  /* ---------- Büfem context pill ---------- */
  const ctx = document.createElement('div'); ctx.className = 'tf-ctx'; d.root.appendChild(ctx);
  let ctxKey = '';
  ctx.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button'); if (b?.dataset.p) { try { d.sfx?.('pick'); } catch { /* */ } emit(b.dataset.p); } });
  function drawCtx() {
    const s = S(), p = d.heroPos(), rt = d.rules()?.rt;
    const near = !!s && p.x >= PIER.x0 - 2 && p.x <= PIER.x1 + 2 && p.z >= PIER.z0 - 2 && p.z <= PIER.z1 + 3;
    const busy = !!(rt && (rt.panel || rt.boardOpen)) || open_;
    // same unlock rules the old bar used (panels.ts menuItems before 2026-11-26)
    const chips: [string, string][] = [];
    if (s && s.level >= 2) chips.push(['menu', 'Menü']);
    if (s && ((s.workers && s.workers.length) || s.level >= 3)) chips.push(['isciler', 'Ekip']);
    if (s && (s.stars >= 1 || s.stage > 1 || s.tadilat)) chips.push(['tadilat', 'Tadilat']);
    const show = near && !busy && chips.length > 0;
    const key = show ? chips.map(c => c[0]).join(',') : '';
    if (key !== ctxKey) { ctxKey = key; ctx.innerHTML = show ? `${I('shop')}<span>Büfem</span>${chips.map(([id, ad]) => `<button data-p="${id}">${ad}</button>`).join('')}` : ''; }
    ctx.classList.toggle('on', show);
  }

  /* ---------- phone ---------- */
  const bg = document.createElement('div'); bg.className = 'tf-bg'; d.root.appendChild(bg);
  let open_ = false, scr: Screen = 'home', key = '', t = 0;
  for (const ev of ['pointerdown', 'wheel', 'keyup'] as const) bg.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  bg.addEventListener('keydown', e => { e.stopPropagation(); if ((e as KeyboardEvent).key === 'Escape') api.close(); });
  function badges(): { ajanda: number } {
    const s = S(); let n = 0;
    const l = s?.orders?.list; if (l) for (const o of l) if (o.done && !o.claimed) n++;
    const m = mulkApi(d.rules() as never)?.model(); if (m) for (const h of m.gunluk) if (h.sayi >= h.hedef && !h.alindi) n++;
    return { ajanda: n };
  }
  function home(): string {
    const s = S() || {}, m = mulkApi(d.rules() as never)?.model(), gl = (m?.gunluk || []).filter((h: any) => !h.alindi).slice(0, 2);
    const clk = (document.querySelector('#sbui .clk') as HTMLElement | null)?.textContent || '';
    const bd = badges();
    return `<div class="tf-clock">${esc(clk || ' ')}</div><div class="tf-date">Gün ${s.day || 1} · ${tl(s.money)}</div>
${gl.length ? `<div class="tf-w"><b>AJANDA · BUGÜN</b>${gl.map((h: any) => `${esc(h.ad)} (${h.sayi}/${h.hedef})`).join('<br>')}</div>` : ''}
<div class="tf-apps">${APPS.map(a => `<button class="tf-app" data-app="${a.id}"><i style="background:${a.bg}">${I(a.ic)}</i>${esc(a.ad)}${a.id === 'gorevler' && bd.ajanda ? `<em>${bd.ajanda}</em>` : ''}</button>`).join('')}</div>`;
  }
  const top = (h: string) => `<div class="tf-top"><button class="tf-back" data-back="1" aria-label="Geri">‹</button><h3>${esc(h)}</h3></div>`;
  function kasaScr(): string {
    const m = mulkApi(d.rules() as never)?.model(), s = S() || {};
    const b = m?.banka || { tl: 0, borc: 0 };
    return top('Martı Kasa') + `<div class="tf-row"><small>Cebinde</small><div class="tf-big">${tl(s.money)}</div></div><div class="tf-row"><small>Bankada</small><div class="tf-big" style="color:#2a6fb8">${tl(b.tl)}</div>${b.borc >= 1 ? `<small>Kredi borcun: ${tl(b.borc)}</small>` : ''}</div>
<div class="tf-hint">Para yatırmak ve çekmek için bir ATM'ye ya da Martı Kasası Bankası gişesine git. Kredi yalnızca gişede. ATM'ler: iskele, meydan, AVM önü.</div>`;
  }
  function paint() {
    const html = scr === 'kasa' ? kasaScr() : home();
    if (html === key) return; key = html;
    bg.innerHTML = `<div class="tf-ph" role="dialog" aria-label="Telefon"><div class="tf-scr"><div class="tf-notch"></div><div class="tf-in">${html}</div></div></div>`;
  }
  bg.addEventListener('click', e => {
    if (e.target === bg) { api.close(); return; }
    const el = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!el) return;
    try { d.sfx?.('pick'); } catch { /* */ }
    if (el.dataset.back) { scr = 'home'; key = ''; paint(); return; }
    const a = el.dataset.app; if (!a) return;
    if (a === 'kasa') { scr = a; key = ''; paint(); return; }
    api.close();
    if (a === 'arkadas') { (document.querySelector('.on-oda') as HTMLElement | null)?.click(); return; }
    emit(a);
  });

  const api: Telefon = {
    open() { open_ = true; scr = 'home'; key = ''; paint(); bg.classList.add('on'); bg.tabIndex = -1; bg.focus(); },
    close() { open_ = false; bg.classList.remove('on'); },
    toggle() { if (open_) api.close(); else api.open(); },
    isOpen: () => open_,
    badge: () => badges().ajanda,
    update(dt) {
      t -= dt; if (t > 0) return; t = 0.1;
      const s = S(); if (!s) return;
      bakeT -= 0.1;
      const bk = (s.stage || 1) + '|' + (d.walkable ? 1 : 0);
      if ((bk !== bakeKey && bakeT <= 0) || !bake) { bakeKey = bk; bakeT = 2; try { doBake(); } catch { bake = null; } }
      drawMini(); drawCtx();
      if (open_) paint();
    },
    dispose() { st.remove(); mini.remove(); ctx.remove(); bg.remove(); },
  };
  return api;
}
