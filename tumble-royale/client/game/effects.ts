// One pooled GPU point cloud for every burst effect (dust, stars, confetti,
// splashes, sparkles) plus ambient weather around the camera. Two draw calls total.

import * as THREE from 'three';

const N = 900;

const vs = `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
varying float vA; varying vec3 vC;
void main(){
  vA = aAlpha; vC = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (300.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const fs = `
varying float vA; varying vec3 vC;
void main(){
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  if (d > 0.5) discard;
  float a = vA * smoothstep(0.5, 0.25, d);
  gl_FragColor = vec4(vC, a);
}`;

interface P { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; grav: number; drag: number; r: number; g: number; b: number; grow: number }

export class Effects {
  readonly points: THREE.Points;
  private ps: P[] = [];
  private pos = new Float32Array(N * 3);
  private col = new Float32Array(N * 3);
  private size = new Float32Array(N);
  private alpha = new Float32Array(N);
  private geo = new THREE.BufferGeometry();
  private weather: THREE.Points | null = null;
  private weatherKind = '';
  private wpos: Float32Array | null = null;
  private wvel: Float32Array | null = null;
  scale = 1;

  constructor() {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  private add(p: Partial<P> & { x: number; y: number; z: number }) {
    if (this.ps.length >= N) this.ps.shift();
    this.ps.push({ vx: 0, vy: 0, vz: 0, life: 0, max: 0.6, size: 0.5, grav: 0, drag: 2, r: 1, g: 1, b: 1, grow: 0, ...p });
  }

  dust(x: number, y: number, z: number, n = 8, strength = 1) {
    n = Math.ceil(n * this.scale);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (1.2 + Math.random() * 2) * strength;
      this.add({ x, y: y + 0.1, z, vx: Math.cos(a) * s, vy: 0.6 + Math.random() * 1.2, vz: Math.sin(a) * s, max: 0.45 + Math.random() * 0.3, size: 0.45 + Math.random() * 0.35, drag: 4, grow: 0.9, r: 0.95, g: 0.93, b: 0.88 });
    }
  }

  stars(x: number, y: number, z: number) {
    for (let i = 0; i < Math.ceil(10 * this.scale); i++) {
      const a = (i / 10) * Math.PI * 2;
      this.add({ x, y, z, vx: Math.cos(a) * 3, vy: 2 + Math.random() * 2, vz: Math.sin(a) * 3, max: 0.7, size: 0.38, grav: 6, drag: 1.5, r: 1, g: 0.86, b: 0.2 });
    }
  }

  confetti(x: number, y: number, z: number, n = 60, spread = 4) {
    const cols = [[1, 0.3, 0.45], [1, 0.82, 0.2], [0.25, 0.6, 1], [0.4, 0.9, 0.45], [0.75, 0.45, 1]];
    n = Math.ceil(n * this.scale);
    for (let i = 0; i < n; i++) {
      const c = cols[i % cols.length];
      this.add({ x: x + (Math.random() - 0.5) * spread, y, z: z + (Math.random() - 0.5) * spread, vx: (Math.random() - 0.5) * 7, vy: 5 + Math.random() * 7, vz: (Math.random() - 0.5) * 7, max: 2.2 + Math.random(), size: 0.28, grav: 5, drag: 1.2, r: c[0], g: c[1], b: c[2] });
    }
  }

  splash(x: number, y: number, z: number, color = [0.6, 0.85, 1]) {
    for (let i = 0; i < Math.ceil(26 * this.scale); i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
      this.add({ x, y, z, vx: Math.cos(a) * s, vy: 5 + Math.random() * 6, vz: Math.sin(a) * s, max: 0.9, size: 0.5, grav: 18, drag: 0.5, r: color[0], g: color[1], b: color[2] });
    }
  }

  sparkle(x: number, y: number, z: number, color = [0.6, 1, 1], n = 14) {
    for (let i = 0; i < Math.ceil(n * this.scale); i++) {
      this.add({ x: x + (Math.random() - 0.5) * 1.2, y: y + Math.random() * 1.8, z: z + (Math.random() - 0.5) * 1.2, vy: 1 + Math.random(), max: 0.6 + Math.random() * 0.4, size: 0.3, drag: 1, r: color[0], g: color[1], b: color[2] });
    }
  }

  setWeather(kind: string | undefined) {
    if (this.weather) { this.weather.removeFromParent(); this.weather.geometry.dispose(); this.weather = null; }
    this.weatherKind = kind ?? '';
    if (!kind) return;
    const n = Math.floor(400 * this.scale);
    const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60; pos[i * 3 + 1] = Math.random() * 30; pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
      vel[i * 3] = (Math.random() - 0.5) * 0.6;
      vel[i * 3 + 1] = kind === 'embers' ? 1 + Math.random() * 1.5 : kind === 'sparkles' ? 0.2 : -(1 + Math.random() * 1.4);
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const color = kind === 'snow' ? 0xffffff : kind === 'embers' ? 0xff8a3d : kind === 'petals' ? 0xffb3d1 : 0xfff3a0;
    const m = new THREE.PointsMaterial({ color, size: kind === 'snow' ? 0.22 : 0.18, transparent: true, opacity: 0.85, depthWrite: false });
    this.weather = new THREE.Points(g, m);
    this.weather.frustumCulled = false;
    this.wpos = pos; this.wvel = vel;
    this.points.parent?.add(this.weather);
  }

  update(dt: number, cam: THREE.Vector3) {
    let n = 0;
    const out: P[] = [];
    for (const p of this.ps) {
      p.life += dt;
      if (p.life >= p.max) continue;
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      out.push(p);
      const k = p.life / p.max;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.col[n * 3] = p.r; this.col[n * 3 + 1] = p.g; this.col[n * 3 + 2] = p.b;
      this.size[n] = p.size * (1 + p.grow * k);
      this.alpha[n] = 1 - k * k;
      n++;
    }
    this.ps = out;
    this.geo.setDrawRange(0, n);
    for (const k of ['position', 'aColor', 'aSize', 'aAlpha']) (this.geo.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
    if (this.weather && this.wpos && this.wvel) {
      const p = this.wpos, v = this.wvel;
      const t = performance.now() / 1000;
      for (let i = 0; i < p.length; i += 3) {
        p[i] += (v[i] + Math.sin(t + i) * 0.3) * dt; p[i + 1] += v[i + 1] * dt; p[i + 2] += v[i + 2] * dt;
        // wrap around the camera
        if (p[i] - cam.x > 30) p[i] -= 60; else if (p[i] - cam.x < -30) p[i] += 60;
        if (p[i + 2] - cam.z > 30) p[i + 2] -= 60; else if (p[i + 2] - cam.z < -30) p[i + 2] += 60;
        if (p[i + 1] - cam.y < -12) p[i + 1] += 30; else if (p[i + 1] - cam.y > 18) p[i + 1] -= 30;
      }
      (this.weather.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  clear() { this.ps = []; this.geo.setDrawRange(0, 0); }
}
