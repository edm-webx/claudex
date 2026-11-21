/**
 * Aşama açılış anı (BUF-30): tadilat bitince 3.6 sn'lik atlanabilir kamera gezintisi (oyuncudan yeni bölüme, orada kurdele kesilir,
 * yeni bölümün ışığı yanar, oyuncuya dönüş), kurdele kesme nesnesi + konfeti, yeni çalışanlar ve menü satırları kısa dünya içi
 * etiketlerle (popup yok). Pure view: sim'e yazmaz; kamera mevcut camera rig follow hedefiyle sürülür (boot.ts: acilis.kamera()).
 * Tetik: sim'in 'tadilatDone' olayı (boot.ts baslat(stage) çağırır; admin setStage tetiklemez). Veri content/insaat.ts acilisBilgi'den. Joystick hareketi ya da ekrana dokunuş gezintiyi atlar (etiketler kısa süre kalır).
 */
import * as T from 'three';
import { acilisBilgi, type AcilisBilgi } from '../../../content/insaat';
import { radialTex, ensureKit } from '../../../content/prefabs/common/v2kit';

export interface AcilisDeps {
  root: () => T.Object3D | null; hero: () => { x: number; z: number };
  /** mevcut yumuşak sesler (audio.sfx id) */ ses?: (id: string) => void;
}
export interface AcilisView { update(dt: number): void; kamera(): { x: number; z: number } | null; atla(): void; aktif(): boolean; baslat(to: number): void; dispose(): void }

const SURE = 3.6, KES = 1.5, OMUR = 8.5;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function etiket(lines: { t: string; c: string; s: number }[]): T.Sprite {
  const w = 640, lh = 64, h = lines.length * lh + 30, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d')!;
  g.fillStyle = 'rgba(20,25,42,0.82)'; const r = 26; g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.fill();
  g.strokeStyle = '#e8c76a'; g.lineWidth = 5; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => { g.fillStyle = l.c; g.font = `900 ${l.s}px system-ui,"Segoe UI",sans-serif`; const m = g.measureText(l.t).width; g.save(); g.translate(w / 2, 15 + lh * (i + 0.5)); if (m > w - 40) g.scale((w - 40) / m, 1); g.fillText(l.t, 0, 0); g.restore(); });
  const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
  const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, transparent: true, depthTest: false, depthWrite: false })); sp.renderOrder = 20;
  const sc = 4.2; sp.scale.set(sc, sc * h / w, 1); return sp;
}

function kurdele(at: { x: number; z: number }): { g: T.Group; sol: T.Object3D; sag: T.Object3D; fiyonk: T.Object3D } {
  const g = new T.Group(); g.position.set(at.x, 0, at.z); g.name = 'kurdele';
  const L = (c: string) => new T.MeshLambertMaterial({ color: c });
  for (const s of [-1, 1]) {   // gold stanchions
    const p = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 1.45, 8), L('#c9a24a')); p.position.set(s * 1.6, 0.73, 0); g.add(p);
    const top = new T.Mesh(new T.SphereGeometry(0.09, 10, 8), L('#e8c76a')); top.position.set(s * 1.6, 1.48, 0); g.add(top);
    const base = new T.Mesh(new T.CylinderGeometry(0.2, 0.22, 0.05, 12), L('#c9a24a')); base.position.set(s * 1.6, 0.03, 0); g.add(base);
  }
  const half = (s: number) => { const piv = new T.Group(); piv.position.set(s * 1.6, 1.3, 0); const m = new T.Mesh(new T.BoxGeometry(1.6, 0.2, 0.03), L('#d22b35')); m.position.x = -s * 0.8; piv.add(m); g.add(piv); return piv; };
  const sol = half(-1), sag = half(1);
  const fiyonk = new T.Group(); fiyonk.position.set(0, 1.3, 0.03);
  for (const s of [-1, 1]) { const l = new T.Mesh(new T.SphereGeometry(0.16, 10, 8), L('#e0333f')); l.scale.set(1.2, 0.7, 0.3); l.position.x = s * 0.17; fiyonk.add(l); }
  fiyonk.add(new T.Mesh(new T.SphereGeometry(0.07, 8, 6), L('#a81f29'))); g.add(fiyonk);
  return { g, sol, sag, fiyonk };
}

export function createAcilis(d: AcilisDeps): AcilisView {
  let t = -1, bilgi: AcilisBilgi | null = null, atlandi = false, kesildi = false, from = { x: 0, z: 0 };
  let grp: T.Group | null = null, kd: ReturnType<typeof kurdele> | null = null, isik: T.Mesh | null = null, lab: T.Sprite[] = [];
  let konfeti: T.Points | null = null; const kv: number[] = [];
  const onTap = () => { if (t >= 0 && t < SURE) atla(); };
  const temizle = () => {
    if (!grp) return; grp.removeFromParent();
    grp.traverse(o => { const m = o as T.Mesh; m.geometry?.dispose(); const mt = m.material as T.Material & { map?: T.Texture | null }; if (mt) { if (mt.map && mt.map !== radialTex) mt.map.dispose(); mt.dispose(); } });
    grp = null; kd = null; isik = null; lab = []; konfeti = null; kv.length = 0;
    try { window.removeEventListener('pointerdown', onTap); } catch { /* */ }
  };
  function baslat(to: number): void {
    temizle(); const root = d.root(); if (!root || to < 2) return;
    ensureKit(); bilgi = acilisBilgi(to); t = 0; atlandi = false; kesildi = false; from = { ...d.hero() };
    grp = new T.Group(); grp.name = 'acilis'; root.add(grp);
    kd = kurdele(bilgi.kurdele); grp.add(kd.g);
    // the new part's light comes on: a warm additive pool over the new area (+ a ring of bulbs)
    isik = new T.Mesh(new T.PlaneGeometry(9, 9), new T.MeshBasicMaterial({ map: radialTex, color: '#ffd890', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
    isik.rotation.x = -Math.PI / 2; isik.position.set(bilgi.odak.x, 0.16, bilgi.odak.z); grp.add(isik);
    const ad = etiket([{ t: 'YENİ: ' + bilgi.ad.toLocaleUpperCase('tr-TR'), c: '#e8c76a', s: 46 }, ...(bilgi.yeniRol.length ? [{ t: 'Yeni ekip: ' + bilgi.yeniRol.join(' · '), c: '#fbfaf6', s: 34 }] : []), ...(bilgi.yeniMenu.length ? [{ t: 'Menüde: ' + bilgi.yeniMenu.slice(0, 3).join(', '), c: '#bfe9c9', s: 34 }] : [])]);
    ad.position.set(bilgi.kurdele.x, 2.6, bilgi.kurdele.z + 1.2); ad.visible = false; grp.add(ad); lab.push(ad);
    try { window.addEventListener('pointerdown', onTap); } catch { /* */ }
  }
  function atla(): void { if (t < 0 || atlandi) return; atlandi = true; if (t < KES) t = KES; }
  function kes(): void {
    if (kesildi || !grp || !bilgi) return; kesildi = true; d.ses?.('buy');
    const n = 90, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), P = ['#e0533c', '#ffd23f', '#2f7fb3', '#7ed957', '#f2a2b3', '#e8c76a'];
    for (let i = 0; i < n; i++) { pos.set([bilgi.kurdele.x, 1.4, bilgi.kurdele.z], i * 3); const c = new T.Color(P[i % P.length]); col.set([c.r, c.g, c.b], i * 3); const a = i * 2.39996, sp = 1.4 + (i % 7) * 0.35; kv.push(Math.cos(a) * sp, 3.2 + (i % 5) * 0.6, Math.sin(a) * sp); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
    konfeti = new T.Points(geo, new T.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, depthWrite: false })); grp.add(konfeti);
  }
  return {
    baslat, atla,
    aktif: () => t >= 0 && t < SURE && !atlandi,
    kamera() {
      if (t < 0 || t >= SURE || !bilgi) return null;
      if (atlandi) return null;
      const h = d.hero(), o = bilgi.odak, k = t < 1.2 ? ease(t / 1.2) : t < 2.6 ? 1 : 1 - ease((t - 2.6) / 1.0), b = t < 1.2 ? from : h;
      return { x: b.x + (o.x - b.x) * k, z: b.z + (o.z - b.z) * k };
    },
    update(dt) {
      if (t < 0) return;
      t += dt;
      if (!grp) { t = -1; return; }
      if (t >= KES) kes();
      if (kd) {
        const k = kesildi ? Math.min(1, (t - KES) / 0.6) : 0;
        kd.sol.rotation.z = -k * 1.35; kd.sag.rotation.z = k * 1.35; kd.fiyonk.position.y = 1.3 - k * 1.2; kd.fiyonk.rotation.z = k * 2;
      }
      if (isik) (isik.material as T.MeshBasicMaterial).opacity = Math.min(0.85, Math.max(0, (t - KES + 0.2) / 1.0)) * (t > OMUR - 1.5 ? Math.max(0, (OMUR - t) / 1.5) : 1);
      for (const l of lab) { l.visible = t >= KES + 0.2; const a = Math.min(1, (t - KES - 0.2) / 0.5) * (t > OMUR - 1 ? Math.max(0, OMUR - t) : 1); (l.material as T.SpriteMaterial).opacity = a; l.position.y = 2.4 + Math.min(1, (t - KES) / 1.5) * 0.5; }
      if (konfeti) {
        const p = konfeti.geometry.attributes.position as T.BufferAttribute;
        for (let i = 0; i < p.count; i++) { kv[i * 3 + 1] -= 6 * dt; const y = p.getY(i) + kv[i * 3 + 1] * dt; p.setXYZ(i, p.getX(i) + kv[i * 3] * dt * 0.9, Math.max(0.15, y), p.getZ(i) + kv[i * 3 + 2] * dt * 0.9); if (y <= 0.15) { kv[i * 3] *= 0.6; kv[i * 3 + 2] *= 0.6; } }
        p.needsUpdate = true;
      }
      if (t >= OMUR) { temizle(); t = -1; }
    },
    dispose() { temizle(); },
  };
}
