/**
 * Sabri'nin Evi overlay (survey ev-1..9): the attic room above the büfe as a full-screen overlay with its own small
 * three renderer (a cut-away low-poly diorama) plus big one-tap DOM controls. Pure view: reads `rt.dekorEv`
 * (sim/dekor-ev.ts) and sends { kind: 'dekor2', arg } commands. The renderer is created when the home opens and
 * disposed when it closes, so it costs nothing during normal play.
 * Areas: oda, mutfak, balkon, teras, kedi (5 alan). Each area has fixed furniture spots; placed items are built with the
 * same code-made shapes as the decor catalogue (prefabs/iskele/decor-extra.ts shapeInto).
 */
import * as T from 'three';
import { Batch } from '../../../engine/prefab/batch';
import { shapeInto } from '../../../content/prefabs/iskele/decor-extra';
import { HOME_AREAS, HOME_THEMES, homeItemById } from '../../../content/dekor-katalog';
import { dekorEvApi } from '../../sim/dekor-ev';

export interface EvRoomDeps { root: HTMLElement; rules: () => { rt: unknown; state: unknown } | null; command: (c: { kind: string; [k: string]: unknown }) => void }
export interface EvRoomView { update(dt: number): void; isOpen(): boolean; dispose(): void }

type M = Record<string, any>;
const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const fmt = (n: number) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₺';

/** Furniture spots per area (x, z, rotY), room is 5 x 4 m, back wall at z = -2, left wall at x = -2.5. */
const SPOTS: Record<string, [number, number, number][]> = {
  oda: [[-1.2, -1.3, 0], [1.1, -1.3, 0], [-1.85, 0.3, Math.PI / 2], [0.2, 0.2, 0], [1.6, 0.6, -Math.PI / 4]],
  mutfak: [[-1.3, -1.4, 0], [0, -1.4, 0], [1.3, -1.4, 0], [-1.8, 0.4, Math.PI / 2]],
  balkon: [[-1.4, -1.0, 0], [0, -0.6, 0], [1.4, -1.0, 0], [0.6, 0.9, -0.4]],
  teras: [[-1.4, -1.2, 0], [0.2, -1.1, 0], [1.6, -0.9, -0.4], [-1.2, 0.8, 0.5], [1.2, 0.9, 0]],
  kedi: [[-1.3, -1.3, 0], [1.2, -1.3, 0], [-1.8, 0.4, Math.PI / 2], [0.6, 0.6, 0]],
};
const OPEN_AIR = new Set(['balkon', 'teras']);

const CSS = `
.ev-ov{position:absolute;inset:0;z-index:60;display:flex;flex-direction:column;background:#2b3a55;pointer-events:auto;font-family:var(--body,system-ui)}
.ev-top{display:flex;align-items:center;gap:8px;padding:10px 12px 6px;color:#fffaf0}
.ev-top h2{flex:1;margin:0;font:900 22px/1.1 var(--disp,system-ui)}
.ev-top small{display:block;font:800 14px/1.2 var(--body,system-ui);opacity:.85}
.ev-x{min-height:52px;padding:0 16px;border:3px solid #33373b;border-radius:16px;background:#ffd23f;font:900 18px/1 var(--disp,system-ui);color:#33373b;cursor:pointer}
.ev-areas{display:flex;gap:6px;overflow-x:auto;padding:0 12px 6px;scrollbar-width:none}
.ev-ar{flex:none;min-height:46px;padding:4px 12px;border:2.5px solid #33373b;border-radius:14px;background:#fbfaf6;font:900 15px/1.1 var(--disp,system-ui);color:#33373b;cursor:pointer}
.ev-ar.on{background:#ffd23f}.ev-ar.lock{opacity:.7;background:#d9dde2}
.ev-cv{flex:1;min-height:180px;position:relative}.ev-cv canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.ev-say{position:absolute;left:12px;right:12px;bottom:8px;padding:8px 12px;border:2.5px solid #33373b;border-radius:14px;background:#fffaf0;font:800 16px/1.3 var(--body,system-ui);color:#33373b}
.ev-bot{background:#fbf3e4;border-top:3px solid #33373b;padding:8px 10px 12px;max-height:44%;overflow-y:auto}
.ev-h{font:900 17px/1.2 var(--disp,system-ui);color:#33373b;margin:4px 2px 6px;display:flex;justify-content:space-between;gap:8px}
.ev-placed{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.ev-pl{min-height:44px;padding:4px 10px;border:2.5px solid #33373b;border-radius:14px;background:#fff;font:800 15px/1.1 var(--body,system-ui);color:#33373b;cursor:pointer}
.ev-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.ev-it{border:2.5px solid #33373b;border-radius:14px;background:#fff;padding:8px;display:flex;flex-direction:column;gap:4px;color:#33373b}
.ev-it b{font:900 15px/1.15 var(--disp,system-ui)}.ev-it span{font:700 13px/1.25 var(--body,system-ui);opacity:.85}
.ev-b{min-height:48px;border:2.5px solid #33373b;border-radius:12px;background:#7bd389;font:900 15px/1.1 var(--disp,system-ui);color:#33373b;cursor:pointer}
.ev-b.cream{background:#fbfaf6}.ev-b.off{opacity:.5}
.ev-th{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
`;

export function createEvRoom(deps: EvRoomDeps): EvRoomView {
  let el: HTMLDivElement | null = null, renderer: T.WebGLRenderer | null = null;
  let scene: T.Scene | null = null, cam: T.OrthographicCamera | null = null, room: T.Group | null = null;
  let roomKey = '', uiKey = '', t = 0, lineI = 0;
  const api = () => { const r = deps.rules(); return r ? dekorEvApi(r) : null; };
  const send = (arg: string) => deps.command({ kind: 'dekor2', arg });

  function open(): void {
    el = document.createElement('div'); el.className = 'ev-ov';
    el.innerHTML = `<style>${CSS}</style><div class="ev-top"><h2>Sabri'nin Evi<small class="ev-sub"></small></h2><button class="ev-x" data-ev="evClose">Aşağı in</button></div><div class="ev-areas"></div><div class="ev-cv"><canvas></canvas><div class="ev-say"></div></div><div class="ev-bot"></div>`;
    deps.root.appendChild(el);
    el.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('[data-ev]') as HTMLElement | null; if (!b) return;
      if (b.classList.contains('off')) return;
      send(b.dataset.ev || ''); uiKey = ''; roomKey = '';
    });
    const canvas = el.querySelector('canvas') as HTMLCanvasElement;
    try {
      renderer = new T.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    } catch (e) { console.warn('[ev-room] no webgl', e); renderer = null; }
    scene = new T.Scene();
    scene.add(new T.HemisphereLight('#fff4e0', '#7a5a40', 1.1));
    const sun = new T.DirectionalLight('#fff1d6', 1.2); sun.position.set(4, 8, 6); scene.add(sun);
    cam = new T.OrthographicCamera(-4, 4, 3, -3, 0.1, 60);
    cam.position.set(7, 6.5, 8); cam.lookAt(0, 0.8, 0);
    roomKey = ''; uiKey = '';
  }
  function close(): void {
    if (renderer) { renderer.dispose(); renderer.forceContextLoss(); renderer = null; }
    if (room) disposeGroup(room);
    room = null; scene = null; cam = null;
    el?.remove(); el = null;
  }
  function disposeGroup(g: T.Object3D): void { g.traverse(o => { const m = o as T.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as T.Material).dispose(); } }); }

  const lam = (c: string) => new T.MeshLambertMaterial({ color: c });
  const box = (g: T.Group, w: number, h: number, d: number, c: string, x: number, y: number, z: number) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); g.add(m); return m; };

  function buildRoom(area: string, items: string[], themeWall: string): T.Group {
    const g = new T.Group();
    const ar = HOME_AREAS.find(a => a.id === area) || HOME_AREAS[0];
    const wall = area === 'oda' && themeWall ? themeWall : ar.wall;
    // floor with planks
    box(g, 5, 0.2, 4, ar.floor, 0, -0.1, 0);
    for (let i = 0; i < 5; i++) box(g, 0.02, 0.005, 4, '#8a6a4a', -2 + i, 0.002, 0);
    if (!OPEN_AIR.has(area)) {
      box(g, 5, 2.6, 0.15, wall, 0, 1.3, -2.07);
      box(g, 0.15, 2.6, 4, wall, -2.57, 1.3, 0);
      // window with the Boğaz behind
      box(g, 1.3, 0.9, 0.04, '#7a5638', 0.6, 1.55, -1.98); box(g, 1.15, 0.75, 0.05, '#8fd0f2', 0.6, 1.55, -1.97); box(g, 1.15, 0.2, 0.06, '#2f7fb3', 0.6, 1.25, -1.96);
      box(g, 0.04, 0.75, 0.07, '#7a5638', 0.6, 1.55, -1.95);
      if (area === 'oda') { // sloped attic ceiling beams + a small door to the stairs
        for (let i = 0; i < 4; i++) { const b = box(g, 0.14, 0.14, 4.2, '#8a5d3b', -2 + i * 1.3, 2.75, 0); b.rotation.x = 0; }
        const r = box(g, 5.2, 0.08, 2.6, '#b07a4f', 0, 2.95, -1.0); r.rotation.x = 0.5;
        box(g, 0.08, 1.7, 0.8, '#9c6c46', -2.48, 0.85, 1.2); box(g, 0.1, 0.06, 0.06, '#f2b632', -2.42, 0.85, 0.95);
      }
      if (area === 'mutfak') for (let i = 0; i < 10; i++) box(g, 0.48, 0.48, 0.02, i % 2 ? '#ffffff' : '#bfe6e9', -2.25 + i * 0.5, 1.1, -1.99);
      if (area === 'kedi') for (let i = 0; i < 6; i++) { const p = box(g, 0.18, 0.18, 0.02, '#f2a2b3', -2 + i * 0.8, 1.9 - (i % 2) * 0.4, -1.99); p.rotation.z = 0.6; }
    } else {
      // railing + sea + skyline
      for (let i = 0; i <= 10; i++) box(g, 0.06, 0.9, 0.06, '#fbfaf6', -2.5 + i * 0.5, 0.45, -2);
      box(g, 5.1, 0.08, 0.1, '#fbfaf6', 0, 0.92, -2); box(g, 0.1, 0.08, 4, '#fbfaf6', -2.5, 0.92, 0);
      for (let i = 0; i <= 8; i++) box(g, 0.06, 0.9, 0.06, '#fbfaf6', -2.5, 0.45, -2 + i * 0.5);
      box(g, 30, 0.05, 12, '#2f7fb3', -4, -1.2, -9);
      for (let i = 0; i < 8; i++) box(g, 0.7, 0.6 + (i * 37 % 5) * 0.25, 0.4, '#93aec4', -9 + i * 1.6, -0.9, -13);
      if (area === 'teras') for (let i = 0; i < 9; i++) { const s = new T.Mesh(new T.SphereGeometry(0.05, 6, 4), new T.MeshBasicMaterial({ color: '#fff6c8' })); s.position.set(-6 + i * 1.5, 3.4 + (i % 3) * 0.4, -8); g.add(s); }
    }
    // furniture
    const spots = SPOTS[area] || SPOTS.oda;
    items.forEach((id, i) => {
      const it = homeItemById(id); if (!it) return;
      const sp = spots[i % spots.length];
      const A = new Batch(), BU = new Batch();
      shapeInto(A, BU, it.shape, it.cols);
      const o = new T.Group(); o.position.set(sp[0], 0, sp[1]); o.rotation.y = sp[2];
      if (!A.empty) o.add(new T.Mesh(A.geometry(), new T.MeshLambertMaterial({ vertexColors: true })));
      if (!BU.empty) o.add(new T.Mesh(BU.geometry(), new T.MeshBasicMaterial({ vertexColors: true })));
      g.add(o);
    });
    // Sabri (or a cat in the cat room) so the room feels lived in
    const s = new T.Group(); s.name = 'resident';
    if (area === 'kedi') {
      const c = '#e8964a';
      const b = new T.Mesh(new T.SphereGeometry(0.22, 10, 8), lam(c)); b.scale.set(1.4, 0.9, 1); b.position.y = 0.2; s.add(b);
      const h = new T.Mesh(new T.SphereGeometry(0.15, 10, 8), lam(c)); h.position.set(0.3, 0.38, 0); s.add(h);
      [-0.07, 0.07].forEach(z => { const e = new T.Mesh(new T.ConeGeometry(0.05, 0.1, 4), lam(c)); e.position.set(0.32, 0.54, z); s.add(e); });
      s.position.set(-0.2, 0, 1.1);
    } else {
      const body = new T.Mesh(new T.CylinderGeometry(0.2, 0.24, 0.7, 10), lam('#fbfaf6')); body.position.y = 0.55; s.add(body);
      const apron = new T.Mesh(new T.BoxGeometry(0.3, 0.4, 0.05), lam('#e0533c')); apron.position.set(0, 0.5, 0.22); s.add(apron);
      const head = new T.Mesh(new T.SphereGeometry(0.2, 12, 10), lam('#f1c9a0')); head.position.y = 1.08; s.add(head);
      const mus = new T.Mesh(new T.BoxGeometry(0.18, 0.04, 0.04), lam('#3a2a20')); mus.position.set(0, 1.03, 0.19); s.add(mus);
      const cap = new T.Mesh(new T.CylinderGeometry(0.2, 0.21, 0.08, 12), lam('#2b3a55')); cap.position.y = 1.25; s.add(cap);
      [-0.1, 0.1].forEach(x => { const l = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.25, 6), lam('#2b3a55')); l.position.set(x, 0.12, 0); s.add(l); });
      s.position.set(-0.4, 0, 1.1);
    }
    g.add(s);
    return g;
  }

  function renderUi(m: M): void {
    if (!el) return;
    const e = m.ev as M, area = String(e.area);
    const ar = (e.areas as M[]).find(a => a.id === area) || e.areas[0];
    (el.querySelector('.ev-sub') as HTMLElement).textContent = `Dinlenme ${e.rest} · sabah hızı +%${e.boost} (en fazla %${e.cap})`;
    (el.querySelector('.ev-areas') as HTMLElement).innerHTML = (e.areas as M[]).map(a => a.open
      ? `<button class="ev-ar${a.id === area ? ' on' : ''}" data-ev="evArea|${a.id}">${esc(a.name)}</button>`
      : `<button class="ev-ar lock${Number((deps.rules()?.state as M)?.money) < a.price ? ' off' : ''}" data-ev="evBuyArea|${a.id}">${esc(a.name)}<br><small>Aç: ${fmt(a.price)}</small></button>`).join('');
    let s = `<div class="ev-h"><span>${esc(ar.name)}</span><span>${ar.items.length} / ${ar.slots} eşya</span></div>`;
    s += `<div class="ev-placed">${(ar.items as string[]).map((n, i) => `<button class="ev-pl" data-ev="evRemove|${area}|${i}">${esc(n)} ✕</button>`).join('') || '<span style="font:700 15px/1.3 var(--body,system-ui);color:#33373b">Burası bomboş. Aşağıdan bir eşya seç!</span>'}</div>`;
    if (area === 'oda') s += `<div class="ev-h"><span>Tema odası</span></div><div class="ev-th">${(e.themes as M[]).map(t => `<button class="ev-pl${t.id === e.theme ? '" style="background:#ffd23f' : ''}" data-ev="evTheme|${t.id}">${esc(t.name)}</button>`).join('')}</div>`;
    s += `<div class="ev-h"><span>Eşyalar</span><span>Her eşya dinlenme puanı verir</span></div><div class="ev-items">`;
    const money = Number((deps.rules()?.state as M)?.money) || 0, gold = Number((deps.rules()?.state as M)?.gold) || 0;
    for (const it of e.items as M[]) {
      const fits = it.area === '*' || it.area === area;
      const free = it.owned - it.placed;
      let b: string;
      if (free > 0) b = `<button class="ev-b${fits && ar.items.length < ar.slots ? '' : ' off'}" data-ev="evPlace|${it.id}">Buraya koy</button>`;
      else if (it.gold) b = `<button class="ev-b${gold < it.gold ? ' off' : ''}" data-ev="evBuy|${it.id}">Al · ${it.gold} Altın Simit</button>`;
      else b = `<button class="ev-b${money < it.price ? ' off' : ''}" data-ev="evBuy|${it.id}">${it.owned ? 'Bir tane daha' : 'Al'} · ${fmt(it.price)}</button>`;
      s += `<div class="ev-it"><b>${esc(it.name)}</b><span>${esc(it.desc)}</span><span>Dinlenme +${it.rest} · ${esc(it.areaName)}${it.owned ? ' · sende ' + it.owned : ''}</span>${b}</div>`;
    }
    s += '</div>';
    (el.querySelector('.ev-bot') as HTMLElement).innerHTML = s;
    const lines = [ar.desc, 'Sabri: "Bir çay demleyip şuraya uzanayım, beş dakikacık..."', 'Aşağıdan martı sesi geliyor. Büfe emin ellerde, değil mi?'];
    (el.querySelector('.ev-say') as HTMLElement).textContent = lines[lineI % lines.length];
  }

  return {
    isOpen: () => !!el,
    update(dt) {
      const a = api();
      const want = !!a && a.evOpen;
      if (want && !el) open();
      if (!want && el) close();
      if (!el || !a) return;
      t += dt;
      const m = a.model() as M, e = m.ev as M;
      const area = String(e.area), ar = (e.areas as M[]).find(x => x.id === area);
      const placed: string[] = (a.ev().placed[area] || []).slice();
      const th = HOME_THEMES.find(x => x.id === e.theme);
      const rk = area + '|' + placed.join(',') + '|' + (th ? th.wall : '');
      if (rk !== roomKey && scene) {
        roomKey = rk;
        if (room) { scene.remove(room); disposeGroup(room); }
        room = buildRoom(area, placed, th ? th.wall : ''); scene.add(room);
        scene.background = new T.Color(OPEN_AIR.has(area) ? (area === 'teras' ? '#1d2b4a' : '#9fd3f5') : '#2b3a55');
        lineI++;
      }
      const uk = JSON.stringify([e, (deps.rules()?.state as M)?.money, ar && ar.items]);
      if (uk !== uiKey) { uiKey = uk; renderUi(m); }
      if (renderer && scene && cam) {
        const cv = renderer.domElement, w = cv.clientWidth || 1, h = cv.clientHeight || 1;
        if (cv.width !== Math.round(w * renderer.getPixelRatio()) || cv.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false);
        const asp = w / h, vh = Math.max(3.2, 6.4 / asp) / 2 + 0.3;
        cam.left = -vh * asp; cam.right = vh * asp; cam.top = vh; cam.bottom = -vh; cam.updateProjectionMatrix();
        const sw = Math.sin(t * 0.25) * 0.6;
        cam.position.set(7 + sw, 6.5, 8 - sw); cam.lookAt(0, 0.9, 0);
        const res = room?.getObjectByName('resident');
        if (res) res.position.y = Math.abs(Math.sin(t * 2.2)) * 0.04;
        renderer.render(scene, cam);
      }
    },
    dispose() { close(); },
  };
}
