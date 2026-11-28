// Ortak yardımcı: Karakter Atölyesi'ni (src/game/ui/kulis.ts) kapatır. Test değildir (playwright/vitest bunu çalıştırmaz).
// Atölye açık kalırsa sim 'esnafim' duraklamasında kalır ve ölçüm/gözlem geçersiz olur. Eski kulisin '.kl-go' düğmesi artık yok;
// yeni atölye önce beden seçtirir (.ka-pb), sonra "Sahneye çık" (.ka-go). Ad zorunludur (UX-15): boş adla .ka-go paneli kapatmaz.
// Varsayılan yol perf-gate/bellek-olc ile aynıdır: sim komutu (set ad + done), panel bir sonraki karede kapanır.
// ui:true gerçek arayüzü dener (beden, ad, Sahneye çık); kapanmazsa yine komutla kapatır. bekle: atölye görünene dek en çok bu kadar ms bekler.
export const KULIS_SEC = '.ka-pb, .ka-go, .kl-go';

export async function kulisKapat(p, ad = 'Olcum', { bekle = 0, ui = false, sessiz = false } = {}) {
  if (bekle) await p.waitForSelector(KULIS_SEC, { timeout: bekle }).catch(() => null);
  if (ui) {
    for (let k = 0; k < 3; k++) {
      const pb = await p.$('.ka-pb'); if (pb) { await pb.click({ force: true }).catch(() => {}); await p.waitForTimeout(300); }
      const go = await p.$('.ka-go, .kl-go'); if (!go) break;
      const inp = await p.$('input[name="ad"]'); if (inp && !(await inp.inputValue().catch(() => '')).trim()) await inp.fill(ad).catch(() => {});
      await go.click({ force: true }).catch(() => {}); await p.waitForTimeout(400);
    }
  }
  const acik = await p.evaluate(([ad, ui, sec]) => {
    const M = window.__marti; if (!M?.command) return !!document.querySelector(sec);
    const kalmis = () => !!document.querySelector(sec) || M.state?.().pauseWhy === 'esnafim';
    if (!ui || kalmis()) { M.command({ kind: 'esnafim', op: 'set', data: { ad } }); M.command({ kind: 'esnafim', op: 'done' }); M.renderFrames?.(2, 0.1); }
    return kalmis();
  }, [ad, ui, KULIS_SEC]);
  if (acik && !sessiz) console.log('UYARI: karakter paneli kapanmadı, ölçüm geçersiz');
  return !acik;
}
