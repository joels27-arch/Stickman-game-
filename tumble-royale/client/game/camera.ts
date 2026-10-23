// Third-person follow camera: user-controlled orbit, smooth vertical damping,
// gentle re-alignment with the course, wall avoidance and a flyover for intros.

import * as THREE from 'three';
import { angleDiff, clamp, m3, v3 } from '../../shared/math';
import { type Body, rayBody, type World } from '../../shared/world';

const P = v3(), O = v3(), D = v3();
const R = m3();

export class FollowCamera {
  yaw = 0;
  pitch = 0.36;
  dist = 7.6;
  private tx = 0; private ty = 0; private tz = 0;
  private curDist = 7.6;
  private initialized = false;
  private shake = 0;

  constructor(readonly cam: THREE.PerspectiveCamera) {}

  reset(x: number, y: number, z: number, yaw: number) {
    this.tx = x; this.ty = y; this.tz = z; this.yaw = yaw; this.pitch = 0.36; this.initialized = true; this.curDist = this.dist;
  }

  addShake(a: number) { this.shake = Math.min(0.5, this.shake + a); }

  update(dt: number, focus: THREE.Vector3, input: { dx: number; dy: number }, opts: { world: World | null; blockers: Body[]; courseYaw: number | null; camIdle: number; speed: number; tick: number }) {
    if (!this.initialized) this.reset(focus.x, focus.y, focus.z, opts.courseYaw ?? 0);
    this.yaw -= input.dx;
    this.pitch = clamp(this.pitch + input.dy, -0.15, 1.15);
    // Gently drift back behind the course direction when the player isn't steering the camera.
    if (opts.courseYaw !== null && opts.camIdle > 2.2 && opts.speed > 1.5) {
      const d = angleDiff(this.yaw, opts.courseYaw);
      if (Math.abs(d) < 1.8) this.yaw += d * (1 - Math.exp(-dt * 0.9));
    }
    const kxz = 1 - Math.exp(-dt * 16);
    const dy = focus.y - this.ty;
    const ky = 1 - Math.exp(-dt * (Math.abs(dy) > 2.5 ? 10 : 5.5));
    this.tx += (focus.x - this.tx) * kxz;
    this.tz += (focus.z - this.tz) * kxz;
    this.ty += dy * ky;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const look = new THREE.Vector3(this.tx + fx * 1.6, this.ty + 1.25, this.tz + fz * 1.6);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    // Wall avoidance: cast from the look point back toward the desired camera spot.
    let want = this.dist;
    if (opts.world) {
      O.x = this.tx; O.y = this.ty + 1.4; O.z = this.tz;
      D.x = -fx * cp; D.y = sp; D.z = -fz * cp;
      for (const b of opts.blockers) {
        if (!opts.world.isActive(b, opts.tick)) continue;
        opts.world.pose(b, opts.tick, P, R);
        const h = rayBody(b, P, R, O, D, want, 0.25);
        if (h < want) want = Math.max(1.6, h - 0.2);
      }
    }
    this.curDist += (want - this.curDist) * (want < this.curDist ? 1 - Math.exp(-dt * 25) : 1 - Math.exp(-dt * 3));
    const d = this.curDist;
    this.cam.position.set(this.tx - fx * cp * d, this.ty + 1.4 + sp * d, this.tz - fz * cp * d);
    if (this.shake > 0.001) {
      this.cam.position.x += (Math.random() - 0.5) * this.shake;
      this.cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-dt * 9);
    }
    this.cam.lookAt(look);
  }

  /** Intro flyover along a path (from the end back to the start), u in 0..1. */
  flyover(path: THREE.Vector3[], u: number, spawn: THREE.Vector3, spawnYaw: number) {
    if (path.length < 2) return;
    const total = path.length - 1;
    const e = u < 0.85 ? (u / 0.85) : 1;
    const s = (1 - e) * total;
    const i = Math.min(total - 1, Math.floor(s));
    const f = s - i;
    const a = path[i], b = path[i + 1];
    const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f, z = a.z + (b.z - a.z) * f;
    const fx = Math.sin(spawnYaw), fz = Math.cos(spawnYaw);
    if (u < 0.85) {
      this.cam.position.set(x - fx * 10 + Math.sin(u * 6) * 4, y + 9, z - fz * 10);
      this.cam.lookAt(x + fx * 6, y, z + fz * 6);
    } else {
      // settle behind the spawn
      const k = (u - 0.85) / 0.15;
      const px = spawn.x - fx * this.dist, pz = spawn.z - fz * this.dist, py = spawn.y + 1.4 + Math.sin(this.pitch) * this.dist;
      this.cam.position.lerp(new THREE.Vector3(px, py, pz), k);
      this.cam.lookAt(spawn.x + fx * 1.6, spawn.y + 1.25, spawn.z + fz * 1.6);
    }
    this.reset(spawn.x, spawn.y, spawn.z, spawnYaw);
  }
}
