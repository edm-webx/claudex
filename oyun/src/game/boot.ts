/**
 * Boot: wires the engine and the builders' factories together. M0 owner: Builder A; M1 integration: integrator.
 * Every createX runs inside try/catch; a missing or throwing module gets a fallback (grey box world, capsule hero,
 * plain HUD, open-floor nav) plus a perf-meter warning, never a crash. Only "no WebGL at all" shows #fail.
 * Every per-frame view call is guarded too: 3 throws and that part is switched off with a perf warning.
 *
 * Frame order (render phase): input poll (pinch zoom) -> player pose lerp -> zones.update -> camera.follow ->
 * world view (+ B's rtview: items, pads, dwell ring, ferry, window) -> hero (carry pose, act) -> agents view (workers,
 * specials, animals) -> crowd/chars/fx/anim -> setTime (every 0.2 s) -> camera.update -> ui -> panels -> play view
 * (bubbles, tutorial, HUD, floats) -> audio map -> render.frame -> perf/quality feed -> save.tick.
 * Decisions:
 * - ?parity=1: seed 1, fresh state, no save writes, HUD-only UI (M0 hud.ts), camera zoom 1, player at the zone
 *   playerStart, no title, no M1 views (the M0 parity scene stays exactly as it was).
 * - ?time=<h> freezes the sim clock at h. ?stage=<n> sets state.stage. ?noloop: no rAF loop (hooks drive frames).
 * - Pauses are reason-counted (hidden, context) so a context restore never resumes a hidden page.
 * - hooks.camera({x,z,zoom}) holds the camera on that point until the next joystick move or teleport.
 * - M1 start flow (v2): title card -> hero pick -> `play`. A save that was already played (hero chosen) goes straight
 *   in, then the welcome-back card (kepenk earnings) if the player was away long enough. ?autoplay starts at once.
 * - One settings sheet: the v2 'ayarlar' panel (D). The M0 perf meter ("Hız ölçer", "Raporu kopyala") lives in it.
 * - HUD: v2 hudNow fields (play view) once the session started; the M0 hud.ts driver is used only in parity mode.
 * - Save: A's createGameSave (engine SaveStore: IDB + localStorage mirror, checksums, backups); `rules.ext.takeDirty()`
 *   triggers an extra write right after purchases/settings (v2 saveNow), the engine autosave covers the rest.
 * - window.__marti = M0 hooks + the v2 `__bufe` surface (play, input, step, state, force.*, panels, ...). `state()` is
 *   rules.v2State() merged with the M0 fields; `paused`/`pauseWhy` report the loop pause OR the sim ceremony pause.
 */
/** Faz 2 lean build (user list 7/9/20/25/38): no other buildings, no strolling NPC views, no centre moments, no welcome-back popup, no boat/ferry-side orders. */
const FAZ2_LEAN = true;
// 2026-10-24 açık dünya anketi: the Martıköy town (çarşı, sahil, yokuş, meydan, barınak), its map and the sea (fishing)
// come back as the first open-world districts. Moments and welcome-back stay off (no story popups, no offline income).
const ACIK_DUNYA = true;
import { kiyafetSave, kiyafetItem } from './sim/kiyafet';
import type {
  Platform, PerfMeter, Quality, TierDef, Input, RenderPipeline, Dress, PrefabSystem, ZoneManager, Nav, AnimApi, Fx, Chars, Ui, Audio,
  GameView, HeroHandle, TestHooks, Editor, Vec2, Vec3, ScreenPt, Logger, TierName, ArtManifest, SaveStore, QualitySetting, Rect, WalkGrid,
} from '../engine/api';
import type { Object3D } from 'three';
import { createHooks } from '../engine/debug';
import { fallbackRender, fallbackWorld, fallbackHero, fallbackUi, fallbackHud } from '../engine/debug/fallbacks';
import { createPlatform } from '../engine/platform';
import { createPerf } from '../engine/perf';
import { createQuality, TIER_TABLE } from '../engine/quality';
import { createInput } from '../engine/input';
import { createLoop } from '../engine/loop';
import { createLogger, angLerp } from '../engine/core';
import { createRender } from '../engine/render';
import { setGlbEnv, setGlbNight } from './view/world/glb';
import { mulkApi } from './sim/mulk';
import { createDress } from '../engine/dress';
import { createPrefabs } from '../engine/prefab';
import { createZones } from '../engine/zones';
import { createNav } from '../engine/nav';
import { createAnim } from '../engine/anim';
import { createFx } from '../engine/fx';
import { createUi } from '../engine/ui';
import { createAudio } from '../engine/audio';
import { createChars, type MotorChars } from './view/chars';
import { createAgentsView, type AgentsView } from './view/chars/agents-view';
import { createWorldView } from './view/world';
import { createHud } from './ui/hud';
import { createPanels, type Panels } from './ui/panels';
import { createHtmlLabels } from './ui/labels';
import { createCarsiView, type CarsiView } from './view/carsi';
import { esnafApi } from './sim/esnaf';
import { createMomentsView, type MomentsView } from './view/moments';
import { createMiniGames, type MiniGamesView } from './ui/mini-games';
import { createHikayeScene, type HikayeSceneView } from './ui/hikaye-scene';
import { createAudioMap, type AudioMap } from './audio-map';
import { createJuice, type JuiceView } from './view/juice';
import { havaApi } from './sim/hava';
import { installTutorial, type Tutorial } from './tutorial';
import { createPlayView, type PlayView } from './play-view';
import { createParity, type Parity } from './parity';
import { createContent } from '../content/index';
import { defaultSign } from '../content/sign-fonts';
import { createSim, openNav, lerpPose, type SimFull } from './headless';
import { defaultState, SAVE_KEY, type GameState, type HeroId } from './sim/schema';
import { createGameSave } from './sim/save';
import { createGunSonu } from './ui/gun-sonu';
import { createKulis } from './ui/kulis';
import { createYetenekBtn } from './ui/yetenek-btn';
import { createGiris } from './ui/giris';
import { hesap, cikisYap } from './net/supa';
import { bulutOku, bulutYaz, slotYeni } from './net/slots';
import { esnafHeroOpts, esnafimSave } from './sim/esnafim';
import { createOnline } from './online';
import { createAdminPanel } from './ui/admin-panel';
import { PAD_KEYS } from '../content/pads';
import { regionAt } from '../content/disari/martikoy';
import { createHaliSaha } from './ui/hali-saha';
import { createOrmanView } from './view/orman';
import { createOtobusHud } from './ui/otobus-hud';
import { createMulkPanel } from './ui/mulk-panel';
import { createMulkView } from './view/mulk';
import { bankaOku, bankaYaz } from './net/slots';
import { panelModel, panelActions } from './sim/panels';
import type { AgentsHandle } from './sim/agents';
import { createFerryLook, type FerryLookView } from './view/world/ferry-look';
import { createYolLook, type YolLookView } from './view/world/yol-look';
import { ugY, onUg } from '../content/ustgecit';
import { createKarsiLook, type KarsiLookView } from './view/world/karsi-look';
import { createKarsiBina, type BinaView } from './view/world/karsi-bina';
import { createBufeBuyume, mevsimZorla, type BuyumeView } from './view/world/bufe-buyume';
import { ARSALAR } from '../content/esya';
import { createKarsiYasam, type YasamView } from './view/world/karsi-yasam';
import { createIcMekan, type IcView } from './view/world/ic-mekan-look';
import { restoranApi } from './sim/restoran';
import { MUTFAK_ROL_BY_ID } from '../content/mutfak';
import { rankOf } from '../content/ranks';
import { createIzgaraLook, type IzgaraLookView } from './view/world/izgara-look';
import { cellRect } from '../content/izgara';
import { createDekorLook, type DekorLookView } from './view/world/dekor-look';
import { createEvRoom, type EvRoomView } from './view/ev/ev-room';
import { createTipJar, type TipJarView } from './view/world/tip-jar';
import { createReklam, type ReklamView } from './view/world/reklam';
import { createHavaLook, type HavaLookView } from './view/world/hava-look';
import { createDenizLook, type DenizLookView } from './view/world/deniz-look';
import { createDenizUi, type DenizUiView } from './ui/deniz-ui';
import { createCalisanLook, type CalisanLookView } from './view/world/calisan-look';
import { createHuyMotion, type HuyMotionView } from './view/chars/huy-motion';
import { createAltinSimitFx, type AltinSimitFx } from './ui/altin-simit-fx';
import { createDisariLook, type DisariLookView } from './view/disari';
import { createStadyumView } from './view/stadyum';
import { createNightLights } from './view/world/night-lights';
import { createHedefCard, type HedefCard } from './ui/hedef-card';
import { createFaz2Hud, type Faz2Hud } from './ui/faz2-hud';
import { createStantLook, type StantLookView } from './view/world/stant-look';
import { BUFE } from '../content/prefabs/iskele/layout';

type AnyRec = Record<string, unknown>;
type Cmd = { kind: string; [k: string]: unknown };
const log: Logger = createLogger('marti');

/** Validation/repair on load (M0 subset; kept for callers, M1 uses sim/save.ts normalizeState). Mutates, returns notes. */
export function validateState(s: GameState): string[] {
  const n: string[] = [];
  const num = (k: 'money' | 'gold' | 'stars' | 'xp') => { if (!Number.isFinite(s[k]) || s[k] < 0) { n.push(`${k} ${s[k]} -> 0`); s[k] = 0; } };
  num('money'); num('gold'); num('stars'); num('xp');
  if (!Number.isFinite(s.day) || s.day < 1) { n.push('day -> 1'); s.day = 1; }
  if (!Number.isFinite(s.stage) || s.stage < 1 || s.stage > 10) { n.push('stage -> 1'); s.stage = 1; }
  if (!s.player || !Number.isFinite(s.player.x) || !Number.isFinite(s.player.z)) { n.push('player reset'); s.player = defaultState().player; }
  return n;
}

export async function boot(canvas: HTMLCanvasElement | null): Promise<void> {
  if (!canvas) throw new Error('#c canvas missing');
  const app = (document.getElementById('app') ?? document.body) as HTMLElement;
  const warnings: string[] = [];
  const target = ((window as unknown as { __marti?: AnyRec }).__marti ??= {});
  const hooks: TestHooks = createHooks({ target });

  let perf: PerfMeter | null = null;
  const warn = (name: string, e: unknown) => {
    const msg = `${name}: ${(e as Error)?.message ?? String(e)}`;
    warnings.push(msg); perf?.warn(`Yedek kullanılıyor: ${name}`);
    log.warn('fallback', msg);
  };
  function make<T>(name: string, fn: () => T): T | null {
    try { const v = fn(); if (v == null) throw new Error('returned nothing'); return v; } catch (e) { warn(name, e); return null; }
  }

  // ── platform, perf, quality
  // 2026-10-25 user: no local save. The game state lives in RAM and goes to the account's cloud save; ?autoplay / ?save= (tests, dev) keep the browser storage.
  const memStore = (): Storage => { const m = new Map<string, string>(); return { get length() { return m.size; }, key: (i: number) => [...m.keys()][i] ?? null, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); }, clear: () => m.clear() } as Storage; };
  const cloudOnly = !/[?&](autoplay|save|fresh|parity|edit)\b/.test(location.search);
  const platform: Platform = make('platform', () => cloudOnly ? createPlatform({ localStorage: memStore(), indexedDB: null }) : createPlatform()) ?? createPlatform({ localStorage: null, indexedDB: null });
  const params = platform.params;
  perf = make('perf', () => createPerf({ platform, root: app }));
  const P: PerfMeter = perf ?? createPerf({});
  perf = P;
  const quality: Quality = make('quality', () => createQuality({ platform, log })) ?? staticQuality(params.tier ?? 'dengeli');
  const contentReg = createContent();
  const content = contentReg.get();
  const playMode = !params.parity;

  // ── art + render (WebGL failure is the only fatal path)
  const dress: Dress | null = make('dress', () => createDress({ platform, noart: params.noart, log }));
  if (dress) {
    const mods = import.meta.glob('../content/art-manifest.ts', { eager: true }) as Record<string, AnyRec>;
    for (const m of Object.values(mods)) {
      const man = (m.ART_MANIFEST ?? m.artManifest ?? m.default) as ArtManifest | undefined;
      if (man) make('dress.manifest', () => { dress.manifest(man); return true; });
    }
  }
  let render: RenderPipeline | null = make('render', () => {
    const r = createRender({ canvas, quality, dress: dress as Dress, perf: P, log });
    r.init(canvas, quality.current());
    return r;
  });
  if (!render) render = fallbackRender(canvas, quality.current()); // throws if WebGL is unavailable -> #fail
  const R: RenderPipeline = render;
  const scene = R.scene;
  const cam = R.camera;
  (R as unknown as { onEnv?: (cb: (t: import('three').Texture | null) => void) => void }).onEnv?.(t => setGlbEnv(t));   // sky reflections on Kenney models
  let nightK = 0;
  (R as unknown as { onTime?: (cb: (t: { n: number }) => void) => void }).onTime?.(t => { setGlbNight(t.n); nightK = t.n; });   // building emissive lift fades at night

  // ── world + characters
  const prefab: PrefabSystem | null = dress ? make('prefab', () => createPrefabs({ dress, perf: P, log })) : null;
  const zones: ZoneManager | null = prefab && dress ? make('zones', () => createZones({ scene, prefab, dress, quality, perf: P, log })) : null;
  const nav: Nav = make('nav', () => createNav({ log })) ?? openNav();
  const anim: AnimApi | null = make('anim', () => createAnim({ log }));
  const fx: Fx | null = make('fx', () => createFx({ scene, quality, dress: dress ?? undefined, perf: P }));
  const chars: Chars | null = anim && dress ? make('chars', () => createChars({ scene, anim, dress, quality, fx: fx ?? undefined, perf: P })) : null;
  if (!(anim && dress)) warn('chars', new Error('skipped: anim/dress missing, capsule hero, no crowd'));
  let world: (GameView & AnyRec) | null = zones && prefab && dress
    ? make('world', () => createWorldView({ render: R, zones, prefab, dress }) as unknown as GameView & AnyRec) : null;
  if (!world) { if (!(zones && prefab && dress)) warn('world', new Error('skipped: zones/prefab/dress missing, grey box')); world = fallbackWorld(scene) as GameView & AnyRec; }
  const W = world;
  if (zones) {
    make('zones.flush', () => { (zones as unknown as { flush?: () => void }).flush?.(); return true; });
    // nav follows every re-bake (stage change, bought stations, editor overrides) and gets the exact colliders, so the
    // player collides with the real wall faces, not with 0.5 m cells
    const mz = zones as unknown as { colliders?: (id: string) => Rect[]; onGrid?: (cb: (id: string, g: WalkGrid) => void) => void };
    const navSync = (id: string, g: WalkGrid) => { nav.addGrid(g); if (mz.colliders) nav.setSolids(id, mz.colliders(id)); };
    for (const id of ['iskele', 'test-sokak', 'sahil', 'yokus', 'meydan', 'barinak', 'gece', 'stadyum', 'tersane', 'metro', 'tepe', 'adalar', 'orman']) {
      if (zones.def(id)) make(`nav.grid.${id}`, () => { navSync(id, zones.walkGrid(id)); return true; });
    }
    make('nav.follow', () => { mz.onGrid?.((id, g) => { try { navSync(id, g); } catch (e) { warn('nav.sync', e); } }); return true; });
  }

  // ── editor layout overrides (saved by the editor) applied in normal play too
  if (zones && !params.parity) {
    try {
      const ovm = await import('../engine/editor/overrides');
      const ov = await ovm.loadOverrides(platform);
      for (const id of Object.keys(ov.zones ?? {})) {
        const def = zones.def(id);
        if (def) make(`overrides.${id}`, () => { zones.replace(ovm.applyOverrides(def, ov)); return true; });
      }
    } catch (e) { warn('overrides', e); }
  }

  // ── ui, audio
  const audio: Audio | null = make('audio', () => createAudio({ platform, dress: dress ?? undefined }));
  let ui: Ui | null = make('ui', () => createUi({ root: app, platform, audio: audio ?? undefined }));
  const uiReal = !!ui;
  if (!ui) ui = fallbackUi(app);
  const U: Ui = ui;
  // M0 HUD driver only for the parity scene; in play the v2 hudNow fields come from the play view
  const hud: GameView | null = params.parity ? ((uiReal ? make('hud', () => createHud({ ui: U } as Parameters<typeof createHud>[0])) : null) ?? fallbackHud(U)) : null;
  const parity: Parity | null = make('parity', () => createParity({ on: params.parity, render: R, hooks, zones, prefab } as Parameters<typeof createParity>[0]));
  if (params.parity) make('ui.parity', () => { U.setMode('parity'); return true; });

  // ── input
  const input: Input = make('input', () => createInput({ canvas, root: app, platform })) ?? nullInput();
  input.setPicker(p => R.pick(p));
  let unlocked = false;
  const unlock = () => { if (unlocked) return; unlocked = true; make('audio.unlock', () => { audio?.unlock(); return true; }); };
  canvas.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);

  // ── save + sim (A's createGameSave over the engine store; the sim ref is late-bound)
  const seed = params.seed ?? (params.parity ? 1 : undefined);
  let sim!: SimFull;
  const simRef = {
    get state() { return sim ? sim.state : defaultState(seed ?? 1); },
    get rules() { return sim ? sim.rules : undefined; },
  } as unknown as SimFull;
  const save: SaveStore<GameState> = createGameSave(simRef, platform, { key: params.save ?? SAVE_KEY, log });
  const noSave = params.parity;
  // while visiting a room host's büfe (online.ts world) nothing is saved: the own state waits in ownBackup
  let guestWorld = false, ownBackup: string | null = null, kasaToast = 0, kasaFrom = '', kasaT = 0;
  const saveOn = () => !noSave && !guestWorld;
  let loaded: GameState | undefined;
  if (!params.fresh && !params.parity) {
    const r = await save.load();
    if (r.from !== 'fresh') loaded = r.data;
    if (r.repaired.length) P.warn(`Kayıt onarıldı: ${r.repaired.slice(0, 3).join(', ')}`);
  }
  const stage = params.stage ?? loaded?.stage ?? 1;
  const zStart = (() => {
    if (params.parity && parity) { const p = make('parity.playerStart', () => parity.playerStart(stage)); if (p) return p; }
    const fromWorld = (W.playerStart as ((s: number) => Vec2 | undefined) | undefined)?.(stage);
    return fromWorld ?? zones?.def('iskele')?.playerStart;
  })();
  sim = createSim(
    { seed: seed ?? loaded?.seed ?? 1, content, save: loaded, startClock: params.time !== undefined ? { hour: params.time } : undefined },
    { nav, anchors: zones ? (id => zones.anchors(id)) : undefined, perf: P, log, startPos: loaded ? undefined : zStart, now: () => platform.clock.now() },
  );
  // real calendar date (local) for the in-game calendar / seasons (hava.ts, dekor seasons); the sim never reads the wall clock
  if (playMode) make('calendar', () => { const dd = new Date(platform.clock.wall()); sim.state.calendar = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0'); return true; });
  if (params.stage !== undefined) sim.command({ kind: 'setStage', stage: params.stage });
  const callWorld = (fn: string, ...a: unknown[]) => make(`world.${fn}`, () => { (W[fn] as ((...x: unknown[]) => unknown) | undefined)?.(...a); return true; });
  callWorld('setStage', sim.state.stage, sim.state.renewed);
  if (parity) make('parity.crowd', () => { if (parity.on) parity.applyCrowd(sim.agents, sim.state.stage); return true; });
  const rt = () => sim.rules.rt;
  const command = (c: Cmd) => { try { sim.command(c); } catch (e) { log.error('command ' + c.kind, e); } };

  // D's tutorial (v2 TUT incl. cat/gull/Rıza/kapkaç arrows): a sim system, read by the play view
  const tutorial: Tutorial | null = playMode ? make('tutorial', () => installTutorial(sim.rules)) : null;

  const pose = { x: 0, z: 0, rot: 0 };
  const pos: Vec2 = pose; // same object: pos.x/pos.z are the interpolated ground position
  const walk = sim.walk;

  // world <- rules runtime (items, pads, dwell ring, ferry, window); workers carry B's item meshes
  if (playMode) {
    make('world.bindRules', () => { (W.bindRules as ((g: () => unknown, p: () => unknown) => void) | undefined)?.(() => sim.rules, () => ({ x: pos.x, z: pos.z, rot: pose.rot })); return true; });
    if (chars && typeof W.makeItem === 'function') make('chars.items', () => {
      (chars as MotorChars).setItemFactory(id => (W.makeItem as (p: string, t?: number) => Object3D)(id, (sim.state.tiers as Record<string, number>)[id] || 1));
      return true;
    });
  }
  // ferry kinds + tarife tahtası (ferry-look.ts)
  const ferryLook: FerryLookView | null = playMode && zones ? make('ferryLook', () => createFerryLook({ root: () => zones.root('iskele') ?? null, rules: () => sim.rules })) : null;

  const karsiLook: KarsiLookView | null = playMode && zones ? make('karsiLook', () => createKarsiLook({ root: () => zones.root('iskele') ?? null })) : null;
  const karsiBina: BinaView | null = playMode && zones ? make('karsiBina', () => createKarsiBina({ root: () => zones.root('iskele') ?? null, night: () => nightK, camera: () => cam.camera, hero: () => walk.pos })) : null;
  const bufeBuyume: BuyumeView | null = playMode && zones ? make('bufeBuyume', () => createBufeBuyume({ root: () => zones.root('iskele') ?? null, night: () => nightK, stage: () => sim.state.stage, tadilat: () => { const t = sim.state.tadilat as unknown as { to: number; left: number; total: number } | null; return t ? { to: t.to, p: 1 - t.left / Math.max(1, t.total) } : null; }, takim: () => (sim.state.zones as { arsa?: { takim?: { ad: string; renk: string; renk2?: string } | null } }).arsa?.takim ?? null, hero: () => walk.pos })) : null;
  // 2026-11-09 "her binaya girilebilmeli": interiors of every far-side building and the büfe halls
  const icMekan: IcView | null = playMode && zones ? make('icMekan', () => createIcMekan({ root: () => zones.root('iskele') ?? null, hero: () => walk.pos, night: () => nightK,
    isletme: () => { const m = mulkApi(sim.rules), o: Record<string, { lv: number; isci: number; esya: string[]; tema?: string }> = {}; if (m) for (const p of m.view().plots) if (p.sabit && p.owned) o[p.id] = { lv: p.lv, isci: p.isci, esya: (p as { esya?: string[] }).esya || [], tema: (p as { tema?: string }).tema || '' }; return o; },
    salon: () => ({ stage: sim.state.stage || 1, esya: ((sim.state.zones as { salon?: { esya?: string[] } }).salon?.esya) || [] }),
    mutfak: () => ({ ekip: sim.state.workers.filter(w => MUTFAK_ROL_BY_ID[w.role]).map(w => ({ rol: w.role, rank: rankOf(w.xp || 0) })), kds: (restoranApi(sim.rules)?.view().tickets || []).slice(0, 6).map(k => '#' + k.no + '  Masa ' + (k.table + 1) + ' · ' + k.items.filter(i => i.left).map(i => i.left + '× ' + i.name).join(', ')) }) })) : null;
  const karsiYasam: YasamView | null = playMode && zones && chars ? make('karsiYasam', () => createKarsiYasam({ root: () => zones.root('iskele') ?? null, chars, hero: () => walk.pos, hour: () => sim.clock.hour, sfx: id => { try { audio?.sfx(id); } catch { /* */ } }, isci: () => { const m = mulkApi(sim.rules); return m ? m.view().plots.filter(p => p.sabit && p.owned).map(p => ({ id: p.id, n: p.isci, lv: p.lv, esya: (p as { esya?: string[] }).esya || [] })) : []; } })) : null;
  const yolLook: YolLookView | null = playMode && zones ? make('yolLook', () => createYolLook({ root: () => zones.root('iskele') ?? null })) : null;

  const izgaraLook: IzgaraLookView | null = playMode && uiReal ? make('izgaraLook', () => createIzgaraLook({ scene, host: U.root })) : null;

  // ── hero (rebuilt when the hero changes: portrait pick, ayarlar)
  // Survey 2026-10-24: worn kıyafet (sim/kiyafet.ts) dresses the hero: top, bottom, shoes, cap colour
  const wornKey = () => JSON.stringify(kiyafetSave(sim.state).worn) + JSON.stringify(sim.state.zones.esnafim || null);
  // Survey 2026-10-24: clothes must read clearly on the hero. The v2 rig only reads `look`, so worn items go there,
  // the apron comes off when a top or costume is worn, and costumes swap the whole outfit.
  const KOSTUM: Record<string, Record<string, unknown>> = {
    bs_forma: { top: '#e0533c', topStyle: 'jersey', accent: '#ffffff', accent2: '#ffffff', pattern: 2, sleeves: 'short', bottom: '#ffffff', bottomStyle: 'shorts', shoes: '#ffffff' },
    kostum_palyaco: { top: '#e0533c', topStyle: 'overall', accent2: '#f0d35a', pattern: 3, sleeves: 'long', bottom: '#f0d35a', shoes: '#e0533c', hat: 'beanie', hatColor: '#3fb5b0', bowtie: '#f0d35a' },
    kostum_korsan: { top: '#f2f2f2', topStyle: 'shirt', sleeves: 'rolled', vest: '#3a2a22', accent: '#3a2a22', bottom: '#3a2a22', shoes: '#1e1712', hat: 'bandana', hatColor: '#1e1712' },
    kostum_takim: { top: '#f6f6f6', topStyle: 'suit', accent: '#2b2b33', tie: '#c0392b', sleeves: 'long', bottom: '#2b2b33', shoes: '#151518' },
  };
  const wornLook = (): Record<string, unknown> => {
    const w = kiyafetSave(sim.state).worn, L: Record<string, unknown> = {};
    const top = w.ust && kiyafetItem(w.ust), bot = w.alt && kiyafetItem(w.alt), shoe = w.ayakkabi && kiyafetItem(w.ayakkabi), hat = w.sapka && kiyafetItem(w.sapka);
    const aks = w.aksesuar && kiyafetItem(w.aksesuar), kos = w.kostum && kiyafetItem(w.kostum);
    if (top) {
      L.top = top.colors[0]; L.apron = null;
      L.topStyle = /hoodie|sweat/i.test(top.id + top.name) ? 'hoodie' : /ceket/i.test(top.name) ? 'jacket' : /kazak/i.test(top.name) ? 'cardigan' : /gömlek/i.test(top.name) ? 'shirt' : 'tee';
      if (top.colors[1]) { L.accent = top.colors[1]; L.accent2 = top.colors[1]; }
      if (/kareli/i.test(top.name)) L.pattern = 3; else if (/baskılı/i.test(top.name)) L.pattern = 1;
      L.sleeves = L.topStyle === 'tee' ? 'short' : 'long';
    }
    if (bot) { L.bottom = bot.colors[0]; L.bottomStyle = /şort/i.test(bot.name) ? 'shorts' : /etek/i.test(bot.name) ? 'skirt' : 'pants'; }
    if (shoe) L.shoes = shoe.colors[0];
    if (hat) { L.hat = /bucket/i.test(hat.name) ? 'bucket' : 'cap'; L.hatColor = hat.colors[0]; }
    if (aks && /gözlü/i.test(aks.name)) L.glasses = 'sun';
    if (kos) Object.assign(L, KOSTUM[kos.id] || { top: kos.colors[0], accent: kos.colors[1] }, { apron: null });
    // 2026-10-24 user: with bought clothes the curly hair + thick mustache looked awful. Dressed up = neat short hair,
    // thin mustache, no beard, so outfits and hats sit cleanly.
    if (Object.keys(L).length && !esnafimSave(sim.state).done) Object.assign(L, { hair: 'short', hairColor: '#1f1a17', temples: null, mustache: 'thin', beard: false });
    return L;
  };
  // 2026-10-24 açık dünya: the player's own esnaf (sim/esnafim.ts) is the base look; bought clothes go on top
  const heroLook = (k: HeroId) => {
    const e = esnafimSave(sim.state);
    if (e.done || sim.rules.rt.uiLast.esnafim) return esnafHeroOpts(e, wornLook());
    const look = wornLook();
    return k === 'sabriye'
      ? { kind: 'sabriye', typeId: 'sabriye', seed: 8, apron: 'SABRİYE', look }
      : { kind: 'sabri', typeId: 'sabri', seed: 7, apron: 'SABRİ', look };
  };
  let heroKind: HeroId = sim.state.hero === 'sabriye' ? 'sabriye' : 'sabri';
  const makeHeroNow = (k: HeroId): HeroHandle => (chars ? make('hero', () => chars.makeHero(heroLook(k) as never)) : null) ?? fallbackHero(scene);
  let H: HeroHandle = makeHeroNow(heroKind);
  let heroWorn = wornKey();
  const syncHeroKind = () => {
    const want: HeroId = sim.state.hero === 'sabriye' ? 'sabriye' : 'sabri';
    const wk = wornKey();
    if (want === heroKind && wk === heroWorn) return;
    heroWorn = wk;
    heroKind = want;
    try { H.dispose(); } catch { /* */ }
    H = makeHeroNow(want);
    H.setPose(pos, pose.rot);
  };

  // ── agents view (workers, regulars, gurme, kapkaççı, cats, Karamel, gulls, pigeons, far flock)
  const agentsOf = (): AgentsHandle | null => (sim.rules.rt as unknown as { agents?: AgentsHandle }).agents ?? null;
  const agentsView: AgentsView | null = playMode && chars ? make('agentsView', () => createAgentsView({
    chars: chars as MotorChars, quality, agents: agentsOf,
    player: () => ({ x: pos.x, z: pos.z, moving: walk.speed > 0.15 }),
  })) : null;

  // ── panels, labels, play view, audio map (play mode only)
  const extraSettings = (key: string, value: unknown) => {
    if (key === 'quality') make('quality.set', () => { quality.set(String(value) as QualitySetting); return true; });
    else if (key === 'hand') { const h = value === 'left' ? 'left' : 'right'; U.settings.hand = h; input.setHand(h); }
    else if (key === 'haptics') U.settings.haptics = !!value;
  };
  const copyReport = () => { void platform.copyText(P.report()).then(ok => U.toast(ok ? 'Rapor kopyalandı.' : 'Kopyalanamadı, hız ölçerden dene.', ok ? 'good' : 'info')); };
  const panels: Panels | null = playMode && uiReal ? make('panels', () => createPanels({
    ui: U, sim, models: { panelModel: panelModel as never, panelActions: panelActions as never }, audio: audio ?? undefined, extraSettings,
    perf: { visible: () => !!P.visible, show: (on: boolean) => { try { P.show(on); } catch { /* headless */ } }, copy: copyReport },
  })) : null;
  const labels = playMode && uiReal ? make('labels', () => createHtmlLabels(U.root)) : null;
  const project = (p: Vec3, out: ScreenPt) => R.worldToScreen(p, out);
  const playView: PlayView | null = panels && labels ? make('playView', () => createPlayView({
    ui: U, v2: panels.v2, labels, rules: () => sim.rules, command, project,
    hero: () => pos,
    tutorial: () => (tutorial ? tutorial.current() : null),
    marker: kind => (typeof W.marker === 'function' ? (W.marker as (k: string) => Object3D)(kind) : null),
    addToScene: o => scene.add(o),
    crowdHead: chars ? (slot, out) => (chars as MotorChars).crowd.headPos(slot, out) : undefined,
    actorHead: agentsView ? (id, out) => agentsView.headPos(id, out) : undefined,
    pan: at => { void cam.pan(at, 1.6); },
  })) : null;
  // Çarşı Sokağı esnaf rigs, bubbles and shop tags (view only; the street zone is streamed by the zones system)
  const carsi: CarsiView | null = ACIK_DUNYA && playMode && chars && zones && labels ? make('carsi', () => createCarsiView({
    scene, chars: chars as MotorChars, zones: zones as ZoneManager, labels, project, hour: () => sim.clock.hour,
    esnaf: () => esnafApi(sim.rules)?.view() ?? null, onEsnafTap: id => command({ kind: 'esnaf', op: 'open', id }),
  })) : null;
  // Canlı iskele anları: citizen chats, small random events, İskele Radyosu, real-clock rituals (view only)
  const moments: MomentsView | null = !FAZ2_LEAN && playMode && zones && labels ? make('moments', () => createMomentsView({
    scene, zones: zones as ZoneManager, labels, root: U.root, project, agents: () => sim.agents, hero: () => pos,
    crowdHead: chars ? (slot, out) => (chars as MotorChars).crowd.headPos(slot, out) : undefined,
    hour: () => sim.clock.hour, stage: () => sim.state.stage, camera: () => cam.camera,
  })) : null;
  // Dekor 2.0 on the kiosk (attic home, season garland, sign extras) + Sabri'nin Evi overlay (dekor-look.ts, ev-room.ts)
  const dekorLook: DekorLookView | null = playMode && zones ? make('dekorLook', () => createDekorLook({ root: () => zones.root('iskele') ?? null, rules: () => sim.rules, camera: () => cam.camera, hour: () => sim.clock.hour, command })) : null;
  const evRoom: EvRoomView | null = panels ? make('evRoom', () => createEvRoom({ root: U.root, rules: () => sim.rules, command })) : null;
  // Mini oyunlar overlay + içecek ustalık baloncuğu (ui/mini-games.ts, survey mini-1..11)
  const miniGames: MiniGamesView | null = panels ? make('miniGames', () => createMiniGames({ root: U.root, rules: () => sim.rules, command, sfx: id => { try { audio?.sfx(id); } catch { /* */ } } })) : null;
  // Hikaye: chapter finales, character tutorials, absurd moments, rival action cards (ui/hikaye-scene.ts, survey hikaye-1..7)
  const hikayeScene: HikayeSceneView | null = panels ? make('hikayeScene', () => createHikayeScene({ root: U.root, rules: () => sim.rules as never, command, sfx: (id, o) => { try { audio?.sfx(id, o); } catch { /* */ } } })) : null;
  // Hedefler kartı (DOM) and the bahşiş kavanozu on the counter (goals.ts)
  const hedefCard: HedefCard | null = panels && labels ? make('hedefCard', () => createHedefCard({ root: U.root, v2: panels.v2 as never, rules: () => sim.rules, command, sfx: id => { try { audio?.sfx(id); } catch { /* */ } } })) : null;
  const tipJar: TipJarView | null = playMode ? make('tipJar', () => createTipJar({ scene, rules: () => sim.rules })) : null;
  const stantLook: StantLookView | null = playMode ? make('stantLook', () => createStantLook({ scene, rules: () => sim.rules })) : null;
  if (playMode && uiReal) (sim.rules.rt as unknown as { gunSonuCard?: boolean }).gunSonuCard = true;   // headless sims/tests roll days over without the card
  // 2026-10-24 açık dünya: online ilk deneme over the claude.ai room (online.ts); offline anywhere else
  const online = playMode && uiReal ? make('online', () => createOnline({ scene, chars, root: U.root, project, toast: t => U.toast(t, 'info'),
    me: () => ({ pos: walk.pos, rot: walk.rot, speed: walk.speed, esnaf: esnafimSave(sim.state), region: regionAt(walk.pos.x)?.id || 'iskele', act: walk.speed > 0.1 ? 'walk' : heroAct(sim.rules.rt.act) }),
    world: {
      get: () => { const o = { ...sim.state } as AnyRec; delete o.settings; delete o.player; delete o.lastSeen; const z = { ...(o.zones as AnyRec) }; delete z.esnafim; o.zones = z; return JSON.stringify(o); },
      sig: () => { const S = sim.state as unknown as AnyRec; return JSON.stringify([S.owned, S.padPaid, S.tiers, S.stage, S.renewed, S.tadilat, S.decorOwned, S.decorSlots, S.sign, (S.workers as unknown[] | undefined)?.length, S.kepenk, (S.zones as AnyRec | undefined)?.restoran]); },
      apply: (json: string) => {
        if (!ownBackup) { if (saveOn()) void save.save('manual'); ownBackup = JSON.stringify(sim.state); }
        const own = JSON.parse(ownBackup) as AnyRec, h = JSON.parse(json) as AnyRec;
        const m = { ...h, player: own.player, settings: own.settings, hero: own.hero, lastSeen: own.lastSeen, zones: { ...(h.zones as AnyRec), esnafim: (own.zones as AnyRec).esnafim } };
        guestWorld = true; sim.load(m as never);
      },
      earned: () => Number(sim.state.totalEarned) || 0,
      money: () => sim.state.money,
      setMoney: (n: number) => { sim.state.money = n; },
      addKasa: (n: number, from: string) => { sim.state.money += n; sim.state.totalEarned += n; kasaToast += n; kasaFrom = from; },
      leave: () => { if (ownBackup) { sim.load(JSON.parse(ownBackup)); ownBackup = null; } guestWorld = false; },
    } })) : null;
  // 13:05 user: kullanıcı adı + şifre (giris.ts, net/supa.ts). A login pulls the newer cloud save; while signed in the
  // save goes up every minute and when the tab hides.
  const giris = playMode && uiReal && params.raw.autoplay === undefined ? make('giris', () => createGiris({ root: U.root, sfx: id => { try { audio?.sfx(id); } catch { /* */ } },
    afterLogin: async (isNew: boolean) => {
      // 2026-10-25 user: a different account must NOT inherit the previous account's progress. The local save remembers
      // which account owns it; an unowned (guest/legacy) save is claimed by the first account that logs in.
      const me = hesap(); if (!me) return;
      let owner = ''; try { owner = localStorage.getItem('martikoy-save-owner') || ''; } catch { /* */ }
      // J2: an empty slot always starts a fresh character (kulis opens, the name is chosen once)
      const slotFresh = slotYeni();
      const foreign = (!!owner && owner !== me.id) || slotFresh;
      const c = await bulutOku();
      let synced = ''; try { synced = localStorage.getItem('martikoy-cloud-synced') || ''; } catch { /* */ }
      const wiped = !c && synced === me.id;   // it had a cloud save before and an admin deleted it
      if (c && c.code && (foreign || c.playT > (sim.state.playT || 0)) && await save.importCode(c.code)) { const r = await save.load(); sim.load(r.data); }
      else if (foreign || wiped) { sim.load(defaultState(seed ?? 1) as never); esnafimSave(sim.state).done = false; }
      if (slotFresh) esnafimSave(sim.state).done = false;
      else if (isNew) esnafimSave(sim.state).done = false;
      { const bk = bankaOku(); (sim.rules.rt as unknown as { banka: unknown }).banka = { tl: bk.tl, esya: bk.esya, dirty: false }; }   // the account bank, shared by all 4 slots
      try { localStorage.setItem('martikoy-save-owner', me.id); if (c) localStorage.setItem('martikoy-cloud-synced', me.id); } catch { /* */ }
      if (isNew && !foreign) return;
      if ((foreign || wiped) && !(c && c.code)) void save.save('manual');
    } })) : null;
  let adminEditor: () => void = () => { /* set below once the editor deps exist */ };
  const adminPanel = playMode && uiReal && online ? make('adminPanel', () => createAdminPanel({ root: U.root, peers: () => online.peers(), toast: t => U.toast(t, 'info'), sfx: id => { try { audio?.sfx(id); } catch { /* */ } },
    teleport: (x, z) => { sim.command({ kind: 'teleport', x, z }); camHold = null; cam.snap(walk.pos); }, myPos: () => ({ x: walk.pos.x, z: walk.pos.z }),
    addMoney: n => { sim.state.money = Math.max(0, sim.state.money + n); }, addGold: n => { sim.state.gold = Math.max(0, (sim.state.gold || 0) + n); },
    setMoney: n => { sim.state.money = n; }, setGold: n => { sim.state.gold = n; }, editor: () => adminEditor(), stands: () => (restoranApi(sim.rules)?.view().stands ?? []).map(t => ({ id: t.id, name: t.name, owned: t.owned, x: t.x, z: t.z })), izgara: () => { const v = !(izgaraLook?.get()); izgaraLook?.set(v); return v; },
    resetMe: () => { void (async () => { try { sim.load(defaultState(seed ?? 1) as never); esnafimSave(sim.state).done = false; await save.save('manual'); if (hesap()) { const code = await save.exportCode(); await bulutYaz(code, 0, esnafimSave(sim.state), 1); } } finally { location.reload(); } })(); },
    command: c => command(c as never), setLevel: n => { sim.state.level = n; }, allPadKeys: () => PAD_KEYS.filter(k => k !== 'tadilat'),
    isletme: () => { const S = sim.state, z = S.zones as { arsa?: { plots?: Record<string, { lv: number; isci?: number }>; takim?: { ad: string } | null } }, t = S.tadilat as unknown as { to: number; left: number } | null; return { stage: S.stage, tadilat: t ? { to: t.to, left: t.left } : null, money: S.money, gold: S.gold || 0, level: S.level, stars: S.stars, kafeler: ARSALAR.filter(a => a.sabit).map(a => ({ id: a.id, ad: a.ad || a.id, lv: z.arsa?.plots?.[a.id]?.lv || 0, isci: z.arsa?.plots?.[a.id]?.isci || 0 })), takim: z.arsa?.takim?.ad ?? null, mevsim: mevsimZorla() }; },
    setMevsim: k => mevsimZorla(k),
    setMuted: m => { sim.state.settings.muted = m; if (audio) for (const b of Object.values(audio.buses)) (b as { muted: boolean }).muted = m; } })) : null;
  // J2: back to the slot screen (save first, then sign out and reload: the login screen opens again)
  window.addEventListener('martikoy:karakter', () => { void (async () => { try { if (hesap() && saveOn()) { const code = await save.exportCode(); await bulutYaz(code, sim.state.playT || 0, esnafimSave(sim.state), sim.state.level || 1); } await cikisYap(); } finally { location.reload(); } })(); });
  let bulutT = 45;
  const bulutPush = () => { if (!hesap() || !saveOn()) return; void save.exportCode().then(code => bulutYaz(code, sim.state.playT || 0, esnafimSave(sim.state), sim.state.level || 1).then(() => { try { const h = hesap(); if (h) localStorage.setItem('martikoy-cloud-synced', h.id); } catch { /* */ } })).catch(() => { /* next time */ }); };
  const yetenekBtn = playMode && uiReal ? make('yetenekBtn', () => createYetenekBtn({ root: U.root, rules: () => sim.rules, command: c => command(c as never) })) : null;
  const kulis = playMode && uiReal ? make('kulis', () => createKulis({ root: U.root, rules: () => sim.rules, command: c => command(c as never), chars: chars as never, sfx: id => { try { audio?.sfx(id); } catch { /* */ } },
    dolap: () => { const z = kiyafetSave(sim.state); return { owned: z.owned, worn: z.worn as Record<string, string>, gold: sim.state.gold || 0 }; }, worn: () => wornLook() })) : null;
  const gunSonu = playMode && uiReal ? make('gunSonu', () => createGunSonu({ root: U.root, rules: () => sim.rules, command, sfx: id => { try { audio?.sfx(id); } catch { /* */ } } })) : null;
  const haliSaha = playMode && uiReal ? make('haliSaha', () => createHaliSaha({ root: U.root, rules: () => sim.rules as never, command, chars: chars as never, esnaf: () => esnafimSave(sim.state) as never, sfx: id => { try { audio?.sfx(id); } catch { /* */ } } })) : null;
  const faz2Hud: Faz2Hud | null = panels && labels ? make('faz2Hud', () => createFaz2Hud({ root: U.root, rules: () => sim.rules, command, sfx: id => { try { audio?.sfx(id); } catch { /* */ } } })) : null;
  // iskele reklamları + marka tabelası (reklam.ts, survey marka-5/7)
  const reklam: ReklamView | null = playMode && zones ? make('reklam', () => createReklam({ scene, root: () => zones.root('iskele') ?? null, rules: () => sim.rules })) : null;
  // Hava, mevsimler, etkinlikler: rain/snow/fog/lodos, season tint and trees, umbrellas, event banner, Gece Pazarı (hava-look.ts)
  const havaLook: HavaLookView | null = playMode ? make('havaLook', () => createHavaLook({
    scene, root: () => zones?.root('iskele') ?? null, rules: () => sim.rules, render: R, focus: () => cam.focus(), agents: () => sim.agents,
    crowdHead: chars ? (slot, out) => (chars as MotorChars).crowd.headPos(slot, out) : undefined, labels, project, uiRoot: uiReal ? U.root : null,
    hour: () => sim.clock.hour, command, sfx: id => { try { audio?.sfx(id); } catch { /* */ } },
    float: (x, z, text) => { const sp = { x: 0, y: 0 }; if (panels && project({ x, y: 2.6, z }, sp)) panels.v2.float(sp.x, sp.y, text, 'good'); },
  })) : null;
  // PaketMartı: counter tablet + parked courier bikes (view/world/kurye-look.ts) and the fiş / live map / Sen götür overlay (ui/kurye-ui.ts)
  // Çalışanlar 2.0: Ayın Elemanı photo, pasta, çay köşesi, Dinlenme Bankı sitters (view/world/calisan-look.ts) + huy motion (view/chars/huy-motion.ts)
  const calisanLook: CalisanLookView | null = playMode ? make('calisanLook', () => createCalisanLook({ scene, rules: () => sim.rules, chars: (chars as MotorChars) ?? null })) : null;
  const huyMotion: HuyMotionView | null = playMode && chars && agentsView ? make('huyMotion', () => createHuyMotion({ scene, chars: chars as MotorChars, agents: agentsOf, rigOf: id => agentsView.rigOf(id) })) : null;
  // Deniz: sea life, boats, extra animals, ferry rope/bump, glitter, kiosk exterior, table kinds, pier expansions (deniz-look.ts) + deck run / photo / boat offer cards and the ferry interior (deniz-ui.ts)
  const denizLook: DenizLookView | null = !FAZ2_LEAN && playMode && zones ? make('denizLook', () => createDenizLook({ root: () => zones.root('iskele') ?? null, rules: () => sim.rules, hour: () => sim.clock.hour })) : null;
  const denizUi: DenizUiView | null = !FAZ2_LEAN && panels ? make('denizUi', () => createDenizUi({ root: U.root, rules: () => sim.rules, command, sfx: id => { try { audio?.sfx(id); } catch { /* */ } } })) : null;
  // Altın Fırın on the pier corner + kapak panosu + başarım vitrini, and the rolling-simit 'çın' moment (koleksiyon.ts)
  // Faz 2: Altın Fırın (collections) removed from the pier
  const altinFx: AltinSimitFx | null = panels ? make('altinFx', () => createAltinSimitFx({ root: U.root, rules: () => sim.rules })) : null;
  const nightLights = playMode && zones ? make('nightLights', () => createNightLights({ scene, zones })) : null;
  // Martıköy: neighbourhood labels, guide cat, ferris wheel, barrier, pier props (view/disari) 
  const disariLook: DisariLookView | null = ACIK_DUNYA && playMode && zones && labels ? make('disariLook', () => createDisariLook({
    scene, zones: zones as ZoneManager, labels, project, rules: () => sim.rules, hero: () => pos, hour: () => sim.clock.hour, command,
    makeCat: chars ? (o => (chars as MotorChars).makeCat(o)) : undefined,
  })) : null;
  // karar paketi G: Envanter / Mülk panel (banka, günlük tahta, arsa, stadyum); the bank mirrors the cloud account record
  const mulkPanel = playMode && uiReal ? make('mulkPanel', () => createMulkPanel({ root: U.root, rules: () => sim.rules, command, sfx: id => { try { audio?.sfx(id); } catch { /* */ } } })) : null;
  if (mulkPanel) U.root.addEventListener('ui:open', e => { const id = (e as CustomEvent).detail as string; if (id === 'envanter') mulkPanel.open('envanter'); else if (id === 'mulk') mulkPanel.open('mulk'); });
  const mulkView = ACIK_DUNYA && playMode && labels ? make('mulkView', () => createMulkView({ scene, labels, project, rules: () => sim.rules, hero: () => pos, setSolid: r => nav.setSolids('mulk', r) })) : null;
  const stadyumView = ACIK_DUNYA && playMode && labels ? make('stadyumView', () => createStadyumView({ scene, labels, project, rules: () => sim.rules, hero: () => pos, setSolid: r => nav.setSolids('stadyum-kulup', r) })) : null;
  const bankaRt = () => (sim.rules.rt as unknown as { banka?: { tl: number; esya: Record<string, number>; dirty: boolean } }).banka;
  let bankaT = 0;
  // 16:52 user: 42B bus from the stop across the büfe to Belgrad Ormanı (view/orman, ui/otobus-hud)
  const ormanView = ACIK_DUNYA && playMode ? make('ormanView', () => createOrmanView({ scene, rules: () => sim.rules, hero: () => pos, chars: chars as never, hour: () => sim.clock.hour, setSolid: r => nav.setSolids('otobus', r) })) : null;
  // the glass shelter is solid too (back + side panels), you wait in front of it
  if (ormanView) { try { nav.setSolids('durak', [{ x0: 3.9, x1: 8.1, z0: 14.4, z1: 14.75 }, { x0: 3.85, x1: 4.15, z0: 12.9, z1: 14.75 }, { x0: 7.85, x1: 8.15, z0: 12.9, z1: 14.75 }]); } catch { /* */ } }
  const otobusHud = ACIK_DUNYA && playMode && uiReal ? make('otobusHud', () => createOtobusHud({ root: U.root, rules: () => sim.rules, command, hour: () => sim.clock.hour, sfx: id => { try { audio?.sfx(id); } catch { /* */ } } })) : null;
  const audioMap: AudioMap | null = playMode && audio ? make('audioMap', () => createAudioMap({
    bus: sim.bus, audio, playerPos: () => pos, phase: () => sim.clock.phase,
    // ses-1 place signature: Sabri'nin evi overlay, Çarşı Sokağı by position, else the pier
    // 16:52 user: music + ambience follow the place: every region has its own (orman, gece pazarı, sahil...), the halı saha match its stand
    zone: () => { if (evRoom?.isOpen()) return 'ev'; if (document.querySelector('.hs-game')) return 'halisaha'; const r = regionAt(pos.x); return r ? r.id : 'iskele'; },
    crowd: () => Math.min(1, (sim.agents.count || 0) / 45),
    weather: () => havaApi(sim.rules)?.view().kind ?? 'acik',
    season: () => havaApi(sim.rules)?.view().season ?? 'sonbahar',
    grill: () => { const a = zones?.anchors('iskele')?.['stations.doner']; return a ? a.pos : null; },
    root: uiReal ? U.root : null,
  })) : null;
  // ses / animasyon juice: particles, emotes, coin fly, unlock pop, flag, kepenk, haptics (view/juice.ts)
  const juice: JuiceView | null = playMode ? make('juice', () => createJuice({
    bus: sim.bus, fx, hero: () => H, heroPos: () => pos, speed: () => walk.speed,
    anchors: () => zones?.anchors('iskele') ?? {}, zoneRoot: () => zones?.root('iskele') ?? null,
    uiRoot: uiReal ? U.root : null, project, agents: () => sim.agents,
    crowdHead: chars ? (slot, out) => (chars as MotorChars).crowd.headPos(slot, out) : undefined,
    haptics: () => U.settings.haptics !== false && sim.state.settings.haptics !== false,
    sfx: (id, at) => { try { audio?.sfx(id, at ? { at } : undefined); } catch { /* */ } },
    pan: at => { void cam.pan(at, 1.2); },
    squashPop: anim ? (o, a) => anim.squashPop(o, a) : undefined,
  })) : null;
  // HUD speaker + saved mute / hand
  U.root.addEventListener('ui:mute', e => command({ kind: 'setSetting', key: 'muted', value: !!(e as CustomEvent).detail }));
  if (audio && sim.state.settings.muted) { for (const b of Object.values(audio.buses)) b.muted = true; }
  if (audio) make('audio.saved', () => { const st = sim.state.settings; audio.buses.music.volume = st.music ?? 0.8; audio.buses.sfx.volume = st.sfx ?? 1; audio.buses.voice.volume = st.voice ?? 1; audio.ownMusicMode(!!st.ownMusic); return true; }); // ses-5 saved sliders + own music
  if (sim.state.settings.hand === 'left') extraSettings('hand', 'left');

  // ── tier changes
  const applyTier = (t: TierDef) => {
    make('render.setTier', () => { R.setTier(t); return true; });
    if (chars) make('crowd.setBudget', () => { chars.crowd.setBudget(t.crowd); return true; });
    if (fx) make('fx.setTier', () => { fx.setTier(t); return true; });
    sim.state.settings.autoTier = t.name;
  };
  quality.onChange(applyTier);
  if (chars) make('crowd.setBudget', () => { chars.crowd.setBudget(quality.current().crowd); return true; });
  sim.state.settings.quality = quality.setting();

  // ── per-frame guarded calls
  const strikes = new Map<string, number>();
  const guard = (name: string, fn: () => void) => {
    const s = strikes.get(name) ?? 0;
    if (s >= 3) return;
    try { fn(); } catch (e) {
      strikes.set(name, s + 1);
      log.error(`frame part ${name} threw`, e);
      if (s + 1 >= 3) P.warn(`Kapandı: ${name}`);
    }
  };

  let camHold: Vec2 | null = null;
  let timeT = 0, lastHour = -1, simT = 0, camTick = sim.tick;
  cam.snap(walk.pos);

  const heroAct = (a: string) => (a === 'cut' || a === 'pour' ? a : (sim.rules.rt as unknown as { yetenek?: { dans?: boolean } }).yetenek?.dans ? 'dance' : 'idle');
  let signKey = '';
  const syncSign = () => {
    if (sim.state.sign) { signKey = ''; return; }
    const want = defaultSign(sim.state.hero);
    if (want !== signKey) { signKey = want; callWorld('setSign', want, 'vapur'); }
  };

  // frame trace for smoothness tests: hooks.trace(true) records [time, heroX, heroZ, camX, camZ] per render, trace(false) returns it
  let synthT: number | null = null;
  let warmPend = -1;
  let tracing = false; let traceBuf: number[][] = [];
  const renderFrame = (fdt: number, alpha: number) => {
    const t0 = platform.clock.now();
    const st = input.poll();
    if (st.pinch && st.pinch !== 1) cam.zoom = cam.zoom * st.pinch;
    if (st.orbit) (cam as unknown as { turn(d: number): void }).turn(st.orbit);
    if (st.tilt) (cam as unknown as { tilt(d: number): void }).tilt(st.tilt);
    if (st.recenter) (cam as unknown as { recenter(): void }).recenter();
    if (st.moving) camHold = null;
    lerpPose(walk, alpha, pose);
    simT += fdt;
    if (zones) guard('zones', () => { P.begin('zones.build'); zones.update(pos, cam.frustum()); P.end('zones.build'); });
    const df = sim.rules.rt.uiLast.decorFocus as { x: number; z: number; until: number } | undefined;   // Faz 2: show a bought decor item
    if (df && !(df as AnyRec).sparked) { (df as AnyRec).sparked = true; try { (W as unknown as { sparkle?(p: unknown, n?: number, c?: string): void }).sparkle?.({ x: df.x, y: 1.0, z: df.z }, 40, '#ffd23f'); } catch { /* */ } }
    if (df && sim.state.playT > df.until) { delete sim.rules.rt.uiLast.decorFocus; if ((df as AnyRec).reopen) cmd('openPanel', { id: 'dekor' }); }
    const inBufe = pos.x > BUFE.x0 && pos.x < BUFE.x1 && pos.z > BUFE.z0 && pos.z < BUFE.z1;   // Faz 2 (38): inside the büfe the camera centres on it
    const bufeFocus = { x: (BUFE.x0 + BUFE.x1) / 2, z: (BUFE.z0 + BUFE.z1) / 2 };
    guard('camera.follow', () => cam.follow((t => onUg(t.x, t.z) ? { x: t.x, z: t.z, y: ugY(t.x, t.z) } : t)(df && sim.state.playT <= df.until ? df : camHold ?? (inBufe ? { x: pos.x + (bufeFocus.x - pos.x) * 0.25, z: pos.z + (bufeFocus.z - pos.z) * 0.25 } : pos)), fdt));
    if (playMode) guard('sign', syncSign);
    guard('world', () => W.update(sim.state, fdt, alpha));
    if (ferryLook) guard('ferryLook', () => ferryLook.update(fdt));
    if (yolLook) guard('yolLook', () => yolLook.update(fdt));
    if (karsiLook) guard('karsiLook', () => karsiLook.update(fdt));
    if (karsiBina) guard('karsiBina', () => karsiBina.update(fdt));
    if (bufeBuyume) guard('bufeBuyume', () => bufeBuyume.update(fdt));
    if (karsiYasam) guard('karsiYasam', () => karsiYasam.update(fdt));
    if (icMekan) guard('icMekan', () => icMekan.update(fdt));
    if (tipJar) guard('tipJar', () => tipJar.update(fdt));
    if (stantLook) guard('stantLook', () => stantLook.update(fdt));
    if (faz2Hud) guard('faz2Hud', () => faz2Hud.update(fdt));
    if (gunSonu) guard('gunSonu', () => gunSonu.update());
    if (kulis) guard('kulis', () => kulis.update(fdt));
    if (yetenekBtn) guard('yetenekBtn', () => yetenekBtn.update());
    if (online) guard('online', () => online.update(fdt));
    if (adminPanel) guard('adminPanel', () => adminPanel.update(fdt));
    if (kasaToast > 0 && (kasaT -= fdt) <= 0) { kasaT = 6; U.toast(kasaFrom + ' kasaya +' + Math.floor(kasaToast) + ' ₺ kattı!', 'good'); kasaToast = 0; }
    if (haliSaha) guard('haliSaha', () => haliSaha.update());
    if (reklam) guard('reklam', () => reklam.update(fdt));
    if (havaLook) guard('havaLook', () => havaLook.update(fdt));
    if (altinFx) guard('altinFx', () => altinFx.update(fdt));
    if (disariLook) guard('disariLook', () => disariLook.update(fdt));
    if (ormanView) guard('ormanView', () => ormanView.update(fdt));
    if (mulkPanel) guard('mulkPanel', () => mulkPanel.update(fdt));
    if (mulkView) guard('mulkView', () => mulkView.update(fdt));
    if (stadyumView) guard('stadyumView', () => stadyumView.update(fdt));
    if ((bankaT -= fdt) <= 0) { bankaT = 2; const b = bankaRt(); if (b?.dirty && hesap()) { b.dirty = false; void bankaYaz({ tl: b.tl, esya: b.esya }); } }
    if (otobusHud) guard('otobusHud', () => otobusHud.update(fdt));
    if (nightLights) guard('nightLights', () => nightLights.update(pos, sim.clock.hour));
    if (playMode) guard('heroKind', syncHeroKind);
    guard('hero', () => {
      const r = rt();
      H.setPose(pos, pose.rot);
      const moving = walk.speed > 0.1;
      H.setInput({ speed: walk.speed, carry: playMode && r.carry.length ? Math.min(1, 0.35 + r.carry.length / 8) : 0, act: moving ? 'walk' : (playMode ? heroAct(r.act) : 'idle'), mood: playMode && r.streak >= 2 ? 'happy' : 'ok', t: simT, oneHand: (sim.state.level || 1) >= 8 } as never);
      const hs = (H as unknown as { setState?: (s: AnyRec | null) => void }).setState;
      if (hs && playMode) hs.call(H, !moving && r.act === 'count' ? { act: 'count' } : null);
      H.update(fdt, alpha);
    });
    if (agentsView) guard('agents', () => { P.time('agents', () => agentsView.update(sim.state, fdt, alpha)); });
    if (huyMotion) guard('huyMotion', () => huyMotion.update(fdt));
    if (calisanLook) guard('calisanLook', () => calisanLook.update(fdt));
    if (chars) guard('crowd', () => { P.time('crowd', () => { chars.crowd.update(sim.agents, fdt, alpha); chars.update(fdt, alpha); }); });
    if (carsi) guard('carsi', () => carsi.update(fdt));
    if (moments) guard('moments', () => moments.update(fdt));
    if (dekorLook) guard('dekorLook', () => dekorLook.update(fdt));
    if (denizLook) guard('denizLook', () => denizLook.update(fdt));
    if (evRoom) guard('evRoom', () => evRoom.update(fdt));
    if (miniGames) guard('miniGames', () => miniGames.update(fdt));
    if (hikayeScene) guard('hikayeScene', () => hikayeScene.update(fdt));
    if (denizUi) guard('denizUi', () => denizUi.update(fdt));
    if (fx) guard('fx', () => fx.update(fdt));
    if (anim) guard('anim', () => anim.update(fdt));
    timeT -= fdt;
    const hour = sim.clock.hour;
    if (timeT <= 0 || (sim.timeFrozen && hour !== lastHour)) {
      timeT = 0.2;
      if (hour !== lastHour) { lastHour = hour; guard('setTime', () => { R.setTime(hour, sim.clock.season); havaLook?.relight(); }); }
    }
    // v2 counted the intro descent down in the sim step: when hooks step the sim far ahead of render dt (?noloop bots),
    // let the camera catch up by sim time so the intro does not hang for minutes of game time. Live loop is untouched.
    const simDt = (sim.tick - camTick) / 30; camTick = sim.tick;
    const introLeft = (cam as { introLeft?: number }).introLeft ?? 0;
    const camDt = introLeft > 0 && simDt > fdt * 2 + 0.05 ? Math.min(simDt, 1) : fdt;
    guard('camera.update', () => cam.update(camDt, alpha));
    guard('ui', () => U.update(fdt, project));
    if (hud) guard('hud', () => hud.update(sim.state, fdt, alpha));
    if (panels) guard('panels', () => panels.update());
    if (playView) guard('playView', () => playView.update(fdt));
    if (hedefCard) guard('hedefCard', () => hedefCard.update(fdt));
    if (audioMap) guard('audioMap', () => audioMap.update());
    if (juice) guard('juice', () => juice.update(fdt));
    // 2026-11-09 Chrome freeze: when streamed zones finish building, ask three to compile their shaders in parallel
    // (KHR_parallel_shader_compile) before they are drawn, instead of a blocking compile on first sight
    if (zones) { const pend = zones.pending(); if (pend === 0 && warmPend !== 0) { const ren = R.renderer as unknown as { compileAsync?: (s: unknown, c: unknown) => Promise<unknown> } | null; ren?.compileAsync?.(scene, cam.camera)?.catch(() => { /* ignore */ }); } warmPend = pend; }
    guard('render', () => P.time('render', () => R.frame(scene, cam.camera, alpha)));
    if (tracing) traceBuf.push([synthT ?? t0, pos.x, pos.z, cam.camera.position.x, cam.camera.position.z]);
    const ms = platform.clock.now() - t0;
    P.frame(fdt * 1000);
    P.count('frameWorkMs', ms);
    quality.feed(fdt * 1000, fdt);
    if (saveOn()) {
      save.tick(platform.clock.wall());
      if (sim.rules.ext.takeDirty()) void save.save('purchase');
      if ((bulutT -= fdt) <= 0) { bulutT = 60; bulutPush(); }
    }
  };

  // ── loop
  const batterySaver = () => !!U.settings?.batterySaver || !!sim.state.settings.batterySaver;
  const loop = createLoop({
    step: () => {
      P.time('sim', () => {
        { const mv = input.state().move, yw = (cam as unknown as { yaw?: number }).yaw || 0; if (yw !== 0 && (mv.x || mv.z)) { const cs = Math.cos(yw), sn = Math.sin(yw); sim.input({ x: mv.x * cs + mv.z * sn, z: -mv.x * sn + mv.z * cs }); } else sim.input(mv); }
        sim.tickOnce();
      });
      if (saveOn()) save.markDirty();
    },
    render: renderFrame,
    targetFps: () => (batterySaver() ? 30 : quality.current().fps),
    onError: (where, e) => log.error(`loop ${where}`, e),
  });

  // ── pause reasons: visibility + context loss
  const pauses = new Set<string>();
  const pause = (why: string) => { pauses.add(why); loop.pause([...pauses].join('+')); };
  const resume = (why: string) => { pauses.delete(why); if (!pauses.size) loop.resume(); else loop.pause([...pauses].join('+')); };
  platform.visibility.onChange(hidden => {
    if (hidden) {
      pause('hidden');
      if (saveOn()) void save.save('hidden').then(bulutPush);
      if (audio) make('audio.suspend', () => { audio.suspend(true); return true; });
    } else {
      resume('hidden');
      if (audio) make('audio.suspend', () => { audio.suspend(false); return true; });
    }
  });
  R.onContextLost(() => { pause('context'); sim.bus.emit('contextLost', undefined); });
  R.onContextRestored(() => { resume('context'); sim.bus.emit('contextRestored', undefined); guard('render', () => R.frame(scene, cam.camera, 1)); });

  // ── perf sources
  P.source('render', () => ({ ...R.info(), tier: quality.current().name }));
  if (zones) P.source('zones', () => ({ zones: zones.states() }));
  if (fx) P.source('fx', () => ({ particles: fx.live() }));
  if (agentsView) P.source('agents', () => ({ counters: { rigs: agentsView.stats().rigs } }));
  P.source('boot', () => ({ warnings: [...warnings] }));
  if (sim.state.settings.perfMeter) P.show(true);

  // ── start flow (v2): title -> hero pick -> play; a played save goes straight in with welcome back
  const dropOverlay = (sel: string) => { document.querySelectorAll(sel).forEach(el => el.remove()); };
  const goPlay = (hero: HeroId, fresh: boolean) => {
    if (sim.rules.rt.started) return;
    command({ kind: 'play', hero });
    syncHeroKind();
    playView?.reset();
    if (fresh) { void cam.intro(3.2); }
    else if (loaded && sim.state.lastSeen > 0) {
      const away = (platform.clock.wall() - sim.state.lastSeen) / 1000;
      if (!FAZ2_LEAN) make('welcomeBack', () => { sim.rules.welcomeBack(away); return true; });
    }
    if (saveOn()) void save.save('manual');
    // 2026-10-24 açık dünya: a player without an esnaf of their own makes one first (old saves too); ?yarat forces it
    if (!esnafimSave(sim.state).done && (params.raw.autoplay === undefined || params.raw.yarat !== undefined)) command({ kind: 'esnafim', op: 'open' } as never);
  };
  const startFlow = () => {
    const S = sim.state;
    if (loaded && S.hero && S.playT > 0 && params.raw.autoplay === undefined && giris) { giris.show(() => goPlay(sim.state.hero || 'sabri', false)); return; }
    if (loaded && S.hero && S.playT > 0) { goPlay(S.hero, false); return; }
    const auto = params.raw.autoplay;
    if (auto !== undefined) { goPlay(auto === 'sabriye' ? 'sabriye' : (S.hero || 'sabri'), !S.hero); return; }
    if (!panels) { goPlay(S.hero || 'sabri', !S.hero); return; }
    panels.v2.title({
      onPlay: () => {
        if (sim.rules.rt.started) return;
        // 13:05 user: no man/woman pick on the first screen. Login (giris.ts) first, then the kulis creator opens in goPlay
        const go = () => { const S2 = sim.state; if (S2.hero && S2.playT > 0) goPlay(S2.hero, false); else goPlay(S2.hero || 'sabri', true); };
        if (giris) giris.show(go); else go();
      },
    });
  };
  const playHook = (hero?: string) => {
    dropOverlay('.sb-title'); dropOverlay('.sb-pickhero');
    if (sim.rules.rt.started) return;
    const S = sim.state;
    const h: HeroId = hero === 'sabriye' ? 'sabriye' : hero === 'sabri' ? 'sabri' : (S.hero || 'sabri');
    goPlay(h, !S.hero);
  };

  // ── hooks (M0)
  const reg = (name: string, fn: unknown) => hooks.register(name, fn);
  reg('step', (sec: number) => loop.advance(Number(sec) || 0));
  reg('render', () => loop.renderNow(1 / 30));
  reg('renderFrames', (n = 1, dt = 1 / 30) => { for (let i = 0; i < (n || 1); i++) renderFrame(dt || 1 / 30, 1); });
  const m0State = () => ({
    pos: { x: +walk.pos.x.toFixed(3), z: +walk.pos.z.toFixed(3) }, rot: +walk.rot.toFixed(3), speed: +walk.speed.toFixed(3),
    tier: quality.current().name, quality: quality.setting(), zones: zones ? zones.states() : {},
    time: +sim.clock.hour.toFixed(3), day: sim.clock.day, phase: sim.clock.phase, stage: sim.state.stage,
    fpsProxy: P.snapshot().fps, tick: sim.tick, saveMode: save.mode,
    hash: sim.hash(), warnings: [...warnings], dwell: sim.interactions.status(sim.player),
  });
  reg('state', () => {
    let v2: AnyRec = {};
    try { v2 = sim.rules.v2State(); } catch (e) { log.error('v2State', e); }
    const r = sim.rules.rt;
    return {
      ...v2, ...m0State(), sign: sim.state.sign, hero: sim.state.hero,
      money: (v2.money as number | undefined) ?? Math.floor(sim.state.money),
      paused: loop.paused || r.paused, pauseWhy: r.paused ? r.pauseWhy : loop.pauseWhy, loopPaused: loop.paused,
    };
  });
  reg('info', () => {
    const s = P.snapshot();
    return { ...R.info(), buildMs: zones ? zones.buildMs() : 0, pending: zones ? zones.pending() : 0, timers: s.timers, counters: s.counters,
      particles: s.particles, fps: s.fps, frameP95: s.frameP95, heapMB: s.heapMB, warnings: s.warnings, tier: quality.current().name };
  });
  reg('setTime', (h: number) => { sim.command({ kind: 'setTime', hour: h }); lastHour = -1; timeT = 0; guard('setTime', () => { R.setTime(sim.clock.hour, sim.clock.season); havaLook?.relight(); }); });
  reg('setStage', (n: number) => { sim.command({ kind: 'setStage', stage: n }); callWorld('setStage', sim.state.stage, sim.state.renewed); });
  reg('setTier', (name: TierName) => quality.set(name));
  reg('moments', (what?: string, arg?: string) => { if (!moments) return null; if (what) moments.force(what as never, arg); return moments.info(); });
  // dev only: force a sim command (unlock, ferry...) so a browser check can reach a scene
  reg('simCmd', (what: string, value?: unknown) => {
    if (what === 'hire') { sim.command({ kind: 'openJobBoard' } as never); const c = ((sim.state.jobCards || []) as { id: string }[])[0]; if (c) sim.command({ kind: 'hireCandidate', id: c.id, free: true } as never); return; }
    if (what === 'cmd') { sim.command(value as never); return; }
    if (what === 'pencere') { sim.command({ kind: 'pencere', wid: Number(value) } as never); return; }
    sim.command({ kind: 'force', what, value } as never);
  });
  reg('dbg', () => { const rt = sim.rules.rt as unknown as { pencereAt?: boolean; winShelf?: string[]; counter: Record<string, unknown[]> }; return { pencere: sim.state.zones.pencere, at: !!rt.pencereAt, shelf: rt.winShelf ?? [], counter: Object.fromEntries(Object.entries(rt.counter).map(([k, v]) => [k, v.length])) }; });
  reg('izgara', (on?: boolean) => { if (on !== undefined) izgaraLook?.set(!!on); return izgaraLook?.get() ?? null; });
  reg('hucre', (name: string) => cellRect(name));
  reg('teleport', (x: number, z: number) => { sim.command({ kind: 'teleport', x, z }); camHold = null; cam.snap(walk.pos); });
  reg('camera', (o: { x?: number; z?: number; zoom?: number; zoomRaw?: number; yaw?: number; tilt?: number } = {}) => {
    if (o.zoom !== undefined) cam.zoom = o.zoom;
    const cr = cam as unknown as { zoomRaw?: (z: number) => void; turn(d: number): void; tilt(d: number): void; yaw: number };
    if (o.zoomRaw !== undefined) cr.zoomRaw?.(o.zoomRaw);
    if (o.yaw !== undefined) cr.turn(o.yaw - cr.yaw);
    if (o.tilt !== undefined) cr.tilt(o.tilt);
    if (o.x !== undefined || o.z !== undefined) { camHold = { x: o.x ?? walk.pos.x, z: o.z ?? walk.pos.z }; cam.snap(camHold); }
  });
  reg('input', (x: number | null, z = 0) => input.inject(x === null || x === undefined ? null : { x: Number(x), z: Number(z) }));
  // walk-grid dump for layout checks: rows are z (top = z0), columns x; '#' blocked, '.' walkable
  reg('grid', (id: string, x0: number, x1: number, z0: number, z1: number) => {
    if (!zones || !zones.def(id)) return null;
    const g = zones.walkGrid(id); const rows: string[] = [];
    for (let z = z1; z >= z0; z -= g.cell) { let r = ''; for (let x = x0; x <= x1; x += g.cell) { const ix = Math.floor((x - g.origin.x) / g.cell), iz = Math.floor((z - g.origin.z) / g.cell); r += ix < 0 || iz < 0 || ix >= g.w || iz >= g.h ? ' ' : g.cost[iz * g.w + ix] ? '.' : '#'; } rows.push(z.toFixed(1).padStart(6) + ' ' + r); }
    return rows.join('\n');
  });
  reg('zone', (id: string) => (zones ? { id, state: zones.state(id), def: !!zones.def(id), anchors: Object.keys(zones.anchors(id) ?? {}).length, pending: zones.pending() } : null));
  reg('events', (since?: number) => sim.events(since));
  reg('save', () => save.save('manual'));
  reg('resetSave', () => save.wipe());
  reg('loseContext', () => R.loseContext());
  reg('restoreContext', () => R.restoreContext());
  reg('hide', () => platform.visibility.simulate(true));
  reg('show', () => platform.visibility.simulate(false));
  // test hook: drive the real loop with synthetic rAF timestamps (use with ?noloop); trace() then reports those times
  reg('frame', (t: number) => { synthT = t; loop.frame(t); });
  reg('trace', (on: boolean) => { if (on) { traceBuf = []; tracing = true; return []; } tracing = false; return traceBuf; });
  reg('perfReport', () => P.report());
  reg('perfShow', (on = true) => P.show(!!on));
  reg('exportSave', () => save.exportCode());
  reg('importSave', async (code: string) => { const ok = await save.importCode(code); if (ok) { const r = await save.load(); sim.load(r.data); } return ok; });
  reg('loop', () => ({ tick: loop.tick, paused: loop.paused, pauseWhy: loop.pauseWhy, simTime: loop.simTime }));
  for (const k of ['select', 'drag', 'save']) if (!(target.editor as AnyRec | undefined)?.[k]) reg(`editor.${k}`, () => { throw new Error('editor not loaded (?edit=1)'); });

  // ── hooks (v2 __bufe surface, M1)
  const cmd = (kind: string, extra: AnyRec = {}) => command({ kind, ...extra });
  reg('play', playHook);
  reg('path', (a: Vec2, b: Vec2) => { const p = sim.nav.path(a, b); return p && p.length ? p.map(q => ({ x: q.x, z: q.z })) : [{ x: b.x, z: b.z }]; });
  reg('log', () => sim.events(0).map(r => ({ ...((r.data as AnyRec) || {}), ev: r.name, t: +r.t.toFixed(2) })));
  Object.defineProperty(target, 'uiLast', { configurable: true, enumerable: true, get: () => sim.rules.rt.uiLast });
  Object.defineProperty(target, 'S', { configurable: true, enumerable: true, get: () => sim.state });
  Object.defineProperty(target, 'rules', { configurable: true, enumerable: false, get: () => sim.rules });
  reg('seed', sim.state.seed);
  reg('command', (c: Cmd) => command(c));
  reg('claimOrder', (id: string) => cmd('claimOrder', { id }));
  reg('ordersRefresh', () => cmd('ordersRefresh'));
  reg('openPanel', (id: string) => cmd('openPanel', { id }));
  reg('closePanel', () => cmd('closePanel'));
  reg('panelModel', (id: string) => panelModel(id, sim.rules));
  reg('panelActions', (id: string) => {
    const acts = panelActions(id) as Record<string, (a?: unknown) => Cmd>;
    const out: Record<string, (a?: unknown) => void> = {};
    for (const k of Object.keys(acts)) out[k] = (a?: unknown) => command(acts[k](a));
    return out;
  });
  reg('upgradeTier', (id: string) => cmd('upgradeTier', { id }));
  reg('startTadilat', () => cmd('startTadilat'));
  reg('skipTadilat', () => cmd('skipTadilat'));
  reg('saveSign', (text: string, font?: string) => cmd('saveSign', { text, font }));
  reg('decorAct.buy', (id: string) => cmd('decorBuy', { id }));
  reg('decorAct.place', (id: string) => cmd('decorPlace', { id }));
  reg('decorAct.remove', (slot: number) => cmd('decorRemove', { slot }));
  reg('decorAct.sign', (text: string, font?: string) => cmd('saveSign', { text, font }));
  reg('hireCandidate', (id: string, free?: boolean) => cmd('hireCandidate', { id, free: !!free }));
  reg('refreshBoard', () => cmd('refreshBoard'));
  reg('openJobBoard', () => cmd('openJobBoard'));
  reg('closeJobBoard', () => cmd('closeJobBoard'));
  reg('tapSlow', () => cmd('tapSlow'));
  reg('acceptSolution', () => { cmd('acceptSolution'); document.querySelectorAll('.sb-sol').forEach(el => el.remove()); });
  reg('collectWelcome', (doubled?: boolean) => { cmd('collectWelcome', { doubled: !!doubled }); document.querySelectorAll('.sb-wb').forEach(el => el.closest('.sb-modal')?.remove()); });
  reg('skipCeremony', () => {
    cmd('skipCeremony');
    document.querySelectorAll('.sb-kasa').forEach(el => { const f = (el as unknown as { _sb?: { finish(): void } })._sb; if (f) f.finish(); else el.remove(); });
  });
  reg('applyTier', (name: TierName) => quality.set(name));
  for (const what of ['ferry', 'gull', 'kapkac', 'regular', 'vip', 'endDay', 'money', 'gold', 'stars', 'sleep', 'offline', 'unlock']) {
    reg(`force.${what}`, (value?: number | string) => cmd('force', { what, value }));
  }
  reg('ferryBoard', () => ({ board: ferryLook?.board() ?? null, info: rt().ferryInfo ?? null, view: ferryLook?.debug() ?? null }));

  // admin: the scene editor on demand (drag props with the mouse/finger, "Kaydet" keeps the layout on this device)
  if (prefab && zones && dress) {
    let adminEd: Editor | null = null, loading = false;
    adminEditor = () => {
      if (adminEd) { adminEd.open(!adminEd.active); return; }
      if (loading) return; loading = true;
      import('../engine/editor').then(m => {
        const ed: Editor | null = make('editor.admin', () => m.createEditor({ platform, ui: U, hooks, perf: P } as Parameters<typeof m.createEditor>[0]));
        if (ed) { ed.attach({ render: R, prefab, zones, dress, input, fx: fx ?? undefined, anim: anim ?? undefined }); ed.open(true); adminEd = ed; }
        loading = false;
      }, e => { loading = false; warn('editor', e); });
    };
  }
  // ── editor (lazy)
  if (params.edit && prefab && zones && dress) {
    import('../engine/editor').then(m => {
      const ed: Editor | null = make('editor', () => m.createEditor({ platform, ui: U, hooks, perf: P } as Parameters<typeof m.createEditor>[0]));
      if (ed) make('editor.attach', () => { ed.attach({ render: R, prefab, zones, dress, input, fx: fx ?? undefined, anim: anim ?? undefined }); ed.open(true); return true; });
    }, e => warn('editor', e));
  }

  // ── dev hot reload: systems are swapped in place (GameState, stores and the agents SoA are kept)
  if (import.meta.hot) {
    import('../engine/editor/hot').then(h => {
      make('hmr.content', () => { h.installHotReload({ content: contentReg, prefab: prefab ?? undefined, zones: zones ?? undefined, fx: fx ?? undefined, log: msg => log.info(msg) }); return true; });
    }, e => warn('hmr', e));
    import.meta.hot.accept('./sim/ambient', m => {
      if (!m) return;
      make('hmr.ambient', () => {
        const amb = (m as unknown as typeof import('./sim/ambient')).createAmbient({ nav, anchors: zones ? (id => zones.anchors(id)) : (() => ({})) });
        sim.scheduler.replace(amb.id, amb);
        return true;
      });
    });
  }

  // ── first frame, then go
  if (playMode) guard('startFlow', startFlow);
  renderFrame(1 / 30, 1);
  if (!params.noloop) loop.start();
  if (warnings.length) console.warn('[marti] fallbacks:', warnings.join('; '));
  hooks.setReady(true);
  void TIER_TABLE;
}

function staticQuality(name: TierName): Quality {
  return {
    table: TIER_TABLE, current: () => TIER_TABLE[name], setting: () => name, set() {}, onChange: () => () => {}, feed() {}, batterySaver() {},
  };
}
function nullInput(): Input {
  const st = { move: { x: 0, z: 0 }, moving: false, taps: [], pinch: 1, orbit: 0, hand: 'right' as const };
  let inj: Vec2 | null = null;
  const s = () => { st.move.x = inj?.x ?? 0; st.move.z = inj?.z ?? 0; st.moving = !!inj && Math.hypot(inj.x, inj.z) > 0.12; return st; };
  return { state: s, poll: s, onTap: () => () => {}, setHand() {}, inject(m) { inj = m; }, setPicker() {}, interactions: null as never, dispose() {} };
}
void angLerp;
