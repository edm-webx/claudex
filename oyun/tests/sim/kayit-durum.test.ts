// KAL-01: kayıt durum makinesi sahte taşıyıcı ve sahte saatle: başarı, hata, üstel geri çekilme, çevrimdışı -> bağlanma, rozet metinleri.
import { describe, it, expect } from 'vitest';
import { createKayitDurum, beklemeMs, rozetMetni, type KayitDurumu } from '../../src/game/net/kayit-durum';

function kur(sonuclar: (boolean | 'at')[]) {
  let t = 1_000_000, online = true, cagri = 0;
  const kuyruk: { at: number; fn: () => void; id: number }[] = [];
  let sid = 0;
  const kd = createKayitDurum({
    gonder: async () => { const s = sonuclar[Math.min(cagri++, sonuclar.length - 1)]; if (s === 'at') throw new Error('ağ'); return s; },
    simdi: () => t, cevrimici: () => online,
    zamanla: (fn, ms) => { const id = ++sid; kuyruk.push({ at: t + ms, fn, id }); return id; },
    iptal: h => { const i = kuyruk.findIndex(k => k.id === h); if (i >= 0) kuyruk.splice(i, 1); },
    saatMetni: () => '14:02',
  });
  const gecir = async (ms: number) => { t += ms; for (;;) { const i = kuyruk.findIndex(k => k.at <= t); if (i < 0) break; const [k] = kuyruk.splice(i, 1); k.fn(); await Promise.resolve(); await Promise.resolve(); } };
  const bekle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
  return { kd, gecir, bekle, ag: (v: boolean) => { online = v; }, cagri: () => cagri, bekleyen: () => kuyruk.length, ilerle: (ms: number) => { t += ms; } };
}

describe('kayit-durum', () => {
  it('başarı: bekliyor -> tamam, "Kaydedildi 14:02" yalnız onaydan sonra', async () => {
    const k = kur([true]); const hep: KayitDurumu[] = [];
    k.kd.abone(g => hep.push(g.durum));
    k.kd.istek();
    expect(k.kd.gorunum().metin).toBe('Kaydediliyor...');   // onay gelmeden "Kaydedildi" denmez
    await k.bekle();
    expect(k.kd.durum()).toBe('tamam'); expect(k.kd.gorunum().metin).toBe('Kaydedildi 14:02');
    expect(hep).toEqual(['bos', 'bekliyor', 'tamam']);
  });
  it('hata: Kaydedilemedi + üstel geri çekilme (5, 10, 20, 40, 80, 120 sn) ve sonunda başarı', async () => {
    const k = kur([false, 'at', false, true]);
    k.kd.istek(); await k.bekle();
    expect(k.kd.durum()).toBe('hata'); expect(k.kd.gorunum().metin).toBe('Kaydedilemedi, tekrar deniyorum'); expect(k.kd.gorunum().sonrakiMs).toBe(5000);
    await k.gecir(4000); expect(k.cagri()).toBe(1);   // süre dolmadan deneme yok
    await k.gecir(1000); await k.bekle(); expect(k.cagri()).toBe(2); expect(k.kd.gorunum().sonrakiMs).toBe(10000);
    await k.gecir(10000); await k.bekle(); expect(k.cagri()).toBe(3); expect(k.kd.gorunum().sonrakiMs).toBe(20000);
    await k.gecir(20000); await k.bekle(); expect(k.cagri()).toBe(4);
    expect(k.kd.durum()).toBe('tamam'); expect(k.bekleyen()).toBe(0);
    expect([1, 2, 3, 4, 5, 6, 9].map(beklemeMs)).toEqual([5000, 10000, 20000, 40000, 80000, 120000, 120000]);
  });
  it('çevrimdışı: gönderme denenmez, ağ gelince hemen gider', async () => {
    const k = kur([true]); k.ag(false);
    k.kd.istek(); await k.bekle();
    expect(k.kd.durum()).toBe('cevrimdisi'); expect(k.cagri()).toBe(0); expect(k.kd.gorunum().metin).toContain('Bağlantı yok');
    k.ag(true); k.kd.baglandi(); await k.bekle();
    expect(k.kd.durum()).toBe('tamam'); expect(k.cagri()).toBe(1);
  });
  it('gönderim sırasında ağ kopar: çevrimdışı, ağ gelince tekrar denenir; bekleyen zamanlayıcı kalmaz', async () => {
    const k = kur([false, true]);
    const p = k.kd.simdiKaydet(); k.ag(false); await p; await k.bekle();
    expect(k.kd.durum()).toBe('cevrimdisi'); expect(k.bekleyen()).toBe(0);
    k.ag(true); k.kd.baglandi(); await k.bekle(); expect(k.kd.durum()).toBe('tamam');
  });
  it('gönderirken gelen yeni istek bir tur daha gönderir (iki gönderim birleşmez ama değişiklik kaybolmaz)', async () => {
    const k = kur([true, true]);
    k.kd.istek(); k.kd.istek(); k.kd.istek(); await k.bekle(); await k.bekle();
    expect(k.cagri()).toBe(2); expect(k.kd.durum()).toBe('tamam');
  });
  it('simdiKaydet geri çekilmeyi atlar; yeni sürüm kaydında salt-okunur, gönderilmez', async () => {
    const k = kur([false, true]);
    k.kd.istek(); await k.bekle(); expect(k.kd.durum()).toBe('hata');
    await k.kd.simdiKaydet(); await k.bekle(); expect(k.kd.durum()).toBe('tamam'); expect(k.bekleyen()).toBe(0);
    k.kd.saltOkunur(); k.kd.istek(); await k.bekle(); expect(k.cagri()).toBe(2); expect(k.kd.gorunum().metin).toContain('yeni');
  });
  it('rozet metinleri', () => {
    expect(rozetMetni('bos', 0)).toBe(''); expect(rozetMetni('tamam', 5, () => '09:05')).toBe('Kaydedildi 09:05');
  });
});
