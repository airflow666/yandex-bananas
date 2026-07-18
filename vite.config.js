import { defineConfig } from 'vite';

/**
 * Vite по умолчанию ставит crossorigin на модульный скрипт входной точки.
 * Яндекс Игры (и другие игровые площадки) раздают загруженную игру с
 * CDN-поддомена без заголовка Access-Control-Allow-Origin — с crossorigin
 * браузер молча блокирует выполнение модуля, и игра не запускается вообще
 * (при этом на localhost всё same-origin, поэтому баг не проявляется).
 */
function stripCrossorigin() {
  return {
    name: 'strip-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin(="[^"]*")?/g, '');
    },
  };
}

// base: './' — Яндекс Игры раздают игру из подкаталога, все пути должны быть относительными
export default defineConfig({
  base: './',
  plugins: [stripCrossorigin()],
  build: {
    target: 'es2018',
    assetsInlineLimit: 8192,
    chunkSizeWarningLimit: 1600,
    modulePreload: false,
  },
  server: {
    host: true,
    port: 5173,
  },
});
