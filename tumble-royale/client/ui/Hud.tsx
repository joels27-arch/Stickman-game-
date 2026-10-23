import { useEffect, useState } from 'react';
import { hud } from '../game/engine';
import type { GameClient } from '../client';
import { roomStore } from '../client';
import { Avatar, Btn, useStore } from './common';
import { settings } from '../settings';

export function Hud({ client, onPause }: { client: GameClient; onPause: () => void }) {
  const h = useStore(hud);
  const room = useStore(roomStore);
  const s = client.session;
  if (!s) return null;
  const goal = h.final
    ? h.mode === 'race' ? 'First to the finish wins the crown!' : 'Last one standing wins!'
    : h.mode === 'race' ? `First ${h.qualify} to the finish qualify` : `Survive! ${h.qualify} will qualify`;
  const pingClass = h.ping < 90 ? 'good' : h.ping < 180 ? 'mid' : 'bad';
  return (
    <div className="hud">
      {h.screen !== 'winner' && h.screen !== 'results' && (
        <div className="hud-top">
          <div className="row">
            <span className="hud-chip">{h.final ? 'FINAL' : `ROUND ${h.roundIndex + 1}`}</span>
            {h.timeLeft !== null && h.screen === 'play' && <span className="hud-chip"><span className={'timer' + (h.timeLeft < 15 ? ' low' : '')}>{fmt(h.timeLeft)}</span></span>}
          </div>
          <div className="row clickable">
            {!room.offline && <span className={'hud-chip ping ' + pingClass}>{h.ping} ms</span>}
            <button className="btn white tiny icon" onClick={onPause} aria-label="Pause">❚❚</button>
          </div>
        </div>
      )}
      {(h.screen === 'play' || h.screen === 'countdown') && (
        <div className="hud-center">
          {h.mode === 'race' ? (
            <div className="qual">
              <span>{Math.min(h.qualifiedCount, h.qualify)}/{h.qualify}</span>
              <div className="bar"><i style={{ width: `${(Math.min(h.qualifiedCount, h.qualify) / Math.max(1, h.qualify)) * 100}%` }} /></div>
              <span style={{ fontSize: '0.7em' }}>{h.final ? 'CROWN' : 'QUALIFIED'}</span>
            </div>
          ) : (
            <div className="qual"><span>{h.aliveCount}</span><span style={{ fontSize: '0.7em' }}>REMAINING · {h.qualify} QUALIFY</span></div>
          )}
        </div>
      )}
      {h.screen === 'intro' && (
        <div className="intro-card pop-in" key={h.mapName + h.roundIndex}>
          <div className={'mode-badge ' + (h.final ? 'final' : h.mode)}>{h.final ? '★ FINAL ★' : h.mode === 'race' ? 'RACE' : 'SURVIVAL'}</div>
          <div className="name">{h.mapName}</div>
          <div className="goal">{goal}</div>
          <div style={{ marginTop: '0.6em' }} className="round">{h.participants} players</div>
        </div>
      )}
      {h.countdown && <div className={'big-count' + (h.countdown === 'GO!' ? ' go' : '')}><span key={h.countdown}>{h.countdown}</span></div>}
      {h.banner && <div key={h.banner.id} className={'banner ' + h.banner.kind}>{h.banner.text}</div>}
      <div className="feed">{h.feed.map((f) => <div key={f.id} className={f.kind}>{f.text}</div>)}</div>
      {h.screen === 'play' && h.spectating && (
        <div className="spectate clickable">
          <Btn className="white small icon" onClick={() => client.engine.spectateNext(-1)}>◀</Btn>
          <div className="who"><small>{h.me === 'qualified' ? 'QUALIFIED · SPECTATING' : h.me === 'eliminated' ? 'ELIMINATED · SPECTATING' : 'SPECTATING'}</small>{h.spectating}</div>
          <Btn className="white small icon" onClick={() => client.engine.spectateNext(1)}>▶</Btn>
        </div>
      )}
      {h.screen === 'results' && h.results && <Results client={client} />}
      {h.screen === 'winner' && h.winner && <Winner client={client} />}
      {settings.get().showFps && <div className="fps">{h.fps} fps · {client.session?.netStats().rtt}ms · corr {client.session?.netStats().lastCorrection}</div>}
    </div>
  );
}

function fmt(s: number) { const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${m}:${r.toString().padStart(2, '0')}`; }

function Results({ client }: { client: GameClient }) {
  const h = useStore(hud);
  const s = client.session!;
  const r = h.results!;
  const meQ = r.qualified.includes(s.you), meIn = r.qualified.includes(s.you) || r.eliminated.includes(s.you);
  const row = (id: number, i: number) => {
    const p = s.player(id);
    return (
      <div key={id} className={'res-item' + (id === s.you ? ' me' : '')} style={{ animationDelay: `${Math.min(i, 20) * 40}ms` }}>
        <span className="pl">{r.ranking.find((x) => x.id === id)?.place}</span>
        <Avatar cos={p?.cos} name={p?.name ?? '?'} small />
        <span className="grow">{p?.name ?? '???'} {p?.bot && <span className="tag bot">BOT</span>}</span>
      </div>
    );
  };
  return (
    <div className="results fade-in">
      <div className="card">
        <h1 className="pop-in">{!meIn ? 'Round over' : meQ ? (r.next ? 'You qualified!' : 'You won!') : 'Eliminated!'}</h1>
        <div className="res-grid">
          <div className="panel res-col q"><h3>{r.next ? 'QUALIFIED' : 'WINNER'} · {r.qualified.length}</h3><div className="res-list scroll">{r.qualified.map(row)}</div></div>
          <div className="panel res-col e"><h3>ELIMINATED · {r.eliminated.length}</h3><div className="res-list scroll">{r.eliminated.map(row)}</div></div>
        </div>
        <div style={{ textAlign: 'center', color: '#fff', fontWeight: 800 }}>{r.next ? 'Next round starting soon…' : 'Crowning the champion…'}</div>
      </div>
    </div>
  );
}

function Winner({ client }: { client: GameClient }) {
  const h = useStore(hud);
  const room = useStore(roomStore);
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 1200); return () => clearTimeout(t); }, []);
  const w = h.winner!;
  return (
    <>
      <div className="winner pop-in">
        <div className="crown">👑</div>
        <div className="wname">{w.name}</div>
        <div className="wsub">{w.isMe ? 'YOU ARE THE CHAMPION!' : 'IS THE CHAMPION!'}</div>
      </div>
      {show && room.rewards && (
        <div className="panel rewards slide-up">
          <h2>Rewards</h2>
          <div className="reward-line"><span>XP</span><span>+{room.rewards.xp}</span></div>
          <div className="reward-line"><span>Coins</span><span>+{room.rewards.coins}</span></div>
          {room.rewards.levelUp && <div className="reward-line" style={{ color: '#2fc85a' }}><span>LEVEL UP!</span><span>Lv {room.rewards.level}</span></div>}
          {room.rewards.challenges.map((c) => <div key={c} className="reward-line" style={{ color: '#a86a00' }}><span>✔ {c}</span></div>)}
        </div>
      )}
      {show && !room.rewards && room.offline && (
        <div className="panel rewards slide-up"><h2>Practice</h2><div className="muted">Play online to earn coins and XP.</div></div>
      )}
    </>
  );
}
