/**
 * PRF-11 yükleme ekranı: index.html'deki #yukle (tools/build-artifact.mjs yazar) game.js inerken kendi kendine kıpırdayan bir
 * çubuk gösterir (siyah/boş ekranda bekleme yok). boot gerçek aşamalarda oranı ve yazıyı günceller; shader ısıtması bitip oyun
 * hazır olunca solup kalkar. Isıtma sürerken başlık ekranının üstünde durur: oyuncu ısıtma bitmeden oyuna giremez.
 * Öğe yoksa (geliştirme sunucusu, testlerin kendi sayfası) hiçbir şey yapmaz.
 */
const el = (): HTMLElement | null => (typeof document !== 'undefined' ? document.getElementById('yukle') : null);

/** Sets the bar to `oran` (0..1, never backwards) and, if given, the line under it. */
export function yukleAdim(oran: number, yazi?: string): void {
  const e = el(); if (!e) return;
  const once = parseFloat(e.style.getPropertyValue('--y')) || 0;
  e.style.setProperty('--y', String(Math.max(once, Math.min(1, oran))));
  e.classList.add('yk-gercek');
  if (yazi) { const t = e.querySelector('.yk-yazi'); if (t) t.textContent = yazi; }
}

/** Fills the bar, fades the screen out and removes it. */
export function yukleBitti(): void {
  const e = el(); if (!e) return;
  yukleAdim(1);
  e.classList.add('yk-bitti');
  setTimeout(() => e.remove(), 450);
}
