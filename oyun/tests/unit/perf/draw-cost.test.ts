import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { drawCostTable } from '../../../src/engine/perf/draw-cost';

const cam = () => { const c = new T.PerspectiveCamera(60, 1, 0.1, 1000); c.position.set(0, 0, 10); c.lookAt(0, 0, 0); c.updateMatrixWorld(); return c; };

describe('drawCostTable (PRF-06)', () => {
  it('iki grup, üç materyal, gölge ve şeffaf sayımı', () => {
    const s = new T.Scene();
    const a = new T.Group(); a.name = 'a'; s.add(a);
    const g = new T.BoxGeometry(1, 1, 1);
    const m1 = new T.MeshLambertMaterial({ color: '#ff0000' }), m2 = new T.MeshLambertMaterial({ color: '#00ff00', transparent: true, opacity: 0.5 });
    const meshes = [new T.Mesh(g, m1), new T.Mesh(g, m1), new T.Mesh(g, m2), new T.Mesh(g, m1)];
    meshes[0].castShadow = true;
    meshes.forEach((m, i) => { m.position.x = i - 1.5; a.add(m); });
    const b = new T.Group(); b.name = 'b'; s.add(b);
    const im = new T.InstancedMesh(g, m1, 7); b.add(im);
    s.updateMatrixWorld(true);
    const sun = new T.OrthographicCamera(-20, 20, 20, -20, 0.1, 100); sun.position.set(0, 30, 0); sun.lookAt(0, 0, 0);
    const r = drawCostTable(s, cam(), sun);
    const A = r.satirlar.find(x => x.grup === 'a')!, B = r.satirlar.find(x => x.grup === 'b')!;
    expect(A.gorunurMesh).toBe(4); expect(A.benzersizMateryal).toBe(2); expect(A.golgeMesh).toBe(1); expect(A.golgeCagri).toBe(1); expect(A.seffafMesh).toBe(1);
    expect(A.tahminiCagri).toBe(5);
    expect(B.instanceToplam).toBe(7); expect(B.ucgen).toBe(7 * 12);
    expect(r.toplam.gorunurMesh).toBe(5);
  });
  it('aynı görünüşlü ayrı materyal tekrar sayılır', () => {
    const s = new T.Scene(); const g = new T.BoxGeometry();
    s.add(new T.Mesh(g, new T.MeshLambertMaterial({ color: '#123456' })), new T.Mesh(g, new T.MeshLambertMaterial({ color: '#123456' })));
    s.updateMatrixWorld(true);
    expect(drawCostTable(s, cam()).toplam.tekrarMateryal).toBe(1);
  });
  it('frustum dışı sayılmaz, bölge kökleri bir alt seviyeye bölünür', () => {
    const s = new T.Scene(); const z = new T.Group(); z.name = 'zone:x'; s.add(z);
    const near = new T.Group(); near.name = 'yakin'; z.add(near); near.add(new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial()));
    const far = new T.Group(); far.name = 'uzak'; z.add(far); const fm = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial()); fm.position.z = 500; far.add(fm);
    s.updateMatrixWorld(true);
    const r = drawCostTable(s, cam());
    expect(r.satirlar.find(x => x.grup === 'zone:x/yakin')!.tahminiCagri).toBe(1);
    expect(r.satirlar.find(x => x.grup === 'zone:x/uzak')!.tahminiCagri).toBe(0);
  });
});
