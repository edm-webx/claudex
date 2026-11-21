// PRF-15 doku akışı: yarım çözünürlükle başlar, yaklaşınca tama çıkar, uzaklaşınca/gizlenince iner, ana sahne dışı hep tam.
import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { akisKaydet, akisGuncelle, akisDurum } from '../../../src/engine/render/doku-akis';

function kur(scene: T.Object3D, x: number) {
  const obj = new T.Group(); obj.position.set(x, 0, 0); scene.add(obj);
  const olcekler: number[] = []; const atilan: T.Texture[] = []; let takili: T.Texture | null = null;
  const h = akisKaydet({ obj, dpm: 160, ciz: k => { olcekler.push(k); const t = new T.Texture(); t.userData.k = k; t.addEventListener('dispose', () => atilan.push(t)); return t; }, tak: t => { takili = t; } });
  return { obj, h, olcekler, atilan, takili: () => takili };
}

describe('doku akışı', () => {
  const cam = new T.PerspectiveCamera(35, 16 / 9, 0.1, 400);
  cam.position.set(0, 1.2, 0); cam.updateMatrixWorld();

  it('yarımla başlar, yakında tama çıkar, uzakta yarıma iner; kare başına tek çizim', () => {
    const scene = new T.Scene();
    const a = kur(scene, 30), b = kur(scene, 2);   // a uzak, b çok yakın
    scene.updateMatrixWorld(true);
    expect(a.h.tex.userData.k).toBe(0.5); expect(b.h.tex.userData.k).toBe(0.5);
    akisGuncelle(scene, cam, 900);
    expect(b.olcekler).toEqual([0.5, 1]); expect(b.takili()?.userData.k).toBe(1);
    expect(b.atilan.length).toBe(1);             // yarım doku değişince serbest
    expect(a.olcekler).toEqual([0.5]);           // uzaktaki dokunmadı
    b.obj.position.x = 40; scene.updateMatrixWorld(true);
    akisGuncelle(scene, cam, 900);
    expect(b.olcekler).toEqual([0.5, 1, 0.5]);
    a.h.birak(); b.h.birak();
  });

  it('gizli nesne yarıma iner, ayrı sahnedeki (kulis önizlemesi) hep tam', () => {
    const scene = new T.Scene(), baska = new T.Scene();
    const yakin = kur(scene, 1.5), onizleme = kur(baska, 50);
    scene.updateMatrixWorld(true); baska.updateMatrixWorld(true);
    akisGuncelle(scene, cam, 900); akisGuncelle(scene, cam, 900);
    expect(yakin.takili()?.userData.k).toBe(1); expect(onizleme.takili()?.userData.k).toBe(1);
    yakin.obj.visible = false;
    akisGuncelle(scene, cam, 900);
    expect(yakin.takili()?.userData.k).toBe(0.5);
    const once = akisDurum().kayit;
    yakin.h.birak(); onizleme.h.birak();
    expect(akisDurum().kayit).toBe(once - 2);
    expect(onizleme.atilan.length).toBe(2);      // bırakınca son doku da serbest
  });
});
