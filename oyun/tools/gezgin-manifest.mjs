// KAL-13: gezgin botların "her bina ve her etkileşim" listesi. İçerik tablolarından türetilir (elle liste yok):
//  binalar   : content/ic-mekan IC_MEKANLAR (iç mekanı olan her yer; IC_CANLI olanlar canlı işletme), kapı önü/içi noktaları, yerleşim öğeleri
//  arsalar   : content/esya ARSALAR (satın alınabilen arsa ve sabit kafeler), kapıları
//  duraklar  : dış mekan durakları (iskele, stadyum, Belgrad) + bölge sınırı duvar testleri
//  etkilesim : çalışma zamanında window.__marti.etkilesimler() (kayıtlı dwell noktaları) bot tarafından eklenir; burada yalnız bina içi noktalar
// Kullanım: npx vite-node tools/gezgin-manifest.mjs --yaz | --ozet   (tests/browser/gezgin/manifest.json). Testten: import { manifestUret }.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { IC_MEKANLAR, IC_CANLI, icKapi, icDim, icWorld, icLayout } from '../src/content/ic-mekan';
import { ARSALAR } from '../src/content/esya';

const r2 = v => Math.round(v * 100) / 100;

export function manifestUret() {
  const binalar = IC_MEKANLAR.map(m => {
    const { D } = icDim(m);
    const dis = icKapi(m, 1.6), kapi = icKapi(m, 0), ic = icWorld(m, 0, D / 2 - 1.3);
    // iç etkileşim noktaları: tezgah/kasa/masa ve eşya taşıyan öğeler (ilk 6, kapıya yakından uzağa)
    const ogeler = icLayout(m).filter(o => ['tezgah', 'kasa'].includes(o.k) || o.esya || /^masa/.test(o.k)).slice(0, 6);
    const noktalar = [{ ad: 'kapı içi', ...pt(ic) }, { ad: 'orta', ...pt({ x: m.x, z: m.z }) }, ...ogeler.map(o => ({ ad: o.k + (o.esya ? ':' + o.esya : ''), ...pt(icWorld(m, o.u, o.v + (o.v < 0 ? 1.0 : -0.9))) }))];
    return { id: m.id, ad: m.ad, tur: m.tur, canli: !!m.arsa && IC_CANLI.includes(m.arsa), arsa: m.arsa || null, bina: m.bina || null, merkez: pt({ x: m.x, z: m.z }), boy: { wx: m.wx, wz: m.wz }, kapiDis: pt(dis), kapi: pt(kapi), kapiIc: pt(ic), noktalar };
  });
  // kapısı başka bir binanın içinde kalan odalar (acil/morg hastanenin içinden açılır): bot önce ebeveyn binaya girmeli
  const kutuda = (b, q) => Math.abs(q.x - b.merkez.x) < b.boy.wx / 2 && Math.abs(q.z - b.merkez.z) < b.boy.wz / 2;
  for (const b of binalar) b.ebeveyn = binalar.find(o => o.id !== b.id && kutuda(o, b.kapiDis))?.id ?? null;
  const arsalar = ARSALAR.map(a => ({ id: a.id, ad: a.ad || '', sabit: a.sabit || '', x: a.x, z: a.z, kapi: a.kapi ? pt(a.kapi) : null }));
  const duraklar = [['iskele-bufe', 0, 0], ['iskele-ferry', -6, 4], ['stadyum-kapi', 404, 13], ['stadyum-saha', 425, 20], ['belgrad-durak', 806, 10], ['belgrad-orman', 840, 20], ['belgrad-derin', 870, 40]].map(([ad, x, z]) => ({ ad, x, z }));
  return { surum: 1, binalar, arsalar, duraklar, ozet: { bina: binalar.length, ic_ice: binalar.filter(b => b.ebeveyn).length, canli: binalar.filter(b => b.canli).length, arsa: arsalar.length, icNokta: binalar.reduce((n, b) => n + b.noktalar.length, 0) } };
  function pt(p) { return { x: r2(p.x), z: r2(p.z) }; }
}

// vite-node betik yolunu argv'den siler: doğrudan çalıştırma bayraklarla anlaşılır (--yaz / --ozet)
if (process.argv.includes('--yaz') || process.argv.includes('--ozet')) {
  const m = manifestUret();
  console.log(JSON.stringify(m.ozet));
  if (process.argv.includes('--yaz')) { const d = join(dirname(fileURLToPath(import.meta.url)), '../tests/browser/gezgin'); mkdirSync(d, { recursive: true }); writeFileSync(join(d, 'manifest.json'), JSON.stringify(m, null, 1)); console.log('yazıldı: tests/browser/gezgin/manifest.json'); }
}
