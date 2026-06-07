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
  },
});
