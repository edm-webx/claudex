// Bölge ambiyansı denetçisi (SNT-07, DNY-17) ve canlı müzik kaynağı (SNT-14). Bölge kapısı a ajanının
// atmosphere.ts'idir: hangi bölgenin döngüleri kurulur / kapanır ve bölge geçişinin çapraz geçişi orada. Bu dosya
// content/ses/ambiyans.ts tablosunu kapıya verir (kapiTablosu) ve kapının üstüne şunları ekler:
// - döngü başına bir ağırlık düğümü: gün evresi kayması (~30 sn, döngü durmaz, tık yok) ve kaynağa uzaklık (fıskiye, tribün);
//   ağırlığı 0'a inen döngü kapı tablosundan düşer ve kapı onu bırakır (duyulmayan döngü kurulmaz);
// - olaylar: bölge havuzundan çanta (aynı ses ardışık iki kez yok), evre yoğunluğu, konumlu olaylarda mesafe/pan,
//   uzak olay hiç kurulmaz, iç mekanda dış olay yok; fırtınada seyrek uzak gök gürültüsü;
// - canlı müzik: müzisyen çalarken konumlu, yumuşak saz/ney döngüsü; yakındayken arka plan müziği çekilir.
// Zamanlayıcı 4 Hz, kare başına iş yok.
import type { DayPhase, Vec2 } from '../api';
import type { Bank } from './msynth';
import {
  ambBolge, katmanAgirlik, kapiTablosu, tabloImza, yaklas, uzaklikKazanc, evreIdx, Canta, canliSeviye, CANLI,
  EVRE_GECIS_SN, BOLGE_GECIS_SN, IC_ODA, type AmbOlay, type KapiKatman,
} from '../../content/ses/ambiyans';

export interface AmbiyansDeps {
  /** bağlam tembel kurulur (ilk dokunuş); start() onu alır */
  ac: () => AudioContext | null;
  /** ambiyans busu */
  out: () => AudioNode;
  bank: () => Bank | null;
  /** tek seferlik olayı `out` düğümüne çal (ses-db ya da motor tarifi); false: ses tavanı dolu, çalınmadı */
  olay: (id: string, out: GainNode, day: boolean) => boolean;
  /** kapıya tablo ver (atmosphere.setTable) */
  setTable: (t: Record<string, KapiKatman[]>) => void;
  /** kapının iç mekan anahtarları (mutfak, restoran, ic, ev ...): korunur */
  temel: () => Record<string, readonly KapiKatman[]>;
  /** oyuncu dışarıda mı (kapı: iç mekanda dış olay yok) */
  disarida: () => boolean;
  /** canlı müzik yakındayken arka plan müziği çarpanı (1 = kısma yok) */
  muzikKis?: (v: number) => void;
  rnd: () => number;
}
export interface Ambiyans {
  start(): void;
  stop(): void;
  setZone(z: string): void;
  setPhase(p: DayPhase): void;
  setWeather(w: string): void;
  setListener(p: Vec2): void;
  /** kapı katmanının bağlanacağı düğüm: bu tablonun döngüsüyse ağırlık düğümü, değilse `fallback` */
  kazanc(id: string, fallback: AudioNode): AudioNode;
  /** SNT-14: sim 'canliMuzik' olayı (müzisyen çalıyor) */
  canli(p: Vec2): void;
  /** şimşek çaktı (görsel): gök gürültüsü gecikmeli gelir; bir kez bildirilince rastgele gürültü kapanır */
  simsek(): void;
  /** debug / test: döngü ağırlıkları (kapı kazancıyla çarpılır); 'canli' canlı müzik kaynağı */
  aktif(): Record<string, number>;
  /** debug / test: son olaylar */
  olaylar(): { id: string; vol: number }[];
}

const TICK = 0.25;

export function createAmbiyans(d: AmbiyansDeps): Ambiyans {
  let ac = null as unknown as AudioContext;
  let on = false, zone = 'iskele', phase: DayPhase = 'morning', weather = 'acik';
  const lis: Vec2 = { x: 0, z: 0 };
  const agirlik = new Map<string, { g: GainNode; cur: number }>();
  let timer: ReturnType<typeof setInterval> | null = null, imza = '';
  let gokGorsel = false, gokSon = 0; const gokBekle: { t: number; vol: number }[] = [];
  let hizliT = -1e9, nextOlay = 0, nextGok = 0, bagKey = '', bag: Canta<AmbOlay> | null = null;
  const log: { id: string; vol: number }[] = [];
  let canliPos: Vec2 | null = null, canliSon = -1e9, canliK: { g: GainNode; p: StereoPannerNode; src: AudioBufferSourceNode | null; cur: number } | null = null;
  const now = () => (ac ? ac.currentTime : 0);
  const range = (a: number, b: number) => a + (b - a) * d.rnd();
  const tabloDongu = new Set<string>();

  function node(id: string, w0: number) {
    let n = agirlik.get(id);
    if (!n) { const g = ac.createGain(); g.gain.value = w0; g.connect(d.out()); n = { g, cur: w0 }; agirlik.set(id, n); }
    return n;
  }

  function tickKatman(t: number) {
    const hedef = katmanAgirlik(zone, phase, lis), konumlu = new Set(ambBolge(zone).katman.filter(k => k.at).map(k => k.loop));
    const canli: Record<string, number> = {};
    for (const [id, n] of agirlik) {
      const h = hedef[id] ?? 0;
      const sure = t < hizliT ? BOLGE_GECIS_SN : konumlu.has(id) ? 2.5 : EVRE_GECIS_SN;
      const prev = n.cur;
      n.cur = yaklas(n.cur, h, TICK, sure);
      if (n.cur !== prev) { try { n.g.gain.setTargetAtTime(n.cur, t, 0.08); } catch { /* */ } }
      canli[id] = n.cur;
    }
    // yeni döngü: ağırlık hemen hedefte (giriş rampasını kapı yapar)
    for (const id in hedef) if (!agirlik.has(id)) { node(id, hedef[id]); canli[id] = hedef[id]; }
    const t2 = kapiTablosu(phase, lis, zone, canli, d.temel());
    const im = tabloImza(t2);
    if (im !== imza) { imza = im; for (const k in t2) if (!(k in IC_ODA)) for (const l of t2[k]) if (l.loop && !l.dyn) tabloDongu.add(l.loop); d.setTable(t2); }   // iç mekan oda tonları ağırlık düğümünden geçmez (sabit kazanç)
  }

  function tickOlay(t: number) {
    const b = ambBolge(zone), e = evreIdx(phase), day = e < 2, dis = d.disarida();
    // şimşek görsel olarak bildirildiyse gürültü onu izler (1-4 sn, uzaktaysa kısık); yoksa seyrek rastgele (H-054)
    for (let i = gokBekle.length - 1; i >= 0; i--) if (t >= gokBekle[i].t) { const g = gokBekle.splice(i, 1)[0]; if (weather !== 'acik') fire({ id: 'thunder', vol: (dis ? 0.65 : 0.2) * g.vol, evre: [1, 1, 1, 1] }, t, day); }
    if (gokGorsel && t - gokSon > 75) gokGorsel = false;   // şimşek uzun süredir bildirilmedi: rastgele gürültü geri açılır
    if (!gokGorsel && weather === 'firtina' && t >= nextGok) {
      nextGok = t + range(25, 60);
      fire({ id: 'thunder', vol: dis ? 0.6 : 0.2, evre: [1, 1, 1, 1] }, t, day);
    }
    if (t < nextOlay) return;
    const yog = b.yogunluk[e];
    if (!dis || !b.olay.length || yog <= 0) { nextOlay = t + 5; return; }
    nextOlay = t + range(b.aralik[0], b.aralik[1]) / yog;
    const key = zone.split('.')[0] + '|' + e;
    if (key !== bagKey) { bagKey = key; bag = new Canta(b.olay.map(o => ({ v: o, w: o.evre[e] })), d.rnd); }
    const o = bag?.next(); if (o) fire(o, t, day);
  }
  function fire(o: AmbOlay, _t: number, day: boolean) {
    if (weather !== 'acik' && weather !== 'sis' && (o.id === 'mevsim' || o.id === 'gull')) return;   // yağmurda böcek / martı yok
    let vol = o.vol, pan = d.rnd() * 1.4 - 0.7;
    if (o.at) {
      const dx = o.at.x - lis.x, dist = Math.hypot(dx, o.at.z - lis.z);
      vol *= uzaklikKazanc(dist, o.r ?? 30);
      pan = Math.max(-1, Math.min(1, dx / 12));
    }
    if (vol < 0.02) return;   // duyulmayan ses hiç kurulmaz
    try {
      const g = ac.createGain(); g.gain.value = vol;
      const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(d.out());
      if (!d.olay(o.id === 'mevsim' ? 'seasonCall' : o.id, g, day)) { p.disconnect(); return; }
      setTimeout(() => { try { p.disconnect(); } catch { /* */ } }, 9000);
    } catch { return; }
    log.push({ id: o.id, vol: +vol.toFixed(3) }); if (log.length > 24) log.shift();
  }

  function tickCanli(t: number) {
    const dist = canliPos ? Math.hypot(canliPos.x - lis.x, canliPos.z - lis.z) : 1e9;
    const alive = t - canliSon < CANLI.omur && dist < CANLI.r;
    const sv = alive ? canliSeviye(dist) : { vol: 0, muzik: 1 };
    const bank = d.bank();
    if (alive && !canliK && bank) {
      const g = ac.createGain(); g.gain.value = 0; const p = ac.createStereoPanner(); g.connect(p); p.connect(d.out());
      const k = { g, p, src: null as AudioBufferSourceNode | null, cur: 0 }; canliK = k;
      bank.track(CANLI.parca, buf => {
        if (!on || canliK !== k || k.src) return;
        const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(g); s.start(ac.currentTime, d.rnd() * buf.duration); k.src = s;
      });
    }
    if (canliK) {
      const k = canliK;
      k.cur = yaklas(k.cur, sv.vol, TICK, 2);
      try { k.g.gain.setTargetAtTime(k.cur, t, 0.1); if (canliPos) k.p.pan.setTargetAtTime(Math.max(-1, Math.min(1, (canliPos.x - lis.x) / 10)), t, 0.2); } catch { /* */ }
      if (!alive && k.cur === 0) { try { k.src?.stop(); k.p.disconnect(); } catch { /* */ } canliK = null; }
    }
    d.muzikKis?.(sv.muzik);
  }

  function tick() {
    if (!on) return;
    try { const t = now(); tickKatman(t); tickOlay(t); tickCanli(t); } catch { /* ses asla oyunu düşürmez */ }
  }

  return {
    start() {
      const c = d.ac();
      if (on || !c) return;
      ac = c; on = true; imza = ''; hizliT = now() + 4; nextOlay = now() + 4; nextGok = now() + range(10, 30);
      tick(); timer = setInterval(tick, TICK * 1000);
    },
    stop() {
      on = false;
      if (timer) { clearInterval(timer); timer = null; }
      if (canliK) { try { canliK.src?.stop(); canliK.p.disconnect(); } catch { /* */ } canliK = null; }
      d.muzikKis?.(1);
    },
    setZone(z) {
      if (z === zone) return;
      const base = zone.split('.')[0]; zone = z;
      if (z.split('.')[0] !== base) { hizliT = now() + 6; nextOlay = Math.min(nextOlay, now() + 3); }
      if (on) tick();
    },
    setPhase(p) { phase = p; },
    setWeather(w) { weather = w; },
    setListener(p) { lis.x = p.x; lis.z = p.z; },
    kazanc(id, fallback) { const w = katmanAgirlik(zone, phase, lis)[id]; return agirlik.has(id) || w || tabloDongu.has(id) ? node(id, w ?? 0).g : fallback; },
    simsek() { gokGorsel = true; gokSon = now(); const dly = range(1, 4); gokBekle.push({ t: now() + dly, vol: 1 - 0.1 * dly }); if (gokBekle.length > 3) gokBekle.shift(); },
    canli(p) { canliPos = { x: p.x, z: p.z }; canliSon = now(); },
    aktif() { const o: Record<string, number> = {}; for (const [id, n] of agirlik) if (n.cur > 0) o[id] = +n.cur.toFixed(3); if (canliK) o.canli = +canliK.cur.toFixed(3); return o; },
    olaylar: () => log.slice(),
  };
}
