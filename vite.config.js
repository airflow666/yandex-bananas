import { defineConfig } from 'vite';

// base: './' — Яндекс Игры раздают игру из подкаталога, все пути должны быть относительными
export default defineConfig({
  base: './',
  build: {
    target: 'es2018',
    assetsInlineLimit: 8192,
    chunkSizeWarningLimit: 1600,
  },
  server: {
    host: true,
    port: 5173,
  },
});
