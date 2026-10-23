// Practice mode: the real authoritative Room runs inside the page and the
// client talks to it through an in-memory transport. Same code path as online
// play (prediction, snapshots, round flow) — just no network and no rewards.

import { Room, type Conn } from '../../server/room';
import type { Transport } from './session';

let room: Room | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

export function localTransport(): Transport {
  if (!room || room.destroyed) {
    room = new Room('PRACTC', {
      now: () => performance.now(),
      randomHex: (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join(''),
    });
    if (timer) clearInterval(timer);
    timer = setInterval(() => room?.update(), 1000 / 120);
  }
  const r = room;
  let open = true;
  const t: Transport = {
    send(d) { if (open) queueMicrotask(() => r.message(conn, typeof d === 'string' ? d : d.slice())); },
    close() { if (!open) return; open = false; r.close(conn); setTimeout(() => t.onclose?.(1000, ''), 0); },
    onmessage: null, onclose: null, onopen: null,
  };
  const conn: Conn = {
    send(d) { if (open) { const copy = typeof d === 'string' ? d : d.slice(); queueMicrotask(() => t.onmessage?.(copy)); } },
    close() { if (open) { open = false; setTimeout(() => t.onclose?.(1000, ''), 0); } },
  };
  r.open(conn);
  setTimeout(() => t.onopen?.(), 0);
  return t;
}

export function stopPractice() {
  if (timer) clearInterval(timer);
  timer = null;
  room?.destroy();
  room = null;
}
