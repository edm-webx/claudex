// PRF-11/PRF-15 varlık bütçesi (tools/perf-budget.json "bellek.varlik"): public/ altındaki dokular boyut kuralına uyar,
// GLB'ler nicemlenmiş ve toplam boyutlar tavanın altında. Yeni varlık eklenince bu test kuralı hatırlatır.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const B = JSON.parse(readFileSync('tools/perf-budget.json', 'utf8')).bellek.varlik as {
  dokuKenarMax: number; dokuHucre: number; dokuToplamMB: number; glbToplamMB: number; glbTekMB: number;
};
const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const dosyalar = walk('public');

/** PNG / JPEG piksel boyutu (başlıktan; çözme yok). */
function boyut(f: string): [number, number] {
  const b = readFileSync(f);
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.readUInt16BE(0) === 0xffd8) {
    for (let i = 2; i < b.length;) {
      const m = b.readUInt16BE(i), n = b.readUInt16BE(i + 2);
      if (m >= 0xffc0 && m <= 0xffcf && m !== 0xffc4 && m !== 0xffc8 && m !== 0xffcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + n;
    }
  }
  throw new Error('bilinmeyen resim: ' + f);
}
const ikiUstel = (n: number) => n > 0 && (n & (n - 1)) === 0;

describe('varlık bütçesi', () => {
  const resimler = dosyalar.filter(f => ['.png', '.jpg', '.jpeg'].includes(extname(f).toLowerCase()));

  it('her doku kenarı tavanın altında ve 2 üstel ya da atlas hücresinin (512) katı: mip zinciri temiz iner', () => {
    expect(resimler.length).toBeGreaterThan(3);
    for (const f of resimler) {
      const [w, h] = boyut(f);
      expect(Math.max(w, h), f).toBeLessThanOrEqual(B.dokuKenarMax);
      for (const k of [w, h]) expect(ikiUstel(k) || k % B.dokuHucre === 0, `${f} ${w}x${h}`).toBe(true);
    }
  });

  it('doku ve GLB toplamları tavanın altında, her GLB nicemlenmiş', () => {
    const MB = 1048576;
    const dokuT = resimler.reduce((a, f) => a + statSync(f).size, 0) / MB;
    expect(dokuT).toBeLessThanOrEqual(B.dokuToplamMB);
    const glb = dosyalar.filter(f => f.endsWith('.glb'));
    const glbT = glb.reduce((a, f) => a + statSync(f).size, 0) / MB;
    expect(glbT).toBeLessThanOrEqual(B.glbToplamMB);
    for (const f of glb) {
      expect(statSync(f).size / MB, f).toBeLessThanOrEqual(B.glbTekMB);
      const b = readFileSync(f), j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
      expect(j.extensionsUsed, f).toContain('KHR_mesh_quantization');
    }
  });
});
