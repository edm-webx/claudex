// In-game scene editor (Builder D, MOTOR §18). Loaded lazily (dynamic import) only with ?edit=1 or the dev long-press.
//
// What it does:
// - Tap selects a prop placement (input tap pickId, else render.pick, else nearest placement to the ground hit).
// - Drag the selected prop on the ground (pointer near it): half-tile snap 0.5 m, Alt = free. Drags do not reach
//   the joystick (pointer events captured while dragging). Döndür = 45° steps.
// - Undo / redo (unlimited), one entry per finished drag / rotate / inspector edit.
// - Kaydet: content overrides -> IndexedDB + localStorage mirror (overrides.ts), applied live and on next load;
//   returns (and "Kopyala" copies) the TS/JSON patch to paste into src/content/zones/*.ts.
// - Inspector (lil-gui): placement x/z/rotY/scale, prefab params and part colour/size; prefab edits call
//   prefab.redefine(def) so every instance rebuilds ("change one table, all hundred change"). Prefab redefines are
//   session-only (copy the def with "Prefabı kopyala").
// - "Hız ölçer" button toggles the perf overlay (perf.show), which carries "Raporu kopyala".
// - Hooks (window.__marti.editor.*): select, drag, rotate, undo, redo, save, redefine(prefabId, patch), pos(id),
//   instances(prefabId) (id, object uuid, world pos), overrides(zone), open(on), state().
// Decision: overrides are re-applied whenever a zone turns warm/hot (its instances are rebuilt then).
import * as THREE from 'three';
import GUI from 'lil-gui';
import type { Editor, EditorDeps, EditorAttach, PrefabPlacement, PrefabDef, PrefabInstance, PerfMeter, TapEvent, Vec2, Disposer } from '../api';
import { emptyOverrides, loadOverrides, storeOverrides, patchText, pickFields, zoneOverrides, type OverrideFile, type PlacementFields } from './overrides';

export { installHotReload, swapSystem } from './hot';
export * from './overrides';

interface Step { id: string; before: PlacementFields; after: PlacementFields; }
interface PrefabStep { prefab: string; before: PrefabDef; after: PrefabDef; }
type HistoryEntry = { kind: 'place'; s: Step } | { kind: 'prefab'; s: PrefabStep };

const CSS = `
.mm-ed{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 8px);z-index:70;display:flex;flex-direction:column;gap:5px;align-items:center;pointer-events:none;width:min(380px,calc(100vw - 12px))}
.mm-ed .st{pointer-events:none;background:rgba(46,42,90,.9);color:#fff;font:800 12px/1.2 "Nunito",system-ui,sans-serif;border-radius:10px;padding:4px 9px;max-width:100%;text-align:center}
.mm-ed .bt{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;pointer-events:auto}
.mm-ed button{min-height:40px;min-width:44px;padding:4px 10px;border:2.5px solid #3b2a20;border-radius:12px;background:#fff6e6;color:#3b2a20;font:900 13px/1 "Baloo 2","Nunito",system-ui,sans-serif;box-shadow:0 3px 0 #3b2a20;cursor:pointer}
.mm-ed button.y{background:#ffd23f}.mm-ed button.g{background:#49b96a;color:#fff}
.mm-ed button:disabled{opacity:.45;cursor:default}
.mm-ed button:active{transform:translateY(2px);box-shadow:0 1px 0 #3b2a20}
.lil-gui.mm-gui{--width:230px;position:fixed;top:calc(env(safe-area-inset-top,0px) + 112px);right:6px;z-index:71;max-height:55vh;overflow:auto}
`;

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'function' ? undefined : x))) as T;
const snap = (v: number, free: boolean) => (free ? Math.round(v * 1000) / 1000 : Math.round(v * 2) / 2);
const countMeshes = (o: THREE.Object3D) => { let n = 0; o.traverse(c => { if ((c as THREE.Mesh).isMesh) n++; }); return n; };
const r2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

export function createEditor(deps: EditorDeps & { perf?: PerfMeter }): Editor {
  let att: EditorAttach | null = null;
  let active = false;
  let selected: string | null = null;
  const undoStack: HistoryEntry[] = [];
  const redoStack: HistoryEntry[] = [];
  let file: OverrideFile = emptyOverrides();
  let loaded: Promise<void> = Promise.resolve();
  const disposers: Disposer[] = [];
  // DOM
  let bar: HTMLElement | null = null, status: HTMLElement | null = null;
  let gui: GUI | null = null;
  let ring: THREE.Mesh | null = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();

  // ---------- lookup ----------
  const inst = (id: string): PrefabInstance | undefined => { try { return att?.prefab.instance(id); } catch { return undefined; } };
  function zoneOf(id: string): string | null {
    if (!att) return null;
    for (const z of att.zones.ids()) { const d = att.zones.def(z); if (d && d.props.some(p => p.id === id)) return z; }
    const i = inst(id); if (i) return att.zones.zoneAt(i.placement.pos);
    return null;
  }
  function contentPlacement(id: string): PrefabPlacement | null {
    if (!att) return null;
    for (const z of att.zones.ids()) { const p = att.zones.def(z)?.props.find(q => q.id === id); if (p) return p; }
    return null;
  }
  function current(id: string): PlacementFields | null {
    const i = inst(id); if (i) return pickFields(i.placement);
    const z = zoneOf(id); const e = z ? file.zones[z]?.[id] : undefined; if (e) return clone(e.set);
    const c = contentPlacement(id); return c ? pickFields(c) : null;
  }

  // ---------- apply / record ----------
  function setFields(id: string, f: PlacementFields) {
    const i = inst(id);
    if (i) i.setPlacement({ pos: { x: f.pos.x, z: f.pos.z }, ...(f.rotY != null ? { rotY: f.rotY } : {}), ...(f.scale != null ? { scale: f.scale } : {}), ...(f.y != null ? { y: f.y } : {}) });
    const z = zoneOf(id);
    if (z) {
      // the true base is the one recorded with the first edit: boot may already have applied the override to
      // zones.def (zones.replace(applyOverrides(...))), so the def can hold the edited position
      const zf = (file.zones[z] ||= {});
      const cp = contentPlacement(id);
      const base = zf[id] ? zf[id].base : cp ? pickFields(cp) : null;
      if (base && sameAsBase(base, f)) delete zf[id];
      else zf[id] = { base: base ? clone(base) : clone(f), set: clone(f) };
    }
    if (id === selected) { placeRing(); refreshStatus(); gui?.controllersRecursive().forEach(c => c.updateDisplay()); }
  }
  const sameAsBase = (a: PlacementFields, b: PlacementFields) => JSON.stringify(a) === JSON.stringify(pickFields(b));
  function commit(id: string, before: PlacementFields, after: PlacementFields) {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    undoStack.push({ kind: 'place', s: { id, before: clone(before), after: clone(after) } }); redoStack.length = 0; refreshStatus();
  }
  function applyZone(zoneId: string) {
    if (!att) return;
    const def = att.zones.def(zoneId); if (!def) return;
    const ov = zoneOverrides(file, def);
    for (const [id, p] of Object.entries(ov)) { const i = inst(id); if (i) i.setPlacement(p); }
  }
  function applyAll() { if (att) for (const z of att.zones.ids()) applyZone(z); }

  // ---------- ground + picking ----------
  function ground(clientX: number, clientY: number): Vec2 | null {
    if (!att) return null;
    const cam = att.render.camera.camera, el = att.render.renderer?.domElement;
    const r = el ? el.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, z: hit.z } : null;
  }
  function nearestPlacement(p: Vec2, maxD = 1.5): string | null {
    if (!att) return null;
    let best: string | null = null, bd = maxD;
    for (const i of att.prefab.instances()) {
      if (!i.object.visible) continue;
      const d = Math.hypot(i.placement.pos.x - p.x, i.placement.pos.z - p.z);
      if (d < bd) { bd = d; best = i.id; }
    }
    return best;
  }
  function onTap(e: TapEvent) {
    if (!active || !att) return;
    let id = e.pickId && inst(e.pickId) ? e.pickId : null;
    if (!id) { try { const p = att.render.pick(e.screen); if (p && inst(p)) id = p; } catch { /* no picker */ } }
    if (!id) { const g = ground(e.screen.x, e.screen.y); if (g) id = nearestPlacement(g); }
    if (id) ed.select(id);
  }

  // pointer drag (capture phase so the joystick never sees it)
  let drag: { id: string; before: PlacementFields; off: Vec2; pid: number } | null = null;
  function onDown(e: PointerEvent) {
    if (!active || !selected || !att) return;
    if (!(e.target instanceof HTMLCanvasElement)) return;
    const g = ground(e.clientX, e.clientY), cur = current(selected);
    if (!g || !cur) return;
    if (Math.hypot(g.x - cur.pos.x, g.z - cur.pos.z) > 1.4) return;
    drag = { id: selected, before: clone(cur), off: { x: cur.pos.x - g.x, z: cur.pos.z - g.z }, pid: e.pointerId };
    e.stopPropagation(); e.preventDefault();
  }
  function onMove(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pid) return;
    e.stopPropagation(); e.preventDefault();
    const g = ground(e.clientX, e.clientY); if (!g) return;
    const cur = current(drag.id); if (!cur) return;
    cur.pos = { x: snap(g.x + drag.off.x, e.altKey), z: snap(g.z + drag.off.z, e.altKey) };
    setFields(drag.id, cur);
  }
  function onUp(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pid) return;
    e.stopPropagation();
    const d = drag; drag = null;
    const after = current(d.id); if (after) commit(d.id, d.before, after);
  }

  // ---------- visuals ----------
  function placeRing() {
    if (!att) return;
    if (!ring) {
      ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.9, depthTest: false, fog: false }));
      ring.renderOrder = 999; ring.name = 'editorRing'; ring.userData.parity = 'dyn';
      att.render.scene.add(ring);
    }
    const f = selected ? current(selected) : null;
    ring.visible = !!(active && f);
    if (f) ring.position.set(f.pos.x, 0.03 + (f.y ?? 0), f.pos.z);
  }
  function refreshStatus() {
    if (!status) return;
    const f = selected ? current(selected) : null;
    status.textContent = selected && f
      ? `${selected}  x ${r2(f.pos.x)}  z ${r2(f.pos.z)}  ${Math.round(((f.rotY ?? 0) * 180) / Math.PI)}°`
      : 'Düzen modu: bir eşyaya dokun, sonra sürükle';
    if (bar) {
      (bar.querySelector('[data-k=undo]') as HTMLButtonElement).disabled = !undoStack.length;
      (bar.querySelector('[data-k=redo]') as HTMLButtonElement).disabled = !redoStack.length;
      (bar.querySelector('[data-k=rot]') as HTMLButtonElement).disabled = !selected;
    }
  }
  function buildBar() {
    if (bar) return;
    if (!document.getElementById('mm-ed-style')) { const s = document.createElement('style'); s.id = 'mm-ed-style'; s.textContent = CSS; document.head.appendChild(s); }
    bar = document.createElement('div'); bar.className = 'mm-ed';
    bar.innerHTML = `<div class="st"></div><div class="bt">
      <button data-k="undo">Geri al</button><button data-k="redo">Yinele</button><button data-k="rot">Döndür</button>
      <button data-k="save" class="g">Kaydet</button><button data-k="copy" class="y">Kopyala</button>
      <button data-k="perf">Hız ölçer</button><button data-k="close">Kapat</button></div>`;
    status = bar.querySelector('.st');
    bar.addEventListener('click', async e => {
      const k = ((e.target as Element).closest('button') as HTMLElement | null)?.dataset.k; if (!k) return;
      if (k === 'undo') ed.undo(); else if (k === 'redo') ed.redo();
      else if (k === 'rot' && selected) ed.rotate(selected, 1);
      else if (k === 'save') { await ed.save(); deps.ui?.toast('Yerleşim kaydedildi', 'good'); }
      else if (k === 'copy') { const ok = await deps.platform.copyText(await ed.save()); deps.ui?.toast(ok ? 'Yama kopyalandı' : 'Kopyalanamadı', ok ? 'good' : 'bad'); }
      else if (k === 'perf' && deps.perf) deps.perf.show(!deps.perf.visible);
      else if (k === 'close') ed.open(false);
    });
    (document.getElementById('app') || document.body).appendChild(bar);
    refreshStatus();
  }

  // ---------- inspector ----------
  function buildGui() {
    gui?.destroy(); gui = null;
    if (!active || !selected || !att) return;
    const id = selected, i = inst(id); if (!i) return;
    gui = new GUI({ title: id, container: document.getElementById('app') || document.body });
    gui.domElement.classList.add('mm-gui');
    const f = current(id) as PlacementFields;
    const model = { x: f.pos.x, z: f.pos.z, rotDeg: Math.round(((f.rotY ?? 0) * 180) / Math.PI), scale: f.scale ?? 1 };
    let before: PlacementFields | null = null;
    const live = () => { const c = current(id)!; if (!before) before = clone(c); c.pos = { x: model.x, z: model.z }; c.rotY = (model.rotDeg * Math.PI) / 180; if (model.scale !== 1 || c.scale != null) c.scale = model.scale; setFields(id, c); };
    const done = () => { if (before) { commit(id, before, current(id)!); before = null; } };
    const pf = gui.addFolder('Yerleşim');
    pf.add(model, 'x', -60, 60, 0.05).onChange(live).onFinishChange(done);
    pf.add(model, 'z', -60, 60, 0.05).onChange(live).onFinishChange(done);
    pf.add(model, 'rotDeg', -180, 180, 45).name('dönüş°').onChange(live).onFinishChange(done);
    pf.add(model, 'scale', 0.25, 3, 0.05).name('ölçek').onChange(live).onFinishChange(done);
    const def = att.prefab.def(i.prefab); if (!def) return;
    const work = clone(def) as PrefabDef; work.build = def.build;
    const fold = gui.addFolder('Prefab: ' + def.id + ' (tümü)');
    const redef = () => { const b = att!.prefab.def(def.id); if (!b) return; ed.redefinePrefab(clone(work)); void b; };
    if (work.params) for (const k of Object.keys(work.params)) {
      const v = work.params[k];
      if (typeof v === 'number') fold.add(work.params, k).onFinishChange(redef);
      else if (typeof v === 'boolean') fold.add(work.params, k).onFinishChange(redef);
      else fold.add(work.params, k).onFinishChange(redef);
    }
    work.parts.slice(0, 24).forEach((p, n) => {
      const pf2 = fold.addFolder(p.name || `${n}: ${p.shape}`); pf2.close();
      if (p.color) pf2.addColor(p, 'color').onFinishChange(redef);
      const sz = { w: p.size[0], h: p.size[1], d: p.size[2] };
      (['w', 'h', 'd'] as const).forEach((k, j) => pf2.add(sz, k, 0, 10, 0.01).onFinishChange(() => { p.size[j] = sz[k]; redef(); }));
    });
    fold.add({ kopyala: () => { void deps.platform.copyText(JSON.stringify(work, null, 1)).then(ok => deps.ui?.toast(ok ? 'Prefab kopyalandı' : 'Kopyalanamadı', ok ? 'good' : 'bad')); } }, 'kopyala').name('Prefabı kopyala');
  }

  // ---------- public ----------
  const ed: Editor & { redefinePrefab(def: PrefabDef, record?: boolean, keepBuild?: boolean): number } = {
    attach(o) {
      att = o;
      disposers.push(o.input.onTap(onTap));
      try { disposers.push(o.zones.onState((id, s) => { if (s === 'warm' || s === 'hot') applyZone(id); })); } catch { /* optional */ }
      window.addEventListener('pointerdown', onDown, true);
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onUp, true);
      disposers.push(() => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('pointermove', onMove, true); window.removeEventListener('pointerup', onUp, true); window.removeEventListener('pointercancel', onUp, true); });
      loaded = loadOverrides(deps.platform).then(f => { file = f; applyAll(); placeRing(); refreshStatus(); }).catch(() => { /* keep empty */ });
    },
    open(on) {
      active = !!on;
      if (active) buildBar(); else { gui?.destroy(); gui = null; }
      if (bar) bar.style.display = active ? '' : 'none';
      placeRing(); refreshStatus();
      if (active) buildGui();
    },
    get active() { return active; },
    select(id) {
      selected = id && (inst(id) || contentPlacement(id)) ? id : null;
      placeRing(); refreshStatus(); buildGui();
    },
    drag(id, x, z) {
      const before = current(id); if (!before) return;
      const after = clone(before); after.pos = { x, z };
      setFields(id, after); commit(id, before, after);
    },
    rotate(id, steps45) {
      const before = current(id); if (!before) return;
      const after = clone(before); after.rotY = ((before.rotY ?? 0) + steps45 * Math.PI / 4) % (Math.PI * 2);
      setFields(id, after); commit(id, before, after);
    },
    undo() {
      const h = undoStack.pop(); if (!h) return;
      if (h.kind === 'place') setFields(h.s.id, h.s.before); else att?.prefab.redefine(h.s.before);
      redoStack.push(h); refreshStatus();
    },
    redo() {
      const h = redoStack.pop(); if (!h) return;
      if (h.kind === 'place') setFields(h.s.id, h.s.after); else att?.prefab.redefine(h.s.after);
      undoStack.push(h); refreshStatus();
    },
    async save() {
      await loaded;
      await storeOverrides(deps.platform, file);
      return patchText(file);
    },
    overrides(zoneId) {
      const def = att?.zones.def(zoneId);
      return def ? zoneOverrides(file, def) : {};
    },
    redefinePrefab(def, record = true, keepBuild = true) {
      if (!att) return 0;
      const old = att.prefab.def(def.id);
      if (keepBuild && old && !def.build && old.build) def.build = old.build;
      att.prefab.redefine(def);
      if (record && old) { const b = clone(old) as PrefabDef; b.build = old.build; undoStack.push({ kind: 'prefab', s: { prefab: def.id, before: b, after: def } }); redoStack.length = 0; }
      applyAll(); refreshStatus();
      return att.prefab.instances(def.id).length;
    },
  };

  // hooks
  const h = deps.hooks;
  if (h) {
    h.register('editor.select', (id: string) => ed.select(id));
    h.register('editor.drag', (id: string, x: number, z: number) => ed.drag(id, x, z));
    h.register('editor.rotate', (id: string, n: number) => ed.rotate(id, n));
    h.register('editor.undo', () => ed.undo());
    h.register('editor.redo', () => ed.redo());
    h.register('editor.save', () => ed.save());
    h.register('editor.open', (on: boolean) => ed.open(on));
    h.register('editor.pos', (id: string) => current(id));
    h.register('editor.overrides', (z: string) => ed.overrides(z));
    /** patch: partial PrefabDef merged over the current def (parts replaced wholesale when given). */
    h.register('editor.redefine', (prefabId: string, patch: Partial<PrefabDef>) => {
      const old = att?.prefab.def(prefabId); if (!old) return -1;
      const d = { ...clone(old), ...clone(patch), id: prefabId } as PrefabDef;
      // build: null in the patch drops the custom builder (parts only); otherwise the old builder is kept
      if ((patch as { build?: unknown }).build === null) delete d.build; else d.build = patch.build || old.build;
      return ed.redefinePrefab(d, true, (patch as { build?: unknown }).build !== null);
    });
    h.register('editor.instances', (prefabId?: string) => (att ? att.prefab.instances(prefabId).map(i => ({ id: i.id, prefab: i.prefab, uuid: i.object.uuid, visible: i.object.visible, pos: { x: i.object.position.x, z: i.object.position.z }, meshes: countMeshes(i.object), h: +new THREE.Box3().setFromObject(i.object).getSize(new THREE.Vector3()).y.toFixed(3) })) : []));
    h.register('editor.state', () => ({ active, selected, undo: undoStack.length, redo: redoStack.length, overrides: clone(file.zones) }));
  }
  return ed;
}
