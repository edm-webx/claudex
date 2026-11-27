// PRF-09: "otobüsler hala değiyor" (2026-11-09). Otomatik kesişim raporu: her aracın her parçası (gerçek mesh, malzeme başına
// birleşik) kendi şeridi boyunca sürüklenir; sokaktaki hiçbir sabit üçgene (kaldırım taşı, refüj, üst geçit ayağı/güvertesi,
// durak) ve yan şeritteki araca değmemeli. Yol çizgisi boyası (asfalttan 9,5 cm) sayılmaz; tünel içi (|x| > 62) sayılmaz.
import { describe, it, expect, beforeAll } from 'vitest';
import * as T from 'three';
import { yolSahnesi, meshesOf, trianglesOf } from './yol-sahne';

type Sahne = Awaited<ReturnType<typeof yolSahnesi>>;
let S: Sahne;
beforeAll(async () => { S = await yolSahnesi(); }, 30000);

const STREET_Y = 0.35, PAINT = 0.098, REACH = 61.5;

/** One swept box per vehicle part: the part's world box stretched along the road (vehicles only move in x). */
function sweptParts(): { arac: string; box: T.Box3 }[] {
  const out: { arac: string; box: T.Box3 }[] = [];
  S.vehicles.children.forEach((v, i) => {
    v.position.x = 0; v.updateMatrixWorld(true);
    for (const m of meshesOf(v)) {
      const b = new T.Box3().setFromObject(m, true);
      b.min.x = -REACH; b.max.x = REACH;
      b.min.y = Math.max(b.min.y, STREET_Y + PAINT);
      if (b.max.y > b.min.y) out.push({ arac: `araç ${i} (z ${v.position.z.toFixed(2)})`, box: b });
    }
  });
  return out;
}

describe('yol araçları (PRF-09)', () => {
  it('hiçbir araç parçası sokaktaki sabit bir şeye değmiyor', () => {
    const statics = [S.road, S.stop, S.bridge, S.tunnel].flatMap(o => trianglesOf(o)).filter(t => Math.min(t.a.x, t.b.x, t.c.x) < REACH && Math.max(t.a.x, t.b.x, t.c.x) > -REACH);
    expect(statics.length).toBeGreaterThan(200);
    const parts = sweptParts();
    expect(parts.length).toBeGreaterThan(40);
    const rapor: string[] = [];
    for (const p of parts) {
      const shrunk = p.box.clone().expandByScalar(-0.005);
      for (const t of statics) if (shrunk.intersectsTriangle(t)) { rapor.push(`${p.arac} y ${p.box.min.y.toFixed(2)}..${p.box.max.y.toFixed(2)} ↔ üçgen (${t.a.x.toFixed(1)}, ${t.a.y.toFixed(2)}, ${t.a.z.toFixed(2)})`); break; }
    }
    expect(rapor).toEqual([]);
  });
  it('yan şeritteki araçlar birbirine değmiyor, her araç kendi şeridinde', () => {
    const lanes = new Map<string, T.Box3>();
    for (const v of S.vehicles.children) {
      v.position.x = 0; v.updateMatrixWorld(true);
      const b = new T.Box3().setFromObject(v, true), k = v.position.z.toFixed(2);
      lanes.set(k, (lanes.get(k) ?? b.clone()).union(b));
    }
    const list = [...lanes.entries()].sort((a, b) => +a[0] - +b[0]);
    expect(list.length).toBe(5);
    for (let i = 1; i < list.length; i++) expect(list[i][1].min.z, `şerit ${list[i - 1][0]} / ${list[i][0]}`).toBeGreaterThan(list[i - 1][1].max.z);
  });
  it('aynı şeritte araçlar üst üste binmiyor (2 dakika boyunca)', () => {
    const byLane = new Map<string, T.Object3D[]>();
    for (const v of S.vehicles.children) { const k = v.position.z.toFixed(2); byLane.set(k, [...(byLane.get(k) ?? []), v]); }
    let worst = Infinity;
    for (let t = 0; t < 120; t += 0.25) {
      S.look.update(0.25);
      for (const vs of byLane.values()) {
        const bx = vs.filter(v => Math.abs(v.position.x) < REACH).map(v => { v.updateMatrixWorld(true); return new T.Box3().setFromObject(v, true); });
        for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < bx.length; j++) worst = Math.min(worst, Math.max(bx[j].min.x - bx[i].max.x, bx[i].min.x - bx[j].max.x));
      }
    }
    expect(worst).toBeGreaterThan(1);
  });
});

// 2026-11-27: the 42B has its own lane next to the promenade (content/realm ISKELE_BUS_LANE); the real bus model is swept along it like the traffic above.
describe('42B şeridi (2026-11-27)', () => {
  it('otobüs şeridinde hiçbir sabit şeye değmiyor, kapıları yürüyüş yoluna bakıyor', async () => {
    const { createKit, buildBus } = await import('../../../src/game/view/atolye');
    const { ISKELE_BUS_LANE, busLaneAtStop, REALM_BY_ID } = await import('../../../src/content/realm');
    const bus = buildBus(createKit());
    bus.object.rotation.y = ISKELE_BUS_LANE.dir === 1 ? 0 : Math.PI;
    bus.object.position.set(0, ISKELE_BUS_LANE.y, ISKELE_BUS_LANE.z);
    bus.object.updateMatrixWorld(true);
    const parts = meshesOf(bus.object).map(m => new T.Box3().setFromObject(m, true));
    const all = new T.Box3(); parts.forEach(b => all.union(b));
    // body stays inside the lane: past the sidewalk kerb (15.125) and short of the separator (17.95 - 0.07) — mirrors (above 2 m) may overhang
    const low = parts.filter(b => b.min.y < STREET_Y + 1.6);
    expect(Math.min(...low.map(b => b.min.z))).toBeGreaterThan(15.125);
    expect(Math.max(...low.map(b => b.max.z))).toBeLessThan(17.88);
    // doors on the promenade (north, -z) side of the lane
    const doorZ = ISKELE_BUS_LANE.z - 1.25;
    expect(all.min.z).toBeLessThan(doorZ);
    expect(ISKELE_BUS_LANE.dir).toBe(-1);
    expect(ISKELE_BUS_LANE.doorZ).toBeLessThan(13.3);            // the boarding spot is on the walkable promenade (z <= 13.3)
    expect(busLaneAtStop(REALM_BY_ID.iskele.stop.x)).toBe(ISKELE_BUS_LANE);
    // swept along the whole street: nothing static (kerbs, paint above 9.8 cm, bridge pillars, stairs, tunnel) is touched
    const statics = [S.road, S.stop, S.bridge, S.tunnel].flatMap(o => trianglesOf(o)).filter(t => Math.min(t.a.x, t.b.x, t.c.x) < REACH && Math.max(t.a.x, t.b.x, t.c.x) > -REACH);
    const rapor: string[] = [];
    for (const b0 of parts) {
      const b = b0.clone(); b.min.x = -REACH; b.max.x = REACH; b.min.y = Math.max(b.min.y, STREET_Y + PAINT); b.expandByScalar(-0.005);
      if (b.max.y <= b.min.y) continue;
      for (const t of statics) if (b.intersectsTriangle(t)) { rapor.push(`y ${b.min.y.toFixed(2)}..${b.max.y.toFixed(2)} z ${b.min.z.toFixed(2)}..${b.max.z.toFixed(2)} ↔ (${t.a.x.toFixed(1)}, ${t.a.y.toFixed(2)}, ${t.a.z.toFixed(2)})`); break; }
    }
    expect(rapor).toEqual([]);
  });
  it('şeritte başka trafik yok (hiçbir araç 42B şeridinde değil)', () => {
    for (const v of S.vehicles.children) { const b = new T.Box3().setFromObject(v, true); expect(b.min.z, `araç z ${v.position.z}`).toBeGreaterThan(17.95); }
  });
});
