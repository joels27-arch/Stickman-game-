// Multiplayer load test: N real WebSocket clients (the browser's GameSession
// class: prediction, reconciliation, interpolation) against a separate server
// process. Measures server tick cost, CPU, memory, bandwidth and prediction error.
//
//   npx tsx tests/load.ts            # 2, 4, 10, 20, 30 clients, 25 s of play each
//   npx tsx tests/load.ts 30 60      # 30 clients for 60 s

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { GameSession, wsTransport } from '../client/net/session';
import { Btn } from '../shared/constants';

const PORT = 8090 + Math.floor(Math.random() * 500);
/** TARGET=http://host:port runs against an already running server (e.g. `wrangler dev` or a deployment). */
const TARGET = process.env.TARGET?.replace(/\/$/, '');
const base = TARGET ?? `http://127.0.0.1:${PORT}`;
const wsBase = base.replace(/^http/, 'ws');
const sizes = process.argv[2] ? [Number(process.argv[2])] : [2, 4, 10, 20, 30];
const playSeconds = Number(process.argv[3] ?? 25);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until(cond: () => boolean, ms: number, what: string) {
  const t0 = Date.now();
  while (!cond()) { if (Date.now() - t0 > ms) throw new Error('timeout: ' + what); await sleep(25); }
}

const server = TARGET ? null : spawn('node', ['--import', 'tsx', 'server/node-main.ts'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: 'scratch/loaddb' }, stdio: ['ignore', 'pipe', 'inherit'] });
process.on('exit', () => server?.kill());

for (let i = 0; i < 100; i++) { try { await fetch(base + '/api/health'); break; } catch { await sleep(100); } }

const health = async () => {
  const h = (await (await fetch(base + '/api/health?detail')).json()) as any;
  // Remote targets (Cloudflare) don't expose process stats.
  return { detail: [], cpu: { user: 0, system: 0 }, rss: 0, ...h };
};
const results: any[] = [];

for (const n of sizes) {
  const code = ((await (await fetch(base + '/api/rooms', { method: 'POST' })).json()) as any).code as string;
  const sessions: GameSession[] = [];
  for (let i = 0; i < n; i++) {
    const tok = (i + 1).toString(16).padStart(2, '0').repeat(24);
    const s = new GameSession((c) => wsTransport(`${wsBase}/ws/${c}`), { name: `Load${i}`, token: tok });
    s.connect(code);
    sessions.push(s);
  }
  await until(() => sessions.every((s) => s.you >= 0 && s.players.length === n), 15000, 'all joined');
  const host = sessions.find((s) => s.isHost)!;
  host.updateSettings({ mode: 'single', map: 'rainbow', fillBots: 0 });
  await sleep(200);
  host.start();
  // Scripted "players": run forward, steer a little, jump and dive now and then.
  let frame = 0;
  const loop = setInterval(() => {
    frame++;
    sessions.forEach((s, i) => s.update(() => {
      const t = frame / 60 + i;
      const btn = (Math.sin(t * 1.7 + i) > 0.96 ? Btn.Jump : 0) | (Math.sin(t * 0.9 + i * 2) > 0.995 ? Btn.Dive : 0);
      return { mx: Math.sin(t * 0.6 + i) * 0.35, mz: 1, btn };
    }));
  }, 1000 / 60);
  await until(() => sessions.every((s) => s.round !== null), 5000, 'round');
  await sleep(7200); // intro + countdown
  const h0 = await health();
  const bytes0 = sessions.map((s) => s.bytesIn);
  const t0 = Date.now();
  let maxCorr = 0, corrCount0 = sessions.reduce((a, s) => a + s.corrections, 0);
  const rtts: number[] = [];
  while (Date.now() - t0 < playSeconds * 1000) {
    await sleep(1000);
    for (const s of sessions) { maxCorr = Math.max(maxCorr, s.lastCorrection); rtts.push(s.rtt); }
  }
  const secs = (Date.now() - t0) / 1000;
  const h1 = await health();
  clearInterval(loop);
  const none = { avgTickMs: null, maxTickMs: null, bytesOut: 0, lateInputs: 0 };
  const room0 = h0.detail.find((r: any) => r.code === code) ?? none, room1 = h1.detail.find((r: any) => r.code === code) ?? none;
  const kbPerClient = sessions.map((s, i) => (s.bytesIn - bytes0[i]) / 1024 / secs);
  const cpuMs = (h1.cpu.user + h1.cpu.system - h0.cpu.user - h0.cpu.system) / 1000;
  const visibleMin = Math.min(...sessions.map((s) => [...s.remotes.values()].filter((r) => r.visible).length));
  const row = {
    clients: n,
    seconds: +secs.toFixed(1),
    serverCpuPct: +((cpuMs / (secs * 1000)) * 100).toFixed(1),
    serverRssMB: +(h1.rss / 1048576).toFixed(1),
    avgTickMs: room1.avgTickMs,
    maxTickMs: room1.maxTickMs,
    serverOutKBps: +(((room1.bytesOut - room0.bytesOut) / 1024) / secs).toFixed(1),
    perClientInKBps: +(kbPerClient.reduce((a, b) => a + b, 0) / n).toFixed(2),
    avgRttMs: +(rtts.reduce((a, b) => a + b, 0) / rtts.length).toFixed(1),
    corrections: sessions.reduce((a, s) => a + s.corrections, 0) - corrCount0,
    bigCorrections: sessions.reduce((a, s) => a + s.bigCorrections, 0),
    maxCorrectionM: +maxCorr.toFixed(3),
    lateInputs: room1.lateInputs - room0.lateInputs,
    minRemotesVisible: visibleMin,
  };
  results.push(row);
  console.log(JSON.stringify(row));
  for (const s of sessions) s.leave();
  await sleep(600);
}

console.table(results);
mkdirSync('tests/results', { recursive: true });
writeFileSync(TARGET ? 'tests/results/load-remote.json' : 'tests/results/load.json', JSON.stringify({ date: new Date().toISOString(), node: process.version, results }, null, 2));
server?.kill();
process.exit(0);
