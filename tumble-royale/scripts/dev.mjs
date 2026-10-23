// Runs the game server (auto-restarting) and the Vite dev client together.
import { spawn } from 'node:child_process';

const procs = [
  spawn('npx', ['tsx', 'watch', '--clear-screen=false', 'server/node-main.ts'], { stdio: 'inherit', env: { ...process.env, PORT: process.env.PORT ?? '8080' } }),
  spawn('npx', ['vite', '--host'], { stdio: 'inherit' }),
];
const stop = () => { for (const p of procs) p.kill('SIGTERM'); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => { if (code) { console.error('a dev process exited with', code); stop(); } });
