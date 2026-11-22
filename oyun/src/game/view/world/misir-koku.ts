/**
 * Mısır kokusu (2026-11-22 22:55 sahip: "etraf mısır kokacak ki milletin canı çeksin"). Sinema Büfesi'nin mısır makinesinden
 * sıcak, sarımsı ince buhar kıvrımları yükselir, hola ve bekleme salonuna doğru süzülüp dağılır. Yalnız kahraman sinema katında
 * ve 22 m içindeyken, makine alınmışsa. Havuzlu sprite (en çok 28), tek doku, ışık eklemez; 30 Hz yeter.
 */
import * as T from 'three';
import { katY } from '../../../content/avm-kat';

export interface KokuDeps { root: () => T.Object3D | null; hero: () => { x: number; z: number; kat?: number }; kaynak: () => { x: number; z: number; kat: number } | null }
export interface KokuView { update(dt: number): void }

const N = 28, ESIK = 22;
interface Z { s: T.Sprite; t: number; omur: number; x: number; z: number; vx: number; vz: number; faz: number }

function doku(): T.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,240,200,0.9)'); gr.addColorStop(0.5, 'rgba(255,225,160,0.35)'); gr.addColorStop(1, 'rgba(255,220,150,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

export function createMisirKoku(d: KokuDeps): KokuView {
  let kok: T.Group | null = null, mat: T.SpriteMaterial | null = null, sayac = 0, birik = 0;
  const zs: Z[] = [];
  return {
    update(dt) {
      const sahne = d.root(); if (!sahne) return;
      const hp = d.hero(), k = d.kaynak();
      const on = !!k && (hp.kat || 0) === k.kat && Math.hypot(hp.x - k.x, hp.z - k.z) < ESIK;
      if (!on) { if (kok) kok.visible = false; return; }
      if (!kok) { kok = new T.Group(); kok.name = 'misirKoku'; mat = new T.SpriteMaterial({ map: doku(), transparent: true, depthWrite: false, opacity: 0.5 }); for (let i = 0; i < N; i++) { const s = new T.Sprite(mat.clone()); s.visible = false; kok.add(s); zs.push({ s, t: 1, omur: 0, x: 0, z: 0, vx: 0, vz: 0, faz: 0 }); } }
      if (kok.parent !== sahne) sahne.add(kok);
      kok.visible = true;
      birik += dt; if (birik < 1 / 30) return; const h = birik; birik = 0;
      const y0 = katY(k!.kat) + 0.14 + 1.75;
      sayac += h;
      if (sayac > 0.22) {   // yeni kıvrım
        sayac = 0; const z = zs.find(q => q.t >= q.omur);
        if (z) { const a = Math.random() * Math.PI * 2; z.t = 0; z.omur = 4 + Math.random() * 2.5; z.x = k!.x; z.z = k!.z; z.vx = -0.18 - Math.random() * 0.25 + Math.cos(a) * 0.08; z.vz = Math.sin(a) * 0.22; z.faz = Math.random() * 6; }
      }
      for (const z of zs) {
        if (z.t >= z.omur) { z.s.visible = false; continue; }
        z.t += h; const f = z.t / z.omur;
        z.x += z.vx * h; z.z += z.vz * h + Math.sin(z.t * 1.7 + z.faz) * 0.12 * h;
        z.s.position.set(z.x, y0 + f * 1.3 + Math.sin(z.t * 2.3 + z.faz) * 0.05, z.z);
        const sc = 0.25 + f * 0.9; z.s.scale.set(sc, sc, 1);
        (z.s.material as T.SpriteMaterial).opacity = 0.45 * Math.sin(Math.PI * Math.min(1, f * 1.1)); z.s.visible = true;
      }
    },
  };
}
