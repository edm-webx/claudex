// Bahis oranları motorla tutarlı mı: her düz stratejinin (hep '1', hep 'X', hep '2') geri dönüşü 1'in altında kalmalı.
// Maç motoru değişip gerçek sıklıklar kayarsa burası kırılır: BAHIS_MODEL (sim/halisaha.ts) yeniden ölçülmeli (1500 tohumla ölçüm: 0,86 / 0,90 / 0,91).
import { it, expect } from 'vitest';
import { izleMac } from '../../src/game/sim/halisaha';

it('bahis oranları: düz stratejilerin geri dönüşü (RTP) < 1', () => {
  const N = 400, R = { '1': 0, X: 0, '2': 0 } as Record<'1' | 'X' | '2', number>;
  for (let s = 1; s <= N; s++) { const r = izleMac((s * 7919) | 1); R[r.sonuc] += r.oran[r.sonuc]; }
  const rtp = { '1': R['1'] / N, X: R.X / N, '2': R['2'] / N }; console.log('bahis RTP', JSON.stringify(rtp));
  for (const k of ['1', 'X', '2'] as const) expect(rtp[k]).toBeLessThan(1);
}, 120_000);
