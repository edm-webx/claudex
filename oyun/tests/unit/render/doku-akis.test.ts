// PRF-15 doku akışı: yarım çözünürlükle başlar, yaklaşınca tama çıkar, uzaklaşınca/gizlenince iner, ana sahne dışı hep tam.
import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { akisKaydet, akisGuncelle, akisDurum, hedefOlcek } from '../../../src/engine/render/doku-akis';

function kur(scene: T.Object3D, x: number) {
  const obj = new T.Group(); obj.position.set(x, 0, 0); scene.add(obj);
  const olcekler: number[] = []; const atilan: T.Texture[] = []; let takili: T.Texture | null = null;
  const h = akisKaydet({ obj, dpm: 160, ciz: k => { olcekler.push(k); const t = new T.Texture(); t.userData.k = k; t.addEventListener('dispose', () => atilan.push(t)); return t; }, tak: t => { takili = t; } });
  return { obj, h, olcekler, atilan, takili: () => takili };
}

describe('doku akışı', () => {
  const cam = new T.PerspectiveCamera(35, 16 / 9, 0.1, 400);
  cam.position.set(0, 1.2, 0); cam.lookAt(10, 1.2, 0); cam.updateMatrixWorld();   // +x yönüne bakar (nesneler kadrajda)

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
    expect(b.olcekler).toEqual([0.5, 1, 0.25]);   // 40 m: çeyrek yeter, tek adımda iner
    akisGuncelle(scene, cam, 900);
    expect(a.olcekler).toEqual([0.5, 0.25]);      // sıradaki: uzaktaki a
    a.h.birak(); b.h.birak();
  });

  it('gizli nesne yarıma iner, ayrı sahnedeki (kulis önizlemesi) hep tam', () => {
    const scene = new T.Scene(), baska = new T.Scene();
    const yakin = kur(scene, 1.5), onizleme = kur(baska, 50);
    scene.updateMatrixWorld(true); baska.updateMatrixWorld(true);
    akisGuncelle(scene, cam, 900); akisGuncelle(scene, cam, 900);
    expect(yakin.takili()?.userData.k).toBe(1); expect(onizleme.takili()?.userData.k).toBe(1);
    const arkada = kur(scene, -3); scene.updateMatrixWorld(true);   // kameranın arkasında, çok yakın: kadraj dışı tam çözünürlük tutmaz
    akisGuncelle(scene, cam, 900); expect(arkada.takili()).toBe(null); expect(arkada.olcekler).toEqual([0.5]); arkada.h.birak();
    const sokuk = new T.Group(), bekleyen = kur(sokuk, 1.5); sokuk.updateMatrixWorld(true);   // bölge önbelleğinde (sahneden sökülmüş) yakın işçi
    akisGuncelle(scene, cam, 900); akisGuncelle(scene, cam, 900); expect(bekleyen.olcekler).toEqual([0.5]); bekleyen.h.birak();
    yakin.obj.visible = false;
    akisGuncelle(scene, cam, 900);
    expect(yakin.takili()?.userData.k).toBe(0.5);
    const once = akisDurum().kayit;
    yakin.h.birak(); onizleme.h.birak();
    expect(akisDurum().kayit).toBe(once - 2);
    expect(onizleme.atilan.length).toBe(2);      // bırakınca son doku da serbest
  });

  it('ölçek merdiveni: yetmeyen basamaktan yetene çıkar, payı olan en küçüğe iner, sınırda gidip gelmez', () => {
    const dpm = 160;   // yarımda 160 doku/m: tam 320, çeyrek 80, sekizde bir 40
    expect(hedefOlcek(0.5, 400, dpm)).toBe(1);        // 400 > 160: yarım yetmez; tam (320) da yetmez ama en üst basamak
    expect(hedefOlcek(0.125, 70, dpm)).toBe(0.25);    // 70 > 40: çeyrek (80) yeter
    expect(hedefOlcek(0.125, 150, dpm)).toBe(0.5);    // birden çok basamak tek seferde
    expect(hedefOlcek(1, 20, dpm)).toBe(0.125);       // 20 < 40*0.7: en küçüğe iner
    expect(hedefOlcek(0.5, 60, dpm)).toBe(0.5);       // 60 > 80*0.7=56: çeyreğe inecek pay yok, yarımda kalır
    expect(hedefOlcek(0.5, 50, dpm)).toBe(0.25);      // 50 < 56: çeyreğe iner
    expect(hedefOlcek(0.25, 75, dpm)).toBe(0.25);     // 75 <= 80: çeyrek yeter, 75 > 40*0.7: inmez
    expect(hedefOlcek(0.25, 41, dpm)).toBe(0.25);     // 41: sekizde bire inmek için 28'in altı gerekir (gecikmeli eşik)
    expect(hedefOlcek(0.125, 41, dpm)).toBe(0.25);    // sekizde birde 41 > 40: çıkar
  });
});
