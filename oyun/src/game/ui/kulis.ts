// Kulis: the esnaf creator behind a theatre stage (2026-10-24 13:05 user: "ayna karşısında, gardrop önünde ya da
// tiyatro sahnesinin arkasında olsun, karakteri yakından görelim; kafayı düzenlerken orası, kıyafet seçerken oralar").
// Own small three.js scene + renderer on a full-screen canvas over the paused game. The hero rig is the same one the
// game uses (esnafHeroOpts) and is rebuilt on every change. Each tab walks the hero to its corner of the backstage:
// a real mirror with bulbs for face/hair, the wardrobe rack for clothes, the hat table for accessories, the spotlight
// for identity and class. Every change sends { kind: 'esnafim', op: 'set' }; "Sahneye çık" sends op 'done'.
import * as T from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import type { Rules } from '../sim/state';
import { SINIFLAR, esnafHeroOpts, type EsnafimSave } from '../sim/esnafim';
import { YETENEK } from '../sim/yetenek';
import { KIYAFET_URUNLER, KIYAFET_ZINCIRLER } from '../../content/kiyafet';
import { AVM_GIY, AVM_BY_ID } from '../../content/avm';

export interface KulisView { update(dt: number): void; readonly open: boolean }
interface HeroLike { object: T.Object3D; setPose(p: { x: number; z: number }, r: number): void; setInput(i: Record<string, unknown>): void; update(dt: number, a: number): void; dispose(): void }

const SKINS = ['#fbe1cc', '#f5d0b1', '#eec29d', '#e6b089', '#d99f76', '#cb8d62', '#bb7b51', '#a66944', '#8f5839', '#784830', '#613a27', '#4b2d1f'];
const HAIR: [string, string][] = [['short', 'Kısa'], ['buzz', 'Kazıtma'], ['sport', 'Spor'], ['curly', 'Kıvırcık'], ['wavy', 'Dalgalı'], ['afro', 'Afro'], ['bob', 'Küt'], ['bun', 'Topuz'], ['ponytail', 'At kuyruğu'], ['long', 'Uzun'], ['loose', 'Salaş'], ['bald', 'Kel']];
const HAIRC = ['#1f1813', '#3b281c', '#5e3d26', '#7a4a2a', '#8c3f22', '#c8692e', '#d6b06c', '#eadfc8', '#9c9894', '#e85a9a', '#3a7bd5', '#3fa35a', '#7d3c98'];
const EYES: [string, string][] = [['round', 'Yuvarlak'], ['oval', 'Badem'], ['big', 'Kocaman'], ['small', 'Kısık'], ['lash', 'Kirpikli']];
const EYEC = ['#3a2416', '#6b4423', '#2f6f9a', '#3fa35a', '#7a7f87', '#1b1b22'];
const BROW: [string, string][] = [['thin', 'İnce'], ['mid', 'Orta'], ['thick', 'Gür'], ['none', 'Yok']];
const LIPS = ['#c0392b', '#e85a9a', '#9b3b5a', '#d9822b'];
const COLS = ['#fbf9f4', '#2b2b33', '#e0533c', '#f2c230', '#3fa35a', '#3fb5b0', '#2f6f9a', '#6f9bc8', '#7d3c98', '#e85a9a', '#c9a05a', '#7d5638', '#8daa5b'];
const TOPS: [string, string][] = [['tee', 'Tişört'], ['shirt', 'Gömlek'], ['hoodie', 'Kapüşonlu'], ['jacket', 'Ceket'], ['cardigan', 'Hırka'], ['suit', 'Takım'], ['vest', 'Yelek'], ['jersey', 'Forma'], ['overall', 'Tulum'], ['dress', 'Elbise']];
const DESEN: [string, string][] = [['0', 'Düz'], ['1', 'Baskılı'], ['2', 'Çizgili'], ['3', 'Kareli']];
const BOTS: [string, string][] = [['pants', 'Pantolon'], ['shorts', 'Şort'], ['skirt', 'Etek']];
const HATS: [string, string][] = [['', 'Yok'], ['kasket', 'Kasket'], ['cap', 'Kep'], ['beanie', 'Bere'], ['bucket', 'Balıkçı'], ['sunhat', 'Hasır'], ['bandana', 'Bandana'], ['captain', 'Kaptan'], ['chef', 'Aşçı'], ['paper', 'Kağıt'], ['helmet', 'Kask']];
const GLASS: [string, string][] = [['', 'Yok'], ['glasses', 'Gözlük'], ['round', 'Yuvarlak'], ['thick', 'Kalın çerçeve'], ['sun', 'Güneş']];

type Tab = 'kimlik' | 'yuz' | 'sac' | 'kiyafet' | 'dolap' | 'aksesuar' | 'vucut';
const TABS: [Tab, string, string][] = [['kimlik', '🎭', 'Kimlik'], ['yuz', '💄', 'Yüz'], ['sac', '💇', 'Saç & Sakal'], ['kiyafet', '👕', 'Kıyafet'], ['dolap', '🛍️', 'Dolap'], ['aksesuar', '🎩', 'Aksesuar'], ['vucut', '🧍', 'Vücut']];
/** where the hero stands, how it turns and where the camera looks from, per tab */
const SHOT: Record<Tab, { hx: number; hz: number; rot: number; cam: [number, number, number]; at: [number, number, number] }> = {
  // rot: turn away from facing the camera (0 = looks straight into it)
  kimlik: { hx: 0, hz: 0.4, rot: 0, cam: [0, 1.45, 4.9], at: [0, 1.0, 0.2] },
  // 16:52 user: face changes were invisible. Head-and-shoulders framing at eye level, far enough to see the whole head
  yuz: { hx: -2.2, hz: 0.05, rot: 0, cam: [-1.75, 1.5, 1.75], at: [-2.2, 1.42, 0.0] },
  sac: { hx: -2.2, hz: 0.05, rot: 0.45, cam: [-1.6, 1.62, 1.9], at: [-2.2, 1.45, 0.0] },
  kiyafet: { hx: 1.25, hz: 0.25, rot: 0.2, cam: [0.25, 1.2, 3.3], at: [1.45, 0.95, -0.2] },
  dolap: { hx: 1.6, hz: -0.2, rot: 0.25, cam: [0.4, 1.3, 2.9], at: [1.9, 1.1, -0.9] },
  aksesuar: { hx: 0.55, hz: 0.6, rot: 0.15, cam: [-0.2, 1.55, 2.3], at: [0.85, 1.25, 0.4] },
  vucut: { hx: 0, hz: 0.4, rot: 0, cam: [0, 1.15, 3.7], at: [0, 0.95, 0.4] },
};

const CSS = `
.kl-c{position:fixed;inset:0;pointer-events:auto;z-index:60;width:100%;height:100%;display:block;touch-action:none;cursor:grab}
.kl-p{position:fixed;right:12px;top:12px;bottom:12px;width:min(390px,calc(100vw - 24px));z-index:62;display:flex;flex-direction:column;background:#fdf3e1;color:#3b2a20;border:4px solid #3b2a20;border-radius:20px;box-shadow:0 8px 0 #3b2a20;font-family:var(--body);pointer-events:auto;overflow:hidden}
.kl-tabs{display:flex;gap:4px;padding:8px 8px 0;flex-wrap:wrap;background:#3b2a20}
.kl-t{flex:1 1 30%;min-height:44px;border:0;border-radius:12px 12px 0 0;background:#6a4a36;color:#fdf3e1;font:900 14px/1.1 var(--disp);cursor:pointer;padding:4px 6px}
.kl-t.on{background:#fdf3e1;color:#3b2a20}
.kl-b{flex:1;overflow:auto;padding:12px 14px 8px}
.kl-h{font:900 22px/1.1 var(--disp);margin:0 0 2px}.kl-sub{font:700 13px/1.3 var(--body);opacity:.72;margin:0 0 4px}
.kl-l{font:900 15px/1.2 var(--disp);margin:12px 0 6px}
.kl-in{width:100%;box-sizing:border-box;min-height:46px;border:3px solid #3b2a20;border-radius:12px;padding:6px 12px;font:800 17px var(--body);background:#fff;color:#3b2a20}
.kl-row{display:flex;flex-wrap:wrap;gap:7px}
.kl-sw{width:38px;height:38px;border-radius:50%;border:3px solid #3b2a20;cursor:pointer;box-shadow:0 3px 0 #3b2a20;padding:0}
.kl-sw.on{outline:4px solid #ffd23f;outline-offset:1px}
.kl-sw.no{background:repeating-linear-gradient(45deg,#fff,#fff 5px,#e9d9c0 5px,#e9d9c0 10px)}
.kl-ch{min-height:42px;padding:4px 12px;border-radius:12px;border:3px solid #3b2a20;background:#fff6e6;font:800 15px var(--body);color:#3b2a20;cursor:pointer;box-shadow:0 3px 0 #3b2a20}
.kl-ch.on{background:#ffd23f}
.kl-cls{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.kl-cl{text-align:left;padding:8px 10px;border-radius:14px;border:3px solid #3b2a20;background:#fff6e6;color:#3b2a20;cursor:pointer;box-shadow:0 3px 0 #3b2a20;font:900 16px/1.15 var(--disp)}
.kl-cl.on{background:#ffd23f}.kl-cl i{font-style:normal;font-size:24px;display:block}
.kl-cl small{display:block;font:700 12px/1.25 var(--body);opacity:.8;margin-top:3px}.kl-cl b{display:block;font:900 12px/1.2 var(--body);color:#2e7d32;margin-top:4px}
.kl-f{padding:10px 14px 14px;border-top:3px dashed #d8c3a3}
.kl-go{width:100%;min-height:58px;border-radius:16px;border:4px solid #3b2a20;background:#8fd06b;box-shadow:0 5px 0 #3b2a20;font:900 21px/1 var(--disp);color:#3b2a20;cursor:pointer}
.kl-rnd{position:fixed;left:14px;bottom:14px;z-index:62;min-height:50px;padding:6px 16px;border-radius:14px;border:4px solid #3b2a20;background:#fff6e6;box-shadow:0 4px 0 #3b2a20;font:900 17px var(--disp);color:#3b2a20;cursor:pointer}
.kl-tag{position:fixed;left:14px;top:14px;z-index:62;padding:8px 14px;border-radius:14px;background:rgba(40,22,18,.78);color:#ffe9b0;font:900 18px/1.2 var(--disp);pointer-events:none}
.kl-tag small{display:block;font:700 13px var(--body);color:#f4dcc0}
@media (max-width:700px){.kl-p{top:auto;height:56vh;left:8px;right:8px;width:auto;bottom:8px}.kl-rnd{bottom:auto;top:70px}.kl-t{flex-basis:30%;font-size:13px}}
`;

/** Painted textures, code made (no image files) */
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, rep?: [number, number]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}

function buildSet(scene: T.Scene, lowGpu: boolean) {
  const M = (color: string, o: Partial<T.MeshStandardMaterialParameters> = {}) => new T.MeshStandardMaterial({ color, roughness: 0.8, ...o });
  const add = (g: T.BufferGeometry, m: T.Material, x: number, y: number, z: number, ry = 0) => { const me = new T.Mesh(g, m); me.position.set(x, y, z); me.rotation.y = ry; scene.add(me); return me; };
  // stage planks
  const planks = canvasTex(256, 256, g => {
    for (let i = 0; i < 8; i++) { g.fillStyle = ['#8a5a36', '#7d5130', '#94633c', '#82552f'][i % 4]; g.fillRect(0, i * 32, 256, 32); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, i * 32 + 30, 256, 2); g.fillRect((i * 97) % 256, i * 32, 2, 32); }
  }, [3, 3]);
  add(new T.BoxGeometry(9, 0.2, 7), M('#ffffff', { map: planks, roughness: 0.65 }), 0, -0.1, 0);
  // back wall: dark painted bricks
  const bricks = canvasTex(256, 256, g => {
    g.fillStyle = '#2c2030'; g.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 16; r++) for (let c = 0; c < 8; c++) { g.fillStyle = `hsl(${330 + ((r * 7 + c * 13) % 20)},18%,${17 + ((r * 3 + c * 5) % 6)}%)`; g.fillRect(c * 32 + (r % 2) * 16 + 1, r * 16 + 1, 30, 14); }
  }, [4, 2]);
  add(new T.BoxGeometry(9, 5, 0.2), M('#ffffff', { map: bricks }), 0, 2.4, -2.6);
  add(new T.BoxGeometry(0.2, 5, 7), M('#ffffff', { map: bricks }), -3.4, 2.4, 0);
  add(new T.BoxGeometry(0.2, 5, 7), M('#ffffff', { map: bricks }), 3.4, 2.4, 0);
  // red velvet curtains (folds) at the stage opening, seen from the back
  const vel = M('#a3202c', { roughness: 0.95 });
  for (const side of [-1, 1]) for (let i = 0; i < 7; i++) add(new T.CylinderGeometry(0.17, 0.2, 4.6, 10), vel, side * (2.3 + i * 0.16), 2.3, -2.25 + (i % 2) * 0.1);
  add(new T.BoxGeometry(6.6, 0.55, 0.3), M('#7e1620'), 0, 4.45, -2.2);
  for (let i = 0; i < 12; i++) add(new T.ConeGeometry(0.16, 0.3, 6), M('#e0b13a', { metalness: 0.5, roughness: 0.4 }), -2.75 + i * 0.5, 4.08, -2.05);
  // makeup corner: table, a real mirror, bulbs
  const wood = M('#6b4429', { roughness: 0.6 }), dark = M('#3b2a20');
  add(new T.BoxGeometry(0.75, 0.08, 1.7), wood, -2.85, 0.82, -0.1);
  for (const z of [-0.85, 0.65]) add(new T.BoxGeometry(0.6, 0.8, 0.08), wood, -2.85, 0.41, z);
  add(new T.BoxGeometry(0.12, 1.55, 1.45), dark, -3.25, 1.75, -0.1);
  const mirror = new Reflector(new T.PlaneGeometry(1.2, 1.3), { textureWidth: lowGpu ? 512 : 1024, textureHeight: lowGpu ? 512 : 1024, color: new T.Color('#c9d6dc'), clipBias: 0.003 });
  mirror.position.set(-3.18, 1.75, -0.1); mirror.rotation.y = Math.PI / 2; scene.add(mirror);
  const bulbM = M('#fff4cf', { emissive: '#ffe08a', emissiveIntensity: 1.6 });
  const bulb = new T.SphereGeometry(0.045, 10, 8);
  for (let i = 0; i < 6; i++) { add(bulb, bulbM, -3.14, 1.15 + i * 0.24, -0.86); add(bulb, bulbM, -3.14, 1.15 + i * 0.24, 0.66); }
  for (let i = 0; i < 6; i++) add(bulb, bulbM, -3.14, 2.47, -0.72 + i * 0.25);
  // makeup bits on the table
  ['#e85a9a', '#c0392b', '#f2c230', '#3fb5b0', '#fbf9f4'].forEach((c, i) => add(new T.CylinderGeometry(0.03, 0.035, 0.12 + (i % 2) * 0.06, 10), M(c, { roughness: 0.35 }), -2.75 + (i % 2) * 0.12, 0.92, -0.65 + i * 0.12));
  add(new T.SphereGeometry(0.11, 12, 8), M('#d6b06c'), -2.8, 0.97, 0.45); // wig head
  // wardrobe corner: tall cabinet + an open rail of hanging clothes
  add(new T.BoxGeometry(1.0, 2.4, 0.7), wood, 2.8, 1.2, -1.9);
  add(new T.BoxGeometry(0.05, 2.2, 0.66), M('#4f3220'), 2.3, 1.2, -1.9, 0);
  for (const x of [1.15, 2.85]) add(new T.CylinderGeometry(0.025, 0.025, 1.9, 8), M('#b9b2a6', { metalness: 0.7, roughness: 0.3 }), x, 0.95, -1.15);
  const rail = add(new T.CylinderGeometry(0.02, 0.02, 1.75, 8), M('#b9b2a6', { metalness: 0.7, roughness: 0.3 }), 2.0, 1.86, -1.15); rail.rotation.z = Math.PI / 2;
  ['#e0533c', '#2f6f9a', '#f2c230', '#3fa35a', '#fbf9f4', '#7d3c98', '#2b2b33', '#e85a9a', '#3fb5b0'].forEach((c, i) => {
    const x = 1.3 + i * 0.17;
    add(new T.TorusGeometry(0.04, 0.006, 4, 10, Math.PI), M('#b9b2a6'), x, 1.8, -1.15, Math.PI / 2);
    const cl = add(new T.BoxGeometry(0.06, 0.62 + (i % 3) * 0.12, 0.42), M(c, { roughness: 0.9 }), x, 1.45 - (i % 3) * 0.06, -1.15); cl.rotation.z = (i % 2 ? 0.04 : -0.04);
  });
  // shoe line under the rail
  for (let i = 0; i < 5; i++) add(new T.BoxGeometry(0.12, 0.08, 0.24), M(['#7a5236', '#2b2b33', '#e0533c', '#fbf9f4', '#3a7bd5'][i]), 1.35 + i * 0.3, 0.04, -0.95);
  // hat table: round table with hats and glasses
  add(new T.CylinderGeometry(0.42, 0.42, 0.05, 24), wood, 1.55, 0.85, 1.05);
  add(new T.CylinderGeometry(0.05, 0.08, 0.85, 10), dark, 1.55, 0.42, 1.05);
  add(new T.CylinderGeometry(0.11, 0.11, 0.1, 16), M('#6b6258'), 1.4, 0.92, 0.95); add(new T.CylinderGeometry(0.17, 0.17, 0.015, 18), M('#6b6258'), 1.4, 0.88, 0.95);
  add(new T.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M('#e0533c'), 1.7, 0.88, 0.9);
  add(new T.CylinderGeometry(0.06, 0.12, 0.2, 14), M('#fbf9f4'), 1.62, 0.98, 1.25);
  const gl = add(new T.TorusGeometry(0.04, 0.008, 6, 14), M('#1b1b22'), 1.42, 0.885, 1.25); gl.rotation.x = Math.PI / 2;
  const gl2 = add(new T.TorusGeometry(0.04, 0.008, 6, 14), M('#1b1b22'), 1.52, 0.885, 1.25); gl2.rotation.x = Math.PI / 2;
  // a star on the floor where the hero is called up, plus clutter: trunk, ladder, sandbags
  add(new T.CylinderGeometry(0.55, 0.55, 0.01, 5), M('#ffd23f', { emissive: '#7a5a10', emissiveIntensity: 0.25 }), 0, 0.005, 0.4);
  add(new T.BoxGeometry(0.9, 0.5, 0.5), M('#5c3a6e'), -2.3, 0.25, -2.0, 0.2);
  add(new T.BoxGeometry(0.92, 0.06, 0.52), M('#e0b13a', { metalness: 0.5 }), -2.3, 0.5, -2.0, 0.2);
  for (let i = 0; i < 3; i++) add(new T.SphereGeometry(0.16, 10, 8), M('#b89a6a'), 2.9 - i * 0.22, 0.13, 1.9);
  // lights: warm backstage, a white spot on the star, bulbs by the mirror
  scene.add(new T.HemisphereLight('#ffe9cc', '#3a2430', 0.85));
  const key = new T.DirectionalLight('#fff1dc', 1.25); key.position.set(2, 4, 4); scene.add(key);
  const spot = new T.SpotLight('#fff6e0', 30, 9, 0.42, 0.55, 1.2); spot.position.set(0, 4.3, 2.0); spot.target.position.set(0, 0, 0.4); scene.add(spot, spot.target);
  const mirLight = new T.PointLight('#ffd98a', 6, 3.5, 1.5); mirLight.position.set(-2.7, 1.9, -0.1); scene.add(mirLight);
  const rackLight = new T.PointLight('#ffe8c8', 4, 4, 1.5); rackLight.position.set(1.9, 2.4, -0.3); scene.add(rackLight);
  scene.background = new T.Color('#1d1420');
  scene.fog = new T.Fog('#1d1420', 7, 13);
  return { mirror };
}

export function createKulis(deps: {
  root: HTMLElement; rules: () => Rules | null; command: (c: { kind: string; [k: string]: unknown }) => unknown;
  chars: { makeHero(o: never): unknown } | null; sfx?: (id: string) => void;
  /** bought clothes (sim/kiyafet.ts): owned/worn/gold, and the rig look of what is worn */
  dolap?: () => { owned: string[]; worn: Record<string, string>; gold: number }; worn?: () => Record<string, unknown>;
  /** clothes bought in Martı AVM (sim/mulk.ts avmAl) */ avm?: () => string[];
}): KulisView {
  const st = document.createElement('style'); st.textContent = CSS; deps.root.appendChild(st);
  let m: EsnafimSave | null = null;
  let tab: Tab = 'kimlik';
  let canvas: HTMLCanvasElement | null = null, panel: HTMLDivElement | null = null, rnd: HTMLButtonElement | null = null, tag: HTMLDivElement | null = null;
  let R: T.WebGLRenderer | null = null, scene: T.Scene | null = null, cam: T.PerspectiveCamera | null = null;
  let hero: HeroLike | null = null, heroKey = '', t = 0;
  const hp = { x: 0, z: 0.4, rot: 0 }, cp = new T.Vector3(0, 1.45, 4.9), ca = new T.Vector3(0, 1.0, 0.2);
  let spin = 0, drag: { x: number; s: number } | null = null, walkSp = 0;

  const tap = () => { try { deps.sfx?.('tap'); } catch { /* */ } };
  const set = (data: Record<string, unknown>) => { if (!m) return; Object.assign(m, data); deps.command({ kind: 'esnafim', op: 'set', data }); tap(); paint(); };

  function rebuildHero() {
    if (!m || !scene || !deps.chars) return;
    const w = deps.worn ? deps.worn() : {};
    const key = JSON.stringify(m) + JSON.stringify(w); if (key === heroKey && hero) return; heroKey = key;
    if (hero) hero.dispose();
    try { hero = deps.chars.makeHero(esnafHeroOpts(m, w) as never) as HeroLike; scene.add(hero.object); hero.object.visible = true; } catch { hero = null; }
  }

  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]);
  const sw = (key: string, list: string[], cur: unknown, opt: { none?: boolean; vals?: (string | number)[] } = {}) =>
    `<div class="kl-row">${opt.none ? `<button class="kl-sw no${cur == null ? ' on' : ''}" data-k="${key}" data-v="" data-null="1" aria-label="yok"></button>` : ''}${list.map((c, i) => { const v = opt.vals ? opt.vals[i] : c; return `<button class="kl-sw${String(v) === String(cur) ? ' on' : ''}" style="background:${c}" data-k="${key}" data-v="${v}" aria-label="${key} ${i + 1}"></button>`; }).join('')}</div>`;
  const ch = (key: string, list: [string, string][], cur: unknown) => `<div class="kl-row">${list.map(([v, l]) => `<button class="kl-ch${v === String(cur ?? '') ? ' on' : ''}" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const tog = (key: string, on: boolean, l: string) => `<button class="kl-ch${on ? ' on' : ''}" data-k="${key}" data-v="${on ? '0' : '1'}" data-bool="1">${on ? '✓ ' : ''}${l}</button>`;

  function body(e: EsnafimSave): string {
    switch (tab) {
      case 'kimlik': return `<div class="kl-h">Kulise hoş geldin!</div><div class="kl-sub">Perde açılmadan esnafını hazırla. Herkesin kendi dükkanı var.</div>
<div class="kl-l">Adın${e.adKilit ? ' 🔒 <small>(bir kez seçilir, değişmez)</small>' : ' <small>(bir kez seçilir, sonra değişmez!)</small>'}</div><input class="kl-in" name="ad" maxlength="14" value="${esc(e.ad)}"${e.adKilit ? ' readonly' : ''}>
<div class="kl-l">Dükkanının adı</div><input class="kl-in" name="dukkan" maxlength="22" value="${esc(e.dukkan)}">
<div class="kl-l">Sınıfın <small style="font:700 12px var(--body);opacity:.7">(her şeyi yapabilirsin, sınıfın en iyi olduğun iş)</small></div>
<div class="kl-cls">${SINIFLAR.map(s => `<button class="kl-cl${s.id === e.sinif ? ' on' : ''}" data-sinif="${s.id}"><i>${s.icon}</i>${s.ad}<small>${s.desc}</small><b>${s.perk}</b><b style="color:#7d3c98">${YETENEK[s.id].icon} ${YETENEK[s.id].ad}</b></button>`).join('')}</div>`;
      case 'yuz': return `<div class="kl-h">Ayna karşısı</div><div class="kl-sub">Yüzün, makyajın, gözlerin.</div>
<div class="kl-l">Ten</div>${sw('ten', SKINS, e.ten, { vals: SKINS.map((_, i) => i) })}
<div class="kl-l">Gözler</div>${ch('goz', EYES, e.goz)}
<div class="kl-l">Göz rengi</div>${sw('gozRenk', EYEC, e.gozRenk)}
<div class="kl-l">Göz aralığı</div>${ch('gozAra', [['yakin', 'Yakın'], ['orta', 'Orta'], ['uzak', 'Ayrık']], e.gozAra || 'orta')}
<div class="kl-l">Göz hizası</div>${ch('gozY', [['yukari', 'Yukarıda'], ['orta', 'Orta'], ['asagi', 'Aşağıda']], e.gozY || 'orta')}
<div class="kl-l">Burun</div>${ch('burun', [['kucuk', 'Minik'], ['orta', 'Orta'], ['iri', 'İri'], ['uzun', 'Uzun']], e.burun || 'orta')}
<div class="kl-l">Ağız</div>${ch('agiz', [['dar', 'Dar'], ['orta', 'Orta'], ['genis', 'Geniş']], e.agiz || 'orta')}
<div class="kl-l">Kulak</div>${ch('kulak', [['kucuk', 'Küçük'], ['orta', 'Orta'], ['kepce', 'Kepçe']], e.kulak || 'orta')}
<div class="kl-l">Kaşlar</div>${ch('kas', BROW, e.kas)}
<div class="kl-l">Allık</div>${ch('allik', [['0', 'Yok'], ['0.2', 'Hafif'], ['0.42', 'Pembiş']], e.allik >= 0.35 ? '0.42' : e.allik >= 0.1 ? '0.2' : '0')}
<div class="kl-l">Ruj</div>${sw('ruj', LIPS, e.ruj, { none: true })}
<div class="kl-l">Ayrıntılar</div><div class="kl-row">${tog('cil', e.cil, 'Çiller')}${tog('gamze', e.gamze, 'Gamze')}</div>
<div class="kl-l">Yüz ifadesi <small style="font:700 12px var(--body);opacity:.7">(dururken)</small></div>${ch('ifade', [['notr', 'Nötr'], ['gulumser', 'Gülümser'], ['nese', 'Neşeli'], ['ciddi', 'Ciddi'], ['gozkirp', 'Göz kırpar'], ['dalgin', 'Dalgın'], ['huzurlu', 'Huzurlu'], ['uykulu', 'Uykulu']], e.ifade || 'notr')}`;
      case 'sac': return `<div class="kl-h">Kuaför koltuğu</div><div class="kl-sub">Saç, bıyık, sakal. Pembe saç da olur, burası kulis.</div>
<div class="kl-l">Saç</div>${ch('sac', HAIR, e.sac)}
<div class="kl-l">Saç rengi</div>${sw('sacRenk', HAIRC, e.sacRenk)}
<div class="kl-l">Bıyık</div>${ch('biyik', [['yok', 'Yok'], ['ince', 'İnce'], ['kalin', 'Pala'], ['burma', 'Burma']], e.biyik)}
<div class="kl-l">Sakal</div>${ch('sakalStil', [['yok', 'Yok'], ['kirli', 'Kirli sakal'], ['kisa', 'Kısa sakal'], ['keci', 'Keçi'], ['cember', 'Çember'], ['favori', 'Favori'], ['tam', 'Gür sakal']], e.sakalStil || (e.sakal ? 'tam' : 'yok'))}`;
      case 'kiyafet': return `<div class="kl-h">Gardrop</div><div class="kl-sub">Askıdan seç, üstüne giy.</div>
<div class="kl-l">Üst</div>${ch('ustStil', TOPS, e.ustStil)}
<div class="kl-l">Üst rengi</div>${sw('ust', COLS, e.ust)}
<div class="kl-l">İkinci renk</div>${sw('aksan', COLS, e.aksan, { none: true })}
<div class="kl-l">Desen</div>${ch('desen', DESEN, e.desen)}
<div class="kl-l">Alt</div>${ch('altStil', BOTS, e.altStil)}
<div class="kl-l">Alt rengi</div>${sw('alt', COLS, e.alt)}
<div class="kl-l">Ayakkabı</div>${sw('ayakkabi', ['#7a5236', '#2b2b33', '#fbf9f4', '#e0533c', '#3a7bd5', '#f2c230'], e.ayakkabi)}
<div class="kl-l">Önlük</div>${sw('onluk', ['#e0533c', '#3fb5b0', '#2b2b30', '#d9822b', '#7d3c98', '#fbfbf8', '#3fa35a'], e.onluk, { none: true })}`;
      case 'dolap': {
        const dz = deps.dolap ? deps.dolap() : { owned: [], worn: {}, gold: 0 };
        const SL: Record<string, string> = { ust: 'Üst', alt: 'Alt', ayakkabi: 'Ayakkabı', aksesuar: 'Aksesuar', sapka: 'Şapka', kostum: 'Kostüm' };
        const avm = (deps.avm ? deps.avm() : []).filter(id => AVM_GIY[id]);
        return `<div class="kl-h">Dolap</div>${avm.length ? `<div class="kl-l">Martı AVM'den aldıkların</div><div class="kl-row">${avm.map(id => `<button class="kl-ch" data-avm="${id}">${AVM_BY_ID[id].ikon} ${esc(AVM_BY_ID[id].ad)} · Giy</button>`).join('')}</div>` : '<div class="kl-sub">Martı AVM\'den aldığın kıyafetler burada giyilir.</div>'}<div class="kl-sub">Markalı kıyafetler Altın Simitle alınır. Giydiğin, gardrop seçiminin üstüne geçer. Kasanda ${dz.gold} Altın Simit var.</div>
${KIYAFET_ZINCIRLER.map(z => `<div class="kl-l">${esc(z.name)} <small style="font:700 12px var(--body);opacity:.7">${esc(z.tagline)}</small></div><div class="kl-row">${KIYAFET_URUNLER.filter(u => u.zincir === z.id).map(u => {
          const own = dz.owned.includes(u.id), worn = dz.worn[u.slot] === u.id;
          return `<button class="kl-ch${worn ? ' on' : ''}" data-ky="${own ? (worn ? 'take' : 'wear') : 'buy'}" data-id="${u.id}" ${!own && dz.gold < u.gold ? 'style="opacity:.55"' : ''}><span style="display:inline-block;width:14px;height:14px;border-radius:50%;border:2px solid #3b2a20;vertical-align:-2px;background:${u.colors[0]}"></span> ${esc(u.name)} <small style="font:700 11px var(--body)">${SL[u.slot] || ''} · ${own ? (worn ? 'giyili ✓' : 'giy') : u.gold + ' 🥯'}</small></button>`;
        }).join('')}</div>`).join('')}`;
      }
      case 'aksesuar': return `<div class="kl-h">Şapka masası</div><div class="kl-sub">Son dokunuşlar.</div>
<div class="kl-l">Şapka</div>${ch('sapka', HATS, e.sapka)}
${e.sapka ? `<div class="kl-l">Şapka rengi</div>${sw('sapkaRenk', COLS, e.sapkaRenk)}` : ''}
<div class="kl-l">Gözlük</div>${ch('gozluk', GLASS, e.gozluk)}
<div class="kl-l">Papyon</div>${sw('papyon', ['#c0392b', '#2b2b33', '#f2c230', '#3fb5b0', '#e85a9a'], e.papyon, { none: true })}
<div class="kl-l">Kravat</div>${sw('kravat', ['#c0392b', '#2e3a59', '#3fa35a', '#f2c230', '#7d3c98'], e.kravat, { none: true })}
<div class="kl-l">Takı</div><div class="kl-row">${tog('kupe', e.kupe, 'Küpe')}</div>`;
      case 'vucut': return `<div class="kl-h">Boy aynası</div><div class="kl-sub">Kalıbını seç, gerisini sen süsle.</div>
<div class="kl-l">Cinsiyet</div>${ch('tip', [['a', 'Erkek'], ['b', 'Kadın']], e.tip)}
<div class="kl-l">Yapı</div>${ch('vucut', [['slim', 'İnce'], ['mid', 'Orta'], ['round', 'Tombul']], e.vucut)}
<div class="kl-l">Boy</div>${ch('boy', [['0.92', 'Kısa'], ['1', 'Orta'], ['1.08', 'Uzun']], e.boy <= 0.95 ? '0.92' : e.boy >= 1.05 ? '1.08' : '1')}`;
    }
  }
  const TAGS: Record<Tab, [string, string]> = { kimlik: ['🎭 Kulis', 'Spot ışığının altında'], yuz: ['💄 Makyaj aynası', 'Yüzüne yakından bak'], sac: ['💇 Kuaför koltuğu', 'Aynada saçın'], kiyafet: ['👕 Gardrop', 'Askıdaki kıyafetler'], dolap: ['🛍️ Dolap', 'Altın Simitle alınan kıyafetler'], aksesuar: ['🎩 Şapka masası', 'Aksesuarlar'], vucut: ['🧍 Boy aynası', 'Baştan aşağı'] };

  function paint() {
    if (!panel || !m) return;
    const keep = document.activeElement && panel.contains(document.activeElement) ? (document.activeElement as HTMLInputElement).name : '';
    const scroll = panel.querySelector('.kl-b')?.scrollTop ?? 0;
    panel.innerHTML = `<div class="kl-tabs">${TABS.map(([id, ic, l]) => `<button class="kl-t${id === tab ? ' on' : ''}" data-tab="${id}">${ic} ${l}</button>`).join('')}</div>
<div class="kl-b">${body(m)}</div><div class="kl-f"><button class="kl-go" data-go="1">Sahneye çık ✨</button></div>`;
    const b = panel.querySelector('.kl-b'); if (b) b.scrollTop = scroll;
    if (keep) { const el = panel.querySelector(`input[name="${keep}"]`) as HTMLInputElement | null; if (el) { el.focus(); const n = el.value.length; el.setSelectionRange(n, n); } }
    if (tag) tag.innerHTML = `${TAGS[tab][0]}<small>${TAGS[tab][1]}</small>`;
  }

  function randomize() {
    if (!m) return;
    const pick = <X,>(a: X[]) => a[Math.floor(Math.random() * a.length)];
    const s = pick(SINIFLAR);
    const d: Record<string, unknown> = {
      tip: pick(['a', 'b']), vucut: pick(['slim', 'mid', 'round']), ten: Math.floor(Math.random() * 12), goz: pick(EYES)[0], gozRenk: pick(EYEC), kas: pick(BROW.slice(0, 3))[0],
      sac: pick(HAIR)[0], sacRenk: pick(HAIRC), biyik: pick(['yok', 'ince', 'kalin', 'burma']), sakalStil: pick(['yok', 'yok', 'kirli', 'keci', 'tam']),
      gozAra: pick(['yakin', 'orta', 'uzak']), gozY: pick(['yukari', 'orta', 'asagi']), burun: pick(['kucuk', 'orta', 'iri', 'uzun']), agiz: pick(['dar', 'orta', 'genis']), kulak: pick(['kucuk', 'orta', 'kepce']), cil: Math.random() < 0.25, gamze: Math.random() < 0.3,
      sinif: s.id, ...s.kit,
    };
    set(d);
  }

  function open(model: EsnafimSave) {
    m = { ...model }; tab = model.done ? 'yuz' : 'kimlik'; heroKey = '';
    canvas = document.createElement('canvas'); canvas.className = 'kl-c'; deps.root.appendChild(canvas);
    tag = document.createElement('div'); tag.className = 'kl-tag'; deps.root.appendChild(tag);
    rnd = document.createElement('button'); rnd.className = 'kl-rnd'; rnd.textContent = '🎲 Rastgele'; deps.root.appendChild(rnd);
    rnd.onclick = randomize;
    panel = document.createElement('div'); panel.className = 'kl-p'; deps.root.appendChild(panel);
    try {
      R = new T.WebGLRenderer({ canvas, antialias: true });
      R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.ACESFilmicToneMapping;
      scene = new T.Scene(); cam = new T.PerspectiveCamera(40, 1, 0.05, 40);
      buildSet(scene, (window.devicePixelRatio || 1) > 2 || Math.min(window.innerWidth, window.innerHeight) < 500);
    } catch { R = null; }
    const s = SHOT[tab]; hp.x = s.hx; hp.z = s.hz; hp.rot = 0; cp.set(...s.cam); ca.set(...s.at);
    rebuildHero();
    panel.addEventListener('click', e => {
      const el = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!el || !m) return;
      if (el.dataset.go) { finish(); return; }
      if (el.dataset.tab) { tab = el.dataset.tab as Tab; spin = 0; tap(); paint(); return; }
      if (el.dataset.avm) { const g = AVM_GIY[el.dataset.avm]; if (g) set({ ...g }); return; }
      if (el.dataset.ky) { deps.command({ kind: 'kiyafet', op: el.dataset.ky, id: el.dataset.id }); tap(); heroKey = ''; setTimeout(paint, 30); return; }
      if (el.dataset.sinif) { const sn = SINIFLAR.find(x => x.id === el.dataset.sinif); if (sn) set({ sinif: sn.id, ...sn.kit }); return; }
      const k = el.dataset.k!, v = el.dataset.v!;
      if (el.dataset.null) { set({ [k]: null }); return; }
      if (el.dataset.bool) { set({ [k]: v === '1' }); return; }
      if (k === 'ten' || k === 'desen' || k === 'boy' || k === 'allik') { set({ [k]: Number(v) }); return; }
      if ((k === 'sapka' || k === 'gozluk') && v === '') { set({ [k]: null }); return; }
      set({ [k]: v });
    });
    panel.addEventListener('input', e => { const tg = e.target as HTMLInputElement; if (m && (tg.name === 'ad' || tg.name === 'dukkan')) { (m as unknown as Record<string, string>)[tg.name] = tg.value; deps.command({ kind: 'esnafim', op: 'set', data: { [tg.name]: tg.value } }); } });
    panel.addEventListener('keydown', e => e.stopPropagation());
    // drag on the stage turns the hero around
    canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, s: spin }; canvas?.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (drag) spin = drag.s + (e.clientX - drag.x) * 0.012; });
    const up = () => { drag = null; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    paint();
  }

  function finish() {
    if (!m) return;
    deps.command({ kind: 'esnafim', op: 'set', data: { ad: m.ad, dukkan: m.dukkan } });
    deps.command({ kind: 'saveSign', text: m.dukkan, font: 'vapur' });
    deps.command({ kind: 'esnafim', op: 'done' });
    try { deps.sfx?.('buy'); } catch { /* */ }
    close();
  }

  function close() {
    if (hero) { hero.dispose(); hero = null; }
    if (scene) scene.traverse(o => { const me = o as T.Mesh; if (me.geometry) me.geometry.dispose(); const mt = me.material as T.Material | T.Material[] | undefined; if (mt) (Array.isArray(mt) ? mt : [mt]).forEach(x => { const map = (x as T.MeshStandardMaterial).map; if (map) map.dispose(); x.dispose(); }); });
    if (R) { R.dispose(); R.forceContextLoss(); R = null; }
    for (const el of [canvas, panel, rnd, tag]) el?.remove();
    canvas = null; panel = null; rnd = null; tag = null; scene = null; cam = null; m = null;
  }

  function render(dt: number) {
    if (!R || !scene || !cam || !canvas) return;
    t += dt;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * R.getPixelRatio()) || canvas.height !== Math.floor(h * R.getPixelRatio())) { R.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); }
    const s = SHOT[tab], k = 1 - Math.exp(-dt * 4.5);
    // the side panel covers the right of the screen on wide screens: aim a bit to the right so the hero sits in the free part
    const wide = w > 700, off = wide ? 0.55 * (cp.distanceTo(ca) / 4.5) : 0;
    const dx = s.hx - hp.x, dz = s.hz - hp.z, dist = Math.hypot(dx, dz);
    hp.x += dx * k; hp.z += dz * k; walkSp = dist > 0.05 ? Math.min(1.6, dist * 3) : 0;
    const want = walkSp > 0 ? Math.atan2(dx, dz) : Math.atan2(s.cam[0] - hp.x, s.cam[2] - hp.z) + s.rot + spin;
    let dr = want - hp.rot; while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2; hp.rot += dr * Math.min(1, dt * 10);
    cp.lerp(new T.Vector3(...s.cam), k); ca.lerp(new T.Vector3(...s.at), k);
    cam.position.copy(cp);
    const right = new T.Vector3().subVectors(ca, cp).cross(new T.Vector3(0, 1, 0)).normalize();
    cam.lookAt(ca.clone().addScaledVector(right, off)); cam.fov = wide ? 40 : 48; cam.updateProjectionMatrix();
    if (hero) {
      hero.setPose({ x: hp.x, z: hp.z }, hp.rot);
      hero.setInput({ speed: walkSp, carry: 0, act: walkSp > 0 ? 'walk' : 'idle', mood: tab === 'yuz' || tab === 'sac' ? 'ok' : 'happy', t });
      hero.update(dt, 1);
    }
    R.render(scene, cam);
  }

  return {
    get open() { return !!panel; },
    update(dt: number) {
      const r = deps.rules(); if (!r) return;
      const want = r.rt.uiLast.esnafim as EsnafimSave | undefined;
      if (want && !panel) open(want);
      else if (!want && panel) close();
      if (panel && m) { rebuildHero(); render(Math.min(0.1, Math.max(0, dt))); }
    },
  };
}
