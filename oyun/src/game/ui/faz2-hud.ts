/**
 * Faz 2 HUD (DOM only). Reads restoranApi / zincirApi, writes through command().
 *  - Smaller speech/order bubbles (CSS override of engine/ui/v2-style).
 *  - Adisyon rail: right edge under the HUD, one slip per open ticket (table no, items left, time bar),
 *    Günün Yemeği and servis stars on top. Shown only in the restaurant phase.
 *  - Zincir: a round button (once the büfe is Lokanta) opening a sheet with the shop chain: a small Martıköy map with
 *    pins, buy buttons, rename field and menu toggles per open shop.
 */
import { restoranApi } from '../sim/restoran';
import { zincirApi, type DukkanView } from '../sim/zincir';
import { DUKKAN_AD_MAX } from '../../content/dukkanlar';

export interface Faz2HudDeps {
  root: HTMLElement;
  rules(): { rt: { started: boolean; paused: boolean }; state?: unknown } | null;
  command(c: { kind: string; [k: string]: unknown }): void;
  sfx?(id: string): void;
}
export interface Faz2Hud { update(dt: number): void; dispose(): void }

const CSS = `
.sb-lab .bubble{padding:2px 6px 3px;border-width:2px;max-width:112px;font-size:10.5px;margin-bottom:14px;border-radius:12px}
.sb-lab .bubble::before{width:9px;height:9px;bottom:-10px;border-width:2px}
.sb-lab .bubble::after{width:5px;height:5px;bottom:-16px;border-width:2px}
.sb-lab .bubble .bi svg{width:19px;height:19px}
.sb-lab .bubble .bi .n{font-size:10.5px}
.sb-lab .bubble .bt{max-width:100px}
.sb-lab .say{padding:4px 8px 5px;font-size:10.5px;max-width:150px;border-radius:11px;margin-bottom:10px}
.sb-sheet.dk-low{max-height:38dvh!important;max-height:min(38dvh,340px)!important;bottom:calc(var(--sbm) + var(--barh) + 6px)!important}
.sb-sheet.dk-low .sb-shb{padding-bottom:6px}
.f2-rail{position:absolute;right:calc(var(--sr,0px) + 8px);top:calc(var(--hudb,100px) + 70px);width:132px;z-index:23;display:flex;flex-direction:column;gap:5px;pointer-events:none;
  font-family:var(--body,system-ui,sans-serif);color:var(--ink,#3b2a20);transition:opacity .25s}
.f2-rail.off{opacity:0;pointer-events:none!important}
.f2-rail>*{pointer-events:auto}
.f2-ph{display:flex;justify-content:space-between;align-items:center;gap:6px;background:#ffd23f;border:2px solid var(--ink,#3b2a20);border-radius:10px;padding:3px 7px;font:900 11.5px/1.2 var(--disp,system-ui);cursor:pointer;box-shadow:0 2px 0 var(--ink,#3b2a20)}
.f2-note{font:700 10px/1.25 var(--body,system-ui);opacity:.75;padding:0 2px}
.f2-top{background:var(--ink,#3b2a20);color:#fff8ec;border-radius:10px;padding:4px 7px;font:800 11px/1.25 var(--body,system-ui)}
.f2-top b{color:#ffd23f}
.f2-slip{background:#fffdf6;border:2px solid var(--ink,#3b2a20);border-radius:4px 4px 10px 10px;padding:3px 6px 4px;box-shadow:0 2px 0 var(--ink,#3b2a20);
  font:800 11px/1.25 var(--body,system-ui);animation:f2-in .25s ease-out;background-image:repeating-linear-gradient(transparent 0 13px,rgba(59,42,32,.08) 13px 14px)}
.f2-slip.sp{border-color:#d68910}
.f2-slip.late{animation:f2-shake .5s ease-in-out infinite alternate}
.f2-slip .h{display:flex;justify-content:space-between;font:900 12px/1.2 var(--disp,system-ui)}
.f2-slip .h i{font-style:normal;background:var(--ink,#3b2a20);color:#fff;border-radius:7px;padding:0 5px}
.f2-slip s{opacity:.45}
.f2-slip .bar{height:5px;border-radius:3px;background:#e8dccb;margin-top:3px;overflow:hidden}
.f2-slip .bar u{display:block;height:100%;background:#5fc36f}
.f2-slip.late .bar u{background:#e74c3c}
@keyframes f2-in{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}
@keyframes f2-shake{from{transform:rotate(-1.5deg)}to{transform:rotate(1.5deg)}}
.f2-zbtn{position:absolute;right:calc(var(--sr,0px) + 10px);bottom:calc(var(--sb,0px) + 214px);z-index:24;width:52px;height:52px;border-radius:50%;border:3px solid var(--ink,#3b2a20);
  background:#ffd23f;box-shadow:0 3px 0 var(--ink,#3b2a20);font:900 24px/1 system-ui;display:grid;place-items:center;cursor:pointer;pointer-events:auto;padding:0}
.f2-zbtn.off{display:none}
.f2-zbtn.new::after{content:"!";position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;background:#e74c3c;color:#fff;font:900 12px/18px system-ui;text-align:center}
.f2-sheet{position:absolute;inset:0;z-index:60;background:rgba(30,20,12,.45);display:flex;align-items:flex-end;justify-content:center;pointer-events:auto}
.f2-sheet.off{display:none}
.f2-card{width:min(440px,100%);max-height:86%;overflow:auto;background:var(--paper,#fff8ec);border:3px solid var(--ink,#3b2a20);border-bottom:0;border-radius:20px 20px 0 0;
  padding:12px 14px 18px;color:var(--ink,#3b2a20);font-family:var(--body,system-ui,sans-serif);box-sizing:border-box}
.f2-card h3{margin:0 0 2px;font:900 20px/1.1 var(--disp,system-ui)}
.f2-card .sub{font:700 12.5px/1.3 var(--body,system-ui);color:var(--ink2,#6b5444);margin-bottom:8px}
.f2-x{float:right;border:2px solid var(--ink,#3b2a20);background:#fff;border-radius:10px;width:34px;height:34px;font:900 16px/1 system-ui;cursor:pointer}
.f2-map{position:relative;height:120px;border:2px solid var(--ink,#3b2a20);border-radius:12px;background:linear-gradient(160deg,#cfe8c4,#e9dcb8 55%,#9fd3f0 56%);margin-bottom:10px;overflow:hidden}
.f2-pin{position:absolute;transform:translate(-50%,-100%);font-size:20px;filter:grayscale(1);opacity:.45}
.f2-pin.acik{filter:none;opacity:1;animation:f2-bob 1.6s ease-in-out infinite alternate}
.f2-pin.alinabilir{filter:none;opacity:.8}
@keyframes f2-bob{to{transform:translate(-50%,-112%)}}
.f2-shop{border:2px solid var(--ink,#3b2a20);border-radius:14px;padding:8px 10px;margin-bottom:8px;background:#fff}
.f2-shop.kilitli{opacity:.6;background:#f3ece0}
.f2-shop .t{display:flex;align-items:center;gap:8px}
.f2-shop .ic{font-size:26px}
.f2-shop .n{flex:1;min-width:0}
.f2-shop .n b{display:block;font:900 15px/1.15 var(--disp,system-ui)}
.f2-shop .n em{font-style:normal;font:700 11.5px/1.25 var(--body,system-ui);color:var(--ink2,#6b5444)}
.f2-shop .k{font:800 12px/1.3 var(--body,system-ui);margin-top:5px}
.f2-shop .k u{text-decoration:none;color:#226b3a}
.f2-buy{border:2px solid var(--ink,#3b2a20);border-radius:10px;background:#5fc36f;color:#fff;font:900 13px/1 var(--disp,system-ui);padding:8px 10px;cursor:pointer;box-shadow:0 2px 0 var(--ink,#3b2a20)}
.f2-buy:disabled{background:#bbb;cursor:default}
.f2-ad{display:flex;gap:6px;margin-top:6px}
.f2-ad input{flex:1;min-width:0;border:2px solid var(--ink,#3b2a20);border-radius:9px;padding:6px 8px;font:800 13px/1 var(--body,system-ui);background:#fffdf6}
.f2-ad button{border:2px solid var(--ink,#3b2a20);border-radius:9px;background:#ffd23f;font:900 12px/1 system-ui;padding:0 10px;cursor:pointer}
.f2-menu{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.f2-menu button{border:2px solid var(--ink,#3b2a20);border-radius:20px;background:#fff;padding:4px 9px;font:800 12px/1.1 var(--body,system-ui);cursor:pointer}
.f2-menu button.on{background:#ffd23f}
`;

const fmt = (n: number) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const esc = (s: unknown) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const stars = (v: number) => { const n = Math.round(v); return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n)); };

export function createFaz2Hud(d: Faz2HudDeps): Faz2Hud {
  if (!document.getElementById('f2-css')) { const st = document.createElement('style'); st.id = 'f2-css'; st.textContent = CSS; document.head.appendChild(st); }
  const rail = document.createElement('div'); rail.className = 'f2-rail off';
  const zbtn = document.createElement('button'); zbtn.className = 'f2-zbtn off'; zbtn.textContent = '🏪'; zbtn.setAttribute('aria-label', 'Dükkan zinciri');
  const sheet = document.createElement('div'); sheet.className = 'f2-sheet off';
  d.root.append(rail, zbtn, sheet);
  let t = 0, railSig = '', sheetSig = '', seenBuyable = '';

  const close = () => { sheet.classList.add('off'); sheetSig = ''; };
  zbtn.addEventListener('click', e => { e.stopPropagation(); sheet.classList.remove('off'); sheetSig = ''; d.sfx?.('tik'); renderSheet(true); });
  sheet.addEventListener('pointerdown', e => e.stopPropagation());
  sheet.addEventListener('click', e => {
    e.stopPropagation();
    const el = e.target as HTMLElement;
    if (el === sheet || el.closest('.f2-x')) { close(); return; }
    const b = el.closest('button[data-op]') as HTMLButtonElement | null; if (!b) return;
    const id = b.dataset.id || '', op = b.dataset.op;
    if (op === 'ac') d.command({ kind: 'zincir', op: 'ac', id });
    else if (op === 'menu') d.command({ kind: 'zincir', op: 'menu', id, item: b.dataset.item, on: !b.classList.contains('on') });
    else if (op === 'ad') { const inp = sheet.querySelector(`input[data-id="${id}"]`) as HTMLInputElement | null; if (inp) d.command({ kind: 'zincir', op: 'ad', id, ad: inp.value }); }
    d.sfx?.('tik'); sheetSig = ''; renderSheet(true);
  });
  sheet.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { const inp = e.target as HTMLInputElement; if (inp.dataset?.id) { d.command({ kind: 'zincir', op: 'ad', id: inp.dataset.id, ad: inp.value }); sheetSig = ''; renderSheet(true); } } });
  sheet.addEventListener('keyup', e => e.stopPropagation());

  function shopHtml(s: DukkanView, money: number): string {
    const head = `<div class="t"><span class="ic">${s.icon}</span><span class="n"><b>${esc(s.ad)}</b><em>${esc(s.tur)}${s.ad !== s.varsayilan ? ' · ' + esc(s.varsayilan) : ''} · ${esc(s.slogan)}</em></span>`;
    if (s.durum === 'acik') {
      return `<div class="f2-shop acik">${head}</div>
        <div class="k">Günlük kazanç: <u>${fmt(s.gunluk)} ₺</u> · Toplam ciro: ${fmt(s.ciro)} ₺</div>
        <div class="f2-ad"><input data-id="${s.id}" maxlength="${DUKKAN_AD_MAX}" value="${esc(s.ad)}" aria-label="Dükkan adı"><button data-op="ad" data-id="${s.id}">Adı kaydet</button></div>
        <div class="k">Menü (en fazla ${s.maxMenu}):</div>
        <div class="f2-menu">${s.menu.map(m => `<button data-op="menu" data-id="${s.id}" data-item="${m.id}" class="${m.on ? 'on' : ''}">${esc(m.name)} · ${m.price} ₺</button>`).join('')}</div></div>`;
    }
    if (s.durum === 'alinabilir') return `<div class="f2-shop">${head}<button class="f2-buy" data-op="ac" data-id="${s.id}" ${money < s.cost ? 'disabled' : ''}>${fmt(s.cost)} ₺</button></div><div class="k">${esc(s.desc)} Günlük ~${fmt(s.gunluk)} ₺.</div></div>`;
    return `<div class="f2-shop kilitli">${head}</div><div class="k">🔒 ${esc(s.neden)} açılır · ${fmt(s.cost)} ₺</div></div>`;
  }
  function renderSheet(force = false): void {
    if (sheet.classList.contains('off')) return;
    const r = d.rules(), z = zincirApi(r); if (!r || !z) return;
    const money = (r.state as { money?: number })?.money ?? 0;
    const v = z.view();
    const sig = JSON.stringify([v.map(s => [s.durum, s.ad, s.gunluk, s.ciro, s.menu.map(m => m.on)]), money >= Math.min(...v.filter(s => s.durum === 'alinabilir').map(s => s.cost), Infinity)]);
    if (!force && sig === sheetSig) return;
    if (sheet.contains(document.activeElement) && (document.activeElement as HTMLElement).tagName === 'INPUT' && !force) return;
    sheetSig = sig;
    const pins = v.map(s => `<span class="f2-pin ${s.durum}" style="left:${s.map[0]}%;top:${s.map[1]}%" title="${esc(s.ad)}">${s.icon}</span>`).join('') + '<span class="f2-pin acik" style="left:50%;top:52%">🌭</span>';
    sheet.innerHTML = `<div class="f2-card"><button class="f2-x" aria-label="Kapat">✕</button><h3>Dükkan zinciri</h3>
      <div class="sub">Her dükkanın adını ve menüsünü sen seçersin. Kazanç her gün sonunda kasaya girer, oyun kapalıyken işlemez.</div>
      <div class="f2-map">${pins}</div>${v.map(s => shopHtml(s, money)).join('')}</div>`;
  }
  let railOpen = true;
  try { railOpen = localStorage.getItem('sb.railOpen') !== '0'; } catch { /* storage blocked */ }
  rail.addEventListener('click', e => { if (!(e.target as HTMLElement).closest('[data-rail]')) return; railOpen = !railOpen; try { localStorage.setItem('sb.railOpen', railOpen ? '1' : '0'); } catch { /* */ } railSig = ''; renderRail(); });
  function renderRail(): void {
    const r = d.rules(), api = restoranApi(r);
    const hud = d.root.querySelector('.sb-hud');
    const on = !!(r && api && r.rt.started && (!hud || !hud.classList.contains('off')));
    const v = on && api ? api.view() : null;
    const show = !!v && v.active;
    rail.classList.toggle('off', !show);
    if (!v || !show) return;
    const sig = JSON.stringify([railOpen, v.servis, v.specialName, v.tickets.map(k => [k.no, k.table, Math.round(k.frac * 20), k.items.map(i => i.left)])]);
    if (sig === railSig) return; railSig = sig;
    const head = `<div class="f2-ph" data-rail="1"><span>🧾 Sipariş paneli (${v.tickets.length})</span><span>${railOpen ? '▾' : '▸'}</span></div>`;
    if (!railOpen) { rail.innerHTML = head; return; }
    const top = `<div class="f2-top">Günün yemeği: <b>${esc(v.specialName)}</b><br>Servis: <b>${stars(v.servis)}</b></div><div class="f2-note">${v.tickets.length ? 'Garsonlar siparişleri halleder. Yetişmezlerse sen servis et.' : 'Bekleyen sipariş yok.'}</div>`;
    rail.innerHTML = head + top + v.tickets.slice(0, 3).map(k => `<div class="f2-slip${k.special ? ' sp' : ''}${k.frac > 0.7 ? ' late' : ''}"><div class="h"><span>Sipariş ${k.no}</span><i>Masa ${k.table + 1}</i></div>
      ${k.items.map(i => (i.left ? '' : '<s>') + `${i.n}× ${esc(i.name)}` + (i.left ? '' : '</s>')).join('<br>')}
      <div class="bar"><u style="width:${Math.round((1 - k.frac) * 100)}%"></u></div></div>`).join('') + (v.tickets.length > 3 ? `<div class="f2-note">+${v.tickets.length - 3} sipariş daha</div>` : '');
  }
  return {
    update(dt) {
      if ((t -= dt) > 0) return; t = 0.25;
      renderRail();
      const r = d.rules(), z = zincirApi(r);
      const stage = (r?.state as { stage?: number })?.stage ?? 1;
      const v = z && r && r.rt.started ? z.view() : null;
      const showBtn = !!v && (stage >= 3 || v.some(s => s.durum !== 'kilitli'));
      zbtn.classList.toggle('off', !showBtn);
      if (v) {
        const buy = v.filter(s => s.durum === 'alinabilir').map(s => s.id).join(',');
        zbtn.classList.toggle('new', !!buy && buy !== seenBuyable && sheet.classList.contains('off'));
        if (!sheet.classList.contains('off')) seenBuyable = buy;
      }
      renderSheet();
    },
    dispose() { rail.remove(); zbtn.remove(); sheet.remove(); },
  };
}
