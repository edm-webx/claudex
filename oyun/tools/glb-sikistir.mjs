// PRF-11/PRF-15: GLB varlık sıkıştırma (offline, bağımlılık yok). node tools/glb-sikistir.mjs [--kuru] [klasör=public/modeller]
// Kayıpsız-görünür dönüşümler, tarayıcı tarafında çözücü gerektirmez (three GLTFLoader KHR_mesh_quantization'ı yerleşik okur,
// WebAssembly/Draco/meshopt yok):
//   - TANGENT atılır: hiçbir malzemede normalTexture yok, three bu özniteliği normal haritası olmadan kullanmaz.
//   - TEXCOORD_0 dokusuz malzemelerde atılır (Kenney ağaçlarında hepsi 0).
//   - NORMAL float32 -> int8 normalize (VEC3 + 1 bayt dolgu, adım 4): ~0.5 derece hata, alçak poligonlu düz gölgelemede görünmez.
//   - TEXCOORD_0 float32 -> uint16 normalize (yalnız tüm değerler 0..1 içindeyse): 1/65535 hata, renk paleti hücresi 1/16.
//   - POSITION ve indeksler aynen kalır (çarpışma/kutu hesapları ve mergeStatic float bekler).
// GPU'da da aynı oran kazanılır (öznitelikler sıkıştırılmış tipte yüklenir). Zaten işlenmiş dosya atlanır (eklenti işareti).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const KURU = process.argv.includes('--kuru');
const kok = process.argv.slice(2).find(a => !a.startsWith('--')) || 'public/modeller';
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.glb') ? [p] : []; });
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const CSIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const pad4 = n => (n + 3) & ~3;

export function sikistir(buf) {
  const jl = buf.readUInt32LE(12), j = JSON.parse(buf.subarray(20, 20 + jl).toString('utf8'));
  if ((j.extensionsUsed || []).includes('KHR_mesh_quantization')) return null;
  const bin = buf.subarray(20 + jl + 8, 20 + jl + 8 + buf.readUInt32LE(20 + jl));
  const acc = j.accessors, bvs = j.bufferViews;
  const okuFloat = a => {   // erişimciyi Float32Array olarak çıkarır (adımlı olabilir)
    const bv = bvs[a.bufferView], n = NCOMP[a.type], cs = CSIZE[a.componentType];
    if (a.componentType !== 5126) throw new Error('float bekleniyordu');
    const stride = bv.byteStride || n * cs, base = (bv.byteOffset || 0) + (a.byteOffset || 0), out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = bin.readFloatLE(base + i * stride + k * 4);
    return out;
  };
  const kopya = a => { const bv = bvs[a.bufferView], n = NCOMP[a.type], cs = CSIZE[a.componentType], es = n * cs, stride = bv.byteStride || es, base = (bv.byteOffset || 0) + (a.byteOffset || 0); const out = Buffer.alloc(a.count * es); for (let i = 0; i < a.count; i++) bin.copy(out, i * es, base + i * stride, base + i * stride + es); return out; };
  const texli = new Set(); (j.materials || []).forEach((m, i) => { const p = m.pbrMetallicRoughness || {}; if (p.baseColorTexture || m.emissiveTexture || m.normalTexture || p.metallicRoughnessTexture || m.occlusionTexture) texli.add(i); });
  // yeni ikili: her erişimci kendi bufferView'unu alır (4 bayt hizalı)
  const parcalar = [], yeniBv = [], yeniAcc = [], harita = new Map();
  let off = 0;
  const ekle = (data, target, stride) => { const i = yeniBv.length; const bv = { buffer: 0, byteOffset: off, byteLength: data.length }; if (target) bv.target = target; if (stride) bv.byteStride = stride; yeniBv.push(bv); parcalar.push(data); const p = pad4(data.length) - data.length; if (p) parcalar.push(Buffer.alloc(p)); off += pad4(data.length); return i; };
  const aynen = (ai, target) => { if (harita.has(ai)) return harita.get(ai); const a = acc[ai], n = NCOMP[a.type], cs = CSIZE[a.componentType]; const d = kopya(a); const es = n * cs; const bvi = ekle(d, target, target === 34962 && es % 4 === 0 && es > 0 ? undefined : target === 34962 ? pad4(es) : undefined); const na = { ...a, bufferView: bvi, byteOffset: 0 }; const k = yeniAcc.push(na) - 1; harita.set(ai, k); return k; };
  const normal = ai => { const key = 'n' + ai; if (harita.has(key)) return harita.get(key); const a = acc[ai], f = okuFloat(a), d = Buffer.alloc(a.count * 4); for (let i = 0; i < a.count; i++) { let x = f[i * 3], y = f[i * 3 + 1], z = f[i * 3 + 2]; const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l; d.writeInt8(Math.round(x * 127), i * 4); d.writeInt8(Math.round(y * 127), i * 4 + 1); d.writeInt8(Math.round(z * 127), i * 4 + 2); } const bvi = ekle(d, 34962, 4); const k = yeniAcc.push({ bufferView: bvi, byteOffset: 0, componentType: 5120, normalized: true, count: a.count, type: 'VEC3' }) - 1; harita.set(key, k); return k; };
  const uv = ai => { const key = 'u' + ai; if (harita.has(key)) return harita.get(key); const a = acc[ai], f = okuFloat(a); if (f.some(v => v < 0 || v > 1)) return aynen(ai, 34962); const d = Buffer.alloc(a.count * 4); for (let i = 0; i < f.length; i++) d.writeUInt16LE(Math.round(f[i] * 65535), i * 2); const bvi = ekle(d, 34962); const k = yeniAcc.push({ bufferView: bvi, byteOffset: 0, componentType: 5123, normalized: true, count: a.count, type: 'VEC2' }) - 1; harita.set(key, k); return k; };
  for (const m of j.meshes) for (const p of m.primitives) {
    const at = {}, dokulu = texli.has(p.material);
    for (const [ad, ai] of Object.entries(p.attributes)) {
      if (ad === 'TANGENT') continue;
      if (ad === 'TEXCOORD_0' && !dokulu) continue;
      at[ad] = ad === 'NORMAL' && acc[ai].componentType === 5126 ? normal(ai) : ad === 'TEXCOORD_0' && acc[ai].componentType === 5126 ? uv(ai) : aynen(ai, 34962);
    }
    p.attributes = at;
    if (p.indices != null) p.indices = aynen(p.indices, 34963);
    if (p.targets) throw new Error('morph hedefi desteklenmiyor');
  }
  // görüntüler ve skin/animasyon erişimcileri (varsa) taşınır
  (j.images || []).forEach(im => { if (im.bufferView != null) { const bv = bvs[im.bufferView]; im.bufferView = ekle(bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)); } });
  (j.skins || []).forEach(s => { if (s.inverseBindMatrices != null) s.inverseBindMatrices = aynen(s.inverseBindMatrices); });
  (j.animations || []).forEach(an => an.samplers.forEach(s => { s.input = aynen(s.input); s.output = aynen(s.output); }));
  j.accessors = yeniAcc; j.bufferViews = yeniBv; j.buffers = [{ byteLength: off }];
  j.extensionsUsed = [...new Set([...(j.extensionsUsed || []), 'KHR_mesh_quantization'])];
  j.extensionsRequired = [...new Set([...(j.extensionsRequired || []), 'KHR_mesh_quantization'])];
  let js = Buffer.from(JSON.stringify(j), 'utf8'); js = Buffer.concat([js, Buffer.alloc(pad4(js.length) - js.length, 0x20)]);
  const yb = Buffer.concat(parcalar);
  const h = Buffer.alloc(12); h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + js.length + 8 + yb.length, 8);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(0x4e4f534a, 4);
  const c2 = Buffer.alloc(8); c2.writeUInt32LE(yb.length, 0); c2.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([h, c1, js, c2, yb]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let once = 0, sonra = 0;
  for (const f of walk(kok)) {
    const b = readFileSync(f), y = sikistir(b);
    once += b.length; sonra += y ? y.length : b.length;
    console.log(`${f.padEnd(52)} ${(b.length / 1024).toFixed(0).padStart(5)} KB -> ${y ? (y.length / 1024).toFixed(0).padStart(5) + ' KB' : '(zaten işlenmiş)'}`);
    if (y && !KURU) writeFileSync(f, y);
  }
  console.log(`toplam ${(once / 1048576).toFixed(2)} MB -> ${(sonra / 1048576).toFixed(2)} MB${KURU ? ' (kuru çalışma, dosya yazılmadı)' : ''}`);
}
