import { useCallback, useEffect, useRef, useState } from 'react';
import { ROOM_CODE_RE } from '../../shared/protocol';
import { type GameClient, roomStore } from '../client';
import { audio } from '../game/audio';
import { hud } from '../game/engine';
import { api, loadProfile, profile } from '../net/api';
import { Avatar, Btn, Coins, Modal, useStore } from './common';
import { Hud } from './Hud';
import { Lobby } from './Lobby';
import { Locker } from './Locker';
import { PauseModal, ProfileModal, SettingsModal } from './Settings';

type Screen = 'menu' | 'locker' | 'shop';
type Overlay = null | 'party' | 'settings' | 'profile' | 'pause';

export function App({ client }: { client: GameClient }) {
  const room = useStore(roomStore);
  const h = useStore(hud);
  const [screen, setScreen] = useState<Screen>('menu');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toastMsg, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((m: string) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2600); }, []);
  const inGame = room.active && room.phase !== 'lobby';

  useEffect(() => { client.engine.input.onPause = () => { if (roomStore.get().active && roomStore.get().phase !== 'lobby') setOverlay((o) => (o === 'pause' ? null : 'pause')); }; }, [client]);
  useEffect(() => { if (room.error) { toast(room.error); roomStore.set({ error: null }); } }, [room.error, toast]);
  useEffect(() => { if (inGame && overlay === 'party') setOverlay(null); }, [inGame, overlay]);

  // Deep link: ?room=CODE opens the join dialog straight away.
  const [prefill, setPrefill] = useState('');
  useEffect(() => {
    const code = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
    if (ROOM_CODE_RE.test(code) && !client.tryResume()) { setPrefill(code); setOverlay('party'); }
    else if (!code) client.tryResume();
  }, [client]);

  let content: React.ReactNode;
  if (room.active && room.phase === 'lobby') content = <Lobby client={client} toast={toast} />;
  else if (inGame) content = <Hud client={client} onPause={() => setOverlay('pause')} />;
  else if (screen === 'locker' || screen === 'shop') content = <Locker engine={client.engine} shop={screen === 'shop'} onClose={() => setScreen('menu')} />;
  else content = <Menu client={client} open={setOverlay} go={setScreen} toast={toast} />;

  return (
    <>
      {content}
      {room.active && (room.conn === 'reconnecting' || room.conn === 'connecting') && (
        <div className="conn-overlay fade-in"><div><div className="spinner" /><div className="title" style={{ fontSize: 'calc(var(--u)*1.8)' }}>{room.conn === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}</div>
          <div style={{ marginTop: '0.8em' }}><Btn className="white small" onClick={() => client.close()}>Cancel</Btn></div></div></div>
      )}
      {overlay === 'party' && <PartyModal client={client} prefill={prefill} onClose={() => setOverlay(null)} />}
      {overlay === 'settings' && <SettingsModal onClose={() => setOverlay(inGame ? 'pause' : null)} />}
      {overlay === 'profile' && <ProfileModal onClose={() => setOverlay(null)} />}
      {overlay === 'pause' && inGame && <PauseModal onResume={() => setOverlay(null)} onSettings={() => setOverlay('settings')} onLeave={() => { setOverlay(null); client.close(); }} />}
      {toastMsg && <div className="toast">{toastMsg}</div>}
      <div className="rotate"><div><div className="phone" /><div className="title" style={{ fontSize: 24 }}>Rotate your phone</div><div style={{ fontWeight: 800, marginTop: 8 }}>Tumble Royale plays in landscape.</div></div></div>
      {void h}
    </>
  );
}

function Menu({ client, open, go, toast }: { client: GameClient; open: (o: Overlay) => void; go: (s: Screen) => void; toast: (m: string) => void }) {
  const { p, online, loading } = useStore(profile);
  const [busy, setBusy] = useState(false);
  useEffect(() => { client.engine.setLineup([{ cos: p.equipped, name: p.name }]); }, [p.equipped, p.name, client.engine]);
  useEffect(() => { client.engine.setShowcaseOffset(window.innerWidth > 700 ? 0.9 : 0.8); }, [client.engine]);
  const run = async (f: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await f(); } catch (e) { toast((e as Error).message || 'Could not reach the game server.'); } finally { setBusy(false); }
  };
  return (
    <div className="screen fade-in">
      <div className="topbar">
        <div className="profile-chip" onClick={() => { audio.unlock(); audio.click(); open('profile'); }}>
          <Avatar cos={p.equipped} name={p.name} />
          <div>
            <div style={{ fontWeight: 800 }}>{p.name}</div>
            <div className="row" style={{ gap: '0.4em' }}><span className="lvl">Lv {p.level}</span><div className="xpbar"><i style={{ width: `${Math.min(100, (p.xp / p.xpNext) * 100)}%` }} /></div></div>
          </div>
        </div>
        <div className="grow" />
        <Coins n={p.coins} />
        <Btn className="white small icon" onClick={() => open('settings')} title="Settings">⚙</Btn>
      </div>
      <div className="menu-main pass">
        <div className="pass" style={{ alignSelf: 'start', paddingTop: 'var(--u)' }}>
          <div className="logo">TUMBLE<span>ROYALE</span></div>
        </div>
        <div className="menu-right">
          <Btn className="big" onClick={() => run(() => client.quickPlay())} disabled={busy || !online}>PLAY<span className="sub">{online ? 'Quick match with players online' : 'Server offline'}</span></Btn>
          <Btn className="pink big" onClick={() => open('party')} disabled={!online}>PARTY<span className="sub">Private room with friends</span></Btn>
          <Btn className="violet" onClick={() => client.practice()}>Practice vs bots<span className="sub">Offline · no rewards</span></Btn>
        </div>
      </div>
      <div className="menu-bottom">
        <Btn className="white menu-tile" onClick={() => go('locker')}><span className="ico">👕</span>Locker</Btn>
        <Btn className="white menu-tile" onClick={() => go('shop')}><span className="ico">🛒</span>Shop</Btn>
        <Btn className="white menu-tile" onClick={() => open('profile')}><span className="ico">📊</span>Stats</Btn>
        <div className="grow" />
        {p.daily.length > 0 && (
          <div className="panel dark challenges">
            <h3>Daily challenges</h3>
            {p.daily.map((c) => (
              <div key={c.id} className={'ch' + (c.done ? ' done' : '')}>
                <span style={{ fontWeight: 800 }}>{c.done ? '✔ ' : ''}{c.text}</span>
                <span className="row" style={{ gap: '0.25em', fontFamily: 'var(--title)' }}><span className="coin" style={{ fontSize: '0.8em' }} />{c.coins}</span>
                <div className="bar"><i style={{ width: `${(Math.min(c.goal, c.progress) / c.goal) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        )}
        <div className="server-status">{loading ? 'Connecting…' : online ? <><span className="dot on" />Online</> : <><span className="dot off" />Offline <button className="btn tiny white" onClick={() => loadProfile()}>Retry</button></>}</div>
      </div>
    </div>
  );
}

function PartyModal({ client, prefill, onClose }: { client: GameClient; prefill: string; onClose: () => void }) {
  const [code, setCode] = useState(prefill);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rooms, setRooms] = useState<{ code: string; players: number; max: number; phase: string; startsIn: number | null }[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => api.publicRooms().then((r) => alive && setRooms(r.rooms)).catch(() => {});
    load();
    const t = setInterval(load, 3000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const go = async (f: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await f(); onClose(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal onClose={onClose}>
      <div className="row"><h2 className="grow" style={{ margin: 0 }}>Party</h2><Btn className="white tiny" onClick={onClose}>✕</Btn></div>
      <div className="col" style={{ marginTop: '0.6em' }}>
        <Btn className="green" onClick={() => go(() => client.createRoom())} disabled={busy}>Create a room<span className="sub">Get a code to share with friends</span></Btn>
        <div style={{ fontWeight: 800, textAlign: 'center' }} className="muted">— or join with a code —</div>
        <div className="code-input"><input value={code} maxLength={6} placeholder="ABC123" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) go(() => client.joinRoom(code)); }} /></div>
        <Btn className="blue" onClick={() => go(() => client.joinRoom(code))} disabled={busy || code.length !== 6}>Join room</Btn>
        {err && <div className="error">{err}</div>}
        {rooms.length > 0 && (
          <>
            <div style={{ fontWeight: 800 }} className="muted">Public matches</div>
            <div className="room-list scroll">
              {rooms.map((r) => (
                <div key={r.code} className="room-item">
                  <span className="grow">{r.players}/{r.max} players · {r.phase === 'lobby' ? (r.startsIn !== null ? `starts in ${r.startsIn}s` : 'waiting') : 'in progress'}</span>
                  <Btn className="tiny green" onClick={() => go(() => client.joinRoom(r.code))} disabled={busy}>Join</Btn>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}


