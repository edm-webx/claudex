# M0 builders: common rules
- Work in the LOCAL tree /tmp/marti (fast disk, packages installed). Never npm install; if you need a package, write it in your hand-back.
- Read /tmp/marti/CONTRACT.md (M0 section + your row) and the MOTOR.md sections for your subsystems, and /tmp/marti/src/engine/api.ts (frozen: code against it, never edit it, nor tsconfig/vite.config/package.json/schema.ts/events.ts/content/index.ts/types.ts; request changes in your hand-back).
- Write ONLY the files your row in CONTRACT.md "M0 File ownership" gives you. Other builders work in the same tree at the same time.
- The current game v2 is the visual reference: /mnt/project-files/sosisci-oyun/3d/v2/ (read-only; js files are large, grep/sed). Port geometry, colours, proportions and motion 1:1; the owner loves its look.
- Be token-efficient. Check your work: `cd /tmp/marti && npx tsc --noEmit` (other builders' in-progress errors in their files are not yours; yours must be zero), your unit tests with `npx vitest run tests/unit/<yours>`, and browser specs with NODE_PATH=$(npm root -g) and the Chromium flags in CONTRACT.md.
- Every ~20 minutes and at the end run `/tmp/marti/sync.sh` (copies the tree to the shared folder; the container can be reclaimed).
- Fixed owner rules in CONTRACT.md apply (invented brands only, no "zam", etc.).
- Hand back: what works, what's left, test results with numbers, requests for frozen-file changes.
