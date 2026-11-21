// FUT-02: takım yapay zekâsı: oyun planı (MatchOpts.plan), seed'li eğilim, alan sahipliği + emniyet (rol akışkanlığı), güç farkı, m.heat.
import { describe, it, expect } from 'vitest';
import { createMatch, PLANLAR, WD, L } from '../../src/game/sim/macmotor';
import { gucSkill } from '../../src/content/lig';
import { gucFarki } from '../../src/game/sim/mac-olcum';
import { izleMac } from '../../src/game/sim/halisaha';

function oynat(m: ReturnType<typeof createMatch>, fn?: (m: ReturnType<typeof createMatch>) => void) { for (let i = 0; i < 60 * 260 && !m.over; i++) { m.step(1 / 60); fn?.(m); } return m; }

describe('takım yapay zekâsı', () => {
  it('oyun planı: verilen plan kullanılır, geçersiz/eksikse seed\'li seçilir, eğilimler seed\'li', () => {
    expect(createMatch({ seed: 3, plan: ['kanat', 'uzun'] }).plan).toEqual(['kanat', 'uzun']);
    const a = createMatch({ seed: 9, plan: ['yok', 'kisa'] }), b = createMatch({ seed: 9, plan: ['yok', 'kisa'] });
    expect(PLANLAR).toContain(a.plan[0]); expect(a.plan[1]).toBe('kisa'); expect(a.plan).toEqual(b.plan);
    expect(a.pls.map(p => p.egilim)).toEqual(b.pls.map(p => p.egilim));
    expect(new Set(Array.from({ length: 12 }, (_, s) => createMatch({ seed: s + 1 }).pls.map(p => p.egilim).join()).values()).size).toBeGreaterThan(8);
  });
  it('rol akışkanlığı: rakip yarı sahada hücumda neredeyse her an topun gerisinde bir emniyet oyuncusu var', () => {
    let atk = 0, ok = 0;
    oynat(createMatch({ seed: 21, formations: ['2-2', '1-2-1'] }), m => {
      if (m.freeze > 0 || m.restart || m.ball.owner < 0) return; const h = m.pls[m.ball.owner]; if (h.gk || (h.team === 0 ? h.x : L - h.x) < L / 2) return; atk++;
      const dir = h.team === 0 ? 1 : -1; if (m.pls.some(p => p.team === h.team && !p.gk && p !== h && (h.x - p.x) * dir > 3)) ok++;
    });
    expect(ok / atk).toBeGreaterThan(0.9);
  });
  it('kanat planı hücumda kısa pas planından daha geniş oynar', () => {
    const gen = (plan: string) => { let s = 0, n = 0; for (const seed of [5, 6, 7]) oynat(createMatch({ seed, plan: [plan, 'kisa'] }), m => { if (m.ball.owner >= 0 && m.pls[m.ball.owner].team === 0 && m.freeze <= 0) for (const p of m.pls) if (p.team === 0 && !p.gk && m.pls.indexOf(p) !== m.ball.owner) { s += Math.abs(p.y - WD / 2); n++; } }); return s / n; };
    expect(gen('kanat')).toBeGreaterThan(gen('kisa') + 0.3);
  });
  it('güç farkı gerçek: güçlü (0.7) zayıfı (0.5) çoğunlukla yener, zayıf ara sıra kazanır', () => {
    const r = gucFarki(0.7, 0.5, 80, 31, 60); console.log('güç', r);
    expect(r.galibiyet).toBeGreaterThan(0.55); expect(r.yenilgi).toBeGreaterThan(0.05); expect(r.yenilgi).toBeLessThan(0.35);
  });
  it('m.heat 0..1, gol anında 1', () => {
    let goal = false, lo = 1, hi = 0;
    oynat(createMatch({ seed: 44 }), m => { lo = Math.min(lo, m.heat); hi = Math.max(hi, m.heat); if (m.events.some(e => e.k === 'goal')) { goal = true; expect(m.heat).toBe(1); } });
    expect(goal).toBe(true); expect(lo).toBeGreaterThanOrEqual(0); expect(hi).toBeLessThanOrEqual(1); expect(lo).toBeLessThan(0.4);
  });
  it('savunma tavrı: macAyari adları (pres/dengeli/kontra) motorda karşılık bulur, hücum biçimiyle birleşebilir', () => {
    const a = createMatch({ seed: 4, plan: ['pres', 'kanat-kontra'] });
    expect(a.tavir).toEqual(['pres', 'kontra']); expect(a.plan[1]).toBe('kanat'); expect(PLANLAR).toContain(a.plan[0]);
    expect(createMatch({ seed: 4 }).tavir).toEqual(['dengeli', 'dengeli']);
  });
  it('pres takımı savunma çizgisini kontra takımından belirgin önde kurar', () => {
    const blok = (tv: string) => { let s = 0, n = 0; for (const seed of [8, 9, 10]) oynat(createMatch({ seed, plan: [tv, 'dengeli'] }), m => {
      if (m.freeze > 0 || m.restart || m.ball.owner < 0 || m.pls[m.ball.owner].team !== 1) return;
      const xs = m.pls.filter(p => p.team === 0 && !p.gk).map(p => p.x).sort((a, b) => a - b); s += (xs[0] + xs[1]) / 2; n++; }); return s / n; };   // en geri iki oyuncu = savunma çizgisi
    const pres = blok('pres'), kontra = blok('kontra'); console.log('blok x', pres.toFixed(2), kontra.toFixed(2));
    expect(pres).toBeGreaterThan(kontra + 2);
  });
  it('zorluk eğrisi: lig gücü 66 olan takım 40 olanı çoğunlukla yener, 40 ara sıra kazanır', () => {
    const r = gucFarki(gucSkill(66), gucSkill(40), 80, 77, 60); console.log('guc 66-40', r);
    expect(r.galibiyet).toBeGreaterThan(0.55); expect(r.yenilgi).toBeGreaterThan(0.04); expect(r.yenilgi).toBeLessThan(0.35);
  });
  it('bahis izleMac deterministik (aynı seed = aynı sonuç ve skor)', () => {
    for (const s of [11, 12345, 999]) expect(izleMac(s)).toEqual(izleMac(s));
  });
});
void L;
