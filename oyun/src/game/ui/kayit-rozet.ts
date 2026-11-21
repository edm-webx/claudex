// KAL-01: ekranın köşesinde küçük kayıt rozeti (#kayit-rozet). Metni net/kayit-durum.ts verir; "Kaydedildi" yalnız sunucu onayından sonra.
// Hata/çevrimdışı durumunda dokununca hemen yeniden dener. Hesapsız oyunda hiç görünmez (bulut kaydı yok).
import type { KayitDurum, KayitGorunum } from '../net/kayit-durum';

const CSS = `
#kayit-rozet{position:absolute;left:10px;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:31;max-width:min(78vw,340px);padding:4px 12px;border-radius:999px;border:2px solid #3b2a20;background:#3b2a20;color:#fff6e6;font:800 13px/1.35 var(--disp);letter-spacing:.2px;pointer-events:none;opacity:.62;transition:opacity .25s,background .25s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#kayit-rozet.on{opacity:1}
#kayit-rozet.hata,#kayit-rozet.cevrimdisi,#kayit-rozet.salt{background:#a8321f;border-color:#3b2a20;opacity:1;pointer-events:auto;cursor:pointer}
#kayit-rozet.bekliyor{opacity:.85}
`;

export function createKayitRozet(deps: { root: HTMLElement; durum: KayitDurum; gorunur: () => boolean }) {
  const st = document.createElement('style'); st.textContent = CSS; deps.root.appendChild(st);
  const el = document.createElement('div'); el.id = 'kayit-rozet'; el.setAttribute('data-hook', 'kayit-rozet'); el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
  el.style.display = 'none'; deps.root.appendChild(el);
  el.addEventListener('click', e => { e.stopPropagation(); void deps.durum.simdiKaydet(); });
  let son: KayitGorunum = deps.durum.gorunum(), ok = 0;
  const ciz = (g: KayitGorunum) => {
    son = g;
    el.className = g.durum;
    el.dataset.durum = g.durum;
    if (g.durum === 'tamam') { ok++; const k = ok; el.classList.add('on'); setTimeout(() => { if (k === ok) el.classList.remove('on'); }, 3500); }
    el.textContent = g.metin;
    el.style.display = g.metin && deps.gorunur() ? '' : 'none';
  };
  deps.durum.abone(ciz);
  return { guncelle() { el.style.display = son.metin && deps.gorunur() ? '' : 'none'; }, el };
}
