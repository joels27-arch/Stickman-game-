import { describe, expect, it } from 'vitest';
import { Btn, Mode } from '../shared/constants';
import { isFinalSize, planRound, projectedRounds, qualifyCount, rankRace, rankSurvival } from '../shared/match';
import { MAP_META } from '../shared/maps';
import { PState } from '../shared/player';
import { decodeInputs, decodeSnapshot, encodeInputs, encodePlayersBlock, encodeSnapshot } from '../shared/protocol';
import { ProfileService, MemoryKV } from '../server/profiles';
import { ITEMS, PRICES } from '../shared/cosmetics';
import { advance, FakeClock, join, makeRoom } from './helpers';

describe('tournament structure', () => {
  it('30 → 20 → 12 → 6 → 1', () => {
    expect(qualifyCount(30)).toBe(20);
    expect(qualifyCount(20)).toBe(12);
    expect(qualifyCount(12)).toBe(6);
    expect(isFinalSize(6)).toBe(true);
    expect(projectedRounds(30)).toBe(4);
  });
  it('adapts to small lobbies', () => {
    expect(projectedRounds(2)).toBe(1);   // direct final
    expect(projectedRounds(4)).toBe(1);   // direct final
    expect(projectedRounds(10)).toBe(2);  // 10 → 5 → final
    expect([3, 4]).toContain(projectedRounds(20));
    for (let n = 2; n <= 30; n++) {
      if (!isFinalSize(n)) { const q = qualifyCount(n); expect(q).toBeGreaterThanOrEqual(2); expect(q).toBeLessThan(n); }
    }
  });
  it('plans finals on final maps and early rounds on gentler maps', () => {
    const p = planRound(5, 3, [], MAP_META, 42);
    expect(p.final).toBe(true);
    expect(MAP_META.find((m) => m.id === p.map)!.finalOk).toBe(true);
    const first = planRound(30, 0, [], MAP_META, 42);
    expect(first.final).toBe(false);
    expect(first.qualify).toBe(20);
    expect(MAP_META.find((m) => m.id === first.map)!.roundOk).toBe(true);
  });
  it('breaks simultaneous finishes deterministically (sub-tick time, then seeded key)', () => {
    const r = rankRace([{ id: 1, finishTime: 100.5, progress: 0 }, { id: 2, finishTime: 100.25, progress: 0 }, { id: 3, finishTime: null, progress: 5 }, { id: 4, finishTime: 100.5, progress: 0 }], 7);
    expect(r[0].id).toBe(2);
    const again = rankRace([{ id: 4, finishTime: 100.5, progress: 0 }, { id: 1, finishTime: 100.5, progress: 0 }, { id: 2, finishTime: 100.25, progress: 0 }, { id: 3, finishTime: null, progress: 5 }], 7);
    expect(again.map((x) => x.id)).toEqual(r.map((x) => x.id));
    expect(r[3].id).toBe(3);
  });
  it('survival: last out ranks highest; same-tick ties go to the higher player', () => {
    const r = rankSurvival([{ id: 1, outTick: 500, outY: -3 }, { id: 2, outTick: 500, outY: 1 }, { id: 3, outTick: null, outY: 0 }, { id: 4, outTick: 300, outY: 0 }], 3);
    expect(r.map((x) => x.id)).toEqual([3, 2, 1, 4]);
  });
});

describe('room lobby', () => {
  it('first player is host; host migrates on leave; ready + settings + kick', () => {
    const clock = new FakeClock();
    const room = makeRoom(clock);
    const a = join(room, 'Alice'), b = join(room, 'Bob'), c = join(room, 'Cara');
    const ids = [a, b, c].map((x) => x.last('welcome')!.you);
    expect(room.hostId).toBe(ids[0]);
    room.message(b, JSON.stringify({ t: 'settings', s: { fillBots: 20 } })); // not host: ignored
    expect(room.settings.fillBots).toBe(0);
    room.message(a, JSON.stringify({ t: 'settings', s: { fillBots: 99, mode: 'single', map: 'nope' } }));
    expect(room.settings.fillBots).toBe(30);
    expect(room.settings.map).toBe('rainbow');
    room.message(b, JSON.stringify({ t: 'ready', on: true }));
    expect(c.last('room')!.players.find((p) => p.id === ids[1])!.ready).toBe(true);
    room.message(a, JSON.stringify({ t: 'kick', id: ids[2] }));
    expect(c.last('error')!.code).toBe('kicked');
    expect(room.players.has(ids[2])).toBe(false);
    room.message(a, JSON.stringify({ t: 'leave' }));
    expect(room.hostId).toBe(ids[1]);
  });

  it('rejects bad versions and garbage without crashing', () => {
    const clock = new FakeClock();
    const room = makeRoom(clock);
    const x = join(room, 'Old', { v: 1 });
    expect(x.last('error')!.code).toBe('bad_version');
    const y = join(room, 'Ok');
    for (const junk of ['{', 'null', '[]', '{"t":5}', '{"t":"settings","s":{"fillBots":"x"}}', '{"t":"kick","id":{}}', 'x'.repeat(5000)]) room.message(y, junk);
    room.message(y, new Uint8Array([1, 2, 3]));
    room.message(y, new Uint8Array([2, 255, 255, 255, 255, 200]));
    expect(room.players.size).toBe(1);
  });

  it('caps a room at 30 humans', () => {
    const clock = new FakeClock();
    const room = makeRoom(clock);
    const cs = Array.from({ length: 31 }, (_, i) => join(room, `P${i}`));
    expect(room.humanCount).toBe(30);
    expect(cs[30].last('error')!.code).toBe('room_full');
  });

  it('removes players who disconnect in the lobby after a grace period, keeps them if they resume', () => {
    const clock = new FakeClock();
    const room = makeRoom(clock);
    const a = join(room, 'A');
    const b = join(room, 'B');
    const secret = b.last('welcome')!.secret;
    room.close(b);
    advance(room, clock, 3);
    const b2 = join(room, 'B', { resume: secret });
    expect(b2.last('welcome')!.resumed).toBe(true);
    room.close(b2);
    advance(room, clock, 20, () => room.message(a, JSON.stringify({ t: 'ping', c: 0 })));
    expect(room.players.size).toBe(1);
  });
});

describe('match flow', () => {
  it('race qualification: finishing players qualify in order, timer eliminates the rest', () => {
    const clock = new FakeClock();
    const room = makeRoom(clock);
    const a = join(room, 'A'), b = join(room, 'B');
    room.message(a, JSON.stringify({ t: 'settings', s: { mode: 'single', map: 'rainbow' } }));
    room.message(a, JSON.stringify({ t: 'start' }));
    expect(room.phase).toBe('intro');
    advance(room, clock, 7.2, () => { room.message(a, JSON.stringify({ t: 'ping', c: 0 })); room.message(b, JSON.stringify({ t: 'ping', c: 0 })); });
    expect(room.phase).toBe('play');
    // Teleport both runners next to the finish, B slightly ahead → B wins.
    const ida = a.last('welcome')!.you, idb = b.last('welcome')!.you;
    const pa = room.players.get(ida)!.state, pb = room.players.get(idb)!.state;
    Object.assign(pa, { x: -3, y: 8.1, z: 196, vx: 0, vz: 7, mode: Mode.Normal });
    Object.assign(pb, { x: 3, y: 8.1, z: 197, vx: 0, vz: 7, mode: Mode.Normal });
    advance(room, clock, 3, () => {
      const run = encodeInputs(room.tick + 1, [{ mx: 0, mz: 1, btn: 0 }]);
      room.message(a, run); room.message(b, run);
    });
    const end = a.last('roundEnd')!;
    expect(end).toBeTruthy();
    expect(end.qualified[0]).toBe(idb);
    expect(a.last('matchEnd')).toBeUndefined();
    advance(room, clock, 7, () => room.message(a, JSON.stringify({ t: 'ping', c: 0 })));
    expect(a.last('matchEnd')!.winner).toBe(idb);
  });

  it('a full 30-player bot tournament runs to a single winner', () => {
    const clock = new FakeClock();
    const room = makeRoom(clock);
    const host = join(room, 'Host');
    room.message(host, JSON.stringify({ t: 'settings', s: { fillBots: 30, mode: 'tournament' } }));
    room.message(host, JSON.stringify({ t: 'start' }));
    let secs = 0;
    while (room.phase !== 'lobby' && secs < 1200) { advance(room, clock, 1, () => { if (room.tick % 60 === 0) room.message(host, JSON.stringify({ t: 'ping', c: 0 })); }); secs++; }
    const rounds = host.all('round').map((r) => r.r);
    expect(rounds[0].participants.length).toBe(30);
    expect(rounds[0].qualify).toBe(20);
    const ends = host.all('roundEnd');
    expect(ends.length).toBe(rounds.length);
    for (let i = 1; i < rounds.length; i++) expect(rounds[i].participants.length).toBe(ends[i - 1].qualified.length);
    expect(rounds[rounds.length - 1].final).toBe(true);
    const me = host.last('matchEnd')!;
    expect(me.winner).not.toBeNull();
    expect(new Set(me.ranking.map((r) => r.id)).size).toBe(me.ranking.length);
    expect(room.phase).toBe('lobby');
  }, 60000);
});

describe('protocol', () => {
  it('inputs round-trip and are sanitised', () => {
    const enc = encodeInputs(123456, [{ mx: 1, mz: 0, btn: Btn.Jump }, { mx: -0.5, mz: 0.5, btn: 7 }]);
    const d = decodeInputs(enc)!;
    expect(d.firstTick).toBe(123456);
    expect(d.inputs[0].mx).toBe(1);
    expect(d.inputs[1].btn).toBe(3);
    expect(decodeInputs(new Uint8Array([1, 0, 0, 0, 0, 40]))).toBeNull(); // too many
  });
  it('snapshots round-trip with full-precision own state', () => {
    const s = new PState(); s.x = 1.234567; s.vz = -3.5; s.mode = Mode.Dive;
    const block = encodePlayersBlock([{ id: 3, mode: 1, flags: 1, ev: 5, x: 10.01, y: -2.5, z: 300.33, yaw: 1, ground: 12 }]);
    const snap = decodeSnapshot(encodeSnapshot(999, 990, 3, s, block))!;
    expect(snap.tick).toBe(999); expect(snap.ack).toBe(990); expect(snap.slack).toBe(3);
    expect(snap.own!.x).toBe(1.234567); expect(snap.own!.mode).toBe(Mode.Dive);
    expect(snap.players[0].z).toBeCloseTo(300.33, 1); expect(snap.players[0].ground).toBe(12);
  });
});

describe('profiles (server-authoritative progression)', () => {
  const token = 'cd'.repeat(24);
  it('creates, rewards, levels up and validates purchases', async () => {
    const svc = new ProfileService(new MemoryKV(), () => 1_700_000_000_000);
    const g = await svc.api('get', { token, name: 'Tester' });
    expect(g.status).toBe(200);
    const p0 = g.body as any;
    expect(p0.coins).toBe(300);
    const r = await svc.grant(token, { rounds: 4, qualified: 4, final: true, won: true, place: 1, players: 30, dives: 10, bounces: 3, knocks: 1, finishes: 3, survived: 1 });
    expect(r!.coins).toBeGreaterThan(200);
    expect(r!.levelUp).toBe(true);
    const legendary = ITEMS.find((i) => i.rarity === 'legendary')!;
    const poor = await svc.api('buy', { token, item: legendary.id });
    expect(poor.status).toBe(400); // 2000 coins needed
    const rare = ITEMS.find((i) => i.rarity === 'rare' && !i.free)!;
    const ok = await svc.api('buy', { token, item: rare.id });
    expect(ok.status).toBe(200);
    expect((ok.body as any).owned).toContain(rare.id);
    expect((ok.body as any).coins).toBe(p0.coins + r!.coins - PRICES.rare);
    const twice = await svc.api('buy', { token, item: rare.id });
    expect(twice.status).toBe(400);
    // Equipping something you don't own falls back to defaults.
    const eq = await svc.api('equip', { token, cos: { color: legendary.cat === 'color' ? legendary.id : 'c_gold', hat: rare.cat === 'hat' ? rare.id : 'h_none' } });
    expect((eq.body as any).equipped.color).not.toBe('c_gold');
    expect((await svc.api('get', { token: 'not-a-token' })).status).toBe(400);
  });
  it('serialises concurrent grants (no lost updates)', async () => {
    const svc = new ProfileService(new MemoryKV(), () => 1_700_000_000_000);
    const m = { rounds: 1, qualified: 0, final: false, won: false, place: 20, players: 30, dives: 0, bounces: 0, knocks: 0, finishes: 0, survived: 0 };
    const rs = await Promise.all(Array.from({ length: 10 }, () => svc.grant(token, m)));
    const total = rs.reduce((a, r) => a + r!.coins, 0);
    const p = (await svc.api('get', { token })).body as any;
    expect(p.coins).toBe(300 + total);
    expect(p.stats.matches).toBe(10);
  });
});
