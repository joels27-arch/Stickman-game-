// Bundles the Cloudflare Worker + Durable Object into dist/worker/index.js.
import { build } from 'esbuild';

await build({
  entryPoints: ['server/cf/worker.ts'],
  outfile: 'dist/worker/index.js',
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  external: ['cloudflare:workers'],
  conditions: ['worker', 'browser'],
  logLevel: 'info',
});
