/**
 * Karakter Atölyesi kataloğu (2026-11-21): every choice of the character creator in one place.
 * - beden: 'a' (erkek) / 'b' (kadın) / undefined (ikisi de). The creator shows the body's own options first;
 *   "Tüm stiller" also lists the rest for hair. Beards and mustaches are male-only, dresses/skirts female-only.
 * - premium: reserved for the future outfit market (Altın Simit). Nothing is premium yet; the creator shows a lock
 *   and skips such items in "Rastgele" until the market can sell them.
 * Ids are what the save keeps (EsnafimSave) and what the rig understands (chars-v2 / sac-kit).
 */
export type Beden = 'a' | 'b';
export interface Secenek { id: string; ad: string; beden?: Beden; premium?: { gold: number }; yeni?: boolean }

export const SAC: Secenek[] = [
  { id: 'short', ad: 'Klasik kısa', beden: 'a' }, { id: 'sport', ad: 'Fade', beden: 'a' }, { id: 'sidepart', ad: 'Yana yatık', beden: 'a', yeni: true },
  { id: 'pomp', ad: 'Kabarık', beden: 'a', yeni: true }, { id: 'slick', ad: 'Geriye taralı', beden: 'a', yeni: true }, { id: 'undercut', ad: 'Undercut', beden: 'a', yeni: true },
  { id: 'buzz', ad: 'Kazıtma' }, { id: 'mohawk', ad: 'İbiş', yeni: true }, { id: 'spiky', ad: 'Dikenli', beden: 'a', yeni: true },
  { id: 'mullet', ad: 'Kefal kesim', beden: 'a', yeni: true }, { id: 'manbun', ad: 'Arka topuz', beden: 'a', yeni: true },
  { id: 'curly', ad: 'Kıvırcık' }, { id: 'afro', ad: 'Afro' }, { id: 'locs', ad: 'Rasta', yeni: true }, { id: 'wavy', ad: 'Dalgalı' }, { id: 'loose', ad: 'Salaş' },
  { id: 'long', ad: 'Uzun düz', beden: 'b' }, { id: 'curlylong', ad: 'Uzun kıvırcık', beden: 'b', yeni: true }, { id: 'bob', ad: 'Küt kahküllü', beden: 'b' },
  { id: 'pixie', ad: 'Pixie', beden: 'b', yeni: true }, { id: 'bun', ad: 'Topuz', beden: 'b' }, { id: 'ponytail', ad: 'At kuyruğu', beden: 'b' },
  { id: 'braid', ad: 'Örgü', beden: 'b', yeni: true }, { id: 'pigtails', ad: 'İki örgü', beden: 'b', yeni: true }, { id: 'buns2', ad: 'Çift topuz', beden: 'b', yeni: true },
  { id: 'bald', ad: 'Kel' },
];
export const SAKAL: Secenek[] = [
  { id: 'yok', ad: 'Yok' }, { id: 'kirli', ad: 'Kirli sakal' }, { id: 'kisa', ad: 'Kısa sakal' }, { id: 'tam', ad: 'Gür sakal' }, { id: 'uzun', ad: 'Dede sakalı', yeni: true },
  { id: 'keci', ad: 'Keçi' }, { id: 'cember', ad: 'Çember' }, { id: 'cene', ad: 'Çene hattı', yeni: true }, { id: 'favori', ad: 'Favori' },
];
export const BIYIK: Secenek[] = [
  { id: 'yok', ad: 'Yok' }, { id: 'ince', ad: 'Kalem' }, { id: 'kalin', ad: 'Pala' }, { id: 'pos', ad: 'Pos', yeni: true }, { id: 'burma', ad: 'Burma' },
  { id: 'kaytan', ad: 'Kaytan', yeni: true }, { id: 'nal', ad: 'Nal', yeni: true }, { id: 'sarkik', ad: 'Sarkık', yeni: true },
];
export const UST: Secenek[] = [
  { id: 'tee', ad: 'Tişört' }, { id: 'shirt', ad: 'Gömlek' }, { id: 'hoodie', ad: 'Kapüşonlu' }, { id: 'jacket', ad: 'Ceket' }, { id: 'cardigan', ad: 'Hırka' },
  { id: 'suit', ad: 'Takım' }, { id: 'vest', ad: 'Atlet yelek' }, { id: 'jersey', ad: 'Forma' }, { id: 'overall', ad: 'Tulum' }, { id: 'dress', ad: 'Elbise', beden: 'b' },
];
export const ALT: Secenek[] = [{ id: 'pants', ad: 'Pantolon' }, { id: 'shorts', ad: 'Şort' }, { id: 'skirt', ad: 'Etek', beden: 'b' }];
export const KOL: Secenek[] = [{ id: 'short', ad: 'Kısa kol' }, { id: 'long', ad: 'Uzun kol' }, { id: 'rolled', ad: 'Sıvalı' }];
export const DESEN: Secenek[] = [{ id: '0', ad: 'Düz' }, { id: '1', ad: 'Çizgili' }, { id: '2', ad: 'Dikey çizgi' }, { id: '3', ad: 'Kareli' }];
export const SAPKA: Secenek[] = [
  { id: '', ad: 'Yok' }, { id: 'kasket', ad: 'Kasket' }, { id: 'cap', ad: 'Kep' }, { id: 'beanie', ad: 'Bere' }, { id: 'bucket', ad: 'Balıkçı' }, { id: 'sunhat', ad: 'Hasır' },
  { id: 'bandana', ad: 'Bandana' }, { id: 'captain', ad: 'Kaptan' }, { id: 'chef', ad: 'Aşçı' }, { id: 'paper', ad: 'Kağıt' }, { id: 'helmet', ad: 'Kask' },
];
export const GOZLUK: Secenek[] = [{ id: '', ad: 'Yok' }, { id: 'glasses', ad: 'İnce' }, { id: 'round', ad: 'Yuvarlak' }, { id: 'thick', ad: 'Kalın çerçeve' }, { id: 'sun', ad: 'Güneş' }];
export const GOZ: Secenek[] = [{ id: 'round', ad: 'Yuvarlak' }, { id: 'oval', ad: 'Badem' }, { id: 'big', ad: 'İri' }, { id: 'small', ad: 'Kısık' }, { id: 'lash', ad: 'Kirpikli' }];
export const KAS: Secenek[] = [{ id: 'thin', ad: 'İnce' }, { id: 'mid', ad: 'Orta' }, { id: 'thick', ad: 'Gür' }, { id: 'none', ad: 'Yok' }];
export const EYELINER: Secenek[] = [{ id: 'yok', ad: 'Yok' }, { id: 'ince', ad: 'İnce' }, { id: 'kanat', ad: 'Kanatlı' }];
export const BEN: Secenek[] = [{ id: 'yok', ad: 'Yok' }, { id: 'yanak', ad: 'Yanakta' }, { id: 'dudak', ad: 'Dudak kenarı' }, { id: 'goz', ad: 'Göz altı' }];
export const YAS: Secenek[] = [{ id: 'genc', ad: 'Genç' }, { id: 'orta', ad: 'Orta yaş' }, { id: 'yasli', ad: 'Yaşlı' }];
export const IFADE_SEC: Secenek[] = [
  { id: 'notr', ad: 'Nötr' }, { id: 'gulumser', ad: 'Gülümser' }, { id: 'nese', ad: 'Neşeli' }, { id: 'ciddi', ad: 'Ciddi' },
  { id: 'gozkirp', ad: 'Göz kırpar' }, { id: 'dalgin', ad: 'Dalgın' }, { id: 'huzurlu', ad: 'Huzurlu' }, { id: 'uykulu', ad: 'Uykulu' },
];

export const PALET = {
  ten: ['#fbe1cc', '#f5d0b1', '#eec29d', '#e6b089', '#d99f76', '#cb8d62', '#bb7b51', '#a66944', '#8f5839', '#784830', '#613a27', '#4b2d1f'],
  sacDogal: ['#1f1813', '#3b281c', '#5e3d26', '#7a4a2a', '#8c3f22', '#a8794a', '#c8692e', '#d6b06c', '#eadfc8', '#9c9894', '#c9c5bf', '#ece8e2'],
  sacRenkli: ['#e85a9a', '#b04fd1', '#3a7bd5', '#3fb5b0', '#3fa35a', '#e0533c', '#f2c230', '#7d3c98'],
  goz: ['#3a2416', '#6b4423', '#9a6a2e', '#2f6f9a', '#5aa9d6', '#3fa35a', '#7a7f87', '#1b1b22'],
  kumas: ['#fbf9f4', '#e8e2d4', '#2b2b33', '#59606b', '#e0533c', '#c0392b', '#d9822b', '#f2c230', '#3fa35a', '#6f8f4f', '#3fb5b0', '#2f6f9a', '#6f9bc8', '#2e3a59', '#7d3c98', '#e85a9a', '#f2a2b3', '#c9a05a', '#7d5638', '#8daa5b'],
  ayakkabi: ['#7a5236', '#4a3528', '#2b2b33', '#fbf9f4', '#e0533c', '#3a7bd5', '#f2c230', '#8a3a2a'],
  ruj: ['#c0392b', '#e0405a', '#e85a9a', '#9b3b5a', '#d9822b', '#b5654f', '#6e2a4a'],
  far: ['#c9a05a', '#b08a7a', '#7d3c98', '#3a7bd5', '#3fa35a', '#e85a9a', '#2b2b33', '#d9822b'],
  allik: ['#eb6060', '#f08a9a', '#e8875a', '#c9576e'],
  aksesuar: ['#c0392b', '#2b2b33', '#f2c230', '#3fb5b0', '#e85a9a', '#2e3a59', '#3fa35a', '#7d3c98'],
};

export const uygun = (s: Secenek, beden: Beden) => !s.beden || s.beden === beden;
export const bedenSec = (list: Secenek[], beden: Beden) => list.filter(s => uygun(s, beden));

/** Rastgele, ama bedene saygılı: kadında sakal/bıyık yok, erkekte elbise/etek yok, premium yok. */
export function rastgeleGorunum(beden: Beden, rnd: () => number = Math.random): Record<string, unknown> {
  const pick = <X>(a: X[]) => a[Math.floor(rnd() * a.length)];
  const own = (l: Secenek[]) => bedenSec(l, beden).filter(s => !s.premium);
  const w = (p: number) => rnd() < p;
  const sacRenk = w(0.12) ? pick(PALET.sacRenkli) : pick(PALET.sacDogal.slice(0, 9));
  const kadin = beden === 'b';
  const d: Record<string, unknown> = {
    tip: beden, vucut: pick(['slim', 'mid', 'mid', 'round']), boy: pick([0.94, 0.97, 1, 1, 1.03, 1.06]), ten: Math.floor(rnd() * 12),
    yas: w(0.12) ? 'yasli' : w(0.25) ? 'orta' : 'genc',
    goz: pick(own(GOZ)).id, gozRenk: pick(PALET.goz), kas: pick(KAS.slice(0, 3)).id,
    gozAra: pick(['yakin', 'orta', 'orta', 'uzak']), gozY: pick(['yukari', 'orta', 'orta', 'asagi']), burun: pick(['kucuk', 'orta', 'orta', 'iri', 'uzun']),
    agiz: pick(['dar', 'orta', 'orta', 'genis']), kulak: pick(['kucuk', 'orta', 'orta', 'kepce']), cil: w(0.2), gamze: w(0.25), ben: w(0.15) ? pick(BEN.slice(1)).id : 'yok',
    sac: pick(own(SAC).filter(s => s.id !== 'bald' || w(0.3))).id, sacRenk, sakalRenk: null,
    ustStil: pick(own(UST)).id, ust: pick(PALET.kumas), aksan: w(0.5) ? pick(PALET.kumas) : null, desen: w(0.3) ? Math.floor(rnd() * 4) : 0,
    altStil: pick(own(ALT)).id, alt: pick(PALET.kumas.slice(2, 14)), ayakkabi: pick(PALET.ayakkabi), kol: pick(['short', 'long', 'rolled']),
    sapka: w(0.25) ? pick(SAPKA.slice(1)).id : null, sapkaRenk: pick(PALET.aksesuar), gozluk: w(0.2) ? pick(GOZLUK.slice(1)).id : null,
    papyon: null, kravat: null, yelek: null, kolye: w(0.15), kupe: kadin ? w(0.6) : w(0.1),
    // body-gated parts
    sakalStil: kadin ? 'yok' : pick(['yok', 'yok', 'kirli', 'kisa', 'tam', 'keci', 'cember', 'cene', 'favori', 'uzun']),
    biyik: kadin ? 'yok' : pick(['yok', 'yok', 'ince', 'kalin', 'pos', 'burma', 'kaytan', 'nal', 'sarkik']),
    ruj: kadin && w(0.6) ? pick(PALET.ruj) : null, far: kadin && w(0.45) ? pick(PALET.far) : null,
    eyeliner: kadin && w(0.4) ? pick(['ince', 'kanat']) : 'yok', kirpik: kadin && w(0.6),
    allik: kadin ? pick([0.2, 0.3, 0.42]) : pick([0, 0.12, 0.2]), allikRenk: pick(PALET.allik),
  };
  if (d.ustStil === 'dress') d.altStil = 'skirt';
  return d;
}
