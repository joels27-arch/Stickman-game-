// Real multiplayer integration tests: a real Node server, real WebSockets and
// the same GameSession class the browser uses (prediction + interpolation).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Mode } from '../shared/constants';
import { startServer } from '../server/node-main';
import { GameSession, wsTransport } from '../client/net/session';

let srv: Awaited<ReturnType<typeof startServer>>;
let base = '';

beforeAll(async () => {
  srv = await startServer({ port: 0, host: '127.0.0.1', dataDir: null, quiet: true });
  base = `http://127.0.0.1:${srv.port}`;
});
afterAll(async () => { await srv.close(); });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, ms = 8000, what = 'condition') {
  const t0 = Date.now();
  while (!cond()) { if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`); await sleep(20); }
}

function client(name: string, token?: string) {
  const errors: string[] = [];
  const s = new GameSession((code) => wsTransport(`ws://127.0.0.1:${srv.port}/ws/${code}`), { name, token }, { onError: (_c, m) => errors.push(m) });
  return { s, errors };
}

/** Drive sessions at ~60 fps with a per-client input function. */
function drive(list: GameSession[], input: (i: number) => { mx: number; mz: number; btn: number }) {
  const t = setInterval(() => list.forEach((s, i) => s.update(() => input(i))), 16);
  return () => clearInterval(t);
}

async function createRoom(): Promise<string> {
  const r = await fetch(`${base}/api/rooms`, { method: 'POST' });
  return (await r.json()).code;
}

describe('multiplayer over real websockets', () => {
  it('rejects unknown room codes', async () => {
    const r = await fetch(`${base}/api/rooms/ZZZZZZ`);
    expect(r.status).toBe(404);
    const { s, errors } = client('Ghost');
    s.connect('ZZZZZZ');
    await until(() => errors.length > 0, 3000, 'error');
    expect(errors[0]).toMatch(/does not exist/);
  });

  for (const n of [2, 4, 10]) {
    it(`${n} players join, start, see each other, and stay in sync`, async () => {
      const code = await createRoom();
      const cs = Array.from({ length: n }, (_, i) => client(`P${i}`));
      for (const c of cs) c.s.connect(code);
      await until(() => cs.every((c) => c.s.you >= 0 && c.s.players.length === n), 8000, 'everyone in lobby');
      const host = cs.find((c) => c.s.isHost)!.s;
      expect(cs.filter((c) => c.s.isHost).length).toBe(1);
      host.updateSettings({ mode: 'single', map: 'rainbow', fillBots: 0 });
      await until(() => cs.every((c) => c.s.settings?.mode === 'single'), 3000, 'settings');
      for (const c of cs) if (!c.s.isHost) c.s.setReady(true);
      await until(() => cs.every((c) => c.s.players.filter((p) => p.id !== host.host).every((p) => p.ready)), 3000, 'ready');
      host.start();
      await until(() => cs.every((c) => c.s.round !== null), 4000, 'round');
      // Parallel lanes (spawn spacing 1.6 m) so nobody shoves anyone: prediction must then match the server.
      const stop = drive(cs.map((c) => c.s), (i) => ({ mx: 0, mz: 1, btn: i % 2 && Date.now() % 1400 < 120 ? 1 : 0 }));
      const room = srv.manager.get(code)!;
      // Wait past the intro + countdown (7 s) and run for ~2.5 s.
      await until(() => room.phase === 'play', 12000, 'play phase');
      await sleep(2500);
      stop();
      // Everyone sees everyone else, with interpolated positions close to the server's truth.
      for (const c of cs) {
        const visible = [...c.s.remotes.values()].filter((t) => t.visible).length;
        expect(visible, `${c.s.you} sees others`).toBe(n - 1);
        for (const [id, tr] of c.s.remotes) {
          const truth = room.players.get(id)!.state;
          const d = Math.hypot(tr.x - truth.x, tr.z - truth.z);
          expect(d, `client ${c.s.you} view of ${id}`).toBeLessThan(3.5); // ~7 m/s × (interp delay + latency)
        }
        // Client prediction agrees with the authoritative server.
        const truth = room.players.get(c.s.you)!.state;
        expect(truth.mode).not.toBe(Mode.Out);
        expect(truth.z).toBeGreaterThan(4); // they actually ran (bumpers slow a few down)
        expect(Math.abs(c.s.pred.z - truth.z)).toBeLessThan(2.5); // prediction runs a few ticks ahead
        expect(c.s.lastCorrection, `correction for ${c.s.you} (${c.s.corrections} corrections)`).toBeLessThan(0.05);
      }
      // Obstacles: every client evaluates the same pose for a moving body at the same tick.
      const w0 = cs[0].s.world!, w1 = cs[n - 1].s.world!;
      const mover = w0.bodies.find((b) => b.moving)!;
      const P0 = { x: 0, y: 0, z: 0 }, P1 = { x: 0, y: 0, z: 0 };
      const R0 = new Float64Array(9), R1 = new Float64Array(9);
      w0.pose(mover, 1234, P0, R0); w1.pose(w1.bodies[mover.id], 1234, P1, R1);
      expect(P0).toEqual(P1);
      for (const c of cs) c.s.leave();
    }, 40000);
  }

  it('reconnects after a dropped connection and keeps the same seat mid-round', async () => {
    const code = await createRoom();
    const a = client('Alice'), b = client('Bob');
    a.s.connect(code); b.s.connect(code);
    await until(() => a.s.players.length === 2 && b.s.players.length === 2, 5000, 'lobby');
    const host = a.s.isHost ? a.s : b.s;
    host.updateSettings({ mode: 'single', map: 'rainbow', fillBots: 0 });
    await sleep(100);
    host.start();
    const stop = drive([a.s, b.s], () => ({ mx: 0, mz: 1, btn: 0 }));
    const room = srv.manager.get(code)!;
    await until(() => room.phase === 'play', 12000, 'play');
    const idBefore = b.s.you;
    b.s.debugDrop();
    await until(() => b.s.state === 'reconnecting' || b.s.state === 'connecting', 2000, 'drop noticed');
    await until(() => b.s.state === 'connected', 6000, 'reconnected');
    expect(b.s.you).toBe(idBefore);
    await sleep(1500);
    expect(room.players.get(idBefore)!.conn).not.toBeNull();
    expect(room.players.get(idBefore)!.status).toBe('alive');
    expect(b.s.round).not.toBeNull();
    stop();
    a.s.leave(); b.s.leave();
  }, 30000);

  it('migrates the host when the host leaves, and a late joiner spectates a running match', async () => {
    const code = await createRoom();
    const a = client('Host'), b = client('Guest');
    a.s.connect(code);
    await until(() => a.s.you >= 0, 3000, 'a');
    b.s.connect(code);
    await until(() => a.s.players.length === 2 && b.s.players.length === 2, 3000, 'both');
    expect(a.s.isHost).toBe(true);
    a.s.leave();
    await until(() => b.s.players.length === 1 && b.s.isHost, 3000, 'host migrated');
    // Start a match with bots, then a third player joins mid-match.
    b.s.updateSettings({ fillBots: 6, mode: 'single', map: 'rainbow' });
    await sleep(100);
    b.s.start();
    const room = srv.manager.get(code)!;
    await until(() => room.phase === 'intro' || room.phase === 'countdown', 3000, 'match running');
    const c = client('Late');
    c.s.connect(code);
    const stop = drive([b.s, c.s], () => ({ mx: 0, mz: 1, btn: 0 }));
    await until(() => c.s.round !== null, 3000, 'late joiner gets the round');
    await until(() => c.s.remotes.size >= 6, 10000, 'late joiner receives snapshots');
    expect(c.s.me?.status).toBe('spectator');
    expect(room.players.get(c.s.you)!.inRound).toBe(false);
    stop();
    b.s.leave(); c.s.leave();
  }, 30000);

  it('the same profile cannot appear twice in a room', async () => {
    const code = await createRoom();
    const token = 'ab'.repeat(24);
    const a = client('Me', token), b = client('Me again', token);
    a.s.connect(code);
    await until(() => a.s.you >= 0, 3000, 'a');
    b.s.connect(code);
    await until(() => b.s.you >= 0, 3000, 'b');
    await until(() => a.errors.length > 0, 3000, 'first tab told it was replaced');
    expect(b.s.you).toBe(a.s.you);
    expect(srv.manager.get(code)!.humanCount).toBe(1);
    b.s.leave();
  }, 15000);
});
