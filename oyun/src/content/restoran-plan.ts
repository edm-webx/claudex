/**
 * Ters U restoran planı (2026-11-25, sahibi: "tek dev bir restoran, ayrı dükkânlar gibi olmayacak", kırmızı çizimle ters U; seçim: 1'in
 * görünüşü + 5'in U tezgâhı). Saf veri: three yok, DOM yok. Aşama 6+ : arkada mutfak bandı (ortada büfe holü), batı kanadı (aşama 6,
 * kahvaltı), doğu kanadı (aşama 7, balık). Tek zemin, iç duvar yok; avluya bakan kenarlar direkli açık revak. Vapur koridoru doğu
 * kanadın içinden açık geçittir. Aşama 1-5 büfe düzeni değişmez.
 */
export interface Dik { x0: number; x1: number; z0: number; z1: number }
export const KANAT_W: Dik = { x0: -23.2, x1: -10.05, z0: -17.4, z1: 4.2 };
export const KANAT_E: Dik = { x0: 8.0, x1: 21.8, z0: -17.4, z1: 4.2 };
export const kanatDik = (s: 'W' | 'E'): Dik => (s === 'W' ? KANAT_W : KANAT_E);
/** kanadın beşik çatılı arka kısmı ile düz (aşama 8: teras) ön kısmının sınırı */
export const TERAS_Z = -4.4;
/** kat yüksekliği ve teras döşemesi */
export const RES_H = 3.4, TERAS_Y = RES_H + 0.36;
/** vapur yolcusunun doğu kanadından geçtiği açık bant (z) */
export const VAPUR_GECIT: [number, number] = [-9.2, -4.8];
export const DUVAR_T = 0.25;
/** kanat ucundaki promenad kapısı (genişlik 2 m) */
export const kanatKapi = (s: 'W' | 'E'): number => { const k = kanatDik(s); return (k.x0 + k.x1) / 2; };
/** revak direkleri (avlu kenarı): iskele lambaları zaten z -10.6 / -4.2 / 2.2 ve -11.4 / -3.4 / 2.4 çizgisinde */
export const revakDirek = (s: 'W' | 'E'): number[] => (s === 'W' ? [-13.2, -7.4, -1.0, 4.05] : [-13.2, -9.3, -4.7, -0.5, 4.05]);
/** pass pencereleri (kanat başları): U tezgâhın köşeleri */
export const PASS_X = { W: -10.6, E: 8.9 } as const;
export const PASS_Z = -13.35;
/** kanat açık mı */
export const kanatAcikMi = (s: 'W' | 'E', stage: number): boolean => stage >= (s === 'W' ? 6 : 7);
/** U tezgâhın ön hattındaki dolgu tezgâhları (istasyonların arası; ortada personel girişi -1.9..1.0 açık) */
export const onDolgu = (stage: number): Dik[] => (stage < 6 ? [] : [{ x0: -9.7, x1: -6.35, z0: -13.75, z1: -13.1 }, ...(stage >= 7 ? [{ x0: 6.75, x1: 8.0, z0: -13.75, z1: -13.1 }] : [])]);
/** saksı köşeleri (katı, görünüm de buradan çizer): kanatların boş köşeleri ve avlu kapıları */
export const saksiYer = (s: 'W' | 'E', stage: number): [number, number][] => (s === 'W' ? [[-22.55, -13.6], [-22.55, -5.4], [-22.55, 3.4], ...(stage < 8 ? [[-10.7, 3.4] as [number, number]] : [])] : [[21.2, -13.6], [21.2, -10.2], ...(stage < 8 ? [[8.7, 3.4] as [number, number]] : [])]);
/** restoranın katı duvarları (dünya): arka, dış yan, kanat ucu; avlu kenarı yalnız direk */
export function restoranDuvar(stage: number): Dik[] {
  const o: Dik[] = [], t = DUVAR_T; if (stage < 6) return o;
  for (const s of ['W', 'E'] as const) {
    if (!kanatAcikMi(s, stage)) continue; const k = kanatDik(s), kx = kanatKapi(s);
    o.push({ x0: k.x0, x1: k.x1, z0: k.z0, z1: k.z0 + t });
    const yan = s === 'W' ? { x0: k.x0, x1: k.x0 + t } : { x0: k.x1 - t, x1: k.x1 };
    if (s === 'W') o.push({ ...yan, z0: k.z0, z1: k.z1 }); else o.push({ ...yan, z0: k.z0, z1: VAPUR_GECIT[0] }, { ...yan, z0: VAPUR_GECIT[1], z1: k.z1 });
    o.push({ x0: k.x0, x1: kx - 1, z0: k.z1 - t, z1: k.z1 }, { x0: kx + 1, x1: k.x1, z0: k.z1 - t, z1: k.z1 });
    for (const [x, z] of saksiYer(s, stage)) o.push({ x0: x - 0.28, x1: x + 0.28, z0: z - 0.28, z1: z + 0.28 });
    for (const z of revakDirek(s)) { const x = s === 'W' ? k.x1 : k.x0; o.push({ x0: x - 0.12, x1: x + 0.12, z0: z - 0.12, z1: z + 0.12 }); }
  }
  // orta bandın arkası; aşama 6'da doğu yanı henüz kapalı
  o.push({ x0: KANAT_W.x1, x1: 8.55, z0: -17.4, z1: -17.4 + t });
  if (stage < 7) o.push({ x0: 8.3, x1: 8.55, z0: -17.4, z1: -13.0 });
  o.push(...onDolgu(stage));
  return o;
}
/** oyuncu restoranın içinde / avlusunda mı: çatılar kalkar, aletler hep görünür (sahibi: "geliştirmeler hiçbir yerde görünmüyor") */
export const restoranAlani = (p: { x: number; z: number }): boolean => p.x > -24.2 && p.x < 22.9 && p.z > -18.2 && p.z < 5.2;
