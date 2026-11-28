/**
 * KAL-01: bulut kaydı durum makinesi. Kayıt asla sessizce kaybolmaz: her istek bir sonuç alır, hata olursa üstel
 * geri çekilmeyle yeniden denenir, bağlantı geri gelince hemen denenir. Rozet YALNIZ sunucudan onay gelince "Kaydedildi" der.
 * Pure: taşıyıcı, saat ve zamanlayıcı dışarıdan gelir (sahte taşıyıcıyla testlenir); DOM ve supabase yok.
 *   bos -> bekliyor -> tamam | hata (yeniden dener) | cevrimdisi (bağlanınca dener) ; salt: yeni sürüm kaydı var, yazılmaz.
 */
export type KayitDurumu = 'bos' | 'bekliyor' | 'tamam' | 'hata' | 'cevrimdisi' | 'salt';
export interface KayitGorunum { durum: KayitDurumu; metin: string; sonOk: number; deneme: number; sonrakiMs: number }
export interface KayitOpts {
  /** true = sunucu onayladı. Fırlatırsa ya da false dönerse başarısız sayılır. */
  gonder(): Promise<boolean>;
  simdi(): number;
  cevrimici(): boolean;
  zamanla(fn: () => void, ms: number): unknown;
  iptal(h: unknown): void;
  /** Saat metni için (yerel saat, "14:02"). */
  saatMetni?(ms: number): string;
}
export const GERI_CEKILME_MS = [5_000, 10_000, 20_000, 40_000, 80_000, 120_000] as const;
/** deneme sayısına göre bekleme süresi (1. başarısızlık 5 sn, en çok 2 dk) */
export const beklemeMs = (deneme: number): number => GERI_CEKILME_MS[Math.min(GERI_CEKILME_MS.length - 1, Math.max(0, deneme - 1))];

const pad = (n: number) => (n < 10 ? '0' : '') + n;
const saatVarsayilan = (ms: number) => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };

export function rozetMetni(durum: KayitDurumu, sonOk: number, saat: (ms: number) => string = saatVarsayilan, saltMetin = ''): string {
  switch (durum) {
    case 'bos': return sonOk ? 'Kaydedildi ' + saat(sonOk) : '';
    case 'bekliyor': return 'Kaydediliyor...';
    case 'tamam': return 'Kaydedildi ' + saat(sonOk);
    case 'hata': return 'Kaydedilemedi, tekrar deniyorum';
    case 'cevrimdisi': return 'Bağlantı yok: bu cihazda saklandı, bağlanınca buluta gidecek';
    case 'salt': return saltMetin || 'Bu kayıt daha yeni bir sürümden, sayfayı yenile';
  }
}

export function createKayitDurum(o: KayitOpts) {
  let durum: KayitDurumu = 'bos', sonOk = 0, deneme = 0, sonraki = 0;
  let timer: unknown = null, ucta = false, tekrar = false, saltMetin = '';
  const subs = new Set<(g: KayitGorunum) => void>();
  const saat = o.saatMetni || saatVarsayilan;
  const gorunum = (): KayitGorunum => ({ durum, metin: rozetMetni(durum, sonOk, saat, saltMetin), sonOk, deneme, sonrakiMs: sonraki });
  const yay = () => { const g = gorunum(); subs.forEach(cb => { try { cb(g); } catch { /* */ } }); };
  const dur = (yeni: KayitDurumu) => { durum = yeni; yay(); };
  const zamanlaTekrar = () => {
    if (timer != null) o.iptal(timer);
    sonraki = beklemeMs(deneme);
    timer = o.zamanla(() => { timer = null; void gonder(); }, sonraki);
  };

  async function gonder(): Promise<void> {
    if (durum === 'salt') return;
    if (ucta) { tekrar = true; return; }
    if (timer != null) { o.iptal(timer); timer = null; }
    if (!o.cevrimici()) { deneme = Math.max(1, deneme); dur('cevrimdisi'); return; }   // 'online' olayı baglandi() ile tetikler
    ucta = true; dur('bekliyor');
    let ok = false;
    try { ok = await o.gonder(); } catch { ok = false; }
    ucta = false;
    if ((durum as KayitDurumu) === 'salt') return;   // gönderim sırasında kilitlendi (çakışma / sürüm): yeniden deneme yok
    if (ok) {
      deneme = 0; sonraki = 0; sonOk = o.simdi();
      if (tekrar) { tekrar = false; dur('tamam'); void gonder(); return; }   // gönderirken yeni değişiklik olduysa bir tur daha
      dur('tamam');
    } else {
      tekrar = false; deneme++;
      dur(o.cevrimici() ? 'hata' : 'cevrimdisi');
      if (o.cevrimici()) zamanlaTekrar();
    }
  }
  return {
    /** Yeni durum kaydedilmeli: hemen gönderir (süre sınırlaması çağıranın işi: dakikada bir vb.). */
    istek(): void { void gonder(); },
    /** Ayarlardaki "şimdi kaydet": bekleyen geri çekilmeyi atlar. */
    simdiKaydet(): Promise<void> { deneme = 0; return gonder(); },
    /** online / visibilitychange(visible): bekleyen hata ya da çevrimdışı varsa hemen dener. */
    baglandi(): void { if (durum === 'hata' || durum === 'cevrimdisi') { deneme = 0; void gonder(); } },
    /** Yazım kilidi: rozet `metin` gösterir (yoksa yeni sürüm metni), bir daha göndermez. */
    saltOkunur(metin = ''): void { if (timer != null) { o.iptal(timer); timer = null; } saltMetin = metin; tekrar = false; dur('salt'); },
    /** Kaydedilmemiş ilerleme var mı (sekme kapanırken uyarı için). */
    bekleyenVar(): boolean { return durum === 'hata' || durum === 'cevrimdisi' || durum === 'bekliyor'; },
    gorunum, durum: () => durum,
    abone(cb: (g: KayitGorunum) => void): () => void { subs.add(cb); cb(gorunum()); return () => { subs.delete(cb); }; },
  };
}
export type KayitDurum = ReturnType<typeof createKayitDurum>;
