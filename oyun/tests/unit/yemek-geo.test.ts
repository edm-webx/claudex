// 2026-11-25 ürün görseli: her mutfak yemeği ve dükkân kalemi kendi modeline sahip, model bütçede, ayırt edilebilir.
import { describe, it, expect } from 'vitest';
import { Batch } from '../../src/engine/prefab/batch';
import { yemekInto, yemekVar, YEMEK_IDS } from '../../src/content/prefabs/yemek/yemek-geo';
import { DISHES } from '../../src/content/yemek-menu';
import { KALEM } from '../../src/content/isletme-istasyon';

const tri = (id: string) => { const b = new Batch(); const h = yemekInto(b, id); return { h, t: b.i.length / 3, b }; };
describe('ürün modelleri', () => {
  it('her mutfak yemeğinin ve her dükkân kaleminin tarifi var', () => {
    const eksik = [...DISHES.map(d => d.id), ...Object.keys(KALEM)].filter(id => !yemekVar(id));
    expect(eksik).toEqual([]);
  });
  it('her model boş değil, üst yüksekliği makul, üçgen bütçesi 2500 altında', () => {
    for (const id of YEMEK_IDS) { const { h, t } = tri(id); expect(t, id).toBeGreaterThan(20); expect(t, id).toBeLessThan(2500); expect(h, id).toBeGreaterThan(0.01); expect(h, id).toBeLessThan(0.3); }
  });
  it('farklı tarifler farklı geometri üretir (aynı ad aynı yemek dışında)', () => {
    const imza = new Map<string, string[]>();
    for (const id of YEMEK_IDS) { const { b } = tri(id); let hc = 0; for (let i = 0; i < b.c.length; i++) hc = (hc * 31 + Math.round(b.c[i] * 255) + Math.round(b.p[i] * 1000)) | 0; const k = b.p.length + ':' + hc; imza.set(k, [...(imza.get(k) || []), id]); }
    const ayni = [...imza.values()].filter(v => v.length > 1).map(v => v.join('='));
    // bilerek paylaşılan tarifler (aynı ürün farklı dükkânda)
    const IZIN = ['kola=kolaz=d_kolaz', 'soda=d_soda', 'gazoz=d_gazoz=gazoz_t', 'serpme_kahvalti=serpme', 'mercimek_corbasi=mercimek', 'iskender=dayi_iskender', 'izgara_kofte=kofte', 'kofte_k=kofte_t', 'limonata=limonata_k', 'kunefe=kunefe_b', 'citir_patates=patates_kizartma', 'karisik_kumpir=kumpir=kumpir_t'];
    expect(ayni.filter(a => !IZIN.includes(a))).toEqual([]);
  });
});
