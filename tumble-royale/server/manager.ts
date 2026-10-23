// Owns every room on a single Node process: secure room codes, public
// matchmaking, and cleanup of abandoned rooms.

import { ROOM_CODE_ALPHABET } from '../shared/protocol';
import { Room, type RoomEnv } from './room';

const EMPTY_ROOM_TTL_MS = 60_000;

export function randomCode(randomBytes: (n: number) => Uint8Array): string {
  // Rejection sampling keeps every character uniformly likely.
  let out = '';
  while (out.length < 6) {
    for (const b of randomBytes(12)) {
      if (b >= 256 - (256 % ROOM_CODE_ALPHABET.length)) continue;
      out += ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length];
      if (out.length === 6) break;
    }
  }
  return out;
}

export class RoomManager {
  readonly rooms = new Map<string, Room>();

  constructor(private envFor: (code: string) => RoomEnv, private randomBytes: (n: number) => Uint8Array) {}

  create(isPublic = false): Room {
    let code = randomCode(this.randomBytes);
    while (this.rooms.has(code)) code = randomCode(this.randomBytes);
    const room = new Room(code, this.envFor(code), isPublic);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined { return this.rooms.get(code); }

  /** Quick play: the fullest public lobby that is still waiting, else a fresh one. */
  matchmake(): Room {
    let best: Room | null = null;
    for (const r of this.rooms.values()) {
      if (!r.settings.isPublic || r.phase !== 'lobby' || !r.joinable) continue;
      if (!best || r.humanCount > best.humanCount) best = r;
    }
    return best ?? this.create(true);
  }

  publicList() {
    return [...this.rooms.values()].filter((r) => r.settings.isPublic && !r.destroyed).map((r) => r.info()).slice(0, 50);
  }

  update(now: number) {
    for (const [code, r] of this.rooms) {
      r.update();
      if (r.emptySince !== null && now - r.emptySince > EMPTY_ROOM_TTL_MS) { r.destroy(); this.rooms.delete(code); }
    }
  }

  stats() {
    let players = 0, bots = 0;
    for (const r of this.rooms.values()) for (const p of r.players.values()) p.bot ? bots++ : players++;
    return { rooms: this.rooms.size, players, bots };
  }
}
