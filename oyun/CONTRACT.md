# Martı Motoru: build contract

Read `MOTOR.md` first (design and API sketches). This file says who builds what, how the parts talk, and how each milestone is accepted. Where the contract is silent, decide yourself, keep it simple, and write the decision in your file's header comment.

## Fixed rules (owner, never break)

- All brands invented, original names, never a real trademark or a sound-alike/one-letter variant. Existing: Kolaz, Boğaz Gazozu, Ayranbey, Martı Su, Narçiçek, Günaydın Postası, Boğaz Haber, Spor Martı, Martıkart, PaketMartı, Plaza Burger Holding (+ survey-approved: Demlikhan Çay, Lodos Soda, Buzdağı Limonata, Şalgamzade, Vapurcu Kahve, Ay Bozası, Gevrek Express, Köpük Kulesi, Tavuk Tekeli A.Ş., Uçan Paket, Üç Kardeş Kokoreç, Dede Usulü Börek, Altın Fırın). No real people, clubs, TV shows, meme characters.
- Never the word "zam". No jokes about religion, ethnicity, disability, refugees, politics, real people, price hikes. Respectful diversity, no fall gags with wheelchair/cane users.
- 13+, street Turkish without profanity. No gambling mechanics (Lunapark is skill only). Fair monetisation: rewarded ads only (simulated "Deneme reklamı" in builds), everything buyable also earnable free.
- Sabri's apron says "SABRİ", Sabriye's "SABRİYE".
- Player-facing text Turkish, no em-dashes. Code comments English.
- No losing: money never negative, stars never drop, nothing burns or breaks.
- Keep the v2 look. **Never edit anything under `/mnt/project-files/sosisci-oyun/3d/v2/`** (read and run it only).
- Pause-before-pickup (owner note, motor-11): stations do not act on contact; dwell rule in MOTOR.md §8.

## Shared-folder rules

`/mnt/project-files` is shared. Write only the files you own (tables below). Re-read a file right before changing it. Temporary files go in your own scratch folder. Do not publish, create repositories, sign up for anything, or install packages beyond the list below (the lead installs them).

## Packages (lead installs once; exact versions)

```
three@0.160.1
@types/three@0.160.0
typescript@5.6.3
vite@5.4.10
vitest@2.1.4
pixelmatch@6.0.0
pngjs@7.0.0
@types/pngjs@6.0.5
lil-gui@0.19.2
(playwright 1.56, already installed globally: require('playwright') with NODE_PATH=$(npm root -g))
```
Browser tests: Chromium flags `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`, viewport 390×844, `isMobile`, `hasTouch` (same as v2 `test/bot.js`).

## Lead-owned, frozen at kickoff (builders request changes, never edit)

- `package.json`, `tsconfig.json` (strict), `vite.config.ts` (IIFE build: `build.lib` off, `rollupOptions.output.format = 'iife'`, `inlineDynamicImports: true`, `base: './'`, output `dist/game.js`), `index.html` (dev).
- `src/engine/api.ts`: all interfaces from MOTOR.md (Loop, World/Scheduler/System/SimCtx, SaveStore, Tier, InputState/Interactable, CameraRig, ZoneDef/ZoneManager, Nav/WalkGrid, Animator/RigPose/Gait/ExprId/BrowId, RenderPipeline, Dress/SlotDef, PrefabDef/PrefabSystem, EffectDef/Fx, Ui, Audio, PerfMeter, TestHooks).
- `src/content/types.ts`: content table types.
- `src/game/sim/schema.ts`: `GameState` shape + `SAVE_VERSION`, and the shared `agents` SoA schema (`x, z, px, pz, rot, prot, speed, gait, act, mood, expr, carry, typeId, lod, zone, flags`).
- `src/game/events.ts`: event name list (v2 names kept, MOTOR.md §5).

Every factory is exported as `createX(deps): X` from the owner's `index.ts`. Boot calls factories inside try/catch; a missing or throwing module gets a fallback (grey box, capsule character, plain HUD) and a perf-meter warning, never a crash.

---

## M0: engine core + build/preview pipeline + v2 pier LOOK PARITY

Goal: the pier at Martıköy İskelesi rendered by Martı Motoru looks the same as v2 (stage 1 and 2, four times of day, crowd, gulls, Pamuk), runs on the new loop/save/quality/input, publishes as an artifact, and has the editor, perf meter and hot reload working. No gameplay rules yet beyond walking around.

### File ownership (no overlaps)

| Builder | Owns (write only these) |
|---|---|
| **A: Platform & core** | `src/engine/{platform,core,loop,ecs,save,quality,input,perf,debug}/**`, `src/game/boot.ts`, `src/game/headless.ts`, `src/game/sim/walk.ts` (M0 player movement + collision only), `tools/{build-artifact.mjs,check-dist.mjs,lint-sim.mjs}`, `tests/unit/{core,loop,ecs,save,quality,input}/**`, `tests/browser/boot.spec.mjs`, `tests/browser/lifecycle.spec.mjs` |
| **B: Render & world** | `src/engine/{render,camera,dress,prefab,zones}/**`, `src/content/zones/{iskele,test-sokak}.ts`, `src/content/prefabs/iskele/**`, `src/content/prefabs/common/**`, `src/content/art-manifest.ts`, `src/game/view/world/**`, `tests/unit/{prefab,zones}/**`, `tests/browser/world.spec.mjs`, `tests/browser/world.html` |
| **C: Characters, motion, nav, fx** | `src/engine/{anim,fx,nav}/**`, `src/content/{citizens,clips,effects,faces}/**`, `src/game/view/chars/**`, `src/game/sim/ambient.ts` (M0 ambient walkers only), `tests/unit/{nav,anim,fx}/**`, `tests/browser/chars.spec.mjs`, `tests/browser/chars.html` |
| **D: UI, audio, editor, parity harness** | `src/engine/{ui,audio,editor}/**`, `src/game/ui/hud.ts`, `src/game/ui/settings.ts`, `src/game/parity/**`, `tools/{shot-compare.mjs,v2-shots.mjs,make-parity-page.mjs}`, `tests/fixtures/v2-shots/**`, `tests/browser/parity.spec.mjs`, `tests/browser/editor.spec.mjs`, `dist/parity.html` (generated by its tool) |

`dist/` other files are written only by `npm run build` + `tools/build-artifact.mjs` (A).

### Interfaces between M0 builders

- **A → all:** `createLoop`, `createWorld` (ECS), `createSave`, `platform.*` guards, `createInput` (joystick, taps, pinch, `Interactable` registry with dwell), `quality.current()` + `quality.onChange(cb)`, `perf.time(name, fn)`, `perf.count(name, n)`, `hooks.register(name, fn)` (adds to `window.__marti`).
- **B → C, D:** `render.scene`, `render.camera` (CameraRig), `render.setTime(h)`, `zones.anchors(zoneId)`, `zones.walkGrid(zoneId)`, `prefab.build/define/redefine`, `dress.get/define`, `render.registerPick(id, worldPos, radius)` (for D's editor and taps).
- **C → B, D:** `chars.makeHero(opts)`, `chars.crowd` (instanced, reads the `agents` SoA), `chars.makeCat/makeDog/makeGull/makeFlock/makePigeons` (same option names as v2 `SB.chars` so ports are 1:1), `anim.*`, `nav.path/flowTo`, `fx.play(id, at)`.
- **D → all:** `ui.hud/toast/label/sheet/transition`, `audio.sfx/music/ambience`, `editor.attach({ render, prefab, zones, dress, input })`.
- Ports: B ports v2 `world.js` builders into prefabs, C ports v2 `chars.js` (rigs, crowd instancing, face canvas, gull/cat/dog), D ports v2 `ui.js` CSS + HUD. Keep geometry, colours and proportions identical; parity is measured.

### Test hooks (M0)

`window.__marti` (A creates, others register): `ready()`, `step(sec)`, `render()`, `renderFrames(n, dt)`, `state()` (pos, tier, zone states, time, fps proxy), `info()` (calls, tris, geos, texs, perf timers), `setTime(hour)`, `setStage(n)`, `teleport(x, z)`, `camera({x, z, zoom})`, `input(x, z)`, `zone(id)`, `editor.select(id)`, `editor.drag(id, x, z)`, `editor.save()`, `save()`, `resetSave()`, `loseContext()`, `restoreContext()`, `hide()` / `show()` (simulate visibility). URL: `?parity=1&time=<h>&stage=<n>&seed=<s>&noloop&noart&tier=<name>&edit=1`.

Parity mode (`?parity=1`): fixed seed, player at v2 `playerStart`, camera at v2 default zoom, crowd placed from `src/game/parity/fixture.ts` (D captures from v2 via its hooks where possible), no UI except HUD, intro skipped.

### Automated acceptance (all must pass)

1. **Build:** `npm run build` makes `dist/`. `tools/check-dist.mjs`: ≤ 40 files, each ≤ 16 MB, total ≤ 30 MB; `index.html` follows the page contract (no doctype/html/head/body, `<title>` first, `#app`, `#c`, `#fail`, classic `<script src="game.js">`); no `http(s)://` script/style/fetch URLs in the bundle except none; no `serviceWorker`, `WebAssembly`, `eval(`, `new Function(`; `game.js` ≤ 2.5 MB raw.
2. **Types and purity:** `tsc --noEmit` zero errors; `tools/lint-sim.mjs` finds no `three`, `window`, `document`, `Math.random`, `Date.now`, `performance.now` in `src/game/sim/**`, `src/engine/{core,ecs,save,nav}/**`.
3. **Loop determinism:** same seed + same input log stepped with render rates 60, 30 and 17 fps → identical `sim.hash()` after 120 s.
4. **Save:** unit tests for: corrupt newest slot → older slot loads; IndexedDB throws → localStorage used; both throw → memory mode, no exception; checksum mismatch detected; migration v0 → v1 fixture; pre-migration backup written; daily backup ring keeps 7; export/import round trip equal; save on `hide()`.
5. **Dwell rule:** bot passes a stub station at 4 m/s → nothing taken; stops 0.5 s → first item by 0.6 s; stops 0.3 s then leaves → nothing taken; moving away mid-transfer stops transfers within one tick.
6. **Look parity** (`tests/browser/parity.spec.mjs`, `tools/shot-compare.mjs`): v2 reference shots (`tools/v2-shots.mjs` runs v2 from its folder read-only with its own hooks) vs motor shots, 390×844, tier dengeli, `#noart` and with art, at 09:00, 13:00, 19:00, 22:00 for stage 1 and stage 2 (16 pairs). Per static region (sky band, sea, deck, kiosk box; dynamic crowd areas masked): mean colour ΔE76 ≤ 6; kiosk region SSIM (1/4 res, grayscale, blurred) ≥ 0.75; kiosk silhouette bounding box within 4 % of screen size. Plus character lineup vs v2 `test/chars.html` shot (SSIM ≥ 0.7) and HUD vs v2 `test/game-02-first-customer.png` HUD band (ΔE ≤ 6). `dist/parity.html` shows every pair side by side with the diff image for the owner's eye check. The lead may tune thresholds once after the first eye check and writes the final numbers here.
7. **Lifecycle:** zero console errors on boot and in a 60 s walk; `loseContext()` → `restoreContext()` → renders again, same state hash; visibility hide → loop paused + save written.
8. **Streaming smoke:** walk pier → `test-sokak` (grey box zone) → pier through the portal, 5 times: zone states go sim → warm → hot and back; no blocking overlay ever shown; per-frame build job time ≤ tier budget (akici 3 ms, dengeli 4 ms, sahane 6 ms) in every frame (measured with `perf` timers); geometries/textures return to baseline ±5 % after leaving.
9. **Editor:** select a stool, drag 1 m, save, reload → stool at the new position; `redefine()` of the stool prefab updates all stool instances; undo restores.
10. **Quality:** `?tier=akici|dengeli|sahane` set the GDD numbers (crowd 25/50/90, pixel ratio 1/1.5/2, shadows off/1024/2048, fps 30/60/60); forced slow frames for 10 s drop one tier; manual setting persists.
11. **Perf budgets** below, read from `info()` in parity scenes.

### Perf budgets (M0 and M1, pier scene, measured counters)

| | akici | dengeli | sahane |
|---|---|---|---|
| Draw calls | ≤ 110 | ≤ 150 | ≤ 190 |
| Triangles | ≤ 150k | ≤ 300k | ≤ 450k |
| Visible crowd | 25 | 50 | 90 |
| Live particles | ≤ 200 | ≤ 500 | ≤ 1000 |
| Sim step (Node, 90 agents) | ≤ 2 ms | ≤ 2 ms | ≤ 3 ms |
| Zone build slice per frame | ≤ 3 ms | ≤ 4 ms | ≤ 6 ms |
| Textures in memory | ≤ 40 | ≤ 60 | ≤ 80 |
| JS heap growth over 120 s steady play | ≤ 5 MB | ≤ 5 MB | ≤ 5 MB |
| Boot to first frame (local, SwiftShader) | ≤ 4 s | | |
| Target fps on owner's phone (perf meter report) | 30 stable | 60 | 60 |

Hot loops allocate nothing per frame (checked by heap growth test). Real-phone fps is checked by the owner via the perf meter "Raporu kopyala" button on each preview link.

### Manual checks by the lead (M0)
Vite HMR: edit a content table and a system while the dev server runs; state is kept. Look at `dist/parity.html` with the owner's eye.

---

## M1: v2 GAMEPLAY PARITY on the new engine

Goal: everything playable in v2 plays the same on Martı Motoru (first session table, first week and beyond at İskele), plus the dwell rule and the stronger save. Port rules from v2 `game.js` / `data.js` (read only), keep numbers.

### File ownership

| Builder | Owns |
|---|---|
| **A: Core sim rules** | `src/game/sim/{state,clock,economy,player,carry,stations,counter,customers,queue,orders,pads,money,ferry,window,streak,sets,tadilat,decor,karne,levels,offline,board,achievements,settings,save,migrate-v2}.ts`, `src/content/{products,economy,pads,stages,achievements,daily,sign-fonts}.ts`, `tests/sim/{economy,customers,ferry,save,offline,migrate}.test.ts`, `tests/fixtures/saves/**` |
| **B: Pier world views** | `src/game/view/world/**` (stages 1-5, renew parts, station tiers incl. golden K4, tables, ferry + window, sign/neon, decor models, items, money stacks, markers, slow icon anchor), `src/content/prefabs/iskele/**`, `src/content/decor/**`, `tests/browser/world-m1.spec.mjs` |
| **C: Agents and characters** | `src/game/sim/agents/{workers,traits,regulars,vip,kapkac,gulls,cats,dog,pigeons,ambient}.ts`, `src/game/view/chars/**`, `src/content/{citizens,workers,traits,ranks,names,regulars,vips,cats,lines}.ts`, `tests/sim/{workers,regulars,animals}.test.ts` |
| **D: UI, audio, tutorial, bots** | `src/game/ui/**`, `src/game/tutorial.ts`, `src/game/audio-map.ts`, `src/content/{ui-text,sfx}.ts`, `tests/sim/first-session.test.ts`, `tests/browser/bot-m1.mjs`, `tests/browser/ui-m1.spec.mjs`, `tests/fixtures/v2-curve.json` |

### Interfaces (M1)

- Sim ↔ views only through `GameState`, the `agents` SoA and events. Views never write sim state. UI actions call `sim.command({ kind, ... })` (A defines the command union in `src/game/sim/commands.ts`, which A owns).
- **A ↔ C:** A's `customers` requests citizens from C's `ambient` pool (`ambient.recruit(typeFilter) -> agentId`, `ambient.release(agentId)`); C's workers act on stations through A's `stations.operate(stationId, workerId, dt)` and `carry.*`; C's gull snatch calls `counter.take(product, 1, 'gull')` (a free gag, nothing lost from money).
- **A ↔ D:** panel models are built by A as pure functions `panelModel(id, state)` and `panelActions(id) -> commands` (same ids as v2: `isciler, menu, dekor, gorevler, kedi, karne, tadilat, ayarlar`, plus `jobBoard`, `welcomeBack`, `dayCard`, `kasaSayimi`, `solution`).
- **B ↔ A:** B reads `state.stage`, `state.renewed`, `state.tiers`, `state.tables`, `state.decor`, `state.sign`; A reads B's anchors via `zones.anchors('iskele')` (same anchor names as v2 `W.anchors`).
- Hooks: `window.__marti` gains the full v2 `__bufe` surface (`play, input, step, state, force.*, skipCeremony, ordersRefresh, openPanel, panelModel, panelActions, tapSlow, openJobBoard, hireCandidate, startTadilat, skipTadilat, upgradeTier, saveSign, decorAct, claimOrder, applyTier, path, events`), with the same field names in `state()` so the v2 bot ports with minimal changes.

### Automated acceptance (all must pass)

1. **Bot acceptance, 32 steps:** the v2 `STEPS` table (from `3d/v2/test/bot.js`) ported 1:1, same events, same `max` seconds, run **headless** (`tests/sim/first-session.test.ts`, Node, seed set 1..5: all 32/32 for every seed) and **in browser** (`tests/browser/bot-m1.mjs`, seed 1, 32/32, same screenshot names as v2 `game-*.png` for side-by-side).
2. **Economy parity:** money after day 1, 3, 5 within ±15 % of the v2 bot curve (`tests/fixtures/v2-curve.json`, captured by D running v2's bot read-only); first unlock times within ±20 %.
3. **Dwell rule in play:** with all stations built, the bot walks the counter → window route past 4 stations at full speed: carry stays empty; a special order (VIP) can be served with hands holding only what was picked deliberately.
4. **Long run:** 10 game days headless, 3 seeds: no exceptions, money never negative, stars never drop, queue never deadlocks (no customer waits > 3× patience without leaving), workers never stuck > 10 s (position delta check).
5. **Save:** save/reload mid-day in browser restores state hash (excluding view-only data); kill-during-write simulation (throw between IDB write and pointer) loses at most the last 10 s; v2 save JSON fixture imports correctly (money, gold, day, tiers, pads, workers, cats, decor, sign, settings).
6. **UI:** every panel opens with real models at 390×844 and 360×740, no overflow, zero console errors; Turkish text check (no "zam", no em-dash) over `src/content/ui-text.ts` and `lines.ts` (`tools/content-lint.mjs`, A adds the rule list; D runs it).
7. **Perf:** M0 budget table with stage 3 kiosk, 6 workers, full crowd.
8. **Determinism:** golden replay of a 10-minute recorded input log matches `tests/golden/m1-session.json` hash.

---

## M2: first ecosystem preview (brief)

Pier + **Çarşı Sokağı** with 4 esnaf (Fırıncı Hüsnü, Manav Hayriye Abla, Berber Şevket, Kuruyemişçi Zeki), walked into seamlessly from the end of the pier; living citizens with daily routines; day cycle with shops opening/closing; workers keep running the kiosk while Sabri is away (Sabri-only tasks wait).

- **Builders:** A: sim for schedules, shop hours, esnaf friendship level 1-2 + one "ayaküstü rica", away-from-kiosk rules, cross-zone save (`src/game/sim/{schedule,shops,esnaf,away}.ts`). B: `carsi` zone content and prefabs, portal seam, shop fronts with kepenk animation, night lighting (`src/content/zones/carsi.ts`, `src/content/prefabs/carsi/**`, `src/game/view/world/carsi/**`). C: citizen persistence + agent LOD A/B/C, schedule-driven routes across zones, esnaf heroes and idles, morning "toplu selam", evening "esnaf çayı" scene (`src/game/sim/agents/{citizens,lod,esnaf-ai}.ts`, views). D: minimap corner, wooden sign arrows, esnaf dialogue balloons with portrait + murmur, friendship UI, perf meter zone section, bot (`tests/browser/bot-m2.mjs`).
- **Acceptance:** walk pier → çarşı → pier 10 times: no blocking overlay, per-frame build slice within budget, zone memory back to baseline; at 08:00 shops open and esnaf greet, at 12:30 at least 30 % of plaza/öğrenci citizens buy simit somewhere, at 18:00 a ferry rush forms at the pier from both zones; a citizen seen in çarşı at 09:00 is the same id seen at the pier at 18:00; kiosk earnings while away ≥ 90 % of the same minutes with Sabri present minus Sabri-only tasks; 3 game days headless with 150 persistent citizens, sim step ≤ 3 ms; perf budgets hold with both zones hot (+20 draw calls allowed).

## Later milestones (brief)

- **M3 Komşuluk ve kuryeler:** 5 friendship levels, favours, borrowing, 5-part esnaf stories, evening tea; PaketMartı tablet, couriers 1-3 with traits and live map icons, bicycle; offline courier line at 50 %.
- **M4 Dekor 2.0 + çatı katı:** half-tile grid, 45° rotate, 3 paint layers, stacking sockets, unlimited undo, 3 layout slots, sign designer, seasonal auto layer; attic room above the kiosk.
- **M5 Mahalle büyür:** Meydan, Balıkçı Barınağı, Sahil Yolu; dolmuş fast travel, paper map, guide cat; weather (rain + wet ground, lodos, snow, fog) and real-calendar seasons.
- **M6 Mini oyunlar + Altın Fırın:** Lunapark Martı and first 2-3 skill mini-games, Altın Fırın showcase, collection books.
- **M7 Vapur Büfesi:** second venue, rocking counter, boardable ferry.
- **M8 Giydirme:** art into dressing slots (Gemini textures, a few AI 3D props), no code rewrites.
- **Then:** Köprüaltı, Esnaf Odası and online parts, event calendar, the Moon.

Preview cadence: a link after every big part (2-4 days), each with the perf meter available.

## Hand-back (every builder)

Reply with: files written, what is in them, test results (numbers), anything in this contract you could not follow and why, open issues. Keep it short.
