// Bölgesel atmosfer kapısı (saf mantık, AudioContext yok). SES ANA KURALI: karakter nerede ise yalnız o bölgenin /
// iç mekânın katmanları açık; diğerleri gain rampasıyla kısılıp kapanır ve kaynakları bırakılır (tembel kurulum).
//   scope = interior ? tablo[interior] ?? tablo['ic'] : tablo[zone] ?? tablo['*']   (iç mekânda dış deniz/martı HİÇ yok)
// Tabloyu başka dosya değiştirebilir: setTable(). Motor (index.ts) host'u sağlar; testler sahte host ile sürer.
export interface ShotDef {
  /** ses-db sfx id (ya da motorun tarif adı: simitci, seasonCall, birdTrill ...) */
  id: string; gain: number; minS: number; maxS: number;
  /** rastgele sağ-sol yayılım 0..1 (varsayılan 0.8) */
  pan?: number; when?: 'day' | 'night'; weather?: string[];
}
export interface LayerDef {
  id: string;
  /** ses-db loops id; yoksa yalnız tek atımlar (shots) */
  loop?: string; gain: number; shots?: ShotDef[];
  /** 'grill': seviyeyi ek olarak motor (ızgara mesafesi) belirler */
  dyn?: 'grill';
}
export type AmbienceTable = Record<string, LayerDef[]>;
export interface LayerHandle { setGain(g: number, tc: number): void; stop(): void }
export interface AtmoHost {
  start(def: LayerDef): LayerHandle | null;
  shoot(def: LayerDef, shot: ShotDef): void;
  /** katman kapandı: tamponları LRU'ya bırak */
  release?(def: LayerDef): void;
}
export interface AtmoCtx { phase: string; weather: string }

/** Mevcut davranışın tablosu (b ajanı genişletir/değiştirir). İç mekânlar 'ic' / mutfak / restoran / kafe: deniz ve martı yok. */
export const DEFAULT_TABLE: AmbienceTable = {
  '*': [
    { id: 'deniz', loop: 'deniz', gain: 0.42, shots: [
      { id: 'gull', gain: 0.35, minS: 9, maxS: 18, when: 'day' }, { id: 'creak', gain: 0.3, minS: 14, maxS: 30 },
      { id: 'spoon', gain: 0.3, minS: 20, maxS: 45 },
      { id: 'simitci', gain: 0.4, minS: 45, maxS: 100, when: 'day' }, { id: 'seasonCall', gain: 0.4, minS: 30, maxS: 70 },
      { id: 'thunder', gain: 0.7, minS: 12, maxS: 30, weather: ['firtina'] }] },
    { id: 'izgara', loop: 'izgara', gain: 1, dyn: 'grill' },
  ],
  orman: [{ id: 'ruzgar', loop: 'ruzgar', gain: 0.16, shots: [
    { id: 'birdTrill', gain: 0.5, minS: 3, maxS: 7, when: 'day' }, { id: 'birdCall', gain: 0.5, minS: 4, maxS: 9, when: 'day' },
    { id: 'woodpecker', gain: 0.5, minS: 10, maxS: 25, when: 'day' }, { id: 'seasonCall', gain: 1, minS: 6, maxS: 14, when: 'night' }] }],
  halisaha: [{ id: 'kalabalik', loop: 'crowdBed', gain: 1, shots: [
    { id: 'clapChant', gain: 0.55, minS: 5, maxS: 9 }, { id: 'tribunDavul', gain: 0.55, minS: 6, maxS: 10 },
    { id: 'crowdCheer', gain: 0.55, minS: 8, maxS: 14 }, { id: 'crowdOoh', gain: 0.55, minS: 8, maxS: 14 }] }],
  // iç mekânlar: dış deniz/martı yok; yalnız o odanın tonu (tek kısık döngü). Tablo anahtarı = ic-mekan id'si.
  ev: [], ic: [],
  mutfak: [{ id: 'mutfak_oda', loop: 'mutfak_oda', gain: 0.5 }],
  salonW: [{ id: 'ic_mirilti', loop: 'ic_mirilti', gain: 0.6, shots: [{ id: 'spoon', gain: 0.18, minS: 14, maxS: 30, pan: 0.5 }] }],
  salonE: [{ id: 'ic_mirilti', loop: 'ic_mirilti', gain: 0.6, shots: [{ id: 'spoon', gain: 0.18, minS: 14, maxS: 30, pan: 0.5 }] }],
  banka: [{ id: 'steril_oda', loop: 'steril_oda', gain: 0.6 }],
  hastane: [{ id: 'steril_oda', loop: 'steril_oda', gain: 0.6 }],
};
for (const id of ['kafe1', 'kafe2', 'avm', 'tesis', 'avm_seker', 'avm_kahve', 'avm_baklava', 'avm_dondurma', 'avm_kuruyemis', 'avm_doner', 'avm_kumpir', 'avm_midye']) DEFAULT_TABLE[id] = DEFAULT_TABLE.salonW;
// Martı AVM diyarı: holde dış deniz yok, kapalı çarşı mırıltısı (boot interior() -> 'avmHol'); mağazalar aynı ton, biraz kısık
DEFAULT_TABLE.avmHol = [{ id: 'ic_mirilti', loop: 'ic_mirilti', gain: 0.75, shots: [{ id: 'spoon', gain: 0.1, minS: 25, maxS: 50, pan: 0.6 }] }];
for (const id of ['avm_moda', 'avm_tekno', 'avm_oyuncak']) DEFAULT_TABLE[id] = [{ id: 'ic_mirilti', loop: 'ic_mirilti', gain: 0.45 }];
DEFAULT_TABLE.stadyum = DEFAULT_TABLE.halisaha;

export interface Atmosphere {
  setTable(t: AmbienceTable): void;
  setZone(z: string): void;
  /** iç mekân id (ic-mekan icinde()) ya da null (dışarıda) */
  setInterior(id: string | null): void;
  /** şu an açık (hedef gain > 0) katman id'leri; tek doğruluk kaynağı (test + __marti.audio) */
  active(): string[];
  /** kurulu (kısılıyor olanlar dahil) katman id'leri */
  live(): string[];
  scope(): string;
  /** dışarıdaysa 1, iç mekânda 0 (hava döngüleri duvardan boğuk) */
  outdoor(): number;
  tick(nowMs: number, ctx: AtmoCtx, rand?: () => number): void;
  /** hepsini hemen bırak (askıya alma) */
  dispose(): void;
}

interface Live { def: LayerDef; h: LayerHandle; want: boolean; dieAt: number; next: Map<ShotDef, number> }

export function createAtmosphere(host: AtmoHost, o: { fadeS?: number; table?: AmbienceTable } = {}): Atmosphere {
  const fade = o.fadeS ?? 1.6;
  let table = o.table ?? DEFAULT_TABLE, zone = '', interior: string | null = null;
  const lives = new Map<string, Live>();
  const resolve = (): LayerDef[] => (interior ? table[interior] ?? table.ic : table[zone] ?? table['*']) ?? [];
  const scopeKey = () => (interior ? (table[interior] ? interior : 'ic') : table[zone] ? zone : '*');
  function sync(now: number) {
    const want = new Map(resolve().map(d => [d.id, d]));
    for (const [id, l] of lives) {
      if (want.has(id)) { if (!l.want) { l.want = true; l.h.setGain(l.def.gain, fade / 3); } }
      else if (l.want) { l.want = false; l.dieAt = now + fade * 1000 * 1.5; l.h.setGain(0, fade / 3); }
    }
    for (const [id, d] of want) {
      if (lives.has(id)) continue;
      const h = d.loop || d.dyn ? host.start(d) : { setGain() { /* yalnız atım katmanı */ }, stop() { /* */ } };
      if (!h) continue;
      lives.set(id, { def: d, h, want: true, dieAt: 0, next: new Map() });
      if (d.loop) h.setGain(d.gain, fade / 3);
    }
  }
  let dirty = true;
  return {
    setTable(t) { table = t; dirty = true; },
    setZone(z) { if (z !== zone) { zone = z; dirty = true; } },
    setInterior(id) { if (id !== interior) { interior = id; dirty = true; } },
    active: () => resolve().map(d => d.id),
    live: () => [...lives.keys()],
    scope: scopeKey,
    outdoor: () => (interior ? 0 : 1),
    tick(now, ctx, rand = Math.random) {
      if (dirty) { dirty = false; sync(now); }
      for (const [id, l] of lives) {
        if (!l.want) { if (now >= l.dieAt) { l.h.stop(); host.release?.(l.def); lives.delete(id); } continue; }
        for (const s of l.def.shots ?? []) {
          let at = l.next.get(s);
          if (at === undefined) { l.next.set(s, now + (s.minS + rand() * (s.maxS - s.minS)) * 1000 * 0.5); continue; }
          if (now < at) continue;
          l.next.set(s, now + (s.minS + rand() * (s.maxS - s.minS)) * 1000);
          if (s.when && (s.when === 'day') !== (ctx.phase === 'morning' || ctx.phase === 'noon')) continue;
          if (s.weather && !s.weather.includes(ctx.weather)) continue;
          host.shoot(l.def, s);
        }
      }
    },
    dispose() { for (const l of lives.values()) { l.h.stop(); host.release?.(l.def); } lives.clear(); dirty = true; },
  };
}

/** Eşzamanlı tek-atım tavanı: dolunca düşük öncelikli yenisi reddedilir (ambiyans < ui < para/oyun). */
export function createVoiceCap(max: number) {
  const ends: { end: number; prio: number }[] = [];
  return {
    take(now: number, durMs: number, prio = 1): boolean {
      for (let i = ends.length - 1; i >= 0; i--) if (ends[i].end <= now) ends.splice(i, 1);
      if (ends.length >= max) {
        let lo = 0; for (let i = 1; i < ends.length; i++) if (ends[i].prio < ends[lo].prio) lo = i;
        if (ends[lo].prio >= prio) return false;      // en düşük öncelikli canlı sesin yerini yalnız daha önemlisi alır
        ends.splice(lo, 1);
      }
      ends.push({ end: now + durMs, prio }); return true;
    },
    count: (now: number) => ends.filter(e => e.end > now).length,
  };
}
