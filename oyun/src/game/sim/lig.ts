/**
 * Boğaz Ligi sim (content/lig.ts). State S.zones.lig: { fin, bolum, maclar, oynanan, gecmis }.
 * Game round g = floor((day - 3) / 7) (same match days as halisaha.ts); season = floor(g / 5), round k = g % 5.
 * A round is finalized the day after its match day: AI pairs are simulated, an unplayed player match is a 0-3 forfeit.
 * The player's real result is recorded once per round (oynanan guard), so a result can never be submitted twice.
 */
import type { Kernel } from './state';
import { KULUP, LIG_BY_ID, LIG_ADI, SEZON_TUR, BASLANGIC, uyeler, eslesme, simMac, tablo, type Mac } from '../../content/lig';
import { MAC_GUNU_EVERY, MAC_GUNU_OFFSET } from './halisaha';

interface Gecmis { s: number; sampiyon: [string, string]; bolum: number; sira: number; puan: number }
export interface LigSave { fin: number; bolum: Record<string, number>; maclar: Mac[]; oynanan: Record<string, boolean>; gecmis: Gecmis[] }
export const turOfDay = (day: number) => Math.floor((day - MAC_GUNU_OFFSET) / MAC_GUNU_EVERY);

export function installLig(K: Kernel) {
  const S = K.state, rt = K.rt as unknown as Record<string, unknown>;
  const z = (): LigSave => {
    const l = (S.zones.lig ||= {}) as unknown as LigSave;
    if (!Number.isFinite(l.fin)) l.fin = 0;
    if (!l.bolum || typeof l.bolum !== 'object') l.bolum = { ...BASLANGIC };
    l.maclar ||= []; l.oynanan ||= {}; l.gecmis ||= [];
    return l;
  };
  /** The founded club (mulk.takim: name, colours, crest) takes over the player's league slot. */
  function syncKulup() {
    const t = (S.zones.arsa as { takim?: { ad: string; renk: string; renk2?: string; arma?: string } | null } | undefined)?.takim; if (!t) return;
    KULUP.ad = (t.arma ? t.arma + ' ' : '') + t.ad; KULUP.renk = [t.renk, t.renk2 || KULUP.renk[1]];
  }
  const ad = (id: string) => { syncKulup(); return LIG_BY_ID[id]?.ad || id; };

  /** Player's fixture for game round g: opponent id and whether the player is home. */
  function fixture(g: number) {
    const l = z(), b = l.bolum[KULUP.id] ?? 1, k = ((g % SEZON_TUR) + SEZON_TUR) % SEZON_TUR;
    const p = eslesme(uyeler(l.bolum, b), k).find(x => x.includes(KULUP.id));
    return p ? { s: Math.floor(g / SEZON_TUR), k, bolum: b, rakip: p[0] === KULUP.id ? p[1] : p[0], ic: p[0] === KULUP.id } : null;
  }
  /** MacGunu-shaped offer for the match day of `day`, or null when the player has no fixture. */
  function mac(day: number) {
    syncKulup();
    const g = turOfDay(day), f = fixture(g); if (!f || g < 0) return null;
    if (z().oynanan[`${f.s}-${f.k}`]) return null;
    const r = LIG_BY_ID[f.rakip];
    return { team: KULUP.id, name: KULUP.ad, colors: KULUP.renk, rival: r.id, rivalName: r.ad, rivalColors: r.renk, ligG: g };
  }

  /** 2026-11-08: the club's next unplayed league fixture from `day` on (ticket matches at the gate play it early, so the points count). */
  function siradaki(day: number) {
    syncKulup(); const l = z();
    for (let g = Math.max(l.fin, turOfDay(day)); g < l.fin + SEZON_TUR; g++) {
      const f = fixture(g); if (!f || l.oynanan[`${f.s}-${f.k}`]) continue;
      const r = LIG_BY_ID[f.rakip];
      return { team: KULUP.id, name: KULUP.ad, colors: KULUP.renk, rival: r.id, rivalName: r.ad, rivalColors: r.renk, ligG: g, hafta: f.k + 1, bolum: LIG_ADI[f.bolum] };
    }
    return null;
  }

  function sezonSonu(s: number) {
    const l = z(), ms = l.maclar.filter(m => m.s === s), tb = [0, 1].map(b => tablo(uyeler(l.bolum, b), ms.filter(m => l.bolum[m.ev] === b)));
    const mine = l.bolum[KULUP.id] ?? 1, row = tb[mine].findIndex(r => r.id === KULUP.id);
    l.gecmis.push({ s: s + 1, sampiyon: [tb[0][0].id, tb[1][0].id], bolum: mine, sira: row + 1, puan: tb[mine][row].p }); if (l.gecmis.length > 10) l.gecmis.shift();
    const up = tb[1][0].id, down = tb[0][tb[0].length - 1].id;
    l.bolum[up] = 0; l.bolum[down] = 1;
    if (up === KULUP.id) { (K.earnTam || K.earn)(10000); K.toast('🏆 Mahalle Ligi şampiyonu! Üst lige çıktın. +10.000 ₺', 'good'); K.logEv('ligYukseldi', { s: s + 1 }); }
    else if (down === KULUP.id) K.toast('Alt lige düştük. Haftaya toparlarız abi.', 'info');
    else if (mine === 0 && tb[0][0].id === KULUP.id) { (K.earnTam || K.earn)(40000); K.toast('🏆 Boğaz Süper Ligi şampiyonuyuz! +40.000 ₺', 'good'); }
    else K.toast(`Sezon bitti: ${LIG_ADI[mine]} ${row + 1}. sıra.`, 'info');
    l.maclar = l.maclar.filter(m => m.s > s);
  }

  /** Close round g: simulate every AI pair, forfeit the player's pair if nothing was recorded. */
  function turKapat(g: number) {
    const l = z(), s = Math.floor(g / SEZON_TUR), k = g % SEZON_TUR;
    for (const b of [0, 1]) for (const [ev, dep] of eslesme(uyeler(l.bolum, b), k)) {
      if (ev === KULUP.id || dep === KULUP.id) {
        if (l.oynanan[`${s}-${k}`]) continue;
        const ic = ev === KULUP.id; l.maclar.push({ s, k, b, ev, dep, eg: ic ? 0 : 3, dg: ic ? 3 : 0 }); l.oynanan[`${s}-${k}`] = true;
        K.toast('Maç oynanmadı, hükmen 0-3 yazıldı.', 'bad'); continue;
      }
      const [eg, dg] = simMac(s, k, ev, dep); l.maclar.push({ s, k, b, ev, dep, eg, dg });
    }
    if (k === SEZON_TUR - 1) sezonSonu(s);
  }

  /** Record the player's real result for the offer made by mac(); false when it was already recorded. */
  function sonuc(g: number, biz: number, onlar: number): boolean {
    const l = z(), f = fixture(g); if (!f || g < l.fin) return false;
    const key = `${f.s}-${f.k}`; if (l.oynanan[key]) return false;
    l.oynanan[key] = true; l.maclar.push({ s: f.s, k: f.k, b: f.bolum, ev: f.ic ? KULUP.id : f.rakip, dep: f.ic ? f.rakip : KULUP.id, eg: f.ic ? biz : onlar, dg: f.ic ? onlar : biz });
    K.logEv('ligMac', { s: f.s, k: f.k, biz, onlar }); return true;
  }

  K.addSystem({ id: 'lig', order: 51, phase: 'sim', step() {
    if (!K.rt.started) return;
    const l = z();
    while (MAC_GUNU_OFFSET + MAC_GUNU_EVERY * l.fin < S.day && l.fin < 400) { turKapat(l.fin); l.fin++; }
  } });

  function model() {
    const l = z(), g = Math.max(0, turOfDay(S.day)), s = Math.floor(g / SEZON_TUR), mine = l.bolum[KULUP.id] ?? 1, ms = l.maclar.filter(m => m.s === s);
    const tab = (b: number) => tablo(uyeler(l.bolum, b), ms.filter(m => l.bolum[m.ev] === b)).map(r => ({ ...r, ad: ad(r.id), renk: LIG_BY_ID[r.id].renk, ben: r.id === KULUP.id }));
    const f = fixture(g), sonraki = f && !l.oynanan[`${f.s}-${f.k}`] ? { rakip: ad(f.rakip), ic: f.ic, gun: MAC_GUNU_OFFSET + MAC_GUNU_EVERY * g } : null;
    return {
      kulup: (S.zones.arsa as { takim?: unknown } | undefined)?.takim ?? null, ist: (S.zones.halisaha as unknown) ?? null,
      sezon: s + 1, tur: (g % SEZON_TUR) + 1, turN: SEZON_TUR, benBolum: mine, bolumAd: [...LIG_ADI], tablo: [tab(0), tab(1)], sonraki,
      gecmis: l.gecmis.slice(-5).map(h => ({ ...h, sampiyon: h.sampiyon.map(ad) })),
      benimMaclar: l.maclar.filter(m => m.ev === KULUP.id || m.dep === KULUP.id).slice(-6).map(m => ({ ev: ad(m.ev), dep: ad(m.dep), eg: m.eg, dg: m.dg, k: m.k + 1 })),
    };
  }
  const api = { fixture, mac, siradaki, sonuc, model, turKapat };
  rt.lig = api;
  return api;
}
export type LigApi = ReturnType<typeof installLig>;
