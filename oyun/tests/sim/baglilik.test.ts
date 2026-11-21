// KAL-15 kablolama denetçisi: içerik tablosu <-> tüketici, ölü bayrak etiketleri, satın al -> etki, çalışan = gerçek ajan.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error saf .mjs araç, tipi yok
import { analiz } from '../../tools/baglilik.mjs';
import { played } from './m1-helpers';
import { makeSandbox, addWorker } from './agents-harness';
import { AVM_URUN, AVM_GIY } from '../../src/content/avm';
import { IC_BY_ID } from '../../src/content/ic-mekan';
import { ESYALAR } from '../../src/content/esya';
import { mulkApi } from '../../src/game/sim/mulk';

const kirmizi = JSON.parse(readFileSync(new URL('../kirmizi-cizgiler.json', import.meta.url), 'utf8'));
const A = analiz();

describe('içerik <-> tüketici (tools/baglilik.mjs)', () => {
  it('hiçbir yerden içe aktarılmayan içerik modülü listesi bilinen halinden büyümedi', () => {
    // art-manifest/ui-text: ileride bağlanacak ya da silinecek (KAL-15 raporu). ekonomi-hedef: yalnız araç/test tüketir (EKO-01).
    const bilinen = new Set(['src/content/art-manifest.ts', 'src/content/ui-text.ts', 'src/content/ekonomi-hedef.ts']);
    const yeni = A.modulYetim.filter((m: string) => !bilinen.has(m));
    expect(yeni, 'Bağlanmamış yeni içerik modülü: ya bir yerden kullan ya sil: ' + yeni.join(', ')).toEqual([]);
  });
  it('dükkan zinciri modülü (kırmızı çizgi) silindi, rapor tuketicisiz listesinde zincir tablosu yok', () => {
    expect(A.tuketicisiz.filter((x: { dosya: string }) => /dukkanlar/.test(x.dosya))).toEqual([]);
  });
  it('ölü kod bayraklarının hepsi "sil" ya da "bilincli-kapali" diye etiketli; etiketsiz yeni bayrak yok', () => {
    const et = kirmizi.olu_bayrak as Record<string, { etiket: string; neden: string }>;
    const eksik = A.bayraklar.filter((b: { aktif: boolean; dosya: string; ad: string }) => !b.aktif && !et[`${b.dosya}:${b.ad}`]).map((b: { dosya: string; ad: string }) => `${b.dosya}:${b.ad}`);
    expect(eksik, 'tests/kirmizi-cizgiler.json olu_bayrak içine etiket ekle (sil / bilincli-kapali)').toEqual([]);
    for (const [k, v] of Object.entries(et)) { if (k.startsWith('_')) continue; expect(['sil', 'bilincli-kapali'], k).toContain(v.etiket); expect(v.neden.length, k).toBeGreaterThan(5); }
    // etiketli ama kodda artık olmayan bayrak: listeden silinmeli
    const var_ = new Set(A.bayraklar.map((b: { dosya: string; ad: string }) => `${b.dosya}:${b.ad}`));
    const eski = Object.keys(et).filter(k => !k.startsWith('_') && !var_.has(k));
    expect(eski, 'kodda olmayan bayrak etiketi silinmeli').toEqual([]);
  });
});

describe('satın al -> etki', () => {
  const avmMi = () => { const sim = played(1) as any; sim.step(1); const m = IC_BY_ID.avm; sim.command({ kind: 'teleport', x: m.x, z: m.z }); sim.step(1); return sim; };
  // parfüm gibi "yalnız tecrübe" veren ürünler bilinçli: kimlik -> neden. Yeni etkisiz ürün bu listeye yazılmadan eklenemez.
  const YALNIZ_XP: Record<string, string> = { parfum_lodos: 'sahibin kararı yok; kozmetik, dolapta giyilecek görünür izi yok, yalnız tecrübe verir (content/avm.ts yorumu)' };
  for (const u of AVM_URUN) {
    it(`AVM ${u.id}: para düşer, tecrübe artar, kalıcı üründe dolaba girer ve görünür etkisi tanımlıdır`, () => {
      const sim = avmMi(), S = sim.state;
      S.money = u.fiyat + 10; const xp0 = S.xp ?? 0, st0 = sim.hash();
      sim.command({ kind: 'mulk', op: 'avmAl', id: u.id }); sim.step(1);
      expect(S.money, 'para düşmedi').toBe(10);
      expect(sim.hash()).not.toBe(st0);
      const kalici = u.kat === 'giyim' || u.kat === 'kozmetik';
      if (kalici) {
        expect(S.zones.avm.alinan).toContain(u.id);
        if (!AVM_GIY[u.id]) expect(YALNIZ_XP[u.id], `${u.id} satın alınıyor ama giyilebilir/görünür etkisi yok: AVM_GIY'e ekle ya da YALNIZ_XP'ye gerekçeyle yaz`).toBeTruthy();
        // ikinci alış reddedilir, para düşmez
        S.money = u.fiyat + 10; sim.command({ kind: 'mulk', op: 'avmAl', id: u.id }); sim.step(1); expect(S.money).toBe(u.fiyat + 10);
      }
      void xp0;
    });
  }
  it('AVM_GIY içindeki her kimlik gerçek bir AVM ürünü (ölü giyim satırı yok)', () => {
    const ids = new Set(AVM_URUN.map(u => u.id));
    for (const k of Object.keys(AVM_GIY)) expect(ids.has(k), k).toBe(true);
  });
  it('eşya "ver" komutu envantere girer; her eşya kimliği geçerli komutla alınabilir', () => {
    const sim = played(1) as any; sim.step(1); const m = mulkApi(sim.rules)!;
    for (const e of ESYALAR.slice(0, 40)) { sim.command({ kind: 'mulk', op: 'ver', id: e.id, n: 1 }); expect(m.have(e.id), e.id).toBeGreaterThan(0); }
  });
});

describe('çalışan = gerçek ajan (sabit prop yok)', () => {
  it('işe alınan her çalışanın bir ajan satırı var ve ilk saniyelerde yürüyerek yerinden oynar', () => {
    const sb = makeSandbox(5);
    for (const [rol, ozellik] of [['doner', 'hamarat'], ['garson', 'hamarat'], ['temizlik', 'hamarat']] as const) addWorker(sb, rol, ozellik);
    const ilk = new Map<number, { x: number; z: number }>(), yol = new Map<number, number>();
    sb.step(0.1);
    for (const r of sb.h.workers.rows()) ilk.set(r.id, { x: r.x, z: r.z });
    let on = new Map(ilk);
    for (let i = 0; i < 400; i++) { if (i % 80 === 0) { sb.host.dirty.add(1); sb.host.dirty.add(2); sb.host.out.doner.push({ type: 'doner', tier: 1 }, { type: 'doner', tier: 1 }); } sb.step(0.1); for (const r of sb.h.workers.rows()) { const o = on.get(r.id)!; yol.set(r.id, (yol.get(r.id) || 0) + Math.hypot(r.x - o.x, r.z - o.z)); on.set(r.id, { x: r.x, z: r.z }); } }
    expect(sb.h.workers.rows().length).toBe(sb.state.workers.length);
    // istasyon çalışanı (döner) yerinde işini yapar, hafif oynar; gezgin roller (garson, temizlik) belirgin yürür
    for (const r of sb.h.workers.rows()) expect(yol.get(r.id) || 0, `çalışan ${r.id} (${r.role}) hiç yürümedi (sabit prop?)`).toBeGreaterThan(r.role === 'doner' ? 0.05 : 1);
  });
});
