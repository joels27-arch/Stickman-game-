import { useSyncExternalStore, type ReactNode } from 'react';
import { type Cosmetics, ITEM_BY_ID } from '../../shared/cosmetics';
import { audio } from '../game/audio';
import type { Store } from '../settings';

export function useStore<T>(s: Store<T>): T {
  return useSyncExternalStore(s.subscribe, s.get, s.get);
}

export function hexOf(cos: Cosmetics | undefined): string {
  const h = ITEM_BY_ID.get(cos?.color ?? '')?.hex ?? 0xff8a3d;
  return '#' + h.toString(16).padStart(6, '0');
}

export function Avatar({ cos, name, small }: { cos?: Cosmetics; name: string; small?: boolean }) {
  const c = hexOf(cos);
  return <div className={'avatar' + (small ? ' sm' : '')} style={{ background: `radial-gradient(circle at 35% 30%, #ffffff66, ${c} 55%)` }}>{name.slice(0, 1).toUpperCase()}</div>;
}

export function Btn(p: { children: ReactNode; onClick?: () => void; className?: string; disabled?: boolean; title?: string; style?: React.CSSProperties }) {
  return (
    <button className={'btn ' + (p.className ?? '')} disabled={p.disabled} title={p.title} style={p.style}
      onClick={() => { audio.unlock(); audio.click(); p.onClick?.(); }}>
      {p.children}
    </button>
  );
}

export function Coins({ n }: { n: number }) {
  return <span className="pill"><span className="coin" />{n.toLocaleString()}</span>;
}

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  return (
    <div className="modal-bg fade-in" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={'panel modal pop-in' + (wide ? ' wide' : '')}>{children}</div>
    </div>
  );
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <div className={'switch' + (on ? ' on' : '')} onClick={() => { audio.click(); onChange(!on); }} role="switch" aria-checked={on} />;
}
