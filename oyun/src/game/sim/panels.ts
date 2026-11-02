/**
 * Panel models and actions (v2 panelModel / panelActions) as pure functions over the rules. D renders them.
 * `panelModel(id, rules)` -> the v2 model object for the 8 tab panels and the overlays (jobBoard, dayCard, welcomeBack, solution, kasaSayimi).
 * `panelActions(id)` -> { actionName: (arg) => command } (D turns each into `sim.command`). Owner: Builder A. Pure.
 */
import { pencereWid } from './window';
import { DECOR, DECOR_SETS, GRADES, GRADE_NAMES, STAR_RULES, skipGold, P } from '../../content/economy';
import { PRODUCT_IDS, PRODUCTS, TIER_NAMES, price } from '../../content/products';
import { KIOSK_STAGES } from '../../content/stages';
import { ACHIEVEMENTS } from '../../content/achievements';
import { DAILY_TASKS, ORDERS_FROM_DAY } from '../../content/daily';
import { CATS, DOG } from '../../content/cats';
import { ROLES, RANKS, rankOf, moraleLabel } from '../../content/ranks';
import { TRAITS } from '../../content/traits';
import { STATIONS } from '../../content/products';
import { defaultSign } from '../../content/sign-fonts';
import type { Rules } from './state';
import type { ModelId, SimCmd } from './commands';
import { clamp, fmtMoney } from './util';
import { esnafPanelModel, komsuSummary } from './esnaf';
import { miniPanelModel, miniSummary } from './mini';
import { kuryePanelModel, kuryeSummary } from './kurye';
import { calisanSummary } from './calisan';
import { kolPanelModel, kolSummary } from './koleksiyon';
import { hikayePanelModel, hikayeSummary } from './hikaye';
import { dekorEvApi } from './dekor-ev';
import { yiyecekPanelModel } from './yiyecek';
import { yatirimModel } from './yatirim';
import { kiyafetSave } from './kiyafet';
import { zeminSave } from './zemin';
import { zincirApi } from './zincir';
import { KIYAFET_URUNLER, KIYAFET_ZINCIRLER } from '../../content/kiyafet';

/** Survey 2026-10-24: kıyafet dolabı panel model (owned / worn / gold, grouped by chain). */
function kiyafetPanel(S: { zones: Record<string, Record<string, unknown>>; gold?: number }) {
  const z = kiyafetSave(S);
  return { gold: S.gold || 0, worn: { ...z.worn }, zincirler: KIYAFET_ZINCIRLER.map(c => ({ id: c.id, name: c.name, tagline: c.tagline, items: KIYAFET_URUNLER.filter(u => u.zincir === c.id).map(u => ({ id: u.id, name: u.name, slot: u.slot, gold: u.gold, owned: z.owned.includes(u.id), worn: z.worn[u.slot] === u.id })) })) };
}
import { havaApi } from './hava';
import { disariApi } from './disari';
import { denizApi } from './deniz';

const fmt = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function panelModel(id: ModelId | string, r: Rules): Record<string, any> {
  const S = r.state, rt = r.rt, x = r.ext;
  if (id === 'esnaf') return esnafPanelModel(r);
  if (id === 'mini') return miniPanelModel(r);
  if (id === 'hava') return havaApi(r)?.model() ?? {};
  if (id === 'deniz') return denizApi(r)?.model() ?? {};
  if (id === 'kurye') return kuryePanelModel(r);
  if (id === 'koleksiyon') return kolPanelModel(r);
  if (id === 'harita') { const hm = disariApi(r)?.model(); return hm ? { ...hm, zincir: zincirApi(r)?.view() ?? [] } : {}; }   // + survey 2026-10-24: dükkan zinciri pins (locked shops show on the map) // Martıköy haritası (disari.ts)
  if (id === 'hikaye') return hikayePanelModel(r);
  switch (id) {
    case 'isciler': {
      const live = ((r.v2State().workers as { id: number; state: string }[]) || []);
      return {
        hint: S.owned.isbul ? '' : x.isbulHint(),
        pencere: S.owned.pencere ? pencereWid(S) : -1,   // Faz 2: worker posted at the ferry window (-1: no window yet)
        workers: S.workers.map(w => {
          const rk = rankOf(w.xp || 0), t = TRAITS[w.trait as string] || TRAITS.hamarat, role = ROLES[w.role];
          const wk = w as Record<string, any>;
          return {
            id: w.id, name: w.name, roleLabel: role.label, rank: rk, rankLabel: RANKS[rk].name,
            trait: { id: t.id, name: t.name, effect: t.effect, flaw: t.flaw, line: t.line }, morale: clamp((w.morale || 70) / 100, 0, 1), moraleLabel: moraleLabel(w.morale || 70),
            wage: '%' + Math.round(RANKS[rk].wage * (1 + (t.fx.wage || 0)) * 100), station: role.station ? (STATIONS as any)[role.station]?.name || role.label : role.label,
            rarity: w.rarity, look: wk.look, about: wk.about, state: live.find(l => l.id === w.id)?.state || '', trainCost: 300 * Math.pow(rk + 1, 2),
          };
        }),
        money: S.money,
        kurye: kuryeSummary(r), // Kuryeler section (ui/kurye-panel.ts)
        calisan: calisanSummary(r), // Kurs Merkezi / Bank / Etkinlikler section (ui/calisan-panel.ts)
      };
    }
    case 'menu': {
      const products: Record<string, any>[] = PRODUCT_IDS.map(p => {
        const t = S.tiers[p], pr = PRODUCTS[p];
        return { id: p, name: pr.tiers[t - 1].name, product: pr.name, tier: t, tierName: TIER_NAMES[t - 1], price: Math.round(price(p, t) * r.venueMult()), nextTierName: t < 4 ? TIER_NAMES[t] + ': ' + pr.tiers[t].name : null, nextCost: t < 4 ? x.upgradeCost(p) : 0, unlocked: !!rt.stations[p].built, desc: pr.tiers[t - 1].desc };
      });
            if (S.owned.miknatis || S.magnet > 0) products.push({ id: 'miknatis', name: 'Mıknatıslı Önlük', product: 'Para toplama menzili', tier: S.magnet + 1, tierName: P.MAGNET_M[S.magnet] + ' m', price: 0, nextTierName: S.magnet < 4 ? P.MAGNET_M[S.magnet + 1] + ' m' : null, nextCost: S.magnet < 4 ? P.MAGNET_COST[S.magnet + 1] : 0, unlocked: true, pseudo: true });
      return { products, money: S.money, invest: yatirimModel(S), stage: S.stage || 1, yy: yiyecekPanelModel(r), kiy: kiyafetPanel(S) }; // yy: Tarif Defteri / Deney / Anlaşma tabs (yiyecek.ts)
    }
    case 'dekor': {
      const items = DECOR.map(d => ({ id: d.id, name: d.name, set: DECOR_SETS[d.set], price: d.price, owned: S.decorOwned.filter(y => y === d.id).length, placed: S.decorSlots.filter(y => y.item === d.id).length, bonus: 'Keyif +' + d.keyif + ', Şıklık +' + d.points, size: d.size }));
      return {
        money: S.money, zemin: zeminSave(S), items, slots: rt.layout.slots.map((s, i) => ({ index: i, itemId: S.decorSlots.find(d => d.slot === String(i))?.item || null, size: s.size })),
        style: rt.siklik || 0, sign: S.sign ? (S.sign as any).text : defaultSign(S.hero),
        x2: dekorEvApi(r)?.model() ?? null, // Dekor 2.0 + Sabri'nin Evi (dekor-ev.ts)
      };
    }
    case 'gorevler': {
      const od = S.orders as unknown as { list: { id: string; goal: number; base: number; claimed: boolean }[] } | null;
      const daily = od && S.day >= ORDERS_FROM_DAY ? od.list.map(o => {
        const t = DAILY_TASKS.find(y => y.id === o.id)!, pg = x.orderProgress(o);
        return { id: o.id, text: t.text.replace('{n}', fmt(o.goal)), progress: Math.max(0, pg), goal: o.goal, reward: fmtMoney(x.orderReward()) + ' + ' + P.AS_ORDER + ' Altın Simit', done: pg >= o.goal, claimed: o.claimed };
      }) : [];
      return { deniz: denizApi(r)?.summary() ?? null, harita: disariApi(r)?.summary() ?? null, hava: havaApi(r)?.summary() ?? null, komsu: komsuSummary(r), mini: miniSummary(r), kol: kolSummary(r), hikaye: hikayeSummary(r), daily, achievements: ACHIEVEMENTS.map(a => ({ id: a.id, title: a.title, text: a.text, done: !!S.ach[a.id], progress: Math.min(a.goal, S.stats[a.stat] || 0), goal: a.goal })), note: S.day < ORDERS_FROM_DAY ? 'Sipariş Panosu ' + ORDERS_FROM_DAY + '. gün açılır.' : '' };
    }
    case 'kedi': {
      const has = (cid: string) => S.cats.some(c => c.id === cid);
      return { cats: CATS.map(c => ({ id: c.id, name: c.name, coat: c.coat, found: has(c.id), story: has(c.id) ? c.trait + ' ' + c.pose + ' ' + c.job : (c.at ? c.at + ' başarımda gelir.' : '') })), dog: S.dog ? { name: DOG.name, story: DOG.story } : null };
    }
    case 'karne': {
      const next = STAR_RULES.find(y => y.n === S.stars + 1);
      return { grades: GRADES.filter(g => g.id !== 'siklik').map(g => ({ id: g.id, label: g.label, score: (S.grades[g.id] || 1) / 5, grade: GRADE_NAMES[(S.grades[g.id] || 1) - 1] })), stars: S.stars, nextStar: next ? next.text : 'Bütün yıldızlar senin!', level: S.level, siklik: rt.siklik || 0 };
    }
    case 'tadilat': {
      const n = KIOSK_STAGES[S.stage] || null, cur = KIOSK_STAGES[S.stage - 1], open = !!n && !n.soon && !!n.cost;
      const needStars = n && n.req ? n.req.stars : 0;
      const tl = S.tadilat as unknown as { left: number } | null;
      const reason = !open ? '' : S.stars < needStars ? needStars + ' yıldız lazım (şimdi ' + S.stars + '). Karneye bak.' : S.money < (n!.cost || 0) ? 'Kasada ' + fmtMoney(n!.cost || 0) + ' olmalı.' : '';
      return { stage: S.stage, stageName: cur.short, stages: KIOSK_STAGES.map(k => k.short), nextName: open ? n!.short : null, cost: open ? n!.cost : null, timeLeft: tl ? Math.ceil(tl.left) : 0, skipGold: tl ? skipGold(tl.left) : 0, canStart: open && x.tadilatReady() && S.money >= (n!.cost || 0), reason, need: needStars ? needStars + ' yıldız' : '', stars: S.stars, gold: S.gold, money: S.money, renewed: S.renewed.slice(), deniz: denizApi(r)?.summary() ?? null };
    }
    case 'ayarlar': return { muted: !!S.settings.muted, quality: S.settings.quality || 'auto', hero: S.hero || 'sabri', tier: S.settings.autoTier || 'dengeli' };
    case 'jobBoard': return x.boardModel();
    case 'dayCard': case 'welcomeBack': case 'kasaSayimi': case 'solution': return (rt.uiLast[id] as Record<string, any>) || {};
  }
  return {};
}

export function panelActions(id: ModelId | string): Record<string, (arg?: any) => SimCmd> {
  switch (id) {
    case 'isciler': { const C = (op: string) => (a?: any) => ({ kind: 'calisan', op, id: a == null ? undefined : String(a) }) as SimCmd; return { train: a => ({ kind: 'calisan', op: 'sel', id: String(a) + '|kurs' }), tasi: a => ({ kind: 'calisan', op: 'sel', id: String(a) + '|tasi' }), fire: a => ({ kind: 'fire', id: a }), board: () => ({ kind: 'openJobBoard' }), pencere: (a?: any) => ({ kind: 'pencere', wid: Number(a) }) as unknown as SimCmd, pencereHire: () => ({ kind: 'pencere', op: 'hire' }) as unknown as SimCmd, kuryeOpen: () => ({ kind: 'kurye', op: 'open' }), cTab: C('tab'), cSel: C('sel'), cClose: C('close'), cKurs: C('kurs'), cBank: C('bank'), cCall: C('call'), cEv: (a?: any) => ({ kind: 'calisan', op: String(a) }) as SimCmd }; }
    case 'kurye': { const Q = (op: string) => (a?: any) => ({ kind: 'kurye', op, id: a == null ? undefined : String(a) }) as SimCmd; return { kAccept: Q('accept'), kDecline: Q('decline'), kSelf: Q('self'), kHire: Q('hire'), kBuyVeh: Q('buyVeh'), kVeh: Q('veh'), kUpg: Q('upg'), kSus: Q('sus'), kSeen: Q('seen') }; }
    case 'menu': return { upgrade: a => ({ kind: 'upgradeTier', id: a }), inv: a => ({ kind: 'invest', id: String(a) }) as SimCmd, kyBuy: a => ({ kind: 'kiyafet', op: 'buy', id: String(a) }) as SimCmd, kyWear: a => ({ kind: 'kiyafet', op: 'wear', id: String(a) }) as SimCmd, kyTake: a => ({ kind: 'kiyafet', op: 'take', id: String(a) }) as SimCmd, yy: a => ({ kind: 'yiyecek', arg: String(a ?? '') }) };
    case 'dekor': return { buy: a => ({ kind: 'decorBuy', id: a }), place: a => ({ kind: 'decorPlace', id: a }), remove: a => ({ kind: 'decorRemove', slot: a }), rot: a => ({ kind: 'decorRotate', slot: a }), zemin: a => (String(a).startsWith('desen:') ? { kind: 'zemin', op: 'desen', value: String(a).slice(6) } : { kind: 'zemin', op: String(a) }) as SimCmd, d2: a => ({ kind: 'dekor2', arg: String(a ?? '') }) };
    case 'gorevler': return { claim: a => ({ kind: 'claimOrder', id: a }), esnafOpen: a => ({ kind: 'esnaf', op: 'open', id: a }), esnafClaim: () => ({ kind: 'esnaf', op: 'claim' }), esnafAccept: () => ({ kind: 'esnaf', op: 'accept' }), miniOpen: () => ({ kind: 'mini', op: 'open' }), haritaOpen: () => ({ kind: 'disari', op: 'open' }) as unknown as SimCmd, havaOpen: () => ({ kind: 'hava', op: 'open' }) as SimCmd, denizOpen: () => ({ kind: 'deniz', op: 'open' }) as SimCmd, kolOpen: a => ({ kind: 'koleksiyon', op: 'open', id: a == null ? undefined : String(a) }), hikayeOpen: () => ({ kind: 'hikaye', op: 'open' }) };
    case 'hikaye': { const Hk = (op: string) => (a?: any) => ({ kind: 'hikaye', op, id: a == null ? undefined : String(a) }) as SimCmd; return { hkTab: Hk('tab'), hkReplay: Hk('replay'), hikayeOpen: Hk('open') }; }
    case 'koleksiyon': { const C = (op: string) => (a?: any) => ({ kind: 'koleksiyon', op, id: a == null ? undefined : String(a) }) as SimCmd; return { kolTab: C('tab'), kolPack: C('pack'), kolCast: C('cast'), kolBuy: C('buy'), kolAd: C('ad'), kolVitrin: C('vitrin'), kolClose: C('close') }; }
    case 'hava': { const Hc = (op: string) => (a?: any) => ({ kind: 'hava', op, id: a == null ? undefined : String(a) }) as unknown as SimCmd; return { havaUmb: Hc('umb'), havaStock: Hc('stock') }; }
    case 'mini': { const M = (op: string) => (a?: any) => ({ kind: 'mini', op, id: a == null ? undefined : String(a) }) as SimCmd; return { miniPlay: M('play'), miniPractice: M('practice'), miniAd: M('ad') }; }
    case 'esnaf': { const E = (op: string) => (a?: any) => ({ kind: 'esnaf', op, id: a == null ? undefined : String(a), arg: typeof a === 'number' ? a : undefined }) as SimCmd; return { esnafSel: E('sel'), esnafTalk: E('talk'), esnafGift: E('gift'), esnafBuy: E('buy'), esnafAccept: E('accept'), esnafDrop: E('drop'), esnafClaim: E('claim'), esnafPick: E('pick'), esnafHakem: E('hakem') }; }
    case 'harita': { const D = (op: string) => (a?: any) => ({ kind: 'disari', op, id: a == null ? undefined : String(a) }) as unknown as SimCmd; return { mkGo: D('go'), mkGuide: D('guide'), mkStop: D('stop'), mkAsk: D('ask'), mkShop: D('buyShop'), mkBuyVeh: D('buyVeh'), mkVeh: D('veh') }; }
    case 'tadilat': return { start: () => ({ kind: 'startTadilat' }), startSelf: () => ({ kind: 'startTadilatSelf' }), skip: () => ({ kind: 'skipTadilat' }), denizOpen: () => ({ kind: 'deniz', op: 'open' }) as SimCmd };
    case 'deniz': { const Dz = (op: string) => (a?: any) => ({ kind: 'deniz', op, id: a == null ? undefined : String(a) }) as SimCmd; return { dzExt: Dz('ext'), dzSeatBuy: Dz('seatBuy'), dzSeatSet: Dz('seatSet'), dzTez: Dz('tez'), dzPier: Dz('pier'), dzBufe: Dz('bufe'), dzPhoto: Dz('photo'), dzBoat: Dz('boat'), dzBoard: Dz('board') }; }
    case 'ayarlar': return { setMuted: b => ({ kind: 'setSetting', key: 'muted', value: !b }), setQuality: q => ({ kind: 'setSetting', key: 'quality', value: q }), setHero: h => ({ kind: 'setHero', hero: h }), reset: () => ({ kind: 'resetSave' }) };
    case 'jobBoard': return { hire: a => ({ kind: 'hireCandidate', id: a }), refresh: () => ({ kind: 'refreshBoard' }), close: () => ({ kind: 'closeJobBoard' }) };
    case 'solution': return { accept: () => ({ kind: 'acceptSolution' }) };
    case 'welcomeBack': return { collect: d => ({ kind: 'collectWelcome', doubled: !!d }) };
    case 'kasaSayimi': case 'dayCard': return { done: () => ({ kind: 'skipCeremony' }) };
  }
  return {};
}
