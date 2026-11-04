/* Neon Rush · the worlds of Pixel World, Jungle Temple, Valley of the Kings and Uranus (models: tools/build_maps3.py). */
import * as THREE from 'three';
import { U, FOG_GLSL, seeded } from './shared.js';
import { simpleSky, particles, geos, C } from './maps.js';

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(), K = new THREE.Color();

/* one instanced draw per material of a model, placed from a list of { x, y, z, s, sx, sz, rx, ry, rz, c } */
function place(models, name, mats, list, parent, reflect = true){
  for (const g of geos(models, name)){
    const im = new THREE.InstancedMesh(g.geometry, mats[g.name] || mats.default, list.length);
    list.forEach((l, i) => {
      Q.setFromEuler(E.set(l.rx || 0, l.ry || 0, l.rz || 0));
      S.set(l.sx || l.s, l.s, l.sz || l.s);
      M.compose(P.set(l.x, l.y, l.z), Q, S); im.setMatrixAt(i, M);
      im.setColorAt(i, K.copy(l.c || WHITE));
    });
    im.frustumCulled = false; if (reflect) im.layers.enable(1);
    parent.add(im);
  }
}
const WHITE = new THREE.Color(1, 1, 1);

/* lay n copies on each side, scattered between lo and hi metres from the road, repeating every L metres */
function lay(r, L, n, lo, hi, sLo, sHi, y, extra){
  const out = [];
  for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++){
    const side = i % 2 ? 1 : -1;
    out.push({ x: side*(lo + r()*r()*(hi - lo)), y, z: -r()*L - c*L + 40, s: sLo + r()*(sHi - sLo), ry: r()*6.28, side, ...(extra ? extra(side) : {}) });
  }
  return out;
}
/* one copy every L/n metres over the road, for arches and gates */
const overRoad = (L, n, y = 0) => { const out = []; for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) out.push({ x: 0, y, z: -(i + .5)*L/n - c*L, s: 1 }); return out; };

/* a shader that takes the model's vertex and instance colours, a little sun and sky light, and the world fog.
   glow(): extra light the material gives off, in GLSL, from vUv, vP, vN and vC */
const VS = `varying vec2 vUv; varying vec3 vP; varying vec3 vN; varying vec3 vC; varying float vDepth; varying vec3 vRay; varying vec3 vWorld;
  void main(){
    vUv = uv; vP = position; vC = vec3(1.);
    #ifdef USE_COLOR
      vC = vec3(color.r, color.g, color.b);
    #endif
    #ifdef USE_INSTANCING_COLOR
      vC *= instanceColor;
    #endif
    #ifdef USE_INSTANCING
      mat4 m = modelMatrix*instanceMatrix;
    #else
      mat4 m = modelMatrix;
    #endif
    vN = normalize(mat3(m)*normal);
    vec4 w = m*vec4(position, 1.); vWorld = w.xyz;
    vec4 mv = viewMatrix*w; vDepth = -mv.z; vRay = mv.xyz; gl_Position = projectionMatrix*mv;
  }`;
function litMat({ sun = [1, .9, .8], sky = [.35, .4, .5], dir = [0, .4, -1], glow = 'vec3(0.)', alpha = '1.', extra = {}, transparent = false, blending = THREE.NormalBlending, side = THREE.FrontSide, vertexColors = true } = {}){
  return new THREE.ShaderMaterial({
    vertexColors, transparent, blending, side, depthWrite: !transparent, toneMapped: false,
    uniforms: { ...U, uSunC: { value: new THREE.Color(...sun) }, uSkyC: { value: new THREE.Color(...sky) }, uSunD: { value: new THREE.Vector3(...dir).normalize() }, ...extra },
    vertexShader: VS,
    fragmentShader: `varying vec2 vUv; varying vec3 vP; varying vec3 vN; varying vec3 vC; varying float vDepth; varying vec3 vRay; varying vec3 vWorld;
      uniform float uFogDensity, uTime; uniform vec3 uFogColor, uSunC, uSkyC, uSunD; ${Object.keys(extra).map(k => `uniform ${typeof extra[k].value === 'number' ? 'float' : 'vec3'} ${k};`).join(' ')}
      ${FOG_GLSL}
      void main(){
        vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
        // wrapped sun light so shapes facing away from a low sun keep their form, plus a sunlit rim on their edges
        float wrap = pow(max(dot(N, uSunD)*.5 + .5, 0.), 2.);
        float rim = pow(1. - max(dot(N, normalize(cameraPosition - vWorld)), 0.), 3.)*(.4 + .6*max(dot(normalize(vWorld - cameraPosition), uSunD), 0.));
        vec3 c = vC*(uSunC*wrap + uSkyC*(.55 + .45*N.y) + uSunC*rim*.6);
        c += ${glow};
        gl_FragColor = vec4(fogMix(c, uFogColor, uFogDensity, vDepth, vRay), ${alpha});
      }`,
  });
}

/* ---------- Pixel World ---------- */
export function makePixelWorld(scene, tPlate, models){
  const group = new THREE.Group(), r = seeded(41);
  // the pixel clouds drift, stripes roll down the 8-bit sun as it pulses, the pixel waterfalls ripple, the stars twinkle
  const sky = simpleSky(tPlate, .35, '(1.15 + 1.4*smoothstep(.8, 1., L))', {
    flow: 'vec2(.07, 0.)*smoothstep(.55, .72, uv.y)', amt: .03,
    post: `
      vec2 a = uv*vec2(2.33, 1.);
      float sun = smoothstep(.2, .14, distance(a, vec2(1.165, .47)));
      c *= 1. + sun*(.22 + .18*sin(uT*2.) + .25*step(.5, fract(uv.y*46. - uT*.9)));
      float water = smoothstep(.15, .45, c.b - max(c.r, c.g)*.9)*smoothstep(.36, .45, uv.y);
      c *= 1. + water*.45*sin(uv.y*240. + uT*9.);
      c *= 1. + (textureLod(tN, uv*7. + uT*.04, 0.).r - .5)*.9*smoothstep(.78, .92, uv.y)*(1. - smoothstep(.25, .6, L));`,
  });
  group.add(sky);
  const vox = litMat({ sun: [1.2, .8, .9], sky: [.5, .35, .7], dir: [0, .35, -1] });
  // blocks that light up: the white of each pixel is tinted per copy, far above 1 so it blooms
  const glow = new THREE.ShaderMaterial({ vertexColors: true, toneMapped: false, uniforms: { ...U },
    vertexShader: VS,
    fragmentShader: `varying vec2 vUv; varying vec3 vP; varying vec3 vN; varying vec3 vC; varying float vDepth; varying vec3 vRay; varying vec3 vWorld;
      uniform float uFogDensity, uTime; uniform vec3 uFogColor; ${FOG_GLSL}
      void main(){ float pulse = .75 + .25*sin(uTime*3. + vWorld.z*.05 + vWorld.x*.3); gl_FragColor = vec4(fogMix(vC*pulse, uFogColor, uFogDensity*.6, vDepth, vRay), 1.); }` });
  const far = new THREE.Group(), near = new THREE.Group(), H = 1200, L = 640;
  place(models, 'voxhill', { default: vox }, lay(r, H, 16, 50, 260, 2.4, 5.2, -2, () => ({ ry: Math.floor(r()*4)*Math.PI/2 })), far);
  place(models, 'voxisland', { default: vox }, lay(r, H, 7, 40, 160, 1.6, 3, 0, () => ({ y: 22 + r()*40, ry: r()*6.28 })), far);
  place(models, 'voxtree', { default: vox }, lay(r, L, 12, 11, 46, 1.1, 1.8, -.4, () => ({ ry: Math.floor(r()*4)*Math.PI/2 })), near);
  const tints = [C(4, .6, 2.6), C(.6, 3.2, 4), C(4, 3.2, .4), C(1, 4, .8)];
  place(models, 'pixcube', { default: glow }, lay(r, L, 14, 9, 30, .9, 1.5, 0, () => ({ y: 2.2 + r()*6, rx: r()*.6, ry: r()*6.28, c: tints[Math.floor(r()*4)] })), near);
  place(models, 'pixarch', { default: glow }, overRoad(L, 3).map(o => ({ ...o, c: C(2.2, 2.2, 2.2) })), near);
  group.add(far, near);
  group.add(particles({ n: 160, range: 20, fall: -.3, spread: 40, wobble: .5, w: .16, h: .16, multi: true }));
  group.visible = false; scene.add(group);
  return { group, sky, update(t, ds, dist){ sky.position.set(0, 3, 8); far.position.z = dist*.6 % H; near.position.z = dist % L; } };
}

/* ---------- Jungle Temple ---------- */
export function makeJungleWorld(scene, tPlate, models){
  const group = new THREE.Group(), r = seeded(52);
  // the waterfalls pour (only their white water moves down), clouds drift, the low sun and its rays breathe
  const sky = simpleSky(tPlate, .32, '(1.05 + 1.3*smoothstep(.75, 1., L))', {
    pre: `vec3 s0 = textureLod(tS, uv, 0.).rgb;
      float W = smoothstep(.5, .75, min(s0.r, min(s0.g, s0.b)))*smoothstep(.33, .42, uv.y)*smoothstep(.86, .7, uv.y)*smoothstep(.35, .15, abs(s0.r - s0.b));`,
    flow: 'vec2(.035, 0.)*smoothstep(.66, .82, uv.y) + vec2(0., .07)*W', amt: .02,
    post: `
      float sun = smoothstep(.55, .0, distance(uv*vec2(2.33, 1.), vec2(1.84, .82)));
      c *= 1. + sun*(.18 + .14*sin(uT*1.3)) + W*.25*(.5 + .5*sin(uv.x*300. + uT*4.));`,
  });
  group.add(sky);
  const plant = litMat({ sun: [1.3, 1.05, .6], sky: [.3, .42, .3], dir: [.3, .5, -1], side: THREE.DoubleSide });
  const stone = litMat({ sun: [1.3, 1.05, .65], sky: [.32, .38, .34], dir: [.3, .5, -1] });
  // a waterfall: white water racing down the sheet, brighter at its foot where it foams
  const water = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, uniforms: { ...U },
    vertexShader: VS,
    fragmentShader: `varying vec2 vUv; varying vec3 vP; varying vec3 vN; varying vec3 vC; varying float vDepth; varying vec3 vRay; varying vec3 vWorld;
      uniform float uFogDensity, uTime; uniform vec3 uFogColor; ${FOG_GLSL}
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1)))*43758.5); }
      void main(){
        vec2 p = vec2(vUv.x*18., vUv.y*6. - uTime*2.4);
        float streak = h(floor(vec2(p.x, 0.)))*.5 + .5*sin(p.y*3. + h(floor(vec2(p.x, 1.)))*9.);
        float edge = smoothstep(0., .12, vUv.x)*smoothstep(1., .88, vUv.x);
        float foam = smoothstep(.75, 1., vUv.y);
        vec3 c = mix(vec3(.55, .78, .8), vec3(1.6, 1.7, 1.6), clamp(streak*.6 + foam, 0., 1.));
        gl_FragColor = vec4(fogMix(c, uFogColor, uFogDensity, vDepth, vRay), edge*(.55 + .35*streak + foam*.3));
      }` });
  const far = new THREE.Group(), near = new THREE.Group(), H = 1400, L = 720;
  // the temple itself is painted into the backdrop: a modelled one in front of it only looked like a plain block
  place(models, 'jtree', { default: plant }, lay(r, H, 22, 22, 140, .9, 1.5, -1.5), far);
  place(models, 'falls', { default: water }, lay(r, H, 6, 46, 110, .8, 1.3, -2, side => ({ ry: side > 0 ? -Math.PI/2 : Math.PI/2 })), far, false);
  place(models, 'jpillar', { default: stone }, (() => { const o = []; for (let c = 0; c < 2; c++) for (let i = 0; i < 14; i++) o.push({ x: (i % 2 ? 1 : -1)*(8.6 + r()*2), y: -.2, z: -i*L/14 - c*L, s: .9 + r()*.4, ry: (i % 2 ? -1 : 1)*Math.PI/2, c: C(.7, .74, .62) }); return o; })(), near);
  place(models, 'fern', { default: plant }, lay(r, L, 28, 9, 34, 1, 2.2, -.4), near);
  place(models, 'jarch', { default: stone }, overRoad(L, 3, -.2).map(o => ({ ...o, c: C(.72, .76, .64) })), near);
  group.add(far, near);
  group.add(particles({ n: 140, range: 20, fall: -.05, spread: 36, wobble: 1.4, w: .07, h: .07, color: C(3, 2.4, .7) }));
  group.visible = false; scene.add(group);
  return { group, sky, update(t, ds, dist){ sky.position.set(0, 3, 8); far.position.z = dist*.7 % H; near.position.z = dist % L; } };
}

/* ---------- Valley of the Kings ---------- */
export function makeEgyptWorld(scene, tPlate, models){
  const group = new THREE.Group(), r = seeded(63);
  // the long clouds sweep across, the sun pulses, heat haze shimmers above the sand along the horizon
  const sky = simpleSky(tPlate, .38, '(1.08 + 2.*smoothstep(.75, 1., L))', {
    pre: 'uv.x += sin(uv.y*260. + uT*5.)*.0009*smoothstep(.36, .41, uv.y)*smoothstep(.5, .42, uv.y);',
    flow: 'vec2(.06, .008)*smoothstep(.5, .7, uv.y)', amt: .035,
    post: `
      float sun = smoothstep(.3, .0, distance(uv*vec2(2.33, 1.), vec2(1.165, .43)));
      c *= 1. + sun*(.3 + .22*sin(uT*1.6));`,
  });
  group.add(sky);
  // sandstone lit by the low sun; bands of hieroglyphs glow gold up the obelisks and gate towers (uv.y 0..1), the gold caps shine (uv 2)
  const stone = litMat({ sun: [2.2, 1.25, .62], sky: [.55, .45, .5], dir: [0, .22, -1],
    glow: `(vUv.x > 1.5 ? vec3(2.6, 1.7, .5)*(.7 + .3*sin(uTime*2.)) : vec3(1.5, .95, .25)*step(.001, vUv.y)*smoothstep(.02, .0, abs(fract(vUv.y*7.) - .5) - .035)*(.6 + .4*sin(uTime*2.2 + vUv.y*9.)))` });
  const plant = litMat({ sun: [1.8, 1.1, .55], sky: [.3, .32, .36], dir: [0, .22, -1], side: THREE.DoubleSide });
  const far = new THREE.Group(), near = new THREE.Group(), H = 1600, L = 720;
  // the pyramids are painted into the backdrop
  place(models, 'pharaoh', { default: stone }, (() => { const o = []; for (let c = 0; c < 2; c++) for (let i = 0; i < 6; i++){ const s = i % 2 ? 1 : -1; o.push({ x: s*(20 + r()*6), y: -.3, z: -i*L/6 - c*L - 30, s: 1.1, ry: s > 0 ? -Math.PI/2 : Math.PI/2 }); } return o; })(), near);
  place(models, 'obelisk', { default: stone }, (() => { const o = []; for (let c = 0; c < 2; c++) for (let i = 0; i < 10; i++) o.push({ x: (i % 2 ? 1 : -1)*(11 + r()*2), y: -.2, z: -i*L/10 - c*L, s: .8 + r()*.3 }); return o; })(), near);
  place(models, 'palm', { default: plant }, lay(r, L, 18, 14, 70, .8, 1.3, -.6), near);
  place(models, 'pylon', { default: stone }, overRoad(L, 2, -.2), near);
  group.add(far, near);
  // sand blowing across the road from the left
  group.add(particles({ n: 240, range: 22, fall: .05, spread: 40, wobble: 2.6, w: .12, h: .03, color: C(1.4, 1.05, .6) }));
  group.visible = false; scene.add(group);
  return { group, sky, update(t, ds, dist){ sky.position.set(0, 3, 8); far.position.z = dist*.5 % H; near.position.z = dist % L; } };
}

/* ---------- Uranus ---------- */
export function makeUranusWorld(scene, tPlate, models){
  const group = new THREE.Group(), r = seeded(74);
  // the planet turns, the nebula swirls, its pole's aurora pulses, sparkles run up the rings, stars and the far sun twinkle
  const sky = simpleSky(tPlate, .43, '(1.1 + 1.6*smoothstep(.8, 1., L))', {
    pre: `uv.y = min(.43 + q.y/.95, .995);                                  // above the picture: stars, never the planet again
      vec2 a = uv*vec2(2.33, 1.);
      float planet = smoothstep(.27, .24, distance(a, vec2(.58, .66)));`,
    flow: 'vec2(.05, 0.)*planet + vec2(.02, .006)*smoothstep(.5, .62, uv.y)*(1. - planet)', amt: .03,
    post: `
      float pole = smoothstep(.12, .0, distance(a, vec2(.44, .87)));
      c += c*pole*(.7 + .7*sin(uT*2.5));
      float ring = smoothstep(.025, .0, abs(uv.x - .37))*smoothstep(.45, .55, uv.y);
      c *= 1. + ring*.6*pow(.5 + .5*sin(uv.y*70. - uT*3.), 6.);
      c *= 1. + smoothstep(.06, .0, distance(a, vec2(2.15, .76)))*.5*sin(uT*3.1);
      c *= 1. + (textureLod(tN, uv*9. + uT*.05, 0.).r - .5)*1.2*(1. - planet)*(1. - smoothstep(.15, .5, L))*smoothstep(.5, .6, uv.y);`,
  });
  group.add(sky);
  // ice crystals: dark blue at heart, bright cyan to violet at the edges, a sparkle running up them
  const crystal = litMat({ sun: [.6, .8, 1], sky: [.08, .14, .26], dir: [.4, .3, -1],
    glow: `mix(vec3(.2, 1.6, 2.4), vec3(1.4, .6, 2.6), clamp(vP.z*.08, 0., 1.))*pow(1. - abs(dot(normalize(vN), normalize(cameraPosition - vWorld))), 2.2)*1.6 + vec3(2.)*pow(.5 + .5*sin(vP.z*1.7 - uTime*3. + vWorld.x), 24.)` });
  const ice = litMat({ sun: [.8, .95, 1.2], sky: [.22, .3, .45], dir: [.4, .3, -1] });
  // the frozen ring over the road: fine bands of ice that glow from within
  const ring = new THREE.ShaderMaterial({ side: THREE.DoubleSide, toneMapped: false, uniforms: { ...U },
    vertexShader: VS,
    fragmentShader: `varying vec2 vUv; varying vec3 vP; varying vec3 vN; varying vec3 vC; varying float vDepth; varying vec3 vRay; varying vec3 vWorld;
      uniform float uFogDensity, uTime; uniform vec3 uFogColor; ${FOG_GLSL}
      void main(){
        float bands = .55 + .45*sin(vUv.y*40.) * sin(vUv.y*13. + 1.);
        float run = pow(.5 + .5*sin(vUv.x*60. - uTime*4.), 12.);
        vec3 c = mix(vec3(.25, .7, 1.), vec3(.8, .5, 1.4), vUv.y)*bands*1.4 + vec3(1.5, 2.2, 3.)*run;
        gl_FragColor = vec4(fogMix(c, uFogColor, uFogDensity, vDepth, vRay), 1.);
      }` });
  const far = new THREE.Group(), near = new THREE.Group(), H = 1200, L = 640;
  place(models, 'icerock', { default: ice }, lay(r, H, 18, 30, 220, 3, 12, -2.5, () => ({ sx: 1, sz: 1 })).map(o => ({ ...o, sx: o.s*(1 + r()), sz: o.s*(1 + r()) })), far);
  place(models, 'crystal', { default: crystal }, lay(r, H, 12, 40, 200, 2.2, 5, -2), far);
  place(models, 'crystal', { default: crystal }, lay(r, L, 14, 9.5, 40, .7, 1.6, -.5), near);
  place(models, 'icerock', { default: ice }, lay(r, L, 16, 9, 30, .6, 1.8, -.4), near);
  place(models, 'ringarch', { default: ring }, overRoad(L, 3, -.2), near);
  group.add(far, near);
  group.add(particles({ n: 200, range: 22, fall: .25, spread: 40, wobble: .8, w: .06, h: .06, color: C(1.6, 2.4, 3.2) }));
  group.visible = false; scene.add(group);
  return { group, sky, update(t, ds, dist){ sky.position.set(0, 3, 8); far.position.z = dist*.6 % H; near.position.z = dist % L; } };
}
