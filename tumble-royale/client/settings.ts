// Persistent user settings (per device) and a tiny observable store helper.

export type Quality = 'auto' | 'low' | 'medium' | 'high';

export interface Settings {
  quality: Quality;
  music: number;
  sfx: number;
  sensitivity: number;
  invertY: boolean;
  autoCam: boolean;
  showFps: boolean;
  showNames: boolean;
}

const KEY = 'tumble.settings.v1';
const defaults: Settings = { quality: 'auto', music: 0.55, sfx: 0.8, sensitivity: 1, invertY: false, autoCam: true, showFps: false, showNames: true };

function load(): Settings {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { ...defaults }; }
}

export class Store<T> {
  private subs = new Set<() => void>();
  constructor(private v: T) {}
  get = () => this.v;
  set(patch: Partial<T> | ((v: T) => T)) {
    this.v = typeof patch === 'function' ? patch(this.v) : { ...this.v, ...patch };
    for (const s of this.subs) s();
  }
  subscribe = (f: () => void) => { this.subs.add(f); return () => { this.subs.delete(f); }; };
}

export const settings = new Store<Settings>(load());
settings.subscribe(() => { try { localStorage.setItem(KEY, JSON.stringify(settings.get())); } catch { /* private mode */ } });
