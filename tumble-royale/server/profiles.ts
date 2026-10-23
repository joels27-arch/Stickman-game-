// Player profiles: progression, coins, inventory. The client only holds a random
// secret token; every balance and unlock lives server-side behind a KV store
// (SQLite on Node, Durable Object storage on Cloudflare).

import { DEFAULT_COS, FREE_ITEMS, ITEM_BY_ID, sanitizeCos, type Cosmetics } from '../shared/cosmetics';
import { applyMatch, dailyChallenges, dayIndex, type MatchStats, type Profile, type RewardResult, xpForLevel } from '../shared/progression';
import { sanitizeName } from '../shared/protocol';

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

const TOKEN_RE = /^[0-9a-f]{32,128}$/;

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function newProfile(id: string, name: string, now: number): Profile {
  return {
    id, name: name || 'Bean', level: 1, xp: 0, coins: 300, owned: [...FREE_ITEMS], equipped: { ...DEFAULT_COS },
    stats: { matches: 0, wins: 0, rounds: 0, qualified: 0, finals: 0, bestPlace: 0, dives: 0, bounces: 0, knocks: 0, crowns: 0 },
    challenges: { day: dayIndex(now), progress: {}, done: [] }, created: now,
  };
}

export type ApiResult = { status: number; body: unknown };

export class ProfileService {
  // Serialise writes per profile so concurrent rewards/purchases can't race.
  private locks = new Map<string, Promise<unknown>>();

  constructor(private kv: KV, private now: () => number = () => Date.now()) {}

  private async key(token: string) { return 'p:' + (await sha256(token)); }

  private async withProfile<T>(token: string, create: boolean, fn: (p: Profile) => T | Promise<T>): Promise<T | null> {
    if (!TOKEN_RE.test(token)) return null;
    const key = await this.key(token);
    const prev = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((r) => (release = r));
    const chain = prev.then(() => mine);
    this.locks.set(key, chain);
    await prev;
    try {
      const raw = await this.kv.get(key);
      let p: Profile | null = raw ? JSON.parse(raw) : null;
      if (!p) { if (!create) return null; p = newProfile(key.slice(2, 14), '', this.now()); }
      const out = await fn(p);
      await this.kv.set(key, JSON.stringify(p));
      return out;
    } finally {
      release();
      if (this.locks.get(key) === chain) this.locks.delete(key);
    }
  }

  async load(token: string): Promise<{ name: string; level: number; cos: Cosmetics } | null> {
    const r = await this.withProfile(token, false, (p) => ({ name: p.name, level: p.level, cos: sanitizeCos(p.equipped, new Set(p.owned)) }));
    return r;
  }

  async grant(token: string, m: MatchStats): Promise<RewardResult | null> {
    return this.withProfile(token, true, (p) => applyMatch(p, m, this.now()));
  }

  private view(p: Profile) {
    const day = dayIndex(this.now());
    const progress = p.challenges.day === day ? p.challenges : { day, progress: {}, done: [] as string[] };
    return {
      ...p, xpNext: xpForLevel(p.level),
      daily: dailyChallenges(day).map((c) => ({ id: c.id, text: c.text, goal: c.goal, coins: c.coins, progress: progress.progress[c.id] ?? 0, done: progress.done.includes(c.id) })),
    };
  }

  /** Handles POST /api/profile/<action>. */
  async api(action: string, body: any): Promise<ApiResult> {
    const token = typeof body?.token === 'string' ? body.token : '';
    if (!TOKEN_RE.test(token)) return { status: 400, body: { error: 'bad token' } };
    switch (action) {
      case 'get': {
        const r = await this.withProfile(token, true, (p) => {
          const n = sanitizeName(body.name);
          if (n && (!p.name || p.name === 'Bean')) p.name = n;
          return this.view(p);
        });
        return { status: 200, body: r };
      }
      case 'name': {
        const n = sanitizeName(body.name);
        if (!n) return { status: 400, body: { error: 'Names need 2–16 characters.' } };
        const r = await this.withProfile(token, true, (p) => { p.name = n; return this.view(p); });
        return { status: 200, body: r };
      }
      case 'equip': {
        const r = await this.withProfile(token, true, (p) => { p.equipped = sanitizeCos(body.cos, new Set(p.owned)); return this.view(p); });
        return { status: 200, body: r };
      }
      case 'buy': {
        const item = ITEM_BY_ID.get(String(body.item));
        if (!item) return { status: 400, body: { error: 'Unknown item.' } };
        let err = '';
        const r = await this.withProfile(token, true, (p) => {
          if (p.owned.includes(item.id)) { err = 'You already own this.'; return null; }
          if (p.coins < item.price) { err = 'Not enough coins.'; return null; }
          p.coins -= item.price;
          p.owned.push(item.id);
          return this.view(p);
        });
        if (err) return { status: 400, body: { error: err } };
        return { status: 200, body: r };
      }
    }
    return { status: 404, body: { error: 'unknown action' } };
  }
}

/** In-memory KV (tests, offline). */
export class MemoryKV implements KV {
  m = new Map<string, string>();
  async get(k: string) { return this.m.get(k) ?? null; }
  async set(k: string, v: string) { this.m.set(k, v); }
}
