/** Sky dome (v2 world.js makeSky): gradient + sun glow + night stars; drives the v2 camera-distance fog rule. */
import * as T from 'three';
const V3 = (x = 0, y = 0, z = 0): T.Vector3 => new T.Vector3(x, y, z);
export function makeSky(): T.Mesh {
  const mat = new T.ShaderMaterial({
    uniforms: { uTop: { value: new T.Color('#6db8ef') }, uHor: { value: new T.Color('#cfe9f7') }, uLow: { value: new T.Color('#9cc8e0') },
      uSunCol: { value: new T.Color('#fff1d6') }, uSunDir: { value: V3(0.3, 0.6, 0.4).normalize() }, uNight: { value: 0 } },
    vertexShader: `varying vec3 vDir;
      void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p; gl_Position.z = p.w * 0.99995; }`,
    fragmentShader: `uniform vec3 uTop, uHor, uLow, uSunCol, uSunDir; uniform float uNight; varying vec3 vDir;
      float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 c = mix(uHor, uTop, smoothstep(0.0, 0.5, h));
        c = mix(c, uLow, smoothstep(0.0, -0.2, h));
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        c += uSunCol * (pow(s, 14.0) * 0.22 + pow(s, 3.0) * 0.07) * (1.0 - uNight * 0.6);
        if (uNight > 0.01) { float st = step(0.997, h31(floor(d * 220.0))); c += vec3(st) * uNight * smoothstep(0.04, 0.3, h); }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: T.BackSide, depthWrite: false, depthTest: false, fog: false
  });
  const m = new T.Mesh(new T.SphereGeometry(90, 32, 16), mat);
  m.frustumCulled = false; m.renderOrder = -100; m.name = 'sky';
  m.onBeforeRender = (_r: T.WebGLRenderer, s: T.Scene, cam: T.Camera) => {
    m.matrixWorld.makeTranslation(cam.position.x, cam.position.y, cam.position.z);
    const f = s.fog as T.Fog | null; if (f && f.isFog && m.userData.autoFog !== false) { const d = Math.hypot(cam.position.x, cam.position.y, cam.position.z + 4); f.near = d * 0.9 + 32; f.far = d * 1.5 + 140; }
  };
  return m;
}


