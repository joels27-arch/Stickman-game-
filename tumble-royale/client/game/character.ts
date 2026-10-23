// The Tumble bean: one procedural base character with modular cosmetics and a
// fully procedural animation system (idle, run, jump, fall, dive, slide,
// knockdown, recover, respawn, celebrate, lose, podium dances).
// Parts are merged per bone with vertex colours, so a character costs ~7 draw calls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Mode } from '../../shared/constants';
import { type Cosmetics, ITEM_BY_ID } from '../../shared/cosmetics';
import { beanMaterial, lighten, shade } from './materials';

const partsMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.03 });
const glowMat = new THREE.MeshStandardMaterial({ color: 0xfff3a0, emissive: 0xffe066, emissiveIntensity: 1.4, roughness: 0.3 });
const shadowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
const shadowGeo = new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2);

const OUTFIT_ID: Record<string, number> = { o_none: 0, o_stripes: 1, o_dots: 2, o_overalls: 3, o_tux: 4, o_hero: 5, o_ninja: 6, o_astro: 7 };

// ---------------------------------------------------------------- geometry helpers

type Part = THREE.BufferGeometry;
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), T = new THREE.Vector3();

function part(g: THREE.BufferGeometry, color: number, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]): Part {
  const geo = g.index ? g : g;
  E.set(rot[0], rot[1], rot[2]);
  M.compose(T.set(...pos), Q.setFromEuler(E), S.set(...scale));
  const out = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(M);
  const n = out.attributes.position.count;
  const col = new Float32Array(n * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') out.deleteAttribute(k);
  if (!out.index) return out;
  return out;
}

function merge(parts: Part[]): THREE.BufferGeometry {
  const idx = parts.map((p) => (p.index ? p : p));
  const g = mergeGeometries(idx, false);
  if (!g) throw new Error('merge failed');
  g.computeBoundingSphere();
  return g;
}

const G = {
  sphere: new THREE.SphereGeometry(1, 14, 10),
  sphereLo: new THREE.SphereGeometry(1, 8, 6),
  hemi: new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cone: new THREE.ConeGeometry(1, 1, 14),
  torus: new THREE.TorusGeometry(1, 0.25, 8, 18),
  box: new THREE.BoxGeometry(1, 1, 1),
  capsule: new THREE.CapsuleGeometry(1, 1, 4, 10),
  smile: new THREE.TorusGeometry(0.07, 0.017, 5, 12, Math.PI),
  grin: new THREE.CircleGeometry(0.09, 14, Math.PI, Math.PI),
  star: (() => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.45 : 1;
      i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false });
  })(),
};

/** Bean body: lathe profile, feet-origin at y = 0.3. */
const BODY_GEO = (() => {
  const pts: THREE.Vector2[] = [];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = 0.3 + t * 1.34;
    const r = 0.45 * Math.pow(Math.sin(Math.PI * t), 0.52) * (1 - 0.07 * t) * (t < 0.5 ? 0.96 + t * 0.08 : 1);
    pts.push(new THREE.Vector2(Math.max(0.0001, r), y));
  }
  const g = new THREE.LatheGeometry(pts, 28);
  g.computeVertexNormals();
  return g;
})();

/** Surface radius of the bean at height y (for placing face parts). */
function beanR(y: number) {
  const t = (y - 0.3) / 1.34;
  return 0.45 * Math.pow(Math.sin(Math.PI * Math.max(0, Math.min(1, t))), 0.52) * (1 - 0.07 * t) * (t < 0.5 ? 0.96 + t * 0.08 : 1);
}

const HEAD_TOP = 1.64;
const EYE_Y = 1.24;

function hatParts(id: string, c1: number, c2: number): Part[] {
  const p: Part[] = [];
  const y = HEAD_TOP;
  switch (id) {
    case 'h_cap':
      p.push(part(G.hemi, c1, [0, y - 0.2, 0], [0, 0, 0], [0.4, 0.26, 0.4]));
      p.push(part(G.cyl, shade(c1, 0.85), [0, y - 0.18, 0.3], [0.12, 0, 0], [0.24, 0.03, 0.22]));
      p.push(part(G.sphereLo, 0xffffff, [0, y + 0.06, 0], [0, 0, 0], [0.05, 0.04, 0.05]));
      break;
    case 'h_beanie':
      p.push(part(G.hemi, c1, [0, y - 0.22, 0], [0, 0, 0], [0.42, 0.33, 0.42]));
      p.push(part(G.cyl, shade(c1, 0.8), [0, y - 0.2, 0], [0, 0, 0], [0.43, 0.1, 0.43]));
      p.push(part(G.sphere, 0xffffff, [0, y + 0.13, 0], [0, 0, 0], [0.09, 0.09, 0.09]));
      break;
    case 'h_party':
      p.push(part(G.cone, c1, [0.03, y + 0.12, 0], [0, 0, -0.12], [0.2, 0.55, 0.2]));
      p.push(part(G.torus, c2, [0.0, y - 0.1, 0], [Math.PI / 2, 0, -0.12], [0.18, 0.18, 0.3]));
      p.push(part(G.sphere, c2, [0.1, y + 0.42, 0], [0, 0, 0], [0.07, 0.07, 0.07]));
      break;
    case 'h_propeller':
      p.push(part(G.hemi, c1, [0, y - 0.2, 0], [0, 0, 0], [0.4, 0.25, 0.4]));
      p.push(part(G.cyl, c2, [0, y - 0.1, 0], [0, 0, 0], [0.4, 0.04, 0.4]));
      p.push(part(G.cyl, 0x666666, [0, y + 0.1, 0], [0, 0, 0], [0.02, 0.14, 0.02]));
      break;
    case 'h_cowboy':
      p.push(part(G.cyl, c1, [0, y - 0.12, 0], [0, 0, 0], [0.62, 0.035, 0.62]));
      p.push(part(G.cyl, c1, [0, y + 0.02, 0], [0, 0, 0], [0.3, 0.26, 0.3]));
      p.push(part(G.cyl, shade(c1, 0.6), [0, y - 0.06, 0], [0, 0, 0], [0.305, 0.05, 0.305]));
      p.push(part(G.box, shade(c1, 0.85), [0, y + 0.15, 0], [0, 0, 0], [0.04, 0.06, 0.45]));
      break;
    case 'h_tophat':
      p.push(part(G.cyl, c1, [0, y - 0.1, 0], [0, 0, 0], [0.46, 0.035, 0.46]));
      p.push(part(G.cyl, c1, [0, y + 0.15, 0], [0, 0, 0], [0.28, 0.5, 0.28]));
      p.push(part(G.cyl, c2, [0, y - 0.03, 0], [0, 0, 0], [0.285, 0.08, 0.285]));
      break;
    case 'h_bunny':
      for (const s of [-1, 1]) {
        p.push(part(G.sphere, c1, [s * 0.14, y + 0.22, -0.02], [0, 0, s * 0.18], [0.09, 0.3, 0.06]));
        p.push(part(G.sphere, c2, [s * 0.14, y + 0.22, 0.03], [0, 0, s * 0.18], [0.05, 0.22, 0.03]));
      }
      break;
    case 'h_viking':
      p.push(part(G.hemi, c1, [0, y - 0.24, 0], [0, 0, 0], [0.44, 0.34, 0.44]));
      p.push(part(G.cyl, shade(c1, 0.75), [0, y - 0.22, 0], [0, 0, 0], [0.45, 0.07, 0.45]));
      for (const s of [-1, 1]) p.push(part(G.cone, c2, [s * 0.44, y - 0.02, 0], [0, 0, -s * 1.0], [0.08, 0.36, 0.08]));
      break;
    case 'h_chef':
      p.push(part(G.cyl, c1, [0, y - 0.08, 0], [0, 0, 0], [0.3, 0.18, 0.3]));
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; p.push(part(G.sphere, c1, [Math.cos(a) * 0.17, y + 0.12, Math.sin(a) * 0.17], [0, 0, 0], [0.18, 0.16, 0.18])); }
      p.push(part(G.sphere, c1, [0, y + 0.2, 0], [0, 0, 0], [0.2, 0.16, 0.2]));
      break;
    case 'h_crown':
      p.push(part(new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), c1, [0, y - 0.04, 0], [0, 0, 0], [0.3, 0.16, 0.3]));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        p.push(part(G.cone, c1, [Math.sin(a) * 0.28, y + 0.11, Math.cos(a) * 0.28], [0, 0, 0], [0.07, 0.16, 0.07]));
        p.push(part(G.sphereLo, i % 2 ? c2 : 0x37c0ff, [Math.sin(a) * 0.305, y - 0.04, Math.cos(a) * 0.305], [0, 0, 0], [0.04, 0.04, 0.04]));
      }
      break;
  }
  return p;
}

function accParts(id: string, c1: number, c2: number, body: number): Part[] {
  const p: Part[] = [];
  const zf = beanR(EYE_Y) - 0.02;
  switch (id) {
    case 'a_shades':
      for (const s of [-1, 1]) p.push(part(G.box, c1, [s * 0.15, EYE_Y, zf + 0.05], [0, s * 0.18, 0], [0.22, 0.13, 0.04]));
      p.push(part(G.box, c1, [0, EYE_Y + 0.03, zf + 0.06], [0, 0, 0], [0.1, 0.025, 0.03]));
      break;
    case 'a_scarf':
      p.push(part(G.torus, c1, [0, 0.98, 0], [Math.PI / 2, 0, 0], [0.43, 0.43, 0.42]));
      p.push(part(G.torus, c2, [0, 0.98, 0], [Math.PI / 2, 0, 0], [0.435, 0.435, 0.15]));
      p.push(part(G.box, c1, [0.16, 0.8, beanR(0.85) + 0.02], [0.15, 0, 0.12], [0.13, 0.3, 0.05]));
      break;
    case 'a_backpack':
      p.push(part(G.capsule, c1, [0, 0.88, -0.48], [0, 0, 0], [0.22, 0.2, 0.14]));
      p.push(part(G.box, shade(c1, 0.75), [0, 0.8, -0.6], [0, 0, 0], [0.26, 0.18, 0.06]));
      for (const s of [-1, 1]) p.push(part(G.torus, shade(c1, 0.7), [s * 0.2, 0.95, -0.05], [0, Math.PI / 2, 0], [0.42, 0.3, 0.2]));
      break;
    case 'a_mustache':
      for (const s of [-1, 1]) p.push(part(G.sphere, c1, [s * 0.08, EYE_Y - 0.15, zf + 0.04], [0, 0, s * 0.35], [0.09, 0.035, 0.04]));
      break;
    case 'a_bowtie':
      for (const s of [-1, 1]) p.push(part(G.cone, c1, [s * 0.07, 0.93, beanR(0.93) + 0.02], [0, 0, (s * Math.PI) / 2], [0.06, 0.12, 0.03]));
      p.push(part(G.sphereLo, shade(c1, 0.7), [0, 0.93, beanR(0.93) + 0.03], [0, 0, 0], [0.035, 0.035, 0.03]));
      break;
  }
  void body;
  return p;
}

interface FaceSpec { lids: 'none' | 'half' | 'angry' | 'sleepy'; mouth: 'smile' | 'grin' | 'smirk' | 'flat' | 'o'; wink?: boolean; star?: boolean }
const FACES: Record<string, FaceSpec> = {
  f_happy: { lids: 'none', mouth: 'smile' },
  f_grin: { lids: 'none', mouth: 'grin' },
  f_cool: { lids: 'half', mouth: 'smirk' },
  f_wink: { lids: 'none', mouth: 'smile', wink: true },
  f_angry: { lids: 'angry', mouth: 'flat' },
  f_sleepy: { lids: 'sleepy', mouth: 'o' },
  f_star: { lids: 'none', mouth: 'grin', star: true },
};

// ---------------------------------------------------------------- the rig

export interface AnimInput {
  mode: number; grounded: boolean; speed: number; vy: number;
  /** Seconds in the current mode (approx). */
  modeT?: number;
  victory?: string | null;
  lose?: boolean;
  dt: number;
}

interface Pose {
  bob: number; lean: number; roll: number; pitch: number; squash: number;
  aLx: number; aLz: number; aRx: number; aRz: number; lL: number; lR: number; spread: number; drop: number;
}
const zeroPose = (): Pose => ({ bob: 0, lean: 0, roll: 0, pitch: 0, squash: 1, aLx: 0, aLz: 0.25, aRx: 0, aRz: -0.25, lL: 0, lR: 0, spread: 0, drop: 0 });

export class Character {
  readonly root = new THREE.Group();
  // Rigid-skinned rig: every part is welded to one bone, so the whole bean is ONE draw call.
  private rootBone = new THREE.Bone();
  private bodyPivot = new THREE.Bone();
  private tumble = new THREE.Bone();
  private off = new THREE.Bone();
  private eyes = new THREE.Bone();
  private armL = new THREE.Bone();
  private armR = new THREE.Bone();
  private legL = new THREE.Bone();
  private legR = new THREE.Bone();
  private propeller: THREE.Bone | null = null;
  private wings: THREE.Bone[] = [];
  private cape: THREE.Bone | null = null;
  private halo: THREE.Bone | null = null;
  readonly shadow: THREE.Mesh;
  private mesh: THREE.SkinnedMesh;
  private pose = zeroPose();
  private phase = Math.random() * 10;
  private t = Math.random() * 10;
  private blinkT = 2 + Math.random() * 3;
  private spin = 0;
  private yawSpin = 0;
  private lastMode = -1;
  private modeClock = 0;
  private popT = 1;
  cos: Cosmetics;
  private mat: THREE.MeshStandardMaterial;

  constructor(cos: Cosmetics, opts: { shadows?: boolean } = {}) {
    this.cos = cos;
    const colorItem = ITEM_BY_ID.get(cos.color);
    const bodyColor = colorItem?.hex ?? 0xff8a3d;
    const outfit = ITEM_BY_ID.get(cos.outfit);
    const o1 = outfit?.hex ?? 0xffffff, o2 = outfit?.hex2 ?? 0xffffff;
    this.mat = beanMaterial({ color: bodyColor, color2: colorItem?.hex2, outfit: OUTFIT_ID[cos.outfit] ?? 0, o1, o2 });

    // Bone hierarchy (rest pose): root(feet) → tumble (spin about the middle) → bodyPivot (hips) → off (feet level) → parts
    const bones: THREE.Bone[] = [];
    const bone = (b: THREE.Bone, parent: THREE.Object3D, x: number, y: number, z: number) => { b.position.set(x, y, z); parent.add(b); bones.push(b); return b; };
    this.root.add(this.rootBone); bones.push(this.rootBone);
    bone(this.tumble, this.rootBone, 0, 0.75, 0);
    bone(this.bodyPivot, this.tumble, 0, -0.33, 0);
    bone(this.off, this.bodyPivot, 0, -0.42, 0);
    bone(this.eyes, this.off, 0, EYE_Y, 0);
    bone(this.armL, this.off, 0.4, 0.98, 0);
    bone(this.armR, this.off, -0.4, 0.98, 0);
    bone(this.legL, this.tumble, 0.17, -0.33, 0);
    bone(this.legR, this.tumble, -0.17, -0.33, 0);
    const pieces: { g: THREE.BufferGeometry; b: THREE.Bone; flag: number }[] = [];
    const put = (g: THREE.BufferGeometry, b: THREE.Bone, flag = 0) => pieces.push({ g, b, flag });

    put(part(BODY_GEO, bodyColor, [0, 0, 0]), this.off, 1);

    // Face
    const face = FACES[cos.face] ?? FACES.f_happy;
    const zf = beanR(EYE_Y) - 0.035;
    const eyeParts: Part[] = [];
    for (const s of [-1, 1]) {
      const closed = face.wink && s === -1;
      if (face.star) {
        eyeParts.push(part(G.star, 0xffd23f, [s * 0.14, EYE_Y, zf + 0.02], [0, s * 0.2, 0], [0.1, 0.1, 0.12]));
        eyeParts.push(part(G.sphereLo, 0xffffff, [s * 0.14 + 0.02, EYE_Y + 0.03, zf + 0.07], [0, 0, 0], [0.018, 0.018, 0.018]));
      } else if (closed) {
        eyeParts.push(part(G.smile, 0x1d1b2e, [s * 0.14, EYE_Y - 0.02, zf + 0.045], [0, s * 0.2, 0], [0.9, 0.9, 0.9]));
      } else {
        eyeParts.push(part(G.sphere, 0xffffff, [s * 0.14, EYE_Y, zf], [0, s * 0.25, 0], [0.105, 0.125, 0.06]));
        eyeParts.push(part(G.sphere, 0x1d1b2e, [s * 0.135, EYE_Y - 0.005, zf + 0.04], [0, s * 0.25, 0], [0.058, 0.07, 0.035]));
        eyeParts.push(part(G.sphereLo, 0xffffff, [s * 0.135 + 0.022, EYE_Y + 0.03, zf + 0.07], [0, 0, 0], [0.018, 0.018, 0.012]));
      }
    }
    for (const e of eyeParts) { e.translate(0, -EYE_Y, 0); put(e, this.eyes); }

    const lidColor = shade(bodyColor, 0.92);
    if (face.lids !== 'none' && !face.star) {
      for (const s of [-1, 1]) {
        if (face.wink && s === -1) continue;
        const tilt = face.lids === 'angry' ? -s * 0.45 : face.lids === 'sleepy' ? 0 : s * 0.1;
        const drop = face.lids === 'sleepy' ? -0.02 : face.lids === 'half' ? 0.02 : 0.045;
        put(part(G.hemi, lidColor, [s * 0.14, EYE_Y + drop, zf + 0.008], [0.2, s * 0.25, tilt], [0.115, 0.1, 0.07]), this.off);
      }
    }
    const my = EYE_Y - 0.21;
    const mz = beanR(my) - 0.005;
    if (face.mouth === 'smile') put(part(G.smile, 0x1d1b2e, [0, my + 0.04, mz], [0, 0, Math.PI], [1, 1, 1]), this.off);
    else if (face.mouth === 'smirk') put(part(G.smile, 0x1d1b2e, [0.03, my + 0.03, mz], [0, 0, Math.PI + 0.35], [0.8, 0.6, 1]), this.off);
    else if (face.mouth === 'flat') put(part(G.box, 0x1d1b2e, [0, my + 0.02, mz], [0, 0, 0], [0.11, 0.022, 0.02]), this.off);
    else if (face.mouth === 'o') put(part(G.torus, 0x1d1b2e, [0, my + 0.02, mz], [0, 0, 0], [0.035, 0.04, 0.03]), this.off);
    else {
      put(part(G.grin, 0x3a1020, [0, my + 0.06, mz + 0.012], [-0.15, 0, 0], [1, 1, 1]), this.off);
      put(part(G.grin, 0xff6b8a, [0, my + 0.0, mz + 0.016], [-0.15, 0, 0], [0.5, 0.4, 1]), this.off);
    }
    for (const s of [-1, 1]) put(part(G.sphereLo, lighten(0xff6b8a, 0.3), [s * 0.27, EYE_Y - 0.13, beanR(EYE_Y - 0.13) - 0.06], [0, s * 0.6, 0], [0.055, 0.03, 0.02]), this.off);

    const hat = ITEM_BY_ID.get(cos.hat);
    for (const g of hatParts(cos.hat, hat?.hex ?? 0xffffff, hat?.hex2 ?? 0xffffff)) put(g, this.off);
    const acc = ITEM_BY_ID.get(cos.acc);
    for (const g of accParts(cos.acc, acc?.hex ?? 0xffffff, acc?.hex2 ?? 0xffffff, bodyColor)) put(g, this.off);

    // Animated accessories get their own bones.
    if (cos.hat === 'h_propeller') {
      this.propeller = bone(new THREE.Bone(), this.off, 0, HEAD_TOP + 0.18, 0);
      put(part(G.box, hat!.hex2!, [0.16, 0, 0], [0, 0, 0.15], [0.32, 0.02, 0.07]), this.propeller);
      put(part(G.box, hat!.hex!, [-0.16, 0, 0], [0, 0, -0.15], [0.32, 0.02, 0.07]), this.propeller);
    }
    if (cos.hat === 'h_halo') {
      this.halo = bone(new THREE.Bone(), this.off, 0, HEAD_TOP + 0.2, 0);
      put(part(G.torus, hat!.hex!, [0, 0, 0], [Math.PI / 2, 0, 0], [0.24, 0.24, 0.14]), this.halo, 2);
    }
    if (cos.acc === 'a_wings') {
      for (const s of [-1, 1]) {
        const w = bone(new THREE.Bone(), this.off, 0, 1.0, -0.38);
        w.userData.s = s;
        put(part(G.sphere, acc!.hex!, [s * 0.3, 0.08, 0], [0, 0, s * 0.4], [0.35, 0.22, 0.03]), w, 2);
        this.wings.push(w);
      }
    }
    if (cos.acc === 'a_cape') {
      this.cape = bone(new THREE.Bone(), this.off, 0, 1.1, -0.36);
      put(part(G.box, acc!.hex!, [0, -0.47, 0], [0, 0, 0], [0.7, 0.95, 0.03]), this.cape);
    }

    // Arms (shoulder pivots) and legs (hip pivots)
    const handColor = cos.outfit === 'o_hero' || cos.outfit === 'o_astro' ? 0xffffff : bodyColor;
    const armColor = cos.outfit === 'o_tux' || cos.outfit === 'o_ninja' || cos.outfit === 'o_hero' || cos.outfit === 'o_astro' ? (outfit?.hex ?? bodyColor) : bodyColor;
    for (const b of [this.armL, this.armR]) {
      put(part(G.capsule, armColor, [0, -0.16, 0], [0, 0, 0], [0.085, 0.2, 0.085]), b);
      put(part(G.sphere, handColor, [0, -0.33, 0], [0, 0, 0], [0.11, 0.11, 0.11]), b);
    }
    const shoe = cos.outfit === 'o_astro' ? 0xeeeeee : shade(bodyColor, 0.55);
    const legColor = cos.outfit === 'o_overalls' || cos.outfit === 'o_tux' || cos.outfit === 'o_hero' || cos.outfit === 'o_ninja' || cos.outfit === 'o_astro' ? (outfit?.hex ?? bodyColor) : bodyColor;
    for (const b of [this.legL, this.legR]) {
      put(part(G.capsule, legColor, [0, -0.15, 0], [0, 0, 0], [0.1, 0.14, 0.1]), b);
      put(part(G.sphere, shoe, [0, -0.3, 0.05], [0, 0, 0], [0.13, 0.09, 0.18]), b);
    }

    // Weld every piece to its bone in the rest pose, then merge into one skinned mesh.
    this.root.updateMatrixWorld(true);
    for (const pc of pieces) {
      pc.g.applyMatrix4(pc.b.matrixWorld);
      const n = pc.g.attributes.position.count, bi = bones.indexOf(pc.b);
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), fl = new Float32Array(n).fill(pc.flag);
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      pc.g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      pc.g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      pc.g.setAttribute('aFlag', new THREE.Float32BufferAttribute(fl, 1));
    }
    const geo = mergeGeometries(pieces.map((p) => p.g), false)!;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 2.6);
    this.mesh = new THREE.SkinnedMesh(geo, this.mat);
    this.root.add(this.mesh);
    this.mesh.bind(new THREE.Skeleton(bones));
    this.mesh.castShadow = !!opts.shadows;
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.renderOrder = 1;
    this.root.add(this.shadow);
    this.shadow.position.y = 0.03;
  }

  setShadows(on: boolean) { this.mesh.castShadow = on; }

  /** Ground height under the character relative to its feet (for the blob shadow). */
  setShadowDrop(d: number, visible = true) {
    this.shadow.position.y = 0.03 - d;
    this.shadow.visible = visible && d < 12;
    const k = Math.max(0.35, 1 - d * 0.08);
    this.shadow.scale.setScalar(k);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 1;
  }

  /** Called on respawn to play the pop-in. */
  pop() { this.popT = 0; }

  update(a: AnimInput) {
    const dt = Math.min(0.05, a.dt);
    this.t += dt;
    if (a.mode !== this.lastMode) { this.modeClock = 0; if (a.mode === Mode.Respawn) this.popT = 0; this.lastMode = a.mode; }
    this.modeClock += dt;
    const tg = zeroPose();
    const t = this.t;
    let rate = 14;
    const speed = Math.min(12, a.speed);
    let spinning = false;

    if (a.victory) {
      this.victoryPose(a.victory, tg, t);
      rate = 10;
    } else if (a.lose) {
      tg.lean = 0.35; tg.aLz = 0.1; tg.aRz = -0.1; tg.aLx = 0.2; tg.aRx = 0.2; tg.squash = 0.94; tg.bob = -0.04;
      rate = 5;
    } else switch (a.mode) {
      case Mode.Dive:
        tg.pitch = 1.3; tg.aLx = -2.6; tg.aRx = -2.6; tg.aLz = 0.35; tg.aRz = -0.35; tg.lL = 0.5; tg.lR = 0.5; tg.drop = 0.1;
        rate = 16;
        break;
      case Mode.Slide:
        tg.pitch = 1.42; tg.aLx = -2.8; tg.aRx = -2.8; tg.aLz = 0.5; tg.aRz = -0.5; tg.lL = 0.6; tg.lR = 0.4; tg.drop = 0.42;
        tg.roll = Math.sin(t * 18) * 0.06;
        rate = 18;
        break;
      case Mode.Getup:
      case Mode.Recover:
        tg.pitch = 0.2; tg.squash = 0.9; tg.aLz = 0.9; tg.aRz = -0.9; tg.bob = -0.05;
        rate = 9;
        break;
      case Mode.Knock:
        spinning = !a.grounded;
        tg.aLz = 1.9; tg.aRz = -1.9; tg.spread = 0.6; tg.lL = -0.3; tg.lR = 0.3;
        if (a.grounded) { tg.pitch = -1.45; tg.drop = 0.45; tg.aLz = 1.4 + Math.sin(t * 9) * 0.3; tg.aRz = -1.4 - Math.sin(t * 9) * 0.3; }
        rate = 10;
        break;
      default:
        if (!a.grounded) {
          if (a.vy > 1.5) { // rising
            tg.aLz = 2.4; tg.aRz = -2.4; tg.aLx = -0.3; tg.aRx = -0.3; tg.lL = -0.5; tg.lR = 0.35; tg.squash = 1.06; tg.lean = 0.05;
          } else { // falling: flail
            tg.aLz = 2.2 + Math.sin(t * 22) * 0.45; tg.aRz = -2.2 + Math.sin(t * 22 + 1.3) * 0.45;
            tg.aLx = Math.sin(t * 17) * 0.5; tg.aRx = -Math.sin(t * 17) * 0.5;
            tg.lL = Math.sin(t * 15) * 0.5; tg.lR = -Math.sin(t * 15) * 0.5; tg.lean = -0.05;
          }
          rate = 12;
        } else if (speed > 0.6) {
          this.phase += dt * (5.5 + speed * 1.25);
          const s = Math.sin(this.phase), c = Math.cos(this.phase);
          const k = Math.min(1, speed / 7);
          tg.lL = s * 1.0 * k; tg.lR = -s * 1.0 * k;
          tg.aLx = -s * 1.2 * k; tg.aRx = s * 1.2 * k; tg.aLz = 0.35; tg.aRz = -0.35;
          tg.bob = Math.abs(c) * 0.09 * k; tg.lean = 0.2 * k; tg.roll = s * 0.06 * k; tg.squash = 1 + Math.abs(c) * 0.03;
          rate = 18;
        } else {
          tg.bob = Math.sin(t * 2.4) * 0.012; tg.squash = 1 + Math.sin(t * 2.4) * 0.018;
          tg.aLz = 0.22 + Math.sin(t * 2.4) * 0.05; tg.aRz = -0.22 - Math.sin(t * 2.4) * 0.05;
          rate = 8;
        }
    }

    // Smoothly blend toward the target pose.
    const p = this.pose;
    const k = 1 - Math.exp(-rate * dt);
    for (const key of Object.keys(p) as (keyof Pose)[]) p[key] += (tg[key] - p[key]) * k;

    if (spinning) this.spin += dt * 11; else this.spin *= Math.exp(-10 * dt);
    // Land squash: when coming down from a mode change to grounded we just let the blend handle it.

    if (a.victory === 'v_spin') this.yawSpin += dt * 9; else this.yawSpin *= Math.exp(-6 * dt);
    this.tumble.rotation.set(this.spin, this.yawSpin, 0);
    this.bodyPivot.rotation.set(p.lean + p.pitch, 0, p.roll);
    this.bodyPivot.scale.set(1 / Math.sqrt(p.squash), p.squash, 1 / Math.sqrt(p.squash));
    this.tumble.position.y = 0.75 + p.bob - p.drop;
    this.armL.rotation.set(p.aLx, 0, p.aLz);
    this.armR.rotation.set(p.aRx, 0, p.aRz);
    // Legs hang from the hips, so they follow the body pitch (dive / slide / lying down).
    this.legL.rotation.set(p.lL + p.pitch * 0.95, 0, p.spread);
    this.legR.rotation.set(p.lR + p.pitch * 0.95, 0, -p.spread);

    // Blink
    this.blinkT -= dt;
    let ey = 1;
    if (this.blinkT < 0) { ey = 0.12; if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3.5; }
    if (a.mode === Mode.Knock) ey = 0.6 + Math.sin(t * 20) * 0.3;
    this.eyes.scale.set(1, ey, 1);

    // Respawn pop
    if (this.popT < 1) {
      this.popT = Math.min(1, this.popT + dt / 0.45);
      const x = this.popT;
      const s = 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
      this.root.scale.setScalar(Math.max(0.01, s));
    } else this.root.scale.setScalar(1);

    if (this.propeller) this.propeller.rotation.y += dt * (6 + speed * 3);
    if (this.halo) this.halo.position.y = HEAD_TOP + 0.2 + Math.sin(t * 2.5) * 0.03;
    for (const w of this.wings) w.rotation.y = (w.userData.s as number) * (0.3 + Math.sin(t * (a.grounded ? 4 : 14)) * 0.35);
    if (this.cape) this.cape.rotation.x = -0.15 - Math.min(1.1, speed * 0.12) - (a.grounded ? 0 : 0.3) + Math.sin(t * 7) * 0.05;
  }

  private victoryPose(v: string, tg: Pose, t: number) {
    switch (v) {
      case 'v_wave':
        tg.aRz = -2.6 + Math.sin(t * 9) * 0.35; tg.aRx = -0.2; tg.aLz = 0.3; tg.bob = Math.abs(Math.sin(t * 3)) * 0.05; tg.roll = Math.sin(t * 3) * 0.05;
        break;
      case 'v_jump': {
        const h = Math.abs(Math.sin(t * 4.5));
        tg.bob = h * 0.45; tg.aLz = 1.6 + h; tg.aRz = -1.6 - h; tg.squash = 1 + (h < 0.1 ? -0.1 : 0.05);
        break;
      }
      case 'v_dance':
        tg.roll = Math.sin(t * 7) * 0.25; tg.aLz = 1.2 + Math.sin(t * 7) * 1.0; tg.aRz = -1.2 + Math.sin(t * 7) * 1.0;
        tg.lL = Math.sin(t * 7) * 0.3; tg.lR = -Math.sin(t * 7) * 0.3; tg.bob = Math.abs(Math.sin(t * 7)) * 0.06;
        break;
      case 'v_spin':
        tg.aLz = 1.5; tg.aRz = -1.5; tg.bob = 0.05;
        break;
      case 'v_flex':
        tg.aLz = 1.5; tg.aRz = -1.5; tg.aLx = -1.2 - Math.sin(t * 6) * 0.2; tg.aRx = -1.2 - Math.sin(t * 6) * 0.2; tg.squash = 1.04 + Math.sin(t * 6) * 0.03; tg.lean = -0.1;
        break;
      case 'v_flip': {
        const cyc = (t % 1.8) / 1.8;
        if (cyc < 0.45) { const u = cyc / 0.45; tg.bob = Math.sin(u * Math.PI) * 1.1; this.spin = -u * Math.PI * 2; tg.aLz = 2.5; tg.aRz = -2.5; }
        else { tg.aLz = 2.2; tg.aRz = -2.2; tg.bob = 0; this.spin = 0; }
        break;
      }
      default:
        tg.aRz = -2.5; tg.aLz = 2.5;
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.mesh.skeleton.dispose();
  }
}

// ---------------------------------------------------------------- name tags

const tagCache = new Map<string, THREE.SpriteMaterial>();
export function nameTag(name: string, color: string, bot: boolean): THREE.Sprite {
  const key = name + color + bot;
  let mat = tagCache.get(key);
  if (!mat) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d')!;
    const nameFont = '400 30px "Lilita One", system-ui, sans-serif', botFont = '800 17px system-ui, sans-serif';
    g.font = nameFont;
    const nw = Math.min(200, g.measureText(name).width);
    g.font = botFont;
    const bw = bot ? g.measureText('BOT').width + 10 : 0;
    const w = Math.min(252, nw + bw + 26);
    const x0 = 128 - w / 2;
    g.fillStyle = 'rgba(20,16,48,0.55)';
    roundRect(g, x0, 12, w, 40, 20); g.fill();
    g.textBaseline = 'middle'; g.textAlign = 'left';
    g.font = nameFont; g.fillStyle = color;
    g.fillText(name, x0 + 13, 33, 200);
    if (bot) { g.font = botFont; g.fillStyle = '#bdb6ff'; g.fillText('BOT', x0 + 13 + nw + 8, 34); }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    tagCache.set(key, mat);
  }
  const s = new THREE.Sprite(mat);
  s.scale.set(1.6, 0.4, 1);
  s.renderOrder = 10;
  return s;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
