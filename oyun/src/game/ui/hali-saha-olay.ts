// Halı saha olay eşlemesi (FUT-18): motor olayı -> mevcut ses id'leri + Türkçe banner. Saf tablo, birim testli.
// Yalnız engine/audio'daki MEVCUT ses id'leri kullanılır (whistle, whistleLong, kick, post, net, crowdCheer, crowdOoh, puff).
// Para sesi buradan çalmaz (sonuç kartı sessiz 'pop' kullanır); tribün sesleri yoğunluğu ses motorunda ayarlanır.
export type MacOlay = { k: string; [x: string]: unknown };

/** Bir olayın çalacağı ses id'leri. Aynı adımda tekrar eden id'ler `sesler()` ile teke indirilir. */
export function olaySesleri(e: MacOlay): string[] {
  switch (e.k) {
    case 'sfx': return typeof e.id === 'string' ? [e.id] : [];
    case 'goal': return ['net', 'crowdCheer'];
    case 'foul': case 'card': return ['whistle'];
    case 'save': return ['crowdOoh'];
    case 'post': return ['post', 'crowdOoh'];
    case 'end': return ['whistleLong'];
    default: return [];
  }
}
/** Bir adımın tüm olayları -> tekrarsız ses listesi (motor hem sfx hem ayrı olay yollarsa çift çalmaz). */
export function sesler(events: readonly MacOlay[]): string[] {
  const out: string[] = [];
  for (const e of events) for (const id of olaySesleri(e)) if (!out.includes(id)) out.push(id);
  return out;
}

export const RESTART_YAZI: Record<string, string> = { penalti: 'PENALTI', serbest: 'SERBEST VURUŞ', kale: 'KALE VURUŞU', korner: 'KORNER', tac: 'TAÇ', aut: 'AUT' };
/** Motor kendi banner'ını göndermediği yeni olaylar için UI'ın yazdığı kısa yazı (yoksa null: eski olaylar bozulmaz). */
export function olayBanner(e: MacOlay): { text: string; t: number } | null {
  switch (e.k) {
    case 'foul': return { text: e.pen ? 'PENALTI' : 'FAUL', t: 1.6 };
    case 'card': return { text: 'SARI KART', t: 1.6 };
    case 'post': return { text: 'DİREK!', t: 1.0 };
    case 'save': return { text: 'KURTARIŞ!', t: 1.0 };
    default: return null;
  }
}
/** Yeniden başlatma türü değişince gösterilecek yazı: yalnız yeni türler (serbest, penaltı, kale vuruşu). */
export function restartBanner(kind: string | undefined): string | null {
  return kind === 'penalti' || kind === 'serbest' || kind === 'kale' ? RESTART_YAZI[kind] : null;
}
/** İnsan oyuncuya yeniden başlatma ipucu (okunur kısa yazı). */
export function restartIpucu(kind: string | undefined, sahip: boolean): string | null {
  if (!sahip) return null;
  if (kind === 'penalti') return 'Penaltı: ŞUT / F bas, bırakınca vurursun';
  if (kind === 'serbest') return 'Serbest vuruş: PAS ya da ŞUT';
  if (kind === 'kale') return 'Kale vuruşu: PAS ver';
  if (kind === 'korner') return 'Korner: PAS ile ortala';
  if (kind === 'tac') return 'Taç: PAS ver';
  return null;
}
