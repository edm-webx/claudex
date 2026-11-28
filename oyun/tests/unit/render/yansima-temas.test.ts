import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { reflectBudget, markReflected, createReflector, REFLECT_LAYER } from '../../../src/engine/render/reflect';
import { Batch, contactGeometry, CONTACT_MAX } from '../../../src/engine/prefab/batch';
import { aoFactor, groundAo } from '../../../src/engine/render/zemin-ao';
import { wetZemin, setZeminWet, zeminWet } from '../../../src/engine/render/zemin-islak';
import { setGlbEnv, useSkyEnv, setGlbEnvK } from '../../../src/game/view/world/glb';

describe('su yansıması bütçesi (GRS-05)', () => {
  it('akıcıda yansıma yok, dengeli çeyrek çözünürlük 2 karede bir, şahane yarım çözünürlük her karede', () => {
    expect(reflectBudget('akici')).toBeNull();
    expect(reflectBudget('dengeli')).toEqual({ scale: 0.25, every: 2 });
    expect(reflectBudget('sahane')).toEqual({ scale: 0.5, every: 1 });
  });
  it('yalnız işaretli nesneler yansıma katmanına girer, ana kamera yine hepsini görür', () => {
    const root = new T.Group(), a = new T.Mesh(), b = new T.Mesh(), other = new T.Mesh();
    root.add(a, b); a.add(new T.Object3D());
    expect(markReflected(root)).toBe(4);
    expect(a.layers.isEnabled(REFLECT_LAYER)).toBe(true); expect(a.layers.isEnabled(0)).toBe(true);
    expect(other.layers.isEnabled(REFLECT_LAYER)).toBe(false);
    expect(new T.PerspectiveCamera().layers.test(a.layers)).toBe(true);
  });
  it('akıcıda hedef hiç oluşmaz; bütçe kalkınca hedef serbest kalır', () => {
    const r = createReflector(-1);
    r.setBudget(reflectBudget('akici'));
    expect(r.texture).toBeNull(); expect(r.on).toBe(false);
    r.setBudget(reflectBudget('dengeli')); r.setBudget(null);
    expect(r.texture).toBeNull();
  });
});

describe('zemin AO ve temas düzlemi (GRS-06)', () => {
  it('duvar dibi 0.2 m, 1.0 m yüksekliğe göre en az %12 koyu; üst yüz ve 0.55 m üstü değişmez; aşağı bakan yüz 0.72', () => {
    expect(aoFactor(0.2, 0) / aoFactor(1.0, 0)).toBeLessThanOrEqual(0.88);
    expect(aoFactor(1.0, 0)).toBe(1); expect(aoFactor(0.1, 1)).toBe(1); expect(aoFactor(1.5, -1)).toBeCloseTo(0.72, 5);
    expect(aoFactor(2.2, 0, 0.3, 0.72, 2.0) / aoFactor(3.0, 0, 0.3, 0.72, 2.0)).toBeLessThanOrEqual(0.88);   // üst kat tabanı
  });
  it('groundAo ve wetZemin idempotent, önceki program anahtarını zincirler (zeminDetay ezilmez)', () => {
    const m = new T.MeshLambertMaterial(); m.customProgramCacheKey = () => 'zemin';
    wetZemin(m); groundAo(m); groundAo(m); wetZemin(m);
    expect(m.customProgramCacheKey()).toBe('zemin|islak|ao0.00');
    const sh = { uniforms: {} as Record<string, unknown>, vertexShader: T.ShaderLib.lambert.vertexShader, fragmentShader: T.ShaderLib.lambert.fragmentShader };
    m.onBeforeCompile(sh as never, null as never);
    expect(sh.fragmentShader.match(/varying vec3 vGW;/g)?.length).toBe(1);
    expect(sh.fragmentShader).toContain('uAoK'); expect(sh.fragmentShader).toContain('wetM');
    expect(sh.uniforms.uWet).toBeTruthy(); expect(sh.uniforms.uAoK).toBeTruthy();
    setZeminWet(2); expect(zeminWet()).toBe(1); setZeminWet(0); expect(zeminWet()).toBe(0);
  });
  it('yerde duran dik kutu ayak izi bırakır; yerden kalkık, eğik, alçak ve küçük parçalar bırakmaz; ızgara 4x4', () => {
    const b = new Batch();
    b.box(1, 1, 0.6, '#fff', 0, 0.5, 0);                 // tezgâh: evet
    b.box(1, 0.1, 1, '#fff', 0, 0.05, 0);                // alçak: hayır
    b.box(1, 1, 1, '#fff', 0, 1.5, 0);                   // havada: hayır
    b.box(0.1, 1, 0.1, '#fff', 3, 0.5, 0);               // küçük: hayır
    b.box(1, 1, 1, '#fff', 5, 0.5, 0, { rx: 0.4 });      // eğik: hayır
    b.cyl(0.3, 0.3, 0.9, '#fff', -3, 0.45, 0);           // bank ayağı/varil: evet
    expect(b.contactRects.length / 4).toBe(2);
    const m = b.mesh(new T.MeshLambertMaterial(), true, true), c = m.getObjectByName('contact') as T.Mesh;
    expect(c).toBeTruthy(); expect(c.geometry.attributes.position.count).toBe(32); expect(c.geometry.attributes.color.itemSize).toBe(4);
    expect(c.castShadow).toBe(false); expect((c.material as T.Material).transparent).toBe(true);
    expect(b.mesh(new T.MeshBasicMaterial(), true, true).getObjectByName('contact')).toBeUndefined();   // ışıksız malzeme: yok
    expect(b.mesh(new T.MeshLambertMaterial(), false, true).getObjectByName('contact')).toBeUndefined(); // gölge atmayan: yok
  });
  it('batch başına en çok 80 kayıt, büyükler önce', () => {
    const rects: number[] = []; for (let i = 0; i < 100; i++) rects.push(0, 0, 0.3 + i * 0.01, 0.3);
    const g = contactGeometry(rects)!;
    expect(g.attributes.position.count).toBe(CONTACT_MAX * 16);
  });
});

describe('cam ve gökyüzü env (GRS-05/GRS-17)', () => {
  it('yarım saatlik env yenilemesi malzemeyi yeniden derletmez; yalnız ilk atama derletir; kademe çarpanı uniform', () => {
    const m = new T.MeshStandardMaterial(); useSkyEnv(m, 'glass');
    const t1 = new T.Texture(), t2 = new T.Texture();
    setGlbEnv(t1); const v1 = m.version;
    setGlbEnv(t2); expect(m.version).toBe(v1); expect(m.envMap).toBe(t2);
    setGlbEnvK(0); expect(m.envMapIntensity).toBe(0); expect(m.version).toBe(v1);
    setGlbEnvK(1); expect(m.envMapIntensity).toBeCloseTo(1.15, 5);
  });
});
