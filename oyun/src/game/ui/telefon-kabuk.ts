// Telefon kabuğu (2026-11-27, kullanıcı: "Telefon ekranındaki tuşlara basınca her şey telefondan yapılacak, ekranın ortasında kocaman menü
// çıkmayacak; o yüzden telefon görüntüsü büyüyebilir"). Ekranın ortasında açılan bütün menüler (v2 sheet panelleri, Çanta/Mülklerim/ATM kartı,
// Oyun kodu kartı, Maç Koordinatörü kartı) sağ altta duran Esnaf telefonunun kendi ekranı olarak çizilir: aynı yer, aynı çerçeve, aynı çentik.
// Yalnız CSS + iki küçük yardımcı; panellerin içeriğine ve sim'e dokunmaz.
// - Geometri değişkenleri #sbui üstünde: --tf-w genişlik, --tf-t/--tf-b üst/alt boşluk, --tf-r sağ boşluk. Ana ekran (.tf-ph) da aynısını kullanır,
//   bu yüzden bir uygulamaya geçince çerçeve yerinden oynamaz, yalnız ekranın içi yumuşakça değişir.
// - Kısa yatay ekranda (telefon yatay, yükseklik <= 540) telefon yan çevrilmiş gibi genişler: içerik sığar, ortası yine boş kalır.
// - Flaş yok (kullanıcının epilepsisi var): geçişler yalnız opaklık/kaydırma, parlaklık sıçraması yok; arka plan karartması da yok
//   (karartma açılıp kapanırken bütün ekranın parlaklığı bir anda değişiyordu).
export const KABUK = ['#sbui .sb-sheet', '#sbui .mp-card', '#sbui .on-card', '#sbui .kd-card'];
const K = KABUK.join(',');
const each = (suffix: string) => KABUK.map(s => s + suffix).join(',');
// sinyal + pil simgeleri (durum çubuğu), beyaz
export const DURUM_SVG = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="58" height="12" viewBox="0 0 58 12"><g fill="#fff"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0.5" width="3" height="11.5" rx="1"/><rect x="33" y="1" width="21" height="10" rx="3" fill="none" stroke="#fff" stroke-width="1.6"/><rect x="35.5" y="3.4" width="13" height="5.2" rx="1.4"/><rect x="55" y="4" width="2.4" height="4" rx="1"/></g></svg>')}")`;

export const KABUK_CSS = `
#sbui{--tf-r:calc(var(--sr,0px) + 14px);--tf-t:calc(var(--st,0px) + 12px);--tf-b:calc(var(--sbm,0px) + 12px);--tf-w:min(440px,calc(100vw - 28px));--tf-hmax:780px;--tf-bz:9px;--tf-sb:26px}
@media (orientation:landscape) and (max-height:540px){#sbui{--tf-w:min(600px,calc(100vw - var(--sl,0px) - var(--sr,0px) - 280px));--tf-t:calc(var(--st,0px) + 6px);--tf-b:calc(var(--sbm,0px) + 6px);--tf-r:calc(var(--sr,0px) + 8px);--tf-bz:7px;--tf-sb:20px}}
@media (orientation:portrait) and (max-width:620px){#sbui{--tf-w:calc(100vw - 16px);--tf-r:8px;--tf-t:calc(var(--hudb,90px) + 6px)}}
${K}{position:absolute!important;left:auto!important;right:var(--tf-r)!important;top:var(--tf-t)!important;bottom:var(--tf-b)!important;width:var(--tf-w)!important;max-width:none!important;height:auto!important;max-height:var(--tf-hmax)!important;margin:auto 0 0!important;
  box-sizing:border-box!important;display:flex;flex-direction:column;overflow:hidden!important;z-index:50;pointer-events:auto;
  border:var(--tf-bz) solid #10131f!important;border-radius:calc(var(--tf-bz) + 30px)!important;padding-top:var(--tf-sb)!important;
  background:linear-gradient(var(--tf-acc,#3b2a20),var(--tf-acc,#3b2a20)) 0 0/100% var(--tf-sb) no-repeat,var(--tf-paper,#fdf3e1)!important;
  box-shadow:0 0 0 2px #3a4262,0 0 0 3.5px #07090f,0 22px 48px rgba(4,8,20,.45)!important;animation:tf-kalk .24s cubic-bezier(.2,.9,.3,1) both}
${each('::before')}{content:"";position:absolute;top:5px;left:50%;transform:translateX(-50%);width:86px;height:calc(var(--tf-sb) - 9px);border-radius:12px;background:#10131f;z-index:3;pointer-events:none}
${each('::after')}{content:"";display:block;position:absolute;left:auto;bottom:auto;top:calc(var(--tf-sb) / 2 - 6px);right:22px;width:58px;height:12px;border:0;transform:none;animation:none;background:${DURUM_SVG} center/contain no-repeat;opacity:.92;z-index:3;pointer-events:none}
@keyframes tf-kalk{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
@keyframes tf-in2{from{opacity:0}to{opacity:1}}
/* telefonun ana ekranından bir uygulamaya geçerken çerçeve kımıldamaz: yalnız ekranın içi yumuşakça belirir */
#sbui.tf-gecis .sb-sheet,#sbui.tf-gecis .mp-card,#sbui.tf-gecis .on-card,#sbui.tf-gecis .kd-card{animation:tf-in2 .18s ease-out both}
#sbui .sb-sheet.out{animation:tf-in2 .16s ease-in reverse forwards!important}
@media (prefers-reduced-motion:reduce){${K}{animation:none!important}}
/* her uygulamanın kendi rengi (durum çubuğu); v2 sheet'lerinde zaten --acc var */
#sbui .sb-sheet{--tf-acc:var(--acc,#e0533c);--tf-paper:var(--paper,#fdf3e1)}
#sbui .mp-card{--tf-acc:#8b5cc4}#sbui .on-card{--tf-acc:#d6513a}#sbui .kd-card{--tf-acc:#3a8fd6}
#sbui .sb-sheet.dk-low{max-height:var(--tf-hmax)!important;bottom:var(--tf-b)!important}
#sbui .sb-sheet .sb-awn{height:14px}
/* arka planı kararan eski kart kapları: artık yalnız dışarı dokununca kapatan şeffaf yakalayıcı */
#sbui .mp-bg,#sbui .on-bg,#sbui .kd-bg{background:transparent!important;padding:0!important}
#sbui .on-card{padding:12px 16px 16px!important;overflow-y:auto!important;display:block}
#sbui .on-card{padding-top:calc(var(--tf-sb) + 12px)!important}
/* ana ekran çubuğu: telefonun ana ekranına döner */
#sbui .tf-ev{flex:none;display:block;width:100%;height:22px;margin:0;padding:0;border:0;background:transparent;cursor:pointer;position:relative}
#sbui .tf-ev:before{content:"";position:absolute;left:50%;top:8px;width:min(120px,30%);height:5px;border-radius:3px;transform:translateX(-50%);background:rgba(59,42,32,.55)}
#sbui .tf-ev:hover:before{background:rgba(59,42,32,.8)}
#sbui .tf-geri{flex:none;width:38px;height:38px;border-radius:12px;border:2.5px solid var(--ink,#3b2a20);background:#fff;display:grid;place-items:center;padding:0;cursor:pointer;font:900 22px/1 var(--disp,system-ui);color:var(--ink,#3b2a20)}
#sbui .tf-geri:active{transform:translateY(1px)}
/* "Arkadaş çağır" hapı bildirim balonlarının ve öğretici kartın üstüne biniyordu (QA 04/07); aynı iş telefonun Arkadaşlar uygulamasında.
   Düğme DOM'da kalır (telefon onu tıklatır), yalnız ekranda görünmez */
#sbui .on-oda{display:none!important}
/* telefon (ya da bir uygulaması) açıkken: telefonun altında kalan HUD parçaları gizlenir, bildirimler telefonun solunda ortalanır */
/* bildirimler telefonun ekranının tepesinden iner (gerçek telefon bildirimi gibi), arkada kalıp kesilmez */
#sbui.tf-acik .sb-toasts{left:auto;right:calc(var(--tf-r) + var(--tf-bz) + 8px);top:calc(var(--tf-t) + var(--tf-bz) + var(--tf-sb) + 6px);transform:none;width:calc(var(--tf-w) - 2 * var(--tf-bz) - 16px);z-index:66;pointer-events:none}
#sbui.tf-acik .sb-toast{font-size:12.5px;line-height:1.25;padding:5px 10px 6px 5px;border-radius:14px}
/* Çanta/Mülklerim başlığı dar telefonda taşıyordu (✕ ekran dışı) */
#sbui .mp-top{flex-wrap:nowrap;min-width:0}#sbui .mp-top h2{min-width:0;font-size:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#sbui .mp-top .mp-chip{font-size:13px;padding:2px 7px}
@media (max-width:760px){#sbui .mp-top .mp-chip+.mp-chip{display:none}}
/* Tadilat merdiveni (10 aşama) telefonda yan yana sığmıyordu, etiketler birbirine giriyordu (QA 09): kaydırılabilir şerit */
#sbui .sb-sheet .sb-ladder{justify-content:flex-start;overflow-x:auto;scrollbar-width:none;gap:4px;padding-bottom:6px}
#sbui .sb-sheet .sb-ladder::before{right:auto;width:calc(10 * 70px)}
#sbui .sb-sheet .sb-st{flex:0 0 66px;overflow-wrap:anywhere}
#sbui.tf-acik .on-oda,#sbui.tf-acik .tf-ctx,#sbui.tf-acik .mp-hint,#sbui.tf-acik .sb-bar,#sbui.tf-acik .sb-notes{visibility:hidden!important}
`;

/** kabuk CSS'ini bir kez ekler (telefon, mülk paneli, online kart aynı kökte) */
export function kabukKur(root: HTMLElement): void {
  if (root.querySelector('style[data-tf-kabuk]')) return;
  const st = document.createElement('style'); st.dataset.tfKabuk = '1'; st.textContent = KABUK_CSS; root.appendChild(st);
}
/** telefonun ana ekranını aç (boot 'telefon' olayını telefon.toggle'a bağlar; çağıran kendi kartını önce kapatır) */
export function telefonaDon(root: HTMLElement): void {
  root.dispatchEvent(new CustomEvent('ui:open', { detail: 'telefon', bubbles: true }));
}
export const EV_BTN = '<button class="tf-ev" data-a="__tel" data-tf-ev="1" aria-label="Telefonun ana ekranı"></button>';
export const GERI_BTN = '<button class="tf-geri" data-a="__tel" data-tf-ev="1" aria-label="Telefona dön">‹</button>';
