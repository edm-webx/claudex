// PRF-14: kararlı ölçüm yardımcıları (yalnız test tarafı; sim'e performance.now sokulmaz).
// Fikir: sim deterministik (aynı tohum => her turda aynı tick'te aynı iş). Aynı senaryo R kez koşulur, tick i'nin süresi
// turlar arası EN KÜÇÜK değerle alınır. İşletim sistemi/GC/CPU yarışması rastgele tick'lere düşer, bir turda sıçrar, diğerlerinde
// sıçramaz: en küçük değer onu siler. Gerçek sıçrama (algoritmik iş, örn. o tick'te patlayan A*) HER turda aynı tick'te vardır:
// en küçük değer onu korur. Bütçe gevşetilmez; yalnız gürültü ayıklanır.
export function sakin(turlar: number[][]): number[] {
  const n = Math.min(...turlar.map(t => t.length));
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) { let m = Infinity; for (const t of turlar) if (t[i] < m) m = t[i]; out[i] = m; }
  return out;
}
export const yuzdelik = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
export const medyan = (a: number[]) => yuzdelik(a, 0.5);
