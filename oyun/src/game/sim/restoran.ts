/**
 * Faz 2 restoran sistemi (content/restoran.ts): the adisyon (ticket) table service. Pure sim: no three, no DOM, seeded rng only. Persistent bits live in GameState.zones['restoran']
 * (created on first read, so old saves load untouched); tickets are runtime only (table guests don't survive a reload).
 *
 * Interactables (dwell rule like everything else):
 *   `servis.<i>`   at table i: hand over one item from the hands that the table's ticket still wants.
 * Hooks used by customers.ts: rt.restoran.wantMasa() (spawner), rezerve(p) (garsonun ayırdığı tezgâh tabağı).
 * Views/UI read restoranApi(rules).view().
 *
 * BUF-09 garson akışı (ışınlanma yok): garson varken masa müşterisine garson menü götürür, müşteri 3-5 sn bakar, garson gelip siparişi
 * not alır (fiş O AN yazılır), pass'taki / tezgâhtaki gerçek tabakları alır (seviye 1-3: 2, 4+: 3 tabak; content/ranks garsonTasima),
 * yürüyerek masaya götürür; son tabakta müşteri yemeğe başlar, hesabı garson getirir ve ödeme o an yapılır (odemeYap tek giriş),
 * kalkınca masada kirli tabak kalır, garson (temizlikçi varsa o) silene kadar masaya kimse oturmaz. Garson meşgulse müşteri bekler
 * (sipariş için bekleSabirS, hesap için en çok hesapBekleMaxS sonra parayı masaya bırakır). Garson yoksa oyuncu servis yapar:
 * bilet orderDelay sonra açılır, müşteri yemeği bitince kendisi öder. Görev kuyruğu sırası: sıcak tabak > sipariş > menü > hesap > sil;
 * iş zaman aşımı garsonun işi aldığı andan sayılır, işten çıkan garsonun işleri havuza / tabakları rafa döner (takılı iş yok).
 * BUF-10: masalar konuma göre bölgelere ayrılır (sim/garson-bolge.ts), garson başına bölge, boştaki garson komşu bölgeye yardım eder;
 * bahşiş ortak kumbarada birikir (oyuncuya gelir değil), gün sonunda (karne.ts) garsonlara eşit paylaşılır.
 */
import { mutfakEtki, sefHizi, mutfakEsya, MUTFAK_IST_BY_ID, PASS_KAP } from '../../content/mutfak';
import { ADISYON, ADISYON_LINES, SERVIS, FAZ2_UI, type GarsonTur } from '../../content/restoran';
import { bolgeleriKur, bolgeAtamasi, type Bolge } from './garson-bolge';
import { YEMEK } from '../../content/ekonomi2';
import { DISH_BY_ID, acikYemekler, menuPano, yemekAgirlik, yemekAd, isProduct, type DishId, type FoodId, type MenuAsama } from '../../content/yemek-menu';
import { icIcinde, mutfakDunya, mutfakStand, mutfakOda, passAcik, passAsciUV, passGarsonNokta, type PassYer } from '../../content/ic-mekan';
import { installMutfakHat, OYUNCU, type IstDurum, type MutfakHatApi, type OyuncuIs } from './mutfak-hat';
import { DWELL_DEFAULTS, type Vec2 } from '../../engine/api';
import type { ProductId } from './schema';
import type { Kernel, Customer, Item, Order, Plate } from './state';
import { clamp } from './util';
import { kanatOf, masaCati, kanatYanı, kanatFiyatX, kanatKurulu, KANAT_POST, type KanatBolge } from '../../content/kanat';
import { salonKatYan } from './salon';

export const RESTORAN_KEY = 'restoran';
/** oyuncu mutfaktan çıktıktan sonra bu kadar sn hâlâ mutfakta sayılır (yeni biletler yemek içerebilir) */
const OYUNCU_MUTFAK_S = 45;
interface Save { servis: number; no: number; kumbara?: number; sonDagitim?: BahsisDagitim | null }
/**
 * Bilet kalemi: ya eski tezgâh ürünü (dish null, food = ProductId) ya da menüdeki bir yemek (food = dish = DishId). BUF-05: yemek
 * kendi adıyla kendi istasyonunda pişer ve kendi tabağıyla (Plate.type = DishId) masaya gider; taşıyıcı ürün köprüsü yok.
 * Tadım menüsü: kurs>1, her servis ayrı kalem.
 */
export interface TicketLine { food: FoodId; dish: DishId | null; fiyat: number; done: boolean; kurs: number }
export type FoodOrder = Record<FoodId, number | undefined>;
export interface Ticket { no: number; table: number; cid: number; want: FoodOrder; all: FoodOrder; lines: TicketLine[]; t: number; max: number }
export interface TicketView { no: number; table: number; items: { p: FoodId; dish: DishId | null; name: string; n: number; left: number }[]; frac: number }
/** Kaldırılan stant sisteminden kalan boş sözleşme: stant-look.ts / world/index.ts / boot.ts temizlenene kadar. */
export interface StantView { id: string; name: string; short: string; owned: boolean; buyable: boolean; cost: number; price: number; stock: number; max: number; x: number; z: number; ry: number; look: string; color: string }
export interface RestoranView {
  active: boolean; tickets: TicketView[]; servis: number; stands: StantView[];
  /** BUF-05 mutfak: pass rafındaki tabaklar (FoodId, en eski önce), istasyon durumları, şef hızı (0..0.6) */
  pass: FoodId[]; /** 2026-11-21: pass penceresine göre (sokak / batı salonu / doğu salonu) */ passYer: Record<PassYer, FoodId[]>; ist: Record<string, IstDurum>; sefHizi: number;
  /** BUF-06: oyuncunun pişirdiği istasyon / ilerleme, devredilen istasyonlar (istasyon -> aşçı) */
  oyuncu: OyuncuIs; devir: Record<string, { wid: number; ad: string }>;
  /** BUF-09 masa durumları (kurulu masalar) */
  masalar: MasaView[];
}
/** BUF-09: masa durumu (sabır çubuğu BUF-23 bundan çizer): frac = bekleme sabrı / bilet süresi / hesap beklemesi doluluğu 0..1 */
export interface MasaView { table: number; durum: 'bos' | 'menu' | 'siparis' | 'tabak' | 'yemek' | 'hesap' | 'kirli'; frac: number }
export type GorevTur = GarsonTur;
/** isAl sonucu: tabak için x,z pass/tezgâh durağı, masa işleri için masanın garson tarafı (yan) */
export interface IsAlSonuc { id: number; tur: GorevTur; table: number; x: number; z: number; n?: number }
/** garsonun elindeki (tepsideki) bir tabak: x,z hedef masanın yanı, geri ise gx,gz bırakılacak yer (pass ya da tezgâh) */
export interface TepsiTabak { id: number; p: FoodId; table: number; x: number; z: number; geri: boolean; gx: number; gz: number }
export interface IsTamamSonuc { durum: 'tamam' | 'tasi' | 'geri' | 'yok'; table?: number; x?: number; z?: number }
export interface BahsisDagitim { day: number; toplam: number; kalan: number; pay: { wid: number; ad: string; tutar: number }[] }
export interface RestoranApi {
  handle(c: { kind: string; [k: string]: unknown }): boolean;
  view(): RestoranView;
  /** menü panosu: aşama aşama açılan yemek listesi (kilitliler 'Aşama N'de açılır') */
  menu(): MenuAsama[];
  /** şu an masa biletinde çıkabilecek yemekler (aşama açık + taşıyıcı ürün yapılı) */
  openDishes(): DishId[];
  wantMasa(): boolean;
  update(dt: number): void;
  register(): void;
  // ── BUF-09 garson görev kuyruğu (öncelik: sıcak tabak > sipariş > menü > hesap > masa sil) ──
  /** garson `wid` için sıradaki işi ayırır (tabak: kapasiteye kadar, aynı kaynaktan); zaten işi varsa onu döner */
  isAl?(wid: number, o: { cap: number; at?: Vec2 }): IsAlSonuc | null;
  /** garson pass'a / tezgâha vardı: ayırdığı tabakları gerçekten alır (rafta yoksa iş düşer) */
  tabakAl?(wid: number): TepsiTabak[];
  /** elindeki tabaklar (hedef masa ya da geri bırakılacak yer) */
  tepsi?(wid: number): TepsiTabak[];
  /** iş masada bitti (at: garsonun konumu; masadan uzaksa stats.isinlanma artar) */
  isTamam?(wid: number, id: number, at: Vec2): IsTamamSonuc;
  /** geri dönen tabakları pass'a / tezgâha bırak (vardığında) */
  tabakGeri?(wid: number): number;
  /** garsonun tüm işlerini bırak (zaman aşımı, işten çıkma, pencere görevi): masa işleri havuza döner, eldeki tabak rafına */
  isBirak?(wid: number): void;
  /** BUF-05: garsonun tabakları mutfak pass rafından alacaksa oradaki durak (dünya), tezgâhtan alacaksa null */
  passDurak?(wid: number): Vec2 | null;
  /** sıra/pencere müşterisinin tezgâhtan alamayacağı (garsonun ayırdığı) ürün sayısı */
  rezerve?(p: ProductId): number;
  /** test / denetim */
  debug?(): { gorevler: number; tepsi: number; claimed: number; isinlanma: number };
  // ── BUF-10 bölgeler + ortak bahşiş kumbarası ──
  /** masa kümeleri ve garson ataması (UI: bölge seçici bunu okur) */
  bolgeler?(): { id: string; masalar: number[]; komsu: string[]; garsonlar: number[] }[];
  /** BUF-19: bölgesi bir kanat / salon olan garsonun boştaki postu (çay bahçesi: çay ocağı önü, çaycı) */
  garsonPost?(wid: number): ({ bolge: KanatBolge } & Vec2) | null;
  /** garsonun bölgesi (null: bölgesiz / serbest) */
  bolgeOf?(wid: number): string | null;
  /** elle bölge ata: id bir bölge kimliği, '*' serbest, null otomatik. Çalışma anı (kayda yazılmaz). */
  bolgeAta?(wid: number, id: string | null): boolean;
  /** kumbara: bugün biriken bahşiş ve son gün sonu paylaşımı */
  kumbara?(): { birikim: number; son: BahsisDagitim | null };
  /** gün sonu (karne.ts endDay): kumbarayı garsonlara eşit paylaştır (garson yoksa tüm ekibe, ekip yoksa ertesi güne kalır) */
  kumbaraDagit?(day: number): BahsisDagitim | null;
  /** BUF-05 mutfak hattı (sim/mutfak-hat.ts): en eski bilet kalemini ve boş istasyonunu ayırır */
  kitchenClaim?(wid: number, opt?: { from?: Vec2 }): FoodId | null;
  /** legacy tek adım: ok=true pişen tabağı doğrudan pass'a koyar (ya da eldekini), ok=false işi bırakır */
  kitchenDone?(wid: number, ok: boolean): void;
  kitchenIst?(wid: number): string | null;
  kitchenSure?(wid: number): number;
  kitchenReady?(wid: number): boolean;
  kitchenTasi?(wid: number, opt?: { kendi?: boolean; yas?: number }): { ist: string; p: FoodId } | null;
  kitchenTasiAl?(wid: number): Plate | null;
  kitchenPass?(wid: number): boolean;
  /** 2026-11-21: elindeki tabağın gideceği pass penceresi */
  kitchenPassYer?(wid: number): PassYer | null;
  kitchenDrop?(wid: number): void;
  kitchenBekleyen?(yas: number): boolean;
  /** BUF-06: aşçının devraldığı istasyon (yoksa null); komut: { kind:'restoran', op:'devret', ist, wid? } / { op:'devirAl', ist } */
  kitchenDevir?(wid: number): string | null;
  /** BUF-06: yemek biletleri şu an çıkabilir mi: (aşçı ya da oyuncu mutfakta) pişirir, (garson ya da oyuncu) taşır */
  mutfakHazir?(): boolean;
  /** mutfak hattının kendisi (testler, görünüm) */
  hat?: MutfakHatApi<Ticket>;
}
type Cu = { leave(c: Customer, angry: boolean): void; say(c: Customer, t: string, s?: number): void; seatPos(t: number, s: number): Vec2 | null };

export function restoranApi(r: { rt: unknown } | null | undefined): RestoranApi | null { return r ? ((r.rt as { restoran?: RestoranApi }).restoran || null) : null; }

export function installRestoran(K: Kernel, cu: Cu, settle: (c: Customer, items: Plate[]) => number, addMoneyTo: (p: { value: number }[], v: number) => void): RestoranApi {
  const rt = K.rt, S = K.state, rng = K.rng('sim.restoran');
  void addMoneyTo;   // BUF-10: bahşiş artık masa yığınına düşmüyor (ortak kumbara); imza rules.ts ile uyumlu kalsın
  const G = (): Save => {
    if (!S.zones || typeof S.zones !== 'object') S.zones = {};
    let g = S.zones[RESTORAN_KEY] as unknown as Save | undefined;
    if (!g || typeof g !== 'object') { g = {} as Save; S.zones[RESTORAN_KEY] = g as unknown as Record<string, unknown>; }
    g.servis = Number.isFinite(g.servis) ? g.servis : SERVIS.start; g.no = g.no | 0;
    return g;
  };
  const tickets: Ticket[] = [];
  /**
   * BUF-09 görev kuyruğu. menu/siparis/hesap satırları müşteri adımında üretilir (wid 0 = sahipsiz); tabak ve sil satırları
   * garson isAl ile ayırınca doğar (sanal). Tabak satırı `item` tutuyorsa tabak garsonun elinde (tepside) demektir; o ana kadar
   * tabak rafta (pass ya da tezgâh) GÖRÜNÜR durur. Hiçbir yol tabağı masaya kendiliğinden koymaz.
   */
  interface Gorev { id: number; tur: GorevTur; table: number; cid: number; yas: number; wid: number; claimT: number; ticket?: Ticket; p?: FoodId; src?: 'pass' | 'counter'; /** 2026-11-21: tabağın alındığı / geri konacağı pass */ yer?: PassYer; item?: Plate; geri?: boolean }
  const gorevler: Gorev[] = []; let gid = 1, saat = 0;
  type CF = { tk?: boolean; menuJob?: boolean; menuOk?: boolean; dusunT?: number; siparisJob?: boolean; hesapJob?: boolean; hesapBekle?: boolean; bekleT?: number; hb?: number; garsonlu?: boolean; tipUsed?: number };
  const active = () => (S.stage || 1) >= ADISYON.fromStage;
  const custOf = (t: Ticket) => rt.customers.find(c => c.id === t.cid) || null;
  const custById = (id: number) => rt.customers.find(c => c.id === id) || null;
  const add = (o: Record<string, number | undefined>, p: string, n = 1) => { o[p] = (o[p] || 0) + n; };
  const left = (t: Ticket) => Object.values(t.want).reduce<number>((s, n) => s + (n || 0), 0);
  const garsonlar = () => S.workers.filter(w => w.role === 'garson');
  const salonEsya = () => ((S.zones?.salon as { esya?: string[] } | undefined)?.esya) || [];
  /** kanat masasının tarafındaki salon aletleri (büfe masası: 1, 1) */
  const kanatKat = (table: number) => { const km = kanatOf(table); return km ? salonKatYan(salonEsya(), S.stage || 1, kanatYanı(km.bolge)) : { mis: 1, adis: 1 }; };
  const tabakTasks = (t: Ticket, f: FoodId, eldeMi?: boolean) => gorevler.filter(g => g.tur === 'tabak' && g.ticket === t && g.p === f && (eldeMi === undefined || !!g.item === eldeMi)).length;
  // kumbara (BUF-10, sahip kararı 2026-11-09): bahşiş oyuncuya gelir olarak yazılmaz, garsonların ortak kumbarasında birikir,
  // gün sonunda paylaşılır. 2026-11-21: birikim S.zones.restoran içinde saklanır (yeniden yüklemede sıfırlanmıyor).
  let kumbara = 0, sonDagitim: BahsisDagitim | null = null, isinlanma = 0, kumbaraYuklu = false;
  const kumbaraYukle = () => { if (kumbaraYuklu) return; kumbaraYuklu = true; const g = G(); kumbara = Math.max(0, Number(g.kumbara) || 0); sonDagitim = g.sonDagitim ?? null; };
  const kumbaraYaz = () => { const g = G(); g.kumbara = Math.round(kumbara * 100) / 100; g.sonDagitim = sonDagitim; };

  // stations produce for open tickets too (room above the counter stock)
  rt.reserved.push(() => { const r: Order = {}; for (const t of tickets) for (const p in t.want) if (isProduct(p)) add(r, p, t.want[p] || 0); return r; });
  // BUF-05: mutfak hattı (istasyonlar, tepsi, pass rafı). Garsonun ELİNDEKİ tabaklar bilete sayılır; ayrılmış ama raftaki tabak hâlâ raftadır.
  // BUF-15: paket biletleri (sim/kurye.ts rt.teslimat) masa biletlerinin ARKASINDA aynı hatta pişer; masa mantığı (garson, sabır, hesap) onlara dokunmaz
  const paketler = (): readonly Ticket[] => (rt as unknown as { teslimat?: { biletler(): Ticket[] } }).teslimat?.biletler() ?? [];
  /**
   * 2026-11-21 restoran: masanın tabağı hangi pass'tan çıkar. Batı kanadı (çay bahçesi, kahvaltı salonu, batı çatısı) batı salonunun
   * pass'ından (aşama 6+), doğu kanadı (dondurma terası, balık lokantası, doğu çatısı) doğu salonunun pass'ından (aşama 7+); büfe önü
   * masaları ve salonlar açılmadan önce mutfağın sokak pass'ı.
   */
  function yerOfTable(table: number): PassYer {
    const k = kanatOf(table); if (!k) return 'on';
    const y: PassYer = kanatYanı(k.bolge); return passAcik(y, S.stage || 1) ? y : 'on';
  }
  const hat = installMutfakHat<Ticket>(K, {
    tickets: () => { const p = paketler(); return p.length ? [...tickets, ...p] : tickets; }, jobs: (t, f) => tabakTasks(t, f, true),
    yer: f => { const t = tickets.find(k => (k.want[f] || 0) - tabakTasks(k, f) > 0); return t ? yerOfTable(t.table) : 'on'; },
  });
  // BUF-06: oyuncu mutfakta (ya da yeni çıktı) ise pişirir ve taşır: aşçı ya da oyuncu pişirir, garson ya da oyuncu taşır
  let oyuncuMutfakT = -1e9;
  const oyuncuAktif = () => saat - oyuncuMutfakT < OYUNCU_MUTFAK_S;
  /** yemek masa biletine ancak mutfak pişirip getirebiliyorsa çıkar: (aşçı ya da oyuncu) pişirir, (garson ya da oyuncu) pass'tan taşır */
  const mutfakHazir = () => (S.workers.some(w => w.role === 'asci') || oyuncuAktif()) && (S.workers.some(w => w.role === 'garson') || oyuncuAktif());

  function freeTable(): number {
    for (let i = 0; i < rt.tables.length; i++) {
      const t = rt.tables[i];
      if (t && t.built && t.dirty <= 0 && t.seats.every(s => !s.occ) && !tickets.some(k => k.table === i) && (!masaCati(i) || garsonlar().length)) return i;
    }
    return -1;
  }
  /** garsonun masada durduğu yer: koltuksuz taraf (ax 'x' masada koltuklar x ekseninde, garson z tarafında) */
  function masaYan(i: number): Vec2 {
    const tb = rt.layout.tables[i]; if (!tb) return { x: 0, z: 0 };
    return tb.ax === 'z' ? { x: tb.x + 0.95, z: tb.z } : { x: tb.x, z: tb.z + 0.95 };
  }
  const passNokta = (yer: PassYer = 'on') => passGarsonNokta(yer);
  const tezgahNokta = (): Vec2 => ({ x: rt.layout.counter.standAt.x + 0.5, z: rt.layout.counter.standAt.z });
  const dishesNow = () => acikYemekler(S.stage || 1);
  function openTicket(c: Customer): void {
    if (!c.seat) return;
    const g = G();
    const units: ProductId[] = [];
    for (const p in c.order) for (let k = 0; k < (c.order[p as ProductId] || 0) && units.length < ADISYON.maxItems; k++) units.push(p as ProductId);
    if (!units.length) units.push(K.openProducts()[0] || 'cay');
    // menü: kalemlerin bir kısmı açık aşamanın yemeği (tip tercihine göre), kalanı eski ürünler; tadım menüsü tek siparişin kendisi
    const avail = mutfakHazir() ? dishesNow() : [], pay = YEMEK.pay[Math.max(0, Math.min(9, (S.stage || 1) - 1))] ?? 0;
    let lines: TicketLine[] = [], kursN = 1;
    for (const u of units) {
      if (avail.length && rng.next() < pay) {
        const w: Record<string, number> = {}; for (const d of avail) w[d.id] = yemekAgirlik(d, c.typeId, u);
        const d = DISH_BY_ID[rng.weighted(w)];
        if (d.kurs) { kursN = rng.int(d.kurs[0], d.kurs[1]); lines = Array.from({ length: kursN }, () => ({ food: d.id, dish: d.id, fiyat: Math.round(d.fiyat / kursN), done: false, kurs: kursN })); break; }
        lines.push({ food: d.id, dish: d.id, fiyat: d.fiyat, done: false, kurs: 1 });
      } else lines.push({ food: u, dish: null, fiyat: 0, done: false, kurs: 1 });
    }
    const want: FoodOrder = {}, po: Order = {};
    for (const l of lines) { add(want, l.food); if (isProduct(l.food)) add(po, l.food); }
    c.order = po; c.got = {};   // müşterinin tezgâh ürünü siparişi (yemekler bilette, adıyla)
    g.no = (g.no % 99) + 1;
    tickets.push({ no: g.no, table: c.seat.table, cid: c.id, want: { ...want }, all: { ...want }, lines, t: 0, max: ADISYON.patience + (kursN - 1) * YEMEK.kursSabir });
    K.logEv('ticket', { no: g.no, table: c.seat.table, x: c.x, z: c.z });
  }
  function deliver(t: Ticket, c: Customer, it: Plate): void {
    const p = it.type;
    const ln = t.lines.find(l => !l.done && l.food === p);
    if (ln) { ln.done = true; if (ln.dish) { it.priceX = (it.priceX || 1) * ln.fiyat / DISH_BY_ID[ln.dish].fiyat; K.stat('yemek_' + ln.dish); } }   // tadım menüsü: servis başına payı
    c.items.push(it); if (isProduct(p)) add(c.got, p);
    t.want[p] = Math.max(0, (t.want[p] || 0) - 1); if (!t.want[p]) delete t.want[p];
    K.logEv('serve', { x: c.x, z: c.z, table: t.table });
    if (!left(t)) complete(t, c);
  }
  /** son tabak masada: bilet kapanır, müşteri yemeğe başlar. Ödeme YOK: hesap gelince (odemeYap). */
  function complete(t: Ticket, c: Customer): void {
    tickets.splice(tickets.indexOf(t), 1);
    const g = G(), used = clamp(t.t / t.max, 0, 1), f = c as unknown as CF;
    f.tipUsed = used; f.hesapBekle = true; f.hesapJob = false; f.hb = 0;
    if (rng.next() < 0.1) cu.say(c, rng.pick(ADISYON_LINES.served), 2);
    g.servis = clamp(g.servis * (1 - SERVIS.weight) + 5 * (1 - used * 0.8) * SERVIS.weight, 0, 5);
    c.value = 0; c.state = 'eat'; c.t = 0; c.eatT = rng.range(ADISYON.eat[0], ADISYON.eat[1]) / kanatKat(t.table).mis;   // BUF-19: salon aleti misafir çarpanı masayı da çevirir
    K.stat('adisyon');
    { const T = S.today as unknown as { masaServis?: number; masaBekleS?: number } | null; if (T) { T.masaServis = (T.masaServis || 0) + 1; T.masaBekleS = (T.masaBekleS || 0) + t.t; } }   // gün sonu raporu: masa servis sayısı ve ortalama bekleme
  }
  /**
   * Hesap: tek ödeme giriş noktası (BUF-12 kasada ödeme de bunu çağırır). Satış settle ile kasaya; bahşiş formülü aynı
   * (hız bahşişi x mutfak etkisi, hesap kavgası x2) ama TAMAMI ortak kumbaraya (oyuncuya bahşiş geliri yok). Kumbara yalnız
   * takımda garson varken dolar (garsonların kumbarası).
   */
  function odemeYap(c: Customer, garsonla: boolean): void {
    const f = c as unknown as CF;
    if (!f.hesapBekle) return;
    f.hesapBekle = false;
    gorevSil(c.id, 'hesap');
    // BUF-19/20: kanat / salon / çatı masası: hesap = kalemler x kanat fiyat çarpanı x o tarafın salon aleti adisyon çarpanı
    const km = c.seat ? kanatOf(c.seat.table) : null, TX = S.today as unknown as { salonGelir?: number; salonMis?: number } | null;
    const x = km ? kanatFiyatX(S.stage || 1) * kanatKat(c.seat!.table).adis : 1;
    if (km) for (const it of c.items) it.priceX = (it.priceX || 1) * x;
    const value = settle(c, c.items.slice());
    if (km && TX) { TX.salonGelir = (TX.salonGelir || 0) + value; TX.salonMis = (TX.salonMis || 0) + c.n; K.stat('salonMasa'); }
    const used = f.tipUsed ?? 1;
    let tipF = ADISYON.tip[ADISYON.tip.length - 1][1];
    for (const [u, k] of ADISYON.tip) if (used <= u) { tipF = k; break; }
    // bahşiş kalemlerin çıplak değerinden (salon fiyat çarpanı bahşiş kavanozunu şişirmez)
    let tip = Math.round(value / x * tipF * (1 + mutfakEtki(S.workers).bahsis));
    if (c.n >= 2 && rng.next() < ADISYON.fightChance) { tip *= 2; cu.say(c, rng.pick(ADISYON_LINES.fight), 2.5); K.stat('hesapKavgasi'); }
    else if (garsonla) cu.say(c, rng.pick(ADISYON_LINES.hesap), 1.8);
    if (!garsonla) { cu.say(c, rng.pick(ADISYON_LINES.kendi), 2); K.stat('hesapKendisi'); }
    if (!garsonlar().length) tip = 0;
    if (tip > 0) { kumbaraYukle(); kumbara += tip; kumbaraYaz(); K.stat('tips'); K.stat('kumbara', tip); K.logEv('tip', { tip, kumbara: true }); }
    K.logEv('hesap', { value, tip, x: c.x, z: c.z, garson: garsonla });
  }
  function fail(t: Ticket, c: Customer | null): void {
    tickets.splice(tickets.indexOf(t), 1);
    const g = G(); g.servis = clamp(g.servis * (1 - SERVIS.weight), 0, 5);
    if (c) { cu.say(c, rng.pick(ADISYON_LINES.late), 2.5); c.items.splice(0); S.today!.angry++; K.logEv('angry', { type: c.typeId }); gorevSil(c.id); cu.leave(c, true); }
  }
  /** müşterinin bekleyen masa işlerini sil (elde tabak satırları kalır: garson onları başka masaya ya da rafa götürür) */
  function gorevSil(cid: number, tur?: GorevTur): void {
    for (let i = gorevler.length - 1; i >= 0; i--) { const g = gorevler[i]; if (g.cid === cid && g.tur !== 'tabak' && g.tur !== 'sil' && (!tur || g.tur === tur)) gorevler.splice(i, 1); }
  }
  /** raftan tabak bırakma: tezgâh ürünü tezgâha, yemek pass rafına; yer yoksa düşer (yoktan var etme yok) */
  function rafaKoy(it: Plate, yer: PassYer = 'on'): void {
    if (isProduct(it.type)) { const b = (rt.counter[it.type] ||= []); if (b.length < 8) { b.push(it as Item); return; } }
    else if (hat.geriKoy(it, yer)) return;
    K.stat('tabakDustu');
  }

  function register(): void {
    if (!FAZ2_UI) return;
    // table service plates
    rt.layout.tables.forEach((tb, i) => {
      if (masaCati(i)) return;   // BUF-20: çatı terası masalarına yalnız garson çıkar (oyuncu merdivenden çıkamaz, aşağıdan servis yok)
      const id = 'servis.' + i, ex = K.interactions.get(id);
      if (ex) { ex.pos = { x: tb.x, z: tb.z }; return; }
      K.interactions.register({
        id, pos: { x: tb.x, z: tb.z }, radius: 1.45, kind: 'table', dwell: 0.3, interval: 0.16,
        canAct: () => { const t = tickets.find(k => k.table === i); return !!t && rt.carry.some(it => (t.want[it.type] || 0) > 0); },
        act: () => {
          const t = tickets.find(k => k.table === i); if (!t) return 'done';
          const c = custOf(t); if (!c) return 'done';
          const k = rt.carry.findIndex(it => (t.want[it.type] || 0) > 0); if (k < 0) return 'done';
          const [it] = rt.carry.splice(k, 1); it.carrier = undefined as never;
          deliver(t, c, it);
          return tickets.includes(t) ? 'continue' : 'done';
        },
      });
    });
  }

  // ───────── BUF-06 oyuncu şef (mutfak istasyonları: dwell, bekle-al, pass'a bırak, devret) ─────────
  /**
   * `mutfak.<ist>` (stations.ts deseni): istasyonun başında durulunca KDS sırasındaki en eski uygun bilet kalemi otomatik seçilir,
   * süre yalnız başında dururken işler (pişirme formülü aynı: hat.sure), bitince tabak oyuncunun elinde (rt.carry). Elde tabak
   * varken başka istasyonda durmak ayrı bilete geçmektir (önceki iş bırakılır). Bilet yokken eller boşsa: o istasyon boştaki bir
   * aşçıya devredilir ('devredildi'); devredilmiş istasyonda yine bilet yokken durmak devri geri alır. `mutfak.pass`: eldeki
   * mutfak tabakları pass rafına bırakılır (masaya götürmek için mevcut `servis.<i>` kullanılır). Aşama 1-2'de mutfak yok: kayıt yok.
   */
  const handCap = () => 4 + (S.owned.tepsi1 ? 2 : 0) + (S.owned.tepsi2 ? 2 : 0);   // stations.ts carryCap ile aynı formül
  const pStat = { last: -99, fullT: -99, toggleT: -99 };
  const elleriDolu = () => rt.carry.length >= handCap();
  const bosAsci = () => asciler().find(w => !hat.devirIst(w.id)) ?? null;
  function asciler() { return S.workers.filter(w => w.role === 'asci'); }
  const pisirIstler = () => mutfakEsya(S.stage || 1).filter(i => MUTFAK_IST_BY_ID[i]?.islev === 'pisir');
  function pisirKur(ist: string) {
    const id = 'mutfak.' + ist;
    if (K.interactions.get(id)) return;
    const at = mutfakDunya(mutfakStand(ist));
    K.interactions.register({
      id, pos: { x: at.x, z: at.z }, radius: 0.6, kind: 'station', dwell: DWELL_DEFAULTS.station, interval: 0.1,
      canAct: () => {
        if (!pisirIstler().includes(ist)) return false;
        if (hat.ist(OYUNCU) === ist) return true;
        if (elleriDolu()) return false;
        if (hat.aday(ist)) return true;
        return rt.carry.length === 0 && (hat.devirOf(ist) != null || !!bosAsci());
      },
      act: (_a, ctx) => {
        let cur = hat.ist(OYUNCU);
        if (cur !== ist) {
          if (elleriDolu()) { if (ctx.t - pStat.fullT > 3) { pStat.fullT = ctx.t; K.toast('Eller dolu!', 'info'); } return 'continue'; }
          if (cur) hat.pBirak();   // başka bilete geçti
          const f = hat.claim(OYUNCU, undefined, { ist });
          if (!f) return devirDeneme(ist, ctx.t);
          pStat.last = -99; cur = ist; K.stat('oyuncuPisirme');
          K.toast(yemekAd(f) + ' pişiyor, başında dur.', 'info');
        }
        const el = ctx.t - pStat.last < 0.5 ? ctx.t - pStat.last : DWELL_DEFAULTS.station + 0.1;   // dwell süresi yapılmış iş sayılır
        pStat.last = ctx.t;
        rt.act = ist === 'cay_bar' ? 'pour' : 'cut'; rt.actT = 0.4;
        const pl = hat.pTik(el);
        if (pl) {
          rt.carry.push(pl as Item); K.stat('oyuncuTabak');
          K.toast(yemekAd(pl.type) + ' hazır: pass\'a bırak ya da masaya götür.', 'good');
        }
        return 'continue';
      },
    });
  }
  /** bilet yokken istasyonda durmak: devret ya da (devredilmişse) geri al; tek seferlik */
  function devirDeneme(ist: string, t: number): 'continue' | 'done' {
    if (t - pStat.toggleT < 1 || rt.carry.length) return 'continue';
    const w = hat.devirOf(ist);
    if (w != null) {
      pStat.toggleT = t; hat.devirAl(ist);
      K.toast('İstasyon senin: ' + (S.workers.find(k => k.id === w)?.name || 'aşçı') + ' serbest.', 'info'); return 'done';
    }
    const a = bosAsci(); if (!a) return 'continue';
    if (!hat.devret(ist, a.id)) return 'continue';
    pStat.toggleT = t; K.toast(a.name + ' ' + (MUTFAK_IST_BY_ID[ist]?.ad || ist) + ' istasyonunu devraldı (devredildi).', 'good');
    return 'done';
  }
  function passKur() {
    const id = 'mutfak.pass';
    if (K.interactions.get(id)) return;
    const at = mutfakDunya(passAsciUV('on'));
    K.interactions.register({
      id, pos: { x: at.x, z: at.z }, radius: 0.9, kind: 'counter', dwell: DWELL_DEFAULTS.counter, interval: 0.16,
      canAct: () => rt.carry.some(it => hat.mutfakTabagi(it)) && hat.passCount() < PASS_KAP,
      act: () => {
        const k = rt.carry.findIndex(it => hat.mutfakTabagi(it)); if (k < 0) return 'done';
        const it = rt.carry[k] as unknown as Plate;
        if (!hat.pPass(it)) { K.toast('Pass dolu, garson alsın.', 'info'); return 'done'; }
        rt.carry.splice(k, 1); K.stat('oyuncuPass');
        return rt.carry.some(x => hat.mutfakTabagi(x)) ? 'continue' : 'done';
      },
    });
  }
  let kayitKey = '';
  /** mutfak büyüdükçe (aşama) istasyon etkileşimleri eklenir; mutfak yoksa (aşama < 3, yeni oyun) kaldırılır */
  function mutfakKayit(): void {
    if (!FAZ2_UI) return;
    const ist = pisirIstler(), key = ist.join(',');
    if (key === kayitKey) return;
    kayitKey = key;
    for (const i of Object.keys(MUTFAK_IST_BY_ID)) { if (!ist.includes(i) && K.interactions.get('mutfak.' + i)) K.interactions.unregister('mutfak.' + i); }
    if (!ist.length) { if (K.interactions.get('mutfak.pass')) K.interactions.unregister('mutfak.pass'); return; }
    ist.forEach(pisirKur); passKur();
  }

  // ───────── BUF-10 bölgeler (çalışma anı) ─────────
  const elle = new Map<number, string>();
  let bolgeKey = '', bolgeList: Bolge[] = [], atama = new Map<number, string | null>();
  function bolgeYenile(): void {
    const ws = garsonlar().map(w => w.id), built: number[] = [];
    rt.tables.forEach((t, i) => { if (t && t.built && rt.layout.tables[i]) built.push(i); });
    const key = ws.join(',') + '|' + built.join(',') + '|' + [...elle].map(([w, b]) => w + ':' + b).join(',') + '|' + S.stage;
    if (key === bolgeKey) return;
    bolgeKey = key;
    // çatı masaları salonun tam üstünde: kümelemede ayrı dursunlar diye denize doğru kaydırılmış konumla (yalnız bölge hesabı)
    bolgeList = bolgeleriKur(rt.layout.tables.map((tb, i) => (masaCati(i) ? { x: tb.x, z: tb.z - 12 } : tb)), built, ws.length);
    atama = bolgeAtamasi(ws, bolgeList, elle);
  }
  const masaBolgesi = (table: number) => bolgeList.find(b => b.masalar.includes(table))?.id ?? null;
  /** bölge kuralı: kendi bölgesi / sahipsiz bölge hemen, komşu bölge iş `yardimBekleS` sahipsiz kalınca; bölgesiz garson her yer */
  function bolgeKurali(wid: number, table: number, yas: number): { ok: boolean; ic: boolean } {
    const z = atama.get(wid) ?? null; if (!z) return { ok: true, ic: true };
    const gz = masaBolgesi(table); if (!gz || gz === z) return { ok: true, ic: true };
    const sahip = garsonlar().some(w => w.id !== wid && atama.get(w.id) === gz);
    if (!sahip) return { ok: true, ic: false };
    const komsu = bolgeList.find(b => b.id === z)?.komsu.includes(gz) ?? false;
    return { ok: komsu && yas >= ADISYON.yardimBekleS, ic: false };
  }

  // ───────── per tick ─────────
  const tabakYas = new Map<Ticket, number>();   // biletin rafta hazır bekleyen tabağı ne kadardır sahipsiz (yardım kuralı)
  function rafSerbest(p: FoodId, src: 'pass' | 'counter', yer?: PassYer): number {
    const n = src === 'pass' ? hat.passCount(p, yer) : (isProduct(p) ? rt.counter[p]?.length || 0 : 0);
    return n - gorevler.filter(g => g.tur === 'tabak' && !g.item && g.p === p && g.src === src && (!yer || g.yer === yer)).length;
  }
  function update(dt: number): void {
    saat += dt;
    const gN = garsonlar().length;
    bolgeYenile();
    mutfakKayit();
    if (icIcinde(mutfakOda(S.stage || 1), K.playerPos, 0)) oyuncuMutfakT = saat;
    for (const c of rt.customers.slice()) {
      if (c.kind !== 'masa' || !c.seat || c.state === 'leave') continue;
      const f = c as unknown as CF;
      if (c.state === 'wait' && !f.tk) {
        f.bekleT = (f.bekleT || 0) + dt;
        if (gN === 0) {   // garson yok: oyuncu servis yapar (H-142), bilet kısa bakıştan sonra açılır
          gorevSil(c.id);
          if (c.t >= ADISYON.orderDelay) { f.tk = true; if (rng.next() < 0.2) cu.say(c, rng.pick(ADISYON_LINES.call), 1.8); openTicket(c); }
        } else {
          if (!f.menuOk && !gorevler.some(g => g.cid === c.id && g.tur === 'menu') && c.t >= 0.5) { f.menuJob = true; gorevler.push({ id: gid++, tur: 'menu', table: c.seat.table, cid: c.id, yas: 0, wid: 0, claimT: 0 }); }
          if (f.menuOk && !gorevler.some(g => g.cid === c.id && g.tur === 'siparis') && c.t >= (f.dusunT ?? 0)) {
            f.siparisJob = true; gorevler.push({ id: gid++, tur: 'siparis', table: c.seat.table, cid: c.id, yas: 0, wid: 0, claimT: 0 });
            if (rng.next() < 0.2) cu.say(c, rng.pick(ADISYON_LINES.call), 1.8);
          }
        }
        if (!f.tk && f.bekleT > ADISYON.bekleSabirS) {   // kimse siparişi almadı: sabırla kalkar
          cu.say(c, rng.pick(ADISYON_LINES.late), 2.5); S.today!.angry++; K.logEv('angry', { type: c.typeId }); K.stat('siparisBekleKalkti');
          gorevSil(c.id); cu.leave(c, true);
        }
        continue;
      }
      if (c.state === 'eat' && f.hesapBekle) {
        if (gN > 0) f.garsonlu = true;
        if (!f.hesapJob && gN > 0 && c.t >= c.eatT - 1) { f.hesapJob = true; gorevler.push({ id: gid++, tur: 'hesap', table: c.seat.table, cid: c.id, yas: 0, wid: 0, claimT: 0 }); }
        if (c.t >= c.eatT) {
          f.hb = (f.hb || 0) + dt;
          // garson hiç yoksa (oyuncu servisi) müşteri yemeği bitince parayı masaya bırakır; garson varken hesabı bekler (en çok hesapBekleMaxS)
          if ((gN === 0 && !f.garsonlu) || f.hb >= ADISYON.hesapBekleMaxS) odemeYap(c, false);
        }
      }
    }
    for (let i = tickets.length - 1; i >= 0; i--) {
      const t = tickets[i], c = custOf(t);
      if (!c || c.state === 'leave') { tickets.splice(i, 1); continue; }
      t.t += dt;
      if (t.t >= t.max) fail(t, c);
    }
    // gözcü: sahibi gitmiş / zaman aşımına düşmüş satırlar bırakılır; müşterisi gitmiş masa işleri silinir
    const ids = new Set(garsonlar().map(w => w.id));
    for (const g of gorevler.slice()) {
      if (!gorevler.includes(g)) continue;
      if (g.wid && !ids.has(g.wid)) { isBirak(g.wid); continue; }
      if (g.wid && saat - g.claimT > ADISYON.isZamanAsimiS + 5) { K.stat('isZamanAsimi'); isBirak(g.wid); continue; }
      if (g.tur === 'menu' || g.tur === 'siparis' || g.tur === 'hesap') {
        const c = custById(g.cid);
        if (!c || c.state === 'leave') { gorevler.splice(gorevler.indexOf(g), 1); continue; }
        if (!g.wid) g.yas += dt;
      }
      if (g.tur === 'tabak' && !g.item && !tickets.includes(g.ticket!)) gorevler.splice(gorevler.indexOf(g), 1);   // bilet düştü, tabak rafta kalır
      if (g.tur === 'sil' && !(rt.tables[g.table]?.dirty > 0)) gorevler.splice(gorevler.indexOf(g), 1);           // oyuncu sildi
    }
    for (const t of tickets) {
      const hazir = Object.keys(t.want).some(p => (t.want[p] || 0) - tabakTasks(t, p) > 0 && (rafSerbest(p, 'pass') > 0 || rafSerbest(p, 'counter') > 0));
      tabakYas.set(t, hazir ? (tabakYas.get(t) || 0) + dt : 0);
    }
    for (const k of [...tabakYas.keys()]) if (!tickets.includes(k)) tabakYas.delete(k);
    for (const t of rt.tables) if (t && t.dirty > 0) t.dirtyT += dt;
    hat.update(dt);
  }
  function wantMasa(): boolean {
    const st = S.stage || 1, kn = kanatKurulu(st).length;
    // BUF-19: kanat masaları kadar açık bilet payı (4 masaya 1, garson sayısını geçmez) ve salon aletlerinin misafir çarpanı masa müşterisi payına
    if (!FAZ2_UI || !active() || tickets.length >= ADISYON.maxOpen + Math.max(0, Math.floor((st - 4) / 2)) + Math.min(Math.floor(kn / 4), garsonlar().length)) return false;
    const mk = Math.max(salonKatYan(salonEsya(), st, 'W').mis, salonKatYan(salonEsya(), st, 'E').mis);
    const sh = Math.min(0.94, ((ADISYON.share[st - 1] ?? 0) + (kn ? 0.1 : 0)) * mk + Math.max(0, G().servis - 3) * SERVIS.sharePerStar);
    if (rng.next() >= sh) return false;
    return freeTable() >= 0;
  }

  // ───────── garson API ─────────
  function tepsiOf(wid: number): TepsiTabak[] {
    return gorevler.filter(g => g.wid === wid && g.tur === 'tabak' && g.item).map(g => {
      const y = masaYan(g.table), r = isProduct(g.p!) ? tezgahNokta() : passNokta(g.yer ?? yerOfTable(g.table));
      return { id: g.id, p: g.p!, table: g.table, x: y.x, z: y.z, geri: !!g.geri, gx: r.x, gz: r.z };
    });
  }
  function sonuc(g: Gorev): IsAlSonuc {
    if (g.tur === 'tabak') {
      const n = gorevler.filter(k => k.wid === g.wid && k.tur === 'tabak').length;
      const d = g.src === 'pass' ? passNokta(g.yer) : tezgahNokta();
      return { id: g.id, tur: 'tabak', table: g.table, x: d.x, z: d.z, n };
    }
    if (g.tur === 'sil') { const y = masaYan(g.table); return { id: g.id, tur: 'sil', table: g.table, x: y.x, z: y.z }; }   // BUF-28: masanın yanına (merkez katı: garson 2.4 m+ uzakta durup 'ışınlanma' sayılıyordu)
    const y = masaYan(g.table); return { id: g.id, tur: g.tur, table: g.table, x: y.x, z: y.z };
  }
  function isAl(wid: number, o: { cap: number; at?: Vec2 }): IsAlSonuc | null {
    const mine = gorevler.find(g => g.wid === wid); if (mine) return sonuc(mine);
    if (!garsonlar().some(w => w.id === wid)) return null;
    bolgeYenile();
    for (const tur of ADISYON.oncelik) {
      if (tur === 'tabak') {
        // birim adaylar: bilet sırası (KDS FIFO), pass önce; bölge içi önce. Tek seferde tek kaynak (tek durak).
        type Aday = { t: Ticket; p: FoodId; src: 'pass' | 'counter'; yer?: PassYer; ic: boolean; o: number };
        const ad: Aday[] = []; let seq = 0;
        const sanal = new Map<string, number>();   // bu çağrıda ayrılan (rafSerbest'ten düş)
        for (const t of tickets) {
          const c = custOf(t); if (!c || c.state === 'leave') continue;
          const r = bolgeKurali(wid, t.table, tabakYas.get(t) || 0); if (!r.ok) continue;
          for (const p of Object.keys(t.want)) {
            let need = (t.want[p] || 0) - tabakTasks(t, p);
            // 2026-11-21: pass'lar ayrı rafta: önce masanın kendi tarafındaki pass, sonra öbürleri (tabak nerede duruyorsa garson oraya yürür)
            const ty = yerOfTable(t.table), yerler: PassYer[] = [ty, ...(['on', 'W', 'E'] as const).filter(y => y !== ty)];
            for (const y of yerler) {
              const kk = 'pass' + y + p;
              while (need > 0 && rafSerbest(p, 'pass', y) - (sanal.get(kk) || 0) > 0) { sanal.set(kk, (sanal.get(kk) || 0) + 1); ad.push({ t, p, src: 'pass', yer: y, ic: r.ic, o: seq++ }); need--; }
            }
            while (need > 0 && rafSerbest(p, 'counter') - (sanal.get('counter' + p) || 0) > 0) { sanal.set('counter' + p, (sanal.get('counter' + p) || 0) + 1); ad.push({ t, p, src: 'counter', ic: r.ic, o: seq++ }); need--; }
          }
        }
        if (!ad.length) continue;
        ad.sort((a, b) => (a.ic === b.ic ? 0 : a.ic ? -1 : 1) || a.o - b.o);
        const src = ad[0].src, yer = ad[0].yer, cap = Math.max(1, Math.floor(o.cap) || 1);
        const al = ad.filter(a => a.src === src && a.yer === yer).slice(0, cap);   // tek durak: aynı kaynak, aynı pass penceresi
        const made = al.map(a => ({ id: gid++, tur: 'tabak' as const, table: a.t.table, cid: a.t.cid, yas: 0, wid, claimT: saat, ticket: a.t, p: a.p, src, yer }));
        gorevler.push(...made);
        return sonuc(made[0]);
      }
      if (tur === 'sil') {
        const tmz = S.workers.some(w => w.role === 'temizlik');   // temizlikçi varsa masa silme onun (BUF-13); çatı masası yine garsonun (BUF-20)
        let best: { i: number; ic: boolean; yas: number } | null = null;
        rt.tables.forEach((t, i) => {
          if (!t || !t.built || !(t.dirty > 0) || gorevler.some(g => g.tur === 'sil' && g.table === i) || (tmz && !masaCati(i))) return;
          const r = bolgeKurali(wid, i, t.dirtyT); if (!r.ok) return;
          if (!best || (r.ic && !best.ic) || (r.ic === best.ic && t.dirtyT > best.yas + 1e-9)) best = { i, ic: r.ic, yas: t.dirtyT };
        });
        if (!best) continue;
        const b = best as { i: number };
        const g: Gorev = { id: gid++, tur: 'sil', table: b.i, cid: 0, yas: 0, wid, claimT: saat };
        gorevler.push(g); return sonuc(g);
      }
      const cand = gorevler.filter(g => g.tur === tur && !g.wid).map(g => ({ g, r: bolgeKurali(wid, g.table, g.yas) })).filter(x => x.r.ok);
      if (!cand.length) continue;
      cand.sort((a, b) => (a.r.ic === b.r.ic ? 0 : a.r.ic ? -1 : 1) || b.g.yas - a.g.yas || a.g.id - b.g.id);
      const g = cand[0].g; g.wid = wid; g.claimT = saat;   // zaman aşımı garsonun işi aldığı andan sayılır
      return sonuc(g);
    }
    return null;
  }
  function tabakAl(wid: number): TepsiTabak[] {
    for (const g of gorevler.filter(k => k.wid === wid && k.tur === 'tabak' && !k.item)) {
      if (!tickets.includes(g.ticket!) || (g.ticket!.want[g.p!] || 0) - tabakTasks(g.ticket!, g.p!, true) <= 0) { gorevler.splice(gorevler.indexOf(g), 1); continue; }
      let it: Plate | null = null;
      if (g.src === 'pass') it = hat.passTake(g.p!, g.yer);
      if (!it && isProduct(g.p!) && rt.counter[g.p!]?.length) it = rt.counter[g.p!].pop()!;
      if (!it && g.src === 'counter') it = hat.passTake(g.p!, 'on');
      if (!it) { gorevler.splice(gorevler.indexOf(g), 1); continue; }   // başkası aldı: hata değil
      g.item = it; it.carrier = undefined as never;
    }
    return tepsiOf(wid);
  }
  function isinlanmaBak(table: number, at: Vec2): void {
    const tb = rt.layout.tables[table]; if (!tb) return;
    if (Math.hypot(at.x - tb.x, at.z - tb.z) > ADISYON.isinlanmaM) { isinlanma++; K.stat('isinlanma'); }
  }
  function isTamam(wid: number, id: number, at: Vec2): IsTamamSonuc {
    const g = gorevler.find(k => k.id === id && k.wid === wid); if (!g) return { durum: 'yok' };
    const rm = () => { const i = gorevler.indexOf(g); if (i >= 0) gorevler.splice(i, 1); };
    if (g.tur === 'tabak') {
      if (!g.item) { rm(); return { durum: 'yok' }; }
      const t = g.ticket!, c = tickets.includes(t) ? custOf(t) : null;
      if (c && (t.want[g.p!] || 0) > 0) {
        isinlanmaBak(g.table, at); rm(); deliver(t, c, g.item); return { durum: 'tamam' };
      }
      // bilet artık bu tabağı istemiyor (oyuncu servis etti / müşteri gitti): aynı yiyeceği bekleyen başka masaya, yoksa rafa geri
      const t2 = tickets.find(k => (k.want[g.p!] || 0) - tabakTasks(k, g.p!) > 0);
      if (t2) { g.ticket = t2; g.table = t2.table; g.cid = t2.cid; const y = masaYan(t2.table); return { durum: 'tasi', table: t2.table, x: y.x, z: y.z }; }
      g.geri = true; g.yer = yerOfTable(g.table); const r = isProduct(g.p!) ? tezgahNokta() : passNokta(g.yer);
      return { durum: 'geri', x: r.x, z: r.z };
    }
    if (g.tur === 'sil') {
      const t = rt.tables[g.table]; rm(); isinlanmaBak(g.table, at);
      if (t && t.dirty > 0) { (rt as unknown as { bulasik?: { masaSilindi(i: number): void } }).bulasik?.masaSilindi(g.table); t.dirty = 0; t.dirtyT = 0; K.stat('cleaned'); K.stat('garsonSildi'); }
      return { durum: 'tamam' };
    }
    const c = custById(g.cid); rm();
    if (!c || c.state === 'leave') return { durum: 'yok' };
    const f = c as unknown as CF;
    isinlanmaBak(g.table, at);
    if (g.tur === 'menu') {
      if (c.state !== 'wait' || f.tk) return { durum: 'yok' };
      f.menuOk = true; f.garsonlu = true; f.dusunT = c.t + rng.range(ADISYON.dusunS[0], ADISYON.dusunS[1]);
      K.stat('menuGetir'); cu.say(c, rng.pick(ADISYON_LINES.menu), 1.6);
      return { durum: 'tamam' };
    }
    if (g.tur === 'siparis') {
      if (c.state !== 'wait' || f.tk) return { durum: 'yok' };
      f.tk = true; f.garsonlu = true; openTicket(c);
      K.stat('siparisAl'); K.logEv('siparisAl', { table: g.table, x: at.x, z: at.z });
      return { durum: 'tamam' };
    }
    if (c.state !== 'eat' || !f.hesapBekle) return { durum: 'yok' };
    K.stat('hesapGetir'); odemeYap(c, true);
    return { durum: 'tamam' };
  }
  function tabakGeri(wid: number): number {
    let n = 0;
    for (const g of gorevler.filter(k => k.wid === wid && k.tur === 'tabak' && k.item && k.geri)) { gorevler.splice(gorevler.indexOf(g), 1); rafaKoy(g.item!, g.yer); n++; }
    return n;
  }
  function isBirak(wid: number): void {
    for (const g of gorevler.filter(k => k.wid === wid)) {
      if (g.tur === 'menu' || g.tur === 'siparis' || g.tur === 'hesap') { g.wid = 0; g.claimT = 0; continue; }
      gorevler.splice(gorevler.indexOf(g), 1);
      if (g.item) rafaKoy(g.item, g.yer);
    }
  }
  function kumbaraDagit(day: number): BahsisDagitim | null {
    kumbaraYukle();
    const toplam = Math.floor(kumbara);
    if (toplam <= 0) return null;
    let alan = garsonlar(); if (!alan.length) alan = S.workers.slice();
    if (!alan.length) return null;   // paylaşacak kimse yok: ertesi güne kalır
    const per = Math.floor(toplam / alan.length); if (per <= 0) return null;   // kişi başı 1 ₺ bile değil: ertesi güne kalır
    const kalan = kumbara - per * alan.length;
    const pay = alan.map(w => ({ wid: w.id, ad: w.name, tutar: per }));
    // pay gerçekten karşılığını bulur: her garson payıyla orantılı deneyim kazanır (rütbe terfisi bahşişle hızlanır)
    for (const pp of pay) { const w = S.workers.find(x => x.id === pp.wid); if (w) w.xp = (w.xp || 0) + Math.max(1, Math.round(pp.tutar / 20)); }
    kumbara = kalan; kumbaraYaz();   // küsurat ertesi güne kalır (toplam korunur: dağıtılan + kalan = biriken)
    sonDagitim = { day, toplam: per * alan.length, kalan: Math.round(kalan * 100) / 100, pay }; kumbaraYaz();
    K.logEv('bahsisDagit', { day, toplam, kisi: pay.length, per });
    return sonDagitim;
  }

  function ticketItems(t: Ticket): TicketView['items'] {
    const m = new Map<string, TicketView['items'][number]>();
    for (const l of t.lines) {
      const key = l.food;
      let it = m.get(key);
      if (!it) { const d = l.dish ? DISH_BY_ID[l.dish] : null; it = { p: l.food, dish: l.dish, name: d ? (l.kurs > 1 ? d.ad + ' (' + l.kurs + ' servis)' : d.ad) : yemekAd(l.food), n: 0, left: 0 }; m.set(key, it); }
      it.n++; if (!l.done) it.left++;
    }
    return [...m.values()];
  }
  function masalar(): MasaView[] {
    const out: MasaView[] = [];
    rt.tables.forEach((tb, i) => {
      if (!tb || !tb.built) return;
      const c = rt.customers.find(k => k.kind === 'masa' && k.seat?.table === i && k.state !== 'leave');
      if (!c) { out.push({ table: i, durum: tb.dirty > 0 ? 'kirli' : 'bos', frac: 0 }); return; }
      const f = c as unknown as CF, t = tickets.find(k => k.cid === c.id);
      if (t) out.push({ table: i, durum: 'tabak', frac: clamp(t.t / t.max, 0, 1) });
      else if (c.state === 'eat') out.push({ table: i, durum: f.hesapBekle && c.t >= c.eatT ? 'hesap' : 'yemek', frac: f.hesapBekle && c.t >= c.eatT ? clamp((f.hb || 0) / ADISYON.hesapBekleMaxS, 0, 1) : 0 });
      else out.push({ table: i, durum: f.menuOk ? 'siparis' : 'menu', frac: clamp((f.bekleT || 0) / ADISYON.bekleSabirS, 0, 1) });
    });
    return out;
  }
  function view(): RestoranView {
    const g = G();
    return {
      active: active(), servis: Math.round(g.servis * 10) / 10,
      tickets: tickets.map(t => ({ no: t.no, table: t.table, frac: clamp(t.t / t.max, 0, 1),
        items: ticketItems(t) })),
      stands: [],
      ...hat.view(), sefHizi: sefHizi(S.workers),
      devir: Object.fromEntries(Object.entries(hat.view().devir).map(([i, wid]) => [i, { wid, ad: S.workers.find(w => w.id === wid)?.name || '' }])),
      masalar: masalar(),
    };
  }
  const api: RestoranApi = {
    hat,
    isAl, tabakAl, tepsi: tepsiOf, isTamam, tabakGeri, isBirak,
    passDurak(wid) { const g = gorevler.find(k => k.wid === wid && k.tur === 'tabak' && k.src === 'pass'); return g ? passNokta(g.yer) : null; },
    rezerve: p => gorevler.filter(g => g.tur === 'tabak' && !g.item && g.src === 'counter' && g.p === p).length,
    debug: () => ({ gorevler: gorevler.length, tepsi: gorevler.filter(g => g.item).length, claimed: gorevler.filter(g => g.wid).length, isinlanma }),
    bolgeler() { bolgeYenile(); return bolgeList.map(b => ({ id: b.id, masalar: [...b.masalar], komsu: [...b.komsu], garsonlar: [...atama].filter(([, z]) => z === b.id).map(([w]) => w) })); },
    bolgeOf(wid) { bolgeYenile(); return atama.get(wid) ?? null; },
    garsonPost(wid) {
      bolgeYenile(); const z = atama.get(wid); if (!z) return null;
      const b = bolgeList.find(x => x.id === z); if (!b) return null;
      const say: Partial<Record<KanatBolge, number>> = {};
      for (const i of b.masalar) { const km = kanatOf(i); if (km) say[km.bolge] = (say[km.bolge] || 0) + 1; }
      const enCok = (Object.keys(say) as KanatBolge[]).sort((p, q) => (say[q] || 0) - (say[p] || 0))[0];
      if (!enCok || (say[enCok] || 0) * 2 < b.masalar.length) return null;   // bölgenin çoğu büfe önündeyse tezgâh yanında bekler
      return { bolge: enCok, ...KANAT_POST[enCok] };
    },
    bolgeAta(wid, id) {
      if (!garsonlar().some(w => w.id === wid)) return false;
      if (id === null) elle.delete(wid);
      else { bolgeYenile(); if (id !== '*' && !bolgeList.some(b => b.id === id)) return false; elle.set(wid, id); }
      bolgeYenile(); return true;
    },
    kumbara: () => (kumbaraYukle(), { birikim: Math.round(kumbara * 100) / 100, son: sonDagitim }),
    kumbaraDagit,
    kitchenClaim: (wid, opt) => hat.claim(wid, opt?.from),
    kitchenIst: wid => hat.ist(wid),
    kitchenSure: wid => hat.sure(wid),
    kitchenReady: wid => hat.ready(wid),
    kitchenTasi: (wid, opt) => hat.tasiClaim(wid, opt),
    kitchenTasiAl: wid => hat.tasiAl(wid),
    kitchenPass: wid => hat.done(wid),
    kitchenPassYer: wid => hat.eldeYer(wid),
    kitchenDrop: wid => hat.drop(wid),
    kitchenDevir: wid => hat.devirIst(wid),
    mutfakHazir,
    kitchenBekleyen: yas => hat.bekleyenTepsi(yas),
    kitchenDone(wid, ok) {
      if (!ok) { hat.drop(wid); return; }
      if (hat.ist(wid) && hat.ready(wid) && hat.tasiClaim(wid, { kendi: true })) hat.tasiAl(wid);
      if (hat.elde(wid) && !hat.done(wid)) hat.drop(wid);
    },
    handle(c) {
      // BUF-10 bölge komutu (UI için): { kind:'restoran', op:'bolge', wid, id: 'b1' | '*' | null }
      // BUF-06 devir komutları: { kind:'restoran', op:'devret', ist, wid? } (wid yoksa boştaki aşçı), { op:'devirAl', ist }
      if (c.op === 'devret') { const w = c.wid != null ? Number(c.wid) : bosAsci()?.id; return w != null && hat.devret(String(c.ist), w); }
      if (c.op === 'devirAl') return hat.devirAl(String(c.ist));
      if (c.op === 'bolge') { const ok = api.bolgeAta!(Number(c.wid), c.id == null || c.id === '' ? null : String(c.id)); return ok; }
      return false;
    },
    view, wantMasa, update, register,
    menu: () => menuPano(S.stage || 1),
    openDishes: () => dishesNow().map(d => d.id),
  };
  (rt as unknown as { restoran?: RestoranApi }).restoran = api;
  return api;
}
