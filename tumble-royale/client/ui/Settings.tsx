import { useState } from 'react';
import { profile, profileAction } from '../net/api';
import { settings, type Quality } from '../settings';
import { Btn, Modal, Switch, useStore } from './common';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const s = useStore(settings);
  const { p } = useStore(profile);
  const [name, setName] = useState(p.name);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'game' | 'controls'>('game');
  const saveName = async () => { const e = await profileAction('name', { name }); setErr(e); };
  return (
    <Modal onClose={onClose}>
      <div className="row"><h2 className="grow" style={{ margin: 0 }}>Settings</h2><Btn className="white tiny" onClick={onClose}>✕</Btn></div>
      <div className="seg" style={{ margin: '0.6em 0' }}>
        <button className={tab === 'game' ? 'on' : ''} onClick={() => setTab('game')}>Game</button>
        <button className={tab === 'controls' ? 'on' : ''} onClick={() => setTab('controls')}>Controls</button>
      </div>
      <div className="col scroll" style={{ gap: '0.7em', minHeight: 0 }}>
        {tab === 'game' ? (
          <>
            <div className="setting-row">
              <span>Name</span>
              <div className="row" style={{ gap: '0.4em' }}>
                <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} style={{ fontWeight: 800, fontSize: 'calc(var(--u)*1.1)', padding: '0.35em 0.6em', borderRadius: '0.5em', border: '0.12em solid #d9d0ff', width: '9em' }} />
                <Btn className="violet tiny" onClick={saveName} disabled={name === p.name}>Save</Btn>
              </div>
            </div>
            {err && <div className="error">{err}</div>}
            <div className="setting-row">
              <span>Graphics</span>
              <div className="seg" style={{ minWidth: '60%' }}>
                {(['auto', 'low', 'medium', 'high'] as Quality[]).map((q) => <button key={q} className={s.quality === q ? 'on' : ''} onClick={() => settings.set({ quality: q })}>{q[0].toUpperCase() + q.slice(1)}</button>)}
              </div>
            </div>
            <div className="setting-row"><span>Music</span><input type="range" min={0} max={1} step={0.05} value={s.music} onChange={(e) => settings.set({ music: +e.target.value })} /></div>
            <div className="setting-row"><span>Sound effects</span><input type="range" min={0} max={1} step={0.05} value={s.sfx} onChange={(e) => settings.set({ sfx: +e.target.value })} /></div>
            <div className="setting-row"><span>Show player names</span><Switch on={s.showNames} onChange={(v) => settings.set({ showNames: v })} /></div>
            <div className="setting-row"><span>Show FPS / network stats</span><Switch on={s.showFps} onChange={(v) => settings.set({ showFps: v })} /></div>
          </>
        ) : (
          <>
            <div className="setting-row"><span>Camera sensitivity</span><input type="range" min={0.3} max={2.5} step={0.05} value={s.sensitivity} onChange={(e) => settings.set({ sensitivity: +e.target.value })} /></div>
            <div className="setting-row"><span>Invert camera Y</span><Switch on={s.invertY} onChange={(v) => settings.set({ invertY: v })} /></div>
            <div className="setting-row"><span>Auto-align camera with the course</span><Switch on={s.autoCam} onChange={(v) => settings.set({ autoCam: v })} /></div>
            <div className="help-grid" style={{ marginTop: '0.4em' }}>
              <span className="kbd">W A S D</span><span>Move (arrow keys work too)</span>
              <span className="kbd">Space</span><span>Jump</span>
              <span className="kbd">Shift</span><span>Dive (jump, then dive to cross big gaps!)</span>
              <span className="kbd">Mouse drag</span><span>Look around</span>
              <span className="kbd">Esc</span><span>Pause / settings</span>
              <span className="kbd">Phone</span><span>Left thumb: joystick · Right: JUMP / DIVE · drag right side to look</span>
              <span className="kbd">Gamepad</span><span>Left stick · A jump · B/X dive · right stick camera</span>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { p, online } = useStore(profile);
  const st = p.stats;
  const cells: [string, string | number][] = [
    ['Level', p.level], ['Wins', st.wins], ['Matches', st.matches],
    ['Rounds played', st.rounds], ['Rounds qualified', st.qualified], ['Finals reached', st.finals],
    ['Best finish', st.bestPlace ? `#${st.bestPlace}` : '–'], ['Dives', st.dives], ['Bounces', st.bounces],
  ];
  return (
    <Modal onClose={onClose}>
      <div className="row"><h2 className="grow" style={{ margin: 0 }}>{p.name}</h2><Btn className="white tiny" onClick={onClose}>✕</Btn></div>
      {!online && <div className="error" style={{ margin: '0.5em 0' }}>Offline: stats are saved on the game server once connected.</div>}
      <div className="stats-grid" style={{ marginTop: '0.6em' }}>
        {cells.map(([k, v]) => <div key={k} className="stat"><b>{v}</b><span>{k}</span></div>)}
      </div>
      <div className="muted" style={{ marginTop: '0.7em', fontWeight: 800, fontSize: 'calc(var(--u)*0.85)' }}>XP {p.xp} / {p.xpNext} to level {p.level + 1}. Rewards and unlocks are stored on the server.</div>
    </Modal>
  );
}

export function PauseModal({ onResume, onLeave, onSettings }: { onResume: () => void; onLeave: () => void; onSettings: () => void }) {
  return (
    <Modal onClose={onResume}>
      <h2 style={{ textAlign: 'center' }}>Paused</h2>
      <p className="muted" style={{ textAlign: 'center', fontWeight: 800, marginTop: 0 }}>The match keeps going for everyone else!</p>
      <div className="col">
        <Btn className="green" onClick={onResume}>Resume</Btn>
        <Btn className="violet" onClick={onSettings}>Settings</Btn>
        <Btn className="red" onClick={onLeave}>Leave match</Btn>
      </div>
    </Modal>
  );
}
