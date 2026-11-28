/**
 * Martı Kimlik: başka oyuncuların görünen hesap adı. Presence/sohbet mesajındaki "hn" alanı istemcinin kendi yazdığı
 * metin (biri "admin" yazıp gönderebilir), o yüzden HİÇ gösterilmez. Gösterilen ad, mesajdaki uid için sunucudaki
 * oyuncular.kullanici_adi'dir (değiştirilemez). Sunucuda karşılığı olmayan uid adsız kalır.
 */
export interface AdDogrulayici { ad(uid: string): string; iste(uid: string): void; cek(): Promise<boolean> }
export function adDogrulayici(sor: (ids: string[]) => Promise<Map<string, string>>): AdDogrulayici {
  const bilinen = new Map<string, string>(), bekleyen = new Set<string>(), denendi = new Map<string, number>();
  let mesgul = false;
  return {
    ad: uid => bilinen.get(uid) || '',
    iste: uid => { if (uid && !bilinen.has(uid) && (denendi.get(uid) || 0) < 3) bekleyen.add(uid); },
    /** bekleyenleri tek sorguda çözer; dönüş: yeni ad öğrenildi mi (etiketleri yeniden çizmek için) */
    async cek() {
      if (mesgul || !bekleyen.size) return false;
      mesgul = true; const ids = [...bekleyen].slice(0, 50); ids.forEach(i => bekleyen.delete(i));
      let yeni = false;
      try {
        const m = await sor(ids);
        for (const id of ids) { const a = m.get(id); if (a) { bilinen.set(id, a); yeni = true; } else denendi.set(id, (denendi.get(id) || 0) + 1); }
      } catch { for (const id of ids) denendi.set(id, (denendi.get(id) || 0) + 1); }
      finally { mesgul = false; }
      return yeni;
    },
  };
}
/** Sohbet/özel mesaj başlığı: karakter adı + doğrulanmış hesap adı (varsa). Ör. "Ali Usta @ali". */
export const etiket = (karakterAd: string, hesapAd: string) => (karakterAd || 'Esnaf').slice(0, 14) + (hesapAd ? ' @' + hesapAd : '');
