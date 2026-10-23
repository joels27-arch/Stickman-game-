// Client game session: connection, clock sync, client-side prediction with
// server reconciliation, and snapshot interpolation for remote players.
// Platform-independent (uses only the standard WebSocket API), so the same code
// drives the browser game and the headless multiplayer tests.

import { DT, Ev, INPUT_SEND_EVERY, INTERP_DELAY_TICKS, Mode, PROTOCOL_VERSION, TICK_RATE } from '../../shared/constants';
import type { Cosmetics } from '../../shared/cosmetics';
import { getMap } from '../../shared/maps';
import { lerp, lerpAngle, m3, m3Apply, m3ApplyT, v3 } from '../../shared/math';
import { copyState, type Input, NO_INPUT, PState, quantizeInput, stepPlayer } from '../../shared/player';
import {
  BIN_SNAPSHOT, decodeSnapshot, encodeInputs, type LobbyPlayer, type Phase, type RankEntry, type Rewards,
  type RoomSettings, type RoundInfo, type ServerMsg, type SnapPlayer,
} from '../../shared/protocol';
import { World } from '../../shared/world';

export interface Transport {
  send(data: string | Uint8Array): void;
  close(): void;
  onmessage: ((data: string | Uint8Array) => void) | null;
  onclose: ((code: number, reason: string) => void) | null;
  onopen: (() => void) | null;
}

export function wsTransport(url: string): Transport {
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  const t: Transport = {
    send(d) { if (ws.readyState === 1) ws.send(d); },
    close() { try { ws.close(1000); } catch { /* ignore */ } },
    onmessage: null, onclose: null, onopen: null,
  };
  ws.onopen = () => t.onopen?.();
  ws.onmessage = (e) => t.onmessage?.(typeof e.data === 'string' ? e.data : new Uint8Array(e.data as ArrayBuffer));
  ws.onclose = (e) => t.onclose?.(e.code, e.reason);
  return t;
}

export interface RemoteSample { tick: number; x: number; y: number; z: number; yaw: number; mode: number; flags: number; ground: number; ev: number }

export class RemoteTrack {
  samples: RemoteSample[] = [];
  lastSeenTick = 0;
  /** Interpolated render state. */
  x = 0; y = 0; z = 0; yaw = 0; mode = 0; grounded = false; speed = 0; vy = 0;
  visible = false;
  private px = 0; private py = 0; private pz = 0;
  push(s: RemoteSample) {
    const last = this.samples[this.samples.length - 1];
    if (last && s.tick <= last.tick) return;
    this.samples.push(s);
    if (this.samples.length > 40) this.samples.shift();
    this.lastSeenTick = s.tick;
  }
}

export interface SessionEvents {
  onRoom?(): void;
  onRound?(r: RoundInfo): void;
  onQualified?(id: number, place: number): void;
  onEliminated?(id: number, why: string): void;
  onRoundEnd?(m: Extract<ServerMsg, { t: 'roundEnd' }>): void;
  onMatchEnd?(m: Extract<ServerMsg, { t: 'matchEnd' }>): void;
  onRewards?(r: Rewards): void;
  onLocalEvents?(ev: number): void;
  onRemoteEvents?(id: number, ev: number): void;
  onEmote?(id: number, e: number): void;
  onError?(code: string, msg: string): void;
  onConnection?(state: ConnState): void;
  onNotice?(msg: string): void;
}

export type ConnState = 'connecting' | 'connected' | 'reconnecting' | 'closed';

const TARGET_SLACK = 3;
const P0 = v3(), L0 = v3(), L1 = v3();
const R0 = m3();

export class GameSession {
  // identity / lobby
  you = -1;
  secret = '';
  code = '';
  host = -1;
  phase: Phase = 'lobby';
  settings: RoomSettings | null = null;
  players: LobbyPlayer[] = [];
  startsIn: number | undefined;
  state: ConnState = 'connecting';
  // round
  round: RoundInfo | null = null;
  world: World | null = null;
  ranking: RankEntry[] | null = null;
  lastRoundEnd: Extract<ServerMsg, { t: 'roundEnd' }> | null = null;
  lastMatchEnd: Extract<ServerMsg, { t: 'matchEnd' }> | null = null;
  qualifiedIds = new Set<number>();
  eliminatedIds = new Set<number>();
  // timing
  rtt = 100;
  private serverBase = 0;        // server tick estimate at serverBaseTime
  private serverBaseTime = 0;
  private clientTick = 0;        // fractional predicted tick
  private lastFrame = 0;
  private synced = false;
  slackAvg = TARGET_SLACK;
  // prediction
  simTick = 0;                   // next tick to simulate
  pred = new PState();
  prevPred = new PState();
  private history = new Map<number, Input>();
  private outBuf: Input[] = [];
  private outFirst = 0;
  /** Visual-only correction offset after reconciliation, decays to zero. */
  corr = v3();
  corrections = 0;
  /** Ticks simulated in the last update() (0 on frames between ticks, e.g. 120 Hz screens). */
  lastSteps = 0;
  bigCorrections = 0;
  lastCorrection = 0;
  // remote
  remotes = new Map<number, RemoteTrack>();
  private pendingRemoteEv: { tick: number; id: number; ev: number }[] = [];
  // connection
  private transport: Transport | null = null;
  private lastMsgAt = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private closedByUs = false;
  private fatal = false;
  bytesIn = 0;

  constructor(
    private makeTransport: (code: string) => Transport,
    private hello: { name: string; token?: string; cos?: Cosmetics; guest?: boolean },
    public ev: SessionEvents = {},
    private now: () => number = () => performance.now(),
  ) {}

  connect(code: string, resume?: string) {
    this.code = code;
    if (resume) this.secret = resume;
    this.closedByUs = false; this.fatal = false;
    this.open();
  }

  private open() {
    this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
    const t = this.makeTransport(this.code);
    this.transport = t;
    t.onopen = () => {
      this.lastMsgAt = this.now();
      this.sendJson({ t: 'hello', v: PROTOCOL_VERSION, name: this.hello.name, token: this.hello.token, cos: this.hello.cos, guest: this.hello.guest, resume: this.secret || undefined });
      this.sendJson({ t: 'ping', c: this.now() });
    };
    t.onmessage = (d) => this.onMessage(d);
    t.onclose = () => this.onClosed(t);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => this.heartbeat(), 1000);
  }

  private heartbeat() {
    if (!this.transport) return;
    if (this.state === 'connected' && this.now() - this.lastMsgAt > 6000) {
      // Silent socket: force a reconnect.
      const t = this.transport; this.transport = null; t.onclose = null; t.close(); this.onClosed(t);
      return;
    }
    this.sendJson({ t: 'ping', c: this.now() });
  }

  private onClosed(t: Transport) {
    if (this.transport && this.transport !== t) return;
    this.transport = null;
    if (this.closedByUs || this.fatal) { this.setState('closed'); if (this.pingTimer) clearInterval(this.pingTimer); return; }
    if (this.reconnectAttempts >= 8) { this.setState('closed'); if (this.pingTimer) clearInterval(this.pingTimer); this.ev.onError?.('disconnected', 'Lost connection to the server.'); return; }
    const delay = Math.min(8000, 400 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts++;
    this.setState('reconnecting');
    setTimeout(() => { if (!this.closedByUs) this.open(); }, delay);
  }

  private setState(s: ConnState) { if (this.state !== s) { this.state = s; this.ev.onConnection?.(s); } }

  leave() {
    this.closedByUs = true;
    this.sendJson({ t: 'leave' });
    setTimeout(() => this.transport?.close(), 50);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.setState('closed');
  }

  /** Test hook: drop the socket as if the network failed (the session will reconnect). */
  debugDrop() { const t = this.transport; if (t) { t.close(); } }

  sendJson(m: object) { this.transport?.send(JSON.stringify(m)); }
  setReady(on: boolean) { this.sendJson({ t: 'ready', on }); }
  start() { this.sendJson({ t: 'start' }); }
  updateSettings(s: Partial<RoomSettings>) { this.sendJson({ t: 'settings', s }); }
  emote(e: number) { this.sendJson({ t: 'emote', e }); }
  kick(id: number) { this.sendJson({ t: 'kick', id }); }

  get me(): LobbyPlayer | undefined { return this.players.find((p) => p.id === this.you); }
  get isHost() { return this.host === this.you; }
  player(id: number) { return this.players.find((p) => p.id === id); }

  // ------------------------------------------------------------ messages

  private onMessage(d: string | Uint8Array) {
    this.lastMsgAt = this.now();
    this.bytesIn += typeof d === 'string' ? d.length : d.byteLength;
    if (typeof d !== 'string') {
      if (d[0] === BIN_SNAPSHOT) this.onSnapshot(d);
      return;
    }
    let m: ServerMsg;
    try { m = JSON.parse(d); } catch { return; }
    switch (m.t) {
      case 'welcome':
        this.you = m.you; this.secret = m.secret; this.code = m.code;
        this.reconnectAttempts = 0;
        this.setServerTick(m.tick, true);
        this.setState('connected');
        break;
      case 'room':
        this.host = m.host; this.phase = m.phase; this.settings = m.settings; this.players = m.players; this.startsIn = m.startsIn;
        if (m.phase === 'lobby') { this.round = null; this.world = null; this.remotes.clear(); }
        this.ev.onRoom?.();
        break;
      case 'round': this.beginRound(m.r); break;
      case 'tile': this.world?.setTriggered(m.id, m.tick ?? undefined); break;
      case 'qual': this.qualifiedIds.add(m.id); this.ev.onQualified?.(m.id, m.place); break;
      case 'elim': this.eliminatedIds.add(m.id); this.ev.onEliminated?.(m.id, m.why); break;
      case 'roundEnd': this.lastRoundEnd = m; this.ranking = m.ranking; this.ev.onRoundEnd?.(m); break;
      case 'matchEnd': this.lastMatchEnd = m; this.ev.onMatchEnd?.(m); break;
      case 'rewards': this.ev.onRewards?.(m.r); break;
      case 'pong': {
        const rtt = Math.max(1, this.now() - m.c);
        this.rtt = this.rtt * 0.8 + rtt * 0.2;
        this.setServerTick(m.s + (rtt / 2) * (TICK_RATE / 1000), false);
        break;
      }
      case 'emote': this.ev.onEmote?.(m.id, m.e); break;
      case 'notice': this.ev.onNotice?.(m.msg); break;
      case 'error':
        if (m.code === 'replaced' || m.code === 'kicked' || m.code === 'bad_version' || m.code === 'room_not_found' || m.code === 'room_full') this.fatal = true;
        this.ev.onError?.(m.code, m.msg);
        break;
    }
  }

  private mySlot = 0;

  private beginRound(r: RoundInfo) {
    this.round = r;
    const k = r.participants.indexOf(this.you);
    this.mySlot = k >= 0 ? r.slots[k] ?? 0 : 0;
    this.world = new World(getMap(r.map));
    for (const [id, tick] of r.triggered) this.world.setTriggered(id, tick);
    this.qualifiedIds.clear(); this.eliminatedIds.clear();
    this.lastRoundEnd = null;
    this.remotes.clear();
    this.history.clear();
    this.outBuf = [];
    this.pendingRemoteEv = [];
    this.pred = new PState(); this.pred.mode = Mode.Out;
    this.prevPred = copyState(new PState(), this.pred);
    this.synced = false;
    this.ev.onRound?.(r);
  }

  /** Smoothly track the server clock. */
  private setServerTick(estimate: number, hard: boolean) {
    const now = this.now();
    const cur = this.serverTickAt(now);
    if (hard || !this.serverBaseTime || Math.abs(estimate - cur) > 8) { this.serverBase = estimate; this.serverBaseTime = now; return; }
    this.serverBase = cur + (estimate - cur) * 0.1;
    this.serverBaseTime = now;
  }
  serverTickAt(now: number) { return this.serverBase + ((now - this.serverBaseTime) * TICK_RATE) / 1000; }

  private onSnapshot(data: Uint8Array) {
    const snap = decodeSnapshot(data);
    if (!snap || !this.round || !this.world) return;
    this.setServerTick(snap.tick + (this.rtt / 2) * (TICK_RATE / 1000), false);
    // Remote players.
    const seen = new Set<number>();
    for (const p of snap.players) {
      seen.add(p.id);
      if (p.id === this.you) continue;
      let tr = this.remotes.get(p.id);
      if (!tr) { tr = new RemoteTrack(); this.remotes.set(p.id, tr); }
      tr.push({ tick: snap.tick, x: p.x, y: p.y, z: p.z, yaw: p.yaw, mode: p.mode, flags: p.flags, ground: p.ground, ev: p.ev });
      if (p.ev) this.pendingRemoteEv.push({ tick: snap.tick, id: p.id, ev: p.ev });
    }
    for (const [id, tr] of this.remotes) if (!seen.has(id)) tr.push({ ...lastSample(tr), tick: snap.tick, mode: Mode.Out });
    // Own state → reconcile.
    if (snap.own) {
      this.slackAvg = this.slackAvg * 0.85 + snap.slack * 0.15;
      this.reconcile(snap.own, snap.ack);
    }
  }

  private reconcile(server: PState, ack: number) {
    if (!this.synced) {
      // First authoritative state of the round: adopt it and start predicting ahead of the server.
      copyState(this.pred, server); copyState(this.prevPred, server);
      this.simTick = ack + 1;
      this.clientTick = this.serverTickAt(this.now()) + (this.rtt / 2) * (TICK_RATE / 1000) + TARGET_SLACK + 1;
      // Fast-forward prediction to the client tick using "no input" (we have no history yet).
      this.synced = true;
      return;
    }
    if (ack >= this.simTick) { // server is ahead of our prediction (we stalled): jump forward
      copyState(this.pred, server); copyState(this.prevPred, server);
      this.simTick = ack + 1;
      this.clientTick = Math.max(this.clientTick, this.simTick + TARGET_SLACK);
      return;
    }
    const ox = this.pred.x, oy = this.pred.y, oz = this.pred.z;
    const s = copyState(new PState(), server);
    const prev = copyState(new PState(), server);
    for (let t = ack + 1; t < this.simTick; t++) {
      copyState(prev, s);
      stepPlayer(s, this.history.get(t) ?? NO_INPUT, this.ctx(t));
    }
    const err = Math.hypot(s.x - ox, s.y - oy, s.z - oz);
    if (err > 0.01) {
      this.corrections++;
      if (err > 0.3) this.bigCorrections++;
      this.lastCorrection = err;
      if (err < 4) { this.corr.x += ox - s.x; this.corr.y += oy - s.y; this.corr.z += oz - s.z; }
      else { this.corr.x = this.corr.y = this.corr.z = 0; } // teleport (respawn etc.)
    }
    copyState(this.pred, s);
    copyState(this.prevPred, prev);
    for (const t of this.history.keys()) if (t <= ack) this.history.delete(t);
  }

  private ctx(tick: number) {
    const r = this.round!;
    return { world: this.world!, tick: tick - r.goTick, slot: this.mySlot, canMove: tick >= r.goTick, respawn: this.world!.map.mode === 'race' };
  }

  // ------------------------------------------------------------ per frame

  /**
   * Advance prediction to the current time. `sample` returns the player's input
   * for this frame (already camera-relative, in world space).
   */
  update(sample: () => Input) {
    const now = this.now();
    const dtMs = this.lastFrame ? Math.min(250, now - this.lastFrame) : 16;
    this.lastFrame = now;
    // Decay the reconciliation correction (~100 ms).
    const k = Math.exp(-dtMs / 90);
    this.corr.x *= k; this.corr.y *= k; this.corr.z *= k;
    this.lastSteps = 0;
    if (!this.round || !this.world || !this.synced) return;
    // Advance the predicted clock, nudged so our inputs arrive ~TARGET_SLACK ticks early.
    const err = this.slackAvg - TARGET_SLACK;
    const scale = 1 - Math.max(-0.08, Math.min(0.08, err * 0.015));
    this.clientTick += (dtMs * TICK_RATE / 1000) * scale;
    const est = this.serverTickAt(now);
    const ideal = est + (this.rtt / 2) * (TICK_RATE / 1000) + TARGET_SLACK + 1;
    if (Math.abs(this.clientTick - ideal) > 20) this.clientTick = ideal;
    let steps = 0;
    const inp = sample();
    while (this.simTick < Math.floor(this.clientTick) && steps < 40) {
      const q = quantizeInput(inp.mx, inp.mz, inp.btn);
      const t = this.simTick;
      this.history.set(t, q);
      copyState(this.prevPred, this.pred);
      const ev = stepPlayer(this.pred, q, this.ctx(t));
      if (ev) this.ev.onLocalEvents?.(ev);
      if (this.outBuf.length === 0) this.outFirst = t;
      this.outBuf.push(q);
      if (this.outBuf.length >= INPUT_SEND_EVERY) this.flushInputs();
      this.simTick++;
      steps++;
    }
    if (steps === 40) this.clientTick = this.simTick; // long hitch: don't spiral
    this.lastSteps = steps;
    if (this.history.size > 600) for (const t of this.history.keys()) if (t < this.simTick - 600) this.history.delete(t);
    this.updateRemotes(now);
  }

  private flushInputs() {
    if (!this.outBuf.length) return;
    this.transport?.send(encodeInputs(this.outFirst, this.outBuf));
    this.outBuf = [];
  }

  /** Fraction between prevPred and pred for rendering. */
  get alpha() { return Math.max(0, Math.min(1, this.clientTick - (this.simTick - 1))); }
  /** Round time (seconds since GO) the local world is rendered at. */
  get renderTime() { return this.round ? (this.simTick - 1 + this.alpha - this.round.goTick) * DT : 0; }
  get renderTickRel() { return this.round ? this.simTick - 1 + this.alpha - this.round.goTick : 0; }
  get serverTickNow() { return this.serverTickAt(this.now()); }

  private updateRemotes(now: number) {
    const rt = this.serverTickAt(now) - INTERP_DELAY_TICKS;
    const world = this.world!, goTick = this.round!.goTick;
    const platTick = this.renderTickRel; // platforms are drawn at the predicted time
    for (const tr of this.remotes.values()) {
      const ss = tr.samples;
      if (!ss.length) { tr.visible = false; continue; }
      let i = ss.length - 1;
      while (i > 0 && ss[i - 1].tick > rt) i--;
      const b = ss[i], a = ss[Math.max(0, i - 1)];
      let f = b.tick === a.tick ? 1 : (rt - a.tick) / (b.tick - a.tick);
      f = Math.max(0, Math.min(1.25, f)); // small extrapolation if snapshots are late
      const pick = f < 0.5 ? a : b;
      tr.mode = pick.mode;
      tr.visible = pick.mode !== Mode.Out;
      tr.grounded = (pick.flags & 1) !== 0;
      let x: number, y: number, z: number;
      if (a.ground >= 0 && a.ground === b.ground && world.bodies[a.ground]?.moving) {
        // Interpolate in the platform's frame so riders stay glued to moving platforms.
        const body = world.bodies[a.ground];
        world.pose(body, a.tick - goTick, P0, R0); L0.x = a.x - P0.x; L0.y = a.y - P0.y; L0.z = a.z - P0.z; m3ApplyT(L0, R0, L0);
        world.pose(body, b.tick - goTick, P0, R0); L1.x = b.x - P0.x; L1.y = b.y - P0.y; L1.z = b.z - P0.z; m3ApplyT(L1, R0, L1);
        L0.x = lerp(L0.x, L1.x, f); L0.y = lerp(L0.y, L1.y, f); L0.z = lerp(L0.z, L1.z, f);
        world.pose(body, platTick, P0, R0);
        m3Apply(L1, R0, L0);
        x = P0.x + L1.x; y = P0.y + L1.y; z = P0.z + L1.z;
      } else {
        x = lerp(a.x, b.x, f); y = lerp(a.y, b.y, f); z = lerp(a.z, b.z, f);
      }
      const jump = Math.hypot(x - tr.x, z - tr.z);
      const dt = 1 / 60;
      tr.speed = tr.speed * 0.8 + (jump > 3 ? 0 : (Math.hypot(b.x - a.x, b.z - a.z) / Math.max(1, b.tick - a.tick)) * TICK_RATE) * 0.2;
      tr.vy = (b.y - a.y) / Math.max(1, b.tick - a.tick) * TICK_RATE;
      tr.x = x; tr.y = y; tr.z = z;
      tr.yaw = lerpAngle(a.yaw, b.yaw, Math.min(1, f));
      void dt;
    }
    // Fire remote sound/fx events when their snapshot time is actually rendered.
    while (this.pendingRemoteEv.length && this.pendingRemoteEv[0].tick <= rt) {
      const e = this.pendingRemoteEv.shift()!;
      this.ev.onRemoteEvents?.(e.id, e.ev);
    }
  }

  /** Debug/telemetry. */
  netStats() {
    return { rtt: Math.round(this.rtt), slack: +this.slackAvg.toFixed(1), corrections: this.corrections, lastCorrection: +this.lastCorrection.toFixed(3), kbIn: Math.round(this.bytesIn / 1024) };
  }
}

function lastSample(tr: RemoteTrack): RemoteSample {
  return tr.samples[tr.samples.length - 1];
}

export type { SnapPlayer, Input };
export const LOCAL_EVENTS = Ev;
