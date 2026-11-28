// Karakter Atölyesi (2026-11-21, kulis baştan): the character creator behind the theatre stage.
// Flow: a new character first picks a body (Erkek / Kadın, both shown side by side on the stage), then edits it.
// Every option list is shaped by that body (content/karakter-katalog.ts): beards and mustaches only on the male body,
// makeup tab only on the female body, dresses/skirts only female; hair shows the body's own styles first.
// Hair, beard and mustache tiles carry real 3D thumbnails of the player's own head (rendered one per frame into a corner
// of the stage canvas, copied out, cached). The camera keeps the hero centred in the free part of the screen
// (setViewOffset), so the panel never covers the character: right card on wide screens, bottom sheet on phones,
// right half on a landscape phone. Undo/redo, a body-aware "Rastgele", near/far camera, drag to turn, wheel/pinch zoom.
// Every change sends { kind: 'esnafim', op: 'set' }; "Sahneye çık" sends op 'done' (name chosen once, never empty).
import * as T from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { createLookRenderer, LOOK_POZ } from '../../engine/render/look';
import type { Rules } from '../sim/state';
import { SINIFLAR, esnafHeroOpts, type EsnafimSave } from '../sim/esnafim';
import { YETENEK } from '../sim/yetenek';
import { KIYAFET_URUNLER, KIYAFET_ZINCIRLER } from '../../content/kiyafet';
import { AVM_GIY, AVM_BY_ID } from '../../content/avm';
import {
  SAC, SAKAL, BIYIK, UST, ALT, KOL, DESEN, SAPKA, GOZLUK, GOZ, KAS, EYELINER, BEN, YAS, IFADE_SEC, PALET,
  bedenSec, uygun, rastgeleGorunum, type Beden, type Secenek,
} from '../../content/karakter-katalog';

export interface KulisView { update(dt: number): void; readonly open: boolean }
interface HeroLike { object: T.Object3D; setPose(p: { x: number; z: number }, r: number): void; setInput(i: Record<string, unknown>): void; update(dt: number, a: number): void; dispose(): void }

type Cat = 'kimlik' | 'yuz' | 'sac' | 'sakal' | 'makyaj' | 'kiyafet' | 'aksesuar' | 'vucut' | 'dolap';
const SV = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC: Record<string, string> = {
  kimlik: SV('<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16.2c.7-1.6 1.9-2.4 3.2-2.4s2.5.8 3.2 2.4M14.5 10h4M14.5 13.5h3"/>'),
  yuz: SV('<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="10.5" r=".9" fill="currentColor"/><circle cx="15" cy="10.5" r=".9" fill="currentColor"/><path d="M8.8 14.6c1.8 1.6 4.6 1.6 6.4 0"/>'),
  sac: SV('<path d="M4.5 13c0-5 3.3-8.5 7.5-8.5s7.5 3.5 7.5 8.5"/><path d="M4.5 13c1.8-1 3.2-3 3.9-5.3M19.5 13c-2.7-.9-5.3-3.3-6.6-6.6"/><path d="M4.5 13v5M19.5 13v5"/>'),
  sakal: SV('<path d="M6 9c0 6 2.7 10 6 10s6-4 6-10"/><path d="M8 12.2c1.4-1 2.6-1 4 0 1.4-1 2.6-1 4 0"/><path d="M10 16h4"/>'),
  makyaj: SV('<path d="M9 21v-6.5h6V21z"/><path d="M10 14.5V9.2l4-2.7v8"/><path d="M10.2 9.2l3.8-2.6"/>'),
  kiyafet: SV('<path d="M8.5 4.5L4 7.3l1.8 3.7 2-1V20h8.4v-10l2 1L20 7.3l-4.5-2.8c-.6 1.6-2 2.5-3.5 2.5s-2.9-.9-3.5-2.5z"/>'),
  aksesuar: SV('<path d="M4 16.5c2.5 1.4 13.5 1.4 16 0"/><path d="M6.5 16c.2-4.6 2.2-8.5 5.5-8.5s5.3 3.9 5.5 8.5"/><path d="M7 13.2c3 .9 7 .9 10 0"/>'),
  vucut: SV('<circle cx="12" cy="4.8" r="2.2"/><path d="M12 7.5v7M7.5 10.5l4.5-1.6 4.5 1.6M12 14.5l-3 6M12 14.5l3 6"/>'),
  dolap: SV('<path d="M12 6.5a1.8 1.8 0 1 1 1.8 1.8c-.8 0-1.8.6-1.8 1.6v.6"/><path d="M12 10.5L3.5 16.5c-.7.5-.4 1.5.5 1.5h16c.9 0 1.2-1 .5-1.5z"/>'),
  rnd: SV('<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.1" fill="currentColor"/><circle cx="15" cy="15" r="1.1" fill="currentColor"/><circle cx="15" cy="9" r="1.1" fill="currentColor"/><circle cx="9" cy="15" r="1.1" fill="currentColor"/>'),
  undo: SV('<path d="M9 7L4.5 11.5 9 16"/><path d="M5 11.5h9.5a5 5 0 0 1 0 10H12"/>'),
  redo: SV('<path d="M15 7l4.5 4.5L15 16"/><path d="M19 11.5H9.5a5 5 0 0 0 0 10H12"/>'),
  near: SV('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M8.5 11h5M11 8.5v5"/>'),
  far: SV('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M8.5 11h5"/>'),
  lock: SV('<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
};
const CAT_AD: Record<Cat, string> = { kimlik: 'Kimlik', yuz: 'Yüz', sac: 'Saç', sakal: 'Sakal', makyaj: 'Makyaj', kiyafet: 'Kıyafet', aksesuar: 'Aksesuar', vucut: 'Vücut', dolap: 'Dolap' };
const CAT_SUB: Record<Cat, string> = {
  kimlik: 'Adın, dükkanın ve sınıfın.', yuz: 'Ten, yaş, gözler, kaşlar, burun, ağız.', sac: 'Stilini seç, rengini ver.', sakal: 'Sakal, bıyık ve rengi.',
  makyaj: 'Ruj, far, eyeliner, kirpik, allık.', kiyafet: 'Üst, alt, ayakkabı, renkler.', aksesuar: 'Şapka, gözlük, takılar.', vucut: 'Yapın ve boyun.', dolap: 'Satın aldığın kıyafetler.',
};
/** near = face framing; categories that change the head start near */
const NEAR: Record<Cat, boolean> = { kimlik: false, yuz: true, sac: true, sakal: true, makyaj: true, kiyafet: false, aksesuar: true, vucut: false, dolap: false };

const CSS = `
.ka-c{position:fixed;inset:0;z-index:60;width:100%;height:100%;display:block;touch-action:none;cursor:grab;pointer-events:auto}
.ka-c:active{cursor:grabbing}
.ka{--ink:#2c1f18;--paper:#fbf3e4;--card:#fffaf2;--line:#ead9bf;--mut:#8a6c55;--acc:#e0533c;--acc2:#c9442f;--sel:#ffd23f;font-family:var(--body);color:var(--ink)}
.ka-p{position:fixed;z-index:62;right:14px;top:14px;bottom:14px;width:min(468px,calc(100vw - 28px));display:flex;background:var(--paper);border:3px solid var(--ink);border-radius:24px;box-shadow:0 6px 0 var(--ink);overflow:hidden;pointer-events:auto}
.ka-rail{flex:0 0 76px;display:flex;flex-direction:column;gap:4px;padding:10px 7px;background:var(--ink);overflow-y:auto;scrollbar-width:none}
.ka-rail::-webkit-scrollbar{display:none}
.ka-r{display:flex;flex-direction:column;align-items:center;gap:3px;min-height:58px;padding:7px 2px 6px;border:0;border-radius:14px;background:transparent;color:#e9d9c2;font:800 11.5px/1.1 var(--body);cursor:pointer;letter-spacing:.01em}
.ka-r svg{width:24px;height:24px}
.ka-r:hover{background:rgba(255,246,230,.08)}
.ka-r.on{background:var(--paper);color:var(--ink)}
.ka-main{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}
.ka-hd{padding:16px 18px 8px}
.ka-h{font:900 24px/1.05 var(--disp);margin:0;letter-spacing:-.01em}
.ka-sub{font:600 13.5px/1.35 var(--body);color:var(--mut);margin:3px 0 0}
.ka-b{flex:1;min-height:0;overflow-y:auto;padding:2px 18px 14px;overscroll-behavior:contain}
.ka-l{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font:800 12px/1.2 var(--body);text-transform:uppercase;letter-spacing:.08em;color:var(--mut);margin:16px 0 8px}
.ka-l small{font:700 12px var(--body);text-transform:none;letter-spacing:0;color:var(--mut);opacity:.85}
.ka-row{display:flex;flex-wrap:wrap;gap:7px}
.ka-ch{min-height:40px;padding:6px 13px;border-radius:12px;border:2px solid var(--line);background:var(--card);font:800 14.5px/1.1 var(--body);color:var(--ink);cursor:pointer;transition:background .12s,border-color .12s}
.ka-ch:hover{border-color:#cdb595}
.ka-ch.on{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.ka-sw{width:34px;height:34px;border-radius:50%;border:2px solid rgba(44,31,24,.25);cursor:pointer;padding:0;position:relative}
.ka-sw.on{box-shadow:0 0 0 3px var(--paper),0 0 0 6px var(--ink)}
.ka-sw.no{background:repeating-linear-gradient(45deg,#fff,#fff 4px,#efe2cc 4px,#efe2cc 8px)}
.ka-sw.same{background:conic-gradient(var(--hc) 0 50%,#fff 50% 100%)}
.ka-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:8px}
.ka-tile{position:relative;display:flex;flex-direction:column;align-items:stretch;gap:4px;padding:5px 5px 7px;border-radius:16px;border:2px solid var(--line);background:var(--card);cursor:pointer;font:800 12.5px/1.15 var(--body);color:var(--ink);text-align:center}
.ka-tile img{display:block;width:100%;aspect-ratio:1;border-radius:11px;background:#efe2cc;object-fit:cover}
.ka-tile img:not([src]){background:linear-gradient(100deg,#efe2cc 30%,#f7ecdb 50%,#efe2cc 70%);background-size:200% 100%;animation:kaSh 1.1s linear infinite}
@keyframes kaSh{to{background-position:-200% 0}}
.ka-tile.on{border-color:var(--acc);box-shadow:0 0 0 2px var(--acc)}
.ka-tile i{position:absolute;top:8px;left:8px;font:900 10px/1 var(--body);font-style:normal;background:var(--acc);color:#fff;border-radius:6px;padding:3px 5px;letter-spacing:.04em}
.ka-more{margin-top:10px;width:100%;min-height:40px;border-radius:12px;border:2px dashed #cdb595;background:transparent;font:800 13.5px var(--body);color:var(--mut);cursor:pointer}
.ka-in{width:100%;box-sizing:border-box;min-height:48px;border:2px solid var(--ink);border-radius:14px;padding:6px 14px;font:800 17px var(--body);background:#fff;color:var(--ink)}
.ka-in:focus{outline:3px solid var(--sel);outline-offset:1px}
.ka-in[readonly]{background:#f3e8d6;color:#6b5442}
.ka-cls{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ka-cl{text-align:left;padding:10px 11px;border-radius:16px;border:2px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;font:900 16px/1.15 var(--disp)}
.ka-cl.on{border-color:var(--ink);background:#fff3c4;box-shadow:0 3px 0 var(--ink)}
.ka-cl i{font-style:normal;font-size:22px;display:block;margin-bottom:2px}
.ka-cl small{display:block;font:600 12.5px/1.3 var(--body);color:#5f4a3b;margin-top:3px}
.ka-cl b{display:block;font:800 12.5px/1.25 var(--body);color:#2e7d32;margin-top:5px}
.ka-cl em{display:block;font:800 12.5px/1.25 var(--body);font-style:normal;color:#7d3c98;margin-top:2px}
.ka-cl u{display:inline-block;margin-top:7px;text-decoration:none;font:800 12px var(--body);padding:4px 8px;border-radius:9px;background:var(--ink);color:var(--paper)}
.ka-rng{width:100%;accent-color:var(--acc);height:28px}
.ka-note{font:600 13px/1.4 var(--body);color:var(--mut);margin:6px 0 0}
.ka-ft{padding:10px 18px 16px;border-top:2px solid var(--line);background:var(--paper)}
.ka-st{font:700 13px/1.3 var(--body);text-align:center;margin:0 0 8px;color:var(--mut)}.ka-st.bad{color:#b3261e}
.ka-go{width:100%;min-height:56px;border-radius:16px;border:3px solid var(--ink);background:var(--acc);box-shadow:0 4px 0 var(--ink);font:900 20px/1 var(--disp);color:#fff;cursor:pointer;letter-spacing:.01em}
.ka-go:active{transform:translateY(3px);box-shadow:0 1px 0 var(--ink)}
.ka-tools{position:fixed;z-index:62;display:flex;gap:8px;pointer-events:auto}
.ka-tb{width:48px;height:48px;border-radius:50%;border:0;background:rgba(28,18,14,.74);color:#fbf3e4;display:grid;place-items:center;cursor:pointer;backdrop-filter:blur(6px)}
.ka-tb svg{width:24px;height:24px}.ka-tb:disabled{opacity:.35;cursor:default}
.ka-tools.col{flex-direction:column;gap:7px}.ka-tools.col .ka-tb.wide{width:44px;padding:0;border-radius:50%;justify-content:center}.ka-tools.col .ka-tb.wide span{display:none}
.ka-tb.wide{width:auto;padding:0 16px 0 12px;border-radius:24px;display:flex;gap:7px;align-items:center;font:800 15px var(--body)}
.ka-tag{position:fixed;z-index:62;left:16px;top:14px;padding:9px 15px 10px;border-radius:16px;background:rgba(28,18,14,.74);color:#fff1d6;font:900 19px/1.15 var(--disp);pointer-events:none;backdrop-filter:blur(6px);max-width:44vw}
.ka-tag small{display:block;font:700 13px/1.3 var(--body);color:#e9cfae}
.ka-hint{position:fixed;z-index:61;font:700 12.5px var(--body);color:rgba(255,241,214,.75);pointer-events:none;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.ka-pick{position:fixed;z-index:62;left:0;right:0;bottom:0;padding:18px 16px max(20px,env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;gap:12px;background:linear-gradient(to top,rgba(20,12,10,.92),rgba(20,12,10,.6) 70%,rgba(20,12,10,0));pointer-events:auto}
.ka-pick h2{margin:0;font:900 30px/1.05 var(--disp);color:#fff1d6;text-align:center}
.ka-pick p{margin:0;font:600 14.5px/1.4 var(--body);color:#ecd6b8;text-align:center;max-width:520px}
.ka-pk{display:flex;gap:12px;width:min(560px,100%)}
.ka-pb{flex:1;min-height:64px;border-radius:18px;border:3px solid var(--ink);background:var(--paper);box-shadow:0 5px 0 var(--ink);font:900 22px/1 var(--disp);color:var(--ink);cursor:pointer}
.ka-pb small{display:block;font:700 12.5px/1.2 var(--body);color:var(--mut);margin-top:4px}
.ka-pb:hover{background:#fff3c4}
@media (max-width:760px){
  .ka-p{left:0;right:0;bottom:0;top:auto;width:auto;height:56vh;height:56dvh;border-radius:22px 22px 0 0;border-width:3px 0 0;box-shadow:0 -4px 18px rgba(0,0,0,.25);flex-direction:column}
  .ka-rail{flex:0 0 auto;flex-direction:row;padding:7px 8px;gap:3px;overflow-x:auto;overflow-y:hidden}
  .ka-r{flex:0 0 auto;min-height:0;flex-direction:row;gap:6px;padding:9px 12px;font-size:13.5px;border-radius:12px}
  .ka-r svg{width:19px;height:19px}
  .ka-hd{padding:10px 14px 2px}.ka-h{font-size:19px}.ka-sub{display:none}
  .ka-b{padding:0 14px 10px}.ka-l{margin:12px 0 7px}
  .ka-grid{grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:7px}
  .ka-ft{padding:8px 14px max(10px,env(safe-area-inset-bottom));display:flex;gap:10px;align-items:center}.ka-st{display:none}.ka-st.bad{display:block;position:absolute;bottom:calc(100% + 6px);left:14px;right:14px;background:#fff;border-radius:10px;padding:6px;margin:0}
  .ka-go{min-height:50px;font-size:18px}
  .ka-tag{font-size:16px;padding:7px 12px;max-width:62vw}.ka-tag small{font-size:12px}
  .ka-tb{width:44px;height:44px}
  .ka-pick h2{font-size:25px}.ka-pb{min-height:58px;font-size:20px}
}
@media (orientation:landscape) and (max-height:520px){
  .ka-p{left:auto;right:8px;top:8px;bottom:8px;height:auto;width:min(440px,54vw);border-radius:20px;border-width:3px;flex-direction:row}
  .ka-rail{flex:0 0 60px;flex-direction:column;overflow-y:auto;overflow-x:hidden;padding:6px 5px}
  .ka-r{flex-direction:column;padding:6px 2px;font-size:10.5px;min-height:48px}.ka-r svg{width:20px;height:20px}
  .ka-hd{padding:8px 12px 0}.ka-h{font-size:17px}.ka-sub{display:none}.ka-b{padding:0 12px 8px}
  .ka-ft{padding:6px 12px 8px;display:block}.ka-st{display:none}.ka-go{min-height:44px;font-size:17px}
  .ka-tag{top:8px;left:8px;font-size:15px}
  .ka-pick{padding-top:8px}.ka-pick h2{font-size:22px}.ka-pick p{display:none}.ka-pb{min-height:50px}
}
body:has(.ka-p) #sbui .sb-bar,body:has(.ka-pick) #sbui .sb-bar{pointer-events:none;opacity:0}
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
  const mirror = new Reflector(new T.PlaneGeometry(1.2, 1.3), { textureWidth: lowGpu ? 512 : 1024, textureHeight: lowGpu ? 512 : 1024, color: new T.Color('#c9d6dc'), clipBias: 0.003, multisample: 0 });   // MSAA x4 half-float at 1024² was 48 MB of renderbuffer for a 1.2 m mirror; the sampled texture needs none
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

/** body-specific starting points when a body is picked (keeps everything else the player already chose) */
/** "Ali" -> "Ali'nin Büfesi", "Mehmet" -> "Mehmet'in Büfesi", "Can" -> "Can'ın Büfesi" (ünlü uyumu + kaynaştırma n) */
export function otoDukkan(ad: string): string {
  const a = ad.trim(); if (!a) return '';
  const k = a.toLocaleLowerCase('tr'), v = [...k].reverse().find(c => 'aeıioöuü'.includes(c)) || 'e';
  const u = 'aı'.includes(v) ? 'ı' : 'ei'.includes(v) ? 'i' : 'ou'.includes(v) ? 'u' : 'ü';
  return a + "'" + ('aeıioöuü'.includes(k[k.length - 1]) ? 'n' + u + 'n' : u + 'n') + ' Büfesi';
}
function bedenBaslangic(m: EsnafimSave, tip: Beden): Partial<EsnafimSave> {
  const d: Record<string, unknown> = { tip };
  const sac = SAC.find(s => s.id === m.sac);
  if (!sac || !uygun(sac, tip)) d.sac = tip === 'b' ? 'long' : 'short';
  if (tip === 'b') { d.sakalStil = 'yok'; d.biyik = 'yok'; d.kupe = true; if (m.allik < 0.2) d.allik = 0.3; }
  else { if (m.ustStil === 'dress') d.ustStil = 'tee'; if (m.altStil === 'skirt') d.altStil = 'pants'; d.ruj = null; d.far = null; d.eyeliner = 'yok'; d.kirpik = false; if (m.allik > 0.2) d.allik = 0.15; }
  return d as Partial<EsnafimSave>;
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
  let step: 'beden' | 'edit' = 'edit', cat: Cat = 'kimlik', allHair = false, near = false, nameErr = false;
  let canvas: HTMLCanvasElement | null = null, ui: HTMLDivElement | null = null, panel: HTMLDivElement | null = null, tools: HTMLDivElement | null = null, tag: HTMLDivElement | null = null, pick: HTMLDivElement | null = null, hint: HTMLDivElement | null = null;
  let R: T.WebGLRenderer | null = null, scene: T.Scene | null = null, cam: T.PerspectiveCamera | null = null;
  let hero: HeroLike | null = null, heroKey = '', duo: HeroLike[] = [], duoKey = '', t = 0;
  let spin = 0, zoom = 1, drag: { x: number; s: number } | null = null, pinch: { d: number; z: number } | null = null;
  const pointers = new Map<number, { x: number; y: number }>();
  const camP = new T.Vector3(0, 1.4, 5), camA = new T.Vector3(0, 1, 0.4);
  const undo: string[] = [], redo: string[] = [];
  // 3D thumbnails: rendered into the stage canvas corner before the frame, copied out, cached by look
  const thumbs = new Map<string, string>(), queue: { key: string; opts: Record<string, unknown>; mode: 'sac' | 'yuz' }[] = [];
  let thumbScene: T.Scene | null = null, thumbCam: T.PerspectiveCamera | null = null, thumbCv: HTMLCanvasElement | null = null;

  const tap = () => { try { deps.sfx?.('tik'); } catch { /* */ } };
  const snap = () => { const c = { ...m } as Record<string, unknown>; delete c.ad; delete c.dukkan; return JSON.stringify(c); };
  const sync = () => {   // the sim validated the change (body rules, ranges): take its record back, keep the typed name
    const w = deps.rules()?.rt.uiLast.esnafim as EsnafimSave | undefined;
    if (w && m) m = { ...w, ad: m.ad, dukkan: m.dukkan };
  };
  const set = (data: Record<string, unknown>, opt: { noUndo?: boolean } = {}) => {
    if (!m) return;
    if (!opt.noUndo) { undo.push(snap()); if (undo.length > 60) undo.shift(); redo.length = 0; }
    Object.assign(m, data); deps.command({ kind: 'esnafim', op: 'set', data }); sync(); tap(); paint();
  };
  const restore = (from: string[], to: string[]) => {
    if (!m || !from.length) return;
    to.push(snap()); const d = JSON.parse(from.pop()!) as Record<string, unknown>;
    Object.assign(m, d); deps.command({ kind: 'esnafim', op: 'set', data: d }); sync(); tap(); paint();
  };

  const worn = () => (deps.worn ? deps.worn() : {});
  function rebuildHero() {
    if (!m || !scene || !deps.chars || step !== 'edit') return;
    const w = worn(), key = JSON.stringify(m) + JSON.stringify(w);
    if (key === heroKey && hero) return; heroKey = key;
    if (hero) hero.dispose();
    try { hero = deps.chars.makeHero(esnafHeroOpts(m, w) as never) as HeroLike; scene.add(hero.object); hero.object.visible = true; } catch { hero = null; }
  }
  function rebuildDuo() {
    if (!m || !scene || !deps.chars || step !== 'beden') return;
    const key = JSON.stringify(m); if (key === duoKey && duo.length) return; duoKey = key;
    duo.forEach(h => h.dispose()); duo = [];
    for (const tip of ['a', 'b'] as Beden[]) {
      try { const h = deps.chars.makeHero(esnafHeroOpts({ ...m, ...bedenBaslangic(m, tip), ad: '' }, {}) as never) as HeroLike; scene.add(h.object); duo.push(h); } catch { /* */ }
    }
  }

  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]);
  const sw = (key: string, list: string[], cur: unknown, opt: { none?: boolean; same?: string; vals?: (string | number)[] } = {}) =>
    `<div class="ka-row">${opt.same ? `<button class="ka-sw same${cur == null ? ' on' : ''}" style="--hc:${opt.same}" data-k="${key}" data-null="1" aria-label="saçla aynı" title="Saçla aynı"></button>` : ''}${opt.none ? `<button class="ka-sw no${cur == null || cur === '' ? ' on' : ''}" data-k="${key}" data-null="1" aria-label="yok" title="Yok"></button>` : ''}${list.map((c, i) => { const v = opt.vals ? opt.vals[i] : c; return `<button class="ka-sw${String(v) === String(cur) ? ' on' : ''}" style="background:${c}" data-k="${key}" data-v="${v}" aria-label="${key} ${i + 1}"></button>`; }).join('')}</div>`;
  const ch = (key: string, list: Secenek[] | [string, string][], cur: unknown) => `<div class="ka-row">${(list as (Secenek | [string, string])[]).map(x => { const [v, l] = Array.isArray(x) ? x : [x.id, x.ad]; return `<button class="ka-ch${v === String(cur ?? '') ? ' on' : ''}" data-k="${key}" data-v="${v}">${esc(l)}</button>`; }).join('')}</div>`;
  const tog = (key: string, on: boolean, l: string) => `<button class="ka-ch${on ? ' on' : ''}" data-k="${key}" data-v="${on ? '0' : '1'}" data-bool="1">${l}</button>`;
  const L = (t: string, small = '') => `<div class="ka-l">${t}${small ? `<small>${small}</small>` : ''}</div>`;

  /** tiles with 3D thumbnails of the player's own head */
  function tiles(key: 'sac' | 'sakalStil' | 'biyik', list: Secenek[], cur: string) {
    if (!m) return '';
    return `<div class="ka-grid">${list.map(s => {
      const mod: Partial<EsnafimSave> = key === 'sac' ? { sac: s.id, sapka: null } : key === 'sakalStil' ? { sakalStil: s.id as EsnafimSave['sakalStil'] } : { biyik: s.id as EsnafimSave['biyik'] };
      const look = { ...m!, ...mod, gozluk: null, onluk: null };
      const tk = `${key}|${s.id}|${look.tip}|${look.ten}|${look.sacRenk}|${look.sakalRenk || ''}|${look.vucut}|${look.boy}|${key === 'sac' ? '' : look.sac + look.sakalStil + look.biyik}`;
      const src = thumbs.get(tk);
      if (!src && !queue.some(q => q.key === tk)) queue.push({ key: tk, opts: esnafHeroOpts({ ...look, ad: '' }, {}), mode: key === 'sac' ? 'sac' : 'yuz' });
      return `<button class="ka-tile${s.id === cur ? ' on' : ''}" data-k="${key}" data-v="${s.id}" aria-label="${esc(s.ad)}">${s.yeni ? '<i>YENİ</i>' : ''}<img alt="" data-thumb="${esc(tk)}"${src ? ` src="${src}"` : ''}><span>${esc(s.ad)}</span></button>`;
    }).join('')}</div>`;
  }

  const cats = (): Cat[] => (m?.tip === 'b' ? ['kimlik', 'yuz', 'sac', 'makyaj', 'kiyafet', 'aksesuar', 'vucut', 'dolap'] : ['kimlik', 'yuz', 'sac', 'sakal', 'kiyafet', 'aksesuar', 'vucut', 'dolap']);

  function body(e: EsnafimSave): string {
    const tip = e.tip as Beden;
    switch (cat) {
      case 'kimlik': return `${L('Adın', e.adKilit ? 'bir kez seçildi, değişmez' : 'bir kez seçilir, sonra değişmez')}<input class="ka-in" name="ad" maxlength="14" value="${esc(e.ad)}" placeholder="Adını yaz" autocomplete="off"${e.adKilit ? ' readonly' : ''}>
${L('Dükkânının adı')}<input class="ka-in" name="dukkan" maxlength="22" value="${esc(e.dukkan)}" autocomplete="off">
${L('Beden', tip === 'b' ? 'Kadın' : 'Erkek')}<div class="ka-row"><button class="ka-ch" data-beden="1">Bedeni değiştir</button></div>
${L('Sınıfın', 'her şeyi yaparsın, sınıfın en iyi olduğun iş')}
<div class="ka-cls">${SINIFLAR.map(s => `<button class="ka-cl${s.id === e.sinif ? ' on' : ''}" data-sinif="${s.id}"><i>${s.icon}</i>${s.ad}<small>${s.desc}</small><b>${s.perk}</b><em>${YETENEK[s.id].icon} ${YETENEK[s.id].ad}</em>${s.id === e.sinif ? `<u data-kit="${s.id}">Sınıf kıyafetini giy</u>` : ''}</button>`).join('')}</div>`;
      case 'yuz': return `${L('Ten')}${sw('ten', PALET.ten, e.ten, { vals: PALET.ten.map((_, i) => i) })}
${L('Yaş')}${ch('yas', YAS, e.yas || 'genc')}
${L('Göz şekli')}${ch('goz', GOZ, e.goz)}
${L('Göz rengi')}${sw('gozRenk', PALET.goz, e.gozRenk)}
${L('Göz aralığı')}${ch('gozAra', [['yakin', 'Yakın'], ['orta', 'Orta'], ['uzak', 'Ayrık']], e.gozAra || 'orta')}
${L('Göz hizası')}${ch('gozY', [['yukari', 'Yukarıda'], ['orta', 'Orta'], ['asagi', 'Aşağıda']], e.gozY || 'orta')}
${L('Kaşlar')}${ch('kas', KAS, e.kas)}
${L('Burun')}${ch('burun', [['kucuk', 'Minik'], ['orta', 'Orta'], ['iri', 'İri'], ['uzun', 'Uzun']], e.burun || 'orta')}
${L('Ağız')}${ch('agiz', [['dar', 'Dar'], ['orta', 'Orta'], ['genis', 'Geniş']], e.agiz || 'orta')}
${L('Kulak')}${ch('kulak', [['kucuk', 'Küçük'], ['orta', 'Orta'], ['kepce', 'Kepçe']], e.kulak || 'orta')}
${L('Ayrıntılar')}<div class="ka-row">${tog('cil', e.cil, 'Çiller')}${tog('gamze', e.gamze, 'Gamze')}</div>
${L('Ben')}${ch('ben', BEN, e.ben || 'yok')}
${L('Yüz ifadesi', 'dururken')}${ch('ifade', IFADE_SEC, e.ifade || 'notr')}`;
      case 'sac': {
        const own = bedenSec(SAC, tip), rest = SAC.filter(s => !uygun(s, tip));
        const list = allHair ? [...own, ...rest] : own;
        return `${L('Saç stili', allHair ? 'tüm stiller' : tip === 'b' ? 'kadın stilleri' : 'erkek stilleri')}${tiles('sac', list, e.sac)}
<button class="ka-more" data-allhair="1">${allHair ? 'Yalnız bedenime uygun stiller' : `Tüm stilleri göster (+${rest.length})`}</button>
${L('Saç rengi', 'doğal')}${sw('sacRenk', PALET.sacDogal, e.sacRenk)}
${L('Saç rengi', 'renkli')}${sw('sacRenk', PALET.sacRenkli, e.sacRenk)}
${e.sapka ? '<p class="ka-note">Şapka takılıyken saç onun altına toplanır. Saçın tamamını görmek için Aksesuar sekmesinden şapkayı çıkar.</p>' : ''}`;
      }
      case 'sakal': return `${L('Sakal')}${tiles('sakalStil', SAKAL, e.sakalStil || 'yok')}
${L('Bıyık')}${tiles('biyik', BIYIK, e.biyik)}
${L('Sakal ve bıyık rengi')}${sw('sakalRenk', PALET.sacDogal, e.sakalRenk ?? null, { same: e.sacRenk })}`;
      case 'makyaj': return `${L('Ruj')}${sw('ruj', PALET.ruj, e.ruj, { none: true })}
${L('Far')}${sw('far', PALET.far, e.far ?? null, { none: true })}
${L('Eyeliner')}${ch('eyeliner', EYELINER, e.eyeliner || 'yok')}
${L('Kirpik')}<div class="ka-row">${tog('kirpik', !!e.kirpik, 'Belirgin kirpik')}</div>
${L('Allık')}${ch('allik', [['0', 'Yok'], ['0.2', 'Hafif'], ['0.32', 'Orta'], ['0.45', 'Belirgin']], e.allik >= 0.4 ? '0.45' : e.allik >= 0.27 ? '0.32' : e.allik >= 0.1 ? '0.2' : '0')}
${L('Allık rengi')}${sw('allikRenk', PALET.allik, e.allikRenk || PALET.allik[0])}`;
      case 'kiyafet': return `${L('Üst')}${ch('ustStil', bedenSec(UST, tip), e.ustStil)}
${L('Kollar')}${ch('kol', KOL, e.kol || (/shirt|jacket|suit|cardigan|hoodie/.test(e.ustStil) ? 'long' : 'short'))}
${L('Üst rengi')}${sw('ust', PALET.kumas, e.ust)}
${L('İkinci renk', 'ceket, şerit, desen')}${sw('aksan', PALET.kumas, e.aksan, { none: true })}
${L('Desen')}${ch('desen', DESEN, String(e.desen))}
${L('Yelek')}${sw('yelek', PALET.kumas.slice(0, 16), e.yelek ?? null, { none: true })}
${L('Alt')}${ch('altStil', bedenSec(ALT, tip), e.altStil)}
${L('Alt rengi')}${sw('alt', PALET.kumas, e.alt)}
${L('Ayakkabı')}${sw('ayakkabi', PALET.ayakkabi, e.ayakkabi)}
${L('Önlük')}${sw('onluk', ['#e0533c', '#3fb5b0', '#2b2b30', '#d9822b', '#7d3c98', '#fbfbf8', '#3fa35a'], e.onluk, { none: true })}`;
      case 'aksesuar': return `${L('Şapka')}${ch('sapka', SAPKA, e.sapka || '')}
${e.sapka ? `${L('Şapka rengi')}${sw('sapkaRenk', PALET.kumas, e.sapkaRenk)}` : ''}
${L('Gözlük')}${ch('gozluk', GOZLUK, e.gozluk || '')}
${L('Papyon')}${sw('papyon', PALET.aksesuar, e.papyon, { none: true })}
${L('Kravat')}${sw('kravat', PALET.aksesuar, e.kravat, { none: true })}
${L('Takılar')}<div class="ka-row">${tog('kupe', e.kupe, 'Küpe')}${tog('kolye', !!e.kolye, 'Kolye')}</div>`;
      case 'vucut': return `${L('Yapı')}${ch('vucut', [['slim', 'İnce'], ['mid', 'Orta'], ['round', 'Tombul']], e.vucut)}
${L('Boy', Math.round(165 + (e.boy - 1) * 150) + ' cm')}<input class="ka-rng" type="range" name="boy" min="0.9" max="1.1" step="0.01" value="${e.boy}" aria-label="Boy">`;
      case 'dolap': {
        const dz = deps.dolap ? deps.dolap() : { owned: [], worn: {}, gold: 0 };
        const SL: Record<string, string> = { ust: 'Üst', alt: 'Alt', ayakkabi: 'Ayakkabı', aksesuar: 'Aksesuar', sapka: 'Şapka', kostum: 'Kostüm' };
        const avm = (deps.avm ? deps.avm() : []).filter(id => AVM_GIY[id]);
        return `${avm.length ? `${L("Martı AVM'den aldıkların")}<div class="ka-row">${avm.map(id => `<button class="ka-ch" data-avm="${id}">${AVM_BY_ID[id].ikon} ${esc(AVM_BY_ID[id].ad)} · Giy</button>`).join('')}</div>` : '<p class="ka-note">Martı AVM\'den aldığın kıyafetler burada giyilir.</p>'}
<p class="ka-note">Markalı kıyafetler Altın Simitle alınır. Giydiğin parça, aynı yerdeki gardrop parçasının yerine geçer. Kasanda ${dz.gold} Altın Simit var.</p>
${KIYAFET_ZINCIRLER.map(z => `${L(esc(z.name), esc(z.tagline))}<div class="ka-row">${KIYAFET_URUNLER.filter(u => u.zincir === z.id).map(u => {
          const own = dz.owned.includes(u.id), wornIt = dz.worn[u.slot] === u.id;
          return `<button class="ka-ch${wornIt ? ' on' : ''}" data-ky="${own ? (wornIt ? 'take' : 'wear') : 'buy'}" data-id="${u.id}" ${!own && dz.gold < u.gold ? 'style="opacity:.55"' : ''}><span style="display:inline-block;width:13px;height:13px;border-radius:50%;border:2px solid currentColor;vertical-align:-2px;background:${u.colors[0]}"></span> ${esc(u.name)} <small style="font:700 12px var(--body);opacity:.8">${SL[u.slot] || ''} · ${own ? (wornIt ? 'giyili' : 'giy') : u.gold + ' 🥯'}</small></button>`;
        }).join('')}</div>`).join('')}`;
      }
    }
  }

  function paintTag() {
    if (!tag || !m) return;
    const sn = SINIFLAR.find(s => s.id === m!.sinif);
    tag.innerHTML = step === 'beden' ? 'Karakter Atölyesi<small>Önce bedenini seç</small>' : `${esc(m.ad.trim() || 'Adsız esnaf')}<small>${m.tip === 'b' ? 'Kadın' : 'Erkek'} · ${esc(sn?.ad || '')}</small>`;
  }
  function paint() {
    if (!m || !ui) return;
    paintTag();
    if (step === 'beden') {
      panel?.remove(); panel = null; tools && (tools.style.display = 'none'); hint && (hint.style.display = 'none');
      if (!pick) {
        pick = document.createElement('div'); pick.className = 'ka-pick';
        pick.innerHTML = `<h2>Kim olacaksın?</h2><p>Bedenini seç. Saç, sakal, makyaj ve kıyafet seçenekleri ona göre gelir. İstersen sonra Kimlik sekmesinden değiştirirsin.</p>
<div class="ka-pk"><button class="ka-pb" data-tip="a">Erkek<small>soldaki</small></button><button class="ka-pb" data-tip="b">Kadın<small>sağdaki</small></button></div>`;
        ui.appendChild(pick);
        pick.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (b?.dataset.tip) chooseBody(b.dataset.tip as Beden); });
      }
      return;
    }
    pick?.remove(); pick = null;
    if (tools) tools.style.display = ''; if (hint) hint.style.display = '';
    if (!cats().includes(cat)) cat = 'kimlik';
    if (!panel) {
      panel = document.createElement('div'); panel.className = 'ka-p'; ui.appendChild(panel);
      panel.addEventListener('click', onClick);
      panel.addEventListener('input', onInput);
      panel.addEventListener('keydown', e => e.stopPropagation());
    }
    const keep = document.activeElement && panel.contains(document.activeElement) ? (document.activeElement as HTMLInputElement).name : '';
    const scroll = panel.querySelector('.ka-b')?.scrollTop ?? 0;
    const railScroll = panel.querySelector('.ka-rail')?.scrollLeft ?? 0;
    panel.innerHTML = `<nav class="ka-rail" aria-label="Kategoriler">${cats().map(c => `<button class="ka-r${c === cat ? ' on' : ''}" data-cat="${c}" aria-pressed="${c === cat}">${IC[c]}<span>${CAT_AD[c]}</span></button>`).join('')}</nav>
<div class="ka-main"><div class="ka-hd"><h2 class="ka-h">${CAT_AD[cat]}</h2><p class="ka-sub">${CAT_SUB[cat]}</p></div>
<div class="ka-b">${body(m)}</div>
<div class="ka-ft"><p class="ka-st${nameErr ? ' bad' : ''}" role="status">${nameErr ? 'Önce adını yaz, sonra sahneye çıkarsın.' : m.done ? 'Değişiklikler hemen kaydedilir.' : 'Sürükle: döndür · Tekerlek ya da iki parmak: yakınlaş'}</p><button class="ka-go" data-go="1">${m.done ? 'Tamam, oyuna dön' : 'Sahneye çık'}</button></div></div>`;
    const b = panel.querySelector('.ka-b'); if (b) b.scrollTop = scroll;
    const rl = panel.querySelector('.ka-rail'); if (rl) rl.scrollLeft = railScroll;
    if (keep) { const el = panel.querySelector(`input[name="${keep}"]`) as HTMLInputElement | null; if (el && el.type !== 'range') { el.focus(); const n = el.value.length; el.setSelectionRange(n, n); } }
    paintTools();
  }
  function paintTools() {
    if (!tools) return;
    tools.innerHTML = `<button class="ka-tb wide" data-t="rnd" title="Rastgele (bedenine uygun)">${IC.rnd}<span>Rastgele</span></button><button class="ka-tb" data-t="undo" title="Geri al" aria-label="Geri al"${undo.length ? '' : ' disabled'}>${IC.undo}</button><button class="ka-tb" data-t="redo" title="Yinele" aria-label="Yinele"${redo.length ? '' : ' disabled'}>${IC.redo}</button><button class="ka-tb" data-t="cam" title="${near ? 'Tüm boy' : 'Yüze yakın'}" aria-label="${near ? 'Tüm boy' : 'Yüze yakın'}">${near ? IC.far : IC.near}</button>`;
  }

  /** dükkân adı hâlâ otomatik mi: boş, varsayılan ya da adından türemiş */
  const otoMu = (e: EsnafimSave) => !e.dukkan.trim() || e.dukkan === "Sabri'nin Büfesi" || e.dukkan === "Sabriye'nin Büfesi" || e.dukkan === otoDukkan(e.ad);
  const varsayilanDukkan = (e: EsnafimSave) => (e.tip === 'b' ? "Sabriye'nin Büfesi" : "Sabri'nin Büfesi");
  function chooseBody(tip: Beden) {
    if (!m) return;
    const first = !m.done && step === 'beden' && !undo.length;
    step = 'edit'; duo.forEach(h => h.dispose()); duo = []; duoKey = '';
    const oto = otoMu(m);
    set(bedenBaslangic(m, tip), { noUndo: first });
    if (oto && !m.ad.trim()) { m.dukkan = varsayilanDukkan(m); deps.command({ kind: 'esnafim', op: 'set', data: { dukkan: m.dukkan } }); }
    cat = 'kimlik'; near = false; zoom = 1; spin = 0; paint();
  }

  function randomize() {
    if (!m) return;
    const d = rastgeleGorunum(m.tip as Beden);
    delete d.tip;
    set(d);
  }

  function onClick(e: Event) {
    const el = (e.target as HTMLElement).closest('button,u') as HTMLElement | null; if (!el || !m) return;
    if (el.dataset.kit) { e.stopPropagation(); const sn = SINIFLAR.find(x => x.id === el.dataset.kit); if (sn) { const kit = { ...sn.kit } as Record<string, unknown>; if (m.tip === 'a' && kit.ustStil === 'dress') kit.ustStil = 'tee'; set(kit); } return; }
    if (el.dataset.go) { finish(); return; }
    if (el.dataset.cat) { cat = el.dataset.cat as Cat; near = NEAR[cat]; zoom = 1; tap(); paint(); panel?.querySelector('.ka-b')?.scrollTo(0, 0); return; }
    if (el.dataset.beden) { step = 'beden'; spin = 0; tap(); paint(); return; }
    if (el.dataset.allhair) { allHair = !allHair; tap(); paint(); return; }
    if (el.dataset.avm) {
      const g = AVM_GIY[el.dataset.avm];
      if (g) {
        // AVM parçası aynı yerdeki gardrop parçasının (ve kostümün) yerine geçer; yoksa gardrop katmanı (wornLook) AVM'yi ezerdi
        const slots = new Set<string>();
        if ('ust' in g || 'ustStil' in g) { slots.add('ust'); slots.add('kostum'); }
        if ('alt' in g || 'altStil' in g) { slots.add('alt'); slots.add('kostum'); }
        if ('sapka' in g) slots.add('sapka');
        if ('ayakkabi' in g) { slots.add('ayakkabi'); slots.add('kostum'); }
        const w = deps.dolap ? deps.dolap().worn : {};
        let taken = false;
        for (const sl of slots) if (w[sl]) { deps.command({ kind: 'kiyafet', op: 'take', id: w[sl] }); taken = true; }
        set({ ...g }); if (taken) { heroKey = ''; setTimeout(paint, 30); }
      }
      return;
    }
    if (el.dataset.ky) { deps.command({ kind: 'kiyafet', op: el.dataset.ky, id: el.dataset.id }); tap(); heroKey = ''; setTimeout(paint, 30); return; }
    if (el.dataset.sinif) { if (el.dataset.sinif !== m.sinif) set({ sinif: el.dataset.sinif }); return; }
    const k = el.dataset.k, v = el.dataset.v ?? '';
    if (!k) return;
    if (el.dataset.null) { set({ [k]: null }); return; }
    if (el.dataset.bool) { set({ [k]: v === '1' }); return; }
    if (k === 'ten' || k === 'desen' || k === 'allik') { set({ [k]: Number(v) }); return; }
    if ((k === 'sapka' || k === 'gozluk') && v === '') { set({ [k]: null }); return; }
    if (k === 'ustStil' && v === 'dress') { set({ ustStil: v, altStil: 'skirt' }); return; }
    set({ [k]: v });
  }
  function onInput(e: Event) {
    const tg = e.target as HTMLInputElement; if (!m) return;
    if (tg.name === 'boy') { const v = Math.round(Number(tg.value) * 100) / 100; set({ boy: v }, { noUndo: Math.abs(v - m.boy) < 0.02 && undo.length > 0 }); return; }
    if (tg.name === 'ad' || tg.name === 'dukkan') {
      // QA 2026-11-27: dükkân adı oyuncu el ile yazmadıysa adla birlikte değişir (Sabriye seçince "Sabri'nin Büfesi" kalmasın)
      if (tg.name === 'ad' && otoMu(m)) { const d = otoDukkan(tg.value) || varsayilanDukkan(m); m.dukkan = d; const f = panel?.querySelector('input[name="dukkan"]') as HTMLInputElement | null; if (f) f.value = d; deps.command({ kind: 'esnafim', op: 'set', data: { dukkan: d } }); }
      (m as unknown as Record<string, string>)[tg.name] = tg.value;
      if (nameErr && tg.name === 'ad' && tg.value.trim()) { nameErr = false; const f = panel!.querySelector('.ka-st'); if (f) { f.classList.remove('bad'); f.textContent = ''; } }
      deps.command({ kind: 'esnafim', op: 'set', data: { [tg.name]: tg.value } }); paintTag();
    }
  }

  function open(model: EsnafimSave) {
    m = { ...model }; if (!model.adKilit && !model.done) m.ad = '';
    step = model.done ? 'edit' : 'beden'; cat = model.done ? 'yuz' : 'kimlik'; near = model.done; heroKey = ''; duoKey = ''; undo.length = 0; redo.length = 0; nameErr = false; allHair = false; zoom = 1; spin = 0;
    canvas = document.createElement('canvas'); canvas.className = 'ka-c'; deps.root.appendChild(canvas);
    ui = document.createElement('div'); ui.className = 'ka'; deps.root.appendChild(ui);
    tag = document.createElement('div'); tag.className = 'ka-tag'; ui.appendChild(tag);
    tools = document.createElement('div'); tools.className = 'ka-tools'; ui.appendChild(tools);
        tools.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!b || !m) return;
      const tt = b.dataset.t;
      if (tt === 'rnd') randomize(); else if (tt === 'undo') restore(undo, redo); else if (tt === 'redo') restore(redo, undo);
      else if (tt === 'cam') { near = !near; zoom = 1; tap(); paintTools(); }
    });
    try {
      R = createLookRenderer({ canvas, antialias: true, exposure: LOOK_POZ.kulis, pixelRatioMax: 2 });   // GRS-01: one look (sRGB + ACES, look.ts)
      scene = new T.Scene(); cam = new T.PerspectiveCamera(36, 1, 0.05, 40);
      buildSet(scene, (window.devicePixelRatio || 1) > 2 || Math.min(window.innerWidth, window.innerHeight) < 500);
      thumbScene = new T.Scene(); thumbScene.background = new T.Color('#efe2cc');
      thumbScene.add(new T.HemisphereLight('#fff4e2', '#6a5040', 1.5));
      const k = new T.DirectionalLight('#fff1dc', 2.1); k.position.set(1.5, 3, 4); thumbScene.add(k);
      thumbCam = new T.PerspectiveCamera(28, 1, 0.05, 10);
      thumbCv = document.createElement('canvas'); thumbCv.width = thumbCv.height = 160;
    } catch { R = null; }
    rebuildHero(); rebuildDuo();
    // drag turns the hero; wheel and pinch zoom
    canvas.addEventListener('pointerdown', e => { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas?.setPointerCapture(e.pointerId); if (pointers.size === 1) drag = { x: e.clientX, s: spin }; else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom }; drag = null; } });
    canvas.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; zoom = Math.max(0.6, Math.min(1.6, pinch.z * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)))); }
      else if (drag) spin = drag.s + (e.clientX - drag.x) * 0.012;
    });
    const up = (e: PointerEvent) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (!pointers.size) drag = null; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.max(0.6, Math.min(1.6, zoom * (e.deltaY > 0 ? 1.08 : 0.93))); }, { passive: false });
    paint();
  }

  function finish() {
    if (!m) return;
    if (!m.adKilit && !m.ad.trim()) {   // herkes kendi adını yazar: sabit ana karakter yok
      cat = 'kimlik'; nameErr = true; paint(); try { deps.sfx?.('error'); } catch { /* */ }
      const inp = panel?.querySelector('input[name="ad"]') as HTMLInputElement | null; if (inp) { inp.focus(); inp.style.borderColor = '#e0533c'; }
      return;
    }
    deps.command({ kind: 'esnafim', op: 'set', data: { ad: m.ad, dukkan: m.dukkan } });
    deps.command({ kind: 'saveSign', text: m.dukkan, font: 'vapur' });
    deps.command({ kind: 'esnafim', op: 'done' });
    try { deps.sfx?.('buy'); } catch { /* */ }
    close();
  }

  function close() {
    if (hero) { hero.dispose(); hero = null; }
    duo.forEach(h => h.dispose()); duo = [];
    const kill = (sc: T.Scene | null) => sc?.traverse(o => { const me = o as T.Mesh; if (me.geometry) me.geometry.dispose(); const mt = me.material as T.Material | T.Material[] | undefined; if (mt) (Array.isArray(mt) ? mt : [mt]).forEach(x => { const map = (x as T.MeshStandardMaterial).map; if (map) map.dispose(); x.dispose(); }); });
    kill(scene); kill(thumbScene);
    if (R) { R.dispose(); R.forceContextLoss(); R = null; }
    canvas?.remove(); ui?.remove();
    canvas = null; ui = null; panel = null; tools = null; tag = null; pick = null; hint = null; scene = null; cam = null; thumbScene = null; thumbCam = null; thumbCv = null; m = null;
    queue.length = 0; pointers.clear();
  }

  /** free screen rectangle (not under the panel / pick bar): the hero is framed inside it */
  function freeRect(w: number, h: number) {
    if (step === 'beden') { const ph = pick ? pick.getBoundingClientRect().height : 0; return { x: 0, y: 0, w, h: Math.max(h * 0.5, h - ph * 0.75) }; }
    const r = panel?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0, w, h };
    if (r.top > h * 0.3) return { x: 0, y: 0, w, h: r.top };          // bottom sheet
    return { x: 0, y: 0, w: r.left, h };                               // side card
  }

  function renderThumb(): void {
    if (!R || !thumbScene || !thumbCam || !thumbCv || !deps.chars || !canvas || !queue.length) return;
    const job = queue.shift()!;
    if (thumbs.has(job.key)) return;
    let h: HeroLike | null = null;
    try {
      h = deps.chars.makeHero(job.opts as never) as HeroLike;
      thumbScene.add(h.object); h.setPose({ x: 0, z: 0 }, 0); h.setInput({ speed: 0, carry: 0, act: 'idle', mood: 'ok', t: 0 }); h.update(0.016, 1);
      const boy = Number((job.opts.look as Record<string, unknown>)?.height) || 1, hy = 1.5 * boy;
      if (job.mode === 'sac') { thumbCam.position.set(0.5, hy + 0.12, 1.05); thumbCam.lookAt(0, hy - 0.04, 0); thumbCam.fov = 30; }
      else { thumbCam.position.set(0.34, hy + 0.04, 0.78); thumbCam.lookAt(0, hy + 0.0, 0); thumbCam.fov = 25; }
      thumbCam.aspect = 1; thumbCam.updateProjectionMatrix();
      const pr = R.getPixelRatio(), S = 80;
      R.setScissorTest(true); R.setViewport(0, 0, S, S); R.setScissor(0, 0, S, S);
      R.render(thumbScene, thumbCam);
      const g = thumbCv.getContext('2d')!; g.clearRect(0, 0, 160, 160);
      g.drawImage(canvas, 0, canvas.height - S * pr, S * pr, S * pr, 0, 0, 160, 160);
      const url = thumbCv.toDataURL('image/webp', 0.86);
      thumbs.set(job.key, url);
      panel?.querySelectorAll<HTMLImageElement>('img[data-thumb]').forEach(im => { if (im.dataset.thumb === job.key) im.src = url; });
    } catch { /* thumbnail is optional */ }
    finally {
      R.setScissorTest(false);
      if (h) h.dispose();
    }
  }

  function render(dt: number) {
    if (!R || !scene || !cam || !canvas) return;
    t += dt;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * R.getPixelRatio()) || canvas.height !== Math.floor(h * R.getPixelRatio())) R.setSize(w, h, false);
    renderThumb();
    R.setViewport(0, 0, w, h);
    const fr = freeRect(w, h), k = 1 - Math.exp(-dt * 5);
    // frame a box of height H (metres) inside the free rect; the optical centre moves to the rect centre (setViewOffset)
    const boy = m?.boy || 1, duoMode = step === 'beden';
    const H = duoMode ? 2.2 : near ? 0.92 * boy : 2.05 * boy, Wd = duoMode ? 2.4 : near ? 0.8 : 1.1;
    const ty = duoMode ? 0.95 : near ? 1.45 * boy : 0.98 * boy;
    const fov = cam.fov * Math.PI / 180, vfrac = fr.h / h, aspect = w / h;
    const dV = H / (2 * Math.tan(fov / 2) * vfrac * 0.9), dH = Wd / (2 * Math.tan(fov / 2) * aspect * (fr.w / w) * 0.9);
    const d = Math.max(dV, dH) * (near ? zoom : Math.min(1.25, zoom));
    const hz = 0.4;
    camA.lerp(new T.Vector3(0, ty, hz), k);
    camP.lerp(new T.Vector3(0, ty + d * 0.1, hz + d), k);
    cam.position.copy(camP); cam.lookAt(camA);
    cam.aspect = aspect;
    cam.setViewOffset(w, h, w / 2 - (fr.x + fr.w / 2), h / 2 - (fr.y + fr.h / 2), w, h);
    cam.updateProjectionMatrix();
    if (tools) {
      // phones (bottom sheet): a slim column on the right edge of the stage, clear of the hero; else bottom-left
      const sheet = fr.h < h * 0.9;
      tools.classList.toggle('col', sheet);
      if (sheet) { tools.style.left = (fr.w - 56) + 'px'; tools.style.top = '62px'; }
      else { tools.style.left = (fr.x + 14) + 'px'; tools.style.top = (h - 66) + 'px'; }
    }
    if (hero && step === 'edit') {
      hero.object.visible = true;
      hero.setPose({ x: 0, z: hz }, spin);
      hero.setInput({ speed: 0, carry: 0, act: 'idle', mood: 'ok', t });
      hero.update(dt, 1);
    } else if (hero) hero.object.visible = false;
    duo.forEach((hd, i) => { hd.setPose({ x: i ? 0.6 : -0.6, z: hz }, spin + (i ? -0.18 : 0.18)); hd.setInput({ speed: 0, carry: 0, act: 'idle', mood: 'ok', t: t + i }); hd.update(dt, 1); });
    R.render(scene, cam);
  }

  return {
    get open() { return !!ui; },
    update(dt: number) {
      const r = deps.rules(); if (!r) return;
      const want = r.rt.uiLast.esnafim as EsnafimSave | undefined;
      if (want && !ui) open(want);
      else if (!want && ui) close();
      if (ui && m) { if (step === 'edit') rebuildHero(); else rebuildDuo(); render(Math.min(0.1, Math.max(0, dt))); }
    },
  };
}
