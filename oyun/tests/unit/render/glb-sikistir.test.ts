// PRF-11: tools/glb-sikistir.mjs (GLB nicemleme) doğru ve tekrarlanabilir; repodaki tüm GLB'ler işlenmiş.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

type Sikistir = (b: Buffer) => Buffer | null;
const yukle = async (): Promise<Sikistir> => (await import(new URL('../../../tools/glb-sikistir.mjs', import.meta.url).href)).sikistir;

function glb(json: object, bin: Buffer): Buffer {
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const h = Buffer.alloc(12); h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(28 + js.length + bin.length, 8);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(0x4e4f534a, 4);
  const c2 = Buffer.alloc(8); c2.writeUInt32LE(bin.length, 0); c2.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([h, c1, js, c2, bin]);
}
function oku(b: Buffer) { const jl = b.readUInt32LE(12); return { j: JSON.parse(b.subarray(20, 20 + jl).toString()), bin: b.subarray(28 + jl) }; }

describe('glb-sikistir', () => {
  it('teğeti atar, normali int8, uv\'yi uint16 nicemler; konum ve indeks aynen kalır; ikinci geçiş dokunmaz', async () => {
    const sikistir = await yukle();
    const pos = [0, 0, 0, 1, 0, 0, 0, 2, 0.5], nor = [0, 0, 1, 0.6, 0, 0.8, 0, 1, 0], uv = [0.1, 0.2, 0.9, 0.975, 0.5, 0.0625], tan = new Array(12).fill(0.5);
    const f = (a: number[]) => Buffer.from(new Float32Array(a).buffer);
    const idx = Buffer.alloc(8); [0, 1, 2].forEach((v, i) => idx.writeUInt16LE(v, i * 2));
    const parts = [f(pos), f(nor), f(uv), f(tan), idx]; let off = 0;
    const bvs = parts.map(p => { const bv = { buffer: 0, byteOffset: off, byteLength: p.length }; off += p.length; return bv; });
    const json = {
      asset: { version: '2.0' }, buffers: [{ byteLength: off }], bufferViews: bvs,
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 2, 0.5] },
        { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' }, { bufferView: 2, componentType: 5126, count: 3, type: 'VEC2' },
        { bufferView: 3, componentType: 5126, count: 3, type: 'VEC4' }, { bufferView: 4, componentType: 5123, count: 3, type: 'SCALAR' },
      ],
      materials: [{ name: 'colormap', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
      textures: [{ source: 0 }], images: [{ uri: 'Textures/colormap.png' }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2, TANGENT: 3 }, indices: 4, material: 0 }] }],
      nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
    };
    const once = glb(json, Buffer.concat(parts));
    const sonra = sikistir(once)!;
    expect(sonra).toBeTruthy();
    const { j, bin } = oku(sonra), p = j.meshes[0].primitives[0], A = j.accessors;
    expect(bin.length).toBeLessThan(oku(once).bin.length);   // ikili kısım küçülür (bu minik örnekte JSON büyür)
    expect(p.attributes.TANGENT).toBeUndefined();
    expect(j.extensionsRequired).toContain('KHR_mesh_quantization');
    const n = A[p.attributes.NORMAL], nbv = j.bufferViews[n.bufferView];
    expect([n.componentType, n.normalized, nbv.byteStride]).toEqual([5120, true, 4]);
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) expect(Math.abs(bin.readInt8(nbv.byteOffset + i * 4 + k) / 127 - nor[i * 3 + k])).toBeLessThan(0.01);
    const u = A[p.attributes.TEXCOORD_0], ubv = j.bufferViews[u.bufferView];
    expect([u.componentType, u.normalized]).toEqual([5123, true]);
    for (let i = 0; i < 6; i++) expect(Math.abs(bin.readUInt16LE(ubv.byteOffset + i * 2) / 65535 - uv[i])).toBeLessThan(1e-4);
    const ps = A[p.attributes.POSITION], pbv = j.bufferViews[ps.bufferView];
    expect(ps.componentType).toBe(5126); expect(ps.max).toEqual([1, 2, 0.5]);
    for (let i = 0; i < 9; i++) expect(bin.readFloatLE(pbv.byteOffset + i * 4)).toBeCloseTo(pos[i], 6);
    for (const bv of j.bufferViews) expect(bv.byteOffset % 4).toBe(0);
    expect(sikistir(sonra)).toBeNull();
  });

  it('public/modeller altındaki tüm GLB dosyaları işlenmiş (yeni model eklenince: node tools/glb-sikistir.mjs)', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const q = join(d, f); return statSync(q).isDirectory() ? walk(q) : q.endsWith('.glb') ? [q] : []; });
    const hepsi = walk('public/modeller');
    expect(hepsi.length).toBeGreaterThan(10);
    for (const f of hepsi) expect(oku(readFileSync(f)).j.extensionsUsed, f).toContain('KHR_mesh_quantization');
  });
});
