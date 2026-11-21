/**
 * Sky dome (v2 world.js makeSky): gradient + sun glow + night stars; drives the v2 camera-distance fog rule.
 * GRS-02 (owner: gün batımı sıcak, gece derin; B-016 atmosfer): still one mesh and one shader, no extra geometry.
 * - Soft moving clouds: 4-octave value-noise FBM on the sky plane, drifting slowly (uTime). Coverage uCloud (hava-look raises it in rain,
 *   fog and snow). Only pixels above the horizon pay for it (the top-down game camera mostly looks at the ground); uCloudQ 0 = no clouds
 *   (akıcı tier, render/index.ts).
 * - Sun halo: a wide warm glow on top of the old tight one; stronger at golden hour (lower sun), almost off at night (the moon disc leads).
 * - Night: stars twinkle slowly (each star at most ~0.5 changes per second, owner H-052: nothing flickers fast) and hide behind clouds;
 *   a moon disc with a cool halo sits low over the sea (the game camera faces the sea and sees only a thin band of sky), away from the
 *   evening sun.
 * - Fog distance follows the hour: userData.fogMul (render setTime, tod.fd) scales the v2 near/far rule: a little morning haze, a clearer
 *   noon (less milky distance), slightly closer at night (the far shore's lit windows stay visible).
 */
import * as T from 'three';
const V3 = (x = 0, y = 0, z = 0): T.Vector3 => new T.Vector3(x, y, z);
/** default cloud coverage on a clear day (0 = none, 1 = overcast) */
export const BULUT_TEMEL = 0.32;
export function makeSky(): T.Mesh {
  const mat = new T.ShaderMaterial({
    uniforms: { uTop: { value: new T.Color('#6db8ef') }, uHor: { value: new T.Color('#cfe9f7') }, uLow: { value: new T.Color('#9cc8e0') },
      uSunCol: { value: new T.Color('#fff1d6') }, uSunDir: { value: V3(0.3, 0.6, 0.4).normalize() }, uNight: { value: 0 },
      uTime: { value: 0 }, uCloud: { value: BULUT_TEMEL }, uCloudQ: { value: 1 }, uMoonDir: { value: V3(0.3, 0.07, -0.95).normalize() } },
    vertexShader: `varying vec3 vDir;
      void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p; gl_Position.z = p.w * 0.99995; }`,
    fragmentShader: `uniform vec3 uTop, uHor, uLow, uSunCol, uSunDir, uMoonDir; uniform float uNight, uTime, uCloud, uCloudQ; varying vec3 vDir;
      float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
      float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++) { s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 c = mix(uHor, uTop, smoothstep(0.0, 0.5, h));
        c = mix(c, uLow, smoothstep(0.0, -0.2, h));
        float day = 1.0 - uNight;
        vec3 sd = normalize(uSunDir);
        float s = max(dot(d, sd), 0.0);
        float low = 1.0 - smoothstep(0.1, 0.7, sd.y);   // golden hour: the sun is low, its halo spreads
        c += uSunCol * (pow(s, 14.0) * 0.22 + pow(s, 3.0) * 0.07 + pow(s, 6.0) * 0.10 * low) * (1.0 - uNight * 0.95);   // at night the light direction is the moon's: no second glow next to the moon disc
        float cov = 0.0;
        if (h > 0.0) {
          if (uCloudQ > 0.5) {
            // the game camera sees only a thin band above the horizon: clouds start right there (a distant cloud bank), not higher up
            vec2 p = d.xz / (h + 0.10) * 1.2 + uTime * vec2(0.010, 0.004);
            float f = fbm(p);
            cov = smoothstep(1.0 - uCloud - 0.12, 1.0 - uCloud + 0.30, f) * smoothstep(0.0, 0.04, h);
          }
          if (uNight > 0.01) {
            vec3 cell = floor(d * 220.0);
            float st = step(0.997, h31(cell));
            float tw = 0.7 + 0.3 * sin(uTime * (1.2 + 1.6 * h31(cell + 7.0)) + 6.28 * h31(cell + 3.0));
            c += vec3(st * tw) * uNight * smoothstep(0.04, 0.3, h) * (1.0 - cov);
            float m = max(dot(d, normalize(uMoonDir)), 0.0);
            vec3 moon = vec3(0.93, 0.91, 0.84) * smoothstep(0.99925, 0.99955, m) + vec3(0.42, 0.48, 0.70) * (pow(m, 260.0) * 0.30 + pow(m, 18.0) * 0.06);
            c += moon * uNight * (1.0 - cov * 0.85);
          }
          // cloud colour: lit by the sky by day (warm on the sun side), deep blue-grey at night; dark bellies when overcast
          vec3 lit = mix(uHor, vec3(1.0), 0.30) + uSunCol * (pow(s, 4.0) * 0.35 + 0.08) * day;
          vec3 cc = mix(lit, uTop * 1.5 + vec3(0.02, 0.02, 0.035), uNight) * (1.0 - 0.28 * smoothstep(0.45, 0.9, uCloud));
          c = mix(c, cc, cov * 0.82);
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: T.BackSide, depthWrite: false, depthTest: false, fog: false
  });
  const m = new T.Mesh(new T.SphereGeometry(90, 32, 16), mat);
  m.frustumCulled = false; m.renderOrder = -100; m.name = 'sky';
  m.userData.fogMul = 1;
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  m.onBeforeRender = (_r: T.WebGLRenderer, s: T.Scene, cam: T.Camera) => {
    m.matrixWorld.makeTranslation(cam.position.x, cam.position.y, cam.position.z);
    // seconds since start (clouds drift ~0.01 sky units/s; a day-long session stays well inside float precision)
    mat.uniforms.uTime.value = (((typeof performance !== 'undefined' ? performance.now() : 0) - t0) / 1000) % 86400;
    const f = s.fog as T.Fog | null; if (f && f.isFog && m.userData.autoFog !== false) { const d = +m.userData.fogD > 0 ? +m.userData.fogD : Math.hypot(cam.position.x, cam.position.y, cam.position.z + 4), fm = +m.userData.fogMul || 1; f.near = (d * 0.9 + 32) * fm; f.far = (d * 1.5 + 140) * fm; }
  };
  return m;
}
