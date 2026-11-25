/**
 * Mutfak hattı (BUF-05): masa biletlerinin kalemleri mutfakta KENDİ istasyonunda pişer, tabak istasyon tepsisine, oradan (komi ya da
 * aşçı taşır) mutfak pass rafına düşer, garson pass'tan alır. Pure sim: no three, no DOM, no rng (karar sırası deterministik).
 *
 * Kurallar (anket 2026-11-09 + şartname BUF-05):
 * - Bilet sırası geliş sırası (KDS FIFO, H-236). Bir kalemin ihtiyacı = bilet isteği - garsona verilmiş tabak - o bilete pişen;
 *   tepsi, eldeki, pass ve (tezgâh ürünü için) tezgâh tabakları önce havuzdan düşülür: gereksiz pişirme yok, STOK yok.
 * - İstasyon: yiyeceğin istasyonu (content/yemek-menu.ts calismaIstasyonu: o aşamada yoksa ocak). Hat (ocak/ocak2, izgara/izgara2)
 *   üyeleri eşdeğer; ikinci hat yalnız iki ve fazla aşçı varken iş alır. Boş olan, aşçıya en yakın üye seçilir. Uzmanlık yok (H-245).
 * - Bir istasyonda aynı anda en çok bir iş: pişen (aşçı yolda ya da başında) VEYA tepside bekleyen tabak. Doluluk ayrı sayaç değil, türetilir.
 * - Pass rafı en çok PASS_KAP tabak; hattaki toplam tabak (pişen + tepsi + elde + pass) PASS_KAP'ı geçmez (aşırı üretim yok).
 * - Bekle-al: yanma, kalite, malzeme yok. Süre content/mutfak.ts pisirmeSuresi (şef hızı TEK yerden: sefHizi).
 * - Bileti düşen tabak (kimse istemiyor) 30 sn sonra sessizce silinir; tezgâha stok olarak eklenmez.
 * BUF-06 oyuncu şef: wid -1 oyuncudur. Oyuncu istasyon başında durup pişirir (claim(-1, from, { ist })), süre yalnız başında dururken
 * işler (pTik), tabak oyuncunun elinde (rt.carry) kalır; hat elde listesinde aynı tabağı yalnız sayım için tutar (elden düşünce silinir).
 * Devir: istasyon bir aşçıya devredilir (devret); o istasyonu yalnız o aşçı (ve oyuncu) kullanır, aşçı kendi istasyonunda iş yoksa
 * diğer istasyonlara da bakar (devir aşçıyı kilitlemez). Devir çalışma anıdır (kalıcı alan schema kararı bekliyor).
 * Durum çalışma anıdır (kayda yazılmaz): yeniden yüklemede boş başlar, açık biletler de zaten kalıcı değil.
 */
import type { Vec2 } from '../../engine/api';
import type { Kernel, Plate } from './state';
import { PASS_KAP, MUTFAK_IST_BY_ID, hatUyeleri, mutfakEsya, pisirIstasyonu, pisirmeSuresi } from '../../content/mutfak';
import { acikYemekler, calismaIstasyonu, hazirlikOf, icecekMi, isProduct, type FoodId } from '../../content/yemek-menu';
import { mutfakStand, mutfakDunya, passAsciUV, type PassYer } from '../../content/ic-mekan';
import { rankOf } from '../../content/ranks';
import { SES_ISTASYON } from '../../content/mutfak-ses';

export interface HatTicket { no: number; table: number; want: Record<string, number | undefined> }
export interface HatDeps<T extends HatTicket> {
  tickets(): readonly T[];
  /** plates of `f` a garson already holds for ticket `t` (taken off the pass / counter) */
  jobs(t: T, f: FoodId): number;
  /** 2026-11-21: the pass a plate of `f` goes to (the side of the oldest ticket still waiting for it): 'on' sokak pass'ı, 'W' / 'E' salon pass'ı */
  yer?(f: FoodId): PassYer;
}
export interface IstDurum { d: 'pisiyor' | 'hazir'; p: FoodId }
/** oyuncunun mutfak işi: pişirdiği istasyon / yiyecek ve ilerleme 0..1 (yoksa ist null) */
export interface OyuncuIs { ist: string | null; p: FoodId | null; frac: number; elde: number }
export const OYUNCU = -1;
export interface MutfakHatApi<T extends HatTicket = HatTicket> {
  /** aşçı `wid` için en eski bilet kalemini ve boş istasyonunu ayırır (yiyecek döner, yoksa null) */
  claim(wid: number, from?: Vec2, opt?: { ist?: string; hazir?: boolean }): FoodId | null;
  /** 2026-11-25: bilet yokken oyuncunun `ist` başında hazırlayabileceği yemek (o istasyonun açık menüsü, ilk sıradaki); yoksa null. Stok değil: tabak elde kalır, pass'ta 30 sn istenmezse silinir */
  hazirAday(ist: string): FoodId | null;
  /** BUF-06: oyuncu `ist` başında dursa hangi kalemi pişirirdi (KDS sırası, ayırmaz) */
  aday(ist: string): FoodId | null;
  /** BUF-06: oyuncunun pişirmesi `dt` sn ilerler (yalnız başında dururken); süre dolunca tabağı döndürür (istasyondan alınmış, elde) */
  pTik(dt: number): Plate | null;
  /** BUF-06: oyuncu pişirmeyi bıraktı (başka bilete geçti): ayrılan istasyon boşalır (eldeki tabaklara dokunmaz) */
  pBirak(): void;
  /** BUF-06: oyuncunun elindeki mutfak tabağı (hat sayımı için; rt.carry'deki aynı nesne) */
  pEldeye(plate: Plate): void;
  /** BUF-06: eldeki mutfak tabağını pass rafına koy (pass doluysa false) */
  pPass(plate: Plate): boolean;
  /** BUF-06: bu tabak hattın ürettiği mutfak tabağı mı (oyuncunun pass'a bırakabileceği) */
  mutfakTabagi(plate: object): boolean;
  pDurum(): OyuncuIs;
  /** BUF-06 devir: istasyonu aşçıya devret / geri al / kime devredildi */
  devret(ist: string, wid: number): boolean;
  devirAl(ist: string): boolean;
  devirOf(ist: string): number | null;
  /** aşçının devralınmış istasyonu (yoksa null) */
  devirIst(wid: number): string | null;
  /** aşçının ayırdığı istasyon / yiyecek */
  ist(wid: number): string | null;
  food(wid: number): FoodId | null;
  /** gerçek pişirme süresi (sn): hazırlık / (1 + 0.12 x rütbe + şef hızı) */
  sure(wid: number): number;
  /** pişirme bitti: tabak istasyon tepsisine (istasyon tepsi alınana kadar dolu) */
  ready(wid: number): boolean;
  /** tepside bekleyen bir tabağı taşımak için ayır (kendi: yalnız kendi pişirdiği; yas: en az bu kadar sn beklemiş) */
  tasiClaim(wid: number, opt?: { kendi?: boolean; yas?: number }): { ist: string; p: FoodId } | null;
  /** ayrılan tepsi tabağını eline al (istasyon boşalır) */
  tasiAl(wid: number): Plate | null;
  /** eldeki tabağı pass rafına koy (pass doluysa false: taşıyan bekler); 'passBell' olayı */
  done(wid: number): boolean;
  /** 2026-11-21: eldeki tabağın gideceği pass (aşçı/komi oraya yürür) */
  eldeYer(wid: number): PassYer | null;
  /** elinde tabak var mı */
  elde(wid: number): boolean;
  /** işçi gitti / iş iptal: ayırdığı her şeyi bırak (eldeki tabak pass'a, yer yoksa kaybolur) */
  drop(wid: number): void;
  /** yer verilirse yalnız o pass'tan (garson o pencerenin önünde durur) */
  passTake(f: FoodId, yer?: PassYer): Plate | null;
  /** BUF-09: a garson brings an unwanted plate back to the pass (false when the rack is full) */
  geriKoy(plate: Plate, yer?: PassYer): boolean;
  passCount(f?: FoodId, yer?: PassYer): number;
  /** komi yokken / 6 sn alınmayan tepsi tabağı var mı (boştaki aşçı alır) */
  bekleyenTepsi(yas: number): boolean;
  view(): { pass: FoodId[]; passYer: Record<PassYer, FoodId[]>; ist: Record<string, IstDurum>; devir: Record<string, number>; oyuncu: OyuncuIs };
  /** test / denetim: iç durum kopyası */
  durum(): {
    cooking: { wid: number; ist: string; p: FoodId; no: number; t: number }[]; tepsi: { ist: string; p: FoodId; wid: number; t: number }[]; elde: { wid: number; p: FoodId; t: number }[]; pass: FoodId[];
    /** emniyet zaman aşımları (takılı iş belirtisi: normal akışta 0 kalmalı) ve sessizce silinen sahipsiz tabaklar */
    asim: number; sahipsiz: number; zil: number;
  };
  update(dt: number): void;
}

const ORPHAN_S = 30, CLAIM_S = 20;

export function installMutfakHat<T extends HatTicket>(K: Kernel, deps: HatDeps<T>): MutfakHatApi<T> {
  const S = K.state, rt = K.rt;
  type Cook = { wid: number; ticket: T | null; food: FoodId; ist: string; t: number; /** oyuncu: son pTik'ten bu yana sn */ off: number };
  type Tep = { ist: string; plate: Plate; idle: number; wid: number; claimT: number; t: number; by: number };
  type Eld = { wid: number; plate: Plate; t: number; yer: PassYer };
  type Pas = { plate: Plate; idle: number; yer: PassYer };
  const cooking: Cook[] = [], tepsi: Tep[] = [], elde: Eld[] = [], pass: Pas[] = [];
  let asim = 0, sahipsiz = 0, zil = 0;
  const devir = new Map<string, number>();   // BUF-06: istasyon -> devralan aşçı
  const mutfakSet = new WeakSet<object>();    // hattın ürettiği tabaklar (oyuncu yalnız bunları pass'a bırakır)
  const OFF_S = 25;                           // oyuncu bu kadar sn başında durmazsa işi bırakılır
  const stage = () => S.stage || 1;
  const busy = (ist: string) => cooking.some(c => c.ist === ist) || tepsi.some(t => t.ist === ist);
  const inLine = () => cooking.length + tepsi.length + elde.length + pass.length;
  const asciN = () => S.workers.filter(w => w.role === 'asci').length;
  const standW = (ist: string) => mutfakDunya(mutfakStand(ist));
  const yerOf = (f: FoodId): PassYer => deps.yer?.(f) ?? 'on';
  const bell = (plate: Plate, yer: PassYer) => {
    const at = mutfakDunya(passAsciUV(yer)), tk = deps.tickets().find(t => (t.want[plate.type] || 0) > 0);
    zil++; K.logEv('passBell', { no: tk?.no ?? 0, table: tk?.table ?? -1, p: plate.type, x: at.x, z: at.z, yer });
  };

  const roleOf = (wid: number) => S.workers.find(w => w.id === wid)?.role;
  const baristaVar = () => S.workers.some(w => w.role === 'barista');
  const devirIstOf = (wid: number) => { for (const [i, w] of devir) if (w === wid) return i; return null; };
  function pickStation(f: FoodId, from?: Vec2, only?: string, ownOnly?: string | null, wid = 0): string | null {
    let uyeler = hatUyeleri(calismaIstasyonu(f, stage()), stage());
    if (only) uyeler = uyeler.filter(i => i === only);   // oyuncu bu istasyonun başında (ikinci hat kuralı ona uymaz)
    else if (ownOnly) uyeler = uyeler.filter(i => i === ownOnly);
    else {
      if (asciN() < 2) uyeler = uyeler.slice(0, 1);   // ikinci hat yalnız iki ve fazla aşçı varken
      uyeler = uyeler.filter(i => !devir.has(i) || devir.get(i) === wid);   // devredilmiş istasyonu yalnız devralan kullanır
    }
    let best: string | null = null, bd = Infinity;
    for (const ist of uyeler) {
      if (busy(ist)) continue;
      const p = standW(ist), d = from ? Math.hypot(p.x - from.x, p.z - from.z) : 0;
      if (d < bd - 1e-6) { bd = d; best = ist; }
    }
    return best;
  }
  /** havuz: bilete bağlı olmayan, istenen yiyeceğin hazır / yoldaki tabakları (+ tezgâh ürünü için tezgâh stoğu) */
  function spareOf(): Map<FoodId, number> {
    const m = new Map<FoodId, number>(), add = (f: FoodId, n = 1) => m.set(f, (m.get(f) || 0) + n);
    for (const t of tepsi) add(t.plate.type); for (const e of elde) add(e.plate.type); for (const p of pass) add(p.plate.type);
    for (const c of cooking) if (!c.ticket) add(c.food);
    const seen = new Set<FoodId>();
    for (const t of deps.tickets()) for (const f in t.want) if (!seen.has(f)) { seen.add(f); if (isProduct(f)) add(f, rt.counter[f]?.length || 0); }
    return m;
  }

  function pick(wid: number, from: Vec2 | undefined, only: string | undefined, ownOnly: string | null, commit: boolean): FoodId | null {
    const spare = spareOf();
    for (const t of deps.tickets()) {
      for (const f of Object.keys(t.want)) {
        let left = (t.want[f] || 0) - deps.jobs(t, f) - cooking.filter(c => c.ticket === t && c.food === f).length;
        const sp = spare.get(f) || 0, use = Math.min(Math.max(0, left), sp); spare.set(f, sp - use); left -= use;
        if (left <= 0) continue;
        // BUF-13: barista varsa içecekleri yalnız o, aşçı/komi içeceğe bakmaz (barista yoksa herkes alır: içecek bileti asla askıda kalmaz)
        if (wid > 0 && baristaVar() && (roleOf(wid) === 'barista') !== icecekMi(f)) continue;
        const ist = pickStation(f, from, only, ownOnly, wid);
        if (!ist) continue;   // o kalemin istasyonları dolu: sıradaki kaleme bak
        if (commit) cooking.push({ wid, ticket: t, food: f, ist, t: 0, off: 0 });
        return f;
      }
    }
    return null;
  }
  const oyuncuIs = () => cooking.find(c => c.wid === OYUNCU);
  const sureOf = (c: Cook) => { const w = S.workers.find(k => k.id === c.wid); return pisirmeSuresi(hazirlikOf(c.food), rankOf(w?.xp || 0), S.workers); };
  /** oyuncunun elindeki tabaklar: rt.carry'deki hattın tabakları (hat yalnız sayar) */
  const carryPlates = (): Plate[] => (((rt as unknown as { carry?: Plate[] }).carry) || []).filter(p => mutfakSet.has(p));

  const api: MutfakHatApi<T> = {
    claim(wid, from, opt) {
      if (cooking.some(c => c.wid === wid) || (wid > 0 && elde.some(e => e.wid === wid))) return null;
      if (inLine() >= PASS_KAP) return null;
      const own = wid > 0 ? devirIstOf(wid) : null;
      // devralan aşçı önce kendi istasyonunun işine bakar, yoksa diğer istasyonlara (devir aşçıyı kilitlemez)
      if (own) { const f = pick(wid, from, undefined, own, true); if (f) return f; }
      const f = pick(wid, from, opt?.ist, null, true);
      if (f || !opt?.hazir || !opt.ist || wid !== OYUNCU) return f;
      // bilet yok: oyuncu kendi hazırlığını yapar (sahip: "istasyonda yemek ve hazırlık yapamıyorum")
      const h = api.hazirAday(opt.ist); if (!h || busy(opt.ist)) return null;
      cooking.push({ wid, ticket: null, food: h, ist: opt.ist, t: 0, off: 0 });
      return h;
    },
    hazirAday(ist) {
      if (inLine() >= PASS_KAP || busy(ist)) return null;
      return acikYemekler(stage()).find(d => d.istasyon === ist && calismaIstasyonu(d.id, stage()) === ist)?.id ?? null;
    },
    aday(ist) {
      if (inLine() >= PASS_KAP) return null;
      const i = cooking.findIndex(c => c.wid === OYUNCU), own = i >= 0 ? cooking.splice(i, 1)[0] : null;   // kendi işi dışında kalan dünya
      try { return pick(OYUNCU, undefined, ist, null, false); } finally { if (own) cooking.splice(i, 0, own); }
    },
    pTik(dt) {
      const c = oyuncuIs(); if (!c) return null;
      c.off = 0; c.t += dt;
      if (c.t < sureOf(c)) return null;
      const p = api.ready(OYUNCU) && api.tasiClaim(OYUNCU, { kendi: true }) ? api.tasiAl(OYUNCU) : null;
      if (p) mutfakSet.add(p);
      return p;
    },
    pBirak() { for (let i = cooking.length - 1; i >= 0; i--) if (cooking[i].wid === OYUNCU) cooking.splice(i, 1); },
    pEldeye(plate) { mutfakSet.add(plate); },
    pPass(plate) {
      if (pass.length >= PASS_KAP) return false;
      const i = elde.findIndex(e => e.plate === plate); if (i >= 0) elde.splice(i, 1);
      pass.push({ plate, idle: 0, yer: 'on' });   // oyuncu tabağı mutfağın sokak pass'ına bırakır (garson tabağın durduğu pass'a yürür)
      bell(plate, 'on');
      return true;
    },
    mutfakTabagi: plate => mutfakSet.has(plate),
    pDurum() { const c = oyuncuIs(); return { ist: c?.ist ?? null, p: c?.food ?? null, frac: c ? Math.min(1, c.t / Math.max(0.1, sureOf(c))) : 0, elde: elde.filter(e => e.wid === OYUNCU).length }; },
    devret(ist, wid) {
      if (!S.workers.some(w => w.id === wid && w.role === 'asci')) return false;
      if (!pisirIstasyonu(ist) || !mutfakEsya(stage()).includes(ist) || MUTFAK_IST_BY_ID[ist]?.islev !== 'pisir') return false;
      if (oyuncuIs()?.ist === ist || (devir.has(ist) && devir.get(ist) !== wid)) return false;
      for (const [i, w] of devir) if (w === wid) devir.delete(i);   // bir aşçı tek istasyon devralır
      devir.set(ist, wid); return true;
    },
    devirAl: ist => devir.delete(ist),
    devirOf: ist => devir.get(ist) ?? null,
    devirIst: wid => devirIstOf(wid),
    ist: wid => cooking.find(c => c.wid === wid)?.ist ?? null,
    food: wid => cooking.find(c => c.wid === wid)?.food ?? null,
    sure(wid) {
      const c = cooking.find(k => k.wid === wid); if (!c) return 0;
      const w = S.workers.find(k => k.id === wid);
      return pisirmeSuresi(hazirlikOf(c.food), rankOf(w?.xp || 0), S.workers);
    },
    ready(wid) {
      const i = cooking.findIndex(c => c.wid === wid); if (i < 0) return false;
      const c = cooking.splice(i, 1)[0];
      // BUF-08: tava istasyonunda yemek bitince tava çarpması (ses katmanı çalar; sim ses üretmez)
      if (SES_ISTASYON[c.ist]?.tava) { const at = standW(c.ist); K.logEv('tavaCarpma', { ist: c.ist, x: at.x, z: at.z }); }
      // tabakta by/carrier yok: mutfak tabağı ücret payı kesmez (BUF-04 ekonomisi aynı kalır; maaş BUF-17'nin)
      tepsi.push({ ist: c.ist, plate: { type: c.food, tier: isProduct(c.food) ? S.tiers[c.food] || 1 : 1 }, idle: 0, wid: 0, claimT: 0, t: 0, by: wid });
      return true;
    },
    tasiClaim(wid, opt = {}) {
      if (wid > 0 && elde.some(e => e.wid === wid)) return null;
      const own = tepsi.find(t => t.wid === wid); if (own) return { ist: own.ist, p: own.plate.type };
      const t = tepsi.find(k => !k.wid && (!opt.kendi || k.by === wid) && k.t >= (opt.yas || 0));
      if (!t) return null;
      t.wid = wid; t.claimT = 0;
      return { ist: t.ist, p: t.plate.type };
    },
    tasiAl(wid) {
      const i = tepsi.findIndex(t => t.wid === wid); if (i < 0) return null;
      const t = tepsi.splice(i, 1)[0];
      elde.push({ wid, plate: t.plate, t: 0, yer: yerOf(t.plate.type) });
      return t.plate;
    },
    done(wid) {
      const i = elde.findIndex(e => e.wid === wid); if (i < 0) return false;
      if (pass.length >= PASS_KAP) return false;
      const e = elde.splice(i, 1)[0];
      pass.push({ plate: e.plate, idle: 0, yer: e.yer });
      bell(e.plate, e.yer);
      return true;
    },
    eldeYer: wid => elde.find(e => e.wid === wid)?.yer ?? null,
    elde: wid => elde.some(e => e.wid === wid),
    drop(wid) {
      for (let i = cooking.length - 1; i >= 0; i--) if (cooking[i].wid === wid) cooking.splice(i, 1);
      for (const t of tepsi) if (t.wid === wid) t.wid = 0;
      for (let i = elde.length - 1; i >= 0; i--) if (elde[i].wid === wid) { const e = elde.splice(i, 1)[0]; if (pass.length < PASS_KAP) pass.push({ plate: e.plate, idle: 0, yer: e.yer }); }
    },
    passTake(f, yer) {
      const i = pass.findIndex(p => p.plate.type === f && (!yer || p.yer === yer)); if (i < 0) return null;
      return pass.splice(i, 1)[0].plate;
    },
    geriKoy(plate, yer = 'on') { if (pass.length >= PASS_KAP) return false; pass.push({ plate, idle: 0, yer }); return true; },
    passCount: (f, yer) => pass.reduce((n, p) => n + ((f == null || p.plate.type === f) && (!yer || p.yer === yer) ? 1 : 0), 0),
    bekleyenTepsi: yas => tepsi.some(t => !t.wid && t.t >= yas),
    view() {
      const ist: Record<string, IstDurum> = {};
      for (const c of cooking) ist[c.ist] = { d: 'pisiyor', p: c.food };
      for (const t of tepsi) ist[t.ist] = { d: 'hazir', p: t.plate.type };
      const py = (y: PassYer) => pass.filter(p => p.yer === y).map(p => p.plate.type);
      return { pass: pass.map(p => p.plate.type), passYer: { on: py('on'), W: py('W'), E: py('E') }, ist, devir: Object.fromEntries(devir), oyuncu: api.pDurum() };
    },
    durum: () => ({
      cooking: cooking.map(c => ({ wid: c.wid, ist: c.ist, p: c.food, no: c.ticket ? c.ticket.no : 0, t: c.t })),
      tepsi: tepsi.map(t => ({ ist: t.ist, p: t.plate.type, wid: t.wid, t: t.t })), elde: elde.map(e => ({ wid: e.wid, p: e.plate.type, t: e.t })), pass: pass.map(p => p.plate.type),
      asim, sahipsiz, zil,
    }),
    update(dt) {
      const tk = deps.tickets();
      // BUF-06: devir kayıtları geçerli kalsın (aşçı gitti / istasyon artık yok); oyuncunun elinden düşen tabak sayımdan çıkar
      for (const [i, w] of [...devir]) if (!S.workers.some(k => k.id === w && k.role === 'asci') || !mutfakEsya(stage()).includes(i)) devir.delete(i);
      const eldeki = new Set<object>(carryPlates());
      for (let i = elde.length - 1; i >= 0; i--) if (elde[i].wid === OYUNCU && !eldeki.has(elde[i].plate)) elde.splice(i, 1);
      for (let i = cooking.length - 1; i >= 0; i--) {
        const c = cooking[i];
        if (c.wid === OYUNCU) {   // oyuncunun işi yalnız başında dururken (pTik) ilerler; bırakıp giderse ayırdığı istasyon boşalır
          c.off += dt; if (c.off > OFF_S) cooking.splice(i, 1); else if (c.ticket && !tk.includes(c.ticket)) c.ticket = null;
          continue;
        }
        c.t += dt;
        if (c.ticket && !tk.includes(c.ticket)) c.ticket = null;   // bilet düştü: tabak yine biter, kimse istemezse havuzdan silinir
        if (c.t > hazirlikOf(c.food) + 60) { cooking.splice(i, 1); asim++; }   // aşçı kayboldu: istasyon serbest
      }
      for (const t of tepsi) { t.t += dt; if (t.wid) { t.claimT += dt; if (t.claimT > CLAIM_S) { t.wid = 0; asim++; } } }
      for (let i = elde.length - 1; i >= 0; i--) { const e = elde[i]; e.t += dt; if (e.wid !== OYUNCU && e.t > 60) { elde.splice(i, 1); asim++; if (pass.length < PASS_KAP) pass.push({ plate: e.plate, idle: 0, yer: e.yer }); } }
      // kimsenin istemediği tabak: 30 sn sonra sessizce silinir (stok birikmez)
      const need = new Map<FoodId, number>();
      for (const t of tk) for (const f in t.want) need.set(f, (need.get(f) || 0) + Math.max(0, (t.want[f] || 0) - deps.jobs(t, f) - cooking.filter(c => c.ticket === t && c.food === f).length));
      const mark = (o: { plate: Plate; idle: number }) => { const n = need.get(o.plate.type) || 0; if (n > 0) { need.set(o.plate.type, n - 1); o.idle = 0; return false; } o.idle += dt; return o.idle > ORPHAN_S; };
      for (let i = 0; i < pass.length; i++) if (mark(pass[i])) { pass.splice(i--, 1); sahipsiz++; }
      for (const e of elde) { const n = need.get(e.plate.type) || 0; if (n > 0) need.set(e.plate.type, n - 1); }
      for (let i = 0; i < tepsi.length; i++) { const t = tepsi[i]; if (mark(t) && !t.wid) { tepsi.splice(i--, 1); sahipsiz++; } }
    },
  };
  return api;
}
