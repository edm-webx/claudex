/**
 * Paket servis (BUF-15): aşama 5+ telefon siparişi gelir, mutfak pişirir, tabaklar pass'a iner, GERÇEK kurye (işe alınmış çalışan, workers.ts
 * 'q' durumları) pass'tan paketi alır, bisikletle adrese gider, döner ve geliri dönüşte kasaya getirir. Eski PaketMartı (tablet, araç, yıldız,
 * yorum) tamamen kaldırıldı; yorum, yıldız ve şikayet yok (BUF-03). Pure sim: no three, no DOM, seeded rng only.
 *
 * Akış: yeni paket bileti (rt.teslimat.biletler: mutfak hattı bu biletleri masa biletlerinin ARKASINDA pişirir) -> tabaklar pass'ta hazır ->
 * boştaki kurye pass'a gider, `al(wid)` tabakları gerçekten alır -> `adres(wid)` -> adreste teslim -> geri dönünce `teslim(wid)` satışı
 * kasaya yazar (salesApi.settle, paket ücreti x1.08). Kurye işe alınmadan, aşçı yokken ya da aşama 5 öncesi bilet AÇILMAZ.
 * Kurye işten çıkarsa / bilet süresi dolarsa (240 sn) bilet sessizce kapanır ya da yeniden açılır: ceza, yıldız ya da şikayet yok.
 * Çalışma anı durumu (kayda yazılmaz): yeniden yüklemede paket biletleri yok, kuryeler evde başlar.
 */
import type { Kernel, Plate } from './state';
import { restoranApi, type Ticket, type TicketLine } from './restoran';
import { acikYemekler } from '../../content/yemek-menu';

/** paketin ilk açıldığı aşama ve temel sipariş aralığı (sn); her aşamada 5 sn kısalır */
export const PAKET = { asama: 5, aralikS: 100, aralikAsama: 5, minAralikS: 50, bekleMaxS: 240, ucret: 1.08, saatler: [10, 23.5] as [number, number], kalem: [1, 3] as [number, number] };
/** adresler (karşı yaka / mahalle noktaları): caddenin iki yanında, büfeden 22-56 m uzakta */
export const ADRESLER: { ad: string; dx: number; dz: number }[] = [
  { ad: 'Çınar Sokak 4', dx: -22, dz: 0 }, { ad: 'Kuledibi Apt. 7', dx: 26, dz: 0 }, { ad: 'Liman Caddesi 21', dx: -40, dz: 0.8 }, { ad: 'Karşı Yaka İskele Sk. 3', dx: 56, dz: 0.8 },
];

export interface PaketBilet extends Ticket {
  /** teslimata çıkan kurye (0: sahipsiz) */
  kurye: number; plates: Plate[]; adres: { ad: string; x: number; z: number } | null; deger: number; faz: 'bekle' | 'yolda';
}
export interface TeslimatApi {
  /** mutfak hattı için: pişmesi gereken (istekleri kalan) paket biletleri */
  biletler(): Ticket[];
  /** pass'ta tüm tabakları hazır, sahipsiz bir paket var mı */
  hazirVar(): boolean;
  /** kurye `wid` pass'ta: hazır bir paketin tabaklarını gerçekten alır (rafta yoksa null); tabaklar kuryenin eline verilir */
  al(wid: number): Plate[] | null;
  /** alınan paketin adresi (dünya noktası) */
  adres(wid: number): { ad: string; x: number; z: number } | null;
  /** kurye döndü: paketi satar, geliri kasaya yazar; yazılan gelir (0: paket yok) */
  teslim(wid: number): number;
  /** kurye gitti / işten çıkarıldı: bilet yeniden açılır (tabaklar pass'a döner), ceza yok */
  birak(wid: number): void;
  /** test / kuvvet: şimdi bir paket bileti aç (şartlar sağlanıyorsa); açılan bilet ya da null */
  yeni(): PaketBilet | null;
  view(): { acik: number; bekleyen: number; yolda: number; teslimEdilen: number; kuryeler: number };
  debug(): { biletler: PaketBilet[]; sonraki: number };
}

export function installKurye(K: Kernel): TeslimatApi {
  const S = K.state, rt = K.rt, rng = K.rng('kurye');
  const list: PaketBilet[] = [];
  let timer = 25, seq = 0, teslimEdilen = 0;
  const hat = () => restoranApi(K)?.hat ?? null;
  const kuryeler = () => S.workers.filter(w => w.role === 'kurye');
  const asciVar = () => S.workers.some(w => w.role === 'asci');
  const aralik = () => Math.max(PAKET.minAralikS, PAKET.aralikS - PAKET.aralikAsama * Math.max(0, (S.stage || 1) - PAKET.asama));
  const acik = () => (S.stage || 1) >= PAKET.asama && kuryeler().length > 0 && asciVar() && !!hat();
  const sayac = (t: PaketBilet) => Object.values(t.want).reduce<number>((s, n) => s + (n || 0), 0);

  function yeni(): PaketBilet | null {
    if (!acik()) return null;
    const dishes = acikYemekler(S.stage || 1);
    if (!dishes.length) return null;
    const n = rng.int(PAKET.kalem[0], PAKET.kalem[1]), lines: TicketLine[] = [], want: Record<string, number> = {};
    let deger = 0;
    for (let i = 0; i < n; i++) {
      const d = dishes[rng.int(0, dishes.length - 1)];
      if (d.kurs) { i--; continue; }   // tadım menüsü masa işi: paket olmaz
      lines.push({ food: d.id, dish: d.id, fiyat: d.fiyat, done: false, kurs: 1 });
      want[d.id] = (want[d.id] || 0) + 1; deger += d.fiyat;
    }
    const t: PaketBilet = {
      no: 100 + (seq++ % 99), table: -1, cid: -1, want: { ...want }, all: { ...want }, lines, t: 0, max: PAKET.bekleMaxS,
      kurye: 0, plates: [], adres: null, deger, faz: 'bekle',
    };
    list.push(t);
    K.logEv('paketBilet', { no: t.no, n: lines.length, deger });
    K.stat('paketSiparis');
    return t;
  }
  /** tüm tabakları pass rafında hazır, sahipsiz paket (en eski önce) */
  function hazirOf(): PaketBilet | null {
    const h = hat(); if (!h) return null;
    for (const t of list) {
      if (t.faz !== 'bekle' || t.kurye) continue;
      if (Object.keys(t.all).every(f => h.passCount(f) >= (t.all[f] || 0))) return t;
    }
    return null;
  }
  function adresSec(): { ad: string; x: number; z: number } {
    const a = ADRESLER[rng.int(0, ADRESLER.length - 1)], c = rt.layout.counter.pos, w = rt.layout.walkways[0]?.[0];
    return { ad: a.ad, x: c.x + a.dx, z: (w ? w.z + 1 : 8.6) + a.dz };
  }
  function yenidenAc(t: PaketBilet): void {
    const h = hat();
    for (const p of t.plates) if (!h || !h.geriKoy(p)) K.stat('tabakDustu');
    t.plates = []; t.kurye = 0; t.adres = null; t.faz = 'bekle'; t.want = { ...t.all };
    for (const l of t.lines) l.done = false;
  }
  const api: TeslimatApi = {
    biletler: () => list.filter(t => t.faz === 'bekle' && sayac(t) > 0),
    hazirVar: () => !!hazirOf(),
    al(wid) {
      const h = hat(); if (!h || !kuryeler().some(w => w.id === wid)) return null;
      if (list.some(t => t.kurye === wid)) return null;
      const t = hazirOf(); if (!t) return null;
      const plates: Plate[] = [];
      for (const f of Object.keys(t.all)) for (let i = 0; i < (t.all[f] || 0); i++) { const p = h.passTake(f); if (p) plates.push(p); }
      if (plates.length < Object.values(t.all).reduce<number>((s, n) => s + (n || 0), 0)) { for (const p of plates) h.geriKoy(p); return null; }   // biri kaptı: yerine koy
      t.plates = plates; t.kurye = wid; t.faz = 'yolda'; t.want = {}; t.adres = adresSec();
      K.logEv('paketAlindi', { no: t.no, kurye: wid, ad: t.adres.ad });
      return plates;
    },
    adres: wid => list.find(t => t.kurye === wid)?.adres ?? null,
    teslim(wid) {
      const i = list.findIndex(t => t.kurye === wid); if (i < 0) return 0;
      const t = list[i]; list.splice(i, 1);
      const items = t.plates.map(p => ({ ...p, priceX: (p.priceX || 1) * PAKET.ucret }));
      const v = items.length ? K.salesApi.settle(items, { at: rt.layout.counter.pos }) : 0;
      teslimEdilen++; K.stat('paketTeslim'); K.logEv('paketTeslim', { no: t.no, kurye: wid, value: v });
      return v;
    },
    birak(wid) { const t = list.find(k => k.kurye === wid); if (t) yenidenAc(t); },
    yeni,
    view: () => ({ acik: list.length, bekleyen: list.filter(t => t.faz === 'bekle').length, yolda: list.filter(t => t.faz === 'yolda').length, teslimEdilen, kuryeler: kuryeler().length }),
    debug: () => ({ biletler: list, sonraki: timer }),
  };
  (rt as unknown as { teslimat?: TeslimatApi }).teslimat = api;
  K.addSystem({
    id: 'kurye', order: 38, phase: 'sim',
    step(ctx) {
      const dt = ctx.dt;
      // çalışan gitti: yoldaki paketi yeniden açılır (tabaklar pass'a döner); süresi dolan sahipsiz bilet sessizce kapanır (ceza yok)
      for (let i = list.length - 1; i >= 0; i--) {
        const t = list[i];
        if (t.kurye && !S.workers.some(w => w.id === t.kurye && w.role === 'kurye')) yenidenAc(t);
        if (t.faz === 'bekle') { t.t += dt; if (t.t >= t.max) list.splice(i, 1); }
      }
      if (!rt.started || rt.paused || !acik()) return;
      const h = K.hour();
      if (h < PAKET.saatler[0] || h >= PAKET.saatler[1]) return;
      timer -= dt;
      if (timer > 0) return;
      timer = aralik() * rng.range(0.8, 1.25);
      if (list.length < kuryeler().length + 1) yeni();
    },
  });
  K.addStateView(() => ({ teslimat: api.view() }));
  return api;
}

/** Eski panel köprüsü (panels.ts): PaketMartı paneli kaldırıldı, boş model döner. */
export function kuryePanelModel(_r: { rt: unknown }): Record<string, never> { return {}; }
export function kuryeSummary(_r: { rt: unknown }): null { return null; }
export function teslimatApi(r: { rt: unknown } | null | undefined): TeslimatApi | null { return r ? ((r.rt as { teslimat?: TeslimatApi }).teslimat) || null : null; }
