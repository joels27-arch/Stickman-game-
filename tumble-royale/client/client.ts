// Glue between the network session, the 3D engine and the React UI.

import type { Rewards } from '../shared/protocol';
import { ROOM_CODE_RE } from '../shared/protocol';
import { audio } from './game/audio';
import { type Engine, hud } from './game/engine';
import { api, GUEST, getToken, loadProfile, profile, wsUrl } from './net/api';
import { localTransport, stopPractice } from './net/local';
import { GameSession, wsTransport } from './net/session';
import { Store } from './settings';

export interface RoomView {
  active: boolean;
  offline: boolean;
  code: string;
  you: number;
  phase: string;
  conn: string;
  error: string | null;
  rewards: Rewards | null;
  tick: number; // bumps on every lobby update so React re-renders
}

export const roomStore = new Store<RoomView>({ active: false, offline: false, code: '', you: -1, phase: 'lobby', conn: 'closed', error: null, rewards: null, tick: 0 });

const RESUME_KEY = 'tumble.resume.v1';

export class GameClient {
  session: GameSession | null = null;

  constructor(readonly engine: Engine) {}

  private makeSession(offline: boolean): GameSession {
    const p = profile.get().p;
    const s = new GameSession(
      offline ? () => localTransport() : (code) => wsTransport(wsUrl(code)),
      { name: p.name, token: offline ? undefined : getToken(), cos: p.equipped, guest: GUEST },
      {
        onRoom: () => {
          roomStore.set((r) => ({ ...r, phase: s.phase, code: s.code, you: s.you, tick: r.tick + 1 }));
          if (!offline && s.code) try { sessionStorage.setItem(RESUME_KEY, JSON.stringify({ code: s.code, secret: s.secret })); } catch { /* ignore */ }
        },
        onConnection: (c) => roomStore.set({ conn: c }),
        onError: (code, msg) => {
          roomStore.set({ error: msg });
          if (code === 'room_not_found' || code === 'room_full' || code === 'kicked' || code === 'replaced' || code === 'bad_version' || code === 'disconnected') {
            try { sessionStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
            this.close(false);
            roomStore.set({ error: msg });
          }
        },
        onLocalEvents: (ev) => this.engine.handleLocalEvents(ev),
        onRemoteEvents: (id, ev) => this.engine.handleRemoteEvents(id, ev),
        onQualified: (id, place) => this.engine.onQualified(id, place),
        onEliminated: (id, why) => this.engine.onEliminated(id, why),
        onRoundEnd: (m) => this.engine.onRoundEnd(m),
        onMatchEnd: (m) => { this.engine.onMatchEnd(m); },
        onRewards: (r) => { roomStore.set({ rewards: r }); audio.coin(); loadProfile(); },
        onEmote: () => {},
      },
    );
    return s;
  }

  private open(code: string, offline: boolean, resume?: string) {
    this.close(false);
    const s = this.makeSession(offline);
    this.session = s;
    this.engine.attach(s);
    roomStore.set({ active: true, offline, code, you: -1, phase: 'lobby', conn: 'connecting', error: null, rewards: null });
    s.connect(code, resume);
    audio.play('lobby');
  }

  async createRoom() {
    const { code } = await api.createRoom();
    this.open(code, false);
  }

  async joinRoom(input: string) {
    const code = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!ROOM_CODE_RE.test(code)) throw new Error('Room codes are 6 letters/numbers.');
    await api.roomInfo(code); // throws "Room not found" with a friendly message
    this.open(code, false);
  }

  async quickPlay() {
    const { code } = await api.matchmake();
    this.open(code, false);
  }

  practice() {
    stopPractice();
    this.open('PRACTC', true);
    const s = this.session!;
    const t = setInterval(() => {
      if (s.you >= 0 && s.isHost) {
        clearInterval(t);
        s.updateSettings({ fillBots: 12, mode: 'tournament' });
      }
    }, 50);
    setTimeout(() => clearInterval(t), 5000);
  }

  /** Reconnect to the room we were in before a page refresh. */
  tryResume(): boolean {
    try {
      const raw = sessionStorage.getItem(RESUME_KEY);
      if (!raw) return false;
      const { code, secret } = JSON.parse(raw);
      if (!ROOM_CODE_RE.test(code)) return false;
      this.open(code, false, secret);
      return true;
    } catch { return false; }
  }

  close(sendLeave = true) {
    if (this.session) {
      if (sendLeave) this.session.leave(); else { try { this.session.leave(); } catch { /* ignore */ } }
      this.session = null;
    }
    if (roomStore.get().offline) stopPractice();
    if (sendLeave) try { sessionStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
    roomStore.set({ active: false, offline: false, code: '', you: -1, phase: 'lobby', conn: 'closed', rewards: null });
    hud.set({ screen: 'none', banner: null, results: null, winner: null });
    this.engine.showMenu();
    audio.play('menu');
  }

  inviteLink(code: string) { return `${location.origin}${location.pathname}?room=${code}`; }
}
