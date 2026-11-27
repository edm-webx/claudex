// BUF-21 / BUF-30: tek isim seti, tadilatta gerçek yürüyen ustalar (geçici aktör, kayda yazılmaz), inşaat sahası ve açılış bilgisi.
import { describe, it, expect } from 'vitest';
import { played } from './m1-helpers';
import { KIOSK_STAGES } from '../../src/content/stages';
import { BUYUME_AD } from '../../src/game/view/world/bufe-buyume';
import { SETLER, bufeBoyut } from '../../src/content/santiye';
import { SITE_AREA, USTA_NOKTA, ustaSayisi, acilisBilgi, kuleKonum, vincKonum, yiginKonum } from '../../src/content/insaat';
import { PIER } from '../../src/content/prefabs/iskele/layout';

describe('aşama adları (BUF-21)', () => {
  it('stages.ts ve büyüme adları aynı, eski kalıntı yok', () => {
    for (let s = 2; s <= 10; s++) expect(BUYUME_AD[s]).toBe(KIOSK_STAGES[s - 1].short);
    const all = KIOSK_STAGES.map(s => s.name + ' ' + s.short).join(' | ');
    for (const eski of ['Zincir şube', 'Deniz platformu', 'Aile lokantası', 'İskele terası', 'Boğaz restoranı']) expect(all).not.toContain(eski);
    expect(new Set(KIOSK_STAGES.map(s => s.short)).size).toBe(10);
  });
});

describe('inşaat sahası ve ustalar', () => {
  it('her tadilatın sahası ve usta noktaları iskelede', () => {
    for (let s = 2; s <= 10; s++) {
      const a = SITE_AREA[s]; expect(a, 's' + s).toBeTruthy(); expect(a.x0).toBeGreaterThan(PIER.x0); expect(a.x1).toBeLessThan(PIER.x1);
      expect(USTA_NOKTA[s].length).toBeGreaterThanOrEqual(ustaSayisi(s) - 1);
      for (const [x, z] of USTA_NOKTA[s]) { expect(x).toBeGreaterThan(PIER.x0); expect(x).toBeLessThan(PIER.x1); expect(z).toBeGreaterThan(PIER.z0); expect(z).toBeLessThan(PIER.z1); }
    }
  });
  it('usta noktaları birbirinden, iskele kulelerinden ve vinçten ayrı; yığın çizildiği yerde', () => {
    for (let s = 2; s <= 10; s++) {
      const P = USTA_NOKTA[s], set = SETLER[bufeBoyut(s)], T: { x: number; z: number }[] = [...kuleKonum(s)];
      if (set.kuleVinc || set.mobilVinc) T.push(vincKonum(s));
      P.forEach(([x, z], i) => {
        for (const t of T) expect(Math.hypot(t.x - x, t.z - z), `a${s} nokta${i} kule`).toBeGreaterThanOrEqual(1.3);
        P.forEach(([x2, z2], j) => { if (j > i) expect(Math.hypot(x - x2, z - z2), `a${s} nokta${i}-${j}`).toBeGreaterThanOrEqual(1.2); });
      });
      const y = yiginKonum(s); expect(Math.hypot(y.x - P[0][0], y.z - P[0][1]), `a${s} yığın`).toBeLessThan(1);
    }
  });
  it('tadilat sürerken ustalar gelip yürür ve çekiç sallar, bitince gider; çalışan listesine ve kayda girmez', () => {
    const sim = played(3) as any; for (let i = 0; i < 40; i++) sim.step(0.1);
    sim.command({ kind: 'setStage', stage: 5 }); sim.step(0.5);
    const isci0 = sim.state.workers.length;
    sim.state.stars = 5; sim.state.money = 50_000_000; sim.command({ kind: 'startTadilat' }); sim.step(0.2);
    expect(sim.state.tadilat?.to).toBe(6);
    const U = sim.rules.rt.agents.ustalar;
    const seen = new Set<string>(); let cekic = false, kalas = false, yol = 0; const last = new Map<string, { x: number; z: number }>();
    for (let i = 0; i < 900; i++) {
      sim.step(0.1);
      for (const r of U.rows()) { seen.add(r.key); if (r.fx === 'cekic' && r.act === 'cut') cekic = true; if (r.fx === 'kalas') kalas = true; const p = last.get(r.key); if (p) yol += Math.hypot(r.x - p.x, r.z - p.z); last.set(r.key, { x: r.x, z: r.z }); }
    }
    expect(seen.size).toBe(ustaSayisi(6)); expect(cekic).toBe(true); expect(kalas).toBe(true); expect(yol).toBeGreaterThan(20);
    expect(sim.state.workers.length).toBe(isci0);
    expect(JSON.stringify(sim.state)).not.toContain('usta-');
    sim.command({ kind: 'force', what: 'tadilatBitir' }); sim.step(0.2);
    expect(sim.state.stage).toBe(6);
    for (let i = 0; i < 500 && U.rows().length; i++) sim.step(0.1);
    expect(U.rows().length).toBe(0);
  });
});

describe('açılış anı bilgisi (BUF-30)', () => {
  it('her aşamanın adı, odağı, kurdelesi; mutfak aşamalarında yeni ekip, yemek aşamalarında yeni menü satırı', () => {
    for (let s = 2; s <= 10; s++) { const b = acilisBilgi(s); expect(b.ad).toBe(KIOSK_STAGES[s - 1].short); expect(b.kurdele.z).toBeLessThan(PIER.z1); }
    expect(acilisBilgi(3).yeniRol.some(r => r.startsWith('Aşçı'))).toBe(true);
    expect(acilisBilgi(3).yeniMenu.length).toBeGreaterThan(0);
  });
});
