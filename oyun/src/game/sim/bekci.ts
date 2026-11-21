// KAL-13 oyun içi bekçi (watchdog): ?qa=1 ile kurulur, üretimde kurulmaz (sıfır maliyet). Saniyede bir sim durumunu denetler;
// anormal durumda 'anomali' olayı yayar ve listeye yazar, gezgin botlar (tests/browser/gezgin) window.__marti.bekci ile toplar.
// Denetimler: NaN/sonsuz sayı, negatif para/tecrübe, takılı müşteri (hareket durumunda kıpırdamıyor), yığılma (aynı noktada çok müşteri),
// kuyruk taşması, boşta bekleyen işçi (iş varken), kasa yığını sınırı. Saf: three/DOM/saat yok, yalnız sim zamanı.
import type { SimCtx } from '../../engine/api';
import type { Rules } from './state';

export interface Anomali { tur: string; anahtar: string; t: number; gun: number; ayrinti: string }
export interface BekciEsikleri {
  /** hareket durumundaki (walk/toSeat/leave) müşterinin kıpırdamadan beklediği en uzun süre (sim sn) */
  takiliS: number;
  /** aynı 0.4 m hücresinde en çok hareketli müşteri */
  yigilmaN: number;
  kuyrukMax: number; musteriMax: number; kasaMax: number; yerParaMax: number;
  /** iş varken bir işçinin 'idle' kalabileceği en uzun süre */
  bostaS: number;
  /** aynı anomali anahtarı bu kadar sn tekrar yayılmaz */
  tekrarS: number;
  aralikS: number;
}
export const BEKCI_ESIK: BekciEsikleri = { takiliS: 25, yigilmaN: 5, kuyrukMax: 40, musteriMax: 120, kasaMax: 60, yerParaMax: 80, bostaS: 120, tekrarS: 60, aralikS: 1 };

export interface BekciHandle {
  anomaliler(): Anomali[];
  temizle(): void;
  /** gerçek zamanlı denetimi hemen bir kez çalıştırır (test) */
  denetle(): void;
  readonly esik: BekciEsikleri;
}

type RT = { customers: { id: number; state: string; x: number; z: number; patience: number; t: number }[]; queue: unknown[]; kasa: { v?: number; value?: number }[]; floor: unknown[]; started: boolean; paused?: boolean; dayHistory?: unknown[];
  agents?: { workers?: { rows(): { id: number; role: string; state: string; x: number; z: number }[] } }; tables?: { dirty: number }[]; };

export function installBekci(R: Pick<Rules, 'state' | 'rt' | 'bus' | 'addSystem' | 'playerPos' | 'agents'>, opts: Partial<BekciEsikleri> = {}): BekciHandle {
  const esik: BekciEsikleri = { ...BEKCI_ESIK, ...opts };
  const S = R.state, rt = R.rt as unknown as RT;
  const liste: Anomali[] = [], son = new Map<string, number>();
  let t = 0, acc = 0;
  const musteri = new Map<number, { x: number; z: number; since: number; state: string }>();
  const bosta = new Map<number, number>();

  const bildir = (tur: string, anahtar: string, ayrinti: string) => {
    const k = tur + ':' + anahtar, o = son.get(k);
    if (o !== undefined && t - o < esik.tekrarS) return;
    son.set(k, t);
    const a: Anomali = { tur, anahtar, t: Math.round(t * 10) / 10, gun: S.day, ayrinti };
    if (liste.length >= 300) liste.shift();
    liste.push(a);
    try { (R.bus as unknown as { emit(n: string, d: unknown): void }).emit('anomali', a); } catch { /* olay yayılamasa da liste tutulur */ }
  };
  const sayi = (ad: string, v: unknown) => { if (typeof v === 'number' && !Number.isFinite(v)) bildir('nan', ad, `${ad} = ${v}`); };

  function denetle() {
    if (!rt.started) return;
    // 1) NaN / sonsuz ve negatifler
    for (const [ad, v] of Object.entries({ para: S.money, tecrube: S.xp, altin: S.gold, seviye: S.level, oyunSuresi: S.playT })) sayi(ad, v);
    const p = R.playerPos as { x: number; z: number }; sayi('oyuncu.x', p.x); sayi('oyuncu.z', p.z);
    if (S.money < 0) bildir('negatif', 'para', `para negatif: ${S.money}`);
    if (typeof S.xp === 'number' && S.xp < 0) bildir('negatif', 'tecrube', `tecrübe negatif: ${S.xp}`);
    const ag = R.agents;
    if (ag) {
      const x = ag.f32('x'), z = ag.f32('z');
      for (let i = 0; i < ag.hi; i++) { if (!ag.alive(i)) continue; if (!Number.isFinite(x[i]) || !Number.isFinite(z[i])) { bildir('nan', 'ajan' + i, `ajan ${i} konumu NaN`); break; } }
    }
    // 2) müşteriler: NaN, takılma, yığılma
    const hucre = new Map<string, number>();
    const canli = new Set<number>();
    for (const c of rt.customers) {
      canli.add(c.id);
      if (!Number.isFinite(c.x) || !Number.isFinite(c.z) || !Number.isFinite(c.patience)) { bildir('nan', 'musteri' + c.id, `müşteri ${c.id} (${c.state}) değeri NaN: x=${c.x} z=${c.z} sabır=${c.patience}`); continue; }
      const hareketli = c.state === 'walk' || c.state === 'toSeat' || c.state === 'leave';
      const o = musteri.get(c.id);
      if (!o || o.state !== c.state || Math.hypot(o.x - c.x, o.z - c.z) > 0.15) musteri.set(c.id, { x: c.x, z: c.z, since: t, state: c.state });
      else if (hareketli && t - o.since > esik.takiliS) bildir('takili-musteri', String(c.id), `müşteri ${c.id} ${c.state} durumunda ${Math.round(t - o.since)} sn kıpırdamadı (${c.x.toFixed(1)}, ${c.z.toFixed(1)})`);
      if (hareketli) { const k = Math.round(c.x / 0.4) + ',' + Math.round(c.z / 0.4); hucre.set(k, (hucre.get(k) || 0) + 1); }
    }
    for (const id of musteri.keys()) if (!canli.has(id)) musteri.delete(id);
    for (const [k, n] of hucre) if (n >= esik.yigilmaN) bildir('yigilma', k, `${n} hareketli müşteri aynı noktada (${k})`);
    // 3) taşmalar
    if (rt.queue.length > esik.kuyrukMax) bildir('kuyruk-tasmasi', 'kuyruk', `kuyrukta ${rt.queue.length} müşteri`);
    if (rt.customers.length > esik.musteriMax) bildir('kuyruk-tasmasi', 'musteri', `${rt.customers.length} müşteri sahnede`);
    if (rt.kasa.length > esik.kasaMax) bildir('kasa-yigini', 'kasa', `kasa yığını ${rt.kasa.length} (sınır ${esik.kasaMax})`);
    if (rt.floor.length > esik.yerParaMax) bildir('kasa-yigini', 'yer', `yerde ${rt.floor.length} para (sınır ${esik.yerParaMax})`);
    // 4) boşta işçi: iş varken (kuyruk dolu ya da kirli masa) uzun süre idle
    const iscil = rt.agents?.workers?.rows() ?? [];
    const is = rt.queue.length >= 3 || (rt.tables ?? []).some(m => m.dirty > 0);
    const var_ = new Set<number>();
    for (const w of iscil) {
      var_.add(w.id); sayi('isci' + w.id, w.x); sayi('isci' + w.id, w.z);
      if (w.state === 'idle' && is) { const b = bosta.get(w.id) ?? t; bosta.set(w.id, b); if (t - b > esik.bostaS) bildir('bosta-isci', String(w.id), `işçi ${w.id} (${w.role}) iş varken ${Math.round(t - b)} sn boşta`); } else bosta.delete(w.id);
    }
    for (const id of bosta.keys()) if (!var_.has(id)) bosta.delete(id);
  }

  R.addSystem({ id: 'bekci', order: 900, phase: 'sim', step(ctx: SimCtx) { t += ctx.dt; acc += ctx.dt; if (acc < esik.aralikS) return; acc = 0; denetle(); } } as never);
  return { anomaliler: () => liste.slice(), temizle: () => { liste.length = 0; son.clear(); }, denetle, esik };
}
