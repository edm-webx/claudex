/**
 * Martıköy outside the pier (survey disari-1..9, mekan-1..9, kontrol-3, iskele-9/10). Pure sim: no three, no DOM.
 * - Persistent state: GameState.zones.martikoy.d (created with defaults, so old saves load).
 * - Regions open by level (content REGIONS[].level). A locked region pushes Sabri back at its west edge with a
 *   toast (the view draws the barrier). Opening is announced once.
 * - Dolmuş stops: İskele and Çarşı known from the start, the others once Sabri walks past them. The map travels to
 *   any known stop of an open region (dolmuş, or vapur between İskele and Barınak, or your own vehicle). Travel is a
 *   short timed moment (rt.disari.travel) and the teleport happens halfway, under the overlay.
 * - Guide cat Fındık: a walk target (place / stop / lost-item owner); the view draws the cat walking ahead.
 * - Ask a citizen: a toast with a direction line and a short arrow hint (rt.disari.view().arrow).
 * - Finds: hidden cats, daily coins (seeded per day), photo spots, lost items carried back to their owner.
 * - Side shops: up to SHOP_MAX taken over; each fills its till per game hour (capped), emptied by walking there.
 * - Workers keep running the büfe while Sabri is away (nothing pauses); on return a toast reports what came in.
 * - Commands: { kind: 'disari', op, id? }: open | go | guide | ask | buyShop | buyVeh | veh | stop.
 */
import type { Kernel, Rules } from './state';
import {
  REGIONS, REGION_BY_ID, regionAt, PLACES, SIDE_SHOPS, SHOP_MAX, SHOP_CAP_H, HIDDEN_CATS, COIN_SPOTS, COINS_PER_DAY, PHOTO_SPOTS,
  LOST_ITEMS, VEHICLES, FARES, DOLMUS, TRAVEL_SEC, OTOBUS, ASK_LINES, GUIDE_CAT, AWAY_LINES, BACK_LINE, BAND, type Region, type RegionId,
} from '../../content/disari/martikoy';
import { fmtMoney } from './util';
import { REALMS, REALM_BY_ID, REALM_WALLS, realmAt, realmOfRegion, realmSpawn, type RealmId } from '../../content/realm';

interface DSave {
  seen: string[]; stops: string[]; opened: string[];
  cats: string[]; photos: string[]; returned: string[]; carrying: string | null;
  coinsDay: number; coins: number[]; coinsTaken: number[];
  shops: Record<string, { till: number }>; vehicles: string[]; veh: string;
  guide: { x: number; z: number; name: string } | null;
  trips: number; awayMoney: number | null; lastH: number;
  /** karar paketi J1: the realm Sabri is in (walking never changes it, only the 42B) */
  realm?: RealmId;
}
export type TravelMode = 'dolmus' | 'vapur' | 'yaya' | 'bisiklet' | 'motor' | 'kayik' | 'otobus';
/** 42B city bus at a stop: coming (drives in), waiting (doors open), leaving */
export interface BusView { phase: 'geliyor' | 'durakta' | 'gidiyor'; t: number; dur: number; x: number; z: number; to: string }
export interface DisariView {
  region: RegionId | null;
  away: boolean;
  locked: { x: number; region: string; line: string } | null;
  travel: { t: number; dur: number; mode: TravelMode; to: string; from: string } | null;
  guide: { x: number; z: number; name: string } | null;
  arrow: { text: string; dir: 1 | -1; t: number } | null;
  catsLeft: { id: string; x: number; z: number }[];
  coins: { i: number; x: number; z: number }[];
  photos: { id: string; x: number; z: number; done: boolean }[];
  lost: { id: string; x: number; z: number; name: string } | null;
  owner: { x: number; z: number; name: string } | null;
  shops: { id: string; owned: boolean; till: number; x: number; z: number }[];
  open: Record<string, boolean>;
  hour: number;
  bus: BusView | null;
  /** the bus stop Sabri stands at (iskele or orman), null when not near one */
  atBusStop: RealmId | null;
  realm: RealmId;
  atBusDoor: boolean;
  /** where the 42B can take you from the büfe stop */
  busTo: { id: string; name: string }[];
}
export interface DisariApi {
  handle(c: { kind: string; [k: string]: unknown }): boolean;
  view(): DisariView;
  model(): Record<string, any>;
  summary(): Record<string, any>;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Walkable z range per region (for guide targets and push-backs). */
function walkZ(id: RegionId | undefined, z: number): number {
  switch (id) {
    case 'sahil': return clamp(z, 3.2, 23.8);
    case 'meydan': return clamp(z, -1.4, 19.4);
    case 'barinak': return clamp(z, 1.8, 13.6);
    case 'gece': case 'metro': case 'tepe': return clamp(z, -5, 23);
    case 'stadyum': return clamp(z, -5, 27);
    case 'tersane': return clamp(z, 1.0, 23);
    case 'adalar': return clamp(z, 2.0, 23);
    case 'orman': return clamp(z, -4, 20);
    default: return clamp(z, BAND.z0 + 0.5, BAND.z1 - 0.5);
  }
}

export function installDisari(K: Kernel, teleport: (x: number, z: number) => void): DisariApi {
  const rng = K.rng('sim.disari');
  const rt = K.rt as unknown as Record<string, unknown>;
  let bus: BusView | null = null;
  // 17:24 user: Belgrad Ormanı stays a template for now (no bus there); the 42B serves the town from the büfe stop.
  // Boarding happens on the road at the bus's front door, not from the shelter.
  const atBusStop = (): RealmId | null => { const p = K.playerPos; const r = REALMS.find(r => Math.hypot(p.x - r.stop.x, p.z - r.stop.z) < 4.2); return r ? r.id : null; };
  // J1 Belgrad dönüş fix: the door follows the bus (it was pinned to the büfe stop, so nobody could board in the forest)
  const busDoor = () => { const s = bus || OTOBUS.stop; return { x: s.x + 1.5, z: s.z - 1.0 }; };
  const realmTarget = (rid: RealmId) => { const r = REALM_BY_ID[rid], reg = REGION_BY_ID[r.regions[0]]; return reg; };
  const atBusDoor = () => { const p = K.playerPos, dd = busDoor(); return Math.hypot(p.x - dd.x, p.z - dd.z) < 1.9; };
  let travel: DisariView['travel'] = null, travelTo: { x: number; z: number; guide?: DSave['guide']; realm?: RealmId } | null = null, jumped = false;
  let arrow: DisariView['arrow'] = null, lockToastT = 0, awayToastDone = false, acc = 0;

  function save(): DSave {
    const S = K.state;
    if (!S.zones || typeof S.zones !== 'object') (S as { zones: Record<string, Record<string, unknown>> }).zones = {};
    const z = (S.zones.martikoy ||= {});
    let d = z.d as DSave | undefined;
    if (!d || typeof d !== 'object') {
      d = { seen: ['iskele', 'carsi'], stops: ['iskele', 'carsi'], opened: ['iskele', 'carsi'], cats: [], photos: [], returned: [], carrying: null,
        coinsDay: 0, coins: [], coinsTaken: [], shops: {}, vehicles: ['yaya'], veh: 'yaya', guide: null, trips: 0, awayMoney: null, lastH: 8 };
      z.d = d;
    }
    d.seen ||= []; d.stops ||= ['iskele', 'carsi']; d.opened ||= []; d.cats ||= []; d.photos ||= []; d.returned ||= [];
    d.coins ||= []; d.coinsTaken ||= []; d.shops ||= {}; d.vehicles ||= ['yaya']; if (!d.veh) d.veh = 'yaya';
    return d;
  }
  const isOpen = (r: Region) => K.state.level >= r.level;
  const curRealm = (): RealmId => { const d = save(); if (!d.realm || !REALM_BY_ID[d.realm]) d.realm = realmAt(K.playerPos.x)?.id || 'iskele'; return d.realm; };
  // 2026-10-24 açık dünya anketi (geçiş: haritadan seç, ışınlan): every district can be picked on the map right away
  const knownStop = (_d: DSave, _id: string) => true;
  const total = () => K.state.money + (K.moneyApi ? K.moneyApi.kasaValue() : 0);

  function rollCoins(d: DSave) {
    if (d.coinsDay === K.state.day) return;
    d.coinsDay = K.state.day; d.coinsTaken = [];
    const idx = COIN_SPOTS.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = rng.int(0, i); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    d.coins = idx.slice(0, COINS_PER_DAY);
  }

  function startTravel(toRegion: Region, guide: DSave['guide'] = null, viaBus = false): boolean {
    const d = save(), S = K.state, p = K.playerPos;
    if (travel) return false;
    const fromR = regionAt(p.x);
    const toRealm = realmOfRegion(toRegion.id), here = REALM_BY_ID[curRealm()];
    if (!toRealm) { K.toast(toRegion.name + ' şimdilik kapalı. Yakında!', 'info'); return false; }
    if (!viaBus && toRealm.id !== here.id) {
      d.guide = { x: here.stop.x, z: here.stop.z, name: here.stop.name + ' (' + OTOBUS.line + ')' };
      rt.panel = null;
      K.toast(toRealm.name + '\'a yürüyerek gidilmez. ' + here.stop.name + ' durağında ' + OTOBUS.line + '\'yi bekle!', 'info');
      return false;
    }
    if (viaBus) {
      if (S.money >= OTOBUS.fare) { K.spend(OTOBUS.fare); K.toast(OTOBUS.driver + ': "Kartını bas, arkaya ilerle!" ' + fmtMoney(OTOBUS.fare), 'info'); }
      else K.toast(OTOBUS.driver + ': "Bin bin, bu seferlik benden."', 'good');
      travel = { t: 0, dur: OTOBUS.rideSec, mode: 'otobus', to: toRegion.short, from: fromR ? fromR.short : '' };
      const sp = realmSpawn(toRealm);
      travelTo = { x: sp.x, z: sp.z, guide, realm: toRealm.id };
      jumped = false; rt.panel = null; rt.boardOpen = false; d.trips++; K.stat('martikoyTrip'); K.stat('otobus');
      return true;
    }
    if (!isOpen(toRegion)) { K.toast(toRegion.name + ' ' + toRegion.level + '. seviyede açılır. ' + toRegion.lockLine, 'info'); return false; }
    if (!knownStop(d, toRegion.id)) { K.toast(toRegion.stop.name + ' durağını önce yürüyerek bul. Sonra dolmuş hep oraya gider!', 'info'); return false; }
    const from = regionAt(p.x);
    if (from && from.id === toRegion.id && Math.hypot(p.x - toRegion.stop.x, p.z - toRegion.stop.z) < 6) {
      if (guide) { d.guide = guide; K.toast(GUIDE_CAT.name + ' önden gidiyor, peşinden yürü!', 'good'); return true; }
      K.toast('Zaten buradasın! ' + toRegion.stop.name + '.', 'info'); return false;
    }
    const v = VEHICLES.find(x => x.id === d.veh && d.vehicles.includes(x.id));
    const seaPair = !!(from && from.vapur && toRegion.vapur) || !!toRegion.island || !!(from && from.island);
    let mode: TravelMode = seaPair ? 'vapur' : 'dolmus';
    const isl = !!toRegion.island || !!(from && from.island);   // no road to the islands: only the vapur or your own boat
    if (v && v.id !== 'yaya' && (!v.sea || seaPair) && !(isl && !v.sea)) mode = v.id as TravelMode;
    if (mode === 'dolmus' || mode === 'vapur') {
      const fare = FARES[mode];
      if (S.money >= fare) { K.spend(fare); K.toast((mode === 'vapur' ? 'Vapur bileti ' : DOLMUS.name + ': ') + fmtMoney(fare) + (mode === 'dolmus' ? '. "Arkaya uzatır mısın?"' : '. Düüüt!'), 'info'); }
      else K.toast(DOLMUS.driver + ': "Bu seferlik benden, sonra ödersin!"', 'good');
    } else K.toast(v!.name + ' ile yola çıktın!', 'good');
    const speed = v && mode === v.id ? v.speed : 1;
    travel = { t: 0, dur: Math.max(1.4, TRAVEL_SEC / Math.sqrt(speed)), mode, to: toRegion.short, from: from ? from.short : '' };
    travelTo = { x: toRegion.stop.x, z: toRegion.stop.z, guide };
    jumped = false;
    rt.panel = null; rt.boardOpen = false;
    d.trips++; K.stat('martikoyTrip');
    return true;
  }

  function dirWord(dx: number): string { return Math.abs(dx) < 4 ? 'tam burada' : dx > 0 ? 'doğuya doğru, denizi sağına al' : 'batıya doğru, iskeleye doğru'; }
  function targetOf(id: string): { x: number; z: number; name: string; region?: RegionId } | null {
    const pl = PLACES.find(p => p.id === id);
    if (pl) return { x: pl.x, z: walkZ(pl.region, pl.z), name: pl.name, region: pl.region };
    const sh = SIDE_SHOPS.find(s => s.id === id);
    if (sh) return { x: sh.x, z: sh.z, name: sh.name, region: sh.region };
    const rg = REGION_BY_ID[id];
    if (rg) return { x: rg.stop.x, z: rg.stop.z, name: rg.name, region: rg.id };
    if (id === 'owner') { const d = save(); const it = LOST_ITEMS.find(l => l.id === d.carrying); if (it) return { x: it.ox, z: walkZ(regionAt(it.ox)?.id, it.oz), name: it.owner, region: regionAt(it.ox)?.id }; }
    return null;
  }

  function handle(c: { kind: string; [k: string]: unknown }): boolean {
    if (c.kind !== 'disari') return false;
    const op = String(c.op || ''), id = c.id == null ? '' : String(c.id);
    const d = save(), S = K.state;
    switch (op) {
      case 'open': rt.boardOpen = false; rt.panel = 'harita'; K.logEv('panel', { id: 'harita' }); return true;
      case 'go': {
        const rg = REGION_BY_ID[id];
        if (rg) return startTravel(rg);
        const tg = targetOf(id);
        if (!tg || !tg.region) return true;
        const rr = REGION_BY_ID[tg.region];
        if (!isOpen(rr)) { K.toast(rr.name + ' ' + rr.level + '. seviyede açılır.', 'info'); return true; }
        const guide = { x: tg.x, z: tg.z, name: tg.name };
        if (knownStop(d, rr.id)) startTravel(rr, guide);
        else { d.guide = guide; rt.panel = null; K.toast(GUIDE_CAT.name + ' yolu biliyor! Durağı henüz bulmadın, yürüyerek gidiyoruz.', 'good'); }
        return true;
      }
      case 'guide': {
        const tg = targetOf(id);
        if (!tg) { d.guide = null; return true; }
        if (tg.region && !isOpen(REGION_BY_ID[tg.region])) { K.toast(REGION_BY_ID[tg.region].name + ' henüz kapalı.', 'info'); return true; }
        d.guide = { x: tg.x, z: tg.z, name: tg.name }; rt.panel = null;
        K.toast(GUIDE_CAT.name + ': "Miyav!" (Peşimden gel demek.)', 'good');
        return true;
      }
      case 'stop': d.guide = null; K.toast(GUIDE_CAT.name + ' oturdu, kuyruğunu doladı. Rehberlik bitti.', 'info'); return true;
      case 'ask': {
        const tg = targetOf(id) || (d.guide ? { ...d.guide } : null) || (() => { const nx = REGIONS.find(r => isOpen(r) && !d.stops.includes(r.id)); return nx ? { x: nx.stop.x, z: nx.stop.z, name: nx.name } : null; })();
        if (!tg) { K.toast('Teyze: "Her yeri gezmişsin evladım, maşallah!"', 'good'); return true; }
        const dx = tg.x - K.playerPos.x, L = rng.pick(ASK_LINES);
        K.toast(L.who + ': "' + L.line.replace('{to}', tg.name).replace('{dir}', dirWord(dx)) + '"', 'info');
        arrow = { text: tg.name, dir: dx >= 0 ? 1 : -1, t: 7 };
        rt.panel = null;
        return true;
      }
      case 'buyShop': {
        const sh = SIDE_SHOPS.find(s => s.id === id); if (!sh) return true;
        if (d.shops[id]) return true;
        const rg = REGION_BY_ID[sh.region];
        if (!isOpen(rg)) { K.toast(rg.name + ' açılınca devralabilirsin.', 'info'); return true; }
        if (Object.keys(d.shops).length >= SHOP_MAX) { K.toast('En fazla ' + SHOP_MAX + ' yan dükkan. Sabri bir tane, dükkan çok!', 'info'); return true; }
        if (S.money < sh.price) { K.toast('Kasada ' + fmtMoney(sh.price) + ' olmalı.', 'bad'); return true; }
        K.spend(sh.price); d.shops[id] = { till: 0 };
        K.toast(sh.name + ' artık senin! "' + sh.line + '"', 'good'); K.stat('yanDukkan'); K.addXP(20);
        return true;
      }
      case 'buyVeh': {
        const v = VEHICLES.find(x => x.id === id); if (!v || d.vehicles.includes(id)) return true;
        if (S.level < v.level) { K.toast(v.name + ' ' + v.level + '. seviyede açılır.', 'info'); return true; }
        if (v.sea && !isOpen(REGION_BY_ID.barinak)) { K.toast('Kayık için önce Balıkçı Barınağı açılmalı.', 'info'); return true; }
        if (S.money < v.price) { K.toast('Kasada ' + fmtMoney(v.price) + ' olmalı.', 'bad'); return true; }
        K.spend(v.price); d.vehicles.push(id); d.veh = id;
        K.toast(v.name + ' senin! ' + v.blurb, 'good');
        return true;
      }
      case 'veh': if (d.vehicles.includes(id)) { d.veh = id; } return true;
      // 42B: wait at a bus stop, the bus drives in, then board (cutscene travel)
      case 'otobusBekle': {
        const at = atBusStop();
        if (!at) { K.toast('Önce otobüs durağına git.', 'info'); return true; }
        if (bus || travel) return true;
        const st = REALM_BY_ID[at].stop;
        bus = { phase: 'geliyor', t: 0, dur: OTOBUS.waitSec, x: st.x, z: st.z, to: '' };
        K.toast(OTOBUS.line + ' yolda, birazdan burada! Gelince ön kapısından bin.', 'info');
        return true;
      }
      case 'otobusBin': {
        if (!bus || bus.phase !== 'durakta') return true;
        if (!atBusDoor()) { K.toast('Otobüsün ön kapısına yürü, oradan bin.', 'info'); return true; }
        const to = REGION_BY_ID[id];
        const toRealm = to ? realmOfRegion(to.id) : null;
        if (!to || !toRealm || toRealm.id === atBusStop()) { K.toast('42B oraya gitmiyor.', 'info'); return true; }
        bus = { ...bus, phase: 'gidiyor', t: 0, dur: 2.5 };
        startTravel(to, null, true);
        return true;
      }
    }
    return false;
  }

  function hourDelta(d: DSave, h: number): number {
    const dh = h >= d.lastH ? h - d.lastH : (24 - d.lastH) + (h - 8);
    d.lastH = h;
    return clamp(dh, 0, 1);
  }

  K.addSystem({
    id: 'disari', order: 48, phase: 'sim',
    step(ctx) {
      if (!K.rt.started) return;
      const dt0 = ctx.dt;
      // travel moment (runs even while paused for a panel)
      if (travel) {
        travel.t += dt0;
        if (!jumped && travel.t >= travel.dur * 0.5 && travelTo) {
          const d = save(); if (travelTo.realm) d.realm = travelTo.realm;
          jumped = true; teleport(travelTo.x, travelTo.z);
          if (travelTo.guide) d.guide = travelTo.guide;
        }
        if (travel.t >= travel.dur) {
          const to = travel.to; travel = null; travelTo = null;
          K.toast(to + ' durağı! ' + (save().guide ? GUIDE_CAT.name + ' seni bekliyor, peşinden git.' : 'İyi gezmeler.'), 'good');
        }
      }
      if (bus) {
        bus.t += dt0;
        if (bus.phase === 'geliyor' && bus.t >= bus.dur) { bus = { ...bus, phase: 'durakta', t: 0, dur: 16 }; K.toast('Kapılar açıldı. Bin!', 'good'); }
        else if (bus.phase === 'durakta' && bus.t >= bus.dur) { bus = { ...bus, phase: 'gidiyor', t: 0, dur: 2.5 }; K.toast(OTOBUS.driver + ': "Bekleyemem abi, tarifem var!"', 'info'); }
        else if (bus.phase === 'gidiyor' && bus.t >= bus.dur) bus = null;
      }
      if (arrow) { arrow.t -= dt0; if (arrow.t <= 0) arrow = null; }
      if (lockToastT > 0) lockToastT -= dt0;
      if (K.rt.paused) return;
      acc += dt0; if (acc < 0.2) return;
      const dt = acc; acc = 0;
      const d = save(), S = K.state, p = K.playerPos, h = K.hour();
      rollCoins(d);
      // region opening announcements
      for (const r of REGIONS) if (isOpen(r) && !d.opened.includes(r.id)) {
        d.opened.push(r.id);
        if (r.level > 1) K.toast('Yeni mahalle açıldı: ' + r.name + '! Haritada bak, Çarşı Sokağı\'nın sonundan yürü.', 'good');
      }
      // lock push-back: the first locked region blocks everything east of it
      const lockR = REGIONS.find(r => !isOpen(r));
      if (lockR && p.x > lockR.x0 - 0.3 && !travel) {
        teleport(lockR.x0 - 1.0, walkZ(regionAt(lockR.x0 - 1.0)?.id, p.z));
        if (lockToastT <= 0) { lockToastT = 4; K.toast(lockR.lockLine + ' (' + lockR.name + ', ' + lockR.level + '. seviye)', 'info'); }
      }
      // J1 realm walls: walking never crosses into another realm; anything else (admin teleport, load) adopts the realm
      if (!travel) {
        const home = REALM_BY_ID[curRealm()], cur = realmAt(p.x);
        if (!cur || cur.id !== home.id) {
          if (p.x > home.x0 - 6 && p.x < home.x1 + 6) {
            teleport(p.x < home.x0 ? home.x0 + 0.6 : home.x1 - 0.6, p.z);
            if (lockToastT <= 0) { lockToastT = 4; K.toast('🚌 Yürüyerek geçilmez. Başka mahalleye ' + OTOBUS.line + ' ile git: ' + home.stop.name + '.', 'info'); }
          } else if (cur) d.realm = cur.id;
          else { const sp = realmSpawn(home); teleport(sp.x, sp.z); }
        }
      }
      const reg = regionAt(p.x);
      if (reg && !d.seen.includes(reg.id)) { d.seen.push(reg.id); K.toast(reg.name + ': ' + reg.blurb, 'good'); K.addXP(10); }
      for (const r of REGIONS) if (!d.stops.includes(r.id) && Math.hypot(p.x - r.stop.x, p.z - r.stop.z) < 4.5) {
        d.stops.push(r.id); K.toast('Dolmuş durağı bulundu: ' + r.stop.name + '. Artık haritadan buraya gelebilirsin!', 'good');
      }
      // away from the büfe: the ekip keeps it running
      const away = p.x > 62;
      if (away && d.awayMoney == null) { d.awayMoney = total(); awayToastDone = false; }
      if (away && !awayToastDone && d.awayMoney != null) { awayToastDone = true; if (S.workers && S.workers.length) K.toast(rng.pick(AWAY_LINES), 'info'); }
      if (!away && d.awayMoney != null && p.x < 55) {
        const got = total() - d.awayMoney; d.awayMoney = null;
        if (got > 0) K.toast(BACK_LINE.replace('{m}', fmtMoney(got)), 'good');
      }
      // guide target reached
      if (d.guide && Math.hypot(p.x - d.guide.x, p.z - d.guide.z) < 2.6) { K.toast(GUIDE_CAT.arrive + ' (' + d.guide.name + ')', 'good'); d.guide = null; }
      // finds
      for (const c of HIDDEN_CATS) if (!d.cats.includes(c.id) && Math.hypot(p.x - c.x, p.z - c.z) < 1.9) {
        d.cats.push(c.id); const v = 40 + S.level * 15; K.earn(v, { x: c.x, z: c.z });
        K.toast(c.line + ' Gizli kedi ' + d.cats.length + '/' + HIDDEN_CATS.length + ' (+' + fmtMoney(v) + ' mama parası bulundu)', 'good'); K.stat('gizliKedi');
      }
      for (const i of d.coins) if (!d.coinsTaken.includes(i)) {
        const c = COIN_SPOTS[i];
        if (Math.hypot(p.x - c.x, p.z - c.z) < 1.4) { d.coinsTaken.push(i); const v = 15 + S.level * 8 + rng.int(0, 10); K.earn(v, c); K.toast('Yerde bozuk para! +' + fmtMoney(v) + ' (Kimse görmedi, martı hariç.)', 'good'); }
      }
      for (const ph of PHOTO_SPOTS) if (!d.photos.includes(ph.id) && Math.hypot(p.x - ph.x, p.z - ph.z) < 1.6) {
        d.photos.push(ph.id); K.addXP(15); K.toast('Çıt! ' + ph.line + ' Foto albümü ' + d.photos.length + '/' + PHOTO_SPOTS.length, 'good'); K.stat('fotoNokta');
      }
      if (!d.carrying) {
        for (const it of LOST_ITEMS) if (!d.returned.includes(it.id) && Math.hypot(p.x - it.x, p.z - it.z) < 1.5) {
          d.carrying = it.id; K.toast(it.name + ' buldun! Sahibi: ' + it.owner + '. Haritadan "Sahibine götür" de, Fındık yolu gösterir.', 'good'); break;
        }
      } else {
        const it = LOST_ITEMS.find(l => l.id === d.carrying);
        if (!it) d.carrying = null;
        else if (Math.hypot(p.x - it.ox, p.z - walkZ(regionAt(it.ox)?.id, it.oz)) < 2.4) {
          d.returned.push(it.id); d.carrying = null; const v = it.reward + S.level * 10; K.earn(v, { x: it.ox, z: it.oz });
          K.toast(it.owner + ': "' + it.thanks + '" +' + fmtMoney(v), 'good'); K.addXP(25); K.stat('kayipEsya');
        }
      }
      // side shop tills
      const dh = hourDelta(d, h);
      for (const sh of SIDE_SHOPS) {
        const o = d.shops[sh.id]; if (!o) continue;
        o.till = Math.min(sh.perHour * SHOP_CAP_H * (1 + S.level * 0.1), o.till + dh * sh.perHour * (1 + S.level * 0.1));
        if (o.till >= 1 && Math.hypot(p.x - sh.x, p.z - sh.z) < 2.6) {
          const v = Math.floor(o.till); o.till -= v; K.earn(v, { x: sh.x, z: sh.z });
          K.toast(sh.name + ' kasası: +' + fmtMoney(v) + '. "' + sh.line + '"', 'good');
        }
      }
      void dt;
    },
  });

  function view(): DisariView {
    const d = save(), p = K.playerPos, reg = regionAt(p.x), lockR = REGIONS.find(r => !isOpen(r));
    const open: Record<string, boolean> = {}; for (const r of REGIONS) open[r.id] = isOpen(r);
    const carrying = d.carrying ? LOST_ITEMS.find(l => l.id === d.carrying) : null;
    return {
      region: reg ? reg.id : null, away: p.x > 62,
      locked: lockR ? { x: lockR.x0, region: lockR.name, line: lockR.lockLine } : (() => { const w = REALM_WALLS.find(x => Math.abs(p.x - x) < 45); return w != null ? { x: w, region: 'realm', line: OTOBUS.line + ' ile geçilir. Yürüyerek değil!' } : null; })(),
      travel: travel ? { ...travel } : null, guide: d.guide, arrow, bus: bus ? { ...bus } : null, atBusStop: atBusStop(), atBusDoor: !!bus && atBusDoor(), realm: curRealm(),
      busTo: REALMS.filter(r => atBusStop() && r.id !== atBusStop()).map(r => ({ id: realmTarget(r.id).id, name: r.name })),
      catsLeft: HIDDEN_CATS.filter(c => !d.cats.includes(c.id)).map(c => ({ id: c.id, x: c.x, z: c.z })),
      coins: d.coins.filter(i => !d.coinsTaken.includes(i)).map(i => ({ i, x: COIN_SPOTS[i].x, z: COIN_SPOTS[i].z })),
      photos: PHOTO_SPOTS.map(ph => ({ id: ph.id, x: ph.x, z: ph.z, done: d.photos.includes(ph.id) })),
      lost: (() => { if (d.carrying) return null; const it = LOST_ITEMS.find(l => !d.returned.includes(l.id) && open[regionAt(l.x)?.id || 'iskele']); return it ? { id: it.id, x: it.x, z: it.z, name: it.name } : null; })(),
      owner: carrying ? { x: carrying.ox, z: walkZ(regionAt(carrying.ox)?.id, carrying.oz), name: carrying.owner } : null,
      shops: SIDE_SHOPS.map(s => ({ id: s.id, owned: !!d.shops[s.id], till: d.shops[s.id]?.till || 0, x: s.x, z: s.z })),
      open, hour: K.hour(),
    };
  }

  function model(): Record<string, any> {
    const d = save(), S = K.state, p = K.playerPos, h = K.hour(), reg = regionAt(p.x);
    const carrying = d.carrying ? LOST_ITEMS.find(l => l.id === d.carrying) : null;
    return {
      here: reg ? reg.id : null, x: p.x, money: S.money, level: S.level, guide: d.guide ? d.guide.name : null, travel: !!travel,
      realm: curRealm(), realms: REALMS.map(r => ({ id: r.id, name: r.name, stop: r.stop.name, here: r.id === curRealm() })),
      regions: REGIONS.filter(r => realmOfRegion(r.id)).map(r => ({ id: r.id, name: r.name, short: r.short, x0: r.x0, x1: r.x1, color: r.color, blurb: r.blurb, level: r.level, open: isOpen(r) && !!realmOfRegion(r.id), seen: d.seen.includes(r.id),
        realm: realmOfRegion(r.id)?.id || null, bus: (realmOfRegion(r.id)?.id || null) !== curRealm(),
        stop: r.stop.name, stopKnown: knownStop(d, r.id), vapur: !!r.vapur, map: r.map, island: !!r.island, lockLine: realmOfRegion(r.id) ? r.lockLine : 'Şimdilik kapalı. Yakında açılacak!' })),
      places: PLACES.map(pl => {
        const op = h >= pl.open && h < pl.close, night = h >= 19;
        return { id: pl.id, name: pl.name, icon: pl.icon, kind: pl.kind, region: pl.region, regionName: REGION_BY_ID[pl.region].short, x: pl.x, open: op, hours: pl.open + ':00-' + (pl.close === 24 ? '24:00' : pl.close + ':00'),
          line: op ? (night && pl.night ? '🌙 ' + pl.night : pl.day || pl.night) : pl.closed, blurb: pl.blurb, reachable: isOpen(REGION_BY_ID[pl.region]) };
      }),
      shops: SIDE_SHOPS.map(s => ({ id: s.id, name: s.name, icon: s.icon, region: REGION_BY_ID[s.region].short, price: s.price, perHour: Math.round(s.perHour * (1 + S.level * 0.1)), line: s.line,
        owned: !!d.shops[s.id], till: Math.floor(d.shops[s.id]?.till || 0), open: isOpen(REGION_BY_ID[s.region]) })),
      shopsOwned: Object.keys(d.shops).length, shopMax: SHOP_MAX,
      vehicles: VEHICLES.map(v => ({ id: v.id, name: v.name, icon: v.icon, blurb: v.blurb, price: v.price, level: v.level, owned: d.vehicles.includes(v.id), on: d.veh === v.id })),
      finds: {
        cats: d.cats.length, catsN: HIDDEN_CATS.length, catNames: HIDDEN_CATS.filter(c => d.cats.includes(c.id)).map(c => c.name),
        photos: d.photos.length, photosN: PHOTO_SPOTS.length, photoNames: PHOTO_SPOTS.filter(x => d.photos.includes(x.id)).map(x => x.name),
        returned: d.returned.length, lostN: LOST_ITEMS.length, carrying: carrying ? { name: carrying.name, owner: carrying.owner } : null,
        coinsLeft: d.coins.filter(i => !d.coinsTaken.includes(i)).length,
      },
      trips: d.trips, fares: FARES, dolmus: DOLMUS,
    };
  }
  function summary(): Record<string, any> {
    const d = save();
    const openN = REGIONS.filter(isOpen).length;
    const next = REGIONS.find(r => !isOpen(r));
    return { open: openN, total: REGIONS.length, next: next ? next.name + ' (' + next.level + '. seviye)' : null, cats: d.cats.length, catsN: HIDDEN_CATS.length, shops: Object.keys(d.shops).length };
  }

  const api: DisariApi = { handle, view, model, summary };
  rt.disari = api;
  return api;
}

export function disariApi(r: Rules | { rt: unknown } | null | undefined): DisariApi | null { return r ? ((r.rt as { disari?: DisariApi }).disari || null) : null; }
