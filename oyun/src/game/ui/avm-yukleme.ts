/**
 * Martı AVM yükleme ekranı (2026-11-21 21:07 sahip: "AVM'nin kapısından girilince başka bir haritaya geçilsin, AVM yükleme
 * ekranı olsun"). Kapıdan girişte tam ekran kart: AVM logosu, kat rehberi, o günün sinema ve sahne programı, dolan çubuk.
 * Çubuk dolarken AVM diyarının ilk kareleri (shader / doku) arkada hazırlanır; en az ~1.4 sn görünür, sonra kararıp açılır.
 * Oyunun arayüz dili: krem kart, mürekkep kenar, tombul gölge (engine/ui/v2-style.ts değişkenleri, yoksa yedekleri).
 */
import { KAT_ADI } from '../../content/avm-kat';
import { SALONLAR, seans, BILET_FIYAT } from '../../content/avm-eglence';
import { diziOf, bolumOf } from '../../content/sinema-dizi';

const CSS = `
.avmy{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;pointer-events:auto;
  background:radial-gradient(120% 90% at 50% 0%,#3d3a78 0%,#221f45 55%,#14122b 100%);font-family:var(--body,"Nunito",system-ui,sans-serif);color:#3b2a20;opacity:1;transition:opacity .45s ease}
.avmy.git{opacity:0}
.avmy::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 2px,transparent 2px 64px),repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 2px,transparent 2px 64px);pointer-events:none}
.avmy-k{position:relative;width:min(460px,100%);background:#fdf3e1;border:4px solid #3b2a20;border-radius:24px;box-shadow:0 10px 0 #3b2a20,0 30px 60px rgba(0,0,0,.45);padding:20px 22px 18px;text-align:center;animation:avmyIn .5s cubic-bezier(.2,1.4,.4,1)}
@keyframes avmyIn{from{transform:translateY(22px) scale(.95)}to{transform:none}}
.avmy-logo{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:4px}
.avmy-logo svg{width:46px;height:46px;flex:none}
.avmy-ad{font-family:var(--disp,"Baloo 2","Nunito",system-ui,sans-serif);font-weight:800;font-size:34px;line-height:1;letter-spacing:.5px;color:#2e2a5a}
.avmy-ad b{color:#e0533c}
.avmy-alt{font-size:13px;color:#6b4a33;margin-bottom:12px}
.avmy-katlar{display:flex;flex-direction:column-reverse;gap:5px;margin:0 0 12px}
.avmy-kat{display:flex;align-items:center;gap:8px;background:#fff;border:2px solid #3b2a20;border-radius:12px;padding:6px 10px;font-size:13px;text-align:left}
.avmy-kat i{font-style:normal;font-weight:800;min-width:22px;height:22px;border-radius:7px;background:#2e2a5a;color:#fff;display:grid;place-items:center;font-size:12px}
.avmy-kat.e i{background:#e0533c}
.avmy-prog{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px}
.avmy-p{background:#f6ead2;border:2px solid #3b2a20;border-radius:12px;padding:7px 8px;font-size:12px;text-align:left;min-height:52px}
.avmy-p small{display:block;font-weight:800;color:#6b4a33;font-size:10.5px;letter-spacing:.4px;text-transform:uppercase;margin-bottom:2px}
.avmy-bar{height:14px;border:3px solid #3b2a20;border-radius:99px;background:#fff;overflow:hidden}
.avmy-bar>span{display:block;height:100%;width:0;background:repeating-linear-gradient(-45deg,#ffd23f 0 10px,#f2b632 10px 20px);transition:width 1.25s cubic-bezier(.3,.6,.2,1)}
.avmy-ipucu{margin-top:9px;font-size:12px;color:#6b4a33;min-height:15px}
@media (max-height:560px){.avmy-katlar{display:none}.avmy-k{padding:14px 16px}}
`;
const MARTI = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#2e2a5a" stroke="#3b2a20" stroke-width="3"/><path d="M9 27c5-7 10-8 15-3 5-5 10-4 15 3-5-3-10-3-15 2-5-5-10-5-15-2z" fill="#fff"/><circle cx="31" cy="21" r="1.6" fill="#ffd23f"/></svg>';
const IPUCU = [
  'Dükkânın önündeki sarı karede dur: para akar, dolunca dükkân senin.',
  'Yürüyen merdivene doğru yürü, seni bir üst kata çıkarır.',
  'Martı Sinemaları en üst katta: seans başlarken salonlar dolar.',
  'Sinema katında gişeden bilet al; her seans dizinin yeni bölümü oynar.',
  'Sinema katındaki mısır kokusu Sinema Büfesi\'nden geliyor: satın alıp işletebilirsin.',
  'Aldığın dükkânın aletleri içerideki sarı karelerden kurulur.',
];
const saatYaz = (h: number) => { const x = ((h % 24) + 24) % 24; return String(Math.floor(x)).padStart(2, '0') + ':' + String(Math.round((x % 1) * 60) % 60).padStart(2, '0'); };

let stil = false, el: HTMLDivElement | null = null, n = 0;
/** AVM'ye girişte çağrılır; saat programı göstermek için. Tekrar çağrılırsa (açıkken) bir şey yapmaz. */
export function avmYukleme(saat: number): void {
  try {
    if (el) return;
    if (!stil) { const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); stil = true; }
    const film = SALONLAR.map(s => { const x = seans(s, saat), no = bolumOf(diziOf(s.id), x.bolum).no; return x.durum === 'film' ? `${s.ad}: <b>${x.film.ad}</b> ${no}. bölüm (oynuyor)` : x.durum === 'giris' ? `${s.ad}: <b>${x.film.ad}</b> ${no}. bölüm (giriş açık)` : `${s.ad}: ${x.film.ad}, ${saatYaz(x.sonraki)} seansı`; }).join('<br>');
    el = document.createElement('div'); el.className = 'avmy';
    el.innerHTML = `<div class="avmy-k"><div class="avmy-logo">${MARTI}<div class="avmy-ad">MARTI <b>AVM</b></div></div>
      <div class="avmy-alt">Boğazın en kalabalık alışveriş merkezi · 4 kat</div>
      <div class="avmy-katlar">${KAT_ADI.map((a, i) => `<div class="avmy-kat${i === KAT_ADI.length - 1 ? ' e' : ''}"><i>${i}</i>${a}</div>`).join('')}</div>
      <div class="avmy-prog"><div class="avmy-p"><small>🎬 Martı Sinemaları</small>${film}</div><div class="avmy-p"><small>🍿 Sinema katı</small>İki gişe, bilet ${BILET_FIYAT} ₺<br>Sinema Büfesi ve bekleme salonu</div></div>
      <div class="avmy-bar"><span></span></div><div class="avmy-ipucu">${IPUCU[n++ % IPUCU.length]}</div></div>`;
    document.body.appendChild(el);
    const bar = el.querySelector('.avmy-bar>span') as HTMLElement, me = el;
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = '100%'; }));
    setTimeout(() => { me.classList.add('git'); setTimeout(() => { me.remove(); if (el === me) el = null; }, 480); }, 1500);
  } catch { el = null; }
}
