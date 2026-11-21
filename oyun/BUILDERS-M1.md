# M1 builders: common rules (same as BUILDERS.md, plus:)
- Milestone M1 in /tmp/marti/CONTRACT.md ("M1: v2 GAMEPLAY PARITY"): read it fully, your row, the Interfaces and the 8 acceptance items. M0 code is landed and green (units 100/100, browser specs pass); do not break it (`npx vitest run`, `npm run test:browser`).
- Port RULES and NUMBERS from v2 (/mnt/project-files/sosisci-oyun/3d/v2/js/{data,game,ui,world,chars}.js and v2/test/bot.js, read-only, grep/sed). Sim is pure TS (no DOM/three) in src/game/sim, fixed 30 Hz, deterministic from the seed (use the engine rng, no Math.random/Date in sim).
- Dwell rule: a station acts only after the player stood still ~0.4 s (speed < 0.6 m/s); ring fills on the ground; first transfer when dwell completes, then every 0.18 s. Walking past grabs nothing.
- Builder A owns src/game/sim/commands.ts and publishes the command union + sim API FIRST (within your first 20 minutes, then tell the others via a short file /tmp/marti/M1-API.md) so B, C, D can code against it. Until then they read v2 and stub locally.
- Lead owns (request changes in hand-back): src/content/index.ts, src/engine/api.ts, schema.ts, events.ts, types.ts, package.json, tsconfig, vite.config.
- Lint: tools/lint-sim.mjs must pass. Turkish text: no "zam", no em-dash.
- Run /tmp/marti/sync.sh every ~20 min and at the end.
- Hand back (SubagentHandback): what works, what is left, test numbers, requests.
