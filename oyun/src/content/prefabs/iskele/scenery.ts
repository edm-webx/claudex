/**
 * İskele scenery: sea (shore-distance foam mask + shader), far skyline with clouds, ambient boats.
 * Ported 1:1 from v2 world.js (read-only reference); geometry, colours and proportions are kept exactly (parity is measured).
 * Port note: parameters are typed loosely (`any`) where v2 passed option bags; behaviour is unchanged.
 */
import * as T from 'three';
import { Batch, mtx, geoc, col, mixc, shade, clamp, lerp, easeInOut, PI, TAU, HP, roundBox } from '../../../engine/prefab/batch';
import { K, R, MAT, rnd, v2rng, rrect, fitText, txt, canvasTex, atlasTex, radialTex } from '../common/v2kit';
import { WATER_Y, SEAT_H, PIER, BUFE, GANG, WIN_Z, NEXT_SIGN, BENCHES, local2world as l2w, rectAABB, type Obstacle } from './layout';
const V3 = (x = 0, y = 0, z = 0): T.Vector3 => new T.Vector3(x, y, z);
void [mtx, geoc, col, mixc, shade, clamp, lerp, easeInOut, PI, TAU, HP, roundBox, K, R, MAT, rnd, v2rng, rrect, fitText, txt, canvasTex, atlasTex, radialTex, WATER_Y, SEAT_H, PIER, BUFE, GANG, WIN_Z, NEXT_SIGN, BENCHES, l2w, rectAABB, V3];
export type { Obstacle };

export const MASK = { x0: -72, z0: -40, w: 144, h: 112, px: 1024 };
export function makeSeaMask(pilings?: any) {
  const cv = document.createElement('canvas'); cv.width = MASK.px; cv.height = Math.round(MASK.px * MASK.h / MASK.w);
  const g = cv.getContext('2d')!, s = MASK.px / MASK.w;
  const X = (x: any) => (x - MASK.x0) * s, Z = (z: any) => (z - MASK.z0) * s;
  g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
  const shapes = (stroke?: any) => {
    g.beginPath(); g.rect(X(PIER.x0), Z(PIER.z0), (PIER.x1 - PIER.x0) * s, (PIER.z1 - PIER.z0) * s);
    g.rect(X(-62), Z(PIER.z1 - 0.05), 124 * s, (59 - PIER.z1 + 0.05) * s);   // the land: promenade, road and far side (x ±62, z to 59)
    stroke ? g.stroke() : g.fill();
    pilings.forEach((p: any) => { g.beginPath(); g.arc(X(p.x), Z(p.z), 0.32 * s, 0, TAU); stroke ? g.stroke() : g.fill(); });
  };
  const D = 3.6 * s, N = 28;
  g.lineJoin = 'round';
  for (let k = N; k >= 1; k--) { const t = k / N, v = Math.round((1 - t) * 255); g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = t * D * 2; shapes(true); }
  g.fillStyle = '#fff'; shapes(false);
  const t = new T.CanvasTexture(cv); t.needsUpdate = true;
  return t;
}
export function makeSea(mask?: any) {
  const mat = new T.ShaderMaterial({
    uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, {
      uTime: { value: 0 }, uNight: { value: 0 },
      uDeep: { value: new T.Color('#2f86c2') }, uShallow: { value: new T.Color('#5ab8d8') }, uFoam: { value: new T.Color('#eefbfb') },
      uSky: { value: new T.Color('#bfe3f7') }, uSunCol: { value: new T.Color('#fff1d6') }, uSunDir: { value: V3(0.3, 0.7, 0.4).normalize() },
      uMask: { value: null }, uMaskRect: { value: new T.Vector4(MASK.x0, MASK.z0, MASK.w, MASK.h) },
      uFerry: { value: new T.Vector4(0, -200, 0, 0) }, uFerryOn: { value: 0 }
    }]),
    vertexShader: `uniform float uTime; varying vec3 vW;
      #include <common>
      #include <fog_pars_vertex>
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        w.y += sin(w.x * 0.31 + uTime * 0.9) * 0.05 + sin(w.z * 0.27 - uTime * 0.75) * 0.05;
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime, uNight, uFerryOn; uniform vec3 uDeep, uShallow, uFoam, uSky, uSunCol, uSunDir;
      uniform sampler2D uMask; uniform vec4 uMaskRect, uFerry; varying vec3 vW;
      #include <common>
      #include <fog_pars_fragment>
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main(){
        vec2 p = vW.xz; float t = uTime;
        vec2 g = vec2(0.31 * cos(p.x * 0.31 + t * 0.9), 0.27 * cos(p.y * 0.27 - t * 0.75)) * 0.05;
        vec2 d1 = vec2(0.8, 0.6), d2 = vec2(-0.49, 0.87);
        g += d1 * 1.7 * cos(dot(p, d1) * 1.7 + t * 1.9) * 0.022 + d2 * 2.6 * cos(dot(p, d2) * 2.6 - t * 2.3) * 0.012;
        float rn = vn(p * 1.4 + vec2(t * 0.3, -t * 0.18)) - 0.5;
        vec3 n = normalize(vec3(-g.x * 4.0 + rn * 0.12, 1.0, -g.y * 4.0 + rn * 0.12));
        vec2 muv = (p - uMaskRect.xy) / uMaskRect.zw;
        float m = texture2D(uMask, vec2(muv.x, 1.0 - muv.y)).r;
        float ff = 0.0;
        if (uFerryOn > 0.5) {
          vec2 q = p - uFerry.xy; float c = cos(uFerry.z), s = sin(uFerry.z);
          vec2 l = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
          vec2 dd = abs(l) - vec2(2.25, 7.4);
          float sd = length(max(dd, 0.0)) + min(max(dd.x, dd.y), 0.0);
          float sp = abs(uFerry.w);
          ff = (1.0 - smoothstep(0.0, 0.35 + sp * 0.9, sd)) * (0.45 + 0.45 * vn(p * 2.5 + t));
          float back = -sign(uFerry.w) * l.y - 7.0;
          if (back > 0.0 && sp > 0.02) {
            float wdt = 1.6 + back * 0.12;
            float wk = (1.0 - smoothstep(wdt * 0.6, wdt, abs(l.x))) * (1.0 - smoothstep(0.0, 26.0 * sp + 4.0, back));
            ff = max(ff, wk * sp * (0.5 + 0.5 * vn(vec2(l.x * 2.0, back * 0.8 - t * 3.0))));
          }
        }
        float sh = smoothstep(0.0, 1.0, m);
        vec3 col = mix(uDeep, uShallow, 0.18 + 0.42 * sh);
        col = mix(col, uShallow, vn(p * 0.045 + t * 0.01) * 0.35);
        col *= 1.0 - 0.16 * smoothstep(0.86, 1.0, m);
        vec3 V = normalize(cameraPosition - vW);
        float fr = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
        col = mix(col, uSky, fr * 0.5 + 0.08);
        // small elongated whitecaps (filled, sparse) and a soft swell tint
        float cr = vn(vec2(p.x * 0.8, p.y * 2.0) + vec2(t * 0.25, t * 0.08)) * 0.6 + vn(vec2(p.x * 2.0, p.y * 4.4) - vec2(t * 0.2, -t * 0.32)) * 0.4;
        float crest = smoothstep(0.72, 0.84, cr);
        col = mix(col, uFoam, crest * (0.2 - 0.14 * uNight));
        col = mix(col, uDeep * 0.9, smoothstep(0.35, 0.15, cr) * 0.12);
        float edge = smoothstep(0.87, 0.95, m);
        float bands = smoothstep(0.7, 0.9, sin(m * 14.0 - t * 1.6)) * smoothstep(0.45, 0.8, m) * (1.0 - edge);
        float foam = clamp(edge + bands * 0.4, 0.0, 1.0) * (0.5 + 0.45 * vn(p * 3.2 + vec2(t * 0.6, 0.0)));
        foam = max(foam, ff);
        col = mix(col, uFoam, foam * (1.0 - 0.35 * uNight));
        vec3 H = normalize(V + normalize(uSunDir));
        col += uSunCol * pow(max(dot(n, H), 0.0), 220.0) * 1.1;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    fog: true
  });
  mat.uniforms.uMask.value = mask;
  const geo = new T.PlaneGeometry(420, 420, 70, 70); geo.rotateX(-HP);
  const m = new T.Mesh(geo, mat); m.position.y = WATER_Y; m.name = 'sea'; m.frustumCulled = false;
  return m;
}

/* far shore: hills, pastel houses, generic domes and slender minarets, a round tower, a suspension bridge, clouds */
export function makeSkyline() {
  const b = new Batch(), wb = new Batch(), cb = new Batch();
  const r = v2rng(2026);
  const zAt = (x: any) => -98 + x * x * 0.0011;
  const hills: any[] = [];
  // far ridge
  for (let x = -230; x <= 230; x += r.range(22, 34)) { const rr = r.range(30, 46), sy = r.range(0.32, 0.5); b.sph(rr, mixc('#93a6c4', '#a8b8d2', r.next()), x, WATER_Y - 4, zAt(x) - 26, { sy, sz: 0.45, ws: 16, hs: 8 }); }
  // near hills with houses
  for (let x = -210; x <= 210; x += r.range(18, 28)) { const rr = r.range(18, 30), sy = r.range(0.28, 0.42); hills.push({ x, r: rr, top: rr * sy - 3 }); b.sph(rr, mixc('#89a988', '#a2b98f', r.next()), x, WATER_Y - 3, zAt(x) - 8, { sy, sz: 0.4, ws: 16, hs: 8 }); }
  const hillY = (x: any) => { let y = 0; hills.forEach(h => { const d = (x - h.x) / h.r; if (Math.abs(d) < 1) y = Math.max(y, h.top * Math.sqrt(1 - d * d)); }); return y; };
  const houseCols = ['#f3d9b1', '#e9a98f', '#f6e7c8', '#cfe0d8', '#f0c2b0', '#f2e0a0', '#d9c8e8', '#ffffff'];
  for (let i = 0; i < 260; i++) {
    const x = r.range(-200, 200), base = hillY(x), y = WATER_Y - 2 + base * r.range(0.15, 0.92);
    if (y < WATER_Y + 1.2) continue;
    const w = r.range(1.6, 3.2), h = r.range(1.6, 3.4), z = zAt(x) - 6 + r.range(-3, 2);
    const c = r.pick(houseCols);
    b.box(w, h, 1.8, c, x, y + h / 2, z, { r: 0 });
    b.cone(w * 0.78, 1.0, '#c8693e', x, y + h + 0.48, z, { seg: 4, ry: PI / 4, sx: 1, sz: 0.62 });
    if (r.chance(0.7)) wb.plane(0.5, 0.6, '#ffd890', x + r.range(-w * 0.3, w * 0.3), y + h * 0.55, z + 0.92);
    if (r.chance(0.4)) wb.plane(0.5, 0.6, '#ffe2a8', x + r.range(-w * 0.3, w * 0.3), y + h * 0.3, z + 0.92);
  }
  // waterfront row
  for (let x = -190; x <= 190; x += r.range(3.5, 6)) {
    const w = r.range(3, 5.5), h = r.range(3, 6.5), z = zAt(x) + 1.5;
    if (Math.abs(x + 20) < 14 || Math.abs(x - 46) < 12) continue;
    b.box(w, h, 3, r.pick(houseCols), x, WATER_Y + h / 2, z, { r: 0 });
    b.box(w + 0.3, 0.4, 3.3, '#b8a58e', x, WATER_Y + h + 0.2, z, { r: 0 });
    for (let k = 0; k < 3; k++) if (r.chance(0.6)) wb.plane(0.6, 0.8, '#ffd890', x - w * 0.3 + k * w * 0.3, WATER_Y + h * 0.6, z + 1.52);
  }
  b.box(420, 1.4, 6, '#b7aa98', 0, WATER_Y - 0.2, zAt(0) + 4, { r: 0 });
  // mosques: generic composition, not a copy of a real building
  const mosque = (x?: any, s?: any, minarets?: any) => {
    const z = zAt(x) - 3, y0 = WATER_Y - 2 + hillY(x) * 0.95, stone = '#ece4d5', lead = '#a5b2c2';
    const M = mtx(x, y0, z, 0, r.range(-0.15, 0.15), 0, s, s, s); b.push(M); wb.push(M);
    b.box(12, 5, 9, stone, 0, 2.5, 0, { r: 0 });
    b.cyl(3.6, 3.8, 1.4, stone, 0, 5.7, 0, { seg: 16 }); b.sph(3.7, lead, 0, 6.3, 0, { tl: HP, ws: 18, hs: 6 });
    b.cyl(0.08, 0.08, 1.4, '#e8c060', 0, 10.4, 0, { seg: 5 }); b.sph(0.22, '#e8c060', 0, 10.9, 0, { ws: 6, hs: 4 });
    [-1, 1].forEach(d => { b.sph(2.5, lead, d * 3.9, 4.9, 0, { tl: HP, ws: 14, hs: 5 }); b.cyl(2.5, 2.5, 0.2, stone, d * 3.9, 4.9, 0, { seg: 14 }); });
    [[-4.6, 3.2], [4.6, 3.2], [-4.6, -3.2], [4.6, -3.2]].forEach(([a, c]) => { b.sph(1.0, lead, a, 5.0, c, { tl: HP, ws: 10, hs: 4 }); b.cyl(1.0, 1.0, 0.5, stone, a, 4.8, c, { seg: 10 }); });
    const mp = minarets === 4 ? [[-7.5, 5.5], [7.5, 5.5], [-7.5, -5.5], [7.5, -5.5]] : [[-7.5, 4.5], [7.5, 4.5]];
    mp.forEach(([a, c]) => {
      b.cyl(0.42, 0.5, 1.6, stone, a, 0.8, c, { seg: 8 });
      b.cyl(0.3, 0.36, 15, stone, a, 8.6, c, { seg: 8 });
      [10.5, 13.6].forEach(hh => { b.cyl(0.6, 0.45, 0.35, stone, a, hh, c, { seg: 10 }); wb.box(0.22, 0.22, 0.22, '#fff2c0', a, hh + 0.35, c + 0.55, { r: 0 }); });
      b.cone(0.36, 2.6, lead, a, 17.4, c, { seg: 8 }); b.cyl(0.04, 0.04, 0.8, '#e8c060', a, 19.0, c, { seg: 4 });
    });
    b.pop(); wb.pop();
  };
  mosque(-20, 1.0, 4); mosque(46, 0.8, 2); mosque(-118, 0.75, 2); mosque(128, 0.7, 2);
  // round stone tower with a conical cap on a hill
  { const x = 14, z = zAt(x) - 5, y0 = WATER_Y - 2 + hillY(x) * 0.95;
    b.cyl(2.3, 2.6, 13, '#ddd0b8', x, y0 + 6.5, z, { seg: 16 }); b.cyl(2.6, 2.4, 0.8, '#cbbda4', x, y0 + 12.4, z, { seg: 16 });
    b.cone(2.7, 5, '#7f8da0', x, y0 + 15.3, z, { seg: 16 }); for (let k = 0; k < 6; k++) wb.plane(0.4, 0.8, '#ffe2a8', x + Math.sin(k) * 1.2, y0 + 10.5, z + 2.3); }
  // suspension bridge in the far west, landing on a near headland
  { const A = V3(-128, 0, zAt(-128) + 2), Bp = V3(-196, 0, -6); const dir = Bp.clone().sub(A), len = dir.length(); const ang = Math.atan2(dir.x, dir.z);
    b.sph(26, '#95b08a', -205, WATER_Y - 4, -2, { sy: 0.38, sz: 0.7 });
    const MB = mtx(A.x, 0, A.z, 0, ang, 0); b.push(MB); wb.push(MB);
    b.box(2.4, 0.9, len, '#c9c4bc', 0, 12, len / 2, { r: 0 });
    [len * 0.22, len * 0.78].forEach(tz => { [-1.3, 1.3].forEach(tx => b.box(0.7, 34, 0.9, '#d9d4cc', tx, 16, tz, { r: 0 })); [19, 27, 32].forEach(hy => b.box(3.3, 0.8, 0.8, '#d9d4cc', 0, hy, tz, { r: 0 })); });
    [-1.3, 1.3].forEach(tx => {
      const pts: any[] = []; const t0 = len * 0.22, t1 = len * 0.78;
      for (let k = 0; k <= 24; k++) { const zz = k / 24 * len; let y: any; if (zz < t0) y = 12.5 + (zz / t0) * 20.5; else if (zz > t1) y = 33 - ((zz - t1) / (len - t1)) * 20.5; else { const u = (zz - t0) / (t1 - t0) * 2 - 1; y = 13.5 + 19.5 * u * u; } pts.push([zz, y]); }
      for (let k = 0; k < pts.length - 1; k++) { const [z0, y0] = pts[k], [z1, y1] = pts[k + 1]; const l = Math.hypot(z1 - z0, y1 - y0); b.box(0.25, 0.25, l, '#e8e2d8', tx, (y0 + y1) / 2, (z0 + z1) / 2, { r: 0, rx: -Math.atan2(y1 - y0, z1 - z0) }); if (k % 2 === 0 && y0 > 13) b.box(0.08, y0 - 12.4, 0.08, '#e8e2d8', tx, 12.2 + (y0 - 12.4) / 2, z0, { r: 0 }); wb.box(0.3, 0.3, 0.3, '#fff0c0', tx, y0, z0, { r: 0 }); }
    });
    b.pop(); wb.pop(); }
  // Martıköy village behind the park (wide and intro shots)
  for (let x = -96; x <= 96; x += r.range(5.5, 8.5)) {
    const w = r.range(4.5, 7), h = r.range(5, 11), d = r.range(5, 7), z = r.range(40, 46), c = r.pick(houseCols);
    b.box(w, h, d, c, x, h / 2, z, { r: 0.06 });
    b.cone(Math.max(w, d) * 0.74, 1.6, '#c8693e', x, h + 0.8, z, { seg: 4, ry: PI / 4, sx: w / Math.max(w, d), sz: d / Math.max(w, d) });
    for (let fy = 1.8; fy < h - 0.8; fy += 2.4) for (let k = -1; k <= 1; k++) { if (r.chance(0.35)) continue; wb.plane(0.7, 0.9, '#ffd890', x + k * w * 0.3, fy, z - d / 2 - 0.02, { ry: PI }); b.plane(0.7, 0.9, '#7f9bb0', x + k * w * 0.3, fy, z - d / 2 - 0.01, { ry: PI }); }
  }
  // clouds
  for (let i = 0; i < 9; i++) {
    const x = r.range(-170, 170), y = r.range(30, 62), z = -150 + r.range(-12, 18) + x * x * 0.0006, s = r.range(5, 11);
    for (let k = 0; k < 5; k++) cb.sph(s * r.range(0.55, 1.0), '#ffffff', x + (k - 2) * s * 0.75 + r.range(-1, 1), y + r.range(-1, 1.5) * s * 0.3, z, { sy: 0.55, ws: 12, hs: 8 });
  }
  const sky = b.mesh(new T.MeshLambertMaterial({ map: atlasTex, vertexColors: true }), false, false); sky.name = 'skyline'; sky.frustumCulled = false;
  const win = wb.mesh(MAT.win, false, false); win.name = 'skylineWindows'; win.frustumCulled = false;
  const clouds = cb.mesh(new T.MeshBasicMaterial({ color: '#ffffff', map: atlasTex, vertexColors: true, fog: false }), false, false); clouds.name = 'clouds'; clouds.frustumCulled = false;
  return { sky, win, clouds };
}

/* ambient boats: an anchored fishing boat, a drifting sail boat, buoys */
export function makeBoats() {
  const g = new T.Group(); g.name = 'boats';
  const kayik = new Batch();
  kayik.box(1.5, 0.55, 4.2, '#fbfaf6', 0, 0.1, 0, { r: 0.25, s: 2 });
  kayik.box(1.52, 0.12, 4.22, '#2f6fdb', 0, 0.3, 0, { r: 0.06 });
  kayik.box(1.2, 0.08, 3.6, '#b98a5e', 0, 0.32, 0, { r: 0.03 });
  kayik.box(0.9, 0.7, 1.1, '#fbfaf6', 0, 0.7, -0.6, { r: 0.08 }); kayik.box(1.0, 0.08, 1.2, '#e0533c', 0, 1.07, -0.6, { r: 0.04 });
  kayik.box(0.3, 0.5, 0.3, '#3c4146', 0, 0.45, 2.0, { r: 0.05 }); kayik.cyl(0.03, 0.03, 1.8, '#7d5638', 0.4, 1.1, 1.4, { rx: -0.6, seg: 5 });
  const k1 = kayik.mesh(MAT.atlas, true, false); k1.position.set(-15.5, WATER_Y, -19); k1.rotation.y = 0.7; g.add(k1);
  const sail = new Batch();
  sail.box(1.3, 0.5, 4.6, '#fbfaf6', 0, 0.1, 0, { r: 0.24, s: 2 }); sail.box(1.32, 0.1, 4.62, '#e0533c', 0, 0.28, 0, { r: 0.05 });
  sail.cyl(0.05, 0.05, 6, '#e8e2d8', 0, 3.2, 0.3, { seg: 6 });
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute([0, 0.6, 0.45, 0, 6.0, 0.4, 0, 0.6, 2.4], 3)); sg.computeVertexNormals();
  sail.add(sg, '#fff6e6'); sail.add(sg, '#fff6e6', mtx(0, 0, 0, 0, PI, 0, 1, 1, 1));
  const s1 = sail.mesh(MAT.atlas, true, false); s1.position.set(-30, WATER_Y, -34); g.add(s1);
  const bu = new Batch();
  bu.cyl(0.35, 0.45, 0.6, '#e0533c', 0, 0.1, 0, { seg: 10 }); bu.cyl(0.36, 0.36, 0.14, '#fbfaf6', 0, 0.2, 0, { seg: 10 }); bu.cone(0.25, 0.5, '#e0533c', 0, 0.65, 0, { seg: 8 });
  const bg = bu.geometry(); const buoys: any[] = [];
  [[-17, -7], [15.5, -21], [-6, -24]].forEach(([x, z]) => { const m = new T.Mesh(bg, MAT.atlas); m.position.set(x, WATER_Y, z); g.add(m); buoys.push(m); });
  return { group: g, kayik: k1, sail: s1, buoys };
}
