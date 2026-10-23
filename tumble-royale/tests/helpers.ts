import { randomBytes } from 'node:crypto';
import { PROTOCOL_VERSION } from '../shared/constants';
import type { ServerMsg } from '../shared/protocol';
import { type Conn, Room, type RoomEnv } from '../server/room';

/** A fake clock + fake sockets for driving a Room deterministically and fast. */
export class FakeClock { t = 0; now = () => this.t; }

export class FakeConn implements Conn {
  msgs: ServerMsg[] = [];
  bins = 0;
  closed: number | null = null;
  send(d: string | Uint8Array) { if (typeof d === 'string') this.msgs.push(JSON.parse(d)); else this.bins++; }
  close(code?: number) { this.closed = code ?? 1000; }
  last<T extends ServerMsg['t']>(t: T): Extract<ServerMsg, { t: T }> | undefined {
    for (let i = this.msgs.length - 1; i >= 0; i--) if (this.msgs[i].t === t) return this.msgs[i] as any;
    return undefined;
  }
  all<T extends ServerMsg['t']>(t: T): Extract<ServerMsg, { t: T }>[] { return this.msgs.filter((m) => m.t === t) as any; }
}

export function makeRoom(clock: FakeClock, isPublic = false, extra: Partial<RoomEnv> = {}) {
  return new Room('TESTAB', { now: clock.now, randomHex: (n) => randomBytes(n).toString('hex'), ...extra }, isPublic);
}

export function join(room: Room, name: string, extra: object = {}): FakeConn {
  const c = new FakeConn();
  room.open(c);
  room.message(c, JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, name, ...extra }));
  return c;
}

/** Advance the fake clock in 1/60 s steps, calling update each step. */
export function advance(room: Room, clock: FakeClock, seconds: number, each?: () => void) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) { clock.t += 1000 / 60; room.update(); each?.(); }
}
