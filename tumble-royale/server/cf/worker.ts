// Cloudflare Workers + Durable Objects adapter. One Durable Object class ("Room")
// plays three roles depending on the path the Worker forwards:
//   /room/*  — one instance per room code: runs the authoritative Room tick loop
//   /dir/*   — the "__directory__" instance: allocates codes, public matchmaking
//   /prof/*  — the "__profiles__" instance: persistent player progression
// Static client files are served by the platform's asset binding.

import { DurableObject } from 'cloudflare:workers';
import { ROOM_CODE_RE } from '../../shared/protocol';
import { randomCode } from '../manager';
import { type KV, ProfileService } from '../profiles';
import { type Conn, Room } from '../room';

export interface Env { ROOMS: DurableObjectNamespace; ASSETS?: Fetcher }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
const stub = (env: Env, name: string) => env.ROOMS.get(env.ROOMS.idFromName(name));
const hex = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST' } });
    const ws = p.match(/^\/ws\/([A-Z0-9]{6})$/);
    if (ws) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
      if (!ROOM_CODE_RE.test(ws[1])) return new Response('bad code', { status: 400 });
      return stub(env, 'room:' + ws[1]).fetch(new Request(`https://do/room/ws?code=${ws[1]}`, req));
    }
    if (p === '/api/rooms' && req.method === 'POST') return stub(env, '__directory__').fetch('https://do/dir/create', { method: 'POST', body: '{}' });
    if (p === '/api/rooms' && req.method === 'GET') return stub(env, '__directory__').fetch('https://do/dir/list');
    if (p === '/api/matchmake' && req.method === 'POST') return stub(env, '__directory__').fetch('https://do/dir/matchmake', { method: 'POST', body: '{}' });
    const info = p.match(/^\/api\/rooms\/([A-Z0-9]{6})$/);
    if (info) return stub(env, 'room:' + info[1]).fetch(`https://do/room/info?code=${info[1]}`);
    const prof = p.match(/^\/api\/profile\/(get|name|equip|buy)$/);
    if (prof && req.method === 'POST') return stub(env, '__profiles__').fetch(`https://do/prof/api/${prof[1]}`, { method: 'POST', body: await req.text() });
    if (p === '/api/health') return json({ ok: true, runtime: 'cloudflare' });
    if (p.startsWith('/api/')) return json({ error: 'not found' }, 404);
    // Single-page app: anything else is the client.
    if (env.ASSETS) return env.ASSETS.fetch(new Request(new URL('/', url), req));
    return new Response('not found', { status: 404 });
  },
};

export class Room$ extends DurableObject<Env> {
  private room: Room | null = null;
  private code = '';
  private timer: ReturnType<typeof setInterval> | null = null;
  private profiles: ProfileService | null = null;
  private lastDirPush = 0;

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;
    if (p.startsWith('/room/')) return this.roomFetch(req, url);
    if (p.startsWith('/dir/')) return this.dirFetch(req, p.slice(5));
    if (p.startsWith('/prof/')) return this.profFetch(req, p.slice(6));
    return json({ error: 'bad route' }, 404);
  }

  // ------------------------------------------------------------ room role

  private async ensureRoom(code: string): Promise<Room | null> {
    if (this.room && !this.room.destroyed) return this.room;
    const meta = await this.ctx.storage.get<{ isPublic: boolean }>('meta');
    if (!meta) return null;
    this.code = code;
    const env = this.env;
    this.room = new Room(code, {
      now: () => Date.now(),
      randomHex: hex,
      grantRewards: async (token, s) => {
        const r = await stub(env, '__profiles__').fetch('https://do/prof/grant', { method: 'POST', body: JSON.stringify({ token, s }) });
        return r.ok ? r.json() : null;
      },
      loadProfile: async (token) => {
        const r = await stub(env, '__profiles__').fetch('https://do/prof/load', { method: 'POST', body: JSON.stringify({ token }) });
        return r.ok ? r.json() : null;
      },
      onChange: (room) => this.pushDirectory(room, true),
    }, meta.isPublic);
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 1000 / 60);
    return this.room;
  }

  private tick() {
    const r = this.room;
    if (!r) return;
    r.update();
    if (r.settings.isPublic) this.pushDirectory(r, false);
    if (r.emptySince !== null && Date.now() - r.emptySince > 60000) {
      r.destroy();
      this.room = null;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.ctx.storage.delete('meta');
      stub(this.env, '__directory__').fetch('https://do/dir/remove', { method: 'POST', body: JSON.stringify({ code: this.code }) }).catch(() => {});
    }
  }

  private pushDirectory(r: Room, force: boolean) {
    const now = Date.now();
    if (!force && now - this.lastDirPush < 3000) return;
    this.lastDirPush = now;
    stub(this.env, '__directory__').fetch('https://do/dir/update', { method: 'POST', body: JSON.stringify(r.info()) }).catch(() => {});
  }

  private async roomFetch(req: Request, url: URL): Promise<Response> {
    const code = url.searchParams.get('code') ?? '';
    const action = url.pathname.slice(6);
    if (action === 'init') {
      const body = await req.json() as { isPublic: boolean };
      await this.ctx.storage.put('meta', { isPublic: !!body.isPublic });
      await this.ensureRoom(code);
      return json({ ok: true });
    }
    const room = await this.ensureRoom(code);
    if (action === 'info') return room ? json(room.info()) : json({ error: 'Room not found. Check the code.' }, 404);
    if (action !== 'ws') return json({ error: 'bad route' }, 404);
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    server.accept();
    if (!room) {
      server.send(JSON.stringify({ t: 'error', code: 'room_not_found', msg: 'That room does not exist (or it closed).' }));
      server.close(4404, 'not found');
      return new Response(null, { status: 101, webSocket: client } as ResponseInit);
    }
    const conn: Conn = {
      send: (d) => { try { server.send(d); } catch { /* closed */ } },
      close: (c, r) => { try { server.close(c, r); } catch { /* closed */ } },
    };
    room.open(conn);
    server.addEventListener('message', (e) => room.message(conn, typeof e.data === 'string' ? e.data : new Uint8Array(e.data)));
    server.addEventListener('close', () => room.close(conn));
    server.addEventListener('error', () => room.close(conn));
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }

  // ------------------------------------------------------------ directory role

  private async dirFetch(req: Request, action: string): Promise<Response> {
    const st = this.ctx.storage;
    if (action === 'create' || action === 'matchmake') {
      if (action === 'matchmake') {
        const list = await st.list<any>({ prefix: 'r:' });
        let best: any = null;
        for (const r of list.values()) {
          if (!r.isPublic || r.phase !== 'lobby' || r.players >= r.max || Date.now() - r.updated > 15000) continue;
          if (!best || r.players > best.players) best = r;
        }
        if (best) return json({ code: best.code });
      }
      let code = '';
      for (let i = 0; i < 20; i++) { code = randomCode((n) => crypto.getRandomValues(new Uint8Array(n))); if (!(await st.get('r:' + code))) break; }
      const isPublic = action === 'matchmake';
      await st.put('r:' + code, { code, isPublic, phase: 'lobby', players: 0, max: 30, startsIn: null, updated: Date.now() });
      await stub(this.env, 'room:' + code).fetch(`https://do/room/init?code=${code}`, { method: 'POST', body: JSON.stringify({ isPublic }) });
      return json({ code });
    }
    if (action === 'list') {
      const list = await st.list<any>({ prefix: 'r:' });
      const rooms = [...list.values()].filter((r) => r.isPublic && Date.now() - r.updated < 15000).map(({ updated, ...r }) => r).slice(0, 50);
      return json({ rooms });
    }
    if (action === 'update') {
      const info = await req.json() as any;
      if (ROOM_CODE_RE.test(info.code)) await st.put('r:' + info.code, { ...info, updated: Date.now() });
      return json({ ok: true });
    }
    if (action === 'remove') {
      const { code } = await req.json() as { code: string };
      await st.delete('r:' + code);
      return json({ ok: true });
    }
    return json({ error: 'bad route' }, 404);
  }

  // ------------------------------------------------------------ profiles role

  private svc(): ProfileService {
    if (!this.profiles) {
      const st = this.ctx.storage;
      const kv: KV = { get: async (k) => (await st.get<string>(k)) ?? null, set: async (k, v) => { await st.put(k, v); } };
      this.profiles = new ProfileService(kv);
    }
    return this.profiles;
  }

  private async profFetch(req: Request, action: string): Promise<Response> {
    const body = await req.json().catch(() => ({})) as any;
    if (action === 'grant') return json(await this.svc().grant(body.token, body.s));
    if (action === 'load') return json(await this.svc().load(body.token));
    if (action.startsWith('api/')) { const r = await this.svc().api(action.slice(4), body); return json(r.body, r.status); }
    return json({ error: 'bad route' }, 404);
  }
}

// The platform expects the Durable Object class to be exported as `Room`.
export { Room$ as Room };
