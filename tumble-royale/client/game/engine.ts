// The 3D side of the client: renderer, menu showcase, the live round
// (local prediction + remote interpolation), spectating, podium, auto quality.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DT, Ev, Mode, TICK_RATE } from '../../shared/constants';
import { type Cosmetics, ITEM_BY_ID } from '../../shared/cosmetics';
import { getMap } from '../../shared/maps';
import { lerp, lerpAngle, m3, v3 } from '../../shared/math';
import { spawnPoint } from '../../shared/player';
import type { LobbyPlayer, ServerMsg } from '../../shared/protocol';
import { rayBody } from '../../shared/world';
import { COUNTDOWN_TICKS } from '../../server/room';
import type { GameSession } from '../net/session';
import { settings, Store, type Quality } from '../settings';
import { audio } from './audio';
import { FollowCamera } from './camera';
import { Character, nameTag } from './character';
import { Effects } from './effects';
import { InputManager } from './input';
import { MapView } from './mapview';
import { patMat, Pat, time as shaderTime } from './materials';

export interface HudState {
  screen: 'none' | 'intro' | 'countdown' | 'play' | 'results' | 'winner';
  mapName: string; subtitle: string; mode: 'race' | 'survival'; final: boolean; roundIndex: number;
  qualify: number; participants: number; qualifiedCount: number; aliveCount: number;
  timeLeft: number | null; countdown: string | null;
  me: 'playing' | 'qualified' | 'eliminated' | 'spectator';
  spectating: string | null;
  banner: { text: string; kind: 'good' | 'bad' | 'info'; id: number } | null;
  feed: { id: number; text: string; kind: 'good' | 'bad' }[];
  results: Extract<ServerMsg, { t: 'roundEnd' }> | null;
  winner: { id: number | null; name: string; isMe: boolean } | null;
  fps: number; ping: number;
}

const initialHud: HudState = {
  screen: 'none', mapName: '', subtitle: '', mode: 'race', final: false, roundIndex: 0, qualify: 0, participants: 0,
  qualifiedCount: 0, aliveCount: 0, timeLeft: null, countdown: null, me: 'playing', spectating: null, banner: null, feed: [],
  results: null, winner: null, fps: 60, ping: 0,
};

export const hud = new Store<HudState>({ ...initialHud });

interface Avatar { char: Character; tag: THREE.Sprite | null; id: number; cos: string; lastMode: number; lastGrounded: boolean }

const tmpV = new THREE.Vector3();
const P = v3(), R = m3(), O = v3(), DN = v3(0, -1, 0);

const PRESETS: Record<Exclude<Quality, 'auto'>, { pr: number; shadows: boolean; detail: number; aa: boolean; fx: number }> = {
  low: { pr: 0.75, shadows: false, detail: 0, aa: false, fx: 0.5 },
  medium: { pr: 1.25, shadows: true, detail: 1, aa: false, fx: 0.8 },
  high: { pr: 2, shadows: true, detail: 2, aa: true, fx: 1 },
};

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
  readonly follow = new FollowCamera(this.camera);
  readonly input: InputManager;
  readonly fx = new Effects();
  private clock = new THREE.Timer();
  private mode: 'menu' | 'game' | 'podium' = 'menu';
  // menu
  private menuRoot = new THREE.Group();
  private lineup: Character[] = [];
  private lineupKey = '';
  private showcaseX = 0;
  // game
  session: GameSession | null = null;
  private view: MapView | null = null;
  private avatars = new Map<number, Avatar>();
  private roundKey = '';
  private spectateId: number | null = null;
  private flyPath: THREE.Vector3[] = [];
  private lastCountdown = '';
  private feedId = 1;
  private hudTimer = 0;
  private podiumRoot: THREE.Group | null = null;
  private podiumT = 0;
  // perf
  private quality = PRESETS.medium;
  private frames = 0; private frameAcc = 0; private fps = 60;
  private autoLevel = 1; private autoGoodT = 0; private autoBadT = 0;
  private shadowsOn = true;
  private pmrem: THREE.PMREMGenerator;

  constructor(canvas: HTMLCanvasElement) {
    const q = this.resolveQuality(settings.get().quality);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q.aa, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.applyQuality(q);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    this.scene.add(this.fx.points);
    this.input = new InputManager(canvas);
    this.buildMenu();
    this.scene.add(this.menuRoot);
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    this.resize();
    settings.subscribe(() => {
      const s = settings.get();
      this.input.sensitivity = s.sensitivity; this.input.invertY = s.invertY;
      audio.setVolumes(s.music, s.sfx);
      if (s.quality !== 'auto') this.applyQuality(PRESETS[s.quality]);
    });
    const s = settings.get();
    this.input.sensitivity = s.sensitivity; this.input.invertY = s.invertY;
    audio.setVolumes(s.music, s.sfx);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private resolveQuality(q: Quality) {
    if (q !== 'auto') return PRESETS[q];
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.autoLevel = mobile ? 1 : 2;
    return mobile ? PRESETS.medium : PRESETS.high;
  }

  private applyQuality(q: typeof PRESETS.low) {
    this.quality = q;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.renderer.setPixelRatio(Math.min(dpr, q.pr));
    this.shadowsOn = q.shadows;
    this.renderer.shadowMap.enabled = q.shadows;
    this.fx.scale = q.fx;
    for (const a of this.avatars.values()) a.char.setShadows(q.shadows && q.detail >= 2);
  }

  private resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Narrow (phone landscape is wide, but portrait / tall screens need a wider view)
    this.camera.fov = w / h < 1 ? 78 : w / h < 1.5 ? 66 : 60;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ menu showcase

  private buildMenu() {
    const g = this.menuRoot;
    g.clear();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { uTime: shaderTime },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vD; uniform float uTime;
        void main(){ float h = vD.y * 0.5 + 0.5;
          vec3 top = vec3(0.09, 0.05, 0.5), mid = vec3(0.3, 0.14, 0.85), bot = vec3(0.95, 0.32, 0.55);
          vec3 c = mix(bot, mid, smoothstep(0.3, 0.55, h)); c = mix(c, top, smoothstep(0.55, 0.95, h));
          float rays = pow(max(0.0, sin(atan(vD.x, vD.z) * 12.0 + uTime * 0.2)), 8.0) * smoothstep(0.35, 0.7, h) * 0.08;
          gl_FragColor = vec4(c + rays, 1.0);
          #include <colorspace_fragment>
        }`,
    }));
    g.add(sky);
    g.add(new THREE.HemisphereLight(0xffffff, 0xb59cff, 1.3));
    const sun = new THREE.DirectionalLight(0xfff1e0, 2.4);
    sun.position.set(3, 8, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
    g.add(sun);
    const rim = new THREE.DirectionalLight(0xff9ad5, 1.2);
    rim.position.set(-5, 3, -4);
    g.add(rim);
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.6, 48), patMat({ color: 0xffd23f, color2: 0xffffff, pattern: Pat.Radial, side: 0xff9a3c }));
    stage.position.y = -0.3; stage.receiveShadow = true;
    g.add(stage);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.12, 12, 64), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff6fb5, emissiveIntensity: 0.6 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.02;
    g.add(ring);
    const big = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 1, 48), patMat({ color: 0x8f6bff, color2: 0xa98bff, pattern: Pat.Radial, side: 0x6a48e0 }));
    big.position.y = -1.1; big.receiveShadow = true;
    g.add(big);
    // floating balloons + clouds
    const cols = [0xff6fb5, 0xffd23f, 0x3fb7ff, 0x5ad86a, 0xff9a3c];
    for (let i = 0; i < 12; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshStandardMaterial({ color: cols[i % 5], roughness: 0.25 }));
      const a = (i / 12) * Math.PI * 2;
      b.position.set(Math.cos(a) * (7 + (i % 3)), 1.5 + (i % 4) * 1.1, Math.sin(a) * (5 + (i % 3)) - 5);
      b.scale.y = 1.2;
      b.userData.base = b.position.y; b.userData.k = i;
      g.add(b);
    }
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 1 }));
      c.scale.set(3, 1.4, 1.8);
      c.position.set(-20 + i * 6, 6 + (i % 3) * 2, -25 - (i % 2) * 6);
      g.add(c);
    }
  }

  /** Show these players on the menu/lobby stage (first = you, centred). */
  setLineup(players: { cos: Cosmetics; name: string }[]) {
    const key = JSON.stringify(players.map((p) => p.cos));
    if (key === this.lineupKey) return;
    this.lineupKey = key;
    for (const c of this.lineup) { c.root.removeFromParent(); c.dispose(); }
    this.lineup = [];
    const n = Math.min(players.length, 9);
    for (let i = 0; i < n; i++) {
      const c = new Character(players[i].cos, { shadows: true });
      const side = i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2);
      c.root.position.set(side * 1.25, i === 0 ? 0 : -0.0, i === 0 ? 0.3 : -Math.abs(side) * 0.55);
      c.root.rotation.y = -side * 0.15;
      if (i > 0) c.root.scale.setScalar(0.88);
      this.menuRoot.add(c.root);
      this.lineup.push(c);
    }
  }

  setShowcaseOffset(x: number) { this.showcaseX = x; }

  showMenu() {
    this.leaveGame();
    this.mode = 'menu';
    this.scene.add(this.menuRoot);
    this.scene.fog = null;
    this.input.setEnabled(false);
  }

  // ------------------------------------------------------------ game

  attach(session: GameSession) {
    this.session = session;
    this.roundKey = '';
  }

  private enterRound() {
    const s = this.session!;
    const r = s.round!;
    this.leaveGame(false);
    this.menuRoot.removeFromParent();
    this.mode = 'game';
    const map = getMap(r.map);
    this.view = new MapView(s.world!, this.shadowsOn, this.quality.detail);
    this.scene.add(this.view.group);
    const th = map.theme;
    this.scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
    this.fx.clear();
    this.fx.setWeather(this.quality.detail > 0 ? th.particles : undefined);
    this.spectateId = null;
    // Flyover path: race maps from the finish back to the start; survival: orbit.
    this.flyPath = map.mode === 'race' ? map.botPath.map((w) => new THREE.Vector3(w.p.x, w.p.y, w.p.z)) : [];
    const sp = spawnPoint(map, 0, v3());
    this.follow.reset(sp.x, sp.y, sp.z, map.spawn.yaw);
    this.input.setEnabled(true);
    audio.play(r.final ? 'final' : map.music === 'survival' ? 'survival' : 'race');
    audio.whoosh();
    this.lastCountdown = '';
    hud.set({
      ...initialHud, screen: 'intro', mapName: map.name, subtitle: map.subtitle, mode: map.mode, final: r.final, roundIndex: r.index,
      qualify: r.qualify, participants: r.participants.length, aliveCount: r.participants.length, feed: [],
    });
  }

  leaveGame(toMenu = true) {
    if (this.view) { this.view.group.removeFromParent(); this.view.dispose(); this.view = null; }
    for (const a of this.avatars.values()) { a.char.root.removeFromParent(); a.char.dispose(); a.tag?.removeFromParent(); }
    this.avatars.clear();
    if (this.podiumRoot) { this.podiumRoot.removeFromParent(); this.podiumRoot = null; }
    this.fx.setWeather(undefined);
    this.fx.clear();
    if (toMenu) { this.mode = 'menu'; this.scene.add(this.menuRoot); this.scene.fog = null; this.input.setEnabled(false); }
  }

  /** Session events → sounds, effects and HUD. */
  handleLocalEvents(ev: number) {
    const s = this.session; if (!s) return;
    const p = s.pred;
    if (ev & Ev.Jump) { audio.jump(); this.fx.dust(p.x, p.y, p.z, 5, 0.6); }
    if (ev & Ev.Dive) audio.dive();
    if (ev & Ev.BigLand) { audio.bigLand(); this.fx.dust(p.x, p.y, p.z, 14, 1.4); this.follow.addShake(0.15); }
    else if (ev & Ev.Land) { audio.land(); this.fx.dust(p.x, p.y, p.z, 6, 0.8); }
    if (ev & Ev.Bounce) { audio.bounce(); this.fx.sparkle(p.x, p.y, p.z, [0.5, 1, 0.6]); }
    if (ev & Ev.Boost) { audio.boost(); this.fx.sparkle(p.x, p.y, p.z, [0.5, 0.9, 1]); }
    if (ev & Ev.Knock) { audio.knock(); this.fx.stars(p.x, p.y + 1.8, p.z); this.follow.addShake(0.35); navigator.vibrate?.(30); }
    if (ev & Ev.FellOut) {
      const th = s.world?.map.theme;
      if (th?.floor === 'water') { audio.splash(); this.fx.splash(p.x, th.floorY, p.z); }
      else audio.whoosh();
    }
    if (ev & Ev.Respawned) { audio.respawn(); this.avatars.get(s.you)?.char.pop(); }
    if (ev & Ev.Checkpoint) { audio.checkpoint(); this.banner('Checkpoint!', 'info'); }
  }

  handleRemoteEvents(id: number, ev: number) {
    const tr = this.session?.remotes.get(id);
    if (!tr) return;
    const d = this.camera.position.distanceTo(tmpV.set(tr.x, tr.y, tr.z));
    if (ev & Ev.Jump) audio.sfxAt('jump', d);
    if (ev & Ev.Knock) { audio.sfxAt('knock', d); if (d < 40) this.fx.stars(tr.x, tr.y + 1.8, tr.z); }
    if (ev & Ev.Bounce) audio.sfxAt('bounce', d);
    if (ev & Ev.Dive) audio.sfxAt('dive', d);
    if ((ev & Ev.Land) && d < 25) this.fx.dust(tr.x, tr.y, tr.z, 3, 0.6);
    if (ev & Ev.Respawned) this.avatars.get(id)?.char.pop();
    if ((ev & Ev.FellOut) && this.session?.world?.map.theme.floor === 'water' && d < 60) this.fx.splash(tr.x, this.session.world.map.theme.floorY, tr.z);
  }

  onQualified(id: number, place: number) {
    const s = this.session!;
    const name = s.player(id)?.name ?? '???';
    if (id === s.you) {
      audio.qualified();
      this.banner(s.round?.final ? 'WINNER!' : 'QUALIFIED!', 'good');
      const p = s.pred;
      this.fx.confetti(p.x, p.y + 1, p.z, 80);
      this.spectateNext(1);
    } else this.pushFeed(`${name} qualified (#${place})`, 'good');
  }

  onEliminated(id: number, why: string) {
    const s = this.session!;
    const name = s.player(id)?.name ?? '???';
    if (id === s.you) {
      audio.eliminated();
      this.banner('ELIMINATED', 'bad');
      this.spectateNext(1);
    } else if (why !== 'cut') this.pushFeed(`${name} ${why === 'left' ? 'left' : 'is out'}`, 'bad');
  }

  onMatchEnd(m: Extract<ServerMsg, { t: 'matchEnd' }>) {
    const s = this.session!;
    const w = m.winner !== null ? s.player(m.winner) : undefined;
    hud.set({ screen: 'winner', winner: { id: m.winner, name: w?.name ?? 'Nobody', isMe: m.winner === s.you }, banner: null });
    this.buildPodium(m.winner, m.ranking.slice(1, 5).map((r) => r.id));
    audio.play('victory');
    audio.fanfare();
  }

  onRoundEnd(m: Extract<ServerMsg, { t: 'roundEnd' }>) {
    hud.set({ screen: 'results', results: m, banner: null, countdown: null });
    audio.whoosh();
  }

  private banner(text: string, kind: 'good' | 'bad' | 'info') { hud.set({ banner: { text, kind, id: this.feedId++ } }); }
  private pushFeed(text: string, kind: 'good' | 'bad') {
    const feed = [...hud.get().feed, { id: this.feedId++, text, kind }].slice(-4);
    hud.set({ feed });
    const id = feed[feed.length - 1].id;
    setTimeout(() => hud.set((h) => ({ ...h, feed: h.feed.filter((f) => f.id !== id) })), 3500);
  }

  spectateNext(dir: number) {
    const s = this.session; if (!s) return;
    const ids = [...s.remotes.entries()].filter(([, t]) => t.visible).map(([id]) => id).sort((a, b) => a - b);
    if (!ids.length) { this.spectateId = null; return; }
    const cur = this.spectateId === null ? -1 : ids.indexOf(this.spectateId);
    this.spectateId = ids[(cur + dir + ids.length) % ids.length];
  }

  private avatarFor(id: number, lp: LobbyPlayer | undefined): Avatar {
    let a = this.avatars.get(id);
    const cosKey = lp ? JSON.stringify(lp.cos) : '';
    if (a && a.cos === cosKey) return a;
    if (a) { a.char.root.removeFromParent(); a.char.dispose(); a.tag?.removeFromParent(); }
    const char = new Character(lp?.cos ?? { color: 'c_sky', outfit: 'o_none', hat: 'h_none', acc: 'a_none', face: 'f_happy', victory: 'v_wave' }, { shadows: this.shadowsOn && this.quality.detail >= 2 });
    const isMe = id === this.session?.you;
    const color = '#' + new THREE.Color(ITEM_BY_ID.get(lp?.cos.color ?? '')?.hex ?? 0xffffff).lerp(new THREE.Color(0xffffff), 0.45).getHexString();
    const tag = isMe ? null : nameTag(lp?.name ?? '???', color, !!lp?.bot);
    this.scene.add(char.root);
    if (tag) this.scene.add(tag);
    a = { char, tag, id, cos: cosKey, lastMode: -1, lastGrounded: true };
    this.avatars.set(id, a);
    return a;
  }

  private groundDrop(x: number, y: number, z: number, tick: number): number {
    const w = this.session?.world; if (!w) return 99;
    O.x = x; O.y = y + 0.3; O.z = z;
    let best = 20;
    for (const b of w.query(x, y, z)) {
      if (!w.isActive(b, tick)) continue;
      w.pose(b, tick, P, R);
      const h = rayBody(b, P, R, O, DN, best);
      if (h < best) best = h;
    }
    return Math.max(0, best - 0.3);
  }

  // ------------------------------------------------------------ podium

  private buildPodium(winner: number | null, others: number[]) {
    this.leaveGame(false);
    this.mode = 'podium';
    this.podiumT = 0;
    const g = new THREE.Group();
    this.podiumRoot = g;
    this.scene.add(g);
    this.scene.fog = null;
    g.add(this.menuRoot.children[0].clone()); // sky
    g.add(new THREE.HemisphereLight(0xffffff, 0xffb3e0, 1.3));
    const sun = new THREE.DirectionalLight(0xfff1e0, 2.6); sun.position.set(4, 10, 8); sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    g.add(sun);
    const mk = (h: number, x: number, color: number) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, h, 40), patMat({ color, color2: 0xffffff, pattern: Pat.Radial, side: 0xffffff }));
      m.position.set(x, h / 2 - 0.5, 0); m.receiveShadow = true; m.castShadow = true; g.add(m);
      return h - 0.5;
    };
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 1, 48), patMat({ color: 0x8f6bff, color2: 0xa98bff, pattern: Pat.Radial, side: 0x6a48e0 }));
    floor.position.y = -1; floor.receiveShadow = true; g.add(floor);
    const s = this.session!;
    const top = mk(2.2, 0, 0xffd23f);
    if (winner !== null) {
      const a = this.avatarFor(winner, s.player(winner));
      a.char.root.position.set(0, top, 0); a.char.root.rotation.y = 0;
      a.tag?.position.set(0, top + 2.6, 0);
      g.add(a.char.root); if (a.tag) g.add(a.tag);
    }
    others.slice(0, 4).forEach((id, i) => {
      const x = (i % 2 ? 1 : -1) * (2.7 + Math.floor(i / 2) * 2.4);
      const h = mk(i < 2 ? 1.4 : 0.8, x, i < 2 ? 0xc9d3e6 : 0xff9a3c);
      const a = this.avatarFor(id, s.player(id));
      a.char.root.position.set(x, h, 0.2); a.char.root.rotation.y = -x * 0.06;
      a.tag?.position.set(x, h + 2.4, 0.2);
      g.add(a.char.root); if (a.tag) g.add(a.tag);
    });
    this.camera.position.set(0, 3.4, 9.5);
    this.camera.lookAt(0, 2.3, 0);
    this.fx.confetti(0, 7, 0, 160, 8);
    this.input.setEnabled(false);
  }

  // ------------------------------------------------------------ frame loop

  private frame() {
    this.clock.update();
    const dt = Math.min(0.1, this.clock.getDelta());
    shaderTime.value += dt;
    this.perf(dt);
    if (this.mode === 'menu') this.frameMenu(dt);
    else if (this.mode === 'podium') this.framePodium(dt);
    else this.frameGame(dt);
    this.fx.update(dt, this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }

  private frameMenu(dt: number) {
    const t = shaderTime.value;
    this.camera.position.set(this.showcaseX + Math.sin(t * 0.15) * 0.3, 1.9, 7.6);
    this.camera.lookAt(this.showcaseX, 1.15, 0);
    this.lineup.forEach((c, i) => {
      const cycle = (t + i * 1.7) % 9;
      const victory = i === 0 && cycle > 6.5 ? c.cos.victory : i > 0 && cycle > 7.5 ? 'v_wave' : null;
      c.update({ mode: Mode.Normal, grounded: true, speed: 0, vy: 0, dt, victory });
    });
    for (const o of this.menuRoot.children) if (o.userData.base !== undefined) o.position.y = o.userData.base + Math.sin(t * 0.8 + o.userData.k) * 0.25;
    if (this.session?.round && this.session.phase !== 'lobby' && this.roundKey !== this.roundId()) this.syncRound();
  }

  private roundId() { const r = this.session?.round; return r ? `${r.index}:${r.introTick}:${r.map}` : ''; }

  private syncRound() {
    const s = this.session; if (!s || !s.round || !s.world) return;
    this.roundKey = this.roundId();
    this.enterRound();
  }

  private framePodium(dt: number) {
    this.podiumT += dt;
    const t = this.podiumT;
    this.camera.position.set(Math.sin(t * 0.25) * 2.5, 3.4, 9.5);
    this.camera.lookAt(0, 2.3, 0);
    const s = this.session;
    const w = hud.get().winner?.id;
    for (const a of this.avatars.values()) {
      const isWinner = a.id === w;
      a.char.update({ mode: Mode.Normal, grounded: true, speed: 0, vy: 0, dt, victory: isWinner ? a.char.cos.victory : null, lose: !isWinner && t > 0.5 });
    }
    if (Math.floor(t * 1.2) !== Math.floor((t - dt) * 1.2) && t < 9) this.fx.confetti((Math.random() - 0.5) * 6, 8, (Math.random() - 0.5) * 2, 40, 6);
    if (s && s.phase === 'lobby') { this.leaveGame(true); hud.set({ ...initialHud }); }
    else if (s?.round && this.roundKey !== this.roundId() && s.phase !== 'matchEnd') this.syncRound();
  }

  private frameGame(dt: number) {
    const s = this.session;
    if (!s || !s.round || !s.world) { if (this.mode === 'game') this.showMenu(); return; }
    if (this.roundKey !== this.roundId()) { this.syncRound(); return; }
    const r = s.round;
    // Camera-relative movement → world space input.
    const raw = this.input.sample();
    const yaw = this.follow.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const rx = -Math.cos(yaw), rz = Math.sin(yaw);
    const mx = rx * raw.x + fx * raw.y, mz = rz * raw.x + fz * raw.y;
    s.update(() => ({ mx, mz, btn: raw.btn }));
    if (s.lastSteps > 0) this.input.ack();
    const tickRel = s.renderTickRel;
    const serverNow = s.serverTickNow;

    // Local player
    const me = s.pred, prev = s.prevPred, al = s.alpha;
    const meOut = me.mode === Mode.Out || !r.participants.includes(s.you);
    const lp = s.player(s.you);
    const focus = new THREE.Vector3();
    if (r.participants.includes(s.you)) {
      const a = this.avatarFor(s.you, lp);
      a.char.root.visible = !meOut;
      if (!meOut) {
        const x = lerp(prev.x, me.x, al) + s.corr.x, y = lerp(prev.y, me.y, al) + s.corr.y, z = lerp(prev.z, me.z, al) + s.corr.z;
        a.char.root.position.set(x, y, z);
        a.char.root.rotation.y = lerpAngle(prev.yaw, me.yaw, al);
        a.char.update({ mode: me.mode, grounded: !!me.grounded, speed: Math.hypot(me.vx, me.vz), vy: me.vy, dt });
        a.char.setShadowDrop(me.grounded ? 0 : this.groundDrop(x, y, z, Math.floor(tickRel)));
        focus.set(x, y, z);
      }
    }
    // Remote players
    let alive = 0;
    for (const [id, tr] of s.remotes) {
      const lp2 = s.player(id);
      const a = this.avatarFor(id, lp2);
      a.char.root.visible = tr.visible;
      if (a.tag) a.tag.visible = tr.visible && settings.get().showNames;
      if (!tr.visible) continue;
      alive++;
      a.char.root.position.set(tr.x, tr.y, tr.z);
      a.char.root.rotation.y = tr.yaw;
      a.char.update({ mode: tr.mode, grounded: tr.grounded, speed: tr.speed, vy: tr.vy, dt });
      const dist = this.camera.position.distanceTo(a.char.root.position);
      if (a.tag) {
        a.tag.position.set(tr.x, tr.y + 2.35, tr.z);
        const k = Math.max(0.55, Math.min(1.5, dist / 11));
        a.tag.scale.set(1.6 * k, 0.4 * k, 1);
        a.tag.visible = a.tag.visible && dist < 45 && dist > 3.5 && hud.get().screen !== 'intro';
      }
      a.char.setShadowDrop(tr.grounded ? 0 : this.groundDrop(tr.x, tr.y, tr.z, Math.floor(tickRel)), dist < 50);
    }
    if (!meOut) alive++;
    for (const [id, a] of this.avatars) if (id !== s.you && !s.remotes.has(id)) { a.char.root.visible = false; if (a.tag) a.tag.visible = false; }

    // Spectating
    let spectating: string | null = null;
    if (meOut) {
      if (this.spectateId === null || !s.remotes.get(this.spectateId)?.visible) this.spectateNext(1);
      const tr = this.spectateId !== null ? s.remotes.get(this.spectateId) : undefined;
      if (tr) { focus.set(tr.x, tr.y, tr.z); spectating = s.player(this.spectateId!)?.name ?? null; }
      else focus.copy(this.camera.position).add(new THREE.Vector3(0, -2, 6));
    }

    this.view!.update(tickRel, focus);
    // Camera: intro flyover, then follow.
    const map = s.world.map;
    const introEnd = r.goTick - COUNTDOWN_TICKS;
    const cam = this.input.consumeCamera();
    if (serverNow < introEnd) {
      const u = Math.max(0, Math.min(1, (serverNow - r.introTick) / Math.max(1, introEnd - r.introTick)));
      if (this.flyPath.length > 1) this.follow.flyover(this.flyPath, u, focus, map.spawn.yaw);
      else {
        const a = u * Math.PI * 1.4 + 0.6;
        this.camera.position.set(Math.sin(a) * 32, 18 - u * 6, Math.cos(a) * 32 + map.spawn.center.z * 0.3);
        this.camera.lookAt(map.spawn.center.x, map.spawn.center.y, map.spawn.center.z * 0.4);
        this.follow.reset(focus.x, focus.y, focus.z, map.spawn.yaw);
      }
    } else {
      this.follow.update(dt, focus, cam, {
        world: s.world, blockers: this.view!.cameraBlockers, courseYaw: settings.get().autoCam && map.mode === 'race' ? map.camYaw : null,
        camIdle: this.input.camIdle, speed: meOut ? 3 : Math.hypot(me.vx, me.vz), tick: Math.floor(tickRel),
      });
    }

    // HUD
    let countdown: string | null = null;
    if (serverNow >= introEnd && serverNow < r.goTick + 50) {
      const left = (r.goTick - serverNow) / TICK_RATE;
      countdown = left > 0 ? String(Math.ceil(left)) : 'GO!';
    }
    if (countdown !== this.lastCountdown) {
      if (countdown) audio.countdown(countdown === 'GO!' ? 0 : Number(countdown));
      this.lastCountdown = countdown ?? '';
    }
    this.hudTimer -= dt;
    if (this.hudTimer <= 0 || countdown !== hud.get().countdown) {
      this.hudTimer = 0.12;
      const h = hud.get();
      const screen = h.screen === 'results' || h.screen === 'winner' ? h.screen : serverNow < introEnd ? 'intro' : serverNow < r.goTick ? 'countdown' : 'play';
      const timeLeft = map.mode === 'survival' || serverNow > r.goTick ? Math.max(0, (r.endTick - serverNow) / TICK_RATE) : null;
      hud.set({
        screen, countdown, qualifiedCount: s.qualifiedIds.size, aliveCount: alive, timeLeft,
        me: !r.participants.includes(s.you) ? 'spectator' : s.qualifiedIds.has(s.you) ? 'qualified' : s.eliminatedIds.has(s.you) || me.mode === Mode.Out ? (s.qualifiedIds.has(s.you) ? 'qualified' : 'eliminated') : 'playing',
        spectating, fps: Math.round(this.fps), ping: Math.round(s.rtt),
      });
    }
    void DT;
  }

  // ------------------------------------------------------------ auto quality

  private perf(dt: number) {
    this.frames++; this.frameAcc += dt;
    if (this.frameAcc < 1) return;
    this.fps = this.frames / this.frameAcc;
    this.frames = 0; this.frameAcc = 0;
    if (settings.get().quality !== 'auto' || this.mode !== 'game') return;
    if (this.fps < 45) { this.autoBadT++; this.autoGoodT = 0; } else if (this.fps > 58) { this.autoGoodT++; this.autoBadT = 0; } else { this.autoBadT = 0; this.autoGoodT = 0; }
    const levels = [PRESETS.low, { ...PRESETS.low, pr: 1 }, PRESETS.medium, { ...PRESETS.medium, pr: 1.6 }, PRESETS.high];
    if (this.autoBadT >= 3 && this.autoLevel > 0) { this.autoLevel--; this.applyQuality(levels[this.autoLevel]); this.autoBadT = 0; }
    if (this.autoGoodT >= 8 && this.autoLevel < levels.length - 1) { this.autoLevel++; this.applyQuality(levels[this.autoLevel]); this.autoGoodT = 0; }
  }

  get currentFps() { return this.fps; }
}
