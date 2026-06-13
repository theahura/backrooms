import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 8080,
  },
  build: {
    target: 'ES2020',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    // Several suites are compute-heavy property tests (e.g. furniture/maze
    // placement swept across 150-300 seeds) that run ~2s but can spike past the
    // default 5s timeout under CI load. Give them generous headroom so timing
    // jitter never fails a deterministic test; a genuine hang is still caught.
    testTimeout: 20000,
  },
});
