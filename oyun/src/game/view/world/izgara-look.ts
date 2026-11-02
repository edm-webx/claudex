/**
 * Hayalet koordinat ızgarası (content/izgara.ts): tek bir yarı saydam zemin düzlemi, çizgiler ve her karenin adı
 * (A1, A2...) tek canvas dokusuna çizilir. Çarpışma ve yol bulmaya karışmaz. Aç/kapa: ekrandaki "Izgara" düğmesi,
 * klavyede G, window.__marti.izgara(true|false). Varsayılan kapalı; sadece yönetici panelinden açılır.
 */
import * as T from 'three';
import { IZGARA, IZGARA_COLS, IZGARA_ROWS, colLetter, cellOf } from '../../../content/izgara';

export interface IzgaraLookView { set(on: boolean): void; get(): boolean; where(x: number, z: number): string | null; dispose(): void }
export interface IzgaraLookDeps { scene: T.Object3D; host: HTMLElement; hero?: () => { x: number; z: number } }

const PX = 40;   // dokuda metre başına piksel

export function createIzgaraLook(d: IzgaraLookDeps): IzgaraLookView {
  const W = (IZGARA.x1 - IZGARA.x0), H = (IZGARA.z1 - IZGARA.z0);
  const c = document.createElement('canvas'); c.width = W * PX; c.height = H * PX;
  const g = c.getContext('2d')!;
  const cp = IZGARA.cell * PX;
  g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 0, c.width, c.height);
  for (let r = 0; r < IZGARA_ROWS; r++) for (let k = 0; k < IZGARA_COLS; k++) {
    if ((r + k) % 2) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(k * cp, r * cp, cp, cp); }
  }
  g.lineWidth = 2;
  // a dark under-stroke keeps the lines readable on both the pale deck and the dark sea
  const line = (x0: number, y0: number, x1: number, y1: number, major: boolean) => {
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineWidth = 6; g.strokeStyle = 'rgba(15,25,45,0.4)'; g.stroke();
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineWidth = 2; g.strokeStyle = major ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)'; g.stroke();
  };
  for (let k = 0; k <= IZGARA_COLS; k++) line(k * cp, 0, k * cp, c.height, k % 5 === 0);
  for (let r = 0; r <= IZGARA_ROWS; r++) line(0, r * cp, c.width, r * cp, r % 5 === 0);
  g.font = '800 17px system-ui, sans-serif'; g.textBaseline = 'top'; g.textAlign = 'left';
  for (let r = 0; r < IZGARA_ROWS; r++) for (let k = 0; k < IZGARA_COLS; k++) {
    const t = colLetter(k) + (r + 1);
    g.lineWidth = 4; g.strokeStyle = 'rgba(20,30,50,0.7)'; g.strokeText(t, k * cp + 5, r * cp + 4);
    g.fillStyle = '#ffffff'; g.fillText(t, k * cp + 5, r * cp + 4);
  }
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
  const mesh = new T.Mesh(new T.PlaneGeometry(W, H), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set((IZGARA.x0 + IZGARA.x1) / 2, 0.07, (IZGARA.z0 + IZGARA.z1) / 2);
  mesh.renderOrder = 2; mesh.name = 'izgara'; mesh.frustumCulled = false;
  d.scene.add(mesh);

  let on = false;   // 2026-10-25 user: grid is admin-only, off by default
  const apply = () => { mesh.visible = on; };
  const set = (v: boolean) => { on = !!v; apply(); };
  apply();
  return {
    set, get: () => on, where: cellOf,
    dispose() { d.scene.remove(mesh); tex.dispose(); mat.dispose(); mesh.geometry.dispose(); },
  };
}
