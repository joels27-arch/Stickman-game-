/* Neon Rush · the maps: where each one sits on the run, how it drives, how it is lit, and the worlds built for them. */
import * as THREE from 'three';
import { U, SUN_DIR, FOG_GLSL, FLOW_GLSL, noiseTexture, seeded } from './shared.js';

export const SECTION = 1500;
const ORDER = ['earth', 'orbit', 'pixel', 'candy', 'rain', 'jungle', 'brain', 'ice', 'egypt', 'volcano', 'sea', 'uranus', 'cloud', 'stadium'];
export const LOOP = ORDER.length*SECTION;
const SECTIONS = ORDER.map((map, i) => ({ from: i*SECTION, map }));

/* what the settings screen offers */
export const MAP_LIST = [
  { id: 'auto', name: 'All maps', sub: 'New start every run', thumb: 'assets/thumbs/orbit.jpg' },
  { id: 'earth', name: 'Sunset Strip', sub: 'The city at dusk', thumb: 'assets/thumbs/earth.jpg' },
  { id: 'orbit', name: 'Orbit Highway', sub: 'Above the Earth', thumb: 'assets/thumbs/orbit.jpg' },
  { id: 'rain', name: 'Neon Rain', sub: 'Heavy traffic', thumb: 'assets/thumbs/rain.jpg' },
  { id: 'ice', name: 'Aurora Ice', sub: 'The car slides', thumb: 'assets/thumbs/ice.jpg' },
  { id: 'sea', name: 'Deep Sea Tunnel', sub: 'Low visibility', thumb: 'assets/thumbs/sea.jpg' },
  { id: 'stadium', name: 'Football Stadium', sub: 'Double boost', thumb: 'assets/thumbs/stadium.jpg' },
  { id: 'brain', name: 'Inside the Brain', sub: 'Tricks and rule flips', thumb: 'assets/thumbs/brain.jpg' },
  { id: 'candy', name: 'Candy Land', sub: 'Bouncy jumps', thumb: 'assets/thumbs/candy.jpg' },
  { id: 'volcano', name: 'Volcano Bridge', sub: 'Falling lava rocks', thumb: 'assets/thumbs/volcano.jpg' },
  { id: 'cloud', name: 'Cloud City', sub: 'Broken bridges', thumb: 'assets/thumbs/cloud.jpg' },
  { id: 'pixel', name: 'Pixel World', sub: 'Mind the pits', thumb: 'assets/thumbs/pixel.jpg' },
  { id: 'jungle', name: 'Jungle Temple', sub: 'Crumbling causeway', thumb: 'assets/thumbs/jungle.jpg' },
  { id: 'egypt', name: 'Valley of the Kings', sub: 'Sandstorm', thumb: 'assets/thumbs/egypt.jpg' },
  { id: 'uranus', name: 'Uranus', sub: 'Low gravity', thumb: 'assets/thumbs/uranus.jpg' },
];

export const mapAt = (d, lock) => {
  if (lock) return lock;
  const m = d % LOOP;
  let cur = SECTIONS[0].map;
  for (const s of SECTIONS) if (m >= s.from) cur = s.map;
  return cur;
};
/* metres into the current stretch of a map */
export const sectionRel = (d, lock) => lock ? d % SECTION : (d % LOOP) % SECTION;
/* the next change of map ahead of d */
const found = { at: 0, to: '' };
export const nextMap = d => {
  const m = d % LOOP, base = d - m;
  for (const s of SECTIONS) if (s.from > m){ found.at = base + s.from; found.to = s.map; return found; }
  found.at = base + LOOP; found.to = SECTIONS[0].map;
  return found;
};

/* each map's own driving rule */
export const RULES = {
  earth: { gravity: 36, jump: 11.2, gap: .36, air: 1, strikes: .16, strikeKind: 'star', title: 'BACK ON EARTH', note: '', hint: '' },
  orbit: { gravity: 36, jump: 11.2, gap: .36, air: 1, strikes: .16, strikeKind: 'rock', title: 'ORBIT HIGHWAY', note: 'Asteroid strikes', hint: 'Red targets mark where asteroids hit' },
  sea: { gravity: 26, jump: 9.6, gap: .42, air: 1.15, strikes: .16, strikeKind: 'charge', title: 'DEEP SEA TUNNEL', note: 'Low visibility', hint: 'Watch for the gate lights in the dark' },
  rain: { gravity: 36, jump: 11.2, gap: .36, air: 1, traffic: 3.2, strikes: .16, strikeKind: 'plasma', title: 'NEON RAIN', note: 'Heavy traffic', hint: 'Trucks in every lane · watch the red tail lights' },
  ice: { gravity: 36, jump: 11.2, gap: .36, air: 1, steer: 3.6, strikes: .16, strikeKind: 'ice', title: 'AURORA ICE', note: 'No grip', hint: 'The car slides · steer early' },
  stadium: { gravity: 36, jump: 11.2, gap: .36, air: 1, boost: 2, strikes: .16, strikeKind: 'ball', title: 'FOOTBALL STADIUM', note: 'The crowd is with you', hint: 'Every green gate gives double boost' },
  brain: { gravity: 36, jump: 11.2, gap: .36, air: 1, tricks: .72, flips: 3.5, strikes: .16, strikeKind: 'spark', title: 'INSIDE THE BRAIN', note: 'Trust the colour, not the word', hint: 'More trick words and more rule flips' },
  candy: { gravity: 32, jump: 13.6, gap: .46, air: 1.34, strikes: .16, strikeKind: 'gum', title: 'CANDY LAND', note: 'Bouncy jumps', hint: 'Your jumps go higher and last longer' },
  volcano: { gravity: 36, jump: 11.2, gap: .36, air: 1, rocks: .24, strikes: .16, strikeKind: 'fire', title: 'VOLCANO BRIDGE', note: 'Falling lava rocks', hint: 'Glowing circles mark where rocks land' },
  cloud: { gravity: 36, jump: 11.2, gap: .36, air: 1, gaps: 3.4, strikes: .16, strikeKind: 'bolt', title: 'CLOUD CITY', note: 'Broken bridges', hint: 'Amber stripes mean jump' },
  pixel: { gravity: 36, jump: 11.2, gap: .36, air: 1, gaps: 2.2, strikes: .16, strikeKind: 'block', title: 'PIXEL WORLD', note: 'Mind the pits', hint: 'Amber stripes mean jump' },
  jungle: { gravity: 36, jump: 11.2, gap: .36, air: 1, gaps: 2.4, strikes: .16, strikeKind: 'boulder', title: 'JUNGLE TEMPLE', note: 'Crumbling causeway', hint: 'The old road gives way: jump the gaps' },
  egypt: { gravity: 36, jump: 11.2, gap: .36, air: 1, strikes: .16, strikeKind: 'sun', title: 'VALLEY OF THE KINGS', note: 'Sandstorm', hint: 'The sand closes in: watch the gate lights' },
  uranus: { gravity: 26, jump: 9.6, gap: .42, air: 1.15, strikes: .16, strikeKind: 'diamond', title: 'URANUS', note: 'Low gravity', hint: 'Floaty jumps: take off a little early' },
};

export const C = (r, g, b) => new THREE.Color(r, g, b);
export const MAP_LIGHT = {
  earth: { kind: 0, ground: -9, sunDir: SUN_DIR, sunColor: C(1, .55, .42), sun: 2, fill: .5, env: .62, water: true, lamps: true, gantries: true, paint: C(1, 1, 1), lampSheen: 1 },
  orbit: { kind: 1, ground: -9, sunDir: new THREE.Vector3(-.224, .111, -1).normalize(), sunColor: C(1, .72, .5), sun: 1.3, fill: .55, env: .46, water: false, lamps: true, gantries: false,
    paint: C(.42, .55, 1.5), lampSheen: .25, fog: C(.10, .22, .55), density: .00032 },
  sea: { kind: 2, ground: -9, sunDir: new THREE.Vector3(0, .62, -.78).normalize(), sunColor: C(.5, .86, 1), sun: 1.1, fill: .6, env: .6, water: false, lamps: false, gantries: false,
    paint: C(.34, .62, 1.6), lampSheen: .05, fog: C(.012, .085, .14), density: .0032, noReflect: true, blur: .45 },
  rain: { kind: 3, ground: -9, sunDir: new THREE.Vector3(0, .8, -.6).normalize(), sunColor: C(.5, .8, 1), sun: .5, fill: .35, env: .5, water: true, lamps: true, gantries: false,
    paint: C(.34, .55, 1.6), lampSheen: .8, fog: C(.035, .10, .13), density: .0021, night: 1, dark: true },
  ice: { kind: 4, ground: -.5, sunDir: new THREE.Vector3(0, .7, -.7).normalize(), sunColor: C(.5, 1, .8), sun: .6, fill: .5, env: .6, water: true, lamps: false, gantries: false,
    paint: C(.5, .62, 1.4), lampSheen: .1, fog: C(.06, .16, .2), density: .00072 },
  stadium: { kind: 6, ground: -.25, sunDir: new THREE.Vector3(.3, .8, -.5).normalize(), sunColor: C(.9, .95, 1), sun: 1.7, fill: .9, env: .7, water: true, lamps: true, gantries: false,
    paint: C(.62, .42, 1.5), lampSheen: .3, fog: C(.04, .06, .13), density: .0006 },
  brain: { kind: 7, ground: -9, sunDir: new THREE.Vector3(0, .25, -1).normalize(), sunColor: C(.85, .55, 1), sun: 1.4, fill: 1.2, fillColor: C(.75, .5, 1), env: .55, water: false, lamps: false, gantries: false,
    paint: C(.62, .55, 1.5), lampSheen: .2, fog: C(.13, .06, .24), density: .0015 },
  candy: { kind: 8, ground: -.7, sunDir: new THREE.Vector3(.2, .62, -.6).normalize(), sunColor: C(1, .93, .86), sun: 2.3, fill: 1.5, fillColor: C(1, .86, .92), env: 1, water: true, lamps: false, gantries: false,
    paint: C(1.1, 1, 1.05), lampSheen: .1, fog: C(.97, .76, .83), density: .00052, blur: .6 },
  volcano: { kind: 9, ground: -6, sunDir: new THREE.Vector3(0, .12, -1).normalize(), sunColor: C(1, .42, .16), sun: 1.8, fill: 3, fillColor: C(1, .32, .08), fillPos: new THREE.Vector3(0, -8, 5), env: .55, water: true, lamps: false, gantries: false,
    paint: C(1.25, .72, .6), lampSheen: .5, fog: C(.17, .05, .03), density: .0012 },
  cloud: { kind: 10, ground: -9, sunDir: new THREE.Vector3(0, .03, -1).normalize(), sunColor: C(1, .82, .6), sun: 2.6, fill: 2.1, fillColor: C(1, .78, .56), env: 1, water: false, lamps: false, gantries: false,
    paint: C(1.05, .95, .85), lampSheen: .2, fog: C(.98, .82, .62), density: .0005 },
  pixel: { kind: 11, ground: -.6, sunDir: new THREE.Vector3(0, .1, -1).normalize(), sunColor: C(1, .6, .5), sun: 1.6, fill: 1.1, fillColor: C(.9, .5, 1), env: .8, water: true, lamps: false, gantries: false,
    paint: C(.9, .6, 1.4), lampSheen: .3, fog: C(.42, .1, .38), density: .0007 },
  jungle: { kind: 12, ground: -1.5, sunDir: new THREE.Vector3(.35, .3, -1).normalize(), sunColor: C(1, .78, .45), sun: 2, fill: 1, fillColor: C(.55, .8, .45), env: .7, water: true, lamps: false, gantries: false,
    paint: C(.85, 1.05, .8), lampSheen: .2, fog: C(.5, .55, .38), density: .0011 },
  egypt: { kind: 13, ground: -2, sunDir: new THREE.Vector3(0, .1, -1).normalize(), sunColor: C(1, .6, .3), sun: 2.2, fill: 1.3, fillColor: C(1, .66, .4), env: .85, water: true, lamps: false, gantries: false,
    paint: C(1.2, .85, .6), lampSheen: .3, fog: C(.78, .5, .3), density: .0016 },
  uranus: { kind: 14, ground: -.5, sunDir: new THREE.Vector3(.5, .1, -1).normalize(), sunColor: C(.75, .9, 1), sun: 1.4, fill: .9, fillColor: C(.6, .7, 1), env: .7, water: true, lamps: false, gantries: false,
    paint: C(.6, .8, 1.5), lampSheen: .2, fog: C(.07, .1, .22), density: .00045 },
};

const skyVS = `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position, 1.); gl_Position = p.xyww; }`;

/* A backdrop mapped straight through a pinhole, the way the picture it was made from is framed */
function plateSky(fragmentShader, uniforms){
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth, toneMapped: false, fog: false,
    uniforms: { ...uniforms, uT: U.uTime, uZoom: U.uZoom, tN: { value: noiseTexture() } }, vertexShader: skyVS, fragmentShader,
  }));
  mesh.frustumCulled = false; mesh.renderOrder = 100; mesh.layers.enable(1);
  return mesh;
}
export const geos = (models, name) => { const out = []; models.getObjectByName(name).traverse(o => { if (o.isMesh) out.push({ geometry: o.geometry, name: o.material.name }); }); return out; };

export function makeOrbitWorld(scene, tPlate, models){
  const group = new THREE.Group();
  const sky = plateSky(`
    varying vec3 vDir; uniform sampler2D tS; uniform float uT, uZoom;
    uniform sampler2D tN;
    void main(){
      vec3 d = normalize(vDir);
      float front = smoothstep(-.04, -.32, d.z);
      vec2 q = d.xy/min(d.z, -.04)*-1./uZoom;
      vec2 uv = vec2(.5 + q.x/2.24, .438 + q.y/.95);
      uv = abs(mod(uv + 1., 2.) - 1.);
      // the planet turns: everything inside the limb flows, the limb, aurora and sun stay put
      vec2 a = vec2(uv.x*2.357, uv.y);
      float inside = smoothstep(.02, .17, 2.72 - distance(a, vec2(1.447, -2.124)));
      inside *= smoothstep(.1, .55, distance(a, vec2(.943, .555)));
      float p1 = fract(uT*.13), p2 = fract(p1 + .5);
      vec2 flow = vec2(.10, .012)*inside;
      vec3 c = mix(textureLod(tS, uv + flow*(p1 - .5), 0.).rgb, textureLod(tS, uv + flow*(p2 - .5), 0.).rgb, abs(2.*p1 - 1.));
      float L = dot(c, vec3(.2126, .7152, .0722));
      float aurora = max(c.g - max(c.r, c.b*.72), 0.);
      c += vec3(.05, 1., .72)*aurora*3.2*(.75 + .55*sin(uv.x*26. + uT*1.2 + sin(uv.x*9. - uT*.8)*2.));
      c *= 1.3 + 1.4*smoothstep(.8, 1., L)*(1. + .07*sin(uT*1.7));   // the sun glows but no longer blinds (was 4.5)
      c *= 1. + (textureLod(tN, uv*9. + uT*.05, 0.).r - .5)*1.5*(1. - inside)*(1. - smoothstep(.2, .6, L));   // stars twinkle
      c *= front;
      c += vec3(.002, .003, .008)*(1. - front);
      gl_FragColor = vec4(c, 1.);
    }`, { tS: { value: tPlate } });
  group.add(sky);

  const glow = new THREE.MeshBasicMaterial({ color: C(.6, 2.6, 3.4), toneMapped: false, fog: false });
  const hull = new THREE.MeshStandardMaterial({ color: 0x8a8f9c, metalness: .85, roughness: .4, fog: false, envMapIntensity: 1.1 });
  const station = new THREE.Group();
  for (const g of geos(models, 'station')){
    const m = new THREE.Mesh(g.geometry, g.name === 'stationglow' ? glow : hull);
    m.frustumCulled = false; m.layers.enable(1); station.add(m);
  }
  station.position.set(1240, 300, -1500);
  station.rotation.set(.1, -.5, 1.45);
  group.add(station);
  group.visible = false;
  scene.add(group);
  return { group, sky, update(){ sky.position.set(0, 3, 8); station.rotateY(.0016); } };
}

/* ---------- Deep Sea Tunnel ---------- */
export function makeSeaWorld(scene, tPlate, models, noise){
  const group = new THREE.Group(), r = seeded(1234);
  const sky = simpleSky(tPlate, .24, '(1.75 + 3.4*smoothstep(.5, 1., L))', {
    dir: [.02, 0], amt: .03, mask: 'smoothstep(.2, .42, uv.y)',
    post: `
      vec2 s = uv - vec2(.52, 1.2);                                    // beams of light swing through the water
      float ang = atan(s.x, -s.y);
      float beam = (.5 + .5*sin(ang*24. + uT*.55))*(.5 + .5*sin(ang*39. - uT*.4 + sin(uT*.3)*2.));
      c += vec3(.14, .42, .5)*beam*beam*smoothstep(.22, .95, uv.y)*1.5;
      c *= 1. + .4*sin(uv.x*44. + uT*1.5 + sin(uv.x*13. + uT)*2.)*smoothstep(.74, 1., uv.y);   // the surface ripples far above`,
  });
  group.add(sky);

  const shared = { uFogColor: U.uFogColor, uFogDensity: U.uFogDensity, uTime: U.uTime, tNoise: { value: noise } };
  const VS = `varying vec3 vP; varying vec3 vN; varying float vDepth; varying vec3 vRay; varying vec3 vW;
    void main(){ vP = position; vN = normal; vec4 w = modelMatrix*vec4(position, 1.); vW = w.xyz; vec4 mv = viewMatrix*w; vDepth = -mv.z; vRay = mv.xyz; gl_Position = projectionMatrix*mv; }`;

  // seabed strips, mirrored for the left side and repeated along the road
  const bedMat = new THREE.ShaderMaterial({
    toneMapped: false, side: THREE.DoubleSide, uniforms: shared, vertexShader: VS,
    fragmentShader: `
      varying vec3 vP; varying vec3 vN; varying float vDepth; varying vec3 vRay;
      uniform sampler2D tNoise; uniform float uFogDensity, uTime; uniform vec3 uFogColor;
      ${FOG_GLSL}
      void main(){
        vec3 N = normalize(vN);
        vec3 c = mix(vec3(.014, .045, .07), vec3(.05, .17, .2), smoothstep(.5, .97, abs(N.y)));
        float c1 = texture2D(tNoise, vP.xz/23. + uTime*vec2(.012, .018)).r, c2 = texture2D(tNoise, vP.zx/15. - uTime*vec2(.016, .011)).g;
        c += vec3(.07, .3, .36)*pow(max(1. - abs(c1 - c2)*3., 0.), 7.)*abs(N.y);
        gl_FragColor = vec4(fogMix(c, uFogColor, uFogDensity*.62, vDepth, vRay), 1.);
      }`,
  });
  const bed = new THREE.Group();
  const bedGeo = geos(models, 'seabed')[0].geometry;
  for (const side of [1, -1]) for (let i = 0; i < 2; i++){
    const m = new THREE.Mesh(bedGeo, bedMat);
    m.scale.x = side; m.position.z = -i*1200 + 60; m.frustumCulled = false; bed.add(m);
  }
  group.add(bed);

  // the glass tube: bays of ribs, plus one long sheet of glass that only shows at glancing angles
  const ribs = new THREE.Group();
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x1a2a38, metalness: .8, roughness: .4 });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
  for (const g of geos(models, 'rib')){
    const im = new THREE.InstancedMesh(g.geometry, ribMat, 44);
    for (let i = 0; i < 44; i++){ M.compose(P.set(0, -.1, -i*26 + 52), Q.identity(), S.set(.74, .8, 1)); im.setMatrixAt(i, M); }
    im.frustumCulled = false; im.layers.enable(1); ribs.add(im);
  }
  group.add(ribs);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1600, 48, 1, true, -Math.PI/2, Math.PI), new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalMatrix*normal; vec4 mv = modelViewMatrix*vec4(position, 1.); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1. - abs(dot(normalize(vN), normalize(vV))), 4.); gl_FragColor = vec4(vec3(.05, .2, .28)*f, 1.); }`,
  }));
  glass.rotation.x = Math.PI/2; glass.rotation.y = 0;
  glass.scale.set(9.6, 1, 10.3); glass.position.set(0, .2, -760); glass.frustumCulled = false;
  group.add(glass);

  // coral gardens on both sides of the tube
  const reef = new THREE.Group();
  const coralMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .6, metalness: .1 });
  const glowMat = new THREE.MeshBasicMaterial({ color: C(1.5, 1.5, 1.5), toneMapped: false });
  const tints = [C(.9, .22, .55), C(.55, .22, .95), C(.95, .5, .2), C(.2, .75, .85)], glows = [C(.3, 1, 1), C(1, .75, .25), C(1, .35, .85), C(.5, 1, .55)];
  const coralGeos = geos(models, 'coral'), layout = [];
  for (let i = 0; i < 26; i++){
    const side = i % 2 ? 1 : -1, s = .5 + r()*.6;
    layout.push({ x: side*(11.2 + r()*r()*26), y: -.9 - r()*.5, z: -r()*256, s, a: r()*6.28, t: Math.floor(r()*4) });
  }
  for (const g of coralGeos){
    const isGlow = g.name === 'coralglow', count = layout.length*3;
    const im = new THREE.InstancedMesh(g.geometry, isGlow ? glowMat : coralMat, count);
    for (let c = 0; c < 3; c++) layout.forEach((l, i) => {
      Q.setFromAxisAngle(P.set(0, 1, 0), l.a);
      M.compose(P.set(l.x, l.y, l.z - c*256 + 40), Q, S.setScalar(l.s));
      im.setMatrixAt(c*layout.length + i, M);
      im.setColorAt(c*layout.length + i, (isGlow ? glows : tints)[l.t]);
    });
    im.frustumCulled = false; reef.add(im);
  }
  group.add(reef);

  // shells, starfish and stones lying on the sand, flat enough never to be mistaken for obstacles
  const bits = [['stone', 0x5d7284, 26, .55, 1.2], ['shell', 0xd9b7b0, 12, .5, 1], ['starfish', 0xd86a3c, 8, .5, .9]];
  for (const [name, color, count, lo, hi] of bits){
    const mat = new THREE.MeshStandardMaterial({ color, roughness: .7, side: THREE.DoubleSide });
    const im = new THREE.InstancedMesh(geos(models, name)[0].geometry, mat, count*3);
    for (let c = 0; c < 3; c++) for (let i = 0; i < count; i++){
      const side = r() < .5 ? -1 : 1, x = side*(4.4 + r()*2.9);
      Q.setFromAxisAngle(P.set(0, 1, 0), r()*6.28);
      M.compose(P.set(x, .01, -r()*256 - c*256 + 40), Q, S.setScalar(lo + r()*(hi - lo)));
      im.setMatrixAt(c*count + i, M);
    }
    im.frustumCulled = false; reef.add(im);
  }

  // fish schools, swimming and wiggling entirely in the vertex shader
  const fishGeo = geos(models, 'fish')[0].geometry;
  const schools = 6, each = 26, total = schools*each*3;
  const fishGeom = new THREE.InstancedBufferGeometry();
  fishGeom.index = fishGeo.index; fishGeom.setAttribute('position', fishGeo.getAttribute('position')); fishGeom.setAttribute('normal', fishGeo.getAttribute('normal'));
  const aC = new Float32Array(total*4), aS = new Float32Array(total*3);
  const palette = [[1, .5, .12], [.25, .9, .95], [1, .85, .25], [.8, .9, 1], [1, .3, .55], [.4, .55, 1]];
  const homes = [];
  for (let s = 0; s < schools; s++) homes.push([(s % 2 ? 1 : -1)*(12 + r()*16), 3 + r()*10, -r()*256]);
  let n = 0;
  for (let c = 0; c < 3; c++) for (let s = 0; s < schools; s++) for (let i = 0; i < each; i++){
    const h = homes[s];
    aC[n*4] = h[0] + (r() - .5)*6; aC[n*4 + 1] = h[1] + (r() - .5)*4; aC[n*4 + 2] = h[2] - c*256 + 30 + (r() - .5)*16; aC[n*4 + 3] = r()*6.28;
    const p = palette[s];
    aS[n*3] = p[0]; aS[n*3 + 1] = p[1]; aS[n*3 + 2] = p[2];
    n++;
  }
  fishGeom.setAttribute('aC', new THREE.InstancedBufferAttribute(aC, 4));
  fishGeom.setAttribute('aS', new THREE.InstancedBufferAttribute(aS, 3));
  fishGeom.instanceCount = total;
  const fish = new THREE.Mesh(fishGeom, new THREE.ShaderMaterial({
    toneMapped: false, side: THREE.DoubleSide, uniforms: shared,
    vertexShader: `
      attribute vec4 aC; attribute vec3 aS; uniform float uTime; varying vec3 vC; varying vec3 vN; varying float vDepth; varying vec3 vRay;
      void main(){
        vec3 p = position;
        float ph = aC.w, s = 1.7 + 1.5*fract(ph*3.7);
        p.x += sin(p.z*5. + uTime*11. + ph)*.11*(p.z + .5);             // the tail end whips
        p *= s;
        vec3 w = (modelMatrix*vec4(aC.xyz, 1.)).xyz;
        w += vec3(sin(uTime*.6 + ph)*1.6, sin(uTime*.9 + ph*2.)*.7, cos(uTime*.6 + ph)*1.6);
        vec4 mv = viewMatrix*vec4(w + p, 1.);
        vC = aS; vN = normal; vDepth = -mv.z; vRay = mv.xyz; gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `
      varying vec3 vC; varying vec3 vN; varying float vDepth; varying vec3 vRay; uniform float uFogDensity; uniform vec3 uFogColor;
      ${FOG_GLSL}
      void main(){ float l = .45 + .55*max(normalize(vN).y, 0.); gl_FragColor = vec4(fogMix(vC*l*1.25, uFogColor, uFogDensity, vDepth, vRay), 1.); }`,
  }));
  fish.frustumCulled = false; fish.layers.enable(1);
  reef.add(fish);

  // jellyfish: pulse in the shader, glow by their rims
  const jellyGeo = geos(models, 'jelly')[0].geometry, jCount = 27;
  const jelly = new THREE.InstancedMesh(jellyGeo, new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uTime: U.uTime },
    vertexShader: `
      uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vH; varying float vS;
      void main(){
        float ph = instanceMatrix[3][0]*.7 + instanceMatrix[3][1]*1.3;
        float beat = .5 + .5*sin(uTime*2.8 + ph), pulse = beat*beat;       // the bell squeezes hard, then relaxes
        float bell = smoothstep(-.1, .5, position.y), trail = clamp(-position.y/4., 0., 1.);
        vec3 p = position;
        p.xz *= 1. - .34*pulse*bell + .12*(1. - pulse)*bell;
        p.y *= 1. + .24*pulse*bell;
        p.x += sin(position.y*1.9 + uTime*3.4 + ph)*.5*trail;              // tentacles trail and wave
        p.z += cos(position.y*1.5 + uTime*2.8 + ph*2.)*.4*trail;
        vec4 w = modelMatrix*instanceMatrix*vec4(p, 1.);
        w.y += sin(uTime*.8 + ph)*3.4 + pulse*.5;                          // each one swims its own path
        w.x += cos(uTime*.55 + ph*2.)*2.8;
        w.z += sin(uTime*.6 + ph*.7)*4.;
        vec4 mv = viewMatrix*w;
        vN = normalize(mat3(viewMatrix)*mat3(modelMatrix)*mat3(instanceMatrix)*normal); vV = -mv.xyz; vH = position.y; vS = fract(ph*.31);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `
      varying vec3 vN; varying vec3 vV; varying float vH; varying float vS;
      void main(){
        float f = pow(1. - abs(dot(normalize(vN), normalize(vV))), 2.2);
        vec3 c = mix(vec3(1.5, 1.3, 2.3), vec3(2.2, .8, 1.8), step(.5, vS));
        gl_FragColor = vec4(c*(.1 + f*.9)*(vH < -.2 ? .35 : 1.), 1.);
      }`,
  }), jCount);
  for (let c = 0; c < 3; c++) for (let i = 0; i < 9; i++){
    const side = i % 2 ? 1 : -1, x = side*(34 + (i*11.3 % 62)), y = 9 + (i*5.1 % 34), z = -(i*29 % 256) - c*256 + 40, s = 2.6 + (i % 3)*1.6;
    M.compose(P.set(x, y, z), Q.identity(), S.setScalar(s));
    jelly.setMatrixAt(c*9 + i, M);
  }
  // they drift along with the car, so there is time to watch them swim instead of flashing past
  const swarm = new THREE.Group(); swarm.add(jelly);
  jelly.frustumCulled = false; group.add(swarm);

  // far schools crossing the deep water, keeping their distance from the car
  const farN = 96, farG = new THREE.InstancedBufferGeometry();
  farG.index = fishGeo.index; farG.setAttribute('position', fishGeo.getAttribute('position')); farG.setAttribute('normal', fishGeo.getAttribute('normal'));
  const farA = new Float32Array(farN*4);
  for (let i = 0; i < farN; i++){
    const school = Math.floor(i/12), a = seeded(school*17 + 5);
    const bx = a(), by = a(), bz = a(), dir = a();
    farA[i*4] = bx + (r() - .5)*.05; farA[i*4 + 1] = by + (r() - .5)*.07; farA[i*4 + 2] = bz + (r() - .5)*.05; farA[i*4 + 3] = dir;
  }
  farG.setAttribute('aF', new THREE.InstancedBufferAttribute(farA, 4));
  farG.instanceCount = farN;
  const farFish = new THREE.Mesh(farG, new THREE.ShaderMaterial({
    toneMapped: false, side: THREE.DoubleSide, uniforms: { uTime: U.uTime },
    vertexShader: `
      attribute vec4 aF; uniform float uTime; varying float vD;
      void main(){
        float way = aF.w > .5 ? 1. : -1., span = 760.;
        vec3 p = position*(4.5 + aF.w*4.);
        p.x += sin(position.z*5. + uTime*7. + aF.x*40.)*.5*(position.z + .5);
        p = vec3(-p.z*way, p.y, p.x);                                   // side-on, swimming across the view
        vec3 w = vec3(mod(aF.x*span + way*uTime*(16. + aF.w*14.), span) - span/2., 5. + aF.y*58., -210. - aF.z*300.);
        vec4 mv = viewMatrix*vec4(w + p, 1.);
        vD = -mv.z; gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `varying float vD; void main(){ gl_FragColor = vec4(mix(vec3(.02, .1, .16), vec3(.03, .2, .29), clamp(vD/500., 0., 1.)), 1.); }`,
  }));
  farFish.frustumCulled = false; group.add(farFish);

  // the whale cruises the same way as the car, so it slides slowly past
  const whaleMat = new THREE.ShaderMaterial({
    toneMapped: false, side: THREE.DoubleSide,
    uniforms: { uFogColor: U.uFogColor, uFogDensity: U.uFogDensity, uTime: U.uTime },
    vertexShader: `
      uniform float uTime; varying vec3 vP; varying vec3 vN; varying float vDepth; varying vec3 vRay;
      void main(){
        vec3 p = position;
        float tail = smoothstep(-2., 18., p.z);
        p.y += sin(p.z*.22 - uTime*1.1)*tail*tail*2.6;
        vP = position; vN = normalMatrix*normal;
        vec4 mv = modelViewMatrix*vec4(p, 1.); vDepth = -mv.z; vRay = mv.xyz; gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `
      varying vec3 vP; varying vec3 vN; varying float vDepth; varying vec3 vRay; uniform float uFogDensity; uniform vec3 uFogColor;
      ${FOG_GLSL}
      void main(){
        vec3 N = normalize(vN);
        float belly = smoothstep(.6, -1.6, vP.y);
        float mottle = .5 + .5*sin(vP.z*1.9 + sin(vP.x*2.3)*1.5)*sin(vP.x*3.1 + vP.z*.7);
        vec3 c = mix(vec3(.05, .13, .2) + vec3(.03, .05, .06)*mottle, vec3(.28, .42, .5), belly);
        float head = smoothstep(4., -5., vP.z)*belly;                      // the long throat grooves
        c *= 1. - .55*head*smoothstep(.35, .8, abs(sin(vP.x*9.)));
        float jaw = smoothstep(.09, .02, abs(vP.y + .5 + (vP.z + 15.)*.022))*smoothstep(-2., -8., vP.z);
        float eye = smoothstep(.22, .1, length(vec2(vP.z + 8.4, vP.y + 1.1)))*step(2.4, abs(vP.x));
        c *= (1. - jaw*.7)*(1. - eye*.9);
        c *= .5 + .75*max(N.y, 0.) + .25*(1. - abs(dot(N, normalize(vRay))));
        gl_FragColor = vec4(fogMix(c, uFogColor, uFogDensity*.42, vDepth, vRay), 1.);
      }`,
  });
  const whale = new THREE.Mesh(geos(models, 'whale')[0].geometry, whaleMat);
  whale.scale.setScalar(1.7); whale.frustumCulled = false;
  group.add(whale);

  // plankton and bubbles drifting through the beams
  const quad = new THREE.PlaneGeometry(1, 1), mg = new THREE.InstancedBufferGeometry();
  mg.index = quad.index; mg.setAttribute('position', quad.getAttribute('position'));
  const nM = 300, aP = new Float32Array(nM*4);
  for (let i = 0; i < nM*4; i++) aP[i] = r();
  mg.setAttribute('aP', new THREE.InstancedBufferAttribute(aP, 4));
  mg.instanceCount = nM;
  const motes = new THREE.Mesh(mg, new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    uniforms: { uTime: U.uTime, uDist: U.uDist },
    vertexShader: `
      attribute vec4 aP; uniform float uTime, uDist; varying vec2 vQ; varying float vA;
      void main(){
        float z = mod(aP.z*128. + uDist, 128.) - 118.;
        vec3 w = vec3((aP.x - .5)*40. + sin(uTime*.4 + aP.w*6.)*.6, mod(aP.y*24. + uTime*(.4 + aP.w*.9), 24.) - 3., z);
        vec4 mv = viewMatrix*vec4(w, 1.);
        mv.xy += position.xy*(.035 + aP.w*.05);
        vQ = position.xy*2.; vA = smoothstep(10., 0., z)*smoothstep(-118., -80., z);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `varying vec2 vQ; varying float vA; void main(){ gl_FragColor = vec4(vec3(.6, 1.2, 1.5)*smoothstep(1., .1, length(vQ))*vA, 1.); }`,
  }));
  motes.frustumCulled = false;
  group.add(motes);

  group.visible = false;
  scene.add(group);
  let whaleZ = -150;
  return { group, sky, update(t, ds, dist){
    sky.position.set(0, 3, 8);
    bed.position.z = dist % 1200;
    ribs.position.z = dist % 26;
    reef.position.z = dist % 256;
    swarm.position.z = (dist*.3) % 256;
    whaleZ += ds*.2;
    if (whaleZ > 70) whaleZ = -330;
    whale.position.set(-37, 14 + Math.sin(t*.2)*2, whaleZ);
    whale.rotation.z = Math.sin(t*.3)*.04;
  } };
}

/* ---------- shared pieces for the worlds below ---------- */
export function simpleSky(tPlate, v0, lift, { dir = [.04, 0], amt = .01, mask = '1.', pre = '', post = '', flow = '' } = {}){
  return plateSky(`
    varying vec3 vDir; uniform sampler2D tS; uniform float uT, uZoom;
    ${FLOW_GLSL}
    void main(){
      vec3 d = normalize(vDir);
      float front = smoothstep(-.04, -.32, d.z);
      vec2 q = d.xy/min(d.z, -.04)*-1./uZoom;
      vec2 uv = vec2(.5 + q.x/2.24, ${v0.toFixed(3)} + q.y/.95);
      uv = abs(mod(uv + 1., 2.) - 1.);
      ${pre}
      float M = ${mask};
      vec3 c = flowSky(tS, uv, ${flow || `vec2(${dir[0].toFixed(3)}, ${dir[1].toFixed(3)})*M`}, uT, ${amt.toFixed(3)}*M);
      float L = dot(c, vec3(.2126, .7152, .0722));
      c *= ${lift};
      ${post}
      c *= front; c += textureLod(tS, vec2(.5, .15), 4.).rgb*(1. - front)*.5;
      gl_FragColor = vec4(c, 1.);
    }`, { tS: { value: tPlate } });
}

/* falling or drifting specks around the camera, entirely in the vertex shader */
export function particles({ n, range = 24, fall = 1, spread = 40, wobble = .6, w = .05, h = .05, color = C(1, 1, 1), multi = false }){
  const quad = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
  g.index = quad.index; g.setAttribute('position', quad.getAttribute('position'));
  const a = new Float32Array(n*4), r = seeded(n*7 + 3);
  for (let i = 0; i < n*4; i++) a[i] = r();
  g.setAttribute('aP', new THREE.InstancedBufferAttribute(a, 4));
  g.instanceCount = n;
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    uniforms: { uTime: U.uTime, uDist: U.uDist, uC: { value: color } },
    vertexShader: `
      attribute vec4 aP; uniform float uTime, uDist; varying vec2 vQ; varying float vA; varying vec3 vT;
      void main(){
        float z = mod(aP.z*128. + uDist, 128.) - 118.;
        vec3 p = vec3((aP.x - .5)*${spread.toFixed(1)} + sin(uTime*.8 + aP.w*6.)*${wobble.toFixed(2)},
                      mod(aP.y*${range.toFixed(1)} - uTime*${fall.toFixed(2)}*(.65 + aP.w*.7), ${range.toFixed(1)}) - 1., z);
        vec4 mv = viewMatrix*vec4(p, 1.);
        mv.xy += position.xy*vec2(${w.toFixed(3)}, ${h.toFixed(3)})*(.6 + aP.w*.8);
        vQ = position.xy*2.; vA = smoothstep(10., 2., z)*smoothstep(-118., -80., z);
        vT = 0.5 + 0.5*cos(6.283*(aP.w*vec3(1., 1.3, .7) + vec3(0., .33, .67)));
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `varying vec2 vQ; varying float vA; varying vec3 vT; uniform vec3 uC;
      void main(){ gl_FragColor = vec4(${multi ? 'vT*2.2' : 'uC'}*smoothstep(1., .2, length(vQ))*vA, 1.); }`,
  }));
  m.frustumCulled = false;
  return m;
}

/* big soft cards of mist or dust that slide past with the road */
export function fogCards({ n, color, alpha, wide, tall, noise, spreadX, minX, y }){
  const quad = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
  g.index = quad.index; g.setAttribute('position', quad.getAttribute('position')); g.setAttribute('uv', quad.getAttribute('uv'));
  const a = new Float32Array(n*4), r = seeded(n*11 + 1);
  for (let i = 0; i < n; i++){ const side = i % 2 ? 1 : -1; a[i*4] = side*(minX + r()*spreadX); a[i*4 + 1] = y + r()*y; a[i*4 + 2] = r(); a[i*4 + 3] = r(); }
  g.setAttribute('aP', new THREE.InstancedBufferAttribute(a, 4));
  g.instanceCount = n;
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { uTime: U.uTime, uDist: U.uDist, tNoise: { value: noise }, uC: { value: color } },
    vertexShader: `
      attribute vec4 aP; uniform float uDist, uTime; varying vec2 vUv; varying float vA;
      void main(){
        float z = mod(aP.z*256. + uDist, 256.) - 236.;
        vec3 p = vec3(aP.x + sin(uTime*.35 + aP.w*6.3)*${(wide*.22).toFixed(1)} + position.x*${wide.toFixed(1)}, aP.y + position.y*${tall.toFixed(1)}, z);
        vUv = uv; vA = smoothstep(16., 0., z)*smoothstep(-236., -170., z);
        gl_Position = projectionMatrix*viewMatrix*vec4(p, 1.);
      }`,
    fragmentShader: `varying vec2 vUv; varying float vA; uniform sampler2D tNoise; uniform float uTime; uniform vec3 uC;
      void main(){
        vec2 q = vUv*2. - 1.;
        float n = texture2D(tNoise, vUv*.09 + uTime*vec2(.01, .004)).r*.6 + texture2D(tNoise, vUv*.27 - uTime*vec2(.016, .002)).g*.4;
        float a = smoothstep(1., .1, length(q))*smoothstep(.25, .7, n)*${alpha.toFixed(2)}*vA;
        gl_FragColor = vec4(uC, a);
      }`,
  }));
  m.frustumCulled = false;
  return m;
}

const terrainVS = `varying vec3 vP; varying vec3 vN; varying float vDepth; varying vec3 vRay;
  void main(){ vP = position; vN = normal; vec4 mv = modelViewMatrix*vec4(position, 1.); vDepth = -mv.z; vRay = mv.xyz; gl_Position = projectionMatrix*mv; }`;

/* a terrain strip mirrored to both sides of the road and repeated along it */
export function strips(geometry, material, length, copies, reflect){
  const g = new THREE.Group();
  for (const side of [1, -1]) for (let i = 0; i < copies; i++){
    const m = new THREE.Mesh(geometry, material);
    m.scale.x = side; m.position.z = -i*length + length*.1; m.frustumCulled = false;
    if (reflect) m.layers.enable(1);
    g.add(m);
  }
  return g;
}

/* ---------- Neon Rain ---------- */
export function makeRainWorld(scene, tPlate, tSigns, baseTower, models, noise){
  const group = new THREE.Group(), r = seeded(501), L = 896;
  const towerMat = baseTower.clone();
  Object.assign(towerMat.uniforms, { ...U, tF: baseTower.uniforms.tF, uTint: { value: C(.3, .95, 1.25) }, uLit: { value: .13 }, uTile: { value: 1.7 } });
  const sky = simpleSky(tPlate, .10, '2.6', { dir: [.08, .012], amt: .024, post: `
      float strike = uT*.9, id = floor(strike);
      float f = step(.9, fract(sin(id*91.7)*4375.))*exp(-fract(strike)*8.)*(.6 + .4*sin(uT*70.));    // lightning in the storm
      c += c*f*6. + vec3(.3, .42, .6)*f*smoothstep(.15, .8, uv.y);` });
  group.add(sky);
  const city = new THREE.Group(), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
  const lists = [[], [], []], signs = [];
  for (const side of [1, -1]) for (let row = 0; row < 3; row++){
    let z = 0;
    while (z < L){
      const w = 22 + r()*16, d = 24 + r()*18, h = (row === 0 ? 90 : 160) + r()*260;
      const x = side*(row === 0 ? 27 + w/2 + r()*6 : row === 1 ? 92 + r()*30 : 150 + r()*80);
      const shape = Math.floor(r()*3);
      lists[shape].push({ x, y: -9, z: -z, w, h, d, s: [r(), r(), r()] });
      if (row === 0){
        for (let k = 0; k < 4; k++){
          const sh = 16 + r()*26, sw = 10 + r()*14, y = 6 + r()*Math.min(h*.6, 74);
          const front = k < 3;
          signs.push({ x: front ? x - side*w*.1 + (r() - .5)*w*.5 : x - side*(w/2 + .4), y, z: front ? -z + d/2 + .5 : -z + (r() - .5)*d*.7, w: sw, h: sh, ry: front ? 0 : -side*Math.PI/2, cell: Math.floor(r()*16) });
        }
      }
      z += d + 8 + r()*14;
    }
  }
  ['tower1', 'tower2', 'tower3'].forEach((name, i) => {
    const list = lists[i], geo = geos(models, name)[0].geometry.clone(), n = list.length*2, seeds = new Float32Array(n*3);
    const im = new THREE.InstancedMesh(geo, towerMat, n);
    for (let c = 0; c < 2; c++) list.forEach((t, j) => {
      M.compose(P.set(t.x, t.y, t.z - c*L), Q.identity(), S.set(t.w, t.h, t.d));
      im.setMatrixAt(c*list.length + j, M);
      seeds.set(t.s, (c*list.length + j)*3);
    });
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3));
    im.frustumCulled = false; im.layers.enable(1); city.add(im);
  });
  const signGeo = new THREE.PlaneGeometry(1, 1), n = signs.length*2, cells = new Float32Array(n);
  const board = new THREE.InstancedMesh(signGeo, new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { tS: { value: tSigns }, uTime: U.uTime, uFogDensity: U.uFogDensity },
    vertexShader: `
      attribute float aCell; varying vec2 vUv; varying float vF; varying float vC; uniform float uFogDensity;
      void main(){
        vec2 c = vec2(mod(aCell, 4.), floor(aCell/4.));
        vUv = (c + uv)/4.; vC = aCell;
        vec4 mv = modelViewMatrix*instanceMatrix*vec4(position, 1.);
        vF = exp(-pow(-mv.z*uFogDensity*.42, 2.));
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `varying vec2 vUv; varying float vF; varying float vC; uniform sampler2D tS; uniform float uTime;
      void main(){
        float flick = .86 + .14*step(.12, fract(sin(floor(uTime*9. + vC)*12.9)*437.5));
        vec3 c = texture2D(tS, vUv).rgb;
        gl_FragColor = vec4(c*c*7.5*flick*vF, 1.);
      }`,
  }), n);
  for (let c = 0; c < 2; c++) signs.forEach((t, j) => {
    Q.setFromAxisAngle(P.set(0, 1, 0), t.ry);
    M.compose(P.set(t.x, t.y, t.z - c*L), Q, S.set(t.w, t.h, 1));
    board.setMatrixAt(c*signs.length + j, M);
    cells[c*signs.length + j] = t.cell;
  });
  signGeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 1));
  board.frustumCulled = false; board.layers.enable(1); city.add(board);
  group.add(city);
  group.add(particles({ n: 520, range: 22, fall: 42, spread: 34, wobble: 0, w: .012, h: 1.5, color: C(.6, .85, 1) }));
  group.add(fogCards({ n: 14, color: C(.18, .36, .42), alpha: .16, wide: 34, tall: 9, noise, spreadX: 10, minX: 3, y: 2 }));
  group.visible = false;
  scene.add(group);
  return { group, sky, update(t, ds, dist){ sky.position.set(0, 3, 8); city.position.z = dist % L; },
    flash(t){ const s = t*.9, id = Math.floor(s), h = Math.sin(id*91.7)*4375; return (h - Math.floor(h)) > .9 ? Math.exp(-(s - id)*8) : 0; } };
}

/* ---------- Aurora Ice ---------- */
export function makeIceWorld(scene, tPlate, models){
  const group = new THREE.Group();
  const sky = simpleSky(tPlate, .05, '(1.45 + 2.2*smoothstep(.3, .8, L))', {
    dir: [.06, 0], amt: .035, mask: 'smoothstep(.08, .3, uv.y)',
    pre: 'uv.x += sin(uv.y*7. + uT*.5 + uv.x*5.)*.022*smoothstep(.1, .55, uv.y);',
    post: 'c *= 1. + .4*sin(uv.x*24. + uT*1.5 + sin(uT*.6 + uv.y*4.)*3.)*smoothstep(.15, .5, L);',   // light runs along the curtains
  });
  group.add(sky);
  const mat = new THREE.ShaderMaterial({
    toneMapped: false, side: THREE.DoubleSide,
    uniforms: { uFogColor: U.uFogColor, uFogDensity: U.uFogDensity }, vertexShader: terrainVS,
    fragmentShader: `
      varying vec3 vP; varying vec3 vN; varying float vDepth; varying vec3 vRay;
      uniform float uFogDensity; uniform vec3 uFogColor;
      ${FOG_GLSL}
      void main(){
        vec3 N = normalize(vN);
        float up = abs(N.y);
        float snow = smoothstep(.52, .74, up)*smoothstep(10., 34., vP.y);    // snow on the slopes, a dark clean shoreline at the ice
        vec3 lit = vec3(.2, .36, .34)*(.5 + .5*max(dot(N, normalize(vec3(.1, .8, -.5))), 0.));
        vec3 c = mix(vec3(.012, .016, .024), vec3(.44, .56, .66) + lit, snow);
        gl_FragColor = vec4(fogMix(c, uFogColor, uFogDensity*.6, vDepth, vRay), 1.);
      }`,
  });
  const peaks = strips(geos(models, 'mountain')[0].geometry, mat, 1800, 3, true);
  group.add(peaks);
  // icebergs in the frozen sea
  const bergMat = new THREE.MeshStandardMaterial({ color: 0x8fb3c8, roughness: .3, metalness: .05, flatShading: true, envMapIntensity: 1.2 });
  const berg = new THREE.InstancedMesh(geos(models, 'iceberg')[0].geometry, bergMat, 60);
  const r = seeded(77), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
  for (let c = 0; c < 3; c++) for (let i = 0; i < 20; i++){
    const side = i % 2 ? 1 : -1, x = side*(70 + r()*r()*420), h = 2.5 + r()*r()*10;
    Q.setFromAxisAngle(P.set(0, 1, 0), r()*6.28);
    M.compose(P.set(x, -.5, -r()*512 - c*512 + 60), Q, S.set(h*(1 + r()*.8), h, h*(1 + r()*.8)));
    berg.setMatrixAt(c*20 + i, M);
  }
  berg.frustumCulled = false; berg.layers.enable(1);
  group.add(berg);
  group.add(particles({ n: 180, range: 16, fall: 2.6, spread: 34, wobble: 1.2, w: .05, h: .05, color: C(.7, .85, .95) }));
  group.visible = false;
  scene.add(group);
  return { group, sky, update(t, ds, dist){ sky.position.set(0, 3, 8); peaks.position.z = dist % 1800; berg.position.z = dist % 512; } };
}

export function makePortal(scene, models){
  const frame = new THREE.MeshStandardMaterial({ color: 0x1b1d24, metalness: .9, roughness: .3 });
  const glow = new THREE.MeshBasicMaterial({ color: C(1.2, 6, 8), toneMapped: false });
  const g = new THREE.Group();
  for (const p of geos(models, 'portal')){
    const m = new THREE.Mesh(p.geometry, p.name === 'portalglow' ? glow : frame);
    m.frustumCulled = false; m.layers.enable(1); g.add(m);
  }
  const field = new THREE.Mesh(new THREE.CircleGeometry(12.2, 64), new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uTime: U.uTime },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy/12.2; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.); }`,
    fragmentShader: `varying vec2 vP; uniform float uTime;
      void main(){
        float r = length(vP), a = atan(vP.y, vP.x);
        float s = .5 + .5*sin(a*6. + r*14. - uTime*7.);
        float edge = smoothstep(.55, 1., r);
        gl_FragColor = vec4(vec3(.25, 1.5, 2.6)*(.08 + s*s*.26 + edge*.9), 1.);
      }`,
  }));
  field.position.y = 8; field.frustumCulled = false; g.add(field);
  g.visible = false;
  scene.add(g);
  return g;
}
