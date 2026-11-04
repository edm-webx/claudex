# M1 sim API (Builder A), read this first

Pure TS, 30 Hz fixed, seeded (`ctx.rng.stream(name)`), deterministic. No Math.random, Date, DOM, three.
Files: `src/game/sim/{commands,state,rules,panels,save,migrate-v2}.ts` plus the rule modules (stations, counter, money, economy, customers, ferry, window, pads, tadilat, decor, orders, karne, queue, board, offline, player, clock, levels, achievements, streak, sets, settings, util) and the data in `src/content/{products,economy,pads,stages,achievements,daily,sign-fonts}.ts`.

## 1. Reaching it
```ts
const sim = createSim({ seed, content }, extra);   // src/game/headless.ts builds createRules() + installAgents(rules)
sim.rules          // RulesFull: .state (GameState), .rt (Runtime, read-only for views), .ext, v2State(), welcomeBack(awaySec), snapshot(wallMs)
sim.command(cmd)   // SimCmd (commands.ts); the rules handle everything except setTime / freezeTime / teleport (M0 handlers)
sim.input({x,z})   // stick vector
sim.step(sec); sim.events(since)   // bus log (100000 records); records: {tick,t,name,data}
```
`state` keeps its object identity for the whole life of the sim (`sim.load(s)` and `resetSave` overwrite it in place).

## 2. Commands (commands.ts)
`play{hero?}` starts the session (before it the world is frozen like v2 behind the title card; `heroPick` and `start` fire on play; a fresh game resets dayT/playT and moves the hero a few steps from the doner).
`setHero`, `resetSave`, `setStage`, `openPanel{id}`, `closePanel`, `openJobBoard` / `closeJobBoard` (the board also opens by walking to the job corner), `upgradeTier{id}` (id may be `kepenk` / `miknatis`), `startTadilat`, `skipTadilat`, `claimOrder{id|'all'}`, `ordersRefresh`, `hireCandidate{id,free?}`, `refreshBoard`, `fire{id}`, `train{id}`, `decorBuy / decorPlace{id}`, `decorRemove{slot}`, `saveSign{text,font?}`, `tapSlow`, `acceptSolution`, `collectWelcome{doubled?}`, `skipCeremony`, `setSetting{key,value}`, `force{what,value?}`.
`force.what`: `unlock` (value = pad key, no payment), `ferry`, `endDay`, `money`, `gold`, `stars`, `offline` (value = seconds away), and `regular | vip | kapkac | gull | sleep` (routed to C's `rt.forceAgent`).
Refused commands emit a `toast {kind:'bad'}` and change nothing.

## 3. Panels (panels.ts), for D
`panelModel(id, rules)` returns the v2 model object; `panelActions(id)` returns `{ name: (arg) => SimCmd }`.
Ids: `isciler menu dekor gorevler kedi karne tadilat ayarlar` and overlays `jobBoard welcomeBack dayCard kasaSayimi solution` (overlays are the objects stored in `rt.uiLast[id]`, replaced by a new object to re-show).
UI state lives in the sim: `rt.panel`, `rt.boardOpen`, `rt.uiLast`. While `rt.paused` (`pauseWhy` = `kasa` or `welcome`) the whole sim is frozen except a 30 s fallback timer for the weekly kasa count; resume with `skipCeremony` / `collectWelcome`. The day card does not pause (it only sets `rt.uiLast.dayCard`).

## 4. Runtime for views (B, C): `rules.rt`
- `rt.layout` = `stageLayout(state.stage)` (B's pure data). Switches on `setStage` / tadilat.
- `rt.stations[k] {built,out[],opT,prog}`, `rt.counter[k]: Item[]` (max 8), `rt.carry: Item[]`, `rt.kasa`, `rt.floor`, `rt.tables[i] {built,seats,pile,dirty}`, `rt.pads[]`, `rt.ferry {state,t}` (A drives the ferry: arriving 10 s, docked 25 s, leaving 16 s), `rt.window`, `rt.streak`, `rt.siklik`, `rt.slow`, `rt.tutStep`, `rt.act / actT / say / sayT` (hero), `rt.moving / stillT / movedTotal`.
- `state.decorSlots` is the PLACED list `[{slot:"<index>", item}]` (not v2's id|null array); `state.owned[key] = 1`; `state.cats = [{id}]`; `state.tadilat = {part,endsAt,to,left,total}`; `state.orders = {date,list:[{id,goal,base,claimed,done}],allClaimed}`.
- Customers: `rt.customers / queue / winq` (logical). Bodies are agents-SoA slots recruited from C's ambient pool: `customer.agent` plus `members[]`. A writes x,z,rot,speed,act,mood,carry,flags every tick.
- Items: B draws `rt.carry`, `rt.counter[k]`, `rt.stations[k].out`, kasa and table piles from these arrays.

## 5. Services for C
`rules.stations` (operate/outCount/outFull/takeOut/isGrab/grabTime/makeGrab), `rules.carry`, `rules.counterApi`, `rules.moneyApi`, `rules.salesApi.settle`, `rules.earn`, `rules.venueMult`, `rules.hour`, `rules.addSystem`, `rules.addStateView`, `rt.reserved` (waiting specials), `rt.auras` (patience aura providers), `rt.followers`, `rt.tipBoostT`.
`installAgents(rules)` is called by headless. Hiring uses C's `agents/hiring.ts` through `board.ts` (A's HiringHost); A emits `hire {name,role,price}` after a successful hire.
Events A emits: heroPick, start, introGull, firstCustomer, firstCut, firstDrop, firstCollect, cayUsed, siftah, firstStreak, set, sale, angry, tip, padShown, unlock, tier, plaque, star, level, ach, ferryHorn / Dock / Leave, windowOpen / Close, firstWindowSale, dayEnd, ordersNew, orderClaim, tadilatStart / Done, stage, decorBuy, sign, boardOpen, hire, slowIcon, slowTap, kasaStart / Done, welcome, welcomeCollect, panel, tutShow, tutDone, toast.

## 6. headless.ts changes (A's file)
Builds the rules after walk + ambient, calls `installAgents(rules)`, routes `command` to `rules.handle`, folds `rules.hashParts()` into `hash()`, runs `rules.pausedStep` instead of the scheduler while paused, advances playT/dayT only after `play` (before it the M0 behaviour stays), `load()` overwrites state in place and calls `rules.restore()`, bus log raised to 100000.
Also fixed `engine/input/interactions.ts`: an act() that unregisters its own interactable (pad bought) no longer leaves the actor stuck in a finished state.

## 7. Save and import
`createGameSave(sim, platform, {key?, log?})` (save.ts) wraps the engine SaveStore; its `get()` calls `rules.snapshot(wall)` (lastSeen, pile, rate). `normalizeState(state)` repairs shapes. After boot call `sim.rules.welcomeBack(awaySec)` with the seconds since `state.lastSeen` (wall clock stays outside the sim). v2 import: `migrateV2(json | string | {data}) : GameState` (migrate-v2.ts).

## 8. Bot surface
`sim.rules.v2State()` = the v2 `__bufe.state()` shape (t, day, dayT, clock, money, pos, carry, cap, counter, out, built, tiers, kasaPile, kasaValue, floor, tablePiles, queue, winq, window, pads, owned[], workers, reg, vip, kap, cat, cats, gull, sleeper, slow, tut, boardOpen, panel, anchors{counter,kasa,job,window,start,stations,tables,queue0}, ...). C's state view fills workers/reg/vip/kap/cat/cats/gull/sleeper.

## 9. Dwell rule in A's code
Interactables: `station.<k>` (radius 0.85 at standAt, dwell 0.4 s, 0.1 s between pickups; the dwell time counts as production work), `counter` (1.0, 0.25 s, 0.08 s per drop), `kasa` (0.55 + magnet, 0.1 s, 4 stacks / 0.06 s), `table.<i>` (1.5, 0.4 s), `floor.<n>`, `pad.<key>` (0.8, dwell 0, pays max(price/1.2, 250) per second), `window` (1.25, 0.25 s). `canAct` is exact (nothing to drop, hands full, no room: false) so the nearest eligible interactable never blocks a neighbour such as a waiting regular. Station stand-at uses a fixed 0.8 m station depth (B's three model has the exact one).

## 10. Numbers
Economy parity (D's bot, seed 1): day 1 / 3 / 5 cumulative earnings within 15 % of the v2 curve; first unlocks (cay, ayran, simit, tabure2, isbul, pencere) within 20 %.
