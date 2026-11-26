/**
 * DKN-02: layout of the renovation site (şantiye) in front of a far-shore business, shared by the view (scaffold, crane,
 * barriers) and the sim (where the two real ustalar walk). Pure maths: no three, no DOM.
 * Local frame: u runs along the facade, v runs out from the front wall; world = O + u*P + v*D.
 */
import { ARSALAR, arsaKapi } from './esya';

/** front-wall depth from the building centre (f) and facade width (w), from the karsi-bina.ts footprints */
const OLCU: Record<string, { f: number; w: number }> = { k1: { f: 3.5, w: 9.4 }, k2: { f: 3.5, w: 9.4 }, k3: { f: 1.8, w: 7.1 }, k4: { f: 3.75, w: 18.3 }, k6: { f: 1.85, w: 17.8 } };
/* Martı AVM shops (k5, k7..k17) sit inside the mall off the hall, upper floors too: no street-front site, the renovation runs on its timer */
export const USTA_SAYISI = 2;
export interface InsaatYer {
  id: string;
  /** facade-centre point on the ground */ ox: number; oz: number;
  /** outward direction */ dx: number; dz: number;
  /** view group yaw: local +z -> outward */ yaw: number;
  /** scaffold length along the facade */ S: number;
  /** local -> world */ w(u: number, v: number): { x: number; z: number };
  /** material pile and one work post per usta (facing the wall) */ pile: { u: number; v: number }; posts: { u: number; v: number }[];
}
const cache = new Map<string, InsaatYer>();
export function insaatYer(arsaId: string): InsaatYer | null {
  const hit = cache.get(arsaId); if (hit) return hit;
  const a = ARSALAR.find(x => x.id === arsaId), o = OLCU[arsaId]; if (!a || !a.sabit || !o) return null;
  const k = arsaKapi(a), l = Math.hypot(k.x - a.x, k.z - a.z) || 1, dx = (k.x - a.x) / l, dz = (k.z - a.z) / l, px = dz, pz = -dx;
  const ox = a.x + dx * o.f, oz = a.z + dz * o.f, S = o.w < 6 ? o.w - 0.4 : Math.max(5.5, Math.min(9, o.w - 0.8));   // a narrow AVM front keeps its scaffold on its own strip
  const y: InsaatYer = {
    id: arsaId, ox, oz, dx, dz, yaw: Math.atan2(dx, dz), S,
    w: (u, v) => ({ x: ox + px * u + dx * v, z: oz + pz * u + dz * v }),
    pile: { u: -(S / 2 + 1.7), v: 3.0 },
    posts: [{ u: -(S / 4 + 0.8), v: 3.2 }, { u: S / 4 + 0.8, v: 3.2 }],
  };
  cache.set(arsaId, y); return y;
}

/** 2026-11-26 user: "inşaat sürecinde olan her yerde çalışan makineler, araçlar, ustalar olmalı, büyüklüğüne göre projenin".
 *  Martı Evleri lots (plain ARSALAR, 6.2 x 4.6 fenced): the site lives inside the fence. Local frame = the plot group
 *  (u = plot local x, v = plot local z, +v towards the street door). Crew size follows the project:
 *  ev 2 ustalar, dükkân 4, büyütme 3 (4 from level 3 up). Same InsaatYer contract as the far-shore renovations. */
export type ArsaProje = 'ev' | 'dukkan' | 'yuk';
export const arsaUstaSayisi = (tur: ArsaProje, lv = 1) => (tur === 'ev' ? 2 : tur === 'dukkan' ? 4 : lv >= 3 ? 4 : 3);
export function arsaInsaatYer(arsaId: string, tur: ArsaProje, lv = 1): InsaatYer | null {
  const a = ARSALAR.find(x => x.id === arsaId); if (!a || a.sabit) return null;
  const dx = Math.sin(a.rotY), dz = Math.cos(a.rotY), px = Math.cos(a.rotY), pz = -Math.sin(a.rotY), ox = a.x, oz = a.z;
  const n = arsaUstaSayisi(tur, lv), POST = [{ u: -1.2, v: 1.55 }, { u: 1.2, v: 1.55 }, { u: 0, v: 1.6 }, { u: 2.5, v: 0.2 }];
  return {
    id: arsaId, ox, oz, dx, dz, yaw: a.rotY, S: 5.2,
    w: (u, v) => ({ x: ox + px * u + dx * v, z: oz + pz * u + dz * v }),
    pile: { u: -2.45, v: 1.75 }, posts: POST.slice(0, n),
  };
}
