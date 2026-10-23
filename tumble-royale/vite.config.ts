import { defineConfig } from 'vite';

const server = process.env.GAME_SERVER ?? 'http://localhost:8080';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: { outDir: 'dist/client', emptyOutDir: true, chunkSizeWarningLimit: 2000, target: 'es2022' },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': server,
      '/ws': { target: server.replace(/^http/, 'ws'), ws: true },
    },
  },
  esbuild: { jsx: 'automatic' },
});
