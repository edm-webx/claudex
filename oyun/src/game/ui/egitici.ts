/**
 * Eğitici kartları görünümü (sahip seçimi 2026-11-26: "Tente" kartı). Bir şey ilk kez olunca oyun durur, kamera hedefe kayar,
 * etraf kararır, hedefte kesik sarı halka ve etiket çıkar, sağda (hedef sağdaysa solda) tenteli kâğıt kart açıklar.
 * - Karar saf: game/egitici-karar.ts. Metinler: content/egitici.ts. Kayıt GameState.tut (bulut kaydıyla taşınır).
 * - Sim duraklıyken sistemler çalışmadığından tarama burada, her kare update() ile yapılır.
 * - Başka bir duraklama (gün sonu, kasa sayımı, atölye, mini oyun), panel, iş panosu ya da açılış sinematiği varken kart beklemede kalır.
 * - Odada başka oyuncu varken oyun DURDURULMAZ (dünya ortak); kart yine görünür.
 * - Ayarlar: acik / setAcik / sifirla / gorulenler / tekrar (panels.ts ayarlar sekmesi).
 */
import type { Vec2, Vec3, ScreenPt } from '../../engine/api';
import { GRUP_AD, HUD_HEDEF, EGT_ZAMAN as Z, EGT_KAPALI, egtKart, type EgtCtx, type EgtKart, type EgtAdim } from '../../content/egitici';
import { egtSec, egtEskiKayit, egtGoruldu, egtSifirla, egtGorulenler } from '../egitici-karar';
import { icHangi } from '../../content/ic-mekan';
import { regionAt } from '../../content/disari/martikoy';
import { havaSokak } from '../sim/hava';

export interface EgiticiDeps {
  root: HTMLElement;
  rules(): any;
  project(p: Vec3, out: ScreenPt): boolean;
  /** açılış sinematiği gibi kamerayı başka biri tutuyorsa true */
  mesgul?(): boolean;
  /** açık paneli (ayarlar gibi) kapatır: 'Tekrar izle' kartı panelin üstünde kalmasın */
  panelKapat?(): void;
  /** odadaki diğer oyuncu sayısı */
  digerOyuncu?(): number;
  sfx?(id: string): void;
  toast?(text: string): void;
}
export interface EgiticiView {
  update(dt: number): void;
  /** kart açıkken kameranın bakacağı yer (boot.ts follow zinciri) */
  kamera(): Vec2 | null;
  acik(): boolean;
  setAcik(on: boolean): void;
  sifirla(): void;
  gorulenler(): { id: string; baslik: string; grup: string }[];
  tekrar(id: string): void;
  /** test / QA */
  goster(id: string): boolean;
  aktif(): string | null;
  /** QA: oyuncu konumu ve kartın dünya hedefi */
  dbg(): { pos: Vec2; hedef: Vec2 | null };
  kapat(): void;
}

let tekil: EgiticiView | null = null;
/** panels.ts ayarlar sekmesi için (boot sırası panelleri önce kurar) */
export const egiticiApi = () => tekil;

const CSS = `
.eg-ov{position:fixed;inset:0;z-index:60;pointer-events:auto;font-family:var(--body,Nunito,system-ui,sans-serif);color:#3b2a20;opacity:0;transition:opacity .25s ease-out}
.eg-ov.on{opacity:1}
.eg-dim{position:absolute;inset:0;background:rgba(14,10,20,.62)}
.eg-hole{position:absolute;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 0 200vmax rgba(14,10,20,.62),inset 0 0 24px 8px rgba(14,10,20,.35);pointer-events:none}
.eg-hole.kare{border-radius:18px}
.eg-ring{position:absolute;border-radius:50%;border:3px dashed #ffd23f;transform:translate(-50%,-50%);box-shadow:0 0 0 2px rgba(59,42,32,.35);animation:egPulse 1.6s ease-in-out infinite;pointer-events:none}
.eg-ring.kare{border-radius:18px}
@keyframes egPulse{50%{transform:translate(-50%,-50%) scale(1.07);opacity:.75}}
.eg-lbl{position:absolute;transform:translate(-50%,-100%);background:#ffd23f;color:#3b2a20;border:2px solid #3b2a20;box-shadow:0 3px 0 rgba(59,42,32,.4);border-radius:99px;padding:5px 12px;font:800 15px/1 var(--body,Nunito,sans-serif);white-space:nowrap;pointer-events:none}
.eg-pz{position:absolute;top:calc(14px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);background:#fff6e6;color:#3b2a20;border:2px solid #3b2a20;border-radius:99px;padding:6px 14px;font:800 13px/1 var(--body,Nunito,sans-serif);letter-spacing:.08em;pointer-events:none}
.eg-card{position:absolute;top:50%;width:min(390px,calc(100vw - 32px));max-height:calc(100vh - 28px);max-height:calc(100dvh - 28px);overflow-y:auto;background:#fffaf1;border:3px solid #3b2a20;border-radius:20px;box-shadow:0 8px 0 rgba(59,42,32,.45);overflow:hidden;transform:translateY(-50%) rotate(1deg);transition:transform .25s ease-out}
.eg-card.sag{right:max(40px,env(safe-area-inset-right,0px))}.eg-card.sol{left:max(40px,env(safe-area-inset-left,0px));transform:translateY(-50%) rotate(-1deg)}
.eg-card.sus{top:calc(8px + env(safe-area-inset-top,0px));transform:none}
.eg-card.alt{top:auto;bottom:calc(16px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%)}
.eg-awn{height:38px;background:repeating-linear-gradient(90deg,#e0533c 0 38px,#fff6e6 38px 76px);-webkit-mask:linear-gradient(#000,#000) 0 0/100% 19px no-repeat,radial-gradient(circle at 19px 19px,#000 18.5px,transparent 19px) 0 0/38px 38px repeat-x;mask:linear-gradient(#000,#000) 0 0/100% 19px no-repeat,radial-gradient(circle at 19px 19px,#000 18.5px,transparent 19px) 0 0/38px 38px repeat-x}
.eg-in{padding:14px 22px 20px;display:grid;gap:11px}
.eg-k{font:800 12px/1 var(--body,Nunito,sans-serif);letter-spacing:.1em;color:#b8392a;text-transform:uppercase}
.eg-h{font:800 28px/1.05 var(--disp,"Baloo 2",Nunito,sans-serif);margin:0;text-wrap:balance}
.eg-p{margin:0;font:600 16px/1.45 var(--body,Nunito,sans-serif);color:#6b4a33}
.eg-how{display:flex;flex-wrap:wrap;gap:7px;align-items:center;background:#f6ead2;border-radius:12px;padding:9px 12px;font:700 14px/1.3 var(--body,Nunito,sans-serif)}
.eg-key{display:inline-grid;place-items:center;min-width:26px;height:26px;padding:0 6px;border:2px solid currentColor;border-bottom-width:4px;border-radius:6px;font:800 12px/1 var(--body,Nunito,sans-serif)}
.eg-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:2px}
.eg-skip{background:none;border:0;padding:10px 2px;min-height:40px;font:700 13px/1 var(--body,Nunito,sans-serif);color:#6b4a33;text-decoration:underline;cursor:pointer;opacity:.75}
.eg-skip:hover{opacity:1}
.eg-dots{display:flex;gap:6px}.eg-dots i{width:9px;height:9px;border-radius:50%;background:#3b2a20;opacity:.22}.eg-dots i.on{opacity:1}
.eg-btn{background:#49b96a;color:#fff;border:3px solid #3b2a20;border-radius:14px;box-shadow:0 5px 0 #2f8f4c;font:800 19px/1 var(--disp,"Baloo 2",Nunito,sans-serif);padding:11px 24px;min-height:44px;cursor:pointer}
.eg-btn:active{transform:translateY(3px);box-shadow:0 2px 0 #2f8f4c}
.eg-btn:focus-visible,.eg-skip:focus-visible{outline:3px solid #ffd23f;outline-offset:2px}
.eg-btn[disabled]{opacity:.55;cursor:default}
.eg-lbl{max-width:calc(100vw - 16px);overflow:hidden;text-overflow:ellipsis}
/* telefon yatay (kısa ekran): kart yanda, küçük yazı, hedef kartın boş yarısında kalır; 'OYUN DURDU' hapı kartın üstüne binmez */
.eg-ov.kisa .eg-card{width:min(300px,40vw);max-height:calc(100vh - 20px);max-height:calc(100dvh - 20px)}
.eg-ov.kisa .eg-card.sag{right:max(12px,env(safe-area-inset-right,0px))}.eg-ov.kisa .eg-card.sol{left:max(12px,env(safe-area-inset-left,0px))}
.eg-ov.kisa .eg-awn{height:22px;-webkit-mask-size:100% 11px,22px 22px;mask-size:100% 11px,22px 22px;background:repeating-linear-gradient(90deg,#e0533c 0 22px,#fff6e6 22px 44px)}
.eg-ov.kisa .eg-in{padding:8px 14px 12px;gap:7px}
.eg-ov.kisa .eg-h{font-size:21px}.eg-ov.kisa .eg-p{font-size:14px;line-height:1.35}.eg-ov.kisa .eg-how{padding:6px 9px;font-size:12.5px}
.eg-ov.kisa .eg-pz{top:calc(6px + env(safe-area-inset-top,0px));font-size:11px;padding:4px 10px}
.eg-ov.kisa .eg-btn{font-size:17px;padding:9px 18px;min-height:44px}.eg-ov.kisa .eg-skip{min-height:36px;padding:10px 4px}
.eg-ov.coklu{pointer-events:none}.eg-ov.coklu .eg-card,.eg-ov.coklu .eg-lbl{pointer-events:auto}
@media (prefers-reduced-motion:reduce){.eg-ring{animation:none}.eg-ov{transition:none}}
`;

const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
/** "[W] [A] ya da sürükle" -> tuş kutuları + yazı */
const nasilHtml = (s: string) => s.split(/(\[[^\]]+\])/).filter(Boolean).map(p => (p.startsWith('[') ? `<span class="eg-key">${esc(p.slice(1, -1))}</span>` : `<span>${esc(p.trim())}</span>`)).join('');

export function createEgitici(d: EgiticiDeps): EgiticiView {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  let ov: HTMLDivElement | null = null;
  let kart: EgtKart | null = null, sayfa = 0, tekrarMi = false, durdurdu = false;
  let sp: EgtAdim[] = [];   // açık kartın sayfaları (HUD öğesi olmayan devam sayfaları atılmış)
  let hedefW: Vec2 | null = null, hudEl: Element | null = null;
  let tara = 0, takip = 0, giris = 0;
  /** okumadan geçmeye karşı: kart (ya da sayfa) açıldıktan sonra bu kadar ms Enter/Devam yok sayılır */
  const KILIT_MS = 500;
  const tmp: ScreenPt = { x: 0, y: 0 };
  const R = () => d.rules();
  const S = () => R().state;
  const tut = (): Record<string, number> => (S().tut ||= {});

  function ctx(): EgtCtx {
    const r = R(), s = r.state, pos = r.playerPos as Vec2 & { kat?: number };
    const saat = typeof r.hour === 'function' ? r.hour() : 12;
    let yagmur = false; try { const w = havaSokak(s, saat); yagmur = w.wet && !w.kar && w.kind !== 'firtina'; } catch { /* hava yok */ }
    return { v: r.v2State(), S: s, rt: r.rt, pos, saat, ic: icHangi(pos, -0.2), bolge: regionAt(pos.x)?.id ?? null, yagmur, cokOyunculu: (d.digerOyuncu?.() || 0) > 0, hud: ad => !!hudBul(ad) };
  }
  const sayfalar = (k: EgtKart): EgtAdim[] => [k, ...(k.devam || [])].filter((a, i) => i === 0 || !a.hud || !!hudBul(a.hud));

  /** adımın dünya hedefi (menzil içindeyse), yoksa null */
  function hedefCoz(a: EgtAdim, c: EgtCtx): Vec2 | null {
    if (!a.hedef) return null;
    let w: Vec2 | null | undefined = null; try { w = a.hedef(c); } catch { w = null; }
    if (!w || !isFinite(w.x) || !isFinite(w.z)) return null;
    return Math.hypot(w.x - c.pos.x, w.z - c.pos.z) <= (a.menzil ?? Z.UZAK_M) ? { x: w.x, z: w.z } : null;
  }
  /** kamera/halka gösterecek bir şey var mı? Yoksa kart seçilmez (görüldü de yazılmaz), olay ya da HUD öğesi gelince çıkar. */
  function uygun(k: EgtKart, c: EgtCtx): boolean {
    if (k.hud) return !!hudBul(k.hud);
    if (k.hedef && !k.hedefsizOk) return !!hedefCoz(k, c);
    return true;
  }

  function hudBul(ad: string | undefined): Element | null {
    for (const sel of (ad && HUD_HEDEF[ad]) || []) {
      let el: Element | null = null;
      if (sel.startsWith('bar:')) { const t = sel.slice(4).toLocaleLowerCase('tr'); el = [...document.querySelectorAll('.sb-bar button')].find(b => (b.textContent || '').toLocaleLowerCase('tr').includes(t)) || null; }
      else el = document.querySelector(sel);
      if (el && (el as HTMLElement).offsetParent !== null) return el;
    }
    return null;
  }

  function kur(): HTMLDivElement {
    const el = document.createElement('div'); el.className = 'eg-ov'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = '<div class="eg-dim"></div><div class="eg-hole"></div><div class="eg-ring"></div><div class="eg-lbl"></div><div class="eg-pz">❚❚&nbsp; OYUN DURDU</div><div class="eg-card"><div class="eg-awn"></div><div class="eg-in"></div></div>';
    el.addEventListener('click', e => {
      const t = e.target as HTMLElement;
      if (t.closest('.eg-btn')) ileri();
      else if (t.closest('.eg-skip')) { setAcik(false); kapat(); d.toast?.('Eğitici kartları kapandı. Ayarlardan yeniden açabilirsin.'); }
    });
    (d.root || document.body).appendChild(el);
    return el;
  }

  function ciz(c: EgtCtx): void {
    if (!kart) return;
    ov ||= kur();
    const a = sp[sayfa], n = sp.length;
    const metin = typeof a.metin === 'function' ? a.metin(c) : a.metin;
    const baslik = a.baslik;
    if (a.hud) { hudEl = hudBul(a.hud); hedefW = null; }
    else if (a.hedef) { hudEl = null; hedefW = hedefCoz(a, c); }
    /* hedefsiz devam sayfası: önceki sayfanın hedefi kalır */
    giris = performance.now();
    const inEl = ov.querySelector('.eg-in') as HTMLElement;
    inEl.innerHTML = `<div class="eg-k">${esc(GRUP_AD[kart.grup])}${n > 1 ? ' · ' + (sayfa + 1) + '/' + n : ''}</div>`
      + `<h4 class="eg-h">${esc(baslik)}</h4><p class="eg-p">${esc(metin)}</p>`
      + (a.nasil ? `<div class="eg-how">${nasilHtml(a.nasil)}</div>` : '')
      + `<div class="eg-row"><button class="eg-skip" type="button">Eğiticileri kapat</button>`
      + (n > 1 ? `<span class="eg-dots">${sp.map((_, i) => `<i class="${i <= sayfa ? 'on' : ''}"></i>`).join('')}</span>` : '')
      + `<button class="eg-btn" type="button">${sayfa < n - 1 ? 'Devam' : 'Anladım'}</button></div>`;
    const lbl = ov.querySelector('.eg-lbl') as HTMLElement; lbl.textContent = a.etiket || '';
    (ov.querySelector('.eg-pz') as HTMLElement).style.display = durdurdu ? '' : 'none';
    ov.classList.toggle('coklu', !durdurdu);
    yerlestir();
    requestAnimationFrame(() => { ov?.classList.add('on'); (ov?.querySelector('.eg-btn') as HTMLElement | null)?.focus({ preventScroll: true }); });
  }

  /** spot ışığı, halka, etiket ve kartın yanı (her kare) */
  function yerlestir(): void {
    if (!ov) return;
    const dim = ov.querySelector('.eg-dim') as HTMLElement, hole = ov.querySelector('.eg-hole') as HTMLElement, ring = ov.querySelector('.eg-ring') as HTMLElement, lbl = ov.querySelector('.eg-lbl') as HTMLElement, card = ov.querySelector('.eg-card') as HTMLElement;
    const kisa = innerHeight < 500 && innerWidth < 1100;   // telefon yatay
    ov.classList.toggle('kisa', kisa);
    let x = -1, y = -1, w = 0, h = 0, kare = false;
    if (hudEl) { const b = hudEl.getBoundingClientRect(); if (b.width > 0) { x = b.left + b.width / 2; y = b.top + b.height / 2; w = b.width + 20; h = b.height + 20; kare = true; } }
    else if (hedefW) { if (d.project({ x: hedefW.x, y: 0.6, z: hedefW.z }, tmp)) { x = tmp.x; y = tmp.y; w = h = 2 * Math.max(kisa ? 36 : 56, Math.min(innerWidth, innerHeight) * 0.11); } }
    const var_ = x >= 0;
    dim.style.display = var_ ? 'none' : '';
    for (const el of [hole, ring]) { el.style.display = var_ ? '' : 'none'; el.classList.toggle('kare', kare); el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px'; }
    // etiket: ekrandan taşmasın (üstte yer yoksa halkanın altına)
    const lw = lbl.offsetWidth || 0;
    lbl.style.display = var_ && lbl.textContent ? '' : 'none';
    lbl.style.left = Math.max(lw / 2 + 8, Math.min(innerWidth - lw / 2 - 8, x)) + 'px';
    const ust = y - h / 2 - 10;
    lbl.style.transform = ust < (lbl.offsetHeight || 28) + 6 ? 'translate(-50%,0)' : ''; lbl.style.top = (ust < (lbl.offsetHeight || 28) + 6 ? y + h / 2 + 10 : ust) + 'px';
    // kart: halkayı/HUD öğesini örtmeyen tarafa. Önce eldeki yan, örtüşürse karşısı, ikisi de örtüşürse (geniş ekranda) alta.
    const dar = !kisa && innerWidth < 760;
    const tercih = dar ? 'alt' : var_ && x > innerWidth * 0.55 ? 'sol' : 'sag';
    const orta = (x0: number, y0: number, hw: number, hh: number) => { const r = card.getBoundingClientRect(); return !(x0 + hw < r.left || x0 - hw > r.right || y0 + hh < r.top || y0 - hh > r.bottom); };
    // yerleşim: 'sag' / 'sol' (dikeyde ortalı), 'sag sus' / 'sol sus' (yanda, ekranın üstüne yaslı: halka altta ise onu açıkta bırakır), 'alt'
    const dene = (yer: string) => {
      const [yan, sus] = yer.split(' ');
      if (!(card.classList.contains(yan) && card.classList.contains('sus') === !!sus)) { card.classList.remove('sag', 'sol', 'alt', 'sus'); card.classList.add(yan); if (sus) card.classList.add('sus'); }
      return !var_ || !orta(x, y, w / 2, h / 2);
    };
    const siralama = tercih === 'alt' ? ['alt', 'sag', 'sol', 'sag sus', 'sol sus'] : tercih === 'sol' ? ['sol', 'sag', 'sol sus', 'sag sus', 'alt'] : ['sag', 'sol', 'sag sus', 'sol sus', 'alt'];
    const simdiki = siralama.find(k => { const [yan, sus] = k.split(' '); return card.classList.contains(yan) && card.classList.contains('sus') === !!sus; });
    for (const yer of simdiki ? [simdiki, ...siralama.filter(k => k !== simdiki)] : siralama) if (dene(yer)) return;
    dene(tercih);
  }

  function ac(k: EgtKart, tekrar: boolean): void {
    const r = R(), rt = r.rt;
    kart = k; sayfa = 0; tekrarMi = tekrar; sp = sayfalar(k); takip = 0;
    durdurdu = false;
    if (!(d.digerOyuncu?.() || 0) && !rt.paused) { rt.paused = true; rt.pauseWhy = 'egitici'; durdurdu = true; }
    d.sfx?.('ticket');
    ciz(ctx());
  }

  function ileri(): void {
    if (!kart || performance.now() - giris < KILIT_MS) return;
    if (sayfa < sp.length - 1) { sayfa++; d.sfx?.('tik'); ciz(ctx()); return; }
    kapat();
  }

  /** goruldu=false: kart sonra bir kez daha gösterilir (Esc ile ertelenen kart; ikinci Esc'te görüldü sayılır) */
  function kapat(goruldu = true): void {
    if (!kart) return;
    const r = R();
    if (!tekrarMi) {
      const t = tut(), erk = 'egb_ert_' + kart.id;
      if (goruldu || t[erk]) egtGoruldu(t, kart.id, r.state.playT);
      else { t[erk] = 1; t.egt__son = r.state.playT; }
    }
    if (durdurdu && r.rt.pauseWhy === 'egitici') { r.rt.paused = false; r.rt.pauseWhy = ''; }
    kart = null; hedefW = null; hudEl = null; durdurdu = false;
    d.sfx?.('tik');
    if (ov) { const el = ov; el.classList.remove('on'); ov = null; setTimeout(() => el.remove(), 260); }
  }

  const onKey = (e: KeyboardEvent) => {
    if (!kart || !ov) return;
    if (e.key === 'Tab') {   // odak kartın içinde kalsın
      if (e.type !== 'keydown') return;
      e.preventDefault(); e.stopImmediatePropagation();
      const bt = [...ov.querySelectorAll<HTMLElement>('.eg-skip, .eg-btn')], i = bt.indexOf(document.activeElement as HTMLElement);
      bt[(i + (e.shiftKey ? bt.length - 1 : 1)) % bt.length]?.focus();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
      const odak = document.activeElement as HTMLElement | null;
      if (e.key !== 'Escape' && odak?.classList.contains('eg-skip') && ov.contains(odak)) return;   // "Eğiticileri kapat" üstündeyken Enter/Boşluk onu tıklasın
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.type === 'keydown' && !e.repeat) { if (e.key === 'Escape') kapat(false); else ileri(); }
    }
  };
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);

  function bos(): boolean {
    const r = R(), rt = r.rt;
    if (!rt.started || rt.paused || rt.panel || rt.boardOpen || rt.uiLast?.gunSonu) return false;
    if (d.mesgul?.()) return false;
    if (document.querySelector('.ka-pb, .ka-go, .kl-go')) return false;   // karakter atölyesi açık
    if (document.querySelector('.tf-bg.on, .mp-bg.on, .kd-bg.on')) return false;   // telefon, Mülk paneli, koordinatör (rt.panel kullanmayan tam ekranlar)
    return true;
  }

  function setAcik(on: boolean): void { const t = tut(); if (on) delete t[EGT_KAPALI]; else t[EGT_KAPALI] = 1; }

  const api: EgiticiView = {
    update(dt: number) {
      if (kart) {
        // oyun durmadığında (çok oyunculu) hedef işçi/kedi/martı gibi hareket edebilir: halkayı ve kamerayı güncel tut
        if (!durdurdu && !tekrarMi && (takip -= dt) <= 0) { takip = 0.25; const a = sp[sayfa]; if (a && !a.hud && a.hedef) { const w = hedefCoz(a, ctx()); if (w) hedefW = w; } }
        yerlestir(); return;
      }
      if ((tara -= dt) > 0) return; tara = Z.TARA_S;
      if (!bos()) return;
      const t = tut(), playT = R().state.playT;
      if (t[EGT_KAPALI]) return;
      const c = ctx();
      egtEskiKayit(c, t, playT);
      const k = egtSec(c, t, playT, kk => uygun(kk, c));
      if (k) ac(k, false);
    },
    kamera: () => (kart && hedefW ? hedefW : null),
    acik: () => !tut()[EGT_KAPALI],
    setAcik,
    sifirla() { egtSifirla(tut()); setAcik(true); },
    gorulenler: () => egtGorulenler(tut()).map(k => ({ id: k.id, baslik: k.baslik, grup: GRUP_AD[k.grup] })),
    tekrar(id: string) {
      const k = egtKart(id); if (!k || kart) return;
      const rt = R().rt; d.panelKapat?.(); rt.panel = null; rt.boardOpen = false;   // ayarlar sayfası kartın altında açık kalmasın
      ac(k, true);
    },
    goster(id: string) { const k = egtKart(id); if (!k || kart) return false; ac(k, false); return true; },
    aktif: () => kart?.id ?? null,
    dbg: () => ({ pos: { x: R().playerPos.x, z: R().playerPos.z }, hedef: hedefW }),
    kapat,
  };
  tekil = api;
  return api;
}
