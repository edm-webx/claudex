/**
 * Hijyen puanı, müfettiş sonucu ve Martı yıldızı (BUF-16). Pure sim. Puan GERÇEK durumdan: kirli masa (süreyle ağırlaşır), salon zemin kiri,
 * mutfak zemin kiri (aşama 3+), kirli tabak yığını (bulaşık istasyonu, aşama 5+). Müfettiş (agents/mufettis.ts) aşama 5+ 5-6 günde bir
 * gerçek yürüyen karakter olarak gelir, sonucu burada uygulanır: iyi = küçük geçici talep artışı, kötü = yalnız uyarı + geçici küçük talep kaybı.
 * Para cezası, iflas, ağır ceza YOK. Martı yıldızı 1-3 (Michelin parodisi, karne 1-5 yıldız kapısından AYRI): servis puanı + hijyen + personel
 * seviyesi; aşama 7+ tabelada. Kalıcı durum S.zones.hijyen; gün sonu verisi rt.uiLast.hijyenGun (karne.ts okur).
 */
import type { Kernel } from './state';
import { zeminSave } from './zemin';
import { BULASIK, MUTFAK_MIN_STAGE } from '../../content/mutfak';
import { RANKS, rankOf } from '../../content/ranks';

export const HIJYEN = { iyi: 0.72, kotu: 0.45, talepIyi: 0.06, talepKotu: -0.05, ilkGun: [1, 2] as [number, number], aralik: [5, 6] as [number, number], minAsama: 5 };
export interface HijyenGirdi { masa: number; zemin: number; mutfak: number | null; tabak: number | null }
export type HijyenSonuc = 'iyi' | 'orta' | 'kotu';
/** 0..1 (1 = pırıl pırıl). Pasif bileşenler (mutfak / bulaşık yok) ağırlıktan düşer. */
export function hijyenPuani(g: HijyenGirdi): number {
  const parts: [number, number][] = [[0.32, g.masa], [0.22, g.zemin]];
  if (g.mutfak != null) parts.push([0.22, g.mutfak]);
  if (g.tabak != null) parts.push([0.24, g.tabak]);
  const w = parts.reduce((s, p) => s + p[0], 0), kir = parts.reduce((s, p) => s + p[0] * Math.min(1, Math.max(0, p[1])), 0) / w;
  return Math.round((1 - kir) * 1000) / 1000;
}
export const hijyenSonucu = (p: number): HijyenSonuc => (p >= HIJYEN.iyi ? 'iyi' : p < HIJYEN.kotu ? 'kotu' : 'orta');
/** Martı yıldızı 1..3: servis 0..5, hijyen 0..1, personel = ortalama rütbe 0..9. Üç yıldız için hijyen ve servis de yeterli olmalı. */
export function martiYildizi(servis: number, hijyen: number, personelRutbe: number): 1 | 2 | 3 {
  const a = (Math.min(5, Math.max(0, servis)) / 5 + Math.min(1, Math.max(0, hijyen)) + Math.min(9, Math.max(0, personelRutbe)) / 9) / 3;
  if (a >= 0.7 && hijyen >= 0.7 && servis >= 3.5) return 3;
  return a >= 0.5 ? 2 : 1;
}

export interface HijyenSave { puan?: number; marti?: number; gelecek?: number; son?: number; sonuc?: HijyenSonuc; talep?: number; talepBitis?: number; gun?: number; ortSum?: number; ortN?: number; dun?: number; gelen?: number }
export function hijyenSave(S: { zones: Record<string, Record<string, unknown>> }): HijyenSave { return (S.zones.hijyen ||= {}) as unknown as HijyenSave; }
/** tabela.ts tabelaFx: müfettiş sonrası geçici talep payı (+ iyi, - kötü) */
export function hijyenTalep(S: { zones: Record<string, Record<string, unknown>>; day?: number }): number {
  const z = S.zones.hijyen as HijyenSave | undefined;
  return z && z.talep && (z.talepBitis ?? -1) >= (S.day ?? 0) ? z.talep : 0;
}

export interface HijyenApi {
  puan(): number;
  marti(): 1 | 2 | 3;
  gunOrt(): number;
  /** müfettiş şimdi gelebilir mi (aşama 5+, gün geldi, 11-19 arası, bugün gelmedi) */
  mufettisIstiyor(hour: number): boolean;
  /** müfettiş turu bitti: sonuç uygulanır (talep, uyarı, toast), sonraki ziyaret 5-6 gün sonra */
  mufettisBitti(puan: number): HijyenSonuc;
  gecerli(): HijyenGirdi;
}

export function installHijyen(K: Kernel): HijyenApi {
  const S = K.state, rt = K.rt, rng = K.rng('hijyen');
  let ema = 1, acc = 0, accM = 0, emaYuklu = false;   // ema kayıttan (z.puan) başlar: yeniden yüklemek müfettiş öncesi salonu 'temizlemesin'
  const gecerli = (): HijyenGirdi => {
    const built = rt.tables.filter(t => t && t.built);
    const masa = built.length ? built.reduce((s, t) => s + (t.dirty > 0 ? 0.4 + 0.6 * Math.min(1, (t.dirtyT || 0) / 120) : 0), 0) / built.length : 0;
    const z = zeminSave(S as never), st = S.stage || 1;
    const bulasik = st >= 5;
    return { masa, zemin: z.kir, mutfak: st >= MUTFAK_MIN_STAGE ? (z.mutfakKir || 0) : null, tabak: bulasik ? (rt.dirtyDishes || 0) / BULASIK.hard : null };
  };
  const ort = () => { const z = hijyenSave(S); return z.ortN ? (z.ortSum || 0) / z.ortN : ema; };
  const personel = () => (S.workers.length ? S.workers.reduce((s, w) => s + rankOf(w.xp || 0), 0) / S.workers.length : 0);
  const servis = () => { const r = S.zones.restoran as { servis?: number } | undefined; return r && Number.isFinite(r.servis) ? r.servis! : 3; };
  const marti = () => martiYildizi(servis(), ema, personel());
  void RANKS;
  function yaz(): void {
    const z = hijyenSave(S), m = marti();
    z.puan = Math.round(ema * 100) / 100;
    if ((S.stage || 1) >= 7 && z.marti != null && m > z.marti) K.toast('Martı yıldızı: ' + '★'.repeat(m) + '! Tabelaya asıldı.', 'good');
    z.marti = m;
    const T = z;
    rt.uiLast.hijyenGun = { day: S.day, not: Math.round(ort() * 100), mufettis: T.son === S.day ? T.sonuc : undefined, marti: (S.stage || 1) >= 7 ? m : undefined };
  }
  K.addSystem({
    id: 'hijyen', order: 47, phase: 'sim',
    step(ctx) {
      const z = hijyenSave(S);
      if (!emaYuklu) { emaYuklu = true; if (typeof z.puan === 'number' && z.puan >= 0 && z.puan <= 1) ema = z.puan; }
      if (z.gun !== S.day) { if (z.gun != null && z.ortN) z.dun = Math.round(ort() * 100) / 100; z.gun = S.day; z.ortSum = 0; z.ortN = 0; }
      if (!rt.started) return;
      acc += ctx.dt; accM += ctx.dt;
      if (acc < 1) return;
      const dt = acc; acc = 0;
      const live = hijyenPuani(gecerli()) + (rt.mutfakMop ? 0.02 : 0);   // ıslak zemin tabelası: paspas sürerken küçük artı
      ema += (Math.min(1, live) - ema) * Math.min(1, 0.1 * dt);
      z.ortSum = (z.ortSum || 0) + ema; z.ortN = (z.ortN || 0) + 1;
      if (accM >= 5 || z.marti == null) { accM = 0; yaz(); }
    },
  });
  const api: HijyenApi = {
    puan: () => ema, marti, gunOrt: ort, gecerli,
    mufettisIstiyor(hour) {
      if ((S.stage || 1) < HIJYEN.minAsama) return false;
      const z = hijyenSave(S);
      if (z.gelecek == null) z.gelecek = S.day + rng.int(HIJYEN.ilkGun[0], HIJYEN.ilkGun[1]);
      return S.day >= z.gelecek && z.son !== S.day && hour >= 11 && hour <= 19;
    },
    mufettisBitti(puan) {
      const z = hijyenSave(S), s = hijyenSonucu(puan);
      z.son = S.day; z.sonuc = s; z.gelen = (z.gelen || 0) + 1; z.gelecek = S.day + rng.int(HIJYEN.aralik[0], HIJYEN.aralik[1]);
      if (s === 'iyi') { z.talep = HIJYEN.talepIyi; z.talepBitis = S.day + 1; K.toast('Hijyen müfettişi: pırıl pırıl! Bu akşam ve yarın biraz daha çok müşteri gelecek.', 'good'); }
      else if (s === 'kotu') { z.talep = HIJYEN.talepKotu; z.talepBitis = S.day; K.toast('Hijyen müfettişinden uyarı: masalar, zemin, tabaklar toparlansın. Ceza yok, bugün biraz az müşteri gelir.', 'bad'); }
      else K.toast('Hijyen müfettişi: fena değil, biraz daha titizlik iyi olur.', 'info');
      K.stat('mufettis'); K.logEv('mufettis', { puan: Math.round(puan * 100), sonuc: s });
      yaz();
      return s;
    },
  };
  (rt as unknown as { hijyen?: HijyenApi }).hijyen = api;
  K.addStateView(() => ({ hijyen: { puan: Math.round(ema * 100), marti: marti(), sonuc: hijyenSave(S).sonuc ?? null } }));
  return api;
}
