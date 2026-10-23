// Node entry point: static files + JSON API + WebSocket game rooms on one port.
//   PORT=8080 node dist/server/node-main.js

import { randomBytes } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { ROOM_CODE_RE } from '../shared/protocol';
import { RoomManager } from './manager';
import { type KV, MemoryKV, ProfileService } from './profiles';
import type { Conn, RoomEnv } from './room';

const here = dirname(fileURLToPath(import.meta.url));

export interface ServerOptions { port: number; host?: string; clientDir?: string; dataDir?: string | null; quiet?: boolean }

// ------------------------------------------------------------ storage

async function openKV(DATA_DIR: string | null, quiet: boolean): Promise<KV> {
  if (!DATA_DIR) return new MemoryKV();
  try {
    const { DatabaseSync } = await import('node:sqlite');
    mkdirSync(DATA_DIR, { recursive: true });
    const db = new DatabaseSync(join(DATA_DIR, 'tumble.db'));
    db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    const get = db.prepare('SELECT v FROM kv WHERE k = ?');
    const set = db.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v');
    if (!quiet) console.log(`[db] sqlite at ${join(DATA_DIR, 'tumble.db')}`);
    return {
      async get(k) { const r = get.get(k) as { v: string } | undefined; return r ? r.v : null; },
      async set(k, v) { set.run(k, v); },
    };
  } catch (e) {
    console.warn('[db] node:sqlite unavailable, profiles are kept in memory only:', (e as Error).message);
    return new MemoryKV();
  }
}

export async function startServer(opts: ServerOptions) {
  const PORT = opts.port, HOST = opts.host ?? '0.0.0.0', quiet = !!opts.quiet;
  const CLIENT_DIR = resolve(opts.clientDir ?? join(here, '../client'));
  const DATA_DIR = opts.dataDir === null ? null : resolve(opts.dataDir ?? join(process.cwd(), 'data'));
  const profiles = new ProfileService(await openKV(DATA_DIR, quiet));

  const env = (code: string): RoomEnv => ({
    now: () => performance.now(),
    randomHex: (n) => randomBytes(n).toString('hex'),
    log: (m) => { if (!quiet) console.log(`[room ${code}] ${m}`); },
    grantRewards: (token, s) => profiles.grant(token, s),
    loadProfile: (token) => profiles.load(token),
  });
  const manager = new RoomManager(env, (n) => randomBytes(n));

  // ------------------------------------------------------------ http

  const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary',
    '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
  };

  const buckets = new Map<string, { n: number; t: number }>();
  function rateLimited(ip: string, cost = 1, perMin = 30): boolean {
    const now = Date.now();
    const b = buckets.get(ip) ?? { n: perMin, t: now };
    b.n = Math.min(perMin, b.n + ((now - b.t) / 60000) * perMin);
    b.t = now;
    buckets.set(ip, b);
    if (b.n < cost) return true;
    b.n -= cost;
    return false;
  }

  function json(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
    res.end(JSON.stringify(body));
  }

  function readBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolveBody) => {
      let data = '';
      req.on('data', (c) => { data += c; if (data.length > 16384) req.destroy(); });
      req.on('end', () => { try { resolveBody(data ? JSON.parse(data) : {}); } catch { resolveBody({}); } });
      req.on('error', () => resolveBody({}));
    });
  }

  function serveStatic(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://x');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(CLIENT_DIR, path);
    if (!file.startsWith(CLIENT_DIR)) { res.writeHead(403).end(); return; }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(CLIENT_DIR, 'index.html'); // SPA routes like /join/ABC123
    if (!existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Client not built. Run `npm run build`, or use `npm run dev`.'); return; }
    const ext = extname(file);
    const immutable = file.includes(`${join(CLIENT_DIR, 'assets')}`);
    res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream', 'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' });
    createReadStream(file).pipe(res);
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() || req.socket.remoteAddress || '?';
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST' }).end(); return; }
    if (!url.pathname.startsWith('/api/')) { serveStatic(req, res); return; }
    try {
      if (url.pathname === '/api/health') {
        const detail = url.searchParams.has('detail');
        return json(res, 200, { ok: true, ...manager.stats(detail), uptime: process.uptime(), ...(detail ? { cpu: process.cpuUsage(), rss: process.memoryUsage().rss } : {}) });
      }
      if (url.pathname === '/api/rooms' && req.method === 'POST') {
        if (rateLimited(ip, 1, 20)) return json(res, 429, { error: 'Too many rooms created. Try again in a minute.' });
        const room = manager.create(false);
        return json(res, 200, { code: room.code });
      }
      if (url.pathname === '/api/rooms' && req.method === 'GET') return json(res, 200, { rooms: manager.publicList() });
      if (url.pathname === '/api/matchmake' && req.method === 'POST') {
        if (rateLimited(ip, 1, 60)) return json(res, 429, { error: 'Slow down a little.' });
        return json(res, 200, { code: manager.matchmake().code });
      }
      const m = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})$/);
      if (m && req.method === 'GET') {
        if (rateLimited(ip, 0.2, 60)) return json(res, 429, { error: 'Too many lookups.' });
        const room = manager.get(m[1]);
        return room ? json(res, 200, room.info()) : json(res, 404, { error: 'Room not found. Check the code.' });
      }
      const pm = url.pathname.match(/^\/api\/profile\/(get|name|equip|buy)$/);
      if (pm && req.method === 'POST') {
        if (rateLimited(ip, 0.2, 120)) return json(res, 429, { error: 'Too many requests.' });
        const r = await profiles.api(pm[1], await readBody(req));
        return json(res, r.status, r.body);
      }
      json(res, 404, { error: 'not found' });
    } catch (e) {
      console.error(e);
      json(res, 500, { error: 'server error' });
    }
  });

  // ------------------------------------------------------------ websockets

  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 16 * 1024 });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const m = url.pathname.match(/^\/ws\/([A-Z0-9]{6})$/);
    if (!m || !ROOM_CODE_RE.test(m[1])) { socket.write('HTTP/1.1 400 Bad Request\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => attach(ws, m[1]));
  });

  function attach(ws: WebSocket, code: string) {
    const room = manager.get(code);
    if (!room || room.destroyed) {
      ws.send(JSON.stringify({ t: 'error', code: 'room_not_found', msg: 'That room does not exist (or it closed).' }));
      ws.close(4404, 'not found');
      return;
    }
    const conn: Conn = {
      send(d) {
        if (ws.readyState !== ws.OPEN) return;
        // Drop snapshots to a client whose socket is backed up instead of queueing stale state.
        if (typeof d !== 'string' && ws.bufferedAmount > 256 * 1024) return;
        ws.send(d);
      },
      close(c, r) { try { ws.close(c, r); } catch { /* ignore */ } },
    };
    room.open(conn);
    ws.on('message', (data, isBinary) => {
      const buf = data as Buffer;
      room.message(conn, isBinary ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) : buf.toString('utf8'));
    });
    ws.on('close', () => room.close(conn));
    ws.on('error', () => room.close(conn));
  }

  // ------------------------------------------------------------ loop

  const loop = setInterval(() => manager.update(performance.now()), 1000 / 120);

  await new Promise<void>((ok) => server.listen(PORT, HOST, ok));
  const port = (server.address() as { port: number }).port;
  if (!quiet) {
    console.log(`Tumble Royale server on http://localhost:${port}`);
    for (const list of Object.values(networkInterfaces())) for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  on your network: http://${a.address}:${port}`);
    }
  }
  return {
    port, manager, profiles,
    close: () => new Promise<void>((ok) => { clearInterval(loop); for (const c of wss.clients) c.terminate(); wss.close(); server.close(() => ok()); }),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await startServer({
    port: Number(process.env.PORT ?? 8080), host: process.env.HOST,
    clientDir: process.env.CLIENT_DIR, dataDir: process.env.DATA_DIR,
  });
}
