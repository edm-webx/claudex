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
 * Durum çalışma anıdır (kayda yazılmaz): yeniden yüklemede boş başlar, açık biletler de zaten kalıcı değil.
 */
import type { Vec2 } from '../../engine/api';
import type { Kernel, Plate } from './state';
import { PASS_KAP, hatUyeleri, pisirmeSuresi } from '../../content/mutfak';
import { calismaIstasyonu, hazirlikOf, isProduct, type FoodId } from '../../content/yemek-menu';
import { mutfakStand, mutfakDunya, MUTFAK_NOKTA } from '../../content/ic-mekan';
import { rankOf } from '../../content/ranks';

export interface HatTicket { no: number; table: number; want: Record<string, number | undefined> }
export interface HatDeps<T extends HatTicket> {
  tickets(): readonly T[];
  /** plates of `f` already handed to a garson for ticket `t` */
  jobs(t: T, f: FoodId): number;
}
export interface IstDurum { d: 'pisiyor' | 'hazir'; p: FoodId }
export interface MutfakHatApi<T extends HatTicket = HatTicket> {
  /** aşçı `wid` için en eski bilet kalemini ve boş istasyonunu ayırır (yiyecek döner, yoksa null) */
  claim(wid: number, from?: Vec2): FoodId | null;
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
  /** elinde tabak var mı */
  elde(wid: number): boolean;
  /** işçi gitti / iş iptal: ayırdığı her şeyi bırak (eldeki tabak pass'a, yer yoksa kaybolur) */
  drop(wid: number): void;
  passTake(f: FoodId): Plate | null;
  passCount(f?: FoodId): number;
  /** komi yokken / 6 sn alınmayan tepsi tabağı var mı (boştaki aşçı alır) */
  bekleyenTepsi(yas: number): boolean;
  view(): { pass: FoodId[]; ist: Record<string, IstDurum> };
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
  type Cook = { wid: number; ticket: T | null; food: FoodId; ist: string; t: number };
  type Tep = { ist: string; plate: Plate; idle: number; wid: number; claimT: number; t: number; by: number };
  type Eld = { wid: number; plate: Plate; t: number };
  type Pas = { plate: Plate; idle: number };
  const cooking: Cook[] = [], tepsi: Tep[] = [], elde: Eld[] = [], pass: Pas[] = [];
  let asim = 0, sahipsiz = 0, zil = 0;
  const stage = () => S.stage || 1;
  const busy = (ist: string) => cooking.some(c => c.ist === ist) || tepsi.some(t => t.ist === ist);
  const inLine = () => cooking.length + tepsi.length + elde.length + pass.length;
  const asciN = () => S.workers.filter(w => w.role === 'asci').length;
  const standW = (ist: string) => mutfakDunya(mutfakStand(ist));

  function pickStation(f: FoodId, from?: Vec2): string | null {
    let uyeler = hatUyeleri(calismaIstasyonu(f, stage()), stage());
    if (asciN() < 2) uyeler = uyeler.slice(0, 1);   // ikinci hat yalnız iki ve fazla aşçı varken
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

  const api: MutfakHatApi<T> = {
    claim(wid, from) {
      if (cooking.some(c => c.wid === wid) || elde.some(e => e.wid === wid)) return null;
      if (inLine() >= PASS_KAP) return null;
      const spare = spareOf();
      for (const t of deps.tickets()) {
        for (const f of Object.keys(t.want)) {
          let left = (t.want[f] || 0) - deps.jobs(t, f) - cooking.filter(c => c.ticket === t && c.food === f).length;
          const sp = spare.get(f) || 0, use = Math.min(Math.max(0, left), sp); spare.set(f, sp - use); left -= use;
          if (left <= 0) continue;
          const ist = pickStation(f, from);
          if (!ist) continue;   // o kalemin istasyonları dolu: sıradaki kaleme bak
          cooking.push({ wid, ticket: t, food: f, ist, t: 0 });
          return f;
        }
      }
      return null;
    },
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
      // tabakta by/carrier yok: mutfak tabağı ücret payı kesmez (BUF-04 ekonomisi aynı kalır; maaş BUF-17'nin)
      tepsi.push({ ist: c.ist, plate: { type: c.food, tier: isProduct(c.food) ? S.tiers[c.food] || 1 : 1 }, idle: 0, wid: 0, claimT: 0, t: 0, by: wid });
      return true;
    },
    tasiClaim(wid, opt = {}) {
      if (elde.some(e => e.wid === wid)) return null;
      const own = tepsi.find(t => t.wid === wid); if (own) return { ist: own.ist, p: own.plate.type };
      const t = tepsi.find(k => !k.wid && (!opt.kendi || k.by === wid) && k.t >= (opt.yas || 0));
      if (!t) return null;
      t.wid = wid; t.claimT = 0;
      return { ist: t.ist, p: t.plate.type };
    },
    tasiAl(wid) {
      const i = tepsi.findIndex(t => t.wid === wid); if (i < 0) return null;
      const t = tepsi.splice(i, 1)[0];
      elde.push({ wid, plate: t.plate, t: 0 });
      return t.plate;
    },
    done(wid) {
      const i = elde.findIndex(e => e.wid === wid); if (i < 0) return false;
      if (pass.length >= PASS_KAP) return false;
      const e = elde.splice(i, 1)[0];
      pass.push({ plate: e.plate, idle: 0 });
      const at = mutfakDunya(MUTFAK_NOKTA.passAsci);
      const tk = deps.tickets().find(t => (t.want[e.plate.type] || 0) > 0);
      zil++;
      K.logEv('passBell', { no: tk?.no ?? 0, table: tk?.table ?? -1, p: e.plate.type, x: at.x, z: at.z });
      return true;
    },
    elde: wid => elde.some(e => e.wid === wid),
    drop(wid) {
      for (let i = cooking.length - 1; i >= 0; i--) if (cooking[i].wid === wid) cooking.splice(i, 1);
      for (const t of tepsi) if (t.wid === wid) t.wid = 0;
      for (let i = elde.length - 1; i >= 0; i--) if (elde[i].wid === wid) { const e = elde.splice(i, 1)[0]; if (pass.length < PASS_KAP) pass.push({ plate: e.plate, idle: 0 }); }
    },
    passTake(f) {
      const i = pass.findIndex(p => p.plate.type === f); if (i < 0) return null;
      return pass.splice(i, 1)[0].plate;
    },
    passCount: f => (f == null ? pass.length : pass.reduce((n, p) => n + (p.plate.type === f ? 1 : 0), 0)),
    bekleyenTepsi: yas => tepsi.some(t => !t.wid && t.t >= yas),
    view() {
      const ist: Record<string, IstDurum> = {};
      for (const c of cooking) ist[c.ist] = { d: 'pisiyor', p: c.food };
      for (const t of tepsi) ist[t.ist] = { d: 'hazir', p: t.plate.type };
      return { pass: pass.map(p => p.plate.type), ist };
    },
    durum: () => ({
      cooking: cooking.map(c => ({ wid: c.wid, ist: c.ist, p: c.food, no: c.ticket ? c.ticket.no : 0, t: c.t })),
      tepsi: tepsi.map(t => ({ ist: t.ist, p: t.plate.type, wid: t.wid, t: t.t })), elde: elde.map(e => ({ wid: e.wid, p: e.plate.type, t: e.t })), pass: pass.map(p => p.plate.type),
      asim, sahipsiz, zil,
    }),
    update(dt) {
      const tk = deps.tickets();
      for (let i = cooking.length - 1; i >= 0; i--) {
        const c = cooking[i]; c.t += dt;
        if (c.ticket && !tk.includes(c.ticket)) c.ticket = null;   // bilet düştü: tabak yine biter, kimse istemezse havuzdan silinir
        if (c.t > hazirlikOf(c.food) + 60) { cooking.splice(i, 1); asim++; }   // aşçı kayboldu: istasyon serbest
      }
      for (const t of tepsi) { t.t += dt; if (t.wid) { t.claimT += dt; if (t.claimT > CLAIM_S) { t.wid = 0; asim++; } } }
      for (let i = elde.length - 1; i >= 0; i--) { const e = elde[i]; e.t += dt; if (e.t > 60) { elde.splice(i, 1); asim++; if (pass.length < PASS_KAP) pass.push({ plate: e.plate, idle: 0 }); } }
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
