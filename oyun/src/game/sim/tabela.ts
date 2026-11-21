/**
 * Tabela seviyesi (2026-10-24 user: "dekor ekranındaki tabela sekmesi çok işlevsiz, işe yarar hale getir").
 * The sign is now an upgrade line that pulls passers-by: each tier adds walk-ins all day and more at night (lit signs
 * are seen from far). Plus a glow colour. State: S.zones.tabela { tier, renk }. Command { kind: 'tabela', op, value }.
 */
import type { Kernel } from './state';

export const TABELA = [
  { ad: 'Tahta tabela', fiyat: 0, musteri: 0, gece: 0, desc: 'Elle boyanmış, samimi.' },
  { ad: 'Işıklı tabela', fiyat: 2500, musteri: 0.05, gece: 0.08, desc: 'Akşam yanar, iskeleden görünür.' },
  { ad: 'Neon tabela', fiyat: 9000, musteri: 0.09, gece: 0.18, desc: 'Gece pazarının yıldızı, renkli neon.' },
  { ad: 'Dev LED pano', fiyat: 30000, musteri: 0.15, gece: 0.25, desc: 'Gündüz de parlar, vapurdan okunur.' },
];
export const TABELA_RENK = ['#ffe08a', '#ff5a7a', '#5ad1ff', '#7dff8a', '#c58bff', '#ffffff'];
export interface TabelaSave { tier: number; renk: string }
export function tabelaSave(S: { zones: Record<string, Record<string, unknown>> }): TabelaSave {
  const z = (S.zones.tabela ||= { tier: 0, renk: TABELA_RENK[0] }) as unknown as TabelaSave;
  if (typeof z.tier !== 'number') z.tier = 0; if (typeof z.renk !== 'string') z.renk = TABELA_RENK[0];
  return z;
}
/** extra walk-in share for the hour (customers.ts multiplies arrivals by 1 + this) */
export function tabelaFx(S: { zones: Record<string, Record<string, unknown>> }, hour: number): number {
  const t = TABELA[tabelaSave(S).tier] || TABELA[0];
  return t.musteri + (hour >= 19 || hour < 4 ? t.gece : 0);
}
export function installTabela(K: Kernel) {
  const S = K.state;
  return {
    run(c: { op: string; value?: unknown }): boolean {
      const z = tabelaSave(S);
      if (c.op === 'buy') {
        const next = TABELA[z.tier + 1]; if (!next) return false;
        if (S.money < next.fiyat) { K.toast('Kasada ' + next.fiyat.toLocaleString('tr-TR') + ' ₺ lazım.', 'bad'); return false; }
        S.money -= next.fiyat; z.tier++;
        K.toast(next.ad + ' takıldı! Daha çok kişi büfeni görecek.', 'good'); K.logEv('tabela', { tier: z.tier }); K.saveNow();
        return true;
      }
      if (c.op === 'renk' && typeof c.value === 'string' && TABELA_RENK.includes(c.value)) { z.renk = c.value; return true; }
      return false;
    },
  };
}
