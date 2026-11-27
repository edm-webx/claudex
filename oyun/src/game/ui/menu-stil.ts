// Ana menü görünümü "Altın Saat" (2026-11-25 user: giriş ekranı AAA olsun, konsept A seçildi).
// Başlık (v2ui U.title), Martı Kimlik (giris.ts) ve yapımcılar aynı katmanları paylaşır: sinematik renk katmanı, siyah
// şeritler, martılar, ışık zerreleri ve altın logo. Arkada oyunun kendi 3B sahnesi akar (boot: menu-kamera.ts).
// Yazı tipleri gömülü (menu-font.ts), internet olmadan da aynı görünür.
import { MENU_FONT_CSS } from './menu-font';

export const STUDYO = 'EDMX Studios';
export const SURUM = 'v2.0';

const CSS = `
.mn-sahne{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.mn-grade{position:absolute;inset:0;background:
 linear-gradient(90deg,rgba(20,8,4,.88) 0%,rgba(30,12,6,.58) 30%,rgba(0,0,0,0) 60%),
 linear-gradient(0deg,rgba(14,6,3,.8),rgba(0,0,0,0) 32%),
 radial-gradient(120% 80% at 78% 6%,rgba(255,170,80,.26),rgba(0,0,0,0) 60%)}
.mn-bar{position:absolute;left:0;right:0;height:0;background:#0b0503;transition:height 1.1s cubic-bezier(.2,.8,.2,1)}
.mn-bar.t{top:0}.mn-bar.b{bottom:0}
.mn-acik .mn-bar{height:clamp(14px,5.2vh,40px)}
.mn-gull{position:absolute;left:-60px;width:var(--w,34px);height:12px;animation:mn-gull var(--d,38s) linear var(--g,0s) infinite;opacity:.6}
.mn-gull svg{display:block;width:100%;height:100%;animation:mn-flap var(--f,.9s) ease-in-out infinite alternate;transform-origin:50% 70%}
@keyframes mn-gull{from{transform:translate3d(0,0,0)}50%{transform:translate3d(55vw,var(--y2,-30px),0)}to{transform:translate3d(115vw,var(--y3,10px),0)}}
@keyframes mn-flap{from{transform:scaleY(1)}to{transform:scaleY(.45)}}
.mn-mote{position:absolute;bottom:-10px;border-radius:50%;background:#ffcc7a;box-shadow:0 0 10px #ffb85a;animation:mn-mote var(--d,14s) linear var(--g,0s) infinite;opacity:0}
@keyframes mn-mote{0%{transform:translate3d(0,0,0);opacity:0}12%{opacity:var(--o,.7)}85%{opacity:var(--o,.7)}100%{transform:translate3d(var(--x,30px),-80vh,0);opacity:0}}
.mn-logo{position:absolute;left:clamp(24px,6.5vw,92px);top:clamp(40px,13vh,110px);pointer-events:none;font-family:'SB Govde',system-ui,sans-serif}
.mn-logo .k{font:700 clamp(11px,1.25vw,15px)/1 'SB Govde',system-ui,sans-serif;letter-spacing:.52em;color:#f6dcb0;opacity:.92;margin-left:.4em}
.mn-logo .b{display:block;font:800 clamp(64px,10vw,132px)/.86 'SB Baslik','SB Govde',system-ui,sans-serif;letter-spacing:-.02em;margin-top:.06em;padding:0 .04em .06em 0;
 background:linear-gradient(180deg,#fff4d6 0%,#ffd27a 45%,#e8952f 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
 filter:drop-shadow(0 3px 0 #6b2f12) drop-shadow(0 12px 28px rgba(255,140,40,.45))}
.mn-logo .s{display:flex;align-items:center;gap:12px;margin-top:12px;font:500 clamp(13px,1.3vw,16px)/1 'SB Govde',system-ui,sans-serif;color:#f3d9b6;letter-spacing:.06em}
.mn-logo .s i{width:44px;height:1px;background:linear-gradient(90deg,#ffcf7a,transparent)}.mn-logo .s i.sag{display:none}
.mn-logo .b,.mn-logo .k,.mn-logo .s{position:relative}
.mn-logo .b:after{content:attr(data-t);position:absolute;inset:0;padding:inherit;filter:none;background:linear-gradient(100deg,transparent 40%,rgba(255,255,255,.75) 50%,transparent 60%) -150% 0/250% 100% no-repeat;-webkit-background-clip:text;background-clip:text;color:transparent;animation:mn-shine 7s ease-in-out 2.2s infinite}
@keyframes mn-shine{0%,70%{background-position:-150% 0}100%{background-position:150% 0}}
.mn-anim .mn-logo .k{animation:mn-up .9s cubic-bezier(.2,.8,.2,1) .2s both}
.mn-anim .mn-logo .b{animation:mn-pop 1.1s cubic-bezier(.2,.9,.25,1.15) .35s both}
.mn-anim .mn-logo .s{animation:mn-up .9s cubic-bezier(.2,.8,.2,1) .75s both}
@keyframes mn-up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes mn-pop{from{opacity:0;transform:translateY(26px) scale(.94);filter:blur(8px)}to{opacity:1;transform:none;filter:drop-shadow(0 3px 0 #6b2f12) drop-shadow(0 12px 28px rgba(255,140,40,.45))}}
.mn-key{display:inline-grid;place-items:center;min-width:24px;height:22px;padding:0 6px;border:1px solid rgba(255,225,170,.45);border-radius:6px;color:#ffe9c4;font-weight:700;margin-right:6px}
.mn-dokun{display:none}
@media (hover:none),(max-width:760px){.mn-kb{display:none!important}.mn-dokun{display:inline}}
@media (max-width:760px),(max-aspect-ratio:1/1),(max-height:480px){
 .mn-grade{background:linear-gradient(180deg,rgba(20,8,4,.82) 0%,rgba(20,8,4,.25) 32%,rgba(0,0,0,0) 48%,rgba(14,6,3,.86) 78%)}
 .mn-logo{left:0;right:0;top:clamp(34px,7vh,64px);text-align:center}
 .mn-logo .k{margin-left:.52em}.mn-logo .b{font-size:clamp(58px,19vw,92px)}
 .mn-logo .s{justify-content:center}.mn-logo .s i.sag{display:block;background:linear-gradient(270deg,#ffcf7a,transparent)}
}
.mn-panel{position:absolute;right:clamp(16px,6.5vw,92px);top:50%;transform:translateY(-50%);width:min(410px,calc(100vw - 32px));max-height:calc(100% - 2*clamp(14px,5.2vh,40px) - 24px);overflow:auto;box-sizing:border-box;
 padding:28px 28px 24px;border-radius:22px;color:#fff1dc;font-family:'SB Govde',system-ui,sans-serif;text-align:left;
 background:linear-gradient(160deg,rgba(40,18,10,.74),rgba(18,8,5,.86));-webkit-backdrop-filter:blur(18px) saturate(1.2);backdrop-filter:blur(18px) saturate(1.2);
 border:1px solid rgba(255,206,140,.28);box-shadow:0 30px 80px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,230,190,.18);scrollbar-width:thin;scrollbar-color:rgba(255,206,140,.35) transparent;
 animation:mn-panel .55s cubic-bezier(.2,.85,.25,1) both}
@keyframes mn-panel{from{opacity:0;transform:translate(40px,-50%)}to{opacity:1;transform:translateY(-50%)}}
.mn-panel.mn-sabit,.gr-tekrar .mn-panel{animation:none}
.mn-panel h2,.mn-h{font:800 32px/1.05 'SB Baslik','SB Govde',system-ui,sans-serif;color:#fff3dc;margin:0 0 6px;text-align:left}
.mn-sub{font:500 14px/1.45 'SB Govde',system-ui,sans-serif;color:rgba(255,232,205,.68);margin:0 0 18px;text-align:left}
.mn-pid{display:flex;align-items:center;gap:12px;margin:0 0 18px}
.mn-seal{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#ffe7a8,#e89a35);box-shadow:0 0 0 3px rgba(255,210,130,.25),0 0 22px rgba(255,170,70,.5)}
.mn-seal svg{width:26px;height:10px}
.mn-pid b{display:block;font:800 14px/1.1 'SB Govde',system-ui,sans-serif;letter-spacing:.32em;color:#ffe2ac}.mn-pid small{display:block;font:500 12.5px/1.3 'SB Govde',system-ui,sans-serif;color:rgba(255,230,200,.62);letter-spacing:.03em;margin-top:2px}
.mn-btn{display:grid;place-items:center;width:100%;min-height:54px;margin-top:20px;border:0;border-radius:14px;cursor:pointer;font:800 17px/1.1 'SB Govde',system-ui,sans-serif;letter-spacing:.06em;color:#3a1806;position:relative;overflow:hidden;
 background:linear-gradient(180deg,#ffe3a0,#f6a640 60%,#e3862a);box-shadow:0 10px 30px rgba(255,150,50,.38),inset 0 1px 0 rgba(255,255,255,.6);transition:transform .15s,box-shadow .2s,filter .2s}
.mn-btn:after{content:"";position:absolute;top:0;bottom:0;left:-30%;width:60px;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-20deg);transition:left .6s}
.mn-btn:hover{filter:brightness(1.06);box-shadow:0 12px 36px rgba(255,150,50,.5),inset 0 1px 0 rgba(255,255,255,.6)}.mn-btn:hover:after{left:120%}
.mn-btn:active{transform:translateY(2px) scale(.99)}
.mn-btn:disabled{opacity:.6;cursor:wait}
.mn-btn.mn-ikinci{background:rgba(255,245,230,.08);color:#ffe1a8;box-shadow:inset 0 0 0 1px rgba(255,214,160,.3)}
.mn-geri{position:absolute;top:16px;right:16px;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,214,160,.28);background:rgba(0,0,0,.25);color:#ffe1a8;font:700 18px/1 'SB Govde',system-ui,sans-serif;cursor:pointer;display:grid;place-items:center}
.mn-geri:hover{background:rgba(255,214,160,.14)}
@media (max-width:760px),(max-aspect-ratio:1/1),(max-height:480px){
 .mn-panel{left:12px;right:12px;width:auto;top:auto;bottom:calc(clamp(14px,5.2vh,40px) + 10px);transform:none;max-height:calc(100% - 232px);padding:22px 20px 18px;border-radius:20px;animation-name:mn-panel-m}
 @keyframes mn-panel-m{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
 .mn-panel h2,.mn-h{font-size:27px}
}
/* telefon yatay (kısa ve geniş): panel sağda tam boy, içi kaydırılır; alt düğme kaydırmayla her zaman erişilir */
@media (max-height:480px) and (min-aspect-ratio:1/1){
 .mn-panel{left:auto;right:max(12px,env(safe-area-inset-right));top:10px;bottom:10px;width:min(440px,calc(100vw - 24px));max-height:none;padding:16px 18px 14px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
 .mn-panel h2,.mn-h{font-size:24px}.mn-sub{margin-bottom:8px;font-size:13px}.mn-pid{margin-bottom:8px}.mn-btn{min-height:44px;margin-top:10px}.mn-geri{top:10px;right:10px}
 .mn-menu{bottom:calc(clamp(14px,5.2vh,40px) + 48px)}.mn-mi{min-height:40px;padding:2px 0}.mn-mi.ana{font-size:32px}.mn-basla{bottom:calc(clamp(14px,5.2vh,40px) + 58px)}
 .mn-logo{top:clamp(14px,4vh,28px)}.mn-logo .b{font-size:clamp(44px,15vh,62px)}
}
.mn-title{background:transparent!important;animation:mn-in .9s ease both}
@keyframes mn-in{from{opacity:0}to{opacity:1}}
.mn-title.out{animation:mn-out .45s ease-in forwards}.mn-title.out .mn-logo,.mn-title.out .mn-sahne{opacity:1}
@keyframes mn-out{to{opacity:0}}
.mn-title.mn-tut.out{animation:none}.mn-title.mn-tut.out .mn-menu,.mn-title.mn-tut.out .mn-foot,.mn-title.mn-tut.out .mn-basla{transition:opacity .3s,transform .3s;opacity:0;transform:translateX(-24px)}
.mn-basla{position:absolute;left:0;right:0;bottom:calc(clamp(14px,5.2vh,40px) + 9vh);text-align:center;font:700 clamp(13px,1.4vw,16px)/1 'SB Govde',system-ui,sans-serif;letter-spacing:.36em;color:#ffe6bd;text-transform:uppercase;text-shadow:0 2px 12px rgba(0,0,0,.6);animation:mn-nabiz 2.2s ease-in-out infinite;pointer-events:none}
.mn-basla:before,.mn-basla:after{content:"";display:inline-block;vertical-align:middle;width:40px;height:1px;margin:0 16px;background:linear-gradient(90deg,transparent,#ffcf7a)}.mn-basla:after{background:linear-gradient(270deg,transparent,#ffcf7a)}
@keyframes mn-nabiz{0%,100%{opacity:.45}50%{opacity:1}}
.mn-menu{position:absolute;left:clamp(24px,6.5vw,92px);top:clamp(300px,52vh,400px);display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.mn-mi{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:16px;min-height:52px;padding:6px 12px 6px 0;cursor:pointer;font:700 clamp(22px,2.4vw,30px)/1 'SB Govde',system-ui,sans-serif;color:rgba(255,236,210,.6);letter-spacing:.02em;text-shadow:0 2px 10px rgba(0,0,0,.45);transition:color .2s,text-shadow .2s,transform .25s cubic-bezier(.2,.8,.2,1)}
.mn-mi:before{content:"";flex:none;width:14px;height:2px;border-radius:3px;background:rgba(255,236,210,.28);transition:width .3s cubic-bezier(.2,.8,.2,1),background .2s,box-shadow .2s}
.mn-mi small{font:500 12px/1 'SB Govde',system-ui,sans-serif;letter-spacing:.16em;color:rgba(255,236,210,.45);text-transform:uppercase}
.mn-mi.on{color:#fff6e4;text-shadow:0 0 24px rgba(255,190,90,.55),0 2px 10px rgba(0,0,0,.4);transform:translateX(6px)}
.mn-mi.on:before{width:36px;height:3px;background:linear-gradient(90deg,#ffd27a,#ff8a3d);box-shadow:0 0 14px #ffb04a}
.mn-mi:focus-visible{outline:2px solid rgba(255,206,140,.6);outline-offset:4px;border-radius:8px}
.mn-mi.ana{font-size:clamp(28px,3.2vw,40px);font-family:'SB Baslik','SB Govde',system-ui,sans-serif;font-weight:800}
.mn-bekle .mn-menu,.mn-bekle .mn-foot{visibility:hidden}
.mn-title:not(.mn-bekle) .mn-menu .mn-mi{animation:mn-sol .7s cubic-bezier(.2,.8,.2,1) both}
.mn-menu .mn-mi:nth-child(2){animation-delay:.08s}.mn-menu .mn-mi:nth-child(3){animation-delay:.16s}.mn-menu .mn-mi:nth-child(4){animation-delay:.24s}
@keyframes mn-sol{from{opacity:0;transform:translateX(-30px)}to{opacity:1}}
.mn-foot{position:absolute;left:clamp(24px,6.5vw,92px);right:clamp(24px,6.5vw,92px);bottom:calc(clamp(14px,5.2vh,40px) + 18px);display:flex;justify-content:space-between;align-items:center;gap:16px;font:500 13px/1 'SB Govde',system-ui,sans-serif;color:rgba(255,230,200,.62);letter-spacing:.06em}
.mn-title:not(.mn-bekle) .mn-foot{animation:mn-up .8s .3s both}
.mn-ses{all:unset;display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 0;color:rgba(255,230,200,.75)}.mn-ses b{color:#ffe1a8;font-weight:700}
.mn-eq{display:flex;gap:2px;align-items:flex-end;height:14px}.mn-eq i{width:3px;height:4px;border-radius:2px;background:#ffc66d;animation:mn-eq .9s ease-in-out infinite alternate}
.mn-eq i:nth-child(2){animation-delay:-.3s}.mn-eq i:nth-child(3){animation-delay:-.6s}.mn-eq i:nth-child(4){animation-delay:-.15s}.mn-ses.kapali .mn-eq i{animation:none;height:3px;opacity:.5}
@keyframes mn-eq{to{height:14px}}
.mn-foot .sag{display:flex;gap:18px;align-items:center}
.mn-panelde .mn-foot .sag{visibility:hidden}
@media (max-width:760px),(max-aspect-ratio:1/1),(max-height:480px){.mn-panelde .mn-foot,.mn-panelde .mn-menu{visibility:hidden}}
.mn-ayar-satir{margin:16px 0 0}.mn-ayar-satir label{display:flex;justify-content:space-between;font:700 11.5px/1 'SB Govde',system-ui,sans-serif;letter-spacing:.2em;color:rgba(255,220,170,.75);text-transform:uppercase;margin-bottom:10px}
.mn-ayar-satir label output{letter-spacing:.04em;color:#ffe1a8}
.mn-ayar-satir input[type=range]{width:100%;height:28px;margin:0;accent-color:#f6a640;cursor:pointer}
.mn-seg{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:4px;border-radius:12px;background:rgba(0,0,0,.35)}
.mn-seg button{all:unset;text-align:center;padding:10px 2px;border-radius:9px;font:700 13px/1 'SB Govde',system-ui,sans-serif;color:rgba(255,230,200,.62);cursor:pointer}
.mn-seg button.on{background:linear-gradient(180deg,#ffd98c,#f0a443);color:#3a1a08;box-shadow:0 4px 14px rgba(255,160,60,.3)}
.mn-not{font:500 12.5px/1.45 'SB Govde',system-ui,sans-serif;color:rgba(255,226,190,.55);margin-top:14px}
.mn-krediler{margin-top:4px}.mn-krediler div{display:flex;flex-direction:column;gap:3px;padding:11px 0;border-bottom:1px solid rgba(255,214,160,.12)}
.mn-krediler small{font:700 10.5px/1 'SB Govde',system-ui,sans-serif;letter-spacing:.24em;color:rgba(255,220,170,.6);text-transform:uppercase}
.mn-krediler b{font:600 15px/1.35 'SB Govde',system-ui,sans-serif;color:#fff1dc}
.mn-studyo{font:800 26px/1 'SB Baslik','SB Govde',system-ui,sans-serif;letter-spacing:.04em;background:linear-gradient(180deg,#fff4d6,#f0a443);-webkit-background-clip:text;background-clip:text;color:transparent;margin:2px 0 8px}
.mn-perde{position:fixed;inset:0;z-index:999;background:#0b0503;pointer-events:none;opacity:0;transition:opacity .35s ease}
.mn-perde.on{opacity:1}
.mn-menude>*:not(.mn-title):not(.gr-bg):not(style):not(.sb-toasts){visibility:hidden!important}
@media (max-width:760px),(max-aspect-ratio:1/1),(max-height:480px){
 .mn-menu{left:0;right:0;top:auto;bottom:calc(clamp(14px,5.2vh,40px) + 64px);align-items:center;gap:0}
 .mn-mi{justify-content:center;padding:6px 0;min-height:48px}.mn-mi:before{display:none}.mn-mi.on{transform:none}.mn-mi small{display:none}
 .mn-mi.ana{font-size:38px;color:#fff6e4;text-shadow:0 0 24px rgba(255,190,90,.6)}
 .mn-foot{left:16px;right:16px;bottom:calc(clamp(14px,5.2vh,40px) + 12px)}
 .mn-basla{bottom:calc(clamp(14px,5.2vh,40px) + 90px);letter-spacing:.24em}
}
@media (max-height:760px){.mn-panel{padding:22px 24px 18px}.mn-panel h2,.mn-h{font-size:28px}.mn-sub{margin-bottom:12px}.mn-btn{min-height:48px;margin-top:14px}.mn-krediler div{padding:8px 0}}
@media (prefers-reduced-motion:reduce){.mn-gull,.mn-mote,.mn-logo .b:after{animation:none!important;display:none}}
`;

let kurulu = false;
/** Yazı tiplerini ve ortak menü stilini bir kez sayfaya ekler. */
export function menuStilKur(): void {
  if (kurulu) return; kurulu = true;
  try { const st = document.createElement('style'); st.textContent = MENU_FONT_CSS + CSS; document.head.appendChild(st); } catch { /* */ }
}

export const MARTI_SVG = '<svg viewBox="0 0 40 14" aria-hidden="true"><path d="M2 10 Q10 1 20 9 Q30 1 38 10" stroke="#5a2a0c" stroke-width="3.4" fill="none" stroke-linecap="round"/></svg>';
const GULL = '<svg viewBox="0 0 40 14" aria-hidden="true"><path d="M2 10 Q10 1 20 9 Q30 1 38 10" stroke="#2a120a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
let sahneHtml = '';
/** Renk katmanı + şeritler + martılar + ışık zerreleri (hep aynı rastgelelik: menüler arası geçişte sahne zıplamaz). */
export function sahneKatmani(): string {
  if (sahneHtml) return sahneHtml;
  let s = 0x5eed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let h = '<div class="mn-sahne" aria-hidden="true"><div class="mn-grade"></div>';
  for (let i = 0; i < 7; i++) h += `<div class="mn-gull" style="top:${(6 + r() * 26).toFixed(1)}%;--w:${(20 + r() * 26) | 0}px;--d:${(30 + r() * 26).toFixed(1)}s;--g:${(-r() * 40).toFixed(1)}s;--f:${(.6 + r() * .6).toFixed(2)}s;--y2:${(-40 + r() * 50) | 0}px;--y3:${(-30 + r() * 60) | 0}px">${GULL}</div>`;
  for (let i = 0; i < 22; i++) { const z = 2 + r() * 4; h += `<i class="mn-mote" style="left:${(25 + r() * 75).toFixed(1)}%;width:${z.toFixed(1)}px;height:${z.toFixed(1)}px;--d:${(10 + r() * 12).toFixed(1)}s;--g:${(-r() * 20).toFixed(1)}s;--x:${(-40 + r() * 80) | 0}px;--o:${(.3 + r() * .5).toFixed(2)}"></i>`; }
  return (sahneHtml = h + '<div class="mn-bar t"></div><div class="mn-bar b"></div></div>');
}

export function logoHtml(): string {
  return `<div class="mn-logo" role="img" aria-label="Sabri'nin Büfesi"><div class="k">SABRİ'NİN</div><div class="b" data-t="Büfesi">Büfesi</div><div class="s"><i></i>Martıköy İskelesi · Boğaz<i class="sag"></i></div></div>`;
}
