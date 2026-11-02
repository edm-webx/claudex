// Lead-owned, frozen at kickoff (CONTRACT.md). Builders request changes, never edit.
// Production: one classic IIFE bundle dist/game.js (three tree-shaken inside, dynamic imports inlined).
// dist/index.html in page-contract form is written afterwards by tools/build-artifact.mjs (Builder A).
// Styles: do NOT import .css files (they would emit a separate file); inject CSS from TS (engine/ui).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  publicDir: false,
  server: { port: 5173, host: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: 100000000,
    copyPublicDir: false,
    reportCompressedSize: false,
    rollupOptions: {
      input: 'src/main.ts',
      output: {
        format: 'iife',
        name: 'MartiMotoru',
        inlineDynamicImports: true,
        entryFileNames: 'game.js',
        assetFileNames: '[name][extname]',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/sim/**/*.test.ts'],
    passWithNoTests: true,
  },
});
