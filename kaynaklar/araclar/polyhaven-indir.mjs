// Poly Haven (CC0) kaynaklarını kendi depomuza indirir.
// Kullanım:  node kaynaklar/araclar/polyhaven-indir.mjs [--kuru]
//   --kuru : hiçbir şey indirmez, sadece neyin seçileceğini yazar.
// Gerekli: Node 18+ (fetch yerleşik). İnternet: api.polyhaven.com + dl.polyhaven.org
// Çıktı:   kaynaklar/polyhaven/{hdri,doku,model}/<id>/...  +  kaynaklar/polyhaven/katalog.json
// Lisans:  Poly Haven'daki her şey CC0 (https://polyhaven.com/license). Katalogda yazar + kaynak URL tutulur.

import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'polyhaven');
const KURU = process.argv.includes('--kuru');
const API = 'https://api.polyhaven.com';
const UA = { 'User-Agent': 'marti-motoru-kaynak-indirici/1.0' };

// Ne seçilecek: kategori başına en çok indirilen N tane. Kategori adları Poly Haven API'sindeki adlardır.
// Oyunlarımızın temaları: sahil/iskele, şehir sokağı, stadyum/halı saha, orman.
const PLAN = {
  hdris: {
    cozunurluk: '2k', bicim: 'hdr',
    kategoriler: { 'outdoor': 4, 'skies': 4, 'sunrise-sunset': 3, 'night': 3, 'urban': 3, 'nature': 3 },
  },
  textures: {
    cozunurluk: '1k', bicim: 'jpg',
    // arm = AO(R) + Roughness(G) + Metalness(B): Three.js aoMap/roughnessMap/metalnessMap'e aynı doku verilir.
    haritalar: ['Diffuse', 'nor_gl', 'arm', 'Displacement'],
    kategoriler: {
      'wood': 5, 'floor': 5, 'wall': 5, 'brick': 4, 'concrete': 4, 'plaster': 3, 'road': 4,
      'terrain': 5, 'rock': 4, 'natural': 4, 'metal': 4, 'man made': 3, 'roofing': 2, 'fabric': 2, 'sand': 2,
    },
  },
  models: {
    cozunurluk: '1k', bicim: 'gltf',
    kategoriler: { 'nature': 7, 'furniture': 5, 'props': 5, 'decorative': 3, 'industrial': 2, 'food': 2 },
  },
};
const KLASOR = { hdris: 'hdri', textures: 'doku', models: 'model' };

const json = async (url) => {
  for (let d = 0; d < 4; d++) {
    try { const r = await fetch(url, { headers: UA }); if (r.ok) return r.json(); throw new Error(r.status); }
    catch (e) { if (d === 3) throw new Error(`${url}: ${e.message}`); await new Promise((s) => setTimeout(s, 1500 * (d + 1))); }
  }
};
const varMi = async (p) => { try { await stat(p); return true; } catch { return false; } };
async function indir(url, hedef) {
  if (await varMi(hedef)) return 0;
  await mkdir(dirname(hedef), { recursive: true });
  for (let d = 0; d < 4; d++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(r.status);
      const b = Buffer.from(await r.arrayBuffer());
      await writeFile(hedef, b);
      return b.length;
    } catch (e) { if (d === 3) throw new Error(`${url}: ${e.message}`); await new Promise((s) => setTimeout(s, 1500 * (d + 1))); }
  }
}

// Dosya ağacından istenen çözünürlük yoksa en yakın küçüğünü/büyüğünü seç.
const SIRA = ['1k', '2k', '512', '4k', '8k'];
function cozSec(obj, iste) {
  if (!obj) return null;
  if (obj[iste]) return obj[iste];
  for (const r of SIRA) if (obj[r]) return obj[r];
  return null;
}

async function main() {
  const katalogYolu = join(KOK, 'katalog.json');
  const katalog = (await varMi(katalogYolu)) ? JSON.parse(await readFile(katalogYolu, 'utf8')) : { kaynak: 'https://polyhaven.com', lisans: 'CC0 1.0', ogeler: {} };
  let toplam = 0;
  const secilen = new Set();
  for (const [tur, plan] of Object.entries(PLAN)) {
    const hepsi = await json(`${API}/assets?t=${tur}`);
    const liste = Object.entries(hepsi).map(([id, v]) => ({ id, ...v }));
    for (const [kat, n] of Object.entries(plan.kategoriler)) {
      const aday = liste.filter((a) => (a.categories || []).includes(kat) && !secilen.has(a.id))
        .sort((a, b) => (b.download_count || 0) - (a.download_count || 0)).slice(0, n);
      if (!aday.length) console.warn(`! ${tur}/${kat}: kategori boş veya adı farklı`);
      for (const a of aday) {
        secilen.add(a.id);
        const yer = join(KOK, KLASOR[tur], a.id);
        console.log(`${KURU ? '[kuru] ' : ''}${tur}/${kat}: ${a.id} (${a.name})`);
        if (KURU) continue;
        try {
          const dosyalar = await json(`${API}/files/${a.id}`);
          const inen = [];
          if (tur === 'hdris') {
            const f = cozSec(dosyalar.hdri, plan.cozunurluk)?.[plan.bicim];
            if (f) { toplam += await indir(f.url, join(yer, `${a.id}_${plan.cozunurluk}.${plan.bicim}`)); inen.push(`${a.id}_${plan.cozunurluk}.${plan.bicim}`); }
            // önizleme için küçük tonemapped jpg
            const t = dosyalar.tonemapped; if (t?.url) { toplam += await indir(t.url, join(yer, 'onizleme.jpg')); inen.push('onizleme.jpg'); }
          } else if (tur === 'textures') {
            for (const h of plan.haritalar) {
              const f = cozSec(dosyalar[h], plan.cozunurluk)?.[plan.bicim];
              if (!f) continue;
              const ad = `${a.id}_${h.toLowerCase()}_${plan.cozunurluk}.${plan.bicim}`;
              toplam += await indir(f.url, join(yer, ad)); inen.push(ad);
            }
          } else {
            const g = cozSec(dosyalar.gltf, plan.cozunurluk)?.gltf;
            if (g) {
              const ad = g.url.split('/').pop();
              toplam += await indir(g.url, join(yer, ad)); inen.push(ad);
              for (const [yol, inc] of Object.entries(g.include || {})) { toplam += await indir(inc.url, join(yer, yol)); inen.push(yol); }
            }
          }
          katalog.ogeler[a.id] = {
            tur: KLASOR[tur], kategori: kat, ad: a.name, etiketler: a.tags || [], yazarlar: Object.keys(a.authors || {}),
            lisans: 'CC0 1.0', kaynak: `https://polyhaven.com/a/${a.id}`, klasor: `polyhaven/${KLASOR[tur]}/${a.id}`, dosyalar: inen,
            ...(a.dimensions ? { boyut_mm: a.dimensions } : {}),
          };
        } catch (e) { console.warn(`! ${a.id}: ${e.message}`); }
      }
    }
  }
  if (!KURU) {
    await mkdir(KOK, { recursive: true });
    await writeFile(katalogYolu, JSON.stringify(katalog, null, 1));
    console.log(`Bitti. ${Object.keys(katalog.ogeler).length} öğe, bu çalıştırmada ${(toplam / 1048576).toFixed(1)} MB indirildi.`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
