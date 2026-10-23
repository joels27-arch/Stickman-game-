import { useEffect, useState } from 'react';
import { getMap, MAP_IDS } from '../../shared/maps';
import { projectedRounds } from '../../shared/match';
import type { GameClient } from '../client';
import { roomStore } from '../client';
import { Avatar, Btn, Modal, useStore } from './common';

const MAP_COLORS: Record<string, string> = { rainbow: '#ff5aa8', spinning: '#9a6bff', skyfall: '#36a8ff', lava: '#ff7a2f', ice: '#4fc9ff', arena: '#ffb300' };

export function Lobby({ client, toast }: { client: GameClient; toast: (m: string) => void }) {
  const room = useStore(roomStore);
  const s = client.session;
  const [confirmStart, setConfirmStart] = useState(false);
  useEffect(() => {
    if (!s) return;
    client.engine.setLineup(s.players.filter((p) => !p.bot).sort((a, b) => (a.id === s.you ? -1 : b.id === s.you ? 1 : 0)).map((p) => ({ cos: p.cos, name: p.name })));
  }, [room.tick, s, client.engine]);
  useEffect(() => { client.engine.setShowcaseOffset(window.innerWidth > 700 ? 1.6 : 1.2); return () => client.engine.setShowcaseOffset(0); }, [client.engine]);
  if (!s) return null;
  const st = s.settings;
  const humans = s.players.filter((p) => !p.bot);
  const notReady = humans.filter((p) => p.id !== s.host && !p.ready && p.connected).length;
  const me = s.me;
  const total = Math.max(humans.length, st?.fillBots ?? 0);
  const link = client.inviteLink(room.code);
  const share = async () => {
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'Tumble Royale', text: `Join my Tumble Royale party! Code ${room.code}`, url: link });
      else { await navigator.clipboard.writeText(link); toast('Invite link copied!'); }
    } catch { /* user cancelled */ }
  };
  const start = () => { if (notReady > 0) setConfirmStart(true); else s.start(); };

  return (
    <div className="screen fade-in">
      <div className="topbar">
        <Btn className="white small" onClick={() => client.close()}>◀ Leave</Btn>
        <div className="grow" />
        {room.offline ? <span className="pill">Practice · offline</span> : (
          <div className="panel code-card">
            <div><div className="lbl">{st?.isPublic ? 'PUBLIC MATCH' : 'ROOM CODE'}</div><div className="code">{room.code}</div></div>
            {!st?.isPublic && <Btn className="blue small" onClick={share}>Invite</Btn>}
          </div>
        )}
      </div>
      <div className="lobby" style={{ marginTop: 'var(--u)' }}>
        <div className="lobby-left pass">
          <div />
          <div className="pass" style={{ paddingBottom: 'var(--u)' }}>
            {st?.isPublic && room.phase === 'lobby' && (
              <div className="panel dark" style={{ display: 'inline-block', fontFamily: 'var(--title)', fontSize: 'calc(var(--u)*1.6)' }}>
                {s.startsIn !== undefined ? `Match starts in ${s.startsIn}s` : 'Waiting for players…'}
              </div>
            )}
          </div>
        </div>
        <div className="lobby-right">
          <div className="panel players">
            <div className="row" style={{ marginBottom: '0.5em' }}>
              <h2 style={{ margin: 0 }} className="grow">Players {humans.length}/30</h2>
              {room.phase !== 'lobby' && <span className="tag">MATCH IN PROGRESS</span>}
            </div>
            <div className="plist scroll">
              {humans.map((p) => (
                <div key={p.id} className={'prow' + (p.id === s.you ? ' me' : '')}>
                  <Avatar cos={p.cos} name={p.name} small />
                  <span className={'nm' + (p.connected ? '' : ' off')}>{p.name}</span>
                  <span className="tag">Lv {p.level}</span>
                  {p.id === s.host && <span className="tag host">HOST</span>}
                  {p.id !== s.host && (p.ready ? <span className="tag ready">READY</span> : <span className="tag">…</span>)}
                  {!p.connected && <span className="tag">OFFLINE</span>}
                  {s.isHost && p.id !== s.you && !st?.isPublic && <button className="btn tiny red" onClick={() => s.kick(p.id)} aria-label="Kick">✕</button>}
                </div>
              ))}
              {(st?.fillBots ?? 0) > humans.length && <div className="prow muted"><span className="nm">+ {(st!.fillBots) - humans.length} bots will fill the match</span><span className="tag bot">BOT</span></div>}
            </div>
          </div>
          {st && !st.isPublic && (
            <div className="panel col" style={{ gap: '0.55em' }}>
              {s.isHost ? (
                <>
                  <div className="seg">
                    <button className={st.mode === 'tournament' ? 'on' : ''} onClick={() => s.updateSettings({ mode: 'tournament' })}>Tournament</button>
                    <button className={st.mode === 'single' ? 'on' : ''} onClick={() => s.updateSettings({ mode: 'single' })}>Single map</button>
                  </div>
                  {st.mode === 'single' && (
                    <div className="maps">
                      {MAP_IDS.map((id) => (
                        <button key={id} className={'mapbtn' + (st.map === id ? ' on' : '')} style={{ background: MAP_COLORS[id] ?? '#7c5cff' }} onClick={() => s.updateSettings({ map: id })}>{getMap(id).name}</button>
                      ))}
                    </div>
                  )}
                  <div className="setting-row">
                    <span>Fill with bots to</span>
                    <div className="seg" style={{ minWidth: '55%' }}>
                      {[0, 8, 16, 30].map((n) => <button key={n} className={st.fillBots === n ? 'on' : ''} onClick={() => s.updateSettings({ fillBots: n })}>{n === 0 ? 'Off' : n}</button>)}
                    </div>
                  </div>
                  <div className="muted" style={{ fontWeight: 800, fontSize: 'calc(var(--u)*0.9)' }}>
                    {st.mode === 'tournament' ? `${total} players · ${projectedRounds(total)} round${projectedRounds(total) > 1 ? 's' : ''} until one winner` : `${getMap(st.map).name} · one round`}
                  </div>
                  <Btn className="green big" onClick={start} disabled={room.phase !== 'lobby' || total < 1}>START</Btn>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 800 }}>{st.mode === 'tournament' ? 'Tournament' : `Single map: ${getMap(st.map).name}`} · {st.fillBots ? `bots fill to ${st.fillBots}` : 'humans only'}</div>
                  <Btn className={me?.ready ? 'white big' : 'green big'} onClick={() => s.setReady(!me?.ready)} disabled={room.phase !== 'lobby'}>{me?.ready ? 'NOT READY' : 'READY!'}</Btn>
                  <div className="muted" style={{ fontWeight: 800, fontSize: 'calc(var(--u)*0.9)', textAlign: 'center' }}>Waiting for the host to start…</div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {confirmStart && (
        <Modal onClose={() => setConfirmStart(false)}>
          <h2>Start anyway?</h2>
          <p style={{ fontWeight: 800 }}>{notReady} player{notReady > 1 ? 's are' : ' is'} not ready yet.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Btn className="white small" onClick={() => setConfirmStart(false)}>Wait</Btn>
            <Btn className="green small" onClick={() => { setConfirmStart(false); s.start(); }}>Start now</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
