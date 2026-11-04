/* Neon Rush · shared constants, uniforms and the world fog (Lane Rush copy: the ShaderChunk fog patch is left out,
   Lane Rush's own materials keep three's fog; the Neon Rush worlds' shaders use FOG_GLSL with these uniforms).
   The car stays at z = 0 and the world slides past it, so every position stays small and
   floating point never jitters, however far you drive. */
import * as THREE from 'three';

export const LANE = 3.4;
export const LANES = [-LANE, 0, LANE];
export const ROAD_HALF = 7.6;         // deck half width, parapet to parapet
export const SUN_DIR = new THREE.Vector3(0, .085, -1).normalize();
export const TILE = 1024;
/* phones and tablets: the hints talk about swipes and taps. iPadOS reports itself as a Mac, so touch decides there */
export const PHONE = /iPhone|iPad|iPod|Android|Mobi/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ''));             // scroll wraps here: every road pattern repeats on a divisor of it

/* Uniforms shared by all custom shaders. uDist holds distance mod TILE so it keeps full precision. */
export const U = {
  uTime: { value: 0 },
  uDist: { value: 0 },
  uFogColor: { value: new THREE.Color(.72, .28, .34) },
  uFogDensity: { value: .00078 },
  uSkyTint: { value: new THREE.Color(1, 1, 1) },
  uNight: { value: 0 },
  uBoost: { value: 0 },
  uFlip: { value: 0 },
  uZoom: { value: 1 },
  uArena: { value: -1e5 },   // where the stadium's pitch centre is, so its markings move with the stands        // the horizon slowly nearing as you drive
  uKind: { value: 0 },        // which ground: 0 earth, 1 orbit glass, 2 sea sand, 3 rain, 4 ice, 6 stadium, 7 brain, 8 candy, 9 volcano, 10 cloud
  uPaintTint: { value: new THREE.Color(1, 1, 1) },
  uFlipE: { value: new THREE.Color(.95, .10, .80) }, uFlipM: { value: new THREE.Color(.46, .16, .98) }, uFlipF: { value: new THREE.Color(.08, .66, .96) },   // the pearl, edge-on to face-on: the paint job
  uLamp: { value: 1 },
  uCarX: { value: 0 },
  uCarY: { value: 0 },
  uCarRoll: { value: 0 },
  uHover: { value: 1 },       // 1 for a hover car, 0 for the runner: no disc light or turbine wash under him
};

/* Fog that glows toward the sun, patched into every built-in material before any compile. */
const fogGlsl = `
  vec3 fogMix(vec3 col, vec3 fogCol, float density, float depth, vec3 viewRay){
    vec3 fd = normalize(transpose(mat3(viewMatrix)) * viewRay);
    float f = 1. - exp(-density*density*depth*depth);
    float s = pow(max(dot(fd, normalize(vec3(0., .085, -1.))), 0.), 12.);
    return mix(col, fogCol*(1. + s*2.4), f);
  }`;
export const FOG_GLSL = fogGlsl;

/* one random texture shared by every shader that needs noise */
let sharedNoise = null;
export function noiseTexture(){
  if (sharedNoise) return sharedNoise;
  const n = 256, d = new Uint8Array(n*n*4);
  for (let i = 0; i < d.length; i++) d[i] = Math.random()*255;
  const t = sharedNoise = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

/* Makes a painted backdrop flow forever: two copies slide along dir and cross-fade, so it never runs out of picture */
export const FLOW_GLSL = `
  uniform sampler2D tN;
  vec2 drift(vec2 uv, float t, float amt){
    return (textureLod(tN, uv*.055 + t*vec2(.0021, .0013), 1.).rg + textureLod(tN, uv*.16 - t*vec2(.0017, .0026), 1.).rg - 1.)*amt;
  }
  vec3 flowSky(sampler2D map, vec2 uv, vec2 dir, float t, float amt){
    float p1 = fract(t*.07), p2 = fract(p1 + .5);
    vec2 w = drift(uv, t, amt);
    vec3 a = textureLod(map, uv + w + dir*(p1 - .5), 0.).rgb, b = textureLod(map, uv + w*.7 + dir*(p2 - .5), 0.).rgb;
    return mix(a, b, abs(2.*p1 - 1.));
  }`;

export const damp = (a, b, k, dt) => b + (a - b)*Math.exp(-k*dt);
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a)*t;
export const smooth = (a, b, v) => { const t = clamp((v - a)/(b - a), 0, 1); return t*t*(3 - 2*t); };

/* mulberry32: same seed, same run */
export function seeded(seed){
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; };
}

export const texLoader = new THREE.TextureLoader();
export const loadTex = (path, { srgb = true, repeat = false, aniso = 8 } = {}) => new Promise((ok, fail) => {
  texLoader.load(path, t => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.anisotropy = aniso;
    ok(t);
  }, undefined, fail);
});
