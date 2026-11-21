/**
 * GRS-07: dünyada sabit duran sürekli efekt noktaları (fıskiye, semaver buharı, ışıkta toz). Tek parçacık sistemi (engine/fx, 1 çağrı)
 * kullanılır; nokta yalnızca kahraman menzildeyken çalışır (uzakta üretim yok), menzilden çıkınca akış durdurulur. Tier başına
 * sayı çarpanı ve toplam tavan fx'in kendisindedir (tier.particles). Yalnız görünüm; sim'e dokunmaz.
 */
import type { Fx, FxHandle, Vec3 } from '../../../engine/api';

export interface FxNokta {
  id: string;
  /** çalınacak efektler (hepsi aynı noktada, aynı akışta) */
  efekt: string[];
  /** sabit dünya noktası ya da çapa adı (+ dy) */
  at?: Vec3; anchor?: string; dy?: number;
  /** başlama menzili (m); durdurma menzili +4 m */
  menzil: number;
  olcek?: number;
  /** oyun saati aralığı [a, b) (24 üstü gece yarısından sonra); yoksa her saat */
  saat?: [number, number][];
  /** kahramanı izleyen nokta (toz zerresi) */
  kahraman?: boolean;
}

export const FX_NOKTALARI: readonly FxNokta[] = [
  { id: 'fiskiye', efekt: ['fiskiye', 'fiskiyeSis'], at: { x: -16.5, y: 1.0, z: 14.4 }, menzil: 34 },
  { id: 'semaver', efekt: ['semaverBuhar'], anchor: 'stations.cay.out', dy: 0.15, menzil: 22 },
  // alçak güneşte havada uçuşan toz: sabah ve akşamüstü, kahramanın çevresinde
  { id: 'toz', efekt: ['tozZerresi'], at: { x: 0, y: 1.4, z: 0 }, kahraman: true, menzil: 1e9, saat: [[7, 10.5], [16, 19.5]] },
];

export function saatIcinde(saat: [number, number][] | undefined, h: number): boolean {
  if (!saat) return true;
  const g = ((h % 24) + 24) % 24;
  return saat.some(([a, b]) => (g >= a && g < b) || (h >= a && h < b));
}
/** başlama/durdurma için histerezis: çalışıyorsa menzil+4'e kadar sürer */
export function menzildeMi(d2: number, menzil: number, calisiyor: boolean): boolean {
  const m = calisiyor ? menzil + 4 : menzil;
  return d2 <= m * m;
}

export interface FxNoktalarDeps {
  fx: Fx | null;
  heroPos: () => { x: number; z: number };
  anchors: () => Record<string, { pos: { x: number; z: number }; y?: number }>;
  hour: () => number;
}
export interface FxNoktalar { update(dt: number): void; active(): string[]; dispose(): void }

export function createFxNoktalar(d: FxNoktalarDeps, noktalar: readonly FxNokta[] = FX_NOKTALARI): FxNoktalar {
  const run = new Map<string, { h: FxHandle[]; at: Vec3 }>();
  let tCheck = 0;
  const stopAll = (id: string) => { const r = run.get(id); if (!r) return; for (const h of r.h) { try { h.stop(); } catch { /* */ } } run.delete(id); };
  const where = (n: FxNokta, hero: { x: number; z: number }): Vec3 | null => {
    if (n.kahraman) return { x: hero.x, y: n.at?.y ?? 1.4, z: hero.z };
    if (n.anchor) { const a = d.anchors()[n.anchor]; return a ? { x: a.pos.x, y: (a.y ?? 1) + (n.dy ?? 0), z: a.pos.z } : null; }
    return n.at ?? null;
  };
  return {
    update(dt) {
      const fx = d.fx; if (!fx) return;
      const hero = d.heroPos();
      // followers move every frame (one object write per effect, no allocation beyond the point)
      for (const n of noktalar) if (n.kahraman) { const r = run.get(n.id); if (r) { const p = where(n, hero); if (p) { r.at.x = p.x; r.at.y = p.y; r.at.z = p.z; for (const h of r.h) h.moveTo(p); } } }
      if ((tCheck -= dt) > 0) return;
      tCheck = 0.5;
      const hr = d.hour();
      for (const n of noktalar) {
        const r = run.get(n.id), p = where(n, hero);
        const want = !!p && saatIcinde(n.saat, hr) && menzildeMi((p.x - hero.x) ** 2 + (p.z - hero.z) ** 2, n.menzil, !!r);
        if (r && (!want || r.h.some(h => !h.alive))) { stopAll(n.id); if (!want) continue; }
        if (want && p && !run.has(n.id)) {
          const at = { x: p.x, y: p.y, z: p.z };
          const hs: FxHandle[] = [];
          for (const e of n.efekt) { try { if (fx.has(e)) hs.push(fx.play(e, at, n.olcek ? { scale: n.olcek } : undefined)); } catch { /* */ } }
          if (hs.length) run.set(n.id, { h: hs, at });
        }
      }
    },
    active: () => [...run.keys()],
    dispose() { for (const id of [...run.keys()]) stopAll(id); },
  };
}
