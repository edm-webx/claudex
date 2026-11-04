/**
 * Faz 2 dükkan zinciri (content/dukkanlar.ts). Pure sim. Save: GameState.zones['zincir'] =
 * { v, dukkanlar: { [id]: { ad, menu[], seviye, acildi, ciro } } } (owner choices only, server-friendly).
 * Commands: { kind: 'zincir', op: 'ac' | 'ad' | 'menu', id, ad?, item?, on? }.
 * Income: at each game day end, every open shop pays gunluk × (1 + menuBonus × (menu-1)) × a small daily wobble.
 */
import { DUKKANLAR, DUKKAN_AD_MAX, ZINCIR_SCHEMA, type DukkanDef } from '../../content/dukkanlar';
import type { Kernel } from './state';
import { fmtMoney } from './util';

export const ZINCIR_KEY = 'zincir';
interface ShopSave { ad: string; menu: string[]; seviye: number; acildi: number; ciro: number }
interface Save { v: number; dukkanlar: Record<string, ShopSave> }
export interface DukkanView {
  id: string; tur: string; ad: string; varsayilan: string; desc: string; slogan: string; icon: string; color: string; map: [number, number];
  cost: number; gunluk: number; durum: 'acik' | 'alinabilir' | 'kilitli'; neden: string;
  menu: { id: string; name: string; price: number; on: boolean }[]; maxMenu: number; ciro: number;
}
export interface ZincirApi { handle(c: { kind: string; [k: string]: unknown }): boolean; view(): DukkanView[]; gunlukToplam(): number }
export function zincirApi(r: { rt: unknown } | null | undefined): ZincirApi | null { return r ? ((r.rt as { zincir?: ZincirApi }).zincir || null) : null; }

const clean = (s: string) => s.replace(/[<>"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, DUKKAN_AD_MAX);

export function installZincir(K: Kernel): ZincirApi {
  const S = K.state, rng = K.rng('sim.zincir');
  const G = (): Save => {
    if (!S.zones || typeof S.zones !== 'object') S.zones = {};
    let g = S.zones[ZINCIR_KEY] as unknown as Save | undefined;
    if (!g || typeof g !== 'object') { g = { v: ZINCIR_SCHEMA, dukkanlar: {} }; S.zones[ZINCIR_KEY] = g as unknown as Record<string, unknown>; }
    if (!g.dukkanlar || typeof g.dukkanlar !== 'object') g.dukkanlar = {};
    g.v = ZINCIR_SCHEMA;
    return g;
  };
  const open = (id: string) => !!G().dukkanlar[id];
  const why = (d: DukkanDef): string => {
    if ((S.stage || 1) < d.req.stage) return 'Büfe ' + d.req.stage + '. aşamaya gelince';
    if (d.req.prev && !open(d.req.prev)) return (DUKKANLAR.find(x => x.id === d.req.prev)?.ad || 'Önceki dükkan') + ' açılınca';
    return '';
  };
  const dailyOf = (d: DukkanDef, s: ShopSave) => d.gunluk * (1 + d.menuBonus * Math.max(0, s.menu.length - 1)) * (1 + 0.25 * (s.seviye - 1));
  function ac(id: string): void {
    const d = DUKKANLAR.find(x => x.id === id); if (!d || open(id)) return;
    const w = why(d); if (w) { K.toast(w + ' açılır.', 'info'); return; }
    if (S.money < d.cost) { K.toast(d.ad + ' için ' + fmtMoney(d.cost) + ' lazım.', 'bad'); return; }
    K.spend(d.cost);
    G().dukkanlar[id] = { ad: d.ad, menu: d.katalog.slice(0, 2).map(m => m.id), seviye: 1, acildi: S.day, ciro: 0 };
    K.toast(d.ad + ' açıldı! Adını ve menüsünü sen seç.', 'good'); K.logEv('dukkanAc', { id }); K.saveNow();
  }
  K.bus.on('dayEnd', () => {
    const g = G(); let sum = 0;
    for (const d of DUKKANLAR) { const s = g.dukkanlar[d.id]; if (!s) continue; const v = Math.round(dailyOf(d, s) * (0.85 + rng.next() * 0.3)); s.ciro += v; sum += v; }
    if (sum > 0) { S.money += sum; S.totalEarned += sum; K.toast('Zincir dükkanların bugün ' + fmtMoney(sum) + ' kazandırdı.', 'good'); }
  });
  const api: ZincirApi = {
    handle(c) {
      const id = String(c.id ?? ''), g = G(), s = g.dukkanlar[id], d = DUKKANLAR.find(x => x.id === id);
      if (c.op === 'ac') { ac(id); return true; }
      if (!s || !d) return true;
      if (c.op === 'ad') { const a = clean(String(c.ad ?? '')); if (a.length >= 2) { s.ad = a; K.saveNow(); } return true; }
      if (c.op === 'menu') {
        const it = String(c.item ?? ''); if (!d.katalog.some(m => m.id === it)) return true;
        const on = !!c.on, has = s.menu.includes(it);
        if (on && !has) { if (s.menu.length >= d.maxMenu) { K.toast('Menüye en fazla ' + d.maxMenu + ' ürün.', 'info'); return true; } s.menu.push(it); }
        if (!on && has && s.menu.length > 1) s.menu = s.menu.filter(x => x !== it);
        K.saveNow(); return true;
      }
      return false;
    },
    view() {
      const g = G();
      return DUKKANLAR.map(d => {
        const s = g.dukkanlar[d.id], w = why(d);
        return { id: d.id, tur: d.tur, ad: s ? s.ad : d.ad, varsayilan: d.ad, desc: d.desc, slogan: d.slogan, icon: d.icon, color: d.color, map: d.map,
          cost: d.cost, gunluk: Math.round(s ? dailyOf(d, s) : d.gunluk), durum: s ? 'acik' : w ? 'kilitli' : 'alinabilir', neden: w,
          menu: d.katalog.map(m => ({ ...m, on: !!s && s.menu.includes(m.id) })), maxMenu: d.maxMenu, ciro: s ? s.ciro : 0 } as DukkanView;
      });
    },
    gunlukToplam() { const g = G(); return DUKKANLAR.reduce((t, d) => t + (g.dukkanlar[d.id] ? dailyOf(d, g.dukkanlar[d.id]) : 0), 0); },
  };
  (K.rt as unknown as { zincir?: ZincirApi }).zincir = api;
  return api;
}
