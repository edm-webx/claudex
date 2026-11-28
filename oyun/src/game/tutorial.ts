// Tutorial (Builder D, M1): the v2 first-session arrows and drag hand as a pure sim system, so `tutShow` / `tutDone`
// events happen in headless runs too (the 32-step acceptance table needs `tutShow walk`). Port of v2 game.js TUT table.
// Decisions: reads the v2-shaped snapshot `rules.v2State()` every 0.2 s (cheap, no extra coupling to C's agent state);
// completion is stored in GameState.tut as `tut_<id>` = play seconds (v2 key), flags like `firstCut` are set by A/C.
// The view (arrow + ring marker, UI hand) reads `tutorial.current()`; it never writes sim state.
import type { Rules } from './sim/state';
import type { Vec2 } from '../engine/api';
import { IC_MEKANLAR, type IcMekan } from '../content/ic-mekan';
import { regionAt } from '../content/disari/martikoy';
import { egtIpucuKapsar, EGT_KAPALI } from '../content/egitici';

export interface TutStep { id: string; urgent?: boolean; rush?: boolean; repeat?: boolean; hand?: boolean; y?: number; show(v: any): boolean; done(v: any): boolean; at?(v: any): Vec2 | null | undefined; }
export interface TutCurrent { id: string; hand: boolean; at: Vec2 | null; y: number | null; }
export interface Tutorial { current(): TutCurrent | null; steps: readonly TutStep[]; }

const padStep = (key: string): TutStep => ({
  id: 'pad_' + key,
  show: v => { const p = v.pads.find((x: any) => x.key === key); return !!p && v.money >= Math.min(p.price * 0.5, 300); },
  done: v => v.owned.includes(key),
  at: v => (v.pads.find((x: any) => x.key === key) || {}).pos,
});

export const TUT: readonly TutStep[] = [
  { id: 'cat', urgent: true, y: 0.8, show: v => !!v.cat && v.cat.state === 'rub' && !v.tutFlags.catPet, done: v => !!v.tutFlags.catPet, at: v => v.cat && v.cat.pos },
  { id: 'gull', urgent: true, y: 0.6, show: v => !!v.gull && v.gull.mode === 'stare' && !v.tutFlags.gullFirst, done: v => !!v.tutFlags.gullFirst, at: v => v.gull && v.gull.pos },
  { id: 'window', urgent: true, rush: true, show: v => !!v.window && v.window.open, done: v => !!v.tutFlags.windowSale, at: v => v.anchors.window },
  { id: 'riza', urgent: true, y: 1.9, show: v => !!v.sleeper && !v.tutFlags.rizaSleep, done: v => !!v.tutFlags.rizaSleep, at: v => v.sleeper },
  { id: 'slow', urgent: true, y: 2.8, show: v => !!v.slow && !v.tutFlags.slowTapped, done: v => !!v.tutFlags.slowTapped, at: v => v.slow && v.slow.at },
  { id: 'walk', hand: true, show: v => v.t > 3, done: v => v.movedTotal > 1.5 || !!v.tutFlags.firstCut },
  { id: 'doner', show: v => v.t > 5 || v.movedTotal > 1.5, done: v => !!v.tutFlags.firstCut, at: v => v.anchors.stations.doner },
  { id: 'counter', show: v => v.carry.includes('doner'), done: v => !!v.tutFlags.firstDrop, at: v => v.anchors.counter },
  { id: 'money', show: v => v.kasaPile > 0, done: v => !!v.tutFlags.firstCollect, at: v => v.anchors.kasa },
  padStep('cay'),
  { id: 'cay', show: v => v.owned.includes('cay'), done: v => !!v.tutFlags.cayUsed, at: v => v.anchors.stations.cay },
  // UX-06: ilk 10 dakika: çay (ilk satın alma) sonra hemen ilk işçi, ardından menü ve oturma genişlemesi
  padStep('isbul'),
  { id: 'isbul', show: v => v.owned.includes('isbul'), done: v => v.workers.length > 0, at: v => v.anchors.job },
  padStep('ayran'), padStep('simit'), padStep('tabure1'),
];

/** UX-06: tek seferlik sakin ipuçları (kayıt: st.tut['ip_<id>']). Bir yere ilk girişte tek satır; sahip: "binaya ilk girişte ipucu çipi olsun". */
export const IPUCU_ARALIK_S = 10;
const KAFE_IPUCU = 'işletmenin aletleri Mülk düğmesinde, alınca içeride görünür.';
const AVM_IPUCU = 'ayrı bir dükkân. Önündeki sarı karede durup satın alırsın, aletleri içerideki sarı karelerden kurarsın.';
const BINA_IPUCU: Record<string, string> = {
  kafe1: 'Meydan Kafe: ' + KAFE_IPUCU,
  kafe2: 'Sahil Bistro: ' + KAFE_IPUCU,
  avm: 'Martı Lokantası: ' + AVM_IPUCU,
  avm_moda: 'Martı Moda: ' + AVM_IPUCU,
  avm_tekno: 'Tekno Martı: ' + AVM_IPUCU,
  avm_oyuncak: 'Oyuncak Dünyası: ' + AVM_IPUCU,
  avm_seker: 'Hacı Martı Şekerleme: ' + AVM_IPUCU,
  avm_kahve: 'Telve Kahve Laboratuvarı: ' + AVM_IPUCU,
  avm_baklava: 'Şerbetçi Baklava Sarayı: ' + AVM_IPUCU,
  avm_dondurma: 'Maraşlı Martı Dondurma: ' + AVM_IPUCU,
  avm_kuruyemis: 'Çıtırcı Kuruyemiş: ' + AVM_IPUCU,
  avm_doner: 'Dürümcü Dayı: ' + AVM_IPUCU,
  avm_kumpir: 'Kumpir Kulesi: ' + AVM_IPUCU,
  avm_midye: 'Midyeci Mido: ' + AVM_IPUCU,
  avm_sinema: 'Martı Sinema Büfesi: mısır makinesi kendi patlatır, içecekler dolapta. ' + AVM_IPUCU,
  tesis: 'Halı Saha Tesisleri: sahibi olduğun işletmeler Mülk düğmesinde.',
  salonW: 'Kahvaltı kanadı: soluk duran aletin önündeki kareyi al, sonra aletin başında dur, ürün eline gelir.',
  salonE: 'Balık kanadı: soluk duran aletin önündeki kareyi al, sonra aletin başında dur, ürün eline gelir.',
  mutfak: 'Mutfak büfe gibi: istasyonun önünde dur, yemek eline gelir. Pass tezgâhına bırak ya da masaya götür.',
  banka: 'Banka içindesin. Para ve eşya işleri alttaki Mülk düğmesinde, Banka sekmesinde.',
  kirtasiye: 'Kırtasiye bir işletme. Sahibiysen tezgaha geçip kendin satabilirsin.',
  okul: 'Martıköy İlkokulu: dersler ve sınavlar burada.',
  hastane: 'Devlet Hastanesi: hasta kabule uğra, katları merdiven ya da asansörle gez. Muayene, kan bağışı, kafeterya burada.',
  acil: 'Acil: gezilebilir bir şehir binası, işletme değil.',
  morg: 'Morg: gezilebilir bir şehir binası, işletme değil.',
};
const BOLGE_IPUCU: Record<string, string> = {
  stadyum: 'Stadyum Mahallesi: halı sahalar ve maçlar burada.',
  orman: 'Belgrad Ormanı: sepetini al, mantar ara.',
};
const inside = (m: IcMekan, p: Vec2) => Math.abs(p.x - m.x) < m.wx / 2 && Math.abs(p.z - m.z) < m.wz / 2;
/** İlk karşılaşılan yeni yer için ipucu kimliği ve metni (yoksa null). Saf: test edilir. */
export function ipucuFor(p: Vec2 & { kat?: number }, seen: (id: string) => boolean): { id: string; text: string } | null {
  const ic = IC_MEKANLAR.find(m => inside(m, p) && (m.kat || 0) === (p.kat || 0));   // AVM katları üst üste: oyuncunun katındaki dükkân
  if (ic && !seen('bina_' + ic.id)) return { id: 'bina_' + ic.id, text: BINA_IPUCU[ic.id] ?? `${ic.ad}: içeri girdin.` };
  const r = regionAt(p.x);
  if (r && BOLGE_IPUCU[r.id] && !seen('bolge_' + r.id)) return { id: 'bolge_' + r.id, text: BOLGE_IPUCU[r.id] };
  return null;
}

export function installTutorial(rules: Rules): Tutorial {
  let ipAcc = 0, ipLast = -1e9;
  rules.addSystem({
    id: 'ipucu', order: 91, phase: 'sim',
    step(ctx: any) {
      if (!rules.rt.started || rules.rt.paused) return;
      ipAcc -= typeof ctx?.dt === 'number' ? ctx.dt : 1 / 30; if (ipAcc > 0) return; ipAcc = 0.5;
      const st = rules.state;
      if (st.playT - ipLast < IPUCU_ARALIK_S) return;
      const h = ipucuFor(rules.playerPos, id => !!st.tut['ip_' + id]);
      if (!h) return;
      st.tut['ip_' + h.id] = Math.round(st.playT);
      if (egtIpucuKapsar(h.id) && !st.tut[EGT_KAPALI]) return;   // eğitici kartı anlatıyor (content/egitici.ts), çip tekrar etmesin
      ipLast = st.playT;
      try { (rules.bus as any).emit('toast', { text: '💡 ' + h.text, kind: 'info' }); } catch { /* bus optional */ }
    },
  });
  let cur: TutStep | null = null;
  let curSnap: any = null;
  let shown: string | null = null;
  let acc = 0;
  const emit = (name: string, data: Record<string, unknown>) => { try { (rules.bus as any).emit(name, data); } catch { /* bus optional */ } };
  rules.addSystem({
    id: 'tutorial', order: 90, phase: 'sim',
    step(ctx: any) {
      const dt = typeof ctx?.dt === 'number' ? ctx.dt : 1 / 30;
      if (!rules.rt.started || rules.rt.paused) return;
      acc -= dt; if (acc > 0) return; acc = 0.2;
      const st = rules.state, tut = st.tut;
      const v: any = rules.v2State();
      v.tutFlags = tut; v.stats = st.stats; v.movedTotal = rules.rt.movedTotal;
      const rush = !!(v.window && v.window.open);
      let step: TutStep | null = null;
      for (const s of TUT) {
        const key = 'tut_' + s.id;
        if (tut[key] && !s.repeat) continue;
        let done = false; try { done = s.done(v); } catch { done = false; }
        if (done) { if (!tut[key]) { tut[key] = Math.round(st.playT); emit('tutDone', { id: s.id }); } continue; }
        if (step) continue;
        if (rush && !s.rush) continue;
        let show = false; try { show = s.show(v); } catch { show = false; }
        if (show) step = s;
      }
      if (step && shown !== step.id) { shown = step.id; emit('tutShow', { id: step.id }); }
      if (!step && shown) shown = null;
      cur = step; curSnap = v;
    },
  });
  return {
    steps: TUT,
    current() {
      if (!cur) return null;
      let at: Vec2 | null = null;
      try { at = cur.at ? (cur.at(curSnap) as Vec2 | null) || null : null; } catch { at = null; }
      return { id: cur.id, hand: !!cur.hand, at, y: cur.y ?? null };
    },
  };
}
