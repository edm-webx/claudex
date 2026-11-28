// KAL-15 kırmızı çizgi bekçisi: sahibin "hayır" dediği şeyler kodda geri gelirse test kırılır.
// Kurallar tests/kirmizi-cizgiler.json içinde (tek satırla yeni yasak eklenir); bilinen ihlal listesi sıfıra indirilmeli.
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, mkdtempSync, readFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// @ts-expect-error saf .mjs araç, tipi yok
import { tara, kurallar } from '../../tools/kirmizi-tara.mjs';

type Sonuc = { kural: { id: string; alinti: string; tarih: string; siddet?: string; not?: string }; hits: { dosya: string; satir: number; parca: string }[]; yeni: string[]; bayat: string[] };
const sonuclar: Sonuc[] = tara();

describe('kırmızı çizgi bekçisi', () => {
  it('kural dosyası geçerli: her kuralın alıntısı, tarihi ve kimliği var, kimlikler tekil', () => {
    const R = kurallar().kurallar as Sonuc['kural'][];
    expect(R.length).toBeGreaterThan(10);
    expect(new Set(R.map(r => r.id)).size).toBe(R.length);
    for (const r of R) { expect(r.alinti, r.id).toBeTruthy(); expect(r.tarih === '' || /^\d{4}-\d{2}-\d{2}$/.test(r.tarih), r.id).toBe(true); }
  });
  for (const s of sonuclar.filter(x => x.kural.siddet !== 'uyari')) {
    it(`${s.kural.id}: bilinen ihlal listesinde olmayan yeni ihlal yok`, () => {
      expect(s.yeni, `"${s.kural.alinti}" (${s.kural.tarih}) çizgisi çiğnendi. Yeni ihlal:\n` + s.hits.filter(h => s.yeni.some(y => y.startsWith(h.dosya + ':'))).map(h => `  ${h.dosya}:${h.satir} ${h.parca}`).join('\n')).toEqual([]);
    });
  }
  it('bilinen ihlal listesi bayatlamamış (düzeltilen ihlal listeden silinmeli; bayatlık yalnız uyarı)', () => {
    const bayat = sonuclar.flatMap(s => s.bayat.map(b => `${s.kural.id} -> ${b}`));
    if (bayat.length) console.warn('kirmizi-cizgiler.json bilinen listesi küçülebilir:\n  ' + bayat.join('\n  '));
    expect(true).toBe(true);
  });
  it('çelişkili (uyarı) kurallar yalnız raporlanır, test kırmazsa da sayıları görünür', () => {
    for (const s of sonuclar.filter(x => x.kural.siddet === 'uyari')) console.warn(`[uyarı ${s.kural.id}] ${s.hits.length} yerde: ${s.kural.not ?? ''}`);
    expect(true).toBe(true);
  });
  it('kasıtlı enjeksiyon: bir toast metnine "stok" yazılınca bekçi kırmızı verir, yorum ve kimlik-dışı geçişler sayılmaz', () => {
    const kok = mkdtempSync(join(tmpdir(), 'kirmizi-'));
    mkdirSync(join(kok, 'tests'), { recursive: true }); mkdirSync(join(kok, 'src/game/ui'), { recursive: true });
    cpSync(join(process.cwd(), 'tests/kirmizi-cizgiler.json'), join(kok, 'tests/kirmizi-cizgiler.json'));
    const yaz = (t: string) => writeFileSync(join(kok, 'src/game/ui/deneme.ts'), t);
    yaz("// yorumda stok olması serbest\nexport const a = 'stok'; export const b = 'kapalı'; // sadece kimlik, boşluksuz\n");
    const temiz = (tara(kok) as Sonuc[]).find(s => s.kural.id === 'stok-metin')!;
    expect(temiz.yeni).toEqual([]);
    yaz("export const t = () => toast('Stok bitti, yenisini al');\n");
    const kirli = (tara(kok) as Sonuc[]).find(s => s.kural.id === 'stok-metin')!;
    expect(kirli.yeni.length).toBe(1);
    expect(kirli.hits[0].parca).toContain('Stok bitti');
    yaz('export const stokMax = 5;\n');
    expect((tara(kok) as Sonuc[]).find(s => s.kural.id === 'stok-kimlik')!.yeni.length).toBe(1);
    mkdirSync(join(kok, 'src/content'), { recursive: true }); writeFileSync(join(kok, 'src/content/dukkanlar.ts'), 'export const x = 1;\n');
    expect((tara(kok) as Sonuc[]).find(s => s.kural.id === 'zincir-dosya')!.yeni.length).toBe(1);
    void readFileSync;
  });
});
