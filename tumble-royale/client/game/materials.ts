// Procedural materials: one shared MeshStandardMaterial shader extended with
// pattern functions evaluated in object-local metres, so stripes, checkers and
// chevrons look right at any size with no textures to download.

import * as THREE from 'three';

export const time = { value: 0 };

export enum Pat {
  Solid = 0, StripesZ = 1, Checker = 2, Hazard = 3, Dots = 4, Chevron = 5, Radial = 6, BandsY = 7, Conveyor = 8, Ice = 9, Glow = 10, Spiral = 11,
}

export interface PatOpts {
  color: number;
  color2?: number;
  side?: number;
  pattern?: Pat;
  scale?: number;
  /** Pattern on every face (otherwise top faces only; sides get `side`). */
  allSides?: boolean;
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  flatShading?: boolean;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

export function patMat(o: PatOpts): THREE.MeshStandardMaterial {
  const key = JSON.stringify(o);
  const hit = cache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({
    color: o.color, roughness: o.roughness ?? 0.5, metalness: o.metalness ?? 0.02,
    emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 1,
    transparent: o.transparent ?? false, opacity: o.opacity ?? 1, flatShading: o.flatShading ?? false,
  });
  const pattern = o.pattern ?? Pat.Solid;
  const uniforms = {
    uC2: { value: new THREE.Color(o.color2 ?? o.color) },
    uSide: { value: new THREE.Color(o.side ?? shade(o.color, 0.82)) },
    uPat: { value: pattern },
    uScale: { value: o.scale ?? 1.5 },
    uAll: { value: o.allSides ? 1 : 0 },
    uTime: time,
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLP;\nvarying vec3 vLN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;\nvLN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vLP;
varying vec3 vLN;
uniform vec3 uC2;
uniform vec3 uSide;
uniform int uPat;
uniform float uScale;
uniform int uAll;
uniform float uTime;
float aaStep(float e, float x) { float w = fwidth(x) * 0.75 + 1e-4; return smoothstep(e - w, e + w, x); }
vec3 patColor(vec3 c1, vec3 p) {
  float s = uScale;
  if (uPat == 1) { float f = fract(p.z / s); return mix(c1, uC2, aaStep(0.5, f) * (1.0 - aaStep(0.98, f))); }
  if (uPat == 2) { vec2 q = floor(p.xz / s); float k = mod(q.x + q.y, 2.0); return mix(c1, uC2, k); }
  if (uPat == 3) { float f = fract((p.x + p.z + p.y) / s); return mix(c1, uC2, aaStep(0.5, f)); }
  if (uPat == 4) { vec2 g = fract(p.xz / s) - 0.5; float d = length(g); return mix(uC2, c1, aaStep(0.22, d)); }
  if (uPat == 5) { float f = fract(p.z / s - abs(p.x) / s * 0.9 - uTime * 1.6); return mix(c1, uC2, aaStep(0.55, f)); }
  if (uPat == 6) { float a = atan(p.z, p.x) / 6.2831853 * 10.0; return mix(c1, uC2, aaStep(0.5, fract(a))); }
  if (uPat == 7) { float f = fract(p.y / s); return mix(c1, uC2, aaStep(0.5, f)); }
  if (uPat == 8) { float f = fract(p.z / s + uTime * 1.2); return mix(c1, uC2, aaStep(0.5, f)); }
  if (uPat == 9) { float n = sin(p.x * 1.7 + p.z * 0.9) * sin(p.z * 2.3 - p.x * 0.6); return mix(c1, uC2, smoothstep(0.55, 0.95, n)); }
  if (uPat == 10) { return c1 * (0.85 + 0.15 * sin(uTime * 4.0 + p.y * 3.0)); }
  if (uPat == 11) { float a = atan(p.z, p.x) / 6.2831853 * 6.0 + length(p.xz) / s; return mix(c1, uC2, aaStep(0.5, fract(a))); }
  return c1;
}`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
vec3 baseC = patColor(diffuse, vLP);
float topness = uAll == 1 ? 1.0 : smoothstep(0.45, 0.8, vLN.y);
vec4 diffuseColor = vec4(mix(uSide, baseC, topness), opacity);`);
  };
  m.customProgramCacheKey = () => 'pat';
  cache.set(key, m);
  return m;
}

export function shade(hex: number, k: number): number {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k);
  return c.getHex();
}

export function lighten(hex: number, k: number): number {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(0xffffff), k);
  return c.getHex();
}

const basic = new Map<string, THREE.Material>();
export function std(color: number, roughness = 0.55, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  const key = color + ':' + roughness + JSON.stringify(extra);
  let m = basic.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02, ...extra }); basic.set(key, m); }
  return m;
}

/** Character body: bean with outfit patterns painted procedurally in the shader. */
export interface BodyOpts { color: number; color2?: number; outfit: number; o1: number; o2: number }

export function bodyMaterial(o: BodyOpts): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.42, metalness: 0.02 });
  const uniforms = {
    uBody2: { value: new THREE.Color(o.color2 ?? o.color) },
    uO1: { value: new THREE.Color(o.o1) },
    uO2: { value: new THREE.Color(o.o2) },
    uOutfit: { value: o.outfit },
    uGrad: { value: o.color2 !== undefined ? 1 : 0 },
    uTime: time,
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vLP;
uniform vec3 uBody2; uniform vec3 uO1; uniform vec3 uO2; uniform int uOutfit; uniform int uGrad; uniform float uTime;
float aaS(float e, float x) { float w = fwidth(x) * 0.75 + 1e-4; return smoothstep(e - w, e + w, x); }
vec3 outfit(vec3 skin) {
  float y = vLP.y; float a = atan(vLP.x, vLP.z); // a = 0 is the front
  vec3 c = skin;
  if (uGrad == 1) {
    c = mix(uBody2, skin, smoothstep(0.1, 1.2, y));
    float sp = step(0.985, fract(sin(dot(floor(vLP.xy * 26.0), vec2(12.9898, 78.233))) * 43758.5453));
    c = mix(c, vec3(1.0), sp * 0.9);
  }
  if (uOutfit == 1) { // stripes
    float f = fract(y * 4.2); c = mix(c, uO1, aaS(0.5, f) * (1.0 - aaS(0.86, y)));
  } else if (uOutfit == 2) { // polka dots
    vec2 q = vec2(a * 2.2, y * 4.5); vec2 g = fract(q) - 0.5; c = mix(uO1, c, aaS(0.2, length(g)));
  } else if (uOutfit == 3) { // overalls
    float pants = 1.0 - aaS(0.58, y);
    float strap = (1.0 - aaS(0.12, abs(abs(a) - 0.55))) * (1.0 - aaS(0.95, y)) * aaS(0.5, y);
    c = mix(c, uO1, max(pants, strap));
    float btn = 1.0 - aaS(0.045, length(vec2(abs(a) - 0.55, y - 0.66) * vec2(0.45, 1.0)));
    c = mix(c, vec3(1.0, 0.85, 0.2), btn);
  } else if (uOutfit == 4) { // tuxedo
    float suit = 1.0 - aaS(0.82, y);
    c = mix(c, uO1, suit);
    float shirt = (1.0 - aaS(0.28 - (0.82 - y) * 0.25, abs(a))) * suit * aaS(0.25, y);
    c = mix(c, uO2, shirt);
    float tie = (1.0 - aaS(0.05, abs(a))) * aaS(0.45, y) * (1.0 - aaS(0.8, y));
    c = mix(c, vec3(0.08), tie);
  } else if (uOutfit == 5) { // super suit
    c = mix(c, uO1, 1.0 - aaS(0.86, y));
    float belt = (1.0 - aaS(0.05, abs(y - 0.42)));
    c = mix(c, uO2, belt);
    float emblem = 1.0 - aaS(0.14, length(vec2(a * 0.45, y - 0.66)));
    c = mix(c, uO2, emblem);
  } else if (uOutfit == 6) { // ninja wrap: dark suit, skin band at the eyes
    float band = (1.0 - aaS(0.13, abs(y - 1.04)));
    c = mix(uO1, c, band);
    float sash = 1.0 - aaS(0.04, abs(y - 0.45 - a * 0.05));
    c = mix(c, vec3(0.85, 0.12, 0.15), sash);
  } else if (uOutfit == 7) { // astro suit
    c = mix(c, uO1, 1.0 - aaS(0.8, y));
    float st = (1.0 - aaS(0.05, abs(y - 0.55))) + (1.0 - aaS(0.05, abs(y - 0.3)));
    c = mix(c, uO2, clamp(st, 0.0, 1.0));
    float patchM = 1.0 - aaS(0.08, length(vec2((a - 0.5) * 0.42, y - 0.68)));
    c = mix(c, vec3(0.2, 0.45, 1.0), patchM);
  }
  return c;
}`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( outfit(diffuse), opacity );');
  };
  m.customProgramCacheKey = () => 'bean';
  return m;
}

/** Vertical gradient sky dome with a soft sun glow. */
export function skyMaterial(top: number, bottom: number, sunDir: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(top) }, uBottom: { value: new THREE.Color(bottom) }, uSun: { value: sunDir.clone().normalize() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uSun; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 c = mix(uBottom, uTop, smoothstep(0.42, 0.95, h));
        float s = max(dot(normalize(vDir), uSun), 0.0);
        c += vec3(1.0, 0.95, 0.8) * (pow(s, 300.0) * 1.5 + pow(s, 12.0) * 0.18);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/** Animated floor: water, lava, clouds or snow. */
export function floorMaterial(kind: string, color: number): THREE.Material {
  const isLava = kind === 'lava';
  const m = new THREE.ShaderMaterial({
    transparent: kind === 'clouds', fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: new THREE.Color(color) }, uTime: time, uKind: { value: ['water', 'lava', 'clouds', 'snow', 'void'].indexOf(kind) } }]),
    vertexShader: `#include <common>
      #include <fog_pars_vertex>
      varying vec2 vW; uniform float uTime; uniform int uKind;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xz;
        if (uKind == 0 || uKind == 1) wp.y += sin(wp.x * 0.18 + uTime * 1.2) * 0.25 + cos(wp.z * 0.21 + uTime) * 0.25;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <fog_pars_fragment>
      uniform vec3 uColor; uniform float uTime; uniform int uKind; varying vec2 vW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
      void main(){
        vec3 c = uColor; float a = 1.0;
        if (uKind == 0) {
          float n = noise(vW * 0.15 + uTime * 0.15) * 0.6 + noise(vW * 0.5 - uTime * 0.25) * 0.4;
          c = mix(uColor * 0.75, uColor * 1.15 + 0.05, n);
          c += vec3(1.0) * smoothstep(0.78, 0.92, noise(vW * 0.9 + vec2(uTime * 0.3, -uTime * 0.2))) * 0.45;
        } else if (uKind == 1) {
          float n = noise(vW * 0.12 + uTime * 0.08) * 0.6 + noise(vW * 0.4 - uTime * 0.18) * 0.4;
          c = mix(vec3(0.85, 0.12, 0.02), vec3(1.0, 0.75, 0.15), smoothstep(0.35, 0.85, n));
          c *= 1.4;
        } else if (uKind == 2) {
          float n = noise(vW * 0.05 + uTime * 0.02) * 0.6 + noise(vW * 0.17 - uTime * 0.03) * 0.4;
          c = mix(uColor * 0.85, vec3(1.0), n);
        } else if (uKind == 3) {
          float n = noise(vW * 0.3);
          c = mix(uColor * 0.9, vec3(1.0), n * 0.6);
        }
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  void isLava;
  return m;
}
