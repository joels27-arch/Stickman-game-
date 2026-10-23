// Bundles the Node server into dist/server/node-main.js (ws stays external).
import { build } from 'esbuild';

await build({
  entryPoints: ['server/node-main.ts'],
  outfile: 'dist/server/node-main.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['ws', 'node:*'],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'info',
});
