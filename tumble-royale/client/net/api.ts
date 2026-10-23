// HTTP API + profile handling. The browser keeps only a random secret token;
// coins, XP and unlocks live on the server.

import { DEFAULT_COS, FREE_ITEMS, type Cosmetics } from '../../shared/cosmetics';
import type { Profile } from '../../shared/progression';
import { Store } from '../settings';

const env = (import.meta as any).env ?? {};
/** Optional separate game server (e.g. a static client on one host, the Node server on another). */
export const SERVER_URL: string = (new URLSearchParams(location.search).get('server') ?? env.VITE_SERVER_URL ?? '').replace(/\/$/, '');

export function wsUrl(code: string): string {
  const base = SERVER_URL || location.origin;
  return base.replace(/^http/, 'ws') + '/ws/' + code;
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(SERVER_URL + path, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  createRoom: () => call<{ code: string }>('/api/rooms', {}),
  matchmake: () => call<{ code: string }>('/api/matchmake', {}),
  roomInfo: (code: string) => call<{ code: string; players: number; max: number; phase: string }>(`/api/rooms/${code}`),
  publicRooms: () => call<{ rooms: { code: string; players: number; max: number; phase: string; startsIn: number | null }[] }>('/api/rooms'),
  health: () => call<{ ok: boolean; rooms: number; players: number }>('/api/health'),
};

export interface ProfileView extends Profile {
  xpNext: number;
  daily: { id: string; text: string; goal: number; coins: number; progress: number; done: boolean }[];
}

const TOKEN_KEY = 'tumble.token.v1';
const LOCAL_KEY = 'tumble.localProfile.v1';
const params = new URLSearchParams(location.search);
/** `?guest` gives a throwaway identity (useful for testing several players in one browser). */
export const GUEST = params.has('guest');

function randomToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function getToken(): string {
  if (GUEST) {
    let t = sessionStorage.getItem(TOKEN_KEY);
    if (!t) { t = randomToken(); sessionStorage.setItem(TOKEN_KEY, t); }
    return t;
  }
  let t = null;
  try { t = localStorage.getItem(TOKEN_KEY); } catch { /* ignore */ }
  if (!t || !/^[0-9a-f]{48}$/.test(t)) { t = randomToken(); try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } }
  return t;
}

function localProfile(): ProfileView {
  let saved: Partial<{ name: string; equipped: Cosmetics }> = {};
  try { saved = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}'); } catch { /* ignore */ }
  return {
    id: 'local', name: saved.name ?? randomName(), level: 1, xp: 0, coins: 0, owned: [...FREE_ITEMS], equipped: saved.equipped ?? { ...DEFAULT_COS },
    stats: { matches: 0, wins: 0, rounds: 0, qualified: 0, finals: 0, bestPlace: 0, dives: 0, bounces: 0, knocks: 0, crowns: 0 },
    challenges: { day: 0, progress: {}, done: [] }, created: Date.now(), xpNext: 100, daily: [],
  };
}

const NAMES = ['Wobbly', 'Bouncy', 'Zoomer', 'Tumbler', 'Jelly', 'Pogo', 'Noodle', 'Sprout', 'Bonk', 'Squish', 'Blip', 'Dizzy'];
function randomName() { return NAMES[Math.floor(Math.random() * NAMES.length)] + Math.floor(10 + Math.random() * 89); }

export const profile = new Store<{ p: ProfileView; online: boolean; loading: boolean }>({ p: localProfile(), online: false, loading: true });

function saveLocal(p: ProfileView) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ name: p.name, equipped: p.equipped })); } catch { /* ignore */ } }

export async function loadProfile() {
  const cur = profile.get().p;
  try {
    const p = await call<ProfileView>('/api/profile/get', { token: getToken(), name: cur.name });
    profile.set({ p, online: true, loading: false });
    saveLocal(p);
  } catch {
    profile.set({ online: false, loading: false });
  }
}

export async function profileAction(action: 'name' | 'equip' | 'buy', body: object): Promise<string | null> {
  const st = profile.get();
  if (!st.online) {
    // Offline: names/equips of free items are kept locally so the menus still work.
    const p = { ...st.p, ...(action === 'name' ? { name: (body as any).name } : {}), ...(action === 'equip' ? { equipped: (body as any).cos } : {}) };
    if (action === 'buy') return 'The shop needs a connection to the game server.';
    profile.set({ p }); saveLocal(p);
    return null;
  }
  try {
    const p = await call<ProfileView>(`/api/profile/${action}`, { token: getToken(), ...body });
    profile.set({ p }); saveLocal(p);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
