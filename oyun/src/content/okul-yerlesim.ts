/**
 * Martıköy İlkokulu odalarının eşya yerleşimi (2026-11-28, content/okul-ic.ts planı). Kapı çerçevesinde (content/ic-mekan.ts): u kapı duvarı
 * boyunca, v içeri doğru, kapı v = +D/2 (koridor), arka duvar v = -D/2 (ön sırada cephe, arka sırada bahçe; pencereler orada).
 * Katı eşyalar (solid) çarpışır; duvar eşyaları (çerçeve, pano, tahta) katı değil. Kantin (k4) aletleri `esya` ile, alınınca görünür.
 */
import type { IcItem } from './ic-mekan';
import { OKUL_ODA_BY_ID } from './okul-ic';

const it = (k: string, u: number, v: number, w: number, d: number, o: Partial<IcItem> = {}): IcItem => ({ k, u, v, w, d, ...o });
const S = { solid: true };

/** sınıfın ön duvarı (arka duvar, v = -D/2): tahta, üstünde Atatürk portresi, iki yanda İstiklal Marşı ve Gençliğe Hitabe; öğretmen masası */
function onDuvar(W: number, D: number, tahtaW: number): IcItem[] {
  const bw = -D / 2 + 0.16, kenar = Math.min(W / 2 - 0.8, tahtaW / 2 + 0.75);
  return [it('tahta', 0, bw, tahtaW, 0.1, { y: 1.5 }), it('portre', 0, bw - 0.04, 0.62, 0.05),
    it('cerceve', -kenar, bw - 0.04, 0.7, 0.05, { txt: 'İSTİKLAL MARŞI' }), it('cerceve', kenar, bw - 0.04, 0.7, 0.05, { txt: 'GENÇLİĞE HİTABE' }),
    it('ogretmen', -tahtaW / 2 + 0.4, -D / 2 + 1.45, 1.4, 0.7, S), it('ogrSandalye', -tahtaW / 2 + 0.4, -D / 2 + 0.85, 0.5, 0.5),
    it('bayrakIc', W / 2 - 0.55, -D / 2 + 0.5, 0.5, 0.5, S)];
}
/** sınıf sıraları: kolon u'ları ve sıra v'leri (sıranın masa yüzü; öğrenci v + 0.45'te, tahtaya bakar) */
export function sinifSiralar(W: number): { cols: number[]; rows: number[] } {
  return { cols: W >= 7.5 ? [-2.5, 0, 2.5] : [-1.35, 1.35], rows: [-1.9, -0.5, 0.9, 2.3] };
}
function sinif(W: number, D: number, ingilizce: boolean): IcItem[] {
  const o = onDuvar(W, D, W >= 7.5 ? 3.6 : 3.0), { cols, rows } = sinifSiralar(W);
  for (const v of rows) for (const u of cols) o.push(it('sira', u, v, 1.1, 0.55, S));
  o.push(it('dolap', -W / 2 + 1.35, D / 2 - 0.35, 2.0, 0.45, { solid: true, ry: 2 }), it('cop', W / 2 - 0.5, D / 2 - 0.5, 0.35, 0.35),
    it('pano', -W / 2 + 0.06, 0.3, 2.4, 0.06, { ry: 1, y: 1.55, txt: ingilizce ? 'ENGLISH CORNER' : 'ÇALIŞMALARIMIZ' }),
    it('harita', W / 2 - 0.06, 0.3, 2.2, 0.05, { ry: 3, txt: ingilizce ? 'WORLD' : 'TÜRKİYE' }),
    it('saat', W / 2 - 1.2, -D / 2 + 0.1, 0.4, 0.05),
    it('saksi', -W / 2 + 0.45, -D / 2 + 0.45, 0.5, 0.5));
  if (ingilizce) o.push(it('dunya', -1.2, -D / 2 + 1.45, 0.3, 0.3, { y: 0.76 }));
  return o;
}

const LAYOUT: Record<string, (W: number, D: number) => IcItem[]> = {
  okul_mudur: (W, D) => [
    it('mudurMasa', 0, -D / 2 + 1.55, 2.2, 0.95, S), it('portre', 0, -D / 2 + 0.12, 0.8, 0.05, { y: 2.0 }),
    it('bayrakIc', -1.55, -D / 2 + 0.55, 0.5, 0.5, S), it('bayrakIc', 1.55, -D / 2 + 0.55, 0.5, 0.5, { solid: true, c: 'okul' }),
    it('misafirKoltuk', -0.6, -D / 2 + 2.75, 0.6, 0.6, { solid: true, ry: 2 }), it('misafirKoltuk', 0.6, -D / 2 + 2.75, 0.6, 0.6, { solid: true, ry: 2 }),
    it('dosyaDolap', -W / 2 + 0.3, -1.2, 2.2, 0.5, { solid: true, ry: 1 }), it('kitaplik', W / 2 - 0.25, -1.4, 2.0, 0.4, { solid: true, ry: 3 }),
    it('koltuk', W / 2 - 1.0, 1.6, 1.6, 1.6, { ry: 3 }), it('kupaDolap', -W / 2 + 0.3, 1.5, 1.4, 0.45, { solid: true, ry: 1 }),
    it('saksiB', -W / 2 + 0.5, D / 2 - 0.55, 0.6, 0.6), it('saat', 2.6, -D / 2 + 0.1, 0.4, 0.05), it('hali', 0, -0.3, 3.4, 2.4)],
  okul_sekreter: (W, D) => [
    it('sekreterMasa', -0.9, -0.2, 1.6, 0.75, { solid: true, txt: 'SEKRETER' }), it('sekreterMasa', 1.4, -D / 2 + 1.3, 1.6, 0.75, { solid: true, txt: 'MÜDÜR YRD.' }),
    it('dosyaDolap', -1.5, -D / 2 + 0.3, 2.4, 0.5, S), it('fotokopi', W / 2 - 0.55, 1.2, 0.9, 0.7, S),
    it('pano', -W / 2 + 0.06, 0.6, 2.2, 0.06, { ry: 1, y: 1.55, txt: 'DUYURULAR' }), it('bekleme', -W / 2 + 0.4, 2.1, 1.6, 0.5, { solid: true, ry: 1 }),
    it('saat', 0.6, -D / 2 + 0.1, 0.4, 0.05), it('saksi', W / 2 - 0.45, -D / 2 + 0.45, 0.5, 0.5)],
  okul_ogretmen: (W, D) => [
    it('toplantiMasa', -0.4, -0.3, 3.6, 1.2, S),
    it('cayOcak', W / 2 - 0.35, -1.2, 1.8, 0.6, { solid: true, ry: 3 }), it('dolap', -1.2, -D / 2 + 0.3, 3.2, 0.45, S),
    it('pano', -W / 2 + 0.06, 0.4, 2.4, 0.06, { ry: 1, y: 1.55, txt: 'NÖBET ÇİZELGESİ' }), it('portre', 1.6, -D / 2 + 0.12, 0.6, 0.05, { y: 2.0 }),
    it('koltuk', W / 2 - 1.0, 1.9, 1.6, 1.6, { ry: 3 }), it('saksiB', -W / 2 + 0.5, D / 2 - 0.55, 0.6, 0.6), it('saat', 2.6, -D / 2 + 0.1, 0.4, 0.05)],
  okul_revir: (W, D) => [
    it('yatak', -W / 2 + 0.75, -D / 2 + 1.35, 0.9, 1.9, S), it('perde', -W / 2 + 1.45, -D / 2 + 1.35, 0.06, 2.0),
    it('ilac', 1.25, -D / 2 + 0.3, 1.3, 0.4, S), it('sekreterMasa', W / 2 - 0.85, 0.7, 1.3, 0.7, { solid: true, ry: 3, txt: 'HEMŞİRE' }),
    it('boyOlcer', -W / 2 + 0.06, 1.3, 0.5, 0.05, { ry: 1 }), it('lavabo', 0.2, -D / 2 + 0.3, 0.6, 0.45, S),
    it('pano', W / 2 - 0.06, -1.3, 1.6, 0.06, { ry: 3, y: 1.55, txt: 'SAĞLIKLI BESLENME' }), it('bekleme', -W / 2 + 0.4, 2.2, 1.4, 0.5, { solid: true, ry: 1 })],
  okul_fen: (W, D) => [
    it('labMasa', -1.9, -0.9, 3.0, 1.0, S), it('labMasa', 1.9, -0.9, 3.0, 1.0, S), it('labMasa', -1.9, 1.3, 3.0, 1.0, S), it('labMasa', 1.9, 1.3, 3.0, 1.0, S),
    it('deneyMasa', 0, -D / 2 + 0.55, 2.6, 0.7, S), it('periyodik', 0, -D / 2 + 0.12, 2.6, 0.05),
    it('iskelet', -W / 2 + 0.55, -D / 2 + 0.6, 0.6, 0.6, S), it('dunya', W / 2 - 0.55, -D / 2 + 0.55, 0.45, 0.45, { y: 0.0, c: 'ayak' }),
    it('yanginTup', W / 2 - 0.12, 2.2, 0.25, 0.2), it('lavabo', -W / 2 + 0.35, 2.45, 0.6, 0.45, { solid: true, ry: 1 }),
    it('pano', W / 2 - 0.06, 0.3, 2.0, 0.06, { ry: 3, y: 1.55, txt: 'GÜNEŞ SİSTEMİ' })],
  okul_kutuphane: (W, D) => [
    it('kitaplik', -2.0, -D / 2 + 0.25, 3.4, 0.4, S), it('kitaplik', 2.0, -D / 2 + 0.25, 3.4, 0.4, S),
    it('kitaplik', -W / 2 + 0.25, 0.2, 2.6, 0.4, { solid: true, ry: 1 }), it('kitaplik', W / 2 - 0.25, -0.4, 2.2, 0.4, { solid: true, ry: 3 }),
    it('okumaMasa', -1.5, 0.0, 1.8, 0.9, S), it('okumaMasa', 1.5, 0.0, 1.8, 0.9, S),
    it('sekreterMasa', W / 2 - 1.3, D / 2 - 1.1, 1.5, 0.7, { solid: true, ry: 2, txt: 'ÖDÜNÇ' }), it('okuma', -W / 2 + 1.2, D / 2 - 1.0, 1.1, 0.9),
    it('pano', 0, -D / 2 + 0.1, 1.2, 0.06, { y: 2.45, txt: 'AYIN KİTABI' }), it('saksiB', W / 2 - 0.5, 1.6, 0.6, 0.6)],
  okul_1a: (W, D) => sinif(W, D, false),
  okul_2a: (W, D) => sinif(W, D, false),
  okul: (W, D) => sinif(W, D, true),
  okul_4a: (W, D) => sinif(W, D, false),
  okul_muzik: (W, D) => [
    it('piyano', -W / 2 + 1.2, -D / 2 + 1.0, 1.4, 1.1, S), it('davul', W / 2 - 1.2, -D / 2 + 1.0, 1.4, 1.2, S),
    it('tahta', 0, -D / 2 + 0.16, 2.8, 0.1, { y: 1.5, c: 'nota' }), it('portre', 0, -D / 2 + 0.12, 0.6, 0.05),
    it('enstrumanDuvar', -W / 2 + 0.06, -0.6, 2.6, 0.06, { ry: 1 }), it('resimPano', W / 2 - 0.06, -0.6, 2.6, 0.06, { ry: 3 }),
    it('sehpa', -2.6, 2.2, 0.7, 0.6, { solid: true, ry: 2 }), it('sehpa', 0, 2.6, 0.7, 0.6, { solid: true, ry: 2 }), it('sehpa', 2.6, 2.2, 0.7, 0.6, { solid: true, ry: 2 }),
    it('resimMasa', 0, 0.3, 2.6, 1.2, S), it('saksi', W / 2 - 0.45, D / 2 - 0.5, 0.5, 0.5)],
  // kantin (işletme k4): eski okul odasının doğu yarısındaki yerleşim, aynı alet kimlikleri (alınmış aletler kaybolmaz)
  okul_kantin: (W, D) => {
    const bv = -D / 2 + 1.95;
    return [it('tezgah', -0.2, bv, 4.6, 0.7, { solid: true, c: '#e0533c' }), it('rafArka', -1.05, -D / 2 + 0.25 + 0.18, 2.9, 0.36), it('icecekDolap', 0.9, -D / 2 + 0.25 + 0.3, 0.8, 0.55), it('kasa', 1.5, bv, 0.4, 0.4, { y: 1.05 }),
      it('menuPano', -0.2, -D / 2 + 0.27, 2.6, 0.05, { y: 2.2, txt: 'KANTİN' }),
      it('tostMak', -1.4, bv, 0.5, 0.4, { esya: 'tost_mak', y: 1.05 }), it('buzdolap', 3.1, -D / 2 + 0.5, 0.9, 0.7, { esya: 'buzdolap' }),
      it('semaver', 0.0, bv, 0.4, 0.4, { esya: 'semaver_k', y: 1.05 }), it('firinK', -3.0, -D / 2 + 0.5, 0.9, 0.7, { esya: 'mikrodalga' }),
      it('meyve', 3.0, -0.4, 0.9, 0.7, { esya: 'meyve' }), it('masaK', -2.0, 1.2, 1.6, 0.8, { esya: 'masa_k' }), it('masaK', 1.8, 1.2, 1.6, 0.8, { esya: 'masa_k' }),
      it('ekran', -0.2, -D / 2 + 0.2, 1.4, 0.08, { esya: 'ekran_k', y: 2.0 }), it('izgara', 1.9, -D / 2 + 0.55, 0.9, 0.6, { esya: 'izgara_k' }),
      it('pano', -W / 2 + 0.06, 2.4, 2.0, 0.06, { ry: 1, y: 1.55, txt: 'SAĞLIKLI BESLENME' }), it('cop', W / 2 - 0.5, D / 2 - 0.6, 0.35, 0.35)];
  },
};
/** okul odasının yerleşimi (content/ic-mekan.ts icLayout okulIc dalı) */
export function okulOdaLayout(id: string, W: number, D: number): IcItem[] {
  const f = OKUL_ODA_BY_ID[id] ? LAYOUT[id] : undefined; return f ? f(W, D) : [];
}
