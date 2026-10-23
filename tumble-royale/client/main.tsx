import { createRoot } from 'react-dom/client';
import './ui/styles.css';
import { GameClient } from './client';
import { audio } from './game/audio';
import { Engine } from './game/engine';
import { loadProfile } from './net/api';
import { App } from './ui/App';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const engine = new Engine(canvas);
const client = new GameClient(engine);
(window as any).__tumble = { engine, client }; // debugging + browser tests

// Audio can only start after a user gesture (mobile browsers).
const unlock = () => { audio.unlock(); audio.play(client.session ? 'lobby' : 'menu'); };
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

loadProfile();
setInterval(() => { if (!client.session) loadProfile(); }, 30000);
createRoot(document.getElementById('root')!).render(<App client={client} />);
