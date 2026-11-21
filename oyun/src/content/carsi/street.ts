/**
 * Çarşı Sokağı (the street east of the pier, zone id 'test-sokak' kept for the streaming and zone tests).
 * Pure data: shopfront placements, the six neighbour esnaf (survey esnaf-1..10, mekan-2, zincir-1/2) and their lines.
 * Names come from the survey answers; every brand is invented. Visual parts are prefabs made in carsiPrefabs().
 */
import type { PrefabDef, PrefabPlacement, AnchorDef } from '../../engine/api';

export const STREET_ZONE = 'test-sokak';
export const OPEN_H = 7, CLOSE_H = 21;           // shops open 07:00 to 21:00 (esnaf walk home after)

export interface Front { id: string; name: string; kind: 'esnaf' | 'lokanta' | 'zincir' | 'filler'; side: 'n' | 's'; w: number; awning: string[]; wall: string }
// order along the street, per side; x is placed from X_START with GAP between fronts
export const X_START = 63.5, GAP = 0.8, FRONT_D = 4.5;
export const FRONTS: Front[] = [
  { id: 'firin', name: "Hüsnü'nün Fırını", kind: 'esnaf', side: 'n', w: 5.5, awning: ['#d9822b'], wall: '#f3e3c3' },
  { id: 'tencere', name: 'Tencere Yuvası', kind: 'lokanta', side: 'n', w: 5.5, awning: ['#7d5638'], wall: '#efe2c6' },
  { id: 'gevrek', name: 'Gevrek Express', kind: 'zincir', side: 'n', w: 5, awning: ['#e0533c'], wall: '#f6efe1' },
  { id: 'berber', name: 'Şevket Usta Berber', kind: 'esnaf', side: 'n', w: 5, awning: ['#b33a3a', '#f6efe1'], wall: '#e9e4da' },
  { id: 'kopuk', name: 'Köpük Kulesi', kind: 'zincir', side: 'n', w: 5, awning: ['#2e4a6b'], wall: '#eef1f3' },
  { id: 'bulut', name: 'Bulut Tabağı', kind: 'lokanta', side: 'n', w: 5.5, awning: ['#f3e3b6'], wall: '#f6efe1' },
  { id: 'balikci', name: "Kemal'in Balık Tezgahı", kind: 'esnaf', side: 'n', w: 6, awning: ['#2f6f9a', '#f6efe1'], wall: '#dfe8ec' },  // was fill-n1 (same width, esnaf-1)
  { id: 'fill-n2', name: '', kind: 'filler', side: 'n', w: 5, awning: [], wall: '#c9b9a0' },
  { id: 'manav', name: "Hayriye Abla'nın Manavı", kind: 'esnaf', side: 's', w: 5.5, awning: ['#5a9a4b'], wall: '#efe6cf' },
  { id: 'lufer', name: 'Lüfer Durağı', kind: 'lokanta', side: 's', w: 5.5, awning: ['#3fb5b0'], wall: '#f2ead8' },
  { id: 'kuruyemis', name: "Zeki'nin Kuruyemişi", kind: 'esnaf', side: 's', w: 5, awning: ['#7a4e2d'], wall: '#e8dcc4' },
  { id: 'tavuk', name: 'Tavuk Tekeli A.Ş.', kind: 'zincir', side: 's', w: 5, awning: ['#c94f6d'], wall: '#f3eee4' },
  { id: 'uzun', name: 'Uzun Kayık', kind: 'lokanta', side: 's', w: 5.5, awning: ['#5aa9d6'], wall: '#eee6d6' },
  { id: 'ucan', name: 'Uçan Paket', kind: 'zincir', side: 's', w: 5, awning: ['#8c5a9a'], wall: '#f1ece2' },
  { id: 'kozdede', name: 'Köz Dede', kind: 'lokanta', side: 's', w: 6, awning: ['#b04a3b'], wall: '#e6d9c1' },
  { id: 'bisiklet', name: 'Ayten Bisiklet ve Boya', kind: 'esnaf', side: 's', w: 5, awning: ['#e8b23a', '#3a8a6e'], wall: '#efe4cf' },  // was fill-s1 (same width, esnaf-1)
];

export interface Placed extends Front { cx: number; cz: number; rotY: number; frontZ: number }
/** Front centres: north fronts face the street from z 13.7, south fronts from z 4.45. */
export function placeFronts(): Placed[] {
  const out: Placed[] = [];
  let xn = X_START, xs = X_START;
  for (const f of FRONTS) {
    const n = f.side === 'n';
    const x = n ? xn : xs;
    const frontZ = n ? 13.7 : 4.45;
    const cz = n ? frontZ + FRONT_D / 2 : frontZ - FRONT_D / 2;
    out.push({ ...f, cx: x + f.w / 2, cz, rotY: n ? Math.PI : 0, frontZ });
    if (n) xn += f.w + GAP; else xs += f.w + GAP;
  }
  return out;
}

export interface Esnaf { id: string; name: string; role: string; type: string; seed: number; shop: string; openLines: string[]; closedLines: string[]; selam: string[] }
export const ESNAF: Esnaf[] = [
  { id: 'huesnu', name: 'Fırıncı Hüsnü', role: 'Fırıncı', type: 'simitci', seed: 11, shop: 'firin',
    openLines: ['Sıcacık simit, gel gel!', 'Fırın bugün çok kokuyor.', 'Çıtır çıtır, bir tane al.', 'Ekmek ortada, kapıda değil.'],
    closedLines: ['Fırın yattı, yarın sabah.'], selam: ['Selam kardeşim, simit yanında!', 'Bak, sana bir poğaça ayırdım.'] },
  { id: 'hayriye', name: 'Hayriye Abla', role: 'Manav', type: 'teyze', seed: 23, shop: 'manav',
    openLines: ['Domatesler bugün tatlı!', 'Karpuz geldi, sabırsız mısın?', 'Her şey tazecik evladım.'],
    closedLines: ['Hava kararınca kasa da kapanır.'], selam: ['Hoş geldin evladım, bir elma?', 'Gel bakalım, sana tezgahı gösterim.'] },
  { id: 'sevket', name: 'Şevket Usta', role: 'Berber', type: 'emekli', seed: 37, shop: 'berber',
    openLines: ['Sakal bugün mü, yarın mı?', 'Tıraş kolonyası ücretsiz, söylentiler de.', 'Mahallenin haber merkezi açık.'],
    closedLines: ['Ustanın molası uzadı.'], selam: ['Oturduğun yerden selam, çay da var!', 'Bu mahallede haber benden çıkar.'] },
  { id: 'zeki', name: 'Zeki', role: 'Kuruyemişçi', type: 'kestaneci', seed: 41, shop: 'kuruyemis',
    openLines: ['Kavrulmuş fındık taze!', 'Leblebi, çekirdek, sürpriz tohum.', 'Tartıda hep fazla veririm, gel.'],
    closedLines: ['Kuruyemiş de dinleniyor.'], selam: ['Selam, çekirdek çitlemeye ne dersin?', 'Bir avuç da bizden, hesap yok.'] },
  { id: 'kemal', name: 'Balıkçı Kemal', role: 'Balıkçı', type: 'oltaci', seed: 53, shop: 'balikci',
    openLines: ['Sabah ağdan çıktı, hâlâ göz kırpıyor!', 'Hamsi var, istavrit var, hikaye bedava.', 'Buzlar taze, balıklar tazeden taze.'],
    closedLines: ['Ağlar kurudu, Kemal de kurudu. Yarın.'], selam: ['Rast gele kardeşim!', 'Bugün martılar bile kıskandı balığımı.'] },
  { id: 'ayten', name: 'Bisikletçi Ayten', role: 'Bisikletçi', type: 'kurye', seed: 67, shop: 'bisiklet',
    openLines: ['Zincir mi attı? Getir, bağlarım.', 'Boya taze, dokunma, parmak izin kalır!', 'Bu tekerlek dünyanın en yuvarlağı.'],
    closedLines: ['Dükkan kapalı, tekerlekler uyuyor.'], selam: ['Selam komşu, zilini çaldım duydun mu?', 'Arabanı bir boyayalım, gıcır olsun!'] },
];

/** Shop name tags and esnaf stand points, in street (zone) coordinates. */
export function streetAnchors(placed: Placed[]): Record<string, AnchorDef> {
  const a: Record<string, AnchorDef> = {};
  for (const p of placed) if (p.kind !== 'filler') a['front.' + p.id] = { pos: { x: p.cx, z: p.cz }, kind: 'marker', tags: [p.name] };
  for (const e of ESNAF) {
    const p = placed.find(q => q.id === e.shop)!;
    const n = p.side === 'n';
    a['esnaf.' + e.id] = { pos: { x: p.cx, z: n ? p.frontZ - 0.7 : p.frontZ + 0.85 }, rotY: n ? 0 : Math.PI, kind: 'marker' };
  }
  return a;
}

/** Stall in front of each esnaf: a counter the player can't walk through. */
export function stallPlacements(placed: Placed[]): PrefabPlacement[] {
  return ESNAF.map(e => {
    const p = placed.find(q => q.id === e.shop)!;
    const n = p.side === 'n';
    return { id: 'stall-' + e.id, prefab: 'carsi.stall', pos: { x: p.cx, z: n ? p.frontZ - 1.6 : p.frontZ + 1.9 }, rotY: 0 };
  });
}

function front(id: string, w: number, d: number, h: number, wall: string, awning: string[], sign: string): PrefabDef {
  const parts: PrefabDef['parts'] = [
    { shape: 'box', size: [w, h, d], pos: [0, h / 2, 0], color: wall, name: 'wall' },
    { shape: 'box', size: [w + 0.3, 0.25, d + 0.3], pos: [0, h + 0.12, 0], color: '#8a7f70', name: 'roof' },
    { shape: 'box', size: [w - 0.4, 0.5, 0.1], pos: [0, h - 0.35, d / 2 + 0.05], color: sign, name: 'sign' },
    { shape: 'box', size: [1.0, 2.1, 0.06], pos: [w / 2 - 1.1, 1.05, d / 2 + 0.03], color: '#6b4a2e', name: 'door' },
    { shape: 'box', size: [1.1, 1.0, 0.06], pos: [-w / 4, h * 0.5, d / 2 + 0.03], color: '#9cc3d6', name: 'win0' },
  ];
  const aw = awning.length ? awning : [];
  aw.forEach((c, i) => {
    const sw = (w - 0.4) / aw.length;
    parts.push({ shape: 'box', size: [sw, 0.12, 1.1], pos: [-(w - 0.4) / 2 + sw / 2 + i * sw, 2.55, d / 2 + 0.5], color: c, name: 'awning' + i });
  });
  return { id, parts, colliders: [{ x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 }], anchors: { door: { pos: { x: w / 2 - 1.1, z: d / 2 + 0.6 }, kind: 'door' } } };
}

export function carsiPrefabs(): PrefabDef[] {
  const defs: PrefabDef[] = [];
  for (const f of FRONTS) {
    const sign = f.kind === 'esnaf' ? '#f0d35a' : f.kind === 'lokanta' ? '#e9a0b4' : f.kind === 'zincir' ? '#5aa9d6' : '#8a7f70';
    defs.push(front('carsi.front.' + f.id, f.w, FRONT_D, 4.2, f.wall, f.awning, sign));
  }
  defs.push({
    id: 'carsi.stall', parts: [
      { shape: 'box', size: [2.0, 0.95, 0.8], pos: [0, 0.475, 0], color: '#8a6a4a', name: 'counter' },
      { shape: 'box', size: [2.2, 0.08, 0.95], pos: [0, 0.99, 0], color: '#e9e4da', name: 'top' },
    ],
    colliders: [{ x0: -1.0, x1: 1.0, z0: -0.4, z1: 0.4 }],
  });
  return defs;
}
