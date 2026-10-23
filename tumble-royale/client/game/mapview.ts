// Builds the visual world for a MapDef and animates its moving bodies using the
// exact same pose functions the server simulates with.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DT } from '../../shared/constants';
import type { BodyDef, DecorDef, MapDef } from '../../shared/maptypes';
import { m3, v3 } from '../../shared/math';
import { type Body, killHeight, type World } from '../../shared/world';
import { floorMaterial, lighten, Pat, patMat, type PatOpts, shade, skyMaterial } from './materials';

const P = v3();
const R = m3();
const MAT4 = new THREE.Matrix4();

function matOpts(d: BodyDef): PatOpts | null {
  const v = d.visual;
  const c = v.color ?? 0xffffff, c2 = v.color2 ?? 0xffffff;
  switch (v.style) {
    case 'invisible': return null;
    case 'platform': return { color: c, side: lighten(c, 0.55), roughness: 0.55 };
    case 'stripe': return { color: c, color2: c2, pattern: Pat.StripesZ, scale: 2.4, side: lighten(c, 0.6) };
    case 'checker': return { color: c, color2: c2, pattern: Pat.Checker, scale: 1.6, side: lighten(c, 0.5) };
    case 'start': return { color: c, color2: c2, pattern: Pat.Checker, scale: 2, side: shade(c, 0.8) };
    case 'finish-pad': return { color: 0x222233, color2: 0xffffff, pattern: Pat.Checker, scale: 1, side: 0x333344 };
    case 'hammer': return { color: c, color2: c2, pattern: Pat.Radial, allSides: true, roughness: 0.35 };
    case 'beam': return { color: c, color2: v.color2 ?? 0xe8433a, pattern: Pat.Hazard, scale: 0.9, allSides: true, roughness: 0.4 };
    case 'bumper': return { color: c, color2: 0xffffff, pattern: Pat.Radial, allSides: true, roughness: 0.3, emissive: c, emissiveIntensity: 0.15 };
    case 'bounce': return { color: c, color2: lighten(c, 0.6), pattern: Pat.Spiral, scale: 0.9, side: shade(c, 0.6), emissive: c, emissiveIntensity: 0.35, roughness: 0.3 };
    case 'boost': return { color: 0x1aa3ff, color2: 0x9ff3ff, pattern: Pat.Chevron, scale: 1.2, allSides: true, emissive: 0x1aa3ff, emissiveIntensity: 0.6 };
    case 'conveyor': return { color: 0x3b3f55, color2: 0xffcf3d, pattern: Pat.Conveyor, scale: 1.4, side: 0x2a2d3d };
    case 'ice': return { color: c ?? 0xbfe9ff, color2: 0xffffff, pattern: Pat.Ice, roughness: 0.12, side: lighten(c, 0.3), metalness: 0.05 };
    case 'ball': return { color: c, color2: 0xffffff, pattern: Pat.Radial, allSides: true, roughness: 0.28 };
    case 'snowball': return { color: 0xf4f8ff, color2: 0xd5e4f5, pattern: Pat.Ice, allSides: true, roughness: 0.9 };
    case 'tile': return { color: c, color2: lighten(c, 0.35), pattern: Pat.Solid, side: shade(c, 0.7), roughness: 0.4 };
    case 'wall': return { color: c, color2: v.color2 ?? shade(c, 0.85), pattern: Pat.BandsY, scale: 0.8, allSides: true };
    case 'glass': return { color: c ?? 0x9fe6ff, transparent: true, opacity: 0.45, allSides: true, roughness: 0.05 };
    case 'cloud': return { color: 0xffffff, side: 0xdfe9ff, roughness: 0.9 };
    case 'lava-rock': return { color: c ?? 0x4a2c2a, color2: 0xff7a1a, pattern: Pat.Ice, side: shade(c ?? 0x4a2c2a, 0.7), roughness: 0.85 };
    case 'log': return { color: c ?? 0x9b5f35, color2: shade(c ?? 0x9b5f35, 0.75), pattern: Pat.Radial, allSides: true, roughness: 0.8 };
    case 'pillar': return { color: c, allSides: true, roughness: 0.5 };
    case 'fan': return { color: c, allSides: true };
    case 'cannon': return { color: c ?? 0x3a3f58, color2: 0xffcf3d, pattern: Pat.BandsY, scale: 0.5, allSides: true, roughness: 0.35, metalness: 0.3 };
  }
  return { color: c };
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function bodyGeometry(d: BodyDef): THREE.BufferGeometry {
  const s = d.shape;
  const tile = d.visual.style === 'tile';
  const key = JSON.stringify(s) + (tile ? 't' : '') + (d.visual.round ?? '');
  let g = geoCache.get(key);
  if (g) return g;
  if (s.kind === 'box') {
    const r = Math.min(d.visual.round ?? 0.12, Math.min(s.hx, s.hy, s.hz) - 0.01);
    g = r > 0.02 ? new RoundedBoxGeometry(s.hx * 2, s.hy * 2, s.hz * 2, 2, r) : new THREE.BoxGeometry(s.hx * 2, s.hy * 2, s.hz * 2);
  } else if (s.kind === 'cyl') {
    g = tile ? new THREE.CylinderGeometry(s.r * 1.06, s.r * 1.0, s.hy * 2, 6) : new THREE.CylinderGeometry(s.r, s.r, s.hy * 2, s.r > 3 ? 48 : 28);
  } else {
    g = new THREE.SphereGeometry(s.r, 24, 16);
  }
  if (g.index) g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  geoCache.set(key, g);
  return g;
}

interface Moving { body: Body; mesh: THREE.Mesh; baseOpacity: number }

export class MapView {
  readonly group = new THREE.Group();
  private moving: Moving[] = [];
  private sky: THREE.Mesh;
  private floor: THREE.Mesh | null = null;
  private killPlane: THREE.Mesh | null = null;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private decorAnim: { obj: THREE.Object3D; kind: string; base: number }[] = [];
  /** Static solids the camera should not pass through. */
  readonly cameraBlockers: Body[] = [];
  private owned: THREE.BufferGeometry[] = [];
  private tiles: { mesh: THREE.InstancedMesh; bodies: Body[]; tint: Float32Array }[] = [];

  constructor(readonly world: World, shadows: boolean, detail: number) {
    const map = world.map, th = map.theme;
    // Sky + lights
    const sunDir = new THREE.Vector3(th.sunDir.x, th.sunDir.y, th.sunDir.z).normalize();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMaterial(th.skyTop, th.skyBottom, sunDir));
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.group.add(this.sky);
    this.hemi = new THREE.HemisphereLight(th.ambient, th.hemiGround, 1.15);
    this.group.add(this.hemi);
    this.sun = new THREE.DirectionalLight(th.sun, th.sunIntensity);
    this.sun.position.copy(sunDir).multiplyScalar(60);
    if (shadows) {
      this.sun.castShadow = true;
      const sz = 34;
      Object.assign(this.sun.shadow.camera, { left: -sz, right: sz, top: sz, bottom: -sz, near: 1, far: 160 });
      this.sun.shadow.mapSize.set(detail >= 2 ? 2048 : 1024, detail >= 2 ? 2048 : 1024);
      this.sun.shadow.bias = -0.0006;
      this.sun.shadow.normalBias = 0.03;
    }
    this.group.add(this.sun, this.sun.target);

    // Floor
    if (th.floor !== 'void') {
      const size = 1600;
      this.floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 80, 80).rotateX(-Math.PI / 2), floorMaterial(th.floor, th.floorColor));
      this.floor.position.set((map.bounds.min.x + map.bounds.max.x) / 2, th.floorY, (map.bounds.min.z + map.bounds.max.z) / 2);
      this.group.add(this.floor);
    }
    if (map.killY.rise) {
      // Rising hazard (lava) drawn as its own glowing plane that follows killY(t).
      const w = map.bounds.max.x - map.bounds.min.x + 80, d = map.bounds.max.z - map.bounds.min.z + 80;
      this.killPlane = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 40, 40).rotateX(-Math.PI / 2), floorMaterial('lava', 0xff5a1a));
      this.killPlane.position.set((map.bounds.min.x + map.bounds.max.x) / 2, map.killY.base, (map.bounds.min.z + map.bounds.max.z) / 2);
      this.group.add(this.killPlane);
    }

    // Bodies: merge statics per material, keep movers as individual meshes.
    const staticByMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const tileGroups = new Map<string, { mat: THREE.Material; geo: THREE.BufferGeometry; bodies: Body[] }>();
    for (const b of world.bodies) {
      const o = matOpts(b.def);
      if (!o) continue;
      const mat = patMat(o);
      if (!b.moving) {
        world.pose(b, 0, P, R);
        const g = bodyGeometry(b.def).clone();
        MAT4.set(R[0], R[1], R[2], P.x, R[3], R[4], R[5], P.y, R[6], R[7], R[8], P.z, 0, 0, 0, 1);
        g.applyMatrix4(MAT4);
        const list = staticByMat.get(mat) ?? [];
        list.push(g);
        staticByMat.set(mat, list);
        const s = b.shape;
        const big = s.kind === 'box' ? Math.max(s.hx, s.hz) > 2.5 && s.hy > 0.3 : s.kind === 'cyl' ? s.r > 2.5 : false;
        if (big) this.cameraBlockers.push(b);
      } else if (b.def.trigger && !b.def.motion && !b.def.path && !b.def.cycle && b.def.fallAt === undefined && b.def.activeFrom === undefined) {
        // Step-triggered tiles: one instanced draw call per material instead of one mesh each.
        const key = JSON.stringify(o) + '|' + JSON.stringify(b.def.shape) + b.def.visual.style;
        let g = tileGroups.get(key);
        if (!g) { g = { mat, geo: bodyGeometry(b.def), bodies: [] }; tileGroups.set(key, g); }
        g.bodies.push(b);
      } else {
        const mesh = new THREE.Mesh(bodyGeometry(b.def), b.def.visual.style === 'tile' || b.def.cycle || b.def.trigger || b.def.fallAt !== undefined || b.def.activeFrom !== undefined ? mat.clone() : mat);
        mesh.castShadow = shadows && !b.def.visual.noShadow;
        mesh.receiveShadow = shadows;
        mesh.matrixAutoUpdate = false;
        this.group.add(mesh);
        this.moving.push({ body: b, mesh, baseOpacity: (mesh.material as THREE.MeshStandardMaterial).opacity });
        if (b.def.trigger || b.def.cycle || b.def.fallAt !== undefined) (mesh.material as THREE.MeshStandardMaterial).transparent = true;
      }
    }
    for (const g of tileGroups.values()) {
      const inst = new THREE.InstancedMesh(g.geo, g.mat, g.bodies.length);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const white = new THREE.Color(1, 1, 1);
      g.bodies.forEach((_, i) => inst.setColorAt(i, white));
      inst.castShadow = shadows; inst.receiveShadow = shadows;
      inst.frustumCulled = false;
      this.group.add(inst);
      this.tiles.push({ mesh: inst, bodies: g.bodies, tint: new Float32Array(g.bodies.length).fill(-1) });
    }
    for (const [mat, list] of staticByMat) {
      const g = mergeGeometries(list, false);
      if (!g) continue;
      this.owned.push(g);
      const mesh = new THREE.Mesh(g, mat);
      mesh.receiveShadow = shadows;
      mesh.castShadow = shadows;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }

    this.buildDecor(map, detail, shadows);
    this.buildWind(map);
  }

  // Wind zones: drifting streaks show direction and strength (only while the gust is on).
  private wind: { zone: MapDef['wind'][number]; mesh: THREE.InstancedMesh; seeds: Float32Array }[] = [];
  private buildWind(map: MapDef) {
    const geo = new THREE.BoxGeometry(0.06, 0.06, 1.8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
    for (const zone of map.wind) {
      const n = 36;
      const mesh = new THREE.InstancedMesh(geo, mat, n);
      const seeds = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i++) seeds[i] = Math.random();
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.wind.push({ zone, mesh, seeds });
    }
  }
  private updateWind(t: number) {
    const d = new THREE.Object3D();
    for (const w of this.wind) {
      const z = w.zone;
      let on = true;
      if (z.cycle) { const per = z.cycle.on + z.cycle.off; const u = (((t + z.cycle.phase) % per) + per) % per; on = u < z.cycle.on; }
      w.mesh.visible = on;
      if (!on) continue;
      const f = z.force, fl = Math.hypot(f.x, f.y, f.z) || 1;
      const dx = f.x / fl, dy = f.y / fl, dz = f.z / fl;
      const sx = z.max.x - z.min.x, sy = z.max.y - z.min.y, sz = z.max.z - z.min.z;
      const speed = 4 + fl * 0.4;
      for (let i = 0; i < w.mesh.count; i++) {
        const a = w.seeds[i * 3], b = w.seeds[i * 3 + 1], c = w.seeds[i * 3 + 2];
        const u = (t * speed / Math.max(sx, sz, 1) + a) % 1;
        // travel along the force across the zone, spread on the other axes
        let x = z.min.x + (Math.abs(dx) > 0.5 ? ((dx > 0 ? u : 1 - u) * sx) : b * sx);
        let y = z.min.y + 0.5 + (Math.abs(dy) > 0.5 ? ((dy > 0 ? u : 1 - u) * sy) : c * Math.min(sy, 3));
        let zz = z.min.z + (Math.abs(dz) > 0.5 ? ((dz > 0 ? u : 1 - u) * sz) : (Math.abs(dx) > 0.5 ? c : b) * sz);
        d.position.set(x, y, zz);
        d.lookAt(x + dx, y + dy, zz + dz);
        d.updateMatrix();
        w.mesh.setMatrixAt(i, d.matrix);
      }
      w.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Update moving obstacles for round time `tick` (fractional ticks allowed). */
  update(tick: number, focus: THREE.Vector3) {
    const t = tick * DT;
    const w = this.world;
    for (const m of this.moving) {
      const b = m.body, d = b.def;
      const active = w.isActive(b, Math.floor(tick));
      // Late hazards flash as a ghost for 2 s before they become solid.
      const ghost = !active && d.activeFrom !== undefined && t > d.activeFrom - 2 && t < d.activeFrom;
      m.mesh.visible = active || ghost;
      if (!active && !ghost) continue;
      w.pose(b, tick, P, R);
      let ox = 0, oz = 0, opacity = m.baseOpacity;
      // Warnings: tiles shake before dropping; cycling bridges blink before vanishing.
      if (d.trigger) {
        const tt = w.triggered.get(b.id);
        if (tt !== undefined) {
          const since = t - tt * DT;
          if (since < d.trigger.delay) { const a = 0.06 * (since / d.trigger.delay); ox = Math.sin(t * 60) * a; oz = Math.cos(t * 53) * a; }
          const mat = m.mesh.material as THREE.MeshStandardMaterial;
          mat.emissive.setHex(0xff3355); mat.emissiveIntensity = Math.min(0.6, since * 0.8);
          const ft = w.fallTime(b, t);
          if (ft > 0) opacity = Math.max(0, 1 - ft / 2.5);
        } else { const mat = m.mesh.material as THREE.MeshStandardMaterial; mat.emissiveIntensity = 0; }
      }
      if (d.fallAt !== undefined) {
        const until = d.fallAt - t;
        if (until < 2 && until > 0) { const a = 0.08 * (1 - until / 2); ox = Math.sin(t * 50) * a; oz = Math.cos(t * 41) * a; }
        const mat = m.mesh.material as THREE.MeshStandardMaterial;
        mat.emissive.setHex(0xff2200); mat.emissiveIntensity = until < 2 && until > -3 ? Math.min(0.8, (2 - until) * 0.35) : 0;
        const ft = w.fallTime(b, t);
        if (ft > 0) opacity = Math.max(0, 1 - ft / 2.5);
      }
      if (ghost) opacity = Math.sin(t * 14) > 0 ? 0.45 : 0.15;
      if (d.activeFrom !== undefined && (ghost || t - d.activeFrom < 0.3)) (m.mesh.material as THREE.MeshStandardMaterial).transparent = true;
      if (d.cycle) {
        const c = d.cycle, per = c.on + c.off;
        const u = (((t + c.phase) % per) + per) % per;
        const warn = c.warn ?? 1;
        if (u > c.on - warn) opacity = Math.sin(t * 22) > 0 ? 0.35 : 0.85;
        else if (u < 0.25) opacity = u / 0.25;
      }
      const mat = m.mesh.material as THREE.MeshStandardMaterial;
      if (mat.opacity !== opacity) { mat.opacity = opacity; mat.depthWrite = opacity > 0.95; }
      MAT4.set(R[0], R[1], R[2], P.x + ox, R[3], R[4], R[5], P.y, R[6], R[7], R[8], P.z + oz, 0, 0, 0, 1);
      m.mesh.matrix.copy(MAT4);
      m.mesh.matrixWorldNeedsUpdate = true;
    }
    const col = new THREE.Color();
    for (const g of this.tiles) {
      let colorDirty = false;
      g.bodies.forEach((b, i) => {
        const d = b.def;
        if (!w.isActive(b, Math.floor(tick))) { MAT4.makeScale(0, 0, 0); g.mesh.setMatrixAt(i, MAT4); return; }
        w.pose(b, tick, P, R);
        const tt = w.triggered.get(b.id);
        let ox = 0, oz = 0, k = 1, tint = 0;
        if (tt !== undefined) {
          const since = t - tt * DT;
          tint = Math.min(1, since / d.trigger!.delay);
          if (since < d.trigger!.delay) { const a = 0.07 * tint; ox = Math.sin(t * 60 + i) * a; oz = Math.cos(t * 53 + i) * a; }
          const ft = w.fallTime(b, t);
          if (ft > 0) k = Math.max(0.05, 1 - ft / 2.2);
        }
        MAT4.set(R[0] * k, R[1] * k, R[2] * k, P.x + ox, R[3] * k, R[4] * k, R[5] * k, P.y, R[6] * k, R[7] * k, R[8] * k, P.z + oz, 0, 0, 0, 1);
        g.mesh.setMatrixAt(i, MAT4);
        const q = Math.round(tint * 20) / 20;
        if (g.tint[i] !== q) { g.tint[i] = q; col.setRGB(1, 1 - q * 0.55, 1 - q * 0.5); g.mesh.setColorAt(i, col); colorDirty = true; }
      });
      g.mesh.instanceMatrix.needsUpdate = true;
      if (colorDirty && g.mesh.instanceColor) g.mesh.instanceColor.needsUpdate = true;
    }
    if (this.killPlane) this.killPlane.position.y = killHeight(w.map, t) - 0.6;
    this.updateWind(t);
    // Shadow camera follows the focus point (snapped to reduce shimmer).
    const snap = 0.5;
    const fx = Math.round(focus.x / snap) * snap, fz = Math.round(focus.z / snap) * snap;
    this.sun.target.position.set(fx, focus.y, fz);
    const th = w.map.theme;
    this.sun.position.set(fx + th.sunDir.x * 60, focus.y + th.sunDir.y * 60, fz + th.sunDir.z * 60);
    this.sky.position.set(focus.x, 0, focus.z);
    for (const d of this.decorAnim) {
      if (d.kind === 'balloon') d.obj.position.y = d.base + Math.sin(t * 0.9 + d.base) * 0.6;
      else if (d.kind === 'cloud') d.obj.position.x = d.base + Math.sin(t * 0.05 + d.base) * 6;
      else if (d.kind === 'flag') d.obj.rotation.y = Math.sin(t * 3 + d.base) * 0.25;
    }
  }

  // ------------------------------------------------------------ decor

  private buildDecor(map: MapDef, detail: number, shadows: boolean) {
    const byKind = new Map<string, DecorDef[]>();
    for (const d of map.decor) {
      if (detail === 0 && (d.kind === 'cloud' || d.kind === 'balloon') && Math.random() < 0.5) continue;
      const l = byKind.get(d.kind) ?? [];
      l.push(d); byKind.set(d.kind, l);
    }
    for (const [kind, list] of byKind) {
      const proto = decorGeometry(kind);
      if (!proto) continue;
      const animated = kind === 'balloon' || kind === 'cloud' || kind === 'flag';
      if (animated || kind === 'arch' || kind === 'tower' || kind === 'banner') {
        for (const d of list) {
          const g = kind === 'arch' ? archGeometry(d.color ?? 0xff6fb5) : proto;
          const mesh = new THREE.Mesh(g, kind === 'cloud' ? cloudMat : decorMat(d.color));
          mesh.position.set(d.pos.x, d.pos.y, d.pos.z);
          mesh.scale.setScalar(d.scale ?? 1);
          mesh.rotation.y = d.yaw ?? 0;
          mesh.castShadow = shadows && kind !== 'cloud';
          this.group.add(mesh);
          if (animated) this.decorAnim.push({ obj: mesh, kind, base: kind === 'cloud' ? d.pos.x : kind === 'flag' ? d.pos.z : d.pos.y });
        }
        continue;
      }
      const inst = new THREE.InstancedMesh(proto, decorMat(), list.length);
      const dummy = new THREE.Object3D();
      list.forEach((d, i) => {
        dummy.position.set(d.pos.x, d.pos.y, d.pos.z);
        dummy.rotation.set(0, d.yaw ?? (i * 2.39996) % (Math.PI * 2), 0);
        dummy.scale.setScalar(d.scale ?? 1);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      });
      inst.castShadow = shadows && kind !== 'island';
      inst.receiveShadow = shadows;
      this.group.add(inst);
    }
  }

  dispose() {
    for (const g of this.owned) g.dispose();
    for (const m of this.moving) if (m.mesh.material !== patMat(matOpts(m.body.def)!)) (m.mesh.material as THREE.Material).dispose();
    this.sky.geometry.dispose();
    (this.sky.material as THREE.Material).dispose();
  }
}

// ---------------------------------------------------------------- decor geometry (vertex coloured)

const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 });
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.25, transparent: true, opacity: 0.95 });
const tintMats = new Map<number, THREE.Material>();
function decorMat(color?: number): THREE.Material {
  if (color === undefined) return vcMat;
  let m = tintMats.get(color);
  if (!m) { m = new THREE.MeshStandardMaterial({ vertexColors: true, color: lighten(color, 0), roughness: 0.5 }); tintMats.set(color, m); }
  return m;
}

function colored(g: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0): THREE.BufferGeometry {
  const out = (g.index ? g.toNonIndexed() : g.clone());
  out.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(sx, sy, sz)));
  const n = out.attributes.position.count;
  const c = new THREE.Color(color);
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  out.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') out.deleteAttribute(k);
  return out;
}

const SPH = new THREE.SphereGeometry(1, 14, 10), CYL = new THREE.CylinderGeometry(1, 1, 1, 14), CONE = new THREE.ConeGeometry(1, 1, 14), ICO = new THREE.IcosahedronGeometry(1, 0);
const decorCache = new Map<string, THREE.BufferGeometry | null>();

function decorGeometry(kind: string): THREE.BufferGeometry | null {
  if (decorCache.has(kind)) return decorCache.get(kind)!;
  let parts: THREE.BufferGeometry[] = [];
  switch (kind) {
    case 'tree':
      parts = [colored(CYL, 0x8a5a3c, 0, 1.2, 0, 0.3, 2.4, 0.3), colored(SPH, 0x4cc96a, 0, 3.2, 0, 1.6, 1.4, 1.6), colored(SPH, 0x6fe08a, 0.6, 3.9, 0.3, 1.0, 0.9, 1.0), colored(SPH, 0x39b35a, -0.7, 3.5, -0.4, 1.0, 0.9, 1.0)];
      break;
    case 'pine':
      parts = [colored(CYL, 0x7a4a2c, 0, 0.8, 0, 0.3, 1.6, 0.3), colored(CONE, 0x2f8f6a, 0, 2.4, 0, 1.6, 2.2, 1.6), colored(CONE, 0x3aa77c, 0, 3.6, 0, 1.2, 1.8, 1.2), colored(CONE, 0xffffff, 0, 4.4, 0, 0.6, 0.8, 0.6)];
      break;
    case 'cloud':
      parts = [colored(SPH, 0xffffff, 0, 0, 0, 2.2, 1.4, 1.8), colored(SPH, 0xffffff, 1.8, -0.3, 0.2, 1.6, 1.1, 1.4), colored(SPH, 0xffffff, -1.9, -0.3, -0.1, 1.5, 1.0, 1.3), colored(SPH, 0xffffff, 0.6, 0.8, 0, 1.4, 1.1, 1.2)];
      break;
    case 'island':
      parts = [colored(CONE, 0x8b6a4e, 0, -2.5, 0, 4, 5, 4, Math.PI), colored(CYL, 0x5fd16f, 0, 0, 0, 4.2, 0.6, 4.2), colored(ICO, 0x9a7a5e, 1.5, -3.5, 1, 1.2, 1.2, 1.2)];
      break;
    case 'balloon':
      parts = [colored(SPH, 0xffffff, 0, 0, 0, 0.9, 1.1, 0.9), colored(CONE, 0xffffff, 0, -1.1, 0, 0.18, 0.25, 0.18, Math.PI), colored(CYL, 0xeeeeee, 0, -2.2, 0, 0.02, 2, 0.02)];
      break;
    case 'flag':
      parts = [colored(CYL, 0xf4f4f4, 0, 1.5, 0, 0.06, 3, 0.06), colored(new THREE.BoxGeometry(1, 1, 1), 0xffffff, 0, 2.6, 0.5, 0.04, 0.6, 1)];
      break;
    case 'mushroom':
      parts = [colored(CYL, 0xfff1dc, 0, 0.8, 0, 0.35, 1.6, 0.35), colored(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xff4f6d, 0, 1.5, 0, 1.3, 0.9, 1.3), colored(SPH, 0xffffff, 0.5, 2.1, 0.4, 0.2, 0.15, 0.2)];
      break;
    case 'crystal':
      parts = [colored(new THREE.OctahedronGeometry(1, 0), 0x9fe6ff, 0, 1.5, 0, 0.6, 1.6, 0.6), colored(new THREE.OctahedronGeometry(1, 0), 0xc9b3ff, 0.7, 0.9, 0.2, 0.35, 1, 0.35)];
      break;
    case 'snowman':
      parts = [colored(SPH, 0xffffff, 0, 0.8, 0, 0.9, 0.85, 0.9), colored(SPH, 0xffffff, 0, 2, 0, 0.6, 0.6, 0.6), colored(CONE, 0xff8a3d, 0, 2.0, 0.65, 0.08, 0.4, 0.08, Math.PI / 2), colored(CYL, 0x222233, 0, 2.7, 0, 0.45, 0.06, 0.45), colored(CYL, 0x222233, 0, 2.95, 0, 0.3, 0.5, 0.3)];
      break;
    case 'rock':
      parts = [colored(ICO, 0x9aa0ad, 0, 0.6, 0, 1.2, 0.9, 1.0), colored(ICO, 0x7f8593, 0.9, 0.3, 0.4, 0.6, 0.5, 0.6)];
      break;
    case 'iceberg':
      parts = [colored(new THREE.OctahedronGeometry(1, 0), 0xe6f6ff, 0, 1, 0, 3, 3.5, 2.6), colored(new THREE.OctahedronGeometry(1, 0), 0xb9e4ff, 2, 0.5, 1, 1.6, 2, 1.4)];
      break;
    case 'volcano':
      parts = [colored(new THREE.CylinderGeometry(3, 14, 18, 18, 1, true), 0x5a3a34, 0, 9, 0), colored(new THREE.CylinderGeometry(3, 3, 0.5, 18), 0xff7a1a, 0, 17.8, 0)];
      break;
    case 'lamp':
      parts = [colored(CYL, 0x3a3f58, 0, 1.5, 0, 0.08, 3, 0.08), colored(SPH, 0xfff3c0, 0, 3.1, 0, 0.3, 0.3, 0.3)];
      break;
    case 'stands':
      for (let r = 0; r < 4; r++) parts.push(colored(new THREE.BoxGeometry(1, 1, 1), [0xff6fb5, 0x3f8cff, 0xffd23f, 0x5ad86a][r], 0, 0.5 + r * 0.8, -r * 1.2, 14, 0.8, 1.2));
      break;
    case 'tower':
      parts = [colored(new THREE.CylinderGeometry(1, 1, 1, 18, 1, true), 0xffffff, 0, 1.4, 0, 1.6, 3.5, 1.6), colored(new THREE.TorusGeometry(1, 0.2, 8, 24), 0xffffff, 0, -0.3, 0, 1.6, 1.6, 1.6, Math.PI / 2)];
      break;
    case 'banner':
      parts = [colored(new THREE.BoxGeometry(1, 1, 1), 0xffffff, 0, 0, 0, 6, 1.4, 0.2)];
      break;
    case 'arch':
      parts = [colored(SPH, 0xffffff, 0, 0, 0, 0.1, 0.1, 0.1)];
      break;
    case 'confetti-cannon':
      parts = [colored(CYL, 0x3a3f58, 0, 0.5, 0, 0.5, 1, 0.5), colored(CONE, 0xff6fb5, 0, 1.5, 0, 0.6, 1, 0.6, Math.PI)];
      break;
    default:
      parts = [];
  }
  const g = parts.length ? mergeGeometries(parts, false) : null;
  decorCache.set(kind, g);
  return g;
}

function archGeometry(color: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const torus = new THREE.TorusGeometry(8, 0.7, 12, 40, Math.PI);
  parts.push(colored(torus, color, 0, 0, 0));
  parts.push(colored(new THREE.TorusGeometry(8, 0.72, 12, 40, Math.PI), 0xffffff, 0, 0, 0, 1, 1, 0.3));
  parts.push(colored(CYL, shade(color, 0.8), -8, -0.5, 0, 0.9, 1, 0.9));
  parts.push(colored(CYL, shade(color, 0.8), 8, -0.5, 0, 0.9, 1, 0.9));
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI;
    parts.push(colored(SPH, [0xffd23f, 0xff6fb5, 0x3f8cff][i % 3], Math.cos(a) * 8, Math.sin(a) * 8, 0.7, 0.35, 0.35, 0.35));
  }
  return mergeGeometries(parts, false)!;
}

